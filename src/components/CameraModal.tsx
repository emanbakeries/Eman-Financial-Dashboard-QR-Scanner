import React, { useEffect, useRef, useState } from 'react';
import { Html5Qrcode, Html5QrcodeCameraScanConfig } from 'html5-qrcode';
import { X, Flashlight, Camera, AlertCircle, RefreshCw } from 'lucide-react';

interface CameraModalProps {
  onScanSuccess: (rawPayload: string) => void;
  onClose: () => void;
}

export const CameraModal: React.FC<CameraModalProps> = ({ onScanSuccess, onClose }) => {
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [isInitializing, setIsInitializing] = useState(true);
  const [hasTorch, setHasTorch] = useState(false);
  const [isTorchOn, setIsTorchOn] = useState(false);
  const [availableCameras, setAvailableCameras] = useState<Array<{ id: string; label: string }>>([]);
  const [currentCameraIndex, setCurrentCameraIndex] = useState<number>(0);

  const scannerRef = useRef<Html5Qrcode | null>(null);
  const isStoppedRef = useRef(false);
  const readerElementId = 'eman-qr-reader';

  const startCamera = async (cameraIdOrFacingMode: string | { facingMode: string }) => {
    setIsInitializing(true);
    setErrorMessage(null);

    try {
      if (scannerRef.current) {
        try {
          if (scannerRef.current.isScanning) {
            await scannerRef.current.stop();
          }
          scannerRef.current.clear();
        } catch {
          // ignore
        }
      }

      const qrScanner = new Html5Qrcode(readerElementId);
      scannerRef.current = qrScanner;

      const scanConfig: Html5QrcodeCameraScanConfig = {
        fps: 20,
        qrbox: (viewfinderWidth, viewfinderHeight) => {
          const edge = Math.floor(Math.min(viewfinderWidth, viewfinderHeight) * 0.72);
          return {
            width: Math.max(220, edge),
            height: Math.max(220, edge),
          };
        },
        aspectRatio: 1.0,
      };

      await qrScanner.start(
        cameraIdOrFacingMode,
        scanConfig,
        (decodedText: string) => {
          if (isStoppedRef.current) return;
          isStoppedRef.current = true;

          if (typeof navigator !== 'undefined' && 'vibrate' in navigator) {
            try {
              navigator.vibrate(80);
            } catch {
              // ignore
            }
          }

          qrScanner
            .stop()
            .then(() => {
              qrScanner.clear();
              onScanSuccess(decodedText);
            })
            .catch(() => {
              onScanSuccess(decodedText);
            });
        },
        () => {}
      );

      setIsInitializing(false);

      try {
        const capabilities = qrScanner.getRunningTrackCapabilities();
        if ((capabilities as any)?.torch) {
          setHasTorch(true);
        }
      } catch {
        // torch not supported
      }

      try {
        const devices = await Html5Qrcode.getCameras();
        if (devices && devices.length > 0) {
          setAvailableCameras(devices.map(d => ({ id: d.id, label: d.label || `Camera ${d.id}` })));
        }
      } catch {
        // ignore
      }
    } catch (err: unknown) {
      setIsInitializing(false);
      const msg = err instanceof Error ? err.message : String(err);

      if (
        msg.toLowerCase().includes('permission') ||
        msg.toLowerCase().includes('notallowed') ||
        msg.toLowerCase().includes('denied')
      ) {
        setErrorMessage(
          'Camera permission was denied. Tap the lock icon in your browser address bar to allow Camera access, then tap Retry.'
        );
      } else if (
        msg.toLowerCase().includes('notfound') ||
        msg.toLowerCase().includes('no device') ||
        msg.toLowerCase().includes('notreadable')
      ) {
        setErrorMessage(
          'No accessible camera detected. Make sure another application is not holding the camera stream.'
        );
      } else {
        setErrorMessage(
          `Unable to access camera: ${msg}. Make sure you are using an HTTPS connection.`
        );
      }
    }
  };

  useEffect(() => {
    isStoppedRef.current = false;
    startCamera({ facingMode: 'environment' });

    const handleVisibilityChange = () => {
      if (document.hidden) {
        if (scannerRef.current && scannerRef.current.isScanning) {
          scannerRef.current.stop().catch(() => {});
        }
      } else {
        if (!isStoppedRef.current) {
          startCamera({ facingMode: 'environment' });
        }
      }
    };

    document.addEventListener('visibilitychange', handleVisibilityChange);

    return () => {
      isStoppedRef.current = true;
      document.removeEventListener('visibilitychange', handleVisibilityChange);
      if (scannerRef.current) {
        try {
          if (scannerRef.current.isScanning) {
            scannerRef.current.stop().catch(() => {});
          }
          scannerRef.current.clear();
        } catch {
          // ignore
        }
      }
    };
  }, []);

  const handleToggleTorch = async () => {
    if (!scannerRef.current || !hasTorch) return;
    try {
      const nextState = !isTorchOn;
      await scannerRef.current.applyVideoConstraints({
        advanced: [{ torch: nextState } as any],
      });
      setIsTorchOn(nextState);
    } catch {
      // torch failed
    }
  };

  const handleSwitchCamera = () => {
    if (availableCameras.length < 2) return;
    const nextIdx = (currentCameraIndex + 1) % availableCameras.length;
    setCurrentCameraIndex(nextIdx);
    startCamera(availableCameras[nextIdx].id);
  };

  return (
    <div className="fixed inset-0 z-50 flex flex-col bg-[#0c0c0e] text-white select-none overscroll-none animate-in fade-in duration-200">
      {/* Top HUD Controls matching the smart device circular layout */}
      <div className="w-full max-w-sm sm:max-w-md mx-auto flex items-center justify-between px-5 py-4 z-20">
        <div className="flex items-center gap-2">
          <span className="w-2.5 h-2.5 rounded-full bg-emerald-400 animate-pulse shadow-[0_0_8px_#34d399]" />
          <span className="text-xs font-semibold tracking-wider uppercase text-neutral-300">
            ZATCA Optical Eye
          </span>
        </div>

        <div className="flex items-center gap-3">
          {hasTorch && (
            <button
              onClick={handleToggleTorch}
              aria-label="Toggle Flashlight"
              className={`w-11 h-11 rounded-full flex items-center justify-center backdrop-blur-xl border transition ${
                isTorchOn
                  ? 'bg-white text-black border-white shadow-lg'
                  : 'bg-neutral-800/80 border-neutral-700/60 text-white hover:bg-neutral-700'
              }`}
            >
              <Flashlight className="w-5 h-5" />
            </button>
          )}

          {availableCameras.length > 1 && (
            <button
              onClick={handleSwitchCamera}
              aria-label="Switch Camera"
              className="w-11 h-11 rounded-full bg-neutral-800/80 border border-neutral-700/60 hover:bg-neutral-700 text-white flex items-center justify-center transition"
            >
              <Camera className="w-5 h-5" />
            </button>
          )}

          {/* Crisp solid white circular exit button */}
          <button
            onClick={onClose}
            aria-label="Close Scanner"
            className="w-11 h-11 rounded-full bg-white text-black hover:bg-neutral-100 flex items-center justify-center shadow-lg active:scale-95 transition"
          >
            <X className="w-5 h-5" />
          </button>
        </div>
      </div>

      {/* Main Viewport Container */}
      <div className="relative flex-1 w-full h-full flex items-center justify-center overflow-hidden">
        <div
          id={readerElementId}
          className="w-full h-full object-cover [&>video]:w-full [&>video]:h-full [&>video]:object-cover"
        />

        {/* Viewfinder Reticle Overlay */}
        {!errorMessage && !isInitializing && (
          <div className="pointer-events-none absolute inset-0 flex items-center justify-center p-6">
            <div className="relative w-68 h-68 sm:w-76 sm:h-76 rounded-[36px] border-2 border-white/20 shadow-[0_0_0_9999px_rgba(12,12,14,0.65)]">
              {/* Corner brackets in warm camel / white accent */}
              <span className="absolute -top-1 -left-1 w-9 h-9 border-t-4 border-l-4 border-[#c7aa86] rounded-tl-2xl" />
              <span className="absolute -top-1 -right-1 w-9 h-9 border-t-4 border-r-4 border-[#c7aa86] rounded-tr-2xl" />
              <span className="absolute -bottom-1 -left-1 w-9 h-9 border-b-4 border-l-4 border-[#c7aa86] rounded-bl-2xl" />
              <span className="absolute -bottom-1 -right-1 w-9 h-9 border-b-4 border-r-4 border-[#c7aa86] rounded-br-2xl" />

              {/* Scanning laser beam animation */}
              <div className="absolute inset-x-3 h-0.5 bg-linear-to-r from-transparent via-[#c7aa86] to-transparent shadow-[0_0_12px_#c7aa86] animate-bounce duration-1000 top-1/2" />
            </div>
          </div>
        )}

        {/* Loading Spinner during camera startup */}
        {isInitializing && !errorMessage && (
          <div className="absolute inset-0 flex flex-col items-center justify-center bg-[#0c0c0e]/95 p-6 text-center space-y-3 z-10">
            <RefreshCw className="w-8 h-8 text-[#c7aa86] animate-spin" />
            <p className="text-sm font-medium text-neutral-300">Initializing camera feed...</p>
          </div>
        )}

        {/* Error / Permission Recovery Card */}
        {errorMessage && (
          <div className="absolute inset-0 flex flex-col items-center justify-center bg-[#0c0c0e]/95 p-6 text-center space-y-4 z-20">
            <div className="w-14 h-14 rounded-full bg-red-950/80 border border-red-500/50 flex items-center justify-center text-red-400">
              <AlertCircle className="w-7 h-7" />
            </div>
            <div className="max-w-sm space-y-2">
              <h3 className="text-base font-semibold text-white">Camera Access Required</h3>
              <p className="text-xs text-neutral-300 leading-relaxed">{errorMessage}</p>
            </div>
            <div className="flex flex-col sm:flex-row gap-2.5 w-full max-w-xs pt-2">
              <button
                onClick={() => startCamera({ facingMode: 'environment' })}
                className="flex-1 py-3 px-4 rounded-2xl bg-white text-black font-semibold text-xs transition flex items-center justify-center gap-1.5 shadow-md active:scale-98"
              >
                <RefreshCw className="w-3.5 h-3.5" />
                Retry Camera
              </button>
              <button
                onClick={onClose}
                className="py-3 px-4 rounded-2xl bg-[#222225] border border-neutral-700 text-neutral-300 font-semibold text-xs transition"
              >
                Close
              </button>
            </div>
          </div>
        )}
      </div>

      {/* Bottom Guidance Bar */}
      <div className="w-full py-5 px-6 text-center z-20 bg-linear-to-t from-[#0c0c0e] via-[#0c0c0e]/80 to-transparent">
        <p className="text-xs text-neutral-400 max-w-md mx-auto">
          Align the ZATCA invoice QR code within the reticle. Capture is instantaneous.
        </p>
      </div>
    </div>
  );
};
