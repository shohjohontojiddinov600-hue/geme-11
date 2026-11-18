// Modern 60 FPS Canvas 2D Engine with Environmental VFX, Dynamic Lighting & Particles
const TILE_SIZE = 32;

class GameRenderer {
  constructor(canvas, minimapCanvas) {
    this.canvas = canvas;
    this.ctx = canvas.getContext('2d');
    this.minimapCanvas = minimapCanvas;
    this.minimapCtx = minimapCanvas ? minimapCanvas.getContext('2d') : null;

    this.camera = { x: 0, y: 0 };
    this.chunks = new Map();
    this.particles = [];
    this.floatingTexts = [];
    this.chatBubbles = new Map(); // playerId -> { text, time }
    this.ambientParticles = [];
    this.screenShake = 0;

    this.initAmbientParticles();
    this.resize();
    window.addEventListener('resize', () => this.resize());
  }

  resize() {
    this.canvas.width = window.innerWidth;
    this.canvas.height = window.innerHeight;
    this.ctx.imageSmoothingEnabled = false;
  }

  setChunk(chunk) {
    this.chunks.set(`${chunk.cx},${chunk.cy}`, chunk);
  }

  triggerScreenShake(intensity = 6) {
    this.screenShake = Math.max(this.screenShake, intensity);
  }

  addSlashEffect(x, y, damage, isCrit = false) {
    this.triggerScreenShake(isCrit ? 8 : 4);
    this.floatingTexts.push({
      x,
      y: y - 10,
      text: isCrit ? `CRIT! -${damage}` : `-${damage}`,
      color: isCrit ? '#f1c40f' : '#e74c3c',
      isCrit,
      alpha: 1.0,
      vy: isCrit ? -45 : -30
    });

    const count = isCrit ? 12 : 6;
    for (let i = 0; i < count; i++) {
      this.particles.push({
        x,
        y,
        vx: (Math.random() - 0.5) * (isCrit ? 120 : 80),
        vy: (Math.random() - 0.5) * (isCrit ? 120 : 80),
        color: isCrit ? '#f39c12' : '#e74c3c',
        size: isCrit ? 4 : 3,
        alpha: 1.0,
        life: 0.35
      });
    }
  }

  addLevelUpEffect(x, y) {
    this.floatingTexts.push({
      x,
      y: y - 25,
      text: `⭐ LEVEL UP!`,
      color: '#f1c40f',
      isCrit: true,
      alpha: 1.0,
      vy: -25
    });
    for (let i = 0; i < 20; i++) {
      this.particles.push({
        x,
        y,
        vx: (Math.random() - 0.5) * 140,
        vy: -Math.random() * 100 - 30,
        color: Math.random() < 0.5 ? '#f1c40f' : '#3498db',
        size: 4,
        alpha: 1.0,
        life: 0.7
      });
    }
  }

  setChatBubble(playerId, text) {
    this.chatBubbles.set(playerId, { text, expiresAt: Date.now() + 4500 });
  }

  initAmbientParticles() {
    this.ambientParticles = [];
    for (let i = 0; i < 60; i++) {
      this.ambientParticles.push({
        x: (Math.random() - 0.5) * 1600,
        y: (Math.random() - 0.5) * 1200,
        vx: (Math.random() - 0.5) * 15,
        vy: (Math.random() - 0.5) * 15 + 10,
        size: Math.random() * 2.5 + 1,
        alpha: Math.random() * 0.7 + 0.3,
        type: 'mote'
      });
    }
  }

  render(state, localPlayerId, itemsDb) {
    const ctx = this.ctx;
    const width = this.canvas.width;
    const height = this.canvas.height;
    const now = Date.now();

    const localPlayer = state.players?.find(p => p.id === localPlayerId);
    if (localPlayer) {
      this.camera.x += (localPlayer.x - this.camera.x) * 0.14;
      this.camera.y += (localPlayer.y - this.camera.y) * 0.14;
    }

    // Screen shake application
    let shakeX = 0;
    let shakeY = 0;
    if (this.screenShake > 0) {
      shakeX = (Math.random() - 0.5) * this.screenShake;
      shakeY = (Math.random() - 0.5) * this.screenShake;
      this.screenShake = Math.max(0, this.screenShake - 0.5);
    }

    ctx.clearRect(0, 0, width, height);

    ctx.save();
    ctx.translate(
      Math.round(width / 2 - this.camera.x + shakeX),
      Math.round(height / 2 - this.camera.y + shakeY)
    );

    // 1. Render Visible Chunks & Base Tiles
    const startCx = Math.floor((this.camera.x - width / 2) / (16 * TILE_SIZE)) - 1;
    const endCx = Math.floor((this.camera.x + width / 2) / (16 * TILE_SIZE)) + 1;
    const startCy = Math.floor((this.camera.y - height / 2) / (16 * TILE_SIZE)) - 1;
    const endCy = Math.floor((this.camera.y + height / 2) / (16 * TILE_SIZE)) + 1;

    const placedLights = [];

    for (let cy = startCy; cy <= endCy; cy++) {
      for (let cx = startCx; cx <= endCx; cx++) {
        const chunk = this.chunks.get(`${cx},${cy}`);
        if (!chunk) continue;

        const chunkWorldX = cx * 16 * TILE_SIZE;
        const chunkWorldY = cy * 16 * TILE_SIZE;

        for (let ly = 0; ly < 16; ly++) {
          for (let lx = 0; lx < 16; lx++) {
            const idx = ly * 16 + lx;
            const tile = chunk.tiles[idx];
            const obj = chunk.objects[idx];
            const tx = chunkWorldX + lx * TILE_SIZE;
            const ty = chunkWorldY + ly * TILE_SIZE;

            this.drawGroundTile(ctx, tile, tx, ty, now);

            if (obj) {
              this.drawWorldObject(ctx, obj, tx, ty, now);
              if (obj.type === 'torch' || obj.type === 'campfire' || obj.type === 'frost_crystal' || obj.type === 'monolith') {
                placedLights.push({
                  x: tx + 16,
                  y: ty + 16,
                  radius: obj.type === 'campfire' ? 240 : (obj.type === 'monolith' ? 280 : 170),
                  color: obj.type === 'frost_crystal' ? '#00bcd4' : (obj.type === 'monolith' ? '#9b59b6' : '#ffa500')
                });
              }
            }
          }
        }
      }
    }

    // 2. Render Dropped Items
    if (state.drops) {
      for (const drop of state.drops) {
        const bob = Math.sin((now - drop.createdAt) * 0.005) * 4;
        const item = itemsDb[drop.itemId];

        // Soft drop shadow
        ctx.fillStyle = 'rgba(0, 0, 0, 0.25)';
        ctx.beginPath();
        ctx.ellipse(drop.x, drop.y + 6, 8, 4, 0, 0, Math.PI * 2);
        ctx.fill();

        ctx.fillStyle = item ? item.color : '#fff';
        ctx.beginPath();
        ctx.arc(drop.x, drop.y + bob, 9, 0, Math.PI * 2);
        ctx.fill();
        ctx.strokeStyle = '#fff';
        ctx.lineWidth = 1.5;
        ctx.stroke();

        ctx.fillStyle = '#fff';
        ctx.font = '11px sans-serif';
        ctx.textAlign = 'center';
        ctx.fillText(item ? item.icon : '📦', drop.x, drop.y + bob + 3);
      }
    }

    // 3. Render Monsters & Bosses
    if (state.monsters) {
      for (const mob of state.monsters) {
        this.drawMonster(ctx, mob, now);
      }
    }

    // 4. Render Players
    if (state.players) {
      for (const p of state.players) {
        this.drawPlayer(ctx, p, p.id === localPlayerId, itemsDb, now);
      }
    }

    // 5. Render Projectiles
    if (state.projectiles) {
      for (const proj of state.projectiles) {
        ctx.fillStyle = proj.color || '#fff';
        ctx.beginPath();
        ctx.arc(proj.x, proj.y, proj.isMonster ? 5 : 4, 0, Math.PI * 2);
        ctx.fill();

        // Glowing tail trail
        ctx.fillStyle = 'rgba(255, 255, 255, 0.3)';
        ctx.beginPath();
        ctx.arc(proj.x - proj.vx * 0.03, proj.y - proj.vy * 0.03, 3, 0, Math.PI * 2);
        ctx.fill();
      }
    }

    // 6. Ambient Environmental Particles (fireflies, snow, dust)
    this.drawAmbientVFX(ctx, localPlayer, state.isNight);

    // 7. Floating Combat Texts & Particles
    this.updateAndDrawParticles(ctx, 0.016);

    ctx.restore();

    // 8. Dynamic Day/Night Lighting Shader
    this.renderLighting(ctx, width, height, state.isNight, state.worldTime, localPlayer, placedLights);

    // 9. Modern Mini-Map 2.0
    if (this.minimapCtx && localPlayer) {
      this.renderMinimap(state, localPlayer);
    }
  }

  drawGroundTile(ctx, type, x, y, now) {
    if (type === 'grass') {
      ctx.fillStyle = '#2d8a4e';
      ctx.fillRect(x, y, TILE_SIZE, TILE_SIZE);
      ctx.fillStyle = '#267341';
      ctx.fillRect(x + 4, y + 4, 3, 3);
      ctx.fillRect(x + 20, y + 18, 3, 3);
    } else if (type === 'dirt') {
      ctx.fillStyle = '#6d4c41';
      ctx.fillRect(x, y, TILE_SIZE, TILE_SIZE);
    } else if (type === 'sand') {
      ctx.fillStyle = '#d4ac0d';
      ctx.fillRect(x, y, TILE_SIZE, TILE_SIZE);
      ctx.fillStyle = '#b7950b';
      ctx.fillRect(x + 8, y + 14, 4, 2);
    } else if (type === 'snow') {
      ctx.fillStyle = '#eaeded';
      ctx.fillRect(x, y, TILE_SIZE, TILE_SIZE);
    } else if (type === 'ice') {
      ctx.fillStyle = '#aed6f1';
      ctx.fillRect(x, y, TILE_SIZE, TILE_SIZE);
    } else if (type === 'water') {
      // Animated wave effect
      const wave = Math.sin((now * 0.003) + (x * 0.05) + (y * 0.05)) * 1.5;
      ctx.fillStyle = '#2471a3';
      ctx.fillRect(x, y, TILE_SIZE, TILE_SIZE);
      ctx.fillStyle = '#5dade2';
      ctx.fillRect(x + 6, y + 8 + wave, 18, 2);
      ctx.fillRect(x + 2, y + 20 - wave, 12, 2);
    } else {
      ctx.fillStyle = '#2b2b2b';
      ctx.fillRect(x, y, TILE_SIZE, TILE_SIZE);
    }

    ctx.strokeStyle = 'rgba(0, 0, 0, 0.035)';
    ctx.strokeRect(x, y, TILE_SIZE, TILE_SIZE);
  }

  drawWorldObject(ctx, obj, x, y, now) {
    const cx = x + 16;
    const cy = y + 16;

    switch (obj.type) {
      case 'tree': {
        const wind = Math.sin(now * 0.002 + x) * 2;
        ctx.fillStyle = '#4a2c11';
        ctx.fillRect(cx - 5, cy, 10, 16);
        ctx.fillStyle = '#1b5e20';
        ctx.beginPath();
        ctx.arc(cx + wind, cy - 6, 17, 0, Math.PI * 2);
        ctx.fill();
        ctx.fillStyle = '#2e7d32';
        ctx.beginPath();
        ctx.arc(cx + wind - 3, cy - 8, 12, 0, Math.PI * 2);
        ctx.fill();
        break;
      }

      case 'rock':
        ctx.fillStyle = '#78909c';
        ctx.beginPath();
        ctx.arc(cx, cy, 12, 0, Math.PI * 2);
        ctx.fill();
        ctx.fillStyle = '#546e7a';
        ctx.fillRect(cx - 5, cy - 5, 8, 8);
        break;

      case 'iron_vein':
        ctx.fillStyle = '#78909c';
        ctx.beginPath();
        ctx.arc(cx, cy, 13, 0, Math.PI * 2);
        ctx.fill();
        ctx.fillStyle = '#e67e22';
        ctx.fillRect(cx - 4, cy - 4, 8, 8);
        break;

      case 'gold_vein':
        ctx.fillStyle = '#78909c';
        ctx.beginPath();
        ctx.arc(cx, cy, 13, 0, Math.PI * 2);
        ctx.fill();
        ctx.fillStyle = '#f1c40f';
        ctx.fillRect(cx - 5, cy - 5, 9, 9);
        break;

      case 'frost_crystal':
        ctx.fillStyle = '#00e5ff';
        ctx.beginPath();
        ctx.moveTo(cx, cy - 15);
        ctx.lineTo(cx + 9, cy + 11);
        ctx.lineTo(cx - 9, cy + 11);
        ctx.closePath();
        ctx.fill();
        break;

      case 'obsidian_node':
        ctx.fillStyle = '#1c0d2a';
        ctx.fillRect(x + 3, y + 3, 26, 26);
        ctx.fillStyle = '#4a148c';
        ctx.fillRect(x + 8, y + 8, 16, 16);
        break;

      case 'berry_bush':
        ctx.fillStyle = '#2e7d32';
        ctx.beginPath();
        ctx.arc(cx, cy, 11, 0, Math.PI * 2);
        ctx.fill();
        ctx.fillStyle = '#e91e63';
        ctx.fillRect(cx - 5, cy - 3, 5, 5);
        ctx.fillRect(cx + 2, cy + 2, 5, 5);
        break;

      case 'cactus':
        ctx.fillStyle = '#2e7d32';
        ctx.fillRect(cx - 4, cy - 12, 8, 26);
        ctx.fillRect(cx - 10, cy - 6, 6, 8);
        ctx.fillRect(cx + 4, cy - 2, 6, 8);
        break;

      case 'wood_wall':
        ctx.fillStyle = '#8b5a2b';
        ctx.fillRect(x, y, TILE_SIZE, TILE_SIZE);
        ctx.strokeStyle = '#5c3a21';
        ctx.lineWidth = 2;
        ctx.strokeRect(x + 2, y + 2, TILE_SIZE - 4, TILE_SIZE - 4);
        break;

      case 'stone_wall':
        ctx.fillStyle = '#455a64';
        ctx.fillRect(x, y, TILE_SIZE, TILE_SIZE);
        ctx.strokeStyle = '#263238';
        ctx.lineWidth = 2;
        ctx.strokeRect(x + 2, y + 2, TILE_SIZE - 4, TILE_SIZE - 4);
        break;

      case 'wood_floor':
        ctx.fillStyle = '#d2b48c';
        ctx.fillRect(x, y, TILE_SIZE, TILE_SIZE);
        ctx.strokeStyle = 'rgba(0,0,0,0.06)';
        ctx.strokeRect(x, y, TILE_SIZE, TILE_SIZE);
        break;

      case 'wood_door':
        ctx.fillStyle = obj.isOpen ? '#a0522d' : '#8b4513';
        if (obj.isOpen) {
          ctx.fillRect(x + 2, y + 2, 6, TILE_SIZE - 4);
        } else {
          ctx.fillRect(x + 2, y + 2, TILE_SIZE - 4, TILE_SIZE - 4);
        }
        break;

      case 'workbench':
        ctx.fillStyle = '#8b5a2b';
        ctx.fillRect(x + 3, y + 5, 26, 22);
        ctx.fillStyle = '#ecf0f1';
        ctx.font = '13px sans-serif';
        ctx.fillText('🔨', cx - 7, cy + 5);
        break;

      case 'chest':
        ctx.fillStyle = '#b8860b';
        ctx.fillRect(x + 3, y + 5, 26, 22);
        ctx.fillStyle = '#f1c40f';
        ctx.fillRect(cx - 3, cy - 2, 6, 8);
        break;

      case 'campfire': {
        ctx.fillStyle = '#4a2c11';
        ctx.fillRect(x + 5, y + 18, 22, 8);
        const flicker = Math.sin(now * 0.015) * 3;
        ctx.fillStyle = '#ff3d00';
        ctx.beginPath();
        ctx.arc(cx, cy + 2, 10 + flicker, 0, Math.PI * 2);
        ctx.fill();
        ctx.fillStyle = '#ffea00';
        ctx.beginPath();
        ctx.arc(cx, cy + 2, 5 + flicker * 0.5, 0, Math.PI * 2);
        ctx.fill();
        break;
      }

      case 'torch': {
        ctx.fillStyle = '#8b5a2b';
        ctx.fillRect(cx - 2, cy - 2, 4, 15);
        const tflicker = Math.sin(now * 0.02) * 2;
        ctx.fillStyle = '#ff6d00';
        ctx.beginPath();
        ctx.arc(cx, cy - 5, 6 + tflicker, 0, Math.PI * 2);
        ctx.fill();
        break;
      }

      case 'monolith':
        ctx.fillStyle = '#6a1b9a';
        ctx.fillRect(x, y - 20, TILE_SIZE, TILE_SIZE + 20);
        ctx.strokeStyle = '#ffd700';
        ctx.lineWidth = 2;
        ctx.strokeRect(x, y - 20, TILE_SIZE, TILE_SIZE + 20);
        ctx.fillStyle = '#ffd700';
        ctx.font = '18px sans-serif';
        ctx.fillText('🏆', cx - 9, cy - 2);
        break;
    }
  }

  drawPlayer(ctx, p, isLocal, itemsDb, now) {
    if (p.hp <= 0) {
      ctx.fillStyle = '#78909c';
      ctx.fillRect(p.x - 10, p.y - 14, 20, 24);
      ctx.fillStyle = '#fff';
      ctx.font = '10px sans-serif';
      ctx.fillText('RIP', p.x - 9, p.y + 2);
      return;
    }

    // Walking animation bob
    const isMoving = p.vx !== 0 || p.vy !== 0;
    const walkBob = isMoving ? Math.sin(now * 0.014) * 2.5 : 0;

    // Soft player shadow
    ctx.fillStyle = 'rgba(0, 0, 0, 0.28)';
    ctx.beginPath();
    ctx.ellipse(p.x, p.y + 12, 12, 5, 0, 0, Math.PI * 2);
    ctx.fill();

    // Player Body
    ctx.fillStyle = p.color || '#3498db';
    ctx.beginPath();
    ctx.arc(p.x, p.y + walkBob, 14, 0, Math.PI * 2);
    ctx.fill();
    ctx.strokeStyle = '#1a252f';
    ctx.lineWidth = 2;
    ctx.stroke();

    // Facing indicator / Eye
    const eyeAngle = p.facingAngle || 0;
    const eyeX = p.x + Math.cos(eyeAngle) * 8;
    const eyeY = p.y + walkBob + Math.sin(eyeAngle) * 8;
    ctx.fillStyle = '#fff';
    ctx.beginPath();
    ctx.arc(eyeX, eyeY, 4, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = '#111';
    ctx.beginPath();
    ctx.arc(eyeX, eyeY, 2, 0, Math.PI * 2);
    ctx.fill();

    // Weapon/Tool in hand
    const handX = p.x + Math.cos(eyeAngle + 0.6) * 16;
    const handY = p.y + walkBob + Math.sin(eyeAngle + 0.6) * 16;
    ctx.fillStyle = '#f1c40f';
    ctx.beginPath();
    ctx.arc(handX, handY, 4, 0, Math.PI * 2);
    ctx.fill();

    // Player Name & Level Badge
    ctx.fillStyle = isLocal ? '#ffd700' : '#ecf0f1';
    ctx.font = 'bold 11px sans-serif';
    ctx.textAlign = 'center';
    ctx.fillText(`Lv.${p.level || 1} ${p.username}`, p.x, p.y - 22);

    // Mini Health Bar
    ctx.fillStyle = '#222';
    ctx.fillRect(p.x - 16, p.y - 18, 32, 4);
    ctx.fillStyle = '#e74c3c';
    ctx.fillRect(p.x - 16, p.y - 18, Math.max(0, (p.hp / (p.maxHp || 100)) * 32), 4);

    // In-game Chat Bubble
    const bubble = this.chatBubbles.get(p.id);
    if (bubble && bubble.expiresAt > now) {
      ctx.fillStyle = 'rgba(20, 25, 35, 0.92)';
      ctx.strokeStyle = '#3498db';
      ctx.lineWidth = 1;

      const textWidth = ctx.measureText(bubble.text).width;
      const bWidth = Math.max(50, textWidth + 16);
      const bHeight = 22;
      const bx = p.x - bWidth / 2;
      const by = p.y - 48;

      ctx.beginPath();
      ctx.roundRect(bx, by, bWidth, bHeight, 6);
      ctx.fill();
      ctx.stroke();

      ctx.fillStyle = '#fff';
      ctx.font = '11px sans-serif';
      ctx.fillText(bubble.text, p.x, by + 15);
    }
  }

  drawMonster(ctx, mob, now) {
    if (mob.hp <= 0) return;

    if (mob.isBoss) {
      // Boss Aura Pulse
      const pulse = Math.sin(now * 0.005) * 4;
      ctx.fillStyle = 'rgba(156, 39, 176, 0.2)';
      ctx.beginPath();
      ctx.arc(mob.x, mob.y, (mob.type === 'boss_wyrm' ? 38 : 32) + pulse, 0, Math.PI * 2);
      ctx.fill();

      ctx.fillStyle = mob.color || '#4a148c';
      ctx.beginPath();
      ctx.arc(mob.x, mob.y, mob.type === 'boss_wyrm' ? 34 : 28, 0, Math.PI * 2);
      ctx.fill();
      ctx.strokeStyle = '#ffd700';
      ctx.lineWidth = 3;
      ctx.stroke();

      // Boss Label and Top Bar
      ctx.fillStyle = '#ffd700';
      ctx.font = 'bold 13px sans-serif';
      ctx.textAlign = 'center';
      ctx.fillText(`👑 ${mob.name}`, mob.x, mob.y - 36);

      ctx.fillStyle = '#111';
      ctx.fillRect(mob.x - 30, mob.y - 31, 60, 6);
      ctx.fillStyle = '#e74c3c';
      ctx.fillRect(mob.x - 30, mob.y - 31, (mob.hp / mob.maxHp) * 60, 6);
    } else {
      ctx.fillStyle = mob.color || '#2ecc71';
      ctx.beginPath();
      ctx.arc(mob.x, mob.y, 13, 0, Math.PI * 2);
      ctx.fill();

      ctx.fillStyle = '#111';
      ctx.fillRect(mob.x - 14, mob.y - 18, 28, 3);
      ctx.fillStyle = '#e74c3c';
      ctx.fillRect(mob.x - 14, mob.y - 18, (mob.hp / mob.maxHp) * 28, 3);
    }
  }

  drawAmbientVFX(ctx, localPlayer, isNight) {
    if (!localPlayer) return;

    for (const p of this.ambientParticles) {
      p.x += p.vx * 0.016;
      p.y += p.vy * 0.016;

      // Wrap around local player
      if (p.x < localPlayer.x - 800) p.x += 1600;
      if (p.x > localPlayer.x + 800) p.x -= 1600;
      if (p.y < localPlayer.y - 600) p.y += 1200;
      if (p.y > localPlayer.y + 600) p.y -= 1200;

      ctx.fillStyle = isNight ? `rgba(100, 255, 150, ${p.alpha * 0.7})` : `rgba(255, 255, 255, ${p.alpha * 0.4})`;
      ctx.beginPath();
      ctx.arc(p.x, p.y, p.size, 0, Math.PI * 2);
      ctx.fill();
    }
  }

  updateAndDrawParticles(ctx, dt) {
    for (let i = this.particles.length - 1; i >= 0; i--) {
      const p = this.particles[i];
      p.x += p.vx * dt;
      p.y += p.vy * dt;
      p.life -= dt;
      if (p.life <= 0) {
        this.particles.splice(i, 1);
        continue;
      }
      ctx.fillStyle = p.color;
      ctx.fillRect(p.x, p.y, p.size, p.size);
    }

    for (let i = this.floatingTexts.length - 1; i >= 0; i--) {
      const t = this.floatingTexts[i];
      t.y += t.vy * dt;
      t.alpha -= dt * (t.isCrit ? 1.0 : 1.6);
      if (t.alpha <= 0) {
        this.floatingTexts.splice(i, 1);
        continue;
      }
      ctx.fillStyle = t.isCrit ? `rgba(241, 196, 15, ${t.alpha})` : `rgba(231, 76, 60, ${t.alpha})`;
      ctx.font = t.isCrit ? 'bold 16px sans-serif' : 'bold 13px sans-serif';
      ctx.textAlign = 'center';
      ctx.fillText(t.text, t.x, t.y);
    }
  }

  renderLighting(ctx, width, height, isNight, worldTime, localPlayer, lights) {
    if (!isNight) return;

    const mask = document.createElement('canvas');
    mask.width = width;
    mask.height = height;
    const mctx = mask.getContext('2d');

    mctx.fillStyle = 'rgba(8, 10, 16, 0.90)';
    mctx.fillRect(0, 0, width, height);

    mctx.globalCompositeOperation = 'destination-out';

    if (localPlayer) {
      const screenX = width / 2;
      const screenY = height / 2;
      const grad = mctx.createRadialGradient(screenX, screenY, 15, screenX, screenY, 160);
      grad.addColorStop(0, 'rgba(0, 0, 0, 1)');
      grad.addColorStop(1, 'rgba(0, 0, 0, 0)');
      mctx.fillStyle = grad;
      mctx.beginPath();
      mctx.arc(screenX, screenY, 160, 0, Math.PI * 2);
      mctx.fill();
    }

    for (const light of lights) {
      const sx = width / 2 - this.camera.x + light.x;
      const sy = height / 2 - this.camera.y + light.y;
      if (sx > -300 && sx < width + 300 && sy > -300 && sy < height + 300) {
        const grad = mctx.createRadialGradient(sx, sy, 10, sx, sy, light.radius);
        grad.addColorStop(0, 'rgba(0, 0, 0, 1)');
        grad.addColorStop(1, 'rgba(0, 0, 0, 0)');
        mctx.fillStyle = grad;
        mctx.beginPath();
        mctx.arc(sx, sy, light.radius, 0, Math.PI * 2);
        mctx.fill();
      }
    }

    ctx.drawImage(mask, 0, 0);
  }

  renderMinimap(state, localPlayer) {
    const mctx = this.minimapCtx;
    const w = this.minimapCanvas.width;
    const h = this.minimapCanvas.height;

    mctx.fillStyle = '#121620';
    mctx.fillRect(0, 0, w, h);

    const scale = 0.075;
    const centerMx = w / 2;
    const centerMy = h / 2;

    // Draw radar circle
    mctx.strokeStyle = 'rgba(52, 152, 219, 0.25)';
    mctx.beginPath();
    mctx.arc(centerMx, centerMy, w / 2 - 4, 0, Math.PI * 2);
    mctx.stroke();

    // Draw Other Players
    if (state.players) {
      for (const p of state.players) {
        const mx = centerMx + (p.x - localPlayer.x) * scale;
        const my = centerMy + (p.y - localPlayer.y) * scale;
        if (mx >= 4 && mx < w - 4 && my >= 4 && my < h - 4) {
          mctx.fillStyle = p.id === localPlayer.id ? '#2ecc71' : '#3498db';
          mctx.beginPath();
          mctx.arc(mx, my, p.id === localPlayer.id ? 4 : 3, 0, Math.PI * 2);
          mctx.fill();
        }
      }
    }

    // Draw Bosses & Compass Arrow
    if (state.monsters) {
      for (const mob of state.monsters) {
        if (mob.isBoss) {
          const dx = (mob.x - localPlayer.x) * scale;
          const dy = (mob.y - localPlayer.y) * scale;
          const mx = centerMx + dx;
          const my = centerMy + dy;

          if (mx >= 6 && mx < w - 6 && my >= 6 && my < h - 6) {
            mctx.fillStyle = '#e74c3c';
            mctx.beginPath();
            mctx.arc(mx, my, 5, 0, Math.PI * 2);
            mctx.fill();
          } else {
            // Edge compass pointer towards off-screen boss
            const angle = Math.atan2(dy, dx);
            const edgeX = centerMx + Math.cos(angle) * (w / 2 - 8);
            const edgeY = centerMy + Math.sin(angle) * (h / 2 - 8);
            mctx.fillStyle = '#f39c12';
            mctx.beginPath();
            mctx.arc(edgeX, edgeY, 3.5, 0, Math.PI * 2);
            mctx.fill();
          }
        }
      }
    }
  }
}

window.GameRenderer = GameRenderer;
