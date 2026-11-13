// ---- 4.2: "Letter Dash" (ריצת האותיות) — an endless 3-lane runner ----
// Rows of gates rush toward you. Each lane shows a letter; obstacles block some
// lanes. Type the letter of the OPEN lane to dash into it and unlock the gate —
// type the wrong lane's letter and you run into the wall (you can still correct
// it before you get there). Word walls must be typed in full to smash through,
// and treasure rows let you pick the richest lane. Trains instant letter
// recognition and reaction time — exactly what blind typing needs.

const RUNNER_DEF = PLUS.newGame({
    id: 'runner', icon: '🏃', theme: 'g3-runner', music: 'race',
    lifeIcon: '💚', lifeIconOff: '🖤',
    title: () => t('ריצת האותיות', 'Letter Dash'),
    desc: () => t('ריצה אינסופית בשלושה מסלולים: הקלידו את האות של המסלול הפתוח כדי לקפוץ אליו ולפתוח את השער. קירות מילים צריך להקליד עד הסוף כדי לנפץ אותם, ובשורות אוצר בוחרים את המסלול העשיר. המהירות עולה בכל שלב — ובין השלבים בוחרים שדרוגים.', 'An endless three-lane run: type the letter of the open lane to dash into it and unlock the gate. Word walls must be typed in full to smash through, and on treasure rows you pick the richest lane. The speed rises every level — and between levels you choose upgrades.'),
    trains: () => t('מתאמן על: זיהוי אות מיידי, זמן תגובה ומילים קצרות', 'Trains: instant letter recognition, reaction time and short words'),
    keysHelp: () => t('הקלידו את האות של המסלול הירוק · קיר מילה = הקלידו את כל המילה · Esc = השהיה', 'Type the letter of the green lane · word wall = type the whole word · Esc = pause'),
    defaults: { content: 'auto' },
    options: () => [
        { key: 'content', label: t('קירות מילים', 'Word walls'), choices: [['auto', t('אוטומטי — לפי ההתקדמות שלי', 'Auto — based on my progress')], ['letters', t('צירופי אותיות שלמדתי', 'Letter clusters I learned')], ['short', t('מילים קצרות', 'Short words')], ['words', t('מילים', 'Words')], ['mixed', t('מעורב', 'Mixed')]] }
    ],
    startBanner: () => t('🏃 ריצת האותיות', '🏃 Letter Dash'),
    startSub: () => t('הקלידו את האות של המסלול הירוק', 'Type the letter of the green lane'),
    wordsLabel: () => t('שערים', 'Gates'),
    hudLevel: (S) => { const g = S.game; return g && g._dist != null ? `🏃 ${g._dist.toLocaleString()}${t('מ׳', 'm')} · ${t('שלב', 'Lv')} ${S.level}` : t('שלב', 'Level') + ' ' + S.level; },
    _endExtra: (S) => { const a = S.runStats; if (!a) return ''; return `<p class="g3-endnote">🏃 ${t('מרחק', 'Distance')}: <b>${a.dist.toLocaleString()}${t('מ׳', 'm')}</b> · 🚪 ${t('שערים', 'Gates')}: <b>${a.gates}</b> · 🧱 ${t('קירות שנופצו', 'Walls smashed')}: <b>${a.walls}</b> · 💰 ${t('אוצרות', 'Treasures')}: <b>${a.treasure}</b> · ⚡ ${t('תגובה ממוצעת', 'Avg reaction')}: <b>${a.rtN ? (a.rt / a.rtN / 1000).toFixed(2) + t('ש׳', 's') : '—'}</b></p>`; },
    _onEnd: (S) => { const st = G3D.store().stats; const a = S.runStats || {}; st.runnerBest = Math.max(st.runnerBest || 0, a.dist || 0); },
    _create: (api) => createRunner(api)
}, {});

function createRunner(api) {
    const T = api.THREE, scene = api.scene, camera = api.camera, cfg = api.cfg, D = api.D, P = api.particles, Q = api.Q;
    const plus = api.plus;
    const words = galaxyWordSource(cfg);
    const LANES = [-2.6, 0, 2.6];
    const known = () => { const k = Array.from(getKnownKeys()).filter(isLetterChar); return k.length >= 3 ? k : Object.values(getCurrentKeyboardLayout()).filter(isLetterChar).slice(0, 8); };

    // ---- world themes (change every level) ----
    const THEMES = [
        { sky: 0x6fc0ff, fog: 0xa8dcff, ground: 0x4caa4a, road: 0xd8c8a0, side: 0x2f7a2f, light: 0xffffff },
        { sky: 0xffb07a, fog: 0xffd3a8, ground: 0xd9a35a, road: 0xf2e2c2, side: 0xa8672e, light: 0xffe0c0 },
        { sky: 0x2a1c5a, fog: 0x3b2a78, ground: 0x221a44, road: 0x3a3f7a, side: 0xff4fd8, light: 0xb8a8ff },
        { sky: 0x9fe3e0, fog: 0xd2f4ef, ground: 0xeaf6ff, road: 0xffffff, side: 0x7fc8e8, light: 0xffffff },
        { sky: 0x05060f, fog: 0x0b0f2a, ground: 0x101633, road: 0x1d2550, side: 0x37e0ff, light: 0x9ad8ff }
    ];
    let theme = THEMES[0];
    scene.background = new T.Color(theme.sky);
    scene.fog = new T.Fog(theme.fog, 55, 160);
    camera.fov = 62; camera.near = 0.1; camera.far = 600; camera.updateProjectionMatrix();
    const hemi = new T.HemisphereLight(0xffffff, 0x445566, 0.6); scene.add(hemi);
    const sun = new T.DirectionalLight(0xffffff, 1.1); sun.position.set(-8, 20, 10); scene.add(sun);

    const groundMat = new T.MeshStandardMaterial({ color: theme.ground, roughness: 1 });
    const ground = new T.Mesh(new T.PlaneGeometry(400, 400), groundMat); ground.rotation.x = -Math.PI / 2; ground.position.y = -0.05; scene.add(ground);
    const roadTex = G3D.canvasTexture(128, 256, (ctx, w, h) => {
        ctx.fillStyle = '#ffffff'; ctx.fillRect(0, 0, w, h);
        ctx.fillStyle = 'rgba(0,0,0,0.10)'; ctx.fillRect(w / 3 - 2, 0, 4, h); ctx.fillRect(w * 2 / 3 - 2, 0, 4, h);
        for (let y = 0; y < h; y += 32) { ctx.fillStyle = 'rgba(0,0,0,0.05)'; ctx.fillRect(0, y, w, 14); }
    }, [1, 30]);
    const roadMat = new T.MeshStandardMaterial({ color: theme.road, map: roadTex, roughness: 0.8 });
    const road = new T.Mesh(new T.PlaneGeometry(8.4, 300), roadMat); road.rotation.x = -Math.PI / 2; road.position.set(0, 0, -120); scene.add(road);
    const edgeMat = new T.MeshStandardMaterial({ color: theme.side, emissive: theme.side, emissiveIntensity: 0.25 });
    [-4.35, 4.35].forEach(x => { const e = new T.Mesh(new T.BoxGeometry(0.3, 0.35, 300), edgeMat); e.position.set(x, 0.17, -120); scene.add(e); });

    // side scenery: instanced trees / pillars that loop
    const decoN = Math.round(60 * Q.part) + 20;
    const decoMat = new T.MeshStandardMaterial({ color: theme.side, flatShading: true, emissive: theme.side, emissiveIntensity: 0.1 });
    const deco = new T.InstancedMesh(new T.ConeGeometry(1, 3, 6).translate(0, 1.5, 0), decoMat, decoN);
    const decoZ = [], decoX = [], decoS = [], dm = new T.Object3D();
    for (let i = 0; i < decoN; i++) { decoZ.push(-Math.random() * 160); decoX.push((Math.random() < 0.5 ? -1 : 1) * (6 + Math.random() * 18)); decoS.push(0.6 + Math.random() * 1.6); }
    scene.add(deco);
    // clouds / stars
    const cloudTex = G3D.glowTexture('rgba(255,255,255,0.9)', 'rgba(255,255,255,0.35)');
    const clouds = [];
    for (let i = 0; i < 18; i++) { const s = new T.Sprite(new T.SpriteMaterial({ map: cloudTex, transparent: true, depthWrite: false, opacity: 0.7, fog: false })); s.position.set((Math.random() - 0.5) * 160, 18 + Math.random() * 30, -60 - Math.random() * 120); const k = 10 + Math.random() * 18; s.scale.set(k * 1.8, k, 1); scene.add(s); clouds.push(s); }

    function applyTheme(i) {
        theme = THEMES[i % THEMES.length];
        scene.background.setHex(theme.sky); scene.fog.color.setHex(theme.fog);
        groundMat.color.setHex(theme.ground); roadMat.color.setHex(theme.road);
        edgeMat.color.setHex(theme.side); edgeMat.emissive.setHex(theme.side);
        decoMat.color.setHex(theme.side); decoMat.emissive.setHex(theme.side);
        const night = i % THEMES.length >= 2 && i % THEMES.length !== 3;
        edgeMat.emissiveIntensity = night ? 0.9 : 0.25; decoMat.emissiveIntensity = night ? 0.5 : 0.1;
        sun.color.setHex(theme.light); sun.intensity = night ? 0.6 : 1.1; hemi.intensity = night ? 0.45 : 0.6;
        clouds.forEach(c => { c.material.opacity = night ? 0.25 : 0.7; });
    }

    // ---- the runner ----
    const hero = new T.Group();
    const bodyMat = new T.MeshStandardMaterial({ color: 0x2f7cf6, roughness: 0.4, metalness: 0.1 });
    const body = new T.Mesh(new T.CapsuleGeometry(0.42, 0.7, 6, 12), bodyMat); body.position.y = 1.0; hero.add(body);
    const head = new T.Mesh(new T.SphereGeometry(0.34, 16, 12), new T.MeshStandardMaterial({ color: 0xffd7b0, roughness: 0.6 })); head.position.y = 1.85; hero.add(head);
    const cap = new T.Mesh(new T.SphereGeometry(0.36, 16, 8, 0, Math.PI * 2, 0, Math.PI / 2), new T.MeshStandardMaterial({ color: 0xff5a4f })); cap.position.y = 1.9; hero.add(cap);
    const legs = [], arms = [];
    [-0.18, 0.18].forEach((x, i) => {
        const l = new T.Mesh(new T.CapsuleGeometry(0.12, 0.45, 4, 8), new T.MeshStandardMaterial({ color: 0x24324f })); l.position.set(x, 0.42, 0); hero.add(l); legs.push(l);
        const a = new T.Mesh(new T.CapsuleGeometry(0.1, 0.4, 4, 8), bodyMat); a.position.set(x * 3, 1.1, 0); hero.add(a); arms.push(a);
    });
    const trail = new T.Sprite(new T.SpriteMaterial({ map: G3D.glowTexture('rgba(120,220,255,1)', 'rgba(60,140,255,0.5)'), transparent: true, depthWrite: false, blending: T.AdditiveBlending, opacity: 0 }));
    trail.scale.set(3, 3, 1); trail.position.y = 1; hero.add(trail);
    scene.add(hero);
    let lane = 1, heroX = 0, jumpT = 0, crashT = 0, runPhase = 0;

    // ---- rows ----
    const rows = [];
    let spawnIn = 1.2, dist = 0, rowsThisLevel = 0, rowCount = 0, time = 0;
    const stats = { dist: 0, gates: 0, walls: 0, treasure: 0, rt: 0, rtN: 0 };
    const rowsPerLevel = () => 10 + api.level * 2;
    const speed = () => (14 + api.level * 2.1) * (D.speed * 0.6 + 0.4);
    const gap = () => Math.max(1.05, (2.6 - api.level * 0.12) * (D.spawn * 0.5 + 0.5));
    const blockMat = new T.MeshStandardMaterial({ color: 0xff3b55, roughness: 0.4, emissive: 0x550010, emissiveIntensity: 0.4 });
    const stripeTex = G3D.canvasTexture(128, 64, (ctx, w, h) => { ctx.fillStyle = '#ffd400'; ctx.fillRect(0, 0, w, h); ctx.fillStyle = '#222'; for (let x = -h; x < w; x += 32) { ctx.beginPath(); ctx.moveTo(x, h); ctx.lineTo(x + 16, h); ctx.lineTo(x + 16 + h, 0); ctx.lineTo(x + h, 0); ctx.fill(); } });
    const barMat = new T.MeshStandardMaterial({ map: stripeTex, roughness: 0.6 });
    const coinMat = new T.MeshStandardMaterial({ color: 0xffd24a, metalness: 0.8, roughness: 0.25, emissive: 0x7a5200, emissiveIntensity: 0.5 });
    const coinGeo = new T.CylinderGeometry(0.42, 0.42, 0.1, 20); coinGeo.rotateX(Math.PI / 2);
    const tileGeo = new T.BoxGeometry(2.3, 0.08, 1.6);

    function letterTile(ch, color) {
        const lab = G3D.makeLabel(ch, { px: 90, height: 1.25, color: '#ffffff', typedColor: '#5cf2a0', bg: color, border: 'rgba(255,255,255,0.9)', depthTest: true });
        return lab;
    }
    function spawnRow() {
        rowCount++;
        const lvl = api.level;
        const kind = (lvl >= 2 && rowCount % 5 === 0) ? 'wall' : (rowCount % 7 === 3 ? 'treasure' : 'gate');
        const g = new T.Group(); g.position.z = -95; scene.add(g);
        const row = { kind, g, z: -95, resolved: false, labels: [], t0: 0 };
        if (kind === 'wall') {
            let w = words.next(lvl); if (Array.from(w).length > 7) w = words.next(1);
            row.word = w; row.chars = Array.from(w); row.typed = 0; row.errors = 0;
            const wall = new T.Mesh(new T.BoxGeometry(8.4, 2.6, 0.6), new T.MeshStandardMaterial({ color: 0x8a5cf6, roughness: 0.5, emissive: 0x3a1a8a, emissiveIntensity: 0.4 }));
            wall.position.y = 1.3; g.add(wall); row.wall = wall;
            const lab = G3D.makeLabel(w, { px: 80, height: 1.3, typedColor: '#5cf2a0', bg: 'rgba(20,10,50,0.85)', border: '#ffd24a', depthTest: false });
            lab.sprite.position.set(0, 3.4, 0.4); g.add(lab.sprite); row.labels.push(lab); row.label = lab;
        } else {
            const L = known();
            const picks = [];
            const safeLane = Math.floor(Math.random() * 3);
            // the open lane's letter leans toward your target letters
            let safeCh = (plus && plus.bounty.length && Math.random() < 0.5) ? randomChoice(plus.bounty) : randomChoice(L);
            picks[safeLane] = safeCh;
            for (let i = 0; i < 3; i++) if (i !== safeLane) { let c, n = 0; do { c = randomChoice(L); n++; } while ((picks.includes(c) || c === safeCh) && n < 30); picks[i] = c; }
            row.letters = picks; row.safe = safeLane;
            row.blocked = [0, 1, 2].map(i => i !== safeLane && (kind === 'gate' ? (lvl >= 3 || Math.random() < 0.8) : false));
            if (kind === 'gate' && !row.blocked.some(b => b)) row.blocked[(safeLane + 1) % 3] = true;
            row.values = kind === 'treasure' ? [1, 2, 5].sort(() => Math.random() - 0.5) : null;
            if (row.values) row.safe = row.values.indexOf(5);
            for (let i = 0; i < 3; i++) {
                const x = LANES[i];
                const tile = new T.Mesh(tileGeo, new T.MeshStandardMaterial({ color: row.blocked[i] ? 0xff6b7d : 0x5cf2a0, emissive: row.blocked[i] ? 0x550010 : 0x0b5a33, emissiveIntensity: 0.5, transparent: true, opacity: 0.85 }));
                tile.position.set(x, 0.05, 0); g.add(tile);
                if (row.blocked[i]) {
                    const b = new T.Mesh(new T.BoxGeometry(2.1, 1.2, 0.5), barMat); b.position.set(x, 0.75, 0); g.add(b);
                    const spike = new T.Mesh(new T.ConeGeometry(0.35, 0.8, 6), blockMat); spike.position.set(x, 1.75, 0); g.add(spike);
                } else {
                    const n = row.values ? row.values[i] : 1;
                    for (let k = 0; k < Math.min(5, n); k++) { const c = new T.Mesh(coinGeo, coinMat); c.position.set(x + (k - (Math.min(5, n) - 1) / 2) * 0.35, 1.0 + (k % 2) * 0.25, 0); g.add(c); (row.coins || (row.coins = [])).push(c); }
                }
                const bg = row.blocked[i] ? 'rgba(120,10,30,0.85)' : (row.values ? 'rgba(120,80,0,0.85)' : 'rgba(10,80,50,0.88)');
                const lab = letterTile(row.letters[i], bg);
                lab.sprite.position.set(x, row.blocked[i] ? 2.9 : 2.3, 0.2); g.add(lab.sprite); row.labels.push(lab); (row.letterLabs || (row.letterLabs = [])).push(lab);
                if (row.values) { const v = G3D.makeLabel('🪙' + row.values[i], { px: 48, height: 0.6, bg: 'rgba(0,0,0,0.5)', border: '#ffd24a' }); v.sprite.position.set(x, 1.6, 0.3); g.add(v.sprite); row.labels.push(v); }
            }
            row.choice = -1;
        }
        rows.push(row);
        hint();
    }
    function current() { return rows.find(r => !r.resolved && r.z < 1.2) || null; }
    function expected() {
        const r = current(); if (!r) return '';
        if (r.kind === 'wall') return r.chars[r.typed] || '';
        return r.letters[r.safe];
    }
    function hint() {
        const r = current();
        const ch = expected();
        api.hud.hint(ch, r ? (r.kind === 'wall' ? r.word + '|' + r.typed : 'row' + rows.indexOf(r) + r.letters.join('')) + '|' + rowCount : '');
        api.hud.typed(r && r.kind === 'wall' ? r.chars.slice(0, r.typed).join('') : '');
    }
    function moveTo(i) {
        if (lane === i) return;
        lane = i; api.audio.sfx('whoosh');
        P.emit(new T.Vector3(heroX, 0.6, 0.4), Math.round(14 * Q.part) + 3, { color: 0x9ad8ff, speed: 3, size: 0.4, life: 0.4, dir: new T.Vector3(0, 0.3, 1) });
    }
    let lastKeyT = performance.now();
    function onChar(ch) {
        const r = current();
        const now = performance.now();
        if (!r) { api.keyBad(); return; }
        if (r.kind === 'wall') {
            const need = r.chars[r.typed];
            api.track(need, ch, now - lastKeyT); lastKeyT = now;
            if (ch === need) {
                r.typed++; api.keyOk(); r.label.setTyped(r.typed); api.audio.sfx('tick');
                r.wall.scale.y = 1 - r.typed / r.chars.length * 0.25;
                if (r.typed >= r.chars.length) smash(r);
            } else { api.keyBad(); r.errors++; r.wall.material.emissiveIntensity = 1.2; }
            hint(); return;
        }
        const need = r.letters[r.safe];
        const idx = r.letters.indexOf(ch);
        api.track(need, idx >= 0 ? ch : ch, now - lastKeyT);
        if (!r.t0) r.t0 = now;
        lastKeyT = now;
        if (idx < 0) { api.keyBad(); flashRow(r); hint(); return; }
        if (idx === r.choice && (r.locked || r.values)) { hint(); return; } // already chosen — repeat presses are ignored
        r.choice = idx; moveTo(idx);
        r.letterLabs.forEach((l, i) => l.setTyped(i === idx ? 1 : 0));
        if (idx === r.safe || (r.values && !r.blocked[idx])) {
            api.keyOk();
            stats.rt += Math.max(0, now - (r.spawnT || now)); stats.rtN++;
            if (!r.values) { r.locked = true; }
        } else {
            api.keyBad();
            api.banner('⚠️', t('זה מסלול חסום! הקלידו את הירוק', 'That lane is blocked! Type the green one'), 'small', 700);
        }
        hint();
    }
    function flashRow(r) { r.g.position.x = 0.25; setTimeout(() => { if (r.g) r.g.position.x = 0; }, 70); }
    function smash(r) {
        r.resolved = true;
        stats.walls++;
        api.audio.sfx('explode'); api.shake(0.35); jumpT = 0.6;
        P.emit(new T.Vector3(0, 1.4, r.z), Math.round(110 * Q.part) + 10, { color: 0x8a5cf6, color2: 0xffd24a, speed: 10, size: 0.7, life: 1, gravity: 6 });
        r.wall.visible = false; r.labels.forEach(l => { l.sprite.visible = false; });
        api.wordDone(20 + r.chars.length * 8, new T.Vector3(0, 3, r.z), { cls: r.errors ? '' : 'hot' });
        stepLevel();
    }
    function resolve(r) {
        if (r.resolved) return;
        r.resolved = true;
        if (r.kind === 'wall') {
            crash(t('לא הספקתם להקליד את הקיר', 'You didn\'t finish the wall'));
            r.wall.visible = false; r.labels.forEach(l => { l.sprite.visible = false; });
            api.setLevelProgress(rowsThisLevel / rowsPerLevel());
            return;
        }
        const blocked = r.blocked[lane];
        if (r.values) {
            const v = r.choice >= 0 ? r.values[r.choice] : 0;
            if (r.choice >= 0 && lane === r.choice) {
                stats.treasure++;
                collectCoins(r, lane);
                api.addScore(v * 25 * api.level);
                api.popup(`🪙 ×${v}`, new T.Vector3(LANES[lane], 2.4, 0), v === 5 ? 'gold' : '');
                if (v === 5) { api.audio.sfx('perfect', { pitch: 120 }); api.feverBoost(0.08); }
                api.wordDone(6 + v * 3, null);
            }
            stepLevel(); return;
        }
        if (blocked) { crash(t('בום! נתקעתם במחסום', 'Bam! You hit the barrier')); }
        else if (!r.locked) { crash(t('השער נשאר נעול — הקלידו את האות', 'The gate stayed locked — type the letter')); }
        else {
            stats.gates++;
            collectCoins(r, lane);
            api.audio.sfx('pop', { pitch: Math.min(600, api.combo * 20) });
            api.wordDone(10 + api.level * 2, new T.Vector3(LANES[lane], 2.6, 0));
        }
        stepLevel();
    }
    function collectCoins(r, ln) {
        (r.coins || []).forEach(c => { if (Math.abs(c.position.x - LANES[ln]) < 1.2) { c.visible = false; P.emit(new T.Vector3(LANES[ln], 1.1, 0.3), 10, { color: 0xffd24a, speed: 4, size: 0.35, life: 0.5, up: 2 }); } });
    }
    function crash(msg) {
        crashT = 0.7; api.audio.sfx('crash'); api.shake(0.7);
        P.emit(new T.Vector3(heroX, 1.2, 0), Math.round(50 * Q.part) + 6, { color: 0xff5566, color2: 0xffd24a, speed: 7, size: 0.5, life: 0.7, gravity: 6 });
        api.banner('💥', msg, 'small boss', 1000);
        api.damage(1);
    }
    function stepLevel() {
        rowsThisLevel++;
        api.setLevelProgress(rowsThisLevel / rowsPerLevel());
        if (rowsThisLevel >= rowsPerLevel()) {
            rowsThisLevel = 0;
            api.levelUp(t('מהר יותר! עולם חדש', 'Faster! A new world'));
            applyTheme(api.level - 1);
        }
    }

    // ---- loop ----
    const camPos = new T.Vector3(0, 4.2, 7.5), look = new T.Vector3(0, 1.2, -8);
    function update(dt, realDt) {
        time += realDt;
        const v = speed() * (crashT > 0 ? 0.45 : 1);
        dist += v * dt * 0.5; stats.dist = Math.round(dist);
        spawnIn -= dt;
        if (spawnIn <= 0 && !api.isDying()) { spawnRow(); rows[rows.length - 1].spawnT = performance.now(); spawnIn = gap(); }
        for (let i = rows.length - 1; i >= 0; i--) {
            const r = rows[i];
            r.z += v * dt; r.g.position.z = r.z;
            if (!r.resolved && r.z >= -0.2) { resolve(r); hint(); }
            if (r.coins) r.coins.forEach(c => { c.rotation.y += realDt * 4; });
            if (r.kind === 'wall' && r.wall.visible) r.wall.material.emissiveIntensity += (0.4 - r.wall.material.emissiveIntensity) * Math.min(1, realDt * 5);
            if (r.z > 12) { r.labels.forEach(l => l.dispose()); scene.remove(r.g); r.g.traverse(o => { if (o.geometry && o.geometry !== tileGeo && o.geometry !== coinGeo) o.geometry.dispose(); }); rows.splice(i, 1); }
        }
        // hero
        heroX += (LANES[lane] - heroX) * Math.min(1, realDt * 14);
        runPhase += realDt * (6 + v * 0.35);
        const bob = Math.abs(Math.sin(runPhase)) * 0.12;
        if (jumpT > 0) jumpT -= realDt;
        const jy = jumpT > 0 ? Math.sin((0.6 - jumpT) / 0.6 * Math.PI) * 1.4 : 0;
        hero.position.set(heroX, bob + jy, 0);
        hero.rotation.z = (LANES[lane] - heroX) * -0.12;
        legs[0].rotation.x = Math.sin(runPhase) * 0.9; legs[1].rotation.x = -Math.sin(runPhase) * 0.9;
        arms[0].rotation.x = -Math.sin(runPhase) * 0.8; arms[1].rotation.x = Math.sin(runPhase) * 0.8;
        if (crashT > 0) { crashT -= realDt; body.material.emissive = body.material.emissive || new T.Color(); bodyMat.emissive.setHex(Math.sin(time * 40) > 0 ? 0xff2244 : 0x000000); } else bodyMat.emissive.setHex(0x000000);
        trail.material.opacity = api.isFever() ? 0.8 : Math.min(0.6, api.combo * 0.03);
        // scenery scroll
        roadTex.offset.y += v * dt / 10;
        for (let i = 0; i < decoN; i++) {
            decoZ[i] += v * dt; if (decoZ[i] > 10) decoZ[i] -= 170;
            dm.position.set(decoX[i], 0, decoZ[i]); dm.scale.setScalar(decoS[i]); dm.updateMatrix(); deco.setMatrixAt(i, dm.matrix);
        }
        deco.instanceMatrix.needsUpdate = true;
        clouds.forEach(c => { c.position.z += v * dt * 0.08; if (c.position.z > 0) c.position.z -= 180; });
        camPos.set(heroX * 0.45, 4.2 + jy * 0.3, 7.5);
        api.setCameraBase(camPos);
        camera.fov = 62 + Math.min(10, api.level * 1.2) + (api.isFever() ? 6 : 0); camera.updateProjectionMatrix();
    }
    function afterCamera() { look.set(heroX * 0.6, 1.2, -8); camera.lookAt(look); }
    function ambient(dt) { clouds.forEach(c => { c.position.x += dt * 0.5; }); }
    for (let i = 0; i < decoN; i++) { dm.position.set(decoX[i], 0, decoZ[i]); dm.scale.setScalar(decoS[i]); dm.updateMatrix(); deco.setMatrixAt(i, dm.matrix); }
    camera.position.copy(camPos); camera.lookAt(look);
    return {
        update, onChar, expected, ambient, afterCamera,
        get _dist() { return Math.round(dist); },
        onBackspace() {},
        dispose() { rows.forEach(r => r.labels.forEach(l => l.dispose())); },
        _syncStats(S) { S.runStats = stats; }
    };
}
