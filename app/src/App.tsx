import React, { useState, useEffect, useCallback } from 'react';
import { Navbar } from './components/Navbar';
import { Leaderboard } from './components/Leaderboard';
import type { LeaderboardEntry } from './components/Leaderboard';
import { GameCanvas } from './components/GameCanvas';
import { AgarMenu } from './components/AgarMenu';
import { CashOutModal } from './components/CashOutModal';
import { GameOverModal } from './components/GameOverModal';
import { OrientationPrompt } from './components/OrientationPrompt';
import {
  measureErLatency,
  getBurnerKeypair,
  resetBurnerKeypair,
  getPlayerPda,
  createMovePlayerInstruction,
  sendErTx,
  executeSpawnAndDelegate,
  executeCashOutAndSettlement,
  requestDevnetAirdrop,
  baseConnection,
} from './utils/solana';
import {
  connectBrowserWallet,
  disconnectBrowserWallet,
  checkExistingWalletConnection,
  getSavedNicknameForWallet,
  saveNicknameForWallet,
  generateRandomGuestNick,
  getAvailableWallet,
} from './utils/wallet';
import { BASE_MASS, SKINS } from './constants';
import { Keypair, PublicKey, LAMPORTS_PER_SOL } from '@solana/web3.js';
import { ExternalLink, CheckCircle2, AlertTriangle, Loader2, X } from 'lucide-react';
import { sounds } from './utils/audio';

export const App: React.FC = () => {
  // Network & Latency State
  const [erLatency, setErLatency] = useState(14);
  const [burnerKeypair, setBurnerKeypair] = useState<Keypair | null>(null);
  const [activeSessionKeypair, setActiveSessionKeypair] = useState<Keypair | null>(null);
  const [inExtractionZone, setInExtractionZone] = useState(false);

  // Solana Browser Wallet State
  const [connectedWallet, setConnectedWallet] = useState<{
    isConnected: boolean;
    publicKey: string | null;
    balance: number;
    walletName: string | null;
  }>({
    isConnected: false,
    publicKey: null,
    balance: 0,
    walletName: null,
  });
  const [isConnectingWallet, setIsConnectingWallet] = useState(false);

  // Unguessable Multiplayer Room State (defaults to 'global' or URL param)
  const [currentRoomId, setCurrentRoomId] = useState<string>(() => {
    if (typeof window !== 'undefined') {
      const urlParams = new URLSearchParams(window.location.search);
      const r = urlParams.get('room');
      if (r && r.trim()) return r.trim();
    }
    return 'global';
  });

  // Gameplay State
  const [isPlaying, setIsPlaying] = useState(false);
  const [isSpectating, setIsSpectating] = useState(false);
  const [isMenuOpen, setIsMenuOpen] = useState(true);
  const [playerName, setPlayerName] = useState(() => generateRandomGuestNick());
  const [selectedSkinId, setSelectedSkinId] = useState('solana');
  const [selectedStake, setSelectedStake] = useState(0);
  const [playerMass, setPlayerMass] = useState(BASE_MASS);
  const [kills, setKills] = useState(0);

  // Live Solana / MagicBlock Transaction State
  const [txStatus, setTxStatus] = useState<{
    type: 'info' | 'success' | 'error';
    message: string;
    txSig?: string;
  } | null>(null);
  const [isTransacting, setIsTransacting] = useState(false);
  const [isRequestingAirdrop, setIsRequestingAirdrop] = useState(false);

  // Elimination / Game Over State
  const [isGameOverModalOpen, setIsGameOverModalOpen] = useState(false);
  const [killerName, setKillerName] = useState('a rival blob');
  const [finalStats, setFinalStats] = useState({ mass: BASE_MASS, kills: 0, survivalSec: 0 });

  // Agar.io User Settings
  const [darkMode, setDarkMode] = useState(false); // Default to classic Agar.io light graph paper!
  const [showMass, setShowMass] = useState(true);
  const [soundEnabled, setSoundEnabled] = useState(true);

  // Cash Out & Settlement State
  const [isCashOutModalOpen, setIsCashOutModalOpen] = useState(false);
  const [isProcessingCashOut, setIsProcessingCashOut] = useState(false);
  const [cashOutTxHash, setCashOutTxHash] = useState<string | null>(null);

  const [leaderboard, setLeaderboard] = useState<LeaderboardEntry[]>([]);

  // Sync sound setting
  useEffect(() => {
    sounds.setEnabled(soundEnabled);
  }, [soundEnabled]);

  // Initialize guest keypair & check browser wallet connection on mount
  useEffect(() => {
    const kp = getBurnerKeypair();
    setBurnerKeypair(kp);

    checkExistingWalletConnection()
      .then((existing) => {
        if (existing) {
          setConnectedWallet({
            isConnected: true,
            publicKey: existing.publicKey,
            balance: existing.balance,
            walletName: existing.walletName,
          });
          const saved = getSavedNicknameForWallet(existing.publicKey);
          if (saved) setPlayerName(saved);
          setSelectedStake(0.01);
        }
      })
      .catch(() => {});
  }, []);

  // Latency Heartbeat to MagicBlock Ephemeral Rollup
  useEffect(() => {
    const interval = setInterval(async () => {
      const lat = await measureErLatency();
      if (lat > 0) setErLatency(lat);
    }, 3000);
    return () => clearInterval(interval);
  }, []);

  // Connect to Solana browser wallet (Phantom / Solflare / Backpack)
  const handleConnectWallet = async () => {
    setIsConnectingWallet(true);
    try {
      const res = await connectBrowserWallet();
      if (res) {
        setConnectedWallet({
          isConnected: true,
          publicKey: res.publicKey,
          balance: res.balance,
          walletName: res.walletName,
        });
        const saved = getSavedNicknameForWallet(res.publicKey);
        if (saved) {
          setPlayerName(saved);
        } else {
          saveNicknameForWallet(res.publicKey, playerName);
        }
        setSelectedStake(0.01);
      }
    } catch (err) {
      console.warn('Wallet connection cancelled or failed:', err);
    } finally {
      setIsConnectingWallet(false);
    }
  };

  // Disconnect wallet
  const handleDisconnectWallet = async () => {
    await disconnectBrowserWallet();
    setConnectedWallet({
      isConnected: false,
      publicKey: null,
      balance: 0,
      walletName: null,
    });
    setPlayerName(generateRandomGuestNick());
    setSelectedStake(0);
  };

  // Switch or Create Room
  const handleChangeRoom = (newRoomId: string) => {
    setCurrentRoomId(newRoomId);
    if (typeof window !== 'undefined') {
      const cleanPath = window.location.pathname;
      const newUrl = newRoomId === 'global' ? cleanPath : `${cleanPath}?room=${encodeURIComponent(newRoomId)}`;
      window.history.replaceState({}, '', newUrl);
    }
  };

  // Play as Guest (Instant 1-Click Launch with Burner or Free)
  const handlePlayGuest = async () => {
    if (!burnerKeypair) return;

    let burnerBal = 0;
    try {
      burnerBal = (await baseConnection.getBalance(burnerKeypair.publicKey)) / LAMPORTS_PER_SOL;
    } catch {
      // Ignored
    }

    if (burnerBal >= 0.005) {
      setIsTransacting(true);
      setTxStatus({
        type: 'info',
        message: 'Spawning guest on Solana Devnet with session key...',
      });
      try {
        const skinIndex = Math.max(0, SKINS.findIndex((s) => s.id === selectedSkinId));
        const startX = Math.floor(Math.random() * 3000) + 500;
        const startY = Math.floor(Math.random() * 3000) + 500;

        const { spawnTx, delegateTx, sessionKeypair } = await executeSpawnAndDelegate({
          playerPubkey: burnerKeypair.publicKey,
          keypair: burnerKeypair,
          name: playerName,
          depositSol: 0.005,
          color: skinIndex,
          startX,
          startY,
        });
        setActiveSessionKeypair(sessionKeypair);

        setTxStatus({
          type: 'success',
          message: `Guest spawned on Devnet! ${delegateTx ? 'Delegated to MagicBlock Rollup.' : ''}`,
          txSig: spawnTx,
        });
      } catch (err) {
        console.warn('Guest on-chain spawn warning:', err);
      } finally {
        setIsTransacting(false);
      }
    }

    setIsGameOverModalOpen(false);
    setIsMenuOpen(false);
    setIsSpectating(false);
    setIsPlaying(true);
    setPlayerMass(BASE_MASS);
    setKills(0);
    setCashOutTxHash(null);
    sounds.playSpawnSound();
  };

  // Play with Solana Wallet (Real Staked Devnet Arena)
  const handlePlayWallet = async () => {
    if (!connectedWallet.publicKey) {
      handleConnectWallet();
      return;
    }

    const stakeSol = selectedStake > 0 ? selectedStake : 0.005; // 0.005 SOL is arena minimum
    const requiredTotal = stakeSol + 0.002; // stake + account rent exemption
    if (connectedWallet.balance < requiredTotal) {
      setTxStatus({
        type: 'error',
        message: `Low Devnet SOL (${connectedWallet.balance.toFixed(4)} SOL). Spawning requires ${stakeSol} SOL + 0.002 SOL rent. Please click '+0.5 SOL' or switch Phantom to Devnet!`,
      });
      return;
    }

    setIsTransacting(true);
    setTxStatus({
      type: 'info',
      message: `Spawning player on Solana Devnet (Staking ${stakeSol} SOL)...`,
    });

    try {
      const provider = getAvailableWallet()?.provider;
      const playerPubkey = new PublicKey(connectedWallet.publicKey);
      const skinIndex = Math.max(0, SKINS.findIndex((s) => s.id === selectedSkinId));
      const startX = Math.floor(Math.random() * 3000) + 500;
      const startY = Math.floor(Math.random() * 3000) + 500;

      const { spawnTx, delegateTx, sessionKeypair } = await executeSpawnAndDelegate({
        playerPubkey,
        provider,
        name: playerName,
        depositSol: stakeSol,
        color: skinIndex,
        startX,
        startY,
      });
      setActiveSessionKeypair(sessionKeypair);

      setTxStatus({
        type: 'success',
        message: `Spawned on Devnet! ${delegateTx ? 'Delegated to MagicBlock Rollup.' : ''}`,
        txSig: spawnTx,
      });

      setIsGameOverModalOpen(false);
      setIsMenuOpen(false);
      setIsSpectating(false);
      setIsPlaying(true);
      setPlayerMass(BASE_MASS + Math.round(stakeSol * 3000));
      setKills(0);
      setCashOutTxHash(null);
      sounds.playSpawnSound();

      // Refresh balance
      const lamports = await baseConnection.getBalance(playerPubkey);
      setConnectedWallet((prev) => ({
        ...prev,
        balance: lamports / LAMPORTS_PER_SOL,
      }));
    } catch (err) {
      console.error('Spawn error:', err);
      setTxStatus({
        type: 'error',
        message: `On-chain spawn failed: ${(err as Error).message || 'Transaction rejected'}`,
      });
    } finally {
      setIsTransacting(false);
    }
  };

  // Enter Spectator Mode
  const handleSpectate = () => {
    setIsGameOverModalOpen(false);
    setIsMenuOpen(false);
    setIsPlaying(false);
    setIsSpectating(true);
  };

  // Live ER Movement Dispatcher to MagicBlock Ephemeral Rollup Validator
  const handleDispatchErMove = useCallback(
    (x: number, y: number, vx: number, vy: number) => {
      const activeKp = activeSessionKeypair || burnerKeypair;
      if (!activeKp) return;
      try {
        const [playerPda] = getPlayerPda(activeKp.publicKey);
        const moveIx = createMovePlayerInstruction(playerPda, activeKp.publicKey, x, y, vx, vy);
        sendErTx(activeKp, [moveIx]).catch(() => {
          // Real ER stream silently logs
        });
      } catch {
        // Handled silently
      }
    },
    [activeSessionKeypair, burnerKeypair]
  );

  // Update Mass & Kills
  const handleUpdateMass = (newMass: number, killsDelta: number) => {
    setPlayerMass(newMass);
    if (killsDelta > 0) {
      setKills((prev) => prev + killsDelta);
    }
  };

  // Open Extraction Dialog
  const handleExtractTriggered = () => {
    setIsCashOutModalOpen(true);
  };

  // Player Elimination Handler
  const handlePlayerEliminated = (
    killer: string,
    peakM: number,
    kCount: number,
    survivalSec: number
  ) => {
    setIsPlaying(false);
    setKillerName(killer);
    setFinalStats({ mass: peakM, kills: kCount, survivalSec });
    setIsGameOverModalOpen(true);
    setActiveSessionKeypair(null);
    setInExtractionZone(false);

    // Refresh wallet balance so player sees their SOL was staked/deducted
    if (connectedWallet.publicKey) {
      baseConnection.getBalance(new PublicKey(connectedWallet.publicKey)).then((lamports) => {
        setConnectedWallet((prev) => ({
          ...prev,
          balance: lamports / LAMPORTS_PER_SOL,
        }));
      }).catch(() => {});
    }
  };

  // Execute Real On-Chain Cash Out & Atomic Settlement
  const handleConfirmCashOut = async () => {
    setIsProcessingCashOut(true);
    setTxStatus({
      type: 'info',
      message: 'Committing ER state & executing atomic payout transfer on Solana Devnet...',
    });

    try {
      const activeKp = activeSessionKeypair || (!connectedWallet.publicKey ? burnerKeypair : null);
      const recipientWallet = connectedWallet.publicKey ? new PublicKey(connectedWallet.publicKey) : null;
      const activePubkey = activeKp
        ? activeKp.publicKey
        : connectedWallet.publicKey
        ? new PublicKey(connectedWallet.publicKey)
        : burnerKeypair
        ? burnerKeypair.publicKey
        : null;

      if (!activePubkey) {
        throw new Error('No active wallet or session keypair found');
      }

      const activeProvider = !activeKp && connectedWallet.publicKey ? getAvailableWallet()?.provider : null;

      const realTxSig = await executeCashOutAndSettlement({
        playerPubkey: activePubkey,
        provider: activeProvider,
        keypair: activeKp,
        recipientWallet,
      });

      setCashOutTxHash(realTxSig);
      setTxStatus({
        type: 'success',
        message: 'Settlement confirmed on Solana Devnet!',
        txSig: realTxSig,
      });
      sounds.playCashOutSound();
      setIsPlaying(false);

      // Refresh wallet balance
      try {
        const lamports = await baseConnection.getBalance(activePubkey);
        setConnectedWallet((prev) => ({
          ...prev,
          balance: lamports / LAMPORTS_PER_SOL,
        }));
      } catch {
        // Ignored
      }
    } catch (err) {
      console.error('Cash out failed:', err);
      setTxStatus({
        type: 'error',
        message: `Settlement error: ${(err as Error).message || 'Transaction rejected'}`,
      });
    } finally {
      setIsProcessingCashOut(false);
      setInExtractionZone(false);
    }
  };

  // Request Devnet Airdrop for current wallet
  const handleRequestAirdrop = async () => {
    const targetPubkey = connectedWallet.publicKey
      ? new PublicKey(connectedWallet.publicKey)
      : burnerKeypair
      ? burnerKeypair.publicKey
      : null;

    if (!targetPubkey) return;

    setIsRequestingAirdrop(true);
    setTxStatus({ type: 'info', message: 'Requesting 0.5 Devnet SOL from faucet...' });

    try {
      const sig = await requestDevnetAirdrop(targetPubkey);
      setTxStatus({
        type: 'success',
        message: 'Received 0.5 Devnet SOL!',
        txSig: sig,
      });

      const lamports = await baseConnection.getBalance(targetPubkey);
      const newBal = lamports / LAMPORTS_PER_SOL;
      if (connectedWallet.publicKey) {
        setConnectedWallet((prev) => ({ ...prev, balance: newBal }));
      }
    } catch (err) {
      setTxStatus({
        type: 'error',
        message: `Faucet notice: ${(err as Error).message}`,
      });
    } finally {
      setIsRequestingAirdrop(false);
    }
  };

  const handleToggleWallet = () => {
    const kp = resetBurnerKeypair();
    setBurnerKeypair(kp);
  };

  // Compute live SOL equity of the player
  const currentSolValue = Math.max(
    0,
    ((playerMass - BASE_MASS) / 3000) + (selectedStake > 0 ? selectedStake : 0)
  );

  const displayWalletAddress = connectedWallet.publicKey || (burnerKeypair ? burnerKeypair.publicKey.toBase58() : null);

  return (
    <div
      className={`agar-app-root ${darkMode ? 'agar-dark-mode' : ''}`}
      style={{
        position: 'fixed',
        inset: 0,
        width: '100%',
        height: '100%',
        overflow: 'hidden',
        backgroundColor: darkMode ? '#0f172a' : '#F2FBFF',
        touchAction: 'none',
      }}
    >
      {/* Smart Mobile Tilt Orientation Helper */}
      <OrientationPrompt />

      {/* Top HUD Bar */}
      <Navbar
        erLatency={erLatency}
        playerMass={playerMass}
        kills={kills}
        solValue={currentSolValue}
        isPlaying={isPlaying}
        isSpectating={isSpectating}
        walletAddress={displayWalletAddress}
        roomId={currentRoomId}
        inExtractionZone={inExtractionZone}
        onRequireZone={() => {
          setTxStatus({
            type: 'info',
            message: '⚡ Must enter an Extraction Vortex in map corners to cash out SOL!',
          });
        }}
        onOpenCashOut={() => {
          if (inExtractionZone) {
            setIsCashOutModalOpen(true);
          }
        }}
        onOpenMenu={() => {
          setIsGameOverModalOpen(false);
          setIsMenuOpen(true);
          setIsSpectating(false);
        }}
        onToggleWallet={handleToggleWallet}
      />

      {/* Leaderboard Panel (Collapsible & Responsive) */}
      <Leaderboard entries={leaderboard} darkMode={darkMode} />

      {/* Main 60-144 FPS Agar.io Canvas Engine */}
      <GameCanvas
        isPlaying={isPlaying}
        isSpectating={isSpectating}
        playerName={playerName}
        selectedSkinId={selectedSkinId}
        initialDeposit={selectedStake}
        darkMode={darkMode}
        showMass={showMass}
        roomId={currentRoomId}
        walletAddress={displayWalletAddress}
        onUpdateMass={handleUpdateMass}
        onExtractTriggered={handleExtractTriggered}
        onZoneChange={setInExtractionZone}
        onPlayerEliminated={handlePlayerEliminated}
        onUpdateLeaderboard={setLeaderboard}
        onDispatchErMove={handleDispatchErMove}
        onOpenMenu={() => {
          setIsGameOverModalOpen(false);
          setIsMenuOpen(true);
          setIsSpectating(false);
        }}
      />

      {/* Authentic Responsive Agar.io Start Screen */}
      <AgarMenu
        isOpen={isMenuOpen && !isGameOverModalOpen}
        playerName={playerName}
        onPlayerNameChange={setPlayerName}
        selectedSkinId={selectedSkinId}
        onSelectSkin={setSelectedSkinId}
        selectedStake={selectedStake}
        onSelectStake={setSelectedStake}
        onPlayGuest={handlePlayGuest}
        onPlayWallet={handlePlayWallet}
        onSpectate={handleSpectate}
        connectedWallet={connectedWallet}
        onConnectWallet={handleConnectWallet}
        onDisconnectWallet={handleDisconnectWallet}
        isConnectingWallet={isConnectingWallet}
        currentRoomId={currentRoomId}
        onChangeRoom={handleChangeRoom}
        erLatency={erLatency}
        darkMode={darkMode}
        onToggleDarkMode={() => setDarkMode((prev) => !prev)}
        showMass={showMass}
        onToggleShowMass={() => setShowMass((prev) => !prev)}
        soundEnabled={soundEnabled}
        onToggleSound={() => setSoundEnabled((prev) => !prev)}
        onRequestAirdrop={handleRequestAirdrop}
        isRequestingAirdrop={isRequestingAirdrop}
        isTransacting={isTransacting}
      />

      {/* Game Over / Elimination Modal */}
      <GameOverModal
        isOpen={isGameOverModalOpen}
        killerName={killerName}
        finalMass={finalStats.mass}
        kills={finalStats.kills}
        survivalTimeSec={finalStats.survivalSec}
        solValue={currentSolValue}
        initialDeposit={connectedWallet.isConnected ? (selectedStake > 0 ? selectedStake : 0.005) : 0}
        onPlayAgain={connectedWallet.isConnected ? handlePlayWallet : handlePlayGuest}
        onSpectate={handleSpectate}
        onOpenMenu={() => {
          setIsGameOverModalOpen(false);
          setIsMenuOpen(true);
        }}
        darkMode={darkMode}
      />

      {/* Cash Out & Atomic Settlement Modal */}
      <CashOutModal
        isOpen={isCashOutModalOpen}
        onClose={() => {
          setIsCashOutModalOpen(false);
          setCashOutTxHash(null);
          setIsMenuOpen(true);
        }}
        playerMass={playerMass}
        initialDeposit={selectedStake}
        finalSol={currentSolValue}
        kills={kills}
        txHash={cashOutTxHash}
        isProcessing={isProcessingCashOut}
        onConfirmCashOut={handleConfirmCashOut}
        darkMode={darkMode}
      />

      {/* Live Blockchain Transaction Toast Banner */}
      {txStatus && (
        <div
          style={{
            position: 'fixed',
            bottom: 24,
            right: 24,
            maxWidth: 420,
            zIndex: 500,
            backgroundColor: darkMode ? '#1e293b' : '#ffffff',
            border: `2px solid ${
              txStatus.type === 'error'
                ? '#ef4444'
                : txStatus.type === 'success'
                ? '#00E676'
                : '#3b82f6'
            }`,
            padding: '12px 16px',
            boxShadow: '0 12px 32px rgba(0, 0, 0, 0.4)',
            display: 'flex',
            flexDirection: 'column',
            gap: 6,
            fontFamily: 'Ubuntu, sans-serif',
          }}
        >
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 10 }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
              {txStatus.type === 'info' && <Loader2 size={16} className="spin" style={{ color: '#3b82f6' }} />}
              {txStatus.type === 'success' && <CheckCircle2 size={16} style={{ color: '#00E676' }} />}
              {txStatus.type === 'error' && <AlertTriangle size={16} style={{ color: '#ef4444' }} />}
              <span
                style={{
                  fontSize: 12,
                  fontWeight: 700,
                  color: darkMode ? '#f8fafc' : '#0f172a',
                }}
              >
                {txStatus.message}
              </span>
            </div>
            <button
              onClick={() => setTxStatus(null)}
              style={{
                background: 'none',
                border: 'none',
                cursor: 'pointer',
                color: '#94a3b8',
                padding: 2,
              }}
            >
              <X size={14} />
            </button>
          </div>

          {txStatus.txSig && (
            <a
              href={`https://explorer.solana.com/tx/${txStatus.txSig}?cluster=devnet`}
              target="_blank"
              rel="noreferrer"
              style={{
                display: 'inline-flex',
                alignItems: 'center',
                gap: 4,
                color: '#3b82f6',
                fontSize: 11,
                fontWeight: 600,
                textDecoration: 'underline',
                fontFamily: 'JetBrains Mono, monospace',
              }}
            >
              <span>View On Solana Explorer ({txStatus.txSig.slice(0, 8)}...)</span>
              <ExternalLink size={12} />
            </a>
          )}
        </div>
      )}
    </div>
  );
};

export default App;
