import React from 'react';
import { Zap, Menu, DollarSign, Lock } from 'lucide-react';

interface NavbarProps {
  erLatency: number;
  playerMass: number;
  kills: number;
  solValue: number;
  isPlaying: boolean;
  isSpectating: boolean;
  walletAddress: string | null;
  roomId?: string;
  inExtractionZone?: boolean;
  onRequireZone?: () => void;
  onOpenCashOut: () => void;
  onOpenMenu: () => void;
  onToggleWallet: () => void;
}

export const Navbar: React.FC<NavbarProps> = ({
  erLatency,
  playerMass,
  kills,
  solValue,
  isPlaying,
  isSpectating,
  roomId = 'global',
  inExtractionZone = false,
  onRequireZone,
  onOpenCashOut,
  onOpenMenu,
}) => {
  const isPrivate = roomId !== 'global';

  return (
    <>
      {/* Top Left: Minimalist Flat Square Logo + ER Latency + Room */}
      <div
        style={{
          position: 'absolute',
          top: 14,
          left: 14,
          display: 'flex',
          alignItems: 'center',
          gap: 6,
          zIndex: 80,
          pointerEvents: 'auto',
          flexWrap: 'wrap',
          maxWidth: 'calc(100vw - 220px)',
        }}
      >
        <button
          onClick={onOpenMenu}
          style={{
            background: '#1e293b',
            border: '2px solid #334155',
            borderRadius: 0,
            padding: '6px 12px',
            color: '#FFFFFF',
            fontFamily: 'Ubuntu, sans-serif',
            fontWeight: 700,
            fontSize: 12,
            cursor: 'pointer',
            display: 'flex',
            alignItems: 'center',
            gap: 6,
          }}
          title="Open Menu [ESC]"
        >
          <Menu size={15} />
          <span>MENU</span>
        </button>

        <div
          className="pulse-badge er-active"
          style={{
            background: '#1e293b',
            border: '2px solid #00E676',
            borderRadius: 0,
            padding: '5px 10px',
            fontSize: 10,
            color: '#00E676',
            fontFamily: 'JetBrains Mono, monospace',
          }}
          title="MagicBlock Ephemeral Rollup connection active"
        >
          <Zap size={11} style={{ fill: '#00E676' }} />
          <span>{erLatency > 0 ? `${erLatency}ms` : '14ms'}</span>
        </div>

        {isPrivate && (
          <div
            style={{
              background: '#0f172a',
              border: '2px solid #9945FF',
              borderRadius: 0,
              padding: '5px 10px',
              fontSize: 10,
              color: '#C084FC',
              fontFamily: 'JetBrains Mono, monospace',
              fontWeight: 700,
            }}
            title={`Private Room: ${roomId}`}
          >
            🔒 {roomId}
          </div>
        )}
      </div>

      {/* Spectator Mode Banner (Flat Square & Tap to Play) */}
      {isSpectating && (
        <div
          onClick={onOpenMenu}
          style={{
            position: 'absolute',
            top: 14,
            left: '50%',
            transform: 'translateX(-50%)',
            backgroundColor: '#0f172a',
            border: '2px solid #3b82f6',
            borderRadius: 0,
            padding: '6px 14px',
            color: '#38bdf8',
            fontSize: 12,
            fontWeight: 700,
            fontFamily: 'Ubuntu, sans-serif',
            zIndex: 85,
            display: 'flex',
            alignItems: 'center',
            gap: 6,
            whiteSpace: 'nowrap',
            cursor: 'pointer',
          }}
          title="Click to open menu and play"
        >
          <span>👀 SPECTATING</span>
          <span style={{ color: '#94a3b8', fontSize: 10 }}>• Tap to Play</span>
        </div>
      )}

      {/* Bottom Left: Classic In-Game Score & Equity Counter (Flat Square & Responsive) */}
      {isPlaying && (
        <div
          className="agar-hud-counter"
          style={{
            position: 'absolute',
            bottom: 16,
            left: 14,
            backgroundColor: '#0f172a',
            border: '2px solid #334155',
            borderRadius: 0,
            padding: '6px 12px',
            color: '#FFFFFF',
            fontFamily: 'Ubuntu, sans-serif',
            fontSize: 12,
            zIndex: 85,
            display: 'flex',
            alignItems: 'center',
            gap: 10,
            boxShadow: '0 4px 16px rgba(0, 0, 0, 0.4)',
            maxWidth: 'calc(100vw - 120px)',
            overflowX: 'auto',
          }}
        >
          <div>
            <span style={{ color: '#94a3b8', fontSize: 10, display: 'block', fontWeight: 700 }}>MASS</span>
            <span style={{ fontSize: 14, fontWeight: 700, fontFamily: 'JetBrains Mono, monospace' }}>
              {Math.floor(playerMass)}
            </span>
          </div>

          <div style={{ width: 1, height: 20, backgroundColor: 'rgba(255, 255, 255, 0.15)' }} />

          <div>
            <span style={{ color: '#94a3b8', fontSize: 10, display: 'block', fontWeight: 700 }}>KILLS</span>
            <span style={{ fontSize: 14, fontWeight: 700, color: '#EF4444', fontFamily: 'JetBrains Mono, monospace' }}>
              {kills}
            </span>
          </div>

          <div style={{ width: 1, height: 20, backgroundColor: 'rgba(255, 255, 255, 0.15)' }} className="hud-desktop-only" />

          <div className="hud-desktop-only">
            <span style={{ color: '#94a3b8', fontSize: 10, display: 'block', fontWeight: 700 }}>SOL</span>
            <span style={{ fontSize: 14, fontWeight: 700, color: '#00E676', fontFamily: 'JetBrains Mono, monospace' }}>
              {solValue.toFixed(3)}
            </span>
          </div>

          <div style={{ width: 1, height: 20, backgroundColor: 'rgba(255, 255, 255, 0.15)' }} />

          <button
            onClick={() => {
              if (inExtractionZone) {
                onOpenCashOut();
              } else {
                onRequireZone?.();
              }
            }}
            style={{
              background: inExtractionZone ? '#00E676' : 'rgba(30, 41, 59, 0.85)',
              border: inExtractionZone ? '2px solid #00C853' : '2px solid #475569',
              borderRadius: 6,
              color: inExtractionZone ? '#0b0f19' : '#94a3b8',
              fontFamily: 'Ubuntu, sans-serif',
              fontWeight: 800,
              fontSize: 11,
              padding: '5px 10px',
              cursor: 'pointer',
              display: 'flex',
              alignItems: 'center',
              gap: 4,
              whiteSpace: 'nowrap',
              boxShadow: inExtractionZone ? '0 0 16px rgba(0, 230, 118, 0.5)' : 'none',
              transition: 'all 0.2s ease',
            }}
            title={inExtractionZone ? 'Settle SOL to Wallet [E]' : 'Enter an Extraction Vortex in map corners to cash out'}
          >
            {inExtractionZone ? <DollarSign size={13} /> : <Lock size={12} />}
            <span>{inExtractionZone ? 'CASH OUT [E]' : 'VORTEX NEEDED'}</span>
          </button>
        </div>
      )}
    </>
  );
};

