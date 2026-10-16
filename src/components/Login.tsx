import React, { useState } from 'react';
import { LogIn, Lock, AlertCircle, RefreshCw, QrCode } from 'lucide-react';
import { UserProfile } from '../types.ts';
import { PWAInstallButton } from './PWAInstallButton.tsx';

interface LoginProps {
  onLoginSuccess: (user: UserProfile) => void;
}

export const Login: React.FC<LoginProps> = ({ onLoginSuccess }) => {
  const [identifier, setIdentifier] = useState('');
  const [password, setPassword] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!identifier || !password) return;

    setIsSubmitting(true);
    setError(null);

    try {
      const res = await fetch('/api/auth/login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ identifier, password }),
      });

      const data = await res.json();
      if (!res.ok) {
        throw new Error(data.error || 'Authentication failed.');
      }

      onLoginSuccess(data.user);
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : String(err);
      setError(msg);
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="min-h-[100dvh] flex flex-col items-center justify-center p-4 bg-[#0c0c0e] text-white select-none">
      <div className="w-full max-w-sm rounded-[36px] smart-card p-7 sm:p-8 space-y-6">
        {/* Brand Header */}
        <div className="flex flex-col items-center text-center space-y-3">
          <div className="w-14 h-14 rounded-full bg-white text-black flex items-center justify-center shadow-lg">
            <QrCode className="w-7 h-7 text-neutral-950" />
          </div>
          <div>
            <h1 className="text-2xl font-normal tracking-tight text-white font-sans">
              Eman QR
            </h1>
            <p className="text-xs text-neutral-400 mt-0.5">
              Eman Bakeries &bull; Authorized Staff
            </p>
          </div>
        </div>

        {error && (
          <div className="p-3.5 rounded-2xl bg-red-950/60 border border-red-800/80 text-xs text-red-300 flex items-center gap-2.5">
            <AlertCircle className="w-4 h-4 shrink-0 text-red-400" />
            <span>{error}</span>
          </div>
        )}

        <form onSubmit={handleSubmit} className="space-y-4 text-xs">
          <div>
            <label className="text-[11px] font-medium text-neutral-300 block mb-1.5">
              Username or Email:
            </label>
            <input
              type="text"
              required
              autoCapitalize="none"
              autoComplete="username"
              placeholder="e.g. employee or admin"
              value={identifier}
              onChange={e => setIdentifier(e.target.value)}
              className="w-full p-3.5 rounded-2xl border border-neutral-800 bg-black/60 text-white focus:outline-none focus:border-neutral-600 text-xs"
            />
          </div>

          <div>
            <label className="text-[11px] font-medium text-neutral-300 block mb-1.5">
              Password:
            </label>
            <input
              type="password"
              required
              autoComplete="current-password"
              placeholder="••••••••••••"
              value={password}
              onChange={e => setPassword(e.target.value)}
              className="w-full p-3.5 rounded-2xl border border-neutral-800 bg-black/60 text-white focus:outline-none focus:border-neutral-600 text-xs"
            />
          </div>

          <button
            type="submit"
            disabled={isSubmitting || !identifier || !password}
            className="w-full py-3.5 rounded-2xl bg-white hover:bg-neutral-100 text-neutral-950 font-semibold text-xs transition shadow-lg flex items-center justify-center gap-2 disabled:opacity-50 active:scale-98 cursor-pointer"
          >
            {isSubmitting ? (
              <>
                <RefreshCw className="w-4 h-4 animate-spin text-neutral-950" />
                <span>Signing In...</span>
              </>
            ) : (
              <>
                <LogIn className="w-4 h-4 text-neutral-950" />
                <span>Sign In to Scanner</span>
              </>
            )}
          </button>
        </form>

        <div className="pt-2 border-t border-neutral-800 text-center space-y-2.5">
          <p className="text-[11px] text-neutral-500">
            Internal access strictly for authorized bakery staff.
          </p>
          <div className="flex justify-center">
            <PWAInstallButton compact />
          </div>
        </div>
      </div>
    </div>
  );
};
