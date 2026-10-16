import React, { useState } from 'react';
import { UserProfile, ScannerConfigStatus } from '../types.ts';
import { ThemePreference } from '../hooks/useTheme.ts';
import { PWAInstallButton } from './PWAInstallButton.tsx';
import {
  Settings,
  Grid,
  X,
  Shield,
  Wifi,
  WifiOff,
  Sun,
  Moon,
  Monitor,
  Info,
  CheckCircle2,
} from 'lucide-react';

interface NavbarProps {
  user: UserProfile;
  configStatus: ScannerConfigStatus | null;
  isOnline: boolean;
  theme: ThemePreference;
  onThemeChange: (theme: ThemePreference) => void;
  onOpenAccount: () => void;
  onOpenAdmin: () => void;
}

export const Navbar: React.FC<NavbarProps> = ({
  user,
  configStatus,
  isOnline,
  theme,
  onThemeChange,
  onOpenAccount,
  onOpenAdmin,
}) => {
  const [showDrawer, setShowDrawer] = useState(false);

  return (
    <>
      {/* Top Header matching reference image */}
      <header className="w-full max-w-sm sm:max-w-md mx-auto px-4 pt-3 pb-1 flex items-center justify-between select-none">
        {/* Left circular frosted button with 6-dot matrix (::) */}
        <button
          onClick={() => setShowDrawer(true)}
          aria-label="System Info and Menu"
          className="w-12 h-12 rounded-full bg-[#1c1c1f]/90 hover:bg-[#28282c] border border-neutral-700/60 flex items-center justify-center text-neutral-300 shadow-md active:scale-95 transition cursor-pointer"
        >
          {/* Exact 6-dot matrix pattern from image */}
          <div className="grid grid-cols-2 gap-1.5 p-1">
            <span className="w-1.5 h-1.5 rounded-full bg-neutral-300" />
            <span className="w-1.5 h-1.5 rounded-full bg-neutral-300" />
            <span className="w-1.5 h-1.5 rounded-full bg-neutral-300" />
            <span className="w-1.5 h-1.5 rounded-full bg-neutral-300" />
            <span className="w-1.5 h-1.5 rounded-full bg-neutral-300" />
            <span className="w-1.5 h-1.5 rounded-full bg-neutral-300" />
          </div>
        </button>

        {/* Center: Dynamic Island simulated camera pill for iOS bezel feel */}
        <div className="hidden xs:flex items-center justify-center">
          <div className="w-24 h-5 rounded-full bg-black/80 border border-neutral-800 flex items-center justify-end px-2">
            <div className="w-2.5 h-2.5 rounded-full bg-[#16161a] border border-neutral-700" />
          </div>
        </div>

        {/* Right: Crisp solid white circular button with settings gear icon */}
        <button
          onClick={() => (user.role === 'admin' ? onOpenAdmin() : onOpenAccount())}
          aria-label="Settings and Administration"
          className="w-12 h-12 rounded-full bg-white text-neutral-950 flex items-center justify-center shadow-[0_8px_20px_rgba(255,255,255,0.2)] active:scale-95 transition cursor-pointer group"
        >
          <Settings className="w-5 h-5 text-neutral-950 stroke-[2] transition-transform duration-300 group-hover:rotate-45" />
        </button>
      </header>

      {/* Info Drawer when 6-dot matrix icon tapped */}
      {showDrawer && (
        <div className="fixed inset-0 z-50 flex items-start justify-center bg-black/70 backdrop-blur-md p-4 animate-in fade-in duration-200">
          <div className="w-full max-w-sm rounded-[32px] bg-[#1a1a1d] border border-neutral-700/70 p-6 shadow-2xl space-y-5 animate-in slide-in-from-top duration-200">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2.5">
                <div className="w-8 h-8 rounded-full bg-white text-black flex items-center justify-center font-bold text-xs shadow-md">
                  EQ
                </div>
                <div>
                  <h3 className="text-sm font-semibold text-white">Eman Bakeries</h3>
                  <p className="text-[11px] text-neutral-400">ZATCA QR Mobile Scanner v1.0</p>
                </div>
              </div>
              <button
                onClick={() => setShowDrawer(false)}
                className="w-8 h-8 rounded-full bg-neutral-800 text-neutral-400 hover:text-white flex items-center justify-center transition"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <div className="space-y-2.5 text-xs">
              <div className="p-3 rounded-2xl bg-black/40 border border-neutral-800 flex items-center justify-between">
                <span className="text-neutral-400">Authenticated Staff:</span>
                <span className="font-semibold text-white">{user.name} ({user.role})</span>
              </div>

              <div className="p-3 rounded-2xl bg-black/40 border border-neutral-800 flex items-center justify-between">
                <span className="text-neutral-400">Network State:</span>
                <span className="flex items-center gap-1.5 font-medium text-emerald-400">
                  {isOnline ? (
                    <>
                      <span className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse" />
                      Connected
                    </>
                  ) : (
                    <span className="text-amber-400">Offline</span>
                  )}
                </span>
              </div>

              <div className="p-3 rounded-2xl bg-black/40 border border-neutral-800 flex items-center justify-between">
                <span className="text-neutral-400">API Destination:</span>
                <span className="font-mono text-neutral-300 truncate max-w-[140px]">
                  {configStatus?.endpointHost || 'Not Configured'}
                </span>
              </div>
            </div>

            <div className="pt-2 flex items-center justify-between">
              <PWAInstallButton />
              <button
                onClick={() => {
                  setShowDrawer(false);
                  onOpenAccount();
                }}
                className="text-xs text-sky-400 hover:underline font-medium"
              >
                My Account &rarr;
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
};
