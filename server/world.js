// Procedural World Generator and Persistent Chunk Manager for Mythic Realms
const crypto = require('node:crypto');

const CHUNK_SIZE = 16; // 16x16 tiles per chunk
const TILE_SIZE = 32;  // 32x32 pixels per tile

// Simple deterministic coherent 2D hash/noise for procedural generation
function hash2d(x, y, seed = 1337) {
  let h = seed + x * 374761393 + y * 668265263;
  h = (h ^ (h >> 13)) * 1274126177;
  return ((h ^ (h >> 16)) >>> 0) / 4294967295;
}

function smoothNoise(x, y, seed) {
  const iX = Math.floor(x);
  const iY = Math.floor(y);
  const fX = x - iX;
  const fY = y - iY;

  // Hermite interpolation
  const u = fX * fX * (3 - 2 * fX);
  const v = fY * fY * (3 - 2 * fY);

  const n00 = hash2d(iX, iY, seed);
  const n10 = hash2d(iX + 1, iY, seed);
  const n01 = hash2d(iX, iY + 1, seed);
  const n11 = hash2d(iX + 1, iY + 1, seed);

  const nx0 = n00 * (1 - u) + n10 * u;
  const nx1 = n01 * (1 - u) + n11 * u;
  return nx0 * (1 - v) + nx1 * v;
}

function fbm(x, y, octaves = 3, seed = 9841) {
  let val = 0;
  let freq = 1;
  let amp = 1;
  let max = 0;
  for (let i = 0; i < octaves; i++) {
    val += smoothNoise(x * freq, y * freq, seed + i * 101) * amp;
    max += amp;
    freq *= 2;
    amp *= 0.5;
  }
  return val / max;
}

class WorldManager {
  constructor(db, seed = 42891) {
    this.db = db;
    this.seed = seed;
    this.chunkDeltas = this.db.getAllChunkDeltas(); // Map of chunkKey -> deltas
    this.drops = new Map(); // id -> { id, x, y, itemId, count, ttl }
    this.activeChests = new Map(); // chestKey -> chestData
    this.dropCounter = 1;
  }

  getChunkKey(cx, cy) {
    return `${cx},${cy}`;
  }

  getChunkCoordinates(worldX, worldY) {
    const tileX = Math.floor(worldX / TILE_SIZE);
    const tileY = Math.floor(worldY / TILE_SIZE);
    const cx = Math.floor(tileX / CHUNK_SIZE);
    const cy = Math.floor(tileY / CHUNK_SIZE);
    return { cx, cy, tileX, tileY };
  }

  // Determine Biome at world tile coordinates: Forest, Desert, Ice
  getBiome(tileX, tileY) {
    // Large-scale contiguous biome distribution (64x64 tiles per biome cell)
    const cellX = Math.floor(tileX / 64);
    const cellY = Math.floor(tileY / 64);
    const cellHash = hash2d(cellX, cellY, this.seed + 777);

    // Keep origin (0, 0) as lush Forest for welcoming player spawn
    if (cellX === 0 && cellY === 0) return 'forest';

    if (cellHash < 0.33) {
      return 'desert'; // Scorched Sands
    } else if (cellHash < 0.66) {
      return 'ice';    // Frozen Caverns / Ice Tundra
    } else {
      return 'forest'; // Whispering Woods
    }
  }

  // Procedurally generate a chunk's base tiles and features
  generateChunk(cx, cy) {
    const chunkKey = this.getChunkKey(cx, cy);
    const baseTiles = [];
    const baseObjects = [];

    const startX = cx * CHUNK_SIZE;
    const startY = cy * CHUNK_SIZE;

    const biome = this.getBiome(startX + 8, startY + 8);

    for (let ly = 0; ly < CHUNK_SIZE; ly++) {
      for (let lx = 0; lx < CHUNK_SIZE; lx++) {
        const tx = startX + lx;
        const ty = startY + ly;
        const tileBiome = this.getBiome(tx, ty);

        const elevation = fbm(tx * 0.05, ty * 0.05, 3, this.seed);
        const detail = hash2d(tx, ty, this.seed);

        let ground = 'grass';
        let obj = null;

        if (tileBiome === 'forest') {
          if (elevation < 0.22) {
            ground = 'water';
          } else if (elevation < 0.28) {
            ground = 'dirt';
          } else {
            ground = 'grass';
            if (detail > 0.88) {
              obj = { type: 'tree', hp: 30, maxHp: 30 };
            } else if (detail > 0.83) {
              obj = { type: 'rock', hp: 40, maxHp: 40 };
            } else if (detail > 0.80) {
              obj = { type: 'berry_bush', hp: 10, maxHp: 10 };
            } else if (detail > 0.77 && elevation > 0.45) {
              obj = { type: 'iron_vein', hp: 60, maxHp: 60 };
            }
          }
        } else if (tileBiome === 'desert') {
          ground = elevation < 0.18 ? 'dirt' : 'sand';
          if (ground === 'sand') {
            if (detail > 0.91) {
              obj = { type: 'cactus', hp: 20, maxHp: 20 };
            } else if (detail > 0.86) {
              obj = { type: 'rock', hp: 40, maxHp: 40 };
            } else if (detail > 0.81) {
              obj = { type: 'gold_vein', hp: 75, maxHp: 75 };
            }
          }
        } else if (tileBiome === 'ice') {
          ground = elevation < 0.20 ? 'ice_water' : (elevation < 0.35 ? 'ice' : 'snow');
          if (ground !== 'ice_water') {
            if (detail > 0.90) {
              obj = { type: 'frost_crystal', hp: 50, maxHp: 50 };
            } else if (detail > 0.84) {
              obj = { type: 'iron_vein', hp: 60, maxHp: 60 };
            } else if (detail > 0.80 && elevation > 0.55) {
              obj = { type: 'obsidian_node', hp: 120, maxHp: 120 };
            } else if (detail > 0.76) {
              obj = { type: 'rock', hp: 40, maxHp: 40 };
            }
          }
        }

        const idx = ly * CHUNK_SIZE + lx;
        baseTiles[idx] = ground;
        baseObjects[idx] = obj;
      }
    }

    // Apply persistent modifications (deltas) from SQLite
    const deltas = this.chunkDeltas.get(chunkKey);
    if (deltas) {
      for (const [key, d] of Object.entries(deltas)) {
        const [lx, ly] = key.split(',').map(Number);
        if (lx >= 0 && lx < CHUNK_SIZE && ly >= 0 && ly < CHUNK_SIZE) {
          const idx = ly * CHUNK_SIZE + lx;
          if (d === null) {
            baseObjects[idx] = null;
          } else {
            baseObjects[idx] = d;
          }
        }
      }
    }

    return {
      cx,
      cy,
      chunkKey,
      biome,
      tiles: baseTiles,
      objects: baseObjects
    };
  }

  modifyObject(worldX, worldY, newObj) {
    const { cx, cy, tileX, tileY } = this.getChunkCoordinates(worldX, worldY);
    const chunkKey = this.getChunkKey(cx, cy);
    const localX = ((tileX % CHUNK_SIZE) + CHUNK_SIZE) % CHUNK_SIZE;
    const localY = ((tileY % CHUNK_SIZE) + CHUNK_SIZE) % CHUNK_SIZE;
    const deltaKey = `${localX},${localY}`;

    let deltas = this.chunkDeltas.get(chunkKey);
    if (!deltas) {
      deltas = {};
      this.chunkDeltas.set(chunkKey, deltas);
    }

    deltas[deltaKey] = newObj;
    this.db.saveChunkDelta(chunkKey, deltas);

    return { cx, cy, localX, localY, tileX, tileY, newObj };
  }

  spawnDrop(x, y, itemId, count = 1) {
    const id = `drop_${this.dropCounter++}_${Date.now()}`;
    const drop = {
      id,
      x: x + (Math.random() - 0.5) * 16,
      y: y + (Math.random() - 0.5) * 16,
      itemId,
      count,
      createdAt: Date.now()
    };
    this.drops.set(id, drop);
    return drop;
  }

  removeDrop(id) {
    this.drops.delete(id);
  }
}

module.exports = {
  WorldManager,
  CHUNK_SIZE,
  TILE_SIZE
};
