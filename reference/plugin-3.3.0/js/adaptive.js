// ---- מנוע לימוד מסתגל ----

// Letters only. (Since 3.0 the layout also holds digits/punctuation for the full
// visual keyboard, so we filter by script instead of excluding a few symbols.)
const ALL_LETTERS = Object.values(KEYBOARD_LAYOUT).filter(c => /[\u05D0-\u05EA]/.test(c));
function isLetterChar(c) { return /^[\u05D0-\u05EAa-zA-Z]$/.test(c); }
const KNOWN_KEYS_STORAGE_ID = 'knownKeys';

// אילו מפתחות "נלמדו" עד כה (לפי התקדמות ברמה 1)
function getKnownKeys() {
    const completed = getCompletedLessons();
    const layout = getCurrentKeyboardLayout();
    const order = getCurrentKeyOrder();
    const introduced = new Set();
    order.forEach((code, idx) => { if (completed.includes(`L1-${idx}`)) introduced.add(layout[code]); });
    if (getActiveLevel() >= 3) return new Set(Object.values(layout).filter(isLetterChar));
    return introduced.size ? introduced : new Set(order.slice(0, 2).map(c => layout[c]));
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

// תרגיל תווים: מדגיש תווים חלשים, אך שומר על תמהיל טבעי מכל התווים הידועים
function generateCharDrill(knownChars, length, weakChars) {
    knownChars = Array.from(knownChars);
    if (!knownChars.length) return '';
    weakChars = weakChars || [];
    const pool = [];
    knownChars.forEach(c => pool.push(c));
    weakChars.forEach(c => { pool.push(c, c); }); // הטיה כפולה לתווים חלשים, בלי להציף
    const groups = [];
    let cur = '';
    for (let i = 0; i < length; i++) {
        cur += randomChoice(pool);
        if (cur.length >= 3 && Math.random() < 0.35) { groups.push(cur); cur = ''; }
    }
    if (cur) groups.push(cur);
    return groups.join(' ');
}

// תרגיל מילים: בוחר ממאגר המילים רק מילים שכל אותיותיהן ידועות
function generateWordDrill(knownChars, bankKey, count) {
    const known = new Set(knownChars);
    const bankSource = isEnglishTyping() ? ENGLISH_WORD_BANK : WORD_BANK;
    const bank = bankSource[bankKey] || bankSource.short;
    const candidates = bank.filter(w => stripNiqud(w).split('').every(ch => known.has(ch) || ch === ' '));
    // If the current vocabulary has no fully-known words, fall back to a
    // filtered word list only when possible; otherwise the character drill
    // fallback below prevents undefined/empty exercises.
    const pool = candidates.length ? candidates : bank.filter(w => stripNiqud(w).split('').some(ch => known.has(ch)));
    const words = [];
    if (!pool.length) return generateCharDrill(known, Math.max(10, count * 4), []);
    for (let i = 0; i < count; i++) words.push(randomChoice(pool));
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
