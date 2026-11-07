"use strict";
/* Public landing: personal data is available exclusively through authenticated APIs.
 * No GitHub credential is read, stored, or sent. Historical browser data is untouched.
 * /app/ installs the private account adapter before application initialization.
 */
(function(){
 const blocked=()=>{throw Error("Bitte anmelden, um persönliche Daten im Konto zu speichern.");};
 window.GithubFeedback=Object.freeze({isConnected:()=>false,getToken:()=>"",setToken:blocked,
  clearToken:()=>{},loadPublic:async()=>null,loadFilterRatings:async()=>null,
  save:async()=>blocked(),saveFilterRatings:async()=>blocked()});
 if(typeof document!=="undefined")document.addEventListener("DOMContentLoaded",()=>{
  // Necessary account access only; existing navigation/layout and modes stay intact.
  document.getElementById("githubToken")?.closest(".persist-panel")?.setAttribute("hidden","");
  const host=document.querySelector(".mode-nav-secondary");
  if(!host)return;
  const nav=document.createElement("nav");nav.setAttribute("aria-label","Kontozugang");
  if(window.CareerAccount){
   const logout=document.createElement("button");logout.type="button";logout.className="secondary";logout.textContent="Abmelden";
   logout.onclick=async()=>{logout.disabled=true;try{
    const response=await fetch("/api/auth/logout",{method:"POST",credentials:"same-origin",headers:{"Content-Type":"application/json"},body:"{}"});
    if(!response.ok)throw Error("Abmelden fehlgeschlagen");location.href="/account/login";
   }catch(error){logout.disabled=false;logout.textContent=error.message;}};
   nav.append(logout);
  }else{
   for(const [text,path] of [["Anmelden","/account/login"],["Registrieren","/account/register"]]){
    const link=document.createElement("a");link.textContent=text;link.href=path;nav.append(link,document.createTextNode(" "));
   }
  }
  host.append(nav);
 });
})();
