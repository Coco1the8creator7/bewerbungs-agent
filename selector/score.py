"""Non-excluding relevance suggestions. User scores are authoritative training feedback."""
import json, re
from pathlib import Path

FEEDBACK=Path("dashboard/selection-feedback.json")
JOBS=Path("dashboard/jobs.json")
POS={"fernwärme":22,"wärmenetz":22,"thermische netze":25,"projektleit":16,"energieberat":17,"energiekonzept":17,"erneuerbar":12,"energiesystem":12,"energie":8,"dekarbonisierung":12,"energiestadt":14,"förderprogramm":12,"netzentwicklung":15,"wärmepumpe":10}
NEG={"retail":-15,"fashion":-20,"pflegefach":-18,"gastronomie":-18}

def propose(job,feedback):
    text=" ".join(str(job.get(k) or "") for k in ("title","description","company")).lower()
    signals=[(term,points) for term,points in {**POS,**NEG}.items() if term in text]
    # Only explicit scored jobs contribute; avoid training on openings or status.
    examples=[(x,feedback.get(x["id"],{}).get("score")) for x in feedback.get("_jobs",[]) if isinstance(x,dict)]
    scored=[(x,int(score)) for x,score in examples if isinstance(score,int) and 1<=score<=100]
    baseline=50+sum(points for _,points in signals)
    if scored:
        comparable=[score for x,score in scored if any(term in (" ".join(str(x.get(k) or "") for k in ("title","description")).lower()) for term,_ in signals)]
        if len(comparable)>=5: baseline=0.8*baseline+0.2*(sum(comparable)/len(comparable))
    return {"suggested_score":max(1,min(100,round(baseline))),"mode":"suggestion_only","version":"0.1","reasons":[term for term,_ in signals],"final_decision":None}

def main():
    rows=json.loads(JOBS.read_text())
    feedback=json.loads(FEEDBACK.read_text()) if FEEDBACK.exists() else {}
    # The feedback JSON is the authoritative source for explicit ratings, not job status.
    for job in rows:
        job["selection"]=propose(job,{"_jobs":[dict(x, id=x["id"]) for x in rows if x.get("id") in feedback],"scores":feedback} if False else {})
        rating=feedback.get(job["id"])
        if isinstance(rating,dict) and isinstance(rating.get("score"),int) and 1<=rating["score"]<=100:
            job["selection"]["user_score"]=rating["score"]
    JOBS.write_text(json.dumps(rows,ensure_ascii=False,indent=2)+"\n")

if __name__=="__main__":main()
