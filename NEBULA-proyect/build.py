"""Une src/ en un solo archivo dist/nebula.html (y una copia junto al proyecto).
Uso:  python build.py
"""
import os
d = os.path.dirname(os.path.abspath(__file__)); s = os.path.join(d, 'src')
r = lambda f: open(os.path.join(s, f), encoding='utf-8').read()
js = '\n'.join(r(f) for f in ['engine.js', 'ui1.js', 'ui2.js', 'ui3.js', 'ui3b.js', 'ui4.js'])
t = r('template.html').replace('/*CSS*/', r('style.css')).replace('/*JS*/', js.replace('</script>', '<\\/script>'))
os.makedirs(os.path.join(d, 'dist'), exist_ok=True)
for out in (os.path.join(d, 'dist', 'nebula.html'), os.path.join(d, 'nebula.html')):
    open(out, 'w', encoding='utf-8').write(t)
print('Listo: nebula.html', len(t) // 1024, 'KB')
