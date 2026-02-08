import express, { Request, Response, NextFunction } from 'express';
import cors from 'cors';
import fs from 'fs/promises';
import fsSync from 'fs';
import path from 'path';
import dotenv from 'dotenv';
import crypto from 'crypto';
import { exec } from 'child_process';

dotenv.config();

const app = express();
const PORT = process.env.PORT || 3001;
const SANDBOX_ROOT = path.resolve(process.env.SANDBOX_ROOT || process.cwd());
const EXEC_TIMEOUT_MS = 30_000;

const BRIDGE_TOKEN = crypto.randomBytes(32).toString('hex');
const TOKEN_PATH = path.join(SANDBOX_ROOT, '.bridge-token');

async function writeToken() {
    await fs.writeFile(TOKEN_PATH, BRIDGE_TOKEN, 'utf-8');
}
writeToken();

function cleanupToken() {
    try { fsSync.unlinkSync(TOKEN_PATH); } catch {}
}
process.on('exit', cleanupToken);
process.on('SIGINT', () => { cleanupToken(); process.exit(0); });
process.on('SIGTERM', () => { cleanupToken(); process.exit(0); });

const rateLimitMap = new Map<string, { count: number; resetAt: number }>();

function rateLimit(req: Request, res: Response, next: NextFunction) {
    const ip = req.ip || req.socket.remoteAddress || 'unknown';
    const now = Date.now();
    const entry = rateLimitMap.get(ip);

    if (!entry || now > entry.resetAt) {
        rateLimitMap.set(ip, { count: 1, resetAt: now + 60_000 });
        return next();
    }

    entry.count++;
    if (entry.count > 120) {
        return res.status(429).json({ error: 'Too many requests' });
    }
    next();
}

function authenticate(req: Request, res: Response, next: NextFunction) {
    if (req.path === '/health') return next();

    const auth = req.headers.authorization;
    if (!auth || auth !== `Bearer ${BRIDGE_TOKEN}`) {
        return res.status(401).json({ error: 'Unauthorized' });
    }
    next();
}

const BLOCKED_PATTERNS = [
    /\bcurl\b/i, /\bwget\b/i, /\bnc\s/i, /\bncat\b/i, /\bnetcat\b/i,
    /\bbash\s+-i\b/, /\/dev\/tcp\//, /\bmkfifo\b/,
    /\brm\s+-rf\s+\//, /\bformat\b.*[a-zA-Z]:/i,
    /\b(shutdown|reboot|halt|poweroff)\b/i,
    /\breg\s+(add|delete)\b/i, /\bschtasks\b/i,
    /\bsudo\b/, /\brunas\b/i,
    /powershell.*\b(IEX|Invoke-Expression|downloadstring|webclient|Start-Process)\b/i,
    /\bcertutil\b.*-urlcache/i,
    /\bbitsadmin\b.*\/transfer/i,
    /\bxmrig\b/i, /\bminerd\b/i,
];

function isCommandBlocked(cmd: string): boolean {
    return BLOCKED_PATTERNS.some(p => p.test(cmd));
}

app.use(cors({ origin: process.env.CORS_ORIGIN || 'http://localhost:3000' }));
app.use(express.json({ limit: '10mb' }));
app.use(rateLimit);
app.use(authenticate);
app.use((_req: Request, res: Response, next: NextFunction) => {
    res.setHeader('X-Content-Type-Options', 'nosniff');
    res.setHeader('X-Frame-Options', 'DENY');
    next();
});

app.get('/health', (_req, res) => {
    res.json({ status: 'ok', version: '1.0.0' });
});

const validatePath = (req: Request, res: Response, next: NextFunction) => {
    const rel = req.query.path as string || req.body.path as string || req.body.destination as string || req.body.source as string;

    if (!rel) {
        if (req.path === '/fs/tree') {
            (req as any).safePath = SANDBOX_ROOT;
            return next();
        }
        if (req.path === '/fs/move') return next();
        return res.status(400).json({ error: 'Path is required' });
    }

    try {
        const abs = path.resolve(SANDBOX_ROOT, rel);
        if (!abs.startsWith(SANDBOX_ROOT)) {
            return res.status(403).json({ error: 'Path outside sandbox' });
        }
        (req as any).safePath = abs;
        next();
    } catch {
        res.status(400).json({ error: 'Invalid path' });
    }
};

const resolveSafe = (rel: string): string => {
    const abs = path.resolve(SANDBOX_ROOT, rel);
    if (!abs.startsWith(SANDBOX_ROOT)) throw new Error('Path outside sandbox');
    return abs;
};

app.get('/fs/read', validatePath, async (req: Request, res: Response) => {
    try {
        const content = await fs.readFile((req as any).safePath, 'utf-8');
        res.json({ content });
    } catch {
        res.status(500).json({ error: 'File read failed' });
    }
});

app.post('/fs/write', validatePath, async (req: Request, res: Response) => {
    try {
        const safePath = (req as any).safePath;
        await fs.mkdir(path.dirname(safePath), { recursive: true });
        await fs.writeFile(safePath, req.body.content, 'utf-8');
        res.json({ success: true });
    } catch {
        res.status(500).json({ error: 'File write failed' });
    }
});

app.post('/fs/mkdir', validatePath, async (req: Request, res: Response) => {
    try {
        await fs.mkdir((req as any).safePath, { recursive: true });
        res.json({ success: true });
    } catch {
        res.status(500).json({ error: 'mkdir failed' });
    }
});

app.post('/fs/move', async (req: Request, res: Response) => {
    try {
        const { source, destination } = req.body;
        if (!source || !destination) {
            return res.status(400).json({ error: 'Source and destination required' });
        }
        const src = resolveSafe(source);
        const dst = resolveSafe(destination);
        await fs.mkdir(path.dirname(dst), { recursive: true });
        await fs.rename(src, dst);
        res.json({ success: true });
    } catch (err: unknown) {
        const msg = err instanceof Error ? err.message : '';
        res.status(msg.includes('outside sandbox') ? 403 : 500).json({ error: msg || 'Move failed' });
    }
});

interface TreeNode {
    name: string;
    type: 'file' | 'directory';
    size?: number;
    children?: TreeNode[];
}

async function buildTree(dir: string): Promise<TreeNode> {
    const stats = await fs.stat(dir);
    if (!stats.isDirectory()) {
        return { name: path.basename(dir), type: 'file', size: stats.size };
    }

    const entries = await fs.readdir(dir);
    const children = (await Promise.all(
        entries.map(async f => {
            try { return await buildTree(path.join(dir, f)); }
            catch { return null; }
        })
    )).filter((c): c is TreeNode => c !== null);

    return { name: path.basename(dir), type: 'directory', children };
}

app.get('/fs/tree', validatePath, async (req: Request, res: Response) => {
    try {
        const tree = await buildTree((req as any).safePath);
        res.json({ tree });
    } catch {
        res.status(500).json({ error: 'Tree read failed' });
    }
});

app.post('/exec', async (req: Request, res: Response) => {
    try {
        const { command } = req.body;
        if (!command) return res.status(400).json({ error: 'Command is required' });

        if (isCommandBlocked(command)) {
            return res.status(403).json({ error: 'Command blocked by security policy' });
        }

        exec(command, { cwd: SANDBOX_ROOT, timeout: EXEC_TIMEOUT_MS }, (error, stdout, stderr) => {
            if (error) {
                return res.json({ output: stdout, error: stderr || error.message, exitCode: error.code || 1 });
            }
            res.json({ output: stdout, error: stderr, exitCode: 0 });
        });
    } catch {
        res.status(500).json({ error: 'Execution failed' });
    }
});

app.listen(Number(PORT), '127.0.0.1', () => {
    console.log(`bridge running on http://127.0.0.1:${PORT} | sandbox: ${SANDBOX_ROOT}`);
});
