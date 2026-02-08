'use client';

import { useState, useEffect } from 'react';
import { ChevronRight, ChevronDown, File, Folder, FolderOpen } from 'lucide-react';

const BRIDGE_URL = process.env.NEXT_PUBLIC_BRIDGE_URL || 'http://localhost:3001';

interface FileNode {
    name: string;
    type: 'file' | 'directory';
    size?: number;
    children?: FileNode[];
}

interface FileTreeProps { onFileSelect: (path: string) => void; }

const TreeNode = ({ node, path, onFileSelect }: { node: FileNode; path: string; onFileSelect: (path: string) => void }) => {
    const [open, setOpen] = useState(false);
    const full = path ? `${path}/${node.name}` : node.name;

    if (node.type === 'file') {
        return (
            <div onClick={() => onFileSelect(full)}
                className="flex items-center gap-2 py-1 px-2 hover:bg-green-900/30 cursor-pointer text-xs text-green-400/80 hover:text-green-300 transition-colors">
                <File className="w-3 h-3" /><span>{node.name}</span>
            </div>
        );
    }

    return (
        <div className="pl-2">
            <div onClick={() => setOpen(!open)}
                className="flex items-center gap-2 py-1 px-2 hover:bg-green-900/30 cursor-pointer text-xs font-bold text-green-500 hover:text-green-300 transition-colors">
                {open ? <ChevronDown className="w-3 h-3" /> : <ChevronRight className="w-3 h-3" />}
                {open ? <FolderOpen className="w-3 h-3" /> : <Folder className="w-3 h-3" />}
                <span>{node.name}</span>
            </div>
            {open && node.children && (
                <div className="border-l border-green-900/50 ml-1">
                    {node.children.map(c => <TreeNode key={c.name} node={c} path={full} onFileSelect={onFileSelect} />)}
                </div>
            )}
        </div>
    );
};

async function fetchToken(): Promise<string> {
    try {
        const r = await fetch('/api/bridge-token');
        if (!r.ok) return '';
        return (await r.json()).token || '';
    } catch { return ''; }
}

export default function FileTree({ onFileSelect }: FileTreeProps) {
    const [tree, setTree] = useState<FileNode | null>(null);
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState<string | null>(null);

    const load = async () => {
        setLoading(true);
        setError(null);
        try {
            const token = await fetchToken();
            const headers: Record<string, string> = {};
            if (token) headers['Authorization'] = `Bearer ${token}`;
            const r = await fetch(`${BRIDGE_URL}/fs/tree`, { headers });
            if (!r.ok) throw new Error('Failed to load');
            setTree((await r.json()).tree);
        } catch (e: unknown) {
            setError(e instanceof Error ? e.message : 'Error');
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => { load(); }, []);

    return (
        <div className="h-full flex flex-col bg-black/80 border-r border-green-800/50 w-64">
            <div className="p-3 border-b border-green-800/50 flex justify-between items-center">
                <h3 className="text-xs font-bold text-neon-green tracking-widest">FILES</h3>
                <button onClick={load} className="text-xs text-green-600 hover:text-green-400">REFRESH</button>
            </div>
            <div className="flex-1 overflow-y-auto p-2 font-mono">
                {loading && <div className="text-xs text-green-700 animate-pulse p-2">Loading...</div>}
                {error && <div className="text-xs text-red-500 p-2">{error}</div>}
                {tree && (
                    <div className="border-l border-green-900/30">
                        {tree.children?.map(c => <TreeNode key={c.name} node={c} path="" onFileSelect={onFileSelect} />)}
                    </div>
                )}
            </div>
        </div>
    );
}
