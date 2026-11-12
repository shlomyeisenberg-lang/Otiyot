// What Reb Ezra and Dyo say in Atbash City (T23): the rain and the scrambled neon, the codes and
// the vault gates, the patrol drones and their searchlights, and the whole skyline lit at the end.
// Reb Ezra speaks from the old code-breakers' hall at the top of the street; Dyo rides along on
// the apprentice's shoulder under a little umbrella. Short lines, never in the way of the typing.
// Every speaker is male or Dyo (ARCHITECTURE section 8). Pure data plus one chooser.

import type { Line, Speaker } from './types';

export type AtbashMoment =
  | 'arrive'
  | 'returning'
  | 'market'
  | 'towers'
  | 'vault'
  | 'decoded'
  | 'patrol'
  | 'spotted'
  | 'unseen'
  | 'opened'
  | 'slip'
  | 'combo'
  | 'done'
  | 'failed';

const L = (who: Speaker, he: string, en: string): Line => ({ who, text: { he, en } });

export const ATBASH_LINES: Readonly<Record<AtbashMoment, readonly Line[]>> = {
  arrive: [
    L(
      'ezra',
      'ברוך הבא לעיר אתב״ש, עיר שוברי הצפנים. השכחה הפכה כל שלט באלף־בית הפוך: א׳ במקום ת׳, ב׳ במקום ש׳. כתוב את הקוד הנכון, והאותיות יחזרו לפניהן.',
      'Welcome to Atbash City, the city of code-breakers. The Forgetting has turned every sign to the backward alphabet: alef for tav, bet for shin, a for z. Type the true code, and the letters turn back to their faces.',
    ),
    L(
      'dyo',
      'גשם, ניאון ורחפנים! טוב שהבאתי מטרייה. היא קטנה, אבל גם אני.',
      'Rain, neon and drones! Good thing I brought an umbrella. It is small, but so am I.',
    ),
  ],
  returning: [
    L(
      'ezra',
      'שוב לעיר הצפנים. הפעם פתח כל שער לפני שהסיור חוזר.',
      'Back to the city of codes. This time open every gate before the patrol comes back.',
    ),
  ],
  market: [
    L(
      'ezra',
      'שוק הצפנים. השלט מעל השער מראה את הקוד הפוך. כל אות נכונה מחזירה אות אחת לפניה.',
      'The cipher market. The sign over the gate shows the code backward. Every right letter turns one letter back to its face.',
    ),
  ],
  towers: [
    L(
      'ezra',
      'בין המגדלים הסיורים מהירים יותר. שמור על קצב שקט, והם לא יראו אותך.',
      'Between the towers the patrols are quicker. Keep a quiet rhythm, and they will not see you.',
    ),
  ],
  vault: [
    L(
      'ezra',
      'הכספת הגדולה. כאן שמורים כל השלטים של העיר. עוד קוד ועוד רצף, והעיר תידלק כולה.',
      'The great vault. Every sign of the city is kept here. One more code and one more sequence, and the whole city will light up.',
    ),
  ],
  decoded: [
    L(
      'dyo',
      'השלט חזר! תראה איך הוא זוהר, ורוד וכחול בתוך הגשם!',
      'The sign is back! Look how it glows, pink and blue in the rain!',
    ),
    L(
      'ezra',
      'עכשיו המנעול: הוא מנגן רצף של שני קודים. כתוב אותו בחזרה בסדר הנכון, וכל טבעת תסתובב.',
      'Now the lock: it plays a sequence of two codes. Type it back in the right order, and each ring will turn.',
    ),
  ],
  patrol: [
    L(
      'dyo',
      'רחפן סיור! הוא יצא לסיבוב. מהר, לפני שהוא חוזר עם הפנס שלו!',
      'A patrol drone! It is off on its round. Quick, before it comes back with its searchlight!',
    ),
  ],
  spotted: [
    L(
      'dyo',
      'הוא ראה אותנו! לא נורא, הוא יצא לעוד סיבוב, ולאט יותר.',
      'It saw us! Never mind, it has gone round again, and slower.',
    ),
    L(
      'ezra',
      'האור מצא אותך. אל תמהר: אות אחר אות, והשער ייפתח.',
      'The light found you. Do not rush: letter after letter, and the gate will open.',
    ),
  ],
  unseen: [
    L(
      'ezra',
      'השער נפתח והסיור לא ראה דבר. כך עובדים שוברי צפנים.',
      'The gate is open and the patrol saw nothing. That is how code-breakers work.',
    ),
  ],
  opened: [
    L(
      'dyo',
      'הכספת נפתחה! והרחפן הפך לפנס זהב קטן. הוא חבר שלנו עכשיו.',
      'The vault is open! And the drone has turned into a little gold lantern. He is our friend now.',
    ),
    L(
      'ezra',
      'עוד רחוב חוזר לאור. המשך אל השער הבא.',
      'Another street comes back to light. On to the next gate.',
    ),
  ],
  slip: [
    L(
      'ezra',
      'טעות קטנה, והאות מהבהבת. נשום, ותקן בשקט.',
      'A small slip, and the letter flickers. Breathe, and set it right calmly.',
    ),
  ],
  combo: [
    L(
      'dyo',
      'השלטים נדלקים בקצב שלך! זה כמו מוזיקה!',
      'The signs are lighting up to your rhythm! It is like music!',
    ),
  ],
  done: [
    L(
      'ezra',
      'כל הצפנים נשברו. כל שלט בעיר מראה שוב את פניו האמיתיות, והגשם מבריק בכל הצבעים.',
      'Every code is broken. Every sign in the city shows its true face again, and the rain shines in every color.',
    ),
    L(
      'dyo',
      'כל העיר דולקת! ואני יכול לקרוא את כל השלטים. טוב, כמעט את כולם.',
      'The whole city is lit! And I can read every sign. Well, almost every one.',
    ),
  ],
  failed: [
    L(
      'ezra',
      'מבחן הסופר אינו סולח על טעות. העיר תחכה לך. לאט יותר, ושוב.',
      'The Sofer’s Trial forgives no slip. The city will wait for you. Slower, and once more.',
    ),
  ],
};

/** One line for a moment; `n` picks among the choices (a counter or a random number). */
export function atbashLine(moment: AtbashMoment, n: number): Line {
  const lines = ATBASH_LINES[moment];
  return lines[Math.abs(Math.floor(n)) % lines.length] as Line;
}
