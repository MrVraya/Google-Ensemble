const PREFIX = 'ENC:';
const ITERATIONS = 100_000;
const SALT_LEN = 32;
const IV_LEN = 16;

function toBase64(buf: ArrayBuffer): string {
    return btoa(String.fromCharCode(...new Uint8Array(buf)));
}

function fromBase64(s: string): Uint8Array {
    return Uint8Array.from(atob(s), c => c.charCodeAt(0));
}

async function deriveKey(password: string, salt: Uint8Array): Promise<CryptoKey> {
    const raw = await crypto.subtle.importKey(
        'raw', new TextEncoder().encode(password), 'PBKDF2', false, ['deriveKey']
    );
    return crypto.subtle.deriveKey(
        { name: 'PBKDF2', salt, iterations: ITERATIONS, hash: 'SHA-512' },
        raw,
        { name: 'AES-GCM', length: 256 },
        false,
        ['encrypt', 'decrypt']
    );
}

export async function encryptClient(plaintext: string, password: string): Promise<string> {
    const salt = crypto.getRandomValues(new Uint8Array(SALT_LEN));
    const iv = crypto.getRandomValues(new Uint8Array(IV_LEN));
    const key = await deriveKey(password, salt);

    const buf = await crypto.subtle.encrypt({ name: 'AES-GCM', iv }, key, new TextEncoder().encode(plaintext));
    const full = new Uint8Array(buf);
    const ciphertext = full.slice(0, full.length - 16);
    const tag = full.slice(full.length - 16);

    return PREFIX + [salt, iv, tag, ciphertext].map(b => toBase64(b)).join(':');
}

export async function decryptClient(value: string, password: string): Promise<string> {
    if (!isEncryptedClient(value)) throw new Error('Not encrypted');

    const [saltB64, ivB64, tagB64, dataB64] = value.slice(PREFIX.length).split(':');
    const tag = fromBase64(tagB64);
    const data = fromBase64(dataB64);
    const key = await deriveKey(password, fromBase64(saltB64));

    const combined = new Uint8Array(data.length + tag.length);
    combined.set(data);
    combined.set(tag, data.length);

    const decrypted = await crypto.subtle.decrypt({ name: 'AES-GCM', iv: fromBase64(ivB64) }, key, combined);
    return new TextDecoder().decode(decrypted);
}

export function isEncryptedClient(value: string): boolean {
    return value.startsWith(PREFIX);
}
