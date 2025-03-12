"use client";

import React, { useState } from 'react';

interface ProfileImageProps {
  src: string;
  alt: string;
  className?: string;
}

export default function ProfileImage({ src, alt, className = "w-16 h-16 rounded-full" }: ProfileImageProps) {
  const [error, setError] = useState(false);
  
  // Fallback for when the image fails to load
  const fallbackImage = (
    <div className={`${className} bg-blue-100 flex items-center justify-center text-blue-500`}>
      {alt.charAt(0).toUpperCase()}
    </div>
  );
  
  if (error || !src) {
    return fallbackImage;
  }
  
  return (
    <img 
      src={src} 
      alt={alt}
      className={className}
      onError={() => setError(true)}
    />
  );
} 