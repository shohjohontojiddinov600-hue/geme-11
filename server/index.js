// Main Application Server entry point for Mythic Realms
const http = require('node:http');
const path = require('node:path');
const fs = require('node:fs');
const { WebSocketServer } = require('ws');

const GameDB = require('./db');
const { WorldManager } = require('./world');
const { MonsterManager } = require('./monsters');
const GameEngine = require('./game');

const PORT = process.env.PORT || 3000;
const PUBLIC_DIR = path.join(__dirname, '..', 'public');

const db = new GameDB();
const world = new WorldManager(db, 9841235);
const monsters = new MonsterManager(world);
const game = new GameEngine(db, world, monsters);

const MIME_TYPES = {
  '.html': 'text/html; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.js': 'text/javascript; charset=utf-8',
  '.json': 'application/json',
  '.png': 'image/png',
  '.ico': 'image/x-icon'
};

const server = http.createServer((req, res) => {
  let reqPath = req.url.split('?')[0];
  if (reqPath === '/') reqPath = '/index.html';

  if (reqPath === '/api/leaderboard') {
    const top = db.getLeaderboard();
    res.writeHead(200, { 'Content-Type': 'application/json', 'Access-Control-Allow-Origin': '*' });
    res.end(JSON.stringify(top));
    return;
  }

  if (reqPath.startsWith('/api/chunk/')) {
    const parts = reqPath.replace('/api/chunk/', '').split('/');
    const cx = parseInt(parts[0], 10);
    const cy = parseInt(parts[1], 10);
    if (!isNaN(cx) && !isNaN(cy)) {
      const chunk = world.generateChunk(cx, cy);
      res.writeHead(200, { 'Content-Type': 'application/json', 'Access-Control-Allow-Origin': '*' });
      res.end(JSON.stringify(chunk));
      return;
    }
  }

  if (reqPath === '/health') {
    res.writeHead(200, { 'Content-Type': 'application/json' });
    res.end(JSON.stringify({ status: 'ok', players: game.players.size, time: game.worldTime }));
    return;
  }

  const safePath = path.normalize(path.join(PUBLIC_DIR, reqPath));
  if (!safePath.startsWith(PUBLIC_DIR)) {
    res.writeHead(403);
    res.end('Forbidden');
    return;
  }

  fs.readFile(safePath, (err, data) => {
    if (err) {
      res.writeHead(404, { 'Content-Type': 'text/plain' });
      res.end('404 Not Found');
      return;
    }
    const ext = path.extname(safePath).toLowerCase();
    res.writeHead(200, { 'Content-Type': MIME_TYPES[ext] || 'application/octet-stream' });
    res.end(data);
  });
});

const wss = new WebSocketServer({ server });

wss.on('connection', (ws) => {
  let boundPlayerId = null;

  ws.on('message', (data) => {
    try {
      const msg = JSON.parse(data.toString());

      if (msg.type === 'JOIN') {
        const username = (msg.username || 'Traveler').trim().slice(0, 16);
        const color = msg.color || '#3498db';
        const playerClass = msg.playerClass || 'warrior';
        const player = game.addPlayer(ws, username, color, playerClass);
        boundPlayerId = player.id;
      } else if (msg.type === 'REQUEST_CHUNK') {
        const chunk = world.generateChunk(msg.cx, msg.cy);
        ws.send(JSON.stringify({ type: 'CHUNK_DATA', chunk }));
      } else if (boundPlayerId) {
        game.handleAction(boundPlayerId, msg);
      }
    } catch (e) {
      console.error('Error handling WS message:', e);
    }
  });

  ws.on('close', () => {
    if (boundPlayerId) {
      game.removePlayer(boundPlayerId);
    }
  });

  ws.on('error', (err) => {
    console.error('WebSocket connection error:', err);
  });
});

function gracefulShutdown(signal) {
  console.log(`\n[Server] Received ${signal}. Flushing state and shutting down...`);
  try {
    game.stop();
    db.close();
    server.close(() => {
      console.log('[Server] Successfully saved state and closed safely.');
      process.exit(0);
    });
  } catch (err) {
    console.error('[Server] Error during graceful shutdown:', err);
    process.exit(1);
  }
}

process.on('SIGINT', () => gracefulShutdown('SIGINT'));
process.on('SIGTERM', () => gracefulShutdown('SIGTERM'));

server.listen(PORT, () => {
  console.log(`====================================================`);
  console.log(`⚔️  MYTHIC REALMS: MODERN MULTIPLAYER SANDBOX ⚔️`);
  console.log(`====================================================`);
  console.log(`Status: ONLINE & PERSISTENT (SQLite WAL Active)`);
  console.log(`URL: http://localhost:${PORT}`);
  console.log(`Tick Rate: 30 Hz | Classes: Warrior, Ranger, Builder`);
  console.log(`====================================================`);
});
