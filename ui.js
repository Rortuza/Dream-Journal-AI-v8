// UI helpers shared by app.js
function qs(id){ return document.getElementById(id); }
function show(which){
  const views = ["view-home","view-new","view-edit","view-settings"];
  views.forEach(v=> qs(v).classList.toggle("hidden", v!==which));
  if(which==="view-new"){ qs("title").focus(); }
}
function tagChips(tags){
  return (tags||"").split(/[,\s]+/).map(t=>t.trim()).filter(Boolean).map(t=>`<span class="tagchip">${escapeHtml(t)}</span>`).join(" ");
}
function escapeHtml(s){ return (s||"").replace(/[&<>"']/g, m => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[m])); }
function fmtDateISO(){ return new Date().toISOString().slice(0,16); }
