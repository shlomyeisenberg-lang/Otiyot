/* Hebrew Typing Tutor — integrated learning/assessment/teacher engine */
(function(){
  const ADV_VERSION = 2;
  const PROFILE_FIELDS=['charStats','bigramStats','wordStats','trigramStats','skillState','errorMatrix','sessions','sessionSummary','assessments','teacher','progress','achievements','goals','pedagogy'];
  function cloneData(value){
    if (value === undefined) return value;
    try { return typeof structuredClone === 'function' ? structuredClone(value) : JSON.parse(JSON.stringify(value)); }
    catch (e) { return JSON.parse(JSON.stringify(value)); }
  }
  function blankProfile(){
    const d=getDefaultData();
    const out={}; PROFILE_FIELDS.forEach(k=>out[k]=cloneData(d[k])); return out;
  }
  function captureProfile(){
    const out={}; PROFILE_FIELDS.forEach(k=>out[k]=cloneData(appData[k])); return out;
  }
  function restoreProfile(data){
    if(!data) return; PROFILE_FIELDS.forEach(k=>{ if(data[k]!==undefined) appData[k]=cloneData(data[k]); });
  }
  function ensureAdvancedData(){
    if (typeof ensurePedagogyData === 'function') ensurePedagogyData();
    appData.advanced = Object.assign({
      version: ADV_VERSION,
      profiles: [{id:'default',name:'הלומד',role:'student',createdAt:Date.now()}],
      activeProfileId:'default', profileData:{},
      assignments:[], plans:{}, assessmentHistory:[], retentionQueue:[], maintenance:[],
      ergonomics:{enabled:true,acknowledged:false}, learningEvents:[],
      settings:{dailyGoalMinutes:15, weeklyGoalMinutes:75, defaultAccuracy:97, defaultWpm:30}
    }, appData.advanced||{});
    if(!Array.isArray(appData.advanced.profiles)||!appData.advanced.profiles.length) appData.advanced.profiles=[{id:'default',name:'הלומד',role:'student',createdAt:Date.now()}];
    if(!appData.advanced.activeProfileId) appData.advanced.activeProfileId=appData.advanced.profiles[0].id;
    if(!appData.advanced.profileData) appData.advanced.profileData={};
    // One-time migration: the old global dataset becomes the default profile.
    if(!appData.advanced.profileData.default){
      appData.advanced.profileData.default=captureProfile();
      scheduleSaveData();
    }
    appData.advanced.settings = Object.assign({dailyGoalMinutes:15,weeklyGoalMinutes:75,defaultAccuracy:97,defaultWpm:30}, appData.advanced.settings || {});
    appData.advanced.ergonomics = Object.assign({enabled:true,acknowledged:false}, appData.advanced.ergonomics || {});
    if(!appData.advanced.plans || typeof appData.advanced.plans !== 'object') appData.advanced.plans={};
    if(!Array.isArray(appData.advanced.assignments)) appData.advanced.assignments=[];
    if(!Array.isArray(appData.advanced.assessmentHistory)) appData.advanced.assessmentHistory=[];
    if(!Array.isArray(appData.advanced.retentionQueue)) appData.advanced.retentionQueue=[];
    if(!Array.isArray(appData.advanced.maintenance)) appData.advanced.maintenance=[];
    if(!Array.isArray(appData.advanced.learningEvents)) appData.advanced.learningEvents=[];
  }
  function saveActiveProfile(){ ensureAdvancedData(); appData.advanced.profileData[appData.advanced.activeProfileId]=captureProfile(); }
  function switchProfile(id){
    ensureAdvancedData(); if(!appData.advanced.profiles.some(p=>p.id===id)) return false;
    saveActiveProfile(); appData.advanced.activeProfileId=id;
    restoreProfile(appData.advanced.profileData[id] || captureProfile());
    if(!appData.advanced.profileData[id]) appData.advanced.profileData[id]=captureProfile();
    scheduleSaveData(); return true;
  }
  window.switchAdvancedProfile=switchProfile;
  window.saveAdvancedProfile=saveActiveProfile;
  window.ensureAdvancedData=ensureAdvancedData;

  function todayKey(d=new Date()){ return typeof localDateKey==='function' ? localDateKey(d) : `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,'0')}-${String(d.getDate()).padStart(2,'0')}`; }
  function escapeHtml(s){return String(s??'').replace(/[&<>"']/g,m=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[m]))}
  function activeProfile(){ensureAdvancedData();return appData.advanced.profiles.find(p=>p.id===appData.advanced.activeProfileId)||appData.advanced.profiles[0]}
  function recordLearningEvent(type,payload={}){ensureAdvancedData();appData.advanced.learningEvents.push({type,at:Date.now(),profileId:activeProfile().id,...payload});saveActiveProfile();if(appData.advanced.learningEvents.length>2000)appData.advanced.learningEvents.splice(0,appData.advanced.learningEvents.length-2000);scheduleSaveData()}
  window.recordLearningEvent=recordLearningEvent;

  // 4.1: the daily plan is three short blocks with a 20-second hand-shaking
  // pause between them (distributed practice beats one long massed session).
  const PLAN_VERSION = 4;
  function dailyPlan(minutes){
    ensureAdvancedData();
    const p = buildPedagogicalDailyCurriculum(minutes || appData.goals.dailyMinutes || 15);
    return {
      date: p.date, minutes: p.minutes, createdAt: p.generatedAt, version: PLAN_VERSION, distributed: true,
      difficulty: p.difficulty, pieces: p.blocks.map((b,i)=>({
        kind:b.kind, minutes:b.minutes, title:b.title, text:b.text,
        difficulty:b.difficulty, focus:b.focus, index:i
      }))
    };
  }
  window.buildAdvancedDailyPlan=dailyPlan;

  function startAdvancedExercise(piece, returnScreen='dashboardScreen'){
    showScreen('practiceScreen');
    startPracticeRun({text:piece.text,mode:'lesson',title:`${trUi(piece.title)} · ${piece.minutes} ${t('דקות','min')}`,durationLimitMs:piece.minutes*60000,onExit:()=>{showScreen(returnScreen);navigateTo(returnScreen)},onFinish:(metrics)=>{recordLearningEvent('planExercise',{kind:piece.kind,minutes:piece.minutes,accuracy:metrics.accuracy,wpm:metrics.wpm});showResultsScreen(metrics,{onContinue:()=>{showScreen(returnScreen);navigateTo(returnScreen)},onRetry:()=>startAdvancedExercise(piece,returnScreen)})}});
  }
  window.startAdvancedExercise=startAdvancedExercise;

  // ---- 20-second "shake out your hands" pause between plan blocks ----
  const PAUSE_SECONDS = 20;
  let pauseTimer = null, pauseKeys = null;
  function cancelPlanPause(){
    if (pauseTimer) { clearInterval(pauseTimer); pauseTimer = null; }
    if (pauseKeys) { document.removeEventListener('keydown', pauseKeys, true); pauseKeys = null; }
  }
  window.cancelPlanPause = cancelPlanPause;
  function showShakeOutPause(nextPiece, nextIndex, total, onContinue, onStop){
    cancelPlanPause();
    showScreen('resultsScreen');
    const screen = document.getElementById('resultsScreen');
    const tips = [
      [t('הניחו לזרועות לרדת לצדי הגוף ונערו את כפות הידיים בעדינות.','Let your arms hang by your sides and gently shake out your hands.'), '🙌'],
      [t('גלגלו את הכתפיים לאחור כמה פעמים ונשמו עמוק.','Roll your shoulders back a few times and take a deep breath.'), '🔄'],
      [t('פתחו וסגרו את האצבעות לאט, ואז הרפו אותן לגמרי.','Slowly open and close your fingers, then let them go completely loose.'), '🖐️'],
      [t('הסתכלו רגע למרחק — העיניים נחות גם הן.','Look into the distance for a moment — your eyes rest too.'), '👀']
    ];
    let left = PAUSE_SECONDS;
    screen.innerHTML = `<div class="shake-pause" role="timer" aria-live="polite">
        <div class="sp-step">${t(`הפסקה · לפני שלב ${nextIndex+1} מתוך ${total}`, `Break · before block ${nextIndex+1} of ${total}`)}</div>
        <div class="sp-hands" aria-hidden="true"><span>🤚</span><span>✋</span></div>
        <h2>${t('נערו את הידיים','Shake out your hands')}</h2>
        <p class="sp-tip">${tips[0][1]} ${tips[0][0]}</p>
        <div class="sp-ring" style="--p:100"><b id="spCount">${left}</b><small>${t('שנ׳','s')}</small></div>
        <div class="sp-next">${t('הבא','Next')}: <b>${escapeHtml(trUi(nextPiece.title))}</b> · ${nextPiece.minutes} ${t('דק׳','min')}</div>
        <div class="results-actions"><button class="btn primary big" id="spGo">▶ ${t('ממשיכים עכשיו','Continue now')}</button><button class="btn" id="spStop">${t('מספיק להיום','Stop for today')}</button></div>
        <div class="results-keys-hint">${t('Enter = המשך · Esc = סיום','Enter = continue · Esc = stop')}</div>
      </div>`;
    const go = () => { cancelPlanPause(); onContinue(); };
    const stopIt = () => { cancelPlanPause(); onStop(); };
    screen.querySelector('#spGo').onclick = go;
    screen.querySelector('#spStop').onclick = stopIt;
    pauseKeys = (e) => {
      if (screen.style.display === 'none') { cancelPlanPause(); return; }
      if (e.key === 'Enter') { e.preventDefault(); go(); }
      else if (e.key === 'Escape') { e.preventDefault(); stopIt(); }
    };
    setTimeout(() => { if (pauseKeys) document.addEventListener('keydown', pauseKeys, true); }, 400);
    pauseTimer = setInterval(() => {
      if (screen.style.display === 'none' || !document.body.contains(screen.querySelector('#spCount'))) { cancelPlanPause(); return; }
      left--;
      const c = screen.querySelector('#spCount'); if (c) c.textContent = Math.max(0, left);
      const ring = screen.querySelector('.sp-ring'); if (ring) ring.style.setProperty('--p', Math.max(0, Math.round(left / PAUSE_SECONDS * 100)));
      const tip = tips[Math.min(tips.length - 1, Math.floor((PAUSE_SECONDS - left) / (PAUSE_SECONDS / tips.length)))];
      const tipEl = screen.querySelector('.sp-tip'); if (tipEl) tipEl.textContent = tip[1] + ' ' + tip[0];
      if (left <= 0) { playSound('pop'); go(); }
    }, 1000);
  }

  function startAdvancedPlan(plan, returnScreen='todayScreen', index=0){
    const pieces = plan && Array.isArray(plan.pieces) ? plan.pieces : [];
    if (!pieces.length) return;
    const piece = pieces[index];
    const back = ()=>{showScreen(returnScreen);navigateTo(returnScreen)};
    showScreen('practiceScreen');
    startPracticeRun({
      text:piece.text, mode:'curriculum', title:`${trUi(piece.title)} · ${index+1}/${pieces.length}`,
      durationLimitMs:piece.minutes*60000,
      onExit:back,
      onFinish:(metrics)=>{
        recordLearningEvent('curriculumBlock',{kind:piece.kind,index,minutes:piece.minutes,
          accuracy:metrics.accuracy,wpm:metrics.netWpm||metrics.wpm,difficulty:piece.difficulty && {level:piece.difficulty.level,label:piece.difficulty.label}});
        if(index+1<pieces.length){
          showShakeOutPause(pieces[index+1], index+1, pieces.length, ()=>startAdvancedPlan(plan,returnScreen,index+1), back);
        } else {
          showResultsScreen(metrics,{
            onContinue:back,
            onRetry:()=>startAdvancedPlan(plan,returnScreen,index)
          });
        }
      }
    });
  }
  window.startAdvancedPlan=startAdvancedPlan;

  function renderTodayScreen(container){
    ensureAdvancedData();
    let p=appData.advanced.plans[todayKey()];
    if(!p || (Number(p.version)||0) < PLAN_VERSION || !Array.isArray(p.pieces)) p=dailyPlan(getDailyGoalMinutes());
    appData.advanced.plans[todayKey()]=p; Object.keys(appData.advanced.plans).forEach(k=>{ if(k!==todayKey()) delete appData.advanced.plans[k]; }); /* 3.0: old daily plans (with their full texts) used to pile up in storage forever */
    const due=getDueForReview(10), weak=getWeakCharacters(5);
    const today=localDateKey();
    const todayMs=appData.sessions.filter(s=>localDateKey(new Date(s.date))===today).reduce((sum,s)=>sum+(s.durationMs||0),0);
    const goalMin=getDailyGoalMinutes();
    const goalPct=Math.min(100,Math.round(todayMs/60000/goalMin*100));
    const totalMin=p.pieces.reduce((n,x)=>n+(Number(x.minutes)||0),0);
    const steps = p.pieces.map((x,i)=>`<li class="plan-step"><span class="ps-num">${i+1}</span><span class="ps-title">${escapeHtml(trUi(x.title))}</span><span class="ps-min">${x.minutes} ${t('דק׳','min')}</span><button class="btn-chip" data-i="${i}">${t('התחל','Start')}</button></li>` +
      (i < p.pieces.length-1 ? `<li class="plan-pause" aria-hidden="true"><span>🙌</span>${t('הפסקה: נערו את הידיים · 20 שנ׳','Break: shake out your hands · 20 s')}</li>` : '')).join('');
    container.innerHTML=`<h2>${t('התוכנית של היום','Today\'s plan')}</h2><p class="empty-note">${t('שלושה בלוקים קצרים לפי הנתונים שלכם — חימום וחזרה, מילים נפוצות וטקסט טבעי — עם הפסקה קצרה ביניהם. תרגול מפוזר נשמר טוב יותר מתרגול רצוף אחד.','Three short blocks built from your data — warm-up & review, frequent words and natural text — with a short break between them. Spaced-out practice sticks better than one long session.')}</p>
      <div class="hero-card today-hero">
        <div class="th-goal">
          <div class="th-goal-row"><b>${Math.round(todayMs/60000*10)/10}</b><span>/ ${goalMin} ${t('דקות היום','minutes today')}</span></div>
          <div class="level-progress-bar"><div class="level-progress-fill" style="width:${goalPct}%"></div></div>
          <div class="th-meta">${t('רמת אתגר','Challenge level')}: <b>${p.difficulty ? escapeHtml(trUi(p.difficulty.label || "")) : trUi("מותאם")}</b> · ${t('כ־','about ')}${totalMin} ${t('דק׳','min')}</div>
        </div>
        <div class="th-actions"><button class="btn primary big" id="startPlan">${t('התחל תוכנית','Start plan')}</button><button class="btn ghost" id="regenPlan">${t('בנה מחדש','Rebuild')}</button></div>
      </div>
      <div class="dash-section"><h3>${t('שלבי היום','Today\'s blocks')}</h3><ol class="plan-steps">${steps}</ol></div>
      <div class="two-col"><div class="dash-section"><h3>${t('חזרות שמגיעות','Reviews due')}</h3>${due.length?'<div class="word-chip-list">'+due.map(x=>`<span class="word-chip">${escapeHtml(x.ch)} · ${x.mastery}%</span>`).join('')+'</div>':`<p class="empty-note">${t('אין כרגע חזרות דחופות.','No urgent reviews right now.')}</p>`}</div>
      <div class="dash-section"><h3>${t('החולשות המרכזיות','Main weak spots')}</h3>${weak.length?'<div class="word-chip-list">'+weak.map(x=>`<span class="word-chip">${escapeHtml(x.ch)} · ${x.score}%</span>`).join('')+'</div>':`<p class="empty-note">${t('עוד לא נאספו מספיק נתונים.','Not enough data yet.')}</p>`}</div></div>`;
    container.querySelector('#startPlan').onclick=()=>startAdvancedPlan(p,'todayScreen',0);
    container.querySelector('#regenPlan').onclick=()=>{appData.advanced.plans[todayKey()]=dailyPlan(getDailyGoalMinutes());scheduleSaveData();renderTodayScreen(container)};
    container.querySelectorAll('[data-i]').forEach(b=>b.onclick=()=>startAdvancedExercise(p.pieces[Number(b.dataset.i)],'todayScreen'));
  }
  window.renderTodayScreen=renderTodayScreen;

  // ---- 4.1: the former "Learning lab" now lives in Home → "What to strengthen" ----
  function renderLearningLabSummary(el){
    if(!el) return;
    ensureAdvancedData(); const ss=appData.sessionSummary; const avgA=ss.count?ss.totalAccuracy/ss.count:0, avgW=ss.count?ss.totalWpm/ss.count:0; const ped=typeof getPedagogicalAnalytics==='function'?getPedagogicalAnalytics():null;
    const due=getDueForReview(20);
    const retained=Object.values(appData.skillState||{}).filter(x=>x.retentionChecks>0).length;
    const mastered=Object.keys(appData.charStats||{}).filter(ch=>getSkillState(ch)==='MAINTENANCE').length;
    el.innerHTML=`<h3>${t('תמונת הלמידה','Learning snapshot')}</h3>
      <div class="dash-summary lab-summary">
        <div class="dash-stat"><div class="dash-val">${ped?escapeHtml(trUi(ped.difficulty.label)):"—"}</div><div class="dash-lbl">${t('רמת אתגר','Challenge level')}</div></div>
        <div class="dash-stat"><div class="dash-val">${mastered}</div><div class="dash-lbl">${t('מיומנויות בתחזוקה','Skills in maintenance')}</div></div>
        <div class="dash-stat"><div class="dash-val">${ped&&ped.retentionRate!=null?ped.retentionRate+"%":"—"}</div><div class="dash-lbl">${t('שיעור שימור','Retention rate')}</div></div>
        <div class="dash-stat"><div class="dash-val">${ped?(ped.velocity>=0?"+":"")+ped.velocity:"—"}</div><div class="dash-lbl">${t('מ״לד: שינוי אחרון','WPM: recent change')}</div></div>
        <div class="dash-stat"><div class="dash-val">${ped?ped.trackedSkills:0}</div><div class="dash-lbl">${t('מיומנויות במודל','Skills tracked')}</div></div>
        <div class="dash-stat"><div class="dash-val">${retained}</div><div class="dash-lbl">${t('נבדקו לאחר דחייה','Checked after a delay')}</div></div>
      </div>
      <p class="lab-narrative">${buildAnalyticsNarrative(avgW,avgA,due.length)}</p>`;
  }
  function renderRecentSessionsTable(el){
    if(!el) return;
    const sessions=appData.sessions.slice(-15).reverse();
    el.innerHTML=`<h3>${t('סשנים אחרונים','Recent sessions')}</h3>${sessions.length?`<table class="data-table"><tr><th>${t('תאריך','Date')}</th><th>${t('מצב','Mode')}</th><th>${t('מ״לד','WPM')}</th><th>${t('דיוק','Accuracy')}</th><th>${t('משך','Duration')}</th></tr>${sessions.map(s=>`<tr><td>${new Date(s.date).toLocaleString(uiLocale())}</td><td>${escapeHtml(s.mode||'')}</td><td>${s.netWpm??s.wpm??0}</td><td>${s.accuracy??0}%</td><td>${Math.round((s.durationMs||0)/1000)} ${t('שנ׳','s')}</td></tr>`).join('')}</table>`:`<p class="empty-note">${t('אין עדיין סשנים.','No sessions yet.')}</p>`}`;
  }
  function buildAnalyticsNarrative(w,a,due){
    if(!appData.sessions.length) return t('המערכת עדיין אוספת נתונים. בצעו כמה תרגולים לפני קבלת מסקנות.','Still collecting data. Do a few sessions before drawing conclusions.');
    if(a<94) return t('הנתונים מצביעים שהעדיפות כרגע היא דיוק ושליטה בתנועות. המערכת תטה לתרגול מבוקר יותר לפני העלאת דרישת המהירות.','The data says accuracy and control come first right now. Practice will stay more controlled before speed demands go up.');
    if(due>3) return t(`יש ${due} מיומנויות שמגיעות לחזרה. כדאי לשמר אותן לפני שמוסיפים חומר חדש.`,`${due} skills are due for review. Keep them fresh before adding new material.`);
    if(w<25) return t('הדיוק נראה יציב, ולכן אפשר להתחיל להעלות בהדרגה את מורכבות המעברים והמילים.','Accuracy looks steady, so transitions and words can gradually get harder.');
    return t('הביצועים נראים מאוזנים. המערכת יכולה לשלב יותר טקסט טבעי, מעברים מורכבים ובדיקות שמירה על היכולת.','Performance looks balanced. More natural text, complex transitions and retention checks can be mixed in.');
  }
  window.renderLearningLabSummary=renderLearningLabSummary;
  window.renderRecentSessionsTable=renderRecentSessionsTable;
  // legacy entry point (kept so nothing that still calls it breaks)
  window.renderAnalyticsScreen=function(container){ window.__dashTab='weak'; navigateTo('dashboardScreen'); };

  // ---- 4.1: "Progress check" — quick test + pre/post assessment + maintenance check ----
  const PROGRESS_TABS = [
    { id: 'test', he: 'בדיקה מהירה', en: 'Quick test', icon: '⏱️' },
    { id: 'assess', he: 'הערכה לפני / אחרי', en: 'Pre / post assessment', icon: '📋' },
    { id: 'maint', he: 'בדיקת תחזוקה', en: 'Maintenance check', icon: '🔁' }
  ];
  function progressPane(tab){ return document.querySelector(`#progressScreen .dash-pane[data-pane="${tab}"]`); }
  function openProgressTab(tab, after){
    window.__progressTab = tab;
    navigateTo('progressScreen');
    if (after) { const pane = progressPane(tab); if (pane) { after(pane); if (typeof translateDocument === 'function') translateDocument(document); } }
  }
  window.openProgressTab = openProgressTab;
  function renderProgressScreen(container){
    ensureAdvancedData();
    const tab = PROGRESS_TABS.some(x=>x.id===window.__progressTab) ? window.__progressTab : 'test';
    const lastTest = (appData.sessions||[]).filter(s=>s.mode==='test').slice(-1)[0];
    const lastAssess = appData.advanced.assessmentHistory.filter(x=>x.type!=='comparison').slice(-1)[0];
    const lastMaint = appData.advanced.maintenance.slice(-1)[0];
    const when = x => x ? new Date(x.at || x.date).toLocaleDateString(uiLocale()) : '—';
    container.innerHTML = `<div class="page-head"><h2>${t('בדיקת התקדמות','Progress check')}</h2></div>
      <p class="empty-note">${t('שלוש דרכים למדוד: מבחן מהיר בזמן קצוב, הערכת למידה לפני ואחרי אימון, ובדיקה שמיומנויות ישנות נשמרו.','Three ways to measure: a quick timed test, a before/after learning assessment, and a check that older skills are retained.')}</p>
      <div class="progress-overview">
        <div class="po-card"><span>⏱️</span><b>${lastTest ? (lastTest.netWpm ?? lastTest.wpm) + ' ' + t('מ״לד','WPM') + ' · ' + lastTest.accuracy + '%' : '—'}</b><small>${t('מבחן אחרון','Last test')} · ${when(lastTest)}</small></div>
        <div class="po-card"><span>📋</span><b>${lastAssess ? lastAssess.wpm + ' ' + t('מ״לד','WPM') + ' · ' + lastAssess.accuracy + '%' : '—'}</b><small>${t('הערכה אחרונה','Last assessment')} · ${when(lastAssess)}</small></div>
        <div class="po-card"><span>🔁</span><b>${lastMaint ? lastMaint.wpm + ' ' + t('מ״לד','WPM') + ' · ' + lastMaint.accuracy + '%' : '—'}</b><small>${t('תחזוקה אחרונה','Last maintenance')} · ${when(lastMaint)}</small></div>
      </div>
      <div class="seg-tabs" role="tablist" id="progressTabs">${PROGRESS_TABS.map(x=>`<button type="button" role="tab" class="seg-btn${x.id===tab?' active':''}" data-tab="${x.id}" aria-selected="${x.id===tab}">${x.icon} ${t(x.he,x.en)}</button>`).join('')}</div>
      ${PROGRESS_TABS.map(x=>`<div class="dash-pane progress-pane${x.id===tab?' active':''}" data-pane="${x.id}" role="tabpanel"></div>`).join('')}`;
    renderTestScreen(progressPane('test'));
    renderAssessmentScreen(progressPane('assess'));
    renderMaintenanceScreen(progressPane('maint'));
    container.querySelectorAll('#progressTabs .seg-btn').forEach(btn=>btn.addEventListener('click',()=>{
      window.__progressTab = btn.dataset.tab;
      container.querySelectorAll('#progressTabs .seg-btn').forEach(b=>{ const on=b===btn; b.classList.toggle('active',on); b.setAttribute('aria-selected',on); });
      container.querySelectorAll('.progress-pane').forEach(p=>p.classList.toggle('active',p.dataset.pane===btn.dataset.tab));
    }));
  }
  window.renderProgressScreen=renderProgressScreen;

  function renderAssessmentScreen(container){
    ensureAdvancedData();
    const last=appData.advanced.assessmentHistory.slice(-3).reverse();
    const pending = appData.advanced.pendingAssessment;
    container.innerHTML=`<div class="hero-card assess-hero"><h3>${t('מדידת למידה אמיתית','Measuring real learning')}</h3><p>${t('המבחן כולל pre-test, תרגול, post-test ובדיקה דחויה. ציון מבחן אינו המדד היחיד להתקדמות.','Pre-test, focused training, post-test and a delayed check. A single test score is not the only measure of progress.')}</p>${pending ? `<button class="btn primary" id="resumeTrain">${t('המשך לשלב האימון','Continue to the training step')}</button> ` : ''}<button class="btn ${pending ? '' : 'primary'}" id="pretest">${t('התחל Pre-Test','Start Pre-Test')}</button></div><div class="dash-section"><h3>${t('הערכות קודמות','Previous assessments')}</h3>${last.length?`<table class="data-table"><tr><th>${t('תאריך','Date')}</th><th>${t('סוג','Type')}</th><th>${t('מ״לד','WPM')}</th><th>${t('דיוק','Accuracy')}</th></tr>${last.map(x=>`<tr><td>${new Date(x.at).toLocaleDateString(uiLocale())}</td><td>${escapeHtml(x.type)}</td><td>${x.wpm ?? (x.delta ? (x.delta.wpm>=0?'+':'')+Math.round(x.delta.wpm) : '—')}</td><td>${x.accuracy != null ? x.accuracy + '%' : (x.delta ? (x.delta.accuracy>=0?'+':'')+Math.round(x.delta.accuracy*10)/10+'%' : '—')}</td></tr>`).join('')}</table>`:`<p class="empty-note">${t('אין עדיין הערכות.','No assessments yet.')}</p>`}</div>`;
    container.querySelector('#pretest').onclick=()=>runAssessmentStage('pre');
    const rt = container.querySelector('#resumeTrain'); if (rt) rt.onclick=()=>renderAssessmentTraining(container, pending.id);
  }
  function assessmentText(){return buildTestText('paragraph',Math.max(180,120+getActiveLevel()*40));}
  function runAssessmentStage(type,assessmentId){
    const id=assessmentId||`A-${Date.now()}`; const text=assessmentText(); showScreen('practiceScreen');
    startPracticeRun({text,mode:'assessment',noBlind:false,durationLimitMs:60000,title:type==='pre'?t('Pre-Test — דקה','Pre-Test — 1 minute'):t('Post-Test — דקה','Post-Test — 1 minute'),onExit:()=>openProgressTab('assess'),onFinish:(metrics)=>{
      appData.advanced.assessmentHistory.push({id,type,at:Date.now(),wpm:metrics.wpm,netWpm:metrics.netWpm,accuracy:metrics.accuracy,durationMs:metrics.elapsedMs});
      if(type==='pre'){appData.advanced.pendingAssessment={id,pre:metrics};scheduleSaveData();otzShowMessage(t('ה-Pre-Test נשמר. עכשיו בצעו תרגול ממוקד לפני ה-Post-Test.','Pre-Test saved. Now do focused practice before the Post-Test.'),'success');openProgressTab('assess',pane=>renderAssessmentTraining(pane,id))}
      else {const pre=appData.advanced.pendingAssessment?.pre;const delta=pre?{wpm:metrics.wpm-pre.wpm,accuracy:metrics.accuracy-pre.accuracy}:null;appData.advanced.assessmentHistory.push({id,type:'comparison',at:Date.now(),delta});delete appData.advanced.pendingAssessment;scheduleSaveData();openProgressTab('assess',pane=>showAssessmentComparison(pane,pre,metrics,delta))}
    }});
  }
  function renderAssessmentTraining(container,id){
    container.innerHTML=`<div class="hero-card"><h3>${t('שלב האימון','Training step')}</h3><p>${t('המערכת בחרה אימון קצר המבוסס על הביצוע. המטרה היא לשפר את היכולת, לא רק את הציון.','A short training block chosen from your result. The goal is to improve the skill, not only the score.')}</p><button class="btn primary" id="train">${t('התחל אימון ממוקד','Start focused training')}</button></div>`;
    container.querySelector('#train').onclick=()=>{const weak=getWeakCharacters(5).map(x=>x.ch);showScreen('practiceScreen');startPracticeRun({text:generateCharDrill(getKnownKeys(),120,weak),mode:'assessment-training',durationLimitMs:180000,title:t('אימון ממוקד','Focused training'),onExit:()=>openProgressTab('assess'),onFinish:()=>{runAssessmentStage('post',id)}})};
  }
  function showAssessmentComparison(container,pre,post,delta){
    container.innerHTML=`<h3>Post-Test</h3><div class="results-grid"><div class="result-box"><div class="result-val">${post.wpm}</div><div class="result-lbl">${t('מ״לד אחרי','WPM after')}</div></div><div class="result-box"><div class="result-val">${post.accuracy}%</div><div class="result-lbl">${t('דיוק אחרי','Accuracy after')}</div></div><div class="result-box"><div class="result-val">${delta?((delta.wpm>=0?'+':'')+Math.round(delta.wpm)): '—'}</div><div class="result-lbl">${t('שינוי מ״לד','WPM change')}</div></div><div class="result-box"><div class="result-val">${delta?((delta.accuracy>=0?'+':'')+Math.round(delta.accuracy*10)/10)+'%':'—'}</div><div class="result-lbl">${t('שינוי דיוק','Accuracy change')}</div></div></div><p class="results-reco">${t('הבדיקה הדחויה תיבנה אוטומטית בתור חזרה עתידית כדי לבדוק אם השיפור נשמר.','A delayed check is queued automatically to see whether the improvement holds.')}</p><button class="btn primary" id="done">${t('סיום','Done')}</button>`;
    container.querySelector('#done').onclick=()=>renderAssessmentScreen(container); scheduleSaveData();
  }
  window.renderAssessmentScreen=renderAssessmentScreen;

  function renderMaintenanceScreen(container){
    ensureAdvancedData();
    const due=getDueForReview(12), last=appData.advanced.maintenance.slice(-10).reverse();
    container.innerHTML=`<p class="empty-note">${t('גם מיומנויות שהושלמו צריכות תחזוקה. המערכת מציגה אותן מחדש כאשר יש סימני ירידה או כאשר הגיע מועד הבדיקה.','Completed skills need upkeep too. They come back when there are signs of decline or when a check is due.')}</p><div class="hero-card quick-practice-buttons"><button class="btn primary" id="mTest">${t('בדיקת תחזוקה (2 דק׳)','Maintenance check (2 min)')}</button><button class="btn" id="m5">${t('תחזוקה 5 דקות','Maintenance 5 min')}</button><button class="btn" id="m10">${t('תחזוקה 10 דקות','Maintenance 10 min')}</button></div><div class="dash-section"><h3>${t('מיומנויות שדורשות תשומת לב','Skills that need attention')}</h3>${due.length?'<div class="word-chip-list">'+due.map(x=>`<span class="word-chip">${escapeHtml(x.ch)} · ${x.mastery}%</span>`).join('')+'</div>':`<p class="empty-note">${t('אין כרגע מיומנויות דחופות.','No urgent skills right now.')}</p>`}</div><div class="dash-section"><h3>${t('היסטוריית תחזוקה','Maintenance history')}</h3>${last.length?`<table class="data-table"><tr><th>${t('תאריך','Date')}</th><th>${t('משך','Duration')}</th><th>${t('דיוק','Accuracy')}</th><th>${t('מ״לד','WPM')}</th></tr>${last.map(x=>`<tr><td>${new Date(x.at).toLocaleDateString(uiLocale())}</td><td>${x.minutes}</td><td>${x.accuracy}%</td><td>${x.wpm}</td></tr>`).join('')}</table>`:`<p class="empty-note">${t('אין עדיין סשני תחזוקה.','No maintenance sessions yet.')}</p>`}</div>`;
    const back=()=>openProgressTab('maint');
    const start=(minutes)=>{const text=generateAdaptiveExercise(Math.max(5,getActiveLevel()));showScreen('practiceScreen');startPracticeRun({text,mode:'maintenance',durationLimitMs:minutes*60000,title:t(`תחזוקה — ${minutes} דקות`,`Maintenance — ${minutes} min`),onExit:back,onFinish:m=>{appData.advanced.maintenance.push({at:Date.now(),minutes,accuracy:m.accuracy,wpm:m.wpm});recordLearningEvent('maintenance',{minutes,accuracy:m.accuracy,wpm:m.wpm});showResultsScreen(m,{onContinue:back,onRetry:()=>start(minutes)})}})};
    container.querySelector('#m5').onclick=()=>start(5);container.querySelector('#m10').onclick=()=>start(10);container.querySelector('#mTest').onclick=()=>start(2);
  }
  window.renderMaintenanceScreen=renderMaintenanceScreen;

  function renderTeacherScreen(container){
    ensureAdvancedData(); const a=appData.advanced, prof=activeProfile(), students=a.profiles.filter(p=>p.role==='student');
    container.innerHTML=`<h2>מצב מורה / מנהל</h2><div class="hero-card"><p>הנתונים נשמרים מקומית. אפשר ליצור פרופילי תלמידים, להגדיר יעד, להקצות אימון ולייצא דוח.</p><div class="teacher-form"><input id="studentName" placeholder="שם תלמיד"><button class="btn primary" id="addStudent">הוסף תלמיד</button></div></div><div class="dash-section"><h3>תלמידים</h3>${students.length?'':`<p class="empty-note">${t('עוד אין תלמידים. הוסיפו תלמיד כדי לנהל פרופילים נפרדים.','No students yet. Add one to keep separate profiles.')}</p>`}<div class="student-list">${students.map(s=>`<div class="student-row"><b>${escapeHtml(profileDisplayName(s.name))}</b><span>${s.id===prof.id?t('פעיל','Active'):''}</span><button class="btn-chip" data-student="${s.id}">בחר</button><button class="btn-chip" data-report="${s.id}">דוח</button></div>`).join('')}</div></div><div class="dash-section"><h3>יעדי המורה</h3><div class="goals-form"><label>${t('דיוק','Accuracy')} <input id="teacherAcc" type="number" min="80" max="100" value="${a.settings.defaultAccuracy}"></label><label>מ״לד <input id="teacherWpm" type="number" min="5" max="200" value="${a.settings.defaultWpm}"></label><label>דקות ביום <input id="teacherMin" type="number" min="2" max="180" value="${a.settings.dailyGoalMinutes}"></label><button class="btn" id="saveTeacher">שמור</button></div></div><div id="teacherReport"></div>`;
    container.querySelector('#addStudent').onclick=()=>{const n=container.querySelector('#studentName').value.trim();if(!n)return;const id='student-'+Date.now();a.profiles.push({id,name:n,role:'student',createdAt:Date.now()}); a.profileData[id]=blankProfile(); scheduleSaveData(); renderTeacherScreen(container)};
    container.querySelectorAll('[data-student]').forEach(b=>b.onclick=()=>{switchProfile(b.dataset.student);refreshHeaderStatus();renderTeacherScreen(container)});
    container.querySelectorAll('[data-report]').forEach(b=>b.onclick=()=>renderTeacherReport(container,b.dataset.report));
    container.querySelector('#saveTeacher').onclick=()=>{a.settings.defaultAccuracy=Number(container.querySelector('#teacherAcc').value);a.settings.defaultWpm=Number(container.querySelector('#teacherWpm').value);a.settings.dailyGoalMinutes=Number(container.querySelector('#teacherMin').value);scheduleSaveData();otzShowMessage(t('היעדים נשמרו','Goals saved'),'success')};
  }
  function renderTeacherReport(container,id){const s=appData.advanced.profiles.find(p=>p.id===id);if(!s)return; if(id===appData.advanced.activeProfileId) saveActiveProfile(); const profile=appData.advanced.profileData[id]||{}; const sessions=(profile.sessions||[]).slice(-20); const stats={charStats:profile.charStats||{},bigramStats:profile.bigramStats||{},skillState:profile.skillState||{},goals:profile.goals||{}};container.querySelector('#teacherReport').innerHTML=`<div class="dash-section"><h3>${t('דוח','Report')}: ${escapeHtml(profileDisplayName(s.name))}</h3><p>${t('הדוח מבוסס על נתוני התרגול המקומיים. לצורך הפרדה מלאה בין תלמידים, השתמשו בפרופיל הפעיל לפני תרגול.','The report is based on local practice data. To keep students separate, select the right profile before practicing.')}</p><button class="btn primary" id="exportReport">${t('ייצא דוח JSON','Export JSON report')}</button></div>`;container.querySelector('#exportReport').onclick=()=>{const payload={student:s,generatedAt:new Date().toISOString(),sessions,stats};const blob=new Blob([JSON.stringify(payload,null,2)],{type:'application/json'});const url=URL.createObjectURL(blob),a=document.createElement('a');a.href=url;a.download=`hebrew-typing-report-${s.name.replace(/[^א-תA-Za-z0-9_-]/g,'_')}.json`;a.click();URL.revokeObjectURL(url)};}
  window.renderTeacherScreen=renderTeacherScreen;

  function renderErgonomicsScreen(container){
    container.innerHTML=`<h2>ארגונומיה וטכניקה</h2><p class="empty-note">הנחיות כלליות ללמידה נוחה — לא אבחון רפואי.</p><div class="erg-grid">${[['ישיבה','שבו בתנוחה נוחה, עם כתפיים רגועות.'],['שורש כף היד','שמרו ככל האפשר על תנוחה ניטרלית והימנעו מלחץ מיותר.'],['ידיים','הניחו את האצבעות על שורת הבית וחזרו אליה באופן עקבי.'],['מבט','בשלב המתקדם נסו להסתכל במסך ולא במקלדת.'],['תנועה','העדיפו תנועה מדויקת ורגועה על פני כוח או מתיחה מיותרת.'],['הפסקות','אם הביצועים יורדים לאורך זמן, שקלו הפסקה קצרה.']].map(x=>`<div class="hero-card"><h3>${x[0]}</h3><p>${x[1]}</p></div>`).join('')}</div><div class="dash-section"><h3>מה המערכת באמת יכולה לדעת?</h3><p>המערכת יכולה למדוד את המקש שנלחץ ואת התזמון שלו. היא אינה יכולה לדעת בוודאות איזו אצבע פיזית השתמשה במקש, ולכן הדרכת האצבע היא לפי מיפוי צפוי בלבד.</p></div>`;
  }
  window.renderErgonomicsScreen=renderErgonomicsScreen;

  window.renderAdvancedOverview=function(container){renderTodayScreen(container)};
  window.ADV_VERSION=ADV_VERSION;
})();
