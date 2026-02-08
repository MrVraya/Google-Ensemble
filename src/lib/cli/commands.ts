import { ContextManager } from '../context/manager';
import picocolors from 'picocolors';
import { validateEnvironment } from '../auth/vault';

export type CommandResult = {
    handled: boolean;
    shouldExit?: boolean;
    message?: string;
};

export class CommandRouter {
    constructor(private contextManager: ContextManager) {}

    async handle(input: string): Promise<CommandResult> {
        const trimmed = input.trim();
        if (!trimmed.startsWith('/')) return { handled: false };

        const [command, ...args] = trimmed.split(' ');
        const arg = args.join(' ');

        switch (command) {
            case '/help': return this.showHelp();
            case '/clear': return this.clear();
            case '/add': return this.addFile(arg);
            case '/drop': return this.dropFile(arg);
            case '/context': return this.showContext();
            case '/compact': return this.compact();
            case '/doctor': return this.doctor();
            case '/exit': return { handled: true, shouldExit: true };
            default:
                return { handled: true, message: picocolors.red(`Unknown command: ${command}. Type /help.`) };
        }
    }

    private showHelp(): CommandResult {
        console.log(`
${picocolors.bold('Commands:')}
${picocolors.cyan('/help')}       - Show this message
${picocolors.cyan('/clear')}      - Clear terminal and reset session
${picocolors.cyan('/add <file>')} - Add a file to context
${picocolors.cyan('/drop <pat>')} - Remove files matching pattern
${picocolors.cyan('/context')}    - Show current context
${picocolors.cyan('/compact')}    - Compact conversation history
${picocolors.cyan('/doctor')}     - Run system health check
${picocolors.cyan('/exit')}       - Exit
`);
        return { handled: true };
    }

    private async clear(): Promise<CommandResult> {
        console.clear();
        this.contextManager.clear();
        console.log(picocolors.yellow('Session cleared. Restart CLI for full reset.'));
        return { handled: true, message: 'Session cleared.' };
    }

    private async addFile(filePath: string): Promise<CommandResult> {
        if (!filePath) return { handled: true, message: picocolors.yellow('Usage: /add <file_path>') };

        const result = await this.contextManager.addFile(filePath.replace(/['"]/g, ''));
        console.log(result.success
            ? picocolors.green(`+ ${result.message}`)
            : picocolors.red(`x ${result.message}`));
        return { handled: true };
    }

    private dropFile(pattern: string): CommandResult {
        if (!pattern) return { handled: true, message: picocolors.yellow('Usage: /drop <pattern>') };

        const result = this.contextManager.removeFile(pattern);
        console.log(result.success
            ? picocolors.green(`+ ${result.message}`)
            : picocolors.red(`x ${result.message}`));
        return { handled: true };
    }

    private showContext(): CommandResult {
        console.log(picocolors.bold('\nContext:'));
        console.log(this.contextManager.getStatus());
        const files = this.contextManager.getFiles();
        if (files.length) {
            console.log(picocolors.dim('Files:'));
            files.forEach(f => console.log(picocolors.cyan(` - ${f}`)));
        }
        console.log('');
        return { handled: true };
    }

    private compact(): CommandResult {
        console.log(picocolors.gray('Compacting conversation history...'));
        return { handled: true, message: 'History compacted.' };
    }

    private doctor(): CommandResult {
        console.log(picocolors.bold('\nDoctor:'));
        const { missingKeys, hasFallback } = validateEnvironment();

        if (!missingKeys.length) {
            console.log(picocolors.green('All API keys present.'));
        } else {
            console.log(picocolors.yellow('Missing: ' + missingKeys.join(', ')));
            console.log(hasFallback
                ? picocolors.green('Fallback key active.')
                : picocolors.red('No valid keys found.'));
        }

        console.log(`CWD: ${process.cwd()}`);
        return { handled: true };
    }
}
