import dotenv from 'dotenv';
import fs from 'fs';
import path from 'path';
import { encrypt, decrypt, isEncrypted } from '../crypto/encryption';

dotenv.config();

export type AgentRole = 'leader' | 'coder' | 'designer' | 'critic';

const KEY_MAP: Record<AgentRole, string> = {
    leader: 'LEADER_API_KEY',
    coder: 'CODER_API_KEY',
    designer: 'DESIGNER_API_KEY',
    critic: 'CRITIC_API_KEY',
};

const SENSITIVE_KEYS = [
    'GOOGLE_API_KEY', 'LEADER_API_KEY', 'CODER_API_KEY',
    'DESIGNER_API_KEY', 'CRITIC_API_KEY', 'GOOGLE_SEARCH_API_KEY',
];

export function getAgentCredential(role: AgentRole): string | undefined {
    return process.env[KEY_MAP[role]] || process.env.GOOGLE_API_KEY;
}

export function validateEnvironment(): { missingKeys: string[]; hasFallback: boolean } {
    const missing = Object.values(KEY_MAP).filter(k => !process.env[k]);
    return { missingKeys: missing, hasFallback: !!process.env.GOOGLE_API_KEY };
}

export function hasValidCredentials(): boolean {
    const { missingKeys, hasFallback } = validateEnvironment();
    return missingKeys.length === 0 || hasFallback;
}

export function hasEncryptedKeys(): boolean {
    const p = path.resolve(process.cwd(), '.env');
    if (!fs.existsSync(p)) return false;
    return fs.readFileSync(p, 'utf-8').includes('ENC:');
}

export function unlockVault(password: string): void {
    const p = path.resolve(process.cwd(), '.env');
    if (!fs.existsSync(p)) throw new Error('.env not found');

    for (const line of fs.readFileSync(p, 'utf-8').split('\n')) {
        const t = line.trim();
        if (!t || t.startsWith('#')) continue;
        const eq = t.indexOf('=');
        if (eq === -1) continue;

        const key = t.substring(0, eq).trim();
        const val = t.substring(eq + 1).trim();
        if (isEncrypted(val)) process.env[key] = decrypt(val, password);
    }
}

export function lockKeys(password: string): void {
    const p = path.resolve(process.cwd(), '.env');
    if (!fs.existsSync(p)) throw new Error('.env not found');

    const lines = fs.readFileSync(p, 'utf-8').split('\n');
    const out: string[] = [];

    for (const line of lines) {
        const t = line.trim();
        if (!t || t.startsWith('#')) { out.push(line); continue; }
        const eq = t.indexOf('=');
        if (eq === -1) { out.push(line); continue; }

        const key = t.substring(0, eq).trim();
        const val = t.substring(eq + 1).trim();

        if (SENSITIVE_KEYS.includes(key) && val && !isEncrypted(val)) {
            out.push(`${key}=${encrypt(val, password)}`);
        } else {
            out.push(line);
        }
    }

    fs.writeFileSync(p, out.join('\n'), 'utf-8');
}
