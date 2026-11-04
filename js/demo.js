/* EcoSense phone demo: a trimmed UI + system-behavior demo of the mobile app.
   Mounts into #demo. Timings are shortened so the whole flow can be seen in a few seconds.
   Shown: presence dial, sensor readings, appliance switches with simulated acknowledgment,
   auto cut-off after a vacancy countdown, push notification with undo, rooms and activity tabs. */
(function () {
  var root = document.getElementById('demo');
  if (!root) return;

  var GRACE = 10;      /* seconds of confirmed vacancy before cut-off (shortened for the demo) */
  var ACK_MS = 1050;   /* simulated command acknowledgment from the hub */

  var ICON = function (n, c) { return '<svg class="ic ' + (c || '') + '" aria-hidden="true"><use href="#i-' + n + '"/></svg>'; };
  var esc = function (s) { return String(s).replace(/[&<>"]/g, function (c) { return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]; }); };

  var APPS = [
    { id: 'light', name: 'Ceiling light', icon: 'bolt', w: 40 },
    { id: 'ac', name: 'Air conditioner', icon: 'cloud', w: 900 },
    { id: 'tv', name: 'Smart plug · TV', icon: 'plug', w: 120 }
  ];
  var OTHER_ROOMS = [
    { name: 'Bedroom', meta: 'Vacant · 2 appliances off', w: 0, on: false },
    { name: 'Kitchen', meta: 'Occupied · 1 appliance on', w: 150, on: true }
  ];

  var S;            /* state */
  var timers = [];  /* ack timeouts */
  var toastT = 0;
  var tickT = 0;

  function fresh() {
    return {
      tab: 'home',
      phase: 'occupied',        /* occupied | confirming | vacant | offline */
      count: GRACE,
      sw: { light: 'on', ac: 'on', tv: 'on' },   /* on | off | pending */
      mode: { light: 'auto', ac: 'auto', tv: 'auto' },
      saved: 0,
      unread: false,
      events: [{ t: now(), k: 'info', h: 'Demo started', p: 'Presence confirmed. All appliances on.' }]
    };
  }

  function now() {
    var d = new Date();
    return ('0' + d.getHours()).slice(-2) + ':' + ('0' + d.getMinutes()).slice(-2) + ':' + ('0' + d.getSeconds()).slice(-2);
  }
  function addEvent(k, h, p) {
    S.events.unshift({ t: now(), k: k, h: h, p: p });
    if (S.events.length > 12) S.events.pop();
  }
  function watts() {
    var w = 0;
    APPS.forEach(function (a) { if (S.sw[a.id] !== 'off') w += a.w; });
    return w;
  }
  function conf() {
    if (S.phase === 'occupied') return 100;
    if (S.phase === 'confirming') return Math.max(0, Math.round((S.count / GRACE) * 100));
    return 0;
  }

  /* ---------- markup ---------- */
  root.innerHTML =
    '<div class="d-top mono"><span><i></i>INTERACTIVE DEMO · TIMINGS SHORTENED</span><span>GRACE PERIOD ' + GRACE + ' S</span></div>' +
    '<div class="d-phone"><div class="d-screen" id="d-screen">' +
      '<div class="d-toast" id="d-toast" role="status" aria-live="polite"></div>' +
      '<div class="d-head"><span class="d-brand"><img src="assets/logo.png" alt="">EcoSense</span>' +
        '<button class="d-bell" id="d-bell" type="button" aria-label="Notifications">' + ICON('bell') + '<i id="d-dot" hidden></i></button></div>' +
      '<div class="d-scroll" id="d-scroll"><div class="d-page" id="d-page"></div></div>' +
      '<nav class="d-nav" aria-label="Demo app navigation">' +
        '<button type="button" data-tab="home">' + ICON('home') + 'Home</button>' +
        '<button type="button" data-tab="rooms">' + ICON('layers') + 'Rooms</button>' +
        '<button type="button" data-tab="activity">' + ICON('clock') + 'Activity</button>' +
      '</nav>' +
    '</div></div>' +
    '<div class="d-controls">' +
      '<div class="d-seg" role="group" aria-label="Simulate the room">' +
        '<button type="button" data-sim="in" aria-pressed="true">Person in room</button>' +
        '<button type="button" data-sim="out" aria-pressed="false">Person leaves</button>' +
        '<button type="button" data-sim="off" aria-pressed="false">Hub offline</button>' +
      '</div>' +
      '<p class="d-hint mono">Try: tap <b>Person leaves</b> and watch the app confirm the room is empty, then cut power. <button class="d-reset" id="d-reset" type="button">Reset</button></p>' +
    '</div>';

  var $ = function (id) { return document.getElementById(id); };
  var page = $('d-page'), toast = $('d-toast');

  /* ---------- dial ---------- */
  function dial(pct, phase) {
    var N = 48, on = Math.round(N * pct / 100), s = '';
    var col = phase === 'confirming' ? '#D9962A' : 'var(--color-accent)';
    for (var i = 0; i < N; i++) {
      var a = (i / N) * Math.PI * 2 - Math.PI / 2, c = Math.cos(a), sn = Math.sin(a);
      s += '<line x1="' + (50 + c * 38).toFixed(2) + '" y1="' + (50 + sn * 38).toFixed(2) + '" x2="' + (50 + c * 47).toFixed(2) + '" y2="' + (50 + sn * 47).toFixed(2) +
        '" stroke="' + (i < on ? col : 'var(--color-ash)') + '" stroke-width="2.4" stroke-linecap="round"/>';
    }
    return '<div class="d-dial"><svg viewBox="0 0 100 100" aria-hidden="true">' + s + '</svg>' +
      '<div class="d-dial-core"><b>' + pct + '</b><small>CONFIDENCE %</small></div></div>';
  }

  /* ---------- pages ---------- */
  function homePage() {
    var p = S.phase, off = p === 'offline';
    var badge = { occupied: ['good', 'OCCUPIED'], confirming: ['warn', 'CONFIRMING'], vacant: ['neutral', 'VACANT'], offline: ['bad', 'OFFLINE'] }[p];
    var head = { occupied: 'Someone is here', confirming: 'Checking if empty', vacant: 'Room is empty', offline: 'No signal' }[p];
    var note = {
      occupied: 'mmWave radar detects presence. Appliances stay on.',
      confirming: 'No presence detected. Cutting power in ' + S.count + ' s unless someone returns.',
      vacant: 'Vacancy confirmed. Selected appliances were switched off.',
      offline: 'The hub stopped reporting. Controls are paused and state is unchanged.'
    }[p];
    var mm = off ? '—' : (p === 'occupied' ? 'DETECTED' : 'CLEAR');
    var door = off ? '—' : (p === 'occupied' ? 'CLOSED' : 'CLOSED');
    var plug = off ? '—' : (S.sw.tv === 'off' ? 'OFF' : (S.sw.tv === 'pending' ? 'WAIT' : 'ON'));

    var banner = '';
    if (p === 'confirming') {
      banner = '<div class="d-banner warn"><div class="d-banner-main">' + ICON('clock', 'ic-sm') + '<span>Auto cut-off in <b>' + S.count + ' s</b>. Sensor fusion needs both radar and door to agree.</span></div>' +
        '<div class="d-banner-act"><button class="d-pill" type="button" data-act="stay">I\'m still here</button></div></div>';
    } else if (off) {
      banner = '<div class="d-banner bad"><div class="d-banner-main">' + ICON('alert', 'ic-sm') + '<span>Hub offline. Reconnecting…</span></div>' +
        '<div class="d-banner-act"><button class="d-pill" type="button" data-act="online">Reconnect</button></div></div>';
    }

    var apps = APPS.map(function (a) {
      var st = S.sw[a.id], isOn = st === 'on', pend = st === 'pending';
      var sub = pend ? 'Waiting for hub…' : (isOn ? a.w + ' W · running' : 'Off');
      var chip = S.mode[a.id] === 'auto' ? '<span class="d-chip">AUTO</span>' : '<span class="d-chip manual">MANUAL</span>';
      return '<div class="d-app"><span class="d-appico' + (isOn || pend ? ' on' : '') + '">' + ICON(a.icon) + '</span>' +
        '<div class="d-appinfo"><strong>' + esc(a.name) + '</strong><small>' + sub + '</small>' + chip + '</div>' +
        '<button type="button" class="d-sw' + (pend ? ' pending' : '') + '" role="switch" aria-checked="' + isOn + '" aria-label="' + esc(a.name) + '" data-sw="' + a.id + '"' + (off || pend ? ' disabled' : '') + '></button></div>';
    }).join('');

    return '<div class="d-kicker mono"><span>HOME</span></div>' +
      '<button class="d-roombtn" type="button" data-tab="rooms">Living room ' + ICON('arrow', 'ic') + '</button>' +
      '<div class="d-sub mono"><span>Room 1 of 3</span><span class="d-conn' + (off ? ' off' : '') + '"><i></i>' + (off ? 'HUB OFFLINE' : 'HUB ONLINE') + '</span></div>' +
      '<div class="d-card"><div class="d-card-h"><span class="mono" style="color:var(--color-slate)">PRESENCE</span><span class="d-badge ' + badge[0] + '">' + badge[1] + '</span></div>' +
        '<div class="d-pres">' + dial(off ? 0 : conf(), p) + '<div class="d-sum"><span class="mono">STATUS</span><h3>' + head + '</h3><p>' + note + '</p></div></div>' +
        '<div class="d-sensors">' +
          '<div><span class="mono">' + ICON('radar', 'ic-xs') + 'MMWAVE</span><strong>' + mm + '</strong></div>' +
          '<div><span class="mono">' + ICON('door', 'ic-xs') + 'DOOR</span><strong>' + door + '</strong></div>' +
          '<div><span class="mono">' + ICON('plug', 'ic-xs') + 'PLUG</span><strong>' + plug + '</strong></div>' +
        '</div>' + banner + '</div>' +
      '<div class="d-stats"><div class="d-stat"><span class="mono">' + ICON('bolt', 'ic-xs') + 'LOAD NOW</span><b>' + watts() + '<small>W</small></b></div>' +
        '<div class="d-stat"><span class="mono">' + ICON('shield', 'ic-xs') + 'SAVED</span><b>' + S.saved + '<small>Wh</small></b></div></div>' +
      '<div class="d-sec"><h4>Appliances</h4><span class="mono">TAP TO SWITCH</span></div>' + apps;
  }

  function roomsPage() {
    var live = watts();
    var total = live + OTHER_ROOMS.reduce(function (n, r) { return n + r.w; }, 0);
    var liveMeta = { occupied: 'Occupied · live demo', confirming: 'Confirming vacancy…', vacant: 'Vacant · power cut', offline: 'Hub offline' }[S.phase];
    var rows = '<button class="d-room' + (S.phase === 'occupied' ? ' on' : '') + '" type="button" data-act="open-live"><span class="d-roomico">' + ICON('home') + '</span>' +
      '<span class="info"><strong>Living room</strong><small>' + liveMeta + '</small></span><span class="w">' + live + '<small> W</small></span></button>';
    OTHER_ROOMS.forEach(function (r, i) {
      rows += '<button class="d-room' + (r.on ? ' on' : '') + '" type="button" data-act="other" data-i="' + i + '"><span class="d-roomico">' + ICON('home') + '</span>' +
        '<span class="info"><strong>' + r.name + '</strong><small>' + r.meta + '</small></span><span class="w">' + r.w + '<small> W</small></span></button>';
    });
    return '<h2 class="d-title">Rooms</h2><p class="d-lede">Each room has its own hub, sensors and rules. The demo makes the living room live.</p>' +
      '<div class="d-sum3"><div><span class="mono">ROOMS</span><b>3</b></div><div><span class="mono">TOTAL</span><b>' + total + 'W</b></div><div><span class="mono">SAVED</span><b>' + S.saved + '</b></div></div>' + rows;
  }

  function activityPage() {
    var ev = S.events.map(function (e) {
      var ic = e.k === 'alert' ? 'alert' : (e.k === 'power' ? 'power' : 'check');
      return '<div class="d-ev"><span class="d-evico ' + e.k + '">' + ICON(ic, 'ic-sm') + '</span><div><strong>' + esc(e.h) + '</strong><p>' + esc(e.p) + '</p><span class="mono">' + e.t + '</span></div></div>';
    }).join('');
    return '<h2 class="d-title">Activity</h2><p class="d-lede">Every decision the system makes is logged with what triggered it.</p>' +
      '<div class="d-card">' + (ev || '<div class="d-empty">Nothing yet.</div>') + '</div>';
  }

  /* ---------- render ---------- */
  var lastKey = '';
  function render(force) {
    var html = S.tab === 'home' ? homePage() : (S.tab === 'rooms' ? roomsPage() : activityPage());
    var key = S.tab + html;
    var tabChanged = S.tab !== render.tab;
    if (key !== lastKey || force) {
      var sc = $('d-scroll'), top = sc.scrollTop;
      page.innerHTML = html;
      if (!tabChanged) { sc.scrollTop = top; }
      else { sc.scrollTop = 0; page.classList.remove('d-page'); void page.offsetWidth; page.classList.add('d-page'); }
      lastKey = key;
    }
    render.tab = S.tab;
    Array.prototype.forEach.call(root.querySelectorAll('.d-nav button'), function (b) {
      if (b.dataset.tab === S.tab) b.setAttribute('aria-current', 'page'); else b.removeAttribute('aria-current');
    });
    var map = { occupied: 'in', confirming: 'out', vacant: 'out', offline: 'off' };
    Array.prototype.forEach.call(root.querySelectorAll('[data-sim]'), function (b) {
      b.setAttribute('aria-pressed', String(b.dataset.sim === map[S.phase]));
    });
    $('d-dot').hidden = !S.unread;
  }

  /* ---------- notification ---------- */
  function showToast(h, p, undo) {
    toast.innerHTML = '<div class="d-toast-h mono"><span>' + ICON('bell', 'ic-xs') + 'ECOSENSE</span><span>now</span></div><strong>' + esc(h) + '</strong><p>' + esc(p) + '</p>' +
      (undo ? '<button class="d-pill" type="button" data-act="undo">Undo · turn back on</button>' : '');
    toast.classList.add('show');
    clearTimeout(toastT);
    toastT = setTimeout(function () { toast.classList.remove('show'); }, 6000);
  }

  /* ---------- system behaviour ---------- */
  function command(id, to, auto) {
    if (S.sw[id] === 'pending') return;
    S.sw[id] = 'pending';
    timers.push(setTimeout(function () {
      S.sw[id] = to;
      S.mode[id] = auto ? 'auto' : 'manual';
      render();
    }, ACK_MS));
  }

  function cutOff() {
    S.phase = 'vacant';
    var n = 0, w = 0;
    APPS.forEach(function (a) { if (S.sw[a.id] === 'on') { command(a.id, 'off', true); n++; w += a.w; } });
    S.saved += Math.round(w * 0.5);
    addEvent('power', 'Auto cut-off', n ? 'Vacancy confirmed. ' + n + ' appliance' + (n > 1 ? 's' : '') + ' switched off.' : 'Vacancy confirmed. Nothing was on.');
    S.unread = true;
    showToast('Living room is empty', n ? n + ' appliance' + (n > 1 ? 's were' : ' was') + ' switched off to save power.' : 'Nothing was left on.', n > 0);
  }

  function simulate(kind) {
    if (kind === 'in') {
      if (S.phase === 'confirming') addEvent('info', 'Presence returned', 'Countdown cancelled. No appliance was touched.');
      else if (S.phase !== 'occupied') addEvent('info', 'Presence detected', 'Radar sees someone in the room.');
      S.phase = 'occupied'; S.count = GRACE;
    } else if (kind === 'out') {
      if (S.phase === 'offline') return;
      if (S.phase === 'occupied') {
        S.phase = 'confirming'; S.count = GRACE;
        addEvent('alert', 'Presence lost', 'Radar clear. Waiting ' + GRACE + ' s to confirm.');
      }
    } else if (kind === 'off') {
      S.phase = 'offline'; S.count = GRACE;
      addEvent('alert', 'Hub offline', 'No heartbeat received. Automation paused.');
    }
    render();
  }

  function tick() {
    if (S.phase !== 'confirming') return;
    S.count -= 1;
    if (S.count <= 0) { S.count = 0; cutOff(); }
    render();
  }

  /* ---------- events ---------- */
  root.addEventListener('click', function (e) {
    var t = e.target.closest('button');
    if (!t || !root.contains(t)) return;
    if (t.dataset.tab) { S.tab = t.dataset.tab; if (S.tab === 'activity') S.unread = false; render(); return; }
    if (t.dataset.sim) { simulate(t.dataset.sim); return; }
    if (t.dataset.sw) {
      var id = t.dataset.sw, to = S.sw[id] === 'on' ? 'off' : 'on';
      command(id, to, false);
      addEvent('info', 'Manual override', APPS.filter(function (a) { return a.id === id; })[0].name + ' switched ' + to + ' from the app.');
      render(); return;
    }
    switch (t.dataset.act) {
      case 'stay': simulate('in'); break;
      case 'online': S.phase = 'occupied'; addEvent('info', 'Hub back online', 'Heartbeat restored.'); render(); break;
      case 'undo':
        APPS.forEach(function (a) { if (S.sw[a.id] === 'off') command(a.id, 'on', false); });
        addEvent('info', 'Undo from notification', 'Appliances turned back on.');
        toast.classList.remove('show'); render(); break;
      case 'open-live': S.tab = 'home'; render(); break;
      case 'other': showToast('Demo shows one live room', 'In the real app every room has its own sensors and switches.', false); break;
    }
    if (t.id === 'd-bell') { S.unread = false; S.tab = 'activity'; render(); }
    if (t.id === 'd-reset') { reset(); }
  });

  function reset() {
    timers.forEach(clearTimeout); timers = [];
    clearTimeout(toastT); toast.classList.remove('show');
    S = fresh(); lastKey = ''; render(true);
  }

  reset();
  tickT = setInterval(tick, 1000);
})();
