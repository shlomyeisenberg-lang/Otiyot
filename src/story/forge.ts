// What Reb Ezra and Dyo say in the Gematria Forge (T17): the fire and its safe band, the smith's
// letters, and the small things that happen on the way. Short lines, never in the way of the
// typing. Every speaker is male or Dyo (ARCHITECTURE section 8). Pure data plus one chooser.

import type { Line, Speaker } from './types';

export type ForgeMoment =
  | 'arrive'
  | 'returning'
  | 'stoke'
  | 'forge'
  | 'quench'
  | 'cold'
  | 'hot'
  | 'bright'
  | 'slip'
  | 'combo'
  | 'lamp'
  | 'done'
  | 'failed';

const L = (who: Speaker, he: string, en: string): Line => ({ who, text: { he, en } });

export const FORGE_LINES: Readonly<Record<ForgeMoment, readonly Line[]>> = {
  arrive: [
    L(
      'ezra',
      'הנפחייה שבתוך הגבעה. כאן כל אות קיבלה פעם מספר, והשכחה כיבתה את הכבשן. הנפח ממתין לך ליד הסדן.',
      'The smithy inside the hill. Here every letter once received a number, and the Fading put the furnace out. The smith is waiting for you at the anvil.',
    ),
  ],
  returning: [
    L(
      'ezra',
      'חזרת לכבשן. נסה הפעם להישאר באמצע, לא לרוץ ולא לעמוד.',
      'Back at the furnace. This time stay in the middle: do not rush and do not stand still.',
    ),
    L('dyo', 'האש חמה! אני נשאר ליד הדלת.', 'The fire is hot! I am staying by the door.'),
  ],
  stoke: [
    L(
      'ezra',
      'לכל אות יש ערך: אלף אחד, בית שתיים, יוד עשר. הקלד את הערך, והנפח יצוק את האות. כל מקש מחמם את האש.',
      'Every letter has a value: alef is one, bet is two, yod is ten. Type the value and the smith forges the letter. Every key warms the fire.',
    ),
  ],
  forge: [
    L(
      'ezra',
      'שמור על המחוג באמצע הסרגל הירוק. אש חלשה מעממת, אש חזקה מדי שורפת, ואף אחת מהן לא עוצרת אותך.',
      'Keep the needle in the green. A low fire dulls the letter, a high one scorches it, and neither stops you.',
    ),
  ],
  quench: [
    L(
      'ezra',
      'האותיות האחרונות. עוד מעט והכבשן יבער לבד.',
      'The last letters. Soon the furnace will burn on its own.',
    ),
  ],
  cold: [L('dyo', 'קר פה! הקש קצת יותר מהר.', 'It is cold in here! Type a little faster.')],
  hot: [L('dyo', 'אוי, הכל מתלהט! קצת יותר לאט.', 'Whoa, everything is glowing! A little slower.')],
  bright: [
    L(
      'dyo',
      'האות הזאת זוהרת כמו זהב! ככה בדיוק.',
      'That letter shines like gold! Exactly like that.',
    ),
  ],
  slip: [
    L(
      'ezra',
      'טעות מקפיצה את האש. נשימה, ושוב.',
      'A slip makes the fire jump. Breathe, and go on.',
    ),
  ],
  combo: [
    L(
      'dyo',
      'האש שרה! המספרים כבר בידיים שלך.',
      'The fire is singing! The numbers are already in your hands.',
    ),
  ],
  lamp: [
    L(
      'dyo',
      'מנורה נדלקה על המדף! הנפחייה מתעוררת.',
      'A lamp lit up on the rack! The smithy is waking.',
    ),
    L(
      'ezra',
      'עוד אור במערה. המספרים מחזירים את האותיות.',
      'More light in the cave. The numbers are bringing the letters back.',
    ),
  ],
  done: [
    L(
      'ezra',
      'הכבשן בוער, והאותיות מונחות על המדף. עכשיו אצבעותיך מכירות גם את שורת המספרים.',
      'The furnace burns and the letters rest on the rack. Now your fingers know the number row too.',
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
export function forgeLine(moment: ForgeMoment, n: number): Line {
  const lines = FORGE_LINES[moment];
  return lines[Math.abs(Math.floor(n)) % lines.length] as Line;
}
