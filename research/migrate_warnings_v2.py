"""One-time (and safe to re-run) migration of the catalogue's warning records to the per-trigger format.

  * every REPORTED trigger (presence "present") becomes its own record with a display `name`
  * source names are kept as separate evidence entries (and per-book names from research/source_names_round2.txt are restored)
  * "not found" (absent) and "unsure" (unknown) records are kept in the data for the record but never shown in the app
  * nothing is deleted from the research data; verification fields are kept as they were.
"""
import json, glob, re, collections
norm=lambda s: re.sub(r"[^a-z0-9]+"," ",s.lower()).strip()
strip=lambda x: re.sub(r"^(the|a|an) ","",x)
def keys(t):
    t=re.sub(r"\(.*?\)","",t); return {strip(norm(t)),strip(norm(t.split(":")[0]))}
GENERIC={"Listed in the warning lookup.","Listed in the spreadsheet check.","Listed in the spreadsheet check"}
GEN_EV=re.compile(r"^Checked with another AI tool using StoryGraph")
def split_top(s):
    out,buf,depth=[],"",0
    for ch in s:
        if ch=="(": depth+=1
        if ch==")": depth=max(0,depth-1)
        if ch in ",;" and depth==0: out.append(buf); buf=""
        else: buf+=ch
    out.append(buf); return [x.strip() for x in out if x.strip()]
def cap(s): return s[0].upper()+s[1:] if s else s
CATNAME={"death-grief":"Death or grief","violence-gore":"Violence or gore","suicide-self-harm":"Suicide or self-harm","abuse":"Abuse","addiction":"Addiction","eating-disorders":"Eating disorders","mental-health":"Mental health","pregnancy-loss":"Pregnancy loss","illness":"Illness","animal-cruelty":"Animal cruelty or death","discrimination":"Discrimination","war":"War","stalking":"Stalking","kidnapping":"Kidnapping","infidelity":"Infidelity","sexual-violence":"Sexual violence","other":"Other"}
files=sorted(glob.glob("data/books-*.json")); data={f:json.load(open(f)) for f in files}
books=[b for L in data.values() for b in L]
idx=collections.defaultdict(list)
for b in books:
    for k in keys(b["title"]): idx[k].append(b)
SRC={}
for line in open("research/source_names_round2.txt",encoding="utf-8"):
    if "@@" not in line: continue
    t,s=[x.strip() for x in line.split("@@")]
    hits={}
    for k in keys(t):
        for b in idx.get(k,[]): hits[b["id"]]=b
    if len(hits)!=1:
        pre=norm(t.split(":")[0]); hits={b["id"]:b for b in books if norm(b["title"]).startswith(pre)}
    if len(hits)==1: SRC[next(iter(hits))]=[x.strip() for x in s.split("|") if x.strip()]
def clean_evidence(ev, book_id):
    out=[]
    for e in ev or []:
        lab=e.get("label","")
        if GEN_EV.match(lab):
            continue
        lab=re.sub(r"\s*\(via spreadsheet check\)\s*$","",lab)
        if lab.startswith("Searched; no reliable source"): out.append(e); continue
        parts=[p.strip() for p in re.split(r"[,;]",lab) if p.strip()] if (re.search(r"[,;]",lab) and not e.get("url") and len(lab)<160 and "(" not in lab) else [lab]
        for i,p in enumerate(parts):
            ne={"label":p}
            if e.get("url") and i==0: ne["url"]=e["url"]
            out.append(ne)
    if not out and book_id in SRC: out=[{"label":n} for n in SRC[book_id]]
    seen=set(); res=[]
    for e in out:
        k=(e["label"].lower(),e.get("url","")); 
        if k in seen: continue
        seen.add(k); res.append(e)
    return res
changed=0; before=after=0
for f,L in data.items():
    for b in L:
        new=[]
        for w in b.get("warnings",[]):
            before+=1
            w=dict(w)
            if w.get("presence")!="present":
                w["evidence"]=clean_evidence(w.get("evidence"),b["id"]) or w.get("evidence",[])
                new.append(w); continue
            ev=clean_evidence(w.get("evidence"),b["id"])
            if b["id"] in SRC and not ev: ev=[{"label":n} for n in SRC[b["id"]]]
            if b["id"] in SRC and w.get("evidence") and all(GEN_EV.match(e.get("label","")) for e in w["evidence"]): ev=[{"label":n} for n in SRC[b["id"]]]
            note=w.get("note"); 
            if note in GENERIC: note=None
            if w["category"]=="sexual-violence":
                w2={**w,"name":"Sexual violence","evidence":ev}
                if note: w2["note"]=note
                else: w2.pop("note",None)
                new.append(w2); continue
            if w.get("name"):
                w["evidence"]=ev; new.append(w); continue
            subs=split_top(w.get("subcategory","")) if w.get("subcategory") else []
            if not subs:
                w2={**w,"name":CATNAME.get(w["category"],w["category"]),"evidence":ev}
                if note: w2["note"]=note
                else: w2.pop("note",None)
                new.append(w2); continue
            for s in subs:
                w2={k:v for k,v in w.items() if k not in ("note","subcategory")}
                w2.update({"name":cap(s),"subcategory":s,"evidence":ev})
                if note and len(subs)==1: w2["note"]=note
                new.append(w2)
        # drop exact duplicate present records (same category + same name)
        seen=set(); final=[]
        for w in new:
            if w.get("presence")=="present":
                k=(w["category"],w["name"].lower())
                if k in seen: continue
                seen.add(k)
            final.append(w)
        if final!=b.get("warnings",[]): changed+=1
        b["warnings"]=final; after+=len(final)
for f,L in data.items(): json.dump(L,open(f,"w"),indent=2,ensure_ascii=False); open(f,"a").write("\n")
print("books changed:",changed,"| warning records before:",before,"after:",after,"| per-book source lists restored for",len(SRC),"books")
