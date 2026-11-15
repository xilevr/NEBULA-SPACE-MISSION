import sys,asyncio
import os, pathlib
from playwright.sync_api import sync_playwright
URL = pathlib.Path(os.path.join(os.path.dirname(os.path.abspath(__file__)), '..', 'dist', 'nebula.html')).resolve().as_uri()
os.makedirs('capturas', exist_ok=True)
errs=[]
with sync_playwright() as p:
    b=p.chromium.launch(args=['--no-sandbox'])
    pg=b.new_page(viewport={'width':1440,'height':900})
    pg.on('console',lambda m: errs.append(('console',m.type,m.text)) if m.type in('error','warning') else None)
    pg.on('pageerror',lambda e: errs.append(('pageerror',str(e))))
    pg.goto(URL); pg.wait_for_timeout(800)
    for v in ['mc','sd','rm','nc','ol','sl','ms','ma']:
        pg.evaluate(f"go('{v}')"); pg.wait_for_timeout(700 if v!='nc' else 1500)
        pg.screenshot(path=f'capturas/{v}.png')
    b.close()
print(errs)
