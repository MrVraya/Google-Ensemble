import crypto from 'crypto';

const ALGO = 'aes-256-gcm';
const KEY_LEN = 32;
const IV_LEN = 16;
const SALT_LEN = 32;
const ITERATIONS = 100_000;
const PREFIX = 'ENC:';

function deriveKey(password: string, salt: Buffer): Buffer {
    return crypto.pbkdf2Sync(password, salt, ITERATIONS, KEY_LEN, 'sha512');
}

export function encrypt(plaintext: string, password: string): string {
    const salt = crypto.randomBytes(SALT_LEN);
    const iv = crypto.randomBytes(IV_LEN);
    const key = deriveKey(password, salt);

    const cipher = crypto.createCipheriv(ALGO, key, iv);
    const encrypted = Buffer.concat([cipher.update(plaintext, 'utf8'), cipher.final()]);
    const tag = cipher.getAuthTag();

    return PREFIX + [salt, iv, tag, encrypted].map(b => b.toString('base64')).join(':');
}

export function decrypt(value: string, password: string): string {
    if (!isEncrypted(value)) throw new Error('Not encrypted');

    const parts = value.slice(PREFIX.length).split(':');
    if (parts.length !== 4) throw new Error('Bad format');

    const [salt, iv, tag, data] = parts.map(p => Buffer.from(p, 'base64'));
    const key = deriveKey(password, salt);

    const decipher = crypto.createDecipheriv(ALGO, key, iv);
    decipher.setAuthTag(tag);

    return Buffer.concat([decipher.update(data), decipher.final()]).toString('utf8');
}

export function isEncrypted(value: string): boolean {
    return value.startsWith(PREFIX);
}
