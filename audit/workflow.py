from pathlib import Path
from playwright.sync_api import sync_playwright
import subprocess
root=Path(__file__).resolve().parents[1]
source=(root/"scripts/browser-check.mjs").read_text()
source=source.replace('"../qa/"','"../audit/workflow/"').replace('"../qa/" + name','"../audit/workflow/" + name')
(root/"audit/workflow.mjs").write_text(source)
with sync_playwright() as p:
    b=p.chromium.launch(channel="msedge",headless=True,args=["--remote-debugging-port=9333"])
    page=b.new_page()
    result=subprocess.run(["node","audit/workflow.mjs"],cwd=root,capture_output=True,text=True)
    (root/"audit/workflow-result.txt").write_text(result.stdout+result.stderr)
    print(result.stdout+result.stderr)
    b.close()
