/* French Journey — clean multi-file script (no build tools)
   Works on GitHub Pages. All data persists in localStorage. */

/* ===========================
   Helpers & Storage
   =========================== */
const $  = (sel) => document.querySelector(sel);
const $$ = (sel) => Array.from(document.querySelectorAll(sel));
const todayKey = () => new Date().toISOString().slice(0,10);
const addDays = (d,n)=>{ const x=new Date(d); x.setDate(x.getDate()+n); return x; };
const fmt = (d)=> new Date(d).toISOString().slice(0,10);
const weekNumber = (date = new Date())=>{
  const d = new Date(Date.UTC(date.getFullYear(), date.getMonth(), date.getDate()));
  const dayNum = d.getUTCDay() || 7; d.setUTCDate(d.getUTCDate() + 4 - dayNum);
  const yearStart = new Date(Date.UTC(d.getUTCFullYear(),0,1));
  return Math.ceil(((d - yearStart)/86400000 + 1)/7);
};
const escapeHTML = (s) => String(s).replace(/[&<>"']/g, m=>({ '&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#039;'}[m]));

/* localStorage wrapper */
const store = {
  get(k, def){ try{ return JSON.parse(localStorage.getItem(k)) ?? def } catch { return def } },
  set(k, v){ localStorage.setItem(k, JSON.stringify(v)) }
};

/* ===========================
   Keys / Defaults
   =========================== */
const K = {
  goalDailyXP: 'fd_goal_daily_xp',
  dailyMinutes: 'fd_daily_minutes',
  weeklyHours: 'fd_weekly_hours',
  xpByDay: 'fd_xp_by_day',        // { 'YYYY-MM-DD': number }
  flagsByDay: 'fd_flags_by_day',  // { date: {listening,speaking,reading,vocab,phrases} }
  vocabList: 'fd_vocab_list',     // array of cards
  dueSeed: 'fd_due_seed',         // phrase set seed
  dataVersion: 'fd_data_v1'
};
if (store.get(K.goalDailyXP)==null) store.set(K.goalDailyXP, 30);
if (store.get(K.dailyMinutes)==null) store.set(K.dailyMinutes, 40);
if (store.get(K.weeklyHours)==null) store.set(K.weeklyHours, 8);
if (store.get(K.xpByDay)==null) store.set(K.xpByDay, {});
if (store.get(K.flagsByDay)==null) store.set(K.flagsByDay, {});
if (store.get(K.vocabList)==null) store.set(K.vocabList, [
  {id:1, fr:'envisager', en:'to consider', ease:2.5, interval:0, reps:0, due:fmt(todayKey())},
  {id:2, fr:'mettre en place', en:'to set up', ease:2.5, interval:0, reps:0, due:fmt(todayKey())},
  {id:3, fr:'piste cyclable', en:'bike lane', ease:2.5, interval:0, reps:0, due:fmt(todayKey())},
]);

/* ===========================
   Navigation
   =========================== */
const VIEWS = [
  {id:'dashboard',     label:'🏠 Tableau de bord'},
  {id:'comprehension', label:'📰 Compréhension'},
  {id:'speaking',      label:'🎤 Parler'},
  {id:'listening',     label:'👂 Écoute'},
  {id:'vocab',         label:'📚 Vocabulaire'},
  {id:'phrases',       label:'🗣️ Phrases'}
];
function initTabs(){
  const nav = $('#tabs'); nav.innerHTML='';
  VIEWS.forEach((v,i)=>{
    const b = document.createElement('button');
    b.className = 'btn' + (i===0?' active':'');
    b.textContent = v.label;
    b.dataset.view = v.id;
    b.onclick = ()=>showView(v.id, b);
    nav.appendChild(b);
  });
  showView('dashboard', nav.querySelector('button'));
}
function showView(id, btn){
  $$('.view').forEach(v => v.classList.add('hidden'));
  $('#view-'+id).classList.remove('hidden');
  $$('#tabs button').forEach(b => b.classList.remove('active'));
  btn && btn.classList.add('active');
}

/* ===========================
   XP / Progress / Goals
   =========================== */
function getXP(d=todayKey()){ const map=store.get(K.xpByDay,{}); return map[d]||0; }
function setXP(val, d=todayKey()){ const map=store.get(K.xpByDay,{}); map[d]=val; store.set(K.xpByDay,map); }
function addXP(amount, flag=null){
  const d = todayKey();
  setXP(getXP(d) + amount);
  if (flag){
    const flags = store.get(K.flagsByDay,{});
    flags[d] = flags[d] || {listening:false,speaking:false,reading:false,vocab:false,phrases:false};
    flags[d][flag] = true; store.set(K.flagsByDay, flags);
  }
  refreshProgress();
  draw14DayChart();
}
function dailyFlags(d=todayKey()){
  return store.get(K.flagsByDay,{})[d] || {listening:false,speaking:false,reading:false,vocab:false,phrases:false};
}
function refreshProgress(){
  const goal = store.get(K.goalDailyXP,30);
  $('#goalVal').textContent = `${goal} xp`;
  $('#goalBadge').textContent = `🎯 Objectif: ${goal} xp/jour`;

  const xp = getXP();
  $('#xpVal').textContent = xp;
  $('#xpBar').style.width = Math.min(100, Math.round((xp/goal)*100)) + '%';

  // disable daily +xp buttons if already used for that skill today
  const f = dailyFlags();
  document.querySelectorAll('[data-flag]').forEach(btn=>{
    const flag = btn.getAttribute('data-flag');
    btn.disabled = !!f[flag];
    if (!btn._wired){
      btn.onclick = ()=> addXP(parseInt(btn.dataset.xp,10), flag);
      btn._wired = true;
    }
  });

  // streak & weekly XP
  const streak = calcStreak(goal);
  $('#streakBadge').textContent = `🔥 Streak: ${streak}`;
  $('#streakDays').textContent = streak;
  $('#wkXp').textContent = calcThisWeekXP();

  // small plan
  $('#dailyMinutes').value = store.get(K.dailyMinutes,40);
  $('#weeklyHours').value = store.get(K.weeklyHours,8);
  $('#todayPlan').textContent = `${store.get(K.dailyMinutes)} min • focus: parler/écouter + vocab (SRS)`;
}
function calcThisWeekXP(){
  const map = store.get(K.xpByDay,{});
  const d = new Date();
  const wk = weekNumber(d); let sum = 0;
  Object.entries(map).forEach(([k,v])=>{
    const dt = new Date(k);
    if (weekNumber(dt)===wk && dt.getFullYear()===d.getFullYear()) sum+=v||0;
  });
  return sum;
}
function calcStreak(goal){
  const map = store.get(K.xpByDay,{});
  let s=0, day=new Date();
  for(;;){
    const key = day.toISOString().slice(0,10);
    if ((map[key]||0) >= goal){ s++; day = addDays(day,-1); } else break;
  }
  return s;
}
function draw14DayChart(){
  const c = $('#chart14'); if(!c) return;
  const g = c.getContext('2d');
  const map = store.get(K.xpByDay,{});
  const today = new Date();
  const days = [];
  for(let i=13;i>=0;i--){ const d=addDays(today,-i); const k=d.toISOString().slice(0,10); days.push({k, xp: map[k]||0}); }

  // size for devicePixelRatio
  const rect=c.getBoundingClientRect();
  const dpr = window.devicePixelRatio || 1;
  c.width  = Math.floor(rect.width * dpr);
  c.height = Math.floor(150 * dpr);

  // draw
  g.clearRect(0,0,c.width,c.height);
  const W=c.width, H=c.height, pad=24;
  const slot = (W-2*pad)/days.length;
  const bw   = Math.max(6, slot*0.6);
  const max  = Math.max(store.get(K.goalDailyXP,30), ...days.map(d=>d.xp), 30);
  let sum=0;
  days.forEach((d,i)=>{ sum+=d.xp; const x=pad+i*slot; const h=(H-2*pad)*(d.xp/max); g.fillRect(Math.round(x), Math.round(H-pad-h), Math.round(bw), Math.round(h)); });
  $('#sum14').textContent = sum;
}

/* controls */
$('#incGoal').onclick = ()=>{ store.set(K.goalDailyXP, store.get(K.goalDailyXP,30)+5); refreshProgress(); };
$('#decGoal').onclick = ()=>{ store.set(K.goalDailyXP, Math.max(10, store.get(K.goalDailyXP,30)-5)); refreshProgress(); };
$('#resetDay').onclick = ()=>{ setXP(0); const flags=store.get(K.flagsByDay,{}); flags[todayKey()]={listening:false,speaking:false,reading:false,vocab:false,phrases:false}; store.set(K.flagsByDay,flags); refreshProgress(); };
$('#saveDailyMinutes').onclick = ()=>{ store.set(K.dailyMinutes, Math.max(10, parseInt($('#dailyMinutes').value||40,10))); refreshProgress(); };
$('#saveWeeklyHours').onclick = ()=>{ store.set(K.weeklyHours, Math.max(1, parseInt($('#weeklyHours').value||8,10))); refreshProgress(); };

/* Countdown to Dec 31 (B2 goal) — single definition */
function setB2Countdown(){
  const now=new Date(); const end=new Date(now.getFullYear(),11,31);
  const days=Math.max(0, Math.ceil((end - now)/86400000));
  $('#daysToB2').textContent = days;
}

/* ===========================
   Data Export / Import
   =========================== */
$('#exportData').onclick = ()=>{
  const data = {};
  Object.values(K).forEach(key=> data[key]=store.get(key));
  const blob = new Blob([JSON.stringify(data,null,2)], {type:'application/json'});
  const url = URL.createObjectURL(blob);
  const a=document.createElement('a'); a.href=url; a.download='french_journey_backup.json'; a.click();
  URL.revokeObjectURL(url);
};
$('#importData').onchange = (e)=>{
  const file = e.target.files[0]; if(!file) return;
  const r = new FileReader();
  r.onload = ()=>{
    try{ const obj=JSON.parse(r.result);
      Object.entries(obj).forEach(([k,v])=> localStorage.setItem(k, JSON.stringify(v)));
      alert('Importation réussie. Rechargement…'); location.reload();
    }catch{ alert('Fichier invalide'); }
  };
  r.readAsText(file);
};
$('#factoryReset').onclick = ()=>{
  if(!confirm('Tout effacer et repartir de zéro ?')) return;
  Object.values(K).forEach(k=> localStorage.removeItem(k));
  location.reload();
};

/* ===========================
   Load external data (JSON)
   =========================== */
let ARTICLES=[], PROMPTS={}, DICT=[], PHRASES=[];
async function loadJSON(path, fallback){
  try{
    const res = await fetch(path, {cache:'no-store'});
    if(!res.ok) throw new Error(`HTTP ${res.status}`);
    return await res.json();
  }catch{
    console.warn(`Failed to load ${path}; using fallback.`);
    return fallback;
  }
}
async function loadAllData(){
  const fallbackArticles=[{
    title:'Le vélo en ville',
    fr:"Aujourd’hui, la mairie a ouvert une nouvelle piste cyclable au centre-ville pour réduire la circulation et la pollution.",
    en:"Today, the city hall opened a new bike lane downtown to reduce traffic and pollution.",
    qs:["Pourquoi la mairie a-t-elle ouvert la piste ?"],
    ans:["Pour réduire la circulation et la pollution."]
  }];
  const fallbackPrompts={ daily:["Décris ta routine du matin."] };
  const fallbackDict=[{text:"Pouvez-vous répéter plus lentement, s'il vous plaît ?", hint:"Demande polie"}];
  const fallbackPhrases=["Bonjour, comment ça va ?","Merci beaucoup !"];

  [ARTICLES, PROMPTS, DICT, PHRASES] = await Promise.all([
    loadJSON('./data/news.json',     fallbackArticles),
    loadJSON('./data/prompts.json',  fallbackPrompts),
    loadJSON('./data/dictation.json',fallbackDict),
    loadJSON('./data/phrases.json',  fallbackPhrases),
  ]);
}

/* ===========================
   Comprehension (Articles)
   =========================== */
let showEN=false, artIdx=0, ttsUtter=null;
function renderArticle(){
  if(!ARTICLES.length){ $('#articleBox').value='(Aucun article chargé)'; $('#articleQA').textContent=''; return; }
  const a=ARTICLES[artIdx%ARTICLES.length];
  $('#articleBox').value = showEN? a.en : a.fr;
  $('#articleQA').innerHTML = `
    <div class="row small"><span class="pill">Texte: ${escapeHTML(a.title)}</span></div>
    <ol class="small">${(a.qs||[]).map((q,i)=>`<li>${escapeHTML(q)} <details class="muted"><summary>Réponse suggérée</summary>${escapeHTML((a.ans||[])[i]||'')}</details></li>`).join('')}</ol>
  `;
}
$('#nextArticle').onclick = ()=>{ artIdx++; renderArticle(); };
$('#toggleArticleLang').onclick = ()=>{ showEN=!showEN; $('#toggleArticleLang').textContent = showEN?'Afficher le texte (FR)':'Afficher traduction (EN)'; renderArticle(); };
$('#speakArticle').onclick = ()=>{
  if(!('speechSynthesis' in window)){ alert("Synthèse vocale non disponible."); return; }
  speechSynthesis.cancel();
  const u = new SpeechSynthesisUtterance($('#articleBox').value);
  u.lang='fr-FR'; u.rate=0.95; u.pitch=1;
  ttsUtter=u; speechSynthesis.speak(u);
};
$('#stopSpeakArticle').onclick = ()=> speechSynthesis.cancel();
$('#markCompXP').onclick = ()=> addXP(5,'reading');

/* ===========================
   Speaking (Prompts + SR)
   =========================== */
function fillPromptSelect(){
  const sel = $('#promptSelect'); sel.innerHTML='';
  Object.keys(PROMPTS).forEach(cat=>{
    const opt=document.createElement('option');
    opt.value=cat; opt.textContent = cat[0].toUpperCase()+cat.slice(1);
    sel.appendChild(opt);
  });
}
function randomPrompt(cat){ const arr=PROMPTS[cat]||PROMPTS[Object.keys(PROMPTS)[0]]||[]; return arr[Math.floor(Math.random()*arr.length)]||''; }
function setPrompt(cat){ $('#promptBox').value = randomPrompt(cat); }
$('#newPrompt').onclick = ()=> setPrompt($('#promptSelect').value);
$('#promptSelect').onchange = ()=> setPrompt($('#promptSelect').value);
$('#speakPrompt').onclick = ()=>{
  if(!('speechSynthesis' in window)){ alert("Synthèse vocale non disponible."); return; }
  const u = new SpeechSynthesisUtterance($('#promptBox').value || randomPrompt(Object.keys(PROMPTS)[0]));
  u.lang='fr-FR'; u.rate=1; speechSynthesis.speak(u);
};

const micState = $('#micState'), recState = $('#recState'), out = $('#speechOut');
$('#askMic').onclick = async ()=>{
  try{ const s=await navigator.mediaDevices.getUserMedia({audio:true}); s.getTracks().forEach(t=>t.stop()); micState.innerHTML='🎙️ Micro: <span class="mono">granted</span>'; }
  catch{ micState.innerHTML='🎙️ Micro: <span class="mono">blocked</span>'; alert("Autorisez le micro pour github.io"); }
};
(async function initMicStatus(){
  if(!navigator.mediaDevices?.getUserMedia){ micState.innerHTML='🎙️ Micro: <span class="mono">unsupported</span>'; return; }
  try{
    const r = await navigator.permissions?.query({name:'microphone'});
    if(r){ micState.innerHTML = '🎙️ Micro: <span class="mono">'+r.state+'</span>'; r.onchange=()=> micState.innerHTML='🎙️ Micro: <span class="mono">'+r.state+'</span>'; }
    else micState.innerHTML='🎙️ Micro: <span class="mono">unknown</span>';
  }catch{ micState.innerHTML='🎙️ Micro: <span class="mono">unknown</span>'; }
})();

const SR = window.SpeechRecognition || window.webkitSpeechRecognition;
let recog=null;
function startRec(){
  if(!SR){ alert("La reconnaissance vocale n'est pas disponible ici. Essayez Chrome."); return; }
  if(recog) return;
  recog=new SR(); recog.lang='fr-FR'; recog.interimResults=true; recog.continuous=true; out.value='';
  recog.onresult=(e)=>{ let txt=''; for(let i=0;i<e.results.length;i++){ txt += e.results[i][0].transcript + (e.results[i].isFinal?'\n':' '); } out.value=txt.trim(); };
  recog.onerror=(e)=> console.warn(e);
  recog.onend=()=>{ recState.innerHTML='🗣️ État: <span class="mono">inactif</span>'; $('#stopRec').disabled=true; recog=null; };
  try{ recog.start(); recState.innerHTML='🗣️ État: <span class="mono">écoute…</span>'; $('#stopRec').disabled=false; }
  catch{ alert("Impossible de démarrer. Autorisez le micro, puis réessayez."); }
}
function stopRec(){ if(recog) recog.stop(); }
$('#startRec').onclick = startRec;
$('#stopRec').onclick  = stopRec;
$('#markSpeakXP').onclick = ()=> addXP(5,'speaking');

/* ===========================
   Listening (Dictation)
   =========================== */
let dIdx=0, lastUtter=null;
function playCurrentDictation(){
  if(!DICT.length){ $('#dictationHint').textContent='(Aucune dictée chargée)'; return; }
  const d=DICT[dIdx%DICT.length];
  $('#dictationHint').textContent = "Indice : " + d.hint;
  $('#dictationTarget').textContent = d.text;
  if(!('speechSynthesis' in window)){ alert("Synthèse vocale non disponible."); return; }
  speechSynthesis.cancel();
  const u=new SpeechSynthesisUtterance(d.text); u.lang='fr-FR'; u.rate=0.95; lastUtter=u; speechSynthesis.speak(u);
}
$('#playDictation').onclick   = ()=>{ playCurrentDictation(); };
$('#replayDictation').onclick = ()=>{ if(lastUtter) speechSynthesis.speak(lastUtter); else playCurrentDictation(); };
$('#checkDictation').onclick  = ()=>{
  const target = $('#dictationTarget').textContent.trim().toLowerCase();
  const guess  = $('#dictationInput').value.trim().toLowerCase();
  $('#dictationScore').textContent = `Score: ${Math.round(similarityWords(target, guess)*100)}%`;
};
$('#markListenXP').onclick    = ()=> addXP(5,'listening');
function similarityWords(a,b){
  const wa=a.replace(/[^\p{L}\p{N}\s']/gu,'').split(/\s+/);
  const wb=b.replace(/[^\p{L}\p{N}\s']/gu,'').split(/\s+/);
  const set=new Set(wa); let match=0; wb.forEach(w=>{ if(set.has(w)) match++; });
  return wa.length? match/wa.length : 0;
}

/* ===========================
   Vocabulary (SRS)
   =========================== */
let vocab = store.get(K.vocabList,[]);
let quizQueue = [], currentCard=null;
function refreshVocabTable(){
  const tb = $('#vTable tbody'); tb.innerHTML='';
  vocab.forEach((w)=>{
    const tr=document.createElement('tr');
    tr.innerHTML = `<td>${escapeHTML(w.fr)}</td><td>${escapeHTML(w.en)}</td><td class="small">${w.due}</td><td><button class="btn bad small" data-del="${w.id}">Sup.</button></td>`;
    tb.appendChild(tr);
  });
  tb.onclick = (e)=>{ const id=e.target.getAttribute('data-del'); if(id){ vocab=vocab.filter(x=>x.id!=id); store.set(K.vocabList,vocab); refreshVocabTable(); updateDueCount(); } };
}
function updateDueCount(){
  const today=fmt(todayKey());
  const due=vocab.filter(v=> v.due<=today).length;
  $('#dueCount').textContent = due;
  $('#dueNow').textContent   = due;
}
function addVocab(fr,en){
  const id = Date.now()+Math.random();
  vocab.push({id, fr, en, ease:2.5, interval:0, reps:0, due:fmt(todayKey())});
  store.set(K.vocabList,vocab);
  refreshVocabTable(); updateDueCount();
}
$('#addWord').onclick = ()=>{
  const fr=$('#vFr').value.trim(); const en=$('#vEn').value.trim();
  if(!fr||!en) return;
  addVocab(fr,en); $('#vFr').value=''; $('#vEn').value='';
};
$('#exportVocab').onclick = ()=>{
  const blob = new Blob([JSON.stringify(vocab,null,2)], {type:'application/json'});
  const url = URL.createObjectURL(blob);
  const a=document.createElement('a'); a.href=url; a.download='vocab.json'; a.click();
  URL.revokeObjectURL(url);
};
$('#importVocab').onchange = (e)=>{
  const f=e.target.files[0]; if(!f) return;
  const r=new FileReader();
  r.onload=()=>{ try{ const arr=JSON.parse(r.result); if(Array.isArray(arr)){ vocab=arr; store.set(K.vocabList,vocab); refreshVocabTable(); updateDueCount(); } }catch{ alert('Fichier invalide'); } };
  r.readAsText(f);
};
$('#clearVocab').onclick = ()=>{ if(confirm('Effacer tout le vocabulaire ?')){ vocab=[]; store.set(K.vocabList,vocab); refreshVocabTable(); updateDueCount(); } };

// Quiz (SM-2 lite)
$('#startQuiz').onclick = ()=>{
  const today=fmt(todayKey());
  quizQueue = vocab.filter(v=> v.due<=today);
  if(!quizQueue.length){ alert("Aucune carte due. Ajoutez des mots ou attendez le prochain rappel."); return; }
  serveNextCard();
};
$('#skipCard').onclick = ()=> serveNextCard();
function serveNextCard(){
  currentCard = quizQueue.shift();
  if(!currentCard){
    $('#quizFront h2').textContent='Terminé 👏';
    disableRate(true); $('#markVocabXP').disabled=false; return;
  }
  $('#quizFront h2').textContent=currentCard.fr;
  $('#quizAnswer').value = ''; $('#quizBack').textContent = '';
  disableRate(true); $('#revealA').disabled=false; $('#skipCard').disabled=false;
}
function disableRate(dis){
  ['rateAgain','rateHard','rateGood','rateEasy'].forEach(id=> $('#'+id).disabled = dis);
}
$('#revealA').onclick = ()=>{
  if(!currentCard) return;
  $('#quizBack').textContent = currentCard.en;
  disableRate(false); $('#revealA').disabled=true;
};
$('#rateAgain').onclick = ()=> rateCard(0);
$('#rateHard').onclick   = ()=> rateCard(2);
$('#rateGood').onclick   = ()=> rateCard(3);
$('#rateEasy').onclick   = ()=> rateCard(4);
$('#markVocabXP').onclick = ()=>{ addXP(5,'vocab'); $('#markVocabXP').disabled=true; };

function rateCard(grade){
  const c=currentCard;
  if(grade<3){
    c.reps=0; c.interval=1; c.ease=Math.max(1.3, c.ease-0.2);
  } else {
    c.reps+=1;
    if(c.reps===1) c.interval=1;
    else if(c.reps===2) c.interval=3;
    else c.interval = Math.round(c.interval * c.ease);
    c.ease = Math.min(3.0, c.ease + (grade===4?0.15:0.0));
  }
  const next = addDays(new Date(), c.interval);
  c.due = fmt(next);
  const idx = vocab.findIndex(v=>v.id===c.id);
  if(idx>-1) vocab[idx]=c; store.set(K.vocabList,vocab);
  refreshVocabTable(); updateDueCount();
  serveNextCard();
}

/* ===========================
   Daily Phrases
   =========================== */
function todaysPhraseIndexes(){
  const seed = parseInt((store.get(K.dueSeed) ?? Date.now()).toString().slice(-6),10);
  const day = parseInt(todayKey().replace(/-/g,''),10);
  const rand = (n)=> (Math.abs(Math.sin(seed+day+n))*10000)%PHRASES.length|0;
  const set=new Set();
  while(set.size<10 && set.size<PHRASES.length) set.add(rand(set.size));
  return [...set];
}
function renderPhrases(){
  const list = PHRASES.length ? todaysPhraseIndexes().map(i=>PHRASES[i]) : [];
  const c = $('#phraseList'); c.innerHTML='';
  list.forEach((p,i)=>{
    const row=document.createElement('div');
    row.className='row'; row.style.marginBottom='6px';
    const btn=document.createElement('button'); btn.className='btn'; btn.textContent='🔊';
    btn.onclick=()=> speak(p);
    const span=document.createElement('span'); span.textContent = (i+1)+'. '+p;
    row.appendChild(btn); row.appendChild(span); c.appendChild(row);
  });
}
function speak(text){
  if(!('speechSynthesis' in window)){ alert("Synthèse vocale non disponible."); return; }
  speechSynthesis.cancel();
  const u=new SpeechSynthesisUtterance(text); u.lang='fr-FR'; u.rate=1; speechSynthesis.speak(u);
}
$('#speakAllPhrases').onclick = ()=>{
  PHRASES.forEach((p,i)=> setTimeout(()=>speak(p), i*1500));
};
$('#newPhrases').onclick = ()=>{ store.set(K.dueSeed, Date.now()); renderPhrases(); };
$('#markPhrasesXP').onclick = ()=> addXP(5,'phrases');

/* ===========================
   INIT
   =========================== */
async function init(){
  initTabs();
  await loadAllData();

  // Comprehension + Speaking
  renderArticle();
  fillPromptSelect();
  setPrompt(Object.keys(PROMPTS)[0]||'');

  // Vocab + Phrases
  refreshVocabTable();
  updateDueCount();
  renderPhrases();

  // Progress + chart + B2 countdown
  refreshProgress();
  draw14DayChart();
  setB2Countdown();

  window.addEventListener('resize', draw14DayChart);
}
init();
