/* Hebrew Typing Tutor 2.2 — evidence-based pedagogical engine
   Local-only, deterministic enough for reproducible lessons, no network dependency. */
(function () {
  const VERSION = 1;
  const DAY = 86400000;
  const KEY_TARGET = 0.92;       // desired long-run accuracy
  const CHALLENGE_FLOOR = 0.72;  // don't deliberately train below this
  const CHALLENGE_CEIL = 0.96;   // avoid making exercises trivially easy

  function clamp(v, lo, hi) { return Math.max(lo, Math.min(hi, v)); }
  function now() { return Date.now(); }
  function ensurePedagogyData() {
    if (!appData.pedagogy || typeof appData.pedagogy !== 'object') appData.pedagogy = {};
    const d = appData.pedagogy;
    if (!d.version) d.version = VERSION;
    if (!d.skills) d.skills = {};
    if (!d.bigrams) d.bigrams = {};
    if (!d.trigrams) d.trigrams = {};
    if (!d.words) d.words = {};
    if (!Array.isArray(d.reviews)) d.reviews = [];
    if (!Array.isArray(d.curriculumHistory)) d.curriculumHistory = [];
    if (!d.baseline) d.baseline = { wpm: null, accuracy: null };
    if (!d.settings) d.settings = {
      targetAccuracy: 92, minConfidence: 0.75, dailyMinutes: 15,
      newItemRatio: 0.15, reviewRatio: 0.30, targetedRatio: 0.35
    };
    return d;
  }

  function itemRecord(bucket, id) {
    const d = ensurePedagogyData();
    const obj = d[bucket];
    if (!obj[id]) obj[id] = {
      attempts: 0, correct: 0, ewmaAccuracy: 0.5,
      meanMs: 0, varianceMs: 0, confidence: 0,
      lastSeen: 0, lastCorrect: 0, consecutiveCorrect: 0,
      consecutiveWrong: 0, intervalDays: 0, nextReview: 0,
      retentionAttempts: 0, retentionCorrect: 0
    };
    return obj[id];
  }

  // Exponentially weighted estimates react to recent performance without
  // throwing away history. Speed is tracked with Welford-style variance.
  function observe(bucket, id, correct, dt, opts) {
    const r = itemRecord(bucket, id);
    const alpha = opts && opts.alpha || 0.20;
    r.attempts++;
    if (correct) {
      r.correct++;
      r.consecutiveCorrect++;
      r.consecutiveWrong = 0;
      r.lastCorrect = now();
    } else {
      r.consecutiveWrong++;
      r.consecutiveCorrect = 0;
    }
    r.ewmaAccuracy = r.attempts === 1
      ? (correct ? 1 : 0)
      : r.ewmaAccuracy * (1 - alpha) + (correct ? 1 : 0) * alpha;
    if (dt > 0 && dt < 5000) {
      if (!r.meanMs) r.meanMs = dt;
      else {
        const oldMean = r.meanMs;
        r.meanMs += (dt - r.meanMs) * 0.15;
        r.varianceMs += (dt - oldMean) * (dt - r.meanMs);
      }
    }
    r.lastSeen = now();
    r.confidence = clamp(1 - Math.exp(-r.attempts / 8), 0, 1);
    updateSchedule(r, correct);
    return r;
  }

  function updateSchedule(r, correct) {
    if (!correct) {
      r.intervalDays = Math.max(1, Math.min(3, r.intervalDays || 1));
      r.nextReview = now() + r.intervalDays * DAY;
      return;
    }
    const quality = clamp((r.ewmaAccuracy * 0.75) + (r.consecutiveCorrect >= 3 ? 0.15 : 0) +
      (r.confidence * 0.10), 0, 1);
    const steps = [1, 2, 4, 7, 14, 30, 60];
    let idx = steps.findIndex(x => x >= Math.max(1, Math.round((r.intervalDays || 1) * (1.2 + quality * 1.8))));
    if (idx < 0) idx = steps.length - 1;
    r.intervalDays = steps[idx];
    r.nextReview = now() + r.intervalDays * DAY;
  }

  function mastery(bucket, id) {
    const r = ensurePedagogyData()[bucket][id];
    if (!r || !r.attempts) return { score: 0, confidence: 0, state: 'new' };
    const acc = r.ewmaAccuracy;
    const speed = r.meanMs ? clamp((1000 - r.meanMs) / 750, 0, 1) : 0.5;
    const recency = r.lastSeen ? Math.exp(-(now() - r.lastSeen) / (14 * DAY)) : 0;
    const retention = r.retentionAttempts ? r.retentionCorrect / r.retentionAttempts : 0.5;
    const score = Math.round(clamp(
      acc * 58 + speed * 17 + r.confidence * 12 + retention * 13 + recency * 5, 0, 100
    ));
    let state = 'learning';
    if (r.confidence < 0.45) state = 'learning';
    else if (score < 65) state = 'developing';
    else if (score < 82) state = 'proficient';
    else if (score < 92 || !r.retentionAttempts) state = 'mastered';
    else state = 'maintenance';
    return { score, confidence: r.confidence, state, accuracy: Math.round(acc * 1000) / 10 };
  }

  function priority(bucket, id, opts) {
    const d = ensurePedagogyData();
    const r = d[bucket][id];
    if (!r || !r.attempts) return 0.65;
    const m = mastery(bucket, id);
    const due = r.nextReview && r.nextReview <= now() ? 1 : 0;
    const overdue = r.nextReview ? clamp((now() - r.nextReview) / (7 * DAY), 0, 1) : 0;
    const uncertainty = 1 - r.confidence;
    const error = 1 - r.ewmaAccuracy;
    const recencyPenalty = r.lastSeen ? clamp((now() - r.lastSeen) / (21 * DAY), 0, 1) : 0.5;
    return clamp(
      (opts && opts.retention ? due * 0.40 + overdue * 0.20 : 0) +
      error * 0.30 + uncertainty * 0.18 + recencyPenalty * 0.12 +
      (m.score < 70 ? 0.10 : 0), 0, 1.5
    );
  }

  function record(bucket, id, correct, dt, opts) {
    const r = observe(bucket, id, correct, Number(dt) || 0, opts);
    ensurePedagogyData();
    scheduleSaveData();
    return r;
  }

  function getAllKnownChars() {
    return typeof getKnownKeys === 'function' ? Array.from(getKnownKeys()).filter(Boolean) : [];
  }

  function chooseWeighted(items, scorer, count) {
    return items.map(x => ({ x, w: Math.max(0.01, scorer(x)) }))
      .sort((a,b) => b.w-a.w).slice(0, Math.max(count, 1)).map(x => x.x);
  }

  function weakChars(count) {
    return chooseWeighted(getAllKnownChars(), ch => priority('skills', ch, {retention:true}), count || 6);
  }
  function dueChars(count) {
    const d = ensurePedagogyData(), known = getAllKnownChars();
    return known.filter(ch => d.skills[ch] && d.skills[ch].nextReview && d.skills[ch].nextReview <= now())
      .sort((a,b) => priority('skills',b,{retention:true})-priority('skills',a,{retention:true}))
      .slice(0,count || 8);
  }

  function adaptiveDifficulty() {
    const sessions = (appData.sessions || []).slice(-8);
    if (!sessions.length) return { level: 0.25, label: 'היכרות', targetAccuracy: 95 };
    const acc = sessions.reduce((s,x)=>s+(Number(x.accuracy)||0),0)/sessions.length;
    const wpm = sessions.reduce((s,x)=>s+(Number(x.netWpm ?? x.wpm)||0),0)/sessions.length;
    const fatigue = sessions.reduce((s,x)=>s+(x.recentAccuracy == null ? acc : x.recentAccuracy),0)/sessions.length;
    let level = clamp((acc-72)/25,0,1);
    if (acc >= 97 && wpm >= 30) level += 0.15;
    if (acc < 90 || fatigue < 90) level -= 0.20;
    level = clamp(level,0,1);
    return {
      level,
      targetAccuracy: Math.round(clamp(95 - level * 4, 88, 96)),
      acc: Math.round(acc*10)/10,
      wpm: Math.round(wpm*10)/10,
      fatigue: Math.round(fatigue*10)/10,
      label: level < .25 ? 'מבוקר' : level < .55 ? 'מתפתח' : level < .8 ? 'מאתגר' : 'מתקדם'
    };
  }

  function naturalWords(level, count) {
    const bankKey = level >= .8 ? 'advanced' : level >= .45 ? 'medium' : 'short';
    return generateWordDrill(getAllKnownChars(), bankKey, count);
  }

  function buildPedagogicalExercise(minutes, mode) {
    ensurePedagogyData();
    minutes = Math.max(2, Number(minutes)||15);
    const diff = adaptiveDifficulty();
    const known = getAllKnownChars();
    const due = dueChars(8), weak = weakChars(6);
    const uncertain = chooseWeighted(known, ch => 1 - (mastery('skills',ch).confidence || 0), 5);
    const approx = Math.max(30, Math.round(minutes * 42));
    const warmLen = Math.max(12, Math.round(approx * 0.12));
    const reviewLen = Math.max(18, Math.round(approx * (due.length ? .28 : .18)));
    const targetLen = Math.max(24, Math.round(approx * .30));
    const naturalLen = Math.max(24, approx - warmLen - reviewLen - targetLen);
    const blocks = [];
    blocks.push(generateCharDrill(known, warmLen, []));
    blocks.push(generateCharDrill(known, reviewLen, Array.from(new Set(due.concat(weak)))));
    const weakBg = typeof getWeakBigrams === 'function' ? getWeakBigrams(5).map(x=>x.bg) : [];
    if (weakBg.length && diff.level >= .2) {
      blocks.push(generateBigramDrill(weakBg));
    } else {
      blocks.push(generateCharDrill(known, targetLen, uncertain.concat(weak)));
    }
    blocks.push(naturalWords(diff.level, Math.max(5, Math.round(naturalLen/7))));
    return {
      text: blocks.filter(Boolean).join('  '),
      difficulty: diff,
      focus: {due, weak, uncertain},
      targetAccuracy: diff.targetAccuracy,
      mode: mode || 'adaptive',
      createdAt: now()
    };
  }

  function buildDailyCurriculum(minutes) {
    ensurePedagogyData();
    minutes = Math.max(5, Number(minutes)||appData.goals?.dailyMinutes||15);
    const total = Math.round(minutes);
    const allocations = [
      ['warmup', Math.max(1,Math.round(total*.10)), 'חימום וקצב'],
      ['retention', Math.max(1,Math.round(total*.25)), 'חזרה מרווחת'],
      ['targeted', Math.max(1,Math.round(total*.30)), 'תיקון חולשות'],
      ['natural', Math.max(1,Math.round(total*.25)), 'עברית טבעית'],
      ['check', Math.max(1,total-Math.round(total*.90)), 'בדיקת למידה']
    ];
    let used=allocations.reduce((s,x)=>s+x[1],0);
    allocations[allocations.length-1][1]=Math.max(1,allocations[allocations.length-1][1]+total-used);
    const plan = {
      date: typeof localDateKey==='function' ? localDateKey() : new Date().toISOString().slice(0,10),
      minutes: total, generatedAt: now(), engineVersion: VERSION,
      difficulty: adaptiveDifficulty(), blocks:[]
    };
    allocations.forEach(([kind,m])=>{
      const ex=buildPedagogicalExercise(m,kind);
      plan.blocks.push({kind,minutes:m,title:{
        warmup:'חימום וקצב',retention:'חזרה מרווחת',targeted:'תיקון חולשות',
        natural:'עברית טבעית',check:'בדיקת למידה'
      }[kind],text:ex.text,difficulty:ex.difficulty,focus:ex.focus});
    });
    ensurePedagogyData().curriculumHistory.push({
      date:plan.date, minutes:plan.minutes, difficulty:plan.difficulty, focus:plan.blocks.map(b=>b.kind)
    });
    const h=ensurePedagogyData().curriculumHistory;
    if(h.length>90) h.splice(0,h.length-90);
    scheduleSaveData();
    return plan;
  }

  function registerRetention(bucket,id,correct,dt) {
    const d=ensurePedagogyData(), r=record(bucket,id,correct,dt,{alpha:.25});
    r.retentionAttempts++; if(correct) r.retentionCorrect++;
    updateSchedule(r,correct);
    return r;
  }

  function analytics() {
    const d=ensurePedagogyData();
    const skills=Object.keys(d.skills);
    const mastered=skills.filter(x=>mastery('skills',x).state==='maintenance').length;
    const proficient=skills.filter(x=>mastery('skills',x).state==='proficient').length;
    const due=skills.filter(x=>d.skills[x].nextReview && d.skills[x].nextReview<=now()).length;
    const retentionAttempts=skills.reduce((s,x)=>s+(d.skills[x].retentionAttempts||0),0);
    const retentionCorrect=skills.reduce((s,x)=>s+(d.skills[x].retentionCorrect||0),0);
    const sessions=(appData.sessions||[]).slice(-14);
    const velocity=sessions.length>=2 ? ((sessions.slice(-5).reduce((s,x)=>s+(x.netWpm??x.wpm??0),0)/Math.max(1,Math.min(5,sessions.length))) -
      (sessions.slice(0,Math.min(5,sessions.length)).reduce((s,x)=>s+(x.netWpm??x.wpm??0),0)/Math.min(5,sessions.length))) : 0;
    return {
      trackedSkills:skills.length, mastered, proficient, due,
      retentionRate:retentionAttempts?Math.round(retentionCorrect/retentionAttempts*1000)/10:null,
      velocity:Math.round(velocity*10)/10,
      difficulty:adaptiveDifficulty()
    };
  }

  window.ensurePedagogyData=ensurePedagogyData;
  window.pedagogyRecordChar=(ch,correct,dt)=>record('skills',ch,correct,dt,{alpha:.20});
  window.pedagogyRecordBigram=(bg,correct,dt)=>record('bigrams',bg,correct,dt,{alpha:.18});
  window.pedagogyRecordTrigram=(tri,correct,dt)=>record('trigrams',tri,correct,dt,{alpha:.15});
  window.pedagogyRecordWord=(word,correct,dt)=>record('words',word,correct,dt,{alpha:.20});
  window.pedagogyRecordRetention=(ch,correct,dt)=>registerRetention('skills',ch,correct,dt);
  window.getPedagogicalMastery=(bucket,id)=>mastery(bucket,id);
  window.getPedagogicalAnalytics=analytics;
  window.getAdaptiveDifficulty=adaptiveDifficulty;
  window.buildPedagogicalExercise=buildPedagogicalExercise;
  window.buildPedagogicalDailyCurriculum=buildDailyCurriculum;
  window.getPedagogyDueChars=dueChars;
  window.getPedagogyWeakChars=weakChars;
})();
