// ---- Reliable persistent storage ----
const HAS_OTZARIA = (typeof Otzaria !== 'undefined');
const STORAGE_KEY = 'hebtyper_data_v2';
const SETTINGS_KEY = 'hebtyper_settings_v2';
const LEGACY_STORAGE_KEY = 'hebtyper_data_v1';
const LEGACY_SETTINGS_KEY = 'hebtyper_settings_v1';
const LOCAL_BACKUP_DATA_KEY = 'hebtyper_local_backup_data_v2';
const LOCAL_BACKUP_SETTINGS_KEY = 'hebtyper_local_backup_settings_v2';

function safeLocalGet(key) {
    try { return JSON.parse(localStorage.getItem(key)); } catch (e) { return null; }
}
function safeLocalSet(key, value) {
    try { localStorage.setItem(key, JSON.stringify(value)); return true; } catch (e) { return false; }
}
async function storageGet(key) {
    if (HAS_OTZARIA) {
        try {
            const res = await Otzaria.call('storage.get', { key });
            if (res && res.success && res.data != null) return res.data;
        } catch (e) {}
    }
    return safeLocalGet(key);
}
async function storageSet(key, value) {
    // Always keep a synchronous local mirror. This is the crash/close-safe copy.
    const localKey = key === STORAGE_KEY ? LOCAL_BACKUP_DATA_KEY : (key === SETTINGS_KEY ? LOCAL_BACKUP_SETTINGS_KEY : key);
    safeLocalSet(localKey, value);
    if (HAS_OTZARIA) {
        try { await Otzaria.call('storage.set', { key, value }); return true; } catch (e) {}
    }
    return true;
}
function storageSaveAsync(key, value) {
    // Snapshot before scheduling so later mutations cannot alter the object while a
    // provider write is in flight.
    let snapshot;
    try { snapshot = typeof structuredClone === 'function' ? structuredClone(value) : JSON.parse(JSON.stringify(value)); }
    catch (e) { snapshot = JSON.parse(JSON.stringify(value)); }
    storageSet(key, snapshot).catch(e => console.error('storage save error', e));
}

function getDefaultData() {
    return {
        schemaVersion: 4,
        revision: 0,
        charStats: {}, bigramStats: {}, wordStats: {}, trigramStats: {}, skillState: {}, errorMatrix: {},
        sessions: [], sessionSummary: { count: 0, totalWpm: 0, totalAccuracy: 0, bestWpm: 0, totalDurationMs: 0 },
        assessments: [], teacher: { enabled: false, accuracyTarget: 97, wpmTarget: 30, dailyMinutes: 15 },
        progress: {
            level: 0, completedLessons: [], xp: 0, streakDays: 0, lastPracticeDate: null,
            completedLessonsByLanguage: { he: [], en: [] }, levelByLanguage: { he: 0, en: 0 },
            level1Scheme: 2, unlockedLessonsByLanguage: { he: [], en: [] }
        },
        achievements: [], goals: { targetWpm: 30, targetAccuracy: 98, dailyMinutes: 15 },
        pedagogy: { version: 1, skills: {}, bigrams: {}, trigrams: {}, words: {}, reviews: [], curriculumHistory: [], baseline: { wpm: null, accuracy: null }, settings: { targetAccuracy: 92, minConfidence: 0.75, dailyMinutes: 15, newItemRatio: 0.15, reviewRatio: 0.30, targetedRatio: 0.35 } },
        advanced: { version: 2, profiles: [{id:'default',name:'הלומד',role:'student',createdAt:Date.now()}], activeProfileId:'default', profileData:{}, assignments:[], plans:{}, assessmentHistory:[], retentionQueue:[], maintenance:[], ergonomics:{enabled:true,acknowledged:false}, learningEvents:[], settings:{dailyGoalMinutes:15,weeklyGoalMinutes:75,defaultAccuracy:97,defaultWpm:30} }
    };
}

function mergeDataWithDefaults(saved) {
    const defaults = getDefaultData();
    const src = (saved && typeof saved === 'object') ? saved : {};
    const data = Object.assign({}, defaults, src);
    data.schemaVersion = Math.max(4, Number(src.schemaVersion) || 1);
    data.revision = Number(src.revision) || 0;
    for (const k of ['charStats','bigramStats','wordStats','trigramStats','skillState','errorMatrix']) data[k] = Object.assign({}, defaults[k], src[k] || {});
    data.progress = Object.assign({}, defaults.progress, src.progress || {});
    data.progress.completedLessonsByLanguage = Object.assign({}, defaults.progress.completedLessonsByLanguage, src.progress?.completedLessonsByLanguage || {});
    data.progress.levelByLanguage = Object.assign({}, defaults.progress.levelByLanguage, src.progress?.levelByLanguage || {});
    // an old save has no scheme marker: the defaults must not mark it as already migrated
    data.progress.level1Scheme = Number(src.progress?.level1Scheme) || (src.progress ? 1 : 2);
    data.progress.unlockedLessonsByLanguage = Object.assign({ he: [], en: [] }, src.progress?.unlockedLessonsByLanguage || {});
    // One-time migration of the old single-language progress into Hebrew.
    if ((!Array.isArray(src.progress?.completedLessonsByLanguage?.he) || !src.progress.completedLessonsByLanguage.he.length) && Array.isArray(src.progress?.completedLessons)) {
        data.progress.completedLessonsByLanguage.he = Array.from(new Set(src.progress.completedLessons));
    }
    if (!Array.isArray(data.progress.completedLessonsByLanguage.he)) data.progress.completedLessonsByLanguage.he = [];
    if (!Array.isArray(data.progress.completedLessonsByLanguage.en)) data.progress.completedLessonsByLanguage.en = [];
    data.progress.completedLessons = data.progress.completedLessonsByLanguage.he.slice();
    data.progress.levelByLanguage.he = Number(data.progress.levelByLanguage.he) || Number(src.progress?.level) || 0;
    data.progress.levelByLanguage.en = Number(data.progress.levelByLanguage.en) || 0;
    data.goals = Object.assign({}, defaults.goals, src.goals || {});
    data.sessionSummary = Object.assign({}, defaults.sessionSummary, src.sessionSummary || {});
    data.teacher = Object.assign({}, defaults.teacher, src.teacher || {});
    data.achievements = Array.isArray(src.achievements) ? src.achievements : [];
    data.sessions = Array.isArray(src.sessions) ? src.sessions : [];
    data.assessments = Array.isArray(src.assessments) ? src.assessments : [];
    data.pedagogy = Object.assign({}, defaults.pedagogy, src.pedagogy || {});
    for (const bucket of ['skills','bigrams','trigrams','words']) data.pedagogy[bucket] = Object.assign({}, defaults.pedagogy[bucket], src.pedagogy?.[bucket] || {});
    data.pedagogy.reviews = Array.isArray(src.pedagogy?.reviews) ? src.pedagogy.reviews : [];
    data.pedagogy.curriculumHistory = Array.isArray(src.pedagogy?.curriculumHistory) ? src.pedagogy.curriculumHistory : [];
    data.pedagogy.baseline = Object.assign({}, defaults.pedagogy.baseline, src.pedagogy?.baseline || {});
    data.pedagogy.settings = Object.assign({}, defaults.pedagogy.settings, src.pedagogy?.settings || {});
    data.advanced = Object.assign({}, defaults.advanced, src.advanced || {});
    data.advanced.profiles = Array.isArray(src.advanced?.profiles) && src.advanced.profiles.length ? src.advanced.profiles : defaults.advanced.profiles;
    data.advanced.profileData = Object.assign({}, defaults.advanced.profileData, src.advanced?.profileData || {});
    data.advanced.assignments = Array.isArray(src.advanced?.assignments) ? src.advanced.assignments : [];
    data.advanced.plans = Object.assign({}, defaults.advanced.plans, src.advanced?.plans || {});
    data.advanced.assessmentHistory = Array.isArray(src.advanced?.assessmentHistory) ? src.advanced.assessmentHistory : [];
    data.advanced.retentionQueue = Array.isArray(src.advanced?.retentionQueue) ? src.advanced.retentionQueue : [];
    data.advanced.maintenance = Array.isArray(src.advanced?.maintenance) ? src.advanced.maintenance : [];
    data.advanced.learningEvents = Array.isArray(src.advanced?.learningEvents) ? src.advanced.learningEvents : [];
    data.advanced.ergonomics = Object.assign({}, defaults.advanced.ergonomics, src.advanced?.ergonomics || {});
    data.advanced.settings = Object.assign({}, defaults.advanced.settings, src.advanced?.settings || {});
    // 4.1: Level 1 moved from one key per lesson (positional order) to two keys per
    // lesson (frequency order). Convert saved progress once — for the active data
    // and for every stored learner profile.
    migrateLevel1Scheme(data.progress);
    Object.values(data.advanced.profileData || {}).forEach(pd => { if (pd && pd.progress && typeof pd.progress === 'object') migrateLevel1Scheme(pd.progress); });
    return data;
}

// Old ids: L1-<i> taught key OLD_ORDER[i]. New ids: L1p-<j> teach NEW_ORDER[2j], NEW_ORDER[2j+1].
//  • a new lesson is complete when the learner had completed BOTH of its keys;
//  • a new lesson that contains ANY key they had completed (or the key of the
//    lesson they were up to) stays unlocked — nothing already completed is re-locked;
//  • every key they had practised stays "known" for the adaptive drills;
//  • if Level 2 was open (or later levels were started) it stays open;
//  • best results/stars of the old lessons are carried over to the new ones.
function migrateLevel1Scheme(progress) {
    if (!progress || typeof progress !== 'object' || Number(progress.level1Scheme) >= 2) return false;
    if (!progress.completedLessonsByLanguage || typeof progress.completedLessonsByLanguage !== 'object') {
        progress.completedLessonsByLanguage = { he: Array.isArray(progress.completedLessons) ? progress.completedLessons.slice() : [], en: [] };
    }
    if (!progress.unlockedLessonsByLanguage || typeof progress.unlockedLessonsByLanguage !== 'object') progress.unlockedLessonsByLanguage = { he: [], en: [] };
    if (!progress.legacyL1Keys || typeof progress.legacyL1Keys !== 'object') progress.legacyL1Keys = { he: [], en: [] };
    const lb = (progress.lessonBest && typeof progress.lessonBest === 'object') ? progress.lessonBest : null;
    ['he', 'en'].forEach(lang => {
        const oldOrder = lang === 'he' ? LEVEL1_KEY_ORDER_LEGACY : ENGLISH_KEY_ORDER;
        const newOrder = lang === 'he' ? LEVEL1_KEY_ORDER : ENGLISH_KEY_ORDER;
        const done = Array.isArray(progress.completedLessonsByLanguage[lang]) ? progress.completedLessonsByLanguage[lang] : [];
        const oldIdx = done.map(id => /^L1-(\d+)$/.exec(id)).filter(Boolean).map(m => Number(m[1])).filter(i => i < oldOrder.length);
        if (!oldIdx.length && !done.some(id => /^L[2-9]-/.test(id))) { progress.completedLessonsByLanguage[lang] = done; return; }
        const learned = new Set(oldIdx.map(i => oldOrder[i]));
        // the lesson the learner was up to (first not-yet-done old lesson) was open too
        let frontier = null;
        for (let i = 0; i < oldOrder.length; i++) if (!oldIdx.includes(i)) { frontier = oldOrder[i]; break; }
        const nPairs = Math.ceil(newOrder.length / KEYS_PER_LESSON);
        const kept = done.filter(id => !/^L1-\d+$/.test(id));
        const unlocked = new Set(progress.unlockedLessonsByLanguage[lang] || []);
        const best = lb && lb[lang] && typeof lb[lang] === 'object' ? lb[lang] : null;
        for (let j = 0; j < nPairs; j++) {
            const codes = newOrder.slice(j * KEYS_PER_LESSON, j * KEYS_PER_LESSON + KEYS_PER_LESSON);
            const id = `L1p-${j}`;
            const all = codes.every(c => learned.has(c)), any = codes.some(c => learned.has(c) || c === frontier);
            if (all) { if (!kept.includes(id)) kept.push(id); }
            else if (any) unlocked.add(id);
            if (best && all) {
                const olds = codes.map(c => best[`L1-${oldOrder.indexOf(c)}`]).filter(Boolean);
                if (olds.length) best[id] = {
                    stars: Math.min(...olds.map(o => Number(o.stars) || 0)), wpm: Math.max(...olds.map(o => Number(o.wpm) || 0)),
                    acc: Math.max(...olds.map(o => Number(o.acc) || 0)), runs: olds.reduce((n, o) => n + (Number(o.runs) || 0), 0), at: Math.max(...olds.map(o => Number(o.at) || 0))
                };
            }
        }
        // Level 2 was open if 70% of the old Level 1 was done (or later levels were started)
        const level2Open = oldIdx.length >= Math.ceil(oldOrder.length * 0.7) || done.some(id => /^L[2-9]-/.test(id)) ||
            Number((progress.levelByLanguage || {})[lang] || (lang === 'he' ? progress.level : 0)) >= 2;
        if (level2Open) unlocked.add('L2-0');
        if (best) {
            const legacyBest = progress.legacyL1Best || (progress.legacyL1Best = { he: {}, en: {} });
            legacyBest[lang] = legacyBest[lang] || {};
            Object.keys(best).forEach(k => { if (/^L1-\d+$/.test(k)) { legacyBest[lang][k] = best[k]; delete best[k]; } });
        }
        progress.legacyL1Keys[lang] = Array.from(learned);
        progress.legacyCompletedL1 = progress.legacyCompletedL1 || { he: [], en: [] };
        progress.legacyCompletedL1[lang] = oldIdx.map(i => `L1-${i}`);
        progress.completedLessonsByLanguage[lang] = kept;
        progress.unlockedLessonsByLanguage[lang] = Array.from(unlocked);
    });
    progress.completedLessons = (progress.completedLessonsByLanguage.he || []).slice();
    progress.level1Scheme = 2;
    return true;
}

// 4.1: settings saved by 3.x/4.0 have no correctionModeManual flag. A learner who
// had picked anything other than the default ('free') clearly chose it, so we
// keep that choice; otherwise the mode follows the learning stage.
function migrateSettings(merged, raw) {
    raw = raw || {};
    if (raw.correctionModeManual === undefined) merged.correctionModeManual = !!(raw.correctionMode && raw.correctionMode !== 'free');
    if (!['free', 'strict', 'backspace'].includes(merged.correctionMode)) merged.correctionMode = 'free';
    return merged;
}
function getDefaultSettings() {
    return {
        darkMode: null,
        uiLang: 'he',
        englishTypingEnabled: false,
        soundEnabled: true, niqudLevel: 'none', niqudMode: 'none', correctionMode: 'free',
        showKeyboard: true, showFingerHints: true, fadeAssistance: true, breakReminders: true,
        fontSize: 'medium', reduceMotion: false, wpmMethod: 'net', timingMode: 'completion',
        accuracyTarget: 97, masteryTarget: 90, feedbackMode: 'immediate', ergonomicsReminders: true,
        practiceLength: 50, dailyLimitEnabled: true, dailyLimitMinutes: 15,
        autoAdvance: false,     // אחרי סיום שיעור: מעבר אוטומטי (עם אנימציה) לשיעור הבא אם עברתם, או חזרה על אותו שיעור אם לא
        allowBackspace: true,   // 3.0: Backspace לתיקון במצב חופשי
        paceCaret: false,       // 3.0: סמן קצב לפי יעד המהירות
        encouragement: true,    // 3.0: הודעות עידוד במהלך התרגול
        showSecondaryLabels: true, // 3.0: אות אנגלית קטנה על כל מקש עברי (ולהפך)
        liveDashboard: true,    // 3.1: לוח נתונים חי בזמן התרגול
        nonStopPractice: false, // 3.1: שיעורים ממשיכים ללא הפסקה עד שהטיימר היומי מסתיים
        speakNext: 'off',       // 3.2: הקראת האות הבאה: off | letter | letterFinger | word
        speechRate: 1.1,
        correctionModeManual: false, // 4.1: false = correction mode follows the stage (free → Backspace from level 3)
        autoBlindMode: true          // 4.1: from level 3 the keyboard/finger guide hide and reappear only on hesitation
    };
}
let appData = getDefaultData();
let appSettings = getDefaultSettings();
let _saveDataTimer = null;
let _revision = 0;

function getActiveLanguage() { return appSettings.englishTypingEnabled ? 'en' : 'he'; }
function getCompletedLessons() {
    const lang = getActiveLanguage();
    if (!appData.progress.completedLessonsByLanguage) appData.progress.completedLessonsByLanguage = { he: [], en: [] };
    if (!Array.isArray(appData.progress.completedLessonsByLanguage[lang])) appData.progress.completedLessonsByLanguage[lang] = [];
    // Legacy callers still see the active curriculum.
    appData.progress.completedLessons = appData.progress.completedLessonsByLanguage[lang];
    return appData.progress.completedLessonsByLanguage[lang];
}
function getActiveLevel() {
    const lang = getActiveLanguage();
    return Number(appData.progress.levelByLanguage?.[lang] ?? (lang === 'he' ? appData.progress.level : 0)) || 0;
}
function setActiveLevel(level) {
    const lang = getActiveLanguage();
    if (!appData.progress.levelByLanguage) appData.progress.levelByLanguage = { he: 0, en: 0 };
    appData.progress.levelByLanguage[lang] = Math.max(0, Number(level) || 0);
    if (lang === 'he') appData.progress.level = appData.progress.levelByLanguage.he;
}

function scheduleSaveData() {
    if (_saveDataTimer) clearTimeout(_saveDataTimer);
    _saveDataTimer = setTimeout(() => { flushSaveData(); }, 300);
}
function flushSaveData() {
    if (_saveDataTimer) { clearTimeout(_saveDataTimer); _saveDataTimer = null; }
    appData.revision = Math.max(Number(appData.revision) || 0, ++_revision) + 1;
    const snapshot = typeof structuredClone === 'function' ? structuredClone(appData) : JSON.parse(JSON.stringify(appData));
    // Synchronous mirror first: this survives abrupt window/plugin termination.
    safeLocalSet(LOCAL_BACKUP_DATA_KEY, snapshot);
    storageSaveAsync(STORAGE_KEY, snapshot);
}
function saveSettings() {
    appSettings.revision = Date.now();
    safeLocalSet(LOCAL_BACKUP_SETTINGS_KEY, appSettings);
    storageSaveAsync(SETTINGS_KEY, appSettings);
}

async function loadAllData() {
    const [otzData, localData, legacyData] = await Promise.all([
        storageGet(STORAGE_KEY), Promise.resolve(safeLocalGet(LOCAL_BACKUP_DATA_KEY)), storageGet(LEGACY_STORAGE_KEY)
    ]);
    const candidates = [otzData, localData, legacyData].filter(x => x && typeof x === 'object');
    const best = candidates.sort((a,b) => (Number(b.revision)||0) - (Number(a.revision)||0))[0];
    if (best) appData = mergeDataWithDefaults(best);
    _revision = Number(appData.revision) || 0;

    const [otzSettings, localSettings, legacySettings] = await Promise.all([
        storageGet(SETTINGS_KEY), Promise.resolve(safeLocalGet(LOCAL_BACKUP_SETTINGS_KEY)), storageGet(LEGACY_SETTINGS_KEY)
    ]);
    const sc = [otzSettings, localSettings, legacySettings].filter(x => x && typeof x === 'object');
    const bestSettings = sc.sort((a,b) => (Number(b.revision)||0) - (Number(a.revision)||0))[0];
    if (bestSettings) appSettings = migrateSettings(Object.assign(getDefaultSettings(), bestSettings), bestSettings);
    getCompletedLessons();
}

if (typeof Otzaria !== 'undefined') window.addEventListener('plugin.suspended', () => flushSaveData());
window.addEventListener('pagehide', () => flushSaveData());
window.addEventListener('beforeunload', () => flushSaveData());
document.addEventListener('visibilitychange', () => { if (document.visibilityState === 'hidden') flushSaveData(); });

function exportAllData() {
    flushSaveData();
    const dateStr = new Date().toISOString().slice(0, 10);
    const payload = { data: appData, settings: appSettings, exportedAt: new Date().toISOString(), version: 2 };
    const blob = new Blob([JSON.stringify(payload, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob), a = document.createElement('a');
    a.href = url; a.download = `hebrew-typing-backup-${dateStr}.json`; document.body.appendChild(a); a.click(); document.body.removeChild(a); URL.revokeObjectURL(url);
}
function importAllData(file, callback) {
    const reader = new FileReader();
    reader.onload = (e) => {
        try {
            const parsed = JSON.parse(e.target.result);
            if (!parsed || !parsed.data || typeof parsed.data !== 'object') return callback(false, 'קובץ לא תקין');
            appData = mergeDataWithDefaults(parsed.data);
            if (parsed.settings && typeof parsed.settings === 'object') appSettings = migrateSettings(Object.assign(getDefaultSettings(), parsed.settings), parsed.settings);
            flushSaveData(); saveSettings(); callback(true);
        } catch (err) { callback(false, err.message); }
    };
    reader.readAsText(file);
}
function resetAllData() { appData = getDefaultData(); _revision = 0; flushSaveData(); }
