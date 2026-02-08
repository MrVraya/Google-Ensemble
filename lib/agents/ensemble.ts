
import { generateObject, generateText, streamText, stepCountIs } from 'ai';
import { z } from 'zod';
import { createAgentModel } from './factory';
import { AGENT_PROMPTS } from './prompts';
import { tools as toolDefs } from '../tools/definitions';
import { executeTool } from '../executor';
import { AgentName } from '../../src/agent-ui';

export interface AgentTask {
    agent: 'jules' | 'stitch' | 'flash';
    instruction: string;
}

export interface EnsemblePlan {
    thoughts: string;
    delegation: AgentTask[];
}

export interface AgentResult {
    agent: string;
    output: string;
}

type ProgressCallback = (agent: AgentName, message: string) => void;

export async function planDelegation(prompt: string): Promise<EnsemblePlan> {
    const result = await generateObject({
        model: createAgentModel('leader'),
        system: AGENT_PROMPTS.LEADER_PLANNING,
        prompt,
        schema: z.object({
            thoughts: z.string().describe('Your reasoning for the plan.'),
            delegation: z.array(z.object({
                agent: z.enum(['jules', 'stitch', 'flash']),
                instruction: z.string(),
            })),
        }),
    });
    return result.object;
}

export async function executeSpecialist(agentName: 'jules' | 'stitch' | 'flash', instruction: string, onProgress?: ProgressCallback): Promise<string> {
    const roleMap = { jules: 'coder', stitch: 'designer', flash: 'critic' } as const;
    const model = createAgentModel(roleMap[agentName]);

    const allowedTools: Record<string, string[]> = {
        jules: ['read_file', 'write_file', 'move_item'],
        flash: ['read_file', 'search_web'],
        stitch: ['read_file'],
    };

    const filtered: Record<string, any> = {};
    for (const name of allowedTools[agentName] || []) {
        if (toolDefs[name as keyof typeof toolDefs]) {
            filtered[name] = toolDefs[name as keyof typeof toolDefs];
        }
    }

    const aiTools = Object.fromEntries(
        Object.entries(filtered).map(([name, def]) => [
            name,
            require('ai').tool({
                description: def.description,
                inputSchema: def.inputSchema,
                execute: async (args: any) => {
                    if (onProgress) onProgress(agentName as AgentName, `Running tool: ${name}`);
                    return executeTool(name as any, args);
                },
            }),
        ])
    );

    const promptKey = agentName.toUpperCase() as keyof typeof AGENT_PROMPTS;
    const result = await generateText({
        model,
        system: AGENT_PROMPTS[promptKey],
        prompt: instruction,
        tools: aiTools,
        stopWhen: stepCountIs(5),
    });

    return result.text;
}

export async function synthesize(prompt: string, results: AgentResult[]): Promise<string> {
    const ctx = results.map(r => `[${r.agent.toUpperCase()}]:\n${r.output}`).join('\n\n');
    const result = await generateText({
        model: createAgentModel('leader'),
        system: AGENT_PROMPTS.PRO,
        prompt: `User Request: ${prompt}\n\nTeam Results:\n${ctx}\n\nSynthesize the final answer.`,
    });
    return result.text;
}

export async function synthesizeStream(prompt: string, results: AgentResult[]) {
    const ctx = results.map(r => `[${r.agent.toUpperCase()}]:\n${r.output}`).join('\n\n');
    return streamText({
        model: createAgentModel('leader'),
        system: AGENT_PROMPTS.PRO,
        prompt: `User Request: ${prompt}\n\nTeam Results:\n${ctx}\n\nSynthesize the final answer.`,
    });
}

export async function runEnsemble(prompt: string, callbacks: {
    onStart: (plan: EnsemblePlan) => void;
    onAgentStart: (agent: string, instruction: string) => void;
    onAgentFinish: (agent: string, output: string) => void;
    onLog: (message: string) => void;
}) {
    const plan = await planDelegation(prompt);
    callbacks.onStart(plan);

    if (plan.delegation.length === 0) {
        const result = await generateText({
            model: createAgentModel('leader'),
            system: AGENT_PROMPTS.PRO,
            prompt,
        });
        return result.text;
    }

    const results: AgentResult[] = [];
    for (const task of plan.delegation) {
        callbacks.onAgentStart(task.agent, task.instruction);
        const output = await executeSpecialist(task.agent, task.instruction, (agent, msg) => callbacks.onLog(`[${agent}] ${msg}`));
        results.push({ agent: task.agent, output });
        callbacks.onAgentFinish(task.agent, output);
    }

    return await synthesize(prompt, results);
}
