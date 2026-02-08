import { z } from 'zod';
import { tools, MoveItemSchema, CreateFolderSchema, WriteFileSchema, ReadFileSchema, SearchWebSchema, RunCommandSchema } from './tools/definitions';
import fs from 'fs';
import path from 'path';

const BRIDGE_URL = process.env.BRIDGE_URL || 'http://localhost:3001';

type ToolName = keyof typeof tools;

function getBridgeToken(): string {
    try {
        return fs.readFileSync(path.resolve(process.cwd(), '.bridge-token'), 'utf-8').trim();
    } catch { return ''; }
}

async function callBridge(endpoint: string, method: 'GET' | 'POST', body?: any) {
    const token = getBridgeToken();
    const headers: Record<string, string> = { 'Content-Type': 'application/json' };
    if (token) headers['Authorization'] = `Bearer ${token}`;

    if (method === 'GET' && body) {
        const params = new URLSearchParams(body);
        return fetch(`${BRIDGE_URL}${endpoint}?${params}`, { headers }).then(r => r.json());
    }

    const res = await fetch(`${BRIDGE_URL}${endpoint}`, {
        method, headers, body: method === 'POST' ? JSON.stringify(body) : undefined,
    });
    if (!res.ok) throw new Error(`Bridge error (${res.status}): ${await res.text()}`);
    return res.json();
}

export async function executeTool(toolName: ToolName, args: any) {
    try {
        switch (toolName) {
            case 'move_item':
                return await callBridge('/fs/move', 'POST', MoveItemSchema.parse(args));
            case 'create_folder':
                return await callBridge('/fs/mkdir', 'POST', CreateFolderSchema.parse(args));
            case 'write_file':
                return await callBridge('/fs/write', 'POST', WriteFileSchema.parse(args));
            case 'read_file':
                return await callBridge('/fs/read', 'GET', ReadFileSchema.parse(args));
            case 'run_command':
                return await callBridge('/exec', 'POST', RunCommandSchema.parse(args));

            case 'search_web': {
                const { query } = SearchWebSchema.parse(args);
                const apiKey = process.env.GOOGLE_SEARCH_API_KEY;
                const engineId = process.env.GOOGLE_SEARCH_ENGINE_ID;

                if (!apiKey || !engineId) {
                    return { results: [{ title: 'Search disabled', link: '#', snippet: 'Set GOOGLE_SEARCH_API_KEY and GOOGLE_SEARCH_ENGINE_ID in .env' }] };
                }

                const res = await fetch(`https://www.googleapis.com/customsearch/v1?key=${apiKey}&cx=${engineId}&q=${encodeURIComponent(query)}`);
                if (!res.ok) throw new Error(`Search API error (${res.status})`);
                const data = await res.json();
                return { results: data.items?.map((i: any) => ({ title: i.title, link: i.link, snippet: i.snippet })) || [] };
            }

            default:
                throw new Error(`Unknown tool: ${toolName}`);
        }
    } catch (err: any) {
        return { error: err.message };
    }
}
