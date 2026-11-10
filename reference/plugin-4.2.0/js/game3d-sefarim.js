// ---- 3.2: "Hall of Sefarim" (היכל הספרים) — 3D Torah-learning typing game ----
// A warm library hall with arched windows, light beams, bookcases and candles.
// Sefarim drift down from above; type a sefer's name to catch it — it flies onto
// your shelf. Categories: Chumash, Nach, Parshiyot, the six Sedarim, Masechtot,
// Alef-Bet (with gematria), letter names and words from the world of learning.
// "In order" mode: type what comes next in the sequence (e.g. the parsha after
// Vayera). Completing a whole category = a Siyum celebration. Lives are candles.

const TORAH_DATA = (function () {
    const chumash = ['בראשית', 'שמות', 'ויקרא', 'במדבר', 'דברים'];
    const parshiyot = [
        ['בראשית', ['בראשית', 'נח', 'לך לך', 'וירא', 'חיי שרה', 'תולדות', 'ויצא', 'וישלח', 'וישב', 'מקץ', 'ויגש', 'ויחי']],
        ['שמות', ['שמות', 'וארא', 'בא', 'בשלח', 'יתרו', 'משפטים', 'תרומה', 'תצוה', 'כי תשא', 'ויקהל', 'פקודי']],
        ['ויקרא', ['ויקרא', 'צו', 'שמיני', 'תזריע', 'מצורע', 'אחרי מות', 'קדושים', 'אמור', 'בהר', 'בחקתי']],
        ['במדבר', ['במדבר', 'נשא', 'בהעלתך', 'שלח', 'קרח', 'חקת', 'בלק', 'פינחס', 'מטות', 'מסעי']],
        ['דברים', ['דברים', 'ואתחנן', 'עקב', 'ראה', 'שופטים', 'כי תצא', 'כי תבוא', 'נצבים', 'וילך', 'האזינו', 'וזאת הברכה']]
    ];
    const neviim = ['יהושע', 'שופטים', 'שמואל', 'מלכים', 'ישעיהו', 'ירמיהו', 'יחזקאל', 'הושע', 'יואל', 'עמוס', 'עובדיה', 'יונה', 'מיכה', 'נחום', 'חבקוק', 'צפניה', 'חגי', 'זכריה', 'מלאכי'];
    const ketuvim = ['תהלים', 'משלי', 'איוב', 'שיר השירים', 'רות', 'איכה', 'קהלת', 'אסתר', 'דניאל', 'עזרא', 'נחמיה', 'דברי הימים'];
    const sedarim = [
        ['זרעים', ['ברכות', 'פאה', 'דמאי', 'כלאים', 'שביעית', 'תרומות', 'מעשרות', 'מעשר שני', 'חלה', 'ערלה', 'ביכורים']],
        ['מועד', ['שבת', 'עירובין', 'פסחים', 'שקלים', 'יומא', 'סוכה', 'ביצה', 'ראש השנה', 'תענית', 'מגילה', 'מועד קטן', 'חגיגה']],
        ['נשים', ['יבמות', 'כתובות', 'נדרים', 'נזיר', 'סוטה', 'גיטין', 'קידושין']],
        ['נזיקין', ['בבא קמא', 'בבא מציעא', 'בבא בתרא', 'סנהדרין', 'מכות', 'שבועות', 'עדיות', 'עבודה זרה', 'אבות', 'הוריות']],
        ['קדשים', ['זבחים', 'מנחות', 'חולין', 'בכורות', 'ערכין', 'תמורה', 'כריתות', 'מעילה', 'תמיד', 'מדות', 'קינים']],
        ['טהרות', ['כלים', 'אהלות', 'נגעים', 'פרה', 'טהרות', 'מקואות', 'נדה', 'מכשירין', 'זבים', 'טבול יום', 'ידים', 'עוקצין']]
    ];
    const letters = 'אבגדהוזחטיכלמנסעפצקרשת'.split('');
    const letterNames = ['אלף', 'בית', 'גימל', 'דלת', 'הא', 'וו', 'זין', 'חית', 'טית', 'יוד', 'כף', 'למד', 'מם', 'נון', 'סמך', 'עין', 'פא', 'צדי', 'קוף', 'ריש', 'שין', 'תיו'];
    const gematria = [1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 20, 30, 40, 50, 60, 70, 80, 90, 100, 200, 300, 400];
    const learning = ['בית מדרש', 'חברותא', 'גמרא', 'משנה', 'סוגיא', 'קושיא', 'תירוץ', 'פירוש', 'שיעור', 'סיום', 'חזרה', 'עיון', 'בקיאות', 'ספר', 'דף', 'עמוד', 'פרק', 'הלכה', 'מדרש', 'תלמיד', 'ישיבה', 'ספריה', 'מפרשים', 'סברא', 'מחלוקת', 'ראיה', 'משנה ברורה', 'שולחן ערוך', 'לימוד', 'שקידה'];
    const cats = {};
    cats.chumash = { he: 'חמישה חומשי תורה', en: 'The Five Books (Chumash)', icon: '📜', ordered: true,
        items: chumash.map((w, i) => ({ w, info: [`ספר ${w}`, `חומש ${i + 1} מתוך 5`], infoEn: [`Sefer ${w}`, `Book ${i + 1} of 5`] })) };
    let pn = 0;
    cats.parshiyot = { he: 'פרשיות השבוע', en: 'Weekly Parshiyot', icon: '📖', ordered: true, items: [] };
    parshiyot.forEach(([book, list]) => list.forEach(w => { pn++; cats.parshiyot.items.push({ w, info: [`פרשת ${w}`, `פרשה ${pn} מתוך 54 · ספר ${book}`], infoEn: [`Parshat ${w}`, `Parsha ${pn} of 54 · Sefer ${book}`] }); }));
    cats.nach = { he: 'נביאים וכתובים', en: 'Nevi\'im & Ketuvim', icon: '📚', ordered: false,
        items: neviim.map(w => ({ w, info: [`ספר ${w}`, 'נביאים'], infoEn: [`Sefer ${w}`, 'Nevi\'im'] })).concat(ketuvim.map(w => ({ w, info: [`ספר ${w}`, 'כתובים'], infoEn: [`Sefer ${w}`, 'Ketuvim'] }))) };
    cats.sedarim = { he: 'שישה סדרי משנה', en: 'The Six Orders of Mishna', icon: '🏛️', ordered: true,
        items: sedarim.map(([s, l], i) => ({ w: s, info: [`סדר ${s}`, `סדר ${i + 1} מתוך 6 · ${l.length} מסכתות`], infoEn: [`Seder ${s}`, `Order ${i + 1} of 6 · ${l.length} tractates`] })) };
    let mn = 0;
    cats.masechtot = { he: 'מסכתות הש״ס', en: 'Tractates (Masechtot)', icon: '📗', ordered: true, items: [] };
    sedarim.forEach(([s, list]) => list.forEach(w => { mn++; cats.masechtot.items.push({ w, info: [`מסכת ${w}`, `סדר ${s} · מסכת ${mn} מתוך 63`], infoEn: [`Masechet ${w}`, `Seder ${s} · tractate ${mn} of 63`] }); }));
    cats.alefbet = { he: 'אותיות האלף־בית', en: 'The Alef-Bet', icon: 'א', ordered: true, beginner: true,
        items: letters.map((w, i) => ({ w, info: [`האות ${letterNames[i]}`, `גימטריה: ${gematria[i]}`], infoEn: [`The letter ${letterNames[i]}`, `Gematria: ${gematria[i]}`] })) };
    cats.letternames = { he: 'שמות האותיות', en: 'Letter names', icon: 'אב', ordered: true,
        items: letterNames.map((w, i) => ({ w, info: [`${w} = ${letters[i]}`, `אות ${i + 1} מתוך 22 · גימטריה ${gematria[i]}`], infoEn: [`${w} = ${letters[i]}`, `Letter ${i + 1} of 22 · gematria ${gematria[i]}`] })) };
    cats.learning = { he: 'מעולם הלימוד', en: 'The world of learning', icon: '🕯️', ordered: false,
        items: learning.map(w => ({ w, info: [w, 'מעולם הלימוד'], infoEn: [w, 'From the world of learning'] })) };
    cats.mixed = { he: 'הכל מעורב', en: 'Everything mixed', icon: '✨', ordered: false,
        items: [].concat(cats.chumash.items, cats.parshiyot.items, cats.nach.items, cats.sedarim.items, cats.masechtot.items, cats.learning.items) };
    return cats;
})();
const TORAH_CAT_ORDER = ['alefbet', 'letternames', 'chumash', 'parshiyot', 'nach', 'sedarim', 'masechtot', 'learning', 'mixed'];
function torahCatName(id) { const c = TORAH_DATA[id]; return c ? t(c.he, c.en) : id; }
function torahCollection(id) { const col = G3D.store().collection; if (!Array.isArray(col[id])) col[id] = []; return col[id]; }

const SEFARIM_DEF = {
    id: 'sefarim', icon: '📚', theme: 'g3-hall', music: 'hall',
    lifeIcon: '🕯️', lifeIconOff: '<span style="filter:grayscale(1);opacity:.4">🕯️</span>',
    title: () => t('היכל הספרים', 'Hall of Sefarim'),
    desc: () => t('ספרים יורדים מלמעלה בהיכל מואר בנרות. הקלידו את שם הספר כדי לתפוס אותו ולהעמיד אותו על המדף שלכם — לפני שהוא נוגע ברצפה. חמשה חומשי תורה, פרשיות, נ״ך, סדרי משנה, מסכתות, אותיות וגימטריה. במצב "לפי הסדר" מקלידים את מה שבא אחרי. השלמת קטגוריה שלמה = סיום! 🎉', 'Sefarim descend in a candle-lit hall. Type a sefer\'s name to catch it and place it on your shelf — before it reaches the floor. Chumash, parshiyot, Nach, the six orders, tractates, letters and gematria. In "In order" mode, type what comes next. Completing a whole category = a Siyum! 🎉'),
    defaults: { category: 'chumash', play: 'free', info: true },
    options: () => [
        { key: 'category', label: t('קטגוריה', 'Category'), choices: TORAH_CAT_ORDER.map(id => [id, (TORAH_DATA[id].icon || '') + ' ' + torahCatName(id)]) },
        { key: 'play', label: t('סוג משחק', 'Play style'), choices: [['free', t('חופשי — תפסו כל ספר', 'Free — catch every sefer')], ['sequence', t('לפי הסדר — מה בא אחרי?', 'In order — what comes next?')]] },
        { key: 'info', label: t('הצג כרטיס מידע על כל ספר', 'Show an info card for each sefer'), toggle: true }
    ],
    menuExtra: () => `<div class="g3-panel g3-collection"><h3>📚 ${t('האוסף שלי', 'My collection')}</h3><div class="g3-colgrid">${TORAH_CAT_ORDER.filter(id => id !== 'mixed').map(id => {
        const c = TORAH_DATA[id], have = torahCollection(id).length, n = c.items.length, pct = Math.round(have / n * 100);
        return `<div class="g3-col ${pct >= 100 ? 'done' : ''}"><div class="g3-col-top"><span>${c.icon} ${torahCatName(id)}</span><b>${have}/${n}${pct >= 100 ? ' ✓' : ''}</b></div><div class="g3-col-bar"><span style="width:${pct}%"></span></div></div>`;
    }).join('')}</div><p class="empty-note">${t('השלימו את כל הפריטים בקטגוריה כדי לחגוג סיום.', 'Collect every item in a category to celebrate a Siyum.')} ${t('מצב "לפי הסדר" זמין לקטגוריות שיש להן סדר (חומשים, פרשיות, סדרים, מסכתות, אותיות).', '"In order" mode works for ordered categories (Chumash, parshiyot, orders, tractates, letters).')}</p></div>`,
    startBanner: (cfg) => `${TORAH_DATA[cfg.category] ? TORAH_DATA[cfg.category].icon : '📚'} ${torahCatName(cfg.category)}`,
    startSub: (cfg) => cfg.play === 'sequence' && TORAH_DATA[cfg.category].ordered ? t('הקלידו את מה שבא אחרי לפי הסדר', 'Type what comes next, in order') : t('הקלידו את שם הספר כדי לתפוס אותו', 'Type a sefer\'s name to catch it'),
    wordsLabel: () => t('ספרים', 'Sefarim'),
    endExtra: (S) => `<p class="g3-endnote">📚 ${t('נוספו לאוסף', 'Added to collection')}: <b>${S.sefNew || 0}</b>${S.sefSiyum ? ` · 🎉 ${t('סיום!', 'Siyum!')}` : ''}</p>`,
    onEnd: (S) => { const st = G3D.store().stats; st.sefarimCaught = (st.sefarimCaught || 0) + (S.words || 0); },
    create: (api) => createSefarim(api)
};

function createSefarim(api) {
    const T = api.THREE, scene = api.scene, camera = api.camera, cfg = api.cfg, D = api.D, P = api.particles, q = api.Q.mult;
    const cat = TORAH_DATA[cfg.category] || TORAH_DATA.chumash;
    const seqMode = cfg.play === 'sequence' && cat.ordered;
    const collection = torahCollection(cfg.category);
    const stats = { newItems: 0, siyum: false };

    scene.background = new T.Color(0x140d08);
    scene.fog = new T.Fog(0x140d08, 24, 62);
    camera.fov = 55; camera.position.set(0, 5.4, 15); camera.lookAt(0, 4.3, -2); camera.updateProjectionMatrix();
    api.setCameraBase(camera.position);

    // ---- light ----
    scene.add(new T.HemisphereLight(0xffe6c0, 0x2a1a0e, 0.55));
    scene.add(new T.AmbientLight(0x6a4a30, 0.25));
    const sunL = new T.DirectionalLight(0xffd29a, 1.25);
    sunL.position.set(5, 16, -12); sunL.target.position.set(0, 0, 3); scene.add(sunL); scene.add(sunL.target);
    if (api.Q.shadows) {
        sunL.castShadow = true; sunL.shadow.mapSize.set(1024, 1024);
        Object.assign(sunL.shadow.camera, { left: -14, right: 14, top: 14, bottom: -6, near: 1, far: 50 });
        sunL.shadow.bias = -0.0015;
    }
    const chandLights = [new T.PointLight(0xffb060, 1.3, 32, 1.6), new T.PointLight(0xffb060, 1.0, 28, 1.6)];
    chandLights[0].position.set(-6, 10.5, 0); chandLights[1].position.set(6, 10.5, 0);
    chandLights.forEach(l => scene.add(l));

    // ---- textures ----
    const woodTex = G3D.canvasTexture(512, 512, (ctx, w, h) => {
        const planks = 6, ph = h / planks;
        for (let i = 0; i < planks; i++) {
            const base = 70 + Math.random() * 30;
            ctx.fillStyle = `rgb(${base + 40 | 0},${base + 10 | 0},${base * 0.45 | 0})`; ctx.fillRect(0, i * ph, w, ph);
            for (let k = 0; k < 40; k++) { ctx.strokeStyle = `rgba(40,20,5,${Math.random() * 0.25})`; ctx.lineWidth = 1 + Math.random() * 2; ctx.beginPath(); const y = i * ph + Math.random() * ph; ctx.moveTo(0, y); ctx.bezierCurveTo(w * 0.3, y + (Math.random() - 0.5) * 8, w * 0.6, y + (Math.random() - 0.5) * 8, w, y + (Math.random() - 0.5) * 6); ctx.stroke(); }
            ctx.fillStyle = 'rgba(20,10,2,0.8)'; ctx.fillRect(0, i * ph, w, 3);
            ctx.fillRect((Math.random() * w) | 0, i * ph, 3, ph);
        }
    }, [7, 7]);
    const stoneTex = G3D.canvasTexture(512, 512, (ctx, w, h) => {
        ctx.fillStyle = '#b9a07a'; ctx.fillRect(0, 0, w, h);
        const rows = 8, rh = h / rows;
        for (let r = 0; r < rows; r++) {
            const off = (r % 2) * 64;
            for (let x = -off; x < w; x += 128) {
                const l = 170 + Math.random() * 40;
                ctx.fillStyle = `rgb(${l | 0},${(l * 0.86) | 0},${(l * 0.66) | 0})`;
                ctx.fillRect(x + 3, r * rh + 3, 122, rh - 6);
                for (let k = 0; k < 30; k++) { ctx.fillStyle = `rgba(90,70,40,${Math.random() * 0.12})`; ctx.fillRect(x + Math.random() * 120, r * rh + Math.random() * rh, 2 + Math.random() * 6, 2 + Math.random() * 4); }
            }
        }
    }, [5, 2.5]);

    // ---- room ----
    const floor = new T.Mesh(new T.PlaneGeometry(80, 80), new T.MeshStandardMaterial({ map: woodTex, roughness: 0.65, metalness: 0.05 }));
    floor.rotation.x = -Math.PI / 2; floor.receiveShadow = true; scene.add(floor);
    const wall = new T.Mesh(new T.PlaneGeometry(60, 32), new T.MeshStandardMaterial({ map: stoneTex, roughness: 0.95 }));
    wall.position.set(0, 16, -14); wall.receiveShadow = true; scene.add(wall);
    const sideWallMat = new T.MeshStandardMaterial({ map: stoneTex, roughness: 0.95, color: 0xcfb894 });
    [-1, 1].forEach(s => { const sw = new T.Mesh(new T.PlaneGeometry(40, 32), sideWallMat); sw.position.set(s * 16, 16, 4); sw.rotation.y = -s * Math.PI / 2; scene.add(sw); });

    // arched windows with light beams
    const archShape = new T.Shape();
    archShape.moveTo(-1.6, 0); archShape.lineTo(1.6, 0); archShape.lineTo(1.6, 3.6); archShape.absarc(0, 3.6, 1.6, 0, Math.PI, false); archShape.lineTo(-1.6, 0);
    const winGeo = new T.ShapeGeometry(archShape, 24);
    const winMat = new T.MeshBasicMaterial({ color: 0xffe6b0, fog: false });
    const frameMat = new T.MeshStandardMaterial({ color: 0x3b2614, roughness: 0.7 });
    const beamTex = G3D.canvasTexture(64, 256, (ctx, w, h) => { const g = ctx.createLinearGradient(0, 0, 0, h); g.addColorStop(0, 'rgba(255,225,160,0.9)'); g.addColorStop(1, 'rgba(255,200,120,0)'); ctx.fillStyle = g; ctx.fillRect(0, 0, w, h); const g2 = ctx.createLinearGradient(0, 0, w, 0); g2.addColorStop(0, 'rgba(0,0,0,1)'); g2.addColorStop(0.5, 'rgba(0,0,0,0)'); g2.addColorStop(1, 'rgba(0,0,0,1)'); ctx.globalCompositeOperation = 'destination-out'; ctx.fillStyle = g2; ctx.fillRect(0, 0, w, h); });
    const beams = [];
    [-9, 0, 9].forEach(x => {
        const win = new T.Mesh(winGeo, winMat); win.position.set(x, 8.2, -13.9); scene.add(win);
        const mv = new T.Mesh(new T.BoxGeometry(0.14, 5.3, 0.1), frameMat); mv.position.set(x, 10.8, -13.85); scene.add(mv);
        const mh = new T.Mesh(new T.BoxGeometry(3.3, 0.14, 0.1), frameMat); mh.position.set(x, 10.2, -13.85); scene.add(mh);
        const sill = new T.Mesh(new T.BoxGeometry(3.8, 0.3, 0.6), frameMat); sill.position.set(x, 8.05, -13.7); scene.add(sill);
        for (let k = 0; k < 2; k++) {
            const b = new T.Mesh(new T.PlaneGeometry(3.2 + k * 1.5, 22), new T.MeshBasicMaterial({ map: beamTex, transparent: true, opacity: 0.16, blending: T.AdditiveBlending, depthWrite: false, side: T.DoubleSide, fog: false }));
            b.position.set(x - 2 - k * 0.6, 5.5, -7.5 + k);
            b.rotation.set(-0.15, k * 0.25, 0.42);
            scene.add(b); beams.push(b);
        }
    });

    // bookcases along the side walls (instanced books)
    const shelfMat = new T.MeshStandardMaterial({ color: 0x3a2412, roughness: 0.6 });
    const bookColors = [0x6b1d1d, 0x1d2b4f, 0x1f3d2b, 0x4a2c17, 0x1c1714, 0x5a1a33, 0x7a5a20, 0x2e2e46].map(c => new T.Color(c));
    const instCount = Math.round(560 * Math.max(0.5, q));
    const bookInst = new T.InstancedMesh(new T.BoxGeometry(1, 1, 1), new T.MeshStandardMaterial({ roughness: 0.75 }), instCount);
    const bandInst = new T.InstancedMesh(new T.BoxGeometry(1, 1, 1), new T.MeshStandardMaterial({ color: 0xd4a840, metalness: 0.8, roughness: 0.35, emissive: 0x3a2a00 }), instCount * 2);
    const m4 = new T.Matrix4(), qq = new T.Quaternion(), sc = new T.Vector3(), ps = new T.Vector3();
    let bi = 0, bandI = 0;
    [-1, 1].forEach(side => {
        const xWall = side * 15.3;
        const back = new T.Mesh(new T.BoxGeometry(0.3, 12, 22), shelfMat); back.position.set(xWall + side * 0.4, 6, -2); scene.add(back);
        for (let s = 0; s < 6; s++) {
            const y = 0.4 + s * 2.05;
            const board = new T.Mesh(new T.BoxGeometry(1.5, 0.16, 22), shelfMat); board.position.set(xWall - side * 0.3, y, -2); board.receiveShadow = true; scene.add(board);
            let z = -12.6;
            while (z < 8.6 && bi < instCount) {
                const thick = 0.22 + Math.random() * 0.24, hgt = 1.3 + Math.random() * 0.5, dep = 1.0 + Math.random() * 0.2;
                ps.set(xWall - side * 0.35, y + 0.08 + hgt / 2, z + thick / 2);
                qq.setFromAxisAngle(new T.Vector3(1, 0, 0), Math.random() < 0.06 ? 0.2 : 0);
                sc.set(dep, hgt, thick);
                m4.compose(ps, qq, sc); bookInst.setMatrixAt(bi, m4); bookInst.setColorAt(bi, bookColors[Math.floor(Math.random() * bookColors.length)]);
                [0.25, 0.75].forEach(f => { if (bandI < instCount * 2) { m4.compose(new T.Vector3(ps.x - side * (dep / 2 - 0.01), y + 0.08 + hgt * f, ps.z), qq, new T.Vector3(0.03, 0.05, thick * 0.9)); bandInst.setMatrixAt(bandI++, m4); } });
                bi++; z += thick + 0.02;
            }
        }
        [-1, 1].forEach(e => { const post = new T.Mesh(new T.BoxGeometry(1.6, 12.4, 0.3), shelfMat); post.position.set(xWall - side * 0.3, 6.2, -2 + e * 11); scene.add(post); });
    });
    bookInst.count = bi; bandInst.count = bandI;
    bookInst.instanceMatrix.needsUpdate = true; if (bookInst.instanceColor) bookInst.instanceColor.needsUpdate = true;
    scene.add(bookInst); scene.add(bandInst);

    // chandeliers
    const brass = new T.MeshStandardMaterial({ color: 0xc9a14a, metalness: 0.9, roughness: 0.3 });
    const flameTex = G3D.canvasTexture(64, 128, (ctx, w, h) => {
        const g = ctx.createRadialGradient(w / 2, h * 0.62, 2, w / 2, h * 0.55, w / 2);
        g.addColorStop(0, 'rgba(255,255,230,1)'); g.addColorStop(0.3, 'rgba(255,200,90,0.95)'); g.addColorStop(0.7, 'rgba(255,110,20,0.4)'); g.addColorStop(1, 'rgba(255,80,0,0)');
        ctx.fillStyle = g; ctx.beginPath(); ctx.ellipse(w / 2, h * 0.58, w * 0.45, h * 0.42, 0, 0, Math.PI * 2); ctx.fill();
    });
    const glow = G3D.glowTexture('rgba(255,220,150,0.9)', 'rgba(255,160,60,0.25)');
    const flames = [];
    [-6, 6].forEach(cx => {
        const ring = new T.Mesh(new T.TorusGeometry(1.4, 0.07, 8, 40), brass); ring.rotation.x = Math.PI / 2; ring.position.set(cx, 10.4, 0); scene.add(ring);
        const chain = new T.Mesh(new T.CylinderGeometry(0.03, 0.03, 6, 6), brass); chain.position.set(cx, 13.5, 0); scene.add(chain);
        for (let i = 0; i < 8; i++) {
            const a = i / 8 * Math.PI * 2, x = cx + Math.cos(a) * 1.4, z = Math.sin(a) * 1.4;
            const c = new T.Mesh(new T.CylinderGeometry(0.07, 0.07, 0.45, 8), new T.MeshStandardMaterial({ color: 0xf3e6c8, roughness: 0.6 })); c.position.set(x, 10.65, z); scene.add(c);
            const f = new T.Sprite(new T.SpriteMaterial({ map: flameTex, transparent: true, blending: T.AdditiveBlending, depthWrite: false }));
            f.position.set(x, 11.0, z); f.scale.set(0.22, 0.42, 1); scene.add(f); flames.push(f);
            const h = new T.Sprite(new T.SpriteMaterial({ map: glow, transparent: true, opacity: 0.45, blending: T.AdditiveBlending, depthWrite: false })); h.position.set(x, 11.0, z); h.scale.set(1.2, 1.2, 1); scene.add(h); flames.push(h);
        }
    });

    // shtender (lectern) with an open sefer
    const lect = new T.Group();
    const dark = new T.MeshStandardMaterial({ color: 0x4a2c15, roughness: 0.55, metalness: 0.05 });
    const base = new T.Mesh(new T.BoxGeometry(1.6, 0.15, 1.1), dark); base.position.y = 0.08; lect.add(base);
    const col = new T.Mesh(new T.BoxGeometry(0.3, 2.6, 0.3), dark); col.position.y = 1.4; lect.add(col);
    const top = new T.Mesh(new T.BoxGeometry(2.0, 0.1, 1.4), dark); top.position.set(0, 2.75, 0); top.rotation.x = 0.38; lect.add(top);
    const pageMat = new T.MeshStandardMaterial({ color: 0xf2e6c6, roughness: 0.9 });
    [-1, 1].forEach(s => { const pg = new T.Mesh(new T.BoxGeometry(0.85, 0.06, 1.1), pageMat); pg.position.set(s * 0.45, 2.85, 0); pg.rotation.set(0.38, 0, -s * 0.08); lect.add(pg); });
    lect.position.set(-0.6, 0, 7.0); lect.rotation.y = 0.12; lect.castShadow = true; scene.add(lect);

    // candles = lives (on a low table in front of the lectern)
    const CZ = 6.4, CX = 4.3, CY = 1.6; // candle table (front right, always in view)
    const table = new T.Mesh(new T.BoxGeometry(5.0, 0.18, 1.0), dark); table.position.set(CX, CY - 0.4, CZ); scene.add(table);
    [-1, 1].forEach(s => { const leg = new T.Mesh(new T.BoxGeometry(0.14, CY - 0.4, 0.14), dark); leg.position.set(CX + s * 2.3, (CY - 0.4) / 2, CZ); scene.add(leg); });
    const candleLight = new T.PointLight(0xffa040, 1.6, 9, 1.8); candleLight.position.set(CX, CY + 1, CZ + 0.4); scene.add(candleLight);
    const candles = [];
    const nC = Math.min(7, cfg.lives);
    for (let i = 0; i < nC; i++) {
        const x = CX + (i - (nC - 1) / 2) * 0.62;
        const body = new T.Mesh(new T.CylinderGeometry(0.11, 0.12, 0.7, 12), new T.MeshStandardMaterial({ color: 0xf6ecd2, roughness: 0.5, emissive: 0x2a1a05 }));
        body.position.set(x, CY + 0.05, CZ); scene.add(body);
        const holder = new T.Mesh(new T.CylinderGeometry(0.2, 0.24, 0.08, 14), brass); holder.position.set(x, CY - 0.27, CZ); scene.add(holder);
        const f = new T.Sprite(new T.SpriteMaterial({ map: flameTex, transparent: true, blending: T.AdditiveBlending, depthWrite: false }));
        f.position.set(x, CY + 0.55, CZ); f.scale.set(0.2, 0.38, 1); scene.add(f);
        const h = new T.Sprite(new T.SpriteMaterial({ map: glow, transparent: true, opacity: 0.6, blending: T.AdditiveBlending, depthWrite: false }));
        h.position.set(x, CY + 0.55, CZ); h.scale.set(1.1, 1.1, 1); scene.add(h);
        candles.push({ f, h, lit: true, x });
    }
    let litCount = nC;
    function extinguish() {
        const c = candles.filter(c => c.lit).pop(); if (!c) return;
        c.lit = false; litCount--;
        P.emit(new T.Vector3(c.x, CY + 0.7, CZ), 30, { color: 0x887766, speed: 0.6, size: 0.5, life: 2.2, up: 1.2, drag: 0.3 });
    }
    function relight() {
        const c = candles.find(c => !c.lit); if (!c) return;
        c.lit = true; litCount++;
        P.emit(new T.Vector3(c.x, CY + 0.6, CZ), 20, { color: 0xffcc66, speed: 2, size: 0.4, life: 0.8 });
    }

    // "my shelf" — collected sefarim are placed here
    const myShelf = new T.Group();
    const shelfW = 12.6;
    const shelfBoards = [];
    for (let r = 0; r < 3; r++) {
        const b = new T.Mesh(new T.BoxGeometry(shelfW + 0.6, 0.16, 1.0), new T.MeshStandardMaterial({ color: 0x5a3519, roughness: 0.55, emissive: 0x000000 }));
        b.position.set(0, 0.6 + r * 2.0, 0); b.receiveShadow = true; myShelf.add(b); shelfBoards.push(b);
    }
    [-1, 1].forEach(s => { const side = new T.Mesh(new T.BoxGeometry(0.2, 6.4, 1.0), shelfMat); side.position.set(s * (shelfW / 2 + 0.4), 3.2, 0); myShelf.add(side); });
    const backPanel = new T.Mesh(new T.BoxGeometry(shelfW + 1, 6.4, 0.1), new T.MeshStandardMaterial({ color: 0x2b1a0c, roughness: 0.8 })); backPanel.position.set(0, 3.2, -0.5); myShelf.add(backPanel);
    myShelf.position.set(0, 0, -6.5);
    scene.add(myShelf);
    const shelfLabel = G3D.makeLabel(t('המדף שלי', 'My shelf'), { px: 48, height: 0.55, bg: 'rgba(40,24,10,0.85)', border: '#d4a840', color: '#f3d58a' });
    shelfLabel.sprite.position.set(0, 6.8, -6.3); scene.add(shelfLabel.sprite);
    const SLOTS_PER_ROW = 18;
    const placed = [];

    // dust in the light
    const dustN = Math.round(700 * api.Q.part) + 100;
    const dPos = new Float32Array(dustN * 3);
    for (let i = 0; i < dustN; i++) { dPos[i * 3] = (Math.random() - 0.5) * 26; dPos[i * 3 + 1] = Math.random() * 13; dPos[i * 3 + 2] = -12 + Math.random() * 22; }
    const dustGeo = new T.BufferGeometry(); dustGeo.setAttribute('position', new T.BufferAttribute(dPos, 3));
    const dust = new T.Points(dustGeo, new T.PointsMaterial({ size: 0.09, color: 0xffe2a8, map: G3D.glowTexture(), transparent: true, opacity: 0.6, depthWrite: false, blending: T.AdditiveBlending }));
    scene.add(dust);

    // ---- sefer construction ----
    const leathers = [0x5c1414, 0x16244a, 0x173623, 0x3f2410, 0x161210, 0x4f1430];
    const pagesTex = G3D.canvasTexture(64, 256, (ctx, w, h) => { ctx.fillStyle = '#efe2bf'; ctx.fillRect(0, 0, w, h); for (let x = 0; x < w; x += 2) { ctx.fillStyle = `rgba(150,120,70,${0.1 + Math.random() * 0.15})`; ctx.fillRect(x, 0, 1, h); } });
    function coverTexture(title, leather, typed) {
        const c = new T.Color(leather);
        return G3D.canvasTexture(256, 340, (ctx, w, h) => {
            ctx.fillStyle = `rgb(${c.r * 255 | 0},${c.g * 255 | 0},${c.b * 255 | 0})`; ctx.fillRect(0, 0, w, h);
            for (let k = 0; k < 300; k++) { ctx.fillStyle = `rgba(0,0,0,${Math.random() * 0.12})`; ctx.fillRect(Math.random() * w, Math.random() * h, 2, 2); }
            ctx.strokeStyle = '#d9b250'; ctx.lineWidth = 6; ctx.strokeRect(16, 16, w - 32, h - 32);
            ctx.lineWidth = 2; ctx.strokeRect(28, 28, w - 56, h - 56);
            ctx.fillStyle = '#d9b250';
            [[28, 28], [w - 28, 28], [28, h - 28], [w - 28, h - 28]].forEach(([x, y]) => { ctx.beginPath(); ctx.arc(x, y, 7, 0, Math.PI * 2); ctx.fill(); });
            ctx.font = `bold ${title.length > 6 ? 40 : 54}px 'David','Arial Hebrew',serif`;
            ctx.textAlign = 'center'; ctx.textBaseline = 'middle'; try { ctx.direction = 'rtl'; } catch (e) {}
            ctx.shadowColor = 'rgba(0,0,0,0.6)'; ctx.shadowBlur = 6;
            ctx.fillStyle = '#f2cf6a'; ctx.fillText(title, w / 2, h * 0.46);
            ctx.font = `28px serif`; ctx.fillText('✦', w / 2, h * 0.68);
        });
    }
    function spineTexture(title, leather) {
        const c = new T.Color(leather);
        return G3D.canvasTexture(96, 512, (ctx, w, h) => {
            ctx.fillStyle = `rgb(${c.r * 255 | 0},${c.g * 255 | 0},${c.b * 255 | 0})`; ctx.fillRect(0, 0, w, h);
            ctx.fillStyle = '#d9b250'; [40, 70, h - 70, h - 40].forEach(y => ctx.fillRect(6, y, w - 12, 5));
            ctx.save(); ctx.translate(w / 2, h / 2); ctx.rotate(-Math.PI / 2);
            ctx.font = `bold ${title.length > 6 ? 34 : 44}px 'David','Arial Hebrew',serif`; ctx.textAlign = 'center'; ctx.textBaseline = 'middle'; try { ctx.direction = 'rtl'; } catch (e) {}
            ctx.fillStyle = '#f2cf6a'; ctx.fillText(title, 0, 0); ctx.restore();
        });
    }
    const bookGeo = new T.BoxGeometry(1.5, 2.0, 0.34);

    const books = [];
    let spawnT = 1.0, buffer = '', target = null, levelCount = 0, time = 0;
    const perLevel = 8;
    // sequence mode state
    let seqIdx = 0, roundActive = false, roundQueue = [];

    function pickItem() {
        const items = cat.items;
        const uncollected = items.filter(it => !collection.includes(it.w));
        const onScreen = new Set(books.filter(b => b.alive).map(b => b.item.w));
        let pool = (uncollected.length && Math.random() < 0.7) ? uncollected : items;
        pool = pool.filter(it => !onScreen.has(it.w));
        // avoid two falling books starting with the same letter (keeps targeting unambiguous)
        const firsts = new Set(books.filter(b => b.alive).map(b => b.chars[0]));
        const pool2 = pool.filter(it => !firsts.has(Array.from(it.w)[0]));
        return randomChoice(pool2.length ? pool2 : (pool.length ? pool : items));
    }

    function makeBook(item, opts) {
        opts = opts || {};
        const leather = leathers[Math.floor(Math.random() * leathers.length)];
        const cover = coverTexture(item.w, leather);
        const spine = spineTexture(item.w, leather);
        const lm = new T.MeshStandardMaterial({ color: leather, roughness: 0.6, metalness: 0.05 });
        const mats = [
            new T.MeshStandardMaterial({ map: spine, roughness: 0.55 }), // +x spine
            new T.MeshStandardMaterial({ map: pagesTex, roughness: 0.9 }), // -x page edges
            new T.MeshStandardMaterial({ map: pagesTex, roughness: 0.9 }), // top
            new T.MeshStandardMaterial({ map: pagesTex, roughness: 0.9 }), // bottom
            new T.MeshStandardMaterial({ map: cover, roughness: 0.5, metalness: 0.1 }), // front
            lm // back
        ];
        const mesh = new T.Mesh(bookGeo, mats);
        mesh.castShadow = true;
        const g = new T.Group(); g.add(mesh);
        const label = G3D.makeLabel(item.w, { px: 70, height: 0.95, color: '#fff3d0', typedColor: '#ffd24a', typedGlow: '#ffae00', bg: 'rgba(36,20,8,0.82)', border: '#c9a14a' });
        label.sprite.position.set(0, -1.65, 0.3); g.add(label.sprite); // below the book: readable as soon as it enters the frame
        const x = opts.x !== undefined ? opts.x : (Math.random() - 0.5) * 12.5;
        g.position.set(x, 11.2 + Math.random() * 1.2, -0.8 + Math.random() * 3.2);
        g.rotation.set(0.15, (Math.random() - 0.5) * 0.8, (Math.random() - 0.5) * 0.4);
        scene.add(g);
        const b = { g, mesh, mats, label, item, chars: Array.from(item.w), typed: 0, alive: true, state: 'fall', vy: 0, sway: Math.random() * 6, spinY: (Math.random() - 0.5) * 0.6, decoy: !!opts.decoy, correct: !!opts.correct, t: 0 };
        // 4.1: a rare golden sefer — catch it for triple points and a relit candle
        if (!opts.decoy && !opts.correct && !seqMode && Math.random() < 0.09) {
            b.golden = true;
            mats.forEach(m => { m.emissive = new T.Color(0x7a5200); m.emissiveIntensity = 0.75; m.metalness = 0.6; });
            const glow = new T.Sprite(new T.SpriteMaterial({ map: G3D.glowTexture('rgba(255,240,180,1)', 'rgba(255,190,60,0.55)'), transparent: true, blending: T.AdditiveBlending, depthWrite: false, opacity: 0.85 }));
            glow.scale.set(4.2, 4.2, 1); g.add(glow); b.glow = glow;
            label.setColors({ border: '#ffd24a', bg: 'rgba(70,44,4,0.9)', color: '#fff6c8' });
        }
        books.push(b);
        return b;
    }

    function slotPosition(n) {
        const row = Math.floor(n / SLOTS_PER_ROW) % 3, idx = n % SLOTS_PER_ROW;
        const x = shelfW / 2 - 0.35 - idx * (shelfW / SLOTS_PER_ROW); // fills right-to-left, like a Hebrew bookshelf
        return new T.Vector3(x, 0.6 + row * 2.0 + 0.08 + 0.95 * 0.55, -6.5 + 0.05);
    }

    function catchBook(b) {
        b.state = 'fly'; b.t = 0;
        b.from = b.g.position.clone();
        b.to = slotPosition(placed.length);
        b.ctrl = b.from.clone().lerp(b.to, 0.5).add(new T.Vector3(0, 4.5, 2));
        b.fromRot = b.g.rotation.clone();
        b.mats.forEach(m => { m.emissive = new T.Color(0x6a4a10); m.emissiveIntensity = 0.9; });
        placed.push(b);
        b.label.sprite.visible = false;
        api.audio.sfx('whoosh');
        // collection
        let isNew = false;
        if (!collection.includes(b.item.w)) { collection.push(b.item.w); isNew = true; stats.newItems++; }
        const pts = api.wordDone((14 + b.chars.length * 9 + (isNew ? 20 : 0)) * (b.golden ? 3 : 1), b.g.position.clone(), { cls: b.golden ? 'boss' : 'gold' });
        if (b.golden) {
            stats.golden = (stats.golden || 0) + 1;
            api.audio.sfx('bell'); api.feverBoost(0.25);
            api.banner('✨ ' + t('ספר זהב!', 'Golden sefer!'), t('פי 3 נקודות · נר הודלק', 'Triple points · a candle is relit'), 'power', 1500);
            if (litCount < nC) { relight(); api.heal(1); }
            if (b.glow) b.glow.visible = false;
        }
        P.emit(b.g.position, Math.round(60 * api.Q.part) + 10, { color: 0xffd36b, color2: 0xfff2c0, speed: 6, size: 0.55, life: 1.1, drag: 1.2 });
        if (cfg.info) showInfo(b.item, isNew);
        levelCount++;
        api.setLevelProgress(levelCount / perLevel);
        if (levelCount >= perLevel) { levelCount = 0; api.levelUp(t('📚 המדף מתמלא — הספרים יורדים מהר יותר', '📚 The shelf is filling — sefarim fall faster')); shelfBoards.forEach(sb => { sb.material.emissive.setHex(0x553300); }); setTimeout(() => shelfBoards.forEach(sb => sb.material.emissive.setHex(0)), 900); if (litCount < nC && Math.random() < 0.5) { relight(); api.heal(1); } }
        if (!stats.siyum && cat !== TORAH_DATA.mixed && collection.length >= cat.items.length && !seqMode) celebrateSiyum();
        return pts;
    }

    let infoTimer = null;
    function showInfo(item, isNew) {
        const lines = appSettings.uiLang === 'en' ? item.infoEn : item.info;
        api.hud.extra((seqMode ? seqPromptHtml() : '') + `<div class="g3-info ${isNew ? 'new' : ''}"><b>${lines[0]}</b><span>${lines[1]}</span>${isNew ? `<em>${t('חדש באוסף!', 'New in your collection!')}</em>` : ''}</div>`);
        clearTimeout(infoTimer);
        infoTimer = setTimeout(() => api.hud.extra(seqMode ? seqPromptHtml() : ''), 2600);
    }

    function celebrateSiyum() {
        stats.siyum = true;
        const st = G3D.store().stats; st.siyumCount = (st.siyumCount || 0) + 1;
        api.audio.sfx('fanfare');
        api.banner('🎉 ' + t('סיום!', 'Siyum!'), t(`השלמתם את כל ${cat.he}`, `You completed all of ${cat.en}`), 'siyum', 5000);
        api.addScore(500 * api.level);
        for (let k = 0; k < 6; k++) setTimeout(() => {
            const p = new T.Vector3((Math.random() - 0.5) * 12, 7 + Math.random() * 4, -2 + Math.random() * 3);
            P.emit(p, Math.round(120 * api.Q.part) + 20, { color: 0xffd36b, color2: 0xffffff, speed: 9, size: 0.7, life: 1.8, gravity: 2.5, drag: 0.9 });
            api.audio.sfx('bell');
        }, k * 380);
        burstConfetti();
    }

    // ---- sequence mode ----
    function seqPromptHtml() {
        if (!seqMode) return '';
        const prev = seqIdx > 0 ? cat.items[seqIdx - 1].w : null;
        return `<div class="g3-scroll">${prev ? t(`מה בא אחרי <b>${prev}</b>?`, `What comes after <b>${prev}</b>?`) : t('התחילו מההתחלה — מה הראשון?', 'Start at the beginning — what is first?')} <small>${seqIdx}/${cat.items.length}</small></div>`;
    }
    function startRound() {
        if (seqIdx >= cat.items.length) return;
        roundActive = true;
        const correct = cat.items[seqIdx];
        const nDecoys = api.level >= 3 ? 3 : 2;
        const pool = cat.items.filter(it => it.w !== correct.w && Array.from(it.w)[0] !== Array.from(correct.w)[0]);
        const decoys = pool.sort(() => Math.random() - 0.5).slice(0, nDecoys);
        const all = [{ item: correct, correct: true }].concat(decoys.map(d => ({ item: d, decoy: true }))).sort(() => Math.random() - 0.5);
        const xs = all.map((_, i) => -5.5 + i * (11 / Math.max(1, all.length - 1)) + (Math.random() - 0.5));
        roundQueue = all.map((o, i) => ({ o, x: xs[i], delay: i * 0.7 }));
        api.hud.extra(seqPromptHtml());
    }
    function endRound(success, b) {
        roundActive = false;
        books.filter(x => x.alive && x.state === 'fall' && x !== b).forEach(x => dissolve(x));
        if (!success) api.banner(t('התשובה הנכונה:', 'The answer was:'), cat.items[seqIdx].w, 'small', 1800);
        seqIdx++;
        if (seqIdx >= cat.items.length) {
            celebrateSiyum();
            setTimeout(() => api.end(true), 3500);
            return;
        }
        spawnT = 1.2;
        api.hud.extra(seqPromptHtml());
    }

    function dissolve(b) {
        b.alive = false; b.state = 'gone';
        P.emit(b.g.position, 25, { color: 0x998877, speed: 2, size: 0.6, life: 1, up: 0.5 });
        scene.remove(b.g); b.label.dispose();
        if (target === b) { target = null; buffer = ''; }
        cleanupBook(b);
    }
    function cleanupBook(b) { const i = books.indexOf(b); if (i >= 0) books.splice(i, 1); }

    function bookLanded(b) {
        b.state = 'landed'; b.t = 0;
        api.audio.sfx('thud');
        P.emit(new T.Vector3(b.g.position.x, 0.3, b.g.position.z), 30, { color: 0xbfa98a, speed: 3, size: 0.5, life: 1.2, up: 1, drag: 1.5 });
        b.label.sprite.visible = false;
        if (target === b) { target = null; buffer = ''; api.hud.typed(''); }
        if (seqMode) {
            if (b.correct) { const lost = api.damage(1); extinguish(); endRound(false, b); }
        } else {
            api.damage(1); extinguish();
        }
        api.shake(0.25);
    }

    // ---- typing ----
    function candidatesFor(prefix) { return books.filter(b => b.alive && b.state === 'fall' && b.item.w.startsWith(prefix)); }
    function onChar(ch) {
        const next = buffer + ch;
        let cands = candidatesFor(next);
        if (!cands.length && buffer) {
            // a fresh start on another sefer (user abandoned the current one)
            const fresh = candidatesFor(ch);
            if (fresh.length) { resetTarget(); cands = fresh; buffer = ''; }
        }
        if (!cands.length) {
            api.keyBad();
            if (target) { target.g.position.x += (Math.random() - 0.5) * 0.25; }
            setHint();
            return;
        }
        buffer += ch;
        api.keyOk();
        const nt = cands.includes(target) ? target : cands.sort((a, b) => a.g.position.y - b.g.position.y)[0];
        if (target && target !== nt) target.label.setTyped(0);
        target = nt;
        target.typed = Array.from(buffer).length;
        target.label.setTyped(target.typed);
        // musical chime rising along the word (Ahava Rabbah scale)
        const scale = [293.7, 311.1, 370, 392, 440, 466.2, 523.3, 587.3, 622.3, 740];
        api.audio.sfx('note', { freq: scale[Math.min(scale.length - 1, target.typed - 1)] });
        P.emit(target.g.position.clone().add(new T.Vector3(0, 1.2, 0.3)), Math.round(8 * q) + 3, { color: 0xffd36b, speed: 2.5, size: 0.35, life: 0.6 });
        if (target.typed >= target.chars.length) {
            const b = target; target = null; buffer = '';
            if (seqMode) {
                if (b.correct) { catchBook(b); endRound(true, b); }
                else {
                    api.keyBad();
                    api.banner('↩️ ' + t('לא לפי הסדר', 'Not in order'), t(`${b.item.w} אינו הבא בתור`, `${b.item.w} is not next`), 'small', 1500);
                    dissolve(b);
                }
            } else catchBook(b);
        }
        setHint();
    }
    function resetTarget() { if (target) target.label.setTyped(0); target = null; buffer = ''; }
    function onBackspace() { resetTarget(); setHint(); }
    function lowest() { let best = null; books.forEach(b => { if (b.alive && b.state === 'fall' && (!best || b.g.position.y < best.g.position.y)) best = b; }); return best; }
    function expected() { if (target) return target.chars[target.typed] || ''; const l = lowest(); return l ? l.chars[0] : ''; }
    function setHint() {
        api.hud.typed(buffer);
        const ch = expected();
        const tb = target || lowest();
        api.hud.hint(ch, tb ? (tb.item.w + '|' + buffer + '|' + tb.g.id) : '');
    }

    // ---- loop ----
    const tmpQ = new T.Quaternion();
    function animateRoom(dt) {
        time += dt;
        flames.forEach((f, i) => { if (f.material.map === flameTex) { const s = 0.9 + Math.sin(time * 13 + i * 1.7) * 0.08 + Math.random() * 0.06; f.scale.set(0.22 * s, 0.42 * s, 1); } });
        chandLights.forEach((l, i) => { l.intensity = (i ? 1.0 : 1.3) * (0.9 + Math.sin(time * 9 + i) * 0.05 + Math.random() * 0.06); });
        candleLight.intensity = (litCount / Math.max(1, nC)) * (1.5 + Math.random() * 0.25);
        candles.forEach((c, i) => {
            const target = c.lit ? 1 : 0;
            const cur = c.f.material.opacity;
            c.f.material.opacity = cur + (target - cur) * Math.min(1, dt * 4);
            c.h.material.opacity = c.f.material.opacity * 0.6;
            if (c.lit) { const s = 0.9 + Math.sin(time * 15 + i * 2.1) * 0.1 + Math.random() * 0.05; c.f.scale.set(0.2 * s, 0.38 * s, 1); }
        });
        beams.forEach((b, i) => { b.material.opacity = 0.13 + Math.sin(time * 0.5 + i) * 0.04; });
        const d = dustGeo.attributes.position.array;
        for (let i = 0; i < dustN; i++) { d[i * 3 + 1] += Math.sin(time * 0.3 + i) * 0.002 - 0.0015; d[i * 3] += Math.cos(time * 0.2 + i * 0.5) * 0.002; if (d[i * 3 + 1] < 0) d[i * 3 + 1] = 13; }
        dustGeo.attributes.position.needsUpdate = true;
        // gentle camera drift
        const cb = new T.Vector3(Math.sin(time * 0.12) * 0.5, 5.4 + Math.sin(time * 0.17) * 0.15, 15);
        api.setCameraBase(cb);
    }
    function ambient(dt) { animateRoom(dt); }
    function afterCamera() { camera.lookAt(0, 4.3, -2); }

    function update(dt, realDt) {
        animateRoom(realDt);
        // spawning
        if (seqMode) {
            if (!roundActive && seqIdx < cat.items.length) { spawnT -= dt; if (spawnT <= 0) startRound(); }
            for (let i = roundQueue.length - 1; i >= 0; i--) { const r = roundQueue[i]; r.delay -= dt; if (r.delay <= 0) { makeBook(r.o.item, { x: r.x, decoy: r.o.decoy, correct: r.o.correct }); roundQueue.splice(i, 1); } }
        } else {
            spawnT -= dt;
            const falling = books.filter(b => b.alive && b.state === 'fall').length;
            if (spawnT <= 0 && falling < D.max + Math.floor(api.level / 3)) {
                makeBook(pickItem());
                spawnT = Math.max(1.1, 4.0 - api.level * 0.2) * D.spawn;
            }
        }
        const fallSpeed = (0.85 + api.level * 0.1) * D.speed * (seqMode ? 0.8 : 1) * (cat.beginner ? 0.85 : 1);
        books.slice().forEach(b => {
            if (!b.alive) return;
            const p = b.g.position;
            if (b.state === 'fall') {
                b.sway += dt;
                p.y -= fallSpeed * dt;
                p.x += Math.sin(b.sway * 0.9) * 0.25 * dt;
                b.g.rotation.y += Math.sin(b.sway * 0.7) * b.spinY * dt;
                b.g.rotation.z = Math.sin(b.sway * 1.1) * 0.12;
                b.label.sprite.material.opacity = 1;
                if (p.y <= 1.05) bookLanded(b);
            } else if (b.state === 'fly') {
                b.t = Math.min(1, b.t + realDt / 0.95);
                const k = b.t, ik = 1 - k;
                p.set(ik * ik * b.from.x + 2 * ik * k * b.ctrl.x + k * k * b.to.x, ik * ik * b.from.y + 2 * ik * k * b.ctrl.y + k * k * b.to.y, ik * ik * b.from.z + 2 * ik * k * b.ctrl.z + k * k * b.to.z);
                const s = 1 - 0.45 * k; b.g.scale.set(s, s, s);
                b.g.rotation.set(b.fromRot.x * ik, b.fromRot.y * ik + (-Math.PI / 2) * k + Math.sin(k * Math.PI) * 1.2, b.fromRot.z * ik);
                if (b.t >= 1) {
                    b.state = 'placed'; b.g.rotation.set(0, -Math.PI / 2, 0);
                    b.mats.forEach(m => { m.emissiveIntensity = 0.0; });
                    P.emit(p, 14, { color: 0xffe08a, speed: 1.5, size: 0.3, life: 0.6 });
                    api.audio.sfx('thud');
                    // full shelf → clear it with a golden shimmer
                    if (placed.length >= SLOTS_PER_ROW * 3) {
                        placed.splice(0).forEach((pb, i) => setTimeout(() => { P.emit(pb.g.position, 8, { color: 0xffd36b, speed: 2, size: 0.4, life: 0.7 }); scene.remove(pb.g); pb.label.dispose(); cleanupBook(pb); }, i * 30));
                    }
                }
            } else if (b.state === 'landed') {
                b.t += realDt;
                b.g.rotation.x += (-Math.PI / 2 - b.g.rotation.x) * Math.min(1, realDt * 6);
                p.y += (0.2 - p.y) * Math.min(1, realDt * 6);
                if (b.t > 1.6) { b.mats.forEach(m => { m.transparent = true; m.opacity = Math.max(0, 1 - (b.t - 1.6) * 1.5); }); }
                if (b.t > 2.4) { b.alive = false; scene.remove(b.g); b.label.dispose(); cleanupBook(b); }
            }
        });
        if (Math.random() < 0.15) setHint();
    }

    function dispose() { clearTimeout(infoTimer); }
    if (seqMode) api.hud.extra(seqPromptHtml());
    else if (cfg.play === 'sequence' && !cat.ordered) api.banner(t('לקטגוריה זו אין סדר קבוע', 'This category has no fixed order'), t('משחקים במצב חופשי', 'Playing in free mode'), 'small', 2600);
    return {
        update, onChar, onBackspace, expected, ambient, afterCamera, dispose,
        _syncStats(S) { S.sefNew = stats.newItems; S.sefSiyum = stats.siyum; }
    };
}
