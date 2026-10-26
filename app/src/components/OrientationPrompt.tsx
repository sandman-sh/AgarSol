import React, { useState, useEffect } from 'react';
import { Smartphone, Maximize, X } from 'lucide-react';

export const OrientationPrompt: React.FC = () => {
  const [isPortrait, setIsPortrait] = useState(false);
  const [isDismissed, setIsDismissed] = useState(false);

  useEffect(() => {
    const checkOrientation = () => {
      const isMobile = window.innerWidth <= 860 || /Android|iPhone|iPad|iPod/i.test(navigator.userAgent);
      const portrait = window.innerHeight > window.innerWidth;
      setIsPortrait(isMobile && portrait);
    };

    checkOrientation();
    window.addEventListener('resize', checkOrientation);
    window.addEventListener('orientationchange', checkOrientation);
    return () => {
      window.removeEventListener('resize', checkOrientation);
      window.removeEventListener('orientationchange', checkOrientation);
    };
  }, []);

  const handleToggleFullscreen = async () => {
    try {
      if (!document.fullscreenElement) {
        await document.documentElement.requestFullscreen();
        if ('orientation' in screen && 'lock' in (screen.orientation as any)) {
          await (screen.orientation as any).lock('landscape').catch(() => {});
        }
      } else {
        await document.exitFullscreen();
      }
    } catch {
      // Ignored if browser rejects
    }
  };

  if (!isPortrait || isDismissed) return null;

  return (
    <div
      className="agar-tilt-prompt"
      style={{
        position: 'fixed',
        top: 12,
        left: '50%',
        transform: 'translateX(-50%)',
        zIndex: 500,
        backgroundColor: 'rgba(15, 23, 42, 0.94)',
        border: '2px solid #00E676',
        borderRadius: 0,
        padding: '6px 12px',
        display: 'flex',
        alignItems: 'center',
        gap: 8,
        boxShadow: '0 8px 28px rgba(0, 0, 0, 0.65)',
        backdropFilter: 'blur(8px)',
        WebkitBackdropFilter: 'blur(8px)',
        fontFamily: 'Ubuntu, sans-serif',
        fontSize: 12,
        fontWeight: 700,
        color: '#FFFFFF',
        whiteSpace: 'nowrap',
        pointerEvents: 'auto',
      }}
    >
      <Smartphone size={16} style={{ color: '#00E676', transform: 'rotate(-45deg)' }} />
      <span>Tilt device for widescreen map</span>
      <button
        onClick={handleToggleFullscreen}
        style={{
          background: '#00E676',
          border: 'none',
          borderRadius: 0,
          color: '#0b0f19',
          padding: '4px 8px',
          fontWeight: 800,
          fontSize: 11,
          cursor: 'pointer',
          display: 'flex',
          alignItems: 'center',
          gap: 4,
        }}
        title="Enter Fullscreen Widescreen"
      >
        <Maximize size={12} />
        <span>TILT</span>
      </button>
      <button
        onClick={() => setIsDismissed(true)}
        style={{
          background: 'none',
          border: 'none',
          color: '#94a3b8',
          cursor: 'pointer',
          padding: '2px',
          display: 'flex',
          alignItems: 'center',
        }}
        title="Dismiss"
      >
        <X size={14} />
      </button>
    </div>
  );
};
