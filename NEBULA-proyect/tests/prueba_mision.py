import os, pathlib
from playwright.sync_api import sync_playwright
URL = pathlib.Path(os.path.join(os.path.dirname(os.path.abspath(__file__)), '..', 'dist', 'nebula.html')).resolve().as_uri()
os.makedirs('capturas', exist_ok=True)
import sys
errs=[]
with sync_playwright() as p:
    b=p.chromium.launch(args=['--no-sandbox'])
    pg=b.new_page(viewport={'width':1440,'height':900})
    pg.on('console',lambda m: errs.append(m.text[:300]) if m.type=='error' else None)
    pg.on('pageerror',lambda e: errs.append('PE '+str(e)))
    pg.goto(URL); pg.wait_for_timeout(500)
    for mid,twin in [(sys.argv[1],sys.argv[2]=='t')]:
        pg.evaluate(f"S.mid='{mid}';S.sim=null;S.designs={{}};S.twin={str(twin).lower()};S.hist=[];go('ms')")
        if twin: pg.evaluate("setDesign(N.optimize(design('A'),M_(),{iters:500,seed:2}).design,'B')")
        pg.wait_for_timeout(5000); pg.evaluate("S.ms.si=1"); pg.wait_for_timeout(3000)
        pg.screenshot(path=f'capturas/run_{mid}{"_t" if twin else ""}.png'); pg.evaluate("S.ms.si=3")
        shot=False
        for i in range(400):
            pg.wait_for_timeout(250)
            if pg.evaluate("!!document.querySelector('.evb.rec')"):
                if not shot: pg.screenshot(path=f'capturas/ev_{mid}.png'); shot=True
                pg.evaluate("document.querySelector('.evb.rec').click()")
            if pg.evaluate("S.sim.over && (!S.simB || S.simB.over)"): break
        pg.wait_for_timeout(500); pg.screenshot(path=f'capturas/done_{mid}{"_t" if twin else ""}.png')
        print(mid,twin,pg.evaluate("[S.sim.status,S.sim.day,+S.sim.result.S.toFixed(1),S.sim.events.length, S.simB&&S.simB.status]"))
        pg.evaluate("go('ma')"); pg.wait_for_timeout(600); pg.screenshot(path=f'capturas/ma_{mid}{"_t" if twin else ""}.png',full_page=True)
    pg.evaluate("S.lang='en';go('ma')"); pg.wait_for_timeout(400); pg.screenshot(path='capturas/ma_en.png')
    b.close()
print(errs)
