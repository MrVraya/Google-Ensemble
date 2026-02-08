import fs from 'fs/promises';
import path from 'path';
import { confirm } from '@clack/prompts';
import picocolors from 'picocolors';

export async function listFiles(dirPath: string = '.') {
    try {
        const files = await fs.readdir(dirPath, { withFileTypes: true });
        return files.map(file => ({
            name: file.name,
            isDirectory: file.isDirectory(),
            path: path.join(dirPath, file.name)
        }));
    } catch (error: any) {
        return `Error listing files: ${error.message}`;
    }
}

export async function readFile(filePath: string) {
    try {
        return await fs.readFile(filePath, 'utf-8');
    } catch (error: any) {
        return `Error reading file: ${error.message}`;
    }
}

export async function writeFile(filePath: string, content: string) {
    try {
        const exists = await fs.stat(filePath).then(() => true).catch(() => false);

        if (exists) {
            const overwrite = await confirm({
                message: picocolors.yellow(`File ${filePath} already exists. Overwrite?`),
            });
            if (!overwrite || typeof overwrite === 'symbol') return 'Operation cancelled.';
        }

        await fs.mkdir(path.dirname(filePath), { recursive: true });
        await fs.writeFile(filePath, content, 'utf-8');
        return `Wrote ${filePath}`;
    } catch (error: any) {
        return `Error writing file: ${error.message}`;
    }
}

export async function searchWeb(query: string) {
    return `[Mock] Search results for: "${query}"\n1. Result A\n2. Result B`;
}
