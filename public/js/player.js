// First-person player controller
class Player {
  constructor(camera, scene) {
    this.camera = camera;
    this.scene = scene;

    // Position & rotation
    this.pos = new THREE.Vector3(2, 1.7, 2);
    this.vel = new THREE.Vector3();
    this.yaw = 0;   // horizontal rotation (radians)
    this.pitch = 0; // vertical rotation

    // State
    this.health = 100;
    this.inventory = [];
    this.activeSlot = 0;
    this.hidden = false;
    this.hidingSpotId = null;
    this.escaped = false;
    this.alive = true;
    this.crouching = false;

    // Input state
    this.keys = {};
    this.mouseDX = 0;
    this.mouseDY = 0;
    this.mouseLocked = false;

    // Footstep timer
    this.footstepTimer = 0;
    this.noiseTimer = 0;
    this.isMoving = false;

    // Other players (meshes)
    this.otherPlayers = {};

    // Collision boxes (simple AABB)
    this.radius = 0.35;
    this.height = 1.8;
    this.eyeHeight = 1.65;

    this._setupControls();
  }

  _setupControls() {
    document.addEventListener('keydown', (e) => {
      this.keys[e.code] = true;
      if (e.code === 'KeyE') this._interact();
      if (e.code === 'KeyH') this._toggleHide();
      if (e.code === 'Digit1') this.activeSlot = 0;
      if (e.code === 'Digit2') this.activeSlot = 1;
      if (e.code === 'Digit3') this.activeSlot = 2;
      if (e.code === 'Digit4') this.activeSlot = 3;
      if (e.code === 'Digit5') this.activeSlot = 4;
      if (e.code === 'ShiftLeft' || e.code === 'ShiftRight') this.crouching = true;
      if (e.code === 'Escape') window.game && window.game.togglePause();
    });
    document.addEventListener('keyup', (e) => {
      this.keys[e.code] = false;
      if (e.code === 'ShiftLeft' || e.code === 'ShiftRight') this.crouching = false;
    });

    document.addEventListener('mousemove', (e) => {
      if (!this.mouseLocked) return;
      this.mouseDX += e.movementX;
      this.mouseDY += e.movementY;
    });

    document.addEventListener('pointerlockchange', () => {
      this.mouseLocked = document.pointerLockElement === document.getElementById('game-canvas');
    });

    document.getElementById('game-canvas').addEventListener('click', () => {
      if (!this.mouseLocked && window.game && window.game.state === 'playing') {
        document.getElementById('game-canvas').requestPointerLock();
      }
    });
  }

  _interact() {
    if (this.hidden) return;
    const nearest = this._findNearest();
    if (!nearest) return;

    if (nearest.type === 'item') {
      window.game.network.pickupItem(nearest.id);
    } else if (nearest.type === 'door' || nearest.type === 'plank' || nearest.type === 'exit') {
      const activeItem = this.inventory[this.activeSlot];
      window.game.network.useItem(activeItem || null, nearest.id);
      if (nearest.type === 'door' || nearest.type === 'plank') {
        AudioManager.playDoorCreak();
        window.game.network.makeNoise(this.pos.x, this.pos.z, 5);
      }
      if (nearest.type === 'exit') {
        window.game.tryEscape();
      }
    } else if (nearest.type === 'wardrobe') {
      this._toggleHide(nearest.id);
    }
  }

  _toggleHide(spotId) {
    if (!this.alive) return;

    if (this.hidden) {
      this.hidden = false;
      window.game.network.hide(this.hidingSpotId, false);
      this.hidingSpotId = null;
      document.getElementById('hidden-indicator').style.display = 'none';
      // Unhiding makes noise
      window.game.network.makeNoise(this.pos.x, this.pos.z, 3);
    } else {
      // Find nearest hiding spot
      const spot = spotId
        ? window.game.hidingSpots.find(s => s.id === spotId)
        : this._findNearestHidingSpot();
      if (!spot) return;
      this.hidden = true;
      this.hidingSpotId = spot.id;
      window.game.network.hide(spot.id, true);
      document.getElementById('hidden-indicator').style.display = 'block';
      AudioManager.noise(0.1, 0.1); // quiet rustle
    }
  }

  _findNearestHidingSpot() {
    if (!window.game.hidingSpots) return null;
    let best = null, bestDist = Infinity;
    for (const spot of window.game.hidingSpots) {
      const dx = spot.x - this.pos.x;
      const dz = spot.z - this.pos.z;
      const dist = Math.sqrt(dx*dx + dz*dz);
      if (dist < spot.radius && dist < bestDist) {
        bestDist = dist;
        best = spot;
      }
    }
    return best;
  }

  _findNearest() {
    if (!window.game.interactables) return null;
    let best = null, bestDist = Infinity;
    for (const obj of window.game.interactables) {
      if (obj.mesh && obj.mesh.userData.pickedUp) continue;
      const dx = obj.x - this.pos.x;
      const dz = obj.z - this.pos.z;
      const dist = Math.sqrt(dx*dx + dz*dz);
      if (dist < obj.radius && dist < bestDist) {
        bestDist = dist;
        best = obj;
      }
    }
    return best;
  }

  update(dt) {
    if (!this.alive) {
      this._applyCamera();
      return;
    }

    if (this.hidden) {
      this._applyCamera();
      return;
    }

    // Mouse look - funktioniert nur wenn Maus gesperrt
    if (this.mouseLocked) {
      const sensitivity = 0.002;
      this.yaw -= this.mouseDX * sensitivity;
      this.pitch -= this.mouseDY * sensitivity;
      this.pitch = Math.max(-1.2, Math.min(1.2, this.pitch));
    }
    this.mouseDX = 0;
    this.mouseDY = 0;

    // Bewegung funktioniert IMMER (auch ohne Mauslock)
    const speed = this.crouching ? 1.5 : (this.keys['ShiftLeft'] ? 4.5 : 3.2);
    const forward = new THREE.Vector3(-Math.sin(this.yaw), 0, -Math.cos(this.yaw));
    const right = new THREE.Vector3(Math.cos(this.yaw), 0, -Math.sin(this.yaw));

    const moveDir = new THREE.Vector3();
    if (this.keys['KeyW'] || this.keys['ArrowUp'])    moveDir.addScaledVector(forward, 1);
    if (this.keys['KeyS'] || this.keys['ArrowDown'])  moveDir.addScaledVector(forward, -1);
    if (this.keys['KeyA'] || this.keys['ArrowLeft'])  moveDir.addScaledVector(right, -1);
    if (this.keys['KeyD'] || this.keys['ArrowRight']) moveDir.addScaledVector(right, 1);

    this.isMoving = moveDir.length() > 0;
    if (this.isMoving) {
      moveDir.normalize();
      const newX = this.pos.x + moveDir.x * speed * dt;
      const newZ = this.pos.z + moveDir.z * speed * dt;

      // Simple boundary collision
      if (newX > -20 && newX < 22) this.pos.x = newX;
      if (newZ > -16 && newZ < 16) this.pos.z = newZ;

      // Wall collision (circle vs AABB)
      if (window.game && window.game.walls) {
        for (const wall of window.game.walls) {
          const nearX = Math.max(wall.x1, Math.min(this.pos.x, wall.x2));
          const nearZ = Math.max(wall.z1, Math.min(this.pos.z, wall.z2));
          const dx = this.pos.x - nearX;
          const dz = this.pos.z - nearZ;
          const dist = Math.sqrt(dx * dx + dz * dz);
          if (dist < this.radius && dist > 0.0001) {
            const push = (this.radius - dist) / dist;
            this.pos.x += dx * push;
            this.pos.z += dz * push;
          }
        }
      }
    }

    // Camera immer setzen
    this._applyCamera();

    // Footstep sounds & noise
    if (this.isMoving) {
      this.footstepTimer -= dt;
      if (this.footstepTimer <= 0) {
        const interval = this.crouching ? 0.7 : (speed > 4 ? 0.3 : 0.5);
        this.footstepTimer = interval;
        AudioManager.playFootstep();
      }

      this.noiseTimer -= dt;
      if (this.noiseTimer <= 0) {
        this.noiseTimer = 0.5;
        const noiseVol = this.crouching ? 1 : (speed > 4 ? 6 : 3);
        window.game.network.makeNoise(this.pos.x, this.pos.z, noiseVol);
      }
    }

    // Head bob
    if (this.isMoving) {
      const bobAmt = this.crouching ? 0.03 : 0.06;
      const bobSpeed = this.crouching ? 4 : 8;
      this.camera.position.y += Math.sin(Date.now() * 0.001 * bobSpeed) * bobAmt;
    }

    // Update prompts
    this._updatePrompts();

    // Update inventory UI
    this._updateInventoryUI();
  }

  _applyCamera() {
    this.camera.position.set(this.pos.x, this.crouching ? this.eyeHeight - 0.4 : this.eyeHeight, this.pos.z);
    this.camera.rotation.order = 'YXZ';
    this.camera.rotation.y = this.yaw;
    this.camera.rotation.x = this.pitch;
  }

  _updatePrompts() {
    const nearest = this._findNearest();
    const nearestHide = this._findNearestHidingSpot();

    const interactPrompt = document.getElementById('interact-prompt');
    const interactText = document.getElementById('interact-text');
    const hidePrompt = document.getElementById('hide-prompt');
    const hideText = document.getElementById('hide-text');

    if (nearest && !this.hidden) {
      interactPrompt.style.display = 'flex';
      if (nearest.type === 'item') {
        const names = { hammer: '🔨 Hammer', key: '🗝️ Schlüssel', screwdriver: '🔧 Schraubenzieher', wirecutters: '✂️ Drahtschneider' };
        interactText.textContent = (names[nearest.itemType] || nearest.itemType) + ' aufheben';
      } else if (nearest.type === 'plank') {
        interactText.textContent = '🪵 Holzplanken entfernen (Hammer benötigt)';
      } else if (nearest.type === 'door') {
        interactText.textContent = '🚪 Tür öffnen';
      } else if (nearest.type === 'exit') {
        interactText.textContent = '🏃 ENTKOMMEN! (Schlüssel benötigt)';
      } else if (nearest.type === 'wardrobe') {
        interactText.textContent = '👁️ Verstecken im Schrank';
      }
    } else {
      interactPrompt.style.display = 'none';
    }

    if ((nearestHide || this.hidden) && !nearest) {
      hidePrompt.style.display = 'flex';
      hideText.textContent = this.hidden ? 'Versteck verlassen' : 'Verstecken';
    } else {
      hidePrompt.style.display = 'none';
    }
  }

  _updateInventoryUI() {
    for (let i = 0; i < 5; i++) {
      const slot = document.getElementById('slot-' + i);
      const item = this.inventory[i];
      const icons = { hammer: '🔨', key: '🗝️', screwdriver: '🔧', wirecutters: '✂️' };
      slot.textContent = item ? (icons[item] || '📦') : '';
      slot.className = 'inv-slot' + (i === this.activeSlot ? ' active' : '') + (item ? ' has-item' : '');
    }
  }

  addItem(type) {
    const slot = this.inventory.findIndex(s => !s);
    if (slot >= 0) {
      this.inventory[slot] = type;
    } else if (this.inventory.length < 5) {
      this.inventory.push(type);
    }
    AudioManager.playPickup();
  }

  setHealth(hp) {
    this.health = hp;
    // HP-Leiste entfernt – kein UI-Update nötig
  }

  addOtherPlayer(id, data) {
    if (this.otherPlayers[id]) return;
    const g = new THREE.Group();

    const bodyMat = new THREE.MeshLambertMaterial({ color: 0x2244aa });
    const skinMat = new THREE.MeshLambertMaterial({ color: 0xcc9966 });

    // Simple player model
    const body = new THREE.Mesh(new THREE.BoxGeometry(0.5, 0.8, 0.3), bodyMat);
    body.position.y = 1.2;
    g.add(body);
    const head = new THREE.Mesh(new THREE.BoxGeometry(0.35, 0.35, 0.35), skinMat);
    head.position.y = 1.8;
    g.add(head);
    const legL = new THREE.Mesh(new THREE.BoxGeometry(0.2, 0.6, 0.2), bodyMat);
    legL.position.set(-0.15, 0.5, 0);
    g.add(legL);
    const legR = new THREE.Mesh(new THREE.BoxGeometry(0.2, 0.6, 0.2), bodyMat);
    legR.position.set(0.15, 0.5, 0);
    g.add(legR);

    // Name tag
    const canvas = document.createElement('canvas');
    canvas.width = 256; canvas.height = 64;
    const ctx = canvas.getContext('2d');
    ctx.fillStyle = 'rgba(0,0,0,0.7)';
    ctx.fillRect(0, 0, 256, 64);
    ctx.fillStyle = '#ffffff';
    ctx.font = 'bold 28px Courier New';
    ctx.textAlign = 'center';
    ctx.fillText(data.name || id.slice(0, 8), 128, 42);
    const tex = new THREE.CanvasTexture(canvas);
    const nameTag = new THREE.Mesh(
      new THREE.PlaneGeometry(1, 0.25),
      new THREE.MeshBasicMaterial({ map: tex, transparent: true, depthTest: false })
    );
    nameTag.position.y = 2.2;
    nameTag.userData.billboard = true;
    g.add(nameTag);

    g.position.set(data.x || 0, 0, data.z || 0);
    this.scene.add(g);
    this.otherPlayers[id] = { mesh: g, data };
  }

  updateOtherPlayer(id, data) {
    const p = this.otherPlayers[id];
    if (!p) return;
    p.mesh.position.set(data.x, 0, data.z);
    p.mesh.rotation.y = data.rotY || 0;
  }

  removeOtherPlayer(id) {
    const p = this.otherPlayers[id];
    if (!p) return;
    this.scene.remove(p.mesh);
    delete this.otherPlayers[id];
  }

  updateNameTagBillboard(camera) {
    for (const id in this.otherPlayers) {
      const p = this.otherPlayers[id];
      p.mesh.traverse(obj => {
        if (obj.userData.billboard) {
          obj.lookAt(camera.position);
        }
      });
    }
  }
}
