// ---- הגדרות ----

function renderSettingsScreen(container) {
    const s = appSettings;
    container.innerHTML = `
        <h2>הגדרות</h2>
        <div class="settings-list">
            <label class="setting-row"><span>שפת הממשק</span>
                <select id="setUiLang">
                    <option value="he" ${s.uiLang==='he'?'selected':''}>עברית</option>
                    <option value="en" ${s.uiLang==='en'?'selected':''}>English</option>
                </select>
            </label>
            <label class="setting-row"><span>תרגול הקלדה באנגלית</span>
                <input type="checkbox" id="setEnglishTyping" ${s.englishTypingEnabled?'checked':''}>
            </label>
            <div class="setting-help">שתי ההגדרות נפרדות: אפשר להציג את כל האפליקציה באנגלית ועדיין ללמוד עברית, או להציג את האפליקציה בעברית ולתרגל אנגלית.</div>
            <label class="setting-row"><span>מצב כהה</span>
                <select id="setDark">
                    <option value="auto" ${s.darkMode===null?'selected':''}>לפי אוצריא</option>
                    <option value="on" ${s.darkMode===true?'selected':''}>כהה</option>
                    <option value="off" ${s.darkMode===false?'selected':''}>בהיר</option>
                </select>
            </label>
            <label class="setting-row"><span>צלילים</span>
                <input type="checkbox" id="setSound" ${s.soundEnabled?'checked':''}>
            </label>
            <label class="setting-row"><span>הצג מקלדת בתרגול</span>
                <input type="checkbox" id="setShowKb" ${s.showKeyboard?'checked':''}>
            </label>
            <label class="setting-row"><span>הצג מדריך אצבעות</span>
                <input type="checkbox" id="setShowFingers" ${s.showFingerHints?'checked':''}>
            </label>
            <label class="setting-row"><span>עמעום עזרים לאותיות ששולטים בהן</span>
                <input type="checkbox" id="setFadeAssist" ${s.fadeAssistance?'checked':''}>
            </label>
            <label class="setting-row"><span>הצע הפסקה כשהדיוק יורד</span>
                <input type="checkbox" id="setBreakReminders" ${s.breakReminders?'checked':''}>
            </label>
            <div class="setting-help">${t('ניקוד: "אותיות בלבד" מסיר את הניקוד מהטקסט. "אופציונלי" מציג אותו אך מספיק להקליד את האות. "נדרש" — יש להקליד גם את סימני הניקוד (AltGr במקלדת העברית).', 'Niqqud: "letters only" removes niqqud from the text. "Optional" shows it but only the letter must be typed. "Required" — the marks must be typed too (AltGr on the Hebrew keyboard).')}</div>
            <label class="setting-row"><span>מצב ניקוד</span>
                <select id="setNiqqudMode">
                    <option value="none" ${s.niqudMode==='none'?'selected':''}>אותיות בלבד</option>
                    <option value="optional" ${s.niqudMode==='optional'?'selected':''}>ניקוד אופציונלי</option>
                    <option value="required" ${s.niqudMode==='required'?'selected':''}>ניקוד נדרש</option>
                </select>
            </label>
            <label class="setting-row"><span>מצב תיקון</span>
                <select id="setCorrection">
                    <option value="free" ${s.correctionMode==='free'?'selected':''}>חופשי (ממשיכים למרות טעויות)</option>
                    <option value="strict" ${s.correctionMode==='strict'?'selected':''}>מחמיר (חובה לתקן)</option>
                </select>
            </label>
            <label class="setting-row"><span>מצב סיום תרגיל</span>
                <select id="setTimingMode">
                    <option value="completion" ${s.timingMode==='completion'?'selected':''}>השלמת הטקסט</option>
                    <option value="untimed" ${s.timingMode==='untimed'?'selected':''}>ללא הגבלת זמן</option>
                    <option value="accuracy" ${s.timingMode==='accuracy'?'selected':''}>יעד דיוק</option>
                    <option value="mastery" ${s.timingMode==='mastery'?'selected':''}>יעד שליטה</option>
                </select>
            </label>
            <label class="setting-row"><span>יעד דיוק לתרגול (%)</span>
                <input type="number" id="setAccuracyTarget" min="80" max="100" value="${s.accuracyTarget}">
            </label>
            <label class="setting-row"><span>סף שליטה</span>
                <input type="number" id="setMasteryTarget" min="70" max="100" value="${s.masteryTarget}">
            </label>
            <label class="setting-row"><span>משוב</span>
                <select id="setFeedbackMode">
                    <option value="immediate" ${s.feedbackMode==='immediate'?'selected':''}>מיידי</option>
                    <option value="delayed" ${s.feedbackMode==='delayed'?'selected':''}>בסוף התרגיל</option>
                </select>
            </label>
            <label class="setting-row"><span>תזכורות ארגונומיה</span>
                <input type="checkbox" id="setErgonomics" ${s.ergonomicsReminders?'checked':''}>
            </label>
            <label class="setting-row"><span>שיטת חישוב מ״לד</span>
                <select id="setWpm">
                    <option value="net" ${s.wpmMethod==='net'?'selected':''}>נטו (בניכוי שגיאות)</option>
                    <option value="gross" ${s.wpmMethod==='gross'?'selected':''}>ברוטו</option>
                </select>
            </label>
            <label class="setting-row"><span>גודל גופן</span>
                <select id="setFont">
                    <option value="small" ${s.fontSize==='small'?'selected':''}>קטן</option>
                    <option value="medium" ${s.fontSize==='medium'?'selected':''}>בינוני</option>
                    <option value="large" ${s.fontSize==='large'?'selected':''}>גדול</option>
                </select>
            </label>
            <label class="setting-row"><span>הפחתת אנימציות</span>
                <input type="checkbox" id="setReduceMotion" ${s.reduceMotion?'checked':''}>
            </label>
            <label class="setting-row"><span>אורך מינימלי לתרגיל שנוצר אוטומטית (תווים)</span>
                <input type="number" id="setPracticeLength" min="20" max="300" step="5" value="${s.practiceLength}">
            </label>
            <label class="setting-row"><span>יעד/הגבלת דקות תרגול ביום</span>
                <input type="number" id="setDailyLimitMinutes" min="5" max="240" step="5" value="${s.dailyLimitMinutes}">
            </label>
            <label class="setting-row"><span>הגבל זמן תרגול יומי</span>
                <input type="checkbox" id="setDailyLimitEnabled" ${s.dailyLimitEnabled?'checked':''}>
            </label>
            <div class="setting-help">${t('כשההגבלה פעילה, אחרי שמגיעים ליעד היומי מסיימים את התרגיל הנוכחי ואז התרגול ננעל עד מחר. כשהיא כבויה — היעד רק מעודד וחוגג, בלי לחסום.', 'When the limit is on, after reaching the daily goal you finish the current exercise and practice locks until tomorrow. When off, the goal only motivates and celebrates — it never blocks.')}</div>
            <label class="setting-row"><span>${t('⏱️ תרגול רציף: שיעור ממשיך ללא הפסקה עד שהטיימר היומי נגמר', '⏱️ Non-stop practice: a lesson keeps going until the daily timer ends')}</span>
                <input type="checkbox" id="setNonStop" ${s.nonStopPractice?'checked':''}>
            </label>
            <div class="setting-help">${t('כשדלוק: כשנכנסים לשיעור (למשל האות שאתם עומדים בה), מקבלים עוד ועוד טקסט מאותו שיעור בלי לעצור, עד שמסתיים הזמן שנותר מהיעד היומי (ברירת מחדל 15 דקות). Esc מסיים ושומר את מה שתרגלתם.', 'When on: opening a lesson (e.g. the letter you are up to) keeps giving you fresh text from that lesson without stopping, until the rest of your daily goal time is used up (15 minutes by default). Esc finishes and saves what you practiced.')}</div>
            <label class="setting-row"><span>${t('🔊 הקראת האות הבאה', '🔊 Read the next letter aloud')}</span>
                <select id="setSpeakNext">
                    <option value="off" ${s.speakNext==='off'||!s.speakNext?'selected':''}>${t('כבוי', 'Off')}</option>
                    <option value="letter" ${s.speakNext==='letter'?'selected':''}>${t('האות הבאה', 'Next letter')}</option>
                    <option value="letterFinger" ${s.speakNext==='letterFinger'?'selected':''}>${t('האות הבאה + איזו אצבע', 'Next letter + which finger')}</option>
                    <option value="word" ${s.speakNext==='word'?'selected':''}>${t('כל מילה בתחילתה, ואז אותיות', 'Each word as it starts, then letters')}</option>
                </select>
            </label>
            <label class="setting-row"><span>${t('מהירות ההקראה', 'Speech speed')}</span>
                <input type="range" id="setSpeechRate" min="0.6" max="1.8" step="0.1" value="${s.speechRate||1.1}">
            </label>
            <div class="setting-help">${(typeof Speech==='undefined'||!Speech.available()) ? t('⚠️ הקראה אינה נתמכת בדפדפן המובנה הזה.', '⚠️ Speech is not supported by this built-in browser.') : (Speech.hasHebrew() ? t('✅ נמצא קול עברי — האותיות העבריות יוקראו בשמן העברי (אלף, בית…).', '✅ A Hebrew voice was found — Hebrew letters are read by their Hebrew names (Alef, Bet…).') : t('ℹ️ לא נמצא קול עברי במחשב, לכן האותיות העבריות יוקראו בשמות באנגלית (Alef, Bet…). להוספת קול עברי: הגדרות Windows ← זמן ושפה ← דיבור ← הוסף קולות ← עברית.', 'ℹ️ No Hebrew voice was found, so Hebrew letters are read with English names (Alef, Bet…). To add one: Windows Settings → Time & language → Speech → Add voices → Hebrew.'))} <button class="btn-chip" id="btnTestSpeech" type="button">▶ ${t('נסו', 'Test')}</button></div>
            <label class="setting-row"><span>${t('📊 לוח נתונים חי בזמן התרגול', '📊 Live stats dashboard during practice')}</span>
                <input type="checkbox" id="setLiveDash" ${s.liveDashboard!==false?'checked':''}>
            </label>
            <label class="setting-row"><span>${t('אפשר תיקון עם Backspace (במצב חופשי)', 'Allow Backspace corrections (free mode)')}</span>
                <input type="checkbox" id="setAllowBackspace" ${s.allowBackspace!==false?'checked':''}>
            </label>
            <label class="setting-row"><span>${t('סמן קצב (מירוץ מול יעד המהירות)', 'Pace caret (race your speed goal)')}</span>
                <input type="checkbox" id="setPaceCaret" ${s.paceCaret?'checked':''}>
            </label>
            <label class="setting-row"><span>${t('הודעות עידוד במהלך התרגול', 'Encouragement during practice')}</span>
                <input type="checkbox" id="setEncouragement" ${s.encouragement!==false?'checked':''}>
            </label>
            <label class="setting-row"><span>${t('הצג אות משנית קטנה על המקשים', 'Show small secondary letter on keys')}</span>
                <input type="checkbox" id="setSecondaryLabels" ${s.showSecondaryLabels!==false?'checked':''}>
            </label>
            <label class="setting-row"><span>מעבר אוטומטי לאחר שיעור</span>
                <input type="checkbox" id="setAutoAdvance" ${s.autoAdvance?'checked':''}>
            </label>
            <div class="setting-help">כשהאפשרות דלוקה: בסיום שיעור, אחרי ספירה לאחור קצרה עם אנימציה, האפליקציה עוברת לבד לשיעור הבא אם עברתם, או חוזרת על אותו שיעור אם לא. תמיד אפשר ללחוץ "בטל" כדי לעצור.</div>
        </div>

        <h3>נתונים</h3>
        <div class="settings-actions">
            <button class="btn" id="btnExport">ייצוא גיבוי</button>
            <label class="btn" for="importFile">ייבוא גיבוי</label>
            <input type="file" id="importFile" accept="application/json" style="display:none">
            <button class="btn danger" id="btnReset">איפוס כל הנתונים</button>
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
    container.querySelector('#setCorrection').addEventListener('change', (e) => { s.correctionMode = e.target.value; save(); });
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
    container.insertAdjacentHTML('beforeend', `
        <div class="dash-section ergonomics-card">
            <h3>ארגונומיה</h3>
            <p>שבו בנוחות, שמרו על כתפיים רפויות ופרקי כף יד ניטרליים, והניחו את הידיים בעקביות על שורת הבית. זו הדרכה כללית ואינה תחליף לייעוץ מקצועי.</p>
        </div>
    `);

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
