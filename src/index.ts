
import { intro, outro, text, isCancel } from '@clack/prompts';
import picocolors from 'picocolors';
import { Orchestrator } from './orchestrator';
import { validateEnvironment } from './lib/auth/vault';
import boxen from 'boxen';

interface RGB { r: number; g: number; b: number; }

const LOGO = [
    " ▄▄ •              ▄▄ • ▄▄▌  ▄▄▄ .            ",
    "▐█ ▀ ▪▪     ▪     ▐█ ▀ ▪██•  ▀▄.▀·            ",
    "▄█ ▀█▄ ▄█▀▄  ▄█▀▄ ▄█ ▀█▄██▪  ▐▀▀▪▄            ",
    "▐█▄▪▐█▐█▌.▐▌▐█▌.▐▌▐█▄▪▐█▐█▌▐▌▐█▄▄▌            ",
    "·▀▀▀▀  ▀█▄▀▪ ▀█▄▀▪·▀▀▀▀ .▀▀▀  ▀▀▀             ",
    "▄▄▄ . ▐ ▄ .▄▄ · ▄▄▄ .• ▌ ▄ ·. ▄▄▄▄· ▄▄▌  ▄▄▄ .",
    "▀▄.▀·•█▌▐█▐█ ▀. ▀▄.▀··██ ▐███▪▐█ ▀█▪██•  ▀▄.▀·",
    "▐▀▀▪▄▐█▐▐▌▄▀▀▀█▄▐▀▀▪▄▐█ ▌▐▌▐█·▐█▀▀█▄██▪  ▐▀▀▪▄",
    "▐█▄▄▌██▐█▌▐█▄▪▐█▐█▄▄▌██ ██▌▐█▌██▄▪▐█▐█▌▐▌▐█▄▄▌",
    " ▀▀▀ ▀▀ █▪ ▀▀▀▀  ▀▀▀ ▀▀  █▪▀▀▀·▀▀▀▀ .▀▀▀  ▀▀▀ "
];

const GRADIENT: RGB[] = [
    { r: 13, g: 82, b: 236 },
    { r: 150, g: 60, b: 255 },
    { r: 64, g: 224, b: 208 },
];

function lerp(a: RGB, b: RGB, t: number): RGB {
    return {
        r: Math.round(a.r + (b.r - a.r) * t),
        g: Math.round(a.g + (b.g - a.g) * t),
        b: Math.round(a.b + (b.b - a.b) * t),
    };
}

function printLogo() {
    const reset = "\x1b[0m";
    for (const line of LOGO) {
        let out = "";
        for (let i = 0; i < line.length; i++) {
            const secSize = line.length / (GRADIENT.length - 1);
            const sec = Math.min(Math.floor(i / secSize), GRADIENT.length - 2);
            const c = lerp(GRADIENT[sec], GRADIENT[sec + 1], (i - sec * secSize) / secSize);
            out += `\x1b[38;2;${c.r};${c.g};${c.b}m${line[i]}`;
        }
        console.log(out + reset);
    }
}

async function boot() {
    console.clear();
    console.log(picocolors.bgYellow(picocolors.black(' * Google Ensemble research preview ')));
    console.log('');
    printLogo();
    console.log('');
    console.log(picocolors.gray('/help for info | be specific for best results'));
    console.log('');
}

import { runSetup } from './lib/cli/setup';
import { runDoctor } from './lib/cli/doctor';
import { select, password as promptPassword, isCancel as isPasswordCancel } from '@clack/prompts';
import { hasEncryptedKeys, unlockVault } from './lib/auth/vault';

async function main() {
    await runSetup();

    if (hasEncryptedKeys()) {
        const pw = await promptPassword({ message: 'Keys are encrypted. Password:' });
        if (isPasswordCancel(pw)) { outro('Exiting.'); process.exit(0); }

        try {
            unlockVault(pw as string);
            console.log(picocolors.green('Unlocked.'));
        } catch {
            console.log(picocolors.red('Wrong password.'));
            process.exit(1);
        }
    }

    const { missingKeys, hasFallback } = validateEnvironment();
    if (missingKeys.length > 0) {
        intro(picocolors.bgRed(picocolors.white(' MISSING KEYS ')));
        missingKeys.forEach(k => console.log(picocolors.red(`  missing: ${k}`)));
        if (hasFallback) {
            console.log(picocolors.green('  fallback key found, might hit rate limits'));
        } else {
            console.log(picocolors.red('  no fallback key'));
        }
        await new Promise(r => setTimeout(r, 2000));
    }

    await boot();

    while (true) {
        const action = await select({
            message: 'Menu',
            options: [
                { value: 'chat', label: 'Start', hint: 'enter workspace' },
                { value: 'doctor', label: 'Health', hint: 'check status' },
                { value: 'setup', label: 'Setup', hint: 'reconfigure keys' },
                { value: 'exit', label: 'Exit' },
            ],
        });

        if (isCancel(action) || action === 'exit') {
            outro('Bye!');
            process.exit(0);
        }

        if (action === 'doctor') { await runDoctor(); console.log(''); continue; }
        if (action === 'setup') { await runSetup(true); console.log(''); continue; }

        if (action === 'chat') {
            const orch = new Orchestrator();

            while (true) {
                const input = await text({
                    message: picocolors.cyan('You:'),
                    placeholder: 'Ask anything...',
                    validate(v) { if (!v) return 'Enter something'; },
                });

                if (isCancel(input)) { console.log(picocolors.dim('Back to menu.')); break; }

                const cmd = input.toString().trim();
                if (cmd === '/exit') { console.log(picocolors.dim('Back to menu.')); break; }
                if (cmd === '/clear') { console.clear(); await boot(); continue; }

                await orch.handleInput(cmd);
            }
        }
    }
}

main().catch(console.error);
