// ---- הגבלת/יעד זמן תרגול יומי ----
// דורש שיהיו זמינים: appData, appSettings (storage.js) ו-localDateKey (typing-engine.js)

// כמה זמן תרגול (מ״ש) כבר הצטבר היום, לפי הסשנים השמורים
function getTodayPracticeMs() {
    const today = localDateKey();
    return appData.sessions.reduce((sum, s) => {
        if (!s || !s.date) return sum;
        return localDateKey(new Date(s.date)) === today ? sum + (s.durationMs || 0) : sum;
    }, 0);
}

function getDailyLimitMs() {
    return Math.max(5, Number(appSettings.dailyLimitMinutes) || 15) * 60000;
}

// extraMs מאפשר להביא בחשבון גם את הזמן שחלף בתרגיל הפעיל (שעדיין לא נשמר כסשן)
function isDailyLimitReached(extraMs) {
    if (!appSettings.dailyLimitEnabled) return false;
    return (getTodayPracticeMs() + (extraMs || 0)) >= getDailyLimitMs();
}

function getTodayPracticeMinutesLabel() {
    return Math.round(getTodayPracticeMs() / 60000);
}

// Small progress bar shown at the top of the dashboard ("X of Y minutes
// today"), so the daily goal is visible even before starting a session.
function renderDailyGoalBar() {
    // 3.0: the goal bar is always shown (it's motivating); the *limit* is optional.
    const doneMs = getTodayPracticeMs();
    const goalMs = getDailyGoalMinutes() * 60000;
    const pct = Math.max(0, Math.min(100, Math.round((doneMs / goalMs) * 100)));
    const doneMin = Math.round(doneMs / 60000);
    const goalMin = Math.round(goalMs / 60000);
    const reached = doneMs >= goalMs;
    return `
        <div class="daily-goal-bar${reached ? ' reached' : ''}">
            <div class="daily-goal-bar-label">
                <span>${t('יעד תרגול יומי', 'Daily practice goal')}</span>
                <span>${doneMin}/${goalMin} ${t('דק׳', 'min')}${reached ? t(' — הושלם 🎉', ' — done 🎉') : ''}</span>
            </div>
            <div class="daily-goal-bar-track"><div class="daily-goal-bar-fill" style="width:${pct}%"></div></div>
        </div>
    `;
}

// מציג מסך "כל הכבוד, סיימתם להיום" שחוסם המשך תרגול.
// לוח הבקרה, ההגדרות והסטטיסטיקות נשארים נגישים - רק פתיחת תרגיל חדש נחסמת
// (ראו הבדיקה בתחילת startPracticeRun ב-practice.js), כך שהמשתמש יכול עדיין
// לראות את ההתקדמות שלו בלי להיות "נעול" לגמרי מחוץ לתוסף.
function showDailyLimitOverlay() {
    if (document.getElementById('dailyLimitOverlay')) return;
    const mins = getTodayPracticeMinutesLabel();
    const goal = Math.max(5, Number(appSettings.dailyLimitMinutes) || 15);
    const overlay = document.createElement('div');
    overlay.id = 'dailyLimitOverlay';
    overlay.className = 'daily-limit-overlay';
    overlay.innerHTML = `
        <div class="daily-limit-box">
            <div class="dl-trophy">🏆</div>
            <h2>${t('כל הכבוד!', 'Well done!')}</h2>
            <p>${t(`סיימתם את תרגול ההקלדה שהוגדר להיום — ${mins} מתוך ${goal} דקות.`, `You've finished today's typing practice — ${mins} of ${goal} minutes.`)}</p>
            <p class="dl-streak">🔥 ${t('רצף', 'Streak')}: ${appData.progress.streakDays || 0} ${t('ימים', 'days')}</p>
            <p class="daily-limit-note">${t('נתראה מחר! את ההגבלה היומית אפשר לשנות או לבטל במסך ההגדרות.', 'See you tomorrow! You can change or turn off the daily limit in Settings.')}</p>
            <button class="btn primary" id="btnCloseDailyLimit">${t('סגור', 'Close')}</button>
        </div>
    `;
    document.body.appendChild(overlay);
    overlay.querySelector('#btnCloseDailyLimit').addEventListener('click', () => overlay.remove());
}

// נקרא פעם אחת באתחול האפליקציה (מיד אחרי ההתחברות/פתיחת התוסף) כדי
// להראות מייד אם היעד היומי כבר הושג בסשן קודם היום.
function checkDailyLimitOnLogin() {
    if (isDailyLimitReached()) showDailyLimitOverlay();
}
