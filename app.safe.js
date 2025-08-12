/* French Journey — SAFE MODE (no localStorage, no TTS auto, no mic)
   Purpose: rule out extensions/quota. Keeps UI usable for testing. */
(function(){
  // --- helpers (safe, no storage) ---
  const $  = (s)=>document.querySelector(s);
  const $$ = (s)=>Array.from(document.querySelectorAll(s));
  const todayKey = ()=> new Date().toISOString().slice(0,10);
  const addDays = (d,n)=>{ const x=new Date(d); x.setDate(x.getDate()+n); return x; };
  const fmt = (d)=> new Date(d).toISOString().slice(0,10);
  const escapeHTML = (s)=> String(s).replace(/[&<>"']/g, m=>({ '&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#039;'}[m]));
  // in-memory store only
  const store = { _m:{},
    get(k,d){ return (k in this._m)? this._m[k] : d },
    set(k,v){ this._m[k]=v }
  };

  // --- defaults (in memory) ---
  const K={ goal:'goal', xp:'xp', flags:'flags', vocab:'vocab', seed:'seed' };
  store.set(K.goal, 30);
  store.set(K.xp,   0);
  store.set(K.flags,{listening:false,speaking:false,reading:false,vocab:false,phrases:false});
  store.set(K.vocab,[
    {id:1, fr:'envisager', en:'to consider', due:fmt(new Date())},
    {id:2, fr:'mettre en place', en:'to set up', due:fmt(new Date())},
  ]);

  // --- tabs ---
  const VIEWS=[['dashboard','🏠 Tableau de bord'],['comprehension','📰 Compréhension'],['speaking','🎤 Parler'],['listening','👂 Écoute'],['vocab','📚 Vocabulaire'],['phrases','🗣️ Phrases']];
  function initTabs(){
    const nav = $('#tabs'); nav.innerHTML='';
    VIEWS.forEach((v,i)=>{
      const b=document.createElement('button'); b.className='btn'+(i===0?' active':''); b.textContent=v[1]; b.onclick=()=>show(v[0],b); nav.appendChild(b);
    });
    show('dashboard', nav.firstChild);
  }
  function show(id, btn){
    $$('.view').forEach(v=>v.classList.add('hidden'));
    $('#view-'+id).classList.remove('hidden');
    $$('#tabs .btn').forEach(b=>b.classList.remove('active')); btn?.classList.add('active');
  }

  // --- progress (safe) ---
  function setCountdown(){
    const now=new Date(), end=new Date(now.getFullYear(),11,31);
    const days=Math.max(0, Math.ceil((end-now)/86400000));
    $('#daysToB2').textContent=days;
  }
  function refresh(){
    const goal=store.get(K.goal,30), xp=store.get(K.xp,0);
    $('#goalVal').textContent=`${goal} xp`;
    $('#goalBadge').textContent=`🎯 Objectif: ${goal} xp/jour`;
    $('#xpVal').textContent=xp;
    $('#xpBar').style.width=Math.min(100, Math.round((xp/goal)*100))+'%';
  }
  function addXP(n, flag){
    store.set(K.xp, store.get(K.xp,0)+n);
    const f=store.get(K.flags); f[flag]=true; store.set(K.flags,f);
    refresh(); draw14();
  }
  $('#incGoal').onclick=()=>{ store.set(K.goal, store.get(K.goal,30)+5); refresh(); };
  $('#decGoal').onclick=()=>{ store.set(K.goal, Math.max(10, store.get(K.goal,30)-5)); refresh(); };
  $('#resetDay').onclick=()=>{ store.set(K.xp,0); store.set(K.flags,{listening:false,speaking:false,reading:false,vocab:false,phrases:false}); refresh(); };

  // --- tiny chart (no storage) ---
  function draw14(){
    const c=$('#chart14'); if(!c) return; const g=c.getContext('2d');
    const rect=c.getBoundingClientRect(); const dpr=window.devicePixelRatio||1;
    c.width=Math.max(300, Math.floor(rect.width*dpr)); c.height=Math.floor(150*dpr);
    g.clearRect(0,0,c.width,c.height); const W=c.width,H=c.height,p=24, n=14, slot=(W-2*p)/n, bw=Math.max(6,slot*0.6);
    const vals=new Array(n).fill(0); vals[n-1]=store.get(K.xp,0); const max=Math.max(30,...vals);
    g.fillStyle='#60a5fa'; let sum=0;
    vals.forEach((v,i)=>{ sum+=v; const h=(H-2*p)*(v/max); g.fillRect(Math.round(p+i*slot), Math.round(H-p-h), Math.round(bw), Math.round(h)); });
    $('#sum14').textContent=sum; $('#wkXp').textContent=sum; $('#streakDays').textContent = (store.get(K.xp,0)>=store.get(K.goal,30)?1:0);
  }

  // --- comprehension (fallback only) ---
  const ARTICLES=[{title:'Le vélo en ville',
    fr:"Aujourd’hui, la mairie a ouvert une nouvelle piste cyclable au centre-ville pour réduire la circulation et la pollution.",
    en:"Today, the city hall opened a new bike lane downtown to reduce traffic and pollution.",
    qs:["Pourquoi la mairie a-t-elle ouvert la piste ?"],
    ans:["Pour réduire la circulation et la pollution."]}];
  let artIdx=0, showEN=false;
  function renderArticle(){
    const a=ARTICLES[artIdx%ARTICLES.length];
    $('#articleBox').value = showEN? a.en : a.fr;
    $('#articleQA').innerHTML = `<div class="row small"><span class="pill">Texte: ${escapeHTML(a.title)}</span></div>
      <ol class="small">${a.qs.map((q,i)=>`<li>${escapeHTML(q)} <details class="muted"><summary>Réponse suggérée</summary>${escapeHTML(a.ans[i]||'')}</details></li>`).join('')}</ol>`;
  }
  $('#nextArticle').onclick = ()=>{ artIdx++; renderArticle(); };
  $('#toggleArticleLang').onclick = ()=>{ showEN=!showEN; $('#toggleArticleLang').textContent=showEN?'Afficher le texte (FR)':'Afficher traduction (EN)'; renderArticle(); };
  $('#speakArticle').onclick = ()=> alert('TTS désactivé en mode sûr.');
  $('#stopSpeakArticle').onclick = ()=>{};
  $('#markCompXP').onclick = ()=> addXP(5,'reading');

  // --- speaking (no mic in safe mode) ---
  const PROMPTS={ daily:["Décris ta routine du matin.","Parle de ta ville.","Quel est ton objectif cette semaine ?"]};
  function fillPromptSelect(){
    const sel=$('#promptSelect'); sel.innerHTML='';
    Object.keys(PROMPTS).forEach(cat=>{ const o=document.createElement('option'); o.value=cat; o.textContent=cat; sel.appendChild(o); });
  }
  function randomPrompt(cat){ const arr=PROMPTS[cat]||PROMPTS.daily; return arr[Math.floor(Math.random()*arr.length)]||''; }
  function setPrompt(cat){ $('#promptBox').value = randomPrompt(cat); }
  $('#newPrompt').onclick = ()=> setPrompt($('#promptSelect').value);
  $('#promptSelect').onchange = ()=> setPrompt($('#promptSelect').value);
  $('#speakPrompt').onclick = ()=> alert('Lecture de l’invite désactivée en mode sûr.');
  $('#askMic').onclick = ()=> alert('Micro désactivé en mode sûr.');
  $('#startRec').onclick = ()=> alert('Reconnaissance vocale désactivée en mode sûr.');
  $('#stopRec').onclick  = ()=>{};
  $('#markSpeakXP').onclick = ()=> addXP(5,'speaking');

  // --- listening (no TTS in safe mode) ---
  const DICT=[{text:"Pouvez-vous répéter plus lentement, s'il vous plaît ?", hint:"Demande polie"}];
  let dIdx=0;
  $('#playDictation').onclick   = ()=> alert('Lecture audio désactivée en mode sûr.');
  $('#replayDictation').onclick = ()=> alert('Lecture audio désactivée en mode sûr.');
  $('#checkDictation').onclick  = ()=>{
    const target=DICT[dIdx].text.toLowerCase().trim();
    const guess=$('#dictationInput').value.toLowerCase().trim();
    const wa=target.split(/\s+/), wb=guess.split(/\s+/), set=new Set(wa); let match=0; wb.forEach(w=>{if(set.has(w)) match++;});
    $('#dictationScore').textContent = `Score: ${Math.round((wa.length?match/wa.length:0)*100)}%`;
  };
  $('#markListenXP').onclick    = ()=> addXP(5,'listening');
  $('#dictationHint').textContent = 'Indice : '+DICT[0].hint;
  $('#dictationTarget').textContent = DICT[0].text;

  // --- vocab (in memory) ---
  let vocab = store.get(K.vocab,[]);
  function refreshVocabTable(){
    const tb=$('#vTable tbody'); tb.innerHTML='';
    vocab.forEach(w=>{ const tr=document.createElement('tr'); tr.innerHTML=`<td>${w.fr}</td><td>${w.en}</td><td>${w.due}</td><td></td>`; tb.appendChild(tr); });
    $('#dueCount').textContent = vocab.length; $('#dueNow').textContent=vocab.length;
  }
  $('#addWord').onclick = ()=>{
    const fr=$('#vFr').value.trim(), en=$('#vEn').value.trim();
    if(!fr||!en) return; vocab.push({id:Date.now(), fr, en, due:fmt(new Date())});
    refreshVocabTable(); $('#vFr').value=''; $('#vEn').value='';
  };
  $('#exportVocab').onclick = ()=> alert('Export désactivé en mode sûr.');
  $('#importVocab').onchange = ()=> alert('Import désactivé en mode sûr.');
  $('#clearVocab').onclick   = ()=>{ vocab=[]; refreshVocabTable(); };
  $('#startQuiz').onclick    = ()=> alert('Quiz simplifié désactivé en mode sûr.');
  $('#markVocabXP').onclick  = ()=> addXP(5,'vocab');

  // --- phrases (static set) ---
  const PHRASES=["Bonjour, comment ça va ?","Merci beaucoup !","Excusez-moi, où sont les toilettes ?","Je voudrais un café, s’il vous plaît.","Combien ça coûte ?","Pouvez-vous m’aider ?","Je ne comprends pas.","Je suis désolé(e).","C’est une bonne idée.","À demain !"];
  function renderPhrases(){
    const c=$('#phraseList'); c.innerHTML='';
    PHRASES.forEach((p,i)=>{ const row=document.createElement('div'); row.className='row'; row.style.marginBottom='6px';
      const btn=document.createElement('button'); btn.className='btn'; btn.textContent='🔊'; btn.onclick=()=>alert('Audio désactivé en mode sûr.');
      const span=document.createElement('span'); span.textContent=(i+1)+'. '+p;
      row.appendChild(btn); row.appendChild(span); c.appendChild(row);
    });
  }
  $('#speakAllPhrases').onclick = ()=> alert('Audio désactivé en mode sûr.');
  $('#newPhrases').onclick = ()=> renderPhrases();
  $('#markPhrasesXP').onclick = ()=> addXP(5,'phrases');

  // --- init ---
  function init(){
    initTabs(); setCountdown(); refresh(); draw14();
    fillPromptSelect(); setPrompt('daily'); renderArticle(); refreshVocabTable(); renderPhrases();
    window.addEventListener('resize', draw14);
    // set helpful labels so you know safe mode is on
    document.title = 'French Journey — SAFE MODE';
  }
  if(document.readyState==='loading') document.addEventListener('DOMContentLoaded', init); else init();
})();
