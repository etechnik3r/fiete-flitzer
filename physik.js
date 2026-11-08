/* ===========================================================================
   Fiete Flitzer – physik.js
   ---------------------------------------------------------------------------
   Eigene kleine 2D-Starrkörper-Physik, nur für Fahrzeuge auf einer Strecke.

   MODELL
     • Karosserie = Starrkörper (Masse m, Trägheitsmoment J, Lage x/y/Winkel)
     • Jedes Rad  = eigener Starrkörper (dreht sich wirklich!)
     • Radaufhängung je Rad (wie ein "Wheel Joint" in Box2D):
         – Linienführung: Rad darf sich nur entlang der Federachse bewegen (hart)
         – Feder-Dämpfer: weiche Bindung mit Eigenfrequenz f und Dämpfungsgrad ζ
           (Catto, "Soft Constraints", GDC 2011):  k = m·ω², c = 2·m·ζ·ω,
           γ = 1 / (h·(c + h·k)),  Bias = C·h·k·γ
         – Anschläge oben/unten (Ungleichungs-Bindungen)
         – Motor/Bremse: Bindung auf die RELATIVE Drehzahl Rad ↔ Karosserie mit
           begrenztem Moment. Das Gegenmoment wirkt auf die Karosserie →
           Wheelies beim Anfahren, und in der Luft kippt Gas die Nase hoch,
           Bremsen die Nase runter (Drehimpulserhaltung, vgl. Roboter-Sprung-
           versuche: Rad beschleunigen/abbremsen steuert die Nicklage).
     • Reifen-Boden-Kontakt:
         – Normalkraft ≥ 0 (Nichteindringen, Baumgarte + Stoßzahl)
         – Haftreibung |Ft| ≤ µ·Fn (Coulomb – der Spitzenwert der Pacejka-
           Kraftschlusskurve). Darüber dreht das Rad durch.
         – Rollwiderstand: Gegenmoment c_rr·Fn·r
     • Karosserie-Umriss und Fietes Kopf kollidieren ebenfalls mit dem Boden.
     • Kuppelstangen (Dampf-Lok): alle Räder rollen gleich schnell (Bindung auf
       die Umfangsgeschwindigkeit relativ zur Karosserie) – keines dreht allein durch.
     • Anhänger (Dampf-Lok): weitere Starrkörper mit eigenen Rädern und Umriss.
       Jeder hängt mit seiner Deichsel an der Kupplung des Vordermanns:
         – Drehgelenk als weiche Punkt-Bindung (2 Zeilen, Catto) – die Kupplung
           federt etwas, darum ruckelt und wackelt der Zug beim Anfahren
         – Knickgrenze: der Winkel zum Vordermann ist auf ±knick begrenzt
           (Ungleichungs-Bindung), so kann der Zug nicht zusammenklappen
     • Luftwiderstand ½·ρ·cwA·v² und Abtrieb ½·ρ·cA·v² (unter Wasser mit
       größerer Dichte), Wind als Zusatz-Beschleunigung, Drehdämpfung im Wasser.

   LÖSER
     Semi-implizites Euler-Verfahren mit "Sequential Impulses" (Catto, GDC
     2006): Kräfte → Geschwindigkeiten, dann alle Bindungen iterativ als
     Impulse lösen (mit Warmstart), danach Lage integrieren. 240 Hz.

   Kein Browser nötig: wird auch von werkzeuge/testfahrt.js (Node) benutzt.
   =========================================================================== */

var FF = globalThis.FF = globalThis.FF || {};

(function () {
  "use strict";

  function Koerper(m, J) {
    this.x = 0; this.y = 0; this.a = 0;      // Lage
    this.vx = 0; this.vy = 0; this.w = 0;    // Geschwindigkeit, Winkelgeschwindigkeit
    this.m = m; this.im = m > 0 ? 1 / m : 0;
    this.J = J; this.iJ = J > 0 ? 1 / J : 0;
  }

  function Kontakt() {
    this.aktiv = false; this.warAktiv = false;
    this.pen = 0; this.nx = 0; this.ny = 1;
    this.rx = 0; this.ry = 0;                // Hebelarm vom Schwerpunkt zum Kontaktpunkt
    this.jn = 0; this.jt = 0; this.jr = 0;   // aufsummierte Impulse (normal, tangential, Rollwiderstand)
    this.mn = 0; this.mt = 0; this.ziel = 0; this.mu = 0; this.rollMax = 0;
    this.kraftN = 0; this.kraftT = 0;        // für die Kräfte-Anzeige [N]
    this.vBand = 0;                          // Förderband: der Boden bewegt sich tangential mit dieser Geschwindigkeit
  }

  /* -------------------------------------------------------------------------
     Fahrzeug bauen
     w = wirksame Fahrzeugwerte (siehe FF.berechneWerte in fahrt.js)
     ------------------------------------------------------------------------- */
  function baueTeil(w) {
    var P = FF.CONFIG.physik;
    var J = w.masse * (w.groesse.laenge * w.groesse.laenge + w.groesse.hoehe * w.groesse.hoehe) / 12;
    var teil = {
      werte: w,
      chassis: new Koerper(w.masse, J),
      raeder: [],
      huelle: [],
      kopf: w.kopf ? { x: w.kopf.x, y: w.kopf.y, r: w.kopf.r, kontakt: new Kontakt() } : null,
      zusatzMoment: 0,
      gekuppelt: !!w.kuppelstange,
      status: { radKontakte: 0, huellKontakt: false, dachKontakt: false, kopfKontakt: false,
                leistung: 0, drehzahl: 0, vorwaerts: 0, tempo: 0 }
    };

    var fed = w.federung;
    var mGefedert = w.masse / w.raeder.length;
    var om = 2 * Math.PI * fed.frequenz;
    var vmax = w.motor ? w.motor.vmax : 20;
    w.raeder.forEach(function (rd) {
      var k = new Koerper(rd.masse, 0.6 * rd.masse * rd.r * rd.r); // Masse sitzt eher außen (Reifen)
      teil.raeder.push({
        k: k, r: rd.r, ankerX: rd.x, ankerY: rd.y, antrieb: !!rd.antrieb,
        L0: fed.ruhe, Lmin: fed.ruhe - fed.weg, Lmax: fed.ruhe,
        kF: mGefedert * om * om, cF: 2 * fed.daempfung * mGefedert * om,
        wMax: vmax / rd.r,
        trans: fed.ruhe,
        jLinie: 0, jFeder: 0, jUnten: 0, jOben: 0, jMotor: 0,
        motorZiel: 0, motorMax: 0,
        axx: 0, axy: -1, ayx: 1, ayy: 0, sAx: 0, sAy: 0,
        mLinie: 0, mAx: 0, mFeder: 0, mMotor: 0, gamma: 0, biasF: 0, biasLinie: 0,
        kontakt: new Kontakt()
      });
    });

    // Umriss in Punkte zerlegen (geschlossenes Polygon), Dachpunkte extra markieren
    var poly = w.huelle;
    for (var i = 0; i < poly.length; i++) {
      var a = poly[i], b = poly[(i + 1) % poly.length];
      var len = Math.hypot(b[0] - a[0], b[1] - a[1]);
      var n = Math.max(1, Math.ceil(len / P.punktAbstand));
      for (var j = 0; j < n; j++) {
        var t = j / n;
        teil.huelle.push({ x: a[0] + (b[0] - a[0]) * t, y: a[1] + (b[1] - a[1]) * t, dach: false, kontakt: new Kontakt() });
      }
    }
    (w.dach || []).forEach(function (d) {
      teil.huelle.push({ x: d[0], y: d[1], dach: true, kontakt: new Kontakt() });
    });
    return teil;
  }

  /* -------------------------------------------------------------------------
     Fahrzeug bauen
     w = wirksame Fahrzeugwerte (siehe FF.berechneWerte in fahrt.js)
     w.anhaenger (optional) = Liste der Anhänger, je { masse, groesse, raeder,
       federung, huelle, cwA, deichsel: [x, y] (Spitze der Deichsel, lokal),
       haken: [x, y] (Kupplung hinten für den nächsten), knick [rad], gelenk: {frequenz,
       daempfung} }. Die Kupplung des Zugfahrzeugs steht in w.haken.
     ------------------------------------------------------------------------- */
  function baueFahrzeug(w, startX, gelaende) {
    var fz = baueTeil(w);
    fz.anhaenger = [];
    var vorne = w;
    (w.anhaenger || []).forEach(function (aw) {
      var A = baueTeil(aw);
      var G = aw.gelenk || { frequenz: 5, daempfung: 0.4 };
      var om = 2 * Math.PI * G.frequenz, mE = aw.masse;   // wirksame Masse ≈ Anhänger (der Zug ist schwerer)
      A.gelenk = {
        haken: vorne.haken, deichsel: aw.deichsel, knick: aw.knick || 0.5,
        k: mE * om * om, c: 2 * G.daempfung * mE * om,
        jx: 0, jy: 0, jUnten: 0, jOben: 0,
        rAx: 0, rAy: 0, rBx: 0, rBy: 0, m11: 0, m12: 0, m22: 0, gamma: 0, bx: 0, by: 0,
        mDreh: 0, cU: 0, cO: 0, winkel: 0
      };
      fz.anhaenger.push(A);
      vorne = aw;
    });

    setzeAufBoden(fz, gelaende, startX, 0);
    return fz;
  }

  /* Wie weit [m] reicht der Zug hinter den Schwerpunkt der Lok? (0 ohne Anhänger) */
  function zugHinten(w) {
    if (!w.anhaenger || !w.anhaenger.length) return 0;
    var hx = -w.haken[0];
    w.anhaenger.forEach(function (A) {
      var xMin = Infinity; A.huelle.forEach(function (p) { xMin = Math.min(xMin, p[0]); });
      hx += A.deichsel[0] - xMin;
      if (A.haken) hx += -A.haken[0] + xMin;      // der nächste hängt an der Kupplung, nicht am Heck
    });
    return hx;
  }

  /* Vordermann eines Anhängers (Lok oder Anhänger davor) */
  function vordermann(fz, i) { return i === 0 ? fz : fz.anhaenger[i - 1]; }

  /* Lage eines Teils setzen: Räder entspannt an ihre Aufhängung, alles in Ruhe */
  function stelleTeil(T, x, y, a) {
    var C = T.chassis, ca = Math.cos(a), sa = Math.sin(a);
    C.x = x; C.y = y; C.a = a; C.vx = C.vy = C.w = 0;
    T.raeder.forEach(function (R) {
      var lx = R.ankerX, ly = R.ankerY - R.L0;
      R.k.x = x + ca * lx - sa * ly; R.k.y = y + sa * lx + ca * ly;
      R.k.vx = R.k.vy = 0;
      R.trans = R.L0;
    });
  }

  /* Weltpunkt eines lokalen Punktes */
  function weltPunkt(C, p) {
    var ca = Math.cos(C.a), sa = Math.sin(C.a);
    return { x: C.x + ca * p[0] - sa * p[1], y: C.y + sa * p[0] + ca * p[1] };
  }

  /* Anhänger so hinstellen, dass die Deichselspitze an der Kupplung des Vordermanns
     sitzt. Richtung: wie bisher hinterhergezogen (wie an einer Schnur), höchstens
     ±knick gegen den Vordermann. bodenGel: zusätzlich so drehen, dass die Räder auf
     dem Boden stehen (Start, nach der Ballon-Hilfe). */
  function folgeAnhaenger(fz, bodenGel) {
    for (var i = 0; i < fz.anhaenger.length; i++) {
      var A = fz.anhaenger[i], V = vordermann(fz, i), G = A.gelenk, C = A.chassis;
      var H = weltPunkt(V.chassis, G.haken);
      var dx = G.deichsel[0], dy = G.deichsel[1], L = Math.hypot(dx, dy), phi0 = Math.atan2(dy, dx);
      var a;
      if (bodenGel) a = V.chassis.a;
      else {
        a = Math.atan2(H.y - C.y, H.x - C.x) - phi0;      // vom Anhänger zur Kupplung
        if (!isFinite(a) || (C.x === 0 && C.y === 0)) a = V.chassis.a;
      }
      var d = normW(a - V.chassis.a);
      if (d > G.knick) a = V.chassis.a + G.knick; else if (d < -G.knick) a = V.chassis.a - G.knick;
      function lageBei(aa) { return { x: H.x - L * Math.cos(aa + phi0), y: H.y - L * Math.sin(aa + phi0) }; }
      if (bodenGel) {
        // um die Kupplung drehen, bis das tiefste Rad den Boden gerade berührt
        for (var it = 0; it < 6; it++) {
          var p = lageBei(a), ca = Math.cos(a), sa = Math.sin(a), tief = Infinity, jHebel = 1;
          A.raeder.forEach(function (R) {
            var lx = R.ankerX, ly = R.ankerY - R.L0;
            var wx = p.x + ca * lx - sa * ly, wy = p.y + sa * lx + ca * ly;
            var luft = wy - R.r - 0.02 - bodenGel.hoeheBei(wx);
            if (luft < tief) { tief = luft; jHebel = Math.max(0.5, Math.hypot(wx - H.x, wy - H.y)); }
          });
          var da = Math.asin(Math.max(-0.5, Math.min(0.5, tief / jHebel)));
          a += da;                                       // Rad zu hoch (tief > 0) → Heck runter (a größer)
          d = normW(a - V.chassis.a);
          if (d > G.knick) a = V.chassis.a + G.knick; else if (d < -G.knick) a = V.chassis.a - G.knick;
          if (Math.abs(da) < 1e-4) break;
        }
      }
      var q = lageBei(a);
      stelleTeil(A, q.x, q.y, a);
      A.raeder.forEach(function (R) { R.jLinie = R.jFeder = R.jUnten = R.jOben = R.jMotor = 0; R.kontakt.warAktiv = false; R.kontakt.aktiv = false; R.kontakt.jn = R.kontakt.jt = R.kontakt.jr = 0; });
      A.huelle.forEach(function (pp) { pp.kontakt.warAktiv = false; pp.kontakt.aktiv = false; pp.kontakt.jn = pp.kontakt.jt = 0; });
      G.jx = G.jy = G.jUnten = G.jOben = 0;
    }
  }

  function normW(a) {
    a = (a + Math.PI) % (2 * Math.PI);
    if (a < 0) a += 2 * Math.PI;
    return a - Math.PI;
  }

  /* Geschwindigkeit aller Teile (Lok, Räder, Anhänger) um dvx/dvy ändern –
     für Hüpfpilz, Sprungfeder, Katapult */
  function stoss(fz, dvx, dvy) {
    alleKoerper(fz, function (k) { k.vx += dvx; k.vy += dvy; });
  }
  /* Anhänger übernehmen Tempo (und Raddrehung) der Lok – nach Röhre/Katapult */
  function anhaengerTempo(fz) {
    var C = fz.chassis;
    fz.anhaenger.forEach(function (A) {
      A.chassis.vx = C.vx; A.chassis.vy = C.vy; A.chassis.w = 0;
      A.raeder.forEach(function (R) { R.k.vx = C.vx; R.k.vy = C.vy; R.k.w = -Math.hypot(C.vx, C.vy) / R.r; });
    });
  }
  function alleKoerper(fz, f) {
    f(fz.chassis); fz.raeder.forEach(function (R) { f(R.k); });
    (fz.anhaenger || []).forEach(function (A) { f(A.chassis); A.raeder.forEach(function (R) { f(R.k); }); });
  }

  /* Fahrzeug an Stelle x mit Winkel a so hinstellen, dass die Räder den Boden
     gerade berühren (Start und "Ballon-Hilfe"). Alle Geschwindigkeiten = 0. */
  function setzeAufBoden(fz, gel, x, a) {
    var C = fz.chassis, ca = Math.cos(a), sa = Math.sin(a);
    var y = -Infinity;
    fz.raeder.forEach(function (R) {
      // Radmitte relativ zum Schwerpunkt (entspannte Feder, Achse = lokal unten)
      var lx = R.ankerX, ly = R.ankerY - R.L0;
      var wx = ca * lx - sa * ly, wy = sa * lx + ca * ly;
      var boden = gel.hoeheBei(x + wx);
      y = Math.max(y, boden + R.r - wy + 0.02);
    });
    C.x = x; C.y = y; C.a = a; C.vx = C.vy = C.w = 0;
    fz.raeder.forEach(function (R) {
      var lx = R.ankerX, ly = R.ankerY - R.L0;
      R.k.x = x + ca * lx - sa * ly; R.k.y = y + sa * lx + ca * ly;
      R.k.vx = R.k.vy = R.k.w = 0;
      R.jLinie = R.jFeder = R.jUnten = R.jOben = R.jMotor = 0;
      R.kontakt.warAktiv = false; R.kontakt.jn = R.kontakt.jt = R.kontakt.jr = 0;
    });
    fz.huelle.forEach(function (p) { p.kontakt.warAktiv = false; p.kontakt.jn = p.kontakt.jt = 0; });
    fz.kopf.kontakt.warAktiv = false;
    if (fz.anhaenger && fz.anhaenger.length) folgeAnhaenger(fz, gel);
  }

  /* Fahrzeug frei in die Luft stellen (für die Ballon-Animation) */
  function setzePose(fz, x, y, a) {
    var C = fz.chassis, ca = Math.cos(a), sa = Math.sin(a);
    C.x = x; C.y = y; C.a = a; C.vx = C.vy = C.w = 0;
    fz.raeder.forEach(function (R) {
      var lx = R.ankerX, ly = R.ankerY - R.L0;
      R.k.x = x + ca * lx - sa * ly; R.k.y = y + sa * lx + ca * ly;
      R.k.vx = R.k.vy = 0; R.k.w *= 0.9;
      R.trans = R.L0;
      R.kontakt.aktiv = false;
    });
    fz.kopf.kontakt.aktiv = false;
    fz.huelle.forEach(function (p) { p.kontakt.aktiv = false; });
    if (fz.anhaenger && fz.anhaenger.length) folgeAnhaenger(fz, null);
  }

  /* -------------------------------------------------------------------------
     Kontakt-Helfer (gleich für Rad, Karosseriepunkt und Kopf)
     ------------------------------------------------------------------------- */
  function vorbereiteKontakt(b, ko, h, abprall, mu, P) {
    var rn = ko.rx * ko.ny - ko.ry * ko.nx;
    ko.mn = 1 / (b.im + b.iJ * rn * rn);
    var tx = ko.ny, ty = -ko.nx;
    var rt = ko.rx * ty - ko.ry * tx;
    ko.mt = 1 / (b.im + b.iJ * rt * rt);
    var vx = b.vx - b.w * ko.ry, vy = b.vy + b.w * ko.rx;
    var vn = vx * ko.nx + vy * ko.ny;
    var ziel;
    if (ko.pen > P.eindringToleranz) ziel = P.baumgarte / h * (ko.pen - P.eindringToleranz);
    else if (ko.pen < 0) ziel = ko.pen / h;      // spekulativ: darf sich bis zur Berührung nähern
    else ziel = 0;
    if (vn < -1.0 && ko.pen > -0.02) ziel = Math.max(ziel, -abprall * vn);
    ko.ziel = ziel;
    ko.mu = mu;
    if (ko.warAktiv) {
      var px = ko.jn * ko.nx + ko.jt * tx, py = ko.jn * ko.ny + ko.jt * ty;
      b.vx += px * b.im; b.vy += py * b.im;
      b.w += b.iJ * (ko.rx * py - ko.ry * px) + b.iJ * ko.jr;
    } else {
      ko.jn = ko.jt = ko.jr = 0;
    }
  }

  function loeseNormal(b, ko) {
    var vx = b.vx - b.w * ko.ry, vy = b.vy + b.w * ko.rx;
    var vn = vx * ko.nx + vy * ko.ny;
    var dj = ko.mn * (ko.ziel - vn);
    var j0 = ko.jn;
    ko.jn = Math.max(j0 + dj, 0);
    dj = ko.jn - j0;
    var px = dj * ko.nx, py = dj * ko.ny;
    b.vx += px * b.im; b.vy += py * b.im;
    b.w += b.iJ * (ko.rx * py - ko.ry * px);
  }

  function loeseReibung(b, ko) {
    var tx = ko.ny, ty = -ko.nx;
    var vx = b.vx - b.w * ko.ry, vy = b.vy + b.w * ko.rx;
    var vt = vx * tx + vy * ty - ko.vBand;          // Haften RELATIV zum Boden (Förderband: Boden läuft mit vBand)
    var dj = -ko.mt * vt;
    var max = ko.mu * ko.jn, j0 = ko.jt;
    ko.jt = Math.max(-max, Math.min(max, j0 + dj));
    dj = ko.jt - j0;
    var px = dj * tx, py = dj * ty;
    b.vx += px * b.im; b.vy += py * b.im;
    b.w += b.iJ * (ko.rx * py - ko.ry * px);
  }

  function loeseRollwiderstand(b, ko) {
    if (ko.rollMax <= 0) return;
    var dj = -b.w * b.J;
    var max = ko.rollMax * ko.jn, j0 = ko.jr;
    ko.jr = Math.max(-max, Math.min(max, j0 + dj));
    b.w += b.iJ * (ko.jr - j0);
  }

  /* -------------------------------------------------------------------------
     Ein Zeitschritt h
     ------------------------------------------------------------------------- */
  var tmp = { pen: 0, nx: 0, ny: 1 };
  var WIND_BEZUG = 0.45 / 240;            // cw·A / Masse des Flitzers [m²/kg]

  /* 1) Äußere Kräfte → Geschwindigkeiten (für ein Teil: Lok oder Anhänger) */
  function kraefte(T, gel, welt, h) {
    var w = T.werte, C = T.chassis, RR = T.raeder, nR = RR.length, i;
    var g = welt.schwerkraft * (gel.schwereBei ? gel.schwereBei(C.x) : 1);   // Schwebe-Säulen: fast keine Schwerkraft
    C.vy -= g * h;
    for (i = 0; i < nR; i++) RR[i].k.vy -= g * h;
    var rho = welt.luftdichte;
    if (rho > 0) {
      var v2 = C.vx * C.vx + C.vy * C.vy;
      if (v2 > 1e-4) {
        var v = Math.sqrt(v2), Fw = 0.5 * rho * w.cwA * v2;
        C.vx -= Fw * C.vx / v * C.im * h;
        C.vy -= Fw * C.vy / v * C.im * h;
        if (w.abtrieb > 0) {
          var ca0 = Math.cos(C.a), sa0 = Math.sin(C.a);
          var vf = C.vx * ca0 + C.vy * sa0;
          var Fa = 0.5 * rho * w.abtrieb * vf * vf;     // wirkt entlang der Fahrzeug-Hochachse nach unten
          C.vx += Fa * sa0 * C.im * h;
          C.vy -= Fa * ca0 * C.im * h;
        }
      }
    }
    C.w += T.zusatzMoment * C.iJ * h;
    // Wasser dämpft Drehungen (Meeresgrund): ω nimmt mit der Rate drehDaempfung [1/s] ab
    if (welt.drehDaempfung) C.w -= C.w * Math.min(1, welt.drehDaempfung * h);
    // Sturm (Herbststurm): Wind schiebt von hinten oder bremst von vorn – als Beschleunigung
    // auf Karosserie und Räder. Wer viel Fläche (cw·A) und wenig Masse hat, wird stärker
    // gepustet (Moped stark, Rennwagen schwach); Bezug ist der Flitzer.
    var aWind = gel.windBei ? gel.windBei(C.x) : 0;
    if (aWind) {
      aWind *= Math.max(0.6, Math.min(w.windMax || 1.5, w.cwA / w.masse / WIND_BEZUG));
      C.vx += aWind * h;
      for (i = 0; i < nR; i++) RR[i].k.vx += aWind * h;
    }
  }

  /* Luftsteuerung beim Zug: der ganze Zug dreht sich wie ein Starrkörper um seinen
     gemeinsamen Schwerpunkt mit der Winkelbeschleunigung alpha [rad/s²] – kein
     Netto-Schub, die Gelenke bleiben unbelastet. */
  function zugDrehen(fz, alpha, h) {
    var M = 0, sx = 0, sy = 0;
    alleKoerper(fz, function (k) { M += k.m; sx += k.m * k.x; sy += k.m * k.y; });
    sx /= M; sy /= M;
    var dw = alpha * h;
    alleKoerper(fz, function (k) { k.vx -= dw * (k.y - sy); k.vy += dw * (k.x - sx); });
    fz.chassis.w += dw;
    fz.anhaenger.forEach(function (A) { A.chassis.w += dw; });
  }

  /* Schnee-Schlitten: Reibwert einer Kufe. Auf Schnee (von der Kanone gelegt oder in einer
     Schneewelt) gleitet sie, auf blankem Boden kratzt sie. Looping-Bahnen und andere
     Flächen über dem Boden sind glatt (Metall/Holz). Die Bremskralle gräbt sich ein. */
  function kufenMu(T, gel, welt, k, R, ko) {
    var K = T.werte.kufen;
    var px = k.x - R.r * ko.nx, py = k.y - R.r * ko.ny;
    var aufBoden = ko.ny > 0.35 && Math.abs(py - gel.hoeheBei(px)) < 0.25;
    var glatt = !aufBoden || welt.schneeBoden || (gel.schneeBei && gel.schneeBei(px));
    return (glatt ? K.muSchnee : K.muKratz) + (T.kufenBremse || 0) * K.bremsMu;
  }

  /* 2) Kontakte erkennen + 3) vorbereiten (inkl. Warmstart) */
  function kontakteVorbereiten(T, gel, welt, h, P) {
    var C = T.chassis, RR = T.raeder, nR = RR.length, i, R, k, ko, p;
    var ca = Math.cos(C.a), sa = Math.sin(C.a);
    var grip = T.werte.grip * welt.grip, crr = welt.rollwiderstand, abprall = welt.abprall;
    var band = gel.baender && gel.baender.length > 0;
    for (i = 0; i < nR; i++) {
      R = RR[i]; k = R.k; ko = R.kontakt;
      ko.warAktiv = ko.aktiv;
      ko.aktiv = gel.kreisKontakt(k.x, k.y, R.r, P.kontaktRand, tmp, T.ohneLoop);
      if (ko.aktiv) {
        ko.pen = tmp.pen; ko.nx = tmp.nx; ko.ny = tmp.ny;
        ko.rx = -R.r * ko.nx; ko.ry = -R.r * ko.ny;
        ko.rollMax = crr * R.r;
        ko.vBand = band ? gel.bandBei(k.x) : 0;
        vorbereiteKontakt(k, ko, h, abprall, T.werte.kufen ? kufenMu(T, gel, welt, k, R, ko)
          : T.werte.schweben ? (T.schwebeMu !== undefined ? T.schwebeMu : T.werte.schweben.mu) + (T.kufenBremse || 0) * T.werte.schweben.bremsMu : grip, P);
      } else { ko.jn = ko.jt = ko.jr = 0; }
    }
    var muH = P.huellReibung * welt.grip;
    for (i = 0; i < T.huelle.length; i++) {
      p = T.huelle[i]; ko = p.kontakt;
      var rx = ca * p.x - sa * p.y, ry = sa * p.x + ca * p.y;
      ko.warAktiv = ko.aktiv;
      ko.aktiv = gel.punktKontakt(C.x + rx, C.y + ry, P.kontaktRand, tmp);
      if (ko.aktiv) {
        ko.pen = tmp.pen; ko.nx = tmp.nx; ko.ny = tmp.ny; ko.rx = rx; ko.ry = ry; ko.rollMax = 0;
        ko.vBand = band ? gel.bandBei(C.x + rx) : 0;
        vorbereiteKontakt(C, ko, h, Math.max(P.huellAbprall, abprall * 0.5), muH, P);
      } else { ko.jn = ko.jt = 0; }
    }
    var kp = T.kopf;
    if (kp) {
      ko = kp.kontakt;
      var kx = ca * kp.x - sa * kp.y, ky = sa * kp.x + ca * kp.y;
      ko.warAktiv = ko.aktiv;
      ko.aktiv = gel.kreisKontakt(C.x + kx, C.y + ky, kp.r, P.kontaktRand, tmp, true);
      if (ko.aktiv) {
        ko.pen = tmp.pen; ko.nx = tmp.nx; ko.ny = tmp.ny;
        ko.rx = kx - kp.r * ko.nx; ko.ry = ky - kp.r * ko.ny; ko.rollMax = 0;
        vorbereiteKontakt(C, ko, h, 0.2, muH, P);
      } else { ko.jn = ko.jt = 0; }
    }
  }

  // Radaufhängungen vorbereiten
  function aufhaengungVorbereiten(T, h, P) {
    var C = T.chassis, RR = T.raeder, nR = RR.length, R, k;
    var ca = Math.cos(C.a), sa = Math.sin(C.a);
    for (var i = 0; i < nR; i++) {
      R = RR[i]; k = R.k;
      var rAx = ca * R.ankerX - sa * R.ankerY, rAy = sa * R.ankerX + ca * R.ankerY;
      R.axx = sa; R.axy = -ca;           // Federachse = Fahrzeug-"unten"
      R.ayx = ca; R.ayy = sa;            // quer dazu = Fahrzeug-"vorn"
      var dx = k.x - (C.x + rAx), dy = k.y - (C.y + rAy);
      R.trans = dx * R.axx + dy * R.axy;
      var quer = dx * R.ayx + dy * R.ayy;
      var ex = k.x - C.x, ey = k.y - C.y;           // d + rA
      R.sAx = ex * R.axy - ey * R.axx;
      R.sAy = ex * R.ayy - ey * R.ayx;
      R.mAx = 1 / (C.im + k.im + C.iJ * R.sAx * R.sAx);
      R.mLinie = 1 / (C.im + k.im + C.iJ * R.sAy * R.sAy);
      R.mMotor = 1 / (C.iJ + k.iJ);
      // weiche Feder (Catto)
      var gam = h * (R.cF + h * R.kF);
      R.gamma = gam > 0 ? 1 / gam : 0;
      R.biasF = (R.trans - R.L0) * h * R.kF * R.gamma;
      R.mFeder = 1 / (1 / R.mAx + R.gamma);
      R.biasLinie = P.baumgarte / h * quer;
      R.cUnten = R.trans - R.Lmin;
      R.cOben = R.Lmax - R.trans;
      // Warmstart (Motor-Impuls auf das aktuelle Höchstmoment begrenzen)
      var mxw = R.motorMax * h;
      R.jMotor = Math.max(-mxw, Math.min(mxw, R.jMotor));
      var ja = R.jFeder + R.jUnten - R.jOben;
      var Px = ja * R.axx + R.jLinie * R.ayx, Py = ja * R.axy + R.jLinie * R.ayy;
      C.vx -= Px * C.im; C.vy -= Py * C.im;
      C.w -= C.iJ * (ja * R.sAx + R.jLinie * R.sAy + R.jMotor);
      k.vx += Px * k.im; k.vy += Py * k.im;
      k.w += k.iJ * R.jMotor;
    }
  }

  /* Gelenk (Deichsel ↔ Kupplung) vorbereiten: weiche Punkt-Bindung + Knickgrenze */
  function gelenkVorbereiten(A, V, h, P) {
    var G = A.gelenk, CA = V.chassis, CB = A.chassis;
    var caA = Math.cos(CA.a), saA = Math.sin(CA.a), caB = Math.cos(CB.a), saB = Math.sin(CB.a);
    G.rAx = caA * G.haken[0] - saA * G.haken[1]; G.rAy = saA * G.haken[0] + caA * G.haken[1];
    G.rBx = caB * G.deichsel[0] - saB * G.deichsel[1]; G.rBy = saB * G.deichsel[0] + caB * G.deichsel[1];
    var cx = CB.x + G.rBx - CA.x - G.rAx, cy = CB.y + G.rBy - CA.y - G.rAy;
    var gam = h * (G.c + h * G.k);
    G.gamma = gam > 0 ? 1 / gam : 0;
    var beta = h * G.k * G.gamma;
    // Fehler begrenzen (z. B. direkt nach der Röhre), damit nichts herumgeschleudert wird
    var e = Math.hypot(cx, cy), eMax = 0.4;
    if (e > eMax) { cx *= eMax / e; cy *= eMax / e; }
    G.bx = beta * cx; G.by = beta * cy;
    var mi = CA.im + CB.im;
    var k11 = mi + CA.iJ * G.rAy * G.rAy + CB.iJ * G.rBy * G.rBy + G.gamma;
    var k12 = -CA.iJ * G.rAx * G.rAy - CB.iJ * G.rBx * G.rBy;
    var k22 = mi + CA.iJ * G.rAx * G.rAx + CB.iJ * G.rBx * G.rBx + G.gamma;
    var det = k11 * k22 - k12 * k12; det = det !== 0 ? 1 / det : 0;
    G.m11 = det * k22; G.m12 = -det * k12; G.m22 = det * k11;     // Inverse der 2×2-Matrix
    // Knickgrenze
    G.winkel = normW(CB.a - CA.a);
    G.mDreh = 1 / (CA.iJ + CB.iJ);
    G.cU = G.winkel + G.knick;            // ≥ 0
    G.cO = G.knick - G.winkel;            // ≥ 0
    // Warmstart
    var px = G.jx, py = G.jy, jd = G.jUnten - G.jOben;
    CA.vx -= px * CA.im; CA.vy -= py * CA.im; CA.w -= CA.iJ * (G.rAx * py - G.rAy * px) + CA.iJ * jd;
    CB.vx += px * CB.im; CB.vy += py * CB.im; CB.w += CB.iJ * (G.rBx * py - G.rBy * px) + CB.iJ * jd;
  }

  function gelenkLoesen(A, V, h, P) {
    var G = A.gelenk, CA = V.chassis, CB = A.chassis, inv_h = 1 / h;
    // Punkt-Bindung
    var vx = CB.vx - CB.w * G.rBy - CA.vx + CA.w * G.rAy;
    var vy = CB.vy + CB.w * G.rBx - CA.vy - CA.w * G.rAx;
    var bx = vx + G.bx + G.gamma * G.jx, by = vy + G.by + G.gamma * G.jy;
    var dx = -(G.m11 * bx + G.m12 * by), dy = -(G.m12 * bx + G.m22 * by);
    G.jx += dx; G.jy += dy;
    CA.vx -= dx * CA.im; CA.vy -= dy * CA.im; CA.w -= CA.iJ * (G.rAx * dy - G.rAy * dx);
    CB.vx += dx * CB.im; CB.vy += dy * CB.im; CB.w += CB.iJ * (G.rBx * dy - G.rBy * dx);
    // Knickgrenze unten: winkel ≥ -knick
    var cd = CB.w - CA.w, c = G.cU, j0, dj;
    dj = -G.mDreh * (cd + (c > 0 ? c * inv_h : Math.max(-3, P.baumgarte * c * inv_h)));
    j0 = G.jUnten; G.jUnten = Math.max(j0 + dj, 0); dj = G.jUnten - j0;
    CA.w -= CA.iJ * dj; CB.w += CB.iJ * dj;
    // Knickgrenze oben: winkel ≤ knick
    cd = -(CB.w - CA.w); c = G.cO;
    dj = -G.mDreh * (cd + (c > 0 ? c * inv_h : Math.max(-3, P.baumgarte * c * inv_h)));
    j0 = G.jOben; G.jOben = Math.max(j0 + dj, 0); dj = G.jOben - j0;
    CA.w += CA.iJ * dj; CB.w -= CB.iJ * dj;
  }

  /* 4) eine Iteration für ein Teil: Aufhängungen, dann Bodenkontakte */
  function iteriere(T, P, h, inv_h, beta) {
    var C = T.chassis, RR = T.raeder, nR = RR.length, i, R, k, ko;
    for (i = 0; i < nR; i++) {
      R = RR[i]; k = R.k;
      var cd, dj, j0, mx;

      // Motor / Bremse (relative Drehzahl, begrenztes Moment)
      if (R.motorMax > 0) {
        cd = k.w - C.w - R.motorZiel;
        dj = -R.mMotor * cd;
        j0 = R.jMotor; mx = R.motorMax * h;
        R.jMotor = Math.max(-mx, Math.min(mx, j0 + dj));
        dj = R.jMotor - j0;
        C.w -= C.iJ * dj; k.w += k.iJ * dj;
      }

      // Feder-Dämpfer (weich)
      cd = R.axx * (k.vx - C.vx) + R.axy * (k.vy - C.vy) - R.sAx * C.w;
      dj = -R.mFeder * (cd + R.biasF + R.gamma * R.jFeder);
      R.jFeder += dj;
      axial(C, k, R, dj);

      // Anschlag unten (voll eingefedert): trans ≥ Lmin
      cd = R.axx * (k.vx - C.vx) + R.axy * (k.vy - C.vy) - R.sAx * C.w;
      var cu = R.cUnten;
      dj = -R.mAx * (cd + (cu > 0 ? cu * inv_h : beta * cu * inv_h));
      j0 = R.jUnten; R.jUnten = Math.max(j0 + dj, 0); dj = R.jUnten - j0;
      axial(C, k, R, dj);

      // Anschlag oben (voll ausgefedert): trans ≤ Lmax
      cd = -(R.axx * (k.vx - C.vx) + R.axy * (k.vy - C.vy) - R.sAx * C.w);
      var co = R.cOben;
      dj = -R.mAx * (cd + (co > 0 ? co * inv_h : beta * co * inv_h));
      j0 = R.jOben; R.jOben = Math.max(j0 + dj, 0); dj = R.jOben - j0;
      axial(C, k, R, -dj);

      // Linienführung quer zur Federachse (hart)
      cd = R.ayx * (k.vx - C.vx) + R.ayy * (k.vy - C.vy) - R.sAy * C.w;
      dj = -R.mLinie * (cd + R.biasLinie);
      R.jLinie += dj;
      var qx = dj * R.ayx, qy = dj * R.ayy;
      C.vx -= qx * C.im; C.vy -= qy * C.im; C.w -= C.iJ * dj * R.sAy;
      k.vx += qx * k.im; k.vy += qy * k.im;
    }

    // Kuppelstangen (Dampf-Lok): alle Räder drehen gleich schnell über den Boden –
    // (ω₀ − ω_K)·r₀ = (ωᵢ − ω_K)·rᵢ. So kann kein Rad allein durchdrehen.
    if (T.gekuppelt) {
      var R0 = RR[0], k0 = R0.k;
      for (i = 1; i < nR; i++) {
        R = RR[i]; k = R.k;
        var cdK = (k0.w - C.w) * R0.r - (k.w - C.w) * R.r;
        var dr = R.r - R0.r;
        var mK = 1 / (k0.iJ * R0.r * R0.r + k.iJ * R.r * R.r + C.iJ * dr * dr);
        var lam = -mK * cdK;
        k0.w += k0.iJ * R0.r * lam; k.w -= k.iJ * R.r * lam; C.w += C.iJ * dr * lam;
      }
    }

    // Bodenkontakte: erst Normal-, dann Reibimpulse
    for (i = 0; i < nR; i++) {
      ko = RR[i].kontakt;
      if (!ko.aktiv) continue;
      loeseNormal(RR[i].k, ko);
      loeseReibung(RR[i].k, ko);
      loeseRollwiderstand(RR[i].k, ko);
    }
    for (i = 0; i < T.huelle.length; i++) {
      ko = T.huelle[i].kontakt;
      if (!ko.aktiv) continue;
      loeseNormal(C, ko); loeseReibung(C, ko);
    }
    if (T.kopf) {
      ko = T.kopf.kontakt;
      if (ko.aktiv) { loeseNormal(C, ko); loeseReibung(C, ko); }
    }
  }

  /* 5) Lage integrieren */
  function integriere(T, P, h) {
    var C = T.chassis, RR = T.raeder, k;
    if (C.w > P.maxWinkelGeschw) C.w = P.maxWinkelGeschw;
    if (C.w < -P.maxWinkelGeschw) C.w = -P.maxWinkelGeschw;
    C.x += C.vx * h; C.y += C.vy * h; C.a += C.w * h;
    for (var i = 0; i < RR.length; i++) {
      k = RR[i].k;
      k.x += k.vx * h; k.y += k.vy * h; k.a += k.w * h;
    }
  }

  /* 6) Status für Spiel, Anzeige und Tankverbrauch */
  function status(T, h) {
    var C = T.chassis, RR = T.raeder, nR = RR.length, R, ko, p, i, inv_h = 1 / h;
    var st = T.status, schwelle = -0.015;
    st.radKontakte = 0; st.leistung = 0; st.drehzahl = 0;
    var nAntrieb = 0;
    for (i = 0; i < nR; i++) {
      R = RR[i]; ko = R.kontakt;
      ko.kraftN = ko.aktiv ? ko.jn * inv_h : 0;
      ko.kraftT = ko.aktiv ? ko.jt * inv_h : 0;
      if (ko.aktiv && ko.pen > schwelle) st.radKontakte++;
      if (R.antrieb) {
        var rel = R.k.w - C.w;
        st.leistung += Math.abs(R.jMotor * inv_h * rel) * (R.motorZiel !== 0 ? 1 : 0);
        st.drehzahl += Math.abs(rel) / R.wMax;
        nAntrieb++;
      }
    }
    if (nAntrieb > 0) st.drehzahl /= nAntrieb;
    st.huellKontakt = false; st.dachKontakt = false;
    for (i = 0; i < T.huelle.length; i++) {
      p = T.huelle[i]; ko = p.kontakt;
      ko.kraftN = ko.aktiv ? ko.jn * inv_h : 0;
      if (ko.aktiv && ko.pen > schwelle) {
        st.huellKontakt = true;
        if (p.dach) st.dachKontakt = true;
      }
    }
    if (T.kopf) { ko = T.kopf.kontakt; st.kopfKontakt = ko.aktiv && ko.pen > schwelle; }
    st.vorwaerts = C.vx * Math.cos(C.a) + C.vy * Math.sin(C.a);
    st.tempo = Math.sqrt(C.vx * C.vx + C.vy * C.vy);
  }

  function schritt(fz, gel, welt, h) {
    var P = FF.CONFIG.physik, AN = fz.anhaenger || [], nA = AN.length, i, it;
    kraefte(fz, gel, welt, h);
    for (i = 0; i < nA; i++) kraefte(AN[i], gel, welt, h);
    if (nA && fz.zusatzAlpha) zugDrehen(fz, fz.zusatzAlpha, h);

    kontakteVorbereiten(fz, gel, welt, h, P);
    aufhaengungVorbereiten(fz, h, P);
    for (i = 0; i < nA; i++) {
      AN[i].ohneLoop = true;                            // Anhänger fahren nie Looping-Bahn
      kontakteVorbereiten(AN[i], gel, welt, h, P);
      aufhaengungVorbereiten(AN[i], h, P);
      gelenkVorbereiten(AN[i], vordermann(fz, i), h, P);
    }

    var inv_h = 1 / h, beta = P.baumgarte;
    for (it = 0; it < P.iterationen; it++) {
      iteriere(fz, P, h, inv_h, beta);
      for (i = 0; i < nA; i++) {
        iteriere(AN[i], P, h, inv_h, beta);
        gelenkLoesen(AN[i], vordermann(fz, i), h, P);
      }
    }

    integriere(fz, P, h);
    status(fz, h);
    var anBoden = false;
    for (i = 0; i < nA; i++) {
      integriere(AN[i], P, h);
      status(AN[i], h);
      if (AN[i].status.radKontakte > 0 || AN[i].status.huellKontakt) anBoden = true;
    }
    fz.status.anhaengerBoden = anBoden;
  }

  function axial(C, k, R, dj) {
    var px = dj * R.axx, py = dj * R.axy;
    C.vx -= px * C.im; C.vy -= py * C.im; C.w -= C.iJ * dj * R.sAx;
    k.vx += px * k.im; k.vy += py * k.im;
  }

  FF.Physik = {
    Koerper: Koerper,
    baueFahrzeug: baueFahrzeug,
    setzeAufBoden: setzeAufBoden,
    setzePose: setzePose,
    folgeAnhaenger: folgeAnhaenger,
    stelleTeil: stelleTeil,
    zugHinten: zugHinten,
    vordermann: vordermann,
    stoss: stoss,
    anhaengerTempo: anhaengerTempo,
    schritt: schritt
  };
})();
