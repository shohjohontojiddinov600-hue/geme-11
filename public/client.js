// Client Networking, Input Controller and UI Manager for Mythic Realms
(function () {
  const canvas = document.getElementById('gameCanvas');
  const minimapCanvas = document.getElementById('minimapCanvas');
  const renderer = new window.GameRenderer(canvas, minimapCanvas);

  let ws = null;
  let localPlayerId = null;
  let localPlayer = null;
  let gameState = {};
  let itemsDb = {};
  let recipesDb = [];
  let inventory = new Array(30).fill(null);
  let openChest = null;
  let selectedSlot = 0;

  // Input state
  const keys = { w: false, a: false, s: false, d: false, shift: false };
  let mousePos = { x: 0, y: 0 };
  let currentChunkKey = null;

  // FPS calculation
  let frameCount = 0;
  let lastFpsTime = performance.now();
  let currentFps = 60;

  // UI Elements
  const lobbyModal = document.getElementById('lobbyModal');
  const pauseModal = document.getElementById('pauseModal');
  const inventoryModal = document.getElementById('inventoryModal');
  const craftingModal = document.getElementById('craftingModal');
  const chestModal = document.getElementById('chestModal');
  const victoryModal = document.getElementById('victoryModal');
  const respawnOverlay = document.getElementById('respawnOverlay');

  const hpFill = document.getElementById('hpFill');
  const hungerFill = document.getElementById('hungerFill');
  const staminaFill = document.getElementById('staminaFill');
  const hpText = document.getElementById('hpText');
  const hungerText = document.getElementById('hungerText');
  const staminaText = document.getElementById('staminaText');
  const timeDisplay = document.getElementById('timeDisplay');
  const biomeDisplay = document.getElementById('biomeDisplay');
  const playerNameDisplay = document.getElementById('playerNameDisplay');
  const eventLog = document.getElementById('eventLog');
  const quickslotsContainer = document.getElementById('quickslotsContainer');
  const fpsBadge = document.getElementById('fpsBadge');
  const muteBtn = document.getElementById('muteBtn');

  // Initialize Quickslot action bar (1-8)
  function initQuickslots() {
    quickslotsContainer.innerHTML = '';
    for (let i = 0; i < 8; i++) {
      const slotDiv = document.createElement('div');
      slotDiv.className = `quickslot ${i === selectedSlot ? 'active' : ''}`;
      slotDiv.dataset.slot = i;
      slotDiv.innerHTML = `
        <span class="slot-number">${i + 1}</span>
        <span class="slot-icon" id="quickIcon_${i}"></span>
        <span class="slot-count" id="quickCount_${i}"></span>
      `;
      slotDiv.addEventListener('click', () => {
        selectSlot(i);
      });
      quickslotsContainer.appendChild(slotDiv);
    }
  }

  function selectSlot(index) {
    selectedSlot = index;
    document.querySelectorAll('.quickslot').forEach((el, idx) => {
      el.classList.toggle('active', idx === selectedSlot);
    });
    if (ws && ws.readyState === WebSocket.OPEN) {
      ws.send(JSON.stringify({ type: 'SELECT_SLOT', slot: selectedSlot }));
    }
  }

  // Connect to Game Server
  function connect(username, color) {
    const protocol = location.protocol === 'https:' ? 'wss:' : 'ws:';
    ws = new WebSocket(`${protocol}//${location.host}`);

    ws.onopen = () => {
      ws.send(JSON.stringify({ type: 'JOIN', username, color }));
      lobbyModal.classList.add('hidden');
      addLog(`Serverga ulandingiz! Xush kelibsiz, ${username}!`);
    };

    ws.onmessage = (event) => {
      try {
        const msg = JSON.parse(event.data);
        handleServerMessage(msg);
      } catch (e) {
        console.error('Error parsing WS message:', e);
      }
    };

    ws.onclose = () => {
      addLog('Server bilan aloqa uzildi. Qayta ulanilmoqda...', '#e74c3c');
      setTimeout(() => location.reload(), 2500);
    };
  }

  function handleServerMessage(msg) {
    switch (msg.type) {
      case 'INIT': {
        localPlayerId = msg.player.id;
        localPlayer = msg.player;
        inventory = msg.inventory;
        itemsDb = msg.items;
        recipesDb = msg.recipes;
        playerNameDisplay.textContent = localPlayer.username;
        updateInventoryUI();
        initCraftingUI();
        requestSurroundingChunks(localPlayer.x, localPlayer.y);
        break;
      }

      case 'CHUNK_DATA': {
        renderer.setChunk(msg.chunk);
        break;
      }

      case 'STATE_TICK': {
        gameState = msg;
        const p = msg.players.find(x => x.id === localPlayerId);
        if (p) {
          localPlayer = p;
          updateHUD(p, msg.worldTime, msg.isNight);
          checkChunkTransition(p.x, p.y);
        }
        break;
      }

      case 'INVENTORY_UPDATE': {
        inventory = msg.inventory;
        updateInventoryUI();
        if (msg.pickedItem) {
          const item = itemsDb[msg.pickedItem.itemId];
          window.gameAudio?.pickup();
          addLog(`Topildi: +${msg.pickedItem.count} ${item?.name || msg.pickedItem.itemId}`, '#2ecc71');
        }
        if (msg.crafted) {
          const item = itemsDb[msg.crafted.itemId];
          window.gameAudio?.craft();
          addLog(`Yasaldi: ${item?.name || msg.crafted.itemId}`, '#f1c40f');
        }
        break;
      }

      case 'OPEN_CHEST': {
        openChest = { id: msg.chestId, items: msg.items };
        renderChestModal();
        chestModal.classList.remove('hidden');
        break;
      }

      case 'CHEST_SYNC': {
        if (openChest && openChest.id === msg.chestId) {
          openChest.items = msg.items;
          renderChestModal();
        }
        break;
      }

      case 'COMBAT_EFFECT': {
        renderer.addSlashEffect(msg.x, msg.y, msg.damage);
        window.gameAudio?.slash();
        break;
      }

      case 'CHAT_MSG': {
        addLog(msg.text, msg.color || '#ecf0f1');
        break;
      }

      case 'VICTORY_ANNOUNCE': {
        window.gameAudio?.victory();
        document.getElementById('victoryText').textContent = msg.text;
        victoryModal.classList.remove('hidden');
        break;
      }

      case 'RESPAWN_ACK': {
        respawnOverlay.classList.add('hidden');
        break;
      }
    }
  }

  function updateHUD(p, worldTime, isNight) {
    hpFill.style.width = `${Math.max(0, (p.hp / p.maxHp) * 100)}%`;
    hungerFill.style.width = `${Math.max(0, p.hunger)}%`;
    staminaFill.style.width = `${Math.max(0, p.stamina)}%`;

    hpText.textContent = `${p.hp}/${p.maxHp}`;
    hungerText.textContent = `${p.hunger}/100`;
    staminaText.textContent = `${p.stamina}/100`;

    const mins = Math.floor(worldTime / 60);
    const secs = Math.floor(worldTime % 60);
    timeDisplay.textContent = `${isNight ? '🌙 Tun' : '☀️ Kun'} (${String(mins).padStart(2, '0')}:${String(secs).padStart(2, '0')})`;

    if (p.hp <= 0 && respawnOverlay.classList.contains('hidden')) {
      respawnOverlay.classList.remove('hidden');
      window.gameAudio?.hurt();
    }
  }

  function checkChunkTransition(worldX, worldY) {
    const cx = Math.floor(worldX / (16 * 32));
    const cy = Math.floor(worldY / (16 * 32));
    const key = `${cx},${cy}`;
    if (key !== currentChunkKey) {
      currentChunkKey = key;
      requestSurroundingChunks(worldX, worldY);
    }
  }

  function requestSurroundingChunks(worldX, worldY) {
    if (!ws || ws.readyState !== WebSocket.OPEN) return;
    const cx = Math.floor(worldX / (16 * 32));
    const cy = Math.floor(worldY / (16 * 32));
    for (let ox = -2; ox <= 2; ox++) {
      for (let oy = -2; oy <= 2; oy++) {
        ws.send(JSON.stringify({ type: 'REQUEST_CHUNK', cx: cx + ox, cy: cy + oy }));
      }
    }
  }

  function updateInventoryUI() {
    for (let i = 0; i < 8; i++) {
      const slot = inventory[i];
      const iconSpan = document.getElementById(`quickIcon_${i}`);
      const countSpan = document.getElementById(`quickCount_${i}`);
      if (slot && itemsDb[slot.itemId]) {
        const item = itemsDb[slot.itemId];
        iconSpan.textContent = item.icon;
        countSpan.textContent = slot.count > 1 ? slot.count : '';
      } else {
        iconSpan.textContent = '';
        countSpan.textContent = '';
      }
    }

    const invGrid = document.getElementById('inventoryGrid');
    if (!invGrid) return;
    invGrid.innerHTML = '';

    for (let i = 0; i < 30; i++) {
      const slot = inventory[i];
      const slotDiv = document.createElement('div');
      slotDiv.className = 'inv-slot';
      if (slot && itemsDb[slot.itemId]) {
        const item = itemsDb[slot.itemId];
        slotDiv.innerHTML = `
          <span style="font-size:22px">${item.icon}</span>
          ${slot.count > 1 ? `<span class="slot-count">${slot.count}</span>` : ''}
        `;
        slotDiv.title = `${item.name} (${item.desc || ''})`;
      }

      slotDiv.addEventListener('click', (e) => {
        if (e.shiftKey && slot) {
          ws.send(JSON.stringify({ type: 'DROP_ITEM', slotIndex: i, count: slot.count }));
        } else if (slot) {
          ws.send(JSON.stringify({ type: 'USE_ITEM', slotIndex: i, targetX: localPlayer.x, targetY: localPlayer.y }));
        }
      });

      invGrid.appendChild(slotDiv);
    }
  }

  function initCraftingUI() {
    const listContainer = document.getElementById('craftingList');
    if (!listContainer) return;

    renderCraftingCategory('all');

    document.querySelectorAll('.cat-btn').forEach(btn => {
      btn.addEventListener('click', () => {
        document.querySelectorAll('.cat-btn').forEach(b => b.classList.remove('active'));
        btn.classList.add('active');
        renderCraftingCategory(btn.dataset.cat);
      });
    });
  }

  function renderCraftingCategory(category) {
    const listContainer = document.getElementById('craftingList');
    listContainer.innerHTML = '';

    const filtered = category === 'all' ? recipesDb : recipesDb.filter(r => r.category === category);

    for (const recipe of filtered) {
      const resultItem = itemsDb[recipe.result];
      if (!resultItem) continue;

      const row = document.createElement('div');
      row.className = 'craft-item-row';

      let canCraft = true;
      const ingTexts = recipe.ingredients.map(ing => {
        const it = itemsDb[ing.item];
        let found = 0;
        for (const s of inventory) {
          if (s && s.itemId === ing.item) found += s.count;
        }
        if (found < ing.count) canCraft = false;
        return `${it ? it.name : ing.item} x${ing.count} (${found}/${ing.count})`;
      }).join(', ');

      row.innerHTML = `
        <div style="display:flex; align-items:center; gap:10px;">
          <span style="font-size:24px">${resultItem.icon}</span>
          <div>
            <div style="font-weight:bold; font-size:14px;">${resultItem.name} x${recipe.count}</div>
            <div style="font-size:11px; color:#aaa;">Kerak: ${ingTexts}</div>
            ${recipe.reqWorkbench ? '<div style="font-size:10px; color:#f39c12;">🔨 Dastgoh kerak</div>' : ''}
          </div>
        </div>
        <button class="craft-btn" ${canCraft ? '' : 'disabled'}>Yasash</button>
      `;

      row.querySelector('button').addEventListener('click', () => {
        ws.send(JSON.stringify({ type: 'CRAFT_RECIPE', recipeId: recipe.id }));
      });

      listContainer.appendChild(row);
    }
  }

  function renderChestModal() {
    if (!openChest) return;
    const grid = document.getElementById('chestGrid');
    grid.innerHTML = '';

    for (let i = 0; i < 20; i++) {
      const slot = openChest.items[i];
      const slotDiv = document.createElement('div');
      slotDiv.className = 'inv-slot';
      if (slot && itemsDb[slot.itemId]) {
        const item = itemsDb[slot.itemId];
        slotDiv.innerHTML = `
          <span style="font-size:22px">${item.icon}</span>
          ${slot.count > 1 ? `<span class="slot-count">${slot.count}</span>` : ''}
        `;
        slotDiv.title = `Sandiqdan olish uchun bosing: ${item.name}`;
      }

      slotDiv.addEventListener('click', () => {
        if (slot) {
          const emptyInvSlot = inventory.findIndex(s => s === null);
          if (emptyInvSlot !== -1) {
            ws.send(JSON.stringify({
              type: 'CHEST_TRANSFER',
              chestId: openChest.id,
              fromType: 'chest',
              fromSlot: i,
              toType: 'player',
              toSlot: emptyInvSlot,
              count: slot.count
            }));
          } else {
            addLog("Inventarda bo'sh joy yo'q!", '#e74c3c');
          }
        }
      });

      grid.appendChild(slotDiv);
    }
  }

  function addLog(text, color = '#ecf0f1') {
    const entry = document.createElement('div');
    entry.className = 'log-entry';
    entry.style.borderLeftColor = color;
    entry.textContent = text;
    eventLog.appendChild(entry);
    if (eventLog.children.length > 5) {
      eventLog.removeChild(eventLog.firstChild);
    }
  }

  // Keyboard and Input Events
  window.addEventListener('keydown', (e) => {
    if (e.key === 'Tab' || e.key.toLowerCase() === 'i') {
      e.preventDefault();
      inventoryModal.classList.toggle('hidden');
    } else if (e.key.toLowerCase() === 'c') {
      e.preventDefault();
      craftingModal.classList.toggle('hidden');
      if (!craftingModal.classList.contains('hidden')) {
        renderCraftingCategory('all');
      }
    } else if (e.key === 'Escape') {
      if (!inventoryModal.classList.contains('hidden')) {
        inventoryModal.classList.add('hidden');
      } else if (!craftingModal.classList.contains('hidden')) {
        craftingModal.classList.add('hidden');
      } else if (!chestModal.classList.contains('hidden')) {
        chestModal.classList.add('hidden');
        if (openChest) {
          ws.send(JSON.stringify({ type: 'CLOSE_CHEST' }));
          openChest = null;
        }
      } else {
        // Toggle Pause menu
        pauseModal.classList.toggle('hidden');
      }
    } else if (e.key >= '1' && e.key <= '8') {
      selectSlot(parseInt(e.key, 10) - 1);
    }

    if (e.key.toLowerCase() === 'w') keys.w = true;
    if (e.key.toLowerCase() === 'a') keys.a = true;
    if (e.key.toLowerCase() === 's') keys.s = true;
    if (e.key.toLowerCase() === 'd') keys.d = true;
    if (e.shiftKey) keys.shift = true;
    sendMovement();
  });

  window.addEventListener('keyup', (e) => {
    if (e.key.toLowerCase() === 'w') keys.w = false;
    if (e.key.toLowerCase() === 'a') keys.a = false;
    if (e.key.toLowerCase() === 's') keys.s = false;
    if (e.key.toLowerCase() === 'd') keys.d = false;
    if (!e.shiftKey) keys.shift = false;
    sendMovement();
  });

  function sendMovement() {
    if (!ws || ws.readyState !== WebSocket.OPEN) return;
    let vx = 0;
    let vy = 0;
    if (keys.w) vy -= 1;
    if (keys.s) vy += 1;
    if (keys.a) vx -= 1;
    if (keys.d) vx += 1;

    if (vx !== 0 && vy !== 0) {
      vx *= 0.7071;
      vy *= 0.7071;
    }

    const screenCenterX = window.innerWidth / 2;
    const screenCenterY = window.innerHeight / 2;
    const facingAngle = Math.atan2(mousePos.y - screenCenterY, mousePos.x - screenCenterX);

    ws.send(JSON.stringify({
      type: 'MOVE_INPUT',
      vx,
      vy,
      isSprinting: keys.shift,
      facingAngle
    }));
  }

  window.addEventListener('mousemove', (e) => {
    mousePos.x = e.clientX;
    mousePos.y = e.clientY;
  });

  // Mouse Clicks on Canvas
  canvas.addEventListener('mousedown', (e) => {
    if (!localPlayer || !ws || ws.readyState !== WebSocket.OPEN) return;

    const screenCenterX = window.innerWidth / 2;
    const screenCenterY = window.innerHeight / 2;
    const worldTargetX = localPlayer.x + (e.clientX - screenCenterX);
    const worldTargetY = localPlayer.y + (e.clientY - screenCenterY);

    if (e.button === 0) {
      const selectedItem = inventory[selectedSlot];
      if (selectedItem && itemsDb[selectedItem.itemId]?.placeTile) {
        ws.send(JSON.stringify({
          type: 'USE_ITEM',
          slotIndex: selectedSlot,
          targetX: worldTargetX,
          targetY: worldTargetY
        }));
      } else {
        ws.send(JSON.stringify({
          type: 'ATTACK_ACTION',
          targetX: worldTargetX,
          targetY: worldTargetY
        }));
      }
    } else if (e.button === 2) {
      const tileX = Math.floor(worldTargetX / 32);
      const tileY = Math.floor(worldTargetY / 32);
      ws.send(JSON.stringify({
        type: 'INTERACT_OBJECT',
        tileX,
        tileY
      }));
    }
  });

  canvas.addEventListener('contextmenu', (e) => e.preventDefault());

  // Lobby Form
  document.getElementById('connectBtn').addEventListener('click', () => {
    const name = document.getElementById('usernameInput').value || 'Qahramon';
    const color = document.getElementById('colorInput').value || '#3498db';
    connect(name, color);
  });

  // Pause Menu Buttons
  document.getElementById('menuBtn').addEventListener('click', () => {
    pauseModal.classList.toggle('hidden');
  });

  document.getElementById('resumeBtn').addEventListener('click', () => {
    pauseModal.classList.add('hidden');
  });

  muteBtn.addEventListener('click', () => {
    const isMuted = window.gameAudio.toggleMute();
    muteBtn.textContent = isMuted ? '🔇 Ovoz: O\'chirilgan (Unmute)' : '🔊 Ovoz: Yoqilgan (Mute)';
  });

  document.getElementById('disconnectBtn').addEventListener('click', () => {
    if (ws) ws.close();
    location.reload();
  });

  // Modal Close buttons
  document.getElementById('closeInvBtn').addEventListener('click', () => inventoryModal.classList.add('hidden'));
  document.getElementById('closeCraftBtn').addEventListener('click', () => craftingModal.classList.add('hidden'));
  document.getElementById('closeChestBtn').addEventListener('click', () => {
    chestModal.classList.add('hidden');
    if (openChest) {
      ws.send(JSON.stringify({ type: 'CLOSE_CHEST' }));
      openChest = null;
    }
  });

  // Respawn Button
  document.getElementById('respawnBtn').addEventListener('click', () => {
    if (ws && ws.readyState === WebSocket.OPEN) {
      ws.send(JSON.stringify({ type: 'RESPAWN' }));
    }
  });

  // Mobile Virtual Touch Controller bindings
  function bindTouchBtn(elemId, keyProp) {
    const el = document.getElementById(elemId);
    if (!el) return;
    el.addEventListener('touchstart', (e) => { e.preventDefault(); keys[keyProp] = true; sendMovement(); });
    el.addEventListener('touchend', (e) => { e.preventDefault(); keys[keyProp] = false; sendMovement(); });
  }

  bindTouchBtn('dpadUp', 'w');
  bindTouchBtn('dpadDown', 's');
  bindTouchBtn('dpadLeft', 'a');
  bindTouchBtn('dpadRight', 'd');

  const touchAttack = document.getElementById('touchAttackBtn');
  if (touchAttack) {
    touchAttack.addEventListener('touchstart', (e) => {
      e.preventDefault();
      if (localPlayer && ws) {
        ws.send(JSON.stringify({
          type: 'ATTACK_ACTION',
          targetX: localPlayer.x + Math.cos(localPlayer.facingAngle || 0) * 45,
          targetY: localPlayer.y + Math.sin(localPlayer.facingAngle || 0) * 45
        }));
      }
    });
  }

  const touchInteract = document.getElementById('touchInteractBtn');
  if (touchInteract) {
    touchInteract.addEventListener('touchstart', (e) => {
      e.preventDefault();
      if (localPlayer && ws) {
        const tx = Math.floor(localPlayer.x / 32);
        const ty = Math.floor(localPlayer.y / 32);
        ws.send(JSON.stringify({ type: 'INTERACT_OBJECT', tileX: tx, tileY: ty }));
      }
    });
  }

  // 60 FPS Render Loop & Performance Monitor
  function gameLoop() {
    frameCount++;
    const now = performance.now();
    if (now - lastFpsTime >= 1000) {
      currentFps = frameCount;
      frameCount = 0;
      lastFpsTime = now;
      if (fpsBadge) {
        fpsBadge.textContent = `● ${currentFps} FPS | 30Hz`;
      }
    }

    renderer.render(gameState, localPlayerId, itemsDb);
    requestAnimationFrame(gameLoop);
  }

  initQuickslots();
  requestAnimationFrame(gameLoop);
})();
