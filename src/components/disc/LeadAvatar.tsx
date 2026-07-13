import { useState } from "react";

interface Props {
  nome: string;
  profilePicUrl: string | null;
  size?: number;
  ringColor?: string;
}

function initials(name: string): string {
  return name
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((w) => w[0]?.toUpperCase() || "")
    .join("") || "?";
}

export function LeadAvatar({ nome, profilePicUrl, size = 72, ringColor = "#3B82F6" }: Props) {
  const [failed, setFailed] = useState(false);
  const showImg = profilePicUrl && !failed;

  return (
    <div
      className="relative inline-flex items-center justify-center rounded-full"
      style={{
        width: size,
        height: size,
        background: showImg ? "transparent" : ringColor,
        boxShadow: `0 0 0 3px ${ringColor}, 0 0 0 6px rgba(0,0,0,0.4), 0 12px 30px ${ringColor}33`,
      }}
    >
      {showImg ? (
        <img
          src={profilePicUrl as string}
          alt={nome}
          onError={() => setFailed(true)}
          className="w-full h-full object-cover rounded-full"
          referrerPolicy="no-referrer"
        />
      ) : (
        <span
          className="text-white font-bold"
          style={{ fontSize: size * 0.36 }}
        >
          {initials(nome)}
        </span>
      )}
    </div>
  );
}
