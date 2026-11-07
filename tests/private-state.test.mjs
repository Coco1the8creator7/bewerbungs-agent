import test from 'node:test';
import assert from 'node:assert/strict';
import vm from 'node:vm';
import {readFileSync} from 'node:fs';
const publicSource=readFileSync(new URL('../dashboard/github-sync.js',import.meta.url),'utf8');
const source=readFileSync(new URL('../dashboard/private-state.js',import.meta.url),'utf8');
function harness(replies=[]){
 const calls=[],window={CareerAccount:{id:'synthetic-user'},AgentStore:{}};
 vm.runInNewContext(source,{window,location:{pathname:'/app/'},document:{addEventListener(){}},
  structuredClone,Map,Promise,Object,JSON,Error,
  fetch:async(url,options)=>{calls.push({url,...options});const result=replies.shift();if(result instanceof Error)throw result;
   return {ok:!result?.error,status:result?.error||200,json:async()=>result||{data:null,revision:0}};}});
 return {window,calls};
}
test('public landing never reads a token or shared feedback, and rejects personal writes',async()=>{
 const window={};
 vm.runInNewContext(publicSource,{window,Error,localStorage:{getItem(){throw Error('must not read')}}});
 assert.equal(await window.GithubFeedback.loadPublic(),null);
 await assert.rejects(window.GithubFeedback.save({}),/anmelden/);
 assert.equal(window.GithubFeedback.getToken(),'');
});
test('private persistence sends session credentials and a revision, never GitHub authorization',async()=>{
 const h=harness([{data:{x:1},revision:7},{data:{x:2},revision:8}]);
 await h.window.AgentStore.loadRadar();await h.window.AgentStore.saveRadar({x:2});
 assert.equal(h.calls[1].url,'/api/user/state/radar');assert.equal(h.calls[1].credentials,'same-origin');
 assert.deepEqual(JSON.parse(h.calls[1].body),{revision:7,data:{x:2}});
 assert.equal(h.calls[1].headers.Authorization,undefined);assert.equal(h.window.GithubFeedback.getToken(),'');
});
test('conflict fails visibly and never advances an unacknowledged revision',async()=>{
 const h=harness([{data:{},revision:1},{error:409,detail:'changed elsewhere'},{error:409,detail:'changed elsewhere'}]);
 await h.window.AgentStore.loadRadar();
 await assert.rejects(h.window.AgentStore.saveRadar({x:1}),/changed elsewhere/);
 await assert.rejects(h.window.AgentStore.saveRadar({x:2}),/changed elsewhere/);
 assert.equal(JSON.parse(h.calls[2].body).revision,1);
});
test('concurrent edits are serialized and retain their values and revisions',async()=>{
 const h=harness([{data:null,revision:0},{data:{x:1},revision:1},{data:{x:2},revision:2}]);
 await Promise.all([h.window.AgentStore.saveRadar({x:1}),h.window.AgentStore.saveRadar({x:2})]);
 assert.deepEqual(h.calls.filter(c=>c.method==='PUT').map(c=>JSON.parse(c.body)),[
  {revision:0,data:{x:1}},{revision:1,data:{x:2}}]);
});
test('expired sessions reject saving without falling back to shared data',async()=>{
 const h=harness([{error:401}]);await assert.rejects(h.window.AgentStore.load(),/Sitzung/);
 assert.equal(h.calls.length,1);
});
