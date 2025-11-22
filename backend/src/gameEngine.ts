import { PHYSICS_CONSTANTS, GAME_CONSTANTS, updatePlayerPhysics, checkBoundaryCollision, handlePlatformCollision, checkPlatformCollision } from './physics';

interface ServerPlayer {
  x: number;
  y: number;
  vx: number;
  vy: number;
  angle: number;
  rv: number;
  dead: boolean;
}

interface ServerInput {
  id: number;
  keys: {
    ArrowUp: boolean;
    ArrowLeft: boolean;
    ArrowRight: boolean;
  };
}

export class ServerGameEngine {
  gameId: string;
  playerRedId: string;
  playerBlueId: string;

  players: { red: ServerPlayer; blue: ServerPlayer };
  scores: { red: number; blue: number } = { red: 0, blue: 0 };
  tick = 0;
  gameStartTime: number;
  gameRunning = false;

  // Input buffers for each player
  inputBuffers: { red: ServerInput[]; blue: ServerInput[] } = { red: [], blue: [] };
  lastProcessedInputId: { red: number; blue: number } = { red: -1, blue: -1 };

  // Platforms
  platforms: Array<{ x: number; y: number; width: number; height: number }>;

  constructor(
    gameId: string,
    playerRedId: string,
    playerBlueId: string,
    canvasWidth: number,
    canvasHeight: number
  ) {
    this.gameId = gameId;
    this.playerRedId = playerRedId;
    this.playerBlueId = playerBlueId;
    this.gameStartTime = Date.now();

    // Initialize players
    this.players = {
      red: this.createPlayer('red', canvasWidth, canvasHeight),
      blue: this.createPlayer('blue', canvasWidth, canvasHeight),
    };

    // Initialize platforms
    const { PLATFORM_WIDTH, PLATFORM_HEIGHT, PLATFORM_Y_RATIO } = GAME_CONSTANTS;
    const platformY = canvasHeight * PLATFORM_Y_RATIO;

    this.platforms = [
      {
        x: 50,
        y: platformY,
        width: PLATFORM_WIDTH,
        height: PLATFORM_HEIGHT,
      },
      {
        x: canvasWidth - 50 - PLATFORM_WIDTH,
        y: platformY,
        width: PLATFORM_WIDTH,
        height: PLATFORM_HEIGHT,
      },
    ];
  }

  private createPlayer(color: 'red' | 'blue', canvasWidth: number, canvasHeight: number): ServerPlayer {
    const margin = 150;
    const startHeight = canvasHeight * 0.6;

    if (color === 'red') {
      return {
        x: margin,
        y: startHeight,
        vx: 0,
        vy: 0,
        angle: -Math.PI / 2,
        rv: 0,
        dead: false,
      };
    } else {
      return {
        x: canvasWidth - margin,
        y: startHeight,
        vx: 0,
        vy: 0,
        angle: -Math.PI / 2,
        rv: 0,
        dead: false,
      };
    }
  }

  /**
   * Add input to buffer for a player
   */
  addInput(color: 'red' | 'blue', input: ServerInput) {
    this.inputBuffers[color].push(input);
    this.lastProcessedInputId[color] = Math.max(this.lastProcessedInputId[color], input.id);
  }

  /**
   * Main game tick (run at 30 TPS)
   */
  tick_() {
    if (!this.gameRunning) return;

    this.tick++;

    // Process inputs for both players
    for (const color of ['red', 'blue'] as const) {
      const inputs = this.inputBuffers[color];
      for (const input of inputs) {
        const player = this.players[color];
        this.applyInput(player, input);
      }
      this.inputBuffers[color] = [];
    }

    // Update physics for both players
    this.updatePhysics();

    // Check collisions and deaths
    this.checkCollisions();

    // Check round end conditions
    this.checkRoundEnd();
  }

  private applyInput(player: ServerPlayer, input: ServerInput) {
    if (player.dead) return;

    const physicsInput = {
      thrust: input.keys.ArrowUp,
      rotateLeft: input.keys.ArrowLeft,
      rotateRight: input.keys.ArrowRight,
    };

    updatePlayerPhysics(player, physicsInput, 1920, 1080); // Use default canvas size
  }

  private updatePhysics() {
    for (const color of ['red', 'blue'] as const) {
      const player = this.players[color];
      if (!player.dead) {
        // Physics already applied in applyInput
        // This is mainly for gravity and drag which are applied there
      }
    }
  }

  private checkCollisions() {
    const canvasWidth = 1920;
    const canvasHeight = 1080;

    for (const color of ['red', 'blue'] as const) {
      const player = this.players[color];
      if (player.dead) continue;

      // Platform collisions
      for (const platform of this.platforms) {
        if (checkPlatformCollision(player, platform.x, platform.y, platform.width, platform.height)) {
          handlePlatformCollision(player, platform.x, platform.y, platform.width, platform.height);
        }
      }

      // Boundary collision = death
      if (checkBoundaryCollision(player, canvasWidth, canvasHeight)) {
        this.playerDied(color);
      }
    }
  }

  private playerDied(color: 'red' | 'blue') {
    const player = this.players[color];
    if (!player.dead) {
      player.dead = true;
      const winner = color === 'red' ? 'blue' : 'red';
      this.scores[winner]++;
    }
  }

  private checkRoundEnd() {
    if (this.scores.red >= GAME_CONSTANTS.FIRST_TO || this.scores.blue >= GAME_CONSTANTS.FIRST_TO) {
      this.gameRunning = false;
    }
  }

  /**
   * Get current game state
   */
  getState() {
    return {
      tick: this.tick,
      players: {
        red: this.players.red,
        blue: this.players.blue,
      },
      scores: this.scores,
    };
  }

  /**
   * Get last processed input IDs for both players
   */
  getLastProcessedInputIds() {
    return {
      red: this.lastProcessedInputId.red,
      blue: this.lastProcessedInputId.blue,
    };
  }

  /**
   * Start the game
   */
  start() {
    this.gameRunning = true;
  }

  /**
   * Reset for next round
   */
  resetRound() {
    this.players.red = this.createPlayer('red', 1920, 1080);
    this.players.blue = this.createPlayer('blue', 1920, 1080);
    this.tick = 0;
    this.gameRunning = true;
  }

  /**
   * Check if game is over
   */
  isGameOver(): boolean {
    return this.scores.red >= GAME_CONSTANTS.FIRST_TO || this.scores.blue >= GAME_CONSTANTS.FIRST_TO;
  }

  /**
   * Get winner
   */
  getWinner(): 'red' | 'blue' | null {
    if (this.scores.red >= GAME_CONSTANTS.FIRST_TO) return 'red';
    if (this.scores.blue >= GAME_CONSTANTS.FIRST_TO) return 'blue';
    return null;
  }
}
