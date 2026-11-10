// ---- Curriculum (3.0) ----
function getCurrentLevels() {
    if (isEnglishTyping()) return [
        {id:0,name:'Getting Started',desc:'Keyboard and hand positioning'},
        {id:1,name:'First Keys & Words',desc:'Two new keys per lesson, mixed with real words'},
        {id:2,name:'Key Combinations',desc:'Combine keys you have learned'},
        {id:3,name:'Short Words',desc:'Real short English words'},
        {id:4,name:'Words & Sentences',desc:'Longer words and short sentences'},
        {id:5,name:'Paragraphs',desc:'Continuous English text with punctuation'},
        {id:6,name:'Advanced English',desc:'Expanded vocabulary and complex sentences'},
        {id:7,name:'Mastery',desc:'Long realistic typing without assistance'}
    ];
    // UI language decides the labels even when the curriculum is Hebrew.
    return LEVELS.map(l => appSettings.uiLang === 'en' ? Object.assign({}, l, { name: l.en, desc: l.enDesc }) : l);
}
const LEVEL_ICONS = ['🖐️', '🔤', '🔗', '🧩', '💬', '📄', '📚', '🔡', '🏆'];

function repeatToLength(groups, len) {
    const out = [];
    let n = 0, i = 0;
    while (n < len) { const g = groups[i % groups.length]; out.push(g); n += g.length + 1; i++; }
    return out.join(' ');
}
function buildLessonList(levelId) {
    const lessons = [];
    const layout = getCurrentKeyboardLayout(); const order = getCurrentKeyOrder();
    const en = isEnglishTyping();          // curriculum language → which keys/text
    const ui = appSettings.uiLang === 'en'; // interface language → titles and tips
    const len = Math.max(30, Number(appSettings.practiceLength) || 50);
    if (levelId === 0) {
        lessons.push(
            { id: 'L0-0', title: ui ? 'Meet the home row' : 'היכרות עם שורת הבית',
              tip: en ? (ui ? '🖐️ Left fingers on A S D F, right fingers on J K L ; — feel the bumps on F and J. Thumbs on the space bar.' : '🖐️ אצבעות יד שמאל על A S D F, יד ימין על J K L ; — הרגישו את הבליטות על F ו-J. האגודלים על מקש הרווח.') : (ui ? '🖐️ Left fingers on ש ד ג כ, right fingers on ח ל ך ף — feel the bumps on כ and ח. Thumbs on the space bar.' : '🖐️ אצבעות יד שמאל על ש ד ג כ, יד ימין על ח ל ך ף — הרגישו את הבליטות על כ ו-ח. האגודלים על מקש הרווח.'),
              gen: () => repeatToLength(en ? ['fj', 'jf', 'ff', 'jj', 'fjf', 'jfj'] : ['כח', 'חכ', 'ככ', 'חח', 'כחכ', 'חכח'], len) },
            { id: 'L0-1', title: ui ? 'Hand and finger position' : 'מיקום ידיים ואצבעות',
              tip: ui ? '🖐️ Each finger has its own keys. Keep your wrists relaxed and return to the home row after every key.' : '🖐️ לכל אצבע המקשים שלה. פרקי כף היד רפויים, וחוזרים לשורת הבית אחרי כל הקשה.',
              gen: () => repeatToLength(en ? ['fjdk', 'dkfj', 'slsl', 'asdf', 'jkl;'] : ['כחגל', 'גלכח', 'דךדך', 'שדגכ', 'חלךף'], len) },
            { id: 'L0-2', title: ui ? 'The whole home row' : 'כל שורת הבית',
              tip: ui ? '🖐️ All eight fingers on the home row. Look at the screen, not your hands.' : '🖐️ כל שמונה האצבעות על שורת הבית. הסתכלו על המסך, לא על הידיים.',
              gen: () => repeatToLength(en ? ['asdf', 'jkl;', 'fdsa', ';lkj', 'ads', 'lkj', 'fall', 'dad', 'sad'] : ['שדגכ', 'חלךף', 'כגדש', 'ףךלח', 'שדג', 'חלך', 'לך', 'דג', 'גל'], len) }
        );
    } else if (levelId === 1) {
        // 4.1: two new keys per lesson, ordered by frequency; ~40% drills, ~60% real words.
        for (let j = 0; j < level1LessonCount(); j++) {
            const codes = level1LessonKeys(j);
            const ks = codes.map(c => layout[c]);
            const show = ks.map(k => k === ' ' ? '␣' : k).join(' ');
            const fingers = Array.from(new Set(codes.map(c => fingerName(KEY_TO_FINGER[c])))).join(ui ? ' / ' : ' / ');
            lessons.push({
                id: level1LessonId(j), title: ui ? `Keys: ${show}` : `אותיות: ${show}`, keyCode: codes[0], keyCodes: codes,
                tip: ui ? `New keys: ${show} — ${fingers.toLowerCase()}. Mixed with the keys you already know, and real words.`
                        : `אותיות חדשות: ${show} — ${fingers}. משולבות עם האותיות שכבר למדתם, ובמילים אמיתיות.`,
                gen: () => generateLevel1LessonText(j, Math.round(len * 1.2))
            });
        }
    } else {
        const lvlName = getCurrentLevels()[levelId].name;
        for (let i = 0; i < 6; i++) lessons.push({
            id: `L${levelId}-${i}`, title: ui ? `${lvlName} — Exercise ${i + 1}` : `${lvlName} — תרגיל ${i + 1}`,
            niqud: !en && levelId === 7,
            gen: () => generateAdaptiveExercise(levelId)
        });
    }
    return lessons;
}
function isLessonUnlocked(levelId, lessonId, lessons, idx) {
    const completed = getCompletedLessons();
    if (completed.includes(lessonId)) return true;
    // 4.1: lessons kept open by the key-order migration (never re-lock earlier progress)
    const keep = (appData.progress.unlockedLessonsByLanguage || {})[getActiveLanguage()];
    if (Array.isArray(keep) && keep.includes(lessonId)) return true;
    if (levelId === 0) return true;
    if (idx === 0) {
        if (levelId === 1) return true;
        const prevLessons = buildLessonList(levelId - 1);
        const doneCount = prevLessons.filter(l => completed.includes(l.id)).length;
        return doneCount >= Math.ceil(prevLessons.length * 0.7);
    }
    return completed.includes(lessons[idx - 1].id);
}
// The first unlocked, not-yet-passed lesson — used by "Continue learning".
function findNextLesson() {
    const completed = getCompletedLessons();
    const levels = getCurrentLevels();
    for (const lvl of levels) {
        const lessons = buildLessonList(lvl.id);
        for (let i = 0; i < lessons.length; i++) {
            if (!completed.includes(lessons[i].id) && isLessonUnlocked(lvl.id, lessons[i].id, lessons, i)) return { levelId: lvl.id, lesson: lessons[i] };
        }
    }
    return null;
}
function levelStars(levelId) {
    return buildLessonList(levelId).reduce((n, l) => n + ((getLessonBest(l.id) || {}).stars || 0), 0);
}
function renderLevelsScreen(container) {
    const levels = getCurrentLevels(); const completed = getCompletedLessons();
    const next = findNextLesson();
    container.innerHTML = `<h2>${t('תוכנית הלימודים', 'Typing Curriculum')}</h2>
        ${next ? `<div class="hero-card continue-card"><div><div class="cc-label">${t('הצעד הבא שלכם', 'Your next step')}</div><div class="cc-title">${next.lesson.title}</div></div><span class="cc-actions"><button class="btn primary big" id="btnContinueLevels">${t('המשך ללמוד ▶', 'Continue ▶')}</button><button class="btn" id="btnNonStopLevels">⏱️ ${t('תרגול רציף', 'Non-stop practice')}</button></span></div>` : ''}
        <div class="levels-grid"></div>`;
    if (next) {
        container.querySelector('#btnContinueLevels').addEventListener('click', () => runLesson(next.levelId, next.lesson, container));
        container.querySelector('#btnNonStopLevels').addEventListener('click', () => runNonStop(next.levelId, next.lesson, container));
    }
    const grid = container.querySelector('.levels-grid');
    levels.forEach(lvl => {
        const lessons = buildLessonList(lvl.id), doneCount = lessons.filter(l => completed.includes(l.id)).length;
        const unlocked = lessons.some((l, i) => isLessonUnlocked(lvl.id, l.id, lessons, i));
        const card = document.createElement('div'); card.className = 'level-card' + (unlocked ? '' : ' locked') + (doneCount === lessons.length ? ' complete' : '');
        const pct = lessons.length ? Math.round(doneCount / lessons.length * 100) : 0;
        const stars = levelStars(lvl.id), maxStars = lessons.length * 3;
        card.innerHTML = `<div class="level-card-icon">${unlocked ? (LEVEL_ICONS[lvl.id] || '⌨️') : '🔒'}</div>
            <div class="level-card-title">${t(`רמה ${lvl.id}: ${lvl.name}`, `Level ${lvl.id}: ${lvl.name}`)}</div>
            <div class="level-card-desc">${lvl.desc}</div>
            <div class="level-progress-bar"><div class="level-progress-fill" style="width:${pct}%"></div></div>
            <div class="level-card-count"><span>${doneCount}/${lessons.length} ${t('הושלמו', 'completed')}</span><span class="lvl-stars">★ ${stars}/${maxStars}</span></div>`;
        card.addEventListener('click', () => renderLessonListScreen(container, lvl.id));
        grid.appendChild(card);
    });
}
function renderLessonListScreen(container, levelId) {
    const lvl = getCurrentLevels()[levelId], lessons = buildLessonList(levelId), completed = getCompletedLessons();
    container.innerHTML = `<button class="btn-back">‹ ${t('חזרה לרמות', 'Back to levels')}</button><h2>${t(`רמה ${lvl.id}: ${lvl.name}`, `Level ${lvl.id}: ${lvl.name}`)}</h2><p class="empty-note">${lvl.desc}</p><div class="lesson-list"></div>`;
    container.querySelector('.btn-back').addEventListener('click', () => renderLevelsScreen(container));
    const list = container.querySelector('.lesson-list');
    lessons.forEach((lesson, idx) => {
        const unlocked = isLessonUnlocked(levelId, lesson.id, lessons, idx), done = completed.includes(lesson.id), item = document.createElement('div');
        const best = getLessonBest(lesson.id);
        item.className = 'lesson-item' + (unlocked ? '' : ' locked') + (done ? ' done' : '');
        item.innerHTML = `<span class="li-title">${lesson.title}</span>
            <span class="lesson-status">${best && best.runs ? `<span class="li-best">${best.wpm} ${t('מ״לד', 'WPM')} · ${Math.round(best.acc)}%</span>` : ''}${unlocked ? (best ? starsHtml(best.stars) : (done ? '✓' : '<span class="li-new">' + t('חדש', 'New') + '</span>')) : '🔒'}</span>`;
        if (unlocked) item.addEventListener('click', () => runLesson(levelId, lesson, container));
        list.appendChild(item);
    });
}
// 3.1: non-stop practice on a lesson (or the lesson you're up to) until the daily timer ends.
function runNonStop(levelId, lesson, backContainer) {
    backContainer = backContainer || document.getElementById('lessonsScreen');
    const backToList = () => { navigateTo('lessonsScreen', { silent: true }); renderLessonListScreen(backContainer, levelId); };
    startPracticeRun({
        text: lesson.gen(), gen: lesson.gen, nonStop: true, mode: 'lesson', level: levelId,
        title: lesson.title + ' · ' + t('תרגול רציף', 'non-stop'), tip: lesson.tip, keepNiqud: !!lesson.niqud,
        onExit: backToList,
        onFinish: (metrics) => {
            // A good non-stop run also counts as passing the lesson (with stars).
            let passed, stars;
            if (lesson.id && lesson.id !== 'nonstop') {
                const passAcc = Math.min(97, Number(appSettings.accuracyTarget || 97));
                passed = metrics.accuracy >= passAcc && (metrics.correct + metrics.incorrect) >= 30;
                stars = computeLessonStars(metrics, passed);
                recordLessonBest(lesson.id, metrics, stars);
                if (passed) { const c = getCompletedLessons(); if (!c.includes(lesson.id)) c.push(lesson.id); if (levelId > getActiveLevel()) setActiveLevel(levelId); flushSaveData(); }
            }
            showResultsScreen(metrics, { stars, onContinue: backToList, onRetry: () => runNonStop(levelId, lesson, backContainer) });
        }
    });
}
function startNonStopCurrent() {
    const next = findNextLesson();
    navigateTo('lessonsScreen', { silent: true });
    const cont = document.getElementById('lessonsScreen');
    if (next) { runNonStop(next.levelId, next.lesson, cont); return; }
    const lvl = Math.max(2, getActiveLevel());
    runNonStop(lvl, { id: 'nonstop', title: t('תרגול חופשי', 'Free practice'), gen: () => generateAdaptiveExercise(lvl) }, cont);
}

function runLesson(levelId, lesson, backContainer) {
    if (appSettings.nonStopPractice) return runNonStop(levelId, lesson, backContainer);
    const lessons = buildLessonList(levelId);
    const idx = lessons.findIndex(l => l.id === lesson.id);
    const nextLesson = idx >= 0 ? lessons[idx + 1] : null;
    const backToList = () => { navigateTo('lessonsScreen', { keepActivity: true, silent: true }); renderLessonListScreen(backContainer, levelId); };
    const text = lesson.gen();
    startPracticeRun({
        text, mode: 'lesson', level: levelId, title: lesson.title, tip: lesson.tip, keepNiqud: !!lesson.niqud,
        onExit: backToList,
        onSkipNext: nextLesson ? (() => runLesson(levelId, nextLesson, backContainer)) : null,
        skipNextLabel: t('לשיעור הבא ›', 'Next lesson ›'),
        onFinish: (metrics) => {
            const threshold = Number(appSettings.accuracyTarget || 97);
            const passAcc = Math.min(97, threshold);
            const passed = metrics.accuracy >= passAcc && metrics.incorrect <= Math.max(3, Math.floor(metrics.targetChars * 0.05));
            if (typeof recordLearningEvent === 'function') recordLearningEvent('lessonAssessment', { lessonId: lesson.id, language: getActiveLanguage(), accuracy: metrics.accuracy, wpm: metrics.wpm });
            const stars = computeLessonStars(metrics, passed);
            const lb = recordLessonBest(lesson.id, metrics, stars);
            if (passed) { const completed = getCompletedLessons(); if (!completed.includes(lesson.id)) completed.push(lesson.id); if (levelId > getActiveLevel()) setActiveLevel(levelId); checkAchievements(metrics, {}); flushSaveData(); }
            const goToNext = nextLesson ? (() => runLesson(levelId, nextLesson, backContainer)) : null;
            const nextAfterLevel = (!nextLesson && passed) ? findNextLesson() : null;
            const goNextLevel = nextAfterLevel ? (() => runLesson(nextAfterLevel.levelId, nextAfterLevel.lesson, backContainer)) : null;
            showResultsScreen(metrics, {
                passed, stars, lessonBest: lb, passAcc,
                onContinue: backToList,
                onRetry: () => runLesson(levelId, lesson, backContainer),
                onNext: goToNext || goNextLevel,
                nextLabel: goToNext ? t('לשיעור הבא ›', 'Next lesson ›') : t('לרמה הבאה ›', 'Next level ›'),
                autoAdvance: appSettings.autoAdvance,
                autoAction: passed ? (goToNext || goNextLevel || backToList) : (() => runLesson(levelId, lesson, backContainer)),
                autoActionLabel: passed
                    ? ((goToNext || goNextLevel) ? t('עוברים לשיעור הבא', 'Moving to the next lesson') : t('חוזרים לתוכנית הלימודים', 'Back to the curriculum'))
                    : t('חוזרים על השיעור', 'Repeating this lesson')
            });
        }
    });
}

// ---- Results screen ----
let _autoAdvanceTimer = null;
let _resultsKeyHandler = null;
function cancelAutoAdvance() {
    if (_autoAdvanceTimer) { clearInterval(_autoAdvanceTimer); _autoAdvanceTimer = null; }
    const banner = document.getElementById('autoAdvanceBanner');
    if (banner) banner.remove();
}
function removeResultsKeys() { if (_resultsKeyHandler) { document.removeEventListener('keydown', _resultsKeyHandler); _resultsKeyHandler = null; } }

function sessionMistakeSummary(s) {
    if (!s || !s.errors || !s.errors.length) return [];
    const by = {};
    s.errors.forEach(e => { if (e.expected) by[e.expected] = (by[e.expected] || 0) + 1; });
    return Object.entries(by).sort((a, b) => b[1] - a[1]).slice(0, 6).map(([ch, n]) => ({ ch, n }));
}
function sessionSlowKeys(s) {
    if (!s || !s.keyTimes) return [];
    return Object.entries(s.keyTimes).filter(([ch, v]) => v.n >= 3 && ch !== ' ').map(([ch, v]) => ({ ch, ms: Math.round(v.ms / v.n) }))
        .sort((a, b) => b.ms - a.ms).slice(0, 5);
}
function sparklineSvg(points) {
    if (!points || points.length < 3) return '';
    const w = 260, h = 50, maxX = Math.max(...points.map(p => p[0]), 1), maxY = Math.max(...points.map(p => p[1]), 10);
    const d = points.map((p, i) => `${i ? 'L' : 'M'}${(p[0] / maxX * (w - 4) + 2).toFixed(1)},${(h - 2 - p[1] / maxY * (h - 8)).toFixed(1)}`).join(' ');
    return `<svg class="spark" viewBox="0 0 ${w} ${h}" dir="ltr"><path d="${d}" fill="none" stroke="var(--otz-primary)" stroke-width="2.2" stroke-linejoin="round"/></svg>`;
}

function showResultsScreen(metrics, opts) {
    cancelAutoAdvance(); removeResultsKeys();
    showScreen('resultsScreen');
    const screen = document.getElementById('resultsScreen');
    const s = lastFinishedSession;
    const rw = lastSessionRewards || {};
    const wpmVal = appSettings.wpmMethod === 'gross' ? metrics.wpm : metrics.netWpm;
    const failed = opts.passed === false;
    const enc = encouragementFor(metrics);
    const tip = coachTipFor(s, metrics);
    const mistakes = sessionMistakeSummary(s);
    const slow = sessionSlowKeys(s);
    const xp = getXpProgress();
    const showCh = c => c === ' ' ? '␣' : c;
    const title = failed ? t('כמעט! 💪', 'Almost! 💪') : (enc.tier === 'perfect' ? t('מושלם! 👑', 'Perfect! 👑') : t('כל הכבוד! 🎉', 'Great job! 🎉'));
    const pbs = (rw.personalBests || []).map(p => `<div class="pb-badge">${p.icon} ${t(p.he, p.en)}</div>`).join('');
    const ach = (rw.newAchievements || []).map(a => `<span class="achv-badge new">${a.icon} ${achievementLabel(a)}</span>`).join('');
    screen.innerHTML = `
        <div class="results-hero ${failed ? 'failed' : 'passed'}">
            <h2>${title}</h2>
            ${opts.stars !== undefined ? `<div class="results-stars">${[1, 2, 3].map(i => `<span class="rstar${i <= opts.stars ? ' on' : ''}" style="animation-delay:${0.15 + i * 0.22}s">★</span>`).join('')}</div>` : ''}
            <p class="results-encourage">${failed ? t(`צריך ${opts.passAcc || 97}% דיוק כדי לעבור. `, `You need ${opts.passAcc || 97}% accuracy to pass. `) : ''}${enc.text}</p>
            <div class="confetti-burst"></div>
        </div>
        ${pbs ? `<div class="pb-list">${pbs}</div>` : ''}
        <div class="results-grid">
            <div class="result-box"><div class="result-val">${wpmVal}</div><div class="result-lbl">${t('מילים לדקה', 'Words per minute')}</div></div>
            <div class="result-box"><div class="result-val ${metrics.accuracy >= 97 ? 'good' : metrics.accuracy < 90 ? 'bad' : ''}">${metrics.accuracy}%</div><div class="result-lbl">${t('דיוק', 'Accuracy')}</div></div>
            <div class="result-box"><div class="result-val">${metrics.incorrect}</div><div class="result-lbl">${t('שגיאות', 'Errors')}</div></div>
            <div class="result-box"><div class="result-val">${formatDuration(metrics.elapsedMs)}</div><div class="result-lbl">${t('זמן', 'Time')}</div></div>
            <div class="result-box"><div class="result-val">${metrics.maxCombo || 0}</div><div class="result-lbl">${t('רצף מרבי', 'Best combo')}</div></div>
            ${metrics.consistency !== null && metrics.consistency !== undefined ? `<div class="result-box"><div class="result-val">${metrics.consistency}</div><div class="result-lbl">${t('קצב אחיד', 'Rhythm')}</div></div>` : ''}
        </div>
        <div class="xp-card">
            <div class="xp-row"><span>${rankLabel(xp.rank)} · ${t('רמה', 'Level')} ${xp.level}</span><span class="xp-gain">${rw.xpGained ? '+' + rw.xpGained + ' XP' : ''}</span></div>
            <div class="xp-bar"><div class="xp-fill" style="width:${xp.pct}%"></div></div>
            <div class="xp-sub">${xp.into}/${xp.needed} XP ${t('לרמה הבאה', 'to next level')}${rw.streakBonus ? ` · 🔥 ${t('בונוס רצף', 'streak bonus')} +${rw.streakBonus}` : ''}</div>
        </div>
        ${ach ? `<div class="results-ach"><b>${t('הישגים חדשים:', 'New achievements:')}</b> ${ach}</div>` : ''}
        ${(mistakes.length || slow.length || (s && s.wpmTimeline && s.wpmTimeline.length >= 3)) ? `<div class="results-analysis">
            ${mistakes.length ? `<div><b>${t('אותיות שבהן טעיתם:', 'Keys you missed:')}</b> <span class="word-chip-list inline">${mistakes.map(m => `<span class="word-chip err"><bdi>${showCh(m.ch)}</bdi> ×${m.n}</span>`).join('')}</span></div>` : ''}
            ${slow.length ? `<div><b>${t('האותיות האיטיות ביותר:', 'Slowest keys:')}</b> <span class="word-chip-list inline">${slow.map(k => `<span class="word-chip"><bdi>${showCh(k.ch)}</bdi> ${(k.ms / 1000).toFixed(2)}${t('ש׳', 's')}</span>`).join('')}</span></div>` : ''}
            ${s && s.wpmTimeline && s.wpmTimeline.length >= 3 ? `<div class="spark-wrap"><b>${t('מהירות לאורך התרגיל:', 'Speed during the run:')}</b>${sparklineSvg(s.wpmTimeline)}</div>` : ''}
        </div>` : ''}
        ${tip ? `<p class="results-reco">${tip}</p>` : `<p class="results-reco">${buildRecommendation()}</p>`}
        <div class="results-actions">
            ${opts.onNext && !failed ? `<button class="btn primary big" id="btnResultsNext">${opts.nextLabel || t('לשיעור הבא ›', 'Next lesson ›')}</button>` : ''}
            <button class="btn ${failed || !opts.onNext ? 'primary big' : ''}" id="btnResultsRetry">↻ ${t('נסה שוב', 'Try again')}</button>
            ${mistakes.length ? `<button class="btn" id="btnResultsDrill">🎯 ${t('תרגלו את הטעויות', 'Drill my mistakes')}</button>` : ''}
            ${opts.onNext && failed ? `<button class="btn" id="btnResultsNext">${opts.nextLabel || t('לשיעור הבא ›', 'Next lesson ›')}</button>` : ''}
            <button class="btn" id="btnResultsContinue">${t('המשך', 'Continue')}</button>
        </div>
        <div class="results-keys-hint">${t('Enter = המשך · R = נסה שוב', 'Enter = continue · R = retry')}</div>
        ${opts.autoAdvance && opts.autoAction ? `
        <div class="auto-advance-banner" id="autoAdvanceBanner">
            <div class="aa-ring"><svg viewBox="0 0 36 36"><circle cx="18" cy="18" r="15.5"/></svg><b id="autoAdvanceCount">4</b></div>
            <span>${opts.autoActionLabel || t('ממשיכים אוטומטית', 'Continuing automatically')}...</span>
            <button class="btn-chip" id="btnCancelAutoAdvance">${t('בטל', 'Cancel')}</button>
        </div>` : ''}`;
    const go = fn => () => { cancelAutoAdvance(); removeResultsKeys(); fn(); };
    screen.querySelector('#btnResultsContinue').addEventListener('click', go(opts.onContinue));
    screen.querySelector('#btnResultsRetry').addEventListener('click', go(opts.onRetry));
    if (opts.onNext) screen.querySelector('#btnResultsNext').addEventListener('click', go(opts.onNext));
    const drillBtn = screen.querySelector('#btnResultsDrill');
    if (drillBtn) drillBtn.addEventListener('click', go(() => {
        const chars = mistakes.map(m => m.ch).filter(c => c !== ' ');
        const textD = generateCharDrill(Array.from(getKnownKeys()).concat(chars), Math.max(40, Number(appSettings.practiceLength) || 50), chars.concat(chars));
        startPracticeRun({ text: textD, mode: 'lesson', title: t('תרגול הטעויות שלי', 'Drill my mistakes'), onExit: opts.onContinue,
            onFinish: m => showResultsScreen(m, { onContinue: opts.onContinue, onRetry: () => drillBtn.click() }) });
    }));
    if (!failed) renderConfetti(screen.querySelector('.confetti-burst'));
    if (!failed && (enc.tier === 'perfect' || (rw.personalBests || []).length || opts.stars === 3)) burstConfetti();

    _resultsKeyHandler = (e) => {
        if (screen.style.display === 'none') { removeResultsKeys(); return; }
        if (e.ctrlKey || e.metaKey || e.altKey || e.repeat) return;
        if (e.key === 'Enter') { e.preventDefault(); const b = screen.querySelector('.results-actions .btn.primary'); if (b) b.click(); }
        else if (e.code === 'KeyR') { e.preventDefault(); screen.querySelector('#btnResultsRetry').click(); }
        else if (e.key === 'Escape') { e.preventDefault(); screen.querySelector('#btnResultsContinue').click(); }
    };
    setTimeout(() => { if (screen.style.display !== 'none') document.addEventListener('keydown', _resultsKeyHandler); }, 350);

    if (opts.autoAdvance && opts.autoAction) {
        let remaining = 4;
        const countEl = screen.querySelector('#autoAdvanceCount');
        _autoAdvanceTimer = setInterval(() => {
            remaining--;
            if (screen.style.display === 'none' || !document.body.contains(countEl)) { cancelAutoAdvance(); return; }
            if (remaining <= 0) { cancelAutoAdvance(); removeResultsKeys(); opts.autoAction(); }
            else countEl.textContent = remaining;
        }, 1000);
        screen.querySelector('#btnCancelAutoAdvance').addEventListener('click', cancelAutoAdvance);
    }
}

// ---- small confetti for a successful run (respects "reduce motion") ----
function renderConfetti(el) {
    if (!el || appSettings.reduceMotion) return;
    const pieces = ['🎉', '✨', '⭐', '🎊'];
    let html = '';
    for (let i = 0; i < 14; i++) {
        const left = Math.round(Math.random() * 100);
        const delay = (Math.random() * 0.35).toFixed(2);
        const dur = (0.9 + Math.random() * 0.6).toFixed(2);
        const emoji = pieces[Math.floor(Math.random() * pieces.length)];
        html += `<span class="confetti-piece" style="left:${left}%;animation-delay:${delay}s;animation-duration:${dur}s">${emoji}</span>`;
    }
    el.innerHTML = html;
}
