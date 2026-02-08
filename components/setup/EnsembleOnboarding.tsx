
'use client';

import React, { useState, useEffect } from 'react';
import { Lock, Key, ShieldCheck, Terminal } from 'lucide-react';
import { encryptClient } from '@/lib/crypto/encryption.client';

export function EnsembleOnboarding() {
    const [keys, setKeys] = useState({
        GOOGLE_PRO_KEY: '', GOOGLE_JULES_KEY: '',
        GOOGLE_FLASH_KEY: '', GOOGLE_STITCH_KEY: '',
    });
    const [encPassword, setEncPassword] = useState('');
    const [confirmPassword, setConfirmPassword] = useState('');
    const [visible, setVisible] = useState(false);
    const [saved, setSaved] = useState(false);
    const [pwError, setPwError] = useState('');

    useEffect(() => {
        if (!localStorage.getItem('ENSEMBLE_ONBOARDING_COMPLETE')) setVisible(true);
    }, []);

    const handleSave = async () => {
        setPwError('');
        let toStore = { ...keys };

        if (encPassword) {
            if (encPassword !== confirmPassword) { setPwError('Passwords don\'t match.'); return; }
            if (encPassword.length < 4) { setPwError('Min 4 characters.'); return; }

            try {
                const enc: Record<string, string> = {};
                for (const [k, v] of Object.entries(keys)) {
                    enc[k] = v ? await encryptClient(v, encPassword) : '';
                }
                toStore = enc as typeof keys;
            } catch {
                setPwError('Encryption failed.');
            }
        }

        localStorage.setItem('ENSEMBLE_KEYS', JSON.stringify(toStore));
        localStorage.setItem('ENSEMBLE_ONBOARDING_COMPLETE', 'true');
        setSaved(true);
        setTimeout(() => setVisible(false), 1500);
    };

    if (!visible) return null;

    const inputCls = "w-full bg-[#1a1a1a] border border-[#333] p-3 rounded text-white focus:outline-none transition-colors";

    return (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/90 backdrop-blur-sm p-4 font-mono text-xs md:text-sm">
            <div className="w-full max-w-2xl bg-[#0a0a0a] border border-[#333] shadow-2xl rounded-lg overflow-hidden">
                <div className="bg-[#111] p-4 border-b border-[#333] flex items-center justify-between">
                    <div className="flex items-center gap-2 text-[#D97E63]">
                        <Terminal size={18} />
                        <span className="font-bold tracking-wider">ENSEMBLE // SETUP</span>
                    </div>
                    <div className="flex gap-2">
                        <div className="w-3 h-3 rounded-full bg-red-500/20 border border-red-500/50" />
                        <div className="w-3 h-3 rounded-full bg-yellow-500/20 border border-yellow-500/50" />
                        <div className="w-3 h-3 rounded-full bg-green-500/20 border border-green-500/50" />
                    </div>
                </div>

                <div className="p-8 space-y-6">
                    <div>
                        <h2 className="text-xl font-bold text-white">API Keys</h2>
                        <p className="text-gray-400 mt-1">Enter your Gemini API keys for each agent.</p>
                    </div>

                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                        {([
                            ['GOOGLE_PRO_KEY', 'Leader (Pro)', 'text-[#D97E63]', 'focus:border-[#D97E63]'],
                            ['GOOGLE_JULES_KEY', 'Coder (Jules)', 'text-blue-400', 'focus:border-blue-400'],
                            ['GOOGLE_FLASH_KEY', 'Critic (Flash)', 'text-yellow-400', 'focus:border-yellow-400'],
                            ['GOOGLE_STITCH_KEY', 'Designer (Stitch)', 'text-purple-400', 'focus:border-purple-400'],
                        ] as const).map(([field, label, labelColor, focusColor]) => (
                            <div key={field} className="space-y-1">
                                <label className={`${labelColor} flex items-center gap-2`}>
                                    <Key size={14} /> {label}
                                </label>
                                <input type="password" className={`${inputCls} ${focusColor}`}
                                    placeholder={field} value={keys[field]}
                                    onChange={e => setKeys(prev => ({ ...prev, [field]: e.target.value }))} />
                            </div>
                        ))}
                    </div>

                    <div className="space-y-2 border-t border-[#333] pt-4">
                        <p className="text-gray-400 text-xs">Optional: encrypt keys before storing locally.</p>
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                            <div className="space-y-1">
                                <label className="text-green-400 flex items-center gap-2"><Lock size={14} /> Password</label>
                                <input type="password" className={`${inputCls} focus:border-green-400`}
                                    placeholder="Optional" value={encPassword}
                                    onChange={e => setEncPassword(e.target.value)} />
                            </div>
                            <div className="space-y-1">
                                <label className="text-green-400 flex items-center gap-2"><Lock size={14} /> Confirm</label>
                                <input type="password" className={`${inputCls} focus:border-green-400`}
                                    placeholder="Optional" value={confirmPassword}
                                    onChange={e => setConfirmPassword(e.target.value)} />
                            </div>
                        </div>
                        {pwError && <p className="text-red-400 text-xs">{pwError}</p>}
                    </div>

                    <div className="pt-4 flex justify-end">
                        <button onClick={handleSave} disabled={saved}
                            className={`flex items-center gap-2 px-6 py-3 rounded font-bold transition-all ${
                                saved ? 'bg-green-500/20 text-green-400 border border-green-500/50'
                                    : 'bg-[#D97E63] hover:bg-[#b05d45] text-white'
                            }`}>
                            {saved ? <><ShieldCheck size={18} /> Done</> : <><Lock size={18} /> Save</>}
                        </button>
                    </div>
                </div>
            </div>
        </div>
    );
}
