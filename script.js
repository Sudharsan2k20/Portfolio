(() => {
  const root = document.documentElement;
  const reduce = matchMedia('(prefers-reduced-motion: reduce)').matches;
  root.classList.add('js');

  // On refresh, always start at the top (normal links, back/forward and #anchors still behave as usual)
  const navEntry = performance.getEntriesByType && performance.getEntriesByType('navigation')[0];
  if (navEntry && navEntry.type === 'reload') {
    if ('scrollRestoration' in history) history.scrollRestoration = 'manual';
    if (location.hash) history.replaceState(null, '', location.pathname + location.search);
    scrollTo(0, 0);
    addEventListener('load', () => scrollTo(0, 0));
  }

  document.getElementById('yr').textContent = new Date().getFullYear();

  const hero = document.querySelector('.hero');
  const bar = document.getElementById('bar');
  const para = document.querySelector('[data-words]');
  const hasIO = 'IntersectionObserver' in window;

  // Run something when an element enters / leaves the screen
  const watch = (el, cb) => {
    if (!el || !hasIO) return;
    new IntersectionObserver((entries) => cb(entries[entries.length - 1].isIntersecting)).observe(el);
  };

  // Pause endless CSS animations while they are off screen
  let heroVisible = true;
  watch(hero, (on) => { heroVisible = on; hero.classList.toggle('off', !on); });
  const field = document.querySelector('.float-field');
  watch(field, (on) => field.classList.toggle('off', !on));

  // Rotating word in the hero headline
  const rot = document.getElementById('rot');
  const words = ['test', 'build', 'debug'];
  let w = 0;
  if (!reduce) {
    setInterval(() => {
      if (document.hidden || !heroVisible) return;
      rot.classList.add('out');
      setTimeout(() => {
        w = (w + 1) % words.length;
        rot.textContent = words[w];
        rot.classList.remove('out');
      }, 350);
    }, 2200);
  }

  // Apple-style paragraph: words light up as you scroll
  const frag = document.createDocumentFragment();
  const spans = para.textContent.trim().split(/\s+/).map((t) => {
    const s = document.createElement('span');
    s.textContent = t + ' ';
    frag.appendChild(s);
    return s;
  });
  para.textContent = '';
  para.appendChild(frag);
  let lit = 0;
  const setLit = (n) => {
    if (n === lit) return;
    if (n > lit) for (let i = lit; i < n; i++) spans[i].classList.add('on');
    else for (let i = n; i < lit; i++) spans[i].classList.remove('on');
    lit = n;
  };

  // Count-up numbers
  const countIO = hasIO && new IntersectionObserver((entries) => {
    entries.forEach((e) => {
      if (!e.isIntersecting) return;
      const el = e.target, end = +el.dataset.count, suffix = el.dataset.count === '3' ? '+' : '';
      countIO.unobserve(el);
      if (reduce) { el.textContent = end + suffix; return; }
      const start = performance.now();
      const tick = (t) => {
        const p = Math.min((t - start) / 1200, 1);
        el.textContent = Math.round(end * (1 - Math.pow(1 - p, 3))) + (p === 1 ? suffix : '');
        if (p < 1) requestAnimationFrame(tick);
      };
      requestAnimationFrame(tick);
    });
  }, { threshold: 0.6 });
  document.querySelectorAll('[data-count]').forEach((el) => {
    if (countIO) countIO.observe(el); else el.textContent = el.dataset.count + (el.dataset.count === '3' ? '+' : '');
  });

  // Scroll-scrubbed reveal: content appears gradually as you scroll,
  // so a slow scroll reveals it slowly. Items in a group arrive one after another.
  ['.stats', '.chips', '.tiles', '.float-field', '.pay'].forEach((sel) => {
    const g = document.querySelector(sel);
    if (!g) return;
    g.classList.remove('reveal');
    [...g.children].forEach((c) => c.classList.add('reveal'));
  });
  const items = [...document.querySelectorAll('.reveal')].map((el) => ({
    el,
    fi: el.classList.contains('fi'),
    delay: Math.min([...el.parentElement.children].filter((c) => c.classList.contains('reveal')).indexOf(el) * 0.09, 0.6),
    p: -1,
    done: false,
  }));
  const tops = new Float32Array(items.length);
  const ease = (x) => 1 - Math.pow(1 - x, 3);

  const paint = (it, p) => {
    const el = it.el;
    if (p >= 0.999) {
      if (!it.done) {
        it.done = true; it.p = 1;
        el.style.opacity = ''; el.style.transform = ''; el.style.scale = '';
        el.classList.add('done');
      }
      return;
    }
    if (it.done) { it.done = false; el.classList.remove('done'); }
    if (Math.abs(p - it.p) < 0.004) return;
    it.p = p;
    el.style.opacity = p;
    if (it.fi) el.style.scale = 0.5 + 0.5 * p;
    else el.style.transform = 'translate3d(0,' + ((1 - p) * 44) + 'px,0) scale(' + (0.94 + 0.06 * p) + ')';
  };

  // Cached page measurements (re-measured only when the size changes, not every scroll frame)
  let vh = innerHeight, max = 0, lastHp = -1, lastBar = -1;
  const measure = () => { vh = innerHeight; max = root.scrollHeight - vh; };

  const update = () => {
    const y = scrollY;
    const atBottom = y >= max - 2;

    // 1) read everything first (one layout pass)
    for (let i = 0; i < items.length; i++) tops[i] = items[i].el.getBoundingClientRect().top;
    const pr = para.getBoundingClientRect();

    // 2) then write
    const b = max > 0 ? Math.round((y / max) * 1000) / 1000 : 0;
    if (b !== lastBar) { lastBar = b; bar.style.transform = 'scaleX(' + b + ')'; }

    // hero eases away as you scroll down
    if (!reduce) {
      const hp = Math.round(Math.min(y / (vh * 0.8), 1) * 200) / 200;
      if (hp !== lastHp) {
        lastHp = hp;
        hero.style.opacity = String(1 - hp);
        hero.style.transform = 'translate3d(0,' + (-hp * 40) + 'px,0) scale(' + (1 - hp * 0.05) + ')';
      }
    }

    // reveal items (progress 0 at the bottom edge of the screen, 1 a bit higher up)
    for (let i = 0; i < items.length; i++) {
      const it = items[i];
      let p = reduce ? 1 : (vh * 0.96 - tops[i]) / (vh * 0.28) - it.delay;
      if (atBottom && tops[i] < vh) p = 1;
      paint(it, ease(Math.min(Math.max(p, 0), 1)));
    }

    // words light up in the About paragraph
    const pp = Math.min(Math.max((vh * 0.85 - pr.top) / (pr.height + vh * 0.3), 0), 1);
    setLit(reduce ? spans.length : Math.round(pp * spans.length));
  };

  let ticking = false;
  const schedule = () => {
    if (ticking) return;
    ticking = true;
    requestAnimationFrame(() => { ticking = false; update(); });
  };
  const remeasure = () => { measure(); schedule(); };

  addEventListener('scroll', schedule, { passive: true });
  addEventListener('resize', remeasure);
  addEventListener('orientationchange', remeasure);
  addEventListener('load', remeasure);
  if ('ResizeObserver' in window) new ResizeObserver(remeasure).observe(document.body);
  measure();
  update();

  // Subtle 3D tilt on project cards (mouse only)
  const finePointer = matchMedia('(hover: hover) and (pointer: fine)').matches;
  if (!reduce && !root.classList.contains('lite') && finePointer) {
    document.querySelectorAll('.card').forEach((card) => {
      let box = null;
      card.addEventListener('pointerenter', () => { box = card.getBoundingClientRect(); });
      card.addEventListener('pointermove', (e) => {
        if (!card.classList.contains('done')) return;
        const b = box || (box = card.getBoundingClientRect());
        const x = (e.clientX - b.left) / b.width - 0.5, y = (e.clientY - b.top) / b.height - 0.5;
        card.style.transform = 'rotateY(' + x * 8 + 'deg) rotateX(' + -y * 8 + 'deg) translateZ(0)';
      });
      card.addEventListener('pointerleave', () => { box = null; card.style.transform = ''; });
    });
  }

  // Theme toggle: light / dark / system (remembered between visits)
  const btns = [...document.querySelectorAll('.theme button')];
  const mark = () => {
    let t = null;
    try { t = localStorage.getItem('theme'); } catch (e) {}
    const cur = (t === 'light' || t === 'dark') ? t : 'system';
    btns.forEach((b) => b.setAttribute('aria-pressed', String(b.dataset.mode === cur)));
  };
  btns.forEach((b) => b.addEventListener('click', () => {
    const m = b.dataset.mode;
    if (m === 'system') {
      root.removeAttribute('data-theme');
      try { localStorage.removeItem('theme'); } catch (e) {}
    } else {
      root.setAttribute('data-theme', m);
      try { localStorage.setItem('theme', m); } catch (e) {}
    }
    mark();
  }));
  mark();

  // Custom cursor (desktop / laptop with a mouse or trackpad only)
  if (finePointer) {
    const dot = document.createElement('div');
    const ring = document.createElement('div');
    dot.className = 'cur-dot';
    ring.className = 'cur-ring';
    dot.setAttribute('aria-hidden', 'true');
    ring.setAttribute('aria-hidden', 'true');
    document.body.append(ring, dot);
    root.classList.add('has-cursor');

    let mx = innerWidth / 2, my = innerHeight / 2, rx = mx, ry = my, shown = false, raf = 0;

    // ring trails the dot smoothly, and the loop stops once it catches up (no idle work)
    const follow = () => {
      const k = reduce ? 1 : 0.2;
      rx += (mx - rx) * k;
      ry += (my - ry) * k;
      if (Math.abs(mx - rx) < 0.1 && Math.abs(my - ry) < 0.1) { rx = mx; ry = my; raf = 0; }
      else raf = requestAnimationFrame(follow);
      ring.style.transform = 'translate3d(' + rx + 'px,' + ry + 'px,0) translate(-50%,-50%)';
    };

    addEventListener('pointermove', (e) => {
      if (e.pointerType === 'touch') return;
      mx = e.clientX; my = e.clientY;
      dot.style.transform = 'translate3d(' + mx + 'px,' + my + 'px,0) translate(-50%,-50%)';
      if (!shown) { shown = true; rx = mx; ry = my; root.classList.add('cursor-on'); }
      if (!raf) raf = requestAnimationFrame(follow);
    }, { passive: true });
    document.addEventListener('mouseleave', () => root.classList.remove('cursor-on'));
    document.addEventListener('mouseenter', () => { if (shown) root.classList.add('cursor-on'); });
    addEventListener('pointerdown', () => root.classList.add('cursor-down'));
    addEventListener('pointerup', () => root.classList.remove('cursor-down'));

    // ring grows over anything clickable
    const hot = 'a, button, [role="button"], .fi';
    document.addEventListener('pointerover', (e) => {
      if (e.target.closest && e.target.closest(hot)) root.classList.add('cursor-hot');
    });
    document.addEventListener('pointerout', (e) => {
      if (e.target.closest && e.target.closest(hot)) root.classList.remove('cursor-hot');
    });
  }
})();
