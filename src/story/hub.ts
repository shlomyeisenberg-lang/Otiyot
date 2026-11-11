// What people say in the House of the Scribe (T13). Short lines that react to where the player
// is: the first visit, the time of day, a region just restored, the next place to go, a station
// that is not open yet. Every speaker is male or Dyo (ARCHITECTURE section 8). `{region}` and
// `{name}` are filled in by the hub. Pure data plus one chooser.

import type { Line, Localized, Speaker } from './types';

export type HubMoment =
  | 'first'
  | 'morning'
  | 'day'
  | 'evening'
  | 'night'
  | 'restored'
  | 'next'
  | 'locked'
  | 'all'
  | 'idle'
  | 'naftali'
  | 'soon'
  | 'desk';

const L = (who: Speaker, he: string, en: string): Line => ({ who, text: { he, en } });

export const HUB_LINES: Readonly<Record<HubMoment, readonly Line[]>> = {
  first: [
    L(
      'ezra',
      'ברוך הבא הביתה, {name}. השולחן שומר את המפה, והמדפים שומרים על סבלנות.',
      'Welcome home, {name}. The desk keeps the map, and the shelves keep their patience.',
    ),
  ],
  morning: [
    L(
      'ezra',
      'בוקר טוב. דיו טרי ואצבעות רעננות: זמן טוב לכתוב.',
      'Good morning. Fresh ink, fresh fingers: a good hour to write.',
    ),
    L(
      'dyo',
      'בוקר! כבר קמתי. כלומר, עדיין לא נרדמתי.',
      'Morning! I am up. Well, I never went to sleep.',
    ),
  ],
  day: [
    L(
      'ezra',
      'השמש גבוהה והנוצה מחכה. לאט ונכון.',
      'The sun is high and the quill is waiting. Slow and right.',
    ),
    L(
      'dyo',
      'יום יפה לשחזר משהו. או לנמנם בקסת. שניהם טובים.',
      'A fine day to restore something. Or to nap in the inkwell. Both are good.',
    ),
  ],
  evening: [
    L(
      'ezra',
      'ערב. האור נעשה זהב, כמו אות שנכתבה נכון.',
      'Evening. The light turns gold, like a letter written well.',
    ),
    L(
      'dyo',
      'השמש שוקעת. אני לא. אני טיפה מקצועית.',
      'The sun is setting. I am not. I am a professional drop.',
    ),
  ],
  night: [
    L(
      'ezra',
      'לילה. המנורה דולקת, והעבודה לא ממהרת.',
      'Night. The lamp is lit, and the work is in no hurry.',
    ),
    L(
      'dyo',
      'בלילה הדיו שלי נראה אותו דבר. יתרון.',
      'At night my ink looks just the same. An advantage.',
    ),
  ],
  restored: [
    L(
      'ezra',
      'הצבע חזר אל {region}. שמעתי את זה מכאן.',
      'The color came back to {region}. I heard it from here.',
    ),
    L(
      'dyo',
      '{region} שוב צבעוני! אני גאה. גם קצת רטוב.',
      '{region} has its colors again! I am proud. Also a bit wet.',
    ),
  ],
  next: [
    L(
      'ezra',
      'הדרך הבאה מובילה אל {region}. המפה על השולחן.',
      'The next road leads to {region}. The map is on the desk.',
    ),
    L(
      'ezra',
      '{region} מחכה לנוצה שלך. אל תמהר, אבל אל תאחר.',
      '{region} is waiting for your quill. Do not rush, but do not be late.',
    ),
  ],
  locked: [
    L(
      'ezra',
      'יש מקומות שהאצבעות עוד לא מכירות. כל שיעור פותח דרך.',
      'Some places your fingers do not know yet. Every lesson opens a road.',
    ),
  ],
  all: [
    L(
      'ezra',
      'כל הארץ שוב צבועה. ובכל זאת, אני עדיין מתאמן כל בוקר.',
      'The whole land has its colors again. Still, I practice every morning.',
    ),
  ],
  idle: [
    L(
      'dyo',
      'אם אתה מחפש נייר סופג, אין לנו. ואל תשאל למה.',
      'If you are looking for blotting paper, we have none. Do not ask why.',
    ),
    L(
      'dyo',
      'אלף, בית, גימל... אני תמיד נתקע ליד הדלת.',
      'Alef, bet, gimel... I always get stuck near the door.',
    ),
    L(
      'ezra',
      'אות שנכתבה לאט ונכון שווה עשר שנכתבו מהר ועקום.',
      'One letter written slow and right is worth ten written fast and crooked.',
    ),
    L(
      'ezra',
      'הידיים על שורת הבית. משם יוצאים לכל מקום.',
      'Hands on the home row. From there you can go anywhere.',
    ),
    L(
      'dyo',
      'יש לי רעיון למילה חדשה. כרגע זה בעיקר כתם.',
      'I have an idea for a new word. It is mostly a smudge.',
    ),
  ],
  naftali: [
    L(
      'naftali',
      'עדיין כאן, סופר? אני כבר עברתי שלוש גבעות.',
      'Still here, scribe? I have crossed three hills already.',
    ),
    L(
      'naftali',
      'לא רע על המסילה. לא טוב כמוני, אבל לא רע.',
      'Not bad on the rail. Not as good as me, but not bad.',
    ),
    L(
      'naftali',
      'מהר כמו צבי, מדויק כמו סופר. אולי ביחד זה עובד.',
      'Swift as a deer, careful as a scribe. Maybe together it works.',
    ),
  ],
  soon: [
    L(
      'dyo',
      'החדר הזה עוד בניקיון. בעיקר על ידי. בעיקר לא טוב.',
      'That room is still being swept. Mostly by me. Mostly badly.',
    ),
    L(
      'ezra',
      'סבלנות. גם החדר הזה יקבל את הצבע שלו.',
      'Patience. That room will get its colors too.',
    ),
  ],
  desk: [
    L(
      'ezra',
      'הנה המפה. מה שאפור עוד מחכה לך.',
      'Here is the map. What is grey is still waiting for you.',
    ),
  ],
};

/** Fills `{region}` and `{name}` in a line. */
export function fillLine(text: string, vars: Readonly<Record<string, string>>): string {
  return text.replace(/\{(\w+)\}/g, (m, k: string) => vars[k] ?? m);
}

/** One line for a moment; `n` picks among the choices (a counter or a random number). */
export function hubLine(moment: HubMoment, n: number): Line {
  const lines = HUB_LINES[moment];
  return lines[Math.abs(Math.floor(n)) % lines.length] as Line;
}

/** The part of the day for an hour 0..24 (local time). */
export function partOfDay(hour: number): 'morning' | 'day' | 'evening' | 'night' {
  const h = ((hour % 24) + 24) % 24;
  if (h >= 5 && h < 10) return 'morning';
  if (h >= 10 && h < 17) return 'day';
  if (h >= 17 && h < 20.5) return 'evening';
  return 'night';
}

export type { Localized };
