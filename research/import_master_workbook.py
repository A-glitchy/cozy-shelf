"""Brings the master workbook (Books, Trigger Warnings, Sources, Research Status) into data/books-*.json.

    python3 research/import_master_workbook.py Cozy_Shelf_Master_Workbook.xlsx

The workbook is the source of truth for the reported triggers. This script:
  * updates catalogue fields and warnings from the four tabs (one record per reported trigger),
  * keeps research details the workbook has no column for (verification, spoiler notes, links, 'not found'/'unsure' records),
  * never touches personal data (Journal, Own books, Settings live in your Google Sheet / browser, not in data/),
  * reports every difference it finds. Run it again after editing the workbook; it is safe to repeat.
"""
import sys, json, glob, re, collections, openpyxl
CATID={"sexual violence":"sexual-violence","abuse":"abuse","violence or gore":"violence-gore","kidnapping":"kidnapping","stalking":"stalking","suicide or self-harm":"suicide-self-harm","mental health":"mental-health","eating disorders":"eating-disorders","addiction":"addiction","death or grief":"death-grief","illness":"illness","pregnancy loss":"pregnancy-loss","animal cruelty or death":"animal-cruelty","discrimination":"discrimination","war":"war","infidelity":"infidelity","other":"other"}
k=lambda s: re.sub(r"[^a-z0-9]+"," ",str(s or "").lower()).strip()
CATID={k(a):b for a,b in CATID.items()}
txt=lambda v: re.sub(r"\s+"," ",str(v if v is not None else "")).strip()
INTENS={"mild","minor","moderate","heavy","graphic"}
def intensity(s): t=k(s); return t if t in INTENS else None
def depiction(s):
    t=k(s)
    if t.startswith("on page"): return "on-page"
    if t.startswith("off page"): return "off-page"
    if "mention" in t or "referenc" in t: return "referenced"
    return None
def svstatus(s):
    t=k(s)
    if not t: return None
    if t.startswith("not recorded"): return "not-recorded"
    if t.startswith("yes"): return "yes"
    if t=="no" or t.startswith("no "): return "no"
    if t.startswith("unsure"): return "unsure"
    return None
def table(wb,name):
    if name not in wb.sheetnames: return []
    rows=list(wb[name].iter_rows(values_only=True)); heads=[k(h) for h in rows[0]]
    return [dict(zip(heads,r)) for r in rows[1:] if any(c is not None and txt(c)!="" for c in r)]
def col(r,*names):
    for n in names:
        v=txt(r.get(k(n)))
        if v: return v
    return ""
def labels(s): return [x.strip() for x in str(s or "").split(";") if x.strip()]
def add_ev(lst,label,note=None,url=None):
    l=re.sub(r"[.;,]+$","",txt(label)); 
    if not l: return
    for e in lst:
        if k(e["label"])==k(l):
            if note and not e.get("note"): e["note"]=note
            if url and not e.get("url"): e["url"]=url
            return
    e={"label":l}
    if note: e["note"]=note
    if url: e["url"]=url
    lst.append(e)

wb=openpyxl.load_workbook(sys.argv[1],data_only=True)
B,T,S,R=table(wb,"Books"),table(wb,"Trigger Warnings"),table(wb,"Sources"),table(wb,"Research Status")
files=sorted(glob.glob("data/books-*.json")); data={f:json.load(open(f)) for f in files}
where={b["id"]:(f,i) for f,L in data.items() for i,b in enumerate(L)}
status={col(r,"Book ID"):r for r in R if col(r,"Book ID")}
src=collections.defaultdict(list)
for r in S:
    bid,cid,trig=col(r,"Book ID"),CATID.get(k(col(r,"Category"))),k(col(r,"Trigger / warning"))
    if bid and cid and trig: add_ev(src[(bid,cid,trig)],col(r,"Source / evidence label"),col(r,"Research note") or None)
tw=collections.defaultdict(list)
for r in T:
    bid=col(r,"Book ID")
    if bid: tw[bid].append(r)
rep=collections.Counter(); notes=[]
def apply_book(rec,r):
    st=status.get(rec["id"],{})
    rec["title"]=col(r,"Title") or rec["title"]
    a=col(r,"Author(s)")
    if a: rec["authors"]=[x.strip() for x in a.split(";") if x.strip()]
    pe=col(r,"Pages estimate"); rec["pages"]["estimate"]=int(float(pe)) if pe else None
    pc=col(r,"Page-count confidence"); 
    if pc: rec["pages"]["confidence"]=pc.lower()
    for key,c in (("genres","Genres"),("subgenres","Subgenres"),("moods","Moods")): rec[key]=[x.strip() for x in col(r,c).replace(";",",").split(",") if x.strip()]
    rec["summary"]=col(r,"Summary") or None
    wr=col(st,"Warnings reviewed") or col(r,"Warnings reviewed")
    if wr in ("none","partial","complete"): rec["warningsReviewed"]=wr
    rec["research"]={"status":col(st,"Research status") or col(r,"Research status") or rec["research"]["status"],"lastReviewed":col(st,"Last reviewed") or col(r,"Last reviewed") or rec["research"]["lastReviewed"]}
    svs=svstatus(col(st,"Sexual violence status") or col(r,"Sexual violence status"))
    if svs: rec["svStatus"]=svs
    note=col(r,"Sexual violence research note")
    if note: rec["svNote"]=note
    return svs,intensity(col(r,"Sexual violence intensity"))
def new_record(r):
    return {"id":col(r,"Book ID"),"title":col(r,"Title"),"authors":[],"summary":None,"pages":{"estimate":None,"confidence":"unknown","source":"From the master workbook"},"genres":[],"subgenres":[],"moods":[],"warnings":[],"warningsReviewed":"none","sources":[{"label":"Master workbook"}],"cover":None,"research":{"status":"draft","lastReviewed":""}}
added=0
for r in B:
    bid=col(r,"Book ID")
    if not bid: continue
    if bid in where: f,i=where[bid]; rec=data[f][i]
    else:
        rec=new_record(r); f=files[-1]; data[f].append(rec); where[bid]=(f,len(data[f])-1); added+=1
    svs,svint=apply_book(rec,r)
    old={ (w["category"],k(w.get("name") or w.get("subcategory") or "")):w for w in rec["warnings"] if w["presence"]=="present"}
    keepers=[w for w in rec["warnings"] if w["presence"]!="present"]
    new=[]; seen={}
    for t in tw.get(bid,[]):
        name=col(t,"Trigger / warning"); cid=CATID.get(k(col(t,"Category")),"other")
        if not name: continue
        key=(cid,k(name))
        ev=[]
        for e in src.get((bid,cid,k(name)),[]): add_ev(ev,e["label"],e.get("note"))
        for l in labels(col(t,"Evidence / source labels")): add_ev(ev,l)
        o=old.get(key)
        for e in ev:
            for oe in (o or {}).get("evidence",[]):
                if k(oe.get("label"))==k(e["label"]) and oe.get("url") and not e.get("url"): e["url"]=oe["url"]
        sub=col(t,"Abuse subtype"); inten=intensity(col(t,"Intensity")); dep=depiction(col(t,"Depiction (on-page / off-page)")); nt=col(t,"Description / note"); wid=col(t,"Warning ID")
        if key in seen:           # same trigger on another row: one pill, sources combined
            w=seen[key]
            for e in ev: add_ev(w["evidence"],e["label"],e.get("note"),e.get("url"))
            w.setdefault("intensity",inten) if inten else None; continue
        w={"category":cid,"name":name,"presence":"present","verification":(o or {}).get("verification","unverified-research"),"evidence":ev}
        if (o or {}).get("subcategory"): w["subcategory"]=o["subcategory"]
        if cid=="abuse": w["abuseSubtype"]=sub or name
        elif sub: w["abuseSubtype"]=sub
        if inten: w["intensity"]=inten
        if dep: w["depiction"]=dep
        if nt: w["note"]=nt
        elif (o or {}).get("note"): w["note"]=o["note"]
        if (o or {}).get("spoilerNote"): w["spoilerNote"]=o["spoilerNote"]
        if wid: w["warningId"]=wid
        seen[key]=w; new.append(w)
    sv=next((w for w in new if w["category"]=="sexual-violence"),None)
    if svs=="yes" and not sv:
        w={"category":"sexual-violence","name":"Sexual violence","presence":"present","verification":"unverified-research","evidence":[]}
        if svint: w["intensity"]=svint
        if rec.get("svNote"): w["note"]=rec["svNote"]
        new.append(w); rep["sv_added_from_status"]+=1
    elif sv:
        if svint and "intensity" not in sv: sv["intensity"]=svint
        if rec.get("svNote") and not sv.get("note"): sv["note"]=rec["svNote"]
    gone=[kk for kk in old if kk not in {(w["category"],k(w["name"])) for w in new}]
    if gone: rep["present_dropped"]+=len(gone); notes.append((rec["title"],[old[g].get("name") for g in gone]))
    rec["warnings"]=new+[w for w in keepers if not (w["category"]=="sexual-violence" and sv)]
    rep["books"]+=1; rep["triggers"]+=len(new)
for f,L in data.items(): json.dump(L,open(f,"w"),indent=2,ensure_ascii=False); open(f,"a").write("\n")
print(dict(rep),"| new books added:",added,"| books in data not in workbook (kept untouched):",len([b for L in data.values() for b in L if b["id"] not in {col(r,'Book ID') for r in B}]))
for t,g in notes[:10]: print("  dropped (not in workbook):",t,g)
