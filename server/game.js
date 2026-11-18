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

  // Add / Connect player
  addPlayer(ws, username, color = '#3498db') {
    const dbPlayer = this.db.getOrCreatePlayer(username, color);
    const inventory = this.db.getPlayerInventory(dbPlayer.id);

    const player = {
      id: dbPlayer.id,
      username: dbPlayer.username,
      color: dbPlayer.color || color,
      x: dbPlayer.x || 0,
      y: dbPlayer.y || 0,
      vx: 0,
      vy: 0,
      facingAngle: 0,
      hp: dbPlayer.hp > 0 ? dbPlayer.hp : 100,
      maxHp: dbPlayer.max_hp || 100,
      hunger: dbPlayer.hunger !== undefined ? dbPlayer.hunger : 100,
      stamina: dbPlayer.stamina !== undefined ? dbPlayer.stamina : 100,
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

    console.log(`[Player Joined] ${player.username} (ID: ${player.id})`);
    return player;
  }

  removePlayer(playerId) {
    const player = this.players.get(playerId);
    if (player) {
      // Save player and inventory immediately
      this.db.savePlayer(player);
      this.db.savePlayerInventory(player.id, player.inventory);

      if (player.openChestId) {
        this.closeChestSession(player.id, player.openChestId);
      }

      this.players.delete(playerId);
      this.connections.delete(playerId);
      console.log(`[Player Left] ${player.username}`);
    }
  }

  isNight() {
    const t = this.worldTime % this.dayDuration;
    return t >= 480; // After 8th minute is night
  }

  // Central 30Hz Authoritative Tick
  tick() {
    const now = Date.now();
    const dt = (now - this.lastTickTime) / 1000;
    this.lastTickTime = now;

    // Advance World Time
    this.worldTime = (this.worldTime + dt) % this.dayDuration;

    // Survival Tick: Hunger, Starvation & Health Regen (every 2 seconds)
    if (now - this.lastSurvivalTick >= 2000) {
      this.lastSurvivalTick = now;
      this.tickSurvival();
    }

    // Update Player Movement & Collisions
    for (const player of this.players.values()) {
      if (player.hp <= 0) continue;

      // Calculate speed
      let speed = 110; // base px/s
      if (player.isSprinting && player.stamina > 10) {
        speed = 175;
        player.stamina = Math.max(0, player.stamina - 4);
      } else {
        player.stamina = Math.min(100, player.stamina + 2);
      }

      // Desired position
      const nextX = player.x + player.vx * speed * dt;
      const nextY = player.y + player.vy * speed * dt;

      // Collision checks with world obstacles (AABB)
      if (!this.checkTileCollision(nextX, player.y)) {
        player.x = nextX;
      }
      if (!this.checkTileCollision(player.x, nextY)) {
        player.y = nextY;
      }

      // Anti-stuck / Anti-softlock safety: if currently trapped inside a solid object, push out
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

      // Check proximity item pickups (radius 28px)
      this.checkItemPickups(player);
    }

    // Update Monsters & Boss AI
    this.monsters.update(dt, this.players, this.isNight());
    const deadMobs = this.monsters.checkDeaths();
    for (const dead of deadMobs) {
      if (dead.targetPlayerId) {
        const killer = this.players.get(dead.targetPlayerId);
        if (killer) {
          killer.kills = (killer.kills || 0) + 1;
          killer.score = (killer.score || 0) + (dead.isBoss ? 500 : 25);
        }
      }
    }

    // Periodic Database Auto-Save (every 10 seconds)
    if (now - this.lastSaveTime >= 10000) {
      this.lastSaveTime = now;
      this.saveAll();
    }

    // Broadcast Authoritative World State to all connected clients
    this.broadcastState();
  }

  // Survival drain and recovery
  tickSurvival() {
    for (const player of this.players.values()) {
      if (player.hp <= 0) continue;

      // Hunger loss (-1 every 5s -> -0.4 every 2s)
      player.hunger = Math.max(0, player.hunger - 0.4);

      // Starvation damage
      if (player.hunger <= 0) {
        player.hp = Math.max(0, player.hp - 2);
      } else if (player.hunger >= 80 && player.hp < player.maxHp) {
        // Natural regeneration
        player.hp = Math.min(player.maxHp, player.hp + 1.5);
      }
    }
  }

  // World tile collision test
  checkTileCollision(worldX, worldY) {
    const { cx, cy, tileX, tileY } = this.world.getChunkCoordinates(worldX, worldY);
    const chunk = this.world.generateChunk(cx, cy);
    const localX = ((tileX % CHUNK_SIZE) + CHUNK_SIZE) % CHUNK_SIZE;
    const localY = ((tileY % CHUNK_SIZE) + CHUNK_SIZE) % CHUNK_SIZE;
    const idx = localY * CHUNK_SIZE + localX;

    const ground = chunk.tiles[idx];
    const obj = chunk.objects[idx];

    // Water blocks movement unless frozen
    if (ground === 'water') return true;

    // Solid objects block movement
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

  // Check and absorb ground item drops
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

  // Safe inventory addition with auto-stacking
  addItemToInventory(player, itemId, count) {
    const itemData = ITEMS[itemId];
    if (!itemData) return false;

    let remaining = count;

    // 1. Try stacking in existing slots
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

    // 2. Place remaining into empty slots
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

  // Handle Player Actions sent via WebSockets
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

  // Combat / Attack logic
  processAttack(player, targetX, targetY) {
    const now = Date.now();
    if (now - player.lastAttackTime < 300) return; // Cooldown
    player.lastAttackTime = now;

    const equipped = player.inventory[player.selectedSlot];
    const itemData = equipped ? ITEMS[equipped.itemId] : null;

    let baseDamage = itemData ? (itemData.damage || 5) : 5;
    let attackRange = itemData ? (itemData.attackRange || 45) : 40;

    // Ranged attack with Bow
    if (itemData && itemData.isRanged) {
      // Find arrows in inventory
      let arrowSlotIdx = player.inventory.findIndex(s => s && s.itemId === 'arrow');
      if (arrowSlotIdx === -1) {
        this.send(player.id, { type: 'CHAT_MSG', text: "O'qlar tugagan!", color: '#e74c3c' });
        return;
      }

      // Consume arrow
      player.inventory[arrowSlotIdx].count--;
      if (player.inventory[arrowSlotIdx].count <= 0) {
        player.inventory[arrowSlotIdx] = null;
      }

      this.monsters.spawnProjectile({
        ownerId: player.id,
        isMonster: false,
        x: player.x,
        y: player.y,
        targetX,
        targetY,
        speed: 320,
        damage: baseDamage,
        color: '#f1c40f',
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
        mob.hp -= baseDamage;
        mob.targetPlayerId = player.id; // Aggro

        // Monster hurt particle effect broadcast
        this.broadcast({
          type: 'COMBAT_EFFECT',
          effect: 'slash',
          x: mob.x,
          y: mob.y,
          damage: baseDamage
        });
        break;
      }
    }

    // Check harvesting world objects (trees, rocks, ores)
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

        const harvestDamage = Math.round(baseDamage * toolBonus);
        obj.hp -= harvestDamage;

        if (obj.hp <= 0) {
          // Object destroyed: spawn harvest loot
          this.world.modifyObject(tileX * TILE_SIZE + 16, tileY * TILE_SIZE + 16, null);
          this.spawnHarvestLoot(obj.type, tileX * TILE_SIZE + 16, tileY * TILE_SIZE + 16);
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

  // Use consumable or place building
  processUseItem(player, slotIndex, targetX, targetY) {
    const slot = player.inventory[slotIndex];
    if (!slot) return;
    const itemData = ITEMS[slot.itemId];
    if (!itemData) return;

    // Consumables (Food, Potion)
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

    // Building Placement
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

      // Check Monolith placement (Capstone Victory condition!)
      if (itemData.placeTile === 'monolith') {
        player.hasWon = true;
        this.broadcast({
          type: 'VICTORY_ANNOUNCE',
          winnerName: player.username,
          text: `Qahramon ${player.username} G'alaba Monolitini tikladi va Olamni qutqardi! Capstone loyihasi muvaffaqiyatli yakunlandi!`
        });
      }

      // Place object
      const newObj = {
        type: itemData.placeTile,
        hp: itemData.hp || 100,
        maxHp: itemData.hp || 100,
        placedBy: player.username,
        isOpen: false
      };

      this.world.modifyObject(tileX * TILE_SIZE + 16, tileY * TILE_SIZE + 16, newObj);

      // Consume item from inventory
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

  // Crafting System (25 recipes)
  processCrafting(player, recipeId) {
    const recipe = RECIPES.find(r => r.id === recipeId);
    if (!recipe) return;

    // Check Workbench requirement
    if (recipe.reqWorkbench) {
      const nearWorkbench = this.isNearPlacedObject(player.x, player.y, 'workbench', 75);
      if (!nearWorkbench) {
        this.send(player.id, { type: 'CHAT_MSG', text: "Ushbu buyum uchun Dastgoh (Workbench) yonida bo'lish kerak!", color: '#e74c3c' });
        return;
      }
    }

    // Check ingredients
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

    // Deduct ingredients atomically
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

    // Add crafted result
    this.addItemToInventory(player, recipe.result, recipe.count);
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

  // Interacting with world objects (doors, chests)
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

  // Anti-Duplication Atomic Chest Transfer Protocol
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

    // Deduct from source
    srcItem.count -= transferAmount;
    const movedItemId = srcItem.itemId;
    if (srcItem.count <= 0) {
      srcArr[fromSlot] = null;
    }

    // Add to destination
    if (!dstArr[toSlot]) {
      dstArr[toSlot] = { itemId: movedItemId, count: transferAmount };
    } else if (dstArr[toSlot].itemId === movedItemId) {
      dstArr[toSlot].count += transferAmount;
    } else {
      // Swap slots
      const temp = dstArr[toSlot];
      dstArr[toSlot] = { itemId: movedItemId, count: transferAmount };
      srcArr[fromSlot] = temp;
    }

    // Execute Atomic SQLite Transaction (ACID)
    const success = this.db.atomicTransfer({
      playerId: player.id,
      playerSlots,
      chestId,
      chestSlots: chestItems
    });

    if (success) {
      player.inventory = playerSlots;

      // Broadcast chest state to all players viewing this chest
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

  // Drop item to ground
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
      x: Math.round(p.x),
      y: Math.round(p.y),
      vx: p.vx,
      vy: p.vy,
      facingAngle: p.facingAngle,
      hp: Math.round(p.hp),
      maxHp: p.maxHp,
      hunger: Math.round(p.hunger),
      stamina: Math.round(p.stamina),
      selectedSlot: p.selectedSlot,
      kills: p.kills,
      score: p.score,
      hasWon: p.hasWon
    };
  }

  // Broadcast delta state packet at 30 Hz
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
      if (ws.readyState === 1) { // OPEN
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
