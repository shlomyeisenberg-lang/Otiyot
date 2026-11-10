// Content rules (docs/ARCHITECTURE.md section 8): no women, nothing romantic or suggestive.
// Every text that reaches the player passes through here, whichever source it comes from
// (library, classic lexicon, lesson banks). Pure logic, no DOM.

import type { LayoutId } from '../core';

/** Hebrew stems that may carry a one-letter prefix (ה ו ב ל מ ש כ …). */
const HE_STEMS = [
  'אישה',
  'אשה',
  'נשים',
  'בחורה',
  'נערה',
  'ילדה',
  'ילדות',
  'אמא',
  'אימא',
  'סבתא',
  'כלה',
  'גברת',
  'מלכה',
  'נסיכה',
  'שמלה',
  'תחתונים',
  'אהבה',
  'אוהב',
  'אוהבת',
  'אהוב',
  'אהובה',
  'נשיקה',
  'חיבוק',
  'רומנטי',
  'מורות',
  'תלמידות',
  'תלמידה',
  'סופרת',
  'זמרת',
  'שוטרת',
  'אמנית',
  'רופאה',
  'מתכנתת',
  'מהנדסת',
  'צלמת',
  'מאמנת',
  'משוררת',
  'עובדת',
  'פועלת',
  'מדליקות',
  'אורחת',
  'מארחת',
  'נכדה',
  'שכנה',
  'ידידה',
  'זקנה',
  'תינוקת',
  'אחות',
  'דודה',
  'אמהות',
  'סבתות',
  'שכנות',
  'תאומה',
  'עמיתה',
  'גיסה',
  'אחיות',
];
const HE_PREFIXES = ['', 'ה', 'ו', 'ב', 'ל', 'מ', 'ש', 'כ', 'וה', 'שה', 'מה', 'לה', 'בה', 'כש'];
/** Words that are blocked only as the whole word (adding a prefix makes another word). */
const HE_EXACT = ['בת', 'בנות', 'חברה', 'חתן', 'היא', 'שלה', 'אותה', 'לאהוב'];

const EN_BLOCK = [
  'woman',
  'women',
  'girl',
  'girls',
  'lady',
  'ladies',
  'mother',
  'mothers',
  'mom',
  'mum',
  'mama',
  'grandmother',
  'grandma',
  'daughter',
  'daughters',
  'sister',
  'sisters',
  'wife',
  'wives',
  'bride',
  'queen',
  'princess',
  'she',
  'her',
  'hers',
  'herself',
  'kiss',
  'kisses',
  'kissed',
  'love',
  'loved',
  'lover',
  'lovers',
  'loves',
  'romance',
  'romantic',
  'sexy',
  'dating',
  'date',
  'wedding',
  'girlfriend',
  'boyfriend',
  'hug',
  'hugs',
  'underwear',
  'bikini',
  'dress',
  'skirt',
  'actress',
  'waitress',
  'aunt',
  'niece',
  'madam',
  'maid',
];

const HE_SET = new Set<string>([
  ...HE_STEMS.flatMap((s) => HE_PREFIXES.map((p) => p + s)),
  ...HE_EXACT,
]);
const EN_SET = new Set<string>(EN_BLOCK);

/** True when the word may be shown to the player. */
export function isAllowedWord(word: string, language: LayoutId): boolean {
  const t = word.replace(/^[^\p{L}]+|[^\p{L}]+$/gu, '');
  return language === 'he' ? !HE_SET.has(t) : !EN_SET.has(t.toLowerCase());
}

/** True when every word of the sentence is allowed. */
export function isAllowedText(text: string, language: LayoutId): boolean {
  return text.split(/\s+/).every((w) => w === '' || isAllowedWord(w, language));
}

/** Drops disallowed words from a text (used on lesson texts, which keep their shape). */
export function cleanText(text: string, language: LayoutId): string {
  return text
    .split(/\s+/)
    .filter((w) => w !== '' && isAllowedWord(w, language))
    .join(' ');
}
