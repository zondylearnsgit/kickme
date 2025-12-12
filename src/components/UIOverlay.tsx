import React from "react";
import { WeaponType, type ThoughtBubbleState } from "../types";

interface UIOverlayProps {
  health: number;
  weapon: WeaponType;
  setWeapon: (w: WeaponType) => void;
  thought: ThoughtBubbleState | null;
}

const UIOverlay: React.FC<UIOverlayProps> = ({
  health,
  weapon,
  setWeapon,
  thought,
}) => {
  const MAX_HEALTH = 1000;
  const healthPercentage = Math.max(
    0,
    Math.min(100, (health / MAX_HEALTH) * 100)
  );

  // Color bar calculation
  const healthColor =
    healthPercentage > 50
      ? "bg-green-500"
      : healthPercentage > 20
      ? "bg-yellow-500"
      : "bg-red-600";

  return (
    <div className="absolute inset-0 pointer-events-none z-10 flex flex-col justify-between p-4">
      {/* Top: Health Bar */}
      <div className="w-full max-w-md mx-auto mt-4 pointer-events-auto">
        <div className="bg-gray-800/50 p-2 rounded-lg border-2 border-gray-700 backdrop-blur-sm">
          <div className="flex justify-between text-white font-bold text-xs mb-1">
            <span>HEALTH</span>
            <span>
              {health}/{MAX_HEALTH}
            </span>
          </div>
          <div className="w-full bg-gray-900 h-6 rounded-full overflow-hidden border border-gray-600">
            <div
              className={`h-full transition-all duration-200 ease-out ${healthColor}`}
              style={{ width: `${healthPercentage}%` }}
            />
          </div>
        </div>
      </div>

      {/* Thought Bubble Layer */}
      {thought && thought.visible && (
        <div
          className="absolute bg-white px-4 py-2 rounded-2xl border-2 border-black text-black font-bold text-lg animate-bounce shadow-lg"
          style={{
            left: thought.x,
            top: thought.y,
            transform: "translate(-50%, -100%)",
          }}
        >
          {thought.text}
          <div className="absolute bottom-[-8px] left-1/2 -translate-x-1/2 w-4 h-4 bg-white border-r-2 border-b-2 border-black transform rotate-45"></div>
        </div>
      )}

      {/* Bottom: Weapon Selector */}
      <div className="mx-auto mb-8 pointer-events-auto">
        <div className="flex gap-4 bg-amber-900/40 p-4 rounded-full border-2 border-amber-800 backdrop-blur-sm shadow-xl">
          <WeaponButton
            active={weapon === WeaponType.BAT}
            onClick={() => setWeapon(WeaponType.BAT)}
            label="BAT"
            color="bg-orange-500"
            icon="🏏"
          />
          <WeaponButton
            active={weapon === WeaponType.GUN}
            onClick={() => setWeapon(WeaponType.GUN)}
            label="GUN"
            color="bg-gray-700"
            icon="🔫"
          />
          <WeaponButton
            active={weapon === WeaponType.ACID}
            onClick={() => setWeapon(WeaponType.ACID)}
            label="ACID"
            color="bg-green-600"
            icon="🧪"
          />
        </div>
      </div>
    </div>
  );
};

const WeaponButton: React.FC<{
  active: boolean;
  onClick: () => void;
  label: string;
  color: string;
  icon: string;
}> = ({ active, onClick, label, color, icon }) => (
  <button
    onClick={onClick}
    className={`
            w-16 h-16 rounded-full flex flex-col items-center justify-center
            transition-all duration-200 transform hover:scale-110 active:scale-95
            border-4 shadow-lg
            ${
              active
                ? "border-yellow-400 scale-110 ring-2 ring-yellow-200"
                : "border-white/20 opacity-80 hover:opacity-100"
            }
            ${color}
        `}
  >
    <span className="text-2xl filter drop-shadow-md">{icon}</span>
    <span className="text-[10px] font-bold text-white uppercase mt-1 drop-shadow-md">
      {label}
    </span>
  </button>
);

export default UIOverlay;
