"use strict";
const assert = require("node:assert/strict");
const vm = require("node:vm");
const fs = require("node:fs");

const data = new Map();
let created = false;
const db = {
  objectStoreNames: {contains: () => created},
  createObjectStore: () => {created=true;},
  transaction: () => {
    const tx = {oncomplete:null,onabort:null,onerror:null,error:null};
    tx.objectStore=()=>({
      get(key){return queue(()=>data.get(key));},
      put(value,key){return queue(()=>{data.set(key,value);return key;});},
      delete(key){return queue(()=>{data.delete(key);return undefined;});}
    });
    function queue(callback){
      const request = {onsuccess:null,result:null,error:null};
      setImmediate(()=>{
        try{request.result=callback();request.onsuccess?.();tx.oncomplete?.();}
        catch(e){tx.error=e;tx.onerror?.();}
      });
      return request;
    }
    return tx;
  }
};
const win = {
  indexedDB:{
    open(){
      const request={result:db,onupgradeneeded:null,onsuccess:null,onerror:null,onblocked:null};
      setImmediate(()=>{if(!created)request.onupgradeneeded?.();request.onsuccess?.();});
      return request;
    }
  }
};
vm.runInNewContext(fs.readFileSync("dashboard/storage.js","utf8"),{window:win,Promise,Error,Object});
(async()=>{
  assert.equal(await win.AgentStore.load(),undefined,"starts empty");
  const original={jobs:[{id:"test"}],annotations:[{decision:"review"}]};
  await win.AgentStore.save(original);
  assert.deepEqual(await win.AgentStore.load(),original,"restores both jobs and annotations");
  assert.equal(await win.AgentStore.loadLastVisit(),undefined,"no visit timestamp initially");
  const timestamp="2026-10-23T10:15:00.000Z";
  await win.AgentStore.recordVisit(timestamp);
  assert.equal(await win.AgentStore.loadLastVisit(),timestamp,"visit timestamp persists independently");
  assert.deepEqual(await win.AgentStore.load(),original,"visit timestamp does not overwrite private workspace");
  await assert.rejects(()=>win.AgentStore.recordVisit("invalid-date"),/Ungültiger/);
  await win.AgentStore.clear();
  assert.equal(await win.AgentStore.load(),undefined,"deletion removes the saved state");
  assert.equal(await win.AgentStore.loadLastVisit(),undefined,"deletion removes visit timestamp");
  const noDb={};
  vm.runInNewContext(fs.readFileSync("dashboard/storage.js","utf8"),{window:noDb,Promise,Error,Object});
  await assert.rejects(()=>noDb.AgentStore.load(),/nicht unterstützt/);
  console.log("IndexedDB adapter contract checks passed");
})().catch(error=>{console.error(error);process.exitCode=1;});
