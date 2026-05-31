// Canvas and UI elements. The canvas is where the game is drawn; the
// message/health elements are normal HTML text below it.
const canvas = document.getElementById("game");
const ctx = canvas.getContext("2d");
const messageEl = document.getElementById("message");
const healthEl = document.getElementById("health");
const specialEl = document.getElementById("special");
const level2Button = document.getElementById("level2");
const level3Button = document.getElementById("level3");
const level4Button = document.getElementById("level4");
const newGameButton = document.getElementById("new-game");
const restartButton = document.getElementById("restart");

// Core tuning values. Most "feel" changes can be made here without touching
// collision or rendering code.
const WIDTH = canvas.width;
const HEIGHT = canvas.height;
const GRAVITY = 0.1;
const MOVE_SPEED = 2.25;
const JUMP_POWER = 5;
const CLIMB_SPEED = 3.2;
const LANDING_JUMP_COOLDOWN = 24;
const PLAYER_ATTACK_COOLDOWN = 44;
const DOWN_ATTACK_BOUNCE = 5.5;
const BOSS_SWORD_LENGTH = 82;
const BOSS_SWORD_WIDTH = 10;
const PROJECTILE_SPEED = 1.2;
const PROJECTILE_RADIUS = 8;
const SHOOTER_COOLDOWN = 230;
const WALL_TRAP_PROJECTILE_SPEED = 2.1;
const LEVEL_UNLOCK_TRANSITION_FRAMES = 120;
const BOSS_SIDE_SWORD_SWAP_FRAMES = 120;
const SPECIAL_CHARGE_FRAMES = 60;
const SPECIAL_COOLDOWN_FRAMES = 300;

// Input and animation state that exists outside a single game reset.
const keys = new Set();
let attackRequested = false;
let requestedAttackType = "normal";
let lastTime = 0;
let currentLevelIndex = 0;
let checkpointLevelIndex = 0;
let pogoUnlocked = false;
let specialWeaponUnlocked = false;
let specialCharging = false;
let specialChargeTimer = 0;
let specialCooldown = 0;
let pendingLevelIndex = null;
let transitionMessages = [];
let game;

function isHolding(...bindings) {
  return bindings.some((binding) => keys.has(binding));
}

// Level definitions. Each level owns its route geometry, hazards, enemies, and
// boss. The loader below copies this data into mutable runtime objects.
const levels = [
  {
    name: "Level 1",
    message: "Start top-left, work around the level, and defeat the boss at bottom-right.",
    playerStart: { x: 52, y: 50 },
    // Solid rectangles. These include floors, walls, and route blockers.
    // The collision code treats all of them the same way.
    platforms: [
      { x: 0, y: 508, w: 960, h: 32 },
      { x: 0, y: 0, w: 28, h: 508 },
      { x: 36, y: 96, w: 808, h: 18 },
      { x: 932, y: 96, w: 28, h: 412 },
      { x: 108, y: 286, w: 748, h: 18 },
      { x: 856, y: 286, w: 104, h: 222 },
      { x: 28, y: 386, w: 32, h: 122 },
    ],
    ladders: [],
    // Spike rectangles damage the player on overlap. They are drawn as triangle
    // clusters, but their gameplay hitbox is this simple rectangle.
    spikes: [
      { x: 665, y: 270, w: 30, h: 16 },
      { x: 505, y: 270, w: 30, h: 16 },
      { x: 330, y: 270, w: 30, h: 16 },
      { x: 306, y: 492, w: 32, h: 16 },
      { x: 507, y: 492, w: 32, h: 16 },
    ],
    // Each enemy patrols between left and right using its vx value.
    enemies: [
      { x: 520, y: 60, w: 28, h: 36, left: 440, right: 790, vx: 1.05, alive: true },
      { x: 705, y: 250, w: 28, h: 36, left: 520, right: 815, vx: -1.05, alive: true },
      { x: 240, y: 472, w: 28, h: 36, left: 140, right: 360, vx: 1.1, alive: true },
    ],
    // The boss is also a patrolling rectangle, with a separate rotating sword.
    boss: {
      x: 786,
      y: 456,
      w: 54,
      h: 52,
      left: 550,
      right: 856,
      vx: 1.45,
      health: 3,
      invincible: 0,
      swordAngle: -0.8,
      alive: true,
    },
  },
  {
    name: "Level 2",
    message: "Level 2: health restored. Cross the lower gauntlet and defeat the next boss.",
    playerStart: { x: 54, y: 38 },
    platforms: [
      { x: 0, y: 508, w: 960, h: 32 },
      { x: 0, y: 0, w: 28, h: 508 },
      { x: 34, y: 84, w: 760, h: 18 },
      { x: 922, y: 84, w: 38, h: 424 },
      { x: 136, y: 218, w: 722, h: 18 },
      { x: 858, y: 218, w: 102, h: 290 },
      { x: 28, y: 344, w: 38, h: 164 },
      { x: 66, y: 344, w: 690, h: 18 },
    ],
    ladders: [],
    spikes: [
      { x: 562, y: 208, w: 22, h: 10 },
      { x: 407, y: 208, w: 22, h: 10 },
      { x: 222, y: 208, w: 22, h: 10 },
      { x: 520, y: 328, w: 30, h: 16 },
      { x: 180, y: 492, w: 32, h: 16 },
      { x: 370, y: 492, w: 32, h: 16 },
      { x: 570, y: 492, w: 32, h: 16 },
    ],
    enemies: [
      { x: 392, y: 48, w: 28, h: 36, left: 300, right: 735, vx: 1.15, alive: true },
      { x: 690, y: 182, w: 28, h: 36, left: 150, right: 840, vx: -1.2, alive: true, shooter: true, shootCooldown: 80 },
      { x: 770, y: 472, w: 28, h: 36, left: 620, right: 856, vx: 1.15, alive: true },
    ],
    boss: {
      x: 290,
      y: 456,
      w: 58,
      h: 52,
      left: 92,
      right: 450,
      vx: 1.6,
      health: 4,
      invincible: 0,
      swordAngle: 2.2,
      alive: true,
    },
  },
  {
    name: "Level 3",
    message: "Level 3: final checkpoint. Tighter hazards, one last boss.",
    playerStart: { x: 54, y: 38 },
    platforms: [
      { x: 0, y: 508, w: 960, h: 32 },
      { x: 0, y: 0, w: 28, h: 508 },
      { x: 34, y: 84, w: 720, h: 18 },
      { x: 922, y: 84, w: 38, h: 424 },
      { x: 180, y: 196, w: 678, h: 18 },
      { x: 858, y: 196, w: 102, h: 312 },
      { x: 28, y: 320, w: 38, h: 188 },
      { x: 66, y: 320, w: 690, h: 18 },
      { x: 190, y: 430, w: 470, h: 18 },
    ],
    ladders: [],
    spikes: [
      { x: 613, y: 186, w: 18, h: 10 },
      { x: 473, y: 186, w: 18, h: 10 },
      { x: 308, y: 186, w: 18, h: 10 },
      { x: 598, y: 304, w: 30, h: 16 },
      { x: 420, y: 304, w: 30, h: 16 },
      { x: 230, y: 304, w: 30, h: 16 },
      { x: 260, y: 492, w: 32, h: 16 },
      { x: 460, y: 492, w: 32, h: 16 },
      { x: 690, y: 492, w: 32, h: 16 },
    ],
    enemies: [
      { x: 380, y: 48, w: 28, h: 36, left: 290, right: 710, vx: 1.2, alive: true },
      { x: 715, y: 160, w: 28, h: 36, left: 230, right: 825, vx: -1.25, alive: true, shooter: true, shootCooldown: 130 },
      { x: 275, y: 284, w: 28, h: 36, left: 90, right: 690, vx: 1.25, alive: true },
      { x: 575, y: 394, w: 28, h: 36, left: 210, right: 630, vx: -1.15, alive: true },
    ],
    boss: {
      x: 145,
      y: 456,
      w: 62,
      h: 52,
      left: 82,
      right: 325,
      vx: 1.75,
      health: 5,
      invincible: 0,
      swordAngle: 1.4,
      alive: true,
    },
  },
  {
    name: "Level 4",
    message: "Level 4: final arena. Use pogo, avoid the shooters, and finish the prototype.",
    playerStart: { x: 54, y: 38 },
    platforms: [
      { x: 0, y: 508, w: 960, h: 32 },
      { x: 0, y: 0, w: 28, h: 508 },
      { x: 34, y: 84, w: 760, h: 18 },
      { x: 922, y: 84, w: 38, h: 424 },
      { x: 130, y: 186, w: 672, h: 18 },
      { x: 802, y: 186, w: 120, h: 322 },
      { x: 28, y: 300, w: 42, h: 208 },
      { x: 70, y: 300, w: 640, h: 18 },
      { x: 250, y: 420, w: 552, h: 18 },
    ],
    ladders: [],
    spikes: [
      { x: 585, y: 176, w: 20, h: 10 },
      { x: 430, y: 176, w: 20, h: 10 },
      { x: 250, y: 176, w: 20, h: 10 },
      { x: 565, y: 284, w: 30, h: 16 },
      { x: 375, y: 284, w: 30, h: 16 },
      { x: 170, y: 284, w: 30, h: 16 },
      { x: 315, y: 404, w: 32, h: 16 },
      { x: 515, y: 404, w: 32, h: 16 },
      { x: 78, y: 492, w: 34, h: 16 },
    ],
    enemies: [
      { x: 425, y: 48, w: 28, h: 36, left: 300, right: 720, vx: 1.25, alive: true },
      { x: 650, y: 150, w: 28, h: 36, left: 240, right: 800, vx: -1.3, alive: true, shooter: true, shootCooldown: 95 },
      { x: 260, y: 264, w: 28, h: 36, left: 90, right: 660, vx: 1.3, alive: true },
      { x: 575, y: 384, w: 28, h: 36, left: 270, right: 690, vx: -1.2, alive: true, shooter: true, shootCooldown: 150 },
    ],
    boss: {
      x: 585,
      y: 456,
      w: 64,
      h: 52,
      left: 520,
      right: 690,
      vx: 1.85,
      health: 6,
      invincible: 0,
      swordAngle: 0.8,
      swordMode: "side",
      swordSide: -1,
      swordSideTimer: BOSS_SIDE_SWORD_SWAP_FRAMES,
      alive: true,
    },
  },
];

// These arrays point at the active level data after startLevel copies it.
let platforms = [];
let ladders = [];
let spikes = [];
let pressurePlates = [];
let wallShooters = [];

function cloneRects(rects) {
  return rects.map((rect) => ({ ...rect }));
}

// Loads one level and resets health, position, enemies, hazards, and boss.
function startLevel(levelIndex) {
  currentLevelIndex = levelIndex;
  pendingLevelIndex = null;
  if (currentLevelIndex >= 2) pogoUnlocked = true;
  const level = levels[currentLevelIndex];
  platforms = cloneRects(level.platforms);
  ladders = cloneRects(level.ladders);
  spikes = cloneRects(level.spikes);
  pressurePlates = cloneRects(level.pressurePlates || []);
  wallShooters = cloneRects(level.wallShooters || []);

  game = {
    state: "playing",
    message: level.message,
    player: {
      x: level.playerStart.x,
      y: level.playerStart.y,
      w: 28,
      h: 46,
      vx: 0,
      vy: 0,
      facing: 1,
      grounded: true,
      climbing: false,
      health: 3,
      invincible: 0,
      attackTimer: 0,
      attackCooldown: 0,
      attackMode: "side",
      jumpCooldown: 0,
    },
    enemies: cloneRects(level.enemies),
    projectiles: [],
    boss: { ...level.boss },
  };
}

// Rebuilds every object that should return to its starting position when the
// player restarts or presses R. After reaching level 2, the checkpoint starts
// restarts there instead of forcing level 1 again.
function resetGame() {
  startLevel(checkpointLevelIndex);
}

// Clears all checkpoint progress and starts from the beginning.
function newGame() {
  checkpointLevelIndex = 0;
  pogoUnlocked = false;
  specialWeaponUnlocked = false;
  specialCharging = false;
  specialChargeTimer = 0;
  specialCooldown = 0;
  transitionMessages = [];
  startLevel(0);
}

function completeLevel() {
  if (currentLevelIndex < levels.length - 1) {
    checkpointLevelIndex = currentLevelIndex + 1;
    pendingLevelIndex = checkpointLevelIndex;
    if (currentLevelIndex === 0) specialWeaponUnlocked = true;
    transitionMessages =
      currentLevelIndex === 0
        ? ["Special weapon unlocked.", `${levels[pendingLevelIndex].name} unlocked.`]
        : [
            levels[pendingLevelIndex].name === "Level 4"
              ? "Get ready for Level 4."
              : `${levels[pendingLevelIndex].name} unlocked.`,
          ];
    game.boss.alive = false;
    game.state = "transition";
    game.transitionTimer = LEVEL_UNLOCK_TRANSITION_FRAMES;
    game.message = transitionMessages.shift();
    return;
  }
  game.boss.alive = false;
  game.state = "won";
  game.message = "Final boss defeated. You cleared all four prototype levels.";
}

// Axis-aligned rectangle overlap. This is the basic collision test used for
// the player, platforms, enemies, spikes, and boss body.
function rectsOverlap(a, b) {
  return a.x < b.x + b.w && a.x + a.w > b.x && a.y < b.y + b.h && a.y + a.h > b.y;
}

// The player's physics rectangle stays full-size for clean platform movement,
// but damage checks use this smaller box so feet/bottom corners are less harsh.
function playerDamageBox() {
  const player = game.player;
  return {
    x: player.x + 5,
    y: player.y + 3,
    w: player.w - 10,
    h: player.h - 7,
  };
}

// Checks whether the center of an entity is inside a ladder rectangle.
function isOnLadder(entity) {
  const center = { x: entity.x + entity.w / 2, y: entity.y + entity.h / 2 };
  return ladders.some(
    (ladder) =>
      center.x > ladder.x &&
      center.x < ladder.x + ladder.w &&
      entity.y + entity.h > ladder.y &&
      entity.y < ladder.y + ladder.h
  );
}

// The player's sword is a short rectangle that appears only while attackTimer
// is active. Side attacks extend horizontally; down attacks extend below the
// player. Downward hits bounce only after that ability is unlocked.
function attackBox(player) {
  if (player.attackTimer <= 0) return null;
  if (player.attackMode === "down") {
    return {
      x: player.x - 12,
      y: player.y + player.h,
      w: player.w + 24,
      h: 44,
      mode: "down",
    };
  }
  if (player.attackMode === "special") {
    return {
      x: player.facing > 0 ? player.x + player.w : player.x - 70,
      y: player.y + 15,
      w: 70,
      h: 10,
      mode: "special",
    };
  }
  return {
    x: player.facing > 0 ? player.x + player.w : player.x - 36,
    y: player.y + 8,
    w: 36,
    h: 22,
    mode: "side",
  };
}

// Converts the boss sword angle into a line segment. Rendering and damage both
// use the same line so the visual matches the hit area.
function bossSwordBox() {
  const boss = game.boss;
  const centerX = boss.x + boss.w / 2;
  const centerY = boss.y + boss.h / 2;
  if (boss.swordMode === "side") {
    const direction = boss.swordSide || 1;
    return {
      x1: centerX,
      y1: centerY,
      x2: centerX + direction * BOSS_SWORD_LENGTH,
      y2: centerY,
    };
  }
  return {
    x1: centerX,
    y1: centerY,
    x2: centerX + Math.cos(boss.swordAngle) * BOSS_SWORD_LENGTH,
    y2: centerY + Math.sin(boss.swordAngle) * BOSS_SWORD_LENGTH,
  };
}

// Approximate collision between a thick line and a rectangle by sampling points
// along the line. This is enough for the boss sword without adding geometry code.
function lineHitsRect(line, rect, width) {
  const steps = 18;
  const radius = width / 2;
  for (let i = 2; i <= steps; i += 1) {
    const t = i / steps;
    const x = line.x1 + (line.x2 - line.x1) * t;
    const y = line.y1 + (line.y2 - line.y1) * t;
    if (
      x >= rect.x - radius &&
      x <= rect.x + rect.w + radius &&
      y >= rect.y - radius &&
      y <= rect.y + rect.h + radius
    ) {
      return true;
    }
  }
  return false;
}

// Circle-vs-rectangle overlap for enemy projectile damage.
function circleHitsRect(circle, rect) {
  const nearestX = Math.max(rect.x, Math.min(circle.x, rect.x + rect.w));
  const nearestY = Math.max(rect.y, Math.min(circle.y, rect.y + rect.h));
  const dx = circle.x - nearestX;
  const dy = circle.y - nearestY;
  return dx * dx + dy * dy <= circle.r * circle.r;
}

// Purple shooters aim slowly moving shots at the player's current position.
function spawnProjectile(enemy) {
  const player = game.player;
  const startX = enemy.x + enemy.w / 2;
  const startY = enemy.y + enemy.h / 2;
  const targetX = player.x + player.w / 2;
  const targetY = player.y + player.h / 2;
  const dx = targetX - startX;
  const dy = targetY - startY;
  const length = Math.hypot(dx, dy) || 1;
  game.projectiles.push({
    x: startX,
    y: startY,
    r: PROJECTILE_RADIUS,
    vx: (dx / length) * PROJECTILE_SPEED,
    vy: (dy / length) * PROJECTILE_SPEED,
  });
}

function spawnWallTrapProjectile(shooter) {
  const player = game.player;
  const targetX = player.x + player.w / 2;
  const targetY = player.y + player.h / 2;
  const dx = targetX - shooter.x;
  const dy = targetY - shooter.y;
  const length = Math.hypot(dx, dy) || 1;
  game.projectiles.push({
    x: shooter.x,
    y: shooter.y,
    r: PROJECTILE_RADIUS,
    vx: (dx / length) * WALL_TRAP_PROJECTILE_SPEED,
    vy: (dy / length) * WALL_TRAP_PROJECTILE_SPEED,
    color: "#ff6b6b",
    safeFrames: 10,
  });
}

// Move one entity through the world and resolve platform collisions.
// Horizontal and vertical movement are handled separately so the player can
// slide along walls and land cleanly on floors.
function moveAndCollide(entity) {
  // First move sideways and push the entity out of any wall it entered.
  entity.x += entity.vx;
  for (const platform of platforms) {
    if (rectsOverlap(entity, platform)) {
      if (entity.vx > 0) entity.x = platform.x - entity.w;
      if (entity.vx < 0) entity.x = platform.x + platform.w;
      entity.vx = 0;
    }
  }

  // Then move vertically and decide whether the entity landed or hit a ceiling.
  entity.y += entity.vy;
  entity.grounded = false;
  for (const platform of platforms) {
    if (!rectsOverlap(entity, platform)) continue;
    if (entity.vy >= 0) {
      entity.y = platform.y - entity.h;
      entity.vy = 0;
      entity.grounded = true;
    } else {
      entity.y = platform.y + platform.h;
      entity.vy = 0;
    }
  }

  // Keep the entity within the canvas horizontally. Falling far below the level
  // is treated as lethal damage.
  entity.x = Math.max(0, Math.min(WIDTH - entity.w, entity.x));
  if (entity.y > HEIGHT + 80) hurtPlayer(99);
}

// Damage the player, add invincibility frames, and apply a knockback impulse.
function hurtPlayer(amount) {
  const player = game.player;
  if (player.invincible > 0 || game.state !== "playing") return;
  player.health -= amount;
  player.invincible = 80;
  player.vx = -player.facing * 7;
  player.vy = -3.5;
  player.jumpCooldown = LANDING_JUMP_COOLDOWN;
  if (player.health <= 0) {
    game.state = "lost";
    game.message = "You were defeated. Press Restart or R to try again.";
  }
}

// Read player input, update cooldowns, apply movement, jumping, gravity, and
// collision. This is the main "character controller" function.
function updatePlayer() {
  const player = game.player;
  const wasGrounded = player.grounded;
  const left = isHolding("ArrowLeft", "KeyA", "a");
  const right = isHolding("ArrowRight", "KeyD", "d");
  const up = isHolding("ArrowUp", "KeyW", "w");
  const down = isHolding("ArrowDown", "KeyS", "s");
  const jump = isHolding("Space", " ", "ArrowUp", "KeyW", "w");

  // Cooldowns tick down once per frame while the game is running.
  player.attackCooldown = Math.max(0, player.attackCooldown - 1);
  player.attackTimer = Math.max(0, player.attackTimer - 1);
  player.invincible = Math.max(0, player.invincible - 1);
  player.jumpCooldown = Math.max(0, player.jumpCooldown - 1);
  specialCooldown = Math.max(0, specialCooldown - 1);
  if (specialCharging) {
    specialChargeTimer = Math.max(0, specialChargeTimer - 1);
    if (specialChargeTimer === 0) {
      attackRequested = true;
      requestedAttackType = "special";
      specialCharging = false;
    }
  }

  // Attacks are triggered by a fresh keydown, not by holding the key.
  if (attackRequested && player.attackCooldown === 0) {
    player.attackTimer = 12;
    player.attackCooldown = PLAYER_ATTACK_COOLDOWN;
    player.attackMode =
      requestedAttackType === "special" && specialWeaponUnlocked
        ? "special"
        : pogoUnlocked && !player.grounded && down
          ? "down"
          : "side";
    if (player.attackMode === "special") specialCooldown = SPECIAL_COOLDOWN_FRAMES;
  }
  attackRequested = false;
  requestedAttackType = "normal";

  // Horizontal movement directly sets velocity for a tight prototype feel.
  player.vx = 0;
  if (left) {
    player.vx = -MOVE_SPEED;
    player.facing = -1;
  }
  if (right) {
    player.vx = MOVE_SPEED;
    player.facing = 1;
  }

  // Ladder support remains even though this level currently has no ladders.
  player.climbing = isOnLadder(player) && (up || down);
  if (player.climbing) {
    player.vy = 0;
    if (up) player.vy = -CLIMB_SPEED;
    if (down) player.vy = CLIMB_SPEED;
  } else {
    player.vy += GRAVITY;
  }

  // Jumping is locked briefly after landing so the player cannot pogo-stick.
  if (jump && player.grounded && player.jumpCooldown === 0 && !player.climbing) {
    player.vy = -JUMP_POWER;
    player.grounded = false;
    player.jumpCooldown = LANDING_JUMP_COOLDOWN;
  }

  moveAndCollide(player);

  // Starting the landing cooldown here catches normal falls and platform drops.
  if (!wasGrounded && player.grounded) {
    player.jumpCooldown = LANDING_JUMP_COOLDOWN;
  }
}

// Move enemies and boss, and check environmental damage.
function updateEnemies() {
  const playerHitbox = playerDamageBox();
  for (const enemy of game.enemies) {
    if (!enemy.alive) continue;
    // Reverse direction when a patrol reaches either end of its range.
    enemy.x += enemy.vx;
    if (enemy.x < enemy.left || enemy.x + enemy.w > enemy.right) {
      enemy.vx *= -1;
      enemy.x = Math.max(enemy.left, Math.min(enemy.right - enemy.w, enemy.x));
    }
    if (enemy.shooter) {
      enemy.shootCooldown = Math.max(0, enemy.shootCooldown - 1);
      if (enemy.shootCooldown === 0) {
        spawnProjectile(enemy);
        enemy.shootCooldown = SHOOTER_COOLDOWN;
      }
    }
    if (rectsOverlap(playerHitbox, enemy)) hurtPlayer(1);
  }

  for (const spike of spikes) {
    if (rectsOverlap(playerHitbox, spike)) hurtPlayer(1);
  }

  const boss = game.boss;
  if (boss.alive) {
    // Most bosses rotate their sword; Level 4 uses a side-snapping sword.
    boss.x += boss.vx;
    if (boss.swordMode === "side") {
      boss.swordSideTimer = Math.max(0, (boss.swordSideTimer || BOSS_SIDE_SWORD_SWAP_FRAMES) - 1);
      if (boss.swordSideTimer === 0) {
        boss.swordSide = -(boss.swordSide || 1);
        boss.swordSideTimer = BOSS_SIDE_SWORD_SWAP_FRAMES;
      }
    } else {
      boss.swordAngle += 0.035;
    }
    boss.invincible = Math.max(0, boss.invincible - 1);
    if (boss.x < boss.left || boss.x + boss.w > boss.right) {
      boss.vx *= -1;
      boss.x = Math.max(boss.left, Math.min(boss.right - boss.w, boss.x));
    }
    // The boss body and the sword line are separate damage sources.
    if (rectsOverlap(playerHitbox, boss)) hurtPlayer(1);
    if (lineHitsRect(bossSwordBox(), playerHitbox, BOSS_SWORD_WIDTH)) hurtPlayer(1);
  }
}

// Move enemy projectiles and remove them when they hit the player or leave the
// visible level area.
function updateProjectiles() {
  for (const projectile of game.projectiles) {
    projectile.x += projectile.vx;
    projectile.y += projectile.vy;
    projectile.safeFrames = Math.max(0, (projectile.safeFrames || 0) - 1);
    if (projectile.safeFrames === 0 && platforms.some((platform) => circleHitsRect(projectile, platform))) {
      projectile.hit = true;
      continue;
    }
    if (circleHitsRect(projectile, playerDamageBox())) {
      projectile.hit = true;
      hurtPlayer(1);
    }
  }

  game.projectiles = game.projectiles.filter(
    (projectile) =>
      !projectile.hit &&
      projectile.x > -40 &&
      projectile.x < WIDTH + 40 &&
      projectile.y > -40 &&
      projectile.y < HEIGHT + 40
  );
}

function updatePressurePlates() {
  const playerHitbox = playerDamageBox();
  for (const plate of pressurePlates) {
    if (plate.triggered || !rectsOverlap(playerHitbox, plate)) continue;
    plate.triggered = true;
    const shooter = wallShooters[plate.shooterIndex];
    if (shooter) spawnWallTrapProjectile(shooter);
  }
}

// Resolve player sword hits. The player's attack can destroy enemies and damage
// the boss body, but it does not interact with the boss sword.
function updateCombat() {
  const hit = attackBox(game.player);
  if (!hit) return;

  let downAttackHit = false;
  for (const enemy of game.enemies) {
    if (enemy.alive && rectsOverlap(hit, enemy)) {
      enemy.alive = false;
      downAttackHit = hit.mode === "down";
    }
  }

  const boss = game.boss;
  if (boss.alive && boss.invincible === 0 && rectsOverlap(hit, boss)) {
    downAttackHit = hit.mode === "down";
    boss.health -= 1;
    boss.invincible = 24;
    boss.vx *= -1;
    if (boss.health <= 0) {
      completeLevel();
    }
  }

  if (downAttackHit && pogoUnlocked && game.state === "playing") {
    game.player.vy = -DOWN_ATTACK_BOUNCE;
    game.player.grounded = false;
    game.player.jumpCooldown = LANDING_JUMP_COOLDOWN;
  }
}

// One simulation step. When the game is won or lost, updates stop but drawing
// continues so the end overlay stays visible.
function update() {
  if (game.state === "transition") {
    game.transitionTimer = Math.max(0, game.transitionTimer - 1);
    if (game.transitionTimer === 0 && transitionMessages.length > 0) {
      game.message = transitionMessages.shift();
      game.transitionTimer = LEVEL_UNLOCK_TRANSITION_FRAMES;
      return;
    }
    if (game.transitionTimer === 0 && pendingLevelIndex !== null) {
      const nextLevelIndex = pendingLevelIndex;
      pendingLevelIndex = null;
      transitionMessages = [];
      startLevel(nextLevelIndex);
    }
    return;
  }
  if (game.state !== "playing") return;
  updatePlayer();
  updateEnemies();
  updatePressurePlates();
  updateProjectiles();
  updateCombat();
}

// Draw a simple filled rectangle. Most objects are intentionally plain shapes
// while the prototype focuses on movement and combat.
function drawRect(rect, color) {
  ctx.fillStyle = color;
  ctx.fillRect(Math.round(rect.x), Math.round(rect.y), rect.w, rect.h);
}

// Draw ladder rectangles if any are present in the ladders array.
function drawLadders() {
  for (const ladder of ladders) {
    ctx.fillStyle = "#7b6a44";
    ctx.fillRect(ladder.x, ladder.y, 6, ladder.h);
    ctx.fillRect(ladder.x + ladder.w - 6, ladder.y, 6, ladder.h);
    for (let y = ladder.y + 10; y < ladder.y + ladder.h; y += 18) {
      ctx.fillRect(ladder.x, y, ladder.w, 5);
    }
  }
}

// Draw spike hitboxes as small triangular teeth.
function drawSpikes() {
  for (const spike of spikes) {
    ctx.fillStyle = "#dfe7ef";
    for (let x = spike.x; x < spike.x + spike.w; x += 11) {
      ctx.beginPath();
      ctx.moveTo(x, spike.y + spike.h);
      ctx.lineTo(x + 5.5, spike.y);
      ctx.lineTo(x + 11, spike.y + spike.h);
      ctx.closePath();
      ctx.fill();
    }
  }
}

function drawPressurePlates() {
  for (const plate of pressurePlates) {
    drawRect(plate, plate.triggered ? "#8b5cf6" : "#22c55e");
  }

  ctx.fillStyle = "#ff6b6b";
  for (const shooter of wallShooters) {
    ctx.beginPath();
    ctx.arc(shooter.x, shooter.y, 6, 0, Math.PI * 2);
    ctx.fill();
  }
}

// Purple projectiles are circles so they read differently from square enemies.
function drawProjectiles() {
  for (const projectile of game.projectiles) {
    ctx.fillStyle = projectile.color || "#a855f7";
    ctx.beginPath();
    ctx.arc(projectile.x, projectile.y, projectile.r, 0, Math.PI * 2);
    ctx.fill();
  }
}

// Render the full scene from scratch every frame.
function draw() {
  ctx.clearRect(0, 0, WIDTH, HEIGHT);
  ctx.fillStyle = "#151a1f";
  ctx.fillRect(0, 0, WIDTH, HEIGHT);

  // Background/world geometry.
  drawLadders();
  for (const platform of platforms) drawRect(platform, "#59636d");
  drawSpikes();
  drawPressurePlates();

  // Purple enemies shoot projectiles; yellow enemies are contact-only.
  for (const enemy of game.enemies) {
    if (enemy.alive) drawRect(enemy, enemy.shooter ? "#9d4edd" : "#f0b84f");
  }

  drawProjectiles();

  const boss = game.boss;
  if (boss.alive) {
    // Draw the boss sword before the body so the red boss remains readable.
    const sword = bossSwordBox();
    ctx.save();
    ctx.strokeStyle = "#f8fafc";
    ctx.lineWidth = BOSS_SWORD_WIDTH;
    ctx.lineCap = "round";
    ctx.beginPath();
    ctx.moveTo(sword.x1, sword.y1);
    ctx.lineTo(sword.x2, sword.y2);
    ctx.stroke();
    ctx.restore();

    // Boss body and a tiny health bar above it.
    drawRect(boss, boss.invincible > 0 ? "#ff9ca0" : "#df454d");
    ctx.fillStyle = "#f8fafc";
    ctx.fillRect(boss.x + 9, boss.y - 12, boss.health * 12, 5);
  }

  // Blink the player during invincibility frames.
  const player = game.player;
  const blink = player.invincible > 0 && Math.floor(player.invincible / 5) % 2 === 0;
  if (!blink) {
    drawRect(player, "#55a7ff");

    // Show the smaller damage hitbox inside the player body.
    const hitbox = playerDamageBox();
    ctx.strokeStyle = "#101316";
    ctx.lineWidth = 2;
    ctx.strokeRect(Math.round(hitbox.x), Math.round(hitbox.y), hitbox.w, hitbox.h);
    ctx.strokeStyle = "#e8f3ff";
    ctx.lineWidth = 1;
    ctx.strokeRect(Math.round(hitbox.x), Math.round(hitbox.y), hitbox.w, hitbox.h);
  }

  // Draw the player's sword only during the active attack frames.
  const sword = attackBox(player);
  if (sword) drawRect(sword, "#dfe7ef");

  // End-state overlay.
  if (game.state !== "playing") {
    ctx.fillStyle = "rgba(0, 0, 0, 0.55)";
    ctx.fillRect(0, 0, WIDTH, HEIGHT);
    ctx.fillStyle = "#f8fafc";
    ctx.font = "700 34px system-ui, sans-serif";
    ctx.textAlign = "center";
    const overlayTitle =
      game.state === "transition" ? game.message : game.state === "won" ? "Level Clear" : "Try Again";
    ctx.fillText(overlayTitle, WIDTH / 2, HEIGHT / 2 - 12);
    ctx.font = "18px system-ui, sans-serif";
    if (game.state === "transition") {
      ctx.fillText("Get ready...", WIDTH / 2, HEIGHT / 2 + 28);
    } else {
      ctx.fillText("Press R or the Restart button", WIDTH / 2, HEIGHT / 2 + 28);
    }
    ctx.textAlign = "left";
  }

  // Keep the HTML status text in sync with the current game state.
  messageEl.textContent = game.message;
  healthEl.textContent = `${levels[currentLevelIndex].name} | Health ${Math.max(0, player.health)} | Boss ${Math.max(0, boss.health)}`;
  if (!specialWeaponUnlocked) {
    specialEl.textContent = "Special locked";
  } else if (specialCharging) {
    specialEl.textContent = `Special charging ${Math.ceil(specialChargeTimer / 60)}s`;
  } else if (specialCooldown > 0) {
    specialEl.textContent = `Special cooldown ${Math.ceil(specialCooldown / 60)}s`;
  } else {
    specialEl.textContent = "Special ready";
  }
}

// Main animation loop. requestAnimationFrame calls this around 60 times per
// second. Very large elapsed values are skipped so tab switching does not cause
// a huge physics jump when the browser catches up.
function loop(time) {
  const elapsed = time - lastTime;
  lastTime = time;
  if (elapsed < 60) update();
  draw();
  requestAnimationFrame(loop);
}

// Keyboard input. Store both the physical key code and typed key value so
// controls work across layouts while still honoring the current layout letters.
window.addEventListener("keydown", (event) => {
  const key = event.key.toLowerCase();
  const code = event.code;
  if (
    ["ArrowLeft", "ArrowRight", "ArrowUp", "ArrowDown", "Space"].includes(code) ||
    ["arrowleft", "arrowright", "arrowup", "arrowdown", " "].includes(key)
  ) {
    event.preventDefault();
  }
  if (code === "KeyR" || key === "r") resetGame();
  if ((code === "KeyJ" || key === "j") && !event.repeat) {
    attackRequested = true;
    requestedAttackType = "normal";
  }
  if (
    (code === "KeyK" || key === "k") &&
    specialWeaponUnlocked &&
    specialCooldown === 0 &&
    !specialCharging &&
    !event.repeat
  ) {
    specialCharging = true;
    specialChargeTimer = SPECIAL_CHARGE_FRAMES;
  }
  keys.add(code);
  keys.add(key);
});

// Release held movement keys.
window.addEventListener("keyup", (event) => {
  if (event.code === "KeyK" || event.key.toLowerCase() === "k") {
    specialCharging = false;
    specialChargeTimer = 0;
  }
  keys.delete(event.code);
  keys.delete(event.key.toLowerCase());
});

// Mouse/touch restart button.
restartButton.addEventListener("click", resetGame);

// Full reset button.
newGameButton.addEventListener("click", newGame);

// Testing shortcut: jump straight to level 2 with full health.
level2Button.addEventListener("click", () => {
  checkpointLevelIndex = 1;
  startLevel(1);
});

// Testing shortcut: jump straight to level 3 with full health.
level3Button.addEventListener("click", () => {
  checkpointLevelIndex = 2;
  startLevel(2);
});

// Testing shortcut: jump straight to level 4 with full health.
level4Button.addEventListener("click", () => {
  checkpointLevelIndex = 3;
  startLevel(3);
});

// Tiny debug hook used by browser smoke tests. It is not needed for gameplay.
window.__platformerState = () => ({
  state: game.state,
  level: currentLevelIndex + 1,
  checkpointLevel: checkpointLevelIndex + 1,
  pogoUnlocked,
  specialWeaponUnlocked,
  specialCharging,
  specialChargeTimer,
  specialCooldown,
  pendingLevel: pendingLevelIndex === null ? null : pendingLevelIndex + 1,
  player: {
    x: Math.round(game.player.x),
    y: Math.round(game.player.y),
    health: game.player.health,
    attackTimer: game.player.attackTimer,
  },
  boss: {
    health: game.boss.health,
    alive: game.boss.alive,
  },
  projectiles: game.projectiles.length,
});

// Start the first run.
resetGame();
requestAnimationFrame(loop);
