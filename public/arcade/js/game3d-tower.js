// ---- 3.3: "Tower of Precision" (מגדל הדיוק) — stack words into a skyscraper ----
// A crane lowers a block carrying a word. Type the word and the block drops onto
// the tower. A clean word lands perfectly; every typing mistake pushes the block
// sideways, and the overhang is sliced off — so the tower literally narrows with
// each error. Perfect streaks widen it again. Climb from the city through the
// clouds, sunset and night up to the stars. It makes accuracy visible.

const TOWER_DEF = {
    id: 'tower', icon: '🏗️', theme: 'g3-tower', music: 'tower',
    lifeIcon: '🧱', lifeIconOff: '▫️',
    title: () => t('מגדל הדיוק', 'Tower of Precision'),
    desc: () => t('מנוף מוריד בלוק ועליו מילה — הקלידו אותה והבלוק נוחת על המגדל. מילה נקייה נוחתת בדיוק; כל טעות מזיזה את הבלוק הצידה, והחלק הבולט נחתך. רצף מושלם מרחיב את המגדל שוב. טפסו מהעיר, דרך העננים והשקיעה — עד הכוכבים.', 'A crane lowers a block carrying a word — type it and the block lands on the tower. A clean word lands perfectly; every mistake pushes the block sideways and the overhang is sliced off. Perfect streaks widen the tower again. Climb from the city through the clouds and sunset — up to the stars.'),
    trains: () => t('מתאמן על: דיוק — כל טעות נראית מיד במגדל', 'Trains: accuracy — every mistake shows up in the tower'),
    keysHelp: () => t('הקלידו את המילה שעל הבלוק · Esc = השהיה', 'Type the word on the block · Esc = pause'),
    defaults: { content: 'auto' },
    options: () => [
        { key: 'content', label: t('תוכן', 'Content'), choices: [['auto', t('אוטומטי — לפי ההתקדמות שלי', 'Auto — based on my progress')], ['letters', t('צירופי אותיות שלמדתי', 'Letter clusters I learned')], ['short', t('מילים קצרות', 'Short words')], ['words', t('מילים', 'Words')], ['long', t('מילים ארוכות', 'Long words')], ['mixed', t('מעורב', 'Mixed')]] }
    ],
    startBanner: () => t('🏗️ מגדל הדיוק', '🏗️ Tower of Precision'),
    startSub: () => t('מילה נקייה = נחיתה מושלמת', 'A clean word = a perfect landing'),
    wordsLabel: () => t('קומות', 'Floors'),
    hudLevel: (S) => { const g = S.game && S.game._floors != null ? S.game : null; return g ? `🏢 ${g._floors} ${t('קומות', 'floors')} · ${g._floors * 3}${t('מ׳', 'm')}` : t('שלב', 'Level') + ' ' + S.level; },
    endExtra: (S) => {
        const a = S.towerStats; if (!a) return '';
        return `<p class="g3-endnote">🏢 ${t('גובה', 'Height')}: <b>${a.floors} ${t('קומות', 'floors')} (${a.floors * 3}${t('מ׳', 'm')})</b> · 🎯 ${t('נחיתות מושלמות', 'Perfect landings')}: <b>${a.perfect}</b>${a.floors ? ` (${Math.round(a.perfect / Math.max(1, a.drops) * 100)}%)` : ''} · ${t('רצף מושלם', 'Best perfect streak')}: <b>${a.bestStreak}</b>${a.golden ? ` · ✨ ${t('קומות זהב', 'Golden floors')}: <b>${a.golden}</b>` : ''}${a.express ? ` · ⚡ ${t('אקספרס', 'Express')}: <b>${a.express}</b>` : ''}</p>`;
    },
    onEnd: (S) => { const st = G3D.store().stats; const a = S.towerStats || {}; st.towerBest = Math.max(st.towerBest || 0, a.floors || 0); st.towerPerfect = (st.towerPerfect || 0) + (a.perfect || 0); },
    create: (api) => createTower(api)
};

function createTower(api) {
    const T = api.THREE, scene = api.scene, camera = api.camera, cfg = api.cfg, D = api.D, P = api.particles, Q = api.Q;
    const words = galaxyWordSource(cfg);
    const en = isEnglishTyping();

    const SKY = [[0, 0x8fd3ff], [40, 0x9fc4ff], [90, 0xffb27a], [140, 0x7a4c8f], [200, 0x141a44], [280, 0x03040c]];
    const skyCol = new T.Color(0x8fd3ff), tmpC = new T.Color();
    scene.background = skyCol;
    scene.fog = new T.Fog(0x8fd3ff, 60, 260);
    camera.fov = 55; camera.near = 0.1; camera.far = 1200; camera.updateProjectionMatrix();

    const hemi = new T.HemisphereLight(0xdff1ff, 0x6a5a40, 0.85); scene.add(hemi);
    const sun = new T.DirectionalLight(0xfff1dc, 1.3); sun.position.set(30, 60, 25); scene.add(sun);
    if (Q.shadows) { sun.castShadow = true; sun.shadow.mapSize.set(1024, 1024); const sc = sun.shadow.camera; sc.left = -20; sc.right = 20; sc.top = 20; sc.bottom = -20; sc.near = 1; sc.far = 200; }

    // ---- city ----
    const ground = new T.Mesh(new T.CircleGeometry(400, 48), new T.MeshStandardMaterial({ color: 0x5f7d4a, roughness: 1 }));
    ground.rotation.x = -Math.PI / 2; ground.receiveShadow = true; scene.add(ground);
    const plaza = new T.Mesh(new T.CylinderGeometry(14, 15, 0.6, 40), new T.MeshStandardMaterial({ color: 0x9a9284, roughness: 0.9 }));
    plaza.position.y = 0.3; plaza.receiveShadow = true; scene.add(plaza);
    const winTex = G3D.canvasTexture(64, 128, (ctx, w, h) => {
        ctx.fillStyle = '#5b6474'; ctx.fillRect(0, 0, w, h);
        for (let y = 6; y < h; y += 12) for (let x = 5; x < w; x += 12) { ctx.fillStyle = Math.random() < 0.55 ? '#ffe7a3' : '#26303f'; ctx.fillRect(x, y, 7, 7); }
    }, [1, 1]);
    const bN = Math.round(140 * Q.part) + 30;
    const bldg = new T.InstancedMesh(new T.BoxGeometry(1, 1, 1).translate(0, 0.5, 0), new T.MeshStandardMaterial({ map: winTex, roughness: 0.8, emissive: 0xffd27a, emissiveIntensity: 0, emissiveMap: winTex }), bN);
    const dm = new T.Object3D(), bc = new T.Color();
    for (let i = 0; i < bN; i++) {
        const a = Math.random() * Math.PI * 2, r = 24 + Math.pow(Math.random(), 0.7) * 140;
        const h = 4 + Math.random() * (r < 60 ? 26 : 14);
        dm.position.set(Math.cos(a) * r, 0, Math.sin(a) * r); dm.scale.set(4 + Math.random() * 6, h, 4 + Math.random() * 6); dm.rotation.y = Math.random() * 3; dm.updateMatrix();
        bldg.setMatrixAt(i, dm.matrix); bldg.setColorAt(i, bc.setHSL(0.58 + Math.random() * 0.1, 0.15, 0.55 + Math.random() * 0.3));
    }
    scene.add(bldg);
    // trees in the plaza ring
    for (let i = 0; i < 14; i++) {
        const a = i / 14 * Math.PI * 2, tr = new T.Group();
        const trunk = new T.Mesh(new T.CylinderGeometry(0.15, 0.2, 1.2, 6), new T.MeshStandardMaterial({ color: 0x6b4a2b })); trunk.position.y = 0.6; tr.add(trunk);
        const crown = new T.Mesh(new T.IcosahedronGeometry(0.9, 0), new T.MeshStandardMaterial({ color: 0x3f8a3a, flatShading: true })); crown.position.y = 1.7; tr.add(crown);
        tr.position.set(Math.cos(a) * 12.5, 0.6, Math.sin(a) * 12.5); scene.add(tr);
    }

    // clouds
    const cloudTex = G3D.canvasTexture(256, 128, (ctx, w, h) => {
        for (let i = 0; i < 9; i++) { const x = 40 + Math.random() * 176, y = 50 + Math.random() * 40, r = 25 + Math.random() * 30; const g = ctx.createRadialGradient(x, y, 0, x, y, r); g.addColorStop(0, 'rgba(255,255,255,0.95)'); g.addColorStop(1, 'rgba(255,255,255,0)'); ctx.fillStyle = g; ctx.fillRect(0, 0, w, h); }
    });
    const clouds = [];
    for (let i = 0; i < Math.round(40 * Q.part) + 10; i++) {
        const s = new T.Sprite(new T.SpriteMaterial({ map: cloudTex, transparent: true, depthWrite: false, opacity: 0.85 }));
        const a = Math.random() * Math.PI * 2, r = 18 + Math.random() * 70;
        s.position.set(Math.cos(a) * r, 30 + Math.random() * 170, Math.sin(a) * r); s.scale.set(24 + Math.random() * 20, 12 + Math.random() * 8, 1);
        scene.add(s); clouds.push({ s, v: 0.6 + Math.random() * 1.2 });
    }
    // stars (fade in high up)
    const starN = 1200, sp = new Float32Array(starN * 3);
    for (let i = 0; i < starN; i++) { const v = new T.Vector3().randomDirection().multiplyScalar(600); v.y = Math.abs(v.y) * 0.8 + 50; sp.set([v.x, v.y, v.z], i * 3); }
    const starGeo = new T.BufferGeometry(); starGeo.setAttribute('position', new T.BufferAttribute(sp, 3));
    const starMat = new T.PointsMaterial({ color: 0xffffff, size: 1.6, transparent: true, opacity: 0, fog: false, depthWrite: false });
    const stars = new T.Points(starGeo, starMat); scene.add(stars);

    // ---- tower ----
    const FH = 1.3, DEPTH = 5;
    const START_W = 6.4;
    const foundation = new T.Mesh(new T.BoxGeometry(START_W + 1, 1, DEPTH + 1), new T.MeshStandardMaterial({ color: 0x6c645a, roughness: 0.9 }));
    foundation.position.y = 1.1; foundation.receiveShadow = true; foundation.castShadow = true; scene.add(foundation);
    let topY = 1.6, topX = 0, width = START_W;
    const floors = [];
    const tower = new T.Group(); scene.add(tower);

    function blockMaterials(word, hue) {
        const col = new T.Color().setHSL(hue, 0.55, 0.58);
        const side = new T.MeshStandardMaterial({ color: col, roughness: 0.55, metalness: 0.1 });
        const face = new T.MeshStandardMaterial({ roughness: 0.55, metalness: 0.1, map: G3D.canvasTexture(512, 128, (ctx, w, h) => {
            ctx.fillStyle = '#' + col.getHexString(); ctx.fillRect(0, 0, w, h);
            ctx.fillStyle = 'rgba(255,255,255,0.18)'; ctx.fillRect(0, 0, w, 10); ctx.fillStyle = 'rgba(0,0,0,0.18)'; ctx.fillRect(0, h - 10, w, 10);
            for (let x = 30; x < w; x += 60) { ctx.fillStyle = 'rgba(20,30,50,0.35)'; ctx.fillRect(x, 26, 30, h - 52); }
            ctx.font = `bold 70px 'David','Arial Hebrew','Segoe UI',sans-serif`; ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
            try { ctx.direction = /[א-ת]/.test(word) ? 'rtl' : 'ltr'; } catch (e) {}
            ctx.fillStyle = 'rgba(0,0,0,0.35)'; ctx.fillText(word, w / 2 + 3, h / 2 + 5); ctx.fillStyle = '#ffffff'; ctx.fillText(word, w / 2, h / 2 + 2);
        }) });
        return [side, side, side, side, face, face];
    }

    // ---- crane hook ----
    const hook = new T.Group();
    const cable = new T.Mesh(new T.CylinderGeometry(0.05, 0.05, 40, 6), new T.MeshStandardMaterial({ color: 0x333333 })); cable.position.y = 20.6; hook.add(cable);
    const hookBlock = new T.Mesh(new T.BoxGeometry(1.2, 0.6, 0.8), new T.MeshStandardMaterial({ color: 0xffc21a, metalness: 0.4, roughness: 0.4 })); hookBlock.position.y = 0.6; hook.add(hookBlock);
    const slingMat = new T.LineBasicMaterial({ color: 0x222222 });
    const slingGeo = new T.BufferGeometry(); slingGeo.setAttribute('position', new T.BufferAttribute(new Float32Array(12), 3));
    const slings = new T.LineSegments(slingGeo, slingMat); hook.add(slings);
    scene.add(hook);
    // crane boom far above (just a hint of the crane)
    const boom = new T.Mesh(new T.BoxGeometry(40, 0.8, 0.8), new T.MeshStandardMaterial({ color: 0xffc21a, metalness: 0.3, roughness: 0.5 }));
    scene.add(boom);

    // ---- landing guide: green = where the block will land, red = what will be cut off ----
    const guideGeo = new T.PlaneGeometry(1, 1); guideGeo.rotateX(-Math.PI / 2);
    const guideOk = new T.Mesh(guideGeo, new T.MeshBasicMaterial({ color: 0x5cf2a0, transparent: true, opacity: 0.45, depthWrite: false }));
    const guideBad = new T.Mesh(guideGeo, new T.MeshBasicMaterial({ color: 0xff3b55, transparent: true, opacity: 0.6, depthWrite: false }));
    guideOk.renderOrder = guideBad.renderOrder = 5;
    scene.add(guideOk); scene.add(guideBad);
    function updateGuide() {
        if (!cur) { guideOk.visible = guideBad.visible = false; return; }
        const off = cur.shownOffset, ov = Math.max(0, width - Math.abs(off));
        guideOk.visible = ov > 0.02;
        guideOk.position.set(topX + off / 2, topY + 0.03, 0); guideOk.scale.set(ov, 1, DEPTH);
        const cut = Math.min(width, Math.abs(off));
        guideBad.visible = cut > 0.02;
        guideBad.position.set(off > 0 ? topX + width / 2 + off - cut / 2 : topX - width / 2 + off + cut / 2, topY + 0.04, 0); guideBad.scale.set(cut, 1, DEPTH);
        guideOk.material.opacity = 0.35 + Math.sin(time * 6) * 0.12;
    }

    // ---- current block ----
    let cur = null;          // { mesh, word, chars, typed, offset, errors, fuse, fuseMax, dir, label }
    let falling = null;      // block that is dropping
    const debris = [];
    let perfectStreak = 0, time = 0, nextIn = 0.8, dirFlip = 1;
    const stats = { floors: 0, perfect: 0, drops: 0, bestStreak: 0 };
    const floorsForLevel = () => 6 + api.level * 2;
    let levelFloors = 0;
    const stepPerError = ({ easy: 0.42, normal: 0.55, hard: 0.68, expert: 0.8 })[cfg.difficulty] || 0.55;
    const secPerChar = ({ easy: 1.25, normal: 0.9, hard: 0.68, expert: 0.5 })[cfg.difficulty] || 0.9;

    function nextWord() {
        let w = words.next(api.level);
        if (api.level >= 5 && Math.random() < 0.4) w = w + ' ' + words.next(api.level);
        return w;
    }
    function spawnBlock() {
        const word = nextWord();
        const chars = Array.from(word);
        // 4.1: every 10th floor is a golden floor — clean = triple points and a life
        const golden = (floors.length + 1) % 10 === 0;
        const hue = golden ? 0.125 : (0.02 + floors.length * 0.07) % 1;
        const mats = blockMaterials(word, hue);
        if (golden) mats.forEach(m => { m.metalness = 0.75; m.roughness = 0.25; m.emissive = new T.Color(0x553a00); m.emissiveIntensity = 0.6; });
        const mesh = new T.Mesh(new T.BoxGeometry(width, FH, DEPTH), mats);
        mesh.castShadow = true; mesh.receiveShadow = true;
        scene.add(mesh);
        const label = G3D.makeLabel(word, { px: 70, height: 1.15, typedColor: '#5cf2a0', bg: 'rgba(10,16,34,0.82)', border: '#ffc21a', depthTest: false });
        label.sprite.position.set(0, FH / 2 + 1.6, 0); mesh.add(label.sprite);
        dirFlip = -dirFlip;
        const fuseMax = (1.8 + chars.length * secPerChar) * Math.max(0.6, 1 - (api.level - 1) * 0.04);
        cur = { mesh, word, chars, typed: 0, offset: 0, shownOffset: 0, errors: 0, fuse: fuseMax, fuseMax, dir: dirFlip, label, hue, y: topY + 9, wob: Math.random() * 6, lastKeyT: performance.now(), arrive: 0, golden };
        if (golden) api.banner('✨ ' + t('קומת זהב!', 'Golden floor!'), t('הקלידו אותה נקי: פי 3 נקודות וחיים נוספים', 'Type it clean: triple points and an extra life'), 'power', 1500);
        mesh.position.set(topX, cur.y + 6, 0);
        api.audio.sfx('whoosh');
        hint();
    }
    function hint() {
        const ch = cur ? cur.chars[cur.typed] : '';
        api.hud.hint(ch || '', cur ? cur.word + '|' + cur.typed + '|' + cur.mesh.id : '');
        api.hud.typed(cur ? cur.chars.slice(0, cur.typed).join('') : '');
        fuseHud();
    }
    function fuseHud() {
        if (!cur) { api.hud.extra(''); return; }
        const f = Math.max(0, cur.fuse / cur.fuseMax);
        api.hud.extra(`<div class="g3-fuse ${f < 0.3 ? 'low' : ''}"><span style="width:${Math.round(f * 100)}%"></span></div><div class="g3-errs">${cur.errors ? '⚠️ ' + t('סטייה', 'Drift') + ': ' + '◆'.repeat(Math.min(10, cur.errors)) : '✨ ' + t('נקי', 'Clean')}</div>`);
    }

    function release(timeout) {
        if (!cur) return;
        const b = cur; cur = null;
        b.label.dispose(); b.mesh.remove(b.label.sprite);
        if (timeout) {
            const left = b.chars.length - b.typed;
            b.offset += b.dir * stepPerError * Math.max(2, left) * 0.8;
            api.banner('⌛ ' + t('הזמן נגמר', 'Time\'s up'), t('הבלוק שוחרר לפני שסיימתם', 'The block dropped before you finished'), 'small', 1200);
        }
        // 4.1: "express" — finished with more than 55% of the fuse left
        b.express = !timeout && b.fuse / b.fuseMax > 0.55;
        falling = { b, vy: 0, x: topX + b.offset };
        stats.drops++;
        api.hud.extra(''); api.hud.typed('');
    }

    function land(f) {
        const b = f.b;
        const off = b.offset;
        const overlap = width - Math.abs(off);
        const perfect = b.errors === 0 && Math.abs(off) < 0.001;
        if (overlap <= 0.05) {
            // complete miss: the block tumbles down
            debris.push({ m: b.mesh, vy: -2, vx: Math.sign(off) * 3, rot: new T.Vector3(Math.random() * 2, 0, -Math.sign(off) * 2.5) });
            api.audio.sfx('crash'); api.shake(0.6);
            api.banner('💥 ' + t('הבלוק נפל!', 'The block fell!'), t('יותר מדי טעויות במילה', 'Too many mistakes in the word'), 'boss', 1500);
            perfectStreak = 0;
            api.damage(1);
            nextIn = 1.0;
            return;
        }
        // keep the overlapping part, slice off the overhang
        let newX = topX + off, newW = overlap;
        if (!perfect && Math.abs(off) > 0.001) {
            const keepCenter = topX + off / 2;
            const cutW = Math.abs(off);
            const chunk = new T.Mesh(new T.BoxGeometry(cutW, FH, DEPTH), b.mesh.material[0]);
            chunk.position.set(off > 0 ? keepCenter + overlap / 2 + cutW / 2 : keepCenter - overlap / 2 - cutW / 2, topY + FH / 2, 0);
            scene.add(chunk);
            debris.push({ m: chunk, vy: 0, vx: Math.sign(off) * 2.2, rot: new T.Vector3((Math.random() - 0.5) * 2, 0, -Math.sign(off) * (1.5 + Math.random() * 2)) });
            newX = keepCenter;
            b.mesh.geometry.dispose();
            b.mesh.geometry = new T.BoxGeometry(newW, FH, DEPTH);
            api.audio.sfx('place');
            P.emit(new T.Vector3(off > 0 ? newX + newW / 2 : newX - newW / 2, topY, DEPTH / 2), Math.round(30 * Q.part) + 4, { color: 0xd8d0c0, speed: 4, size: 0.9, life: 0.8, gravity: 4 });
            perfectStreak = 0;
        } else {
            newX = topX; newW = width;
            perfectStreak++;
            stats.perfect++;
            stats.bestStreak = Math.max(stats.bestStreak, perfectStreak);
            api.audio.sfx('perfect', { pitch: Math.min(8, perfectStreak) * 40 });
            const ring = new T.Mesh(new T.RingGeometry(0.9, 1, 4, 1), new T.MeshBasicMaterial({ color: 0xffffff, transparent: true, opacity: 0.9, side: T.DoubleSide, depthWrite: false }));
            ring.rotation.x = -Math.PI / 2; ring.rotation.z = Math.PI / 4; ring.position.set(newX, topY + 0.05, 0);
            scene.add(ring); rings.push({ m: ring, life: 0.6, w: newW });
            if (perfectStreak >= 3 && width < START_W) {
                newW = Math.min(START_W, width + 0.35);
                b.mesh.geometry.dispose(); b.mesh.geometry = new T.BoxGeometry(newW, FH, DEPTH);
                api.popup('↔ ' + t('המגדל התרחב!', 'Tower widened!'), new T.Vector3(newX, topY + 3, 0), 'gold');
            }
            if (perfectStreak > 1) api.popup(`✨ ${t('מושלם', 'Perfect')} ×${perfectStreak}`, new T.Vector3(newX, topY + 4, 0), 'hot');
            P.emit(new T.Vector3(newX, topY + FH, 0), Math.round(40 * Q.part) + 6, { color: 0xffe066, color2: 0xffffff, speed: 7, size: 0.6, life: 0.8, up: 3, gravity: 3 });
        }
        b.mesh.position.set(newX, topY + FH / 2, 0);
        floors.push(b.mesh);
        topX = newX; width = newW; topY += FH;
        stats.floors = floors.length; levelFloors++;
        let base = 10 + b.chars.length * 6 + (perfect ? 25 + perfectStreak * 5 : 0);
        if (b.golden && perfect) { base *= 3; api.heal(1); api.audio.sfx('fanfare'); api.popup('❤️ +1', new T.Vector3(newX, topY + 5, 0), 'gold'); stats.golden = (stats.golden || 0) + 1; }
        if (b.express) { base += 15; api.popup('⚡ ' + t('אקספרס!', 'Express!'), new T.Vector3(newX + 2.5, topY + 3.2, 0), 'gold'); api.feverBoost(0.06); stats.express = (stats.express || 0) + 1; }
        api.wordDone(base, new T.Vector3(newX, topY + 2, 0), { cls: b.golden ? 'gold' : perfect ? 'hot' : '' });
        api.shake(perfect ? 0.08 : 0.2);
        api.setLevelProgress(levelFloors / floorsForLevel());
        if (levelFloors >= floorsForLevel()) { levelFloors = 0; api.levelUp(t('המילים מתארכות, הזמן מתקצר', 'Longer words, less time')); }
        const h = floors.length * 3;
        const milestones = { 30: t('🌳 מעל העצים', '🌳 Above the trees'), 60: t('🏢 גורד שחקים!', '🏢 Skyscraper!'), 120: t('☁️ בתוך העננים', '☁️ In the clouds'), 210: t('🌅 מעל השקיעה', '🌅 Above the sunset'), 300: t('🌌 נוגעים בכוכבים', '🌌 Touching the stars'), 450: t('🚀 בחלל!', '🚀 In space!') };
        if (milestones[h]) { api.banner(milestones[h], `${h} ${t('מטר', 'meters')}`, 'level', 2200); api.audio.sfx('levelup'); api.addScore(h * 5); }
        nextIn = 0.35;
    }

    // ---- input ----
    function expected() { return cur ? cur.chars[cur.typed] : ''; }
    function onChar(ch) {
        if (!cur) return;
        const need = cur.chars[cur.typed];
        const now = performance.now();
        api.track(need, ch, now - cur.lastKeyT); cur.lastKeyT = now;
        if (ch === need) {
            cur.typed++; api.keyOk();
            cur.label.setTyped(cur.typed);
            api.audio.sfx('tick');
            if (cur.typed >= cur.chars.length) release(false);
        } else {
            api.keyBad();
            cur.errors++;
            cur.offset += cur.dir * stepPerError;
            cur.jolt = 0.3;
            P.emit(cur.mesh.position.clone().add(new T.Vector3(-cur.dir * width / 2, 0, 0)), 8, { color: 0xffaa33, speed: 4, size: 0.4, life: 0.4 });
        }
        hint();
    }

    // ---- loop ----
    const rings = [];
    const camPos = new T.Vector3(0, 10, 24), look = new T.Vector3(0, 4, 0);
    let camAngle = 0.5;
    function update(dt, realDt) {
        time += realDt;
        if (!cur && !falling && !api.isDying()) { nextIn -= dt; if (nextIn <= 0) spawnBlock(); }
        if (cur) {
            // the block glides down to its hanging position, swaying on the hook
            const hangY = topY + 4.2;
            cur.y += (hangY - cur.y) * Math.min(1, realDt * 4);
            cur.shownOffset += (cur.offset - cur.shownOffset) * Math.min(1, realDt * 10);
            cur.wob += realDt;
            const sway = Math.sin(cur.wob * 1.6) * 0.06 + (cur.jolt > 0 ? Math.sin(time * 50) * cur.jolt * 0.4 : 0);
            if (cur.jolt > 0) cur.jolt -= realDt;
            cur.mesh.position.set(topX + cur.shownOffset, cur.y, 0);
            cur.mesh.rotation.z = sway * 0.4 - cur.shownOffset * 0.015;
            cur.fuse -= dt;
            if (Math.random() < 0.3) fuseHud();
            if (cur.fuse <= 0) release(true);
        }
        updateGuide();
        if (falling) {
            falling.vy -= 40 * dt;
            const m = falling.b.mesh;
            m.position.y += falling.vy * dt;
            m.position.x += (falling.x - m.position.x) * Math.min(1, realDt * 12);
            m.rotation.z *= 0.8;
            if (m.position.y <= topY + FH / 2) { m.position.y = topY + FH / 2; m.rotation.z = 0; const f = falling; falling = null; land(f); }
        }
        for (let i = debris.length - 1; i >= 0; i--) {
            const d = debris[i];
            d.vy -= 30 * realDt; d.m.position.y += d.vy * realDt; d.m.position.x += d.vx * realDt;
            d.m.rotation.x += d.rot.x * realDt; d.m.rotation.z += d.rot.z * realDt;
            if (d.m.position.y < -5) { scene.remove(d.m); d.m.geometry.dispose(); debris.splice(i, 1); }
        }
        for (let i = rings.length - 1; i >= 0; i--) {
            const r = rings[i]; r.life -= realDt;
            const s = (r.w / 2 + 0.5) * 1.42 * (1 + (0.6 - r.life) * 1.5); r.m.scale.set(s, s * (DEPTH / r.w), 1);
            r.m.material.opacity = Math.max(0, r.life / 0.6);
            if (r.life <= 0) { scene.remove(r.m); r.m.geometry.dispose(); r.m.material.dispose(); rings.splice(i, 1); }
        }
        // hook follows the block
        const hb = cur ? cur.mesh.position : new T.Vector3(topX, topY + 8, 0);
        hook.position.set(hb.x, hb.y + FH / 2 + 1.3, 0);
        const sp = slingGeo.attributes.position.array, hw = width / 2 - 0.2;
        sp.set([0, 0.3, 0, -hw, -1.3, DEPTH / 2 - 0.3, 0, 0.3, 0, hw, -1.3, -DEPTH / 2 + 0.3], 0);
        slingGeo.attributes.position.needsUpdate = true;
        slings.visible = !!cur;
        boom.position.set(hb.x - 10, hb.y + 22, 0);

        // sky changes with height
        const h = topY;
        for (let i = 1; i < SKY.length; i++) {
            if (h <= SKY[i][0] || i === SKY.length - 1) {
                const a = SKY[i - 1], b = SKY[i]; const k = Math.max(0, Math.min(1, (h - a[0]) / (b[0] - a[0])));
                skyCol.setHex(a[1]).lerp(tmpC.setHex(b[1]), k); break;
            }
        }
        scene.fog.color.copy(skyCol);
        starMat.opacity = Math.max(0, Math.min(1, (h - 130) / 90));
        const night = Math.max(0, Math.min(1, (h - 100) / 80));
        bldg.material.emissiveIntensity = night * 0.9;
        sun.intensity = 1.3 - night * 0.9; hemi.intensity = 0.85 - night * 0.45;
        clouds.forEach(c => { c.s.position.x += c.v * realDt; if (c.s.position.x > 90) c.s.position.x = -90; });

        // camera: slow orbit, rising with the tower
        camAngle += realDt * 0.06;
        const r = 23 + Math.min(10, floors.length * 0.05);
        camPos.lerp(new T.Vector3(Math.sin(camAngle) * r * 0.55 + topX * 0.5, topY + 8, Math.cos(camAngle) * r), Math.min(1, realDt * 2));
        look.lerp(new T.Vector3(topX * 0.7, topY + 3.2, 0), Math.min(1, realDt * 3));
        api.setCameraBase(camPos);
    }
    function afterCamera() { camera.lookAt(look); }
    function ambient(dt) { time += dt; clouds.forEach(c => { c.s.position.x += c.v * dt; }); }

    camera.position.copy(camPos); camera.lookAt(look);
    return {
        update, onChar, expected, ambient, afterCamera,
        get _floors() { return floors.length; },
        onBackspace() {},
        dispose() {},
        _syncStats(S) { S.towerStats = stats; }
    };
}
