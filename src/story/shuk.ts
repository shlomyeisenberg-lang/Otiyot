// What Reb Ezra and Dyo say in the Night Shuk (T18): trades, marks as coins, the haggle, and the
// small things that happen on the way. Short lines, never in the way of the typing. Every speaker
// is male or Dyo (ARCHITECTURE section 8). Pure data plus one chooser.

import type { Line, Speaker } from './types';

export type ShukMoment =
  | 'arrive'
  | 'returning'
  | 'lane'
  | 'bazaar'
  | 'square'
  | 'coin'
  | 'haggle'
  | 'slip'
  | 'combo'
  | 'lantern'
  | 'done'
  | 'failed';

const L = (who: Speaker, he: string, en: string): Line => ({ who, text: { he, en } });

export const SHUK_LINES: Readonly<Record<ShukMoment, readonly Line[]>> = {
  arrive: [
    L(
      'ezra',
      'השוק בלילה. הפנסים כבו והבדים אפורים, אבל הסוחרים עדיין מחכים לעסקה טובה. כאן הסימנים הם המטבעות.',
      'The market at night. The lanterns are out and the cloth is grey, but the merchants still wait for a good deal. Here the marks are the coins.',
    ),
  ],
  returning: [
    L(
      'ezra',
      'חזרת לשוק. נסה הפעם לסגור עסקאות נקיות, בלי טעות.',
      'Back in the market. This time try to close clean deals, without a slip.',
    ),
    L('dyo', 'שוב הפנסים! אני שומר לך על הארנק.', 'Lanterns again! I will watch your purse.'),
  ],
  lane: [
    L(
      'ezra',
      'כל דוכן הוא עסקה אחת: המילה שעל השלט. נקודה, פסיק או סימן אחר בסוף המילה הם מטבע נוסף בארנק.',
      'Every stall is one trade: the word on the banner. A period, a comma or another mark at the end of the word is one more coin for your purse.',
    ),
  ],
  bazaar: [
    L(
      'ezra',
      'שלוש עסקאות נקיות ברצף הן מיקוח מנצח, והסימנים נספרים כפול. הסוחרים כבר מתחילים לדבר מהר.',
      'Three clean deals in a row win a haggle, and the marks count double. The merchants are starting to talk fast.',
    ),
  ],
  square: [
    L(
      'ezra',
      'הדוכנים האחרונים. עוד מעט כל השוק יאיר.',
      'The last stalls. Soon the whole market will glow.',
    ),
  ],
  coin: [L('dyo', 'מטבע! הוא קפץ היישר לארנק שלך.', 'A coin! It jumped straight into your purse.')],
  haggle: [
    L('dyo', 'מיקוח מנצח! הסוחר מחייך.', 'A haggle won! The merchant is smiling.'),
    L(
      'ezra',
      'עסקאות נקיות ברצף. ככה סוחרים בשוק.',
      'Clean deals in a row. That is how one trades in the shuk.',
    ),
  ],
  slip: [
    L(
      'ezra',
      'טעות שוברת את הרצף, אבל העסקה עדיין שלך. נשימה, ושוב.',
      'A slip breaks the streak, but the deal is still yours. Breathe, and go on.',
    ),
  ],
  combo: [
    L(
      'dyo',
      'כולם מסתכלים עליך! האצבעות שלך מדברות מהר מהסוחרים.',
      'Everyone is watching you! Your fingers talk faster than the merchants.',
    ),
  ],
  lantern: [
    L(
      'dyo',
      'פנס גדול נדלק מעל הכיכר! השוק מתעורר.',
      'A big lantern lit up over the square! The market is waking.',
    ),
    L(
      'ezra',
      'עוד אור בכיכר. הסימנים מחזירים את הצבעים.',
      'More light in the square. The marks are bringing the colors back.',
    ),
  ],
  done: [
    L(
      'ezra',
      'השוק בוער באור והבדים חזרו לצבעיהם. עכשיו אצבעותיך מכירות גם את הסימנים.',
      'The market glows and the cloth has its colors back. Now your fingers know the marks too.',
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
export function shukLine(moment: ShukMoment, n: number): Line {
  const lines = SHUK_LINES[moment];
  return lines[Math.abs(Math.floor(n)) % lines.length] as Line;
}
