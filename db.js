// IndexedDB wrapper with schema versioning and migrations
const DB = (()=>{
  const NAME = "dreams_pro_plus_db";
  const VER  = 2; // bump when schema changes

  async function open(){
    return new Promise((resolve, reject)=>{
      const req = indexedDB.open(NAME, VER);
      req.onupgradeneeded = (e)=>{
        const db = e.target.result;
        if(e.oldVersion < 1){
          const store = db.createObjectStore("entries", { keyPath: "id", autoIncrement: true });
          store.createIndex("dt", "dt");
        }
        if(e.oldVersion < 2){
          // migration example: nothing to add right now, but hook kept for growth
        }
      };
      req.onsuccess = (e)=> resolve(e.target.result);
      req.onerror   = (e)=> reject(e);
    });
  }

  async function add(db, entry){
    return new Promise((resolve, reject)=>{
      const tx = db.transaction("entries", "readwrite");
      tx.objectStore("entries").add(entry).onsuccess = ()=> resolve();
      tx.onerror = (e)=> reject(e);
    });
  }

  async function getAll(db){
    return new Promise((resolve, reject)=>{
      const tx = db.transaction("entries", "readonly");
      const req = tx.objectStore("entries").getAll();
      req.onsuccess = ()=> resolve(req.result.sort((a,b)=> b.dt.localeCompare(a.dt)));
      req.onerror   = (e)=> reject(e);
    });
  }

  async function update(db, entry){
    return new Promise((resolve, reject)=>{
      const tx = db.transaction('entries','readwrite');
      tx.objectStore('entries').put(entry).onsuccess = ()=> resolve();
      tx.onerror = (e)=> reject(e);
    });
  }

  async function remove(db, id){
    return new Promise((resolve, reject)=>{
      const tx = db.transaction('entries','readwrite');
      tx.objectStore('entries').delete(id).onsuccess = ()=> resolve();
      tx.onerror = (e)=> reject(e);
    });
  }

  async function clearAll(db){
    return new Promise((resolve,reject)=>{
      const tx = db.transaction("entries", "readwrite");
      const req = tx.objectStore("entries").clear();
      req.onsuccess = ()=> resolve();
      req.onerror   = (e)=> reject(e);
    });
  }

  return { open, add, getAll, update, remove, clearAll };
})();
