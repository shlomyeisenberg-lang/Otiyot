// Otiyot arcade bridge (T29). Runs after the legacy scripts and before they are used.
// It gives the earlier games what the old app gave them (the typing layout, the language, the
// letters learned, the weak keys, the word banks and their saved data) from the parent page, and
// it sends their saved data back. The games themselves are not changed.
/* global appData, appSettings, getDefaultData, WORD_BANK, ENGLISH_WORD_BANK, SENTENCE_BANK,
   ENGLISH_SENTENCE_BANK, PARAGRAPH_BANK, ENGLISH_PARAGRAPH_BANK, G3D, game3dDef, TORAH_DATA,
   TORAH_CAT_ORDER, SEFARIM_DEF, PLUS, plusGameDef, startWordRain, startWordStorm, stopStorm,
   HEBREW_LEXICON, ENGLISH_LEXICON */
(function () {
    'use strict';
    var init = null;
    var saveTimer = null;

    function post(msg) { try { window.parent.postMessage(msg, '*'); } catch (e) { /* no parent */ } }

    // ---- what the old app's other scripts used to provide (no XP, no daily limit here) ----
    window.awardXp = function () {};
    window.burstConfetti = function () {};
    window.checkAchievements = function () {};
    window.refreshHeaderStatus = function () {};
    window.isDailyLimitReached = function () { return false; };
    window.showDailyLimitOverlay = function () {};
    window.renderGamesScreen = function () { post({ type: 'otiyot:exit' }); };

    function blobNow() {
        var p = appData.progress;
        return { games3d: p.games3d || {}, games: p.games || {} };
    }
    window.scheduleSaveData = function () {
        clearTimeout(saveTimer);
        saveTimer = setTimeout(function () { post({ type: 'otiyot:save', blob: blobNow() }); }, 400);
    };
    window.flushSaveData = function () {
        clearTimeout(saveTimer);
        post({ type: 'otiyot:save', blob: blobNow() });
    };
    window.saveSettings = function () {};
    window.addEventListener('pagehide', function () { if (init) window.flushSaveData(); });

    function setBank(bank, words) {
        ['short', 'medium', 'long', 'advanced'].forEach(function (k) { bank[k] = words[k].slice(); });
    }
    function setList(list, items) { list.length = 0; items.forEach(function (x) { list.push(x); }); }

    function applyTheme(t) {
        var r = document.documentElement.style;
        document.body.classList.toggle('dark-mode', !!t.dark);
        r.setProperty('--otz-primary', t.gold);
        r.setProperty('--otz-on-primary', t.onGold);
        r.setProperty('--otz-surface', t.page);
        r.setProperty('--otz-on-surface', t.ink);
        r.setProperty('--otz-outline', t.line);
        document.body.style.background = t.page;
        document.body.style.color = t.ink;
    }


    // Hall of Sefarim: only items made of learned letters, nothing from the content rules'
    // blocklist, and a "words you know" shelf so every player (also on the English layout)
    // has something to catch.
    var BLOCKED = ['נשים', 'יבמות', 'כתובות', 'סוטה', 'גיטין', 'קידושין', 'נדה', 'מקואות',
        'שיר השירים', 'רות', 'אסתר', 'חיי שרה', 'זבים'];
    function restrictSefarim(msg) {
        if (typeof TORAH_DATA === 'undefined') return;
        var ok = new Set(msg.letters.concat([' ']));
        var all = [].concat(msg.words.short, msg.words.medium, msg.words.long, msg.words.advanced);
        var fit = function (w) {
            return BLOCKED.indexOf(w) < 0 && Array.from(w).every(function (c) { return ok.has(c); });
        };
        Object.keys(TORAH_DATA).forEach(function (id) {
            if (id === 'mixed') return;
            TORAH_DATA[id].items = TORAH_DATA[id].items.filter(function (it) { return fit(it.w); });
        });
        var seen = {};
        var known = all.filter(function (w) { if (seen[w]) return false; seen[w] = 1; return true; }).slice(0, 80);
        TORAH_DATA.known = { he: 'מילים שלמדתי', en: 'Words I know', icon: '📚', ordered: false,
            items: known.map(function (w) { return { w: w, info: [w, 'מילה שלמדת'], infoEn: [w, 'A word you know'] }; }) };
        TORAH_DATA.mixed.items = [].concat('chumash', 'parshiyot', 'nach', 'sedarim', 'masechtot', 'learning')
            .reduce(function (a, id) { return a.concat(TORAH_DATA[id].items); }, []);
        var order = ['alefbet', 'letternames', 'chumash', 'parshiyot', 'nach', 'sedarim', 'masechtot', 'learning', 'mixed', 'known']
            .filter(function (id) { return TORAH_DATA[id].items.length >= 4; });
        if (order.indexOf('known') < 0) order.push('known');
        TORAH_CAT_ORDER.length = 0;
        order.forEach(function (id) { TORAH_CAT_ORDER.push(id); });
        if (!TORAH_DATA.chumash.items.length) TORAH_DATA.chumash = TORAH_DATA[order[0]];
        SEFARIM_DEF.defaults.category = order[0];
        var st = G3D.store().settings.sefarim;
        if (st && order.indexOf(st.category) < 0) st.category = order[0];
    }

    function start(msg) {
        init = msg;
        var en = msg.layout === 'en';
        appData = getDefaultData();
        var b = msg.blob || {};
        appData.progress.games3d = b.games3d || {};
        appData.progress.games = b.games || {};
        appSettings.englishTypingEnabled = en;
        appSettings.uiLang = msg.uiLang;
        document.documentElement.lang = msg.uiLang;
        document.documentElement.dir = msg.uiLang === 'he' ? 'rtl' : 'ltr';
        applyTheme(msg.theme);

        // Learned letters only: the games draw words, sentences and letters from these.
        setBank(en ? ENGLISH_WORD_BANK : WORD_BANK, msg.words);
        setList(en ? ENGLISH_SENTENCE_BANK : SENTENCE_BANK, msg.sentences);
        setList(en ? ENGLISH_PARAGRAPH_BANK : PARAGRAPH_BANK, msg.paragraphs);
        var known = new Set(msg.letters);
        window.getKnownKeys = function () { return new Set(known); };
        window.getActiveLevel = function () { return 1; };
        window.getWeakCharacters = function (limit) {
            return msg.weak.slice(0, limit || 5).map(function (ch) { return { ch: ch, score: 50, attempts: 3 }; });
        };

        // The old lexicons hold words the player may not be able to type: only the banks above
        // (made of learned letters) feed the games, so the lexicons are emptied in place.
        [typeof HEBREW_LEXICON !== 'undefined' ? HEBREW_LEXICON : null,
            typeof ENGLISH_LEXICON !== 'undefined' ? ENGLISH_LEXICON : null].forEach(function (l) {
            if (l && l.length) l.length = 0;
        });

        if (msg.game === 'sefarim' || msg.game === 'sefarimPlus') restrictSefarim(msg);
        var root = document.getElementById('arcadeRoot');
        if (msg.game === 'shop') { PLUS.openShop(root); document.body.dataset.ready = 'true'; return; }
        if (msg.game === 'daily') { PLUS.startDaily(root); document.body.dataset.ready = 'true'; return; }
        if (msg.game === 'letterRain') { startWordRain(root, 'letters'); document.body.dataset.ready = 'true'; return; }
        if (msg.game === 'wordRain') { startWordRain(root, 'words'); document.body.dataset.ready = 'true'; return; }
        if (msg.game === 'storm') { startWordStorm(root, 'mixed'); document.body.dataset.ready = 'true'; return; }
        var def = plusGameDef(msg.game) || game3dDef(msg.game);
        if (!def) { post({ type: 'otiyot:exit' }); return; }
        G3D.openMenu(root, def);
        document.body.dataset.ready = 'true';
    }

    window.addEventListener('message', function (e) {
        if (e.source !== window.parent) return;
        var d = e.data;
        if (d && d.type === 'otiyot:init' && d.payload) start(d.payload);
    });
    post({ type: 'otiyot:ready' });
})();
