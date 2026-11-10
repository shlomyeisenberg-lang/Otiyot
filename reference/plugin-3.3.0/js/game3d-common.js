// ---- 3.2: Shared engine for the 3D typing games ----
// Lazy-loads Three.js (bundled locally — works offline inside Otzaria), and
// provides: renderer + quality levels, Hebrew text labels on 3D objects, a GPU
// particle system, synthesized sound effects + music, HUD, menus (start /
// settings / pause / game over), high scores, saving and session recording.

const G3D = (function () {
    // ---------- loading ----------
    let threeLoading = null;
    function loadThree() {
        if (window.THREE) return Promise.resolve();
        if (threeLoading) return threeLoading;
        threeLoading = new Promise((res, rej) => {
            const s = document.createElement('script');
            s.src = 'js/vendor/three.min.js';
            s.onload = () => res();
            s.onerror = () => { threeLoading = null; rej(new Error('three.js failed to load')); };
            document.head.appendChild(s);
        });
        return threeLoading;
    }
    function webglOk() {
        try { const c = document.createElement('canvas'); return !!(window.WebGLRenderingContext && (c.getContext('webgl2') || c.getContext('webgl'))); }
        catch (e) { return false; }
    }

    // ---------- storage ----------
    function store() {
        const p = appData.progress;
        if (!p.games3d || typeof p.games3d !== 'object') p.games3d = {};
        const g = p.games3d;
        ['settings', 'scores', 'collection', 'stats'].forEach(k => { if (!g[k] || typeof g[k] !== 'object') g[k] = {}; });
        return g;
    }
    const COMMON_DEFAULTS = { difficulty: 'normal', mode: 'classic', duration: 120, quality: 'high', sound: true, music: true, volume: 70, shake: true, hint: true, lives: 3 };
    function getSettings(gameId, defaults) {
        const g = store();
        return Object.assign({}, COMMON_DEFAULTS, defaults || {}, g.settings[gameId] || {});
    }
    function saveSettings3d(gameId, cfg) { store().settings[gameId] = Object.assign({}, cfg); scheduleSaveData(); }
    function scoreKey(cfg) { return `${cfg.mode}|${cfg.difficulty}${cfg.mode === 'timed' ? '|' + cfg.duration : ''}`; }
    function getScores(gameId, cfg) { const s = store().scores; return ((s[gameId] || {})[scoreKey(cfg)] || []); }
    function addScore(gameId, cfg, entry) {
        const s = store().scores;
        s[gameId] = s[gameId] || {};
        const list = (s[gameId][scoreKey(cfg)] || []).concat([entry]).sort((a, b) => b.score - a.score).slice(0, 5);
        s[gameId][scoreKey(cfg)] = list;
        scheduleSaveData();
        return list.indexOf(entry);
    }

    // ---------- audio ----------
    const Audio3D = {
        ctx: null, master: null, sfxGain: null, musicGain: null, noise: null, musicTimer: null, cfg: null,
        init(cfg) {
            this.cfg = cfg;
            try {
                if (!this.ctx) {
                    this.ctx = new (window.AudioContext || window.webkitAudioContext)();
                    this.master = this.ctx.createGain(); this.master.connect(this.ctx.destination);
                    this.sfxGain = this.ctx.createGain(); this.sfxGain.connect(this.master);
                    this.musicGain = this.ctx.createGain(); this.musicGain.connect(this.master);
                    const len = this.ctx.sampleRate * 1.5;
                    this.noise = this.ctx.createBuffer(1, len, this.ctx.sampleRate);
                    const d = this.noise.getChannelData(0);
                    for (let i = 0; i < len; i++) d[i] = Math.random() * 2 - 1;
                }
                if (this.ctx.state === 'suspended') this.ctx.resume();
                this.apply();
            } catch (e) { this.ctx = null; }
        },
        apply() {
            if (!this.ctx) return;
            const v = (this.cfg ? this.cfg.volume : 70) / 100;
            this.master.gain.value = v;
            this.sfxGain.gain.value = (this.cfg && this.cfg.sound && appSettings.soundEnabled !== false) ? 0.9 : 0;
            this.musicGain.gain.value = (this.cfg && this.cfg.music) ? 0.35 : 0;
        },
        tone(freq, t0, dur, type, vol, dest, glideTo) {
            const c = this.ctx; if (!c) return;
            const o = c.createOscillator(), g = c.createGain();
            o.type = type || 'sine';
            o.frequency.setValueAtTime(freq, t0);
            if (glideTo) o.frequency.exponentialRampToValueAtTime(glideTo, t0 + dur);
            g.gain.setValueAtTime(0.0001, t0);
            g.gain.exponentialRampToValueAtTime(vol || 0.2, t0 + 0.008);
            g.gain.exponentialRampToValueAtTime(0.0001, t0 + dur);
            o.connect(g); g.connect(dest || this.sfxGain);
            o.start(t0); o.stop(t0 + dur + 0.05);
        },
        noiseBurst(t0, dur, vol, freq, q, dest) {
            const c = this.ctx; if (!c) return;
            const src = c.createBufferSource(); src.buffer = this.noise;
            const f = c.createBiquadFilter(); f.type = 'lowpass'; f.frequency.setValueAtTime(freq || 1200, t0); f.frequency.exponentialRampToValueAtTime(80, t0 + dur); f.Q.value = q || 0.7;
            const g = c.createGain(); g.gain.setValueAtTime(vol || 0.5, t0); g.gain.exponentialRampToValueAtTime(0.0001, t0 + dur);
            src.connect(f); f.connect(g); g.connect(dest || this.sfxGain);
            src.start(t0, Math.random() * 0.5); src.stop(t0 + dur + 0.05);
        },
        sfx(kind, p) {
            const c = this.ctx; if (!c) return;
            const t0 = c.currentTime;
            switch (kind) {
                case 'laser': this.tone(1400 + Math.random() * 200, t0, 0.12, 'sawtooth', 0.06, null, 300); break;
                case 'hit': this.noiseBurst(t0, 0.08, 0.12, 3000); break;
                case 'explode': this.noiseBurst(t0, 0.7, 0.45, 1800); this.tone(110, t0, 0.5, 'sine', 0.25, null, 40); break;
                case 'bigexplode': this.noiseBurst(t0, 1.6, 0.6, 2400); this.tone(80, t0, 1.2, 'sine', 0.35, null, 25); break;
                case 'damage': this.noiseBurst(t0, 0.5, 0.5, 900); this.tone(90, t0, 0.4, 'square', 0.12, null, 50); break;
                case 'error': this.tone(180, t0, 0.12, 'square', 0.05, null, 120); break;
                case 'power': [523, 659, 784, 1047, 1319].forEach((f, i) => this.tone(f, t0 + i * 0.05, 0.25, 'triangle', 0.08)); break;
                case 'levelup': [392, 523, 659, 784, 1047].forEach((f, i) => this.tone(f, t0 + i * 0.09, 0.4, 'triangle', 0.1)); break;
                case 'warp': this.tone(120, t0, 1.8, 'sawtooth', 0.05, null, 900); this.noiseBurst(t0, 1.6, 0.15, 5000); break;
                case 'lock': this.tone(900, t0, 0.05, 'sine', 0.05); break;
                case 'note': { // musical letter chime (Torah game): p = scale step
                    const f = p && p.freq ? p.freq : 660;
                    this.tone(f, t0, 0.5, 'triangle', 0.07); this.tone(f * 2, t0, 0.25, 'sine', 0.02); break;
                }
                case 'bell': [1, 2.01, 3.02].forEach((m, i) => this.tone(880 * m, t0, 1.4 - i * 0.3, 'sine', 0.06 / (i + 1))); break;
                case 'thud': this.noiseBurst(t0, 0.25, 0.35, 400); this.tone(70, t0, 0.2, 'sine', 0.2, null, 45); break;
                case 'whoosh': this.noiseBurst(t0, 0.45, 0.18, 4000, 2); break;
                case 'gameover': [392, 349, 311, 262].forEach((f, i) => this.tone(f, t0 + i * 0.22, 0.45, 'triangle', 0.1)); break;
                case 'boost': this.tone(220, t0, 0.9, 'sawtooth', 0.06, null, 880); this.noiseBurst(t0, 0.9, 0.2, 6000, 1.5); break;
                case 'whack': this.noiseBurst(t0, 0.12, 0.35, 2500); this.tone(520 + (p && p.pitch || 0), t0, 0.16, 'square', 0.07, null, 260); break;
                case 'pop': this.tone(700 + (p && p.pitch || 0), t0, 0.09, 'sine', 0.09, null, 1300); break;
                case 'miss': this.tone(300, t0, 0.35, 'triangle', 0.08, null, 110); break;
                case 'place': this.noiseBurst(t0, 0.18, 0.3, 700); this.tone(150, t0, 0.18, 'sine', 0.16, null, 90); break;
                case 'perfect': [784, 988, 1175, 1568].forEach((f, i) => this.tone(f + (p && p.pitch || 0), t0 + i * 0.045, 0.3, 'triangle', 0.08)); break;
                case 'crash': this.noiseBurst(t0, 0.9, 0.5, 1500); this.noiseBurst(t0 + 0.1, 0.6, 0.3, 4000); break;
                case 'skid': this.noiseBurst(t0, 0.3, 0.16, 5000, 6); break;
                case 'beep': this.tone(p && p.high ? 1320 : 660, t0, p && p.high ? 0.6 : 0.25, 'square', 0.07); break;
                case 'tick': this.tone(1800, t0, 0.03, 'square', 0.03); break;
                case 'fanfare': [523, 659, 784, 1047, 784, 1047, 1319].forEach((f, i) => this.tone(f, t0 + i * 0.12, 0.45, 'triangle', 0.1)); break;
            }
        },
        // ---- procedural music ----
        startMusic(theme) {
            this.stopMusic();
            if (!this.ctx) return;
            const c = this.ctx, self = this;
            const bpm = ({ space: 104, race: 132, arena: 120, tower: 92 })[theme] || 84, step = 60 / bpm / 2; // eighth notes
            let next = c.currentTime + 0.1, i = 0;
            const midi = n => 440 * Math.pow(2, (n - 69) / 12);
            // space: A minor progression · hall: D "Ahava Rabbah" (freygish) mode
            const space = { chords: [[57, 60, 64], [53, 57, 60], [48, 52, 55], [55, 59, 62]], bass: [45, 41, 36, 43] };
            const hallScale = [62, 63, 66, 67, 69, 70, 72, 74, 75, 78];
            const hallMotif = [0, 2, 3, 4, 3, 2, 1, 0, 4, 5, 6, 7, 6, 4, 3, 2];
            function schedule() {
                while (next < c.currentTime + 0.4) {
                    if (theme === 'race') {
                        // driving synth-rock: E minor, four-on-the-floor + octave bass
                        const prog = [[52, 55, 59], [48, 52, 55], [50, 54, 57], [47, 50, 54]];
                        const bar = Math.floor(i / 16) % 4, ch = prog[bar];
                        if (i % 4 === 0) { self.tone(55, next, 0.18, 'sine', 0.3, self.musicGain, 38); }
                        if (i % 8 === 4) self.noiseBurst(next, 0.12, 0.12, 3500, 1, self.musicGain);
                        if (i % 2 === 1) self.noiseBurst(next, 0.03, 0.04, 9000, 1, self.musicGain);
                        self.tone(midi(ch[0] - 12 + (i % 2 ? 12 : 0)), next, step * 0.8, 'sawtooth', 0.05, self.musicGain);
                        if (i % 16 === 0) ch.forEach(n => self.pad(midi(n + 12), next, step * 16, 0.025));
                        if ([0, 3, 6, 10, 12].includes(i % 16)) self.tone(midi(ch[(i >> 2) % 3] + 24), next, step * 1.4, 'square', 0.022, self.musicGain);
                    } else if (theme === 'arena') {
                        // bouncy major-key arcade loop
                        const prog = [[60, 64, 67], [57, 60, 64], [53, 57, 60], [55, 59, 62]];
                        const bar = Math.floor(i / 8) % 4, ch = prog[bar];
                        if (i % 2 === 0) self.tone(midi(ch[0] - 24 + (i % 4 ? 7 : 0)), next, step * 1.6, 'triangle', 0.16, self.musicGain);
                        if (i % 4 === 2) self.noiseBurst(next, 0.05, 0.06, 7000, 1, self.musicGain);
                        const mel = [0, 1, 2, 1, 2, 0, 1, 2];
                        if (Math.random() > 0.2) self.tone(midi(ch[mel[i % 8]] + 12), next, step * 0.7, 'square', 0.028, self.musicGain);
                    } else if (theme === 'tower') {
                        // calm, airy: D major pentatonic plucks over soft pads
                        const pent = [62, 64, 66, 69, 71, 74, 76, 78];
                        if (i % 16 === 0) { self.pad(midi(50), next, step * 16, 0.04); self.pad(midi(57), next, step * 16, 0.03); self.pad(midi(66), next, step * 16, 0.02); }
                        if (i % 2 === 0 && Math.random() > 0.3) self.pluck(midi(pent[Math.floor(Math.random() * pent.length)]), next, 0.06);
                        if (i % 8 === 0) self.tone(midi(38), next, step * 6, 'sine', 0.12, self.musicGain);
                    } else if (theme === 'space') {
                        const bar = Math.floor(i / 16) % 4, ch = space.chords[bar];
                        if (i % 16 === 0) ch.forEach(n => self.pad(midi(n), next, step * 16));
                        if (i % 4 === 0) self.tone(midi(space.bass[bar]), next, step * 3, 'triangle', 0.18, self.musicGain);
                        const arp = ch[(i % 3)] + (i % 8 >= 4 ? 12 : 0);
                        self.tone(midi(arp + 12), next, step * 0.9, 'square', 0.025, self.musicGain);
                        if (i % 8 === 4) self.noiseBurst(next, 0.06, 0.05, 6000, 1, self.musicGain);
                    } else {
                        if (i % 12 === 0) { self.pad(midi(50), next, step * 12, 0.05); self.pad(midi(57), next, step * 12, 0.04); }
                        if (i % 2 === 0) {
                            const n = hallScale[hallMotif[(i / 2) % hallMotif.length]];
                            if (Math.random() > 0.12) self.pluck(midi(n), next);
                        }
                        if (i % 6 === 3 && Math.random() > 0.5) self.pluck(midi(hallScale[Math.floor(Math.random() * 5)] - 12), next, 0.05);
                    }
                    next += step; i++;
                }
            }
            schedule();
            this.musicTimer = setInterval(schedule, 120);
        },
        pad(f, t0, dur, vol) {
            const c = this.ctx; if (!c) return;
            const o = c.createOscillator(), o2 = c.createOscillator(), flt = c.createBiquadFilter(), g = c.createGain();
            o.type = 'sawtooth'; o2.type = 'sawtooth'; o.frequency.value = f; o2.frequency.value = f * 1.004;
            flt.type = 'lowpass'; flt.frequency.value = 900;
            g.gain.setValueAtTime(0.0001, t0); g.gain.linearRampToValueAtTime(vol || 0.03, t0 + dur * 0.3); g.gain.linearRampToValueAtTime(0.0001, t0 + dur);
            o.connect(flt); o2.connect(flt); flt.connect(g); g.connect(this.musicGain);
            o.start(t0); o2.start(t0); o.stop(t0 + dur + 0.1); o2.stop(t0 + dur + 0.1);
        },
        pluck(f, t0, vol) {
            this.tone(f, t0, 1.2, 'triangle', vol || 0.09, this.musicGain);
            this.tone(f * 2, t0, 0.4, 'sine', (vol || 0.09) * 0.25, this.musicGain);
        },
        stopMusic() { if (this.musicTimer) { clearInterval(this.musicTimer); this.musicTimer = null; } }
    };

    // ---------- text labels ----------
    const FONT = "'David', 'Arial Hebrew', 'Segoe UI', 'Noto Sans Hebrew', sans-serif";
    function isRtl(s) { return /[א-ת]/.test(s); }
    // Renders a word onto a canvas; the typed prefix is drawn in a highlight colour.
    function drawWord(ctx, text, typed, o) {
        const w = ctx.canvas.width, h = ctx.canvas.height;
        ctx.clearRect(0, 0, w, h);
        if (o.bg) {
            const r = h * 0.28;
            ctx.fillStyle = o.bg;
            ctx.beginPath();
            ctx.moveTo(r, 4); ctx.lineTo(w - r, 4); ctx.quadraticCurveTo(w - 4, 4, w - 4, r); ctx.lineTo(w - 4, h - r); ctx.quadraticCurveTo(w - 4, h - 4, w - r, h - 4);
            ctx.lineTo(r, h - 4); ctx.quadraticCurveTo(4, h - 4, 4, h - r); ctx.lineTo(4, r); ctx.quadraticCurveTo(4, 4, r, 4); ctx.closePath(); ctx.fill();
            if (o.border) { ctx.lineWidth = 4; ctx.strokeStyle = o.border; ctx.stroke(); }
        }
        ctx.font = `bold ${o.px}px ${FONT}`;
        ctx.textBaseline = 'middle';
        ctx.textAlign = 'center';
        const rtl = isRtl(text);
        try { ctx.direction = rtl ? 'rtl' : 'ltr'; } catch (e) {}
        const cx = w / 2, cy = h / 2 + o.px * 0.04;
        if (o.shadow) { ctx.shadowColor = o.shadow; ctx.shadowBlur = 12; }
        ctx.fillStyle = o.color;
        ctx.fillText(text, cx, cy);
        ctx.shadowBlur = 0;
        if (typed > 0) {
            const chars = Array.from(text);
            const full = ctx.measureText(text).width, pre = ctx.measureText(chars.slice(0, typed).join('')).width;
            ctx.save();
            ctx.beginPath();
            if (rtl) ctx.rect(cx + full / 2 - pre - 2, 0, pre + 6, h); else ctx.rect(cx - full / 2 - 4, 0, pre + 6, h);
            ctx.clip();
            ctx.clearRect(0, 0, w, h);
            if (o.bg) { ctx.fillStyle = o.bgTyped || o.bg; ctx.fillRect(0, 0, w, h); }
            ctx.shadowColor = o.typedGlow || o.typedColor; ctx.shadowBlur = 18;
            ctx.fillStyle = o.typedColor;
            ctx.fillText(text, cx, cy);
            ctx.restore();
        }
    }
    function makeLabel(text, opts) {
        const T = window.THREE;
        const o = Object.assign({ px: 64, color: '#ffffff', typedColor: '#5cf2a0', bg: 'rgba(8,14,32,0.72)', border: 'rgba(120,180,255,0.6)', height: 0.9, shadow: 'rgba(0,0,0,0.7)' }, opts || {});
        const canvas = document.createElement('canvas');
        const mctx = canvas.getContext('2d');
        mctx.font = `bold ${o.px}px ${FONT}`;
        const tw = Math.ceil(mctx.measureText(text).width);
        canvas.width = Math.min(2048, Math.max(o.px * 1.6, tw + o.px * 0.9));
        canvas.height = Math.ceil(o.px * 1.45);
        const ctx = canvas.getContext('2d');
        drawWord(ctx, text, 0, o);
        const tex = new T.CanvasTexture(canvas);
        tex.anisotropy = 4;
        if (T.sRGBEncoding) tex.encoding = T.sRGBEncoding;
        const mat = new T.SpriteMaterial({ map: tex, transparent: true, depthTest: o.depthTest !== false, depthWrite: false });
        const sprite = new T.Sprite(mat);
        const aspect = canvas.width / canvas.height;
        sprite.scale.set(o.height * aspect, o.height, 1);
        sprite.renderOrder = 10;
        return {
            sprite, canvas, aspect,
            setTyped(n) { drawWord(ctx, text, n, o); tex.needsUpdate = true; },
            setColors(c) { Object.assign(o, c); drawWord(ctx, text, 0, o); tex.needsUpdate = true; },
            dispose() { tex.dispose(); mat.dispose(); }
        };
    }
    // Generic canvas texture helper (for procedural textures)
    function canvasTexture(w, h, draw, repeat) {
        const T = window.THREE;
        const c = document.createElement('canvas'); c.width = w; c.height = h;
        draw(c.getContext('2d'), w, h);
        const tex = new T.CanvasTexture(c);
        if (repeat) { tex.wrapS = tex.wrapT = T.RepeatWrapping; tex.repeat.set(repeat[0], repeat[1]); }
        if (T.sRGBEncoding) tex.encoding = T.sRGBEncoding;
        tex.anisotropy = 4;
        return tex;
    }
    function glowTexture(inner, outer) {
        return canvasTexture(128, 128, (ctx, w, h) => {
            const g = ctx.createRadialGradient(w / 2, h / 2, 0, w / 2, h / 2, w / 2);
            g.addColorStop(0, inner || 'rgba(255,255,255,1)');
            g.addColorStop(0.25, outer || 'rgba(255,200,120,0.6)');
            g.addColorStop(1, 'rgba(0,0,0,0)');
            ctx.fillStyle = g; ctx.fillRect(0, 0, w, h);
        });
    }

    // ---------- GPU particles ----------
    function Particles(scene, max) {
        const T = window.THREE;
        this.max = max;
        this.pos = new Float32Array(max * 3); this.col = new Float32Array(max * 3); this.size = new Float32Array(max); this.alpha = new Float32Array(max);
        this.vel = new Float32Array(max * 3); this.life = new Float32Array(max); this.maxLife = new Float32Array(max); this.grav = new Float32Array(max); this.drag = new Float32Array(max); this.size0 = new Float32Array(max);
        this.next = 0;
        const geo = new T.BufferGeometry();
        geo.setAttribute('position', new T.BufferAttribute(this.pos, 3));
        geo.setAttribute('pcolor', new T.BufferAttribute(this.col, 3));
        geo.setAttribute('psize', new T.BufferAttribute(this.size, 1));
        geo.setAttribute('palpha', new T.BufferAttribute(this.alpha, 1));
        const mat = new T.ShaderMaterial({
            uniforms: { scale: { value: window.innerHeight / 2 } },
            vertexShader: `attribute vec3 pcolor; attribute float psize; attribute float palpha; uniform float scale; varying vec3 vC; varying float vA;
                void main(){ vC=pcolor; vA=palpha; vec4 mv=modelViewMatrix*vec4(position,1.0); gl_PointSize=psize*scale/max(0.1,-mv.z); gl_Position=projectionMatrix*mv; }`,
            fragmentShader: `varying vec3 vC; varying float vA; void main(){ float d=length(gl_PointCoord-vec2(0.5)); float a=smoothstep(0.5,0.0,d); if(vA<=0.001) discard; gl_FragColor=vec4(vC*(0.6+a*0.8), a*vA); }`,
            transparent: true, depthWrite: false, blending: T.AdditiveBlending
        });
        this.points = new T.Points(geo, mat);
        this.points.frustumCulled = false;
        this.points.renderOrder = 20;
        scene.add(this.points);
        this.geo = geo; this.mat = mat;
    }
    Particles.prototype.emit = function (p, n, o) {
        o = o || {};
        const T = window.THREE, c = new T.Color(o.color || 0xffaa44), c2 = o.color2 ? new T.Color(o.color2) : null;
        for (let k = 0; k < n; k++) {
            const i = this.next; this.next = (this.next + 1) % this.max;
            const sp = (o.speed || 6) * (0.3 + Math.random() * 0.7);
            let dx = Math.random() * 2 - 1, dy = Math.random() * 2 - 1, dz = Math.random() * 2 - 1;
            if (o.dir) { dx = o.dir.x + dx * (o.spread || 0.3); dy = o.dir.y + dy * (o.spread || 0.3); dz = o.dir.z + dz * (o.spread || 0.3); }
            const l = Math.hypot(dx, dy, dz) || 1;
            this.pos[i * 3] = p.x + (o.jitter ? (Math.random() - 0.5) * o.jitter : 0);
            this.pos[i * 3 + 1] = p.y + (o.jitter ? (Math.random() - 0.5) * o.jitter : 0);
            this.pos[i * 3 + 2] = p.z + (o.jitter ? (Math.random() - 0.5) * o.jitter : 0);
            this.vel[i * 3] = dx / l * sp; this.vel[i * 3 + 1] = dy / l * sp + (o.up || 0); this.vel[i * 3 + 2] = dz / l * sp;
            const cc = c2 && Math.random() < 0.5 ? c2 : c;
            this.col[i * 3] = cc.r; this.col[i * 3 + 1] = cc.g; this.col[i * 3 + 2] = cc.b;
            this.size0[i] = (o.size || 0.5) * (0.5 + Math.random());
            this.maxLife[i] = this.life[i] = (o.life || 1) * (0.6 + Math.random() * 0.6);
            this.grav[i] = o.gravity || 0; this.drag[i] = o.drag != null ? o.drag : 1.5;
        }
    };
    Particles.prototype.update = function (dt) {
        for (let i = 0; i < this.max; i++) {
            if (this.life[i] <= 0) { this.alpha[i] = 0; continue; }
            this.life[i] -= dt;
            const k = Math.max(0, 1 - this.drag[i] * dt);
            this.vel[i * 3] *= k; this.vel[i * 3 + 1] = this.vel[i * 3 + 1] * k - this.grav[i] * dt; this.vel[i * 3 + 2] *= k;
            this.pos[i * 3] += this.vel[i * 3] * dt; this.pos[i * 3 + 1] += this.vel[i * 3 + 1] * dt; this.pos[i * 3 + 2] += this.vel[i * 3 + 2] * dt;
            const f = Math.max(0, this.life[i] / this.maxLife[i]);
            this.alpha[i] = f; this.size[i] = this.size0[i] * (0.4 + f * 0.6);
        }
        this.geo.attributes.position.needsUpdate = true; this.geo.attributes.palpha.needsUpdate = true; this.geo.attributes.psize.needsUpdate = true; this.geo.attributes.pcolor.needsUpdate = true;
    };

    function disposeScene(scene) {
        scene.traverse(o => {
            if (o.geometry) o.geometry.dispose();
            if (o.material) {
                (Array.isArray(o.material) ? o.material : [o.material]).forEach(m => {
                    Object.keys(m).forEach(k => { if (m[k] && m[k].isTexture) m[k].dispose(); });
                    m.dispose();
                });
            }
        });
    }

    // ---------- the game shell ----------
    let active = null;
    function stop() {
        if (typeof Speech !== 'undefined') Speech.stop();
        if (!active) return;
        const a = active; active = null;
        a.alive = false;
        cancelAnimationFrame(a.raf);
        document.removeEventListener('keydown', a.onKey, true);
        document.removeEventListener('visibilitychange', a.onVis);
        window.removeEventListener('resize', a.onResize);
        Audio3D.stopMusic();
        try { if (a.game && a.game.dispose) a.game.dispose(); } catch (e) {}
        try { disposeScene(a.scene); a.renderer.dispose(); if (a.renderer.forceContextLoss) a.renderer.forceContextLoss(); } catch (e) {}
    }

    const DIFF = { easy: { speed: 0.7, spawn: 1.4, max: 3 }, normal: { speed: 1, spawn: 1, max: 4 }, hard: { speed: 1.35, spawn: 0.78, max: 6 }, expert: { speed: 1.75, spawn: 0.6, max: 8 } };

    function commonOptions() {
        return [
            { key: 'mode', label: t('מצב משחק', 'Game mode'), choices: [['classic', t('קלאסי — חיים', 'Classic — lives')], ['timed', t('נגד השעון', 'Against the clock')], ['zen', t('זן — בלי לפסול', 'Zen — no game over')]] },
            { key: 'duration', label: t('משך (נגד השעון)', 'Duration (timed)'), choices: [[60, t('דקה', '1 min')], [120, t('2 דקות', '2 min')], [180, t('3 דקות', '3 min')], [300, t('5 דקות', '5 min')], [600, t('10 דקות', '10 min')]] },
            { key: 'difficulty', label: t('רמת קושי', 'Difficulty'), choices: [['easy', t('קל', 'Easy')], ['normal', t('רגיל', 'Normal')], ['hard', t('קשה', 'Hard')], ['expert', t('מומחה', 'Expert')]] },
            { key: 'lives', label: t('חיים בהתחלה', 'Starting lives'), choices: [[3, '3'], [5, '5'], [7, '7']] },
            { key: 'quality', label: t('איכות גרפיקה', 'Graphics quality'), choices: [['low', t('נמוכה (מחשב חלש)', 'Low (older PC)')], ['medium', t('בינונית', 'Medium')], ['high', t('גבוהה', 'High')]] },
            { key: 'hint', label: t('הצג את המקש הבא', 'Show the next key'), toggle: true },
            { key: 'shake', label: t('רעידות מצלמה', 'Camera shake'), toggle: true },
            { key: 'sound', label: t('אפקטים קוליים', 'Sound effects'), toggle: true },
            { key: 'music', label: t('מוזיקה', 'Music'), toggle: true },
            { key: 'volume', label: t('עוצמה', 'Volume'), range: [0, 100] }
        ];
    }
    function optionHtml(o, cfg) {
        const id = 'g3o_' + o.key;
        if (o.toggle) return `<label class="g3-opt g3-toggle"><input type="checkbox" id="${id}" ${cfg[o.key] ? 'checked' : ''}><span>${o.label}</span></label>`;
        if (o.range) return `<label class="g3-opt"><span>${o.label}</span><input type="range" id="${id}" min="${o.range[0]}" max="${o.range[1]}" value="${cfg[o.key]}"></label>`;
        return `<label class="g3-opt"><span>${o.label}</span><select id="${id}">${o.choices.map(([v, l]) => `<option value="${v}" ${String(cfg[o.key]) === String(v) ? 'selected' : ''}>${l}</option>`).join('')}</select></label>`;
    }
    function readOption(root, o, cfg) {
        const el = root.querySelector('#g3o_' + o.key);
        if (!el) return;
        if (o.toggle) cfg[o.key] = el.checked;
        else if (o.range) cfg[o.key] = Number(el.value);
        else { const v = el.value; cfg[o.key] = (typeof o.choices[0][0] === 'number') ? Number(v) : v; }
    }

    // Start / settings menu for a game definition
    function openMenu(container, def) {
        stop();
        const cfg = getSettings(def.id, def.defaults);
        const opts = (def.options ? def.options() : []).concat(commonOptions().filter(o => !(def.hideCommon || []).includes(o.key)));
        const scores = getScores(def.id, cfg);
        const extra = def.menuExtra ? def.menuExtra(cfg) : '';
        container.innerHTML = `
            <div class="g3-menu ${def.theme || ''}">
                <div class="g3-menu-hero">
                    <button class="btn-back" id="g3Back">‹ ${t('למשחקים', 'Back to games')}</button>
                    <div class="g3-menu-icon">${def.icon}</div>
                    <h2>${def.title()}</h2>
                    <p>${def.desc()}</p>
                    <button class="btn primary big g3-play" id="g3Play">▶ ${t('שחק', 'Play')}</button>
                    ${def.trains ? `<div class="g3-trains">🎯 ${def.trains()}</div>` : ''}
                    <div class="g3-keys">${def.keysHelp ? def.keysHelp() : t('במשחק: הקלידו את המילים · Esc = השהיה · Backspace = ביטול נעילה', 'In game: type the words · Esc = pause · Backspace = release target')}</div>
                </div>
                ${extra}
                <div class="g3-menu-grid">
                    <div class="g3-panel"><h3>⚙️ ${t('הגדרות', 'Settings')}</h3><div class="g3-opts">${opts.map(o => optionHtml(o, cfg)).join('')}</div></div>
                    <div class="g3-panel"><h3>🏆 ${t('שיאים', 'High scores')} <small>(${t('למצב ולרמה שנבחרו', 'for the selected mode & difficulty')})</small></h3>
                        <div id="g3Scores">${scoresHtml(scores)}</div></div>
                </div>
            </div>`;
        const readAll = () => { opts.forEach(o => readOption(container, o, cfg)); saveSettings3d(def.id, cfg); };
        container.querySelectorAll('.g3-opts select, .g3-opts input').forEach(el => el.addEventListener('change', () => { readAll(); container.querySelector('#g3Scores').innerHTML = scoresHtml(getScores(def.id, cfg)); if (def.onMenuChange) def.onMenuChange(container, cfg); }));
        if (def.bindMenuExtra) def.bindMenuExtra(container, cfg, () => saveSettings3d(def.id, cfg));
        container.querySelector('#g3Back').addEventListener('click', () => { stop(); renderGamesScreen(container); });
        container.querySelector('#g3Play').addEventListener('click', () => { readAll(); play(container, def, cfg); });
    }
    function scoresHtml(list) {
        if (!list.length) return `<p class="empty-note">${t('עוד אין שיאים — היו הראשונים!', 'No scores yet — be the first!')}</p>`;
        return `<table class="data-table"><tr><th>#</th><th>${t('נקודות', 'Score')}</th><th>${t('שלב', 'Level')}</th><th>${t('מ״לד', 'WPM')}</th><th>${t('תאריך', 'Date')}</th></tr>${list.map((s, i) => `<tr><td>${['🥇', '🥈', '🥉', '4', '5'][i]}</td><td><b>${s.score.toLocaleString()}</b></td><td>${s.level}</td><td>${s.wpm}</td><td>${new Date(s.at).toLocaleDateString(uiLocale())}</td></tr>`).join('')}</table>`;
    }

    // End-of-game report: the keys that were slowest / most missed in THIS game,
    // with a one-click focused drill on them (the "useful" part of playing).
    function weakFromLog(log) {
        const rows = Object.entries(log).filter(([ch, k]) => k.n >= 2 && ch.trim()).map(([ch, k]) => ({ ch, n: k.n, acc: k.ok / k.n, ms: k.msN ? k.ms / k.msN : null }));
        if (!rows.length) return [];
        const msVals = rows.filter(r => r.ms).map(r => r.ms).sort((a, b) => a - b);
        const med = msVals.length ? msVals[Math.floor(msVals.length / 2)] : 0;
        rows.forEach(r => { r.bad = (1 - r.acc) * 3 + (r.ms && med ? Math.max(0, r.ms / med - 1) : 0); });
        return rows.filter(r => r.bad > 0.15).sort((a, b) => b.bad - a.bad).slice(0, 6);
    }
    function keyReportHtml(S) {
        const weak = weakFromLog(S.keyLog || {});
        if (!weak.length) return '';
        return `<div class="g3-keyreport"><div class="g3-kr-title">🔎 ${t('האותיות שהאטו אתכם במשחק הזה', 'Keys that slowed you down this game')}</div>
            <div class="g3-kr-keys">${weak.map(r => `<span class="g3-kr-key" title="${Math.round(r.acc * 100)}%"><b>${r.ch}</b><small>${Math.round(r.acc * 100)}%${r.ms ? ' · ' + (r.ms / 1000).toFixed(2) + t('ש׳', 's') : ''}</small></span>`).join('')}</div>
            <button class="btn" id="g3Drill" data-keys='${JSON.stringify(weak.map(r => r.ch)).replace(/'/g, '&#39;')}'>🎯 ${t('תרגול ממוקד על האותיות האלה (2 דק׳)', 'Focused drill on these keys (2 min)')}</button></div>`;
    }
    function startGameDrill(weak, container, def) {
        const known = new Set(Array.from(getKnownKeys()));
        weak.forEach(c => known.add(c));
        const text = generateCharDrill(known, 140, weak.concat(weak));
        const back = () => { navigateTo('gamesScreen', { silent: true }); openMenu(document.getElementById('gamesScreen'), def); };
        showScreen('practiceScreen');
        startPracticeRun({ text, mode: 'lesson', title: t('תרגול ממוקד מהמשחק', 'Focused drill from the game'), durationLimitMs: 120000,
            onExit: back,
            onFinish: m => showResultsScreen(m, { onContinue: back, onRetry: () => startGameDrill(weak, container, def) }) });
    }

    function play(container, def, cfg) {
        stop();
        if (typeof isDailyLimitReached === 'function' && isDailyLimitReached()) { showDailyLimitOverlay(); return; }
        if (!webglOk()) {
            container.innerHTML = `<div class="hero-card"><h3>${t('התצוגה התלת־ממדית אינה זמינה במחשב הזה', '3D graphics are not available on this computer')}</h3><p>${t('הדפדפן המובנה לא תומך ב-WebGL. אפשר לשחק במשחקי ה-2D (גשם אותיות / מטר מילים).', 'The built-in browser does not support WebGL. You can still play the 2D games (Letter Rain / Word Rain).')}</p><button class="btn" id="g3Back2">${t('למשחקים', 'Back to games')}</button></div>`;
            container.querySelector('#g3Back2').onclick = () => renderGamesScreen(container);
            return;
        }
        container.innerHTML = `<div class="g3-loading">${def.icon} ${t('טוען…', 'Loading…')}</div>`;
        loadThree().then(() => start(container, def, cfg)).catch(() => {
            container.innerHTML = `<div class="hero-card"><p>${t('טעינת מנוע התלת־ממד נכשלה.', 'Could not load the 3D engine.')}</p><button class="btn" id="g3Back3">${t('למשחקים', 'Back to games')}</button></div>`;
            container.querySelector('#g3Back3').onclick = () => renderGamesScreen(container);
        });
    }

    function start(container, def, cfg) {
        const T = window.THREE;
        const Q = { low: { pr: 1, aa: false, part: 0.45, shadows: false, mult: 0.5 }, medium: { pr: 1.5, aa: true, part: 0.75, shadows: false, mult: 0.8 }, high: { pr: 2, aa: true, part: 1, shadows: true, mult: 1 } }[cfg.quality] || { pr: 1.5, aa: true, part: 0.75, shadows: false, mult: 0.8 };
        container.innerHTML = `
            <div class="g3-stage ${def.theme || ''}" dir="ltr">
                <canvas class="g3-canvas"></canvas>
                <div class="g3-hud">
                    <div class="g3-hud-left"><div class="g3-score">0</div><div class="g3-mult"></div><div class="g3-power"></div></div>
                    <div class="g3-hud-center"><div class="g3-level"></div><div class="g3-lvlbar"><span></span></div><div class="g3-extra"></div></div>
                    <div class="g3-hud-right"><div class="g3-lives"></div><div class="g3-timer"></div><button class="g3-btn" id="g3Pause" title="Esc">⏸</button></div>
                </div>
                <div class="g3-bottom"><span class="g3-typed" dir="auto"></span><span class="g3-hint"></span><span class="g3-live"></span></div>
                <div class="g3-banner"></div>
                <div class="g3-popups"></div>
                <div class="g3-flash"></div>
                <div class="g3-overlay" style="display:none"></div>
            </div>`;
        const stage = container.querySelector('.g3-stage');
        const canvas = stage.querySelector('.g3-canvas');
        const renderer = new T.WebGLRenderer({ canvas, antialias: Q.aa, powerPreference: 'high-performance' });
        renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, Q.pr));
        if (T.sRGBEncoding) renderer.outputEncoding = T.sRGBEncoding;
        renderer.toneMapping = T.ACESFilmicToneMapping;
        renderer.toneMappingExposure = 1.1;
        renderer.shadowMap.enabled = Q.shadows;
        renderer.shadowMap.type = T.PCFSoftShadowMap;
        const scene = new T.Scene();
        const camera = new T.PerspectiveCamera(60, 1, 0.1, 1200);
        const particles = new Particles(scene, Math.round(4000 * Q.part));
        Audio3D.init(cfg);

        const S = active = {
            alive: true, paused: false, over: false, raf: 0, scene, renderer, camera, stage, game: null,
            score: 0, combo: 0, maxCombo: 0, mult: 1, lives: cfg.lives, level: 1, levelProg: 0,
            correct: 0, wrong: 0, words: 0, time: 0, playTime: 0, timeLeft: (cfg.mode === 'timed' && !(def.hideCommon || []).includes('duration')) ? cfg.duration : null, keyLog: {},
            shakeAmt: 0, timeScale: 1, camBase: new T.Vector3(), powers: {}
        };
        const D = DIFF[cfg.difficulty] || DIFF.normal;
        // Seconds of actual typing used for WPM (a game can exclude countdowns etc.)
        const activeSecs = () => { try { if (S.game && S.game.activeTime) return Math.max(0.5, S.game.activeTime()); } catch (e) {} return S.playTime; };
        const $ = sel => stage.querySelector(sel);

        function resize() {
            const w = stage.clientWidth || 800, h = stage.clientHeight || 500;
            renderer.setSize(w, h, false);
            camera.aspect = w / h; camera.updateProjectionMatrix();
            particles.mat.uniforms.scale.value = h / 2 * renderer.getPixelRatio() / (Math.tan(camera.fov * Math.PI / 360) * 2) * 0.9;
        }
        S.onResize = resize;
        window.addEventListener('resize', resize);

        // ---- HUD helpers ----
        const hud = {
            update() {
                $('.g3-score').textContent = S.score.toLocaleString();
                $('.g3-mult').textContent = S.mult > 1 ? `×${S.mult}` : '';
                $('.g3-mult').classList.toggle('hot', S.mult >= 4);
                $('.g3-level').textContent = def.hudLevel ? def.hudLevel(S) : `${t('שלב', 'Level')} ${S.level}`;
                $('.g3-lvlbar span').style.width = Math.round(Math.min(1, S.levelProg) * 100) + '%';
                if (def.hudLives) $('.g3-lives').innerHTML = def.hudLives(S);
                else if (cfg.mode === 'zen') $('.g3-lives').textContent = '∞';
                else $('.g3-lives').innerHTML = (def.lifeIcon || '❤️').repeat(Math.max(0, S.lives)) + `<span class="dim">${(def.lifeIconOff || '🤍').repeat(Math.max(0, Math.min(10, cfg.lives) - S.lives))}</span>`;
                $('.g3-timer').textContent = S.timeLeft !== null ? formatDuration(S.timeLeft * 1000) : '';
                const elapsedMin = Math.max(activeSecs() / 60, 1 / 60);
                const total = S.correct + S.wrong;
                $('.g3-live').textContent = `${Math.round(S.correct / 5 / elapsedMin)} ${t('מ״לד', 'WPM')} · ${total ? Math.round(S.correct / total * 100) : 100}%`;
                $('.g3-power').innerHTML = Object.entries(S.powers).filter(([, v]) => v.left > 0).map(([k, v]) => `<span class="g3-pw">${v.icon} ${Math.ceil(v.left)}</span>`).join('');
            },
            typed(text) { $('.g3-typed').textContent = text || ''; },
            hint(ch, key) {
                if (typeof Speech !== 'undefined' && ch) Speech.speakNext(ch, { key: key || ch });
                if (!cfg.hint || !ch) { $('.g3-hint').textContent = ''; return; }
                const r = resolveKeyForChar(ch);
                const finger = r ? fingerName(KEY_TO_FINGER[r.code]) : '';
                const latin = r && ENGLISH_LAYOUT[r.code] ? ENGLISH_LAYOUT[r.code].toUpperCase() : '';
                $('.g3-hint').innerHTML = `${t('הבא', 'Next')}: <b>${ch === ' ' ? '␣' : ch}</b>${latin && latin !== ch.toUpperCase() ? ` <small>(${latin})</small>` : ''}${finger ? ` · ${finger}` : ''}`;
            },
            extra(html) { $('.g3-extra').innerHTML = html || ''; }
        };
        function banner(text, sub, cls, ms) {
            const b = $('.g3-banner');
            b.className = 'g3-banner show ' + (cls || '');
            b.innerHTML = `<div class="g3-banner-main">${text}</div>${sub ? `<div class="g3-banner-sub">${sub}</div>` : ''}`;
            clearTimeout(S.bannerT);
            S.bannerT = setTimeout(() => { b.className = 'g3-banner'; }, ms || 2200);
        }
        const tmpV = new T.Vector3();
        function popup(text, worldPos, cls) {
            tmpV.copy(worldPos).project(camera);
            const w = stage.clientWidth, h = stage.clientHeight;
            const el = document.createElement('div');
            el.className = 'g3-pop ' + (cls || '');
            el.textContent = text;
            el.style.left = ((tmpV.x + 1) / 2 * w) + 'px';
            el.style.top = ((1 - tmpV.y) / 2 * h) + 'px';
            $('.g3-popups').appendChild(el);
            setTimeout(() => el.remove(), 1200);
        }
        function flash(color) {
            const f = $('.g3-flash'); f.style.background = color || 'rgba(255,40,40,0.35)';
            f.classList.remove('on'); void f.offsetWidth; f.classList.add('on');
        }

        // ---- API given to the game ----
        const api = {
            THREE: T, scene, camera, renderer, particles, audio: Audio3D, cfg, D, Q, hud, banner, popup, flash, stage,
            get time() { return S.playTime; }, get score() { return S.score; }, get lives() { return S.lives; },
            // Feeds a keystroke into the learner model (same stats as the lessons use),
            // so time in the games also improves the adaptive drills and heat map.
            track(expected, typed, dt) {
                if (!expected || expected === ' ') return;
                const ok = typed === expected;
                try { recordCharResult(expected, ok, dt || 0); if (!ok && typed) recordErrorPair(expected, typed); } catch (e) {}
                const k = S.keyLog[expected] || (S.keyLog[expected] = { n: 0, ok: 0, ms: 0, msN: 0 });
                k.n++; if (ok) k.ok++;
                if (ok && dt && dt < 4000) { k.ms += dt; k.msN++; }
            },
            get level() { return S.level; }, get combo() { return S.combo; }, get mult() { return S.mult; },
            get timeScale() { return S.timeScale; }, set timeScale(v) { S.timeScale = v; },
            shake(a) { if (cfg.shake) S.shakeAmt = Math.min(1.2, S.shakeAmt + a); },
            setCameraBase(v) { S.camBase.copy(v); camera.position.copy(v); },
            keyOk() { S.correct++; },
            keyBad() { S.wrong++; S.combo = 0; S.mult = 1; Audio3D.sfx('error'); hud.update(); },
            wordDone(base, pos, opts) {
                S.words++; S.combo++; S.maxCombo = Math.max(S.maxCombo, S.combo);
                S.mult = Math.min(8, 1 + Math.floor(S.combo / 5));
                const dbl = S.powers.double && S.powers.double.left > 0 ? 2 : 1;
                const pts = Math.round(base * S.level * S.mult * dbl);
                S.score += pts;
                if (pos) popup('+' + pts.toLocaleString(), pos, (opts && opts.cls) || (S.mult >= 4 ? 'hot' : ''));
                if (S.combo > 0 && S.combo % 10 === 0) banner(`🔥 ${S.combo} ${t('ברצף!', 'combo!')}`, '', 'small', 1200);
                hud.update();
                return pts;
            },
            addScore(n) { S.score += Math.round(n); hud.update(); },
            setLevelProgress(p) { S.levelProg = p; hud.update(); },
            levelUp(sub) {
                S.level++; S.levelProg = 0;
                Audio3D.sfx('levelup');
                banner(`${t('שלב', 'Level')} ${S.level}`, sub || '', 'level', 2400);
                hud.update();
            },
            damage(n) {
                if (cfg.mode === 'zen' || S.over) { S.combo = 0; S.mult = 1; hud.update(); return false; }
                S.lives -= (n || 1); S.combo = 0; S.mult = 1;
                flash(); Audio3D.sfx('damage');
                hud.update();
                if (S.lives <= 0 && cfg.mode === 'classic') { S.dying = true; setTimeout(() => endGame(false), 900); return true; }
                if (S.lives <= 0) S.lives = 0;
                return false;
            },
            heal(n) { S.lives = Math.min(S.lives + (n || 1), Math.max(cfg.lives, 9)); hud.update(); },
            power(name, icon, seconds) { S.powers[name] = { icon, left: seconds }; hud.update(); },
            powerLeft(name) { return S.powers[name] ? S.powers[name].left : 0; },
            end(win, delay) { if (delay) { S.dying = true; setTimeout(() => endGame(!!win), delay); } else endGame(!!win); },
            isDying() { return !!S.dying; },
            isOver() { return S.over; }
        };

        // ---- input ----
        S.onKey = (e) => {
            if (!S.alive) return;
            if (!document.body.contains(stage) || stage.offsetParent === null) return;
            if (e.key === 'Escape') { e.preventDefault(); if (S.over) return; togglePause(); return; }
            if (S.paused || S.over) {
                if (S.paused && (e.code === 'KeyQ')) { e.preventDefault(); quit(); }
                return;
            }
            if (e.ctrlKey || e.metaKey || (e.altKey && !e.ctrlKey)) return;
            if (e.key === 'Backspace') { e.preventDefault(); if (S.game.onBackspace) S.game.onBackspace(); return; }
            if (e.key === 'Tab' || e.key === 'Enter') { e.preventDefault(); return; }
            if (e.repeat) { e.preventDefault(); return; }
            const expected = S.game.expected ? S.game.expected() : '';
            const ch = resolveTypedChar(e, expected || '');
            if (ch === null) return;
            e.preventDefault();
            S.game.onChar(ch);
        };
        document.addEventListener('keydown', S.onKey, true);
        S.onVis = () => { if (document.visibilityState === 'hidden' && !S.paused && !S.over) togglePause(); };
        document.addEventListener('visibilitychange', S.onVis);
        $('#g3Pause').addEventListener('click', () => togglePause());

        function togglePause() {
            S.paused = !S.paused;
            const ov = $('.g3-overlay');
            if (S.paused) {
                Audio3D.stopMusic();
                ov.style.display = '';
                ov.innerHTML = `<div class="g3-box"><h2>⏸ ${t('מושהה', 'Paused')}</h2>
                    <div class="g3-opts compact">${optionHtml({ key: 'music', label: t('מוזיקה', 'Music'), toggle: true }, cfg)}${optionHtml({ key: 'sound', label: t('אפקטים', 'Sound effects'), toggle: true }, cfg)}${optionHtml({ key: 'hint', label: t('המקש הבא', 'Next key'), toggle: true }, cfg)}${optionHtml({ key: 'shake', label: t('רעידות', 'Shake'), toggle: true }, cfg)}${optionHtml({ key: 'volume', label: t('עוצמה', 'Volume'), range: [0, 100] }, cfg)}</div>
                    <div class="results-actions" style="justify-content:center"><button class="btn primary big" id="g3Resume">▶ ${t('המשך', 'Resume')} (Esc)</button><button class="btn" id="g3Restart">↻ ${t('התחל מחדש', 'Restart')}</button><button class="btn" id="g3Quit">${t('יציאה', 'Quit')} (Q)</button></div></div>`;
                ov.querySelectorAll('input').forEach(el => el.addEventListener('change', () => {
                    ['music', 'sound', 'hint', 'shake'].forEach(k => { const x = ov.querySelector('#g3o_' + k); if (x) cfg[k] = x.checked; });
                    const v = ov.querySelector('#g3o_volume'); if (v) cfg.volume = Number(v.value);
                    saveSettings3d(def.id, cfg); Audio3D.apply();
                }));
                ov.querySelector('#g3Resume').onclick = () => togglePause();
                ov.querySelector('#g3Restart').onclick = () => { stop(); play(container, def, cfg); };
                ov.querySelector('#g3Quit').onclick = () => quit();
            } else {
                ov.style.display = 'none'; ov.innerHTML = '';
                if (cfg.music) Audio3D.startMusic(def.music);
            }
        }
        function quit() {
            // quitting mid-game still saves the practice time & score if anything was typed
            if (S.correct + S.wrong > 0 && !S.over) { S.paused = false; endGame(false, true); return; }
            stop(); openMenu(container, def);
        }

        function endGame(win, quitting) {
            if (S.over) return;
            S.over = true;
            if (S.game && S.game._syncStats) S.game._syncStats(S);
            if (typeof Speech !== 'undefined') Speech.stop();
            Audio3D.stopMusic();
            Audio3D.sfx(win ? 'fanfare' : 'gameover');
            const total = S.correct + S.wrong;
            const minutes = Math.max(activeSecs() / 60, 1 / 60);
            const wpm = Math.round(S.correct / 5 / minutes);
            const acc = total ? Math.round(S.correct / total * 1000) / 10 : 0;
            const entry = { score: S.score, level: S.level, wpm, acc, at: Date.now() };
            const rank = S.score > 0 ? addScore(def.id, cfg, entry) : -1;
            let xp = 0;
            if (total > 0) {
                const metrics = { wpm, netWpm: Math.round(Math.max(0, wpm - S.wrong / minutes)), cpm: Math.round(S.correct / minutes), accuracy: acc, elapsedMs: activeSecs() * 1000, correct: S.correct, incorrect: S.wrong, consistency: null, targetChars: total, maxCombo: 0 };
                recordSession(metrics, 'game', null);
                xp = Math.round(S.score / 40);
                awardXp(xp);
                const g = appData.progress.games || (appData.progress.games = {});
                g[def.id + 'Best'] = Math.max(g[def.id + 'Best'] || 0, S.score);
                if (def.onEnd) def.onEnd(S, api);
                checkAchievements(metrics, {});
                flushSaveData();
                refreshHeaderStatus();
            }
            if (rank === 0 && S.score > 0) burstConfetti();
            const ov = $('.g3-overlay');
            ov.style.display = '';
            const extra = (def.endExtra ? def.endExtra(S, api) : '') + keyReportHtml(S);
            ov.innerHTML = `<div class="g3-box">
                <h2>${rank === 0 && S.score > 0 ? t('🏆 שיא חדש!', '🏆 New high score!') : win ? t('🎉 ניצחון!', '🎉 Victory!') : quitting ? t('המשחק נשמר', 'Game saved') : t('המשחק נגמר', 'Game over')}</h2>
                <div class="g3-final">${S.score.toLocaleString()}</div>
                <div class="results-grid">
                    <div class="result-box"><div class="result-val">${S.level}</div><div class="result-lbl">${t('שלב', 'Level')}</div></div>
                    <div class="result-box"><div class="result-val">${S.words}</div><div class="result-lbl">${def.wordsLabel ? def.wordsLabel() : t('מילים', 'Words')}</div></div>
                    <div class="result-box"><div class="result-val">${wpm}</div><div class="result-lbl">${t('מ״לד', 'WPM')}</div></div>
                    <div class="result-box"><div class="result-val">${acc}%</div><div class="result-lbl">${t('דיוק', 'Accuracy')}</div></div>
                    <div class="result-box"><div class="result-val">${S.maxCombo}</div><div class="result-lbl">${t('רצף מרבי', 'Best combo')}</div></div>
                    <div class="result-box"><div class="result-val">+${xp}</div><div class="result-lbl">XP</div></div>
                </div>
                ${extra}
                <p class="results-encourage">${S.score === 0 ? t('בפעם הבאה זה יהיה טוב יותר 💪', 'Next time will be better 💪') : acc >= 97 ? t('דיוק מעולה — כל הכבוד! 🎯', 'Excellent accuracy — well done! 🎯') : S.level >= 5 ? t('מרשים מאוד! 🚀', 'Very impressive! 🚀') : t('משחק יפה! נסו לשבור את השיא', 'Nice game! Try to beat your record')}</p>
                <div class="results-actions" style="justify-content:center"><button class="btn primary big" id="g3Again">↻ ${t('שחק שוב', 'Play again')} (Enter)</button><button class="btn" id="g3Menu">⚙️ ${t('תפריט והגדרות', 'Menu & settings')}</button><button class="btn" id="g3Games">${t('למשחקים', 'All games')}</button></div></div>`;
            ov.querySelector('#g3Again').onclick = () => { stop(); play(container, def, cfg); };
            const drillBtn = ov.querySelector('#g3Drill');
            if (drillBtn) drillBtn.onclick = () => { const weak = JSON.parse(drillBtn.dataset.keys || '[]'); stop(); startGameDrill(weak, container, def); };
            ov.querySelector('#g3Menu').onclick = () => { stop(); openMenu(container, def); };
            ov.querySelector('#g3Games').onclick = () => { stop(); renderGamesScreen(container); };
            const enterH = (e) => { if (!active || active !== S) { document.removeEventListener('keydown', enterH, true); return; } if (e.key === 'Enter') { e.preventDefault(); document.removeEventListener('keydown', enterH, true); ov.querySelector('#g3Again').click(); } };
            setTimeout(() => document.addEventListener('keydown', enterH, true), 600);
        }

        // ---- build & run ----
        resize();
        S.game = def.create(api);
        S.camBase.copy(camera.position);
        resize();
        hud.update();
        if (cfg.music) Audio3D.startMusic(def.music);
        banner(def.startBanner ? def.startBanner(cfg) : t('מתחילים!', 'Go!'), def.startSub ? def.startSub(cfg) : t('הקלידו את המילים', 'Type the words'), 'level', 2600);

        let last = performance.now();
        let hudT = 0;
        function frame(now) {
            if (!S.alive) return;
            S.raf = requestAnimationFrame(frame);
            // raw = real elapsed time (capped so a pause/hidden tab never counts);
            // dt = smoothed step for animation/physics. Clocks and WPM use real time,
            // so results stay correct even on a slow computer with a low frame rate.
            const raw = Math.min(0.5, Math.max(0, (now - last) / 1000)); last = now;
            const dt = Math.min(0.05, raw);
            if (!S.paused && !S.over) {
                S.time += raw; S.playTime += raw;
                Object.values(S.powers).forEach(p => { if (p.left > 0) p.left -= raw; });
                if (S.timeLeft !== null) { S.timeLeft -= raw; if (S.timeLeft <= 0) { S.timeLeft = 0; endGame(true); } }
                S.game.update(dt * S.timeScale, dt);
                hudT += dt; if (hudT > 0.25) { hudT = 0; hud.update(); }
            } else if (S.game.ambient) S.game.ambient(dt);
            particles.update(S.paused ? 0 : dt);
            // camera shake
            if (S.shakeAmt > 0.001) {
                S.shakeAmt *= Math.pow(0.04, dt);
                camera.position.set(S.camBase.x + (Math.random() - 0.5) * S.shakeAmt, S.camBase.y + (Math.random() - 0.5) * S.shakeAmt, S.camBase.z);
            } else camera.position.copy(S.camBase);
            if (S.game.afterCamera) S.game.afterCamera(dt);
            renderer.render(scene, camera);
        }
        S.raf = requestAnimationFrame(frame);
    }

    return { loadThree, webglOk, openMenu, stop, makeLabel, canvasTexture, glowTexture, store, Audio3D, isActive: () => !!active,
        expected: () => (active && active.game && active.game.expected ? active.game.expected() : '') };
})();
