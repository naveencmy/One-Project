import React, { useState } from "react";
import { Users, ChevronRight, ShieldOff, Loader2 } from "lucide-react";

// ── ProfilePicker — "Who are you?" step ────────────────────────────────────────
export const ProfilePicker = ({ profiles = [], onSelect, isLoading }) => {
  const [hoveredId, setHoveredId] = useState(null);

  if (isLoading) {
    return (
      <div className="flex flex-col items-center justify-center gap-3 py-12">
        <Loader2 className="w-8 h-8 text-[#5E6AD2] animate-spin" />
        <span className="text-xs text-gray-400 font-mono">Loading profiles...</span>
      </div>
    );
  }

  if (!profiles || profiles.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center gap-3 py-10 text-gray-500">
        <ShieldOff className="w-10 h-10 opacity-40" />
        <p className="text-xs text-center leading-relaxed max-w-[200px]">
          No profiles found.<br />Contact your Team Lead to set up access.
        </p>
      </div>
    );
  }

  return (
    <div className="w-full space-y-2">
      {/* Header */}
      <div className="flex items-center gap-2 mb-4">
        <Users className="w-4 h-4 text-[#5E6AD2]" />
        <span className="text-xs font-semibold text-gray-300 uppercase tracking-wider">Select Your Profile</span>
      </div>

      {/* Profile Cards */}
      <div className="space-y-2 max-h-[320px] overflow-y-auto pr-0.5">
        {profiles.map((profile) => {
          const isHovered = hoveredId === profile.profile_id;
          const initials = (profile.name || '?')
            .split(' ')
            .map(w => w[0])
            .join('')
            .toUpperCase()
            .slice(0, 2);

          const accentColor = profile.accentColor || '#5E6AD2';

          return (
            <button
              key={profile.profile_id}
              type="button"
              onClick={() => onSelect(profile)}
              onMouseEnter={() => setHoveredId(profile.profile_id)}
              onMouseLeave={() => setHoveredId(null)}
              className={`w-full flex items-center gap-3 p-3 rounded-xl border transition-all duration-200 text-left group
                ${isHovered
                  ? 'bg-[#1E1E28] border-[#5E6AD2]/50 shadow-lg shadow-[#5E6AD2]/10'
                  : 'bg-[#161618] border-[#262630] hover:border-[#5E6AD2]/30'
                }`}
            >
              {/* Avatar */}
              <div className="relative shrink-0">
                {profile.avatar ? (
                  <img
                    src={profile.avatar}
                    alt={profile.name}
                    className="w-10 h-10 rounded-full object-cover border-2 transition-all duration-200"
                    style={{ borderColor: isHovered ? accentColor : 'transparent' }}
                    onError={(e) => { e.target.style.display = 'none'; e.target.nextSibling.style.display = 'flex'; }}
                  />
                ) : null}
                <div
                  className={`w-10 h-10 rounded-full flex items-center justify-center text-sm font-bold text-white border-2 transition-all duration-200 ${profile.avatar ? 'hidden' : 'flex'}`}
                  style={{
                    backgroundColor: `${accentColor}25`,
                    borderColor: isHovered ? accentColor : 'transparent',
                    color: accentColor,
                  }}
                >
                  {initials}
                </div>
                {/* Online indicator */}
                <span
                  className="absolute -bottom-0.5 -right-0.5 w-3 h-3 rounded-full border-2 border-[#111114]"
                  style={{ backgroundColor: profile.hasPin ? '#10B981' : '#6B7280' }}
                />
              </div>

              {/* Info */}
              <div className="flex-1 min-w-0">
                <div className="text-sm font-semibold text-white truncate">{profile.name || 'Unnamed'}</div>
                <div className="text-[11px] text-gray-400 truncate flex items-center gap-1">
                  <span
                    className="inline-block w-1.5 h-1.5 rounded-full shrink-0"
                    style={{ backgroundColor: accentColor }}
                  />
                  {profile.role || 'Member'}
                  {profile.department ? ` · ${profile.department}` : ''}
                </div>
              </div>

              {/* Arrow */}
              <ChevronRight
                className={`w-4 h-4 shrink-0 transition-all duration-200 ${
                  isHovered ? 'text-[#5E6AD2] translate-x-0.5' : 'text-gray-600'
                }`}
              />
            </button>
          );
        })}
      </div>

      <p className="text-center text-[10px] text-gray-600 mt-3 leading-relaxed">
        Select your name to continue to PIN verification
      </p>
    </div>
  );
};
