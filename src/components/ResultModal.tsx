import React, { useState } from 'react';
import {
  CheckCircle2,
  XCircle,
  AlertTriangle,
  RefreshCw,
  Send,
  X,
  FileText,
  ChevronDown,
  ChevronUp,
  Info,
  Camera,
} from 'lucide-react';
import { SendResult } from '../types.ts';
import { inspectZatcaPayload } from '../utils/zatcaTlv.ts';

interface ResultModalProps {
  rawPayload: string;
  onSend: (idempotencyKey: string) => Promise<SendResult>;
  onScanAgain: () => void;
  onClose: () => void;
}

export const ResultModal: React.FC<ResultModalProps> = ({
  rawPayload,
  onSend,
  onScanAgain,
  onClose,
}) => {
  const [isSending, setIsSending] = useState(false);
  const [result, setResult] = useState<SendResult | null>(null);
  const [idempotencyKey] = useState<string>(() => {
    return typeof crypto !== 'undefined' && 'randomUUID' in crypto
      ? crypto.randomUUID()
      : `idem_${Date.now()}_${Math.random().toString(36).substring(2, 9)}`;
  });
  const [showTlvInspector, setShowTlvInspector] = useState(false);

  // Informational TLV inspection (strictly read-only diagnostic)
  const tlvData = React.useMemo(() => inspectZatcaPayload(rawPayload), [rawPayload]);

  const handleSend = async () => {
    if (isSending) return;
    setIsSending(true);
    setResult(null);

    try {
      const res = await onSend(idempotencyKey);
      setResult(res);
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : String(err);
      setResult({
        success: false,
        error: `Submission failed: ${message}`,
      });
    } finally {
      setIsSending(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center bg-black/80 backdrop-blur-md p-0 sm:p-4 animate-in fade-in duration-150 select-none">
      <div
        className="w-full sm:max-w-md max-h-[92dvh] flex flex-col rounded-t-[36px] sm:rounded-[36px] bg-[#1a1a1d] border border-neutral-700/80 shadow-2xl overflow-hidden animate-in slide-in-from-bottom duration-200"
        role="dialog"
        aria-modal="true"
      >
        {/* Header matching smart-device styling */}
        <div className="flex items-center justify-between px-6 py-5 border-b border-neutral-800 shrink-0">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-full bg-white text-black flex items-center justify-center shadow-md">
              <CheckCircle2 className="w-5 h-5 text-neutral-950" />
            </div>
            <div>
              <h2 className="text-base font-semibold text-white">Invoice QR Detected</h2>
              <span className="text-xs text-neutral-400">
                Exact raw payload preserved ({rawPayload.length} chars)
              </span>
            </div>
          </div>

          <button
            onClick={onClose}
            disabled={isSending}
            aria-label="Close modal"
            className="w-9 h-9 rounded-full bg-neutral-800/80 hover:bg-neutral-700 text-neutral-400 hover:text-white flex items-center justify-center transition active:scale-95 disabled:opacity-50"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Scrollable Content Body */}
        <div className="flex-1 overflow-y-auto px-6 py-4 space-y-4 custom-scrollbar">
          {/* Submission Feedback Status */}
          {result && (
            <div
              className={`p-4 rounded-2xl text-xs flex items-start gap-3 border transition ${
                result.success
                  ? 'bg-emerald-950/40 text-emerald-300 border-emerald-800/60'
                  : result.timeout
                  ? 'bg-amber-950/40 text-amber-300 border-amber-800/60'
                  : 'bg-red-950/40 text-red-300 border-red-800/60'
              }`}
            >
              {result.success ? (
                <CheckCircle2 className="w-5 h-5 mt-0.5 shrink-0 text-emerald-400" />
              ) : result.timeout ? (
                <AlertTriangle className="w-5 h-5 mt-0.5 shrink-0 text-amber-400" />
              ) : (
                <XCircle className="w-5 h-5 mt-0.5 shrink-0 text-red-400" />
              )}

              <div className="space-y-1">
                <span className="font-semibold block text-sm">
                  {result.success
                    ? 'Delivery Confirmed'
                    : result.timeout
                    ? 'Request Timeout'
                    : 'External API Rejection'}
                </span>
                <p className="leading-relaxed text-xs">
                  {result.message || result.error || 'Unknown outcome from external server.'}
                </p>
                {result.responseExcerpt && (
                  <div className="mt-2 p-2.5 rounded-xl bg-black/60 font-mono text-[10px] break-all border border-neutral-800 text-neutral-300">
                    {result.responseExcerpt}
                  </div>
                )}
                {result.timeout && (
                  <p className="text-[11px] font-medium text-amber-400 mt-1">
                    Please do not immediately re-send without checking your destination records.
                  </p>
                )}
              </div>
            </div>
          )}

          {/* Raw Decoded Text String Area */}
          <div className="space-y-2">
            <div className="flex items-center justify-between text-xs">
              <label className="font-medium text-neutral-300 flex items-center gap-1.5">
                <FileText className="w-4 h-4 text-[#c7aa86]" />
                Original QR String:
              </label>
              <span className="text-[10px] text-neutral-500 uppercase tracking-widest font-mono">
                Untouched
              </span>
            </div>

            <textarea
              readOnly
              value={rawPayload}
              rows={5}
              className="w-full rounded-2xl border border-neutral-800 bg-black/60 p-3.5 font-mono text-xs text-neutral-200 select-all focus:outline-none focus:border-neutral-600 resize-none custom-scrollbar leading-relaxed"
            />

            <p className="text-[11px] text-neutral-500 italic">
              Exact original string is retained with zero normalization, truncation, or Base64 tampering.
            </p>
          </div>

          {/* Optional Diagnostic TLV Preview */}
          {tlvData.isZatcaFormat && (
            <div className="border border-neutral-800 rounded-2xl overflow-hidden bg-black/40">
              <button
                type="button"
                onClick={() => setShowTlvInspector(!showTlvInspector)}
                className="w-full px-4 py-3 hover:bg-white/5 flex items-center justify-between text-xs font-medium text-neutral-300 transition"
              >
                <div className="flex items-center gap-2">
                  <Info className="w-4 h-4 text-[#c7aa86]" />
                  <span>Inspect ZATCA TLV Fields ({tlvData.phase})</span>
                </div>
                {showTlvInspector ? (
                  <ChevronUp className="w-4 h-4 text-neutral-400" />
                ) : (
                  <ChevronDown className="w-4 h-4 text-neutral-400" />
                )}
              </button>

              {showTlvInspector && (
                <div className="p-3.5 bg-black/70 border-t border-neutral-800 space-y-2 text-xs">
                  <p className="text-[10px] text-neutral-500">
                    * Informational preview only. Exact raw payload string is preserved and transmitted untouched.
                  </p>
                  <div className="divide-y divide-neutral-800 max-h-48 overflow-y-auto custom-scrollbar">
                    {tlvData.tags.map(t => (
                      <div key={t.tag} className="py-2 flex flex-col gap-1">
                        <div className="flex items-center justify-between text-[11px]">
                          <span className="font-semibold text-neutral-200">
                            Tag {t.tag}: {t.tagName}
                          </span>
                          <span className="text-[10px] text-neutral-500">{t.length} bytes</span>
                        </div>
                        <div className="font-mono text-[11px] text-neutral-400 break-all bg-neutral-900/80 p-1.5 rounded-lg border border-neutral-800">
                          {t.value}
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>
          )}
        </div>

        {/* Footer Actions matching the style of the reference image */}
        <div className="p-5 border-t border-neutral-800 bg-[#161618] flex flex-col sm:flex-row gap-3 shrink-0">
          {/* Primary Send Button (High-contrast solid white or camel tile) */}
          <button
            onClick={handleSend}
            disabled={isSending || result?.success}
            className={`flex-1 py-3.5 px-5 rounded-2xl font-semibold text-xs transition flex items-center justify-center gap-2 shadow-lg active:scale-98 ${
              result?.success
                ? 'bg-emerald-600 text-white cursor-default'
                : isSending
                ? 'bg-neutral-300 text-neutral-900 cursor-wait'
                : 'bg-white text-neutral-950 hover:bg-neutral-100'
            }`}
          >
            {isSending ? (
              <>
                <RefreshCw className="w-4 h-4 animate-spin text-neutral-900" />
                <span>Transmitting Payload...</span>
              </>
            ) : result?.success ? (
              <>
                <CheckCircle2 className="w-4 h-4" />
                <span>Delivered Successfully</span>
              </>
            ) : (
              <>
                <Send className="w-4 h-4 text-neutral-950" />
                <span>{result?.error ? 'Retry Sending' : 'Send to Destination'}</span>
              </>
            )}
          </button>

          {/* Secondary Scan Again Button (Charcoal tile) */}
          <button
            onClick={onScanAgain}
            disabled={isSending}
            className="py-3.5 px-5 rounded-2xl border border-neutral-700 bg-[#222225] hover:bg-[#2b2b2f] text-white text-xs font-semibold transition active:scale-98 disabled:opacity-50 flex items-center justify-center gap-2"
          >
            <Camera className="w-4 h-4 text-neutral-400" />
            <span>Scan Again</span>
          </button>
        </div>
      </div>
    </div>
  );
};
