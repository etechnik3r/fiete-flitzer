/* ===========================================================================
   FIETE FLITZER – requisiten.js
   Gezeichnete Kulisse statt Emojis: Steine, Bäume, Tannen, Palmen, Kakteen,
   Farne, Vulkankegel, Kristalle, Dinosaurier, Riesenblumen, Kürbisse,
   Korallen, Laternen, Chips, Roboter …, jeweils in mehreren Varianten.

   RECHENZEIT: Jede Variante wird EINMAL in ein kleines Bild (Canvas) gemalt
   und danach nur noch pixelgenau kopiert – genau wie vorher die Emojis.
   Schlüssel: Art | Variante | Pixelgröße (auf 4 px gerundet) | Pixeldichte.

   Malen: Ursprung unten in der Mitte, y nach OBEN negativ (Canvas-üblich),
   u = Pixel pro "Einheit" = Höhe der Requisite. Jeder Maler bekommt einen
   eigenen Zufall (fest je Variante), damit Varianten verschieden aussehen.
   =========================================================================== */
(function () {
  "use strict";
  var FF = window.FF = window.FF || {};

  function zufall(seed) {                    // mulberry32: schnell, reproduzierbar
    var a = seed >>> 0;
    return function () {
      a = (a + 0x6D2B79F5) >>> 0;
      var t = a;
      t = Math.imul(t ^ (t >>> 15), t | 1);
      t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
      return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
    };
  }
  function mische(a, b, f) {
    var pa = parseInt(a.slice(1), 16), pb = parseInt(b.slice(1), 16);
    var r = Math.round(((pa >> 16) & 255) * (1 - f) + ((pb >> 16) & 255) * f);
    var g = Math.round(((pa >> 8) & 255) * (1 - f) + ((pb >> 8) & 255) * f);
    var bl = Math.round((pa & 255) * (1 - f) + (pb & 255) * f);
    return "#" + ((1 << 24) + (r << 16) + (g << 8) + bl).toString(16).slice(1);
  }
  function hell(c, f) { return mische(c, "#ffffff", f); }
  function dunkel(c, f) { return mische(c, "#000000", f); }
  var KONTUR = "rgba(30,30,45,0.55)";

  /* Unregelmäßiger Stein/Fels (Umriss als Punkte) mit Licht von links oben */
  function felsForm(g, u, R, breite, hoehe, farbe, kanten) {
    var n = 7 + Math.floor(R() * 3), pkt = [];
    for (var i = 0; i <= n; i++) {
      var w = Math.PI * i / n;                                   // 0 … π: rechts → links über oben
      var rr = 0.82 + 0.3 * R();
      pkt.push([Math.cos(w) * breite / 2 * u * rr, -Math.sin(w) * hoehe * u * (0.75 + 0.3 * R())]);
    }
    pkt[0][1] = 0; pkt[n][1] = 0;
    g.beginPath(); g.moveTo(pkt[0][0], 0);
    for (i = 1; i <= n; i++) {
      var p = pkt[i], q = pkt[i - 1];
      if (kanten) g.lineTo(p[0], p[1]); else g.quadraticCurveTo(q[0], q[1], (p[0] + q[0]) / 2, (p[1] + q[1]) / 2);
    }
    g.lineTo(pkt[n][0], 0); g.closePath();
    var gr = g.createLinearGradient(-breite * u / 2, -hoehe * u, breite * u / 3, 0);
    gr.addColorStop(0, hell(farbe, 0.28)); gr.addColorStop(0.55, farbe); gr.addColorStop(1, dunkel(farbe, 0.35));
    g.fillStyle = gr; g.fill();
    g.strokeStyle = KONTUR; g.lineWidth = Math.max(1, u * 0.025); g.stroke();
    return pkt;
  }
  function facetten(g, u, R, pkt, farbe) {
    g.strokeStyle = dunkel(farbe, 0.3); g.lineWidth = Math.max(1, u * 0.02);
    for (var i = 0; i < 2; i++) {
      var a = pkt[1 + Math.floor(R() * (pkt.length - 2))];
      g.beginPath(); g.moveTo(a[0] * 0.8, a[1] * 0.8); g.lineTo(a[0] * 0.3 + (R() - 0.5) * u * 0.2, a[1] * 0.25); g.stroke();
    }
    g.fillStyle = "rgba(255,255,255,0.18)";
    g.beginPath(); g.ellipse(-u * 0.15, pkt[Math.floor(pkt.length / 2)][1] * 0.7, u * 0.18, u * 0.06, -0.3, 0, Math.PI * 2); g.fill();
  }

  /* Baumkrone aus überlappenden Kugeln: erst dunkle (Schatten), dann helle */
  function krone(g, u, R, cx, cy, rad, farbe, n) {
    var kugeln = [];
    for (var i = 0; i < n; i++) {
      var w = R() * Math.PI * 2, d = R() * rad * 0.55;
      kugeln.push([cx + Math.cos(w) * d * 1.2, cy + Math.sin(w) * d * 0.8, rad * (0.45 + 0.3 * R())]);
    }
    kugeln.forEach(function (k) { g.fillStyle = dunkel(farbe, 0.25); g.beginPath(); g.arc(k[0] + rad * 0.08, k[1] + rad * 0.08, k[2], 0, Math.PI * 2); g.fill(); });
    kugeln.forEach(function (k) {
      var gr = g.createRadialGradient(k[0] - k[2] * 0.4, k[1] - k[2] * 0.4, k[2] * 0.1, k[0], k[1], k[2]);
      gr.addColorStop(0, hell(farbe, 0.25)); gr.addColorStop(1, farbe);
      g.fillStyle = gr; g.beginPath(); g.arc(k[0], k[1], k[2] * 0.9, 0, Math.PI * 2); g.fill();
    });
  }

  function stamm(g, u, x0, y0, x1, y1, dicke, farbe) {
    var gr = g.createLinearGradient(x0 - dicke, 0, x0 + dicke, 0);
    gr.addColorStop(0, hell(farbe, 0.15)); gr.addColorStop(1, dunkel(farbe, 0.3));
    g.fillStyle = gr;
    g.beginPath();
    g.moveTo(x0 - dicke, y0); g.quadraticCurveTo((x0 + x1) / 2 - dicke * 0.6, (y0 + y1) / 2, x1 - dicke * 0.45, y1);
    g.lineTo(x1 + dicke * 0.45, y1); g.quadraticCurveTo((x0 + x1) / 2 + dicke * 0.6, (y0 + y1) / 2, x0 + dicke, y0);
    g.closePath(); g.fill();
  }

  /* Farnwedel: gebogene Mittelrippe mit Fiederblättchen */
  function wedel(g, u, x0, y0, winkel, laenge, biegung, farbe, dicht) {
    var pkt = [], n = 12;
    for (var i = 0; i <= n; i++) {
      var t = i / n, w = winkel + biegung * t * t;
      var px = x0 + Math.cos(w) * laenge * t, py = y0 - Math.sin(w) * laenge * t;
      pkt.push([px, py, w]);
    }
    g.strokeStyle = dunkel(farbe, 0.25); g.lineWidth = Math.max(1, u * 0.02); g.lineCap = "round";
    g.beginPath(); pkt.forEach(function (p, j) { if (j) g.lineTo(p[0], p[1]); else g.moveTo(p[0], p[1]); }); g.stroke();
    g.fillStyle = farbe;
    for (i = 1; i < n; i++) {
      var p = pkt[i], l = laenge * 0.22 * Math.sin(Math.PI * i / n) * (dicht || 1);
      [1, -1].forEach(function (s) {
        var w2 = p[2] + s * 1.0;
        g.beginPath(); g.moveTo(p[0], p[1]);
        g.quadraticCurveTo(p[0] + Math.cos(w2 + s * 0.3) * l * 0.6, p[1] - Math.sin(w2 + s * 0.3) * l * 0.6, p[0] + Math.cos(w2) * l, p[1] - Math.sin(w2) * l);
        g.quadraticCurveTo(p[0] + Math.cos(w2 - s * 0.3) * l * 0.5, p[1] - Math.sin(w2 - s * 0.3) * l * 0.5, p[0], p[1]);
        g.fill();
      });
    }
  }

  /* ---------------------------------------------------------------------------
     Die Maler. Jeder: { breite: Breite/Höhe, sinken: Anteil, der im Boden steckt,
     male(g, u, R, v) } – v = Variante (0 …)
     --------------------------------------------------------------------------- */
  var MALER = {
    stein: { breite: 1.6, sinken: 0.12, male: function (g, u, R) {
      var f = ["#8d8a86", "#9a8f80", "#7f8790", "#a09484"][Math.floor(R() * 4)];
      facetten(g, u, R, felsForm(g, u, R, 1.5, 0.95, f, R() < 0.5), f);
    } },
    sandfels: { breite: 1.3, sinken: 0.05, male: function (g, u, R) {
      // Sandsteinfels mit Schichten
      var f = ["#d9965a", "#c98450", "#e0a76a"][Math.floor(R() * 3)];
      var pkt = felsForm(g, u, R, 1.2, 1.0, f, true);
      g.save(); g.clip();
      g.strokeStyle = dunkel(f, 0.18); g.lineWidth = Math.max(1, u * 0.035);
      for (var i = 1; i < 5; i++) { var y = -u * i * 0.2 + (R() - 0.5) * u * 0.05; g.beginPath(); g.moveTo(-u, y); g.lineTo(u, y + (R() - 0.5) * u * 0.08); g.stroke(); }
      g.restore(); facetten(g, u, R, pkt, f);
    } },
    mondstein: { breite: 1.6, sinken: 0.15, male: function (g, u, R) {
      var f = ["#a9adb8", "#8f94a1", "#b8bbc4"][Math.floor(R() * 3)];
      var pkt = felsForm(g, u, R, 1.5, 0.8, f, false);
      g.fillStyle = dunkel(f, 0.22);
      for (var i = 0; i < 3; i++) { g.beginPath(); g.ellipse((R() - 0.5) * u * 0.8, -u * (0.2 + 0.35 * R()), u * 0.09, u * 0.05, 0, 0, Math.PI * 2); g.fill(); }
      facetten(g, u, R, pkt, f);
    } },
    steinSchnee: { breite: 1.6, sinken: 0.12, male: function (g, u, R) {
      var f = "#7f8790", pkt = felsForm(g, u, R, 1.5, 0.9, f, true);
      g.save(); g.clip();
      g.fillStyle = "#f4f8ff";
      g.beginPath(); g.moveTo(-u, -u * 0.55);
      for (var x = -u; x <= u; x += u * 0.2) g.lineTo(x, -u * (0.5 + 0.12 * R()));
      g.lineTo(u, -u * 2); g.lineTo(-u, -u * 2); g.closePath(); g.fill();
      g.restore();
      g.strokeStyle = KONTUR; g.lineWidth = Math.max(1, u * 0.025);
      g.beginPath(); pkt.forEach(function (p, i) { if (i) g.lineTo(p[0], p[1]); else g.moveTo(p[0], p[1]); }); g.stroke();
    } },
    lavastein: { breite: 1.5, sinken: 0.1, male: function (g, u, R) {
      var f = ["#3d3236", "#4a3b3b", "#352c33"][Math.floor(R() * 3)];
      var pkt = felsForm(g, u, R, 1.4, 0.85, f, true);
      // glühende Risse
      g.save(); g.clip();
      g.strokeStyle = "#ff7b2e"; g.lineWidth = Math.max(1.2, u * 0.035); g.lineCap = "round";
      g.shadowColor = "#ffb15a"; g.shadowBlur = u * 0.12;
      for (var i = 0; i < 2; i++) {
        var x = (R() - 0.5) * u * 0.9, y = -u * 0.1;
        g.beginPath(); g.moveTo(x, y);
        for (var k = 0; k < 4; k++) { x += (R() - 0.5) * u * 0.25; y -= u * (0.1 + 0.08 * R()); g.lineTo(x, y); }
        g.stroke();
      }
      g.restore();
      facetten(g, u, R, pkt, f);
    } },

    laubbaum: { breite: 1.2, sinken: 0.02, male: function (g, u, R) {
      var gruen = ["#4f9e3a", "#3f8f3f", "#5aa845", "#6aa63a"][Math.floor(R() * 4)];
      var neig = (R() - 0.5) * u * 0.12;
      stamm(g, u, 0, 0, neig, -u * 0.5, u * 0.06, "#7a5232");
      // zwei kleine Äste
      g.strokeStyle = "#6a4528"; g.lineWidth = u * 0.03; g.lineCap = "round";
      g.beginPath(); g.moveTo(neig * 0.6, -u * 0.42); g.lineTo(neig - u * 0.16, -u * 0.6); g.stroke();
      g.beginPath(); g.moveTo(neig * 0.7, -u * 0.48); g.lineTo(neig + u * 0.15, -u * 0.64); g.stroke();
      krone(g, u, R, neig, -u * 0.62, u * 0.42, gruen, 7 + Math.floor(R() * 3));
    } },
    busch: { breite: 1.7, sinken: 0.08, male: function (g, u, R) {
      var gruen = ["#4f9e3a", "#3c8a3a", "#5e9e40"][Math.floor(R() * 3)];
      krone(g, u, R, 0, -u * 0.42, u * 0.42, gruen, 6);
      if (R() < 0.5) {                                   // Beeren oder Blüten
        g.fillStyle = R() < 0.5 ? "#e8453c" : "#ffffff";
        for (var i = 0; i < 6; i++) { g.beginPath(); g.arc((R() - 0.5) * u, -u * (0.25 + 0.5 * R()), u * 0.035, 0, Math.PI * 2); g.fill(); }
      }
    } },
    blumen: { breite: 1.6, sinken: 0, male: function (g, u, R) {
      var farben = [["#ff6fa0", "#ffd23f"], ["#ffffff", "#ffcf3a"], ["#8e5bd8", "#ffe58a"], ["#ff8a3a", "#7a3b1a"]][Math.floor(R() * 4)];
      // Gras
      g.strokeStyle = "#4f9e3a"; g.lineWidth = Math.max(1, u * 0.04); g.lineCap = "round";
      for (var i = 0; i < 9; i++) { var x = (R() - 0.5) * u * 1.4; g.beginPath(); g.moveTo(x, 0); g.quadraticCurveTo(x + (R() - 0.5) * u * 0.2, -u * 0.25, x + (R() - 0.5) * u * 0.3, -u * (0.3 + 0.3 * R())); g.stroke(); }
      for (i = 0; i < 5; i++) {
        var bx = (R() - 0.5) * u * 1.3, by = -u * (0.5 + 0.45 * R());
        g.strokeStyle = "#3c8a3a"; g.beginPath(); g.moveTo(bx * 0.8, 0); g.lineTo(bx, by); g.stroke();
        g.fillStyle = farben[0];
        for (var k = 0; k < 5; k++) { var w = k * Math.PI * 2 / 5; g.beginPath(); g.arc(bx + Math.cos(w) * u * 0.07, by + Math.sin(w) * u * 0.07, u * 0.06, 0, Math.PI * 2); g.fill(); }
        g.fillStyle = farben[1]; g.beginPath(); g.arc(bx, by, u * 0.045, 0, Math.PI * 2); g.fill();
      }
    } },
    tanne: { breite: 0.6, sinken: 0.02, male: function (g, u, R) { tanneMalen(g, u, R, false); } },
    tanneSchnee: { breite: 0.6, sinken: 0.02, male: function (g, u, R) { tanneMalen(g, u, R, true); } },
    palme: { breite: 1.0, sinken: 0.02, male: function (g, u, R) {
      var neig = (R() < 0.5 ? -1 : 1) * u * (0.12 + 0.12 * R()), top = [neig, -u * 0.78];
      // Stamm mit Ringen
      g.strokeStyle = "#8a6238"; g.lineWidth = u * 0.07; g.lineCap = "round";
      g.beginPath(); g.moveTo(0, 0); g.quadraticCurveTo(neig * 0.1, -u * 0.45, top[0], top[1]); g.stroke();
      g.strokeStyle = "#6a4528"; g.lineWidth = Math.max(1, u * 0.015);
      for (var i = 1; i < 9; i++) {
        var t = i / 9, x = neig * t * t, y = -u * 0.78 * t;
        g.beginPath(); g.moveTo(x - u * 0.035, y); g.lineTo(x + u * 0.035, y - u * 0.012); g.stroke();
      }
      var n = 6 + Math.floor(R() * 3), gruen = R() < 0.5 ? "#3f9a3a" : "#4fae46";
      for (i = 0; i < n; i++) {
        var w = Math.PI * (0.05 + 0.9 * i / (n - 1)) + (R() - 0.5) * 0.2;
        wedel(g, u, top[0], top[1], w, u * (0.38 + 0.12 * R()), (Math.cos(w) > 0 ? -1 : 1) * 0.9, i % 2 ? gruen : dunkel(gruen, 0.15), 0.8);
      }
      g.fillStyle = "#6a4528";
      for (i = 0; i < 3; i++) { g.beginPath(); g.arc(top[0] + (i - 1) * u * 0.045, top[1] + u * 0.04, u * 0.035, 0, Math.PI * 2); g.fill(); }
    } },
    kaktus: { breite: 0.8, sinken: 0.02, male: function (g, u, R) {
      var f = R() < 0.5 ? "#4f9a5a" : "#5aa46a", d = u * 0.13;
      var saeule = function (x0, y0, x1, y1, b) {
        var gr = g.createLinearGradient(x0 - b, 0, x0 + b, 0);
        gr.addColorStop(0, hell(f, 0.2)); gr.addColorStop(0.6, f); gr.addColorStop(1, dunkel(f, 0.3));
        g.strokeStyle = gr; g.lineWidth = b * 2; g.lineCap = "round";
        g.beginPath(); g.moveTo(x0, y0); g.lineTo(x1, y1); g.stroke();
      };
      // Arme (Bögen nach oben)
      var arme = R() < 0.3 ? 1 : 2;
      for (var a = 0; a < arme; a++) {
        var s = a ? -1 : (R() < 0.5 ? 1 : -1), h0 = -u * (0.35 + 0.2 * R()), h1 = h0 - u * (0.2 + 0.15 * R());
        g.strokeStyle = f; g.lineWidth = d * 1.5; g.lineCap = "round";
        g.beginPath(); g.moveTo(0, h0); g.quadraticCurveTo(s * u * 0.25, h0, s * u * 0.25, h0 - u * 0.1); g.stroke();
        saeule(s * u * 0.25, h0 - u * 0.08, s * u * 0.25, h1, d * 0.75);
      }
      saeule(0, -d, 0, -u + d, d);
      g.strokeStyle = dunkel(f, 0.3); g.lineWidth = Math.max(1, u * 0.012);
      [-0.45, 0, 0.45].forEach(function (k) { g.beginPath(); g.moveTo(k * d, -d); g.lineTo(k * d, -u + d * 1.2); g.stroke(); });
      if (R() < 0.4) { g.fillStyle = "#ff6fa0"; g.beginPath(); g.arc(0, -u + d * 0.6, u * 0.05, 0, Math.PI * 2); g.fill(); }
    } },
    farn: { breite: 1.5, sinken: 0, male: function (g, u, R) {
      var gruen = ["#3f8f3f", "#4f9e3a", "#2f7a3a"][Math.floor(R() * 3)], n = 6 + Math.floor(R() * 3);
      for (var i = 0; i < n; i++) {
        var w = Math.PI * (0.12 + 0.76 * i / (n - 1)) + (R() - 0.5) * 0.15;
        wedel(g, u, 0, 0, w, u * (0.8 + 0.25 * R()) * (0.6 + 0.4 * Math.sin(w)), (Math.cos(w) > 0 ? -1 : 1) * 0.7, i % 2 ? gruen : hell(gruen, 0.12), 1);
      }
    } },
    palmfarn: { breite: 1.2, sinken: 0, male: function (g, u, R) {
      // Palmfarn (Urzeit): kurzer, geschuppter Stamm, steife Wedel
      var h = u * (0.35 + 0.15 * R());
      g.fillStyle = "#6e5a3a"; g.beginPath(); g.ellipse(0, -h / 2, u * 0.11, h / 2, 0, 0, Math.PI * 2); g.fill();
      g.strokeStyle = "#4e3f28"; g.lineWidth = Math.max(1, u * 0.015);
      for (var y = -u * 0.05; y > -h; y -= u * 0.06) { g.beginPath(); g.arc(0, y, u * 0.09, 0.2, Math.PI - 0.2); g.stroke(); }
      var gruen = R() < 0.5 ? "#4a8a2f" : "#5b9a36";
      for (var i = 0; i < 9; i++) {
        var w = Math.PI * (0.05 + 0.9 * i / 8);
        wedel(g, u, 0, -h, w, u * (0.55 + 0.15 * R()), (Math.cos(w) > 0 ? -1 : 1) * 0.4, i % 2 ? gruen : dunkel(gruen, 0.12), 0.7);
      }
    } },
    schachtelhalm: { breite: 0.6, sinken: 0, male: function (g, u, R) {
      for (var s = 0; s < 4; s++) {
        var x = (s - 1.5) * u * 0.12 + (R() - 0.5) * u * 0.05, h = u * (0.6 + 0.4 * R()), f = s % 2 ? "#5f9a3a" : "#6faa45";
        g.strokeStyle = f; g.lineWidth = u * 0.04; g.lineCap = "round";
        g.beginPath(); g.moveTo(x, 0); g.lineTo(x + (R() - 0.5) * u * 0.06, -h); g.stroke();
        g.strokeStyle = dunkel(f, 0.3); g.lineWidth = Math.max(1, u * 0.012);
        for (var y = -u * 0.12; y > -h; y -= u * 0.1) {
          g.beginPath(); g.moveTo(x - u * 0.12, y + u * 0.05); g.lineTo(x, y); g.lineTo(x + u * 0.12, y + u * 0.05); g.stroke();
        }
        g.fillStyle = "#7a6a3a"; g.beginPath(); g.ellipse(x, -h, u * 0.03, u * 0.06, 0, 0, Math.PI * 2); g.fill();
      }
    } },
    kegel: { breite: 2.0, sinken: 0.04, male: function (g, u, R) {
      // kleiner Vulkankegel mit Krater, Lavarinne und Rauchfahne
      var f = ["#4a3b3b", "#3d3236", "#55433f"][Math.floor(R() * 3)], b = u * (0.85 + 0.15 * R()), k = u * (0.22 + 0.1 * R());
      g.beginPath(); g.moveTo(-b, 0); g.quadraticCurveTo(-k * 1.6, -u * 0.55, -k, -u * 0.86);
      g.lineTo(k, -u * 0.86); g.quadraticCurveTo(k * 1.6, -u * 0.55, b, 0); g.closePath();
      var gr = g.createLinearGradient(-b, 0, b, 0);
      gr.addColorStop(0, hell(f, 0.2)); gr.addColorStop(0.6, f); gr.addColorStop(1, dunkel(f, 0.35));
      g.fillStyle = gr; g.fill(); g.strokeStyle = KONTUR; g.lineWidth = Math.max(1, u * 0.02); g.stroke();
      g.fillStyle = "#2a1f22"; g.beginPath(); g.ellipse(0, -u * 0.86, k, u * 0.05, 0, 0, Math.PI * 2); g.fill();
      g.fillStyle = "#ff8a2e"; g.beginPath(); g.ellipse(0, -u * 0.855, k * 0.7, u * 0.03, 0, 0, Math.PI * 2); g.fill();
      // Lavarinne
      var x = (R() - 0.5) * k, y = -u * 0.84;
      g.strokeStyle = "#ff6a1f"; g.lineWidth = Math.max(1.2, u * 0.04); g.lineCap = "round"; g.shadowColor = "#ffb15a"; g.shadowBlur = u * 0.08;
      g.beginPath(); g.moveTo(x, y);
      for (var i = 0; i < 4; i++) { x += (R() - 0.3) * u * 0.12; y += u * 0.15; g.lineTo(x, y); }
      g.stroke(); g.shadowBlur = 0;
      // Rillen
      g.strokeStyle = dunkel(f, 0.3); g.lineWidth = Math.max(1, u * 0.015);
      for (i = 0; i < 3; i++) { var xs = (R() - 0.5) * b; g.beginPath(); g.moveTo(xs * 0.3, -u * 0.8); g.lineTo(xs, -u * 0.05); g.stroke(); }
    } },
    baumtot: { breite: 0.9, sinken: 0.02, male: function (g, u, R) {
      var f = "#3a2c2a";
      g.strokeStyle = f; g.lineCap = "round"; g.lineJoin = "round";
      var ast = function (x, y, w, l, d, tiefe) {
        var x2 = x + Math.cos(w) * l, y2 = y - Math.sin(w) * l;
        g.lineWidth = d; g.beginPath(); g.moveTo(x, y); g.lineTo(x2, y2); g.stroke();
        if (tiefe > 0) {
          ast(x2, y2, w + 0.4 + R() * 0.3, l * 0.65, d * 0.6, tiefe - 1);
          ast(x2, y2, w - 0.4 - R() * 0.3, l * 0.6, d * 0.6, tiefe - 1);
        }
      };
      ast(0, 0, Math.PI / 2 + (R() - 0.5) * 0.2, u * 0.45, u * 0.08, 3);
    } },
    stalagmit: { breite: 0.9, sinken: 0.02, male: function (g, u, R) {
      var n = 2 + Math.floor(R() * 2);
      for (var i = 0; i < n; i++) {
        var x = (i - (n - 1) / 2) * u * 0.25 + (R() - 0.5) * u * 0.1, h = u * (i === Math.floor(n / 2) ? 1 : 0.45 + 0.3 * R()), b = u * (0.12 + 0.06 * R());
        var gr = g.createLinearGradient(x - b, 0, x + b, 0);
        gr.addColorStop(0, "#9a88b8"); gr.addColorStop(1, "#4a3f62");
        g.fillStyle = gr;
        g.beginPath(); g.moveTo(x - b, 0); g.quadraticCurveTo(x - b * 0.3, -h * 0.6, x, -h); g.quadraticCurveTo(x + b * 0.3, -h * 0.6, x + b, 0); g.closePath(); g.fill();
        g.strokeStyle = "rgba(255,255,255,0.15)"; g.lineWidth = Math.max(1, u * 0.012);
        for (var y = -h * 0.2; y > -h * 0.8; y -= h * 0.18) { g.beginPath(); g.moveTo(x - b * 0.7 * (1 + y / h), y); g.lineTo(x + b * 0.7 * (1 + y / h), y); g.stroke(); }
      }
    } },
    kristall: { breite: 1.0, sinken: 0.03, male: function (g, u, R) {
      var f = ["#8fe8ff", "#d59cff", "#7affc4", "#ff9cd8"][Math.floor(R() * 4)];
      var gl = g.createRadialGradient(0, -u * 0.4, 0, 0, -u * 0.4, u * 0.6);
      gl.addColorStop(0, "rgba(255,255,255,0.25)"); gl.addColorStop(1, "rgba(255,255,255,0)");
      g.fillStyle = gl; g.beginPath(); g.arc(0, -u * 0.4, u * 0.6, 0, Math.PI * 2); g.fill();
      var n = 3 + Math.floor(R() * 3);
      for (var i = 0; i < n; i++) {
        var w = (i - (n - 1) / 2) * 0.32 + (R() - 0.5) * 0.15, h = u * (i === Math.floor(n / 2) ? 0.95 : 0.45 + 0.35 * R()), b = u * (0.07 + 0.04 * R());
        g.save(); g.rotate(w);
        g.beginPath(); g.moveTo(-b, 0); g.lineTo(-b, -h * 0.8); g.lineTo(0, -h); g.lineTo(b, -h * 0.8); g.lineTo(b, 0); g.closePath();
        var gr = g.createLinearGradient(-b, 0, b, 0);
        gr.addColorStop(0, hell(f, 0.5)); gr.addColorStop(0.5, f); gr.addColorStop(1, dunkel(f, 0.35));
        g.fillStyle = gr; g.fill();
        g.strokeStyle = "rgba(255,255,255,0.6)"; g.lineWidth = Math.max(1, u * 0.012);
        g.beginPath(); g.moveTo(0, 0); g.lineTo(0, -h); g.stroke();
        g.restore();
      }
    } },
    pilz: { breite: 1.2, sinken: 0, male: function (g, u, R) {
      var f = ["#7affc4", "#8fe8ff", "#ff9cd8"][Math.floor(R() * 3)], n = 2 + Math.floor(R() * 2);
      for (var i = 0; i < n; i++) {
        var x = (i - (n - 1) / 2) * u * 0.38, h = u * (i ? 0.45 + 0.2 * R() : 0.9), r = h * 0.42;
        g.fillStyle = "#e9e2f5"; g.fillRect(x - r * 0.18, -h + r * 0.3, r * 0.36, h - r * 0.3);
        var gl = g.createRadialGradient(x, -h, 0, x, -h, r * 1.8);
        gl.addColorStop(0, "rgba(255,255,255,0.3)"); gl.addColorStop(1, "rgba(255,255,255,0)");
        g.fillStyle = gl; g.beginPath(); g.arc(x, -h, r * 1.8, 0, Math.PI * 2); g.fill();
        var gr = g.createLinearGradient(0, -h - r * 0.6, 0, -h + r * 0.3);
        gr.addColorStop(0, hell(f, 0.3)); gr.addColorStop(1, dunkel(f, 0.25));
        g.fillStyle = gr; g.beginPath(); g.ellipse(x, -h + r * 0.3, r, r * 0.8, 0, Math.PI, 0); g.closePath(); g.fill();
        g.fillStyle = "rgba(255,255,255,0.7)";
        for (var k = 0; k < 3; k++) { g.beginPath(); g.arc(x + (k - 1) * r * 0.45, -h - r * 0.05 + (k % 2) * r * 0.2, r * 0.1, 0, Math.PI * 2); g.fill(); }
      }
    } },
    gras: { breite: 1.4, sinken: 0, male: function (g, u, R) {
      var f = ["#5aa845", "#6aa63a", "#4f9e3a", "#9aa84a"][Math.floor(R() * 4)];
      g.strokeStyle = f; g.lineWidth = Math.max(1, u * 0.05); g.lineCap = "round";
      for (var i = 0; i < 12; i++) {
        var x = (R() - 0.5) * u * 1.2, h = u * (0.4 + 0.6 * R());
        g.strokeStyle = i % 3 ? f : dunkel(f, 0.2);
        g.beginPath(); g.moveTo(x, 0); g.quadraticCurveTo(x + (R() - 0.5) * u * 0.2, -h * 0.6, x + (R() - 0.5) * u * 0.45, -h); g.stroke();
      }
    } },
    nest: { breite: 1.6, sinken: 0, male: function (g, u, R) {
      g.fillStyle = "#8a6a3a"; g.beginPath(); g.ellipse(0, -u * 0.18, u * 0.75, u * 0.2, 0, 0, Math.PI * 2); g.fill();
      var eier = 3 + Math.floor(R() * 2), f = R() < 0.5 ? "#f2ead2" : "#d8eef0";
      for (var i = 0; i < eier; i++) {
        var x = (i - (eier - 1) / 2) * u * 0.32, gr = g.createRadialGradient(x - u * 0.06, -u * 0.55, 0, x, -u * 0.42, u * 0.25);
        gr.addColorStop(0, "#ffffff"); gr.addColorStop(1, f);
        g.fillStyle = gr; g.beginPath(); g.ellipse(x, -u * 0.42, u * 0.15, u * 0.22, (i - 1) * 0.15, 0, Math.PI * 2); g.fill();
        g.fillStyle = dunkel(f, 0.25);
        for (var k = 0; k < 3; k++) { g.beginPath(); g.arc(x + (R() - 0.5) * u * 0.15, -u * (0.35 + 0.2 * R()), u * 0.02, 0, Math.PI * 2); g.fill(); }
      }
      g.strokeStyle = "#6a4f28"; g.lineWidth = Math.max(1, u * 0.025);
      for (i = 0; i < 10; i++) { var x0 = (R() - 0.5) * u * 1.4; g.beginPath(); g.moveTo(x0, -u * (0.05 + 0.2 * R())); g.lineTo(x0 + (R() - 0.5) * u * 0.6, -u * (0.1 + 0.2 * R())); g.stroke(); }
    } },
    dino: { breite: 1.7, sinken: 0.02, male: function (g, u, R, v) { DINOS[v % DINOS.length](g, u, R, v); } },

    /* ---- Pfützenland ---- */
    regenschirm: { breite: 1.1, sinken: 0.04, male: function (g, u, R) {
      // aufgespannter Schirm, schräg in den Boden gesteckt
      var p = [["#e8453c", "#ffd23f"], ["#2f6fd6", "#ffffff"], ["#ff6fb5", "#ffe58a"], ["#3cc35a", "#ffd23f"]][Math.floor(R() * 4)];
      g.save(); g.rotate((R() - 0.5) * 0.35);
      g.strokeStyle = "#3a3a48"; g.lineWidth = Math.max(1.5, u * 0.03); g.lineCap = "round";
      g.beginPath(); g.moveTo(0, 0); g.lineTo(0, -u * 0.86); g.stroke();
      g.beginPath(); g.arc(u * 0.05, -u * 0.02, u * 0.05, Math.PI, 0, true); g.stroke();          // Griff
      var cy = -u * 0.7, rx = u * 0.5, ry = u * 0.3, n = 6;
      for (var i = 0; i < n; i++) {
        var a0 = Math.PI + Math.PI * i / n, a1 = Math.PI + Math.PI * (i + 1) / n;
        g.beginPath(); g.moveTo(0, cy - ry * 0.05);
        g.lineTo(Math.cos(a0) * rx, cy + Math.sin(a0) * ry);
        g.quadraticCurveTo(Math.cos((a0 + a1) / 2) * rx * 0.85, cy + Math.sin((a0 + a1) / 2) * ry * 0.75 + ry * 0.12, Math.cos(a1) * rx, cy + Math.sin(a1) * ry);
        g.closePath(); g.fillStyle = i % 2 ? p[1] : p[0]; g.fill();
      }
      g.strokeStyle = KONTUR; g.lineWidth = Math.max(1, u * 0.015);
      g.beginPath(); g.ellipse(0, cy, rx, ry, 0, Math.PI, 0); g.stroke();
      g.fillStyle = "#3a3a48"; g.beginPath(); g.arc(0, cy - ry, u * 0.025, 0, Math.PI * 2); g.fill();
      g.restore();
    } },
    gummistiefel: { breite: 1.3, sinken: 0, male: function (g, u, R) {
      var f = ["#ffd23f", "#e8453c", "#2f6fd6", "#3cc35a"][Math.floor(R() * 4)];
      [-0.28, 0.24].forEach(function (x, i) {
        var b = u * 0.3, xx = x * u;
        g.save(); g.translate(xx, 0); g.rotate(i ? 0.12 : -0.05);
        var gr = g.createLinearGradient(-b / 2, 0, b / 2, 0);
        gr.addColorStop(0, hell(f, 0.25)); gr.addColorStop(1, dunkel(f, 0.2));
        g.fillStyle = gr;
        g.beginPath(); g.moveTo(-b / 2, -u); g.lineTo(b / 2, -u); g.lineTo(b / 2, -u * 0.25);
        g.quadraticCurveTo(b * 1.3, -u * 0.22, b * 1.25, -u * 0.06); g.lineTo(b * 1.25, 0); g.lineTo(-b / 2, 0); g.closePath(); g.fill();
        g.strokeStyle = KONTUR; g.lineWidth = Math.max(1, u * 0.02); g.stroke();
        g.fillStyle = "#3a3a48"; g.fillRect(-b / 2, -u * 0.06, b * 1.75, u * 0.06);                   // Sohle
        g.fillStyle = "rgba(255,255,255,0.4)"; g.fillRect(-b * 0.35, -u * 0.95, b * 0.18, u * 0.6);
        g.restore();
      });
    } },
    pilzrot: { breite: 1.0, sinken: 0, male: function (g, u, R) {
      // Fliegenpilz: weißer Stiel, roter Hut mit weißen Tupfen
      var b = u * (0.42 + 0.08 * R()), hs = u * 0.62;
      var gr = g.createLinearGradient(-u * 0.1, 0, u * 0.1, 0);
      gr.addColorStop(0, "#fffaf0"); gr.addColorStop(1, "#d8cfc0");
      g.fillStyle = gr; g.beginPath(); g.moveTo(-u * 0.11, 0); g.lineTo(-u * 0.08, -hs); g.lineTo(u * 0.08, -hs); g.lineTo(u * 0.11, 0); g.closePath(); g.fill();
      var hg = g.createRadialGradient(-b * 0.3, -u * 0.95, u * 0.05, 0, -u * 0.7, b);
      hg.addColorStop(0, "#ff7a6a"); hg.addColorStop(1, "#c8261e");
      g.fillStyle = hg; g.beginPath(); g.moveTo(-b, -hs + u * 0.02); g.quadraticCurveTo(-b * 0.95, -u * 1.02, 0, -u * 1.02);
      g.quadraticCurveTo(b * 0.95, -u * 1.02, b, -hs + u * 0.02); g.closePath(); g.fill();
      g.strokeStyle = KONTUR; g.lineWidth = Math.max(1, u * 0.02); g.stroke();
      g.fillStyle = "#fffaf0";
      for (var i = 0; i < 6; i++) { g.beginPath(); g.ellipse((R() - 0.5) * b * 1.4, -u * (0.72 + 0.22 * R()), u * 0.045, u * 0.035, 0, 0, Math.PI * 2); g.fill(); }
    } },

    /* ---- Riesengarten ---- */
    riesenblume: { breite: 0.7, sinken: 0, male: function (g, u, R, v) {
      var art = v % 3, kx = (R() - 0.5) * u * 0.12, ky = -u * 0.82;
      g.strokeStyle = "#3f8f3a"; g.lineWidth = u * 0.035; g.lineCap = "round";
      g.beginPath(); g.moveTo(0, 0); g.quadraticCurveTo(kx * 2, -u * 0.45, kx, ky); g.stroke();
      // zwei Blätter am Stiel
      [[-1, 0.3], [1, 0.48]].forEach(function (b) {
        var y = -u * b[1], l = u * 0.2;
        g.fillStyle = b[0] < 0 ? "#4fae46" : "#3f9a3a";
        g.beginPath(); g.moveTo(kx * b[1], y); g.quadraticCurveTo(b[0] * l * 0.7, y - l * 0.6, b[0] * l * 1.1, y - l * 0.1);
        g.quadraticCurveTo(b[0] * l * 0.6, y + l * 0.15, kx * b[1], y); g.fill();
      });
      var r = u * 0.16;
      if (art === 0) {                                        // Sonnenblume
        g.fillStyle = "#ffcc1a";
        for (var i = 0; i < 14; i++) { var w = i * Math.PI * 2 / 14; g.beginPath(); g.ellipse(kx + Math.cos(w) * r * 1.15, ky + Math.sin(w) * r * 1.15, r * 0.55, r * 0.2, w, 0, Math.PI * 2); g.fill(); }
        g.fillStyle = "#6a3f1a"; g.beginPath(); g.arc(kx, ky, r * 0.8, 0, Math.PI * 2); g.fill();
        g.fillStyle = "#8a5a2a"; for (i = 0; i < 9; i++) { g.beginPath(); g.arc(kx + (R() - 0.5) * r, ky + (R() - 0.5) * r, r * 0.08, 0, Math.PI * 2); g.fill(); }
      } else if (art === 1) {                                 // Margerite
        g.fillStyle = "#ffffff"; g.strokeStyle = "rgba(0,0,0,0.12)"; g.lineWidth = Math.max(1, u * 0.006);
        for (i = 0; i < 12; i++) { w = i * Math.PI * 2 / 12; g.beginPath(); g.ellipse(kx + Math.cos(w) * r, ky + Math.sin(w) * r, r * 0.6, r * 0.19, w, 0, Math.PI * 2); g.fill(); g.stroke(); }
        g.fillStyle = "#ffcf3a"; g.beginPath(); g.arc(kx, ky, r * 0.42, 0, Math.PI * 2); g.fill();
      } else {                                                // Tulpe
        var f = R() < 0.5 ? "#ff4f6d" : "#ff8a2e";
        var tg = g.createLinearGradient(kx - r, 0, kx + r, 0);
        tg.addColorStop(0, hell(f, 0.2)); tg.addColorStop(1, dunkel(f, 0.2));
        g.fillStyle = tg;
        g.beginPath(); g.moveTo(kx - r, ky - r * 0.9); g.lineTo(kx - r * 0.45, ky - r * 0.4); g.lineTo(kx, ky - r * 1.0); g.lineTo(kx + r * 0.45, ky - r * 0.4);
        g.lineTo(kx + r, ky - r * 0.9); g.quadraticCurveTo(kx + r * 1.1, ky + r * 0.9, kx, ky + r * 0.9); g.quadraticCurveTo(kx - r * 1.1, ky + r * 0.9, kx - r, ky - r * 0.9); g.fill();
      }
    } },
    grashalm: { breite: 0.6, sinken: 0, male: function (g, u, R) {
      for (var i = 0; i < 4; i++) {
        var x = (i - 1.5) * u * 0.07, h = u * (0.55 + 0.45 * R()), b = u * 0.035, k = (R() - 0.4) * u * 0.35;
        var f = ["#5aa845", "#4f9e3a", "#6ab84c", "#3f8f3a"][i];
        g.fillStyle = f;
        g.beginPath(); g.moveTo(x - b, 0); g.quadraticCurveTo(x - b * 0.6, -h * 0.6, x + k, -h); g.quadraticCurveTo(x + b * 0.6, -h * 0.55, x + b, 0); g.closePath(); g.fill();
        g.strokeStyle = "rgba(255,255,255,0.25)"; g.lineWidth = Math.max(1, u * 0.008);
        g.beginPath(); g.moveTo(x, 0); g.quadraticCurveTo(x, -h * 0.55, x + k * 0.95, -h * 0.97); g.stroke();
      }
    } },
    kleeblatt: { breite: 1.1, sinken: 0, male: function (g, u, R) {
      var n = 2 + Math.floor(R() * 2);
      for (var k = 0; k < n; k++) {
        var x = (k - (n - 1) / 2) * u * 0.32, h = u * (k === 1 ? 0.95 : 0.6 + 0.2 * R()), r = u * 0.16;
        g.strokeStyle = "#3f8f3a"; g.lineWidth = Math.max(1, u * 0.025);
        g.beginPath(); g.moveTo(x, 0); g.quadraticCurveTo(x + u * 0.05, -h * 0.5, x, -h + r * 0.5); g.stroke();
        for (var i = 0; i < 3; i++) {
          var w = -Math.PI / 2 + (i - 1) * 2.1, bx = x + Math.cos(w) * r * 0.75, by = -h + r * 0.5 + Math.sin(w) * r * 0.75;
          g.fillStyle = i % 2 ? "#4fae46" : "#5cbc4e";
          g.beginPath(); g.arc(bx - Math.sin(w) * r * 0.3, by + Math.cos(w) * r * 0.3, r * 0.5, 0, Math.PI * 2); g.arc(bx + Math.sin(w) * r * 0.3, by - Math.cos(w) * r * 0.3, r * 0.5, 0, Math.PI * 2); g.fill();
        }
        g.strokeStyle = "rgba(255,255,255,0.45)"; g.lineWidth = Math.max(1, u * 0.012);
        g.beginPath(); g.arc(x, -h + r * 0.5, r * 0.5, 0, Math.PI * 2); g.stroke();
      }
    } },

    /* ---- Herbststurm ---- */
    herbstbaum: { breite: 1.2, sinken: 0.02, male: function (g, u, R) {
      var farbe = ["#e8862e", "#d9532b", "#f2b233", "#c9772e"][Math.floor(R() * 4)];
      var neig = (R() - 0.5) * u * 0.12;
      stamm(g, u, 0, 0, neig, -u * 0.5, u * 0.06, "#6a4528");
      g.strokeStyle = "#5a3a22"; g.lineWidth = u * 0.03; g.lineCap = "round";
      g.beginPath(); g.moveTo(neig * 0.6, -u * 0.42); g.lineTo(neig - u * 0.16, -u * 0.6); g.stroke();
      krone(g, u, R, neig, -u * 0.62, u * 0.42, farbe, 7 + Math.floor(R() * 3));
      // ein paar Blätter fallen gerade
      for (var i = 0; i < 4; i++) {
        g.fillStyle = ["#e8862e", "#d9532b", "#f2b233"][i % 3];
        g.beginPath(); g.ellipse((R() - 0.3) * u * 0.9, -u * (0.05 + 0.25 * R()), u * 0.03, u * 0.015, R() * 3, 0, Math.PI * 2); g.fill();
      }
    } },
    kuerbis: { breite: 1.4, sinken: 0.04, male: function (g, u, R) {
      var f = R() < 0.7 ? "#f08a24" : "#f2b233", b = u * 0.68, h = u * 0.82;
      for (var i = -2; i <= 2; i++) {
        var gr = g.createRadialGradient(i * b * 0.25 - b * 0.1, -h * 0.65, b * 0.05, i * b * 0.25, -h * 0.45, b * 0.5);
        gr.addColorStop(0, hell(f, 0.25)); gr.addColorStop(1, dunkel(f, 0.12 + Math.abs(i) * 0.08));
        g.fillStyle = gr;
        g.beginPath(); g.ellipse(i * b * 0.24, -h * 0.45, b * (0.32 - Math.abs(i) * 0.03), h * 0.45, 0, 0, Math.PI * 2); g.fill();
      }
      g.strokeStyle = dunkel(f, 0.35); g.lineWidth = Math.max(1, u * 0.015);
      for (i = -1; i <= 1; i += 2) { g.beginPath(); g.ellipse(i * b * 0.12, -h * 0.45, b * 0.2, h * 0.43, 0, 0, Math.PI * 2); g.stroke(); }
      g.strokeStyle = "#5a7a2a"; g.lineWidth = u * 0.07; g.lineCap = "round";
      g.beginPath(); g.moveTo(0, -h * 0.85); g.quadraticCurveTo(u * 0.04, -h * 1.05, u * 0.12, -h * 1.08); g.stroke();
      g.fillStyle = "#4f9e3a"; g.beginPath(); g.ellipse(-u * 0.14, -h * 0.95, u * 0.12, u * 0.05, -0.4, 0, Math.PI * 2); g.fill();
    } },
    laubhaufen: { breite: 2.0, sinken: 0.06, male: function (g, u, R) {
      var b = u * 0.95;
      g.fillStyle = "#b8682a"; g.beginPath(); g.ellipse(0, 0, b, u * 0.75, 0, Math.PI, 0); g.fill();
      var farben = ["#e8862e", "#d9532b", "#f2b233", "#c9772e", "#9a5a2a", "#e0a53a"];
      for (var i = 0; i < 34; i++) {
        var w = Math.PI + Math.PI * R(), d = Math.sqrt(R());
        var x = Math.cos(w) * b * d * 0.95, y = Math.sin(w) * u * 0.72 * d;
        g.fillStyle = farben[i % farben.length];
        g.beginPath(); g.ellipse(x, y, u * 0.1, u * 0.05, R() * 3, 0, Math.PI * 2); g.fill();
      }
    } },
    vogelscheuche: { breite: 1.0, sinken: 0.02, male: function (g, u, R) {
      var hemd = ["#d9532b", "#2f6fd6", "#3cc35a"][Math.floor(R() * 3)];
      g.fillStyle = "#7a5232"; g.fillRect(-u * 0.025, -u * 0.8, u * 0.05, u * 0.8);           // Pfahl
      g.fillRect(-u * 0.42, -u * 0.62, u * 0.84, u * 0.04);                                     // Querholz
      g.fillStyle = hemd; rundRechteckG(g, -u * 0.36, -u * 0.66, u * 0.72, u * 0.32, u * 0.05); g.fill();
      g.strokeStyle = "#f2d07a"; g.lineWidth = Math.max(1, u * 0.015);                         // Stroh an den Ärmeln
      [-1, 1].forEach(function (s) { for (var k = 0; k < 4; k++) { g.beginPath(); g.moveTo(s * u * 0.36, -u * 0.6 + k * u * 0.06); g.lineTo(s * u * (0.44 + 0.04 * R()), -u * 0.6 + k * u * 0.07); g.stroke(); } });
      g.fillStyle = "#3a6ab0"; g.fillRect(-u * 0.18, -u * 0.36, u * 0.36, u * 0.12);             // Hose (Flicken)
      g.fillStyle = "#f2d6a2"; g.beginPath(); g.arc(0, -u * 0.76, u * 0.11, 0, Math.PI * 2); g.fill();
      g.fillStyle = "#3a2a1a"; g.beginPath(); g.arc(-u * 0.04, -u * 0.78, u * 0.015, 0, Math.PI * 2); g.arc(u * 0.04, -u * 0.78, u * 0.015, 0, Math.PI * 2); g.fill();
      g.strokeStyle = "#3a2a1a"; g.lineWidth = Math.max(1, u * 0.012);
      g.beginPath(); g.arc(0, -u * 0.75, u * 0.05, 0.2 * Math.PI, 0.8 * Math.PI); g.stroke();
      g.fillStyle = "#c9a24a"; g.beginPath(); g.ellipse(0, -u * 0.86, u * 0.2, u * 0.04, 0, 0, Math.PI * 2); g.fill();   // Strohhut
      g.beginPath(); g.moveTo(-u * 0.1, -u * 0.86); g.quadraticCurveTo(0, -u * 1.02, u * 0.1, -u * 0.86); g.fill();
    } },

    /* ---- Meeresgrund ---- */
    koralle: { breite: 1.1, sinken: 0.02, male: function (g, u, R) {
      var f = ["#ff6f91", "#ff9a4a", "#b57cff", "#ff5a6a", "#ffb03a"][Math.floor(R() * 5)];
      g.strokeStyle = f; g.lineCap = "round"; g.lineJoin = "round";
      var ast = function (x, y, w, l, d, tiefe) {
        var x2 = x + Math.cos(w) * l, y2 = y - Math.sin(w) * l;
        g.lineWidth = d; g.beginPath(); g.moveTo(x, y); g.quadraticCurveTo((x + x2) / 2 + (R() - 0.5) * l * 0.3, (y + y2) / 2, x2, y2); g.stroke();
        if (tiefe > 0) { ast(x2, y2, w + 0.35 + R() * 0.25, l * 0.72, d * 0.75, tiefe - 1); ast(x2, y2, w - 0.35 - R() * 0.25, l * 0.68, d * 0.75, tiefe - 1); }
        else { g.fillStyle = hell(f, 0.35); g.beginPath(); g.arc(x2, y2, d * 0.75, 0, Math.PI * 2); g.fill(); }
      };
      ast(0, 0, Math.PI / 2 + (R() - 0.5) * 0.3, u * 0.32, u * 0.09, 3);
    } },
    seetang: { breite: 0.6, sinken: 0, male: function (g, u, R) {
      for (var s = 0; s < 3; s++) {
        var x = (s - 1) * u * 0.1, h = u * (0.6 + 0.4 * R()), f = ["#2f8a5a", "#3fa06a", "#4a9a3a"][s], ph = R() * 6;
        g.strokeStyle = f; g.lineWidth = u * 0.045; g.lineCap = "round";
        g.beginPath(); g.moveTo(x, 0);
        for (var y = 0; y <= 1.001; y += 0.1) g.lineTo(x + Math.sin(y * 7 + ph) * u * 0.06 * y, -h * y);
        g.stroke();
        g.fillStyle = hell(f, 0.15);
        for (y = 0.25; y < 1; y += 0.2) { var bx = x + Math.sin(y * 7 + ph) * u * 0.06 * y; g.beginPath(); g.ellipse(bx + u * 0.05, -h * y, u * 0.06, u * 0.025, -0.5, 0, Math.PI * 2); g.fill(); }
      }
    } },
    muschel: { breite: 1.4, sinken: 0.05, male: function (g, u, R) {
      var f = ["#ffd9c2", "#f6c6d8", "#fff0d0"][Math.floor(R() * 3)], b = u * 0.68;
      var gr = g.createLinearGradient(0, -u, 0, 0); gr.addColorStop(0, hell(f, 0.3)); gr.addColorStop(1, dunkel(f, 0.15));
      g.fillStyle = gr;
      g.beginPath(); g.moveTo(-u * 0.12, 0);
      for (var i = 0; i <= 8; i++) { var w = Math.PI + Math.PI * i / 8; g.lineTo(Math.cos(w) * b, -u * 0.18 + Math.sin(w) * u * 0.8 + (i % 2 ? u * 0.05 : 0)); }
      g.lineTo(u * 0.12, 0); g.closePath(); g.fill();
      g.strokeStyle = dunkel(f, 0.3); g.lineWidth = Math.max(1, u * 0.025);
      for (i = 1; i < 8; i++) { w = Math.PI + Math.PI * i / 8; g.beginPath(); g.moveTo(0, -u * 0.05); g.lineTo(Math.cos(w) * b * 0.92, -u * 0.18 + Math.sin(w) * u * 0.74); g.stroke(); }
    } },
    seestern: { breite: 1.6, sinken: 0.1, male: function (g, u, R) {
      var f = ["#ff7a3a", "#ff5a6a", "#ffb03a", "#b57cff"][Math.floor(R() * 4)];
      g.save(); g.translate(0, -u * 0.45); g.scale(1, 0.62); g.rotate(R() * 1.2);
      g.beginPath();
      for (var i = 0; i < 10; i++) { var w = -Math.PI / 2 + i * Math.PI / 5, r = i % 2 ? u * 0.28 : u * 0.75; if (i) g.lineTo(Math.cos(w) * r, Math.sin(w) * r); else g.moveTo(Math.cos(w) * r, Math.sin(w) * r); }
      g.closePath(); g.fillStyle = f; g.fill(); g.strokeStyle = dunkel(f, 0.3); g.lineWidth = Math.max(1, u * 0.03); g.stroke();
      g.fillStyle = hell(f, 0.45);
      for (i = 0; i < 5; i++) { var w2 = -Math.PI / 2 + i * Math.PI * 2 / 5; for (var k = 1; k <= 3; k++) { g.beginPath(); g.arc(Math.cos(w2) * u * 0.17 * k, Math.sin(w2) * u * 0.17 * k, u * 0.04, 0, Math.PI * 2); g.fill(); } }
      g.restore();
    } },
    anker: { breite: 0.9, sinken: 0.08, male: function (g, u, R) {
      g.save(); g.rotate(0.25 + (R() - 0.5) * 0.2);
      g.strokeStyle = "#6f7a86"; g.lineWidth = u * 0.08; g.lineCap = "round";
      g.beginPath(); g.moveTo(0, -u * 0.08); g.lineTo(0, -u * 0.85); g.stroke();                      // Schaft
      g.beginPath(); g.moveTo(-u * 0.22, -u * 0.72); g.lineTo(u * 0.22, -u * 0.72); g.stroke();     // Stock
      g.beginPath(); g.arc(0, -u * 0.38, u * 0.32, 0.15 * Math.PI, 0.85 * Math.PI); g.stroke();     // Arme
      g.lineWidth = u * 0.05; g.beginPath(); g.arc(0, -u * 0.92, u * 0.07, 0, Math.PI * 2); g.stroke();
      g.strokeStyle = "#c9a26a"; g.lineWidth = Math.max(1, u * 0.025);                              // Tau
      g.beginPath(); g.moveTo(0, -u * 0.99); g.quadraticCurveTo(u * 0.3, -u * 0.95, u * 0.25, -u * 0.6); g.quadraticCurveTo(u * 0.2, -u * 0.3, u * 0.38, -u * 0.05); g.stroke();
      g.restore();
    } },
    schatzkiste: { breite: 1.4, sinken: 0.05, male: function (g, u, R) {
      var b = u * 0.62;
      var gl = g.createRadialGradient(0, -u * 0.62, 0, 0, -u * 0.62, u * 0.6);
      gl.addColorStop(0, "rgba(255,230,120,0.6)"); gl.addColorStop(1, "rgba(255,230,120,0)");
      g.fillStyle = gl; g.beginPath(); g.arc(0, -u * 0.62, u * 0.6, 0, Math.PI * 2); g.fill();
      g.fillStyle = "#8a5a2a"; g.fillRect(-b, -u * 0.55, b * 2, u * 0.55);
      g.fillStyle = "#ffcf3a";                                                                       // Goldmünzen
      for (var i = 0; i < 7; i++) { g.beginPath(); g.ellipse((i - 3) * b * 0.26, -u * 0.6 - (i % 2) * u * 0.05, b * 0.15, u * 0.06, 0, 0, Math.PI * 2); g.fill(); }
      g.fillStyle = "#6e4420"; g.save(); g.translate(-b, -u * 0.55); g.rotate(-0.9);                // offener Deckel
      g.fillRect(0, -u * 0.12, b * 1.1, u * 0.12); g.restore();
      g.fillStyle = "#d9a53a"; g.fillRect(-b, -u * 0.55, b * 2, u * 0.06); g.fillRect(-b * 0.12, -u * 0.42, b * 0.24, u * 0.16);
      g.strokeStyle = KONTUR; g.lineWidth = Math.max(1, u * 0.02); g.strokeRect(-b, -u * 0.55, b * 2, u * 0.55);
    } },

    /* ---- Mars ---- */
    marsstein: { breite: 1.6, sinken: 0.12, male: function (g, u, R) {
      var f = ["#a4502f", "#b8603a", "#8f4431", "#c06a40"][Math.floor(R() * 4)];
      facetten(g, u, R, felsForm(g, u, R, 1.5, 0.85, f, R() < 0.6), f);
    } },
    rover: { breite: 1.4, sinken: 0, male: function (g, u, R) {
      // kleiner Mars-Rover mit sechs Rädern, Mast mit Kamera-Kopf und Solarflügel
      var b = u * 0.62;
      g.fillStyle = "#3a3f4b";
      for (var i = -1; i <= 1; i++) { g.beginPath(); g.arc(i * b * 0.75, -u * 0.12, u * 0.12, 0, Math.PI * 2); g.fill(); }
      g.strokeStyle = "#6f7686"; g.lineWidth = Math.max(1, u * 0.03);
      g.beginPath(); g.moveTo(-b * 0.75, -u * 0.12); g.lineTo(-b * 0.4, -u * 0.32); g.lineTo(b * 0.75, -u * 0.12); g.moveTo(0, -u * 0.12); g.lineTo(-b * 0.4, -u * 0.32); g.stroke();
      var gr = g.createLinearGradient(0, -u * 0.5, 0, -u * 0.3); gr.addColorStop(0, "#f4f6fb"); gr.addColorStop(1, "#b9c1d4");
      g.fillStyle = gr; g.fillRect(-b * 0.7, -u * 0.48, b * 1.4, u * 0.17);
      g.fillStyle = "#2f4f8f"; g.fillRect(-b * 0.95, -u * 0.53, b * 0.6, u * 0.05); g.fillRect(b * 0.35, -u * 0.53, b * 0.6, u * 0.05);
      g.fillStyle = "#c9cfdb"; g.fillRect(b * 0.35, -u * 0.95, u * 0.04, u * 0.47);
      g.fillStyle = "#f4f6fb"; g.fillRect(b * 0.25, -u * 1.02, u * 0.22, u * 0.12);
      g.fillStyle = "#2b2f3a"; g.beginPath(); g.arc(b * 0.25 + u * 0.16, -u * 0.96, u * 0.035, 0, Math.PI * 2); g.fill();
    } },
    marsbasis: { breite: 1.8, sinken: 0, male: function (g, u, R) {
      // Kuppel-Station mit Fenstern, Schleuse und Antenne
      var b = u * 0.8;
      var gr = g.createLinearGradient(-b, -u * 0.7, b, 0); gr.addColorStop(0, "#ffffff"); gr.addColorStop(1, "#aeb6c8");
      g.fillStyle = gr; g.beginPath(); g.ellipse(0, 0, b, u * 0.62, 0, Math.PI, 0); g.fill();
      g.strokeStyle = KONTUR; g.lineWidth = Math.max(1, u * 0.015); g.stroke();
      g.strokeStyle = "rgba(60,70,90,0.35)";
      for (var i = 1; i < 4; i++) { g.beginPath(); g.ellipse(0, 0, b * i / 4, u * 0.62, 0, Math.PI, 0); g.stroke(); }
      g.fillStyle = "#6fc3ff"; [-0.45, 0.1, 0.5].forEach(function (x) { g.beginPath(); g.arc(x * b, -u * 0.3, u * 0.06, 0, Math.PI * 2); g.fill(); });
      g.fillStyle = "#c9cfdb"; g.fillRect(b * 0.75, -u * 0.22, b * 0.35, u * 0.22);
      g.fillStyle = "#e8453c"; g.fillRect(-u * 0.02, -u * 0.95, u * 0.04, u * 0.35);
      g.beginPath(); g.arc(0, -u * 0.97, u * 0.05, 0, Math.PI * 2); g.fill();
    } },

    /* ---- Geisterwelt ---- */
    laternenkuerbis: { breite: 1.4, sinken: 0.04, male: function (g, u, R) {
      // Kürbis mit freundlich geschnitztem, leuchtendem Gesicht
      MALER.kuerbis.male(g, u, R);
      var h = u * 0.82, gl = "#ffe27a";
      g.fillStyle = gl; g.shadowColor = "#ffb02e"; g.shadowBlur = u * 0.1;
      [-1, 1].forEach(function (sd) { g.beginPath(); g.moveTo(sd * u * 0.22, -h * 0.55); g.lineTo(sd * u * 0.1, -h * 0.55); g.lineTo(sd * u * 0.16, -h * 0.68); g.closePath(); g.fill(); });
      g.beginPath(); g.moveTo(-u * 0.25, -h * 0.35); g.quadraticCurveTo(0, -h * 0.12, u * 0.25, -h * 0.35); g.quadraticCurveTo(0, -h * 0.25, -u * 0.25, -h * 0.35); g.fill();
      g.shadowBlur = 0;
    } },

    /* ---- Gebirge ---- */
    steinbock: { breite: 1.2, sinken: 0, male: function (g, u, R) {
      // Steinbock auf einem Felsen, mit großen gebogenen Hörnern (Blick nach rechts)
      var f = R() < 0.5 ? "#9a7a58" : "#8a6c4c";
      felsForm(g, u, R, 1.1, 0.35, "#8d8a86", false);
      var y0 = -u * 0.3;
      g.fillStyle = f;
      g.beginPath(); g.ellipse(0, y0 - u * 0.25, u * 0.3, u * 0.15, 0, 0, Math.PI * 2); g.fill();     // Körper
      g.strokeStyle = f; g.lineWidth = u * 0.06; g.lineCap = "round";
      [-0.2, -0.1, 0.12, 0.22].forEach(function (x) { g.beginPath(); g.moveTo(x * u, y0 - u * 0.15); g.lineTo(x * u + (R() - 0.5) * u * 0.05, y0); g.stroke(); });
      g.beginPath(); g.moveTo(u * 0.22, y0 - u * 0.3); g.lineTo(u * 0.33, y0 - u * 0.48); g.stroke();                 // Hals
      g.beginPath(); g.ellipse(u * 0.38, y0 - u * 0.5, u * 0.09, u * 0.06, 0.3, 0, Math.PI * 2); g.fill();          // Kopf
      g.strokeStyle = "#5a4a3a"; g.lineWidth = u * 0.035;
      g.beginPath(); g.moveTo(u * 0.34, y0 - u * 0.55); g.quadraticCurveTo(u * 0.2, y0 - u * 0.85, u * 0.08, y0 - u * 0.62); g.stroke();   // Horn
      g.fillStyle = "#2a1a10"; g.beginPath(); g.arc(u * 0.4, y0 - u * 0.52, u * 0.015, 0, Math.PI * 2); g.fill();
      g.strokeStyle = f; g.lineWidth = u * 0.025; g.beginPath(); g.moveTo(u * 0.42, y0 - u * 0.45); g.lineTo(u * 0.43, y0 - u * 0.38); g.stroke();   // Bart
    } },
    gipfelkreuz: { breite: 0.6, sinken: 0, male: function (g, u, R) {
      felsForm(g, u, R, 0.9, 0.2, "#8d8a86", true);
      g.fillStyle = "#7a5232"; g.fillRect(-u * 0.035, -u, u * 0.07, u * 0.85); g.fillRect(-u * 0.22, -u * 0.8, u * 0.44, u * 0.06);
      g.fillStyle = "#ffd23f"; g.beginPath(); g.arc(0, -u * 0.77, u * 0.04, 0, Math.PI * 2); g.fill();
    } },

    /* ---- Glaswelt (halb durchsichtig) ---- */
    glasskulptur: { breite: 1.0, sinken: 0, male: function (g, u, R, v) {
      var art = v % 3;
      g.fillStyle = "rgba(160,220,248,0.5)"; g.strokeStyle = "rgba(60,140,200,0.8)"; g.lineWidth = Math.max(1, u * 0.02);
      g.beginPath();
      if (art === 0) {                                     // Spirale aus Glas
        for (var i = 0; i <= 30; i++) { var t = i / 30, r = u * (0.4 - 0.3 * t); g.lineTo(Math.cos(t * 12) * r, -u * t); }
        g.lineWidth = Math.max(2, u * 0.08); g.strokeStyle = "rgba(120,195,240,0.75)"; g.stroke();
        g.lineWidth = Math.max(1, u * 0.02); g.strokeStyle = "rgba(255,255,255,0.95)"; g.stroke();
      } else if (art === 1) {                              // Vase
        g.moveTo(-u * 0.12, 0); g.quadraticCurveTo(-u * 0.45, -u * 0.35, -u * 0.12, -u * 0.75); g.lineTo(-u * 0.18, -u); g.lineTo(u * 0.18, -u);
        g.lineTo(u * 0.12, -u * 0.75); g.quadraticCurveTo(u * 0.45, -u * 0.35, u * 0.12, 0); g.closePath(); g.fill(); g.stroke();
      } else {                                             // gestapelte Kugeln
        [0.18, 0.5, 0.8].forEach(function (y, k) { g.beginPath(); g.arc(0, -u * y, u * (0.2 - k * 0.04), 0, Math.PI * 2); g.fill(); g.stroke(); });
      }
      g.strokeStyle = "rgba(255,255,255,0.8)"; g.lineWidth = Math.max(1, u * 0.03);
      g.beginPath(); g.moveTo(-u * 0.08, -u * 0.6); g.lineTo(-u * 0.02, -u * 0.72); g.stroke();
    } },
    glasbaum: { breite: 1.1, sinken: 0, male: function (g, u, R) {
      g.fillStyle = "rgba(170,225,250,0.6)"; g.strokeStyle = "rgba(60,140,200,0.75)"; g.lineWidth = Math.max(1, u * 0.02);
      g.fillRect(-u * 0.04, -u * 0.4, u * 0.08, u * 0.4); g.strokeRect(-u * 0.04, -u * 0.4, u * 0.08, u * 0.4);
      var f = ["rgba(150,230,255,0.45)", "rgba(200,170,255,0.45)", "rgba(170,255,220,0.45)"][Math.floor(R() * 3)];
      for (var i = 0; i < 3; i++) {                       // drei Glas-Dreiecke übereinander
        var y = -u * (0.35 + i * 0.2), b = u * (0.45 - i * 0.1);
        g.fillStyle = f; g.beginPath(); g.moveTo(-b, y); g.lineTo(0, y - u * 0.32); g.lineTo(b, y); g.closePath(); g.fill(); g.stroke();
      }
    } },

    /* ---- Klemmbaustein-Land ---- */
    steinbaum: { breite: 1.0, sinken: 0, male: function (g, u, R) {
      var st = u * 0.11, gruen = ["#3cc35a", "#2f9e48", "#5fd06a"];
      for (var y = 0; y < 4; y++) bausteinR(g, -u * 0.07, -u * 0.11 * (y + 1), u * 0.14, u * 0.11, "#8a5a2a", u);
      var lagen = [[0.48, 4], [0.38, 5], [0.28, 6], [0.16, 7]];
      lagen.forEach(function (l, k) { bausteinR(g, -u * l[0], -st * l[1], u * l[0] * 2, st, gruen[k % 3], u); });
    } },
    steinhaus: { breite: 1.2, sinken: 0, male: function (g, u, R) {
      var wand = ["#ffd23f", "#f4f6fb", "#e8453c"][Math.floor(R() * 3)], b = u * 0.5, st = u * 0.12;
      for (var y = 0; y < 5; y++) bausteinR(g, -b + (y % 2) * u * 0.04, -st * (y + 1), b * 2 - u * 0.04, st, wand, u);
      g.fillStyle = "#6fc3ff"; g.fillRect(-b * 0.6, -st * 3.6, b * 0.45, st * 1.6); g.fillRect(b * 0.15, -st * 3.6, b * 0.45, st * 1.6);
      g.fillStyle = "#8a5a2a"; g.fillRect(-b * 0.15, -st * 2.2, b * 0.3, st * 2.2);
      for (var d = 0; d < 3; d++) bausteinR(g, -b * (1.05 - d * 0.32), -st * (6 + d), b * 2 * (1.05 - d * 0.32), st, "#e8453c", u);
    } },
    steinblume: { breite: 0.6, sinken: 0, male: function (g, u, R) {
      g.fillStyle = "#3cc35a"; g.fillRect(-u * 0.04, -u * 0.7, u * 0.08, u * 0.7);
      bausteinR(g, -u * 0.25, -u * 0.35, u * 0.2, u * 0.08, "#2f9e48", u);
      var f = ["#e8453c", "#ffd23f", "#ff6fb5", "#2f6fd6"][Math.floor(R() * 4)];
      bausteinR(g, -u * 0.22, -u * 0.86, u * 0.44, u * 0.16, f, u);
      bausteinR(g, -u * 0.1, -u * 0.98, u * 0.2, u * 0.12, "#ffd23f", u);
    } },

    /* ---- Raumstation ---- */
    antenne: { breite: 0.9, sinken: 0, male: function (g, u, R) {
      // Parabolantenne auf einem Gestell, mit blinkendem Licht an der Spitze
      g.fillStyle = "#6f7a94"; g.fillRect(-u * 0.04, -u * 0.6, u * 0.08, u * 0.6);
      g.fillRect(-u * 0.2, -u * 0.04, u * 0.4, u * 0.04);
      g.save(); g.translate(0, -u * 0.62); g.rotate(-0.5 - R() * 0.4);
      var gr = g.createLinearGradient(-u * 0.35, 0, u * 0.35, 0); gr.addColorStop(0, "#f4f6fb"); gr.addColorStop(1, "#aab4cc");
      g.fillStyle = gr; g.beginPath(); g.ellipse(0, 0, u * 0.36, u * 0.13, 0, 0, Math.PI); g.fill();
      g.strokeStyle = "#6f7a94"; g.lineWidth = Math.max(1, u * 0.02); g.beginPath(); g.moveTo(0, 0); g.lineTo(0, -u * 0.25); g.stroke();
      g.fillStyle = "#e8453c"; g.beginPath(); g.arc(0, -u * 0.27, u * 0.04, 0, Math.PI * 2); g.fill();
      g.restore();
    } },
    solarpanel: { breite: 1.5, sinken: 0, male: function (g, u, R) {
      g.fillStyle = "#6f7a94"; g.fillRect(-u * 0.03, -u * 0.55, u * 0.06, u * 0.55);
      g.save(); g.translate(0, -u * 0.6); g.rotate(-0.25 + (R() - 0.5) * 0.2);
      var b = u * 0.7, h = u * 0.35;
      g.fillStyle = "#1f3f8f"; g.fillRect(-b, -h, b * 2, h);
      g.strokeStyle = "#7aa7ff"; g.lineWidth = Math.max(1, u * 0.012);
      for (var i = 1; i < 6; i++) { g.beginPath(); g.moveTo(-b + b * 2 * i / 6, -h); g.lineTo(-b + b * 2 * i / 6, 0); g.stroke(); }
      g.beginPath(); g.moveTo(-b, -h / 2); g.lineTo(b, -h / 2); g.stroke();
      g.fillStyle = "rgba(255,255,255,0.25)"; g.beginPath(); g.moveTo(-b, -h); g.lineTo(-b * 0.4, -h); g.lineTo(-b * 0.8, 0); g.lineTo(-b, 0); g.closePath(); g.fill();
      g.restore();
    } },

    /* ---- Spielzeugfabrik ---- */
    bauklotz: { breite: 1.0, sinken: 0, male: function (g, u, R) {
      // gestapelte bunte Holzklötze mit Buchstaben-Punkten
      var farben = ["#e8453c", "#2f6fd6", "#ffd23f", "#3cc35a", "#ff8a2e", "#8e5bd8"], y = 0, n = 2 + Math.floor(R() * 2);
      for (var i = 0; i < n; i++) {
        var b = u * (0.42 - i * 0.06), hb = u * (0.32 - i * 0.03), x = (R() - 0.5) * u * 0.08, f = farben[Math.floor(R() * 6)];
        var gr = g.createLinearGradient(x - b, 0, x + b, 0); gr.addColorStop(0, hell(f, 0.2)); gr.addColorStop(1, dunkel(f, 0.15));
        g.fillStyle = gr; g.fillRect(x - b, y - hb, b * 2, hb);
        g.strokeStyle = KONTUR; g.lineWidth = Math.max(1, u * 0.015); g.strokeRect(x - b, y - hb, b * 2, hb);
        g.fillStyle = "rgba(255,255,255,0.85)"; g.beginPath(); g.arc(x, y - hb / 2, hb * 0.22, 0, Math.PI * 2); g.fill();
        y -= hb;
      }
      if (R() < 0.5) {                                   // ein Dreieck obendrauf
        g.fillStyle = farben[Math.floor(R() * 6)]; g.beginPath(); g.moveTo(-u * 0.2, y); g.lineTo(u * 0.2, y); g.lineTo(0, y - u * 0.25); g.closePath(); g.fill();
      }
    } },
    zahnrad: { breite: 1.0, sinken: 0.15, male: function (g, u, R) {
      var f = ["#9aa3b5", "#c9a24a", "#b8784a"][Math.floor(R() * 3)], r = u * 0.48, n = 8 + Math.floor(R() * 4), y = -u * 0.5;
      g.beginPath();
      for (var i = 0; i < n * 2; i++) { var a = i * Math.PI / n, rr = i % 2 ? r * 0.8 : r; g.lineTo(Math.cos(a - 0.13) * rr, y + Math.sin(a - 0.13) * rr); g.lineTo(Math.cos(a + 0.13) * rr, y + Math.sin(a + 0.13) * rr); }
      g.closePath();
      var gr = g.createRadialGradient(-r * 0.3, y - r * 0.3, r * 0.1, 0, y, r); gr.addColorStop(0, hell(f, 0.3)); gr.addColorStop(1, dunkel(f, 0.2));
      g.fillStyle = gr; g.fill(); g.strokeStyle = KONTUR; g.lineWidth = Math.max(1, u * 0.015); g.stroke();
      g.fillStyle = dunkel(f, 0.35); g.beginPath(); g.arc(0, y, r * 0.25, 0, Math.PI * 2); g.fill();
      g.fillStyle = dunkel(f, 0.1); for (i = 0; i < 4; i++) { g.beginPath(); g.arc(Math.cos(i * 1.57 + 0.7) * r * 0.52, y + Math.sin(i * 1.57 + 0.7) * r * 0.52, r * 0.1, 0, Math.PI * 2); g.fill(); }
    } },
    // Schleimwelt (Version 35): freundliches Glibbermonster und ein Fass, aus dem Schleim quillt
    glibber: { breite: 1.2, sinken: 0.02, male: function (g, u, R) {
      var f = ["#7fe23a", "#5fd65a", "#a6ef4a", "#3fcf8a"][Math.floor(R() * 4)], b = u * 0.58;
      var gr = g.createLinearGradient(0, -u, 0, 0); gr.addColorStop(0, hell(f, 0.25)); gr.addColorStop(1, dunkel(f, 0.15));
      g.fillStyle = gr;
      g.beginPath(); g.moveTo(-b, 0);
      g.bezierCurveTo(-b * 1.05, -u * 0.6, -b * 0.6, -u * 1.02, 0, -u);
      g.bezierCurveTo(b * 0.6, -u * 1.02, b * 1.05, -u * 0.6, b, 0);
      for (var k = 4; k >= 0; k--) g.quadraticCurveTo(-b + (k + 0.5) * b * 0.4, u * (k % 2 ? 0.08 : -0.02), -b + k * b * 0.4, 0);
      g.fill();
      g.strokeStyle = dunkel(f, 0.4); g.lineWidth = Math.max(1, u * 0.035); g.stroke();
      var aug = R() < 0.35 ? 1 : 2, ay = -u * 0.62;
      for (var a = 0; a < aug; a++) {
        var ax = aug === 1 ? 0 : (a ? b * 0.34 : -b * 0.34), ar = u * (aug === 1 ? 0.2 : 0.14);
        g.fillStyle = "#ffffff"; g.beginPath(); g.arc(ax, ay, ar, 0, Math.PI * 2); g.fill();
        g.fillStyle = "#1e2c52"; g.beginPath(); g.arc(ax + ar * 0.25, ay + ar * 0.1, ar * 0.5, 0, Math.PI * 2); g.fill();
        g.fillStyle = "#ffffff"; g.beginPath(); g.arc(ax + ar * 0.4, ay - ar * 0.15, ar * 0.17, 0, Math.PI * 2); g.fill();
      }
      g.strokeStyle = "#1e2c52"; g.lineWidth = Math.max(1, u * 0.04); g.lineCap = "round";     // Lächeln
      g.beginPath(); g.arc(0, -u * 0.38, u * 0.14, 0.15 * Math.PI, 0.85 * Math.PI); g.stroke();
      g.fillStyle = "rgba(255,255,255,0.45)"; g.beginPath(); g.ellipse(-b * 0.45, -u * 0.72, u * 0.08, u * 0.14, -0.5, 0, Math.PI * 2); g.fill();
    } },
    schleimfass: { breite: 0.8, sinken: 0, male: function (g, u, R) {
      var b = u * 0.36, f = ["#5a6a8a", "#8a5a6a", "#6a5a8a"][Math.floor(R() * 3)];
      var gr = g.createLinearGradient(-b, 0, b, 0); gr.addColorStop(0, dunkel(f, 0.2)); gr.addColorStop(0.4, hell(f, 0.25)); gr.addColorStop(1, dunkel(f, 0.3));
      g.fillStyle = gr; g.fillRect(-b, -u * 0.9, b * 2, u * 0.9);
      g.fillStyle = dunkel(f, 0.4); g.fillRect(-b, -u * 0.68, b * 2, u * 0.06); g.fillRect(-b, -u * 0.3, b * 2, u * 0.06);
      g.fillStyle = "#7fe23a";                                // Schleim quillt oben heraus und läuft herunter
      g.beginPath(); g.ellipse(0, -u * 0.9, b * 1.05, u * 0.09, 0, 0, Math.PI * 2); g.fill();
      [[-b * 0.6, 0.35], [b * 0.1, 0.55], [b * 0.65, 0.25]].forEach(function (d) {
        g.beginPath(); g.moveTo(d[0] - u * 0.05, -u * 0.9); g.lineTo(d[0] - u * 0.04, -u * (0.9 - d[1]));
        g.arc(d[0], -u * (0.9 - d[1]), u * 0.045, Math.PI, 0, true); g.lineTo(d[0] + u * 0.05, -u * 0.9); g.fill();
      });
      g.fillStyle = "rgba(230,255,190,0.8)"; g.beginPath(); g.arc(-b * 0.3, -u * 0.92, u * 0.035, 0, Math.PI * 2); g.fill();
    } },
    kiste: { breite: 1.1, sinken: 0, male: function (g, u, R) {
      var b = u * 0.52, f = "#c9955a";
      var gr = g.createLinearGradient(-b, 0, b, 0); gr.addColorStop(0, hell(f, 0.15)); gr.addColorStop(1, dunkel(f, 0.2));
      g.fillStyle = gr; g.fillRect(-b, -u, b * 2, u);
      g.strokeStyle = dunkel(f, 0.4); g.lineWidth = Math.max(1, u * 0.04); g.strokeRect(-b, -u, b * 2, u);
      g.beginPath(); g.moveTo(-b, -u); g.lineTo(b, 0); g.moveTo(b, -u); g.lineTo(-b, 0); g.stroke();
      if (R() < 0.7) {                                    // Aufkleber: Herz, Stern oder Teddy-Kopf
        g.fillStyle = ["#e8453c", "#ffd23f", "#2f6fd6"][Math.floor(R() * 3)];
        g.beginPath(); g.arc(0, -u * 0.5, u * 0.16, 0, Math.PI * 2); g.fill();
        g.fillStyle = "#fff"; g.beginPath(); g.arc(0, -u * 0.5, u * 0.07, 0, Math.PI * 2); g.fill();
      }
    } },
    kreisel: { breite: 0.8, sinken: 0, male: function (g, u, R) {
      var farben = [["#e8453c", "#ffd23f"], ["#2f6fd6", "#ffffff"], ["#3cc35a", "#ff8a2e"]][Math.floor(R() * 3)], b = u * 0.38;
      g.save(); g.rotate((R() - 0.5) * 0.25);
      g.beginPath(); g.moveTo(0, 0); g.lineTo(-b, -u * 0.5); g.quadraticCurveTo(0, -u * 0.78, b, -u * 0.5); g.closePath();
      g.save(); g.clip();
      for (var i = 0; i < 6; i++) { g.fillStyle = farben[i % 2]; g.beginPath(); g.moveTo(0, 0); g.lineTo(-b + i * b / 3, -u); g.lineTo(-b + (i + 1) * b / 3, -u); g.closePath(); g.fill(); }
      g.restore();
      g.strokeStyle = KONTUR; g.lineWidth = Math.max(1, u * 0.02); g.stroke();
      g.fillStyle = "#7a5232"; g.fillRect(-u * 0.025, -u * 0.85, u * 0.05, u * 0.22);
      g.restore();
    } },

    /* ---- Nachtwald (das Licht malt grafik.js zeichneNacht dazu) ---- */
    laterne: { breite: 0.45, sinken: 0, male: function (g, u, R) {
      g.fillStyle = "#2e3442"; g.fillRect(-u * 0.025, -u * 0.82, u * 0.05, u * 0.82);
      g.fillRect(-u * 0.08, -u * 0.02, u * 0.16, u * 0.02);
      g.fillStyle = "#3a4152"; g.beginPath(); g.moveTo(-u * 0.11, -u * 0.86); g.lineTo(0, -u * 0.98); g.lineTo(u * 0.11, -u * 0.86); g.closePath(); g.fill();
      var gl = g.createRadialGradient(0, -u * 0.78, 0, 0, -u * 0.78, u * 0.12);
      gl.addColorStop(0, "#fff6c8"); gl.addColorStop(1, "#ffc24a");
      g.fillStyle = gl; g.fillRect(-u * 0.08, -u * 0.86, u * 0.16, u * 0.16);
      g.strokeStyle = "#2e3442"; g.lineWidth = Math.max(1, u * 0.015); g.strokeRect(-u * 0.08, -u * 0.86, u * 0.16, u * 0.16);
    } },
    eule: { breite: 0.8, sinken: 0.02, male: function (g, u, R) {
      // Baumstumpf, darauf eine freundliche Eule
      var gr = g.createLinearGradient(-u * 0.25, 0, u * 0.25, 0);
      gr.addColorStop(0, "#8a6238"); gr.addColorStop(1, "#4e3420");
      g.fillStyle = gr; g.fillRect(-u * 0.24, -u * 0.48, u * 0.48, u * 0.48);
      g.fillStyle = "#c9a26a"; g.beginPath(); g.ellipse(0, -u * 0.48, u * 0.24, u * 0.05, 0, 0, Math.PI * 2); g.fill();
      g.strokeStyle = "#8a6238"; g.lineWidth = Math.max(1, u * 0.01); g.beginPath(); g.ellipse(0, -u * 0.48, u * 0.12, u * 0.025, 0, 0, Math.PI * 2); g.stroke();
      var f = R() < 0.5 ? "#8a6a4a" : "#a07a52";
      g.fillStyle = f; g.beginPath(); g.ellipse(0, -u * 0.7, u * 0.17, u * 0.23, 0, 0, Math.PI * 2); g.fill();
      g.beginPath(); g.moveTo(-u * 0.15, -u * 0.86); g.lineTo(-u * 0.12, -u * 0.98); g.lineTo(-u * 0.05, -u * 0.9); g.moveTo(u * 0.15, -u * 0.86); g.lineTo(u * 0.12, -u * 0.98); g.lineTo(u * 0.05, -u * 0.9); g.fill();
      g.fillStyle = hell(f, 0.4); g.beginPath(); g.ellipse(0, -u * 0.62, u * 0.1, u * 0.12, 0, 0, Math.PI * 2); g.fill();
      [-1, 1].forEach(function (s) {
        g.fillStyle = "#fff6c8"; g.beginPath(); g.arc(s * u * 0.07, -u * 0.8, u * 0.06, 0, Math.PI * 2); g.fill();
        g.fillStyle = "#2a1a10"; g.beginPath(); g.arc(s * u * 0.07, -u * 0.8, u * 0.03, 0, Math.PI * 2); g.fill();
        g.fillStyle = "#ffffff"; g.beginPath(); g.arc(s * u * 0.07 + u * 0.01, -u * 0.81, u * 0.01, 0, Math.PI * 2); g.fill();
      });
      g.fillStyle = "#f2a02a"; g.beginPath(); g.moveTo(-u * 0.025, -u * 0.75); g.lineTo(u * 0.025, -u * 0.75); g.lineTo(0, -u * 0.71); g.closePath(); g.fill();
    } },
    zelt: { breite: 1.7, sinken: 0.02, male: function (g, u, R) {
      var f = ["#e8862e", "#3cc35a", "#2f6fd6"][Math.floor(R() * 3)], b = u * 0.55;
      g.fillStyle = dunkel(f, 0.15); g.beginPath(); g.moveTo(-b - u * 0.3, 0); g.lineTo(-u * 0.3, -u * 0.8); g.lineTo(b - u * 0.3, 0); g.closePath(); g.fill();
      g.fillStyle = "#2a1f1a"; g.beginPath(); g.moveTo(-u * 0.48, 0); g.lineTo(-u * 0.3, -u * 0.45); g.lineTo(-u * 0.12, 0); g.closePath(); g.fill();
      g.fillStyle = hell(f, 0.2); g.beginPath(); g.moveTo(-u * 0.3, -u * 0.8); g.lineTo(-u * 0.12, 0); g.lineTo(-u * 0.05, 0); g.closePath(); g.fill();
      // Lagerfeuer
      var x = u * 0.5;
      g.strokeStyle = "#6a4528"; g.lineWidth = u * 0.05; g.lineCap = "round";
      g.beginPath(); g.moveTo(x - u * 0.16, -u * 0.02); g.lineTo(x + u * 0.16, -u * 0.08); g.moveTo(x - u * 0.16, -u * 0.08); g.lineTo(x + u * 0.16, -u * 0.02); g.stroke();
      [["#ff5a1f", 0.3, 0.12], ["#ffb02e", 0.22, 0.08], ["#fff2a0", 0.12, 0.045]].forEach(function (fl) {
        g.fillStyle = fl[0]; g.beginPath(); g.moveTo(x - u * fl[2], -u * 0.06);
        g.quadraticCurveTo(x - u * fl[2], -u * fl[1] * 0.7, x, -u * (0.06 + fl[1])); g.quadraticCurveTo(x + u * fl[2], -u * fl[1] * 0.7, x + u * fl[2], -u * 0.06); g.closePath(); g.fill();
      });
    } },

    /* ---- Bauernhof (Version 25) ---- */
    schwein: { breite: 1.7, sinken: 0, male: function (g, u, R, v) {
      // Schwein mit Ringelschwanz (Blick nach rechts). Varianten: rosa, gefleckt,
      // mit Matschflecken, zwei Ferkel
      var art = v % 4;
      if (art === 3) { schweinMalen(g, u * 0.62, -u * 0.45, 0, R, "#ffb3c4", false); schweinMalen(g, u * 0.58, u * 0.33, 0, R, "#ffc2cf", false); return; }
      schweinMalen(g, u, -u * 0.08, 0, R, art === 1 ? "#ffc0cc" : "#ffaec0", art === 1, art === 2);
    } },
    heuballen: { breite: 1.3, sinken: 0.04, male: function (g, u, R) {
      // runder Heuballen (Stirnseite mit Spirale)
      var r = u * 0.5, x = 0, y = -r;
      var gr = g.createRadialGradient(x - r * 0.3, y - r * 0.3, r * 0.1, x, y, r);
      gr.addColorStop(0, "#f6dc7a"); gr.addColorStop(1, "#d4a83c");
      g.fillStyle = gr; g.beginPath(); g.arc(x, y, r, 0, Math.PI * 2); g.fill();
      g.strokeStyle = "#b8892a"; g.lineWidth = Math.max(1, u * 0.025);
      g.beginPath();
      for (var t = 0; t < 14; t += 0.1) { var rr = r * t / 15; g.lineTo(x + Math.cos(t * 1.6) * rr, y + Math.sin(t * 1.6) * rr); }
      g.stroke();
      g.strokeStyle = "#f9e7a0"; g.lineWidth = Math.max(1, u * 0.015);
      for (var i = 0; i < 9; i++) { var w = R() * Math.PI * 2; g.beginPath(); g.moveTo(x + Math.cos(w) * r * 0.95, y + Math.sin(w) * r * 0.95); g.lineTo(x + Math.cos(w + 0.2) * r * 1.08, y + Math.sin(w + 0.2) * r * 1.08); g.stroke(); }
    } },
    strohballen: { breite: 1.5, sinken: 0.02, male: function (g, u, R) {
      // eckige Strohballen, manchmal zwei übereinander, mit Schnüren
      var zwei = R() < 0.45, b = u * 0.72, h = zwei ? u * 0.48 : u * 0.6;
      for (var k = 0; k < (zwei ? 2 : 1); k++) {
        var y = -h * (k + 1), x = -b / 2 + (k ? (R() - 0.5) * u * 0.15 : 0);
        var gr = g.createLinearGradient(0, y, 0, y + h); gr.addColorStop(0, "#f7df86"); gr.addColorStop(1, "#d9ad44");
        g.fillStyle = gr; g.fillRect(x, y, b, h);
        g.strokeStyle = "#c29433"; g.lineWidth = Math.max(1, u * 0.012);
        for (var i = 0; i < 7; i++) { var yy = y + h * (0.1 + 0.8 * R()); g.beginPath(); g.moveTo(x + b * R(), yy); g.lineTo(x + b * R(), yy + h * 0.06); g.stroke(); }
        g.strokeStyle = "#a0522d"; g.lineWidth = Math.max(1, u * 0.025);
        g.beginPath(); g.moveTo(x + b * 0.3, y); g.lineTo(x + b * 0.3, y + h); g.moveTo(x + b * 0.7, y); g.lineTo(x + b * 0.7, y + h); g.stroke();
      }
    } },
    milchkanne: { breite: 0.7, sinken: 0, male: function (g, u, R) {
      var b = u * 0.3;
      var gr = g.createLinearGradient(-b, 0, b, 0); gr.addColorStop(0, "#f2f5fa"); gr.addColorStop(0.5, "#c8cfdc"); gr.addColorStop(1, "#8e97a8");
      g.fillStyle = gr;
      g.beginPath(); g.moveTo(-b, 0); g.lineTo(-b, -u * 0.6); g.quadraticCurveTo(-b, -u * 0.72, -b * 0.5, -u * 0.8); g.lineTo(-b * 0.5, -u * 0.92);
      g.lineTo(b * 0.5, -u * 0.92); g.lineTo(b * 0.5, -u * 0.8); g.quadraticCurveTo(b, -u * 0.72, b, -u * 0.6); g.lineTo(b, 0); g.closePath(); g.fill();
      g.fillStyle = "#6b7384"; g.fillRect(-b * 0.6, -u * 0.98, b * 1.2, u * 0.07);
      g.strokeStyle = "#6b7384"; g.lineWidth = Math.max(1, u * 0.03);
      g.beginPath(); g.moveTo(-b * 1.02, -u * 0.25); g.lineTo(b * 1.02, -u * 0.25); g.stroke();
      g.beginPath(); g.arc(0, -u * 0.98, b * 0.45, Math.PI, 0); g.stroke();
    } },

    /* ---- Obstplantage (Version 25): fünf Sorten × zwei Kronenformen ---- */
    obstbaum: { breite: 1.2, sinken: 0.02, male: function (g, u, R, v) {
      var sorte = OBST_SORTEN[v % OBST_SORTEN.length], rund = Math.floor(v / OBST_SORTEN.length) % 2 === 0;
      var neig = (R() - 0.5) * u * 0.08;
      stamm(g, u, 0, 0, neig, -u * 0.45, u * 0.055, "#7a5232");
      g.strokeStyle = "#6a4528"; g.lineWidth = u * 0.028; g.lineCap = "round";
      g.beginPath(); g.moveTo(neig * 0.6, -u * 0.38); g.lineTo(neig - u * 0.18, -u * 0.55); g.stroke();
      g.beginPath(); g.moveTo(neig * 0.7, -u * 0.42); g.lineTo(neig + u * 0.17, -u * 0.58); g.stroke();
      var cy = -u * (rund ? 0.62 : 0.66), rad = u * (rund ? 0.4 : 0.36);
      if (rund) krone(g, u, R, neig, cy, rad, sorte.laub, 8);
      else { krone(g, u, R, neig - u * 0.12, cy + u * 0.04, rad * 0.8, sorte.laub, 5); krone(g, u, R, neig + u * 0.12, cy - u * 0.02, rad * 0.85, sorte.laub, 5); krone(g, u, R, neig, cy - u * 0.16, rad * 0.7, sorte.laub, 4); }
      // Früchte in der Krone, ein paar im Gras darunter
      for (var i = 0; i < 11; i++) {
        var w = R() * Math.PI * 2, d = Math.sqrt(R()) * rad * 0.9;
        frucht(g, sorte, neig + Math.cos(w) * d * 1.15, cy + Math.sin(w) * d * 0.85, u * sorte.gr);
      }
      for (i = 0; i < 2; i++) if (R() < 0.6) frucht(g, sorte, (R() - 0.5) * u * 0.7, -u * sorte.gr * 0.9, u * sorte.gr);
    } },
    obstkiste: { breite: 1.4, sinken: 0, male: function (g, u, R, v) {
      // Holzkiste voller Obst
      var sorte = OBST_SORTEN[v % OBST_SORTEN.length], b = u * 0.68, h = u * 0.55;
      for (var i = 0; i < 9; i++) frucht(g, sorte, -b * 0.8 + b * 1.6 * (i % 5) / 4 + (R() - 0.5) * u * 0.05, -h - u * 0.05 - (i > 4 ? u * 0.13 : 0), u * Math.max(0.16, sorte.gr * 1.6));
      g.fillStyle = "#c9955a"; g.fillRect(-b, -h, b * 2, h);
      g.fillStyle = "#a8743e";
      for (var k = 0; k < 3; k++) g.fillRect(-b, -h + k * h / 3 + h * 0.08, b * 2, h * 0.1);
      g.strokeStyle = "#7a4f28"; g.lineWidth = Math.max(1, u * 0.03); g.strokeRect(-b, -h, b * 2, h);
    } },

    /* ---- Röhrenwelt (Version 25) ---- */
    rohrbogen: { breite: 1.5, sinken: 0.04, male: function (g, u, R) {
      // Rohr-Bogen aus dem Boden (umgedrehtes U) mit Ringen
      var f = ROHR_FARBEN[Math.floor(R() * ROHR_FARBEN.length)], d = u * 0.2, b = u * 0.48;
      g.lineCap = "butt"; g.strokeStyle = dunkel(f, 0.3); g.lineWidth = d * 1.15;
      g.beginPath(); g.moveTo(-b, 0); g.lineTo(-b, -u * 0.5); g.arc(0, -u * 0.5, b, Math.PI, 0); g.lineTo(b, 0); g.stroke();
      g.strokeStyle = f; g.lineWidth = d;
      g.beginPath(); g.moveTo(-b, 0); g.lineTo(-b, -u * 0.5); g.arc(0, -u * 0.5, b, Math.PI, 0); g.lineTo(b, 0); g.stroke();
      g.strokeStyle = hell(f, 0.45); g.lineWidth = d * 0.25;
      g.beginPath(); g.moveTo(-b - d * 0.2, 0); g.lineTo(-b - d * 0.2, -u * 0.5); g.arc(0, -u * 0.5, b + d * 0.2, Math.PI, Math.PI * 1.6); g.stroke();
      g.fillStyle = dunkel(f, 0.35);
      [[-b, -u * 0.15], [b, -u * 0.15], [0, -u * 0.5 - b]].forEach(function (p, i) {
        if (i < 2) g.fillRect(p[0] - d * 0.7, p[1], d * 1.4, u * 0.05); else g.fillRect(p[0] - u * 0.025, p[1] - d * 0.7, u * 0.05, d * 1.4);
      });
    } },
    rohrwirbel: { breite: 0.9, sinken: 0, male: function (g, u, R) {
      // Säule mit einer Rohr-Spirale drumherum
      var f = ROHR_FARBEN[Math.floor(R() * ROHR_FARBEN.length)], f2 = ROHR_FARBEN[Math.floor(R() * ROHR_FARBEN.length)];
      g.fillStyle = "#e9e4ff"; g.fillRect(-u * 0.04, -u * 0.95, u * 0.08, u * 0.95);
      g.lineCap = "round";
      for (var hinten = 1; hinten >= 0; hinten--) {
        g.strokeStyle = hinten ? dunkel(f, 0.35) : f; g.lineWidth = u * 0.1;
        g.beginPath();
        for (var t = 0; t <= 1; t += 0.01) {
          var w = t * Math.PI * 7, vorn = Math.cos(w) > 0;
          var px = Math.sin(w) * u * 0.32, py = -u * (0.08 + 0.82 * t);
          if (vorn === !hinten) g.lineTo(px, py); else { g.stroke(); g.beginPath(); g.moveTo(px, py); }
        }
        g.stroke();
      }
      g.fillStyle = f2; g.beginPath(); g.arc(0, -u * 0.95, u * 0.1, 0, Math.PI * 2); g.fill();
      g.fillStyle = "rgba(255,255,255,0.6)"; g.beginPath(); g.arc(-u * 0.03, -u * 0.98, u * 0.035, 0, Math.PI * 2); g.fill();
    } },
    // Datenwelt (Version 41): Mikrochip, freundlicher Roboter, Server-Schrank, Bildschirm
    chip: { breite: 1.2, sinken: 0, male: function (g, u, R) {
      var f = ["#1e2633", "#26344f", "#1d3d36", "#3a2a4f"][Math.floor(R() * 4)], b = u * 0.42, h = u * 0.78, yb = -u * 0.14;
      g.fillStyle = "#c9cfdb";                                          // Beinchen
      for (var i = 0; i < 5; i++) {
        var py = yb - h + (i + 0.5) * h / 5;
        g.fillRect(-b - u * 0.1, py - u * 0.03, u * 0.1, u * 0.06); g.fillRect(b, py - u * 0.03, u * 0.1, u * 0.06);
        g.fillRect(-b + (i + 0.5) * b * 2 / 5 - u * 0.03, yb, u * 0.06, -yb);
      }
      var gr = g.createLinearGradient(-b, yb - h, b, yb); gr.addColorStop(0, hell(f, 0.25)); gr.addColorStop(1, dunkel(f, 0.2));
      g.fillStyle = gr; g.fillRect(-b, yb - h, b * 2, h);
      g.strokeStyle = dunkel(f, 0.5); g.lineWidth = Math.max(1, u * 0.025); g.strokeRect(-b, yb - h, b * 2, h);
      g.fillStyle = "#f3c44a"; g.fillRect(-b * 0.42, yb - h * 0.71, b * 0.84, h * 0.42);  // goldener Kern
      g.strokeStyle = "#b08a1f"; g.lineWidth = Math.max(1, u * 0.015);
      for (i = 1; i < 4; i++) { g.beginPath(); g.moveTo(-b * 0.42 + i * b * 0.21, yb - h * 0.71); g.lineTo(-b * 0.42 + i * b * 0.21, yb - h * 0.29); g.stroke(); }
      g.fillStyle = "rgba(255,255,255,0.75)"; g.beginPath(); g.arc(-b * 0.72, yb - h * 0.85, u * 0.04, 0, Math.PI * 2); g.fill();   // Markierungspunkt
      if (R() < 0.5) {                                                  // manche Chips lächeln
        g.fillStyle = "#1e2c52"; g.fillRect(-b * 0.25, yb - h * 0.6, u * 0.06, u * 0.06); g.fillRect(b * 0.13, yb - h * 0.6, u * 0.06, u * 0.06);
        g.strokeStyle = "#1e2c52"; g.lineWidth = Math.max(1, u * 0.03); g.beginPath(); g.arc(0, yb - h * 0.48, u * 0.08, 0.2 * Math.PI, 0.8 * Math.PI); g.stroke();
      }
    } },
    roboter: { breite: 0.95, sinken: 0, male: function (g, u, R) {
      var f = ["#c9d2e0", "#7fb2ff", "#ffb347", "#8ee6b8"][Math.floor(R() * 4)], winkt = R() < 0.6;
      var metall = function (x, y, w, h) {
        var gr = g.createLinearGradient(x, 0, x + w, 0); gr.addColorStop(0, hell(f, 0.3)); gr.addColorStop(1, dunkel(f, 0.25));
        g.fillStyle = gr; g.fillRect(x, y, w, h); g.strokeStyle = KONTUR; g.lineWidth = Math.max(1, u * 0.02); g.strokeRect(x, y, w, h);
      };
      g.fillStyle = "#3a4152";                                           // Kettenrad unten
      g.beginPath(); g.ellipse(0, -u * 0.08, u * 0.3, u * 0.08, 0, 0, Math.PI * 2); g.fill();
      g.fillStyle = "#7d8597"; [-0.2, 0, 0.2].forEach(function (q) { g.beginPath(); g.arc(q * u, -u * 0.08, u * 0.04, 0, Math.PI * 2); g.fill(); });
      g.fillStyle = dunkel(f, 0.3); g.fillRect(-u * 0.05, -u * 0.22, u * 0.1, u * 0.08);
      g.strokeStyle = dunkel(f, 0.2); g.lineWidth = u * 0.06; g.lineCap = "round";                // Arme
      g.beginPath(); g.moveTo(-u * 0.24, -u * 0.42); g.lineTo(-u * 0.36, -u * 0.28); g.stroke();
      g.beginPath(); g.moveTo(u * 0.24, -u * 0.42);
      if (winkt) g.lineTo(u * 0.4, -u * 0.62); else g.lineTo(u * 0.36, -u * 0.28);
      g.stroke();
      g.fillStyle = dunkel(f, 0.2); g.beginPath(); g.arc(-u * 0.37, -u * 0.27, u * 0.045, 0, Math.PI * 2); g.fill();
      g.beginPath(); g.arc(u * 0.41, winkt ? -u * 0.64 : -u * 0.27, u * 0.045, 0, Math.PI * 2); g.fill();
      metall(-u * 0.24, -u * 0.52, u * 0.48, u * 0.32);                   // Bauch mit Lämpchen
      ["#e8453c", "#ffd23f", "#3cc35a"].forEach(function (c, i) { g.fillStyle = c; g.beginPath(); g.arc(-u * 0.12 + i * u * 0.12, -u * 0.36, u * 0.035, 0, Math.PI * 2); g.fill(); });
      g.fillStyle = "#3a4152"; g.fillRect(-u * 0.04, -u * 0.58, u * 0.08, u * 0.07);           // Hals
      metall(-u * 0.22, -u * 0.86, u * 0.44, u * 0.29);                   // Kopf
      g.strokeStyle = "#3a4152"; g.lineWidth = Math.max(1, u * 0.025);   // Antenne
      g.beginPath(); g.moveTo(0, -u * 0.86); g.lineTo(0, -u * 0.95); g.stroke();
      g.fillStyle = ["#e8453c", "#46f0ff", "#ffd23f"][Math.floor(R() * 3)]; g.beginPath(); g.arc(0, -u * 0.97, u * 0.035, 0, Math.PI * 2); g.fill();
      g.fillStyle = "#14203a"; g.fillRect(-u * 0.17, -u * 0.81, u * 0.34, u * 0.15);          // Gesichtsfeld
      g.fillStyle = "#46f0ff"; g.beginPath(); g.arc(-u * 0.08, -u * 0.75, u * 0.04, 0, Math.PI * 2); g.arc(u * 0.08, -u * 0.75, u * 0.04, 0, Math.PI * 2); g.fill();
      g.strokeStyle = "#46f0ff"; g.lineWidth = Math.max(1, u * 0.018);
      g.beginPath(); g.arc(0, -u * 0.72, u * 0.05, 0.2 * Math.PI, 0.8 * Math.PI); g.stroke();
    } },
    server: { breite: 0.5, sinken: 0, male: function (g, u, R) {
      var b = u * 0.22, f = "#2b3346";
      var gr = g.createLinearGradient(-b, 0, b, 0); gr.addColorStop(0, hell(f, 0.2)); gr.addColorStop(1, dunkel(f, 0.3));
      g.fillStyle = gr; g.fillRect(-b, -u, b * 2, u);
      g.strokeStyle = "#151a26"; g.lineWidth = Math.max(1, u * 0.012); g.strokeRect(-b, -u, b * 2, u);
      var n = 8, eh = (u * 0.92) / n;
      for (var i = 0; i < n; i++) {
        var y = -u * 0.96 + i * eh;
        g.fillStyle = "#1b2130"; g.fillRect(-b * 0.85, y, b * 1.7, eh * 0.8);
        g.fillStyle = "rgba(255,255,255,0.12)";
        for (var k = 0; k < 4; k++) g.fillRect(-b * 0.75 + k * b * 0.22, y + eh * 0.25, b * 0.14, eh * 0.3);
        var c = ["#3cff8a", "#46f0ff", "#46f0ff", "#ffb347", "#3cff8a"][Math.floor(R() * 5)];
        g.fillStyle = c; g.fillRect(b * 0.35, y + eh * 0.25, b * 0.14, eh * 0.3);
        if (R() < 0.5) { g.fillStyle = "#3cff8a"; g.fillRect(b * 0.58, y + eh * 0.25, b * 0.1, eh * 0.3); }
      }
    } },
    monitor: { breite: 1.1, sinken: 0, male: function (g, u, R) {
      var b = u * 0.52, h = u * 0.62, yb = -u * 0.3;
      g.fillStyle = "#7d8597"; g.fillRect(-u * 0.06, yb, u * 0.12, -yb - u * 0.05);      // Fuß
      g.fillStyle = "#5a6275"; g.fillRect(-u * 0.25, -u * 0.06, u * 0.5, u * 0.06);
      g.fillStyle = "#e9edf5"; g.fillRect(-b, yb - h, b * 2, h);                         // Rahmen
      g.strokeStyle = KONTUR; g.lineWidth = Math.max(1, u * 0.02); g.strokeRect(-b, yb - h, b * 2, h);
      var sx0 = -b * 0.86, sy0 = yb - h * 0.9, sb = b * 1.72, sh = h * 0.8;
      var gr = g.createLinearGradient(0, sy0, 0, sy0 + sh); gr.addColorStop(0, "#0d2a56"); gr.addColorStop(1, "#071630");
      g.fillStyle = gr; g.fillRect(sx0, sy0, sb, sh);
      var bild = Math.floor(R() * 3);
      if (bild === 0) {                                                   // Smiley
        g.fillStyle = "#ffd23f"; g.beginPath(); g.arc(0, sy0 + sh / 2, sh * 0.32, 0, Math.PI * 2); g.fill();
        g.fillStyle = "#1e2c52"; g.fillRect(-sh * 0.14, sy0 + sh * 0.36, sh * 0.07, sh * 0.1); g.fillRect(sh * 0.07, sy0 + sh * 0.36, sh * 0.07, sh * 0.1);
        g.strokeStyle = "#1e2c52"; g.lineWidth = Math.max(1, sh * 0.05); g.beginPath(); g.arc(0, sy0 + sh * 0.52, sh * 0.14, 0.15 * Math.PI, 0.85 * Math.PI); g.stroke();
      } else if (bild === 1) {                                            // Einsen und Nullen
        g.fillStyle = "#7dffb8"; g.font = "bold " + Math.max(6, Math.round(sh * 0.2)) + "px monospace"; g.textAlign = "left"; g.textBaseline = "top";
        for (var z = 0; z < 4; z++) { var t = ""; for (var c2 = 0; c2 < 5; c2++) t += R() < 0.5 ? "1" : "0"; g.fillText(t, sx0 + sb * 0.08, sy0 + sh * (0.06 + z * 0.23)); }
      } else {                                                            // Balkendiagramm
        ["#46f0ff", "#7dffb8", "#ffd23f", "#ff6fb5"].forEach(function (c, i) {
          var bh = sh * (0.25 + 0.55 * R()); g.fillStyle = c; g.fillRect(sx0 + sb * (0.12 + i * 0.2), sy0 + sh * 0.9 - bh, sb * 0.13, bh);
        });
      }
      g.fillStyle = "rgba(255,255,255,0.12)"; g.beginPath(); g.moveTo(sx0, sy0); g.lineTo(sx0 + sb * 0.4, sy0); g.lineTo(sx0, sy0 + sh * 0.6); g.closePath(); g.fill();
      g.fillStyle = "#3cff8a"; g.beginPath(); g.arc(b * 0.8, yb - h * 0.05, u * 0.02, 0, Math.PI * 2); g.fill();
    } }
  };

  var ROHR_FARBEN = ["#ff4f9a", "#3fc8ff", "#ffc83f", "#6fe86f", "#ff8a3f", "#b07aff"];
  /* Obstsorten: Farbe der Frucht, Laub, Größe (Anteil der Baumhöhe), Form */
  var OBST_SORTEN = [
    { name: "apfel",   farbe: "#e8453c", laub: "#4f9e3a", gr: 0.075, form: "rund" },
    { name: "birne",   farbe: "#c9d64a", laub: "#5aa845", gr: 0.08, form: "birne" },
    { name: "kirsche", farbe: "#b0122a", laub: "#3f8f3f", gr: 0.045, form: "kirsche" },
    { name: "pflaume", farbe: "#6a3d9a", laub: "#4a8f42", gr: 0.06, form: "oval" },
    { name: "orange",  farbe: "#ff9a1f", laub: "#3c8a3a", gr: 0.075, form: "rund" }
  ];
  function frucht(g, sorte, x, y, r) {
    var f = sorte.farbe;
    g.fillStyle = f;
    if (sorte.form === "kirsche") {                       // Kirschpaar am Stiel
      g.strokeStyle = "#4a6a2a"; g.lineWidth = Math.max(1, r * 0.25);
      g.beginPath(); g.moveTo(x - r * 0.8, y); g.lineTo(x, y - r * 2); g.lineTo(x + r * 0.8, y); g.stroke();
      g.beginPath(); g.arc(x - r * 0.8, y, r, 0, Math.PI * 2); g.arc(x + r * 0.8, y, r, 0, Math.PI * 2); g.fill();
    } else if (sorte.form === "birne") {
      g.beginPath(); g.arc(x, y + r * 0.3, r, 0, Math.PI * 2); g.fill();
      g.beginPath(); g.arc(x, y - r * 0.55, r * 0.62, 0, Math.PI * 2); g.fill();
    } else if (sorte.form === "oval") {
      g.beginPath(); g.ellipse(x, y, r * 0.8, r, 0.3, 0, Math.PI * 2); g.fill();
    } else {
      g.beginPath(); g.arc(x, y, r, 0, Math.PI * 2); g.fill();
    }
    g.fillStyle = "rgba(255,255,255,0.45)";
    g.beginPath(); g.arc(x - r * 0.35, y - r * 0.35, r * 0.28, 0, Math.PI * 2); g.fill();
  }

  /* Schwein (Blick nach rechts): x/y = Mitte unten, u = Höhe */
  function schweinMalen(g, u, x0, y0, R, farbe, flecken, matsch) {
    var d = dunkel(farbe, 0.18), kx = x0, ky = y0 - u * 0.5;
    g.fillStyle = d;                                                     // hintere Beine
    g.fillRect(kx - u * 0.42, ky + u * 0.12, u * 0.12, u * 0.38); g.fillRect(kx + u * 0.18, ky + u * 0.12, u * 0.12, u * 0.38);
    g.strokeStyle = d; g.lineWidth = Math.max(1, u * 0.04); g.lineCap = "round";   // Ringelschwanz
    g.beginPath(); g.moveTo(kx - u * 0.62, ky - u * 0.05);
    g.bezierCurveTo(kx - u * 0.8, ky - u * 0.12, kx - u * 0.78, ky - u * 0.28, kx - u * 0.68, ky - u * 0.22);
    g.bezierCurveTo(kx - u * 0.6, ky - u * 0.16, kx - u * 0.72, ky - u * 0.08, kx - u * 0.8, ky - u * 0.14); g.stroke();
    var gr = g.createRadialGradient(kx - u * 0.15, ky - u * 0.2, u * 0.05, kx, ky, u * 0.7);
    gr.addColorStop(0, hell(farbe, 0.25)); gr.addColorStop(1, farbe);
    g.fillStyle = gr; g.beginPath(); g.ellipse(kx, ky, u * 0.66, u * 0.36, 0, 0, Math.PI * 2); g.fill();   // Bauch
    g.strokeStyle = KONTUR; g.lineWidth = Math.max(1, u * 0.015); g.stroke();
    if (flecken) {
      g.fillStyle = "#8a5a3a";
      [[-0.25, -0.12, 0.14], [0.12, 0.05, 0.1], [-0.38, 0.1, 0.08]].forEach(function (p) { g.beginPath(); g.ellipse(kx + p[0] * u, ky + p[1] * u, p[2] * u, p[2] * u * 0.75, 0.3, 0, Math.PI * 2); g.fill(); });
    }
    if (matsch) {
      g.fillStyle = "rgba(110,72,38,0.85)";
      g.beginPath(); g.ellipse(kx - u * 0.1, ky + u * 0.26, u * 0.5, u * 0.12, 0, 0, Math.PI * 2); g.fill();
      [[-0.4, 0.05], [0.05, -0.1], [0.3, 0.12]].forEach(function (p) { g.beginPath(); g.arc(kx + p[0] * u, ky + p[1] * u, u * 0.06, 0, Math.PI * 2); g.fill(); });
    }
    g.fillStyle = farbe;                                                  // vordere Beine
    g.fillRect(kx - u * 0.3, ky + u * 0.18, u * 0.13, u * 0.32); g.fillRect(kx + u * 0.3, ky + u * 0.18, u * 0.13, u * 0.32);
    g.fillStyle = "#6a3a2a";
    [-0.3, 0.3].forEach(function (bx) { g.fillRect(kx + bx * u, ky + u * 0.44, u * 0.13, u * 0.06); });
    var hx = kx + u * 0.62, hy = ky - u * 0.12;                          // Kopf
    g.fillStyle = farbe; g.beginPath(); g.arc(hx, hy, u * 0.27, 0, Math.PI * 2); g.fill();
    g.strokeStyle = KONTUR; g.stroke();
    g.fillStyle = d;                                                      // Ohren
    g.beginPath(); g.moveTo(hx - u * 0.12, hy - u * 0.2); g.lineTo(hx - u * 0.02, hy - u * 0.42); g.lineTo(hx + u * 0.06, hy - u * 0.2); g.closePath(); g.fill();
    g.beginPath(); g.moveTo(hx + u * 0.06, hy - u * 0.22); g.lineTo(hx + u * 0.2, hy - u * 0.4); g.lineTo(hx + u * 0.22, hy - u * 0.16); g.closePath(); g.fill();
    g.fillStyle = hell(d, 0.1); g.beginPath(); g.ellipse(hx + u * 0.26, hy + u * 0.06, u * 0.09, u * 0.12, 0, 0, Math.PI * 2); g.fill();   // Rüssel
    g.strokeStyle = KONTUR; g.stroke();
    g.fillStyle = "#6a2a3a";
    g.beginPath(); g.arc(hx + u * 0.24, hy + u * 0.02, u * 0.022, 0, Math.PI * 2); g.arc(hx + u * 0.28, hy + u * 0.1, u * 0.022, 0, Math.PI * 2); g.fill();
    g.fillStyle = "#1e1e2a"; g.beginPath(); g.arc(hx + u * 0.08, hy - u * 0.06, u * 0.035, 0, Math.PI * 2); g.fill();   // Auge
    g.fillStyle = "#ffffff"; g.beginPath(); g.arc(hx + u * 0.09, hy - u * 0.07, u * 0.012, 0, Math.PI * 2); g.fill();
    g.fillStyle = "rgba(255,90,120,0.35)"; g.beginPath(); g.arc(hx + u * 0.02, hy + u * 0.1, u * 0.06, 0, Math.PI * 2); g.fill();   // Bäckchen
  }

  /* Klemmbaustein: x, y = oben links (y nach oben negativ), b × h, mit Noppen obendrauf */
  function bausteinR(g, x, y, b, h, farbe, u) {
    g.fillStyle = farbe; g.fillRect(x, y, b, h);
    g.fillStyle = "rgba(255,255,255,0.25)"; g.fillRect(x, y, b, h * 0.25);
    g.fillStyle = "rgba(0,0,0,0.18)"; g.fillRect(x, y + h * 0.82, b, h * 0.18);
    var n = Math.max(1, Math.round(b / (u * 0.1)));
    g.fillStyle = farbe;
    for (var k = 0; k < n; k++) g.fillRect(x + (k + 0.25) * b / n, y - h * 0.22, b / n * 0.5, h * 0.22);
    g.strokeStyle = "rgba(0,0,0,0.25)"; g.lineWidth = Math.max(1, u * 0.008); g.strokeRect(x, y, b, h);
  }

  function rundRechteckG(g, x, y, w, h, r) {
    g.beginPath(); g.moveTo(x + r, y); g.lineTo(x + w - r, y); g.quadraticCurveTo(x + w, y, x + w, y + r);
    g.lineTo(x + w, y + h - r); g.quadraticCurveTo(x + w, y + h, x + w - r, y + h); g.lineTo(x + r, y + h);
    g.quadraticCurveTo(x, y + h, x, y + h - r); g.lineTo(x, y + r); g.quadraticCurveTo(x, y, x + r, y); g.closePath();
  }

  function tanneMalen(g, u, R, schnee) {
    var f = ["#2f6b3f", "#2a5f3a", "#36734a"][Math.floor(R() * 3)];
    g.fillStyle = "#5a3d28"; g.fillRect(-u * 0.04, -u * 0.16, u * 0.08, u * 0.16);
    var stufen = 4 + Math.floor(R() * 2);
    for (var i = 0; i < stufen; i++) {
      var t = i / stufen, y0 = -u * (0.1 + 0.8 * t), b = u * 0.3 * (1 - t * 0.7) * (0.9 + 0.2 * R()), h = u * 0.3;
      g.beginPath(); g.moveTo(-b, y0);
      for (var z = 1; z <= 4; z++) g.lineTo(-b + b * 2 * z / 4 - b * 0.12 * (z % 2), y0 + u * 0.03 * (z % 2));
      g.lineTo(0, y0 - h); g.closePath();
      var gr = g.createLinearGradient(-b, 0, b, 0);
      gr.addColorStop(0, hell(f, 0.12)); gr.addColorStop(1, dunkel(f, 0.3));
      g.fillStyle = gr; g.fill();
      if (schnee) {
        g.fillStyle = "#f4f8ff";
        g.beginPath(); g.moveTo(-b * 0.55, y0 - h * 0.45); g.quadraticCurveTo(0, y0 - h * 0.3, b * 0.55, y0 - h * 0.45); g.lineTo(0, y0 - h); g.closePath(); g.fill();
      }
    }
  }

  /* Dinosaurier (Seitenansicht, Blick nach rechts): Brachiosaurus, Stegosaurus,
     Triceratops, T-Rex – Farbe je Variante */
  var DINO_FARBEN = [["#6f9a5a", "#e8d9a8"], ["#8a7a5a", "#e2d3b0"], ["#5f8a8a", "#d8e6d0"], ["#9a6a4a", "#efd9b8"], ["#7a8a4a", "#e6e0a8"]];
  function dinoFarbe(g, v, y0, y1) {
    var p = DINO_FARBEN[Math.floor(v / 4) % DINO_FARBEN.length], gr = g.createLinearGradient(0, y0, 0, y1);
    gr.addColorStop(0, hell(p[0], 0.12)); gr.addColorStop(0.65, p[0]); gr.addColorStop(1, mische(p[0], p[1], 0.5));
    return { fuell: gr, basis: p[0], bauch: p[1] };
  }
  function auge(g, x, y, r) {
    g.fillStyle = "#ffffff"; g.beginPath(); g.arc(x, y, r, 0, Math.PI * 2); g.fill();
    g.fillStyle = "#1e1e2a"; g.beginPath(); g.arc(x + r * 0.25, y, r * 0.55, 0, Math.PI * 2); g.fill();
  }
  function bein(g, x, y, b, h, farbe) {
    g.fillStyle = farbe; g.beginPath();
    g.moveTo(x - b, y); g.quadraticCurveTo(x - b * 1.1, y + h * 0.5, x - b * 0.8, y + h); g.lineTo(x + b * 1.0, y + h);
    g.quadraticCurveTo(x + b * 1.1, y + h * 0.5, x + b, y); g.closePath(); g.fill();
  }
  var DINOS = [
    function brachio(g, u, R, v) {                // langer Hals, hoch
      var F = dinoFarbe(g, v, -u, 0), d = dunkel(F.basis, 0.25);
      bein(g, -u * 0.32, -u * 0.38, u * 0.07, u * 0.38, d); bein(g, u * 0.18, -u * 0.42, u * 0.07, u * 0.42, d);
      g.fillStyle = F.fuell; g.beginPath();
      g.moveTo(-u * 0.85, -u * 0.32);                                         // Schwanzspitze
      g.quadraticCurveTo(-u * 0.6, -u * 0.38, -u * 0.45, -u * 0.5);
      g.quadraticCurveTo(-u * 0.1, -u * 0.72, u * 0.28, -u * 0.6);           // Rücken
      g.quadraticCurveTo(u * 0.42, -u * 0.75, u * 0.5, -u * 0.95);           // Hals hoch
      g.quadraticCurveTo(u * 0.56, -u * 1.02, u * 0.66, -u * 0.98);          // Kopf
      g.quadraticCurveTo(u * 0.72, -u * 0.95, u * 0.66, -u * 0.92);
      g.quadraticCurveTo(u * 0.58, -u * 0.9, u * 0.56, -u * 0.86);
      g.quadraticCurveTo(u * 0.44, -u * 0.62, u * 0.32, -u * 0.42);          // Halsunterseite
      g.quadraticCurveTo(u * 0.0, -u * 0.32, -u * 0.4, -u * 0.38);           // Bauch
      g.quadraticCurveTo(-u * 0.6, -u * 0.34, -u * 0.85, -u * 0.32);
      g.fill(); g.strokeStyle = KONTUR; g.lineWidth = Math.max(1, u * 0.012); g.stroke();
      bein(g, -u * 0.22, -u * 0.38, u * 0.075, u * 0.38, F.basis); bein(g, u * 0.28, -u * 0.44, u * 0.075, u * 0.44, F.basis);
      flecken(g, u, R, -u * 0.3, -u * 0.55, u * 0.4, dunkel(F.basis, 0.18));
      auge(g, u * 0.62, -u * 0.96, u * 0.018);
    },
    function stego(g, u, R, v) {                  // Rückenplatten
      var F = dinoFarbe(g, v, -u * 0.9, 0), d = dunkel(F.basis, 0.25);
      // Platten
      for (var i = 0; i < 6; i++) {
        var x = -u * 0.45 + i * u * 0.15, h = u * (0.16 + 0.12 * Math.sin(Math.PI * (i + 0.5) / 6)), y = -u * 0.62 - Math.sin(Math.PI * (i + 0.5) / 6) * u * 0.12;
        g.fillStyle = i % 2 ? "#c9603a" : "#d9763a";
        g.beginPath(); g.moveTo(x - u * 0.07, y + u * 0.04); g.lineTo(x, y - h); g.lineTo(x + u * 0.07, y + u * 0.04); g.closePath(); g.fill();
      }
      bein(g, -u * 0.28, -u * 0.3, u * 0.07, u * 0.3, d); bein(g, u * 0.18, -u * 0.28, u * 0.06, u * 0.28, d);
      g.fillStyle = F.fuell; g.beginPath();
      g.moveTo(-u * 0.95, -u * 0.36);
      g.quadraticCurveTo(-u * 0.5, -u * 0.5, -u * 0.35, -u * 0.62);
      g.quadraticCurveTo(-u * 0.05, -u * 0.82, u * 0.25, -u * 0.55);
      g.quadraticCurveTo(u * 0.42, -u * 0.42, u * 0.52, -u * 0.36);          // Kopf klein, tief
      g.quadraticCurveTo(u * 0.62, -u * 0.32, u * 0.55, -u * 0.27);
      g.quadraticCurveTo(u * 0.4, -u * 0.26, u * 0.25, -u * 0.32);
      g.quadraticCurveTo(-u * 0.05, -u * 0.25, -u * 0.4, -u * 0.32);
      g.quadraticCurveTo(-u * 0.7, -u * 0.32, -u * 0.95, -u * 0.36);
      g.fill(); g.strokeStyle = KONTUR; g.lineWidth = Math.max(1, u * 0.012); g.stroke();
      g.fillStyle = "#e6e0c8";                                               // Schwanzstacheln
      [[-0.88, -0.38], [-0.8, -0.4]].forEach(function (p) { g.beginPath(); g.moveTo(p[0] * u, p[1] * u); g.lineTo((p[0] - 0.06) * u, (p[1] - 0.12) * u); g.lineTo((p[0] + 0.03) * u, p[1] * u); g.fill(); });
      bein(g, -u * 0.18, -u * 0.3, u * 0.075, u * 0.3, F.basis); bein(g, u * 0.26, -u * 0.3, u * 0.065, u * 0.3, F.basis);
      flecken(g, u, R, -u * 0.1, -u * 0.5, u * 0.35, dunkel(F.basis, 0.18));
      auge(g, u * 0.5, -u * 0.34, u * 0.018);
    },
    function trice(g, u, R, v) {                  // Nackenschild und Hörner
      var F = dinoFarbe(g, v, -u * 0.8, 0), d = dunkel(F.basis, 0.25);
      bein(g, -u * 0.32, -u * 0.32, u * 0.08, u * 0.32, d); bein(g, u * 0.15, -u * 0.3, u * 0.08, u * 0.3, d);
      g.fillStyle = F.fuell; g.beginPath();
      g.moveTo(-u * 0.9, -u * 0.38);
      g.quadraticCurveTo(-u * 0.55, -u * 0.48, -u * 0.35, -u * 0.62);
      g.quadraticCurveTo(-u * 0.0, -u * 0.78, u * 0.22, -u * 0.58);
      g.lineTo(u * 0.3, -u * 0.38); g.quadraticCurveTo(u * 0.0, -u * 0.26, -u * 0.4, -u * 0.32);
      g.quadraticCurveTo(-u * 0.65, -u * 0.34, -u * 0.9, -u * 0.38);
      g.fill(); g.strokeStyle = KONTUR; g.lineWidth = Math.max(1, u * 0.012); g.stroke();
      // Nackenschild
      g.fillStyle = dunkel(F.basis, 0.08); g.beginPath(); g.ellipse(u * 0.3, -u * 0.6, u * 0.13, u * 0.22, -0.4, 0, Math.PI * 2); g.fill();
      g.strokeStyle = "#c9603a"; g.lineWidth = Math.max(1, u * 0.02); g.stroke();
      // Kopf mit Schnabel
      g.fillStyle = F.fuell; g.beginPath();
      g.moveTo(u * 0.28, -u * 0.62); g.quadraticCurveTo(u * 0.5, -u * 0.6, u * 0.6, -u * 0.42);
      g.lineTo(u * 0.66, -u * 0.36); g.quadraticCurveTo(u * 0.5, -u * 0.3, u * 0.3, -u * 0.36); g.closePath(); g.fill(); g.strokeStyle = KONTUR; g.stroke();
      g.fillStyle = "#f2ead2";                                               // Hörner
      [[0.38, -0.58, 0.58, -0.82], [0.48, -0.52, 0.72, -0.7], [0.6, -0.44, 0.7, -0.52]].forEach(function (h) {
        g.beginPath(); g.moveTo(h[0] * u, h[1] * u); g.quadraticCurveTo((h[0] + 0.1) * u, (h[1] - 0.05) * u, h[2] * u, h[3] * u); g.lineTo((h[0] + 0.06) * u, (h[1] + 0.03) * u); g.closePath(); g.fill();
      });
      bein(g, -u * 0.22, -u * 0.32, u * 0.085, u * 0.32, F.basis); bein(g, u * 0.22, -u * 0.32, u * 0.08, u * 0.32, F.basis);
      flecken(g, u, R, -u * 0.25, -u * 0.5, u * 0.35, dunkel(F.basis, 0.18));
      auge(g, u * 0.47, -u * 0.5, u * 0.02);
    },
    function trex(g, u, R, v) {                   // aufrecht, großer Kopf, kleine Arme
      var F = dinoFarbe(g, v, -u, 0), d = dunkel(F.basis, 0.25);
      bein(g, -u * 0.12, -u * 0.42, u * 0.08, u * 0.42, d);
      g.fillStyle = F.fuell; g.beginPath();
      g.moveTo(-u * 0.9, -u * 0.52);                                         // Schwanz
      g.quadraticCurveTo(-u * 0.5, -u * 0.6, -u * 0.25, -u * 0.72);
      g.quadraticCurveTo(u * 0.0, -u * 0.86, u * 0.18, -u * 0.88);           // Rücken zum Kopf
      g.lineTo(u * 0.5, -u * 0.9); g.quadraticCurveTo(u * 0.58, -u * 0.86, u * 0.56, -u * 0.78);   // Schnauze oben
      g.lineTo(u * 0.36, -u * 0.74); g.lineTo(u * 0.52, -u * 0.7); g.quadraticCurveTo(u * 0.5, -u * 0.64, u * 0.3, -u * 0.64);   // Maul
      g.quadraticCurveTo(u * 0.18, -u * 0.6, u * 0.12, -u * 0.5);            // Hals/Brust
      g.quadraticCurveTo(u * 0.02, -u * 0.36, -u * 0.25, -u * 0.44);
      g.quadraticCurveTo(-u * 0.55, -u * 0.5, -u * 0.9, -u * 0.52);
      g.fill(); g.strokeStyle = KONTUR; g.lineWidth = Math.max(1, u * 0.012); g.stroke();
      g.fillStyle = "#ffffff";                                               // Zähnchen
      for (var i = 0; i < 4; i++) { g.beginPath(); g.moveTo(u * (0.38 + i * 0.04), -u * 0.74); g.lineTo(u * (0.4 + i * 0.04), -u * 0.715); g.lineTo(u * (0.42 + i * 0.04), -u * 0.74); g.fill(); }
      g.strokeStyle = F.basis; g.lineWidth = u * 0.03; g.lineCap = "round";  // Ärmchen
      g.beginPath(); g.moveTo(u * 0.12, -u * 0.56); g.lineTo(u * 0.2, -u * 0.5); g.lineTo(u * 0.24, -u * 0.53); g.stroke();
      bein(g, -u * 0.02, -u * 0.44, u * 0.09, u * 0.44, F.basis);
      flecken(g, u, R, -u * 0.35, -u * 0.6, u * 0.3, dunkel(F.basis, 0.18));
      auge(g, u * 0.36, -u * 0.83, u * 0.022);
    }
  ];
  function flecken(g, u, R, x, y, b, farbe) {
    g.fillStyle = farbe; g.globalAlpha = 0.45;
    for (var i = 0; i < 5; i++) { g.beginPath(); g.ellipse(x + (R() - 0.5) * b, y + (R() - 0.5) * b * 0.25, u * (0.02 + 0.025 * R()), u * 0.015, 0, 0, Math.PI * 2); g.fill(); }
    g.globalAlpha = 1;
  }

  /* ---------------------------------------------------------------------------
     Bild-Zwischenspeicher
     --------------------------------------------------------------------------- */
  var VARIANTEN = { dino: 12, riesenblume: 6, glasskulptur: 6, obstbaum: 10, obstkiste: 5 };   // Dinos: 4 Arten × 3 Farben, Blumen 3 Arten × 2, sonst 4 Varianten
  var cache = {}, anzahl = 0;
  function sprite(typ, variante, px, q) {
    var M = MALER[typ];
    q = q || 1;
    var nV = VARIANTEN[typ] || 4, v = variante % nV;
    var key = typ + "|" + v + "|" + px + "|" + q, c = cache[key];
    if (c) return c;
    if (++anzahl > 600) { cache = {}; anzahl = 1; }           // Speicher begrenzen (Zoomstufen)
    var hP = px * q, breite = M.breite * (typ === "dino" && v % 4 === 0 ? 1.0 : 1);
    c = document.createElement("canvas");
    c.width = Math.ceil(hP * breite * 1.15) + 4; c.height = Math.ceil(hP * 1.12) + 4;
    var g = c.getContext("2d");
    g.translate(c.width / 2, c.height - 2 - hP * 0.02);
    M.male(g, hP, zufall(v * 7919 + typ.length * 104729 + typ.charCodeAt(0) * 31), v);
    c.sinken = M.sinken;
    cache[key] = c;
    return c;
  }

  /* An Weltposition zeichnen: x/y = Bildschirmpunkt am Boden (CSS-Pixel), px = Höhe */
  /* Größenstufe zum Vormalen: die nächste Stufe (×1,25) ÜBER der gewünschten Höhe.
     Gezeichnet wird dann stufenlos verkleinert – so springt beim Zoomen (Tempo)
     nichts, und es muss trotzdem kaum je neu gemalt werden. */
  function stufe(px) { return Math.max(8, Math.ceil(Math.pow(1.25, Math.ceil(Math.log(Math.max(1, px)) / Math.log(1.25))) / 4) * 4); }

  function zeichne(ctx, typ, variante, x, y, px, spiegeln, q) {
    var st = stufe(px), c = sprite(typ, variante, st, q), f = px / st;
    ctx.save();
    var KO = FF.Grafik && FF.Grafik.KOPF, yy = y + px * c.sinken;
    if (KO && KO.f !== 1) ctx.setTransform(spiegeln ? -f : f, 0, 0, f * KO.f, x * q, (KO.h / 2 + KO.f * (yy - KO.h / 2)) * q);   // Kopfüberwelt
    else ctx.setTransform(spiegeln ? -f : f, 0, 0, f, x * q, yy * q);
    ctx.drawImage(c, -c.width / 2, -c.height + 2);
    ctx.restore();
  }

  /* Breite einer Requisite im Verhältnis zur Höhe (für den Stand am Hang) */
  function breite(typ) { var M = MALER[typ]; return M ? M.breite : 1; }

  FF.Requisiten = { zeichne: zeichne, sprite: sprite, breite: breite, stufe: stufe, arten: Object.keys(MALER), varianten: function (t) { return VARIANTEN[t] || 4; } };
})();
