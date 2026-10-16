import React, { useState } from 'react';
import {
  Camera,
  QrCode,
  Wifi,
  WifiOff,
  CheckCircle2,
  AlertTriangle,
  Radio,
  Key,
  Shield,
  Layers,
  Sparkles,
  ChevronRight,
  Sliders,
  History,
  Lock,
  Unlock,
  Zap,
} from 'lucide-react';
import { UserProfile, ScannerConfigStatus } from '../types.ts';

interface ScannerHomeProps {
  user: UserProfile;
  configStatus: ScannerConfigStatus | null;
  isOnline: boolean;
  onStartScan: () => void;
  onOpenAdmin: () => void;
  onOpenAccount: () => void;
  onOpenHistory: () => void;
}

export const ScannerHome: React.FC<ScannerHomeProps> = ({
  user,
  configStatus,
  isOnline,
  onStartScan,
  onOpenAdmin,
  onOpenAccount,
  onOpenHistory,
}) => {
  const [isSliderHovered, setIsSliderHovered] = useState(false);
  const [isTestingProbe, setIsTestingProbe] = useState(false);
  const [probeNotice, setProbeNotice] = useState<string | null>(null);

  const isEndpointConfigured = configStatus?.isEndpointConfigured ?? false;
  const isAuthSatisfied = configStatus?.isAuthSatisfied ?? false;

  const handleQuickProbe = async () => {
    setIsTestingProbe(true);
    setProbeNotice(null);
    try {
      const res = await fetch('/api/admin/connection/test', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({}),
      });
      const data = await res.json();
      if (data.success) {
        setProbeNotice(`Online: HTTP ${data.statusCode} (${data.latencyMs}ms)`);
      } else {
        setProbeNotice(`Probe failed: ${data.error || 'Endpoint unreachable'}`);
      }
    } catch {
      setProbeNotice('Could not connect to server');
    } finally {
      setIsTestingProbe(false);
      setTimeout(() => setProbeNotice(null), 4000);
    }
  };

  return (
    <div className="w-full flex-1 flex flex-col justify-between max-w-sm sm:max-w-md mx-auto px-4 py-2 sm:py-4 select-none">
      {/* 1. Large Title Area matching reference image */}
      <div className="pt-2 pb-4">
        <h1 className="text-3xl sm:text-4xl font-normal tracking-tight text-white font-sans">
          Eman Bakeries
        </h1>
        <div className="flex items-center gap-2 mt-1">
          <span className="text-xs text-neutral-400 font-medium">
            ZATCA Invoice Scanner &bull; {user.name}
          </span>
          {isEndpointConfigured && (
            <span className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded-full bg-emerald-950/80 border border-emerald-500/40 text-[10px] text-emerald-400 font-mono">
              <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse" />
              Connected
            </span>
          )}
        </div>
      </div>

      {/* 2. Main Hero Card (Matching the large smart lock card in the reference image) */}
      <div className="smart-card rounded-[32px] p-6 sm:p-7 relative overflow-hidden flex flex-col justify-between min-h-[340px] sm:min-h-[380px]">
        {/* Subtle radial lighting gradient */}
        <div className="absolute top-0 right-0 w-64 h-64 bg-radial from-sky-500/10 via-transparent to-transparent pointer-events-none" />

        {/* Content Top: Stats on Left + 3D Scanner Hardware Artwork on Right */}
        <div className="flex items-start justify-between relative z-10">
          {/* Left Side Status Indicators */}
          <div className="space-y-6 pt-1">
            {/* Stat 1: Connection & Readiness */}
            <div>
              <div className="text-3xl sm:text-4xl font-normal text-white tracking-tight">
                {isEndpointConfigured ? 'Ready' : 'Setup'}
              </div>
              <div className="flex items-center gap-1.5 mt-1 text-xs text-neutral-400 font-medium">
                {isOnline ? (
                  <Wifi className="w-3.5 h-3.5 text-neutral-400" />
                ) : (
                  <WifiOff className="w-3.5 h-3.5 text-amber-500" />
                )}
                <span>{isEndpointConfigured ? 'destination api' : 'endpoint needed'}</span>
              </div>
            </div>

            {/* Stat 2: ZATCA Protocol Support */}
            <div>
              <div className="text-3xl sm:text-4xl font-normal text-white tracking-tight">
                ZATCA
              </div>
              <div className="flex items-center gap-1.5 mt-1 text-xs text-neutral-400 font-medium">
                <Shield className="w-3.5 h-3.5 text-neutral-400" />
                <span>Phase 1 &amp; Phase 2</span>
              </div>
            </div>
          </div>

          {/* Right Side: Realistic Sleek Smart-Hardware Graphic matching the black lock aesthetic */}
          <div className="relative w-32 h-52 sm:w-36 sm:h-56 flex items-center justify-center">
            {/* Device Body Chassis */}
            <div className="relative w-24 h-48 sm:w-26 sm:h-52 rounded-[28px] bg-linear-to-b from-[#1c1c1f] via-[#121214] to-[#0a0a0b] border border-neutral-700/60 shadow-[0_15px_30px_rgba(0,0,0,0.8),inset_0_1px_1px_rgba(255,255,255,0.15)] flex flex-col items-center justify-between p-3.5">
              {/* Top status indicator & camera aperture */}
              <div className="w-12 h-12 rounded-2xl bg-black border border-neutral-700/80 shadow-inner flex items-center justify-center relative overflow-hidden group">
                <div className="w-7 h-7 rounded-full bg-linear-to-br from-neutral-800 to-black border border-sky-500/40 flex items-center justify-center">
                  <div className="w-2.5 h-2.5 rounded-full bg-sky-400 animate-pulse shadow-[0_0_8px_#38bdf8]" />
                </div>
                {/* Laser crosshair guides */}
                <div className="absolute inset-0 border-t border-sky-500/20 top-1/2" />
                <div className="absolute inset-0 border-l border-sky-500/20 left-1/2" />
              </div>

              {/* QR Finder Grid simulation on the chassis */}
              <div className="grid grid-cols-3 gap-1.5 p-2 rounded-xl bg-black/40 border border-neutral-800/80">
                {[1, 2, 3, 4, 5, 6, 7, 8, 9].map(i => (
                  <div
                    key={i}
                    className="w-2 h-2 rounded-xs bg-neutral-700/70 flex items-center justify-center"
                  >
                    {i === 5 && <div className="w-1 h-1 rounded-full bg-sky-400" />}
                  </div>
                ))}
              </div>

              {/* Physical trigger handle / optical sensor ring */}
              <div className="w-12 h-6 rounded-full bg-linear-to-b from-neutral-700 to-neutral-900 border border-neutral-600/50 shadow-md flex items-center justify-center">
                <div className="w-6 h-1.5 rounded-full bg-neutral-950" />
              </div>
            </div>

            {/* Glowing optic backdrop */}
            <div className="absolute top-6 w-16 h-16 rounded-full bg-sky-500/10 blur-xl pointer-events-none" />
          </div>
        </div>

        {/* Bottom Interactive Slide / Tap Action Pill matching the reference image */}
        <div className="relative z-10 pt-4">
          <button
            onClick={onStartScan}
            onMouseEnter={() => setIsSliderHovered(true)}
            onMouseLeave={() => setIsSliderHovered(false)}
            aria-label="Activate camera scanner"
            className="w-full tactile-pill rounded-full p-1.5 flex items-center justify-between group active:scale-[0.99] transition duration-200 cursor-pointer"
          >
            {/* Left Circular White Thumb with icon */}
            <div className="w-12 h-12 rounded-full bg-white text-black flex items-center justify-center shadow-lg transition-transform duration-300 group-hover:scale-105 group-active:scale-95">
              <Camera className="w-5 h-5 text-neutral-900" />
            </div>

            {/* Chevrons & prompt */}
            <div className="flex items-center gap-1.5 text-neutral-400 text-xs font-medium tracking-wide">
              <span>Scan Invoice QR</span>
              <div className="flex items-center text-neutral-500 group-hover:text-white transition">
                <ChevronRight className="w-4 h-4 -mr-2" />
                <ChevronRight className="w-4 h-4 -mr-2" />
                <ChevronRight className="w-4 h-4" />
              </div>
            </div>

            {/* Right Circular Inactive icon */}
            <div className="w-12 h-12 rounded-full bg-neutral-800/80 text-neutral-400 flex items-center justify-center border border-neutral-700/40">
              <QrCode className="w-5 h-5" />
            </div>
          </button>
        </div>
      </div>

      {/* 3. Action Tiles below Hero Card (Matching the exact 2-column tiles in the image) */}
      <div className="grid grid-cols-2 gap-3.5 my-3.5">
        {/* Left Tile: Warm camel / sand leather accent tile */}
        <button
          onClick={onStartScan}
          className="camel-tile rounded-[26px] p-4 flex items-center gap-3 active:scale-[0.97] transition text-left cursor-pointer group"
        >
          {/* Circular white thumb */}
          <div className="w-11 h-11 rounded-full bg-white text-neutral-900 flex items-center justify-center shadow-md shrink-0">
            <Camera className="w-5 h-5" />
          </div>

          <div className="min-w-0">
            <span className="text-sm font-semibold text-neutral-900 block leading-tight">
              Scan
            </span>
            <span className="text-sm font-semibold text-neutral-900 block leading-tight">
              Invoice
            </span>
          </div>
        </button>

        {/* Right Tile: Dark charcoal / graphite tile */}
        <button
          onClick={handleQuickProbe}
          disabled={isTestingProbe}
          className="charcoal-tile rounded-[26px] p-4 flex items-center gap-3 active:scale-[0.97] transition text-left cursor-pointer group disabled:opacity-60"
        >
          {/* Circular dark thumb */}
          <div className="w-11 h-11 rounded-full bg-[#2a2a2e] border border-neutral-700 text-white flex items-center justify-center shadow-md shrink-0">
            <Radio
              className={`w-5 h-5 text-neutral-300 ${isTestingProbe ? 'animate-spin text-sky-400' : ''}`}
            />
          </div>

          <div className="min-w-0">
            <span className="text-sm font-semibold text-white block leading-tight">
              Test
            </span>
            <span className="text-sm font-semibold text-white block leading-tight">
              API
            </span>
          </div>
        </button>
      </div>

      {/* Feedback banner if probe clicked */}
      {probeNotice && (
        <div className="p-2.5 rounded-xl bg-neutral-900 border border-neutral-800 text-center text-xs text-neutral-300 animate-in fade-in duration-150">
          {probeNotice}
        </div>
      )}

      {/* 4. Bottom Floating Dock (Matching the blurred acrylic floating dock in the image) */}
      <div className="pt-2 pb-1">
        <nav
          aria-label="Navigation Dock"
          className="glass-dock rounded-full p-1.5 px-3 flex items-center justify-between max-w-xs mx-auto"
        >
          {/* Tab 1: Home (Active White Circular Pill) */}
          <button
            onClick={() => {}}
            aria-label="Home"
            className="w-11 h-11 rounded-full bg-white text-neutral-950 flex items-center justify-center shadow-md active:scale-95 transition"
          >
            <svg
              className="w-5 h-5 stroke-[2.2]"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
            >
              <path d="M3 10a2 2 0 0 1 .709-1.528l7-5.999a2 2 0 0 1 2.582 0l7 5.999A2 2 0 0 1 21 10v9a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z" />
            </svg>
          </button>

          {/* Tab 2: Recent History / Scan Logs */}
          <button
            onClick={onOpenHistory}
            aria-label="Scan History"
            title="Recent Invoices"
            className="w-10 h-10 rounded-full text-neutral-400 hover:text-white hover:bg-white/10 flex items-center justify-center transition active:scale-95"
          >
            <History className="w-5 h-5" />
          </button>

          {/* Tab 3: Camera Trigger */}
          <button
            onClick={onStartScan}
            aria-label="Camera Scan"
            title="Scan Invoice"
            className="w-10 h-10 rounded-full text-neutral-400 hover:text-white hover:bg-white/10 flex items-center justify-center transition active:scale-95"
          >
            <QrCode className="w-5 h-5" />
          </button>

          {/* Tab 4: Employee Credentials */}
          <button
            onClick={onOpenAccount}
            aria-label="User Account"
            title="Employee Profile"
            className="w-10 h-10 rounded-full text-neutral-400 hover:text-white hover:bg-white/10 flex items-center justify-center transition active:scale-95"
          >
            <Key className="w-5 h-5" />
          </button>

          {/* Tab 5: Admin / Settings */}
          {user.role === 'admin' ? (
            <button
              onClick={onOpenAdmin}
              aria-label="Admin Settings"
              title="Admin Controls"
              className="w-10 h-10 rounded-full text-neutral-400 hover:text-white hover:bg-white/10 flex items-center justify-center transition active:scale-95"
            >
              <Sliders className="w-5 h-5" />
            </button>
          ) : (
            <button
              onClick={onOpenAccount}
              aria-label="Settings"
              title="Settings"
              className="w-10 h-10 rounded-full text-neutral-400 hover:text-white hover:bg-white/10 flex items-center justify-center transition active:scale-95"
            >
              <Sliders className="w-5 h-5" />
            </button>
          )}
        </nav>
      </div>
    </div>
  );
};
