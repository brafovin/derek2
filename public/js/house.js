// House builder - data-driven mit korrekter Kollision
const HouseBuilder = (() => {
  const WALL_H   = 3.5;   // Wandhöhe
  const WALL_T   = 0.2;   // Wanddicke
  const HW       = WALL_T / 2; // Halb-Dicke für Kollision

  const textures   = {};
  const interactables = [];
  const hidingSpots   = [];
  const collisionWalls = []; // AABB-Wände für Kollision

  // =====================================================================
  // LAYOUT DEFINITIONEN
  // Alle Räume als x1,z1,x2,z2 (Innenraum)
  // =====================================================================
  const ROOMS = {
    hallway:  { x1:-3,  z1:-3,  x2:3,   z2:4   },
    living:   { x1:-13, z1:-3,  x2:-3,  z2:5   },
    kitchen:  { x1:3,   z1:-3,  x2:13,  z2:5   },
    bedroom:  { x1:-13, z1:-11, x2:-3,  z2:-3  },
    bathroom: { x1:3,   z1:-11, x2:13,  z2:-3  },
    basement: { x1:-13, z1:4,   x2:4,   z2:14  },
    garage:   { x1:4,   z1:4,   x2:13,  z2:14  },
    attic:    { x1:14,  z1:-8,  x2:22,  z2:0   },
  };

  // Türen: Wo gibt es eine Öffnung in welcher Wand?
  // axis:'x' = Wand verläuft in Z-Richtung (steht parallel zur Z-Achse)
  // axis:'z' = Wand verläuft in X-Richtung
  // pos = Wandposition, span = Reichweite der Wand, gap = Türöffnung [von,bis]
  const DOOR_DEFS = [
    // Flur <-> Wohnzimmer  (Wand bei x=-3, Türlücke z∈[-0.9,0.9])
    { id:'hall_living',   axis:'x', pos:-3,  span:[-3, 5],   gap:[-0.9, 0.9],  locked:false, plank:false },
    // Flur <-> Küche       (Wand bei x=3)
    { id:'hall_kitchen',  axis:'x', pos:3,   span:[-3, 5],   gap:[-0.9, 0.9],  locked:false, plank:false },
    // Wohnzimmer <-> Schlafzimmer  (Wand bei z=-3, Türlücke x∈[-11,-9])
    { id:'living_bed',    axis:'z', pos:-3,  span:[-13,-3],  gap:[-11,-9],     locked:false, plank:false },
    // Küche <-> Bad        (Wand bei z=-3, Türlücke x∈[5,7])
    { id:'kitchen_bath',  axis:'z', pos:-3,  span:[3, 13],   gap:[5, 7],       locked:false, plank:true  },
    // Flur-Nord            (Wand bei z=-3 zwischen x=-3 und x=3, KEINE Tür)
    { id:'hall_north',    axis:'z', pos:-3,  span:[-3, 3],   gap:null,         locked:false, plank:false },
    // Flur <-> Keller      (Wand bei z=4, Türlücke x∈[-1,1])
    { id:'hall_basement', axis:'z', pos:4,   span:[-3, 3],   gap:[-1, 1],      locked:true,  plank:false },
    // Keller <-> Garage    (Wand bei x=4, Türlücke z∈[6.5,8.5])
    { id:'base_garage',   axis:'x', pos:4,   span:[4, 14],   gap:[6.5, 8.5],   locked:false, plank:false },
    // Dachboden Zugang     (Wand bei x=14, Türlücke z∈[-5,-3])
    { id:'attic_door',    axis:'x', pos:14,  span:[-8, 0],   gap:[-5, -3],     locked:false, plank:true  },
  ];

  // Äußere Wände (keine Türen)
  const OUTER_WALLS = [
    { axis:'z', pos:-11, span:[-13, 13] },   // Norden oben
    { axis:'z', pos:14,  span:[-13, 13] },   // Süden unten
    { axis:'x', pos:-13, span:[-11, 14] },   // Westen
    { axis:'x', pos:13,  span:[-11, 5]  },   // Osten (Räume)
    { axis:'x', pos:22,  span:[-8, 0]   },   // Dachboden Ost
    { axis:'z', pos:-8,  span:[14, 22]  },   // Dachboden Nord
    { axis:'z', pos:0,   span:[14, 22]  },   // Dachboden Süd
    { axis:'z', pos:5,   span:[-13, -3] },   // Wohnzimmer Süd
    { axis:'z', pos:5,   span:[3, 13]   },   // Küche Süd
    { axis:'z', pos:4,   span:[-13, -3] },   // Keller Nord West
    { axis:'z', pos:4,   span:[3, 13]   },   // Keller Nord Ost
  ];

  // =====================================================================
  // TEXTUREN
  // =====================================================================
  function loadTextures() {
    textures.wall = makeCanvasTexture(256, 256, ctx => {
      ctx.fillStyle = '#3a3028';
      ctx.fillRect(0, 0, 256, 256);
      for (let y = 0; y < 256; y += 18) {
        for (let x = 0; x < 256; x += 38) {
          const ox = (Math.floor(y/18)%2)*19;
          const s = 22 + Math.floor(Math.random()*10);
          ctx.fillStyle = `hsl(25,14%,${s}%)`;
          ctx.fillRect(x+ox+1, y+1, 35, 16);
        }
      }
      // Risse
      ctx.strokeStyle='rgba(0,0,0,0.6)'; ctx.lineWidth=1.5;
      for(let i=0;i<6;i++){
        ctx.beginPath();
        let cx=Math.random()*256, cy=Math.random()*256;
        ctx.moveTo(cx,cy);
        for(let j=0;j<5;j++){cx+=(Math.random()-.5)*28;cy+=Math.random()*18;ctx.lineTo(cx,cy);}
        ctx.stroke();
      }
      // Blutspritzer
      for(let i=0;i<3;i++){
        ctx.fillStyle=`rgba(100,0,0,${0.2+Math.random()*0.4})`;
        ctx.beginPath();
        ctx.ellipse(Math.random()*256,Math.random()*256,4+Math.random()*10,2+Math.random()*5,Math.random()*Math.PI,0,Math.PI*2);
        ctx.fill();
      }
    });

    textures.floor = makeCanvasTexture(256, 256, ctx => {
      ctx.fillStyle = '#1e1510';
      ctx.fillRect(0, 0, 256, 256);
      for(let y=0;y<256;y+=22){
        ctx.fillStyle=`hsl(28,32%,${12+Math.floor(Math.random()*8)}%)`;
        ctx.fillRect(0,y+1,256,20);
        ctx.strokeStyle='#0a0806';ctx.lineWidth=2;
        ctx.beginPath();ctx.moveTo(0,y);ctx.lineTo(256,y);ctx.stroke();
      }
      // Blutlachen
      for(let i=0;i<4;i++){
        if(Math.random()<0.6){
          const grd=ctx.createRadialGradient(Math.random()*256,Math.random()*256,0,128,128,20+Math.random()*40);
          grd.addColorStop(0,'rgba(130,0,0,0.75)');
          grd.addColorStop(1,'rgba(0,0,0,0)');
          ctx.fillStyle=grd;ctx.fillRect(0,0,256,256);
        }
      }
    });

    textures.ceiling = makeCanvasTexture(128, 128, ctx => {
      ctx.fillStyle='#2a2520';ctx.fillRect(0,0,128,128);
      for(let i=0;i<6;i++){
        ctx.fillStyle=`rgba(15,${15+Math.random()*15},8,${0.25+Math.random()*0.35})`;
        ctx.beginPath();ctx.arc(Math.random()*128,Math.random()*128,6+Math.random()*18,0,Math.PI*2);ctx.fill();
      }
    });

    textures.door = makeCanvasTexture(64, 128, ctx => {
      ctx.fillStyle='#150c04';ctx.fillRect(0,0,64,128);
      ctx.fillStyle='#1e1208';
      ctx.fillRect(4,4,56,52);ctx.fillRect(4,64,56,60);
      ctx.strokeStyle='#080402';ctx.lineWidth=2;
      ctx.strokeRect(4,4,56,52);ctx.strokeRect(4,64,56,60);
    });

    textures.plank = makeCanvasTexture(128, 32, ctx => {
      ctx.fillStyle='#2e1404';ctx.fillRect(0,0,128,32);
      ctx.strokeStyle='#150a02';ctx.lineWidth=2;
      for(let i=0;i<3;i++)ctx.strokeRect(2,2+i*10,124,8);
      ctx.fillStyle='#555';
      [12,64,116].forEach(nx=>{ctx.beginPath();ctx.arc(nx,6,2,0,Math.PI*2);ctx.fill();});
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

  // =====================================================================
  // MATERIAL HELPERS
  // =====================================================================
  function wallMat(rep=3) {
    const t = textures.wall.clone(); t.needsUpdate=true; t.repeat.set(rep,1);
    return new THREE.MeshBasicMaterial({ map:t, side:THREE.DoubleSide });
  }
  function floorMat(rep=4) {
    const t = textures.floor.clone(); t.needsUpdate=true; t.repeat.set(rep,rep);
    return new THREE.MeshBasicMaterial({ map:t, side:THREE.DoubleSide });
  }
  function ceilMat() {
    const t = textures.ceiling.clone(); t.needsUpdate=true; t.repeat.set(3,3);
    return new THREE.MeshBasicMaterial({ map:t, side:THREE.DoubleSide });
  }
  function solidMat(color) {
    return new THREE.MeshBasicMaterial({ color, side:THREE.DoubleSide });
  }

  // =====================================================================
  // GEOMETRIE HELPERS
  // =====================================================================
  function box(scene, w, h, d, x, y, z, mat) {
    const mesh = new THREE.Mesh(new THREE.BoxGeometry(w,h,d), mat);
    mesh.position.set(x,y,z);
    scene.add(mesh);
    return mesh;
  }

  // =====================================================================
  // WAND ERZEUGEN (visuell + Kollision)
  // =====================================================================
  function buildWallSegment(scene, axis, pos, from, to, mat) {
    const cx = axis==='x' ? pos : (from+to)/2;
    const cz = axis==='z' ? pos : (from+to)/2;
    const len = Math.abs(to - from);
    const w   = axis==='x' ? WALL_T : len;
    const d   = axis==='z' ? WALL_T : len;
    box(scene, w, WALL_H, d, cx, WALL_H/2, cz, mat);

    // Kollisions-AABB hinzufügen
    if(axis==='x'){
      collisionWalls.push({ x1:pos-HW, z1:Math.min(from,to), x2:pos+HW, z2:Math.max(from,to) });
    } else {
      collisionWalls.push({ x1:Math.min(from,to), z1:pos-HW, x2:Math.max(from,to), z2:pos+HW });
    }
  }

  // Wand mit optionaler Türlücke aufbauen
  function buildWallWithGap(scene, axis, pos, span, gap, mat) {
    const [s1, s2] = span;
    if(!gap){
      buildWallSegment(scene, axis, pos, s1, s2, mat);
    } else {
      const [g1,g2] = gap;
      if(s1 < g1)  buildWallSegment(scene, axis, pos, s1, g1, mat);
      if(g2 < s2)  buildWallSegment(scene, axis, pos, g2, s2, mat);
      // Oberer Türstreifen
      const ctr = axis==='x' ? { x:pos, z:(g1+g2)/2 } : { x:(g1+g2)/2, z:pos };
      const dw = g2 - g1;
      const bw = axis==='x' ? WALL_T : dw;
      const bd = axis==='z' ? WALL_T : dw;
      box(scene, bw, WALL_H-2.2, bd, ctr.x, WALL_H-0.6, ctr.z, mat);
    }
  }

  // =====================================================================
  // BODEN + DECKE FÜR EINEN RAUM
  // =====================================================================
  function buildRoomFloorCeil(scene, room) {
    const cx = (room.x1+room.x2)/2;
    const cz = (room.z1+room.z2)/2;
    const w  = room.x2 - room.x1;
    const d  = room.z2 - room.z1;
    const r  = Math.max(w,d)/3;
    box(scene, w, 0.1, d, cx, 0.05, cz, floorMat(r));
    box(scene, w, 0.1, d, cx, WALL_H, cz, ceilMat());
  }

  // =====================================================================
  // TÜRRAHMEN + TÜRBLATT
  // =====================================================================
  function buildDoor(scene, axis, pos, gap, doorId, plank) {
    const [g1, g2] = gap;
    const dw  = g2 - g1;
    const mid = (g1+g2)/2;
    const cx  = axis==='x' ? pos : mid;
    const cz  = axis==='z' ? pos : mid;
    const rotY = axis==='z' ? 0 : Math.PI/2;

    // Türblatt
    const doorMat = new THREE.MeshBasicMaterial({ map:textures.door, side:THREE.DoubleSide });
    const doorMesh = box(scene, dw*0.9, 2.2, 0.06, cx, 1.1, cz, doorMat);
    doorMesh.rotation.y = rotY;
    doorMesh.userData.doorId = doorId;
    doorMesh.userData.type   = 'door';
    interactables.push({ id:'door_'+doorId, x:cx, y:1.1, z:cz, type:'door', mesh:doorMesh, radius:1.8 });

    // Rahmen
    const frMat = solidMat(0x1a0e05);
    const fw = axis==='z' ? dw+0.14 : 0.08;
    const fd = axis==='x' ? dw+0.14 : 0.08;
    // Links
    const fL = box(scene, axis==='x'?0.08:0.08, 2.4, axis==='z'?0.08:0.08,
      axis==='x'?pos:g1-0.05, 1.2, axis==='z'?pos:g1-0.05, frMat);
    // Rechts
    box(scene, axis==='x'?0.08:0.08, 2.4, axis==='z'?0.08:0.08,
      axis==='x'?pos:g2+0.05, 1.2, axis==='z'?pos:g2+0.05, frMat);
    // Oben
    box(scene, fw, 0.1, fd, cx, 2.25, cz, frMat);

    if(plank) buildPlank(scene, cx, cz, rotY, doorId);
  }

  function buildPlank(scene, x, z, rotY, doorId) {
    const pMat = new THREE.MeshBasicMaterial({ map:textures.plank, side:THREE.DoubleSide });
    const g = new THREE.Group();
    const angles = [0.3, -0.25, 0.1];
    const heights = [0.5, 0.9, 1.5];
    angles.forEach((a,i)=>{
      const p = new THREE.Mesh(new THREE.BoxGeometry(1.1, 0.14, 0.07), pMat);
      p.position.y = heights[i]; p.rotation.z = a;
      g.add(p);
    });
    g.position.set(x, 0, z);
    g.rotation.y = rotY;
    g.userData.type   = 'plank';
    g.userData.doorId = doorId;
    scene.add(g);
    interactables.push({ id:'plank_'+doorId, x, y:0.9, z, type:'plank', mesh:g, radius:1.6 });
  }

  // =====================================================================
  // MÖBEL
  // =====================================================================
  function addFurniture(scene, x, _y, z, type) {
    const m = c => new THREE.MeshBasicMaterial({ color:c });

    switch(type){
      case 'bed':{
        box(scene,1.8,0.4,2.8, x,0.2,z, m(0x3a2a1a));
        box(scene,1.8,0.55,2.8, x,0.62,z, m(0xccbbaa));
        box(scene,1.8,0.75,0.18, x,0.77,z-1.35, m(0x3a2a1a));
        hidingSpots.push({ id:'hide_bed_'+x+'_'+z, x, z, radius:1.2, type:'bed' });
        break;
      }
      case 'wardrobe':{
        const wm = box(scene,1.4,2.2,0.6, x,1.1,z, m(0x2a1a0a));
        wm.userData.type='wardrobe';
        hidingSpots.push({ id:'hide_wardrobe_'+x+'_'+z, x, z, radius:0.9, type:'wardrobe' });
        interactables.push({ id:'wardrobe_'+x+'_'+z, x, y:1.1, z, type:'wardrobe', mesh:wm, radius:1.5 });
        break;
      }
      case 'table':{
        [[-0.38,-0.38],[0.38,-0.38],[-0.38,0.38],[0.38,0.38]].forEach(([dx,dz])=>{
          box(scene,0.06,0.7,0.06, x+dx,0.35,z+dz, m(0x4a2a10));
        });
        box(scene,1.0,0.06,0.8, x,0.73,z, m(0x5a3a1a));
        break;
      }
      case 'chair':{
        box(scene,0.48,0.05,0.48, x,0.44,z, m(0x4a2a10));
        box(scene,0.48,0.8,0.06, x,0.82,z-0.21, m(0x4a2a10));
        [[-0.18,-0.18],[0.18,-0.18],[-0.18,0.18],[0.18,0.18]].forEach(([dx,dz])=>{
          box(scene,0.05,0.4,0.05, x+dx,0.2,z+dz, m(0x4a2a10));
        });
        break;
      }
      case 'sofa':{
        box(scene,2.4,0.4,1.0, x,0.2,z, m(0x2a2a44));
        box(scene,2.4,0.5,0.22, x,0.55,z+0.35, m(0x2a2a44));
        box(scene,0.22,0.65,1.0, x-1.09,0.52,z, m(0x2a2a44));
        box(scene,0.22,0.65,1.0, x+1.09,0.52,z, m(0x2a2a44));
        hidingSpots.push({ id:'hide_sofa_'+x+'_'+z, x, z, radius:1.2, type:'sofa' });
        break;
      }
      case 'bathtub':{
        box(scene,1.6,0.4,0.8, x,0.2,z, m(0xbbbbbb));
        box(scene,0.09,0.32,0.65, x-0.75,0.37,z, m(0xbbbbbb));
        box(scene,0.09,0.32,0.65, x+0.75,0.37,z, m(0xbbbbbb));
        box(scene,1.42,0.09,0.55, x,0.44,z, m(0x8899bb));
        hidingSpots.push({ id:'hide_bathtub_'+x+'_'+z, x, z, radius:1.0, type:'bathtub' });
        break;
      }
      case 'toilet':{
        box(scene,0.38,0.34,0.55, x,0.17,z, m(0xdddddd));
        box(scene,0.38,0.08,0.45, x,0.36,z, m(0xcccccc));
        box(scene,0.38,0.65,0.14, x,0.54,z+0.22, m(0xdddddd));
        break;
      }
      case 'bookshelf':{
        box(scene,0.14,2.0,1.1, x,1.0,z, m(0x3a2010));
        const cols=[0x8b0000,0x003388,0x006600,0x887700,0x660088];
        for(let i=0;i<4;i++){
          box(scene,0.11,0.22,1.0, x,0.32+i*0.48,z, m(0x4a2a10));
          let bz=z-0.48;
          for(let b=0;b<7;b++){
            const bw=0.06+Math.random()*0.05;
            box(scene,0.1,0.2,bw, x,0.45+i*0.48,bz+bw/2, m(cols[b%cols.length]));
            bz+=bw+0.01;
          }
        }
        break;
      }
      case 'barrel':{
        const geo=new THREE.CylinderGeometry(0.28,0.28,0.75,10);
        const mesh=new THREE.Mesh(geo, m(0x4a2a10));
        mesh.position.set(x,0.37,z); scene.add(mesh); break;
      }
      case 'crate':{
        box(scene,0.7,0.7,0.7, x,0.35,z, m(0x5a3a1a));
        hidingSpots.push({ id:'hide_crate_'+x+'_'+z, x, z, radius:0.7, type:'crate' });
        break;
      }
    }
  }

  // =====================================================================
  // ITEMS
  // =====================================================================
  function buildItemMesh(scene, itemData) {
    const color = itemData.color || { hammer:0x888888, key:0xffcc00, screwdriver:0x4455ff, wirecutters:0xff4444 }[itemData.type] || 0xffffff;
    let mesh;
    if(itemData.type==='hammer'){
      const g=new THREE.Group();
      g.add(Object.assign(new THREE.Mesh(new THREE.BoxGeometry(0.07,0.42,0.07),new THREE.MeshBasicMaterial({color:0x7a3a00})),{position:new THREE.Vector3(0,-0.08,0)}));
      const h=new THREE.Mesh(new THREE.BoxGeometry(0.24,0.12,0.1),new THREE.MeshBasicMaterial({color:0x888888}));
      h.position.y=0.17; g.add(h); mesh=g;
    } else if(itemData.type==='key'){
      const g=new THREE.Group();
      g.add(new THREE.Mesh(new THREE.TorusGeometry(0.09,0.02,8,16),new THREE.MeshBasicMaterial({color})));
      const t=new THREE.Mesh(new THREE.BoxGeometry(0.2,0.05,0.04),new THREE.MeshBasicMaterial({color}));
      t.position.set(0.1,-0.06,0); g.add(t); mesh=g;
    } else {
      mesh=new THREE.Mesh(new THREE.BoxGeometry(0.1,0.32,0.07),new THREE.MeshBasicMaterial({color}));
    }
    mesh.position.set(itemData.x, itemData.y, itemData.z);
    mesh.userData.itemId=itemData.id; mesh.userData.itemType=itemData.type;
    mesh.userData.bobOffset=Math.random()*Math.PI*2; mesh.userData.baseY=itemData.y;
    scene.add(mesh); return mesh;
  }

  // =====================================================================
  // BELEUCHTUNG
  // =====================================================================
  function addLighting(scene){
    scene.add(new THREE.AmbientLight(0xaa8855, 0.8));
    scene.add(new THREE.HemisphereLight(0xffcc88, 0x221a10, 0.5));

    // Lampen in jedem Raum
    const lamps=[
      [0,1.5],[- 8,1],[ 8,1],[-8,-7],[8,-7],[-5,9],[8,9],[18,-4]
    ];
    lamps.forEach(([lx,lz],i)=>{
      const pl=new THREE.PointLight(0xffaa55,1.6,22);
      pl.position.set(lx,WALL_H-0.3,lz);
      pl.userData.flicker=true;
      pl.userData.flickerOffset=i*0.8;
      pl.userData.baseIntensity=1.5;
      scene.add(pl);
      const bulb=new THREE.Mesh(new THREE.SphereGeometry(0.09,8,8),new THREE.MeshBasicMaterial({color:0xffee99}));
      bulb.position.set(lx,WALL_H-0.15,lz); scene.add(bulb);
    });
    scene.add(Object.assign(new THREE.DirectionalLight(0x5577bb,0.4),{position:new THREE.Vector3(-15,20,-10)}));
  }

  // =====================================================================
  // HAUPTBUILD FUNKTION
  // =====================================================================
  function build(scene){
    loadTextures();
    interactables.length  = 0;
    hidingSpots.length    = 0;
    collisionWalls.length = 0;

    const wm = wallMat();

    // ── Böden + Decken aller Räume ──
    for(const r of Object.values(ROOMS)) buildRoomFloorCeil(scene, r);

    // ── Äußere Wände ──
    for(const w of OUTER_WALLS){
      buildWallWithGap(scene, w.axis, w.pos, w.span, null, wm);
    }

    // ── Innenwände mit Türen ──
    for(const d of DOOR_DEFS){
      buildWallWithGap(scene, d.axis, d.pos, d.span, d.gap, wm);
      if(d.gap){
        buildDoor(scene, d.axis, d.pos, d.gap, d.id, d.plank);
      }
    }

    // ── Möbel ──
    // Wohnzimmer
    addFurniture(scene,-9,0,1,'sofa');
    addFurniture(scene,-9,0,-1.5,'table');
    addFurniture(scene,-7,0,-2,'chair');
    addFurniture(scene,-11,0,-2,'chair');
    addFurniture(scene,-12.2,0,0,'bookshelf');
    // Küche
    addFurniture(scene,8,0,0.5,'table');
    addFurniture(scene,7,0,1.5,'chair');
    addFurniture(scene,9,0,1.5,'chair');
    box(scene,2,0.9,0.6, 12,0.45,-2, solidMat(0x777766));
    box(scene,2,0.9,0.6, 12,0.45,2, solidMat(0x777766));
    // Schlafzimmer
    addFurniture(scene,-10,0,-8,'bed');
    addFurniture(scene,-5.5,0,-9,'wardrobe');
    addFurniture(scene,-11.5,0,-6,'table');
    addFurniture(scene,-10.5,0,-6,'chair');
    // Bad
    addFurniture(scene,11,0,-9,'bathtub');
    addFurniture(scene,5.5,0,-7,'toilet');
    // Keller
    addFurniture(scene,-10,0,11,'barrel');
    addFurniture(scene,-8,0,12,'barrel');
    addFurniture(scene,-5,0,12,'crate');
    addFurniture(scene,-11,0,12,'crate');
    addFurniture(scene,-3,0,11,'crate');
    // Garage
    addFurniture(scene,8,0,11,'barrel');
    addFurniture(scene,6,0,12,'crate');
    addFurniture(scene,10,0,12,'crate');
    // Dachboden
    addFurniture(scene,16,0,-5,'crate');
    addFurniture(scene,19,0,-3,'crate');
    addFurniture(scene,20,0,-6,'barrel');
    addFurniture(scene,15,0,-7,'barrel');

    // ── Exit Tür (Ausgang) ──
    const exitMat = new THREE.MeshBasicMaterial({ color:0x003300, side:THREE.DoubleSide });
    const exitDoor = box(scene, 1.2, 2.4, 0.12, 0, 1.2, -3.05, exitMat);
    exitDoor.userData.type='exit';
    interactables.push({ id:'exit_door', x:0, y:1.2, z:-3.05, type:'exit', mesh:exitDoor, radius:1.8 });
    // Exit-Schild
    const sign=new THREE.Mesh(new THREE.BoxGeometry(0.7,0.22,0.05),new THREE.MeshBasicMaterial({color:0x00cc00}));
    sign.position.set(0,2.9,-2.98); scene.add(sign);

    // ── Beleuchtung ──
    addLighting(scene);

    // ── Verwüstung (optional, in try/catch) ──
    try{ addWreckage(scene); }catch(e){ console.warn('Wreckage skip:',e.message); }

    return { interactables, hidingSpots, collisionWalls };
  }

  // =====================================================================
  // VERWÜSTUNGS-DEKO
  // =====================================================================
  function addWreckage(scene){
    const cm = solidMat(0x1e1a14);
    const bm = new THREE.MeshBasicMaterial({ color:0x440000, transparent:true, opacity:0.8 });
    const wm2 = solidMat(0x1e0e04);

    // Betonbrocken
    [[-3,1],[-7,-2],[2,3],[5,-1],[-11,3],[9,2],[-9,10],[6,-9],[16,-3],[0,9]].forEach(([x,z])=>{
      const m=box(scene,0.15+Math.random()*0.4,0.06+Math.random()*0.15,0.15+Math.random()*0.35, x,0.04,z, cm);
      m.rotation.y=Math.random()*Math.PI; m.rotation.z=(Math.random()-.5)*.25;
    });
    // Blutlachen
    [[-1,0.01,0],[7,0.01,-8],[-5,0.01,-8],[0,0.01,9],[16,0.01,-5]].forEach(([x,y,z])=>{
      const r=0.35+Math.random()*0.7;
      const g2=new THREE.CylinderGeometry(r,r*0.7,0.018,10);
      const mesh=new THREE.Mesh(g2,bm); mesh.position.set(x,y,z); mesh.scale.x=0.6+Math.random()*.7;
      scene.add(mesh);
    });
    // Zerbrochene Planken
    [[-6,0.03,2,0.4],[3,0.03,-2,0.9],[8,0.03,3,0.2],[-10,0.03,-6,1.1]].forEach(([x,y,z,rot])=>{
      const p=box(scene,0.07,0.05,0.7+Math.random()*.5, x,y,z, wm2); p.rotation.y=rot;
    });
    // Kabel
    const wireMat=solidMat(0x111111);
    [[0,3.2,0],[8,3.2,-8],[-8,3.2,-8]].forEach(([x,y,z])=>{
      for(let i=0;i<3;i++){
        const w2=box(scene,0.02,0.35+Math.random()*.7,0.02,
          x+(Math.random()-.5)*1.2, y-0.2-Math.random()*.4, z+(Math.random()-.5)*1.2, wireMat);
        w2.rotation.z=(Math.random()-.5)*.5;
      }
    });
  }

  // =====================================================================
  // LICHT FLACKERN
  // =====================================================================
  function updateFlicker(scene, time){
    scene.traverse(obj=>{
      if(obj.isLight && obj.userData.flicker){
        const base = obj.userData.baseIntensity || 1.5;
        const off  = obj.userData.flickerOffset || 0;
        const fl   = Math.sin(time*3+off)*0.12 + Math.sin(time*7.3+off)*0.07
                   + (Math.random()<0.01 ? -Math.random()*0.7 : 0);
        obj.intensity = Math.max(0.7, base+fl);
      }
    });
  }

  // =====================================================================
  // PUBLIC API
  // =====================================================================
  return { build, updateFlicker, buildItemMesh, interactables, hidingSpots, collisionWalls };
})();

// Kompatibilität: addItem
HouseBuilder.addItem = function(scene, itemData){
  return HouseBuilder.buildItemMesh(scene, itemData);
};
