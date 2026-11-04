/*
 * ARCANA · раздел «Карта дня». ArcanaDayCard.render(container)
 * Карта подбирается по сильнейшему транзиту дня к натальной карте.
 */
(function (global) {
  'use strict';
  var D = global.ArcanaAstroData, C = global.ArcanaAstroCore, TXT = '︎';
  var MONTHS = ['января', 'февраля', 'марта', 'апреля', 'мая', 'июня', 'июля', 'августа', 'сентября', 'октября', 'ноября', 'декабря'];
  var WEEK = ['воскресенье', 'понедельник', 'вторник', 'среда', 'четверг', 'пятница', 'суббота'];

  function $(root, n) { return root.querySelector('[data-aa="' + n + '"]'); }
  function esc(s) { return String(s).replace(/[&<>"]/g, function (c) { return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]; }); }
  function gl(id) { return D.PLANETS[id] ? D.PLANETS[id].glyph + TXT : D.POINTS[id].glyph; }
  function nm(id) { return D.PLANETS[id] ? D.PLANETS[id].ru : D.POINTS[id].ru; }
  function key(y, m, d) { return y + '-' + (m < 10 ? '0' : '') + m + '-' + (d < 10 ? '0' : '') + d; }

  function cardHTML(card, label, sub) {
    return '<div class="aa-tcard-label">' + esc(label) + '</div><div class="aa-tcard-face"><div class="aa-tcard-rn">' + card.rn + '</div>' +
      '<div class="aa-tcard-star">✦</div><div class="aa-tcard-name">' + esc(card.ru) + '</div><div class="aa-tcard-en">' + esc(card.en) + '</div></div>' +
      '<p class="aa-tcard-key">' + esc(card.key) + '</p><p class="aa-tcard-sub">' + esc(sub) + '</p>';
  }

  function noteText(st) {
    var p = st.pick, lines = ['Карта дня · ' + st.dateLabel, p.card.rn + ' ' + p.card.ru + ' — ' + p.card.key + '.'];
    if (p.aspect) lines.push('Основание: транзитный ' + nm(p.aspect.transit) + ' — ' + p.aspect.type.ru + ' к натальному ' + nm(p.aspect.natal) + ' (орбис ' + p.aspect.orb.toFixed(1) + '°).');
    lines.push('Фон дня: ' + p.backdrop.ru + ' (Луна в знаке ' + D.SIGNS[C.signOf(st.tr.positions.Moon.lon)].ru + ', ' + st.tr.moonHouse + ' дом).');
    lines.push('Вопрос: ' + p.card.ask);
    return lines.join('\n');
  }

  function render(root) {
    var natal = C.computeNatal(C.loadBirth());
    var now = new Date(), state = root.__aaDay || (root.__aaDay = { y: now.getFullYear(), m: now.getMonth() + 1, d: now.getDate() });

    function draw() {
      var moment = C.dayMoment(state.y, state.m, state.d), tr = C.transitsFor(moment, natal), pick = C.pickDayCard(tr);
      var dt = new Date(state.y, state.m - 1, state.d);
      var dateLabel = WEEK[dt.getDay()] + ', ' + state.d + ' ' + MONTHS[state.m - 1] + ' ' + state.y;
      var moonSign = D.SIGNS[C.signOf(tr.positions.Moon.lon)];
      var st = { pick: pick, tr: tr, dateLabel: dateLabel };
      root.__aaNote = noteText(st);

      $(root, 'day-date').textContent = dateLabel;

      $(root, 'main-card').innerHTML = cardHTML(pick.card, 'Карта дня', pick.aspect ? 'по транзиту: ' + nm(pick.aspect.transit) : 'по Луне дня');
      $(root, 'backdrop-card').innerHTML = cardHTML(pick.backdrop, 'Фон дня', 'Луна в знаке ' + moonSign.ru);

      var why;
      if (pick.aspect) {
        var a = pick.aspect, T = D.PLANETS[a.transit];
        why = '<p>Самый сильный транзит дня: <b>' + gl(a.transit) + ' ' + esc(T.ru) + '</b> (' + esc(T.key) + ') образует <b>' + esc(a.type.ru) + '</b> к твоей натальной точке <b>' + gl(a.natal) + ' ' + esc(nm(a.natal)) + '</b> (' + esc((D.PLANETS[a.natal] || D.POINTS[a.natal]).key) + '). Орбис — ' + a.orb.toFixed(1) + '°' + (a.retro ? ', планета ретроградна' : '') + '.</p>' +
          '<p>Здесь ' + esc(D.ASPECT_TEXT[a.type.tone]) + '. Аркан <b>' + esc(pick.card.ru) + '</b> — соответствие планеты <b>' + esc(T.ru) + '</b> в Таро.</p>';
      } else {
        why = '<p>Заметных транзитов к натальной карте в этот день нет, поэтому карта выбрана по знаку транзитной Луны.</p>';
      }
      why += '<p>Фон дня: Луна в знаке «' + esc(moonSign.ru) + '» проходит через твой <b>' + tr.moonHouse + ' дом</b> — ' + esc(D.HOUSES[tr.moonHouse]) + '. Эмоциональный акцент дня — в этой сфере. Тень карты, на которую стоит смотреть: ' + esc(pick.card.shadow) + '.</p>';
      $(root, 'reason').innerHTML = why;

      $(root, 'question').innerHTML = '<p class="aa-q">«' + esc(pick.card.ask) + '»</p>';

      var oth = tr.aspects.filter(function (x) { return x !== pick.aspect; }).slice(0, 6), oh = '';
      if (oth.length) {
        oh = '<ul class="aa-list">' + oth.map(function (x) {
          return '<li><span class="aa-asp-glyph" style="color:' + x.type.color + '">' + x.type.glyph + TXT + '</span> ' + gl(x.transit) + ' ' + esc(nm(x.transit)) + ' ' + esc(x.type.ru) + ' ' + gl(x.natal) + ' ' + esc(nm(x.natal)) + ' <span class="aa-muted">орбис ' + x.orb.toFixed(1) + '°</span></li>';
        }).join('') + '</ul>';
      } else oh = '<p class="aa-muted">Других заметных транзитов нет — день спокойный.</p>';
      $(root, 'other-transits').innerHTML = oh;

      var sk = '<thead><tr><th></th><th>Тело</th><th>Положение</th><th>Дом в твоей карте</th></tr></thead><tbody>';
      D.PLANET_ORDER.forEach(function (k) {
        var p = tr.positions[k];
        sk += '<tr><td class="aa-g">' + gl(k) + '</td><td>' + esc(nm(k)) + '</td><td>' + esc(C.fmtDeg(p.lon)) + (p.retro ? ' <span class="aa-retro">℞</span>' : '') + '</td><td>' + global.ArcanaEphemeris.houseOf(p.lon, natal.cusps) + '</td></tr>';
      });
      $(root, 'sky-table').innerHTML = sk + '</tbody>';
    }

    function shift(n) { var d = new Date(state.y, state.m - 1, state.d + n); state.y = d.getFullYear(); state.m = d.getMonth() + 1; state.d = d.getDate(); draw(); }
    $(root, 'day-prev').onclick = function () { shift(-1); };
    $(root, 'day-next').onclick = function () { shift(1); };
    $(root, 'day-today').onclick = function () { var n = new Date(); state.y = n.getFullYear(); state.m = n.getMonth() + 1; state.d = n.getDate(); draw(); };
    $(root, 'copy-note').onclick = function () {
      var done = function () { var c = $(root, 'copied'); c.hidden = false; setTimeout(function () { c.hidden = true; }, 1800); };
      if (navigator.clipboard && navigator.clipboard.writeText) navigator.clipboard.writeText(root.__aaNote).then(done, function () { fallback(); });
      else fallback();
      function fallback() { var t = document.createElement('textarea'); t.value = root.__aaNote; document.body.appendChild(t); t.select(); try { document.execCommand('copy'); done(); } catch (e) {} t.remove(); }
    };
    draw();
  }

  global.ArcanaDayCard = { render: render };
})(window);
