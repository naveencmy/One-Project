import React, { useState, useEffect, useRef } from "react";
import {
  Lock, ShieldCheck, KeyRound, CheckCircle2, XCircle, ArrowLeft, UserCircle2
} from "lucide-react";
import { useWorkspace } from "../../context/WorkspaceContext";
import { ProfilePicker } from "./ProfilePicker";

// SHA-256 hash using Web Crypto API (runs in browser — no secrets sent in plaintext)
async function sha256(message) {
  const msgBuffer = new TextEncoder().encode(message);
  const hashBuffer = await crypto.subtle.digest("SHA-256", msgBuffer);
  const hashArray = Array.from(new Uint8Array(hashBuffer));
  return hashArray.map(b => b.toString(16).padStart(2, "0")).join("");
}

// ── PIN Input Dots ──────────────────────────────────────────────────────────
const PinDots = ({ pin, maxLen = 4, shake, accentColor = "#5E6AD2" }) => (
  <div className={`flex items-center justify-center gap-3 my-6 ${shake ? "animate-pin-shake" : ""}`}>
    {Array.from({ length: maxLen }).map((_, i) => (
      <div
        key={i}
        className={`w-4 h-4 rounded-full border-2 transition-all duration-200 ${
          i < pin.length
            ? "scale-110 shadow-lg"
            : "bg-transparent border-[#444450]"
        }`}
        style={i < pin.length ? {
          backgroundColor: accentColor,
          borderColor: accentColor,
          boxShadow: `0 0 12px ${accentColor}60`,
        } : {}}
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

export const PinGate = () => {
  const {
    isConfigured,
    isPinUnlocked,
    unlockPin,
    verifyPin,
    setupPin,
    authError,
    setAuthError,
    isLoadingAuth,
    allProfiles,
    isLoadingProfiles,
    setMemberPin,
  } = useWorkspace();

  // Keep setMemberPin in a ref so we can safely call it inside async handlers
  const setMemberPinRef = useRef(setMemberPin);
  useEffect(() => { setMemberPinRef.current = setMemberPin; }, [setMemberPin]);

  // mode: "pick" | "unlock" | "setup" | "confirm" | "member_setup"
  const [mode, setMode] = useState("pick");
  const [selectedProfile, setSelectedProfile] = useState(null);
  const [pin, setPin] = useState("");
  const [firstPin, setFirstPin] = useState("");
  const [shake, setShake] = useState(false);
  const [status, setStatus] = useState(null); // "success" | "error" | null
  const [statusMsg, setStatusMsg] = useState("");

  // Determine initial mode when auth state is ready
  useEffect(() => {
    if (isLoadingAuth) return;
    if (!isConfigured) {
      // No PIN at all — show Team Lead setup
      setMode("setup");
    } else {
      // Show profile picker
      setMode("pick");
    }
    setPin("");
    setFirstPin("");
    setStatus(null);
    setAuthError("");
  }, [isConfigured, isLoadingAuth]);

  // Listen for hardware keyboard input
  useEffect(() => {
    if (isPinUnlocked) return;
    if (mode === "pick") return; // No keyboard input in picker mode
    const handleKey = (e) => {
      if (/^[0-9]$/.test(e.key)) handlePress(e.key);
      if (e.key === "Backspace") handleDelete();
    };
    window.addEventListener("keydown", handleKey);
    return () => window.removeEventListener("keydown", handleKey);
  }, [pin, isPinUnlocked, mode]);

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

  const handleProfileSelect = (profile) => {
    setSelectedProfile(profile);
    setPin("");
    setStatus(null);
    setAuthError("");
    if (!profile.hasPin) {
      // Profile has no PIN yet — let them set one up
      setMode("member_setup");
    } else {
      setMode("unlock");
    }
  };

  const handleBackToPicker = () => {
    setSelectedProfile(null);
    setPin("");
    setFirstPin("");
    setStatus(null);
    setAuthError("");
    setMode("pick");
  };

  const handleSubmit = async (currentPin) => {
    const hash = await sha256(currentPin);

    if (mode === "unlock") {
      // Verify PIN for selected profile
      const ok = await verifyPin(selectedProfile.profile_id, hash);
      if (ok) {
        showStatus("success", "Access Granted!", 1500);
      } else {
        triggerShake();
        showStatus("error", authError || "Incorrect PIN. Try again.", 2000);
        setPin("");
      }

    } else if (mode === "setup") {
      // First step: record the PIN
      setFirstPin(currentPin);
      setPin("");
      setMode("confirm");
      setStatus(null);

    } else if (mode === "confirm") {
      // Second step: confirm PIN matches
      if (currentPin === firstPin) {
        const ok = await setupPin(hash);
        if (ok) {
          showStatus("success", "PIN created! Welcome, Team Lead.", 1500);
        } else {
          triggerShake();
          showStatus("error", authError || "Setup failed. Try again.", 2000);
          setPin("");
          setFirstPin("");
          setMode("setup");
        }
      } else {
        triggerShake();
        showStatus("error", "PINs do not match. Start over.", 2500);
        setPin("");
        setFirstPin("");
        setMode("setup");
      }

    } else if (mode === "member_setup") {
      // Member setting their own PIN for the first time
      setFirstPin(currentPin);
      setPin("");
      setMode("member_confirm");
      setStatus(null);

    } else if (mode === "member_confirm") {
      if (currentPin === firstPin) {
        try {
          // Set the PIN for this member's profile, then verify to get a token
          const result = await setMemberPinRef.current(selectedProfile.profile_id, hash);
          if (result?.token) {
            // setMemberPin returned a token (first-time setup)
            showStatus("success", "PIN set! Logging in...", 1000);
            setTimeout(() => unlockPin(result.token, result.profile_id, result.role, result.name), 800);
          } else {
            // PIN was set, now verify
            const ok = await verifyPin(selectedProfile.profile_id, hash);
            if (ok) {
              showStatus("success", "PIN set! Welcome.", 1000);
            } else {
              showStatus("error", "PIN set but login failed. Try again.", 2500);
              setPin("");
              setFirstPin("");
              setMode("unlock");
            }
          }
        } catch (err) {
          triggerShake();
          showStatus("error", err.message || "Failed to set PIN.", 2500);
          setPin("");
          setFirstPin("");
          setMode("member_setup");
        }
      } else {
        triggerShake();
        showStatus("error", "PINs do not match. Start over.", 2500);
        setPin("");
        setFirstPin("");
        setMode("member_setup");
      }
    }
  };

  if (isLoadingAuth) {
    return (
      <div className="fixed inset-0 z-50 min-h-screen flex flex-col items-center justify-center bg-[#0B0B0C] text-gray-400 gap-3">
        <ShieldCheck className="w-10 h-10 text-[#5E6AD2] animate-pulse" />
        <span className="text-xs font-mono">Synchronizing workspace security...</span>
      </div>
    );
  }

  if (isPinUnlocked) return null;

  const accentColor = selectedProfile?.accentColor || "#5E6AD2";

  // ── Mode configs ────────────────────────────────────────────────────────────
  const modeConfig = {
    pick: {
      icon: UserCircle2,
      iconColor: "text-[#5E6AD2]",
      iconBg: "bg-[#5E6AD2]/10 border-[#5E6AD2]/30",
      title: "Welcome Back",
      subtitle: "Select your profile to continue.",
    },
    unlock: {
      icon: Lock,
      iconColor: "text-white",
      iconBg: `border-2`,
      title: selectedProfile?.name ? `Hey, ${selectedProfile.name.split(' ')[0]}` : "Enter PIN",
      subtitle: "Enter your 4-digit PIN to access the workspace.",
    },
    setup: {
      icon: KeyRound,
      iconColor: "text-amber-400",
      iconBg: "bg-amber-400/10 border-amber-400/30",
      title: "Create Team Lead PIN",
      subtitle: "Set a 4-digit PIN to protect this workspace.",
    },
    confirm: {
      icon: ShieldCheck,
      iconColor: "text-emerald-400",
      iconBg: "bg-emerald-400/10 border-emerald-400/30",
      title: "Confirm Your PIN",
      subtitle: "Re-enter your PIN to confirm and activate.",
    },
    member_setup: {
      icon: KeyRound,
      iconColor: "text-amber-400",
      iconBg: "bg-amber-400/10 border-amber-400/30",
      title: `Set PIN for ${selectedProfile?.name?.split(' ')[0] || 'Profile'}`,
      subtitle: "Create a 4-digit PIN for your account.",
    },
    member_confirm: {
      icon: ShieldCheck,
      iconColor: "text-emerald-400",
      iconBg: "bg-emerald-400/10 border-emerald-400/30",
      title: "Confirm Your PIN",
      subtitle: "Re-enter your PIN to confirm.",
    },
  };

  const cfg = modeConfig[mode] || modeConfig.pick;
  const Icon = cfg.icon;
  const showPicker = mode === "pick";
  const showKeypad = !showPicker;
  const showBackButton = (mode === "unlock" || mode === "member_setup") && isConfigured;
  const showStepDots = mode === "setup" || mode === "confirm" || mode === "member_setup" || mode === "member_confirm";
  const isStep2 = mode === "confirm" || mode === "member_confirm";

  return (
    <div className="fixed inset-0 z-50 min-h-screen flex items-center justify-center bg-[#0B0B0C] p-4">
      {/* Ambient glow */}
      <div className="fixed inset-0 pointer-events-none overflow-hidden">
        <div
          className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-96 h-96 rounded-full blur-3xl opacity-5"
          style={{ backgroundColor: accentColor }}
        />
      </div>

      <div className="relative w-full max-w-sm">
        {/* Card */}
        <div className="bg-[#111114] border border-[#262630] rounded-2xl shadow-2xl overflow-hidden">
          {/* Header strip */}
          <div
            className="h-1 w-full"
            style={{ background: `linear-gradient(to right, ${accentColor}, #8B5CF6, #6366F1)` }}
          />

          <div className="p-8">
            {/* Back Button */}
            {showBackButton && (
              <button
                type="button"
                onClick={handleBackToPicker}
                className="flex items-center gap-1.5 text-xs text-gray-400 hover:text-white mb-4 transition-colors group"
              >
                <ArrowLeft className="w-3.5 h-3.5 group-hover:-translate-x-0.5 transition-transform" />
                Back to profiles
              </button>
            )}

            {/* Icon */}
            {mode === "unlock" && selectedProfile ? (
              // Show the selected profile's avatar in unlock mode
              <div className="mx-auto mb-4 w-fit">
                {selectedProfile.avatar ? (
                  <img
                    src={selectedProfile.avatar}
                    alt={selectedProfile.name}
                    className="w-14 h-14 rounded-2xl object-cover border-2 shadow-lg"
                    style={{ borderColor: accentColor }}
                  />
                ) : (
                  <div
                    className="w-14 h-14 rounded-2xl flex items-center justify-center text-xl font-bold border-2 shadow-lg"
                    style={{
                      backgroundColor: `${accentColor}20`,
                      borderColor: accentColor,
                      color: accentColor,
                    }}
                  >
                    {(selectedProfile.name || '?').split(' ').map(w => w[0]).join('').toUpperCase().slice(0, 2)}
                  </div>
                )}
              </div>
            ) : (
              <div className={`w-14 h-14 rounded-2xl border mx-auto mb-4 flex items-center justify-center ${cfg.iconBg}`}>
                <Icon className={`w-7 h-7 ${cfg.iconColor}`} />
              </div>
            )}

            {/* Title */}
            <h1 className="text-center text-lg font-bold text-white">{cfg.title}</h1>
            <p className="text-center text-xs text-gray-400 mt-1 leading-relaxed">{cfg.subtitle}</p>

            {/* Role badge in unlock mode */}
            {mode === "unlock" && selectedProfile?.role && (
              <div className="flex justify-center mt-2">
                <span
                  className="text-[10px] font-semibold px-2.5 py-0.5 rounded-full border"
                  style={{
                    color: accentColor,
                    backgroundColor: `${accentColor}15`,
                    borderColor: `${accentColor}40`,
                  }}
                >
                  {selectedProfile.role}
                </span>
              </div>
            )}

            {/* Step breadcrumb */}
            {showStepDots && (
              <div className="flex items-center justify-center gap-1.5 mt-3">
                <span className={`w-2 h-2 rounded-full ${isStep2 ? "bg-emerald-400" : "bg-[#5E6AD2]"}`} />
                <span className={`w-2 h-2 rounded-full ${isStep2 ? "bg-[#5E6AD2]" : "bg-[#333340]"}`} />
              </div>
            )}

            {/* Status Message */}
            {(status || authError) && (
              <div className={`mt-3 mx-auto max-w-xs flex items-center gap-2 px-3 py-2 rounded-lg text-xs font-medium
                ${(status === "success") ? "bg-emerald-950/60 border border-emerald-800/50 text-emerald-400" : "bg-rose-950/60 border border-rose-800/50 text-rose-400"}`}>
                {status === "success"
                  ? <CheckCircle2 className="w-4 h-4 shrink-0" />
                  : <XCircle className="w-4 h-4 shrink-0" />}
                {statusMsg || authError}
              </div>
            )}

            {/* ── Profile Picker ──────────────────────────────────────────── */}
            {showPicker && (
              <div className="mt-4">
                <ProfilePicker
                  profiles={allProfiles}
                  onSelect={handleProfileSelect}
                  isLoading={isLoadingProfiles}
                />
              </div>
            )}

            {/* ── PIN Entry ───────────────────────────────────────────────── */}
            {showKeypad && (
              <>
                <PinDots pin={pin} maxLen={PIN_LENGTH} shake={shake} accentColor={accentColor} />
                <Keypad onPress={handlePress} onDelete={handleDelete} />
              </>
            )}

            {/* Security note */}
            <p className="mt-4 text-center text-[10px] text-gray-500 leading-relaxed">
              🔒 SHA-256 hashed · stored in{" "}
              <code className="text-indigo-300">profile_data.xlsx</code>
              {selectedProfile ? ` · row for ${selectedProfile.name}` : ""}
            </p>
          </div>
        </div>

        {/* App name */}
        <p className="text-center text-[10px] text-gray-600 mt-4 font-mono tracking-widest uppercase">
          Nexus Workspace · Multi-User Auth
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
