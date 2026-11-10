// ---- מקלדת עברית תקנית (ישראל) ----
// מיפוי: קוד מקש פיזי (US) -> אות עברית
const KEYBOARD_LAYOUT = {
    'KeyQ': '/', 'KeyW': "'", 'KeyE': 'ק', 'KeyR': 'ר', 'KeyT': 'א',
    'KeyY': 'ט', 'KeyU': 'ו', 'KeyI': 'ן', 'KeyO': 'ם', 'KeyP': 'פ',
    'KeyA': 'ש', 'KeyS': 'ד', 'KeyD': 'ג', 'KeyF': 'כ', 'KeyG': 'ע',
    'KeyH': 'י', 'KeyJ': 'ח', 'KeyK': 'ל', 'KeyL': 'ך', 'Semicolon': 'ף',
    'KeyZ': 'ז', 'KeyX': 'ס', 'KeyC': 'ב', 'KeyV': 'ה', 'KeyB': 'נ',
    'KeyN': 'מ', 'KeyM': 'צ', 'Comma': 'ת', 'Period': 'ץ', 'Slash': '.',
    // BUGFIX 3.0: the comma lives on the Quote key in the Israeli layout. It was
    // missing, so commas in the paragraphs could never be highlighted/guided.
    'Quote': ',',
    'Backquote': ';', 'Digit1': '1', 'Digit2': '2', 'Digit3': '3', 'Digit4': '4', 'Digit5': '5',
    'Digit6': '6', 'Digit7': '7', 'Digit8': '8', 'Digit9': '9', 'Digit0': '0', 'Minus': '-', 'Equal': '=',
    'Space': ' '
};
// תווים עם Shift (זהה כמעט לחלוטין בין הפריסות; ההבדל העיקרי: < > הפוכים בעברית)
const HEBREW_SHIFT_LAYOUT = {
    Backquote:'~', Digit1:'!', Digit2:'@', Digit3:'#', Digit4:'$', Digit5:'%', Digit6:'^', Digit7:'&', Digit8:'*', Digit9:'(', Digit0:')', Minus:'_', Equal:'+',
    Semicolon:':', Quote:'"', Comma:'>', Period:'<', Slash:'?',
    KeyQ:'Q', KeyW:'W', KeyE:'E', KeyR:'R', KeyT:'T', KeyY:'Y', KeyU:'U', KeyI:'I', KeyO:'O', KeyP:'P',
    KeyA:'A', KeyS:'S', KeyD:'D', KeyF:'F', KeyG:'G', KeyH:'H', KeyJ:'J', KeyK:'K', KeyL:'L',
    KeyZ:'Z', KeyX:'X', KeyC:'C', KeyV:'V', KeyB:'B', KeyN:'N', KeyM:'M'
};
// היפוך: אות עברית -> קוד מקש
const CHAR_TO_KEYCODE = {};
Object.entries(KEYBOARD_LAYOUT).forEach(([code, ch]) => { CHAR_TO_KEYCODE[ch] = code; });

// ---- שיוך אצבעות (לפי מיקום פיזי, זהה לפריסת QWERTY) ----
const FINGER_NAMES = {
    lp: 'זרת שמאל', lr: 'קמיצה שמאל', lm: 'אמה שמאל', li: 'אצבע שמאל',
    ri: 'אצבע ימין', rm: 'אמה ימין', rr: 'קמיצה ימין', rp: 'זרת ימין', th: 'אגודל'
};
const KEY_TO_FINGER = {
    KeyQ: 'lp', KeyA: 'lp', KeyZ: 'lp',
    KeyW: 'lr', KeyS: 'lr', KeyX: 'lr',
    KeyE: 'lm', KeyD: 'lm', KeyC: 'lm',
    KeyR: 'li', KeyF: 'li', KeyV: 'li', KeyT: 'li', KeyG: 'li', KeyB: 'li',
    KeyY: 'ri', KeyH: 'ri', KeyN: 'ri', KeyU: 'ri', KeyJ: 'ri', KeyM: 'ri',
    KeyI: 'rm', KeyK: 'rm', Comma: 'rm',
    KeyO: 'rr', KeyL: 'rr', Period: 'rr',
    KeyP: 'rp', Semicolon: 'rp', Slash: 'rp', Quote: 'rp',
    Backquote: 'lp', Digit1: 'lp', Digit2: 'lr', Digit3: 'lm', Digit4: 'li', Digit5: 'li',
    Digit6: 'ri', Digit7: 'ri', Digit8: 'rm', Digit9: 'rr', Digit0: 'rp', Minus: 'rp', Equal: 'rp',
    ShiftLeft: 'lp', ShiftRight: 'rp',
    Space: 'th'
};
const HAND_OF_FINGER = { lp: 'left', lr: 'left', lm: 'left', li: 'left', ri: 'right', rm: 'right', rr: 'right', rp: 'right', th: 'both' };

// שורות המקלדת לצורך רינדור ויזואלי (מסודר RTL - העמודה השמאלית ביותר מוצגת מימין למקלדת עברית... אך אנו נשמור סדר לוגי שמאל->ימין פיזי ונציג ב-CSS RTL)
const KEYBOARD_ROWS = [
    ['Backquote','Digit1','Digit2','Digit3','Digit4','Digit5','Digit6','Digit7','Digit8','Digit9','Digit0','Minus','Equal'],
    ['KeyQ','KeyW','KeyE','KeyR','KeyT','KeyY','KeyU','KeyI','KeyO','KeyP'],
    ['KeyA','KeyS','KeyD','KeyF','KeyG','KeyH','KeyJ','KeyK','KeyL','Semicolon','Quote'],
    ['ShiftLeft','KeyZ','KeyX','KeyC','KeyV','KeyB','KeyN','KeyM','Comma','Period','Slash','ShiftRight']
];
const HOME_ROW_KEYS = ['KeyA','KeyS','KeyD','KeyF','KeyJ','KeyK','KeyL','Semicolon'];

// ---- סדר הוראה של אותיות (פדגוגיה: שורת בית -> עליונה -> תחתונה) ----
const LEVEL1_KEY_ORDER = [
    'KeyF','KeyJ',                     // כ ח (אצבעות שורת הבית)
    'KeyD','KeyK',                     // ג ל
    'KeyS','KeyL',                     // ד ך
    'KeyA','Semicolon',                // ש ף
    'KeyG','KeyH',                     // ע י (חפיפה - נשתמש בהמשך)
    'KeyR','KeyU',                     // ר ו
    'KeyE','KeyI',                     // ק ן
    'KeyT','KeyY',                     // א ט
    'KeyW','KeyO',                     // ' ם
    'KeyQ','KeyP',                     // / פ
    'KeyV','KeyN',                     // ה מ
    'KeyC','KeyM',                     // ב צ
    'KeyX','Comma',                    // ס ת
    'KeyZ','KeyB',                     // ז נ
    'Period','Slash'                   // ץ .
];

// ---- ניקוד ----
const NIQUD_MARKS = ['\u05B0','\u05B1','\u05B2','\u05B3','\u05B4','\u05B5','\u05B6','\u05B7','\u05B8','\u05B9','\u05BB','\u05BC','\u05C1','\u05C2'];
const NIQUD_NAME = { '\u05B7':'פתח', '\u05B8':'קמץ', '\u05B6':'סגול', '\u05B5':'צירה', '\u05B4':'חיריק', '\u05B9':'חולם', '\u05BB':'קובוץ', '\u05B0':'שווא' };
function stripNiqud(str) { return str.replace(/[\u0591-\u05C7]/g, ''); }

// פיצול נכון ל-grapheme clusters (אות בסיס + סימני ניקוד נספחים לא נספרים כתו נפרד)
function toGraphemes(str) {
    if (typeof Intl !== 'undefined' && Intl.Segmenter) {
        try {
            const seg = new Intl.Segmenter('he', { granularity: 'grapheme' });
            return Array.from(seg.segment(str), s => s.segment);
        } catch (e) {}
    }
    // נפילה חוזרת: קבץ תו בסיס + כל סימני הניקוד/טעמים הבאים אחריו
    const out = [];
    for (const ch of str) {
        if (/[\u0591-\u05C7]/.test(ch) && out.length) {
            out[out.length - 1] += ch;
        } else {
            out.push(ch);
        }
    }
    return out;
}

// ---- מאגר מילים (נבחר, לפי אורך/קושי) ----
const WORD_BANK = {
    short: ['אני','אתה','את','הוא','היא','לא','כן','גם','עם','אל','על','יש','אין','מה','מי','כל','רק','עוד','אז','שם','פה','גג','דג','יד','עץ','אור','חג','שק','דש'],
    medium: ['בית','ילד','ילדה','שלום','תודה','אמא','אבא','מים','לחם','שמש','ירח','ספר','עט','שולחן','כיסא','חלון','דלת','רחוב','עיר','שנה','יום','לילה','בוקר','ערב','אוכל','חבר','עבודה','לימוד','מורה','תלמיד','כיתה','מחשב','טלפון','ים','הר','פרח','כלב','חתול','ציפור','דג','אדום','ירוק','כחול','גדול','קטן','חדש','ישן','יפה','טוב','רע'],
    long: ['משפחה','מכונית','אוטובוס','רכבת','מטוס','אוניברסיטה','ספריה','מסעדה','חופשה','מסיבה','ארוחה','שיעורים','מזג האויר','טיול','חברים','משחקים','מחשבה','תשובה','שאלה','הרגשה','אתמול','מחר','שבוע','חודש','עונה','מדינה','ממשלה','חברה','תעשיה','טכנולוגיה'],
    advanced: ['התלהבות','אחריות','התפתחות','אוניברסיטאי','אפשרות','משמעותי','התחייבות','אסטרטגיה','תקשורת','ארגון','ניהול','כלכלה','תרבות','היסטוריה','פילוסופיה','מדעי המחשב','משפט עברי','בית מדרש','ספרות']
};

const SENTENCE_BANK = [
    'השמש זורחת בבוקר.',
    'הילד קורא ספר מעניין.',
    'אמא מכינה ארוחת בוקר טעימה.',
    'הכלב רץ בגינה הגדולה.',
    'אנחנו הולכים לבית הספר ברגל.',
    'החברים שלי אוהבים לשחק כדורגל.',
    'בחורף יורד גשם וקר בחוץ.',
    'הספריה פתוחה מהבוקר עד הערב.',
    'סבא וסבתא מגיעים לביקור בשבת.',
    'המורה כתבה תרגיל חדש על הלוח.',
    'בסוף השבוע נצא לטייל בהרים.',
    'הילדים בונים מגדל גבוה מקוביות.',
    'הרכבת יוצאת מהתחנה בשעה שמונה.',
    'אני שותה כוס מים לפני השינה.',
    'העיר הזאת מלאה באנשים ובחנויות.',
    'כל יום אני לומד משהו חדש.',
    'הפרחים בגינה פורחים באביב.',
    'אחי הקטן אוהב לצייר ציורים צבעוניים.',
    'קמתי מוקדם כדי לראות את הזריחה.',
    'הים היה שקט והמים היו צלולים.',
    'בערב ישבנו כולנו יחד סביב השולחן.',
    'הספר הזה מלא בסיפורים מרתקים.',
    'צריך לשתות הרבה מים ביום חם.',
    'החתול ישן על אדן החלון בשמש.',
    'בכל בוקר אני מסדר את החדר שלי.',
    'השיעור הסתיים והתלמידים יצאו להפסקה.',
    'אבא קנה לחם טרי במאפיה הקרובה.',
    'הרוח נושבת חזק והעצים מתנועעים.',
    'מי שמתמיד בסוף מצליח.',
    'סבלנות ותרגול הם המפתח להצלחה.',
    'הטלפון צלצל בדיוק כשיצאתי מהבית.',
    'אנחנו מתכננים טיול משפחתי לצפון.',
    'הכוכבים נוצצים בשמי הלילה הבהירים.',
    'המחשב החדש מהיר ושקט מאוד.',
    'דבר בעתו מה טוב.'
];

const PARAGRAPH_BANK = [
`בוקר אחד יצא דני מהבית מוקדם מהרגיל. השמש עוד לא הספיקה לחמם את האוויר, וטל דק כיסה את העלים בגינה. הוא הלך ברחוב השקט, פגש את השכן שלו והחליף איתו כמה מילים על מזג האוויר. כשהגיע לתחנת האוטובוס כבר עמדו שם עוד כמה אנשים, כולם ממתינים בשקט לרכבת היום החדש שעומד להתחיל.`,
`ההקלדה העברית דורשת תרגול סבלני ועקבי. בהתחלה כל אות דורשת מחשבה, אבל עם הזמן האצבעות לומדות למצוא את מקומן לבד. חשוב לשים לב ליציבה נכונה, למקם את הידיים על שורת הבית, ולא להסתכל על המקלדת. מי שמתרגל כל יום כמה דקות, מגלה תוך שבועות אחדים שהוא מקליד מהר יותר וטועה פחות.`,
`בספריה השכונתית יש פינה שקטה ליד החלון, ושם אוהבים הילדים לשבת ולקרוא. יש שם ספרי הרפתקאות, ספרי מדע, ואפילו קומיקס בעברית. הספרנית מכירה כל ילד וכל ילדה בשם, ותמיד יודעת להמליץ על הספר המתאים ביותר. בסוף כל ביקור היא מבקשת מהם לכתוב במחברת מה הם קראו והאם אהבו.`,
`הנמלה הקטנה עבדה כל הקיץ. היא אספה גרגרים, סחבה אותם אל הקן, וסידרה אותם בזהירות. הצרצר צחק עליה וישב לשיר בצל. כשהגיע החורף והקור התחיל, לנמלה היה מזון לכל הימים, והיא למדה שעבודה קטנה בכל יום מצטברת לדבר גדול.`,
`מי שרוצה ללמוד מיומנות חדשה צריך שלושה דברים: סבלנות, התמדה ומעט אומץ. בהתחלה הכל נראה קשה, והטעויות רבות. אבל כל טעות היא שיעור קטן. אחרי כמה ימים של תרגול, מה שהיה קשה הופך לקל, ומה שהיה איטי הופך למהיר וטבעי.`,
`בשוק של יום שישי יש תמיד המולה. המוכרים קוראים בקול, הריח של פירות טריים ממלא את האוויר, ואנשים ממהרים לקנות לפני השבת. ילדים מחזיקים בידי ההורים, וזקנים יושבים על ספסל ומסתכלים על כל הצבעים והתנועה.`,
`המדע מתחיל בשאלה פשוטה. למה השמיים כחולים? מדוע העלים משנים את צבעם בסתיו? איך הציפורים יודעות לאן לעוף? חוקרים סקרנים מנסים למצוא תשובות, בודקים, טועים ומנסים שוב, עד שהם מגלים משהו חדש על העולם שסביבנו.`
];

// ---- מפתחות מוכרות (לפי רמה) לצורך תרגילי שילוב ----
const LEVELS = [
    { id: 0, name: 'התחלה', desc: 'הכרות עם המקלדת ומיקום הידיים', en: 'Getting Started', enDesc: 'Keyboard and hand positioning' },
    { id: 1, name: 'אותיות בודדות', desc: 'לימוד כל אות בנפרד, שורת בית תחילה', en: 'Individual Letters', enDesc: 'Learn each letter on its own, home row first' },
    { id: 2, name: 'צירופי אותיות', desc: 'שילובים בין אותיות שנלמדו', en: 'Letter Combinations', enDesc: 'Combine the letters you have learned' },
    { id: 3, name: 'מילים קצרות', desc: 'מילים אמיתיות באורך 2-3 אותיות', en: 'Short Words', enDesc: 'Real 2–3 letter words' },
    { id: 4, name: 'מילים ומשפטים', desc: 'מילים ארוכות יותר ומשפטים קצרים', en: 'Words & Sentences', enDesc: 'Longer words and short sentences' },
    { id: 5, name: 'פסקאות', desc: 'טקסט עברי רציף עם פיסוק', en: 'Paragraphs', enDesc: 'Continuous Hebrew text with punctuation' },
    { id: 6, name: 'עברית מתקדמת', desc: 'אוצר מילים מורחב ומשפטים מורכבים', en: 'Advanced Hebrew', enDesc: 'Wider vocabulary and complex sentences' },
    { id: 7, name: 'ניקוד', desc: 'תרגול הקלדה עם סימני ניקוד', en: 'Niqqud', enDesc: 'Typing with vowel marks' },
    { id: 8, name: 'שליטה', desc: 'טקסטים ארוכים בתנאי הקלדה מציאותיים, ללא עזרים', en: 'Mastery', enDesc: 'Long realistic texts without assistance' }
];

// ---- English curriculum (independent from UI language) ----
const ENGLISH_LAYOUT = {
    KeyQ:'q', KeyW:'w', KeyE:'e', KeyR:'r', KeyT:'t', KeyY:'y', KeyU:'u', KeyI:'i', KeyO:'o', KeyP:'p',
    KeyA:'a', KeyS:'s', KeyD:'d', KeyF:'f', KeyG:'g', KeyH:'h', KeyJ:'j', KeyK:'k', KeyL:'l', Semicolon:';',
    KeyZ:'z', KeyX:'x', KeyC:'c', KeyV:'v', KeyB:'b', KeyN:'n', KeyM:'m', Comma:',', Period:'.', Slash:'/', Quote:"'",
    Backquote:'`', Digit1:'1', Digit2:'2', Digit3:'3', Digit4:'4', Digit5:'5', Digit6:'6', Digit7:'7', Digit8:'8', Digit9:'9', Digit0:'0', Minus:'-', Equal:'=',
    Space:' '
};
const ENGLISH_SHIFT_LAYOUT = Object.assign({}, HEBREW_SHIFT_LAYOUT, { Comma:'<', Period:'>' });
const ENGLISH_CHAR_TO_KEYCODE = {};
Object.entries(ENGLISH_LAYOUT).forEach(([code,ch]) => { ENGLISH_CHAR_TO_KEYCODE[ch]=code; });
const ENGLISH_KEY_ORDER = ['KeyF','KeyJ','KeyD','KeyK','KeyS','KeyL','KeyA','Semicolon','KeyG','KeyH','KeyR','KeyU','KeyE','KeyI','KeyT','KeyY','KeyW','KeyO','KeyQ','KeyP','KeyV','KeyN','KeyC','KeyM','KeyX','Comma','KeyZ','KeyB','Period','Slash'];
const ENGLISH_WORD_BANK = {
    short:['a','i','am','an','as','at','be','by','do','go','he','if','in','is','it','me','my','no','of','on','or','so','to','up','us','we'],
    medium:['home','book','desk','hand','type','word','time','work','good','fast','slow','learn','study','school','class','water','house','friend','family','computer','lesson','practice'],
    long:['keyboard','practice','learning','accuracy','progress','exercise','language','computer','important','consistent','comfortable','improvement'],
    advanced:['achievement','concentration','coordination','productivity','professional','communication','independent','challenging','determination','responsibility']
};
const ENGLISH_SENTENCE_BANK = [
    'The quick brown fox jumps over the lazy dog.',
    'Practice makes typing faster and more accurate.',
    'Keep your hands relaxed on the home row.',
    'Good typing comes from steady and careful practice.',
    'Look at the screen instead of looking down at the keyboard.',
    'A few minutes of practice every day can build strong habits.',
    'Accuracy comes first, and speed will follow with practice.',
    'Small steps every day lead to big results.',
    'She sells sea shells by the sea shore.',
    'Every expert was once a beginner.',
    'Reading and writing open many doors in life.',
    'The library is quiet in the early morning.',
    'Please return your fingers to the home row.',
    'Patience and practice are the keys to success.',
    'The sun was shining brightly over the hills.'
];
const ENGLISH_PARAGRAPH_BANK = [
    'Typing is a skill that improves through deliberate practice. At first each key may require attention, but repeated practice helps the fingers find the correct position automatically. Keep a relaxed posture, return to the home row, and focus on accuracy before speed.',
    'A good typing lesson should challenge you without overwhelming you. Short exercises build confidence, while longer words and sentences develop rhythm. When a key becomes difficult, slow down, practice it carefully, and then return to normal text.',
    'The little ant worked all summer long. She gathered seeds, carried them home, and stored them carefully. When winter came, she had enough food for every cold day, and she learned that small efforts add up to great things.',
    'Science begins with a simple question. Why is the sky blue? How do birds know where to fly? Curious people test ideas, make mistakes, and try again until they discover something new about the world around us.'
];

// ---- 3.0: text normalisation & key resolution helpers ----

// Turns any pasted/generated text into something that can physically be typed:
// line breaks/tabs -> spaces (Enter was never accepted, so a pasted text with a
// line break used to freeze the exercise), typographic quotes/dashes -> ASCII,
// cantillation marks (טעמים) removed, invisible bidi marks removed, and any
// remaining character that has no key on the keyboard dropped.
function normalizePracticeText(text, keepNiqud) {
    let t = String(text || '');
    try { t = t.normalize('NFKD'); } catch (e) {}
    t = t.replace(/\r\n?/g, '\n')
         .replace(/[‎‏‪-‮⁦-⁩﻿​-‍]/g, '')
         .replace(/[\n\t  -  　]+/g, ' ')
         .replace(/[״“”„«»]/g, '"').replace(/[׳‘’‚`´]/g, "'")
         .replace(/[–—‐‑־−]/g, '-').replace(/…/g, '...')
         .replace(/׃/g, ':').replace(/[׀׆]/g, '')
         .replace(/[֑-ׇֽֿׅ֯ׄ]/g, '');
    if (!keepNiqud) t = t.replace(/[ְ-ּׁׂ]/g, '');
    try { t = t.normalize('NFC'); } catch (e) {}
    const kept = toGraphemes(t).filter(g => {
        const base = g.replace(/[֑-ׇ]/g, '');
        if (!base) return false;
        return /^[א-ת]$/.test(base) || /^[\x20-\x7E]$/.test(base);
    });
    return kept.join('').replace(/ {2,}/g, ' ').trim();
}

// Which physical key (+Shift?) produces a character, in the active curriculum
// layout first and then the other one (e.g. an English word inside Hebrew text).
function resolveKeyForChar(ch) {
    if (ch == null) return null;
    if (ch === ' ') return { code: 'Space', shift: false };
    const he = (typeof isEnglishTyping === 'function' && isEnglishTyping());
    const primary = he ? ENGLISH_CHAR_TO_KEYCODE : CHAR_TO_KEYCODE;
    const secondary = he ? CHAR_TO_KEYCODE : ENGLISH_CHAR_TO_KEYCODE;
    const primaryShift = he ? ENGLISH_SHIFT_LAYOUT : HEBREW_SHIFT_LAYOUT;
    if (primary[ch]) return { code: primary[ch], shift: false };
    for (const code in primaryShift) if (primaryShift[code] === ch) return { code, shift: true };
    if (secondary[ch]) return { code: secondary[ch], shift: false };
    return null;
}
function shiftKeyFor(code) {
    const f = KEY_TO_FINGER[code];
    return (HAND_OF_FINGER[f] === 'left') ? 'ShiftRight' : 'ShiftLeft';
}

// Converts a keydown into the character the learner *meant*, so the tutor works
// whatever keyboard language the operating system is set to. If Windows is on
// English while learning Hebrew (or the reverse), we translate by physical key.
let _detectedOsLayout = null; // 'he' | 'en' — learned from unshifted letter keys
function resolveTypedChar(e, expectedBase) {
    if (e.code === 'Space' || e.key === ' ') return ' ';
    const key = e.key;
    if (!key || key.length !== 1) return null;
    if (!e.shiftKey) {
        if (/[א-ת]/.test(key)) _detectedOsLayout = 'he';
        else if (/[a-zA-Z]/.test(key)) _detectedOsLayout = 'en';
    }
    if (key === expectedBase || /[֑-ׇ]/.test(key)) return key;
    const he = (e.shiftKey ? HEBREW_SHIFT_LAYOUT : KEYBOARD_LAYOUT)[e.code];
    const en = (e.shiftKey ? ENGLISH_SHIFT_LAYOUT : ENGLISH_LAYOUT)[e.code];
    const exp = expectedBase || '';
    const expectLatin = /[a-zA-Z]/.test(exp), expectHeb = /[א-ת]/.test(exp);
    const englishCurriculum = (typeof isEnglishTyping === 'function' && isEnglishTyping());
    const wantHe = expectHeb || (!expectLatin && !englishCurriculum);
    if (wantHe && _detectedOsLayout !== 'he' && he !== undefined) return he;
    if (!wantHe && _detectedOsLayout !== 'en' && en !== undefined) return en;
    return key;
}

// Translate a stored Hebrew UI label (e.g. a plan title saved in data) when the UI is English.
function trUi(he) { return (typeof appSettings !== 'undefined' && appSettings.uiLang === 'en' && typeof I18N !== 'undefined' && I18N[he]) ? I18N[he] : he; }
function uiLocale() { return (typeof appSettings !== 'undefined' && appSettings.uiLang === 'en') ? 'en-US' : 'he-IL'; }
function profileDisplayName(n) { return (n === 'הלומד' && typeof appSettings !== 'undefined' && appSettings.uiLang === 'en') ? 'Learner' : n; }
// Small i18n helper for new UI strings.
function t(he, en) { return (typeof appSettings !== 'undefined' && appSettings.uiLang === 'en') ? en : he; }
