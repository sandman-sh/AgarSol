import React from 'react';
import { SKINS } from '../constants';
import { X, Check } from 'lucide-react';

interface SkinModalProps {
  isOpen: boolean;
  onClose: () => void;
  selectedSkinId: string;
  onSelectSkin: (skinId: string) => void;
  darkMode?: boolean;
}

export const SkinModal: React.FC<SkinModalProps> = ({
  isOpen,
  onClose,
  selectedSkinId,
  onSelectSkin,
  darkMode = false,
}) => {
  if (!isOpen) return null;

  return (
    <div
      style={{
        position: 'fixed',
        inset: 0,
        backgroundColor: 'rgba(5, 10, 20, 0.75)',
        backdropFilter: 'blur(8px)',
        WebkitBackdropFilter: 'blur(8px)',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        zIndex: 500,
      }}
      onClick={onClose}
    >
      <div
        className="agar-main-card"
        style={{
          width: '90%',
          maxWidth: 520,
          padding: '24px 28px',
          backgroundColor: darkMode ? '#1e293b' : '#ffffff',
          color: darkMode ? '#f8fafc' : '#1e293b',
          borderRadius: 18,
          boxShadow: '0 24px 60px rgba(0, 0, 0, 0.55), 0 0 30px rgba(0, 230, 118, 0.15)',
          border: darkMode ? '2px solid #334155' : '2px solid #cbd5e1',
        }}
        onClick={(e) => e.stopPropagation()}
      >
        <div
          style={{
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            marginBottom: 20,
            borderBottom: darkMode ? '1px solid rgba(255, 255, 255, 0.1)' : '1px solid #cbd5e1',
            paddingBottom: 12,
          }}
        >
          <div>
            <h2 style={{ fontSize: 22, fontWeight: 800, fontFamily: 'Ubuntu, sans-serif', margin: 0 }}>
              Select Solana Skin
            </h2>
            <p style={{ fontSize: 13, color: '#64748b', margin: '4px 0 0 0' }}>
              Choose your look in the Ephemeral Rollup arena
            </p>
          </div>
          <button
            onClick={onClose}
            className="btn-agar-ghost"
            style={{ padding: '6px', borderRadius: 10, width: 34, height: 34 }}
          >
            <X size={18} />
          </button>
        </div>

        <div
          style={{
            display: 'grid',
            gridTemplateColumns: 'repeat(4, 1fr)',
            gap: 12,
            maxHeight: 340,
            overflowY: 'auto',
            padding: '4px',
          }}
        >
          {SKINS.map((skin) => {
            const isSelected = skin.id === selectedSkinId;
            return (
              <div
                key={skin.id}
                onClick={() => {
                  onSelectSkin(skin.id);
                  onClose();
                }}
                style={{
                  display: 'flex',
                  flexDirection: 'column',
                  alignItems: 'center',
                  padding: '12px 8px',
                  borderRadius: 14,
                  cursor: 'pointer',
                  border: isSelected
                    ? '2px solid #00E676'
                    : darkMode
                    ? '2px solid #334155'
                    : '2px solid #cbd5e1',
                  background: isSelected
                    ? darkMode
                      ? 'rgba(0, 230, 118, 0.15)'
                      : 'rgba(0, 230, 118, 0.1)'
                    : darkMode
                    ? '#0f172a'
                    : '#f8fafc',
                  transition: 'all 0.1s ease',
                  position: 'relative',
                }}
                onMouseEnter={(e) => {
                  if (!isSelected) e.currentTarget.style.transform = 'scale(1.03)';
                }}
                onMouseLeave={(e) => {
                  if (!isSelected) e.currentTarget.style.transform = 'scale(1)';
                }}
              >
                {isSelected && (
                  <div
                    style={{
                      position: 'absolute',
                      top: 4,
                      right: 4,
                      background: '#00E676',
                      borderRadius: 6,
                      width: 16,
                      height: 16,
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      color: '#0b0f19',
                    }}
                  >
                    <Check size={11} strokeWidth={3} />
                  </div>
                )}

                <div
                  style={{
                    width: 50,
                    height: 50,
                    borderRadius: 12,
                    backgroundColor: skin.fill,
                    border: `2px solid ${skin.stroke}`,
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    fontSize: 22,
                    marginBottom: 8,
                  }}
                >
                  {skin.emblem}
                </div>
                <span
                  style={{
                    fontSize: 12,
                    fontWeight: 700,
                    fontFamily: 'Ubuntu, sans-serif',
                    color: isSelected ? '#00E676' : darkMode ? '#e2e8f0' : '#1e293b',
                  }}
                >
                  {skin.name}
                </span>
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
};
