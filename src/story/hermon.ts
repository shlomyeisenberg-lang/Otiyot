// What Reb Ezra and Dyo say on the flight over Hermon (T21): the eagle, the hail, the lightning
// that shows the next word, the storm breaking, and the small things that happen on the way.
// Reb Ezra sent the apprentice off from the ridge and calls after him; Dyo rides along on the
// eagle's neck. Short lines, never in the way of the typing. Every speaker is male or Dyo
// (ARCHITECTURE section 8). Pure data plus one chooser.

import type { Line, Speaker } from './types';

export type HermonMoment =
  | 'arrive'
  | 'returning'
  | 'gathering'
  | 'heart'
  | 'summit'
  | 'lightning'
  | 'strike'
  | 'caught'
  | 'break'
  | 'slip'
  | 'combo'
  | 'done'
  | 'failed';

const L = (who: Speaker, he: string, en: string): Line => ({ who, text: { he, en } });

export const HERMON_LINES: Readonly<Record<HermonMoment, readonly Line[]>> = {
  arrive: [
    L(
      'ezra',
      'הנשר יישא אותך אל החרמון, דרך הסערה. השכחה הקפיאה את המילים לברד. כל אבן נושאת מילה: כתוב אותה לפני שהיא נוחתת.',
      'The eagle will carry you to Hermon, through the storm. The Forgetting has frozen the words into hail. Every stone carries a word: write it before it lands.',
    ),
    L(
      'dyo',
      'אני מחזיק חזק בנוצות! אל תסתכל למטה. טוב, תסתכל. רק אל תפיל אותי.',
      'I am holding on to the feathers! Do not look down. All right, look. Just do not drop me.',
    ),
  ],
  returning: [
    L(
      'ezra',
      'שוב אל הסערה. הפעם תפוס כל אבן באוויר, עוד לפני שהיא מתקרבת.',
      'Into the storm again. This time catch every stone in the air, long before it comes near.',
    ),
  ],
  gathering: [
    L(
      'ezra',
      'האבן יורדת מן העננים. הקלד את המילה שעליה, והיא תתנפץ לגשם של זהב שמחזיר את הצבע לעמק.',
      'A stone is coming down out of the clouds. Type the word it carries and it bursts into gold rain that brings the color back to the valley.',
    ),
  ],
  heart: [
    L(
      'ezra',
      'לב הסערה. כשהברק מאיר, הבט בענן: שם מחכה המילה הבאה.',
      'The heart of the storm. When the lightning flashes, look into the cloud: the next word waits there.',
    ),
  ],
  summit: [
    L(
      'ezra',
      'הסערה נשברת והפסגה לפניך. עוד כמה אבנים, והחרמון כולו יחזור לצבעיו.',
      'The storm is breaking and the summit is ahead. A few more stones and all of Hermon will have its colors back.',
    ),
  ],
  lightning: [
    L(
      'dyo',
      'ראית? הברק הראה את המילה הבאה בתוך הענן! עכשיו אני יודע מה מגיע.',
      'Did you see? The lightning showed the next word inside the cloud! Now I know what is coming.',
    ),
  ],
  strike: [
    L(
      'dyo',
      'אוי! האבן פגעה בכנף! הנשר זרק אותה בחזרה למעלה, היא יורדת שוב.',
      'Ouch! The stone hit the wing! The eagle threw it back up; it is coming down again.',
    ),
    L(
      'ezra',
      'אבן שנוחתת לא מפילה אותך, רק מחלישה את הרצף. אצבעות רגועות, והמשך מאיפה שעצרת.',
      'A stone that lands does not throw you off; it only weakens the streak. Calm fingers, and go on from where you stopped.',
    ),
  ],
  caught: [
    L(
      'dyo',
      'תפסת אותה באוויר! גשם של זהב! העמק למטה נהיה ירוק!',
      'You caught it in the air! Golden rain! The valley down there is turning green!',
    ),
  ],
  break: [
    L('dyo', 'העננים נפתחים! אני רואה את השמיים!', 'The clouds are opening! I can see the sky!'),
    L(
      'ezra',
      'עוד פתח בעננים. הסערה נחלשת עם כל מילה.',
      'Another break in the clouds. The storm grows weaker with every word.',
    ),
  ],
  slip: [
    L(
      'ezra',
      'טעות קטנה, והנשר רק נרעד. נשימה, ותמשיך באותה מילה.',
      'A small slip, and the eagle only shudders. Breathe, and go on with the same word.',
    ),
  ],
  combo: [
    L(
      'dyo',
      'הנשר מכה בכנפיים בקצב שלך! אנחנו עפים!',
      'The eagle beats its wings to your rhythm! We are flying!',
    ),
  ],
  done: [
    L(
      'ezra',
      'הסערה עברה, והחרמון זוהר בשלג ובאור הערב. כל העמק חזר לצבעיו.',
      'The storm has passed, and Hermon shines with snow and evening light. The whole valley has its colors back.',
    ),
    L(
      'dyo',
      'קשת! קשת בענן מעל העמק! ואני עדיין על הנשר, לא נפלתי אפילו פעם אחת!',
      'A rainbow! A rainbow over the valley! And I am still on the eagle, I did not fall off even once!',
    ),
  ],
  failed: [
    L(
      'ezra',
      'מבחן הסופר אינו סולח על טעות. הנשר יחזור לקחת אותך. לאט יותר, ושוב.',
      'The Sofer’s Trial forgives no slip. The eagle will come back for you. Slower, and once more.',
    ),
  ],
};

/** One line for a moment; `n` picks among the choices (a counter or a random number). */
export function hermonLine(moment: HermonMoment, n: number): Line {
  const lines = HERMON_LINES[moment];
  return lines[Math.abs(Math.floor(n)) % lines.length] as Line;
}
