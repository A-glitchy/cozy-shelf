"""Turn a results spreadsheet (Title, Author, Sexual violence, How it appears, Other warnings, Sources, Confidence)
into a catalogue batch.  Usage: python3 research/import_warning_sheet.py results.xlsx goodreads.csv batch-id
Then:  node scripts/merge-batch.mjs research/batches/<batch-id>.json --update --write
Existing books are updated; books not yet in the catalogue are added only if tags are listed in NEW below."""
import sys, openpyxl, json, glob, re, csv, collections
XLSX, GRCSV, BATCH = sys.argv[1], sys.argv[2], sys.argv[3]
ws=openpyxl.load_workbook(XLSX).active
catalog={}
for f in sorted(glob.glob("data/books-*.json")):
    for b in json.load(open(f)): catalog[b["id"]]=b
norm=lambda s: re.sub(r"[^a-z0-9]+"," ",s.lower()).strip()
strip=lambda x: re.sub(r"^(the|a|an) ","",x)
def keys(t):
    t=re.sub(r"\(.*?\)","",t); return {strip(norm(t)),strip(norm(t.split(":")[0]))}
idx={}
for b in catalog.values():
    for k in keys(b["title"]): idx.setdefault(k,set()).add(b["id"])
gr=list(csv.DictReader(open(GRCSV,encoding="utf-8-sig")))
grk={}
for r in gr:
    for k in keys(r["Title"]): grk.setdefault(k,r)
ALIAS={"A Midsummer Night’s Dream":"A Mid Summer Night's Dream"}
SV=r"incest|pedophil|paedophil|child sexual|sexual abuse|sexual assault|\brape|sexual exploitation|sex trafficking|grooming|sexual coercion|sexual violence"
RULES=[("eating-disorders",r"eating disorder|disordered eating|anorex|bulimi"),("suicide-self-harm",r"suicid|self[- ]harm"),("animal-cruelty",r"animal"),
("addiction",r"addict|alcohol|drug|substance|overdose"),("abuse",r"abuse|neglect|gaslight|coercive|manipulat|domestic violence|controlling|toxic relationship"),
("pregnancy-loss",r"miscarriage|stillbirth|abortion|pregnancy loss|infant death"),
("discrimination",r"racis|homophob|transphob|sexis|misogyn|ableis|antisemit|xenophob|discriminat|slur|colorism|islamophob|outing|fatphob|body shaming|hate crime|bigotry|slut"),
("war",r"\bwar\b|genocide|holocaust|terror|military|concentration camp"),("stalking",r"stalk"),("kidnapping",r"kidnap|abduct|trafficking|captiv|confinement"),
("infidelity",r"infidel|cheat|adulter|affair"),("illness",r"cancer|terminal|illness|disease|pandemic|medical|disab|chronic|dementia|infertil"),
("death-grief",r"death|grief|dying|loss|bereave|funeral"),("mental-health",r"mental|depress|anxiety|panic|ptsd|trauma|psychosis|schizo|bipolar|paranoi|hallucin"),
("violence-gore",r"murder|gore|blood|violen|gun|torture|stab|shoot|kill|assault|body horror|injur|fight|brutality")]
def mapcat(p):
    p=p.lower()
    for c,rx in RULES:
        if re.search(rx,p): return c
    return "other"
SH=(["nonfiction","self-help"],[],[])
NEW={"Where the Wildflowers Grow":(["fiction"],[],[]),"Beyond the Moonlit Sea":(["romance"],[],[]),"The Brave":(["young adult"],[],[]),"Extasia":(["young adult","fantasy"],[],[]),
"All My Mothers":(["fiction"],[],[]),"When Nietzsche Wept":(["historical fiction","literary fiction"],[],["thought-provoking"]),"Win Me Something":(["literary fiction"],[],[]),
"Someone I Used to Know":(["romance","contemporary"],[],["romantic"]),"The Minute I Saw You":(["romance","contemporary"],[],["romantic"]),"Small Joys of Real Life":(["fiction"],[],[]),
"To Sleep in a Sea of Stars":(["science fiction"],[],["adventurous"]),"A Thousand Years to Wait":(["fiction"],[],[]),"The Last Beekeeper":(["fiction"],[],[]),
"The Tiger Mom’s Tale":(["fiction","contemporary"],[],[]),"The Reckless Afterlife of Harriet Stoker":(["young adult"],[],[]),"Unfaithful":(["thriller"],[],["suspenseful"]),
"From the Ashes":(["nonfiction","memoir"],[],["emotionally-intense","hopeful"]),"My Mess Is a Bit of a Life":(["nonfiction","memoir"],[],[]),"My Own Words":(["nonfiction"],["essays and speeches"],[]),
"The Essential Rumi":(["poetry","classic"],["Persian literature"],[]),"The Anthropocene Reviewed":(["nonfiction","essays"],[],[]),"Immune":(["nonfiction","science"],[],[]),
"Thinking, Fast and Slow":(["nonfiction","psychology"],[],[]),"Man’s Search for Meaning":(["nonfiction","memoir","psychology"],[],["thought-provoking"]),"The Art of Loving":(["nonfiction","psychology"],[],["thought-provoking"]),
"Dopamine Nation":(["nonfiction","psychology"],[],[]),"The Happiness Project":(["nonfiction","self-help"],[],[]),"The Comfort Book":(["nonfiction","self-help"],[],["comforting"]),
"An Anthology of Philosophy in Persia, Volumes 1, 2 and 3":(["nonfiction","philosophy"],["Persian philosophy"],[]),
"The Child in You":SH,"When You’re Ready, This Is How You Heal":SH,"The Mountain Is You":SH,"I Am the Hero of My Own Life":SH,"I’m OK, You’re OK":SH,"Clarity & Connection":SH,
"Inward":SH,"Breaking the Habit of Being Yourself":SH,"The Daily Stoic Journal":SH,"The Daily Stoic":SH,"A Gentle Reminder":SH}
clean=lambda s: re.sub(r"\s+"," ",str(s or "")).strip()
def pages_of(row):
    try: p=int(row["Number of Pages"])
    except: p=0
    return p if p>=10 else None
def warn_records(ans,how,other,src,conf,link):
    nosrc=("no reliable" in src.lower()) or src==""
    ev=[{"label":(f"{src} (via spreadsheet check)" if not nosrc else "Searched; no reliable source found")}]
    if link and not nosrc: ev[0]["url"]=link
    a=ans.lower(); howl=how.lower()
    phrases=[x.strip() for x in re.split(r",|;|/",other) if x.strip()] if (other and not nosrc) else []
    extra=[p for p in phrases if re.search(SV,p.lower())]; others=[p for p in phrases if p not in extra]
    if a.startswith("yes"):
        inten="heavy" if ("on the page" in howl and "not graphic" not in howl and "graphic" in howl) else ("moderate" if "on the page" in howl else ("mild" if ("referenced" in howl or "past" in howl or "discussed" in howl) else None))
        w={"category":"sexual-violence","presence":"present","verification":"unverified-research","evidence":ev,"note":f"{(how.split(' (')[0] if how else 'Reported')}. Confidence in this finding: {conf or 'not stated'}."+(f" Answer given: {ans}." if ans.lower()!='yes' else "")}
        if inten: w["intensity"]=inten
        sub=how[how.index("(")+1:].rstrip(")")[:80] if " (" in how else ""
        if extra: sub=(sub+"; " if sub else "")+", ".join(extra)
        if sub: w["subcategory"]=sub[:120]
        kind="yes"
    elif extra:
        w={"category":"sexual-violence","presence":"present","verification":"unverified-research","evidence":ev,"subcategory":", ".join(extra)[:120],"note":f"Listed under other warnings in the spreadsheet check, although its main sexual-violence answer was \"{ans}\". Worth a second look."}; kind="upgraded"
    elif (a=="no" or a.startswith("no indication")) and not nosrc and conf.lower() in ("medium","high"):
        w={"category":"sexual-violence","presence":"absent","verification":"unverified-research","evidence":ev,"note":f"Not found in the sources checked; this is not proof it is absent. Confidence: {conf}."}; kind="absent"
    else:
        w={"category":"sexual-violence","presence":"unknown","verification":"unverified-research","evidence":[{"label":"Searched; no reliable source found either way"}],"note":"A search found no reliable source either way, so this has not been assessed."}; kind="unknown"
    warns=[w]; seen=set()
    for ph in others:
        c=mapcat(ph); k=(c,ph.lower())
        if k in seen: continue
        seen.add(k); warns.append({"category":c,"presence":"present","verification":"unverified-research","evidence":ev,"note":"Listed in the spreadsheet check.","subcategory":ph[:80]})
    return warns,kind
out=[]; stat=collections.Counter(); created=[]; problems=[]
for r in ws.iter_rows(min_row=2):
    v=[clean(c.value) for c in r]; title,author,ans,how,other,src,conf=(v+[""]*7)[:7]
    if not title: continue
    link=next((c.hyperlink.target for c in r if c.hyperlink),None)
    warns,kind=warn_records(ans,how,other,src,conf,link); stat[kind]+=1
    ids=set()
    for k in keys(ALIAS.get(title,title)): ids|=idx.get(k,set())
    note={"label":"Content warnings from a spreadsheet check done with another AI tool; unverified"}
    if len(ids)==1:
        b=json.loads(json.dumps(catalog[next(iter(ids))])); b["warnings"]=warns; b["warningsReviewed"]="partial"
        if note not in b["sources"]: b["sources"]=b["sources"]+[note]
        b["research"]={"status":"draft","lastReviewed":"2026-10-24"}; out.append(b); continue
    if len(ids)>1: problems.append(("ambiguous",title)); continue
    tagkey=next((k for k in NEW if norm(k)==norm(title) or norm(title).startswith(norm(k))),None)
    if tagkey is None: problems.append(("no tags defined",title)); continue
    g,sg,m=NEW[tagkey]
    if title.startswith("An Anthology of Philosophy in Persia"): srcrows=[x for x in gr if x["Title"].startswith("An Anthology of Philosophy in Persia")]
    else:
        row=next((grk[k] for k in keys(title) if k in grk),None); srcrows=[row] if row else []
    if not srcrows: problems.append(("not in goodreads file",title)); continue
    for row in srcrows:
        t=row["Title"].split("(")[0].strip(); p=pages_of(row)
        out.append({"title":t,"authors":[clean(row["Author"])],"summary":None,
           "pages":{"estimate":p,"confidence":"medium" if p else "unknown","source":"Goodreads export edition page count; other editions differ." if p else "Not given in the Goodreads export."},
           "genres":g,"subgenres":sg,"moods":m,"warnings":warns,"warningsReviewed":"partial",
           "sources":[{"label":"Goodreads library export (title, author, page count)"},{"label":"Genres proposed by Claude from general knowledge, left broad where unsure"},note],
           "cover":None,"research":{"status":"tags-only draft","lastReviewed":"2026-10-24"}})
        created.append(t)
print(len(out),"records |",dict(stat),"| new books:",len(created),"| problems:",problems)
json.dump({"batchId":BATCH,"humanReviewed":False,"books":out},open(f"research/batches/{BATCH}.json","w"),indent=2,ensure_ascii=False)
