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

  function dailyPlan(minutes){
    ensureAdvancedData();
    if (typeof buildPedagogicalDailyCurriculum === 'function') {
      const p = buildPedagogicalDailyCurriculum(minutes || appData.goals.dailyMinutes || 15);
      return {
        date: p.date, minutes: p.minutes, createdAt: p.generatedAt, version: 3,
        difficulty: p.difficulty, pieces: p.blocks.map((b,i)=>({
          kind:b.kind, minutes:b.minutes, title:b.title, text:b.text,
          difficulty:b.difficulty, focus:b.focus, index:i
        }))
      };
    }
    minutes=Math.max(2,Number(minutes)||15);
    const due=getDueForReview(6).map(x=>x.ch), weak=getWeakCharacters(5).map(x=>x.ch), weakBg=getWeakBigrams(4);
    const pieces=[];
    const warm=Math.max(1,Math.round(minutes*.1)), review=Math.max(1,Math.round(minutes*.25)), targeted=Math.max(1,Math.round(minutes*.25)), natural=Math.max(1,minutes-warm-review-targeted-1), assess=1;
    pieces.push({kind:'warmup',minutes:warm,title:'חימום',text:generateCharDrill(getKnownKeys(),Math.max(12,warm*35),[])});
    if(due.length) pieces.push({kind:'retention',minutes:review,title:'חזרה מרווחת',text:generateCharDrill(getKnownKeys(),Math.max(12,review*35),due)});
    else pieces.push({kind:'review',minutes:review,title:'חיזוק חולשות',text:generateCharDrill(getKnownKeys(),Math.max(12,review*35),weak)});
    if(weakBg.length) pieces.push({kind:'bigram',minutes:targeted,title:'מעברים מאתגרים',text:generateBigramDrill(weakBg)});
    else pieces.push({kind:'targeted',minutes:targeted,title:'תרגול ממוקד',text:generateAdaptiveExercise(Math.max(1,getActiveLevel()))});
    pieces.push({kind:'natural',minutes:natural,title:'עברית טבעית',text:generateAdaptiveExercise(Math.max(3,getActiveLevel()))});
    pieces.push({kind:'assessment',minutes:assess,title:'בדיקת למידה',text:generateAdaptiveExercise(Math.max(2,getActiveLevel()))});
    return {date:todayKey(),minutes,pieces,createdAt:Date.now(),version:2};
  }
  window.buildAdvancedDailyPlan=dailyPlan;

  function startAdvancedExercise(piece, returnScreen='dashboardScreen'){
    showScreen('practiceScreen');
    startPracticeRun({text:piece.text,mode:'lesson',title:`${trUi(piece.title)} · ${piece.minutes} ${t('דקות','min')}`,durationLimitMs:piece.minutes*60000,onExit:()=>{showScreen(returnScreen);navigateTo(returnScreen)},onFinish:(metrics)=>{recordLearningEvent('planExercise',{kind:piece.kind,minutes:piece.minutes,accuracy:metrics.accuracy,wpm:metrics.wpm});showResultsScreen(metrics,{onContinue:()=>{showScreen(returnScreen);navigateTo(returnScreen)},onRetry:()=>startAdvancedExercise(piece,returnScreen)})}});
  }
  window.startAdvancedExercise=startAdvancedExercise;

  function startAdvancedPlan(plan, returnScreen='todayScreen', index=0){
    const pieces = plan && Array.isArray(plan.pieces) ? plan.pieces : [];
    if (!pieces.length) return;
    const piece = pieces[index];
    showScreen('practiceScreen');
    startPracticeRun({
      text:piece.text, mode:'curriculum', title:`${trUi(piece.title)} · ${index+1}/${pieces.length}`,
      durationLimitMs:piece.minutes*60000,
      onExit:()=>{showScreen(returnScreen);navigateTo(returnScreen)},
      onFinish:(metrics)=>{
        recordLearningEvent('curriculumBlock',{kind:piece.kind,index,minutes:piece.minutes,
          accuracy:metrics.accuracy,wpm:metrics.netWpm||metrics.wpm,difficulty:piece.difficulty});
        if(index+1<pieces.length){
          otzShowMessage(t(`השלב הסתיים. ממשיכים לשלב ${index+2} מתוך ${pieces.length}.`,`Step done. Moving on to step ${index+2} of ${pieces.length}.`),'info');
          setTimeout(()=>startAdvancedPlan(plan,returnScreen,index+1),250);
        } else {
          showResultsScreen(metrics,{
            onContinue:()=>{showScreen(returnScreen);navigateTo(returnScreen)},
            onRetry:()=>startAdvancedPlan(plan,returnScreen,index)
          });
        }
      }
    });
  }
  window.startAdvancedPlan=startAdvancedPlan;

  function renderTodayScreen(container){
    ensureAdvancedData(); const p=appData.advanced.plans[todayKey()]||dailyPlan(getDailyGoalMinutes()); appData.advanced.plans[todayKey()]=p; Object.keys(appData.advanced.plans).forEach(k=>{ if(k!==todayKey()) delete appData.advanced.plans[k]; }); /* 3.0: old daily plans (with their full texts) used to pile up in storage forever */
    const due=getDueForReview(10), weak=getWeakCharacters(5);
    const today=localDateKey();
    const todayMs=appData.sessions.filter(s=>localDateKey(new Date(s.date))===today).reduce((sum,s)=>sum+(s.durationMs||0),0);
    const goalMin=getDailyGoalMinutes();
    const goalPct=Math.min(100,Math.round(todayMs/60000/goalMin*100));
    container.innerHTML=`<h2>היום שלי</h2>
      <div class="hero-card"><h3>${t('יעד יומי','Daily goal')}: ${Math.round(todayMs/60000*10)/10} / ${goalMin} ${t('דקות','minutes')}</h3><div class="level-progress-bar"><div class="level-progress-fill" style="width:${goalPct}%"></div></div><p>המנוע בוחר חימום, חזרה, חולשות, עברית טבעית ובדיקת למידה לפי הנתונים שלך.</p><p><b>רמת אתגר היום:</b> ${p.difficulty ? escapeHtml(trUi(p.difficulty.label || "")) : trUi("מותאם")} · ${t('יעד דיוק','accuracy target')} ${p.difficulty?.targetAccuracy || 92}%</p><button class="btn primary" id="startPlan">התחל תוכנית</button> <button class="btn" id="regenPlan">בנה מחדש</button></div>
      <div class="dash-section"><h3>שלבי היום</h3><div class="plan-list">${p.pieces.map((x,i)=>`<div class="plan-item"><b>${i+1}. ${escapeHtml(trUi(x.title))}</b><span>${x.minutes} דק׳</span><button class="btn-chip" data-i="${i}">התחל</button></div>`).join('')}</div></div>
      <div class="two-col"><div class="dash-section"><h3>חזרות שמגיעות</h3>${due.length?'<div class="word-chip-list">'+due.map(x=>`<span class="word-chip">${escapeHtml(x.ch)} · ${x.mastery}%</span>`).join('')+'</div>':'<p class="empty-note">אין כרגע חזרות דחופות.</p>'}</div>
      <div class="dash-section"><h3>החולשות המרכזיות</h3>${weak.length?'<div class="word-chip-list">'+weak.map(x=>`<span class="word-chip">${escapeHtml(x.ch)} · ${x.score}%</span>`).join('')+'</div>':'<p class="empty-note">עוד לא נאספו מספיק נתונים.</p>'}</div></div>`;
    container.querySelector('#startPlan').onclick=()=>startAdvancedPlan(p,'todayScreen',0);
    container.querySelector('#regenPlan').onclick=()=>{appData.advanced.plans[todayKey()]=dailyPlan(getDailyGoalMinutes());scheduleSaveData();renderTodayScreen(container)};
    container.querySelectorAll('[data-i]').forEach(b=>b.onclick=()=>startAdvancedExercise(p.pieces[Number(b.dataset.i)]));
  }
  window.renderTodayScreen=renderTodayScreen;

  function renderAnalyticsScreen(container){
    ensureAdvancedData(); const ss=appData.sessionSummary, sessions=appData.sessions.slice(-30); const avgA=ss.count?ss.totalAccuracy/ss.count:0, avgW=ss.count?ss.totalWpm/ss.count:0; const ped=typeof getPedagogicalAnalytics==='function'?getPedagogicalAnalytics():null;
    const due=getDueForReview(20), bg=getWeakBigrams(10), errs=getErrorMatrixTop(10);
    const retained=Object.values(appData.skillState||{}).filter(x=>x.retentionChecks>0).length;
    const mastered=Object.keys(appData.charStats||{}).filter(ch=>getSkillState(ch)==='MAINTENANCE').length;
    container.innerHTML=`<h2>מעבדת למידה</h2><div class="dash-summary"><div class="dash-stat"><div class="dash-val">${Math.round(avgW)}</div><div class="dash-lbl">מ״לד ממוצע</div></div><div class="dash-stat"><div class="dash-val">${Math.round(avgA*10)/10}%</div><div class="dash-lbl">דיוק ממוצע</div></div><div class="dash-stat"><div class="dash-val">${mastered}</div><div class="dash-lbl">מיומנויות בתחזוקה</div></div><div class="dash-stat"><div class="dash-val">${retained}</div><div class="dash-lbl">מיומנויות שנבדקו לאחר דחייה</div></div></div><div class="dash-summary"><div class="dash-stat"><div class="dash-val">${ped?ped.trackedSkills:0}</div><div class="dash-lbl">מיומנויות במודל</div></div><div class="dash-stat"><div class="dash-val">${ped&&ped.retentionRate!=null?ped.retentionRate+"%":"—"}</div><div class="dash-lbl">שיעור שימור</div></div><div class="dash-stat"><div class="dash-val">${ped?(ped.velocity>=0?"+":"")+ped.velocity:"—"}</div><div class="dash-lbl">מ״לד: שינוי אחרון</div></div><div class="dash-stat"><div class="dash-val">${ped?trUi(ped.difficulty.label):"—"}</div><div class="dash-lbl">רמת אתגר</div></div></div>
      <div class="dash-section"><h3>פירוש הנתונים</h3><p>${buildAnalyticsNarrative(avgW,avgA,due.length)}</p></div>
      <div class="dash-section"><h3>מעברים חלשים</h3>${bg.length?`<table class="data-table"><tr><th>מעבר</th><th>ציון</th><th>ניסיונות</th></tr>${bg.map(x=>`<tr><td>${escapeHtml(x.bg)}</td><td>${x.score===null?'—':x.score}%</td><td>${x.attempts}</td></tr>`).join('')}</table>`:'<p class="empty-note">אין מספיק נתונים.</p>'}</div>
      <div class="dash-section"><h3>שגיאות חוזרות</h3>${errs.length?`<table class="data-table"><tr><th>צפוי</th><th>הוקלד</th><th>מספר</th></tr>${errs.map(x=>`<tr><td>${escapeHtml(x.expected)}</td><td>${escapeHtml(x.typed)}</td><td>${x.count}</td></tr>`).join('')}</table>`:'<p class="empty-note">אין מספיק נתונים.</p>'}</div>
      <div class="dash-section"><h3>סשנים אחרונים</h3>${sessions.length?`<table class="data-table"><tr><th>תאריך</th><th>מצב</th><th>מ״לד</th><th>דיוק</th><th>משך</th></tr>${sessions.slice(-15).reverse().map(s=>`<tr><td>${new Date(s.date).toLocaleString(uiLocale())}</td><td>${escapeHtml(s.mode||'')}</td><td>${s.netWpm??s.wpm??0}</td><td>${s.accuracy??0}%</td><td>${Math.round((s.durationMs||0)/1000)} ${t('שנ׳','s')}</td></tr>`).join('')}</table>`:'<p class="empty-note">אין עדיין סשנים.</p>'}</div>`;
  }
  function buildAnalyticsNarrative(w,a,due){
    if(!appData.sessions.length) return 'המערכת עדיין אוספת נתונים. בצעו כמה תרגולים לפני קבלת מסקנות.';
    if(a<94) return 'הנתונים מצביעים שהעדיפות כרגע היא דיוק ושליטה בתנועות. המערכת תטה לתרגול מבוקר יותר לפני העלאת דרישת המהירות.';
    if(due>3) return `יש ${due} מיומנויות שמגיעות לחזרה. כדאי לשמר אותן לפני שמוסיפים חומר חדש.`;
    if(w<25) return 'הדיוק נראה יציב, ולכן אפשר להתחיל להעלות בהדרגה את מורכבות המעברים והמילים.';
    return 'הביצועים נראים מאוזנים. המערכת יכולה לשלב יותר טקסט טבעי, מעברים מורכבים ובדיקות שמירה על היכולת.';
  }
  window.renderAnalyticsScreen=renderAnalyticsScreen;

  function renderAssessmentScreen(container){
    ensureAdvancedData();
    const last=appData.advanced.assessmentHistory.slice(-3).reverse();
    container.innerHTML=`<h2>הערכה ומבחני למידה</h2><div class="hero-card"><h3>מדידת למידה אמיתית</h3><p>המבחן כולל pre-test, תרגול, post-test ובדיקה דחויה. ציון מבחן אינו המדד היחיד להתקדמות.</p><button class="btn primary" id="pretest">התחל Pre-Test</button></div><div class="dash-section"><h3>הערכות קודמות</h3>${last.length?`<table class="data-table"><tr><th>תאריך</th><th>סוג</th><th>מ״לד</th><th>דיוק</th><th>מזהה</th></tr>${last.map(x=>`<tr><td>${new Date(x.at).toLocaleDateString(uiLocale())}</td><td>${escapeHtml(x.type)}</td><td>${x.wpm}</td><td>${x.accuracy}%</td><td>${escapeHtml(x.id)}</td></tr>`).join('')}</table>`:'<p class="empty-note">אין עדיין הערכות.</p>'}</div>`;
    container.querySelector('#pretest').onclick=()=>runAssessmentStage('pre',container);
  }
  function assessmentText(){return buildTestText('paragraph',Math.max(180,120+getActiveLevel()*40));}
  function runAssessmentStage(type,container,assessmentId){
    const id=assessmentId||`A-${Date.now()}`; const text=assessmentText(); showScreen('practiceScreen');
    startPracticeRun({text,mode:'assessment',durationLimitMs:60000,title:type==='pre'?t('Pre-Test — דקה','Pre-Test — 1 minute'):t('Post-Test — דקה','Post-Test — 1 minute'),onExit:()=>{showScreen('assessmentScreen');renderAssessmentScreen(container)},onFinish:(metrics)=>{
      appData.advanced.assessmentHistory.push({id,type,at:Date.now(),wpm:metrics.wpm,netWpm:metrics.netWpm,accuracy:metrics.accuracy,durationMs:metrics.elapsedMs});
      if(type==='pre'){appData.advanced.pendingAssessment={id,pre:metrics};otzShowMessage(t('ה-Pre-Test נשמר. עכשיו בצעו תרגול ממוקד לפני ה-Post-Test.','Pre-Test saved. Now do focused practice before the Post-Test.'),'success');showScreen('assessmentScreen');renderAssessmentTraining(container,id)}
      else {const pre=appData.advanced.pendingAssessment?.pre;const delta=pre?{wpm:metrics.wpm-pre.wpm,accuracy:metrics.accuracy-pre.accuracy}:null;appData.advanced.assessmentHistory.push({id,type:'comparison',at:Date.now(),delta});delete appData.advanced.pendingAssessment;scheduleSaveData();showAssessmentComparison(container,pre,metrics,delta)}
    }});
  }
  function renderAssessmentTraining(container,id){
    container.innerHTML=`<h2>שלב האימון</h2><p>המערכת בחרה אימון קצר המבוסס על הביצוע. המטרה היא לשפר את היכולת, לא רק את הציון.</p><div class="dash-section"><button class="btn primary" id="train">התחל אימון ממוקד</button></div>`;
    container.querySelector('#train').onclick=()=>{const weak=getWeakCharacters(5).map(x=>x.ch);showScreen('practiceScreen');startPracticeRun({text:generateCharDrill(getKnownKeys(),120,weak),mode:'assessment-training',durationLimitMs:180000,title:t('אימון ממוקד','Focused training'),onExit:()=>{showScreen('assessmentScreen');renderAssessmentScreen(container)},onFinish:()=>{runAssessmentStage('post',container,id)}})};
  }
  function showAssessmentComparison(container,pre,post,delta){
    container.innerHTML=`<h2>Post-Test</h2><div class="results-grid"><div class="result-box"><div class="result-val">${post.wpm}</div><div class="result-lbl">מ״לד אחרי</div></div><div class="result-box"><div class="result-val">${post.accuracy}%</div><div class="result-lbl">דיוק אחרי</div></div><div class="result-box"><div class="result-val">${delta?((delta.wpm>=0?'+':'')+Math.round(delta.wpm)): '—'}</div><div class="result-lbl">שינוי מ״לד</div></div><div class="result-box"><div class="result-val">${delta?((delta.accuracy>=0?'+':'')+Math.round(delta.accuracy*10)/10)+'%':'—'}</div><div class="result-lbl">שינוי דיוק</div></div></div><p class="results-reco">הבדיקה הדחויה תיבנה אוטומטית בתור חזרה עתידית כדי לבדוק אם השיפור נשמר.</p><button class="btn primary" id="done">סיום</button>`;
    container.querySelector('#done').onclick=()=>{showScreen('assessmentScreen');renderAssessmentScreen(container)}; scheduleSaveData();
  }
  window.renderAssessmentScreen=renderAssessmentScreen;

  function renderMaintenanceScreen(container){
    ensureAdvancedData();
    const due=getDueForReview(12), last=appData.advanced.maintenance.slice(-10).reverse();
    container.innerHTML=`<h2>תחזוקת מיומנות</h2><p>גם מיומנויות שהושלמו צריכות תחזוקה. המערכת מציגה אותן מחדש כאשר יש סימני ירידה או כאשר הגיע מועד הבדיקה.</p><div class="quick-practice-buttons"><button class="btn primary" id="m5">תחזוקה 5 דקות</button><button class="btn" id="m10">תחזוקה 10 דקות</button><button class="btn" id="mTest">בדיקת תחזוקה</button></div><div class="dash-section"><h3>מיומנויות שדורשות תשומת לב</h3>${due.length?'<div class="word-chip-list">'+due.map(x=>`<span class="word-chip">${escapeHtml(x.ch)} · ${x.mastery}%</span>`).join('')+'</div>':'<p class="empty-note">אין כרגע מיומנויות דחופות.</p>'}</div><div class="dash-section"><h3>היסטוריית תחזוקה</h3>${last.length?`<table class="data-table"><tr><th>תאריך</th><th>משך</th><th>דיוק</th><th>מ״לד</th></tr>${last.map(x=>`<tr><td>${new Date(x.at).toLocaleDateString(uiLocale())}</td><td>${x.minutes}</td><td>${x.accuracy}%</td><td>${x.wpm}</td></tr>`).join('')}</table>`:'<p class="empty-note">אין עדיין סשני תחזוקה.</p>'}</div>`;
    const start=(minutes)=>{const text=generateAdaptiveExercise(Math.max(5,getActiveLevel()));showScreen('practiceScreen');startPracticeRun({text,mode:'maintenance',durationLimitMs:minutes*60000,title:t(`תחזוקה — ${minutes} דקות`,`Maintenance — ${minutes} min`),onExit:()=>{showScreen('maintenanceScreen');renderMaintenanceScreen(container)},onFinish:m=>{appData.advanced.maintenance.push({at:Date.now(),minutes,accuracy:m.accuracy,wpm:m.wpm});recordLearningEvent('maintenance',{minutes,accuracy:m.accuracy,wpm:m.wpm});showResultsScreen(m,{onContinue:()=>{showScreen('maintenanceScreen');renderMaintenanceScreen(container)},onRetry:()=>start(minutes)})}})};
    container.querySelector('#m5').onclick=()=>start(5);container.querySelector('#m10').onclick=()=>start(10);container.querySelector('#mTest').onclick=()=>start(2);
  }
  window.renderMaintenanceScreen=renderMaintenanceScreen;

  function renderTeacherScreen(container){
    ensureAdvancedData(); const a=appData.advanced, prof=activeProfile(), students=a.profiles.filter(p=>p.role==='student');
    container.innerHTML=`<h2>מצב מורה / מנהל</h2><div class="hero-card"><p>הנתונים נשמרים מקומית. אפשר ליצור פרופילי תלמידים, להגדיר יעד, להקצות אימון ולייצא דוח.</p><div class="teacher-form"><input id="studentName" placeholder="שם תלמיד"><button class="btn primary" id="addStudent">הוסף תלמיד</button></div></div><div class="dash-section"><h3>תלמידים</h3><div class="student-list">${students.map(s=>`<div class="student-row"><b>${escapeHtml(profileDisplayName(s.name))}</b><span>${s.id===prof.id?t('פעיל','Active'):''}</span><button class="btn-chip" data-student="${s.id}">בחר</button><button class="btn-chip" data-report="${s.id}">דוח</button></div>`).join('')}</div></div><div class="dash-section"><h3>יעדי המורה</h3><label>דיוק <input id="teacherAcc" type="number" min="80" max="100" value="${a.settings.defaultAccuracy}"></label> <label>מ״לד <input id="teacherWpm" type="number" min="5" max="200" value="${a.settings.defaultWpm}"></label> <label>דקות ביום <input id="teacherMin" type="number" min="2" max="180" value="${a.settings.dailyGoalMinutes}"></label><button class="btn" id="saveTeacher">שמור</button></div><div id="teacherReport"></div>`;
    container.querySelector('#addStudent').onclick=()=>{const n=container.querySelector('#studentName').value.trim();if(!n)return;const id='student-'+Date.now();a.profiles.push({id,name:n,role:'student',createdAt:Date.now()}); a.profileData[id]=blankProfile(); scheduleSaveData(); renderTeacherScreen(container)};
    container.querySelectorAll('[data-student]').forEach(b=>b.onclick=()=>{switchProfile(b.dataset.student);refreshHeaderStatus();renderTeacherScreen(container)});
    container.querySelectorAll('[data-report]').forEach(b=>b.onclick=()=>renderTeacherReport(container,b.dataset.report));
    container.querySelector('#saveTeacher').onclick=()=>{a.settings.defaultAccuracy=Number(container.querySelector('#teacherAcc').value);a.settings.defaultWpm=Number(container.querySelector('#teacherWpm').value);a.settings.dailyGoalMinutes=Number(container.querySelector('#teacherMin').value);scheduleSaveData();otzShowMessage(t('היעדים נשמרו','Goals saved'),'success')};
  }
  function renderTeacherReport(container,id){const s=appData.advanced.profiles.find(p=>p.id===id);if(!s)return; if(id===appData.advanced.activeProfileId) saveActiveProfile(); const profile=appData.advanced.profileData[id]||{}; const sessions=(profile.sessions||[]).slice(-20); const stats={charStats:profile.charStats||{},bigramStats:profile.bigramStats||{},skillState:profile.skillState||{},goals:profile.goals||{}};container.querySelector('#teacherReport').innerHTML=`<div class="dash-section"><h3>${t('דוח','Report')}: ${escapeHtml(profileDisplayName(s.name))}</h3><p>${t('הדוח מבוסס על נתוני התרגול המקומיים. לצורך הפרדה מלאה בין תלמידים, השתמשו בפרופיל הפעיל לפני תרגול.','The report is based on local practice data. To keep students separate, select the right profile before practicing.')}</p><button class="btn primary" id="exportReport">${t('ייצא דוח JSON','Export JSON report')}</button></div>`;container.querySelector('#exportReport').onclick=()=>{const payload={student:s,generatedAt:new Date().toISOString(),sessions,stats};const blob=new Blob([JSON.stringify(payload,null,2)],{type:'application/json'});const url=URL.createObjectURL(blob),a=document.createElement('a');a.href=url;a.download=`hebrew-typing-report-${s.name.replace(/[^א-תA-Za-z0-9_-]/g,'_')}.json`;a.click();URL.revokeObjectURL(url)};}
  window.renderTeacherScreen=renderTeacherScreen;

  function renderErgonomicsScreen(container){
    container.innerHTML=`<h2>ארגונומיה וטכניקה</h2><p>הנחיות כלליות ללמידה נוחה — לא אבחון רפואי.</p><div class="erg-grid">${[['ישיבה','שבו בתנוחה נוחה, עם כתפיים רגועות.'],['שורש כף היד','שמרו ככל האפשר על תנוחה ניטרלית והימנעו מלחץ מיותר.'],['ידיים','הניחו את האצבעות על שורת הבית וחזרו אליה באופן עקבי.'],['מבט','בשלב המתקדם נסו להסתכל במסך ולא במקלדת.'],['תנועה','העדיפו תנועה מדויקת ורגועה על פני כוח או מתיחה מיותרת.'],['הפסקות','אם הביצועים יורדים לאורך זמן, שקלו הפסקה קצרה.']].map(x=>`<div class="hero-card"><h3>${x[0]}</h3><p>${x[1]}</p></div>`).join('')}</div><div class="dash-section"><h3>מה המערכת באמת יכולה לדעת?</h3><p>המערכת יכולה למדוד את המקש שנלחץ ואת התזמון שלו. היא אינה יכולה לדעת בוודאות איזו אצבע פיזית השתמשה במקש, ולכן הדרכת האצבע היא לפי מיפוי צפוי בלבד.</p></div>`;
  }
  window.renderErgonomicsScreen=renderErgonomicsScreen;

  window.renderAdvancedOverview=function(container){renderTodayScreen(container)};
  window.ADV_VERSION=ADV_VERSION;
})();
