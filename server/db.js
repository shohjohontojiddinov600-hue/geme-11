// SQLite Database persistence with WAL mode for Mythic Realms
const { DatabaseSync } = require('node:sqlite');
const path = require('node:path');
const fs = require('node:fs');
const crypto = require('node:crypto');

const DB_DIR = path.join(__dirname, '..', 'data');
if (!fs.existsSync(DB_DIR)) {
  fs.mkdirSync(DB_DIR, { recursive: true });
}

const DB_PATH = path.join(DB_DIR, 'mythic_realms.db');

class GameDB {
  constructor(dbPath = DB_PATH) {
    this.db = new DatabaseSync(dbPath);
    this.init();
  }

  init() {
    this.db.exec('PRAGMA journal_mode = WAL;');
    this.db.exec('PRAGMA synchronous = NORMAL;');
    this.db.exec('PRAGMA foreign_keys = ON;');

    this.db.exec(`
      CREATE TABLE IF NOT EXISTS players (
        id TEXT PRIMARY KEY,
        username TEXT UNIQUE NOT NULL,
        color TEXT DEFAULT '#3498db',
        x REAL DEFAULT 0,
        y REAL DEFAULT 0,
        hp INTEGER DEFAULT 100,
        max_hp INTEGER DEFAULT 100,
        hunger INTEGER DEFAULT 100,
        stamina INTEGER DEFAULT 100,
        kills INTEGER DEFAULT 0,
        score INTEGER DEFAULT 0,
        has_won INTEGER DEFAULT 0,
        updated_at INTEGER NOT NULL
      );
    `);

    this.db.exec(`
      CREATE TABLE IF NOT EXISTS player_inventory (
        id TEXT PRIMARY KEY,
        player_id TEXT NOT NULL,
        slot_idx INTEGER NOT NULL,
        item_id TEXT NOT NULL,
        count INTEGER NOT NULL,
        durability INTEGER DEFAULT 100,
        UNIQUE(player_id, slot_idx)
      );
    `);

    this.db.exec(`
      CREATE TABLE IF NOT EXISTS chunk_deltas (
        chunk_key TEXT PRIMARY KEY,
        deltas TEXT NOT NULL,
        modified_at INTEGER NOT NULL
      );
    `);

    this.db.exec(`
      CREATE TABLE IF NOT EXISTS chests (
        id TEXT PRIMARY KEY,
        x INTEGER NOT NULL,
        y INTEGER NOT NULL,
        created_by TEXT,
        UNIQUE(x, y)
      );
    `);

    this.db.exec(`
      CREATE TABLE IF NOT EXISTS chest_items (
        id TEXT PRIMARY KEY,
        chest_id TEXT NOT NULL,
        slot_idx INTEGER NOT NULL,
        item_id TEXT NOT NULL,
        count INTEGER NOT NULL,
        UNIQUE(chest_id, slot_idx)
      );
    `);
  }

  getOrCreatePlayer(username, defaultColor = '#3498db') {
    const findStmt = this.db.prepare('SELECT * FROM players WHERE username = ?');
    const existing = findStmt.get(username);
    if (existing) {
      return existing;
    }

    const id = crypto.randomUUID();
    const now = Date.now();
    const insertStmt = this.db.prepare(`
      INSERT INTO players (id, username, color, x, y, hp, max_hp, hunger, stamina, kills, score, has_won, updated_at)
      VALUES (?, ?, ?, 0, 0, 100, 100, 100, 100, 0, 0, 0, ?)
    `);
    insertStmt.run(id, username, defaultColor, now);

    this.giveStarterKit(id);
    return this.db.prepare('SELECT * FROM players WHERE id = ?').get(id);
  }

  giveStarterKit(playerId) {
    const starterItems = [
      { slot: 0, item: 'wooden_axe', count: 1 },
      { slot: 1, item: 'wooden_sword', count: 1 },
      { slot: 2, item: 'berry', count: 5 },
      { slot: 3, item: 'torch', count: 4 }
    ];

    const insertStmt = this.db.prepare(`
      INSERT OR REPLACE INTO player_inventory (id, player_id, slot_idx, item_id, count, durability)
      VALUES (?, ?, ?, ?, ?, 100)
    `);

    for (const starter of starterItems) {
      insertStmt.run(crypto.randomUUID(), playerId, starter.slot, starter.item, starter.count);
    }
  }

  savePlayer(player) {
    const updateStmt = this.db.prepare(`
      UPDATE players
      SET x = ?, y = ?, hp = ?, max_hp = ?, hunger = ?, stamina = ?, kills = ?, score = ?, has_won = ?, updated_at = ?
      WHERE id = ?
    `);
    updateStmt.run(
      player.x,
      player.y,
      Math.round(player.hp),
      player.maxHp || 100,
      Math.round(player.hunger),
      Math.round(player.stamina),
      player.kills || 0,
      player.score || 0,
      player.hasWon ? 1 : 0,
      Date.now(),
      player.id
    );
  }

  getPlayerInventory(playerId) {
    const stmt = this.db.prepare('SELECT slot_idx, item_id, count, durability FROM player_inventory WHERE player_id = ? ORDER BY slot_idx ASC');
    const rows = stmt.all(playerId);
    const slots = new Array(30).fill(null);
    for (const row of rows) {
      if (row.slot_idx >= 0 && row.slot_idx < 30) {
        slots[row.slot_idx] = {
          itemId: row.item_id,
          count: row.count,
          durability: row.durability
        };
      }
    }
    return slots;
  }

  _savePlayerInventoryInternal(playerId, slots) {
    this.db.prepare('DELETE FROM player_inventory WHERE player_id = ?').run(playerId);
    const insertStmt = this.db.prepare(`
      INSERT INTO player_inventory (id, player_id, slot_idx, item_id, count, durability)
      VALUES (?, ?, ?, ?, ?, ?)
    `);
    for (let i = 0; i < slots.length; i++) {
      const s = slots[i];
      if (s && s.itemId && s.count > 0) {
        insertStmt.run(crypto.randomUUID(), playerId, i, s.itemId, s.count, s.durability || 100);
      }
    }
  }

  savePlayerInventory(playerId, slots) {
    this.db.exec('BEGIN IMMEDIATE TRANSACTION;');
    try {
      this._savePlayerInventoryInternal(playerId, slots);
      this.db.exec('COMMIT;');
    } catch (err) {
      this.db.exec('ROLLBACK;');
      throw err;
    }
  }

  getAllChunkDeltas() {
    const stmt = this.db.prepare('SELECT chunk_key, deltas FROM chunk_deltas');
    const rows = stmt.all();
    const result = new Map();
    for (const row of rows) {
      try {
        result.set(row.chunk_key, JSON.parse(row.deltas));
      } catch (e) {
        console.error('Error parsing chunk delta:', row.chunk_key, e);
      }
    }
    return result;
  }

  saveChunkDelta(chunkKey, deltaMap) {
    const deltaObj = Object.fromEntries(deltaMap instanceof Map ? deltaMap : Object.entries(deltaMap));
    const jsonStr = JSON.stringify(deltaObj);
    const stmt = this.db.prepare(`
      INSERT OR REPLACE INTO chunk_deltas (chunk_key, deltas, modified_at)
      VALUES (?, ?, ?)
    `);
    stmt.run(chunkKey, jsonStr, Date.now());
  }

  getOrCreateChest(x, y, createdBy = 'system') {
    let chest = this.db.prepare('SELECT * FROM chests WHERE x = ? AND y = ?').get(x, y);
    if (!chest) {
      const id = crypto.randomUUID();
      this.db.prepare('INSERT INTO chests (id, x, y, created_by) VALUES (?, ?, ?, ?)').run(id, x, y, createdBy);
      chest = { id, x, y, created_by: createdBy };
    }
    return chest;
  }

  getChestItems(chestId) {
    const rows = this.db.prepare('SELECT slot_idx, item_id, count FROM chest_items WHERE chest_id = ? ORDER BY slot_idx ASC').all(chestId);
    const slots = new Array(20).fill(null);
    for (const row of rows) {
      if (row.slot_idx >= 0 && row.slot_idx < 20) {
        slots[row.slot_idx] = { itemId: row.item_id, count: row.count };
      }
    }
    return slots;
  }

  _saveChestItemsInternal(chestId, slots) {
    this.db.prepare('DELETE FROM chest_items WHERE chest_id = ?').run(chestId);
    const insertStmt = this.db.prepare(`
      INSERT INTO chest_items (id, chest_id, slot_idx, item_id, count)
      VALUES (?, ?, ?, ?, ?)
    `);
    for (let i = 0; i < slots.length; i++) {
      const s = slots[i];
      if (s && s.itemId && s.count > 0) {
        insertStmt.run(crypto.randomUUID(), chestId, i, s.itemId, s.count);
      }
    }
  }

  saveChestItems(chestId, slots) {
    this.db.exec('BEGIN IMMEDIATE TRANSACTION;');
    try {
      this._saveChestItemsInternal(chestId, slots);
      this.db.exec('COMMIT;');
    } catch (err) {
      this.db.exec('ROLLBACK;');
      throw err;
    }
  }

  // Atomically transfer items between Player and Chest with zero race condition (Anti-Duplication)
  atomicTransfer({ playerId, playerSlots, chestId, chestSlots }) {
    this.db.exec('BEGIN IMMEDIATE TRANSACTION;');
    try {
      this._savePlayerInventoryInternal(playerId, playerSlots);
      this._saveChestItemsInternal(chestId, chestSlots);
      this.db.exec('COMMIT;');
      return true;
    } catch (err) {
      this.db.exec('ROLLBACK;');
      console.error('Atomic Transfer Failed - Rollback Executed:', err);
      return false;
    }
  }

  close() {
    this.db.close();
  }
}

module.exports = GameDB;
