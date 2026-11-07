// Isolated synthetic users and HTTPS test server. No real SMTP or production writes.
const {chromium}=require('playwright');
const assert=require('node:assert/strict');
(async()=>{
 const browser=await chromium.launch({headless:true});
 const context=await browser.newContext({ignoreHTTPSErrors:true});const page=await context.newPage();
 const errors=[];page.on('pageerror',e=>errors.push(e.message));
 await page.route(/fonts\.(googleapis|gstatic)\.com/,r=>r.abort());
 async function login(email){
  await page.goto('https://localhost:8443/account/login');
  await page.locator('#email').fill(email);await page.locator('#password').fill('synthetic test password');
  await Promise.all([page.waitForURL('**/app/'),page.getByRole('button',{name:'Anmelden',exact:true}).click()]);
  await page.waitForFunction(()=>window.CareerFeedbackReady&&window.CareerRadarReady&&window.CareerFilterSync&&!document.getElementById("radarSyncFeedback").disabled);
  await page.waitForFunction(()=>document.querySelectorAll('#newJobsList article').length===1);
 }
 await login('e2e-a@example.com');
 assert.equal(await page.locator('script[src*="dossiers.js"]').count(),0);
 await page.evaluate(()=>window.AgentCareerFeedback.setScore('apprenticeship-synthetic-e2e',83));
 await page.evaluate(()=>window.CareerFilterSync.sync());
 let state=await page.evaluate(()=>fetch('/api/user/state/feedback').then(r=>r.json()));
 assert.equal(state.data.relevance_ratings[0].score,83);
 await page.reload();
 await page.waitForFunction(()=>window.CareerFeedbackReady&&window.CareerRadarReady&&window.CareerFilterSync&&!document.getElementById("radarSyncFeedback").disabled);
 await page.waitForFunction(()=>window.AgentCareerFeedback.getScore('apprenticeship-synthetic-e2e')===83);
 await page.getByRole('button',{name:'Abmelden',exact:true}).click();await page.waitForURL('**/account/login');
 await login('e2e-b@example.com');
 assert.equal(await page.evaluate(()=>window.AgentCareerFeedback.getScore('apprenticeship-synthetic-e2e')),null);
 state=await page.evaluate(()=>fetch('/api/user/state/feedback').then(r=>r.json()));
 assert.equal(state.data,null);
 assert.deepEqual(errors,[]);
 console.log('HTTPS browser: login, private app, rating sync, reload, logout and second-account isolation passed');
 await browser.close();
})().catch(e=>{console.error(e);process.exit(1)});
