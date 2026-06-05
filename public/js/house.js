// House builder - creates the 3D house using Three.js
const HouseBuilder = (() => {
  const WALL_HEIGHT = 3.5;
  const WALL_THICKNESS = 0.2;

  const textures = {};
  const interactables = [];
  const hidingSpots = [];

  function loadTextures(loader) {
    // Procedural textures via canvas
    textures.wall = makeCanvasTexture(128, 128, (ctx) => {
      ctx.fillStyle = '#c8b89a';
      ctx.fillRect(0, 0, 128, 128);
      // Brick pattern
      for (let y = 0; y < 128; y += 16) {
        for (let x = 0; x < 128; x += 32) {
          const ox = (Math.floor(y / 16) % 2) * 16;
          ctx.strokeStyle = '#9a8870';
          ctx.lineWidth = 1;
          ctx.strokeRect(x + ox + 1, y + 1, 30, 14);
          ctx.fillStyle = `hsl(30,25%,${65 + Math.random()*10}%)`;
          ctx.fillRect(x + ox + 2, y + 2, 28, 12);
        }
      }
    });
    textures.floor = makeCanvasTexture(128, 128, (ctx) => {
      ctx.fillStyle = '#6b5a3e';
      ctx.fillRect(0, 0, 128, 128);
      // Wood planks
      for (let y = 0; y < 128; y += 20) {
        ctx.fillStyle = `hsl(30,40%,${25 + Math.random()*10}%)`;
        ctx.fillRect(0, y + 1, 128, 18);
        ctx.strokeStyle = '#3a2a15';
        ctx.lineWidth = 1;
        ctx.strokeRect(0, y, 128, 19);
      }
    });
    textures.ceiling = makeCanvasTexture(64, 64, (ctx) => {
      ctx.fillStyle = '#d4cfc8';
      ctx.fillRect(0, 0, 64, 64);
      // Stains
      for (let i = 0; i < 5; i++) {
        ctx.fillStyle = `rgba(100,80,60,${0.05 + Math.random()*0.1})`;
        ctx.beginPath();
        ctx.arc(Math.random()*64, Math.random()*64, 5+Math.random()*10, 0, Math.PI*2);
        ctx.fill();
      }
    });
    textures.door = makeCanvasTexture(64, 128, (ctx) => {
      ctx.fillStyle = '#4a2e0e';
      ctx.fillRect(0, 0, 64, 128);
      // Panels
      ctx.fillStyle = '#5a3a18';
      ctx.fillRect(5, 5, 54, 50);
      ctx.fillRect(5, 65, 54, 58);
      ctx.strokeStyle = '#2a1a08';
      ctx.lineWidth = 2;
      ctx.strokeRect(5, 5, 54, 50);
      ctx.strokeRect(5, 65, 54, 58);
    });
    textures.plank = makeCanvasTexture(128, 32, (ctx) => {
      ctx.fillStyle = '#6b3c1a';
      ctx.fillRect(0, 0, 128, 32);
      ctx.strokeStyle = '#3a1a08';
      ctx.lineWidth = 2;
      for (let i = 0; i < 3; i++) {
        ctx.strokeRect(2, 2+i*10, 124, 8);
      }
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

    // ========== LIGHTING ==========
    addLighting(scene);

    // ========== EXIT DOOR ==========
    addExitDoor(scene);

    return { interactables, hidingSpots };
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
