// ---- 3.3: "Key Arena" (זירת המקשים) — whack-a-key on a giant 3D keyboard ----
// A huge keyboard lies on a neon stage, laid out exactly like yours and coloured
// by finger zone. Keys pop up with a shrinking timing ring — hit the key before
// the ring closes. The game leans toward YOUR weak letters (from the learner
// model) and toward keys you miss during the game. From level 3, whole words
// light up as a numbered path across the keyboard. Teaches key positions and
// fingers, and measures reaction time per key.

const ARENA_DEF = {
    id: 'arena', icon: '🔨', theme: 'g3-arena', music: 'arena',
    lifeIcon: '💚', lifeIconOff: '🤍',
    title: () => t('זירת המקשים', 'Key Arena'),
    desc: () => t('מקלדת ענקית בתלת־ממד, בדיוק כמו שלכם וצבועה לפי אצבעות. מקשים קופצים עם טבעת זמן מתכווצת — הקישו עליהם לפני שהטבעת נסגרת! המשחק מתמקד באותיות החלשות שלכם, ומשלב 3 גם מילים שלמות מסומנות כמסלול על המקלדת.', 'A giant 3D keyboard laid out like yours and coloured by finger. Keys pop up with a shrinking timing ring — hit them before it closes! The game focuses on your weak letters, and from level 3 whole words light up as a numbered path.'),
    trains: () => t('מתאמן על: מיקום המקשים, האצבע הנכונה וזמן תגובה — בלי להסתכל על הידיים', 'Trains: key positions, the right finger and reaction time — without looking at your hands'),
    keysHelp: () => t('הקישו על המקש שקפץ · Esc = השהיה', 'Press the key that popped up · Esc = pause'),
    defaults: { focus: 'auto', fingerColors: true, chains: true },
    options: () => [
        { key: 'focus', label: t('אילו מקשים', 'Which keys'), choices: [['auto', t('חכם — האותיות החלשות שלי', 'Smart — my weak letters')], ['known', t('רק אותיות שלמדתי', 'Only letters I learned')], ['all', t('כל האותיות', 'All letters')], ['home', t('שורת הבית', 'Home row')], ['top', t('השורה העליונה', 'Top row')], ['bottom', t('השורה התחתונה', 'Bottom row')]] },
        { key: 'fingerColors', label: t('צביעת המקשים לפי אצבע', 'Colour keys by finger'), toggle: true },
        { key: 'chains', label: t('מסלולי מילים (משלב 3)', 'Word paths (from level 3)'), toggle: true }
    ],
    startBanner: () => t('🔨 זירת המקשים', '🔨 Key Arena'),
    startSub: () => t('הקישו לפני שהטבעת נסגרת', 'Hit before the ring closes'),
    wordsLabel: () => t('פגיעות', 'Hits'),
    endExtra: (S) => {
        const a = S.arenaStats;
        if (!a || !a.hits) return '';
        return `<p class="g3-endnote">⚡ ${t('זמן תגובה ממוצע', 'Average reaction')}: <b>${(a.rtSum / a.hits / 1000).toFixed(2)} ${t('ש׳', 's')}</b> · ${t('הכי מהיר', 'Fastest')}: <b>${(a.best / 1000).toFixed(2)}</b>${a.chains ? ` · 🔗 ${t('מסלולי מילים', 'Word paths')}: <b>${a.chains}</b>` : ''}${a.perfect ? ` · 🎯 ${t('פגיעות בזק', 'Lightning hits')}: <b>${a.perfect}</b>` : ''}</p>`;
    },
    onEnd: (S) => { const st = G3D.store().stats; const a = S.arenaStats || {}; st.arenaHits = (st.arenaHits || 0) + (a.hits || 0); st.arenaChains = (st.arenaChains || 0) + (a.chains || 0); if (a.hits) st.arenaBestRt = Math.min(st.arenaBestRt || 99999, a.best); },
    create: (api) => createArena(api)
};

const ARENA_FINGER_COLORS = { lp: 0xf7a8b8, rp: 0xf7a8b8, lr: 0xf7d58c, rr: 0xf7d58c, lm: 0xa8e6a0, rm: 0xa8e6a0, li: 0xa6cbf7, ri: 0xa6cbf7, th: 0xc8b5f2 };

function createArena(api) {
    const T = api.THREE, scene = api.scene, camera = api.camera, cfg = api.cfg, D = api.D, P = api.particles, Q = api.Q;
    const layout = getCurrentKeyboardLayout();
    const en = isEnglishTyping();

    scene.background = new T.Color(0x090b1c);
    scene.fog = new T.Fog(0x090b1c, 40, 120);
    camera.fov = 50; camera.near = 0.1; camera.far = 400; camera.updateProjectionMatrix();
    camera.position.set(0, 18.5, 14.5); api.setCameraBase(camera.position);
    const look = new T.Vector3(0, 0, 0.6);

    // ---- lights ----
    scene.add(new T.HemisphereLight(0x9fb4ff, 0x1a1030, 0.7));
    const key = new T.DirectionalLight(0xffffff, 0.9); key.position.set(-6, 20, 12); scene.add(key);
    const movers = [0xff3d9a, 0x3dc8ff, 0xffd34d].map((c, i) => { const l = new T.PointLight(c, 1.4, 40); l.position.set(0, 7, 0); scene.add(l); return l; });

    // ---- stage ----
    const floorTex = G3D.canvasTexture(512, 512, (ctx, w, h) => {
        const g = ctx.createRadialGradient(w / 2, h / 2, 10, w / 2, h / 2, w / 2);
        g.addColorStop(0, '#1d2350'); g.addColorStop(1, '#070816');
        ctx.fillStyle = g; ctx.fillRect(0, 0, w, h);
        ctx.strokeStyle = 'rgba(90,140,255,0.25)'; ctx.lineWidth = 1;
        for (let i = 0; i <= w; i += 32) { ctx.beginPath(); ctx.moveTo(i, 0); ctx.lineTo(i, h); ctx.stroke(); ctx.beginPath(); ctx.moveTo(0, i); ctx.lineTo(w, i); ctx.stroke(); }
    });
    const floor = new T.Mesh(new T.CircleGeometry(60, 64), new T.MeshStandardMaterial({ map: floorTex, roughness: 0.6, metalness: 0.3 }));
    floor.rotation.x = -Math.PI / 2; floor.position.y = -1.95; scene.add(floor);
    const neon = new T.Mesh(new T.TorusGeometry(21, 0.12, 8, 120), new T.MeshBasicMaterial({ color: 0x55aaff }));
    neon.rotation.x = Math.PI / 2; neon.position.y = -1.85; scene.add(neon);
    const neon2 = new T.Mesh(new T.TorusGeometry(24, 0.08, 8, 120), new T.MeshBasicMaterial({ color: 0xff55aa }));
    neon2.rotation.x = Math.PI / 2; neon2.position.y = -1.85; scene.add(neon2);
    // keyboard case
    const caseShape = new T.Shape();
    const CW = 30, CH = 11.6, CR = 1.2;
    caseShape.moveTo(-CW / 2 + CR, -CH / 2); caseShape.lineTo(CW / 2 - CR, -CH / 2); caseShape.quadraticCurveTo(CW / 2, -CH / 2, CW / 2, -CH / 2 + CR);
    caseShape.lineTo(CW / 2, CH / 2 - CR); caseShape.quadraticCurveTo(CW / 2, CH / 2, CW / 2 - CR, CH / 2); caseShape.lineTo(-CW / 2 + CR, CH / 2);
    caseShape.quadraticCurveTo(-CW / 2, CH / 2, -CW / 2, CH / 2 - CR); caseShape.lineTo(-CW / 2, -CH / 2 + CR); caseShape.quadraticCurveTo(-CW / 2, -CH / 2, -CW / 2 + CR, -CH / 2);
    const caseGeo = new T.ExtrudeGeometry(caseShape, { depth: 1.1, bevelEnabled: true, bevelSize: 0.25, bevelThickness: 0.25, bevelSegments: 3 });
    caseGeo.rotateX(-Math.PI / 2);
    const kbCase = new T.Mesh(caseGeo, new T.MeshStandardMaterial({ color: 0x1b1e2c, metalness: 0.7, roughness: 0.35 }));
    kbCase.position.set(0, -1.62, 0.9); scene.add(kbCase);
    const caseGlow = new T.Mesh(new T.PlaneGeometry(CW + 3, CH + 3), new T.MeshBasicMaterial({ map: G3D.glowTexture('rgba(80,140,255,0.6)', 'rgba(60,90,255,0.25)'), transparent: true, depthWrite: false, blending: T.AdditiveBlending }));
    caseGlow.rotation.x = -Math.PI / 2; caseGlow.position.set(0, -1.9, 0.9); caseGlow.scale.set(1.25, 1.6, 1); scene.add(caseGlow);

    // ---- keys ----
    const U = 2.25; // world units per key
    const ROWS = [KEYBOARD_ROWS[1], KEYBOARD_ROWS[2], KEYBOARD_ROWS[3].filter(c => !/Shift/.test(c))];
    const INDENT = [1.5, 1.8, 2.25];
    const capShape = new T.Shape();
    const S2 = 0.86, R2 = 0.22;
    capShape.moveTo(-S2 + R2, -S2); capShape.lineTo(S2 - R2, -S2); capShape.quadraticCurveTo(S2, -S2, S2, -S2 + R2); capShape.lineTo(S2, S2 - R2); capShape.quadraticCurveTo(S2, S2, S2 - R2, S2);
    capShape.lineTo(-S2 + R2, S2); capShape.quadraticCurveTo(-S2, S2, -S2, S2 - R2); capShape.lineTo(-S2, -S2 + R2); capShape.quadraticCurveTo(-S2, -S2, -S2 + R2, -S2);
    const capGeo = new T.ExtrudeGeometry(capShape, { depth: 0.6, bevelEnabled: true, bevelSize: 0.12, bevelThickness: 0.14, bevelSegments: 3 });
    capGeo.rotateX(-Math.PI / 2);
    const labelGeo = new T.PlaneGeometry(1.55, 1.55); labelGeo.rotateX(-Math.PI / 2);
    const ringGeo = new T.RingGeometry(1.2, 1.42, 48); ringGeo.rotateX(-Math.PI / 2);
    const haloTex = G3D.glowTexture('rgba(255,255,255,0.9)', 'rgba(120,200,255,0.4)');
    function keyTexture(ch, code) {
        return G3D.canvasTexture(128, 128, (ctx, w, h) => {
            ctx.clearRect(0, 0, w, h);
            ctx.fillStyle = '#16192a';
            ctx.font = `bold 78px 'David','Arial Hebrew','Segoe UI',sans-serif`; ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
            ctx.fillText(ch, w / 2, h / 2 + 6);
            const latin = !en && ENGLISH_LAYOUT[code] ? ENGLISH_LAYOUT[code].toUpperCase() : '';
            if (latin && /[A-Z]/.test(latin)) { ctx.font = `bold 24px 'Segoe UI',sans-serif`; ctx.fillStyle = 'rgba(22,25,42,0.45)'; ctx.fillText(latin, w - 20, 20); }
            if (code === 'KeyF' || code === 'KeyJ') { ctx.fillStyle = '#16192a'; ctx.fillRect(w / 2 - 14, h - 18, 28, 5); }
        });
    }
    const keys = {};
    const allKeys = [];
    ROWS.forEach((row, ri) => {
        const rowWidth = INDENT[ri] + row.length;
        row.forEach((code, ci) => {
            const ch = layout[code];
            if (ch == null) return;
            const x = (INDENT[ri] + ci + 0.5 - 7.15) * U;
            const z = (ri - 1) * U + 0.9;
            const finger = KEY_TO_FINGER[code];
            const baseColor = new T.Color(cfg.fingerColors ? ARENA_FINGER_COLORS[finger] || 0xdddddd : 0xdfe3ec);
            const mat = new T.MeshStandardMaterial({ color: baseColor.clone(), roughness: 0.45, metalness: 0.1, emissive: 0x000000 });
            const g = new T.Group();
            const cap = new T.Mesh(capGeo, mat); g.add(cap);
            const lbl = new T.Mesh(labelGeo, new T.MeshBasicMaterial({ map: keyTexture(ch, code), transparent: true, depthWrite: false }));
            lbl.position.y = 0.76; g.add(lbl);
            g.position.set(x, -0.6, z);
            scene.add(g);
            const k = { code, ch, finger, g, cap, mat, baseColor, x, z, y: -0.6, vy: 0, state: 'idle', life: 0, left: 0, ring: null, halo: null, kind: 'normal', badge: null, squash: 0, shakeT: 0, pulse: 0 };
            keys[code] = k; allKeys.push(k);
        });
    });
    void (0);

    // ---- mallet ----
    const mallet = new T.Group();
    const handle = new T.Mesh(new T.CylinderGeometry(0.16, 0.2, 4.2, 10), new T.MeshStandardMaterial({ color: 0xb07a45, roughness: 0.7 }));
    handle.position.y = 2.1; mallet.add(handle);
    const head = new T.Mesh(new T.CylinderGeometry(0.75, 0.75, 2.0, 18), new T.MeshStandardMaterial({ color: 0xe8384f, roughness: 0.35, metalness: 0.2 }));
    head.rotation.z = Math.PI / 2; head.position.y = 4.3; mallet.add(head);
    [-1, 1].forEach(s => { const band = new T.Mesh(new T.CylinderGeometry(0.78, 0.78, 0.2, 18), new T.MeshStandardMaterial({ color: 0xffd34d, metalness: 0.6, roughness: 0.3 })); band.rotation.z = Math.PI / 2; band.position.set(s * 0.75, 4.3, 0); mallet.add(band); });
    const pivot = new T.Group(); pivot.add(mallet); scene.add(pivot); pivot.visible = false;
    let malletT = 0, malletDur = 0.32;
    function swingAt(k, dur) { pivot.visible = true; malletT = malletDur = dur; pivot.position.set(k.x + 4.3, 1.55, k.z); pivot.rotation.z = 0.35; }

    // ---- pools ----
    const known = new Set(Array.from(getKnownKeys()));
    const rowSet = (ri) => new Set(ROWS[ri].map(c => layout[c]));
    function basePool() {
        const letters = allKeys.filter(k => isLetterChar(k.ch));
        switch (cfg.focus) {
            case 'all': return letters;
            case 'home': return letters.filter(k => rowSet(1).has(k.ch));
            case 'top': return letters.filter(k => rowSet(0).has(k.ch));
            case 'bottom': return letters.filter(k => rowSet(2).has(k.ch));
            default: {
                const kn = letters.filter(k => known.has(k.ch));
                return kn.length >= 3 ? kn : letters.filter(k => rowSet(1).has(k.ch));
            }
        }
    }
    const pool = basePool();
    const weight = {};
    pool.forEach(k => { weight[k.ch] = 1; });
    if (cfg.focus === 'auto' || cfg.focus === 'known') {
        try { getWeakCharacters(6).forEach((w, i) => { if (weight[w.ch]) weight[w.ch] += 3 - i * 0.3; }); } catch (e) {}
        pool.forEach(k => { const st = appData.charStats[k.ch]; if (!st || st.attempts < 5) weight[k.ch] += 0.6; });
    }
    function pickKey() {
        const free = pool.filter(k => k.state === 'idle');
        if (!free.length) return null;
        let tot = 0; free.forEach(k => { tot += weight[k.ch]; });
        let r = Math.random() * tot;
        for (const k of free) { r -= weight[k.ch]; if (r <= 0) return k; }
        return free[free.length - 1];
    }
    // highlight the pool on the board so the learner sees which keys are in play
    allKeys.forEach(k => { if (!pool.includes(k)) { k.mat.color.multiplyScalar(0.45); k.baseColor.multiplyScalar(0.45); } });

    // ---- state ----
    const stats = { hits: 0, rtSum: 0, best: 99999, chains: 0, perfect: 0 };
    let active = [];       // popped keys, oldest first
    let spawnT = 1.4, hits = 0, chain = null, chainCooldown = 12, freeze = 0, time = 0;
    const hitsNeeded = () => 10 + api.level * 2;
    const lifeFor = () => Math.max(0.95, (3.3 - api.level * 0.17)) / D.speed;
    const maxActive = () => Math.min(D.max, 1 + Math.floor((api.level + 1) / 2));

    function popKey(k, kind, life) {
        k.state = 'up'; k.kind = kind || 'normal'; k.life = k.left = life || lifeFor(); k.popT = performance.now(); k.vy = 9;
        const col = k.kind === 'gold' ? 0xffd34d : k.kind === 'ice' ? 0x7fe8ff : k.kind === 'chain' ? 0xc58bff : 0x5cf2a0;
        k.ring = new T.Mesh(ringGeo, new T.MeshBasicMaterial({ color: col, transparent: true, opacity: 0.95, blending: T.AdditiveBlending, depthWrite: false }));
        k.ring.position.set(k.x, -0.18, k.z); scene.add(k.ring);
        k.halo = new T.Sprite(new T.SpriteMaterial({ map: haloTex, color: col, transparent: true, blending: T.AdditiveBlending, depthWrite: false, opacity: 0.8 }));
        k.halo.scale.set(4.2, 4.2, 1); k.halo.position.set(k.x, 0.4, k.z); scene.add(k.halo);
        if (k.kind === 'gold') k.mat.color.setHex(0xffd34d);
        else if (k.kind === 'ice') k.mat.color.setHex(0xbff4ff);
        else if (k.kind === 'normal') k.mat.color.setHex(0xffffff);
        k.mat.emissive.setHex(col); k.mat.emissiveIntensity = 0.5;
        if (k.kind !== 'chain') active.push(k);
        api.audio.sfx('pop', { pitch: (2 - ROWS.findIndex(r => r.includes(k.code))) * 120 });
        hint();
    }
    function clearKeyFx(k) {
        if (k.ring) { scene.remove(k.ring); k.ring.material.dispose(); k.ring = null; }
        if (k.halo) { scene.remove(k.halo); k.halo.material.dispose(); k.halo = null; }
        if (k.badge) { k.g.remove(k.badge.sprite); k.badge.dispose(); k.badge = null; }
    }
    function resetKey(k) {
        clearKeyFx(k);
        k.state = 'idle'; k.kind = 'normal';
        k.mat.color.copy(k.baseColor); k.mat.emissive.setHex(0); k.mat.emissiveIntensity = 0;
        active = active.filter(a => a !== k);
    }
    function whack(k, rt) {
        // swing the mallet onto the key
        swingAt(k, 0.32);
        k.squash = 0.25; k.vy = -6;
        const p = new T.Vector3(k.x, 1.2, k.z);
        const col = k.kind === 'gold' ? 0xffd34d : k.kind === 'ice' ? 0x9ff : k.kind === 'chain' ? 0xc58bff : (cfg.fingerColors ? ARENA_FINGER_COLORS[k.finger] : 0x5cf2a0);
        P.emit(p, Math.round(46 * Q.part) + 8, { color: col, color2: 0xffffff, speed: 11, size: 0.75, life: 0.7, gravity: 9, up: 4 });
        P.emit(p, Math.round(14 * Q.part) + 4, { color: 0xffffff, speed: 4, size: 1.6, life: 0.25 });
        api.audio.sfx('whack', { pitch: Math.random() * 120 });
        api.shake(0.12);
        const speedFrac = Math.max(0, 1 - rt / (k.life * 1000));
        const lightning = speedFrac > 0.62;
        let base = 8 + Math.round(speedFrac * 22);
        if (k.kind === 'gold') base *= 3;
        if (lightning) { stats.perfect++; base += 6; }
        api.wordDone(base, p, { cls: k.kind === 'gold' ? 'gold' : lightning ? 'hot' : '' });
        if (lightning) api.popup('⚡', p.clone().add(new T.Vector3(0, 1.5, 0)), 'hot');
        stats.hits++; stats.rtSum += rt; stats.best = Math.min(stats.best, rt);
        if (k.kind === 'ice') { freeze = 4; api.power('freeze', '❄️', 4); api.banner('❄️ ' + t('הקפאה!', 'Freeze!'), t('הטבעות עוצרות ל-4 שניות', 'Rings stop for 4 seconds'), 'power', 1300); api.audio.sfx('power'); }
        weight[k.ch] = Math.max(1, (weight[k.ch] || 1) - 0.25);
        resetKey(k);
        k.state = 'down';
        hits++;
        api.setLevelProgress(hits / hitsNeeded());
        if (hits >= hitsNeeded()) { hits = 0; api.levelUp(api.level >= 2 && cfg.chains ? t('מגיעים מסלולי מילים 🔗', 'Word paths are coming 🔗') : t('המקשים מהירים יותר!', 'Keys get faster!')); api.addScore(80 * api.level); }
    }
    function missKey(k) {
        const p = new T.Vector3(k.x, 0.6, k.z);
        P.emit(p, Math.round(24 * Q.part) + 4, { color: 0xff3355, speed: 5, size: 0.7, life: 0.6 });
        api.audio.sfx('miss');
        api.popup('✗ ' + k.ch, p, 'miss');
        weight[k.ch] = (weight[k.ch] || 1) + 1.5; // the game comes back to keys you miss
        api.track(k.ch, '', 0);
        resetKey(k);
        k.state = 'down'; k.mat.color.setHex(0xff4455); k.shakeT = 0.4; setTimeout(() => { if (k.state !== 'up') k.mat.color.copy(k.baseColor); }, 450);
        api.damage(1);
        hint();
    }
    function wrongKey(typed, expectedCh) {
        const r = resolveKeyForChar(typed);
        const k = r && keys[r.code];
        if (k) { k.shakeT = 0.35; const old = k.state === 'idle'; if (old) { k.mat.emissive.setHex(0xff2244); k.mat.emissiveIntensity = 0.8; setTimeout(() => { if (k.state === 'idle') { k.mat.emissive.setHex(0); k.mat.emissiveIntensity = 0; } }, 300); } }
        api.keyBad();
        if (expectedCh) weight[expectedCh] = (weight[expectedCh] || 1) + 0.5;
    }

    // ---- word chains: a word lit as a numbered path across the board ----
    const bank = en ? ENGLISH_WORD_BANK : WORD_BANK;
    const poolChars = new Set(pool.map(k => k.ch));
    const allWords = [].concat(bank.short, bank.medium, bank.long).filter(w => !/\s/.test(w) && Array.from(w).length >= 3 && Array.from(w).length <= 6);
    let chainWords = allWords.filter(w => Array.from(w).every(c => poolChars.has(c)));
    if (chainWords.length < 5) chainWords = allWords.filter(w => Array.from(w).every(c => { const r = resolveKeyForChar(c); return r && !r.shift && keys[r.code] && isLetterChar(c); }));
    function startChain() {
        if (!chainWords.length) return false;
        const w = randomChoice(chainWords), cs = Array.from(w);
        const ks = cs.map(c => keys[(resolveKeyForChar(c) || {}).code]);
        if (ks.some(k => !k || k.state !== 'idle')) return false;
        const life = Math.max(3.5, cs.length * 1.5) / D.speed;
        chain = { word: w, chars: cs, keys: ks, i: 0, left: life, life, startT: performance.now(), lastT: performance.now() };
        const uniq = Array.from(new Set(ks));
        uniq.forEach(k => {
            popKey(k, 'chain', life);
            const nums = cs.map((c, j) => ks[j] === k ? j + 1 : null).filter(Boolean).join(',');
            k.badge = G3D.makeLabel(nums, { px: 48, height: 0.85, bg: 'rgba(90,30,160,0.9)', border: '#e2c4ff', color: '#fff', depthTest: false });
            k.badge.sprite.position.set(0, 2.4, 0); k.g.add(k.badge.sprite);
        });
        api.banner('🔗 ' + w, t('הקלידו את המילה לפי המספרים', 'Type the word following the numbers'), 'power', 1800);
        api.hud.extra(`<div class="g3-chainword">${cs.map((c, j) => `<span class="${j === 0 ? 'cur' : ''}">${c}</span>`).join('')}</div>`);
        hint();
        return true;
    }
    function chainHud() {
        if (!chain) { api.hud.extra(''); return; }
        api.hud.extra(`<div class="g3-chainword" dir="${en ? 'ltr' : 'rtl'}">${chain.chars.map((c, j) => `<span class="${j < chain.i ? 'done' : j === chain.i ? 'cur' : ''}">${c}</span>`).join('')}</div>`);
    }
    function endChain(success) {
        const uniq = Array.from(new Set(chain.keys));
        uniq.forEach(k => { if (k.state === 'up') { if (success) { k.state = 'down'; clearKeyFx(k); k.mat.color.copy(k.baseColor); k.mat.emissive.setHex(0); } else { resetKey(k); k.state = 'down'; } } });
        if (success) {
            stats.chains++;
            const mid = new T.Vector3(); uniq.forEach(k => mid.add(new T.Vector3(k.x, 1.5, k.z))); mid.multiplyScalar(1 / uniq.length);
            api.wordDone(40 + chain.chars.length * 15, mid, { cls: 'boss' });
            api.audio.sfx('perfect');
            api.banner('🔗 ' + t('מסלול הושלם!', 'Path complete!'), chain.word, 'level', 1400);
            uniq.forEach(k => P.emit(new T.Vector3(k.x, 1, k.z), Math.round(30 * Q.part) + 4, { color: 0xc58bff, color2: 0xffffff, speed: 8, size: 0.7, life: 0.8, up: 5, gravity: 6 }));
        } else {
            api.audio.sfx('miss');
            api.damage(1);
        }
        chain = null; chainCooldown = 14 + Math.random() * 8;
        chainHud(); hint();
    }

    // ---- input ----
    function expected() {
        if (chain) return chain.chars[chain.i];
        return active.length ? active[0].ch : '';
    }
    function hint() {
        const e = expected();
        api.hud.hint(e, e ? e + '|' + (chain ? 'c' + chain.i : active.length && active[0].g.id) : '');
        api.hud.typed('');
        // softly light the finger zone of the next key
        const r = e && resolveKeyForChar(e);
        const f = r && KEY_TO_FINGER[r.code];
        allKeys.forEach(k => { k.pulse = (f && k.finger === f && k.state === 'idle') ? 1 : 0; });
    }
    function onChar(ch) {
        const now = performance.now();
        if (chain) {
            const need = chain.chars[chain.i];
            api.track(need, ch, now - chain.lastT);
            chain.lastT = now;
            if (ch === need) {
                api.keyOk();
                const k = chain.keys[chain.i];
                k.squash = 0.2; k.vy = -3;
                P.emit(new T.Vector3(k.x, 1.2, k.z), Math.round(18 * Q.part) + 3, { color: 0xc58bff, color2: 0xffffff, speed: 7, size: 0.6, life: 0.5, up: 3 });
                api.audio.sfx('whack', { pitch: chain.i * 60 });
                swingAt(k, 0.26);
                chain.i++;
                const remaining = chain.keys.slice(chain.i);
                if (!remaining.includes(k)) { clearKeyFx(k); k.state = 'down'; k.mat.color.copy(k.baseColor); k.mat.emissive.setHex(0); }
                if (chain.i >= chain.chars.length) endChain(true); else { chainHud(); hint(); }
            } else wrongKey(ch, need);
            return;
        }
        if (!active.length) return;
        const k = active.find(a => a.ch === ch);
        if (k) {
            const rt = now - k.popT;
            api.track(ch, ch, rt);
            api.keyOk();
            whack(k, rt);
        } else {
            api.track(active[0].ch, ch, 0);
            wrongKey(ch, active[0].ch);
        }
        hint();
    }

    // ---- loop ----
    function animateKeys(dt) {
        allKeys.forEach(k => {
            const targetY = k.state === 'up' ? 1.5 : -0.6;
            // springy motion
            const acc = (targetY - k.y) * 120 - k.vy * 14;
            k.vy += acc * dt; k.y += k.vy * dt;
            if (k.state === 'down' && Math.abs(k.y + 0.6) < 0.02 && Math.abs(k.vy) < 0.2) k.state = 'idle';
            let sx = 0;
            if (k.shakeT > 0) { k.shakeT -= dt; sx = Math.sin(time * 70) * 0.18 * (k.shakeT / 0.4); }
            if (k.squash > 0) k.squash -= dt;
            const sq = k.squash > 0 ? 1 - k.squash * 1.6 : 1;
            k.g.position.set(k.x + sx, k.y, k.z);
            k.g.scale.set(1 + (1 - sq) * 0.4, sq, 1 + (1 - sq) * 0.4);
            if (k.state === 'up') {
                if (k.halo) { k.halo.position.y = k.y + 0.8; k.halo.material.opacity = 0.55 + Math.sin(time * 8) * 0.25; }
                k.mat.emissiveIntensity = 0.5 + Math.sin(time * 9) * 0.2;
            } else if (k.state === 'idle' && k.pulse) {
                k.mat.emissive.setHex(0x334466); k.mat.emissiveIntensity = 0.25 + Math.sin(time * 5) * 0.15;
            } else if (k.state === 'idle' && k.mat.emissiveIntensity > 0 && k.shakeT <= 0) { k.mat.emissiveIntensity = Math.max(0, k.mat.emissiveIntensity - dt * 2); }
        });
    }
    function updateRing(k, frac) {
        if (!k.ring) return;
        const s = 1 + frac * 1.9;
        k.ring.scale.set(s, 1, s);
        const c = k.ring.material.color;
        if (k.kind === 'normal') c.setHSL(0.36 * frac, 0.9, 0.58);
        k.ring.material.opacity = 0.6 + (1 - frac) * 0.4;
    }

    function update(dt, realDt) {
        time += realDt;
        // light show
        movers.forEach((l, i) => { const a = time * (0.4 + i * 0.15) + i * 2.1; l.position.set(Math.cos(a) * 14, 6 + Math.sin(time + i) * 2, Math.sin(a) * 9); });
        neon.rotation.z += realDt * 0.2; neon2.rotation.z -= realDt * 0.15;
        neon.material.color.setHSL((time * 0.05) % 1, 0.8, 0.6);
        if (freeze > 0) freeze -= realDt;
        const tick = freeze > 0 ? 0 : dt;

        if (chain) {
            chain.left -= tick;
            const frac = Math.max(0, chain.left / chain.life);
            new Set(chain.keys).forEach(k => updateRing(k, frac));
            if (chain.left <= 0) endChain(false);
        } else {
            active.slice().forEach(k => {
                k.left -= tick;
                const frac = Math.max(0, k.left / k.life);
                updateRing(k, frac);
                if (frac < 0.3 && Math.random() < 0.05) api.audio.sfx('tick');
                if (k.left <= 0 && !api.isDying()) missKey(k);
            });
            spawnT -= dt;
            chainCooldown -= dt;
            if (!api.isDying()) {
                if (cfg.chains && api.level >= 3 && chainCooldown <= 0 && !active.length) { if (!startChain()) chainCooldown = 3; }
                else if (spawnT <= 0 && active.length < maxActive() && !(cfg.chains && api.level >= 3 && chainCooldown <= 0)) {
                    const k = pickKey();
                    if (k) {
                        const r = Math.random();
                        popKey(k, r < 0.08 ? 'gold' : (r < 0.13 && api.level >= 2 ? 'ice' : 'normal'));
                    }
                    spawnT = Math.max(0.35, (1.5 - api.level * 0.08)) * D.spawn * (0.75 + Math.random() * 0.5);
                } else if (!active.length && spawnT > 0.4) spawnT = 0.4; // never leave the board empty for long
            }
        }
        animateKeys(realDt);
        // mallet swing
        if (malletT > 0) {
            malletT -= realDt;
            const p = 1 - Math.max(0, malletT / malletDur); // 0 → 1
            // fast swing down onto the key, then a slower lift
            pivot.rotation.z = p < 0.3 ? 0.35 + (p / 0.3) * (Math.PI / 2 - 0.35) : Math.PI / 2 - ((p - 0.3) / 0.7) * (Math.PI / 2 - 0.2);
            if (malletT <= 0) pivot.visible = false;
        }
        api.setCameraBase(camera.position.lerp(new T.Vector3(Math.sin(time * 0.25) * 1.0, 18.5 + Math.sin(time * 0.4) * 0.4, 14.5), 0.05));
    }
    function afterCamera() { camera.lookAt(look); }
    function ambient(dt) { time += dt; animateKeys(dt); }

    camera.lookAt(look);
    hint();
    return {
        update, onChar, expected, ambient, afterCamera,
        onBackspace() {},
        dispose() {},
        _syncStats(S) { S.arenaStats = stats; }
    };
}
