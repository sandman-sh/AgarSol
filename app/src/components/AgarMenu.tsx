import React, { useState } from 'react';
import { SKINS } from '../constants';
import { SkinModal } from './SkinModal';
import {
  Zap,
  ChevronLeft,
  ChevronRight,
  Dices,
  Sparkles,
  Wallet,
  Eye,
  Sliders,
  Moon,
  Sun,
  Volume2,
  VolumeX,
  Users,
  Copy,
  Check,
  Plus,
  LogIn,
  LogOut,
  Globe,
  Lock,
} from 'lucide-react';
import { generateUnguessableRoomId, getRoomInviteUrl } from '../utils/supabase';
import { generateRandomGuestNick, saveNicknameForWallet } from '../utils/wallet';

interface AgarMenuProps {
  isOpen: boolean;
  playerName: string;
  onPlayerNameChange: (name: string) => void;
  selectedSkinId: string;
  onSelectSkin: (skinId: string) => void;
  selectedStake: number;
  onSelectStake: (stake: number) => void;
  onPlayGuest: () => void;
  onPlayWallet: () => void;
  onSpectate: () => void;
  connectedWallet: {
    isConnected: boolean;
    publicKey: string | null;
    balance: number;
    walletName: string | null;
  };
  onConnectWallet: () => void;
  onDisconnectWallet: () => void;
  isConnectingWallet: boolean;
  currentRoomId: string;
  onChangeRoom: (roomId: string) => void;
  erLatency: number;
  darkMode: boolean;
  onToggleDarkMode: () => void;
  showMass: boolean;
  onToggleShowMass: () => void;
  soundEnabled: boolean;
  onToggleSound: () => void;
  onRequestAirdrop?: () => void;
  isRequestingAirdrop?: boolean;
  isTransacting?: boolean;
}

export const AgarMenu: React.FC<AgarMenuProps> = ({
  isOpen,
  playerName,
  onPlayerNameChange,
  selectedSkinId,
  onSelectSkin,
  selectedStake,
  onSelectStake,
  onPlayGuest,
  onPlayWallet,
  onSpectate,
  connectedWallet,
  onConnectWallet,
  onDisconnectWallet,
  isConnectingWallet,
  currentRoomId,
  onChangeRoom,
  erLatency,
  darkMode,
  onToggleDarkMode,
  showMass,
  onToggleShowMass,
  soundEnabled,
  onToggleSound,
  onRequestAirdrop,
  isRequestingAirdrop,
  isTransacting,
}) => {
  const [isSkinModalOpen, setIsSkinModalOpen] = useState(false);
  const [activeMobileTab, setActiveMobileTab] = useState<'play' | 'rooms' | 'settings'>('play');
  const [joinInputCode, setJoinInputCode] = useState('');
  const [copiedInvite, setCopiedInvite] = useState(false);
  const [copyFeedback, setCopyFeedback] = useState<string | null>(null);

  if (!isOpen) return null;

  const currentSkinIndex = SKINS.findIndex((s) => s.id === selectedSkinId);
  const activeSkin = SKINS[currentSkinIndex >= 0 ? currentSkinIndex : 0];

  const prevSkin = () => {
    const nextIdx = (currentSkinIndex - 1 + SKINS.length) % SKINS.length;
    onSelectSkin(SKINS[nextIdx].id);
  };

  const nextSkin = () => {
    const nextIdx = (currentSkinIndex + 1) % SKINS.length;
    onSelectSkin(SKINS[nextIdx].id);
  };

  const handleRandomizeNick = () => {
    const r = generateRandomGuestNick();
    onPlayerNameChange(r);
    if (connectedWallet.publicKey) {
      saveNicknameForWallet(connectedWallet.publicKey, r);
    }
  };

  const handleNameInput = (name: string) => {
    onPlayerNameChange(name);
    if (connectedWallet.publicKey) {
      saveNicknameForWallet(connectedWallet.publicKey, name);
    }
  };

  // Create an isolated unguessable private room
  const handleCreatePrivateRoom = () => {
    const newRoomId = generateUnguessableRoomId();
    onChangeRoom(newRoomId);
    const inviteUrl = getRoomInviteUrl(newRoomId);
    navigator.clipboard?.writeText(inviteUrl).catch(() => {});
    setCopiedInvite(true);
    setCopyFeedback('Private room created & invite link copied!');
    setTimeout(() => {
      setCopiedInvite(false);
      setCopyFeedback(null);
    }, 3500);
  };

  const handleCopyCurrentLink = () => {
    const inviteUrl = getRoomInviteUrl(currentRoomId);
    navigator.clipboard?.writeText(inviteUrl).catch(() => {});
    setCopiedInvite(true);
    setCopyFeedback('Invite link copied to clipboard!');
    setTimeout(() => {
      setCopiedInvite(false);
      setCopyFeedback(null);
    }, 3000);
  };

  const handleJoinByInput = () => {
    let clean = joinInputCode.trim();
    if (!clean) return;
    try {
      if (clean.includes('room=')) {
        const url = new URL(clean);
        const r = url.searchParams.get('room');
        if (r) clean = r;
      }
    } catch {
      // Direct string code
    }
    onChangeRoom(clean);
    setJoinInputCode('');
    setCopyFeedback(`Joined room: ${clean}`);
    setTimeout(() => setCopyFeedback(null), 3000);
  };

  const isPrivateRoom = currentRoomId !== 'global';

  return (
    <div
      className="agar-menu-overlay"
      style={{
        backgroundColor: darkMode ? 'rgba(10, 15, 29, 0.78)' : 'rgba(235, 245, 255, 0.72)',
      }}
    >
      <div className="agar-menu-container">
        {/* =================================================================
            FEEDBACK TOAST
           ================================================================= */}
        {copyFeedback && (
          <div
            style={{
              position: 'fixed',
              top: 20,
              backgroundColor: '#00E676',
              color: '#0b0f19',
              padding: '10px 20px',
              borderRadius: 0,
              fontFamily: 'Ubuntu, sans-serif',
              fontWeight: 800,
              fontSize: 13,
              boxShadow: '0 8px 24px rgba(0, 230, 118, 0.4)',
              zIndex: 400,
              display: 'flex',
              alignItems: 'center',
              gap: 8,
              border: '2px solid #00C853',
            }}
          >
            <Check size={16} />
            <span>{copyFeedback}</span>
          </div>
        )}

        {/* =================================================================
            AUTHENTIC BUBBLY AGAR.IO / AGAR.SOL LOGO
           ================================================================= */}
        <div className="agar-menu-header" style={{ textAlign: 'center', marginBottom: 14 }}>
          <div className="agar-logo-container">
            <span className="agar-logo-letter agar-letter-blue">a</span>
            <span className="agar-logo-letter agar-letter-red">g</span>
            <span className="agar-logo-letter agar-letter-yellow">a</span>
            <span className="agar-logo-letter agar-letter-blue">r</span>
            <span className="agar-logo-letter agar-letter-dot">.</span>
            <span className="agar-logo-letter agar-letter-green">s</span>
            <span className="agar-logo-letter agar-letter-purple">o</span>
            <span className="agar-logo-letter agar-letter-cyan">l</span>
          </div>
          <div
            className="agar-er-badge"
            style={{
              display: 'inline-flex',
              alignItems: 'center',
              gap: 8,
              backgroundColor: darkMode ? '#1e293b' : '#f1f5f9',
              border: '2px solid #00E676',
              borderRadius: 0,
              padding: '5px 14px',
              fontSize: 11,
              color: '#00E676',
              fontFamily: 'JetBrains Mono, monospace',
              fontWeight: 700,
            }}
          >
            <Zap size={12} style={{ fill: '#00E676' }} />
            <span>MAGICBLOCK EPHEMERAL ROLLUP • {erLatency > 0 ? `${erLatency}ms` : '14ms'} • ZERO GAS</span>
          </div>
        </div>

      {/* =================================================================
          MOBILE NAVIGATION TABS (< 860px)
         ================================================================= */}
      <div className="agar-mobile-tabs-bar">
        <button
          onClick={() => setActiveMobileTab('play')}
          className={`agar-mobile-tab-btn ${activeMobileTab === 'play' ? 'active' : ''}`}
        >
          🎮 PLAY
        </button>
        <button
          onClick={() => setActiveMobileTab('rooms')}
          className={`agar-mobile-tab-btn ${activeMobileTab === 'rooms' ? 'active' : ''}`}
        >
          👥 ROOMS {isPrivateRoom && '🔒'}
        </button>
        <button
          onClick={() => setActiveMobileTab('settings')}
          className={`agar-mobile-tab-btn ${activeMobileTab === 'settings' ? 'active' : ''}`}
        >
          ⚙️ SETTINGS
        </button>
      </div>

      {/* =================================================================
          MAIN CONTENT CONTAINER (3 Balanced Columns on Desktop)
         ================================================================= */}
      <div
        className="agar-menu-content-wrapper"
        style={{
          display: 'flex',
          flexDirection: 'row',
          alignItems: 'stretch',
          justifyContent: 'center',
          gap: 16,
          width: '100%',
          maxWidth: 980,
        }}
      >
        {/* ===============================================================
            LEFT PANEL: Controls & Settings
           =============================================================== */}
        <div
          className={`agar-side-card agar-menu-panel-left ${
            activeMobileTab === 'settings' ? 'mobile-visible' : 'mobile-hidden'
          }`}
          style={{
            flex: '0 0 260px',
            width: 260,
            padding: '20px 18px',
            display: 'flex',
            flexDirection: 'column',
            justifyContent: 'space-between',
            backgroundColor: darkMode ? '#1e293b' : '#ffffff',
            color: darkMode ? '#f8fafc' : '#1e293b',
          }}
        >
          <div>
            <div
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: 8,
                fontSize: 13,
                fontWeight: 700,
                textTransform: 'uppercase',
                letterSpacing: 0.5,
                color: darkMode ? '#cbd5e1' : '#475569',
                marginBottom: 12,
                borderBottom: darkMode ? '1px solid rgba(255,255,255,0.08)' : '1px solid #e2e8f0',
                paddingBottom: 8,
              }}
            >
              <Sliders size={16} />
              <span>How To Play</span>
            </div>

            <div
              style={{
                display: 'flex',
                flexDirection: 'column',
                gap: 9,
                fontSize: 12,
                fontFamily: 'Ubuntu, sans-serif',
                color: darkMode ? '#94a3b8' : '#64748b',
                marginBottom: 18,
              }}
            >
              <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                <span style={{ fontWeight: 700, color: darkMode ? '#38bdf8' : '#0284c7' }}>📱 Touch / Mouse:</span>
                <span>Steer blob</span>
              </div>
              <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                <span style={{ fontWeight: 700, color: '#00E676' }}>✂️ [Space] / Split:</span>
                <span>Split blob in 2</span>
              </div>
              <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                <span style={{ fontWeight: 700, color: '#f59e0b' }}>🎯 [W] / Eject:</span>
                <span>Eject mass / Feed</span>
              </div>
              <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                <span style={{ fontWeight: 700, color: '#9945FF' }}>⚡ [E] / Cash Out:</span>
                <span>Settle SOL at Vortex</span>
              </div>
            </div>

            <div
              style={{
                fontSize: 13,
                fontWeight: 700,
                textTransform: 'uppercase',
                letterSpacing: 0.5,
                color: darkMode ? '#cbd5e1' : '#475569',
                marginBottom: 10,
                borderBottom: darkMode ? '1px solid rgba(255,255,255,0.08)' : '1px solid #e2e8f0',
                paddingBottom: 6,
              }}
            >
              Game Preferences
            </div>

            <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
              <label
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'space-between',
                  cursor: 'pointer',
                  fontSize: 12,
                  fontWeight: 600,
                }}
              >
                <span style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                  {darkMode ? <Moon size={14} /> : <Sun size={14} />}
                  <span>Dark Theme</span>
                </span>
                <input
                  type="checkbox"
                  checked={darkMode}
                  onChange={onToggleDarkMode}
                  style={{ width: 16, height: 16, accentColor: '#00E676', cursor: 'pointer' }}
                />
              </label>

              <label
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'space-between',
                  cursor: 'pointer',
                  fontSize: 12,
                  fontWeight: 600,
                }}
              >
                <span>Show Mass Numbers</span>
                <input
                  type="checkbox"
                  checked={showMass}
                  onChange={onToggleShowMass}
                  style={{ width: 16, height: 16, accentColor: '#00E676', cursor: 'pointer' }}
                />
              </label>

              <label
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'space-between',
                  cursor: 'pointer',
                  fontSize: 12,
                  fontWeight: 600,
                }}
              >
                <span style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                  {soundEnabled ? <Volume2 size={14} /> : <VolumeX size={14} />}
                  <span>Sound FX</span>
                </span>
                <input
                  type="checkbox"
                  checked={soundEnabled}
                  onChange={onToggleSound}
                  style={{ width: 16, height: 16, accentColor: '#00E676', cursor: 'pointer' }}
                />
              </label>
            </div>
          </div>

          <div
            style={{
              paddingTop: 12,
              borderTop: darkMode ? '1px solid rgba(255,255,255,0.08)' : '1px solid #e2e8f0',
              fontSize: 11,
              color: darkMode ? '#64748b' : '#94a3b8',
              textAlign: 'center',
            }}
          >
            Sub-15ms SVM Game Engine
          </div>
        </div>

        {/* ===============================================================
            CENTER PANEL: Main Play Card (Strict Column Layout)
           =============================================================== */}
        <div
          className={`agar-main-card agar-menu-panel-center ${
            activeMobileTab === 'play' ? 'mobile-visible' : 'mobile-hidden'
          }`}
          style={{
            display: 'flex',
            flexDirection: 'column',
            justifyContent: 'flex-start',
            backgroundColor: darkMode ? '#1e293b' : '#ffffff',
            color: darkMode ? '#f8fafc' : '#1e293b',
          }}
        >
          <div className="agar-tilt-grid">
            <div className="agar-tilt-col-left">
              {/* Active Room Badge (Top of Card) */}
          <div
            className="agar-room-badge"
            style={{
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'space-between',
              backgroundColor: darkMode ? '#0f172a' : '#f8fafc',
              border: isPrivateRoom ? '2px solid #9945FF' : '2px solid #334155',
              padding: '7px 12px',
              marginBottom: 14,
              fontSize: 11,
              fontFamily: 'JetBrains Mono, monospace',
              width: '100%',
              boxSizing: 'border-box',
            }}
          >
            <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
              {isPrivateRoom ? <Lock size={13} style={{ color: '#9945FF' }} /> : <Globe size={13} style={{ color: '#00E676' }} />}
              <span style={{ fontWeight: 700, color: isPrivateRoom ? '#C084FC' : '#00E676' }}>
                {isPrivateRoom ? `ROOM: ${currentRoomId}` : 'PUBLIC ARENA'}
              </span>
            </div>
            {isPrivateRoom && (
              <button
                onClick={handleCopyCurrentLink}
                style={{
                  background: 'none',
                  border: 'none',
                  color: '#9945FF',
                  cursor: 'pointer',
                  fontSize: 11,
                  display: 'flex',
                  alignItems: 'center',
                  gap: 4,
                  fontWeight: 700,
                }}
                title="Copy Room Link"
              >
                {copiedInvite ? <Check size={12} /> : <Copy size={12} />}
                <span>{copiedInvite ? 'Copied' : 'Invite'}</span>
              </button>
            )}
          </div>

          {/* Skin Preview Carousel */}
          <div
            className="agar-skin-carousel-box"
            style={{
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              gap: 14,
              marginBottom: 10,
              width: '100%',
            }}
          >
            <button
              onClick={prevSkin}
              className="btn-agar-ghost"
              style={{ padding: '6px', borderRadius: 0, width: 36, height: 36 }}
              title="Previous skin"
            >
              <ChevronLeft size={18} />
            </button>

            {/* Blob Preview (Flat Square Frame) */}
            <div
              className="agar-skin-preview-frame"
              style={{
                width: 82,
                height: 82,
                borderRadius: 0,
                backgroundColor: activeSkin.fill,
                border: `3px solid ${activeSkin.stroke}`,
                display: 'flex',
                flexDirection: 'column',
                alignItems: 'center',
                justifyContent: 'center',
                cursor: 'pointer',
                transition: 'transform 0.15s ease',
              }}
              onClick={() => setIsSkinModalOpen(true)}
              title="Click to view all skins"
              onMouseEnter={(e) => (e.currentTarget.style.transform = 'scale(1.05)')}
              onMouseLeave={(e) => (e.currentTarget.style.transform = 'scale(1)')}
            >
              <span className="agar-skin-preview-emblem" style={{ fontSize: 34, lineHeight: 1 }}>{activeSkin.emblem}</span>
            </div>

            <button
              onClick={nextSkin}
              className="btn-agar-ghost"
              style={{ padding: '6px', borderRadius: 0, width: 36, height: 36 }}
              title="Next skin"
            >
              <ChevronRight size={18} />
            </button>
          </div>

          <div className="agar-skin-label-box" style={{ marginBottom: 12, textAlign: 'center' }}>
            <div style={{ fontSize: 13, fontWeight: 700, fontFamily: 'Ubuntu, sans-serif' }}>
              Skin: <span style={{ color: activeSkin.fill }}>{activeSkin.name}</span>
            </div>
            <button
              onClick={() => setIsSkinModalOpen(true)}
              style={{
                background: 'none',
                border: 'none',
                fontSize: 11,
                color: '#3B82F6',
                cursor: 'pointer',
                fontWeight: 600,
                textDecoration: 'underline',
                marginTop: 2,
              }}
            >
              Change Skin (8 Available)
            </button>
          </div>

          {/* Nickname Input & Randomize */}
          <div className="agar-nickname-section" style={{ marginBottom: 12, width: '100%', boxSizing: 'border-box' }}>
            <div
              style={{
                display: 'flex',
                justifyContent: 'space-between',
                fontSize: 11,
                fontWeight: 700,
                marginBottom: 4,
                color: darkMode ? '#cbd5e1' : '#475569',
              }}
            >
              <span>{connectedWallet.isConnected ? 'CUSTOM GAMER TAG' : 'GUEST NICKNAME'}</span>
              <span style={{ color: connectedWallet.isConnected ? '#00E676' : '#94a3b8' }}>
                {connectedWallet.isConnected ? '✓ Saved to Wallet' : 'Random Assigned'}
              </span>
            </div>
            <div style={{ display: 'flex', gap: 6, width: '100%' }}>
              <input
                type="text"
                maxLength={15}
                value={playerName}
                onChange={(e) => handleNameInput(e.target.value)}
                placeholder="Enter Nickname"
                className="agar-input"
                style={{ flex: 1, minWidth: 0 }}
              />
              <button
                onClick={handleRandomizeNick}
                className="btn-agar-ghost"
                style={{ borderRadius: 0, padding: '0 12px', flexShrink: 0 }}
                title="Generate Random Nickname"
              >
                <Dices size={18} />
              </button>
            </div>
          </div>
        </div>

        <div className="agar-tilt-col-right">
          {/* Wallet Login Status (Only shown when wallet is connected) */}
          {connectedWallet.isConnected && (
            <>
              <div
              style={{
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'space-between',
                backgroundColor: darkMode ? '#0f172a' : '#f8fafc',
                border: '1px solid #00E676',
                padding: '7px 12px',
                marginBottom: 12,
                width: '100%',
                boxSizing: 'border-box',
              }}
            >
              <div style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: 11, fontFamily: 'JetBrains Mono, monospace' }}>
                <span style={{ width: 8, height: 8, backgroundColor: '#00E676', display: 'inline-block' }} />
                <span>
                  {connectedWallet.walletName || 'Wallet'}: {connectedWallet.publicKey?.slice(0, 4)}...{connectedWallet.publicKey?.slice(-4)} •{' '}
                  <strong style={{ color: '#00E676' }}>{connectedWallet.balance.toFixed(3)} SOL</strong>
                </span>
              </div>
              <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                {onRequestAirdrop && (
                  <button
                    onClick={onRequestAirdrop}
                    disabled={isRequestingAirdrop}
                    style={{
                      backgroundColor: '#10b981',
                      border: 'none',
                      color: '#ffffff',
                      fontSize: 10,
                      fontWeight: 700,
                      padding: '3px 8px',
                      cursor: 'pointer',
                      display: 'flex',
                      alignItems: 'center',
                      gap: 3,
                    }}
                    title="Request 0.5 Devnet SOL from Faucet"
                  >
                    <span>{isRequestingAirdrop ? 'AIRDROPPING...' : '+0.5 SOL'}</span>
                  </button>
                )}
                <button
                  onClick={onDisconnectWallet}
                  style={{
                    backgroundColor: 'transparent',
                    border: 'none',
                    color: '#ef4444',
                    fontSize: 10,
                    fontWeight: 700,
                    cursor: 'pointer',
                    display: 'flex',
                    alignItems: 'center',
                    gap: 3,
                  }}
                  title="Disconnect wallet"
                >
                  <LogOut size={11} />
                  <span>DISCONNECT</span>
                </button>
              </div>
            </div>
            {/* Devnet Guidance & Low Balance Callout */}
            <div style={{ marginBottom: 12 }}>
              <div
                style={{
                  fontSize: 10,
                  color: darkMode ? '#94a3b8' : '#64748b',
                  marginBottom: 6,
                  fontFamily: 'JetBrains Mono, monospace',
                  display: 'flex',
                  alignItems: 'center',
                  gap: 5,
                }}
              >
                <span>🌐 SOLANA DEVNET</span>
                <span>•</span>
                <span style={{ color: '#00E676', fontWeight: 600 }}>Set Phantom to Devnet (Testnet Mode)</span>
              </div>

              {connectedWallet.balance < 0.007 && (
                <div
                  style={{
                    backgroundColor: darkMode ? 'rgba(245, 158, 11, 0.15)' : '#fef3c7',
                    border: '1px solid #f59e0b',
                    color: darkMode ? '#fde68a' : '#92400e',
                    padding: '6px 10px',
                    fontSize: 11,
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'space-between',
                    fontFamily: 'Ubuntu, sans-serif',
                  }}
                >
                  <span>⚠️ Need Devnet SOL to stake.</span>
                  {onRequestAirdrop && (
                    <button
                      onClick={onRequestAirdrop}
                      disabled={isRequestingAirdrop}
                      style={{
                        backgroundColor: '#f59e0b',
                        color: '#000000',
                        border: 'none',
                        fontWeight: 800,
                        padding: '3px 10px',
                        cursor: 'pointer',
                        fontSize: 11,
                        borderRadius: 0,
                      }}
                    >
                      {isRequestingAirdrop ? 'REQUESTING...' : 'GET FREE SOL'}
                    </button>
                  )}
                </div>
              )}
            </div>
          </>
        )}

          {/* Staking Tier (Disabled for pure guest free play, enabled for wallet) */}
          <div className="agar-stake-section" style={{ marginBottom: 14, width: '100%', boxSizing: 'border-box' }}>
            <div
              style={{
                display: 'flex',
                justifyContent: 'space-between',
                marginBottom: 6,
                fontSize: 11,
                fontWeight: 700,
                color: darkMode ? '#cbd5e1' : '#475569',
              }}
            >
              <span>STAKE & EARN (DEVNET L1)</span>
              <span style={{ color: '#00E676', fontFamily: 'JetBrains Mono, monospace' }}>
                {connectedWallet.isConnected ? `${connectedWallet.balance.toFixed(3)} SOL` : 'GUEST: FREE'}
              </span>
            </div>

            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 6, width: '100%' }}>
              {[
                { label: '0.005 SOL', value: 0.005 },
                { label: '0.01 SOL', value: 0.01 },
                { label: '0.05 SOL', value: 0.05 },
                { label: '0.10 SOL', value: 0.1 },
              ].map((tier) => (
                <button
                  key={tier.label}
                  onClick={() => onSelectStake(tier.value)}
                  className={`agar-stake-chip ${selectedStake === tier.value ? 'active' : ''}`}
                >
                  {tier.label}
                </button>
              ))}
            </div>
          </div>

          {/* Play & Wallet Buttons */}
          <div className="agar-actions-section" style={{ display: 'flex', flexDirection: 'column', gap: 8, marginBottom: 12, width: '100%' }}>
            {connectedWallet.isConnected ? (
              <>
                <button onClick={onPlayWallet} disabled={isTransacting} className="btn-agar-play">
                  <Zap size={20} />
                  <span>
                    {isTransacting
                      ? 'TRANSACTING ON DEVNET...'
                      : selectedStake > 0
                      ? `PLAY & STAKE ${selectedStake} SOL`
                      : 'PLAY WITH WALLET'}
                  </span>
                </button>

                {/* Secondary Row: Guest Play + Spectate */}
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8, width: '100%' }}>
                  <button
                    onClick={onPlayGuest}
                    className="btn-agar-ghost btn-secondary-action"
                    style={{
                      fontWeight: 800,
                      color: darkMode ? '#00E676' : '#00A854',
                      border: '2px solid #00E676',
                      borderRadius: 0,
                    }}
                    title="Play immediately as guest without wallet"
                  >
                    <Sparkles size={14} />
                    <span>PLAY AS GUEST</span>
                  </button>

                  <button
                    onClick={onSpectate}
                    className="btn-agar-ghost btn-secondary-action"
                    style={{ fontWeight: 700 }}
                    title="Spectate game match"
                  >
                    <Eye size={14} />
                    <span>SPECTATE</span>
                  </button>
                </div>
              </>
            ) : (
              <>
                {/* When NOT connected: PLAY AS GUEST is the prominent 1-click primary button */}
                <button
                  onClick={onPlayGuest}
                  className="btn-agar-play"
                  title="Play immediately as guest without wallet"
                >
                  <Sparkles size={20} />
                  <span>PLAY AS GUEST (FREE)</span>
                </button>

                {/* Secondary Row: Connect Wallet + Spectate */}
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8, width: '100%' }}>
                  <button
                    onClick={onConnectWallet}
                    disabled={isConnectingWallet}
                    className="btn-agar-ghost btn-secondary-action"
                    style={{
                      fontWeight: 700,
                      color: darkMode ? '#38bdf8' : '#0284c7',
                      border: `2px solid ${darkMode ? '#0284c7' : '#38bdf8'}`,
                      borderRadius: 0,
                    }}
                    title="Connect Phantom or Solflare wallet"
                  >
                    <Wallet size={14} />
                    <span>{isConnectingWallet ? 'CONNECTING...' : 'LOGIN WALLET'}</span>
                  </button>

                  <button
                    onClick={onSpectate}
                    className="btn-agar-ghost btn-secondary-action"
                    style={{ fontWeight: 700 }}
                    title="Spectate game match"
                  >
                    <Eye size={14} />
                    <span>SPECTATE</span>
                  </button>
                </div>
              </>
            )}
          </div>

          <div className="agar-menu-tip" style={{ fontSize: 11, color: darkMode ? '#64748b' : '#94a3b8', textAlign: 'center' }}>
            Tip: Press <strong>Space</strong> to split • <strong>W</strong> to eject mass
          </div>
        </div>
      </div>
    </div>

        {/* ===============================================================
            RIGHT PANEL: Supabase Multiplayer & Unguessable Rooms
           =============================================================== */}
        <div
          className={`agar-side-card agar-menu-panel-right ${
            activeMobileTab === 'rooms' ? 'mobile-visible' : 'mobile-hidden'
          }`}
          style={{
            flex: '0 0 260px',
            width: 260,
            padding: '20px 18px',
            display: 'flex',
            flexDirection: 'column',
            justifyContent: 'space-between',
            backgroundColor: darkMode ? '#1e293b' : '#ffffff',
            color: darkMode ? '#f8fafc' : '#1e293b',
          }}
        >
          <div>
            <div
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: 8,
                fontSize: 13,
                fontWeight: 700,
                textTransform: 'uppercase',
                letterSpacing: 0.5,
                color: darkMode ? '#cbd5e1' : '#475569',
                marginBottom: 12,
                borderBottom: darkMode ? '1px solid rgba(255,255,255,0.08)' : '1px solid #e2e8f0',
                paddingBottom: 8,
              }}
            >
              <Users size={16} style={{ color: '#00E676' }} />
              <span>Multiplayer Rooms</span>
            </div>

            {/* Current Room Info */}
            <div
              style={{
                backgroundColor: darkMode ? '#0f172a' : '#f8fafc',
                border: '1px solid #334155',
                padding: '10px 12px',
                marginBottom: 12,
              }}
            >
              <div style={{ fontSize: 10, color: darkMode ? '#94a3b8' : '#64748b', fontWeight: 700, textTransform: 'uppercase' }}>
                Active Channel
              </div>
              <div
                style={{
                  fontSize: 13,
                  fontWeight: 800,
                  color: isPrivateRoom ? '#9945FF' : '#00E676',
                  fontFamily: 'JetBrains Mono, monospace',
                  wordBreak: 'break-all',
                  marginTop: 2,
                }}
              >
                {currentRoomId}
              </div>
              <div style={{ fontSize: 10, color: darkMode ? '#64748b' : '#94a3b8', marginTop: 4 }}>
                {isPrivateRoom ? '🔒 Private Isolated Room' : '🌐 Global Public Arena'}
              </div>
            </div>

            {/* Create Unguessable Private Room */}
            <div style={{ display: 'flex', flexDirection: 'column', gap: 8, marginBottom: 14 }}>
              <button
                onClick={handleCreatePrivateRoom}
                style={{
                  backgroundColor: '#9945FF',
                  border: '2px solid #7C3AED',
                  color: '#ffffff',
                  padding: '9px 12px',
                  borderRadius: 0,
                  fontWeight: 800,
                  fontSize: 12,
                  cursor: 'pointer',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  gap: 6,
                  fontFamily: 'Ubuntu, sans-serif',
                }}
              >
                <Plus size={14} />
                <span>CREATE PRIVATE ROOM</span>
              </button>

              {isPrivateRoom && (
                <div style={{ display: 'flex', gap: 6 }}>
                  <button
                    onClick={handleCopyCurrentLink}
                    style={{
                      flex: 1,
                      backgroundColor: darkMode ? '#334155' : '#e2e8f0',
                      border: '1px solid #475569',
                      color: darkMode ? '#ffffff' : '#0f172a',
                      padding: '7px 8px',
                      borderRadius: 0,
                      fontWeight: 700,
                      fontSize: 11,
                      cursor: 'pointer',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      gap: 4,
                    }}
                  >
                    {copiedInvite ? <Check size={12} /> : <Copy size={12} />}
                    <span>{copiedInvite ? 'COPIED!' : 'COPY INVITE'}</span>
                  </button>

                  <button
                    onClick={() => onChangeRoom('global')}
                    style={{
                      backgroundColor: 'transparent',
                      border: '1px solid #64748b',
                      color: darkMode ? '#94a3b8' : '#64748b',
                      padding: '7px 10px',
                      borderRadius: 0,
                      fontWeight: 700,
                      fontSize: 11,
                      cursor: 'pointer',
                    }}
                    title="Leave to Global Public Arena"
                  >
                    PUBLIC
                  </button>
                </div>
              )}
            </div>

            {/* Join Room by Code */}
            <div style={{ borderTop: darkMode ? '1px solid rgba(255,255,255,0.08)' : '1px solid #e2e8f0', paddingTop: 10 }}>
              <div style={{ fontSize: 11, fontWeight: 700, marginBottom: 6, color: darkMode ? '#cbd5e1' : '#475569' }}>
                JOIN ROOM BY CODE / LINK
              </div>
              <div style={{ display: 'flex', gap: 6 }}>
                <input
                  type="text"
                  placeholder="rm-XXXXXX or link"
                  value={joinInputCode}
                  onChange={(e) => setJoinInputCode(e.target.value)}
                  className="agar-input"
                  style={{ fontSize: 11, padding: '6px 8px', flex: 1, minWidth: 0, height: 38 }}
                />
                <button
                  onClick={handleJoinByInput}
                  className="btn-agar-play"
                  style={{ width: 'auto', padding: '6px 12px', fontSize: 11, flexShrink: 0 }}
                  title="Join Room"
                >
                  <LogIn size={13} />
                </button>
              </div>
            </div>
          </div>

          <div
            style={{
              paddingTop: 10,
              borderTop: darkMode ? '1px solid rgba(255,255,255,0.08)' : '1px solid #e2e8f0',
              fontSize: 10,
              color: darkMode ? '#64748b' : '#94a3b8',
              textAlign: 'center',
            }}
          >
            Realtime Supabase + Ephemeral Rollup
          </div>
        </div>
      </div>
      </div>

      {/* Skin Picker Gallery Modal */}
      <SkinModal
        isOpen={isSkinModalOpen}
        onClose={() => setIsSkinModalOpen(false)}
        selectedSkinId={selectedSkinId}
        onSelectSkin={onSelectSkin}
        darkMode={darkMode}
      />
    </div>
  );
};
