// Frontend-specific types (imports from shared where possible)

export interface Player {
  x: number;
  y: number;
  vx: number;
  vy: number;
  angle: number;
  rv: number;
  dead: boolean;
}

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

export interface LeaderboardEntry {
  rank: number;
  display_name: string;
  elo: number;
  wins: number;
  losses: number;
  games_played: number;
  id: string;
}
