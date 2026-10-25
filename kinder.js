/* ===========================================================================
   Fiete Flitzer – kinder.js
   ---------------------------------------------------------------------------
   So sehen Fiete und Jonte aus: Gesicht, Haare, Augen, Brille.
   Nachgebaut nach einem Foto der beiden (Steckbrief: docs/KINDER.md).

   Die Datei ist eigenständig. Sie braucht nur einen Canvas-2D-Kontext und
   keine andere Spieldatei. Die Vorschau werkzeuge/kinder-vorschau.html
   zeigt beide Kinder in allen Größen.

   Koordinaten wie im Spiel: Meter, y nach oben, das Kind schaut nach +x
   (Dreiviertel-Ansicht). Gezeichnet wird in „Kopf-Einheiten“: 1 = Kopfradius r.
   Dadurch skalieren auch Linienbreiten und Verläufe mit dem Kopf.

   Schnittstelle (FF.Kinder):
     zeichneKopf(ctx, x, y, r, ausdruck, raumhelm, kind, wind, zeit)
         Kopf mit Mittelpunkt (x, y) und Radius r. Gleiche Parameter wie das
         bisherige zeichneKind() in grafik.js, also direkt austauschbar.
           ausdruck  "normal" | "freude" | "staunen"
           kind      Eintrag aus CONFIG.kinder (wichtig ist nur kind.id)
           wind      0..1 Fahrtwind (Haare wehen), zeit in Sekunden
     zeichneKopfbild(ctx, b, h, kind, ausdruck, zeit)
         Nur-Kopf-Bild in einem Rechteck b × h (Bildschirm-Pixel, y nach
         unten). Beide Kinder haben darin dieselbe Kopfgröße.
     aussehenVon(kind)   Steckbrief-Daten des Kindes (Farben, Frisur …)
     AUSSEHEN            alle Steckbriefe, nach id
   =========================================================================== */

var FF = globalThis.FF = globalThis.FF || {};

(function () {
  "use strict";

  /* =========================================================================
     1) STECKBRIEFE – hier ändert man das Aussehen
       haut, hautRand        Hautfarbe und Kontur (auch für Hals und Hände)
       wangen                Farbe der Bäckchen
       haar, haarHell,       Haarfarbe: Grundton, Glanz/Spitzen, Schatten
       haarDunkel
       brauen, augen         Augenbrauen, Iris
       frisur                "pony" (Fiete) | "dutt" | "lang" (Jonte)
       gesicht.breite        < 1 = schmaleres Gesicht
       gesicht.hoehe         > 1 = längeres Gesicht (Kinn tiefer)
       gesicht.kinn          0..0.3: Kinn schmaler, spitzer
       ohr                   Ohrgröße (1 = normal, größer = abstehend)
       brille                null = keine, sonst Rahmen- und Glasfarbe
       mund                  "verschmitzt" | "schief" (Form des Lächelns)
     ========================================================================= */
  var AUSSEHEN = {
    // Fiete: rotblond (Kupfergold mit dunklerem Ansatz), Pony seitlich in die
    // Stirn gekämmt, Ohren halb unter den Haaren, rundes Gesicht, braune Augen
    fiete: {
      haut: "#ffdcc6", hautRand: "#d99a7c", wangen: "rgba(255,112,100,0.34)",
      haar: "#dc9a52", haarHell: "#f6cd8c", haarDunkel: "#a2622d",
      brauen: "#c08a55", augen: "#5c3519",
      frisur: "pony",
      gesicht: { breite: 1, hoehe: 1, kinn: 0.04 },
      ohr: 1,
      brille: null,
      mund: "verschmitzt"
    },
    // Jonte: hellbraun (etwas aschig), lange Haare, hier zum Dutt gebunden,
    // hohe freie Stirn mit feinen Härchen, runde schwarze Brille, Ohren
    // stehen etwas ab, schmaleres und längeres Gesicht, braune Augen
    jonte: {
      haut: "#ffdcc9", hautRand: "#d69c84", wangen: "rgba(255,120,110,0.24)",
      haar: "#9a7a5e", haarHell: "#c6a888", haarDunkel: "#64493a",
      brauen: "#8c6a52", augen: "#563520",
      frisur: "dutt",                // "dutt" wie auf dem Foto, "lang" = offen bis zur Schulter
      gesicht: { breite: 0.9, hoehe: 1.09, kinn: 0.18 },
      ohr: 1.18,
      brille: { rahmen: "#1d1918", glas: "rgba(214,236,255,0.22)" },
      mund: "schief"
    }
  };

  // Ältere oder neue Einträge ohne Steckbrief: aus den CONFIG-Feldern ableiten
  function aussehenVon(kind) {
    if (kind && AUSSEHEN[kind.id]) return AUSSEHEN[kind.id];
    if (!kind || !kind.haar) return AUSSEHEN.fiete;
    return {
      haut: kind.haut, hautRand: kind.hautRand, wangen: "rgba(255,120,110,0.3)",
      haar: kind.haar, haarHell: kind.haarHell || kind.haar, haarDunkel: kind.haarDunkel,
      brauen: kind.haarDunkel, augen: kind.augen,
      frisur: kind.frisur === "lang" ? "lang" : "pony",
      gesicht: { breite: 0.5 + 0.5 * (kind.breite || 1), hoehe: 1, kinn: 0.05 },
      ohr: 1, brille: null, mund: "verschmitzt"
    };
  }

  /* =========================================================================
     2) HELFER
     ========================================================================= */
  var GRAD = Math.PI / 180;

  // Punkt auf einem Kreis um den Kopfmittelpunkt (Winkel in Grad, Radius in r)
  function pol(w, rr, spitz) { return [Math.cos(w * GRAD) * rr, Math.sin(w * GRAD) * rr, spitz]; }

  // Glatte Kurve durch Punkte [x, y, spitz?] (Catmull-Rom als Bézier).
  // spitz = true macht an diesem Punkt eine Ecke (Haarspitzen).
  function kurve(ctx, P, geschlossen) {
    var n = P.length, k = 1 / 6;
    function pt(i) {
      if (geschlossen) return P[(i + n) % n];
      return P[Math.max(0, Math.min(n - 1, i))];
    }
    ctx.moveTo(P[0][0], P[0][1]);
    for (var i = 0; i < (geschlossen ? n : n - 1); i++) {
      var p0 = pt(i - 1), p1 = pt(i), p2 = pt(i + 1), p3 = pt(i + 2);
      var c1x = p1[2] ? p1[0] : p1[0] + (p2[0] - p0[0]) * k, c1y = p1[2] ? p1[1] : p1[1] + (p2[1] - p0[1]) * k;
      var c2x = p2[2] ? p2[0] : p2[0] - (p3[0] - p1[0]) * k, c2y = p2[2] ? p2[1] : p2[1] - (p3[1] - p1[1]) * k;
      ctx.bezierCurveTo(c1x, c1y, c2x, c2y, p2[0], p2[1]);
    }
    if (geschlossen) ctx.closePath();
  }
  function strich(ctx, P) { ctx.beginPath(); kurve(ctx, P, false); ctx.stroke(); }

  // Punktliste verschieben (z. B. für wehende Haare)
  function verschiebe(P, fn) { return P.map(function (p) { var d = fn(p); return [p[0] + d[0], p[1] + d[1], p[2]]; }); }

  function radial(ctx, x, y, r, stopps) {
    var v = ctx.createRadialGradient(x, y, 0, x, y, r);
    stopps.forEach(function (s) { v.addColorStop(s[0], s[1]); });
    return v;
  }

  // Wie viele Gerätepixel ist eine Kopf-Einheit groß? Kleine Köpfe (im Auto,
  // in der Fortschrittsleiste) bekommen dickere Linien und weniger Details.
  function pixelJeEinheit(ctx) {
    if (!ctx.getTransform) return 100;
    var t = ctx.getTransform();
    return Math.hypot(t.a, t.b);
  }

  /* =========================================================================
     3) GESICHT, OHR, AUGEN, MUND
     ========================================================================= */
  function gesichtUmriss(G) {
    var P = [];
    for (var i = 0; i < 20; i++) {
      var t = i / 20 * Math.PI * 2, c = Math.cos(t), s = Math.sin(t);
      if (s < 0) {
        var u = s * s;
        P.push([c * (1 - G.kinn * u) + 0.06 * u, s * G.hoehe]);    // Kinn etwas nach vorne
      } else P.push([c, s]);
    }
    return P;
  }

  function zeichneGesicht(ctx, A, lw) {
    var G = A.gesicht;
    ctx.beginPath(); kurve(ctx, gesichtUmriss(G), true);
    // weicher Verlauf: vorne heller, zum Hinterkopf etwas dunkler
    ctx.fillStyle = radial(ctx, 0.38, 0.12, 1.5, [[0, A.haut], [0.55, A.haut], [1, A.hautRand]]);
    ctx.fill();
    ctx.strokeStyle = A.hautRand; ctx.lineWidth = lw; ctx.stroke();
    // Nase (kleine Stupsnase am vorderen Rand)
    ctx.fillStyle = A.haut;
    ctx.beginPath(); ctx.moveTo(0.985, 0.08);
    ctx.quadraticCurveTo(1.19, -0.06, 0.96, -0.17); ctx.fill(); ctx.stroke();
  }

  function zeichneOhr(ctx, A, x, y, lw) {
    var f = A.ohr;
    ctx.save();
    ctx.translate(x, y); ctx.rotate((1 - f) * 0.7);            // abstehendes Ohr leicht gekippt
    ctx.fillStyle = A.haut; ctx.strokeStyle = A.hautRand; ctx.lineWidth = lw;
    ctx.beginPath(); ctx.ellipse(0, 0, 0.17 * f, 0.23 * f, 0, 0, Math.PI * 2); ctx.fill(); ctx.stroke();
    ctx.fillStyle = "rgba(214,120,100,0.28)";
    ctx.beginPath(); ctx.ellipse(0.01, -0.01, 0.09 * f, 0.14 * f, 0, 0, Math.PI * 2); ctx.fill();
    ctx.beginPath(); ctx.arc(0, -0.01, 0.085 * f, -1.2, 1.25); ctx.stroke();
    ctx.restore();
  }

  // Augen: das vordere groß, das hintere etwas kleiner (Dreiviertel-Ansicht)
  function zeichneAugen(ctx, A, augen, ausdruck, lw) {
    augen.forEach(function (a) {
      var ax = a[0], ay = a[1], f = a[2];
      if (ausdruck === "freude") {
        ctx.strokeStyle = "#3b2416"; ctx.lineWidth = lw * 1.4;
        ctx.beginPath(); ctx.arc(ax, ay - 0.07, 0.12 * f, Math.PI * 0.15, Math.PI * 0.85); ctx.stroke();
        return;
      }
      var gr = ausdruck === "staunen" ? 1.2 : 1;
      var rx = 0.16 * f * gr, ry = 0.2 * f * gr;
      ctx.fillStyle = "#ffffff"; ctx.strokeStyle = A.hautRand; ctx.lineWidth = lw * 0.55;
      ctx.beginPath(); ctx.ellipse(ax, ay, rx, ry, 0, 0, Math.PI * 2); ctx.fill(); ctx.stroke();
      var iris = (ausdruck === "staunen" ? 0.1 : 0.125) * f;
      ctx.save();
      ctx.beginPath(); ctx.ellipse(ax, ay, rx, ry, 0, 0, Math.PI * 2); ctx.clip();
      ctx.fillStyle = radial(ctx, ax + 0.04 * f, ay - 0.02, iris, [[0, A.augen], [0.75, A.augen], [1, "#2e1a0c"]]);
      ctx.beginPath(); ctx.arc(ax + 0.04 * f, ay - 0.02, iris, 0, Math.PI * 2); ctx.fill();
      ctx.restore();
      ctx.fillStyle = "#1f120a";
      ctx.beginPath(); ctx.arc(ax + 0.055 * f, ay - 0.02, 0.055 * f, 0, Math.PI * 2); ctx.fill();
      ctx.fillStyle = "#ffffff";
      ctx.beginPath(); ctx.arc(ax + 0.09 * f, ay + 0.04, 0.035 * f, 0, Math.PI * 2); ctx.fill();
      // Wimpernkranz oben
      ctx.strokeStyle = "#3b2416"; ctx.lineWidth = lw * 0.9;
      ctx.beginPath(); ctx.ellipse(ax, ay, rx, ry, 0, Math.PI * 0.18, Math.PI * 0.82); ctx.stroke();
    });
  }

  function zeichneBrauen(ctx, A, brauen, ausdruck, lw) {
    var hoch = ausdruck === "staunen" ? 0.07 : 0;
    ctx.strokeStyle = A.brauen; ctx.lineWidth = lw * 1.15;
    brauen.forEach(function (b) {
      ctx.beginPath(); ctx.moveTo(b[0], b[1] + hoch);
      ctx.quadraticCurveTo((b[0] + b[2]) / 2, Math.max(b[1], b[3]) + 0.06 + hoch, b[2], b[3] + hoch); ctx.stroke();
    });
  }

  function zeichneMund(ctx, A, ausdruck, lw) {
    ctx.strokeStyle = "#b45a46"; ctx.lineWidth = lw * 1.2;
    if (ausdruck === "staunen") {
      ctx.fillStyle = "#b8323c";
      ctx.beginPath(); ctx.ellipse(0.66, -0.47, 0.08, 0.11, 0, 0, Math.PI * 2); ctx.fill();
    } else if (ausdruck === "freude") {
      ctx.fillStyle = "#b8323c";
      ctx.beginPath(); ctx.moveTo(0.38, -0.33);
      ctx.quadraticCurveTo(0.64, -0.8, 0.9, -0.3); ctx.closePath(); ctx.fill();
      ctx.fillStyle = "#ffffff";
      ctx.beginPath(); ctx.moveTo(0.44, -0.35); ctx.lineTo(0.84, -0.33);
      ctx.lineTo(0.8, -0.41); ctx.lineTo(0.48, -0.43); ctx.closePath(); ctx.fill();
    } else if (A.mund === "schief") {
      // Jonte: schiefes Lächeln, rechts höher, Mund einen Spalt offen
      ctx.fillStyle = "#a83a3c";
      ctx.beginPath(); ctx.moveTo(0.44, -0.47);
      ctx.quadraticCurveTo(0.66, -0.62, 0.88, -0.34);
      ctx.quadraticCurveTo(0.66, -0.5, 0.44, -0.47); ctx.fill();
      ctx.fillStyle = "#ffffff";
      ctx.beginPath(); ctx.moveTo(0.56, -0.49); ctx.quadraticCurveTo(0.7, -0.51, 0.8, -0.42);
      ctx.quadraticCurveTo(0.68, -0.47, 0.56, -0.49); ctx.fill();
      ctx.beginPath(); ctx.moveTo(0.4, -0.45);
      ctx.quadraticCurveTo(0.66, -0.64, 0.9, -0.32); ctx.stroke();
    } else {
      // Fiete: Lippen zusammen, verschmitzt, ein Mundwinkel etwas höher
      ctx.beginPath(); ctx.moveTo(0.43, -0.4);
      ctx.quadraticCurveTo(0.63, -0.56, 0.87, -0.33); ctx.stroke();
      ctx.lineWidth = lw * 0.8;
      ctx.beginPath(); ctx.moveTo(0.85, -0.29); ctx.lineTo(0.9, -0.36); ctx.stroke();
    }
  }

  /* =========================================================================
     4) FRISUREN
     ========================================================================= */

  /* Fiete: voller, weicher Schopf. Der Pony fällt seitlich in die Stirn und
     läuft nach vorne in Spitzen aus; die Haare bedecken die Ohren halb. */
  function haarePony(ctx, A, wind, zeit, lw, detail) {
    var w = wind * 0.12, wackel = Math.sin(zeit * 11) * 0.03 * wind;
    var P = [
      pol(38, 1.12), pol(60, 1.2), pol(84, 1.23), pol(108, 1.22), pol(130, 1.2),     // Oberkopf
      pol(150, 1.19, true), pol(161, 1.15), pol(174, 1.18, true), pol(186, 1.13),    // lockere Büschel hinten
      pol(199, 1.14, true), pol(209, 1.09),
      [-0.7, -0.78, true], [-0.58, -0.68], [-0.47, -0.9, true],                      // Nacken
      [-0.38, -0.5], [-0.32, -0.12], [-0.14, -0.04], [0.02, -0.04],                  // über dem Ohr
      [0.04, -0.16, true], [0.06, 0.16], [0.14, 0.44],                               // Koteletten, Schläfe
      [0.32, 0.37, true], [0.36, 0.53], [0.56, 0.34, true], [0.6, 0.5],              // Pony: Strähnen nach vorne gekämmt
      [0.8, 0.31, true], [0.84, 0.47], [1.03, 0.3, true], [1.06, 0.48]
    ];
    // Fahrtwind drückt den Hinterkopf-Schopf nach hinten
    P = verschiebe(P, function (p) {
      var hinten = Math.max(0, -p[0]);
      return [-w * hinten - wackel * hinten, 0];
    });
    ctx.beginPath(); kurve(ctx, P, true);
    ctx.fillStyle = radial(ctx, 0.5, 0.78, 2.0, [[0, A.haarHell], [0.3, A.haarHell], [0.62, A.haar], [1, A.haarDunkel]]);
    ctx.fill();
    ctx.strokeStyle = A.haarDunkel; ctx.lineWidth = lw; ctx.stroke();
    if (!detail) return;
    // Strähnen: vom Scheitel schwungvoll nach vorne in die Pony-Spitzen …
    ctx.strokeStyle = A.haarDunkel; ctx.lineWidth = lw * 0.5; ctx.globalAlpha = 0.75 * detail;
    [
      [[-0.32, 1.02], [0.0, 0.9], [0.22, 0.6], [0.3, 0.4]],
      [[-0.18, 1.1], [0.24, 0.98], [0.48, 0.66], [0.54, 0.37]],
      [[0.02, 1.15], [0.48, 1.04], [0.74, 0.7], [0.78, 0.34]],
      [[0.3, 1.14], [0.76, 0.96], [0.96, 0.62], [1.0, 0.34]],
      // … und nach hinten zum Nacken
      [[-0.42, 1.0], [-0.8, 0.74], [-1.0 - w, 0.24]],
      [[-0.38, 0.8], [-0.74, 0.42], [-0.86 - w, -0.18]],
      [[-0.12, 0.6], [-0.3, 0.3], [-0.3, 0.02]]
    ].forEach(function (S) { strich(ctx, S); });
    ctx.globalAlpha = detail;
    ctx.strokeStyle = "rgba(255,250,232,0.6)"; ctx.lineWidth = lw * 0.9;
    strich(ctx, [[-0.2, 1.1], [0.14, 1.1], [0.42, 1.0]]);
    strich(ctx, [[0.36, 0.9], [0.56, 0.74], [0.64, 0.56]]);
    ctx.globalAlpha = 1;
  }

  /* Jonte: Haare glatt nach hinten gekämmt (Ansatz sichtbar, Stirn frei),
     Ohr frei. Wird von "dutt" und "lang" gemeinsam benutzt. */
  function haarKappe(ctx, A, lw, detail, aussen) {
    var P = [
      pol(48, 1.02), pol(70, aussen), pol(95, aussen + 0.01), pol(120, aussen + 0.01),
      pol(145, aussen), pol(170, aussen - 0.01), pol(195, aussen - 0.02), pol(220, 1.02),
      [-0.5, -0.88, true], [-0.42, -0.6], [-0.4, -0.2], [-0.37, 0.18],               // hinter dem Ohr
      [-0.2, 0.36], [0.02, 0.4], [0.16, 0.45, true],                                 // über dem Ohr zur Schläfe
      [0.28, 0.64], [0.46, 0.78]                                                     // Haaransatz über der Stirn
    ];
    ctx.beginPath(); kurve(ctx, P, true);
    ctx.fillStyle = radial(ctx, 0.15, 0.95, 1.6, [[0, A.haarHell], [0.4, A.haar], [1, A.haarDunkel]]);
    ctx.fill();
    ctx.strokeStyle = A.haarDunkel; ctx.lineWidth = lw; ctx.stroke();
    if (!detail) return;
    // nach hinten gekämmte Strähnen
    ctx.strokeStyle = A.haarDunkel; ctx.lineWidth = lw * 0.5; ctx.globalAlpha = 0.75 * detail;
    [
      [[0.52, 0.82], [0.12, 1.0], [-0.36, 0.92]],
      [[0.34, 0.66], [0.0, 0.82], [-0.4, 0.82]],
      [[0.18, 0.5], [-0.1, 0.62], [-0.44, 0.72]],
      [[-0.32, 0.2], [-0.48, 0.48], [-0.5, 0.68]],
      [[-0.44, -0.56], [-0.62, 0.1], [-0.6, 0.64]]
    ].forEach(function (S) { strich(ctx, S); });
    ctx.globalAlpha = detail;
    ctx.strokeStyle = "rgba(255,248,236,0.5)"; ctx.lineWidth = lw * 0.9;
    strich(ctx, [[0.36, 0.94], [0.0, 1.04], [-0.3, 1.0]]);
    ctx.globalAlpha = 1;
  }

  // feine abstehende Härchen (wie auf dem Foto an Schläfe, Ohr und Nacken)
  function haerchen(ctx, A, wind, zeit, lw, detail) {
    var z = Math.sin(zeit * 13) * 0.04 * (0.3 + wind);
    ctx.strokeStyle = A.haarHell; ctx.lineWidth = lw * 0.4; ctx.globalAlpha = 0.85 * detail;
    [
      [[0.17, 0.46], [0.11, 0.3], [0.18 - z, 0.12]],
      [[0.22, 0.52], [0.2, 0.36], [0.27 - z, 0.24]],
      [[0.46, 0.8], [0.54, 0.92 + z], [0.64, 0.95]],
      [[0.58, 0.86], [0.68, 0.96 + z], [0.78, 0.93]],
      [[-0.37, 0.1], [-0.43, -0.04], [-0.4 - z, -0.18]],
      [[-0.47, -0.7], [-0.55 - z, -0.84], [-0.52, -0.96]]
    ].forEach(function (S) { strich(ctx, S); });
    ctx.globalAlpha = 1;
  }

  /* Dutt hinten oben, mit Haargummi */
  function haareDutt(ctx, A, wind, lw, detail, teil) {
    var bx = -0.5 - wind * 0.04, by = 0.97, br = 0.34;
    if (teil === "hinten") {
      ctx.beginPath(); ctx.arc(bx, by, br, 0, Math.PI * 2);
      ctx.fillStyle = radial(ctx, bx + 0.1, by + 0.12, br * 1.2, [[0, A.haarHell], [0.5, A.haar], [1, A.haarDunkel]]);
      ctx.fill();
      ctx.strokeStyle = A.haarDunkel; ctx.lineWidth = lw; ctx.stroke();
      if (detail) {
        ctx.lineWidth = lw * 0.6; ctx.globalAlpha = detail;
        ctx.beginPath(); ctx.arc(bx + 0.03, by + 0.02, br * 0.62, 0.3, 3.6); ctx.stroke();
        ctx.beginPath(); ctx.arc(bx + 0.05, by + 0.04, br * 0.3, 1.2, 4.6); ctx.stroke();
        ctx.globalAlpha = 1;
      }
      return;
    }
    // Haargummi: dunkles Band, wo der Dutt aus der Kappe kommt
    ctx.strokeStyle = "#4a3934"; ctx.lineWidth = lw * 1.1;
    ctx.beginPath(); ctx.arc(bx, by, br * 0.94, 4.35, 5.0); ctx.stroke();
  }

  /* Offene lange Haare: fallen hinter dem Kopf bis auf die Schultern, wehen
     bei Tempo nach hinten. Vorne wie "dutt" glatt hinters Ohr gestrichen. */
  function haareLangHinten(ctx, A, wind, zeit, lw) {
    var w = wind * 0.42, u = wind * 0.3, welle = Math.sin(zeit * 9) * 0.07 * wind;
    var P = [
      pol(95, 1.06), pol(140, 1.12), [-1.12, 0.14], [-1.14, -0.5],
      [-1.06, -1.22, true], [-0.86, -1.08], [-0.7, -1.26, true], [-0.52, -1.08], [-0.36, -1.18, true],
      [-0.3, -0.7], [-0.3, -0.1], [0.1, 0.6]
    ];
    P = verschiebe(P, function (p) {
      var t = Math.max(0, Math.min(1, (0.2 - p[1]) / 1.4));              // unten weht es am stärksten
      return [-w * t + welle * t, u * t * t];
    });
    ctx.beginPath(); kurve(ctx, P, true);
    ctx.fillStyle = radial(ctx, -0.6, 0.4, 1.6, [[0, A.haar], [1, A.haarDunkel]]);
    ctx.fill();
    ctx.strokeStyle = A.haarDunkel; ctx.lineWidth = lw; ctx.stroke();
  }

  /* =========================================================================
     5) BRILLE – runde Gläser, kräftiger schwarzer Rahmen
     ========================================================================= */
  function zeichneBrille(ctx, B, augen, lw, detail) {
    var v = augen[0], h = augen[1];
    var rv = 0.25, rhx = 0.17, rhy = 0.25;
    // Bügel zum Ohr
    ctx.strokeStyle = B.rahmen; ctx.lineWidth = lw * 0.8;
    ctx.beginPath(); ctx.moveTo(v[0] - rv + 0.02, v[1] + 0.06); ctx.lineTo(-0.1, v[1] + 0.09); ctx.stroke();
    // Gläser
    ctx.fillStyle = B.glas;
    ctx.beginPath(); ctx.arc(v[0], v[1], rv, 0, Math.PI * 2); ctx.fill();
    ctx.beginPath(); ctx.ellipse(h[0], h[1], rhx, rhy, 0, 0, Math.PI * 2); ctx.fill();
    // Rahmen
    ctx.lineWidth = lw;
    ctx.beginPath(); ctx.arc(v[0], v[1], rv, 0, Math.PI * 2); ctx.stroke();
    ctx.beginPath(); ctx.ellipse(h[0], h[1], rhx, rhy, 0, 0, Math.PI * 2); ctx.stroke();
    // Steg über der Nase
    ctx.beginPath(); ctx.moveTo(v[0] + rv * 0.96, v[1] + 0.07);
    ctx.quadraticCurveTo((v[0] + rv + h[0] - rhx) / 2, v[1] + 0.13, h[0] - rhx * 0.97, h[1] + 0.07); ctx.stroke();
    if (!detail) return;
    // Lichtreflex auf den Gläsern
    ctx.globalAlpha = detail;
    ctx.strokeStyle = "rgba(255,255,255,0.75)"; ctx.lineWidth = lw * 0.6;
    ctx.beginPath(); ctx.arc(v[0], v[1], rv * 0.72, -0.15 + Math.PI * 0.18, Math.PI * 0.42); ctx.stroke();
    ctx.strokeStyle = "rgba(150,210,255,0.7)";
    ctx.beginPath(); ctx.ellipse(h[0], h[1], rhx * 0.68, rhy * 0.72, 0, Math.PI * 0.22, Math.PI * 0.42); ctx.stroke();
    ctx.globalAlpha = 1;
  }

  /* =========================================================================
     6) DER GANZE KOPF
     ========================================================================= */
  function zeichneKopf(ctx, x, y, r, ausdruck, raumhelm, kind, wind, zeit) {
    var A = aussehenVon(kind);
    wind = wind || 0; zeit = zeit || 0; ausdruck = ausdruck || "normal";
    ctx.save();
    ctx.translate(x, y);
    ctx.scale(r * A.gesicht.breite, r);
    ctx.lineJoin = "round"; ctx.lineCap = "round";
    var px = pixelJeEinheit(ctx);
    // Strähnen, Härchen und Reflexe werden zwischen 18 und 30 px Kopfradius
    // weich eingeblendet (kein Aufblitzen, wenn die Kamera zoomt)
    var detail = Math.max(0, Math.min(1, (px - 18) / 12));
    var lw = Math.max(0.085, 1.2 / px);              // Konturen nie dünner als ~1 Gerätepixel
    var brille = A.brille;
    // Augen und Brauen: mit Brille etwas weiter auseinander, Brauen über dem Rahmen
    var augen = brille ? [[0.32, 0.1, 0.86], [0.8, 0.11, 0.72]] : [[0.36, 0.08, 1], [0.74, 0.09, 0.8]];
    var brauen = brille ? [[0.2, 0.39, 0.46, 0.4], [0.68, 0.4, 0.88, 0.38]] : [[0.27, 0.32, 0.52, 0.33], [0.66, 0.33, 0.85, 0.31]];

    if (A.frisur === "lang") haareLangHinten(ctx, A, wind, zeit, lw);
    if (A.frisur === "dutt") haareDutt(ctx, A, wind, lw, detail, "hinten");
    zeichneGesicht(ctx, A, lw);
    if (A.frisur === "pony") {
      zeichneOhr(ctx, A, -0.14, -0.12, lw);
      haarePony(ctx, A, wind, zeit, lw, detail);
    } else {
      haarKappe(ctx, A, lw, detail, A.frisur === "lang" ? 1.07 : 1.04);
      if (A.frisur === "dutt") haareDutt(ctx, A, wind, lw, detail, "vorne");
      zeichneOhr(ctx, A, -0.13, -0.05, lw);
      if (detail) haerchen(ctx, A, wind, zeit, lw, detail);
    }
    zeichneAugen(ctx, A, augen, ausdruck, lw);
    zeichneBrauen(ctx, A, brauen, ausdruck, lw);
    if (brille) zeichneBrille(ctx, brille, augen, Math.max(0.07, 1.8 / px), detail);
    zeichneMund(ctx, A, ausdruck, lw);
    // Bäckchen
    ctx.fillStyle = A.wangen;
    ctx.beginPath(); ctx.arc(0.3, -0.3, 0.13, 0, Math.PI * 2); ctx.fill();
    ctx.restore();

    if (raumhelm) {
      ctx.fillStyle = "rgba(200,235,255,0.28)";
      ctx.strokeStyle = "rgba(255,255,255,0.9)"; ctx.lineWidth = r * 0.133;
      ctx.beginPath(); ctx.arc(x + r * 0.1, y + r * 0.1, r * 1.5, 0, Math.PI * 2); ctx.fill(); ctx.stroke();
      ctx.strokeStyle = "rgba(255,255,255,0.7)"; ctx.lineWidth = r * 0.167;
      ctx.beginPath(); ctx.arc(x + r * 0.1, y + r * 0.1, r * 1.25, Math.PI * 0.55, Math.PI * 0.85); ctx.stroke();
    }
  }

  /* Nur der Kopf, eingepasst in ein Rechteck b × h (Pixel, y nach unten).
     Fester Rahmen für alle Kinder, damit beide gleich groß erscheinen. */
  var RAHMEN = { links: -1.3, rechts: 1.24, oben: 1.34, unten: -1.3 };
  function zeichneKopfbild(ctx, b, h, kind, ausdruck, zeit) {
    var R = RAHMEN, bw = R.rechts - R.links, bh = R.oben - R.unten;
    var s = Math.min(b / bw, h / bh);
    ctx.save();
    ctx.translate(b / 2 - (R.links + bw / 2) * s, h / 2 + (R.unten + bh / 2) * s);
    ctx.scale(1, -1);
    zeichneKopf(ctx, 0, 0, s, ausdruck, false, kind, 0, zeit || 0);
    ctx.restore();
  }

  FF.Kinder = {
    AUSSEHEN: AUSSEHEN,
    aussehenVon: aussehenVon,
    zeichneKopf: zeichneKopf,
    zeichneKopfbild: zeichneKopfbild
  };
})();
