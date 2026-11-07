"""Copy the reviewed existing public apprenticeship metadata into the central pool."""
import json,hashlib,os
from pathlib import Path
import psycopg
from psycopg.types.json import Jsonb

def seed(con,rows):
 if not isinstance(rows,list) or not rows:raise ValueError('empty_seed')
 validated=[];seen=set()
 for item in rows:
  sid=item.get('source_job_id')
  expected='apprenticeship-'+hashlib.sha256(('yousty_poc|'+str(sid)).encode()).hexdigest()[:24]
  if item.get('source')!='yousty.ch' or item.get('id')!=expected or expected in seen:raise ValueError('invalid_seed')
  seen.add(expected);validated.append((expected,str(sid),Jsonb(item),hashlib.sha256(json.dumps(item,sort_keys=True).encode()).hexdigest()))
 with con.transaction():
  with con.cursor() as cur:cur.executemany('INSERT INTO career_pool.listings(id,source_listing_id,metadata,content_hash) VALUES(%s,%s,%s,%s) ON CONFLICT DO NOTHING',validated)
 return len(validated)
if __name__=='__main__':
 with psycopg.connect('dbname=careeragency_auth user=postgres',autocommit=True) as con:
  print(json.dumps({'seeded':seed(con,json.loads(Path('/srv/careeragency-public/lehrstellen.json').read_text()))}))
