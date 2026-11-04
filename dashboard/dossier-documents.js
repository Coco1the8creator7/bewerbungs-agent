/* Career.Agency: local, job-linked application drafts and offline exports.
 * No AI, external services or unverified personal statements.
 * Browser global and CommonJS for deterministic regression tests.
 */
(function(root){
"use strict";
const LABELS={cv:"Lebenslauf",letter:"Motivationsschreiben",email:"Bewerbungsmail"};
const BASE_STYLE={theme:"modern",accent:"#955d72",font:"sans",fontScale:100,spacing:"normal"};
function clean(value,max=250){return String(value??"").trim().slice(0,max);}
function section(id,label,text){return {id,label,text,visible:true};}
function createDraft(job){
 const title=clean(job?.title)||"[Stellenbezeichnung prüfen]";
 const company=clean(job?.company)||"[Unternehmen ergänzen]";
 return {
  version:1,activeDoc:"cv",
  enabled:{cv:true,letter:true,email:true},
  baseStyle:{...BASE_STYLE},sources:{cv:null,letter:null},
  docs:{
   cv:{type:"cv",data:{name:"[Vorname Nachname]",role:title,contact:"[Adresse · E-Mail · Telefon]",photoData:""},
    sections:[
     {id:"photo",label:"Bewerbungsfoto",text:"",visible:false},
     section("profile","Kurzprofil","[Beschreibe kurz deine tatsächlichen Stärken und deinen Bezug zur Stelle.]"),
     section("experience","Berufserfahrung","[Berufserfahrung mit Zeitraum, Funktion und Aufgaben ergänzen.]"),
     section("education","Ausbildung","[Ausbildung und Abschlüsse mit Daten ergänzen.]"),
     section("skills","Fähigkeiten","[Nachweisbare Fähigkeiten ergänzen.]")
    ],individualStyle:null},
   letter:{type:"letter",data:{name:"[Vorname Nachname]",contact:"[Adresse · E-Mail · Telefon]",
     title:"Bewerbung als "+title,greeting:"Guten Tag"},
    sections:[
     section("opening","Einstieg","Ich bewerbe mich für die Stelle als "+title+" bei "+company+"."),
     section("motivation","Motivation","[Erkläre, warum dich genau diese Stelle und dieses Unternehmen interessieren.]"),
     section("strengths","Stärken","[Nenne passende Erfahrungen und Stärken anhand deiner tatsächlichen Kenntnisse.]"),
     section("closing","Abschluss","Über die Einladung zu einem Gespräch freue ich mich.\n\nFreundliche Grüsse\n[Vorname Nachname]")
    ],individualStyle:null},
   email:{type:"email",data:{recipient:"[E-Mail-Adresse des Unternehmens]",
     subject:"Bewerbung als "+title,
     body:"Guten Tag\n\nIm Anhang sende ich Ihnen meine Bewerbung für die Stelle als "+title+" bei "+company+". Ich freue mich über eine Rückmeldung.\n\nFreundliche Grüsse\n[Vorname Nachname]"},
     sections:[],individualStyle:null}
  }
 };
}
function linesFor(state,type){
 const d=state.docs[type];if(!d)throw Error("Dokument fehlt: "+type);
 const result=[];
 const add=(text,kind)=>{for(const line of String(text||"").split(/\r?\n/))result.push({text:line,kind});};
 if(type==="cv"){
  add(d.data.name||"","name");add(d.data.role||"","subtitle");add(d.data.contact||"","normal");
  result.push({text:"",kind:"normal"});
  for(const s of d.sections||[])if(s.visible&&s.id!=="photo"){add(s.label,"heading");add(s.text,"normal");result.push({text:"",kind:"normal"})}
 }else if(type==="letter"){
  add(d.data.name,"name");add(d.data.contact,"normal");result.push({text:"",kind:"normal"});
  add(d.data.title,"heading");add(d.data.greeting,"normal");result.push({text:"",kind:"normal"});
  for(const s of d.sections||[])if(s.visible){add(s.text,"normal");result.push({text:"",kind:"normal"})}
 }else{
  add("An: "+d.data.recipient,"normal");add("Betreff: "+d.data.subject,"heading");
  result.push({text:"",kind:"normal"});add(d.data.body,"normal");
 }
 return result;
}
function safeText(s){return String(s??"").replace(/[•]/g,"-").replace(/[–—]/g,"-").replace(/[‘’]/g,"'").replace(/[“”]/g,'"').replace(/[…]/g,"...").replace(/[\u0000-\u0008\u000B-\u001F]/g,"");}
function pdfLiteral(s){return "("+safeText(s).replace(/\\/g,"\\\\").replace(/\(/g,"\\(").replace(/\)/g,"\\)")+")";}
function charBytes(s){const a=[];for(const c of String(s)){let n=c.codePointAt(0);if(n>255){n=63;}a.push(n);}return Uint8Array.from(a);}
function concat(chunks){let n=0;for(const a of chunks)n+=a.length;const out=new Uint8Array(n);let p=0;for(const a of chunks){out.set(a,p);p+=a.length;}return out;}
function jpegInfo(src){
 if(!/^data:image\/jpeg;base64,/i.test(src||""))return null;
 const payload=src.split(",")[1];let bytes;
 if(typeof atob==="function"){const raw=atob(payload);bytes=Uint8Array.from(raw,c=>c.charCodeAt(0));}
 else if(typeof Buffer!=="undefined")bytes=new Uint8Array(Buffer.from(payload,"base64"));
 else return null;
 if(bytes[0]!==255||bytes[1]!==216)return null;
 for(let p=2;p<bytes.length-10;){
  if(bytes[p]!==255){p++;continue;}
  const marker=bytes[p+1];if(marker===255){p++;continue;}
  if(marker===216||marker===217){p+=2;continue;}
  const len=(bytes[p+2]<<8)|bytes[p+3];
  if(len<2||p+len+2>bytes.length)break;
  if([192,193,194,195,198,199,201,202].includes(marker)){
   const h=(bytes[p+5]<<8)|bytes[p+6],w=(bytes[p+7]<<8)|bytes[p+8],components=bytes[p+9];
   return w>0&&h>0&&components===3?{bytes,w,h}:null;
  }
  p+=len+2;
 }
 return null;
}
function pdfBytes(state,type){
 const base=state.baseStyle||BASE_STYLE;
 const style=state.docs[type]?.individualStyle||base;
 const scale=Math.max(.8,Math.min(1.3,Number(style.fontScale||100)/100));
 const photo=type==="cv"&&(state.docs.cv.sections||[]).some(s=>s.id==="photo"&&s.visible)?jpegInfo(state.docs.cv.data.photoData):null;
 const items=linesFor(state,type),commands=[],pages=[];
 let y=786;
 function newPage(){pages.push([]);y=786;}
 function draw(str,fontSize,bold=false,color="0.20 0.19 0.20",x=49){
  let text=safeText(str);
  let cmd=color+" rg\nBT /"+(bold?"F2":"F1")+" "+fontSize.toFixed(1)+" Tf 1 0 0 1 "+x+" "+y.toFixed(1)+" Tm "+pdfLiteral(text)+" Tj ET\n";
  pages[pages.length-1].push(cmd);
 }
 newPage();
 if(photo){pages[0].push("q 84 0 0 105 462 664 cm /P1 Do Q\n");}
 for(const item of items){
  const kind=item.kind;
  const f=(kind==="name"?19:kind==="heading"?12:kind==="subtitle"?11:10)*scale;
  const step=(kind==="name"?29:kind==="heading"?21:15)*scale;
  const maxChars=(kind==="name"?31:kind==="heading"?70:86)/scale;
  const words=safeText(item.text).split(/\s+/).filter(Boolean);
  const wrapped=[];
  if(!words.length)wrapped.push("");
  else{let current="";for(const word of words){if(current&&(current+" "+word).length>maxChars){wrapped.push(current);current=word;}else current=current?current+" "+word:word;}if(current)wrapped.push(current);}
  for(let line of wrapped){
   if(y<58){newPage();}
   draw(line,f,kind==="name"||kind==="heading",kind==="heading"?"0.52 0.30 0.40":"0.18 0.19 0.20");
   y-=step;
  }
 }
 const objects=[null,
  "<< /Type /Catalog /Pages 2 0 R >>",
  "", "<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica /Encoding /WinAnsiEncoding >>",
  "<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica-Bold /Encoding /WinAnsiEncoding >>"];
 let imageId=0;
 if(photo){imageId=objects.length;objects.push({prefix:"<< /Type /XObject /Subtype /Image /Width "+photo.w+" /Height "+photo.h+" /ColorSpace /DeviceRGB /BitsPerComponent 8 /Filter /DCTDecode /Length "+photo.bytes.length+" >>\nstream\n",bytes:photo.bytes,suffix:"\nendstream"});}
 const refs=[];
 for(const cmds of pages){
  const pageId=objects.length, streamId=pageId+1;
  refs.push(pageId+" 0 R");
  objects.push("<< /Type /Page /Parent 2 0 R /MediaBox [0 0 595 842] /Resources << /Font << /F1 3 0 R /F2 4 0 R >>"+(photo?" /XObject << /P1 "+imageId+" 0 R >>":"")+" >> /Contents "+streamId+" 0 R >>");
  const text=cmds.join("");
  objects.push("<< /Length "+charBytes(text).length+" >>\nstream\n"+text+"endstream");
 }
 objects[2]="<< /Type /Pages /Kids ["+refs.join(" ")+"] /Count "+refs.length+" >>";
 const chunks=[charBytes("%PDF-1.4\n%âãÏÓ\n")],offsets=[0];
 let offset=chunks[0].length;
 const add=a=>{chunks.push(a);offset+=a.length;};
 for(let i=1;i<objects.length;i++){
  offsets[i]=offset;add(charBytes(i+" 0 obj\n"));
  const ob=objects[i];
  if(typeof ob==="string")add(charBytes(ob));
  else{add(charBytes(ob.prefix));add(ob.bytes);add(charBytes(ob.suffix));}
  add(charBytes("\nendobj\n"));
 }
 const xref=offset;
 add(charBytes("xref\n0 "+objects.length+"\n0000000000 65535 f \n"));
 for(let i=1;i<objects.length;i++)add(charBytes(String(offsets[i]).padStart(10,"0")+" 00000 n \n"));
 add(charBytes("trailer\n<< /Size "+objects.length+" /Root 1 0 R >>\nstartxref\n"+xref+"\n%%EOF\n"));
 return concat(chunks);
}
const crcTable=Array.from({length:256},(_,n)=>{let c=n;for(let k=0;k<8;k++)c=c&1?0xEDB88320^(c>>>1):c>>>1;return c>>>0;});
function crc32(bytes){let c=0xFFFFFFFF;for(const byte of bytes)c=crcTable[(c^byte)&255]^(c>>>8);return (c^0xFFFFFFFF)>>>0;}
function zipBytes(files){
 const out=[],cent=[];let offset=0;
 const u16=v=>[v&255,(v>>>8)&255],u32=v=>[v&255,(v>>>8)&255,(v>>>16)&255,(v>>>24)&255];
 function add(block){const a=Uint8Array.from(block);out.push(a);offset+=a.length;}
 for(const file of files){
  const name=new TextEncoder().encode(file.name),data=file.data,crc=crc32(data),localOffset=offset;
  add([...u32(0x04034b50),...u16(20),...u16(0),...u16(0),...u16(0),...u16(0),...u32(crc),...u32(data.length),...u32(data.length),...u16(name.length),...u16(0)]);
  add(name);add(data);
  cent.push({name,crc,size:data.length,localOffset});
 }
 const centralOffset=offset;
 for(const x of cent){
  add([...u32(0x02014b50),...u16(20),...u16(20),...u16(0),...u16(0),...u16(0),...u16(0),...u32(x.crc),...u32(x.size),...u32(x.size),...u16(x.name.length),...u16(0),...u16(0),...u16(0),...u16(0),...u32(0),...u32(x.localOffset)]);
  add(x.name);
 }
 const centralSize=offset-centralOffset;
 add([...u32(0x06054b50),...u16(0),...u16(0),...u16(cent.length),...u16(cent.length),...u32(centralSize),...u32(centralOffset),...u16(0)]);
 return concat(out);
}
function bundleBytes(state){return zipBytes([
 {name:"Lebenslauf.pdf",data:pdfBytes(state,"cv")},
 {name:"Motivationsschreiben.pdf",data:pdfBytes(state,"letter")},
 {name:"Bewerbungsmail.pdf",data:pdfBytes(state,"email")}
]);}
function downloadBlob(blob,name){
 if(!root.document||!root.URL)throw Error("Browser-Download nicht verfügbar.");
 const url=root.URL.createObjectURL(blob),a=root.document.createElement("a");
 a.href=url;a.download=name;root.document.body.appendChild(a);a.click();a.remove();
 root.setTimeout(()=>root.URL.revokeObjectURL(url),60000);
}
function download(state,jobTitle){
 const filename="Dossier-"+(clean(jobTitle,70).normalize("NFKD").replace(/[\u0300-\u036f]/g,"").replace(/[^a-zA-Z0-9_-]+/g,"-").replace(/^-|-$/g,"")||"Bewerbung")+".zip";
 downloadBlob(new Blob([bundleBytes(state)],{type:"application/zip"}),filename);
}
const api=Object.freeze({createDraft,pdfBytes,bundleBytes,download});
if(typeof module!=="undefined"&&module.exports)module.exports=api;
root.CareerDossierDocuments=api;
})(typeof window!=="undefined"?window:globalThis);
