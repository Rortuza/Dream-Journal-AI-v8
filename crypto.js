// Optional client-side encryption using Web Crypto (AES-GCM)
const ENC = (()=>{
  const STORE_KEY = "dj_enc"; // keeps salt + iv and enabled flag

  async function hash(text){
    const enc = new TextEncoder().encode(text);
    const buf = await crypto.subtle.digest("SHA-256", enc);
    return buf;
  }

  function b64(buf){ return btoa(String.fromCharCode(...new Uint8Array(buf))); }
  function ub64(s){ return Uint8Array.from(atob(s), c=>c.charCodeAt(0)); }

  async function deriveKey(pass, salt){
    const keyMaterial = await crypto.subtle.importKey("raw", new TextEncoder().encode(pass), {name:"PBKDF2"}, false, ["deriveKey"]);
    return crypto.subtle.deriveKey(
      {name:"PBKDF2", salt, iterations: 120000, hash: "SHA-256"},
      keyMaterial,
      {name:"AES-GCM", length:256},
      false,
      ["encrypt","decrypt"]
    );
  }

  function state(){
    try { return JSON.parse(localStorage.getItem(STORE_KEY) || "{}"); }
    catch { return {}; }
  }
  function saveState(obj){ localStorage.setItem(STORE_KEY, JSON.stringify(obj)); }

  async function enable(passphrase){
    const salt = crypto.getRandomValues(new Uint8Array(16));
    const iv   = crypto.getRandomValues(new Uint8Array(12));
    const s = state();
    s.enabled = true;
    s.salt = b64(salt);
    s.iv   = b64(iv);
    s.tag  = b64(await hash("dj")); // marker
    saveState(s);
    // verify key can be derived
    await deriveKey(passphrase, salt);
  }

  function disable(){
    const s = state();
    s.enabled = false;
    saveState(s);
  }

  function enabled(){
    return !!state().enabled;
  }

  async function encryptJSON(passphrase, obj){
    const s = state(); if(!s.enabled) return JSON.stringify(obj);
    const salt = ub64(s.salt); const iv = ub64(s.iv);
    const key = await deriveKey(passphrase, salt);
    const data = new TextEncoder().encode(JSON.stringify(obj));
    const ct = await crypto.subtle.encrypt({name:"AES-GCM", iv}, key, data);
    return "__enc__:" + b64(ct);
  }

  async function decryptJSON(passphrase, text){
    if(typeof text === "object") return text;
    if(!text.startsWith("__enc__:")) return JSON.parse(text);
    const s = state();
    const salt = ub64(s.salt); const iv = ub64(s.iv);
    const key = await deriveKey(passphrase, salt);
    const raw = ub64(text.slice(8));
    const pt = await crypto.subtle.decrypt({name:"AES-GCM", iv}, key, raw);
    return JSON.parse(new TextDecoder().decode(pt));
  }

  return { enable, disable, enabled, encryptJSON, decryptJSON, state };
})();
