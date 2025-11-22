"use strict";
// Shared physics constants and functions
// These MUST be identical between client and server for deterministic gameplay
Object.defineProperty(exports, "__esModule", { value: true });
exports.GAME_CONSTANTS = exports.PHYSICS_CONSTANTS = void 0;
exports.updatePlayerPhysics = updatePlayerPhysics;
exports.checkBoundaryCollision = checkBoundaryCollision;
exports.checkPlatformCollision = checkPlatformCollision;
exports.handlePlatformCollision = handlePlatformCollision;
exports.PHYSICS_CONSTANTS = {
    GRAVITY: 0.18,
    THRUST_POWER: 0.45,
    ROTATION_ACCEL: 0.008,
    ANGULAR_DRAG: 0.95,
    DRAG: 0.99,
    BOUNCE: 0.4,
    PLAYER_WIDTH: 30,
    PLAYER_HEIGHT: 60,
    PLAYER_RADIUS: 28,
    PLAYER_MASS: 2,
    COLLISION_FORCE: 1.3,
};
exports.GAME_CONSTANTS = {
    FIRST_TO: 10,
    PLATFORM_WIDTH: 120,
    PLATFORM_HEIGHT: 20,
    PLATFORM_Y_RATIO: 0.6, // 60% from top
    SERVER_TPS: 30, // Ticks per second
    CLIENT_FPS: 60, // Frames per second
};
function updatePlayerPhysics(player, input, canvasWidth, canvasHeight) {
    if (player.dead)
        return;
    const { GRAVITY, THRUST_POWER, ROTATION_ACCEL, ANGULAR_DRAG, DRAG } = exports.PHYSICS_CONSTANTS;
    // Apply rotational physics
    if (input.rotateLeft)
        player.rv -= ROTATION_ACCEL;
    if (input.rotateRight)
        player.rv += ROTATION_ACCEL;
    player.angle += player.rv;
    player.rv *= ANGULAR_DRAG;
    // Apply thrust
    if (input.thrust) {
        player.vx += Math.cos(player.angle) * THRUST_POWER;
        player.vy += Math.sin(player.angle) * THRUST_POWER;
    }
    // Apply gravity and drag
    player.vy += GRAVITY;
    player.vx *= DRAG;
    player.vy *= DRAG;
    // Update position
    player.x += player.vx;
    player.y += player.vy;
}
function checkBoundaryCollision(player, canvasWidth, canvasHeight) {
    const { PLAYER_RADIUS } = exports.PHYSICS_CONSTANTS;
    return (player.x - PLAYER_RADIUS < 0 ||
        player.x + PLAYER_RADIUS > canvasWidth ||
        player.y - PLAYER_RADIUS < 0 ||
        player.y + PLAYER_RADIUS > canvasHeight);
}
function checkPlatformCollision(player, platformX, platformY, platformWidth, platformHeight) {
    const { PLAYER_RADIUS } = exports.PHYSICS_CONSTANTS;
    const closestX = Math.max(platformX, Math.min(player.x, platformX + platformWidth));
    const closestY = Math.max(platformY, Math.min(player.y, platformY + platformHeight));
    const distX = player.x - closestX;
    const distY = player.y - closestY;
    return distX * distX + distY * distY < PLAYER_RADIUS * PLAYER_RADIUS;
}
function handlePlatformCollision(player, platformX, platformY, platformWidth, platformHeight) {
    const { BOUNCE, PLAYER_RADIUS } = exports.PHYSICS_CONSTANTS;
    // Find closest point on platform
    let closestX = Math.max(platformX, Math.min(player.x, platformX + platformWidth));
    let closestY = Math.max(platformY, Math.min(player.y, platformY + platformHeight));
    // Push player away
    let pushX = player.x - closestX;
    let pushY = player.y - closestY;
    const dist = Math.sqrt(pushX * pushX + pushY * pushY);
    if (dist === 0) {
        pushX = 1;
        pushY = 0;
    }
    else {
        pushX /= dist;
        pushY /= dist;
    }
    // Move player away from platform
    player.x = closestX + pushX * PLAYER_RADIUS;
    player.y = closestY + pushY * PLAYER_RADIUS;
    // Reflect velocity
    const dotProduct = player.vx * pushX + player.vy * pushY;
    player.vx = (player.vx - 2 * dotProduct * pushX) * BOUNCE;
    player.vy = (player.vy - 2 * dotProduct * pushY) * BOUNCE;
}
