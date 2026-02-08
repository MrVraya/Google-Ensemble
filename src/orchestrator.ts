import { generateText, tool, stepCountIs } from 'ai';
import { logAgent, logSystem, logThinking, stopThinking, agentColors, AgentName } from './agent-ui';
import { listFiles, readFile, writeFile, searchWeb } from './tools/native-fs';
import dotenv from 'dotenv';
import { createAgentModel } from './lib/agents/factory';
import { AGENT_PROMPTS } from '../lib/agents/prompts';
import { runEnsemble } from '../lib/agents/ensemble';
import { z } from 'zod';
import { ContextManager } from './lib/context/manager';
import { CommandRouter } from './lib/cli/commands';

dotenv.config();

const tools = {
    list_files: tool({
        description: 'List files in a directory',
        inputSchema: z.object({
            dirPath: z.string().describe('Directory path to list').optional(),
        }),
        execute: async ({ dirPath }) => listFiles(dirPath || '.'),
    }),
    read_file: tool({
        description: 'Read file content',
        inputSchema: z.object({
            filePath: z.string().describe('Path to the file'),
        }),
        execute: async ({ filePath }) => readFile(filePath),
    }),
    write_file: tool({
        description: 'Write content to a file. Requires user confirmation.',
        inputSchema: z.object({
            filePath: z.string().describe('Path to the file'),
            content: z.string().describe('Content to write'),
        }),
        execute: async ({ filePath, content }) => writeFile(filePath, content),
    }),
    search_web: tool({
        description: 'Search the web',
        inputSchema: z.object({
            query: z.string().describe('Search query'),
        }),
        execute: async ({ query }) => searchWeb(query),
    }),
};

export class Orchestrator {
    private history: Array<{ role: 'user' | 'assistant' | 'system'; content: string }> = [];
    private contextManager: ContextManager;
    private commandRouter: CommandRouter;

    constructor() {
        this.contextManager = new ContextManager();
        this.commandRouter = new CommandRouter(this.contextManager);
    }

    async handleInput(input: string) {
        try {
            const commandResult = await this.commandRouter.handle(input);
            if (commandResult.handled) {
                if (commandResult.shouldExit) process.exit(0);
                if (commandResult.message) logSystem(commandResult.message);
                return;
            }

            logThinking('pro3');

            const fileContext = this.contextManager.getContextMessage();
            const fullPrompt = fileContext ? `${input}\n\nCONTEXT:\n${fileContext}` : input;

            this.history.push({ role: 'user', content: input });

            const finalResponse = await runEnsemble(fullPrompt, {
                onStart: (plan: { thoughts: string, delegation: any[] }) => {
                    stopThinking();
                    logAgent('pro3', `Plan: ${plan.thoughts}`);
                    logSystem(`Delegating to: ${plan.delegation.map((d: any) => d.agent).join(', ')}`);
                },
                onAgentStart: (agent: string) => {
                    logThinking(agent as AgentName);
                },
                onAgentFinish: () => {
                    stopThinking();
                },
                onLog: () => {}
            });

            this.history.push({ role: 'assistant', content: finalResponse });
            stopThinking();
            logAgent('pro3', finalResponse);

        } catch (error: unknown) {
            stopThinking('Error occurred');
            const message = error instanceof Error ? error.message : 'Unknown error';
            logAgent('system', `Error: ${message}`);
        }
    }

    parseAndLogResponse(text: string) {
        const parts = text.split(/(\[(?:PRO 3|JULES|STITCH|FLASH|SYSTEM)\])/gi);
        let currentAgent: AgentName = 'pro3';

        for (const part of parts) {
            if (!part.trim()) continue;
            const match = part.match(/^\[(.*)\]$/);
            if (match) {
                const tag = match[1].toLowerCase();
                if (tag === 'pro 3') currentAgent = 'pro3';
                else if (agentColors[tag as AgentName]) currentAgent = tag as AgentName;
                continue;
            }
            logAgent(currentAgent, part.trim());
        }
    }
}
