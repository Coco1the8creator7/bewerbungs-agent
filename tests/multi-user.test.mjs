import {test} from 'node:test';
import assert from 'node:assert/strict';
import {createPrivateStore,validateSnapshot} from '../dashboard/account-core.mjs';
const A='11111111-1111-4111-8111-111111111111', B='22222222-2222-4222-8222-222222222222';
const feedback=(score)=>({type:'bewerbungs-agent-feedback',schema_version:'1.0.0',
  updated_at:'2026-10-24T00:00:00Z',annotations:[],relevance_ratings:[{id:'job-example',score}],
  activity_log:[],overrides:[],manual_jobs:[],export_selection:[]});
function fakeClient() {
  let current=A;const profiles=new Map(),snapshots=new Map();
  const client={auth:{async getUser(){return {data:{user:{id:current}},error:null};}},
    from(table) {
      const map=table==='career_profiles'?profiles:snapshots;
      const query={constraints:[],payload:null,eq(key,v){this.constraints.push([key,v]);return this;},
        select(){return this;},async maybeSingle(){const rows=[...map.values()].filter(x=>this.constraints.every(([k,v])=>x[k]===v));
          return {data:rows[0]??null,error:null};},
        then(resolve,reject){return Promise.resolve({data:[...map.values()].filter(x=>this.constraints.every(([k,v])=>x[k]===v)),error:null}).then(resolve,reject);},
        upsert(value){if(value.user_id!==current)return Promise.resolve({data:null,error:Error('RLS denied')});
          const key=table==='career_profiles'?value.user_id:value.user_id+'|'+value.kind;
          map.set(key,{...value});return Promise.resolve({data:null,error:null});}
      };return query;
    }};return {client,login(id){current=id;},profiles,snapshots};
}
test('two independent accounts cannot accidentally share stored feedback',async()=>{
 const x=fakeClient(),store=createPrivateStore(x.client);
 await store.saveSnapshot('feedback',feedback(12));
 await store.saveProfile('Testkonto A');
 x.login(B);
 assert.equal(await store.loadSnapshot('feedback'),null);
 assert.equal(await store.loadProfile(),null);
 await store.saveSnapshot('feedback',feedback(95));
 await store.saveProfile('Testkonto B');
 x.login(A);
 assert.equal((await store.loadSnapshot('feedback')).relevance_ratings[0].score,12);
 assert.equal((await store.loadProfile()).display_name,'Testkonto A');
 x.login(B);
 assert.equal((await store.loadSnapshot('feedback')).relevance_ratings[0].score,95);
 assert.equal((await store.exportData()).snapshots.length,1);
});
test('invalid/oversize legacy input cannot be saved',()=>{
 assert.throws(()=>validateSnapshot('feedback',{type:'bad'}),/Inkompatibles/);
 assert.throws(()=>validateSnapshot('other',{}),/Unbekannter/);
 assert.throws(()=>validateSnapshot('feedback',{...feedback(10),note:'a'.repeat(10*1024*1024)}),/gross/);
});
test('signed out users cannot write',async()=>{
 const x=fakeClient();x.client.auth.getUser=async()=>({data:{user:null},error:null});
 await assert.rejects(()=>createPrivateStore(x.client).saveSnapshot('feedback',feedback(10)),/anmelden/);
});
