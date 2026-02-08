import { planDelegation, executeSpecialist, synthesizeStream, AgentResult } from '@/lib/agents/ensemble';

export const maxDuration = 60;

export async function POST(req: Request) {
    const { messages } = await req.json();
    const prompt = messages[messages.length - 1].content;

    const plan = await planDelegation(prompt);

    const results: AgentResult[] = [];
    for (const task of plan.delegation) {
        const output = await executeSpecialist(task.agent as any, task.instruction);
        results.push({ agent: task.agent, output });
    }

    const stream = await synthesizeStream(prompt, results);
    return stream.toDataStreamResponse();
}
