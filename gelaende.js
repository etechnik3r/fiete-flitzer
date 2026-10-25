/* ===========================================================================
   Fiete Flitzer – gelaende.js
   ---------------------------------------------------------------------------
   Erzeugt die Strecke: ein Höhenprofil y(x) aus Rauschen + Bau-Elementen
   und verteilt darauf Münzen, Benzinkanister, Deko und Meter-Schilder.

   Bau-Elemente – jedes verlangt etwas anderes vom Fahrer:
     schanze  kleine Rampe mit Kante              → kurzer Sprung
     buckel   kleine Hubbel                        → Federung
     steil    Steilhang mit Plateau                → Schwung holen
     tal      Mulde                                → runter und wieder rauf
     berg     großer, steiler Berg mit Kuppe       → Gas dosieren (sonst Überschlag
                                                     nach hinten), oben abheben, bergab bremsen
     sprung   große Rampe, Abbruchkante, Landehang → in der Luft mit Gas/Bremse
                                                     die Nase passend zum Hang stellen
     wellen   große Wellen                         → bei Tempo hüpft das Auto, Nase halten
     klippe   Plateau mit Abbruch                  → Fall: Nase hochhalten (Gas)
     rampe    kurze Steilrampe (bis 50°)           → mit Vollgas Wheelie und Überschlag nach
                                                     hinten: Gas wegnehmen oder kurz bremsen
     kuppe    scharfe Kuppe vor steilem Abhang     → bei Tempo dreht das Auto im Flug nach vorn
                                                     (ω ≈ v/R): vorher bremsen, in der Luft Gas

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
     optionen: { endlos, stufe (0..3), laenge, seed }
     ========================================================================= */
  function Gelaende(welt, optionen) {
    var C = FF.CONFIG;
    this.welt = welt;
    this.endlos = !!optionen.endlos;
    this.ziel = this.endlos ? Infinity : optionen.laenge;

    var st = C.levelStufen[this.endlos ? 1 : optionen.stufe];
    var g = welt.gelaende, wild = Math.min(1.6, st.wild + (g.wildBasis || 0));
    this.p = {
      amp: g.amp * st.amp, welle: g.welle,
      holperAmp: g.holperAmp, holperWelle: g.holperWelle, trend: g.trend,
      // Auf rutschigem Boden wird es mit dem Level weniger steil schwerer als auf griffigem,
      // und kein Berg ist steiler, als die Reifen dort halten (µ·0,85, plus 3° für Schwung)
      maxAuf: Math.min(g.maxAuf + st.auf * Math.min(1, welt.grip), Math.atan(0.85 * welt.grip) / GRAD + 3) * GRAD,
      maxAb: (g.maxAb + st.ab) * GRAD,
      gewichte: { schanze: g.schanzen, buckel: g.buckel, steil: g.steil * st.steil, tal: g.taeler,
                  berg: g.berg * wild, sprung: g.sprung * wild, wellen: g.wellen * wild, klippe: g.klippe * wild,
                  rampe: (g.rampe || 0) * wild, kuppe: (g.kuppe || 0) * wild, stufe: (g.stufe || 0) * wild,
                  looping: (g.looping || 0) * (0.6 + wild), luecke: (g.luecke || 0) * (0.6 + wild) },
      wild: wild,
      abstand: g.abstandElemente * (1 - 0.25 * wild)
    };
    // Ausfahrt aus Tälern und Sprung-Mulden: flacher, weil man dort oft ohne Anlauf startet
    this.p.ausfahrt = Math.max(16 * GRAD, this.p.maxAuf - 7 * GRAD);
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
    this.bauplan = [];             // alle Bau-Elemente der Strecke (nur endliche Level)
    this.naechstesElement = 48 + this.rnd() * 20;

    // Inhalte
    this.muenzen = [];             // {x, y, wert, weg}
    this.tanks = [];               // {x, y, weg}
    this.raketen = [];             // 🚀 Raketen-Kanister für den Boost {x, y, weg} – nur ein, zwei pro Level
    this.deko = [];                // {x, y, emoji, groesse, spiegeln}
    this.schilder = [];            // {x, y, text}
    this.lippen = [];              // Schanzen-Kanten {x, hoehe, platziert}
    this.gipfel = [];              // Plateaus großer Hügel {x, platziert}
    this.loopings = [];            // Loopings {xc, R, …} – Kreisbahn, die das Auto von innen fährt (fahrt.js)
    this.sperrzonen = [];          // [von, bis]: dort setzt der Ballon nie ab, dort liegt kein Kanister (Grube, Looping)
    this.muenzWertGesamt = 0;

    this.platziertBis = this.x0;
    this.naechsteMuenze = 22;
    this.tankX = 0;                                // bis hierhin ist der Benzin-Aufwand verbucht
    this.tankRest = this.tankAbstand * (0.75 + 0.15 * this.rnd());   // Aufwand bis zum nächsten Kanister
    this.naechsterTank = this.tankRest;            // ungefähre Stelle des nächsten Kanisters (für die Münzen)
    this.naechsteDeko = this.x0 + 2;
    // Raketen-Kanister: eigene Zufallsquelle, damit Münzen und Kanister der Level gleich bleiben
    var X = C.regeln.extras, rr = zufallsQuelle(this.seed * 4513 + 29);
    this.raketenPlan = [];
    if (this.endlos) this.naechsteRakete = 260;
    else {
      var nR = X.raketenProLevel[optionen.stufe] || 1;
      for (var k = 0; k < nR; k++) this.raketenPlan.push(40 + (this.ziel - 90) * (k + 0.3 + 0.4 * rr()) / nR);
    }
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
  var TYPEN = ["schanze", "buckel", "steil", "tal", "berg", "sprung", "wellen", "klippe", "rampe", "kuppe", "stufe",
               "looping", "luecke"];

  Gelaende.prototype.neuesElement = function (xs) {
    var p = this.p, r = this.rnd, f = this.fortschritt(xs);
    var w = p.gewichte, summe = 0, i;
    for (i = 0; i < TYPEN.length; i++) summe += w[TYPEN[i]] || 0;
    var z = r() * summe, typ = TYPEN[TYPEN.length - 1];
    for (i = 0; i < TYPEN.length; i++) { if ((z -= w[TYPEN[i]] || 0) < 0) { typ = TYPEN[i]; break; } }
    var stark = Math.min(1.5, f + 0.2) * (0.85 + 0.3 * p.wild);   // Elemente wachsen mit Strecke und Level

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
    } else if (typ === "tal") {
      el.D = (2.5 + r() * 3) * f;
      el.Ld = 1.5 * el.D / Math.tan(35 * GRAD);
      el.Lb = 4 + r() * 5;
      el.Lu = 1.5 * el.D / Math.tan(p.ausfahrt);
      el.xe = xs + el.Ld + el.Lb + el.Lu;
    } else if (typ === "berg") {
      // großer Berg: steil hinauf (Gas dosieren!), kurze Kuppe, steil hinunter (bremsen!)
      el.H = (4.5 + r() * 4) * stark;
      el.Lu = 1.5 * el.H / Math.tan(p.maxAuf);
      el.Lp = 1.5 + r() * 2.5;
      el.Ld = 1.5 * el.H / Math.tan(Math.min(p.maxAb, p.maxAuf + 8 * GRAD));
      el.xe = xs + el.Lu + el.Lp + el.Ld;
      this.gipfel.push({ x: xs + el.Lu + el.Lp * 0.5, platziert: false });
    } else if (typ === "sprung") {
      // Rampe → Abbruchkante → langer Landehang → Mulde → wieder hinauf
      el.L = (9 + r() * 5) * (1 - 0.15 * p.wild);   // je wilder, desto steiler die Lippe
      el.H = (1.8 + r() * 1.6) * stark;
      el.Lk = 0.35 * el.H;                         // Abbruchkante (steil)
      el.D = (2.5 + r() * 3) * stark;              // so tief liegt die Mulde unter dem Start
      el.Lf = 12 + r() * 8;                        // Landehang
      el.Lb = 4 + r() * 4;
      el.Lu = 1.5 * el.D / Math.tan(p.ausfahrt);
      el.xe = xs + el.L + el.Lf + el.Lb + el.Lu;
      this.lippen.push({ x: xs + el.L, hoehe: el.H, platziert: false });
    } else if (typ === "wellen") {
      el.n = 3 + Math.floor(r() * 3);
      el.P = 11 + r() * 6;
      el.A = (0.8 + r() * 0.9) * stark;
      el.xe = xs + el.n * el.P;
    } else if (typ === "rampe") {
      // kurze Steilrampe: steiler als die normalen Berge – Gas dosieren! Auf rutschigem
      // Boden weniger steil; die Einfahrt ist rund (Le), sonst prallt man gegen eine Wand
      el.th = Math.min((38 + 12 * Math.min(1, this.welt.grip)) * GRAD, p.maxAuf + (8 + 6 * r() + 4 * p.wild) * GRAD);
      el.H = (2.0 + 2.2 * r()) * stark;
      el.Le = 5;
      el.Lr = el.H / Math.tan(el.th) + el.Le / 2;
      el.Lp = 2.5 + 3 * r();
      el.Ld = 1.5 * el.H / Math.tan(32 * GRAD);
      el.xe = xs + el.Lr + el.Lp + el.Ld;
      this.gipfel.push({ x: xs + el.Lr + el.Lp * 0.5, platziert: false });
    } else if (typ === "stufe") {
      // Stufen (wie Bordsteine/Felsstufen): das Vorderrad wird hochgeschlagen, die
      // Nase dreht nach oben – bei Tempo hebt das Auto ab und muss mit der Bremse
      // wieder gerade gestellt werden
      el.n = 1 + Math.floor(r() * 3);
      el.Hs = (0.5 + 0.5 * r()) * Math.min(1.4, stark);
      el.Ls = 7 + r() * 6;                          // Abstand der Stufen
      el.Ld = 1.5 * el.n * el.Hs / Math.tan(25 * GRAD);
      el.xe = xs + el.n * el.Ls + el.Ld;
    } else if (typ === "kuppe") {
      // scharfe Kuppe (Radius R) vor einem steilen Abhang: Wer schnell drüberfährt,
      // hebt ab und dreht sich mit ω ≈ v/R nach vorn
      var thU = (22 + 8 * r() + 4 * p.wild) * GRAD, thD = (40 + 8 * r() + 6 * p.wild) * GRAD;
      thU = Math.min(thU, p.maxAuf);
      el.Hap = (1.6 + 1.8 * r()) * stark;
      el.Dd = el.Hap + (1.5 + 3 * r()) * stark;
      el.Rc = 4 + 3 * r();
      el.tU = Math.tan(thU); el.tD = Math.tan(thD);
      el.sA = el.Hap / el.tU;                       // Spitze (ohne Rundung)
      var dK = el.Rc * Math.tan((thU + thD) / 2);   // Abstand der Rundungs-Enden von der Spitze
      el.x1 = el.sA - dK * Math.cos(thU);
      el.x2 = el.sA + dK * Math.cos(thD);
      el.cx = el.x1 + el.Rc * Math.sin(thU);
      el.cy = el.Hap - dK * Math.sin(thU) - el.Rc * Math.cos(thU);
      el.sB = el.sA + el.Dd / el.tD;                // Fuß des Abhangs
      el.tief = el.Hap - el.Dd;                     // < 0: so tief unter dem Start
      el.Lb = 3 + 0.6 * el.Dd;                      // flacher Auslauf (sonst verkeilen sich lange Autos)
      el.Lo = 1.5 * -el.tief / Math.tan(p.ausfahrt);
      el.xe = xs + el.sB + el.Lb + el.Lo;
      this.lippen.push({ x: xs + el.sA, hoehe: el.Hap, platziert: false });
    } else if (typ === "looping") {
      // Looping (ein oder zwei hintereinander) auf ebenem Boden: langer, flacher Anlauf,
      // denn oben braucht man v² > g·R – also mit Vollgas durch!
      el.flach = true;
      el.R = 4.5;
      el.n = r() < 0.3 + 0.3 * p.wild ? 2 : 1;
      el.La = 42;                                   // Anlauf
      el.abstandL = 2 * el.R + 7;                   // Abstand der Mittelpunkte beim Doppel-Looping
      el.Lflach = el.La + (el.n - 1) * el.abstandL + el.R + 14;
      el.Lo = 25;                                   // danach sanfter Übergang ins Gelände
      el.xe = xs + el.Lflach + el.Lo;
      for (var k = 0; k < el.n; k++) {
        var xc = xs + el.La + k * el.abstandL;
        this.loopings.push({ xc: xc, R: el.R, yc: null });
        this.sperrzonen.push([xc - el.R - 1, xc + el.R + 1]);
      }
    } else if (typ === "luecke") {
      // Lückensprung: Anlauf, steile Schanze, Grube, Landehang auf der anderen Seite
      el.flach = true;
      el.La = 28;
      el.Lk = 8 + 2 * r();                          // Schanze (wird zur Lippe hin steiler)
      el.H = 2.6 + 0.8 * r();
      el.G = 8 + 3 * r() + 2 * p.wild;              // Breite der Grube
      el.D = 3.5;                                   // so tief liegt der Grubenboden unter dem Anlauf
      el.Hl = el.H - 0.5;                           // Landedeck
      el.Lp = 3; el.Lf = 14;
      el.Lflach = el.La + el.Lk + el.G + el.Lp + el.Lf + 8;
      el.Lo = 25;
      el.xe = xs + el.Lflach + el.Lo;
      var xg = xs + el.La + el.Lk;
      this.sperrzonen.push([xg - 1, xg + el.G + 1]);
      this.lippen.push({ x: xg, hoehe: el.H, platziert: false });
    } else {
      // Klippe: hinauf auf ein Plateau, dann senkrecht hinunter
      el.D = (2.6 + r() * 2.6) * stark;
      el.Lu = 1.5 * el.D / Math.tan(p.ausfahrt);    // der Aufstieg ist nicht die Aufgabe, der Abbruch schon
      el.Lp = 6 + r() * 6;
      el.Ld = 0.35 * el.D;
      el.xe = xs + el.Lu + el.Lp + el.Ld;
      this.lippen.push({ x: xs + el.Lu + el.Lp, hoehe: el.D, platziert: false });
    }
    return el;
  };

  /* Beitrag eines Elements an der Stelle x (und ob dort steiles Gefälle erlaubt ist) */
  function elementBeitrag(el, x, aus) {
    var s = x - el.xs;
    aus.steilAb = false; aus.steilAuf = false;
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
      case "berg":
        if (s < el.Lu) return el.H * glatt(0, el.Lu, s);
        if (s < el.Lu + el.Lp) return el.H;
        return el.H * (1 - glatt(0, el.Ld, s - el.Lu - el.Lp));
      case "tal":
        if (s < el.Ld) return -el.D * glatt(0, el.Ld, s);
        if (s < el.Ld + el.Lb) return -el.D;
        return -el.D * (1 - glatt(0, el.Lu, s - el.Ld - el.Lb));
      case "sprung":
        if (s <= el.L) { var u = s / el.L; return el.H * u * u; }
        var sf = s - el.L;
        if (sf < el.Lf) {
          if (sf < el.Lk) aus.steilAb = true;
          var kante = el.H * Math.max(0, 1 - sf / el.Lk) * 0.55;   // Abbruchkante: gut die Hälfte fällt sofort
          return kante + (el.H * 0.45 + el.D) * (1 - glatt(0, el.Lf, sf)) - el.D;
        }
        sf -= el.Lf;
        if (sf < el.Lb) return -el.D;
        return -el.D * (1 - glatt(0, el.Lu, sf - el.Lb));
      case "wellen":
        var sw = Math.sin(Math.PI * s / el.P);
        return el.A * sw * sw;
      case "rampe":
        if (s < el.Le) return Math.tan(el.th) * s * s / (2 * el.Le);         // Steigung wächst gleichmäßig
        if (s < el.Lr) { aus.steilAuf = true; return Math.tan(el.th) * (s - el.Le / 2); }
        if (s < el.Lr + el.Lp) return el.H;
        return el.H * (1 - glatt(0, el.Ld, s - el.Lr - el.Lp));
      case "stufe":
        var k = Math.floor(s / el.Ls);
        if (k < el.n) {
          var sk = s - k * el.Ls;
          if (sk < 0.35) aus.steilAuf = true;
          return el.Hs * (k + Math.min(1, sk / 0.35));
        }
        return el.n * el.Hs * (1 - glatt(0, el.Ld, s - el.n * el.Ls));
      case "kuppe":
        if (s < el.x1) return s * el.tU;
        if (s < el.x2) { var dxk = s - el.cx; return el.cy + Math.sqrt(Math.max(0, el.Rc * el.Rc - dxk * dxk)); }
        if (s < el.sB) { aus.steilAb = true; return el.Hap - (s - el.sA) * el.tD; }
        if (s < el.sB + el.Lb) return el.tief;
        return el.tief * (1 - glatt(0, el.Lo, s - el.sB - el.Lb));
      case "looping":
        return 0;                                   // nur ebener Boden – die Kreisbahn selbst steht in loopings
      case "luecke":
        var sl = s - el.La;
        if (sl < 0) return 0;
        if (sl < el.Lk) { var ul = sl / el.Lk; if (ul > 0.6) aus.steilAuf = true; return el.H * ul * ul * (0.4 + 0.6 * ul); }
        sl -= el.Lk;
        if (sl < el.G) {                            // Grube mit steilen Wänden
          if (sl < 3) aus.steilAb = true;
          if (sl > el.G - 1.2) aus.steilAuf = true;
          return sl < 0.6 ? el.H : (sl > el.G - 0.6 ? el.Hl : -el.D);
        }
        sl -= el.G;
        if (sl < el.Lp) { aus.steilAuf = true; return el.Hl; }
        sl -= el.Lp;
        if (sl < el.Lf) return el.Hl * (1 - glatt(0, el.Lf, sl));
        return 0;
      default: // klippe
        if (s < el.Lu) return el.D * glatt(0, el.Lu, s);
        if (s < el.Lu + el.Lp) return el.D;
        aus.steilAb = true;
        return el.D * Math.max(0, 1 - (s - el.Lu - el.Lp) / el.Ld);
    }
  }

  /* ---------- Höhenprofil berechnen ---------- */
  Gelaende.prototype.erweitereBis = function (xBis) {
    var p = this.p, dx = this.dx, hilf = { steilAb: false, steilAuf: false };
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
        if (!this.endlos) this.bauplan.push(el);       // für Analyse und Tests (werkzeuge/)
        this.naechstesElement = el.xe + p.abstand * (0.45 + this.rnd() * 0.9);
      }

      // 1) Rohhöhe
      var start = glatt(8, 45, x);
      var A = p.amp * this.fortschritt(x) * start;
      var roh = this.rohRauschen(x);
      // Loopings und Lückensprünge brauchen ebenen Boden: dort ist das Rauschen eingefroren
      for (var j = 0; j < this.elemente.length; j++) {
        var ef = this.elemente[j];
        if (!ef.flach || x < ef.xs || x > ef.xe) continue;
        if (ef.basis === undefined) ef.basis = this.rohRauschen(ef.xs);
        var m = glatt(ef.xs + ef.Lflach, ef.xe, x);
        roh = ef.basis * (1 - m) + roh * m;
      }
      var steilAb = false, steilAuf = false;
      for (var i = this.elemente.length - 1; i >= 0; i--) {
        var e = this.elemente[i];
        if (e.xe < x - 1) { this.elemente.splice(i, 1); continue; }
        roh += elementBeitrag(e, x, hilf);
        if (hilf.steilAb) steilAb = true;
        if (hilf.steilAuf) steilAuf = true;
      }

      // 2) Slew-Rate-Begrenzer
      var auf = (steilAuf ? tanKante : tanAuf) * dx, ab = (steilAb ? tanKante : tanAb) * dx;
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

  /* Rohhöhe aus Rauschen und Trend (ohne Bau-Elemente) */
  Gelaende.prototype.rohRauschen = function (x) {
    var p = this.p, start = glatt(8, 45, x), A = p.amp * this.fortschritt(x) * start;
    return A * (rauschen(x / p.welle, this.s1) + 0.45 * rauschen(x / (p.welle * 0.43), this.s2))
         + p.holperAmp * start * rauschen(x / p.holperWelle, this.s3)
         + p.trend * Math.max(0, x - 8) * start;
  };

  /* Liegt x in einer Sperrzone (Grube, Looping)? */
  Gelaende.prototype.gesperrt = function (x) {
    for (var i = 0; i < this.sperrzonen.length; i++) if (x > this.sperrzonen[i][0] && x < this.sperrzonen[i][1]) return true;
    return false;
  };

  /* Mittelpunkt eines Loopings (der Boden darunter ist eben) */
  Gelaende.prototype.loopMitte = function (L) {
    if (L.yc === null) L.yc = this.hoeheBei(L.xc) + L.R;
    return L.yc;
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
  Gelaende.prototype.kreisKontakt = function (cx, cy, r, rand, aus, ohneLoop) {
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
    var treffer = d <= r + rand;
    if (treffer) { aus.nx = (cx - qx) / d; aus.ny = (cy - qy) / d; aus.pen = r - d; }
    return (!ohneLoop && this.loopKontakt(cx, cy, r, rand, aus, treffer)) || treffer;
  };

  /* Rad von innen gegen die aktive Looping-Bahn; nimmt den
     tieferen Kontakt, falls schon einer mit dem Boden besteht */
  Gelaende.prototype.loopKontakt = function (cx, cy, r, rand, aus, schonKontakt) {
    var L = this.aktiverLoop;
    if (!L) return false;
    var ycL = this.loopMitte(L), dx = cx - L.xc, dy = cy - ycL, d = Math.sqrt(dx * dx + dy * dy);
    if (d < 1e-6) return false;
    var pen = d + r - L.R;
    // weit außerhalb des Rings (z. B. nach Versetzen) ist kein Kontakt
    if (pen < -rand || pen > 1 || (schonKontakt && pen <= aus.pen)) return false;
    aus.nx = -dx / d; aus.ny = -dy / d; aus.pen = pen;
    return true;
  };

  /* Punkt (Karosserie-Ecke) gegen Boden */
  Gelaende.prototype.punktKontakt = function (px, py, rand, aus) {
    var boden = this.hoeheBei(px);
    var s = this.steigungBei(px), l = Math.sqrt(1 + s * s);
    var abstand = (py - boden) / l;
    var treffer = abstand <= rand;
    if (treffer) { aus.nx = -s / l; aus.ny = 1 / l; aus.pen = -abstand; }
    return treffer;                                 // die Karosserie streift die Looping-Bahn nicht (nur die Räder fahren darauf)
  };

  /* ---------- Münzen, Kanister, Deko, Schilder ---------- */
  Gelaende.prototype.neueMuenze = function (x, y, wert) {
    this.muenzen.push({ x: x, y: y, wert: wert, weg: false, phase: x * 0.7 });
    if (!this.endlos) this.muenzWertGesamt += wert;
  };

  Gelaende.prototype.neueRakete = function (x) {
    for (var i = 0; i < this.tanks.length; i++) if (Math.abs(this.tanks[i].x - x) < 14) x = this.tanks[i].x + 16;
    var xr = this.tankPlatz(x);
    this.raketen.push({ x: xr, y: this.hoeheBei(xr), weg: false });
  };

  Gelaende.prototype.nahAnTank = function (x, abstand) {
    for (var r = this.raketen.length - 1; r >= 0 && r >= this.raketen.length - 2; r--) {
      if (Math.abs(this.raketen[r].x - x) < abstand) return true;
    }
    for (var i = this.tanks.length - 1; i >= 0 && i >= this.tanks.length - 3; i--) {
      if (Math.abs(this.tanks[i].x - x) < abstand) return true;
    }
    return Math.abs(this.naechsterTank - x) < abstand;
  };

  /* Kanister nicht dorthin legen, wo man drüberfliegt (Kuppen, hinter Schanzen).
     Gesucht wird kurz davor (bis 18 m) oder dahinter (bis 6 m) eine flache Stelle
     oder Mulde, wo die Räder sicher am Boden sind. */
  Gelaende.prototype.tankPlatz = function (x) {
    var beste = x, besteWertung = Infinity;
    for (var xp = Math.max(30, x - 18); xp <= x + 6; xp += 1) {
      var kuppe = this.steigungBei(xp - 4) - this.steigungBei(xp + 4);        // > 0: Kuppe, < 0: Mulde
      var w = Math.abs(this.steigungBei(xp)) + 3 * Math.max(0, kuppe + 0.05) +
              1.5 * Math.max(0, this.flughoehe(xp) - 0.6) + 0.004 * Math.abs(xp - x);
      if (this.gesperrt(xp)) w += 50;
      if (w < besteWertung) { besteWertung = w; beste = xp; }
    }
    return beste;
  };

  /* So hoch [m] fliegt ein Auto mit typischem Tempo höchstens über die Stelle xp,
     wenn es bis zu 30 m davor abhebt (Wurfparabel ab der Hangneigung). */
  Gelaende.prototype.flughoehe = function (xp) {
    var v = 17, k = this.welt.schwerkraft / (2 * v * v), yp = this.hoeheBei(xp), hoch = 0;
    for (var d = 2; d <= 30; d++) {
      var xl = xp - d, sl = this.steigungBei(xl), yl = this.hoeheBei(xl), q = k * (1 + sl * sl), frei = true;
      for (var e = 1; e < d && frei; e++) frei = yl + sl * e - q * e * e > this.hoeheBei(xl + e) - 0.05;
      if (frei) hoch = Math.max(hoch, yl + sl * d - q * d * d - yp);
    }
    return hoch;
  };

  Gelaende.prototype.platziereInhalte = function (bis) {
    var r = this.rnd, welt = this.welt, ende = this.endlos ? Infinity : this.ziel - 12;
    var g = welt.schwerkraft;
    bis = Math.min(bis, this.endlos ? bis : this.ziel + 120);
    if (bis <= this.platziertBis) return;

    // Benzinkanister nach Aufwand verteilt: Bergauf kostet jeder Meter mehr Benzin
    // (langsamer und volle Last), bergab weniger. Darum liegen die Kanister am Berg
    // dichter, und jeder Abschnitt verlangt ungefähr gleich viel Benzin.
    // (Im Endlos-Modus werden die Abstände langsam größer.)
    while (this.tankX < bis && this.tankX < ende - 10) {
      var sl = this.steigungBei(this.tankX);
      this.tankRest -= this.dx * Math.max(0.4, 1 + 3 * Math.max(0, sl) - 0.6 * Math.max(0, -sl)) / 1.3;
      this.tankX += this.dx;
      if (this.tankRest <= 0) {
        var xt = this.tankPlatz(this.tankX);
        this.tanks.push({ x: xt, y: this.hoeheBei(xt), weg: false });
        var zuwachs = this.endlos ? 1 + xt / FF.CONFIG.endlos.tankZuwachsStrecke : 1;
        this.tankRest = this.tankAbstand * (0.88 + 0.24 * r()) * zuwachs;
        this.tankX = xt;                           // Aufwand zählt ab dem neuen Kanister
      }
      this.naechsterTank = this.tankX + this.tankRest / 2;
    }

    // Raketen-Kanister (Boost)
    if (this.endlos) {
      while (this.naechsteRakete < bis) {
        this.neueRakete(this.naechsteRakete);
        this.naechsteRakete += FF.CONFIG.regeln.extras.raketenAbstandEndlos;
      }
    } else {
      while (this.raketenPlan.length && this.raketenPlan[0] < bis) this.neueRakete(this.raketenPlan.shift());
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
      var groesse = (+teile[1] || 1.2) * (0.8 + 0.4 * r());
      r();                         // ehemals Neigung – Zufallsfolge bleibt gleich, Strecken unverändert
      this.deko.push({ x: xd, y: this.hoeheBei(xd), emoji: teile[0], groesse: groesse, spiegeln: r() < 0.5 });
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
    filter(this.muenzen); filter(this.tanks); filter(this.raketen); filter(this.deko); filter(this.schilder);
  };

  FF.Gelaende = Gelaende;
  FF.zufallsQuelle = zufallsQuelle;
  FF.rauschen = rauschen;
})();
