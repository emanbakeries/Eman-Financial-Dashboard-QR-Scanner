import React, { useState } from 'react';
import { ShieldCheck, Lock, AlertCircle, RefreshCw } from 'lucide-react';
import { UserProfile } from '../types.ts';

interface InitialSetupProps {
  onSetupComplete: (user: UserProfile) => void;
}

export const InitialSetup: React.FC<InitialSetupProps> = ({ onSetupComplete }) => {
  const [name, setName] = useState('Eman Bakery Admin');
  const [username, setUsername] = useState('admin');
  const [email, setEmail] = useState('emanbakeries.official@gmail.com');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (password.length < 8) {
      setError('Password must be at least 8 characters long.');
      return;
    }
    if (password !== confirmPassword) {
      setError('Passwords do not match.');
      return;
    }

    setIsSubmitting(true);
    setError(null);

    try {
      const res = await fetch('/api/auth/setup-owner', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name, username, email, password }),
      });

      const data = await res.json();
      if (!res.ok) {
        throw new Error(data.error || 'Setup failed.');
      }

      onSetupComplete(data.user);
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : String(err);
      setError(msg);
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="min-h-[100dvh] flex items-center justify-center p-4 bg-[#0c0c0e] text-white select-none">
      <div className="w-full max-w-md rounded-[36px] smart-card p-7 sm:p-8 space-y-6">
        {/* Header */}
        <div className="flex flex-col items-center text-center space-y-3">
          <div className="w-14 h-14 rounded-full bg-white text-black flex items-center justify-center shadow-lg">
            <ShieldCheck className="w-7 h-7 text-neutral-950" />
          </div>
          <div>
            <h1 className="text-2xl font-normal tracking-tight text-white font-sans">
              System Initialization
            </h1>
            <p className="text-xs text-neutral-400 mt-1 max-w-xs leading-relaxed">
              Eman Bakeries &bull; Primary Administrator Provisioning
            </p>
          </div>
        </div>

        {/* Warning pill */}
        <div className="p-3.5 rounded-2xl bg-black/40 border border-neutral-800 text-[11px] text-neutral-300 flex items-start gap-2.5">
          <Lock className="w-4 h-4 text-[#c7aa86] mt-0.5 shrink-0" />
          <span>
            <strong>Permanent Lock:</strong> Once provisioned, arbitrary subsequent visitors are permanently blocked from claiming admin rights.
          </span>
        </div>

        {error && (
          <div className="p-3.5 rounded-2xl bg-red-950/60 border border-red-800/80 text-xs text-red-300 flex items-center gap-2">
            <AlertCircle className="w-4 h-4 shrink-0" />
            <span>{error}</span>
          </div>
        )}

        <form onSubmit={handleSubmit} className="space-y-3.5 text-xs">
          <div>
            <label className="text-[11px] font-medium text-neutral-300 block mb-1">
              Administrator Name:
            </label>
            <input
              type="text"
              required
              value={name}
              onChange={e => setName(e.target.value)}
              className="w-full p-3 rounded-2xl border border-neutral-800 bg-black/60 text-white focus:outline-none focus:border-neutral-600"
            />
          </div>

          <div>
            <label className="text-[11px] font-medium text-neutral-300 block mb-1">
              Admin Username:
            </label>
            <input
              type="text"
              required
              value={username}
              onChange={e => setUsername(e.target.value)}
              className="w-full p-3 rounded-2xl border border-neutral-800 bg-black/60 text-white font-mono focus:outline-none focus:border-neutral-600"
            />
          </div>

          <div>
            <label className="text-[11px] font-medium text-neutral-300 block mb-1">
              Recovery Email:
            </label>
            <input
              type="email"
              required
              value={email}
              onChange={e => setEmail(e.target.value)}
              className="w-full p-3 rounded-2xl border border-neutral-800 bg-black/60 text-white focus:outline-none focus:border-neutral-600"
            />
          </div>

          <div>
            <label className="text-[11px] font-medium text-neutral-300 block mb-1">
              Master Password (min 8 characters):
            </label>
            <input
              type="password"
              required
              value={password}
              onChange={e => setPassword(e.target.value)}
              placeholder="••••••••••••"
              className="w-full p-3 rounded-2xl border border-neutral-800 bg-black/60 text-white focus:outline-none focus:border-neutral-600"
            />
          </div>

          <div>
            <label className="text-[11px] font-medium text-neutral-300 block mb-1">
              Confirm Master Password:
            </label>
            <input
              type="password"
              required
              value={confirmPassword}
              onChange={e => setConfirmPassword(e.target.value)}
              placeholder="••••••••••••"
              className="w-full p-3 rounded-2xl border border-neutral-800 bg-black/60 text-white focus:outline-none focus:border-neutral-600"
            />
          </div>

          <button
            type="submit"
            disabled={isSubmitting}
            className="w-full py-3.5 rounded-2xl bg-white hover:bg-neutral-100 text-neutral-950 font-semibold text-xs transition shadow-lg flex items-center justify-center gap-2 disabled:opacity-50 active:scale-98 cursor-pointer mt-2"
          >
            {isSubmitting ? (
              <>
                <RefreshCw className="w-4 h-4 animate-spin text-neutral-950" />
                <span>Securing System...</span>
              </>
            ) : (
              <span>Create Primary Admin &amp; Initialize</span>
            )}
          </button>
        </form>
      </div>
    </div>
  );
};
