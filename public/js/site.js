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

  // Arquitectura: tres columnes sincronitzades sobre les mateixes 7 fotos
  $$('[data-arq]').forEach(function (g) {
    var cols = $$('[data-arq-col]', g), capsEl = $$('[data-arq-cap]', g), dots = $$('[data-dot]', g), pos = 0;
    var caps = []; try { caps = JSON.parse(g.getAttribute('data-caps') || '[]'); } catch (e) {}
    var n = cols.length ? $$('[data-slide]', cols[0]).length : 0;
    if (!n) return;
    function show(p) {
      pos = (p + n) % n;
      cols.forEach(function (c, ci) {
        var idx = (pos + ci) % n;
        $$('[data-slide]', c).forEach(function (el, k) { el.classList.toggle('on', k === idx); });
        if (capsEl[ci]) capsEl[ci].textContent = caps[idx] || '';
      });
      dots.forEach(function (d, k) { d.classList.toggle('on', k === pos); });
    }
    $$('[data-prev]', g).forEach(function (b) { b.addEventListener('click', function () { show(pos - 1); }); });
    $$('[data-next]', g).forEach(function (b) { b.addEventListener('click', function () { show(pos + 1); }); });
    show(0);
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
