// ---- מנוע לימוד מסתגל ----

// Letters only. (Since 3.0 the layout also holds digits/punctuation for the full
// visual keyboard, so we filter by script instead of excluding a few symbols.)
const ALL_LETTERS = Object.values(KEYBOARD_LAYOUT).filter(c => /[\u05D0-\u05EA]/.test(c));
function isLetterChar(c) { return /^[\u05D0-\u05EAa-zA-Z]$/.test(c); }
const KNOWN_KEYS_STORAGE_ID = 'knownKeys';

// אילו מפתחות "נלמדו" עד כה (לפי התקדמות ברמה 1)
// 4.1: Level 1 teaches two keys per lesson (ids L1p-0 … L1p-14). Keys a learner
// had already practised under the old one-key-per-lesson order are kept too
// (progress.legacyL1Keys, written once by the migration in storage.js).
function level1LessonId(j) { return `L1p-${j}`; }
function level1LessonCount() { return Math.ceil(getCurrentKeyOrder().length / KEYS_PER_LESSON); }
function level1LessonKeys(j) { return getCurrentKeyOrder().slice(j * KEYS_PER_LESSON, j * KEYS_PER_LESSON + KEYS_PER_LESSON); }
function getKnownKeys() {
    const completed = getCompletedLessons();
    const layout = getCurrentKeyboardLayout();
    const order = getCurrentKeyOrder();
    if (getActiveLevel() >= 3) return new Set(Object.values(layout).filter(isLetterChar));
    const introduced = new Set();
    for (let j = 0; j < level1LessonCount(); j++) {
        if (completed.includes(level1LessonId(j))) level1LessonKeys(j).forEach(c => introduced.add(layout[c]));
    }
    const legacy = (appData.progress.legacyL1Keys || {})[getActiveLanguage()];
    if (Array.isArray(legacy)) legacy.forEach(c => { if (layout[c] != null) introduced.add(layout[c]); });
    return introduced.size ? introduced : new Set(order.slice(0, KEYS_PER_LESSON).map(c => layout[c]));
}

// ציון מיומנות 0-100 לכל תו: משלב דיוק, מהירות יחסית ורצף טעויות
function charMastery(ch) {
    const st = appData.charStats[ch];
    if (!st || st.attempts < 3) return null; // אין מספיק נתונים
    const accuracy = st.correct / st.attempts;
    const avgMs = st.totalMs / Math.max(st.correct, 1);
    const speedScore = Math.max(0, Math.min(1, (900 - avgMs) / 700)); // מהיר יותר = טוב יותר, נורמליזציה גסה
    const streakPenalty = Math.min(1, st.errorStreak * 0.15);
    const score = (accuracy * 0.7 + speedScore * 0.3) * 100 * (1 - streakPenalty);
    return Math.max(0, Math.round(score));
}

// רשימת התווים החלשים ביותר מבין אלו שכבר נלמדו, ממויינים
function getWeakCharacters(limit) {
    const known = getKnownKeys();
    const scored = [];
    known.forEach(ch => {
        const score = charMastery(ch);
        if (score !== null) scored.push({ ch, score, attempts: appData.charStats[ch].attempts });
    });
    scored.sort((a, b) => a.score - b.score);
    return scored.slice(0, limit || 5);
}

function getErrorMatrixTop(limit) {
    const rows = Object.entries(appData.errorMatrix).map(([key, count]) => {
        const [expected, typed] = key.split('|');
        return { expected, typed, count };
    });
    rows.sort((a, b) => b.count - a.count);
    return rows.slice(0, limit || 10);
}


// ---- מצבי שליטה שקופים (mastery state) ----
function getSkillState(ch) {
    const st = appData.charStats[ch];
    if (!st || !st.attempts) return 'NEW';
    const score = charMastery(ch);
    if (score === null) return 'LEARNING';
    const ev = getSkillEvidence(ch);
    if (score < 50 || ev.failures > ev.successes) return 'PRACTICING';
    if (score < 70) return 'DEVELOPING';
    if (score < 85) return 'PROFICIENT';
    if (score < 95 || ev.successes < 3 || ev.retentionChecks < 1) return 'MASTERED';
    return 'MAINTENANCE';
}


// Evidence-based mastery: require repeated successful observations and
// delayed retention before a skill can move to MAINTENANCE.
function getSkillEvidence(ch) {
    const st = appData.charStats[ch];
    const ev = (appData.skillState && appData.skillState[ch]) || {};
    return {
        successes: Number(ev.successes || 0),
        failures: Number(ev.failures || 0),
        lastSuccess: Number(ev.lastSuccess || 0),
        nextReview: Number(ev.nextReview || 0),
        retentionChecks: Number(ev.retentionChecks || 0)
    };
}

function updateSkillEvidence(ch, correct) {
    if (!appData.skillState) appData.skillState = {};
    const ev = getSkillEvidence(ch);
    if (correct) {
        ev.successes++;
        ev.lastSuccess = Date.now();
        const score = charMastery(ch) || 0;
        const intervals = [1, 3, 7, 14, 30];
        const stage = Math.min(intervals.length - 1, Math.max(0, Math.floor(score / 20)));
        ev.nextReview = Date.now() + intervals[stage] * 86400000;
    } else {
        ev.failures++;
        ev.nextReview = Date.now() + 86400000;
    }
    appData.skillState[ch] = ev;
}

function recordRetentionCheck(ch, retained) {
    if (!appData.skillState) appData.skillState = {};
    const ev = getSkillEvidence(ch);
    ev.retentionChecks++;
    if (!retained) {
        ev.failures++;
        ev.nextReview = Date.now() + 86400000;
    }
    appData.skillState[ch] = ev;
}

function getTopErrorPairs(limit) {
    return getErrorMatrixTop(limit || 6);
}

function generateErrorRetrainingDrill(pairs) {
    const out = [];
    (pairs || []).forEach(p => {
        if (!p || !p.expected || !p.typed) return;
        out.push(p.expected + p.typed, p.expected + p.expected, p.typed + p.expected,
                 p.expected + p.typed + p.expected);
    });
    return out.join(' ');
}

function generateTrigramDrill(weakTrigrams) {
    return (weakTrigrams || []).map(t => t.trigram).flatMap(t => [t, t + t, t.slice(1) + t[0] + t.slice(2)]).join(' ');
}

// ---- מחוללי תרגילים ----
function randomChoice(arr) { return arr[Math.floor(Math.random() * arr.length)]; }

// ---- 4.1: "85% rule" difficulty controller ----
// Learning is fastest when practice is hard enough to produce some errors but
// not so hard that it overwhelms (Wilson et al., 2019: ~85% success for binary
// learners; for typing we aim for a 92–96% keystroke-accuracy band). We keep a
// rolling record of the last ~300 practice keystrokes across sessions and nudge
// a single "challenge" value up when accuracy is above the band and down when
// it is below. Generated text reads its word length, share of weak keys and
// transitions, and punctuation from that value. Only the existing
// "challenge level" label exposes it in the UI.
const CHALLENGE_WINDOW = 300;
const CHALLENGE_BAND = { low: 0.92, high: 0.96 };
function challengeState() {
    const d = appData.pedagogy || (appData.pedagogy = {});
    if (!d.challenge || typeof d.challenge !== 'object') d.challenge = { level: 0.3, recent: '', n: 0 };
    const c = d.challenge;
    if (typeof c.recent !== 'string') c.recent = '';
    c.level = Math.max(0, Math.min(1, Number(c.level)));
    if (!isFinite(c.level)) c.level = 0.3;
    return c;
}
function recordChallengeKeystroke(correct) {
    const c = challengeState();
    c.recent = (c.recent + (correct ? '1' : '0')).slice(-CHALLENGE_WINDOW);
    c.n = (Number(c.n) || 0) + 1;
    // re-evaluate every 20 keystrokes once there is a meaningful window
    if (c.recent.length >= 60 && c.n % 20 === 0) {
        const acc = challengeAccuracy();
        if (acc > CHALLENGE_BAND.high) c.level = Math.min(1, c.level + 0.035);
        else if (acc < CHALLENGE_BAND.low) c.level = Math.max(0, c.level - (acc < 0.88 ? 0.07 : 0.045));
        c.updatedAt = Date.now();
    }
}
function challengeAccuracy() {
    const r = challengeState().recent;
    if (!r.length) return null;
    let ok = 0; for (let i = 0; i < r.length; i++) if (r.charCodeAt(i) === 49) ok++;
    return ok / r.length;
}
// Parameters every text generator reads.
function getDifficultyParams() {
    const L = challengeState().level;
    return {
        level: L,
        lenShift: L < 0.25 ? -1 : L > 0.7 ? 1 : 0,           // shorter / longer words than the level's default
        weakShare: 0.15 + 0.35 * L,                           // share of drill picks taken from weak keys
        bigramShare: 0.10 + 0.30 * L,                         // share of words chosen for weak transitions
        punctuation: L < 0.5 ? 0 : (L - 0.5) * 0.3,           // probability of a comma/period after a word
        groupMin: L < 0.3 ? 2 : 3, groupMax: L < 0.3 ? 4 : L < 0.7 ? 5 : 6
    };
}
function challengeLabel(L) {
    return L < 0.25 ? 'מבוקר' : L < 0.55 ? 'מתפתח' : L < 0.8 ? 'מאתגר' : 'מתקדם';
}

// תרגיל תווים: מדגיש תווים חלשים, אך שומר על תמהיל טבעי מכל התווים הידועים
function generateCharDrill(knownChars, length, weakChars) {
    knownChars = Array.from(knownChars).filter(c => c && c !== ' ');
    if (!knownChars.length) return '';
    weakChars = (weakChars || []).filter(c => c && c !== ' ');
    const P = getDifficultyParams();
    const knownSet = new Set(knownChars.concat(weakChars));
    const pick = () => (weakChars.length && Math.random() < P.weakShare) ? randomChoice(weakChars) : randomChoice(knownChars);
    const groups = [];
    let cur = '', target = P.groupMin + Math.floor(Math.random() * (P.groupMax - P.groupMin + 1));
    for (let i = 0; i < length; i++) {
        cur += pick();
        if (cur.length >= target) { groups.push(fixFinalLetters(cur, knownSet)); cur = ''; target = P.groupMin + Math.floor(Math.random() * (P.groupMax - P.groupMin + 1)); }
    }
    if (cur) groups.push(fixFinalLetters(cur, knownSet));
    return groups.join(' ');
}

// Hebrew final forms belong only at the end of a word: a final letter in the
// middle of a drill group becomes its base form when the learner knows it, and a
// base letter at the end becomes its final form when that one is known.
const FINAL_TO_BASE = { 'ם': 'מ', 'ן': 'נ', 'ך': 'כ', 'ף': 'פ', 'ץ': 'צ' };
const BASE_TO_FINAL = { 'מ': 'ם', 'נ': 'ן', 'כ': 'ך', 'פ': 'ף', 'צ': 'ץ' };
function fixFinalLetters(group, known) {
    const chars = Array.from(group);
    if (!chars.some(c => FINAL_TO_BASE[c] || BASE_TO_FINAL[c])) return group;
    const has = c => !known || known.has(c);
    for (let i = 0; i < chars.length - 1; i++) {
        const base = FINAL_TO_BASE[chars[i]];
        if (base) chars[i] = has(base) ? base : '';
    }
    const last = chars[chars.length - 1];
    if (BASE_TO_FINAL[last] && known && known.has(BASE_TO_FINAL[last]) && Math.random() < 0.7) chars[chars.length - 1] = BASE_TO_FINAL[last];
    return chars.join('') || group;
}

// All real words for the curriculum language (word bank + lexicon + frequent words).
let _lexCache = { he: null, en: null };
function curriculumWords() {
    const en = isEnglishTyping(), k = en ? 'en' : 'he';
    if (_lexCache[k]) return _lexCache[k];
    const bank = en ? ENGLISH_WORD_BANK : WORD_BANK;
    const lex = (en ? (typeof ENGLISH_LEXICON !== 'undefined' ? ENGLISH_LEXICON : []) : (typeof HEBREW_LEXICON !== 'undefined' ? HEBREW_LEXICON : []));
    const top = (en ? (typeof ENGLISH_TOP_WORDS !== 'undefined' ? ENGLISH_TOP_WORDS : []) : (typeof HEBREW_TOP_WORDS !== 'undefined' ? HEBREW_TOP_WORDS : []));
    const all = [].concat(bank.short, bank.medium, bank.long, bank.advanced, lex, top).filter(w => w && !/\s/.test(w));
    _lexCache[k] = Array.from(new Set(all));
    return _lexCache[k];
}
function wordUsesOnly(w, known) { return Array.from(stripNiqud(w)).every(ch => known.has(ch)); }

// Pronounceable stand-ins when too few real words can be built from the known keys.
function generatePseudoword(knownChars, mustInclude) {
    const known = Array.from(knownChars).filter(isLetterChar);
    if (!known.length) return '';
    const en = isEnglishTyping();
    const vowels = (en ? ['a', 'e', 'i', 'o', 'u', 'y'] : ['ו', 'י', 'א', 'ה']).filter(v => known.includes(v));
    const cons = known.filter(c => !vowels.includes(c) && !FINAL_TO_BASE[c]);
    const len = 2 + Math.floor(Math.random() * 3);
    const out = [];
    for (let i = 0; i < len; i++) {
        const wantVowel = vowels.length && (en ? i % 2 === 1 : (i % 2 === 1 && Math.random() < 0.6));
        const pool = wantVowel ? vowels : (cons.length ? cons : known.filter(c => !FINAL_TO_BASE[c]));
        out.push(randomChoice(pool.length ? pool : known));
    }
    const inc = (mustInclude || []).filter(c => known.includes(c) && isLetterChar(c));
    if (inc.length && !out.some(c => inc.includes(c))) out[Math.floor(Math.random() * out.length)] = randomChoice(inc);
    return en ? out.join('') : fixFinalLetters(out.join(''), new Set(known));
}

// ---- 4.1: Level 1 lesson text — two new keys, ~40% drills / ~60% real words ----
const PUNCT_KEYS = new Set(['.', ',', ';', '/', "'"]);
function punctuatedWord(p, words) {
    const w = randomChoice(words);
    if (p === '/') {
        if (!isEnglishTyping()) {
            const genderPairs = ['ו/או', 'הוא/היא', 'ילד/ה', 'תלמיד/ה', 'חבר/ה', 'מורה/ים'];
            const fit = genderPairs.filter(x => wordUsesOnly(x.replace('/', ''), new Set(Array.from(curriculumKnownSet()))));
            if (fit.length && Math.random() < 0.6) return randomChoice(fit);
        } else if (Math.random() < 0.5) return 'and/or';
        return w + '/' + randomChoice(words);
    }
    if (p === "'") return w; // geresh words come from the lexicon itself (ג'ינס …)
    return w + p;
}
let _curKnown = null;
function curriculumKnownSet() { return _curKnown || getKnownKeys(); }

function generateLevel1LessonText(j, len) {
    const layout = getCurrentKeyboardLayout();
    const newKeys = level1LessonKeys(j).map(c => layout[c]).filter(c => c != null);
    const prevKeys = getCurrentKeyOrder().slice(0, j * KEYS_PER_LESSON).map(c => layout[c]);
    const known = new Set(prevKeys.concat(newKeys));
    _curKnown = known;
    const P = getDifficultyParams();
    const letters = Array.from(known).filter(isLetterChar);
    const newLetters = newKeys.filter(isLetterChar);
    const prevLetters = prevKeys.filter(isLetterChar);
    const newPunct = newKeys.filter(c => PUNCT_KEYS.has(c));
    const weak = getWeakCharacters(3).map(w => w.ch).filter(c => known.has(c));

    // ---- drills: every group mixes a new key with already-learned keys ----
    const drillGroup = () => {
        const n = P.groupMin + Math.floor(Math.random() * (P.groupMax - P.groupMin + 1));
        const g = [];
        const fresh = newLetters.length ? newLetters : (letters.length ? letters : newKeys);
        const old = prevLetters.length ? prevLetters : fresh;
        for (let i = 0; i < n; i++) {
            const r = Math.random();
            g.push(r < 0.45 ? randomChoice(fresh) : (weak.length && r < 0.45 + P.weakShare * 0.4) ? randomChoice(weak) : randomChoice(old));
        }
        if (!g.some(c => fresh.includes(c))) g[Math.floor(Math.random() * n)] = randomChoice(fresh);
        if (prevLetters.length && !g.some(c => prevLetters.includes(c))) g[Math.floor(Math.random() * n)] = randomChoice(prevLetters);
        let s = isEnglishTyping() ? g.join('') : fixFinalLetters(g.join(''), known);
        if (newPunct.length) {
            const p = randomChoice(newPunct);
            if (p === "'") { const k = Math.max(1, Math.floor(s.length / 2)); s = s.slice(0, k) + "'" + s.slice(k); }
            else if (p === '/') { const k = Math.max(1, Math.floor(s.length / 2)); s = s.slice(0, k) + '/' + s.slice(k); }
            else s += p;
        }
        return s;
    };

    // ---- real words made only from known keys (new keys preferred) ----
    const lenOk = w => { const n = Array.from(w).length; return n >= 2 + Math.min(0, P.lenShift) && n <= 5 + P.lenShift * 2; };
    let words = curriculumWords().filter(w => wordUsesOnly(w, known));
    const withNew = words.filter(w => Array.from(w).some(c => newKeys.includes(c)));
    const sized = words.filter(lenOk);
    if (sized.length >= 6) words = sized;
    const pickWord = (last) => {
        let w;
        for (let tries = 0; tries < 6; tries++) {
            if (newPunct.length && words.length && Math.random() < 0.5) w = punctuatedWord(randomChoice(newPunct), words);
            else if (withNew.length && Math.random() < 0.6) w = randomChoice(withNew);
            else if (words.length >= 4) w = randomChoice(words);
            else w = generatePseudoword(known, newLetters);
            if (w && w !== last) break;
        }
        return w;
    };

    const drillTarget = Math.round(len * 0.4), wordTarget = len - drillTarget;
    const out = [];
    let dLen = 0, wLen = 0, last = '';
    let guard = 0;
    while ((dLen < drillTarget || wLen < wordTarget) && guard++ < 400) {
        // pattern: 1–2 drill groups, then 2–3 words (keeps the ~40/60 split by characters)
        const nd = 1 + (Math.random() < 0.5 ? 1 : 0);
        for (let i = 0; i < nd && dLen < drillTarget; i++) { const g = drillGroup(); out.push(g); dLen += g.length + 1; }
        const nw = 2 + (Math.random() < 0.5 ? 1 : 0);
        for (let i = 0; i < nw && wLen < wordTarget; i++) { const w = pickWord(last); if (!w) break; out.push(w); last = w; wLen += w.length + 1; }
    }
    _curKnown = null;
    return out.join(' ');
}

// ---- 4.1: word-chunk drills (the 100 most frequent words + common affixes) ----
// Per-word typing speed (ms per character) is recorded by the typing engine; a
// frequent word that is still slow compared with the learner's own average is
// brought back more often until it is typed as one fluent movement.
function wordMsPerChar(w) {
    const st = appData.wordStats[w];
    return st && st.timedN >= 2 ? st.timedMs / st.timedN : null;
}
function getSlowCommonWords(limit) {
    const top = isEnglishTyping() ? (typeof ENGLISH_TOP_WORDS !== 'undefined' ? ENGLISH_TOP_WORDS : []) : (typeof HEBREW_TOP_WORDS !== 'undefined' ? HEBREW_TOP_WORDS : []);
    const rows = top.map(w => ({ w, ms: wordMsPerChar(w) })).filter(x => x.ms !== null);
    if (rows.length < 3) return [];
    const avg = rows.reduce((a, r) => a + r.ms, 0) / rows.length;
    return rows.filter(r => r.ms > avg * 1.12).map(r => ({ w: r.w, ms: Math.round(r.ms), ratio: r.ms / avg }))
        .sort((a, b) => b.ratio - a.ratio).slice(0, limit || 8);
}
function generateChunkDrill(length) {
    const en = isEnglishTyping();
    const known = getKnownKeys();
    const top = (en ? ENGLISH_TOP_WORDS : HEBREW_TOP_WORDS).filter(w => wordUsesOnly(w, known));
    const aff = en ? ENGLISH_AFFIX_CHUNKS : HEBREW_AFFIX_CHUNKS;
    if (top.length < 6) return '';
    const slow = getSlowCommonWords(8).map(x => x.w).filter(w => top.includes(w));
    // the most frequent words carry the most weight (the list is ordered by frequency)
    const pickTop = () => {
        if (slow.length && Math.random() < 0.35) return randomChoice(slow);
        const i = Math.floor(Math.pow(Math.random(), 1.6) * top.length);
        return top[i];
    };
    const affWords = [].concat(...aff.prefixes.map(x => x[1]), ...aff.suffixes.map(x => x[1])).filter(w => wordUsesOnly(w, known));
    const clusters = aff.clusters.filter(w => wordUsesOnly(w, known));
    const out = [];
    let n = 0, guard = 0;
    length = Math.max(60, length || 120);
    while (n < length && guard++ < 300) {
        const r = Math.random();
        let chunk;
        if (r < 0.55) { const w = pickTop(); chunk = [w, w]; }                 // a chunk is typed twice: once to find it, once as a unit
        else if (r < 0.8 && affWords.length) chunk = [randomChoice(affWords)];
        else if (clusters.length) { const c = randomChoice(clusters); chunk = [c, c]; }
        else chunk = [pickTop()];
        chunk.forEach(c => { if (c) { out.push(c); n += c.length + 1; } });
    }
    return out.join(' ');
}

// תרגיל מילים: בוחר ממאגר המילים רק מילים שכל אותיותיהן ידועות
// 4.1: word length, weak transitions and punctuation follow the difficulty controller.
const BANK_LENGTH = { short: [2, 3], medium: [3, 5], long: [4, 7], advanced: [5, 10] };
function generateWordDrill(knownChars, bankKey, count) {
    const known = new Set(knownChars);
    const P = getDifficultyParams();
    const bankSource = isEnglishTyping() ? ENGLISH_WORD_BANK : WORD_BANK;
    const bank = bankSource[bankKey] || bankSource.short;
    const range = BANK_LENGTH[bankKey] || BANK_LENGTH.short;
    const lo = Math.max(1, range[0] + P.lenShift), hi = range[1] + P.lenShift * 2;
    const fits = w => stripNiqud(w).split('').every(ch => known.has(ch) || ch === ' ');
    let candidates = bank.filter(fits);
    // widen with the lexicon at the controller's word length
    const extra = curriculumWords().filter(w => { const n = Array.from(w).length; return n >= lo && n <= hi && fits(w); });
    const sized = candidates.concat(extra).filter(w => { const n = Array.from(w.replace(/\s/g, '')).length; return n >= lo && n <= hi; });
    if (sized.length >= 8) candidates = Array.from(new Set(sized));
    else if (candidates.length < 8) candidates = Array.from(new Set(candidates.concat(extra)));
    // If the current vocabulary has no fully-known words, fall back to a
    // filtered word list only when possible; otherwise the character drill
    // fallback below prevents undefined/empty exercises.
    const pool = candidates.length ? candidates : bank.filter(w => stripNiqud(w).split('').some(ch => known.has(ch)));
    if (!pool.length) return generateCharDrill(known, Math.max(10, count * 4), []);
    const weakBg = (typeof getWeakBigrams === 'function' ? getWeakBigrams(6) : []).map(x => x.bg).filter(bg => !/\s/.test(bg));
    const bgWords = weakBg.length ? pool.filter(w => weakBg.some(bg => w.includes(bg))) : [];
    const words = [];
    for (let i = 0; i < count; i++) {
        let w = (bgWords.length && Math.random() < P.bigramShare) ? randomChoice(bgWords) : randomChoice(pool);
        if (P.punctuation && i < count - 1 && Math.random() < P.punctuation) w += Math.random() < 0.7 ? ',' : '.';
        words.push(w);
    }
    return words.join(' ');
}

// מייצר תרגיל בהתאם לרמה הנוכחית, תוך שילוב חולשות אמיתיות מהנתונים
function generateAdaptiveExercise(level) {
    const known = getKnownKeys();
    const weak = getWeakCharacters(4).map(w => w.ch);
    const minLen = Math.max(20, Number(appSettings.practiceLength) || 50);
    if (isEnglishTyping()) {
        if (level <= 1) return generateCharDrill(known, Math.max(24, minLen), weak);
        if (level === 2) return generateCharDrill(known, Math.max(30, minLen), weak);
        if (level === 3) return generateWordDrill(known, 'short', Math.max(8, Math.ceil(minLen / 4)));
        if (level === 4) return generateWordDrill(known, 'medium', Math.max(6, Math.ceil(minLen / 6))) + '. ' + randomChoice(ENGLISH_SENTENCE_BANK);
        if (level === 5) return randomChoice(ENGLISH_PARAGRAPH_BANK);
        if (level === 6) return generateWordDrill(known, 'advanced', Math.max(5, Math.ceil(minLen / 8))) + '. ' + randomChoice(ENGLISH_SENTENCE_BANK);
        return randomChoice(ENGLISH_PARAGRAPH_BANK) + ' ' + randomChoice(ENGLISH_PARAGRAPH_BANK);
    }
    if (level <= 1) return generateCharDrill(known, Math.max(24, minLen), weak);
    if (level === 2) return generateCharDrill(known, Math.max(30, minLen), weak);
    if (level === 3) return generateWordDrill(known, 'short', Math.max(8, Math.ceil(minLen / 4)));
    if (level === 4) return generateWordDrill(known, 'medium', Math.max(6, Math.ceil(minLen / 6))) + '. ' + randomChoice(SENTENCE_BANK);
    if (level === 5) return randomChoice(PARAGRAPH_BANK);
    if (level === 6) return generateWordDrill(known, 'advanced', Math.max(5, Math.ceil(minLen / 8))) + '. ' + randomChoice(SENTENCE_BANK);
    if (level === 7) return applyNiqudSample();
    return randomChoice(PARAGRAPH_BANK) + ' ' + randomChoice(PARAGRAPH_BANK);
}

function applyNiqudSample() {
    // משפטים קצרים עם ניקוד מלא לתרגול קריאה והקלדה
    const samples = [
        'שָׁלוֹם עֲלֵיכֶם', 'בֹּקֶר טוֹב', 'לַיְלָה טוֹב', 'תּוֹדָה רַבָּה לְךָ',
        'מַה שְּׁלוֹמְךָ', 'הַיֶּלֶד קוֹרֵא סֵפֶר', 'אֲנִי אוֹהֵב לִלְמֹד', 'הַשֶּׁמֶשׁ זוֹרַחַת',
        'יוֹם הֻלֶּדֶת שָׂמֵחַ', 'כָּל הַכָּבוֹד', 'בְּרֵאשִׁית בָּרָא אֱלֹהִים', 'הַיָּם כָּחֹל וְגָדוֹל'
    ];
    const pickN = samples.slice().sort(() => Math.random() - 0.5).slice(0, 3);
    return pickN.join(' ');
}

// ---- מעברים מאתגרים (bigrams) ----
// באותה שיטה כמו charMastery, אך למעברי-אותיות: מגלה זוגות אותיות שהמעבר
// ביניהן איטי או שגוי במיוחד, גם כשכל אות בנפרד כבר נשלטת (חלק 18-19 במפרט).
function bigramMastery(bg) {
    const st = appData.bigramStats[bg];
    if (!st || st.attempts < 3) return null;
    const accuracy = st.correct / st.attempts;
    const avgMs = st.totalMs / Math.max(st.correct, 1);
    const speedScore = Math.max(0, Math.min(1, (900 - avgMs) / 700));
    return Math.max(0, Math.round((accuracy * 0.7 + speedScore * 0.3) * 100));
}

function getWeakBigrams(limit) {
    const scored = Object.keys(appData.bigramStats).map(bg => ({ bg, score: bigramMastery(bg), attempts: appData.bigramStats[bg].attempts }))
        .filter(x => x.score !== null);
    scored.sort((a, b) => a.score - b.score);
    return scored.slice(0, limit || 6);
}

// תרגיל ממוקד מעברים: חוזר על כל זוג-אותיות חלש בכמה הקשרים (מבודד, בתוך צירוף, ואז חוזר לתוך תמהיל טבעי)
function generateBigramDrill(weakBigrams) {
    if (!weakBigrams.length) return '';
    const groups = [];
    weakBigrams.forEach(bg => {
        groups.push(bg, bg + bg, bg[1] + bg[0]);
    });
    return groups.join(' ');
}

// ---- חזרה מרווחת (spaced repetition) ----
// הערכה גסה בלי סכימת נתונים נוספת: ככל שאות "בשלה" יותר (ציון מיומנות גבוה),
// המרווח עד לחזרה הבאה מתארך. זו אינה מערכת SM-2 מלאה, אך מספיקה כדי להימנע
// ממצב שבו אות "מסתיימת" לצמיתות אחרי הצלחה חד-פעמית (חלק 9-11 במפרט).
const REVIEW_INTERVALS_MS = [1, 3, 7, 14, 30].map(d => d * 86400000);

function getDueForReview(limit) {
    const known = getKnownKeys();
    const now = Date.now();
    const due = [];
    known.forEach(ch => {
        const st = appData.charStats[ch];
        if (!st || st.attempts < 3 || !st.lastSeen) return;
        const ev = getSkillEvidence(ch);
        const mastery = charMastery(ch) || 0;
        const fallbackStage = Math.min(REVIEW_INTERVALS_MS.length - 1, Math.floor(mastery / 20));
        const dueAt = ev.nextReview || (st.lastSeen + REVIEW_INTERVALS_MS[fallbackStage]);
        if (now >= dueAt) {
            due.push({ ch, mastery, overdueMs: now - dueAt, state: getSkillState(ch) });
        }
    });
    due.sort((a, b) => b.overdueMs - a.overdueMs);
    return due.slice(0, limit || 10);
}

// ---- תרגול לפי זמן פנוי (מיקרו-שיעור) ----
const MICRO_LESSON_MINUTES = [2, 5, 10, 15, 20, 30];

// כ-40 תווים לדקה היא הערכה שמרנית לתלמיד בתחילת הדרך (כולל זמן חשיבה),
// ולא קצב יעד — המטרה היא רק לגזור אורך תרגיל סביר לזמן שיש לתלמיד.
const ESTIMATED_CHARS_PER_MINUTE = 40;

function buildMicroLesson(minutes) {
    const known = getKnownKeys();
    const weak = getWeakCharacters(4).map(w => w.ch);
    const due = getDueForReview(6).map(d => d.ch);
    const reviewChars = Array.from(new Set(due.concat(weak)));
    const approxChars = Math.max(20, Math.round(minutes * ESTIMATED_CHARS_PER_MINUTE));

    const warmupLen = Math.round(approxChars * 0.15);
    const reviewLen = reviewChars.length ? Math.round(approxChars * 0.35) : 0;
    const mainLen = Math.max(10, approxChars - warmupLen - reviewLen);

    const parts = [];
    if (warmupLen > 0) parts.push(generateCharDrill(known, warmupLen, []));
    if (reviewLen > 0) parts.push(generateCharDrill(known, reviewLen, reviewChars));
    const level = Math.max(1, getActiveLevel());
    const main = level >= 3 ? generateWordDrill(known, level >= 6 ? 'advanced' : (level >= 4 ? 'medium' : 'short'), Math.max(3, Math.round(mainLen / 5)))
                             : generateCharDrill(known, mainLen, weak);
    parts.push(main);
    return parts.filter(Boolean).join('  ');
}

// המלצה טקסטואלית לאחר תרגיל, מבוססת נתונים
function buildRecommendation() {
    const weak = getWeakCharacters(3);
    if (!weak.length) return t('המשך לתרגל — עדיין אוספים מספיק נתונים כדי לזהות נקודות לשיפור.', 'Keep practicing — still collecting enough data to spot areas to improve.');
    const names = weak.map(w => w.ch).join(', ');
    return t(`החולשה הבולטת כרגע היא באותיות: ${names}. מומלץ לתרגל אותן עוד קצת.`, `Your weakest letters right now: ${names}. A little extra practice on them is recommended.`);
}

// Language-aware curriculum helpers. UI language and lesson language are deliberately separate.
function isEnglishTyping() { return !!appSettings.englishTypingEnabled; }
function getCurrentKeyboardLayout() { return isEnglishTyping() ? ENGLISH_LAYOUT : KEYBOARD_LAYOUT; }
function getCurrentCharMap() { return isEnglishTyping() ? ENGLISH_CHAR_TO_KEYCODE : CHAR_TO_KEYCODE; }
function getCurrentKeyOrder() { return isEnglishTyping() ? ENGLISH_KEY_ORDER : LEVEL1_KEY_ORDER; }
