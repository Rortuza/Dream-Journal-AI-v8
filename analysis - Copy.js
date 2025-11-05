// Sentiment, emotion, nightmare, markdown
const AFINN = {
  "amazing":3,"awesome":4,"beautiful":3,"calm":2,"comfort":2,"cozy":2,"dreamy":2,"excited":3,"gentle":2,"happy":3,"hope":2,"joy":3,"love":3,"peace":2,"safe":2,"serene":3,"sweet":2,"warm":2,
  "afraid":-3,"alone":-2,"angry":-3,"anxious":-2,"anxiety":-2,"ashamed":-2,"attack":-2,"bleed":-3,"chase":-2,"cry":-2,"dead":-3,"death":-3,"die":-3,"doom":-3,"falling":-2,"fear":-3,"fight":-2,"guilt":-2,"hate":-3,"monster":-3,"nightmare":-3,"panic":-3,"sad":-2,"scream":-2,"stress":-2,"terrified":-4,"worry":-2
};
const NEGATIONS = new Set(["not","no","never","without","hardly","barely","scarcely"]);
const BOOSTERS  = {"very":1.5,"really":1.3,"so":1.2,"extremely":1.8,"super":1.4,"quite":1.2};

function tokenize(t){ return (t.toLowerCase().match(/[a-z']{2,}/g) || []); }

function sentiment(text){
  const words = tokenize(text);
  if(!words.length) return 0;
  let score = 0;
  for(let i=0;i<words.length;i++){
    const w = words[i];
    let val = AFINN[w] || 0;
    let neg = 1, boost = 1;
    for(let k=1;k<=3 && i-k>=0;k++){
      const prev = words[i-k];
      if(NEGATIONS.has(prev)) neg *= -1;
      if(BOOSTERS[prev]) boost *= BOOSTERS[prev];
    }
    score += val * neg * boost;
  }
  const scaled = score / Math.sqrt(words.length);
  return Math.max(-1, Math.min(1, scaled / 5));
}

const EMO_LEX = {
  joy: ["joy","happy","love","beautiful","serene","peace","calm","warm","cozy"],
  fear: ["fear","afraid","terrified","panic","monster","chase","doom","nightmare"],
  sadness: ["sad","cry","alone","guilt","ashamed","worry","death","die"],
  anger: ["angry","fight","hate","attack","scream","stress"]
};

function emotionPrimary(text){
  const t = text.toLowerCase();
  const counts = {joy:0,fear:0,sadness:0,anger:0};
  for(const k in EMO_LEX){
    for(const w of EMO_LEX[k]) counts[k] += (t.split(w).length - 1);
  }
  let best="neutral", max=0;
  for(const k in counts){ if(counts[k]>max){ max=counts[k]; best=k; } }
  return best;
}

function nightmareIndex(text, sent){
  const t = text.toLowerCase();
  const fearHits = (t.match(/fear|afraid|terrified|panic|monster|chase|doom|nightmare|die|death|scream/g) || []).length;
  const exclam = (t.match(/!/g) || []).length;
  const negSent = Math.max(0, -sent);
  const raw = 35*negSent + 8*fearHits + 4*exclam;
  return Math.max(0, Math.min(100, Math.round(raw)));
}

function fmt2(x){ const v=Number(x); return Math.abs(v)<0.005 && v!==0 ? (v>0?"0.01":"-0.01") : v.toFixed(2); }

// Tiny Markdown renderer (safe subset)
function md(s){
  if(!s) return "";
  let t = s.replace(/[&<>"']/g, m => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[m]));
  t = t.replace(/^### (.*)$/gm, "<h3>$1</h3>");
  t = t.replace(/^## (.*)$/gm, "<h2>$1</h2>");
  t = t.replace(/^# (.*)$/gm, "<h1>$1</h1>");
  t = t.replace(/\*\*(.+?)\*\*/g, "<strong>$1</strong>");
  t = t.replace(/\*(.+?)\*/g, "<em>$1</em>");
  // simple lists
  t = t.replace(/(^|\n)\- (.*)(?=\n|$)/g, "$1<li>$2</li>");
  t = t.replace(/(<li>.*<\/li>)/gs, "<ul>$1</ul>");
  // paragraphs
  t = t.replace(/\n\n+/g, "</p><p>");
  t = "<p>" + t + "</p>";
  return t;
}

// Chart: simple bar chart without libraries
function drawChart(canvas, entries){
  if(!canvas) return;
  const ctx = canvas.getContext("2d");
  ctx.clearRect(0,0,canvas.width,canvas.height);
  const data = entries.slice().reverse().slice(-30); // last 30 entries
  if(!data.length){ return; }
  const w = canvas.width, h = canvas.height;
  const pad = 24;
  ctx.fillStyle = "rgba(0,0,0,0.05)";
  ctx.fillRect(0,0,w,h);
  // axes
  ctx.strokeStyle = "rgba(0,0,0,0.2)";
  ctx.beginPath(); ctx.moveTo(pad, pad); ctx.lineTo(pad, h-pad); ctx.lineTo(w-pad, h-pad); ctx.stroke();
  const max = 100;
  const barW = (w - pad*2) / data.length - 4;
  data.forEach((e,i)=>{
    const x = pad + i*(barW+4) + 2;
    const y = h - pad;
    const bh = (e.nightmare_index / max) * (h - pad*2);
    ctx.fillStyle = "rgba(162,181,247,0.9)";
    ctx.fillRect(x, y - bh, barW, bh);
  });
}
