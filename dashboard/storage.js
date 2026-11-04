"use strict";
/* Device-bound storage for a public static GitHub Pages dashboard.
 * Full CRM workspace storage remains opt-in. Only the user's deliberate
 * swipe / restore decisions are persisted by default as minimal job-ID signals.
 * Nothing is automatically sent to GitHub or synced across devices.
 */
(function () {
  const DB_NAME = "bewerbungs-agent-local-v1";
  const STORE = "snapshots";
  const KEY = "current";
  const SWIPE_PREFS_KEY = "landing-swipe-preferences-v1"; // Only job IDs and swipe decisions; independent of opt-in workspace storage.
  const FILTER_SYNC_KEY = "filter-ki-sync-v1"; // Durable unsent ratings and confirmed IDs.
  const RADAR_KEY = "radar-prototype-v1"; // Private, opt-in and isolated from legacy CRM/feedback.
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
    loadSwipePrefs: () => operation("readonly", store => store.get(SWIPE_PREFS_KEY)),
    saveSwipePrefs: value => operation("readwrite", store => store.put(value, SWIPE_PREFS_KEY)),
    loadFilterSync: () => operation("readonly", store => store.get(FILTER_SYNC_KEY)),
    saveFilterSync: value => operation("readwrite", store => store.put(value, FILTER_SYNC_KEY)),
    loadRadar: () => operation("readonly", store => store.get(RADAR_KEY)),
    saveRadar: value => operation("readwrite", store => store.put(value, RADAR_KEY)),
    clearRadar: () => operation("readwrite", store => store.delete(RADAR_KEY)),
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
      await operation("readwrite", store => store.delete(RADAR_KEY));
    },
  });
})();
