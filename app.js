"use strict";
const PHOTO="assets/brionna-original.jpeg";
const CATS=[...new Set(QS.map(q=>q.cat))];
const ICONS=[{emoji:"🧍",label:"Body"},{emoji:"🖥️",label:"Desk"},{emoji:"💉",label:"Tools"},{emoji:"🤝",label:"Patient"}];
const KEY="brionna_ma_study_v4";
const PREVKEY="brionna_ma_study_v3";
const OLDKEY="brionna_ma_study_v1";
let old={};try{old=JSON.parse(localStorage.getItem(OLDKEY)||"{}")}catch{}
const initial={name:"Brionna",exam:"",date:"",xp:0,streak:0,lastDay:"",done:{},missed:[],onboard:false,seen:[],sound:true,volume:.42};
let s;try{s={...initial,...old,...JSON.parse(localStorage.getItem(PREVKEY)||"{}"),...JSON.parse(localStorage.getItem(KEY)||"{}")}}catch{s={...initial,...old}}
let correctRun=0,examDeadline=0,timerHandle=null,visited=s.visited||{},flashDeck=[];
let page=s.onboard?"home":"welcome",deck=[],idx=0,chosen=null,checked=false,score=0,mode="",cat="",flipped=false,flashIdx=0;
const root=document.getElementById("root");
function persist(){try{localStorage.setItem(KEY,JSON.stringify(s))}catch(e){console.warn("Progress cannot be saved in this browser",e)}}

// Small synthesized sounds, played only as a direct response to user actions.
// No audio downloads, recordings, or external libraries are required.
let audioContext=null;
function note(hz,start,duration,peak=0.03,wave="sine",slide=0){
 const a=audioContext,osc=a.createOscillator(),gain=a.createGain();
 const t=a.currentTime+start,vol=Math.max(.001,peak*(Number(s.volume)||.4));
 osc.type=wave;osc.frequency.setValueAtTime(Math.max(40,hz),t);
 if(slide)osc.frequency.exponentialRampToValueAtTime(Math.max(40,slide),t+duration);
 gain.gain.setValueAtTime(.0001,t);
 gain.gain.exponentialRampToValueAtTime(vol,t+Math.min(.013,duration/3));
 gain.gain.exponentialRampToValueAtTime(.0001,t+duration);
 osc.connect(gain);gain.connect(a.destination);osc.start(t);osc.stop(t+duration+.018);
 osc.onended=()=>{osc.disconnect();gain.disconnect()};
}
function playSound(kind="tap"){
 if(!s.sound)return;
 try{
  let AC=window.AudioContext||window.webkitAudioContext;
  if(!AC)return;
  if(!audioContext)audioContext=new AC();
  if(audioContext.state==="suspended")audioContext.resume().catch(()=>{});
  let v=s.volume===undefined?.42:Number(s.volume);
  if(!Number.isFinite(v)||v<=0)return;
  switch(kind){
   case "tap": note(680,0,.072,.032,"triangle",480);break;
   case "select": note(620,0,.085,.032,"sine",810);break;
   case "open": note(410,0,.13,.025);note(555,.057,.17,.034);note(740,.115,.24,.027);break;
   case "flip": note(320,0,.15,.023,"triangle",790);note(920,.105,.085,.015,"sine",680);break;
   case "next": note(560,0,.083,.027,"triangle",730);break;
   case "correct": note(630,0,.16,.045);note(890,.11,.26,.049);break;
   case "wrong": note(330,0,.19,.035,"sine",245);note(250,.12,.18,.022,"triangle",195);break;
   case "streak": note(620,0,.13,.032);note(780,.075,.15,.035);note(990,.15,.17,.039);note(1240,.235,.32,.037);break;
   case "mega": [587,740,880,1174,1480].forEach((f,i)=>note(f,i*.085,.32,.034));break;
   case "finish": [523,659,784,1047,1319].forEach((f,i)=>note(f,i*.095,i===4?.64:.22,.034));break;
   case "on": note(480,0,.13,.03);note(720,.09,.22,.038);break;
  }
 }catch(e){/* Audio is optional; gameplay should never break. */}
}
function updateSoundControls(){
 document.querySelectorAll('[data-sound-toggle]').forEach(button=>{
  const enabled=!!s.sound,compact=button.dataset.compact==='yes';
  button.setAttribute('aria-pressed',String(enabled));
  button.setAttribute('aria-label',enabled?'Mute sound effects':'Turn on sound effects');
  button.textContent=compact?(enabled?'🔊':'🔇'):(enabled?'🔊 Sounds on':'🔇 Sounds off');
 });
}
function toggleSound(){
 s.sound=!s.sound;persist();
 if(s.sound)playSound('on');
 updateSoundControls();
}
function setVolume(value){
 let n=Math.max(0,Math.min(100,Number(value)||0));s.volume=n/100;persist();
 const display=document.getElementById('volumeDisplay');if(display)display.textContent=n+'%';
}
function safe(v){return String(v??"").replace(/[&<>"']/g,x=>({"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#39;"}[x]))}
function datekey(d=new Date()){return [d.getFullYear(),String(d.getMonth()+1).padStart(2,"0"),String(d.getDate()).padStart(2,"0")].join("-")}
function days(){if(!s.date)return null;let a=new Date(datekey()+"T12:00:00"),b=new Date(s.date+"T12:00:00");return Math.round((b-a)/86400000)}
function total(){return Object.values(s.done).reduce((a,b)=>a+b,0)}
function navIcon(p){
 const paths={
  home:'<path d="m3 10 9-7 9 7v10a1 1 0 0 1-1 1h-5.4v-7h-5.2v7H4a1 1 0 0 1-1-1z"/>',
  learn:'<path d="M12 6c-3.4-2-6.2-2-9-1.1V20c2.8-.9 5.6-.9 9 1 3.4-1.9 6.2-1.9 9-1V4.9c-2.8-.9-5.6-.9-9 1.1z"/><path d="M12 6v15"/>',
  practice:'<path d="M7.2 8h9.6a5 5 0 0 1 4.8 4l.8 4.1a2.7 2.7 0 0 1-4.3 2.5l-2.7-2H8.6l-2.7 2a2.7 2.7 0 0 1-4.3-2.5l.8-4.1a5 5 0 0 1 4.8-4z"/><path d="M8 11v5M5.5 13.5h5"/><circle cx="16.4" cy="12.4" r=".7" fill="currentColor" stroke="none"/><circle cx="19" cy="14.7" r=".7" fill="currentColor" stroke="none"/>',
  progress:'<path d="M4 20V13h4v7M10 20V8h4v12M16 20V4h4v16"/><path d="M2 21h20"/>',
  settings:'<path d="M12 3.3 14 4l1.5-.9 2 2-.9 1.6.8 1.8 1.8.5v2.8l-1.8.5-.8 1.8.9 1.6-2 2L14 17l-2 .7-2-.7-1.5.9-2-2 .9-1.6-.8-1.8-1.8-.5V9.2l1.8-.5.8-1.8-.9-1.6 2-2L10 4z" transform="translate(0 1.4) scale(1.04)"/><circle cx="12" cy="12" r="2.6"/>'
 };
 return `<svg class="nav-svg" viewBox="0 0 24 24" aria-hidden="true" fill="none" stroke="currentColor" stroke-width="1.9" stroke-linejoin="round" stroke-linecap="round">${paths[p]||paths.home}</svg>`
}
function nav(){return `<nav class="nav" aria-label="Main navigation">${[["home","Home"],["learn","Learn"],["practice","Practice"],["progress","Progress"],["settings","More"]].map(([p,t])=>`<button type="button" class="${page===p?"active":""}" ${page===p?'aria-current="page"':''} aria-label="${t}" onclick="go('${p}')"><span class="nav-icon">${navIcon(p)}</span><span class="nav-label">${t}</span></button>`).join("")}</nav>`}
function go(p){if(page==="quiz"&&p!=="quiz")clearInterval(timerHandle);if(p!==page)playSound(p==="results"?"finish":(["quiz","flash","setup","learn","practice","progress"].includes(p)?"open":"tap"));page=p;draw();root.scrollTop=0;window.scrollTo(0,0)}
function head(title,subtitle=""){return `<div class="row"><div><div class="eyebrow">Brionna's MA Study ♡</div><h1 class="hello">${title}</h1>${subtitle?`<div class="muted">${subtitle}</div>`:""}</div><div class="row" style="gap:8px"><button type="button" class="sound-toggle" data-sound-toggle data-compact="yes" onclick="toggleSound()" aria-label="${s.sound?"Mute sound effects":"Turn on sound effects"}" aria-pressed="${s.sound}">${s.sound?"🔊":"🔇"}</button><img class="avatar" src="${PHOTO}" alt="Brionna's original photo"></div></div>`}
function draw(){let h="";
if(page==="welcome"){h=`<div class="eyebrow center">A little something just for you 💗</div><h1 class="hello center" style="margin:22px 0">Brionna's<br><span style="color:var(--pink)">MA Study</span></h1><img class="welcome-photo" src="${PHOTO}" alt="Original unedited photo of Brionna wearing scrubs"><div class="panel center"><h2 class="title">Your journey starts here 💕</h2><p class="muted">Little lessons. Big dreams. You've got this!</p><button class="cta" onclick="go('setup')">Let's get started →</button></div>`}
else if(page==="setup"){h=`<div class="eyebrow">Step 1 · Your journey</div><h1 class="hello">Make it yours 💗</h1><p class="muted">Pick your exam and set your date when you know it. Nothing is required except your name.</p><div class="panel"><label>Your name</label><input class="input" id="nm" value="${safe(s.name)}" maxlength="35"><label>Which exam?</label><select class="input" id="exam"><option value="">I'll choose later</option>${["NHA CCMA","AAMA CMA","AMT RMA","NCCT NCMA","Other / not sure"].map(x=>`<option ${s.exam===x?"selected":""}>${x}</option>`).join("")}</select><label>Exam date (optional)</label><input class="input" type="date" id="date" value="${safe(s.date)}"><button class="cta" onclick="saveSetup()">Create my study plan →</button></div>`}
else if(page==="home"){let d=days(),goal=5,doneToday=0;h=`${head("Hey, "+safe(s.name)+"! 💗","Ready to get a little closer to your goal?")}<div class="panel soft"><div class="row"><div><div class="eyebrow">Certification countdown</div><h2 class="title" style="margin-top:9px">${s.exam?safe(s.exam):"Medical Assistant Exam"}</h2></div><span style="font-size:33px">🗓️</span></div><div class="center">${d===null?`<div class="count">--</div><div class="muted">Add your exam date when you're ready</div>`:`<div class="count">${Math.max(0,d)}</div><div class="muted">${d<0?"Your date has passed — update it anytime":d===0?"It's exam day! You've got this!":"days until exam day"}</div>`}</div><button class="iconbtn" style="margin-top:12px" onclick="go('settings')">${s.date?"Change date":"Set exam date"} →</button></div><div class="pills"><div class="pill">🔥<b>${s.streak}</b><small>Day streak</small></div><div class="pill">💎<b>${s.xp}</b><small>Total XP</small></div><div class="pill">🏆<b>${Math.floor(s.xp/100)+1}</b><small>Level</small></div></div><div class="panel"><h2 class="title">A note for you 💌</h2><p style="line-height:1.65">let's get this done so we can get to Florida</p></div><div class="panel"><div class="row"><h2 class="title">Today's mission ✨</h2><span class="badge">+XP</span></div><p class="muted">Complete a mini lesson. Every question you practice counts!</p><div class="progress"><i style="width:${Math.min(100,(s.xp%50)/50*100)}%"></i></div><p class="tiny">Next 50 XP milestone: ${50-s.xp%50} XP to go</p><button class="cta" onclick="go('learn')">Continue learning →</button></div>`}
else if(page==="learn"){h=`${head("Your study path 🌸","Four AMT RMA exam work areas. Each visit draws a fresh 15-question lesson. Earn XP!")}<div class="row" style="margin-top:20px"><span class="badge">⭐ ${total()} completed rounds</span><span class="badge">💎 ${s.xp} XP</span></div><div class="path">${CATS.map((c,i)=>`<div class="path-item"><button class="node open-pop" aria-label="Study ${safe(c)}" onclick="lesson(${i})"><div class="node-art"><div>${ICONS[i].emoji}</div><small>${ICONS[i].label}</small></div></button><div class="node-label">${safe(c)}<div class="stars">${s.done[c]?"★".repeat(Math.min(3,s.done[c])):"☆☆☆"}</div></div></div>`).join("")}</div>`}
else if(page==="practice"){h=`${head("Practice arcade 🎮","Choose how you want to train today.")}<div class="grid" style="margin-top:18px"><button class="mode" onclick="mixed()"><span class="emoji">⚡</span><b>Quick Quiz</b><span class="muted">10 fresh mixed questions</span></button><button class="mode" onclick="flashStart()"><span class="emoji">🗃️</span><b>Flashcards</b><span class="muted">Tap to reveal answers</span></button><button class="mode" onclick="review()"><span class="emoji">🎯</span><b>Weak Spots</b><span class="muted">${s.missed.length} to revisit</span></button><button class="mode" onclick="mock()"><span class="emoji">⏱️</span><b>Full RMA Simulation</b><span class="muted">210 questions · 120 minutes</span></button></div><div class="panel"><h3>Practice with purpose</h3><p class="muted">Fresh randomized questions, answer explanations, and missed-question review. The full mock uses 210 questions in 120 minutes. Unofficial AMT-aligned practice.</p></div>`}
else if(page==="progress"){h=`${head("Your progress 📈","Every session is another step forward.")}<div class="panel center"><div class="big-icon">🏆</div><div class="count">${s.xp} XP</div><p class="muted">${total()} quiz rounds completed · ${s.streak}-day streak</p></div><div class="panel"><h2 class="title">Subject progress</h2>${CATS.map((c,i)=>`<div class="subject"><span class="icon" aria-label="${safe(ICONS[i].label)}">${ICONS[i].emoji}</span><div class="body"><b>${safe(c)}</b><br><small>${s.done[c]||0} rounds completed</small></div><span class="badge">${s.done[c]?"⭐":"○"}</span></div>`).join("")}</div><h2 class="title">Achievements</h2><div class="badge-grid"><div class="achievement"><span>${total()?"🌟":"🔒"}</span>First lesson</div><div class="achievement"><span>${s.streak>=3?"🔥":"🔒"}</span>3-day streak</div><div class="achievement"><span>${s.xp>=100?"💎":"🔒"}</span>100 XP</div><div class="achievement"><span>${s.missed.length===0&&s.xp>0?"💗":"🔒"}</span>Clear review</div><div class="achievement"><span>${total()>=5?"🎓":"🔒"}</span>5 lessons</div><div class="achievement"><span>${s.xp>=500?"👑":"🔒"}</span>500 XP</div></div>`}
else if(page==="settings"){h=`${head("Your settings ⚙️","Change your exam date without losing your progress.")}<div class="panel"><label>Display name</label><input class="input" id="nm" value="${safe(s.name)}"><label>Certification exam</label><select class="input" id="exam"><option value="">Choose later</option>${["NHA CCMA","AAMA CMA","AMT RMA","NCCT NCMA","Other / not sure"].map(x=>`<option ${s.exam===x?"selected":""}>${x}</option>`).join("")}</select><label>Exam date</label><input class="input" id="date" type="date" value="${safe(s.date)}"><button class="cta" onclick="saveSetup()">Save my settings ✓</button></div><div class="panel"><div class="sound-settings"><div class="sound-settings-info"><b>🎵 Sound effects</b><p class="muted">Cute taps, card flips, answer chimes, and streak celebrations.</p></div><button type="button" class="sound-settings-switch" data-sound-toggle onclick="toggleSound()" aria-pressed="${s.sound}" aria-label="${s.sound?"Mute sound effects":"Turn on sound effects"}">${s.sound?"🔊 Sounds on":"🔇 Sounds off"}</button></div><div style="margin-top:16px"><label for="soundVolume">Volume · <span id="volumeDisplay">${Math.round((s.volume??.42)*100)}%</span></label><input type="range" id="soundVolume" min="0" max="100" value="${Math.round((s.volume??.42)*100)}" oninput="setVolume(this.value)" aria-label="Sound effects volume" style="width:100%;accent-color:var(--pink);margin-top:11px"></div><button type="button" class="sound-preview" onclick="playSound('streak')">▶ Preview celebration sound</button></div><div class="panel"><b>Brionna's photo</b><img src="${PHOTO}" style="width:100%;max-height:280px;object-fit:contain;background:#f8eaf0;border-radius:16px"></div><p class="footer-note">Study data stays in this browser's local storage. Export or cloud sync isn't included yet.</p>`}
else if(page==="quiz"){let q=deck[idx];h=`<div class="quiz-top"><button class="close" onclick="go('practice')" aria-label="Exit quiz">✕</button><div class="progress" style="flex:1"><i style="width:${idx/deck.length*100}%"></i></div><span class="timer-pill" id="examTimer" style="display:${mode==="mock"?"inline-block":"none"}">${mode==="mock"?Math.floor(Math.max(0,examDeadline-Date.now())/60000)+":"+String(Math.floor(Math.max(0,examDeadline-Date.now())/1000)%60).padStart(2,"0"):""}</span><b style="color:var(--pink)">♥ ${Math.max(1,5-Math.floor((idx-score)/2))}</b></div><div class="row"><span class="badge">${safe(q.cat)}</span><b class="tiny">${idx+1} / ${deck.length}</b></div>${correctRun>=2?`<div class="streak-chip ${correctRun>=5?"hot":""}">🔥 ${correctRun} correct in a row!</div>`:""}<h1 class="hello" style="margin:25px 0">${safe(q.q)}</h1>${q.opts.map((o,i)=>`<button class="choice ${chosen===i?"selected":""} ${checked&&i===q.answer?"correct":""} ${checked&&chosen===i&&i!==q.answer?"wrong":""}" ${checked?"disabled":""} onclick="pick(${i})"><span class="letter">${"ABCD"[i]}</span><span>${safe(o)}</span></button>`).join("")}${checked?`<div class="feedback ${chosen===q.answer?"":"bad"}"><strong>${chosen===q.answer?"🎉 Correct! +10 XP":"💗 Keep learning!"}</strong><p>${safe(q.why)}</p></div><button class="cta" onclick="nextQ()">${idx===deck.length-1?"See results 🎉":"Continue →"}</button>`:`<div style="height:20px"></div><button class="cta" ${chosen===null?"disabled":""} onclick="checkQ()">Check answer</button>`}`}
else if(page==="results"){h=`<div class="center" style="padding-top:35px"><div class="confetti">✨🎉💗</div><h1 class="hello" style="margin:25px 0">${mode==="mock"?"Exam simulation complete!":"You did it, "+safe(s.name)+"!"}</h1><img class="avatar" style="width:120px;height:120px" src="${PHOTO}" alt="Brionna's original photo"><div class="panel"><h2 class="title">${score} / ${deck.length} correct</h2><div class="count">+${score*10} XP</div><p class="muted">${mode==="mock"?"Practice percentage only—not an official AMT scaled score.":"Progress isn't perfection. Keep showing up!"}</p></div><button class="cta" onclick="go('learn')">Back to study path →</button><br><br><button class="cta secondary" onclick="go('progress')">See my achievements</button></div>`}
else if(page==="flash"){let q=flashDeck[flashIdx%flashDeck.length];h=`<div class="row"><button class="close" onclick="go('practice')">✕</button><span class="badge">Flashcard ${flashIdx+1} / ${flashDeck.length}</span></div><h1 class="hello">Flip & learn 🗃️</h1><div class="flip-scene" role="button" tabindex="0" aria-label="Flip flashcard" onclick="flipCard()" onkeydown="if(event.key==='Enter'||event.key===' '){event.preventDefault();flipCard()}"><div id="flipInner" class="flip-inner ${flipped?"is-flipped":""}"><div class="flip-face"><small>QUESTION · TAP TO FLIP</small><strong>${safe(q.q)}</strong></div><div class="flip-face flip-back"><small>ANSWER</small><strong>${safe(q.opts[q.answer])}</strong><p>${safe(q.why)}</p></div></div></div><div style="height:24px"></div><button class="cta" onclick="playSound('next');flashIdx=(flashIdx+1)%flashDeck.length;flipped=false;draw()">Next card →</button>`}
root.innerHTML=h;document.getElementById("navHost").innerHTML=["home","learn","practice","progress","settings"].includes(page)?nav():"";}
function saveSetup(){s.name=document.getElementById("nm").value.trim()||"Brionna";s.exam=document.getElementById("exam").value;s.date=document.getElementById("date").value;s.onboard=true;persist();go("home")}
function shuffled(a){let b=[...a];for(let i=b.length-1;i>0;i--){let j=Math.floor(Math.random()*(i+1));[b[i],b[j]]=[b[j],b[i]]}return b}
function takeFresh(pool,count,key){
 let prior=visited[key]||[];let eligible=pool.filter(q=>!prior.includes(q.id));
 if(eligible.length<count){prior=[];eligible=pool.slice()}
 let selected=shuffled(eligible).slice(0,count);
 visited[key]=[...prior,...selected.map(q=>q.id)].slice(-Math.max(0,pool.length-count));s.visited=visited;persist();return selected;
}
function begin(arr,m,c=""){
 if(!arr.length){alert("No missed questions yet. Great work!");return}
 let count=m==="mock"?210:m==="lesson"?15:10;
 if(m==="mock"){
  const blueprint=[['Anatomy & Physiology',44],['Administrative Medical Assisting',56],['Clinical Procedural Tasks',39],['Clinical Patient Interaction',71]];
  deck=shuffled(blueprint.flatMap(([area,n])=>takeFresh(QS.filter(q=>q.cat===area),n,'mock:'+area)));
 }else deck=takeFresh(arr,Math.min(count,arr.length),m+':'+c);
 idx=0;chosen=null;checked=false;score=0;correctRun=0;mode=m;cat=c;
 if(timerHandle)clearInterval(timerHandle);
 examDeadline=m==="mock"?Date.now()+120*60*1000:0;
 go("quiz");if(examDeadline)timerHandle=setInterval(()=>{if(page!=="quiz"){clearInterval(timerHandle);return}let el=document.getElementById('examTimer');if(el){let secs=Math.max(0,Math.ceil((examDeadline-Date.now())/1000));el.textContent=Math.floor(secs/60)+':'+String(secs%60).padStart(2,'0');el.classList.toggle('low',secs<600);if(secs<=0){clearInterval(timerHandle);finishQuiz()}}},500);
}
function lesson(i){begin(QS.filter(q=>q.cat===CATS[i]),"lesson",CATS[i])}
function mixed(){begin(QS,"mixed")}
function review(){begin(QS.filter(q=>s.missed.includes(q.id)),"review")}
function mock(){begin(QS,"mock")}
function flipCard(){playSound("flip");flipped=!flipped;document.getElementById("flipInner").classList.toggle("is-flipped",flipped)}
function flashStart(){flashDeck=takeFresh(QS,Math.min(30,QS.length),"flash");flashIdx=0;flipped=false;go("flash")}
function pick(i){if(!checked){if(chosen!==i)playSound("select");chosen=i;draw()}}
function celebrate(run){if(run<2)return;let el=document.createElement('div');el.id='celebration';el.textContent=run>=10?'👑 '+run+' IN A ROW!':run>=5?'🔥 '+run+' ANSWER STREAK!':'✨ '+run+' IN A ROW!';document.getElementById('celebration')?.remove();document.body.appendChild(el);el.addEventListener('animationend',()=>el.remove());}
function checkQ(){if(chosen===null)return;checked=true;let q=deck[idx],n=q.id;if(chosen===q.answer){score++;correctRun++;s.xp+=10;s.missed=s.missed.filter(x=>x!==n);playSound(correctRun>=10&&correctRun%5===0?"mega":correctRun>=3&&(correctRun===3||correctRun%5===0)?"streak":"correct");celebrate(correctRun)}else{correctRun=0;playSound("wrong");if(!s.missed.includes(n))s.missed.push(n)}persist();draw()}
function finishQuiz(){clearInterval(timerHandle);if(mode==="lesson")s.done[cat]=(s.done[cat]||0)+1;let today=datekey(),y=new Date();y.setDate(y.getDate()-1);if(s.lastDay!==today){s.streak=s.lastDay===datekey(y)?s.streak+1:1;s.lastDay=today}persist();go("results")}
function nextQ(){if(idx+1<deck.length){playSound("next");idx++;chosen=null;checked=false;draw();window.scrollTo(0,0)}else finishQuiz()}

draw();