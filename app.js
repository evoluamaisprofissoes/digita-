/* Digita+ - app.js (modo desafio completo) */
(() => {
  'use strict';

  // ---------- Helpers ----------
  const $ = (id) => document.getElementById(id);
  const clamp = (n, a, b) => Math.max(a, Math.min(b, n));
  const now = () => Date.now();

  // ---------- DOM ----------
  const auth = $('auth');
  const app = $('app');

  const loginUsername = $('loginUsername');
  const loginPassword = $('loginPassword');
  const btnLogin = $('btnLogin');

  const btnLogout = $('btnLogout');
  const btnTheme = $('btnTheme');
  const btnSound = $('btnSound');
  const btnProfile = $('btnProfile');

  const profileDialog = $('profileDialog');
  const endDialog = $('endDialog');

  const btnResetProgress = $('btnResetProgress');
  const btnPlayAgain = $('btnPlayAgain');
  const btnCloseEnd = $('btnCloseEnd');

  const modeSelect = $('modeSelect');
  const challengeControls = $('challengeControls');
  const challengeDuration = $('challengeDuration');
  const challengeLives = $('challengeLives');

  const btnNew = $('btnNew');
  const btnStart = $('btnStart');
  const btnReset = $('btnReset');

  const targetTextEl = $('targetText');
  const typingArea = $('typingArea');

  const welcomeLine = $('welcomeLine');

  const statWpm = $('statWpm');
  const statAcc = $('statAcc');
  const statErr = $('statErr');

  const bestWpm = $('bestWpm');
  const bestAcc = $('bestAcc');
  const bestScore = $('bestScore');
  const sessionsEl = $('sessions');

  const profileUser = $('profileUser');
  const profileSessions = $('profileSessions');
  const profileAvgWpm = $('profileAvgWpm');
  const profileAvgAcc = $('profileAvgAcc');
  const profileBestScore = $('profileBestScore');

  const endWpm = $('endWpm');
  const endAcc = $('endAcc');
  const endErr = $('endErr');
  const endScore = $('endScore');

  const challengeHud = $('challengeHud');
  const hudTime = $('hudTime');
  const hudLives = $('hudLives');
  const hudScore = $('hudScore');
  const hudCombo = $('hudCombo');
  const hudMult = $('hudMult');

  // ---------- State ----------
  const STORAGE_KEY = 'digitamais_users_v1';
  const SETTINGS_KEY = 'digitamais_settings_v1';

  const DEFAULT_PASSWORD = 'aluno123';

  let users = loadUsers();
  let currentUser = null;

  let settings = loadSettings();

  // typing session state
  let mode = 'beginner'; // beginner | challenge
  let startTime = null;
  let active = false;
  let lastComputed = { wpm: 0, acc: 100, err: 0 };

  // challenge state
  let timerId = null;
  let remaining = 60;
  let lives = 3;
  let score = 0;
  let combo = 0;
  let mult = 1.0;
  let lastInputLen = 0;

  // Audio (single context)
  let audioCtx = null;

  // Text pool
  const TEXTS_BEGINNER = [
    'asdf jklç asdf jklç',
    'a s d f  j k l ç',
    'asdf asdf jklç jklç',
    'f j d k s l a ç'
  ];

  const TEXTS_CHALLENGE = [
    'A prática diária transforma a velocidade em hábito.',
    'Olhos na tela, dedos na posição base, respire e continue.',
    'Precisão primeiro: a velocidade vem com consistência.',
    'Digite sem pressa, acerte mais, e depois acelere.',
    'Disciplina vence motivação quando você repete todo dia.',
    'Hoje você treina; amanhã você domina o teclado.',
    'O foco é manter o ritmo: regularidade é poder.',
    'Errou? Sem drama. Corrija e siga em frente.',
    'Teclas F e J são o seu norte para a posição correta.',
    'Você não precisa ser rápido — precisa ser constante.'
  ];

  // ---------- Init ----------
  applyTheme(settings.theme);
  updateSoundButton();
  loginPassword.value = DEFAULT_PASSWORD;

  btnLogin.addEventListener('click', onLogin);
  btnLogout.addEventListener('click', onLogout);
  btnTheme.addEventListener('click', toggleTheme);
  btnSound.addEventListener('click', toggleSound);
  btnProfile.addEventListener('click', openProfile);

  btnResetProgress.addEventListener('click', resetProgress);
  btnPlayAgain.addEventListener('click', () => {
    endDialog.close();
    resetSession(true);
    startSession();
  });

  btnNew.addEventListener('click', () => {
    setNewText();
    resetSession(false);
  });

  btnStart.addEventListener('click', startSession);
  btnReset.addEventListener('click', () => resetSession(false));

  modeSelect.addEventListener('change', () => {
    mode = modeSelect.value;
    challengeControls.hidden = mode !== 'challenge';
    challengeHud.hidden = mode !== 'challenge';
    setNewText();
    resetSession(false);
  });

  typingArea.addEventListener('input', onTyping);
  typingArea.addEventListener('keydown', onKeydown);

  // initial text
  setNewText();
  renderTarget('');

  // ---------- Functions ----------
  function loadUsers(){
    try{
      const raw = localStorage.getItem(STORAGE_KEY);
      if(!raw) return {};
      const parsed = JSON.parse(raw);
      return (parsed && typeof parsed === 'object') ? parsed : {};
    }catch(e){ return {}; }
  }
  function saveUsers(){
    localStorage.setItem(STORAGE_KEY, JSON.stringify(users));
  }
  function loadSettings(){
    try{
      const raw = localStorage.getItem(SETTINGS_KEY);
      if(!raw) return { theme: 'dark', sound: true };
      const s = JSON.parse(raw);
      return {
        theme: s?.theme === 'light' ? 'light' : 'dark',
        sound: s?.sound !== false
      };
    }catch(e){
      return { theme: 'dark', sound: true };
    }
  }
  function saveSettings(){
    localStorage.setItem(SETTINGS_KEY, JSON.stringify(settings));
  }

  function applyTheme(theme){
    document.documentElement.dataset.theme = theme;
    settings.theme = theme;
    saveSettings();
    btnTheme.textContent = theme === 'light' ? 'Tema: Claro' : 'Tema: Escuro';
  }
  function toggleTheme(){
    applyTheme(document.documentElement.dataset.theme === 'light' ? 'dark' : 'light');
  }

  function ensureAudio(){
    if(audioCtx) return;
    try{
      audioCtx = new (window.AudioContext || window.webkitAudioContext)();
    }catch(e){
      audioCtx = null;
    }
  }
  function beep(ok){
    if(!settings.sound) return;
    ensureAudio();
    if(!audioCtx) return;

    const osc = audioCtx.createOscillator();
    const gain = audioCtx.createGain();
    osc.type = 'sine';
    osc.frequency.value = ok ? 560 : 180;
    gain.gain.value = 0.05;
    osc.connect(gain);
    gain.connect(audioCtx.destination);
    osc.start();
    osc.stop(audioCtx.currentTime + 0.05);
  }
  function updateSoundButton(){
    btnSound.textContent = settings.sound ? 'Som: On' : 'Som: Off';
  }
  function toggleSound(){
    settings.sound = !settings.sound;
    saveSettings();
    updateSoundButton();
  }

  function onLogin(){
    const u = (loginUsername.value || '').trim().toLowerCase();
    if(!u){
      alert('Informe um usuário.');
      return;
    }
    // create if missing
    if(!users[u]){
      users[u] = {
        username: u,
        sessions: 0,
        avgWpm: 0,
        avgAcc: 0,
        bestWpm: 0,
        bestAcc: 0,
        bestChallengeScore: 0
      };
      saveUsers();
    }
    currentUser = users[u];

    auth.hidden = true;
    app.hidden = false;

    welcomeLine.textContent = `Bem-vindo(a), ${currentUser.username}! Bora praticar hoje?`;
    refreshProgressUI();
    setNewText();
    resetSession(false);
    typingArea.focus();
  }

  function onLogout(){
    stopChallengeTimer();
    currentUser = null;
    auth.hidden = false;
    app.hidden = true;

    // reset login fields safely
    loginUsername.value = '';
    loginPassword.value = DEFAULT_PASSWORD;

    resetSession(false);
  }

  function openProfile(){
    if(!currentUser) return;
    refreshProfileUI();
    profileDialog.showModal();
  }

  function resetProgress(){
    if(!currentUser) return;
    const ok = confirm('Tem certeza que deseja zerar o progresso deste usuário neste navegador?');
    if(!ok) return;

    users[currentUser.username] = {
      username: currentUser.username,
      sessions: 0,
      avgWpm: 0,
      avgAcc: 0,
      bestWpm: 0,
      bestAcc: 0,
      bestChallengeScore: 0
    };
    currentUser = users[currentUser.username];
    saveUsers();
    refreshProgressUI();
    refreshProfileUI();
    alert('Progresso zerado.');
  }

  function refreshProgressUI(){
    if(!currentUser) return;
    bestWpm.textContent = currentUser.bestWpm ? Math.round(currentUser.bestWpm) : '—';
    bestAcc.textContent = currentUser.bestAcc ? `${Math.round(currentUser.bestAcc)}%` : '—';
    bestScore.textContent = currentUser.bestChallengeScore ? Math.round(currentUser.bestChallengeScore) : '—';
    sessionsEl.textContent = currentUser.sessions || 0;
  }

  function refreshProfileUI(){
    if(!currentUser) return;
    profileUser.textContent = currentUser.username;
    profileSessions.textContent = currentUser.sessions || 0;
    profileAvgWpm.textContent = currentUser.sessions ? Math.round(currentUser.avgWpm) : 0;
    profileAvgAcc.textContent = currentUser.sessions ? `${Math.round(currentUser.avgAcc)}%` : '0%';
    profileBestScore.textContent = Math.round(currentUser.bestChallengeScore || 0);
  }

  function setNewText(){
    const pool = (mode === 'challenge') ? TEXTS_CHALLENGE : TEXTS_BEGINNER;
    const pick = pool[Math.floor(Math.random() * pool.length)];
    targetTextEl.dataset.raw = pick;
    renderTarget('');
  }

  function renderTarget(typed){
    const raw = targetTextEl.dataset.raw || '';
    const len = typed.length;
    const parts = [];
    for(let i=0;i<raw.length;i++){
      const ch = raw[i];
      let cls = 'char';
      if(i < len){
        cls += (typed[i] === ch) ? ' correct' : ' wrong';
      }
      parts.push(`<span class="${cls}">${escapeHtml(ch)}</span>`);
    }
    targetTextEl.innerHTML = parts.join('');
  }

  function escapeHtml(s){
    return s.replace(/[&<>"']/g, (m) => ({
      '&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'
    }[m]));
  }

  function resetSession(keepText){
    stopChallengeTimer();
    active = false;
    startTime = null;
    lastComputed = { wpm:0, acc:100, err:0 };
    statWpm.textContent = '0';
    statAcc.textContent = '100%';
    statErr.textContent = '0';

    // challenge state reset
    remaining = parseInt(challengeDuration.value, 10) || 60;
    lives = parseInt(challengeLives.value, 10) || 3;
    score = 0;
    combo = 0;
    mult = 1.0;
    lastInputLen = 0;

    hudTime.textContent = String(remaining);
    hudLives.textContent = String(lives);
    hudScore.textContent = String(score);
    hudCombo.textContent = String(combo);
    hudMult.textContent = `x${mult.toFixed(1)}`;

    typingArea.value = '';
    if(!keepText) renderTarget('');
  }

  function startSession(){
    if(!currentUser){
      alert('Faça login primeiro.');
      return;
    }
    if(active) return;

    active = true;
    startTime = now();
    typingArea.focus();

    // for challenge: start timer
    if(mode === 'challenge'){
      remaining = parseInt(challengeDuration.value, 10) || 60;
      lives = parseInt(challengeLives.value, 10) || 3;
      hudTime.textContent = String(remaining);
      hudLives.textContent = String(lives);
      startChallengeTimer();
    }
  }

  function endSession(reason){
    if(!active) return;
    active = false;
    stopChallengeTimer();

    // finalize metrics based on current input
    computeAndUpdateStats();
    persistSession(lastComputed.wpm, lastComputed.acc, lastComputed.err, mode === 'challenge' ? score : null);

    // show result modal
    endWpm.textContent = String(lastComputed.wpm);
    endAcc.textContent = `${lastComputed.acc}%`;
    endErr.textContent = String(lastComputed.err);
    endScore.textContent = (mode === 'challenge') ? String(score) : '—';

    refreshProgressUI();
    refreshProfileUI();

    // small cue
    beep(true);

    // If ended because finished text in beginner, auto new text on play again
    endDialog.showModal();
  }

  function persistSession(wpm, acc, err, challengeScore){
    if(!currentUser) return;

    // sessions
    const n = (currentUser.sessions || 0) + 1;
    currentUser.sessions = n;

    // rolling averages (correct formula)
    currentUser.avgWpm = ((currentUser.avgWpm || 0) * (n - 1) + wpm) / n;
    currentUser.avgAcc = ((currentUser.avgAcc || 0) * (n - 1) + acc) / n;

    // bests
    if(wpm > (currentUser.bestWpm || 0)) currentUser.bestWpm = wpm;
    if(acc > (currentUser.bestAcc || 0)) currentUser.bestAcc = acc;

    if(typeof challengeScore === 'number'){
      if(challengeScore > (currentUser.bestChallengeScore || 0)){
        currentUser.bestChallengeScore = challengeScore;
      }
    }

    users[currentUser.username] = currentUser;
    saveUsers();
  }

  function onKeydown(e){
    // Prevent tab from leaving textarea mid-game
    if(e.key === 'Tab'){
      e.preventDefault();
    }
  }

  function onTyping(){
    renderTarget(typingArea.value);

    if(!active) return;

    // compute metrics live
    computeAndUpdateStats();

    // beginner: finish when full match
    if(mode === 'beginner'){
      const raw = targetTextEl.dataset.raw || '';
      if(typingArea.value === raw){
        endSession('completed');
      }
      return;
    }

    // challenge: scoring & lives based on new char deltas
    if(mode === 'challenge'){
      applyChallengeDelta();
      // fail on 0 lives
      if(lives <= 0){
        endSession('no_lives');
        return;
      }
    }
  }

  function computeAndUpdateStats(){
    const raw = targetTextEl.dataset.raw || '';
    const typed = typingArea.value || '';

    // accuracy based only on typed part
    let correct = 0;
    let err = 0;
    for(let i=0;i<typed.length;i++){
      if(typed[i] === raw[i]) correct++;
      else err++;
    }

    const elapsedMin = startTime ? (now() - startTime) / 60000 : 0;
    const words = typed.trim() ? typed.trim().split(/\s+/).length : 0;
    const wpm = (elapsedMin > 0 && words > 0) ? Math.round(words / elapsedMin) : 0;
    const acc = typed.length ? Math.round((correct / typed.length) * 100) : 100;

    statWpm.textContent = String(wpm);
    statAcc.textContent = `${acc}%`;
    statErr.textContent = String(err);

    lastComputed = { wpm, acc, err };
  }

  function startChallengeTimer(){
    stopChallengeTimer();
    timerId = window.setInterval(() => {
      if(!active) return;
      remaining -= 1;
      remaining = clamp(remaining, 0, 999);
      hudTime.textContent = String(remaining);
      if(remaining <= 0){
        endSession('time_up');
      }
    }, 1000);
  }

  function stopChallengeTimer(){
    if(timerId){
      clearInterval(timerId);
      timerId = null;
    }
  }

  function applyChallengeDelta(){
    const raw = targetTextEl.dataset.raw || '';
    const typed = typingArea.value || '';

    // Determine new characters typed since last check
    // (only count additions, ignore deletions to avoid exploit)
    const len = typed.length;
    if(len <= lastInputLen){
      lastInputLen = len;
      return;
    }

    for(let i = lastInputLen; i < len; i++){
      const ch = typed[i];
      const ok = (ch === raw[i]);

      if(ok){
        combo += 1;
        // multiplier grows with combo
        // every 10 combo adds 0.1 up to x2.0
        mult = 1.0 + Math.min(1.0, Math.floor(combo / 10) * 0.1);
        const gained = Math.round(10 * mult);
        score += gained;

        beep(true);
      }else{
        // penalty
        lives -= 1;
        lives = clamp(lives, 0, 99);
        const lost = 5;
        score = Math.max(0, score - lost);

        // reset combo/mult
        combo = 0;
        mult = 1.0;

        beep(false);
      }

      hudLives.textContent = String(lives);
      hudScore.textContent = String(score);
      hudCombo.textContent = String(combo);
      hudMult.textContent = `x${mult.toFixed(1)}`;
    }

    lastInputLen = len;

    // If typed surpasses text length, loop new phrase (more fun)
    const rawLen = raw.length;
    if(len >= rawLen){
      // carry-over: start next phrase automatically
      setNewText();
      typingArea.value = '';
      lastInputLen = 0;
      renderTarget('');
    }
  }

  // Close end modal buttons
  btnCloseEnd?.addEventListener('click', () => endDialog.close());

  // Small UX: allow Enter to login
  loginUsername.addEventListener('keydown', (e) => {
    if(e.key === 'Enter') onLogin();
  });

})();