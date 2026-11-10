// ---- ויזואליזציית מקלדת (3.0) ----
// The keyboard is always drawn in physical (left-to-right) order. Earlier
// versions reversed each row and relied on the page being RTL, which mirrored
// the whole keyboard as soon as the interface was switched to English.

const KEY_WIDTH_UNITS = { ShiftLeft: 2.25, ShiftRight: 2.25, Space: 6.5 };
const ROW_INDENT_UNITS = [0, 1.5, 1.8, 0];

function keyLabelFor(code) {
    if (code === 'ShiftLeft' || code === 'ShiftRight') return 'Shift';
    const layout = getCurrentKeyboardLayout();
    return layout[code] != null ? layout[code] : '';
}
function keySecondaryLabelFor(code) {
    if (appSettings.showSecondaryLabels === false) return '';
    if (code === 'ShiftLeft' || code === 'ShiftRight' || code === 'Space') return '';
    const other = isEnglishTyping() ? KEYBOARD_LAYOUT : ENGLISH_LAYOUT;
    const v = other[code];
    if (!v || v === keyLabelFor(code)) return '';
    return /[a-z]/.test(v) ? v.toUpperCase() : v;
}

function renderKeyboard(container) {
    container.innerHTML = '';
    const kb = document.createElement('div');
    kb.className = 'keyboard';
    kb.setAttribute('dir', 'ltr');
    KEYBOARD_ROWS.forEach((row, ri) => {
        const rowEl = document.createElement('div');
        rowEl.className = 'kb-row kb-row-' + ri;
        if (ROW_INDENT_UNITS[ri]) rowEl.style.paddingInlineStart = `calc(var(--kb-unit) * ${ROW_INDENT_UNITS[ri] * 0.5})`;
        row.forEach(code => rowEl.appendChild(buildKeyEl(code)));
        kb.appendChild(rowEl);
    });
    const spaceRow = document.createElement('div');
    spaceRow.className = 'kb-row kb-row-space';
    spaceRow.appendChild(buildKeyEl('Space'));
    kb.appendChild(spaceRow);
    container.appendChild(kb);
}

function buildKeyEl(code) {
    const keyEl = document.createElement('div');
    keyEl.className = 'kb-key' + (code === 'Space' ? ' kb-space' : '') + (code.startsWith('Shift') ? ' kb-shift' : '') + (code.startsWith('Digit') || code === 'Backquote' || code === 'Minus' || code === 'Equal' ? ' kb-num' : '');
    keyEl.dataset.code = code;
    keyEl.dataset.finger = KEY_TO_FINGER[code] || '';
    const w = KEY_WIDTH_UNITS[code];
    if (w) keyEl.style.width = `calc(var(--kb-unit) * ${w} + var(--kb-gap) * ${Math.max(0, Math.round(w) - 1)})`;
    if (code === 'KeyF' || code === 'KeyJ') keyEl.classList.add('kb-home-bump');
    if (HOME_ROW_KEYS.includes(code)) keyEl.classList.add('kb-home');
    const letter = document.createElement('span');
    letter.className = 'kb-letter';
    letter.textContent = keyLabelFor(code);
    keyEl.appendChild(letter);
    const sec = keySecondaryLabelFor(code);
    if (sec) {
        const s2 = document.createElement('span');
        s2.className = 'kb-sub';
        s2.textContent = sec;
        keyEl.appendChild(s2);
    }
    return keyEl;
}

function highlightTargetKey(ch) {
    document.querySelectorAll('.kb-key').forEach(k => k.classList.remove('kb-target', 'kb-target-faded', 'kb-error', 'kb-target-shift'));
    if (ch == null) { hideFingerPointer(); highlightHandFinger(null); return; }
    // ch can be a grapheme cluster with ניקוד attached (e.g. "שָׁ") — strip it first.
    const base = (typeof stripNiqud === 'function' ? stripNiqud(ch) : ch) || ch;
    const res = resolveKeyForChar(base);
    if (!res) { hideFingerPointer(); highlightHandFinger(null); return; }
    const el = document.querySelector(`.practice-keyboard .kb-key[data-code="${res.code}"]`) || document.querySelector(`.kb-key[data-code="${res.code}"]`);
    const finger = KEY_TO_FINGER[res.code];
    if (el) {
        // עמעום עזרים: לאות ששולטים בה היטב מציגים סימון עדין בלבד.
        const mastery = (typeof charMastery === 'function') ? charMastery(base) : null;
        const shouldFade = appSettings.fadeAssistance !== false && mastery !== null && mastery >= 90;
        el.classList.add(shouldFade ? 'kb-target-faded' : 'kb-target');
        positionFingerPointer(el, finger);
    }
    if (res.shift) {
        const sh = document.querySelector(`.practice-keyboard .kb-key[data-code="${shiftKeyFor(res.code)}"]`);
        if (sh) sh.classList.add('kb-target-shift');
    }
    highlightFingerZone(finger);
    highlightHandFinger(finger, res.shift ? KEY_TO_FINGER[shiftKeyFor(res.code)] : null);
}

// ---- מצביע אצבע: תווית קטנה מעל המקש היעד, מציינת באיזו אצבע להשתמש ----
const FINGER_EMOJI = {
    lp: '🤙', lr: '🤙', lm: '☝️', li: '☝️',
    ri: '☝️', rm: '☝️', rr: '🤙', rp: '🤙', th: '👍'
};
function fingerName(code) {
    if (appSettings.uiLang === 'en') {
        return ({ lp: 'Left pinky', lr: 'Left ring', lm: 'Left middle', li: 'Left index', ri: 'Right index', rm: 'Right middle', rr: 'Right ring', rp: 'Right pinky', th: 'Thumb' })[code] || '';
    }
    return FINGER_NAMES[code] || '';
}
function positionFingerPointer(keyEl, fingerCode) {
    const kbContainer = keyEl.closest('.practice-keyboard');
    if (!kbContainer) return;
    if (!appSettings.showFingerHints) { hideFingerPointer(); return; }
    let ptr = kbContainer.querySelector('.kb-finger-pointer');
    if (!ptr) {
        ptr = document.createElement('div');
        ptr.className = 'kb-finger-pointer';
        ptr.innerHTML = '<span class="kfp-icon"></span><span class="kfp-label"></span>';
        kbContainer.appendChild(ptr);
    }
    const contRect = kbContainer.getBoundingClientRect();
    const keyRect = keyEl.getBoundingClientRect();
    ptr.style.top = (keyRect.top - contRect.top - 34) + 'px';
    ptr.style.left = (keyRect.left - contRect.left + keyRect.width / 2) + 'px';
    ptr.querySelector('.kfp-icon').textContent = FINGER_EMOJI[fingerCode] || '☝️';
    ptr.querySelector('.kfp-label').textContent = fingerName(fingerCode);
    ptr.style.display = '';
    ptr.classList.remove('kfp-bounce');
    void ptr.offsetWidth;
    ptr.classList.add('kfp-bounce');
}
function hideFingerPointer() {
    document.querySelectorAll('.kb-finger-pointer').forEach(p => p.style.display = 'none');
}

function flashErrorKey(typedChar) {
    const base = (typeof stripNiqud === 'function' ? stripNiqud(typedChar) : typedChar) || typedChar;
    const res = resolveKeyForChar(base);
    if (!res) return;
    const el = document.querySelector(`.practice-keyboard .kb-key[data-code="${res.code}"]`);
    if (el) {
        el.classList.add('kb-error');
        setTimeout(() => el.classList.remove('kb-error'), 240);
    }
}
function flashPressedKey(code) {
    if (!code) return;
    const el = document.querySelector(`.practice-keyboard .kb-key[data-code="${code}"]`);
    if (!el) return;
    el.classList.remove('kb-pressed'); void el.offsetWidth; el.classList.add('kb-pressed');
    setTimeout(() => el.classList.remove('kb-pressed'), 160);
}

function highlightFingerZone(finger) {
    document.querySelectorAll('.finger-indicator').forEach(f => f.classList.remove('active'));
    const el = document.querySelector(`.finger-indicator[data-finger="${finger}"]`);
    if (el) el.classList.add('active');
}

// ---- 3.0: שתי כפות ידיים (SVG) — האצבע הנכונה נדלקת בכל הקלדה ----
function renderFingerGuide(container) {
    container.innerHTML = '';
    container.setAttribute('dir', 'ltr');
    const fingersL = [ // [id, x, y, w, h]
        ['lp', 14, 46, 20, 52], ['lr', 38, 24, 21, 74], ['lm', 63, 14, 22, 84], ['li', 89, 26, 22, 72], ['th', 116, 84, 20, 44]
    ];
    const handSvg = (side) => {
        const list = fingersL.map(f => f.slice());
        const fingers = side === 'left' ? list : list.map(([id, x, y, w, h]) => [
            id === 'th' ? 'th' : ({ lp: 'rp', lr: 'rr', lm: 'rm', li: 'ri' })[id], 150 - x - w, y, w, h
        ]);
        const palmX = side === 'left' ? 12 : 39;
        return `<svg class="hand hand-${side}" viewBox="0 0 150 170" aria-hidden="true">
            <rect class="palm" x="${palmX}" y="88" width="100" height="72" rx="26"/>
            ${fingers.map(([id, x, y, w, h]) => `<rect class="finger f-${id}" data-finger="${id}" data-side="${side}" x="${x}" y="${y}" width="${w}" height="${h}" rx="${w / 2}"/>`).join('')}
        </svg>`;
    };
    container.innerHTML = `<div class="hands">${handSvg('left')}<div class="hands-label"></div>${handSvg('right')}</div>`;
}
function highlightHandFinger(finger, shiftFinger) {
    document.querySelectorAll('.hands .finger').forEach(f => f.classList.remove('active', 'active-shift'));
    const label = document.querySelector('.hands-label');
    if (!finger) { if (label) label.textContent = ''; return; }
    document.querySelectorAll(`.hands .finger[data-finger="${finger}"]`).forEach(f => {
        // the thumb is shared: light only one thumb (the right one, by convention)
        if (finger === 'th' && f.dataset.side === 'left') return;
        f.classList.add('active');
    });
    if (shiftFinger) document.querySelectorAll(`.hands .finger[data-finger="${shiftFinger}"]`).forEach(f => f.classList.add('active-shift'));
    if (label) label.textContent = fingerName(finger) + (shiftFinger ? ' + Shift' : '');
}

// ---- מפת חום למקלדת (לפי דיוק/מהירות/תדירות תרגול) ----
function renderKeyboardHeatmap(container, metric) {
    renderKeyboard(container);
    container.querySelectorAll('.kb-key').forEach(keyEl => {
        const ch = getCurrentKeyboardLayout()[keyEl.dataset.code];
        const st = ch != null ? appData.charStats[ch] : null;
        let intensity = 0;
        if (st && st.attempts >= 2) {
            if (metric === 'speed') {
                const avgMs = st.totalMs / Math.max(st.correct, 1);
                intensity = Math.max(0, Math.min(1, (avgMs - 200) / 800));
            } else if (metric === 'frequency') {
                intensity = Math.min(1, st.attempts / 50);
            } else { // accuracy (default) - אדום = חלש
                const acc = st.correct / st.attempts;
                intensity = 1 - acc;
            }
        }
        keyEl.style.setProperty('--heat', intensity.toFixed(2));
        keyEl.classList.add('kb-heat');
        keyEl.classList.toggle('kb-heat-dark-bg', intensity > 0.5);
        if (st && st.attempts >= 2) keyEl.title = `${ch}: ${Math.round(st.correct / st.attempts * 100)}% · ${st.attempts}`;
    });
}
