const express = require('express');
const http = require('http');
const { Server } = require('socket.io');
const path = require('path');

const app = express();
const server = http.createServer(app);
const io = new Server(server, {
  cors: { origin: '*' }
});

app.use(express.static(path.join(__dirname, 'public')));

const rooms = {};

function createRoom(roomId) {
  return {
    id: roomId,
    players: {},
    grannyPos: { x: 0, y: 0, z: 0 },
    grannyAngle: 0,
    grannyState: 'patrol',
    grannyTarget: null,
    items: getDefaultItems(),
    doors: getDefaultDoors(),
    noise: [],
    bearTraps: [],          // Bärenfallen die Granny dropt
    bearTrapCounter: 0,
    grannyTrapTimer: 0,     // wann sie die nächste falle dropt
    gameStarted: false,
    gameOver: false,
    escaped: false,
    startTime: null
  };
}

// Mögliche Verstecke für Items, quer durchs ganze Haus verteilt
const ITEM_SPAWNS = [
  { x: 12,   z: -5,  room: 'kitchen'  },
  { x: 4.5,  z: -9,  room: 'bathroom' },
  { x: -8,   z: 8,   room: 'basement' },
  { x: -12,  z: 11,  room: 'basement' },
  { x: 15,   z: -2,  room: 'attic'    },
  { x: 20,   z: -6,  room: 'attic'    },
  { x: -11,  z: -9,  room: 'bedroom'  },
  { x: -5,   z: -5,  room: 'bedroom'  },
  { x: 5,    z: 3,   room: 'garage'   },
  { x: 11,   z: 11,  room: 'garage'   },
  { x: -12,  z: -1,  room: 'living'   },
  { x: -6,   z: 4,   room: 'living'   },
  { x: 11,   z: 4,   room: 'kitchen'  },
  { x: 0,    z: 2,   room: 'hallway'  },
];

// Wählt n unterschiedliche, zufällige Spawn-Punkte
function pickRandomSpawns(n) {
  const pool = ITEM_SPAWNS.slice();
  const picked = [];
  for (let i = 0; i < n && pool.length; i++) {
    const idx = Math.floor(Math.random() * pool.length);
    picked.push(pool.splice(idx, 1)[0]);
  }
  return picked;
}

function getDefaultItems() {
  // Hammer, Ausgangsschlüssel und Kellerschlüssel jedes Spiel woanders
  const [hammerPos, exitKeyPos, basementKeyPos] = pickRandomSpawns(3);
  return [
    { id: 'hammer',       type: 'hammer',                    x: hammerPos.x,     z: hammerPos.z,     y: 0.5, pickedUp: false, room: hammerPos.room },
    { id: 'key_exit',     type: 'key', color: 0xff0000,      x: exitKeyPos.x,    z: exitKeyPos.z,    y: 0.5, pickedUp: false, room: exitKeyPos.room },
    { id: 'key_basement', type: 'key', color: 0xffaa00,      x: basementKeyPos.x, z: basementKeyPos.z, y: 0.5, pickedUp: false, room: basementKeyPos.room },
    { id: 'screwdriver',  type: 'screwdriver',               x: -3, z: -12, y: 0.5, pickedUp: false, room: 'basement' },
    { id: 'wirecutters',  type: 'wirecutters',               x: 5,  z: 3,   y: 0.5, pickedUp: false, room: 'garage' },
    { id: 'padlock_key',  type: 'key', color: 0x00aaff,      x: -14, z: -2, y: 1.5, pickedUp: false, room: 'bathroom' }
  ];
}

function getDefaultDoors() {
  return {
    basement: { open: false, locked: true, lockType: 'key', keyId: 'key_basement', hasPlank: false },
    exit: { open: false, locked: true, lockType: 'key', keyId: 'key_exit', hasPlank: false },
    attic: { open: false, locked: false, hasPlank: true, plankRemoved: false },
    garage: { open: false, locked: true, lockType: 'padlock', keyId: 'padlock_key', hasPlank: false },
    shed: { open: false, locked: false, hasPlank: true, plankRemoved: false }
  };
}

io.on('connection', (socket) => {
  console.log('Player connected:', socket.id);

  socket.on('joinRoom', ({ roomId, playerName }) => {
    if (!rooms[roomId]) {
      rooms[roomId] = createRoom(roomId);
    }
    const room = rooms[roomId];
    if (Object.keys(room.players).length >= 4) {
      socket.emit('roomFull');
      return;
    }

    const spawnPoints = [
      { x: 2, z: 2 }, { x: -2, z: 2 }, { x: 2, z: -2 }, { x: -2, z: -2 }
    ];
    const idx = Object.keys(room.players).length;
    const spawn = spawnPoints[idx % spawnPoints.length];

    room.players[socket.id] = {
      id: socket.id,
      name: playerName || `Spieler ${idx + 1}`,
      x: spawn.x, y: 0, z: spawn.z,
      rotY: 0,
      health: 100,
      inventory: [],
      hidden: false,
      hidingSpot: null,
      caught: false,
      escaped: false,
      alive: true
    };

    socket.join(roomId);
    socket.roomId = roomId;
    socket.emit('joinedRoom', {
      playerId: socket.id,
      roomState: room,
      playerCount: Object.keys(room.players).length
    });
    socket.to(roomId).emit('playerJoined', room.players[socket.id]);

    if (Object.keys(room.players).length >= 1 && !room.gameStarted) {
      setTimeout(() => {
        if (rooms[roomId] && !rooms[roomId].gameStarted) {
          rooms[roomId].gameStarted = true;
          rooms[roomId].startTime = Date.now();
          io.to(roomId).emit('gameStart');
        }
      }, 3000);
    }
  });

  socket.on('playerMove', (data) => {
    const room = rooms[socket.roomId];
    if (!room || !room.players[socket.id]) return;
    const p = room.players[socket.id];
    p.x = data.x;
    p.y = data.y;
    p.z = data.z;
    p.rotY = data.rotY;
    socket.to(socket.roomId).emit('playerMoved', { id: socket.id, x: p.x, y: p.y, z: p.z, rotY: p.rotY });
  });

  socket.on('makeNoise', (data) => {
    const room = rooms[socket.roomId];
    if (!room) return;
    room.noise.push({ x: data.x, z: data.z, volume: data.volume, time: Date.now() });
  });

  socket.on('pickupItem', ({ itemId }) => {
    const room = rooms[socket.roomId];
    if (!room) return;
    const item = room.items.find(i => i.id === itemId && !i.pickedUp);
    if (!item) return;
    item.pickedUp = true;
    room.players[socket.id].inventory.push(item.type);
    socket.emit('itemPickedUp', { itemId, item });
    socket.to(socket.roomId).emit('itemPickedUpByOther', { itemId, playerId: socket.id });
  });

  socket.on('useItem', ({ itemId, targetId }) => {
    const room = rooms[socket.roomId];
    if (!room) return;
    const player = room.players[socket.id];
    if (!player) return;

    if (targetId.startsWith('door_') && itemId === 'hammer') {
      const doorKey = targetId.replace('door_', '');
      if (room.doors[doorKey] && room.doors[doorKey].hasPlank && !room.doors[doorKey].plankRemoved) {
        room.doors[doorKey].plankRemoved = true;
        io.to(socket.roomId).emit('plankRemoved', { door: doorKey });
        room.noise.push({ x: player.x, z: player.z, volume: 8, time: Date.now() });
      }
    }

    if (targetId.startsWith('door_') && itemId === 'key') {
      const doorKey = targetId.replace('door_', '');
      const door = room.doors[doorKey];
      if (door && door.locked && door.keyId) {
        const keyItem = room.items.find(i => i.id === door.keyId && i.pickedUp && player.inventory.includes(i.type));
        if (keyItem || player.inventory.includes('key')) {
          door.locked = false;
          door.open = true;
          io.to(socket.roomId).emit('doorOpened', { door: doorKey });
        }
      }
    }

    // Open any unlocked, non-planked door with E (regardless of held item)
    if (targetId.startsWith('door_')) {
      const doorKey = targetId.replace('door_', '');
      const door = room.doors[doorKey];
      const canOpen = !door                                           // not tracked = freely openable
        || (!door.locked && !door.open && !(door.hasPlank && !door.plankRemoved));
      if (canOpen) {
        if (door) door.open = true;
        else room.doors[doorKey] = { open: true, locked: false, hasPlank: false };
        io.to(socket.roomId).emit('doorOpened', { door: doorKey });
        room.noise.push({ x: player.x, z: player.z, volume: 5, time: Date.now() });
      }
    }
  });

  socket.on('hide', ({ spotId, hiding }) => {
    const room = rooms[socket.roomId];
    if (!room || !room.players[socket.id]) return;
    room.players[socket.id].hidden = hiding;
    room.players[socket.id].hidingSpot = hiding ? spotId : null;
    socket.to(socket.roomId).emit('playerHiding', { id: socket.id, hiding, spotId });
  });

  socket.on('playerEscaped', () => {
    const room = rooms[socket.roomId];
    if (!room || !room.players[socket.id]) return;
    room.players[socket.id].escaped = true;
    io.to(socket.roomId).emit('playerEscaped', { id: socket.id, name: room.players[socket.id].name });
    const allEscaped = Object.values(room.players).every(p => p.escaped || p.caught);
    if (allEscaped) {
      room.gameOver = true;
      room.escaped = true;
      io.to(socket.roomId).emit('gameOver', { won: true });
    }
  });

  socket.on('disconnect', () => {
    const room = rooms[socket.roomId];
    if (room) {
      delete room.players[socket.id];
      io.to(socket.roomId).emit('playerLeft', socket.id);
      if (Object.keys(room.players).length === 0) {
        delete rooms[socket.roomId];
      }
    }
    console.log('Player disconnected:', socket.id);
  });
});

// Granny AI loop - server-side authority
setInterval(() => {
  for (const roomId in rooms) {
    const room = rooms[roomId];
    if (!room.gameStarted || room.gameOver) continue;

    updateGrannyAI(room, roomId);
  }
}, 100);

function updateGrannyAI(room, roomId) {
  const granny = { x: room.grannyPos.x, z: room.grannyPos.z, angle: room.grannyAngle };
  const players = Object.values(room.players).filter(p => p.alive && !p.caught && !p.escaped);

  // Decay noise
  room.noise = room.noise.filter(n => Date.now() - n.time < 5000);

  let targetPlayer = null;
  let minDist = Infinity;

  for (const p of players) {
    if (p.hidden) continue;
    const dx = p.x - granny.x;
    const dz = p.z - granny.z;
    const dist = Math.sqrt(dx * dx + dz * dz);

    // Vision cone (60 degrees, 8 units)
    const angleToPlayer = Math.atan2(dx, dz);
    const angleDiff = Math.abs(normalizeAngle(angleToPlayer - granny.angle));
    const inVision = angleDiff < 0.52 && dist < 8;

    // Hearing
    const heard = room.noise.some(n => {
      const nd = Math.sqrt((n.x - granny.x) ** 2 + (n.z - granny.z) ** 2);
      return nd < n.volume;
    });

    // 1 Treffer = K.O. → neuer Tag beginnt
    if (dist < 1.5 && !p.hidden && !p.knockedOut) {
      const now = Date.now();
      if (!p.lastHitTime || now - p.lastHitTime > 2000) {
        p.lastHitTime = now;
        p.knockedOut = true;
        p.day = (p.day || 1) + 1;
        p.health = 100; // Vollheilung nach K.O.

        if (p.day > 5) {
          // Nach Tag 5 ist es Game Over
          p.caught = true;
          io.to(roomId).emit('playerCaught', { id: p.id, name: p.name });
          const allDone = Object.values(room.players).every(pl => pl.escaped || pl.caught);
          if (allDone) {
            room.gameOver = true;
            io.to(roomId).emit('gameOver', { won: false });
          }
        } else {
          io.to(roomId).emit('playerKnockedOut', { id: p.id, day: p.day });
          // Nach 4 Sekunden aufwachen (Spieler spawnt neu)
          setTimeout(() => {
            if (room.players[p.id]) {
              room.players[p.id].knockedOut = false;
              // Granny geht zurück zu Startposition nach K.O.
              room.grannyPos = { x: 5, y: 0, z: 5 };
              io.to(roomId).emit('playerWokeUp', { id: p.id, day: p.day, health: 100 });
            }
          }, 4000);
        }
      }
      continue;
    }

    if ((inVision || heard || dist < 2) && dist < minDist) {
      minDist = dist;
      targetPlayer = p;
    }
  }

  // Noise-based investigation
  if (!targetPlayer && room.noise.length > 0) {
    const loudest = room.noise.reduce((a, b) => a.volume > b.volume ? a : b);
    const dx = loudest.x - granny.x;
    const dz = loudest.z - granny.z;
    const dist = Math.sqrt(dx * dx + dz * dz);
    if (dist > 0.5) {
      const speed = 0.04;
      room.grannyPos.x += (dx / dist) * speed;
      room.grannyPos.z += (dz / dist) * speed;
      room.grannyAngle = Math.atan2(dx, dz);
      room.grannyState = 'investigate';
    }
  } else if (targetPlayer) {
    room.grannyState = 'chase';
    room.grannyTarget = targetPlayer.id;
    const dx = targetPlayer.x - granny.x;
    const dz = targetPlayer.z - granny.z;
    const dist = Math.sqrt(dx * dx + dz * dz);
    if (dist > 0.5) {
      // Granny wird pro Tag schneller
      const maxDay = Math.max(...Object.values(room.players).map(p => p.day || 1));
      const speed = 0.055 + (maxDay - 1) * 0.015;
      room.grannyPos.x += (dx / dist) * speed;
      room.grannyPos.z += (dz / dist) * speed;
      room.grannyAngle = Math.atan2(dx, dz);
    }
  } else {
    room.grannyState = 'patrol';
    room.grannyTarget = null;
    // Random patrol
    if (Math.random() < 0.02) {
      room.grannyAngle += (Math.random() - 0.5) * 0.5;
    }
    const maxDay2 = Math.max(...Object.values(room.players).map(p => p.day || 1));
    const patrolSpeed = 0.018 + (maxDay2 - 1) * 0.006;
    room.grannyPos.x += Math.sin(room.grannyAngle) * patrolSpeed;
    room.grannyPos.z += Math.cos(room.grannyAngle) * patrolSpeed;

    // Keep granny in bounds
    room.grannyPos.x = Math.max(-18, Math.min(18, room.grannyPos.x));
    room.grannyPos.z = Math.max(-18, Math.min(18, room.grannyPos.z));
  }

  // ── Bärenfallen droppen ──
  room.grannyTrapTimer = (room.grannyTrapTimer || 0) + 100; // +100ms pro tick
  const maxDay3 = Math.max(...Object.values(room.players).map(p => p.day || 1));
  // Alle 12s in Tag 1, alle 8s in Tag 2, alle 5s ab Tag 3
  const trapInterval = Math.max(5000, 12000 - (maxDay3 - 1) * 2000);
  if (room.grannyTrapTimer >= trapInterval && room.bearTraps.length < 12) {
    room.grannyTrapTimer = 0;
    const trapId = 'trap_' + (++room.bearTrapCounter);
    const trap = {
      id: trapId,
      x: room.grannyPos.x + (Math.random() - 0.5) * 2,
      z: room.grannyPos.z + (Math.random() - 0.5) * 2,
      armed: true,
      droppedAt: Date.now()
    };
    room.bearTraps.push(trap);
    io.to(roomId).emit('bearTrapDropped', trap);
  }

  // ── Bärenfallen prüfen ob Spieler drauftritt ──
  for (const p of players) {
    if (p.hidden || p.knockedOut) continue;
    for (const trap of room.bearTraps) {
      if (!trap.armed) continue;
      const tdx = p.x - trap.x, tdz = p.z - trap.z;
      if (Math.sqrt(tdx*tdx + tdz*tdz) < 0.45) {
        trap.armed = false;
        io.to(roomId).emit('bearTrapTriggered', { trapId: trap.id, playerId: p.id });
        // K.O. durch Falle
        const now2 = Date.now();
        if (!p.lastHitTime || now2 - p.lastHitTime > 2000) {
          p.lastHitTime = now2;
          p.knockedOut = true;
          p.day = (p.day || 1) + 1;
          p.health = 100;
          if (p.day > 5) {
            p.caught = true;
            io.to(roomId).emit('playerCaught', { id: p.id, name: p.name });
          } else {
            io.to(roomId).emit('playerKnockedOut', { id: p.id, day: p.day, cause: 'trap' });
            setTimeout(() => {
              if (room.players[p.id]) {
                room.players[p.id].knockedOut = false;
                room.grannyPos = { x: 5, y: 0, z: 5 };
                io.to(roomId).emit('playerWokeUp', { id: p.id, day: p.day, health: 100 });
              }
            }, 4000);
          }
        }
      }
    }
  }

  io.to(roomId).emit('grannyUpdate', {
    x: room.grannyPos.x,
    y: room.grannyPos.y,
    z: room.grannyPos.z,
    angle: room.grannyAngle,
    state: room.grannyState,
    target: room.grannyTarget
  });
}

function normalizeAngle(a) {
  while (a > Math.PI) a -= 2 * Math.PI;
  while (a < -Math.PI) a += 2 * Math.PI;
  return a;
}

const PORT = process.env.PORT || 3000;
server.listen(PORT, () => {
  console.log(`Granny Horror Game Server läuft auf Port ${PORT}`);
});
