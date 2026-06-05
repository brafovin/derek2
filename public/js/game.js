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
    this._pickedItems = new Set(); // verhindert doppeltes Aufheben (lokal + Server-Echo)
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
    this.renderer = new THREE.WebGLRenderer({
      canvas,
      antialias: false,
      powerPreference: 'high-performance'
    });
    this.renderer.setSize(window.innerWidth, window.innerHeight);
    // Pixel-Ratio begrenzen → weniger Pixel, mehr FPS (Ziel: 120fps)
    this.renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 1.5));
    this.renderer.shadowMap.enabled = true;
    this.renderer.shadowMap.type = THREE.PCFShadowMap; // günstiger als PCFSoft
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

  _buildFallbackScene() {
    // Einfaches sichtbares Zimmer als Notfall
    const m = new THREE.MeshBasicMaterial({ color: 0x553322, side: THREE.DoubleSide });
    const floor = new THREE.Mesh(new THREE.PlaneGeometry(20, 20), new THREE.MeshBasicMaterial({ color: 0x332211, side: THREE.DoubleSide }));
    floor.rotation.x = -Math.PI / 2;
    this.scene.add(floor);
    [[-10,2,0],[10,2,0],[0,2,-10],[0,2,10]].forEach(([x,y,z]) => {
      const wall = new THREE.Mesh(new THREE.PlaneGeometry(20, 4), m);
      wall.position.set(x, y, z);
      if (x !== 0) wall.rotation.y = Math.PI / 2;
      this.scene.add(wall);
    });
    this.scene.add(new THREE.AmbientLight(0xffffff, 1));
  }

  _setupScene() {
    this.scene = new THREE.Scene();
    this.scene.background = new THREE.Color(0x0a0604);
    // Weniger dichten Nebel - man soll das Haus sehen können
    this.scene.fog = new THREE.Fog(0x0a0604, 12, 35);

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
      // Teilbaren Einladungs-Link erzeugen
      const link = location.origin + location.pathname + '?room=' + code;
      document.getElementById('invite-link-input').value = link;
    });

    document.getElementById('btn-copy-link').addEventListener('click', async () => {
      const link = document.getElementById('invite-link-input').value;
      const btn = document.getElementById('btn-copy-link');
      try {
        await navigator.clipboard.writeText(link);
      } catch (e) {
        // Fallback: Text markieren und kopieren
        const inp = document.getElementById('invite-link-input');
        inp.focus(); inp.select();
        try { document.execCommand('copy'); } catch (e2) {}
      }
      btn.textContent = '✅ KOPIERT!';
      AudioManager.playPickup();
      setTimeout(() => { btn.textContent = '🔗 LINK KOPIEREN'; }, 1800);
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

    // Spiel-Link über dem Titel anzeigen (Adresse, über die man reinkommt)
    const gameLink = location.origin + location.pathname;
    const urlEl = document.getElementById('game-link-url');
    if (urlEl) urlEl.textContent = gameLink;
    const copyBtn = document.getElementById('btn-copy-game-link');
    if (copyBtn && !copyBtn.dataset.bound) {
      copyBtn.dataset.bound = '1';
      copyBtn.addEventListener('click', async () => {
        try {
          await navigator.clipboard.writeText(gameLink);
        } catch (e) {
          const r = document.createRange();
          r.selectNode(document.getElementById('game-link-url'));
          window.getSelection().removeAllRanges();
          window.getSelection().addRange(r);
          try { document.execCommand('copy'); } catch (e2) {}
        }
        copyBtn.textContent = '✅ KOPIERT!';
        AudioManager.playPickup();
        setTimeout(() => { copyBtn.textContent = 'KOPIEREN'; }, 1800);
      });
    }

    // Wenn die URL einen Raum-Code enthält (?room=CODE), Beitritts-Feld
    // vorbereiten und Code automatisch eintragen
    const params = new URLSearchParams(location.search);
    const room = (params.get('room') || '').trim().toUpperCase();
    if (room) {
      document.getElementById('room-input').style.display = 'flex';
      document.getElementById('create-room-info').style.display = 'none';
      document.getElementById('room-code-input').value = room;
      document.getElementById('player-name-input').focus();
      this.showMessage('🔗 Einladung erkannt – gib deinen Namen ein und tritt bei!', 4000, '#aa66ff');
    }
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

    // Fehler-Handler für Build
    window.onerror = (msg, src, line) => {
      document.getElementById('timer-display').textContent = `JS FEHLER: ${msg} Zeile ${line}`;
    };

    // Garantiert-sichtbarer Test-Würfel direkt vor Kamera (für Debug)
    const testMat = new THREE.MeshBasicMaterial({ color: 0xff0000, wireframe: true });
    const testCube = new THREE.Mesh(new THREE.BoxGeometry(1, 1, 1), testMat);
    testCube.position.set(0, 1.5, -2);
    testCube.userData.isTestCube = true;
    this.scene.add(testCube);
    this._testCube = testCube;

    // Build the house mit Fehlerbehandlung
    let result;
    try {
      result = HouseBuilder.build(this.scene);
      // Test-Würfel entfernen wenn Haus erfolgreich geladen
      setTimeout(() => {
        if (this._testCube) {
          this.scene.remove(this._testCube);
          this._testCube = null;
        }
      }, 3000);
    } catch(e) {
      console.error('House Build FEHLER:', e);
      document.getElementById('timer-display').textContent = `BUILD FEHLER: ${e.message}`;
      // Notfall-Szene: leuchtende Wände
      this._buildFallbackScene();
      result = { interactables: [], hidingSpots: [] };
    }
    this.interactables = result.interactables;
    this.hidingSpots = result.hidingSpots;
    this.walls = result.collisionWalls || [];

    // Place items from server state
    roomState.items.forEach(item => {
      if (!item.pickedUp) {
        try {
          const mesh = HouseBuilder.addItem(this.scene, item);
          this.itemMeshes[item.id] = mesh;
          this.interactables.push({
            id: item.id, x: item.x, y: item.y, z: item.z,
            type: 'item', itemType: item.type, mesh, radius: 1.9
          });
        } catch(e) { console.warn('Item Fehler:', e); }
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

    // Klick-Hinweis anzeigen
    const clickHint = document.createElement('div');
    clickHint.id = 'click-hint';
    clickHint.style.cssText = `
      position:fixed; top:50%; left:50%; transform:translate(-50%,-50%);
      background:rgba(0,0,0,0.85); border:2px solid #cc0000;
      color:#fff; font-family:'Courier New',monospace;
      padding:20px 40px; font-size:1.3rem; z-index:200;
      text-align:center; pointer-events:none;
    `;
    clickHint.innerHTML = '🖱️ KLICK zum Spielen<br><span style="font-size:0.85rem;color:#888">WASD = Bewegen &nbsp;|&nbsp; Maus = Umsehen<br>E = Aufheben &nbsp;|&nbsp; H = Verstecken &nbsp;|&nbsp; Shift = Schleichen</span>';
    document.body.appendChild(clickHint);

    // Atmosphäre: leise Spieluhr + zufällige Schreckgeräusche
    AudioManager.startRandomAmbience();
    AudioManager.playMusicBox();

    // Start the render loop - SOFORT
    this._animate();

    // Mauslock beim ersten Klick
    const lockHandler = () => {
      document.getElementById('game-canvas').requestPointerLock();
      const hint = document.getElementById('click-hint');
      if (hint) hint.remove();
    };
    document.addEventListener('click', lockHandler, { once: true });

    // Auch direkt versuchen
    setTimeout(() => {
      document.getElementById('game-canvas').requestPointerLock();
    }, 200);

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
    // Update door animations
    HouseBuilder.updateDoors(dt);

    // Update billboard name tags
    this.player.updateNameTagBillboard(this.camera);

    // Langsame Heilung wenn Granny weit weg (alle 15s +10hp)
    if (this.player.alive && this.player.health > 0 && this.player.health < 100 && !this.grannyNearby) {
      this._passiveHealTimer = (this._passiveHealTimer || 0) + dt;
      if (this._passiveHealTimer >= 15) {
        this._passiveHealTimer = 0;
        const healed = Math.min(100, this.player.health + 10);
        this.player.setHealth(healed);
        if (healed > this.player.health + 1) {
          this.showMessage('❤️ Du erholst dich... +10 HP', 2000, '#00cc44');
        }
      }
    } else {
      this._passiveHealTimer = 0;
    }

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
      // Pulsierendes Glühen, damit man Items leichter findet
      const pulse = 0.6 + Math.sin(time * 3 + bob) * 0.35;
      if (mesh.userData.glow) mesh.userData.glow.intensity = pulse;
      if (mesh.userData.halo) mesh.userData.halo.material.opacity = 0.1 + pulse * 0.08;
    }
  }

  _updateTimer() {
    if (!this.startTime) return;
    const elapsed = Math.floor((Date.now() - this.startTime) / 1000);
    const m = Math.floor(elapsed / 60).toString().padStart(2, '0');
    const s = (elapsed % 60).toString().padStart(2, '0');
    const day = this.currentDay || 1;
    const dayColor = day >= 4 ? '#ff4400' : day >= 3 ? '#ffaa00' : '#aaaaaa';
    document.getElementById('timer-display').innerHTML =
      `<span style="color:${dayColor}">TAG ${day}/5</span> &nbsp;⏱️ ${m}:${s}`;
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
        // Granny hat dich entdeckt → harter Schreck-Sting + Spieluhr stoppt
        AudioManager.playStinger();
        AudioManager.stopMusicBox();
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
      if (!wasNearby) {
        AudioManager.playStinger();
        AudioManager.playHeartbeat(false);
      }
    } else {
      alert.style.display = 'none';
      this.grannyNearby = false;
      document.body.classList.remove('danger-vignette');
      AudioManager.setChainsawVolume(0);
      if (wasNearby) {
        AudioManager.stopHeartbeat();
        AudioManager.playMusicBox(); // Spieluhr kehrt zurück, wenn Gefahr vorbei
      }
    }
  }

  onPlayerDamaged(newHealth) {
    // Wird nicht mehr benutzt (1-Hit K.O. System)
  }

  spawnBearTrap(data) {
    const trapGroup = new THREE.Group();

    // Basis (flache Platte)
    const baseMat = new THREE.MeshLambertMaterial({ color: 0x1a1a1a });
    const base = new THREE.Mesh(new THREE.BoxGeometry(0.5, 0.04, 0.5), baseMat);
    trapGroup.add(base);

    // Zwei Kiefer (Zähne)
    const jawMat = new THREE.MeshLambertMaterial({ color: 0x444444 });
    const toothMat = new THREE.MeshLambertMaterial({ color: 0x888888 });

    const jawL = new THREE.Group();
    const jawLBody = new THREE.Mesh(new THREE.BoxGeometry(0.5, 0.06, 0.14), jawMat);
    jawL.add(jawLBody);
    // Zähne oben links
    for (let i = 0; i < 4; i++) {
      const tooth = new THREE.Mesh(new THREE.BoxGeometry(0.04, 0.1, 0.04), toothMat);
      tooth.position.set(-0.18 + i * 0.12, 0.08, 0);
      jawL.add(tooth);
    }
    jawL.position.set(0, 0.05, -0.14);
    jawL.rotation.x = -0.3; // leicht offen
    trapGroup.add(jawL);

    const jawR = jawL.clone();
    jawR.position.set(0, 0.05, 0.14);
    jawR.rotation.x = 0.3;
    trapGroup.add(jawR);

    // Feder in der Mitte
    const springMat = new THREE.MeshLambertMaterial({ color: 0x333333 });
    const spring = new THREE.Mesh(new THREE.TorusGeometry(0.08, 0.015, 6, 12), springMat);
    spring.rotation.x = Math.PI / 2;
    spring.position.y = 0.04;
    trapGroup.add(spring);

    // Blut-Fleck unter der Falle
    const bloodGeo = new THREE.CylinderGeometry(0.3, 0.25, 0.01, 10);
    const bloodMesh = new THREE.Mesh(bloodGeo,
      new THREE.MeshLambertMaterial({ color: 0x440000, transparent: true, opacity: 0.7 }));
    bloodMesh.position.y = -0.01;
    trapGroup.add(bloodMesh);

    trapGroup.position.set(data.x, 0.02, data.z);
    trapGroup.rotation.y = Math.random() * Math.PI;
    trapGroup.userData.trapId = data.id;
    trapGroup.userData.armed = true;
    this.scene.add(trapGroup);

    if (!this.bearTrapMeshes) this.bearTrapMeshes = {};
    this.bearTrapMeshes[data.id] = trapGroup;

    // Kurzes Metall-Geräusch (Falle auslegen)
    AudioManager.tone(300, 0.15, 'square', 0.15);
    AudioManager.tone(200, 0.1, 'square', 0.1);
  }

  triggerBearTrap(trapId, isLocalPlayer) {
    const mesh = this.bearTrapMeshes && this.bearTrapMeshes[trapId];
    if (mesh) {
      mesh.userData.armed = false;
      // Kiefer zuklappen Animation
      mesh.traverse(obj => {
        if (obj.isGroup && obj !== mesh) {
          obj.rotation.x = 0;
        }
      });
      // Blut erscheint
      const bloodMat = new THREE.MeshLambertMaterial({ color: 0x660000 });
      const blood = new THREE.Mesh(new THREE.CylinderGeometry(0.4, 0.3, 0.015, 10), bloodMat);
      blood.position.copy(mesh.position);
      blood.position.y = 0.008;
      this.scene.add(blood);
    }

    if (isLocalPlayer) {
      // Metallisches SNAP + Schrei
      AudioManager.tone(800, 0.05, 'square', 0.8);
      AudioManager.tone(400, 0.1, 'square', 0.5);
      AudioManager.playScream();
      document.body.classList.add('screen-shake');
      setTimeout(() => document.body.classList.remove('screen-shake'), 500);
      this.showMessage('🪤 BÄRENFALLE! K.O.!', 3000, '#ff2200');
    } else {
      AudioManager.tone(600, 0.05, 'square', 0.3);
    }
  }

  _showJumpscare() {
    // Vollbild-Schreckmoment: Grannys Fratze + Pumpgun-Schuss
    AudioManager.resume();
    AudioManager.playShotgun();
    AudioManager.playJumpscare();

    const overlay = document.createElement('div');
    overlay.id = 'jumpscare-overlay';
    overlay.style.cssText = `
      position:fixed; inset:0; z-index:10000; pointer-events:none;
      background:#000; display:flex; align-items:center; justify-content:center;
      overflow:hidden;`;

    const canvas = document.createElement('canvas');
    canvas.width = 512; canvas.height = 512;
    const c = canvas.getContext('2d');

    // Hintergrund Blutrot
    c.fillStyle = '#1a0000'; c.fillRect(0, 0, 512, 512);
    const bg = c.createRadialGradient(256, 256, 40, 256, 256, 360);
    bg.addColorStop(0, '#4a0000'); bg.addColorStop(1, '#000000');
    c.fillStyle = bg; c.fillRect(0, 0, 512, 512);

    // Gesicht (fahle Haut)
    c.fillStyle = '#b89878';
    c.beginPath(); c.ellipse(256, 270, 150, 185, 0, 0, Math.PI * 2); c.fill();
    // Schatten/Falten
    c.strokeStyle = 'rgba(60,30,20,0.5)'; c.lineWidth = 3;
    for (let i = 0; i < 6; i++) {
      c.beginPath();
      c.moveTo(160 + i * 30, 200);
      c.quadraticCurveTo(170 + i * 30, 260, 150 + i * 30, 330);
      c.stroke();
    }
    // Wirres weißes Haar
    c.strokeStyle = '#e8e8e8'; c.lineWidth = 4;
    for (let i = 0; i < 60; i++) {
      const a = Math.random() * Math.PI * 2;
      const r1 = 120 + Math.random() * 30;
      const r2 = 160 + Math.random() * 90;
      c.beginPath();
      c.moveTo(256 + Math.cos(a) * r1, 200 + Math.sin(a) * r1 * 0.9);
      c.lineTo(256 + Math.cos(a) * r2, 180 + Math.sin(a) * r2 * 0.9);
      c.stroke();
    }
    // Augenhöhlen (dunkel)
    c.fillStyle = '#1a0a08';
    c.beginPath(); c.ellipse(195, 250, 42, 38, 0, 0, Math.PI * 2); c.fill();
    c.beginPath(); c.ellipse(317, 250, 42, 38, 0, 0, Math.PI * 2); c.fill();
    // Glühende rote Augen
    [195, 317].forEach(ex => {
      const eg = c.createRadialGradient(ex, 250, 2, ex, 250, 28);
      eg.addColorStop(0, '#ffffff'); eg.addColorStop(0.3, '#ff2200'); eg.addColorStop(1, '#330000');
      c.fillStyle = eg;
      c.beginPath(); c.arc(ex, 250, 26, 0, Math.PI * 2); c.fill();
      c.fillStyle = '#000';
      c.beginPath(); c.arc(ex, 250, 9, 0, Math.PI * 2); c.fill();
    });
    // Nase
    c.strokeStyle = '#7a5a40'; c.lineWidth = 4;
    c.beginPath(); c.moveTo(256, 270); c.lineTo(240, 330); c.lineTo(272, 330); c.stroke();
    // Schreiender Mund mit Zähnen
    c.fillStyle = '#1a0000';
    c.beginPath(); c.ellipse(256, 400, 70, 55, 0, 0, Math.PI * 2); c.fill();
    c.fillStyle = '#d8c8a0';
    for (let i = 0; i < 7; i++) {
      c.fillRect(200 + i * 16, 360, 11, 22);   // obere Zähne
      c.fillRect(200 + i * 16, 418, 11, 22);   // untere Zähne
    }
    // Blutspritzer übers Gesicht
    c.fillStyle = 'rgba(150,0,0,0.85)';
    for (let i = 0; i < 30; i++) {
      c.beginPath();
      c.arc(Math.random() * 512, Math.random() * 512, 2 + Math.random() * 9, 0, Math.PI * 2);
      c.fill();
    }
    // Pumpgun quer übers Bild (auf den Spieler gerichtet)
    c.save();
    c.translate(360, 440); c.rotate(-0.5);
    c.fillStyle = '#222428';                       // Lauf
    c.fillRect(-30, -16, 200, 22);
    c.fillStyle = '#1a1c20';                        // Magazinröhre
    c.fillRect(-30, 6, 170, 14);
    c.fillStyle = '#4a2c14';                        // Holzschaft
    c.fillRect(-110, -10, 90, 34);
    c.fillStyle = '#2c1a0c';                        // Pump
    c.fillRect(60, 2, 40, 22);
    c.fillStyle = '#000';                           // Mündung (auf dich gerichtet)
    c.beginPath(); c.arc(170, -5, 16, 0, Math.PI * 2); c.fill();
    c.fillStyle = '#444';
    c.beginPath(); c.arc(170, -5, 10, 0, Math.PI * 2); c.fill();
    c.restore();
    // Mündungsfeuer
    const mf = c.createRadialGradient(430, 360, 4, 430, 360, 70);
    mf.addColorStop(0, 'rgba(255,240,160,0.95)');
    mf.addColorStop(0.5, 'rgba(255,120,0,0.6)');
    mf.addColorStop(1, 'rgba(255,0,0,0)');
    c.fillStyle = mf;
    c.beginPath(); c.arc(430, 360, 70, 0, Math.PI * 2); c.fill();

    canvas.style.cssText = 'width:100vmax; height:100vmax; max-width:130vw; max-height:130vh;';
    overlay.appendChild(canvas);
    document.body.appendChild(overlay);

    document.body.classList.add('screen-shake');

    // Wildes Zoom/Zitter-Animieren
    let frame = 0;
    const shake = setInterval(() => {
      frame++;
      const sx = (Math.random() - 0.5) * 40;
      const sy = (Math.random() - 0.5) * 40;
      const sc = 1 + Math.sin(frame * 0.8) * 0.06 + frame * 0.004;
      canvas.style.transform = `translate(${sx}px,${sy}px) scale(${sc})`;
    }, 40);

    setTimeout(() => {
      clearInterval(shake);
      document.body.classList.remove('screen-shake');
      overlay.style.transition = 'opacity 0.3s';
      overlay.style.opacity = '0';
      setTimeout(() => overlay.remove(), 300);
    }, 1300);
  }

  onKnockedOut(day, cause) {
    if (!this.player) return;
    this.player.alive = false;
    this.currentDay = day;
    AudioManager.stopChainsaw();
    AudioManager.stopHeartbeat();
    AudioManager.stopMusicBox();
    document.body.classList.remove('danger-vignette');
    document.exitPointerLock();

    const isTrap = cause === 'trap';

    // Bei Granny-Angriff: fetter Jumpscare mit Sense
    if (!isTrap) {
      this._showJumpscare();
    }

    AudioManager.playScream();
    AudioManager.tone(100, 1.5, 'sine', 0.4);
    document.getElementById('ko-text').textContent = isTrap
      ? '🪤 Du bist in eine Bärenfalle getreten!'
      : '💥 Grannys Pumpgun hat dich erwischt...';

    // Schwarzer Flash
    const flash = document.createElement('div');
    flash.style.cssText = 'position:fixed;inset:0;background:#000;z-index:9998;pointer-events:none;opacity:0;transition:opacity 0.2s';
    document.body.appendChild(flash);
    setTimeout(() => { flash.style.opacity = '1'; }, 10);

    setTimeout(() => {
      flash.remove();
      // K.O. Screen anzeigen
      document.getElementById('ko-day-number').textContent = day;
      document.getElementById('ko-title').textContent = day > 4 ? 'LETZTER TAG!' : 'K.O.!';
      document.getElementById('ko-text').textContent =
        day > 4 ? 'Nächstes Mal ist es vorbei!' : 'Granny hat dich erwischt...';
      document.getElementById('knockout-screen').style.display = 'flex';

      // Countdown
      let sec = 4;
      document.getElementById('ko-sec').textContent = sec;
      const timer = setInterval(() => {
        sec--;
        const el = document.getElementById('ko-sec');
        if (el) el.textContent = sec;
        if (sec <= 0) clearInterval(timer);
      }, 1000);
    }, 300);
  }

  onWokeUp(day, health) {
    if (!this.player) return;

    // K.O. Screen ausblenden mit Effekt
    const koScreen = document.getElementById('knockout-screen');
    koScreen.style.transition = 'opacity 0.5s';
    koScreen.style.opacity = '0';
    setTimeout(() => {
      koScreen.style.display = 'none';
      koScreen.style.opacity = '1';
    }, 500);

    // Spieler zurücksetzen
    this.player.alive = true;
    this.player.hidden = false;
    this.player.hidingSpotId = null;
    this.player.setHealth(100);

    // Spawn-Position zurücksetzen
    this.player.pos.set(2, 1.7, 2);

    // Timer neu starten
    this.currentDay = day;
    this.startTime = Date.now();

    // Tag-Übergang Effekt
    document.getElementById('timer-display').textContent = `☀️ TAG ${day} - Überlebe!`;
    this.showMessage(`☀️ Du wachst auf... Tag ${day}. Granny wird aggressiver!`, 4000, '#ffaa00');
    if (day >= 3) this.showMessage('⚠️ Granny ist jetzt schneller!', 3000, '#ff4400');

    // Pointer Lock zurückholen
    setTimeout(() => {
      document.getElementById('game-canvas').requestPointerLock();
    }, 200);

    // Ambient dunkler je höher der Tag (mehr Angst)
    this.scene.traverse(obj => {
      if (obj.isAmbientLight) {
        obj.intensity = Math.max(0.2, 0.6 - (day - 1) * 0.1);
      }
    });
  }

  // Lokales, sofortiges Aufheben (robust, unabhängig vom Server-Roundtrip)
  pickupItemLocal(interactable) {
    if (!interactable || this._pickedItems.has(interactable.id)) return;
    this._pickedItems.add(interactable.id);

    const itemId = interactable.id;
    const itemType = interactable.itemType;

    // Mesh entfernen
    const mesh = this.itemMeshes[itemId];
    if (mesh) {
      mesh.userData.pickedUp = true;
      this.scene.remove(mesh);
      delete this.itemMeshes[itemId];
    }
    // Aus Interaktionsliste entfernen
    const idx = this.interactables.findIndex(i => i.id === itemId);
    if (idx >= 0) this.interactables.splice(idx, 1);

    // Ins Inventar legen
    this.player.addItem(itemType);

    const names = { hammer: '🔨 Hammer', key: '🗝️ Schlüssel', screwdriver: '🔧 Schraubenzieher', wirecutters: '✂️ Drahtschneider' };
    this.showMessage(`${names[itemType] || itemType} aufgehoben!`);
    this.network.makeNoise(this.player.pos.x, this.player.pos.z, 2);
  }

  onItemPickedUp({ itemId, item }) {
    // Server-Bestätigung – nur ausführen, wenn nicht schon lokal aufgehoben
    if (this._pickedItems.has(itemId)) return;
    this._pickedItems.add(itemId);

    const mesh = this.itemMeshes[itemId];
    if (mesh) {
      mesh.userData.pickedUp = true;
      this.scene.remove(mesh);
      delete this.itemMeshes[itemId];
    }
    const idx = this.interactables.findIndex(i => i.id === itemId);
    if (idx >= 0) this.interactables.splice(idx, 1);

    this.player.addItem(item.type);

    const names = { hammer: '🔨 Hammer', key: '🗝️ Schlüssel', screwdriver: '🔧 Schraubenzieher', wirecutters: '✂️ Drahtschneider' };
    this.showMessage(`${names[item.type] || item.type} aufgehoben!`);
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
    HouseBuilder.unplankDoor(doorId); // Tür ist jetzt öffenbar
    AudioManager.playHammerHit();
    this.showMessage('🪵 Holzplanken wurden entfernt!');
  }

  onDoorOpened(doorId) {
    AudioManager.playDoorCreak();
    HouseBuilder.openDoor(doorId);
    this.showMessage('🚪 Tür geöffnet!');
  }

  onPlayerCaught({ id, name }) {
    if (id === this.network.playerId) {
      this.player.alive = false;
      this.player.setHealth(0);
      clearTimeout(this._healTimer);
      document.body.classList.add('screen-shake');
      setTimeout(() => document.body.classList.remove('screen-shake'), 1000);

      // Finaler Todesschrei + rotes Screen
      AudioManager.playScream();
      const deathFlash = document.createElement('div');
      deathFlash.style.cssText = 'position:fixed;inset:0;background:rgba(180,0,0,0.8);z-index:9999;pointer-events:none;transition:opacity 1.5s';
      document.body.appendChild(deathFlash);
      setTimeout(() => { deathFlash.style.opacity = '0'; }, 100);

      this.showMessage('💀 Du wurdest von Grannys Kettensäge erwischt!', 5000, '#ff0000');

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
    AudioManager.stopMusicBox();
    AudioManager.stopRandomAmbience();
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
