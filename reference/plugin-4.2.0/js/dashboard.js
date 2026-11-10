// ---- לוח בקרה ----

function greetingText() {
    const h = new Date().getHours();
    if (h < 5) return t('לילה טוב', 'Good night');
    if (h < 12) return t('בוקר טוב', 'Good morning');
    if (h < 17) return t('צהריים טובים', 'Good afternoon');
    if (h < 21) return t('ערב טוב', 'Good evening');
    return t('לילה טוב', 'Good night');
}
function streakMessage() {
    const st = appData.progress.streakDays || 0;
    const today = appData.progress.lastPracticeDate === localDateKey();
    if (!appData.sessionSummary.count) return t('ברוכים הבאים! בואו נתחיל את המסע להקלדה עיוורת 🚀', 'Welcome! Let\'s start your touch-typing journey 🚀');
    if (today && st >= 2) return t(`🔥 ${st} ימים ברצף — מדהים! תמשיכו כך.`, `🔥 ${st} days in a row — amazing! Keep it going.`);
    if (today) return t('כבר תרגלתם היום — כל הכבוד! 👏', 'You already practiced today — well done! 👏');
    if (st >= 1) return t(`יש לכם רצף של ${st} ימים — תרגלו היום כדי לשמור עליו 🔥`, `You have a ${st}-day streak — practice today to keep it 🔥`);
    return t('כמה דקות היום ואתם בדרך לרצף חדש 🌱', 'A few minutes today starts a new streak 🌱');
}

function renderDashboard(container) {
    const s = appData.sessionSummary;
    const avgWpm = s.count ? Math.round(s.totalWpm / s.count) : 0;
    const avgAcc = s.count ? Math.round((s.totalAccuracy / s.count) * 10) / 10 : 0;
    const totalChars = Object.values(appData.charStats).reduce((a, c) => a + c.correct, 0);
    const totalMinutes = Math.round((appData.sessionSummary.totalDurationMs || appData.sessions.reduce((a, sess) => a + sess.durationMs, 0)) / 60000);
    const xp = getXpProgress();
    const next = findNextLesson();
    const profName = (typeof appData.advanced === 'object' && appData.advanced.profiles) ? ((appData.advanced.profiles.find(p => p.id === appData.advanced.activeProfileId) || {}).name || '') : '';

    const goalMin = getDailyGoalMinutes(), todayMin = Math.floor(getTodayMinutes());
    const goalPct = Math.max(0, Math.min(100, Math.round(todayMin / goalMin * 100)));
    const tab = (window.__dashTab = window.__dashTab || 'overview');
    const tabBtn = (id, he, en) => `<button type="button" role="tab" class="seg-btn${tab === id ? ' active' : ''}" data-tab="${id}" aria-selected="${tab === id}">${t(he, en)}</button>`;
    const pane = (id, html) => `<div class="dash-pane${tab === id ? ' active' : ''}" data-pane="${id}" role="tabpanel">${html}</div>`;

    container.innerHTML = `
        <div class="home-hero">
            <div class="hh-main">
                <div class="hh-greet">${greetingText()}${profName && profName !== 'הלומד' && profName !== 'Learner' ? ', ' + escapeHtmlDash(profName) : ''}</div>
                ${next ? `<div class="hh-next-lbl">${t('הצעד הבא שלכם', 'Your next step')}</div>
                <div class="hh-next">${escapeHtmlDash(next.lesson.title)}</div>` : `<div class="hh-next">${t('כל השיעורים הושלמו', 'Every lesson is complete')}</div>`}
                <div class="hh-actions">
                    ${next ? `<button class="btn primary big" id="btnDashContinue">${t('המשך ללמוד', 'Continue learning')}</button>` : `<button class="btn primary big" id="btnDashToday">${t('לתוכנית של היום', "Today's plan")}</button>`}
                    <button class="btn ghost" id="btnDashNonStop" title="${t('ממשיכים לתרגל את השיעור הנוכחי עד שהטיימר היומי נגמר', 'Keep practicing your current lesson until the daily timer ends')}">${t('תרגול רציף', 'Non-stop practice')}</button>
                    <button class="btn ghost" id="btnDashGame">${t('משחק הקלדה', 'Typing game')}</button>
                </div>
                <div class="hh-msg">${streakMessage()}</div>
            </div>
            <div class="hh-side">
                <div class="goal-ring${goalPct >= 100 ? ' done' : ''}" style="--p:${goalPct}">
                    <div class="gr-inner"><b>${todayMin}</b><span>/ ${goalMin} ${t('דק׳', 'min')}</span></div>
                </div>
                <div class="hh-side-lbl">${goalPct >= 100 ? t('היעד היומי הושלם', 'Daily goal done') : t('יעד יומי', 'Daily goal')}</div>
                <div class="hh-rank">
                    <div class="hh-rank-row"><span>${rankLabel(xp.rank)}</span><span>${t('רמה', 'Level')} ${xp.level}</span></div>
                    <div class="xp-bar"><div class="xp-fill" style="width:${xp.pct}%"></div></div>
                    <span class="xp-sub">${xp.into}/${xp.needed} XP</span>
                </div>
            </div>
        </div>

        <div class="stat-strip">
            <div class="ss-item"><b>${s.bestWpm}</b><span>${t('שיא מ״לד', 'Best WPM')}</span></div>
            <div class="ss-item"><b>${avgWpm}</b><span>${t('ממוצע מ״לד', 'Average WPM')}</span></div>
            <div class="ss-item"><b>${avgAcc}%</b><span>${t('דיוק ממוצע', 'Average accuracy')}</span></div>
            <div class="ss-item"><b>${appData.progress.streakDays}</b><span>${t('ימי רצף', 'Day streak')}</span></div>
            <div class="ss-item"><b>${totalChars.toLocaleString()}</b><span>${t('תווים נכונים', 'Correct characters')}</span></div>
            <div class="ss-item"><b>${totalMinutes}</b><span>${t('דקות תרגול', 'Practice minutes')}</span></div>
        </div>

        <div class="seg-tabs" role="tablist" id="dashTabs">
            ${tabBtn('overview', 'סקירה', 'Overview')}
            ${tabBtn('weak', 'מה לחזק', 'What to strengthen')}
            ${tabBtn('charts', 'גרפים ומפת חום', 'Charts & heatmap')}
            ${tabBtn('achv', 'הישגים', 'Achievements')}
            ${tabBtn('goals', 'יעדים', 'Goals')}
        </div>

        ${pane('overview', `
            <div class="dash-section">
                <h3>כמה זמן יש לכם?</h3>
                <p class="empty-note">נבנה עבורכם תרגול מותאם — חימום קצר, חזרה על אותיות שדורשות חיזוק, ותרגול עיקרי.</p>
                <div class="quick-practice-buttons"></div>
            </div>
            <div class="dash-section">
                <h3>${t('פעילות ב-12 השבועות האחרונים', 'Activity — last 12 weeks')}</h3>
                <div id="activityCalendar"></div>
            </div>
            <div class="dash-section" id="periodCompareSection"></div>
            <div class="dash-section" id="weeklyPlanSection"></div>
        `)}
        ${pane('weak', `
            <div class="dash-section" id="labSummarySection"></div>
            <div class="dash-section" id="reviewDueSection"></div>
            <div class="dash-section" id="slowWordsSection"></div>
            <div class="dash-section" id="errorRetrainingSection"></div>
            <div class="dash-section" id="weakBigramSection"></div>
            <div class="dash-section" id="trigramSection"></div>
            <div class="two-col">
                <div class="dash-section"><h3>שגיאות נפוצות</h3><div id="errorMatrixTable"></div></div>
                <div class="dash-section"><h3>מילים מאתגרות</h3><div id="weakWordsList"></div></div>
            </div>
            <div class="dash-section" id="recentSessionsSection"></div>
        `)}
        ${pane('charts', `
            <div class="dash-section">
                <h3>מהירות ודיוק לאורך זמן</h3>
                <canvas id="chartWpm" width="640" height="200"></canvas>
            </div>
            <div class="dash-section">
                <div class="section-head">
                    <h3>מפת חום — מקלדת</h3>
                    <div class="heat-controls seg-mini" id="heatControls">
                        <button class="btn-chip active" data-metric="accuracy">דיוק</button>
                        <button class="btn-chip" data-metric="speed">מהירות</button>
                        <button class="btn-chip" data-metric="frequency">תדירות תרגול</button>
                    </div>
                </div>
                <div id="dashKeyboard"></div>
            </div>
        `)}
        ${pane('achv', `<div class="dash-section"><div id="achievementsList"></div></div>`)}
        ${pane('goals', `<div class="dash-section"><h3>יעדים</h3><div id="goalsPanel"></div></div>`)}
    `;

    container.querySelectorAll('#dashTabs .seg-btn').forEach(btn => btn.addEventListener('click', () => {
        window.__dashTab = btn.dataset.tab;
        container.querySelectorAll('#dashTabs .seg-btn').forEach(b => { const on = b === btn; b.classList.toggle('active', on); b.setAttribute('aria-selected', on); });
        container.querySelectorAll('.dash-pane').forEach(p => p.classList.toggle('active', p.dataset.pane === btn.dataset.tab));
        if (btn.dataset.tab === 'charts') drawWpmChart(container.querySelector('#chartWpm'));
    }));

    const cont = container.querySelector('#btnDashContinue');
    if (cont) cont.addEventListener('click', () => { navigateTo('lessonsScreen', { silent: true }); runLesson(next.levelId, next.lesson, document.getElementById('lessonsScreen')); });
    const td = container.querySelector('#btnDashToday');
    if (td) td.addEventListener('click', () => navigateTo('todayScreen'));
    container.querySelector('#btnDashGame').addEventListener('click', () => navigateTo('gamesScreen'));
    container.querySelector('#btnDashNonStop').addEventListener('click', startNonStopCurrent);
    renderActivityCalendar(container.querySelector('#activityCalendar'));
    renderPeriodComparison(container.querySelector('#periodCompareSection'));
    renderQuickPracticeButtons(container.querySelector('.quick-practice-buttons'), container);
    renderReviewDueSection(container.querySelector('#reviewDueSection'), container);
    if (typeof renderLearningLabSummary === 'function') renderLearningLabSummary(container.querySelector('#labSummarySection'));
    if (typeof renderRecentSessionsTable === 'function') renderRecentSessionsTable(container.querySelector('#recentSessionsSection'));
    renderSlowWordsSection(container.querySelector('#slowWordsSection'), container);
    renderWeakBigramSection(container.querySelector('#weakBigramSection'), container);
    renderErrorRetrainingSection(container.querySelector('#errorRetrainingSection'), container);
    renderTrigramSection(container.querySelector('#trigramSection'), container);
    renderWeeklyPlanSection(container.querySelector('#weeklyPlanSection'), container);
    drawWpmChart(container.querySelector('#chartWpm'));
    renderKeyboardHeatmap(container.querySelector('#dashKeyboard'), 'accuracy');
    container.querySelectorAll('#heatControls .btn-chip').forEach(btn => {
        btn.addEventListener('click', () => {
            container.querySelectorAll('#heatControls .btn-chip').forEach(b => b.classList.remove('active'));
            btn.classList.add('active');
            renderKeyboardHeatmap(container.querySelector('#dashKeyboard'), btn.dataset.metric);
        });
    });

    renderErrorMatrixTable(container.querySelector('#errorMatrixTable'));
    renderWeakWordsList(container.querySelector('#weakWordsList'));
    renderAchievements(container.querySelector('#achievementsList'));
    renderGoalsPanel(container.querySelector('#goalsPanel'));
}

// ---- השוואת תקופות: השבוע מול השבוע הקודם (חלקים 37-38 במפרט) ----
// זו השוואת *ביצועים בתרגול*, ולא בהכרח "למידה" או שימור. לכן מוצגים המספרים
// וההפרש בלבד, בלי שיפוט — ההבחנה בין ביצוע, למידה, שימור ואוטומטיות מוצגת
// במעבדת הלמידה.
function periodStats(sessions) {
    if (!sessions.length) return null;
    const totalWpm = sessions.reduce((a, s) => a + (s.netWpm || s.wpm || 0), 0);
    const totalAcc = sessions.reduce((a, s) => a + (s.accuracy || 0), 0);
    const totalMin = sessions.reduce((a, s) => a + (s.durationMs || 0), 0) / 60000;
    return {
        count: sessions.length,
        avgWpm: Math.round(totalWpm / sessions.length),
        avgAcc: Math.round((totalAcc / sessions.length) * 10) / 10,
        minutes: Math.round(totalMin)
    };
}

function renderPeriodComparison(el) {
    if (!el) return;
    const now = Date.now();
    const DAY = 86400000;
    const thisWeek = appData.sessions.filter(s => s && s.date && now - new Date(s.date).getTime() < 7 * DAY);
    const lastWeek = appData.sessions.filter(s => {
        if (!s || !s.date) return false;
        const age = now - new Date(s.date).getTime();
        return age >= 7 * DAY && age < 14 * DAY;
    });
    const cur = periodStats(thisWeek);
    const prev = periodStats(lastWeek);
    if (!cur) {
        el.innerHTML = '<h3>השבוע מול השבוע הקודם</h3><p class="empty-note">עוד אין תרגולים השבוע.</p>';
        return;
    }
    function diffChip(curVal, prevVal, unit) {
        if (prev === null) return '<span class="empty-note">אין נתונים משבוע קודם להשוואה</span>';
        const diff = Math.round((curVal - prevVal) * 10) / 10;
        const sign = diff > 0 ? '+' : '';
        const cls = diff > 0 ? 'diff-up' : (diff < 0 ? 'diff-down' : 'diff-flat');
        return `<span class="period-diff ${cls}">${sign}${diff}${unit} ${t('מהשבוע הקודם', 'vs last week')}</span>`;
    }
    el.innerHTML = `
        <h3>השבוע מול השבוע הקודם</h3>
        <div class="dash-summary">
            <div class="dash-stat"><div class="dash-val">${cur.avgWpm}</div><div class="dash-lbl">מ״לד ממוצע השבוע</div>${diffChip(cur.avgWpm, prev ? prev.avgWpm : 0, '')}</div>
            <div class="dash-stat"><div class="dash-val">${cur.avgAcc}%</div><div class="dash-lbl">דיוק ממוצע השבוע</div>${diffChip(cur.avgAcc, prev ? prev.avgAcc : 0, '%')}</div>
            <div class="dash-stat"><div class="dash-val">${cur.minutes}</div><div class="dash-lbl">דקות תרגול השבוע</div>${diffChip(cur.minutes, prev ? prev.minutes : 0, '')}</div>
        </div>
        <p class="empty-note">השוואת ביצועים בתרגול בלבד — לא מדד ישיר לשימור או לאוטומטיות.</p>
    `;
}

function drawWpmChart(canvas) {
    let ctx;
    try { ctx = canvas.getContext('2d'); } catch (e) { ctx = null; }
    if (!ctx) return;
    const dpr = window.devicePixelRatio || 1;
    const cssW = Math.max(280, Math.min(860, (canvas.parentElement && canvas.parentElement.clientWidth) || 640)), cssH = 220;
    canvas.width = cssW * dpr; canvas.height = cssH * dpr; canvas.style.width = cssW + 'px'; canvas.style.height = cssH + 'px';
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    const w = cssW, h = cssH;
    ctx.clearRect(0, 0, w, h);
    const font = getCssVar('--otz-font') || 'sans-serif';
    const muted = getCssVar('--otz-on-surface-variant') || '#888';
    const sessions = appData.sessions.filter(x => (x.chars || 0) >= 10).slice(-40);
    if (sessions.length < 2) {
        ctx.fillStyle = muted; ctx.font = '14px ' + font; ctx.textAlign = 'center';
        ctx.fillText(t('דרושים לפחות שני תרגולים כדי להציג גרף', 'At least two sessions are needed to draw a chart'), w / 2, h / 2);
        return;
    }
    const padL = 34, padR = 34, padT = 26, padB = 22;
    const vals = sessions.map(x => x.netWpm ?? x.wpm ?? 0);
    const maxWpm = Math.max(10, Math.ceil(Math.max(...vals) / 10) * 10);
    const stepX = (w - padL - padR) / (sessions.length - 1);
    const yW = v => h - padB - (v / maxWpm) * (h - padT - padB);
    const yA = v => h - padB - (Math.max(50, v) - 50) / 50 * (h - padT - padB);
    ctx.strokeStyle = getCssVar('--otz-outline') || '#ddd'; ctx.lineWidth = 1; ctx.fillStyle = muted; ctx.font = '11px ' + font;
    for (let i = 0; i <= 4; i++) {
        const y = padT + i * (h - padT - padB) / 4;
        ctx.beginPath(); ctx.moveTo(padL, y); ctx.lineTo(w - padR, y); ctx.stroke();
        ctx.textAlign = 'right'; ctx.fillText(String(Math.round(maxWpm * (1 - i / 4))), padL - 4, y + 4);
        ctx.textAlign = 'left'; ctx.fillText(String(Math.round(100 - i * 12.5)) + '%', w - padR + 4, y + 4);
    }
    function line(getY, color, area) {
        ctx.beginPath();
        sessions.forEach((x, i) => { const px = padL + i * stepX, py = getY(x); if (i === 0) ctx.moveTo(px, py); else ctx.lineTo(px, py); });
        ctx.strokeStyle = color; ctx.lineWidth = 2.2; ctx.lineJoin = 'round'; ctx.stroke();
        if (area) { ctx.lineTo(padL + (sessions.length - 1) * stepX, h - padB); ctx.lineTo(padL, h - padB); ctx.closePath(); ctx.globalAlpha = 0.12; ctx.fillStyle = color; ctx.fill(); ctx.globalAlpha = 1; }
    }
    line(x => yA(x.accuracy || 0), '#33c17a', false);
    line(x => yW(x.netWpm ?? x.wpm ?? 0), '#4f8cf7', true);
    ctx.fillStyle = getCssVar('--otz-on-surface') || '#333'; ctx.font = '12px ' + font; ctx.textAlign = 'center';
    ctx.fillText(t('כחול = מ״לד (שמאל) · ירוק = דיוק% (ימין)', 'Blue = WPM (left) · Green = accuracy % (right)'), w / 2, 14);
}

function getCssVar(name) {
    return getComputedStyle(document.documentElement).getPropertyValue(name).trim();
}

function renderErrorMatrixTable(el) {
    const rows = getErrorMatrixTop(8);
    if (!rows.length) { el.innerHTML = '<p class="empty-note">אין עדיין מספיק נתוני שגיאות.</p>'; return; }
    el.innerHTML = `<table class="data-table"><thead><tr><th>צפוי</th><th>הוקלד</th><th>פעמים</th></tr></thead><tbody>
        ${rows.map(r => `<tr><td>${r.expected === ' ' ? '␣' : escapeHtmlDash(r.expected)}</td><td>${r.typed === ' ' ? '␣' : escapeHtmlDash(r.typed)}</td><td>${r.count}</td></tr>`).join('')}
    </tbody></table>`;
}

function renderWeakWordsList(el) {
    const words = Object.entries(appData.wordStats)
        .map(([w, st]) => ({ w, acc: st.correct / st.attempts, attempts: st.attempts }))
        .filter(x => x.attempts >= 2)
        .sort((a, b) => a.acc - b.acc)
        .slice(0, 10);
    if (!words.length) { el.innerHTML = '<p class="empty-note">אין עדיין מספיק נתוני מילים.</p>'; return; }
    el.innerHTML = '<div class="word-chip-list">' + words.map(x => `<span class="word-chip">${x.w}</span>`).join('') + '</div>';
}

function renderAchievements(el) {
    const have = new Set(appData.achievements);
    const total = ACHIEVEMENT_DEFS.length, got = ACHIEVEMENT_DEFS.filter(a => have.has(a.id)).length;
    el.innerHTML = `<div class="achv-summary"><b>${got}</b>/${total} ${t('הישגים נפתחו', 'unlocked')}<div class="achv-sumbar"><span style="width:${Math.round(got / total * 100)}%"></span></div></div><div class="achv-grid">` + ACHIEVEMENT_DEFS.map(a => {
        let r = have.has(a.id) ? 2 : 0;
        if (!r && a.progress) { try { const [c, n] = a.progress(appData); r = Math.min(1, c / n); } catch (e) {} }
        return { a, r };
    }).sort((x, y) => y.r - x.r).map(({ a }) => {
        const on = have.has(a.id);
        let prog = '';
        if (!on && a.progress) { try { const [c, n] = a.progress(appData); prog = `<div class="achv-prog"><span style="width:${Math.min(100, Math.round(c / n * 100))}%"></span></div>`; } catch (e) {} }
        return `<div class="achv-card${on ? ' on' : ''}" title="${escapeHtmlDash(t(a.dhe, a.den))}"><div class="achv-icon">${on ? a.icon : '🔒'}</div><div class="achv-name">${escapeHtmlDash(achievementLabel(a))}</div><div class="achv-desc">${escapeHtmlDash(t(a.dhe, a.den))}</div>${prog}</div>`;
    }).join('') + '</div>';
}
function escapeHtmlDash(v) { return String(v ?? '').replace(/[&<>"']/g, m => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[m])); }

// GitHub-style calendar of practice minutes per day
function renderActivityCalendar(el) {
    if (!el) return;
    const byDay = {};
    appData.sessions.forEach(x => { if (!x || !x.date) return; const k = localDateKey(new Date(x.date)); byDay[k] = (byDay[k] || 0) + (x.durationMs || 0); });
    (appData.progress.goalDays || []).forEach(k => { if (!byDay[k]) byDay[k] = 1; });
    const goalMs = getDailyGoalMinutes() * 60000;
    const end = new Date(); end.setHours(12, 0, 0, 0);
    const start = new Date(end); start.setDate(start.getDate() - (7 * 12 - 1) - start.getDay());
    let cells = '';
    const d = new Date(start);
    let activeDays = 0;
    while (d <= end) {
        const k = localDateKey(d), ms = byDay[k] || 0;
        const lvl = ms <= 0 ? 0 : ms < goalMs * 0.34 ? 1 : ms < goalMs * 0.67 ? 2 : ms < goalMs ? 3 : 4;
        if (ms > 0) activeDays++;
        cells += `<i class="cal-cell l${lvl}${k === localDateKey() ? ' today' : ''}" title="${k}: ${Math.round(ms / 60000)} ${t('דק׳', 'min')}"></i>`;
        d.setDate(d.getDate() + 1);
    }
    el.innerHTML = `<div class="cal-grid" dir="ltr">${cells}</div><div class="cal-legend"><span>${activeDays} ${t('ימי תרגול', 'practice days')}</span><span class="cal-scale">${t('פחות', 'less')} <i class="cal-cell l0"></i><i class="cal-cell l1"></i><i class="cal-cell l2"></i><i class="cal-cell l3"></i><i class="cal-cell l4"></i> ${t('יעד', 'goal')}</span></div>`;
}

function renderQuickPracticeButtons(el, dashContainer) {
    el.innerHTML = MICRO_LESSON_MINUTES.map(m =>
        `<button class="btn-chip" data-min="${m}">${m} דקות</button>`
    ).join('');
    el.querySelectorAll('.btn-chip').forEach(btn => {
        btn.addEventListener('click', () => startQuickPractice(parseInt(btn.dataset.min, 10), dashContainer));
    });
}

function startQuickPractice(minutes, dashContainer) {
    const text = buildMicroLesson(minutes);
    if (!text) { otzShowMessage(t('אין עדיין מספיק נתונים לבניית תרגול — נסו שיעור מתוכנית הלימודים קודם.', 'Not enough data to build a session yet — try a curriculum lesson first.'), 'info'); return; }
    showScreen('practiceScreen');
    startPracticeRun({
        text,
        mode: 'lesson',
        title: t(`תרגול מותאם — ${minutes} דקות`, `Personalised practice — ${minutes} min`),
        onExit: () => { showScreen('dashboardScreen'); renderDashboard(dashContainer); },
        onFinish: (metrics) => showResultsScreen(metrics, {
            onContinue: () => { showScreen('dashboardScreen'); renderDashboard(dashContainer); },
            onRetry: () => startQuickPractice(minutes, dashContainer)
        })
    });
}

function renderReviewDueSection(el, dashContainer) {
    const due = getDueForReview(10);
    if (!due.length) {
        el.innerHTML = '<h3>חזרה מתוזמנת</h3><p class="empty-note">אין כרגע אותיות שממתינות לחזרה — כל הכבוד על השמירה על הרצף!</p>';
        return;
    }
    el.innerHTML = `
        <h3>חזרה מתוזמנת</h3>
        <p class="empty-note">האותיות האלה נלמדו בעבר וכדאי לחזק אותן כדי לשמור על השליטה בהן:</p>
        <div class="word-chip-list">${due.map(d => `<span class="word-chip">${d.ch}</span>`).join('')}</div>
        <button class="btn" id="btnStartReview" style="margin-top:10px">התחל תרגול חזרה</button>
    `;
    el.querySelector('#btnStartReview').addEventListener('click', () => {
        const text = generateCharDrill(getKnownKeys(), Math.max(30, Number(appSettings.practiceLength) || 50), due.map(d => d.ch));
        showScreen('practiceScreen');
        startPracticeRun({
            text,
            mode: 'lesson',
            title: t('תרגול חזרה', 'Review practice'),
            onExit: () => { showScreen('dashboardScreen'); renderDashboard(dashContainer); },
            onFinish: (metrics) => showResultsScreen(metrics, {
                onContinue: () => { showScreen('dashboardScreen'); renderDashboard(dashContainer); },
                onRetry: () => el.querySelector('#btnStartReview').click()
            })
        });
    });
}

function renderWeakBigramSection(el, dashContainer) {
    const weak = getWeakBigrams(6);
    if (!weak.length) {
        el.innerHTML = '<h3>מעברים מאתגרים</h3><p class="empty-note">עוד לא נאספו מספיק נתונים על מעברים בין אותיות.</p>';
        return;
    }
    el.innerHTML = `
        <h3>מעברים מאתגרים</h3>
        <p class="empty-note">צירופי אותיות אלו איטיים או שגויים יחסית, גם כשכל אות בנפרד נשלטת:</p>
        <div class="word-chip-list">${weak.map(w => `<span class="word-chip" title="${w.attempts}">${escapeHtmlDash(w.bg)} · ${w.score}%</span>`).join('')}</div>
        <button class="btn" id="btnPracticeBigrams" style="margin-top:10px">תרגל מעברים אלו</button>
    `;
    el.querySelector('#btnPracticeBigrams').addEventListener('click', () => {
        const text = generateBigramDrill(weak.map(w => w.bg));
        showScreen('practiceScreen');
        startPracticeRun({
            text,
            mode: 'lesson',
            title: t('תרגול מעברים', 'Transition practice'),
            onExit: () => { showScreen('dashboardScreen'); renderDashboard(dashContainer); },
            onFinish: (metrics) => showResultsScreen(metrics, {
                onContinue: () => { showScreen('dashboardScreen'); renderDashboard(dashContainer); },
                onRetry: () => el.querySelector('#btnPracticeBigrams').click()
            })
        });
    });
}

// 4.1: frequent words that are still typed slowly (per-word speed) — chunk drill
function renderSlowWordsSection(el, dashContainer) {
    if (!el) return;
    const slow = typeof getSlowCommonWords === 'function' ? getSlowCommonWords(10) : [];
    const canDrill = typeof generateChunkDrill === 'function' && !!generateChunkDrill(60);
    el.innerHTML = `<h3>${t('מילים נפוצות שכדאי לזרז', 'Frequent words to speed up')}</h3>
        <p class="empty-note">${t('מילים כמו "של", "את", "על" מופיעות בכל משפט. כשמקלידים אותן כיחידה אחת — לא אות אחר אות — כל הטקסט נעשה מהיר יותר.', 'Words like "the", "of", "and" are in every sentence. Typing them as one unit — not letter by letter — speeds up all your text.')}</p>
        ${slow.length ? `<div class="word-chip-list">${slow.map(x => `<span class="word-chip"><bdi>${escapeHtmlDash(x.w)}</bdi> · ${x.ms}${t('ms לאות', 'ms/char')}</span>`).join('')}</div>` : `<p class="empty-note">${t('עדיין אין מילים נפוצות איטיות במיוחד — מעולה.', 'No especially slow frequent words yet — great.')}</p>`}
        ${canDrill ? `<button class="btn" id="btnChunkDrill" style="margin-top:10px">🧩 ${t('תרגול מילים נפוצות', 'Frequent-word drill')}</button>` : ''}`;
    const b = el.querySelector('#btnChunkDrill');
    if (b) b.addEventListener('click', () => {
        const back = () => { showScreen('dashboardScreen'); renderDashboard(dashContainer); };
        showScreen('practiceScreen');
        startPracticeRun({ text: generateChunkDrill(160), mode: 'lesson', title: t('מילים נפוצות', 'Frequent words'),
            tip: t('🧩 הקלידו כל מילה כתנועה אחת רציפה. כל מילה מופיעה פעמיים: פעם למצוא אותה, ופעם כיחידה.', '🧩 Type each word as one flowing movement. Each appears twice: once to find it, once as a unit.'),
            onExit: back, onFinish: m => showResultsScreen(m, { onContinue: back, onRetry: () => b.click() }) });
    });
}

const WEEKLY_PLAN = [
    { day: 0, label: 'ראשון', focus: 'מיומנויות חדשות', desc: 'המשך בתוכנית הלימודים לפי הרמה הנוכחית' },
    { day: 1, label: 'שני', focus: 'חיזוק', desc: 'תרגול חזרה על אותיות ומעברים חלשים' },
    { day: 2, label: 'שלישי', focus: 'מיומנויות חדשות', desc: 'המשך בתוכנית הלימודים לפי הרמה הנוכחית' },
    { day: 3, label: 'רביעי', focus: 'תיקון חולשות', desc: 'תרגול ממוקד באותיות ובמעברים המאתגרים ביותר' },
    { day: 4, label: 'חמישי', focus: 'תרגול מעורב', desc: 'טקסט טבעי המשלב הכל יחד' },
    { day: 5, label: 'שישי', focus: 'תרגול קל', desc: 'סבב קצר לשמירה על הרצף' },
    { day: 6, label: 'שבת', focus: 'הערכה', desc: 'מבחן הקלדה קצר לבדיקת התקדמות' }
];

function renderWeeklyPlanSection(el, dashContainer) {
    const todayIdx = new Date().getDay();
    el.innerHTML = `
        <h3>תוכנית שבועית</h3>
        <div class="weekly-plan-grid">
            ${WEEKLY_PLAN.map(d => `
                <div class="weekly-plan-day${d.day === todayIdx ? ' today' : ''}">
                    <div class="wp-day-label">${d.label}</div>
                    <div class="wp-day-focus">${d.focus}</div>
                    <div class="wp-day-desc">${d.desc}</div>
                </div>
            `).join('')}
        </div>
    `;
}

function renderGoalsPanel(el) {
    const g = appData.goals;
    el.innerHTML = `
        <div class="goals-form">
            <label>יעד מ״לד: <input type="number" id="goalWpm" value="${g.targetWpm}" min="5" max="200"></label>
            <label>יעד דיוק %: <input type="number" id="goalAcc" value="${g.targetAccuracy}" min="50" max="100"></label>
            <label>דקות ביום: <input type="number" id="goalMin" value="${getDailyGoalMinutes()}" min="1" max="240"></label>
            <button class="btn" id="btnSaveGoals">שמור יעדים</button>
        </div>
    `;
    el.querySelector('#btnSaveGoals').addEventListener('click', () => {
        appData.goals.targetWpm = parseInt(el.querySelector('#goalWpm').value, 10) || g.targetWpm;
        appData.goals.targetAccuracy = parseInt(el.querySelector('#goalAcc').value, 10) || g.targetAccuracy;
        appData.goals.dailyMinutes = Math.max(1, Math.min(240, parseInt(el.querySelector('#goalMin').value, 10) || g.dailyMinutes));
        appSettings.dailyLimitMinutes = appData.goals.dailyMinutes;
        saveSettings();
        scheduleSaveData();
        refreshHeaderStatus();
        otzShowMessage(t('היעדים נשמרו', 'Goals saved'), 'success');
    });
}


function renderErrorRetrainingSection(el, dashContainer) {
    const pairs = getTopErrorPairs(5);
    if (!pairs.length) {
        el.innerHTML = '<h3>לולאת תיקון שגיאות</h3><p class="empty-note">עדיין אין מספיק שגיאות חוזרות כדי לבנות תרגול ממוקד.</p>';
        return;
    }
    el.innerHTML = `<h3>לולאת תיקון שגיאות</h3>
        <p class="empty-note">המערכת מזהה החלפות חוזרות ומבודדת אותן לפני חזרה לטקסט טבעי.</p>
        <div class="word-chip-list">${pairs.map(p => `<span class="word-chip">${p.expected} → ${p.typed} (${p.count})</span>`).join('')}</div>
        <button class="btn" id="btnErrorRetrain">תרגל את השגיאות</button>`;
    el.querySelector('#btnErrorRetrain').addEventListener('click', () => {
        const text = generateErrorRetrainingDrill(pairs);
        showScreen('practiceScreen');
        startPracticeRun({ text, mode: 'lesson', title: t('תיקון שגיאות ממוקד', 'Focused error correction'),
            onExit: () => { showScreen('dashboardScreen'); renderDashboard(dashContainer); },
            onFinish: m => showResultsScreen(m, {
                onContinue: () => { showScreen('dashboardScreen'); renderDashboard(dashContainer); },
                onRetry: () => el.querySelector('#btnErrorRetrain').click()
            })});
    });
}

function renderTrigramSection(el, dashContainer) {
    const rows = Object.entries(appData.trigramStats || {})
        .filter(([,s]) => s.attempts >= 3)
        .map(([trigram,s]) => ({ trigram, score: Math.round(s.correct/s.attempts*100), attempts:s.attempts }))
        .sort((a,b)=>a.score-b.score).slice(0,6);
    if (!rows.length) {
        el.innerHTML = '<h3>מעברים של שלושה תווים</h3><p class="empty-note">נאספים נתונים על רצפי שלושה תווים; עדיין אין מספיק נתונים.</p>';
        return;
    }
    el.innerHTML = `<h3>מעברים של שלושה תווים</h3>
        <div class="word-chip-list">${rows.map(r => `<span class="word-chip">${r.trigram} — ${r.score}%</span>`).join(' ')}</div>`;
}
