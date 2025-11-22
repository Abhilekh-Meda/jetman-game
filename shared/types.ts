// Shared types for frontend and backend

// Player state
export interface Player {
  x: number;
  y: number;
  vx: number;
  vy: number;
  angle: number;
  rv: number;
  dead: boolean;
}

// User profile
export interface UserProfile {
  id: string;
  email: string;
  display_name: string;
  avatar_url: string | null;
  elo: number;
  games_played: number;
  wins: number;
  losses: number;
  created_at: string;
  last_played_at: string | null;
}

// Game state
export interface GameState {
  tick: number;
  players: {
    red: Player;
    blue: Player;
  };
  scores: {
    red: number;
    blue: number;
  };
}

// Input from player
export interface PlayerInput {
  id: number;
  keys: {
    ArrowUp: boolean;
    ArrowLeft: boolean;
    ArrowRight: boolean;
  };
  timestamp: number;
}

// Game session info
export interface GameSession {
  id: string;
  creatorId: string;
  creatorName: string;
  opponentId: string | null;
  opponentName: string | null;
  status: 'waiting' | 'ready' | 'in_progress' | 'finished';
  playerRed: string;
  playerBlue: string | null;
  createdAt: number;
  expiresAt: number;
}

// Match result
export interface MatchResult {
  gameId: string;
  winnerId: string;
  loserId: string;
  winnerElo: number;
  loserElo: number;
  winnerEloChange: number;
  loserEloChange: number;
  finalScoreWinner: number;
  finalScoreLoser: number;
  matchType: 'ranked' | 'private';
  forfeit: boolean;
  duration: number; // seconds
}

// Leaderboard entry
export interface LeaderboardEntry {
  rank: number;
  display_name: string;
  elo: number;
  wins: number;
  losses: number;
  games_played: number;
  id: string;
}
