// ---- 4.2: "Word Storm" (סערת המילים) — the new version of Letter Rain / Word Rain ----
// A 2D canvas game (no 3D graphics needed, runs on any computer). Drops fall from
// storm clouds onto a little town; type them before they land. New on top of the
// old rain games: power drops (⭐ triple, ❄️ freeze, 💣 bomb, ☂️ umbrella, ❤️ heart),
// combo multiplier, a "storm surge" meter (double points, slow motion), a thunder
// boss every 4 levels, target letters 🎯 from your weak spots, and coins.

let activeStorm = null;
function stopStorm() {
    if (!activeStorm) return;
    const S = activeStorm; activeStorm = null;
    S.running = false; cancelAnimationFrame(S.raf);
    document.removeEventListener('keydown', S.onKey, true);
    window.removeEventListener('resize', S.onResize);
}

function startWordStorm(container, mode) {
    stopStorm(); if (typeof stopGame === 'function') stopGame(); if (typeof G3D !== 'undefined') G3D.stop();
    if (isDailyLimitReached()) { showDailyLimitOverlay(); return; }
    const en = isEnglishTyping();
    container.innerHTML = `
        <div class="game-top st-top">
            <span class="game-title">⛈️ ${t('סערת המילים', 'Word Storm')} <small>${mode === 'letters' ? t('אותיות', 'letters') : mode === 'words' ? t('מילים', 'words') : t('מעורב', 'mixed')}</small></span>
            <span class="game-hud st-hud"></span>
            <span><button class="btn-chip" id="stPause">⏸</button><button class="btn-esc" id="stExit">${t('יציאה', 'Exit')}</button></span>
        </div>
        <div class="st-wrap"><canvas class="st-canvas"></canvas><div class="st-banner"></div><div class="st-over" style="display:none"></div></div>`;
    const canvas = container.querySelector('.st-canvas');
    const ctx = canvas.getContext('2d');
    const wrap = container.querySelector('.st-wrap');
    const hudEl = container.querySelector('.st-hud');
    const W0 = PLUS.wallet();
    const S = activeStorm = {
        running: true, paused: false, raf: 0, last: performance.now(), mode,
        drops: [], fx: [], rain: [], target: null, typed: 0, score: 0, level: 1, lives: 3, popped: 0,
        combo: 0, maxCombo: 0, surge: 0, surgeLeft: 0, freezeLeft: 0, umbrella: 0, spawnIn: 0.6,
        correct: 0, wrong: 0, playMs: 0, coins: 0, bounty: PLUS.pickBounty([]), bountyHits: 0, keyLog: {},
        boss: null, bossDone: 0, flash: 0, shake: 0, lastKeyT: performance.now(), w: 800, h: 500, dpr: 1, perfectWord: true
    };
    const known = Array.from(getKnownKeys()).filter(isLetterChar);
    const letters = known.length >= 2 ? known : Object.values(getCurrentKeyboardLayout()).filter(isLetterChar).slice(0, 8);
    const vocab = PLUS.vocabulary().filter(w => Array.from(w).length <= 7);
    function nextText() {
        const m = mode === 'mixed' ? (Math.random() < 0.35 ? 'letters' : 'words') : mode;
        if (m === 'letters') {
            if (Math.random() < 0.4) return randomChoice(S.bounty);
            return randomChoice(letters);
        }
        const maxLen = 2 + Math.min(5, S.level);
        let pool = vocab.filter(w => Array.from(w).length <= maxLen);
        if (Math.random() < 0.4) { const b = pool.filter(w => S.bounty.some(c => w.includes(c))); if (b.length) pool = b; }
        return randomChoice(pool.length ? pool : vocab);
    }
    function resize() {
        const r = wrap.getBoundingClientRect();
        S.dpr = Math.min(2, window.devicePixelRatio || 1);
        S.w = Math.max(320, r.width); S.h = Math.max(300, r.height);
        canvas.width = S.w * S.dpr; canvas.height = S.h * S.dpr;
        canvas.style.width = S.w + 'px'; canvas.style.height = S.h + 'px';
    }
    S.onResize = resize; window.addEventListener('resize', resize); resize();
    for (let i = 0; i < 140; i++) S.rain.push({ x: Math.random(), y: Math.random(), v: 0.6 + Math.random() * 0.8 });
    const houses = []; for (let x = 0; x < 1; x += 0.06 + Math.random() * 0.05) houses.push({ x, w: 0.04 + Math.random() * 0.04, h: 30 + Math.random() * 50, hue: Math.floor(Math.random() * 360), lit: Math.random() < 0.6 });

    const POWERS = [
        { id: 'star', icon: '⭐', col: '#ffd24a' }, { id: 'freeze', icon: '❄️', col: '#7fd6ff' }, { id: 'bomb', icon: '💣', col: '#ff7a59' },
        { id: 'umbrella', icon: '☂️', col: '#b48bff' }, { id: 'heart', icon: '❤️', col: '#ff6b8a' }
    ];
    const speed = () => (mode === 'letters' ? 34 : 26) + S.level * (mode === 'letters' ? 8 : 6);
    const gap = () => Math.max(mode === 'letters' ? 0.42 : 0.75, (mode === 'letters' ? 1.4 : 2.4) - S.level * 0.15) * (S.boss ? 0.7 : 1);
    function spawn() {
        const text = nextText();
        if (S.drops.some(d => d.chars[0] === Array.from(text)[0] && d.y < 80)) return;
        const power = S.level >= 2 && Math.random() < 0.09 ? randomChoice(POWERS.filter(p => p.id !== 'heart' || S.lives < 3)) : null;
        ctx.font = `bold ${mode === 'letters' ? 30 : 26}px 'David','Arial Hebrew','Segoe UI',sans-serif`;
        const tw = ctx.measureText(text).width + 34;
        const x = 20 + Math.random() * Math.max(10, S.w - tw - 40);
        S.drops.push({ text, chars: Array.from(text), x, y: -40, w: tw, power, wob: Math.random() * 6, bounty: S.bounty.some(c => text.includes(c)), vy: 1 + Math.random() * 0.25 });
    }
    function banner(main, sub, cls) {
        const b = container.querySelector('.st-banner');
        b.className = 'st-banner show ' + (cls || '');
        b.innerHTML = `<b>${main}</b>${sub ? `<span>${sub}</span>` : ''}`;
        clearTimeout(S.bT); S.bT = setTimeout(() => { b.className = 'st-banner'; }, 1500);
    }
    function burst(x, y, col, n) { for (let i = 0; i < n; i++) { const a = Math.random() * Math.PI * 2, v = 60 + Math.random() * 160; S.fx.push({ x, y, vx: Math.cos(a) * v, vy: Math.sin(a) * v - 60, life: 0.6 + Math.random() * 0.4, col, r: 2 + Math.random() * 3 }); } }
    function textFx(x, y, txt, col) { S.fx.push({ x, y, txt, col, life: 1, vy: -50 }); }
    function hud() {
        hudEl.innerHTML = `<b>${S.score.toLocaleString()}</b> ${t('נק׳', 'pts')} · ${t('שלב', 'Lv')} ${S.level} · ${'☔'.repeat(Math.max(0, S.lives))}${S.umbrella ? ' ☂️' : ''} · ×${mult()} · 🪙 ${W0.coins + S.coins} · 🎯 ${S.bounty.join(' ')}`;
    }
    const mult = () => Math.min(8, 1 + Math.floor(S.combo / 6)) * (S.surgeLeft > 0 ? 2 : 1);
    function addSurge(x) { if (S.surgeLeft > 0) return; S.surge = Math.min(1, S.surge + x); if (S.surge >= 1) { S.surge = 0; S.surgeLeft = 7; banner('🌪️ ' + t('סערת־על!', 'Storm surge!'), t('ניקוד כפול והאטה', 'Double points, slow motion'), 'surge'); playSound('achievement'); } }
    function pop(d) {
        S.drops.splice(S.drops.indexOf(d), 1);
        S.target = null; S.typed = 0;
        S.popped++; S.combo++; S.maxCombo = Math.max(S.maxCombo, S.combo);
        let pts = (d.chars.length * 10 + 5) * S.level * mult();
        if (S.perfectWord) pts = Math.round(pts * 1.2);
        if (d.bounty) pts = Math.round(pts * 1.5);
        if (d.power && d.power.id === 'star') pts *= 3;
        S.score += pts; S.coins += 1 + (d.bounty ? 1 : 0) + (S.perfectWord ? 1 : 0) - 1;
        burst(d.x + d.w / 2, d.y, d.power ? d.power.col : (d.bounty ? '#ffd24a' : '#7fd6ff'), 18);
        textFx(d.x + d.w / 2, d.y - 10, '+' + pts, d.bounty ? '#ffd24a' : '#fff');
        playSound('pop');
        addSurge(S.perfectWord ? 0.09 : 0.04);
        if (S.combo % 10 === 0) { banner(`🔥 ${S.combo}`, t('ברצף!', 'in a row!')); S.coins += 2; }
        if (d.power) usePower(d.power, d);
        if (S.boss) { S.boss.hp -= d.chars.length + (S.perfectWord ? 2 : 0); S.shake = 0.2; if (S.boss.hp <= 0) bossDown(); }
        S.perfectWord = true;
        if (!S.boss && S.popped % 10 === 0) levelUp();
        hud();
    }
    function usePower(p, d) {
        if (p.id === 'freeze') { S.freezeLeft = 4; banner('❄️ ' + t('הקפאה!', 'Freeze!'), t('4 שניות', '4 seconds')); }
        if (p.id === 'bomb') { const n = S.drops.length; S.drops.forEach(x => { burst(x.x + x.w / 2, x.y, '#ff7a59', 12); S.score += x.chars.length * 5 * S.level; }); S.drops = []; S.target = null; S.flash = 0.5; banner('💣 ' + t('בום!', 'Boom!'), `${n} ${t('טיפות', 'drops')}`); }
        if (p.id === 'umbrella') { S.umbrella++; banner('☂️ ' + t('מטרייה', 'Umbrella'), t('הפספוס הבא לא נחשב', 'Your next miss is free')); }
        if (p.id === 'heart') { S.lives = Math.min(5, S.lives + 1); banner('❤️ +1'); }
        if (p.id === 'star') banner('⭐ ×3');
    }
    function levelUp() {
        S.level++; S.bounty = PLUS.pickBounty(S.bounty);
        playSound('achievement');
        if (S.level % 4 === 0) { S.boss = { hp: 30 + S.level * 8, max: 30 + S.level * 8, x: 0.5, t: 0, time: 45 }; banner('⛈️ ' + t('ענן הרעם!', 'The thunder cloud!'), t('פוצצו טיפות כדי לפגוע בו', 'Pop drops to hit it'), 'boss'); S.flash = 0.6; }
        else banner(`⬆️ ${t('שלב', 'Level')} ${S.level}`, `🎯 ${t('אותיות מטרה חדשות', 'New target letters')}: ${S.bounty.join(' ')}`);
    }
    function bossDown() {
        const bonus = 400 * S.level;
        S.score += bonus; S.coins += 20; S.bossDone++;
        burst(S.w / 2, 70, '#ffd24a', 80); S.flash = 0.8;
        banner('🏆 ' + t('ענן הרעם הובס!', 'Thunder cloud defeated!'), `+${bonus.toLocaleString()} · +🪙20`, 'surge');
        S.boss = null; levelUp();
    }
    function miss(d) {
        S.drops.splice(S.drops.indexOf(d), 1);
        if (S.target === d) { S.target = null; S.typed = 0; }
        burst(d.x + d.w / 2, S.h - 50, '#5aa9ff', 14);
        if (S.umbrella > 0) { S.umbrella--; banner('☂️', t('המטרייה הצילה אתכם', 'The umbrella saved you')); hud(); return; }
        S.lives--; S.combo = 0; S.shake = 0.35; S.flash = 0.25;
        playSound('error');
        hud();
        if (S.lives <= 0) gameOver();
    }
    function track(exp, ch, ok) {
        const dt = performance.now() - S.lastKeyT; S.lastKeyT = performance.now();
        if (!exp || exp === ' ') return;
        try { recordCharResult(exp, ok, dt); if (!ok) recordErrorPair(exp, ch); } catch (e) {}
        const k = S.keyLog[exp] || (S.keyLog[exp] = { n: 0, ok: 0 }); k.n++; if (ok) k.ok++;
    }
    function onChar(ch) {
        if (!S.target) {
            const c = S.drops.filter(d => d.chars[0] === ch).sort((a, b) => b.y - a.y)[0];
            const exp = S.drops.slice().sort((a, b) => b.y - a.y)[0];
            track(exp ? exp.chars[0] : '', ch, !!c);
            if (!c) { bad(); return; }
            S.target = c; S.typed = 1;
        } else {
            const need = S.target.chars[S.typed];
            track(need, ch, ch === need);
            if (ch !== need) { bad(); return; }
            S.typed++;
        }
        S.correct++;
        if (S.bounty.includes(ch)) { S.bountyHits++; S.score += 5 * S.level; if (S.bountyHits % 3 === 0) S.coins++; }
        playSound('key');
        if (S.typed >= S.target.chars.length) pop(S.target);
        hud();
    }
    function bad() { S.wrong++; S.combo = 0; S.perfectWord = false; S.surge = Math.max(0, S.surge - 0.15); S.shake = 0.12; playSound('error'); hud(); }

    // ---- drawing ----
    function draw(dt) {
        const w = S.w, h = S.h;
        ctx.setTransform(S.dpr, 0, 0, S.dpr, 0, 0);
        const sx = S.shake > 0 ? (Math.random() - 0.5) * 14 * S.shake : 0, sy = S.shake > 0 ? (Math.random() - 0.5) * 10 * S.shake : 0;
        ctx.translate(sx, sy);
        const night = Math.min(1, (S.level - 1) / 8);
        const g = ctx.createLinearGradient(0, 0, 0, h);
        g.addColorStop(0, S.boss ? '#1a1030' : `hsl(${215 - night * 20},${40 + night * 10}%,${42 - night * 28}%)`);
        g.addColorStop(1, S.boss ? '#3a2a55' : `hsl(${205},${35}%,${68 - night * 40}%)`);
        ctx.fillStyle = g; ctx.fillRect(-20, -20, w + 40, h + 40);
        // clouds
        for (let i = 0; i < 6; i++) { const cx = ((i * 0.21 + performance.now() / 90000) % 1.2 - 0.1) * w, cy = 30 + (i % 3) * 18; ctx.fillStyle = S.boss ? 'rgba(60,50,90,0.85)' : 'rgba(235,240,250,0.55)'; [0, 40, 80].forEach((o, k) => { ctx.beginPath(); ctx.arc(cx + o, cy + (k === 1 ? -14 : 0), 32, 0, Math.PI * 2); ctx.fill(); }); }
        // rain
        ctx.strokeStyle = 'rgba(200,220,255,0.35)'; ctx.lineWidth = 1;
        ctx.beginPath(); S.rain.forEach(r => { const x = r.x * w, y = r.y * h; ctx.moveTo(x, y); ctx.lineTo(x - 3, y + 12); }); ctx.stroke();
        // boss cloud
        if (S.boss) {
            const B = S.boss, bx = w * B.x, by = 70 + Math.sin(B.t * 2) * 6;
            ctx.fillStyle = '#4b3a6e'; [-70, -30, 10, 50].forEach((o, k) => { ctx.beginPath(); ctx.arc(bx + o, by + (k % 2 ? -18 : 0), 44, 0, Math.PI * 2); ctx.fill(); });
            ctx.fillStyle = '#fff'; ctx.font = 'bold 34px sans-serif'; ctx.textAlign = 'center'; ctx.fillText('⚡😠⚡', bx - 10, by + 12);
            ctx.fillStyle = 'rgba(0,0,0,0.4)'; ctx.fillRect(w / 2 - 150, 8, 300, 12);
            ctx.fillStyle = '#ff5577'; ctx.fillRect(w / 2 - 150, 8, 300 * Math.max(0, B.hp / B.max), 12);
            ctx.fillStyle = '#fff'; ctx.font = 'bold 12px sans-serif'; ctx.fillText(`⏳ ${Math.ceil(B.time)}`, w / 2 + 175, 19);
        }
        // town
        const gy = h - 40;
        houses.forEach(hs => { const x = hs.x * w, ww = hs.w * w; ctx.fillStyle = `hsl(${hs.hue},25%,${40 - night * 20}%)`; ctx.fillRect(x, gy - hs.h, ww, hs.h); ctx.fillStyle = hs.lit && night > 0.3 ? '#ffe39a' : 'rgba(255,255,255,0.25)'; for (let yy = gy - hs.h + 8; yy < gy - 8; yy += 14) for (let xx = x + 5; xx < x + ww - 6; xx += 12) ctx.fillRect(xx, yy, 5, 6); });
        ctx.fillStyle = '#2f4a3a'; ctx.fillRect(-20, gy, w + 40, 60);
        // drops
        ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
        S.drops.forEach(d => {
            const isT = d === S.target;
            const x = d.x, y = d.y, ww = d.w, hh = mode === 'letters' ? 46 : 40;
            ctx.save();
            ctx.translate(x + ww / 2 + Math.sin(d.wob) * 3, y);
            ctx.fillStyle = d.power ? d.power.col : isT ? '#2a6df4' : d.bounty ? '#c98a12' : 'rgba(40,90,170,0.88)';
            ctx.beginPath(); ctx.moveTo(0, -hh / 2 - 14); ctx.quadraticCurveTo(ww / 2, -hh / 2, ww / 2, 0); ctx.quadraticCurveTo(ww / 2, hh / 2, 0, hh / 2); ctx.quadraticCurveTo(-ww / 2, hh / 2, -ww / 2, 0); ctx.quadraticCurveTo(-ww / 2, -hh / 2, 0, -hh / 2 - 14); ctx.fill();
            if (isT) { ctx.strokeStyle = '#fff'; ctx.lineWidth = 3; ctx.stroke(); }
            ctx.font = `bold ${mode === 'letters' ? 30 : 26}px 'David','Arial Hebrew','Segoe UI',sans-serif`;
            try { ctx.direction = /[א-ת]/.test(d.text) ? 'rtl' : 'ltr'; } catch (e) {}
            ctx.fillStyle = '#fff'; ctx.fillText(d.text, 0, 3);
            if (isT && S.typed) {
                // highlight typed part
                const full = ctx.measureText(d.text).width, pre = ctx.measureText(d.chars.slice(0, S.typed).join('')).width;
                ctx.save(); ctx.beginPath();
                if (/[א-ת]/.test(d.text)) ctx.rect(full / 2 - pre, -30, pre + 4, 60); else ctx.rect(-full / 2 - 2, -30, pre + 2, 60);
                ctx.clip(); ctx.fillStyle = '#5cf2a0'; ctx.fillText(d.text, 0, 3); ctx.restore();
            }
            if (d.power) { ctx.font = '18px sans-serif'; ctx.fillText(d.power.icon, ww / 2 - 4, -hh / 2); }
            else if (d.bounty) { ctx.font = '14px sans-serif'; ctx.fillText('🎯', ww / 2 - 4, -hh / 2); }
            ctx.restore();
        });
        // fx
        S.fx.forEach(f => {
            ctx.globalAlpha = Math.max(0, Math.min(1, f.life));
            if (f.txt) { ctx.font = 'bold 20px sans-serif'; ctx.fillStyle = f.col; ctx.fillText(f.txt, f.x, f.y); }
            else { ctx.fillStyle = f.col; ctx.beginPath(); ctx.arc(f.x, f.y, f.r, 0, Math.PI * 2); ctx.fill(); }
        });
        ctx.globalAlpha = 1;
        // surge meter
        ctx.fillStyle = 'rgba(0,0,0,0.35)'; ctx.fillRect(12, h - 26, 160, 10);
        ctx.fillStyle = S.surgeLeft > 0 ? '#ff7a1a' : '#ffd24a'; ctx.fillRect(12, h - 26, 160 * (S.surgeLeft > 0 ? S.surgeLeft / 7 : S.surge), 10);
        ctx.fillStyle = '#fff'; ctx.font = 'bold 11px sans-serif'; ctx.textAlign = 'left'; ctx.fillText('🌪️ SURGE', 178, h - 21);
        // next-key hint
        const exp = expected();
        if (exp && appSettings.showFingerGuide !== false) {
            const r = resolveKeyForChar(exp); const fn = r ? fingerName(KEY_TO_FINGER[r.code]) : '';
            ctx.textAlign = 'right'; ctx.fillText(`${t('הבא', 'Next')}: ${exp}${fn ? ' · ' + fn : ''}`, w - 12, h - 21);
        }
        if (S.freezeLeft > 0) { ctx.fillStyle = 'rgba(150,220,255,0.18)'; ctx.fillRect(0, 0, w, h); }
        if (S.surgeLeft > 0) { ctx.strokeStyle = `rgba(255,130,30,${0.4 + Math.sin(performance.now() / 90) * 0.2})`; ctx.lineWidth = 8; ctx.strokeRect(4, 4, w - 8, h - 8); }
        if (S.flash > 0) { ctx.fillStyle = `rgba(255,255,255,${S.flash})`; ctx.fillRect(0, 0, w, h); }
    }
    function expected() {
        if (S.target) return S.target.chars[S.typed] || '';
        const d = S.drops.slice().sort((a, b) => b.y - a.y)[0];
        return d ? d.chars[0] : '';
    }

    function frame(now) {
        if (!S.running) return;
        S.raf = requestAnimationFrame(frame);
        const dt = Math.min(0.05, (now - S.last) / 1000); S.last = now;
        if (!S.paused && document.visibilityState !== 'hidden' && !S.over) {
            S.playMs += dt * 1000;
            const slow = (S.freezeLeft > 0 ? 0 : 1) * (S.surgeLeft > 0 ? 0.6 : 1);
            if (S.freezeLeft > 0) S.freezeLeft -= dt;
            if (S.surgeLeft > 0) S.surgeLeft -= dt;
            S.spawnIn -= dt * (slow || 0.2);
            if (S.spawnIn <= 0 || !S.drops.length) { spawn(); S.spawnIn = gap(); }
            const v = speed();
            S.drops.slice().forEach(d => { d.y += v * d.vy * dt * slow * (d === S.target ? 0.75 : 1); d.wob += dt * 2; if (d.y >= S.h - 56) miss(d); });
            if (S.boss) { S.boss.t += dt; S.boss.x = 0.5 + Math.sin(S.boss.t * 0.6) * 0.3; S.boss.time -= dt; if (S.boss.time <= 0) { S.boss = null; banner('⛈️ ' + t('ענן הרעם ברח', 'The thunder cloud escaped'), t('בפעם הבאה!', 'Next time!')); S.lives--; hud(); if (S.lives <= 0) gameOver(); else levelUp(); } if (Math.random() < 0.004) S.flash = 0.35; }
            S.rain.forEach(r => { r.y += r.v * dt * (S.boss ? 1.6 : 1); if (r.y > 1) { r.y = 0; r.x = Math.random(); } });
        }
        S.fx = S.fx.filter(f => { f.life -= dt; if (f.txt) f.y += f.vy * dt; else { f.vy += 300 * dt; f.x += f.vx * dt; f.y += f.vy * dt; } return f.life > 0; });
        S.shake = Math.max(0, S.shake - dt); S.flash = Math.max(0, S.flash - dt * 1.5);
        draw(dt);
    }
    function togglePause() {
        if (S.over) return;
        S.paused = !S.paused;
        const ov = container.querySelector('.st-over');
        container.querySelector('#stPause').textContent = S.paused ? '▶' : '⏸';
        if (S.paused) {
            ov.style.display = ''; ov.innerHTML = `<div class="go-box"><h2>⏸ ${t('מושהה', 'Paused')}</h2><div class="results-actions"><button class="btn primary big" id="stResume">▶ ${t('המשך', 'Resume')} (Esc)</button><button class="btn" id="stQuit">${t('סיום ושמירה', 'End & save')}</button></div></div>`;
            ov.querySelector('#stResume').onclick = togglePause; ov.querySelector('#stQuit').onclick = () => { S.paused = false; ov.style.display = 'none'; gameOver(true); };
        } else { ov.style.display = 'none'; S.last = performance.now(); }
    }
    function gameOver(quit) {
        if (S.over) return; S.over = true;
        playSound(quit ? 'pop' : 'lose');
        const g = appData.progress.games || (appData.progress.games = {});
        const key = 'storm' + (mode === 'letters' ? 'Letters' : mode === 'words' ? 'Words' : 'Mixed') + 'Best';
        const isRecord = S.score > (g[key] || 0);
        if (isRecord) g[key] = S.score;
        g.stormBest = Math.max(g.stormBest || 0, S.score);
        const total = S.correct + S.wrong, minutes = Math.max(S.playMs / 60000, 1 / 60);
        const metrics = { wpm: Math.round(S.correct / 5 / minutes), netWpm: Math.round(Math.max(0, S.correct / 5 / minutes - S.wrong / minutes)), cpm: Math.round(S.correct / minutes), accuracy: total ? Math.round(S.correct / total * 1000) / 10 : 0, elapsedMs: S.playMs, correct: S.correct, incorrect: S.wrong, consistency: null, targetChars: total, maxCombo: 0 };
        S.coins = Math.max(0, S.coins + Math.floor(S.popped / 2));
        if (total > 0) {
            recordSession(metrics, 'game', null);
            awardXp(Math.round(S.score / 30));
            const w = PLUS.wallet(); w.coins += S.coins; w.stats.coinsEarned = (w.stats.coinsEarned || 0) + S.coins; w.stats.bounty = (w.stats.bounty || 0) + S.bountyHits;
            checkAchievements(metrics, {});
            flushSaveData();
        }
        if (isRecord && S.score > 0) burstConfetti();
        const weak = Object.entries(S.keyLog).filter(([, k]) => k.n >= 2 && k.ok / k.n < 0.85).sort((a, b) => a[1].ok / a[1].n - b[1].ok / b[1].n).slice(0, 6);
        const ov = container.querySelector('.st-over');
        ov.style.display = '';
        ov.innerHTML = `<div class="go-box">
            <h2>${isRecord && S.score > 0 ? t('🏆 שיא חדש!', '🏆 New record!') : quit ? t('המשחק נשמר', 'Game saved') : t('הסערה ניצחה הפעם', 'The storm won this time')}</h2>
            <div class="results-grid">
                <div class="result-box"><div class="result-val">${S.score.toLocaleString()}</div><div class="result-lbl">${t('נקודות', 'Points')}</div></div>
                <div class="result-box"><div class="result-val">${S.popped}</div><div class="result-lbl">${t('טיפות', 'Drops')}</div></div>
                <div class="result-box"><div class="result-val">${S.level}</div><div class="result-lbl">${t('שלב', 'Level')}</div></div>
                <div class="result-box"><div class="result-val">${metrics.accuracy}%</div><div class="result-lbl">${t('דיוק', 'Accuracy')}</div></div>
                <div class="result-box"><div class="result-val">${S.maxCombo}</div><div class="result-lbl">${t('רצף מרבי', 'Best combo')}</div></div>
                <div class="result-box"><div class="result-val">+${S.coins}</div><div class="result-lbl">🪙</div></div>
            </div>
            <p class="results-encourage">🎯 ${t('אותיות מטרה', 'Target letters')}: <b>${S.bountyHits}</b>${S.bossDone ? ` · ⛈️ ${t('עננים שהובסו', 'Clouds defeated')}: <b>${S.bossDone}</b>` : ''}</p>
            ${weak.length ? `<p class="results-encourage">🔎 ${t('לחזק', 'To strengthen')}: ${weak.map(([c, k]) => `<b>${c}</b> ${Math.round(k.ok / k.n * 100)}%`).join(' · ')}</p>` : ''}
            <div class="results-actions"><button class="btn primary big" id="stAgain">↻ ${t('שחק שוב', 'Play again')} (Enter)</button><button class="btn" id="stBack">${t('למשחקים', 'Back to games')}</button></div></div>`;
        ov.querySelector('#stAgain').onclick = () => startWordStorm(container, mode);
        ov.querySelector('#stBack').onclick = () => { stopStorm(); renderGamesScreen(container); };
        refreshHeaderStatus();
    }
    S.onKey = (e) => {
        if (!S.running || container.style.display === 'none' || !document.body.contains(canvas)) return;
        if (S.over) { if (e.key === 'Enter') { e.preventDefault(); startWordStorm(container, mode); } else if (e.key === 'Escape') { e.preventDefault(); stopStorm(); renderGamesScreen(container); } return; }
        if (e.key === 'Escape') { e.preventDefault(); togglePause(); return; }
        if (S.paused || e.ctrlKey || e.metaKey || e.altKey) return;
        if (e.key === 'Backspace') { e.preventDefault(); S.target = null; S.typed = 0; return; }
        if (e.repeat) { e.preventDefault(); return; }
        if (e.key === ' ' || e.code === 'Space') { e.preventDefault(); return; }
        const ch = resolveTypedChar(e, expected());
        if (!ch) return;
        e.preventDefault();
        onChar(ch);
    };
    document.addEventListener('keydown', S.onKey, true);
    container.querySelector('#stExit').onclick = () => { if (S.correct + S.wrong > 0 && !S.over) gameOver(true); else { stopStorm(); renderGamesScreen(container); } };
    container.querySelector('#stPause').onclick = togglePause;
    hud();
    banner('⛈️ ' + t('סערת המילים', 'Word Storm'), `🎯 ${t('אותיות המטרה שלכם', 'Your target letters')}: ${S.bounty.join(' ')}`);
    S.raf = requestAnimationFrame(frame);
}
