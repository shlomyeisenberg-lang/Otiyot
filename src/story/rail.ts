// What Reb Ezra, Dyo and Naftali say on the Jaffa Line (T19): the race, boost, the bends, and the
// small things that happen on the way. Short lines, never in the way of the typing. Every speaker
// is male or Dyo (ARCHITECTURE section 8). Pure data plus one chooser.

import type { Line, Speaker } from './types';

export type RailMoment =
  | 'arrive'
  | 'returning'
  | 'coast'
  | 'plain'
  | 'hills'
  | 'bend'
  | 'skid'
  | 'slip'
  | 'combo'
  | 'lamp'
  | 'done'
  | 'beaten'
  | 'failed';

const L = (who: Speaker, he: string, en: string): Line => ({ who, text: { he, en } });

export const RAIL_LINES: Readonly<Record<RailMoment, readonly Line[]>> = {
  arrive: [
    L(
      'ezra',
      'קו יפו. הקטר עומד אפור והפנסים כבויים, ונפתלי כבר מחכה על המסילה השנייה. כאן ההקלדה היא הקיטור.',
      'The Jaffa Line. The engine stands grey and the lamps are out, and Naftali is already waiting on the next track. Here the typing is the steam.',
    ),
    L(
      'naftali',
      'אתה מתכוון להתחרות בי? תן לאצבעות שלך לרוץ, שוליה.',
      'You mean to race me? Let your fingers run, apprentice.',
    ),
  ],
  returning: [
    L(
      'ezra',
      'שוב על המסילה. הפעם נסה להיכנס לכל עיקול עם קיטור מלא.',
      'Back on the line. This time try to enter every bend with full steam.',
    ),
    L('naftali', 'עוד מרוץ? אני מוכן.', 'Another race? I am ready.'),
  ],
  coast: [
    L(
      'ezra',
      'כל קטע מסילה הוא מילה אחת. מילה נקייה ממלאת את הדוד בקיטור, וקיטור נושא את הרכבת דרך העיקול.',
      'Every stretch of track is one word. A clean word fills the boiler with steam, and steam carries the train through the bend.',
    ),
  ],
  plain: [
    L(
      'ezra',
      'אחרי כל שלושה קטעים בא עיקול. בלי מספיק קיטור הרכבת מאטה ונפתלי מתקרב.',
      'A bend comes after every third stretch. Without enough steam the train slows and Naftali gains.',
    ),
  ],
  hills: [
    L(
      'ezra',
      'הגבעות כבר לפנינו. עוד כמה קטעים והקו כולו יחזור לצבעיו.',
      'The hills are ahead. A few more stretches and the whole line will have its colors back.',
    ),
  ],
  bend: [
    L('dyo', 'עיקול מלא קיטור! נפתלי נשאר מאחור!', 'A bend at full steam! Naftali is left behind!'),
    L(
      'naftali',
      'לא רע בכלל. אבל המסילה עוד ארוכה.',
      'Not bad at all. But the line is still long.',
    ),
  ],
  skid: [
    L(
      'naftali',
      'עיקול איטי, שוליה! תודה על המקום.',
      'A slow bend, apprentice! Thanks for the room.',
    ),
    L(
      'ezra',
      'קיטור לא נבנה מטעויות. כמה מילים נקיות ברצף והרכבת תחזור.',
      'Steam is not made of slips. A few clean words in a row and the train will be back.',
    ),
  ],
  slip: [
    L(
      'ezra',
      'טעות לוקחת חלק מהקיטור, אבל הקטע עדיין שלך. נשימה, ושוב.',
      'A slip takes some of the steam, but the stretch is still yours. Breathe, and go on.',
    ),
  ],
  combo: [
    L(
      'dyo',
      'הקטר שורק! האצבעות שלך מהירות יותר מהגלגלים.',
      'The engine is whistling! Your fingers are faster than the wheels.',
    ),
  ],
  lamp: [
    L(
      'dyo',
      'פנס תחנה נדלק לצד המסילה! הקו מתעורר.',
      'A station lamp lit up beside the track! The line is waking.',
    ),
    L(
      'ezra',
      'עוד אור על הקו. האותיות מחזירות את הצבעים.',
      'More light on the line. The letters are bringing the colors back.',
    ),
  ],
  done: [
    L(
      'ezra',
      'הקו כולו באור והנוף חזר לצבעיו. הגעת לגבעות עם הקיטור שלך.',
      'The whole line glows and the land has its colors back. You reached the hills on your own steam.',
    ),
    L(
      'naftali',
      'ניצחת אותי הפעם, שוליה. עוד נתחרה.',
      'You beat me this time, apprentice. We will race again.',
    ),
  ],
  beaten: [
    L(
      'ezra',
      'הקו כולו באור, גם אם נפתלי הקדים אותך. המסילה שלך, וגם המרוץ הבא.',
      'The whole line glows, even if Naftali came in first. The track is yours, and so is the next race.',
    ),
    L(
      'naftali',
      'הקדמתי אותך הפעם! נסה שוב, ואל תאט בעיקולים.',
      'I was ahead this time! Try again, and do not slow in the bends.',
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
export function railLine(moment: RailMoment, n: number): Line {
  const lines = RAIL_LINES[moment];
  return lines[Math.abs(Math.floor(n)) % lines.length] as Line;
}
