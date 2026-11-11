// What Reb Ezra and Dyo say in the Home Row Meadow (T14): the lesson on hand placement, the
// lookahead, the streak, and the small things that happen on the way (a slip, the first bird,
// the almond tree). Short lines, never in the way of the typing. Every speaker is male or Dyo
// (ARCHITECTURE section 8). Pure data plus one chooser.

import type { Line, Speaker } from './types';

export type MeadowMoment =
  | 'arrive'
  | 'returning'
  | 'hands'
  | 'handsTip'
  | 'look'
  | 'flow'
  | 'slip'
  | 'combo'
  | 'birds'
  | 'birdsAgain'
  | 'tree'
  | 'skip'
  | 'done'
  | 'failed';

const L = (who: Speaker, he: string, en: string): Line => ({ who, text: { he, en } });

export const MEADOW_LINES: Readonly<Record<MeadowMoment, readonly Line[]>> = {
  arrive: [
    L(
      'ezra',
      'כאן היה אחו הכלניות. השכחה לקחה ממנו את הצבע. נחזיר אותו, אות אחר אות.',
      'This was the anemone meadow. The Fading took its color. We will give it back, one letter at a time.',
    ),
  ],
  returning: [
    L(
      'ezra',
      'חזרת לאחו. טוב. גם סופר ותיק חוזר כל בוקר לשורת הבית.',
      'Back in the meadow. Good. Even an old scribe returns to the home row every morning.',
    ),
    L(
      'dyo',
      'שוב הפרחים! הפעם נספור כמה ברצף, טוב?',
      'The flowers again! This time let us count how many in a row, all right?',
    ),
  ],
  hands: [
    L(
      'ezra',
      'הנח את האצבעות על שורת הבית. מרגיש שתי בליטות קטנות? שם גרות האצבעות המורות. שמונה ערוגות, שמונה אצבעות.',
      'Rest your fingers on the home row. Feel the two small bumps? Your pointing fingers live there. Eight beds, eight fingers.',
    ),
  ],
  handsTip: [
    L(
      'ezra',
      'העיניים על המילה, לא על הידיים. המקלדת שלמטה מראה איזו אצבע, והערוגה שלה מאירה.',
      'Eyes on the word, not on your hands. The keyboard below shows the finger, and its bed lights up.',
    ),
  ],
  look: [
    L(
      'ezra',
      'יפה. עכשיו מילים. בזמן שהאצבעות גומרות מילה אחת, העיניים כבר קוראות את הבאה.',
      'Good. Now words. While your fingers finish one word, let your eyes read the next.',
    ),
  ],
  flow: [
    L(
      'ezra',
      'אל תמהר. מי שכותב בלי לטעות, הדיו שלו מזהיב. שמור על הרצף, והאחו ישיר.',
      'Do not hurry. Write without a slip and your ink turns to gold. Keep the streak, and the meadow will sing.',
    ),
  ],
  slip: [
    L(
      'ezra',
      'טעות איננה כתם. חוזרים לשורת הבית וממשיכים.',
      'A slip is not a stain. Come back to the home row and go on.',
    ),
    L(
      'dyo',
      'אופס! לא נורא, אפילו דיו נשפך לפעמים.',
      'Oops! Never mind, even ink spills sometimes.',
    ),
  ],
  combo: [
    L('dyo', 'עשר ברצף! תראה, הדיו נהיה תכלת!', 'Ten in a row! Look, the ink is turning blue!'),
  ],
  birds: [
    L(
      'dyo',
      'שומע? ציפור! היא חזרה כי הקלדת יפה.',
      'Hear that? A bird! It came back because you typed so nicely.',
    ),
  ],
  birdsAgain: [
    L(
      'ezra',
      'הציפורים זוכרות את השיר שלהן. גם האצבעות שלך יזכרו.',
      'The birds remember their song. Your fingers will remember too.',
    ),
  ],
  tree: [L('ezra', 'השקדייה. היא תמיד פורחת ראשונה.', 'The almond tree. It always blooms first.')],
  skip: [
    L(
      'dyo',
      'מדלגים על השיעור? טוב, ישר לפרחים!',
      'Skipping the lesson? Fine, straight to the flowers!',
    ),
  ],
  done: [
    L(
      'ezra',
      'האחו שוב פורח. האצבעות שלך כבר יודעות את הדרך הביתה.',
      'The meadow blooms again. Your fingers know the way home now.',
    ),
  ],
  failed: [
    L(
      'ezra',
      'מבחן הסופר אינו סולח על טעות. לאט יותר, ושוב.',
      'The Sofer’s Trial forgives no slip. Slower, and once more.',
    ),
  ],
};

/** One line for a moment; `n` picks among the choices (a counter or a random number). */
export function meadowLine(moment: MeadowMoment, n: number): Line {
  const lines = MEADOW_LINES[moment];
  return lines[Math.abs(Math.floor(n)) % lines.length] as Line;
}
