/* French Journey — PROTECTED build (app.v6.js)
   - Safe storage adapter (falls back to memory if quota/blocked)
   - Guarded TTS + mic (no-crash)
   - JSON loads with fallbacks
   - Single definition of setB2Countdown
*/
(function(){
  /* ---------- tiny helpers ---------- */
  const $  = (s)=>document.querySelector(s);
  const $$ = (s)=>Array.from(document.querySelectorAll(s));
  const todayKey = ()=> new Date().toISOString().slice(0,10);
  const addDays  = (d,n)=>{ const x=new Date(d); x.setDate(x.getDate()+n); return x; };
  const fmt      = (d)=> new Date(d).toISOString().slice(0,10);
  const weekNumber=(date=new Date())=>{
    const d=new Date(Date.UTC(date.getFullYear(),date.getMonth(),date.getDate()));
    const day=d.getUTCDay()||7; d.setUTCDate(d.getUTCDate()+4-day);
    const y=new Date(Date.UTC(d.getUTCFullYear(),0,1));
    return Math.ceil(((d-y)/86400000+1)/7);
  };
  const esc=(s)=>String(s).replace(/[&<>"']/g,m=>({ '&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#039;'}[m]));

  /* ---------- SAFE storage adapter ---------- */
  const store=(function(){
    let persistent=true; const mem={};
    try{ localStorage.setItem('__t','1'); localStorage.removeItem('__t'); }
    catch{ persistent=false; }
    function get(k,def){
      try{
        if(persistent){
          const v=localStorage.getItem(k);
          return v==null?def:JSON.parse(v);
        }
      }catch{ persistent=false; }
      return (k in mem)? mem[k] : def;
    }
    function set(k,v){
      try{
        if(persistent){ localStorage.setItem(k, JSON.stringify(v)); return true; }
      }catch{ persistent=false; }
      mem[k]=v; return false;
    }
    return {get,set,isPersistent:()=>persistent, clear(){try{localStorage.clear()}catch{} for(const k in mem) delete mem[k];}};
  })();

  /* show a tiny badge if we’re in memory-only mode */
  function showSaveStatus(){
    const hdr = $('.header .row');
    if(!hdr) return;
    let b = document.createElement('span');
    b.className = 'badge';
    b.style.background = store.isPersistent()? '#0a7f2a' : '#8b5cf6';
    b.textContent = store.isPersistent()? '💾 Sauvegarde OK' : '⚠️ Mode mémoire (non sauvegardé)';
    hdr.appendChild(b);
  }

  /* ---------- keys & defaults ---------- */
  const K={
    goalDailyXP:'fd_goal_daily_xp',
    dailyMinutes:'fd_daily_minutes',
    weeklyHours:'fd_weekly_hours',
    xpByDay:'fd_xp_by_day',
    flagsByDay:'fd_flags_by_day',
    vocabList:'fd_vocab_list',
    dueSeed:'fd_due_seed'
  };
  if(store.get(K.goalDailyXP)==null) store.set(K.goalDailyXP,30);
  if(store.get(K.dailyMinutes)==null) store.set(K.dailyMinutes,40);
  if(store.get(K.weeklyHours)==null)  store.set(K.weeklyHours,8);
  if(store.get(K.xpByDay)==null)      store.set(K.xpByDay,{});
  if(store.get(K.flagsByDay)==null)   store.set(K.flagsByDay,{});
  if(store.get(K.vocabList)==null)    store.set(K.vocabList,[
    {id:1, fr:'envisager', en:'to consider', ease:2.5, interval:0, reps:0, due:fmt(todayKey())},
    {id:2, fr:'mettre en place', en:'to set up', ease:2.5, interval:0, reps:0, due:fmt(todayKey())},
    {id:3, fr:'piste cyclable', en:'bike lane', ease:2.5, interval:0, reps:0, due:fmt(todayKey())},
  ]);

  /* ---------- tabs ---------- */
  const VIEWS=[
    ['dashboard','🏠 Tableau de bord'],
    ['comprehension','📰 Compréhension'],
    ['speaking','🎤 Parler'],
    ['listening','👂 Écoute'],
    ['vocab','📚 Vocabulaire'],
    ['phrases','🗣️ Phrases'],
  ];
  function initTabs(){
    const nav = $('#tabs'); if(!nav) return;
    nav.innerHTML='';
    VIEWS.forEach((v,i)=>{
      const b=document.createElement('button');
      b.className='btn'+(i===0?' active':'');
      b.textContent=v[1]; b.onclick=()=>show(v[0],b);
      nav.appendChild(b);
    });
    show('dashboard', nav.firstChild);
  }
  function show(id,btn){
    $$('.view').forEach(v=>v.classList.add('hidden'));
    const el=$('#view-'+id); if(el) el.classList.remove('hidden');
    $$('#tabs button').forEach(b=>b.classList.remove('active'));
    btn&&btn.classList.add('active');
  }

  /* ---------- progress / xp ---------- */
  const xpMap = ()=> store.get(K.xpByDay,{});
  const flagsMap = ()=> store.get(K.flagsByDay,{});
  function getXP(d=todayKey()){ return xpMap()[d]||0; }
  function setXP(val,d=todayKey()){ const m=xpMap(); m[d]=val; store.set(K.xpByDay,m); }
  function dailyFlags(d=todayKey()){
    return flagsMap()[d] || {listening:false,speaking:false,reading:false,vocab:false,phrases:false};
  }
  function addXP(amount,flag){
    const d=todayKey();
    setXP(getXP(d)+amount);
    if(flag){
      const m=flagsMap();
      m[d]=m[d]||{listening:false,speaking:false,reading:false,vocab:false,phrases:false};
      m[d][flag]=true; store.set(K.flagsByDay,m);
    }
    refreshProgress(); draw14();
  }
  function refreshProgress(){
    const goal=store.get(K.goalDailyXP,30);
    $('#goalVal') && ($('#goalVal').textContent=`${goal} xp`);
    $('#goalBadge') && ($('#goalBadge').textContent=`🎯 Objectif: ${goal} xp/jour`);
    const xp=getXP();
    $('#xpVal') && ($('#xpVal').textContent=xp);
    $('#xpBar') && ($('#xpBar').style.width=Math.min(100,Math.round((xp/goal)*100))+'%');

    const f=dailyFlags();
    $$('[data-flag]').forEach(btn=>{
      const fl=btn.getAttribute('data-flag');
      btn.disabled=!!f[fl];
      if(!btn._wired){ btn.onclick=()=>addXP(parseInt(btn.dataset.xp,10), fl); btn._wired=true; }
    });

    $('#streakBadge') && ($('#streakBadge').textContent=`🔥 Streak: ${calcStreak(goal)}`);
    $('#streakDays') && ($('#streakDays').textContent=calcStreak(goal));
    $('#wkXp') && ($('#wkXp').textContent=calcThisWeekXP());

    $('#dailyMinutes') && ($('#dailyMinutes').value = store.get(K.dailyMinutes,40));
    $('#weeklyHours') && ($('#weeklyHours').value = store.get(K.weeklyHours,8));
    $('#todayPlan') && ($('#todayPlan').textContent = `${store.get(K.dailyMinutes)} min • focus: parler/écouter + vocab (SRS)`);
  }
  function calcThisWeekXP(){
    const m=xpMap(); const d=new Date(); const wk=weekNumber(d); let sum=0;
    Object.entries(m).forEach(([k,v])=>{ const dt=new Date(k); if(weekNumber(dt)===wk && dt.getFullYear()===d.getFullYear()) sum+=v||0;});
    return sum;
  }
  function calcStreak(goal){
    const m=xpMap(); let s=0, day=new Date();
    for(;;){ const k=day.toISOString().slice(0,10); if((m[k]||0)>=goal){ s++; day=addDays(day,-1); } else break; }
    return s;
  }
  function draw14(){
    const c=$('#chart14'); if(!c) return; const g=c.getContext('2d');
    const m=xpMap(); const today=new Date(); const days=[];
    for(let i=13;i>=0;i--){ const d=addDays(today,-i); const k=d.toISOString().slice(0,10); days.push({k, xp:m[k]||0}); }
    const r=c.getBoundingClientRect(), dpr=window.devicePixelRatio||1;
    c.width=Math.floor(r.width*dpr); c.height=Math.floor(150*dpr);
    g.clearRect(0,0,c.width,c.height);
    const W=c.width,H=c.height,p=24,slot=(W-2*p)/days.length,bw=Math.max(6,slot*0.6),max=Math.max(store.get(K.goalDailyXP,30),...days.map(d=>d.xp),30);
    let sum=0; g.fillStyle='#60a5fa';
    days.forEach((d,i)=>{ sum+=d.xp; const x=p+i*slot; const h=(H-2*p)*(d.xp/max); g.fillRect(Math.round(x),Math.round(H-p-h),Math.round(bw),Math.round(h)); });
    $('#sum14') && ($('#sum14').textContent=sum);
  }

  /* controls */
  $('#incGoal')  && ($('#incGoal').onclick = ()=>{ store.set(K.goalDailyXP, store.get(K.goalDailyXP,30)+5); refreshProgress(); });
  $('#decGoal')  && ($('#decGoal').onclick = ()=>{ store.set(K.goalDailyXP, Math.max(10, store.get(K.goalDailyXP,30)-5)); refreshProgress(); });
  $('#resetDay') && ($('#resetDay').onclick = ()=>{ setXP(0); const m=flagsMap(); m[todayKey()]={listening:false,speaking:false,reading:false,vocab:false,phrases:false}; store.set(K.flagsByDay,m); refreshProgress(); });
  $('#saveDailyMinutes') && ($('#saveDailyMinutes').onclick = ()=>{ store.set(K.dailyMinutes, Math.max(10, parseInt($('#dailyMinutes').value||40,10))); refreshProgress(); });
  $('#saveWeeklyHours') && ($('#saveWeeklyHours').onclick = ()=>{ store.set(K.weeklyHours, Math.max(1, parseInt($('#weeklyHours').value||8,10))); refreshProgress(); });

  /* ---------- countdown ---------- */
  function setB2Countdown(){
    const now=new Date(), end=new Date(now.getFullYear(),11,31);
    const days=Math.max(0, Math.ceil((end-now)/86400000));
    $('#daysToB2') && ($('#daysToB2').textContent=days);
  }

  /* ---------- export/import (safe) ---------- */
  $('#exportData') && ($('#exportData').onclick = ()=>{
    const data={};
    [K.goalDailyXP,K.dailyMinutes,K.weeklyHours,K.xpByDay,K.flagsByDay,K.vocabList,K.dueSeed].forEach(k=> data[k]=store.get(k));
    try{
      const blob=new Blob([JSON.stringify(data,null,2)],{type:'application/json'});
      const url=URL.createObjectURL(blob); const a=document.createElement('a'); a.href=url; a.download='french_journey_backup.json'; a.click(); URL.revokeObjectURL(url);
    }catch{ alert("Export impossible dans cet environnement."); }
  });
  $('#importData') && ($('#importData').onchange = (e)=>{
    const f=e.target.files?.[0]; if(!f) return;
    const r=new FileReader();
    r.onload=()=>{ try{ const obj=JSON.parse(r.result); Object.entries(obj).forEach(([k,v])=>store.set(k,v)); alert('Import OK, rechargement…'); location.reload(); }catch{ alert('Fichier invalide'); } };
    r.readAsText(f);
  });
  $('#factoryReset') && ($('#factoryReset').onclick = ()=>{ if(confirm('Tout effacer ?')){ store.clear(); location.reload(); } });

  /* ---------- load JSON (with fallbacks) ---------- */
  let ARTICLES=[], PROMPTS={}, DICT=[], PHRASES=[];
  async function jget(path, fb){
    try{ const res=await fetch(path,{cache:'no-store'}); if(!res.ok) throw 0; return await res.json(); }
    catch{ return fb; }
  }
  async function loadData(){
    const fbA=[{title:'Le vélo en ville',fr:"Aujourd’hui, la mairie a ouvert une nouvelle piste cyclable au centre-ville pour réduire la circulation et la pollution.",en:"Today, the city hall opened a new bike lane downtown to reduce traffic and pollution.",qs:["Pourquoi la mairie a-t-elle ouvert la piste ?"],ans:["Pour réduire la circulation et la pollution."]}];
    const fbP={daily:["Décris ta routine du matin.","Parle de ta ville.","Quel est ton objectif cette semaine ?"]};
    const fbD=[{text:"Pouvez-vous répéter plus lentement, s'il vous plaît ?", hint:"Demande polie"}];
    const fbPH=["Bonjour, comment ça va ?","Merci beaucoup !","Excusez-moi, où sont les toilettes ?","Je voudrais un café, s’il vous plaît.","Combien ça coûte ?","Pouvez-vous m’aider ?","Je ne comprends pas.","Je suis désolé(e).","C’est une bonne idée.","À demain !"];
    [ARTICLES,PROMPTS,DICT,PHRASES] = await Promise.all([
      jget('./data/news.json',fbA),
      jget('./data/prompts.json',fbP),
      jget('./data/dictation.json',fbD),
      jget('./data/phrases.json',fbPH),
    ]);
  }

  /* ---------- TTS helpers (safe) ---------- */
  function speak(text, lang='fr-FR', rate=1){
    try{
      if(!('speechSynthesis' in window)) throw 0;
      window.speechSynthesis.cancel();
      const u=new SpeechSynthesisUtterance(text); u.lang=lang; u.rate=rate; window.speechSynthesis.speak(u);
      return true;
    }catch{ alert('Synthèse vocale non disponible ici.'); return false; }
  }

  /* ---------- Comprehension ---------- */
  let showEN=false, artIdx=0;
  function renderArticle(){
    if(!ARTICLES.length){ $('#articleBox') && ($('#articleBox').value='(Aucun article)'); $('#articleQA') && ($('#articleQA').textContent=''); return; }
    const a=ARTICLES[artIdx%ARTICLES.length];
    $('#articleBox') && ($('#articleBox').value = showEN? a.en : a.fr);
    $('#articleQA') && ($('#articleQA').innerHTML = `<div class="row small"><span class="pill">Texte: ${esc(a.title)}</span></div>
      <ol class="small">${(a.qs||[]).map((q,i)=>`<li>${esc(q)} <details class="muted"><summary>Réponse suggérée</summary>${esc((a.ans||[])[i]||'')}</details></li>`).join('')}</ol>`);
  }
  $('#nextArticle') && ($('#nextArticle').onclick = ()=>{ artIdx++; renderArticle(); });
  $('#toggleArticleLang') && ($('#toggleArticleLang').onclick = ()=>{ showEN=!showEN; $('#toggleArticleLang').textContent=showEN?'Afficher le texte (FR)':'Afficher traduction (EN)'; renderArticle(); });
  $('#speakArticle') && ($('#speakArticle').onclick = ()=>{ const t=$('#articleBox')?.value||''; speak(t,'fr-FR',0.95); });
  $('#stopSpeakArticle') && ($('#stopSpeakArticle').onclick = ()=>{ try{ speechSynthesis.cancel(); }catch{} });
  $('#markCompXP') && ($('#markCompXP').onclick = ()=> addXP(5,'reading'));

  /* ---------- Speaking (SR guarded) ---------- */
  function fillPromptSelect(){
    const sel=$('#promptSelect'); if(!sel) return; sel.innerHTML='';
    Object.keys(PROMPTS).forEach(cat=>{ const o=document.createElement('option'); o.value=cat; o.textContent=cat[0].toUpperCase()+cat.slice(1); sel.appendChild(o); });
  }
  function randomPrompt(cat){ const arr=PROMPTS[cat]||PROMPTS[Object.keys(PROMPTS)[0]]||[]; return arr[Math.floor(Math.random()*arr.length)]||''; }
  function setPrompt(cat){ $('#promptBox') && ($('#promptBox').value = randomPrompt(cat));
