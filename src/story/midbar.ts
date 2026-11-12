// What Reb Ezra and Dyo say in the Long Midbar (T24): the caravan road from well to well, the
// sandstorms that hide the markers, the gusts, and the oasis at the end. Reb Ezra walks with the
// caravan (he knows every well of the old road); Dyo rides on the lead camel's hump, under a
// little scarf against the sand. Short lines, never in the way of the typing. Every speaker is
// male or Dyo (ARCHITECTURE section 8). Pure data plus one chooser.

import type { Line, Speaker } from './types';

export type MidbarMoment =
  | 'arrive'
  | 'returning'
  | 'dunes'
  | 'wadi'
  | 'oasis'
  | 'storm'
  | 'gust'
  | 'buffet'
  | 'steady'
  | 'well'
  | 'slip'
  | 'combo'
  | 'done'
  | 'failed';

const L = (who: Speaker, he: string, en: string): Line => ({ who, text: { he, en } });

export const MIDBAR_LINES: Readonly<Record<MidbarMoment, readonly Line[]>> = {
  arrive: [
    L(
      'ezra',
      'זו דרך השיירות הישנה, מבאר לבאר עד הנווה של הסופרים. השכחה הפכה את החול לאפור ומעוררת סופות. כל משפט שתכתוב הוא צעד של השיירה.',
      'This is the old caravan road, from well to well, to the oasis of the scribes. The Forgetting has greyed the sand and stirs up storms. Every sentence you write is a step of the caravan.',
    ),
    L(
      'dyo',
      'אני רוכב על גמל! הוא קצת מתנדנד. אני קצת מתנדנד. אנחנו מתנדנדים יחד.',
      'I am riding a camel! He sways a little. I sway a little. We sway together.',
    ),
  ],
  returning: [
    L(
      'ezra',
      'שוב בדרך הארוכה. הפעם צעד בתוך כל משב, ואל תעצור.',
      'The long road again. This time walk through every gust, and do not stop.',
    ),
  ],
  dunes: [
    L(
      'ezra',
      'הדיונות. בשמיים בהירים קרא את האבנים שלפניך: המילים הבאות כתובות עליהן.',
      'The dunes. Under a clear sky, read the stones ahead of you: the next words are written on them.',
    ),
  ],
  wadi: [
    L(
      'ezra',
      'הוואדי היבש. כאן הסופות קשות יותר. כשאי אפשר לראות רחוק, כתוב רק את המילה שבידך.',
      'The dry wadi. The storms are harder here. When you cannot see far, write only the word in your hand.',
    ),
  ],
  oasis: [
    L(
      'ezra',
      'הנווה קרוב. אני כבר מריח את הדקלים. עוד סופה אחת, והשיירה בבית.',
      'The oasis is near. I can already smell the palms. One more storm, and the caravan is home.',
    ),
  ],
  storm: [
    L(
      'dyo',
      'סופה! אני לא רואה כלום! רגע, אני רואה חול. הרבה חול.',
      'A storm! I cannot see a thing! Wait, I can see sand. A lot of sand.',
    ),
    L(
      'ezra',
      'האבנים נעלמו בחול. אל תחפש את המילה הבאה. כתוב את זו, והבאה תבוא.',
      'The stones have gone into the sand. Do not look for the next word. Write this one, and the next will come.',
    ),
  ],
  gust: [
    L(
      'ezra',
      'משב רוח בא מן הדיונות. גמור את המילה לפני שהוא מגיע, והגמלים ימשיכו ללכת.',
      'A gust is coming from the dunes. Finish the word before it arrives, and the camels walk on.',
    ),
  ],
  buffet: [
    L(
      'dyo',
      'אוף! חול בעיניים! הגמל כרע. גם אני כרעתי.',
      'Oof! Sand in my eyes! The camel knelt down. So did I.',
    ),
    L(
      'ezra',
      'קום, קום. השיירה לא הולכת לאיבוד, היא רק עוצרת. המשב יחזור לאט יותר.',
      'Up, up. The caravan is not lost, it only stopped. The gust will come back slower.',
    ),
  ],
  steady: [
    L(
      'ezra',
      'יפה! הלכת דרך המשב ולא עצרת. כך עוברים מדבר.',
      'Well done! You walked through the gust and never stopped. That is how a desert is crossed.',
    ),
  ],
  well: [
    L(
      'dyo',
      'באר! מים! הגמלים שותים, והחול מסביב מקבל את צבעו בחזרה.',
      'A well! Water! The camels drink, and the sand around it gets its color back.',
    ),
    L(
      'ezra',
      'עוד באר על הדרך הישנה. נשתה, ונמשיך.',
      'One more well on the old road. We drink, and we go on.',
    ),
  ],
  slip: [
    L(
      'ezra',
      'מעדת? גם גמל מועד בחול. מחק את הטעות, וצעד הלאה.',
      'A stumble? Even a camel stumbles in sand. Undo the slip, and step on.',
    ),
  ],
  combo: [
    L(
      'dyo',
      'הגמלים צועדים בקצב! אני חושב שהם רוקדים.',
      'The camels are walking in rhythm! I think they are dancing.',
    ),
  ],
  done: [
    L(
      'ezra',
      'הנווה! הסופה שככה, הדקלים ירוקים והמים נוצצים. השיירה הגיעה. המדבר הארוך עבר.',
      'The oasis! The storm has died down, the palms are green and the water shines. The caravan has come home. The Long Midbar is crossed.',
    ),
  ],
  failed: [
    L(
      'ezra',
      'מבחן הסופר אינו סולח על טעות. הדרך תחכה לך. לאט יותר, ושוב.',
      'The Sofer’s Trial forgives no slip. The road will wait for you. Slower, and once more.',
    ),
  ],
};

/** One line for a moment; `n` picks among the choices (a counter or a random number). */
export function midbarLine(moment: MidbarMoment, n: number): Line {
  const lines = MIDBAR_LINES[moment];
  return lines[Math.abs(Math.floor(n)) % lines.length] as Line;
}
