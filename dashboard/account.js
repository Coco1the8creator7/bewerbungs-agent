import {createClient} from 'https://cdn.jsdelivr.net/npm/@supabase/supabase-js@2.105.0/+esm';
import {createPrivateStore,validateSnapshot} from './account-core.mjs';
const byId = id => document.getElementById(id);
const status = value => {byId('status').textContent=value;};
const config = window.CAREER_AGENCY_SUPABASE || {};
const ready = /^https:\/\/[-\w.]+\.supabase\.co$/.test(config.url||'') && /\S/.test(config.publishableKey||'');
if (!ready) {
  status('Der private Konto-Dienst ist noch nicht eingerichtet. Für die Live-Schaltung werden eine Supabase-Projekt-URL und ein öffentlicher Publishable Key benötigt. Das bisherige Dashboard bleibt nutzbar.');
} else {
  const client = createClient(config.url,config.publishableKey,{
    auth:{storage:window.sessionStorage,persistSession:true,autoRefreshToken:true,detectSessionInUrl:true,flowType:'pkce'}
  });
  const store = createPrivateStore(client);
  let pendingMfa = null;
  let activeMfaFactor = null;
  const panels=['signinPanel','recoveryPanel','mfaGate','privatePanel'];
  const show = name => panels.forEach(id=>{byId(id).hidden=id!==name;});
  async function handle(action) {
    try {status('Verarbeite …'); await action();} catch(e){status('Aktion fehlgeschlagen: '+(e.message||String(e))); }
  }
  const email=()=>byId('email').value.trim();
  const password=()=>byId('password').value;
  const requirePassword=()=>{if(password().length<12)throw Error('Mindestens 12 Zeichen verwenden.');};
  async function refresh() {
    const {data:{user},error} = await client.auth.getUser();
    if(error || !user){show('signinPanel');status('Bitte anmelden.');return;}
    const {data:aal,error:aalError}=await client.auth.mfa.getAuthenticatorAssuranceLevel();
    if(aalError)throw aalError;
    if(aal.currentLevel==='aal1' && aal.nextLevel==='aal2'){
      const {data,error:factorsError}=await client.auth.mfa.listFactors();
      if(factorsError)throw factorsError;
      activeMfaFactor=data.totp.find(f=>f.status==='verified')?.id;
      if(!activeMfaFactor)throw Error('Kein gültiger Authenticator gefunden.');
      show('mfaGate');status('Zweiter Faktor erforderlich.');return;
    }
    show('privatePanel');byId('loggedInAs').textContent=user.email||'Angemeldet';
    const profile=await store.loadProfile();
    byId('displayName').value=profile?.display_name||'';
    byId('aalStatus').textContent=aal.currentLevel==='aal2'
      ? 'Zwei-Faktor-Anmeldung aktiv (AAL2).'
      : 'Zwei-Faktor-Anmeldung noch nicht eingerichtet. Für die Kontolöschung erforderlich.';
    byId('startMfa').disabled=aal.nextLevel==='aal2';
    status('Privater Bereich bereit. Keine Daten werden ohne deine Aktion importiert.');
  }
  byId('signin').addEventListener('click',()=>handle(async()=>{
    const {error}=await client.auth.signInWithPassword({email:email(),password:password()});
    if(error)throw error;await refresh();
  }));
  byId('signup').addEventListener('click',()=>handle(async()=>{
    requirePassword();const {error}=await client.auth.signUp({email:email(),password:password(),
      options:{emailRedirectTo:location.href.split('#')[0].split('?')[0]}});
    if(error)throw error;status('Bitte Bestätigungs-E-Mail prüfen und Konto aktivieren.');
  }));
  byId('forgot').addEventListener('click',()=>handle(async()=>{
    const {error}=await client.auth.resetPasswordForEmail(email(),{
      redirectTo:location.href.split('#')[0].split('?')[0]});
    if(error)throw error;status('Falls das Konto existiert, wurde eine E-Mail zum Zurücksetzen gesendet.');
  }));
  byId('setPassword').addEventListener('click',()=>handle(async()=>{
    if(byId('newPassword').value.length<12)throw Error('Mindestens 12 Zeichen verwenden.');
    const {error}=await client.auth.updateUser({password:byId('newPassword').value});
    if(error)throw error;byId('newPassword').value='';await refresh();
  }));
  async function signout(){
    const {error}=await client.auth.signOut();if(error)throw error;
    byId('snapshotFile').value='';byId('mfaEnroll').hidden=true;await refresh();
  }
  for(const id of ['signout','signoutGate'])byId(id).addEventListener('click',()=>handle(signout));
  byId('verifySigninMfa').addEventListener('click',()=>handle(async()=>{
    const {error}=await client.auth.mfa.challengeAndVerify({
      factorId:activeMfaFactor,code:byId('mfaSigninCode').value.trim()});
    if(error)throw error;byId('mfaSigninCode').value='';await refresh();
  }));
  byId('saveProfile').addEventListener('click',()=>handle(async()=>{
    await store.saveProfile(byId('displayName').value);status('Profil gespeichert.');
  }));
  const download=(filename,obj)=>{
    const link=document.createElement('a');
    const url=URL.createObjectURL(new Blob([JSON.stringify(obj,null,2)+'\n'],{type:'application/json'}));
    link.href=url;link.download=filename;link.click();
    setTimeout(()=>URL.revokeObjectURL(url),3000);
  };
  byId('uploadSnapshot').addEventListener('click',()=>handle(async()=>{
    const kind=byId('snapshotKind').value,file=byId('snapshotFile').files[0];
    if(!file)throw Error('Zuerst eine JSON-Datei auswählen.');
    if(file.size>10*1024*1024)throw Error('Datei zu gross.');
    const payload=validateSnapshot(kind,JSON.parse(await file.text()));
    const existing=await store.loadSnapshot(kind);
    if(existing && !confirm('Vorhandene private '+kind+'-Daten wirklich ersetzen? Bitte zuerst exportieren.')){
      status('Import abgebrochen.');return;
    }
    await store.saveSnapshot(kind,payload);
    byId('snapshotFile').value='';status('Privater '+kind+'-Datensatz gespeichert.');
  }));
  byId('downloadSnapshot').addEventListener('click',()=>handle(async()=>{
    const kind=byId('snapshotKind').value;
    const data=await store.loadSnapshot(kind);
    if(!data)throw Error('Noch keine Datei dieses Typs gespeichert.');
    download('career-agency-'+kind+'.json',data);status('Private Datei exportiert.');
  }));
  byId('exportAll').addEventListener('click',()=>handle(async()=>{
    download('career-agency-konto-export.json',await store.exportData());
    status('Kontodaten exportiert. Datei privat aufbewahren.');
  }));
  byId('startMfa').addEventListener('click',()=>handle(async()=>{
    const {data,error}=await client.auth.mfa.enroll({factorType:'totp',friendlyName:'Career.Agency'});
    if(error)throw error;pendingMfa=data.id;
    // SVG remains an image; it is never injected into the DOM as executable HTML.
    byId('mfaQr').src='data:image/svg+xml;charset=utf-8,'+encodeURIComponent(data.totp.qr_code);
    byId('mfaEnroll').hidden=false;status('QR-Code mit einer Authenticator-App scannen.');
  }));
  byId('finishMfa').addEventListener('click',()=>handle(async()=>{
    if(!pendingMfa)throw Error('Zuerst MFA einrichten.');
    const {data:challenge,error:e1}=await client.auth.mfa.challenge({factorId:pendingMfa});
    if(e1)throw e1;
    const {error:e2}=await client.auth.mfa.verify({
      factorId:pendingMfa,challengeId:challenge.id,code:byId('mfaEnrollCode').value.trim()});
    if(e2)throw e2;
    pendingMfa=null;byId('mfaEnroll').hidden=true;byId('mfaQr').removeAttribute('src');
    byId('mfaEnrollCode').value='';await refresh();
  }));
  byId('deleteAccount').addEventListener('click',()=>handle(async()=>{
    const {data:{user},error:e}=await client.auth.getUser();
    if(e||!user)throw Error('Nicht angemeldet.');
    if(byId('deleteEmail').value.trim().toLowerCase()!==user.email?.toLowerCase()
      ||byId('deletePhrase').value.trim()!=='LÖSCHEN')throw Error('Bestätigung nicht korrekt.');
    const {data:aal,error:e2}=await client.auth.mfa.getAuthenticatorAssuranceLevel();
    if(e2)throw e2;
    if(aal.currentLevel!=='aal2')throw Error('Für die Kontolöschung erst MFA einrichten und bestätigen.');
    if(!confirm('Konto samt privater Daten endgültig löschen? Das kann nicht rückgängig gemacht werden.'))return;
    const {error}=await client.functions.invoke('delete-account',{
      body:{confirmation:'DELETE',email_confirmation:user.email}});
    if(error)throw error;
    await client.auth.signOut({scope:'local'});
    show('signinPanel');status('Das Konto wurde gelöscht. Lokal exportierte Dateien bleiben unverändert.');
  }));
  client.auth.onAuthStateChange((event)=>{
    if(event==='PASSWORD_RECOVERY'){show('recoveryPanel');status('Neues Passwort festlegen.');}
    else if(event==='SIGNED_IN'||event==='SIGNED_OUT'||event==='TOKEN_REFRESHED')setTimeout(()=>{
      refresh().catch(e=>status('Anmeldung konnte nicht geprüft werden: '+e.message));},0);
  });
  refresh().catch(e=>{show('signinPanel');status('Kontodienst-Fehler: '+e.message);});
}
