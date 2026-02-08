'use client';

import { useChat } from '@ai-sdk/react';
import { useState, useEffect, useRef } from 'react';
import { Terminal, Cpu, Globe, HardDrive, Play, Copy, Check, User, Bot } from 'lucide-react';
import ReactMarkdown from 'react-markdown';
import rehypeHighlight from 'rehype-highlight';
import { cn } from '@/lib/utils';
import { DefaultChatTransport } from 'ai';
import FileTree from './FileTree';

export default function CouncilConsole() {
    const { messages, sendMessage, status } = useChat({
        transport: new DefaultChatTransport({ api: '/api/council' }),
    });

    const [input, setInput] = useState('');
    const endRef = useRef<HTMLDivElement>(null);
    const [copiedId, setCopiedId] = useState<string | null>(null);
    const [sidebar, setSidebar] = useState(true);
    const loading = status === 'submitted' || status === 'streaming';

    useEffect(() => { endRef.current?.scrollIntoView({ behavior: 'smooth' }); }, [messages]);

    const copy = (text: string, id: string) => {
        navigator.clipboard.writeText(text);
        setCopiedId(id);
        setTimeout(() => setCopiedId(null), 2000);
    };

    const submit = (e: React.FormEvent) => {
        e.preventDefault();
        if (!input.trim()) return;
        sendMessage({ text: input });
        setInput('');
    };

    return (
        <div className="flex h-screen bg-background text-foreground font-mono overflow-hidden relative">
            {sidebar && (
                <div className="w-64 border-r border-border z-20 bg-card/50 backdrop-blur">
                    <FileTree onFileSelect={p => sendMessage({ text: `Read the file: ${p}` })} />
                </div>
            )}

            <div className="flex-1 flex flex-col h-full relative z-10 transition-all">
                <header className="border-b border-border p-4 flex items-center justify-between bg-card/80 backdrop-blur z-10">
                    <div className="flex items-center gap-2">
                        <Cpu className="w-5 h-5 text-primary" />
                        <h1 className="text-lg font-semibold tracking-tight">Google Ensemble <span className="text-xs text-muted-foreground ml-1">v2.1</span></h1>
                    </div>
                    <div className="flex gap-4 text-xs font-medium text-muted-foreground">
                        <button onClick={() => setSidebar(!sidebar)} className="hover:text-primary transition-colors">
                            [{sidebar ? 'HIDE' : 'SHOW'} SIDEBAR]
                        </button>
                        <div className="flex items-center gap-1"><Globe className="w-3 h-3" /> ONLINE</div>
                        <div className="flex items-center gap-1"><HardDrive className="w-3 h-3" /> BRIDGE</div>
                    </div>
                </header>

                <main className="flex-1 overflow-y-auto p-4 space-y-6">
                    {messages.length === 0 && (
                        <div className="flex flex-col items-center justify-center h-full text-muted-foreground opacity-50">
                            <Terminal className="w-12 h-12 mb-4 opacity-20" />
                            <p className="text-sm font-medium">AWAITING INPUT...</p>
                        </div>
                    )}

                    {messages.map(m => (
                        <div key={m.id} className={cn("group flex flex-col gap-2 p-4 rounded-lg border transition-all",
                            m.role === 'user' ? "bg-primary/5 border-primary/10 items-end ml-12" : "bg-card border-border items-start mr-12")}>
                            <div className="flex items-center gap-2 text-xs uppercase text-muted-foreground mb-1 font-medium">
                                {m.role === 'user' ? <User className="w-3 h-3" /> : <Bot className="w-3 h-3" />}
                                <span>{m.role === 'user' ? 'Operator' : 'System'}</span>
                            </div>

                            {m.parts.map((part, i) => {
                                if (part.type === 'text') {
                                    return (
                                        <div key={i} className={cn("text-sm leading-relaxed max-w-4xl w-full markdown-content",
                                            m.role === 'user' ? "text-foreground text-right" : "text-foreground text-left")}>
                                            <ReactMarkdown rehypePlugins={[rehypeHighlight]}
                                                components={{
                                                    code({ className, children, ...rest }) {
                                                        const lang = /language-(\w+)/.exec(className || '');
                                                        const code = String(children).replace(/\n$/, '');
                                                        if (!lang) return <code className={cn("bg-muted px-1 py-0.5 rounded text-foreground font-medium", className)} {...rest}>{children}</code>;
                                                        return (
                                                            <div className="relative my-4 rounded-md overflow-hidden border border-border bg-muted/50">
                                                                <div className="flex justify-between items-center px-4 py-1 bg-muted/80 text-xs text-muted-foreground border-b border-border">
                                                                    <span>{lang[1].toUpperCase()}</span>
                                                                    <button onClick={() => copy(code, code)} className="flex items-center gap-1 hover:text-primary transition-colors">
                                                                        {copiedId === code ? <Check className="w-3 h-3" /> : <Copy className="w-3 h-3" />}
                                                                        {copiedId === code ? 'Copied' : 'Copy'}
                                                                    </button>
                                                                </div>
                                                                <div className="p-4 overflow-x-auto"><code className={className} {...rest}>{children}</code></div>
                                                            </div>
                                                        );
                                                    }
                                                }}>
                                                {part.text}
                                            </ReactMarkdown>
                                        </div>
                                    );
                                }

                                if (part.type === 'dynamic-tool' || part.type.startsWith('tool-')) {
                                    const tp = part as { type: string; toolCallId: string; toolName?: string; state: string; input?: unknown; output?: unknown };
                                    const name = tp.toolName ?? part.type.replace('tool-', '');
                                    return (
                                        <div key={tp.toolCallId} className="w-full text-xs font-mono bg-muted/30 border-l-2 border-primary/50 p-3 my-2 rounded-r-md">
                                            <div className="flex items-center gap-2 text-primary mb-2">
                                                <Terminal className="w-3 h-3" />
                                                <span className="font-semibold">{name}</span>
                                            </div>
                                            <div className="text-muted-foreground pl-5 overflow-x-auto whitespace-pre-wrap font-mono text-[10px]">{JSON.stringify(tp.input, null, 2)}</div>
                                            {tp.state === 'output-available' && (
                                                <div className="text-foreground pl-5 mt-2 overflow-x-auto whitespace-pre-wrap border-t border-border pt-2 font-mono text-[10px]">
                                                    {JSON.stringify(tp.output, null, 2)}
                                                </div>
                                            )}
                                        </div>
                                    );
                                }
                                return null;
                            })}
                        </div>
                    ))}
                    <div ref={endRef} />
                </main>

                <footer className="p-4 bg-background border-t border-border z-10">
                    <form onSubmit={submit} className="relative flex items-center max-w-5xl mx-auto shadow-sm">
                        <span className="absolute left-4 text-muted-foreground">{`>`}</span>
                        <input className="w-full bg-muted/20 border border-border rounded-md py-3 pl-10 pr-12 text-foreground focus:outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary placeholder-muted-foreground font-mono transition-all"
                            value={input} onChange={e => setInput(e.target.value)} placeholder="Type a command..." autoFocus />
                        <button type="submit" disabled={loading} className="absolute right-2 p-2 text-primary hover:bg-muted rounded-md disabled:opacity-50 transition-all">
                            {loading ? <Cpu className="w-4 h-4 animate-spin" /> : <Play className="w-4 h-4" />}
                        </button>
                    </form>
                </footer>
            </div>
        </div>
    );
}
