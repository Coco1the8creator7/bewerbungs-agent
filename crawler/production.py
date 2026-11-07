"""Bounded central-pool refresh. Source approval required before any network I/O."""
import hashlib, json, os, re, tempfile, time, uuid
from datetime import datetime, timezone, date
from pathlib import Path
from urllib.parse import urlsplit
from urllib.request import Request, build_opener, HTTPRedirectHandler
from urllib.robotparser import RobotFileParser
import psycopg
from psycopg.rows import dict_row
from psycopg.types.json import Jsonb
from .yousty_jsonld import extract_jsonld_listings
from .yousty_detail import extract_detail
from .normalization import normalize
BASE='https://www.yousty.ch'
AGENT='CareerAgencyCrawler/1.0 (+https://careeragency.ch)'
class SameOriginRedirect(HTTPRedirectHandler):
    def redirect_request(self,req,fp,code,msg,headers,newurl):
        validate_url(newurl)
        return super().redirect_request(req,fp,code,msg,headers,newurl)
def validate_url(url):
    p=urlsplit(url)
    if p.scheme!='https' or p.hostname!='www.yousty.ch' or p.port not in (None,443) or p.username or p.password:
        raise ValueError('cross_origin_url')
def read(url,limit=2_000_000):
    validate_url(url)
    with build_opener(SameOriginRedirect()).open(Request(url,headers={'User-Agent':AGENT,'Accept':'text/html,text/plain'}),timeout=20) as response:
        data=response.read(limit+1)
        if response.status!=200 or len(data)>limit: raise ValueError('invalid_response')
        return data.decode('utf-8','replace')
def config(path):
    settings=json.loads(Path(path).read_text())
    if settings.get('enabled') is not True or settings.get('reuse_approved') is not True or not settings.get('approval_reference'):
        raise PermissionError('source_not_approved')
    if settings.get('canton')!='ZH': raise ValueError('unsupported_scope')
    if not 1<=settings.get('max_pages',0)<=40 or not 1<=settings.get('max_details',0)<=500:
        raise ValueError('invalid_limits')
    return settings
class Client:
    def __init__(self,reader=read,sleeper=time.sleep):
        self.reader=reader;self.sleep=sleeper;self.calls=0
        self.policy=RobotFileParser();self.policy.parse(reader(BASE+'/robots.txt',200_000).splitlines())
    def get(self,url):
        validate_url(url)
        if not self.policy.can_fetch(AGENT,url): raise PermissionError('robots_denied')
        if self.calls:self.sleep(max(5,self.policy.crawl_delay(AGENT) or 0))
        self.calls+=1;return self.reader(url)
def discover(client,settings):
    found={};expected=None;complete=False
    for page in range(1,settings['max_pages']+1):
        data=extract_jsonld_listings(client.get(BASE+f'/de-CH/lehrstellen/ZH?locale=de-CH&page={page}&result_type=main'))
        if data['invalid_entries'] or not data['records'] or data['reported_total'] is None: raise ValueError('invalid_listing_page')
        if expected is None:expected=data['reported_total']
        if expected!=data['reported_total']: raise ValueError('listing_total_changed')
        before=len(found)
        for entry in data['records']:found[entry['source_listing_id']]=entry
        if len(found)>=expected:complete=(len(found)==expected);break
        if len(found)==before:raise ValueError('pagination_repeated')
    return list(found.values()),complete

def refresh(con,settings,client):
    run_id=uuid.uuid4()
    with con.transaction():
        con.execute('INSERT INTO career_pool.runs(id) VALUES(%s)',(run_id,))
    try:
        listings,complete=discover(client,settings)
        relevant=[j for j in listings if j['qualification_group']=='basic_efz_eba']
        if len(relevant)>settings['max_details']:complete=False
        rows=[]
        for entry in relevant[:settings['max_details']]:
            detail=extract_detail(client.get(entry['source_url']))
            if detail['source_listing_id']!=entry['source_listing_id']: raise ValueError('source_identity_changed')
            place=detail.get('job_location')
            if not isinstance(place,dict) or place.get('region')!='ZH':raise ValueError('unexpected_canton')
            row=normalize(detail)
            if not re.search(r'\b(EFZ|EBA)\b',row['title'],re.I):raise ValueError('unexpected_qualification')
            closed=False
            if detail.get('valid_through'):
                closed=date.fromisoformat(detail['valid_through'][:10])<date.today()
            row['closed']=closed;rows.append(row)
        if not rows:raise ValueError('empty_export')
        with con.transaction():
            for row in rows:
                metadata={'schema_version':'0.1.0','id':row['id'],'source':'yousty.ch','source_job_id':row['source_listing_id'],
                 'title':'Lehrstelle als '+row['title'],'company':row['company'],'location':row['location'],'url':row['source_url'],
                 'description':'Aufgaben und Anforderungen findest du im verlinkten Originalinserat.','categories':['Lehrstelle'],
                 'published_at':None,'processing':{'state':'needs_review','warnings':['Verfügbarkeit beim Anbieter prüfen']},'matching':{'status':'not_run','score':None}}
                con.execute('''INSERT INTO career_pool.listings(id,source_listing_id,metadata,content_hash,status)
                 VALUES(%s,%s,%s,%s,%s) ON CONFLICT(id) DO UPDATE SET metadata=excluded.metadata,
                 content_hash=excluded.content_hash,last_seen_at=now(),missing_count=0,status=excluded.status''',
                 (row['id'],row['source_listing_id'],Jsonb(metadata),row['content_hash'],'closed' if row['closed'] else 'active'))
            if complete:
                # Absence is not proof of closure: flag after TWO complete successful snapshots.
                con.execute("UPDATE career_pool.listings SET missing_count=missing_count+1,status=CASE WHEN missing_count>=1 THEN 'unconfirmed' ELSE status END WHERE source_listing_id<>ALL(%s)",([j['source_listing_id'] for j in listings],))
            con.execute("UPDATE career_pool.runs SET status='completed',finished_at=now(),complete=%s,seen_count=%s WHERE id=%s",(complete,len(rows),run_id))
    except Exception as exc:
        with con.transaction():
            con.execute("UPDATE career_pool.runs SET status='failed',finished_at=now(),error_code=%s WHERE id=%s",(type(exc).__name__,run_id))
        raise
    return {'run':str(run_id),'seen':len(rows),'complete':complete}
def export(con,path):
    records=[]
    for row in con.execute("SELECT metadata,first_seen_at,last_seen_at,status FROM career_pool.listings WHERE status<>'closed' ORDER BY id"):
        item=dict(row['metadata']);item.update(first_seen_at=row['first_seen_at'].isoformat(),last_seen_at=row['last_seen_at'].isoformat())
        if row['status']=='unconfirmed':item['processing']={'state':'needs_review','warnings':['In zwei vollständigen Abrufen nicht mehr gefunden; Verfügbarkeit ungeklärt']}
        records.append(item)
    if not records:raise ValueError('empty_export')
    path=Path(path);fd,tmp=tempfile.mkstemp(dir=path.parent,prefix='.feed-')
    try:
        with os.fdopen(fd,'w') as f:
            json.dump(records,f,ensure_ascii=False);f.flush();os.fsync(f.fileno())
        os.chmod(tmp,0o644);os.replace(tmp,path)
    finally:
        if os.path.exists(tmp):os.unlink(tmp)
    return len(records)
def main():
    settings=config('/etc/careeragency/crawler.json') # Fail closed before any request.
    with psycopg.connect(os.environ['CAREER_CRAWLER_DATABASE_URL'],autocommit=True,row_factory=dict_row) as con:
        if not con.execute("SELECT pg_try_advisory_lock(hashtextextended('career-crawler',0)) AS ok").fetchone()['ok']:raise SystemExit('crawler_already_running')
        result=refresh(con,settings,Client())
        result['exported']=export(con,os.environ['CAREER_CRAWLER_FEED'])
        print(json.dumps(result))
if __name__=='__main__':main()
