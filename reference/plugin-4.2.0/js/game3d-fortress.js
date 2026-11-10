// ---- 4.2: "Fortress of Words" (מבצר המילים) — tower defense by typing ----
// Monsters march along a winding road toward your castle, each carrying a word.
// Type a word to fire arrows at its monster. Between waves, build towers on the
// free plots by typing the word on the plot's sign: ❄️ frost towers slow the
// enemies, 🔥 fire towers burn letters off words, 🧱 masons repair the wall.
// Every fifth wave a giant carries a whole phrase. Strategy + speed + accuracy.

const FORTRESS_DEF = PLUS.newGame({
    id: 'fortress', icon: '🏰', theme: 'g3-fortress', music: 'arena',
    lifeIcon: '🏰', lifeIconOff: '🏚️',
    title: () => t('מבצר המילים', 'Fortress of Words'),
    desc: () => t('מפלצות צועדות בדרך מתפתלת אל הטירה, ועל כל אחת מילה — הקלידו אותה כדי לירות בה חצים. בין הגלים בונים מגדלים על חלקות פנויות בהקלדת המילה שעל השלט: ❄️ מגדל קרח מאט, 🔥 מגדל אש שורף אותיות, 🧱 בנאי מתקן את החומה. בכל גל חמישי מגיע ענק עם משפט שלם.', 'Monsters march along a winding road to your castle, each carrying a word — type it to shoot arrows at it. Between waves, build towers on free plots by typing the word on the sign: ❄️ frost towers slow them, 🔥 fire towers burn letters away, 🧱 masons repair the wall. Every fifth wave a giant brings a whole phrase.'),
    trains: () => t('מתאמן על: מילים שלמות בלחץ, בחירת מטרות, דיוק', 'Trains: whole words under pressure, choosing targets, accuracy'),
    keysHelp: () => t('הקלידו את המילה שעל המפלצת · Backspace = החלפת מטרה · בין גלים: הקלידו מילה של שלט כדי לבנות · Esc = השהיה', 'Type the word on a monster · Backspace = switch target · between waves: type a sign\'s word to build · Esc = pause'),
    defaults: { content: 'auto' },
    options: () => [
        { key: 'content', label: t('תוכן', 'Content'), choices: [['auto', t('אוטומטי — לפי ההתקדמות שלי', 'Auto — based on my progress')], ['letters', t('צירופי אותיות שלמדתי', 'Letter clusters I learned')], ['short', t('מילים קצרות', 'Short words')], ['words', t('מילים', 'Words')], ['long', t('מילים ארוכות', 'Long words')], ['mixed', t('מעורב', 'Mixed')]] }
    ],
    startBanner: () => t('🏰 מבצר המילים', '🏰 Fortress of Words'),
    startSub: () => t('הגנו על הטירה — הקלידו את המילים', 'Defend the castle — type the words'),
    wordsLabel: () => t('מפלצות', 'Monsters'),
    hudLevel: (S) => { const g = S.game; return g && g._wave ? `🌊 ${t('גל', 'Wave')} ${g._wave} · 💰 ${g._gold}` : t('גל', 'Wave') + ' ' + S.level; },
    _endExtra: (S) => { const a = S.fortStats; if (!a) return ''; return `<p class="g3-endnote">🌊 ${t('גלים', 'Waves')}: <b>${a.waves}</b> · 👾 ${t('מפלצות', 'Monsters')}: <b>${a.kills}</b> · 🗼 ${t('מגדלים שנבנו', 'Towers built')}: <b>${a.built}</b> · 👑 ${t('ענקים', 'Giants')}: <b>${a.giants}</b></p>`; },
    _onEnd: (S) => { const st = G3D.store().stats; const a = S.fortStats || {}; st.fortressWaves = Math.max(st.fortressWaves || 0, a.waves || 0); },
    _create: (api) => createFortress(api)
}, {});

function createFortress(api) {
    const T = api.THREE, scene = api.scene, camera = api.camera, cfg = api.cfg, D = api.D, P = api.particles, Q = api.Q;
    const words = galaxyWordSource(cfg);
    scene.background = new T.Color(0x9fd7ff);
    scene.fog = new T.Fog(0xbfe3ff, 90, 230);
    camera.fov = 60; camera.updateProjectionMatrix();
    scene.add(new T.HemisphereLight(0xffffff, 0x3a5a2a, 0.55));
    const sun = new T.DirectionalLight(0xfff0d8, 1.0); sun.position.set(-20, 40, 20); scene.add(sun);
    if (Q.shadows) { sun.castShadow = true; sun.shadow.mapSize.set(1024, 1024); const sc = sun.shadow.camera; sc.left = -45; sc.right = 45; sc.top = 45; sc.bottom = -45; }

    const grass = new T.Mesh(new T.PlaneGeometry(300, 300), new T.MeshStandardMaterial({ color: 0x4c9a3c, roughness: 1 }));
    grass.rotation.x = -Math.PI / 2; grass.receiveShadow = true; scene.add(grass);
    // the road
    const pts = [[24, -62], [28, -46], [10, -38], [-14, -42], [-25, -29], [-11, -18], [13, -16], [19, -5], [6, 2], [0, 8]].map(([x, z]) => new T.Vector3(x, 0, z));
    const curve = new T.CatmullRomCurve3(pts);
    const roadLen = curve.getLength();
    const roadGeo = new T.TubeGeometry(curve, 160, 2.1, 6, false);
    roadGeo.scale(1, 0.04, 1);
    const road = new T.Mesh(roadGeo, new T.MeshStandardMaterial({ color: 0xb8925a, roughness: 1 })); road.position.y = 0.02; road.receiveShadow = true; scene.add(road);
    // trees & rocks
    const treeN = Math.round(90 * Q.part) + 20;
    const trees = new T.InstancedMesh(new T.ConeGeometry(1.2, 3.4, 7).translate(0, 1.7, 0), new T.MeshStandardMaterial({ color: 0x2f7d3a, flatShading: true }), treeN);
    const dm = new T.Object3D(); let placed = 0, tries = 0;
    while (placed < treeN && tries < 3000) {
        tries++;
        const x = (Math.random() - 0.5) * 120, z = -90 + Math.random() * 90;
        let near = false; for (let k = 0; k <= 40; k++) { const p = curve.getPoint(k / 40); if (Math.hypot(p.x - x, p.z - z) < 6) { near = true; break; } }
        if (near || Math.hypot(x, z - 10) < 14) continue;
        dm.position.set(x, 0, z); dm.scale.setScalar(0.7 + Math.random() * 0.9); dm.updateMatrix(); trees.setMatrixAt(placed++, dm.matrix);
    }
    trees.count = placed; trees.castShadow = true; scene.add(trees);

    // ---- castle ----
    const castle = new T.Group(); castle.position.set(0, 0, 12); scene.add(castle);
    const stone = new T.MeshStandardMaterial({ color: 0xb9b3a6, roughness: 0.9 });
    const wall = new T.Mesh(new T.BoxGeometry(12, 4, 2), stone); wall.position.y = 2; wall.castShadow = true; castle.add(wall);
    for (let i = -2; i <= 2; i++) { const c = new T.Mesh(new T.BoxGeometry(1.1, 0.9, 2.2), stone); c.position.set(i * 2.6, 4.45, 0); castle.add(c); }
    const towersC = [];
    [-6.5, 6.5].forEach(x => {
        const tw = new T.Mesh(new T.CylinderGeometry(1.6, 1.8, 7, 12), stone); tw.position.set(x, 3.5, 0); tw.castShadow = true; castle.add(tw);
        const roof = new T.Mesh(new T.ConeGeometry(2.1, 2.6, 12), new T.MeshStandardMaterial({ color: 0x3a5bd9 })); roof.position.set(x, 8.3, 0); castle.add(roof);
        towersC.push(new T.Vector3(x, 7, 12));
    });
    const gate = new T.Mesh(new T.BoxGeometry(2.6, 2.8, 0.3), new T.MeshStandardMaterial({ color: 0x6b4a2b })); gate.position.set(0, 1.4, -1.05); castle.add(gate);
    const flag = new T.Mesh(new T.PlaneGeometry(1.6, 1), new T.MeshStandardMaterial({ color: 0xff4455, side: T.DoubleSide })); flag.position.set(6.5 + 0.8, 10.2, 0); castle.add(flag);
    const pole = new T.Mesh(new T.CylinderGeometry(0.05, 0.05, 2.4), stone); pole.position.set(6.5, 9.9, 0); castle.add(pole);

    // ---- build plots ----
    const PLOT_POS = [[16, -28], [-2, -30], [-18, -8], [4, -9], [24, -18], [-10, 0]];
    const KINDS = {
        frost: { icon: '❄️', cost: 30, color: 0x7fd6ff, he: 'מגדל קרח', en: 'Frost tower', range: 13 },
        fire: { icon: '🔥', cost: 40, color: 0xff7a33, he: 'מגדל אש', en: 'Fire tower', range: 12 },
        mason: { icon: '🧱', cost: 55, color: 0xd9b27a, he: 'בנאי', en: 'Mason', range: 0 }
    };
    const plots = PLOT_POS.map(([x, z], i) => {
        const g = new T.Group(); g.position.set(x, 0, z); scene.add(g);
        const base = new T.Mesh(new T.CylinderGeometry(2, 2.2, 0.4, 16), new T.MeshStandardMaterial({ color: 0x9a8a6a, roughness: 1 })); base.position.y = 0.2; g.add(base);
        return { g, i, kind: null, lvl: 0, sign: null, word: null, chars: null, typed: 0, offer: null, mesh: null, cool: 0 };
    });
    function clearSign(p) { if (p.sign) { p.sign.dispose(); p.g.remove(p.sign.sprite); p.sign = null; } p.word = null; p.chars = null; p.typed = 0; p.offer = null; }
    function offerSigns() {
        const kinds = Object.keys(KINDS);
        plots.forEach((p, i) => {
            clearSign(p);
            const kind = p.kind || kinds[(i + api.level) % kinds.length];
            const k = KINDS[kind];
            const cost = Math.round(k.cost * (1 + p.lvl * 0.6));
            if (p.lvl >= 3) return;
            let w = words.next(Math.max(1, api.level - 1)); if (Array.from(w).length > 6) w = words.next(1);
            p.offer = kind; p.cost = cost; p.word = w; p.chars = Array.from(w); p.typed = 0;
            p.sign = G3D.makeLabel(`${k.icon}${p.lvl ? '⬆' : ''} ${w}  💰${cost}`, { px: 60, height: 2.0, color: gold >= cost ? '#ffffff' : '#ff9aa8', bg: 'rgba(30,20,10,0.82)', border: '#' + new T.Color(k.color).getHexString(), depthTest: false });
            p.sign.sprite.position.set(0, (p.mesh ? 7 : 4), 0); p.g.add(p.sign.sprite);
        });
    }
    function refreshSigns() {
        plots.forEach(p => { if (p.sign && p.offer) { const k = KINDS[p.offer]; p.sign.setColors({ color: gold >= p.cost ? '#ffffff' : '#ff9aa8' }); if (p.typed) p.sign.setTyped(0); } });
    }
    function build(p) {
        const kind = p.offer, k = KINDS[kind];
        gold -= p.cost; p.kind = kind; p.lvl++;
        stats.built++;
        if (!p.mesh) {
            const m = new T.Group();
            const body = new T.Mesh(new T.CylinderGeometry(0.9, 1.2, 3.2, 10), new T.MeshStandardMaterial({ color: 0xcfc6b4, roughness: 0.9 })); body.position.y = 2; m.add(body);
            const top = new T.Mesh(kind === 'mason' ? new T.BoxGeometry(1.6, 1.2, 1.6) : new T.OctahedronGeometry(0.9, 0), new T.MeshStandardMaterial({ color: k.color, emissive: k.color, emissiveIntensity: 0.5 })); top.position.y = 4.2; m.add(top);
            m.userData.top = top; p.g.add(m); p.mesh = m;
        }
        p.mesh.scale.setScalar(1 + (p.lvl - 1) * 0.18);
        if (kind === 'mason') { api.heal(1); api.popup('🏰 +1', castle.position.clone().add(new T.Vector3(0, 6, 0)), 'gold'); }
        api.audio.sfx('power');
        P.emit(p.g.position.clone().add(new T.Vector3(0, 3, 0)), Math.round(50 * Q.part) + 6, { color: k.color, color2: 0xffffff, speed: 6, size: 0.6, life: 0.8, up: 3 });
        api.banner(`${k.icon} ${t(k.he, k.en)}${p.lvl > 1 ? ' ' + t('שלב', 'lv') + ' ' + p.lvl : ''}`, t('נבנה!', 'Built!'), 'small power', 1100);
        api.addScore(40 * api.level);
        clearSign(p);
        if (phase === 'build') offerSigns();
    }

    // ---- enemies ----
    const enemies = [];
    const KIND_E = {
        slime: { col: 0x7be07b, speed: 3.0, hp: 'words', size: 1, gold: 6 },
        runner: { col: 0xffd24a, speed: 5.4, hp: 'short', size: 0.8, gold: 5 },
        knight: { col: 0x8892a8, speed: 2.0, hp: 'long', size: 1.3, gold: 10 },
        bat: { col: 0xb067ff, speed: 4.2, hp: 'short', size: 0.8, gold: 7, fly: true },
        giant: { col: 0xff5577, speed: 1.35, hp: 'phrase', size: 2.4, gold: 40 }
    };
    function makeEnemyMesh(kind) {
        const k = KIND_E[kind], g = new T.Group();
        const mat = new T.MeshStandardMaterial({ color: k.col, roughness: 0.5, flatShading: kind === 'knight' });
        let body;
        if (kind === 'slime' || kind === 'runner') { body = new T.Mesh(new T.SphereGeometry(0.8, 14, 10), mat); body.scale.y = 0.75; body.position.y = 0.6; }
        else if (kind === 'knight' || kind === 'giant') { body = new T.Mesh(new T.CapsuleGeometry(0.55, 0.9, 4, 10), mat); body.position.y = 1.1; const helm = new T.Mesh(new T.ConeGeometry(0.5, 0.7, 8), new T.MeshStandardMaterial({ color: 0x555b6e, metalness: 0.6 })); helm.position.y = 2.2; g.add(helm); }
        else { body = new T.Mesh(new T.SphereGeometry(0.55, 12, 8), mat); body.position.y = 0.5; [-1, 1].forEach(s => { const w = new T.Mesh(new T.ConeGeometry(0.5, 1.2, 3), mat); w.rotation.z = s * Math.PI / 2; w.position.set(s * 0.9, 0.6, 0); g.add(w); g.userData.wings = (g.userData.wings || []).concat([w]); }); }
        g.add(body);
        [-0.25, 0.25].forEach(x => { const e = new T.Mesh(new T.SphereGeometry(0.13, 8, 6), new T.MeshBasicMaterial({ color: 0xffffff })); e.position.set(x, body.position.y + 0.25, 0.62); g.add(e); const pu = new T.Mesh(new T.SphereGeometry(0.06, 6, 4), new T.MeshBasicMaterial({ color: 0x111111 })); pu.position.set(x, body.position.y + 0.25, 0.72); g.add(pu); });
        g.scale.setScalar(k.size * 1.6);
        g.traverse(o => { if (o.isMesh) o.castShadow = true; });
        return g;
    }
    function enemyWord(kind) {
        const lvl = api.level;
        if (kind === 'phrase') { const n = 2 + Math.min(2, Math.floor(lvl / 5)); const ws = []; for (let i = 0; i < n; i++) ws.push(words.next(Math.max(1, lvl - 2))); return ws.join(' '); }
        let w;
        for (let i = 0; i < 6; i++) {
            w = words.next(lvl);
            const n = Array.from(w).length;
            if (kind === 'short' && n <= 4) break;
            if (kind === 'long' && n >= 5) break;
            if (kind === 'words') break;
        }
        return w;
    }
    function spawnEnemy(kind) {
        const k = KIND_E[kind];
        let w, tries = 0;
        do { w = enemyWord(k.hp); tries++; } while (enemies.some(e => e.alive && Array.from(e.word)[0] === Array.from(w)[0]) && tries < 8);
        const g = makeEnemyMesh(kind); scene.add(g);
        const lab = G3D.makeLabel(w, { px: 64, height: kind === 'giant' ? 2.6 : 2.1, typedColor: '#5cf2a0', bg: 'rgba(12,10,30,0.8)', border: kind === 'giant' ? '#ff5577' : 'rgba(255,255,255,0.5)', depthTest: false });
        lab.sprite.position.set(0, (kind === 'giant' ? 4.2 : 3.4) / (k.size * 1.6) + 1.2, 0); lab.sprite.scale.multiplyScalar(1 / (k.size * 1.6)); g.add(lab.sprite);
        const e = { kind, k, g, lab, word: w, chars: Array.from(w), typed: 0, u: 0, alive: true, slow: 0, wob: Math.random() * 6, flyFrom: new T.Vector3((Math.random() - 0.5) * 40, 6, -62), burnT: 0 };
        enemies.push(e);
        if (kind === 'giant') { api.banner('👑 ' + t('ענק מתקרב!', 'A giant approaches!'), t('הקלידו את כל המשפט', 'Type the whole phrase'), 'boss', 1800); api.audio.sfx('bigexplode'); stats.giants++; }
    }
    function enemyPos(e, out) {
        if (e.k.fly) { const f = Math.min(1, e.u); out.copy(e.flyFrom).lerp(new T.Vector3(0, 4, 10), f); out.y = 5 + Math.sin(e.wob * 3) * 0.6; return out; }
        return out.copy(curve.getPointAt(Math.min(1, e.u)));
    }

    // ---- arrows ----
    const arrows = [];
    const arrowGeo = new T.CylinderGeometry(0.05, 0.05, 1.2, 5); arrowGeo.rotateX(Math.PI / 2);
    const arrowMat = new T.MeshBasicMaterial({ color: 0xfff1b0 });
    function shoot(e, final) {
        const from = towersC[arrows.length % 2].clone();
        const m = new T.Mesh(arrowGeo, arrowMat); m.position.copy(from); scene.add(m);
        arrows.push({ m, e, t: 0, from, final });
        api.audio.sfx('laser');
    }

    // ---- waves ----
    let wave = 0, phase = 'build', phaseT = 4, toSpawn = [], spawnT = 0, gold = 30, target = null, time = 0;
    const stats = { waves: 0, kills: 0, built: 0, giants: 0 };
    function startWave() {
        wave++; phase = 'wave';
        plots.forEach(clearSign);
        const n = 4 + wave * 2;
        toSpawn = [];
        for (let i = 0; i < n; i++) {
            const r = Math.random();
            toSpawn.push(wave >= 4 && r < 0.18 ? 'knight' : wave >= 3 && r < 0.36 ? 'bat' : wave >= 2 && r < 0.6 ? 'runner' : 'slime');
        }
        if (wave % 5 === 0) toSpawn.push('giant');
        spawnT = 1;
        api.banner(`🌊 ${t('גל', 'Wave')} ${wave}`, `${toSpawn.length} ${t('מפלצות', 'monsters')}`, 'level', 1500);
        api.audio.sfx('warp');
    }
    function endWave() {
        stats.waves = wave;
        phase = 'build'; phaseT = 9;
        gold += 15 + wave * 3;
        api.levelUp(t('בנו מגדלים — הקלידו את המילה שעל שלט', 'Build towers — type the word on a sign'));
        offerSigns();
    }

    // ---- input ----
    function lockables() {
        const list = enemies.filter(e => e.alive).map(e => ({ type: 'e', o: e, ch: e.chars[0], pri: e.u }));
        plots.forEach(p => { if (p.word && gold >= p.cost) list.push({ type: 'p', o: p, ch: p.chars[0], pri: -1 }); });
        return list;
    }
    function tgtChars() { return target ? target.o.chars : null; }
    function tgtTyped() { return target ? target.o.typed : 0; }
    function expected() {
        if (target) return target.o.chars[target.o.typed] || '';
        const l = lockables().sort((a, b) => b.pri - a.pri)[0];
        return l ? l.ch : '';
    }
    function hint() {
        const ch = expected();
        api.hud.hint(ch, target ? target.o.word + '|' + target.o.typed : 'free|' + ch + '|' + wave);
        api.hud.typed(target ? target.o.chars.slice(0, target.o.typed).join('') : '');
    }
    function setLabelTyped() { if (!target) return; if (target.type === 'e') target.o.lab.setTyped(target.o.typed); else target.o.sign.setTyped(0); }
    let lastKeyT = performance.now();
    function onChar(ch) {
        const now = performance.now();
        if (!target) {
            const c = lockables().filter(l => l.ch === ch).sort((a, b) => b.pri - a.pri)[0];
            api.track(expected(), ch, now - lastKeyT); lastKeyT = now;
            if (!c) { api.keyBad(); hint(); return; }
            target = c; api.audio.sfx('lock');
            if (c.type === 'p') { c.o.typed = 0; }
        } else {
            api.track(target.o.chars[target.o.typed], ch, now - lastKeyT); lastKeyT = now;
            if (ch !== target.o.chars[target.o.typed]) { api.keyBad(); hint(); return; }
        }
        api.keyOk();
        const o = target.o;
        o.typed++;
        if (target.type === 'e') {
            o.lab.setTyped(o.typed);
            if (o.chars[o.typed - 1] !== ' ') shoot(o, o.typed >= o.chars.length);
            if (o.typed >= o.chars.length) { const e = o; target = null; e.dying = true; }
        } else {
            const p = o;
            p.sign.setColors({ color: '#5cf2a0' });
            if (p.typed >= p.chars.length) { target = null; api.wordDone(10 + p.chars.length * 5, p.g.position.clone().add(new T.Vector3(0, 5, 0))); build(p); }
        }
        hint();
    }
    function onBackspace() { if (target) { if (target.type === 'e') target.o.lab.setTyped(0); target.o.typed = 0; target = null; refreshSigns(); hint(); } }
    function kill(e) {
        e.alive = false;
        const pos = enemyPos(e, new T.Vector3());
        P.emit(pos.clone().add(new T.Vector3(0, 1, 0)), Math.round((e.kind === 'giant' ? 160 : 45) * Q.part) + 6, { color: e.k.col, color2: 0xffffff, speed: e.kind === 'giant' ? 11 : 6, size: 0.6, life: 0.9, gravity: 5 });
        api.audio.sfx(e.kind === 'giant' ? 'bigexplode' : 'explode');
        api.shake(e.kind === 'giant' ? 0.6 : 0.12);
        gold += e.k.gold; stats.kills++;
        api.popup(`💰+${e.k.gold}`, pos.clone().add(new T.Vector3(1.4, 2.2, 0)), 'gold');
        api.wordDone((e.kind === 'giant' ? 60 : 12) + e.chars.length * 7, pos.clone().add(new T.Vector3(0, 3, 0)), { cls: e.kind === 'giant' ? 'boss' : '' });
        removeEnemy(e);
    }
    function removeEnemy(e) { e.alive = false; e.lab.dispose(); scene.remove(e.g); const i = enemies.indexOf(e); if (i >= 0) enemies.splice(i, 1); if (target && target.o === e) target = null; }

    // ---- loop ----
    const camPos = new T.Vector3(0, 40, 32), look = new T.Vector3(0, 0, -20), tmp = new T.Vector3();
    function update(dt, realDt) {
        time += realDt;
        if (phase === 'build') {
            phaseT -= dt;
            api.hud.extra(`<div class="gp-phase">🔨 ${t('זמן בנייה', 'Build time')} · ${Math.ceil(phaseT)}${t('ש׳', 's')} · 💰 ${gold}</div>`);
            if (phaseT <= 0 && !api.isDying() && !(target && target.type === 'p')) { api.hud.extra(''); startWave(); }
        } else {
            spawnT -= dt;
            if (toSpawn.length && spawnT <= 0) { spawnEnemy(toSpawn.shift()); spawnT = Math.max(0.7, (2.4 - wave * 0.08) * D.spawn); }
            if (!toSpawn.length && !enemies.length) endWave();
            api.setLevelProgress(1 - (toSpawn.length + enemies.length) / Math.max(1, 4 + wave * 2 + (wave % 5 === 0 ? 1 : 0)));
        }
        // towers act
        plots.forEach(p => {
            if (!p.kind || !p.mesh) return;
            p.mesh.userData.top.rotation.y += realDt * 1.5;
            const k = KINDS[p.kind];
            if (p.kind === 'frost') enemies.forEach(e => { if (e.alive && !e.k.fly && enemyPos(e, tmp).distanceTo(p.g.position) < k.range + p.lvl * 2) e.slow = 0.35 + p.lvl * 0.1; });
            if (p.kind === 'fire') {
                p.cool -= dt;
                if (p.cool <= 0) {
                    const e = enemies.filter(x => x.alive && x !== (target && target.o) && x.typed < x.chars.length - 1 && enemyPos(x, tmp).distanceTo(p.g.position) < k.range + p.lvl * 2).sort((a, b) => b.u - a.u)[0];
                    if (e) {
                        p.cool = Math.max(1.4, 4 - p.lvl * 0.8);
                        // burn the last letter off the word
                        e.chars.pop(); e.word = e.chars.join('');
                        if (e.chars[e.chars.length - 1] === ' ') e.chars.pop();
                        e.lab.dispose(); e.g.remove(e.lab.sprite);
                        e.lab = G3D.makeLabel(e.chars.join(''), { px: 64, height: e.kind === 'giant' ? 2.6 : 2.1, typedColor: '#5cf2a0', bg: 'rgba(40,10,0,0.85)', border: '#ff7a33', depthTest: false });
                        e.lab.sprite.position.set(0, (e.kind === 'giant' ? 4.2 : 3.4) / (e.k.size * 1.6) + 1.2, 0); e.lab.sprite.scale.multiplyScalar(1 / (e.k.size * 1.6)); e.g.add(e.lab.sprite); e.lab.setTyped(e.typed);
                        P.emit(enemyPos(e, tmp).clone().add(new T.Vector3(0, 2.5, 0)), 16, { color: 0xff7a33, color2: 0xffe066, speed: 4, size: 0.5, life: 0.6, up: 3 });
                        if (e.typed >= e.chars.length) kill(e);
                    } else p.cool = 0.5;
                }
            }
        });
        // enemies move
        for (let i = enemies.length - 1; i >= 0; i--) {
            const e = enemies[i];
            if (e.dying) { e.dieT = (e.dieT || 0) + realDt; if (e.dieT > 0.25) kill(e); continue; }
            const sp = e.k.speed * D.speed * (1 + (wave - 1) * 0.035) * (1 - (e.slow || 0)) * (target && target.o === e ? 0.75 : 1);
            e.slow = Math.max(0, (e.slow || 0) - realDt * 0.8);
            e.u += sp * dt / (e.k.fly ? 85 : roadLen);
            e.wob += realDt;
            enemyPos(e, e.g.position);
            const ahead = e.k.fly ? new T.Vector3(0, e.g.position.y, 12) : curve.getPointAt(Math.min(1, e.u + 0.01));
            e.g.lookAt(ahead.x, e.g.position.y, ahead.z);
            e.g.position.y += e.k.fly ? 0 : Math.abs(Math.sin(e.wob * 6)) * 0.25;
            if (e.g.userData.wings) e.g.userData.wings.forEach((w, j) => { w.rotation.x = Math.sin(e.wob * 14) * 0.6 * (j ? 1 : -1); });
            if (e.slow > 0.05) e.g.children[0] && e.g.traverse(o => { if (o.isMesh && o.material.emissive) o.material.emissive.setHex(0x1a4a66); });
            else e.g.traverse(o => { if (o.isMesh && o.material.emissive) o.material.emissive.setHex(0x000000); });
            if (e.u >= 1) {
                api.audio.sfx('crash'); api.shake(0.5);
                P.emit(new T.Vector3(e.g.position.x, 2, 10), 40, { color: 0xb9b3a6, speed: 6, size: 0.8, life: 0.8, gravity: 6 });
                api.banner('💥 ' + t('המפלצת פגעה בחומה!', 'A monster hit the wall!'), '', 'small boss', 900);
                removeEnemy(e);
                api.damage(e.kind === 'giant' ? 2 : 1);
                hint();
            }
        }
        // arrows fly
        for (let i = arrows.length - 1; i >= 0; i--) {
            const a = arrows[i];
            a.t += realDt * 3.2;
            const to = a.e.g.parent ? a.e.g.position.clone().add(new T.Vector3(0, 1, 0)) : a.to || a.from;
            a.to = to;
            a.m.position.lerpVectors(a.from, to, Math.min(1, a.t));
            a.m.position.y += Math.sin(Math.min(1, a.t) * Math.PI) * 3;
            a.m.lookAt(to);
            if (a.t >= 1) { scene.remove(a.m); arrows.splice(i, 1); P.emit(to, 6, { color: 0xfff1b0, speed: 3, size: 0.3, life: 0.3 }); }
        }
        flag.rotation.y = Math.sin(time * 3) * 0.3;
        camPos.set(Math.sin(time * 0.05) * 3, 40, 32);
        api.setCameraBase(camPos);
        // labels keep the same size on screen wherever they are on the map
        enemies.forEach(e => { const sp = e.lab.sprite; if (!sp.userData.s0) sp.userData.s0 = sp.scale.clone(); const k = Math.max(0.8, camera.position.distanceTo(e.g.position) / 42); sp.scale.copy(sp.userData.s0).multiplyScalar(k); });
        plots.forEach(p => { if (p.sign) { const sp = p.sign.sprite; if (!sp.userData.s0) sp.userData.s0 = sp.scale.clone(); const k = Math.max(0.8, camera.position.distanceTo(p.g.position) / 42); sp.scale.copy(sp.userData.s0).multiplyScalar(k); } });
        if (Math.random() < 0.25) hint();
    }
    function afterCamera() { camera.lookAt(look); }
    function ambient(dt) { time += dt; flag.rotation.y = Math.sin(time * 3) * 0.3; }
    camera.position.copy(camPos); camera.lookAt(look);
    offerSigns();
    return {
        update, onChar, expected, ambient, afterCamera, onBackspace,
        get _wave() { return Math.max(1, wave); }, get _gold() { return gold; },
        dispose() { enemies.forEach(e => e.lab.dispose()); plots.forEach(clearSign); },
        _syncStats(S) { S.fortStats = stats; }
    };
}
