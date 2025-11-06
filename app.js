// Entry point
// Theme
const THEME_KEY="dj_theme";
function setTheme(t){ document.documentElement.setAttribute("data-theme", t); localStorage.setItem(THEME_KEY, t); }
function inferTheme(){ const prefersDark = window.matchMedia && window.matchMedia("(prefers-color-scheme: dark)").matches; if(prefersDark) return "night"; const h=new Date().getHours(); return (h>=7&&h<=18)?"day":"night"; }
setTheme(localStorage.getItem(THEME_KEY) || inferTheme());
qs("theme-toggle").onclick = ()=>{ const cur=document.documentElement.getAttribute("data-theme")||"day"; setTheme(cur==="night"?"day":"night"); };
qs("theme-day").onclick=()=>setTheme("day");
qs("theme-night").onclick=()=>setTheme("night");

// Tabs
qs("tab-home").onclick = ()=> show("view-home");
qs("tab-new").onclick = ()=> show("view-new");
qs("tab-settings").onclick = ()=> show("view-settings");
qs("cancel-new").onclick = ()=> show("view-home");

// DB open
let idb;
DB.open().then(db=>{ idb=db; refresh(); });

// Autosave draft
(function autosave(){
  const key="dj_draft";
  const form=qs("new-form");
  const fields=["title","tags","text","screen","caffeine","meal","workout","stress","lucid"];
  // load draft
  try{
    const d = JSON.parse(localStorage.getItem(key)||"{}");
    fields.forEach(f=>{ if(d[f]!=null){ const el=qs(f); if(el.type==="checkbox") el.checked=!!d[f]; else el.value=d[f]; } });
  }catch{}
  form.addEventListener("input", ()=>{
    const d={};
    fields.forEach(f=>{ const el=qs(f); d[f] = (el.type==="checkbox") ? el.checked : el.value; });
    localStorage.setItem(key, JSON.stringify(d));
  });
  // clear on submit from below
})();

// New entry submit
qs("new-form").onsubmit = async (e)=>{
  e.preventDefault();
  const title=qs("title").value.trim()||"Untitled";
  const text =qs("text").value.trim();
  const tags =qs("tags").value.trim();
  const screen = parseInt(qs("screen").value||"0",10);
  const caffeine = parseInt(qs("caffeine").value||"0",10);
  const meal = parseInt(qs("meal").value||"0",10);
  const workout = parseInt(qs("workout").value||"0",10);
  const stress = parseInt(qs("stress").value||"3",10);
  const lucid = qs("lucid").checked;

  const sent = sentiment(text);
  const emo  = emotionPrimary(text);
  const ni   = nightmareIndex(text, sent);

  const entry = { dt: fmtDateISO(), title, text, tags, sentiment: sent, emotion_primary: emo, nightmare_index: ni,
    caffeine_mg: caffeine, last_meal_min_before_sleep: meal, screen_min_last_hr: screen, workout_min: workout, stress_1_5: stress, lucid };

  await DB.add(idb, entry);
  localStorage.removeItem("dj_draft");
  qs("new-form").reset();
  await refresh();
  show("view-home");
  toast("Saved");
  setTimeout(()=>confetti(),50);
};

// Render list and detail
async function refresh(){
  const list = await DB.getAll(idb);
  renderList(list);
  drawChart(qs("chart"), list);
}
function renderList(list){
  const cards=qs("cards"), empty=qs("empty");
  cards.innerHTML = list.map(e=>`<li class="card" data-id="${e.id}">
    <h3>${escapeHtml(e.title)}</h3>
    <p class="muted">${e.dt}</p>
    <p>Nightmare index: <strong>${e.nightmare_index}</strong>  |  Sentiment: ${fmt2(e.sentiment)}  |  Emotion: ${e.emotion_primary}</p>
    ${tagChips(e.tags)}
  </li>`).join("");
  empty.style.display = list.length? "none":"block";
  [...cards.querySelectorAll(".card")].forEach(li=> li.onclick = ()=> openDetail(list.find(x=> x.id==li.dataset.id)));
}
function openDetail(e){
  const dlg=qs("detail");
  qs("d-title").textContent=e.title;
  qs("d-dt").textContent=e.dt;
  qs("d-text").innerHTML=md(e.text);
  qs("d-tags").innerHTML=tagChips(e.tags);
  qs("d-sent").textContent=fmt2(e.sentiment);
  qs("d-emotion").textContent=e.emotion_primary;
  qs("d-ni").textContent=e.nightmare_index;
  qs("d-screen").textContent=e.screen_min_last_hr;
  qs("d-caff").textContent=e.caffeine_mg;
  qs("d-meal").textContent=e.last_meal_min_before_sleep;
  qs("d-work").textContent=e.workout_min;
  qs("d-stress").textContent=e.stress_1_5;
  qs("d-lucid").textContent=e.lucid? "yes":"no";
  const recs=[];
  if(e.nightmare_index>=60 && e.screen_min_last_hr>=30) recs.push("Use grayscale and blue light filter 45 minutes before bed");
  if(e.emotion_primary==="fear") recs.push("Two minute box breathing before sleep");
  if(e.sentiment<=-0.3) recs.push("Write three lines about tomorrow's biggest worry, then close notebook");
  if(recs.length===0) recs.push("Keep routine steady tonight");
  qs("d-recs").innerHTML = recs.map(r=> `<li>${escapeHtml(r)}</li>`).join("");
  dlg.showModal();
  qs("close-detail").onclick = ()=> dlg.close();
  dlg.addEventListener("click", ev=>{ if(ev.target===dlg) dlg.close(); }, { once:true });
}

// Search
qs("search-form").onsubmit = async (e)=>{
  e.preventDefault();
  const q = qs("q").value.toLowerCase();
  const tags = (qs("tag").value || "").toLowerCase().split(/[,\s]+/).filter(Boolean);
  const mode = qs("mode").value;
  const list = await DB.getAll(idb);
  const filtered = list.filter(r=>{
    const hitQ = q? (r.title.toLowerCase().includes(q) || r.text.toLowerCase().includes(q)) : true;
    const rs = (r.tags||"").toLowerCase();
    const hitT = tags.length? (mode==="AND" ? tags.every(t=> rs.includes(t)) : tags.some(t=> rs.includes(t))) : true;
    return hitQ && hitT;
  });
  renderList(filtered);
};
qs("clear-search").onclick = async ()=>{ qs("q").value=""; qs("tag").value=""; await refresh(); };

// Export CSV
qs("export").onclick = async ()=>{
  const all = await DB.getAll(idb);
  const headers=["id","dt","title","text","sentiment","emotion_primary","nightmare_index","tags","lucid","caffeine_mg","last_meal_min_before_sleep","screen_min_last_hr","workout_min","stress_1_5"];
  const rows=[headers.join(",")];
  all.forEach((e,i)=>{
    const row=[i+1,e.dt,qq(e.title),qq(e.text),e.sentiment.toFixed(3),e.emotion_primary,e.nightmare_index,qq(e.tags||""),e.lucid?1:0,e.caffeine_mg,e.last_meal_min_before_sleep,e.screen_min_last_hr,e.workout_min,e.stress_1_5].join(",");
    rows.push(row);
  });
  const blob=new Blob([rows.join("\n")],{type:"text/csv"});
  const a=document.createElement("a"); a.href=URL.createObjectURL(blob); a.download="dreams_export.csv"; a.click();
};
function qq(s){ return `"${(s||"").replace(/"/g,'""')}"`; }

// Settings
qs("enc-enabled").checked = ENC.enabled();
qs("enc-save").onclick = async ()=>{
  const pass = qs("enc-pass").value;
  if(!pass){ alert("Enter a passphrase"); return; }
  await ENC.enable(pass);
  alert("Encryption enabled, use Export JSON to create encrypted backup");
};
qs("wipe").onclick = async ()=>{
  if(confirm("Wipe ALL local entries on this device?")){ await DB.clearAll(idb); await refresh(); alert("All entries removed"); }
};
qs("export-json").onclick = async ()=>{
  const all = await DB.getAll(idb);
  const obj = { exported_at: new Date().toISOString(), entries: all };
  let text = JSON.stringify(obj);
  if(ENC.enabled()){
    const pass = prompt("Enter encryption passphrase to encrypt export"); if(!pass) return;
    text = await ENC.encryptJSON(pass, obj);
  }
  const blob = new Blob([text], {type:"application/json"});
  const a = document.createElement("a"); a.href=URL.createObjectURL(blob); a.download="dreams_export.json"; a.click();
};
qs("import-json").onchange = async (ev)=>{
  const file = ev.target.files[0]; if(!file) return;
  const text = await file.text();
  let obj;
  try{
    if(text.startsWith("__enc__:")){
      const pass = prompt("Enter passphrase to decrypt"); if(!pass) return;
      obj = await ENC.decryptJSON(pass, text);
    } else {
      obj = JSON.parse(text);
    }
  }catch(e){
    alert("Could not import file");
    return;
  }
  if(!Array.isArray(obj.entries)){ alert("Invalid file format"); return; }
  for(const e of obj.entries){ await DB.add(idb, e); }
  await refresh();
  alert("Import completed");
};

// PWA toggle
qs("pwa-apply").onclick = ()=>{
  const on = qs("pwa-on").checked;
  if(on){
    if("serviceWorker" in navigator){
      navigator.serviceWorker.register("service-worker.js?v=1").then(()=> alert("Service worker registered"));
    }
  } else {
    if("serviceWorker" in navigator){
      navigator.serviceWorker.getRegistrations().then(list=>{
        list.forEach(r=> r.unregister());
        alert("Service workers unregistered");
      });
    }
  }
};

// Chart resize
addEventListener("resize", ()=>{
  const c = qs("chart");
  c.width = c.clientWidth * devicePixelRatio;
  c.height = 220 * devicePixelRatio;
  DB.getAll(idb).then(list=> drawChart(c, list));
});
addEventListener("load", ()=>{
  const c = qs("chart");
  c.width = c.clientWidth * devicePixelRatio;
  c.height = 220 * devicePixelRatio;
});


function toast(msg){
  const t=qs("toast"); if(!t) return;
  t.textContent=msg;
  t.style.opacity=1; t.style.transform="translateY(0)";
  clearTimeout(t.__to); t.__to = setTimeout(()=>{ t.style.opacity=0; t.style.transform="translateY(8px)"; }, 1800);
}

document.addEventListener("input", e=>{
  if(e.target && e.target.matches("textarea")){
    e.target.style.height = "auto";
    e.target.style.height = e.target.scrollHeight + "px";
  }
});

addEventListener("keydown", e=>{
  const tag = (e.target && e.target.tagName) ? e.target.tagName.toLowerCase() : "";
  if(tag==="input" || tag==="textarea") return;
  if(e.key==="n"){ show("view-new"); }
  if(e.key==="e"){ show("view-home"); }
  if(e.key==="/"){ e.preventDefault(); const qEl=qs("q"); if(qEl){ qEl.focus(); } }
  if(e.key.toLowerCase()==="u" && window.__lastDeleted){
    DB.add(idb, window.__lastDeleted).then(()=>{ window.__lastDeleted=null; refresh(); toast("Restored"); });
  }
});

const __mdbar = qs("md-bar");
if(__mdbar){
  __mdbar.addEventListener("click", e=>{
    const btn = e.target.closest("[data-md]"); if(!btn) return;
    const ta = qs("text"); if(!ta) return;
    const ins = btn.dataset.md;
    const start = ta.selectionStart, end = ta.selectionEnd;
    ta.setRangeText(ins, start, end, "end");
    ta.dispatchEvent(new Event("input"));
    ta.focus();
  });
}

function confetti(x=window.innerWidth-40,y=window.innerHeight-40){
  const n=18;
  for(let i=0;i<n;i++){
    const p=document.createElement("i");
    Object.assign(p.style,{
      position:"fixed",left:x+"px",top:y+"px",width:"6px",height:"6px",
      background:`hsl(${Math.random()*360},80%,60%)`,borderRadius:"2px",
      transform:`translate(${(Math.random()*2-1)*120}px,${-Math.random()*220}px)`,
      opacity:0,transition:"transform .8s ease, opacity .8s ease",zIndex:10000
    });
    document.body.appendChild(p);
    requestAnimationFrame(()=>{
      p.style.opacity=1;
      p.style.transform=`translate(${(Math.random()*2-1)*120}px,${(Math.random()*-1)*260}px)`;
      setTimeout(()=>p.remove(),820);
    });
  }
}
