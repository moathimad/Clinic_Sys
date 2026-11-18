from pathlib import Path
from playwright.sync_api import sync_playwright, expect
import subprocess

ROOT = Path(__file__).resolve().parents[1]
with sync_playwright() as p:
    browser = p.chromium.launch(channel="msedge", headless=True, args=["--remote-debugging-port=9333"])
    page = browser.new_page(viewport={"width":1440,"height":1000})
    errors=[]
    page.on('pageerror', lambda e: errors.append(str(e)))
    page.goto('http://localhost:4173')
    page.wait_for_load_state('networkidle')
    # Existing end-to-end workflow suite runs in this disposable browser.
    subprocess.run(['node','scripts/browser-check.mjs'],cwd=ROOT,check=True)
    for width in [320,390,768,1440]:
        page.set_viewport_size({'width':width,'height':1000})
        for lang in ['en','ar']:
            page.evaluate("lang=>localStorage.setItem('careslot.language',lang)",lang)
            page.goto('http://localhost:4173')
            page.reload(); page.wait_for_load_state('networkidle')
            assert page.evaluate('document.documentElement.scrollWidth <= innerWidth'), (width,lang,'landing overflow')
            page.goto('http://localhost:4173/#/book/date')
            page.locator('.calendar').wait_for()
            assert page.evaluate('document.documentElement.scrollWidth <= innerWidth'), (width,lang,'calendar overflow')
            page.screenshot(path=str(ROOT/f'qa/polish-calendar-{width}-{lang}.png'))
    page.set_viewport_size({'width':1440,'height':1000})
    page.evaluate("localStorage.setItem('careslot.language','en')")
    page.goto('http://localhost:4173'); page.reload();page.wait_for_load_state('networkidle')
    page.locator('.nav-links a[href="#doctors"]').click()
    page.wait_for_timeout(900)
    assert 0 <= page.locator('#doctors').bounding_box()['y'] < 180
    page.goto('http://localhost:4173/#/book/date')
    day=page.locator('.calendar-day.available:not(:disabled)').first
    day.focus(); page.keyboard.press('Enter')
    assert page.evaluate('document.activeElement.matches(".calendar-day")')
    page.locator('[data-action=date-continue]').click()
    page.locator('.slot:not(:disabled)').first.click()
    page.locator('[data-action=time-continue]').click()
    page.locator('[name=name]').fill('899')
    page.locator('[name=phone]').fill('0791111122')
    page.locator('#details-form [type=submit]').click()
    expect(page.locator('[name=name]')).to_have_attribute('aria-invalid','true')
    page.locator('[name=name]').fill('Moath Ahmad')
    expect(page.locator('#form-error')).to_be_empty()
    page.locator('[name=note]').fill('Please use the accessible entrance.')
    page.locator('#details-form a[href="#/book/time"]').click()
    page.locator('[data-action=time-continue]').click()
    expect(page.locator('[name=name]')).to_have_value('Moath Ahmad')
    expect(page.locator('[name=note]')).to_have_value('Please use the accessible entrance.')
    for width in [320,1440]:
        page.set_viewport_size({'width':width,'height':1000})
        for mode in ['demo','worst','arabic','empty']:
            page.goto('http://localhost:4173/qa/stress.html?data='+mode)
            page.wait_for_load_state('networkidle')
            assert page.evaluate('document.documentElement.scrollWidth <= innerWidth'), (width,mode,'stress overflow')
            page.screenshot(path=str(ROOT/f'qa/stress-{width}-{mode}.png'))
    assert not errors, errors
    print('PASS: full workflow, one-click navigation, keyboard date focus, draft preservation, bilingual responsive layouts, isolated long-name and empty-state previews.')
    browser.close()
