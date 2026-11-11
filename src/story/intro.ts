// Act 1 opens (GAME_DESIGN "Story"): the night the lamp-sign over the House of the Scribe goes
// blank, Reb Ezra gives the apprentice his spare quill, and Dyo climbs out of the inkwell.
// Lines are short on purpose: one breath each. Shots and cues are framed by the intro scene
// (src/scenes/intro). The player's apprentice is silent; his answers come later, as typed words.

import type { Cutscene, Localized } from './types';

/** The card shown as the intro hands over to the House of the Scribe. */
export const ACT_ONE: Localized = { he: 'מערכה א׳ · הקולמוס', en: 'Act One · The Quill' };

/** The words on the lamp-sign over the door (the world's own language, so always Hebrew). */
export const SIGN_TEXT = 'בית הסופר';

export const INTRO: Cutscene = {
  id: 'intro',
  title: { he: 'הקולמוס', en: 'The Quill' },
  beats: [
    { id: 'street', shot: 'street', cue: 'night', seconds: 4.2 },
    {
      id: 'land',
      shot: 'street-near',
      seconds: 2.4,
      say: {
        who: 'narrator',
        text: {
          he: 'בארץ האותיות, כל שלט יודע את שמו.',
          en: 'In the Land of Letters, every sign knows its own name.',
        },
      },
    },
    {
      id: 'forty-years',
      shot: 'sign',
      seconds: 2.4,
      say: {
        who: 'narrator',
        text: {
          he: 'מעל דלת בית הסופר, השלט דלק ארבעים שנה.',
          en: 'Over the door of the House of the Scribe, the lamp-sign had burned for forty years.',
        },
      },
    },
    { id: 'fading', shot: 'sign-close', cue: 'fading', seconds: 5.2 },
    {
      id: 'forgot',
      shot: 'sign-close',
      seconds: 1.6,
      say: { who: 'narrator', text: { he: 'הלילה, הוא שכח.', en: 'Tonight, it forgot.' } },
    },
    { id: 'ezra-out', shot: 'door', cue: 'ezra-out', seconds: 3.4 },
    {
      id: 'stammer',
      shot: 'door',
      seconds: 1.5,
      say: {
        who: 'ezra',
        text: {
          he: 'הממ. ארבעים שנה, והשלט הזה אף פעם לא גמגם.',
          en: 'Hm. Forty years, and that sign never once stammered.',
        },
      },
    },
    {
      id: 'forgetting',
      shot: 'two-shot',
      cue: 'ezra-turns',
      seconds: 1.5,
      say: {
        who: 'ezra',
        text: {
          he: 'זו השכחה. קודם אות אחת. אחר כך מילה. אחר כך רחוב שלם.',
          en: 'It is the Forgetting. First one letter. Then a word. Then a whole street.',
        },
      },
    },
    {
      id: 'hands',
      shot: 'ezra-close',
      seconds: 1.5,
      say: {
        who: 'ezra',
        text: {
          he: 'הידיים שלי רועדות מדי בשביל דרך ארוכה. שלך לא.',
          en: 'My hands shake too much for a long road. Yours do not.',
        },
      },
    },
    { id: 'give-quill', shot: 'quill', cue: 'give-quill', act: { ezra: 'write' }, seconds: 2.8 },
    {
      id: 'spare-quill',
      shot: 'apprentice',
      seconds: 1.5,
      say: {
        who: 'ezra',
        text: {
          he: 'הקולמוס הרזרבי שלי. הוא כותב רק מה שהאצבעות שלך באמת יודעות.',
          en: 'My spare quill. It writes only what your fingers truly know.',
        },
      },
    },
    { id: 'inkwell', shot: 'bench', cue: 'inkwell-shakes', seconds: 1.9 },
    { id: 'dyo-pops', shot: 'dyo', cue: 'dyo-pops', seconds: 1.5 },
    {
      id: 'blotting',
      shot: 'dyo',
      seconds: 1.2,
      say: {
        who: 'dyo',
        text: {
          he: 'זה בטוח? יש פה נייר סופג? אני לא מתקרב לנייר סופג!',
          en: 'Is it safe? Any blotting paper? I do not go near blotting paper!',
        },
      },
    },
    {
      id: 'that-is-dyo',
      shot: 'two-shot',
      seconds: 1.5,
      say: {
        who: 'ezra',
        text: {
          he: 'זה דיו. הוא גר בקסת. הוא גם מדבר. הרבה.',
          en: 'That is Dyo. He lives in the inkwell. He also talks. A lot.',
        },
      },
    },
    {
      id: 'at-your-service',
      shot: 'dyo-apprentice',
      cue: 'dyo-hops',
      seconds: 1.5,
      say: {
        who: 'dyo',
        text: {
          he: 'טיפת דיו, לשירותך! בלעדיי, הקולמוס הזה סתם מגרד.',
          en: 'One drop of ink, at your service! Without me, that quill just scratches.',
        },
      },
    },
    {
      id: 'who-drank',
      shot: 'sign-wide',
      cue: 'dyo-looks',
      seconds: 1.2,
      say: {
        who: 'dyo',
        text: {
          he: 'רגע. למה השלט ריק? מי שתה לו את האותיות?!',
          en: 'Wait. Why is the sign blank? Who drank its letters?!',
        },
      },
    },
    {
      id: 'written-again',
      shot: 'ezra-close',
      seconds: 1.5,
      say: {
        who: 'ezra',
        text: {
          he: 'אף אחד לא שתה. האותיות נשכחו. ומה שנשכח, אפשר לכתוב מחדש.',
          en: 'Nobody drank them. They were forgotten. And what is forgotten can be written again.',
        },
      },
    },
    {
      id: 'first-letter',
      shot: 'sign-wide',
      cue: 'first-letter',
      act: { apprentice: 'write' },
      seconds: 3.4,
    },
    {
      id: 'one-letter',
      shot: 'dyo-apprentice',
      cue: 'dyo-cheers',
      seconds: 1.2,
      say: {
        who: 'dyo',
        text: {
          he: 'אות אחת! הוא כתב אות שלמה! נשארו רק כמה מאות אלפים!',
          en: 'One letter! A whole letter! Only a few hundred thousand to go!',
        },
      },
    },
    {
      id: 'slow-letter',
      shot: 'two-shot',
      act: { ezra: 'cheer' },
      seconds: 1.5,
      say: {
        who: 'ezra',
        text: {
          he: 'אות איטית וכתובה היטב עדיפה על מהירה ומרוחה. בוא, נתחיל.',
          en: 'A slow letter written well beats a fast one smudged. Come. We begin.',
        },
      },
    },
    { id: 'act-one', shot: 'crane-up', cue: 'act-title', seconds: 4.6 },
  ],
};
