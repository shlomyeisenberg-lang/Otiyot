// ---- 3.0: Rewards, encouragement & motivation ----
// XP + ranks, a large achievement set, personal bests, the daily goal, toasts,
// and the encouraging messages shown during and after practice.

// ---------- XP & ranks ----------
// Cumulative XP to *reach* level L is 50·(L-1)·L → L2=100, L3=300, L5=1000, L10=4500.
function levelFromXp(xp) { let l = 1; while ((Number(xp) || 0) >= 50 * l * (l + 1)) l++; return l; }
function xpForLevel(l) { return 50 * (l - 1) * l; }
const RANKS = [
    { min: 1, icon: '🐣', he: 'מתחיל', en: 'Beginner' },
    { min: 3, icon: '🌱', he: 'חניך', en: 'Apprentice' },
    { min: 5, icon: '✏️', he: 'מתלמד', en: 'Learner' },
    { min: 8, icon: '⌨️', he: 'מקליד', en: 'Typist' },
    { min: 12, icon: '🎯', he: 'מקליד מדויק', en: 'Precise Typist' },
    { min: 16, icon: '⚡', he: 'מקליד מהיר', en: 'Fast Typist' },
    { min: 21, icon: '🏅', he: 'מומחה', en: 'Expert' },
    { min: 27, icon: '🏆', he: 'אמן ההקלדה', en: 'Typing Master' },
    { min: 35, icon: '👑', he: 'אגדת מקלדת', en: 'Keyboard Legend' }
];
function rankForLevel(level) { let r = RANKS[0]; RANKS.forEach(x => { if (level >= x.min) r = x; }); return r; }
function getXpProgress() {
    const xp = Number(appData.progress.xp) || 0;
    const level = levelFromXp(xp);
    const base = xpForLevel(level), next = xpForLevel(level + 1);
    return { xp, level, into: xp - base, needed: next - base, pct: Math.round((xp - base) / (next - base) * 100), rank: rankForLevel(level) };
}
function rankLabel(r) { return r.icon + ' ' + t(r.he, r.en); }
function awardXp(amount) {
    amount = Math.max(0, Math.round(amount || 0));
    const before = levelFromXp(appData.progress.xp || 0);
    appData.progress.xp = (Number(appData.progress.xp) || 0) + amount;
    const after = levelFromXp(appData.progress.xp);
    if (after > before) celebrateLevelUp(after);
    scheduleSaveData();
    return { amount, before, after };
}
// Kept for backwards compatibility (old callers).
function updateXp(metrics) { return awardXp((metrics.correct || 0) + (metrics.accuracy >= 95 ? 10 : 0)).amount; }

// ---------- daily goal ----------
function getDailyGoalMinutes() { return Math.max(1, Number(appSettings.dailyLimitMinutes) || Number(appData.goals && appData.goals.dailyMinutes) || 15); }
function getTodayMinutes() { return (typeof getTodayPracticeMs === 'function' ? getTodayPracticeMs() : 0) / 60000; }

// ---------- counters ----------
function counters() {
    if (!appData.progress.counters || typeof appData.progress.counters !== 'object') appData.progress.counters = {};
    const c = appData.progress.counters;
    ['tests', 'customs', 'games', 'niqud', 'english', 'longSessions', 'perfectRuns'].forEach(k => { c[k] = Number(c[k]) || 0; });
    if (!Array.isArray(appData.progress.goalDays)) appData.progress.goalDays = [];
    if (!appData.progress.bests || typeof appData.progress.bests !== 'object') appData.progress.bests = {};
    if (!appData.progress.lessonBest || typeof appData.progress.lessonBest !== 'object') appData.progress.lessonBest = { he: {}, en: {} };
    if (!appData.progress.games || typeof appData.progress.games !== 'object') appData.progress.games = {};
    return c;
}
function totalCorrectChars() { return Object.values(appData.charStats || {}).reduce((a, c) => a + (c.correct || 0), 0); }
function totalLessonsDone() { const by = appData.progress.completedLessonsByLanguage || {}; return (by.he || []).length + (by.en || []).length; }
function threeStarCount() { counters(); const lb = appData.progress.lessonBest; return ['he', 'en'].reduce((n, l) => n + Object.values(lb[l] || {}).filter(x => x.stars >= 3).length, 0); }
function hebrewLettersDone() {
    const done = (appData.progress.completedLessonsByLanguage || {}).he || [];
    return LEVEL1_KEY_ORDER.every((c, i) => done.includes(`L1-${i}`));
}

// ---------- achievements ----------
const A = (id, icon, he, en, dhe, den, test, progress) => ({ id, icon, label: he, he, en, dhe, den, test, progress });
const ACHIEVEMENT_DEFS = [
    A('first', '🐣', 'צעד ראשון', 'First step', 'סיימו תרגיל ראשון', 'Finish your first exercise', (m, d) => d.sessionSummary.count >= 1),
    A('wpm10', '🚲', '10 מ״לד', '10 WPM', 'הקלידו 10 מילים לדקה', 'Reach 10 net WPM', (m, d, c) => c.countsForBest && m.netWpm >= 10),
    A('wpm20', '🛴', 'מהירות 20 מ״לד', '20 WPM', 'הקלידו 20 מילים לדקה', 'Reach 20 net WPM', (m, d, c) => c.countsForBest && m.netWpm >= 20),
    A('wpm30', '🏃', '30 מ״לד', '30 WPM', 'הקלידו 30 מילים לדקה', 'Reach 30 net WPM', (m, d, c) => c.countsForBest && m.netWpm >= 30),
    A('wpm40', '🚗', 'מהירות 40 מ״לד', '40 WPM', 'הקלידו 40 מילים לדקה', 'Reach 40 net WPM', (m, d, c) => c.countsForBest && m.netWpm >= 40),
    A('wpm50', '🏎️', '50 מ״לד', '50 WPM', 'הקלידו 50 מילים לדקה', 'Reach 50 net WPM', (m, d, c) => c.countsForBest && m.netWpm >= 50),
    A('wpm60', '🚀', '60 מ״לד', '60 WPM', 'הקלידו 60 מילים לדקה', 'Reach 60 net WPM', (m, d, c) => c.countsForBest && m.netWpm >= 60),
    A('wpm80', '⚡', '80 מ״לד', '80 WPM', 'הקלידו 80 מילים לדקה', 'Reach 80 net WPM', (m, d, c) => c.countsForBest && m.netWpm >= 80),
    A('wpm100', '🌠', '100 מ״לד', '100 WPM', 'מועדון ה-100!', 'The 100 club!', (m, d, c) => c.countsForBest && m.netWpm >= 100),
    A('acc95', '🎯', 'דיוק 95%', '95% accuracy', 'תרגיל עם 95% דיוק ומעלה', 'An exercise at 95%+', (m) => m.accuracy >= 95 && (m.correct + m.incorrect) >= 20),
    A('acc99', '💎', 'דיוק 99%', '99% accuracy', 'תרגיל עם 99% דיוק ומעלה', 'An exercise at 99%+', (m) => m.accuracy >= 99 && (m.correct + m.incorrect) >= 30),
    A('perfect', '👑', 'ביצוע מושלם', 'Flawless', '100% דיוק בתרגיל של 50 תווים ומעלה', '100% on 50+ characters', (m) => m.incorrect === 0 && m.correct >= 50),
    A('perfect10', '🏵️', 'עשרה מושלמים', 'Ten flawless', '10 תרגילים ללא שגיאה', '10 flawless exercises', (m, d) => counters().perfectRuns >= 10, () => [counters().perfectRuns, 10]),
    A('streak3', '🔥', '3 ימים ברצף', '3-day streak', 'תרגלו 3 ימים רצופים', 'Practice 3 days in a row', (m, d) => d.progress.streakDays >= 3, (d) => [d.progress.streakDays, 3]),
    A('streak7', '🔥', '7 ימים ברצף', '7-day streak', 'שבוע שלם של תרגול', 'A full week', (m, d) => d.progress.streakDays >= 7, (d) => [d.progress.streakDays, 7]),
    A('streak14', '🔥', '14 ימים ברצף', '14-day streak', 'שבועיים ברצף', 'Two weeks straight', (m, d) => d.progress.streakDays >= 14, (d) => [d.progress.streakDays, 14]),
    A('streak30', '🌋', '30 ימים ברצף', '30-day streak', 'חודש שלם של התמדה', 'A whole month', (m, d) => d.progress.streakDays >= 30, (d) => [d.progress.streakDays, 30]),
    A('streak100', '☄️', '100 ימים ברצף', '100-day streak', 'התמדה אגדית', 'Legendary persistence', (m, d) => d.progress.streakDays >= 100, (d) => [d.progress.streakDays, 100]),
    A('chars1000', '📝', '1000 תווים נכונים', '1,000 characters', 'הקלידו 1,000 תווים נכונים', 'Type 1,000 correct characters', () => totalCorrectChars() >= 1000, () => [totalCorrectChars(), 1000]),
    A('chars10k', '📚', '10,000 תווים', '10,000 characters', 'הקלידו 10,000 תווים נכונים', 'Type 10,000 correct characters', () => totalCorrectChars() >= 10000, () => [totalCorrectChars(), 10000]),
    A('chars50k', '🏛️', '50,000 תווים', '50,000 characters', 'הקלידו 50,000 תווים נכונים', 'Type 50,000 correct characters', () => totalCorrectChars() >= 50000, () => [totalCorrectChars(), 50000]),
    A('chars100k', '🗿', '100,000 תווים', '100,000 characters', 'מאה אלף תווים נכונים!', 'One hundred thousand!', () => totalCorrectChars() >= 100000, () => [totalCorrectChars(), 100000]),
    A('combo50', '⛓️', 'רצף 50', '50 combo', '50 הקלדות נכונות ברצף', '50 correct keys in a row', (m) => (m.maxCombo || 0) >= 50),
    A('combo100', '🔗', 'רצף 100', '100 combo', '100 הקלדות נכונות ברצף', '100 correct keys in a row', (m) => (m.maxCombo || 0) >= 100),
    A('combo250', '🧲', 'רצף 250', '250 combo', '250 הקלדות נכונות ברצף', '250 correct keys in a row', (m) => (m.maxCombo || 0) >= 250),
    A('lessons10', '🎓', '10 שיעורים', '10 lessons', 'עברו 10 שיעורים', 'Pass 10 lessons', () => totalLessonsDone() >= 10, () => [totalLessonsDone(), 10]),
    A('lessons30', '🎓', '30 שיעורים', '30 lessons', 'עברו 30 שיעורים', 'Pass 30 lessons', () => totalLessonsDone() >= 30, () => [totalLessonsDone(), 30]),
    A('lessons60', '🧑‍🎓', '60 שיעורים', '60 lessons', 'עברו 60 שיעורים', 'Pass 60 lessons', () => totalLessonsDone() >= 60, () => [totalLessonsDone(), 60]),
    A('letters_all', '🔤', 'כל האותיות', 'Every letter', 'השלימו את כל שיעורי האותיות בעברית', 'Finish every Hebrew letter lesson', () => hebrewLettersDone()),
    A('stars5', '⭐', '5 שיעורים בשלושה כוכבים', 'Five 3-star lessons', 'קבלו ⭐⭐⭐ ב-5 שיעורים', 'Get ⭐⭐⭐ on 5 lessons', () => threeStarCount() >= 5, () => [threeStarCount(), 5]),
    A('stars20', '🌟', '20 שיעורים בשלושה כוכבים', 'Twenty 3-star lessons', 'קבלו ⭐⭐⭐ ב-20 שיעורים', 'Get ⭐⭐⭐ on 20 lessons', () => threeStarCount() >= 20, () => [threeStarCount(), 20]),
    A('marathon', '⏱️', 'מרתון', 'Marathon', 'תרגיל אחד של 10 דקות ומעלה', 'One exercise of 10+ minutes', (m) => m.elapsedMs >= 600000),
    A('goal1', '✅', 'יעד יומי', 'Daily goal', 'השלימו את יעד התרגול היומי', 'Reach your daily goal', () => counters() && appData.progress.goalDays.length >= 1),
    A('goal7', '📅', '7 ימי יעד', '7 goal days', 'השלימו את היעד היומי ב-7 ימים', 'Reach the daily goal on 7 days', () => counters() && appData.progress.goalDays.length >= 7, () => [appData.progress.goalDays.length, 7]),
    A('goal30', '🗓️', '30 ימי יעד', '30 goal days', 'השלימו את היעד היומי ב-30 ימים', 'Reach the daily goal on 30 days', () => counters() && appData.progress.goalDays.length >= 30, () => [appData.progress.goalDays.length, 30]),
    A('early', '🌅', 'משכימי קום', 'Early bird', 'תרגול לפני 7:00 בבוקר', 'Practice before 7am', () => new Date().getHours() < 7),
    A('night', '🦉', 'ינשוף לילה', 'Night owl', 'תרגול אחרי 22:00', 'Practice after 10pm', () => new Date().getHours() >= 22),
    A('comeback', '💪', 'חזרה מנצחת', 'Comeback', 'חזרתם לתרגל אחרי הפסקה של 3 ימים ומעלה', 'Back after a 3+ day break', (m, d, c) => !!c.cameBack),
    A('test1', '🧪', 'מבחן ראשון', 'First test', 'השלימו מבחן הקלדה', 'Complete a typing test', () => counters().tests >= 1),
    A('test10', '🔬', '10 מבחנים', '10 tests', 'השלימו 10 מבחני הקלדה', 'Complete 10 typing tests', () => counters().tests >= 10, () => [counters().tests, 10]),
    A('custom1', '✍️', 'טקסט משלי', 'My own text', 'תרגלו טקסט אישי', 'Practice a custom text', () => counters().customs >= 1),
    A('niqud', '🔡', 'מנקד', 'Niqqud', 'השלימו תרגול עם ניקוד', 'Complete a niqqud exercise', () => counters().niqud >= 1),
    A('english', '🔠', 'דו-לשוני', 'Bilingual', 'תרגלו הקלדה באנגלית', 'Practice English typing', () => counters().english >= 1),
    A('game1', '🎮', 'שחקן', 'Gamer', 'שחקו במשחק הקלדה', 'Play a typing game', () => counters().games >= 1),
    A('rain500', '🌧️', '500 במטר המילים', 'Word Rain 500', 'השיגו 500 נקודות במטר המילים', 'Score 500 in Word Rain', () => (appData.progress.games.rainBest || 0) >= 500),
    A('rain2000', '⛈️', '2000 במטר המילים', 'Word Rain 2000', 'השיגו 2000 נקודות במטר המילים', 'Score 2000 in Word Rain', () => (appData.progress.games.rainBest || 0) >= 2000),
    A('galaxy1000', '🚀', 'טייס חלל', 'Space pilot', 'השיגו 1,000 נקודות בגלקסיית המילים', 'Score 1,000 in Word Galaxy', () => (appData.progress.games.galaxyBest || 0) >= 1000),
    A('galaxy10k', '🌌', 'מפקד הגלקסיה', 'Galaxy commander', 'השיגו 10,000 נקודות בגלקסיית המילים', 'Score 10,000 in Word Galaxy', () => (appData.progress.games.galaxyBest || 0) >= 10000),
    A('galaxyBoss', '👾', 'מביס ספינת־האם', 'Mothership slayer', 'הביסו ספינת־אם', 'Defeat a mothership', () => ((appData.progress.games3d || {}).stats || {}).galaxyBosses >= 1),
    A('sefarim50', '📚', 'אוהב ספרים', 'Book lover', 'תפסו 50 ספרים בהיכל הספרים', 'Catch 50 sefarim in the Hall of Sefarim', () => (((appData.progress.games3d || {}).stats || {}).sefarimCaught || 0) >= 50),
    A('siyum1', '🎉', 'סיום ראשון', 'First Siyum', 'השלימו קטגוריה שלמה בהיכל הספרים', 'Complete a whole category in the Hall of Sefarim', () => (((appData.progress.games3d || {}).stats || {}).siyumCount || 0) >= 1),
    A('siyum5', '🏛️', 'בעל סיומים', 'Five Siyums', 'השלימו 5 סיומים', 'Complete 5 Siyums', () => (((appData.progress.games3d || {}).stats || {}).siyumCount || 0) >= 5),
    A('raceWin', '🏎️', 'מנצח המרוץ', 'Race winner', 'סיימו במקום הראשון במרוץ ההקלדה', 'Finish 1st in the Typing Grand Prix', () => (((appData.progress.games3d || {}).stats || {}).raceWins || 0) >= 1),
    A('raceWin10', '🏆', 'אלוף המסלול', 'Track champion', 'נצחו 10 מרוצים', 'Win 10 races', () => (((appData.progress.games3d || {}).stats || {}).raceWins || 0) >= 10),
    A('arena100', '🔨', 'מכה במקום', 'On the spot', 'פגעו ב-100 מקשים בזירת המקשים', 'Hit 100 keys in the Key Arena', () => (((appData.progress.games3d || {}).stats || {}).arenaHits || 0) >= 100),
    A('arenaFast', '⚡', 'תגובת ברק', 'Lightning reflexes', 'פגעו במקש תוך פחות מ-0.4 שניות', 'Hit a key in under 0.4 seconds', () => (((appData.progress.games3d || {}).stats || {}).arenaBestRt || 99999) < 400),
    A('arenaChain', '🔗', 'מסלול מילים', 'Word path', 'השלימו 5 מסלולי מילים בזירה', 'Complete 5 word paths in the arena', () => (((appData.progress.games3d || {}).stats || {}).arenaChains || 0) >= 5),
    A('tower25', '🏢', 'בונה גורדי שחקים', 'Skyscraper builder', 'בנו מגדל של 25 קומות', 'Build a 25-floor tower', () => (((appData.progress.games3d || {}).stats || {}).towerBest || 0) >= 25),
    A('tower60', '🌌', 'עד הכוכבים', 'To the stars', 'בנו מגדל של 60 קומות', 'Build a 60-floor tower', () => (((appData.progress.games3d || {}).stats || {}).towerBest || 0) >= 60),
    A('towerPerfect', '🎯', 'יד יציבה', 'Steady hand', '100 נחיתות מושלמות במגדל הדיוק', '100 perfect landings in the Tower of Precision', () => (((appData.progress.games3d || {}).stats || {}).towerPerfect || 0) >= 100),
    A('level5', '✏️', 'רמה 5', 'Level 5', 'הגיעו לרמת ניסיון 5', 'Reach XP level 5', () => levelFromXp(appData.progress.xp) >= 5),
    A('level10', '🎖️', 'רמה 10', 'Level 10', 'הגיעו לרמת ניסיון 10', 'Reach XP level 10', () => levelFromXp(appData.progress.xp) >= 10),
    A('level20', '🏆', 'רמה 20', 'Level 20', 'הגיעו לרמת ניסיון 20', 'Reach XP level 20', () => levelFromXp(appData.progress.xp) >= 20)
];
function achievementLabel(a) { return t(a.he, a.en); }
function checkAchievements(metrics, ctx) {
    counters();
    metrics = metrics || { netWpm: 0, wpm: 0, accuracy: 0, correct: 0, incorrect: 0, elapsedMs: 0, maxCombo: 0 };
    ctx = ctx || {};
    const newly = [];
    ACHIEVEMENT_DEFS.forEach(a => {
        if (appData.achievements.includes(a.id)) return;
        let ok = false;
        try { ok = !!a.test(metrics, appData, ctx); } catch (e) { ok = false; }
        if (ok) { appData.achievements.push(a.id); newly.push(a); }
    });
    newly.forEach((a, i) => setTimeout(() => {
        showToast({ icon: a.icon, title: t('הישג חדש!', 'Achievement unlocked!'), text: achievementLabel(a), kind: 'achv' });
        playSound('achievement');
    }, 400 + i * 700));
    if (newly.length) awardXp(newly.length * 15);
    return newly;
}

// ---------- the main per-session hook (called from recordSession) ----------
let lastSessionRewards = null;
function processSessionRewards(metrics, mode, info) {
    const c = counters();
    const before = levelFromXp(appData.progress.xp || 0);
    const pbs = [];
    // XP: correct characters, scaled by accuracy (accuracy matters more than raw volume)
    const accF = Math.pow(Math.max(0, metrics.accuracy) / 100, 2);
    let xp = Math.round((metrics.correct || 0) * accF);
    if (metrics.accuracy >= 98) xp += 20; else if (metrics.accuracy >= 95) xp += 10;
    // personal bests
    if (info.countsForBest && info.prevBest > 0 && metrics.netWpm > info.prevBest) {
        pbs.push({ icon: '🏁', he: `שיא מהירות חדש: ${metrics.netWpm} מ״לד (קודם ${info.prevBest})`, en: `New speed record: ${metrics.netWpm} WPM (was ${info.prevBest})` });
        xp += 25;
    }
    const b = appData.progress.bests;
    if ((metrics.maxCombo || 0) >= 20 && metrics.maxCombo > (b.combo || 0)) {
        if ((b.combo || 0) > 0) pbs.push({ icon: '🔥', he: `שיא רצף חדש: ${metrics.maxCombo}`, en: `New combo record: ${metrics.maxCombo}` });
        b.combo = metrics.maxCombo;
    }
    if (mode === 'test' && info.session && info.session.durationLimitMs) {
        const key = 't' + Math.round(info.session.durationLimitMs / 1000);
        b.tests = b.tests || {};
        if (metrics.netWpm > (b.tests[key] || 0)) {
            if (b.tests[key]) pbs.push({ icon: '🧪', he: `שיא חדש במבחן הזה: ${metrics.netWpm} מ״לד`, en: `New best on this test: ${metrics.netWpm} WPM` });
            b.tests[key] = metrics.netWpm;
        }
    }
    // counters
    if (mode === 'test') c.tests++;
    if (mode === 'custom') c.customs++;
    if (mode === 'game') c.games++;
    if (info.session && info.session.niqud) c.niqud++;
    if (getActiveLanguage() === 'en') c.english++;
    if (metrics.incorrect === 0 && metrics.correct >= 30) c.perfectRuns++;
    // first session of the day → streak bonus
    const today = localDateKey();
    let streakBonus = 0;
    if (appData.progress.lastBonusDay !== today) {
        appData.progress.lastBonusDay = today;
        streakBonus = 5 * Math.min(10, appData.progress.streakDays || 1);
        xp += streakBonus;
    }
    // daily goal
    let goalReached = false;
    if (getTodayMinutes() >= getDailyGoalMinutes() && !appData.progress.goalDays.includes(today)) {
        appData.progress.goalDays.push(today);
        if (appData.progress.goalDays.length > 800) appData.progress.goalDays.splice(0, appData.progress.goalDays.length - 800);
        goalReached = true;
        xp += 30;
        setTimeout(() => {
            showToast({ icon: '🎯', title: t('היעד היומי הושלם!', 'Daily goal complete!'), text: t('כל הכבוד על ההתמדה 🎉', 'Great consistency 🎉'), kind: 'goal' });
            playSound('achievement');
        }, 250);
    }
    const prevDate = info.prevPracticeDate;
    const cameBack = !!(prevDate && (Date.now() - new Date(prevDate + 'T12:00:00').getTime()) >= 3 * 86400000);
    const gained = awardXp(xp);
    const newAch = checkAchievements(metrics, { countsForBest: info.countsForBest, cameBack });
    lastSessionRewards = {
        xpGained: gained.amount, streakBonus, levelBefore: before, levelAfter: levelFromXp(appData.progress.xp),
        newAchievements: newAch, personalBests: pbs, goalReached, mode
    };
    if (pbs.length) setTimeout(() => playSound('record'), 600);
    refreshHeaderStatus();
    return lastSessionRewards;
}

// ---------- lesson stars ----------
function computeLessonStars(metrics, passed) {
    if (!passed) return 0;
    if (metrics.accuracy >= 99) return 3;
    if (metrics.accuracy >= 98) return 2;
    return 1;
}
function recordLessonBest(lessonId, metrics, stars) {
    counters();
    const lang = getActiveLanguage();
    const lb = appData.progress.lessonBest;
    if (!lb[lang]) lb[lang] = {};
    const prev = lb[lang][lessonId] || { stars: 0, wpm: 0, acc: 0, runs: 0 };
    const wpmVal = metrics.netWpm || 0;
    const improved = { stars: stars > prev.stars, wpm: prev.runs > 0 && wpmVal > prev.wpm };
    lb[lang][lessonId] = { stars: Math.max(prev.stars, stars), wpm: Math.max(prev.wpm, wpmVal), acc: Math.max(prev.acc, metrics.accuracy), runs: (prev.runs || 0) + 1, at: Date.now() };
    scheduleSaveData();
    checkAchievements(metrics, {});
    return { prev, improved };
}
function getLessonBest(lessonId) { counters(); const lb = appData.progress.lessonBest[getActiveLanguage()] || {}; return lb[lessonId] || null; }
function starsHtml(n, max) { max = max || 3; let h = ''; for (let i = 1; i <= max; i++) h += `<span class="star${i <= n ? ' on' : ''}">★</span>`; return `<span class="stars">${h}</span>`; }

// ---------- encouragement ----------
const ENCOURAGE = {
    perfect: [['מושלם! ביצוע נקי לגמרי 👑', 'Perfect! A completely clean run 👑'], ['וואו! אפס טעויות — האצבעות שלכם יודעות את הדרך ✨', 'Wow! Zero mistakes — your fingers know the way ✨'], ['ככה נראית שליטה אמיתית 💎', 'This is what real mastery looks like 💎']],
    great: [['כל הכבוד! עבודה מדויקת ומהירה 💪', 'Great job! Accurate and fast 💪'], ['מצוין — רואים את ההתקדמות! 🌟', 'Excellent — the progress shows! 🌟'], ['יפה מאוד! ככה בונים מיומנות שנשארת 🧱', 'Very nice! This is how lasting skill is built 🧱']],
    good: [['עבודה טובה! עוד קצת דיוק ואתם שם 👍', 'Good work! A bit more accuracy and you\'re there 👍'], ['התקדמות יפה — תמשיכו בדיוק ככה 🚶', 'Nice progress — keep going just like this 🚶'], ['טוב מאוד! נסו לשמור על קצב אחיד 🎵', 'Very good! Try to keep an even rhythm 🎵']],
    ok: [['לא רע בכלל! האטו מעט, והדיוק יעלה מעצמו 🐢', 'Not bad at all! Slow down a little and accuracy will follow 🐢'], ['כל תרגול מקרב אתכם — ממשיכים! 🌱', 'Every exercise brings you closer — keep going! 🌱']],
    struggle: [['זה בסדר לטעות — ככה לומדים! נסו שוב, לאט ובנחת 🌱', 'Mistakes are how we learn! Try again, slowly and calmly 🌱'], ['אל תוותרו! כל מקליד מהיר התחיל בדיוק מכאן 💪', 'Don\'t give up! Every fast typist started right here 💪'], ['נשימה עמוקה, אצבעות על שורת הבית, ומתחילים שוב 🙂', 'Deep breath, fingers on the home row, and go again 🙂']]
};
function pick(arr) { return arr[Math.floor(Math.random() * arr.length)]; }
function encouragementFor(metrics) {
    const acc = metrics.accuracy;
    const tier = (metrics.incorrect === 0 && metrics.correct >= 20) || acc >= 99.5 ? 'perfect' : acc >= 97 ? 'great' : acc >= 93 ? 'good' : acc >= 85 ? 'ok' : 'struggle';
    const [he, en] = pick(ENCOURAGE[tier]);
    let extra = '';
    const recent = (appData.sessions || []).slice(-6, -1).filter(s => (s.chars || 0) >= 20);
    if (recent.length >= 3) {
        const avg = recent.reduce((a, s) => a + (s.netWpm || 0), 0) / recent.length;
        if (metrics.netWpm >= avg * 1.1 && metrics.netWpm >= 5) extra = t(' · מהר יותר מהממוצע האחרון שלכם 📈', ' · Faster than your recent average 📈');
        const avgAcc = recent.reduce((a, s) => a + (s.accuracy || 0), 0) / recent.length;
        if (!extra && acc >= avgAcc + 2) extra = t(' · מדויק יותר מהממוצע שלכם 🎯', ' · More accurate than your average 🎯');
    }
    return { tier, text: t(he, en) + extra };
}
// a short coaching tip derived from the run itself
function coachTipFor(session, metrics) {
    if (!session) return '';
    const errs = session.errors || [];
    if (errs.length >= 3) {
        const pairs = {};
        errs.forEach(e => { const k = e.expected + '→' + e.typed; pairs[k] = (pairs[k] || 0) + 1; });
        const top = Object.entries(pairs).sort((a, b) => b[1] - a[1])[0];
        if (top && top[1] >= 2) {
            const [exp, typed] = top[0].split('→');
            const re = resolveKeyForChar(exp), rt = resolveKeyForChar(typed);
            const fe = re && KEY_TO_FINGER[re.code], ft = rt && KEY_TO_FINGER[rt.code];
            const show = c => c === ' ' ? '␣' : c;
            if (fe && ft && fe === ft) return t(`טיפ: בלבלתם ${top[1]} פעמים בין "${show(exp)}" ל"${show(typed)}" — אותה אצבע (${fingerName(fe)}). הקפידו לחזור לשורת הבית אחרי כל הקשה.`, `Tip: you mixed up "${show(exp)}" and "${show(typed)}" ${top[1]} times — same finger (${fingerName(fe)}). Return to the home row after every press.`);
            if (fe && ft && HAND_OF_FINGER[fe] !== HAND_OF_FINGER[ft]) return t(`טיפ: "${show(exp)}" ו"${show(typed)}" נמצאים בידיים שונות — נסו להאט ולחשוב על היד הנכונה.`, `Tip: "${show(exp)}" and "${show(typed)}" are on different hands — slow down and think of the right hand.`);
            return t(`טיפ: הטעות הנפוצה היום: "${show(exp)}" הוקלד כ"${show(typed)}" (${top[1]} פעמים). ${fe ? 'השתמשו ב' + fingerName(fe) + '.' : ''}`, `Tip: today's most common slip: "${show(exp)}" typed as "${show(typed)}" (${top[1]}×). ${fe ? 'Use your ' + fingerName(fe).toLowerCase() + '.' : ''}`);
        }
    }
    if (metrics.consistency !== null && metrics.consistency < 45) return t('טיפ: הקצב שלכם לא אחיד. נסו להקליד בקצב קבוע, כמו מטרונום — אחיד עדיף על מהיר.', 'Tip: your rhythm is uneven. Aim for a steady beat, like a metronome — steady beats fast.');
    if (metrics.accuracy >= 98 && metrics.netWpm < 25) return t('טיפ: הדיוק מצוין! זה הזמן לנסות להאיץ מעט.', 'Tip: your accuracy is excellent! Time to push the speed a little.');
    return '';
}

// mid-session encouragement (called from practice.js)
const COMBO_MSGS = { 10: ['🔥 10 ברצף', '🔥 10 in a row'], 25: ['🔥 25 ברצף — מעולה!', '🔥 25 in a row — great!'], 50: ['⚡ 50 ברצף! בלתי ניתנים לעצירה', '⚡ 50 in a row! Unstoppable'], 100: ['🌟 100 ברצף!!!', '🌟 100 in a row!!!'], 200: ['👑 200 ברצף! מדהים', '👑 200 in a row! Amazing'] };
function comboMessage(n) { const m = COMBO_MSGS[n]; return m ? t(m[0], m[1]) : (n % 50 === 0 ? t(`🔥 ${n} ברצף`, `🔥 ${n} in a row`) : null); }

// ---------- toasts ----------
function showToast(opts) {
    if (appSettings.encouragement === false && opts.kind === 'cheer') return;
    let host = document.getElementById('toastHost');
    if (!host) { host = document.createElement('div'); host.id = 'toastHost'; host.className = 'toast-host'; document.body.appendChild(host); }
    const el = document.createElement('div');
    el.className = 'toast toast-' + (opts.kind || 'info');
    el.innerHTML = `<span class="toast-icon">${opts.icon || '✨'}</span><span class="toast-body">${opts.title ? `<b>${opts.title}</b>` : ''}${opts.text ? `<span>${opts.text}</span>` : ''}</span>`;
    host.appendChild(el);
    while (host.children.length > 4) host.firstChild.remove();
    setTimeout(() => { el.classList.add('toast-out'); setTimeout(() => el.remove(), 350); }, opts.duration || 3400);
}
function celebrateLevelUp(level) {
    const r = rankForLevel(level);
    setTimeout(() => {
        showToast({ icon: '🆙', title: t(`עליתם לרמה ${level}!`, `Level ${level}!`), text: rankLabel(r), kind: 'level', duration: 4500 });
        playSound('levelup');
        burstConfetti();
    }, 900);
}
function burstConfetti() {
    if (appSettings.reduceMotion) return;
    const layer = document.createElement('div');
    layer.className = 'confetti-layer';
    const colors = ['#4f8cf7', '#33c17a', '#e0a733', '#d64545', '#a35cf0', '#f06292'];
    let html = '';
    for (let i = 0; i < 70; i++) {
        const left = Math.random() * 100, delay = Math.random() * 0.4, dur = 1.6 + Math.random() * 1.2, rot = Math.round(Math.random() * 720 - 360), drift = Math.round(Math.random() * 160 - 80);
        html += `<i style="left:${left}%;background:${colors[i % colors.length]};animation-delay:${delay}s;animation-duration:${dur}s;--rot:${rot}deg;--drift:${drift}px"></i>`;
    }
    layer.innerHTML = html;
    document.body.appendChild(layer);
    setTimeout(() => layer.remove(), 3200);
}

// ---------- header status (streak · level · today's goal) ----------
function refreshHeaderStatus() {
    const el = document.getElementById('headerStatus');
    if (!el || !appData || !appData.progress) return;
    counters();
    const xp = getXpProgress();
    const goal = getDailyGoalMinutes(), today = getTodayMinutes();
    const pct = Math.min(100, Math.round(today / goal * 100));
    const deg = Math.round(pct * 3.6);
    const streak = appData.progress.streakDays || 0;
    const practicedToday = appData.progress.lastPracticeDate === localDateKey();
    el.innerHTML = `
        <span class="hs-chip hs-streak${practicedToday ? '' : ' cold'}" title="${t('ימי רצף', 'Day streak')}">🔥 ${streak}</span>
        <span class="hs-chip hs-level" title="${t('רמה', 'Level')} ${xp.level} · ${xp.into}/${xp.needed} XP">${xp.rank.icon} ${t('רמה', 'Lv')} ${xp.level}<span class="hs-xpbar"><span style="width:${xp.pct}%"></span></span></span>
        <span class="hs-chip hs-goal" title="${t('יעד יומי', 'Daily goal')}"><span class="hs-ring${pct >= 100 ? ' done' : ''}" style="--deg:${deg}deg"></span>${Math.floor(today)}/${goal} ${t('דק׳', 'min')}</span>`;
}
