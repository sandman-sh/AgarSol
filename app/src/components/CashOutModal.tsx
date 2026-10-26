import { CheckCircle2, ExternalLink, Trophy } from 'lucide-react';

interface CashOutModalProps {
  isOpen: boolean;
  onClose: () => void;
  playerMass: number;
  initialDeposit: number;
  finalSol: number;
  kills: number;
  txHash: string | null;
  isProcessing: boolean;
  onConfirmCashOut: () => void;
  darkMode?: boolean;
}

export const CashOutModal: React.FC<CashOutModalProps> = ({
  isOpen,
  onClose,
  playerMass,
  initialDeposit,
  finalSol,
  kills,
  txHash,
  isProcessing,
  onConfirmCashOut,
  darkMode = false,
}) => {
  if (!isOpen) return null;

  const profitSol = finalSol - initialDeposit;
  const roiPct = initialDeposit > 0 ? (profitSol / initialDeposit) * 100 : 0;

  return (
    <div
      style={{
        position: 'fixed',
        inset: 0,
        backgroundColor: 'rgba(5, 10, 20, 0.78)',
        backdropFilter: 'blur(10px)',
        WebkitBackdropFilter: 'blur(10px)',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        zIndex: 400,
        padding: 20,
      }}
    >
      <div
        className="agar-main-card"
        style={{
          width: '90%',
          maxWidth: 440,
          padding: '24px 22px',
          textAlign: 'center',
          backgroundColor: darkMode ? '#1e293b' : '#ffffff',
          color: darkMode ? '#f8fafc' : '#1e293b',
          borderRadius: 18,
          border: '2px solid #00E676',
          boxShadow: '0 20px 60px rgba(0, 0, 0, 0.6), 0 0 30px rgba(0, 230, 118, 0.2)',
        }}
      >
        <div
          style={{
            width: 54,
            height: 54,
            borderRadius: 14,
            background: 'linear-gradient(135deg, #00FF87 0%, #00C853 100%)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            margin: '0 auto 12px',
            color: '#0b0f19',
            boxShadow: '0 6px 18px rgba(0, 230, 118, 0.35)',
          }}
        >
          <Trophy size={28} />
        </div>

        <h2 style={{ fontSize: 22, fontWeight: 800, fontFamily: 'Ubuntu, sans-serif', margin: 0 }}>
          Extraction Zone Reached!
        </h2>
        <p style={{ fontSize: 13, color: '#64748b', marginTop: 4 }}>
          Atomic Settlement: Undelegating from Rollup $\rightarrow$ Solana Devnet L1
        </p>

        {/* Stats Grid (Flat Square) */}
        <div
          style={{
            display: 'grid',
            gridTemplateColumns: 'repeat(3, 1fr)',
            gap: 8,
            margin: '20px 0',
          }}
        >
          <div
            style={{
              background: darkMode ? '#0f172a' : '#f1f5f9',
              borderRadius: 10,
              border: darkMode ? '2px solid #334155' : '2px solid #cbd5e1',
              padding: 10,
            }}
          >
            <span style={{ fontSize: 11, color: '#64748b', display: 'block', fontWeight: 700 }}>MASS</span>
            <span
              style={{
                fontSize: 16,
                fontWeight: 700,
                color: '#3B82F6',
                fontFamily: 'JetBrains Mono, monospace',
              }}
            >
              {Math.floor(playerMass)}
            </span>
          </div>

          <div
            style={{
              background: darkMode ? '#0f172a' : '#f1f5f9',
              borderRadius: 10,
              border: darkMode ? '2px solid #334155' : '2px solid #cbd5e1',
              padding: 10,
            }}
          >
            <span style={{ fontSize: 11, color: '#64748b', display: 'block', fontWeight: 700 }}>KILLS</span>
            <span
              style={{
                fontSize: 16,
                fontWeight: 700,
                color: '#EF4444',
                fontFamily: 'JetBrains Mono, monospace',
              }}
            >
              {kills}
            </span>
          </div>

          <div
            style={{
              background: darkMode ? '#0f172a' : '#f1f5f9',
              borderRadius: 10,
              border: darkMode ? '2px solid #334155' : '2px solid #cbd5e1',
              padding: 10,
            }}
          >
            <span style={{ fontSize: 11, color: '#64748b', display: 'block', fontWeight: 700 }}>PAYOUT</span>
            <span
              style={{
                fontSize: 16,
                fontWeight: 700,
                color: '#00E676',
                fontFamily: 'JetBrains Mono, monospace',
              }}
            >
              {finalSol.toFixed(4)} SOL
            </span>
          </div>
        </div>

        {/* Profit Breakdown (Flat Square) */}
        <div
          style={{
            background: darkMode ? '#0f172a' : '#f8fafc',
            border: darkMode ? '2px solid #334155' : '2px solid #cbd5e1',
            borderRadius: 12,
            padding: 14,
            marginBottom: 20,
            textAlign: 'left',
            fontSize: 13,
          }}
        >
          <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 6 }}>
            <span style={{ color: '#64748b' }}>Initial Stake:</span>
            <span style={{ fontFamily: 'JetBrains Mono, monospace', fontWeight: 600 }}>
              {initialDeposit.toFixed(4)} SOL
            </span>
          </div>
          <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 6 }}>
            <span style={{ color: '#64748b' }}>Net Profit:</span>
            <span
              style={{
                fontFamily: 'JetBrains Mono, monospace',
                color: profitSol >= 0 ? '#00E676' : '#EF4444',
                fontWeight: 700,
              }}
            >
              {profitSol >= 0 ? `+${profitSol.toFixed(4)} SOL` : `${profitSol.toFixed(4)} SOL`} (
              {roiPct >= 0 ? `+${roiPct.toFixed(1)}%` : `${roiPct.toFixed(1)}%`})
            </span>
          </div>
          <div
            style={{
              borderTop: darkMode ? '1px solid rgba(255, 255, 255, 0.1)' : '1px solid #cbd5e1',
              paddingTop: 6,
              display: 'flex',
              justifyContent: 'space-between',
              fontWeight: 700,
            }}
          >
            <span>Total Extraction:</span>
            <span style={{ fontFamily: 'JetBrains Mono, monospace', color: '#00E676' }}>
              {finalSol.toFixed(4)} SOL
            </span>
          </div>
        </div>

        {/* Verification Checklist */}
        <div
          style={{
            textAlign: 'left',
            marginBottom: 20,
            display: 'flex',
            flexDirection: 'column',
            gap: 6,
            fontSize: 12,
          }}
        >
          <div style={{ display: 'flex', alignItems: 'center', gap: 8, color: '#00E676' }}>
            <CheckCircle2 size={14} />
            <span>Ephemeral Rollup state verified</span>
          </div>
          <div
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: 8,
              color: isProcessing ? '#F59E0B' : '#00E676',
            }}
          >
            <CheckCircle2 size={14} />
            <span>State committed & undelegated to Solana Base Layer</span>
          </div>
          <div
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: 8,
              color: txHash ? '#00E676' : '#94A3B8',
            }}
          >
            <CheckCircle2 size={14} />
            <span>Vault payout transfer executed on Devnet</span>
          </div>
        </div>

        {txHash && (
          <div style={{ marginBottom: 16 }}>
            <a
              href={`https://explorer.solana.com/tx/${txHash}?cluster=devnet`}
              target="_blank"
              rel="noreferrer"
              style={{
                color: '#3B82F6',
                fontSize: 12,
                display: 'inline-flex',
                alignItems: 'center',
                gap: 4,
                textDecoration: 'underline',
                fontWeight: 600,
              }}
            >
              <span>View Settlement on Solana Explorer</span>
              <ExternalLink size={12} />
            </a>
          </div>
        )}

        <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
          {initialDeposit > 0 ? (
            !txHash ? (
              <button
                className="btn-agar-play"
                disabled={isProcessing}
                onClick={onConfirmCashOut}
                style={{ width: '100%', fontSize: 16, padding: '12px' }}
              >
                {isProcessing ? 'SETTLING ON SOLANA DEVNET...' : 'CONFIRM CASH OUT & EXTRACT'}
              </button>
            ) : (
              <button
                className="btn-agar-play"
                onClick={onClose}
                style={{ width: '100%', fontSize: 16, padding: '12px' }}
              >
                RETURN TO LOBBY
              </button>
            )
          ) : (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
              <div
                style={{
                  backgroundColor: darkMode ? '#0f172a' : '#f8fafc',
                  border: '1px solid #3b82f6',
                  borderRadius: 10,
                  padding: '10px 12px',
                  fontSize: 12,
                  color: darkMode ? '#94a3b8' : '#64748b',
                  textAlign: 'left',
                }}
              >
                💡 <strong>Guest Mode (Practice):</strong> You played with 0 SOL stake for free. To absorb rivals' SOL and extract real payouts from the Arena Vault, connect your Solana wallet in the lobby!
              </div>
              <button
                className="btn-agar-play"
                onClick={onClose}
                style={{ width: '100%', fontSize: 15, padding: '12px' }}
              >
                RETURN TO LOBBY & PLAY WITH WALLET
              </button>
            </div>
          )}

          {!isProcessing && !txHash && (
            <button className="btn-agar-ghost" onClick={onClose} style={{ width: '100%' }}>
              CONTINUE PLAYING
            </button>
          )}
        </div>
      </div>
    </div>
  );
};
