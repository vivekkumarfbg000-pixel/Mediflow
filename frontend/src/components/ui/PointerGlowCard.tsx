import React, { useRef, useState } from 'react';

interface PointerGlowCardProps {
  children: React.ReactNode;
  className?: string; // styles for the inner card (bg, padding, etc)
  containerClassName?: string; // styles for the outer card border wrapper
  onClick?: () => void;
  title?: string;
}

export const PointerGlowCard: React.FC<PointerGlowCardProps> = ({ 
  children, 
  className = '',
  containerClassName = '',
  onClick,
  title
}) => {
  const cardRef = useRef<HTMLDivElement>(null);
  const [coords, setCoords] = useState({ x: 0, y: 0 });

  const handleMouseMove = (e: React.MouseEvent<HTMLDivElement>) => {
    if (!cardRef.current) return;
    const rect = cardRef.current.getBoundingClientRect();
    setCoords({
      x: e.clientX - rect.left,
      y: e.clientY - rect.top,
    });
  };

  return (
    <div
      ref={cardRef}
      onMouseMove={handleMouseMove}
      onClick={onClick}
      title={title}
      className={`pointer-glow-card ${containerClassName}`}
      style={{
        // @ts-expect-error Custom CSS variables on React.CSSProperties
        '--mouse-x': `${coords.x}px`,
        // @ts-expect-error Custom CSS variables on React.CSSProperties
        '--mouse-y': `${coords.y}px`,
      } as React.CSSProperties}
    >
      <div className={`pointer-glow-inner ${className}`}>
        {children}
      </div>
    </div>
  );
};
