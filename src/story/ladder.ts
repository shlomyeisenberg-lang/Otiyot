// What Reb Ezra and Dyo say on the Ladder (T28): the tower of letters that rises through the
// clouds, free play with no end. Reb Ezra calls up from the landings below; Dyo flies beside the
// climber and catches him once when his hands give out. Every floor is a small challenge from the
// other regions (the gale, the cloud, the glass rungs, the long words, the Blots). Cheerful and
// a little breathless, never frightening: a fall is a soft landing on the clouds. Every speaker is
// male or Dyo (ARCHITECTURE section 8). Pure data plus one chooser.

import type { Line, Speaker } from './types';

export type LadderMoment =
  | 'arrive'
  | 'returning'
  | 'gale'
  | 'lantern'
  | 'glass'
  | 'long'
  | 'swarm'
  | 'landing'
  | 'tighten'
  | 'caught'
  | 'slip'
  | 'combo'
  | 'high'
  | 'fall'
  | 'rest'
  | 'record';

const L = (who: Speaker, he: string, en: string): Line => ({ who, text: { he, en } });

export const LADDER_LINES: Readonly<Record<LadderMoment, readonly Line[]>> = {
  arrive: [
    L(
      'ezra',
      'הסולם. מגדל של אותיות שעולה מעל העננים, ואין לו סוף. כל קומה היא אתגר קטן. עלה כמה שתוכל.',
      'The Ladder. A tower of letters rising above the clouds, and it has no top. Every floor is a small challenge. Climb as high as you can.',
    ),
    L(
      'dyo',
      'אני עף לידך כל הדרך למעלה. ואם הידיים שלך יתעייפו, אני אתפוס אותך. פעם אחת!',
      'I will fly beside you all the way up. And if your hands get tired, I will catch you. Once!',
    ),
  ],
  returning: [
    L(
      'ezra',
      'שוב לסולם? יפה. הפעם קומה אחת יותר מהשיא שלך.',
      'Back to the Ladder? Good. This time, one floor higher than your best.',
    ),
    L(
      'dyo',
      'העננים זוכרים אותך. גם אני. בוא נעלה!',
      'The clouds remember you. So do I. Up we go!',
    ),
  ],
  gale: [
    L(
      'ezra',
      'רוח מהחרמון! היא מושכת בגלימה. אחוז חזק: כל אות נכונה מחזקת את האחיזה.',
      'A wind off Hermon! It tugs at your robe. Hold tight: every right letter firms your grip.',
    ),
  ],
  lantern: [
    L(
      'dyo',
      'ענן בלע את המגדל! אני לא רואה את המילה הבאה. גם אתה לא. אחת אחת.',
      'A cloud swallowed the tower! I cannot see the next word. Neither can you. One at a time.',
    ),
  ],
  glass: [
    L(
      'ezra',
      'שלבי זכוכית. יפים ושבירים. טעות כאן עולה כפול, וקומה נקייה שווה כפול.',
      'Glass rungs. Beautiful and brittle. A slip here costs double, and a clean floor is worth double.',
    ),
  ],
  long: [
    L(
      'ezra',
      'כאן המילים ארוכות, כמו המסילה ליפו. נשימה, ואות אחרי אות.',
      'The words are long here, like the line to Jaffa. A breath, and letter after letter.',
    ),
  ],
  swarm: [
    L(
      'dyo',
      'כתמים נדבקו לשלבים! כל מילה מעיפה אחד. קדימה!',
      'Blots are stuck on the rungs! Every word knocks one off. Go!',
    ),
  ],
  landing: [
    L(
      'ezra',
      'מדרגה! כאן נחים. הידיים מתמלאות כוח. אפשר לנוח כאן ולשמור את הגובה, או להמשיך לטפס.',
      'A landing! Here one rests. Your hands are strong again. You can rest here and keep your height, or climb on.',
    ),
    L(
      'dyo',
      'עוד מדרגה! מכאן העננים נראים כמו צמר. ממשיכים?',
      'Another landing! From here the clouds look like wool. Climbing on?',
    ),
  ],
  tighten: [
    L(
      'dyo',
      'רצף נקי! האחיזה שלך חזקה כמו של סופר אמיתי.',
      'A clean streak! Your grip is as firm as a real scribe’s.',
    ),
  ],
  caught: [
    L(
      'dyo',
      'תפסתי אותך! אוף, אתה כבד. זו הייתה התפיסה היחידה, אז אחוז טוב.',
      'Caught you! Oof, you are heavy. That was my only catch, so hold on well.',
    ),
  ],
  slip: [
    L(
      'ezra',
      'השלב רעד. לא נורא. האט קצת, והאחיזה תחזור.',
      'The rung shook. No harm. Slow down a little, and the grip comes back.',
    ),
  ],
  combo: [
    L(
      'dyo',
      'אתה עולה כל כך מהר שאני בקושי עומד בקצב!',
      'You are climbing so fast I can hardly keep up!',
    ),
  ],
  high: [
    L(
      'ezra',
      'כל כך גבוה! מכאן רואים את הבית, את ההר ואת הים.',
      'So high! From here one can see the house, the mountain and the sea.',
    ),
    L(
      'dyo',
      'הכוכבים קרובים מכאן. עוד קצת ואני נוגע באחד.',
      'The stars are close from here. A little more and I can touch one.',
    ),
  ],
  fall: [
    L(
      'ezra',
      'הידיים נחלשו, ונחתת רך על העננים. הגובה שלך נשמר בטבלה. ננסה שוב?',
      'Your hands gave out, and you landed softly on the clouds. Your height is kept in the table. Again?',
    ),
  ],
  rest: [
    L(
      'ezra',
      'נחת על המדרגה. טיפוס טוב. הגובה שלך נשמר בטבלה.',
      'A rest on the landing. A good climb. Your height is kept in the table.',
    ),
  ],
  record: [
    L(
      'dyo',
      'שיא חדש! הסולם יזכור את הטיפוס הזה.',
      'A new best! The Ladder will remember this climb.',
    ),
  ],
};

/** One line for a moment; `n` picks among the choices (a counter or a random number). */
export function ladderLine(moment: LadderMoment, n: number): Line {
  const lines = LADDER_LINES[moment];
  return lines[Math.abs(Math.floor(n)) % lines.length] as Line;
}
