from pathlib import Path
import json,re,subprocess
from playwright.sync_api import sync_playwright
ROOT=Path(__file__).resolve().parents[1]
OUT=ROOT/"audit"
results=[]; logs=[]
def record(name,fn,page=None):
    try:
        detail=fn()
        results.append(dict(name=name,status="pass",detail=detail))
    except Exception as e:
        results.append(dict(name=name,status="fail",detail=str(e)))
        if page:
            try: page.screenshot(path=str(OUT/f"failure-{len(results)}.png"),full_page=True)
            except: pass
def check(v,msg):
    assert v,msg
routes=["/","/book/specialty","/book/date","/book/time","/book/details","/book/verify","/lookup","/login","/forgot","/booking/missing","/receipt/missing","/missing"]
widths=[320,360,375,390,414,768,1024,1280,1440,1920]
inventory={}
for f in ROOT.rglob("*"):
    if f.is_file() and not any(x in f.parts for x in ["node_modules","audit",".git"]) and f.suffix in [".html",".css",".js",".mjs"]:
        text=f.read_text(encoding="utf-8")
        inventory[str(f.relative_to(ROOT))]={"lines":len(text.splitlines()),"bytes":f.stat().st_size,"actions":sorted(set(re.findall(r'data-action=["\']([\w-]+)',text))),"forms":re.findall(r'<form id="([^"]+)',text)}
(OUT/"inventory.json").write_text(json.dumps(inventory,indent=2),encoding="utf-8")
with sync_playwright() as p:
    browser=p.chromium.launch(channel="msedge",headless=True)
    ctx=browser.new_context()
    page=ctx.new_page()
    page.on("pageerror",lambda e:logs.append({"type":"exception","url":page.url,"message":str(e)}))
    page.on("console",lambda e: logs.append({"type":e.type,"message":e.text}) if e.type in ["error","warning"] else None)
    page.on("requestfailed",lambda r:logs.append({"type":"requestfailed","url":r.url,"message":r.failure}))
    def nav(route):
        page.goto("http://localhost:4173/#"+route)
        page.wait_for_load_state("networkidle")
    nav("/")
    perf=page.evaluate("({navigation:performance.getEntriesByType('navigation')[0].toJSON(),resources:performance.getEntriesByType('resource').map(r=>({name:r.name,size:r.transferSize,duration:r.duration}))})")
    (OUT/"performance.json").write_text(json.dumps(perf,indent=2))
    record("landing images loaded",lambda:check(page.locator("img").evaluate_all("(els)=>els.every(i=>!i.complete||i.naturalWidth>0)"),"broken image"),page)
    for language in ["en","ar"]:
        page.evaluate("(l)=>localStorage.setItem('careslot.language',l)",language)
        page.reload()
        for route in routes:
            nav(route)
            for width in widths:
                page.set_viewport_size({"width":width,"height":900})
                record(f"layout {language} {route} {width}",lambda:check(page.evaluate("document.documentElement.scrollWidth<=innerWidth"),"horizontal overflow"),page)
            record(f"render {language} {route}",lambda:check(page.locator("#app").inner_text().strip(),"empty app"),page)
    page.set_viewport_size({"width":1440,"height":900})
    page.evaluate("localStorage.setItem('careslot.language','en')")
    nav("/login");page.reload()
    record("password toggle",lambda:(page.locator("#login-password").fill("demo1234"),page.locator("[data-action=toggle-password]").click(),check(page.locator("#login-password").get_attribute("type")=="text","password hidden")),page)
    page.locator("[data-action=demo-role][data-role=staff]").click()
    page.locator("#login-form button[type=submit]").click()
    page.wait_for_url("**/workspace/**")
    for route in ["dashboard","bookings","doctors","availability","timeoff","patients","settings"]:
        for language in ["en","ar"]:
            page.evaluate("(l)=>localStorage.setItem('careslot.language',l)",language)
            nav("/workspace/"+route);page.reload()
            for width in widths:
                page.set_viewport_size({"width":width,"height":900})
                record(f"workspace {language} {route} {width}",lambda:check(page.evaluate("document.documentElement.scrollWidth<=innerWidth"),"horizontal overflow"),page)
    for key,value,route in [("careslot.language","xx","/book/specialty"),("careslot.frontend.v1","{bad","/"),("careslot.frontend.v1",'{"bookings":[{}],"doctors":[],"hours":{}}',"/workspace/dashboard")]:
        def corrupt():
            page.evaluate("([k,v])=>localStorage.setItem(k,v)",[key,value])
            nav(route);page.reload()
            check(page.locator("#app").inner_text().strip(),"blank page after corrupt storage")
            check("undefined" not in page.locator("#app").inner_text(),"undefined text")
        record("corrupt "+key+" "+value,corrupt,page)
        page.evaluate("localStorage.clear();sessionStorage.clear()")
        nav("/");page.reload()
    # Separate context, no changes to real browser storage.
    for mode in ["no-js","offline","blocked-images","blocked-fonts"]:
        c=browser.new_context(java_script_enabled=mode!="no-js")
        q=c.new_page()
        if mode=="blocked-images": c.route("**/*.png",lambda r:r.abort())
        if mode=="blocked-fonts": c.route("**/*.woff2",lambda r:r.abort())
        def degraded():
            q.goto("http://localhost:4173");q.wait_for_load_state("networkidle")
            if mode=="offline":
                c.set_offline(True);q.reload()
            check(bool(q.locator("body").inner_text().replace("Skip to content","").strip()),"no useful fallback/content")
        record("degraded "+mode,degraded,q)
        c.close()
    for engine in ["firefox","webkit"]:
        try:
            b=getattr(p,engine).launch(headless=True);q=b.new_page();q.goto("http://localhost:4173");check(bool(q.locator("#app").inner_text()),"empty");b.close()
            results.append(dict(name=engine+" smoke",status="pass"))
        except Exception as e:results.append(dict(name=engine+" smoke",status="blocked",detail=str(e)))
    browser.close()
(OUT/"results.json").write_text(json.dumps({"results":results,"logs":logs},indent=2),encoding="utf-8")
print({s:sum(r["status"]==s for r in results) for s in ["pass","fail","blocked"]})
