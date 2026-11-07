"""Private state for ratings, Radar and Agency; dossier storage is out of scope."""
import json
from datetime import datetime
from fastapi import APIRouter, HTTPException, Request
from pydantic import BaseModel, Field, ConfigDict
from psycopg.types.json import Jsonb
from .app import db, session, gate

router=APIRouter(prefix="/api/user")
KEYS={"workspace","swipes","radar","profile","last-visit","feedback"}
FIELDS={"annotations","relevance_ratings","radar_career_ratings","dismissals",
        "positive_feedback","export_selection","activity_log","overrides","manual_jobs"}
class Write(BaseModel):
    model_config=ConfigDict(extra="forbid")
    revision:int=Field(ge=0)
    data:dict|list|str|None
class Ratings(BaseModel):
    model_config=ConfigDict(extra="forbid")
    relevance_ratings:dict=Field(default_factory=dict)
    radar_career_ratings:dict=Field(default_factory=dict)
def validate_size(data):
    if len(json.dumps(data,ensure_ascii=False,allow_nan=False).encode())>4_500_000:
        raise HTTPException(413,"Datenmenge zu gross")
def owner(con,request):
    u=session(con,request);gate(u)
    con.execute("SELECT set_config('career.user_id',%s,true)",(str(u["id"]),))
    return u["id"]
def lock(con,uid,key):
    # Serialise create/read/write as well as updates; no lost first insert.
    con.execute("SELECT pg_advisory_xact_lock(hashtextextended(%s,0))",(str(uid)+":"+key,))
def read(con,uid,key):
    row=con.execute("SELECT data,revision FROM career_private.user_state WHERE user_id=%s AND key=%s",(uid,key)).fetchone()
    return dict(row) if row else {"data":None,"revision":0}
def write(con,uid,key,data,revision):
    con.execute("""INSERT INTO career_private.user_state(user_id,key,data,revision) VALUES(%s,%s,%s,%s)
        ON CONFLICT(user_id,key) DO UPDATE SET data=excluded.data,revision=excluded.revision,updated_at=now()""",
        (uid,key,Jsonb(data),revision))
def feedback(data):
    if not isinstance(data,dict) or data.get("type")!="bewerbungs-agent-feedback" or data.get("schema_version")!="1.0.0":
        raise HTTPException(422,"Ungültiges Feedbackformat")
    if set(data)-FIELDS-{"type","schema_version","updated_at"}:
        raise HTTPException(422,"Unbekannte Feedbackfelder")
    for field in FIELDS:
        if field in data and not isinstance(data[field],list): raise HTTPException(422,"Ungültige Feedbackliste")
    return data
@router.get("/state/{key}")
def get_state(key:str,request:Request):
    if key not in KEYS: raise HTTPException(404)
    with db() as con:
        uid=owner(con,request)
        return read(con,uid,key)
@router.put("/state/{key}")
def put_state(key:str,body:Write,request:Request):
    if key not in KEYS: raise HTTPException(404)
    data=body.data
    if key=="workspace" and data is not None:
        if not isinstance(data,dict) or data.get("type")!="bewerbungs-agent-workspace": raise HTTPException(422,"Ungültiger Arbeitsstand")
        if any(k in data for k in ("dossiers","documents","user_id")): raise HTTPException(422,"Nicht unterstützte Daten")
        # Central listings are loaded from the central feed, never copied into private state.
        data={**data,"jobs":[]}
    if key=="feedback": feedback(data)
    validate_size(data)
    with db() as con:
        uid=owner(con,request);lock(con,uid,key);old=read(con,uid,key)
        if old["revision"]!=body.revision: raise HTTPException(409,"Zwischenzeitlich auf einem anderen Gerät geändert. Bitte neu laden.")
        if old["data"]==data: return old
        write(con,uid,key,data,old["revision"]+1)
        return {"data":data,"revision":old["revision"]+1}
@router.patch("/ratings")
def patch_ratings(body:Ratings,request:Request):
    patches=body.model_dump();validate_size(patches)
    for edits in patches.values():
        if len(edits)>1000: raise HTTPException(413)
        for key,item in edits.items():
            if not key or key.startswith("DEMO-") or len(key)>250 or not isinstance(item,dict) or item.get("id")!=key:
                raise HTTPException(422,"Ungültige Inserat-ID")
            if set(item)-{"id","score","scores","updated_at","reasons","reason","note","aspects","field_relation","seniority_assessment","suggested_score_at_rating","selector_version"}: raise HTTPException(422,"Unbekannte Bewertungsfelder")
            if item.get("score") is not None and (type(item["score"]) is not int or not 1<=item["score"]<=100): raise HTTPException(422,"Ungültige Bewertung")
            if "scores" in item and (not isinstance(item["scores"],dict) or any(type(v) not in (int,float) or not 0<=v<=100 for v in item["scores"].values())): raise HTTPException(422,"Ungültige Kriterien")
            try:
                date=datetime.fromisoformat(item["updated_at"].replace("Z","+00:00"))
                if date.tzinfo is None: raise ValueError()
            except (KeyError,ValueError,TypeError,AttributeError): raise HTTPException(422,"Ungültiger Zeitstempel")
    with db() as con:
        uid=owner(con,request);lock(con,uid,"feedback");old=read(con,uid,"feedback")
        result=old["data"] or {"type":"bewerbungs-agent-feedback","schema_version":"1.0.0"}
        result=dict(result);changed=False
        for kind,edits in patches.items():
            items={x["id"]:x for x in result.get(kind,[])}
            for key,item in edits.items():
                previous=items.get(key)
                if previous==item: continue
                if previous and datetime.fromisoformat(previous["updated_at"].replace("Z","+00:00"))>=datetime.fromisoformat(item["updated_at"].replace("Z","+00:00")):
                    raise HTTPException(409,"Eine neuere oder gleichzeitige Bewertung liegt vor. Bitte abgleichen.")
                items[key]=item;changed=True
            result[kind]=list(items.values())
        validate_size(result)
        if changed: write(con,uid,"feedback",result,old["revision"]+1)
        return {"revision":old["revision"]+int(changed),"unchanged":not changed}
