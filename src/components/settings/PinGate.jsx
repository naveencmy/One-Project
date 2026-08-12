import React, { useState, useEffect, useRef } from "react";
import { Lock, ShieldCheck, Eye, EyeOff, KeyRound, RotateCcw, CheckCircle2, XCircle } from "lucide-react";
import { useWorkspace } from "../../context/WorkspaceContext";

// SHA-256 hash using Web Crypto API (runs in browser — no secrets sent in plaintext)
async function sha256(message) {
  const msgBuffer = new TextEncoder().encode(message);
  const hashBuffer = await crypto.subtle.digest("SHA-256", msgBuffer);
  const hashArray = Array.from(new Uint8Array(hashBuffer));
  return hashArray.map(b => b.toString(16).padStart(2, "0")).join("");
}

// ── PIN Input Row component ─────────────────────────────────────────────────
const PinDots = ({ pin, maxLen = 4, shake }) => (
  <div className={`flex items-center justify-center gap-3 my-6 ${shake ? "animate-pin-shake" : ""}`}>
    {Array.from({ length: maxLen }).map((_, i) => (
      <div
        key={i}
        className={`w-4 h-4 rounded-full border-2 transition-all duration-200 ${
          i < pin.length
            ? "bg-[#5E6AD2] border-[#5E6AD2] scale-110 shadow-lg shadow-[#5E6AD2]/40"
            : "bg-transparent border-[#444450]"
        }`}
      />
    ))}
  </div>
);

// ── Numeric Keypad ──────────────────────────────────────────────────────────
const Keypad = ({ onPress, onDelete }) => {
  const keys = ["1","2","3","4","5","6","7","8","9","","0","⌫"];
  return (
    <div className="grid grid-cols-3 gap-2 mt-2">
      {keys.map((k, i) => {
        if (k === "") return <div key={i} />;
        const isDelete = k === "⌫";
        return (
          <button
            key={i}
            type="button"
            onClick={() => isDelete ? onDelete() : onPress(k)}
            className={`h-12 rounded-xl text-lg font-semibold transition-all duration-150 active:scale-95 select-none
              ${isDelete
                ? "bg-[#2A1A1A] border border-rose-900/50 text-rose-400 hover:bg-rose-950/60"
                : "bg-[#1E1E24] border border-[#2E2E38] text-white hover:bg-[#2A2A34] hover:border-[#5E6AD2]/40"
              }`}
          >
            {k}
          </button>
        );
      })}
    </div>
  );
};

// ── Main PinGate Component ──────────────────────────────────────────────────
const PIN_LENGTH = 4;

export const PinGate = ({ children }) => {
  const { pinHash, isPinUnlocked, unlockPin, savePinHash, isLoadingBackend } = useWorkspace();

  const [mode, setMode] = useState("unlock"); // "unlock" | "setup" | "confirm"
  const [pin, setPin] = useState("");
  const [firstPin, setFirstPin] = useState(""); // for setup confirmation
  const [shake, setShake] = useState(false);
  const [status, setStatus] = useState(null); // "success" | "error" | null
  const [statusMsg, setStatusMsg] = useState("");

  // Determine initial mode once backend is loaded
  useEffect(() => {
    if (isLoadingBackend) return;
    if (!pinHash) {
      setMode("setup");
    } else {
      setMode("unlock");
    }
  }, [pinHash, isLoadingBackend]);

  // Listen for hardware keyboard number input
  useEffect(() => {
    if (isPinUnlocked) return;
    const handleKey = (e) => {
      if (/^[0-9]$/.test(e.key)) handlePress(e.key);
      if (e.key === "Backspace") handleDelete();
    };
    window.addEventListener("keydown", handleKey);
    return () => window.removeEventListener("keydown", handleKey);
  }, [pin, isPinUnlocked]);

  // Auto-submit when PIN is complete
  useEffect(() => {
    if (pin.length === PIN_LENGTH) {
      const timer = setTimeout(() => handleSubmit(pin), 180);
      return () => clearTimeout(timer);
    }
  }, [pin]);

  const handlePress = (digit) => {
    if (pin.length >= PIN_LENGTH) return;
    setPin(prev => prev + digit);
  };

  const handleDelete = () => {
    setPin(prev => prev.slice(0, -1));
    setStatus(null);
  };

  const triggerShake = () => {
    setShake(true);
    setTimeout(() => setShake(false), 600);
  };

  const showStatus = (type, msg, duration = 2000) => {
    setStatus(type);
    setStatusMsg(msg);
    if (duration) setTimeout(() => setStatus(null), duration);
  };

  const handleSubmit = async (currentPin) => {
    const hash = await sha256(currentPin);

    if (mode === "unlock") {
      if (hash === pinHash) {
        showStatus("success", "Access Granted!", 1500);
        setTimeout(() => unlockPin(), 700);
      } else {
        triggerShake();
        showStatus("error", "Incorrect PIN. Try again.", 2000);
        setPin("");
      }
    } else if (mode === "setup") {
      setFirstPin(currentPin);
      setPin("");
      setMode("confirm");
      setStatus(null);
    } else if (mode === "confirm") {
      if (currentPin === firstPin) {
        const newHash = await sha256(currentPin);
        await savePinHash(newHash);
        showStatus("success", "PIN set successfully!", 1500);
        setTimeout(() => unlockPin(), 900);
      } else {
        triggerShake();
        showStatus("error", "PINs do not match. Start over.", 2500);
        setPin("");
        setFirstPin("");
        setMode("setup");
      }
    }
  };

  if (isLoadingBackend) {
    return (
      <div className="min-h-screen flex flex-col items-center justify-center bg-[#0B0B0C] text-gray-400 gap-3">
        <ShieldCheck className="w-10 h-10 text-[#5E6AD2] animate-pulse" />
        <span className="text-xs font-mono">Synchronizing workspace security & Excel sheet...</span>
      </div>
    );
  }

  if (isPinUnlocked) return children;

  const modeConfig = {
    unlock: {
      icon: Lock,
      iconColor: "text-[#5E6AD2]",
      iconBg: "bg-[#5E6AD2]/10 border-[#5E6AD2]/30",
      title: "Settings Protected",
      subtitle: "Enter your 4-digit PIN to access workspace settings & profile.",
    },
    setup: {
      icon: KeyRound,
      iconColor: "text-amber-400",
      iconBg: "bg-amber-400/10 border-amber-400/30",
      title: "Create PIN Lock",
      subtitle: "Set a 4-digit PIN to protect your profile and workspace settings.",
    },
    confirm: {
      icon: ShieldCheck,
      iconColor: "text-emerald-400",
      iconBg: "bg-emerald-400/10 border-emerald-400/30",
      title: "Confirm Your PIN",
      subtitle: "Re-enter your PIN to confirm and activate the lock.",
    },
  };

  const cfg = modeConfig[mode];
  const Icon = cfg.icon;

  return (
    <div className="min-h-screen flex items-center justify-center bg-[#0B0B0C] p-4">
      {/* Ambient glow */}
      <div className="fixed inset-0 pointer-events-none overflow-hidden">
        <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-96 h-96 bg-[#5E6AD2]/5 rounded-full blur-3xl" />
      </div>

      <div className="relative w-full max-w-sm">
        {/* Card */}
        <div className="bg-[#111114] border border-[#262630] rounded-2xl shadow-2xl overflow-hidden">
          {/* Header strip */}
          <div className="h-1 w-full bg-gradient-to-r from-[#5E6AD2] via-violet-500 to-indigo-400" />

          <div className="p-8">
            {/* Icon */}
            <div className={`w-14 h-14 rounded-2xl border mx-auto mb-4 flex items-center justify-center ${cfg.iconBg}`}>
              <Icon className={`w-7 h-7 ${cfg.iconColor}`} />
            </div>

            {/* Title */}
            <h1 className="text-center text-lg font-bold text-white">{cfg.title}</h1>
            <p className="text-center text-xs text-gray-400 mt-1 leading-relaxed">{cfg.subtitle}</p>

            {/* Mode breadcrumb */}
            <div className="flex items-center justify-center gap-1.5 mt-3">
              {["setup","confirm"].includes(mode) && (
                <>
                  <span className={`w-2 h-2 rounded-full ${mode === "setup" ? "bg-[#5E6AD2]" : "bg-emerald-400"}`} />
                  <span className={`w-2 h-2 rounded-full ${mode === "confirm" ? "bg-[#5E6AD2]" : "bg-[#333340]"}`} />
                </>
              )}
            </div>

            {/* Status Message */}
            {status && (
              <div className={`mt-3 mx-auto max-w-xs flex items-center gap-2 px-3 py-2 rounded-lg text-xs font-medium
                ${status === "success" ? "bg-emerald-950/60 border border-emerald-800/50 text-emerald-400" : "bg-rose-950/60 border border-rose-800/50 text-rose-400"}`}>
                {status === "success" ? <CheckCircle2 className="w-4 h-4 shrink-0" /> : <XCircle className="w-4 h-4 shrink-0" />}
                {statusMsg}
              </div>
            )}

            {/* PIN dots */}
            <PinDots pin={pin} maxLen={PIN_LENGTH} shake={shake} />

            {/* Numeric keypad */}
            <Keypad onPress={handlePress} onDelete={handleDelete} />

            {/* Security note */}
            <p className="mt-4 text-center text-[10px] text-gray-500 leading-relaxed">
              🔒 One-time PIN lock. SHA-256 hashed &amp; stored in Team Lead row in <code className="text-indigo-300">profile_data.xlsx</code> Excel sheet.
            </p>
          </div>
        </div>

        {/* App name */}
        <p className="text-center text-[10px] text-gray-600 mt-4 font-mono tracking-widest uppercase">
          Nexus Workspace · Settings Guard
        </p>
      </div>

      <style>{`
        @keyframes pin-shake {
          0%, 100% { transform: translateX(0); }
          15%       { transform: translateX(-8px); }
          30%       { transform: translateX(8px); }
          45%       { transform: translateX(-6px); }
          60%       { transform: translateX(6px); }
          75%       { transform: translateX(-4px); }
          90%       { transform: translateX(4px); }
        }
        .animate-pin-shake { animation: pin-shake 0.55s ease-in-out; }
      `}</style>
    </div>
  );
};
