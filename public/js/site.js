/* Platges de Nules — interaccions (menú, carrusels, desplegables, formularis, vídeos). Sense dependències. */
(function () {
  'use strict';
  var $$ = function (sel, root) { return Array.prototype.slice.call((root || document).querySelectorAll(sel)); };

  // Menú mòbil
  var header = document.querySelector('.site-header');
  var burger = document.querySelector('.burger');
  if (header && burger) {
    burger.addEventListener('click', function () {
      var open = header.classList.toggle('menu-open');
      burger.setAttribute('aria-expanded', open ? 'true' : 'false');
    });
    $$('.mnav a').forEach(function (a) {
      a.addEventListener('click', function () { header.classList.remove('menu-open'); burger.setAttribute('aria-expanded', 'false'); });
    });
    window.addEventListener('resize', function () {
      if (window.innerWidth >= 860 && header.classList.contains('menu-open')) { header.classList.remove('menu-open'); burger.setAttribute('aria-expanded', 'false'); }
    });
  }

  // Carrusels genèrics: [data-slider] > [data-slide], [data-prev], [data-next], [data-dot]
  $$('[data-slider]').forEach(function (s) {
    var slides = $$('[data-slide]', s), dots = $$('[data-dot]', s), i = 0;
    var cap = s.getAttribute('data-caption') ? document.querySelector(s.getAttribute('data-caption')) : null;
    var caps = null; try { caps = JSON.parse(s.getAttribute('data-caps') || 'null'); } catch (e) {}
    if (slides.length < 2) return;
    function show(n) {
      i = (n + slides.length) % slides.length;
      slides.forEach(function (el, k) { el.classList.toggle('on', k === i); el.setAttribute('aria-hidden', k === i ? 'false' : 'true'); });
      dots.forEach(function (el, k) { el.classList.toggle('on', k === i); });
      if (cap && caps) cap.textContent = caps[i] || '';
    }
    $$('[data-prev]', s).forEach(function (b) { b.addEventListener('click', function () { show(i - 1); }); });
    $$('[data-next]', s).forEach(function (b) { b.addEventListener('click', function () { show(i + 1); }); });
    dots.forEach(function (d, k) { if (d.tagName === 'BUTTON') d.addEventListener('click', function () { show(k); }); });
    show(0);
  });

  // Galeria contínua: arrossegar amb el ratolí, fletxes i teclat
  $$('[data-strip]').forEach(function (g) {
    var track = g.querySelector('[data-track]');
    if (!track) return;
    var step = function () { var it = track.querySelector('.arq-item'); var gap = parseFloat(getComputedStyle(track).columnGap) || 0; return it ? it.getBoundingClientRect().width + gap : track.clientWidth; };
    var go = function (dir) {
      var max = track.scrollWidth - track.clientWidth - 2;
      if (dir > 0 && track.scrollLeft >= max) track.scrollTo({ left: 0 });
      else if (dir < 0 && track.scrollLeft <= 2) track.scrollTo({ left: track.scrollWidth });
      else track.scrollBy({ left: dir * step() });
    };
    $$('[data-prev]', g).forEach(function (b) { b.addEventListener('click', function () { go(-1); }); });
    $$('[data-next]', g).forEach(function (b) { b.addEventListener('click', function () { go(1); }); });
    track.addEventListener('keydown', function (e) { if (e.key === 'ArrowRight') { e.preventDefault(); go(1); } if (e.key === 'ArrowLeft') { e.preventDefault(); go(-1); } });
    // Arrossegar amb el ratolí (en mòbil el desplaçament ja és natiu)
    var down = false, startX = 0, startLeft = 0, moved = 0, lastX = 0, lastT = 0, vel = 0, raf = 0;
    track.addEventListener('pointerdown', function (e) {
      if (e.pointerType !== 'mouse' || e.button !== 0) return;
      cancelAnimationFrame(raf);
      down = true; moved = 0; startX = lastX = e.clientX; startLeft = track.scrollLeft; lastT = performance.now(); vel = 0;
      track.classList.add('dragging');
      track.setPointerCapture(e.pointerId);
    });
    track.addEventListener('pointermove', function (e) {
      if (!down) return;
      var dx = e.clientX - startX; moved = Math.max(moved, Math.abs(dx));
      track.scrollLeft = startLeft - dx;
      var now = performance.now(); vel = (e.clientX - lastX) / Math.max(1, now - lastT); lastX = e.clientX; lastT = now;
    });
    var end = function () {
      if (!down) return;
      down = false;
      // inèrcia suau i després s'ajusta a la foto més pròxima
      var v = vel * 16;
      var glide = function () {
        if (Math.abs(v) < 0.5) { track.classList.remove('dragging'); return; }
        track.scrollLeft -= v; v *= 0.92; raf = requestAnimationFrame(glide);
      };
      glide();
    };
    track.addEventListener('pointerup', end);
    track.addEventListener('pointercancel', end);
    track.addEventListener('click', function (e) { if (moved > 5) { e.preventDefault(); e.stopPropagation(); } }, true);
  });

  // "Llegir més" / "Veure temes més antics"
  $$('[data-more]').forEach(function (btn) {
    var key = btn.getAttribute('data-more');
    var items = $$('[data-more-item="' + key + '"]');
    var label = btn.querySelector('[data-label]');
    btn.addEventListener('click', function () {
      var open = btn.getAttribute('aria-expanded') !== 'true';
      btn.setAttribute('aria-expanded', open ? 'true' : 'false');
      items.forEach(function (el) { el.hidden = !open; });
      if (label) label.textContent = btn.getAttribute(open ? 'data-label-less' : 'data-label-more');
    });
  });

  // Acordió de pobles (Mar Nostra): només un obert
  var accs = $$('[data-acc]');
  accs.forEach(function (btn) {
    btn.addEventListener('click', function () {
      var open = btn.getAttribute('aria-expanded') !== 'true';
      accs.forEach(function (b) {
        var on = b === btn && open;
        b.setAttribute('aria-expanded', on ? 'true' : 'false');
        var list = document.getElementById(b.getAttribute('data-acc'));
        if (list) list.hidden = !on;
      });
    });
  });

  // Formularis -> correu (mailto), com a la versió original
  $$('form[data-mailto]').forEach(function (f) {
    f.addEventListener('submit', function (e) {
      e.preventDefault();
      var v = function (n) { var el = f.elements[n]; return el ? el.value.trim() : ''; };
      var nom = (v('nom') + ' ' + v('cognoms')).trim();
      var body = 'Nom: ' + nom + '\nCorreu: ' + v('correu') + '\n\n' + v('missatge');
      var subject = f.getAttribute('data-subject') + ' — ' + (nom || 'nou missatge');
      window.location.href = 'mailto:platgesdenules@gmail.com?subject=' + encodeURIComponent(subject) + '&body=' + encodeURIComponent(body);
      var msg = f.querySelector('[data-msg]');
      if (msg) msg.textContent = f.getAttribute('data-ok');
      f.reset();
    });
  });

  // Vídeos de YouTube de fons: es carreguen després de la pàgina (no frenen la càrrega)
  function mountYT(el) {
    if (el.getAttribute('data-done')) return;
    el.setAttribute('data-done', '1');
    var ifr = document.createElement('iframe');
    ifr.src = 'https://www.youtube-nocookie.com/embed/' + el.getAttribute('data-yt') + '?' + el.getAttribute('data-yt-params');
    ifr.setAttribute('allow', 'autoplay; encrypted-media');
    ifr.setAttribute('title', 'Vídeo');
    ifr.setAttribute('tabindex', '-1');
    ifr.setAttribute('loading', 'lazy');
    ifr.setAttribute('style', el.getAttribute('data-yt-style'));
    el.parentNode.replaceChild(ifr, el);
  }
  var yts = $$('[data-yt]');
  if (yts.length) {
    var start = function () {
      yts.forEach(function (el) {
        if (el.hasAttribute('data-yt-lazy') && 'IntersectionObserver' in window) {
          var io = new IntersectionObserver(function (ents) { ents.forEach(function (en) { if (en.isIntersecting) { mountYT(el); io.disconnect(); } }); }, { rootMargin: '400px' });
          io.observe(el);
        } else mountYT(el);
      });
    };
    if (document.readyState === 'complete') setTimeout(start, 300); else window.addEventListener('load', function () { setTimeout(start, 300); });
  }
})();
