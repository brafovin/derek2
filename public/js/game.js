// Main Game Controller
window.game = null;

class Game {
  constructor() {
    this.state = 'intro'; // intro | menu | loading | playing | paused | gameover | win
    this.scene = null;
    this.camera = null;
    this.renderer = null;
    this.player = null;
    this.granny = null;
    this.network = null;
    this.clock = null;
    this.interactables = [];
    this.hidingSpots = [];
    this.itemMeshes = {};
    this.plankMeshes = {};
    this.players = {};
    this.roomId = null;
    this.startTime = null;
    this.grannyNearby = false;
    this._animId = null;
    this._paused = false;
    window.game = this;
  }

  init() {
    AudioManager.init();
    this._setupRenderer();
    this._setupScene();
    this.network = new NetworkManager(this);
    this.network.connect();
    this._setupUI();
    this._playIntro();
  }

  _setupRenderer() {
    const canvas = document.getElementById('game-canvas');
    this.renderer = new THREE.WebGLRenderer({ canvas, antialias: false });
    this.renderer.setSize(window.innerWidth, window.innerHeight);
    this.renderer.shadowMap.enabled = true;
    this.renderer.shadowMap.type = THREE.BasicShadowMap;
    this.renderer.setClearColor(0x050202);
    this.clock = new THREE.Clock();

    window.addEventListener('resize', () => {
      this.renderer.setSize(window.innerWidth, window.innerHeight);
      if (this.camera) {
        this.camera.aspect = window.innerWidth / window.innerHeight;
        this.camera.updateProjectionMatrix();
      }
    });
  }

  _setupScene() {
    this.scene = new THREE.Scene();
    this.scene.fog = new THREE.FogExp2(0x050202, 0.06);

    this.camera = new THREE.PerspectiveCamera(75, window.innerWidth / window.innerHeight, 0.05, 50);
    this.camera.position.set(0, 1.7, 0);
  }

  _setupUI() {
    // Main menu buttons
    document.getElementById('btn-solo').addEventListener('click', () => {
      AudioManager.resume();
      this._joinSolo();
    });

    document.getElementById('btn-create').addEventListener('click', () => {
      AudioManager.resume();
      const code = Math.random().toString(36).slice(2, 8).toUpperCase();
      document.getElementById('room-code-display').textContent = '🔑 CODE: ' + code;
      document.getElementById('create-room-info').style.display = 'flex';
      document.getElementById('room-input').style.display = 'none';
      document.getElementById('btn-start-created').dataset.roomId = code;
    });

    document.getElementById('btn-start-created').addEventListener('click', () => {
      const roomId = document.getElementById('btn-start-created').dataset.roomId;
      const name = document.getElementById('create-name-input').value.trim() || 'Spieler';
      this._joinRoom(roomId, name);
    });

    document.getElementById('btn-join').addEventListener('click', () => {
      AudioManager.resume();
      document.getElementById('room-input').style.display = 'flex';
      document.getElementById('create-room-info').style.display = 'none';
    });

    document.getElementById('btn-confirm-join').addEventListener('click', () => {
      const code = document.getElementById('room-code-input').value.trim().toUpperCase();
      const name = document.getElementById('player-name-input').value.trim() || 'Spieler';
      if (code.length > 0) this._joinRoom(code, name);
    });

    document.getElementById('btn-retry').addEventListener('click', () => {
      location.reload();
    });

    document.getElementById('btn-mainmenu').addEventListener('click', () => {
      location.reload();
    });

    document.getElementById('btn-win-menu').addEventListener('click', () => {
      location.reload();
    });

    document.getElementById('btn-resume').addEventListener('click', () => {
      this.togglePause();
    });

    document.getElementById('btn-pause-menu').addEventListener('click', () => {
      location.reload();
    });

    // Scanlines effect
    const scanlines = document.createElement('div');
    scanlines.className = 'scanlines';
    document.body.appendChild(scanlines);
  }

  _joinSolo() {
    const roomId = 'solo_' + Math.random().toString(36).slice(2, 8);
    this._joinRoom(roomId, 'Spieler');
  }

  _joinRoom(roomId, playerName) {
    this.roomId = roomId;
    this._showLoading();
    this.network.joinRoom(roomId, playerName);
  }

  _playIntro() {
    const screen = document.getElementById('intro-screen');
    const lines = ['line1', 'line2', 'line3', 'line4'];

    let delay = 500;
    lines.forEach((id, i) => {
      setTimeout(() => {
        document.getElementById(id).classList.add('visible');
        if (i < 3) AudioManager.tone(200 - i * 30, 0.5, 'sine', 0.1);
      }, delay);
      delay += 1800;
    });

    // JUMPSCARE at ~8s
    setTimeout(() => {
      AudioManager.resume();
      AudioManager.playJumpscare();
      const js = document.getElementById('jumpscare-container');
      js.style.opacity = '1';
      document.body.classList.add('screen-shake');

      setTimeout(() => {
        js.style.opacity = '0';
        document.body.classList.remove('screen-shake');
      }, 600);

      setTimeout(() => {
        screen.style.transition = 'opacity 1s';
        screen.style.opacity = '0';
        setTimeout(() => {
          screen.style.display = 'none';
          this._showMenu();
        }, 1000);
      }, 800);
    }, delay + 1000);
  }

  _showMenu() {
    document.getElementById('main-menu').style.display = 'flex';
    this.state = 'menu';
    AudioManager.playAmbient();
  }

  _showLoading() {
    document.getElementById('main-menu').style.display = 'none';
    document.getElementById('loading-screen').style.display = 'flex';

    const tips = [
      '💡 Tipp: Schleich dich leise - Granny hört alles!',
      '💡 Tipp: Versteck dich unter Betten und in Schränken',
      '💡 Tipp: Finde den Hammer um Holzplanken zu entfernen',
      '💡 Tipp: Schlüssel öffnen verschiedene Türen',
      '💡 Tipp: Crouchen (Shift) macht weniger Lärm',
      '💡 Tipp: Im Multiplayer - trennt euch auf!'
    ];
    document.getElementById('loading-tip').textContent = tips[Math.floor(Math.random() * tips.length)];

    let progress = 0;
    const interval = setInterval(() => {
      progress += Math.random() * 15;
      if (progress >= 100) {
        progress = 100;
        clearInterval(interval);
      }
      document.getElementById('loading-fill').style.width = progress + '%';
    }, 100);
  }

  onJoinedRoom(data) {
    const roomState = data.roomState;

    // Build the house
    const result = HouseBuilder.build(this.scene);
    this.interactables = result.interactables;
    this.hidingSpots = result.hidingSpots;

    // Place items from server state
    roomState.items.forEach(item => {
      if (!item.pickedUp) {
        const mesh = HouseBuilder.addItem(this.scene, item);
        this.itemMeshes[item.id] = mesh;
        this.interactables.push({
          id: item.id, x: item.x, y: item.y, z: item.z,
          type: 'item', itemType: item.type, mesh, radius: 1.5
        });
      }
    });

    // Setup player
    const spawnPoints = [
      { x: 2, z: 2 }, { x: -2, z: 2 }, { x: 2, z: -2 }, { x: -2, z: -2 }
    ];
    const idx = Object.keys(roomState.players).findIndex(id => id === data.playerId);
    const spawn = spawnPoints[Math.max(0, idx) % spawnPoints.length];

    this.player = new Player(this.camera, this.scene);
    this.player.pos.set(spawn.x, 1.7, spawn.z);

    // Add other existing players
    for (const pid in roomState.players) {
      if (pid !== data.playerId) {
        this.player.addOtherPlayer(pid, roomState.players[pid]);
      }
    }

    // Granny
    this.granny = new Granny(this.scene);
    this.granny.targetPos.set(roomState.grannyPos.x, 0, roomState.grannyPos.z);

    this.startTime = Date.now();
  }

  onPlayerJoined(data) {
    if (!this.player) return;
    this.player.addOtherPlayer(data.id, data);
    this.showMessage(`👤 ${data.name} ist beigetreten!`);
    this._updatePlayersList();
  }

  onPlayerLeft(id) {
    if (!this.player) return;
    this.player.removeOtherPlayer(id);
    this.showMessage(`👤 Spieler hat den Raum verlassen`);
    this._updatePlayersList();
  }

  startGame() {
    document.getElementById('loading-screen').style.display = 'none';
    document.getElementById('game-canvas').style.display = 'block';
    document.getElementById('game-hud').style.display = 'block';
    this.state = 'playing';
    this._updatePlayersList();

    // Start the render loop
    this._animate();

    // Request pointer lock
    setTimeout(() => {
      document.getElementById('game-canvas').requestPointerLock();
    }, 100);

    // Granny sound after delay
    setTimeout(() => {
      if (this.state === 'playing') {
        AudioManager.playGrannyLaugh();
        this.showMessage('👵 Granny ist wach... LAUF!', 4000, '#ff0000');
      }
    }, 5000);
  }

  _animate() {
    this._animId = requestAnimationFrame(() => this._animate());
    if (this.state !== 'playing') return;

    const dt = Math.min(this.clock.getDelta(), 0.1);
    const time = this.clock.getElapsedTime();

    // Update player
    this.player.update(dt);

    // Send position to server
    this.network.sendMove(
      this.player.pos.x, this.player.pos.y, this.player.pos.z,
      this.player.yaw
    );

    // Update granny
    if (this.granny) {
      this.granny.update(dt, time);
    }

    // Animate items (bob up/down)
    this._animateItems(time);

    // Update flicker lights
    HouseBuilder.updateFlicker(this.scene, time);

    // Update billboard name tags
    this.player.updateNameTagBillboard(this.camera);

    // Update timer
    this._updateTimer();

    // Render
    this.renderer.render(this.scene, this.camera);
  }

  _animateItems(time) {
    for (const id in this.itemMeshes) {
      const mesh = this.itemMeshes[id];
      if (!mesh || mesh.userData.pickedUp) continue;
      const bob = mesh.userData.bobOffset || 0;
      const baseY = mesh.userData.baseY || 0.5;
      mesh.position.y = baseY + Math.sin(time * 2 + bob) * 0.08;
      mesh.rotation.y = time * 1.5 + bob;
    }
  }

  _updateTimer() {
    if (!this.startTime) return;
    const elapsed = Math.floor((Date.now() - this.startTime) / 1000);
    const m = Math.floor(elapsed / 60).toString().padStart(2, '0');
    const s = (elapsed % 60).toString().padStart(2, '0');
    document.getElementById('timer-display').textContent = `⏱️ ${m}:${s} - Finde den Ausgang!`;
  }

  updateGrannyHUD(data) {
    if (!this.player) return;
    const dist = this.granny ? this.granny.getDistanceTo(this.player.pos.x, this.player.pos.z) : 99;
    const alert = document.getElementById('granny-alert');
    const wasNearby = this.grannyNearby;

    if (data.state === 'chase' && data.target === this.network.playerId) {
      alert.style.display = 'flex';
      this.grannyNearby = true;
      document.body.classList.add('danger-vignette');
      AudioManager.setChainsawVolume(1);
      if (!wasNearby) {
        AudioManager.playHeartbeat(true);
        document.body.classList.add('screen-shake');
        setTimeout(() => document.body.classList.remove('screen-shake'), 400);
      }
    } else if (dist < 8) {
      alert.style.display = 'flex';
      alert.style.background = 'rgba(80,0,0,0.9)';
      document.getElementById('alert-text').textContent = 'GRANNY IST IN DER NÄHE!';
      this.grannyNearby = true;
      document.body.classList.add('danger-vignette');
      AudioManager.setChainsawVolume(dist < 4 ? 0.8 : 0.3);
      if (!wasNearby) AudioManager.playHeartbeat(false);
    } else {
      alert.style.display = 'none';
      this.grannyNearby = false;
      document.body.classList.remove('danger-vignette');
      AudioManager.setChainsawVolume(0);
      if (wasNearby) AudioManager.stopHeartbeat();
    }
  }

  onItemPickedUp({ itemId, item }) {
    // Remove mesh from scene
    const mesh = this.itemMeshes[itemId];
    if (mesh) {
      mesh.userData.pickedUp = true;
      this.scene.remove(mesh);
      delete this.itemMeshes[itemId];
    }
    // Remove from interactables
    const idx = this.interactables.findIndex(i => i.id === itemId);
    if (idx >= 0) this.interactables.splice(idx, 1);

    // Add to player inventory
    this.player.addItem(item.type);

    const names = { hammer: '🔨 Hammer', key: '🗝️ Schlüssel', screwdriver: '🔧 Schraubenzieher', wirecutters: '✂️ Drahtschneider' };
    this.showMessage(`${names[item.type] || item.type} aufgehoben!`);

    // Noise for picking up
    this.network.makeNoise(this.player.pos.x, this.player.pos.z, 2);
  }

  onItemPickedUpByOther({ itemId }) {
    const mesh = this.itemMeshes[itemId];
    if (mesh) {
      mesh.userData.pickedUp = true;
      this.scene.remove(mesh);
      delete this.itemMeshes[itemId];
    }
    const idx = this.interactables.findIndex(i => i.id === itemId);
    if (idx >= 0) this.interactables.splice(idx, 1);
  }

  onPlankRemoved(doorId) {
    const plankId = 'plank_' + doorId;
    const plankData = this.interactables.find(i => i.id === plankId);
    if (plankData && plankData.mesh) {
      this.scene.remove(plankData.mesh);
    }
    const idx = this.interactables.findIndex(i => i.id === plankId);
    if (idx >= 0) this.interactables.splice(idx, 1);
    AudioManager.playHammerHit();
    this.showMessage('🪵 Holzplanken wurden entfernt!');
  }

  onDoorOpened(doorId) {
    AudioManager.playDoorCreak();
    this.showMessage('🚪 Tür geöffnet!');
  }

  onPlayerCaught({ id, name }) {
    if (id === this.network.playerId) {
      // Local player caught
      this.player.alive = false;
      AudioManager.playScream();
      document.body.classList.add('screen-shake');
      setTimeout(() => document.body.classList.remove('screen-shake'), 1000);
      this.showMessage('💀 Du wurdest erwischt!', 5000, '#ff0000');

      setTimeout(() => {
        document.exitPointerLock();
        this.onGameOver({ won: false, selfCaught: true });
      }, 2000);
    } else {
      this.showMessage(`💀 ${name} wurde von Granny erwischt!`, 5000, '#ff4400');
    }
  }

  onGameOver(data) {
    this.state = 'gameover';
    AudioManager.stopChainsaw();
    AudioManager.stopHeartbeat();
    document.exitPointerLock();

    if (data.won) {
      document.getElementById('win-screen').style.display = 'flex';
      const elapsed = Math.floor((Date.now() - this.startTime) / 1000);
      document.getElementById('win-stats').innerHTML =
        `Zeit: ${Math.floor(elapsed/60)}m ${elapsed%60}s<br>Alle Spieler entkommen!`;
      AudioManager.tone(440, 0.5, 'sine', 0.4);
      AudioManager.tone(550, 0.5, 'sine', 0.3);
      setTimeout(() => AudioManager.tone(660, 1, 'sine', 0.2), 300);
    } else {
      document.getElementById('gameover-screen').style.display = 'flex';
      if (data.selfCaught) {
        document.getElementById('gameover-subtitle').textContent = 'Grannys Kettensäge hat dich erwischt...';
      }
    }
  }

  tryEscape() {
    // Check if player has exit key
    if (!this.player.inventory.includes('key')) {
      this.showMessage('🔑 Du brauchst den roten Schlüssel!', 3000, '#ff4400');
      return;
    }
    this.player.escaped = true;
    this.network.playerEscaped();
    this.showMessage('🏃 Du bist entkommen!', 5000, '#00ff88');
    setTimeout(() => {
      this.onGameOver({ won: true });
    }, 2000);
  }

  togglePause() {
    if (this.state === 'playing') {
      this.state = 'paused';
      this._paused = true;
      document.getElementById('pause-menu').style.display = 'flex';
      document.exitPointerLock();
    } else if (this.state === 'paused') {
      this.state = 'playing';
      this._paused = false;
      document.getElementById('pause-menu').style.display = 'none';
      document.getElementById('game-canvas').requestPointerLock();
    }
  }

  showMessage(text, duration = 3000, color = '#dddddd') {
    const log = document.getElementById('message-log');
    const msg = document.createElement('div');
    msg.className = 'message';
    msg.style.borderLeftColor = color;
    msg.textContent = text;
    log.appendChild(msg);
    setTimeout(() => {
      msg.remove();
    }, duration);
  }

  _updatePlayersList() {
    const list = document.getElementById('players-list');
    list.innerHTML = '<div style="color:#666;font-size:0.75rem;margin-bottom:4px;">SPIELER</div>';
    // Local player
    const local = document.createElement('div');
    local.className = 'player-entry';
    local.innerHTML = `<div class="player-dot"></div><span>Du</span>`;
    list.appendChild(local);
    // Other players
    for (const id in this.player.otherPlayers) {
      const p = this.player.otherPlayers[id];
      const entry = document.createElement('div');
      entry.className = 'player-entry';
      entry.innerHTML = `<div class="player-dot"></div><span>${p.data.name || id.slice(0, 8)}</span>`;
      list.appendChild(entry);
    }
  }
}

// Extend HouseBuilder to support dynamic item adding
const _originalBuild = HouseBuilder.build;
HouseBuilder.addItem = function(scene, itemData) {
  const icons = {
    hammer: { color: 0x888888 },
    key: { color: itemData.color || 0xffcc00 },
    screwdriver: { color: 0x4444ff },
    wirecutters: { color: 0xff4444 }
  };

  const color = (icons[itemData.type] || { color: 0xffffff }).color;
  const geoMap = {
    hammer: () => {
      const g = new THREE.Group();
      g.add(Object.assign(new THREE.Mesh(new THREE.BoxGeometry(0.06,0.4,0.06), new THREE.MeshLambertMaterial({color:0x8b4a00})), { position: new THREE.Vector3(0,-0.1,0) }));
      const head = new THREE.Mesh(new THREE.BoxGeometry(0.22,0.12,0.1), new THREE.MeshLambertMaterial({color:0x888888}));
      head.position.y = 0.18;
      g.add(head);
      return g;
    },
    key: () => {
      const g = new THREE.Group();
      g.add(new THREE.Mesh(new THREE.TorusGeometry(0.08,0.02,8,16), new THREE.MeshLambertMaterial({color})));
      const t = new THREE.Mesh(new THREE.BoxGeometry(0.18,0.04,0.04), new THREE.MeshLambertMaterial({color}));
      t.position.set(0.09,-0.06,0);
      g.add(t);
      return g;
    },
    default: () => new THREE.Mesh(new THREE.BoxGeometry(0.12,0.3,0.08), new THREE.MeshLambertMaterial({color}))
  };

  const createFn = geoMap[itemData.type] || geoMap.default;
  const mesh = createFn();
  mesh.position.set(itemData.x, itemData.y, itemData.z);
  scene.add(mesh);
  mesh.userData.itemId = itemData.id;
  mesh.userData.itemType = itemData.type;
  mesh.userData.bobOffset = Math.random() * Math.PI * 2;
  mesh.userData.baseY = itemData.y;
  return mesh;
};

// Start
document.addEventListener('DOMContentLoaded', () => {
  const g = new Game();
  g.init();
});
