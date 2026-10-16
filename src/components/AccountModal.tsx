import React, { useState } from 'react';
import { UserProfile } from '../types.ts';
import { ThemePreference } from '../hooks/useTheme.ts';
import { PWAInstallButton } from './PWAInstallButton.tsx';
import {
  X,
  User,
  KeyRound,
  Shield,
  Moon,
  Sun,
  Monitor,
  LogOut,
  CheckCircle,
  AlertCircle,
  RefreshCw,
  Sliders,
} from 'lucide-react';

interface AccountModalProps {
  user: UserProfile;
  theme: ThemePreference;
  onThemeChange: (theme: ThemePreference) => void;
  onLogout: () => void;
  onClose: () => void;
}

export const AccountModal: React.FC<AccountModalProps> = ({
  user,
  theme,
  onThemeChange,
  onLogout,
  onClose,
}) => {
  const [currentPassword, setCurrentPassword] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [isUpdatingPassword, setIsUpdatingPassword] = useState(false);
  const [passwordSuccess, setPasswordSuccess] = useState<string | null>(null);
  const [passwordError, setPasswordError] = useState<string | null>(null);

  const handleUpdatePassword = async (e: React.FormEvent) => {
    e.preventDefault();
    if (newPassword.length < 8) {
      setPasswordError('New password must be at least 8 characters.');
      return;
    }
    if (newPassword !== confirmPassword) {
      setPasswordError('New passwords do not match.');
      return;
    }

    setIsUpdatingPassword(true);
    setPasswordSuccess(null);
    setPasswordError(null);

    try {
      const res = await fetch('/api/auth/change-password', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ currentPassword, newPassword }),
      });
      const data = await res.json();
      if (!res.ok) {
        throw new Error(data.error || 'Failed to update password.');
      }
      setPasswordSuccess('Password changed successfully.');
      setCurrentPassword('');
      setNewPassword('');
      setConfirmPassword('');
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : String(err);
      setPasswordError(message);
    } finally {
      setIsUpdatingPassword(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center bg-black/80 backdrop-blur-md p-0 sm:p-4 animate-in fade-in duration-150 select-none">
      <div
        className="w-full sm:max-w-md max-h-[90dvh] flex flex-col rounded-t-[36px] sm:rounded-[36px] bg-[#1a1a1d] border border-neutral-700/80 shadow-2xl overflow-hidden animate-in slide-in-from-bottom duration-200"
        role="dialog"
        aria-modal="true"
      >
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-5 border-b border-neutral-800 shrink-0">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-full bg-white text-black flex items-center justify-center shadow-md">
              <User className="w-5 h-5 text-neutral-950" />
            </div>
            <div>
              <h2 className="text-base font-semibold text-white">Employee Profile</h2>
              <span className="text-xs text-neutral-400">Eman Bakeries Staff Account</span>
            </div>
          </div>
          <button
            onClick={onClose}
            aria-label="Close"
            className="w-9 h-9 rounded-full bg-neutral-800/80 hover:bg-neutral-700 text-neutral-400 hover:text-white flex items-center justify-center transition"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Body */}
        <div className="flex-1 overflow-y-auto px-6 py-5 space-y-6 custom-scrollbar text-xs">
          {/* User Profile Card */}
          <div className="smart-card p-4 rounded-[24px] space-y-3.5">
            <div className="flex items-center justify-between">
              <div>
                <span className="font-semibold text-white text-base block">
                  {user.name}
                </span>
                <span className="text-neutral-400 text-xs">
                  @{user.username} &bull; {user.email}
                </span>
              </div>
              <span
                className={`px-2.5 py-1 rounded-full text-[10px] font-semibold uppercase tracking-wider ${
                  user.role === 'admin'
                    ? 'bg-[#c7aa86] text-neutral-950'
                    : 'bg-neutral-700 text-neutral-200'
                }`}
              >
                {user.role}
              </span>
            </div>

            <div className="grid grid-cols-2 gap-2 pt-2 border-t border-neutral-700/60 text-[11px]">
              <div>
                <span className="text-neutral-400 block">External User ID:</span>
                <span className="font-mono text-neutral-200 font-medium">
                  {user.externalUserId || 'None assigned'}
                </span>
              </div>
              <div>
                <span className="text-neutral-400 block">API Credentials:</span>
                <span
                  className={`font-semibold ${
                    user.hasCredentials ? 'text-emerald-400' : 'text-[#c7aa86]'
                  }`}
                >
                  {user.hasCredentials ? 'Configured' : 'Pending Admin Assignment'}
                </span>
              </div>
            </div>
          </div>

          {/* Change Password */}
          <form onSubmit={handleUpdatePassword} className="space-y-3 pt-2">
            <div className="flex items-center gap-2 font-semibold text-white text-sm">
              <KeyRound className="w-4 h-4 text-[#c7aa86]" />
              <span>Security &amp; Password</span>
            </div>

            {passwordSuccess && (
              <div className="p-3 rounded-2xl bg-emerald-950/50 text-emerald-300 border border-emerald-800/60 flex items-center gap-2">
                <CheckCircle className="w-4 h-4 shrink-0 text-emerald-400" />
                <span>{passwordSuccess}</span>
              </div>
            )}

            {passwordError && (
              <div className="p-3 rounded-2xl bg-red-950/50 text-red-300 border border-red-800/60 flex items-center gap-2">
                <AlertCircle className="w-4 h-4 shrink-0 text-red-400" />
                <span>{passwordError}</span>
              </div>
            )}

            <input
              type="password"
              placeholder="Current Password"
              value={currentPassword}
              onChange={e => setCurrentPassword(e.target.value)}
              className="w-full p-3 rounded-2xl border border-neutral-800 bg-black/60 text-white focus:outline-none focus:border-neutral-600"
            />
            <input
              type="password"
              placeholder="New Password (min 8 chars)"
              value={newPassword}
              onChange={e => setNewPassword(e.target.value)}
              className="w-full p-3 rounded-2xl border border-neutral-800 bg-black/60 text-white focus:outline-none focus:border-neutral-600"
            />
            <input
              type="password"
              placeholder="Confirm New Password"
              value={confirmPassword}
              onChange={e => setConfirmPassword(e.target.value)}
              className="w-full p-3 rounded-2xl border border-neutral-800 bg-black/60 text-white focus:outline-none focus:border-neutral-600"
            />

            <button
              type="submit"
              disabled={isUpdatingPassword || !currentPassword || !newPassword}
              className="w-full py-3 px-4 rounded-2xl bg-[#2a2a2e] border border-neutral-700 hover:bg-[#34343a] text-white font-semibold transition disabled:opacity-50 flex items-center justify-center gap-2 active:scale-98"
            >
              {isUpdatingPassword ? (
                <>
                  <RefreshCw className="w-3.5 h-3.5 animate-spin" />
                  <span>Updating...</span>
                </>
              ) : (
                'Update Password'
              )}
            </button>
          </form>

          {/* PWA Section */}
          <div className="pt-3 border-t border-neutral-800 flex items-center justify-between">
            <span className="text-neutral-400">Install PWA on Device:</span>
            <PWAInstallButton />
          </div>
        </div>

        {/* Footer Logout */}
        <div className="p-5 border-t border-neutral-800 bg-[#161618] flex justify-end">
          <button
            onClick={onLogout}
            className="flex items-center gap-2 py-2.5 px-4 rounded-xl text-red-400 hover:text-red-300 hover:bg-red-950/40 font-semibold transition text-xs active:scale-98"
          >
            <LogOut className="w-4 h-4" />
            <span>Sign Out</span>
          </button>
        </div>
      </div>
    </div>
  );
};
