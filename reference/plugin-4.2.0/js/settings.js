// ---- הגדרות ----

function renderSettingsScreen(container) {
    const s = appSettings;
    const row = (label, control, help) => `<label class="setting-row"><span class="sr-text"><span class="sr-label">${label}</span>${help ? `<small class="sr-help">${help}</small>` : ''}</span><span class="sr-control">${control}</span></label>`;
    const sw = (id, on) => `<input type="checkbox" class="switch" id="${id}" ${on ? 'checked' : ''}>`;
    const sel = (id, opts, cur) => `<select id="${id}">${opts.map(([v, l]) => `<option value="${v}" ${cur === v ? 'selected' : ''}>${l}</option>`).join('')}</select>`;
    const num = (id, min, max, step, val) => `<input type="number" id="${id}" min="${min}" max="${max}" ${step ? `step="${step}"` : ''} value="${val}">`;
    const card = (title, desc, rows) => `<section class="set-card"><header><h3>${title}</h3>${desc ? `<p>${desc}</p>` : ''}</header><div class="settings-list">${rows}</div></section>`;
    const speechNote = (typeof Speech==='undefined'||!Speech.available()) ? t('⚠️ הקראה אינה נתמכת בדפדפן המובנה הזה.', '⚠️ Speech is not supported by this built-in browser.') : (Speech.hasHebrew() ? t('נמצא קול עברי — האותיות העבריות יוקראו בשמן העברי (אלף, בית…).', 'A Hebrew voice was found — Hebrew letters are read by their Hebrew names (Alef, Bet…).') : t('לא נמצא קול עברי במחשב, לכן האותיות יוקראו בשמות באנגלית (Alef, Bet…). להוספת קול עברי: הגדרות Windows ← זמן ושפה ← דיבור ← הוסף קולות ← עברית.', 'No Hebrew voice was found, so Hebrew letters are read with English names (Alef, Bet…). To add one: Windows Settings → Time & language → Speech → Add voices → Hebrew.'));

    container.innerHTML = `
        <div class="page-head"><h2>${t('הגדרות', 'Settings')}</h2></div>
        <div class="set-grid">
        ${card(t('שפה ותצוגה', 'Language & display'), '', [
            row(t('שפת הממשק', 'Interface language'), sel('setUiLang', [['he', 'עברית'], ['en', 'English']], s.uiLang)),
            row(t('תרגול הקלדה באנגלית', 'Practice English typing'), sw('setEnglishTyping', s.englishTypingEnabled), t('נפרד משפת הממשק: אפשר ממשק באנגלית ותרגול בעברית, או להפך.', 'Separate from the interface language: you can show the app in English and practice Hebrew, or the reverse.')),
            row(t('ערכת צבעים', 'Color theme'), sel('setDark', [['auto', t('לפי אוצריא', 'Follow Otzaria')], ['on', t('כהה', 'Dark')], ['off', t('בהיר', 'Light')]], s.darkMode === null ? 'auto' : (s.darkMode ? 'on' : 'off'))),
            row(t('גודל גופן', 'Font size'), sel('setFont', [['small', t('קטן', 'Small')], ['medium', t('בינוני', 'Medium')], ['large', t('גדול', 'Large')]], s.fontSize)),
            row(t('הפחתת אנימציות', 'Reduce animations'), sw('setReduceMotion', s.reduceMotion)),
            row(t('צלילים', 'Sound'), sw('setSound', s.soundEnabled))
        ].join(''))}

        ${card(t('איך מתרגלים', 'How you practice'), t('כללי התרגיל עצמו: מתי הוא נגמר, מה קורה בטעות ומה נחשב מעבר.', 'The rules of an exercise: when it ends, what happens on a mistake and what counts as a pass.'), [
            row(t('מצב תיקון', 'Correction mode'), sel('setCorrection', [['auto', t('לפי השלב (מומלץ)', 'By stage (recommended)')], ['free', t('חופשי (ממשיכים למרות טעויות)', 'Free (continue after mistakes)')], ['backspace', t('תיקון עם Backspace (חובה למחוק טעות)', 'Fix with Backspace (a mistake must be deleted)')], ['strict', t('מחמיר (חובה לתקן)', 'Strict (mistakes must be corrected)')]], s.correctionModeManual ? s.correctionMode : 'auto'), t('"לפי השלב": חופשי ברמות 0–2, ומרמה 3 כל טעות מתקנים עם Backspace — כמו בהקלדה אמיתית.', '"By stage": free in levels 0–2; from level 3 every mistake is fixed with Backspace — like real typing.')),
            row(t('אפשר תיקון עם Backspace', 'Allow Backspace corrections'), sw('setAllowBackspace', s.allowBackspace !== false), t('במצב חופשי בלבד.', 'Free mode only.')),
            row(t('מצב סיום תרגיל', 'Exercise completion mode'), sel('setTimingMode', [['completion', t('השלמת הטקסט', 'Complete the text')], ['untimed', t('ללא הגבלת זמן', 'No time limit')], ['accuracy', t('יעד דיוק', 'Accuracy target')], ['mastery', t('יעד שליטה', 'Mastery target')]], s.timingMode)),
            row(t('יעד דיוק לתרגול (%)', 'Practice accuracy target (%)'), num('setAccuracyTarget', 80, 100, '', s.accuracyTarget)),
            row(t('סף שליטה', 'Mastery threshold'), num('setMasteryTarget', 70, 100, '', s.masteryTarget)),
            row(t('משוב', 'Feedback'), sel('setFeedbackMode', [['immediate', t('מיידי', 'Immediate')], ['delayed', t('בסוף התרגיל', 'At the end of the exercise')]], s.feedbackMode)),
            row(t('שיטת חישוב מ״לד', 'WPM calculation'), sel('setWpm', [['net', t('נטו (בניכוי שגיאות)', 'Net (after errors)')], ['gross', t('ברוטו', 'Gross')]], s.wpmMethod)),
            row(t('אורך מינימלי לתרגיל (תווים)', 'Minimum exercise length (characters)'), num('setPracticeLength', 20, 300, 5, s.practiceLength), t('לתרגילים שנוצרים אוטומטית.', 'For automatically generated exercises.')),
            row(t('מצב ניקוד', 'Niqqud mode'), sel('setNiqqudMode', [['none', t('אותיות בלבד', 'Letters only')], ['optional', t('ניקוד אופציונלי', 'Optional niqqud')], ['required', t('ניקוד נדרש', 'Niqqud required')]], s.niqudMode), t('"אופציונלי" מציג ניקוד אך מספיק להקליד את האות. "נדרש" — מקלידים גם את הסימנים (AltGr).', '"Optional" shows niqqud but only the letter must be typed. "Required" — type the marks too (AltGr).')),
            row(t('מעבר אוטומטי לאחר שיעור', 'Auto-advance after a lesson'), sw('setAutoAdvance', s.autoAdvance), t('אחרי ספירה קצרה עוברים לשיעור הבא אם עברתם, או חוזרים על השיעור אם לא.', 'After a short countdown, move to the next lesson if you passed, or repeat it if not.')),
            row(t('תרגול רציף', 'Non-stop practice'), sw('setNonStop', s.nonStopPractice), t('שיעור ממשיך עם טקסט חדש בלי הפסקה עד שנגמר הזמן של היעד היומי. Esc מסיים ושומר.', 'A lesson keeps giving fresh text until your daily goal time is used up. Esc finishes and saves.'))
        ].join(''))}

        ${card(t('עזרים על המסך', 'On-screen help'), t('כדאי לכבות בהדרגה ככל שמתקדמים — ההסתמכות על עזרים מאטה את המעבר להקלדה עיוורת.', 'Turn these off gradually as you improve — relying on them slows the move to true touch typing.'), [
            row(t('מצב עיוור אוטומטי', 'Automatic blind mode'), sw('setAutoBlind', s.autoBlindMode !== false), t('מרמה 3 המקלדת ומדריך האצבעות מוסתרים, ומופיעים רק כשמהססים על אות (יותר מ-1.5 שניות) או טועים בה פעמיים ברצף.', 'From level 3 the keyboard and finger guide are hidden and appear only when you hesitate on a key (over 1.5 s) or miss it twice in a row.')),
            row(t('הצג מקלדת בתרגול', 'Show keyboard during practice'), sw('setShowKb', s.showKeyboard)),
            row(t('הצג מדריך אצבעות', 'Show finger guide'), sw('setShowFingers', s.showFingerHints)),
            row(t('עמעום עזרים לאותיות ששולטים בהן', 'Fade assistance for mastered keys'), sw('setFadeAssist', s.fadeAssistance)),
            row(t('הצג אות משנית קטנה על המקשים', 'Show small secondary letter on keys'), sw('setSecondaryLabels', s.showSecondaryLabels !== false)),
            row(t('לוח נתונים חי בזמן התרגול', 'Live stats during practice'), sw('setLiveDash', s.liveDashboard !== false)),
            row(t('סמן קצב', 'Pace caret'), sw('setPaceCaret', s.paceCaret), t('מירוץ מול יעד המהירות שלכם.', 'Race against your speed goal.')),
            row(t('הודעות עידוד במהלך התרגול', 'Encouragement during practice'), sw('setEncouragement', s.encouragement !== false))
        ].join(''))}

        ${card(t('הקראה בקול', 'Read aloud'), '', [
            row(t('הקראת האות הבאה', 'Read the next letter aloud'), sel('setSpeakNext', [['off', t('כבוי', 'Off')], ['letter', t('האות הבאה', 'Next letter')], ['letterFinger', t('האות הבאה + איזו אצבע', 'Next letter + which finger')], ['word', t('כל מילה בתחילתה, ואז אותיות', 'Each word as it starts, then letters')]], s.speakNext || 'off'), speechNote),
            row(t('מהירות ההקראה', 'Speech speed'), `<input type="range" id="setSpeechRate" min="0.6" max="1.8" step="0.1" value="${s.speechRate||1.1}"><button class="btn-chip" id="btnTestSpeech" type="button">▶ ${t('נסו', 'Test')}</button>`)
        ].join(''))}

        ${card(t('זמן ובריאות', 'Time & wellbeing'), '', [
            row(t('יעד דקות תרגול ביום', 'Daily practice goal (minutes)'), num('setDailyLimitMinutes', 5, 240, 5, s.dailyLimitMinutes)),
            row(t('הגבל זמן תרגול יומי', 'Limit daily practice time'), sw('setDailyLimitEnabled', s.dailyLimitEnabled), t('כשפעיל: אחרי היעד מסיימים את התרגיל הנוכחי והתרגול ננעל עד מחר. כשכבוי — היעד רק מעודד.', 'When on: after the goal you finish the current exercise and practice locks until tomorrow. When off, the goal only encourages.')),
            row(t('הצע הפסקה כשהדיוק יורד', 'Suggest a break when accuracy drops'), sw('setBreakReminders', s.breakReminders)),
            row(t('תזכורות ארגונומיה', 'Ergonomics reminders'), sw('setErgonomics', s.ergonomicsReminders), t('שבו בנוחות, כתפיים רפויות, פרקי כף יד ניטרליים. הדרכה כללית, לא ייעוץ מקצועי.', 'Sit comfortably, relaxed shoulders, neutral wrists. General guidance, not professional advice.'))
        ].join(''))}

        <section class="set-card">
            <header><h3>${t('נתונים', 'Data')}</h3><p>${t('הכל נשמר מקומית במחשב. מומלץ לייצא גיבוי מדי פעם.', 'Everything is stored locally. Export a backup now and then.')}</p></header>
            <div class="settings-actions">
                <button class="btn" id="btnExport">${t('ייצוא גיבוי', 'Export backup')}</button>
                <label class="btn" for="importFile">${t('ייבוא גיבוי', 'Import backup')}</label>
                <input type="file" id="importFile" accept="application/json" style="display:none">
                <button class="btn danger-ghost" id="btnReset">${t('איפוס כל הנתונים', 'Reset all data')}</button>
            </div>
        </section>
        </div>
    `;

    const save = () => { saveSettings(); applySettingsToUi(); refreshHeaderStatus(); };

    container.querySelector('#setUiLang').addEventListener('change', (e) => {
        s.uiLang = e.target.value === 'en' ? 'en' : 'he';
        saveSettings();
        applySettingsToUi();
        renderNav();
        navigateTo('settingsScreen');
    });
    container.querySelector('#setEnglishTyping').addEventListener('change', (e) => {
        s.englishTypingEnabled = e.target.checked;
        getCompletedLessons();
        flushSaveData();
        applySettingsToUi();
        renderNav();
        navigateTo('lessonsScreen');
    });
    container.querySelector('#setDark').addEventListener('change', (e) => {
        s.darkMode = e.target.value === 'auto' ? null : (e.target.value === 'on');
        save();
    });
    container.querySelector('#setSound').addEventListener('change', (e) => { s.soundEnabled = e.target.checked; save(); });
    container.querySelector('#setShowKb').addEventListener('change', (e) => { s.showKeyboard = e.target.checked; save(); });
    container.querySelector('#setShowFingers').addEventListener('change', (e) => { s.showFingerHints = e.target.checked; save(); });
    container.querySelector('#setFadeAssist').addEventListener('change', (e) => { s.fadeAssistance = e.target.checked; save(); });
    container.querySelector('#setBreakReminders').addEventListener('change', (e) => { s.breakReminders = e.target.checked; save(); });
    container.querySelector('#setNiqqudMode').addEventListener('change', (e) => { s.niqudMode = e.target.value; save(); });
    container.querySelector('#setCorrection').addEventListener('change', (e) => {
        if (e.target.value === 'auto') { s.correctionModeManual = false; s.correctionMode = 'free'; }
        else { s.correctionModeManual = true; s.correctionMode = e.target.value; }
        save();
    });
    container.querySelector('#setAutoBlind').addEventListener('change', (e) => { s.autoBlindMode = e.target.checked; save(); });
    container.querySelector('#setTimingMode').addEventListener('change', (e) => { s.timingMode = e.target.value; save(); });
    container.querySelector('#setAccuracyTarget').addEventListener('change', (e) => { s.accuracyTarget = Math.max(80, Math.min(100, Number(e.target.value) || 97)); save(); });
    container.querySelector('#setMasteryTarget').addEventListener('change', (e) => { s.masteryTarget = Math.max(70, Math.min(100, Number(e.target.value) || 90)); save(); });
    container.querySelector('#setFeedbackMode').addEventListener('change', (e) => { s.feedbackMode = e.target.value; save(); });
    container.querySelector('#setErgonomics').addEventListener('change', (e) => { s.ergonomicsReminders = e.target.checked; save(); });
    container.querySelector('#setWpm').addEventListener('change', (e) => { s.wpmMethod = e.target.value; save(); });
    container.querySelector('#setFont').addEventListener('change', (e) => { s.fontSize = e.target.value; save(); });
    container.querySelector('#setReduceMotion').addEventListener('change', (e) => { s.reduceMotion = e.target.checked; save(); });
    container.querySelector('#setPracticeLength').addEventListener('change', (e) => { s.practiceLength = Math.max(20, Math.min(300, Number(e.target.value) || 50)); save(); });
    container.querySelector('#setDailyLimitEnabled').addEventListener('change', (e) => { s.dailyLimitEnabled = e.target.checked; save(); });
    container.querySelector('#setDailyLimitMinutes').addEventListener('change', (e) => { s.dailyLimitMinutes = Math.max(5, Math.min(240, Number(e.target.value) || 15)); appData.goals.dailyMinutes = s.dailyLimitMinutes; scheduleSaveData(); save(); });
    container.querySelector('#setSpeakNext').addEventListener('change', (e) => { s.speakNext = e.target.value; if (s.speakNext !== 'off') s.lastSpeakMode = s.speakNext; save(); Speech.test(); });
    container.querySelector('#setSpeechRate').addEventListener('change', (e) => { s.speechRate = Number(e.target.value) || 1.1; save(); Speech.test(); });
    container.querySelector('#btnTestSpeech').addEventListener('click', (e) => { e.preventDefault(); Speech.test(); });
    container.querySelector('#setNonStop').addEventListener('change', (e) => { s.nonStopPractice = e.target.checked; save(); });
    container.querySelector('#setLiveDash').addEventListener('change', (e) => { s.liveDashboard = e.target.checked; save(); });
    container.querySelector('#setAllowBackspace').addEventListener('change', (e) => { s.allowBackspace = e.target.checked; save(); });
    container.querySelector('#setPaceCaret').addEventListener('change', (e) => { s.paceCaret = e.target.checked; save(); });
    container.querySelector('#setEncouragement').addEventListener('change', (e) => { s.encouragement = e.target.checked; save(); });
    container.querySelector('#setSecondaryLabels').addEventListener('change', (e) => { s.showSecondaryLabels = e.target.checked; save(); });
    container.querySelector('#setAutoAdvance').addEventListener('change', (e) => { s.autoAdvance = e.target.checked; save(); });

    container.querySelector('#btnExport').addEventListener('click', exportAllData);
    container.querySelector('#importFile').addEventListener('change', (e) => {
        const file = e.target.files[0];
        if (!file) return;
        importAllData(file, (ok, err) => {
            otzShowMessage(ok ? t('הייבוא הצליח', 'Import successful') : (t('שגיאה בייבוא: ', 'Import error: ') + err), ok ? 'success' : 'error');
            if (ok) navigateTo('dashboardScreen');
        });
    });
    container.querySelector('#btnReset').addEventListener('click', () => {
        // window.confirm() is often blocked inside embedded web views, which made
        // reset silently impossible — use an in-app dialog instead.
        confirmDialog(t('לאפס את כל הנתונים וההתקדמות? פעולה זו אינה הפיכה.', 'Reset all data and progress? This cannot be undone.'), () => {
            resetAllData();
            ensureAdvancedData();
            otzShowMessage(t('כל הנתונים אופסו', 'All data reset'), 'success');
            navigateTo('dashboardScreen');
        });
    });
}

function applySettingsToUi() {
    document.body.classList.toggle('reduce-motion', !!appSettings.reduceMotion);
    document.body.dataset.fontSize = appSettings.fontSize;
    if (appSettings.darkMode !== null) {
        document.body.classList.toggle('dark-mode', appSettings.darkMode);
    }
}
