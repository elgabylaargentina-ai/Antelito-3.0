import React from 'react';

interface MascotProps {
  className?: string;
  size?: number;
}

const Mascot: React.FC<MascotProps> = ({ className = "", size = 32 }) => {
  return (
    <div className={`relative flex items-center justify-center ${className}`} style={{ width: size, height: size }}>
      <svg
        viewBox="0 0 100 100"
        fill="none"
        xmlns="http://www.w3.org/2000/svg"
        className="w-full h-full overflow-visible animate-float"
      >
        {/* Shadow */}
        <ellipse cx="50" cy="95" rx="30" ry="5" fill="#000" fillOpacity="0.1" />
        
        {/* Bubble Body - Yellow */}
        <path
          d="M95 50C95 74.8528 74.8528 95 50 95C40.0008 95 30.761 91.7323 23.2 86.2L10 92L16.8 79.8C9.26768 71.239 5 59.5992 5 47C5 22.1472 25.1472 2 50 2C74.8528 2 95 22.1472 95 50Z"
          fill="#FACC15"
          stroke="#EAB308"
          strokeWidth="3"
        />
        
        {/* Eyes with blink animation */}
        <g className="animate-blink">
          <circle cx="35" cy="45" r="6" fill="#1E293B" />
          <circle cx="65" cy="45" r="6" fill="#1E293B" />
        </g>
        
        {/* Smile */}
        <path
          d="M40 65Q50 72 60 65"
          stroke="#1E293B"
          strokeWidth="4"
          strokeLinecap="round"
          fill="none"
        />
        
        {/* Shine/Reflection */}
        <path
          d="M25 25Q35 15 50 20"
          stroke="white"
          strokeWidth="4"
          strokeOpacity="0.6"
          strokeLinecap="round"
          fill="none"
        />
      </svg>
    </div>
  );
};

export default Mascot;