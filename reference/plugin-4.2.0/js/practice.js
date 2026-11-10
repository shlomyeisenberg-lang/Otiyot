// ---- מסך תרגול פעיל (3.0) ----

let activePracticeCtx = null; // { cleanup }

function renderPracticeText(container, session) {
    container.innerHTML = '';
    const wrap = document.createElement('div');
    wrap.className = 'practice-text';
    // direction follows the text itself (English text inside a Hebrew UI, or the reverse)
    wrap.setAttribute('dir', /[\u05D0-\u05EA]/.test(session.targetText) ? 'rtl' : 'ltr');
    session.graphemes.forEach((g, i) => {
        const span = document.createElement('span');
        span.className = 'pchar' + (g === ' ' ? ' space' : '');
        span.textContent = g;
        if (i < session.pos) { span.classList.add('done'); if (session.errorPositions && session.errorPositions.has(i)) span.classList.add('error'); }
        if (i === session.pos) span.classList.add('current');
        wrap.appendChild(span);
    });
    container.appendChild(wrap);
    scrollCurrentCharIntoView(container);
}

// Keeps the letter the student is about to type visible inside the scrollable box.
function scrollCurrentCharIntoView(container) {
    const current = container.querySelector('.pchar.current');
    if (!current) return;
    const box = container;
    const cTop = current.offsetTop, cH = current.offsetHeight;
    if (cTop < box.scrollTop + 4 || cTop + cH > box.scrollTop + box.clientHeight - 4) {
        box.scrollTop = Math.max(0, cTop - box.clientHeight / 3);
    }
}

function updatePracticeCharAt(container, session, posBefore, status) {
    // Drive the UI off session.pos (the real engine state) — in strict mode an
    // error does NOT advance, and with required niqud a letter takes several keys.
    const chars = container.querySelectorAll('.pchar');
    const cur = chars[posBefore];
    if (!cur) return;
    const advanced = session.pos > posBefore;
    if (advanced) {
        cur.classList.remove('current', 'partial');
        cur.classList.add('done');
        if (status !== 'ok') cur.classList.add('error');
        const next = chars[session.pos];
        if (next) next.classList.add('current');
        scrollCurrentCharIntoView(container);
    } else if (status === 'ok') {
        cur.classList.add('partial'); // base letter typed, niqud still pending
    } else {
        cur.classList.remove('flash-error'); void cur.offsetWidth;
        cur.classList.add('flash-error');
        setTimeout(() => cur.classList.remove('flash-error'), 260);
    }
}

const ERGONOMIC_TIPS = [
    ['הניחו את האצבעות על שורת הבית: כ ו-ח מסומנות בבליטה קטנה.', 'Rest your fingers on the home row — F and J have small bumps.'],
    ['כתפיים רפויות, פרקי כף היד ישרים ולא נשענים.', 'Relax your shoulders; keep your wrists straight, not resting.'],
    ['הסתכלו על המסך ולא על המקלדת — המקלדת שעל המסך תעזור לכם.', 'Look at the screen, not your hands — the on-screen keyboard is there to help.'],
    ['דיוק קודם למהירות. המהירות תגיע מעצמה.', 'Accuracy first. Speed will come by itself.'],
    ['אחרי כל הקשה — חזרה לשורת הבית.', 'After every key press, return to the home row.'],
    ['הקישו בעדינות. אין צורך בכוח.', 'Tap lightly. No force needed.'],
    ['נשמו. קצב אחיד ונינוח עדיף על פרצי מהירות.', 'Breathe. A calm, steady rhythm beats bursts of speed.']
];

function startPracticeRun(opts) {
    // Daily practice limit (only when the user chose to enforce it).
    if (isDailyLimitReached()) {
        showDailyLimitOverlay();
        if (opts.onExit) opts.onExit();
        return;
    }
    stopActivePractice();
    if (typeof cancelAutoAdvance === 'function') cancelAutoAdvance();
    try { if (document.activeElement && document.activeElement.blur) document.activeElement.blur(); } catch (e) {}

    const keepNiqud = !!opts.keepNiqud || appSettings.niqudMode !== 'none';
    let text = normalizePracticeText(opts.text, keepNiqud);
    // 3.1 Non-stop: keep generating fresh text from the same lesson until the daily timer is used up.
    let extendFn = null, durationLimitMs = opts.durationLimitMs;
    if (opts.nonStop && typeof opts.gen === 'function') {
        extendFn = () => normalizePracticeText(opts.gen(), keepNiqud) + ' ';
        durationLimitMs = nonStopDurationMs();
        if (text) text += ' ';
    }
    if (!text) {
        otzShowMessage(t('לא נמצא טקסט שאפשר להקליד.', 'There is no typeable text here.'), 'error');
        if (opts.onExit) opts.onExit();
        return;
    }
    showScreen('practiceScreen');
    const screen = document.getElementById('practiceScreen');
    screen.querySelector('.practice-title').textContent = opts.title || '';
    const textContainer = screen.querySelector('.practice-text-container');
    const metricsBar = screen.querySelector('.practice-metrics');
    const kbContainer = screen.querySelector('.practice-keyboard');
    const fingerContainer = screen.querySelector('.practice-finger-guide');
    const fatigueBanner = screen.querySelector('.practice-fatigue-banner');
    const coachEl = screen.querySelector('.practice-coach');
    const progressFill = screen.querySelector('.practice-progress-fill');
    const pausedEl = screen.querySelector('.practice-paused');
    fatigueBanner.style.display = 'none';
    fatigueBanner.innerHTML = '';
    let fatigueShown = false, halfwayShown = false, nearEndShown = false, slowDownShown = false, limitBannerShown = false;
    let errorRun = 0;

    const setCoach = (msg, kind) => {
        coachEl.textContent = msg || '';
        coachEl.className = 'practice-coach' + (kind ? ' ' + kind : '');
        coachEl.style.visibility = msg ? 'visible' : 'hidden';
    };
    let startTip = opts.tip ? opts.tip : '';
    if (!startTip && appSettings.ergonomicsReminders !== false) { const tip = randomChoice(ERGONOMIC_TIPS); startTip = '💡 ' + t(tip[0], tip[1]); }
    setCoach(startTip || t('הקלידו את התו המסומן כדי להתחיל.', 'Type the highlighted character to begin.'), 'tip');

    // 4.1: scheduled fading of guidance. From level 3 the keyboard and finger
    // guide are hidden ("blind mode"); they reappear — with the key highlighted —
    // only for a character the learner hesitates on (>1.5 s) or misses twice in a row.
    const runLevel = opts.level != null ? Number(opts.level) : getActiveLevel();
    const blind = appSettings.autoBlindMode !== false && runLevel >= 3 && !opts.noBlind;
    const kbOn = !!appSettings.showKeyboard, fingersOn = !!(appSettings.showKeyboard && appSettings.showFingerHints);
    kbContainer.classList.remove('blind-hidden', 'blind-reveal');
    fingerContainer.classList.remove('blind-hidden', 'blind-reveal');
    if (kbOn) {
        kbContainer.style.display = '';
        renderKeyboard(kbContainer);
    } else {
        kbContainer.style.display = 'none';
    }
    if (fingersOn) {
        fingerContainer.style.display = '';
        renderFingerGuide(fingerContainer);
    } else {
        fingerContainer.style.display = 'none';
    }
    let blindRevealed = false, hesitationTimer = null, errStreak = 0;
    const setBlindHidden = (hidden) => {
        if (!blind) return;
        blindRevealed = !hidden;
        [kbContainer, fingerContainer].forEach(el => { el.classList.toggle('blind-hidden', hidden); el.classList.toggle('blind-reveal', !hidden); });
    };
    const revealFor = () => {
        if (!blind || blindRevealed || (!kbOn && !fingersOn)) return;
        setBlindHidden(false);
        const s = typingSession;
        if (s && !s.finished) highlightTargetKey(s.graphemes[s.pos]);
    };
    const armHesitation = () => {
        if (!blind) return;
        clearTimeout(hesitationTimer);
        hesitationTimer = setTimeout(revealFor, 1500);
    };
    if (blind) { setBlindHidden(true); kbContainer.dataset.blind = '1'; } else delete kbContainer.dataset.blind;

    // "Next lesson" button in the header, available even while repeating a lesson.
    const oldSkipBtn = screen.querySelector('.practice-header .btn-skip-next');
    if (oldSkipBtn) oldSkipBtn.remove();
    if (opts.onSkipNext) {
        const skipBtn = document.createElement('button');
        skipBtn.className = 'btn-chip btn-skip-next';
        skipBtn.textContent = opts.skipNextLabel || t('לשיעור הבא ›', 'Next lesson ›');
        skipBtn.addEventListener('click', () => {
            cleanupPractice();
            cancelTypingSession();
            opts.onSkipNext();
        });
        screen.querySelector('.practice-header-actions').prepend(skipBtn);
    }
    const speechBtn = screen.querySelector('#btnToggleSpeech');
    const applySpeechBtn = () => { const on = (appSettings.speakNext || 'off') !== 'off'; speechBtn.textContent = on ? '🔊' : '🔇'; speechBtn.classList.toggle('active', on); speechBtn.title = on ? t('הקראת האות הבאה: פועלת', 'Reading next letter: on') : t('הקראת האות הבאה: כבויה', 'Reading next letter: off'); };
    speechBtn.onclick = () => {
        if ((appSettings.speakNext || 'off') === 'off') appSettings.speakNext = appSettings.lastSpeakMode || 'letter';
        else { appSettings.lastSpeakMode = appSettings.speakNext; appSettings.speakNext = 'off'; Speech.stop(); }
        saveSettings(); applySpeechBtn();
        if (typingSession) { Speech.stop(); speakTarget(typingSession); }
    };
    applySpeechBtn();
    const restartBtn = screen.querySelector('#btnRestartPractice');
    restartBtn.textContent = '↻ ' + t('התחל מחדש', 'Restart');
    const exitLbl = screen.querySelector('#btnExitPractice span'); if (exitLbl) exitLbl.textContent = t('יציאה (Esc)', 'Exit (Esc)');
    restartBtn.onclick = () => { cleanupPractice(); cancelTypingSession(); startPracticeRun(opts); };

    const session = startTypingSession(text, {
        mode: opts.mode,
        level: runLevel,
        durationLimitMs,
        extendFn,
        timingMode: opts.timingMode || (durationLimitMs ? 'time' : (appSettings.timingMode || 'completion')),
        accuracyTarget: opts.accuracyTarget || appSettings.accuracyTarget,
        masteryTarget: opts.masteryTarget || appSettings.masteryTarget,
        feedbackMode: opts.feedbackMode || appSettings.feedbackMode,
        onUpdate: (m) => renderLiveMetrics(metricsBar, m),
        onComplete: (m, s) => {
            cleanupPractice();
            playSound('complete');
            if (opts.onFinish) opts.onFinish(m, s);
            else showResultsScreen(m, { onContinue: () => navigateTo('dashboardScreen'), onRetry: () => startPracticeRun(opts) });
            if (limitBannerShown) setTimeout(showDailyLimitOverlay, 600);
        }
    });
    session.niqud = !!opts.keepNiqud;
    // 4.1: explain a stage change the first time it happens
    if (!opts.tip) {
        if (blind && !appSettings.seenBlindIntro) {
            appSettings.seenBlindIntro = true; saveSettings();
            setCoach(t('🙈 מצב עיוור: מהרמה הזו המקלדת והאצבעות מוסתרות. היססתם על אות? היא תופיע לרגע עם הרמז.', '🙈 Blind mode: from this level the keyboard and finger guide are hidden. Hesitate on a key and it appears for that key only.'), 'tip');
        } else if (session.correctionMode === 'backspace' && !appSettings.correctionModeManual && !appSettings.seenBackspaceIntro) {
            appSettings.seenBackspaceIntro = true; saveSettings();
            setCoach(t('⌫ מהרמה הזו מתקנים כל טעות: אחרי אות שגויה לוחצים Backspace ומקלידים שוב.', '⌫ From this level every mistake is fixed: after a wrong key press Backspace and type it again.'), 'tip');
        }
    }
    session.title = opts.title || '';
    session.runOpts = opts;

    renderPracticeText(textContainer, session);
    refreshTarget();
    armHesitation();
    renderLiveMetrics(metricsBar, computeLiveMetrics());
    updateProgress();

    function refreshTarget() {
        const s = typingSession;
        if (!s || s.finished) { highlightTargetKey(null); return; }
        if (s.pendingMarks && s.pendingMarks.length) {
            highlightTargetKey(null);
            const names = s.pendingMarks.map(m => NIQUD_NAME[m] || ({ 'ּ': 'דגש', 'ׁ': 'שין ימנית', 'ׂ': 'שין שמאלית', 'ֱ': 'חטף סגול', 'ֲ': 'חטף פתח', 'ֳ': 'חטף קמץ' })[m] || m);
            setCoach(t('עכשיו הקלידו את הניקוד: ', 'Now type the niqqud: ') + names.join(' + '), 'niqud');
            return;
        }
        if (appSettings.showKeyboard && (!blind || blindRevealed)) highlightTargetKey(s.graphemes[s.pos]);
        speakTarget(s);
    }
    // 3.2: read the next letter (or the next word) aloud
    function speakTarget(s) {
        if (!s || s.finished || typeof Speech === 'undefined' || (appSettings.speakNext || 'off') === 'off') return;
        const g = s.graphemes;
        const ch = s.pendingMarks && s.pendingMarks.length ? s.pendingMarks[0] : g[s.pos];
        const wordStart = s.pos === 0 || g[s.pos - 1] === ' ';
        let word = '';
        if (wordStart && g[s.pos] !== ' ') { for (let i = s.pos; i < g.length && g[i] !== ' '; i++) word += g[i]; }
        Speech.speakNext(ch, { key: s.loopCount + ':' + s.pos + ':' + (s.pendingMarks ? s.pendingMarks.length : '') + ':' + s.typedIncorrect, word, wordStart });
    }
    function updateProgress() {
        const s = typingSession;
        if (!s || !progressFill) return;
        let pct;
        if (s.durationLimitMs) {
            const m = computeLiveMetrics();
            pct = 100 - (m.durationRemainingMs / s.durationLimitMs * 100);
        } else pct = s.pos / Math.max(1, s.graphemes.length) * 100;
        progressFill.style.width = Math.max(0, Math.min(100, pct)) + '%';
    }

    function handleInput(ch, code) {
        const s = typingSession;
        if (!s || s.finished) return;
        const posBefore = s.pos;
        const ok = submitChar(ch);
        if (ok === null) {
            if (s.mustFix) {
                setCoach(t('⌫ יש טעות לתקן — לחצו Backspace כדי למחוק אותה, ואז המשיכו.', '⌫ Fix the mistake first — press Backspace to delete it, then go on.'), 'warn');
                const prev = textContainer.querySelectorAll('.pchar')[s.pos - 1];
                if (prev) { prev.classList.remove('flash-error'); void prev.offsetWidth; prev.classList.add('flash-error'); }
                playSound('error');
            }
            return;
        }
        if (code) flashPressedKey(code);
        if (s.feedbackMode === 'immediate') {
            if (ok) playSound('key'); else { flashErrorKey(ch); playSound('error'); }
        }
        // blind mode: two misses in a row on the same character reveal the help;
        // the help hides again as soon as the learner moves on
        if (blind) {
            if (!ok) { errStreak++; if (errStreak >= 2) revealFor(); }
            else if (s.pos > posBefore) { errStreak = 0; if (blindRevealed) setBlindHidden(true); }
            armHesitation();
        }
        if (ok) {
            if (s.pos > posBefore && appSettings.encouragement !== false) {
                const msg = comboMessage(s.combo);
                if (msg) showComboToast(msg);
                if (errorRun >= 3 && s.combo === 8) setCoach(t('יפה! חזרתם לקצב 👏', 'Nice! You\'re back in rhythm 👏'), 'good');
            }
            if (s.pos > posBefore) errorRun = 0;
        } else {
            errorRun++;
        }
        if (!s.finished) {
            updatePracticeCharAt(textContainer, s, posBefore, ok ? 'ok' : 'error');
            if (s.textChanged) { s.textChanged = false; renderPracticeText(textContainer, s); }
            refreshTarget();
            if (!s.pendingMarks && coachEl.classList.contains('niqud')) setCoach('', '');
            updateProgress();
            milestoneChecks(s);
            if (appSettings.breakReminders !== false && !fatigueShown) maybeShowFatigueBanner();
        }
    }
    function milestoneChecks(s) {
        if (appSettings.encouragement === false || s.durationLimitMs) return;
        const n = s.graphemes.length;
        if (n >= 40 && !halfwayShown && s.pos >= n / 2 && s.loopCount === 0) { halfwayShown = true; setCoach(t('חצי הדרך! 💪 ממשיכים ככה', 'Halfway there! 💪 Keep it up'), 'good'); }
        if (n >= 60 && !nearEndShown && s.pos >= n * 0.9 && s.loopCount === 0) { nearEndShown = true; setCoach(t('כמעט סיימתם! 🏁', 'Almost done! 🏁'), 'good'); }
        if (!slowDownShown && s.totalKeystrokes >= 30) {
            const recent = computeRecentAccuracy();
            if (recent !== null && recent < 85) { slowDownShown = true; setCoach(t('🐢 האטו מעט — דיוק קודם למהירות. המהירות תגיע.', '🐢 Slow down a little — accuracy first. Speed will come.'), 'warn'); }
        }
    }
    function handleBackspace() {
        const s = typingSession;
        if (!s || s.finished) return;
        const before = s.pos;
        if (!submitBackspace()) { if (s.correctionMode === 'strict') setCoach(t('במצב מחמיר אין צורך במחיקה — פשוט הקלידו את התו הנכון.', 'In strict mode there is nothing to delete — just type the right character.'), 'tip'); return; }
        const chars = textContainer.querySelectorAll('.pchar');
        if (chars[before]) chars[before].classList.remove('current', 'partial');
        if (chars[s.pos]) { chars[s.pos].classList.remove('done', 'error', 'partial'); chars[s.pos].classList.add('current'); }
        if (s.correctionMode === 'backspace' && coachEl.classList.contains('warn')) setCoach(t('👍 מתוקן — המשיכו', '👍 Fixed — carry on'), 'good');
        armHesitation();
        refreshTarget(); updateProgress(); playSound('back');
    }

    // Virtual keyboard: mouse/touch input (accessibility, tablets, demonstrations).
    kbContainer.querySelectorAll('.kb-key').forEach(keyEl => {
        keyEl.addEventListener('mousedown', ev => ev.preventDefault());
        keyEl.addEventListener('click', () => {
            const code = keyEl.dataset.code;
            if (code.startsWith('Shift')) return;
            const ch = code === 'Space' ? ' ' : (getCurrentKeyboardLayout()[code] || '');
            if (ch) handleInput(ch, code);
        });
    });

    // 3.1 live dashboard (toggle with the 📊 button; remembered in settings)
    const liveDashEl = screen.querySelector('.live-dash');
    let liveTick = 0;
    liveSeries = [];
    const liveBtn = screen.querySelector('#btnToggleLiveDash');
    const applyLiveVisibility = () => {
        const on = appSettings.liveDashboard !== false;
        liveDashEl.style.display = on ? '' : 'none';
        liveBtn.classList.toggle('active', on);
        liveBtn.textContent = '📊 ' + t('נתונים חיים', 'Live stats'); liveBtn.title = on ? t('הסתר נתונים חיים', 'Hide live stats') : t('הצג נתונים חיים', 'Show live stats');
    };
    liveBtn.onclick = () => { appSettings.liveDashboard = appSettings.liveDashboard === false; saveSettings(); applyLiveVisibility(); renderLiveDashboard(liveDashEl, computeLiveMetrics()); };
    applyLiveVisibility();
    renderLiveDashboard(liveDashEl, computeLiveMetrics());
    if (session.nonStop) setCoach(t(`⏱️ תרגול רציף: ממשיכים ללא הפסקה עד שהטיימר מסתיים (${formatDuration(durationLimitMs)}). Esc = סיום ושמירה.`, `⏱️ Non-stop practice: keep going until the timer ends (${formatDuration(durationLimitMs)}). Esc = finish & save.`), 'tip');

    let metricsInterval = setInterval(() => {
        const s = typingSession;
        if (!s || s.finished) return;
        const live = computeLiveMetrics();
        renderLiveMetrics(metricsBar, live);
        updateProgress();
        if (++liveTick % 2 === 0) renderLiveDashboard(liveDashEl, live);
        pausedEl.style.display = live.paused ? '' : 'none';
        if (s.durationLimitMs && live.durationRemainingMs <= 0) { finishTypingSession(); return; }
        if (appSettings.paceCaret && s.startTs !== null && !s.durationLimitMs) updatePaceCaret(live);
        // Daily limit reached mid-run: let the learner finish this exercise
        // (cutting them off mid-sentence is frustrating), then show the overlay.
        if (!limitBannerShown && isDailyLimitReached(live.elapsedMs)) {
            limitBannerShown = true;
            setCoach(t('🎉 הגעתם ליעד היומי! סיימו את התרגיל הזה — הוא האחרון להיום.', '🎉 Daily goal reached! Finish this exercise — it\'s the last one for today.'), 'good');
        }
    }, 250);
    function updatePaceCaret(live) {
        const target = Number(appData.goals.targetWpm) || 30;
        const idx = Math.floor((live.elapsedMs / 60000) * target * 5);
        const chars = textContainer.querySelectorAll('.pchar');
        textContainer.querySelectorAll('.pchar.pace').forEach(c => c.classList.remove('pace'));
        if (chars[idx]) chars[idx].classList.add('pace');
    }

    function cleanupPractice() {
        clearTimeout(hesitationTimer);
        if (typeof Speech !== 'undefined') Speech.stop();
        document.removeEventListener('keydown', keyHandler, true);
        if (metricsInterval) { clearInterval(metricsInterval); metricsInterval = null; }
        pausedEl.style.display = 'none';
        if (activePracticeCtx && activePracticeCtx.keyHandler === keyHandler) activePracticeCtx = null;
    }

    function keyHandler(e) {
        if (!document.getElementById('practiceScreen') || document.getElementById('practiceScreen').style.display === 'none') return;
        if (document.getElementById('dailyLimitOverlay')) return;
        if (e.key === 'Escape') {
            e.preventDefault();
            if (typingSession && typingSession.nonStop && typingSession.totalKeystrokes > 0 && !typingSession.finished) {
                finishTypingSession(); // saves the minutes already practiced and shows the results
                return;
            }
            cleanupPractice();
            cancelTypingSession();
            if (opts.onExit) opts.onExit(); else navigateTo('dashboardScreen');
            return;
        }
        // AltGr (needed for niqud on the Hebrew layout) arrives as Ctrl+Alt on Windows;
        // a produced Hebrew mark is always accepted whatever modifiers it reports.
        const altGr = (e.getModifierState && e.getModifierState('AltGraph')) || (e.ctrlKey && e.altKey) || /^[\u05B0-\u05C7]$/.test(e.key || '');
        if (e.metaKey || ((e.ctrlKey || e.altKey) && !altGr)) return;
        if (e.isComposing) return;
        if (e.key === 'Backspace') { e.preventDefault(); handleBackspace(); return; }
        if (e.key === 'Tab' || e.key === 'Enter') { e.preventDefault(); return; }
        if (e.repeat) { e.preventDefault(); return; }
        const s = typingSession;
        if (!s || s.finished) return;
        const expected = s.graphemes[s.pos] || '';
        const ch = resolveTypedChar(e, stripNiqud(expected) || expected);
        if (ch === null) return;
        e.preventDefault();
        handleInput(ch, e.code);
    }

    // ---- זיהוי עייפות: דיוק שיורד באופן ניכר תוך כדי תרגול ארוך ----
    function maybeShowFatigueBanner() {
        const live = computeLiveMetrics();
        if (live.elapsedMs < 90000) return;
        const recentAcc = computeRecentAccuracy();
        if (recentAcc === null) return;
        if (recentAcc < 80 || recentAcc < live.accuracy - 12) {
            fatigueShown = true;
            fatigueBanner.style.display = '';
            fatigueBanner.innerHTML = `
                <span>${t('הדיוק ירד לאחרונה — אולי הגיע הזמן להפסקה קצרה? מתחו את האצבעות ושתו מים 💧', 'Your accuracy has dropped — maybe time for a short break? Stretch your fingers and drink some water 💧')}</span>
                <button class="btn-chip" id="btnDismissFatigue">${t('המשך בכל זאת', 'Keep going')}</button>`;
            fatigueBanner.querySelector('#btnDismissFatigue').addEventListener('click', () => { fatigueBanner.style.display = 'none'; });
        }
    }
    // capture phase so focused buttons never swallow Space/Enter during practice
    document.addEventListener('keydown', keyHandler, true);
    activePracticeCtx = { keyHandler, cleanup: cleanupPractice };
}

function stopActivePractice() {
    if (activePracticeCtx && activePracticeCtx.cleanup) activePracticeCtx.cleanup();
    activePracticeCtx = null;
    if (typingSession && !typingSession.finished) cancelTypingSession();
}

// ---- אנימציית "רצף" קטנה ----
function showComboToast(text) {
    if (appSettings.reduceMotion) return;
    const screen = document.getElementById('practiceScreen');
    screen.querySelectorAll('.combo-toast').forEach(x => x.remove());
    const toast = document.createElement('div');
    toast.className = 'combo-toast';
    toast.textContent = text;
    screen.appendChild(toast);
    setTimeout(() => toast.remove(), 1100);
}

function formatDuration(ms) { const total = Math.max(0, Math.ceil((Number(ms) || 0) / 1000)); const min = Math.floor(total / 60); const sec = String(total % 60).padStart(2, '0'); return `${min}:${sec}`; }

function renderLiveMetrics(bar, m) {
    const wpmVal = appSettings.wpmMethod === 'gross' ? m.wpm : m.netWpm;
    const dailyRemainMs = appSettings.dailyLimitEnabled ? Math.max(0, getDailyLimitMs() - getTodayPracticeMs() - m.elapsedMs) : null;
    const s = typingSession;
    const combo = s ? s.combo : 0;
    bar.innerHTML = `
        <div class="metric"><span class="metric-val">${wpmVal}</span><span class="metric-lbl">${t('מ״לד', 'WPM')}</span></div>
        <div class="metric"><span class="metric-val ${m.accuracy >= 97 ? 'good' : m.accuracy < 90 ? 'bad' : ''}">${m.accuracy}%</span><span class="metric-lbl">${t('דיוק', 'Accuracy')}</span></div>
        <div class="metric"><span class="metric-val">${m.incorrect}</span><span class="metric-lbl">${t('שגיאות', 'Errors')}</span></div>
        ${m.durationRemainingMs !== null && m.durationRemainingMs !== undefined
            ? `<div class="metric countdown"><span class="metric-val">${formatDuration(m.durationRemainingMs)}</span><span class="metric-lbl">${t('נותר', 'Left')}</span></div>`
            : `<div class="metric"><span class="metric-val">${formatDuration(m.elapsedMs)}</span><span class="metric-lbl">${t('זמן', 'Time')}</span></div>`}
        <div class="metric combo-metric${combo >= 10 ? ' hot' : ''}"><span class="metric-val">${combo}</span><span class="metric-lbl">${t('רצף', 'Combo')}</span></div>
        ${m.consistency !== null ? `<div class="metric"><span class="metric-val">${m.consistency}</span><span class="metric-lbl">${t('קצב אחיד', 'Rhythm')}</span></div>` : ''}
        ${dailyRemainMs !== null ? `<div class="metric countdown"><span class="metric-val">${formatDuration(dailyRemainMs)}</span><span class="metric-lbl">${t('נותר היום', 'Left today')}</span></div>` : ''}
    `;
}

// ---- צלילים (מסונתזים, ללא קבצי שמע חיצוניים) ----
let _audioCtx = null;
function _tone(freq, start, dur, type, vol) {
    const ctx = _audioCtx;
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    osc.type = type || 'sine';
    osc.connect(gain); gain.connect(ctx.destination);
    osc.frequency.setValueAtTime(freq, ctx.currentTime + start);
    gain.gain.setValueAtTime(0.0001, ctx.currentTime + start);
    gain.gain.exponentialRampToValueAtTime(vol || 0.05, ctx.currentTime + start + 0.01);
    gain.gain.exponentialRampToValueAtTime(0.0001, ctx.currentTime + start + dur);
    osc.start(ctx.currentTime + start);
    osc.stop(ctx.currentTime + start + dur + 0.02);
}
function playSound(kind) {
    if (!appSettings.soundEnabled) return;
    try {
        if (!_audioCtx) _audioCtx = new (window.AudioContext || window.webkitAudioContext)();
        if (_audioCtx.state === 'suspended') _audioCtx.resume();
        const v = 0.045;
        switch (kind) {
            case 'key': _tone(520 + Math.random() * 40, 0, 0.045, 'triangle', v * 0.7); break;
            case 'back': _tone(300, 0, 0.05, 'triangle', v * 0.6); break;
            case 'error': _tone(150, 0, 0.12, 'square', v * 0.5); break;
            case 'complete': [523, 659, 784].forEach((f, i) => _tone(f, i * 0.09, 0.22, 'sine', v)); break;
            case 'achievement': [784, 988, 1175, 1568].forEach((f, i) => _tone(f, i * 0.08, 0.25, 'sine', v)); break;
            case 'levelup': [523, 659, 784, 1047, 784, 1047].forEach((f, i) => _tone(f, i * 0.1, 0.28, 'triangle', v)); break;
            case 'record': [659, 880, 1319].forEach((f, i) => _tone(f, i * 0.11, 0.3, 'sine', v)); break;
            case 'pop': _tone(880, 0, 0.07, 'sine', v); _tone(1320, 0.04, 0.07, 'sine', v * 0.7); break;
            case 'lose': [330, 262, 196].forEach((f, i) => _tone(f, i * 0.12, 0.2, 'sawtooth', v * 0.5)); break;
            default: _tone(420, 0, 0.06, 'sine', v);
        }
    } catch (e) {}
}

// ---- 3.1: non-stop practice length = what's left of today's goal (or a full goal if it's already done) ----
function nonStopDurationMs() {
    const goalMs = getDailyGoalMinutes() * 60000;
    const left = goalMs - getTodayPracticeMs();
    return left >= 60000 ? left : goalMs;
}

// ---- 3.1: live dashboard during practice ----
let liveSeries = [];
function renderLiveDashboard(el, m) {
    if (!el || appSettings.liveDashboard === false) return;
    const s = typingSession;
    if (!s) return;
    const started = s.startTs !== null;
    const rolling = started ? computeRollingWpm(15000) : 0;
    if (started && !m.paused) { liveSeries.push(rolling); if (liveSeries.length > 60) liveSeries.shift(); }
    const recent = (appData.sessions || []).filter(x => (x.chars || 0) >= 20).slice(-10);
    const avg = recent.length ? Math.round(recent.reduce((a, x) => a + (x.netWpm || 0), 0) / recent.length) : 0;
    const best = appData.sessionSummary.bestWpm || 0;
    const target = Number(appData.goals.targetWpm) || 30;
    const scaleMax = Math.max(10, best, target, rolling, avg) * 1.15;
    const pct = v => Math.min(100, Math.round(v / scaleMax * 100));
    const accTarget = Math.min(97, Number(appSettings.accuracyTarget) || 97);
    const acc = m.accuracy;
    const accDeg = Math.round(Math.max(0, Math.min(100, acc)) * 3.6);
    // verdict
    let verdict, vcls;
    if (!started) { verdict = t('מוכנים? התחילו להקליד 🙂', 'Ready? Start typing 🙂'); vcls = ''; }
    else if (m.paused) { verdict = t('⏸ מושהה', '⏸ Paused'); vcls = ''; }
    else if (acc < accTarget - 5 && s.totalKeystrokes >= 15) { verdict = t('🐢 האטו — הדיוק יורד', '🐢 Slow down — accuracy is dropping'); vcls = 'warn'; }
    else if (avg && rolling >= avg * 1.1 && acc >= accTarget) { verdict = t('🔥 מעל הממוצע שלכם!', '🔥 Above your average!'); vcls = 'good'; }
    else if (acc >= 99 && s.totalKeystrokes >= 15) { verdict = t('💎 דיוק מושלם — המשיכו כך', '💎 Flawless accuracy — keep it up'); vcls = 'good'; }
    else if (acc >= accTarget) { verdict = t('👍 בקצב טוב', '👍 Good pace'); vcls = 'good'; }
    else { verdict = t('🎯 התמקדו בדיוק', '🎯 Focus on accuracy'); vcls = 'warn'; }
    // stars projection (lessons only)
    let starsProj = '';
    if (s.mode === 'lesson' && started && s.totalKeystrokes >= 10) {
        const st = acc >= 99 ? 3 : acc >= 98 ? 2 : acc >= accTarget ? 1 : 0;
        starsProj = `<div class="ld-card"><div class="ld-lbl">${t('בדרך ל', 'On track for')}</div><div class="ld-stars">${[1, 2, 3].map(i => `<span class="${i <= st ? 'on' : ''}">★</span>`).join('')}</div></div>`;
    }
    // missed keys this run
    const missed = {};
    (s.errors || []).forEach(e => { if (e.expected) missed[e.expected] = (missed[e.expected] || 0) + 1; });
    const missTop = Object.entries(missed).sort((a, b) => b[1] - a[1]).slice(0, 4);
    // sparkline
    let spark = '';
    if (liveSeries.length >= 3) {
        const w = 150, h = 34, mx = Math.max(10, ...liveSeries);
        const d = liveSeries.map((v, i) => `${i ? 'L' : 'M'}${(i / (liveSeries.length - 1) * (w - 2) + 1).toFixed(1)},${(h - 2 - v / mx * (h - 6)).toFixed(1)}`).join(' ');
        spark = `<svg class="ld-spark" viewBox="0 0 ${w} ${h}" dir="ltr"><path d="${d}" fill="none" stroke="var(--otz-primary)" stroke-width="2" stroke-linejoin="round"/></svg>`;
    }
    el.innerHTML = `
        <div class="ld-verdict ${vcls}">${verdict}</div>
        <div class="ld-grid">
            <div class="ld-card ld-speed">
                <div class="ld-lbl">${t('מהירות עכשיו', 'Speed now')} <b>${rolling}</b> ${t('מ״לד', 'WPM')}</div>
                <div class="ld-bar" dir="ltr"><div class="ld-fill" style="width:${pct(rolling)}%"></div>
                    ${avg ? `<i class="ld-mark avg" style="left:${pct(avg)}%" title="${t('ממוצע', 'Average')}"></i>` : ''}
                    ${best ? `<i class="ld-mark best" style="left:${pct(best)}%" title="${t('שיא', 'Best')}"></i>` : ''}
                    <i class="ld-mark goal" style="left:${pct(target)}%" title="${t('יעד', 'Goal')}"></i></div>
                <div class="ld-legend"><span class="avg">${t('ממוצע', 'avg')} ${avg || '—'}</span><span class="best">${t('שיא', 'best')} ${best || '—'}</span><span class="goal">${t('יעד', 'goal')} ${target}</span></div>
            </div>
            <div class="ld-card ld-acc">
                <div class="ld-ring ${acc >= accTarget ? 'ok' : 'low'}" style="--deg:${accDeg}deg"><span>${Math.round(acc)}%</span></div>
                <div class="ld-lbl">${t('דיוק · יעד', 'Accuracy · target')} ${accTarget}%</div>
            </div>
            <div class="ld-card">
                <div class="ld-lbl">${t('מגמת מהירות', 'Speed trend')}</div>
                ${spark || `<div class="ld-empty">${t('נאסף…', 'collecting…')}</div>`}
            </div>
            ${starsProj}
            <div class="ld-card">
                <div class="ld-lbl">${t('טעויות בתרגיל הזה', 'Missed this run')}</div>
                <div class="ld-miss">${missTop.length ? missTop.map(([c, n]) => `<span><bdi>${c === ' ' ? '␣' : c}</bdi><small> ×${n}</small></span>`).join('') : `<span class="none">${t('אין — מצוין! ✨', 'None — great! ✨')}</span>`}</div>
            </div>
        </div>`;
}
