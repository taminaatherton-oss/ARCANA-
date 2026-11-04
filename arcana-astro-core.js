/*
 * ARCANA · ядро расчётов: натальная карта, транзиты, подбор карты дня.
 * Использует ArcanaEphemeris и ArcanaAstroData. Данные хранятся только в браузере (localStorage).
 */
(function (global) {
  'use strict';
  var D = global.ArcanaAstroData, E = global.ArcanaEphemeris;
  var KEY = 'arcana_astro_birth_v1';

  function loadBirth() {
    var b = Object.assign({}, D.BIRTH);
    try {
      var raw = localStorage.getItem(KEY);
      if (raw) Object.assign(b, JSON.parse(raw));
    } catch (e) { /* localStorage может быть недоступен */ }
    return b;
  }
  function saveBirth(b) { try { localStorage.setItem(KEY, JSON.stringify(b)); } catch (e) {} }
  function resetBirth() { try { localStorage.removeItem(KEY); } catch (e) {} }

  // Локальное время места рождения → объект Date (UT)
  function birthToUT(b) {
    var d = b.date.split('-').map(Number), t = b.time.split(':').map(Number);
    return new Date(Date.UTC(d[0], d[1] - 1, d[2], t[0] - b.tz, t[1] || 0, 0));
  }

  function signOf(lon) { return Math.floor(E.rev(lon) / 30); }
  function degIn(lon) { return E.rev(lon) % 30; }
  function fmtDeg(lon) {
    var s = D.SIGNS[signOf(lon)], x = degIn(lon), d = Math.floor(x), m = Math.round((x - d) * 60);
    if (m === 60) { d += 1; m = 0; }
    return d + '°' + (m < 10 ? '0' : '') + m + '′ ' + s.ru;
  }
  function angDiff(a, b) { var d = Math.abs(E.rev(a) - E.rev(b)); return d > 180 ? 360 - d : d; }

  function computeNatal(b) {
    var ut = birthToUT(b);
    var pl = E.planets(ut);
    var ang = E.angles(ut, b.lat, b.lon);
    var cusps = E.placidus(ang.ramc, ang.eps, b.lat);
    var bodies = {};
    D.PLANET_ORDER.forEach(function (k) {
      bodies[k] = { id: k, lon: pl[k].lon, retro: pl[k].retro, house: E.houseOf(pl[k].lon, cusps) };
    });
    bodies.Asc = { id: 'Asc', lon: ang.asc, house: 1 };
    bodies.MC = { id: 'MC', lon: ang.mc, house: 10 };
    return { birth: b, ut: ut, bodies: bodies, cusps: cusps, asc: ang.asc, mc: ang.mc };
  }

  // Аспекты внутри натальной карты
  function natalAspects(natal) {
    var ids = D.PLANET_ORDER.concat(['Asc', 'MC']), out = [];
    for (var i = 0; i < ids.length; i++) {
      for (var j = i + 1; j < ids.length; j++) {
        if ((ids[i] === 'Asc' && ids[j] === 'MC')) continue;
        var diff = angDiff(natal.bodies[ids[i]].lon, natal.bodies[ids[j]].lon);
        D.ASPECTS.forEach(function (a) {
          var orb = Math.abs(diff - a.angle);
          var lim = a.orb;
          if (ids[i] === 'Sun' || ids[i] === 'Moon' || ids[j] === 'Sun' || ids[j] === 'Moon') lim += 1;
          if (ids[i] === 'Asc' || ids[j] === 'Asc' || ids[i] === 'MC' || ids[j] === 'MC') lim -= 2;
          if (orb <= lim) out.push({ a: ids[i], b: ids[j], type: a, orb: orb });
        });
      }
    }
    return out.sort(function (x, y) { return x.orb - y.orb; });
  }

  // Распределения по стихиям и модальностям
  function balance(natal) {
    var el = { 'Огонь': 0, 'Земля': 0, 'Воздух': 0, 'Вода': 0 }, mod = { 'Кардинальный': 0, 'Фиксированный': 0, 'Мутабельный': 0 };
    var signs = {};
    ['Sun', 'Moon', 'Mercury', 'Venus', 'Mars', 'Jupiter', 'Saturn', 'Uranus', 'Neptune', 'Pluto'].forEach(function (k) {
      var s = D.SIGNS[signOf(natal.bodies[k].lon)];
      el[s.el]++; mod[s.mod]++;
      signs[s.ru] = (signs[s.ru] || []); signs[s.ru].push(k);
    });
    var stelliums = [];
    Object.keys(signs).forEach(function (k) { if (signs[k].length >= 3) stelliums.push({ sign: k, planets: signs[k] }); });
    return { el: el, mod: mod, stelliums: stelliums };
  }

  // ── Транзиты ──
  var TRANSIT_ORBS = { Moon: 4, Sun: 4, Mercury: 3, Venus: 3, Mars: 3, Jupiter: 3, Saturn: 2.5, Uranus: 2, Neptune: 2, Pluto: 2 };
  // Чем быстрее планета, тем «дневнее» её транзит; медленные дают фон на недели и не должны каждый день выбирать одну карту
  var TRANSIT_WEIGHT = { Moon: 1.0, Sun: 1.6, Mercury: 2.2, Venus: 1.9, Mars: 1.5, Jupiter: 1.6, Saturn: 1.5, Uranus: 1.3, Neptune: 1.2, Pluto: 1.2 };
  var NATAL_WEIGHT = { Sun: 3, Moon: 3, Asc: 3, MC: 2.5, Mercury: 2, Venus: 2, Mars: 2, Jupiter: 1.5, Saturn: 1.5, Uranus: 1, Neptune: 1, Pluto: 1 };

  // Полдень выбранного локального дня как «момент» карты дня — карта стабильна в течение суток
  function dayMoment(y, m, d) { return new Date(Date.UTC(y, m - 1, d, 12 - 3, 0, 0)); /* полдень по Москве */ }

  function transitsFor(date, natal) {
    var pl = E.planets(date), cusps = natal.cusps, list = [];
    D.PLANET_ORDER.forEach(function (tp) {
      var tl = pl[tp].lon;
      Object.keys(natal.bodies).forEach(function (np) {
        if (tp === np) { /* транзитная планета к своему натальному месту — тоже важно */ }
        var diff = angDiff(tl, natal.bodies[np].lon);
        D.ASPECTS.forEach(function (a) {
          var orb = Math.abs(diff - a.angle), lim = TRANSIT_ORBS[tp];
          if (orb <= lim) {
            var score = (TRANSIT_WEIGHT[tp] * NATAL_WEIGHT[np]) * Math.pow(1 - orb / (lim + 0.5), 2);
            list.push({ transit: tp, natal: np, type: a, orb: orb, score: score, retro: !!pl[tp].retro });
          }
        });
      });
    });
    list.sort(function (x, y) { return y.score - x.score; });
    return { positions: pl, aspects: list, moonHouse: E.houseOf(pl.Moon.lon, cusps), sunHouse: E.houseOf(pl.Sun.lon, cusps) };
  }

  // Выбор карты дня: сильнейший транзитный аспект к натальной карте.
  // Карта = старший аркан транзитной планеты. Если аспектов нет — аркан знака транзитной Луны.
  function pickDayCard(tr) {
    // Луна даёт фон дня; главной картой становится аспект другой планеты (Луна — только если больше ничего нет)
    var main = tr.aspects.filter(function (a) { return a.transit !== 'Moon'; })[0] || tr.aspects[0];
    var moonSign = signOf(tr.positions.Moon.lon);
    var backdrop = D.MAJORS[D.SIGNS[moonSign].tarot];
    if (!main) return { card: backdrop, backdrop: D.MAJORS[D.SIGNS[tr.moonHouse - 1].tarot], aspect: null, reason: 'moon' };
    var card = D.MAJORS[D.PLANETS[main.transit].tarot];
    if (card === backdrop) backdrop = D.MAJORS[D.SIGNS[tr.moonHouse - 1].tarot];
    return { card: card, backdrop: backdrop, aspect: main, reason: 'aspect' };
  }

  global.ArcanaAstroCore = {
    loadBirth: loadBirth, saveBirth: saveBirth, resetBirth: resetBirth, birthToUT: birthToUT,
    computeNatal: computeNatal, natalAspects: natalAspects, balance: balance,
    transitsFor: transitsFor, pickDayCard: pickDayCard, dayMoment: dayMoment,
    signOf: signOf, degIn: degIn, fmtDeg: fmtDeg, angDiff: angDiff
  };
})(window);
