// The journal's own text (T32): who the player meets and the typing tips Reb Ezra writes down as
// the course goes on. Region entries reuse the region names and places already in the locale
// files. Every person here is a man or Dyo (ARCHITECTURE section 8); every line is family-safe.
// Tips use no key names, so they never ask for a letter the player has not learned. Pure data.

import type { Localized, Speaker } from './types';

export type JournalPerson = Exclude<Speaker, 'narrator' | 'apprentice'>;

export const JOURNAL_PEOPLE: readonly JournalPerson[] = ['ezra', 'dyo', 'naftali', 'keeper'];

/** Who each person is, in a few sentences. */
export const PEOPLE_NOTES: Readonly<Record<JournalPerson, Localized>> = {
  ezra: {
    he: 'סופר זקן ושומר בית הסופר. הוא מלמד לאט ובסבלנות, ואומר שכתיבה טובה היא קודם כול נשימה טובה.',
    en: 'An old scribe and the keeper of the House of the Scribe. He teaches slowly and patiently, and says good writing begins with good breathing.',
  },
  dyo: {
    he: 'טיפת דיו קטנה וחסרת מנוחה. היא מצחיקה, מהירה ותמיד מוכנה להתחיל, ואף פעם לא נרדמת באמת.',
    en: 'A small, restless drop of ink. Quick, cheerful and always ready to begin, and never truly asleep.',
  },
  naftali: {
    he: 'שליח הרכבת של קו יפו. הוא אוהב מרוצים, מדבר מהר ומתעקש לנצח, אבל תמיד לוחץ יד בסוף.',
    en: 'The courier of the Jaffa Line. He loves a race, talks fast and insists on winning, but always shakes hands at the end.',
  },
  keeper: {
    he: 'השומר של המגילה הריקה. עייף ושקט, והוא שומר מקום לכל מה שנשכח מאז שהאותיות החלו להיעלם.',
    en: 'The keeper of the Blank Scroll. Tired and quiet, he holds a place for everything forgotten since the letters began to fade.',
  },
};

/** A tip and what opens it. */
export interface TipEntry {
  id: string;
  text: Localized;
  /** The lesson level of the active track from which the tip is written down (1 = from the start). */
  level: number;
}

export const TIPS: readonly TipEntry[] = [
  {
    id: 'posture',
    level: 1,
    text: {
      he: 'שבו זקופים, כתפיים רפויות, ופרקי כפות הידיים מעט מעל השולחן.',
      en: 'Sit tall, shoulders loose, wrists just above the desk.',
    },
  },
  {
    id: 'home',
    level: 1,
    text: {
      he: 'תנו לאצבעות לחזור אל שורת הבית אחרי כל אות. שם הן נחות.',
      en: 'Let your fingers return to the home row after every letter. That is where they rest.',
    },
  },
  {
    id: 'eyes',
    level: 1,
    text: {
      he: 'עיניים על הטקסט, לא על המקלדת. המקלדת תמצא את דרכה לבד.',
      en: 'Eyes on the text, not on the keyboard. The keyboard will find its own way.',
    },
  },
  {
    id: 'accuracy',
    level: 2,
    text: {
      he: 'דייקו קודם, ורק אחר כך האיצו. מהירות באה מדיוק, לא להפך.',
      en: 'Be accurate first and fast second. Speed grows out of accuracy, not the other way round.',
    },
  },
  {
    id: 'rhythm',
    level: 2,
    text: {
      he: 'הקישו בקצב אחיד, כמו הליכה. קצב רגוע מנצח התפרצויות.',
      en: 'Tap at an even beat, like walking. A calm rhythm beats bursts.',
    },
  },
  {
    id: 'weak',
    level: 3,
    text: {
      he: 'האותיות שאתם מפספסים הן המורות הכי טובות. התאמנו עליהן קצת בכל יום.',
      en: 'The letters you miss are your best teachers. Practise them a little every day.',
    },
  },
  {
    id: 'breaks',
    level: 3,
    text: {
      he: 'עשר דקות ביום עדיפות על שעה אחת בשבוע. אחרי כל חצי שעה, הפסקה לעיניים.',
      en: 'Ten minutes a day beat one hour a week. After half an hour, rest your eyes.',
    },
  },
  {
    id: 'ahead',
    level: 4,
    text: {
      he: 'הסתכלו מילה אחת קדימה. כשהעיניים מקדימות, האצבעות מתרגלות לזרום.',
      en: 'Look one word ahead. When the eyes run ahead, the fingers learn to flow.',
    },
  },
  {
    id: 'mistake',
    level: 4,
    text: {
      he: 'טעית? אל תיבהלו. תקנו בשקט והמשיכו. הבהלה עולה יותר מהטעות.',
      en: 'Made a mistake? Do not panic. Fix it quietly and carry on. The panic costs more than the slip.',
    },
  },
  {
    id: 'fingers',
    level: 5,
    text: {
      he: 'לכל אצבע יש אזור משלה. כשכל אצבע עושה את שלה, אף אחת לא מתעייפת.',
      en: 'Every finger has its own patch. When each does its own part, none grows tired.',
    },
  },
  {
    id: 'flow',
    level: 6,
    text: {
      he: 'בסוף כבר לא חושבים על אותיות. חושבים על מילים, ואחר כך על משפטים.',
      en: 'In the end you stop thinking about letters. You think about words, then sentences.',
    },
  },
];
