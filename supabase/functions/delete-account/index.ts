// Deploy only as a Supabase Edge Function; service_role remains server-side.
// Account deletion requires a validated user JWT AND an AAL2 (TOTP) session.
import {createClient} from 'npm:@supabase/supabase-js@2.105.0';
const allowed = (Deno.env.get('ALLOWED_ORIGINS')||'https://coco1the8creator7.github.io')
  .split(',').map(s=>s.trim()).filter(Boolean);
function response(status:number,body:Record<string,unknown>,origin:string|null){
  const headers:Record<string,string>={
    'Content-Type':'application/json','Cache-Control':'no-store',
    'Vary':'Origin','Access-Control-Allow-Headers':'authorization, x-client-info, apikey, content-type',
    'Access-Control-Allow-Methods':'POST, OPTIONS'
  };
  if(origin && allowed.includes(origin))headers['Access-Control-Allow-Origin']=origin;
  return new Response(JSON.stringify(body),{status,headers});
}
Deno.serve(async req=>{
  const origin=req.headers.get('Origin');
  if(origin && !allowed.includes(origin))return response(403,{error:'Ursprung nicht zugelassen'},origin);
  if(req.method==='OPTIONS')return response(204,{},origin);
  if(req.method!=='POST')return response(405,{error:'Methode nicht zugelassen'},origin);
  if(!(req.headers.get('content-type')||'').includes('application/json'))
    return response(415,{error:'JSON erwartet'},origin);
  const token=req.headers.get('Authorization')?.match(/^Bearer\s+(.+)$/i)?.[1];
  if(!token)return response(401,{error:'Anmeldung erforderlich'},origin);
  const url=Deno.env.get('SUPABASE_URL'),anon=Deno.env.get('SUPABASE_ANON_KEY');
  const secret=Deno.env.get('SUPABASE_SERVICE_ROLE_KEY');
  if(!url||!anon||!secret)return response(503,{error:'Dienst nicht eingerichtet'},origin);
  try{
    const auth=createClient(url,anon,{auth:{persistSession:false,autoRefreshToken:false}});
    // getUser validates the bearer token with the Auth server; never trust a caller-supplied user_id.
    const {data:{user},error}=await auth.auth.getUser(token);
    if(error||!user?.id||!user.email||!user.email_confirmed_at)
      return response(401,{error:'Ungültige oder unbestätigte Sitzung'},origin);
    // Claims are inspected ONLY after the exact JWT has been validated above.
    const claims=JSON.parse(atob(token.split('.')[1].replace(/-/g,'+').replace(/_/g,'/')));
    if(claims.sub!==user.id||claims.aal!=='aal2')
      return response(403,{error:'Bestätigte Zwei-Faktor-Anmeldung erforderlich'},origin);
    const input=await req.json();
    if(input?.confirmation!=='DELETE'||input?.email_confirmation?.toLowerCase()!==user.email.toLowerCase())
      return response(400,{error:'Kontolöschung nicht bestätigt'},origin);
    const admin=createClient(url,secret,{auth:{persistSession:false,autoRefreshToken:false}});
    const deleted=await admin.auth.admin.deleteUser(user.id,false);
    if(deleted.error)throw deleted.error;
    // ON DELETE CASCADE removes profile and snapshots. Existing JWTs expire separately.
    return response(200,{deleted:true},origin);
  }catch{
    // Avoid returning database or authentication internals to the caller.
    return response(500,{error:'Kontolöschung konnte nicht abgeschlossen werden'},origin);
  }
});
