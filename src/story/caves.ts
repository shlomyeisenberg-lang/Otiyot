// What Reb Ezra and Dyo say in the Lantern Caves (T25): the old chalk caves under the hills,
// the lantern that steady typing keeps alight, the shadows that gather when it dims, the niche
// lamps, and the Hall of Lamps at the end. Tense, never frightening: the shadows are only the
// Fading in the dark, and the light always wins. Reb Ezra walks a step behind with his staff;
// Dyo rides on the lantern's handle. Every speaker is male or Dyo (ARCHITECTURE section 8).
// Pure data plus one chooser.

import type { Line, Speaker } from './types';

export type CavesMoment =
  | 'arrive'
  | 'returning'
  | 'mouth'
  | 'galleries'
  | 'hall'
  | 'creep'
  | 'flare'
  | 'dim'
  | 'out'
  | 'lamp'
  | 'slip'
  | 'combo'
  | 'done'
  | 'failed';

const L = (who: Speaker, he: string, en: string): Line => ({ who, text: { he, en } });

export const CAVES_LINES: Readonly<Record<CavesMoment, readonly Line[]>> = {
  arrive: [
    L(
      'ezra',
      'מערות הגיר הישנות. כאן הסתירו הסופרים את הנרות שלהם. השכחה מילאה אותן בצללים. כל אות נכונה מזינה את הפנס, וצללים לא אוהבים אור.',
      'The old chalk caves. The scribes once hid their lamps down here. The Fading has filled them with shadows. Every right letter feeds the lantern, and shadows do not like light.',
    ),
    L(
      'dyo',
      'אני יושב על הידית של הפנס. חם פה. אני לא מפחד. אני רק קצת צמוד לפנס.',
      'I am sitting on the lantern handle. It is warm here. I am not scared. I am just staying close to the lantern.',
    ),
  ],
  returning: [
    L(
      'ezra',
      'שוב למערות. הפעם אל תמעד אפילו פעם אחת, והצללים לא יתקרבו בכלל.',
      'Back to the caves. This time do not stumble even once, and the shadows will never come near.',
    ),
  ],
  mouth: [
    L(
      'ezra',
      'פי המערה. לאט ובדיוק. כשהפנס בוער, המילים הבאות כתובות על הגיר לפניך.',
      'The mouth of the cave. Slowly and surely. While the lantern burns bright, the next words are written on the chalk ahead.',
    ),
  ],
  galleries: [
    L(
      'ezra',
      'המסדרונות העמוקים. כאן הצללים עבים יותר. דיוק לפני מהירות, תמיד.',
      'The deep galleries. The shadows are thicker here. Care before speed, always.',
    ),
  ],
  hall: [
    L(
      'ezra',
      'אני רואה את שער אולם הנרות. עוד מעבר אחד, ונדליק את כולם.',
      'I can see the gate of the Hall of Lamps. One more passage, and we light them all.',
    ),
  ],
  creep: [
    L(
      'dyo',
      'הצללים התקרבו צעד. אני חושב שהם שמעו את המעידה.',
      'The shadows came one step closer. I think they heard the stumble.',
    ),
    L(
      'ezra',
      'מעידה מעמעמת את האור, והצללים מתקרבים. נשום, וכתוב נכון.',
      'A stumble dims the light, and the shadows step in. Breathe, and write it right.',
    ),
  ],
  flare: [
    L(
      'dyo',
      'הפנס התלקח! הצללים קפצו אחורה. ככה! עוד!',
      'The lantern flared! The shadows jumped back. Like that! More!',
    ),
    L(
      'ezra',
      'רצף נקי, והאור גדל. הם לא יכולים לעמוד מול יד בטוחה.',
      'A clean streak, and the light grows. They cannot stand against a steady hand.',
    ),
  ],
  dim: [
    L(
      'ezra',
      'השמן נשרף לאט. אל תעצור הרבה זמן: אות אחר אות מזינה את הלהבה.',
      'The oil burns down slowly. Do not stop for long: letter by letter feeds the flame.',
    ),
  ],
  out: [
    L(
      'dyo',
      'האור כבה! רגע, רגע, הדלקנו שוב. הם רק נגעו בגלימה.',
      'The light went out! Wait, wait, we lit it again. They only brushed the robe.',
    ),
    L(
      'ezra',
      'אין דבר. הצללים נוגעים, אך אינם לוקחים. הפנס יבער עכשיו לאט יותר.',
      'No harm done. Shadows touch, but they take nothing. The lantern will burn slower now.',
    ),
  ],
  lamp: [
    L(
      'dyo',
      'נר בגומחה! הדלקנו אותו, והקיר חזר להיות לבן וזהוב.',
      'A lamp in the niche! We lit it, and the wall turned white and gold again.',
    ),
    L(
      'ezra',
      'עוד נר של הסופרים דולק. מלא את הפנס ממנו, ונמשיך.',
      'One more of the scribes’ lamps is burning. Fill the lantern from it, and we go on.',
    ),
  ],
  slip: [
    L(
      'ezra',
      'מעדת. אין בושה בכך. מחק, וכתוב בזהירות.',
      'A stumble. There is no shame in it. Undo it, and write with care.',
    ),
  ],
  combo: [
    L(
      'dyo',
      'כל כך הרבה אור! אני רואה את הצל של עצמי. הוא דווקא חמוד.',
      'So much light! I can see my own shadow. He is actually quite cute.',
    ),
  ],
  done: [
    L(
      'ezra',
      'אולם הנרות! כל הנרות דולקים, הגיר זוהר והמעיין נוצץ. הצללים נעלמו. מערות הפנסים חזרו לאור.',
      'The Hall of Lamps! Every lamp is burning, the chalk glows and the spring shines. The shadows are gone. The Lantern Caves have their light back.',
    ),
  ],
  failed: [
    L(
      'ezra',
      'מבחן הסופר אינו סולח על טעות. המערות יחכו לך. לאט יותר, ושוב.',
      'The Sofer’s Trial forgives no slip. The caves will wait for you. Slower, and once more.',
    ),
  ],
};

/** One line for a moment; `n` picks among the choices (a counter or a random number). */
export function cavesLine(moment: CavesMoment, n: number): Line {
  const lines = CAVES_LINES[moment];
  return lines[Math.abs(Math.floor(n)) % lines.length] as Line;
}
