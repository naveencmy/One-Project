import React, { useState, useEffect, useRef, useCallback } from 'react';
import { Shield, Lock, KeyRound, Eye, EyeOff, AlertCircle, CheckCircle2, Loader2, X } from 'lucide-react';
import { useWorkspace } from '../../context/WorkspaceContext';

// SHA-256 in the browser (Web Crypto API — no library needed)
async function sha256(text) {
  const clean = String(text || '').trim();
  const encoder = new TextEncoder();
  const data = encoder.encode(clean);
  const hashBuffer = await crypto.subtle.digest('SHA-256', data);
  return Array.from(new Uint8Array(hashBuffer))
    .map(b => b.toString(16).padStart(2, '0'))
    .join('');
}

// ── PIN Dot Indicators ────────────────────────────────────────────────────────
const PinDots = ({ count, filled }) => (
  <div className="flex items-center justify-center gap-3 my-4" aria-hidden="true">
    {Array.from({ length: count }).map((_, i) => (
      <div
        key={i}
        className={`w-3.5 h-3.5 rounded-full border-2 transition-all duration-200 ${
          i < filled
            ? 'bg-indigo-400 border-indigo-400 scale-110 shadow-[0_0_8px_rgba(99,102,241,0.6)]'
            : 'bg-transparent border-[#444454]'
        }`}
      />
    ))}
  </div>
);

// ── Numeric PIN Pad ───────────────────────────────────────────────────────────
const PinPad = ({ onDigit, onDelete, disabled }) => {
  const keys = ['1','2','3','4','5','6','7','8','9','','0','⌫'];
  return (
    <div className="grid grid-cols-3 gap-2.5 w-full max-w-[240px] mx-auto">
      {keys.map((key, i) => {
        if (key === '') return <div key={i} />;
        const isDelete = key === '⌫';
        return (
          <button
            key={i}
            id={`pin-key-${isDelete ? 'del' : key}`}
            disabled={disabled}
            onClick={() => isDelete ? onDelete() : onDigit(key)}
            className={`
              h-14 rounded-2xl text-xl font-semibold border transition-all duration-150 select-none
              ${isDelete
                ? 'text-rose-400 border-[#2B2B38] bg-[#1A1A22] hover:bg-rose-950/30 hover:border-rose-800/40'
                : 'text-white border-[#2B2B38] bg-[#1A1A22] hover:bg-[#26263A] hover:border-[#5E6AD2]/40 active:scale-95'
              }
              disabled:opacity-40 disabled:cursor-not-allowed
            `}
            aria-label={isDelete ? 'Delete digit' : `Digit ${key}`}
          >
            {key}
          </button>
        );
      })}
    </div>
  );
};

// ── Main PinGate Component ────────────────────────────────────────────────────
export const PinGate = () => {
  const {
    isLoadingAuth,
    isConfigured,
    isPinUnlocked,
    authError,
    setAuthError,
    verifyPin,
    setupPin,
  } = useWorkspace();

  const [pin, setPin]           = useState('');
  const [confirmPin, setConfirmPin] = useState('');
  const [stage, setStage]       = useState('enter'); // 'enter' | 'confirm'
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [success, setSuccess]   = useState(false);
  const [showPin, setShowPin]   = useState(false);
  const PIN_LENGTH               = 4;

  // Reset pin state whenever the gate visibility changes
  useEffect(() => {
    setPin('');
    setConfirmPin('');
    setStage('enter');
    setAuthError('');
    setSuccess(false);
  }, [isConfigured, setAuthError]);

  const handleDigit = useCallback((digit) => {
    if (isSubmitting) return;
    setAuthError('');

    if (!isConfigured) {
      // Setup flow
      if (stage === 'enter' && pin.length < PIN_LENGTH) {
        const next = pin + digit;
        setPin(next);
        if (next.length === PIN_LENGTH) {
          // Auto-advance to confirm stage after short delay
          setTimeout(() => setStage('confirm'), 300);
        }
      } else if (stage === 'confirm' && confirmPin.length < PIN_LENGTH) {
        const next = confirmPin + digit;
        setConfirmPin(next);
        if (next.length === PIN_LENGTH) {
          setTimeout(() => handleSetupSubmit(pin, next), 300);
        }
      }
    } else {
      // Verify flow
      if (pin.length < PIN_LENGTH) {
        const next = pin + digit;
        setPin(next);
        if (next.length === PIN_LENGTH) {
          setTimeout(() => handleVerifySubmit(next), 300);
        }
      }
    }
  }, [pin, confirmPin, stage, isConfigured, isSubmitting]);

  const handleDelete = useCallback(() => {
    if (isSubmitting) return;
    setAuthError('');
    if (!isConfigured && stage === 'confirm') {
      if (confirmPin.length > 0) setConfirmPin(p => p.slice(0, -1));
      else { setStage('enter'); setPin(p => p.slice(0, -1)); }
    } else {
      setPin(p => p.slice(0, -1));
    }
  }, [isSubmitting, isConfigured, stage, confirmPin]);

  const handleVerifySubmit = useCallback(async (finalPin) => {
    setIsSubmitting(true);
    const hash = await sha256(finalPin);
    const ok = await verifyPin(hash);
    if (!ok) {
      setPin('');
      setIsSubmitting(false);
    } else {
      setSuccess(true);
    }
  }, [verifyPin]);

  const handleSetupSubmit = useCallback(async (p1, p2) => {
    if (p1 !== p2) {
      setAuthError('PINs do not match. Please try again.');
      setPin('');
      setConfirmPin('');
      setStage('enter');
      return;
    }
    setIsSubmitting(true);
    const hash = await sha256(p1);
    const ok = await setupPin(hash);
    if (!ok) {
      setPin('');
      setConfirmPin('');
      setStage('enter');
      setIsSubmitting(false);
    } else {
      setSuccess(true);
    }
  }, [setupPin, setAuthError]);

  // Keyboard support
  useEffect(() => {
    const handler = (e) => {
      if (e.key >= '0' && e.key <= '9') handleDigit(e.key);
      else if (e.key === 'Backspace') handleDelete();
    };
    window.addEventListener('keydown', handler);
    return () => window.removeEventListener('keydown', handler);
  }, [handleDigit, handleDelete]);

  // Don't render the gate if still loading or already unlocked
  if (isLoadingAuth) {
    return (
      <div className="fixed inset-0 z-[9999] bg-[#09090B] flex items-center justify-center">
        <div className="flex flex-col items-center gap-4">
          <div className="w-12 h-12 rounded-2xl bg-indigo-500/10 border border-indigo-500/20 flex items-center justify-center">
            <Loader2 className="w-6 h-6 text-indigo-400 animate-spin" />
          </div>
          <p className="text-sm text-gray-400 animate-pulse">Initializing workspace…</p>
        </div>
      </div>
    );
  }

  if (isPinUnlocked) return null;

  const currentPin = (!isConfigured && stage === 'confirm') ? confirmPin : pin;
  const headingText = !isConfigured
    ? (stage === 'enter' ? 'Create Your Workspace PIN' : 'Confirm Your PIN')
    : 'Unlock Your Workspace';
  const subText = !isConfigured
    ? (stage === 'enter'
        ? 'Choose a 4-digit PIN to secure your Nexus workspace.'
        : 'Re-enter your PIN to confirm.')
    : 'Enter your 4-digit PIN to continue.';

  return (
    <div
      className="fixed inset-0 z-[9999] flex items-center justify-center"
      style={{ background: 'radial-gradient(ellipse at 50% 30%, #0d0d1a 0%, #09090b 80%)' }}
    >
      {/* Background grid decoration */}
      <div
        className="absolute inset-0 pointer-events-none opacity-[0.04]"
        style={{
          backgroundImage: 'linear-gradient(#5E6AD2 1px, transparent 1px), linear-gradient(90deg, #5E6AD2 1px, transparent 1px)',
          backgroundSize: '40px 40px',
        }}
      />

      {/* Card */}
      <div className="relative z-10 w-full max-w-sm mx-4">
        <div
          className="bg-[#111116] border border-[#222230] rounded-3xl p-8 shadow-2xl"
          style={{ boxShadow: '0 25px 60px rgba(0,0,0,0.7), 0 0 0 1px rgba(94,106,210,0.08) inset' }}
        >
          {/* Icon */}
          <div className="flex justify-center mb-5">
            <div
              className={`w-16 h-16 rounded-2xl flex items-center justify-center border transition-all duration-500 ${
                success
                  ? 'bg-emerald-500/10 border-emerald-500/30'
                  : 'bg-indigo-500/10 border-indigo-500/20'
              }`}
              style={{ boxShadow: success ? '0 0 30px rgba(16,185,129,0.15)' : '0 0 30px rgba(94,106,210,0.15)' }}
            >
              {success ? (
                <CheckCircle2 className="w-8 h-8 text-emerald-400" />
              ) : isConfigured ? (
                <Lock className="w-8 h-8 text-indigo-400" />
              ) : (
                <KeyRound className="w-8 h-8 text-indigo-400" />
              )}
            </div>
          </div>

          {/* Heading */}
          <div className="text-center mb-6">
            <h1 className="text-lg font-bold text-white tracking-tight">
              {success ? (isConfigured ? 'Welcome Back!' : 'PIN Created!') : headingText}
            </h1>
            <p className="text-xs text-gray-400 mt-1">
              {success ? 'Opening your workspace…' : subText}
            </p>
          </div>

          {!success && (
            <>
              {/* Stage indicator for setup flow */}
              {!isConfigured && (
                <div className="flex items-center justify-center gap-2 mb-3">
                  <div className={`h-1 w-12 rounded-full transition-colors ${stage === 'enter' ? 'bg-indigo-500' : 'bg-emerald-500'}`} />
                  <div className={`h-1 w-12 rounded-full transition-colors ${stage === 'confirm' ? 'bg-indigo-500' : 'bg-[#2B2B38]'}`} />
                </div>
              )}

              {/* PIN Dots */}
              <PinDots count={PIN_LENGTH} filled={currentPin.length} />

              {/* Error */}
              {authError && (
                <div className="flex items-center gap-2 bg-rose-950/30 border border-rose-800/30 rounded-xl px-3 py-2 mb-3 text-xs text-rose-400">
                  <AlertCircle className="w-3.5 h-3.5 shrink-0" />
                  <span>{authError}</span>
                </div>
              )}

              {/* Numpad */}
              <div className="mt-2">
                <PinPad onDigit={handleDigit} onDelete={handleDelete} disabled={isSubmitting} />
              </div>

              {/* Submitting spinner */}
              {isSubmitting && (
                <div className="flex items-center justify-center gap-2 mt-4 text-xs text-indigo-400">
                  <Loader2 className="w-4 h-4 animate-spin" />
                  <span>{isConfigured ? 'Verifying…' : 'Setting up…'}</span>
                </div>
              )}

              {/* Back button (confirm stage) */}
              {!isConfigured && stage === 'confirm' && !isSubmitting && (
                <button
                  onClick={() => { setStage('enter'); setPin(''); setConfirmPin(''); setAuthError(''); }}
                  className="w-full mt-4 text-xs text-gray-500 hover:text-gray-300 transition-colors py-1"
                >
                  ← Back
                </button>
              )}
            </>
          )}

          {/* Nexus branding */}
          <div className="flex items-center justify-center gap-1.5 mt-6 pt-4 border-t border-[#1E1E28]">
            <Shield className="w-3 h-3 text-indigo-500/60" />
            <span className="text-[10px] text-gray-600 font-mono tracking-wider">Gate Of Kernel-WORKSPACE</span>
          </div>
        </div>
      </div>
    </div>
  );
};

export default PinGate;
