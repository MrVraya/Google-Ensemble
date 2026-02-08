import fs from 'fs';
import path from 'path';

export async function GET() {
    const tokenPath = path.resolve(process.cwd(), '.bridge-token');
    try {
        const token = fs.readFileSync(tokenPath, 'utf-8').trim();
        return Response.json({ token });
    } catch {
        return Response.json({ token: '' }, { status: 404 });
    }
}
