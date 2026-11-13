// ---- 4.2: new versions ("+") of the five 3D games ----
// Same worlds, new rules on top (see plus.js): an upgrade draft after every level,
// target letters taken from your own weak spots, bosses & challenges, coins.
// The original games are untouched and still available.

const GALAXY_PLUS_DEF = PLUS.plusVersion(GALAXY_DEF, {
    desc: () => t('גלקסיית המילים — בגרסה חדשה: אחרי כל שלב בוחרים שדרוג (מגן, עוף החול, תלתן מזל, מגנט…) בהקלדת האות שעל הכרטיס. שתי אותיות מטרה מתוך החולשות שלכם מופיעות יותר ושוות בונוס, ומפלצת האותיות ואתגרי יהלום וספרינט קופצים בדרך. מטבעות נשמרים לחנות.', 'Word Galaxy — new version: after every level pick an upgrade (shield, phoenix, lucky clover, magnet…) by typing the letter on its card. Two target letters taken from your weak spots show up more often and pay a bonus, and the Letter Monster plus diamond and sprint challenges jump in along the way. Coins are kept for the shop.'),
    trains: () => t('מתאמן על: האותיות החלשות שלכם, מהירות תגובה ודיוק תחת לחץ', 'Trains: your weak letters, reaction speed and accuracy under pressure')
});
const TOWER_PLUS_DEF = PLUS.plusVersion(TOWER_DEF, {
    desc: () => t('מגדל הדיוק — בגרסה חדשה: שדרוגים בין השלבים (סליחה על טעות ראשונה, פרפקציוניסט, מגע הזהב…), אותיות מטרה שמזינות את המגדל במילים שאתם צריכים לתרגל, ואתגר היהלום — 5 קומות מושלמות ברצף.', 'Tower of Precision — new version: upgrades between levels (forgive the first slip, perfectionist, Midas touch…), target letters that feed the tower the words you need to practise, and the diamond challenge — 5 perfect floors in a row.'),
    trains: () => t('מתאמן על: דיוק — ועל האותיות שהכי צריכות חיזוק', 'Trains: accuracy — and the letters that need it most')
});
const ARENA_PLUS_DEF = PLUS.plusVersion(ARENA_DEF, {
    desc: () => t('זירת המקשים — בגרסה חדשה: כל מקש מטרה שוה פי 2–3, שדרוגים אחרי כל שלב, מפלצת אותיות שצריך להכות בהקשות מהירות, וחנות מאיצים בין משחק למשחק.', 'Key Arena — new version: every target key is worth ×2–3, upgrades after each level, a Letter Monster you beat with fast hits, and a booster shop between games.'),
    trains: () => t('מתאמן על: מיקום המקשים והאצבעות, זמן תגובה', 'Trains: key positions & fingers, reaction time')
});
const RACE_PLUS_DEF = PLUS.plusVersion(RACE_DEF, {
    noLives: true, draftEvery: 9,
    desc: () => t('מרוץ ההקלדה — בגרסה חדשה: "עצירת פיטס" כל כמה מילים לבחירת שדרוג, אותיות מטרה שמזניקות ניקוד, אתגרי ספרינט באמצע המרוץ ומטבעות לחנות.', 'Typing Grand Prix — new version: a "pit stop" every few words to pick an upgrade, target letters that boost your score, sprint challenges mid-race and coins for the shop.'),
    trains: () => t('מתאמן על: קצב רציף על טקסט אמיתי — ועל האותיות החלשות', 'Trains: steady rhythm on real text — and your weak letters')
});
const SEFARIM_PLUS_DEF = PLUS.plusVersion(SEFARIM_DEF, {
    desc: () => t('היכל הספרים — בגרסה חדשה: שדרוגים אחרי כל שלב, אותיות מטרה ששוות בונוס בכל שם ספר, אתגר יהלום של שמות מושלמים ומפלצת אותיות בהיכל.', 'Hall of Sefarim — new version: upgrades after each level, target letters that pay a bonus in every name, a diamond challenge of flawless names and a Letter Monster in the hall.'),
    trains: () => t('מתאמן על: שמות הספרים והסדר שלהם — ודיוק', 'Trains: the names of the sefarim and their order — and accuracy')
});
