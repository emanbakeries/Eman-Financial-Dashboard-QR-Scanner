import React, { useState, useEffect } from 'react';
import { UserProfile, ScannerConfigStatus, SendResult } from './types.ts';
import { useTheme } from './hooks/useTheme.ts';
import { useOnlineStatus } from './hooks/useOnlineStatus.ts';
import { Navbar } from './components/Navbar.tsx';
import { ScannerHome } from './components/ScannerHome.tsx';
import { CameraModal } from './components/CameraModal.tsx';
import { ResultModal } from './components/ResultModal.tsx';
import { AccountModal } from './components/AccountModal.tsx';
import { AdminSettings } from './components/AdminSettings.tsx';
import { InitialSetup } from './components/InitialSetup.tsx';
import { Login } from './components/Login.tsx';
import { WifiOff, RefreshCw } from 'lucide-react';

export default function App() {
  const { theme, setTheme } = useTheme();
  const isOnline = useOnlineStatus();

  const [isSystemInitialized, setIsSystemInitialized] = useState<boolean | null>(null);
  const [currentUser, setCurrentUser] = useState<UserProfile | null>(null);
  const [configStatus, setConfigStatus] = useState<ScannerConfigStatus | null>(null);
  const [isAppLoading, setIsAppLoading] = useState(true);

  // Modals state
  const [isCameraOpen, setIsCameraOpen] = useState(false);
  const [scannedPayload, setScannedPayload] = useState<string | null>(null);
  const [isAccountOpen, setIsAccountOpen] = useState(false);
  const [isAdminOpen, setIsAdminOpen] = useState(false);
  const [adminDefaultTab, setAdminDefaultTab] = useState<'connection' | 'users' | 'audit'>('connection');

  // Initialize App & check auth
  const checkStatusAndAuth = async () => {
    setIsAppLoading(true);
    try {
      const statusRes = await fetch('/api/system/status');
      const statusData = await statusRes.json();
      setIsSystemInitialized(statusData.initialized);

      if (statusData.initialized) {
        const meRes = await fetch('/api/auth/me');
        if (meRes.ok) {
          const userData = await meRes.json();
          setCurrentUser(userData);
          fetchScannerStatus();
        } else {
          setCurrentUser(null);
        }
      }
    } catch (e) {
      console.error('Initialization error:', e);
    } finally {
      setIsAppLoading(false);
    }
  };

  const fetchScannerStatus = async () => {
    try {
      const res = await fetch('/api/scanner/config-status');
      if (res.ok) {
        const data = await res.json();
        setConfigStatus(data);
      }
    } catch {
      // ignore
    }
  };

  useEffect(() => {
    checkStatusAndAuth();
  }, []);

  const handleLogout = async () => {
    try {
      await fetch('/api/auth/logout', { method: 'POST' });
    } catch {
      // ignore
    }
    setCurrentUser(null);
    setIsAccountOpen(false);
    setIsAdminOpen(false);
    setIsCameraOpen(false);
    setScannedPayload(null);
  };

  // QR Scan callback: receives exact untouched raw string
  const handleScanSuccess = (rawPayload: string) => {
    setIsCameraOpen(false);
    setScannedPayload(rawPayload);
  };

  // Outgoing send handler: passes raw payload untouched to backend
  const handleSendPayload = async (idempotencyKey: string): Promise<SendResult> => {
    if (!scannedPayload) {
      return { success: false, error: 'No payload captured.' };
    }

    try {
      const res = await fetch('/api/scanner/send', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          // STRICT PRESERVATION: untouched raw payload
          qrPayload: scannedPayload,
          idempotencyKey,
        }),
      });

      const data = await res.json();

      if (res.ok && data.success) {
        return {
          success: true,
          statusCode: data.statusCode,
          message: data.message,
          timestamp: data.timestamp,
        };
      } else {
        return {
          success: false,
          statusCode: res.status,
          error: data.error || 'Destination rejected request.',
          timeout: !!data.timeout,
          responseExcerpt: data.responseExcerpt,
        };
      }
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : String(err);
      return {
        success: false,
        error: `Network failure connecting to backend: ${message}`,
      };
    }
  };

  // Loading Screen
  if (isAppLoading) {
    return (
      <div className="min-h-[100dvh] flex flex-col items-center justify-center p-4 bg-[#0c0c0e] text-neutral-400">
        <RefreshCw className="w-8 h-8 text-[#c7aa86] animate-spin" />
        <span className="mt-3 text-xs font-medium">Starting Eman QR...</span>
      </div>
    );
  }

  // 1. Initial Setup Flow (Never initialized yet)
  if (isSystemInitialized === false) {
    return (
      <InitialSetup
        onSetupComplete={user => {
          setIsSystemInitialized(true);
          setCurrentUser(user);
          fetchScannerStatus();
        }}
      />
    );
  }

  // 2. Authentication Flow
  if (!currentUser) {
    return (
      <Login
        onLoginSuccess={user => {
          setCurrentUser(user);
          fetchScannerStatus();
        }}
      />
    );
  }

  // 3. Main Authenticated Application matching the smart device design
  return (
    <div className="flex flex-col min-h-[100dvh] bg-[#0c0c0e] text-white select-none transition-colors">
      {/* Offline Alert Bar */}
      {!isOnline && (
        <div className="w-full bg-amber-600 text-white text-xs font-semibold py-1.5 px-4 text-center flex items-center justify-center gap-2 shadow-sm z-40">
          <WifiOff className="w-3.5 h-3.5 animate-pulse" />
          <span>Offline Mode &bull; Network connection required to dispatch invoices.</span>
        </div>
      )}

      {/* Navigation Header matching top bar in reference image */}
      <Navbar
        user={currentUser}
        configStatus={configStatus}
        isOnline={isOnline}
        theme={theme}
        onThemeChange={setTheme}
        onOpenAccount={() => setIsAccountOpen(true)}
        onOpenAdmin={() => {
          setAdminDefaultTab('connection');
          setIsAdminOpen(true);
        }}
      />

      {/* Clean Luxury Scanner Home Screen */}
      <ScannerHome
        user={currentUser}
        configStatus={configStatus}
        isOnline={isOnline}
        onStartScan={() => setIsCameraOpen(true)}
        onOpenAdmin={() => {
          setAdminDefaultTab('connection');
          setIsAdminOpen(true);
        }}
        onOpenAccount={() => setIsAccountOpen(true)}
        onOpenHistory={() => {
          if (currentUser.role === 'admin') {
            setAdminDefaultTab('audit');
            setIsAdminOpen(true);
          } else {
            setIsAccountOpen(true);
          }
        }}
      />

      {/* Live Camera Scanner Overlay */}
      {isCameraOpen && (
        <CameraModal
          onScanSuccess={handleScanSuccess}
          onClose={() => setIsCameraOpen(false)}
        />
      )}

      {/* Captured Result & Send Bottom Sheet / Modal */}
      {scannedPayload && (
        <ResultModal
          rawPayload={scannedPayload}
          onSend={handleSendPayload}
          onScanAgain={() => {
            setScannedPayload(null);
            setIsCameraOpen(true);
          }}
          onClose={() => setScannedPayload(null)}
        />
      )}

      {/* Account / User Settings Modal */}
      {isAccountOpen && (
        <AccountModal
          user={currentUser}
          theme={theme}
          onThemeChange={setTheme}
          onLogout={handleLogout}
          onClose={() => setIsAccountOpen(false)}
        />
      )}

      {/* Admin Settings Area */}
      {isAdminOpen && currentUser.role === 'admin' && (
        <AdminSettings
          currentUserId={currentUser.id}
          defaultTab={adminDefaultTab}
          onClose={() => setIsAdminOpen(false)}
          onConfigUpdated={() => fetchScannerStatus()}
        />
      )}
    </div>
  );
}
