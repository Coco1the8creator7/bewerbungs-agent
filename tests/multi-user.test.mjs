import {test} from 'node:test';
import assert from 'node:assert/strict';
import {createPrivateStore,validateSnapshot} from '../dashboard/account-core.mjs';
const A='11111111-1111-4111-8111-111111111111', B='22222222-2222-4222-8222-222222222222';
const feedback=(score)=>({type:'bewerbungs-agent-feedback',schema_version:'1.0.0',
  updated_at:'2026-10-24T00:00:00Z',annotations:[],relevance_ratings:[{id:'job-example',score}],
  activity_log:[],overrides:[],manual_jobs:[],export_selection:[]});
function fakeClient() {
  let current=A;const profiles=new Map(),snapshots=new Map();
  const client={auth:{async getUser(){return {data:{user:{id:current,email:current+'@example.test'}},error:null};}},
    from(table) {
      const map=table==='career_profiles'?profiles:snapshots;
      const makeKey=value=>table==='career_profiles'?value.user_id:value.user_id+'|'+value.kind;
      const query={constraints:[],updates:null,
        eq(key,v){this.constraints.push([key,v]);return this;},
        select(){return this;},
        filtered(){return [...map.values()].filter(x=>this.constraints.every(([k,v])=>x[k]===v)&&x.user_id===current);},
        async maybeSingle(){
          const row=this.filtered()[0]??null;
          if(this.updates && row){Object.assign(row,this.updates);map.set(makeKey(row),row);}
          return {data:row,error:null};
        },
        then(resolve,reject){return Promise.resolve({data:this.filtered(),error:null}).then(resolve,reject);},
        async upsert(value){if(value.user_id!==current)return {data:null,error:Error('RLS denied')};
          map.set(makeKey(value),{...value});return {data:null,error:null};},
        async insert(value){if(value.user_id!==current)return {data:null,error:Error('RLS denied')};
          const key=makeKey(value);if(map.has(key))return {data:null,error:{code:'23505'}};
          map.set(key,{...value});return {data:null,error:null};},
        update(values){this.updates=values;return this;}
      };return query;
    }};return {client,login(id){current=id;},profiles,snapshots};
}
test('two accounts cannot accidentally share private feedback or profile',async()=>{
 const x=fakeClient(),store=createPrivateStore(x.client);
 await store.saveSnapshot('feedback',feedback(12));
 await store.saveProfile('Testkonto A');
 x.login(B);
 assert.equal(await store.loadSnapshot('feedback'),null);
 assert.equal(await store.loadProfile(),null);
 await store.saveSnapshot('feedback',feedback(95));
 await store.saveProfile('Testkonto B');
 x.login(A);
 assert.equal((await store.loadSnapshot('feedback')).payload.relevance_ratings[0].score,12);
 assert.equal((await store.loadProfile()).display_name,'Testkonto A');
 x.login(B);
 assert.equal((await store.loadSnapshot('feedback')).payload.relevance_ratings[0].score,95);
 assert.equal((await store.exportData()).snapshots.length,1);
});
test('stale device cannot silently overwrite another device',async()=>{
 const x=fakeClient(),store=createPrivateStore(x.client);
 await store.saveSnapshot('feedback',feedback(10));
 const previous=await store.loadSnapshot('feedback');
 assert.equal(previous.revision,1);
 assert.equal(await store.saveSnapshot('feedback',feedback(40),previous.revision),2);
 await assert.rejects(()=>store.saveSnapshot('feedback',feedback(20),previous.revision),/anderen Gerät/);
 assert.equal((await store.loadSnapshot('feedback')).payload.relevance_ratings[0].score,40);
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
