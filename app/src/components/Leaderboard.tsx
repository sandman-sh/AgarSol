import React from 'react';

export interface LeaderboardEntry {
  rank: number;
  name: string;
  mass: number;
  solValue: number;
  kills: number;
  isCurrentPlayer?: boolean;
}

interface LeaderboardProps {
  entries: LeaderboardEntry[];
  darkMode?: boolean;
}

export const Leaderboard: React.FC<LeaderboardProps> = ({ entries }) => {
  const [collapsed, setCollapsed] = React.useState(() => {
    if (typeof window !== 'undefined') {
      return window.innerWidth < 860 || window.innerHeight < 550;
    }
    return false;
  });

  return (
    <div
      className="agar-leaderboard-container"
      style={{
        position: 'absolute',
        top: 14,
        right: 14,
        width: collapsed ? 'auto' : 180,
        backgroundColor: '#0f172a',
        border: '2px solid #334155',
        borderRadius: 0,
        padding: collapsed ? '4px 8px' : '8px 12px',
        boxShadow: '0 8px 24px rgba(0, 0, 0, 0.4)',
        zIndex: 90,
        pointerEvents: 'auto',
        userSelect: 'none',
      }}
    >
      <div
        onClick={() => setCollapsed(!collapsed)}
        style={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          borderBottom: collapsed ? 'none' : '1px solid rgba(255, 255, 255, 0.15)',
          paddingBottom: collapsed ? 0 : 5,
          marginBottom: collapsed ? 0 : 6,
          cursor: 'pointer',
        }}
        title="Click to toggle leaderboard"
      >
        <span
          style={{
            fontSize: 13,
            fontWeight: 700,
            fontFamily: 'Ubuntu, sans-serif',
            color: '#FFFFFF',
            letterSpacing: 0.5,
          }}
        >
          🏆 Top 10
        </span>
        <span style={{ fontSize: 10, color: '#94a3b8', marginLeft: 6 }}>
          {collapsed ? '▼' : '▲'}
        </span>
      </div>

      {!collapsed && (
        <div
          className="agar-leaderboard-list"
          style={{
            display: 'flex',
            flexDirection: 'column',
            gap: 3,
            maxHeight: 'calc(100dvh - 110px)',
            overflowY: 'auto',
          }}
        >
        {entries.slice(0, 10).map((entry) => {
          const isMe = entry.isCurrentPlayer;
          return (
            <div
              key={`${entry.rank}-${entry.name}`}
              style={{
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'space-between',
                fontSize: 12,
                fontFamily: 'Ubuntu, sans-serif',
                fontWeight: isMe ? 700 : 500,
                color: isMe ? '#00E676' : '#FFFFFF',
                padding: '2px 4px',
                borderRadius: 0,
                backgroundColor: isMe ? 'rgba(0, 230, 118, 0.2)' : 'transparent',
              }}
            >
              <div
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: 6,
                  overflow: 'hidden',
                  whiteSpace: 'nowrap',
                  textOverflow: 'ellipsis',
                }}
              >
                <span
                  style={{
                    color: isMe ? '#00E676' : 'rgba(255, 255, 255, 0.6)',
                    minWidth: 16,
                    fontSize: 11,
                  }}
                >
                  {entry.rank}.
                </span>
                <span
                  style={{
                    overflow: 'hidden',
                    whiteSpace: 'nowrap',
                    textOverflow: 'ellipsis',
                    maxWidth: 110,
                  }}
                >
                  {entry.name}
                </span>
              </div>
              <span
                style={{
                  fontSize: 11,
                  fontFamily: 'JetBrains Mono, monospace',
                  color: isMe ? '#00E676' : 'rgba(255, 255, 255, 0.65)',
                }}
              >
                {Math.floor(entry.mass)}
              </span>
            </div>
          );
        })}
      </div>
      )}
    </div>
  );
};
