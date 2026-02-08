
import { spinner } from '@clack/prompts';
import picocolors from 'picocolors';
import { validateEnvironment } from '../auth/vault';

export async function runDoctor(): Promise<void> {
    const s = spinner();
    s.start('Checking...');

    const { missingKeys, hasFallback } = validateEnvironment();
    let envStatus = picocolors.green('OK');
    if (missingKeys.length > 0) {
        envStatus = hasFallback
            ? picocolors.yellow('WARNING (using fallback)')
            : picocolors.red('CRITICAL (no keys)');
    }

    let bridgeStatus = picocolors.red('OFFLINE');
    try {
        const ctrl = new AbortController();
        const t = setTimeout(() => ctrl.abort(), 2000);
        const res = await fetch('http://localhost:3001/health', { signal: ctrl.signal });
        clearTimeout(t);
        bridgeStatus = res.ok ? picocolors.green('ONLINE') : picocolors.yellow(`ERROR (${res.status})`);
    } catch {}

    s.stop('Done');

    console.log(`${picocolors.bold('Environment:')} ${envStatus}`);
    console.log(`${picocolors.bold('Bridge:')} ${bridgeStatus}`);

    if (missingKeys.length > 0 && !hasFallback) {
        console.log(picocolors.yellow('\nRun "Setup Wizard" to add your keys.'));
    }
    if (bridgeStatus.includes('OFFLINE')) {
        console.log(picocolors.yellow('\nBridge not running. Start it with: npm run bridge'));
    }

    await new Promise(r => setTimeout(r, 2000));
}
