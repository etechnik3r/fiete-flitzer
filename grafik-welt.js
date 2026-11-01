/* ===========================================================================
   Fiete Flitzer – grafik-welt.js
   ---------------------------------------------------------------------------
   Alles, was die WELT malt (aus grafik.js herausgelöst, damit neue Welten
   leichter zu bauen sind): Himmel mit Sonne, Mond, Lichtstrahlen; Wolken;
   Hintergrund in drei Ebenen mit Silhouetten (KULISSE); Höhlendecke; Boden
   mit welttypischen Details; Pfützen; Hüpfpilze; Wetter-Teilchen; die
   Dunkelheit im Nachtwald.

   Wird NACH grafik.js geladen und nutzt dessen Helfer (FF.Grafik.hilfe).
   grafik.js ruft die Funktionen über FF.GrafikWelt in zeichneSzene auf.
   Fahrzeuge, Fiete und Jonte, Münzen, Partikel und Instrumente: grafik.js.
   =========================================================================== */

var FF = globalThis.FF = globalThis.FF || {};

(function () {
  "use strict";

  var H = FF.Grafik.hilfe;
  var sx = H.sx, sy = H.sy, weltX = H.weltX, mische = H.mische, hell = H.hell, dunkel = H.dunkel, sichtbereich = H.sichtbereich;

  /* =========================================================================
     1) HIMMEL, SONNE, WOLKEN, BERGE, HÖHLENDECKE
     ========================================================================= */
  /* Himmelsverlauf: entweder hier gemalt oder – schneller – als CSS-Hintergrund
     hinter dem durchsichtigen Canvas (himmelPerCss, siehe himmelCss()). */
  function himmelCss(welt) {
    var verlauf = "linear-gradient(" + welt.farben.himmel[0] + ", " + welt.farben.himmel[1] + ")";
    // Vulkaninsel: Glühen am Horizont gleich im CSS-Hintergrund (kostet dann keine Malzeit)
    if (welt.sonne === "glut") return "radial-gradient(ellipse 70% 45% at 60% 62%, rgba(255,120,60,0.4), rgba(255,90,40,0)), " + verlauf;
    return verlauf;
  }
  function zeichneHimmel(ctx, K, welt, zeit, perCss) {
    var f = welt.farben;
    if (perCss) {
      ctx.clearRect(0, 0, K.b, K.h);
    } else {
      var gr = ctx.createLinearGradient(0, 0, 0, K.h);
      gr.addColorStop(0, f.himmel[0]);
      gr.addColorStop(1, f.himmel[1]);
      ctx.fillStyle = gr;
      ctx.fillRect(0, 0, K.b, K.h);
    }

    var r = Math.min(K.b, K.h) * 0.09;
    var x = K.b * 0.8, y = K.h * 0.3;
    if (welt.sonne === "sonne") {
      if (welt.sonnenArt && SONNEN[welt.sonnenArt]) SONNEN[welt.sonnenArt](ctx, x, y, r, zeit);
      else sonneMalen(ctx, x, y, r, zeit, welt.sonnenDeko);
    } else if (welt.sonne === "wolkig") {
      // Regen: die Sonne lugt hinter einer dicken Regenwolke hervor
      sonneMalen(ctx, x + r * 0.7, y - r * 0.45, r * 0.85, zeit);
      ctx.fillStyle = "#9aa8bf";
      wolkeMalen(ctx, x - r * 0.2, y + r * 0.25, r * 4.2);
      ctx.fillStyle = "rgba(255,255,255,0.35)";
      wolkeMalen(ctx, x - r * 0.4, y + r * 0.05, r * 2.6);
    } else if (welt.sonne === "lichtstrahlen") {
      // Unter Wasser: Licht fällt in Bahnen von der Oberfläche herein, die Oberfläche glitzert
      for (var ls = 0; ls < 6; ls++) {
        var lx = K.b * (0.08 + ls * 0.18) + Math.sin(zeit * 0.3 + ls * 1.7) * K.b * 0.03 - ((K.x * K.s * 0.03) % (K.b * 0.18));
        var lb = K.b * (0.03 + 0.025 * ((ls * 7) % 3));
        ctx.fillStyle = "rgba(220,250,255," + (0.07 + 0.05 * Math.sin(zeit * 0.7 + ls * 2.1)) + ")";
        ctx.beginPath(); ctx.moveTo(lx, 0); ctx.lineTo(lx + lb, 0); ctx.lineTo(lx + lb * 2.2 + K.h * 0.35, K.h * 0.85); ctx.lineTo(lx + K.h * 0.35, K.h * 0.85); ctx.closePath(); ctx.fill();
      }
      ctx.strokeStyle = "rgba(235,252,255,0.45)"; ctx.lineWidth = 2;
      for (var wz = 0; wz < 2; wz++) {
        ctx.beginPath();
        for (var px = 0; px <= K.b + 20; px += 20) {
          var py = K.h * (0.025 + wz * 0.03) + Math.sin(px * 0.03 + zeit * (1.2 + wz * 0.5) + wz * 2) * 4;
          if (px === 0) ctx.moveTo(px, py); else ctx.lineTo(px, py);
        }
        ctx.stroke();
      }
    } else if (welt.sonne === "zweimonde") {
      // Mars: kleine, blasse Sonne und die beiden Monde Phobos und Deimos
      var mg3 = ctx.createRadialGradient(x, y, 0, x, y, r * 1.6);
      mg3.addColorStop(0, "rgba(255,250,235,0.95)"); mg3.addColorStop(0.35, "rgba(255,240,215,0.6)"); mg3.addColorStop(1, "rgba(255,230,200,0)");
      ctx.fillStyle = mg3; ctx.beginPath(); ctx.arc(x, y, r * 1.6, 0, Math.PI * 2); ctx.fill();
      [[x - K.b * 0.32, K.h * 0.16, r * 0.32, "#d9c6b6"], [x - K.b * 0.14, K.h * 0.1, r * 0.2, "#e6d7c8"]].forEach(function (m) {
        ctx.fillStyle = m[3]; ctx.beginPath(); ctx.ellipse(m[0], m[1], m[2] * 1.25, m[2], 0.4, 0, Math.PI * 2); ctx.fill();
        ctx.fillStyle = "rgba(120,90,70,0.3)"; ctx.beginPath(); ctx.arc(m[0] + m[2] * 0.3, m[1] - m[2] * 0.2, m[2] * 0.3, 0, Math.PI * 2); ctx.fill();
      });
    } else if (welt.sonne === "vollmond") {
      // Nacht: funkelnde Sterne und ein freundlicher, schläfriger Vollmond
      for (var st = 0; st < 60; st++) {
        var stx = zufall01(st, 3) * K.b, sty = zufall01(st, 4) * K.h * 0.55;
        ctx.fillStyle = "rgba(255,255,240," + (0.35 + 0.55 * Math.abs(Math.sin(zeit * 1.2 + st))) + ")";
        ctx.fillRect(stx, sty, 1.5 + zufall01(st, 5) * 1.5, 1.5 + zufall01(st, 5) * 1.5);
      }
      var mr = r * 1.15, mh = ctx.createRadialGradient(x, y, mr * 0.8, x, y, mr * 2.6);
      mh.addColorStop(0, "rgba(255,248,210,0.3)"); mh.addColorStop(1, "rgba(255,248,210,0)");
      ctx.fillStyle = mh; ctx.beginPath(); ctx.arc(x, y, mr * 2.6, 0, Math.PI * 2); ctx.fill();
      var mg2 = ctx.createRadialGradient(x - mr * 0.3, y - mr * 0.3, mr * 0.1, x, y, mr);
      mg2.addColorStop(0, "#fffbe6"); mg2.addColorStop(1, "#f1e2a8");
      ctx.fillStyle = mg2; ctx.beginPath(); ctx.arc(x, y, mr, 0, Math.PI * 2); ctx.fill();
      ctx.fillStyle = "rgba(200,180,120,0.35)";
      [[-0.4, -0.35, 0.18], [0.35, 0.3, 0.14], [0.45, -0.4, 0.1]].forEach(function (k) { ctx.beginPath(); ctx.arc(x + k[0] * mr, y + k[1] * mr, k[2] * mr, 0, Math.PI * 2); ctx.fill(); });
      ctx.strokeStyle = "#a08850"; ctx.lineWidth = mr * 0.07; ctx.lineCap = "round";
      ctx.beginPath(); ctx.arc(x - mr * 0.3, y - mr * 0.05, mr * 0.13, 0.15 * Math.PI, 0.85 * Math.PI); ctx.stroke();   // schläfrige Augen
      ctx.beginPath(); ctx.arc(x + mr * 0.3, y - mr * 0.05, mr * 0.13, 0.15 * Math.PI, 0.85 * Math.PI); ctx.stroke();
      ctx.beginPath(); ctx.arc(x, y + mr * 0.22, mr * 0.2, 0.2 * Math.PI, 0.8 * Math.PI); ctx.stroke();
    } else if (welt.sonne === "erde") {
      var eg = ctx.createRadialGradient(x - r * 0.3, y - r * 0.3, r * 0.1, x, y, r);
      eg.addColorStop(0, "#7cc8ff"); eg.addColorStop(1, "#1f5fbf");
      ctx.fillStyle = eg;
      ctx.beginPath(); ctx.arc(x, y, r, 0, Math.PI * 2); ctx.fill();
      ctx.save();
      ctx.beginPath(); ctx.arc(x, y, r, 0, Math.PI * 2); ctx.clip();
      ctx.fillStyle = "#4caf50";
      ctx.beginPath(); ctx.ellipse(x - r * 0.25, y - r * 0.15, r * 0.35, r * 0.5, 0.5, 0, Math.PI * 2); ctx.fill();
      ctx.beginPath(); ctx.ellipse(x + r * 0.45, y + r * 0.35, r * 0.3, r * 0.22, -0.3, 0, Math.PI * 2); ctx.fill();
      ctx.fillStyle = "rgba(255,255,255,0.7)";
      ctx.beginPath(); ctx.ellipse(x + r * 0.1, y - r * 0.6, r * 0.5, r * 0.1, 0.2, 0, Math.PI * 2); ctx.fill();
      ctx.restore();
    } else if (welt.sonne === "glut" && !perCss) {
      // Vulkaninsel: rötliches Glühen am Horizont statt einer Sonne
      var hg = ctx.createRadialGradient(K.b * 0.6, K.h * 0.62, 0, K.b * 0.6, K.h * 0.62, K.b * 0.6);
      hg.addColorStop(0, "rgba(255,120,60,0.35)"); hg.addColorStop(1, "rgba(255,90,40,0)");
      ctx.fillStyle = hg; ctx.fillRect(0, 0, K.b, K.h);
    } else if (welt.sonne === "vulkan") {
      var vg = ctx.createRadialGradient(x, y + r * 2, r * 0.2, x, y + r * 2, r * 4);
      vg.addColorStop(0, "rgba(255,140,60,0.7)"); vg.addColorStop(1, "rgba(255,90,40,0)");
      ctx.fillStyle = vg; ctx.fillRect(x - r * 4, y - r * 2, r * 8, r * 8);
      ctx.fillStyle = "#3b1d2a";
      ctx.beginPath();
      ctx.moveTo(x - r * 3.2, K.h * 0.62); ctx.lineTo(x - r * 0.6, y + r * 0.8);
      ctx.lineTo(x + r * 0.6, y + r * 0.8); ctx.lineTo(x + r * 3.2, K.h * 0.62); ctx.closePath(); ctx.fill();
      ctx.fillStyle = "#ff7b3a";
      ctx.beginPath(); ctx.ellipse(x, y + r * 0.8, r * 0.62, r * 0.18, 0, 0, Math.PI * 2); ctx.fill();
      for (var q = 0; q < 4; q++) {
        var t = (zeit * 0.25 + q / 4) % 1;
        ctx.fillStyle = "rgba(90,70,80," + (0.5 * (1 - t)) + ")";
        ctx.beginPath(); ctx.arc(x + Math.sin(t * 6 + q) * r * 0.4, y + r * 0.5 - t * r * 3, r * (0.35 + t * 0.9), 0, Math.PI * 2); ctx.fill();
      }
    } else if (welt.sonne === "mondsichel") {
      // Lichthof um die helle Seite, darauf die Sichel: Umriss aus zwei Kreisbögen –
      // außen die Mondscheibe, innen der Kreis, der sie verdeckt (Schnittpunkte P1, P2)
      var gx = x - r * 0.35, gy = y + r * 0.15;
      var mg = ctx.createRadialGradient(gx, gy, r * 0.4, gx, gy, r * 2.1);
      mg.addColorStop(0, "rgba(255,236,190,0.28)"); mg.addColorStop(1, "rgba(255,236,190,0)");
      ctx.fillStyle = mg; ctx.beginPath(); ctx.arc(gx, gy, r * 2.1, 0, Math.PI * 2); ctx.fill();
      var cx2 = x + r * 0.45, cy2 = y - r * 0.22, r2 = r * 0.88, dd = Math.hypot(cx2 - x, cy2 - y);
      var aa = (r * r - r2 * r2 + dd * dd) / (2 * dd), hh = Math.sqrt(r * r - aa * aa);
      var ux = (cx2 - x) / dd, uy = (cy2 - y) / dd;
      var p1x = x + aa * ux - hh * uy, p1y = y + aa * uy + hh * ux, p2x = x + aa * ux + hh * uy, p2y = y + aa * uy - hh * ux;
      ctx.fillStyle = "#fff1bf";
      ctx.beginPath();
      ctx.arc(x, y, r, Math.atan2(p1y - y, p1x - x), Math.atan2(p2y - y, p2x - x), false);
      ctx.arc(cx2, cy2, r2, Math.atan2(p2y - cy2, p2x - cx2), Math.atan2(p1y - cy2, p1x - cx2), true);
      ctx.closePath(); ctx.fill();
    } else if (welt.sonne === "regenbogen") {
      var farben = ["#ff5b5b", "#ff9e2c", "#ffd23f", "#3cc35a", "#2f6fd6", "#8e5bd8"];
      ctx.lineWidth = r * 0.28;
      for (var j = 0; j < farben.length; j++) {
        ctx.strokeStyle = farben[j];
        ctx.globalAlpha = 0.75;
        ctx.beginPath(); ctx.arc(K.b * 0.7, K.h * 0.75, r * (5.2 - j * 0.28), Math.PI * 1.05, Math.PI * 1.95); ctx.stroke();
      }
      ctx.globalAlpha = 1;
    }
  }

  /* Gesicht für die Themen-Sonnen */
  function sonnenGesicht(ctx, x, y, r, farbe) {
    ctx.fillStyle = farbe || "#8a5a00";
    ctx.beginPath(); ctx.arc(x - r * 0.32, y - r * 0.12, r * 0.09, 0, Math.PI * 2); ctx.fill();
    ctx.beginPath(); ctx.arc(x + r * 0.32, y - r * 0.12, r * 0.09, 0, Math.PI * 2); ctx.fill();
    ctx.strokeStyle = farbe || "#8a5a00"; ctx.lineWidth = r * 0.08; ctx.lineCap = "round";
    ctx.beginPath(); ctx.arc(x, y + r * 0.05, r * 0.38, 0.2 * Math.PI, 0.8 * Math.PI); ctx.stroke();
  }
  /* Sonnen mit eigener Form (welt.sonnenArt) */
  var SONNEN = {
    baustein: function (ctx, x, y, r) {                 // eckige Sonne aus Klemmbausteinen
      var b = r * 1.7, st = r * 0.3;
      ctx.fillStyle = "rgba(255,214,80,0.5)";
      for (var k = 0; k < 8; k++) { var w = k * Math.PI / 4; ctx.save(); ctx.translate(x + Math.cos(w) * r * 1.45, y + Math.sin(w) * r * 1.45); ctx.rotate(w); ctx.fillRect(-r * 0.18, -r * 0.12, r * 0.36, r * 0.24); ctx.restore(); }
      ctx.fillStyle = "#ffcc1a"; ctx.fillRect(x - b / 2, y - b / 2, b, b);
      ctx.fillStyle = "rgba(255,255,255,0.3)"; ctx.fillRect(x - b / 2, y - b / 2, b, b * 0.15);
      ctx.fillStyle = "#ffcc1a"; for (k = 0; k < 4; k++) ctx.fillRect(x - b / 2 + (k + 0.2) * b / 4, y - b / 2 - st * 0.45, b / 4 * 0.6, st * 0.45);
      ctx.strokeStyle = "rgba(160,110,0,0.5)"; ctx.lineWidth = Math.max(1, r * 0.04); ctx.strokeRect(x - b / 2, y - b / 2, b, b);
      ctx.fillStyle = "#8a5a00"; ctx.fillRect(x - r * 0.42, y - r * 0.25, r * 0.18, r * 0.18); ctx.fillRect(x + r * 0.24, y - r * 0.25, r * 0.18, r * 0.18);
      ctx.fillRect(x - r * 0.4, y + r * 0.22, r * 0.8, r * 0.12); ctx.fillRect(x - r * 0.5, y + r * 0.1, r * 0.12, r * 0.14); ctx.fillRect(x + r * 0.38, y + r * 0.1, r * 0.12, r * 0.14);
    },
    lolli: function (ctx, x, y, r, zeit) {             // Lolli-Sonne mit Spirale
      ctx.strokeStyle = "#f4f6fb"; ctx.lineWidth = r * 0.18; ctx.beginPath(); ctx.moveTo(x, y + r); ctx.lineTo(x + r * 0.5, y + r * 2.6); ctx.stroke();
      ctx.fillStyle = "#ffd23f"; ctx.beginPath(); ctx.arc(x, y, r * 1.05, 0, Math.PI * 2); ctx.fill();
      ctx.strokeStyle = "#ff6fb5"; ctx.lineWidth = r * 0.16; ctx.beginPath();
      for (var t = 0; t < 1; t += 0.02) { var w = t * 4 * Math.PI + zeit * 0.4, rr = r * t; if (t === 0) ctx.moveTo(x + Math.cos(w) * rr, y + Math.sin(w) * rr); else ctx.lineTo(x + Math.cos(w) * rr, y + Math.sin(w) * rr); }
      ctx.stroke();
      sonnenGesicht(ctx, x, y, r * 0.8, "#7a3060");
    },
    zahnrad: function (ctx, x, y, r, zeit) {           // Zahnrad-Sonne, dreht sich langsam
      ctx.save(); ctx.translate(x, y); ctx.rotate(zeit * 0.3);
      ctx.fillStyle = "#ffcc33"; ctx.beginPath();
      for (var i = 0; i < 24; i++) { var a = i * Math.PI / 12, rr = i % 2 ? r * 1.05 : r * 1.32; ctx.lineTo(Math.cos(a - 0.12) * rr, Math.sin(a - 0.12) * rr); ctx.lineTo(Math.cos(a + 0.12) * rr, Math.sin(a + 0.12) * rr); }
      ctx.closePath(); ctx.fill(); ctx.restore();
      ctx.fillStyle = "#ffe27a"; ctx.beginPath(); ctx.arc(x, y, r * 0.95, 0, Math.PI * 2); ctx.fill();
      sonnenGesicht(ctx, x, y, r);
    },
    sonnenblume: function (ctx, x, y, r, zeit) {       // Sonnenblume als Sonne
      ctx.save(); ctx.translate(x, y); ctx.rotate(zeit * 0.1);
      for (var i = 0; i < 16; i++) { ctx.rotate(Math.PI / 8); ctx.fillStyle = i % 2 ? "#ffcc1a" : "#ffb300"; ctx.beginPath(); ctx.ellipse(r * 1.2, 0, r * 0.5, r * 0.2, 0, 0, Math.PI * 2); ctx.fill(); }
      ctx.restore();
      ctx.fillStyle = "#7a4a1a"; ctx.beginPath(); ctx.arc(x, y, r * 0.85, 0, Math.PI * 2); ctx.fill();
      sonnenGesicht(ctx, x, y, r * 0.85, "#ffd27a");
    },
    glas: function (ctx, x, y, r, zeit) {              // Sonne aus Glas mit Facetten
      ctx.fillStyle = "rgba(255,240,170,0.45)";
      for (var i = 0; i < 8; i++) { var w = i * Math.PI / 4 + zeit * 0.1; ctx.beginPath(); ctx.moveTo(x + Math.cos(w - 0.15) * r * 1.1, y + Math.sin(w - 0.15) * r * 1.1); ctx.lineTo(x + Math.cos(w) * r * 1.8, y + Math.sin(w) * r * 1.8); ctx.lineTo(x + Math.cos(w + 0.15) * r * 1.1, y + Math.sin(w + 0.15) * r * 1.1); ctx.fill(); }
      ctx.fillStyle = "rgba(255,220,90,0.55)"; ctx.strokeStyle = "rgba(200,150,30,0.8)"; ctx.lineWidth = Math.max(1, r * 0.05);
      ctx.beginPath(); for (i = 0; i < 8; i++) { var a = i * Math.PI / 4 + Math.PI / 8; ctx.lineTo(x + Math.cos(a) * r, y + Math.sin(a) * r); } ctx.closePath(); ctx.fill(); ctx.stroke();
      ctx.strokeStyle = "rgba(255,255,255,0.7)"; ctx.beginPath(); ctx.moveTo(x - r * 0.5, y - r * 0.5); ctx.lineTo(x - r * 0.1, y - r * 0.75); ctx.stroke();
      sonnenGesicht(ctx, x, y, r, "rgba(140,90,0,0.85)");
    }
  };

  /* Freundliche Sonne mit Strahlen und Gesicht, auf Wunsch mit Zubehör
     (deko: helm, muetze, brille, bluete, krone, schal) */
  function sonneMalen(ctx, x, y, r, zeit, deko) {
    ctx.save();
    ctx.translate(x, y);
    ctx.rotate(zeit * 0.15);
    ctx.fillStyle = "rgba(255, 214, 80, 0.45)";
    for (var i = 0; i < 10; i++) {
      ctx.rotate(Math.PI / 5);
      ctx.beginPath();
      ctx.moveTo(r * 1.15, -r * 0.16); ctx.lineTo(r * 1.75, 0); ctx.lineTo(r * 1.15, r * 0.16);
      ctx.fill();
    }
    ctx.restore();
    var sg = ctx.createRadialGradient(x - r * 0.3, y - r * 0.3, r * 0.1, x, y, r);
    sg.addColorStop(0, "#fff6b8"); sg.addColorStop(1, "#ffcc33");
    ctx.fillStyle = sg;
    ctx.beginPath(); ctx.arc(x, y, r, 0, Math.PI * 2); ctx.fill();
    ctx.fillStyle = "#8a5a00";
    ctx.beginPath(); ctx.arc(x - r * 0.32, y - r * 0.12, r * 0.09, 0, Math.PI * 2); ctx.fill();
    ctx.beginPath(); ctx.arc(x + r * 0.32, y - r * 0.12, r * 0.09, 0, Math.PI * 2); ctx.fill();
    ctx.strokeStyle = "#8a5a00"; ctx.lineWidth = r * 0.08; ctx.lineCap = "round";
    ctx.beginPath(); ctx.arc(x, y + r * 0.05, r * 0.38, 0.2 * Math.PI, 0.8 * Math.PI); ctx.stroke();
    ctx.fillStyle = "rgba(255,120,120,0.45)";
    ctx.beginPath(); ctx.arc(x - r * 0.55, y + r * 0.2, r * 0.13, 0, Math.PI * 2); ctx.fill();
    ctx.beginPath(); ctx.arc(x + r * 0.55, y + r * 0.2, r * 0.13, 0, Math.PI * 2); ctx.fill();
    if (deko === "helm") {                              // gelber Bauhelm
      ctx.fillStyle = "#ffd000"; ctx.beginPath(); ctx.arc(x, y - r * 0.35, r * 0.9, Math.PI * 1.08, Math.PI * 1.92); ctx.closePath(); ctx.fill();
      ctx.fillRect(x - r * 1.05, y - r * 0.5, r * 2.1, r * 0.16);
      ctx.fillStyle = "#e0a800"; ctx.fillRect(x - r * 0.08, y - r * 1.2, r * 0.16, r * 0.7);
    } else if (deko === "muetze") {                     // Winter-Bommelmütze
      ctx.fillStyle = "#e8453c"; ctx.beginPath(); ctx.arc(x, y - r * 0.3, r * 0.92, Math.PI * 1.1, Math.PI * 1.9); ctx.closePath(); ctx.fill();
      ctx.fillStyle = "#ffffff"; ctx.fillRect(x - r * 0.95, y - r * 0.55, r * 1.9, r * 0.22);
      ctx.beginPath(); ctx.arc(x, y - r * 1.22, r * 0.22, 0, Math.PI * 2); ctx.fill();
    } else if (deko === "brille") {                     // coole Sonnenbrille
      ctx.fillStyle = "#1e2c52";
      ctx.beginPath(); ctx.ellipse(x - r * 0.33, y - r * 0.12, r * 0.25, r * 0.18, 0, 0, Math.PI * 2); ctx.ellipse(x + r * 0.33, y - r * 0.12, r * 0.25, r * 0.18, 0, 0, Math.PI * 2); ctx.fill();
      ctx.fillRect(x - r * 0.1, y - r * 0.17, r * 0.2, r * 0.06);
      ctx.fillStyle = "rgba(255,255,255,0.5)"; ctx.fillRect(x - r * 0.45, y - r * 0.2, r * 0.1, r * 0.05);
    } else if (deko === "bluete") {                     // Hawaii-Blüte hinterm Ohr
      ctx.fillStyle = "#ff4f8a";
      for (var b = 0; b < 5; b++) { var wb = b * Math.PI * 2 / 5; ctx.beginPath(); ctx.arc(x + r * 0.75 + Math.cos(wb) * r * 0.2, y - r * 0.6 + Math.sin(wb) * r * 0.2, r * 0.16, 0, Math.PI * 2); ctx.fill(); }
      ctx.fillStyle = "#ffe27a"; ctx.beginPath(); ctx.arc(x + r * 0.75, y - r * 0.6, r * 0.1, 0, Math.PI * 2); ctx.fill();
    } else if (deko === "krone") {                      // goldene Krone
      ctx.fillStyle = "#ffd23f"; ctx.strokeStyle = "#c9962a"; ctx.lineWidth = Math.max(1, r * 0.05);
      ctx.beginPath(); ctx.moveTo(x - r * 0.6, y - r * 0.75); ctx.lineTo(x - r * 0.7, y - r * 1.3); ctx.lineTo(x - r * 0.3, y - r * 1.0); ctx.lineTo(x, y - r * 1.45);
      ctx.lineTo(x + r * 0.3, y - r * 1.0); ctx.lineTo(x + r * 0.7, y - r * 1.3); ctx.lineTo(x + r * 0.6, y - r * 0.75); ctx.closePath(); ctx.fill(); ctx.stroke();
      ctx.fillStyle = "#e8453c"; ctx.beginPath(); ctx.arc(x, y - r * 0.95, r * 0.08, 0, Math.PI * 2); ctx.fill();
    } else if (deko === "schal") {                      // Herbstschal, flattert
      ctx.fillStyle = "#d9532b"; ctx.fillRect(x - r * 0.8, y + r * 0.65, r * 1.6, r * 0.25);
      ctx.beginPath(); ctx.moveTo(x - r * 0.6, y + r * 0.85); ctx.lineTo(x - r * 1.4, y + r * (1.1 + Math.sin(zeit * 3) * 0.15)); ctx.lineTo(x - r * 1.35, y + r * 1.35); ctx.lineTo(x - r * 0.4, y + r * 0.95); ctx.fill();
      ctx.fillStyle = "#ffd23f"; ctx.fillRect(x - r * 0.3, y + r * 0.65, r * 0.12, r * 0.25); ctx.fillRect(x + r * 0.2, y + r * 0.65, r * 0.12, r * 0.25);
    }
  }
  /* Wolke aus drei Ellipsen, Breite w, Farbe = aktuelles fillStyle */
  function wolkeMalen(ctx, x, y, w) {
    ctx.beginPath();
    ctx.ellipse(x, y, w * 0.5, w * 0.22, 0, 0, Math.PI * 2);
    ctx.ellipse(x - w * 0.22, y - w * 0.08, w * 0.24, w * 0.2, 0, 0, Math.PI * 2);
    ctx.ellipse(x + w * 0.15, y - w * 0.14, w * 0.28, w * 0.24, 0, 0, Math.PI * 2);
    ctx.fill();
  }

  function zeichneWolken(ctx, K, welt, zeit) {
    if (welt.sonne === "erde" || welt.decke || welt.unterwasser) return;
    var gross = welt.wetter === "regen" ? 1.9 : 1;           // Regen: dicke Wolken
    var breite = K.b + 400;
    var farbe = welt.farben.wolken || (welt.id === "vulkan" ? "rgba(120,90,100,0.55)" : "rgba(255,255,255,0.85)");
    for (var i = 0; i < 6; i++) {
      var basis = i * 337 + 60;
      var x = ((basis - K.x * K.s * 0.06 + zeit * 8 * (1 + i % 3 * 0.3)) % breite + breite) % breite - 200;
      var y = K.h * (0.08 + (i * 0.137) % 0.3);
      var w = (60 + (i * 53) % 70) * gross;
      if (welt.wolkenStil === "keine" || (welt.wolkenStil === "wenige" && i % 3)) continue;
      ctx.fillStyle = farbe;
      if (welt.wolkenStil === "baustein") {             // Wolke aus weißen Klemmbausteinen
        var st = w * 0.16;
        [[-0.5, 0, 1.0], [-0.25, -1, 0.6], [0.05, -1, 0.45], [-0.1, -2, 0.3]].forEach(function (q) {
          var bx = x + q[0] * w * 0.6, by = y + q[1] * st, bb = q[2] * w * 0.6;
          ctx.fillStyle = "#ffffff"; ctx.fillRect(bx, by - st, bb, st);
          for (var k = 0; k < Math.max(1, Math.round(bb / (st * 1.2))); k++) ctx.fillRect(bx + (k + 0.2) * st * 1.2, by - st * 1.3, st * 0.7, st * 0.3);
          ctx.fillStyle = "rgba(170,200,230,0.5)"; ctx.fillRect(bx, by - st * 0.2, bb, st * 0.2);
        });
      } else if (welt.wolkenStil === "glas") {          // Wolke als Glaskontur
        ctx.fillStyle = "rgba(255,255,255,0.35)"; wolkeMalen(ctx, x, y, w);
        ctx.strokeStyle = "rgba(90,160,210,0.6)"; ctx.lineWidth = 1.5;
        ctx.beginPath(); ctx.ellipse(x, y, w * 0.5, w * 0.22, 0, 0, Math.PI * 2); ctx.stroke();
      } else if (welt.wolkenStil === "dampf") {         // bunte Dampfwolken der Fabrik
        ctx.fillStyle = ["rgba(255,190,220,0.8)", "rgba(190,225,255,0.8)", "rgba(255,235,170,0.8)"][i % 3]; wolkeMalen(ctx, x, y, w);
      } else if (welt.wolkenStil === "zuckerwatte") {   // Zuckerwatte: rosa, flauschig
        ctx.fillStyle = i % 2 ? "rgba(255,190,225,0.9)" : "rgba(230,200,255,0.9)";
        for (var z = 0; z < 6; z++) { ctx.beginPath(); ctx.arc(x + (z - 2.5) * w * 0.17, y - Math.sin(z * 1.3) * w * 0.08, w * (0.14 + 0.04 * (z % 2)), 0, Math.PI * 2); ctx.fill(); }
      } else wolkeMalen(ctx, x, y, w);
    }
  }

  /* Hintergrund: drei Ebenen mit Parallaxe. Die hinterste verschwimmt im Dunst
     (Farbe zum Horizont hin gemischt). Auf den Ebenen stehen je Welt eigene
     Silhouetten (welt.kulisse = [hinten, mitte, vorn]): Wald, Tannen, Tafelberge,
     Stadt, Kräne, Gipfel, Vulkane, Dschungel, Dinos, Riesenräder … – fest an
     Positionen der Ebene (Zufall aus der Nummer), nur einfache Flächen. */
  var KULISSE = {
    wald: { abst: 14, male: function (ctx, x, y, s, R) {
      for (var i = 0; i < 5; i++) { var r = s * (0.12 + 0.1 * R()); ctx.beginPath(); ctx.arc(x + (i - 2) * s * 0.2, y - s * (0.12 + 0.2 * R()), r, 0, Math.PI * 2); ctx.fill(); }
    } },
    tannen: { abst: 10, male: function (ctx, x, y, s, R) {
      for (var i = 0; i < 4; i++) {
        var h = s * (0.35 + 0.4 * R()), b = h * 0.28, xx = x + (i - 1.5) * s * 0.16;
        ctx.beginPath(); ctx.moveTo(xx - b, y + 2); ctx.lineTo(xx, y - h); ctx.lineTo(xx + b, y + 2); ctx.fill();
      }
    } },
    tafelberg: { abst: 34, male: function (ctx, x, y, s, R) {
      var b = s * (0.8 + 0.8 * R()), h = s * (0.4 + 0.35 * R()), st = s * 0.08;
      ctx.beginPath(); ctx.moveTo(x - b, y + 2); ctx.lineTo(x - b * 0.7, y - h * 0.55); ctx.lineTo(x - b * 0.62, y - h * 0.55);
      ctx.lineTo(x - b * 0.55, y - h); ctx.lineTo(x + b * 0.45, y - h); ctx.lineTo(x + b * 0.5, y - h + st); ctx.lineTo(x + b * 0.7, y - h * 0.4); ctx.lineTo(x + b, y + 2); ctx.fill();
    } },
    stadt: { abst: 16, male: function (ctx, x, y, s, R) {
      for (var i = 0; i < 5; i++) {
        var b = s * (0.1 + 0.12 * R()), h = s * (0.25 + 0.75 * R()), xx = x + (i - 2) * s * 0.2;
        ctx.fillRect(xx - b / 2, y - h, b, h + 2);
        if (R() < 0.3) ctx.fillRect(xx - 1, y - h - s * 0.12, 2, s * 0.12);   // Antenne
      }
    } },
    kran: { abst: 30, male: function (ctx, x, y, s, R) {
      var h = s * (0.9 + 0.5 * R()), a = s * (0.5 + 0.4 * R());
      ctx.fillRect(x - s * 0.03, y - h, s * 0.06, h + 2);
      ctx.fillRect(x - a * 0.35, y - h, a * 1.35, s * 0.04);
      ctx.fillRect(x + a * 0.9, y - h, s * 0.012, h * 0.35);
      ctx.beginPath(); ctx.moveTo(x - s * 0.03, y - h); ctx.lineTo(x, y - h - s * 0.12); ctx.lineTo(x + s * 0.03, y - h); ctx.fill();
    } },
    gipfel: { abst: 26, male: function (ctx, x, y, s, R, f) {
      var h = s * (0.7 + 0.6 * R()), b = h * (0.8 + 0.4 * R()), sp = (R() - 0.5) * b * 0.4;
      ctx.beginPath(); ctx.moveTo(x - b, y + 2); ctx.lineTo(x + sp - b * 0.1, y - h * 0.8); ctx.lineTo(x + sp, y - h); ctx.lineTo(x + sp + b * 0.15, y - h * 0.85); ctx.lineTo(x + b, y + 2); ctx.fill();
      if (f.schnee) {
        var alt = ctx.fillStyle; ctx.fillStyle = f.schnee;
        ctx.beginPath(); ctx.moveTo(x + sp - b * 0.1 * 1.3, y - h * 0.74); ctx.lineTo(x + sp, y - h); ctx.lineTo(x + sp + b * 0.15 * 1.3, y - h * 0.8);
        ctx.lineTo(x + sp + b * 0.06, y - h * 0.76); ctx.lineTo(x + sp - b * 0.02, y - h * 0.82); ctx.closePath(); ctx.fill();
        ctx.fillStyle = alt;
      }
    } },
    vulkan: { abst: 40, male: function (ctx, x, y, s, R, f, zeit, k) {
      var h = s * (0.75 + 0.7 * R()), b = h * (1.1 + 0.5 * R()), kr = b * (0.12 + 0.06 * R()), aktiv = R() < 0.7;
      ctx.beginPath(); ctx.moveTo(x - b, y + 2); ctx.quadraticCurveTo(x - kr * 1.8, y - h * 0.7, x - kr, y - h);
      ctx.lineTo(x + kr, y - h); ctx.quadraticCurveTo(x + kr * 1.8, y - h * 0.7, x + b, y + 2); ctx.fill();
      if (!aktiv) return;
      var alt = ctx.fillStyle;
      var gl = ctx.createRadialGradient(x, y - h, 0, x, y - h, kr * 3.5);
      gl.addColorStop(0, "rgba(255,150,60,0.75)"); gl.addColorStop(1, "rgba(255,90,40,0)");
      ctx.fillStyle = gl; ctx.beginPath(); ctx.arc(x, y - h, kr * 3.5, 0, Math.PI * 2); ctx.fill();
      ctx.fillStyle = "#ff8a3a"; ctx.beginPath(); ctx.ellipse(x, y - h, kr * 0.9, kr * 0.22, 0, 0, Math.PI * 2); ctx.fill();
      for (var q = 0; q < 3; q++) {                                    // Rauchwolken steigen auf
        var t = (zeit * 0.12 + q / 3 + k * 0.37) % 1;
        ctx.fillStyle = "rgba(70,55,60," + (0.45 * (1 - t)) + ")";
        ctx.beginPath(); ctx.arc(x + Math.sin(t * 4 + k) * kr + t * s * 0.4, y - h - t * s * 0.9, kr * (0.8 + t * 2.2), 0, Math.PI * 2); ctx.fill();
      }
      ctx.fillStyle = alt;
    } },
    dschungel: { abst: 12, male: function (ctx, x, y, s, R) {
      for (var i = 0; i < 2; i++) {
        var h = s * (0.5 + 0.5 * R()), xx = x + (i - 0.5) * s * 0.4;
        ctx.fillRect(xx - s * 0.02, y - h, s * 0.04, h + 2);
        ctx.beginPath(); ctx.ellipse(xx, y - h, s * (0.2 + 0.12 * R()), s * 0.1, 0, 0, Math.PI * 2); ctx.fill();
        ctx.beginPath(); ctx.ellipse(xx - s * 0.1, y - h + s * 0.05, s * 0.14, s * 0.07, 0, 0, Math.PI * 2); ctx.fill();
      }
      ctx.beginPath(); ctx.arc(x, y, s * 0.25, Math.PI, 0); ctx.fill();
    } },
    brachio: { abst: 48, male: function (ctx, x, y, s, R) {
      var u = s * (0.9 + 0.4 * R()), r = R() < 0.5 ? 1 : -1;
      ctx.save(); ctx.translate(x, y); ctx.scale(r, 1);
      ctx.beginPath();
      ctx.moveTo(-u * 0.85, -u * 0.3); ctx.quadraticCurveTo(-u * 0.3, -u * 0.75, u * 0.28, -u * 0.6);
      ctx.quadraticCurveTo(u * 0.45, -u * 0.8, u * 0.52, -u * 1.0); ctx.quadraticCurveTo(u * 0.6, -u * 1.06, u * 0.7, -u * 1.0);
      ctx.lineTo(u * 0.58, -u * 0.92); ctx.quadraticCurveTo(u * 0.45, -u * 0.6, u * 0.32, -u * 0.38);
      ctx.lineTo(u * 0.32, 2); ctx.lineTo(u * 0.2, 2); ctx.lineTo(u * 0.18, -u * 0.32); ctx.lineTo(-u * 0.2, -u * 0.32);
      ctx.lineTo(-u * 0.22, 2); ctx.lineTo(-u * 0.34, 2); ctx.lineTo(-u * 0.38, -u * 0.34); ctx.closePath(); ctx.fill();
      ctx.restore();
    } },
    riesenrad: { abst: 46, male: function (ctx, x, y, s, R) {
      var r = s * (0.45 + 0.2 * R()), cy = y - r - s * 0.12, alt = ctx.strokeStyle;
      ctx.strokeStyle = ctx.fillStyle; ctx.lineWidth = Math.max(1.5, s * 0.02);
      ctx.beginPath(); ctx.arc(x, cy, r, 0, Math.PI * 2); ctx.stroke();
      ctx.beginPath(); for (var i = 0; i < 8; i++) { var w = i * Math.PI / 4; ctx.moveTo(x, cy); ctx.lineTo(x + Math.cos(w) * r, cy + Math.sin(w) * r); } ctx.stroke();
      ctx.beginPath(); ctx.moveTo(x - r * 0.6, y + 2); ctx.lineTo(x, cy); ctx.lineTo(x + r * 0.6, y + 2); ctx.stroke();
      for (i = 0; i < 8; i++) { var w2 = i * Math.PI / 4; ctx.fillRect(x + Math.cos(w2) * r - s * 0.03, cy + Math.sin(w2) * r, s * 0.06, s * 0.05); }
      ctx.strokeStyle = alt;
    } },
    bonbon: { abst: 16, male: function (ctx, x, y, s, R) {
      for (var i = 0; i < 2; i++) {
        var h = s * (0.4 + 0.5 * R()), xx = x + (i - 0.5) * s * 0.35, r = s * (0.1 + 0.06 * R());
        ctx.fillRect(xx - s * 0.015, y - h, s * 0.03, h + 2);
        ctx.beginPath(); ctx.arc(xx, y - h, r, 0, Math.PI * 2); ctx.fill();
      }
      ctx.beginPath(); ctx.arc(x, y, s * 0.22, Math.PI, 0); ctx.fill();
    } },
    wolkenberg: { abst: 22, male: function (ctx, x, y, s, R) {
      for (var i = 0; i < 4; i++) { ctx.beginPath(); ctx.arc(x + (i - 1.5) * s * 0.22, y - s * (0.1 + 0.15 * R()), s * (0.15 + 0.1 * R()), 0, Math.PI * 2); ctx.fill(); }
    } },
    dorf: { abst: 30, male: function (ctx, x, y, s, R, f) {
      // Häuser mit Giebeldach, manchmal ein Kirchturm; nachts leuchten Fenster (f.fenster)
      var alt = ctx.fillStyle, n = 2 + Math.floor(R() * 2), fenster = [];
      for (var i = 0; i < n; i++) {
        var b = s * (0.16 + 0.08 * R()), h = s * (0.13 + 0.09 * R()), xx = x + (i - (n - 1) / 2) * s * 0.28;
        ctx.fillRect(xx - b / 2, y - h, b, h + 2);
        ctx.beginPath(); ctx.moveTo(xx - b * 0.62, y - h + 1); ctx.lineTo(xx, y - h - b * 0.48); ctx.lineTo(xx + b * 0.62, y - h + 1); ctx.fill();
        if (R() < 0.4) ctx.fillRect(xx + b * 0.18, y - h - b * 0.45, b * 0.1, b * 0.3);              // Schornstein
        fenster.push([xx - b * 0.3, y - h * 0.68, b * 0.17], [xx + b * 0.12, y - h * 0.68, b * 0.17]);
      }
      if (R() < 0.35) {
        var tx = x + s * 0.42, th = s * 0.42, tb = s * 0.07;
        ctx.fillRect(tx - tb / 2, y - th, tb, th + 2);
        ctx.beginPath(); ctx.moveTo(tx - tb * 0.7, y - th + 1); ctx.lineTo(tx, y - th - s * 0.16); ctx.lineTo(tx + tb * 0.7, y - th + 1); ctx.fill();
        fenster.push([tx - tb * 0.2, y - th * 0.8, tb * 0.4]);
      }
      ctx.fillStyle = f.fenster || hell(alt, 0.16);
      fenster.forEach(function (fe) { if (!f.fenster || R() < 0.7) ctx.fillRect(fe[0], fe[1], fe[2], fe[2] * 1.1); });
      ctx.fillStyle = alt;
    } },
    zaun: { abst: 9, male: function (ctx, x, y, s, R) {
      // Gartenzaun-Stück aus Latten mit Spitze (Riesengarten: riesig im Hintergrund)
      var n = 6 + Math.floor(R() * 3), b = s * 0.05, h = s * (0.32 + 0.05 * R()), abst = s * 0.085;
      for (var i = 0; i < n; i++) {
        var xx = x + (i - (n - 1) / 2) * abst;
        ctx.beginPath(); ctx.moveTo(xx - b / 2, y + 2); ctx.lineTo(xx - b / 2, y - h); ctx.lineTo(xx, y - h - b * 0.7); ctx.lineTo(xx + b / 2, y - h); ctx.lineTo(xx + b / 2, y + 2); ctx.fill();
      }
      ctx.fillRect(x - n * abst / 2, y - h * 0.8, n * abst, b * 0.6);
      ctx.fillRect(x - n * abst / 2, y - h * 0.3, n * abst, b * 0.6);
    } },
    riesenblumen: { abst: 16, male: function (ctx, x, y, s, R) {
      var n = 1 + Math.floor(R() * 2);
      for (var i = 0; i < n; i++) {
        var h = s * (0.6 + 0.6 * R()), xx = x + (i - (n - 1) / 2) * s * 0.4, r = s * (0.07 + 0.05 * R());
        ctx.fillRect(xx - s * 0.012, y - h, s * 0.024, h + 2);
        ctx.beginPath(); ctx.ellipse(xx - s * 0.06, y - h * 0.4, s * 0.07, s * 0.025, -0.5, 0, Math.PI * 2); ctx.fill();
        ctx.beginPath();
        for (var k = 0; k < 8; k++) { var w = k * Math.PI / 4; ctx.moveTo(xx + Math.cos(w) * r * 1.5 + r * 0.6, y - h + Math.sin(w) * r * 1.5); ctx.arc(xx + Math.cos(w) * r * 1.5, y - h + Math.sin(w) * r * 1.5, r * 0.6, 0, Math.PI * 2); }
        ctx.arc(xx, y - h, r, 0, Math.PI * 2); ctx.fill();
      }
    } },
    halme: { abst: 5, male: function (ctx, x, y, s, R) {
      for (var i = 0; i < 4; i++) {
        var h = s * (0.3 + 0.6 * R()), xx = x + (i - 1.5) * s * 0.07, b = s * 0.022, k = (R() - 0.4) * s * 0.2;
        ctx.beginPath(); ctx.moveTo(xx - b, y + 2); ctx.quadraticCurveTo(xx - b * 0.5, y - h * 0.6, xx + k, y - h); ctx.quadraticCurveTo(xx + b * 0.5, y - h * 0.55, xx + b, y + 2); ctx.fill();
      }
    } },
    windrad: { abst: 55, male: function (ctx, x, y, s, R, f, zeit, k) {
      // Windräder drehen sich mit dem Wind (Richtung und Tempo: windPhase)
      var h = s * (1.0 + 0.4 * R()), b = s * 0.035, l = h * 0.42, w0 = windPhase * (0.8 + 0.4 * R()) + k * 1.3;
      ctx.beginPath(); ctx.moveTo(x - b, y + 2); ctx.lineTo(x - b * 0.45, y - h); ctx.lineTo(x + b * 0.45, y - h); ctx.lineTo(x + b, y + 2); ctx.fill();
      ctx.beginPath(); ctx.ellipse(x + b * 0.4, y - h, b * 1.4, b * 0.7, 0, 0, Math.PI * 2); ctx.fill();
      for (var i = 0; i < 3; i++) {
        var w = w0 + i * Math.PI * 2 / 3, cx = x, cy = y - h;
        ctx.beginPath(); ctx.moveTo(cx + Math.cos(w + 1.57) * b * 0.5, cy + Math.sin(w + 1.57) * b * 0.5);
        ctx.lineTo(cx + Math.cos(w) * l, cy + Math.sin(w) * l);
        ctx.lineTo(cx + Math.cos(w - 1.57) * b * 0.5, cy + Math.sin(w - 1.57) * b * 0.5); ctx.fill();
      }
    } },
    riff: { abst: 12, male: function (ctx, x, y, s, R) {
      // Korallenstöcke und Felsen
      ctx.beginPath(); ctx.ellipse(x, y, s * (0.22 + 0.15 * R()), s * (0.1 + 0.08 * R()), 0, Math.PI, 0); ctx.fill();
      var alt = ctx.strokeStyle; ctx.strokeStyle = ctx.fillStyle; ctx.lineCap = "round";
      for (var i = 0; i < 2; i++) {
        var xx = x + (i - 0.5) * s * 0.25, h = s * (0.2 + 0.3 * R());
        ctx.lineWidth = s * 0.03;
        ctx.beginPath(); ctx.moveTo(xx, y); ctx.lineTo(xx, y - h);
        ctx.moveTo(xx, y - h * 0.5); ctx.lineTo(xx - s * 0.08, y - h * 0.8); ctx.moveTo(xx, y - h * 0.6); ctx.lineTo(xx + s * 0.09, y - h * 0.95); ctx.stroke();
      }
      ctx.strokeStyle = alt;
    } },
    wrack: { abst: 70, male: function (ctx, x, y, s, R) {
      // versunkenes Segelschiff, schräg im Sand
      ctx.save(); ctx.translate(x, y); ctx.rotate(-0.12 + (R() - 0.5) * 0.1);
      var b = s * 0.8, h = s * 0.22;
      ctx.beginPath(); ctx.moveTo(-b, -h); ctx.lineTo(b * 0.85, -h * 1.1); ctx.lineTo(b, -h * 1.5); ctx.lineTo(b * 0.7, h * 0.3); ctx.lineTo(-b * 0.8, h * 0.3); ctx.closePath(); ctx.fill();
      ctx.fillRect(-b * 0.15, -h - s * 0.55, s * 0.03, s * 0.55);
      ctx.fillRect(-b * 0.4, -h - s * 0.4, s * 0.4, s * 0.025);
      ctx.fillRect(b * 0.35, -h - s * 0.35, s * 0.025, s * 0.35);
      ctx.restore();
    } },
    tang: { abst: 6, male: function (ctx, x, y, s, R, f, zeit, k) {
      var alt = ctx.strokeStyle; ctx.strokeStyle = ctx.fillStyle; ctx.lineCap = "round"; ctx.lineWidth = Math.max(2, s * 0.025);
      for (var i = 0; i < 3; i++) {
        var h = s * (0.25 + 0.55 * R()), xx = x + (i - 1) * s * 0.07, ph = R() * 6;
        ctx.beginPath(); ctx.moveTo(xx, y + 2);
        for (var t = 0.1; t <= 1.001; t += 0.15) ctx.lineTo(xx + Math.sin(t * 5 + ph + zeit * 1.1 + k) * s * 0.04 * t, y - h * t);
        ctx.stroke();
      }
      ctx.strokeStyle = alt;
    } },
    fabrik: { abst: 34, male: function (ctx, x, y, s, R, f, zeit, k) {
      // Fabrikhalle mit Sägezahndach und Schornstein, aus dem bunter Dampf steigt
      var b = s * (0.7 + 0.4 * R()), h = s * (0.25 + 0.12 * R()), n = 3 + Math.floor(R() * 2), alt = ctx.fillStyle;
      ctx.fillRect(x - b / 2, y - h, b, h + 2);
      ctx.beginPath(); ctx.moveTo(x - b / 2, y - h + 1);
      for (var i = 0; i < n; i++) { var x0 = x - b / 2 + b * i / n; ctx.lineTo(x0, y - h - s * 0.1); ctx.lineTo(x0 + b / n, y - h + 1); }
      ctx.fill();
      var kx = x + b * (0.2 + 0.2 * R()), kh = h + s * (0.3 + 0.15 * R());
      ctx.fillRect(kx - s * 0.03, y - kh, s * 0.06, kh);
      var farben = ["rgba(255,140,180,", "rgba(140,200,255,", "rgba(255,220,120,"];
      for (var q = 0; q < 3; q++) {
        var t = (zeit * 0.15 + q / 3 + k * 0.29) % 1;
        ctx.fillStyle = farben[(q + k) % 3] + (0.55 * (1 - t)) + ")";
        ctx.beginPath(); ctx.arc(kx + t * s * 0.35, y - kh - t * s * 0.6, s * (0.04 + t * 0.1), 0, Math.PI * 2); ctx.fill();
      }
      ctx.fillStyle = alt;
    } },
    zahnraeder: { abst: 26, male: function (ctx, x, y, s, R, f, zeit, k) {
      // zwei ineinandergreifende Zahnräder auf Gestellen, die sich drehen
      var r1 = s * (0.16 + 0.08 * R()), r2 = r1 * (0.55 + 0.2 * R()), h = s * (0.35 + 0.25 * R());
      ctx.fillRect(x - s * 0.02, y - h, s * 0.04, h + 2);
      zahnrad(ctx, x, y - h, r1, 10, zeit * 0.8 * (k % 2 ? 1 : -1));
      zahnrad(ctx, x + (r1 + r2) * 0.92, y - h + r1 * 0.3, r2, 6, -zeit * 0.8 * r1 / r2 * (k % 2 ? 1 : -1));
    } },
    station: { abst: 40, male: function (ctx, x, y, s, R, f) {
      // Module der Raumstation: Zylinder, Verbindungsröhren, Solarflügel, Antennen, Lichter
      var n = 2 + Math.floor(R() * 2), alt = ctx.fillStyle, licht = [];
      for (var i = 0; i < n; i++) {
        var b = s * (0.22 + 0.12 * R()), h = s * (0.14 + 0.1 * R()), xx = x + (i - (n - 1) / 2) * s * 0.36, yy = y - s * (0.05 + 0.25 * R());
        ctx.fillRect(xx - b / 2, yy - h, b, h);
        ctx.beginPath(); ctx.arc(xx - b / 2, yy - h / 2, h / 2, Math.PI / 2, Math.PI * 1.5); ctx.arc(xx + b / 2, yy - h / 2, h / 2, -Math.PI / 2, Math.PI / 2); ctx.fill();
        ctx.fillRect(xx - s * 0.015, yy, s * 0.03, y - yy + 2);
        licht.push([xx, yy - h / 2]);
      }
      ctx.fillRect(x - n * s * 0.18, y - s * 0.2, n * s * 0.36, s * 0.02);
      var px = x + n * s * 0.2, py = y - s * 0.45;                    // Solarflügel
      for (var k = 0; k < 3; k++) ctx.fillRect(px + k * s * 0.09, py, s * 0.08, s * 0.16);
      ctx.fillRect(x - s * 0.01, y - s * 0.7, s * 0.02, s * 0.5);
      ctx.fillStyle = f.fenster || "#7af0ff";
      licht.forEach(function (l) { for (var k2 = -1; k2 <= 1; k2++) ctx.fillRect(l[0] + k2 * s * 0.06 - s * 0.012, l[1] - s * 0.012, s * 0.024, s * 0.024); });
      ctx.fillStyle = alt;
    } },
    glastuerme: { abst: 22, male: function (ctx, x, y, s, R) {
      // durchsichtige Glastürme mit Lichtkante
      var alt = ctx.fillStyle, n = 1 + Math.floor(R() * 3);
      for (var i = 0; i < n; i++) {
        var b = s * (0.08 + 0.08 * R()), h = s * (0.4 + 0.7 * R()), xx = x + (i - (n - 1) / 2) * s * 0.22;
        ctx.globalAlpha = 0.55; ctx.fillStyle = alt;
        ctx.beginPath(); ctx.moveTo(xx - b, y + 2); ctx.lineTo(xx - b, y - h); ctx.lineTo(xx, y - h - b * 0.8); ctx.lineTo(xx + b, y - h); ctx.lineTo(xx + b, y + 2); ctx.fill();
        ctx.globalAlpha = 0.7; ctx.fillStyle = "#ffffff"; ctx.fillRect(xx - b * 0.7, y - h, b * 0.18, h);
      }
      ctx.globalAlpha = 1; ctx.fillStyle = alt;
    } },
    bausteine: { abst: 18, male: function (ctx, x, y, s, R) {
      // Türme und Mauern aus Klemmbausteinen (Silhouette mit Noppen)
      var n = 1 + Math.floor(R() * 3), hs = s * 0.07;
      for (var i = 0; i < n; i++) {
        var b = s * (0.12 + 0.12 * R()), lagen = 2 + Math.floor(R() * 7), xx = x + (i - (n - 1) / 2) * s * 0.3;
        ctx.fillRect(xx - b / 2, y - lagen * hs, b, lagen * hs + 2);
        for (var k = 0; k < 3; k++) ctx.fillRect(xx - b / 2 + (k + 0.2) * b / 3, y - lagen * hs - hs * 0.3, b / 3 * 0.55, hs * 0.3);
      }
    } },
    spukhaus: { abst: 60, male: function (ctx, x, y, s, R, f) {
      // schiefes Spukhaus mit Türmchen auf einem Hügel, ein paar Fenster leuchten
      var alt = ctx.fillStyle, b = s * 0.45, h = s * 0.35;
      ctx.beginPath(); ctx.ellipse(x, y + 2, b * 1.4, s * 0.12, 0, Math.PI, 0); ctx.fill();
      ctx.save(); ctx.translate(x, y - s * 0.08); ctx.rotate((R() - 0.5) * 0.08);
      ctx.fillRect(-b / 2, -h, b, h);
      ctx.beginPath(); ctx.moveTo(-b * 0.62, -h); ctx.lineTo(-b * 0.1, -h - s * 0.22); ctx.lineTo(b * 0.62, -h); ctx.fill();
      ctx.fillRect(b * 0.25, -h - s * 0.3, s * 0.08, s * 0.32);
      ctx.beginPath(); ctx.moveTo(b * 0.2, -h - s * 0.3); ctx.lineTo(b * 0.25 + s * 0.04, -h - s * 0.45); ctx.lineTo(b * 0.25 + s * 0.12, -h - s * 0.3); ctx.fill();
      ctx.fillStyle = f.fenster || "#ffd27a";
      [[-0.3, -0.75], [0.12, -0.75], [-0.3, -0.35], [0.12, -0.35]].forEach(function (p) { if (R() < 0.6) ctx.fillRect(p[0] * b, p[1] * h, b * 0.16, h * 0.18); });
      ctx.restore(); ctx.fillStyle = alt;
    } },
    burg: { abst: 70, male: function (ctx, x, y, s, R, f) {
      // Burg mit Türmen und Zinnen, Fähnchen
      var alt = ctx.fillStyle, b = s * (0.6 + 0.3 * R()), h = s * 0.35, z = s * 0.04;
      ctx.fillRect(x - b / 2, y - h, b, h + 2);
      for (var k = 0; k < 7; k++) if (k % 2 === 0) ctx.fillRect(x - b / 2 + k * b / 7, y - h - z, b / 7, z);
      [-1, 1].forEach(function (sd) {
        var tx = x + sd * b / 2, th = h * 1.6, tb = s * 0.12;
        ctx.fillRect(tx - tb / 2, y - th, tb, th + 2);
        ctx.beginPath(); ctx.moveTo(tx - tb * 0.65, y - th); ctx.lineTo(tx, y - th - s * 0.16); ctx.lineTo(tx + tb * 0.65, y - th); ctx.fill();
        ctx.fillRect(tx - s * 0.005, y - th - s * 0.28, s * 0.01, s * 0.12);
        ctx.fillStyle = "#e8453c"; ctx.fillRect(tx, y - th - s * 0.28, s * 0.07, s * 0.04); ctx.fillStyle = alt;
      });
      ctx.fillStyle = "rgba(0,0,0,0.25)"; ctx.beginPath(); ctx.arc(x, y + 2, s * 0.08, Math.PI, 0); ctx.fill(); ctx.fillStyle = alt;
    } },
    stalagmiten: { abst: 9, male: function (ctx, x, y, s, R) {
      for (var i = 0; i < 3; i++) {
        var h = s * (0.25 + 0.6 * R()), b = s * (0.05 + 0.05 * R()), xx = x + (i - 1) * s * 0.18;
        ctx.beginPath(); ctx.moveTo(xx - b, y + 2); ctx.quadraticCurveTo(xx - b * 0.2, y - h * 0.6, xx, y - h); ctx.quadraticCurveTo(xx + b * 0.2, y - h * 0.6, xx + b, y + 2); ctx.fill();
      }
    } }
  };
  /* Zahnrad-Silhouette (Farbe = fillStyle), Loch in der Mitte */
  function zahnrad(ctx, x, y, r, n, w) {
    ctx.beginPath();
    for (var i = 0; i < n * 2; i++) {
      var a = w + i * Math.PI / n, rr = i % 2 ? r * 0.78 : r;
      ctx.lineTo(x + Math.cos(a - 0.12) * rr, y + Math.sin(a - 0.12) * rr); ctx.lineTo(x + Math.cos(a + 0.12) * rr, y + Math.sin(a + 0.12) * rr);
    }
    ctx.closePath(); ctx.moveTo(x + r * 0.28, y); ctx.arc(x, y, r * 0.28, 0, Math.PI * 2, true); ctx.fill("evenodd");
  }
  function zeichneBerge(ctx, K, welt, zeit, gel) {
    var f = welt.farben, ku = welt.kulisse || [], dunst = f.himmel[1];
    // [Parallaxe, Farbe, Grundlinie, Wellenlänge, Zufall, Höhe, Silhouetten-Größe]
    // Deutlich verschieden schnell: hinten ein Zwölftel, vorn fast halb so schnell wie die Strecke
    var ebenen = [[0.08, mische(f.berge[0], dunst, 0.55), 0.46, 170, 5, 0.1, 0.2],
                  [0.2, mische(f.berge[0], dunst, 0.15), 0.54, 120, 11, 0.12, 0.17],
                  [0.42, dunkel(f.berge[1], 0.06), 0.65, 70, 23, 0.11, 0.13]];
    // Erst alle Umrisse berechnen: Jede Ebene wird nur bis knapp unter den tiefsten
    // Punkt der Ebene davor gemalt – sonst würden große Flächen doppelt gemalt
    var SCHRITT = 24, linien = [], tiefste = [], bodenTiefst = K.h;
    if (gel) {                                       // vorderste Ebene: nur bis zum tiefsten Bodenpunkt im Bild
      var b = sichtbereich(K, gel); bodenTiefst = -Infinity;
      for (var j = b[0]; j <= b[1]; j += 4) bodenTiefst = Math.max(bodenTiefst, sy(K, gel.h[j]));
      bodenTiefst = Math.max(bodenTiefst, sy(K, gel.h[b[1]]));
    }
    ebenen.forEach(function (E, e) {
      var yVersatz = Math.max(-K.h * 0.25, Math.min(K.h * 0.25, (K.y - 5) * K.s * E[0] * 0.5)), l = [], t = -Infinity;
      for (var px = 0; px <= K.b + SCHRITT; px += SCHRITT) {
        var wx = K.x * E[0] + (px - K.b / 2) / K.s;
        var n = FF.rauschen(wx / (E[3] / 10), E[4]) + 0.5 * FF.rauschen(wx / (E[3] / 25), E[4] + 5);
        var y = K.h * E[2] - n * K.h * E[5] + yVersatz;
        if (welt.stufig) { var stu = K.h * 0.035; y = Math.round(y / stu) * stu; }   // Klemmbaustein-Land: Hügel als Stufen
        l.push(y); t = Math.max(t, y);
      }
      linien.push(l); tiefste.push(t);
    });
    for (var e = 0; e < ebenen.length; e++) {
      var E = ebenen[e], fak = E[0], seed = E[4], L = linien[e];
      var hoehe = function (px) { var i = Math.max(0, Math.min(L.length - 2, Math.floor(px / SCHRITT))), t = px / SCHRITT - i; return L[i] * (1 - t) + L[i + 1] * t; };
      var unten = e < ebenen.length - 1 ? Math.min(K.h, tiefste[e + 1] + 4) : Math.min(K.h, bodenTiefst + 4);
      ctx.fillStyle = E[1];
      ctx.beginPath();
      ctx.moveTo(0, unten);
      for (var i = 0; i < L.length; i++) ctx.lineTo(i * SCHRITT, Math.min(L[i], unten));
      ctx.lineTo((L.length - 1) * SCHRITT, unten);
      ctx.closePath();
      ctx.fill();
      var art = KULISSE[ku[e]];
      if (!art) continue;
      var s = K.h * E[6] * (welt.kulisseGroesse || 1), wl0 = K.x * fak + (-K.b / 2 - s * 2) / K.s, wl1 = K.x * fak + (K.b / 2 + s * 2) / K.s;
      for (var k = Math.floor(wl0 / art.abst); k * art.abst <= wl1; k++) {
        if (zufall01(k, seed + 31) < 0.3) continue;
        var wx = k * art.abst + zufall01(k, seed + 32) * art.abst * 0.6;
        var x = (wx - K.x * fak) * K.s + K.b / 2, y = hoehe(x) + s * 0.05;
        var z = 0, R = function () { z++; return zufall01(k * 13 + z, seed + 40); };
        art.male(ctx, x, y, s, R, f, zeit, k);
      }
    }
  }

  /* Höhlendecke: Fels von oben bis gel.deckeBei(x), daran Tropfsteine, leuchtende
     Kristalle und Laternen an Seilen. Alles fest an Weltpositionen (Zufall aus x). */
  function zufall01(k, s) { var v = Math.sin(k * 127.1 + s * 311.7) * 43758.5453; return v - Math.floor(v); }
  var windJetzt = 0, windPhase = 0;          // Herbststurm: Wind an der Kamera (−1 … 1), Drehwinkel der Windräder
  function zeichneDecke(ctx, K, gel, welt, zeit) {
    if (!welt.decke) return;
    var f = welt.farben, x0 = weltX(K, -30), x1 = weltX(K, K.b + 30), dxs = Math.max(0.5, 12 / K.s), x;
    var yMax = -Infinity;
    for (x = x0; x <= x1 + dxs; x += dxs) yMax = Math.max(yMax, sy(K, gel.deckeBei(x)));
    if (yMax < -20) return;                                  // Decke ist gerade nicht im Bild
    var g = ctx.createLinearGradient(0, yMax, 0, Math.min(0, yMax - 6 * K.s));
    g.addColorStop(0, f.decke[0]); g.addColorStop(1, f.decke[1]);
    ctx.beginPath(); ctx.moveTo(sx(K, x0), -10);
    for (x = x0; x <= x1 + dxs; x += dxs) ctx.lineTo(sx(K, x), sy(K, gel.deckeBei(x)));
    ctx.lineTo(sx(K, x1 + dxs), -10); ctx.closePath();
    ctx.fillStyle = g; ctx.fill();
    // Gesteinsschichten
    ctx.strokeStyle = "rgba(0,0,0,0.18)"; ctx.lineWidth = Math.max(1, 0.12 * K.s);
    for (var sch = 1; sch <= 2; sch++) {
      ctx.beginPath();
      for (x = x0; x <= x1 + dxs; x += dxs) {
        var ys = sy(K, gel.deckeBei(x) + sch * 1.4 + 0.4 * Math.sin(x * 0.3 + sch));
        if (x === x0) ctx.moveTo(sx(K, x), ys); else ctx.lineTo(sx(K, x), ys);
      }
      ctx.stroke();
    }
    // Tropfsteine (Stalaktiten) alle ~3 m
    var abst = 3;
    for (var k = Math.floor(x0 / abst); k * abst < x1; k++) {
      var r1 = zufall01(k, 1);
      if (r1 < 0.3) continue;
      var xs = k * abst + zufall01(k, 2) * 1.6, yd = gel.deckeBei(xs);
      var len = 0.4 + 1.8 * zufall01(k, 3) * zufall01(k, 4) * 1.6, br = 0.35 + 0.5 * zufall01(k, 5);
      var X = sx(K, xs), Y = sy(K, yd + 0.3), L = len * K.s, Bh = br * K.s / 2;
      var tg = ctx.createLinearGradient(X - Bh, 0, X + Bh, 0);
      tg.addColorStop(0, hell(f.decke[0], 0.18)); tg.addColorStop(1, dunkel(f.decke[0], 0.35));
      ctx.fillStyle = tg;
      ctx.beginPath(); ctx.moveTo(X - Bh, Y); ctx.quadraticCurveTo(X - Bh * 0.25, Y + L * 0.6, X, Y + L);
      ctx.quadraticCurveTo(X + Bh * 0.25, Y + L * 0.6, X + Bh, Y); ctx.closePath(); ctx.fill();
      // Wassertropfen an der Spitze
      if (r1 > 0.85) {
        var tt = (zeit * 0.5 + r1 * 7) % 1;
        ctx.fillStyle = "rgba(160,220,255," + (0.8 * (1 - tt)) + ")";
        ctx.beginPath(); ctx.arc(X, Y + L + tt * tt * 3 * K.s, Math.max(1.5, 0.06 * K.s), 0, Math.PI * 2); ctx.fill();
      }
    }
    // Leuchtende Kristalle an der Decke
    var abk = 11;
    for (k = Math.floor(x0 / abk); k * abk < x1; k++) {
      if (zufall01(k, 7) < 0.45) continue;
      var xk = k * abk + zufall01(k, 8) * 5, Xk = sx(K, xk), Yk = sy(K, gel.deckeBei(xk) + 0.25);
      var farbe = zufall01(k, 9) < 0.5 ? "#8fe8ff" : "#d59cff", puls = 0.55 + 0.25 * Math.sin(zeit * 2 + k);
      var gl = ctx.createRadialGradient(Xk, Yk, 0, Xk, Yk, 2.2 * K.s);
      gl.addColorStop(0, "rgba(" + (farbe === "#8fe8ff" ? "143,232,255" : "213,156,255") + "," + (0.35 * puls) + ")");
      gl.addColorStop(1, "rgba(0,0,0,0)");
      ctx.fillStyle = gl; ctx.beginPath(); ctx.arc(Xk, Yk, 2.2 * K.s, 0, Math.PI * 2); ctx.fill();
      for (var n = -1; n <= 1; n++) {
        var lk = (0.55 + 0.35 * (1 - Math.abs(n)) ) * K.s, bk = 0.13 * K.s, xx = Xk + n * 0.22 * K.s;
        ctx.save(); ctx.translate(xx, Yk); ctx.rotate(n * 0.35);
        ctx.fillStyle = farbe; ctx.globalAlpha = 0.9;
        ctx.beginPath(); ctx.moveTo(-bk, 0); ctx.lineTo(-bk, lk * 0.7); ctx.lineTo(0, lk); ctx.lineTo(bk, lk * 0.7); ctx.lineTo(bk, 0); ctx.closePath(); ctx.fill();
        ctx.fillStyle = "rgba(255,255,255,0.6)";
        ctx.beginPath(); ctx.moveTo(-bk * 0.4, 0); ctx.lineTo(-bk * 0.4, lk * 0.65); ctx.lineTo(0, lk * 0.9); ctx.lineTo(0, 0); ctx.closePath(); ctx.fill();
        ctx.restore();
      }
      ctx.globalAlpha = 1;
    }
    // Laternen an Seilen alle 40 m
    var abl = 40;
    for (k = Math.floor(x0 / abl); k * abl < x1; k++) {
      var xl = k * abl + 17, yo = gel.deckeBei(xl), seil = 1.1 + 0.4 * zufall01(k, 11);
      var schw = Math.sin(zeit * 1.3 + k) * 0.08, Xo = sx(K, xl), Yo = sy(K, yo);
      var Xl = Xo + Math.sin(schw) * seil * K.s, Yl = Yo + Math.cos(schw) * seil * K.s;
      ctx.strokeStyle = "#2a2238"; ctx.lineWidth = Math.max(1, 0.05 * K.s);
      ctx.beginPath(); ctx.moveTo(Xo, Yo); ctx.lineTo(Xl, Yl); ctx.stroke();
      var lg = ctx.createRadialGradient(Xl, Yl + 0.25 * K.s, 0, Xl, Yl + 0.25 * K.s, 3.5 * K.s);
      lg.addColorStop(0, "rgba(255,200,110,0.45)"); lg.addColorStop(1, "rgba(255,200,110,0)");
      ctx.fillStyle = lg; ctx.beginPath(); ctx.arc(Xl, Yl + 0.25 * K.s, 3.5 * K.s, 0, Math.PI * 2); ctx.fill();
      ctx.fillStyle = "#3b2f4f"; ctx.fillRect(Xl - 0.18 * K.s, Yl, 0.36 * K.s, 0.08 * K.s);
      ctx.fillStyle = "#ffd27a"; ctx.fillRect(Xl - 0.14 * K.s, Yl + 0.08 * K.s, 0.28 * K.s, 0.34 * K.s);
      ctx.fillStyle = "#3b2f4f"; ctx.fillRect(Xl - 0.18 * K.s, Yl + 0.42 * K.s, 0.36 * K.s, 0.07 * K.s);
    }
    // Kante
    ctx.beginPath();
    for (x = x0; x <= x1 + dxs; x += dxs) { var yk = sy(K, gel.deckeBei(x)); if (x === x0) ctx.moveTo(sx(K, x), yk); else ctx.lineTo(sx(K, x), yk); }
    ctx.strokeStyle = f.deckeKante || f.kante; ctx.globalAlpha = 0.5; ctx.lineWidth = Math.max(1.5, 0.08 * K.s); ctx.stroke(); ctx.globalAlpha = 1;
  }

  /* =========================================================================
     2) BODEN, PFÜTZEN, HÜPFPILZE
     ========================================================================= */
  function zeichneGelaende(ctx, K, gel, welt, zeit) {
    var b = sichtbereich(K, gel), i0 = b[0], i1 = b[1];
    var f = welt.farben, h = gel.h, dx = gel.dx, x0 = gel.x0;
    var schritt = K.s < 14 ? 2 : 1;

    // Boden-Fläche
    var yOben = Infinity;
    for (var j = i0; j <= i1; j += 4) yOben = Math.min(yOben, sy(K, h[j]));
    var gr = ctx.createLinearGradient(0, yOben, 0, yOben + 8 * K.s);
    gr.addColorStop(0, f.boden[0]); gr.addColorStop(1, f.boden[1]);
    ctx.beginPath();
    ctx.moveTo(sx(K, x0 + i0 * dx), K.h + 10);
    for (var i = i0; i <= i1; i += schritt) ctx.lineTo(sx(K, x0 + i * dx), sy(K, h[i]));
    ctx.lineTo(sx(K, x0 + i1 * dx), sy(K, h[i1]));
    ctx.lineTo(sx(K, x0 + i1 * dx), K.h + 10);
    ctx.closePath();
    ctx.fillStyle = gr;
    if (welt.glas) ctx.globalAlpha = 0.5;                   // Glaswelt: der Boden ist fast durchsichtig
    ctx.fill();
    ctx.globalAlpha = 1;

    // Steinchen/Krümel im Boden (fest an die Abtastpunkte gebunden)
    ctx.fillStyle = f.punkte;
    for (i = i0 - (i0 % 3); i <= i1; i += 3) {
      var hz = FF.rauschen(i * 0.731, 77) * 0.5 + 0.5;
      var tiefe = 0.7 + hz * 2.6;
      var px = sx(K, x0 + i * dx + hz * 0.8), py = sy(K, h[i] - tiefe);
      if (py > K.h + 10) continue;
      ctx.beginPath();
      ctx.ellipse(px, py, (0.1 + hz * 0.14) * K.s, (0.07 + hz * 0.08) * K.s, hz * 3, 0, Math.PI * 2);
      ctx.fill();
    }

    // Oberflächen-Band (Gras, Sand, Schnee …)
    ctx.lineJoin = "round"; ctx.lineCap = "round";
    ctx.beginPath();
    for (i = i0; i <= i1; i += schritt) {
      var X = sx(K, x0 + i * dx), Y = sy(K, h[i]) + 0.17 * K.s;
      if (i === i0) ctx.moveTo(X, Y); else ctx.lineTo(X, Y);
    }
    ctx.strokeStyle = f.oberflaeche;
    ctx.lineWidth = 0.38 * K.s;
    ctx.stroke();
    ctx.beginPath();
    for (i = i0; i <= i1; i += schritt) {
      X = sx(K, x0 + i * dx); Y = sy(K, h[i]) + 0.03 * K.s;
      if (i === i0) ctx.moveTo(X, Y); else ctx.lineTo(X, Y);
    }
    ctx.strokeStyle = f.kante;
    ctx.lineWidth = 0.1 * K.s;
    ctx.stroke();

    // Welt-typische Details
    var stil = welt.id;
    if (stil === "wiese" || stil === "dschungel" || stil === "pfuetzen" || stil === "garten" || stil === "nacht") {
      ctx.strokeStyle = f.kante; ctx.lineWidth = Math.max(1, 0.06 * K.s);
      for (i = i0 - (i0 % 2); i <= i1; i += 2) {
        var hz2 = FF.rauschen(i * 1.37, 5);
        X = sx(K, x0 + i * dx); Y = sy(K, h[i]);
        var wind = Math.sin(zeit * 2 + i * 0.4) * 0.05 * K.s;
        ctx.beginPath();
        ctx.moveTo(X, Y + 0.05 * K.s); ctx.lineTo(X + wind - 0.06 * K.s, Y - (0.22 + hz2 * 0.1) * K.s);
        ctx.moveTo(X + 0.08 * K.s, Y + 0.05 * K.s); ctx.lineTo(X + wind + 0.1 * K.s, Y - (0.18 - hz2 * 0.08) * K.s);
        ctx.stroke();
      }
    } else if (stil === "bonbon") {
      ctx.fillStyle = f.oberflaeche;
      for (i = i0 - (i0 % 3); i <= i1; i += 3) {
        var tropf = (0.18 + (FF.rauschen(i * 0.9, 3) * 0.5 + 0.5) * 0.3) * K.s;
        X = sx(K, x0 + i * dx); Y = sy(K, h[i]) + 0.3 * K.s;
        ctx.beginPath(); ctx.ellipse(X, Y, 0.17 * K.s, tropf, 0, 0, Math.PI * 2); ctx.fill();
      }
    } else if (stil === "vulkan") {
      ctx.strokeStyle = "rgba(255,123,58," + (0.55 + 0.25 * Math.sin(zeit * 3)) + ")";
      ctx.lineWidth = Math.max(1, 0.07 * K.s);
      for (i = i0 - (i0 % 9); i <= i1; i += 9) {
        X = sx(K, x0 + i * dx); Y = sy(K, h[i] - 1.2);
        ctx.beginPath();
        ctx.moveTo(X, Y); ctx.lineTo(X + 0.4 * K.s, Y + 0.5 * K.s); ctx.lineTo(X + 0.1 * K.s, Y + 1.1 * K.s);
        ctx.lineTo(X + 0.6 * K.s, Y + 1.7 * K.s);
        ctx.stroke();
      }
    } else if (stil === "herbst") {
      // buntes Laub auf dem Weg
      var laub = ["#e8862e", "#d9532b", "#f2b233"];
      for (i = i0 - (i0 % 3); i <= i1; i += 3) {
        var hl = FF.rauschen(i * 1.91, 8) * 0.5 + 0.5;
        X = sx(K, x0 + i * dx + hl); Y = sy(K, h[i]) + 0.02 * K.s;
        ctx.fillStyle = laub[i % 3];
        ctx.beginPath(); ctx.ellipse(X, Y, 0.12 * K.s, 0.05 * K.s, hl * 3, 0, Math.PI * 2); ctx.fill();
      }
    } else if (stil === "fabrik") {
      ctx.strokeStyle = "rgba(0,0,0,0.18)"; ctx.lineWidth = Math.max(1, 0.04 * K.s);
      for (i = i0 - (i0 % 6); i <= i1; i += 6) {
        X = sx(K, x0 + i * dx); Y = sy(K, h[i]);
        ctx.beginPath(); ctx.moveTo(X, Y + 0.05 * K.s); ctx.lineTo(X, Y + 0.6 * K.s); ctx.stroke();
      }
    } else if (stil === "glas") {
      // Glaskanten im Boden: helle Lichtreflexe
      ctx.strokeStyle = "rgba(255,255,255,0.55)"; ctx.lineWidth = Math.max(1, 0.05 * K.s);
      for (i = i0 - (i0 % 8); i <= i1; i += 8) {
        X = sx(K, x0 + i * dx); Y = sy(K, h[i]);
        ctx.beginPath(); ctx.moveTo(X, Y + 0.4 * K.s); ctx.lineTo(X + 0.7 * K.s, Y + 1.6 * K.s); ctx.stroke();
      }
    } else if (stil === "bausteine") {
      // Noppen auf der Oberfläche und Steinfugen im Boden
      ctx.fillStyle = f.oberflaeche;
      var np = Math.max(2, Math.round(0.8 / dx));
      ctx.beginPath();
      for (i = i0 - (i0 % np); i <= i1; i += np) {
        X = sx(K, x0 + i * dx); Y = sy(K, h[i]);
        ctx.rect(X - 0.17 * K.s, Y - 0.14 * K.s, 0.34 * K.s, 0.16 * K.s);
      }
      ctx.fill();
      ctx.strokeStyle = "rgba(0,0,0,0.16)"; ctx.lineWidth = Math.max(1, 0.04 * K.s);
      ctx.beginPath();                                       // alle Fugen in EINEM Pfad (schneller)
      for (var reihe = 1; reihe <= 3; reihe++) {
        for (i = i0; i <= i1; i += 4) { X = sx(K, x0 + i * dx); Y = sy(K, h[i] - reihe * 0.9); if (i === i0) ctx.moveTo(X, Y); else ctx.lineTo(X, Y); }
        for (i = i0 - (i0 % 8) + (reihe % 2) * 4; i <= i1; i += 8) { X = sx(K, x0 + i * dx); Y = sy(K, h[i] - reihe * 0.9); ctx.moveTo(X, Y); ctx.lineTo(X, Y - 0.9 * K.s); }
      }
      ctx.stroke();
    } else if (stil === "station") {
      ctx.strokeStyle = "rgba(0,0,0,0.25)"; ctx.lineWidth = Math.max(1, 0.04 * K.s);
      for (i = i0 - (i0 % 5); i <= i1; i += 5) {                   // Bodenplatten mit Nieten
        X = sx(K, x0 + i * dx); Y = sy(K, h[i]);
        ctx.beginPath(); ctx.moveTo(X, Y + 0.08 * K.s); ctx.lineTo(X, Y + 0.9 * K.s); ctx.stroke();
      }
      ctx.fillStyle = "rgba(122,240,255," + (0.5 + 0.3 * Math.sin(zeit * 3)) + ")";
      for (i = i0 - (i0 % 10); i <= i1; i += 10) { X = sx(K, x0 + i * dx + 0.4); Y = sy(K, h[i]) + 0.45 * K.s; ctx.fillRect(X - 0.06 * K.s, Y - 0.06 * K.s, 0.12 * K.s, 0.12 * K.s); }
    } else if (stil === "mars") {
      for (i = i0 - (i0 % 9); i <= i1; i += 9) {
        var gm = FF.rauschen(i * 0.53, 4) * 0.5 + 0.5;
        X = sx(K, x0 + i * dx); Y = sy(K, h[i] - 0.8 - gm * 1.6);
        ctx.fillStyle = "rgba(60,20,10,0.15)";
        ctx.beginPath(); ctx.ellipse(X, Y, (0.35 + gm * 0.4) * K.s, (0.2 + gm * 0.2) * K.s, 0, 0, Math.PI * 2); ctx.fill();
      }
    } else if (stil === "meer") {
      // Rippel im Sand
      ctx.strokeStyle = "rgba(150,115,60,0.35)"; ctx.lineWidth = Math.max(1, 0.05 * K.s);
      for (i = i0 - (i0 % 4); i <= i1; i += 4) {
        X = sx(K, x0 + i * dx); Y = sy(K, h[i] - 0.35);
        ctx.beginPath(); ctx.arc(X, Y + 0.25 * K.s, 0.3 * K.s, 1.25 * Math.PI, 1.75 * Math.PI); ctx.stroke();
      }
    } else if (stil === "mond") {
      for (i = i0 - (i0 % 11); i <= i1; i += 11) {
        var g2 = FF.rauschen(i * 0.37, 9) * 0.5 + 0.5;
        X = sx(K, x0 + i * dx); Y = sy(K, h[i] - 0.9 - g2 * 1.5);
        ctx.fillStyle = "rgba(0,0,0,0.12)";
        ctx.beginPath(); ctx.ellipse(X, Y, (0.4 + g2 * 0.5) * K.s, (0.25 + g2 * 0.25) * K.s, 0, 0, Math.PI * 2); ctx.fill();
      }
    }
  }

  /* Pfützen: Wasser von der Oberfläche (kleine Wellen) bis zum Boden; bei Regen
     ploppen Ringe auf. Das Wasser ist leicht durchsichtig (der Boden schimmert durch). */
  function zeichneWasser(ctx, K, gel, welt, zeit, x0, x1) {
    var P = gel.pfuetzen, farbe = welt.farben.wasser || "#5fa8de";
    for (var i = 0; i < P.length; i++) {
      var p = P[i];
      if (p.x1 < x0 - 1 || p.x0 > x1 + 1) continue;
      var Y = sy(K, p.y), x, schritt = Math.max(0.25, Math.min(0.5, 6 / K.s));
      ctx.beginPath(); ctx.moveTo(sx(K, p.x0), Y);
      for (x = p.x0 + schritt; x < p.x1; x += schritt) ctx.lineTo(sx(K, x), Y + Math.sin(x * 2.3 + zeit * 3) * 0.03 * K.s);
      ctx.lineTo(sx(K, p.x1), Y);
      for (x = p.x1; x > p.x0; x -= schritt) ctx.lineTo(sx(K, x), sy(K, Math.min(gel.hoeheBei(x), p.y)));
      ctx.closePath();
      var gr = ctx.createLinearGradient(0, Y, 0, Y + 0.8 * K.s);
      gr.addColorStop(0, hell(farbe, 0.25)); gr.addColorStop(1, dunkel(farbe, 0.25));
      ctx.globalAlpha = 0.78; ctx.fillStyle = gr; ctx.fill(); ctx.globalAlpha = 1;
      // Spiegelung: heller Rand und zwei Glanzstriche
      ctx.strokeStyle = "rgba(255,255,255,0.75)"; ctx.lineWidth = Math.max(1, 0.05 * K.s); ctx.lineCap = "round";
      ctx.beginPath(); ctx.moveTo(sx(K, p.x0 + 0.1), Y); ctx.lineTo(sx(K, p.x1 - 0.1), Y); ctx.stroke();
      ctx.strokeStyle = "rgba(255,255,255,0.45)";
      var w = p.x1 - p.x0;
      ctx.beginPath(); ctx.moveTo(sx(K, p.x0 + w * 0.2), Y + 0.12 * K.s); ctx.lineTo(sx(K, p.x0 + w * 0.38), Y + 0.12 * K.s);
      ctx.moveTo(sx(K, p.x0 + w * 0.55), Y + 0.22 * K.s); ctx.lineTo(sx(K, p.x0 + w * 0.66), Y + 0.22 * K.s); ctx.stroke();
      if (welt.wetter === "regen") {                         // Regentropfen-Ringe
        ctx.strokeStyle = "rgba(255,255,255,0.6)"; ctx.lineWidth = Math.max(1, 0.03 * K.s);
        for (var k = 0; k < w / 1.5; k++) {
          var u = (zeit * 1.4 + zufall01(k + i * 17, 9)) % 1, xr = p.x0 + 0.3 + (w - 0.6) * zufall01(k + i * 17 + Math.floor(zeit * 1.4 + zufall01(k + i * 17, 9)), 10);
          ctx.globalAlpha = 1 - u;
          ctx.beginPath(); ctx.ellipse(sx(K, xr), Y, (0.05 + 0.3 * u) * K.s, (0.02 + 0.08 * u) * K.s, 0, 0, Math.PI * 2); ctx.stroke();
        }
        ctx.globalAlpha = 1;
      }
    }
  }

  /* Hüpfpilze: roter Pilzhut mit weißen Tupfen auf der Kuppel im Boden. Nach dem
     Abprall wabbelt er kurz (t = Sekunden seit "boing", Fahrtzeit). */
  function zeichneTrampoline(ctx, K, gel, fahrzeit) {
    var T = gel.trampoline;
    for (var i = 0; i < T.length; i++) {
      var t = T[i], X0 = sx(K, t.x0 - 0.35), X1 = sx(K, t.x1 + 0.35);
      if (X1 < -20 || X0 > K.b + 20) continue;
      var basis = gel.hoeheBei(t.x0 - 0.5), dt = fahrzeit - t.boing;
      var wabbel = dt >= 0 && dt < 0.8 ? Math.sin(dt * 28) * Math.exp(-dt * 5) * 0.25 : 0;
      var top = function (x) { var u = (x - t.x0) / (t.x1 - t.x0); return basis + (t.H + 0.12) * (1 - wabbel) * Math.sin(Math.PI * Math.max(0, Math.min(1, u)) * 0.92 + Math.PI * 0.04); };
      if (gel.welt.trampolinStil === "matte") {                     // echtes Trampolin: Beine, Rahmen, blaue Matte
        ctx.strokeStyle = "#3a4152"; ctx.lineWidth = Math.max(2, 0.12 * K.s); ctx.lineCap = "round";
        ctx.beginPath();
        [0.05, 0.5, 0.95].forEach(function (q) { var xq = t.x0 + (t.x1 - t.x0) * q; ctx.moveTo(sx(K, xq), sy(K, basis)); ctx.lineTo(sx(K, xq), sy(K, top(xq))); });
        ctx.stroke();
        ctx.beginPath();
        for (var xm = t.x0; xm <= t.x1 + 0.01; xm += 0.25) { var Ym = sy(K, top(xm) + 0.05); if (xm === t.x0) ctx.moveTo(sx(K, xm), Ym); else ctx.lineTo(sx(K, xm), Ym); }
        ctx.strokeStyle = "#2f6fd6"; ctx.lineWidth = Math.max(4, 0.26 * K.s); ctx.stroke();
        ctx.strokeStyle = "#ffd23f"; ctx.lineWidth = Math.max(2, 0.08 * K.s); ctx.stroke();
        continue;
      }
      ctx.beginPath(); ctx.moveTo(X0, sy(K, basis + 0.05));
      for (var x = t.x0 - 0.35; x <= t.x1 + 0.35; x += 0.25) ctx.lineTo(sx(K, x), sy(K, top(x)));
      ctx.lineTo(X1, sy(K, basis + 0.05));
      ctx.quadraticCurveTo((X0 + X1) / 2, sy(K, basis - 0.12), X0, sy(K, basis + 0.05));
      var gr = ctx.createLinearGradient(0, sy(K, basis + t.H + 0.2), 0, sy(K, basis));
      gr.addColorStop(0, "#ff6a5a"); gr.addColorStop(1, "#c42a20");
      ctx.fillStyle = gr; ctx.fill();
      ctx.strokeStyle = "rgba(90,20,20,0.55)"; ctx.lineWidth = Math.max(1, 0.05 * K.s); ctx.stroke();
      ctx.fillStyle = "#fffaf0";
      [[0.18, 0.45, 0.2], [0.42, 0.7, 0.26], [0.68, 0.55, 0.22], [0.86, 0.3, 0.15], [0.3, 0.2, 0.12], [0.58, 0.25, 0.14]].forEach(function (d) {
        var xd = t.x0 + (t.x1 - t.x0) * d[0], yd = basis + (top(xd) - basis) * d[1];
        ctx.beginPath(); ctx.ellipse(sx(K, xd), sy(K, yd), d[2] * K.s, d[2] * 0.7 * K.s, 0, 0, Math.PI * 2); ctx.fill();
      });
      ctx.strokeStyle = "rgba(255,255,255,0.5)"; ctx.lineWidth = Math.max(1, 0.08 * K.s);
      ctx.beginPath(); ctx.arc(sx(K, t.x0 + (t.x1 - t.x0) * 0.35), sy(K, basis + t.H * 0.55), (t.x1 - t.x0) * 0.22 * K.s, 1.15 * Math.PI, 1.45 * Math.PI); ctx.stroke();
    }
  }

  /* =========================================================================
     3) WETTER (Schnee, Regen, Laub, Blasen, Glühwürmchen, Feuerwerk …)
     ========================================================================= */
  function Wetter() { this.teile = []; this.art = null; this.letztesX = null; this.bursts = []; this.naechster = 0; }
  var HINTEN = { sterne: true, feuerwerk: true };     // diese Arten liegen hinter den Bergen
  Wetter.prototype.setze = function (art, K) {
    this.art = art; this.teile = []; this.bursts = []; this.naechster = 0.6;
    if (!art) return;
    // Wenige Teilchen: Sie liegen vor dem Auto und sollen nicht ablenken
    var n = { sterne: 70, feuerwerk: 40, schnee: 20, glitzer: 18, regen: 46, laub: 22, blasen: 18, gluehwuermchen: 16, marsstaub: 26, adler: 3, fledermaeuse: 7 }[art] || 14;
    for (var i = 0; i < n; i++) {
      this.teile.push({ x: Math.random() * (K.b || 800), y: (art === "gluehwuermchen" ? 0.4 + 0.35 * Math.random() : Math.random()) * (K.h || 400), p: Math.random() * 6.28, g: 0.5 + Math.random() });
    }
  };
  Wetter.prototype.zeichne = function (ctx, K, dt, zeit, hinten) {
    var art = this.art;
    if (!art || !!HINTEN[art] !== hinten) return;
    var dx = this.letztesX === null ? 0 : (K.x - this.letztesX) * K.s;
    this.letztesX = K.x;
    var B = K.b, H = K.h;
    if (art === "feuerwerk") this.feuerwerk(ctx, K, dt);
    for (var i = 0; i < this.teile.length; i++) {
      var t = this.teile[i];
      if (art === "sterne" || art === "feuerwerk") {
        var x = ((t.x - K.x * K.s * 0.02) % B + B) % B;
        ctx.fillStyle = "rgba(255,255,255," + (0.4 + 0.5 * Math.abs(Math.sin(zeit * 1.5 + t.p))) + ")";
        ctx.fillRect(x, t.y * 0.65, 1.5 * t.g, 1.5 * t.g);
        continue;
      }
      if (art === "schnee") { t.y += (30 + 25 * t.g) * dt; t.x += Math.sin(zeit + t.p) * 12 * dt - dx * 0.6; }
      else if (art === "blaetter") { t.y += (25 + 15 * t.g) * dt; t.x += Math.sin(zeit * 0.8 + t.p) * 30 * dt - dx * 0.6; }
      else if (art === "konfetti") { t.y += (22 + 12 * t.g) * dt; t.x += Math.sin(zeit + t.p) * 15 * dt - dx * 0.6; }
      else if (art === "funken") { t.y -= (30 + 30 * t.g) * dt; t.x += Math.sin(zeit * 2 + t.p) * 10 * dt - dx * 0.6; }
      else if (art === "staub") { t.y += Math.sin(zeit * 0.7 + t.p) * 6 * dt; t.x += (-14 - 10 * t.g) * dt - dx * 0.8; }
      else if (art === "glitzer") { t.y += Math.sin(zeit * 0.5 + t.p) * 5 * dt - 3 * dt; t.x += Math.cos(zeit * 0.4 + t.p) * 4 * dt - dx * 0.7; }
      else if (art === "regen") { t.y += (620 + 260 * t.g) * dt; t.x += -90 * dt - dx * 0.9; }
      else if (art === "pollen") { t.y += Math.sin(zeit * 0.6 + t.p) * 8 * dt - 4 * dt; t.x += (10 + 6 * t.g) * dt - dx * 0.7; }
      else if (art === "laub") {                                  // fliegt mit dem Wind (windJetzt: −1 … 1)
        t.y += (18 + 14 * t.g) * dt + Math.sin(zeit * 1.7 + t.p) * 20 * dt;
        t.x += (windJetzt * (160 + 120 * t.g) + Math.sin(zeit * 0.8 + t.p) * 25) * dt - dx * 0.7;
      }
      else if (art === "marsstaub") {                             // Staubsturm: fliegt mit dem Wind
        t.y += Math.sin(zeit * 0.9 + t.p) * 10 * dt; t.x += (windJetzt * (240 + 160 * t.g) - 15) * dt - dx * 0.8;
      }
      else if (art === "adler" || art === "fledermaeuse") {
        // Hängen an der Landschaft (weit weg: wenig Parallaxe) und ziehen nur langsam
        // selbst weiter – bei langsamer Fahrt fliegen sie also nicht durchs Bild
        var adler = art === "adler", spanne = B + 160;
        if (t.ox === undefined) t.ox = t.x;
        t.ox += (adler ? 6 + 4 * t.g : (t.p > 3 ? 1 : -1) * (12 + 10 * t.g)) * dt;
        t.x = ((t.ox - K.x * K.s * (adler ? 0.1 : 0.3) + Math.sin(zeit * (adler ? 0.25 : 0.9) + t.p) * (adler ? 40 : 25)) % spanne + spanne) % spanne - 80;
        t.y = adler ? H * (0.1 + 0.12 * t.g) + Math.sin(zeit * 0.35 + t.p) * H * 0.04
                    : H * (0.15 + 0.3 * ((t.p * 7) % 1)) + Math.sin(zeit * 3 + t.p * 5) * 12;
        t.frei = true;
      }
      else if (art === "blasen") { t.y -= (28 + 30 * t.g) * dt; t.x += Math.sin(zeit * 2 + t.p) * 9 * dt - dx * 0.6; }
      else if (art === "gluehwuermchen") {
        t.y += Math.sin(zeit * 0.9 + t.p * 2) * 16 * dt; t.x += Math.cos(zeit * 0.7 + t.p * 3) * 20 * dt - dx * 0.55;
        if (t.y < H * 0.4) t.y += 40 * dt;                        // bleiben über dem Boden, nicht im Himmel
        if (t.y > H * 0.75) t.y -= 40 * dt;
      }
      if (t.y > H + 10) { t.y = -10; t.x = Math.random() * B; }
      if (t.y < -10) { t.y = H + 10; t.x = Math.random() * B; }
      if (!t.frei) t.x = ((t.x % (B + 20)) + B + 20) % (B + 20) - 10;
      if (art === "schnee") {
        ctx.fillStyle = "rgba(255,255,255,0.9)";
        ctx.beginPath(); ctx.arc(t.x, t.y, 1.5 + t.g * 1.8, 0, Math.PI * 2); ctx.fill();
      } else if (art === "blaetter") {
        ctx.fillStyle = i % 3 ? "#5fbf4a" : "#9bdc5a";
        ctx.save(); ctx.translate(t.x, t.y); ctx.rotate(zeit * 1.5 + t.p);
        ctx.beginPath(); ctx.ellipse(0, 0, 5 * t.g, 2.5 * t.g, 0, 0, Math.PI * 2); ctx.fill(); ctx.restore();
      } else if (art === "konfetti") {
        ctx.fillStyle = ["#ff6fb5", "#ffd23f", "#4fc3ff", "#8ee6b8", "#ffffff"][i % 5];
        ctx.save(); ctx.translate(t.x, t.y); ctx.rotate(zeit * 2 + t.p);
        ctx.fillRect(-3, -1.5, 6, 3); ctx.restore();
      } else if (art === "funken") {
        ctx.fillStyle = "rgba(255," + (120 + 80 * t.g | 0) + ",60," + (0.5 + 0.4 * Math.sin(zeit * 6 + t.p)) + ")";
        ctx.beginPath(); ctx.arc(t.x, t.y, 1.2 + t.g, 0, Math.PI * 2); ctx.fill();
      } else if (art === "glitzer") {
        var gz = 0.5 + 0.5 * Math.sin(zeit * 3 + t.p * 5);
        ctx.fillStyle = t.g > 0.5 ? "rgba(143,232,255," + (0.15 + 0.6 * gz) + ")" : "rgba(213,156,255," + (0.15 + 0.5 * gz) + ")";
        ctx.beginPath(); ctx.arc(t.x, t.y, 0.8 + 1.4 * t.g * gz, 0, Math.PI * 2); ctx.fill();
      } else if (art === "staub") {
        ctx.fillStyle = "rgba(196,150,92," + (0.22 + 0.18 * t.g) + ")";
        ctx.beginPath(); ctx.arc(t.x, t.y, 1.5 + 2.2 * t.g, 0, Math.PI * 2); ctx.fill();
      } else if (art === "regen") {
        ctx.strokeStyle = "rgba(215,230,255," + (0.35 + 0.25 * t.g) + ")"; ctx.lineWidth = 1.2;
        ctx.beginPath(); ctx.moveTo(t.x, t.y); ctx.lineTo(t.x - 3 - 2 * t.g, t.y - 12 - 8 * t.g); ctx.stroke();
      } else if (art === "pollen") {
        ctx.strokeStyle = "rgba(255,255,255,0.75)"; ctx.lineWidth = 1;
        ctx.beginPath();
        for (var pk = 0; pk < 6; pk++) { var pw = pk * Math.PI / 3 + t.p; ctx.moveTo(t.x, t.y); ctx.lineTo(t.x + Math.cos(pw) * 4 * t.g, t.y + Math.sin(pw) * 4 * t.g); }
        ctx.stroke();
        ctx.fillStyle = "rgba(255,255,255,0.9)"; ctx.beginPath(); ctx.arc(t.x, t.y, 1.3, 0, Math.PI * 2); ctx.fill();
      } else if (art === "laub") {
        if (i % 4 === 0 && Math.abs(windJetzt) > 0.35) {          // Windstriche zeigen, woher der Wind kommt
          var lw = 40 + 30 * t.g, rw = windJetzt > 0 ? 1 : -1;
          ctx.strokeStyle = "rgba(255,255,255," + (0.35 * Math.abs(windJetzt)) + ")"; ctx.lineWidth = 2; ctx.lineCap = "round";
          ctx.beginPath(); ctx.moveTo(t.x - rw * lw, t.y); ctx.quadraticCurveTo(t.x - rw * lw * 0.3, t.y - 6, t.x, t.y - 2); ctx.stroke();
          continue;
        }
        ctx.fillStyle = ["#e8862e", "#d9532b", "#f2b233", "#b8682a"][i % 4];
        ctx.save(); ctx.translate(t.x, t.y); ctx.rotate(zeit * 2.5 * (0.5 + t.g) + t.p);
        ctx.beginPath(); ctx.ellipse(0, 0, 5 * t.g + 2, 2.5 * t.g + 1, 0, 0, Math.PI * 2); ctx.fill(); ctx.restore();
      } else if (art === "marsstaub") {
        var ms = Math.abs(windJetzt);
        ctx.fillStyle = "rgba(214,140,95," + (0.18 + 0.3 * ms * t.g) + ")";
        ctx.beginPath(); ctx.ellipse(t.x, t.y, 2 + 9 * ms * t.g, 1.5 + 1.5 * t.g, 0, 0, Math.PI * 2); ctx.fill();
      } else if (art === "adler") {
        var aw = 18 + 10 * t.g, fl = Math.sin(zeit * 2 + t.p) * 0.25;
        ctx.fillStyle = "#4a3a2e";
        ctx.beginPath(); ctx.moveTo(t.x - aw, t.y - aw * (0.15 + fl)); ctx.quadraticCurveTo(t.x - aw * 0.4, t.y - aw * 0.3, t.x, t.y);
        ctx.quadraticCurveTo(t.x + aw * 0.4, t.y - aw * 0.3, t.x + aw, t.y - aw * (0.15 + fl)); ctx.quadraticCurveTo(t.x + aw * 0.4, t.y - aw * 0.05, t.x, t.y + aw * 0.12);
        ctx.quadraticCurveTo(t.x - aw * 0.4, t.y - aw * 0.05, t.x - aw, t.y - aw * (0.15 + fl)); ctx.fill();
        ctx.fillStyle = "#f4f6fb"; ctx.beginPath(); ctx.arc(t.x + aw * 0.12, t.y - aw * 0.05, aw * 0.08, 0, Math.PI * 2); ctx.fill();
      } else if (art === "fledermaeuse") {
        var fw = 9 + 6 * t.g, fs = Math.sin(zeit * 14 + t.p * 3);
        ctx.fillStyle = "#1a1426";
        ctx.beginPath(); ctx.moveTo(t.x, t.y);
        ctx.quadraticCurveTo(t.x - fw * 0.5, t.y - fw * fs * 0.6, t.x - fw, t.y - fw * fs * 0.3); ctx.lineTo(t.x - fw * 0.6, t.y + fw * 0.15); ctx.lineTo(t.x - fw * 0.3, t.y + fw * 0.05);
        ctx.lineTo(t.x, t.y + fw * 0.2); ctx.lineTo(t.x + fw * 0.3, t.y + fw * 0.05); ctx.lineTo(t.x + fw * 0.6, t.y + fw * 0.15);
        ctx.lineTo(t.x + fw, t.y - fw * fs * 0.3); ctx.quadraticCurveTo(t.x + fw * 0.5, t.y - fw * fs * 0.6, t.x, t.y); ctx.fill();
        ctx.fillStyle = "#ffd23f"; ctx.fillRect(t.x - 2, t.y + 1, 1.5, 1.5); ctx.fillRect(t.x + 1, t.y + 1, 1.5, 1.5);
      } else if (art === "blasen") {
        var br = 1.5 + 3 * t.g;
        ctx.strokeStyle = "rgba(225,248,255,0.6)"; ctx.lineWidth = 1.2;
        ctx.beginPath(); ctx.arc(t.x, t.y, br, 0, Math.PI * 2); ctx.stroke();
        ctx.fillStyle = "rgba(255,255,255,0.7)"; ctx.beginPath(); ctx.arc(t.x - br * 0.35, t.y - br * 0.35, br * 0.25, 0, Math.PI * 2); ctx.fill();
      } else if (art === "gluehwuermchen") {
        var gw = Math.max(0, Math.sin(zeit * 1.6 + t.p * 5)) * 0.85 + 0.15;   // blinken langsam auf und ab
        var gr2 = 9 * t.g + 4;
        ctx.globalCompositeOperation = "lighter"; ctx.globalAlpha = 0.5 * gw;
        ctx.drawImage(fleck("210,255,110"), t.x - gr2, t.y - gr2, 2 * gr2, 2 * gr2);
        ctx.globalCompositeOperation = "source-over"; ctx.globalAlpha = 1;
        ctx.fillStyle = "rgba(250,255,200," + gw + ")"; ctx.beginPath(); ctx.arc(t.x, t.y, 1.2 + 0.5 * t.g, 0, Math.PI * 2); ctx.fill();
      }
    }
  };

  /* Feuerwerk über dem Achterbahn-Park: alle 1–2 s eine bunte Blüte */
  var FEUERWERK_FARBEN = ["#ff6fb5", "#ffd23f", "#6fd6ff", "#8ee6b8", "#ff8a5c", "#c9a0ff"];
  Wetter.prototype.feuerwerk = function (ctx, K, dt) {
    this.naechster -= dt;
    if (this.naechster <= 0) {
      this.naechster = 0.9 + Math.random() * 1.3;
      this.bursts.push({ x: K.b * (0.1 + Math.random() * 0.8), y: K.h * (0.1 + Math.random() * 0.28), t: 0,
                         dauer: 1.5 + Math.random() * 0.5, r: Math.min(K.b, K.h) * (0.07 + Math.random() * 0.06),
                         farbe: FEUERWERK_FARBEN[Math.floor(Math.random() * FEUERWERK_FARBEN.length)], n: 14 + Math.floor(Math.random() * 8) });
    }
    for (var i = this.bursts.length - 1; i >= 0; i--) {
      var b = this.bursts[i];
      b.t += dt;
      var u = b.t / b.dauer;
      if (u >= 1) { this.bursts.splice(i, 1); continue; }
      var rad = b.r * (1 - (1 - u) * (1 - u)), sinken = b.r * 0.35 * u * u;
      ctx.globalAlpha = 1 - u;
      ctx.fillStyle = b.farbe;
      for (var k = 0; k < b.n; k++) {
        var w = k / b.n * Math.PI * 2;
        ctx.beginPath(); ctx.arc(b.x + Math.cos(w) * rad, b.y + Math.sin(w) * rad + sinken, 2.2 - u, 0, Math.PI * 2); ctx.fill();
      }
    }
    ctx.globalAlpha = 1;
  };

  /* =========================================================================
     4) NACHT (Nachtwald): Ein dunkler Schleier, in den die Lichter Löcher
     schneiden – Scheinwerferkegel, Licht ums Auto, Laternen, Lagerfeuer,
     Leuchtpilze, Mond, und ein Schimmer um Münzen und Kanister,
     damit Kinder sie auch im Dunkeln finden. Gemalt in halber Auflösung in ein
     eigenes Bild (weich und schnell), dann einmal über die Szene gelegt.
     ========================================================================= */
  // Leuchtende Requisiten: [Höhe der Lichtquelle (Anteil der Größe), Radius (× Größe), Stärke, Farbe für das warme Leuchten]
  var LEUCHTEN = { laterne: [0.8, 2.2, 0.85, "255,190,90"], zelt: [0.12, 2.4, 0.8, "255,150,60"], pilz: [0.7, 1.6, 0.6, "143,232,255"],
                   laternenkuerbis: [0.45, 1.8, 0.75, "255,170,60"] };
  /* Lichtfleck (weich, Farbe "r,g,b") und Scheinwerferkegel werden EINMAL vorgemalt und
     danach nur noch kopiert – Farbverläufe in jedem Bild neu anzulegen ist auf alten
     Tablets teuer (gemessen: halbe Bildrate). */
  var fleckCache = {}, kegelBild = null, KEGEL_OEFF = 0.34;
  function fleck(farbe) {
    var c = fleckCache[farbe];
    if (c) return c;
    c = fleckCache[farbe] = document.createElement("canvas"); c.width = c.height = 64;
    var g = c.getContext("2d"), gr = g.createRadialGradient(32, 32, 0, 32, 32, 32);
    gr.addColorStop(0, "rgba(" + farbe + ",1)"); gr.addColorStop(0.5, "rgba(" + farbe + ",0.45)"); gr.addColorStop(1, "rgba(" + farbe + ",0)");
    g.fillStyle = gr; g.fillRect(0, 0, 64, 64);
    return c;
  }
  function kegel() {                         // zeigt nach rechts, Spitze bei (0, 128)
    if (kegelBild) return kegelBild;
    var c = kegelBild = document.createElement("canvas"); c.width = 256; c.height = 256;
    var g = c.getContext("2d");
    g.beginPath(); g.moveTo(0, 128);
    for (var k = -1; k <= 1.001; k += 0.125) g.lineTo(Math.cos(k * KEGEL_OEFF) * 256, 128 + Math.sin(k * KEGEL_OEFF) * 256);
    g.closePath();
    var gr = g.createRadialGradient(0, 128, 0, 0, 128, 256);
    gr.addColorStop(0, "rgba(0,0,0,0.95)"); gr.addColorStop(0.55, "rgba(0,0,0,0.7)"); gr.addColorStop(1, "rgba(0,0,0,0)");
    g.fillStyle = gr; g.fill();
    return c;
  }
  /* sz.nachtEbene: eigenes <canvas> über dem Spielfeld (spiel.js). Dann legt der Browser
     den Schleier selbst darüber und skaliert ihn (auf Tablets per Grafikchip) – das
     Darübermalen auf dem großen Spielfeld kostete gemessen ein Drittel der Bildzeit.
     Ohne Ebene (Tests, Vorschau) wird er wie früher aufs Spielfeld gemalt. */
  var nachtBild = null;
  function zeichneNacht(ctx, K, f, sz) {
    var N = f.welt.nacht;
    if (!N || typeof document === "undefined") return;
    var q = 0.4, w = Math.max(1, Math.ceil(K.b * q)), h = Math.max(1, Math.ceil(K.h * q));
    if (sz.nachtEbene) nachtBild = sz.nachtEbene;
    else if (!nachtBild || nachtBild === sz.nachtEbene) nachtBild = document.createElement("canvas");
    if (nachtBild.width !== w || nachtBild.height !== h) { nachtBild.width = w; nachtBild.height = h; }
    var g = nachtBild.getContext("2d"), s = K.s, gel = f.gelaende, i, schwarz = fleck("0,0,0"), warm = [];
    g.setTransform(1, 0, 0, 1, 0, 0); g.globalCompositeOperation = "source-over"; g.globalAlpha = 1;
    g.clearRect(0, 0, w, h);
    g.fillStyle = "rgba(5,9,30," + N.dunkel + ")"; g.fillRect(0, 0, w, h);
    // 1) Löcher in den Schleier schneiden
    g.globalCompositeOperation = "destination-out";
    g.setTransform(q, 0, 0, q, 0, 0);
    function licht(X, Y, R, a) {
      if (X < -R || X > K.b + R || Y < -R || Y > K.h + R) return;
      g.globalAlpha = Math.min(1, a); g.drawImage(schwarz, X - R, Y - R, 2 * R, 2 * R);
    }
    licht(K.b * 0.8, K.h * 0.3, Math.min(K.b, K.h) * 0.32, 0.55);                // Mond
    var fz = f.fz, C = fz.chassis, ca = Math.cos(C.a), sa = Math.sin(C.a), xv = 0, strahl = null;
    f.def.huelle.forEach(function (p) { xv = Math.max(xv, p[0]); });
    licht(sx(K, C.x), sy(K, C.y + 0.3), 4.2 * s, 0.9);                         // ums Auto
    if (f.zustand !== "hilfe") {                                               // Scheinwerferkegel
      var HX = sx(K, C.x + ca * (xv - 0.1) - sa * 0.1), HY = sy(K, C.y + sa * (xv - 0.1) + ca * 0.1), L = 17 * s;
      strahl = [HX, HY, L];
      g.globalAlpha = 1; g.save(); g.translate(HX, HY); g.rotate(-C.a); g.drawImage(kegel(), 0, -L / 2, L, L); g.restore();
    }
    if (sz.geist) licht(sx(K, sz.geist.fz.chassis.x), sy(K, sz.geist.fz.chassis.y), 3.2 * s, 0.6);
    var b = sichtbereich(K, gel), D = gel.deko;
    for (i = 0; i < D.length; i++) {                                           // Laternen, Lagerfeuer, Leuchtpilze
      var d = D[i], Lq = d.typ && LEUCHTEN[d.typ];
      if (!Lq || d.x < b[2] - 8 || d.x > b[3] + 8 || d.fuss === undefined) continue;
      var X = sx(K, d.x), Y = sy(K, d.fuss + d.groesse * Lq[0]), R = d.groesse * Lq[1] * s;
      licht(X, Y, R, Lq[2] * (0.9 + 0.1 * Math.sin(sz.zeit * 7 + d.x)));
      warm.push([X, Y, R * 0.75, Lq[3]]);
    }
    var M = gel.muenzen;                                                       // Münzen, Kanister, Raketen schimmern
    for (i = 0; i < M.length; i++) if (!M[i].weg && M[i].x > b[2] - 2 && M[i].x < b[3] + 2) licht(sx(K, M[i].x), sy(K, M[i].y), (M[i].wert >= 100 ? 1.6 : 1.05) * s, 0.6);
    [gel.tanks, gel.raketen || []].forEach(function (Lst) {
      for (var j = 0; j < Lst.length; j++) if (!Lst[j].weg && Lst[j].x > b[2] - 2 && Lst[j].x < b[3] + 2) licht(sx(K, Lst[j].x), sy(K, Lst[j].y + 0.5), 1.8 * s, 0.75);
    });
    if (isFinite(gel.ziel)) licht(sx(K, gel.ziel), sy(K, gel.hoeheBei(gel.ziel) + 2.5), 6 * s, 0.9);
    for (i = 0; i < gel.spuk.length; i++) {                                     // Geister leuchten
      var sa = spukZustand(gel.spuk[i], C.x);
      if (sa > 0) licht(sx(K, gel.spuk[i].x), sy(K, gel.hoeheBei(gel.spuk[i].x) + 0.6 + 2.2 * sa), 2.4 * s, 0.9 * sa);
    }
    if (sz.nachtEbene) {
      // Die Ebene liegt über ALLEM auf dem Spielfeld: Schwebetexte und Instrumente frei lassen
      for (i = 0; i < sz.texte.length; i++) {
        var tx = sz.texte[i];
        licht(sx(K, tx.x), sy(K, tx.y) - tx.t / tx.dauer * 1.4 * s, (tx.gross ? 2.6 : 1.8) * s, 0.95);
      }
      g.globalAlpha = 1;
      if (sz.instrumente) { var ri = Math.max(26, Math.min(44, K.h * 0.085)); g.drawImage(schwarz, K.b / 2 - 3.6 * ri, K.h - 2.3 * ri, 7.2 * ri, 3.4 * ri); g.drawImage(schwarz, K.b / 2 - 2.6 * ri, K.h - 1.9 * ri, 5.2 * ri, 2.4 * ri); }
      if (sz.kraefte) { g.fillStyle = "#000"; g.fillRect(4, 64, 150, 70); }
    }
    // 2) warmes Licht in denselben Schleier malen: Scheinwerferstrahl und Laternen-Schein
    g.globalCompositeOperation = "source-over";
    if (strahl) {
      g.globalAlpha = 0.16; g.save(); g.translate(strahl[0], strahl[1]); g.rotate(-C.a);
      g.drawImage(fleck("255,240,190"), -strahl[2] * 0.15, -strahl[2] * 0.22, strahl[2] * 0.9, strahl[2] * 0.44); g.restore();
    }
    for (i = 0; i < warm.length; i++) { g.globalAlpha = 0.28; g.drawImage(fleck(warm[i][3]), warm[i][0] - warm[i][2], warm[i][1] - warm[i][2], 2 * warm[i][2], 2 * warm[i][2]); }
    if (sz.nachtEbene && sz.wetter.art === "gluehwuermchen") {        // Glühwürmchen leuchten über dem Schleier
      var T = sz.wetter.teile;
      for (i = 0; i < T.length; i++) {
        var gw = Math.max(0, Math.sin(sz.zeit * 1.6 + T[i].p * 5)) * 0.85 + 0.15, gr2 = 6 * T[i].g + 3;
        g.globalAlpha = 0.5 * gw; g.drawImage(fleck("210,255,110"), T[i].x - gr2, T[i].y - gr2, 2 * gr2, 2 * gr2);
      }
    }
    g.globalAlpha = 1; g.setTransform(1, 0, 0, 1, 0, 0);
    if (sz.nachtEbene) { if (sz.nachtEbene.style.display !== "block") sz.nachtEbene.style.display = "block"; }
    else ctx.drawImage(nachtBild, 0, 0, K.b, K.h);
  }


  /* Herbststurm: Wind an der Kamera (für Laub, Windstriche, Windräder) */
  function windAktualisieren(K, welt, gel, dt) {
    if (!welt.wind) return;
    windJetzt = gel.windBei(K.x) / welt.wind.staerke;
    windPhase += windJetzt * 2.2 * (dt || 0);
  }

  /* Förderbänder: Gummiband mit laufenden Pfeilen (Richtung und Tempo), Rollen an
     den Enden, gelb-schwarzer Rand. Die Oberkante liegt genau auf dem Boden. */
  function zeichneBaender(ctx, K, gel, zeit) {
    var B = gel.baender, s = K.s;
    for (var i = 0; i < B.length; i++) {
      var b = B[i], X0 = sx(K, b.x0), X1 = sx(K, b.x1);
      if (X1 < -20 || X0 > K.b + 20) continue;
      var y = gel.hoeheBei((b.x0 + b.x1) / 2), Yo = sy(K, y), Yu = sy(K, y - 0.45), r = (Yu - Yo) / 2;
      ctx.fillStyle = "#3a3f4b";
      ctx.beginPath(); ctx.moveTo(X0, Yo); ctx.lineTo(X1, Yo); ctx.arc(X1, Yo + r, r, -Math.PI / 2, Math.PI / 2); ctx.lineTo(X0, Yu); ctx.arc(X0, Yo + r, r, Math.PI / 2, Math.PI * 1.5); ctx.fill();
      ctx.save(); ctx.beginPath(); ctx.rect(X0, Yo - 1, X1 - X0, Yu - Yo + 2); ctx.clip();
      var abst = 1.4, vers = ((zeit * b.v) % abst + abst) % abst, rt = b.v > 0 ? 1 : -1;
      ctx.strokeStyle = b.v > 0 ? "#7dffb8" : "#ffb35c"; ctx.lineWidth = Math.max(2, 0.09 * s); ctx.lineCap = "round"; ctx.lineJoin = "round";
      for (var x = b.x0 - abst + vers; x < b.x1 + abst; x += abst) {
        var Xp = sx(K, x);
        ctx.beginPath(); ctx.moveTo(Xp - rt * 0.18 * s, Yo + r * 0.45); ctx.lineTo(Xp + rt * 0.12 * s, Yo + r); ctx.lineTo(Xp - rt * 0.18 * s, Yo + r * 1.55); ctx.stroke();
      }
      ctx.restore();
      ctx.fillStyle = "#c7ccd8";
      [X0, X1].forEach(function (Xr) {
        ctx.beginPath(); ctx.arc(Xr, Yo + r, r * 0.7, 0, Math.PI * 2); ctx.fill();
        ctx.save(); ctx.translate(Xr, Yo + r); ctx.rotate(zeit * b.v * 3);
        ctx.strokeStyle = "#7d8597"; ctx.lineWidth = Math.max(1, r * 0.18);
        ctx.beginPath(); ctx.moveTo(-r * 0.5, 0); ctx.lineTo(r * 0.5, 0); ctx.moveTo(0, -r * 0.5); ctx.lineTo(0, r * 0.5); ctx.stroke(); ctx.restore();
      });
      // gelb-schwarzer Warnstreifen als Kante
      var hs = Math.max(2, 0.08 * s);
      for (var k = 0, xs = X0; xs < X1; k++, xs += 0.5 * s) { ctx.fillStyle = k % 2 ? "#2b2f3a" : "#ffd23f"; ctx.fillRect(xs, Yo - hs, Math.min(0.5 * s, X1 - xs), hs); }
    }
  }

  /* Schwebe-Säulen: leuchtende Säule vom Boden bis oben, aufsteigende Ringe und
     Funken, an beiden Seiten ein Sender am Boden */
  function zeichneSchwebezonen(ctx, K, gel, zeit) {
    var Z = gel.schwebezonen, s = K.s;
    for (var i = 0; i < Z.length; i++) {
      var z = Z[i], X0 = sx(K, z.x0), X1 = sx(K, z.x1);
      if (X1 < -40 || X0 > K.b + 40) continue;
      var Yb = sy(K, Math.min(gel.hoeheBei(z.x0), gel.hoeheBei(z.x1)) - 0.5);
      var gr = ctx.createLinearGradient(X0, 0, X1, 0);
      gr.addColorStop(0, "rgba(122,240,255,0)"); gr.addColorStop(0.1, "rgba(122,240,255,0.32)");
      gr.addColorStop(0.5, "rgba(170,140,255,0.16)"); gr.addColorStop(0.9, "rgba(122,240,255,0.32)"); gr.addColorStop(1, "rgba(122,240,255,0)");
      ctx.fillStyle = gr; ctx.fillRect(X0, 0, X1 - X0, Yb);
      ctx.strokeStyle = "rgba(190,250,255,0.45)"; ctx.lineWidth = Math.max(1, 0.05 * s);
      for (var k = 0; k < 5; k++) {                                   // aufsteigende Ringe
        var u = (zeit * 0.35 + k / 5) % 1, Y = Yb - u * Math.min(Yb, 14 * s);
        ctx.globalAlpha = 1 - u;
        ctx.beginPath(); ctx.ellipse((X0 + X1) / 2, Y, (X1 - X0) * 0.45, 0.25 * s, 0, 0, Math.PI * 2); ctx.stroke();
      }
      ctx.globalAlpha = 1;
      ctx.fillStyle = "rgba(230,255,255,0.8)";
      for (k = 0; k < 10; k++) {                                      // Funken
        var uf = (zeit * (0.25 + 0.05 * (k % 3)) + k * 0.137) % 1, xf = z.x0 + (z.x1 - z.x0) * ((k * 0.618) % 1);
        ctx.globalAlpha = 1 - uf;
        ctx.beginPath(); ctx.arc(sx(K, xf), Yb - uf * Math.min(Yb, 12 * s), Math.max(1.2, 0.06 * s), 0, Math.PI * 2); ctx.fill();
      }
      ctx.globalAlpha = 1;
      [z.x0, z.x1].forEach(function (xs) {                             // Sender am Boden
        var Xs = sx(K, xs), Ys = sy(K, gel.hoeheBei(xs));
        ctx.fillStyle = "#3a4152"; ctx.fillRect(Xs - 0.25 * s, Ys - 0.5 * s, 0.5 * s, 0.5 * s);
        ctx.fillStyle = "rgba(122,240,255," + (0.6 + 0.3 * Math.sin(zeit * 4)) + ")";
        ctx.beginPath(); ctx.arc(Xs, Ys - 0.55 * s, 0.16 * s, 0, Math.PI * 2); ctx.fill();
      });
    }
  }

  /* Objekte auf der Strecke: Glas (Block, Kugel, Turm), Bausteine, Baustein-Säulen */
  var STEIN_FARBEN = ["#e8453c", "#2f6fd6", "#ffd23f", "#3cc35a", "#ff8a2e", "#8e5bd8", "#f4f6fb"];
  function baustein(ctx, X, Y, b, h, farbe, s) {           // X, Y = unten links (Bildschirm), b, h in Pixeln
    ctx.fillStyle = farbe; ctx.fillRect(X, Y - h, b, h);
    ctx.fillStyle = "rgba(255,255,255,0.22)"; ctx.fillRect(X, Y - h, b, h * 0.25);
    ctx.fillStyle = "rgba(0,0,0,0.15)"; ctx.fillRect(X, Y - h * 0.15, b, h * 0.15);
    var n = Math.max(1, Math.round(b / (0.4 * s)));
    ctx.fillStyle = farbe;
    for (var k = 0; k < n; k++) ctx.fillRect(X + (k + 0.25) * b / n, Y - h - 0.1 * s, b / n * 0.5, 0.1 * s);
  }
  function zeichneObjekte(ctx, K, gel, x0, x1) {
    var O = gel.objekte, s = K.s;
    for (var i = 0; i < O.length; i++) {
      var o = O[i];
      if (o.kaputt || o.x < x0 - 3 || o.x > x1 + 3) continue;
      var X = sx(K, o.x), Y = sy(K, o.y) + 0.05 * s, b = o.b * s, h = o.h * s;
      if (o.art === "glas") {
        ctx.fillStyle = "rgba(150,215,245,0.5)"; ctx.strokeStyle = "rgba(50,130,195,0.85)"; ctx.lineWidth = Math.max(1.5, 0.06 * s);
        ctx.beginPath();
        if (o.form === "kugel") { ctx.arc(X, Y - h / 2, Math.min(b, h) / 2, 0, Math.PI * 2); }
        else if (o.form === "turm") { ctx.moveTo(X - b * 0.35, Y); ctx.lineTo(X - b * 0.2, Y - h); ctx.lineTo(X + b * 0.2, Y - h); ctx.lineTo(X + b * 0.35, Y); ctx.closePath(); }
        else ctx.rect(X - b / 2, Y - h, b, h);
        ctx.fill(); ctx.stroke();
        ctx.strokeStyle = "rgba(255,255,255,0.9)"; ctx.lineWidth = Math.max(1.5, 0.1 * s);
        ctx.beginPath(); ctx.moveTo(X - b * 0.22, Y - h * 0.62); ctx.lineTo(X - b * 0.05, Y - h * 0.82); ctx.stroke();
        ctx.fillStyle = "rgba(143,232,255,0.25)"; ctx.fillRect(X - b * 0.4, Y - 0.08 * s, b * 0.8, 0.08 * s);
      } else if (o.art === "stein") {
        var lagen = Math.round(o.h / 0.38);
        for (var k = 0; k < lagen; k++) baustein(ctx, X - b / 2 + (k % 2) * 0.1 * s, Y - k * 0.38 * s, b - 0.1 * s, 0.38 * s, STEIN_FARBEN[(o.v + k) % 7], s);
      } else {                                                    // Säule aus Bausteinen
        var n = Math.round(o.h / 0.45);
        for (k = 0; k < n; k++) baustein(ctx, X - b / 2 + ((k % 2) - 0.5) * 0.08 * s, Y - k * 0.45 * s, b, 0.45 * s, STEIN_FARBEN[(o.v + k * 3) % 6], s);
      }
    }
  }

  /* Geisterwelt: freundliche Geister steigen 13 m vor dem Auto aus dem Boden,
     schweben kurz und verblassen, wenn das Auto vorbei ist. Sichtbarkeit nur aus der
     Position des Autos – keine Zeit nötig, im Geisterrennen für beide gleich. */
  function spukZustand(g, autoX) {
    var ein = Math.max(0, Math.min(1, (autoX - (g.x - 13)) / 4)), aus = Math.max(0, Math.min(1, (g.x + 6 - autoX) / 5));
    return Math.min(ein, aus);
  }
  function zeichneSpuk(ctx, K, gel, autoX, zeit) {
    var S = gel.spuk, s = K.s;
    for (var i = 0; i < S.length; i++) {
      var g = S[i], a = spukZustand(g, autoX);
      if (a <= 0) continue;
      var X = sx(K, g.x + Math.sin(zeit * 1.3 + g.v) * 0.4), Y = sy(K, gel.hoeheBei(g.x) + 0.6 + 2.2 * a + Math.sin(zeit * 2 + g.v) * 0.2), r = 0.75 * s;
      ctx.globalAlpha = 0.85 * a;
      ctx.fillStyle = "#f4f6ff";
      ctx.beginPath(); ctx.arc(X, Y, r, Math.PI, 0);
      ctx.lineTo(X + r, Y + r * 1.1);
      for (var k = 0; k < 4; k++) { var xw = X + r - (k + 0.5) * r / 2; ctx.quadraticCurveTo(xw, Y + r * (k % 2 ? 1.35 : 0.85) + Math.sin(zeit * 6 + k) * r * 0.08, xw - r / 4, Y + r * 1.1); }
      ctx.closePath(); ctx.fill();
      ctx.fillStyle = "#2b2140";
      ctx.beginPath(); ctx.ellipse(X - r * 0.32, Y - r * 0.1, r * 0.13, r * 0.18, 0, 0, Math.PI * 2); ctx.ellipse(X + r * 0.32, Y - r * 0.1, r * 0.13, r * 0.18, 0, 0, Math.PI * 2); ctx.fill();
      ctx.beginPath(); ctx.ellipse(X, Y + r * 0.35, r * 0.15, r * 0.2 * (0.6 + 0.4 * Math.abs(Math.sin(zeit * 4 + g.v))), 0, 0, Math.PI * 2); ctx.fill();
      ctx.fillStyle = "rgba(255,140,170,0.6)";
      ctx.beginPath(); ctx.arc(X - r * 0.55, Y + r * 0.2, r * 0.12, 0, Math.PI * 2); ctx.arc(X + r * 0.55, Y + r * 0.2, r * 0.12, 0, Math.PI * 2); ctx.fill();
      if (a > 0.7) {
        ctx.font = "800 " + Math.round(0.55 * s) + "px 'Baloo 2', sans-serif"; ctx.textAlign = "center";
        ctx.fillStyle = "#ffffff"; ctx.fillText("Buh!", X + r * 1.4, Y - r * 1.1);
      }
      ctx.globalAlpha = 1;
    }
  }

  /* Katapult: Holzgestell auf Rädern, A-Bock mit Drehpunkt, Wurfarm mit Schale.
     Nach dem Schuss (k.schuss, Fahrtzeit) schwingt der Arm in 0,25 s nach oben. */
  function zeichneKatapulte(ctx, K, gel, fahrzeit) {
    var KA = gel.katapulte, s = K.s;
    for (var i = 0; i < KA.length; i++) {
      var k = KA[i], X = sx(K, k.x);
      if (X < -6 * s || X > K.b + 6 * s) continue;
      var yb = gel.hoeheBei(k.x), P = { x: k.x - 1.6, y: yb + 2.2 };
      var dt = fahrzeit - k.schuss, u = dt >= 0 && k.schuss > 0 ? Math.min(1, dt / 0.25) : 0;
      var ruhe = Math.atan2(yb + 0.9 - P.y, k.x + 0.6 - P.x), oben = 1.35;           // Arm zur Schale / steil nach oben
      var w = ruhe + (oben - ruhe) * (1 - (1 - u) * (1 - u)), L = 2.4;
      var cx = P.x + Math.cos(w) * L, cy = P.y + Math.sin(w) * L;
      ctx.lineCap = "round"; ctx.lineJoin = "round";
      ctx.strokeStyle = "#6a4528"; ctx.lineWidth = Math.max(3, 0.24 * s);         // Gestell und A-Bock
      ctx.beginPath(); ctx.moveTo(sx(K, k.x - 2.9), sy(K, yb + 0.55)); ctx.lineTo(sx(K, k.x + 1.0), sy(K, yb + 0.55));
      ctx.moveTo(sx(K, P.x - 0.9), sy(K, yb + 0.55)); ctx.lineTo(sx(K, P.x), sy(K, P.y)); ctx.lineTo(sx(K, P.x + 0.9), sy(K, yb + 0.55)); ctx.stroke();
      ctx.strokeStyle = "#8a6238"; ctx.lineWidth = Math.max(3, 0.2 * s);          // Wurfarm
      ctx.beginPath(); ctx.moveTo(sx(K, P.x - Math.cos(w) * 0.7), sy(K, P.y - Math.sin(w) * 0.7)); ctx.lineTo(sx(K, cx), sy(K, cy)); ctx.stroke();
      ctx.fillStyle = "#5a3a22";                                                    // Schale
      ctx.beginPath(); ctx.arc(sx(K, cx), sy(K, cy), 0.55 * s, w - Math.PI * 0.1 + Math.PI / 2, w + Math.PI * 1.1 + Math.PI / 2); ctx.fill();
      ctx.strokeStyle = "#c9a26a"; ctx.lineWidth = Math.max(1, 0.06 * s);           // Spannseil
      ctx.beginPath(); ctx.moveTo(sx(K, P.x - Math.cos(w) * 0.7), sy(K, P.y - Math.sin(w) * 0.7)); ctx.lineTo(sx(K, k.x - 2.8), sy(K, yb + 0.6)); ctx.stroke();
      ctx.fillStyle = "#3a2a1a";                                                    // Räder und Drehpunkt
      [k.x - 2.3, k.x + 0.5].forEach(function (xr) { ctx.beginPath(); ctx.arc(sx(K, xr), sy(K, yb + 0.45), 0.45 * s, 0, Math.PI * 2); ctx.fill(); });
      ctx.fillStyle = "#c9a26a";
      [k.x - 2.3, k.x + 0.5].forEach(function (xr) { ctx.beginPath(); ctx.arc(sx(K, xr), sy(K, yb + 0.45), 0.15 * s, 0, Math.PI * 2); ctx.fill(); });
      ctx.beginPath(); ctx.arc(sx(K, P.x), sy(K, P.y), 0.14 * s, 0, Math.PI * 2); ctx.fill();
      // Fahne mit Zielscheibe
      ctx.fillStyle = "#e8453c"; ctx.beginPath(); ctx.arc(sx(K, P.x), sy(K, P.y + 0.75), 0.32 * s, 0, Math.PI * 2); ctx.fill();
      ctx.fillStyle = "#ffffff"; ctx.beginPath(); ctx.arc(sx(K, P.x), sy(K, P.y + 0.75), 0.2 * s, 0, Math.PI * 2); ctx.fill();
      ctx.fillStyle = "#e8453c"; ctx.beginPath(); ctx.arc(sx(K, P.x), sy(K, P.y + 0.75), 0.09 * s, 0, Math.PI * 2); ctx.fill();
    }
  }

  FF.GrafikWelt = {
    zeichneHimmel: zeichneHimmel, zeichneWolken: zeichneWolken, zeichneBerge: zeichneBerge, zeichneDecke: zeichneDecke,
    zeichneGelaende: zeichneGelaende, zeichneWasser: zeichneWasser, zeichneTrampoline: zeichneTrampoline,
    zeichneNacht: zeichneNacht, windAktualisieren: windAktualisieren, KULISSE: KULISSE, zeichneBaender: zeichneBaender,
    zeichneSchwebezonen: zeichneSchwebezonen, zeichneObjekte: zeichneObjekte, zeichneSpuk: zeichneSpuk, zeichneKatapulte: zeichneKatapulte, baustein: baustein, STEIN_FARBEN: STEIN_FARBEN
  };
  FF.Grafik.Wetter = Wetter;
  FF.Grafik.himmelCss = himmelCss;
})();
