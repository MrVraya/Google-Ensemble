#!/usr/bin/env node
import dotenv from 'dotenv';
import * as readline from 'readline';
import { google } from '@ai-sdk/google';
import { streamText, tool, stepCountIs } from 'ai';
import { executeTool } from '../lib/executor';
import { tools as toolDefs } from '../lib/tools/definitions';
import { AGENT_PROMPTS } from '../lib/agents/prompts';
import { hasEncryptedKeys, unlockVault } from '../lib/auth/vault';
import path from 'path';

dotenv.config({ path: path.resolve(process.cwd(), '.env') });

const C = {
    reset: "\x1b[0m", bold: "\x1b[1m",
    green: "\x1b[32m", yellow: "\x1b[33m",
    blue: "\x1b[34m", cyan: "\x1b[36m", red: "\x1b[31m",
};

if (hasEncryptedKeys()) {
    const tmp = readline.createInterface({ input: process.stdin, output: process.stdout });
    await new Promise<void>(resolve => {
        tmp.question(`${C.yellow}Encrypted keys detected. Password: ${C.reset}`, pw => {
            try {
                unlockVault(pw);
                console.log(`${C.green}Unlocked.${C.reset}`);
            } catch {
                console.error(`${C.red}Wrong password.${C.reset}`);
                process.exit(1);
            }
            tmp.close();
            resolve();
        });
    });
}

if (!process.env.GOOGLE_API_KEY && !process.env.GOOGLE_GENERATIVE_AI_API_KEY) {
    console.error(`${C.red}GOOGLE_API_KEY missing. Check your .env file.${C.reset}`);
    process.exit(1);
}

if (!process.env.GOOGLE_GENERATIVE_AI_API_KEY && process.env.GOOGLE_API_KEY) {
    process.env.GOOGLE_GENERATIVE_AI_API_KEY = process.env.GOOGLE_API_KEY;
}

const formattedTools = Object.fromEntries(
    Object.entries(toolDefs).map(([name, def]) => [
        name,
        tool({
            description: def.description,
            inputSchema: def.inputSchema,
            execute: async (args: Record<string, unknown>) => executeTool(name as keyof typeof toolDefs, args),
        }),
    ])
);

const rl = readline.createInterface({ input: process.stdin, output: process.stdout });
const messages: Array<{ role: 'user' | 'assistant'; content: string }> = [];

console.log(`${C.bold}${C.green}=== GOOGLE ENSEMBLE CLI ===${C.reset}`);
console.log(`${C.cyan}Type 'exit' to quit.${C.reset}\n`);

async function chatLoop() {
    rl.question(`${C.blue}YOU > ${C.reset}`, async (input) => {
        if (input.trim().toLowerCase() === 'exit') {
            rl.close();
            process.exit(0);
        }

        messages.push({ role: 'user', content: input });

        try {
            const result = await streamText({
                model: google('gemini-2.5-flash'),
                system: `${AGENT_PROMPTS.PRO}\n\nCLI mode. Be concise. Use tools when possible.`,
                messages,
                tools: formattedTools,
                stopWhen: stepCountIs(10),
                onStepFinish: (step) => {
                    step.toolCalls?.forEach(tc => {
                        console.log(`${C.yellow}[tool] ${tc.toolName}${C.reset}`);
                    });
                }
            });

            let full = '';
            process.stdout.write(`${C.green}AI > ${C.reset}`);
            for await (const chunk of result.textStream) {
                process.stdout.write(chunk);
                full += chunk;
            }
            process.stdout.write('\n\n');
            messages.push({ role: 'assistant', content: full });
        } catch (err: unknown) {
            const msg = err instanceof Error ? err.message : 'Unknown error';
            console.error(`${C.red}${msg}${C.reset}`);
        }

        chatLoop();
    });
}

chatLoop();
