// What is said on the Blank Scroll (T27), the end of the story: Dyo keeps the apprentice company
// across the white parchment, Naftali and Reb Ezra arrive at the Keeper's archive and call
// words in turn, the Keeper speaks quietly (he never shouts), and the ending gives him back his
// quill. Nobody is destroyed. Every speaker is male or Dyo (ARCHITECTURE section 8). Pure data.

import type { Cutscene, Line, Localized, Speaker } from './types';

/** The nine phases of the final (src/scenes/scroll/plan.ts). */
export type ScrollPhase = 'c1' | 'c2' | 'c3' | 'c4' | 'c5' | 'k1' | 'k2' | 'k3' | 'k4';

export type ScrollMoment =
  | 'arrive'
  | 'returning'
  | 'checkpoint'
  | 'land'
  | 'parry'
  | 'stagger'
  | 'slip'
  | 'combo'
  | 'failed'
  | 'special';

const L = (who: Speaker, he: string, en: string): Line => ({ who, text: { he, en } });

/** The line that opens each phase. */
export const SCROLL_PHASE_LINES: Readonly<Record<ScrollPhase, Line>> = {
  c1: L(
    'dyo',
    'זוכר את האחו? כל מילה שתכתוב מציירת אותו מחדש על הקלף. לאט ויפה, כמו בפעם הראשונה.',
    'Remember the meadow? Every word you write draws it again on the parchment. Slow and lovely, like the first time.',
  ),
  c2: L(
    'dyo',
    'הנפחייה והשוק! כאן סופרים כל סימן. טעות מחזירה ללובן קצת ממה שכתבת, אז יד נקייה.',
    'The forge and the market! Every mark counts here. A slip gives a little of your writing back to the white, so keep a clean hand.',
  ),
  c3: L(
    'dyo',
    'הרכבת והנשר! צמדי מילים, מהר, ואחרי כל צמד נושמים. ככה ניצחת את נפתלי.',
    'The train and the eagle! Pairs of words, fast, and a breath after each pair. That is how you beat Naftali.',
  ),
  c4: L(
    'dyo',
    'הגניזה והכוכבים. משפטים שלמים, והלובן בא בגלים: כשהוא גואה ממהרים, כשהוא נסוג נחים.',
    'The geniza and the stars. Whole sentences, and the white comes in waves: hurry when it rises, rest when it falls back.',
  ),
  c5: L(
    'dyo',
    'עכשיו החושך: העיר, המדבר, המערות. קטע אחד ארוך. הפנס שלך הוא יד נקייה. אני כאן, לא זז.',
    'Now the dark: the city, the desert, the caves. One long passage. A clean hand is your lantern. I am right here, not moving.',
  ),
  k1: L(
    'naftali',
    'חשבת שניתן לך להיכנס לבד? אני מחזיק את הקו. כשאקרא לך מילה, כתוב אותה נקי, ואעצור לו את היד.',
    'Did you think we would let you walk in alone? I am holding the line. When I call you a word, write it clean, and I will stay his hand.',
  ),
  k2: L(
    'keeper',
    'גם אני כתבתי פעם, ילד. שישים שנה. לילה אחד של אש, ולא נשאר דף. מה שלא נכתב לעולם לא יאבד.',
    'I wrote once too, child. Sixty years. One night of fire, and not a page was left. What is never written can never be lost.',
  ),
  k3: L(
    'ezra',
    'אל תענה לו בכעס. ענה לו בכתיבה. קטע ארוך ושקט. כשאקרא לך מילה, אכתוב בחזרה את מה שמחק.',
    'Do not answer him with anger. Answer him with writing. A long, quiet passage. When I call you a word, I will write back what he erased.',
  ),
  k4: L(
    'ezra',
    'אלה המילים שלו, אלה שאבדו לו באש. הוא מוחק אותן בזמן שאתה כותב. כתוב מהר ממה שהוא מוחק!',
    'These are his own words, the ones he lost in the fire. He erases them while you write. Write faster than he can erase!',
  ),
};

export const SCROLL_LINES: Readonly<Record<ScrollMoment, readonly Line[]>> = {
  arrive: [
    L(
      'dyo',
      'הכול לבן. אפילו אני מרגיש קצת חיוור. זו המגילה הריקה: מה שתכתוב כאן יחזור לעולם.',
      'Everything is white. Even I feel a little pale. This is the Blank Scroll: whatever you write here comes back to the world.',
    ),
  ],
  returning: [
    L(
      'dyo',
      'שוב המגילה הריקה. הפעם אנחנו יודעים את הדרך: חמישה טורים, ואז השומר.',
      'The Blank Scroll again. This time we know the way: five columns, and then the Keeper.',
    ),
  ],
  checkpoint: [
    L(
      'dyo',
      'ממשיכים מהטור שבו עצרנו. מה שנכתב נשאר כתוב.',
      'We go on from the column where we stopped. What was written stays written.',
    ),
  ],
  land: [
    L(
      'keeper',
      'הנח לזה. זה כואב פחות כשלא נשאר דבר לאבד.',
      'Let it go. It hurts less when there is nothing left to lose.',
    ),
  ],
  parry: [
    L(
      'dyo',
      'ראית? הלובן נשבר על המילה שלך. דיו טוב לא מפחד מדף ריק.',
      'Did you see? The white broke on your word. Good ink is not afraid of an empty page.',
    ),
  ],
  stagger: [
    L(
      'naftali',
      'נקי! היד שלו עצרה. גם שליח מהיר יודע מתי לעמוד במקום.',
      'Clean! His hand has stopped. Even a fast courier knows when to stand his ground.',
    ),
    L(
      'ezra',
      'יפה. מה שנמחק נכתב שוב. מחיקה היא לא סוף, רק שורה שמחכה.',
      'Good. What was erased is written again. Erasing is not an end, only a line that waits.',
    ),
  ],
  slip: [
    L(
      'ezra',
      'טעות היא לא מחיקה. תקן והמשך. אות איטית וכתובה היטב.',
      'A slip is not an erasure. Mend it and go on. A slow letter, written well.',
    ),
  ],
  combo: [
    L(
      'naftali',
      'זה כבר מהיר. אל תספר לאף אחד שאמרתי.',
      'Now that is fast. Do not tell anyone I said so.',
    ),
  ],
  failed: [
    L(
      'ezra',
      'נוח רגע. הדף יחכה, והוא לא הולך לשום מקום. גם אנחנו לא.',
      'Rest a moment. The page will wait; it is not going anywhere. Neither are we.',
    ),
  ],
  special: [
    L(
      'naftali',
      'הוא מוחק מהסוף! אל תסתכל על היד שלו, רק על המילה הבאה. רוץ!',
      'He is erasing from the end! Do not watch his hand, only the next word. Run!',
    ),
  ],
};

/** A line for a moment (`n` picks among alternatives, so the allies take turns). */
export function scrollLine(moment: ScrollMoment, n = 0): Line {
  const set = SCROLL_LINES[moment];
  return set[n % set.length] as Line;
}

/** The names on the health bar: the scroll while crossing it, then the Keeper. */
export const SCROLL_NAMES: Readonly<Record<'scroll' | 'keeper', Localized>> = {
  scroll: { he: 'המגילה הריקה', en: 'The Blank Scroll' },
  keeper: { he: 'שומר הארכיון הגדול', en: 'The Keeper of the Great Archive' },
};

/** The card that closes the ending. */
export const THE_END: Localized = { he: 'סוף, והתחלה', en: 'The End, and a Beginning' };

/**
 * The ending. Cues the scene knows: `still` (the Keeper's hand stops, the last line holds),
 * `offer` (the apprentice walks up and holds out the quill), `quill` (the Keeper takes it),
 * `write` (he writes: the great page fills with gold), `restore` (color rolls back over the
 * whole scroll and the shelves fill with books), `sky`, `gather`, `card`. Shots: `keeper`,
 * `page`, `two`, `allies`, `wide`.
 */
export const SCROLL_ENDING: Cutscene = {
  id: 'scroll-ending',
  title: { he: 'המגילה נכתבה', en: 'The scroll is written' },
  beats: [
    { id: 'still', shot: 'keeper', cue: 'still', seconds: 2.6 },
    {
      id: 'held',
      shot: 'page',
      say: L(
        'narrator',
        'השורה האחרונה עמדה על הדף, והיד של השומר לא עלתה למחוק אותה.',
        'The last line stood on the page, and the Keeper’s hand did not rise to wipe it away.',
      ),
      seconds: 3,
    },
    {
      id: 'mine',
      shot: 'keeper',
      say: L(
        'keeper',
        'אלה המילים שלי. הייתי בטוח שנשרפו. ואתה כתבת אותן מהמקום שבו הפלתי אותן.',
        'Those are my words. I was sure they had burned. And you wrote them from the place where I let them fall.',
      ),
      seconds: 3,
    },
    {
      id: 'why',
      shot: 'keeper',
      say: L(
        'keeper',
        'רציתי רק לחסוך מהארץ את הצער הזה. חשבתי: מה שלא נכתב לעולם לא יאבד.',
        'I only wanted to spare the land this grief. I thought: what is never written can never be lost.',
      ),
      seconds: 3,
    },
    {
      id: 'ezra',
      shot: 'allies',
      cue: 'gather',
      say: L(
        'ezra',
        'דף יכול להישרף, חבר ותיק. בדיוק בגלל זה כותבים אותו שוב, ומלמדים מישהו צעיר לכתוב אותו אחרינו.',
        'A page can burn, old friend. That is exactly why we write it again, and teach someone younger to write it after us.',
      ),
      seconds: 3,
    },
    {
      id: 'offer',
      shot: 'two',
      cue: 'offer',
      say: L(
        'narrator',
        'החניך הושיט לו את הקולמוס. הוא כותב רק מה שהאצבעות יודעות באמת. והאצבעות של השומר זכרו.',
        'The apprentice held out the quill. It writes only what the fingers truly know. And the Keeper’s fingers remembered.',
      ),
      seconds: 3.2,
    },
    { id: 'quill', shot: 'two', cue: 'quill', act: { keeper: 'cheer' }, seconds: 2.2 },
    { id: 'write', shot: 'page', cue: 'write', act: { keeper: 'write' }, seconds: 3.4 },
    {
      id: 'restore',
      shot: 'wide',
      cue: 'restore',
      say: L(
        'narrator',
        'ובכל ארץ האותיות, כל שלט נזכר בשמו.',
        'And all across the Land of Letters, every sign remembered its name.',
      ),
      seconds: 3.4,
    },
    {
      id: 'naftali',
      shot: 'allies',
      cue: 'sky',
      act: { naftali: 'cheer' },
      say: L(
        'naftali',
        'רצתי לאורך כל הארץ כדי לראות אנשים כותבים. טוב, היה שווה. מי מגיע ראשון הביתה?',
        'I ran the whole length of the land to watch people write. Fine. It was worth it. Race you home?',
      ),
      seconds: 2.6,
    },
    {
      id: 'dyo',
      shot: 'allies',
      act: { dyo: 'cheer' },
      say: L(
        'dyo',
        'הביתה! ואף אחד לא מזכיר יותר נייר סופג. אף פעם.',
        'Home! And nobody mentions blotting paper again. Ever.',
      ),
      seconds: 2.4,
    },
    {
      id: 'ahead',
      shot: 'two',
      say: L(
        'ezra',
        'ארבעים שנה דלק השלט מעל הדלת שלי. מהלילה, אתה שומר עליו דולק. לך לפניי. אני אבוא אחריך.',
        'Forty years that sign burned over my door. From tonight, you keep it lit. Go on ahead of me. I will follow.',
      ),
      seconds: 3,
    },
    {
      id: 'keeper',
      shot: 'keeper',
      act: { keeper: 'write' },
      say: L(
        'keeper',
        'השאירו לי קולמוס. יש לי שישים שנה לכתוב מחדש. והפעם, לא אכתוב לבד.',
        'Leave me a quill. I have sixty years to write again. And this time, I will not write alone.',
      ),
      seconds: 3,
    },
    { id: 'card', shot: 'wide', cue: 'card', seconds: 4.2 },
  ],
};
