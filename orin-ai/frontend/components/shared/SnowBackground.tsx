import React from 'react';
import PixelSnow from '../PixelSnow';

interface SnowBackgroundProps {
  children: React.ReactNode;
  color?: string;
  density?: number;
  brightness?: number;
  className?: string;
}

export function SnowBackground({ 
  children, 
  color = "#C7FF3D", 
  density = 0.16, 
  brightness = 1.0,
  className = "" 
}: SnowBackgroundProps) {
  return (
    <div className={`relative min-h-screen w-full overflow-hidden ${className}`}>
      {/* Snow Layer */}
      <div className="absolute inset-0 z-0 pointer-events-none opacity-80 blur-[0.5px]">
        <PixelSnow 
          color={color}
          flakeSize={0.014}
          minFlakeSize={1.0}
          pixelResolution={280}
          speed={0.7}
          density={density}
          direction={135}
          brightness={brightness}
          variant="round"
        />
      </div>

      {/* Content Layer */}
      <div className="relative z-10 w-full h-full">
        {children}
      </div>
    </div>
  );
}
