/* Career.Agency encrypted dossier repository format (v1).
 * GitHub is PUBLIC: this module only produces AES-256-GCM ciphertext.
 * Password and non-extractable key must never be persisted.
 */
(function(root,factory){
 "use strict";
 const api=factory();
 if(typeof module==="object"&&module.exports)module.exports=api;
 else root.CareerDossierCrypto=Object.freeze(api);
})(typeof globalThis==="object"?globalThis:this,function(){
 "use strict";
 const VERSION=1,ITERATIONS=600000;
 const encoder=new TextEncoder(),decoder=new TextDecoder("utf-8",{fatal:true});
 function cryptoApi(){
  const api=globalThis.crypto;
  if(!api?.subtle||!api?.getRandomValues)throw Error("Dieser Browser unterstützt keine sichere Verschlüsselung.");
  return api;
 }
 function randomBytes(length){
  const bytes=new Uint8Array(length);cryptoApi().getRandomValues(bytes);return bytes;
 }
 function toBase64(bytes){
  if(!(bytes instanceof Uint8Array))bytes=new Uint8Array(bytes);
  let result="";
  for(let i=0;i<bytes.length;i+=8192)result+=String.fromCharCode(...bytes.subarray(i,i+8192));
  return btoa(result);
 }
 function fromBase64(s){
  if(typeof s!=="string"||!/^[A-Za-z0-9+/]*={0,2}$/.test(s)||s.length%4)throw Error("Ungültige Kodierung der Sicherung.");
  return Uint8Array.from(atob(s),character=>character.charCodeAt(0));
 }
 async function deriveKey(password,salt){
  if(typeof password!=="string"||password.length<16)throw Error("Ein eigenes Kennwort mit mindestens 16 Zeichen ist erforderlich.");
  if(!(salt instanceof Uint8Array)||salt.length!==16)throw Error("Ungültiges Schlüsselsalz.");
  const crypto=cryptoApi();
  const material=await crypto.subtle.importKey("raw",encoder.encode(password),"PBKDF2",false,["deriveKey"]);
  return crypto.subtle.deriveKey({name:"PBKDF2",salt,iterations:ITERATIONS,hash:"SHA-256"},material,{name:"AES-GCM",length:256},false,["encrypt","decrypt"]);
 }
 async function encrypt(key,bytes,context){
  if(typeof context!=="string"||!context)throw Error("Verschlüsselungskontext fehlt.");
  const iv=randomBytes(12);
  const encrypted=await cryptoApi().subtle.encrypt({name:"AES-GCM",iv,additionalData:encoder.encode(context),tagLength:128},key,bytes);
  return {v:VERSION,iv:toBase64(iv),ct:toBase64(new Uint8Array(encrypted))};
 }
 async function decrypt(key,envelope,context){
  if(!envelope||envelope.v!==VERSION||typeof envelope.ct!=="string")throw Error("Unbekanntes Format der verschlüsselten Daten.");
  const iv=fromBase64(envelope.iv),bytes=fromBase64(envelope.ct);
  if(iv.length!==12)throw Error("Ungültiger Initialisierungsvektor.");
  try{
   const data=await cryptoApi().subtle.decrypt({name:"AES-GCM",iv,additionalData:encoder.encode(context),tagLength:128},key,bytes);
   return new Uint8Array(data);
  }catch{throw Error("Entschlüsselung fehlgeschlagen: Kennwort falsch oder Sicherung verändert.");}
 }
 function encodeJson(value){return encoder.encode(JSON.stringify(value));}
 function decodeJson(bytes){return JSON.parse(decoder.decode(bytes));}
 function manifestContext(){return "Career.Agency/e2ee/dossiers/v1/manifest";}
 function fileContext(id){
  if(typeof id!=="string"||!/^[a-zA-Z0-9_-]{1,100}$/.test(id))throw Error("Ungültige Datei-ID.");
  return "Career.Agency/e2ee/dossiers/v1/file/"+id;
 }
 return Object.freeze({VERSION,ITERATIONS,randomBytes,toBase64,fromBase64,deriveKey,encrypt,decrypt,encodeJson,decodeJson,manifestContext,fileContext});
});
