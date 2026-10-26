import React, { useEffect } from 'react';
import { Skull, RotateCcw, Eye, Menu } from 'lucide-react';

interface GameOverModalProps {
  isOpen: boolean;
  killerName: string;
  finalMass: number;
  kills: number;
  survivalTimeSec: number;
  solValue?: number;
  initialDeposit: number;
  onPlayAgain: () => void;
  onSpectate: () => void;
  onOpenMenu: () => void;
  darkMode?: boolean;
}

export const GameOverModal: React.FC<GameOverModalProps> = ({
  isOpen,
  killerName,
  finalMass,
  kills,
  survivalTimeSec,
  initialDeposit,
  onPlayAgain,
  onSpectate,
  onOpenMenu,
  darkMode = false,
}) => {
  // Listen for Space or Enter to quickly respawn
  useEffect(() => {
    if (!isOpen) return;
    const handleKey = (e: KeyboardEvent) => {
      if (e.code === 'Space' || e.code === 'Enter') {
        e.preventDefault();
        onPlayAgain();
      }
    };
    window.addEventListener('keydown', handleKey);
    return () => window.removeEventListener('keydown', handleKey);
  }, [isOpen, onPlayAgain]);

  if (!isOpen) return null;

  const minutes = Math.floor(survivalTimeSec / 60);
  const seconds = survivalTimeSec % 60;
  const timeFormatted = `${minutes}:${seconds < 10 ? '0' : ''}${seconds}`;

  return (
    <div
      className="agar-gameover-overlay"
      style={{
        position: 'fixed',
        inset: 0,
        backgroundColor: 'rgba(5, 10, 20, 0.82)',
        backdropFilter: 'blur(10px)',
        WebkitBackdropFilter: 'blur(10px)',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        overflowY: 'auto',
        WebkitOverflowScrolling: 'touch',
        touchAction: 'pan-y',
        zIndex: 450,
        padding: '12px 10px',
      }}
    >
      <div
        className="agar-main-card agar-gameover-card"
        style={{
          width: '100%',
          maxWidth: 480,
          margin: 'auto',
          backgroundColor: darkMode ? '#1e293b' : '#ffffff',
          color: darkMode ? '#f8fafc' : '#1e293b',
          borderRadius: 18,
          border: '2px solid #ef4444',
          boxShadow: '0 25px 70px rgba(0, 0, 0, 0.7), 0 0 35px rgba(239, 68, 68, 0.25)',
          animation: 'modalPop 0.22s cubic-bezier(0.34, 1.56, 0.64, 1)',
        }}
      >
        <div className="agar-gameover-grid">
          {/* Left Column (Header + Stats) */}
          <div className="agar-gameover-col-left">
            {/* Header: Skull + Title */}
            <div className="agar-gameover-header">
              <div
                className="agar-gameover-skull-badge"
                style={{
                  width: 50,
                  height: 50,
                  borderRadius: 12,
                  background: '#EF4444',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  color: '#FFFFFF',
                  flexShrink: 0,
                  boxShadow: '0 4px 14px rgba(239, 68, 68, 0.4)',
                }}
              >
                <Skull size={26} />
              </div>

              <div className="agar-gameover-title-box">
                <h2
                  className="agar-gameover-title"
                  style={{
                    fontSize: 22,
                    fontWeight: 800,
                    fontFamily: 'Ubuntu, sans-serif',
                    margin: 0,
                    color: '#EF4444',
                    letterSpacing: 0.5,
                    lineHeight: 1.1,
                  }}
                >
                  YOU WERE CONSUMED!
                </h2>

                <p
                  className="agar-gameover-subtitle"
                  style={{
                    fontSize: 13,
                    fontWeight: 600,
                    color: darkMode ? '#94a3b8' : '#64748b',
                    margin: '3px 0 0',
                    fontFamily: 'Ubuntu, sans-serif',
                  }}
                >
                  Absorbed by <span style={{ color: '#F59E0B', fontWeight: 700 }}>{killerName || 'a rival blob'}</span>
                </p>
              </div>
            </div>

            {/* Stats Grid */}
            <div className="agar-gameover-stats">
              <div
                className="agar-gameover-stat-box"
                style={{
                  background: darkMode ? '#0f172a' : '#f1f5f9',
                  borderRadius: 10,
                  padding: '8px 6px',
                  border: darkMode ? '2px solid #334155' : '2px solid #cbd5e1',
                  textAlign: 'center',
                }}
              >
                <span style={{ fontSize: 10, color: '#64748b', display: 'block', fontWeight: 700 }}>PEAK MASS</span>
                <span
                  style={{
                    fontSize: 16,
                    fontWeight: 800,
                    color: '#3B82F6',
                    fontFamily: 'JetBrains Mono, monospace',
                    marginTop: 2,
                    display: 'block',
                  }}
                >
                  {Math.floor(finalMass)}
                </span>
              </div>

              <div
                className="agar-gameover-stat-box"
                style={{
                  background: darkMode ? '#0f172a' : '#f1f5f9',
                  borderRadius: 10,
                  padding: '8px 6px',
                  border: darkMode ? '2px solid #334155' : '2px solid #cbd5e1',
                  textAlign: 'center',
                }}
              >
                <span style={{ fontSize: 10, color: '#64748b', display: 'block', fontWeight: 700 }}>KILLS</span>
                <span
                  style={{
                    fontSize: 16,
                    fontWeight: 800,
                    color: '#EF4444',
                    fontFamily: 'JetBrains Mono, monospace',
                    marginTop: 2,
                    display: 'block',
                  }}
                >
                  {kills}
                </span>
              </div>

              <div
                className="agar-gameover-stat-box"
                style={{
                  background: darkMode ? '#0f172a' : '#f1f5f9',
                  borderRadius: 10,
                  padding: '8px 6px',
                  border: darkMode ? '2px solid #334155' : '2px solid #cbd5e1',
                  textAlign: 'center',
                }}
              >
                <span style={{ fontSize: 10, color: '#64748b', display: 'block', fontWeight: 700 }}>SURVIVED</span>
                <span
                  style={{
                    fontSize: 16,
                    fontWeight: 800,
                    color: '#00E676',
                    fontFamily: 'JetBrains Mono, monospace',
                    marginTop: 2,
                    display: 'block',
                  }}
                >
                  {timeFormatted}
                </span>
              </div>
            </div>

            {/* Stake outcome notice */}
            {initialDeposit > 0 && (
              <div
                className="agar-gameover-stake-alert"
                style={{
                  background: darkMode ? 'rgba(239, 68, 68, 0.1)' : '#fef2f2',
                  border: '2px solid #EF4444',
                  borderRadius: 10,
                  padding: '6px 12px',
                  margin: '8px 0',
                  fontSize: 11,
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'space-between',
                }}
              >
                <span style={{ color: '#EF4444', fontWeight: 600 }}>Stake Outcome:</span>
                <span style={{ fontFamily: 'JetBrains Mono, monospace', fontWeight: 700, color: '#EF4444' }}>
                  -{initialDeposit.toFixed(3)} SOL sent to Treasury
                </span>
              </div>
            )}
          </div>

          {/* Right Column (Ergonomic Right-Thumb Action Buttons) */}
          <div className="agar-gameover-col-right">
            <button
              onClick={onPlayAgain}
              className="btn-agar-play agar-gameover-btn-play"
              style={{
                width: '100%',
                fontSize: 15,
                padding: '12px',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                gap: 8,
              }}
            >
              <RotateCcw size={18} />
              <span>{initialDeposit > 0 ? `RE-STAKE & PLAY (${initialDeposit} SOL)` : 'PLAY AGAIN'}</span>
            </button>

            <div className="agar-gameover-sub-actions" style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8 }}>
              <button
                onClick={onSpectate}
                className="btn-agar-ghost"
                style={{ fontWeight: 700, display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 6, minHeight: 40 }}
              >
                <Eye size={15} />
                <span>SPECTATE</span>
              </button>

              <button
                onClick={onOpenMenu}
                className="btn-agar-ghost"
                style={{ fontWeight: 700, display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 6, minHeight: 40 }}
              >
                <Menu size={15} />
                <span>MAIN MENU</span>
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};
