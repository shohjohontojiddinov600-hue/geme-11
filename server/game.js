// Server-Authoritative Simulation Engine for Mythic Realms
const ITEMS = require('./items');
const RECIPES = require('./recipes');
const { CHUNK_SIZE, TILE_SIZE } = require('./world');

const TICK_RATE = 30; // 30 ticks per second
const TICK_INTERVAL = 1000 / TICK_RATE; // 33.33ms

class GameEngine {
  constructor(db, world, monsters) {
    this.db = db;
    this.world = world;
    this.monsters = monsters;

    this.players = new Map(); // id -> playerObject
    this.connections = new Map(); // id -> ws
    this.activeChestSessions = new Map(); // chestId -> Set(playerId)

    // Day/Night Cycle: 12 minutes (720 seconds) total: 8 min day (0..480), 4 min night (480..720)
    this.worldTime = 120; // Starts in daytime
    this.dayDuration = 720; // seconds

    this.lastTickTime = Date.now();
    this.lastSaveTime = Date.now();
    this.lastSurvivalTick = Date.now();

    this.monsters.initWorldBosses();
    this.startLoop();
  }

  startLoop() {
    this.intervalId = setInterval(() => {
      this.tick();
    }, TICK_INTERVAL);
  }

  stop() {
    clearInterval(this.intervalId);
    this.saveAll();
  }

  // Add / Connect player with class support
  addPlayer(ws, username, color = '#3498db', playerClass = 'warrior') {
    const dbPlayer = this.db.getOrCreatePlayer(username, color, playerClass);
    const inventory = this.db.getPlayerInventory(dbPlayer.id);

    const player = {
      id: dbPlayer.id,
      username: dbPlayer.username,
      color: dbPlayer.color || color,
      playerClass: dbPlayer.player_class || playerClass,
      x: dbPlayer.x || 0,
      y: dbPlayer.y || 0,
      vx: 0,
      vy: 0,
      facingAngle: 0,
      hp: dbPlayer.hp > 0 ? dbPlayer.hp : 100,
      maxHp: dbPlayer.max_hp || (playerClass === 'warrior' ? 120 : 100),
      hunger: dbPlayer.hunger !== undefined ? dbPlayer.hunger : 100,
      stamina: dbPlayer.stamina !== undefined ? dbPlayer.stamina : 100,
      level: dbPlayer.level || 1,
      exp: dbPlayer.exp || 0,
      selectedSlot: 0,
      inventory,
      kills: dbPlayer.kills || 0,
      score: dbPlayer.score || 0,
      hasWon: !!dbPlayer.has_won,
      isSprinting: false,
      lastAttackTime: 0,
      openChestId: null
    };

    this.players.set(player.id, player);
    this.connections.set(player.id, ws);

    // Send initial join packet with world metadata and recipes
    this.send(player.id, {
      type: 'INIT',
      player: this.sanitizePlayer(player),
      inventory: player.inventory,
      items: ITEMS,
      recipes: RECIPES,
      worldTime: this.worldTime,
      isNight: this.isNight()
    });

    this.broadcast({
      type: 'CHAT_BROADCAST',
      username: 'SYSTEM',
      color: '#f1c40f',
      text: `⚔️ [${player.username}] olamga qo'shildi (${player.playerClass.toUpperCase()})!`
    });

    console.log(`[Player Joined] ${player.username} | Class: ${player.playerClass} | Level: ${player.level}`);
    return player;
  }

  removePlayer(playerId) {
    const player = this.players.get(playerId);
    if (player) {
      this.db.savePlayer(player);
      this.db.savePlayerInventory(player.id, player.inventory);

      if (player.openChestId) {
        this.closeChestSession(player.id, player.openChestId);
      }

      this.players.delete(playerId);
      this.connections.delete(playerId);
      this.broadcast({
        type: 'CHAT_BROADCAST',
        username: 'SYSTEM',
        color: '#95a5a6',
        text: `🚪 [${player.username}] olamdan chiqdi.`
      });
      console.log(`[Player Left] ${player.username}`);
    }
  }

  isNight() {
    const t = this.worldTime % this.dayDuration;
    return t >= 480;
  }

  tick() {
    const now = Date.now();
    const dt = (now - this.lastTickTime) / 1000;
    this.lastTickTime = now;

    this.worldTime = (this.worldTime + dt) % this.dayDuration;

    if (now - this.lastSurvivalTick >= 2000) {
      this.lastSurvivalTick = now;
      this.tickSurvival();
    }

    for (const player of this.players.values()) {
      if (player.hp <= 0) continue;

      let speed = player.playerClass === 'ranger' ? 125 : 110;
      if (player.isSprinting && player.stamina > 10) {
        speed = player.playerClass === 'ranger' ? 195 : 175;
        player.stamina = Math.max(0, player.stamina - 4);
      } else {
        player.stamina = Math.min(100, player.stamina + 2.5);
      }

      const nextX = player.x + player.vx * speed * dt;
      const nextY = player.y + player.vy * speed * dt;

      if (!this.checkTileCollision(nextX, player.y)) {
        player.x = nextX;
      }
      if (!this.checkTileCollision(player.x, nextY)) {
        player.y = nextY;
      }

      // Anti-stuck safety
      if (this.checkTileCollision(player.x, player.y)) {
        const offsets = [[32, 0], [-32, 0], [0, 32], [0, -32]];
        for (const [ox, oy] of offsets) {
          if (!this.checkTileCollision(player.x + ox, player.y + oy)) {
            player.x += ox;
            player.y += oy;
            break;
          }
        }
      }

      this.checkItemPickups(player);
    }

    // Monsters & Bosses update
    this.monsters.update(dt, this.players, this.isNight());
    const deadMobs = this.monsters.checkDeaths();
    for (const dead of deadMobs) {
      if (dead.targetPlayerId) {
        const killer = this.players.get(dead.targetPlayerId);
        if (killer) {
          killer.kills = (killer.kills || 0) + 1;
          const expGain = dead.isBoss ? (dead.type === 'boss_wyrm' ? 600 : 250) : 25;
          killer.score = (killer.score || 0) + (dead.isBoss ? 500 : 25);
          this.awardExp(killer, expGain);
        }
      }
    }

    if (now - this.lastSaveTime >= 10000) {
      this.lastSaveTime = now;
      this.saveAll();
    }

    this.broadcastState();
  }

  awardExp(player, expPoints) {
    player.exp += expPoints;
    const reqExp = player.level * 80;
    if (player.exp >= reqExp) {
      player.level += 1;
      player.exp -= reqExp;
      player.maxHp += 15;
      player.hp = player.maxHp;

      this.broadcast({
        type: 'LEVEL_UP',
        playerId: player.id,
        username: player.username,
        level: player.level,
        text: `⭐ Tabriklaymiz! [${player.username}] ${player.level}-darajaga ko'tarildi! (+15 Max HP)`
      });
    }
  }

  tickSurvival() {
    for (const player of this.players.values()) {
      if (player.hp <= 0) continue;

      player.hunger = Math.max(0, player.hunger - 0.35);

      if (player.hunger <= 0) {
        player.hp = Math.max(0, player.hp - 2);
      } else if (player.hunger >= 80 && player.hp < player.maxHp) {
        player.hp = Math.min(player.maxHp, player.hp + 1.5);
      }
    }
  }

  checkTileCollision(worldX, worldY) {
    const { cx, cy, tileX, tileY } = this.world.getChunkCoordinates(worldX, worldY);
    const chunk = this.world.generateChunk(cx, cy);
    const localX = ((tileX % CHUNK_SIZE) + CHUNK_SIZE) % CHUNK_SIZE;
    const localY = ((tileY % CHUNK_SIZE) + CHUNK_SIZE) % CHUNK_SIZE;
    const idx = localY * CHUNK_SIZE + localX;

    const ground = chunk.tiles[idx];
    const obj = chunk.objects[idx];

    if (ground === 'water') return true;

    if (obj) {
      if (obj.type === 'wood_wall' || obj.type === 'stone_wall' || obj.type === 'rock' ||
          obj.type === 'iron_vein' || obj.type === 'gold_vein' || obj.type === 'frost_crystal' ||
          obj.type === 'obsidian_node' || obj.type === 'tree') {
        return true;
      }
      if (obj.type === 'wood_door' && !obj.isOpen) {
        return true;
      }
    }
    return false;
  }

  checkItemPickups(player) {
    for (const [dropId, drop] of this.world.drops.entries()) {
      const dist = Math.hypot(player.x - drop.x, player.y - drop.y);
      if (dist < 28) {
        const added = this.addItemToInventory(player, drop.itemId, drop.count);
        if (added) {
          this.world.removeDrop(dropId);
          this.send(player.id, {
            type: 'INVENTORY_UPDATE',
            inventory: player.inventory,
            pickedItem: { itemId: drop.itemId, count: drop.count }
          });
        }
      }
    }
  }

  addItemToInventory(player, itemId, count) {
    const itemData = ITEMS[itemId];
    if (!itemData) return false;

    let remaining = count;

    if (itemData.maxStack > 1) {
      for (let i = 0; i < player.inventory.length; i++) {
        const slot = player.inventory[i];
        if (slot && slot.itemId === itemId && slot.count < itemData.maxStack) {
          const space = itemData.maxStack - slot.count;
          const add = Math.min(space, remaining);
          slot.count += add;
          remaining -= add;
          if (remaining <= 0) break;
        }
      }
    }

    if (remaining > 0) {
      for (let i = 0; i < player.inventory.length; i++) {
        if (!player.inventory[i]) {
          const add = Math.min(itemData.maxStack || 99, remaining);
          player.inventory[i] = {
            itemId,
            count: add,
            durability: itemData.durability || 100
          };
          remaining -= add;
          if (remaining <= 0) break;
        }
      }
    }

    return remaining === 0;
  }

  handleAction(playerId, message) {
    const player = this.players.get(playerId);
    if (!player) return;

    switch (message.type) {
      case 'MOVE_INPUT': {
        player.vx = Math.max(-1, Math.min(1, message.vx || 0));
        player.vy = Math.max(-1, Math.min(1, message.vy || 0));
        player.isSprinting = !!message.isSprinting;
        if (message.facingAngle !== undefined) {
          player.facingAngle = message.facingAngle;
        }
        break;
      }

      case 'SELECT_SLOT': {
        const slot = Number(message.slot);
        if (slot >= 0 && slot < 8) {
          player.selectedSlot = slot;
        }
        break;
      }

      case 'ATTACK_ACTION': {
        this.processAttack(player, message.targetX, message.targetY);
        break;
      }

      case 'USE_ITEM': {
        this.processUseItem(player, message.slotIndex, message.targetX, message.targetY);
        break;
      }

      case 'CRAFT_RECIPE': {
        this.processCrafting(player, message.recipeId);
        break;
      }

      case 'INTERACT_OBJECT': {
        this.processInteract(player, message.tileX, message.tileY);
        break;
      }

      case 'CHEST_TRANSFER': {
        this.processChestTransfer(player, message);
        break;
      }

      case 'CLOSE_CHEST': {
        if (player.openChestId) {
          this.closeChestSession(player.id, player.openChestId);
          player.openChestId = null;
        }
        break;
      }

      case 'DROP_ITEM': {
        this.processDropItem(player, message.slotIndex, message.count);
        break;
      }

      case 'CHAT_SEND': {
        const text = (message.text || '').trim().slice(0, 80);
        if (text) {
          this.broadcast({
            type: 'CHAT_BROADCAST',
            playerId: player.id,
            username: player.username,
            color: player.color,
            text
          });
        }
        break;
      }

      case 'RESPAWN': {
        if (player.hp <= 0) {
          player.hp = player.maxHp;
          player.hunger = 100;
          player.stamina = 100;
          player.x = 0;
          player.y = 0;
          this.send(player.id, { type: 'RESPAWN_ACK', player: this.sanitizePlayer(player) });
        }
        break;
      }
    }
  }

  processAttack(player, targetX, targetY) {
    const now = Date.now();
    if (now - player.lastAttackTime < 280) return;
    player.lastAttackTime = now;

    const equipped = player.inventory[player.selectedSlot];
    const itemData = equipped ? ITEMS[equipped.itemId] : null;

    let baseDamage = itemData ? (itemData.damage || 5) : 5;
    if (player.playerClass === 'warrior') baseDamage += 3;
    let attackRange = itemData ? (itemData.attackRange || 45) : 40;

    // Ranged attack with Bow
    if (itemData && itemData.isRanged) {
      let arrowSlotIdx = player.inventory.findIndex(s => s && s.itemId === 'arrow');
      if (arrowSlotIdx === -1) {
        this.send(player.id, { type: 'CHAT_MSG', text: "O'qlar tugagan!", color: '#e74c3c' });
        return;
      }

      player.inventory[arrowSlotIdx].count--;
      if (player.inventory[arrowSlotIdx].count <= 0) {
        player.inventory[arrowSlotIdx] = null;
      }

      const isCrit = Math.random() < 0.20;
      const finalDmg = isCrit ? Math.round(baseDamage * 1.8) : baseDamage;

      this.monsters.spawnProjectile({
        ownerId: player.id,
        isMonster: false,
        x: player.x,
        y: player.y,
        targetX,
        targetY,
        speed: 340,
        damage: finalDmg,
        color: isCrit ? '#f1c40f' : '#fff',
        maxRange: attackRange
      });

      this.send(player.id, { type: 'INVENTORY_UPDATE', inventory: player.inventory });
      return;
    }

    // Melee attack: Hit monsters in radius
    const hitRadius = attackRange;
    for (const [mId, mob] of this.monsters.monsters.entries()) {
      if (mob.hp <= 0) continue;
      const dist = Math.hypot(mob.x - targetX, mob.y - targetY);
      if (dist <= hitRadius) {
        const isCrit = Math.random() < 0.20;
        const finalDmg = isCrit ? Math.round(baseDamage * 1.8) : baseDamage;

        mob.hp -= finalDmg;
        mob.targetPlayerId = player.id;

        this.broadcast({
          type: 'COMBAT_EFFECT',
          effect: 'slash',
          isCrit,
          x: mob.x,
          y: mob.y,
          damage: finalDmg
        });
        break;
      }
    }

    // Harvesting trees, rocks, ores
    const { cx, cy, tileX, tileY } = this.world.getChunkCoordinates(targetX, targetY);
    const chunk = this.world.generateChunk(cx, cy);
    const localX = ((tileX % CHUNK_SIZE) + CHUNK_SIZE) % CHUNK_SIZE;
    const localY = ((tileY % CHUNK_SIZE) + CHUNK_SIZE) % CHUNK_SIZE;
    const idx = localY * CHUNK_SIZE + localX;
    const obj = chunk.objects[idx];

    if (obj) {
      const dist = Math.hypot(player.x - (tileX * TILE_SIZE + 16), player.y - (tileY * TILE_SIZE + 16));
      if (dist <= 65) {
        let toolBonus = 1;
        if (itemData && itemData.toolType === 'axe' && obj.type === 'tree') {
          toolBonus = 2.5;
        } else if (itemData && itemData.toolType === 'pickaxe' && (obj.type.includes('vein') || obj.type === 'rock')) {
          toolBonus = itemData.toolLevel === 2 ? 3 : 2;
        }
        if (player.playerClass === 'builder') toolBonus *= 1.5;

        const harvestDamage = Math.round(baseDamage * toolBonus);
        obj.hp -= harvestDamage;

        if (obj.hp <= 0) {
          this.world.modifyObject(tileX * TILE_SIZE + 16, tileY * TILE_SIZE + 16, null);
          this.spawnHarvestLoot(obj.type, tileX * TILE_SIZE + 16, tileY * TILE_SIZE + 16);
          this.awardExp(player, 5);
        } else {
          this.world.modifyObject(tileX * TILE_SIZE + 16, tileY * TILE_SIZE + 16, obj);
        }
      }
    }
  }

  spawnHarvestLoot(objType, x, y) {
    if (objType === 'tree') {
      this.world.spawnDrop(x, y, 'wood', Math.floor(2 + Math.random() * 3));
      if (Math.random() < 0.4) this.world.spawnDrop(x, y, 'fiber', 2);
    } else if (objType === 'rock') {
      this.world.spawnDrop(x, y, 'stone', Math.floor(2 + Math.random() * 3));
      if (Math.random() < 0.5) this.world.spawnDrop(x, y, 'coal', 1);
    } else if (objType === 'iron_vein') {
      this.world.spawnDrop(x, y, 'iron_ore', Math.floor(1 + Math.random() * 2));
      this.world.spawnDrop(x, y, 'stone', 1);
    } else if (objType === 'gold_vein') {
      this.world.spawnDrop(x, y, 'gold_ore', Math.floor(1 + Math.random() * 2));
    } else if (objType === 'frost_crystal') {
      this.world.spawnDrop(x, y, 'frost_shard', Math.floor(1 + Math.random() * 3));
    } else if (objType === 'obsidian_node') {
      this.world.spawnDrop(x, y, 'obsidian', Math.floor(1 + Math.random() * 2));
    } else if (objType === 'berry_bush') {
      this.world.spawnDrop(x, y, 'berry', Math.floor(2 + Math.random() * 3));
      this.world.spawnDrop(x, y, 'fiber', 1);
    } else if (objType === 'cactus') {
      this.world.spawnDrop(x, y, 'wood', 2);
      this.world.spawnDrop(x, y, 'fiber', 2);
    }
  }

  processUseItem(player, slotIndex, targetX, targetY) {
    const slot = player.inventory[slotIndex];
    if (!slot) return;
    const itemData = ITEMS[slot.itemId];
    if (!itemData) return;

    if (itemData.category === 'food' || itemData.category === 'potion') {
      if (itemData.foodVal) {
        player.hunger = Math.min(100, player.hunger + itemData.foodVal);
      }
      if (itemData.healVal) {
        player.hp = Math.min(player.maxHp, Math.max(0, player.hp + itemData.healVal));
      }

      slot.count--;
      if (slot.count <= 0) player.inventory[slotIndex] = null;
      this.send(player.id, { type: 'INVENTORY_UPDATE', inventory: player.inventory });
      return;
    }

    if (itemData.placeTile) {
      const dist = Math.hypot(player.x - targetX, player.y - targetY);
      if (dist > 120) {
        this.send(player.id, { type: 'CHAT_MSG', text: 'Juda uzoq masofa!', color: '#e67e22' });
        return;
      }

      const { cx, cy, tileX, tileY } = this.world.getChunkCoordinates(targetX, targetY);
      const chunk = this.world.generateChunk(cx, cy);
      const localX = ((tileX % CHUNK_SIZE) + CHUNK_SIZE) % CHUNK_SIZE;
      const localY = ((tileY % CHUNK_SIZE) + CHUNK_SIZE) % CHUNK_SIZE;
      const idx = localY * CHUNK_SIZE + localX;

      if (chunk.objects[idx]) {
        this.send(player.id, { type: 'CHAT_MSG', text: "Bu joy band!", color: '#e74c3c' });
        return;
      }

      if (itemData.placeTile === 'monolith') {
        player.hasWon = true;
        this.broadcast({
          type: 'VICTORY_ANNOUNCE',
          winnerName: player.username,
          text: `Qahramon ${player.username} G'alaba Monolitini tikladi va Olamni qutqardi! Capstone loyihasi muvaffaqiyatli yakunlandi!`
        });
      }

      const newObj = {
        type: itemData.placeTile,
        hp: itemData.hp || 100,
        maxHp: itemData.hp || 100,
        placedBy: player.username,
        isOpen: false
      };

      this.world.modifyObject(tileX * TILE_SIZE + 16, tileY * TILE_SIZE + 16, newObj);

      slot.count--;
      if (slot.count <= 0) player.inventory[slotIndex] = null;

      this.send(player.id, { type: 'INVENTORY_UPDATE', inventory: player.inventory });
      this.broadcast({
        type: 'WORLD_MODIFY',
        tileX,
        tileY,
        obj: newObj
      });
    }
  }

  processCrafting(player, recipeId) {
    const recipe = RECIPES.find(r => r.id === recipeId);
    if (!recipe) return;

    if (recipe.reqWorkbench) {
      const nearWorkbench = this.isNearPlacedObject(player.x, player.y, 'workbench', 75);
      if (!nearWorkbench) {
        this.send(player.id, { type: 'CHAT_MSG', text: "Dastgoh (Workbench) yonida bo'lish kerak!", color: '#e74c3c' });
        return;
      }
    }

    for (const ing of recipe.ingredients) {
      let countFound = 0;
      for (const slot of player.inventory) {
        if (slot && slot.itemId === ing.item) {
          countFound += slot.count;
        }
      }
      if (countFound < ing.count) {
        this.send(player.id, { type: 'CHAT_MSG', text: `Resurs yetarli emas: ${ITEMS[ing.item]?.name || ing.item}`, color: '#e67e22' });
        return;
      }
    }

    for (const ing of recipe.ingredients) {
      let remainingToDeduct = ing.count;
      for (let i = 0; i < player.inventory.length; i++) {
        const slot = player.inventory[i];
        if (slot && slot.itemId === ing.item) {
          const deduct = Math.min(slot.count, remainingToDeduct);
          slot.count -= deduct;
          remainingToDeduct -= deduct;
          if (slot.count <= 0) player.inventory[i] = null;
          if (remainingToDeduct <= 0) break;
        }
      }
    }

    this.addItemToInventory(player, recipe.result, recipe.count);
    this.awardExp(player, 10);
    this.send(player.id, {
      type: 'INVENTORY_UPDATE',
      inventory: player.inventory,
      crafted: { itemId: recipe.result, count: recipe.count }
    });
  }

  isNearPlacedObject(worldX, worldY, objType, maxDist = 70) {
    const { cx, cy } = this.world.getChunkCoordinates(worldX, worldY);
    for (let ox = -1; ox <= 1; ox++) {
      for (let oy = -1; oy <= 1; oy++) {
        const chunk = this.world.generateChunk(cx + ox, cy + oy);
        for (let i = 0; i < chunk.objects.length; i++) {
          const obj = chunk.objects[i];
          if (obj && obj.type === objType) {
            const lx = i % CHUNK_SIZE;
            const ly = Math.floor(i / CHUNK_SIZE);
            const objX = (chunk.cx * CHUNK_SIZE + lx) * TILE_SIZE + 16;
            const objY = (chunk.cy * CHUNK_SIZE + ly) * TILE_SIZE + 16;
            if (Math.hypot(worldX - objX, worldY - objY) <= maxDist) {
              return true;
            }
          }
        }
      }
    }
    return false;
  }

  processInteract(player, tileX, tileY) {
    const objX = tileX * TILE_SIZE + 16;
    const objY = tileY * TILE_SIZE + 16;
    if (Math.hypot(player.x - objX, player.y - objY) > 85) return;

    const { cx, cy } = this.world.getChunkCoordinates(objX, objY);
    const chunk = this.world.generateChunk(cx, cy);
    const localX = ((tileX % CHUNK_SIZE) + CHUNK_SIZE) % CHUNK_SIZE;
    const localY = ((tileY % CHUNK_SIZE) + CHUNK_SIZE) % CHUNK_SIZE;
    const idx = localY * CHUNK_SIZE + localX;
    const obj = chunk.objects[idx];

    if (!obj) return;

    if (obj.type === 'wood_door') {
      obj.isOpen = !obj.isOpen;
      this.world.modifyObject(objX, objY, obj);
      this.broadcast({ type: 'WORLD_MODIFY', tileX, tileY, obj });
    } else if (obj.type === 'chest') {
      const chest = this.db.getOrCreateChest(tileX, tileY, player.username);
      const chestItems = this.db.getChestItems(chest.id);
      player.openChestId = chest.id;

      let session = this.activeChestSessions.get(chest.id);
      if (!session) {
        session = new Set();
        this.activeChestSessions.set(chest.id, session);
      }
      session.add(player.id);

      this.send(player.id, {
        type: 'OPEN_CHEST',
        chestId: chest.id,
        items: chestItems,
        tileX,
        tileY
      });
    }
  }

  closeChestSession(playerId, chestId) {
    const session = this.activeChestSessions.get(chestId);
    if (session) {
      session.delete(playerId);
      if (session.size === 0) {
        this.activeChestSessions.delete(chestId);
      }
    }
  }

  processChestTransfer(player, message) {
    const { chestId, fromType, fromSlot, toType, toSlot, count } = message;
    if (!chestId || player.openChestId !== chestId) return;

    const chestItems = this.db.getChestItems(chestId);
    const playerSlots = player.inventory;

    const srcArr = fromType === 'chest' ? chestItems : playerSlots;
    const dstArr = toType === 'chest' ? chestItems : playerSlots;

    const srcItem = srcArr[fromSlot];
    if (!srcItem || srcItem.count < count) return;

    const transferAmount = count || srcItem.count;

    srcItem.count -= transferAmount;
    const movedItemId = srcItem.itemId;
    if (srcItem.count <= 0) {
      srcArr[fromSlot] = null;
    }

    if (!dstArr[toSlot]) {
      dstArr[toSlot] = { itemId: movedItemId, count: transferAmount };
    } else if (dstArr[toSlot].itemId === movedItemId) {
      dstArr[toSlot].count += transferAmount;
    } else {
      const temp = dstArr[toSlot];
      dstArr[toSlot] = { itemId: movedItemId, count: transferAmount };
      srcArr[fromSlot] = temp;
    }

    const success = this.db.atomicTransfer({
      playerId: player.id,
      playerSlots,
      chestId,
      chestSlots: chestItems
    });

    if (success) {
      player.inventory = playerSlots;

      const viewers = this.activeChestSessions.get(chestId);
      if (viewers) {
        for (const vId of viewers) {
          this.send(vId, {
            type: 'CHEST_SYNC',
            chestId,
            items: chestItems
          });
        }
      }

      this.send(player.id, {
        type: 'INVENTORY_UPDATE',
        inventory: player.inventory
      });
    }
  }

  processDropItem(player, slotIndex, count) {
    const slot = player.inventory[slotIndex];
    if (!slot) return;
    const dropCount = Math.min(slot.count, count || slot.count);

    this.world.spawnDrop(player.x, player.y, slot.itemId, dropCount);
    slot.count -= dropCount;
    if (slot.count <= 0) {
      player.inventory[slotIndex] = null;
    }

    this.send(player.id, { type: 'INVENTORY_UPDATE', inventory: player.inventory });
  }

  saveAll() {
    for (const player of this.players.values()) {
      this.db.savePlayer(player);
      this.db.savePlayerInventory(player.id, player.inventory);
    }
  }

  sanitizePlayer(p) {
    return {
      id: p.id,
      username: p.username,
      color: p.color,
      playerClass: p.playerClass,
      x: Math.round(p.x),
      y: Math.round(p.y),
      vx: p.vx,
      vy: p.vy,
      facingAngle: p.facingAngle,
      hp: Math.round(p.hp),
      maxHp: p.maxHp,
      hunger: Math.round(p.hunger),
      stamina: Math.round(p.stamina),
      level: p.level || 1,
      exp: p.exp || 0,
      selectedSlot: p.selectedSlot,
      kills: p.kills,
      score: p.score,
      hasWon: p.hasWon
    };
  }

  broadcastState() {
    const playersArr = Array.from(this.players.values()).map(p => this.sanitizePlayer(p));
    const monstersArr = Array.from(this.monsters.monsters.values()).map(m => ({
      id: m.id,
      type: m.type,
      name: m.name,
      isBoss: m.isBoss,
      x: Math.round(m.x),
      y: Math.round(m.y),
      hp: Math.round(m.hp),
      maxHp: m.maxHp,
      color: m.color
    }));
    const dropsArr = Array.from(this.world.drops.values());
    const projectilesArr = Array.from(this.monsters.projectiles.values());

    const payload = {
      type: 'STATE_TICK',
      worldTime: Math.round(this.worldTime),
      isNight: this.isNight(),
      players: playersArr,
      monsters: monstersArr,
      drops: dropsArr,
      projectiles: projectilesArr
    };

    const json = JSON.stringify(payload);
    for (const ws of this.connections.values()) {
      if (ws.readyState === 1) {
        ws.send(json);
      }
    }
  }

  send(playerId, msg) {
    const ws = this.connections.get(playerId);
    if (ws && ws.readyState === 1) {
      ws.send(JSON.stringify(msg));
    }
  }

  broadcast(msg) {
    const json = JSON.stringify(msg);
    for (const ws of this.connections.values()) {
      if (ws.readyState === 1) {
        ws.send(json);
      }
    }
  }
}

module.exports = GameEngine;
