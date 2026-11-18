// Monster & Boss AI system for Mythic Realms
const crypto = require('node:crypto');

const MONSTER_TYPES = {
  slime: {
    type: 'slime',
    name: 'Slime',
    maxHp: 35,
    speed: 38,
    damage: 8,
    attackRange: 24,
    aggroRadius: 200,
    color: '#2ecc71',
    drops: [
      { item: 'slime_gel', min: 1, max: 3, chance: 1.0 },
      { item: 'berry', min: 1, max: 2, chance: 0.5 }
    ]
  },
  zombie: {
    type: 'zombie',
    name: 'Zombie Marauder',
    maxHp: 65,
    speed: 48,
    damage: 14,
    attackRange: 28,
    aggroRadius: 260,
    color: '#27ae60',
    drops: [
      { item: 'leather', min: 1, max: 2, chance: 0.8 },
      { item: 'raw_meat', min: 1, max: 2, chance: 0.9 },
      { item: 'coal', min: 1, max: 2, chance: 0.4 }
    ]
  },
  skeleton: {
    type: 'skeleton',
    name: 'Skeleton Archer',
    maxHp: 45,
    speed: 42,
    damage: 12,
    attackRange: 240,
    minKiteDistance: 100,
    aggroRadius: 300,
    isRanged: true,
    shootCooldown: 2200,
    color: '#ecf0f1',
    drops: [
      { item: 'bone', min: 2, max: 4, chance: 1.0 },
      { item: 'arrow', min: 4, max: 8, chance: 0.9 },
      { item: 'bow', min: 1, max: 1, chance: 0.15 }
    ]
  },
  scorpion: {
    type: 'scorpion',
    name: 'Scorched Scorpion',
    maxHp: 75,
    speed: 62,
    damage: 16,
    attackRange: 26,
    aggroRadius: 240,
    color: '#d35400',
    drops: [
      { item: 'leather', min: 2, max: 3, chance: 1.0 },
      { item: 'stone', min: 2, max: 4, chance: 0.7 }
    ]
  },
  // Boss 1: Ancient Treant
  boss_treant: {
    type: 'boss_treant',
    name: 'Ancient Treant (Boss)',
    isBoss: true,
    maxHp: 500,
    speed: 32,
    damage: 26,
    attackRange: 120, // AoE ground slam
    aggroRadius: 400,
    color: '#5d4037',
    drops: [
      { item: 'wood', min: 20, max: 30, chance: 1.0 },
      { item: 'stone', min: 10, max: 15, chance: 1.0 },
      { item: 'iron_ingot', min: 4, max: 8, chance: 1.0 },
      { item: 'health_potion', min: 2, max: 3, chance: 1.0 }
    ]
  },
  // Boss 2: Shadow Wyrm (Final Capstone Boss)
  boss_wyrm: {
    type: 'boss_wyrm',
    name: 'Shadow Wyrm (Final Boss)',
    isBoss: true,
    maxHp: 1200,
    speed: 45,
    damage: 34,
    attackRange: 280,
    aggroRadius: 500,
    color: '#4a148c',
    drops: [
      { item: 'heart_of_realm', min: 1, max: 1, chance: 1.0 }, // Guarantees victory item
      { item: 'obsidian', min: 15, max: 25, chance: 1.0 },
      { item: 'gold_ingot', min: 8, max: 12, chance: 1.0 }
    ]
  }
};

class MonsterManager {
  constructor(world) {
    this.world = world;
    this.monsters = new Map();
    this.projectiles = new Map();
    this.nextMonsterId = 1;
    this.nextProjectileId = 1;
    this.lastSpawnTime = Date.now();
    this.bossTreantSpawned = false;
    this.bossWyrmSpawned = false;
  }

  spawnMonster(typeKey, x, y) {
    const template = MONSTER_TYPES[typeKey];
    if (!template) return null;

    const id = `mob_${this.nextMonsterId++}_${typeKey}`;
    const mob = {
      id,
      type: template.type,
      name: template.name,
      isBoss: !!template.isBoss,
      x,
      y,
      vx: 0,
      vy: 0,
      hp: template.maxHp,
      maxHp: template.maxHp,
      speed: template.speed,
      damage: template.damage,
      attackRange: template.attackRange,
      aggroRadius: template.aggroRadius,
      isRanged: !!template.isRanged,
      shootCooldown: template.shootCooldown || 2000,
      lastAttackTime: 0,
      targetPlayerId: null,
      color: template.color,
      state: 'idle',
      animTimer: 0
    };

    this.monsters.set(id, mob);
    return mob;
  }

  // Initial boss spawns in specific biome zones
  initWorldBosses() {
    if (!this.bossTreantSpawned) {
      // Spawn Ancient Treant in the Forest (coordinates ~ 200, 300)
      this.spawnMonster('boss_treant', 250, 350);
      this.bossTreantSpawned = true;
    }
    if (!this.bossWyrmSpawned) {
      // Spawn Shadow Wyrm in the Cold/Cavern depths (~ -400, -450)
      this.spawnMonster('boss_wyrm', -450, -450);
      this.bossWyrmSpawned = true;
    }
  }

  // Update AI for all active monsters (called 30 times a second by server loop)
  update(dt, players, isNight) {
    const playerList = Array.from(players.values()).filter(p => p.hp > 0);

    // Periodic monster spawning based on day/night cycle and player locations
    const now = Date.now();
    if (now - this.lastSpawnTime > 8000 && playerList.length > 0 && this.monsters.size < 25) {
      this.lastSpawnTime = now;
      for (const player of playerList) {
        // Spawn mob at a perimeter distance from player (250-400px away)
        const angle = Math.random() * Math.PI * 2;
        const dist = 280 + Math.random() * 120;
        const sx = player.x + Math.cos(angle) * dist;
        const sy = player.y + Math.sin(angle) * dist;

        const { tileX, tileY } = this.world.getChunkCoordinates(sx, sy);
        const biome = this.world.getBiome(tileX, tileY);

        let mobType = 'slime';
        if (biome === 'desert') {
          mobType = Math.random() < 0.6 ? 'scorpion' : 'skeleton';
        } else if (biome === 'ice') {
          mobType = Math.random() < 0.5 ? 'zombie' : 'skeleton';
        } else {
          // Forest
          if (isNight) {
            mobType = Math.random() < 0.6 ? 'zombie' : (Math.random() < 0.5 ? 'skeleton' : 'slime');
          } else {
            mobType = Math.random() < 0.7 ? 'slime' : 'skeleton';
          }
        }
        this.spawnMonster(mobType, sx, sy);
      }
    }

    // Process mob AI
    for (const [id, mob] of this.monsters.entries()) {
      if (mob.hp <= 0) continue;

      // Find nearest living player
      let nearestPlayer = null;
      let minDist = mob.aggroRadius;

      for (const player of playerList) {
        const dx = player.x - mob.x;
        const dy = player.y - mob.y;
        const dist = Math.hypot(dx, dy);
        if (dist < minDist) {
          minDist = dist;
          nearestPlayer = player;
        }
      }

      if (nearestPlayer) {
        mob.targetPlayerId = nearestPlayer.id;
        const dx = nearestPlayer.x - mob.x;
        const dy = nearestPlayer.y - mob.y;
        const dist = Math.hypot(dx, dy);

        if (mob.isRanged) {
          // Skeleton kiting logic
          if (dist < 90) {
            // Player is too close: run away!
            mob.vx = (-dx / dist) * mob.speed;
            mob.vy = (-dy / dist) * mob.speed;
          } else if (dist > 220) {
            // Get slightly closer to shoot
            mob.vx = (dx / dist) * mob.speed;
            mob.vy = (dy / dist) * mob.speed;
          } else {
            // In optimal range: stand and shoot
            mob.vx = 0;
            mob.vy = 0;
          }

          // Shoot arrow if cooldown ready
          if (now - mob.lastAttackTime > mob.shootCooldown && dist <= mob.attackRange) {
            mob.lastAttackTime = now;
            this.spawnProjectile({
              ownerId: mob.id,
              isMonster: true,
              x: mob.x,
              y: mob.y,
              targetX: nearestPlayer.x,
              targetY: nearestPlayer.y,
              speed: 180,
              damage: mob.damage,
              color: '#d2b48c',
              maxRange: 300
            });
          }
        } else if (mob.isBoss && mob.type === 'boss_wyrm') {
          // Shadow Wyrm multi-attack logic
          if (dist > 150) {
            mob.vx = (dx / dist) * mob.speed;
            mob.vy = (dy / dist) * mob.speed;
          } else {
            mob.vx = (dx / dist) * (mob.speed * 0.5);
            mob.vy = (dy / dist) * (mob.speed * 0.5);
          }

          // Shoot shadow projectiles every 3s
          if (now - mob.lastAttackTime > 2800) {
            mob.lastAttackTime = now;
            this.spawnProjectile({
              ownerId: mob.id,
              isMonster: true,
              x: mob.x,
              y: mob.y,
              targetX: nearestPlayer.x,
              targetY: nearestPlayer.y,
              speed: 200,
              damage: mob.damage,
              color: '#9c27b0',
              maxRange: 350
            });
          }
        } else {
          // Melee movement towards player
          if (dist > mob.attackRange * 0.8) {
            mob.vx = (dx / dist) * mob.speed;
            mob.vy = (dy / dist) * mob.speed;
          } else {
            mob.vx = 0;
            mob.vy = 0;
          }

          // Melee attack check
          if (dist <= mob.attackRange && now - mob.lastAttackTime > 1200) {
            mob.lastAttackTime = now;
            nearestPlayer.hp = Math.max(0, nearestPlayer.hp - mob.damage);
            nearestPlayer.lastDamagedTime = now;
          }
        }
      } else {
        // Idle wander
        mob.targetPlayerId = null;
        mob.animTimer += dt;
        if (mob.animTimer > 3) {
          mob.animTimer = 0;
          if (Math.random() < 0.4) {
            const wanderAngle = Math.random() * Math.PI * 2;
            mob.vx = Math.cos(wanderAngle) * (mob.speed * 0.3);
            mob.vy = Math.sin(wanderAngle) * (mob.speed * 0.3);
          } else {
            mob.vx = 0;
            mob.vy = 0;
          }
        }
      }

      // Update position
      mob.x += mob.vx * dt;
      mob.y += mob.vy * dt;
    }

    // Update projectiles
    for (const [pId, proj] of this.projectiles.entries()) {
      proj.x += proj.vx * dt;
      proj.y += proj.vy * dt;
      proj.travelled += Math.hypot(proj.vx * dt, proj.vy * dt);

      // Range expired
      if (proj.travelled >= proj.maxRange) {
        this.projectiles.delete(pId);
        continue;
      }

      // Collision check with targets
      if (proj.isMonster) {
        // Check collision with players
        for (const player of playerList) {
          if (Math.hypot(player.x - proj.x, player.y - proj.y) < 18) {
            player.hp = Math.max(0, player.hp - proj.damage);
            player.lastDamagedTime = now;
            this.projectiles.delete(pId);
            break;
          }
        }
      } else {
        // Check collision with monsters
        for (const [mId, mob] of this.monsters.entries()) {
          if (mob.hp <= 0) continue;
          if (Math.hypot(mob.x - proj.x, mob.y - proj.y) < 22) {
            mob.hp -= proj.damage;
            this.projectiles.delete(pId);
            break;
          }
        }
      }
    }
  }

  spawnProjectile(opts) {
    const id = `proj_${this.nextProjectileId++}`;
    const dx = opts.targetX - opts.x;
    const dy = opts.targetY - opts.y;
    const dist = Math.hypot(dx, dy) || 1;

    const proj = {
      id,
      ownerId: opts.ownerId,
      isMonster: opts.isMonster,
      x: opts.x,
      y: opts.y,
      vx: (dx / dist) * opts.speed,
      vy: (dy / dist) * opts.speed,
      damage: opts.damage,
      color: opts.color || '#fff',
      maxRange: opts.maxRange || 300,
      travelled: 0
    };

    this.projectiles.set(id, proj);
    return proj;
  }

  // Handle monster death and drop generation
  checkDeaths() {
    const deadMobs = [];
    for (const [id, mob] of this.monsters.entries()) {
      if (mob.hp <= 0) {
        deadMobs.push(mob);
        const template = MONSTER_TYPES[mob.type];
        if (template && template.drops) {
          for (const dropRule of template.drops) {
            if (Math.random() <= dropRule.chance) {
              const count = Math.floor(dropRule.min + Math.random() * (dropRule.max - dropRule.min + 1));
              if (count > 0) {
                this.world.spawnDrop(mob.x, mob.y, dropRule.item, count);
              }
            }
          }
        }
        this.monsters.delete(id);
      }
    }
    return deadMobs;
  }
}

module.exports = {
  MonsterManager,
  MONSTER_TYPES
};
