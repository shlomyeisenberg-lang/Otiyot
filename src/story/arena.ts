// What is said in the Silent Arena around the Great Blot (T16), the first boss and the end of
// Act One: Reb Ezra and Dyo call the phases from the stone seats, and a short victory cutscene
// restores the theatre and opens the road of Act Two. The Blot itself never speaks: it is the
// Fading given shape. Every speaker is male or Dyo (ARCHITECTURE section 8). Pure data.

import type { Cutscene, Line, Speaker } from './types';

export type ArenaMoment =
  | 'arrive'
  | 'returning'
  | 'checkpoint'
  | 'p1'
  | 'p2'
  | 'p3'
  | 'p4'
  | 'land'
  | 'parry'
  | 'stagger'
  | 'slip'
  | 'combo'
  | 'failed';

const L = (who: Speaker, he: string, en: string): Line => ({ who, text: { he, en } });

export const ARENA_LINES: Readonly<Record<ArenaMoment, readonly Line[]>> = {
  arrive: [
    L(
      'ezra',
      'כל מה שהשכחה גנבה מהאחו ומהצוקים נאסף לכאן, לכתם אחד גדול. אל תפחד ממנו. הוא עשוי ממילים שנשכחו, ומילים אפשר לכתוב מחדש.',
      'Everything the Fading stole from the meadow and the cliffs has gathered here into one great blot. Do not fear it. It is made of forgotten words, and words can be written again.',
    ),
  ],
  returning: [
    L(
      'ezra',
      'הכתם חזר להתגבש. הפעם אתה יודע את הדרך: מילה, משפט, קטע, ואז המראה.',
      'The blot has gathered again. This time you know the way: a word, a sentence, a passage, and then the mirror.',
    ),
  ],
  checkpoint: [
    L(
      'ezra',
      'נמשיך מאיפה שעצרנו. הכתם זוכר, אבל גם אנחנו.',
      'We go on from where we stopped. The blot remembers, but so do we.',
    ),
  ],
  p1: [
    L(
      'dyo',
      'הוא זורק כתמים! כל מילה מפוצצת אחד באוויר. אלה שמבריקים בזהב הם נקודת התורפה שלו!',
      'It is throwing blots! Every word bursts one in the air. The ones that glint gold are its weak spot!',
    ),
  ],
  p2: [
    L(
      'ezra',
      'עכשיו הוא שולח זרועות של דיו. משפט שלם חותך זרוע. המילה האחרונה במשפט נותנת את המכה.',
      'Now it reaches out with arms of ink. A whole sentence cuts an arm. The last word of the sentence is the blow.',
    ),
  ],
  p3: [
    L(
      'ezra',
      'הדיו עולה כמו מים. אל תמהר ואל תעצור: יד יציבה מחזיקה את הגאות. סימני הפיסוק הם הסכרים.',
      'The ink is rising like water. Do not rush and do not stop: a steady hand holds back the tide. The punctuation marks are the dams.',
    ),
  ],
  p4: [
    L(
      'dyo',
      'הכול הפוך! הוא מחזיר את המילים שבלע, מהסוף להתחלה. תקרא בזהירות!',
      'Everything is upside down! It is giving back the words it swallowed, last first. Read carefully!',
    ),
  ],
  land: [
    L('dyo', 'אוי! טפטוף. נגב ותמשיך.', 'Ugh! A splash. Wipe it off and keep going.'),
    L('ezra', 'גם סופר ותיק מקבל כתם. ממשיכים.', 'Even an old scribe gets a blot. On we go.'),
  ],
  parry: [
    L('dyo', 'ישר בלב הכתם!', 'Right through the blot!'),
    L('ezra', 'יפה. עוד אחת כזאת.', 'Good. Another like that.'),
  ],
  stagger: [
    L('dyo', 'הוא מתנדנד! עכשיו!', 'It is reeling! Now!'),
    L('ezra', 'בדיוק בנקודה הנכונה.', 'Exactly in the right place.'),
  ],
  slip: [
    L(
      'ezra',
      'טעות אחת לא מנצחת אף אחד. הכתם רק מחכה שתמהר.',
      'One mistake defeats no one. The blot is only waiting for you to hurry.',
    ),
  ],
  combo: [L('dyo', 'רצף! הדיו שלך זוהר!', 'A streak! Your ink is glowing!')],
  failed: [
    L(
      'ezra',
      'מבחן הסופר לא סולח, אבל הכתם לא ברח. נשום, ונסה שוב.',
      'The Sofer’s Trial does not forgive, but the blot has not gone anywhere. Breathe, and try again.',
    ),
  ],
};

export function arenaLine(moment: ArenaMoment, n: number): Line {
  const lines = ARENA_LINES[moment];
  return lines[Math.abs(Math.floor(n)) % lines.length] as Line;
}

/** The phase names on the transition card. */
export const PHASE_NAMES: Readonly<Record<'p1' | 'p2' | 'p3' | 'p4', Line['text']>> = {
  p1: { he: 'התזה', en: 'The Spatter' },
  p2: { he: 'הזרועות', en: 'The Tendrils' },
  p3: { he: 'הגאות', en: 'The Flood' },
  p4: { he: 'המראה', en: 'The Mirror' },
};

/** The act card after the victory: Act One ends, the road begins. */
export const ACT_TWO: Line['text'] = { he: 'מערכה שנייה · הדרך', en: 'Act Two · The Road' };

/**
 * The victory: the Blot breaks into a rain of gold letters, color rolls out over the stone
 * theatre, Reb Ezra and Dyo come down from the seats, and the road of Act Two opens.
 * Shots: 'burst' (the Blot from the scribe's shoulder), 'wide' (the whole theatre from above),
 * 'ezra' (the two of them), 'road' (out over the arena's gate to the land). Cues: 'shatter',
 * 'restore', 'sky', 'gather', 'gate'.
 */
export const BLOT_VICTORY: Cutscene = {
  id: 'blot-victory',
  title: { he: 'הכתם הגדול נמחק', en: 'The Great Blot is undone' },
  beats: [
    { id: 'shatter', shot: 'burst', cue: 'shatter', seconds: 2.4 },
    { id: 'restore', shot: 'wide', cue: 'restore', seconds: 2.6 },
    {
      id: 'narrator',
      shot: 'wide',
      cue: 'sky',
      say: L(
        'narrator',
        'הכתם התפרק לאלפי אותיות זהב, וכל אחת מצאה את דרכה הביתה: אל שלט, אל שיר, אל שם.',
        'The blot broke into a thousand gold letters, and each one found its way home: to a sign, to a song, to a name.',
      ),
      seconds: 3,
    },
    {
      id: 'ezra',
      shot: 'ezra',
      cue: 'gather',
      act: { ezra: 'cheer' },
      say: L(
        'ezra',
        'ארבעים שנה אני כותב, ולא ראיתי יד יציבה כזאת מול כתם כזה. אבל השכחה לא נולדה כאן. מקורה בקצה הרחוק של הארץ.',
        'Forty years I have been writing, and I have never seen so steady a hand before so great a blot. But the Fading was not born here. It comes from the far end of the land.',
      ),
      seconds: 3,
    },
    {
      id: 'dyo',
      shot: 'ezra',
      act: { dyo: 'cheer' },
      say: L(
        'dyo',
        'אז יוצאים לדרך? אני מביא את הקסת. ואת נייר הסופג אני משאיר פה.',
        'So we hit the road? I will bring the inkwell. And I am leaving the blotting paper here.',
      ),
      seconds: 2.5,
    },
    {
      id: 'road',
      shot: 'road',
      cue: 'gate',
      say: L(
        'ezra',
        'מכאן הדרך יורדת אל השוק, אל המסילה ואל ההרים. בכל מקום מחכות אותיות. קדימה, סופר.',
        'From here the road goes down to the market, to the railway and to the mountains. Letters are waiting everywhere. Onward, scribe.',
      ),
      seconds: 3,
    },
    { id: 'card', shot: 'road', cue: 'card', seconds: 3.2 },
  ],
};
