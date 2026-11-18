from pathlib import Path
from playwright.sync_api import sync_playwright
import json
root=Path(__file__).resolve().parents[1]
out=[]
with sync_playwright() as p:
 b=p.chromium.launch(channel="msedge")
 q=b.new_page()
 for path in ["/","/book/specialty","/book/date","/lookup","/login","/forgot"]:
  q.goto("http://localhost:4173/#"+path);q.wait_for_load_state("networkidle")
  q.add_script_tag(path=str(root/"audit/axe.min.js"))
  out.append({"route":path,"audit":q.evaluate("async()=>await axe.run(document,{runOnly:{type:'tag',values:['wcag2a','wcag2aa','wcag21aa']}})")})
 (root/"audit/accessibility.json").write_text(json.dumps(out,indent=2))
 b.close()
