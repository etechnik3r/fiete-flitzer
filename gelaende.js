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
     optionen: { endlos, stufe (0..3), laenge, seed, strecke }
     strecke: selbst gemalte Strecke aus dem Editor { dx, h: [Höhen in m] } –
     dann kommt die Rohhöhe aus h statt aus Rauschen und Bau-Elementen. Der
     Steigungsbegrenzer und der Tiefpass machen daraus eine befahrbare Strecke,
     Münzen, Kanister und Deko werden wie sonst verteilt.
     ========================================================================= */
  /* ---------- Röhren (Röhrenwelt) ----------
     Die Fahrlinie ist der Boden der Röhre, relativ zur Einfahrt (x = 0, y = 0, Richtung
     nach rechts). Gebaut wird sie wie mit einer Schildkröte aus geraden Stücken und
     Bögen; z ist die Tiefe (+1 = Kurve nach links zum Betrachter hin, −1 = nach rechts,
     weiter weg) – nur für die Grafik, das Auto wird dort größer oder kleiner.
     Ablauf: Einfahrt, Bogen senkrecht nach oben, hoch, oben zur Seite, zwei Figuren
     (Looping nach oben, Sturz-Looping nach unten, Schlangenkurven – nie zwei gleiche,
     nichts überdeckt sich), weich zurück zum Boden. */
  var ROEHRE_DS = 0.25;              // Abtastabstand der Fahrlinie [m]
  var ROEHRE_RI = 1.85;              // Innenradius der Röhre [m] (wie grafik-welt.js ROEHRE_R)
  function baueRoehre(r, wild) {
    // Erst würfeln (immer gleich viele Zufallszahlen), dann bauen. Zwei Figuren aus
    // Looping (nach oben), Sturz-Looping (nach unten) und Schlange – nie zweimal
    // dieselbe, also nie zwei Loopings übereinander.
    var plan = { hoch: 1.5 + 2.5 * r() + 1.5 * wild, figuren: [], lr: [] };
    var figuren = ["looping", "schlange", "sturz"];
    var f1 = figuren[Math.floor(r() * 3)], f2 = figuren[Math.floor(r() * 3)];
    if (f2 === f1) f2 = figuren[(figuren.indexOf(f1) + 1 + Math.floor(r() * 2)) % 3];
    plan.figuren = [f1, f2];
    plan.lr = [r() < 0.5 ? 1 : -1, r() < 0.5 ? 1 : -1];
    // Abstände zwischen den Teilen so lange vergrößern, bis sich keine zwei Teile
    // der Röhre überdecken und nichts im Boden steckt
    // (der Sturz-Looping geht nach unten: dafür notfalls höher hinauf)
    var hoch0 = plan.hoch;
    for (var extra = 0; extra < 4; extra++) {
      plan.hoch = hoch0 + 2.5 * extra;
      for (var versuch = 0; versuch < 9; versuch++) {
        var P = roehrenPfad(plan, 1.5 + 1.5 * versuch);
        if (!roehreUeberlappt(P)) return P;
      }
    }
    plan.hoch = hoch0;
    plan.figuren = ["schlange"];                         // Notlösung: nur die Schlange
    return roehrenPfad(plan, 3);
  }

  /* Prüft, ob sich zwei verschiedene Teile (Anstieg, Figur 1, Figur 2, Abstieg) der
     Röhre überdecken oder die Röhre in den Boden ragt. Innerhalb eines Loopings
     kreuzt sich die Röhre natürlich selbst – das zählt nicht. */
  function roehreUeberlappt(P) {
    var n = P.x.length, cx = [], cy = [], i, j, min = 2 * ROEHRE_RI + 0.4;
    function amFuss(k) {                                 // Kreuzung unten am Looping: gehört dazu
      for (var f = 0; f < P.fuss.length; f++) if (Math.hypot(P.x[k] - P.fuss[f][0], P.y[k] - P.fuss[f][1]) < 6) return true;
      return false;
    }
    for (i = 0; i < n; i++) { cx.push(P.x[i] - Math.sin(P.a[i]) * ROEHRE_RI); cy.push(P.y[i] + Math.cos(P.a[i]) * ROEHRE_RI); }
    for (i = 0; i < n; i += 2) {
      if (cy[i] < ROEHRE_RI - 0.2) return true;                       // steckt im Boden
      for (j = i + 2; j < n; j += 2) {
        if (P.g[i] === P.g[j] || P.s[j] - P.s[i] < 9) continue;
        var dx = cx[i] - cx[j], dy = cy[i] - cy[j];
        if (dx * dx + dy * dy < min * min && !amFuss(i) && !amFuss(j)) return true;
      }
    }
    return false;
  }

  function roehrenPfad(plan, luecke) {
    var P = { x: [0], y: [0], z: [0], a: [0], s: [0], g: [0], loops: [], fuss: [] }, x = 0, y = 0, a = 0, s = 0, gruppe = 0;
    function punkt(z) { P.x.push(x); P.y.push(y); P.z.push(z); P.a.push(a); P.s.push(s); P.g.push(gruppe); }
    // zAmp: Tiefe wölbt sich im Stück einmal hin und zurück
    function gerade(L, zAmp) {
      var n = Math.max(1, Math.round(L / ROEHRE_DS));
      for (var i = 1; i <= n; i++) {
        x += Math.cos(a) * L / n; y += Math.sin(a) * L / n; s += L / n;
        punkt((zAmp || 0) * Math.sin(Math.PI * i / n));
      }
    }
    function bogen(R, dA, zAmp) {
      var L = R * Math.abs(dA), n = Math.max(2, Math.round(L / ROEHRE_DS));
      for (var i = 1; i <= n; i++) {
        var a1 = a + dA / n;
        // Sehne des Kreisbogens (exakt, damit sich Loopings wirklich schließen)
        var sm = (a + a1) / 2, c = 2 * R * Math.sin(Math.abs(dA) / n / 2);
        x += Math.cos(sm) * c; y += Math.sin(sm) * c; a = a1; s += L / n;
        punkt((zAmp || 0) * Math.sin(Math.PI * i / n));
        // nach jeder ganzen Umdrehung: ein Looping geschafft (fahrt.js zählt ihn)
        if (Math.floor(Math.abs(dA) * i / n / (2 * Math.PI) + 1e-6) > Math.floor(Math.abs(dA) * (i - 1) / n / (2 * Math.PI) + 1e-6)) P.loops.push(s);
      }
    }
    var G = Math.PI / 180;
    gerade(2.5);
    bogen(4.5, 90 * G);                              // hinauf …
    gerade(plan.hoch);                               // … senkrecht
    bogen(3.5, -90 * G, 0.5);                        // oben zur Seite (Kurve nach links)
    gruppe = 1;                                      // Gerade vor und nach einer Figur gehört zur Figur
    gerade(luecke);                                  // (unten am Looping liegt sie natürlich doppelt)
    plan.figuren.forEach(function (f, k) {
      gruppe = k + 1;
      var lr = plan.lr[k];                           // Kurve nach links oder nach rechts
      if (f !== "schlange") P.fuss.push([x, y]);    // hier kreuzt sich der Looping selbst
      if (f === "looping") bogen(4.2, 360 * G, 0.9 * lr);
      else if (f === "sturz") bogen(3.6, -360 * G, -0.9 * lr);
      else { bogen(6, -35 * G, 0.8 * lr); bogen(6, 70 * G, -0.8 * lr); bogen(6, -70 * G, 0.8 * lr); bogen(6, 35 * G, -0.8 * lr); }
      gerade(luecke);
    });
    gruppe = plan.figuren.length + 1;
    // Weich zurück zum Boden (Hermite-Kurve: waagrecht hinein, waagrecht hinaus)
    var h = y, x0 = x, a0 = a, d = Math.max(12, 1.7 * h), k1 = d * 1.1;
    var t0x = Math.cos(a0) * k1, t0y = Math.sin(a0) * k1, n = 400, px = x, py = y, letzt = 0;
    for (var i = 1; i <= n; i++) {
      var t = i / n, t2 = t * t, t3 = t2 * t;
      var h00 = 2 * t3 - 3 * t2 + 1, h10 = t3 - 2 * t2 + t, h01 = -2 * t3 + 3 * t2, h11 = t3 - t2;
      var qx = h00 * x0 + h10 * t0x + h01 * (x0 + d) + h11 * k1, qy = h00 * h + h10 * t0y;
      var ds = Math.hypot(qx - px, qy - py);
      letzt += ds;
      if (letzt >= ROEHRE_DS || i === n) {
        var aNeu = Math.atan2(qy - P.y[P.y.length - 1], qx - P.x[P.x.length - 1]);
        a += Math.atan2(Math.sin(aNeu - a), Math.cos(aNeu - a));   // ohne Sprung um 360° (nach Loopings)
        x = qx; y = qy; s += letzt; letzt = 0;
        punkt(0);
      }
      px = qx; py = qy;
    }
    a = Math.round(a / (2 * Math.PI)) * 2 * Math.PI; y = 0;
    gerade(4);                                       // Ausfahrt auf dem Boden
    return P;
  }

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
                  looping: (g.looping || 0) * (0.6 + wild), luecke: (g.luecke || 0) * (0.6 + wild),
                  trampolin: (g.trampolin || 0) * (0.6 + wild), band: (g.band || 0) * (0.6 + wild),
                  schwebe: (g.schwebe || 0) * (0.6 + wild), katapult: (g.katapult || 0) * (0.6 + wild),
                  scheune: 0 },
      // Bauernhof: Scheunen gleichmäßig über das Level verteilt (nicht zufällig)
      scheuneAbstand: g.scheunen ? (this.endlos ? 150 : (optionen.laenge - 150) / g.scheunen) : 0,
      scheunenAnzahl: g.scheunen || 0,
      roehreAbstand: g.roehreAbstand || 0,        // Röhrenwelt: nach so viel Gelände [m] kommt immer die nächste Röhre
      wild: wild,
      abstand: g.abstandElemente * (1 - 0.25 * wild)
    };
    // Ausfahrt aus Tälern und Sprung-Mulden: flacher, weil man dort oft ohne Anlauf startet
    this.p.ausfahrt = Math.max(16 * GRAD, this.p.maxAuf - 7 * GRAD);
    this.tankAbstand = welt.tankAbstand * st.tank;
    this.muenzAbstand = welt.muenzAbstand;

    this.seed = optionen.seed | 0;
    this.eigene = optionen.strecke && optionen.strecke.h && optionen.strecke.h.length > 1 ? optionen.strecke : null;
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
    this.deckeCache = null; this.deckeAnzahl = 0;   // Höhlendecke (deckeBei)
    this.loopings = [];            // Loopings {xc, R, …} – Kreisbahn, die das Auto von innen fährt (fahrt.js)
    this.sperrzonen = [];          // [von, bis]: dort setzt der Ballon nie ab, dort liegt kein Kanister (Grube, Looping)
    this.trampoline = [];          // Hüpfpilze {x0, x1, H, v, …} – wer drauffährt, fliegt hoch (fahrt.js)
    this.baender = [];             // Förderbänder {x0, x1, v} – der Boden bewegt sich mit v [m/s] (physik.js)
    this.schwebezonen = [];        // Schwebe-Säulen {x0, x1, f} – dort wirkt nur f · Schwerkraft (physik.js)
    this.objekte = [];             // Dinge auf der Strecke, die man umfährt (welt.objekte): Glas, Bausteine, Säulen
    this.objektX = 35;             // bis hierhin sind Objekte verteilt
    this.spuk = [];                // Geister (welt.spuk), die kurz vor dem Auto auftauchen {x, gesehen}
    this.katapulte = [];           // Katapulte {x, v, winkel, …}: halten das Auto fest und schleudern es über den Graben (fahrt.js)
    this.spukX = 60;
    this.scheuneEnde = -40;        // letzte Scheune (für scheuneAbstand)
    this.scheunen = [];            // Scheunen {x0, x1, …}: hinein, durch, hinten fliegt Stroh (fahrt.js pruefeScheunen)
    this.roehren = [];             // Röhren {x, pfad, …}: das Auto fährt automatisch hindurch (fahrt.js roehrenSchritt)
    this.roehreEnde = 18;          // Ausgang der letzten Röhre (für roehreAbstand)
    this.obst = [];                // Obst {x, y, art, weg}: Einsammeln gibt einen Mini-Turbo (welt.obst)
    this.obstX = 34;               // bis hierhin ist Obst verteilt
    this.verdeckt = [];            // [von, bis]: dort fährt man nicht über den Boden (Röhre) oder sieht ihn nicht (Scheune) – keine Münz-Reihen, keine Kanister
    this.pfuetzen = [];            // Wasser in Mulden {x0, x1, y} (nur Welten mit welt.wasser), nach x sortiert
    this.pfuetzenI = 0;            // bis zu diesem Abtastpunkt ist nach Pfützen gesucht
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
               "looping", "luecke", "trampolin", "band", "schwebe", "katapult", "scheune"];

  Gelaende.prototype.neuesElement = function (xs) {
    var p = this.p, r = this.rnd, f = this.fortschritt(xs);
    var w = p.gewichte, summe = 0, i;
    for (i = 0; i < TYPEN.length; i++) summe += w[TYPEN[i]] || 0;
    var z = r() * summe, typ = null;
    for (i = 0; i < TYPEN.length; i++) { if ((z -= w[TYPEN[i]] || 0) < 0) { typ = TYPEN[i]; break; } }
    // Rundungsfehler: dann der letzte Typ, den es in dieser Welt gibt
    for (i = TYPEN.length - 1; !typ && i >= 0; i--) if (w[TYPEN[i]] > 0) typ = TYPEN[i];
    typ = typ || "buckel";
    // Röhrenwelt: regelmäßig eine Röhre (nicht zufällig), aber nie so kurz vor dem Ziel,
    // dass sie dahinter enden würde
    // – und dazwischen immer mindestens ein Hügel oder eine Schanze zum Springen
    if (p.roehreAbstand && (this.endlos || xs + 120 < this.ziel) &&
        (this.seitRoehre >= 2 || (this.seitRoehre >= 1 && xs - this.roehreEnde >= p.roehreAbstand * (0.8 + 0.4 * r())))) typ = "roehre";
    this.seitRoehre = typ === "roehre" ? 0 : (this.seitRoehre || 0) + 1;
    if (p.scheuneAbstand && xs - this.scheuneEnde >= p.scheuneAbstand * 0.72 && (this.endlos || (xs + 60 < this.ziel && this.scheunen.length < p.scheunenAnzahl))) typ = "scheune";
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
    } else if (typ === "trampolin") {
      // Hüpfpilz: flacher Anlauf, ein rot-weißer Pilzhut als Kuppel (Trampolin), dann
      // eine lange, flache Landewiese – wer drauffährt, fliegt hoch (fahrt.js pruefeTrampolin)
      el.flach = true;
      el.La = 12 + 4 * r();                         // Anlauf
      el.Lt = 5.5;                                  // Breite des Pilzhuts
      el.Ht = 0.75;                                 // Höhe der Kuppel
      el.Lf = 28;                                   // flache Landewiese
      el.Lflach = el.La + el.Lt + el.Lf;
      el.Lo = 22;
      el.xe = xs + el.Lflach + el.Lo;
      var xt = xs + el.La;
      this.trampoline.push({ x0: xt, x1: xt + el.Lt, H: el.Ht, v: 9.5 + 1.5 * p.wild, benutzt: false, platziert: false, boing: -9 });
      this.sperrzonen.push([xt - 1, xt + el.Lt + 1]);
    } else if (typ === "katapult") {
      // Katapult vor einem Burggraben: Schale (Lc), Graben (G, steile Wände), Landewiese (Lf)
      el.flach = true;
      el.La = 14; el.Lc = 4;
      el.G = 13 + 3 * r() + 2 * p.wild; el.D = 3.2;
      el.Lf = 40;
      el.Lflach = el.La + el.Lc + el.G + el.Lf;
      el.Lo = 20;
      el.xe = xs + el.Lflach + el.Lo;
      var xkp = xs + el.La + 1.5, weite = el.Lc - 1.5 + el.G + 10, wink = 0.75;
      var g0 = this.welt.schwerkraft;
      this.katapulte.push({ x: xkp, winkel: wink, v: Math.sqrt(weite * g0 / Math.sin(2 * wink)), benutzt: false, schuss: -9, platziert: false });
      this.sperrzonen.push([xs + el.La - 1, xs + el.La + el.Lc + el.G + 1]);
    } else if (typ === "scheune") {
      // Scheune auf ebenem Boden: Anlauf, mitten hindurch (vorne offenes Tor), dahinter
      // flacher Auslauf – beim Hinausfahren fliegt Stroh hoch (fahrt.js pruefeScheunen)
      el.flach = true;
      el.La = 14; el.Ls = 10 + 2.5 * r(); el.Lf = 12;
      el.Lflach = el.La + el.Ls + el.Lf;
      el.Lo = 18;
      el.xe = xs + el.Lflach + el.Lo;
      var xs0 = xs + el.La, xs1 = xs0 + el.Ls;
      this.scheunen.push({ x: xs0, x0: xs0, x1: xs1, H: 3.9, v: Math.floor(r() * 1000), drin: false, durch: false });
      this.sperrzonen.push([xs0 - 1, xs1 + 1]);
      this.verdeckt.push([xs0 + 0.3, xs1 - 0.3]);
      this.scheuneEnde = xs0;
    } else if (typ === "roehre") {
      // Röhre: Einfahrt auf ebenem Boden, dann senkrecht hoch, Loopings, Kurven (nach
      // vorn und hinten) und zurück auf den Boden. Die Fahrlinie (Boden der Röhre)
      // steht in pfad, relativ zum Einfahrtspunkt; dort ist der Boden eben.
      el.flach = true;
      el.La = 12;
      var pf = baueRoehre(r, p.wild);
      el.span = pf.x[pf.x.length - 1];
      el.Lflach = el.La + el.span + 8;
      el.Lo = 14;
      el.xe = xs + el.Lflach + el.Lo;
      var xr = xs + el.La;
      this.roehren.push({ x: xr, pfad: pf, L: pf.s[pf.s.length - 1], span: el.span, y0: null, farbe: Math.floor(r() * 1000), platziert: false });
      this.sperrzonen.push([xr - 1, xr + el.span + 2]);
      this.verdeckt.push([xr + 0.5, xr + el.span - 0.5]);
      this.roehreEnde = xr + el.span;
    } else if (typ === "schwebe") {
      // Schwebe-Säule: kleine Sprungkante, dann wird die Schwerkraft fast ausgeschaltet –
      // darunter eine Senke, oben hängen Münzen, die man nur schwebend erreicht
      el.flach = true;
      el.La = 12;
      el.Lk = 6; el.H = 1.0 + 0.4 * r();             // Sprungkante
      el.Lz = 26 + 8 * r() + 4 * p.wild;             // Länge der Säule hinter der Kante
      el.D = 2.5 + 1.5 * r();                        // Senke darunter
      el.Lu = 1.5 * (el.D + el.H) / Math.tan(p.ausfahrt);
      el.Lflach = el.La + el.Lk + el.Lz + el.Lu + 4;
      el.Lo = 18;
      el.xe = xs + el.Lflach + el.Lo;
      var xk = xs + el.La + el.Lk;
      this.schwebezonen.push({ x0: xk - 1, x1: xk + el.Lz, f: 0.18, platziert: false });
      this.sperrzonen.push([xk - 4, xk + el.Lz + 22]);  // dort kein Kanister (man schwebt drüber und landet erst danach), kein Ballon-Absetzen
    } else if (typ === "band") {
      // Förderband auf ebenem Boden: vorwärts (schiebt mit) oder rückwärts (dagegen anfahren!).
      // Rückwärts nur so schnell, dass jedes Fahrzeug dagegen ankommt.
      el.flach = true;
      el.La = 8;
      el.Lb = 16 + 12 * r() + 6 * p.wild;
      var vor = r() < 0.62;
      el.v = vor ? 5 + 3 * r() : -Math.min(5.5, 3 + 1.5 * r() + 1 * p.wild);
      el.Lflach = el.La + el.Lb + 6;
      el.Lo = 18;
      el.xe = xs + el.Lflach + el.Lo;
      this.baender.push({ x0: xs + el.La, x1: xs + el.La + el.Lb, v: el.v });
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
      case "band":
        return 0;                                   // nur ebener Boden – das Band selbst steht in baender
      case "scheune":
      case "roehre":
        return 0;                                   // nur ebener Boden – Scheune und Röhre stehen in scheunen/roehren
      case "katapult":
        var sk2 = s - el.La - el.Lc;
        if (sk2 < 0 || sk2 > el.G) return 0;
        if (sk2 < 1.2) aus.steilAb = true;
        if (sk2 > el.G - 1.2) aus.steilAuf = true;
        return sk2 < 0.6 || sk2 > el.G - 0.6 ? 0 : -el.D;
      case "schwebe":
        var sz = s - el.La;
        if (sz < 0) return 0;
        if (sz < el.Lk) { var uk = sz / el.Lk; return el.H * uk * uk; }
        sz -= el.Lk;
        if (sz < el.Lz) return el.H - (el.H + el.D) * glatt(0, el.Lz * 0.45, sz);
        sz -= el.Lz;
        return -el.D * (1 - glatt(0, el.Lu, sz));
      case "trampolin":
        var st = (s - el.La) / el.Lt;
        return st > 0 && st < 1 ? el.Ht * Math.sin(Math.PI * st) : 0;
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
      if (x >= this.naechstesElement && !zielZone && !this.eigene) {
        var el = this.neuesElement(x);
        this.elemente.push(el);
        if (!this.endlos) this.bauplan.push(el);       // für Analyse und Tests (werkzeuge/)
        this.naechstesElement = el.xe + p.abstand * (0.45 + this.rnd() * 0.9);
      }

      // 1) Rohhöhe
      var start = glatt(8, 45, x);
      var A = p.amp * this.fortschritt(x) * start;
      var roh = this.eigene ? this.eigeneHoehe(x) : this.rohRauschen(x);
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

  /* Selbst gemalte Strecke: Höhe bei x (Anfang und Ende je 12 m eben) */
  Gelaende.prototype.eigeneHoehe = function (x) {
    var E = this.eigene, L = (E.h.length - 1) * E.dx;
    var f = Math.max(12, Math.min(L - 12, x)) / E.dx, i = Math.min(E.h.length - 2, Math.floor(f)), t = f - i;
    return E.h[i] * (1 - t) + E.h[i + 1] * t;
  };

  /* Liegt x in einer Sperrzone (Grube, Looping)? */
  Gelaende.prototype.gesperrt = function (x) {
    for (var i = 0; i < this.sperrzonen.length; i++) if (x > this.sperrzonen[i][0] && x < this.sperrzonen[i][1]) return true;
    return false;
  };

  /* Liegt x unter einer Röhre oder in einer Scheune? Dann Ende der Zone, sonst 0 */
  Gelaende.prototype.verdecktBis = function (x) {
    for (var i = 0; i < this.verdeckt.length; i++) if (x > this.verdeckt[i][0] && x < this.verdeckt[i][1]) return this.verdeckt[i][1];
    return 0;
  };

  /* Röhre: Punkt der Fahrlinie bei Weglänge s (linear zwischen den Abtastpunkten),
     in Weltkoordinaten: {x, y, z, a} */
  Gelaende.prototype.roehrenPunkt = function (R, s, aus) {
    var P = R.pfad, n = P.s.length;
    if (R.y0 === null) R.y0 = this.hoeheBei(R.x);
    var f = Math.max(0, Math.min(n - 1.000001, s / ROEHRE_DS)), i = Math.floor(f), t = f - i;
    // Abtastpunkte liegen fast genau ROEHRE_DS auseinander (nur der Abstieg weicht etwas ab)
    while (i > 0 && P.s[i] > s) i--;
    while (i < n - 2 && P.s[i + 1] < s) i++;
    var d = P.s[i + 1] - P.s[i];
    t = d > 0 ? Math.max(0, Math.min(1, (s - P.s[i]) / d)) : 0;
    aus = aus || {};
    aus.x = R.x + P.x[i] + (P.x[i + 1] - P.x[i]) * t;
    aus.y = R.y0 + P.y[i] + (P.y[i + 1] - P.y[i]) * t;
    aus.z = P.z[i] + (P.z[i + 1] - P.z[i]) * t;
    aus.a = P.a[i] + (P.a[i + 1] - P.a[i]) * t;
    return aus;
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

  /* Höhlendecke [m] über x: höchster Boden in ±fenster (zum Rand hin etwas
     abgeschwächt, damit sie weich verläuft) + abstand + leichte Wellen. Je 1 m
     zwischengespeichert, dazwischen linear. Ohne welt.decke: Infinity. */
  Gelaende.prototype.deckeBei = function (x) {
    if (!this.welt.decke) return Infinity;
    var f = x - this.x0, k = Math.floor(f), t = f - k;
    return this.deckeRoh(k) * (1 - t) + this.deckeRoh(k + 1) * t;
  };
  Gelaende.prototype.deckeRoh = function (k) {
    var c = this.deckeCache || (this.deckeCache = {});
    if (c[k] !== undefined) return c[k];
    var D = this.welt.decke, x = this.x0 + k, m = -Infinity;
    for (var d = -D.fenster; d <= D.fenster; d += 1) m = Math.max(m, this.hoeheBei(x + d) - Math.abs(d) * 0.15);
    var v = m + D.abstand + D.wellig * rauschen(x / 11, this.seed + 77);
    if (x + D.fenster < this.x0 + (this.h.length - 1) * this.dx) {     // Boden dort schon fertig gebaut
      if (++this.deckeAnzahl > 20000) { this.deckeCache = c = {}; this.deckeAnzahl = 0; }
      c[k] = v;
    }
    return v;
  };

  /* Wind [m/s²] an der Stelle x (nur Welten mit welt.wind): > 0 Rückenwind, < 0 Gegenwind.
     Zonen aus glattem Rauschen, kräftig verstärkt und begrenzt → mal Sturm von hinten,
     mal von vorn, dazwischen kurz ruhig. Am Start und kurz vor dem Ziel ist es windstill.
     Nur vom Ort abhängig (nicht von der Zeit) – im Geisterrennen für beide gleich. */
  Gelaende.prototype.windBei = function (x) {
    var W = this.welt.wind;
    if (!W) return 0;
    var n = rauschen(x / W.laenge, this.seed + 91) + 0.4 * rauschen(x / (W.laenge * 0.37), this.seed + 92);
    var v = Math.max(-1, Math.min(1, 1.8 * n + (W.bias || 0)));
    var ruhig = glatt(25, 70, x) * (this.endlos ? 1 : 1 - glatt(this.ziel - 40, this.ziel - 10, x));
    return W.staerke * v * ruhig;
  };

  /* Geschwindigkeit des Förderbands bei x [m/s] (0: kein Band) */
  Gelaende.prototype.bandBei = function (x) {
    var B = this.baender;
    for (var i = 0; i < B.length; i++) {
      // an den Enden steigt das Tempo über 2,5 m an – ein Sprung würde das Auto aushebeln
      if (x >= B[i].x0 && x <= B[i].x1) return B[i].v * Math.min(1, (x - B[i].x0) / 2.5, (B[i].x1 - x) / 2.5);
    }
    return 0;
  };

  /* Schwerkraft-Faktor bei x (Schwebe-Säulen: f, mit 3 m weichem Rand; sonst 1) */
  Gelaende.prototype.schwereBei = function (x) {
    var Z = this.schwebezonen;
    for (var i = 0; i < Z.length; i++) {
      var z = Z[i];
      if (x > z.x0 - 3 && x < z.x1 + 3) {
        var u = Math.min(1, (x - z.x0 + 3) / 3, (z.x1 + 3 - x) / 3);
        return 1 - (1 - z.f) * u;
      }
    }
    return 1;
  };

  /* Wasserspiegel einer Pfütze bei x, sonst -Infinity */
  Gelaende.prototype.wasserBei = function (x) {
    var P = this.pfuetzen, lo = 0, hi = P.length;
    while (lo < hi) { var mid = (lo + hi) >> 1; if (P[mid].x1 < x) lo = mid + 1; else hi = mid; }
    return lo < P.length && P[lo].x0 <= x ? P[lo].y : -Infinity;
  };

  /* Pfützen suchen (welt.wasser): In jeder Mulde steht Wasser bis "tiefe" über dem
     tiefsten Punkt – aber nur so hoch, dass die Pfütze höchstens maxBreite breit wird
     und der niedrigere Rand nicht überläuft. Zu flache Mulden (kleine Holper) bleiben
     trocken. Kein Zufall: Strecke, Münzen und Kanister bleiben dieselben. */
  Gelaende.prototype.suchePfuetzen = function (bis) {
    var W = this.welt.wasser;
    if (!W) return;
    var h = this.h, dx = this.dx, x0 = this.x0, n = h.length;
    var iBis = Math.min(n - 2, Math.floor((bis - x0) / dx));
    var iStart = Math.max(this.pfuetzenI, Math.ceil((12 - x0) / dx));
    var maxN = Math.round(W.maxBreite / dx), ende = this.endlos ? Infinity : this.ziel - 25;
    for (var i = Math.max(1, iStart); i <= iBis; i++) {
      if (!(h[i] <= h[i - 1] && h[i] <= h[i + 1])) continue;
      var x = x0 + i * dx;
      if (x > ende) break;
      var tiefe = W.tiefe, l = i, r = i;
      for (; tiefe >= 0.3; tiefe -= 0.05) {
        var L = h[i] + tiefe;
        for (l = i; l > 0 && h[l - 1] < L && i - l <= maxN; l--);
        for (r = i; r < n - 1 && h[r + 1] < L && r - i <= maxN; r++);
        if (r - l <= maxN && l > 0 && r < n - 1) break;
      }
      if (tiefe < 0.3) continue;
      if (r - l < 3 || this.gesperrt(x)) { this.pfuetzenI = r + 1; i = r; continue; }
      // Ränder genau dort, wo der Boden den Wasserspiegel schneidet
      var y = h[i] + tiefe;
      var xl = x0 + (l - 1) * dx + dx * (y - h[l - 1]) / (h[l] - h[l - 1] || 1);
      var xr = x0 + r * dx + dx * (h[r] - y) / (h[r] - h[r + 1] || 1);
      if (xr > ende) break;
      this.pfuetzen.push({ x0: xl, x1: xr, y: y });
      i = r;
      this.pfuetzenI = r + 1;
    }
    this.pfuetzenI = Math.max(this.pfuetzenI, iBis - Math.round(2 * W.maxBreite / dx));
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
    this.raketen.push({ x: xr, y: Math.max(this.hoeheBei(xr), this.wasserBei(xr)), weg: false });
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
    // Unter einer Röhre oder in einer Scheune: gleich dahinter
    var vb = this.verdecktBis(beste);
    if (vb) return vb + 3;
    // Raumstation: liegt alles in einer Schwebe-Zone, dann gleich hinter ihr Ende
    // (nur dort – in anderen Welten bleiben die Kanister, wo sie immer waren)
    if (this.schwebezonen.length && this.gesperrt(beste)) {
      for (var i = 0; i < this.sperrzonen.length; i++) {
        var z = this.sperrzonen[i];
        if (beste > z[0] && beste < z[1]) return z[1] + 1.5;
      }
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
    this.suchePfuetzen(bis);

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
        this.tanks.push({ x: xt, y: Math.max(this.hoeheBei(xt), this.wasserBei(xt)), weg: false });   // in der Pfütze schwimmt er
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
      var vbm = this.verdecktBis(xm) || this.verdecktBis(xm + 8);
      if (vbm) { this.naechsteMuenze = Math.max(xm + 3, vbm + 3); continue; }   // unter der Röhre / in der Scheune fährt man nicht
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

    // Objekte auf der Strecke (Glasblöcke, Bausteine, Säulen): eigener Zufall aus der Position,
    // damit Münzen und Kanister gleich bleiben; nur auf flachem Boden, nie in Sperrzonen
    var OB = welt.objekte;
    while (OB && this.objektX < bis - 10 && this.objektX < ende - 25) {
      var xo = this.objektX, ho = hash01(Math.round(xo * 7), this.seed + 61), ho2 = hash01(Math.round(xo * 7), this.seed + 62);
      var saeule = OB.saeule && ho2 < OB.saeule;
      this.objektX += OB.abstand * (0.55 + 0.9 * ho) * (saeule ? 1.6 : 1);
      var flach = Math.abs(this.steigungBei(xo - 1)) < 0.3 && Math.abs(this.steigungBei(xo + 1)) < 0.3;
      if (!flach || this.gesperrt(xo) || this.wasserBei(xo) > -Infinity || this.nahAnTank(xo, 5)) continue;
      var art = saeule ? "saeule" : OB.art, ob = { x: xo, y: this.hoeheBei(xo), art: art, kaputt: false, v: Math.floor(ho2 * 1000) };
      if (art === "glas") { ob.form = ["block", "kugel", "turm"][Math.floor(ho * 3)]; ob.b = 0.9 + 0.6 * ho2; ob.h = ob.form === "turm" ? 1.8 + ho : 0.9 + 0.6 * ho; }
      else if (art === "stein") { ob.b = 0.7 + 0.5 * ho2; ob.h = 0.38 * (1 + Math.floor(ho * 3)); }
      else { ob.b = 1.3; ob.h = 3.6 + 1.6 * ho; }                    // Säule
      this.objekte.push(ob);
    }

    // Röhren: Münzen entlang der Fahrlinie (man fährt sicher hindurch), am höchsten Punkt ein Stern
    for (i = 0; i < this.roehren.length; i++) {
      var Rr = this.roehren[i];
      if (Rr.platziert || Rr.x + Rr.span > bis - 5) continue;
      Rr.platziert = true;
      var Pf = Rr.pfad, oben = 0, q = {};
      for (var j0 = 1; j0 < Pf.y.length; j0++) if (Pf.y[j0] > Pf.y[oben]) oben = j0;
      for (var sr = 7; sr < Rr.L - 6; sr += 6.5) {
        this.roehrenPunkt(Rr, sr, q);
        this.neueMuenze(q.x - Math.sin(q.a) * 1.0, q.y + Math.cos(q.a) * 1.0, 5);
      }
      this.roehrenPunkt(Rr, Pf.s[oben], q);
      this.neueMuenze(q.x - Math.sin(q.a) * 1.0, q.y + Math.cos(q.a) * 1.0, 25);
    }

    // Obst (welt.obst): eigener Zufall aus der Position, auf ebenem Boden, wo man nicht drüberfliegt
    var OS = welt.obst;
    while (OS && this.obstX < bis - 5 && this.obstX < ende - 15) {
      var xf = this.obstX, hf = hash01(Math.round(xf * 7), this.seed + 81), hf2 = hash01(Math.round(xf * 7), this.seed + 82);
      this.obstX += OS.abstand * (0.6 + 0.8 * hf);
      var eben = Math.abs(this.steigungBei(xf - 1)) < 0.35 && Math.abs(this.steigungBei(xf + 1)) < 0.35;
      if (!eben || this.gesperrt(xf) || this.verdecktBis(xf) || this.wasserBei(xf) > -Infinity || this.nahAnTank(xf, 5) || this.flughoehe(xf) > 1.0) {
        this.obstX = xf + 4 + 6 * hf2;                          // gleich dahinter nochmal versuchen
        continue;
      }
      this.obst.push({ x: xf, y: this.hoeheBei(xf) + 0.95, art: Math.floor(hf2 * 7), weg: false });
    }

    // Geister (nur Grafik und Klang): alle ~40–70 m einer, eigener Zufall
    while (welt.spuk && this.spukX < bis && this.spukX < ende - 20) {
      this.spuk.push({ x: this.spukX, gesehen: false, v: Math.floor(hash01(Math.round(this.spukX), this.seed + 71) * 1000) });
      this.spukX += 40 + 30 * hash01(Math.round(this.spukX), this.seed + 72);
    }

    // Katapulte: Münzen entlang der Flugbahn, oben ein Diamant
    for (i = 0; i < this.katapulte.length; i++) {
      var kp = this.katapulte[i];
      if (kp.platziert || kp.x > bis - 60) continue;
      kp.platziert = true;
      if (kp.x > ende - 40) continue;
      var vxk = kp.v * Math.cos(kp.winkel), vyk = kp.v * Math.sin(kp.winkel), yk = this.hoeheBei(kp.x) + 1.6, tg = vyk / g;
      for (var kk = 1; kk <= 7; kk++) { var tk = tg * 2 * kk / 8; this.neueMuenze(kp.x + vxk * tk, yk + vyk * tk - 0.5 * g * tk * tk, kk === 4 ? 100 : 10); }
    }

    // Hüpfpilze: Münzen steigen über dem Hut auf (früh im Flug liegen alle Flugbahnen
    // nah beieinander – egal wie schnell man kommt), oben ein Stern
    for (i = 0; i < this.trampoline.length; i++) {
      var tp = this.trampoline[i];
      if (tp.platziert || tp.x1 > bis - 30) continue;
      tp.platziert = true;
      if (tp.x1 > ende - 20) continue;
      var xm0 = (tp.x0 + tp.x1) / 2 + 0.8, ym0 = this.hoeheBei(xm0) + 1.3;
      for (var kt = 0; kt < 5; kt++) {
        var tt = 0.12 + kt * 0.14;
        this.neueMuenze(xm0 + 9 * tt, ym0 + tp.v * tt - 0.5 * g * tt * tt, kt === 4 ? 25 : 10);
      }
    }

    // Schwebe-Säulen: Münzen hoch oben im Bogen, in der Mitte ein Diamant
    for (i = 0; i < this.schwebezonen.length; i++) {
      var zs = this.schwebezonen[i];
      if (zs.platziert || zs.x1 > bis - 20) continue;
      zs.platziert = true;
      if (zs.x1 > ende - 15) continue;
      var yb = this.hoeheBei(zs.x0 + 1);
      for (var kz = 0; kz < 7; kz++) {
        var uz = (kz + 0.5) / 7, xz = zs.x0 + 3 + (zs.x1 - zs.x0 - 6) * uz;
        this.neueMuenze(xz, yb + 3 + 4 * Math.sin(Math.PI * uz), kz === 3 ? 100 : 10);
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
      var wahl = Math.floor(r() * welt.deko.length);
      if (wahl === this.letzteDeko) wahl = (wahl + 1) % welt.deko.length;   // nie zweimal dasselbe hintereinander
      this.letzteDeko = wahl;
      var teile = welt.deko[wahl].split(":");
      var groesse = (+teile[1] || 1.2) * (0.8 + 0.4 * r());
      r();                         // ehemals Neigung – Zufallsfolge bleibt gleich, Strecken unverändert
      // Requisiten ("@art") aus requisiten.js: Variante und Beiwerk aus der Position (eigener Zufall,
      // damit Münzen und Kanister der Level gleich bleiben)
      var h1 = hash01(Math.round(xd * 10), this.seed + 3), h2 = hash01(Math.round(xd * 10), this.seed + 4);
      var typ = teile[0].charAt(0) === "@" ? teile[0].slice(1) : null;
      var spiegeln = r() < 0.5, nass = this.wasserBei(xd) > this.hoeheBei(xd) - 0.05;
      if (nass) {
        // In der Pfütze steht kein Baum – dort schwimmt ab und zu eine Ente (im Matsch: ein Schwein suhlt sich)
        var tier = welt.wasser.tier, gt = tier ? 0.95 : 0.75;
        if (h1 < 0.45) this.deko.push({ x: xd, y: this.wasserBei(xd), fuss: this.wasserBei(xd) - (tier ? 0.3 : 0.12), emoji: tier || "🦆", typ: null, variante: 0,
                                        groesse: gt, spiegeln: spiegeln, schwimmt: true });
        this.naechsteDeko += 3 + r() * 7;
        continue;
      }
      // "Emoji:Größe:Höhe" – schwebt so hoch über dem Boden (Fische, Bienen …)
      this.deko.push({ x: xd, y: this.hoeheBei(xd), emoji: typ ? null : teile[0], typ: typ, variante: Math.floor(h1 * 1000),
                       groesse: groesse, spiegeln: spiegeln, hoch: teile[2] ? +teile[2] * (0.8 + 0.4 * h2) : 0 });
      if (welt.beiwerk && welt.beiwerk.length && h2 < 0.35) {            // kleines Beiwerk daneben (Gras, Steinchen …)
        var bw = welt.beiwerk[Math.floor(h1 * 7919) % welt.beiwerk.length].split(":"), xb = xd + (h2 < 0.17 ? -1 : 1) * (0.8 + h2 * 3);
        if (!(this.wasserBei(xb) > this.hoeheBei(xb) - 0.05)) this.deko.push({ x: xb, y: this.hoeheBei(xb), emoji: null, typ: bw[0].slice(1), variante: Math.floor(h2 * 1000),
                         groesse: (+bw[1] || 0.4) * (0.7 + h1 * 0.6), spiegeln: h1 < 0.5 });
      }
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
    filter(this.objekte); filter(this.spuk); filter(this.obst);
    while (this.scheunen.length && this.scheunen[0].x1 < xHinten) this.scheunen.shift();
    while (this.roehren.length && this.roehren[0].x + this.roehren[0].span < xHinten) this.roehren.shift();
    var n = 0;
    while (n < this.pfuetzen.length && this.pfuetzen[n].x1 < xHinten) n++;
    if (n > 0) this.pfuetzen.splice(0, n);
  };

  FF.Gelaende = Gelaende;
  FF.zufallsQuelle = zufallsQuelle;
  FF.rauschen = rauschen;
})();
