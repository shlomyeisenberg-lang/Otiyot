// ---- אתחול האפליקציה ----

const NAV_ICONS = {
    home: '<path d="M4 11l8-6.5 8 6.5"/><path d="M6.5 9.5V19h11V9.5"/><path d="M10 19v-5h4v5"/>',
    today: '<rect x="4" y="5.5" width="16" height="14" rx="2.5"/><path d="M4 10h16M8.5 3.5v4M15.5 3.5v4"/><path d="M9 14.5l2 2 4-4"/>',
    lessons: '<path d="M12 6.5c-2-1.6-4.8-2-8-1.6V18c3.2-.4 6 0 8 1.6 2-1.6 4.8-2 8-1.6V4.9c-3.2-.4-6 0-8 1.6z"/><path d="M12 6.5v13"/>',
    games: '<path d="M7.5 8h9a4 4 0 0 1 3.9 4.9l-.8 3.6a2.4 2.4 0 0 1-4.2 1L13.8 15h-3.6l-1.6 2.5a2.4 2.4 0 0 1-4.2-1l-.8-3.6A4 4 0 0 1 7.5 8z"/><path d="M8 11v3M6.5 12.5h3"/><circle cx="15.5" cy="11.5" r=".6"/><circle cx="17" cy="13.3" r=".6"/>',
    test: '<circle cx="12" cy="13" r="7"/><path d="M12 13V9.5M10 3.5h4M18 7l1.3-1.3"/>',
    assess: '<rect x="5.5" y="4.5" width="13" height="16" rx="2"/><path d="M9 4.5V3.5h6v1"/><path d="M9 12l2 2 4-4.5"/>',
    lab: '<path d="M4 19.5h16"/><path d="M7 16v-4M11 16V8M15 16v-6M19 16V5"/>',
    maint: '<path d="M19.5 12a7.5 7.5 0 0 1-13.2 4.9"/><path d="M4.5 12a7.5 7.5 0 0 1 13.2-4.9"/><path d="M18 3.8v3.6h-3.6M6 20.2v-3.6h3.6"/>',
    custom: '<path d="M14 3.5H7a2 2 0 0 0-2 2v13a2 2 0 0 0 2 2h10a2 2 0 0 0 2-2V8.5z"/><path d="M14 3.5v5h5M8.5 13h7M8.5 16.5h5"/>',
    teacher: '<circle cx="9" cy="8.5" r="3"/><path d="M3.5 19c.6-3 2.8-4.8 5.5-4.8s4.9 1.8 5.5 4.8"/><circle cx="17" cy="9.5" r="2.3"/><path d="M16.2 14.3c2.3-.2 4 1.3 4.5 3.9"/>',
    hand: '<path d="M8 12.5V6a1.5 1.5 0 0 1 3 0v5.5"/><path d="M11 11V4.5a1.5 1.5 0 0 1 3 0V11"/><path d="M14 11V6a1.5 1.5 0 0 1 3 0v7.5c0 4-2.6 6.5-6 6.5-2.6 0-4.1-1.3-5.4-3.5L3.9 13.4a1.4 1.4 0 0 1 2.3-1.6L8 14"/>',
    settings: '<circle cx="12" cy="12" r="3"/><path d="M12 2.8v2.4M12 18.8v2.4M21.2 12h-2.4M5.2 12H2.8M18.5 5.5l-1.7 1.7M7.2 16.8l-1.7 1.7M18.5 18.5l-1.7-1.7M7.2 7.2L5.5 5.5"/>'
};
function navIcon(name) { return '<svg class="nav-ico" viewBox="0 0 24 24" aria-hidden="true">' + (NAV_ICONS[name] || '') + '</svg>'; }

const NAV_GROUPS = [
    { he: 'תרגול', en: 'Practice' },
    { he: 'מדידה', en: 'Measure' },
    { he: 'כלים', en: 'Tools' }
];
const NAV_ITEMS = [
    { id: 'dashboardScreen', group: 0, icon: 'home', he: 'בית', en: 'Home', render: renderDashboard },
    { id: 'todayScreen', group: 0, icon: 'today', he: 'התוכנית של היום', en: "Today's plan", render: renderTodayScreen },
    { id: 'lessonsScreen', group: 0, icon: 'lessons', he: 'שיעורים', en: 'Lessons', render: renderLevelsScreen },
    { id: 'gamesScreen', group: 0, icon: 'games', he: 'משחקים', en: 'Games', render: (c) => renderGamesScreen(c) },
    // 4.1: Typing test + Assessment + Maintenance are one screen; the Learning lab
    // moved into Home → "What to strengthen".
    { id: 'progressScreen', group: 1, icon: 'test', he: 'בדיקת התקדמות', en: 'Progress check', render: renderProgressScreen },
    { id: 'customScreen', group: 2, icon: 'custom', he: 'טקסט אישי', en: 'Custom text', render: renderCustomTextScreen },
    { id: 'ergonomicsScreen', group: 2, icon: 'hand', he: 'טכניקה', en: 'Technique', render: renderErgonomicsScreen },
    { id: 'teacherScreen', group: 2, icon: 'teacher', he: 'מורה', en: 'Teacher', render: renderTeacherScreen },
    { id: 'settingsScreen', group: 2, icon: 'settings', he: 'הגדרות', en: 'Settings', render: renderSettingsScreen }
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
    if (typeof stopStorm === 'function') stopStorm();
    if (typeof Speech !== 'undefined') Speech.stop();
    if (typeof cancelAutoAdvance === 'function') cancelAutoAdvance();
    if (typeof removeResultsKeys === 'function') removeResultsKeys();
    if (typeof cancelPlanPause === 'function') cancelPlanPause();
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
    NAV_GROUPS.forEach((g, gi) => {
        const wrap = document.createElement('div');
        wrap.className = 'nav-group';
        const title = document.createElement('div');
        title.className = 'nav-group-title';
        title.textContent = t(g.he, g.en);
        wrap.appendChild(title);
        NAV_ITEMS.filter(i => i.group === gi).forEach(item => {
            const btn = document.createElement('button');
            btn.className = 'nav-btn';
            btn.type = 'button';
            btn.dataset.screen = item.id;
            const label = t(item.he, item.en);
            btn.title = label;
            btn.innerHTML = navIcon(item.icon) + '<span class="nav-lbl"></span>';
            btn.querySelector('.nav-lbl').textContent = label;
            btn.addEventListener('click', () => { navigateTo(item.id); document.body.classList.remove('nav-open'); });
            wrap.appendChild(btn);
        });
        nav.appendChild(wrap);
    });
    const active = document.querySelector('.screen[style*="block"]');
    if (active) document.querySelectorAll('.nav-btn').forEach(b => b.classList.toggle('active', b.dataset.screen === active.id));
    const h1 = document.querySelector('.sb-brand h1');
    if (h1) h1.textContent = t('הקלדה עברית', 'Hebrew Typing');
    const col = document.getElementById('btnSidebarCollapse');
    if (col && !col.dataset.bound) {
        col.dataset.bound = '1';
        col.addEventListener('click', () => {
            const on = !document.body.classList.contains('sb-collapsed');
            document.body.classList.toggle('sb-collapsed', on);
            try { localStorage.setItem('htt.sbCollapsed', on ? '1' : '0'); } catch (e) {}
        });
        try { if (localStorage.getItem('htt.sbCollapsed') === '1') document.body.classList.add('sb-collapsed'); } catch (e) {}
    }
    if (col) { const lbl = t('כווץ / הרחב תפריט', 'Collapse / expand menu'); col.title = lbl; col.setAttribute('aria-label', lbl); }
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
