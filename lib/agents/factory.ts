import { createGoogleGenerativeAI } from '@ai-sdk/google';
import { getAgentCredential, AgentRole } from '../auth/vault';

const MODEL_CONFIG: Record<AgentRole, string> = {
    leader: 'gemini-3-pro-preview',
    coder: 'gemini-3-pro-preview',
    designer: 'gemini-3-flash-preview',
    critic: 'gemini-2.5-pro',
};

export function createAgentModel(role: AgentRole) {
    const apiKey = getAgentCredential(role);

    if (!apiKey) {
        throw new Error(`Failed to initialize agent ${role}: No valid API Key found.`);
    }

    const google = createGoogleGenerativeAI({ apiKey });
    const modelId = MODEL_CONFIG[role] ?? MODEL_CONFIG.leader;

    return google(modelId);
}
