// What Reb Ezra and Dyo say at the Star Station (T22): the weightless float between the modules,
// the turrets and the debris, the stars coming back one by one, and the observatory at the end.
// Reb Ezra speaks from the observatory through the station's old brass speaking tube; Dyo floats
// along beside the apprentice in a little glass bubble. Short lines, never in the way of the
// typing. Every speaker is male or Dyo (ARCHITECTURE section 8). Pure data plus one chooser.

import type { Line, Speaker } from './types';

export type StationMoment =
  | 'arrive'
  | 'returning'
  | 'outer'
  | 'ring'
  | 'observatory'
  | 'dock'
  | 'debris'
  | 'strike'
  | 'cleared'
  | 'online'
  | 'slip'
  | 'combo'
  | 'done'
  | 'failed';

const L = (who: Speaker, he: string, en: string): Line => ({ who, text: { he, en } });

export const STATION_LINES: Readonly<Record<StationMoment, readonly Line[]>> = {
  arrive: [
    L(
      'ezra',
      'כאן, מעל הכול, סופרים את הכוכבים. השכחה כיבתה אותם ופיזרה את התחנה. כל משפט שתכתוב מפעיל את המנועים: כתוב, ותרחף אל המודול הבא.',
      'Up here, above everything, the stars are counted. The Forgetting has dimmed them and broken the station apart. Every sentence you write fires your thrusters: write, and you will float to the next module.',
    ),
    L(
      'dyo',
      'אני מרחף! אין למטה! טוב, יש למטה, הוא פשוט רחוק מאוד.',
      'I am floating! There is no down! All right, there is a down, it is just very far away.',
    ),
  ],
  returning: [
    L(
      'ezra',
      'שוב אל התחנה. הפעם שבור כל סלע לפני שהוא נוגע בדופן.',
      'Back to the station. This time break every rock before it touches the hull.',
    ),
  ],
  outer: [
    L(
      'ezra',
      'הזרוע החיצונית. כל אות נכונה היא דחיפה קטנה. משפט שלם, ואתה עוגן בפתח.',
      'The outer arm. Every right letter is a little push. A whole sentence, and you dock at the hatch.',
    ),
  ],
  ring: [
    L(
      'ezra',
      'הטבעת הגדולה. כאן הפסולת צפופה יותר. שמור על קצב שקט, והתותח לא יחטיא.',
      'The great ring. The debris is thicker here. Keep a quiet rhythm, and the turret will not miss.',
    ),
  ],
  observatory: [
    L(
      'ezra',
      'המצפה עצמו. אני מחכה לך תחת הכיפה. עוד משפט ועוד אחד, והשמיים ייספרו מחדש.',
      'The observatory itself. I am waiting for you under the dome. One more sentence and one more, and the sky will be counted again.',
    ),
  ],
  dock: [
    L(
      'dyo',
      'עגנו! האורות נדלקים, ולוחות השמש נפתחים כמו כנפיים!',
      'We docked! The lights are coming on, and the solar panels are opening like wings!',
    ),
    L(
      'ezra',
      'יפה. עכשיו לתותח: סלעים אפורים מתקרבים. כל מילה שלמה יורה ושוברת אחד.',
      'Well done. Now to the turret: grey rocks are coming in. Every whole word fires and breaks one.',
    ),
  ],
  debris: [
    L(
      'dyo',
      'סלע! הוא מתקרב! כתוב את המילה שעליו, מהר, אבל בלי לטעות!',
      'A rock! It is coming closer! Type the word on it, quick, but no mistakes!',
    ),
  ],
  strike: [
    L(
      'dyo',
      'בום! הסלע נגע בדופן ונזרק אחורה. הוא חוזר, לאט יותר.',
      'Boom! The rock hit the hull and bounced away. It is coming back, slower.',
    ),
    L(
      'ezra',
      'סלע שפוגע לא מפיל את התחנה, רק מחליש את הרצף. אצבעות רגועות, והמשך באותה מילה.',
      'A rock that hits does not bring the station down; it only weakens the streak. Calm fingers, and go on with the same word.',
    ),
  ],
  cleared: [
    L(
      'dyo',
      'פגיעה ישירה! הסלע התפוצץ לאבק של זהב, ועוד כוכבים נדלקו!',
      'A direct hit! The rock burst into gold dust, and more stars lit up!',
    ),
  ],
  online: [
    L(
      'ezra',
      'המודול חזר לפעול. תראה כמה כוכבים חזרו. המשך הלאה.',
      'The module is running again. See how many stars have come back. Float on.',
    ),
    L(
      'dyo',
      'עוד מודול מואר! אני סופר כוכבים, אבל הם יותר מדי!',
      'Another module lit! I am counting the stars, but there are too many!',
    ),
  ],
  slip: [
    L(
      'ezra',
      'טעות קטנה, והמנוע רק משתעל. נשימה, ותמשיך באותה מילה.',
      'A small slip, and the thruster only coughs. Breathe, and go on with the same word.',
    ),
  ],
  combo: [
    L(
      'dyo',
      'המנועים בוערים בקצב שלך! אנחנו טסים!',
      'The thrusters are burning to your rhythm! We are flying!',
    ),
  ],
  done: [
    L(
      'ezra',
      'הכיפה נפתחת, והטלסקופ פונה אל השמיים. כל הכוכבים חזרו, ואפשר לספור אותם שוב.',
      'The dome is opening, and the telescope turns to the sky. Every star has come back, and they can be counted again.',
    ),
    L(
      'dyo',
      'אני רואה את הארץ למטה, ירוקה וכחולה! ואת כל הכוכבים! אחד, שניים, שלושה... אני אמשיך מחר.',
      'I can see the land down there, green and blue! And all the stars! One, two, three... I will go on tomorrow.',
    ),
  ],
  failed: [
    L(
      'ezra',
      'מבחן הסופר אינו סולח על טעות. התחנה תחכה לך. לאט יותר, ושוב.',
      'The Sofer’s Trial forgives no slip. The station will wait for you. Slower, and once more.',
    ),
  ],
};

/** One line for a moment; `n` picks among the choices (a counter or a random number). */
export function stationLine(moment: StationMoment, n: number): Line {
  const lines = STATION_LINES[moment];
  return lines[Math.abs(Math.floor(n)) % lines.length] as Line;
}
