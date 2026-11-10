// ---- אתחול האפליקציה ----

const NAV_ITEMS = [
    { id: 'todayScreen', label: 'היום שלי', render: renderTodayScreen },
    { id: 'dashboardScreen', label: 'לוח בקרה', render: renderDashboard },
    { id: 'lessonsScreen', label: 'שיעורים', render: renderLevelsScreen },
    { id: 'gamesScreen', label: 'משחקים', render: (c) => renderGamesScreen(c) },
    { id: 'testScreen', label: 'מבחן הקלדה', render: renderTestScreen },
    { id: 'assessmentScreen', label: 'הערכה', render: renderAssessmentScreen },
    { id: 'analyticsScreen', label: 'מעבדת למידה', render: renderAnalyticsScreen },
    { id: 'maintenanceScreen', label: 'תחזוקה', render: renderMaintenanceScreen },
    { id: 'customScreen', label: 'טקסט אישי', render: renderCustomTextScreen },
    { id: 'teacherScreen', label: 'מורה', render: renderTeacherScreen },
    { id: 'ergonomicsScreen', label: 'טכניקה', render: renderErgonomicsScreen },
    { id: 'settingsScreen', label: 'הגדרות', render: renderSettingsScreen }
];

function otzShowMessage(text, type) {
    if (HAS_OTZARIA) {
        try {
            if (type === 'error') Otzaria.call('ui.showError', { message: text });
            else if (type === 'success') Otzaria.call('ui.showSuccess', { message: text });
            else Otzaria.call('ui.showMessage', { message: text });
            return;
        } catch (e) {}
    }
    console.log('[' + (type || 'info') + ']', text);
}

function confirmDialog(text, onYes) {
    const ov = document.createElement('div');
    ov.className = 'daily-limit-overlay';
    ov.innerHTML = `<div class="daily-limit-box"><p>${text}</p><div class="results-actions" style="justify-content:center"><button class="btn danger" data-a="y">${t('כן, אפס', 'Yes, reset')}</button><button class="btn" data-a="n">${t('ביטול', 'Cancel')}</button></div></div>`;
    document.body.appendChild(ov);
    ov.querySelector('[data-a="y"]').onclick = () => { ov.remove(); onYes(); };
    ov.querySelector('[data-a="n"]').onclick = () => ov.remove();
}

function applyOtzariaTheme(theme) {
    if (!theme || !theme.colorScheme) return;
    const cs = theme.colorScheme;
    const root = document.documentElement;
    root.style.setProperty('--otz-primary', cs.primary || '');
    root.style.setProperty('--otz-on-primary', cs.onPrimary || '');
    root.style.setProperty('--otz-secondary', cs.secondary || '');
    root.style.setProperty('--otz-on-secondary', cs.onSecondary || '');
    root.style.setProperty('--otz-surface', cs.surface || '');
    root.style.setProperty('--otz-on-surface', cs.onSurface || '');
    root.style.setProperty('--otz-outline', cs.outline || '');
    root.style.setProperty('--otz-error', cs.error || '');
    root.style.setProperty('--otz-on-error', cs.onError || '');
    if (cs.surfaceContainerHighest) root.style.setProperty('--otz-surface-highest', cs.surfaceContainerHighest);
    if (cs.surfaceContainerHigh) root.style.setProperty('--otz-surface-high', cs.surfaceContainerHigh);
    if (cs.surfaceContainer) root.style.setProperty('--otz-surface-container', cs.surfaceContainer);
    if (cs.onSurfaceVariant) root.style.setProperty('--otz-on-surface-variant', cs.onSurfaceVariant);
    if (theme.typography && theme.typography.fontFamily) {
        root.style.setProperty('--otz-font', "'" + theme.typography.fontFamily + "', 'David', 'Arial Hebrew', sans-serif");
    }
    if (appSettings.darkMode === null) {
        document.body.classList.toggle('dark-mode', theme.mode === 'dark');
    }
}

function showScreen(id) {
    document.querySelectorAll('.screen').forEach(s => s.style.display = 'none');
    const el = document.getElementById(id);
    if (el) el.style.display = 'block';
    document.body.classList.toggle('in-practice', id === 'practiceScreen');
    try { window.scrollTo(0, 0); } catch (e) {}
}

// Stops anything "live" (an exercise, a game, a pending auto-advance). BUGFIX 3.0:
// leaving the practice screen through the top navigation used to leave the
// exercise running in the background — its key handler kept swallowing every
// key (you could not type in the goals/teacher/custom-text inputs) and the
// auto-advance countdown could start the next lesson while on another screen.
function stopAllActivities() {
    if (typeof stopActivePractice === 'function') stopActivePractice();
    if (typeof stopGame === 'function') stopGame();
    if (typeof G3D !== 'undefined') G3D.stop();
    if (typeof Speech !== 'undefined') Speech.stop();
    if (typeof cancelAutoAdvance === 'function') cancelAutoAdvance();
    if (typeof removeResultsKeys === 'function') removeResultsKeys();
}

function navigateTo(screenId, opts) {
    opts = opts || {};
    if (!opts.keepActivity) stopAllActivities();
    const item = NAV_ITEMS.find(n => n.id === screenId);
    document.querySelectorAll('.nav-btn').forEach(b => b.classList.toggle('active', b.dataset.screen === screenId));
    showScreen(screenId);
    if (item && !opts.silent) item.render(document.getElementById(screenId));
    refreshHeaderStatus();
    if (typeof translateDocument === 'function') translateDocument(document);
}

function renderNav() {
    const nav = document.getElementById('mainNav');
    nav.innerHTML = '';
    NAV_ITEMS.forEach(item => {
        const btn = document.createElement('button');
        btn.className = 'nav-btn';
        btn.dataset.screen = item.id;
        btn.textContent = item.label;
        btn.addEventListener('click', () => navigateTo(item.id));
        nav.appendChild(btn);
    });
}

async function initializeApp() {
    await loadAllData();
    ensureAdvancedData();
    applySettingsToUi();
    getCompletedLessons();
    renderNav();
    refreshHeaderStatus();
    navigateTo('dashboardScreen');
    if (typeof translateDocument === 'function') translateDocument(document);
    checkDailyLimitOnLogin();
}

if (HAS_OTZARIA) {
    Otzaria.on('plugin.boot', function (payload) {
        if (payload && payload.app && payload.app.runMode === 'background') return;
        if (payload && payload.theme) applyOtzariaTheme(payload.theme);
        initializeApp();
    });
    Otzaria.on('theme.changed', function (theme) {
        applyOtzariaTheme(theme);
    });
} else {
    document.addEventListener('DOMContentLoaded', initializeApp);
}
