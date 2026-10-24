/* ===========================================================================
   Fiete Flitzer – gelaende.js
   ---------------------------------------------------------------------------
   Erzeugt die Strecke: ein Höhenprofil y(x) aus Rauschen + Bau-Elementen
   (Schanzen, Buckel, Steilhänge, Täler) und verteilt darauf Münzen,
   Benzinkanister, Deko und Meter-Schilder.

   Ablauf pro Abtastpunkt (alle 0,5 m):
     1. Rohhöhe   = große Hügel + kleine Wellen + Trend + Bau-Elemente
     2. Slew-Rate-Begrenzer: Steigung höchstens maxAuf, Gefälle höchstens maxAb
        (garantiert, dass jeder Berg mit genug Kraft/Grip befahrbar bleibt)
     3. Zweifacher Tiefpass 1. Ordnung (wie ein RC-Glied) rundet Kanten ab
   Alles ist deterministisch (Seed) – dasselbe Level sieht immer gleich aus.

   Kein Browser nötig: wird auch von werkzeuge/testfahrt.js (Node) benutzt.
   =========================================================================== */

var FF = globalThis.FF = globalThis.FF || {};

(function () {
  "use strict";

  /* ---------- Zufall mit Seed (mulberry32) ---------- */
  function zufallsQuelle(seed) {
    var a = seed >>> 0;
    return function () {
      a = (a + 0x6D2B79F5) | 0;
      var t = Math.imul(a ^ (a >>> 15), 1 | a);
      t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
      return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
    };
  }

  /* Ganzzahl-Hash → 0..1 (für das Werte-Rauschen) */
  function hash01(i, seed) {
    var h = (Math.imul(i, 374761393) + Math.imul(seed, 668265263)) | 0;
    h = Math.imul(h ^ (h >>> 13), 1274126177);
    h ^= h >>> 16;
    return (h >>> 0) / 4294967296;
  }

  /* Glattes 1D-Werte-Rauschen, Ergebnis -1..1 (quintische Interpolation) */
  function rauschen(x, seed) {
    var i = Math.floor(x), f = x - i;
    var a = hash01(i, seed) * 2 - 1, b = hash01(i + 1, seed) * 2 - 1;
    var u = f * f * f * (f * (f * 6 - 15) + 10);
    return a + (b - a) * u;
  }

  function glatt(a, b, x) {          // smoothstep
    var t = Math.min(1, Math.max(0, (x - a) / (b - a)));
    return t * t * (3 - 2 * t);
  }

  var GRAD = Math.PI / 180;

  /* =========================================================================
     Gelaende
     optionen: { endlos, stufe (0..2), laenge, seed }
     ========================================================================= */
  function Gelaende(welt, optionen) {
    var C = FF.CONFIG;
    this.welt = welt;
    this.endlos = !!optionen.endlos;
    this.ziel = this.endlos ? Infinity : optionen.laenge;

    var st = C.levelStufen[this.endlos ? 1 : optionen.stufe];
    var g = welt.gelaende;
    this.p = {
      amp: g.amp * st.amp, welle: g.welle,
      holperAmp: g.holperAmp, holperWelle: g.holperWelle, trend: g.trend,
      maxAuf: (g.maxAuf + st.auf) * GRAD, maxAb: g.maxAb * GRAD,
      gewichte: { schanze: g.schanzen, buckel: g.buckel, steil: g.steil * st.steil, tal: g.taeler },
      abstand: g.abstandElemente
    };
    this.tankAbstand = welt.tankAbstand * st.tank;
    this.muenzAbstand = welt.muenzAbstand;

    this.seed = optionen.seed | 0;
    this.rnd = zufallsQuelle(this.seed * 7919 + 17);
    this.s1 = this.seed * 13 + 1; this.s2 = this.seed * 13 + 2; this.s3 = this.seed * 13 + 3;

    this.dx = 0.5;                 // Abtastabstand [m]
    this.x0 = -40;                 // erster Abtastpunkt (Anlauf hinter dem Start)
    this.h = [];                   // Höhen

    // Zustand des Generators
    this.aus = 0; this.tp1 = 0; this.tp2 = 0;
    this.elemente = [];            // aktive Bau-Elemente
    this.naechstesElement = 48 + this.rnd() * 20;

    // Inhalte
    this.muenzen = [];             // {x, y, wert, weg}
    this.tanks = [];               // {x, y, weg}
    this.deko = [];                // {x, y, emoji, groesse, kipp}
    this.schilder = [];            // {x, y, text}
    this.lippen = [];              // Schanzen-Kanten {x, hoehe, platziert}
    this.gipfel = [];              // Plateaus großer Hügel {x, platziert}
    this.muenzWertGesamt = 0;

    this.platziertBis = this.x0;
    this.naechsteMuenze = 22;
    this.naechsterTank = this.tankAbstand * (0.75 + 0.15 * this.rnd());
    this.naechsteDeko = this.x0 + 2;
    this.naechstesSchild = 100;

    this.erweitereBis(this.endlos ? 400 : this.ziel + 140);
  }

  /* x-Koordinate des letzten berechneten Punkts */
  Gelaende.prototype.xEnde = function () {
    return this.x0 + (this.h.length - 1) * this.dx;
  };

  /* Fortschrittsfaktor: Hügel werden zum Ende hin höher */
  Gelaende.prototype.fortschritt = function (x) {
    if (this.endlos) {
      var E = FF.CONFIG.endlos;
      return Math.min(E.ampMax, 0.6 + (E.ampMax - 0.6) * Math.max(0, x) / E.ampStrecke);
    }
    return 0.5 + 0.5 * Math.min(1, Math.max(0, x) / this.ziel);
  };

  /* ---------- Bau-Elemente ---------- */
  Gelaende.prototype.neuesElement = function (xs) {
    var p = this.p, r = this.rnd, f = this.fortschritt(xs);
    var w = p.gewichte, summe = w.schanze + w.buckel + w.steil + w.tal;
    var z = r() * summe, typ;
    if ((z -= w.schanze) < 0) typ = "schanze";
    else if ((z -= w.buckel) < 0) typ = "buckel";
    else if ((z -= w.steil) < 0) typ = "steil";
    else typ = "tal";

    var el = { typ: typ, xs: xs };
    if (typ === "schanze") {
      el.L = 7 + r() * 5;                        // Anlauf-Rampe
      el.H = (1.0 + r() * 1.3) * Math.min(1.4, f + 0.2);
      el.Ld = 1.4;                               // steile Kante nach der Lippe
      el.xe = xs + el.L + el.Ld;
      this.lippen.push({ x: xs + el.L, hoehe: el.H, platziert: false });
    } else if (typ === "buckel") {
      el.n = 3 + Math.floor(r() * 4);
      el.P = 3.2 + r() * 2.2;
      el.A = 0.3 + r() * 0.35;
      el.xe = xs + el.n * el.P;
    } else if (typ === "steil") {
      el.H = (3 + r() * 5) * f;
      el.Lu = 1.5 * el.H / Math.tan(p.maxAuf);   // smoothstep hat 1,5-fache Maximalsteigung
      el.Lp = 6 + r() * 9;
      el.Ld = 1.5 * el.H / Math.tan(30 * GRAD);
      el.xe = xs + el.Lu + el.Lp + el.Ld;
      this.gipfel.push({ x: xs + el.Lu + el.Lp * 0.5, platziert: false });
    } else {
      el.D = (2.5 + r() * 3) * f;
      el.Ld = 1.5 * el.D / Math.tan(35 * GRAD);
      el.Lb = 4 + r() * 5;
      el.Lu = 1.5 * el.D / Math.tan(p.maxAuf);
      el.xe = xs + el.Ld + el.Lb + el.Lu;
    }
    return el;
  };

  /* Beitrag eines Elements an der Stelle x (und ob dort steiles Gefälle erlaubt ist) */
  function elementBeitrag(el, x, aus) {
    var s = x - el.xs;
    aus.steilAb = false;
    if (s < 0 || x > el.xe) return 0;
    switch (el.typ) {
      case "schanze":
        if (s <= el.L) { var q = s / el.L; return el.H * q * q; }
        aus.steilAb = true;
        return el.H * Math.max(0, 1 - (s - el.L) / el.Ld);
      case "buckel":
        var sn = Math.sin(Math.PI * s / el.P);
        return el.A * sn * sn;
      case "steil":
        if (s < el.Lu) return el.H * glatt(0, el.Lu, s);
        if (s < el.Lu + el.Lp) return el.H;
        return el.H * (1 - glatt(0, el.Ld, s - el.Lu - el.Lp));
      default: // tal
        if (s < el.Ld) return -el.D * glatt(0, el.Ld, s);
        if (s < el.Ld + el.Lb) return -el.D;
        return -el.D * (1 - glatt(0, el.Lu, s - el.Ld - el.Lb));
    }
  }

  /* ---------- Höhenprofil berechnen ---------- */
  Gelaende.prototype.erweitereBis = function (xBis) {
    var p = this.p, dx = this.dx, hilf = { steilAb: false };
    var alpha = 0.4;                                   // Tiefpass-Koeffizient pro Abtastschritt
    var tanAuf = Math.tan(p.maxAuf), tanAb = Math.tan(p.maxAb), tanKante = Math.tan(68 * GRAD);
    var tanEben = Math.tan(1.5 * GRAD);

    while (this.xEnde() < xBis || this.h.length === 0) {
      var x = this.x0 + this.h.length * this.dx;

      // neue Bau-Elemente einplanen
      var zielZone = !this.endlos && x > this.ziel - 70;
      if (x >= this.naechstesElement && !zielZone) {
        var el = this.neuesElement(x);
        this.elemente.push(el);
        this.naechstesElement = el.xe + p.abstand * (0.45 + this.rnd() * 0.9);
      }

      // 1) Rohhöhe
      var start = glatt(8, 45, x);
      var A = p.amp * this.fortschritt(x) * start;
      var roh = A * (rauschen(x / p.welle, this.s1) + 0.45 * rauschen(x / (p.welle * 0.43), this.s2))
              + p.holperAmp * start * rauschen(x / p.holperWelle, this.s3)
              + p.trend * Math.max(0, x - 8) * start;
      var steilAb = false;
      for (var i = this.elemente.length - 1; i >= 0; i--) {
        var e = this.elemente[i];
        if (e.xe < x - 1) { this.elemente.splice(i, 1); continue; }
        roh += elementBeitrag(e, x, hilf);
        if (hilf.steilAb) steilAb = true;
      }

      // 2) Slew-Rate-Begrenzer
      var auf = tanAuf * dx, ab = (steilAb ? tanKante : tanAb) * dx;
      if (!this.endlos && x > this.ziel - 14) { auf = ab = tanEben * dx; }
      if (this.h.length === 0) { this.aus = roh; this.tp1 = roh; this.tp2 = roh; }
      this.aus = Math.min(this.aus + auf, Math.max(this.aus - ab, roh));

      // 3) zweifacher Tiefpass
      this.tp1 += alpha * (this.aus - this.tp1);
      this.tp2 += alpha * (this.tp1 - this.tp2);
      this.h.push(this.tp2);
    }
    this.platziereInhalte(this.xEnde() - 40);
  };

  /* ---------- Abfragen ---------- */
  Gelaende.prototype.hoeheBei = function (x) {
    var f = (x - this.x0) / this.dx;
    if (f <= 0) return this.h[0];
    var i = Math.floor(f), n = this.h.length;
    if (i >= n - 1) return this.h[n - 1];
    var t = f - i;
    return this.h[i] * (1 - t) + this.h[i + 1] * t;
  };

  Gelaende.prototype.steigungBei = function (x) {
    var f = (x - this.x0) / this.dx;
    var i = Math.max(0, Math.min(this.h.length - 2, Math.floor(f)));
    return (this.h[i + 1] - this.h[i]) / this.dx;
  };

  /* Kreis (Rad, Kopf) gegen Streckenzug. Füllt aus = {pen, nx, ny}; true bei (nahem) Kontakt.
     pen > 0: Eindringtiefe, pen < 0: Abstand (spekulativer Kontakt). */
  Gelaende.prototype.kreisKontakt = function (cx, cy, r, rand, aus) {
    var dx = this.dx, x0 = this.x0, h = this.h, n = h.length;
    var i0 = Math.max(0, Math.floor((cx - r - rand - x0) / dx) - 1);
    var i1 = Math.min(n - 2, Math.ceil((cx + r + rand - x0) / dx) + 1);
    var best = Infinity, qx = 0, qy = 0;
    for (var i = i0; i <= i1; i++) {
      var ax = x0 + i * dx, ay = h[i], bx = ax + dx, by = h[i + 1];
      var ex = bx - ax, ey = by - ay;
      var t = ((cx - ax) * ex + (cy - ay) * ey) / (ex * ex + ey * ey);
      t = t < 0 ? 0 : (t > 1 ? 1 : t);
      var px = ax + t * ex, py = ay + t * ey;
      var d2 = (cx - px) * (cx - px) + (cy - py) * (cy - py);
      if (d2 < best) { best = d2; qx = px; qy = py; }
    }
    var boden = this.hoeheBei(cx);
    var d = Math.sqrt(best);
    if (cy < boden || d < 1e-6) {
      // Mittelpunkt unter der Oberfläche (sollte praktisch nie passieren): nach oben schieben
      var s = this.steigungBei(cx), l = Math.sqrt(1 + s * s);
      aus.nx = -s / l; aus.ny = 1 / l;
      aus.pen = r + (boden - cy) / l;
      return true;
    }
    if (d > r + rand) return false;
    aus.nx = (cx - qx) / d; aus.ny = (cy - qy) / d;
    aus.pen = r - d;
    return true;
  };

  /* Punkt (Karosserie-Ecke) gegen Boden */
  Gelaende.prototype.punktKontakt = function (px, py, rand, aus) {
    var boden = this.hoeheBei(px);
    var s = this.steigungBei(px), l = Math.sqrt(1 + s * s);
    var abstand = (py - boden) / l;
    if (abstand > rand) return false;
    aus.nx = -s / l; aus.ny = 1 / l;
    aus.pen = -abstand;
    return true;
  };

  /* ---------- Münzen, Kanister, Deko, Schilder ---------- */
  Gelaende.prototype.neueMuenze = function (x, y, wert) {
    this.muenzen.push({ x: x, y: y, wert: wert, weg: false, phase: x * 0.7 });
    if (!this.endlos) this.muenzWertGesamt += wert;
  };

  Gelaende.prototype.nahAnTank = function (x, abstand) {
    for (var i = this.tanks.length - 1; i >= 0 && i >= this.tanks.length - 3; i--) {
      if (Math.abs(this.tanks[i].x - x) < abstand) return true;
    }
    return Math.abs(this.naechsterTank - x) < abstand;
  };

  Gelaende.prototype.platziereInhalte = function (bis) {
    var r = this.rnd, welt = this.welt, ende = this.endlos ? Infinity : this.ziel - 12;
    var g = welt.schwerkraft;
    bis = Math.min(bis, this.endlos ? bis : this.ziel + 120);
    if (bis <= this.platziertBis) return;

    // Benzinkanister (im Endlos-Modus werden die Abstände langsam größer)
    while (this.naechsterTank < bis && this.naechsterTank < ende - 10) {
      var xt = this.naechsterTank;
      this.tanks.push({ x: xt, y: this.hoeheBei(xt), weg: false });
      var zuwachs = this.endlos ? 1 + xt / FF.CONFIG.endlos.tankZuwachsStrecke : 1;
      this.naechsterTank += this.tankAbstand * (0.88 + 0.24 * r()) * zuwachs;
    }

    // Münz-Reihen entlang des Bodens
    while (this.naechsteMuenze < bis && this.naechsteMuenze < ende) {
      var xm = this.naechsteMuenze;
      if (this.nahAnTank(xm, 9)) { this.naechsteMuenze += 10; continue; }
      // Auf einer Kuppe (Steigung kippt von bergauf nach bergab) liegt die Reihe als
      // Bogen in der Luft – die erwischt nur, wer mit Schwung drüberhüpft.
      var kuppe = this.steigungBei(xm - 3) - this.steigungBei(xm + 7) > 0.28;
      var gold = !kuppe && r() < 0.2;
      var anzahl = gold ? 3 : 5 + Math.floor(r() * 3);
      var wert = gold ? 25 : (kuppe ? 10 : 5);
      for (var k = 0; k < anzahl; k++) {
        var x = xm + k * 1.2;
        var hoch = kuppe ? 1.2 + 1.7 * Math.sin(Math.PI * (k + 0.5) / anzahl) : 1.0;
        this.neueMuenze(x, this.hoeheBei(x) + hoch, wert);
      }
      this.naechsteMuenze += anzahl * 1.2 + this.muenzAbstand * (0.6 + 0.8 * r());
    }

    // Münz-Bögen hinter Schanzen (Wurfparabel) – nur für Mutige!
    for (var i = 0; i < this.lippen.length; i++) {
      var lp = this.lippen[i];
      if (lp.platziert || lp.x > bis - 30) continue;
      lp.platziert = true;
      if (lp.x > ende - 20) continue;
      var y0 = this.hoeheBei(lp.x) + 0.9;
      var wink = Math.atan(this.steigungBei(lp.x - 0.8));
      var v0 = Math.min(11, Math.sqrt(2 * g * 4.5) / Math.max(0.3, Math.sin(wink + 0.15)));
      var vx = v0 * Math.cos(wink + 0.1), vy = v0 * Math.sin(wink + 0.1);
      var tGipfel = vy / g, n = 0;
      for (var t = 0.18; n < 7; t += 1.3 / v0) {
        var px = lp.x + vx * t, py = y0 + vy * t - 0.5 * g * t * t;
        if (py < this.hoeheBei(px) + 1.0) break;
        var spitze = Math.abs(t - tGipfel) < 0.65 / v0 && r() < 0.6;
        this.neueMuenze(px, py, spitze ? 100 : 25);
        n++;
      }
    }

    // Große 100er-Münze auf manchem Gipfel
    for (i = 0; i < this.gipfel.length; i++) {
      var gp = this.gipfel[i];
      if (gp.platziert || gp.x > bis) continue;
      gp.platziert = true;
      if (gp.x < ende - 10 && r() < 0.65 && !this.nahAnTank(gp.x, 4)) {
        this.neueMuenze(gp.x, this.hoeheBei(gp.x) + 1.4, 100);
      }
    }

    // Deko (Bäume, Blumen …) – reine Kulisse
    while (this.naechsteDeko < bis) {
      var xd = this.naechsteDeko;
      var teile = welt.deko[Math.floor(r() * welt.deko.length)].split(":");
      this.deko.push({ x: xd, y: this.hoeheBei(xd), emoji: teile[0], groesse: (+teile[1] || 1.2) * (0.8 + 0.4 * r()),
                       kipp: (r() - 0.5) * 0.15, spiegeln: r() < 0.5 });
      this.naechsteDeko += 3 + r() * 7;
    }

    // Meter-Schilder
    while (this.naechstesSchild < bis && this.naechstesSchild < (this.endlos ? Infinity : this.ziel - 20)) {
      var xs = this.naechstesSchild;
      this.schilder.push({ x: xs, y: this.hoeheBei(xs), text: xs + " m" });
      this.naechstesSchild += 100;
    }

    this.muenzen.sort(function (a, b) { return a.x - b.x; });
    this.platziertBis = bis;
  };

  /* Altes Zeug im Endlos-Modus wegräumen (spart Speicher) */
  Gelaende.prototype.aufraeumen = function (xHinten) {
    if (!this.endlos) return;
    function filter(liste) {
      var i = 0;
      while (i < liste.length && liste[i].x < xHinten) i++;
      if (i > 0) liste.splice(0, i);
    }
    filter(this.muenzen); filter(this.tanks); filter(this.deko); filter(this.schilder);
  };

  FF.Gelaende = Gelaende;
  FF.zufallsQuelle = zufallsQuelle;
  FF.rauschen = rauschen;
})();
