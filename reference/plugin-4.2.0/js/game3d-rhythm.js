// ---- 4.2: "Key Rhythm" (קצב המקלדת) — a rhythm game on finger lanes ----
// Eight lanes, one per finger. Every letter of a word becomes a note that slides
// down the lane of the finger that types it, and reaches the hit line exactly on
// the beat. Type it on time: Perfect / Great / Good. The tempo rises with each
// level. Steady rhythm is the secret of fast typing — and the lanes teach which
// finger owns which key without looking at the keyboard.

const RHYTHM_LANES = ['lp', 'lr', 'lm', 'li', 'ri', 'rm', 'rr', 'rp'];
const RHYTHM_COLORS = { lp: 0xf78fb3, lr: 0xf7c45c, lm: 0x7be07b, li: 0x6fb6ff, ri: 0x6fb6ff, rm: 0x7be07b, rr: 0xf7c45c, rp: 0xf78fb3 };

const RHYTHM_DEF = PLUS.newGame({
    id: 'rhythm', icon: '🎵', theme: 'g3-rhythm', music: 'none',
    lifeIcon: '🎧', lifeIconOff: '▫️',
    title: () => t('קצב המקלדת', 'Key Rhythm'),
    desc: () => t('משחק קצב: כל אות במילה היא תו שמחליק במסלול של האצבע שמקלידה אותה ומגיע לקו בדיוק על הפעמה. הקלידו בזמן — מושלם / מצוין / טוב — והמוזיקה נבנית מההקלדה שלכם. הקצב עולה בכל שלב.', 'A rhythm game: every letter of a word is a note sliding down the lane of the finger that types it, reaching the line exactly on the beat. Type on time — Perfect / Great / Good — and the music grows out of your typing. The tempo rises every level.'),
    trains: () => t('מתאמן על: קצב אחיד, איזו אצבע לכל מקש, הקלדה בלי להסתכל', 'Trains: an even rhythm, which finger owns each key, typing without looking'),
    keysHelp: () => t('הקלידו כל אות כשהיא נוגעת בקו · Esc = השהיה', 'Type each letter as it touches the line · Esc = pause'),
    defaults: { content: 'auto', tempo: 'normal' },
    hideCommon: ['music'],
    options: () => [
        { key: 'content', label: t('תוכן', 'Content'), choices: [['auto', t('אוטומטי — לפי ההתקדמות שלי', 'Auto — based on my progress')], ['letters', t('צירופי אותיות שלמדתי', 'Letter clusters I learned')], ['short', t('מילים קצרות', 'Short words')], ['words', t('מילים', 'Words')], ['mixed', t('מעורב', 'Mixed')]] },
        { key: 'tempo', label: t('קצב התחלתי', 'Starting tempo'), choices: [['slow', t('איטי (70)', 'Slow (70)')], ['normal', t('רגיל (90)', 'Normal (90)')], ['fast', t('מהיר (115)', 'Fast (115)')]] },
        { key: 'music', label: t('מוזיקה', 'Music'), toggle: true }
    ],
    startBanner: () => t('🎵 קצב המקלדת', '🎵 Key Rhythm'),
    startSub: () => t('הקלידו כשהתו נוגע בקו', 'Type when the note touches the line'),
    wordsLabel: () => t('מילים', 'Words'),
    hudLevel: (S) => { const g = S.game; return g && g._bpm ? `🎵 ${g._bpm} BPM · ${t('שלב', 'Lv')} ${S.level}` : t('שלב', 'Level') + ' ' + S.level; },
    _endExtra: (S) => {
        const a = S.rhythmStats; if (!a) return '';
        const n = a.perfect + a.great + a.good + a.miss;
        return `<p class="g3-endnote">🎯 ${t('מושלם', 'Perfect')}: <b>${a.perfect}</b> · ${t('מצוין', 'Great')}: <b>${a.great}</b> · ${t('טוב', 'Good')}: <b>${a.good}</b> · ${t('פספוס', 'Miss')}: <b>${a.miss}</b>${n ? ` · ${t('דיוק קצב', 'Timing')}: <b>${Math.round((a.perfect + a.great * 0.7 + a.good * 0.4) / n * 100)}%</b>` : ''} · 🎵 ${t('קצב מרבי', 'Top tempo')}: <b>${a.maxBpm}</b></p>
            ${a.offN ? `<p class="g3-endnote">${a.off / a.offN < -0.015 ? t('⏩ אתם נוטים להקדים — נסו לחכות לקו', '⏩ You tend to be early — wait for the line') : a.off / a.offN > 0.015 ? t('⏪ אתם נוטים לאחר — הקלידו מעט מוקדם יותר', '⏪ You tend to be late — type a little earlier') : t('👌 התזמון שלכם מאוזן', '👌 Your timing is well centered')}</p>` : ''}`;
    },
    _onEnd: (S) => { const st = G3D.store().stats; const a = S.rhythmStats || {}; st.rhythmPerfect = (st.rhythmPerfect || 0) + (a.perfect || 0); st.rhythmBpm = Math.max(st.rhythmBpm || 0, a.maxBpm || 0); },
    _create: (api) => createRhythm(api)
}, {});

function createRhythm(api) {
    const T = api.THREE, scene = api.scene, camera = api.camera, cfg = api.cfg, D = api.D, P = api.particles, Q = api.Q, A = api.audio;
    const words = galaxyWordSource(cfg);
    scene.background = new T.Color(0x07051a);
    scene.fog = new T.Fog(0x07051a, 30, 90);
    camera.fov = 58; camera.updateProjectionMatrix();
    scene.add(new T.HemisphereLight(0xbfb8ff, 0x1a1030, 0.9));

    const LW = 1.25, NL = 8, HIT_Z = 0, FAR_Z = -60;
    const laneX = i => (i - (NL - 1) / 2) * LW + (i >= 4 ? 0.35 : -0.35); // a small gap between the hands
    // highway
    const hw = new T.Mesh(new T.PlaneGeometry(NL * LW + 1.6, 80), new T.MeshBasicMaterial({ color: 0x120c2e }));
    hw.rotation.x = -Math.PI / 2; hw.position.set(0, -0.01, -36); scene.add(hw);
    const laneMats = [];
    RHYTHM_LANES.forEach((f, i) => {
        const m = new T.MeshBasicMaterial({ color: RHYTHM_COLORS[f], transparent: true, opacity: 0.09, depthWrite: false });
        const s = new T.Mesh(new T.PlaneGeometry(LW - 0.12, 80), m); s.rotation.x = -Math.PI / 2; s.position.set(laneX(i), 0, -36); scene.add(s); laneMats.push(m);
    });
    // beat lines that scroll
    const beatLines = [];
    for (let i = 0; i < 24; i++) { const l = new T.Mesh(new T.PlaneGeometry(NL * LW + 1.4, 0.06), new T.MeshBasicMaterial({ color: 0x8877ff, transparent: true, opacity: 0.25 })); l.rotation.x = -Math.PI / 2; l.position.y = 0.01; scene.add(l); beatLines.push(l); }
    // receptors
    const pads = [];
    RHYTHM_LANES.forEach((f, i) => {
        const col = RHYTHM_COLORS[f];
        const pad = new T.Mesh(new T.CylinderGeometry(0.5, 0.5, 0.12, 24), new T.MeshStandardMaterial({ color: col, emissive: col, emissiveIntensity: 0.25, roughness: 0.4 }));
        pad.position.set(laneX(i), 0.06, HIT_Z); scene.add(pad);
        const ring = new T.Mesh(new T.RingGeometry(0.52, 0.62, 32), new T.MeshBasicMaterial({ color: 0xffffff, transparent: true, opacity: 0.5, side: T.DoubleSide }));
        ring.rotation.x = -Math.PI / 2; ring.position.set(laneX(i), 0.14, HIT_Z); scene.add(ring);
        const lab = G3D.makeLabel(fingerName(f).replace(/ (שמאל|ימין|left|right)/i, ''), { px: 34, height: 0.32, bg: 'rgba(0,0,0,0.45)', border: null });
        lab.sprite.position.set(laneX(i), 0.35, HIT_Z + 1.1); scene.add(lab.sprite);
        pads.push({ pad, ring, glow: 0, lab });
    });
    const hitLine = new T.Mesh(new T.PlaneGeometry(NL * LW + 1.4, 0.12), new T.MeshBasicMaterial({ color: 0xffffff, transparent: true, opacity: 0.7 }));
    hitLine.rotation.x = -Math.PI / 2; hitLine.position.set(0, 0.02, HIT_Z - 0.55); scene.add(hitLine);
    // equalizer towers on the sides
    const eq = [];
    for (let s = -1; s <= 1; s += 2) for (let i = 0; i < 10; i++) {
        const m = new T.Mesh(new T.BoxGeometry(1.2, 1, 1.2), new T.MeshBasicMaterial({ color: new T.Color().setHSL(0.7 + i * 0.03, 0.8, 0.55), transparent: true, opacity: 0.75 }));
        m.position.set(s * (NL * LW / 2 + 3 + (i % 2) * 1.6), 0.5, -6 - i * 5.5); scene.add(m); eq.push({ m, ph: Math.random() * 6 });
    }
    // stars
    const sN = 700, sp = new Float32Array(sN * 3);
    for (let i = 0; i < sN; i++) { sp[i * 3] = (Math.random() - 0.5) * 160; sp[i * 3 + 1] = 4 + Math.random() * 50; sp[i * 3 + 2] = -10 - Math.random() * 90; }
    const sg = new T.BufferGeometry(); sg.setAttribute('position', new T.BufferAttribute(sp, 3));
    scene.add(new T.Points(sg, new T.PointsMaterial({ color: 0xffffff, size: 0.35, transparent: true, opacity: 0.8, fog: false })));

    // ---- song ----
    const startBpm = ({ slow: 70, normal: 90, fast: 115 })[cfg.tempo] || 90;
    let bpm = startBpm;
    const approach = () => Math.max(1.3, 2.6 / (0.6 + D.speed * 0.4)) * (90 / Math.max(bpm, 60)) ** 0.35;
    const W = { perfect: 0.055, great: 0.11, good: 0.19 };
    const wMul = ({ easy: 1.45, normal: 1.15, hard: 1, expert: 0.85 })[cfg.difficulty] || 1.15;
    let time = 0, nextBeat = 1.5, beatIdx = 0, nextSlot = 0;
    const notes = []; // { ch, lane, t, mesh, lab, state, word }
    const wordsQ = []; // { notes:[], misses:0, done:false }
    const stats = { perfect: 0, great: 0, good: 0, miss: 0, maxBpm: bpm, off: 0, offN: 0 };
    let levelWords = 0, missRun = 0;
    const wordsForLevel = () => 6 + api.level * 2;
    const gemGeo = new T.OctahedronGeometry(0.42, 0);

    function laneOf(ch) { const r = resolveKeyForChar(ch); const f = r ? KEY_TO_FINGER[r.code] : null; const i = RHYTHM_LANES.indexOf(f); return i >= 0 ? i : 3; }
    function queueWord() {
        let w = words.next(api.level); if (Array.from(w).length > 8) w = words.next(1);
        const chars = Array.from(w).filter(c => c !== ' ');
        const eighth = 60 / bpm / 2;
        // density: one letter per beat at first, then per eighth note
        const step = api.level <= 2 ? 2 : (api.level <= 5 ? (Math.random() < 0.5 ? 1 : 2) : 1);
        const W0 = { notes: [], misses: 0, errs: 0, done: false, text: w };
        let tt = Math.max(nextSlot, time + approach() + 0.2);
        chars.forEach((ch) => {
            const lane = laneOf(ch);
            const col = RHYTHM_COLORS[RHYTHM_LANES[lane]];
            const mesh = new T.Mesh(gemGeo, new T.MeshStandardMaterial({ color: col, emissive: col, emissiveIntensity: 0.6, roughness: 0.3, metalness: 0.2 }));
            mesh.position.set(laneX(lane), 0.45, FAR_Z); scene.add(mesh);
            const lab = G3D.makeLabel(ch, { px: 80, height: 0.85, color: '#ffffff', bg: 'rgba(10,6,30,0.75)', border: '#' + new T.Color(col).getHexString(), depthTest: false });
            lab.sprite.position.set(0, 0.95, 0); mesh.add(lab.sprite);
            const n = { ch, lane, t: tt, mesh, lab, state: 0, word: W0 };
            notes.push(n); W0.notes.push(n);
            tt += eighth * step;
        });
        nextSlot = tt + eighth * 2; // a rest between words
        wordsQ.push(W0);
    }
    function nextNote() { return notes.find(n => n.state === 0) || null; }
    function expected() { const n = nextNote(); return n ? n.ch : ''; }
    function hint() { const n = nextNote(); api.hud.hint(n ? n.ch : '', n ? n.ch + '|' + n.t.toFixed(3) : ''); const w = n ? n.word : null; api.hud.typed(w ? w.notes.filter(x => x.state === 1).map(x => x.ch).join('') : ''); }

    // ---- music (scheduled from game time, so pausing just stops it) ----
    const midi = n => 440 * Math.pow(2, (n - 69) / 12);
    const PROG = [[57, 60, 64], [53, 57, 60], [48, 52, 55], [55, 59, 62]];
    function scheduleMusic() {
        if (!A.ctx) return;
        const ahead = 0.18;
        while (nextBeat < time + ahead) {
            const at = A.ctx.currentTime + Math.max(0, nextBeat - time);
            const eighthIdx = beatIdx;
            const bar = Math.floor(eighthIdx / 8) % 4, ch = PROG[bar];
            if (cfg.music !== false) {
                const mg = A.musicGain;
                if (eighthIdx % 2 === 0) A.tone(52, at, 0.16, 'sine', 0.32, mg, 34);           // kick
                if (eighthIdx % 4 === 2) A.noiseBurst(at, 0.12, 0.14, 3200, 1, mg);           // snare
                A.noiseBurst(at, 0.025, 0.035, 9000, 1, mg);                                   // hat
                if (eighthIdx % 2 === 0) A.tone(midi(ch[0] - 24), at, 60 / bpm * 0.9, 'triangle', 0.13, mg);
                if (eighthIdx % 8 === 0) ch.forEach(n => A.pad(midi(n), at, 60 / bpm * 4, 0.022));
            }
            if (eighthIdx % 2 === 0) pulse = 1;
            beatIdx++;
            nextBeat += 60 / bpm / 2;
        }
    }
    let pulse = 0;

    // ---- judging ----
    let lastKeyT = performance.now();
    function judge(n, off) {
        const a = Math.abs(off);
        const k = a <= W.perfect * wMul ? 'perfect' : a <= W.great * wMul ? 'great' : 'good';
        stats[k]++; stats.off += off; stats.offN++;
        n.state = 1;
        const p = pads[n.lane]; p.glow = 1;
        const col = RHYTHM_COLORS[RHYTHM_LANES[n.lane]];
        P.emit(new T.Vector3(laneX(n.lane), 0.5, HIT_Z), Math.round((k === 'perfect' ? 34 : 18) * Q.part) + 4, { color: col, color2: 0xffffff, speed: k === 'perfect' ? 7 : 4, size: 0.45, life: 0.55, up: 3 });
        const label = { perfect: t('מושלם!', 'Perfect!'), great: t('מצוין', 'Great'), good: t('טוב', 'Good') }[k];
        api.popup(label, new T.Vector3(laneX(n.lane), 1.6, HIT_Z), k === 'perfect' ? 'gold' : k === 'great' ? 'hot' : '');
        api.addScore(k === 'perfect' ? 30 : k === 'great' ? 18 : 8);
        if (k === 'perfect') api.feverBoost(0.012);
        removeNote(n, true);
        missRun = 0;
        checkWord(n.word);
    }
    function removeNote(n, hit) {
        if (hit) { n.lab.dispose(); scene.remove(n.mesh); n.mesh.material.dispose(); n.removed = true; }
    }
    function checkWord(Wd) {
        if (Wd.done || Wd.notes.some(x => x.state === 0)) return;
        Wd.done = true;
        if (!Wd.misses) {
            const pos = new T.Vector3(0, 2.4, HIT_Z - 1);
            api.wordDone(10 + Wd.notes.length * 7, pos, { cls: Wd.errs ? '' : 'hot' });
        } else api.setLevelProgress(levelWords / wordsForLevel());
        levelWords++;
        api.setLevelProgress(levelWords / wordsForLevel());
        if (levelWords >= wordsForLevel()) {
            levelWords = 0;
            bpm = Math.min(180, bpm + ({ easy: 6, normal: 8, hard: 10, expert: 12 }[cfg.difficulty] || 8));
            stats.maxBpm = Math.max(stats.maxBpm, bpm);
            api.levelUp(`🎵 ${bpm} BPM`);
        }
    }
    function onChar(ch) {
        const now = performance.now();
        const exp = nextNote();
        // the closest pending note with this letter within the "good" window
        let best = null, bestOff = 9;
        notes.forEach(n => { if (n.state === 0 && n.ch === ch) { const off = time - n.t; if (Math.abs(off) < Math.abs(bestOff)) { best = n; bestOff = off; } } });
        api.track(exp ? exp.ch : ch, ch, now - lastKeyT); lastKeyT = now;
        if (best && Math.abs(bestOff) <= W.good * wMul + 0.04) {
            // notes skipped before it (in the same word) count as misses
            api.keyOk(); judge(best, bestOff);
        } else {
            api.keyBad();
            if (exp) exp.word.errs++;
            if (best && bestOff < 0) api.popup(t('מוקדם מדי', 'Too early'), new T.Vector3(laneX(best.lane), 1.3, HIT_Z), '');
            else if (exp) { const i = laneOf(ch); pads[i].pad.material.emissive.setHex(0xff2244); setTimeout(() => pads[i].pad.material.emissive.setHex(RHYTHM_COLORS[RHYTHM_LANES[i]]), 120); }
        }
        hint();
    }
    function miss(n) {
        n.state = 2; stats.miss++; n.word.misses++;
        n.mesh.material.color.setHex(0x444455); n.mesh.material.emissive.setHex(0x220000);
        n.lab.setColors({ color: '#888' });
        api.keyBad();
        api.popup(t('פספוס', 'Miss'), new T.Vector3(laneX(n.lane), 1.2, HIT_Z), 'boss');
        missRun++;
        if (missRun >= 4) { missRun = 0; api.damage(1); }
        checkWord(n.word);
        hint();
    }

    // ---- loop ----
    const camPos = new T.Vector3(0, 6.2, 7.2), look = new T.Vector3(0, 0, -9);
    function update(dt, realDt) {
        time += realDt;
        scheduleMusic();
        // keep about two words queued ahead
        const pending = wordsQ.filter(w => !w.done).length;
        if (!api.isDying() && (pending < 2 || nextSlot < time + approach() + 1.2)) queueWord();
        const ap = approach();
        for (let i = notes.length - 1; i >= 0; i--) {
            const n = notes[i];
            const k = (n.t - time) / ap; // 1 = far, 0 = on the line
            if (n.state !== 1) {
                n.mesh.position.z = HIT_Z + (FAR_Z - HIT_Z) * Math.max(-0.4, k);
                n.mesh.rotation.y += realDt * 2.5;
                n.mesh.visible = k < 1.05;
                const s = n.state === 2 ? 0.8 : 1 + Math.max(0, 0.15 - Math.abs(k)) * 3;
                n.mesh.scale.setScalar(s);
            }
            if (n.state === 0 && time - n.t > W.good * wMul + 0.05) miss(n);
            if (n.state === 2 && k < -0.35 && !n.removed) { n.lab.dispose(); scene.remove(n.mesh); n.mesh.material.dispose(); n.removed = true; }
            if (n.removed) notes.splice(i, 1);
        }
        for (let i = wordsQ.length - 1; i >= 0; i--) if (wordsQ[i].done && wordsQ[i].notes.every(n => n.removed)) wordsQ.splice(i, 1);
        // beat lines scroll with the music
        const beatLen = 60 / bpm;
        const phase = ((time - 1.5) / beatLen) % 1;
        beatLines.forEach((l, i) => { const kk = (i - phase) * beatLen / ap; l.position.z = HIT_Z + (FAR_Z - HIT_Z) * kk; l.visible = kk >= 0 && kk < 1; l.material.opacity = (i % 4 === 0 ? 0.45 : 0.18); });
        pulse *= Math.pow(0.02, realDt);
        pads.forEach((p, i) => { p.glow *= Math.pow(0.01, realDt); p.pad.material.emissiveIntensity = 0.55 + p.glow * 1.6 + pulse * 0.15; p.ring.scale.setScalar(1 + p.glow * 0.4); laneMats[i].opacity = 0.14 + p.glow * 0.25 + pulse * 0.04; });
        eq.forEach((e, i) => { const h = 1 + pulse * (2 + Math.sin(e.ph + i) * 1.5) + (api.isFever() ? 2 : 0) * Math.abs(Math.sin(time * 6 + i)); e.m.scale.y = h; e.m.position.y = h / 2; });
        hitLine.material.opacity = 0.5 + pulse * 0.5;
        camPos.set(Math.sin(time * 0.3) * 0.4, 6.2 + pulse * 0.08, 7.2);
        api.setCameraBase(camPos);
        if (Math.random() < 0.2) hint();
    }
    function afterCamera() { camera.lookAt(look); }
    function ambient(dt) { pulse *= 0.9; }
    camera.position.copy(camPos); camera.lookAt(look);
    return {
        update, onChar, expected, ambient, afterCamera,
        get _bpm() { return bpm; },
        onBackspace() {},
        dispose() { notes.forEach(n => { if (!n.removed) n.lab.dispose(); }); pads.forEach(p => p.lab.dispose()); },
        _syncStats(S) { S.rhythmStats = stats; }
    };
}
