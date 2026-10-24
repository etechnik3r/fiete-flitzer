/* ===========================================================================
   Fiete Flitzer – grafik.js
   ---------------------------------------------------------------------------
   Alles, was auf den Canvas gezeichnet wird: Himmel, Parallax-Berge,
   Strecke, Münzen, Kanister, Fahrzeuge mit Fiete, Partikel, Wetter,
   Kräfte-Pfeile und die Rundinstrumente (Tacho + Drehzahl).

   Welt-Koordinaten in Metern (y nach oben). Die Kamera rechnet um:
     sx = b·ankerX + (x − kam.x)·s      sy = h·ankerY − (y − kam.y)·s
   Fahrzeuge werden in ihren eigenen Koordinaten gezeichnet (Meter, y oben,
   Ursprung = Schwerpunkt) – dafür wird der Canvas passend verschoben,
   gedreht und mit (s, −s) skaliert.

   ASSETS TAUSCHEN: Jedes Fahrzeug hat eine eigene zeichne…-Funktion im
   Abschnitt 5; dort lassen sich auch Bilder per drawImage() einsetzen.
   =========================================================================== */

var FF = globalThis.FF = globalThis.FF || {};

(function () {
  "use strict";

  var TINTE = "#1e2c52";
  var REIFEN = "#2b2f3a";
  var FELGE = "#d9deea";
  // Fiete: blond, braune Augen, helle Haut (Kleidung: CONFIG.outfits)
  var HAUT = "#ffdcc4", HAUT_RAND = "#d99b78";

  /* =========================================================================
     1) HELFER: Farben, Emoji-Sprites, Formen
     ========================================================================= */
  function hexZuRgb(hex) {
    var h = hex.replace("#", "");
    if (h.length === 3) h = h[0] + h[0] + h[1] + h[1] + h[2] + h[2];
    var n = parseInt(h, 16);
    return [(n >> 16) & 255, (n >> 8) & 255, n & 255];
  }
  function rgbZuHex(r, g, b) {
    return "#" + [r, g, b].map(function (v) {
      v = Math.max(0, Math.min(255, Math.round(v)));
      return (v < 16 ? "0" : "") + v.toString(16);
    }).join("");
  }
  function mische(hex, ziel, f) {
    var a = hexZuRgb(hex), b = hexZuRgb(ziel);
    return rgbZuHex(a[0] + (b[0] - a[0]) * f, a[1] + (b[1] - a[1]) * f, a[2] + (b[2] - a[2]) * f);
  }
  function hell(hex, f) { return mische(hex, "#ffffff", f); }
  function dunkel(hex, f) { return mische(hex, "#000000", f); }

  // Emojis einmal in ein kleines Canvas rendern, danach nur kopieren (schnell!).
  // q = Gerätepixel je CSS-Pixel (Retina: 2) → scharfe Emojis.
  var spriteCache = {};
  function emojiSprite(emoji, px, q) {
    q = q || 1;
    px = Math.max(8, Math.round(px / 4) * 4);
    var key = emoji + "|" + px + "|" + q;
    var c = spriteCache[key];
    if (c) return c;
    c = document.createElement("canvas");
    c.width = c.height = Math.ceil(px * q * 1.3);
    var g = c.getContext("2d");
    g.font = px * q + "px 'Apple Color Emoji','Segoe UI Emoji','Noto Color Emoji',sans-serif";
    g.textAlign = "center"; g.textBaseline = "middle";
    g.fillText(emoji, c.width / 2, c.height / 2 + px * q * 0.06);
    spriteCache[key] = c;
    return c;
  }
  /* Pixelgenau in Gerätepixeln kopieren: ohne Drehen und Skalieren nimmt der
     Browser den schnellen Kopierweg (gemessen: spart bei langsamen Geräten
     ein Sechstel der Bildzeit). Erwartet ctx nur mit q skaliert (zeichneSzene). */
  function zeichneEmoji(ctx, emoji, x, y, px, spiegeln, q) {
    var c = emojiSprite(emoji, px, q);
    ctx.save();
    ctx.setTransform(spiegeln ? -1 : 1, 0, 0, 1, Math.round(x * q), Math.round(y * q));
    ctx.drawImage(c, -(c.width >> 1), -(c.height >> 1));
    ctx.restore();
  }

  function rundRechteck(ctx, x, y, w, h, r) {
    r = Math.min(r, Math.abs(w) / 2, Math.abs(h) / 2);
    ctx.beginPath();
    ctx.moveTo(x + r, y);
    ctx.lineTo(x + w - r, y);
    ctx.quadraticCurveTo(x + w, y, x + w, y + r);
    ctx.lineTo(x + w, y + h - r);
    ctx.quadraticCurveTo(x + w, y + h, x + w - r, y + h);
    ctx.lineTo(x + r, y + h);
    ctx.quadraticCurveTo(x, y + h, x, y + h - r);
    ctx.lineTo(x, y + r);
    ctx.quadraticCurveTo(x, y, x + r, y);
    ctx.closePath();
  }

  function stern(ctx, x, y, r, zacken, innen) {
    ctx.beginPath();
    for (var i = 0; i < zacken * 2; i++) {
      var rr = i % 2 ? r * (innen || 0.45) : r;
      var a = -Math.PI / 2 + i * Math.PI / zacken;
      ctx.lineTo(x + Math.cos(a) * rr, y + Math.sin(a) * rr);
    }
    ctx.closePath();
  }

  /* Text in einem y-oben-Koordinatensystem richtig herum zeichnen */
  function textLokal(ctx, text, x, y, groesse, farbe, fett) {
    ctx.save();
    ctx.translate(x, y);
    ctx.scale(0.01, -0.01);            // winzige Schriftgrößen vermeiden (Meter → 1/100)
    ctx.font = (fett ? "800 " : "700 ") + Math.round(groesse * 100) + "px 'Baloo 2', sans-serif";
    ctx.textAlign = "center"; ctx.textBaseline = "middle";
    ctx.fillStyle = farbe;
    ctx.fillText(text, 0, 0);
    ctx.restore();
  }

  /* =========================================================================
     2) KAMERA
     ========================================================================= */
  function sx(K, x) { return K.b * K.ankerX + (x - K.x) * K.s; }
  function sy(K, y) { return K.h * K.ankerY - (y - K.y) * K.s; }
  function weltX(K, px) { return K.x + (px - K.b * K.ankerX) / K.s; }

  /* =========================================================================
     3) HIMMEL, SONNE, WOLKEN, BERGE
     ========================================================================= */
  /* Himmelsverlauf: entweder hier gemalt oder – schneller – als CSS-Hintergrund
     hinter dem durchsichtigen Canvas (himmelPerCss, siehe himmelCss()). */
  function himmelCss(welt) {
    return "linear-gradient(" + welt.farben.himmel[0] + ", " + welt.farben.himmel[1] + ")";
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
      // freundliches Gesicht
      ctx.fillStyle = "#8a5a00";
      ctx.beginPath(); ctx.arc(x - r * 0.32, y - r * 0.12, r * 0.09, 0, Math.PI * 2); ctx.fill();
      ctx.beginPath(); ctx.arc(x + r * 0.32, y - r * 0.12, r * 0.09, 0, Math.PI * 2); ctx.fill();
      ctx.strokeStyle = "#8a5a00"; ctx.lineWidth = r * 0.08; ctx.lineCap = "round";
      ctx.beginPath(); ctx.arc(x, y + r * 0.05, r * 0.38, 0.2 * Math.PI, 0.8 * Math.PI); ctx.stroke();
      ctx.fillStyle = "rgba(255,120,120,0.45)";
      ctx.beginPath(); ctx.arc(x - r * 0.55, y + r * 0.2, r * 0.13, 0, Math.PI * 2); ctx.fill();
      ctx.beginPath(); ctx.arc(x + r * 0.55, y + r * 0.2, r * 0.13, 0, Math.PI * 2); ctx.fill();
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

  function zeichneWolken(ctx, K, welt, zeit) {
    if (welt.sonne === "erde") return;
    var breite = K.b + 400;
    var farbe = welt.id === "vulkan" ? "rgba(120,90,100,0.55)" : "rgba(255,255,255,0.85)";
    for (var i = 0; i < 6; i++) {
      var basis = i * 337 + 60;
      var x = ((basis - K.x * K.s * 0.06 + zeit * 8 * (1 + i % 3 * 0.3)) % breite + breite) % breite - 200;
      var y = K.h * (0.08 + (i * 0.137) % 0.3);
      var w = 60 + (i * 53) % 70;
      ctx.fillStyle = farbe;
      ctx.beginPath();
      ctx.ellipse(x, y, w * 0.5, w * 0.22, 0, 0, Math.PI * 2);
      ctx.ellipse(x - w * 0.22, y - w * 0.08, w * 0.24, w * 0.2, 0, 0, Math.PI * 2);
      ctx.ellipse(x + w * 0.15, y - w * 0.14, w * 0.28, w * 0.24, 0, 0, Math.PI * 2);
      ctx.fill();
    }
  }

  function zeichneBerge(ctx, K, welt) {
    var f = welt.farben, ebenen = [[0.12, f.berge[0], 0.5, 120, 11], [0.28, f.berge[1], 0.62, 70, 23]];
    for (var e = 0; e < ebenen.length; e++) {
      var fak = ebenen[e][0], farbe = ebenen[e][1], basisY = ebenen[e][2], welle = ebenen[e][3], seed = ebenen[e][4];
      var yVersatz = Math.max(-K.h * 0.25, Math.min(K.h * 0.25, (K.y - 5) * K.s * fak * 0.5));
      ctx.fillStyle = farbe;
      ctx.beginPath();
      ctx.moveTo(0, K.h);
      for (var px = 0; px <= K.b + 20; px += 16) {
        var wx = K.x * fak + (px - K.b / 2) / K.s;
        var n = FF.rauschen(wx / (welle / 10), seed) + 0.5 * FF.rauschen(wx / (welle / 25), seed + 5);
        var y = K.h * basisY - n * K.h * 0.12 + yVersatz;
        ctx.lineTo(px, y);
      }
      ctx.lineTo(K.b, K.h);
      ctx.closePath();
      ctx.fill();
    }
  }

  /* =========================================================================
     4) STRECKE, DEKO, SCHILDER, MÜNZEN, KANISTER, ZIEL
     ========================================================================= */
  function sichtbereich(K, gel) {
    var x0 = weltX(K, -60), x1 = weltX(K, K.b + 60);
    var i0 = Math.max(0, Math.floor((x0 - gel.x0) / gel.dx));
    var i1 = Math.min(gel.h.length - 1, Math.ceil((x1 - gel.x0) / gel.dx));
    return [i0, i1, x0, x1];
  }

  function zeichneDeko(ctx, K, gel, x0, x1, q) {
    var D = gel.deko;
    for (var i = 0; i < D.length; i++) {
      var d = D[i];
      if (d.x < x0 - 3 || d.x > x1 + 3) continue;
      var px = d.groesse * K.s;
      zeichneEmoji(ctx, d.emoji, sx(K, d.x), sy(K, d.y) - px * 0.42, px, d.spiegeln, q);
    }
  }

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
    ctx.fill();

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
    if (stil === "wiese" || stil === "dschungel") {
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
    } else if (stil === "mond") {
      for (i = i0 - (i0 % 11); i <= i1; i += 11) {
        var g2 = FF.rauschen(i * 0.37, 9) * 0.5 + 0.5;
        X = sx(K, x0 + i * dx); Y = sy(K, h[i] - 0.9 - g2 * 1.5);
        ctx.fillStyle = "rgba(0,0,0,0.12)";
        ctx.beginPath(); ctx.ellipse(X, Y, (0.4 + g2 * 0.5) * K.s, (0.25 + g2 * 0.25) * K.s, 0, 0, Math.PI * 2); ctx.fill();
      }
    }
  }

  function zeichneSchilder(ctx, K, gel, x0, x1) {
    for (var i = 0; i < gel.schilder.length; i++) {
      var s = gel.schilder[i];
      if (s.x < x0 - 2 || s.x > x1 + 2) continue;
      var X = sx(K, s.x), Y = sy(K, s.y);
      ctx.fillStyle = "#8a5a2b";
      ctx.fillRect(X - 0.05 * K.s, Y - 1.3 * K.s, 0.1 * K.s, 1.3 * K.s);
      rundRechteck(ctx, X - 0.6 * K.s, Y - 1.75 * K.s, 1.2 * K.s, 0.55 * K.s, 0.1 * K.s);
      ctx.fillStyle = "#c98b4a"; ctx.fill();
      ctx.strokeStyle = "#7a4a1f"; ctx.lineWidth = Math.max(1, 0.05 * K.s); ctx.stroke();
      ctx.fillStyle = "#fff8e6";
      ctx.font = "800 " + Math.round(0.36 * K.s) + "px 'Baloo 2', sans-serif";
      ctx.textAlign = "center"; ctx.textBaseline = "middle";
      ctx.fillText(s.text, X, Y - 1.46 * K.s);
    }
  }

  function zeichneStartZiel(ctx, K, gel, zeit) {
    // Startlinie
    var X = sx(K, 0), Y = sy(K, gel.hoeheBei(0));
    if (X > -50 && X < K.b + 50) karoStreifen(ctx, X, Y, K.s);
    if (!isFinite(gel.ziel)) return;
    var zx = gel.ziel;
    X = sx(K, zx);
    if (X < -6 * K.s || X > K.b + 6 * K.s) return;
    Y = sy(K, gel.hoeheBei(zx));
    karoStreifen(ctx, X, Y, K.s);
    // Zielbogen mit Banner
    var s = K.s, links = X - 1.8 * s, rechts = X + 1.8 * s, oben = Y - 4.2 * s;
    ctx.fillStyle = "#ffffff"; ctx.strokeStyle = TINTE; ctx.lineWidth = Math.max(1, 0.06 * s);
    [links, rechts].forEach(function (px) {
      rundRechteck(ctx, px - 0.12 * s, oben, 0.24 * s, Y - oben, 0.08 * s);
      ctx.fill(); ctx.stroke();
    });
    rundRechteck(ctx, links - 0.3 * s, oben - 0.2 * s, rechts - links + 0.6 * s, 1.0 * s, 0.25 * s);
    ctx.fillStyle = "#28c08a"; ctx.fill(); ctx.stroke();
    ctx.fillStyle = "#ffffff";
    ctx.font = "800 " + Math.round(0.7 * s) + "px 'Baloo 2', sans-serif";
    ctx.textAlign = "center"; ctx.textBaseline = "middle";
    ctx.fillText("ZIEL", X, oben + 0.32 * s);
    // Luftballons
    var bf = ["#ff5b5b", "#ffd23f", "#2f6fd6", "#ff6fb5"];
    for (var i = 0; i < 4; i++) {
      var bx = (i < 2 ? links : rechts) + (i % 2 ? 0.35 : -0.35) * s;
      var by = oben - (0.9 + (i % 2) * 0.4) * s + Math.sin(zeit * 2 + i) * 0.1 * s;
      ctx.strokeStyle = "rgba(30,44,82,0.5)"; ctx.lineWidth = 1;
      ctx.beginPath(); ctx.moveTo(bx, by + 0.45 * s); ctx.lineTo((i < 2 ? links : rechts), oben); ctx.stroke();
      ctx.fillStyle = bf[i];
      ctx.beginPath(); ctx.ellipse(bx, by, 0.36 * s, 0.45 * s, 0, 0, Math.PI * 2); ctx.fill();
      ctx.fillStyle = "rgba(255,255,255,0.5)";
      ctx.beginPath(); ctx.ellipse(bx - 0.12 * s, by - 0.15 * s, 0.08 * s, 0.13 * s, -0.4, 0, Math.PI * 2); ctx.fill();
    }
  }

  function karoStreifen(ctx, X, Y, s) {
    var q = 0.2 * s;
    for (var r = 0; r < 2; r++) for (var c = 0; c < 3; c++) {
      ctx.fillStyle = (r + c) % 2 ? "#ffffff" : TINTE;
      ctx.fillRect(X - 1.5 * q + c * q, Y - 0.05 * s + r * q, q, q);
    }
  }

  function zeichneMuenze(ctx, X, Y, s, wert, zeit, phase) {
    var dreh = Math.cos(zeit * 3 + phase);
    var sxf = Math.max(0.15, Math.abs(dreh));
    var r = (wert >= 100 ? 0.5 : wert >= 25 ? 0.44 : wert >= 10 ? 0.38 : 0.32) * s;
    ctx.save();
    ctx.translate(X, Y);
    if (wert >= 100) {
      // blauer Diamant
      ctx.scale(sxf, 1);
      ctx.beginPath();
      ctx.moveTo(0, -r); ctx.lineTo(r * 0.85, -r * 0.25); ctx.lineTo(0, r); ctx.lineTo(-r * 0.85, -r * 0.25); ctx.closePath();
      ctx.fillStyle = "#4fc3ff"; ctx.fill();
      ctx.strokeStyle = "#1d6fb8"; ctx.lineWidth = Math.max(1, r * 0.12); ctx.stroke();
      ctx.fillStyle = "rgba(255,255,255,0.65)";
      ctx.beginPath(); ctx.moveTo(-r * 0.4, -r * 0.45); ctx.lineTo(0, -r * 0.8); ctx.lineTo(r * 0.1, -r * 0.3); ctx.closePath(); ctx.fill();
    } else {
      ctx.scale(sxf, 1);
      ctx.beginPath(); ctx.arc(0, 0, r, 0, Math.PI * 2);
      ctx.fillStyle = wert >= 25 ? "#ffcf3a" : "#f3c44a"; ctx.fill();
      ctx.strokeStyle = "#b9851c"; ctx.lineWidth = Math.max(1, r * 0.16); ctx.stroke();
      ctx.beginPath(); ctx.arc(0, 0, r * 0.66, 0, Math.PI * 2);
      ctx.strokeStyle = "rgba(185,133,28,0.6)"; ctx.lineWidth = Math.max(1, r * 0.08); ctx.stroke();
      if (sxf > 0.55) {
        if (wert >= 25) { stern(ctx, 0, 0, r * 0.5, 5, 0.45); ctx.fillStyle = "#fff3c4"; ctx.fill(); }
        else if (wert >= 10) {
          ctx.fillStyle = "#9a6a10"; ctx.font = "800 " + Math.round(r * 0.95) + "px 'Baloo 2', sans-serif";
          ctx.textAlign = "center"; ctx.textBaseline = "middle"; ctx.fillText("10", 0, r * 0.06);
        }
      }
      ctx.fillStyle = "rgba(255,255,255,0.55)";
      ctx.beginPath(); ctx.ellipse(-r * 0.35, -r * 0.4, r * 0.18, r * 0.1, -0.6, 0, Math.PI * 2); ctx.fill();
    }
    ctx.restore();
  }

  function zeichneItems(ctx, K, gel, zeit, x0, x1) {
    var M = gel.muenzen, i;
    for (i = 0; i < M.length; i++) {
      var m = M[i];
      if (m.weg || m.x < x0 - 1 || m.x > x1 + 1) continue;
      zeichneMuenze(ctx, sx(K, m.x), sy(K, m.y), K.s, m.wert, zeit, m.phase);
    }
    var T = gel.tanks;
    for (i = 0; i < T.length; i++) {
      var t = T[i];
      if (t.weg || t.x < x0 - 2 || t.x > x1 + 2) continue;
      zeichneKanister(ctx, sx(K, t.x), sy(K, t.y + 0.5 + Math.sin(zeit * 3 + t.x) * 0.08), K.s, zeit);
    }
  }

  function zeichneKanister(ctx, X, Y, s, zeit) {
    var w = 0.62 * s, h = 0.78 * s;
    ctx.save();
    ctx.translate(X, Y);
    // Leuchten, damit Kinder ihn sofort sehen
    var gl = ctx.createRadialGradient(0, 0, 0, 0, 0, s * 1.1);
    gl.addColorStop(0, "rgba(255,240,150," + (0.45 + 0.2 * Math.sin(zeit * 5)) + ")");
    gl.addColorStop(1, "rgba(255,240,150,0)");
    ctx.fillStyle = gl; ctx.beginPath(); ctx.arc(0, 0, s * 1.1, 0, Math.PI * 2); ctx.fill();
    rundRechteck(ctx, -w / 2, -h / 2, w, h, 0.12 * s);
    ctx.fillStyle = "#e8453c"; ctx.fill();
    ctx.strokeStyle = "#8f1f1a"; ctx.lineWidth = Math.max(1, 0.06 * s); ctx.stroke();
    // Griff + Ausguss
    ctx.strokeStyle = "#8f1f1a"; ctx.lineWidth = Math.max(1.5, 0.08 * s);
    ctx.beginPath(); ctx.moveTo(-w * 0.3, -h / 2); ctx.lineTo(-w * 0.3, -h * 0.68); ctx.lineTo(w * 0.05, -h * 0.68); ctx.lineTo(w * 0.05, -h / 2); ctx.stroke();
    ctx.fillStyle = "#c2302a"; ctx.fillRect(w * 0.18, -h * 0.66, w * 0.2, h * 0.18);
    // Tropfen-Symbol
    ctx.fillStyle = "#ffd23f";
    ctx.beginPath();
    ctx.moveTo(0, -h * 0.22);
    ctx.bezierCurveTo(w * 0.28, h * 0.08, w * 0.22, h * 0.3, 0, h * 0.3);
    ctx.bezierCurveTo(-w * 0.22, h * 0.3, -w * 0.28, h * 0.08, 0, -h * 0.22);
    ctx.fill();
    ctx.restore();
  }

  /* =========================================================================
     5) FAHRZEUGE (lokale Koordinaten: Meter, y nach oben, Ursprung = Schwerpunkt)
     ========================================================================= */

  /* Lackfarbe als Füllung (Regenbogen = Verlauf, Gold = Glanz) */
  function lack(ctx, aussehen, x0, x1, zeit) {
    if (aussehen.farbe === "regenbogen") {
      var g = ctx.createLinearGradient(x0, 0, x1, 0);
      var farben = ["#ff5b5b", "#ff9e2c", "#ffd23f", "#3cc35a", "#2f6fd6", "#8e5bd8"];
      var v = (zeit * 0.15) % 1;
      for (var i = 0; i <= 6; i++) g.addColorStop(i / 6, farben[(i + Math.floor(v * 6)) % 6]);
      return g;
    }
    if (aussehen.glanz) {
      var gg = ctx.createLinearGradient(x0, 1, x1, -0.5);
      gg.addColorStop(0, "#c9962a"); gg.addColorStop(0.45, "#ffe58a"); gg.addColorStop(0.55, "#fff6c8"); gg.addColorStop(1, "#d9a83a");
      return gg;
    }
    return aussehen.farbe;
  }
  function basisFarbe(aussehen) {
    return aussehen.farbe === "regenbogen" ? "#ff9e2c" : aussehen.farbe;
  }

  /* Muster auf die (bereits als Pfad gesetzte) Karosserie */
  function musterZeichnen(ctx, muster, x0, x1, y0, y1, zeit) {
    if (!muster || muster === "keins") return;
    ctx.save();
    ctx.clip();
    var w = x1 - x0, h = y1 - y0;
    if (muster === "streifen") {
      ctx.fillStyle = "rgba(255,255,255,0.85)";
      ctx.fillRect(x0, y0 + h * 0.42, w, h * 0.1);
      ctx.fillStyle = "rgba(30,44,82,0.55)";
      ctx.fillRect(x0, y0 + h * 0.56, w, h * 0.06);
    } else if (muster === "punkte") {
      ctx.fillStyle = "rgba(255,255,255,0.8)";
      for (var x = x0 + 0.15; x < x1; x += 0.42) for (var y = y0 + 0.12; y < y1; y += 0.36) {
        ctx.beginPath(); ctx.arc(x + ((Math.round(y * 10) % 2) ? 0.21 : 0), y, 0.08, 0, Math.PI * 2); ctx.fill();
      }
    } else if (muster === "sterne") {
      ctx.fillStyle = "#fff3a6";
      for (var i = 0; i < 6; i++) {
        stern(ctx, x0 + w * (0.12 + i * 0.16), y0 + h * (0.35 + 0.25 * ((i * 7) % 3) / 2), 0.13, 5, 0.45);
        ctx.fill();
      }
    } else if (muster === "flammen") {
      var fx = x1;
      [["#ffd23f", 0.75], ["#ff7b3a", 0.5]].forEach(function (f) {
        ctx.fillStyle = f[0];
        ctx.beginPath();
        ctx.moveTo(fx, y0 + h * 0.15);
        for (var k = 0; k < 5; k++) {
          var bx = fx - w * f[1] * (k + 1) / 5;
          ctx.quadraticCurveTo(bx + 0.15, y0 + h * (k % 2 ? 0.75 : 0.35), bx, y0 + h * 0.5);
        }
        ctx.lineTo(fx - w * f[1], y0 + h * 0.15);
        ctx.closePath(); ctx.fill();
      });
    } else if (muster === "blitze") {
      ctx.fillStyle = "#ffe14a";
      ctx.strokeStyle = TINTE; ctx.lineWidth = 0.03;
      var bx = x0 + w * 0.25, by = y0 + h * 0.5, l = w * 0.5;
      ctx.beginPath();
      ctx.moveTo(bx, by + h * 0.12); ctx.lineTo(bx + l * 0.45, by + h * 0.2); ctx.lineTo(bx + l * 0.4, by + h * 0.02);
      ctx.lineTo(bx + l, by + h * 0.1); ctx.lineTo(bx + l * 0.5, by - h * 0.16); ctx.lineTo(bx + l * 0.55, by - h * 0.02);
      ctx.closePath(); ctx.fill(); ctx.stroke();
    } else if (muster === "zielflagge") {
      var q = 0.16;
      for (var cx = x0; cx < x1; cx += q) for (var r = 0; r < 2; r++) {
        if ((Math.round((cx - x0) / q) + r) % 2) continue;
        ctx.fillStyle = "rgba(30,44,82,0.85)";
        ctx.fillRect(cx, y0 + h * 0.45 + r * q, q, q);
      }
      ctx.fillStyle = "rgba(255,255,255,0.85)";
      for (cx = x0; cx < x1; cx += q) for (r = 0; r < 2; r++) {
        if (!((Math.round((cx - x0) / q) + r) % 2)) continue;
        ctx.fillRect(cx, y0 + h * 0.45 + r * q, q, q);
      }
    }
    ctx.restore();
  }

  /* =========================================================================
     DIE KINDER (siehe CONFIG.kinder). Beide schauen nach vorn (+x).
       Fiete: blond, kurze verstrubbelte Haare (ca. 7 cm), braune Augen
       Jonte: größer und schlanker, lange braune Haare, braune Augen
     ausdruck: normal | freude | staunen
     ========================================================================= */
  function kindVon(aussehen) {
    return (aussehen && aussehen.kind) || FF.CONFIG.kinder[0];
  }

  /* Kurze Strubbelhaare (Fiete) */
  function zeichneStrubbelHaare(ctx, x, y, r, kind) {
    var g = Math.PI / 180;
    function p(w, rr) { return [x + Math.cos(w * g) * r * rr, y + Math.sin(w * g) * r * rr]; }
    ctx.fillStyle = kind.haar; ctx.strokeStyle = kind.haarDunkel; ctx.lineWidth = 0.022;
    ctx.lineJoin = "round";
    ctx.beginPath();
    var s = p(34, 1.02);
    ctx.moveTo(s[0], s[1]);
    // Pony: weiche Strähnen hängen in die Stirn (Spitze unten, Mulde oben)
    [[[0.74, 0.4], [0.66, 0.6]], [[0.54, 0.4], [0.44, 0.62]], [[0.3, 0.42], [0.16, 0.64]]].forEach(function (q) {
      ctx.quadraticCurveTo(x + r * q[0][0], y + r * q[0][1], x + r * (q[0][0] - 0.02), y + r * (q[0][1] - 0.02));
      ctx.quadraticCurveTo(x + r * (q[0][0] - 0.06), y + r * (q[0][1] + 0.02), x + r * q[1][0], y + r * q[1][1]);
    });
    // innen am Kopf entlang zum Nacken (Ohr bleibt frei)
    ctx.lineTo(x - r * 0.3, y + r * 0.3);
    ctx.lineTo(x - r * 0.48, y + r * 0.02);
    ctx.lineTo(x - r * 0.6, y - r * 0.5);
    // außen: weiche Strubbel-Büschel vom Nacken über den Hinterkopf bis zur Stirn
    var mulden = [236, 212, 188, 164, 140, 116, 92, 68, 46];
    var m0 = p(mulden[0], 1.08);
    ctx.lineTo(m0[0], m0[1]);
    for (var i = 1; i < mulden.length; i++) {
      var spitze = p((mulden[i - 1] + mulden[i]) / 2, i % 2 ? 1.44 : 1.38);
      var mulde = p(mulden[i], i === mulden.length - 1 ? 1.04 : 1.12);
      ctx.quadraticCurveTo(spitze[0], spitze[1], mulde[0], mulde[1]);
    }
    ctx.closePath(); ctx.fill(); ctx.stroke();
    // Strähnen + Glanz
    ctx.strokeStyle = kind.haarDunkel; ctx.lineWidth = 0.018; ctx.lineCap = "round";
    [[160, 0.62, 1.04], [128, 0.6, 1.08], [100, 0.62, 1.04]].forEach(function (q) {
      var a = p(q[0], q[1]), b = p(q[0] + 9, q[2]);
      ctx.beginPath(); ctx.moveTo(a[0], a[1]); ctx.lineTo(b[0], b[1]); ctx.stroke();
    });
    ctx.strokeStyle = "rgba(255,255,255,0.6)"; ctx.lineWidth = 0.03;
    ctx.beginPath(); ctx.arc(x - r * 0.05, y + r * 0.1, r * 0.95, 102 * g, 138 * g); ctx.stroke();
  }

  /* Lange Haare (Jonte), Teil 1: fallen hinter dem Kopf bis auf die Schultern
     und wehen bei Tempo nach hinten (wind 0..1). */
  function zeichneLangeHaareHinten(ctx, x, y, r, kind, wind, zeit) {
    var w = wind * 0.38 * r, u = wind * 0.3 * r, welle = Math.sin(zeit * 9) * 0.06 * r * wind;
    ctx.fillStyle = kind.haar; ctx.strokeStyle = kind.haarDunkel; ctx.lineWidth = 0.022;
    ctx.lineJoin = "round";
    ctx.beginPath();
    ctx.moveTo(x + r * 0.1, y + r * 1.08);
    ctx.quadraticCurveTo(x - r * 0.9, y + r * 1.18, x - r * 1.12, y + r * 0.2);
    ctx.quadraticCurveTo(x - r * 1.28 - w, y - r * 0.6 + u, x - r * 1.18 - w + welle, y - r * 1.36 + u);
    ctx.lineTo(x - r * 0.98 - w * 0.8, y - r * 1.14 + u * 0.8);
    ctx.lineTo(x - r * 0.8 - w * 0.6 + welle, y - r * 1.34 + u * 0.6);
    ctx.lineTo(x - r * 0.62 - w * 0.4, y - r * 1.06 + u * 0.4);
    ctx.lineTo(x - r * 0.44 - w * 0.2, y - r * 1.2 + u * 0.2);
    ctx.lineTo(x - r * 0.1, y - r * 0.6);
    ctx.lineTo(x + r * 0.1, y + r * 0.2);
    ctx.closePath(); ctx.fill(); ctx.stroke();
  }

  /* Lange Haare (Jonte), Teil 2: Oberkopf, seitlicher Pony und Strähne über dem Ohr */
  function zeichneLangeHaareVorne(ctx, x, y, r, kind) {
    ctx.fillStyle = kind.haar; ctx.strokeStyle = kind.haarDunkel; ctx.lineWidth = 0.022;
    ctx.lineJoin = "round";
    ctx.beginPath();
    ctx.moveTo(x - r * 0.16, y - r * 0.8);
    ctx.quadraticCurveTo(x + r * 0.1, y - r * 0.2, x + r * 0.06, y + r * 0.36);
    ctx.quadraticCurveTo(x + r * 0.46, y + r * 0.44, x + r * 0.94, y + r * 0.3);
    ctx.lineTo(x + r * 0.8, y + r * 0.52);
    ctx.quadraticCurveTo(x + r * 0.62, y + r * 0.64, x + r * 0.48, y + r * 0.56);
    ctx.quadraticCurveTo(x + r * 0.78, y + r * 0.96, x + r * 0.14, y + r * 1.13);
    ctx.quadraticCurveTo(x - r * 0.76, y + r * 1.16, x - r * 1.06, y + r * 0.36);
    ctx.quadraticCurveTo(x - r * 0.76, y - r * 0.36, x - r * 0.44, y - r * 0.84);
    ctx.closePath(); ctx.fill(); ctx.stroke();
    // Strähnen + Glanz
    ctx.strokeStyle = kind.haarDunkel; ctx.lineWidth = 0.018; ctx.lineCap = "round";
    [[[-0.2, 0.95], [-0.62, 0.2]], [[0.05, 1.0], [-0.3, 0.1]], [[-0.55, 0.75], [-0.85, 0.05]]].forEach(function (q) {
      ctx.beginPath(); ctx.moveTo(x + r * q[0][0], y + r * q[0][1]);
      ctx.quadraticCurveTo(x + r * (q[0][0] - 0.25), y + r * (q[0][1] - 0.3), x + r * q[1][0], y + r * q[1][1]); ctx.stroke();
    });
    ctx.strokeStyle = "rgba(255,255,255,0.45)"; ctx.lineWidth = 0.03;
    ctx.beginPath(); ctx.arc(x - r * 0.1, y + r * 0.15, r * 0.88, 100 * Math.PI / 180, 140 * Math.PI / 180); ctx.stroke();
  }

  function zeichneKind(ctx, x, y, r, ausdruck, raumhelm, kind, wind, zeit) {
    kind = kind || FF.CONFIG.kinder[0];
    var x0 = x, y0 = y;
    var lang = kind.frisur === "lang";
    var fb = 0.5 + 0.5 * kind.breite;                  // schlankeres Gesicht
    ctx.save();
    ctx.translate(x, y);
    ctx.scale(fb, 1);
    x = 0; y = 0;
    ctx.lineJoin = "round"; ctx.lineCap = "round";
    if (lang) zeichneLangeHaareHinten(ctx, x, y, r, kind, wind || 0, zeit || 0);
    // Gesicht, Nase, Ohr
    ctx.fillStyle = kind.haut; ctx.strokeStyle = kind.hautRand; ctx.lineWidth = 0.025;
    ctx.beginPath(); ctx.ellipse(x, y, r, r * (lang ? 1.04 : 1), 0, 0, Math.PI * 2); ctx.fill(); ctx.stroke();
    ctx.beginPath(); ctx.moveTo(x + r * 0.93, y + r * 0.12);
    ctx.quadraticCurveTo(x + r * 1.17, y - r * 0.02, x + r * 0.94, y - r * 0.15); ctx.fill(); ctx.stroke();
    if (lang) {
      zeichneLangeHaareVorne(ctx, x, y, r, kind);
    } else {
      ctx.fillStyle = kind.haut;
      ctx.beginPath(); ctx.ellipse(x - r * 0.14, y - r * 0.1, r * 0.17, r * 0.22, 0, 0, Math.PI * 2); ctx.fill(); ctx.stroke();
      ctx.beginPath(); ctx.arc(x - r * 0.14, y - r * 0.1, r * 0.08, -1.2, 1.2); ctx.stroke();
      zeichneStrubbelHaare(ctx, x, y, r, kind);
    }
    // Braune Augen (das hintere etwas kleiner – Dreiviertel-Ansicht)
    [[x + r * 0.36, y + r * 0.08, 1], [x + r * 0.74, y + r * 0.09, 0.8]].forEach(function (a) {
      var ax = a[0], ay = a[1], f = a[2];
      if (ausdruck === "freude") {
        ctx.strokeStyle = kind.augen; ctx.lineWidth = 0.035;
        ctx.beginPath(); ctx.arc(ax, ay - r * 0.07, r * 0.12 * f, Math.PI * 0.15, Math.PI * 0.85); ctx.stroke();
        return;
      }
      var gr = ausdruck === "staunen" ? 1.2 : 1;
      ctx.fillStyle = "#ffffff"; ctx.strokeStyle = kind.hautRand; ctx.lineWidth = 0.014;
      ctx.beginPath(); ctx.ellipse(ax, ay, r * 0.16 * f * gr, r * 0.21 * f * gr, 0, 0, Math.PI * 2); ctx.fill(); ctx.stroke();
      var iris = ausdruck === "staunen" ? 0.1 : 0.125;
      ctx.fillStyle = kind.augen;
      ctx.beginPath(); ctx.arc(ax + r * 0.04 * f, ay - r * 0.02, r * iris * f, 0, Math.PI * 2); ctx.fill();
      ctx.fillStyle = "#2b1a0e";
      ctx.beginPath(); ctx.arc(ax + r * 0.055 * f, ay - r * 0.02, r * 0.055 * f, 0, Math.PI * 2); ctx.fill();
      ctx.fillStyle = "#ffffff";
      ctx.beginPath(); ctx.arc(ax + r * 0.09 * f, ay + r * 0.04, r * 0.035 * f, 0, Math.PI * 2); ctx.fill();
    });
    // Augenbrauen – beim Staunen hochgezogen
    var hoch = ausdruck === "staunen" ? r * 0.07 : 0;
    ctx.strokeStyle = kind.haarDunkel; ctx.lineWidth = 0.028;
    ctx.beginPath(); ctx.moveTo(x + r * 0.27, y + r * 0.31 + hoch); ctx.quadraticCurveTo(x + r * 0.4, y + r * 0.37 + hoch, x + r * 0.52, y + r * 0.32 + hoch); ctx.stroke();
    ctx.beginPath(); ctx.moveTo(x + r * 0.66, y + r * 0.32 + hoch); ctx.quadraticCurveTo(x + r * 0.76, y + r * 0.37 + hoch, x + r * 0.85, y + r * 0.31 + hoch); ctx.stroke();
    // Mund
    ctx.strokeStyle = "#b0563f"; ctx.lineWidth = 0.03;
    if (ausdruck === "staunen") {
      ctx.fillStyle = "#b8323c";
      ctx.beginPath(); ctx.ellipse(x + r * 0.66, y - r * 0.45, r * 0.08, r * 0.11, 0, 0, Math.PI * 2); ctx.fill();
    } else if (ausdruck === "freude") {
      ctx.fillStyle = "#b8323c";
      ctx.beginPath(); ctx.moveTo(x + r * 0.38, y - r * 0.32);
      ctx.quadraticCurveTo(x + r * 0.64, y - r * 0.78, x + r * 0.9, y - r * 0.3); ctx.closePath(); ctx.fill();
      ctx.fillStyle = "#ffffff";
      ctx.beginPath(); ctx.moveTo(x + r * 0.44, y - r * 0.34); ctx.lineTo(x + r * 0.84, y - r * 0.32);
      ctx.lineTo(x + r * 0.8, y - r * 0.4); ctx.lineTo(x + r * 0.48, y - r * 0.42); ctx.closePath(); ctx.fill();
    } else {
      ctx.beginPath(); ctx.moveTo(x + r * 0.42, y - r * 0.36);
      ctx.quadraticCurveTo(x + r * 0.63, y - r * 0.56, x + r * 0.86, y - r * 0.34); ctx.stroke();
    }
    // Bäckchen
    ctx.fillStyle = "rgba(255,120,120,0.35)";
    ctx.beginPath(); ctx.arc(x + r * 0.3, y - r * 0.27, r * 0.12, 0, Math.PI * 2); ctx.fill();
    ctx.restore();
    if (raumhelm) {
      x = x0; y = y0;
      ctx.fillStyle = "rgba(200,235,255,0.28)";
      ctx.strokeStyle = "rgba(255,255,255,0.9)"; ctx.lineWidth = 0.04;
      ctx.beginPath(); ctx.arc(x + r * 0.1, y + r * 0.1, r * 1.5, 0, Math.PI * 2); ctx.fill(); ctx.stroke();
      ctx.strokeStyle = "rgba(255,255,255,0.7)"; ctx.lineWidth = 0.05;
      ctx.beginPath(); ctx.arc(x + r * 0.1, y + r * 0.1, r * 1.25, Math.PI * 0.55, Math.PI * 0.85); ctx.stroke();
    }
  }

  /* Körpermaße des Kindes: schlanker = schmaler Oberkörper, größer = längerer
     Oberkörper und Kopf weiter oben. */
  function koerperFuer(teile, kind) {
    var b = kind.breite, g = kind.groesse, k = teile.fahrerKoerper, ar = teile.arme;
    return {
      haut: kind.haut,
      fahrerKoerper: k ? [k[0] + k[2] * (1 - b) / 2, k[1], k[2] * b, k[3] + g] : null,
      arme: ar ? [ar[0], ar[1] + g * 0.8, ar[2], ar[3]] : null,
      armDicke: 0.09 * (0.4 + 0.6 * b),
      breite: b, groesse: g
    };
  }

  /* =========================================================================
     FIETES OUTFIT (siehe CONFIG.outfits) – lokale Meter, y nach oben.
     Dieselben Funktionen zeichnen Fiete im Auto, in der Garage, im Titel,
     in der Fortschrittsleiste und im Ergebnis: überall dieselbe Person.
     ========================================================================= */
  var KOPF_R = 0.3;                  // Fiete ist überall gleich groß gezeichnet

  function outfitVon(aussehen) {
    return (aussehen && aussehen.outfit) || FF.CONFIG.outfits[0];
  }

  function zeichneEmblem(ctx, o, x, y, r) {
    ctx.lineJoin = "round"; ctx.lineCap = "round";
    if (o.emblem === "raute") {            // Wappen-Fünfeck: gelb mit rotem Rand
      ctx.beginPath();
      ctx.moveTo(x - r * 0.8, y + r * 0.62); ctx.lineTo(x + r * 0.8, y + r * 0.62);
      ctx.lineTo(x + r * 1.05, y + r * 0.18); ctx.lineTo(x, y - r * 0.9); ctx.lineTo(x - r * 1.05, y + r * 0.18);
      ctx.closePath();
      ctx.fillStyle = "#ffd23f"; ctx.fill();
      ctx.strokeStyle = "#e8453c"; ctx.lineWidth = r * 0.22; ctx.stroke();
    } else if (o.emblem === "oval") {      // gelbes Oval
      ctx.beginPath(); ctx.ellipse(x, y, r * 1.1, r * 0.66, 0, 0, Math.PI * 2);
      ctx.fillStyle = "#ffd23f"; ctx.fill();
      ctx.strokeStyle = "#262b3b"; ctx.lineWidth = r * 0.16; ctx.stroke();
    } else if (o.emblem === "spinne") {    // kleine schwarze Spinne
      ctx.strokeStyle = "#1a1a1a"; ctx.fillStyle = "#1a1a1a"; ctx.lineWidth = r * 0.12;
      for (var sei = -1; sei <= 1; sei += 2) {
        for (var i = 0; i < 4; i++) {
          ctx.beginPath(); ctx.moveTo(x, y);
          ctx.lineTo(x + sei * r * 0.6, y + r * (0.4 - i * 0.27));
          ctx.lineTo(x + sei * r * 0.95, y + r * (0.6 - i * 0.45));
          ctx.stroke();
        }
      }
      ctx.beginPath(); ctx.ellipse(x, y - r * 0.15, r * 0.22, r * 0.38, 0, 0, Math.PI * 2); ctx.fill();
      ctx.beginPath(); ctx.arc(x, y + r * 0.35, r * 0.16, 0, Math.PI * 2); ctx.fill();
    } else if (o.emblem === "reaktor") {   // leuchtender Kreis
      var gl = ctx.createRadialGradient(x, y, 0, x, y, r * 1.15);
      gl.addColorStop(0, "#ffffff"); gl.addColorStop(0.45, "#9ff3ff"); gl.addColorStop(1, "rgba(120,230,255,0)");
      ctx.fillStyle = gl; ctx.beginPath(); ctx.arc(x, y, r * 1.15, 0, Math.PI * 2); ctx.fill();
      ctx.strokeStyle = "#8f98ad"; ctx.lineWidth = r * 0.14;
      ctx.beginPath(); ctx.arc(x, y, r * 0.62, 0, Math.PI * 2); ctx.stroke();
    } else {                               // weißer Stern
      stern(ctx, x, y, r, 5, 0.45);
      ctx.fillStyle = "#ffffff"; ctx.fill();
      ctx.strokeStyle = "rgba(30,44,82,0.5)"; ctx.lineWidth = r * 0.08; ctx.stroke();
    }
  }

  function zeichneTorso(ctx, o, x, y, w, h) {
    var rund = Math.min(0.13, w * 0.3);
    ctx.save();
    rundRechteck(ctx, x, y, w, h, rund);
    ctx.fillStyle = o.anzug; ctx.fill();
    ctx.clip();
    if (o.seiten) {
      ctx.fillStyle = o.seiten;
      ctx.fillRect(x, y, w, h * 0.34); ctx.fillRect(x, y, w * 0.18, h);
    }
    if (o.streifen) {
      for (var i = 0, q = w / 5; i < 5; i++) {
        ctx.fillStyle = i % 2 ? "#ffffff" : "#d9363e";
        ctx.fillRect(x + i * q, y, q, h * 0.34);
      }
    }
    if (o.netz) {
      var cx = x + w * 0.62, cy = y + h * 0.62, a, k;
      ctx.strokeStyle = "rgba(20,20,20,0.55)"; ctx.lineWidth = 0.012;
      for (k = 0; k < 8; k++) {
        a = k * Math.PI / 4;
        ctx.beginPath(); ctx.moveTo(cx, cy); ctx.lineTo(cx + Math.cos(a) * w, cy + Math.sin(a) * w); ctx.stroke();
      }
      for (var rr = 0.09; rr < w; rr += 0.09) {
        ctx.beginPath();
        for (k = 0; k <= 8; k++) {
          a = k * Math.PI / 4;
          var px = cx + Math.cos(a) * rr, py = cy + Math.sin(a) * rr;
          if (k === 0) ctx.moveTo(px, py);
          else ctx.quadraticCurveTo(cx + Math.cos(a - Math.PI / 8) * rr * 0.8, cy + Math.sin(a - Math.PI / 8) * rr * 0.8, px, py);
        }
        ctx.stroke();
      }
    }
    if (o.guertel) { ctx.fillStyle = o.guertel; ctx.fillRect(x, y + h * 0.3, w, Math.max(0.045, h * 0.12)); }
    ctx.restore();
    rundRechteck(ctx, x, y, w, h, rund);
    ctx.strokeStyle = o.anzugRand; ctx.lineWidth = 0.03; ctx.stroke();
    zeichneEmblem(ctx, o, x + w * 0.62, y + h * 0.62, Math.min(w, h) * 0.22);
  }

  /* Rücken: Umhang (hängt im Stand, weht bei Tempo nach hinten) oder Rundschild.
     Wird immer HINTER der Karosserie gezeichnet. */
  function zeichneRuecken(ctx, o, teile, kp, r, zeit, tempo) {
    var k = teile.fahrerKoerper;
    var sx0 = k ? k[0] + k[2] * 0.35 : kp.x - r * 0.25;
    var sy0 = k ? k[1] + k[3] - 0.03 : kp.y - (teile.groesse || 0) - r * 0.95;
    if (o.schild) {
      var bx = sx0 - 0.1, by = sy0 - 0.2, R = 0.2;
      [["#d9363e", 1], ["#ffffff", 0.78], ["#d9363e", 0.58], ["#2f5fbf", 0.4]].forEach(function (ring) {
        ctx.fillStyle = ring[0]; ctx.beginPath(); ctx.arc(bx, by, R * ring[1], 0, Math.PI * 2); ctx.fill();
      });
      stern(ctx, bx, by, R * 0.34, 5, 0.45); ctx.fillStyle = "#ffffff"; ctx.fill();
      ctx.strokeStyle = "rgba(30,44,82,0.5)"; ctx.lineWidth = 0.015;
      ctx.beginPath(); ctx.arc(bx, by, R, 0, Math.PI * 2); ctx.stroke();
    }
    if (!o.umhang) return;
    var wind = Math.min(1, tempo / 12);
    var w = (258 - 70 * wind) * Math.PI / 180, cw = Math.cos(w), sw = Math.sin(w);
    var flatter = Math.sin(zeit * (5 + 9 * wind)) * (0.03 + 0.06 * wind);
    var L = 0.5 + 0.12 * wind;
    var ex = sx0 + cw * L, ey = sy0 + sw * L;
    var nx = -sw, ny = cw;                               // quer zur Umhang-Richtung
    var bE = 0.14, bS = 0.07;
    ctx.fillStyle = o.umhang; ctx.strokeStyle = dunkel(o.umhang, 0.25); ctx.lineWidth = 0.02;
    ctx.beginPath();
    ctx.moveTo(sx0 + nx * bS, sy0 + ny * bS);
    ctx.quadraticCurveTo(sx0 + cw * L * 0.5 + nx * (bE + flatter), sy0 + sw * L * 0.5 + ny * (bE + flatter), ex + nx * bE, ey + ny * bE);
    if (o.umhangZacken) {
      // gezackter Saum wie Fledermaus-Flügel
      for (var j = 1; j <= 3; j++) {
        var t0 = (j - 1) / 3, t1 = j / 3;
        var mx = ex + nx * bE * (1 - 2 * (t0 + t1) / 2), my = ey + ny * bE * (1 - 2 * (t0 + t1) / 2);
        ctx.quadraticCurveTo(mx - cw * 0.09, my - sw * 0.09, ex + nx * bE * (1 - 2 * t1), ey + ny * bE * (1 - 2 * t1));
      }
    } else {
      ctx.quadraticCurveTo(ex + cw * 0.06 + nx * flatter, ey + sw * 0.06 + ny * flatter, ex - nx * bE, ey - ny * bE);
    }
    ctx.quadraticCurveTo(sx0 + cw * L * 0.5 - nx * (bE * 0.6 - flatter), sy0 + sw * L * 0.5 - ny * (bE * 0.6 - flatter),
                         sx0 - nx * bS, sy0 - ny * bS);
    ctx.closePath(); ctx.fill(); ctx.stroke();
  }

  function zeichneAnzug(ctx, o, teile, kp, r) {
    var k = teile.fahrerKoerper, b = teile.breite || 1, g = teile.groesse || 0;
    if (k) zeichneTorso(ctx, o, k[0], k[1], k[2], k[3]);
    else zeichneTorso(ctx, o, kp.x - r * 0.9 * b, kp.y - g - r * 1.62, r * 1.75 * b, r * 0.66 + g);   // nur Schultern sichtbar
    if (teile.arme) {
      var ar = teile.arme;
      ctx.strokeStyle = o.aermel; ctx.lineWidth = teile.armDicke || 0.09; ctx.lineCap = "round";
      ctx.beginPath(); ctx.moveTo(ar[0], ar[1]); ctx.lineTo(ar[2], ar[3]); ctx.stroke();
      ctx.fillStyle = o.haende || teile.haut || HAUT; ctx.strokeStyle = o.haende ? dunkel(o.haende, 0.3) : HAUT_RAND; ctx.lineWidth = 0.015;
      ctx.beginPath(); ctx.arc(ar[2], ar[3], 0.055, 0, Math.PI * 2); ctx.fill(); ctx.stroke();
    }
    ctx.fillStyle = teile.haut || HAUT;                   // Hals (beim größeren Kind länger)
    ctx.fillRect(kp.x - r * 0.25 * b, kp.y - r * 1.05 - g, r * 0.45 * b, r * 0.3 + g);
  }

  function zeichneRad(ctx, R, lx, ly, art) {
    var r = R.r, a = R.k.a;
    ctx.save();
    ctx.translate(lx, ly);
    ctx.rotate(a - R.chassisWinkel);
    // Reifen
    ctx.fillStyle = REIFEN;
    ctx.beginPath(); ctx.arc(0, 0, r, 0, Math.PI * 2); ctx.fill();
    // Profil
    var n = art === "traktor" ? 14 : art === "monster" ? 16 : 12;
    ctx.fillStyle = "#3d4352";
    for (var i = 0; i < n; i++) {
      var w = i * Math.PI * 2 / n;
      ctx.save(); ctx.rotate(w);
      if (art === "traktor") { ctx.beginPath(); ctx.moveTo(r * 0.82, -r * 0.08); ctx.lineTo(r * 1.06, r * 0.04); ctx.lineTo(r * 1.06, r * 0.18); ctx.lineTo(r * 0.82, r * 0.08); ctx.fill(); }
      else { rundRechteck(ctx, r * 0.86, -r * 0.07, r * 0.16, r * 0.14, r * 0.04); ctx.fill(); }
      ctx.restore();
    }
    // Felge
    var rf = art === "monster" ? 0.5 : art === "mond" ? 0.82 : 0.58;
    ctx.fillStyle = art === "mond" ? "rgba(200,205,220,0.35)" : FELGE;
    ctx.beginPath(); ctx.arc(0, 0, r * rf, 0, Math.PI * 2); ctx.fill();
    ctx.strokeStyle = "#8f98ad"; ctx.lineWidth = r * 0.06; ctx.stroke();
    ctx.strokeStyle = art === "mond" ? "#e8ecf5" : "#9aa3b8";
    ctx.lineWidth = art === "mond" ? r * 0.04 : r * 0.1;
    var sp = art === "mond" ? 10 : 5;
    for (i = 0; i < sp; i++) {
      var ww = i * Math.PI * 2 / sp;
      ctx.beginPath(); ctx.moveTo(Math.cos(ww) * r * 0.16, Math.sin(ww) * r * 0.16);
      ctx.lineTo(Math.cos(ww) * r * rf * 0.92, Math.sin(ww) * r * rf * 0.92); ctx.stroke();
    }
    ctx.fillStyle = "#ffcf3a";
    ctx.beginPath(); ctx.arc(0, 0, r * 0.15, 0, Math.PI * 2); ctx.fill();
    ctx.restore();
  }

  function zeichneFeder(ctx, ax, ay, bx, by, breite) {
    var dx = bx - ax, dy = by - ay, l = Math.hypot(dx, dy) || 1;
    var nx = -dy / l, ny = dx / l, n = 7;
    ctx.strokeStyle = "#9aa3b8"; ctx.lineWidth = 0.07; ctx.lineCap = "round"; ctx.lineJoin = "round";
    ctx.beginPath(); ctx.moveTo(ax, ay);
    for (var i = 1; i < n; i++) {
      var t = i / n, s = (i % 2 ? 1 : -1) * breite;
      ctx.lineTo(ax + dx * t + nx * s, ay + dy * t + ny * s);
    }
    ctx.lineTo(bx, by);
    ctx.stroke();
    ctx.strokeStyle = "#5f6e96"; ctx.lineWidth = 0.09;
    ctx.beginPath(); ctx.moveTo(ax, ay); ctx.lineTo(ax + dx * 0.45, ay + dy * 0.45); ctx.stroke();
  }

  /* --- einzelne Karosserien --- */
  var KAROSSERIE = {
    buggy: function (ctx, a, z, fz) {
      var hinten = function () {
        ctx.strokeStyle = "#3b4566"; ctx.lineWidth = 0.1; ctx.lineCap = "round"; ctx.lineJoin = "round";
        ctx.beginPath(); ctx.moveTo(-1.0, 0.22); ctx.lineTo(-0.8, 1.02); ctx.lineTo(0.02, 1.02); ctx.lineTo(0.22, 0.32); ctx.stroke();
        ctx.fillStyle = "#3b4566"; rundRechteck(ctx, -0.82, 0.12, 0.34, 0.6, 0.1); ctx.fill();
      };
      var vorne = function () {
        ctx.beginPath();
        ctx.moveTo(-1.45, -0.28); ctx.lineTo(1.28, -0.28);
        ctx.quadraticCurveTo(1.62, -0.24, 1.55, 0.04);
        ctx.lineTo(1.26, 0.3); ctx.lineTo(0.38, 0.34);
        ctx.quadraticCurveTo(0.2, 0.34, 0.12, 0.13);
        ctx.lineTo(-0.78, 0.13);
        ctx.quadraticCurveTo(-0.95, 0.14, -1.02, 0.32);
        ctx.lineTo(-1.45, 0.34); ctx.closePath();
        ctx.fillStyle = lack(ctx, a, -1.45, 1.55, z); ctx.fill();
        musterZeichnen(ctx, a.muster, -1.45, 1.55, -0.28, 0.34, z);
        ctx.strokeStyle = TINTE; ctx.lineWidth = 0.05; ctx.stroke();
        ctx.fillStyle = "#ffe58a"; ctx.beginPath(); ctx.arc(1.42, 0.06, 0.08, 0, Math.PI * 2); ctx.fill();
        ctx.fillStyle = "#7a8299"; rundRechteck(ctx, -1.62, -0.16, 0.2, 0.1, 0.04); ctx.fill();
        ctx.fillStyle = "rgba(255,255,255,0.3)"; rundRechteck(ctx, -1.2, 0.18, 1.0, 0.06, 0.03); ctx.fill();
        ctx.fillStyle = "#ffffff"; ctx.beginPath(); ctx.arc(0.68, 0.02, 0.17, 0, Math.PI * 2); ctx.fill();
        textLokal(ctx, kindVon(a).name.charAt(0), 0.68, 0.01, 0.26, TINTE, true);   // Anfangsbuchstabe des Fahrers
        // Lenkrad
        ctx.strokeStyle = "#3b4566"; ctx.lineWidth = 0.06;
        ctx.beginPath(); ctx.moveTo(0.28, 0.3); ctx.lineTo(0.1, 0.56); ctx.stroke();
      };
      return { hinten: hinten, vorne: vorne, fahrerKoerper: [-0.62, 0.15, 0.4, 0.38], arme: [-0.34, 0.44, 0.13, 0.52] };
    },

    moped: function (ctx, a, z, fz) {
      var vorneR = fz.raeder[1];
      var hinten = function () {
        // Gabel zum Vorderrad (bewegt sich mit der Federung)
        ctx.strokeStyle = "#7a8299"; ctx.lineWidth = 0.08; ctx.lineCap = "round";
        ctx.beginPath(); ctx.moveTo(0.62, 0.72); ctx.lineTo(vorneR.lokalX, vorneR.lokalY); ctx.stroke();
        ctx.strokeStyle = "#3b4566"; ctx.lineWidth = 0.07;
        ctx.beginPath(); ctx.moveTo(0.5, 0.86); ctx.lineTo(0.78, 0.82); ctx.stroke();
      };
      var vorne = function () {
        ctx.beginPath();
        ctx.moveTo(-0.82, 0.02);
        ctx.quadraticCurveTo(-0.9, 0.38, -0.55, 0.42);
        ctx.lineTo(-0.05, 0.42);
        ctx.quadraticCurveTo(0.05, 0.12, 0.3, 0.06);
        ctx.lineTo(0.48, 0.06); ctx.lineTo(0.68, 0.78); ctx.lineTo(0.54, 0.8);
        ctx.quadraticCurveTo(0.42, 0.3, 0.25, -0.12);
        ctx.lineTo(-0.6, -0.12);
        ctx.closePath();
        ctx.fillStyle = lack(ctx, a, -0.9, 0.7, z); ctx.fill();
        musterZeichnen(ctx, a.muster, -0.9, 0.7, -0.12, 0.8, z);
        ctx.strokeStyle = TINTE; ctx.lineWidth = 0.045; ctx.stroke();
        ctx.fillStyle = "#3b4566"; rundRechteck(ctx, -0.6, 0.4, 0.55, 0.1, 0.05); ctx.fill();
        ctx.fillStyle = "#ffe58a"; ctx.beginPath(); ctx.arc(0.66, 0.64, 0.07, 0, Math.PI * 2); ctx.fill();
        ctx.fillStyle = "#ff5b5b"; ctx.beginPath(); ctx.arc(-0.84, 0.22, 0.05, 0, Math.PI * 2); ctx.fill();
      };
      return { hinten: hinten, vorne: vorne, fahrerKoerper: [-0.35, 0.42, 0.42, 0.42], arme: [0.06, 0.66, 0.58, 0.84] };
    },

    traktor: function (ctx, a, z) {
      var c = basisFarbe(a);
      var hinten = function () {
        ctx.fillStyle = "#3b4566";
        ctx.fillRect(-1.45, 0.2, 0.09, 1.4); ctx.fillRect(-0.12, 0.6, 0.09, 1.0);
      };
      var vorne = function () {
        // Fahrgestell + Motorhaube
        ctx.beginPath();
        rundRechteck(ctx, -1.45, -0.2, 1.5, 0.48, 0.08);
        ctx.fillStyle = lack(ctx, a, -1.45, 1.75, z); ctx.fill(); ctx.strokeStyle = TINTE; ctx.lineWidth = 0.05; ctx.stroke();
        ctx.beginPath();
        rundRechteck(ctx, -0.02, -0.18, 1.74, 0.78, 0.14);
        ctx.fillStyle = lack(ctx, a, -1.45, 1.75, z); ctx.fill();
        musterZeichnen(ctx, a.muster, -0.02, 1.72, -0.18, 0.6, z);
        ctx.strokeStyle = TINTE; ctx.lineWidth = 0.05; ctx.stroke();
        // Kühlergrill
        ctx.fillStyle = "#3b4566"; rundRechteck(ctx, 1.48, -0.08, 0.18, 0.58, 0.05); ctx.fill();
        ctx.strokeStyle = "#9aa3b8"; ctx.lineWidth = 0.03;
        for (var i = 0; i < 4; i++) { ctx.beginPath(); ctx.moveTo(1.5, 0.02 + i * 0.12); ctx.lineTo(1.64, 0.02 + i * 0.12); ctx.stroke(); }
        // Auspuff
        ctx.fillStyle = "#3b4566"; ctx.fillRect(0.88, 0.58, 0.1, 0.62);
        ctx.fillRect(0.84, 1.18, 0.18, 0.06);
        // Dach + Fenster
        ctx.fillStyle = "rgba(190,230,255,0.3)";
        ctx.fillRect(-1.36, 0.28, 1.24, 1.3);
        ctx.strokeStyle = "rgba(255,255,255,0.6)"; ctx.lineWidth = 0.05;
        ctx.beginPath(); ctx.moveTo(-0.5, 1.4); ctx.lineTo(-0.25, 1.1); ctx.stroke();
        ctx.beginPath(); rundRechteck(ctx, -1.6, 1.55, 1.7, 0.16, 0.06);
        ctx.fillStyle = hell(c, 0.15); ctx.fill(); ctx.strokeStyle = TINTE; ctx.lineWidth = 0.05; ctx.stroke();
        // Kotflügel über dem großen Rad
        ctx.strokeStyle = dunkel(c, 0.2); ctx.lineWidth = 0.12;
        ctx.beginPath(); ctx.arc(-0.85, -0.2, 0.82, Math.PI * 0.15, Math.PI * 0.85); ctx.stroke();
        ctx.fillStyle = "#ffe58a"; ctx.beginPath(); ctx.arc(1.62, 0.5, 0.07, 0, Math.PI * 2); ctx.fill();
      };
      return { hinten: hinten, vorne: vorne, fahrerKoerper: [-0.95, 0.3, 0.48, 0.42], fahrerVorDach: true };
    },

    bus: function (ctx, a, z) {
      var c = basisFarbe(a);
      var vorne = function () {
        ctx.beginPath();
        ctx.moveTo(-2.7, -0.35); ctx.lineTo(2.62, -0.35);
        ctx.quadraticCurveTo(2.82, -0.33, 2.8, 0.1);
        ctx.lineTo(2.78, 0.6); ctx.lineTo(2.58, 1.5);
        ctx.quadraticCurveTo(2.55, 1.58, 2.4, 1.58);
        ctx.lineTo(-2.55, 1.58);
        ctx.quadraticCurveTo(-2.72, 1.58, -2.72, 1.4);
        ctx.closePath();
        ctx.fillStyle = lack(ctx, a, -2.7, 2.8, z); ctx.fill();
        musterZeichnen(ctx, a.muster, -2.7, 2.8, -0.35, 1.58, z);
        ctx.strokeStyle = TINTE; ctx.lineWidth = 0.05; ctx.stroke();
        // Stoßstange
        ctx.fillStyle = "#3b4566"; rundRechteck(ctx, -2.78, -0.4, 5.64, 0.18, 0.06); ctx.fill();
        // Fensterreihe mit Tierkindern
        var tiere = ["🐰", "🐻", "🐱", "🐶", "🦊"];
        for (var i = 0; i < 5; i++) {
          var fx = -2.42 + i * 0.84;
          ctx.fillStyle = "rgba(190,230,255,0.85)";
          rundRechteck(ctx, fx, 0.68, 0.66, 0.66, 0.1); ctx.fill();
          ctx.save(); ctx.beginPath(); rundRechteck(ctx, fx, 0.68, 0.66, 0.66, 0.1); ctx.clip();
          ctx.save(); ctx.translate(fx + 0.33, 0.9); ctx.scale(1, -1);
          var spr = emojiSprite(tiere[i], 64);
          ctx.drawImage(spr, -0.3, -0.3, 0.6, 0.6);
          ctx.restore(); ctx.restore();
          ctx.strokeStyle = dunkel(c, 0.3); ctx.lineWidth = 0.04;
          rundRechteck(ctx, fx, 0.68, 0.66, 0.66, 0.1); ctx.stroke();
        }
        // Frontscheibe
        ctx.fillStyle = "rgba(190,230,255,0.5)";
        ctx.beginPath(); ctx.moveTo(1.84, 0.62); ctx.lineTo(2.72, 0.62); ctx.lineTo(2.52, 1.42); ctx.lineTo(1.84, 1.42); ctx.closePath(); ctx.fill();
        ctx.strokeStyle = dunkel(c, 0.3); ctx.stroke();
        // Tür
        ctx.strokeStyle = dunkel(c, 0.3); ctx.lineWidth = 0.04;
        rundRechteck(ctx, 1.84, -0.2, 0.0, 0.0, 0); // Platzhalter
        ctx.fillStyle = "#ffe58a"; ctx.beginPath(); ctx.arc(2.7, 0.0, 0.1, 0, Math.PI * 2); ctx.fill();
        ctx.fillStyle = "#ff5b5b"; ctx.fillRect(-2.75, 0.05, 0.08, 0.2);
        ctx.fillStyle = "rgba(30,44,82,0.25)"; ctx.fillRect(-2.7, 0.42, 5.4, 0.08);
      };
      return { hinten: function () {}, vorne: vorne, fahrerKoerper: null, fahrerNachVorne: true,
               scheibe: [[1.84, 0.62], [2.72, 0.62], [2.52, 1.42], [1.84, 1.42]] };
    },

    monster: function (ctx, a, z) {
      var c = basisFarbe(a);
      var hinten = function () {
        ctx.fillStyle = "#3b4566";
        rundRechteck(ctx, -1.65, -0.12, 3.3, 0.22, 0.06); ctx.fill();
      };
      var vorne = function () {
        ctx.beginPath();
        ctx.moveTo(-1.8, 0.05); ctx.lineTo(1.85, 0.05); ctx.lineTo(1.92, 0.55);
        ctx.lineTo(0.9, 0.7); ctx.lineTo(0.58, 1.22);
        ctx.quadraticCurveTo(0.52, 1.28, 0.42, 1.28);
        ctx.lineTo(-0.48, 1.28); ctx.lineTo(-0.7, 0.7); ctx.lineTo(-1.8, 0.62);
        ctx.closePath();
        ctx.fillStyle = lack(ctx, a, -1.8, 1.92, z); ctx.fill();
        musterZeichnen(ctx, a.muster, -1.8, 1.92, 0.05, 1.28, z);
        ctx.strokeStyle = TINTE; ctx.lineWidth = 0.05; ctx.stroke();
        // Fenster
        ctx.beginPath(); ctx.moveTo(0.46, 0.74); ctx.lineTo(0.66, 0.74); ctx.lineTo(0.45, 1.16); ctx.lineTo(-0.38, 1.16); ctx.lineTo(-0.55, 0.74); ctx.closePath();
        ctx.fillStyle = "rgba(190,230,255,0.35)"; ctx.fill();
        ctx.strokeStyle = dunkel(c, 0.3); ctx.lineWidth = 0.04; ctx.stroke();
        ctx.fillStyle = "#ffe58a"; ctx.beginPath(); ctx.arc(1.84, 0.4, 0.08, 0, Math.PI * 2); ctx.fill();
        // Überrollbügel-Lampen
        ctx.fillStyle = "#ffd23f";
        for (var i = 0; i < 3; i++) { ctx.beginPath(); ctx.arc(-0.3 + i * 0.3, 1.36, 0.07, 0, Math.PI * 2); ctx.fill(); }
        ctx.fillStyle = "rgba(255,255,255,0.3)"; rundRechteck(ctx, -1.6, 0.42, 1.0, 0.06, 0.03); ctx.fill();
      };
      return { hinten: hinten, vorne: vorne, fahrerKoerper: null, fahrerNachVorne: true,
               scheibe: [[0.46, 0.74], [0.66, 0.74], [0.45, 1.16], [-0.38, 1.16], [-0.55, 0.74]] };
    },

    renner: function (ctx, a, z) {
      var c = basisFarbe(a);
      var hinten = function () {
        ctx.fillStyle = "#3b4566";
        ctx.fillRect(-1.85, 0.28, 0.08, 0.46);
        ctx.beginPath(); rundRechteck(ctx, -2.12, 0.7, 0.72, 0.12, 0.05);
        ctx.fillStyle = dunkel(c, 0.25); ctx.fill(); ctx.strokeStyle = TINTE; ctx.lineWidth = 0.04; ctx.stroke();
      };
      var vorne = function () {
        ctx.beginPath();
        ctx.moveTo(-2.0, -0.22); ctx.lineTo(2.05, -0.22); ctx.lineTo(2.14, -0.06);
        ctx.quadraticCurveTo(1.2, 0.1, 0.62, 0.24);
        ctx.quadraticCurveTo(0.2, 0.32, 0.02, 0.26);
        ctx.lineTo(-0.5, 0.26);
        ctx.quadraticCurveTo(-0.7, 0.36, -1.4, 0.36);
        ctx.lineTo(-2.0, 0.32); ctx.closePath();
        ctx.fillStyle = lack(ctx, a, -2.0, 2.14, z); ctx.fill();
        musterZeichnen(ctx, a.muster, -2.0, 2.14, -0.22, 0.36, z);
        ctx.strokeStyle = TINTE; ctx.lineWidth = 0.05; ctx.stroke();
        ctx.fillStyle = "#ffffff"; ctx.beginPath(); ctx.arc(0.95, 0.0, 0.17, 0, Math.PI * 2); ctx.fill();
        textLokal(ctx, "1", 0.95, -0.01, 0.26, TINTE, true);
        ctx.fillStyle = "rgba(190,230,255,0.6)";
        ctx.beginPath(); ctx.moveTo(0.02, 0.26); ctx.quadraticCurveTo(0.18, 0.5, 0.42, 0.28); ctx.closePath(); ctx.fill();
        ctx.fillStyle = "#3b4566"; rundRechteck(ctx, -2.08, -0.26, 4.24, 0.08, 0.03); ctx.fill();
      };
      return { hinten: hinten, vorne: vorne, fahrerKoerper: null, fahrerZuerst: true };
    },

    mond: function (ctx, a, z) {
      var c = basisFarbe(a);
      var hinten = function () {
        // Solarpaneel + Antenne
        ctx.save(); ctx.translate(-1.05, 0.48); ctx.rotate(0.12);
        ctx.fillStyle = "#2f5fbf"; ctx.fillRect(-0.62, -0.06, 1.24, 0.14);
        ctx.strokeStyle = "#9cc3ff"; ctx.lineWidth = 0.02;
        for (var i = 1; i < 6; i++) { ctx.beginPath(); ctx.moveTo(-0.62 + i * 0.207, -0.06); ctx.lineTo(-0.62 + i * 0.207, 0.08); ctx.stroke(); }
        ctx.restore();
        ctx.strokeStyle = "#9aa3b8"; ctx.lineWidth = 0.04;
        ctx.beginPath(); ctx.moveTo(-1.05, 0.25); ctx.lineTo(-1.05, 0.44); ctx.stroke();
        ctx.beginPath(); ctx.moveTo(1.3, 0.25); ctx.lineTo(1.3, 0.95); ctx.stroke();
        ctx.fillStyle = "#e4e6f0";
        ctx.beginPath(); ctx.arc(1.3, 1.0, 0.22, Math.PI * 1.1, Math.PI * 1.9); ctx.closePath(); ctx.fill();
        ctx.fillStyle = "#ff5b5b"; ctx.beginPath(); ctx.arc(1.3, 1.05 + Math.sin(z * 6) * 0.01, 0.04, 0, Math.PI * 2); ctx.fill();
      };
      var vorne = function () {
        ctx.beginPath(); rundRechteck(ctx, -1.78, -0.22, 3.62, 0.5, 0.12);
        ctx.fillStyle = lack(ctx, a, -1.78, 1.84, z); ctx.fill();
        musterZeichnen(ctx, a.muster, -1.78, 1.84, -0.22, 0.28, z);
        ctx.strokeStyle = TINTE; ctx.lineWidth = 0.05; ctx.stroke();
        ctx.fillStyle = "#f3c44a"; ctx.fillRect(-1.6, -0.05, 3.2, 0.07);
        ctx.fillStyle = dunkel(c, 0.15);
        for (var i = 0; i < 3; i++) { ctx.beginPath(); ctx.arc(-1.3 + i * 1.3, 0.28, 0.12, 0, Math.PI); ctx.fill(); }
      };
      return { hinten: hinten, vorne: vorne, fahrerKoerper: [-0.35, 0.22, 0.6, 0.34], raumhelm: true };
    }
  };

  /* Fahrzeug an seiner Weltposition zeichnen */
  function zeichneFahrzeug(ctx, K, fz, def, aussehen, zeit, ausdruck) {
    var C = fz.chassis;
    var ca = Math.cos(C.a), sa = Math.sin(C.a);
    // Radmitten in lokale Koordinaten umrechnen (für Federn, Gabel …)
    fz.raeder.forEach(function (R) {
      var dx = R.k.x - C.x, dy = R.k.y - C.y;
      R.lokalX = ca * dx + sa * dy;
      R.lokalY = -sa * dx + ca * dy;
      R.chassisWinkel = C.a;
    });
    ctx.save();
    ctx.translate(sx(K, C.x), sy(K, C.y));
    ctx.rotate(-C.a);
    ctx.scale(K.s, -K.s);
    zeichneFahrzeugLokal(ctx, fz, def, aussehen, zeit, ausdruck);
    ctx.restore();
  }

  function zeichneFahrzeugLokal(ctx, fz, def, aussehen, zeit, ausdruck) {
    var form = KAROSSERIE[def.form] ? def.form : "buggy";
    var teile = KAROSSERIE[form](ctx, aussehen, zeit, fz);
    var kp = fz.kopf;
    var tempo = Math.hypot(fz.chassis.vx, fz.chassis.vy);
    var artRad = form === "traktor" ? "traktor" : form === "monster" ? "monster" : form === "mond" ? "mond" : "normal";

    // Federn
    fz.raeder.forEach(function (R) {
      zeichneFeder(ctx, R.ankerX, R.ankerY, R.lokalX, R.lokalY, Math.min(0.13, R.r * 0.3));
    });
    var o = outfitVon(aussehen), kind = kindVon(aussehen);
    var tk = koerperFuer(teile, kind);
    var kopf = { x: kp.x, y: kp.y + kind.groesse, r: KOPF_R };
    var fahrer = function () {
      zeichneAnzug(ctx, o, tk, kopf, KOPF_R);
      zeichneKind(ctx, kopf.x, kopf.y, KOPF_R, ausdruck, teile.raumhelm, kind, Math.min(1, tempo / 12), zeit);
    };
    teile.hinten();
    zeichneRuecken(ctx, o, tk, kopf, KOPF_R, zeit, tempo);   // immer hinter der Karosserie
    if (teile.fahrerZuerst || teile.fahrerVorDach) fahrer();
    teile.vorne();
    if (!teile.fahrerZuerst && !teile.fahrerVorDach && !teile.fahrerNachVorne) fahrer();
    if (teile.fahrerNachVorne) {
      // Fiete sitzt hinter einer Scheibe: nur durch das Fenster sichtbar
      ctx.save();
      ctx.beginPath();
      teile.scheibe.forEach(function (p, i) { if (i) ctx.lineTo(p[0], p[1]); else ctx.moveTo(p[0], p[1]); });
      ctx.closePath(); ctx.clip();
      fahrer();
      ctx.fillStyle = "rgba(220,240,255,0.18)"; ctx.fill();
      ctx.restore();
    }
    // Räder zuletzt (vorn)
    fz.raeder.forEach(function (R) { zeichneRad(ctx, R, R.lokalX, R.lokalY, artRad); });
  }

  /* Ballon-Hilfe nach einem Überschlag */
  function zeichneHilfe(ctx, K, hf, C, zeit) {
    if (!hf) return;
    var s = K.s;
    var u = hf.t / hf.dauer;
    var ankerX = sx(K, C.x), ankerY = sy(K, C.y + 1.2);
    var zielY = ankerY - 3.2 * s;
    var by;
    if (u < 0.28) by = -2 * s + (zielY + 2 * s) * (u / 0.28);
    else by = zielY;
    var bx = ankerX + Math.sin(zeit * 2) * 0.15 * s;
    var farben = ["#ff5b5b", "#ffd23f", "#2f6fd6", "#3cc35a", "#ff6fb5"];
    var lagen = [[-0.9, 0.1], [0, -0.45], [0.9, 0.1], [-0.45, -0.95], [0.5, -0.9]];
    for (var i = 0; i < lagen.length; i++) {
      var px = bx + lagen[i][0] * s, py = by + lagen[i][1] * s;
      ctx.strokeStyle = "rgba(30,44,82,0.55)"; ctx.lineWidth = Math.max(1, 0.03 * s);
      ctx.beginPath(); ctx.moveTo(px, py + 0.5 * s); ctx.lineTo(bx, by + 1.6 * s); ctx.stroke();
    }
    if (u >= 0.28) {
      ctx.beginPath(); ctx.moveTo(bx, by + 1.6 * s); ctx.lineTo(ankerX, ankerY); ctx.stroke();
    }
    for (i = 0; i < lagen.length; i++) {
      px = bx + lagen[i][0] * s; py = by + lagen[i][1] * s + Math.sin(zeit * 3 + i) * 0.06 * s;
      ctx.fillStyle = farben[i];
      ctx.beginPath(); ctx.ellipse(px, py, 0.45 * s, 0.56 * s, 0, 0, Math.PI * 2); ctx.fill();
      ctx.fillStyle = "rgba(255,255,255,0.5)";
      ctx.beginPath(); ctx.ellipse(px - 0.15 * s, py - 0.2 * s, 0.1 * s, 0.16 * s, -0.4, 0, Math.PI * 2); ctx.fill();
    }
    ctx.fillStyle = "#ffd23f";
    stern(ctx, bx, by + 1.6 * s, 0.18 * s, 5, 0.45); ctx.fill();
  }

  /* =========================================================================
     5b) GEIST (Geisterrennen zu zweit)
     Der Geist wird erst deckend in ein Hilfs-Canvas gezeichnet und dann
     halbdurchsichtig übertragen – so scheinen Räder und Karosserie nicht
     unschön durcheinander durch. g = { fz, def, aussehen, ausdruck, hilfe, name }
     ========================================================================= */
  var geistCanvas = null, geistCtx = null;

  function zeichneGeist(ctx, K, g, zeit) {
    var C = g.fz.chassis, s = K.s;
    var X = sx(K, C.x), Y = sy(K, C.y);
    // Kasten um das Fahrzeug (drehungsfest), bei Ballon-Hilfe nach oben verlängert –
    // anfangs schweben die Ballons vom oberen Bildrand herein (siehe zeichneHilfe)
    var R = (0.55 * g.def.groesse.laenge + 1.4) * s, nachOben = R;
    if (g.hilfe) nachOben = Math.max(R, 6.4 * s, g.hilfe.t / g.hilfe.dauer < 0.28 ? Y : 0);
    var links = X - R, oben = Y - nachOben, breite = 2 * R, hoehe = R + nachOben;
    if (links > K.b || links + breite < 0 || oben > K.h || oben + hoehe < 0) return false;
    // Eigene Ebene in CSS-Pixeln: auf Retina halbe Auflösung – für den
    // durchsichtigen Geist reicht das und spart drei Viertel der Pixel.
    var w = Math.ceil(breite), h = Math.ceil(hoehe);
    if (!geistCanvas) { geistCanvas = document.createElement("canvas"); }
    if (geistCanvas.width < w || geistCanvas.height < h) {
      geistCanvas.width = Math.max(w, geistCanvas.width); geistCanvas.height = Math.max(h, geistCanvas.height);
      geistCtx = null;
    }
    if (!geistCtx) geistCtx = geistCanvas.getContext("2d");
    geistCtx.setTransform(1, 0, 0, 1, 0, 0);
    geistCtx.clearRect(0, 0, w, h);
    geistCtx.setTransform(1, 0, 0, 1, -links, -oben);
    zeichneHilfe(geistCtx, K, g.hilfe, C, zeit);
    zeichneFahrzeug(geistCtx, K, g.fz, g.def, g.aussehen, zeit, g.ausdruck);
    ctx.save();
    ctx.globalAlpha = 0.5;
    ctx.drawImage(geistCanvas, 0, 0, w, h, links, oben, w, h);
    ctx.restore();
    // Namensschild über dem Geist
    var ty = Y - 2.3 * s - Math.sin(zeit * 2.5) * 0.08 * s;
    namensSchild(ctx, X, ty, "👻 " + g.name, Math.max(12, Math.min(20, 0.42 * s)), 0.85);
    return true;
  }

  function namensSchild(ctx, x, y, text, px, alpha) {
    ctx.save();
    ctx.globalAlpha = alpha;
    ctx.font = "800 " + Math.round(px) + "px 'Baloo 2', sans-serif";
    ctx.textAlign = "center"; ctx.textBaseline = "middle";
    var w = ctx.measureText(text).width + px * 1.1, h = px * 1.6;
    rundRechteck(ctx, x - w / 2, y - h / 2, w, h, h / 2);
    ctx.fillStyle = "rgba(29,44,84,0.85)"; ctx.fill();
    ctx.strokeStyle = "#f3c44a"; ctx.lineWidth = 2; ctx.stroke();
    ctx.fillStyle = "#ffffff";
    ctx.fillText(text, x, y + px * 0.05);
    ctx.restore();
  }

  /* Ist der Geist außerhalb des Bildes, zeigt ein Pfeil am Rand, wo er ist. */
  function zeichneGeistPfeil(ctx, K, g, eigen) {
    var gx = g.fz.chassis.x, abstand = Math.round(Math.abs(gx - eigen.x));
    var rechts = gx > eigen.x;
    var px = Math.max(14, Math.min(20, 0.42 * K.s));
    var y = Math.max(90, Math.min(K.h * 0.45, sy(K, g.fz.chassis.y + 1)));
    var text = rechts ? "👻 " + g.name + " " + abstand + " m ▶" : "◀ " + abstand + " m 👻 " + g.name;
    ctx.save();
    ctx.font = "800 " + Math.round(px) + "px 'Baloo 2', sans-serif";
    var w = ctx.measureText(text).width + px * 1.1;
    ctx.restore();
    var x = rechts ? K.b - w / 2 - 10 : w / 2 + 10;
    namensSchild(ctx, x, y, text, px, 0.92);
  }

  /* =========================================================================
     6) PARTIKEL, SCHWEBETEXTE, WETTER
     ========================================================================= */
  function Partikel() { this.liste = []; }
  Partikel.prototype.neu = function (p) { if (this.liste.length < 260) this.liste.push(p); };
  Partikel.prototype.aktualisiere = function (dt, g) {
    var L = this.liste;
    for (var i = L.length - 1; i >= 0; i--) {
      var p = L[i];
      p.t += dt;
      if (p.t >= p.dauer) { L.splice(i, 1); continue; }
      p.vy -= (p.schwer || 0) * g * dt;
      p.vx *= 1 - (p.reibung || 0) * dt; p.vy *= 1 - (p.reibung || 0) * dt;
      p.x += p.vx * dt; p.y += p.vy * dt;
      if (p.dreh) p.w += p.dreh * dt;
    }
  };
  Partikel.prototype.zeichne = function (ctx, K) {
    var L = this.liste;
    for (var i = 0; i < L.length; i++) {
      var p = L[i], u = p.t / p.dauer;
      var X = sx(K, p.x), Y = sy(K, p.y);
      ctx.globalAlpha = Math.max(0, 1 - u) * (p.alpha || 1);
      if (p.art === "staub" || p.art === "rauch") {
        ctx.fillStyle = p.farbe;
        ctx.beginPath(); ctx.arc(X, Y, (p.r0 + (p.r1 - p.r0) * u) * K.s, 0, Math.PI * 2); ctx.fill();
      } else if (p.art === "funkel") {
        ctx.fillStyle = p.farbe;
        stern(ctx, X, Y, p.r0 * K.s * (1 - u * 0.5), 4, 0.35); ctx.fill();
      } else if (p.art === "konfetti") {
        ctx.save(); ctx.translate(X, Y); ctx.rotate(p.w || 0);
        ctx.fillStyle = p.farbe; ctx.fillRect(-0.09 * K.s, -0.05 * K.s, 0.18 * K.s, 0.1 * K.s);
        ctx.restore();
      }
    }
    ctx.globalAlpha = 1;
  };

  function Wetter() { this.teile = []; this.art = null; this.letztesX = null; }
  Wetter.prototype.setze = function (art, K) {
    this.art = art; this.teile = [];
    if (!art) return;
    var n = art === "sterne" ? 70 : art === "funken" ? 30 : 46;
    for (var i = 0; i < n; i++) {
      this.teile.push({ x: Math.random() * (K.b || 800), y: Math.random() * (K.h || 400), p: Math.random() * 6.28, g: 0.5 + Math.random() });
    }
  };
  Wetter.prototype.zeichne = function (ctx, K, dt, zeit, hinten) {
    var art = this.art;
    if (!art || (art === "sterne") !== hinten) return;
    var dx = this.letztesX === null ? 0 : (K.x - this.letztesX) * K.s;
    this.letztesX = K.x;
    var B = K.b, H = K.h;
    for (var i = 0; i < this.teile.length; i++) {
      var t = this.teile[i];
      if (art === "sterne") {
        var x = ((t.x - K.x * K.s * 0.02) % B + B) % B;
        ctx.fillStyle = "rgba(255,255,255," + (0.4 + 0.5 * Math.abs(Math.sin(zeit * 1.5 + t.p))) + ")";
        ctx.fillRect(x, t.y * 0.65, 1.5 * t.g, 1.5 * t.g);
        continue;
      }
      if (art === "schnee") { t.y += (30 + 25 * t.g) * dt; t.x += Math.sin(zeit + t.p) * 12 * dt - dx * 0.6; }
      else if (art === "blaetter") { t.y += (25 + 15 * t.g) * dt; t.x += Math.sin(zeit * 0.8 + t.p) * 30 * dt - dx * 0.6; }
      else if (art === "konfetti") { t.y += (22 + 12 * t.g) * dt; t.x += Math.sin(zeit + t.p) * 15 * dt - dx * 0.6; }
      else if (art === "funken") { t.y -= (30 + 30 * t.g) * dt; t.x += Math.sin(zeit * 2 + t.p) * 10 * dt - dx * 0.6; }
      if (t.y > H + 10) { t.y = -10; t.x = Math.random() * B; }
      if (t.y < -10) { t.y = H + 10; t.x = Math.random() * B; }
      t.x = ((t.x % (B + 20)) + B + 20) % (B + 20) - 10;
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
      }
    }
  };

  function zeichneTexte(ctx, K, texte) {
    for (var i = 0; i < texte.length; i++) {
      var t = texte[i], u = t.t / t.dauer;
      var X = sx(K, t.x), Y = sy(K, t.y) - u * 1.4 * K.s;
      var gr = (t.gross ? 0.75 : 0.5) * K.s * (u < 0.15 ? 0.6 + u / 0.15 * 0.4 : 1);
      ctx.globalAlpha = u > 0.7 ? (1 - u) / 0.3 : 1;
      ctx.font = "800 " + Math.round(gr) + "px 'Baloo 2', sans-serif";
      ctx.textAlign = "center"; ctx.textBaseline = "middle";
      ctx.lineWidth = Math.max(2, gr * 0.16); ctx.strokeStyle = TINTE; ctx.lineJoin = "round";
      ctx.strokeText(t.text, X, Y);
      ctx.fillStyle = t.farbe || "#ffd23f";
      ctx.fillText(t.text, X, Y);
    }
    ctx.globalAlpha = 1;
  }

  /* =========================================================================
     7) KRÄFTE-PFEILE ("Physik sichtbar machen")
     ========================================================================= */
  function pfeil(ctx, x0, y0, x1, y1, farbe, dicke) {
    var dx = x1 - x0, dy = y1 - y0, l = Math.hypot(dx, dy);
    if (l < 2) return;
    var ux = dx / l, uy = dy / l, sp = Math.min(10, l * 0.4);
    ctx.strokeStyle = farbe; ctx.fillStyle = farbe; ctx.lineWidth = dicke; ctx.lineCap = "round";
    ctx.beginPath(); ctx.moveTo(x0, y0); ctx.lineTo(x1 - ux * sp * 0.6, y1 - uy * sp * 0.6); ctx.stroke();
    ctx.beginPath(); ctx.moveTo(x1, y1);
    ctx.lineTo(x1 - ux * sp - uy * sp * 0.5, y1 - uy * sp + ux * sp * 0.5);
    ctx.lineTo(x1 - ux * sp + uy * sp * 0.5, y1 - uy * sp - ux * sp * 0.5);
    ctx.closePath(); ctx.fill();
  }

  function zeichneKraefte(ctx, K, fahrt) {
    var fz = fahrt.fz, C = fz.chassis, g = fahrt.welt.schwerkraft;
    var mGes = fz.chassis.m + fz.raeder.reduce(function (s, R) { return s + R.k.m; }, 0);
    var mProN = 1.6 / (mGes * 9.81);        // Gewichtskraft (Erde) ≙ 1,6 m Pfeillänge
    // Gewichtskraft am Schwerpunkt
    var X = sx(K, C.x), Y = sy(K, C.y);
    pfeil(ctx, X, Y, X, Y + mGes * g * mProN * K.s, "#8e5bd8", 4);
    ctx.fillStyle = "#8e5bd8"; ctx.beginPath(); ctx.arc(X, Y, 5, 0, Math.PI * 2); ctx.fill();
    fz.raeder.forEach(function (R) {
      var ko = R.kontakt;
      if (!ko.aktiv || ko.kraftN <= 1) return;
      var px = R.k.x - ko.nx * R.r, py = R.k.y - ko.ny * R.r;
      var X0 = sx(K, px), Y0 = sy(K, py);
      var ln = ko.kraftN * mProN * K.s;
      pfeil(ctx, X0, Y0, X0 + ko.nx * ln, Y0 - ko.ny * ln, "#28c08a", 4);
      var tx = ko.ny, ty = -ko.nx, lt = ko.kraftT * mProN * K.s;
      pfeil(ctx, X0, Y0, X0 + tx * lt, Y0 - ty * lt, "#ff9e2c", 4);
    });
    // Legende
    ctx.font = "700 12px 'Nunito', sans-serif"; ctx.textAlign = "left"; ctx.textBaseline = "middle";
    var lx = 14, ly = 78;
    [["#8e5bd8", "Gewichtskraft"], ["#28c08a", "Normalkraft"], ["#ff9e2c", "Reibung/Antrieb"]].forEach(function (e, i) {
      ctx.fillStyle = "rgba(255,255,255,0.8)"; rundRechteck(ctx, lx - 4, ly + i * 18 - 8, 128, 16, 6); ctx.fill();
      ctx.fillStyle = e[0]; ctx.fillRect(lx, ly + i * 18 - 3, 14, 6);
      ctx.fillStyle = TINTE; ctx.fillText(e[1], lx + 20, ly + i * 18);
    });
  }

  /* =========================================================================
     8) RUNDINSTRUMENTE (Tacho + Drehzahl), unten in der Mitte
     ========================================================================= */
  function zeichneInstrument(ctx, x, y, r, wert, max, titel, beschriftung, rotAb) {
    ctx.save();
    ctx.translate(x, y);
    ctx.fillStyle = "rgba(29,44,84,0.88)";
    ctx.beginPath(); ctx.arc(0, 0, r, Math.PI * 0.8, Math.PI * 2.2); ctx.lineTo(r * 0.7, r * 0.55); ctx.lineTo(-r * 0.7, r * 0.55); ctx.closePath(); ctx.fill();
    ctx.strokeStyle = "#f3c44a"; ctx.lineWidth = 2; ctx.stroke();
    var a0 = Math.PI * 0.85, a1 = Math.PI * 2.15;
    if (rotAb) {
      ctx.strokeStyle = "rgba(232,69,60,0.85)"; ctx.lineWidth = r * 0.12;
      ctx.beginPath(); ctx.arc(0, 0, r * 0.8, a0 + (a1 - a0) * rotAb, a1); ctx.stroke();
    }
    ctx.strokeStyle = "rgba(255,255,255,0.7)"; ctx.lineWidth = 1.5;
    for (var i = 0; i <= 10; i++) {
      var a = a0 + (a1 - a0) * i / 10;
      var l = i % 5 === 0 ? 0.68 : 0.76;
      ctx.beginPath(); ctx.moveTo(Math.cos(a) * r * l, Math.sin(a) * r * l); ctx.lineTo(Math.cos(a) * r * 0.88, Math.sin(a) * r * 0.88); ctx.stroke();
    }
    var w = a0 + (a1 - a0) * Math.max(0, Math.min(1, wert / max));
    ctx.strokeStyle = "#ff9e2c"; ctx.lineWidth = 3; ctx.lineCap = "round";
    ctx.beginPath(); ctx.moveTo(0, 0); ctx.lineTo(Math.cos(w) * r * 0.78, Math.sin(w) * r * 0.78); ctx.stroke();
    ctx.fillStyle = "#f3c44a"; ctx.beginPath(); ctx.arc(0, 0, r * 0.1, 0, Math.PI * 2); ctx.fill();
    ctx.fillStyle = "#ffffff"; ctx.textAlign = "center"; ctx.textBaseline = "middle";
    ctx.font = "800 " + Math.round(r * 0.36) + "px 'Baloo 2', sans-serif";
    ctx.fillText(beschriftung, 0, r * 0.36);
    ctx.font = "700 " + Math.round(r * 0.2) + "px 'Nunito', sans-serif";
    ctx.fillStyle = "#aebce6";
    ctx.fillText(titel, 0, -r * 0.35);
    ctx.restore();
  }

  function zeichneInstrumente(ctx, K, fahrt) {
    var st = fahrt.fz.status;
    var r = Math.max(26, Math.min(44, K.h * 0.085));
    var y = K.h - r * 0.75 - 8;
    var kmh = Math.round(Math.abs(st.vorwaerts) * 3.6);
    var vmaxKmh = Math.max(40, Math.ceil(fahrt.werte.motor.vmax * 3.6 / 20) * 20 + 20);
    zeichneInstrument(ctx, K.b / 2 - r * 1.15, y, r, kmh, vmaxKmh, "km/h", String(kmh), 0);
    var u = Math.min(1.2, st.drehzahl) / 1.2;
    zeichneInstrument(ctx, K.b / 2 + r * 1.15, y, r, u, 1, "Drehzahl", Math.round(u * 6) + "", 0.82);
  }

  /* =========================================================================
     9) GESAMTE SZENE
     sz = { fahrt, kamera, zeit, dt, partikel, texte, wetter, aussehen, kraefte, instrumente, ausdruck }
     ========================================================================= */
  function zeichneSzene(ctx, sz) {
    var K = sz.kamera, f = sz.fahrt, welt = f.welt, gel = f.gelaende, z = sz.zeit;
    zeichneHimmel(ctx, K, welt, z, sz.himmelPerCss);
    zeichneWolken(ctx, K, welt, z);
    sz.wetter.zeichne(ctx, K, sz.dt, z, true);
    zeichneBerge(ctx, K, welt);
    var b = sichtbereich(K, gel);
    zeichneDeko(ctx, K, gel, b[2], b[3], sz.dpr || 1);
    zeichneGelaende(ctx, K, gel, welt, z);
    zeichneSchilder(ctx, K, gel, b[2], b[3]);
    zeichneStartZiel(ctx, K, gel, z);
    zeichneItems(ctx, K, gel, z, b[2], b[3]);
    var geistSichtbar = sz.geist ? zeichneGeist(ctx, K, sz.geist, z) : true;
    zeichneHilfe(ctx, K, f.hilfe, f.fz.chassis, z);
    zeichneFahrzeug(ctx, K, f.fz, f.def, sz.aussehen, z, sz.ausdruck);
    sz.partikel.zeichne(ctx, K);
    zeichneTexte(ctx, K, sz.texte);
    sz.wetter.zeichne(ctx, K, sz.dt, z, false);
    if (sz.geist && !geistSichtbar) zeichneGeistPfeil(ctx, K, sz.geist, f.fz.chassis);
    if (sz.kraefte) zeichneKraefte(ctx, K, f);
    if (sz.instrumente) zeichneInstrumente(ctx, K, f);
  }

  /* Vorschau in der Garage: Fahrzeug auf kleinem Boden, leicht wippend */
  var vorschauCache = {};
  function zeichneVorschau(ctx, b, h, def, aussehen, zeit, ohneBuehne) {
    var c = vorschauCache[def.id];
    if (!c) {
      var w = FF.berechneWerte(def, {}, "normal");
      var bodenFlach = {
        dx: 0.5, x0: -40, h: [],
        hoeheBei: function () { return 0; }, steigungBei: function () { return 0; }
      };
      for (var i = 0; i < 200; i++) bodenFlach.h.push(0);
      c = vorschauCache[def.id] = FF.Physik.baueFahrzeug(w, 0, bodenFlach);
      // statische Einfederung grob vorwegnehmen
      c.raeder.forEach(function (R) { R.k.y += 0.06; });
    }
    var fz = c;
    // Höhe aus Rädern, Umriss, Dach und Kopf bestimmen (Monstertruck ist hoch!)
    var unten = Infinity, oben = -Infinity;
    fz.raeder.forEach(function (R) { unten = Math.min(unten, R.ankerY - R.L0 - R.r); });
    def.huelle.concat(def.dach || []).forEach(function (p) { oben = Math.max(oben, p[1]); });
    oben = Math.max(oben, def.kopf.y + def.kopf.r * (def.form === "mond" ? 1.6 : 1.15));
    var laenge = def.groesse.laenge + 0.8, hoehe = (oben - unten) * 1.12 + 0.3;
    var s = Math.min(b / laenge, h / hoehe) * 0.92;
    var bodenY = h * 0.86;
    if (!ohneBuehne) {
      // Boden + Schatten
      ctx.clearRect(0, 0, b, h);
      ctx.fillStyle = "rgba(30,44,82,0.15)";
      ctx.beginPath(); ctx.ellipse(b / 2, bodenY + 4, laenge * s * 0.45, 8, 0, 0, Math.PI * 2); ctx.fill();
    }
    var rad0 = fz.raeder[0];
    var unterkante = rad0.k.y - rad0.r;
    fz.chassis.a = Math.sin(zeit * 2.2) * 0.012;
    fz.raeder.forEach(function (R) { R.k.a = -zeit * 2.5; });
    var K = { x: 0, y: unterkante, s: s, b: b, h: h, ankerX: 0.5, ankerY: bodenY / h };
    var wippen = Math.sin(zeit * 2.2) * 0.012;
    fz.chassis.vx = 7;                                   // nur für den wehenden Umhang
    fz.chassis.y += wippen;
    zeichneFahrzeug(ctx, K, fz, def, aussehen, zeit, "normal");
    fz.chassis.y -= wippen;
  }

  /* Fiete als Brustbild bzw. nur Kopf – mit exakt denselben Funktionen wie im
     Auto (Garage-Outfits, Info, Fortschrittsleiste, Ergebnis). */
  var PORTRAIT_TEILE = { fahrerKoerper: [-0.3, -0.8, 0.6, 0.52], arme: [0.14, -0.38, 0.44, -0.1] };
  function zeichnePortrait(ctx, b, h, aussehen, ausdruck, zeit, nurKopf) {
    var o = outfitVon(aussehen), kind = kindVon(aussehen), g = kind.groesse;
    var tk = koerperFuer(PORTRAIT_TEILE, kind), kp = { x: 0, y: g, r: KOPF_R }, s;
    var lang = kind.frisur === "lang";
    ctx.save();
    if (nurKopf) {
      s = Math.min(b, h) / (lang ? 0.98 : 0.9);
      ctx.translate(b / 2 + 0.05 * s, h / 2 + (g + (lang ? -0.03 : 0.07)) * s);
    } else {
      s = Math.min(b / 1.2, h / (1.32 + g));
      ctx.translate(b / 2 + 0.08 * s, h / 2 - (0.18 - g / 2) * s);
    }
    ctx.scale(s, -s);
    if (!nurKopf) {
      zeichneRuecken(ctx, o, tk, kp, KOPF_R, zeit || 0, 6);
      zeichneAnzug(ctx, o, tk, kp, KOPF_R);
    }
    zeichneKind(ctx, 0, g, KOPF_R, ausdruck || "normal", false, kind, nurKopf ? 0 : 0.5, zeit || 0);
    ctx.restore();
  }

  FF.Grafik = {
    zeichneSzene: zeichneSzene,
    zeichneVorschau: zeichneVorschau,
    zeichnePortrait: zeichnePortrait,
    zeichneMuenze: zeichneMuenze,
    Partikel: Partikel,
    Wetter: Wetter,
    emojiSprite: emojiSprite,
    himmelCss: himmelCss,
    hell: hell, dunkel: dunkel
  };
})();
