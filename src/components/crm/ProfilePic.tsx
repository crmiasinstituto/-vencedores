import React, { useState } from 'react';
import { User } from 'lucide-react';

interface ProfilePicProps {
  src?: string | null;
  name?: string;
  size?: number; // tailwind size (8 = w-8 h-8, 10 = w-10 h-10)
}

export const ProfilePic: React.FC<ProfilePicProps> = ({ src, name, size = 10 }) => {
  const [hasError, setHasError] = useState(false);

  const sizeClass = size === 8 ? 'w-8 h-8' : size === 10 ? 'w-10 h-10' : `w-${size} h-${size}`;
  const iconSize = size <= 8 ? 'w-4 h-4' : 'w-5 h-5';

  if (!src || hasError) {
    return (
      <div className={`${sizeClass} rounded-full bg-primary/20 flex items-center justify-center`}>
        <User className={`${iconSize} text-primary`} />
      </div>
    );
  }

  return (
    <img
      src={src}
      alt={name || ''}
      className={`${sizeClass} rounded-full object-cover border-2 border-primary/30`}
      referrerPolicy="no-referrer"
      loading="lazy"
      onError={() => setHasError(true)}
    />
  );
};
