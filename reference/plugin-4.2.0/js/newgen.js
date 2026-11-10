// ---- 4.2: games screen — the "new generation" section (shown above the classic games) ----
function newGenGamesHtml() {
    if (typeof PLUS === 'undefined') return '';
    const g = appData.progress.games || {};
    const st = G3D.store().stats;
    const card = (id, cls, art, title, text, trains, best) => `
        <div class="game3d-card gp-card3 ${cls}" data-g3n="${id}">
            <div class="g3c-art gpc-art">${art}<span class="g3c-badge">${t('דור חדש', 'NEW GEN')}</span></div>
            <div class="g3c-body"><h3>${title}</h3><p>${text}</p>
            <div class="g3c-trains">🎯 ${trains}</div>
            <div class="game-best">🏆 ${t('שיא', 'Best')}: ${(best || 0).toLocaleString()}</div>
            <button class="btn primary big">▶ ${t('לשחק', 'Play')}</button></div>
        </div>`;
    const plusCard = (id, base, icon, cls) => {
        const def = plusGameDef(id); if (!def) return '';
        return `<div class="gp-pluscard ${cls}" data-g3n="${id}"><span class="gp-pc-icon">${icon}</span><div><b>${def.title()}</b><small>${t('שיא', 'Best')}: ${(g[id + 'Best'] || 0).toLocaleString()}</small></div><button class="btn primary">▶</button></div>`;
    };
    return `<div class="gp-section">
        <div class="gp-section-head"><h3>✨ ${t('דור חדש של משחקים', 'A new generation of games')}</h3>
        <p>${t('בכל משחק: בוחרים שדרוג אחרי כל שלב בהקלדת האות שעל הכרטיס · 🎯 אותיות מטרה מתוך החולשות שלכם שוות בונוס · 👹 בוסים ואתגרים · 🪙 מטבעות לחנות ואתגר יומי.', 'In every game: pick an upgrade after each level by typing the letter on its card · 🎯 target letters from your weak spots pay a bonus · 👹 bosses and challenges · 🪙 coins for the shop and a daily challenge.')}</p></div>
        ${PLUS.lobbyHtml()}
        <div class="games3d-grid">
            ${card('runner', 'gpc-runner', '<span class="gpc-lane l1">ש</span><span class="gpc-lane l2">ל</span><span class="gpc-lane l3">ח</span><span class="gpc-hero">🏃</span>', t('ריצת האותיות', 'Letter Dash'), t('ריצה בשלושה מסלולים: הקלידו את האות של המסלול הפתוח, נפצו קירות מילים ובחרו את שורת האוצר העשירה.', 'A three-lane run: type the open lane\'s letter, smash word walls and pick the richest treasure lane.'), t('זיהוי אות מיידי וזמן תגובה', 'Instant letter recognition & reaction'), g.runnerBest)}
            ${card('rhythm', 'gpc-rhythm', '<span class="gpc-notes"><i>כ</i><i>י</i><i>ל</i><i>ח</i></span><span class="gpc-beat">🎵</span>', t('קצב המקלדת', 'Key Rhythm'), t('תווים יורדים במסלול של כל אצבע ומגיעים לקו על הפעמה. מושלם / מצוין / טוב — והקצב עולה בכל שלב.', 'Notes slide down each finger\'s lane and hit the line on the beat. Perfect / Great / Good — and the tempo rises every level.'), t('קצב אחיד ואצבע נכונה לכל מקש', 'Even rhythm & the right finger for each key'), g.rhythmBest)}
            ${card('fortress', 'gpc-fort', '<span class="gpc-castle">🏰</span><span class="gpc-mon m1">👾</span><span class="gpc-mon m2">🐲</span><span class="gpc-arrow">➶</span>', t('מבצר המילים', 'Fortress of Words'), t('הגנו על הטירה ממפלצות נושאות מילים, ובנו בין הגלים מגדלי קרח, אש ובנאים בהקלדת מילים.', 'Defend the castle from word-carrying monsters, and between waves build frost, fire and mason towers by typing words.'), t('מילים שלמות בלחץ ובחירת מטרות', 'Whole words under pressure & choosing targets'), g.fortressBest)}
            <div class="game3d-card gp-card3 gpc-storm" data-storm="1">
                <div class="g3c-art gpc-art"><span class="gpc-cloud">⛈️</span><span class="gpc-drop d1">מ</span><span class="gpc-drop d2">שלום</span><span class="gpc-drop d3">⭐</span><span class="g3c-badge">2D · ${t('דור חדש', 'NEW GEN')}</span></div>
                <div class="g3c-body"><h3>${t('סערת המילים', 'Word Storm')}</h3><p>${t('הגרסה החדשה של גשם האותיות ומטר המילים: טיפות כוח (⭐ ❄️ 💣 ☂️ ❤️), סערת־על, ענן רעם בוס ואותיות מטרה. עובד בכל מחשב.', 'The new version of Letter Rain and Word Rain: power drops (⭐ ❄️ 💣 ☂️ ❤️), storm surge, a thunder-cloud boss and target letters. Works on any computer.')}</p>
                <div class="game-best">🏆 ${t('שיא', 'Best')}: ${(g.stormBest || 0).toLocaleString()}</div>
                <div class="gp-storm-btns"><button class="btn primary" data-sm="letters">🔤 ${t('אותיות', 'Letters')}</button><button class="btn primary" data-sm="words">🌧️ ${t('מילים', 'Words')}</button><button class="btn" data-sm="mixed">🌀 ${t('מעורב', 'Mixed')}</button></div></div>
            </div>
        </div>
        <h4 class="gp-sub">⁺ ${t('גרסאות חדשות למשחקי התלת־ממד — אותו עולם, חוקים חדשים', 'New versions of the 3D games — same worlds, new rules')}</h4>
        <div class="gp-plusgrid">
            ${plusCard('galaxyPlus', 'galaxy', '🚀', 'pc-space')}${plusCard('towerPlus', 'tower', '🏗️', 'pc-tower')}${plusCard('arenaPlus', 'arena', '🔨', 'pc-arena')}${plusCard('racePlus', 'race', '🏎️', 'pc-race')}${plusCard('sefarimPlus', 'sefarim', '📚', 'pc-hall')}
        </div>
    </div>
    <h3 class="gp-classic">🕹️ ${t('המשחקים הקלאסיים', 'Classic games')}</h3>`;
}
function bindNewGenGames(container) {
    if (typeof PLUS === 'undefined') return;
    PLUS.bindLobby(container);
    container.querySelectorAll('[data-g3n]').forEach(el => {
        const open = (e) => { if (e) e.stopPropagation(); const def = plusGameDef(el.dataset.g3n); if (def) G3D.openMenu(container, def); };
        const b = el.querySelector('button'); if (b) b.addEventListener('click', open);
        const art = el.querySelector('.g3c-art'); if (art) art.addEventListener('click', open);
        if (el.classList.contains('gp-pluscard')) el.addEventListener('click', open);
    });
    container.querySelectorAll('[data-sm]').forEach(b => b.addEventListener('click', () => startWordStorm(container, b.dataset.sm)));
    const art = container.querySelector('.gpc-storm .g3c-art'); if (art) art.addEventListener('click', () => startWordStorm(container, 'mixed'));
}
