// What Reb Ezra and Dyo say at the Cliffs of Ein Gedi (T15): the reach up and the reach down,
// the waterfalls, the ibex, and the small things that happen on the way. Short lines, never in
// the way of the typing. Every speaker is male or Dyo (ARCHITECTURE section 8). Pure data plus
// one chooser.

import type { Line, Speaker } from './types';

export type CliffsMoment =
  | 'arrive'
  | 'returning'
  | 'ledge'
  | 'canyon'
  | 'summit'
  | 'reachUp'
  | 'reachDown'
  | 'slip'
  | 'combo'
  | 'fall'
  | 'fallAgain'
  | 'ibex'
  | 'done'
  | 'failed';

const L = (who: Speaker, he: string, en: string): Line => ({ who, text: { he, en } });

export const CLIFFS_LINES: Readonly<Record<CliffsMoment, readonly Line[]>> = {
  arrive: [
    L(
      'ezra',
      'עין גדי. כאן היו המפלים שרים. השכחה עצרה אותם. אני מחכה לך בפסגה, אבן אחר אבן.',
      'Ein Gedi. The waterfalls used to sing here until the Fading stopped them. I will wait for you at the summit, one stone at a time.',
    ),
  ],
  returning: [
    L(
      'ezra',
      'חזרת לצוקים. הפעם נסה לא להסתכל על הידיים בכלל.',
      'Back on the cliffs. This time try not to look at your hands at all.',
    ),
    L('dyo', 'המפלים מחכים! קדימה, לפסגה!', 'The waterfalls are waiting! On to the summit!'),
  ],
  ledge: [
    L(
      'ezra',
      'כל מילה היא אבן. אות מהשורה העליונה פירושה למתוח את האצבע למעלה, ואות מהשורה התחתונה למטה. ואז חוזרים הביתה.',
      'Every word is a stone. A letter from the top row means stretching a finger up, from the bottom row, down. Then straight back home.',
    ),
  ],
  canyon: [
    L(
      'ezra',
      'באמצע התעלה אל תמהר. מי שמזנק בלי להסתכל, נופל לנחל.',
      'Mid-canyon, do not hurry. Whoever leaps without looking falls into the stream.',
    ),
  ],
  summit: [
    L(
      'ezra',
      'כמעט שם. עוד כמה אבנים, ואני כבר רואה אותך מכאן.',
      'Almost there. A few more stones, and I can already see you from here.',
    ),
  ],
  reachUp: [
    L(
      'ezra',
      'האבן הבאה גבוהה יותר. האצבע שלך מושיטה למעלה, והיד נשארת במקומה.',
      'The next stone stands higher. Your finger reaches up, and your hand stays where it is.',
    ),
  ],
  reachDown: [
    L(
      'ezra',
      'האבן הבאה נמוכה יותר. האצבע יורדת לשורה התחתונה ומיד חוזרת.',
      'The next stone is lower. Your finger dips to the bottom row and returns at once.',
    ),
  ],
  slip: [
    L(
      'ezra',
      'טעות איננה נפילה. חוזרים לשורת הבית וממשיכים.',
      'A slip is not a fall. Back to the home row, and go on.',
    ),
    L('dyo', 'אופס! האבן עדיין כאן. נסה שוב.', 'Oops! The stone is still here. Try again.'),
  ],
  combo: [L('dyo', 'עשר ברצף! תראה איך הדיו זוהר!', 'Ten in a row! Look how the ink glows!')],
  fall: [
    L(
      'dyo',
      'שומע? המים! המפל הראשון חזר לזרום!',
      'Do you hear that? Water! The first waterfall is flowing again!',
    ),
  ],
  fallAgain: [
    L(
      'ezra',
      'עוד מפל מתעורר. המים זוכרים את דרכם, כמו האצבעות שלך.',
      'Another waterfall wakes. The water remembers its way, like your fingers.',
    ),
  ],
  ibex: [
    L(
      'dyo',
      'יעל! שם, על הסלע! הוא חזר כי המים חזרו.',
      'An ibex! There, on the rock! It came back because the water did.',
    ),
  ],
  done: [
    L(
      'ezra',
      'הצוקים שוב מזהירים. אצבעותיך כבר יודעות להגיע למעלה ולמטה ולחזור הביתה.',
      'The cliffs shine again. Your fingers know how to reach up, reach down and come home.',
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
export function cliffsLine(moment: CliffsMoment, n: number): Line {
  const lines = CLIFFS_LINES[moment];
  return lines[Math.abs(Math.floor(n)) % lines.length] as Line;
}
