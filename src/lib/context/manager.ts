import { readFile } from '../../tools/native-fs';
import path from 'path';

export interface ContextItem {
    path: string;
    content: string;
    tokenEstimate: number;
}

export class ContextManager {
    private items: Map<string, ContextItem> = new Map();

    async addFile(filePath: string): Promise<{ success: boolean; message: string }> {
        try {
            const abs = path.resolve(process.cwd(), filePath);
            const content = await readFile(abs);
            const tokenEstimate = Math.ceil(content.length / 4);

            this.items.set(abs, { path: abs, content, tokenEstimate });
            return { success: true, message: `Added ${path.basename(abs)} (~${tokenEstimate} tokens)` };
        } catch (error: any) {
            return { success: false, message: `Failed to add file: ${error.message}` };
        }
    }

    removeFile(pattern: string): { success: boolean; message: string } {
        const matches = [...this.items.keys()].filter(k => k.includes(pattern));
        if (!matches.length) return { success: false, message: `No files matching "${pattern}"` };

        matches.forEach(k => this.items.delete(k));
        return { success: true, message: `Removed ${matches.length} file(s).` };
    }

    clear() {
        this.items.clear();
    }

    getContextMessage(): string {
        if (!this.items.size) return '';

        let ctx = '\n\n--- USER ADDED CONTEXT ---\n';
        for (const item of this.items.values()) {
            ctx += `\nFile: ${path.basename(item.path)}\n\`\`\`\n${item.content}\n\`\`\`\n`;
        }
        return ctx + '--- END CONTEXT ---\n\n';
    }

    getStatus(): string {
        if (!this.items.size) return 'No files in context.';
        const tokens = [...this.items.values()].reduce((s, i) => s + i.tokenEstimate, 0);
        return `${this.items.size} file(s) in context (~${tokens} tokens).`;
    }

    getFiles(): string[] {
        return [...this.items.values()].map(i => path.basename(i.path));
    }
}
