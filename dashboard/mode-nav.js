/* Career.Agency: shared navigation only. Individual mode UIs live elsewhere. */
(function(){
 "use strict";
 const modes=new Set(["startseite","radar","dossiers","agency","profil","einstellungen"]);
 const menu=document.getElementById("modeSidebar");
 const toggle=document.getElementById("openModeSidebar");
 const close=document.getElementById("closeModeSidebar");
 const backdrop=document.getElementById("modeNavBackdrop");
 const links=[...document.querySelectorAll(".mode-nav-link[data-mode]")];
 const pages=[...document.querySelectorAll("[data-mode-page]")];
 if(!menu||!toggle||!close||!backdrop||pages.length!==modes.size||links.length!==modes.size)return;

 const modeFromHash=()=>{
  const candidate=window.location.hash.slice(1).toLowerCase();
  return modes.has(candidate)?candidate:"startseite";
 };
 function setMenuOpen(open){
  menu.classList.toggle("is-open",open);
  menu.inert=!open;
  menu.setAttribute("aria-hidden",String(!open));
  toggle.setAttribute("aria-expanded",String(open));
  toggle.setAttribute("aria-label",open?"Menü schliessen":"Menü öffnen");
  backdrop.hidden=!open;
  document.body.classList.toggle("mode-menu-open",open);
  if(open)close.focus();
  else toggle.focus({preventScroll:true});
 }
 function showMode(mode,scrollToTop=true){
  const selected=modes.has(mode)?mode:"startseite";
  document.body.dataset.activeMode=selected;
  for(const page of pages)page.hidden=page.dataset.modePage!==selected;
  for(const link of links){
   if(link.dataset.mode===selected)link.setAttribute("aria-current","page");
   else link.removeAttribute("aria-current");
  }
  const label=links.find(link=>link.dataset.mode===selected)?.textContent?.trim()||"Startseite";
  document.title=selected==="startseite"?"Career.Agency":label+" · Career.Agency";
  if(scrollToTop)window.scrollTo(0,0);
  // Existing floating-save behaviour only applies to the CRM start page.
  window.dispatchEvent(new Event("scroll"));
 }
 toggle.addEventListener("click",()=>setMenuOpen(!menu.classList.contains("is-open")));
 close.addEventListener("click",()=>setMenuOpen(false));
 backdrop.addEventListener("click",()=>setMenuOpen(false));
 menu.addEventListener("keydown",event=>{
  if(event.key!=="Tab"||!menu.classList.contains("is-open"))return;
  const focusable=[close,...links];
  const first=focusable[0],last=focusable[focusable.length-1];
  if(event.shiftKey&&document.activeElement===first){event.preventDefault();last.focus();}
  else if(!event.shiftKey&&document.activeElement===last){event.preventDefault();first.focus();}
 });
 document.addEventListener("keydown",event=>{
  if(event.key==="Escape"&&menu.classList.contains("is-open")){
   event.preventDefault();setMenuOpen(false);
  }
 });
 for(const link of links){
  link.addEventListener("click",()=>{
   setMenuOpen(false);
   if(window.location.hash==="#"+link.dataset.mode)showMode(link.dataset.mode);
  });
 }
 window.addEventListener("hashchange",()=>showMode(modeFromHash()));
 document.getElementById("modeLaunchAgency")?.addEventListener("click",()=>{
  document.getElementById("openAgency")?.click();
 });
 showMode(modeFromHash(),false);
})();
