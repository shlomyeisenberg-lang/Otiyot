// ---- 3.2: "Word Galaxy" (גלקסיית המילים) — 3D space typing shooter ----
// Asteroids carrying words fly at your ship. Type a word to lock on and blast it
// with lasers. Power-up crystals, a boss mothership every 5 levels (type a whole
// sentence to defeat it), warp-speed level transitions, combos and multipliers.

const GALAXY_DEF = {
    id: 'galaxy', icon: '🚀', theme: 'g3-space', music: 'space',
    lifeIcon: '💙', lifeIconOff: '🖤',
    title: () => t('גלקסיית המילים', 'Word Galaxy'),
    desc: () => t('אסטרואידים נושאי מילים טסים לעבר החללית שלכם. הקלידו מילה כדי לנעול עליה ולפוצץ אותה בלייזר! גבישי כוח, ספינת־אם בכל 5 שלבים (מקלידים משפט שלם), קפיצות למהירות האור ומכפילי רצף.', 'Word-carrying asteroids fly at your ship. Type a word to lock on and blast it! Power crystals, a mothership boss every 5 levels (type a whole sentence), warp jumps and combo multipliers.'),
    defaults: { content: 'auto' },
    options: () => [
        { key: 'content', label: t('תוכן', 'Content'), choices: [['auto', t('אוטומטי — לפי ההתקדמות שלי', 'Auto — based on my progress')], ['letters', t('צירופי אותיות שלמדתי', 'Letter clusters I learned')], ['short', t('מילים קצרות', 'Short words')], ['words', t('מילים', 'Words')], ['long', t('מילים ארוכות', 'Long words')], ['mixed', t('מעורב', 'Mixed')]] }
    ],
    startBanner: () => t('🚀 גלקסיית המילים', '🚀 Word Galaxy'),
    startSub: () => t('הקלידו את המילה כדי לירות', 'Type a word to fire'),
    wordsLabel: () => t('אסטרואידים', 'Asteroids'),
    endExtra: (S) => (S.galaxyBosses ? `<p class="g3-endnote">👾 ${t('ספינות־אם שהובסו', 'Motherships defeated')}: <b>${S.galaxyBosses}</b></p>` : '') + (S.galaxyChain >= 2 ? `<p class="g3-endnote">💥 ${t('שרשרת הפגיעות הארוכה', 'Longest kill chain')}: <b>×${S.galaxyChain}</b></p>` : ''),
    onEnd: (S) => { const st = G3D.store().stats; st.galaxyBosses = (st.galaxyBosses || 0) + (S.galaxyBosses || 0); },
    create: (api) => createGalaxy(api)
};

function galaxyWordSource(cfg) {
    const en = isEnglishTyping();
    const bank = en ? ENGLISH_WORD_BANK : WORD_BANK;
    const sentences = en ? ENGLISH_SENTENCE_BANK : SENTENCE_BANK;
    const known = Array.from(getKnownKeys()).filter(isLetterChar);
    let mode = cfg.content;
    if (mode === 'auto') mode = (getActiveLevel() < 3 && known.length < 18) ? 'letters' : 'mixed';
    const clean = w => !/\s/.test(w);
    const all = [].concat(bank.short, bank.medium, bank.long, bank.advanced).filter(clean);
    const pools = {
        short: all.filter(w => Array.from(w).length <= 4),
        words: all.filter(w => Array.from(w).length >= 3 && Array.from(w).length <= 6),
        long: all.filter(w => Array.from(w).length >= 6),
        mixed: all
    };
    const letters = known.length >= 2 ? known : Object.values(getCurrentKeyboardLayout()).filter(isLetterChar).slice(0, 8);
    const cluster = (n) => { let s = ''; for (let i = 0; i < n; i++) s += randomChoice(letters); return s; };
    return {
        mode,
        next(level) {
            if (mode === 'letters') return cluster(Math.min(5, 1 + Math.floor(Math.random() * 2) + Math.floor(level / 3)));
            const p = pools[mode] && pools[mode].length ? pools[mode] : all;
            return randomChoice(p);
        },
        sentence() {
            if (mode === 'letters') return [cluster(3), cluster(3), cluster(4), cluster(3)].join(' ');
            return randomChoice(sentences).replace(/[.]$/, '');
        }
    };
}

function createGalaxy(api) {
    const T = api.THREE, scene = api.scene, camera = api.camera, cfg = api.cfg, D = api.D, P = api.particles;
    const q = api.Q.mult;
    scene.background = new T.Color(0x02030a);
    scene.fog = new T.FogExp2(0x03040c, 0.0055);
    camera.fov = 62; camera.near = 0.1; camera.far = 1500;
    camera.position.set(0, 4.6, 13.5); camera.lookAt(0, 1.6, -40); camera.updateProjectionMatrix();
    api.setCameraBase(camera.position);
    const words = galaxyWordSource(cfg);

    // ---- lights ----
    scene.add(new T.AmbientLight(0x5566aa, 0.55));
    const sun = new T.DirectionalLight(0xfff0dd, 1.6); sun.position.set(8, 10, 6); scene.add(sun);
    const rim = new T.DirectionalLight(0x6688ff, 0.7); rim.position.set(-10, -4, -10); scene.add(rim);
    const flashLight = new T.PointLight(0xffaa55, 0, 40); scene.add(flashLight);

    // ---- starfield (3 depth layers) + warp streaks ----
    const starCount = Math.round(2600 * api.Q.part) + 400;
    const sp = new Float32Array(starCount * 3), sc = new Float32Array(starCount * 3);
    for (let i = 0; i < starCount; i++) {
        sp[i * 3] = (Math.random() - 0.5) * 220; sp[i * 3 + 1] = (Math.random() - 0.5) * 140; sp[i * 3 + 2] = -Math.random() * 400 + 20;
        const c = new T.Color().setHSL(0.55 + Math.random() * 0.15, 0.4, 0.75 + Math.random() * 0.25);
        sc[i * 3] = c.r; sc[i * 3 + 1] = c.g; sc[i * 3 + 2] = c.b;
    }
    const starGeo = new T.BufferGeometry();
    starGeo.setAttribute('position', new T.BufferAttribute(sp, 3));
    starGeo.setAttribute('color', new T.BufferAttribute(sc, 3));
    const starTex = G3D.glowTexture('rgba(255,255,255,1)', 'rgba(180,200,255,0.35)');
    const stars = new T.Points(starGeo, new T.PointsMaterial({ size: 0.9, map: starTex, vertexColors: true, transparent: true, depthWrite: false, blending: T.AdditiveBlending, fog: false }));
    scene.add(stars);
    const streakN = Math.round(260 * q) + 60;
    const stPos = new Float32Array(streakN * 6);
    const streakSeeds = [];
    for (let i = 0; i < streakN; i++) streakSeeds.push({ x: (Math.random() - 0.5) * 80, y: (Math.random() - 0.5) * 50, z: -Math.random() * 300 });
    const streakGeo = new T.BufferGeometry(); streakGeo.setAttribute('position', new T.BufferAttribute(stPos, 3));
    const streakMat = new T.LineBasicMaterial({ color: 0x9fd0ff, transparent: true, opacity: 0, blending: T.AdditiveBlending, depthWrite: false, fog: false });
    const streaks = new T.LineSegments(streakGeo, streakMat); streaks.frustumCulled = false; scene.add(streaks);

    // ---- nebulae ----
    const nebulaColors = [['rgba(170,80,255,0.55)', 'rgba(90,30,160,0.0)'], ['rgba(40,160,255,0.5)', 'rgba(10,40,120,0)'], ['rgba(255,80,160,0.4)', 'rgba(120,20,80,0)'], ['rgba(40,255,200,0.3)', 'rgba(0,80,80,0)']];
    const nebulae = nebulaColors.map((cc, i) => {
        const tex = G3D.canvasTexture(256, 256, (ctx, w, h) => {
            for (let k = 0; k < 7; k++) {
                const x = w * (0.25 + Math.random() * 0.5), y = h * (0.25 + Math.random() * 0.5), r = w * (0.2 + Math.random() * 0.3);
                const g = ctx.createRadialGradient(x, y, 0, x, y, r); g.addColorStop(0, cc[0]); g.addColorStop(1, cc[1]);
                ctx.fillStyle = g; ctx.fillRect(0, 0, w, h);
            }
            // soft circular mask so the cloud never shows a rectangular edge
            ctx.globalCompositeOperation = 'destination-in';
            const m = ctx.createRadialGradient(w / 2, h / 2, 0, w / 2, h / 2, w / 2);
            m.addColorStop(0, 'rgba(0,0,0,1)'); m.addColorStop(0.6, 'rgba(0,0,0,0.6)'); m.addColorStop(1, 'rgba(0,0,0,0)');
            ctx.fillStyle = m; ctx.fillRect(0, 0, w, h);
        });
        const s = new T.Sprite(new T.SpriteMaterial({ map: tex, transparent: true, opacity: 0.55, blending: T.AdditiveBlending, depthWrite: false, fog: false }));
        s.position.set((i - 1.5) * 90 + (Math.random() - 0.5) * 30, (Math.random() - 0.3) * 40, -330 - i * 15);
        s.scale.set(220, 160, 1);
        scene.add(s);
        return s;
    });

    // ---- ringed planet ----
    const planetTex = G3D.canvasTexture(512, 256, (ctx, w, h) => {
        for (let y = 0; y < h; y++) {
            const v = Math.sin(y * 0.09) * 0.5 + Math.sin(y * 0.031 + 1.3) * 0.35 + Math.sin(y * 0.21) * 0.15;
            const r = 150 + v * 60, g = 110 + v * 40, b = 190 + v * 50;
            ctx.fillStyle = `rgb(${r | 0},${g | 0},${b | 0})`; ctx.fillRect(0, y, w, 1);
        }
        for (let k = 0; k < 40; k++) { ctx.fillStyle = `rgba(255,255,255,${Math.random() * 0.06})`; ctx.beginPath(); ctx.ellipse(Math.random() * w, Math.random() * h, 20 + Math.random() * 60, 3 + Math.random() * 6, 0, 0, Math.PI * 2); ctx.fill(); }
    });
    const planet = new T.Mesh(new T.SphereGeometry(34, 48, 32), new T.MeshStandardMaterial({ map: planetTex, roughness: 0.9, metalness: 0, fog: false }));
    planet.position.set(-95, 18, -300); planet.rotation.z = 0.35; scene.add(planet);
    const ringTex = G3D.canvasTexture(256, 8, (ctx, w) => { for (let x = 0; x < w; x++) { const a = 0.15 + 0.5 * Math.abs(Math.sin(x * 0.17)) * (x > 20 && x < 240 ? 1 : 0); ctx.fillStyle = `rgba(220,200,255,${a})`; ctx.fillRect(x, 0, 1, 8); } });
    const ringGeo = new T.RingGeometry(44, 70, 96, 1);
    const pos = ringGeo.attributes.position, uv = ringGeo.attributes.uv;
    for (let i = 0; i < pos.count; i++) { const r = Math.hypot(pos.getX(i), pos.getY(i)); uv.setXY(i, (r - 44) / 26, 0.5); }
    const ring = new T.Mesh(ringGeo, new T.MeshBasicMaterial({ map: ringTex, transparent: true, side: T.DoubleSide, depthWrite: false, fog: false }));
    ring.position.copy(planet.position); ring.rotation.set(1.25, 0.2, 0.35); scene.add(ring);
    const atmo = new T.Sprite(new T.SpriteMaterial({ map: G3D.glowTexture('rgba(160,120,255,0.0)', 'rgba(140,110,255,0.45)'), transparent: true, blending: T.AdditiveBlending, depthWrite: false, fog: false }));
    atmo.position.copy(planet.position); atmo.scale.set(96, 96, 1); scene.add(atmo);

    // ---- player ship ----
    const ship = new T.Group();
    const hullMat = new T.MeshStandardMaterial({ color: 0xd4dbe8, metalness: 0.75, roughness: 0.28 });
    const darkMat = new T.MeshStandardMaterial({ color: 0x2a3550, metalness: 0.6, roughness: 0.4 });
    const accentMat = new T.MeshStandardMaterial({ color: 0x3fa9ff, emissive: 0x1a6cff, emissiveIntensity: 0.8, metalness: 0.4, roughness: 0.3 });
    const body = new T.Mesh(new T.ConeGeometry(0.55, 2.6, 10), hullMat); body.rotation.x = -Math.PI / 2; ship.add(body);
    const tail = new T.Mesh(new T.CylinderGeometry(0.55, 0.42, 0.9, 10), darkMat); tail.rotation.x = Math.PI / 2; tail.position.z = 1.7; ship.add(tail);
    const cockpit = new T.Mesh(new T.SphereGeometry(0.34, 16, 12), new T.MeshStandardMaterial({ color: 0x66e0ff, emissive: 0x1188cc, emissiveIntensity: 0.9, metalness: 0.2, roughness: 0.05, transparent: true, opacity: 0.9 }));
    cockpit.scale.set(1, 0.7, 1.6); cockpit.position.set(0, 0.32, 0.1); ship.add(cockpit);
    const wingShape = new T.Shape(); wingShape.moveTo(0, 0); wingShape.lineTo(2.1, 0.9); wingShape.lineTo(2.2, 1.4); wingShape.lineTo(0, 1.25); wingShape.lineTo(0, 0);
    const wingGeo = new T.ExtrudeGeometry(wingShape, { depth: 0.08, bevelEnabled: true, bevelSize: 0.03, bevelThickness: 0.03, bevelSegments: 1 });
    [-1, 1].forEach(sx => {
        const w = new T.Mesh(wingGeo, hullMat); w.rotation.x = -Math.PI / 2; w.scale.x = sx; w.position.set(0, -0.05, 1.3); ship.add(w);
        const stripe = new T.Mesh(new T.BoxGeometry(1.4, 0.03, 0.12), accentMat); stripe.position.set(sx * 1.1, 0.06, 0.55); stripe.rotation.y = -sx * 0.4; ship.add(stripe);
        const gun = new T.Mesh(new T.CylinderGeometry(0.07, 0.07, 1.1, 8), darkMat); gun.rotation.x = Math.PI / 2; gun.position.set(sx * 1.9, -0.02, 0.2); ship.add(gun);
        const fin = new T.Mesh(new T.BoxGeometry(0.06, 0.55, 0.6), hullMat); fin.position.set(sx * 2.05, 0.25, 1.0); ship.add(fin);
    });
    const glowTex = G3D.glowTexture('rgba(255,255,255,1)', 'rgba(90,170,255,0.7)');
    const engines = [];
    [-0.28, 0.28].forEach(x => {
        const g = new T.Sprite(new T.SpriteMaterial({ map: glowTex, color: 0x88ccff, transparent: true, blending: T.AdditiveBlending, depthWrite: false }));
        g.position.set(x, 0, 2.25); g.scale.set(1.1, 1.1, 1); ship.add(g); engines.push(g);
    });
    const engineLight = new T.PointLight(0x55aaff, 2.2, 8); engineLight.position.set(0, 0, 2.6); ship.add(engineLight);
    ship.position.set(0, -0.4, 3.2);
    ship.scale.setScalar(0.72);
    scene.add(ship);
    // shield bubble
    const shieldMat = new T.MeshBasicMaterial({ color: 0x55ddff, transparent: true, opacity: 0, blending: T.AdditiveBlending, depthWrite: false, wireframe: true });
    const shield = new T.Mesh(new T.IcosahedronGeometry(2.6, 2), shieldMat); ship.add(shield);
    let shieldHits = 0;

    // target lock ring
    const lockRing = new T.Mesh(new T.RingGeometry(1.25, 1.45, 4, 1), new T.MeshBasicMaterial({ color: 0xff5566, transparent: true, opacity: 0.9, side: T.DoubleSide, depthTest: false, blending: T.AdditiveBlending }));
    lockRing.renderOrder = 15; lockRing.visible = false; scene.add(lockRing);

    // ---- shared geometry/materials ----
    const rockGeos = [0, 1, 2, 3].map(seed => {
        const g = new T.IcosahedronGeometry(1, 1);
        const p = g.attributes.position;
        const map = {};
        for (let i = 0; i < p.count; i++) {
            const key = `${p.getX(i).toFixed(3)},${p.getY(i).toFixed(3)},${p.getZ(i).toFixed(3)}`;
            if (!map[key]) map[key] = 0.78 + Math.random() * 0.42;
            p.setXYZ(i, p.getX(i) * map[key], p.getY(i) * map[key] * 0.9, p.getZ(i) * map[key]);
        }
        g.computeVertexNormals();
        return g;
    });
    const rockMats = [0x8a7a6a, 0x6e6a73, 0x9a6e52, 0x5f6f7f].map(c => new T.MeshStandardMaterial({ color: c, roughness: 0.92, metalness: 0.08, flatShading: true }));
    const beamGeo = new T.CylinderGeometry(0.07, 0.07, 1, 6, 1, true);
    const debrisGeo = new T.TetrahedronGeometry(0.28);
    const shockGeo = new T.RingGeometry(0.85, 1, 48);
    const POWERS = {
        shield: { icon: '🛡️', color: 0x44ddff, he: 'מגן', en: 'Shield' },
        slow: { icon: '🐢', color: 0x66ff99, he: 'הילוך איטי', en: 'Slow motion' },
        nova: { icon: '💥', color: 0xff7744, he: 'פצצת נובה', en: 'Nova bomb' },
        double: { icon: '✖️2', color: 0xffdd44, he: 'ניקוד כפול', en: 'Double points' },
        heal: { icon: '💙', color: 0xff66cc, he: 'חיים נוספים', en: 'Extra life' }
    };

    // ---- game state ----
    const enemies = [], beams = [], fx = [];
    let target = null, spawnT = 1.2, kills = 0, warpT = 0, boss = null, laneFlip = 1;
    // 4.1: multi-kills — asteroids destroyed in quick succession build a chain
    let lastKillT = -9, killChain = 0, bestChain = 0;
    const CHAIN_NAMES = [null, null, ['כפול!', 'Double!'], ['משולש!', 'Triple!'], ['מרובע!', 'Quad!'], ['מגה!', 'Mega!'], ['אולטרה!', 'Ultra!']];
    const killsNeeded = () => 6 + api.level * 2;
    let starSpeed = 14;

    function spawn(kind) {
        const isPower = kind === 'power';
        let word = words.next(api.level);
        let guard = 0;
        while (enemies.some(e => e.alive && e.chars[0] === Array.from(word)[0]) && guard++ < 12) word = words.next(api.level);
        const g = new T.Group();
        let mesh, r;
        let power = null;
        if (isPower) {
            const keys = Object.keys(POWERS);
            power = keys[Math.floor(Math.random() * keys.length)];
            const pdef = POWERS[power];
            mesh = new T.Mesh(new T.OctahedronGeometry(1.0, 0), new T.MeshStandardMaterial({ color: pdef.color, emissive: pdef.color, emissiveIntensity: 0.65, metalness: 0.3, roughness: 0.15, transparent: true, opacity: 0.92 }));
            const halo = new T.Sprite(new T.SpriteMaterial({ map: glowTex, color: pdef.color, transparent: true, blending: T.AdditiveBlending, depthWrite: false }));
            halo.scale.set(4.2, 4.2, 1); g.add(halo);
            r = 1;
            const icon = G3D.makeLabel(pdef.icon + ' ' + t(pdef.he, pdef.en), { px: 40, height: 0.62, bg: 'rgba(0,0,0,0.45)', border: null, color: '#fff' });
            icon.sprite.position.y = r + 2.0; icon.sprite.material.fog = false; g.add(icon.sprite);
        } else {
            r = 1.25 + Math.random() * 0.8 + Math.min(0.7, Array.from(word).length * 0.06);
            mesh = new T.Mesh(rockGeos[Math.floor(Math.random() * rockGeos.length)], rockMats[Math.floor(Math.random() * rockMats.length)]);
            mesh.scale.setScalar(r);
        }
        g.add(mesh);
        const label = G3D.makeLabel(word, { px: 72, height: 1.05, typedColor: '#5cf2a0', border: isPower ? '#ffe066' : 'rgba(120,180,255,0.65)' });
        label.sprite.material.fog = false;
        label.sprite.position.y = r + 1.05;
        g.add(label.sprite);
        laneFlip = -laneFlip;
        const x = laneFlip * (2 + Math.random() * 11);
        g.position.set(x, -0.2 + Math.random() * 5.2, -78 - Math.random() * 10);
        scene.add(g);
        const e = { group: g, mesh, label, word, chars: Array.from(word), typed: 0, kind: isPower ? 'power' : 'rock', power, r, alive: true,
            spin: new T.Vector3(Math.random() - 0.5, Math.random() - 0.5, Math.random() - 0.5).multiplyScalar(1.6), speedMul: 0.85 + Math.random() * 0.3, danger: false, wob: Math.random() * 10 };
        enemies.push(e);
        return e;
    }

    function spawnBoss() {
        const sentence = words.sentence();
        const g = new T.Group();
        const bossHull = new T.MeshStandardMaterial({ color: 0x3b2f4f, metalness: 0.85, roughness: 0.3 });
        const bossGlow = new T.MeshStandardMaterial({ color: 0xff2255, emissive: 0xff2255, emissiveIntensity: 1.2 });
        const torus = new T.Mesh(new T.TorusGeometry(4.4, 0.85, 18, 64), bossHull); torus.rotation.x = Math.PI / 2; g.add(torus);
        const core = new T.Mesh(new T.SphereGeometry(2.3, 32, 24), new T.MeshStandardMaterial({ color: 0x51406e, metalness: 0.8, roughness: 0.25, emissive: 0x220011 })); core.scale.y = 0.6; g.add(core);
        const eye = new T.Mesh(new T.SphereGeometry(0.9, 24, 16), bossGlow); eye.position.set(0, 0, 2.0); g.add(eye);
        const lights = [];
        for (let i = 0; i < 12; i++) {
            const a = i / 12 * Math.PI * 2;
            const l = new T.Mesh(new T.SphereGeometry(0.22, 10, 8), bossGlow.clone()); l.position.set(Math.cos(a) * 4.4, 0.75, Math.sin(a) * 4.4); g.add(l); lights.push(l);
            const sp2 = new T.Mesh(new T.ConeGeometry(0.35, 1.6, 8), bossHull); sp2.position.set(Math.cos(a) * 5.4, 0, Math.sin(a) * 5.4); sp2.rotation.z = -Math.PI / 2; sp2.rotation.y = -a; g.add(sp2);
        }
        const bl = new T.PointLight(0xff3366, 3, 30); g.add(bl);
        const label = G3D.makeLabel(sentence, { px: 64, height: 1.15, typedColor: '#ffd84d', bg: 'rgba(30,6,20,0.8)', border: '#ff3366' });
        label.sprite.material.fog = false; label.sprite.position.y = 4.3; g.add(label.sprite);
        g.position.set(0, 3.5, -85);
        scene.add(g);
        boss = { group: g, label, word: sentence, chars: Array.from(sentence), typed: 0, kind: 'boss', alive: true, lights, r: 5, eye, speedMul: 1, spin: new T.Vector3(), wob: 0 };
        enemies.push(boss);
        api.banner('👾 ' + t('ספינת־אם מתקרבת!', 'Mothership incoming!'), t('הקלידו את כל המשפט כדי להביס אותה', 'Type the whole sentence to defeat it'), 'boss', 3000);
        api.audio.sfx('warp');
        updateBossHud();
    }
    function updateBossHud() {
        if (!boss || !boss.alive) { api.hud.extra(''); return; }
        const pct = Math.round((1 - boss.typed / boss.chars.length) * 100);
        api.hud.extra(`<div class="g3-bossbar"><span style="width:${pct}%"></span></div>`);
    }

    function fireAt(e) {
        const from = new T.Vector3(ship.position.x + (Math.random() < 0.5 ? -1.9 : 1.9), ship.position.y, ship.position.z - 0.6);
        const to = e.group.position.clone();
        const dir = to.clone().sub(from); const len = dir.length();
        const m = new T.Mesh(beamGeo, new T.MeshBasicMaterial({ color: e.kind === 'boss' ? 0xffcc33 : 0x55ffcc, transparent: true, opacity: 1, blending: T.AdditiveBlending, depthWrite: false }));
        m.position.copy(from).add(dir.clone().multiplyScalar(0.5));
        m.quaternion.setFromUnitVectors(new T.Vector3(0, 1, 0), dir.clone().normalize());
        m.scale.set(1, len, 1);
        scene.add(m); beams.push({ m, life: 0.13 });
        P.emit(from, Math.round(6 * q) + 2, { color: 0x99ffee, speed: 4, size: 0.5, life: 0.25 });
        P.emit(to, Math.round(10 * q) + 3, { color: 0xffffff, color2: 0x66ffcc, speed: 7, size: 0.45, life: 0.35 });
        api.audio.sfx('laser');
        if (e.kind !== 'boss') e.group.position.z -= 0.7; // knock-back
        if (e.mesh) e.mesh.rotation.x += 0.4;
    }

    function explode(p, big, color) {
        const n = Math.round((big ? 180 : 70) * api.Q.part) + 10;
        P.emit(p, n, { color: color || 0xffaa33, color2: 0xff4411, speed: big ? 22 : 13, size: big ? 2.2 : 1.3, life: big ? 1.6 : 0.95, drag: 1.8 });
        P.emit(p, Math.round(n * 0.5), { color: 0xffffff, speed: big ? 30 : 20, size: 0.5, life: 0.6, drag: 0.6 });
        P.emit(p, Math.round(n * 0.3), { color: 0x555566, speed: 4, size: big ? 3 : 1.8, life: 1.4, drag: 0.8, up: 1 });
        const ringM = new T.Mesh(shockGeo, new T.MeshBasicMaterial({ color: color || 0xffbb66, transparent: true, opacity: 0.9, side: T.DoubleSide, blending: T.AdditiveBlending, depthWrite: false }));
        ringM.position.copy(p); ringM.lookAt(camera.position); scene.add(ringM);
        fx.push({ kind: 'ring', m: ringM, life: big ? 0.9 : 0.55, max: big ? 0.9 : 0.55, grow: big ? 22 : 9 });
        const dn = big ? 16 : Math.round(7 * q) + 2;
        for (let i = 0; i < dn; i++) {
            const d = new T.Mesh(debrisGeo, rockMats[i % rockMats.length]);
            d.position.copy(p);
            fx.push({ kind: 'debris', m: d, life: 1.3, max: 1.3, v: new T.Vector3((Math.random() - 0.5) * 14, (Math.random() - 0.5) * 14, (Math.random() - 0.5) * 14), s: new T.Vector3(Math.random() * 8, Math.random() * 8, 0) });
            d.scale.setScalar(0.6 + Math.random() * (big ? 2.4 : 1.2));
            scene.add(d);
        }
        flashLight.position.copy(p); flashLight.intensity = big ? 14 : 6;
        api.audio.sfx(big ? 'bigexplode' : 'explode');
        api.shake(big ? 0.9 : 0.25);
    }

    function removeEnemy(e) {
        e.alive = false;
        scene.remove(e.group);
        e.label.dispose();
        const i = enemies.indexOf(e); if (i >= 0) enemies.splice(i, 1);
        if (target === e) { target = null; lockRing.visible = false; api.hud.typed(''); }
        if (e === boss) { boss = null; updateBossHud(); }
    }

    function destroy(e) {
        const p = e.group.position.clone();
        if (e.kind === 'boss') {
            explode(p, true, 0xff3366);
            setTimeout(() => explode(p.clone().add(new T.Vector3(3, 1, 0)), false), 180);
            setTimeout(() => explode(p.clone().add(new T.Vector3(-3, -1, 0)), false), 360);
            api.wordDone(60 + e.chars.length * 12, p, { cls: 'boss' });
            api.banner('👾 ' + t('ספינת־האם הובסה!', 'Mothership destroyed!'), t('בונוס ענק!', 'Huge bonus!'), 'boss', 2600);
            galaxyState.bosses++;
            api.audio.sfx('fanfare');
        } else {
            explode(p, false, e.kind === 'power' ? POWERS[e.power].color : null);
            api.wordDone(10 + e.chars.length * 8, p);
            if (e.kind === 'power') applyPower(e.power);
        }
        removeEnemy(e);
        kills++;
        const nowT = api.time;
        killChain = (nowT - lastKillT < 1.8) ? killChain + 1 : 1;
        lastKillT = nowT;
        if (killChain >= 2) {
            const nm = CHAIN_NAMES[Math.min(killChain, CHAIN_NAMES.length - 1)];
            api.popup(`💥 ${t(nm[0], nm[1])} +${40 * killChain}`, p.clone().add(new T.Vector3(0, 2.5, 0)), killChain >= 4 ? 'boss' : 'hot');
            api.addScore(40 * killChain); api.feverBoost(0.04 * killChain);
            if (killChain === 4) api.audio.sfx('perfect', { pitch: 120 });
            bestChain = Math.max(bestChain, killChain);
            galaxyState.bestChain = Math.max(galaxyState.bestChain || 0, bestChain);
        }
        api.setLevelProgress(kills / killsNeeded());
        if (kills >= killsNeeded() && !warpT) startWarp();
    }

    function applyPower(name) {
        const pd = POWERS[name];
        api.audio.sfx('power');
        api.banner(pd.icon + ' ' + t(pd.he, pd.en), '', 'power', 1600);
        if (name === 'shield') { shieldHits = Math.min(3, shieldHits + 1); }
        else if (name === 'slow') api.power('slow', '🐢', 7);
        else if (name === 'double') api.power('double', '✖️2', 12);
        else if (name === 'heal') api.heal(1);
        else if (name === 'nova') {
            api.flash('rgba(255,200,120,0.45)');
            enemies.slice().forEach((e, i) => { if (e.kind !== 'boss' && e.alive) setTimeout(() => { if (e.alive) { explode(e.group.position.clone(), false); api.wordDone(10 + e.chars.length * 5, e.group.position.clone()); removeEnemy(e); kills++; } }, 120 * i); });
        }
    }

    function startWarp() {
        warpT = 2.4;
        api.audio.sfx('warp');
        enemies.slice().forEach(e => { if (e.kind !== 'boss' && e.alive) { explode(e.group.position.clone(), false); removeEnemy(e); } });
        kills = 0;
        api.levelUp(t('🚀 קפיצה למהירות האור!', '🚀 Jumping to light speed!'));
        api.addScore(100 * api.level);
    }

    const galaxyState = { bosses: 0 };

    function hitShip(e) {
        const p = e.group.position.clone();
        explode(p, e.kind === 'boss');
        if (shieldHits > 0 && e.kind !== 'boss') {
            shieldHits--; api.audio.sfx('hit'); api.flash('rgba(80,200,255,0.3)');
            api.banner('🛡️ ' + t('המגן ספג את הפגיעה', 'Shield absorbed the hit'), '', 'small', 1200);
        } else {
            api.damage(e.kind === 'boss' ? 2 : 1);
            api.shake(1.0);
        }
        removeEnemy(e);
    }

    function closest(filterFn) {
        let best = null;
        enemies.forEach(e => { if (e.alive && (!filterFn || filterFn(e)) && (!best || e.group.position.z > best.group.position.z)) best = e; });
        return best;
    }

    function setHint() {
        const e = target || closest();
        const ch = e ? e.chars[target ? e.typed : 0] : '';
        api.hud.hint(ch, e ? (e.word + '|' + (target ? e.typed : 'n') + '|' + e.group.id) : '');
        api.hud.typed(target ? target.chars.slice(0, target.typed).join('') : '');
    }

    let shipFlashT = 0;
    function onChar(ch) {
        if (warpT > 0) return;
        if (!target) {
            const c = closest(e => e.chars[0] === ch);
            if (!c) { api.keyBad(); shipFlashT = 0.25; setHint(); return; }
            target = c; target.typed = 0; lockRing.visible = true; api.audio.sfx('lock');
        }
        const need = target.chars[target.typed];
        if (ch === need) {
            target.typed++;
            api.keyOk();
            target.label.setTyped(target.typed);
            fireAt(target);
            if (target === boss) updateBossHud();
            if (target.typed >= target.chars.length) destroy(target);
        } else {
            api.keyBad(); shipFlashT = 0.25;
            target.group.position.x += (Math.random() - 0.5) * 0.3;
        }
        setHint();
    }
    function onBackspace() {
        if (target) { target.typed = 0; target.label.setTyped(0); target = null; lockRing.visible = false; if (boss) updateBossHud(); setHint(); }
    }
    function expected() { const e = target || closest(); return e ? e.chars[target ? e.typed : 0] : ''; }

    const tmp = new T.Vector3();
    let time = 0;
    function updateStars(dt, speed) {
        const arr = starGeo.attributes.position.array;
        for (let i = 0; i < starCount; i++) { arr[i * 3 + 2] += speed * dt; if (arr[i * 3 + 2] > 25) arr[i * 3 + 2] -= 420; }
        starGeo.attributes.position.needsUpdate = true;
        const warpF = Math.min(1, warpT / 0.8);
        streakMat.opacity = warpF * 0.85;
        if (warpF > 0.01) {
            const len = 6 + warpF * 40;
            streakSeeds.forEach((s, i) => {
                s.z += speed * dt * 1.4; if (s.z > 20) s.z -= 320;
                stPos.set([s.x, s.y, s.z, s.x, s.y, s.z - len], i * 6);
            });
            streakGeo.attributes.position.needsUpdate = true;
        }
    }
    function ambient(dt) {
        time += dt;
        planet.rotation.y += dt * 0.02;
        nebulae.forEach((n, i) => { n.material.rotation += dt * 0.004 * (i % 2 ? 1 : -1); });
        updateStars(dt, 3);
        engines.forEach(g => { const s = 0.9 + Math.random() * 0.4; g.scale.set(s, s, 1); });
    }

    function update(dt, realDt) {
        time += realDt;
        // background motion
        starSpeed += ((warpT > 0 ? 260 : 14 + api.level) - starSpeed) * Math.min(1, realDt * 2.5);
        updateStars(realDt, starSpeed);
        planet.rotation.y += realDt * 0.02;
        nebulae.forEach((n, i) => { n.material.rotation += realDt * 0.006 * (i % 2 ? 1 : -1); });
        camera.fov += ((warpT > 0 ? 82 : 62) - camera.fov) * Math.min(1, realDt * 3); camera.updateProjectionMatrix();
        if (warpT > 0) { warpT -= realDt; if (warpT <= 0) { warpT = 0; spawnT = 0.6; if (api.level % 5 === 0 && !boss) spawnBoss(); } }

        // ship motion — glide toward the target lane, bank and bob
        const tx = target ? target.group.position.x * 0.32 : Math.sin(time * 0.5) * 0.6;
        ship.position.x += (tx - ship.position.x) * Math.min(1, realDt * 3);
        ship.position.y = Math.sin(time * 1.6) * 0.15;
        ship.rotation.z = Math.max(-0.45, Math.min(0.45, -(tx - ship.position.x) * 0.25)) + Math.sin(time * 1.2) * 0.04;
        if (target) { tmp.copy(target.group.position); const a = Math.atan2(tmp.x - ship.position.x, ship.position.z - tmp.z); ship.rotation.y += (Math.max(-0.5, Math.min(0.5, -a * 0.5)) - ship.rotation.y) * Math.min(1, realDt * 6); }
        else ship.rotation.y *= Math.pow(0.05, realDt);
        engines.forEach(g => { const s = (warpT > 0 ? 2.2 : 1) * (0.85 + Math.random() * 0.35); g.scale.set(s, s, 1); });
        hullMat.emissive.setRGB(shipFlashT > 0 ? 0.7 : 0, 0, 0); if (shipFlashT > 0) shipFlashT -= realDt;
        shieldMat.opacity = shieldHits > 0 ? 0.18 + Math.sin(time * 4) * 0.06 : Math.max(0, shieldMat.opacity - realDt);
        shield.rotation.y += realDt * 0.6;

        // spawning
        if (warpT <= 0) {
            spawnT -= dt;
            const maxN = boss ? 2 : D.max + Math.floor(api.level / 3);
            const regular = enemies.filter(e => e.kind !== 'boss').length;
            if (spawnT <= 0 && regular < maxN) {
                spawn(Math.random() < 0.09 ? 'power' : 'rock');
                spawnT = Math.max(0.9, 3.4 - api.level * 0.16) * D.spawn * (boss ? 1.8 : 1);
            }
        }

        // enemies
        const slow = api.powerLeft('slow') > 0 ? 0.45 : 1;
        const baseSpeed = (4.6 + api.level * 0.55) * D.speed * slow;
        enemies.slice().forEach(e => {
            if (!e.alive) return;
            const gp = e.group.position;
            if (e.kind === 'boss') {
                gp.z += Math.max(1.4, baseSpeed * 0.32) * dt;
                const bls = Math.max(1, (camera.position.z - gp.z) / 30);
                e.label.sprite.scale.set(1.15 * e.label.aspect * bls, 1.15 * bls, 1);
                gp.y = 3.5 + Math.sin(time * 0.8) * 0.6;
                e.group.children[0].rotation.z += dt * 0.6;
                e.lights.forEach((l, i) => { l.material.emissiveIntensity = 0.6 + Math.abs(Math.sin(time * 4 + i)); });
                if (gp.z > -6) hitShip(e);
                return;
            }
            gp.z += baseSpeed * e.speedMul * dt;
            // keep far-away words readable: labels grow with distance
            const dist = camera.position.z - gp.z;
            const ls = Math.max(1, dist / 24);
            e.label.sprite.scale.set(1.05 * e.label.aspect * ls, 1.05 * ls, 1);
            e.label.sprite.position.y = e.r + 1.05 * ls;
            gp.x += (gp.x * 0.985 - gp.x) * dt * 2;
            e.wob += dt; gp.y += Math.sin(e.wob * 1.3) * 0.01;
            e.mesh.rotation.x += e.spin.x * dt; e.mesh.rotation.y += e.spin.y * dt; e.mesh.rotation.z += e.spin.z * dt;
            if (!e.danger && gp.z > -22) { e.danger = true; if (target !== e) e.label.setColors({ border: '#ff4466' }); }
            if (gp.z > 3.2) hitShip(e);
        });

        // lock ring follows the target
        if (target && target.alive) {
            lockRing.position.copy(target.group.position);
            lockRing.lookAt(camera.position);
            lockRing.rotateZ(time * 3);
            const s = (target.r || 1) * (target.kind === 'boss' ? 5 : 1.25) * (1 + Math.sin(time * 8) * 0.06);
            lockRing.scale.set(s, s, s);
        }

        // effects
        for (let i = beams.length - 1; i >= 0; i--) { const b = beams[i]; b.life -= realDt; b.m.material.opacity = Math.max(0, b.life / 0.13); if (b.life <= 0) { scene.remove(b.m); b.m.material.dispose(); beams.splice(i, 1); } }
        for (let i = fx.length - 1; i >= 0; i--) {
            const f = fx[i]; f.life -= realDt; const k = Math.max(0, f.life / f.max);
            if (f.kind === 'ring') { const s = 1 + (1 - k) * f.grow; f.m.scale.set(s, s, s); f.m.material.opacity = k * 0.9; }
            else { f.m.position.addScaledVector(f.v, realDt); f.v.multiplyScalar(Math.pow(0.4, realDt)); f.m.rotation.x += f.s.x * realDt; f.m.rotation.y += f.s.y * realDt; f.m.scale.multiplyScalar(Math.pow(0.35, realDt)); }
            if (f.life <= 0) { scene.remove(f.m); if (f.kind === 'ring') f.m.material.dispose(); fx.splice(i, 1); }
        }
        flashLight.intensity *= Math.pow(0.02, realDt);
        if (Math.random() < 0.2) setHint();
    }

    function dispose() {}
    return {
        update, onChar, onBackspace, expected, ambient, dispose,
        get bosses() { return galaxyState.bosses; },
        _syncStats(S) { S.galaxyBosses = galaxyState.bosses; S.galaxyChain = galaxyState.bestChain || 0; }
    };
}
