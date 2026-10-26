import React from 'react';

interface TouchControlsProps {
  onSplit: () => void;
  onEject: () => void;
  onCashOut?: () => void;
  inExtractionZone?: boolean;
  isPlaying: boolean;
}

export const TouchControls: React.FC<TouchControlsProps> = ({
  onSplit,
  onEject,
  isPlaying,
}) => {
  if (!isPlaying) return null;

  return (
    <>
      {/* Action Controls (Split & Eject) - Ergonomically positioned for right thumb */}
      <div
        className="agar-touch-controls"
        style={{
          zIndex: 120,
          pointerEvents: 'auto',
        }}
      >
        {/* Split Button */}
        <button
          onTouchStart={(e) => {
            e.preventDefault();
            navigator.vibrate?.(15);
            onSplit();
          }}
          onClick={(e) => {
            e.preventDefault();
            navigator.vibrate?.(15);
            onSplit();
          }}
          className="agar-touch-btn agar-touch-btn-split"
          title="Split cell [Space]"
        >
          <span style={{ fontSize: 16, lineHeight: 1 }}>✂️</span>
          <span style={{ fontSize: 10, marginTop: 1, letterSpacing: 0.5, fontWeight: 800 }}>SPLIT</span>
          <span style={{ fontSize: 8, opacity: 0.75, fontFamily: 'JetBrains Mono, monospace', fontWeight: 700, lineHeight: 1 }}>[SPACE]</span>
        </button>

        {/* Eject Mass Button */}
        <button
          onTouchStart={(e) => {
            e.preventDefault();
            navigator.vibrate?.(10);
            onEject();
          }}
          onClick={(e) => {
            e.preventDefault();
            navigator.vibrate?.(10);
            onEject();
          }}
          className="agar-touch-btn agar-touch-btn-eject"
          title="Eject mass [W]"
        >
          <span style={{ fontSize: 16, lineHeight: 1 }}>🎯</span>
          <span style={{ fontSize: 10, marginTop: 1, letterSpacing: 0.5, fontWeight: 800 }}>EJECT</span>
          <span style={{ fontSize: 8, opacity: 0.75, fontFamily: 'JetBrains Mono, monospace', fontWeight: 700, lineHeight: 1 }}>[W]</span>
        </button>
      </div>
    </>
  );
};
