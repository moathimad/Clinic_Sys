from pathlib import Path
import json
from playwright.sync_api import sync_playwright
root=Path(__file__).resolve().parents[1];results=[]
with sync_playwright() as p:
 b=p.chromium.launch(channel="msedge");c=b.new_context();q=c.new_page()
 def test(name,fn):
  try:fn();results.append({"name":name,"status":"pass"})
  except Exception as e:results.append({"name":name,"status":"fail","detail":str(e)})
 def nav(path="/"):
  q.goto("http://localhost:4173/#"+path);q.wait_for_load_state("networkidle")
 def check(v):assert v
 nav()
 for anchor in ["how","doctors","services","about","visit"]:
  def anchor_test(anchor=anchor):
   a=q.locator('.nav-links a[href="#'+anchor+'"]')
   if not a.count():raise Exception("selector absent; inventory mismatch, untested")
   a.click()
   check(q.locator("#"+anchor).count()==1)
  test("anchor "+anchor,anchor_test)
 test("rapid menu 20 clicks",lambda:(q.set_viewport_size({"width":390,"height":844}),[q.locator("[data-action=menu]").click() for _ in range(20)]))
 for size in [(844,390),(1920,320),(320,1920)]:
  test("unusual viewport "+str(size),lambda size=size:(q.set_viewport_size({"width":size[0],"height":size[1]}),check(q.evaluate("document.documentElement.scrollWidth<=innerWidth"))))
 nav("/login")
 test("password keyboard activation",lambda:(q.locator("[data-action=toggle-password]").focus(),q.keyboard.press("Enter"),check(q.locator("#login-password").get_attribute("type")=="text")))
 nav("/lookup")
 for phone in ["abc"," ","+962<script>","123","٠٧٩١١١١١٢٢"]:
  def phone_test(phone=phone):
   q.locator("[name=phone]").fill(phone);q.locator("#lookup-phone button[type=submit]").click()
   if phone!="٠٧٩١١١١١٢٢":check(q.locator("#lookup-phone").count()==1)
  test("phone input "+repr(phone),phone_test)
 nav()
 test("back forward",lambda:(nav("/login"),q.go_back(),q.go_forward(),check(q.locator("#login-form").count()==1)))
 for value in ['{}','{"date":null}','{"date":"invalid","time":"10:00"}']:
  def draft(value=value):
   q.evaluate("(v)=>sessionStorage.setItem('careslot.draft',v)",value)
   nav("/book/date");q.reload();check(bool(q.locator("#app").inner_text()))
  test("corrupt draft "+value,draft)
  q.evaluate("sessionStorage.clear()")
 b.close()
(root/"audit/edges.json").write_text(json.dumps(results,indent=2))
print("Edge results saved to audit/edges.json")

