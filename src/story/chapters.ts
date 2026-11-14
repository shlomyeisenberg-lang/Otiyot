// The story between the scenes (T35): a short chapter before a region opens for the first time
// and another when it is first restored. Together with the opening (T12), the Great Blot (T16),
// the trials (T26) and the Blank Scroll (T27) they tell the three acts in order. Naftali's arc
// runs from a taunt on the Jaffa Line to the line he holds in the last fight; Reb Ezra learns to
// let the apprentice go ahead of him; the Keeper's scorched pages turn up one by one; Dyo's running
// jokes (blotting paper, "a few hundred thousand to go", puns on letters) come back on the way.
// Every speaker is a man or Dyo (ARCHITECTURE section 8). Both languages are written to sound
// natural, not translated. Pure data plus lookups; the screen is src/ui/screens/chapter.ts.

import { ACT_TWO } from './arena';
import type { Beat, Cutscene, Line, Localized, Speaker } from './types';

export type ChapterKind = 'start' | 'restored';

export interface Chapter {
  /** `<region>.<kind>`; also the save flag `ch:<id>` that remembers it was seen. */
  id: string;
  region: string;
  kind: ChapterKind;
  scene: Cutscene;
}

const L = (who: Speaker, he: string, en: string): Line => ({ who, text: { he, en } });

function chapter(
  region: string,
  kind: ChapterKind,
  title: Localized,
  lines: readonly Line[],
): Chapter {
  const id = `${region}.${kind}`;
  const beats: Beat[] = lines.map((say, i) => ({ id: `${id}.${i}`, seconds: 1.4, say }));
  return { id, region, kind, scene: { id, title, beats } };
}

const ACT_THREE: Localized = { he: 'מערכה ג׳ · השומר', en: 'Act Three · The Keeper' };

export const CHAPTERS: readonly Chapter[] = [
  // ---------------------------------------------------------------- Act One
  chapter('meadow', 'restored', { he: 'האחו פורח', en: 'The meadow blooms' }, [
    L(
      'dyo',
      'רואה? הכלניות חזרו! עוד כמה מאות אלפי אותיות, ונסיים.',
      'See? The anemones are back! Only a few hundred thousand letters to go.',
    ),
    L(
      'ezra',
      'אות אחת כתובה היטב, ועולם קטן נזכר בעצמו. עכשיו נלך אל הצוקים.',
      'One letter written well, and a small world remembers itself. Now, to the cliffs.',
    ),
  ]),
  chapter('cliffs', 'start', { he: 'צוקי עין גדי', en: 'The Cliffs of Ein Gedi' }, [
    L(
      'narrator',
      'מעל המדבר, המפלים שתקו. אפילו היעלים עמדו על הסלעים בלי לזוז.',
      'High above the desert the waterfalls had gone quiet. Even the ibex stood on the rocks without moving.',
    ),
    L(
      'ezra',
      'כאן צריך להושיט יד למעלה ולמטה, לא רק לשורת הבית. סומכים על האצבעות, לא על העיניים.',
      'Here you must reach up and down, not only along the home row. Trust your fingers, not your eyes.',
    ),
    L(
      'dyo',
      'רק אל תסתכל למטה! ואל תזכיר לי נייר סופג.',
      'Just do not look down! And do not mention blotting paper to me.',
    ),
  ]),
  chapter('cliffs', 'restored', { he: 'המפלים שרים', en: 'The waterfalls sing' }, [
    L(
      'narrator',
      'המים חזרו לזרום, והקול שלהם חזר לפני כן, כמו שיר שמישהו נזכר בו.',
      'The water ran again, and its sound came back first, like a song someone suddenly remembers.',
    ),
    L(
      'ezra',
      'שני אזורים חזרו לצבע. אבל תראה: ההרים שמאחורינו עדיין אפורים. משהו גדול יושב שם.',
      'Two places are in color again. But look: the hills behind us are still grey. Something large is sitting there.',
    ),
  ]),
  chapter('blot', 'start', { he: 'הכתם הגדול', en: 'The Great Blot' }, [
    L(
      'narrator',
      'כל מה שהשכחה לקחה מהאחו ומהצוקים התקבץ באולם אבן עתיק, לכתם אחד גדול עם שתי עיניים חיוורות.',
      'Everything the Fading had taken from the meadow and the cliffs had gathered in an old stone theatre, into one great blot with two pale eyes.',
    ),
    L(
      'ezra',
      'הוא לא רע. הוא אבוד. תכתוב לו את מה שלקח, והוא יחזיר.',
      'He is not wicked. He is lost. Write him what he took, and he will give it back.',
    ),
    L(
      'dyo',
      'אני אחכה בכיס. בכיס המגן, כמובן.',
      'I will wait in your pocket. The safe pocket, of course.',
    ),
  ]),
  // ---------------------------------------------------------------- Act Two
  chapter('forge', 'start', { he: 'כור הגימטריה', en: 'The Gematria Forge' }, [
    L(
      'narrator',
      'בתוך הר, בין אש ואבן, עמד בית חרושת ישן שבו כל אות שווה מספר, וכל מספר שווה אות.',
      'Inside a hill, between fire and stone, stood an old smithy where every letter was worth a number and every number a letter.',
    ),
    L(
      'ezra',
      'ראית את הדף הצרוב שמצאנו בדרך? החתימה עליו אחת: "השומר". מי שחתם כך יודע מה האש עושה לדף.',
      'You saw the scorched page we found on the road? One signature on it: "The Keeper". Whoever signed it knows what fire does to a page.',
    ),
    L(
      'dyo',
      'וואו, כמה חם כאן. אני מתאדה! מישהו יש לו כוס מים?',
      'Phew, it is hot in here. I am evaporating! Does anyone have a cup of water?',
    ),
  ]),
  chapter('forge', 'restored', { he: 'הכור בוער', en: 'The forge blazes' }, [
    L(
      'narrator',
      'הכור התלהט שוב, ובכל פטיש נשמעה אות שזכרה את ערכה.',
      'The furnace glowed again, and every hammer blow rang out a letter that remembered its worth.',
    ),
    L(
      'dyo',
      'שמונה מאות אלפי אותיות מאז הבוקר! ובכן, בערך שמונה.',
      'Eight hundred thousand letters since morning! Well, about eight.',
    ),
  ]),
  chapter('shuk', 'start', { he: 'השוק בלילה', en: 'The Night Shuk' }, [
    L(
      'narrator',
      'פנסים נדלקו בין הדוכנים, והסוחרים דיברו מהר, כי כשהמילים נגמרות אין מה למכור.',
      'Lanterns glowed between the stalls, and the merchants talked fast, because when the words run out there is nothing left to sell.',
    ),
    L(
      'ezra',
      'כאן סימני הפיסוק הם המטבעות. פסיק, נקודה, גרשיים: כל אחד שווה משהו, ואסור לטעות במחיר.',
      'Here punctuation is the coin. A comma, a full stop, a pair of quotation marks: each is worth something, and you must not mistake the price.',
    ),
    L(
      'dyo',
      'שמעתי שאפשר להתמקח על נקודה. אני מציע שניים בשבילי!',
      'I hear you can haggle over a full stop. I will take two, please!',
    ),
  ]),
  chapter('shuk', 'restored', { he: 'השוק חוזר לחיים', en: 'The shuk is alive again' }, [
    L(
      'narrator',
      'הסוחרים צחקו, והשוק התמלא בקולות. הם זכרו שוב איך מוכרים מילה טובה.',
      'The merchants laughed, and the market filled with voices. They remembered again how to sell a good word.',
    ),
    L(
      'ezra',
      'שמעת מה אמר זקן הדוכן? שמישהו עבר כאן בריצה לפנינו, כל כך מהר שהפנסים התנדנדו.',
      'Did you hear what the old stallholder said? Somebody ran through here ahead of us, so fast the lanterns swung.',
    ),
  ]),
  chapter('rail', 'start', { he: 'קו יפו', en: 'The Jaffa Line' }, [
    L(
      'narrator',
      'ברציף הראשון עמד רכבת של גלגלי שיניים, ועליה, נשען על הקרון, שליח צעיר.',
      'On the first platform stood a train of gears, and leaning against its carriage, a young courier.',
    ),
    L(
      'naftali',
      'אתה החניך שכותב לאט? אני נפתלי. אני מגיע לכל מקום לפניך, ואחרי זה אני מחכה לך שם.',
      'You are the apprentice who writes slowly? I am Naftali. I reach every place before you, and then I wait for you there.',
    ),
    L(
      'ezra',
      'מהר זה לא תמיד קדימה, נפתלי. אבל הוא צודק: המסלול ארוך, והשכחה לא מחכה.',
      'Fast is not always forward, Naftali. Still, he is right: the line is long, and the Fading does not wait.',
    ),
    L(
      'dyo',
      'הוא אמר עליך "לאט"! אני מאוד נעלב בשמך.',
      'He called you "slow"! I am deeply offended on your behalf.',
    ),
  ]),
  chapter('rail', 'restored', { he: 'המסלול נפתח', en: 'The line runs' }, [
    L(
      'naftali',
      'לא ניצחת אותי. הגעת קצת אחרי, וזה כבר יותר ממה שאחרים עושים. נתראה בקו הבא.',
      'You did not beat me. You came in just behind, and that is further than most get. See you at the next stop.',
    ),
    L(
      'ezra',
      'שים לב: הוא כבר קורא לך בשם. אצל נפתלי, זה כמעט חיבוק.',
      'Notice: he is already calling you by name. From Naftali, that is nearly an embrace.',
    ),
  ]),
  chapter('geniza', 'start', { he: 'הגניזה השקועה', en: 'The Sunken Geniza' }, [
    L(
      'narrator',
      'מתחת לעיר ישנה שכב ארכיון שהמים כיסו, ודפים צפו בו לאט בין קרני אור.',
      'Beneath an old town lay an archive the water had covered, and pages drifted through it slowly between shafts of light.',
    ),
    L(
      'ezra',
      'כאן חשוב הקצב, לא המהירות. הקלד עם הגאות: קבוע, שקט. מי שממהר, טובע.',
      'Here rhythm matters, not speed. Type with the tide: steady, quiet. Whoever hurries, sinks.',
    ),
    L(
      'dyo',
      'אני דיו, והמים כאן הרבה. אני לא רגוע.',
      'I am ink, and there is a great deal of water here. I am not calm.',
    ),
  ]),
  chapter('geniza', 'restored', { he: 'הדפים שבו', en: 'The pages return' }, [
    L(
      'narrator',
      'הדפים שבו למדפים, ועל אחד מהם, חרוך בקצותיו, נשאר חתימה בכתב יד מוכר.',
      'The pages went back to their shelves, and on one of them, scorched at the edges, lay a signature in a hand now familiar.',
    ),
    L(
      'ezra',
      'שוב אותו כתב. הוא לא רק מוחק, הוא גם קורא. מי שמחק כל כך הרבה, קרא מאוד.',
      'The same hand again. He does not only erase, he reads. Whoever erased this much has read a great deal.',
    ),
  ]),
  chapter('hermon', 'start', { he: 'כנפיים מעל החרמון', en: 'Wings over Hermon' }, [
    L(
      'narrator',
      'עננים שחורים התקבצו מעל העמק, ובתוכם ציפור גדולה המתינה על צוק, כנפיה פרושות.',
      'Black clouds gathered over the valley, and in them a great bird waited on a crag, wings spread.',
    ),
    L(
      'ezra',
      'הנשר ישא אותך עד השלג. אני לא יכול לעלות איתך. הכנפיים שלי כבר ישנות מדי.',
      'The eagle will carry you to the snow. I cannot come with you. My wings are too old now.',
    ),
    L(
      'dyo',
      'אני כן בא! אני אתחבא בשרוול, ואם יהיה ברד, לא הייתי כאן.',
      'I am coming! I will hide in your sleeve, and if there is hail, I was never here.',
    ),
  ]),
  chapter('hermon', 'restored', { he: 'קשת מעל העמק', en: 'A rainbow over the valley' }, [
    L(
      'narrator',
      'הסערה נשברה, וקשת נפרשה מעל העמק כמו שורה ארוכה שנכתבה בצבעים.',
      'The storm broke, and a rainbow stretched over the valley like a long line written in colors.',
    ),
    L(
      'ezra',
      'הלכת מעבר למקום שאני יכול ללכת. אל תסתכל אחורה כדי לבדוק אם אני מחייך. אני מחייך.',
      'You went further than I can go. Do not look back to see if I am smiling. I am.',
    ),
  ]),
  chapter('station', 'start', { he: 'תחנת הכוכבים', en: 'The Star Station' }, [
    L(
      'narrator',
      'במצפה שנשבר לחתיכות, בלי משקל, ריחפו הכוכבים כמו אותיות שנפלו משורה.',
      'In an observatory broken into pieces, weightless, the stars drifted like letters fallen from a line.',
    ),
    L(
      'dyo',
      'אני צף! אני צף! אני דיו שצף! מישהו שיקשור אותי!',
      'I am floating! I am floating! An ink drop floating! Somebody tie me down!',
    ),
    L(
      'ezra',
      'את המשפט הראשון כותבים כדי לעוף, את השני כדי להגן. תחנה אחת בכל פעם.',
      'The first sentence you write to fly, the second to defend. One module at a time.',
    ),
  ]),
  chapter('station', 'restored', { he: 'הכוכבים שבים', en: 'The stars return' }, [
    L(
      'narrator',
      'הכיפה נפתחה, והכוכבים חזרו למקומם, אחד אחד, כמו מילים בשורה מסודרת.',
      'The dome opened, and the stars went back to their places, one by one, like words in a tidy line.',
    ),
    L(
      'naftali',
      'ראיתי את זה מהקרקע! כל הלילה חיפשתי דרך לעלות לשם, ואתה כבר היית שם. מי היה מאמין.',
      'I saw that from the ground! All night I looked for a way up, and you were already there. Who would have believed it.',
    ),
  ]),
  chapter('atbash', 'start', { he: 'עיר האתבש', en: 'Atbash City' }, [
    L(
      'narrator',
      'גשם דק ירד על עיר של שלטי זוהר, ובה בני אדם שכתבו הכול בסתר, כי למדו שמה שכתוב בגלוי נעלם.',
      'Fine rain fell on a city of glowing signs, where people wrote everything in code, for they had learned that what is written in the open vanishes.',
    ),
    L(
      'ezra',
      'האתבש: האות הראשונה תמורת האחרונה, השנייה תמורת זו שלפני האחרונה. פשוט, כמו מראה.',
      'Atbash: the first letter for the last, the second for the one before it. Simple, like a mirror.',
    ),
    L(
      'dyo',
      'אני כבר מבולבל. אם א היא ת, אז מי אני? דלת? ...לא, אני עדיין דיו. תודה.',
      'I am confused already. If A is Z, then who am I? ...Still Dyo, it seems. Thank you.',
    ),
  ]),
  chapter('atbash', 'restored', { he: 'השלטים נדלקים', en: 'The signs light up' }, [
    L(
      'narrator',
      'השלטים נדלקו בצבעים, ואחד מהם, בפינת הרחוב, נשא מסר שנכתב מאוחר: "אם אתה קורא את זה, אל תעצור."',
      'The signs lit up in color, and one of them, at the corner of the street, carried a message written late: "If you are reading this, do not stop."',
    ),
    L(
      'ezra',
      'תשים לב לכתב. זה כתב ידו של השומר, אבל הפעם הוא לא מוחק. הוא מתחנן.',
      'Look at the writing. That is the Keeper’s hand, but this time he is not erasing. He is pleading.',
    ),
  ]),
  chapter('midbar', 'start', { he: 'המדבר הארוך', en: 'The Long Midbar' }, [
    L(
      'narrator',
      'חול נישא ברוח ובלע את הדרך, והשיירה הקטנה ניצבה בלי כיוון, ללא שביל וללא ירח.',
      'Sand rode the wind and swallowed the road, and the small caravan stood without direction, with no path and no moon.',
    ),
    L(
      'naftali',
      'חשבתי שהמדבר הזה שלי. הוא של מי שמתמיד. בוא, אני אתן לך להוביל.',
      'I thought this desert was mine. It belongs to whoever keeps going. Come, I will let you lead.',
    ),
    L(
      'ezra',
      'שמעת? נפתלי מדבר על סבלנות. עוד מעט נראה כוכבים בצהריים.',
      'Did you hear that? Naftali, talking about patience. Next we will see stars at noon.',
    ),
  ]),
  chapter('midbar', 'restored', { he: 'נווה מדבר', en: 'The oasis' }, [
    L(
      'narrator',
      'השיירה הגיעה לנווה מדבר, ובדקל הראשון נשארה לוחית קטנה: "גם כאן היה סופר פעם".',
      'The caravan reached the oasis, and on the first palm a small plaque remained: "A scribe lived here once."',
    ),
    L(
      'naftali',
      'לא ידעתי שאפשר ללכת כל כך לאט ולהגיע כל כך רחוק. אני לא אומר שזה נכון, אבל זה עובד.',
      'I did not know you could walk so slowly and get so far. I am not saying it is right, but it works.',
    ),
  ]),
  chapter('caves', 'start', { he: 'מערות הפנס', en: 'The Lantern Caves' }, [
    L(
      'narrator',
      'המערות היו אפלות וכתובות בגיר, ובקצה כל מסדרון פנס קטן סירב לכבות.',
      'The caves were dark and the chalk was written on, and at the end of every passage a small lantern refused to go out.',
    ),
    L(
      'ezra',
      'פה ללא טעויות. הפנס נשאר דולק רק כשהכתיבה נקייה. אל תמהר, ואל תפחד.',
      'Here, no slips. The lantern burns only while the writing is clean. Do not hurry, and do not be afraid.',
    ),
    L(
      'dyo',
      'אני לא מפחד. אני רק... קטן מאוד, ומאוד, מאוד שקט.',
      'I am not afraid. I am only... very small, and very, very quiet.',
    ),
  ]),
  chapter('caves', 'restored', { he: 'הפנס דולק', en: 'The lantern burns' }, [
    L(
      'narrator',
      'במערה האחרונה נמצא ארון עץ, ובתוכו ספר שרוף בחלקו, ועל השער נכתב: "ספרי החיים של השומר".',
      'In the last cave a wooden chest was found, and in it a book half burned, and on its cover: "The Life’s Work of the Keeper".',
    ),
    L(
      'ezra',
      'כך הוא איבד את הכול. אש. ועכשיו הוא מוחק את כל הארץ כדי שלא תישרף. הוא טועה, אבל אני מבין אותו.',
      'So that is how he lost everything. Fire. And now he erases the whole land so it can never burn. He is wrong, but I understand him.',
    ),
  ]),
  // ---------------------------------------------------------------- Act Three
  chapter('arena', 'start', { he: 'הזירה השותקת', en: 'The Silent Arena' }, [
    L(
      'narrator',
      'הזירה עמדה דוממת כמקודם. שלוש בחינות חיכו בה, וכל אחת שמרה על עוד חלק מהדרך אל המגילה.',
      'The arena lay as silent as before. Three trials waited in it, each guarding one more stretch of the road to the scroll.',
    ),
    L(
      'naftali',
      'אני איתך. לא כי אני אוהב לחכות. כי אתה כבר לא איטי.',
      'I am with you. Not because I like waiting. Because you are not slow any more.',
    ),
    L(
      'ezra',
      'לך, אני אחכה כאן. אני כבר לא צריך להוביל. מי שמלמד היטב יודע מתי לשחרר.',
      'Go. I will wait here. I no longer need to lead. A good teacher knows when to let go.',
    ),
  ]),
  chapter('arena', 'restored', { he: 'שלוש הבחינות', en: 'Three trials passed' }, [
    L(
      'narrator',
      'הנץ, הגולם והגאות נעלמו, ולרגע נראה שהזירה כמעט נושמת.',
      'The hawk, the golem and the tide were gone, and for a moment the arena seemed almost to breathe.',
    ),
    L(
      'dyo',
      'שומע את השקט? הפעם זה לא שקט של שכחה. זה שקט של מי שמחכה למילה הבאה.',
      'Hear the quiet? This time it is not the Fading’s quiet. It is the quiet of someone waiting for the next word.',
    ),
  ]),
  chapter('scroll', 'start', { he: 'המגילה הריקה', en: 'The Blank Scroll' }, [
    L(
      'narrator',
      'בקצה הארץ נפרשה מגילה לבנה, בין שני גלגלים עצומים, ובקצה השני עמד אדם זקן עם נוצה ישנה ביד.',
      'At the edge of the land a white scroll lay unrolled between two great rollers, and at its far end stood an old man with a worn quill in his hand.',
    ),
    L(
      'keeper',
      'באת. אני לא כועס. אני רק עייף, ולכן מחקתי הכול: מה שלא נכתב, לא יאבד.',
      'You have come. I am not angry. I am only tired, and so I erased everything: what is never written can never be lost.',
    ),
    L(
      'ezra',
      'ומה שנכתב, חבר, גם אם נשרף, נשאר בתוכנו. בוא נכתוב לו את מה שאיבד.',
      'And what was written, my friend, even if it burns, stays in us. Let us write him what he lost.',
    ),
  ]),
];

const BY_ID: ReadonlyMap<string, Chapter> = new Map(CHAPTERS.map((c) => [c.id, c]));

/** The chapter with this id, or null. */
export function chapterById(id: string): Chapter | null {
  return BY_ID.get(id) ?? null;
}

/** The chapter that comes before a region opens (`start`) or when it is first restored. */
export function chapterFor(region: string, kind: ChapterKind): Chapter | null {
  return BY_ID.get(`${region}.${kind}`) ?? null;
}

/** The save flag that remembers a chapter was seen. */
export function chapterFlag(id: string): string {
  return `ch:${id}`;
}

/** The act card for a story act (2 or 3); other acts have none here (Act One opens in the intro). */
export function actCard(act: number): Localized | null {
  return act === 2 ? ACT_TWO : act === 3 ? ACT_THREE : null;
}
