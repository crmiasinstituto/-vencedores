import { useState } from "react";
import { motion } from "framer-motion";

interface Props {
  primeiroNome: string;
  profilePicUrl: string | null;
  rotation: number;
  size: number;
  fresh?: boolean;
  isMember?: boolean;
}

const SQUAAD_PALETTE = ["#3B82F6", "#F59E0B", "#10B981", "#3B82F6", "#8B5CF6", "#EC4899"];

function initials(name: string): string {
  return name
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((w) => w[0]?.toUpperCase() || "")
    .join("") || "?";
}

function colorFor(name: string): string {
  let h = 0;
  for (let i = 0; i < name.length; i++) h = (h * 31 + name.charCodeAt(i)) >>> 0;
  return SQUAAD_PALETTE[h % SQUAAD_PALETTE.length];
}

export function Polaroid({ primeiroNome, profilePicUrl, rotation, size, fresh, isMember }: Props) {
  const [imgFailed, setImgFailed] = useState(false);
  const fallbackColor = colorFor(primeiroNome);

  return (
    <motion.div
      initial={fresh ? { scale: 0, opacity: 0 } : { scale: 1, opacity: 1 }}
      animate={{ scale: 1, opacity: 1, rotate: rotation }}
      transition={{ type: "spring", stiffness: 220, damping: 18 }}
      style={{
        width: size,
        height: size * 1.2,
        boxShadow: isMember
          ? `0 ${size * 0.04}px ${size * 0.18}px rgba(250,200,0,0.55), 0 0 0 ${Math.max(2, size * 0.025)}px #3B82F6`
          : undefined,
      }}
      className={`relative bg-white flex flex-col items-center justify-center p-[6%] ${isMember ? "" : "shadow-xl"}`}
    >
      {/* Selo MENTORADO no canto superior direito */}
      {isMember && (
        <div
          className="absolute z-10 font-black uppercase tracking-wider text-black bg-[#3B82F6]"
          style={{
            top: size * 0.06,
            right: -size * 0.06,
            transform: "rotate(8deg)",
            padding: `${size * 0.018}px ${size * 0.06}px`,
            fontSize: size * 0.075,
            fontFamily: "'Space Grotesk', system-ui, sans-serif",
            boxShadow: `0 ${size * 0.02}px ${size * 0.08}px rgba(0,0,0,0.3)`,
            border: `${Math.max(1, size * 0.008)}px solid #000`,
          }}
        >
          MENTORADO
        </div>
      )}
      <div
        className="relative w-full flex-1 overflow-hidden rounded-sm"
        style={{ aspectRatio: "1" }}
      >
        {profilePicUrl && !imgFailed ? (
          <img
            src={profilePicUrl}
            alt={primeiroNome}
            className="w-full h-full object-cover"
            onError={() => setImgFailed(true)}
            loading="lazy"
          />
        ) : (
          <div
            className="w-full h-full flex items-center justify-center text-white font-bold"
            style={{ background: fallbackColor, fontSize: size * 0.3 }}
          >
            {initials(primeiroNome)}
          </div>
        )}
        {fresh && (
          <motion.div
            initial={{ opacity: 0.9 }}
            animate={{ opacity: 0 }}
            transition={{ duration: 0.5, delay: 0.2 }}
            className="absolute inset-0 bg-white pointer-events-none"
          />
        )}
      </div>
      <div
        className="text-black text-center mt-[5%] font-bold leading-none"
        style={{
          fontSize: size * 0.13,
          fontFamily: "'Caveat', 'Permanent Marker', cursive, system-ui",
        }}
      >
        {primeiroNome}
      </div>
    </motion.div>
  );
}
