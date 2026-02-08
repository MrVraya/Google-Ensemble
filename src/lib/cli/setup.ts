
import { intro, outro, text, confirm, password, isCancel } from '@clack/prompts';
import picocolors from 'picocolors';
import fs from 'fs';
import path from 'path';
import dotenv from 'dotenv';
import { validateEnvironment, lockKeys } from '../auth/vault';

export async function runSetup(force = false): Promise<boolean> {
    const { missingKeys, hasFallback } = validateEnvironment();
    const envPath = path.resolve(process.cwd(), '.env');

    if (!force && (hasFallback || missingKeys.length === 0)) return true;

    console.clear();
    intro(picocolors.bgCyan(picocolors.black(' GOOGLE ENSEMBLE SETUP ')));

    console.log(picocolors.dim('First time? Let\'s configure your API keys.\n'));

    const apiKey = await text({
        message: 'Main GOOGLE_API_KEY:',
        placeholder: 'AIzaSy...',
        validate(v) {
            if (!v) return 'Required';
            if (!v.startsWith('AIza')) return 'Doesn\'t look like a valid Google API key';
        },
    });
    if (isCancel(apiKey)) { outro('Cancelled.'); process.exit(0); }

    const perAgent = await confirm({
        message: 'Configure separate keys per agent? (helps with rate limits)',
    });
    if (isCancel(perAgent)) { outro('Cancelled.'); process.exit(0); }

    let leaderKey = '', coderKey = '', designerKey = '', criticKey = '';

    if (perAgent) {
        leaderKey = await text({ message: 'LEADER_API_KEY:', placeholder: 'Leave empty for main key' }) as string;
        if (isCancel(leaderKey)) process.exit(0);
        coderKey = await text({ message: 'CODER_API_KEY:', placeholder: 'Leave empty for main key' }) as string;
        if (isCancel(coderKey)) process.exit(0);
        designerKey = await text({ message: 'DESIGNER_API_KEY:', placeholder: 'Leave empty for main key' }) as string;
        if (isCancel(designerKey)) process.exit(0);
        criticKey = await text({ message: 'CRITIC_API_KEY:', placeholder: 'Leave empty for main key' }) as string;
        if (isCancel(criticKey)) process.exit(0);
    }

    const save = await confirm({ message: 'Save to .env?' });
    if (isCancel(save)) { outro('Cancelled.'); process.exit(0); }

    if (save) {
        try {
            let content = `GOOGLE_API_KEY=${apiKey}\n`;
            if (leaderKey) content += `LEADER_API_KEY=${leaderKey}\n`;
            if (coderKey) content += `CODER_API_KEY=${coderKey}\n`;
            if (designerKey) content += `DESIGNER_API_KEY=${designerKey}\n`;
            if (criticKey) content += `CRITIC_API_KEY=${criticKey}\n`;

            fs.writeFileSync(envPath, content, { flag: 'w' });
            console.log(picocolors.green(`Saved to ${envPath}`));
            dotenv.config();

            const doEncrypt = await confirm({ message: 'Encrypt keys with a password?' });

            if (!isCancel(doEncrypt) && doEncrypt) {
                const pw = await password({
                    message: 'Choose password:',
                    validate(v) { if (!v || v.length < 4) return 'Min 4 characters'; },
                });

                if (!isCancel(pw)) {
                    const pw2 = await password({ message: 'Confirm password:' });

                    if (!isCancel(pw2) && pw2 === pw) {
                        lockKeys(pw as string);
                        console.log(picocolors.green('Keys encrypted.'));
                        console.log(picocolors.dim('You\'ll need this password at every startup.'));
                    } else if (pw2 !== pw) {
                        console.log(picocolors.yellow('Passwords don\'t match, skipping encryption.'));
                    }
                }
            }
        } catch (err: any) {
            console.log(picocolors.red(`Failed: ${err.message}`));
            return false;
        }
    } else {
        console.log(picocolors.yellow('Not saved. You\'ll need to enter it again.'));
        process.env.GOOGLE_API_KEY = apiKey.toString();
    }

    outro(picocolors.green('Setup done!'));
    await new Promise(r => setTimeout(r, 1000));
    return true;
}
