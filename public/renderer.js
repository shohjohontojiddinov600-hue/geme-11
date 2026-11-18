// 60 FPS HTML5 Canvas 2D Engine with Dynamic Day/Night Lighting for Mythic Realms
const TILE_SIZE = 32;

class GameRenderer {
  constructor(canvas, minimapCanvas) {
    this.canvas = canvas;
    this.ctx = canvas.getContext('2d');
    this.minimapCanvas = minimapCanvas;
    this.minimapCtx = minimapCanvas ? minimapCanvas.getContext('2d') : null;

    this.camera = { x: 0, y: 0 };
    this.chunks = new Map(); // chunkKey -> chunkData
    this.particles = [];
    this.floatingTexts = [];

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

  addSlashEffect(x, y, damage) {
    this.floatingTexts.push({
      x,
      y,
      text: `-${damage}`,
      color: '#e74c3c',
      alpha: 1.0,
      vy: -30
    });
    for (let i = 0; i < 6; i++) {
      this.particles.push({
        x,
        y,
        vx: (Math.random() - 0.5) * 80,
        vy: (Math.random() - 0.5) * 80,
        color: '#e74c3c',
        size: 3,
        alpha: 1.0,
        life: 0.3
      });
    }
  }

  render(state, localPlayerId, itemsDb) {
    const ctx = this.ctx;
    const width = this.canvas.width;
    const height = this.canvas.height;

    const localPlayer = state.players?.find(p => p.id === localPlayerId);
    if (localPlayer) {
      // Smooth Camera Lerp
      this.camera.x += (localPlayer.x - this.camera.x) * 0.15;
      this.camera.y += (localPlayer.y - this.camera.y) * 0.15;
    }

    ctx.clearRect(0, 0, width, height);

    // Save camera transform
    ctx.save();
    ctx.translate(Math.round(width / 2 - this.camera.x), Math.round(height / 2 - this.camera.y));

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

            // Draw Ground
            this.drawGroundTile(ctx, tile, tx, ty);

            // Draw Object / Placed Structure
            if (obj) {
              this.drawWorldObject(ctx, obj, tx, ty);
              if (obj.type === 'torch' || obj.type === 'campfire') {
                placedLights.push({
                  x: tx + 16,
                  y: ty + 16,
                  radius: obj.type === 'campfire' ? 220 : 160
                });
              }
            }
          }
        }
      }
    }

    // 2. Render Dropped Items
    const now = Date.now();
    if (state.drops) {
      for (const drop of state.drops) {
        const bob = Math.sin((now - drop.createdAt) * 0.005) * 4;
        const item = itemsDb[drop.itemId];
        ctx.fillStyle = item ? item.color : '#fff';
        ctx.beginPath();
        ctx.arc(drop.x, drop.y + bob, 8, 0, Math.PI * 2);
        ctx.fill();

        ctx.fillStyle = '#fff';
        ctx.font = '10px sans-serif';
        ctx.textAlign = 'center';
        ctx.fillText(item ? item.icon : '📦', drop.x, drop.y + bob + 3);
      }
    }

    // 3. Render Monsters & Bosses
    if (state.monsters) {
      for (const mob of state.monsters) {
        this.drawMonster(ctx, mob);
      }
    }

    // 4. Render Other Players and Local Player
    if (state.players) {
      for (const p of state.players) {
        this.drawPlayer(ctx, p, p.id === localPlayerId, itemsDb);
      }
    }

    // 5. Render Projectiles
    if (state.projectiles) {
      for (const proj of state.projectiles) {
        ctx.fillStyle = proj.color || '#fff';
        ctx.beginPath();
        ctx.arc(proj.x, proj.y, proj.isMonster ? 5 : 4, 0, Math.PI * 2);
        ctx.fill();
      }
    }

    // 6. Render Floating Texts & Particles
    this.updateAndDrawParticles(ctx, 0.016);

    ctx.restore();

    // 7. Day/Night Darkness & Radial Lighting Shader Layer
    this.renderLighting(ctx, width, height, state.isNight, state.worldTime, localPlayer, placedLights);

    // 8. Render Mini-Map
    if (this.minimapCtx && localPlayer) {
      this.renderMinimap(state, localPlayer);
    }
  }

  drawGroundTile(ctx, type, x, y) {
    if (type === 'grass') {
      ctx.fillStyle = '#2d8a4e';
      ctx.fillRect(x, y, TILE_SIZE, TILE_SIZE);
      ctx.fillStyle = '#267341';
      ctx.fillRect(x + 4, y + 4, 4, 4);
    } else if (type === 'dirt') {
      ctx.fillStyle = '#795548';
      ctx.fillRect(x, y, TILE_SIZE, TILE_SIZE);
    } else if (type === 'sand') {
      ctx.fillStyle = '#e0c068';
      ctx.fillRect(x, y, TILE_SIZE, TILE_SIZE);
    } else if (type === 'snow') {
      ctx.fillStyle = '#f0f3f4';
      ctx.fillRect(x, y, TILE_SIZE, TILE_SIZE);
    } else if (type === 'ice') {
      ctx.fillStyle = '#b0e0e6';
      ctx.fillRect(x, y, TILE_SIZE, TILE_SIZE);
    } else if (type === 'water') {
      ctx.fillStyle = '#2980b9';
      ctx.fillRect(x, y, TILE_SIZE, TILE_SIZE);
      ctx.fillStyle = '#3498db';
      ctx.fillRect(x + 8, y + 10, 16, 2);
    } else {
      ctx.fillStyle = '#333';
      ctx.fillRect(x, y, TILE_SIZE, TILE_SIZE);
    }
    // Subtle tile grid border
    ctx.strokeStyle = 'rgba(0, 0, 0, 0.04)';
    ctx.strokeRect(x, y, TILE_SIZE, TILE_SIZE);
  }

  drawWorldObject(ctx, obj, x, y) {
    const cx = x + 16;
    const cy = y + 16;

    switch (obj.type) {
      case 'tree':
        ctx.fillStyle = '#5c3a21';
        ctx.fillRect(cx - 5, cy, 10, 16);
        ctx.fillStyle = '#1e5f32';
        ctx.beginPath();
        ctx.arc(cx, cy - 6, 16, 0, Math.PI * 2);
        ctx.fill();
        break;

      case 'rock':
        ctx.fillStyle = '#7f8c8d';
        ctx.beginPath();
        ctx.arc(cx, cy, 12, 0, Math.PI * 2);
        ctx.fill();
        break;

      case 'iron_vein':
        ctx.fillStyle = '#95a5a6';
        ctx.beginPath();
        ctx.arc(cx, cy, 12, 0, Math.PI * 2);
        ctx.fill();
        ctx.fillStyle = '#d35400';
        ctx.fillRect(cx - 4, cy - 4, 8, 8);
        break;

      case 'gold_vein':
        ctx.fillStyle = '#95a5a6';
        ctx.beginPath();
        ctx.arc(cx, cy, 12, 0, Math.PI * 2);
        ctx.fill();
        ctx.fillStyle = '#f1c40f';
        ctx.fillRect(cx - 4, cy - 4, 8, 8);
        break;

      case 'frost_crystal':
        ctx.fillStyle = '#00bcd4';
        ctx.beginPath();
        ctx.moveTo(cx, cy - 14);
        ctx.lineTo(cx + 8, cy + 10);
        ctx.lineTo(cx - 8, cy + 10);
        ctx.closePath();
        ctx.fill();
        break;

      case 'obsidian_node':
        ctx.fillStyle = '#1c0d2a';
        ctx.fillRect(x + 4, y + 4, 24, 24);
        break;

      case 'berry_bush':
        ctx.fillStyle = '#27ae60';
        ctx.beginPath();
        ctx.arc(cx, cy, 10, 0, Math.PI * 2);
        ctx.fill();
        ctx.fillStyle = '#e74c3c';
        ctx.fillRect(cx - 4, cy - 2, 4, 4);
        ctx.fillRect(cx + 2, cy + 2, 4, 4);
        break;

      case 'wood_wall':
        ctx.fillStyle = '#8b5a2b';
        ctx.fillRect(x, y, TILE_SIZE, TILE_SIZE);
        ctx.strokeStyle = '#5c3a21';
        ctx.strokeRect(x + 2, y + 2, TILE_SIZE - 4, TILE_SIZE - 4);
        break;

      case 'stone_wall':
        ctx.fillStyle = '#555';
        ctx.fillRect(x, y, TILE_SIZE, TILE_SIZE);
        ctx.strokeStyle = '#333';
        ctx.strokeRect(x + 2, y + 2, TILE_SIZE - 4, TILE_SIZE - 4);
        break;

      case 'wood_floor':
        ctx.fillStyle = '#d2b48c';
        ctx.fillRect(x, y, TILE_SIZE, TILE_SIZE);
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
        ctx.fillRect(x + 4, y + 6, 24, 20);
        ctx.fillStyle = '#ecf0f1';
        ctx.font = '12px sans-serif';
        ctx.fillText('🔨', cx - 6, cy + 5);
        break;

      case 'chest':
        ctx.fillStyle = '#b8860b';
        ctx.fillRect(x + 4, y + 6, 24, 20);
        ctx.fillStyle = '#f1c40f';
        ctx.fillRect(cx - 2, cy - 1, 4, 6);
        break;

      case 'campfire':
        ctx.fillStyle = '#5c3a21';
        ctx.fillRect(x + 6, y + 18, 20, 8);
        ctx.fillStyle = Math.random() < 0.5 ? '#ff4500' : '#ffa500';
        ctx.beginPath();
        ctx.arc(cx, cy, 9 + Math.random() * 3, 0, Math.PI * 2);
        ctx.fill();
        break;

      case 'torch':
        ctx.fillStyle = '#8b5a2b';
        ctx.fillRect(cx - 2, cy - 2, 4, 14);
        ctx.fillStyle = Math.random() < 0.5 ? '#f39c12' : '#e67e22';
        ctx.beginPath();
        ctx.arc(cx, cy - 6, 5 + Math.random() * 2, 0, Math.PI * 2);
        ctx.fill();
        break;

      case 'monolith':
        ctx.fillStyle = '#9b59b6';
        ctx.fillRect(x, y - 16, TILE_SIZE, TILE_SIZE + 16);
        ctx.fillStyle = '#f1c40f';
        ctx.font = '16px sans-serif';
        ctx.fillText('🏆', cx - 8, cy);
        break;
    }
  }

  drawPlayer(ctx, p, isLocal, itemsDb) {
    if (p.hp <= 0) {
      // Tombstone
      ctx.fillStyle = '#7f8c8d';
      ctx.fillRect(p.x - 10, p.y - 14, 20, 24);
      ctx.fillStyle = '#fff';
      ctx.font = '10px sans-serif';
      ctx.fillText('RIP', p.x - 8, p.y + 2);
      return;
    }

    // Body
    ctx.fillStyle = p.color || '#3498db';
    ctx.beginPath();
    ctx.arc(p.x, p.y, 14, 0, Math.PI * 2);
    ctx.fill();
    ctx.strokeStyle = '#2c3e50';
    ctx.lineWidth = 2;
    ctx.stroke();

    // Facing indicator / Eye
    const eyeAngle = p.facingAngle || 0;
    const eyeX = p.x + Math.cos(eyeAngle) * 8;
    const eyeY = p.y + Math.sin(eyeAngle) * 8;
    ctx.fillStyle = '#fff';
    ctx.beginPath();
    ctx.arc(eyeX, eyeY, 4, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = '#111';
    ctx.beginPath();
    ctx.arc(eyeX, eyeY, 2, 0, Math.PI * 2);
    ctx.fill();

    // Player Name & Health Bar
    ctx.fillStyle = isLocal ? '#f1c40f' : '#ecf0f1';
    ctx.font = 'bold 11px sans-serif';
    ctx.textAlign = 'center';
    ctx.fillText(p.username, p.x, p.y - 20);

    // Mini Health bar
    ctx.fillStyle = '#333';
    ctx.fillRect(p.x - 16, p.y - 17, 32, 4);
    ctx.fillStyle = '#e74c3c';
    ctx.fillRect(p.x - 16, p.y - 17, Math.max(0, (p.hp / (p.maxHp || 100)) * 32), 4);
  }

  drawMonster(ctx, mob) {
    if (mob.hp <= 0) return;

    if (mob.isBoss) {
      // Boss styling
      ctx.fillStyle = mob.color || '#8e44ad';
      ctx.beginPath();
      ctx.arc(mob.x, mob.y, mob.type === 'boss_wyrm' ? 34 : 28, 0, Math.PI * 2);
      ctx.fill();
      ctx.strokeStyle = '#f1c40f';
      ctx.lineWidth = 3;
      ctx.stroke();

      // Boss Label and Top Bar
      ctx.fillStyle = '#f1c40f';
      ctx.font = 'bold 13px sans-serif';
      ctx.textAlign = 'center';
      ctx.fillText(`👑 ${mob.name}`, mob.x, mob.y - 36);

      ctx.fillStyle = '#222';
      ctx.fillRect(mob.x - 28, mob.y - 32, 56, 6);
      ctx.fillStyle = '#e74c3c';
      ctx.fillRect(mob.x - 28, mob.y - 32, (mob.hp / mob.maxHp) * 56, 6);
    } else {
      // Regular Mob
      ctx.fillStyle = mob.color || '#2ecc71';
      ctx.beginPath();
      ctx.arc(mob.x, mob.y, 13, 0, Math.PI * 2);
      ctx.fill();

      // HP bar
      ctx.fillStyle = '#333';
      ctx.fillRect(mob.x - 14, mob.y - 18, 28, 3);
      ctx.fillStyle = '#e74c3c';
      ctx.fillRect(mob.x - 14, mob.y - 18, (mob.hp / mob.maxHp) * 28, 3);
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
      t.alpha -= dt * 1.5;
      if (t.alpha <= 0) {
        this.floatingTexts.splice(i, 1);
        continue;
      }
      ctx.fillStyle = `rgba(231, 76, 60, ${t.alpha})`;
      ctx.font = 'bold 14px sans-serif';
      ctx.textAlign = 'center';
      ctx.fillText(t.text, t.x, t.y);
    }
  }

  // Dynamic Day/Night lighting shader
  renderLighting(ctx, width, height, isNight, worldTime, localPlayer, lights) {
    if (!isNight) return; // Full daylight

    // Darkness mask canvas
    const mask = document.createElement('canvas');
    mask.width = width;
    mask.height = height;
    const mctx = mask.getContext('2d');

    // Fill darkness (88% black)
    mctx.fillStyle = 'rgba(10, 12, 18, 0.88)';
    mctx.fillRect(0, 0, width, height);

    // Cut out radial light holes
    mctx.globalCompositeOperation = 'destination-out';

    // Player personal torch / vision
    if (localPlayer) {
      const screenX = width / 2;
      const screenY = height / 2;
      const grad = mctx.createRadialGradient(screenX, screenY, 20, screenX, screenY, 150);
      grad.addColorStop(0, 'rgba(0, 0, 0, 1)');
      grad.addColorStop(1, 'rgba(0, 0, 0, 0)');
      mctx.fillStyle = grad;
      mctx.beginPath();
      mctx.arc(screenX, screenY, 150, 0, Math.PI * 2);
      mctx.fill();
    }

    // World Torches & Campfires
    for (const light of lights) {
      const sx = width / 2 - this.camera.x + light.x;
      const sy = height / 2 - this.camera.y + light.y;
      if (sx > -200 && sx < width + 200 && sy > -200 && sy < height + 200) {
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

  // Mini-map rendering
  renderMinimap(state, localPlayer) {
    const mctx = this.minimapCtx;
    const w = this.minimapCanvas.width;
    const h = this.minimapCanvas.height;

    mctx.fillStyle = '#1a1f2c';
    mctx.fillRect(0, 0, w, h);

    const scale = 0.08;
    const centerMx = w / 2;
    const centerMy = h / 2;

    // Draw other players
    if (state.players) {
      for (const p of state.players) {
        const mx = centerMx + (p.x - localPlayer.x) * scale;
        const my = centerMy + (p.y - localPlayer.y) * scale;
        if (mx >= 0 && mx < w && my >= 0 && my < h) {
          mctx.fillStyle = p.id === localPlayer.id ? '#2ecc71' : '#3498db';
          mctx.beginPath();
          mctx.arc(mx, my, p.id === localPlayer.id ? 4 : 3, 0, Math.PI * 2);
          mctx.fill();
        }
      }
    }

    // Draw Bosses on minimap
    if (state.monsters) {
      for (const mob of state.monsters) {
        if (mob.isBoss) {
          const mx = centerMx + (mob.x - localPlayer.x) * scale;
          const my = centerMy + (mob.y - localPlayer.y) * scale;
          if (mx >= 0 && mx < w && my >= 0 && my < h) {
            mctx.fillStyle = '#e74c3c';
            mctx.beginPath();
            mctx.arc(mx, my, 5, 0, Math.PI * 2);
            mctx.fill();
          }
        }
      }
    }
  }
}

window.GameRenderer = GameRenderer;
