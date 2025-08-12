/* French Journey — PROTECTED build (app.v7.js)
   - Safe storage (falls back to memory)
   - Guarded TTS + mic (won’t crash)
   - JSON loading with fallbacks
*/
(function () {
  // --------- helpers ----------
  const $ = s => document.querySelector(s);
  const $$ = s => Array.from(document.querySelectorAll(s));
  const todayKey = () => new Date().toISOString().slice(0, 10);
  const addDays = (d, n) => { const x = new Date(d); x.setDate(x.getDate() + n); return x; };
  const fmt = d => new Date(d).toISOString().slice(0, 10);
  const weekNumber = (date = new Date()) => {
    const d = new Date(Date.UTC(date.getFullYear(), date.getMonth(), date.getDate()));
    const day = d.getUTCDay() || 7; d.setUTCDate(d.getUTCDate() + 4 - day);
    const y = new Date(Date.UTC(d.getUTCFullYear(), 0, 1));
    return Math.ceil(((d - y) / 86400000 + 1) / 7);
  };
  const esc = s => String(s).replace(/[&<>"']/g, m => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#039;' }[m]));

  // --------- safe storage ----------
  const store = (() => {
    let persistent = true; const mem = {};
    try { localStorage.setItem('__t', '1'); localStorage.removeItem('__t'); } catch { persistent = false; }
    const get = (k, d) => {
      try { if (persistent) { const v = localStorage.getItem(k); return v == null ? d : JSON.parse(v); } }
      catch { persistent = false; }
      return k in mem ? mem[k] : d;
    };
    const set = (k, v) => {
      try { if (persistent) { localStorage.setItem(k, JSON.stringify(v)); return true; } }
      catch { persistent = false; }
      mem[k] = v; return false;
    };
    const clear = () => { try { localStorage.clear(); } catch { } for (const k in mem) delete mem[k]; };
    return { get, set, clear, isPersistent: () => persistent };
  })();

  function showSaveStatus() {
    const hdr = $('.header .row'); if (!hdr) return;
    const b = document.createElement('span');
    b.className = 'badge';
    b.style.background = store.isPersistent() ? '#0a7f2a' : '#8b5cf6';
    b.textContent = store.isPersistent() ? '💾 Sauvegarde OK' : '⚠️ Mode mémoire';
    hdr.appendChild(b);
  }

  // --------- keys & defaults ----------
  const K = {
    goal: 'fd_goal_daily_xp', dailyMin: 'fd_daily_minutes', weeklyH: 'fd_weekly_hours',
    xp: 'fd_xp_by_day', flags: 'fd_flags_by_day', vocab: 'fd_vocab_list', seed: 'fd_due_seed'
  };
  if (store.get(K.goal) == null) store.set(K.goal, 30);
  if (store.get(K.dailyMin) == null) store.set(K.dailyMin, 40);
  if (store.get(K.weeklyH) == null) store.set(K.weeklyH, 8);
  if (store.get(K.xp) == null) store.set(K.xp, {});
  if (store.get(K.flags) == null) store.set(K.flags, {});
  if (store.get(K.vocab) == null) store.set(K.vocab, [
    { id: 1, fr: 'envisager', en: 'to consider', ease: 2.5, interval: 0, reps: 0, due: fmt(todayKey()) },
    { id: 2, fr: 'mettre en place', en: 'to set up', ease: 2.5, interval: 0, reps: 0, due: fmt(todayKey()) },
    { id: 3, fr: 'piste cyclable', en: 'bike lane', ease: 2.5, interval: 0, reps: 0, due: fmt(todayKey()) }
  ]);

  // --------- tabs ----------
  const VIEWS = [['dashboard', '🏠 Tableau de bord'], ['comprehension', '📰 Compréhension'], ['speaking', '🎤 Parler'], ['listening', '👂 Écoute'], ['vocab', '📚 Vocabulaire'], ['phrases', '🗣️ Phrases']];
  function initTabs() {
    const nav = $('#tabs'); if (!nav) return; nav.innerHTML = '';
    VIEWS.forEach((v, i) => { const b = document.createElement('button'); b.className = 'btn' + (i === 0 ? ' active' : ''); b.textContent = v[1]; b.onclick = () => show(v[0], b); nav.appendChild(b); });
    show('dashboard', nav.firstChild);
  }
  function show(id, btn) {
    $$('.view').forEach(v => v.classList.add('hidden'));
    $('#view-' + id)?.classList.remove('hidden');
    $$('#tabs button').forEach(b => b.classList.remove('active')); btn?.classList.add('active');
  }

  // --------- XP / progress ----------
  const xpMap = () => store.get(K.xp, {}), flagsMap = () => store.get(K.flags, {});
  function getXP(d = todayKey()) { return xpMap()[d] || 0; }
  function setXP(val, d = todayKey()) { const m = xpMap(); m[d] = val; store.set(K.xp, m); }
  function dailyFlags(d = todayKey()) { return flagsMap()[d] || { listening: false, speaking: false, reading: false, vocab: false, phrases: false }; }
  function addXP(n, flag) {
    const d = todayKey(); setXP(getXP(d) + n);
    if (flag) { const m = flagsMap(); m[d] = m[d] || dailyFlags(); m[d][flag] = true; store.set(K.flags, m); }
    refreshProgress(); draw14();
  }
  function refreshProgress() {
    const goal = store.get(K.goal, 30); $('#goalVal') && ($('#goalVal').textContent = `${goal} xp`);
    $('#goalBadge') && ($('#goalBadge').textContent = `🎯 Objectif: ${goal} xp/jour`);
    const xp = getXP(); $('#xpVal') && ($('#xpVal').textContent = xp); $('#xpBar') && ($('#xpBar').style.width = Math.min(100, Math.round((xp / goal) * 100)) + '%');
    $$('[data-flag]').forEach(b => { const f = b.getAttribute('data-flag'); b.disabled = !!dailyFlags()[f]; if (!b._wired) { b._wired = true; b.onclick = () => addXP(parseInt(b.dataset.xp, 10), f); } });
    const s = calcStreak(goal); $('#streakBadge') && ($('#streakBadge').textContent = `🔥 Streak: ${s}`); $('#streakDays') && ($('#streakDays').textContent = s);
    $('#wkXp') && ($('#wkXp').textContent = calcThisWeekXP());
    $('#dailyMinutes') && ($('#dailyMinutes').value = store.get(K.dailyMin, 40));
    $('#weeklyHours') && ($('#weeklyHours').value = store.get(K.weeklyH, 8));
    $('#todayPlan') && ($('#todayPlan').textContent = `${store.get(K.dailyMin)} min • focus: parler/écouter + vocab (SRS)`);
  }
  function calcThisWeekXP() {
    const m = xpMap(); const d = new Date(); const wk = weekNumber(d); let sum = 0;
    Object.entries(m).forEach(([k, v]) => { const dt = new Date(k); if (weekNumber(dt) === wk && dt.getFullYear() === d.getFullYear()) sum += v || 0; });
    return sum;
  }
  function calcStreak(goal) {
    const m = xpMap(); let s = 0, day = new Date();
    for (; ;) { const k = day.toISOString().slice(0, 10); if ((m[k] || 0) >= goal) { s++; day = addDays(day, -1); } else break; }
    return s;
  }
  function draw14() {
    const c = $('#chart14'); if (!c) return; const g = c.getContext('2d'); const m = xpMap(); const today = new Date(); const days = [];
    for (let i = 13; i >= 0; i--) { const d = addDays(today, -i); const k = d.toISOString().slice(0, 10); days.push({ k, xp: m[k] || 0 }); }
    const r = c.getBoundingClientRect(), dpr = window.devicePixelRatio || 1; c.width = Math.floor(r.width * dpr); c.height = Math.floor(150 * dpr);
    g.clearRect(0, 0, c.width, c.height); const W = c.width, H = c.height, p = 24, slot = (W - 2 * p) / days.length, bw = Math.max(6, slot * .6), max = Math.max(store.get(K.goal, 30), ...days.map(d => d.xp), 30);
    let sum = 0; g.fillStyle = '#60a5fa'; days.forEach((d, i) => { sum += d.xp; const x = p + i * slot; const h = (H - 2 * p) * (d.xp / max); g.fillRect(Math.round(x), Math.round(H - p - h), Math.round(bw), Math.round(h)); });
    $('#sum14') && ($('#sum14').textContent = sum);
  }

  // controls
  $('#incGoal')?.addEventListener('click', () => { store.set(K.goal, store.get(K.goal, 30) + 5); refreshProgress(); });
  $('#decGoal')?.addEventListener('click', () => { store.set(K.goal, Math.max(10, store.get(K.goal, 30) - 5)); refreshProgress(); });
  $('#resetDay')?.addEventListener('click', () => { setXP(0); const m = flagsMap(); m[todayKey()] = dailyFlags(); store.set(K.flags, m); refreshProgress(); });
  $('#saveDailyMinutes')?.addEventListener('click', () => { store.set(K.dailyMin, Math.max(10, parseInt($('#dailyMinutes').value || 40, 10))); refreshProgress(); });
  $('#saveWeeklyHours')?.addEventListener('click', () => { store.set(K.weeklyH, Math.max(1, parseInt($('#weeklyHours').value || 8, 10))); refreshProgress(); });

  // countdown
  function setB2Countdown() {
    const now = new Date(), end = new Date(now.getFullYear(), 11, 31);
    const days = Math.max(0, Math.ceil((end - now) / 86400000));
    $('#daysToB2') && ($('#daysToB2').textContent = days);
  }

  // data export/import
  $('#exportData')?.addEventListener('click', () => {
    const data = {}; [K.goal, K.dailyMin, K.weeklyH, K.xp, K.flags, K.vocab, K.seed].forEach(k => data[k] = store.get(k));
    try { const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' }); const url = URL.createObjectURL(blob); const a = document.createElement('a'); a.href = url; a.download = 'french_journey_backup.json'; a.click(); URL.revokeObjectURL(url); }
    catch { alert('Export indisponible.'); }
  });
  $('#importData')?.addEventListener('change', e => {
    const f = e.target.files?.[0]; if (!f) return; const r = new FileReader();
    r.onload = () => { try { const obj = JSON.parse(r.result); Object.entries(obj).forEach(([k, v]) => store.set(k, v)); alert('Import OK – rechargement'); location.reload(); } catch { alert('Fichier invalide'); } };
    r.readAsText(f);
  });
  $('#factoryReset')?.addEventListener('click', () => { if (confirm('Tout effacer ?')) { store.clear(); location.reload(); } });

  // ---------- JSON data (with fallbacks) ----------
  let ARTICLES = [], PROMPTS = {}, DICT = [], PHRASES = [];
  async function jget(path, fb) { try { const res = await fetch(path, { cache: 'no-store' }); if (!res.ok) throw 0; return await res.json(); } catch { return fb; } }
  async function loadData() {
    const fbA = [{ title: 'Le vélo en ville', fr: "Aujourd’hui, la mairie a ouvert une nouvelle piste cyclable au centre-ville pour réduire la circulation et la pollution.", en: "Today, the city hall opened a new bike lane downtown to reduce traffic and pollution.", qs: ["Pourquoi la mairie a-t-elle ouvert la piste ?"], ans: ["Pour réduire la circulation et la pollution."] }];
    const fbP = { daily: ["Décris ta routine du matin.", "Parle de ta ville.", "Quel est ton objectif cette semaine ?"] };
    const fbD = [{ text: "Pouvez-vous répéter plus lentement, s'il vous plaît ?", hint: "Demande polie" }];
    const fbPH = ["Bonjour, comment ça va ?", "Merci beaucoup !", "Excusez-moi, où sont les toilettes ?", "Je voudrais un café, s’il vous plaît.", "Combien ça coûte ?", "Pouvez-vous m’aider ?", "Je ne comprends pas.", "Je suis désolé(e).", "C’est une bonne idée.", "À demain !"];
    [ARTICLES, PROMPTS, DICT, PHRASES] = await Promise.all([
      jget('./data/news.json', fbA), jget('./data/prompts.json', fbP), jget('./data/dictation.json', fbD), jget('./data/phrases.json', fbPH)
    ]);
  }

  // ---------- TTS helper ----------
  function speak(text, lang = 'fr-FR', rate = 1) {
    try {
      if (!('speechSynthesis' in window)) throw 0;
      speechSynthesis.cancel(); const u = new SpeechSynthesisUtterance(text); u.lang = lang; u.rate = rate; speechSynthesis.speak(u);
    } catch { alert('Synthèse vocale non disponible.'); }
  }

  // ---------- Comprehension ----------
  let showEN = false, artIdx = 0;
  function renderArticle() {
    if (!ARTICLES.length) { $('#articleBox') && ($('#articleBox').value = '(Aucun article)'); $('#articleQA') && ($('#articleQA').textContent = ''); return; }
    const a = ARTICLES[artIdx % ARTICLES.length];
    $('#articleBox') && ($('#articleBox').value = showEN ? a.en : a.fr);
    $('#articleQA') && ($('#articleQA').innerHTML = `<div class="row small"><span class="pill">Texte: ${esc(a.title)}</span></div><ol class="small">${(a.qs || []).map((q, i) => `<li>${esc(q)} <details class="muted"><summary>Réponse suggérée</summary>${esc((a.ans || [])[i] || '')}</details></li>`).join('')}</ol>`);
  }
  $('#nextArticle')?.addEventListener('click', () => { artIdx++; renderArticle(); });
  $('#toggleArticleLang')?.addEventListener('click', () => { showEN = !showEN; $('#toggleArticleLang').textContent = showEN ? 'Afficher le texte (FR)' : 'Afficher traduction (EN)'; renderArticle(); });
  $('#speakArticle')?.addEventListener('click', () => { const t = $('#articleBox')?.value || ''; speak(t, 'fr-FR', .95); });
  $('#stopSpeakArticle')?.addEventListener('click', () => { try { speechSynthesis.cancel(); } catch { } });
  $('#markCompXP')?.addEventListener('click', () => addXP(5, 'reading'));

  // ---------- Speaking ----------
  function fillPromptSelect() {
    const sel = $('#promptSelect'); if (!sel) return; sel.innerHTML = '';
    Object.keys(PROMPTS).forEach(cat => { const o = document.createElement('option'); o.value = cat; o.textContent = cat[0].toUpperCase() + cat.slice(1); sel.appendChild(o); });
  }
  function randomPrompt(cat) { const arr = PROMPTS[cat] || PROMPTS[Object.keys(PROMPTS)[0]] || []; return arr[Math.floor(Math.random() * arr.length)] || ''; }
  function setPrompt(cat) { $('#promptBox') && ($('#promptBox').value = randomPrompt(cat)); }
  $('#newPrompt')?.addEventListener('click', () => setPrompt($('#promptSelect')?.value || Object.keys(PROMPTS)[0]));
  $('#promptSelect')?.addEventListener('change', () => setPrompt($('#promptSelect').value));
  $('#speakPrompt')?.addEventListener('click', () => { const t = $('#promptBox')?.value || ''; speak(t, 'fr-FR', 1); });

  const micState = $('#micState'), recState = $('#recState'), out = $('#speechOut');
  $('#askMic')?.addEventListener('click', async () => {
    try { const s = await navigator.mediaDevices.getUserMedia({ audio: true }); s.getTracks().forEach(t => t.stop()); if (micState) micState.innerHTML = '🎙️ Micro: <span class="mono">granted</span>'; }
    catch { if (micState) micState.innerHTML = '🎙️ Micro: <span class="mono">blocked</span>'; alert('Autorisez le micro pour github.io'); }
  });
  (async () => {
    if (!micState) return;
    if (!navigator.mediaDevices?.getUserMedia) { micState.innerHTML = '🎙️ Micro: <span class="mono">unsupported</span>'; return; }
    try {
      const r = await navigator.permissions?.query({ name: 'microphone' });
      if (r) { micState.innerHTML = '🎙️ Micro: <span class="mono">' + r.state + '</span>'; r.onchange = () => micState.innerHTML = '🎙️ Micro: <span class="mono">' + r.state + '</span>'; }
      else micState.innerHTML = '🎙️ Micro: <span class="mono">unknown</span>';
    } catch { micState.innerHTML = '🎙️ Micro: <span class="mono">unknown</span>'; }
  })();

  const SR = window.SpeechRecognition || window.webkitSpeechRecognition;
  let recog = null;
  function startRec() {
    if (!SR) { alert("La reconnaissance vocale n'est pas disponible ici. Essayez Chrome."); return; }
    if (recog) return;
    try {
      recog = new SR(); recog.lang = 'fr-FR'; recog.interimResults = true; recog.continuous = true; if (out) out.value = '';
      recog.onresult = e => { let txt = ''; for (let i = 0; i < e.results.length; i++) { txt += e.results[i][0].transcript + (e.results[i].isFinal ? '\n' : ' '); } if (out) out.value = txt.trim(); };
      recog.onerror = e => console.warn('SR error:', e);
      recog.onend = () => { if (recState) recState.innerHTML = '🗣️ État: <span class="mono">inactif</span>'; $('#stopRec') && ($('#stopRec').disabled = true); recog = null; };
      recog.start(); if (recState) recState.innerHTML = '🗣️ État: <span class="mono">écoute…</span>'; $('#stopRec') && ($('#stopRec').disabled = false);
    } catch (e) { alert('Impossible de démarrer.'); console.warn(e); }
  }
  function stopRec() { try { recog && recog.stop(); } catch { } }
  $('#startRec')?.addEventListener('click', startRec);
  $('#stopRec')?.addEventListener('click', stopRec);
  $('#markSpeakXP')?.addEventListener('click', () => addXP(5, 'speaking'));

  // ---------- Listening ----------
  let lastUtter = null, dIdx = 0;
  function playCurrentDictation() {
    if (!DICT.length) { $('#dictationHint') && ($('#dictationHint').textContent = '(Aucune dictée)'); return; }
    const d = DICT[dIdx % DICT.length];
    $('#dictationHint') && ($('#dictationHint').textContent = 'Indice : ' + d.hint);
    $('#dictationTarget') && ($('#dictationTarget').textContent = d.text);
    try {
      if ('speechSynthesis' in window) { speechSynthesis.cancel(); const u = new SpeechSynthesisUtterance(d.text); u.lang = 'fr-FR'; u.rate = .95; lastUtter = u; speechSynthesis.speak(u); }
      else alert('Synthèse vocale non disponible.');
    } catch { alert('Synthèse vocale indisponible.'); }
  }
  $('#playDictation')?.addEventListener('click', () => playCurrentDictation());
  $('#replayDictation')?.addEventListener('click', () => { try { if (lastUtter && 'speechSynthesis' in window) speechSynthesis.speak(lastUtter); else playCurrentDictation(); } catch { } });
  $('#checkDictation')?.addEventListener('click', () => {
    const target = ($('#dictationTarget')?.textContent || '').trim().toLowerCase();
    const guess = ($('#dictationInput')?.value || '').trim().toLowerCase();
    const wa = target.replace(/[^\p{L}\p{N}\s']/gu, '').split(/\s+/);
    const wb = guess.replace(/[^\p{L}\p{N}\s']/gu, '').split(/\s+/);
    const set = new Set(wa); let match = 0; wb.forEach(w => { if (set.has(w)) match++; });
    const score = wa.length ? match / wa.length : 0;
    $('#dictationScore') && ($('#dictationScore').textContent = `Score: ${Math.round(score * 100)}%`);
  });
  $('#markListenXP')?.addEventListener('click', () => addXP(5, 'listening'));

  // ---------- Vocab SRS ----------
  let vocab = store.get(K.vocab, []);
  function refreshVocabTable() {
    const tb = $('#vTable tbody'); if (!tb) return; tb.innerHTML = '';
    vocab.forEach(w => { const tr = document.createElement('tr'); tr.innerHTML = `<td>${esc(w.fr)}</td><td>${esc(w.en)}</td><td class="small">${w.due}</td><td><button class="btn bad small" data-del="${w.id}">Sup.</button></td>`; tb.appendChild(tr); });
    tb.onclick = e => { const id = e.target.getAttribute('data-del'); if (id) { vocab = vocab.filter(x => x.id != id); store.set(K.vocab, vocab); refreshVocabTable(); updateDueCount(); } };
  }
  function updateDueCount() {
    const today = fmt(todayKey()); const due = vocab.filter(v => v.due <= today).length;
    $('#dueCount') && ($('#dueCount').textContent = due); $('#dueNow') && ($('#dueNow').textContent = due);
  }
  function addVocab(fr, en) {
    const id = Date.now() + Math.random(); vocab.push({ id, fr, en, ease: 2.5, interval: 0, reps: 0, due: fmt(todayKey()) });
    store.set(K.vocab, vocab); refreshVocabTable(); updateDueCount();
  }
  $('#addWord')?.addEventListener('click', () => { const fr = $('#vFr')?.value.trim(), en = $('#vEn')?.value.trim(); if (!fr || !en) return; addVocab(fr, en); if ($('#vFr')) $('#vFr').value = ''; if ($('#vEn')) $('#vEn').value = ''; });
  $('#exportVocab')?.addEventListener('click', () => {
    try { const blob = new Blob([JSON.stringify(vocab, null, 2)], { type: 'application/json' }); const url = URL.createObjectURL(blob); const a = document.createElement('a'); a.href = url; a.download = 'vocab.json'; a.click(); URL.revokeObjectURL(url); }
    catch { alert('Export indisponible.'); }
  });
  $('#importVocab')?.addEventListener('change', e => {
    const f = e.target.files?.[0]; if (!f) return; const r = new FileReader();
    r.onload = () => { try { const arr = JSON.parse(r.result); if (Array.isArray(arr)) { vocab = arr; store.set(K.vocab, vocab); refreshVocabTable(); updateDueCount(); } } catch { alert('Fichier invalide'); } };
    r.readAsText(f);
  });
  $('#clearVocab')?.addEventListener('click', () => { if (confirm('Effacer tout le vocabulaire ?')) { vocab = []; store.set(K.vocab, vocab); refreshVocabTable(); updateDueCount(); } });

  // quiz
  let queue = [], current = null;
  function serveNext() {
    current = queue.shift();
    if (!current) { $('#quizFront h2') && ($('#quizFront h2').textContent = 'Terminé 👏'); ['rateAgain', 'rateHard', 'rateGood', 'rateEasy'].forEach(id => $('#' + id) && ($('#' + id).disabled = true)); $('#markVocabXP') && ($('#markVocabXP').disabled = false); return; }
    $('#quizFront h2') && ($('#quizFront h2').textContent = current.fr); $('#quizAnswer') && ($('#quizAnswer').value = ''); $('#quizBack') && ($('#quizBack').textContent = '');
    ['rateAgain', 'rateHard', 'rateGood', 'rateEasy'].forEach(id => $('#' + id) && ($('#' + id).disabled = true)); $('#revealA') && ($('#revealA').disabled = false); $('#skipCard') && ($('#skipCard').disabled = false);
  }
  function rate(grade) {
    const c = current; if (!c) return;
    if (grade < 3) { c.reps = 0; c.interval = 1; c.ease = Math.max(1.3, c.ease - 0.2); }
    else { c.reps += 1; if (c.reps === 1) c.interval = 1; else if (c.reps === 2) c.interval = 3; else c.interval = Math.round(c.interval * c.ease); c.ease = Math.min(3.0, c.ease + (grade === 4 ? 0.15 : 0)); }
    c.due = fmt(addDays(new Date(), c.interval)); const idx = vocab.findIndex(v => v.id === c.id); if (idx > -1) vocab[idx] = c; store.set(K.vocab, vocab);
    refreshVocabTable(); updateDueCount(); serveNext();
  }
  $('#startQuiz')?.addEventListener('click', () => { const today = fmt(todayKey()); queue = vocab.filter(v => v.due <= today); if (!queue.length) { alert('Aucune carte due.'); return; } serveNext(); });
  $('#skipCard')?.addEventListener('click', () => serveNext());
  $('#revealA')?.addEventListener('click', () => { if (!current) return; $('#quizBack') && ($('#quizBack').textContent = current.en); ['rateAgain', 'rateHard', 'rateGood', 'rateEasy'].forEach(id => $('#' + id) && ($('#' + id).disabled = false)); $('#revealA') && ($('#revealA').disabled = true); });
  $('#rateAgain')?.addEventListener('click', () => rate(0));
  $('#rateHard')?.addEventListener('click', () => rate(2));
  $('#rateGood')?.addEventListener('click', () => rate(3));
  $('#rateEasy')?.addEventListener('click', () => rate(4));
  $('#markVocabXP')?.addEventListener('click', () => { addXP(5, 'vocab'); $('#markVocabXP') && ($('#markVocabXP').disabled = true); });

  // ---------- Phrases ----------
  function todayIndexes() {
    const seed = parseInt((store.get(K.seed) ?? Date.now()).toString().slice(-6), 10);
    const day = parseInt(todayKey().replace(/-/g, ''), 10);
    const rand = n => (Math.abs(Math.sin(seed + day + n)) * 10000) % PHRASES.length | 0;
    const set = new Set(); while (set.size < 10 && set.size < PHRASES.length) set.add(rand(set.size));
    return [...set];
  }
  function renderPhrases() {
    const c = $('#phraseList'); if (!c) return; c.innerHTML = '';
    const list = PHRASES.length ? todayIndexes().map(i => PHRASES[i]) : [];
    list.forEach((p, i) => { const row = document.createElement('div'); row.className = 'row'; row.style.marginBottom = '6px'; const btn = document.createElement('button'); btn.className = 'btn'; btn.textContent = '🔊'; btn.onclick = () => speak(p, 'fr-FR', 1); const span = document.createElement('span'); span.textContent = (i + 1) + '. ' + p; row.appendChild(btn); row.appendChild(span); c.appendChild(row); });
  }
  $('#speakAllPhrases')?.addEventListener('click', () => { PHRASES.forEach((p, i) => setTimeout(() => speak(p, 'fr-FR', 1), i * 1500)); });
  $('#newPhrases')?.addEventListener('click', () => { store.set(K.seed, Date.now()); renderPhrases(); });
  $('#markPhrasesXP')?.addEventListener('click', () => addXP(5, 'phrases'));

  // ---------- init ----------
  async function init() {
    initTabs(); await loadData(); showSaveStatus();
    renderArticle(); fillPromptSelect(); setPrompt(Object.keys(PROMPTS)[0] || 'daily');
    refreshVocabTable(); updateDueCount(); renderPhrases();
    refreshProgress(); draw14(); setB2Countdown();
    window.addEventListener('resize', draw14);
  }
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', init); else init();
})();
