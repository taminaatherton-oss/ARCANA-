/*
 * ARCANA · раздел «Натальная карта». ArcanaNatal.render(container)
 */
(function (global) {
  'use strict';
  var D = global.ArcanaAstroData, C = global.ArcanaAstroCore;
  var TXT = '︎';

  function $(root, name) { return root.querySelector('[data-aa="' + name + '"]'); }
  function esc(s) { return String(s).replace(/[&<>"]/g, function (c) { return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]; }); }
  function gl(id) { return D.PLANETS[id] ? D.PLANETS[id].glyph + TXT : D.POINTS[id].glyph; }
  function nm(id) { return D.PLANETS[id] ? D.PLANETS[id].ru : D.POINTS[id].ru; }
  function fmtDate(b) { var p = b.date.split('-'); return p[2] + '.' + p[1] + '.' + p[0]; }

  // ── Колесо ──
  function wheelSVG(natal) {
    var cx = 250, cy = 250, R = 235, Rz = 200, Rp = 168, Ri = 100, asc = natal.asc;
    function pt(lon, r) {
      var a = (180 + (lon - asc)) * Math.PI / 180;
      return [cx + r * Math.cos(a), cy - r * Math.sin(a)];
    }
    function line(l, r1, r2, cls) { var a = pt(l, r1), b = pt(l, r2); return '<line class="' + cls + '" x1="' + a[0].toFixed(1) + '" y1="' + a[1].toFixed(1) + '" x2="' + b[0].toFixed(1) + '" y2="' + b[1].toFixed(1) + '"/>'; }
    var s = '<svg viewBox="-26 -12 552 524" xmlns="http://www.w3.org/2000/svg" class="aa-wheel-svg">';
    s += '<circle class="aa-ring" cx="250" cy="250" r="' + R + '"/><circle class="aa-ring" cx="250" cy="250" r="' + Rz + '"/>' +
      '<circle class="aa-ring" cx="250" cy="250" r="' + Ri + '"/>';
    for (var i = 0; i < 12; i++) {
      s += line(i * 30, R, Rz, 'aa-tick');
      var m = pt(i * 30 + 15, (R + Rz) / 2);
      s += '<text class="aa-sign-glyph" x="' + m[0].toFixed(1) + '" y="' + m[1].toFixed(1) + '" text-anchor="middle" dominant-baseline="central">' + D.SIGNS[i].glyph + TXT + '</text>';
    }
    for (var h = 1; h <= 12; h++) {
      var cl = natal.cusps[h], axis = (h === 1 || h === 4 || h === 7 || h === 10);
      s += line(cl, Rz, Ri, axis ? 'aa-cusp aa-cusp-axis' : 'aa-cusp');
      var nxt = natal.cusps[h % 12 + 1], span = ((nxt - cl) % 360 + 360) % 360, mid = pt(cl + span / 2, (Ri + 18));
      s += '<text class="aa-house-num" x="' + mid[0].toFixed(1) + '" y="' + mid[1].toFixed(1) + '" text-anchor="middle" dominant-baseline="central">' + h + '</text>';
    }
    // аспекты
    C.natalAspects(natal).forEach(function (a) {
      if (a.a === 'Asc' || a.b === 'Asc' || a.a === 'MC' || a.b === 'MC') return;
      var p1 = pt(natal.bodies[a.a].lon, Ri - 2), p2 = pt(natal.bodies[a.b].lon, Ri - 2);
      s += '<line class="aa-aspect" stroke="' + a.type.color + '" stroke-opacity="' + (0.9 - a.orb / 12).toFixed(2) + '" x1="' + p1[0].toFixed(1) + '" y1="' + p1[1].toFixed(1) + '" x2="' + p2[0].toFixed(1) + '" y2="' + p2[1].toFixed(1) + '"/>';
    });
    // планеты (разводим подписи, чтобы не накладывались)
    var items = D.PLANET_ORDER.map(function (k) { return { id: k, lon: natal.bodies[k].lon, disp: natal.bodies[k].lon, retro: natal.bodies[k].retro }; })
      .sort(function (x, y) { return x.lon - y.lon; });
    for (var it = 0; it < 30; it++) {
      for (var i2 = 0; i2 < items.length; i2++) {
        var nx = items[(i2 + 1) % items.length], d = ((nx.disp - items[i2].disp) % 360 + 360) % 360;
        if (d < 9 && items.length > 1) { var push = (9 - d) / 2; items[i2].disp -= push; nx.disp += push; }
      }
    }
    items.forEach(function (p) {
      var a = pt(p.lon, Rz), b = pt(p.disp, Rp - 14), c = pt(p.disp, Rp);
      s += '<line class="aa-leader" x1="' + a[0].toFixed(1) + '" y1="' + a[1].toFixed(1) + '" x2="' + b[0].toFixed(1) + '" y2="' + b[1].toFixed(1) + '"/>';
      s += '<text class="aa-planet-glyph" x="' + c[0].toFixed(1) + '" y="' + c[1].toFixed(1) + '" text-anchor="middle" dominant-baseline="central">' + D.PLANETS[p.id].glyph + TXT + '</text>';
    });
    // оси
    var A = pt(natal.asc, R + 2), M = pt(natal.mc, R + 2);
    var A2 = pt(natal.asc, R + 14), M2 = pt(natal.mc, R + 14);
    s += '<text class="aa-axis-label" x="' + (A2[0] - 4).toFixed(1) + '" y="' + A2[1].toFixed(1) + '" text-anchor="end" dominant-baseline="central">Asc</text>';
    s += '<text class="aa-axis-label" x="' + M2[0].toFixed(1) + '" y="' + (M2[1] - 4).toFixed(1) + '" text-anchor="middle">MC</text>';
    s += '</svg>';
    return s;
  }

  function keyPoint(natal, id, role) {
    var b = natal.bodies[id], sg = D.SIGNS[C.signOf(b.lon)];
    return '<div class="aa-card aa-kp"><div class="aa-kp-head"><span class="aa-kp-glyph">' + gl(id) + '</span><div><div class="aa-kp-name">' + esc(nm(id)) + '</div>' +
      '<div class="aa-kp-pos">' + esc(C.fmtDeg(b.lon)) + (b.retro ? ' ℞' : '') + ' · дом ' + b.house + '</div></div></div>' +
      '<p>' + esc(role) + ' В знаке «' + esc(sg.ru) + '»: ' + esc(sg.style) + '.</p></div>';
  }

  function tarotMap(natal) {
    var picks = [['Sun', 'Солнце'], ['Moon', 'Луна'], ['Asc', 'Асцендент'], ['MC', 'MC']], out = '';
    picks.forEach(function (p) {
      var sg = D.SIGNS[C.signOf(natal.bodies[p[0]].lon)], card = D.MAJORS[sg.tarot];
      out += '<div class="aa-card aa-tm"><div class="aa-tm-rn">' + card.rn + '</div><div class="aa-tm-name">' + esc(card.ru) + '</div>' +
        '<div class="aa-tm-src">' + esc(p[1]) + ' в знаке ' + esc(sg.ru) + '</div><p>' + esc(card.key) + '.</p></div>';
    });
    // аркан управителя Асцендента
    var rulerId = D.SIGNS[C.signOf(natal.asc)].ruler, rc = D.MAJORS[D.PLANETS[rulerId].tarot];
    out += '<div class="aa-card aa-tm"><div class="aa-tm-rn">' + rc.rn + '</div><div class="aa-tm-name">' + esc(rc.ru) + '</div>' +
      '<div class="aa-tm-src">Управитель карты: ' + esc(D.PLANETS[rulerId].ru) + '</div><p>' + esc(rc.key) + '.</p></div>';
    return out;
  }

  function render(root) {
    var birth = C.loadBirth(), natal = C.computeNatal(birth), bal = C.balance(natal);

    $(root, 'birth-info').innerHTML =
      '<strong>' + esc(fmtDate(birth)) + '</strong>, ' + esc(birth.time) + (birth.timeApproximate ? ' (≈)' : '') + ' · ' + esc(birth.city) + ', ' + esc(birth.country) +
      '<br><span class="aa-muted">UTC' + (birth.tz >= 0 ? '+' : '') + birth.tz + ' · ' + birth.lat.toFixed(2) + '°N, ' + birth.lon.toFixed(2) + '°E · система домов Плацидус</span>';

    var form = $(root, 'birth-form');
    ['date', 'time', 'tz', 'lat', 'lon'].forEach(function (n) { form.elements[n].value = birth[n]; });
    form.onsubmit = function (e) {
      e.preventDefault();
      var nb = Object.assign({}, birth, { date: form.elements.date.value, time: form.elements.time.value, tz: parseFloat(form.elements.tz.value), lat: parseFloat(form.elements.lat.value), lon: parseFloat(form.elements.lon.value) });
      C.saveBirth(nb); render(root);
      document.dispatchEvent(new CustomEvent('arcana-astro:birth-changed'));
    };
    $(root, 'birth-reset').onclick = function () { C.resetBirth(); render(root); document.dispatchEvent(new CustomEvent('arcana-astro:birth-changed')); };

    $(root, 'wheel').innerHTML = wheelSVG(natal);

    $(root, 'key-points').innerHTML =
      keyPoint(natal, 'Sun', 'Ядро личности, воля.') + keyPoint(natal, 'Moon', 'Эмоции и потребность в безопасности.') +
      keyPoint(natal, 'Asc', 'Способ входить в мир, первое впечатление.') + keyPoint(natal, 'MC', 'Призвание и направление жизни.');

    var bh = '<div class="aa-bal">';
    Object.keys(bal.el).forEach(function (k) { bh += '<div class="aa-bal-row"><span>' + k + '</span><div class="aa-bar"><i style="width:' + bal.el[k] * 10 + '%"></i></div><b>' + bal.el[k] + '</b></div>'; });
    bh += '</div><div class="aa-bal">';
    Object.keys(bal.mod).forEach(function (k) { bh += '<div class="aa-bal-row"><span>' + k + '</span><div class="aa-bar"><i style="width:' + bal.mod[k] * 10 + '%"></i></div><b>' + bal.mod[k] + '</b></div>'; });
    bh += '</div>';
    if (bal.stelliums.length) {
      bh += '<p class="aa-stellium">' + bal.stelliums.map(function (s) {
        return '<b>Стеллиум в знаке «' + esc(s.sign) + '»:</b> ' + s.planets.map(function (p) { return esc(nm(p)); }).join(', ') + ' — тема этого знака заметно усилена в карте.';
      }).join('<br>') + '</p>';
    }
    $(root, 'balance').innerHTML = bh;

    var th = '<thead><tr><th></th><th>Тело</th><th>Положение</th><th>Дом</th></tr></thead><tbody>';
    D.PLANET_ORDER.concat(['Asc', 'MC']).forEach(function (k) {
      var b = natal.bodies[k];
      th += '<tr><td class="aa-g">' + gl(k) + '</td><td>' + esc(nm(k)) + '</td><td>' + esc(C.fmtDeg(b.lon)) + (b.retro ? ' <span class="aa-retro">℞</span>' : '') + '</td><td>' + b.house + '</td></tr>';
    });
    $(root, 'planet-table').innerHTML = th + '</tbody>';

    var hh = '<thead><tr><th>Дом</th><th>Куспид</th><th>Тема</th></tr></thead><tbody>';
    for (var i = 1; i <= 12; i++) hh += '<tr><td>' + i + '</td><td>' + esc(C.fmtDeg(natal.cusps[i])) + '</td><td>' + esc(D.HOUSES[i]) + '</td></tr>';
    $(root, 'house-table').innerHTML = hh + '</tbody>';

    var asp = C.natalAspects(natal).slice(0, 18), ah = '<ul class="aa-list">';
    asp.forEach(function (a) {
      ah += '<li><span class="aa-asp-glyph" style="color:' + a.type.color + '">' + a.type.glyph + TXT + '</span> <b>' + gl(a.a) + ' ' + esc(nm(a.a)) + '</b> ' + esc(a.type.ru) + ' <b>' + gl(a.b) + ' ' + esc(nm(a.b)) + '</b> <span class="aa-muted">орбис ' + a.orb.toFixed(1) + '°</span></li>';
    });
    $(root, 'aspects').innerHTML = ah + '</ul><p class="aa-note">Показаны самые точные аспекты. ' + esc(D.ASPECT_TEXT.merge.charAt(0).toUpperCase() + D.ASPECT_TEXT.merge.slice(1)) + '; гармоничные (секстиль, трин) — ' + esc(D.ASPECT_TEXT.soft) + '; напряжённые (квадрат, оппозиция) — ' + esc(D.ASPECT_TEXT.hard) + '.</p>';

    $(root, 'tarot-map').innerHTML = tarotMap(natal);
  }

  global.ArcanaNatal = { render: render };
})(window);
