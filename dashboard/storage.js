"use strict";
/* Explicit opt-in, device-bound storage for a public static GitHub Pages dashboard.
 * Never sends data to GitHub or another server; no automatic cross-device sync.
 */
(function () {
  const DB_NAME = "bewerbungs-agent-local-v1";
  const STORE = "snapshots";
  const KEY = "current";
  const LAST_VISIT_KEY = "last-dashboard-visit"; // Only an ISO timestamp; not job or applicant data.
  let opening = null;

  function connect() {
    if (!("indexedDB" in window)) return Promise.reject(new Error("IndexedDB wird von diesem Browser nicht unterstützt."));
    if (!opening) {
      opening = new Promise((resolve, reject) => {
        const request = window.indexedDB.open(DB_NAME, 1);
        request.onupgradeneeded = () => {
          const db = request.result;
          if (!db.objectStoreNames.contains(STORE)) db.createObjectStore(STORE);
        };
        request.onsuccess = () => resolve(request.result);
        request.onerror = () => reject(request.error || new Error("Lokale Datenbank konnte nicht geöffnet werden."));
        request.onblocked = () => reject(new Error("Lokale Datenbank ist durch einen anderen Tab blockiert."));
      }).catch(err => { opening = null; throw err; });
    }
    return opening;
  }

  async function operation(mode, makeRequest) {
    const db = await connect();
    return new Promise((resolve, reject) => {
      let settled = false, value;
      const tx = db.transaction(STORE, mode);
      const request = makeRequest(tx.objectStore(STORE));
      request.onsuccess = () => { value = request.result; };
      tx.oncomplete = () => { if (!settled) { settled = true; resolve(value); } };
      tx.onabort = tx.onerror = () => {
        if (!settled) { settled = true; reject(tx.error || request.error || new Error("Lokale Speicherung fehlgeschlagen.")); }
      };
    });
  }

  window.AgentStore = Object.freeze({
    load: () => operation("readonly", store => store.get(KEY)),
    save: snapshot => operation("readwrite", store => store.put(snapshot, KEY)),
    // Anonymous UI timestamp used solely to compare new job imports across visits.
    loadLastVisit: () => operation("readonly", store => store.get(LAST_VISIT_KEY)),
    recordVisit: timestamp => {
      if (typeof timestamp !== "string" || !Number.isFinite(Date.parse(timestamp))) {
        return Promise.reject(new Error("Ungültiger Besuchszeitpunkt."));
      }
      return operation("readwrite", store => store.put(timestamp, LAST_VISIT_KEY));
    },
    // Opting out of device persistence also deletes the separately stored visit timestamp.
    clear: async () => {
      await operation("readwrite", store => store.delete(KEY));
      await operation("readwrite", store => store.delete(LAST_VISIT_KEY));
    },
  });
})();
