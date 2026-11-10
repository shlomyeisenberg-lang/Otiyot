// ---- מנוע ההקלדה: מפעיל תרגיל בודד ומודד ביצועים ----

let typingSession = null; // מצב התרגיל הפעיל

const IDLE_PAUSE_MS = 6000; // gaps longer than this are "thinking/away" time, not typing time

function startTypingSession(targetText, opts) {
    opts = opts || {};
    const graphemes = toGraphemes(targetText);
    typingSession = {
        targetText,
        graphemes,
        pos: 0,
        typedCorrect: 0,
        typedIncorrect: 0,
        totalKeystrokes: 0,
        errors: [],              // { expected, typed, index, ts }
        typedChars: [],
        feedbackMode: opts.feedbackMode || appSettings.feedbackMode || 'immediate',
        accuracyTarget: Number(opts.accuracyTarget || appSettings.accuracyTarget || 97),
        masteryTarget: Number(opts.masteryTarget || appSettings.masteryTarget || 90),
        startTs: null,
        lastCharTs: null,
        finished: false,
        mode: opts.mode || 'lesson',       // lesson | test | custom
        durationLimitMs: opts.durationLimitMs || null,
        timingMode: opts.timingMode || (opts.durationLimitMs ? 'time' : 'completion'),
        minAttemptsForMastery: Number(opts.minAttemptsForMastery || 3),
        loopCount: 0,
        onUpdate: opts.onUpdate || function () {},
        onComplete: opts.onComplete || function () {},
        timerHandle: null,
        currentWordStart: 0,
        currentErrorAtPos: false,
        recentResults: [],  // rolling window of recent correct/incorrect keystrokes, used for fatigue detection
        intervals: [],      // ms between consecutive correct keystrokes, used for rhythm/consistency scoring
        idleMs: 0,          // 3.0: excluded "away" time (auto-pause)
        pendingMarks: null, // 3.0: niqud marks still to type for the current letter (required-niqud mode)
        errorPositions: new Set(),
        combo: 0, maxCombo: 0,
        keyTimes: {},       // 3.0: per-character time in this run, for the results breakdown
        wpmTimeline: [],    // 3.0: [elapsedSec, netWpm] samples for the results sparkline
        correctTs: [],      // 3.1: timestamps of recent correct keys (live rolling speed)
        extendFn: opts.extendFn || null, // 3.1 non-stop mode: produces fresh text when the current text runs out
        nonStop: !!opts.extendFn,
        textChanged: false,
        // 4.1: correction mode is fixed per run (it can follow the learning stage)
        correctionMode: opts.correctionMode || (typeof getEffectiveCorrectionMode === 'function' ? getEffectiveCorrectionMode(opts.level) : (appSettings.correctionMode || 'free')),
        mustFix: false,     // 4.1 'backspace' mode: an uncorrected error blocks further typing
        posTs: [],          // 4.1: time each position was completed (per-word speed)
        feedsChallenge: !['test', 'assessment', 'game'].includes(opts.mode || 'lesson')
    };
    return typingSession;
}

// 4.1: which correction rule applies to a run at a given curriculum level.
// Until the learner picks a mode in Settings, levels 0–2 are 'free' (keep going
// after a mistake) and from level 3 mistakes must be fixed with Backspace.
function getEffectiveCorrectionMode(level) {
    if (appSettings.correctionModeManual) return ['free', 'strict', 'backspace'].includes(appSettings.correctionMode) ? appSettings.correctionMode : 'free';
    const lvl = level == null ? (typeof getActiveLevel === 'function' ? getActiveLevel() : 0) : Number(level) || 0;
    return lvl >= 3 ? 'backspace' : 'free';
}

function _now() { return performance.now(); }
const _MARK_RE = /[ְ-ּׁׂ]/;
function _marksOf(g) { return Array.from(g || '').filter(c => _MARK_RE.test(c)); }

// Is the session currently auto-paused (no key for a while, untimed)?
function isSessionIdle() {
    const s = typingSession;
    return !!(s && s.startTs !== null && !s.durationLimitMs && s.lastCharTs && (_now() - s.lastCharTs) > IDLE_PAUSE_MS);
}

// מחזיר true אם התו הוקלד נכון, false אם שגוי, null אם הקלט התעלם
function submitChar(inputChar) {
    const s = typingSession;
    if (!s || s.finished) return null;
    if (s.pos >= s.graphemes.length) return null;
    const expected = s.graphemes[s.pos];
    const expectedBase = (typeof stripNiqud === 'function' ? stripNiqud(expected) : expected) || expected;
    const expectedMarks = _marksOf(expected);
    const requireNiqud = (appSettings.niqudMode === 'required') && expectedMarks.length > 0;
    const inputIsMark = typeof inputChar === 'string' && _MARK_RE.test(inputChar);

    // Niqud keys pressed when niqud is not required are simply ignored, instead of
    // being counted as an error against the *next* letter.
    if (inputIsMark && !(requireNiqud && s.pendingMarks)) return null;
    // 4.1 'backspace' mode: the previous character was wrong and is still on screen —
    // nothing else is accepted until it is deleted.
    if (s.correctionMode === 'backspace' && s.pos > 0 && s.errorPositions.has(s.pos - 1)) { s.mustFix = true; s.onUpdate(computeLiveMetrics()); return null; }

    if (s.startTs === null) {
        s.startTs = _now();
        if (s.durationLimitMs) {
            s.timerHandle = setTimeout(() => finishTypingSession(), s.durationLimitMs);
        }
    }
    const ts = _now();
    let dt = s.lastCharTs ? (ts - s.lastCharTs) : 0;
    if (dt > IDLE_PAUSE_MS && !s.durationLimitMs) { s.idleMs += dt - IDLE_PAUSE_MS; }
    s.lastCharTs = ts;
    s.totalKeystrokes++;

    let isCorrect;
    let completesGrapheme = true;
    if (requireNiqud) {
        if (!s.pendingMarks) {
            isCorrect = inputChar === expectedBase;
            if (isCorrect) { s.pendingMarks = expectedMarks.slice(); completesGrapheme = false; }
        } else {
            const idx = s.pendingMarks.indexOf(inputChar);
            isCorrect = idx >= 0;
            if (isCorrect) s.pendingMarks.splice(idx, 1);
            completesGrapheme = isCorrect && s.pendingMarks.length === 0;
            if (isCorrect && !completesGrapheme) {
                s.typedCorrect++; s.typedChars.push(inputChar);
                s.onUpdate(computeLiveMetrics());
                return true;
            }
        }
        if (isCorrect && !completesGrapheme) {
            s.typedCorrect++; s.typedChars.push(inputChar);
            recordCharResult(expectedBase, true, dt);
            s.onUpdate(computeLiveMetrics());
            return true;
        }
    } else {
        isCorrect = (typeof inputChar === 'string' ? inputChar.normalize('NFC') : inputChar) === expectedBase;
    }
    s.typedChars.push(inputChar);
    s.recentResults.push(isCorrect);
    if (s.recentResults.length > 25) s.recentResults.shift();
    if (s.feedsChallenge && typeof recordChallengeKeystroke === 'function') recordChallengeKeystroke(isCorrect);

    if (isCorrect) {
        s.typedCorrect++;
        s.combo++; if (s.combo > s.maxCombo) s.maxCombo = s.combo;
        s.correctTs.push(ts); if (s.correctTs.length > 400) s.correctTs.splice(0, 100);
        s.currentErrorAtPos = false;
        if (dt && dt < 5000) {
            s.intervals.push(dt); // רק פערים סבירים (לא הפסקות ארוכות) נכנסים לחישוב הקצב
            const kt = s.keyTimes[expectedBase] || (s.keyTimes[expectedBase] = { n: 0, ms: 0 });
            kt.n++; kt.ms += dt;
        }
        if (!requireNiqud || !s.pendingMarks) recordCharResult(expectedBase, true, dt);
        s.pendingMarks = null;
        if (s.pos > 0) {
            recordBigramResult(stripNiqud(s.graphemes[s.pos - 1]) + expectedBase, true, dt);
            if (s.pos > 1) {
                const a = stripNiqud(s.graphemes[s.pos - 2]), b = stripNiqud(s.graphemes[s.pos - 1]);
                recordTrigramResult(a + b + expectedBase, true, dt);
            }
        }
        s.posTs[s.pos] = ts;
        s.pos++;
    } else {
        s.typedIncorrect++;
        s.combo = 0;
        s.currentErrorAtPos = true;
        s.errors.push({ expected: expectedBase, typed: inputChar, index: s.pos, ts });
        recordCharResult(expectedBase, false, dt);
        recordErrorPair(expectedBase, inputChar);
        if (s.correctionMode === 'free' || s.correctionMode === 'backspace') {
            s.errorPositions.add(s.pos);
            s.pendingMarks = null;
            s.posTs[s.pos] = ts;
            s.pos++; // ממשיכים הלאה גם עם טעות (ב-backspace: עד שמוחקים אותה)
        }
        // strict: לא מתקדמים עד שהמשתמש מקליד נכון
    }
    return _afterAdvance(s, isCorrect);
}

function _afterAdvance(s, isCorrect) {
    const metricsNow = computeLiveMetrics();
    // in 'backspace' mode the run cannot end on an uncorrected last character
    const completionReached = s.pos >= s.graphemes.length && !(s.correctionMode === 'backspace' && s.errorPositions.has(s.graphemes.length - 1));
    const accuracyReached = s.totalKeystrokes >= 20 && metricsNow.accuracy >= s.accuracyTarget && completionReached;
    const masteryReached = s.totalKeystrokes >= 20 && completionReached &&
        s.graphemes.filter(g => /[א-ת]/.test(stripNiqud(g))).every(g => {
            const score = charMastery(stripNiqud(g));
            return score !== null && score >= s.masteryTarget;
        });

    // Timed sessions end only when the timer expires. If the passage ends early,
    // loop it so a fast typist is never given an artificially short test.
    let finished = s.timingMode === 'time' ? false : completionReached;
    const loop = () => {
        s.loopCount++; s.pos = 0; s.errorPositions = new Set(); finished = false; s.textChanged = true;
        _flushWordTimes(s); s.posTs = [];
        if (s.extendFn) {
            // Non-stop: replace the finished text with a fresh one (keeps the screen short and the content varied).
            let next = '';
            try { next = s.extendFn() || ''; } catch (e) { next = ''; }
            if (next) { s.graphemes = toGraphemes(next); s.targetText += next; }
        }
    };
    if (s.timingMode === 'time' && completionReached) {
        loop();
    } else if (s.timingMode === 'accuracy') {
        if (completionReached && accuracyReached) finished = true;
        else if (completionReached && s.loopCount < 10) loop();
        else if (completionReached) finished = true;
    } else if (s.timingMode === 'mastery') {
        if (completionReached && masteryReached) finished = true;
        else if (completionReached && s.loopCount < 10) loop();
        else if (completionReached) finished = true;
    }
    if (isCorrect && s.startTs !== null && s.typedCorrect % 10 === 0) {
        s.wpmTimeline.push([Math.round(metricsNow.elapsedMs / 1000), metricsNow.netWpm]);
    }
    s.onUpdate(metricsNow);
    if (finished) {
        finishTypingSession();
    }
    return isCorrect;
}

// 3.0: Backspace in free-correction mode — step back one character so a mistake
// can be fixed. Keystroke accuracy still counts the original error (honest stats),
// but the character is no longer an *uncorrected* error.
function submitBackspace() {
    const s = typingSession;
    if (!s || s.finished || s.pos <= 0) return false;
    if (s.correctionMode === 'strict') return false;
    if (s.correctionMode === 'free' && appSettings.allowBackspace === false) return false;
    s.pos--;
    s.pendingMarks = null;
    s.errorPositions.delete(s.pos);
    s.posTs[s.pos] = undefined;
    s.mustFix = false;
    s.typedChars.push('\b');
    s.lastCharTs = _now();
    s.onUpdate(computeLiveMetrics());
    return true;
}

// דיוק בחלון הקלדות אחרון (לזיהוי עייפות) — נבדל מהדיוק הכולל של התרגיל
function computeRecentAccuracy() {
    const s = typingSession;
    if (!s || s.recentResults.length < 10) return null;
    const correct = s.recentResults.filter(Boolean).length;
    return Math.round((correct / s.recentResults.length) * 100);
}

function computeConsistency() {
    // ציון 0-100: מבוסס על מקדם השונות (coefficient of variation) בין הקלדות תקינות.
    const s = typingSession;
    if (!s || s.intervals.length < 8) return null;
    const n = s.intervals.length;
    const mean = s.intervals.reduce((a, b) => a + b, 0) / n;
    if (mean === 0) return null;
    const variance = s.intervals.reduce((a, b) => a + (b - mean) * (b - mean), 0) / n;
    const cv = Math.sqrt(variance) / mean;
    return Math.max(0, Math.min(100, Math.round(100 - cv * 100)));
}

function computeLiveMetrics() {
    const s = typingSession;
    // BUGFIX 3.0: durationRemainingMs was missing here, so a timed test showed
    // "NaN:NaN" until the first key was pressed.
    if (!s || s.startTs === null) return { wpm: 0, netWpm: 0, cpm: 0, accuracy: 100, elapsedMs: 0, correct: 0, incorrect: 0, consistency: null, durationRemainingMs: s && s.durationLimitMs ? s.durationLimitMs : null, targetChars: s && s.graphemes ? s.graphemes.length : 0, paused: false, maxCombo: 0 };
    const nowTs = _now();
    let idle = s.idleMs;
    const paused = isSessionIdle();
    if (paused) idle += (nowTs - s.lastCharTs) - IDLE_PAUSE_MS;
    const elapsedMs = Math.max(0, (s.finishedAtTs || nowTs) - s.startTs - idle);
    const minutes = Math.max(elapsedMs / 60000, 1 / 60);
    const grossWpm = (s.totalKeystrokes / 5) / minutes;
    // Standard net-WPM: gross WPM minus error penalty per minute.
    const netWpm = Math.max(0, grossWpm - (s.typedIncorrect / minutes));
    const cpm = s.typedCorrect / minutes;
    const accuracy = s.totalKeystrokes ? (s.typedCorrect / s.totalKeystrokes * 100) : 100;
    const durationRemainingMs = s.durationLimitMs
        ? Math.max(0, s.durationLimitMs - (nowTs - s.startTs))
        : null;
    return {
        wpm: Math.round(grossWpm),
        netWpm: Math.round(netWpm),
        cpm: Math.round(cpm),
        accuracy: Math.round(accuracy * 10) / 10,
        elapsedMs,
        durationRemainingMs,
        correct: s.typedCorrect,
        incorrect: s.typedIncorrect,
        consistency: computeConsistency(),
        targetChars: s.graphemes ? s.graphemes.length : 0,
        paused,
        maxCombo: s.maxCombo
    };
}

// Live rolling speed over the last `windowMs` (for the live dashboard).
function computeRollingWpm(windowMs) {
    const s = typingSession;
    if (!s || s.startTs === null) return 0;
    windowMs = windowMs || 15000;
    const nowTs = s.finished ? (s.finishedAtTs || _now()) : _now();
    const from = Math.max(s.startTs, nowTs - windowMs);
    const n = s.correctTs.filter(x => x >= from).length;
    const minutes = Math.max((nowTs - from) / 60000, 2 / 60);
    return Math.round(n / 5 / minutes);
}

function cancelTypingSession() {
    const s = typingSession;
    if (!s) return;
    if (s.timerHandle) clearTimeout(s.timerHandle);
    s.finished = true;
    s.timerHandle = null;
    typingSession = null;
}
let lastFinishedSession = null;
function finishTypingSession() {
    const s = typingSession;
    if (!s || s.finished) return;
    s.finished = true;
    if (s.timerHandle) clearTimeout(s.timerHandle);
    s.finishedAtTs = s.durationLimitMs ? _now() : (s.lastCharTs || _now());
    if (typeof lastSessionRewards !== 'undefined') lastSessionRewards = null;
    const metrics = computeLiveMetrics();
    // A run where nothing was typed (e.g. a timed run that expired untouched) is
    // not a real session — don't pollute statistics/streaks with it.
    if (s.totalKeystrokes > 0) {
        _flushWordTimes(s);
        finalizeWordStats(s.targetText, s.typedChars, s.correctionMode);
        recordSession(metrics, s.mode, s);
    }
    lastFinishedSession = s;
    s.onComplete(metrics, s);
}


function recordTrigramResult(tri, correct, dt) {
    const st = appData.trigramStats[tri] || { attempts: 0, correct: 0, totalMs: 0 };
    st.attempts++;
    if (correct) st.correct++;
    if (dt && dt < 5000) st.totalMs += dt;
    appData.trigramStats[tri] = st;
    if (typeof pedagogyRecordTrigram === 'function') pedagogyRecordTrigram(tri, correct, dt);
}

// 4.1: per-word speed. A word typed in one go (no error inside it) gives its
// ms-per-character, measured from the keystroke that ended the previous word.
function _flushWordTimes(s) {
    const g = s.graphemes, ts = s.posTs;
    if (!g || !ts || !ts.length) return;
    let i = 0;
    while (i < g.length) {
        while (i < g.length && g[i] === ' ') i++;
        const start = i;
        while (i < g.length && g[i] !== ' ') i++;
        const end = i - 1;
        if (end < start || start === 0) continue;
        const t0 = ts[start - 1], t1 = ts[end];
        if (!t0 || !t1 || t1 <= t0) continue;
        let clean = true;
        for (let k = start; k <= end; k++) if (s.errorPositions.has(k) || !ts[k]) { clean = false; break; }
        if (!clean) continue;
        const ms = (t1 - t0) / (end - start + 1);
        if (ms > 2500) continue; // a pause, not typing
        const word = stripNiqud(g.slice(start, end + 1).join('')).replace(/[.,!?;:"()]+$/g, '');
        if (!word) continue;
        const st = appData.wordStats[word] || (appData.wordStats[word] = { attempts: 0, correct: 0, corrections: 0, totalMs: 0 });
        st.timedN = (st.timedN || 0) + 1;
        st.timedMs = (st.timedMs || 0) + ms;
        if (typeof pedagogyRecordWord === 'function') { try { pedagogyRecordWord(word, true, ms); } catch (e) {} }
    }
}

function finalizeWordStats(targetText, typedChars, correctionMode) {
    correctionMode = correctionMode || appSettings.correctionMode;
    const targetWords = targetText.split(/\s+/).filter(Boolean);
    if (!targetWords.length) return;

    // typedChars contains every physical keystroke, including rejected errors
    // in strict mode. Reconstruct the accepted stream by replaying the same
    // correction rule against the target. Otherwise one wrong key could shift
    // every subsequent word boundary in the statistics.
    const target = toGraphemes(stripNiqud(targetText));
    const accepted = [];
    let pos = 0;
    for (const raw of (typedChars || [])) {
        if (raw === '\b') { if (accepted.length) { accepted.pop(); pos = Math.max(0, pos - 1); } continue; }
        if (/[\u05B0-\u05C7]/.test(raw)) continue; // niqud keystrokes belong to the previous letter
        const ch = stripNiqud(String(raw));
        const expected = target[pos];
        if (expected === undefined) break;
        if (ch === expected) {
            accepted.push(ch);
            pos++;
        } else if (correctionMode === 'free' || correctionMode === 'backspace') {
            // Free mode intentionally advances after an error; retain the
            // typed character so the resulting word can be scored as wrong.
            accepted.push(ch);
            pos++;
        }
        // Strict mode: wrong keystrokes are rejected and therefore do not
        // belong to the accepted word stream.
    }

    let cursor = 0;
    targetWords.forEach(word => {
        const expected = toGraphemes(stripNiqud(word));
        while (cursor < target.length && target[cursor] === ' ') cursor++;
        const actual = [];
        while (cursor < accepted.length && actual.length < expected.length) {
            if (accepted[cursor] === ' ') { cursor++; continue; }
            actual.push(accepted[cursor]);
            cursor++;
        }
        const correct = actual.length === expected.length &&
            actual.every((ch, i) => ch === expected[i]);
        const corrections = actual.reduce((n, ch, i) => n + (ch !== expected[i] ? 1 : 0), 0)
            + Math.max(0, expected.length - actual.length);
        recordWordResult(word, correct, corrections, 0);
        while (cursor < accepted.length && accepted[cursor] === ' ') cursor++;
    });
}

// ---- רישום נתונים לפרופיל המשתמש ----
function recordCharResult(ch, correct, dt) {
    const st = appData.charStats[ch] || { attempts: 0, correct: 0, totalMs: 0, errorStreak: 0, lastSeen: null };
    st.attempts++;
    if (correct) { st.correct++; st.errorStreak = 0; } else { st.errorStreak++; }
    if (dt && dt < 5000) st.totalMs += dt;
    st.lastSeen = Date.now();
    appData.charStats[ch] = st;
    if (typeof updateSkillEvidence === 'function') updateSkillEvidence(ch, correct);
    if (typeof pedagogyRecordChar === 'function') pedagogyRecordChar(ch, correct, dt);
    scheduleSaveData();
}

function recordBigramResult(bg, correct, dt) {
    const st = appData.bigramStats[bg] || { attempts: 0, correct: 0, totalMs: 0 };
    st.attempts++;
    if (correct) st.correct++;
    if (dt && dt < 5000) st.totalMs += dt;
    appData.bigramStats[bg] = st;
    if (typeof pedagogyRecordBigram === 'function') pedagogyRecordBigram(bg, correct, dt);
}

function recordErrorPair(expected, typed) {
    const key = expected + '|' + typed;
    appData.errorMatrix[key] = (appData.errorMatrix[key] || 0) + 1;
}

function recordWordResult(word, correct, corrections, dt) {
    const st = appData.wordStats[word] || { attempts: 0, correct: 0, corrections: 0, totalMs: 0 };
    st.attempts++;
    if (correct) st.correct++;
    st.corrections += corrections || 0;
    if (dt) st.totalMs += dt;
    appData.wordStats[word] = st;
    if (typeof pedagogyRecordWord === 'function') pedagogyRecordWord(word, correct, dt);
}

function recordSession(metrics, mode, sessionObj) {
    const entry = {
        date: new Date().toISOString(),
        mode,
        wpm: metrics.wpm,
        netWpm: metrics.netWpm,
        accuracy: metrics.accuracy,
        consistency: metrics.consistency,
        chars: metrics.correct + metrics.incorrect,
        errors: metrics.incorrect,
        durationMs: Math.round(metrics.elapsedMs),
        recentAccuracy: computeRecentAccuracy(),
        targetChars: metrics.targetChars || null,
        lang: (typeof getActiveLanguage === 'function') ? getActiveLanguage() : 'he',
        maxCombo: metrics.maxCombo || 0
    };
    appData.sessions.push(entry);
    // שמור רק 200 המפורטות האחרונות, ותמצת ותיקות יותר לתוך סיכום מצטבר
    if (appData.sessions.length > 200) {
        // sessionSummary already includes every session at creation time.
        // Do not add overflow sessions a second time.
        appData.sessions.splice(0, appData.sessions.length - 200);
    }
    appData.sessionSummary.count++;
    appData.sessionSummary.totalWpm += metrics.wpm;
    appData.sessionSummary.totalAccuracy += metrics.accuracy;
    appData.sessionSummary.totalDurationMs += metrics.elapsedMs || 0;
    const prevBest = appData.sessionSummary.bestWpm || 0;
    const countsForBest = (metrics.correct + metrics.incorrect) >= 25 && metrics.elapsedMs >= 10000;
    if (countsForBest && metrics.netWpm > appData.sessionSummary.bestWpm) appData.sessionSummary.bestWpm = metrics.netWpm;

    const streakBefore = appData.progress.streakDays || 0;
    const prevPracticeDate = appData.progress.lastPracticeDate;
    updateStreak();
    if (typeof processSessionRewards === 'function') {
        processSessionRewards(metrics, mode, { prevBest, countsForBest, streakBefore, prevPracticeDate, session: sessionObj });
    } else {
        updateXp(metrics);
        checkAchievements(metrics);
    }
    scheduleSaveData();
}

function localDateKey(date = new Date()) {
    const y = date.getFullYear();
    const m = String(date.getMonth() + 1).padStart(2, '0');
    const d = String(date.getDate()).padStart(2, '0');
    return `${y}-${m}-${d}`;
}
function updateStreak() {
    const today = localDateKey();
    const last = appData.progress.lastPracticeDate;
    if (last === today) return;
    if (last) {
        const yesterday = new Date();
        yesterday.setHours(12, 0, 0, 0);
        yesterday.setDate(yesterday.getDate() - 1);
        const y = localDateKey(yesterday);
        appData.progress.streakDays = (last === y) ? appData.progress.streakDays + 1 : 1;
    } else {
        appData.progress.streakDays = 1;
    }
    appData.progress.lastPracticeDate = today;
}

// XP, ranks, achievements, personal bests & encouragement: see rewards.js
