/*
 * ARCANA · эфемериды (отдельный модуль, ничего не меняет в основном сайте)
 * Упрощённый расчёт положений планет по методу П. Шлайтера (точность ~1°, Луна ~0.5°).
 * Для символической работы с картой этого достаточно; для профессионального
 * астрологического анализа сверяйся с Swiss Ephemeris / астрологической программой.
 */
(function (global) {
  'use strict';
  var RAD = Math.PI / 180, DEG = 180 / Math.PI;
  function rev(x) { return x - Math.floor(x / 360) * 360; }
  function sind(x) { return Math.sin(x * RAD); }
  function cosd(x) { return Math.cos(x * RAD); }
  function atan2d(y, x) { return Math.atan2(y, x) * DEG; }

  // День от эпохи Шлайтера (1999-12-31 00:00 UT)
  function dayNumber(date) {
    return (date.getTime() - Date.UTC(1999, 11, 31, 0, 0, 0)) / 86400000;
  }
  function julianDay(date) { return date.getTime() / 86400000 + 2440587.5; }

  var ELEMENTS = {
    Mercury: function (d) { return { N: 48.3313 + 3.24587e-5 * d, i: 7.0047 + 5.0e-8 * d, w: 29.1241 + 1.01444e-5 * d, a: 0.387098, e: 0.205635 + 5.59e-10 * d, M: 168.6562 + 4.0923344368 * d }; },
    Venus:   function (d) { return { N: 76.6799 + 2.46590e-5 * d, i: 3.3946 + 2.75e-8 * d, w: 54.8910 + 1.38374e-5 * d, a: 0.723330, e: 0.006773 - 1.302e-9 * d, M: 48.0052 + 1.6021302244 * d }; },
    Mars:    function (d) { return { N: 49.5574 + 2.11081e-5 * d, i: 1.8497 - 1.78e-8 * d, w: 286.5016 + 2.92961e-5 * d, a: 1.523688, e: 0.093405 + 2.516e-9 * d, M: 18.6021 + 0.5240207766 * d }; },
    Jupiter: function (d) { return { N: 100.4542 + 2.76854e-5 * d, i: 1.3030 - 1.557e-7 * d, w: 273.8777 + 1.64505e-5 * d, a: 5.20256, e: 0.048498 + 4.469e-9 * d, M: 19.8950 + 0.0830853001 * d }; },
    Saturn:  function (d) { return { N: 113.6634 + 2.38980e-5 * d, i: 2.4886 - 1.081e-7 * d, w: 339.3939 + 2.97661e-5 * d, a: 9.55475, e: 0.055546 - 9.499e-9 * d, M: 316.9670 + 0.0334442282 * d }; },
    Uranus:  function (d) { return { N: 74.0005 + 1.3978e-5 * d, i: 0.7733 + 1.9e-8 * d, w: 96.6612 + 3.0565e-5 * d, a: 19.18171 - 1.55e-8 * d, e: 0.047318 + 7.45e-9 * d, M: 142.5905 + 0.011725806 * d }; },
    Neptune: function (d) { return { N: 131.7806 + 3.0173e-5 * d, i: 1.7700 - 2.55e-7 * d, w: 272.8461 - 6.027e-6 * d, a: 30.05826 + 3.313e-8 * d, e: 0.008606 + 2.15e-9 * d, M: 260.2471 + 0.005995147 * d }; }
  };

  function solveKepler(M, e) {
    var E = M + DEG * e * sind(M) * (1 + e * cosd(M));
    for (var k = 0; k < 6; k++) {
      var dE = (E - DEG * e * sind(E) - M) / (1 - e * cosd(E));
      E -= dE;
      if (Math.abs(dE) < 1e-6) break;
    }
    return E;
  }

  function helio(el) {
    var M = rev(el.M), E = solveKepler(M, el.e);
    var xv = el.a * (cosd(E) - el.e), yv = el.a * Math.sqrt(1 - el.e * el.e) * sind(E);
    var v = atan2d(yv, xv), r = Math.sqrt(xv * xv + yv * yv);
    var vw = v + el.w;
    return {
      x: r * (cosd(el.N) * cosd(vw) - sind(el.N) * sind(vw) * cosd(el.i)),
      y: r * (sind(el.N) * cosd(vw) + cosd(el.N) * sind(vw) * cosd(el.i)),
      z: r * (sind(vw) * sind(el.i)), r: r
    };
  }

  function sunData(d) {
    var w = 282.9404 + 4.70935e-5 * d, e = 0.016709 - 1.151e-9 * d, M = rev(356.0470 + 0.9856002585 * d);
    var E = M + DEG * e * sind(M) * (1 + e * cosd(M));
    var xv = cosd(E) - e, yv = Math.sqrt(1 - e * e) * sind(E);
    var v = atan2d(yv, xv), r = Math.sqrt(xv * xv + yv * yv);
    var lon = rev(v + w);
    return { lon: lon, r: r, xs: r * cosd(lon), ys: r * sind(lon), M: M, L: rev(M + w) };
  }

  function moonLon(d) {
    var N = rev(125.1228 - 0.0529538083 * d), i = 5.1454, w = rev(318.0634 + 0.1643573223 * d);
    var a = 60.2666, e = 0.0549, M = rev(115.3654 + 13.0649929509 * d);
    var E = solveKepler(M, e);
    var xv = a * (cosd(E) - e), yv = a * Math.sqrt(1 - e * e) * sind(E);
    var v = atan2d(yv, xv), r = Math.sqrt(xv * xv + yv * yv);
    var vw = v + w;
    var xh = r * (cosd(N) * cosd(vw) - sind(N) * sind(vw) * cosd(i));
    var yh = r * (sind(N) * cosd(vw) + cosd(N) * sind(vw) * cosd(i));
    var lon = atan2d(yh, xh);
    var sun = sunData(d), Ms = sun.M, Mm = M, Ls = sun.L, Lm = rev(N + w + M);
    var D = rev(Lm - Ls), F = rev(Lm - N);
    lon += -1.274 * sind(Mm - 2 * D) + 0.658 * sind(2 * D) - 0.186 * sind(Ms) - 0.059 * sind(2 * Mm - 2 * D)
      - 0.057 * sind(Mm - 2 * D + Ms) + 0.053 * sind(Mm + 2 * D) + 0.046 * sind(2 * D - Ms) + 0.041 * sind(Mm - Ms)
      - 0.035 * sind(D) - 0.031 * sind(Mm + Ms) - 0.015 * sind(2 * F - 2 * D) + 0.011 * sind(Mm - 4 * D);
    return rev(lon);
  }

  // Плутон — периодические члены (Meeus/Schlyter), годится на 1800–2100
  function plutoLon(d) {
    var S = 50.03 + 0.033459652 * d, P = 238.95 + 0.003968789 * d;
    var lon = 238.9508 + 0.00400703 * d
      - 19.799 * sind(P) + 19.848 * cosd(P)
      + 0.897 * sind(2 * P) - 4.956 * cosd(2 * P)
      + 0.610 * sind(3 * P) + 1.211 * cosd(3 * P)
      - 0.341 * sind(4 * P) - 0.190 * cosd(4 * P)
      + 0.128 * sind(5 * P) - 0.034 * cosd(5 * P)
      - 0.038 * sind(6 * P) + 0.031 * cosd(6 * P)
      + 0.020 * sind(S - P) - 0.010 * cosd(S - P);
    return rev(lon);
  }

  var NAMES = ['Sun', 'Moon', 'Mercury', 'Venus', 'Mars', 'Jupiter', 'Saturn', 'Uranus', 'Neptune', 'Pluto'];

  function planets(date) {
    var d = dayNumber(date), sun = sunData(d), out = {};
    out.Sun = { lon: sun.lon };
    out.Moon = { lon: moonLon(d) };
    ['Mercury', 'Venus', 'Mars', 'Jupiter', 'Saturn', 'Uranus', 'Neptune'].forEach(function (n) {
      var h = helio(ELEMENTS[n](d));
      var xg = h.x + sun.xs, yg = h.y + sun.ys;
      out[n] = { lon: rev(atan2d(yg, xg)) };
      // возмущения Юпитер—Сатурн—Уран
      var Mj = rev(19.8950 + 0.0830853001 * d), Ms = rev(316.9670 + 0.0334442282 * d), Mu = rev(142.5905 + 0.011725806 * d);
      if (n === 'Jupiter') out[n].lon = rev(out[n].lon - 0.332 * sind(2 * Mj - 5 * Ms - 67.6) - 0.056 * sind(2 * Mj - 2 * Ms + 21) + 0.042 * sind(3 * Mj - 5 * Ms + 21) - 0.036 * sind(Mj - 2 * Ms) + 0.022 * cosd(Mj - Ms) + 0.023 * sind(2 * Mj - 3 * Ms + 52) - 0.016 * sind(Mj - 5 * Ms - 69));
      if (n === 'Saturn') out[n].lon = rev(out[n].lon + 0.812 * sind(2 * Mj - 5 * Ms - 67.6) - 0.229 * cosd(2 * Mj - 4 * Ms - 2) + 0.119 * sind(Mj - 2 * Ms - 3) + 0.046 * sind(2 * Mj - 6 * Ms - 69) + 0.014 * sind(Mj - 3 * Ms + 32));
      if (n === 'Uranus') out[n].lon = rev(out[n].lon + 0.040 * sind(Ms - 2 * Mu + 6) + 0.035 * sind(Ms - 3 * Mu + 33) - 0.015 * sind(Mj - Mu + 20));
    });
    out.Pluto = { lon: plutoLon(d) };
    // Ретроградность: сравнение с положением через сутки
    var d2 = d + 0.5, d1 = d - 0.5;
    NAMES.forEach(function (n) {
      var a = planetsLonOnly(d1, n), b = planetsLonOnly(d2, n), diff = rev(b - a + 180) - 180;
      out[n].retro = diff < 0 && n !== 'Sun' && n !== 'Moon';
    });
    return out;
  }
  function planetsLonOnly(d, n) {
    // быстрый пересчёт долготы одной планеты (для определения ретроградности)
    if (n === 'Sun') return sunData(d).lon;
    if (n === 'Moon') return moonLon(d);
    if (n === 'Pluto') return plutoLon(d);
    var sun = sunData(d), h = helio(ELEMENTS[n](d));
    var lon = rev(atan2d(h.y + sun.ys, h.x + sun.xs));
    var Mj = rev(19.8950 + 0.0830853001 * d), Ms = rev(316.9670 + 0.0334442282 * d), Mu = rev(142.5905 + 0.011725806 * d);
    if (n === 'Jupiter') lon += -0.332 * sind(2 * Mj - 5 * Ms - 67.6) - 0.056 * sind(2 * Mj - 2 * Ms + 21) + 0.042 * sind(3 * Mj - 5 * Ms + 21) - 0.036 * sind(Mj - 2 * Ms) + 0.022 * cosd(Mj - Ms) + 0.023 * sind(2 * Mj - 3 * Ms + 52) - 0.016 * sind(Mj - 5 * Ms - 69);
    if (n === 'Saturn') lon += 0.812 * sind(2 * Mj - 5 * Ms - 67.6) - 0.229 * cosd(2 * Mj - 4 * Ms - 2) + 0.119 * sind(Mj - 2 * Ms - 3) + 0.046 * sind(2 * Mj - 6 * Ms - 69) + 0.014 * sind(Mj - 3 * Ms + 32);
    if (n === 'Uranus') lon += 0.040 * sind(Ms - 2 * Mu + 6) + 0.035 * sind(Ms - 3 * Mu + 33) - 0.015 * sind(Mj - Mu + 20);
    return rev(lon);
  }

  // Асцендент и MC. date — момент в UT, lat/lon в градусах (восточная долгота +)
  function angles(date, lat, lon) {
    var jd = julianDay(date), T = (jd - 2451545.0) / 36525;
    var gmst = rev(280.46061837 + 360.98564736629 * (jd - 2451545.0) + 0.000387933 * T * T - T * T * T / 38710000);
    var ramc = rev(gmst + lon);
    var eps = 23.4392911 - 0.0130042 * T;
    var mc = rev(atan2d(sind(ramc), cosd(ramc) * cosd(eps)));
    var asc = rev(atan2d(cosd(ramc), -(sind(ramc) * cosd(eps) + Math.tan(lat * RAD) * sind(eps))));
    return { asc: asc, mc: mc, ramc: ramc, eps: eps };
  }

  // Дома по системе Плацидус (для широт < 66°)
  function placidus(ramc, eps, lat) {
    var asc = angles.__ascFromRamc(ramc, eps, lat), mc = rev(atan2d(sind(ramc), cosd(ramc) * cosd(eps)));
    var cusps = new Array(13);
    cusps[1] = asc; cusps[10] = mc; cusps[4] = rev(mc + 180); cusps[7] = rev(asc + 180);
    function cusp(fracRA, offset, isUpper) {
      // итерационное решение для куспидов 11, 12, 2, 3
      var RAcusp = rev(ramc + offset), lam = RAcusp;
      for (var k = 0; k < 40; k++) {
        var dec = Math.asin(sind(eps) * sind(lam)) * DEG;
        var ad = Math.asin(Math.tan(lat * RAD) * Math.tan(dec * RAD)) * DEG;
        var next;
        if (isUpper) next = fracRA === 1 ? ramc + 30 + ad / 3 * 1 : ramc + 60 + ad / 3 * 2;
        else next = fracRA === 1 ? ramc + 120 - ad / 3 * 2 : ramc + 150 - ad / 3 * 1;
        next = rev(next);
        var newLam = rev(atan2d(sind(next), cosd(next) * cosd(eps)));
        if (Math.abs(rev(newLam - lam + 180) - 180) < 1e-6) { lam = newLam; break; }
        lam = newLam;
      }
      return lam;
    }
    cusps[11] = cusp(1, 30, true);
    cusps[12] = cusp(2, 60, true);
    cusps[2] = cusp(1, 120, false);
    cusps[3] = cusp(2, 150, false);
    cusps[5] = rev(cusps[11] + 180); cusps[6] = rev(cusps[12] + 180);
    cusps[8] = rev(cusps[2] + 180); cusps[9] = rev(cusps[3] + 180);
    return cusps;
  }
  angles.__ascFromRamc = function (ramc, eps, lat) {
    return rev(atan2d(cosd(ramc), -(sind(ramc) * cosd(eps) + Math.tan(lat * RAD) * sind(eps))));
  };

  function houseOf(lon, cusps) {
    for (var h = 1; h <= 12; h++) {
      var a = cusps[h], b = cusps[h % 12 + 1];
      var span = rev(b - a), pos = rev(lon - a);
      if (pos < span) return h;
    }
    return 1;
  }

  global.ArcanaEphemeris = { planets: planets, angles: angles, placidus: placidus, houseOf: houseOf, rev: rev, NAMES: NAMES };
})(typeof window !== 'undefined' ? window : globalThis);
