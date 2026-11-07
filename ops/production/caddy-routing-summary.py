"""Read-only routing inventory. Never output credentials, header values or bodies."""
import json,re,subprocess
from pathlib import Path

def summarize(config):
 def match(value):
  if not isinstance(value,dict):return {}
  result={}
  for key in ('host','path'):
   if key in value:result[key]=value[key]
  if 'not' in value:result['not']=[match(x) for x in value['not']]
  if set(value)-{'host','path','not'}:result['other_matchers']=sorted(set(value)-{'host','path','not'})
  return result
 def routes(items,depth=0):
  if depth>12:return [{'truncated':True}]
  output=[]
  for route in items[:100]:
   item={}
   if route.get('match'):item['match']=[match(x) for x in route['match']]
   if 'group' in route:item['group']=route['group']
   if 'terminal' in route:item['terminal']=route['terminal']
   handlers=[]
   for handler in route.get('handle',[]):
    h={'handler':handler.get('handler','unknown')}
    if handler.get('handler')=='subroute':h['routes']=routes(handler.get('routes',[]),depth+1)
    if handler.get('handler')=='static_response':h['status_code']=handler.get('status_code')
    if handler.get('handler')=='rewrite':h['rewrites_uri']='uri' in handler
    handlers.append(h)
   item['handle']=handlers;output.append(item)
  return output
 servers=config.get('apps',{}).get('http',{}).get('servers',{})
 return {'http_servers':[{'routes':routes(server.get('routes',[]))} for server in servers.values()]}
def main():
 result=subprocess.run(['caddy','adapt','--config','/etc/caddy/Caddyfile','--adapter','caddyfile'],capture_output=True,text=True,timeout=15)
 if result.returncode or len(result.stdout)>2_000_000:raise SystemExit('caddy_routing_summary=unavailable')
 print('caddy_routing_summary='+json.dumps(summarize(json.loads(result.stdout)),separators=(',',':')))
 # Directive types/line numbers only, never Caddyfile arguments or credential blocks.
 directives=[]
 for number,line in enumerate(Path('/etc/caddy/Caddyfile').read_text().splitlines(),1):
  found=re.match(r'^\s*(rewrite|try_files|uri|method|redir|forward_auth|basic_auth)\s',line)
  if found:directives.append({'line':number,'directive':found.group(1)})
 print('caddy_review_directives='+json.dumps(directives,separators=(',',':')))
if __name__=='__main__':main()
