// ---- מבחן הקלדה בזמן קצוב (3.0) ----

function renderTestScreen(container) {
    const bests = (appData.progress.bests && appData.progress.bests.tests) || {};
    const durations = [[15, t('15 שניות', '15 seconds')], [30, t('30 שניות', '30 seconds')], [60, t('דקה', '1 minute')], [120, t('2 דקות', '2 minutes')], [180, t('3 דקות', '3 minutes')], [300, t('5 דקות', '5 minutes')], [600, t('10 דקות', '10 minutes')]];
    const last = appData.progress.lastTest || { d: 60, c: 'words' };
    container.innerHTML = `
        <h2>${t('מבחן הקלדה', 'Typing Test')}</h2>
        <p class="empty-note">${t('מבחן בזמן קצוב על כל אותיות המקלדת. הטיימר מתחיל בהקשה הראשונה.', 'A timed test using the whole keyboard. The timer starts on your first key press.')}</p>
        <div class="test-config">
            <label>${t('משך:', 'Duration:')} <select id="testDuration">
                ${durations.map(([v, l]) => `<option value="${v}" ${v === last.d ? 'selected' : ''}>${l}</option>`).join('')}
            </select></label>
            <label>${t('תוכן:', 'Content:')} <select id="testContent">
                <option value="words" ${last.c === 'words' ? 'selected' : ''}>${t('מילים אקראיות', 'Random words')}</option>
                <option value="sentences" ${last.c === 'sentences' ? 'selected' : ''}>${t('משפטים', 'Sentences')}</option>
                <option value="paragraph" ${last.c === 'paragraph' ? 'selected' : ''}>${t('פסקה טבעית', 'Natural paragraph')}</option>
                <option value="weak" ${last.c === 'weak' ? 'selected' : ''}>${t('התמקדות באותיות חלשות', 'Focus on weak keys')}</option>
            </select></label>
            <button class="btn primary big" id="btnStartTest">▶ ${t('התחל מבחן', 'Start test')}</button>
        </div>
        <div class="dash-section">
            <h3>${t('השיאים שלכם', 'Your records')}</h3>
            <div class="test-bests">${durations.map(([v, l]) => `<div class="dash-stat"><div class="dash-val">${bests['t' + v] || '—'}</div><div class="dash-lbl">${l}</div></div>`).join('')}</div>
        </div>`;
    container.querySelector('#btnStartTest').addEventListener('click', () => {
        const duration = parseInt(container.querySelector('#testDuration').value, 10);
        const contentType = container.querySelector('#testContent').value;
        appData.progress.lastTest = { d: duration, c: contentType };
        startTypingTest(duration, contentType, container);
    });
}

function buildTestText(contentType, approxChars) {
    // Tests always use the full alphabet — a test should measure real typing,
    // not only the few letters a beginner has unlocked so far.
    const all = new Set(Object.values(getCurrentKeyboardLayout()).filter(isLetterChar));
    let text = '';
    let guard = 0;
    const sentences = isEnglishTyping() ? ENGLISH_SENTENCE_BANK : SENTENCE_BANK;
    const paragraphs = isEnglishTyping() ? ENGLISH_PARAGRAPH_BANK : PARAGRAPH_BANK;
    if (contentType === 'paragraph') {
        const order = paragraphs.slice().sort(() => Math.random() - 0.5);
        while (text.length < approxChars && guard++ < 50) text += ' ' + order[guard % order.length];
    } else if (contentType === 'sentences') {
        while (text.length < approxChars && guard++ < 400) text += ' ' + randomChoice(sentences);
    } else if (contentType === 'weak') {
        const weak = getWeakCharacters(6).map(w => w.ch);
        while (text.length < approxChars && guard++ < 400) text += ' ' + generateCharDrill(all, 20, weak);
    } else {
        while (text.length < approxChars && guard++ < 400) text += ' ' + generateWordDrill(all, randomChoice(['short', 'medium', 'medium', 'long']), 8);
    }
    return text.trim();
}

function startTypingTest(durationSec, contentType, backContainer) {
    const text = buildTestText(contentType, Math.max(200, durationSec * 9));
    const back = () => { navigateTo('testScreen'); };
    startPracticeRun({
        text,
        mode: 'test',
        durationLimitMs: durationSec * 1000,
        title: t(`מבחן · ${durationSec >= 60 ? (durationSec / 60) + ' דק׳' : durationSec + ' שניות'}`, `Typing Test · ${durationSec >= 60 ? (durationSec / 60) + ' min' : durationSec + ' sec'}`),
        tip: t('⏱️ הטיימר מתחיל בהקשה הראשונה. בהצלחה!', '⏱️ The timer starts with your first key press. Good luck!'),
        onExit: back,
        onFinish: (metrics) => {
            showResultsScreen(metrics, {
                onContinue: back,
                onRetry: () => startTypingTest(durationSec, contentType, backContainer)
            });
        }
    });
}

// ---- מצב טקסט חופשי ----
function renderCustomTextScreen(container) {
    const recent = Array.isArray(appData.progress.customTexts) ? appData.progress.customTexts : [];
    container.innerHTML = `
        <h2>${t('תרגול מטקסט אישי', 'Practice Custom Text')}</h2>
        <p class="empty-note">${t('הדביקו כל טקסט — מאמר, פרק, מכתב. שורות חדשות, מירכאות מסולסלות וטעמים יומרו אוטומטית לתווים שאפשר להקליד.', 'Paste any text — an article, a chapter, a letter. Line breaks, curly quotes and cantillation marks are converted to typeable characters automatically.')}</p>
        <textarea id="customTextInput" dir="${isEnglishTyping() ? 'ltr' : 'rtl'}" rows="8" placeholder="${isEnglishTyping() ? 'Paste English text to practice...' : t('הדביקו כאן טקסט בעברית לתרגול...', 'Paste Hebrew text to practice...')}"></textarea>
        <div id="customTextAnalysis"></div>
        <div class="test-config">
            <label>${t('הגבלת זמן:', 'Time limit:')} <select id="customTime">
                <option value="0">${t('ללא — עד סוף הטקסט', 'None — until the end')}</option>
                <option value="60">${t('דקה', '1 minute')}</option><option value="180">${t('3 דקות', '3 minutes')}</option><option value="300">${t('5 דקות', '5 minutes')}</option>
            </select></label>
            <button class="btn primary big" id="btnStartCustom">▶ ${t('התחל תרגול', 'Start practice')}</button>
        </div>
        ${recent.length ? `<div class="dash-section"><h3>${t('טקסטים אחרונים', 'Recent texts')}</h3><div class="recent-texts">${recent.map((x, i) => `<button class="recent-text" data-i="${i}" dir="auto">${escapeHtmlDash(x.slice(0, 90))}${x.length > 90 ? '…' : ''}</button>`).join('')}</div></div>` : ''}
    `;
    const textarea = container.querySelector('#customTextInput');
    const analysisEl = container.querySelector('#customTextAnalysis');
    textarea.addEventListener('input', () => { analysisEl.innerHTML = analyzeCustomText(textarea.value); });
    container.querySelectorAll('.recent-text').forEach(b => b.addEventListener('click', () => { textarea.value = recent[Number(b.dataset.i)]; analysisEl.innerHTML = analyzeCustomText(textarea.value); textarea.focus(); }));
    container.querySelector('#btnStartCustom').addEventListener('click', () => {
        const raw = textarea.value.trim();
        if (!raw) { textarea.focus(); return; }
        const list = recent.filter(x => x !== raw); list.unshift(raw);
        appData.progress.customTexts = list.slice(0, 5);
        scheduleSaveData();
        const sec = Number(container.querySelector('#customTime').value) || 0;
        runCustomText(raw, sec);
    });
}
function runCustomText(raw, sec) {
    const back = () => navigateTo('customScreen');
    startPracticeRun({
        text: raw,
        mode: 'custom',
        durationLimitMs: sec ? sec * 1000 : null,
        title: t('טקסט אישי', 'Custom Text'),
        keepNiqud: appSettings.niqudMode !== 'none',
        onExit: back,
        // BUGFIX 3.0: "Try again" used to go back to the empty editor instead of retrying.
        onFinish: (metrics) => showResultsScreen(metrics, { onContinue: back, onRetry: () => runCustomText(raw, sec) })
    });
}

function analyzeCustomText(text) {
    if (!text.trim()) return '';
    const clean = normalizePracticeText(text, true);
    const graphemes = toGraphemes(clean);
    const hasNiqud = /[ְ-ׂ]/.test(text);
    const punctCount = (clean.match(/[.,!?;:()"'\-]/g) || []).length;
    const removed = Math.max(0, toGraphemes(text.replace(/\s+/g, ' ').trim()).length - graphemes.length);
    const words = clean.split(/\s+/).filter(Boolean).length;
    let difficulty = t('קלה', 'Easy');
    if (hasNiqud || punctCount > words * 0.3) difficulty = t('קשה', 'Hard');
    else if (words > 30) difficulty = t('בינונית', 'Medium');
    const estMin = Math.max(1, Math.round(graphemes.length / 5 / Math.max(10, (appData.sessionSummary.count ? appData.sessionSummary.totalWpm / appData.sessionSummary.count : 20))));
    return `
        <div class="analysis-box">
            <span>${t('תווים', 'Characters')}: ${graphemes.length}</span>
            <span>${t('מילים', 'Words')}: ${words}</span>
            <span>${t('פיסוק', 'Punctuation')}: ${punctCount}</span>
            <span>${t('ניקוד', 'Niqqud')}: ${hasNiqud ? t('כן', 'yes') : t('לא', 'no')}</span>
            <span>${t('רמת קושי משוערת', 'Estimated difficulty')}: ${difficulty}</span>
            <span>${t('זמן משוער', 'Estimated time')}: ~${estMin} ${t('דק׳', 'min')}</span>
            ${removed ? `<span>${t('תווים שהומרו/הוסרו', 'Converted/removed characters')}: ${removed}</span>` : ''}
        </div>
    `;
}
