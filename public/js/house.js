// House builder - creates the 3D house using Three.js
const HouseBuilder = (() => {
  const WALL_HEIGHT = 3.5;
  const WALL_THICKNESS = 0.2;

  const textures = {};
  const interactables = [];
  const hidingSpots = [];

  function loadTextures() {
    // === VERWÜSTETE WAND - rissiges, dreckiges Mauerwerk ===
    textures.wall = makeCanvasTexture(256, 256, (ctx) => {
      // Basis: schmutziges Grau-Beige
      ctx.fillStyle = '#4a4035';
      ctx.fillRect(0, 0, 256, 256);
      // Ziegelreihen - dunkel und abgenutzt
      for (let y = 0; y < 256; y += 18) {
        for (let x = 0; x < 256; x += 38) {
          const ox = (Math.floor(y / 18) % 2) * 19;
          const shade = 28 + Math.floor(Math.random() * 12);
          ctx.fillStyle = `hsl(25,15%,${shade}%)`;
          ctx.fillRect(x + ox + 1, y + 1, 36, 16);
        }
      }
      // Risse
      ctx.strokeStyle = 'rgba(0,0,0,0.7)';
      ctx.lineWidth = 1.5;
      for (let i = 0; i < 8; i++) {
        ctx.beginPath();
        let cx = Math.random() * 256, cy = Math.random() * 256;
        ctx.moveTo(cx, cy);
        for (let j = 0; j < 6; j++) {
          cx += (Math.random() - 0.5) * 30;
          cy += Math.random() * 20;
          ctx.lineTo(cx, cy);
        }
        ctx.stroke();
      }
      // Blutspritzer
      for (let i = 0; i < 4; i++) {
        if (Math.random() < 0.5) {
          ctx.fillStyle = `rgba(120,0,0,${0.3 + Math.random()*0.4})`;
          ctx.beginPath();
          ctx.ellipse(Math.random()*256, Math.random()*256, 3+Math.random()*12, 2+Math.random()*6, Math.random()*Math.PI, 0, Math.PI*2);
          ctx.fill();
        }
      }
      // Schimmel / Verfärbung
      for (let i = 0; i < 6; i++) {
        const grd = ctx.createRadialGradient(Math.random()*256,Math.random()*256,0,Math.random()*256,Math.random()*256,30+Math.random()*40);
        grd.addColorStop(0, 'rgba(20,30,10,0.4)');
        grd.addColorStop(1, 'rgba(0,0,0,0)');
        ctx.fillStyle = grd;
        ctx.fillRect(0,0,256,256);
      }
    });

    // === VERWÜSTETER BODEN - aufgebrochene, blutige Dielen ===
    textures.floor = makeCanvasTexture(256, 256, (ctx) => {
      ctx.fillStyle = '#2a1f14';
      ctx.fillRect(0, 0, 256, 256);
      // Holzdielen – dunkel, vermodert
      for (let y = 0; y < 256; y += 22) {
        const shade = 15 + Math.floor(Math.random() * 10);
        ctx.fillStyle = `hsl(28,35%,${shade}%)`;
        ctx.fillRect(0, y + 1, 256, 20);
        // Holzmaserung
        ctx.strokeStyle = `rgba(0,0,0,0.3)`;
        ctx.lineWidth = 1;
        for (let lx = 0; lx < 256; lx += 40 + Math.random()*20) {
          ctx.beginPath();
          ctx.moveTo(lx, y);
          ctx.bezierCurveTo(lx+5, y+5, lx+10, y+15, lx+2, y+22);
          ctx.stroke();
        }
        // Trennlinie
        ctx.strokeStyle = '#0a0805';
        ctx.lineWidth = 2;
        ctx.beginPath(); ctx.moveTo(0, y); ctx.lineTo(256, y); ctx.stroke();
      }
      // Blutlachen
      for (let i = 0; i < 5; i++) {
        if (Math.random() < 0.6) {
          const grd = ctx.createRadialGradient(Math.random()*256,Math.random()*256,0,Math.random()*256,Math.random()*256,8+Math.random()*20);
          grd.addColorStop(0, 'rgba(140,0,0,0.8)');
          grd.addColorStop(0.6, 'rgba(80,0,0,0.4)');
          grd.addColorStop(1, 'rgba(0,0,0,0)');
          ctx.fillStyle = grd;
          ctx.fillRect(0,0,256,256);
        }
      }
      // Aufgebrochene Stellen
      ctx.strokeStyle = 'rgba(0,0,0,0.8)';
      ctx.lineWidth = 2;
      for (let i = 0; i < 4; i++) {
        const sx = Math.random()*256, sy = Math.random()*256;
        ctx.beginPath(); ctx.moveTo(sx,sy);
        ctx.lineTo(sx+10+Math.random()*20, sy+5+Math.random()*15);
        ctx.lineTo(sx-5+Math.random()*15, sy+15+Math.random()*20);
        ctx.stroke();
      }
    });

    // === DECKE - vergilbt, schimmelfleckig ===
    textures.ceiling = makeCanvasTexture(128, 128, (ctx) => {
      ctx.fillStyle = '#3a3530';
      ctx.fillRect(0, 0, 128, 128);
      // Wasserflecken
      for (let i = 0; i < 8; i++) {
        const grd = ctx.createRadialGradient(Math.random()*128,Math.random()*128,0,Math.random()*128,Math.random()*128,10+Math.random()*25);
        grd.addColorStop(0, 'rgba(60,40,20,0.6)');
        grd.addColorStop(1, 'rgba(0,0,0,0)');
        ctx.fillStyle = grd;
        ctx.fillRect(0,0,128,128);
      }
      // Schimmel
      for (let i = 0; i < 5; i++) {
        ctx.fillStyle = `rgba(15,${20+Math.random()*20},10,${0.3+Math.random()*0.4})`;
        ctx.beginPath();
        ctx.arc(Math.random()*128, Math.random()*128, 5+Math.random()*15, 0, Math.PI*2);
        ctx.fill();
      }
    });

    // === TÜR - verwittert, zerkratzt ===
    textures.door = makeCanvasTexture(64, 128, (ctx) => {
      ctx.fillStyle = '#1e1208';
      ctx.fillRect(0, 0, 64, 128);
      ctx.fillStyle = '#2a180a';
      ctx.fillRect(4, 4, 56, 52); ctx.fillRect(4, 64, 56, 60);
      ctx.strokeStyle = '#0a0602'; ctx.lineWidth = 2;
      ctx.strokeRect(4, 4, 56, 52); ctx.strokeRect(4, 64, 56, 60);
      // Kratzer
      ctx.strokeStyle = 'rgba(0,0,0,0.5)'; ctx.lineWidth = 1;
      for (let i = 0; i < 6; i++) {
        ctx.beginPath();
        const sx = Math.random()*64;
        ctx.moveTo(sx, Math.random()*128);
        ctx.lineTo(sx + (Math.random()-0.5)*20, Math.random()*128);
        ctx.stroke();
      }
      // Blut-Handabdruck Andeutung
      ctx.fillStyle = 'rgba(100,0,0,0.3)';
      ctx.beginPath(); ctx.arc(35, 80, 8, 0, Math.PI*2); ctx.fill();
    });

    textures.plank = makeCanvasTexture(128, 32, (ctx) => {
      ctx.fillStyle = '#3a1a08';
      ctx.fillRect(0, 0, 128, 32);
      ctx.strokeStyle = '#1a0a04'; ctx.lineWidth = 2;
      for (let i = 0; i < 3; i++) ctx.strokeRect(2, 2+i*10, 124, 8);
      // Nägel
      ctx.fillStyle = '#666';
      [10,60,118].forEach(nx => { ctx.beginPath(); ctx.arc(nx, 6, 2, 0, Math.PI*2); ctx.fill(); });
    });
  }

  function makeCanvasTexture(w, h, draw) {
    const canvas = document.createElement('canvas');
    canvas.width = w; canvas.height = h;
    const ctx2d = canvas.getContext('2d');
    draw(ctx2d);
    const tex = new THREE.CanvasTexture(canvas);
    tex.wrapS = tex.wrapT = THREE.RepeatWrapping;
    return tex;
  }

  function makeWallMat(repeat = 4) {
    const t = textures.wall.clone();
    t.needsUpdate = true;
    t.repeat.set(repeat, 1);
    return new THREE.MeshLambertMaterial({ map: t, side: THREE.FrontSide });
  }

  function makeFloorMat(repeat = 4) {
    const t = textures.floor.clone();
    t.needsUpdate = true;
    t.repeat.set(repeat, repeat);
    return new THREE.MeshLambertMaterial({ map: t });
  }

  function box(scene, w, h, d, x, y, z, mat, castShadow=true) {
    const geo = new THREE.BoxGeometry(w, h, d);
    const mesh = new THREE.Mesh(geo, mat);
    mesh.position.set(x, y, z);
    if (castShadow) { mesh.castShadow = true; mesh.receiveShadow = true; }
    scene.add(mesh);
    return mesh;
  }

  function addRoom(scene, x, z, width, depth, name, opts = {}) {
    const h = WALL_HEIGHT;
    const y = h / 2;
    const wm = makeWallMat(width / 3);
    const fm = makeFloorMat(width / 3);
    const cm = new THREE.MeshLambertMaterial({ map: textures.ceiling });

    // Floor
    box(scene, width, 0.1, depth, x, 0.05, z, fm, false);
    // Ceiling
    box(scene, width, 0.1, depth, x, h, z, cm, false);

    if (!opts.noWalls) {
      // Walls (with door gaps if specified)
      const doors = opts.doors || {};

      // North wall (z-)
      if (!doors.north) {
        box(scene, width, h, WALL_THICKNESS, x, y, z - depth/2, wm);
      } else {
        const dw = doors.north.width || 1.2;
        const gx = doors.north.offset || 0;
        box(scene, (width - dw) / 2 + gx, h, WALL_THICKNESS, x - (width - (width-dw)/2)/2 + (width-dw)/4 + gx/2, y, z - depth/2, wm);
        box(scene, (width - dw) / 2 - gx, h, WALL_THICKNESS, x + (width - (width-dw)/2)/2 - (width-dw)/4 + gx/2, y, z - depth/2, wm);
        box(scene, dw, h - 2.2, WALL_THICKNESS, x + gx, y + 1.1, z - depth/2, wm);
      }
      // South wall (z+)
      if (!doors.south) {
        box(scene, width, h, WALL_THICKNESS, x, y, z + depth/2, wm);
      } else {
        const dw = doors.south.width || 1.2;
        box(scene, (width - dw) / 2, h, WALL_THICKNESS, x - (width + dw) / 4, y, z + depth/2, wm);
        box(scene, (width - dw) / 2, h, WALL_THICKNESS, x + (width + dw) / 4, y, z + depth/2, wm);
        box(scene, dw, h - 2.2, WALL_THICKNESS, x, y + 1.1, z + depth/2, wm);
      }
      // West wall (x-)
      if (!doors.west) {
        box(scene, WALL_THICKNESS, h, depth, x - width/2, y, z, wm);
      } else {
        const dw = doors.west.width || 1.2;
        box(scene, WALL_THICKNESS, h, (depth - dw) / 2, x - width/2, y, z - (depth + dw) / 4, wm);
        box(scene, WALL_THICKNESS, h, (depth - dw) / 2, x - width/2, y, z + (depth + dw) / 4, wm);
        box(scene, WALL_THICKNESS, h - 2.2, dw, x - width/2, y + 1.1, z, wm);
      }
      // East wall (x+)
      if (!doors.east) {
        box(scene, WALL_THICKNESS, h, depth, x + width/2, y, z, wm);
      } else {
        const dw = doors.east.width || 1.2;
        box(scene, WALL_THICKNESS, h, (depth - dw) / 2, x + width/2, y, z - (depth + dw) / 4, wm);
        box(scene, WALL_THICKNESS, h, (depth - dw) / 2, x + width/2, y, z + (depth + dw) / 4, wm);
        box(scene, WALL_THICKNESS, h - 2.2, dw, x + width/2, y + 1.1, z, wm);
      }
    }
  }

  function addFurniture(scene, x, y, z, type) {
    const mat = (color) => new THREE.MeshLambertMaterial({ color });
    switch (type) {
      case 'bed': {
        box(scene, 1.8, 0.4, 2.8, x, 0.2, z, mat(0x4a3a2a));
        box(scene, 1.8, 0.6, 2.8, x, 0.6, z, mat(0xddccbb)); // mattress
        box(scene, 1.8, 0.8, 0.2, x, 0.8, z - 1.4, mat(0x4a3a2a)); // headboard
        // Under-bed hiding spot
        hidingSpots.push({ id: 'hide_bed_' + x + '_' + z, x, z, radius: 1.2, type: 'under_bed' });
        break;
      }
      case 'wardrobe': {
        const m = box(scene, 1.5, 2.2, 0.6, x, 1.1, z, mat(0x3d2b1a));
        m.userData.interactable = true;
        m.userData.type = 'wardrobe';
        hidingSpots.push({ id: 'hide_wardrobe_' + x + '_' + z, x, z, radius: 0.8, type: 'wardrobe' });
        interactables.push({ id: 'wardrobe_' + x + '_' + z, x, y: 1.1, z, type: 'wardrobe', mesh: m, radius: 1.5 });
        break;
      }
      case 'table': {
        // Legs
        [[-0.4,-0.4],[0.4,-0.4],[-0.4,0.4],[0.4,0.4]].forEach(([dx,dz]) => {
          box(scene, 0.06, 0.7, 0.06, x+dx, 0.35, z+dz, mat(0x5a3a1a));
        });
        box(scene, 1.0, 0.05, 0.8, x, 0.72, z, mat(0x6b4a2a));
        break;
      }
      case 'chair': {
        box(scene, 0.5, 0.04, 0.5, x, 0.44, z, mat(0x5a3a1a));
        box(scene, 0.5, 0.8, 0.06, x, 0.84, z - 0.22, mat(0x5a3a1a));
        [[-0.2,-0.2],[0.2,-0.2],[-0.2,0.2],[0.2,0.2]].forEach(([dx,dz]) => {
          box(scene, 0.05, 0.4, 0.05, x+dx, 0.2, z+dz, mat(0x5a3a1a));
        });
        break;
      }
      case 'sofa': {
        box(scene, 2.5, 0.4, 1.0, x, 0.2, z, mat(0x3a3a5a));
        box(scene, 2.5, 0.5, 0.25, x, 0.55, z + 0.37, mat(0x3a3a5a));
        box(scene, 0.25, 0.7, 1.0, x - 1.12, 0.55, z, mat(0x3a3a5a));
        box(scene, 0.25, 0.7, 1.0, x + 1.12, 0.55, z, mat(0x3a3a5a));
        hidingSpots.push({ id: 'hide_sofa_' + x + '_' + z, x, z, radius: 1.2, type: 'sofa' });
        break;
      }
      case 'bathtub': {
        box(scene, 1.7, 0.4, 0.8, x, 0.2, z, mat(0xcccccc));
        box(scene, 0.1, 0.35, 0.7, x - 0.8, 0.37, z, mat(0xcccccc));
        box(scene, 0.1, 0.35, 0.7, x + 0.8, 0.37, z, mat(0xcccccc));
        box(scene, 1.5, 0.1, 0.6, x, 0.45, z, mat(0xaaaaff));
        hidingSpots.push({ id: 'hide_bathtub_' + x + '_' + z, x, z, radius: 1.0, type: 'bathtub' });
        break;
      }
      case 'toilet': {
        box(scene, 0.4, 0.35, 0.6, x, 0.17, z, mat(0xeeeeee));
        box(scene, 0.4, 0.08, 0.5, x, 0.36, z, mat(0xdddddd));
        box(scene, 0.4, 0.7, 0.15, x, 0.55, z + 0.25, mat(0xeeeeee));
        break;
      }
      case 'bookshelf': {
        box(scene, 0.15, 2.0, 1.2, x, 1.0, z, mat(0x4a2e0e));
        for (let i = 0; i < 4; i++) {
          box(scene, 0.12, 0.25, 1.1, x, 0.35 + i * 0.5, z, mat(0x5a3a1a));
          // Books
          const colors = [0x8b0000, 0x00368b, 0x006b00, 0x8b6b00, 0x6b008b];
          let bx = z - 0.5;
          for (let b = 0; b < 8; b++) {
            const bw = 0.06 + Math.random() * 0.05;
            box(scene, 0.1, 0.22, bw, x, 0.5 + i * 0.5, bx + bw/2, mat(colors[b % colors.length]));
            bx += bw + 0.01;
          }
        }
        break;
      }
      case 'barrel': {
        const geo = new THREE.CylinderGeometry(0.3, 0.3, 0.8, 12);
        const mesh = new THREE.Mesh(geo, mat(0x5a3a1a));
        mesh.position.set(x, 0.4, z);
        scene.add(mesh);
        break;
      }
      case 'crate': {
        box(scene, 0.7, 0.7, 0.7, x, 0.35, z, mat(0x6b4a2a));
        hidingSpots.push({ id: 'hide_crate_' + x + '_' + z, x, z, radius: 0.7, type: 'crate' });
        break;
      }
    }
  }

  function addDoor(scene, x, y, z, rotY, doorId, hasPlank = false) {
    const doorMat = new THREE.MeshLambertMaterial({ map: textures.door });
    const door = box(scene, 1.1, 2.2, 0.08, x, y + 1.1, z, doorMat);
    door.rotation.y = rotY;
    door.userData.doorId = doorId;
    door.userData.interactable = true;
    door.userData.type = 'door';
    interactables.push({ id: 'door_' + doorId, x, y: y + 1.1, z, type: 'door', mesh: door, radius: 1.5 });

    if (hasPlank) {
      addPlank(scene, x, y, z, rotY, doorId);
    }

    // Door frame
    const frameMat = new THREE.MeshLambertMaterial({ color: 0x3a2010 });
    box(scene, 0.1, 2.4, 0.12, x - 0.6, y + 1.2, z, frameMat).rotation.y = rotY;
    box(scene, 0.1, 2.4, 0.12, x + 0.6, y + 1.2, z, frameMat).rotation.y = rotY;
    box(scene, 1.3, 0.1, 0.12, x, y + 2.3, z, frameMat).rotation.y = rotY;

    return door;
  }

  function addPlank(scene, x, y, z, rotY, doorId) {
    const plankMat = new THREE.MeshLambertMaterial({ map: textures.plank, color: 0x8b5a2b });
    const plankGroup = new THREE.Group();
    const p1 = new THREE.Mesh(new THREE.BoxGeometry(1.2, 0.15, 0.06), plankMat);
    p1.position.set(0, 0.6, 0);
    p1.rotation.z = 0.3;
    const p2 = new THREE.Mesh(new THREE.BoxGeometry(1.2, 0.15, 0.06), plankMat);
    p2.position.set(0, 1.0, 0);
    p2.rotation.z = -0.3;
    const p3 = new THREE.Mesh(new THREE.BoxGeometry(1.2, 0.15, 0.06), plankMat);
    p3.position.set(0, 1.6, 0);
    p3.rotation.z = 0.15;
    plankGroup.add(p1, p2, p3);
    plankGroup.position.set(x, y, z);
    plankGroup.rotation.y = rotY;
    plankGroup.userData.doorId = doorId;
    plankGroup.userData.type = 'plank';
    scene.add(plankGroup);
    interactables.push({ id: 'plank_' + doorId, x, y, z, type: 'plank', mesh: plankGroup, radius: 1.5 });
    return plankGroup;
  }

  function addItem(scene, itemData) {
    const icons = {
      hammer: { color: 0x888888, h: 0.4, shape: 'hammer' },
      key: { color: itemData.color || 0xffcc00, h: 0.2, shape: 'key' },
      screwdriver: { color: 0x4444ff, h: 0.3, shape: 'stick' },
      wirecutters: { color: 0xff4444, h: 0.25, shape: 'stick' }
    };
    const info = icons[itemData.type] || { color: 0xffffff, h: 0.3, shape: 'sphere' };

    let mesh;
    if (info.shape === 'hammer') {
      const g = new THREE.Group();
      const handle = new THREE.Mesh(new THREE.BoxGeometry(0.06, 0.4, 0.06),
        new THREE.MeshLambertMaterial({ color: 0x8b4a00 }));
      handle.position.y = -0.1;
      const head = new THREE.Mesh(new THREE.BoxGeometry(0.2, 0.1, 0.08),
        new THREE.MeshLambertMaterial({ color: 0x888888 }));
      head.position.y = 0.15;
      g.add(handle, head);
      g.position.set(itemData.x, itemData.y, itemData.z);
      scene.add(g);
      mesh = g;
    } else if (info.shape === 'key') {
      const g = new THREE.Group();
      const ring = new THREE.Mesh(new THREE.TorusGeometry(0.08, 0.02, 8, 16),
        new THREE.MeshLambertMaterial({ color: info.color }));
      const teeth = new THREE.Mesh(new THREE.BoxGeometry(0.18, 0.04, 0.04),
        new THREE.MeshLambertMaterial({ color: info.color }));
      teeth.position.set(0.09, -0.06, 0);
      const t2 = new THREE.Mesh(new THREE.BoxGeometry(0.06, 0.04, 0.04),
        new THREE.MeshLambertMaterial({ color: info.color }));
      t2.position.set(0.15, -0.1, 0);
      g.add(ring, teeth, t2);
      g.position.set(itemData.x, itemData.y, itemData.z);
      scene.add(g);
      mesh = g;
    } else {
      const geo = new THREE.BoxGeometry(0.08, 0.35, 0.05);
      mesh = new THREE.Mesh(geo, new THREE.MeshLambertMaterial({ color: info.color }));
      mesh.position.set(itemData.x, itemData.y, itemData.z);
      scene.add(mesh);
    }

    // Glow + bob animation stored in userData
    mesh.userData.itemId = itemData.id;
    mesh.userData.itemType = itemData.type;
    mesh.userData.bobOffset = Math.random() * Math.PI * 2;
    mesh.userData.baseY = itemData.y;
    mesh.userData.interactable = true;
    mesh.userData.type = 'item';
    interactables.push({ id: itemData.id, x: itemData.x, y: itemData.y, z: itemData.z, type: 'item', itemType: itemData.type, mesh, radius: 1.5 });
    return mesh;
  }

  function build(scene) {
    loadTextures();
    interactables.length = 0;
    hidingSpots.length = 0;

    // ========== GROUND FLOOR ==========

    // Hallway / Entrance (center)
    addRoom(scene, 0, 0, 5, 6, 'hallway', {
      doors: { north: { width: 1.3 }, south: { width: 1.3 }, east: { width: 1.2 }, west: { width: 1.2 } }
    });

    // Living Room (west of hallway)
    addRoom(scene, -8, 0, 8, 8, 'living_room', {
      doors: { east: { width: 1.2 }, north: { width: 1.2 } }
    });
    addFurniture(scene, -9, 0, 1, 'sofa');
    addFurniture(scene, -8, 0, -1, 'table');
    addFurniture(scene, -7, 0, -1.8, 'chair');
    addFurniture(scene, -9, 0, -1.8, 'chair');
    addFurniture(scene, -11.5, 0, 0, 'bookshelf');

    // Kitchen (east of hallway)
    addRoom(scene, 8, 0, 8, 7, 'kitchen', {
      doors: { west: { width: 1.2 }, south: { width: 1.2 } }
    });
    addFurniture(scene, 9, 0, 0, 'table');
    addFurniture(scene, 8, 0, 1, 'chair');
    addFurniture(scene, 10, 0, 1, 'chair');
    addFurniture(scene, 8, 0, -1, 'chair');
    // Kitchen counters
    const counterMat = new THREE.MeshLambertMaterial({ color: 0x888877 });
    box(scene, 2, 0.9, 0.6, 11, 0.45, -2.5, counterMat);
    box(scene, 2, 0.9, 0.6, 11, 0.45, 2.5, counterMat);

    // Bathroom (north-east)
    addRoom(scene, 8, -8, 5, 5, 'bathroom', {
      doors: { south: { width: 1.1 } }
    });
    addFurniture(scene, 9.5, 0, -9, 'bathtub');
    addFurniture(scene, 6.5, 0, -7, 'toilet');

    // Bedroom (north-west)
    addRoom(scene, -8, -8, 8, 6, 'bedroom', {
      doors: { south: { width: 1.2 }, east: { width: 1.1 } }
    });
    addFurniture(scene, -9, 0, -9, 'bed');
    addFurniture(scene, -5, 0, -8, 'wardrobe');
    addFurniture(scene, -11, 0, -7, 'table');

    // ========== DOORS ==========
    // Living room <-> Hallway
    addDoor(scene, -2.5, 0, 0, 0, 'hallway_living', false);
    // Kitchen <-> Hallway
    addDoor(scene, 2.5, 0, 0, 0, 'hallway_kitchen', false);
    // Bathroom door (with planks!)
    addDoor(scene, 8, 0, -5.5, Math.PI/2, 'bathroom', true);
    // Bedroom door
    addDoor(scene, -4, 0, -5, 0, 'bedroom', false);
    // Bedroom <-> Bathroom
    addDoor(scene, -4, 0, -8, Math.PI/2, 'bedroom_bathroom', false);

    // ========== BASEMENT ==========
    addRoom(scene, -8, 12, 10, 8, 'basement', {
      doors: { north: { width: 1.2 } }
    });
    // Basement floor lower
    addFurniture(scene, -9, 0, 14, 'barrel');
    addFurniture(scene, -7, 0, 14, 'barrel');
    addFurniture(scene, -6, 0, 13, 'crate');
    addFurniture(scene, -10, 0, 13, 'crate');
    // Basement door (locked with key!)
    addDoor(scene, -8, 0, 8.1, 0, 'basement', false);

    // ========== GARAGE/SHED (south) ==========
    addRoom(scene, 0, 10, 6, 5, 'garage', {
      doors: { north: { width: 1.3 } }
    });
    addFurniture(scene, 1, 0, 11, 'barrel');
    addFurniture(scene, -2, 0, 12, 'crate');
    // Garage door (padlocked)
    addDoor(scene, 0, 0, 7.6, 0, 'garage', false);

    // ========== ATTIC (upstairs via ladder) ==========
    // We represent attic as a raised platform room
    addRoom(scene, 15, -5, 7, 6, 'attic', {
      doors: { west: { width: 1.2 } }
    });
    addFurniture(scene, 16, 0, -5, 'crate');
    addFurniture(scene, 14, 0, -4, 'crate');
    addFurniture(scene, 17, 0, -6, 'barrel');
    // Attic access door (with planks!)
    addDoor(scene, 11.4, 0, -5, Math.PI/2, 'attic', true);

    // ========== VERWÜSTUNG - Schutt, Trümmer, Blut ==========
    addWreckage(scene);

    // ========== LIGHTING ==========
    addLighting(scene);

    // ========== EXIT DOOR ==========
    addExitDoor(scene);

    return { interactables, hidingSpots };
  }

  function addWreckage(scene) {
    const debrisMat  = (c) => new THREE.MeshLambertMaterial({ color: c });
    const bloodMat   = new THREE.MeshLambertMaterial({ color: 0x5a0000, transparent: true, opacity: 0.85 });
    const concreteMat= new THREE.MeshLambertMaterial({ color: 0x2a2520 });
    const woodMat    = new THREE.MeshLambertMaterial({ color: 0x2a1808 });

    // ── Mauerteile/Betonbrocken am Boden ──
    const chunkPositions = [
      [-3,0.1,1],[-7,0.08,-3],[2,0.12,3],[5,0.1,-1],[-11,0.09,3],
      [9,0.1,2],[-9,0.08,-10],[6,0.11,-9],[13,0.1,-6],[-7,0.09,13],
      [1,0.1,11],[-4,0.11,9],[16,0.08,-3],[3,0.12,-8]
    ];
    chunkPositions.forEach(([x,y,z]) => {
      const w = 0.15+Math.random()*0.5, h = 0.08+Math.random()*0.18, d = 0.15+Math.random()*0.45;
      const m = box(scene, w, h, d, x+(Math.random()-.5)*.4, y, z+(Math.random()-.5)*.4, concreteMat, false);
      m.rotation.y = Math.random()*Math.PI;
      m.rotation.z = (Math.random()-.5)*.3;
    });

    // ── Zerbrochene Holzplanken ──
    const plankPos = [
      [-6,0.04,2,0.4],[3,0.04,-2,0.9],[8,0.04,3,0.2],
      [-10,0.04,-6,1.1],[-2,0.04,8,0.7],[14,0.04,-7,0.3]
    ];
    plankPos.forEach(([x,y,z,rot]) => {
      const p = box(scene, 0.08, 0.06, 0.8+Math.random()*0.6, x, y, z, woodMat, false);
      p.rotation.y = rot;
    });

    // ── Blutlachen (flache Scheiben am Boden) ──
    const bloodPos = [
      [1,0.02,1], [-8,0.02,0], [7,0.02,-7], [-5,0.02,-9],
      [0,0.02,9],  [15,0.02,-5],[-8,0.02,12]
    ];
    bloodPos.forEach(([x,y,z]) => {
      const r = 0.3 + Math.random()*0.8;
      const geo = new THREE.CylinderGeometry(r, r*0.8, 0.02, 12);
      const mesh = new THREE.Mesh(geo, bloodMat);
      mesh.scale.x = 0.6 + Math.random()*0.8;
      mesh.position.set(x, y, z);
      scene.add(mesh);
      // Blutspritzer-Tropfen drumherum
      for (let i = 0; i < 4; i++) {
        const sr = 0.04+Math.random()*0.1;
        const sg = new THREE.CylinderGeometry(sr,sr,0.015,8);
        const sm = new THREE.Mesh(sg, bloodMat);
        sm.position.set(x+(Math.random()-.5)*r*2.5, 0.015, z+(Math.random()-.5)*r*2.5);
        scene.add(sm);
      }
    });

    // ── Wandrisse / abgeplatzter Putz (flache Boxen an Wänden) ──
    const crackMat = new THREE.MeshLambertMaterial({ color: 0x111008 });
    const cracks = [
      [-12,1.5,0,0.05,1.2,0.4,0], [12,1.2,0,0.05,0.8,0.3,0],
      [0,1.0,-3,0.3,0.6,0.05,0],   [-8,2.0,-4,0.05,0.5,0.3,0],
      [8,0.8,-11.5,0.4,0.3,0.05,0],[0,1.4,3.1,0.5,0.4,0.05,0]
    ];
    cracks.forEach(([x,y,z,w,h,d]) => {
      const m = box(scene, w,h,d, x,y,z, crackMat, false);
      m.rotation.z = (Math.random()-.5)*.4;
    });

    // ── Herunterhängende Kabel / Drähte ──
    const wireMat = new THREE.MeshLambertMaterial({ color: 0x111111 });
    [[0,3.2,0],[8,3.2,-8],[-8,3.2,-8]].forEach(([x,y,z]) => {
      for (let i = 0; i < 3; i++) {
        const wire = box(scene, 0.02, 0.4+Math.random()*0.8, 0.02,
          x+(Math.random()-.5)*1.5, y-0.2-Math.random()*0.5, z+(Math.random()-.5)*1.5, wireMat, false);
        wire.rotation.z = (Math.random()-.5)*.5;
      }
    });

    // ── Umgeworfene Möbelreste ──
    const furnitureMat = new THREE.MeshLambertMaterial({ color: 0x1a1008 });
    // Zerbrochener Tisch (auf Seite liegend)
    const bt = box(scene, 1.0, 0.05, 0.8, -3, 0.3, 3, furnitureMat, false);
    bt.rotation.z = Math.PI/2 + 0.2;
    bt.rotation.y = 0.8;
    // Stuhl umgeworfen
    const bc = box(scene, 0.45, 0.04, 0.45, 4, 0.22, -3, furnitureMat, false);
    bc.rotation.x = Math.PI/2;
    bc.rotation.y = 1.2;
    // Bücherregal umgefallen
    const bsh = box(scene, 0.15, 1.8, 1.0, 6, 0.07, 2, furnitureMat, false);
    bsh.rotation.z = Math.PI/2;

    // ── Zerbrochenes Glas / Scherben ──
    const glassMat = new THREE.MeshLambertMaterial({ color: 0x334455, transparent:true, opacity:0.5 });
    [[-4,0.01,-1],[9,0.01,1],[2,0.01,-10]].forEach(([x,y,z]) => {
      for (let i = 0; i < 6; i++) {
        const sg = new THREE.BoxGeometry(0.05+Math.random()*0.12, 0.015, 0.04+Math.random()*0.1);
        const sm = new THREE.Mesh(sg, glassMat);
        sm.position.set(x+(Math.random()-.5)*.5, y, z+(Math.random()-.5)*.5);
        sm.rotation.y = Math.random()*Math.PI;
        scene.add(sm);
      }
    });
  }

  function addLighting(scene) {
    // Ambient hell genug damit man was sieht, aber noch gruselig
    const ambient = new THREE.AmbientLight(0x998866, 0.6);
    scene.add(ambient);

    // Helles Hemisphärenlicht (oben warm, unten kühl)
    const hemi = new THREE.HemisphereLight(0xffcc88, 0x223322, 0.4);
    scene.add(hemi);

    // Raumlicht - grosse Reichweite damit alles sichtbar ist
    const lightPositions = [
      { x: 0,   z: 0  },
      { x: -8,  z: 0  },
      { x: 8,   z: 0  },
      { x: 8,   z: -8 },
      { x: -8,  z: -8 },
      { x: -8,  z: 12 },
      { x: 0,   z: 10 },
      { x: 15,  z: -5 }
    ];

    lightPositions.forEach((pos, i) => {
      // Intensität 1.5, Reichweite 18 damit der ganze Raum beleuchtet ist
      const light = new THREE.PointLight(0xffaa55, 1.5, 18);
      light.position.set(pos.x, WALL_HEIGHT - 0.3, pos.z);
      light.castShadow = false;
      light.userData.flicker = true;
      light.userData.flickerOffset = i * 0.7;
      light.userData.baseIntensity = 1.4;
      scene.add(light);

      // Glühbirne sichtbar
      const bulb = new THREE.Mesh(
        new THREE.SphereGeometry(0.1, 8, 8),
        new THREE.MeshBasicMaterial({ color: 0xffee99 })
      );
      bulb.position.set(pos.x, WALL_HEIGHT - 0.15, pos.z);
      scene.add(bulb);
    });

    // Mondlicht durch Fenster (stärker)
    const moon = new THREE.DirectionalLight(0x6688bb, 0.5);
    moon.position.set(-10, 20, -10);
    scene.add(moon);
  }

  function addExitDoor(scene) {
    const exitMat = new THREE.MeshLambertMaterial({ color: 0x004400 });
    const exitDoor = box(scene, 1.2, 2.4, 0.15, 0, 1.2, -3.1, exitMat);
    exitDoor.userData.type = 'exit';
    exitDoor.userData.interactable = true;
    // Exit sign
    const signMat = new THREE.MeshBasicMaterial({ color: 0x00ff00 });
    const sign = new THREE.Mesh(new THREE.BoxGeometry(0.6, 0.2, 0.05), signMat);
    sign.position.set(0, 2.8, -3.05);
    scene.add(sign);
    interactables.push({ id: 'exit_door', x: 0, y: 1.2, z: -3.1, type: 'exit', mesh: exitDoor, radius: 1.8 });
  }

  function updateFlicker(scene, time) {
    scene.traverse((obj) => {
      if (obj.isLight && obj.userData.flicker) {
        const base = obj.userData.baseIntensity || 1.4;
        const off = obj.userData.flickerOffset || 0;
        // Leichtes Flackern - nicht zu extrem
        const flicker = Math.sin(time * 3 + off) * 0.15 +
                        Math.sin(time * 7.3 + off) * 0.08 +
                        (Math.random() < 0.01 ? -(Math.random() * 0.8) : 0);
        obj.intensity = Math.max(0.6, base + flicker);
      }
    });
  }

  return { build, updateFlicker, interactables, hidingSpots };
})();
