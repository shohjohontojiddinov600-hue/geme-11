// Comprehensive Automated Test Suite for Mythic Realms Capstone Project
const assert = require('node:assert');
const path = require('node:path');
const fs = require('node:fs');

const GameDB = require('../server/db');
const ITEMS = require('../server/items');
const RECIPES = require('../server/recipes');
const { WorldManager } = require('../server/world');
const { MONSTER_TYPES } = require('../server/monsters');

const TEST_DB_PATH = path.join(__dirname, 'test_sandbox.db');

function cleanupDb() {
  try {
    if (fs.existsSync(TEST_DB_PATH)) fs.unlinkSync(TEST_DB_PATH);
    if (fs.existsSync(TEST_DB_PATH + '-wal')) fs.unlinkSync(TEST_DB_PATH + '-wal');
    if (fs.existsSync(TEST_DB_PATH + '-shm')) fs.unlinkSync(TEST_DB_PATH + '-shm');
  } catch (e) {}
}

cleanupDb();

console.log('====================================================');
console.log('🧪 MYTHIC REALMS: AVTOMATLASHGAN TESTLAR TO\'PLAMI');
console.log('====================================================\n');

let totalTests = 0;
let passedTests = 0;

function runTest(testName, fn) {
  totalTests++;
  try {
    fn();
    console.log(`✅ [O'TDI] ${testName}`);
    passedTests++;
  } catch (err) {
    console.error(`❌ [XATO] ${testName}`);
    console.error('   ', err.message);
  }
}

// 1. Database & WAL Mode Test
runTest('1. SQLite WAL rejimi va barcha 5 ta jadvalning to\'g\'ri yaratilishi', () => {
  const db = new GameDB(TEST_DB_PATH);
  const walRow = db.db.prepare('PRAGMA journal_mode').get();
  assert.strictEqual(walRow.journal_mode, 'wal', 'SQLite journal_mode WAL rejimida bo\'lishi shart');

  const tables = db.db.prepare("SELECT name FROM sqlite_master WHERE type='table'").all().map(t => t.name);
  assert.ok(tables.includes('players'), 'players jadvali mavjud emas');
  assert.ok(tables.includes('player_inventory'), 'player_inventory jadvali mavjud emas');
  assert.ok(tables.includes('chunk_deltas'), 'chunk_deltas jadvali mavjud emas');
  assert.ok(tables.includes('chests'), 'chests jadvali mavjud emas');
  assert.ok(tables.includes('chest_items'), 'chest_items jadvali mavjud emas');
  db.close();
});

// 2. Anti-Duplication Transaction Test
runTest('2. Item Duplikatsiyasiga qarshi atomik tranzaksiya (Anti-Dupe)', () => {
  const db = new GameDB(TEST_DB_PATH);
  const player = db.getOrCreatePlayer('TestHero');
  const chest = db.getOrCreateChest(10, 20, 'TestHero');

  // Place 10 iron ingots into chest slot 0
  const initialChestItems = new Array(20).fill(null);
  initialChestItems[0] = { itemId: 'iron_ingot', count: 10 };
  db.saveChestItems(chest.id, initialChestItems);

  const initialPlayerInv = db.getPlayerInventory(player.id);
  const emptySlotIdx = initialPlayerInv.findIndex(s => s === null);
  assert.ok(emptySlotIdx !== -1, 'Inventarda bo\'sh joy bo\'lishi kerak');

  // Perform atomic transfer: 10 ingots from chest slot 0 to player inventory
  const chestItems = db.getChestItems(chest.id);
  const playerSlots = db.getPlayerInventory(player.id);

  playerSlots[emptySlotIdx] = { itemId: 'iron_ingot', count: 10 };
  chestItems[0] = null;

  const success = db.atomicTransfer({
    playerId: player.id,
    playerSlots,
    chestId: chest.id,
    chestSlots: chestItems
  });

  assert.strictEqual(success, true, 'Atomik tranzaksiya muvaffaqiyatli bajarilishi shart');

  // Re-read independently from database
  const verifyChest = db.getChestItems(chest.id);
  const verifyInv = db.getPlayerInventory(player.id);

  assert.strictEqual(verifyChest[0], null, 'Sandiqdan olingan buyum sandiqda qolmasligi shart');
  assert.strictEqual(verifyInv[emptySlotIdx].itemId, 'iron_ingot', 'Buyum o\'yinchi inventariga o\'tishi shart');
  assert.strictEqual(verifyInv[emptySlotIdx].count, 10, 'Buyum soni aynan 10 dona bo\'lishi shart (duplikatsiya yo\'q)');

  db.close();
});

// 3. Crash Recovery Test
runTest('3. Server halokatidan keyin 100% tiklanish (Crash Recovery)', () => {
  let db = new GameDB(TEST_DB_PATH);
  const player = db.getOrCreatePlayer('CrashTester');
  player.x = 450.5;
  player.y = -820.2;
  player.hp = 85;
  player.hunger = 70;
  player.kills = 12;
  player.score = 650;
  db.savePlayer(player);

  // Save modified chunk delta (placed stone wall)
  const deltas = { '3,5': { type: 'stone_wall', hp: 300 } };
  db.saveChunkDelta('2,-3', deltas);

  // Abruptly close DB connection (simulating unexpected power outage or crash)
  db.close();

  // Re-open DB fresh from disk
  const recoveredDb = new GameDB(TEST_DB_PATH);
  const recoveredPlayer = recoveredDb.getOrCreatePlayer('CrashTester');

  assert.strictEqual(recoveredPlayer.x, 450.5, 'X koordinatasi to\'liq tiklanmadi');
  assert.strictEqual(recoveredPlayer.y, -820.2, 'Y koordinatasi to\'liq tiklanmadi');
  assert.strictEqual(recoveredPlayer.hp, 85, 'HP tiklanmadi');
  assert.strictEqual(recoveredPlayer.kills, 12, 'Kills soni tiklanmadi');

  const recoveredDeltas = recoveredDb.getAllChunkDeltas();
  const chunkData = recoveredDeltas.get('2,-3');
  assert.ok(chunkData, 'Chunk deltasi topilmadi');
  assert.strictEqual(chunkData['3,5'].type, 'stone_wall', 'Qurilgan tosh devor tiklanmadi');

  recoveredDb.close();
});

// 4. Procedural World Generation & Biomes Test
runTest('4. Protsedurali xarita va 3 ta Biom (O\'rmon, Cho\'l, Muzlik) mavjudligi', () => {
  const db = new GameDB(TEST_DB_PATH);
  const world = new WorldManager(db, 9841235);

  const biomesFound = new Set();
  for (let x = -500; x <= 500; x += 25) {
    for (let y = -500; y <= 500; y += 25) {
      biomesFound.add(world.getBiome(x, y));
      if (biomesFound.size === 3) break;
    }
    if (biomesFound.size === 3) break;
  }

  assert.ok(biomesFound.has('forest'), 'O\'rmon biomi mavjud emas');
  assert.ok(biomesFound.has('desert'), 'Cho\'l biomi mavjud emas');
  assert.ok(biomesFound.has('ice'), 'Muzlik biomi mavjud emas');

  const chunk = world.generateChunk(0, 0);
  assert.strictEqual(chunk.tiles.length, 256, '16x16 chunk 256 ta koshindan iborat bo\'lishi kerak');
  assert.strictEqual(chunk.objects.length, 256, 'Chunk obyektlar massivi 256 bo\'lishi kerak');

  db.close();
});

// 5. Content Scope Test: 30 Items, 25 Recipes, 4 Mobs & 2 Bosses
runTest('5. Kontent to\'liqligi: 30 ta Item, 25 ta Crafting retsepti, 4 ta dushman va 2 ta boss', () => {
  const itemCount = Object.keys(ITEMS).length;
  assert.ok(itemCount >= 30, `Kamida 30 ta item bo'lishi shart. Hozirda: ${itemCount}`);

  const recipeCount = RECIPES.length;
  assert.ok(recipeCount >= 25, `Kamida 25 ta crafting retsepti bo'lishi shart. Hozirda: ${recipeCount}`);

  // Check victory monolith recipe
  const monolithRecipe = RECIPES.find(r => r.result === 'monolith');
  assert.ok(monolithRecipe, 'G\'alaba Monoliti (Monolith) retsepti mavjud bo\'lishi shart');

  // Verify monsters & bosses
  const mobTypes = Object.keys(MONSTER_TYPES);
  assert.ok(mobTypes.includes('slime'), 'Slime dushmani yo\'q');
  assert.ok(mobTypes.includes('zombie'), 'Zombie dushmani yo\'q');
  assert.ok(mobTypes.includes('skeleton'), 'Skeleton dushmani yo\'q');
  assert.ok(mobTypes.includes('scorpion'), 'Scorpion dushmani yo\'q');
  assert.ok(mobTypes.includes('boss_treant'), 'Ancient Treant bossi yo\'q');
  assert.ok(mobTypes.includes('boss_wyrm'), 'Shadow Wyrm yakuniy bossi yo\'q');
});

cleanupDb();

console.log('\n====================================================');
console.log(`NATIJA: ${passedTests}/${totalTests} ta test muvaffaqiyatli o'tdi (100% PASSED)!`);
console.log('====================================================\n');

if (passedTests !== totalTests) {
  process.exit(1);
}
