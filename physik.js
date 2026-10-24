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
     • Luftwiderstand ½·ρ·cwA·v² und Abtrieb ½·ρ·cA·v².

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
  }

  /* -------------------------------------------------------------------------
     Fahrzeug bauen
     w = wirksame Fahrzeugwerte (siehe FF.berechneWerte in fahrt.js)
     ------------------------------------------------------------------------- */
  function baueFahrzeug(w, startX, gelaende) {
    var P = FF.CONFIG.physik;
    var J = w.masse * (w.groesse.laenge * w.groesse.laenge + w.groesse.hoehe * w.groesse.hoehe) / 12;
    var fz = {
      werte: w,
      chassis: new Koerper(w.masse, J),
      raeder: [],
      huelle: [],
      kopf: { x: w.kopf.x, y: w.kopf.y, r: w.kopf.r, kontakt: new Kontakt() },
      zusatzMoment: 0,
      status: { radKontakte: 0, huellKontakt: false, dachKontakt: false, kopfKontakt: false,
                leistung: 0, drehzahl: 0, vorwaerts: 0, tempo: 0 }
    };

    var fed = w.federung;
    var mGefedert = w.masse / w.raeder.length;
    var om = 2 * Math.PI * fed.frequenz;
    w.raeder.forEach(function (rd) {
      var k = new Koerper(rd.masse, 0.6 * rd.masse * rd.r * rd.r); // Masse sitzt eher außen (Reifen)
      fz.raeder.push({
        k: k, r: rd.r, ankerX: rd.x, ankerY: rd.y, antrieb: !!rd.antrieb,
        L0: fed.ruhe, Lmin: fed.ruhe - fed.weg, Lmax: fed.ruhe,
        kF: mGefedert * om * om, cF: 2 * fed.daempfung * mGefedert * om,
        wMax: w.motor.vmax / rd.r,
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
        fz.huelle.push({ x: a[0] + (b[0] - a[0]) * t, y: a[1] + (b[1] - a[1]) * t, dach: false, kontakt: new Kontakt() });
      }
    }
    (w.dach || []).forEach(function (d) {
      fz.huelle.push({ x: d[0], y: d[1], dach: true, kontakt: new Kontakt() });
    });

    setzeAufBoden(fz, gelaende, startX, 0);
    return fz;
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
    var vt = vx * tx + vy * ty;
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

  function schritt(fz, gel, welt, h) {
    var P = FF.CONFIG.physik, w = fz.werte;
    var C = fz.chassis, RR = fz.raeder, nR = RR.length;
    var g = welt.schwerkraft;
    var i, it, R, k, ko, p;

    /* 1) Äußere Kräfte → Geschwindigkeiten */
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
    C.w += fz.zusatzMoment * C.iJ * h;

    var ca = Math.cos(C.a), sa = Math.sin(C.a);
    var grip = w.grip * welt.grip, crr = welt.rollwiderstand, abprall = welt.abprall;

    /* 2) Kontakte erkennen + 3) vorbereiten (inkl. Warmstart) */
    for (i = 0; i < nR; i++) {
      R = RR[i]; k = R.k; ko = R.kontakt;
      ko.warAktiv = ko.aktiv;
      ko.aktiv = gel.kreisKontakt(k.x, k.y, R.r, P.kontaktRand, tmp);
      if (ko.aktiv) {
        ko.pen = tmp.pen; ko.nx = tmp.nx; ko.ny = tmp.ny;
        ko.rx = -R.r * ko.nx; ko.ry = -R.r * ko.ny;
        ko.rollMax = crr * R.r;
        vorbereiteKontakt(k, ko, h, abprall, grip, P);
      } else { ko.jn = ko.jt = ko.jr = 0; }
    }
    var muH = P.huellReibung * welt.grip;
    for (i = 0; i < fz.huelle.length; i++) {
      p = fz.huelle[i]; ko = p.kontakt;
      var rx = ca * p.x - sa * p.y, ry = sa * p.x + ca * p.y;
      ko.warAktiv = ko.aktiv;
      ko.aktiv = gel.punktKontakt(C.x + rx, C.y + ry, P.kontaktRand, tmp);
      if (ko.aktiv) {
        ko.pen = tmp.pen; ko.nx = tmp.nx; ko.ny = tmp.ny; ko.rx = rx; ko.ry = ry; ko.rollMax = 0;
        vorbereiteKontakt(C, ko, h, Math.max(P.huellAbprall, abprall * 0.5), muH, P);
      } else { ko.jn = ko.jt = 0; }
    }
    var kp = fz.kopf; ko = kp.kontakt;
    var kx = ca * kp.x - sa * kp.y, ky = sa * kp.x + ca * kp.y;
    ko.warAktiv = ko.aktiv;
    ko.aktiv = gel.kreisKontakt(C.x + kx, C.y + ky, kp.r, P.kontaktRand, tmp);
    if (ko.aktiv) {
      ko.pen = tmp.pen; ko.nx = tmp.nx; ko.ny = tmp.ny;
      ko.rx = kx - kp.r * ko.nx; ko.ry = ky - kp.r * ko.ny; ko.rollMax = 0;
      vorbereiteKontakt(C, ko, h, 0.2, muH, P);
    } else { ko.jn = ko.jt = 0; }

    // Radaufhängungen vorbereiten
    for (i = 0; i < nR; i++) {
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

    /* 4) Iterieren */
    var inv_h = 1 / h, beta = P.baumgarte;
    for (it = 0; it < P.iterationen; it++) {
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

      // Bodenkontakte: erst Normal-, dann Reibimpulse
      for (i = 0; i < nR; i++) {
        ko = RR[i].kontakt;
        if (!ko.aktiv) continue;
        loeseNormal(RR[i].k, ko);
        loeseReibung(RR[i].k, ko);
        loeseRollwiderstand(RR[i].k, ko);
      }
      for (i = 0; i < fz.huelle.length; i++) {
        ko = fz.huelle[i].kontakt;
        if (!ko.aktiv) continue;
        loeseNormal(C, ko); loeseReibung(C, ko);
      }
      ko = fz.kopf.kontakt;
      if (ko.aktiv) { loeseNormal(C, ko); loeseReibung(C, ko); }
    }

    /* 5) Lage integrieren */
    if (C.w > P.maxWinkelGeschw) C.w = P.maxWinkelGeschw;
    if (C.w < -P.maxWinkelGeschw) C.w = -P.maxWinkelGeschw;
    C.x += C.vx * h; C.y += C.vy * h; C.a += C.w * h;
    for (i = 0; i < nR; i++) {
      k = RR[i].k;
      k.x += k.vx * h; k.y += k.vy * h; k.a += k.w * h;
    }

    /* 6) Status für Spiel, Anzeige und Tankverbrauch */
    var st = fz.status, schwelle = -0.015;
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
    for (i = 0; i < fz.huelle.length; i++) {
      p = fz.huelle[i]; ko = p.kontakt;
      ko.kraftN = ko.aktiv ? ko.jn * inv_h : 0;
      if (ko.aktiv && ko.pen > schwelle) {
        st.huellKontakt = true;
        if (p.dach) st.dachKontakt = true;
      }
    }
    ko = fz.kopf.kontakt;
    st.kopfKontakt = ko.aktiv && ko.pen > schwelle;
    st.vorwaerts = C.vx * Math.cos(C.a) + C.vy * Math.sin(C.a);
    st.tempo = Math.sqrt(C.vx * C.vx + C.vy * C.vy);
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
    schritt: schritt
  };
})();
