// ---- 3.2: Read the next letter aloud (Hebrew & English) ----
// Uses the system's speech voices (Web Speech API, offline on Windows).
// Hebrew letters are spoken by their Hebrew names ("אָלֶף", "כַּף סוֹפִית"…) with a
// Hebrew voice; if the computer has no Hebrew voice installed, the English
// transliterated names are used instead ("Alef", "final Kaf"…), so it always works.

const Speech = (function () {
    let voices = [];
    let pendingT = null, lastKey = '', lastAt = 0;
    const ok = typeof window !== 'undefined' && 'speechSynthesis' in window && typeof SpeechSynthesisUtterance !== 'undefined';
    function load() { try { voices = window.speechSynthesis.getVoices() || []; } catch (e) { voices = []; } }
    if (ok) { load(); try { window.speechSynthesis.onvoiceschanged = load; } catch (e) {} }

    const HE_NAMES = { 'א': 'אָלֶף', 'ב': 'בֵּית', 'ג': 'גִּימֶל', 'ד': 'דָּלֶת', 'ה': 'הֵא', 'ו': 'וָו', 'ז': 'זַיִן', 'ח': 'חֵית', 'ט': 'טֵית', 'י': 'יוּד', 'כ': 'כַּף', 'ך': 'כָף סוֹפִית', 'ל': 'לָמֶד', 'מ': 'מֵם', 'ם': 'מֵם סוֹפִית', 'נ': 'נוּן', 'ן': 'נוּן סוֹפִית', 'ס': 'סָמֶךְ', 'ע': 'עַיִן', 'פ': 'פֵּא', 'ף': 'פֵא סוֹפִית', 'צ': 'צָדִי', 'ץ': 'צָדִי סוֹפִית', 'ק': 'קוּף', 'ר': 'רֵישׁ', 'ש': 'שִׁין', 'ת': 'תָּו' };
    const EN_NAMES_OF_HE = { 'א': 'Alef', 'ב': 'Bet', 'ג': 'Gimel', 'ד': 'Dalet', 'ה': 'Hey', 'ו': 'Vav', 'ז': 'Zayin', 'ח': 'Chet', 'ט': 'Tet', 'י': 'Yud', 'כ': 'Kaf', 'ך': 'final Kaf', 'ל': 'Lamed', 'מ': 'Mem', 'ם': 'final Mem', 'נ': 'Nun', 'ן': 'final Nun', 'ס': 'Samech', 'ע': 'Ayin', 'פ': 'Pey', 'ף': 'final Pey', 'צ': 'Tzadi', 'ץ': 'final Tzadi', 'ק': 'Kuf', 'ר': 'Resh', 'ש': 'Shin', 'ת': 'Tav' };
    const PUNCT_HE = { ' ': 'רֶוַח', '.': 'נְקוּדָה', ',': 'פְּסִיק', '-': 'מַקָּף', '?': 'סִימַן שְׁאֵלָה', '!': 'סִימַן קְרִיאָה', '"': 'מֵרְכָאוֹת', "'": 'גֵּרֶשׁ', ':': 'נְקוּדָתַיִם', ';': 'נְקוּדָה וּפְסִיק', '(': 'סוֹגְרַיִם', ')': 'סוֹגְרַיִם', '/': 'לוֹכְסָן' };
    const PUNCT_EN = { ' ': 'space', '.': 'period', ',': 'comma', '-': 'dash', '?': 'question mark', '!': 'exclamation mark', '"': 'quote', "'": 'apostrophe', ':': 'colon', ';': 'semicolon', '(': 'open bracket', ')': 'close bracket', '/': 'slash' };
    const MARK_HE = { 'ְ': 'שְׁוָא', 'ֱ': 'חֲטַף סֶגּוֹל', 'ֲ': 'חֲטַף פַּתָּח', 'ֳ': 'חֲטַף קָמָץ', 'ִ': 'חִירִיק', 'ֵ': 'צֵירֵי', 'ֶ': 'סֶגּוֹל', 'ַ': 'פַּתָּח', 'ָ': 'קָמָץ', 'ֹ': 'חוֹלָם', 'ֻ': 'קֻבּוּץ', 'ּ': 'דָּגֵשׁ', 'ׁ': 'שִׁין יְמָנִית', 'ׂ': 'שִׂין שְׂמָאלִית' };
    const FINGER_HE = { lp: 'זֶרֶת שְׂמֹאל', lr: 'קְמִיצָה שְׂמֹאל', lm: 'אַמָּה שְׂמֹאל', li: 'אֶצְבַּע שְׂמֹאל', ri: 'אֶצְבַּע יָמִין', rm: 'אַמָּה יָמִין', rr: 'קְמִיצָה יָמִין', rp: 'זֶרֶת יָמִין', th: 'אֲגוּדָל' };
    const FINGER_EN = { lp: 'left pinky', lr: 'left ring finger', lm: 'left middle finger', li: 'left index finger', ri: 'right index finger', rm: 'right middle finger', rr: 'right ring finger', rp: 'right pinky', th: 'thumb' };

    function voiceFor(lang) {
        const l = lang.toLowerCase();
        return voices.find(v => (v.lang || '').toLowerCase().replace('_', '-').startsWith(l)) || (l === 'he' ? voices.find(v => (v.lang || '').toLowerCase().startsWith('iw')) : null) || null;
    }
    function hasHebrew() { if (!voices.length) load(); return !!voiceFor('he'); }

    // What to say for a character → { text, lang }
    function describe(ch, withFinger) {
        if (ch == null || ch === '') return null;
        const base = String(ch).replace(/[֑-ׇ]/g, '') || ch;
        const isHe = /[א-ת]/.test(base);
        const isMark = /^[ְ-ׂ]$/.test(ch);
        const heVoice = hasHebrew();
        // Hebrew is spoken in Hebrew when a Hebrew voice exists (for Hebrew text, or a Hebrew UI)
        const useHe = heVoice && (isHe || isMark || (!/[a-zA-Z]/.test(base) && !isEnglishTyping()));
        let text;
        if (isMark) text = useHe ? MARK_HE[ch] : 'niqqud';
        else if (isHe) text = useHe ? HE_NAMES[base] : EN_NAMES_OF_HE[base];
        else if (/[A-Z]/.test(base)) text = useHe ? base : 'capital ' + base;
        else if (/[a-z0-9]/.test(base)) text = base.toUpperCase();
        else text = useHe ? (PUNCT_HE[base] || base) : (PUNCT_EN[base] || base);
        if (withFinger) {
            const r = resolveKeyForChar(base);
            const f = r && KEY_TO_FINGER[r.code];
            if (f) text += useHe ? (', ' + FINGER_HE[f] + (r.shift ? ' עִם שִׁיפְט' : '')) : (', ' + FINGER_EN[f] + (r.shift ? ' with shift' : ''));
        }
        return { text, lang: useHe ? 'he' : 'en' };
    }

    function say(text, lang, opts) {
        if (!ok || !text) return;
        try {
            const synth = window.speechSynthesis;
            synth.cancel();
            const u = new SpeechSynthesisUtterance(text);
            u.lang = lang === 'he' ? 'he-IL' : 'en-US';
            const v = voiceFor(lang === 'he' ? 'he' : 'en');
            if (v) u.voice = v;
            u.rate = Math.max(0.5, Math.min(2, Number(appSettings.speechRate) || 1.1));
            u.volume = (opts && opts.volume != null) ? opts.volume : 1;
            synth.speak(u);
        } catch (e) {}
    }

    // Called whenever the "next character" changes. Debounced so fast typing
    // only speaks the latest letter, and duplicate calls are ignored.
    function speakNext(ch, ctx) {
        const mode = appSettings.speakNext || 'off';
        if (!ok || mode === 'off' || ch == null || ch === '') return;
        const key = (ctx && ctx.key) || ch;
        if (key === lastKey) return;
        lastKey = key; lastAt = Date.now();
        clearTimeout(pendingT);
        pendingT = setTimeout(() => {
            if (mode === 'word' && ctx && ctx.word && ctx.wordStart) {
                const isHe = /[א-ת]/.test(ctx.word);
                if (!isHe || hasHebrew()) { say(ctx.word.replace(/[֑-ׇ]/g, ''), isHe ? 'he' : 'en'); return; }
            }
            const d = describe(ch, mode === 'letterFinger');
            if (d) say(d.text, d.lang);
        }, 70);
    }
    function stop() { clearTimeout(pendingT); lastKey = ''; try { if (ok) window.speechSynthesis.cancel(); } catch (e) {} }
    function test() {
        const he = hasHebrew();
        if (isEnglishTyping()) say('A, S, D, F. ' + t('', 'This is how the next letter will sound.'), 'en');
        else if (he) say('אָלֶף, בֵּית, גִּימֶל. כָּךְ תִּשְׁמְעוּ אֶת הָאוֹת הַבָּאָה.', 'he');
        else say('Alef, Bet, Gimel. No Hebrew voice is installed, so English letter names will be used.', 'en');
    }
    return { available: () => ok, hasHebrew, describe, say, speakNext, stop, test, voiceCount: () => voices.length };
})();
