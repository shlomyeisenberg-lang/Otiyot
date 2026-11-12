// What Reb Ezra and Dyo say in the Sunken Geniza (T20): the tide, the current, the silt, the
// shafts of light, and the small things that happen on the way. Short lines, never in the way of
// the typing. Every speaker is male or Dyo (ARCHITECTURE section 8). Pure data plus one chooser.

import type { Line, Speaker } from './types';

export type GenizaMoment =
  | 'arrive'
  | 'returning'
  | 'shallows'
  | 'stacks'
  | 'vault'
  | 'whole'
  | 'silt'
  | 'slip'
  | 'combo'
  | 'shaft'
  | 'done'
  | 'failed';

const L = (who: Speaker, he: string, en: string): Line => ({ who, text: { he, en } });

export const GENIZA_LINES: Readonly<Record<GenizaMoment, readonly Line[]>> = {
  arrive: [
    L(
      'ezra',
      'הגניזה הטבועה. כאן נחו הדפים הישנים, ועכשיו המים כיסו את האולם והכול אפור. המים נעים בגאות, והגאות הולכת לפי הקצב שלך.',
      'The Sunken Geniza. The old pages were laid to rest here; now the water fills the hall and all of it is grey. The water moves with a tide, and the tide follows your beat.',
    ),
    L(
      'dyo',
      'בועות! אני דיו, לא דג. אבל אני אשחה איתך.',
      'Bubbles! I am ink, not a fish. But I will swim with you.',
    ),
  ],
  returning: [
    L(
      'ezra',
      'שוב באולם השקט. הפעם הקלד בקצב אחיד מההתחלה ועד הסוף.',
      'Back in the quiet hall. This time keep an even beat from the first page to the last.',
    ),
  ],
  shallows: [
    L(
      'ezra',
      'כל דף הוא מילה אחת. הקלד בקצב שווה, כמו גלים, והזרם ישא את הדף אל האור. לא מהר, אלא אחיד.',
      'Every page is one word. Type at an even beat, like waves, and the current carries the page up to the light. Not fast: even.',
    ),
  ],
  stacks: [
    L(
      'ezra',
      'בין המדפים. הטבעת סביב הדוכן נושמת עם הגאות. תן לאצבעות ללכת איתה.',
      'Among the shelves. The ring around the lectern breathes with the tide. Let your fingers go with it.',
    ),
  ],
  vault: [
    L(
      'ezra',
      'המרתף העמוק. עוד כמה דפים והאולם כולו יחזור לצבעיו.',
      'The deep vault. A few more pages and the whole hall will have its colors back.',
    ),
  ],
  whole: [
    L(
      'dyo',
      'הדף עלה שלם, זהוב! הזרם נשא אותו עד למעלה!',
      'The page rose whole, all gold! The current carried it right up!',
    ),
    L(
      'ezra',
      'כך. קצב אחיד פותח את הזרם, והזרם מרים את הדפים.',
      'Like that. An even beat opens the current, and the current lifts the pages.',
    ),
  ],
  silt: [
    L(
      'ezra',
      'פרץ של מקשים מעלה את הבוץ מהקרקעית. לאט יותר ובאותו קצב, והמים יתבהרו.',
      'A rush of keys stirs the silt from the floor. Slower and at the same beat, and the water will clear.',
    ),
  ],
  slip: [
    L(
      'ezra',
      'טעות לא מטביעה את הדף, רק מחלישה את הזרם. נשימה, ושוב בקצב.',
      'A slip does not sink the page; it only weakens the current. Breathe, and back to the beat.',
    ),
  ],
  combo: [
    L(
      'dyo',
      'אתה והגאות זזים יחד! המים כמעט שרים.',
      'You and the tide are moving together! The water is almost singing.',
    ),
  ],
  shaft: [
    L(
      'dyo',
      'עמוד אור ירד מלמעלה! אפשר לראות את פני המים!',
      'A shaft of light came down from above! I can see the surface!',
    ),
    L(
      'ezra',
      'עוד אור באולם. הדפים מחזירים את הצבעים.',
      'More light in the hall. The pages are bringing the colors back.',
    ),
  ],
  done: [
    L(
      'ezra',
      'כל הדפים עלו אל האור והאולם חזר לצבעיו. הגאות שלך הייתה יציבה.',
      'Every page has risen to the light and the hall has its colors back. Your tide held steady.',
    ),
    L(
      'dyo',
      'הדפים צפים למעלה כמו עלים זהובים! עכשיו אפשר לנשום.',
      'The pages float up there like golden leaves! Now we can breathe.',
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
export function genizaLine(moment: GenizaMoment, n: number): Line {
  const lines = GENIZA_LINES[moment];
  return lines[Math.abs(Math.floor(n)) % lines.length] as Line;
}
