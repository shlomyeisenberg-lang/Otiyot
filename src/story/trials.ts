// What is said in the Silent Arena's three trials (T26): the Storm Hawk (speed), the Glass Golem
// (precision) and the Long Tide (endurance). Reb Ezra and Dyo call the phases from the stone
// seats; each trial ends with a short victory cutscene. The bosses never speak: they are the
// Fading given shape. Every speaker is male or Dyo (ARCHITECTURE section 8). Pure data.

import type { ArenaMoment } from './arena';
import type { Cutscene, Line, Localized, Speaker } from './types';

type TrialName = 'storm' | 'glass' | 'tide';

/** What a trial says beyond the shared arena lines: its arrival and its three phases. */
export type TrialMoment = 'arrive' | 'returning' | 'p1' | 'p2' | 'p3' | 'special';

const L = (who: Speaker, he: string, en: string): Line => ({ who, text: { he, en } });

export const TRIAL_LINES: Readonly<Record<TrialName, Readonly<Record<TrialMoment, Line>>>> = {
  storm: {
    arrive: L(
      'ezra',
      'נץ הסערה. הוא לא חזק מהכתם, אבל הוא מהיר ממנו. הוא תוקף במטחים: כתוב מהר, נשום כשהוא נח, וכתוב מהר שוב.',
      'The Storm Hawk. It is not stronger than the blot, but it is faster. It strikes in bursts: write fast, breathe while it rests, then write fast again.',
    ),
    returning: L(
      'dyo',
      'הנץ חזר לקן! הפעם אנחנו מוכנים לרעמים.',
      'The hawk is back on its perch! This time we are ready for the thunder.',
    ),
    p1: L(
      'dyo',
      'שתי מילים, ניצוץ אחד! גמור את הצמד לפני שהברק נוחת!',
      'Two words, one spark! Finish the pair before the lightning lands!',
    ),
    p2: L(
      'ezra',
      'עכשיו הוא שולח שרשרת ברקים. המטחים ארוכים יותר והקצב עולה. אל תחשוב על הזמן, חשוב על האצבעות.',
      'Now it sends chains of lightning. The bursts are longer and the pace climbs. Do not think about the clock; think about your fingers.',
    ),
    p3: L(
      'dyo',
      'הסערה בשיאה! משפטים שלמים, מהר מתמיד. אתה יכול!',
      'The storm is at its height! Whole sentences, faster than ever. You can do it!',
    ),
    special: L(
      'ezra',
      'ראית? אחרי כל מטח הוא נח רגע. זה הזמן שלך לנשום.',
      'Did you see? After every burst it rests a moment. That is your time to breathe.',
    ),
  },
  glass: {
    arrive: L(
      'ezra',
      'גולם הזכוכית. איטי, אבל כל טעות מאחה סדק בגופו. כאן לא המהירות קובעת, אלא היד הנקייה.',
      'The Glass Golem. It is slow, but every mistake mends a crack in its body. Here speed does not decide; a clean hand does.',
    ),
    returning: L(
      'dyo',
      'הוא שוב שלם ומבריק. אז נסדוק אותו שוב, בזהירות.',
      'It is whole and shiny again. So we crack it again, carefully.',
    ),
    p1: L(
      'dyo',
      'מילה אחת בכל פעם. מילה מושלמת מסנוורת אותו!',
      'One word at a time. A perfect word dazzles it!',
    ),
    p2: L(
      'ezra',
      'משפטים. במילה הארוכה שבמשפט הזכוכית הכי דקה.',
      'Sentences. The longest word in a sentence is where the glass is thinnest.',
    ),
    p3: L(
      'ezra',
      'קטע שלם, והוא מאיר מבפנים. לאט ובטוח. אין לאן למהר.',
      'A whole passage, and it glows from within. Slow and sure. There is nowhere to hurry to.',
    ),
    special: L(
      'dyo',
      'אוי, הסדק נסגר! כל טעות מרפאה אותו. בזהירות!',
      'Oh, the crack closed! Every mistake heals it. Carefully!',
    ),
  },
  tide: {
    arrive: L(
      'ezra',
      'הגל הארוך. הוא לא ממהר לשום מקום, וגם אתה לא צריך. זה מבחן של נשימה ארוכה.',
      'The Long Tide. It is in no hurry, and neither should you be. This is a test of a long breath.',
    ),
    returning: L(
      'dyo',
      'הים עלה שוב על הבמה. הבאתי מגבת.',
      'The sea has come up onto the stage again. I brought a towel.',
    ),
    p1: L(
      'ezra',
      'קטע ארוך. הגל עולה ויורד: בגאות הוא בא מהר, בשפל הוא נח. שמור על קצב אחיד.',
      'A long passage. The wave rises and falls: at high tide it comes fast, at low tide it rests. Keep an even pace.',
    ),
    p2: L(
      'dyo',
      'עכשיו גלים בודדים! כל משפט שובר גל אחד.',
      'Now single waves! Every sentence breaks one wave.',
    ),
    p3: L(
      'ezra',
      'הקטע הארוך מכולם. אל תעצור ואל תמהר. יד יציבה מחזיקה את הים.',
      'The longest passage of all. Do not stop and do not rush. A steady hand holds back the sea.',
    ),
    special: L(
      'dyo',
      'הגאות עולה! הגל מאיץ. עוד קצת, והים ירד שוב.',
      'High tide! The wave speeds up. A little more, and it will ebb again.',
    ),
  },
};

/** The trial's own line for a moment, or the shared arena line (land, parry, slip...). */
export function trialLine(
  trial: TrialName,
  moment: TrialMoment | ArenaMoment,
  shared: (m: ArenaMoment) => Line,
): Line {
  const own = TRIAL_LINES[trial] as Readonly<Record<string, Line>>;
  return own[moment] ?? shared(moment as ArenaMoment);
}

/** The board's names and the transition cards' phase names. */
export const TRIAL_NAMES: Readonly<Record<TrialName, Localized>> = {
  storm: { he: 'נץ הסערה', en: 'The Storm Hawk' },
  glass: { he: 'גולם הזכוכית', en: 'The Glass Golem' },
  tide: { he: 'הגל הארוך', en: 'The Long Tide' },
};

/** After the last trial: the arena is whole and the way to the Blank Scroll opens. */
export const ARENA_WHOLE: Localized = {
  he: 'הזירה השקטה שבה לדבר',
  en: 'The Silent Arena speaks again',
};

/**
 * A trial's victory: the boss breaks into gold letters, color rolls back over the theatre, and
 * Reb Ezra says what the trial taught. Shots and cues are the arena's own ('burst', 'wide',
 * 'ezra'; 'shatter', 'restore', 'sky', 'gather', 'card').
 */
function victory(trial: TrialName, title: Localized, said: Line, dyo: Line): Cutscene {
  return {
    id: `trial-${trial}-victory`,
    title,
    beats: [
      { id: 'shatter', shot: 'burst', cue: 'shatter', seconds: 2.2 },
      { id: 'restore', shot: 'wide', cue: 'restore', seconds: 2.4 },
      { id: 'ezra', shot: 'ezra', cue: 'gather', act: { ezra: 'cheer' }, say: said, seconds: 2.6 },
      { id: 'dyo', shot: 'ezra', cue: 'sky', act: { dyo: 'cheer' }, say: dyo, seconds: 2.2 },
      { id: 'card', shot: 'wide', cue: 'card', seconds: 3 },
    ],
  };
}

export const TRIAL_VICTORY: Readonly<Record<TrialName, Cutscene>> = {
  storm: victory(
    'storm',
    { he: 'נץ הסערה נמחק', en: 'The Storm Hawk is undone' },
    L(
      'ezra',
      'מהירות זו לא בהלה. ראיתי אותך: מהיר כשצריך, ושקט כשאפשר. זו מהירות של סופר.',
      'Speed is not panic. I watched you: fast when you had to be, calm when you could be. That is a scribe’s speed.',
    ),
    L(
      'dyo',
      'הרעם נגמר, ונשארו רק ניצוצות זהב!',
      'The thunder is over, and only gold sparks are left!',
    ),
  ),
  glass: victory(
    'glass',
    { he: 'גולם הזכוכית נמחק', en: 'The Glass Golem is undone' },
    L(
      'ezra',
      'הזכוכית לא נשברה מכוח, אלא מדיוק. יד נקייה חזקה מכל פטיש.',
      'The glass did not break from force; it broke from care. A clean hand is stronger than any hammer.',
    ),
    L(
      'dyo',
      'ועכשיו כל הבמה נוצצת. בלי סדק אחד!',
      'And now the whole stage sparkles. Without a single crack!',
    ),
  ),
  tide: victory(
    'tide',
    { he: 'הגל הארוך נמחק', en: 'The Long Tide is undone' },
    L(
      'ezra',
      'הים לא נגמר, אבל גם הנשימה שלך לא נגמרה. סבלנות זה כוח שקט.',
      'The sea did not run out, but neither did your breath. Patience is a quiet strength.',
    ),
    L(
      'dyo',
      'המים חזרו לים, והאבנים יבשות. אפשר לשבת!',
      'The water went back to the sea and the stones are dry. We can sit down!',
    ),
  ),
};
