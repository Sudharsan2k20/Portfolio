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

  // Rotating word in the hero headline
  const rot = document.getElementById('rot');
  const words = ['test', 'build', 'debug'];
  let w = 0;
  if (!reduce) {
    setInterval(() => {
      rot.classList.add('out');
      setTimeout(() => {
        w = (w + 1) % words.length;
        rot.textContent = words[w];
        rot.classList.remove('out');
      }, 350);
    }, 2200);
  }

  // Apple-style paragraph: words light up as you scroll
  const para = document.querySelector('[data-words]');
  const spans = para.textContent.trim().split(/\s+/).map((t) => {
    const s = document.createElement('span');
    s.textContent = t + ' ';
    return s;
  });
  para.textContent = '';
  spans.forEach((s) => para.appendChild(s));

  // Count-up numbers
  const countIO = new IntersectionObserver((entries) => {
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
  document.querySelectorAll('[data-count]').forEach((el) => countIO.observe(el));

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
    delay: Math.min([...el.parentElement.children].filter((c) => c.classList.contains('reveal')).indexOf(el) * 0.09, 0.6),
  }));
  const ease = (x) => 1 - Math.pow(1 - x, 3);
  const hero = document.querySelector('.hero');
  const bar = document.getElementById('bar');

  const update = () => {
    const vh = innerHeight;
    const max = root.scrollHeight - vh;
    const atBottom = scrollY >= max - 2;
    bar.style.transform = 'scaleX(' + (max > 0 ? scrollY / max : 0) + ')';

    // hero eases away as you scroll down
    if (!reduce) {
      const hp = Math.min(scrollY / (vh * 0.8), 1);
      hero.style.opacity = String(1 - hp);
      hero.style.transform = 'translateY(' + (-hp * 40) + 'px) scale(' + (1 - hp * 0.05) + ')';
    }

    // reveal items (progress 0 at the bottom edge of the screen, 1 a bit higher up)
    items.forEach(({ el, delay }) => {
      const top = el.getBoundingClientRect().top;
      let p = reduce ? 1 : (vh * 0.96 - top) / (vh * 0.28) - delay;
      if (atBottom && top < vh) p = 1;
      p = ease(Math.min(Math.max(p, 0), 1));
      el.style.setProperty('--p', p.toFixed(3));
      el.classList.toggle('done', p >= 0.999);
    });

    // words light up in the About paragraph
    const r = para.getBoundingClientRect();
    const pp = Math.min(Math.max((vh * 0.85 - r.top) / (r.height + vh * 0.3), 0), 1);
    const n = reduce ? spans.length : Math.round(pp * spans.length);
    spans.forEach((s, i) => s.classList.toggle('on', i < n));
  };

  let ticking = false;
  addEventListener('scroll', () => {
    if (!ticking) { ticking = true; requestAnimationFrame(() => { update(); ticking = false; }); }
  }, { passive: true });
  addEventListener('resize', update);
  addEventListener('load', update);
  update();

  // Subtle 3D tilt on project cards (mouse only)
  if (!reduce && matchMedia('(hover: hover) and (pointer: fine)').matches) {
    document.querySelectorAll('.card').forEach((card) => {
      card.addEventListener('pointermove', (e) => {
        const b = card.getBoundingClientRect();
        const x = (e.clientX - b.left) / b.width - 0.5, y = (e.clientY - b.top) / b.height - 0.5;
        card.style.transform = 'rotateY(' + x * 8 + 'deg) rotateX(' + -y * 8 + 'deg) translateZ(0)';
      });
      card.addEventListener('pointerleave', () => { card.style.transform = ''; });
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
  if (matchMedia('(hover: hover) and (pointer: fine)').matches) {
    const dot = document.createElement('div');
    const ring = document.createElement('div');
    dot.className = 'cur-dot';
    ring.className = 'cur-ring';
    dot.setAttribute('aria-hidden', 'true');
    ring.setAttribute('aria-hidden', 'true');
    document.body.append(ring, dot);
    root.classList.add('has-cursor');

    let mx = innerWidth / 2, my = innerHeight / 2, rx = mx, ry = my, shown = false;
    addEventListener('pointermove', (e) => {
      if (e.pointerType === 'touch') return;
      mx = e.clientX; my = e.clientY;
      dot.style.transform = 'translate(' + mx + 'px,' + my + 'px) translate(-50%,-50%)';
      if (!shown) { shown = true; rx = mx; ry = my; root.classList.add('cursor-on'); }
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

    // ring trails the dot smoothly
    const follow = () => {
      rx += (mx - rx) * (reduce ? 1 : 0.18);
      ry += (my - ry) * (reduce ? 1 : 0.18);
      ring.style.transform = 'translate(' + rx + 'px,' + ry + 'px) translate(-50%,-50%)';
      requestAnimationFrame(follow);
    };
    requestAnimationFrame(follow);
  }
})();
