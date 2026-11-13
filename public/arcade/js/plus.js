// ---- 4.2: "New generation" layer for the games (דור חדש) ----
// Wraps a 3D game (old or new) WITHOUT changing it, and adds on top:
//  • Perk drafts — after every level you pick 1 of 3 upgrade cards by TYPING the
//    letter printed on the card (rogue-lite runs: shields, revive, lucky words…).
//  • Target letters 🎯 — two of YOUR weakest letters are "bounty" letters: every
//    time you type one you earn extra points and coins, and the word source leans
//    toward words that contain them. That is where the learning happens.
//  • Challenge events — boss monster, flawless streak, letter hunt, sprint.
//  • Coins 🪙 (kept between games), a booster shop and a daily challenge.
// The old games stay exactly as they were; these are separate entries.

const PLUS = (function () {
    // ---------- persistent wallet ----------
    function wallet() {
        const g = G3D.store();
        if (!g.plus || typeof g.plus !== 'object') g.plus = {};
        const p = g.plus;
        p.coins = Math.max(0, p.coins | 0);
        if (!p.next || typeof p.next !== 'object') p.next = {};
        if (!p.daily || typeof p.daily !== 'object') p.daily = {};
        if (!p.stats || typeof p.stats !== 'object') p.stats = {};
        return p;
    }
    function coins() { return wallet().coins; }

    // ---------- shop ----------
    const BOOSTERS = [
        { id: 'shield', icon: '🛡️', price: 40, he: 'מגן פותח', en: 'Starting shield', dh: 'מתחילים את המשחק הבא עם מגן', de: 'Start the next game with a shield' },
        { id: 'life', icon: '💖', price: 50, he: 'חיים נוספים', en: 'Extra life', dh: '+1 חיים במשחק הבא', de: '+1 life in the next game' },
        { id: 'fever', icon: '🔥', price: 60, he: 'פיבר מוכן', en: 'Fever ready', dh: 'מד הפיבר מלא כמעט מההתחלה', de: 'The fever meter starts almost full' },
        { id: 'perk', icon: '🎁', price: 80, he: 'שדרוג פתיחה', en: 'Opening perk', dh: 'בוחרים שדרוג כבר בהתחלה', de: 'Pick a perk right at the start' },
        { id: 'coins2', icon: '🧲', price: 100, he: 'מגנט מטבעות', en: 'Coin magnet', dh: 'מטבעות כפולים במשחק הבא', de: 'Double coins in the next game' }
    ];
    function buy(id) {
        const w = wallet(), b = BOOSTERS.find(x => x.id === id);
        if (!b || w.coins < b.price) return false;
        w.coins -= b.price; w.next[id] = (w.next[id] || 0) + 1;
        scheduleSaveData();
        return true;
    }

    // ---------- daily challenge ----------
    function todayKey() { const d = new Date(); return `${d.getFullYear()}-${d.getMonth() + 1}-${d.getDate()}`; }
    function hash(s) { let h = 2166136261; for (let i = 0; i < s.length; i++) { h ^= s.charCodeAt(i); h = Math.imul(h, 16777619); } return h >>> 0; }
    const DAILY_MODS = [
        { id: 'glass', icon: '💎', he: 'זכוכית — חיים אחד, ניקוד ×2', en: 'Glass — one life, score ×2', cfg: { lives: 1 }, scoreMul: 2 },
        { id: 'turbo', icon: '⚡', he: 'טורבו — קושי קשה, מטבעות ×2', en: 'Turbo — hard difficulty, coins ×2', cfg: { difficulty: 'hard' }, coinMul: 2 },
        { id: 'hunt', icon: '🎯', he: 'יום הציד — אותיות המטרה שוות פי 3', en: 'Hunting day — target letters worth ×3', bountyMul: 3 },
        { id: 'rich', icon: '🪙', he: 'יום עשיר — מטבעות ×3', en: 'Rich day — coins ×3', coinMul: 3 },
        { id: 'sprint', icon: '⏱️', he: 'ספרינט — 90 שניות נגד השעון, ניקוד ×1.5', en: 'Sprint — 90 seconds on the clock, score ×1.5', cfg: { mode: 'timed', duration: 90 }, scoreMul: 1.5 },
        { id: 'lucky', icon: '🍀', he: 'יום המזל — מתחילים עם שדרוג ומזל', en: 'Lucky day — start with a perk and luck', startPerk: true, lucky: 0.12 }
    ];
    const DAILY_GAMES = ['runner', 'rhythm', 'fortress', 'galaxyPlus', 'towerPlus', 'arenaPlus', 'racePlus', 'sefarimPlus'];
    function dailyInfo() {
        const key = todayKey(), h = hash(key + '|typing');
        const w = wallet();
        const gameId = DAILY_GAMES[h % DAILY_GAMES.length];
        const mod = DAILY_MODS[(h >>> 7) % DAILY_MODS.length];
        const def = plusGameDef(gameId);
        const baseId = def ? (def.plusBase || def.id) : gameId;
        const best = Math.max(((appData.progress.games || {})[baseId + 'Best'] || 0), ((appData.progress.games || {})[gameId + 'Best'] || 0));
        const target = best > 0 ? Math.max(500, Math.round(best * 0.55 / 50) * 50) : 900;
        const done = w.daily.last === key;
        // streak: consecutive days with a completed daily challenge
        let streak = w.daily.streak || 0;
        const y = new Date(); y.setDate(y.getDate() - 1);
        const yKey = `${y.getFullYear()}-${y.getMonth() + 1}-${y.getDate()}`;
        if (!done && w.daily.last !== yKey) streak = 0;
        const reward = 60 + Math.min(5, streak) * 15;
        return { key, gameId, def, mod, target, done, streak, reward };
    }
    function dailyDef() {
        const d = dailyInfo();
        if (!d.def) return null;
        const def = Object.assign({}, d.def, {
            id: 'daily', daily: d, plusBase: d.def.plusBase || d.def.id,
            title: () => `📅 ${t('האתגר היומי', 'Daily challenge')}: ${d.def.title()}`,
            startBanner: () => `📅 ${t('האתגר היומי', 'Daily challenge')}`,
            startSub: () => `${d.mod.icon} ${t(d.mod.he, d.mod.en)} · 🎯 ${d.target.toLocaleString()} ${t('נק׳', 'pts')}`
        });
        return def;
    }
    function startDaily(container) {
        const def = dailyDef(); if (!def) return;
        const cfg = Object.assign(G3D.getSettings(def.plusBase, def.defaults), def.daily.mod.cfg || {});
        cfg.missions = true;
        G3D.play(container, def, cfg);
    }

    // ---------- target ("bounty") letters ----------
    function pickBounty(prev) {
        const known = Array.from(getKnownKeys()).filter(isLetterChar);
        let weak = [];
        try { weak = getWeakCharacters(8).filter(w => w.score < 88).map(w => w.ch); } catch (e) {}
        const pool = weak.filter(c => !(prev || []).includes(c));
        const out = [];
        while (out.length < 2 && pool.length) out.push(pool.splice(Math.floor(Math.random() * Math.min(pool.length, 4)), 1)[0]);
        const rest = known.filter(c => !out.includes(c) && !(prev || []).includes(c));
        while (out.length < 2 && rest.length) out.push(rest.splice(Math.floor(Math.random() * rest.length), 1)[0]);
        known.forEach(c => { if (out.length < 2 && !out.includes(c)) out.push(c); });
        return out;
    }
    let _vocab = null, _vocabKey = '';
    function vocabulary() {
        const en = isEnglishTyping();
        const known = new Set(Array.from(getKnownKeys()));
        const key = (en ? 'en' : 'he') + known.size;
        if (_vocab && _vocabKey === key) return _vocab;
        const bank = en ? ENGLISH_WORD_BANK : WORD_BANK;
        const lex = en ? (typeof ENGLISH_LEXICON !== 'undefined' ? ENGLISH_LEXICON : []) : (typeof HEBREW_LEXICON !== 'undefined' ? HEBREW_LEXICON : []);
        const all = Array.from(new Set([].concat(bank.short, bank.medium, bank.long, bank.advanced, lex).filter(w => w && !/[\s']/.test(w))));
        const fits = all.filter(w => Array.from(w).every(c => known.has(c)));
        _vocab = fits.length >= 30 ? fits : all; _vocabKey = key;
        return _vocab;
    }
    // A word source like galaxyWordSource, leaning toward the current target letters.
    function biasedSource(orig, P) {
        return {
            mode: orig.mode,
            next(level) {
                if (Math.random() < 0.42 && P.bounty.length) {
                    if (orig.mode === 'letters') {
                        const known = Array.from(getKnownKeys()).filter(isLetterChar);
                        const n = Math.min(5, 2 + Math.floor(Math.random() * 2) + Math.floor(level / 3));
                        const arr = []; for (let i = 0; i < n; i++) arr.push(randomChoice(known.length ? known : P.bounty));
                        arr[Math.floor(Math.random() * n)] = randomChoice(P.bounty);
                        return arr.join('');
                    }
                    const list = vocabulary().filter(w => P.bounty.some(b => w.includes(b)) && Array.from(w).length <= 4 + level);
                    if (list.length) return randomChoice(list);
                }
                return orig.next(level);
            },
            sentence() { return orig.sentence(); }
        };
    }

    // ---------- perks ----------
    const RARITY = { common: ['רגיל', 'Common'], rare: ['נדיר', 'Rare'], epic: ['אפי', 'Epic'] };
    const PERKS = [
        { id: 'shield', icon: '🛡️', r: 'common', max: 3, lives: true, he: 'מגן', en: 'Shield', dh: 'בולע את הפגיעה הבאה', de: 'Absorbs the next hit', apply: P => { P.shield++; } },
        { id: 'heart', icon: '💖', r: 'common', max: 9, lives: true, he: 'לב', en: 'Heart', dh: '+1 חיים עכשיו', de: '+1 life right now', apply: P => { P.api.heal(1); } },
        { id: 'perfect', icon: '✨', r: 'common', max: 3, he: 'פרפקציוניסט', en: 'Perfectionist', dh: 'מילה בלי טעות שווה +50%', de: 'Flawless words worth +50%', apply: P => { P.perfectBonus += 0.5; } },
        { id: 'fever', icon: '🔥', r: 'common', max: 3, he: 'ידיים חמות', en: 'Hot hands', dh: 'מד הפיבר מתמלא מהר יותר', de: 'The fever meter fills faster', apply: P => { P.feverMul += 0.6; } },
        { id: 'magnet', icon: '🧲', r: 'rare', max: 2, he: 'מגנט', en: 'Magnet', dh: 'מטבעות כפולים', de: 'Double coins', apply: P => { P.coinMul *= 2; } },
        { id: 'forgive', icon: '🪶', r: 'rare', max: 1, he: 'סליחה', en: 'Forgiveness', dh: 'הטעות הראשונה בכל מילה לא שוברת את הרצף', de: 'The first mistake in each word keeps your combo', apply: P => { P.forgive = true; } },
        { id: 'hunter', icon: '🎯', r: 'rare', max: 2, he: 'צייד', en: 'Hunter', dh: 'אותיות המטרה שוות פי 2 יותר', de: 'Target letters worth twice as much', apply: P => { P.bountyMul += 1; } },
        { id: 'lucky', icon: '🍀', r: 'rare', max: 3, he: 'תלתן', en: 'Clover', dh: '10% סיכוי לג׳קפוט ×5 על מילה', de: '10% chance of a ×5 jackpot word', apply: P => { P.lucky += 0.1; } },
        { id: 'streak', icon: '⚡', r: 'rare', max: 1, he: 'בנק רצפים', en: 'Streak bank', dh: 'כל 10 ברצף = בונוס נקודות ומטבעות', de: 'Every 10 in a row = bonus points and coins', apply: P => { P.streakBank = true; } },
        { id: 'scholar', icon: '📖', r: 'rare', max: 2, he: 'למדן', en: 'Scholar', dh: '+40% XP בסוף המשחק', de: '+40% XP at the end', apply: P => { P.xpBonus += 0.4; } },
        { id: 'time', icon: '⏱️', r: 'rare', max: 3, timer: true, he: 'זמן נוסף', en: 'Extra time', dh: '+20 שניות לשעון', de: '+20 seconds on the clock', apply: P => { P.api.addTime(20); } },
        { id: 'phoenix', icon: '🔆', r: 'epic', max: 1, lives: true, he: 'עוף החול', en: 'Phoenix', dh: 'כשהחיים נגמרים — חוזרים עם 2', de: 'When you run out of lives — come back with 2', apply: P => { P.revive++; } },
        { id: 'midas', icon: '👑', r: 'epic', max: 1, he: 'מגע הזהב', en: 'Midas touch', dh: 'כל מילה מושלמת = עוד מטבע וניקוד ×1.3', de: 'Every flawless word: +1 coin and ×1.3 points', apply: P => { P.midas = true; } },
        { id: 'double', icon: '💠', r: 'epic', max: 1, he: 'כפול', en: 'Double up', dh: 'כל הנקודות ×1.25 עד סוף המשחק', de: 'All points ×1.25 for the rest of the game', apply: P => { P.scoreMul *= 1.25; } }
    ];
    const RW = { common: 60, rare: 30, epic: 10 };
    function drawPerks(P, n, luckyBox) {
        const ok = PERKS.filter(p => (P.taken[p.id] || 0) < p.max && (!p.lives || P.hasLives) && (!p.timer || P.api.hasTimer));
        const out = [];
        const w = p => RW[p.r] * (luckyBox && p.r !== 'common' ? 2.5 : 1);
        while (out.length < n && ok.length) {
            const tot = ok.reduce((a, p) => a + w(p), 0);
            let x = Math.random() * tot, i = 0;
            for (; i < ok.length; i++) { x -= w(ok[i]); if (x <= 0) break; }
            out.push(ok.splice(Math.min(i, ok.length - 1), 1)[0]);
        }
        return out;
    }

    // ---------- events ----------
    const EVENTS = {
        boss: { icon: '👹', he: 'מפלצת האותיות', en: 'The Letter Monster', dh: 'כל הקשה נכונה פוגעת בה — הביסו אותה לפני שהזמן נגמר!', de: 'Every correct key hits it — defeat it before time runs out!' },
        flawless: { icon: '💎', he: 'אתגר היהלום', en: 'Diamond challenge', dh: '5 מילים ברצף בלי אף טעות', de: '5 words in a row without a single mistake' },
        hunt: { icon: '🎯', he: 'ציד אותיות', en: 'Letter hunt', dh: 'הקלידו את אותיות המטרה כמה שיותר', de: 'Type as many target letters as you can' },
        sprint: { icon: '⚡', he: 'ספרינט', en: 'Sprint', dh: 'הקשות נכונות מהר — 15 שניות', de: 'Correct keys, fast — 15 seconds' }
    };

    // ---------- run: wrap a game ----------
    function run(base, api, o) {
        o = o || {};
        const def = api.def || {};
        const daily = def.daily || null;
        const mod = daily ? daily.mod : {};
        const w = wallet();
        const P = {
            api, bounty: pickBounty([]), coins: 0, shield: 0, revive: 0, perfectBonus: 0, feverMul: 1, coinMul: 1, bountyMul: 2 + (mod.bountyMul ? mod.bountyMul - 2 : 0),
            lucky: mod.lucky || 0, streakBank: false, xpBonus: 0, midas: false, forgive: false, scoreMul: mod.scoreMul || 1,
            taken: {}, perksList: [], curErr: 0, forgaveWord: false, okFlag: false, bountyHits: 0, eventsWon: 0, eventsLost: 0, jackpots: 0,
            hasLives: api.cfg.mode !== 'zen' && !o.noLives, event: null, eventCooldown: 0, drafts: 0, wordsSinceDraft: 0, lastStreakBank: 0,
            keyTimes: [], dailyDone: false, boosters: []
        };
        if (mod.coinMul) P.coinMul *= mod.coinMul;
        const stage = api.stage;
        // HUD
        const hudEl = document.createElement('div');
        hudEl.className = 'gp-hud';
        stage.appendChild(hudEl);
        const evEl = document.createElement('div'); evEl.className = 'gp-event'; stage.appendChild(evEl);
        const drEl = document.createElement('div'); drEl.className = 'gp-draft'; drEl.style.display = 'none'; stage.appendChild(drEl);
        function hud(pulse) {
            hudEl.innerHTML = `<span class="gp-coins${pulse === 'coin' ? ' pulse' : ''}">🪙 <b>${(w.coins + P.coins).toLocaleString()}</b>${P.coins ? `<small>+${P.coins}</small>` : ''}</span>
                <span class="gp-bounty${pulse === 'bounty' ? ' pulse' : ''}" title="${t('אותיות מטרה', 'Target letters')}">🎯 ${P.bounty.map(c => `<b>${c}</b>`).join('')}<small>×${P.bountyMul}</small></span>
                ${P.shield ? `<span class="gp-chip">🛡️×${P.shield}</span>` : ''}${P.revive ? `<span class="gp-chip">🔆</span>` : ''}
                <span class="gp-perks">${P.perksList.map(p => `<i title="${t(p.he, p.en)}">${p.icon}</i>`).join('')}</span>`;
        }
        function addCoins(n, pulse) { n = Math.max(0, Math.round(n * P.coinMul)); if (!n) return; P.coins += n; hud(pulse || 'coin'); }

        // ---- word source bias (galaxy / tower and the new games use galaxyWordSource) ----
        const origSource = window.galaxyWordSource;
        let game;
        window.galaxyWordSource = function (cfg) { return biasedSource(origSource(cfg), P); };
        P.wordSource = (cfg) => biasedSource(origSource(cfg), P);

        // ---- wrapped api ----
        const papi = Object.create(api);
        papi.plus = P;
        papi.keyOk = function () {
            P.okFlag = true;
            api.keyOk();
            const now = performance.now();
            P.keyTimes.push(now); if (P.keyTimes.length > 120) P.keyTimes.shift();
            if (P.event) P.event.onKey && P.event.onKey(true);
        };
        papi.keyBad = function () {
            P.curErr++;
            if (P.forgive && !P.forgaveWord && api.combo > 0) {
                const c = api.combo; P.forgaveWord = true;
                api.keyBad(); api.setCombo(c);
                api.banner('🪶', t('סליחה — הרצף נשמר', 'Forgiven — combo kept'), 'small', 700);
            } else api.keyBad();
            if (P.event && P.event.onKey) P.event.onKey(false);
        };
        papi.wordDone = function (b, pos, opts) {
            const perfect = P.curErr === 0;
            const bountyWord = P.curChars && P.bounty.some(c => P.curChars.includes(c));
            let mul = P.scoreMul;
            if (perfect) mul *= 1 + P.perfectBonus + (P.midas ? 0.3 : 0);
            if (bountyWord) mul *= 1 + (P.bountyMul - 1) * 0.35;
            let jack = false;
            if (P.lucky && Math.random() < P.lucky) { mul *= 5; jack = true; P.jackpots++; }
            const pts = api.wordDone(Math.round(b * mul), pos, jack ? { cls: 'boss' } : opts);
            if (jack) { api.banner('🍀 ' + t('ג׳קפוט!', 'Jackpot!'), '×5', 'power', 1000); api.audio.sfx('power'); addCoins(5); }
            addCoins(1 + (perfect ? 1 : 0) + (bountyWord ? 1 : 0) + (P.midas && perfect ? 1 : 0));
            if (P.feverMul > 1) api.feverBoost((perfect ? 0.05 : 0.02) * (P.feverMul - 1));
            if (P.streakBank && api.combo >= P.lastStreakBank + 10) {
                P.lastStreakBank = Math.floor(api.combo / 10) * 10;
                api.addScore(80 * api.level); addCoins(4);
                api.banner('⚡ ' + t('בנק רצפים', 'Streak bank'), `${P.lastStreakBank} ${t('ברצף', 'in a row')} · +🪙`, 'small', 900);
            }
            if (api.combo === 0) P.lastStreakBank = 0;
            if (P.event && P.event.onWord) P.event.onWord(perfect, P.curChars || '');
            P.curErr = 0; P.forgaveWord = false; P.curChars = '';
            P.wordsSinceDraft++;
            if (o.draftEvery && P.wordsSinceDraft >= o.draftEvery && !api.isOver()) { P.wordsSinceDraft = 0; setTimeout(() => levelMoment(), 500); }
            return pts;
        };
        papi.damage = function (n) {
            if (api.cfg.mode === 'zen' || api.isOver()) return api.damage(n);
            if (P.shield > 0) {
                P.shield--; hud();
                api.audio.sfx('power'); api.flash('rgba(120,200,255,0.35)');
                api.banner('🛡️ ' + t('המגן ספג את הפגיעה', 'Shield absorbed the hit'), '', 'small', 900);
                api.setCombo(0);
                return false;
            }
            if (P.revive > 0 && api.lives - (n || 1) <= 0 && api.cfg.mode === 'classic') {
                P.revive--; api.heal(2); hud();
                api.banner('🔆 ' + t('עוף החול!', 'Phoenix!'), t('חזרתם לחיים', 'Back from the ashes'), 'power', 1600);
                api.audio.sfx('fanfare');
            }
            return api.damage(n);
        };
        papi.levelUp = function (sub) {
            api.levelUp(sub);
            P.bounty = pickBounty(P.bounty); hud('bounty');
            setTimeout(() => levelMoment(), 1100);
        };

        // ---- level moment: draft, sometimes followed by an event ----
        function levelMoment() {
            if (api.isOver() || api.isDying() || api.isHeld() || P.event) return;
            P.drafts++;
            openDraft(t('⬆️ בחרו שדרוג', '⬆️ Choose an upgrade'), false, () => {
                if (P.drafts % 2 === 0) setTimeout(startEvent, 1500);
            });
        }
        function openDraft(title, luckyBox, after) {
            const perks = drawPerks(P, 3, luckyBox);
            if (!perks.length) { if (after) after(); return; }
            const known = Array.from(getKnownKeys()).filter(isLetterChar);
            const keys = [];
            P.bounty.concat(known.sort(() => Math.random() - 0.5)).forEach(c => { if (keys.length < perks.length && !keys.includes(c)) keys.push(c); });
            while (keys.length < perks.length) keys.push(String(keys.length + 1));
            drEl.style.display = '';
            drEl.innerHTML = `<div class="gp-draft-box"><h2>${title}</h2><p>${t('הקלידו את האות שעל הכרטיס (או לחצו עליו)', 'Type the letter on a card (or click it)')}</p>
                <div class="gp-cards">${perks.map((p, i) => `<div class="gp-card r-${p.r}" data-i="${i}" style="animation-delay:${i * 0.09}s">
                    <div class="gp-card-key">${keys[i]}</div><div class="gp-card-icon">${p.icon}</div><b>${t(p.he, p.en)}</b><span>${t(p.dh, p.de)}</span>
                    <small>${t(RARITY[p.r][0], RARITY[p.r][1])}${P.taken[p.id] ? ` · ${t('יש לכם', 'owned')} ${P.taken[p.id]}` : ''}</small></div>`).join('')}</div></div>`;
            api.audio.sfx('levelup');
            let chosen = false;
            const choose = (i) => {
                if (chosen) return; chosen = true;
                const p = perks[i];
                const card = drEl.querySelector(`.gp-card[data-i="${i}"]`);
                if (card) card.classList.add('chosen');
                P.taken[p.id] = (P.taken[p.id] || 0) + 1; P.perksList.push(p);
                p.apply(P);
                api.audio.sfx('perfect', { pitch: 200 });
                setTimeout(() => {
                    drEl.style.display = 'none'; drEl.innerHTML = '';
                    api.unhold(); hud();
                    api.banner(`${p.icon} ${t(p.he, p.en)}`, t(p.dh, p.de), 'small power', 1300);
                    if (after) after();
                }, 420);
            };
            drEl.querySelectorAll('.gp-card').forEach(c => c.addEventListener('click', () => choose(Number(c.dataset.i))));
            api.hold((e) => {
                if (e.key === 'Escape') return;
                const ch = resolveTypedChar(e, '');
                let i = keys.indexOf(ch);
                if (i < 0 && /^[1-3]$/.test(e.key)) i = Number(e.key) - 1;
                if (i >= 0 && i < perks.length) choose(i);
                else if (ch) { const box = drEl.querySelector('.gp-cards'); box.classList.remove('shake'); void box.offsetWidth; box.classList.add('shake'); api.audio.sfx('error'); }
            });
        }

        // ---- events ----
        function startEvent() {
            if (api.isOver() || api.isDying() || P.event || api.isHeld()) return;
            const pool = ['boss', 'boss', 'flawless', 'hunt', 'sprint'];
            const kind = pool[Math.floor(Math.random() * pool.length)];
            const lvl = api.level;
            const rate = (() => { const n = P.keyTimes.length; if (n < 10) return 2; const span = (P.keyTimes[n - 1] - P.keyTimes[0]) / 1000; return Math.max(1, Math.min(8, (n - 1) / Math.max(1, span))); })();
            const E = { kind, info: EVENTS[kind], left: 0, prog: 0, need: 0 };
            if (kind === 'boss') { E.need = Math.round(Math.max(25, rate * 26) + lvl * 4); E.left = 36; }
            else if (kind === 'flawless') { E.need = 5; E.left = 45; }
            else if (kind === 'hunt') { E.need = 6 + Math.min(6, lvl); E.left = 30; }
            else { E.need = Math.max(14, Math.round(rate * 15 * 1.12)); E.left = 15; }
            E.total = E.left;
            E.onKey = (ok) => {
                if (kind === 'boss' && ok) { E.prog++; bossHit(); }
                if (kind === 'sprint' && ok) E.prog++;
                if (kind === 'flawless' && !ok) { if (E.prog > 0) api.banner('💔', t('הרצף התאפס', 'Streak reset'), 'small', 600); E.prog = 0; }
                drawEvent();
                if (E.prog >= E.need) finishEvent(true);
            };
            E.onWord = (perfect) => {
                if (kind === 'flawless' && perfect) E.prog++;
                if (kind === 'boss' && perfect) { E.prog += 3; bossHit(true); }
                drawEvent();
                if (E.prog >= E.need) finishEvent(true);
            };
            E.onBounty = () => { if (kind === 'hunt') { E.prog++; drawEvent(); if (E.prog >= E.need) finishEvent(true); } };
            P.event = E;
            api.banner(`${E.info.icon} ${t(E.info.he, E.info.en)}`, t(E.info.dh, E.info.de), kind === 'boss' ? 'boss' : 'power', 2200);
            api.audio.sfx(kind === 'boss' ? 'bigexplode' : 'power');
            evEl.className = 'gp-event show ' + kind;
            drawEvent();
        }
        function bossHit(big) {
            const m = evEl.querySelector('.gp-monster');
            if (m) { m.classList.remove('hit'); void m.offsetWidth; m.classList.add('hit'); }
            if (big) api.audio.sfx('hit');
        }
        function drawEvent() {
            const E = P.event; if (!E) return;
            const f = Math.min(1, E.prog / E.need);
            const extra = E.kind === 'hunt' ? `🎯 ${P.bounty.join(' ')}` : '';
            evEl.innerHTML = `${E.kind === 'boss' ? `<div class="gp-monster">👹</div>` : ''}<div class="gp-ev-body"><b>${E.info.icon} ${t(E.info.he, E.info.en)}</b>
                <div class="gp-ebar ${E.kind}"><span style="width:${Math.round((E.kind === 'boss' ? 1 - f : f) * 100)}%"></span></div>
                <small>${E.kind === 'boss' ? `❤️ ${Math.max(0, E.need - E.prog)}` : `${E.prog}/${E.need}`} · ⏳ ${Math.ceil(E.left)}${t('ש׳', 's')} ${extra}</small></div>`;
        }
        function finishEvent(win) {
            const E = P.event; if (!E) return;
            P.event = null;
            evEl.className = 'gp-event';
            setTimeout(() => { if (!P.event) evEl.innerHTML = ''; }, 400);
            if (win) {
                P.eventsWon++;
                api.addScore(250 * api.level);
                addCoins(15);
                api.audio.sfx('fanfare');
                api.banner(`🏆 ${t('ניצחתם!', 'You won!')}`, `${E.info.icon} +${(250 * api.level).toLocaleString()} · +🪙 · 🎁 ${t('תיבת אוצר', 'Treasure chest')}`, 'power', 1600);
                api.feverBoost(0.35);
                if (api.particles) api.particles.emit(api.camera.position.clone().add(new api.THREE.Vector3(0, 0, -6)), Math.round(140 * api.Q.part), { color: 0xffd24a, color2: 0xffffff, speed: 8, size: 0.45, life: 1.1 });
                setTimeout(() => { if (!api.isOver() && !api.isDying() && !api.isHeld()) openDraft(t('🎁 תיבת אוצר — שדרוג נדיר', '🎁 Treasure chest — a rare upgrade'), true); }, 1300);
            } else {
                P.eventsLost++;
                api.setCombo(0);
                api.audio.sfx('miss');
                api.banner(`⌛ ${t('האתגר נגמר', 'Challenge over')}`, t('בפעם הבאה! הקצב יגיע', 'Next time! The speed will come'), 'small', 1400);
            }
        }

        // ---- build the game (with the biased word source) ----
        try { game = base.create(papi); } finally { window.galaxyWordSource = origSource; }
        const wrap = Object.create(game);
        wrap.onChar = function (ch) {
            P.okFlag = false;
            game.onChar(ch);
            if (P.okFlag) {
                P.curChars = (P.curChars || '') + ch;
                if (P.bounty.includes(ch)) {
                    P.bountyHits++;
                    api.addScore(4 * P.bountyMul * api.level);
                    if (P.bountyHits % 3 === 0) addCoins(1, 'bounty'); else hud('bounty');
                    if (P.event && P.event.onBounty) P.event.onBounty();
                }
            }
        };
        wrap.update = function (dt, raw) {
            game.update(dt, raw);
            if (P.event) {
                P.event.left -= raw;
                if (Math.random() < 0.15) drawEvent();
                if (P.event.left <= 0) finishEvent(false);
            }
        };
        wrap._syncStats = function (S) { if (game._syncStats) game._syncStats(S); S.plus = P; };
        wrap.dispose = function () { window.galaxyWordSource = origSource; if (game.dispose) game.dispose(); };

        // ---- boosters bought in the shop are used up now ----
        const nx = w.next; let startPerk = !!mod.startPerk;
        if (nx.shield && P.hasLives) { P.shield++; nx.shield--; P.boosters.push('🛡️'); }
        if (nx.life && P.hasLives) { setTimeout(() => api.heal(1), 50); nx.life--; P.boosters.push('💖'); }
        if (nx.fever) { setTimeout(() => api.feverBoost(0.85), 50); nx.fever--; P.boosters.push('🔥'); }
        if (nx.coins2) { P.coinMul *= 2; nx.coins2--; P.boosters.push('🧲'); }
        if (nx.perk) { startPerk = true; nx.perk--; P.boosters.push('🎁'); }
        Object.keys(nx).forEach(k => { if (!nx[k]) delete nx[k]; });
        if (P.boosters.length) scheduleSaveData();
        if (startPerk) setTimeout(() => { if (!api.isOver()) openDraft(t('🎁 שדרוג פתיחה', '🎁 Opening perk'), true); }, 2800);
        hud();
        return wrap;
    }

    // ---------- end of game ----------
    function endHtml(S) {
        const P = S.plus; if (!P) return '';
        const d = S.plusDaily;
        return `<div class="gp-end">
            <div class="gp-end-row"><span>🪙 <b>+${P.coins}</b> ${t('מטבעות', 'coins')}</span><span>🎯 <b>${P.bountyHits}</b> ${t('אותיות מטרה', 'target letters')} (${P.bounty.join(' ')})</span>
            ${P.eventsWon + P.eventsLost ? `<span>🏆 <b>${P.eventsWon}/${P.eventsWon + P.eventsLost}</b> ${t('אתגרים', 'challenges')}</span>` : ''}${P.jackpots ? `<span>🍀 ×${P.jackpots}</span>` : ''}</div>
            ${P.perksList.length ? `<div class="gp-end-perks">${P.perksList.map(p => `<span title="${t(p.dh, p.de)}">${p.icon} ${t(p.he, p.en)}</span>`).join('')}</div>` : ''}
            ${d ? `<div class="gp-end-daily ${d.win ? 'win' : ''}">📅 ${d.win ? t(`האתגר היומי הושלם! +${d.reward} מטבעות · רצף ${d.streak} ימים 🔥`, `Daily challenge complete! +${d.reward} coins · ${d.streak}-day streak 🔥`) : t(`האתגר היומי: צריך ${d.target.toLocaleString()} נקודות — נסו שוב!`, `Daily challenge: you need ${d.target.toLocaleString()} points — try again!`)}</div>` : ''}
        </div>`;
    }
    function onEnd(S, api, def) {
        const P = S.plus; if (!P) return;
        const w = wallet();
        if (P.xpBonus) awardXp(Math.round(S.score / 40 * P.xpBonus));
        const stars = (S.missions || []).filter(m => m.done).length;
        P.coins += stars * 5;
        if (def && def.daily) {
            const d = def.daily;
            const info = dailyInfo();
            const win = S.score >= d.target && !info.done;
            if (win) {
                w.daily.streak = info.streak + 1; w.daily.last = d.key;
                w.daily.total = (w.daily.total || 0) + 1;
                P.coins += info.reward;
            }
            S.plusDaily = { win, target: d.target, reward: info.reward, streak: w.daily.streak || 0, already: info.done };
        }
        w.coins += P.coins;
        const st = w.stats;
        st.coinsEarned = (st.coinsEarned || 0) + P.coins;
        st.events = (st.events || 0) + P.eventsWon;
        st.bounty = (st.bounty || 0) + P.bountyHits;
        st.perks = (st.perks || 0) + P.perksList.length;
        st.runs = (st.runs || 0) + 1;
        scheduleSaveData();
    }

    // ---------- make a "+" version of an existing game ----------
    function plusVersion(base, o) {
        const def = Object.assign({}, base, {
            id: base.id + 'Plus', plusBase: base.id, plus: true,
            theme: (base.theme || '') + ' g3-plus',
            title: () => base.title() + ' ⁺',
            desc: o.desc,
            trains: o.trains || base.trains,
            startBanner: (cfg) => (base.startBanner ? base.startBanner(cfg) : base.title()) + ' ⁺',
            startSub: (cfg) => (base.startSub ? base.startSub(cfg) + ' · ' : '') + t('🎯 אותיות מטרה = בונוס', '🎯 target letters = bonus'),
            menuExtra: (cfg) => menuHtml() + (base.menuExtra ? base.menuExtra(cfg) : ''),
            endExtra: (S, api) => endHtml(S) + (base.endExtra ? base.endExtra(S, api) : ''),
            onEnd: (S, api) => { if (base.onEnd) base.onEnd(S, api); onEnd(S, api, api && api.def ? api.def : def); },
            create: (api) => run(base, api, o)
        });
        return def;
    }
    // a brand-new game built on this layer
    function newGame(def, o) {
        return Object.assign(def, {
            plus: true,
            menuExtra: (cfg) => menuHtml() + (def._menuExtra ? def._menuExtra(cfg) : ''),
            endExtra: (S, api) => endHtml(S) + (def._endExtra ? def._endExtra(S, api) : ''),
            onEnd: (S, api) => { if (def._onEnd) def._onEnd(S, api); onEnd(S, api, api && api.def ? api.def : def); },
            create: (api) => run({ create: def._create }, api, o)
        });
    }
    function menuHtml() {
        const w = wallet();
        const nx = Object.entries(w.next).filter(([, n]) => n > 0);
        return `<div class="gp-menu-strip"><span>🪙 <b>${w.coins.toLocaleString()}</b></span>
            <span>${t('בכל שלב: בוחרים שדרוג · 🎯 אותיות מטרה · 👹 אתגרים ובוסים', 'Every level: pick a perk · 🎯 target letters · 👹 challenges and bosses')}</span>
            ${nx.length ? `<span class="gp-armed">${t('מאיצים מוכנים', 'Boosters ready')}: ${nx.map(([k, n]) => (BOOSTERS.find(b => b.id === k) || {}).icon + (n > 1 ? '×' + n : '')).join(' ')}</span>` : ''}</div>`;
    }

    // ---------- lobby widgets (games screen) ----------
    function lobbyHtml() {
        const w = wallet(), d = dailyInfo();
        return `<div class="gp-lobby">
            <div class="gp-wallet"><div class="gp-wallet-coins">🪙 <b>${w.coins.toLocaleString()}</b><small>${t('מטבעות', 'coins')}</small></div>
                <button class="btn" id="gpShopBtn">🛒 ${t('חנות מאיצים', 'Booster shop')}</button></div>
            ${d.def ? `<div class="gp-daily ${d.done ? 'done' : ''}"><div class="gp-daily-icon">📅</div><div class="gp-daily-body">
                <b>${t('האתגר היומי', 'Daily challenge')}: ${d.def.icon} ${d.def.title()}</b>
                <span>${d.mod.icon} ${t(d.mod.he, d.mod.en)} · ${t('יעד', 'Goal')}: <b>${d.target.toLocaleString()}</b> ${t('נק׳', 'pts')}</span>
                <small>${d.done ? '✔ ' + t('הושלם היום! חזרו מחר', 'Done today! Come back tomorrow') : `${t('פרס', 'Reward')}: 🪙 ${d.reward}`}${d.streak ? ` · 🔥 ${t('רצף', 'streak')} ${d.streak}` : ''}</small></div>
                <button class="btn ${d.done ? '' : 'primary'}" id="gpDailyBtn">▶ ${d.done ? t('לשחק שוב', 'Play again') : t('לאתגר', 'Take it on')}</button></div>` : ''}
        </div>`;
    }
    function bindLobby(container) {
        const s = container.querySelector('#gpShopBtn'); if (s) s.onclick = () => openShop(container);
        const d = container.querySelector('#gpDailyBtn'); if (d) d.onclick = () => startDaily(container);
    }
    function openShop(container) {
        const w = wallet();
        const ov = document.createElement('div');
        ov.className = 'gp-shop-ov';
        const draw = () => {
            ov.innerHTML = `<div class="gp-shop"><h2>🛒 ${t('חנות המאיצים', 'Booster shop')}</h2>
                <p>${t('מאיץ שקונים נכנס לפעולה במשחק הבא של "הדור החדש". מרוויחים מטבעות מכל מילה, מאותיות המטרה, ממשימות ומאתגרים.', 'A booster you buy kicks in at your next new-generation game. Earn coins from every word, target letters, missions and challenges.')}</p>
                <div class="gp-shop-coins">🪙 <b>${w.coins.toLocaleString()}</b></div>
                <div class="gp-shop-grid">${BOOSTERS.map(b => `<div class="gp-shop-item"><div class="gp-shop-icon">${b.icon}</div><b>${t(b.he, b.en)}</b><span>${t(b.dh, b.de)}</span>
                    ${w.next[b.id] ? `<small class="gp-owned">${t('מוכן', 'Ready')} ×${w.next[b.id]}</small>` : ''}
                    <button class="btn ${w.coins >= b.price ? 'primary' : ''}" data-b="${b.id}" ${w.coins >= b.price ? '' : 'disabled'}>🪙 ${b.price}</button></div>`).join('')}</div>
                <div class="gp-shop-stats">${t('סה״כ הרווחתם', 'Total earned')}: 🪙 ${(w.stats.coinsEarned || 0).toLocaleString()} · ${t('אתגרים שנוצחו', 'Challenges won')}: ${w.stats.events || 0} · 🎯 ${(w.stats.bounty || 0).toLocaleString()}</div>
                <button class="btn" id="gpShopClose">${t('סגירה', 'Close')} (Esc)</button></div>`;
            ov.querySelectorAll('[data-b]').forEach(btn => btn.onclick = () => { if (buy(btn.dataset.b)) { playSound('achievement'); draw(); refresh(); } });
            ov.querySelector('#gpShopClose').onclick = close;
        };
        const refresh = () => { const c = container.querySelector('.gp-wallet-coins b'); if (c) c.textContent = wallet().coins.toLocaleString(); };
        const esc = (e) => { if (e.key === 'Escape') { e.preventDefault(); close(); } };
        const close = () => { ov.remove(); document.removeEventListener('keydown', esc, true); renderGamesScreen(container); };
        ov.addEventListener('click', (e) => { if (e.target === ov) close(); });
        document.addEventListener('keydown', esc, true);
        draw();
        container.appendChild(ov);
    }

    return { run, plusVersion, newGame, wallet, coins, lobbyHtml, bindLobby, openShop, startDaily, dailyInfo, BOOSTERS, PERKS, pickBounty, vocabulary, biasedSource };
})();

// Look up any new-generation game definition by id (defined lazily: files load in order).
function plusGameDef(id) {
    try {
        const m = {
            galaxyPlus: typeof GALAXY_PLUS_DEF !== 'undefined' ? GALAXY_PLUS_DEF : null,
            sefarimPlus: typeof SEFARIM_PLUS_DEF !== 'undefined' ? SEFARIM_PLUS_DEF : null,
            racePlus: typeof RACE_PLUS_DEF !== 'undefined' ? RACE_PLUS_DEF : null,
            arenaPlus: typeof ARENA_PLUS_DEF !== 'undefined' ? ARENA_PLUS_DEF : null,
            towerPlus: typeof TOWER_PLUS_DEF !== 'undefined' ? TOWER_PLUS_DEF : null,
            runner: typeof RUNNER_DEF !== 'undefined' ? RUNNER_DEF : null,
            rhythm: typeof RHYTHM_DEF !== 'undefined' ? RHYTHM_DEF : null,
            fortress: typeof FORTRESS_DEF !== 'undefined' ? FORTRESS_DEF : null
        };
        return m[id] || null;
    } catch (e) { return null; }
}
