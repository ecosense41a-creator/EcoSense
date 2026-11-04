/* Path or link to the APK. "ecosense.apk" means a file named ecosense.apk placed next to this index.html.
   A full https link to another site also works, but then the browser opens it in a new tab. */
var APK_URL = "ecosense.apk";
var APK_SAME = !/^https?:\/\//i.test(APK_URL) || APK_URL.indexOf(location.origin) === 0;

(function () {
  var $ = function (id) { return document.getElementById(id); };
  var qa = function (s, r) { return Array.prototype.slice.call((r || document).querySelectorAll(s)); };
  var reduce = window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches;

  /* ---------- APK links ---------- */
  var statusBoxes = qa('.apk-status');
  if (APK_URL) {
    qa('.js-apk-file').forEach(function (a) {
      a.setAttribute('href', APK_URL);
      if (APK_SAME) { a.setAttribute('download', 'EcoSense.apk'); }
      else { a.setAttribute('target', '_blank'); a.setAttribute('rel', 'noopener noreferrer'); }
    });
    statusBoxes.forEach(function (b) { b.classList.add('live'); });
  } else {
    qa('.js-apk-status').forEach(function (s) { s.textContent = 'APK download link not published yet'; });
  }

  /* ---------- Reveal on scroll ---------- */
  qa('.stagger').forEach(function (g) {
    Array.prototype.slice.call(g.children).forEach(function (c, i) {
      c.classList.add('rv');
      c.style.setProperty('--d', (i * 0.08) + 's');
    });
  });
  var rv = qa('.rv');
  if ('IntersectionObserver' in window) {
    var io = new IntersectionObserver(function (es) {
      es.forEach(function (e) { if (e.isIntersecting) { e.target.classList.add('in'); io.unobserve(e.target); } });
    }, { threshold: 0.1, rootMargin: '0px 0px -6% 0px' });
    rv.forEach(function (el) { io.observe(el); });
  } else {
    rv.forEach(function (el) { el.classList.add('in'); });
  }

  /* ---------- Count up ---------- */
  var counters = qa('[data-count]');
  function countUp(el) {
    var end = parseFloat(el.getAttribute('data-count'));
    var dec = parseInt(el.getAttribute('data-dec') || '0', 10);
    if (reduce) { el.textContent = end.toFixed(dec); return; }
    var t0 = null, dur = 1200;
    function step(ts) {
      if (t0 === null) t0 = ts;
      var p = Math.min(1, (ts - t0) / dur);
      var e = 1 - Math.pow(1 - p, 3);
      el.textContent = (end * e).toFixed(dec);
      if (p < 1) requestAnimationFrame(step); else el.textContent = end.toFixed(dec);
    }
    requestAnimationFrame(step);
  }
  if ('IntersectionObserver' in window) {
    var cio = new IntersectionObserver(function (es) {
      es.forEach(function (e) { if (e.isIntersecting) { countUp(e.target); cio.unobserve(e.target); } });
    }, { threshold: 0.6 });
    counters.forEach(function (c) { cio.observe(c); });
  }

  /* ---------- Header, progress, back to top ---------- */
  var hdr = $('hdr'), prog = $('prog'), btt = $('btt'), ticking = false;
  function onScroll() {
    var y = window.scrollY || document.documentElement.scrollTop;
    var h = document.documentElement.scrollHeight - window.innerHeight;
    prog.style.transform = 'scaleX(' + (h > 0 ? Math.min(1, y / h) : 0) + ')';
    hdr.classList.toggle('scrolled', y > 40);
    btt.classList.toggle('show', y > 700);
    ticking = false;
  }
  window.addEventListener('scroll', function () { if (!ticking) { ticking = true; requestAnimationFrame(onScroll); } }, { passive: true });
  onScroll();
  btt.addEventListener('click', function () { window.scrollTo({ top: 0, behavior: reduce ? 'auto' : 'smooth' }); });

  /* ---------- Mobile menu ---------- */
  var mb = $('menu-btn'), mm = $('mmenu');
  function setMenu(open) {
    mm.hidden = !open;
    mb.setAttribute('aria-expanded', open ? 'true' : 'false');
    $('menu-ic').setAttribute('href', open ? '#i-close' : '#i-menu');
  }
  mb.addEventListener('click', function () { setMenu(mm.hidden); });
  qa('a', mm).forEach(function (a) { a.addEventListener('click', function () { setMenu(false); }); });

  /* ---------- Active nav link ---------- */
  var pillLinks = qa('#pill a');
  var ids = ['why', 'how', 'features', 'build', 'team'];
  if ('IntersectionObserver' in window) {
    var nio = new IntersectionObserver(function (es) {
      es.forEach(function (e) {
        if (e.isIntersecting) {
          pillLinks.forEach(function (a) { a.setAttribute('aria-current', a.getAttribute('href') === '#' + e.target.id ? 'true' : 'false'); });
        }
      });
    }, { rootMargin: '-35% 0px -60% 0px' });
    ids.forEach(function (id) { var el = $(id); if (el) nio.observe(el); });
  }

  /* ---------- Sit-still test ---------- */
  var test = $('test');
  qa('#seg button').forEach(function (b) {
    b.addEventListener('click', function () {
      var still = b.getAttribute('data-m') === 'still';
      test.setAttribute('data-m', still ? 'still' : 'walk');
      qa('#seg button').forEach(function (x) { x.setAttribute('aria-pressed', x === b ? 'true' : 'false'); });
      $('t-pir').textContent = still ? 'Empty' : 'Occupied';
      $('t-pir-tag').textContent = still ? 'MISSED' : 'CORRECT';
      $('t-pir-tag').className = 'tag' + (still ? ' bad' : '');
      $('t-pir-p').textContent = still ? 'It sees no motion, so it would cut the power on someone who is still in the room.' : 'It sees the movement, so the lights stay on.';
      $('t-eco').textContent = 'Occupied';
      $('t-eco-p').textContent = still ? 'The radar picks up breathing, and the door has not moved, so the room stays occupied.' : 'Radar and door agree that someone is inside.';
    });
  });

  /* ---------- Feature explorer ---------- */
  var tabs = qa('#tabs .tab'), scrs = qa('.screen .scr');
  var descs = [
    'Occupancy status and confidence, plug power, energy in watt-hours and an event history, all updated in real time.',
    'Once the home is vacant, the hub turns off the plugs you configured and estimates the energy saved by each shutoff.',
    'Firebase Cloud Messaging alerts you whenever an automatic shutoff happens, so a wrong call is caught early.',
    'Tap Override and the app asks the hub to turn the plug back on. You always have the last word.',
    'Mark the home as unoccupied. A door event or confirmed presence is then logged as a possible entry and you are notified.'
  ];
  function selectTab(i, focus) {
    tabs.forEach(function (t, k) { t.setAttribute('aria-selected', k === i ? 'true' : 'false'); t.setAttribute('tabindex', k === i ? '0' : '-1'); });
    scrs.forEach(function (s, k) { s.classList.toggle('on', k === i); });
    $('feat-p').textContent = descs[i];
    if (focus) tabs[i].focus();
  }
  tabs.forEach(function (t, i) {
    t.addEventListener('click', function () { selectTab(i, false); });
    t.addEventListener('keydown', function (e) {
      if (e.key === 'ArrowDown' || e.key === 'ArrowRight') { e.preventDefault(); selectTab((i + 1) % tabs.length, true); }
      if (e.key === 'ArrowUp' || e.key === 'ArrowLeft') { e.preventDefault(); selectTab((i + tabs.length - 1) % tabs.length, true); }
    });
  });
  selectTab(0, false);

  /* phone: override switch */
  $('ov-sw').addEventListener('click', function () {
    var on = this.getAttribute('aria-checked') !== 'true';
    this.setAttribute('aria-checked', on ? 'true' : 'false');
    var d = new Date(), tm = ('0' + d.getHours()).slice(-2) + ':' + ('0' + d.getMinutes()).slice(-2);
    $('ov-state').textContent = on ? 'ON · MANUAL OVERRIDE' : 'OFF · MANUAL';
    $('ov-note').textContent = on ? 'You restored power from the app. The hub turned the plug back on.' : 'You switched the plug off from the app.';
    $('ov-last').textContent = tm;
    $('ov-trig').textContent = on ? 'manual_override' : 'manual';
  });
  /* phone: away mode switch */
  $('aw-sw').addEventListener('click', function () {
    var on = this.getAttribute('aria-checked') !== 'true';
    this.setAttribute('aria-checked', on ? 'true' : 'false');
    $('aw-note').textContent = on ? 'NO ONE SHOULD BE HOME' : 'AWAY MODE IS OFF';
    var al = $('aw-alert');
    al.className = 'alert' + (on ? '' : ' none');
    al.innerHTML = on
      ? '<svg class="ic ic-sm"><use href="#i-alert"/></svg><span><b style="font-weight:500">Possible entry.</b> The door opened at 22:14 and presence was confirmed.</span>'
      : '<svg class="ic ic-sm"><use href="#i-check"/></svg><span>Away mode is off. Door events and presence are not reported as entries.</span>';
  });

  /* ---------- Build flow ---------- */
  var flowData = [
    { ic: '#i-radar', t: 'Sensors', p: 'The LD2410C mmWave radar reports whether it detects a person and how far away they are. A reed switch on the door reports open or closed. The hub reads both every 0.5 seconds.' },
    { ic: '#i-chip', t: 'ESP32 hub', p: 'Runs the fusion on the device. It turns the radar and door readings into an occupancy confidence from 0 to 100 and decides when the room is vacant.' },
    { ic: '#i-plug', t: 'Smart plug', p: 'Receives the OFF command from the hub over the local network. It also reports power draw, so the app can show watts and estimate the energy saved.' },
    { ic: '#i-cloud', t: 'Firebase', p: 'Stores readings, occupancy status and event logs, handles sign-in, and sends push notifications to the homeowner.' },
    { ic: '#i-phone', t: 'Mobile app', p: 'Shows live status and history, receives notifications and writes override requests that the hub acts on.' }
  ];
  var nodes = qa('#flow .node');
  function selectNode(i) {
    nodes.forEach(function (n, k) { n.setAttribute('aria-pressed', k === i ? 'true' : 'false'); });
    var d = flowData[i];
    $('fd-ic').setAttribute('href', d.ic);
    $('fd-t').textContent = d.t;
    $('fd-p').textContent = d.p;
    $('fd-n').textContent = 'STAGE ' + (i + 1) + ' OF 5';
  }
  nodes.forEach(function (n, i) { n.addEventListener('click', function () { selectNode(i); }); });
  selectNode(1);

  /* ---------- Download landing view ---------- */
  var mainEl = $('main'), dlEl = $('dl-view'), dlTimer = null;
  function setDl(state) {
    clearTimeout(dlTimer);
    var st = $('dl-status');
    if (state === 'going') {
      $('dl-h1').textContent = 'Downloading…';
      $('dl-lede').textContent = 'Downloading EcoSense.apk. Your browser is saving it to your Downloads folder.';
      $('dl-warn').hidden = true;
      st.hidden = false; st.classList.remove('done');
      $('dl-status-t').textContent = 'DOWNLOADING EcoSense.apk';
      $('dl-btn-t').textContent = 'Download again';
      if (chkBtns) { chkBtns[0].setAttribute('aria-checked', 'true'); chkUpdate(); }
      dlTimer = setTimeout(function () { setDl('started'); }, 3500);
    } else if (state === 'started' && !APK_URL) {
      $('dl-h1').textContent = 'No file yet.';
      $('dl-lede').textContent = 'The APK has not been attached to this page yet. Once the team adds the link, this button will download it.';
      st.hidden = true;
      $('dl-btn-t').textContent = 'Download APK';
      $('dl-warn').hidden = false;
    } else if (state === 'started') {
      $('dl-h1').textContent = 'Download started.';
      $('dl-lede').textContent = 'Check your browser downloads or notifications, then open the file to install it. If nothing happened, press Download again.';
      st.hidden = false; st.classList.add('done');
      $('dl-status-t').textContent = 'DOWNLOAD STARTED · EcoSense.apk';
    } else {
      $('dl-h1').textContent = 'Get the app.';
      $('dl-lede').textContent = 'Download the EcoSense APK and install it on your Android phone. It takes about a minute.';
      st.hidden = true;
      $('dl-btn-t').textContent = 'Download APK';
    }
  }
  var savedY = 0, histOK = true, afterLeave = null;
  try { history.scrollRestoration = 'manual'; } catch (e) {}
  function showDl(on, go) {
    if (on === !dlEl.hidden) return;
    if (on) {
      savedY = window.scrollY;
      mainEl.hidden = true; dlEl.hidden = false;
      window.scrollTo(0, 0);
      setDl(go ? 'going' : 'idle');
      $('dl-warn').hidden = true;
    } else {
      clearTimeout(dlTimer);
      dlEl.hidden = true; mainEl.hidden = false;
      var f = afterLeave; afterLeave = null;
      window.scrollTo(0, savedY);
      if (f) f();
    }
    onScroll();
  }
  function openDl() {
    try { history.pushState({ view: 'dl' }, ''); } catch (e) { histOK = false; }
    showDl(true, true);
  }
  function closeDl() {
    if (histOK && history.state && history.state.view === 'dl') { history.back(); }
    else { showDl(false); }
  }
  window.addEventListener('popstate', function () {
    showDl(!!(history.state && history.state.view === 'dl'), false);
  });
  /* Old links that still carry #install open the landing view and the address is cleaned up */
  if (location.hash === '#install') {
    try { history.replaceState({ view: 'dl' }, '', location.pathname + location.search); } catch (e) {}
    showDl(true, false);
  }

  var chkBtns = qa('#chk button');
  function chkUpdate() {
    var n = chkBtns.filter(function (b) { return b.getAttribute('aria-checked') === 'true'; }).length;
    $('chk-n').textContent = n + ' OF 3 DONE';
    $('chk-bar').style.width = (n / 3 * 100) + '%';
    $('chk-done').hidden = n < 3;
  }
  chkBtns.forEach(function (b) {
    b.addEventListener('click', function () {
      b.setAttribute('aria-checked', b.getAttribute('aria-checked') === 'true' ? 'false' : 'true');
      chkUpdate();
    });
  });
  var dlBtn = $('dl-btn');
  if (APK_URL) {
    $('dl-note').textContent = 'Your browser saves the file to your Downloads folder.';
    dlBtn.addEventListener('click', function () {
      setDl('going');
    });
    $('dl-copy').hidden = false;
    $('dl-copy').addEventListener('click', function () {
      var b = this;
      function ok() { b.textContent = 'Link copied'; setTimeout(function () { b.textContent = 'Copy link'; }, 1800); }
      function fail() { $('dl-note').textContent = APK_URL; }
      try { navigator.clipboard.writeText(APK_URL).then(ok, fail); } catch (e) { fail(); }
    });
  } else {
    $('dl-note').textContent = 'APK download link not published yet';
    dlBtn.addEventListener('click', function (e) { e.preventDefault(); $('dl-warn').hidden = false; });
  }

  /* Menu, logo and footer links scroll without putting # in the address bar */
  qa('a[href^="#"]').forEach(function (a) {
    var h = a.getAttribute('href');
    if (h === '#install' || h.length < 2) return;
    a.addEventListener('click', function (e) {
      e.preventDefault();
      var el = h === '#top' ? null : document.getElementById(h.slice(1));
      var go = function () {
        if (h === '#top') window.scrollTo({ top: 0, behavior: reduce ? 'auto' : 'smooth' });
        else if (el) el.scrollIntoView({ behavior: reduce ? 'auto' : 'smooth', block: 'start' });
      };
      if (!dlEl.hidden) { afterLeave = function () { if (h === '#top') window.scrollTo(0, 0); else go(); }; closeDl(); }
      else { go(); }
    });
  });

  /* Every Download button on the main page starts the download and opens the landing view */
  qa('a[href="#install"]').forEach(function (a) {
    if (a.id === 'dl-btn') return;
    if (APK_URL) {
      a.setAttribute('href', APK_URL);
      if (APK_SAME) { a.setAttribute('download', 'EcoSense.apk'); }
      else { a.setAttribute('target', '_blank'); a.setAttribute('rel', 'noopener noreferrer'); }
    }
    a.addEventListener('click', function (e) {
      if (!APK_URL) e.preventDefault();
      openDl();
    });
  });
})();
