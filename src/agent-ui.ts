import picocolors from 'picocolors';
import { spinner } from '@clack/prompts';

export const s = spinner();

export type AgentName = 'jules' | 'flash' | 'stitch' | 'pro3' | 'user' | 'system';

export const agentColors: Record<AgentName, (s: string) => string> = {
    jules: picocolors.blue,
    flash: picocolors.yellow,
    stitch: picocolors.magenta,
    pro3: picocolors.green,
    user: picocolors.white,
    system: picocolors.gray,
};

export const agentDisplayNames: Record<AgentName, string> = {
    jules: 'Google Jules',
    flash: 'Google Flash 3',
    stitch: 'Google Stich',
    pro3: 'Google Pro 3',
    user: 'User',
    system: 'System',
};

export function logAgent(agent: AgentName, message: string) {
    const color = agentColors[agent] || picocolors.white;
    const name = agentDisplayNames[agent] || agent.toUpperCase();
    console.log(`${color(`[${name}]`)} ${message}`);
}

export function logSystem(message: string) {
    console.log(picocolors.gray(`[SYSTEM] ${message}`));
}

export function logThinking(agent: AgentName) {
    s.start(`${agentColors[agent](`[${agent.toUpperCase()}]`)} is thinking...`);
}

export function stopThinking(message: string = '') {
    s.stop(message);
}
