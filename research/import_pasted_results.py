"""Import compact results lines (writes the current one-record-per-trigger format).
Import compact results lines: Title @@ Y|note / N / U @@ D:phrase,phrase;V:...  (see the codes below).
Usage: python3 research/import_pasted_results.py results.txt"""
import sys, re, json, glob, collections
CODES={"D":"death-grief","V":"violence-gore","S":"suicide-self-harm","A":"abuse","AD":"addiction","E":"eating-disorders","M":"mental-health","I":"illness","P":"pregnancy-loss","AN":"animal-cruelty","DI":"discrimination","W":"war","ST":"stalking","K":"kidnapping","IN":"infidelity","O":"other"}
norm=lambda s: re.sub(r"[^a-z0-9]+"," ",s.lower()).strip()
strip=lambda x: re.sub(r"^(the|a|an) ","",x)
def keys(t):
    t=re.sub(r"\(.*?\)","",t); return {strip(norm(t)),strip(norm(t.split(":")[0]))}
files=sorted(glob.glob("data/books-*.json")); data={f:json.load(open(f)) for f in files}
books=[b for L in data.values() for b in L]
idx=collections.defaultdict(list)
for b in books:
    for k in keys(b["title"]): idx[k].append(b)
def split_top(t):
    out,buf,d=[],"",0
    for ch in t:
        d+= (ch=="(") - (ch==")")
        if ch=="," and d<=0: out.append(buf); buf=""
        else: buf+=ch
    out.append(buf); return [x.strip() for x in out if x.strip()]
cap=lambda x: x[:1].upper()+x[1:]
SRC={}
try:
    for _l in open("research/source_names_round2.txt",encoding="utf-8"):
        if "@@" in _l:
            _t,_s=[x.strip() for x in _l.split("@@")]; SRC[_t]=[x.strip() for x in _s.split("|") if x.strip()]
except FileNotFoundError: pass
def evidence_for(title):
    n=SRC.get(title) or next((v for k,v in SRC.items() if norm(k)==norm(title) or norm(k.split(":")[0])==norm(title.split(":")[0])),None)
    return [{"label":x} for x in (n or [])]
NOTE={"label":"Content warnings from a lookup done with another AI tool (any mention counts)"}
stat=collections.Counter(); problems=[]
for line in open(sys.argv[1],encoding="utf-8"):
    if not line.strip(): continue
    title,sv,rest=[x.strip() for x in line.rstrip("\n").split("@@")]
    hits={}
    for k in keys(title): 
        for b in idx.get(k,[]): hits[b["id"]]=b
    if len(hits)!=1:
        pre=norm(title.split(":")[0])
        hits={b["id"]:b for b in books if norm(b["title"]).startswith(pre)}
    if len(hits)!=1: problems.append((title,len(hits))); continue
    b=next(iter(hits.values())); old=b["warnings"]
    kind,_,sub=sv.partition("|")
    if kind=="Y": svrec={"category":"sexual-violence","name":"Sexual violence","presence":"present","verification":"unverified-research","evidence":evidence_for(title),"subcategory":sub or "mentioned by a source or reader","note":"Flagged because at least one source or reader mentions it (any mention counts)."}; stat["yes"]+=1
    elif kind=="N": svrec={"category":"sexual-violence","presence":"absent","verification":"unverified-research","evidence":evidence_for(title),"note":"Not found in the sources checked; this is not proof it is absent."}; stat["no"]+=1
    else: svrec={"category":"sexual-violence","presence":"unknown","verification":"unverified-research","evidence":[{"label":"Searched; no reliable source found either way"}],"note":"A search found no reliable source either way, so this has not been assessed."}; stat["unsure"]+=1
    keep=[w for w in old if w["category"]!="sexual-violence"]
    oldsv=[w for w in old if w["category"]=="sexual-violence"]
    if oldsv and oldsv[0]["presence"]=="present" and kind!="Y": svfinal=oldsv[0]   # never weaken an existing flag
    else: svfinal=svrec
    have={(w["category"],(w.get("name") or w.get("subcategory") or "").lower()) for w in keep if w.get("presence")=="present"}
    new=[]
    ev=evidence_for(title)
    if kind!="U" or rest:
        for part in [p for p in rest.split(";") if p.strip()]:
            code,_,phr=part.partition(":"); cat=CODES[code.strip()]
            for item in split_top(phr):
                if (cat,item.lower()) in have: continue
                have.add((cat,item.lower()))
                new.append({"category":cat,"name":cap(item),"subcategory":item,"presence":"present","verification":"unverified-research","evidence":ev})
    b["warnings"]=[svfinal]+keep+new; b["warningsReviewed"]="partial"
    if NOTE not in b["sources"]: b["sources"]=b["sources"]+[NOTE]
    b["research"]={"status":b["research"]["status"],"lastReviewed":"2026-11-12"}
for f,L in data.items(): json.dump(L,open(f,"w"),indent=2,ensure_ascii=False); open(f,"a").write("\n")
print(dict(stat),"| problems:",problems)
