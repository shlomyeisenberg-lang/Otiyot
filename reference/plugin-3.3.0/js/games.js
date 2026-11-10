// ---- 3.0: Typing games — "Word Rain" (מטר מילים) ----
// Words (or single letters for beginners) fall from the sky. Type a word to pop
// it before it reaches the ground. Three lives; every 8 words the rain speeds up.

let activeGame = null;

function renderGamesScreen(container) {
    stopGame();
    if (typeof G3D !== 'undefined') G3D.stop();
    const g = (appData.progress.games || {});
    const st = (typeof G3D !== 'undefined') ? G3D.store().stats : {};
    container.innerHTML = `
        <h2>${t('משחקי הקלדה', 'Typing Games')}</h2>
        <p class="empty-note">${t('דרך כיפית לחזק את המהירות — כל משחק נותן נקודות ניסיון (XP) ונספר בזמן התרגול היומי.', 'A fun way to build speed — every game earns XP and counts toward your daily practice time.')}</p>
        ${recommendedGameHtml()}
        <div class="games3d-grid">
            <div class="game3d-card g3c-race" data-g3="race">
                <div class="g3c-art"><span class="g3c-sun"></span><span class="g3c-road"></span><span class="g3c-car">🏎️</span><span class="g3c-flag">🏁</span><span class="g3c-badge">3D · ${t('חדש', 'NEW')}</span></div>
                <div class="g3c-body"><h3>${t('מרוץ ההקלדה', 'Typing Grand Prix')}</h3>
                <p>${t('המכונית נוסעת במהירות ההקלדה שלכם על טקסט אמיתי. התחרו בנהגים שמותאמים לקצב שלכם ובמכונית־רוח של השיא האישי.', 'Your car drives at your typing speed on real text. Race drivers matched to your pace and a ghost of your personal best.')}</p>
                <div class="g3c-trains">🎯 ${t('קצב ודיוק בטקסט רציף', 'Rhythm & accuracy on real text')}</div>
                <div class="game-best">🏆 ${t('שיא', 'Best')}: ${(g.raceBest || 0).toLocaleString()}${st.raceWins ? ` · 🥇 ${st.raceWins}` : ''}</div>
                <button class="btn primary big">▶ ${t('לשחק', 'Play')}</button></div>
            </div>
            <div class="game3d-card g3c-arena" data-g3="arena">
                <div class="g3c-art"><span class="g3c-kb">${['ש', 'ד', 'ג', 'כ', 'ע', 'י', 'ח', 'ל'].map((c, i) => `<i class="${i === 3 ? 'up' : i === 6 ? 'up2' : ''}">${c}</i>`).join('')}</span><span class="g3c-hammer">🔨</span><span class="g3c-badge">3D · ${t('חדש', 'NEW')}</span></div>
                <div class="g3c-body"><h3>${t('זירת המקשים', 'Key Arena')}</h3>
                <p>${t('מקשים קופצים על מקלדת ענקית — הקישו לפני שהטבעת נסגרת. מתמקד באותיות החלשות שלכם ומודד זמן תגובה לכל מקש.', 'Keys pop up on a giant keyboard — hit them before the ring closes. Focuses on your weak letters and times every key.')}</p>
                <div class="g3c-trains">🎯 ${t('מיקום מקשים ואצבעות', 'Key positions & fingers')}</div>
                <div class="game-best">🏆 ${t('שיא', 'Best')}: ${(g.arenaBest || 0).toLocaleString()}${st.arenaBestRt ? ` · ⚡ ${(st.arenaBestRt / 1000).toFixed(2)}${t('ש׳', 's')}` : ''}</div>
                <button class="btn primary big">▶ ${t('לשחק', 'Play')}</button></div>
            </div>
            <div class="game3d-card g3c-tower" data-g3="tower">
                <div class="g3c-art"><span class="g3c-cloud c1">☁️</span><span class="g3c-cloud c2">☁️</span><span class="g3c-stack"><i></i><i></i><i></i><i></i><i class="top"></i></span><span class="g3c-crane">🏗️</span><span class="g3c-badge">3D · ${t('חדש', 'NEW')}</span></div>
                <div class="g3c-body"><h3>${t('מגדל הדיוק', 'Tower of Precision')}</h3>
                <p>${t('כל מילה היא קומה. טעות מזיזה את הבלוק והחלק הבולט נחתך — טפסו נקי עד הכוכבים.', 'Every word is a floor. A mistake shifts the block and the overhang is cut off — climb cleanly up to the stars.')}</p>
                <div class="g3c-trains">🎯 ${t('דיוק', 'Accuracy')}</div>
                <div class="game-best">🏆 ${t('שיא', 'Best')}: ${(g.towerBest || 0).toLocaleString()}${st.towerBest ? ` · 🏢 ${st.towerBest} ${t('קומות', 'floors')}` : ''}</div>
                <button class="btn primary big">▶ ${t('לשחק', 'Play')}</button></div>
            </div>
            <div class="game3d-card g3c-space" data-g3="galaxy">
                <div class="g3c-art"><span class="g3c-planet"></span><span class="g3c-ship">🚀</span><span class="g3c-rock r1">☄️</span><span class="g3c-rock r2">☄️</span><span class="g3c-badge">3D</span></div>
                <div class="g3c-body"><h3>${t('גלקסיית המילים', 'Word Galaxy')}</h3>
                <p>${t('יריות בחלל: הקלידו את המילים שעל האסטרואידים לפני שהם פוגעים בחללית. גבישי כוח, ספינות־אם וקפיצות למהירות האור.', 'Space shooter: type the words on the asteroids before they hit your ship. Power crystals, motherships and warp jumps.')}</p>
                <div class="game-best">🏆 ${t('שיא', 'Best')}: ${(g.galaxyBest || 0).toLocaleString()}${st.galaxyBosses ? ` · 👾 ${st.galaxyBosses}` : ''}</div>
                <button class="btn primary big">▶ ${t('לשחק', 'Play')}</button></div>
            </div>
            <div class="game3d-card g3c-hall" data-g3="sefarim">
                <div class="g3c-art"><span class="g3c-window"></span><span class="g3c-book b1">📕</span><span class="g3c-book b2">📘</span><span class="g3c-book b3">📗</span><span class="g3c-candle">🕯️</span><span class="g3c-badge">3D</span></div>
                <div class="g3c-body"><h3>${t('היכל הספרים', 'Hall of Sefarim')}</h3>
                <p>${t('לימוד והקלדה: תפסו את הספרים היורדים בהיכל המואר בהקלדת שמם — חומשים, פרשיות, נ״ך, סדרי משנה, מסכתות ואותיות. מצב "לפי הסדר" וחגיגת סיום.', 'Learning & typing: catch the falling sefarim in a candle-lit hall by typing their names — Chumash, parshiyot, Nach, orders, tractates and letters. "In order" mode and a Siyum celebration.')}</p>
                <div class="game-best">🏆 ${t('שיא', 'Best')}: ${(g.sefarimBest || 0).toLocaleString()}${st.siyumCount ? ` · 🎉 ${t('סיומים', 'Siyums')}: ${st.siyumCount}` : ''}</div>
                <button class="btn primary big">▶ ${t('לשחק', 'Play')}</button></div>
            </div>
        </div>
        <h3 style="margin-top:22px">${t('משחקים קלים (2D)', 'Light games (2D)')}</h3>
        <div class="games-grid">
            <div class="game-card" data-mode="letters">
                <div class="game-icon">🔤</div><h3>${t('גשם אותיות', 'Letter Rain')}</h3>
                <p>${t('אותיות בודדות נופלות — מושלם למתחילים. רק אותיות שכבר למדתם.', 'Single letters fall — perfect for beginners. Only letters you have learned.')}</p>
                <div class="game-best">🏆 ${t('שיא', 'Best')}: ${g.lettersBest || 0}</div>
                <button class="btn primary">▶ ${t('שחק', 'Play')}</button>
            </div>
            <div class="game-card" data-mode="words">
                <div class="game-icon">🌧️</div><h3>${t('מטר מילים', 'Word Rain')}</h3>
                <p>${t('מילים שלמות נופלות — הקלידו אותן לפני שהן נוגעות בקרקע!', 'Whole words fall — type them before they hit the ground!')}</p>
                <div class="game-best">🏆 ${t('שיא', 'Best')}: ${g.rainBest || 0}</div>
                <button class="btn primary">▶ ${t('שחק', 'Play')}</button>
            </div>
        </div>`;
    container.querySelectorAll('.game-card').forEach(card => card.querySelector('button').addEventListener('click', () => startWordRain(container, card.dataset.mode)));
    const reco = container.querySelector('.g3-reco');
    if (reco) reco.querySelector('button').addEventListener('click', () => G3D.openMenu(container, game3dDef(reco.dataset.g3)));
    container.querySelectorAll('.game3d-card').forEach(card => {
        const open = () => G3D.openMenu(container, game3dDef(card.dataset.g3));
        card.querySelector('button').addEventListener('click', (e) => { e.stopPropagation(); open(); });
        card.querySelector('.g3c-art').addEventListener('click', open);
    });
}

// Looked up lazily: the 3D game files load after this one.
function game3dDef(id) {
    try { return ({ galaxy: GALAXY_DEF, sefarim: SEFARIM_DEF, race: RACE_DEF, arena: ARENA_DEF, tower: TOWER_DEF })[id] || null; } catch (e) { return null; }
}

// "Recommended for you": picks the 3D game that trains your current weak spot.
function recommendedGameHtml() {
    const lang = getActiveLanguage();
    const recent = (appData.sessions || []).filter(s => (s.lang || 'he') === lang && (s.chars || 0) >= 20).slice(-12);
    let weak = [];
    try { weak = getWeakCharacters(3).filter(w => w.score < 70); } catch (e) {}
    let id, why;
    const acc = recent.length ? recent.reduce((a, s) => a + (s.accuracy || 0), 0) / recent.length : null;
    if (acc !== null && acc < 94) { id = 'tower'; why = t(`הדיוק הממוצע שלכם לאחרונה הוא ${Math.round(acc)}% — המגדל מתגמל כל מילה נקייה.`, `Your recent average accuracy is ${Math.round(acc)}% — the tower rewards every clean word.`); }
    else if (weak.length) { id = 'arena'; why = t(`האותיות ${weak.map(w => w.ch).join(' ')} עדיין איטיות או שגויות — הזירה תתמקד בהן.`, `The letters ${weak.map(w => w.ch).join(' ')} are still slow or error-prone — the arena will focus on them.`); }
    else if (recent.length) { id = 'race'; why = t('הדיוק טוב — הגיע הזמן לבנות מהירות על טקסט רציף.', 'Your accuracy is good — time to build speed on continuous text.'); }
    else { id = 'arena'; why = t('מתחילים? הזירה מלמדת איפה כל מקש ובאיזו אצבע.', 'Just starting? The arena teaches where each key is and which finger to use.'); }
    const def = game3dDef(id);
    if (!def) return '';
    return `<div class="g3-reco" data-g3="${id}"><span class="g3-reco-icon">${def.icon}</span><div class="g3-reco-body"><b>${t('מומלץ לכם עכשיו', 'Recommended for you now')}: ${def.title()}</b><span>${why}</span></div><button class="btn primary">▶ ${t('לשחק', 'Play')}</button></div>`;
}

function stopGame() {
    if (!activeGame) return;
    activeGame.running = false;
    cancelAnimationFrame(activeGame.raf);
    document.removeEventListener('keydown', activeGame.onKey, true);
    activeGame = null;
}

function gameWordPool(mode) {
    const known = Array.from(getKnownKeys());
    if (mode === 'letters') return known.filter(isLetterChar).length ? known.filter(isLetterChar) : Object.values(getCurrentKeyboardLayout()).filter(isLetterChar);
    const bank = isEnglishTyping() ? ENGLISH_WORD_BANK : WORD_BANK;
    const knownSet = new Set(known);
    let words = [].concat(bank.short, bank.medium, bank.long).filter(w => !/\s/.test(w));
    const fits = words.filter(w => Array.from(w).every(c => knownSet.has(c)));
    return fits.length >= 8 ? fits : words;
}

function startWordRain(container, mode) {
    stopGame();
    if (isDailyLimitReached()) { showDailyLimitOverlay(); return; }
    container.innerHTML = `
        <div class="game-top">
            <span class="game-title">${mode === 'letters' ? '🔤 ' + t('גשם אותיות', 'Letter Rain') : '🌧️ ' + t('מטר מילים', 'Word Rain')}</span>
            <span class="game-hud"><span id="gScore">0</span> ${t('נק׳', 'pts')} · ${t('שלב', 'Lv')} <span id="gLevel">1</span> · <span id="gLives">❤️❤️❤️</span></span>
            <span><button class="btn-chip" id="gPause">⏸</button><button class="btn-esc" id="gExit">${t('יציאה (Esc)', 'Exit (Esc)')}</button></span>
        </div>
        <div class="game-field" id="gField" dir="${isEnglishTyping() ? 'ltr' : 'rtl'}">
            <div class="game-ground"></div>
            <div class="game-typed" id="gTyped"></div>
            <div class="game-msg" id="gMsg">${t('מתחילים! הקלידו את מה שנופל', 'Go! Type what falls')}</div>
        </div>`;
    const field = container.querySelector('#gField');
    const pool = gameWordPool(mode);
    const G = activeGame = {
        running: true, paused: false, mode, field, pool, drops: [], typed: '', target: null,
        score: 0, level: 1, lives: 3, popped: 0, spawnIn: 600, last: performance.now(), raf: 0,
        correct: 0, wrong: 0, startTs: performance.now(), pausedMs: 0, pauseStart: 0, maxCombo: 0, combo: 0
    };
    const hud = () => {
        container.querySelector('#gScore').textContent = G.score;
        container.querySelector('#gLevel').textContent = G.level;
        container.querySelector('#gLives').textContent = '❤️'.repeat(Math.max(0, G.lives)) + '🤍'.repeat(Math.max(0, 3 - G.lives));
        container.querySelector('#gTyped').textContent = G.typed;
    };
    const msg = (text) => { const m = container.querySelector('#gMsg'); m.textContent = text; m.classList.remove('show'); void m.offsetWidth; m.classList.add('show'); };
    const speed = () => (mode === 'letters' ? 26 : 22) + G.level * (mode === 'letters' ? 7 : 6); // px per second
    const spawnGap = () => Math.max(mode === 'letters' ? 520 : 900, (mode === 'letters' ? 1500 : 2600) - G.level * 170);

    function spawn() {
        const w = randomChoice(G.pool);
        if (G.drops.some(d => d.word === w)) return;
        const el = document.createElement('div');
        el.className = 'drop';
        el.textContent = w;
        field.appendChild(el);
        const fw = field.clientWidth;
        const ew = Math.max(30, el.offsetWidth);
        const x = 10 + Math.random() * Math.max(10, fw - ew - 20);
        el.style.left = x + 'px';
        G.drops.push({ word: w, el, y: -30, x, done: 0 });
    }
    function pop(d) {
        d.el.classList.add('popped');
        setTimeout(() => d.el.remove(), 300);
        G.drops = G.drops.filter(x => x !== d);
        G.popped++;
        G.combo++; G.maxCombo = Math.max(G.maxCombo, G.combo);
        const pts = Array.from(d.word).length * 10 * G.level + (G.combo >= 5 ? 5 * G.combo : 0);
        G.score += pts;
        playSound('pop');
        if (G.combo > 0 && G.combo % 10 === 0) msg(t(`🔥 ${G.combo} ברצף!`, `🔥 ${G.combo} streak!`));
        if (G.popped % 8 === 0) { G.level++; msg(t(`⬆️ שלב ${G.level}! הגשם מתחזק`, `⬆️ Level ${G.level}! The rain gets heavier`)); playSound('achievement'); }
        G.target = null; G.typed = '';
        hud();
    }
    function miss(d) {
        d.el.classList.add('missed');
        setTimeout(() => d.el.remove(), 400);
        G.drops = G.drops.filter(x => x !== d);
        if (G.target === d) { G.target = null; G.typed = ''; }
        G.lives--; G.combo = 0;
        playSound('error');
        field.classList.remove('shake'); void field.offsetWidth; field.classList.add('shake');
        hud();
        if (G.lives <= 0) gameOver();
    }
    function setTargetVisual() {
        G.drops.forEach(d => {
            d.el.classList.toggle('target', d === G.target);
            if (d === G.target) {
                const parts = Array.from(d.word);
                d.el.innerHTML = `<span class="dt">${escapeHtmlDash(parts.slice(0, G.typed.length ? Array.from(G.typed).length : 0).join(''))}</span>${escapeHtmlDash(parts.slice(Array.from(G.typed).length).join(''))}`;
            } else if (d.el.firstChild && d.el.firstChild.nodeType !== 3) d.el.textContent = d.word;
        });
    }
    function onChar(ch) {
        if (G.paused || !G.running) return;
        if (!G.target) {
            // lock onto the lowest word that starts with this character
            const cands = G.drops.filter(d => Array.from(d.word)[0] === ch).sort((a, b) => b.y - a.y);
            if (!cands.length) { G.wrong++; G.combo = 0; playSound('error'); flashField(); return; }
            G.target = cands[0]; G.typed = ch; G.correct++;
        } else {
            const parts = Array.from(G.target.word);
            const nextCh = parts[Array.from(G.typed).length];
            if (ch === nextCh) { G.typed += ch; G.correct++; }
            else { G.wrong++; G.combo = 0; playSound('error'); flashField(); return; }
        }
        playSound('key');
        if (G.typed === G.target.word) pop(G.target);
        setTargetVisual(); hud();
    }
    function flashField() { field.classList.remove('flash'); void field.offsetWidth; field.classList.add('flash'); }
    function togglePause() {
        G.paused = !G.paused;
        container.querySelector('#gPause').textContent = G.paused ? '▶' : '⏸';
        if (G.paused) { G.pauseStart = performance.now(); msg(t('⏸ מושהה', '⏸ Paused')); }
        else { G.pausedMs += performance.now() - G.pauseStart; G.last = performance.now(); }
    }
    function gameOver() {
        G.running = false;
        cancelAnimationFrame(G.raf);
        document.removeEventListener('keydown', G.onKey, true);
        playSound('lose');
        const g = appData.progress.games || (appData.progress.games = {});
        const key = mode === 'letters' ? 'lettersBest' : 'rainBest';
        const isRecord = G.score > (g[key] || 0);
        if (isRecord) g[key] = G.score;
        // record as a practice session (time counts toward the daily goal & streak)
        const elapsedMs = performance.now() - G.startTs - G.pausedMs;
        const total = G.correct + G.wrong;
        const minutes = Math.max(elapsedMs / 60000, 1 / 60);
        const metrics = { wpm: Math.round(total / 5 / minutes), netWpm: Math.round(Math.max(0, total / 5 / minutes - G.wrong / minutes)), cpm: Math.round(G.correct / minutes), accuracy: total ? Math.round(G.correct / total * 1000) / 10 : 0, elapsedMs, correct: G.correct, incorrect: G.wrong, consistency: null, targetChars: total, maxCombo: 0 };
        if (total > 0) recordSession(metrics, 'game', null);
        awardXp(Math.round(G.score / 25));
        checkAchievements(metrics, {});
        flushSaveData();
        if (isRecord && G.score > 0) burstConfetti();
        const over = document.createElement('div');
        over.className = 'game-over';
        over.innerHTML = `<div class="go-box">
            <h2>${isRecord && G.score > 0 ? t('🏆 שיא חדש!', '🏆 New record!') : t('המשחק נגמר', 'Game over')}</h2>
            <div class="results-grid">
                <div class="result-box"><div class="result-val">${G.score}</div><div class="result-lbl">${t('נקודות', 'Points')}</div></div>
                <div class="result-box"><div class="result-val">${G.popped}</div><div class="result-lbl">${mode === 'letters' ? t('אותיות', 'Letters') : t('מילים', 'Words')}</div></div>
                <div class="result-box"><div class="result-val">${G.level}</div><div class="result-lbl">${t('שלב', 'Level')}</div></div>
                <div class="result-box"><div class="result-val">${metrics.accuracy}%</div><div class="result-lbl">${t('דיוק', 'Accuracy')}</div></div>
            </div>
            <p class="results-encourage">${G.score === 0 ? t('בפעם הבאה זה יהיה טוב יותר — נסו שוב! 💪', 'Next time will be better — try again! 💪') : G.level >= 5 ? t('מרשים מאוד! האצבעות שלכם מהירות 🚀', 'Very impressive! Your fingers are fast 🚀') : t('יופי של משחק! נסו לשבור את השיא 🎯', 'Nice game! Try to beat your record 🎯')}</p>
            <div class="results-actions"><button class="btn primary big" id="goAgain">↻ ${t('שחק שוב', 'Play again')}</button><button class="btn" id="goBack">${t('למשחקים', 'Back to games')}</button></div>
        </div>`;
        field.appendChild(over);
        over.querySelector('#goAgain').addEventListener('click', () => startWordRain(container, mode));
        over.querySelector('#goBack').addEventListener('click', () => renderGamesScreen(container));
        refreshHeaderStatus();
    }
    function frame(now) {
        if (!G.running) return;
        const dt = Math.min(0.1, (now - G.last) / 1000);
        G.last = now;
        if (!G.paused && document.visibilityState !== 'hidden') {
            G.spawnIn -= dt * 1000;
            if (G.spawnIn <= 0 || !G.drops.length) { spawn(); G.spawnIn = spawnGap(); }
            const ground = field.clientHeight - 46;
            const v = speed();
            G.drops.slice().forEach(d => {
                d.y += v * dt * (d === G.target ? 0.7 : 1);
                d.el.style.transform = `translateY(${d.y}px)`;
                if (d.y >= ground) miss(d);
            });
        }
        if (G.running) G.raf = requestAnimationFrame(frame);
    }
    G.onKey = (e) => {
        if (container.style.display === 'none' || !G.running) return;
        if (e.key === 'Escape') { e.preventDefault(); stopGame(); renderGamesScreen(container); return; }
        if (e.ctrlKey || e.metaKey || e.altKey) return;
        if (e.key === 'Backspace') { e.preventDefault(); G.typed = ''; G.target = null; setTargetVisual(); hud(); return; }
        if (e.code === 'Space' || e.key === ' ') { e.preventDefault(); if (!G.target) togglePause(); return; }
        if (e.repeat) return;
        const expected = G.target ? Array.from(G.target.word)[Array.from(G.typed).length] : (G.drops[0] ? Array.from(G.drops[0].word)[0] : '');
        const ch = resolveTypedChar(e, expected);
        if (!ch) return;
        e.preventDefault();
        onChar(ch);
    };
    document.addEventListener('keydown', G.onKey, true);
    container.querySelector('#gExit').addEventListener('click', () => { stopGame(); renderGamesScreen(container); });
    container.querySelector('#gPause').addEventListener('click', togglePause);
    hud();
    msg(t('מתחילים! הקלידו את מה שנופל · רווח = השהיה', 'Go! Type what falls · Space = pause'));
    G.raf = requestAnimationFrame(frame);
}
