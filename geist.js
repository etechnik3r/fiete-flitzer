/* ===========================================================================
   Fiete Flitzer – geist.js
   ---------------------------------------------------------------------------
   Geisterrennen zu zweit: Die Fahrt des ersten Kindes wird aufgezeichnet,
   das zweite Kind fährt danach gegen den halbdurchsichtigen "Geist".

   Aufzeichnung: alle CONFIG.regeln.geistTakt Sekunden (20 Hz) die Lage der
   Karosserie, jedes Rad (lokale Lage + Drehwinkel), Gesichtsausdruck,
   Ballon-Hilfe und zurückgelegte Strecke.
   Wiedergabe:   lineare Interpolation zwischen den Proben. Der Geist hat ein
   eigenes Fahrzeug-Objekt nur zum Zeichnen – er nimmt an der Physik nicht
   teil (keine Zusammenstöße, Verzögerungen spielen keine Rolle).

   Beide Fahrten laufen auf derselben Strecke (gleicher Seed) und messen ihre
   Zeit mit fahrt.zeit ab dem eigenen Start – dadurch ist der Vergleich fair.

   Kein Browser nötig: wird auch von werkzeuge/testfahrt.js (Node) benutzt.
   =========================================================================== */

var FF = globalThis.FF = globalThis.FF || {};

(function () {
  "use strict";

  var AUSDRUECKE = ["normal", "freude", "staunen"];

  /* ---------- Aufnahme ---------- */
  function Aufnahme(info) {
    this.info = info || {};          // { kind, fahrzeugId, upgrades, aussehen }
    this.proben = [];
    this.naechste = 0;
    this.ergebnis = null;            // fahrt.ergebnis() am Ende (inkl. zielZeit)
  }

  Aufnahme.prototype.erfasse = function (fahrt, ausdruck) {
    if (fahrt.zeit + 1e-9 < this.naechste) return;
    this.naechste = fahrt.zeit + FF.CONFIG.regeln.geistTakt;
    var fz = fahrt.fz, C = fz.chassis, ca = Math.cos(C.a), sa = Math.sin(C.a);
    var r = [];
    fz.raeder.forEach(function (R) {
      var dx = R.k.x - C.x, dy = R.k.y - C.y;
      r.push(ca * dx + sa * dy, -sa * dx + ca * dy, R.k.a);
    });
    this.proben.push({
      t: fahrt.zeit, x: C.x, y: C.y, a: C.a, vx: C.vx, vy: C.vy, r: r,
      h: fahrt.hilfe ? fahrt.hilfe.t / fahrt.hilfe.dauer : -1,
      g: Math.max(0, AUSDRUECKE.indexOf(ausdruck || "normal")),
      s: fahrt.strecke
    });
  };

  Aufnahme.prototype.abschliessen = function (fahrt, ausdruck) {
    this.naechste = 0;
    this.erfasse(fahrt, ausdruck);
    this.ergebnis = fahrt.ergebnis();
  };

  Aufnahme.prototype.dauer = function () {
    return this.proben.length ? this.proben[this.proben.length - 1].t : 0;
  };

  /* ---------- Wiedergabe ---------- */
  function Geist(aufnahme, gelaende) {
    var info = aufnahme.info;
    var werte = FF.berechneWerte(FF.fahrzeugDef(info.fahrzeugId), info.upgrades, "normal");
    this.aufnahme = aufnahme;
    this.def = FF.fahrzeugDef(info.fahrzeugId);
    this.fz = FF.Physik.baueFahrzeug(werte, 0, gelaende);
    this.index = 0;
    this.hilfe = null;
    this.ausdruck = "normal";
    this.strecke = 0;
    this.fertig = false;
    this.setzeZeit(0);
  }

  function mische(a, b, u) { return a + (b - a) * u; }

  Geist.prototype.setzeZeit = function (t) {
    var P = this.aufnahme.proben, n = P.length;
    if (!n) return;
    var i = Math.min(this.index, n - 1);
    while (i > 0 && P[i].t > t) i--;                       // zurückspulen (z. B. Neustart)
    while (i < n - 1 && P[i + 1].t <= t) i++;
    this.index = i;
    var a = P[i], b = P[Math.min(i + 1, n - 1)];
    var u = b.t > a.t ? Math.max(0, Math.min(1, (t - a.t) / (b.t - a.t))) : 0;
    this.fertig = t >= P[n - 1].t;

    var C = this.fz.chassis;
    C.x = mische(a.x, b.x, u); C.y = mische(a.y, b.y, u); C.a = mische(a.a, b.a, u);
    C.vx = mische(a.vx, b.vx, u); C.vy = mische(a.vy, b.vy, u);
    var ca = Math.cos(C.a), sa = Math.sin(C.a);
    this.fz.raeder.forEach(function (R, j) {
      var lx = mische(a.r[3 * j], b.r[3 * j], u), ly = mische(a.r[3 * j + 1], b.r[3 * j + 1], u);
      R.k.x = C.x + ca * lx - sa * ly;
      R.k.y = C.y + sa * lx + ca * ly;
      R.k.a = mische(a.r[3 * j + 2], b.r[3 * j + 2], u);
    });
    var h = u < 0.5 ? a.h : b.h;
    this.hilfe = h >= 0 ? { t: h * FF.CONFIG.regeln.hoppla.dauer, dauer: FF.CONFIG.regeln.hoppla.dauer } : null;
    this.ausdruck = AUSDRUECKE[u < 0.5 ? a.g : b.g] || "normal";
    this.strecke = mische(a.s, b.s, u);
  };

  /* Wer hat gewonnen? e0/e1 = fahrt.ergebnis() beider Fahrten.
     Rückgabe: 0 = erste Fahrt, 1 = zweite Fahrt, -1 = unentschieden.
     Beide im Ziel → kürzere Zeit; nur einer im Ziel → der; sonst weitere Strecke. */
  function vergleiche(e0, e1) {
    if (e0.ziel && e1.ziel) {
      if (Math.abs(e0.zielZeit - e1.zielZeit) < 0.05) return -1;
      return e0.zielZeit < e1.zielZeit ? 0 : 1;
    }
    if (e0.ziel !== e1.ziel) return e0.ziel ? 0 : 1;
    if (Math.abs(e0.strecke - e1.strecke) < 1) return -1;
    return e0.strecke > e1.strecke ? 0 : 1;
  }

  FF.Geist = { Aufnahme: Aufnahme, Geist: Geist, vergleiche: vergleiche };
})();
