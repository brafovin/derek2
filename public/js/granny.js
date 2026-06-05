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

    // ── SENSE (Scythe) – blutüberströmt ──────────────────────────────
    this.scytheGroup = new THREE.Group();

    // Stiel (langer Holzschaft)
    const snathMat = new THREE.MeshLambertMaterial({ color: 0x3b2410 });
    const snath = new THREE.Mesh(new THREE.CylinderGeometry(0.035, 0.045, 1.7, 8), snathMat);
    snath.position.set(0, 0.0, 0);
    this.scytheGroup.add(snath);

    // Handgriff in der Mitte des Stiels
    const grip = new THREE.Mesh(new THREE.CylinderGeometry(0.03, 0.03, 0.18, 6), new THREE.MeshLambertMaterial({ color: 0x1a1008 }));
    grip.rotation.z = Math.PI / 2;
    grip.position.set(0.12, 0.1, 0);
    this.scytheGroup.add(grip);

    // Klingenhalterung am oberen Ende
    const collar = new THREE.Mesh(new THREE.CylinderGeometry(0.06, 0.06, 0.12, 8), new THREE.MeshLambertMaterial({ color: 0x222222 }));
    collar.position.set(0, 0.82, 0);
    this.scytheGroup.add(collar);

    // Gekrümmte Klinge aus mehreren Segmenten (sichelförmig)
    const bladeMat = new THREE.MeshStandardMaterial({ color: 0xb8b8c0, metalness: 0.85, roughness: 0.25, side: THREE.DoubleSide });
    const bloodBladeMat = new THREE.MeshStandardMaterial({ color: 0x6a0000, metalness: 0.3, roughness: 0.5, side: THREE.DoubleSide });
    this.bladeBlood = [];
    const segs = 7;
    for (let i = 0; i < segs; i++) {
      const t = i / (segs - 1);
      // Sichel-Kurve: krümmt sich nach vorne und leicht nach unten
      const ang = t * 1.5;
      const len = 0.22 - t * 0.04;
      const seg = new THREE.Mesh(new THREE.BoxGeometry(0.015, 0.16 - t * 0.06, len), bladeMat);
      seg.position.set(0, 0.9 + Math.sin(ang) * 0.32, Math.cos(ang) * 0.32 - 0.05);
      seg.rotation.x = -ang;
      this.scytheGroup.add(seg);

      // Blut auf jedem Klingensegment
      const blood = new THREE.Mesh(new THREE.BoxGeometry(0.02, 0.1, len * 0.8), bloodBladeMat);
      blood.position.copy(seg.position);
      blood.position.x = 0.012;
      blood.rotation.x = seg.rotation.x;
      this.scytheGroup.add(blood);
      this.bladeBlood.push(blood);
    }

    // Bluttropfen, die von der Klinge hängen
    const dripMat = new THREE.MeshStandardMaterial({ color: 0x8a0000, metalness: 0.1, roughness: 0.4 });
    [[0, 1.18, 0.28], [0, 1.05, 0.2], [0, 0.95, 0.12]].forEach(([x, y, z]) => {
      const drip = new THREE.Mesh(new THREE.SphereGeometry(0.025, 6, 6), dripMat);
      drip.scale.y = 1.8;
      drip.position.set(x, y, z);
      this.scytheGroup.add(drip);
    });

    this.scytheGroup.position.set(0.28, 0.7, 0);
    this.scytheGroup.rotation.x = -0.3;
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

    // Sensen-Animation
    if (this.state === 'chase') {
      this.chainsawTimer += dt;
      // Drohendes Schwingen der Sense beim Verfolgen
      this.armR.rotation.x = Math.sin(this.chainsawTimer * 6) * 0.5 - 0.5;
      this.armR.rotation.z = Math.sin(this.chainsawTimer * 4) * 0.2 - 0.4;
      this.scytheGroup.rotation.z = Math.sin(this.chainsawTimer * 5) * 0.25;

      // Eye glow bright
      this.eyeGlow.intensity = 0.5 + Math.sin(time * 10) * 0.3;
      this.eyeL.material.color.setHex(0xff0000);
      this.eyeR.material.color.setHex(0xff0000);

      if (!this.chainsawActive) {
        this.chainsawActive = true;
        AudioManager.playChainsaw();
      }
    } else {
      // Calm state
      this.armR.rotation.x = Math.sin(this.walkCycle) * 0.2;
      this.armR.rotation.z = -0.3;
      this.scytheGroup.rotation.z = 0;
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
