// Granny AI - client-side rendering of server-authoritative granny
class Granny {
  constructor(scene) {
    this.scene = scene;
    this.mesh = null;
    this.chainsawMesh = null;
    this.state = 'patrol';
    this.pos = new THREE.Vector3(5, 0, 5);
    this.targetPos = new THREE.Vector3(5, 0, 5);
    this.angle = 0;
    this.chainsawActive = false;
    this.chainsawTimer = 0;
    this.armAngle = 0;
    this.walkCycle = 0;
    this.lastState = 'patrol';
    this.eyeGlow = null;
    this.warningShown = false;
    this._build();
  }

  _build() {
    const g = new THREE.Group();

    // Body (hunched old woman shape)
    const bodyMat = new THREE.MeshLambertMaterial({ color: 0x3a2a1a }); // dark dress
    const skinMat = new THREE.MeshLambertMaterial({ color: 0xc4956a }); // skin
    const hairMat = new THREE.MeshLambertMaterial({ color: 0xdddddd }); // white hair
    const bloodMat = new THREE.MeshLambertMaterial({ color: 0x880000 }); // blood stains

    // Legs
    const legGeo = new THREE.BoxGeometry(0.18, 0.55, 0.18);
    this.legL = new THREE.Mesh(legGeo, bodyMat);
    this.legL.position.set(-0.15, 0.3, 0);
    this.legR = new THREE.Mesh(legGeo, bodyMat);
    this.legR.position.set(0.15, 0.3, 0);
    g.add(this.legL, this.legR);

    // Feet
    const footMat = new THREE.MeshLambertMaterial({ color: 0x1a1a1a });
    [[-0.15, 0],[0.15, 0]].forEach(([x]) => {
      const foot = new THREE.Mesh(new THREE.BoxGeometry(0.16, 0.08, 0.25), footMat);
      foot.position.set(x, 0.04, 0.05);
      g.add(foot);
    });

    // Dress/Skirt (wider at bottom)
    const skirtGeo = new THREE.CylinderGeometry(0.28, 0.38, 0.5, 8);
    const skirt = new THREE.Mesh(skirtGeo, bodyMat);
    skirt.position.set(0, 0.75, 0);
    g.add(skirt);

    // Torso (hunched)
    const torsoGeo = new THREE.BoxGeometry(0.44, 0.48, 0.3);
    this.torso = new THREE.Mesh(torsoGeo, bodyMat);
    this.torso.position.set(0, 1.15, -0.05);
    this.torso.rotation.x = 0.3; // hunch
    g.add(this.torso);

    // Blood stains on dress
    const stainGeo = new THREE.PlaneGeometry(0.15, 0.2);
    const stain = new THREE.Mesh(stainGeo, bloodMat);
    stain.position.set(0.1, 1.1, 0.16);
    g.add(stain);

    // Neck
    const neck = new THREE.Mesh(new THREE.CylinderGeometry(0.08, 0.1, 0.15, 8), skinMat);
    neck.position.set(0, 1.44, -0.05);
    g.add(neck);

    // Head
    const headGeo = new THREE.BoxGeometry(0.32, 0.28, 0.3);
    this.head = new THREE.Mesh(headGeo, skinMat);
    this.head.position.set(0, 1.65, -0.08);
    this.head.rotation.x = 0.2; // looking down
    g.add(this.head);

    // Eyes (glowing red)
    const eyeGeo = new THREE.SphereGeometry(0.04, 8, 8);
    const eyeMat = new THREE.MeshBasicMaterial({ color: 0xff0000 });
    const eyeL = new THREE.Mesh(eyeGeo, eyeMat);
    eyeL.position.set(-0.08, 1.67, -0.22);
    const eyeR = new THREE.Mesh(eyeGeo, eyeMat);
    eyeR.position.set(0.08, 1.67, -0.22);
    g.add(eyeL, eyeR);
    this.eyeL = eyeL;
    this.eyeR = eyeR;

    // Eye light
    this.eyeGlow = new THREE.PointLight(0xff0000, 0, 2);
    this.eyeGlow.position.set(0, 1.67, -0.22);
    g.add(this.eyeGlow);

    // Hair (messy white)
    const hairGeo = new THREE.SphereGeometry(0.19, 8, 6);
    const hair = new THREE.Mesh(hairGeo, hairMat);
    hair.scale.set(1, 0.7, 1);
    hair.position.set(0, 1.78, -0.05);
    g.add(hair);

    // Bun
    const bun = new THREE.Mesh(new THREE.SphereGeometry(0.1, 8, 8), hairMat);
    bun.position.set(0, 1.88, 0.05);
    g.add(bun);

    // Arms
    const armGeo = new THREE.BoxGeometry(0.12, 0.48, 0.12);

    this.armL = new THREE.Group();
    const armLMesh = new THREE.Mesh(armGeo, bodyMat);
    armLMesh.position.y = -0.24;
    this.armL.add(armLMesh);
    // Hand L
    const handL = new THREE.Mesh(new THREE.BoxGeometry(0.1, 0.1, 0.1), skinMat);
    handL.position.y = -0.5;
    this.armL.add(handL);
    this.armL.position.set(-0.28, 1.35, -0.05);
    this.armL.rotation.z = 0.3;
    g.add(this.armL);

    this.armR = new THREE.Group();
    const armRMesh = new THREE.Mesh(armGeo, bodyMat);
    armRMesh.position.y = -0.24;
    this.armR.add(armRMesh);
    // Hand R
    const handR = new THREE.Mesh(new THREE.BoxGeometry(0.1, 0.1, 0.1), skinMat);
    handR.position.y = -0.5;
    this.armR.add(handR);
    this.armR.position.set(0.28, 1.35, -0.05);
    this.armR.rotation.z = -0.3;
    g.add(this.armR);

    // ── PUMPGUN (Schrotflinte) ───────────────────────────────────────
    // Gebaut entlang der lokalen Z-Achse (Lauf zeigt nach +Z/vorne)
    this.scytheGroup = new THREE.Group(); // Name bleibt für update()-Kompatibilität

    const metalMat = new THREE.MeshStandardMaterial({ color: 0x222428, metalness: 0.8, roughness: 0.35 });
    const woodMat  = new THREE.MeshStandardMaterial({ color: 0x4a2c14, metalness: 0.1, roughness: 0.7 });
    const pumpMat  = new THREE.MeshStandardMaterial({ color: 0x2c1a0c, metalness: 0.2, roughness: 0.6 });

    // Lauf (langes Rohr)
    const barrel = new THREE.Mesh(new THREE.CylinderGeometry(0.035, 0.035, 0.95, 10), metalMat);
    barrel.rotation.x = Math.PI / 2;
    barrel.position.set(0, 0.04, 0.35);
    this.scytheGroup.add(barrel);

    // Magazinröhre unter dem Lauf
    const tube = new THREE.Mesh(new THREE.CylinderGeometry(0.028, 0.028, 0.8, 8), metalMat);
    tube.rotation.x = Math.PI / 2;
    tube.position.set(0, -0.02, 0.3);
    this.scytheGroup.add(tube);

    // Mündung
    const muzzle = new THREE.Mesh(new THREE.CylinderGeometry(0.045, 0.045, 0.06, 10), metalMat);
    muzzle.rotation.x = Math.PI / 2;
    muzzle.position.set(0, 0.04, 0.82);
    this.scytheGroup.add(muzzle);

    // Pump-Vorderschaft (der bewegliche Griff)
    this.pumpFore = new THREE.Mesh(new THREE.BoxGeometry(0.1, 0.1, 0.22), pumpMat);
    this.pumpFore.position.set(0, 0.0, 0.42);
    this.scytheGroup.add(this.pumpFore);

    // Gehäuse / Verschluss
    const receiver = new THREE.Mesh(new THREE.BoxGeometry(0.09, 0.13, 0.3), metalMat);
    receiver.position.set(0, 0.02, -0.02);
    this.scytheGroup.add(receiver);

    // Abzugsbügel
    const guard = new THREE.Mesh(new THREE.TorusGeometry(0.045, 0.012, 6, 12), metalMat);
    guard.rotation.x = Math.PI / 2;
    guard.position.set(0, -0.07, -0.05);
    this.scytheGroup.add(guard);

    // Hinterschaft (Holz, nach hinten abfallend)
    const stock = new THREE.Mesh(new THREE.BoxGeometry(0.08, 0.13, 0.35), woodMat);
    stock.position.set(0, -0.04, -0.32);
    stock.rotation.x = 0.18;
    this.scytheGroup.add(stock);

    // Pistolengriff
    const grip = new THREE.Mesh(new THREE.BoxGeometry(0.07, 0.18, 0.08), woodMat);
    grip.position.set(0, -0.12, -0.12);
    grip.rotation.x = 0.4;
    this.scytheGroup.add(grip);

    // Schrotflinte horizontal in die rechte Hand legen, Lauf nach vorne
    this.scytheGroup.position.set(0.18, -0.5, 0.15);
    this.scytheGroup.rotation.set(1.3, 0, 0);
    this.armR.add(this.scytheGroup);

    g.position.copy(this.pos);
    this.mesh = g;
    this.scene.add(g);

    // Shadow
    this.mesh.traverse(obj => {
      if (obj.isMesh) {
        obj.castShadow = true;
      }
    });
  }

  update(dt, time) {
    if (!this.mesh) return;

    // Smooth position interpolation
    const lerpSpeed = this.state === 'chase' ? 6 : 4;
    this.pos.lerp(this.targetPos, Math.min(1, dt * lerpSpeed));
    this.mesh.position.copy(this.pos);

    // Rotation
    const targetAngle = this.angle;
    const currentAngle = this.mesh.rotation.y;
    let diff = targetAngle - currentAngle;
    while (diff > Math.PI) diff -= Math.PI * 2;
    while (diff < -Math.PI) diff += Math.PI * 2;
    this.mesh.rotation.y += diff * Math.min(1, dt * 8);

    // Walk animation
    if (this.state !== 'idle') {
      this.walkCycle += dt * (this.state === 'chase' ? 8 : 4);
      this.legL.rotation.x = Math.sin(this.walkCycle) * 0.4;
      this.legR.rotation.x = Math.sin(this.walkCycle + Math.PI) * 0.4;
      this.armL.rotation.x = Math.sin(this.walkCycle + Math.PI) * 0.3;
    }

    // Pumpgun-Animation
    if (this.state === 'chase') {
      this.chainsawTimer += dt;
      // Arm hebt die Waffe drohend an (zielt nach vorne)
      this.armR.rotation.x = -1.0 + Math.sin(this.chainsawTimer * 3) * 0.08;
      this.armR.rotation.z = -0.15;

      // Pump-Bewegung des Vorderschafts (Durchladen)
      if (this.pumpFore) {
        this.pumpFore.position.z = 0.42 - Math.max(0, Math.sin(this.chainsawTimer * 4)) * 0.12;
      }

      // Eye glow bright
      this.eyeGlow.intensity = 0.5 + Math.sin(time * 10) * 0.3;
      this.eyeL.material.color.setHex(0xff0000);
      this.eyeR.material.color.setHex(0xff0000);

      if (!this.chainsawActive) {
        this.chainsawActive = true;
        AudioManager.playChainsaw();
      }
    } else {
      // Calm state – Waffe locker gesenkt
      this.armR.rotation.x = Math.sin(this.walkCycle) * 0.2;
      this.armR.rotation.z = -0.3;
      if (this.pumpFore) this.pumpFore.position.z = 0.42;
      this.eyeGlow.intensity = 0.1;
      this.eyeL.material.color.setHex(0xaa0000);
      this.eyeR.material.color.setHex(0xaa0000);

      if (this.chainsawActive && this.state !== 'chase') {
        this.chainsawActive = false;
        AudioManager.stopChainsaw();
      }
    }

    // Head bobbing
    this.head.position.y = 1.65 + Math.sin(this.walkCycle * 0.5) * 0.03;

    // Hunch breathing
    this.torso.rotation.x = 0.3 + Math.sin(time * 0.8) * 0.05;
  }

  setServerState(data) {
    this.targetPos.set(data.x, 0, data.z);
    this.angle = -data.angle + Math.PI; // convert server angle to Three.js
    this.lastState = this.state;
    this.state = data.state;

    // React to state change
    if (this.lastState !== 'chase' && this.state === 'chase') {
      AudioManager.playGrannyLaugh();
    }
  }

  getDistanceTo(x, z) {
    return Math.sqrt((this.pos.x - x) ** 2 + (this.pos.z - z) ** 2);
  }
}
