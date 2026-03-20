// Final game script v2 - stable
const QUESTIONS = (typeof questions !== 'undefined') ? questions : {};

// UI elements
const mainMenu = document.getElementById('main-menu');
const questionArea = document.getElementById('question-area');
const questionElement = document.getElementById('question');
const answersElement = document.getElementById('answers');
const moneyElement = document.getElementById('current-money');
const resultArea = document.getElementById('result');
const finalMoneyElement = document.getElementById('final-money');
const restartButton = document.getElementById('restart');
const timerElement = document.getElementById('timer');
const fiftyButton = document.getElementById('fifty-button');
const audienceButton = document.getElementById('audience-button');
const quitButton = document.getElementById('quit-button');

// state
let currentQuestions = [];
let currentQuestionIndex = 0;
let money = 0;
let moneyIndex = -1;
let gameActive = false;
let fiftyUsed = false;
let audienceUsed = false;
let shuffleOnNextStart = false;

// ladder settings: 10 levels
const LEVELS = 10;
const PRIZES = [100,200,400,800,1600,3200,6400,12800,25600,1000000];
function prizeFor(idx){ return PRIZES[Math.max(0, Math.min(PRIZES.length-1, idx))]; }

// audio – lazy-init AudioContext on first user interaction (required by mobile browsers)
let audioCtx = null;
function getAudioCtx(){
  if(audioCtx) return audioCtx;
  try{ audioCtx = new (window.AudioContext || window.webkitAudioContext)(); }catch(e){ return null; }
  return audioCtx;
}
function playTone(freq, type='sine', dur=0.12, gain=0.12){
  const ctx = getAudioCtx(); if(!ctx) return;
  try{ if(ctx.state==='suspended') ctx.resume(); }catch(e){}
  const o = ctx.createOscillator(); const g = ctx.createGain();
  o.type = type; o.frequency.value = freq; g.gain.value = gain;
  o.connect(g); g.connect(ctx.destination);
  o.start(); g.gain.exponentialRampToValueAtTime(0.0001, ctx.currentTime + dur);
  setTimeout(()=>{ try{o.stop();}catch(e){} }, dur*1000+50);
}
function playSound(name){
  if(!getAudioCtx()) return;
  if(name==='tick') playTone(880,'sine',0.06,0.05);
  else if(name==='correct'){ playTone(660,'sine',0.12,0.12); setTimeout(()=>playTone(880,'sine',0.1,0.08),120); }
  else if(name==='wrong'){ playTone(160,'sawtooth',0.45,0.16); }
  else if(name==='levelup'){ playTone(1200,'triangle',0.16,0.14); setTimeout(()=>playTone(1400,'triangle',0.12,0.12),160); }
}

// confetti
function launchConfetti(count=80){
  const area = document.getElementById('confetti');
  if(!area) return;
  area.innerHTML = '';
  const colors = ['#ffd54a','#ff6b6b','#7bed9f','#74b9ff','#f78fb3'];
  for(let i=0;i<count;i++){
    const el = document.createElement('div'); el.className='confetti-piece';
    el.style.background = colors[Math.floor(Math.random()*colors.length)];
    el.style.left = Math.floor(Math.random()*100)+'%';
    el.style.top = (-10 - Math.random()*10)+'vh';
    el.style.transform = 'rotate('+ (Math.random()*360) +'deg)';
    el.style.width = (8 + Math.random()*10)+'px';
    el.style.height = (10 + Math.random()*14)+'px';
    el.style.animationDelay = (Math.random()*400)+'ms';
    area.appendChild(el);
    setTimeout(()=>{ if(el && el.parentNode) el.parentNode.removeChild(el); }, 4000 + Math.random()*1000);
  }
}

// shuffle
function shuffleArray(a){
  for(let i=a.length-1;i>0;i--){ const j = Math.floor(Math.random()*(i+1)); [a[i],a[j]] = [a[j],a[i]]; }
}

// Timer
let rafId = null;
let questionEnd = 0;
let remainingMs = 0;
const QUESTION_TIME = 40;
function startTimer(seconds){ clearTimer(); const now = performance.now(); questionEnd = now + seconds*1000; rafTick(); }
function rafTick(){ const now = performance.now(); const msLeft = Math.max(0, questionEnd - now); const secLeft = Math.ceil(msLeft/1000); if(timerElement) timerElement.textContent = secLeft; remainingMs = msLeft; if(msLeft <= 0){ clearTimer(); showLoss(); return; } rafId = requestAnimationFrame(rafTick); }
function clearTimer(){ if(rafId){ cancelAnimationFrame(rafId); rafId=null; } }
function pauseTimer(){ clearTimer(); }
function resumeTimer(){ if(remainingMs>0){ questionEnd = performance.now() + remainingMs; rafTick(); } }

// UI: ladder show/hide
function buildLadder(){ const ladder = document.getElementById('ladder'); if(!ladder) return; ladder.innerHTML = '<h3>Шанашь голло</h3>'; const list = document.createElement('div'); list.className='ladder-list'; for(let i=LEVELS-1;i>=0;i--){ const it = document.createElement('div'); it.className='ladder-item'; it.dataset.level = i; it.innerHTML = `<span>${i+1}</span><span>${prizeFor(i)}</span>`; if(i===4||i===9) it.classList.add('safe'); list.appendChild(it); } ladder.appendChild(list); }
function showLadder(){ const ladder=document.getElementById('ladder'); if(!ladder) return; ladder.style.display='block'; ladder.classList.remove('hidden'); ladder.classList.add('visible'); }
function hideLadder(){ const ladder=document.getElementById('ladder'); if(!ladder) return; ladder.classList.remove('visible'); ladder.classList.add('hidden'); setTimeout(()=>{ if(ladder) ladder.style.display='none'; },350); }
function highlightLadder(idx){ const items = document.querySelectorAll('.ladder-item'); items.forEach(it=> it.classList.remove('current')); const sel = document.querySelector('.ladder-item[data-level="'+idx+'"]'); if(sel) sel.classList.add('current'); }

// Game flow
function startGame(category){ if(gameActive) return; gameActive = true; currentQuestions = (QUESTIONS[category]||[]).slice(); if(shuffleOnNextStart){ shuffleArray(currentQuestions); shuffleOnNextStart = false; } currentQuestionIndex = 0; moneyIndex = -1; money = 0; if(moneyElement) moneyElement.textContent = money; if(mainMenu) mainMenu.style.display = 'none'; if(questionArea) questionArea.style.display = 'block'; fiftyUsed = false; audienceUsed = false; if(fiftyButton) fiftyButton.disabled = false; if(audienceButton) audienceButton.disabled = false; buildLadder(); showLadder(); loadQuestion(); }

function loadQuestion(){ clearTimer(); if(!gameActive) return; if(currentQuestionIndex >= currentQuestions.length){ if(currentQuestionIndex >= LEVELS) { showWin(); } else { showLoss(); } return; } const q = currentQuestions[currentQuestionIndex]; if(questionElement) questionElement.textContent = q.question; const btns = answersElement.querySelectorAll('button'); btns.forEach(b=>{ const k = b.dataset.answer; b.style.display = 'inline-block'; b.disabled = false; b.classList.remove('correct','incorrect'); if(q.answers && q.answers[k]) b.textContent = `${k.toUpperCase()}: ${q.answers[k]}`; b.onclick = ()=> handleAnswer(k,b); }); highlightLadder(currentQuestionIndex); startTimer(QUESTION_TIME); }

function handleAnswer(key, btn){ if(!gameActive) return; stopAndDisableAnswers(); clearTimer(); const q = currentQuestions[currentQuestionIndex]; const correct = q.correctAnswer; if(key === correct){ btn.classList.add('correct'); playSound('correct'); if(currentQuestionIndex + 1 >= LEVELS){ money = 1000000; if(moneyElement) moneyElement.textContent = money; setTimeout(()=> showWin(), 700); return; } moneyIndex = Math.max(moneyIndex, currentQuestionIndex); money = prizeFor(moneyIndex); if(moneyElement) moneyElement.textContent = money; playSound('levelup'); setTimeout(()=>{ currentQuestionIndex++; loadQuestion(); },700); } else { btn.classList.add('incorrect'); playSound('wrong'); const btns = answersElement.querySelectorAll('button'); btns.forEach(b=>{ if(b.dataset.answer === correct) b.classList.add('correct'); }); setTimeout(()=> showLoss(), 900); } }

function stopAndDisableAnswers(){ const btns = answersElement.querySelectorAll('button'); btns.forEach(b=> b.disabled = true); }

function useFifty(){ if(fiftyUsed || !gameActive) return; fiftyUsed = true; if(fiftyButton) fiftyButton.disabled = true; const q = currentQuestions[currentQuestionIndex]; const correct = q.correctAnswer; const btns = Array.from(answersElement.querySelectorAll('button')); const wrong = btns.filter(b=> b.dataset.answer !== correct && b.style.display !== 'none'); while(wrong.length > 1){ const idx = Math.floor(Math.random()*wrong.length); const b = wrong.splice(idx,1)[0]; b.style.display = 'none'; } }

function useAudience(){ if(audienceUsed || !gameActive) return; audienceUsed = true; if(audienceButton) audienceButton.disabled = true; pauseTimer(); const noteId = 'audience-resume-note'; if(!document.getElementById(noteId)){ const note = document.createElement('div'); note.id = noteId; note.style.marginTop = '8px'; note.style.padding = '8px'; note.style.background = 'rgba(255,255,255,0.04)'; note.style.borderRadius = '8px'; note.style.textAlign = 'center'; note.textContent = 'Залай туhаламжа: саг зогсод байна'; const resume = document.createElement('button'); resume.textContent = 'Хаагад, үргэлжэлүүлэ'; resume.style.marginLeft='8px'; resume.style.padding='6px 10px'; resume.style.borderRadius='6px'; resume.onclick = ()=>{ const n = document.getElementById(noteId); if(n && n.parentNode) n.parentNode.removeChild(n); resumeTimer(); }; note.appendChild(resume); const hr = document.querySelector('.help-row'); if(hr) hr.appendChild(note); } }

// overlays
function showEndOverlay(title){ clearTimer(); gameActive = false; const existing = document.getElementById('end-overlay'); if(existing) existing.remove(); const overlay = document.createElement('div'); overlay.id = 'end-overlay'; Object.assign(overlay.style,{position:'fixed',inset:0,background:'rgba(0,0,0,0.95)',display:'flex',alignItems:'center',justifyContent:'center',zIndex:9999}); const box = document.createElement('div'); Object.assign(box.style,{color:'#fff',textAlign:'center',padding:'24px',borderRadius:'12px',maxWidth:'92%',width:'min(720px,92%)'}); const h = document.createElement('h1'); h.textContent = title; Object.assign(h.style,{fontSize:'40px',margin:'0 0 12px'}); box.appendChild(h); const p = document.createElement('p'); p.textContent = ''; Object.assign(p.style,{fontSize:'18px'}); box.appendChild(p); const btn = document.createElement('button'); btn.textContent = 'Дахин эхилхэ'; Object.assign(btn.style,{marginTop:'18px',padding:'10px 16px',borderRadius:'8px',border:'none',cursor:'pointer'}); btn.onclick = ()=>{ overlay.remove(); restartGame(); }; box.appendChild(btn); overlay.appendChild(box); document.body.appendChild(overlay); }
function showWin(){ launchConfetti(120); playSound('levelup'); showEndOverlay('Та шуугөөт!!!'); }
function showLoss(){ shuffleOnNextStart = true; hideLadder(); showEndOverlay('Та шуугдөөт!'); }

function restartGame(){ clearTimer(); gameActive = false; if(questionArea) questionArea.style.display = 'none'; const mm = document.getElementById('main-menu'); if(mm) mm.style.display = 'block'; currentQuestionIndex = 0; money = 0; moneyIndex = -1; if(moneyElement) moneyElement.textContent = money; const note = document.getElementById('audience-resume-note'); if(note && note.parentNode) note.parentNode.removeChild(note); const conf = document.getElementById('confetti'); if(conf) conf.innerHTML = ''; hideLadder(); shuffleOnNextStart = false; }

// attach handlers
if(mainMenu){ const btns = mainMenu.querySelectorAll('button[data-category]'); btns.forEach(b=> b.addEventListener('click', ()=> startGame(b.dataset.category))); }
if(fiftyButton) fiftyButton.addEventListener('click', useFifty);
if(audienceButton) audienceButton.addEventListener('click', useAudience);
if(restartButton) restartButton.addEventListener('click', restartGame);
if(quitButton) quitButton.addEventListener('click', ()=>{ if(!gameActive) return; clearTimer(); gameActive=false; showEndOverlay('Танай шүүбэри: ' + (money||0)); });

// initial state: hide question area and ladder
if(questionArea) questionArea.style.display = 'none';
const ladderEl = document.getElementById('ladder'); if(ladderEl){ ladderEl.style.display='none'; ladderEl.classList.add('hidden'); }
