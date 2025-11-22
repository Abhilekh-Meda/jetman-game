import { Player, GameState } from './types';
import { PHYSICS_CONSTANTS, GAME_CONSTANTS, updatePlayerPhysics, checkBoundaryCollision, handlePlatformCollision, checkPlatformCollision } from '../../shared/physics';

export interface PlayerInput {
  id: number;
  keys: {
    ArrowUp: boolean;
    ArrowLeft: boolean;
    ArrowRight: boolean;
  };
  timestamp: number;
}

export class ClientGameEngine {
  gameId: string;
  color: 'red' | 'blue';
  canvasWidth: number;
  canvasHeight: number;

  localPlayer: Player;
  remotePlayer: Player;
  pendingInputs: PlayerInput[] = [];
  inputSequence = 0;
  scores = { red: 0, blue: 0 };
  tick = 0;

  // Platforms
  platforms: Array<{ x: number; y: number; width: number; height: number }> = [];

  constructor(gameId: string, color: 'red' | 'blue', canvasWidth: number, canvasHeight: number) {
    this.gameId = gameId;
    this.color = color;
    this.canvasWidth = canvasWidth;
    this.canvasHeight = canvasHeight;

    // Initialize players
    this.localPlayer = this.createPlayer(color);
    this.remotePlayer = this.createPlayer(color === 'red' ? 'blue' : 'red');

    // Initialize platforms
    this.initializePlatforms();
  }

  private createPlayer(color: 'red' | 'blue'): Player {
    const margin = 150;
    const startHeight = this.canvasHeight * 0.6;

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
        x: this.canvasWidth - margin,
        y: startHeight,
        vx: 0,
        vy: 0,
        angle: -Math.PI / 2,
        rv: 0,
        dead: false,
      };
    }
  }

  private initializePlatforms() {
    const { PLATFORM_WIDTH, PLATFORM_HEIGHT, PLATFORM_Y_RATIO } = GAME_CONSTANTS;
    const platformY = this.canvasHeight * PLATFORM_Y_RATIO;

    this.platforms = [
      {
        x: 50,
        y: platformY,
        width: PLATFORM_WIDTH,
        height: PLATFORM_HEIGHT,
      },
      {
        x: this.canvasWidth - 50 - PLATFORM_WIDTH,
        y: platformY,
        width: PLATFORM_WIDTH,
        height: PLATFORM_HEIGHT,
      },
    ];
  }

  /**
   * Apply input to local player (client-side prediction)
   */
  applyInput(player: Player, input: PlayerInput) {
    const physicsInput = {
      thrust: input.keys.ArrowUp,
      rotateLeft: input.keys.ArrowLeft,
      rotateRight: input.keys.ArrowRight,
    };

    updatePlayerPhysics(player, physicsInput, this.canvasWidth, this.canvasHeight);

    // Check platform collisions
    for (const platform of this.platforms) {
      if (checkPlatformCollision(player, platform.x, platform.y, platform.width, platform.height)) {
        handlePlatformCollision(player, platform.x, platform.y, platform.width, platform.height);
      }
    }

    // Check boundary collision (death)
    if (checkBoundaryCollision(player, this.canvasWidth, this.canvasHeight)) {
      player.dead = true;
    }
  }

  /**
   * Handle user input and send to server
   */
  handleInput(keys: Record<string, boolean>): PlayerInput {
    const input: PlayerInput = {
      id: this.inputSequence++,
      keys: {
        ArrowUp: keys['ArrowUp'] || keys['KeyW'] || false,
        ArrowLeft: keys['ArrowLeft'] || keys['KeyA'] || false,
        ArrowRight: keys['ArrowRight'] || keys['KeyD'] || false,
      },
      timestamp: Date.now(),
    };

    // Apply locally immediately (prediction)
    this.applyInput(this.localPlayer, input);

    // Store for reconciliation
    this.pendingInputs.push(input);

    return input;
  }

  /**
   * Reconcile with server state
   */
  reconcile(serverState: GameState, lastProcessedInputId: number) {
    // Remove inputs that server has processed
    this.pendingInputs = this.pendingInputs.filter((input) => input.id > lastProcessedInputId);

    // Reset to server state
    this.localPlayer = { ...serverState.players[this.color] };

    // Re-apply pending inputs
    for (const input of this.pendingInputs) {
      this.applyInput(this.localPlayer, input);
    }

    // Update remote player and scores
    this.remotePlayer = { ...serverState.players[this.color === 'red' ? 'blue' : 'red'] };
    this.scores = { ...serverState.scores };
    this.tick = serverState.tick;
  }

  /**
   * Get current game state for rendering
   */
  getState(): GameState {
    return {
      tick: this.tick,
      players: {
        red: this.color === 'red' ? this.localPlayer : this.remotePlayer,
        blue: this.color === 'blue' ? this.localPlayer : this.remotePlayer,
      },
      scores: this.scores,
    };
  }

  /**
   * Reset round (players respawn, scores continue)
   */
  resetRound() {
    this.localPlayer = this.createPlayer(this.color);
    this.remotePlayer = this.createPlayer(this.color === 'red' ? 'blue' : 'red');
    this.pendingInputs = [];
  }

  /**
   * Reset game (for new match)
   */
  reset() {
    this.resetRound();
    this.scores = { red: 0, blue: 0 };
    this.inputSequence = 0;
    this.tick = 0;
  }
}
