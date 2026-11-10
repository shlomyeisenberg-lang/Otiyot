// ---- 3.3: "Typing Grand Prix" (מרוץ ההקלדה) — 3D racing on real text ----
// Your car drives as fast as you type: every correct character moves it along a
// sunset race track. You race three AI drivers whose speed is set from YOUR own
// recent WPM (so the race is always close), plus an optional ghost of your
// personal best. Mistakes make the car skid; clean streaks fill the nitro.
// It trains the most useful skill of all: steady, accurate typing of real text.

const RACE_DEF = {
    id: 'race', icon: '🏎️', theme: 'g3-race', music: 'race',
    hideCommon: ['mode', 'duration', 'lives'],
    title: () => t('מרוץ ההקלדה', 'Typing Grand Prix'),
    desc: () => t('המכונית נוסעת בדיוק במהירות שבה אתם מקלידים. התחרו בשלושה נהגים שהמהירות שלהם מחושבת לפי הממוצע שלכם — ובגרסת ה"רוח" של השיא האישי. טעות = החלקה, רצף נקי = ניטרו.', 'Your car moves exactly as fast as you type. Race three drivers whose speed is set from your own average — and the ghost of your personal best. A mistake makes you skid; a clean streak fills the nitro.'),
    trains: () => t('מתאמן על: הקלדה רציפה של טקסט אמיתי, קצב יציב ודיוק', 'Trains: continuous real-text typing, steady rhythm and accuracy'),
    keysHelp: () => t('הקלידו את הטקסט שבתחתית המסך · Esc = השהיה', 'Type the text at the bottom of the screen · Esc = pause'),
    defaults: { content: 'auto', distance: 'medium', ghost: true },
    options: () => [
        { key: 'content', label: t('תוכן', 'Content'), choices: [['auto', t('אוטומטי — לפי ההתקדמות שלי', 'Auto — based on my progress')], ['sentences', t('משפטים', 'Sentences')], ['paragraph', t('פסקה רציפה', 'A paragraph')], ['words', t('מילים', 'Words')], ['letters', t('צירופי אותיות שלמדתי', 'Letter clusters I learned')]] },
        { key: 'distance', label: t('אורך המסלול', 'Track length'), choices: [['sprint', t('ספרינט (~80 תווים)', 'Sprint (~80 chars)')], ['medium', t('רגיל (~180 תווים)', 'Standard (~180 chars)')], ['long', t('ארוך (~350 תווים)', 'Long (~350 chars)')], ['marathon', t('מרתון (~600 תווים)', 'Marathon (~600 chars)')]] },
        { key: 'ghost', label: t('מכונית רוח של השיא שלי', 'Ghost car of my best run'), toggle: true }
    ],
    startBanner: () => t('🏁 מרוץ ההקלדה', '🏁 Typing Grand Prix'),
    startSub: () => t('המתינו לאור הירוק…', 'Wait for the green light…'),
    wordsLabel: () => t('מילים', 'Words'),
    hudLevel: (S) => { const i = S.raceInfo || (S.game && S.game._info); return i && i.levelText ? i.levelText : t('מרוץ', 'Race'); },
    hudLives: (S) => { const i = S.raceInfo || (S.game && S.game._info); return i && i.placeText ? `<span class="g3-place">${i.placeText}</span>` : ''; },
    endExtra: (S) => S.raceInfo ? S.raceInfo.endHtml() : '',
    onEnd: (S) => { const st = G3D.store().stats; st.raceRaces = (st.raceRaces || 0) + (S.raceInfo && S.raceInfo.finished ? 1 : 0); if (S.raceInfo && S.raceInfo.place === 1) st.raceWins = (st.raceWins || 0) + 1; },
    create: (api) => createRace(api)
};

function raceRecentWpm() {
    const lang = (typeof getActiveLanguage === 'function') ? getActiveLanguage() : 'he';
    const list = (appData.sessions || []).filter(s => (s.lang || 'he') === lang && (s.chars || 0) >= 25 && s.wpm > 0).slice(-25).map(s => s.wpm).sort((a, b) => a - b);
    if (!list.length) return lang === 'en' ? 22 : 18;
    return Math.max(8, list[Math.floor(list.length / 2)]);
}

function raceBuildText(cfg) {
    const en = isEnglishTyping();
    const target = { sprint: 80, medium: 180, long: 350, marathon: 600 }[cfg.distance] || 180;
    let mode = cfg.content;
    const known = Array.from(getKnownKeys()).filter(isLetterChar);
    if (mode === 'auto') mode = (getActiveLevel() < 3 && known.length < 18) ? 'letters' : (getActiveLevel() >= 5 ? 'paragraph' : 'sentences');
    let text = '';
    if (mode === 'letters') {
        const L = known.length >= 2 ? known : Object.values(getCurrentKeyboardLayout()).filter(isLetterChar).slice(0, 8);
        const parts = [];
        while (parts.join(' ').length < target) { let w = ''; const n = 2 + Math.floor(Math.random() * 3); for (let i = 0; i < n; i++) w += randomChoice(L); parts.push(w); }
        text = parts.join(' ');
    } else if (mode === 'words') {
        const bank = en ? ENGLISH_WORD_BANK : WORD_BANK;
        const all = [].concat(bank.short, bank.medium, bank.long).filter(w => !/\s/.test(w));
        const parts = [];
        while (parts.join(' ').length < target) parts.push(randomChoice(all));
        text = parts.join(' ');
    } else if (mode === 'paragraph') {
        const bank = en ? ENGLISH_PARAGRAPH_BANK : PARAGRAPH_BANK;
        const p = String(randomChoice(bank)).replace(/\s+/g, ' ').trim();
        const sentences = p.match(/[^.!?]+[.!?]?/g) || [p];
        const start = Math.floor(Math.random() * Math.max(1, sentences.length - 2));
        for (let i = start; text.length < target; i++) text += (text ? ' ' : '') + sentences[i % sentences.length].trim();
    } else {
        const bank = (en ? ENGLISH_SENTENCE_BANK : SENTENCE_BANK).slice().sort(() => Math.random() - 0.5);
        for (let i = 0; text.length < target; i++) text += (text ? ' ' : '') + bank[i % bank.length];
    }
    text = normalizePracticeText(text, false).replace(/\s+/g, ' ').trim();
    return text;
}

function createRace(api) {
    const T = api.THREE, scene = api.scene, camera = api.camera, cfg = api.cfg, P = api.particles, Q = api.Q;
    const en = isEnglishTyping();
    const text = raceBuildText(cfg);
    const chars = Array.from(text);
    const N = chars.length;

    // ---------- world ----------
    const HORIZON = new T.Color(0xf6a77a);
    scene.background = HORIZON.clone();
    scene.fog = new T.Fog(0xf2a785, 120, 760);
    camera.fov = 64; camera.near = 0.3; camera.far = 2200; camera.updateProjectionMatrix();

    scene.add(new T.HemisphereLight(0xbfd8ff, 0x5a4a30, 0.85));
    const sunL = new T.DirectionalLight(0xffd9b0, 1.5); sunL.position.set(-80, 120, -200); scene.add(sunL);
    scene.add(new T.AmbientLight(0xffffff, 0.15));

    // sky dome with a sunset gradient
    const skyTex = G3D.canvasTexture(16, 512, (ctx, w, h) => {
        const g = ctx.createLinearGradient(0, 0, 0, h);
        g.addColorStop(0, '#1b2a5c'); g.addColorStop(0.35, '#5b4c9a'); g.addColorStop(0.55, '#e0789a'); g.addColorStop(0.68, '#f8b27a'); g.addColorStop(0.75, '#ffd59a'); g.addColorStop(1, '#ffd59a');
        ctx.fillStyle = g; ctx.fillRect(0, 0, w, h);
    });
    const sky = new T.Mesh(new T.SphereGeometry(1500, 32, 16), new T.MeshBasicMaterial({ map: skyTex, side: T.BackSide, fog: false, depthWrite: false }));
    scene.add(sky);
    const sunSprite = new T.Sprite(new T.SpriteMaterial({ map: G3D.glowTexture('rgba(255,250,230,1)', 'rgba(255,190,120,0.55)'), transparent: true, depthWrite: false, fog: false, blending: T.AdditiveBlending }));
    sunSprite.scale.set(260, 260, 1); scene.add(sunSprite);

    // ---------- track ----------
    const START = 30;
    const raceLen = Math.max(320, Math.min(1500, N * 2.7));
    const totalLen = START + raceLen + 260;
    const pts = [];
    const seedA = Math.random() * 6, seedB = Math.random() * 6;
    for (let z = 0; z <= totalLen + 40; z += 30) {
        const k = Math.min(1, z / 120); // straight start grid
        pts.push(new T.Vector3(k * (34 * Math.sin(z / 140 + seedA) + 14 * Math.sin(z / 57 + seedB)) - k * (34 * Math.sin(seedA) + 14 * Math.sin(seedB)) * 0, 0, -z));
    }
    // shift so x starts at 0
    const x0 = pts[0].x; pts.forEach(p => { p.x -= x0; });
    const curve = new T.CatmullRomCurve3(pts, false, 'catmullrom', 0.5);
    const curveLen = curve.getLength();
    const UP = new T.Vector3(0, 1, 0);
    function frameAt(d) {
        const u = Math.max(0, Math.min(1, d / curveLen));
        const p = curve.getPointAt(u), tg = curve.getTangentAt(u);
        const nrm = new T.Vector3().crossVectors(tg, UP).normalize(); // points to the right of travel
        return { p, t: tg, n: nrm };
    }

    const ROAD_W = 18;
    function ribbon(offA, offB, y, mat, vScale) {
        const segs = Math.round(curveLen / 2);
        const pos = new Float32Array((segs + 1) * 6), uv = new Float32Array((segs + 1) * 4), idx = [];
        for (let i = 0; i <= segs; i++) {
            const d = i / segs * curveLen, f = frameAt(d);
            const a = f.p.clone().addScaledVector(f.n, offA), b = f.p.clone().addScaledVector(f.n, offB);
            pos.set([a.x, y, a.z, b.x, y, b.z], i * 6);
            uv.set([0, d / vScale, 1, d / vScale], i * 4);
            if (i < segs) { const k = i * 2; idx.push(k, k + 2, k + 1, k + 1, k + 2, k + 3); }
        }
        const g = new T.BufferGeometry();
        g.setAttribute('position', new T.BufferAttribute(pos, 3));
        g.setAttribute('uv', new T.BufferAttribute(uv, 2));
        g.setIndex(idx); g.computeVertexNormals();
        const m = new T.Mesh(g, mat); scene.add(m); return m;
    }
    const roadTex = G3D.canvasTexture(256, 256, (ctx, w, h) => {
        ctx.fillStyle = '#3a3c42'; ctx.fillRect(0, 0, w, h);
        for (let i = 0; i < 2600; i++) { const v = 40 + Math.random() * 40; ctx.fillStyle = `rgba(${v},${v},${v + 4},0.5)`; ctx.fillRect(Math.random() * w, Math.random() * h, 2, 2); }
        ctx.fillStyle = '#f2f2f2'; ctx.fillRect(6, 0, 6, h); ctx.fillRect(w - 12, 0, 6, h);
        ctx.fillStyle = 'rgba(255,255,255,0.85)';
        [0.25, 0.5, 0.75].forEach(f => ctx.fillRect(w * f - 2, 0, 4, h * 0.5));
    }, [1, 1]);
    roadTex.wrapS = T.ClampToEdgeWrapping;
    ribbon(-ROAD_W / 2, ROAD_W / 2, 0.02, new T.MeshStandardMaterial({ map: roadTex, roughness: 0.85, metalness: 0.05, side: T.DoubleSide, polygonOffset: true, polygonOffsetFactor: -1 }), 16);
    const curbTex = G3D.canvasTexture(16, 64, (ctx, w, h) => { ctx.fillStyle = '#e8e8e8'; ctx.fillRect(0, 0, w, h); ctx.fillStyle = '#d23030'; ctx.fillRect(0, 0, w, h / 2); }, [1, 1]);
    const curbMat = new T.MeshStandardMaterial({ map: curbTex, roughness: 0.7, side: T.DoubleSide, polygonOffset: true, polygonOffsetFactor: -1 });
    ribbon(-ROAD_W / 2 - 1.4, -ROAD_W / 2, 0.04, curbMat, 4);
    ribbon(ROAD_W / 2, ROAD_W / 2 + 1.4, 0.04, curbMat, 4);

    // grass
    const grassTex = G3D.canvasTexture(256, 256, (ctx, w, h) => {
        ctx.fillStyle = '#4f8a3a'; ctx.fillRect(0, 0, w, h);
        for (let i = 0; i < 3000; i++) { ctx.fillStyle = Math.random() < 0.5 ? 'rgba(40,90,30,0.5)' : 'rgba(120,170,70,0.4)'; ctx.fillRect(Math.random() * w, Math.random() * h, 2, 3); }
    }, [260, 260]);
    const ground = new T.Mesh(new T.PlaneGeometry(4000, 4000), new T.MeshStandardMaterial({ map: grassTex, roughness: 1 }));
    ground.rotation.x = -Math.PI / 2; ground.position.set(0, -0.02, -totalLen / 2); scene.add(ground);

    // trees (instanced)
    const treeN = Math.round((totalLen / 5) * Q.part) + 60;
    const trunkGeo = new T.CylinderGeometry(0.25, 0.35, 2.2, 6); trunkGeo.translate(0, 1.1, 0);
    const leafGeo = new T.ConeGeometry(1.7, 4.4, 7); leafGeo.translate(0, 4.2, 0);
    const trunks = new T.InstancedMesh(trunkGeo, new T.MeshStandardMaterial({ color: 0x6b4a2b, roughness: 1 }), treeN);
    const leaves = new T.InstancedMesh(leafGeo, new T.MeshStandardMaterial({ color: 0x2f6b34, roughness: 0.9, flatShading: true }), treeN);
    const dummy = new T.Object3D(), tc = new T.Color();
    for (let i = 0; i < treeN; i++) {
        const f = frameAt(Math.random() * curveLen);
        const side = Math.random() < 0.5 ? -1 : 1;
        const off = side * (ROAD_W / 2 + 6 + Math.pow(Math.random(), 1.6) * 90);
        dummy.position.copy(f.p).addScaledVector(f.n, off); dummy.position.y = 0;
        const s = 0.7 + Math.random() * 1.1; dummy.scale.set(s, s * (0.8 + Math.random() * 0.6), s); dummy.rotation.y = Math.random() * 6;
        dummy.updateMatrix(); trunks.setMatrixAt(i, dummy.matrix); leaves.setMatrixAt(i, dummy.matrix);
        leaves.setColorAt(i, tc.setHSL(0.25 + Math.random() * 0.1, 0.45, 0.22 + Math.random() * 0.12));
    }
    scene.add(trunks); scene.add(leaves);

    // mountains
    const mtnMat = new T.MeshStandardMaterial({ color: 0x6d6a8a, roughness: 1, flatShading: true });
    const snowMat = new T.MeshStandardMaterial({ color: 0xfff4f0, roughness: 0.8, flatShading: true });
    for (let i = 0; i < 26; i++) {
        const f = frameAt(Math.random() * curveLen);
        const side = i % 2 ? 1 : -1;
        const r = 70 + Math.random() * 110, h = 90 + Math.random() * 150;
        const m = new T.Mesh(new T.ConeGeometry(r, h, 6 + Math.floor(Math.random() * 3)), mtnMat);
        m.position.copy(f.p).addScaledVector(f.n, side * (380 + Math.random() * 260)); m.position.y = h / 2 - 2; m.rotation.y = Math.random() * 6; scene.add(m);
        const cap = new T.Mesh(new T.ConeGeometry(r * 0.32, h * 0.32, m.geometry.parameters.radialSegments), snowMat);
        cap.position.copy(m.position); cap.position.y = h - h * 0.16 - 2; cap.rotation.y = m.rotation.y; scene.add(cap);
    }

    // start/finish arches, grandstand, distance gantries
    const checker = G3D.canvasTexture(256, 64, (ctx, w, h) => { const s = 16; for (let y = 0; y < h; y += s) for (let x = 0; x < w; x += s) { ctx.fillStyle = ((x + y) / s) % 2 ? '#111' : '#fff'; ctx.fillRect(x, y, s, s); } });
    const pillarMat = new T.MeshStandardMaterial({ color: 0x2b2f3a, metalness: 0.6, roughness: 0.4 });
    function arch(d, label, color) {
        const f = frameAt(d), g = new T.Group();
        [-1, 1].forEach(s => { const p = new T.Mesh(new T.BoxGeometry(0.8, 9, 0.8), pillarMat); p.position.set(s * (ROAD_W / 2 + 1.6), 4.5, 0); g.add(p); });
        const bar = new T.Mesh(new T.BoxGeometry(ROAD_W + 4, 1.8, 0.5), new T.MeshStandardMaterial({ map: checker, roughness: 0.6 })); bar.position.y = 8.6; g.add(bar);
        if (label) { const l = G3D.makeLabel(label, { px: 64, height: 2.0, bg: color || 'rgba(10,10,20,0.85)', border: '#ffd34d', color: '#fff' }); l.sprite.position.y = 11.2; g.add(l.sprite); }
        g.position.copy(f.p); g.rotation.y = Math.atan2(-f.t.x, -f.t.z); scene.add(g); return g;
    }
    const startArch = arch(START, null);
    arch(START + raceLen, '🏁 ' + t('סיום', 'FINISH'), 'rgba(160,20,30,0.9)');
    [0.25, 0.5, 0.75].forEach(fr => arch(START + raceLen * fr, Math.round(fr * 100) + '%', 'rgba(20,40,90,0.85)'));
    // checkered lines on the road at start & finish
    [START, START + raceLen].forEach(d => {
        const f = frameAt(d);
        const m = new T.Mesh(new T.PlaneGeometry(ROAD_W, 2.2), new T.MeshStandardMaterial({ map: checker, roughness: 0.8, polygonOffset: true, polygonOffsetFactor: -2 }));
        m.rotation.x = -Math.PI / 2; m.position.copy(f.p); m.position.y = 0.05; m.rotation.z = Math.atan2(-f.t.x, -f.t.z); scene.add(m);
    });
    // start lights
    const lights = [];
    for (let i = 0; i < 5; i++) {
        const m = new T.Mesh(new T.SphereGeometry(0.42, 16, 12), new T.MeshStandardMaterial({ color: 0x220000, emissive: 0x000000, roughness: 0.3 }));
        m.position.set((i - 2) * 1.3, 7.1, 0.4); startArch.add(m); lights.push(m);
    }
    // grandstand with a crowd
    const crowdTex = G3D.canvasTexture(256, 128, (ctx, w, h) => {
        ctx.fillStyle = '#39404f'; ctx.fillRect(0, 0, w, h);
        const cols = ['#e74c3c', '#f1c40f', '#3498db', '#ecf0f1', '#2ecc71', '#9b59b6', '#e67e22'];
        for (let y = 6; y < h; y += 12) for (let x = 4; x < w; x += 9) { ctx.fillStyle = cols[Math.floor(Math.random() * cols.length)]; ctx.beginPath(); ctx.arc(x + Math.random() * 3, y, 3.2, 0, 7); ctx.fill(); }
    });
    [-1, 1].forEach(side => {
        const f = frameAt(START + 10);
        const gs = new T.Mesh(new T.BoxGeometry(40, 6, 7), [pillarMat, pillarMat, pillarMat, pillarMat, new T.MeshStandardMaterial({ map: crowdTex }), pillarMat]);
        gs.position.copy(f.p).addScaledVector(f.n, side * (ROAD_W / 2 + 14)); gs.position.y = 3;
        gs.rotation.y = Math.atan2(-f.t.x, -f.t.z) + (side > 0 ? -Math.PI / 2 : Math.PI / 2);
        gs.geometry.rotateY(0); scene.add(gs);
    });

    // ---------- cars ----------
    const shadowTex = G3D.canvasTexture(64, 64, (ctx, w, h) => { const g = ctx.createRadialGradient(w / 2, h / 2, 2, w / 2, h / 2, w / 2); g.addColorStop(0, 'rgba(0,0,0,0.55)'); g.addColorStop(1, 'rgba(0,0,0,0)'); ctx.fillStyle = g; ctx.fillRect(0, 0, w, h); });
    const tyreMat = new T.MeshStandardMaterial({ color: 0x151515, roughness: 0.9 });
    const rimMat = new T.MeshStandardMaterial({ color: 0xcfd6df, metalness: 0.9, roughness: 0.25 });
    const glassMat = new T.MeshStandardMaterial({ color: 0x1a2a40, metalness: 0.6, roughness: 0.1 });
    const headMat = new T.MeshStandardMaterial({ color: 0xffffff, emissive: 0xfff2c0, emissiveIntensity: 1.2 });
    const tailMat = new T.MeshStandardMaterial({ color: 0xff2020, emissive: 0xff1010, emissiveIntensity: 1.0 });
    const bodyShape = new T.Shape();
    bodyShape.moveTo(-2.15, 0.28); bodyShape.lineTo(2.2, 0.28); bodyShape.lineTo(2.25, 0.62); bodyShape.quadraticCurveTo(1.9, 0.86, 1.1, 0.88); bodyShape.lineTo(-1.8, 0.92); bodyShape.quadraticCurveTo(-2.2, 0.9, -2.15, 0.28);
    const bodyGeo = new T.ExtrudeGeometry(bodyShape, { depth: 1.86, bevelEnabled: true, bevelSize: 0.08, bevelThickness: 0.1, bevelSegments: 2, curveSegments: 8 });
    bodyGeo.translate(0, 0, -0.93); bodyGeo.rotateY(Math.PI / 2);
    const cabShape = new T.Shape();
    cabShape.moveTo(-1.35, 0.86); cabShape.lineTo(0.95, 0.86); cabShape.lineTo(0.35, 1.42); cabShape.lineTo(-0.95, 1.42); cabShape.lineTo(-1.35, 0.86);
    const cabGeo = new T.ExtrudeGeometry(cabShape, { depth: 1.5, bevelEnabled: true, bevelSize: 0.05, bevelThickness: 0.05, bevelSegments: 1 });
    cabGeo.translate(0, 0, -0.75); cabGeo.rotateY(Math.PI / 2);
    const wheelGeo = new T.CylinderGeometry(0.44, 0.44, 0.36, 18); wheelGeo.rotateZ(Math.PI / 2);
    const rimGeo = new T.CylinderGeometry(0.26, 0.26, 0.38, 10); rimGeo.rotateZ(Math.PI / 2);
    function makeCar(color, opts) {
        opts = opts || {};
        const g = new T.Group();
        const paint = new T.MeshStandardMaterial({ color, metalness: 0.55, roughness: 0.3, transparent: !!opts.ghost, opacity: opts.ghost ? 0.38 : 1, emissive: opts.ghost ? color : 0x000000, emissiveIntensity: opts.ghost ? 0.4 : 0 });
        const body = new T.Mesh(bodyGeo, paint); g.add(body);
        const cab = new T.Mesh(cabGeo, opts.ghost ? paint : glassMat); g.add(cab);
        const stripe = new T.Mesh(new T.BoxGeometry(0.4, 0.02, 4.1), new T.MeshStandardMaterial({ color: 0xffffff, transparent: !!opts.ghost, opacity: opts.ghost ? 0.3 : 1 })); stripe.position.set(0, 0.95, 0.1); g.add(stripe);
        const spoiler = new T.Mesh(new T.BoxGeometry(2.0, 0.08, 0.5), paint); spoiler.position.set(0, 1.25, 2.0); g.add(spoiler);
        [-0.7, 0.7].forEach(x => { const post = new T.Mesh(new T.BoxGeometry(0.08, 0.35, 0.12), pillarMat); post.position.set(x, 1.05, 2.0); g.add(post); });
        const wheels = [];
        [[-0.98, -1.35], [0.98, -1.35], [-0.98, 1.35], [0.98, 1.35]].forEach(([x, z]) => {
            const w = new T.Group();
            w.add(new T.Mesh(wheelGeo, tyreMat)); w.add(new T.Mesh(rimGeo, rimMat));
            w.position.set(x, 0.44, z); g.add(w); wheels.push(w);
        });
        if (!opts.ghost) {
            [-0.6, 0.6].forEach(x => { const h = new T.Mesh(new T.BoxGeometry(0.42, 0.14, 0.05), headMat); h.position.set(x, 0.62, -2.27); g.add(h); const tl = new T.Mesh(new T.BoxGeometry(0.5, 0.14, 0.05), tailMat); tl.position.set(x, 0.72, 2.2); g.add(tl); });
            const sh = new T.Mesh(new T.PlaneGeometry(3.4, 6.2), new T.MeshBasicMaterial({ map: shadowTex, transparent: true, depthWrite: false }));
            sh.rotation.x = -Math.PI / 2; sh.position.y = 0.06; g.add(sh);
        }
        scene.add(g);
        return { group: g, wheels, paint };
    }

    const base = raceRecentWpm();
    const dmul = ({ easy: 0.72, normal: 0.95, hard: 1.15, expert: 1.38 })[cfg.difficulty] || 0.95;
    const names = en ? ['Bolt', 'Storm', 'Turbo'] : ['ברק', 'סערה', 'טורבו'];
    const colors = [0xe0352b, 0xf2b41c, 0x8e44ff];
    const lanes = [-6.3, 6.3, -2.1];
    const PLAYER_LANE = 2.1;
    const racers = [0.84, 1.0, 1.17].map((m, i) => {
        const wpm = Math.max(6, Math.round(base * dmul * m));
        const car = makeCar(colors[i]);
        const lbl = G3D.makeLabel(`${names[i]} · ${wpm}`, { px: 40, height: 0.75, bg: 'rgba(0,0,0,0.55)', border: null, color: '#fff' });
        lbl.sprite.position.y = 2.5; car.group.add(lbl.sprite);
        return { name: names[i], wpm, car, lane: lanes[i], prog: 0, d: START - 9 + (i % 2) * -7, finishT: null, phase: Math.random() * 6, label: lbl };
    });
    racers[2].d = START - 2;
    const player = makeCar(0x16b3d9);
    player.group.add(new T.PointLight(0x66ddff, 0, 8));
    let playerD = START - 2, playerShown = playerD;
    // nitro flames
    const flameTex = G3D.glowTexture('rgba(255,255,255,1)', 'rgba(80,160,255,0.8)');
    const flames = [-0.55, 0.55].map(x => { const s = new T.Sprite(new T.SpriteMaterial({ map: flameTex, color: 0x66aaff, transparent: true, opacity: 0, blending: T.AdditiveBlending, depthWrite: false })); s.position.set(x, 0.5, 2.5); s.scale.set(1.2, 1.2, 1); player.group.add(s); return s; });

    // ghost
    const lang = getActiveLanguage();
    const st = G3D.store().stats;
    st.raceGhost = st.raceGhost || {};
    const ghostKey = `${lang}|${cfg.distance}`;
    const ghostData = cfg.ghost ? st.raceGhost[ghostKey] : null;
    const ghost = ghostData ? makeCar(0x9fffe0, { ghost: true }) : null;
    if (ghost) { const gl = G3D.makeLabel(`👻 ${t('השיא שלי', 'My best')} · ${ghostData.wpm}`, { px: 38, height: 0.7, bg: 'rgba(0,60,50,0.5)', border: null, color: '#cffff0' }); gl.sprite.position.y = 2.5; ghost.group.add(gl.sprite); }
    let ghostD = START - 2;
    const ghostSamples = [0];

    function place(car, d, lane, extraYaw) {
        const f = frameAt(d);
        car.group.position.copy(f.p).addScaledVector(f.n, lane);
        car.group.position.y = 0;
        car.group.rotation.y = Math.atan2(-f.t.x, -f.t.z) + (extraYaw || 0);
        return f;
    }

    // ---------- DOM: text ribbon, speedometer ----------
    const stage = api.stage;
    const ribbonEl = document.createElement('div');
    ribbonEl.className = 'g3-race-text'; ribbonEl.dir = en ? 'ltr' : 'rtl';
    stage.appendChild(ribbonEl);
    const speedo = document.createElement('div');
    speedo.className = 'g3-speedo';
    speedo.innerHTML = `<div class="g3-speedo-val">0</div><div class="g3-speedo-unit">${t('מ״לד', 'WPM')}</div><div class="g3-nitro"><span></span></div>`;
    stage.appendChild(speedo);
    stage.querySelector('.g3-typed').style.display = 'none';
    function esc(c) { return c === ' ' ? '<span class="sp">·</span>' : c.replace(/[&<>"]/g, x => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' })[x]); }
    let errFlash = 0;
    function drawRibbon() {
        const a = Math.max(0, idx - 24), b = Math.min(N, idx + 46);
        let h = '';
        for (let i = a; i < b; i++) {
            const cls = i < idx ? 'done' : i === idx ? ('cur' + (errFlash > 0 ? ' err' : '')) : '';
            h += `<span class="${cls}">${esc(chars[i])}</span>`;
        }
        ribbonEl.innerHTML = (a > 0 ? '<span class="fade">…</span>' : '') + h + (b < N ? '<span class="fade">…</span>' : ' 🏁');
    }

    // ---------- state ----------
    let raceStartReal = performance.now();
    let idx = 0, state = 'countdown', cd = 0, raceT = 0, lastKeyT = 0, finishT = null, endTimer = 0;
    let skid = 0, nitro = 0, nitroT = 0, wordStart = 0, errorsInWord = 0, lightsOn = -1;
    const keyTimes = [];
    let time = 0;
    const info = S_info();
    function S_info() {
        return {
            place: 1, finished: false, levelText: '', placeText: '',
            endHtml() {
                const rows = racers.map(r => ({ name: r.name, wpm: r.wpm, time: r.finishT != null ? r.finishT : N / (r.wpm * 5 / 60) }))
                    .concat([{ name: t('אתם', 'You') + ' 🏎️', wpm: playerWpmFinal(), time: finishT != null ? finishT : null, me: true }])
                    .sort((x, y) => (x.time == null) - (y.time == null) || x.time - y.time);
                return `<table class="data-table g3-race-table"><tr><th>#</th><th>${t('נהג', 'Driver')}</th><th>${t('מ״לד', 'WPM')}</th><th>${t('זמן', 'Time')}</th></tr>${rows.map((r, i) => `<tr class="${r.me ? 'me' : ''}"><td>${['🥇', '🥈', '🥉', '4'][i]}</td><td>${r.name}</td><td>${r.wpm}</td><td>${r.time != null ? r.time.toFixed(1) + t('ש׳', 's') : '—'}</td></tr>`).join('')}</table>
                    ${info.newGhost ? `<p class="g3-endnote">👻 ${t('שיא אישי חדש במסלול הזה — מכונית הרוח עודכנה!', 'New personal best on this track — your ghost car was updated!')}</p>` : ''}
                    <p class="g3-endnote">${t('מהירות הנהגים נקבעה לפי הממוצע האחרון שלכם', 'Driver speeds were set from your recent average')}: <b>${base} ${t('מ״לד', 'WPM')}</b></p>`;
            }
        };
    }
    function playerWpmFinal() { const tt = finishT != null ? finishT : raceT; return tt > 0 ? Math.round(idx / 5 / (tt / 60)) : 0; }

    function rollingWpm() {
        const now = performance.now();
        while (keyTimes.length && keyTimes[0] < now - 6000) keyTimes.shift();
        const win = Math.min(6, Math.max(1.5, (now - raceStartReal) / 1000));
        return Math.round(keyTimes.length / 5 / (win / 60));
    }
    function currentPlace() {
        const p = idx / N;
        let ahead = 0;
        racers.forEach(r => { if (r.finishT != null ? (finishT == null || r.finishT < finishT) : r.prog > p) ahead++; });
        return ahead + 1;
    }
    function updateInfo() {
        info.place = finishT != null ? info.place : currentPlace();
        info.placeText = `🏁 ${info.place}/${racers.length + 1}`;
        info.levelText = `${Math.round(idx / N * 100)}%`;
        const dots = racers.map((r, i) => `<i class="dot" style="left:${(r.prog * 100).toFixed(1)}%;background:#${colors[i].toString(16).padStart(6, '0')}"></i>`).join('')
            + (ghost ? `<i class="dot ghost" style="left:${(ghostProg() * 100).toFixed(1)}%"></i>` : '')
            + `<i class="dot me" style="left:${(idx / N * 100).toFixed(1)}%"></i>`;
        api.hud.extra(`<div class="g3-racemap" dir="ltr">${dots}<span class="flag">🏁</span></div>`);
    }
    function ghostProg() {
        if (!ghostData) return 0;
        const s = ghostData.samples, n = s.length - 1;
        if (raceT >= s[n]) return 1;
        for (let k = 1; k <= n; k++) if (s[k] >= raceT) { const a = s[k - 1], b = s[k]; return ((k - 1) + (raceT - a) / Math.max(0.001, b - a)) / n; }
        return 1;
    }

    // ---------- input ----------
    function expected() { return state === 'racing' ? chars[idx] : ''; }
    function onChar(ch) {
        if (state !== 'racing') return;
        const exp = chars[idx];
        const now = performance.now();
        api.track(exp, ch, lastKeyT ? now - lastKeyT : 0);
        lastKeyT = now;
        if (ch === exp) {
            idx++; api.keyOk(); keyTimes.push(performance.now());
            nitro = Math.min(1, nitro + 1 / 28);
            if (nitro >= 1 && nitroT <= 0) {
                nitroT = 3.5; nitro = 0; api.audio.sfx('boost'); api.power('double', '🔥×2', 3.5);
                api.banner('🔥 ' + t('ניטרו!', 'NITRO!'), t('ניקוד כפול', 'Double points'), 'power', 1300);
            }
            for (let k = ghostSamples.length; k <= 20 && idx / N >= k / 20; k++) ghostSamples.push(raceT);
            if (exp === ' ' || idx === N) {
                const wlen = idx - wordStart - (exp === ' ' ? 1 : 0);
                if (wlen > 0) api.wordDone(6 + wlen * 4 + (errorsInWord ? 0 : 6), player.group.position.clone().add(new T.Vector3(0, 3, 0)), { cls: errorsInWord ? '' : 'hot' });
                wordStart = idx; errorsInWord = 0;
            }
            if (idx >= N) finish();
        } else {
            api.keyBad(); errorsInWord++;
            skid = 0.45; errFlash = 0.25; nitro = Math.max(0, nitro - 0.2);
            api.audio.sfx('skid'); api.shake(0.18);
        }
        api.hud.hint(chars[idx] || '', idx + '|race');
        drawRibbon();
    }
    function finish() {
        state = 'finished';
        finishT = raceT;
        racers.forEach(r => { if (r.finishT == null) r.finishT = N / (r.wpm * 5 / 60); });
        info.place = currentPlace();
        info.finished = true;
        const bonus = [1500, 900, 500, 200][info.place - 1] || 0;
        api.addScore(bonus + playerWpmFinal() * 12);
        const wpm = playerWpmFinal();
        if (!ghostData || finishT < ghostData.samples[20]) {
            while (ghostSamples.length < 21) ghostSamples.push(finishT);
            st.raceGhost[ghostKey] = { wpm, samples: ghostSamples.map(x => Math.round(x * 100) / 100), at: Date.now() };
            info.newGhost = true;
            scheduleSaveData();
        }
        api.audio.sfx(info.place === 1 ? 'fanfare' : 'levelup');
        api.banner(info.place === 1 ? '🏆 ' + t('מקום ראשון!', '1st place!') : `🏁 ${t('מקום', 'Place')} ${info.place}`, `${wpm} ${t('מ״לד', 'WPM')}`, 'level', 3000);
        for (let i = 0; i < 6; i++) setTimeout(() => P.emit(player.group.position.clone().add(new T.Vector3((Math.random() - 0.5) * 8, 4 + Math.random() * 3, -4)), Math.round(60 * Q.part), { color: [0xffd34d, 0xff5577, 0x55ddff][i % 3], color2: 0xffffff, speed: 10, size: 0.9, life: 1.4, gravity: 6 }), i * 220);
        endTimer = 3.6;
        api.hud.hint('', '');
    }

    // ---------- update ----------
    const camPos = new T.Vector3(), camLook = new T.Vector3(), tmp = new T.Vector3();
    let camInit = false;
    let prevRaceT = 0;
    function updateCars(dt, raceDt) {
        racers.forEach(r => {
            if (state === 'racing' || state === 'finished') {
                const cps = r.wpm * 5 / 60 * (1 + 0.14 * Math.sin(raceT * 0.45 + r.phase));
                r.prog = Math.min(1, r.prog + cps * raceDt / N);
                if (r.prog >= 1 && r.finishT == null) r.finishT = raceT;
            }
            const target = r.prog >= 1 ? START + raceLen + Math.min(200, (raceT - (r.finishT || raceT)) * 20) : START + r.prog * raceLen;
            const vd = Math.max(0, target - r.d);
            r.d += vd * Math.min(1, dt * 3);
            if (r.prog <= 0) r.d = r.d; // waiting on the grid
            place(r.car, r.d, r.lane, Math.sin(time * 2 + r.phase) * 0.015);
            r.car.wheels.forEach(w => { w.rotation.x -= vd * dt * 1.2; });
        });
        if (ghost) {
            const gp = state === 'countdown' ? 0 : ghostProg();
            ghostD += ((START + gp * raceLen) - ghostD) * Math.min(1, dt * 4);
            place(ghost, ghostD, PLAYER_LANE + 0.0);
            ghost.paint.opacity = 0.25 + Math.sin(time * 4) * 0.08;
        }
    }

    let lastFrameReal = 0;
    function update(dt, realDt) {
        time += realDt;
        const frameNow = performance.now();
        if (errFlash > 0) { errFlash -= realDt; if (errFlash <= 0) drawRibbon(); }
        if (state === 'countdown') {
            cd += realDt;
            const k = Math.floor(Math.max(0, cd - 0.8) / 0.7);
            if (k !== lightsOn && k <= 5) {
                lightsOn = k;
                if (k >= 1 && k <= 4) { api.audio.sfx('beep'); }
                lights.forEach((l, i) => { l.material.color.setHex(i < k ? 0xff2020 : 0x220000); l.material.emissive.setHex(i < k ? 0xff1010 : 0); });
                if (k === 5) {
                    lights.forEach(l => { l.material.color.setHex(0x22ff55); l.material.emissive.setHex(0x22ff55); });
                    api.audio.sfx('beep', { high: true });
                    api.banner('GO!', t('הקלידו!', 'Type!'), 'level', 900);
                    state = 'racing'; raceT = 0; lastKeyT = 0; raceStartReal = performance.now();
                    api.hud.hint(chars[0], '0|race');
                }
            }
        } else if (state === 'racing' || state === 'finished') {
            // real wall-clock time (a pause gap is capped), so results are fair even at a low frame rate
            const nowR = performance.now();
            raceT += Math.min(0.5, (nowR - (lastFrameReal || nowR)) / 1000);
            if (state === 'finished') { endTimer -= realDt; if (endTimer <= 0 && !api.isOver()) { state = 'done'; api.end(info.place === 1); } }
        }
        if (state === 'racing' && lightsOn === 5 && raceT > 2) lights.forEach(l => { l.material.emissive.setHex(0x000000); l.material.color.setHex(0x220000); });

        // player motion
        playerD = finishT != null ? START + raceLen + Math.min(220, (raceT - finishT) * 22) : START - 2 + Math.max(0, idx / N * raceLen + (idx ? 2 : 0));
        const prev = playerShown;
        playerShown += (playerD - playerShown) * Math.min(1, realDt * (nitroT > 0 ? 6 : 4));
        const v = (playerShown - prev) / Math.max(0.001, realDt);
        if (skid > 0) skid -= realDt;
        const yawWobble = skid > 0 ? Math.sin(time * 40) * 0.12 * (skid / 0.45) : 0;
        const f = place(player, playerShown, PLAYER_LANE + (skid > 0 ? Math.sin(time * 25) * 0.25 : 0), yawWobble);
        player.wheels.forEach(w => { w.rotation.x -= v * realDt * 1.2; });
        player.group.rotation.z = -yawWobble * 0.5;
        if (nitroT > 0) nitroT -= realDt;
        flames.forEach(fl => { fl.material.opacity = nitroT > 0 ? 0.9 : Math.max(0, fl.material.opacity - realDt * 3); const s = (nitroT > 0 ? 1.6 : 0.9) * (0.8 + Math.random() * 0.5); fl.scale.set(s, s, 1); });
        if (nitroT > 0 && Math.random() < 0.8) P.emit(player.group.localToWorld(new T.Vector3((Math.random() - 0.5) * 1.2, 0.5, 2.6)), 2, { color: 0x66aaff, color2: 0xffffff, speed: 3, size: 0.5, life: 0.35 });
        if (skid > 0 && Math.random() < 0.7) P.emit(player.group.localToWorld(new T.Vector3((Math.random() - 0.5) * 2, 0.2, 1.4)), 3, { color: 0xffcc66, color2: 0xffffff, speed: 5, size: 0.25, life: 0.3, up: 2 });
        if (v > 4 && Math.random() < 0.35 * Q.part) P.emit(player.group.localToWorld(new T.Vector3((Math.random() < 0.5 ? -1 : 1), 0.1, 1.6)), 1, { color: 0xb0a090, speed: 1.2, size: 0.8, life: 0.8, drag: 1, up: 0.6 });

        updateCars(realDt, raceT - (prevRaceT || 0)); prevRaceT = raceT;

        // chase camera
        const back = 9.5 - Math.min(2.5, v * 0.03), height = 3.6;
        tmp.copy(f.p).addScaledVector(f.n, PLAYER_LANE * 0.7).addScaledVector(f.t, -back); tmp.y = height;
        const ahead = frameAt(playerShown + 14);
        if (!camInit) { camPos.copy(tmp); camLook.copy(ahead.p); camInit = true; }
        camPos.lerp(tmp, Math.min(1, realDt * 3.2));
        camLook.lerp(tmp.copy(ahead.p).addScaledVector(ahead.n, PLAYER_LANE * 0.6).setY(1.2), Math.min(1, realDt * 4));
        api.setCameraBase(camPos);
        const targetFov = 64 + Math.min(14, v * 0.12) + (nitroT > 0 ? 8 : 0);
        camera.fov += (targetFov - camera.fov) * Math.min(1, realDt * 3); camera.updateProjectionMatrix();
        sky.position.copy(camPos); sky.position.y = 0;
        sunSprite.position.set(camPos.x - 220, 150, camPos.z - 900);

        lastFrameReal = frameNow;
        // HUD
        hudT += realDt;
        if (hudT > 0.12) {
            hudT = 0;
            updateInfo();
            api.setLevelProgress(idx / N);
            const w = state === 'racing' ? rollingWpm() : (state === 'countdown' ? 0 : playerWpmFinal());
            speedo.querySelector('.g3-speedo-val').textContent = w;
            speedo.querySelector('.g3-nitro span').style.width = Math.round((nitroT > 0 ? nitroT / 3.5 : nitro) * 100) + '%';
            speedo.classList.toggle('boost', nitroT > 0);
        }
    }
    let hudT = 0;
    function afterCamera() { camera.lookAt(camLook); }
    function ambient(dt) { time += dt; }

    // initial placement
    racers.forEach(r => place(r.car, r.d, r.lane));
    place(player, playerShown, PLAYER_LANE);
    if (ghost) place(ghost, ghostD, PLAYER_LANE);
    update(0.016, 0.016);
    drawRibbon();
    updateInfo();
    api.setLevelProgress(0);

    return {
        update, onChar, expected, ambient, afterCamera, _info: info,
        activeTime() { return finishT != null ? finishT : raceT; },
        onBackspace() {},
        dispose() { ribbonEl.remove(); speedo.remove(); },
        _syncStats(S) { S.raceInfo = info; S.words = S.words; }
    };
}
