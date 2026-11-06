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
  var spriteCache = {}, spriteAnzahl = 0;
  function emojiSprite(emoji, px, q) {
    q = q || 1;
    px = Math.max(8, Math.round(px / 4) * 4);
    var key = emoji + "|" + px + "|" + q;
    var c = spriteCache[key];
    if (c) return c;
    if (++spriteAnzahl > 400) { spriteCache = {}; spriteAnzahl = 1; }   // Speicher begrenzen (viele Welten, Zoomstufen, Drehen)
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
    // in Stufen vorgemalt, stufenlos verkleinert gezeichnet (kein Größensprung beim Zoomen)
    var st = FF.Requisiten.stufe(px), c = emojiSprite(emoji, st, q), f = px / st;
    ctx.save();
    ctx.setTransform(spiegeln ? -f : f, 0, 0, f, x * q, y * q);
    ctx.drawImage(c, -c.width / 2, -c.height / 2);
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
     4) STRECKE, DEKO, SCHILDER, MÜNZEN, KANISTER, ZIEL
     ========================================================================= */
  function sichtbereich(K, gel) {
    var x0 = weltX(K, -60), x1 = weltX(K, K.b + 60);
    var i0 = Math.max(0, Math.floor((x0 - gel.x0) / gel.dx));
    var i1 = Math.min(gel.h.length - 1, Math.ceil((x1 - gel.x0) / gel.dx));
    return [i0, i1, x0, x1];
  }

  function zeichneDeko(ctx, K, gel, x0, x1, q, zeit) {
    var D = gel.deko;
    for (var i = 0; i < D.length; i++) {
      var d = D[i];
      if (d.x < x0 - 3 || d.x > x1 + 3) continue;
      var px = d.groesse * K.s;
      // Am Hang: auf den tiefsten Bodenpunkt unter der ganzen Breite stellen – der Rest
      // steckt im Boden (der danach drübergemalt wird), nichts hängt in der Luft
      if (d.fuss === undefined) {
        var hb = d.groesse * (d.typ ? FF.Requisiten.breite(d.typ) : 0.8) * 0.45;
        var hs = [gel.hoeheBei(d.x - hb), gel.hoeheBei(d.x), gel.hoeheBei(d.x + hb), gel.hoeheBei(d.x - hb / 2), gel.hoeheBei(d.x + hb / 2)];
        d.fuss = Math.min.apply(null, hs);
        // Auf einer Kuppe oder Kante stünde ein Haus halb im Boden (sieht abgeschnitten
        // aus) – dort lieber gar nicht hinstellen. Schwebende Deko (Fische …) bleibt.
        d.weg = !d.hoch && !d.schwimmt && Math.max.apply(null, hs) - d.fuss > d.groesse * 0.3;
      }
      if (d.weg) continue;
      var yf = d.fuss;
      if (d.hoch) yf += d.hoch + Math.sin(zeit * 1.3 + d.x) * 0.15;          // Fische, Bienen schweben
      else if (d.schwimmt) yf += Math.sin(zeit * 2.2 + d.x) * 0.04;           // Ente in der Pfütze
      if (d.typ) FF.Requisiten.zeichne(ctx, d.typ, d.variante, sx(K, d.x), sy(K, yf), px, d.spiegeln, q);
      else zeichneEmoji(ctx, d.emoji, sx(K, d.x), sy(K, yf) - px * 0.42, px, d.spiegeln, q);
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

  /* Loopings: Achterbahn-Schiene als Ring mit Stützen. Das Auto fährt innen auf
     der Schiene (Radius R), darum liegt sie hinter dem Auto. */
  function zeichneLoopings(ctx, K, gel) {
    var Ls = gel.loopings;
    if (!Ls || !Ls.length) return;
    var s = K.s;
    for (var i = 0; i < Ls.length; i++) {
      var L = Ls[i], X = sx(K, L.xc);
      if (X < -(L.R + 2) * s || X > K.b + (L.R + 2) * s) continue;
      var Y = sy(K, gel.loopMitte(L)), R = L.R * s, boden = sy(K, gel.hoeheBei(L.xc));
      // Stützen
      ctx.strokeStyle = "#5a3ea8"; ctx.lineWidth = Math.max(2, 0.22 * s); ctx.lineCap = "round";
      [[-0.95, -1.5], [0.95, 1.5], [-0.55, -0.6], [0.55, 0.6]].forEach(function (q) {
        var w = Math.PI / 2 - q[0] * Math.PI / 2;            // Ansatzpunkt am Ring
        ctx.beginPath(); ctx.moveTo(X + Math.cos(w) * (R + 0.3 * s), Y - Math.sin(w) * (R + 0.3 * s));
        ctx.lineTo(X + q[1] * 1.1 * R, boden); ctx.stroke();
      });
      // Schiene: Ring mit rot-weißen Abschnitten, Rand dunkel
      var dicke = 0.34 * s, rm = R + dicke / 2;
      ctx.lineCap = "butt"; ctx.lineWidth = dicke;
      for (var k = 0; k < 24; k++) {
        ctx.strokeStyle = k % 2 ? "#ffffff" : "#ff4f6d";
        ctx.beginPath(); ctx.arc(X, Y, rm, k * Math.PI / 12, (k + 1) * Math.PI / 12 + 0.01); ctx.stroke();
      }
      ctx.strokeStyle = "#2b1d5c"; ctx.lineWidth = Math.max(1, 0.06 * s);
      ctx.beginPath(); ctx.arc(X, Y, R, 0, Math.PI * 2); ctx.stroke();
      ctx.beginPath(); ctx.arc(X, Y, R + dicke, 0, Math.PI * 2); ctx.stroke();
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

  var OBST_EMOJI = ["🍎", "🍐", "🍒", "🍑", "🍊", "🍌", "🍓"];
  function zeichneItems(ctx, K, gel, zeit, x0, x1, akku, q) {
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
      (akku === "h2" ? zeichneH2Flasche : akku ? zeichneBatterie : zeichneKanister)(ctx, sx(K, t.x), sy(K, t.y + 0.5 + Math.sin(zeit * 3 + t.x) * 0.08), K.s, zeit);
    }
    var RK = gel.raketen || [];
    for (i = 0; i < RK.length; i++) {
      var rk = RK[i];
      if (rk.weg || rk.x < x0 - 2 || rk.x > x1 + 2) continue;
      zeichneRaketenKanister(ctx, sx(K, rk.x), sy(K, rk.y + 0.6 + Math.sin(zeit * 3.4 + rk.x) * 0.1), K.s, zeit);
    }
    var OB = gel.obst || [];
    for (i = 0; i < OB.length; i++) {                     // Obst (Mini-Turbo): leuchtet orange, hüpft leicht
      var ob = OB[i];
      if (ob.weg || ob.x < x0 - 2 || ob.x > x1 + 2) continue;
      var OX = sx(K, ob.x), OY = sy(K, ob.y + Math.abs(Math.sin(zeit * 3 + ob.x)) * 0.18);
      var gl = ctx.createRadialGradient(OX, OY, 0, OX, OY, K.s * 0.8);
      gl.addColorStop(0, "rgba(255,190,80," + (0.45 + 0.2 * Math.sin(zeit * 6 + ob.x)) + ")"); gl.addColorStop(1, "rgba(255,190,80,0)");
      ctx.fillStyle = gl; ctx.beginPath(); ctx.arc(OX, OY, K.s * 0.8, 0, Math.PI * 2); ctx.fill();
      zeichneEmoji(ctx, OBST_EMOJI[ob.art % OBST_EMOJI.length], OX, OY, K.s * 0.75, false, q || 1);
    }
  }

  /* 🚀 Raketen-Kanister: lila Dose mit Rakete – lädt den Boost-Knopf */
  function zeichneRaketenKanister(ctx, X, Y, s, zeit) {
    var w = 0.66 * s, h = 0.84 * s;
    ctx.save();
    ctx.translate(X, Y);
    var gl = ctx.createRadialGradient(0, 0, 0, 0, 0, s * 1.25);
    gl.addColorStop(0, "rgba(190,150,255," + (0.5 + 0.25 * Math.sin(zeit * 6)) + ")");
    gl.addColorStop(1, "rgba(190,150,255,0)");
    ctx.fillStyle = gl; ctx.beginPath(); ctx.arc(0, 0, s * 1.25, 0, Math.PI * 2); ctx.fill();
    rundRechteck(ctx, -w / 2, -h / 2, w, h, 0.16 * s);
    ctx.fillStyle = "#7a4dff"; ctx.fill();
    ctx.strokeStyle = "#3d1f9e"; ctx.lineWidth = Math.max(1, 0.06 * s); ctx.stroke();
    // kleine Rakete (Bildschirm-Koordinaten: y nach unten), schräg nach oben rechts
    ctx.rotate(0.5);
    var u = s * 0.1;
    ctx.fillStyle = "#ffb02e";
    ctx.beginPath(); ctx.moveTo(-1.1 * u, 2.2 * u); ctx.lineTo(0, (4.2 + Math.sin(zeit * 30)) * u); ctx.lineTo(1.1 * u, 2.2 * u); ctx.fill();
    ctx.fillStyle = "#e8453c";
    ctx.beginPath(); ctx.moveTo(-1.2 * u, 0.8 * u); ctx.lineTo(-2.2 * u, 2.6 * u); ctx.lineTo(-1.2 * u, 2.2 * u); ctx.fill();
    ctx.beginPath(); ctx.moveTo(1.2 * u, 0.8 * u); ctx.lineTo(2.2 * u, 2.6 * u); ctx.lineTo(1.2 * u, 2.2 * u); ctx.fill();
    ctx.fillStyle = "#ffffff";
    ctx.beginPath(); ctx.moveTo(0, -3.4 * u); ctx.quadraticCurveTo(1.6 * u, -1.4 * u, 1.2 * u, 2.4 * u);
    ctx.lineTo(-1.2 * u, 2.4 * u); ctx.quadraticCurveTo(-1.6 * u, -1.4 * u, 0, -3.4 * u); ctx.fill();
    ctx.fillStyle = "#3aa0ff"; ctx.beginPath(); ctx.arc(0, -0.6 * u, 0.6 * u, 0, Math.PI * 2); ctx.fill();
    ctx.restore();
  }

  /* Für das E-Auto sind die Kanister grüne Batterien */
  function zeichneBatterie(ctx, X, Y, s, zeit) {
    var w = 0.56 * s, h = 0.8 * s;
    ctx.save();
    ctx.translate(X, Y);
    var gl = ctx.createRadialGradient(0, 0, 0, 0, 0, s * 1.1);
    gl.addColorStop(0, "rgba(150,255,210," + (0.45 + 0.2 * Math.sin(zeit * 5)) + ")");
    gl.addColorStop(1, "rgba(150,255,210,0)");
    ctx.fillStyle = gl; ctx.beginPath(); ctx.arc(0, 0, s * 1.1, 0, Math.PI * 2); ctx.fill();
    ctx.fillStyle = "#3b4566"; rundRechteck(ctx, -w * 0.2, -h * 0.62, w * 0.4, h * 0.14, 0.04 * s); ctx.fill();
    rundRechteck(ctx, -w / 2, -h / 2, w, h, 0.12 * s);
    ctx.fillStyle = "#2fcf7d"; ctx.fill();
    ctx.strokeStyle = "#16824c"; ctx.lineWidth = Math.max(1, 0.06 * s); ctx.stroke();
    ctx.scale(s, -s);
    blitzForm(ctx, 0, 0, 0.5);
    ctx.fillStyle = "#ffe066"; ctx.fill();
    ctx.restore();
  }

  /* Blaue Wasserstoff-Flasche (H₂-Blubber): Druckflasche mit Ventil und „H₂“ */
  function zeichneH2Flasche(ctx, X, Y, s, zeit) {
    var w = 0.46 * s, h = 0.82 * s;
    ctx.save();
    ctx.translate(X, Y);
    var gl = ctx.createRadialGradient(0, 0, 0, 0, 0, s * 1.1);
    gl.addColorStop(0, "rgba(140,210,255," + (0.45 + 0.2 * Math.sin(zeit * 5)) + ")");
    gl.addColorStop(1, "rgba(140,210,255,0)");
    ctx.fillStyle = gl; ctx.beginPath(); ctx.arc(0, 0, s * 1.1, 0, Math.PI * 2); ctx.fill();
    ctx.fillStyle = "#8f9ab3"; rundRechteck(ctx, -w * 0.16, -h * 0.66, w * 0.32, h * 0.16, 0.03 * s); ctx.fill();   // Ventil
    ctx.fillStyle = "#3b4566"; rundRechteck(ctx, -w * 0.36, -h * 0.7, w * 0.72, h * 0.07, 0.02 * s); ctx.fill();   // Handrad
    rundRechteck(ctx, -w / 2, -h / 2, w, h, w * 0.48);
    var g = ctx.createLinearGradient(-w / 2, 0, w / 2, 0);
    g.addColorStop(0, "#2f7fe0"); g.addColorStop(0.35, "#7cc4ff"); g.addColorStop(1, "#1f5fb8");
    ctx.fillStyle = g; ctx.fill();
    ctx.strokeStyle = "#163f80"; ctx.lineWidth = Math.max(1, 0.06 * s); ctx.stroke();
    ctx.font = "800 " + Math.round(0.34 * s) + "px 'Baloo 2', sans-serif";
    ctx.textAlign = "center"; ctx.textBaseline = "middle"; ctx.fillStyle = "#ffffff";
    ctx.fillText("H₂", 0, 0.04 * s);
    ctx.restore();
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

  /* Muster (Aufkleber) nur innerhalb des Karosserie-Umrisses pfad() */
  function musterZeichnen(ctx, muster, x0, x1, y0, y1, zeit, pfad) {
    if (!muster || muster === "keins") return;
    ctx.save();
    if (pfad) pfad();
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
     DIE KINDER: Gesicht, Haare, Brille und Varianten (Cap, Dutt …) zeichnet
     kinder.js (FF.Kinder, nach einem Foto der echten Fiete und Jonte), die
     Körpermaße stehen in CONFIG.kinder. Beide schauen nach vorn (+x).
     ausdruck: normal | freude | staunen
     ========================================================================= */
  function kindVon(aussehen) {
    return (aussehen && aussehen.kind) || FF.CONFIG.kinder[0];
  }

  function zeichneKind(ctx, x, y, r, ausdruck, raumhelm, kind, wind, zeit) {
    FF.Kinder.zeichneKopf(ctx, x, y, r, ausdruck, raumhelm, kind || FF.CONFIG.kinder[0], wind || 0, zeit || 0);
  }

  /* Körpermaße des Kindes: schlanker = schmaler Oberkörper, größer = längerer
     Oberkörper und Kopf weiter oben. */
  function koerperFuer(teile, kind) {
    var b = kind.breite, g = kind.groesse, k = teile.fahrerKoerper, ar = teile.arme;
    return {
      haut: FF.Kinder.aussehenVon(kind).haut,
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

  /* Gekaufte Felgen (config.felgen) über die normale Felge malen; rr = Felgenradius */
  var felgeJetzt = "standard";
  function felgenStil(ctx, rr) {
    var st = felgeJetzt, i;
    if (!st || st === "standard") return;
    if (st === "gold") {
      var g = ctx.createRadialGradient(-rr * 0.3, rr * 0.3, rr * 0.05, 0, 0, rr);
      g.addColorStop(0, "#fff6c8"); g.addColorStop(0.6, "#f3c44a"); g.addColorStop(1, "#b9851c");
      ctx.fillStyle = g; ctx.beginPath(); ctx.arc(0, 0, rr, 0, Math.PI * 2); ctx.fill();
      ctx.strokeStyle = "#a8781a"; ctx.lineWidth = rr * 0.12;
      for (i = 0; i < 6; i++) { var w = i * Math.PI / 3; ctx.beginPath(); ctx.moveTo(Math.cos(w) * rr * 0.2, Math.sin(w) * rr * 0.2); ctx.lineTo(Math.cos(w) * rr * 0.9, Math.sin(w) * rr * 0.9); ctx.stroke(); }
    } else if (st === "stern") {
      ctx.fillStyle = "#2f6fd6"; ctx.beginPath(); ctx.arc(0, 0, rr, 0, Math.PI * 2); ctx.fill();
      stern(ctx, 0, 0, rr * 0.85, 5, 0.45); ctx.fillStyle = "#ffd23f"; ctx.fill();
    } else if (st === "blume") {
      ctx.fillStyle = "#ffffff"; ctx.beginPath(); ctx.arc(0, 0, rr, 0, Math.PI * 2); ctx.fill();
      ctx.fillStyle = "#ff6fb5";
      for (i = 0; i < 6; i++) { var wb = i * Math.PI / 3; ctx.beginPath(); ctx.arc(Math.cos(wb) * rr * 0.5, Math.sin(wb) * rr * 0.5, rr * 0.32, 0, Math.PI * 2); ctx.fill(); }
      ctx.fillStyle = "#ffd23f"; ctx.beginPath(); ctx.arc(0, 0, rr * 0.3, 0, Math.PI * 2); ctx.fill();
    } else if (st === "neon") {
      ctx.fillStyle = "#1e2c52"; ctx.beginPath(); ctx.arc(0, 0, rr, 0, Math.PI * 2); ctx.fill();
      ctx.strokeStyle = "#6ff3ff"; ctx.lineWidth = rr * 0.16; ctx.beginPath(); ctx.arc(0, 0, rr * 0.75, 0, Math.PI * 2); ctx.stroke();
      ctx.strokeStyle = "#ff6fd8"; ctx.lineWidth = rr * 0.1;
      for (i = 0; i < 3; i++) { var wn = i * Math.PI * 2 / 3; ctx.beginPath(); ctx.moveTo(0, 0); ctx.lineTo(Math.cos(wn) * rr * 0.6, Math.sin(wn) * rr * 0.6); ctx.stroke(); }
    } else if (st === "regenbogen") {
      var fb = ["#ff5b5b", "#ff9e2c", "#ffd23f", "#3cc35a", "#2f6fd6", "#8e5bd8"];
      for (i = 0; i < 6; i++) { ctx.fillStyle = fb[i]; ctx.beginPath(); ctx.moveTo(0, 0); ctx.arc(0, 0, rr, i * Math.PI / 3, (i + 1) * Math.PI / 3); ctx.closePath(); ctx.fill(); }
    }
    ctx.fillStyle = "#ffffff"; ctx.beginPath(); ctx.arc(0, 0, rr * 0.16, 0, Math.PI * 2); ctx.fill();
  }

  function zeichneRad(ctx, R, lx, ly, art) {
    var r = R.r, a = R.k.a;
    ctx.save();
    ctx.translate(lx, ly);
    ctx.rotate(a - R.chassisWinkel);
    if (art === "lok") {                     // Dampf-Lok: Stahlreifen, rote Speichen, Gegengewicht
      ctx.fillStyle = "#3d4352"; ctx.beginPath(); ctx.arc(0, 0, r, 0, Math.PI * 2); ctx.fill();
      ctx.fillStyle = "#9aa3b8"; ctx.beginPath(); ctx.arc(0, 0, r * 0.97, 0, Math.PI * 2); ctx.fill();
      ctx.fillStyle = "#c8322b"; ctx.beginPath(); ctx.arc(0, 0, r * 0.84, 0, Math.PI * 2); ctx.fill();
      ctx.fillStyle = "#7c1a16"; ctx.beginPath(); ctx.arc(0, 0, r * 0.7, 0, Math.PI * 2); ctx.fill();
      ctx.strokeStyle = "#c8322b"; ctx.lineWidth = r * 0.09;
      var nS = r > 0.3 ? 12 : 8;
      for (var s = 0; s < nS; s++) {
        var ws = s * Math.PI * 2 / nS;
        ctx.beginPath(); ctx.moveTo(Math.cos(ws) * r * 0.15, Math.sin(ws) * r * 0.15); ctx.lineTo(Math.cos(ws) * r * 0.74, Math.sin(ws) * r * 0.74); ctx.stroke();
      }
      if (r > 0.3) {                         // Gegengewicht gegenüber dem Kurbelzapfen
        ctx.fillStyle = "#c8322b"; ctx.beginPath(); ctx.arc(0, 0, r * 0.72, Math.PI * 0.72, Math.PI * 1.28); ctx.closePath(); ctx.fill();
      }
      ctx.fillStyle = "#e0b24a"; ctx.beginPath(); ctx.arc(0, 0, r * 0.17, 0, Math.PI * 2); ctx.fill();
      felgenStil(ctx, r * 0.6);
      ctx.restore();
      return;
    }
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
    if (art === "aero") {                    // E-Auto: glatte Aero-Felge mit Lichtring
      ctx.fillStyle = "#d9dee9"; ctx.beginPath(); ctx.arc(0, 0, r * 0.66, 0, Math.PI * 2); ctx.fill();
      ctx.strokeStyle = "#6ff3ff"; ctx.lineWidth = r * 0.07; ctx.beginPath(); ctx.arc(0, 0, r * 0.5, 0, Math.PI * 2); ctx.stroke();
      ctx.fillStyle = "#9aa3b8";
      for (i = 0; i < 3; i++) { ctx.save(); ctx.rotate(i * Math.PI * 2 / 3); rundRechteck(ctx, r * 0.2, -r * 0.05, r * 0.24, r * 0.1, r * 0.05); ctx.fill(); ctx.restore(); }
      ctx.fillStyle = "#3b4566"; ctx.beginPath(); ctx.arc(0, 0, r * 0.12, 0, Math.PI * 2); ctx.fill();
      felgenStil(ctx, r * 0.66);
      ctx.restore();
      return;
    }
    var rf = art === "monster" ? 0.5 : art === "mond" ? 0.82 : 0.58;
    // Reifenflanke mit leichtem Glanz
    ctx.strokeStyle = "rgba(255,255,255,0.12)"; ctx.lineWidth = r * 0.05;
    ctx.beginPath(); ctx.arc(0, 0, r * (rf + 0.12), 0, Math.PI * 2); ctx.stroke();
    if (art === "mond") ctx.fillStyle = "rgba(200,205,220,0.35)";
    else {
      var fg = ctx.createRadialGradient(-r * 0.15, r * 0.15, r * 0.05, 0, 0, r * rf);
      fg.addColorStop(0, "#ffffff"); fg.addColorStop(0.6, FELGE); fg.addColorStop(1, "#9aa3b8");
      ctx.fillStyle = fg;
    }
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
    felgenStil(ctx, r * rf);
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

  /* Blitz (E-Auto-Dekor, Batterien): Mitte x/y, Höhe h – y zeigt nach oben */
  function blitzForm(ctx, x, y, h) {
    var p = [[0.1, 0.5], [-0.22, -0.04], [-0.02, -0.04], [-0.12, -0.5], [0.22, 0.08], [0.02, 0.08]];
    ctx.beginPath();
    p.forEach(function (q, i) { if (i) ctx.lineTo(x + q[0] * h, y + q[1] * h); else ctx.moveTo(x + q[0] * h, y + q[1] * h); });
    ctx.closePath();
  }

  /* --- Bausteine für einen wertigen Look --- */

  /* Lackierte Fläche: Lack, Aufkleber (nur auf dem Lack), Licht von oben und
     Schatten unten (wirkt gewölbt), dann die Kontur. pfad() setzt den Umriss. */
  function karosserie(ctx, a, z, pfad, x0, x1, y0, y1, ohneMuster) {
    pfad(); ctx.fillStyle = lack(ctx, a, x0, x1, z); ctx.fill();
    if (!ohneMuster) musterZeichnen(ctx, a.muster, x0, x1, y0, y1, z, pfad);
    ctx.save(); pfad(); ctx.clip();
    var g = ctx.createLinearGradient(0, y1, 0, y0);
    g.addColorStop(0, "rgba(255,255,255,0.42)"); g.addColorStop(0.3, "rgba(255,255,255,0.08)");
    g.addColorStop(0.62, "rgba(0,0,0,0)"); g.addColorStop(1, "rgba(10,20,50,0.28)");
    ctx.fillStyle = g; ctx.fillRect(x0 - 0.2, y0 - 0.2, x1 - x0 + 0.4, y1 - y0 + 0.4);
    ctx.restore();
    pfad(); ctx.strokeStyle = TINTE; ctx.lineWidth = 0.05; ctx.lineJoin = "round"; ctx.stroke();
  }

  /* Glanzlinie (Lichtreflex auf dem Lack) */
  function glanz(ctx, x0, y0, x1, y1, breite) {
    ctx.strokeStyle = "rgba(255,255,255,0.55)"; ctx.lineWidth = breite || 0.05; ctx.lineCap = "round";
    ctx.beginPath(); ctx.moveTo(x0, y0); ctx.lineTo(x1, y1); ctx.stroke();
  }

  /* Glasscheibe mit Verlauf und schrägem Lichtstreifen */
  function glas(ctx, punkte, rahmen) {
    var y0 = Infinity, y1 = -Infinity, x0 = Infinity, x1 = -Infinity;
    punkte.forEach(function (p) { y0 = Math.min(y0, p[1]); y1 = Math.max(y1, p[1]); x0 = Math.min(x0, p[0]); x1 = Math.max(x1, p[0]); });
    var pfad = function () { ctx.beginPath(); punkte.forEach(function (p, i) { if (i) ctx.lineTo(p[0], p[1]); else ctx.moveTo(p[0], p[1]); }); ctx.closePath(); };
    var g = ctx.createLinearGradient(0, y1, 0, y0);
    g.addColorStop(0, "rgba(215,240,255,0.62)"); g.addColorStop(1, "rgba(110,160,215,0.42)");
    pfad(); ctx.fillStyle = g; ctx.fill();
    ctx.save(); pfad(); ctx.clip();
    var w = x1 - x0;
    ctx.fillStyle = "rgba(255,255,255,0.45)";
    ctx.beginPath(); ctx.moveTo(x0 + w * 0.55, y1 + 0.1); ctx.lineTo(x0 + w * 0.72, y1 + 0.1); ctx.lineTo(x0 + w * 0.42, y0 - 0.1); ctx.lineTo(x0 + w * 0.25, y0 - 0.1); ctx.fill();
    ctx.restore();
    pfad(); ctx.strokeStyle = rahmen || "#2c3550"; ctx.lineWidth = 0.045; ctx.stroke();
  }

  /* Scheinwerfer mit Linse und Lichtschein */
  function scheinwerfer(ctx, x, y, r) {
    var g = ctx.createRadialGradient(x, y, 0, x, y, r * 3);
    g.addColorStop(0, "rgba(255,245,190,0.55)"); g.addColorStop(1, "rgba(255,245,190,0)");
    ctx.fillStyle = g; ctx.beginPath(); ctx.arc(x, y, r * 3, 0, Math.PI * 2); ctx.fill();
    ctx.fillStyle = "#c9ced9"; ctx.beginPath(); ctx.arc(x, y, r * 1.25, 0, Math.PI * 2); ctx.fill();
    var l = ctx.createRadialGradient(x + r * 0.3, y + r * 0.3, 0, x, y, r);
    l.addColorStop(0, "#ffffff"); l.addColorStop(0.5, "#fff2a8"); l.addColorStop(1, "#f2c94c");
    ctx.fillStyle = l; ctx.beginPath(); ctx.arc(x, y, r, 0, Math.PI * 2); ctx.fill();
  }

  /* Rücklicht */
  function ruecklicht(ctx, x, y, w, h) {
    var g = ctx.createLinearGradient(0, y, 0, y + h);
    g.addColorStop(0, "#b81f2a"); g.addColorStop(1, "#ff7b7b");
    ctx.fillStyle = g; rundRechteck(ctx, x, y, w, h, Math.min(w, h) * 0.35); ctx.fill();
    ctx.strokeStyle = "#6e1018"; ctx.lineWidth = 0.02; ctx.stroke();
  }

  /* Metallrohr (Überrollbügel, Auspuff): dunkler Kern, heller Glanz */
  function rohr(ctx, punkte, dicke, farbe) {
    ctx.lineCap = "round"; ctx.lineJoin = "round";
    var pfad = function () { ctx.beginPath(); punkte.forEach(function (p, i) { if (i) ctx.lineTo(p[0], p[1]); else ctx.moveTo(p[0], p[1]); }); };
    pfad(); ctx.strokeStyle = TINTE; ctx.lineWidth = dicke + 0.03; ctx.stroke();
    pfad(); ctx.strokeStyle = farbe || "#7a8299"; ctx.lineWidth = dicke; ctx.stroke();
    pfad(); ctx.strokeStyle = "rgba(255,255,255,0.5)"; ctx.lineWidth = dicke * 0.3; ctx.stroke();
  }

  /* Chrom-Auspuff (waagrecht, Öffnung bei x) */
  function auspuff(ctx, x, y, laenge, r) {
    var g = ctx.createLinearGradient(0, y - r, 0, y + r);
    g.addColorStop(0, "#7d8597"); g.addColorStop(0.45, "#f4f6fb"); g.addColorStop(1, "#6b7387");
    ctx.fillStyle = g; rundRechteck(ctx, x, y - r, laenge, 2 * r, r * 0.6); ctx.fill();
    ctx.strokeStyle = TINTE; ctx.lineWidth = 0.025; ctx.stroke();
    ctx.fillStyle = "#2b2f3a"; ctx.beginPath(); ctx.ellipse(x + 0.02, y, r * 0.35, r * 0.8, 0, 0, Math.PI * 2); ctx.fill();
  }

  /* Fugen (Türen, Klappen) */
  function fuge(ctx, punkte, farbe) {
    ctx.strokeStyle = farbe; ctx.lineWidth = 0.025; ctx.lineCap = "round"; ctx.lineJoin = "round";
    ctx.beginPath(); punkte.forEach(function (p, i) { if (i) ctx.lineTo(p[0], p[1]); else ctx.moveTo(p[0], p[1]); }); ctx.stroke();
  }

  function startnummer(ctx, a, x, y, text) {
    ctx.fillStyle = "#ffffff"; ctx.beginPath(); ctx.arc(x, y, 0.17, 0, Math.PI * 2); ctx.fill();
    ctx.strokeStyle = TINTE; ctx.lineWidth = 0.025; ctx.stroke();
    textLokal(ctx, text, x, y - 0.01, 0.26, TINTE, true);
  }

  /* Spoiler-Profil (Flügelschnitt): vordere Kante bei xv, hintere bei xh, gewölbt */
  function fluegel(ctx, xv, yv, xh, yh, dicke, farbe) {
    var mx = (xv + xh) / 2, my = (yv + yh) / 2;
    ctx.beginPath();
    ctx.moveTo(xv, yv);
    ctx.bezierCurveTo(xv, yv + dicke, mx, my + dicke * 1.3, xh, yh + dicke * 0.35);
    ctx.lineTo(xh, yh - dicke * 0.1);
    ctx.bezierCurveTo(mx, my - dicke * 0.2, xv + (xh - xv) * 0.15, yv - dicke * 0.55, xv, yv);
    ctx.closePath();
    ctx.fillStyle = farbe; ctx.fill();
    ctx.strokeStyle = TINTE; ctx.lineWidth = 0.035; ctx.stroke();
  }

  /* --- einzelne Karosserien --- */
  var KAROSSERIE = {
    buggy: function (ctx, a, z, fz) {
      var c = basisFarbe(a);
      var hinten = function () {
        // Überrollbügel aus Rohr, Sitz
        rohr(ctx, [[-1.0, 0.22], [-0.8, 1.02], [0.02, 1.02], [0.22, 0.32]], 0.08, "#4a5578");
        rohr(ctx, [[-0.4, 1.02], [-0.62, 0.3]], 0.05, "#4a5578");
        ctx.fillStyle = "#2c3550"; rundRechteck(ctx, -0.84, 0.12, 0.38, 0.62, 0.12); ctx.fill();
        ctx.fillStyle = "#3e4a6e"; rundRechteck(ctx, -0.8, 0.18, 0.12, 0.5, 0.06); ctx.fill();
      };
      var koerper = function () {
        ctx.beginPath();
        ctx.moveTo(-1.45, -0.28); ctx.lineTo(1.28, -0.28);
        ctx.quadraticCurveTo(1.62, -0.24, 1.55, 0.04);
        ctx.lineTo(1.26, 0.3); ctx.lineTo(0.38, 0.34);
        ctx.quadraticCurveTo(0.2, 0.34, 0.12, 0.13);
        ctx.lineTo(-0.78, 0.13);
        ctx.quadraticCurveTo(-0.95, 0.14, -1.02, 0.32);
        ctx.lineTo(-1.45, 0.34); ctx.closePath();
      };
      var vorne = function () {
        auspuff(ctx, -1.68, -0.12, 0.34, 0.06);
        karosserie(ctx, a, z, koerper, -1.45, 1.55, -0.28, 0.34);
        // Unterboden-Schutz, Lufteinlass, Motorhaube
        ctx.fillStyle = "#2c3550"; rundRechteck(ctx, -1.4, -0.34, 2.75, 0.08, 0.04); ctx.fill();
        ctx.fillStyle = dunkel(c, 0.4);
        for (var i = 0; i < 3; i++) { rundRechteck(ctx, -1.3 + i * 0.13, -0.1, 0.07, 0.24, 0.03); ctx.fill(); }
        fuge(ctx, [[0.3, 0.3], [0.42, -0.24]], dunkel(c, 0.35));
        glanz(ctx, 0.5, 0.27, 1.2, 0.25, 0.045);
        glanz(ctx, -1.35, 0.27, -1.08, 0.27, 0.04);
        scheinwerfer(ctx, 1.44, 0.06, 0.075);
        ruecklicht(ctx, -1.48, 0.1, 0.07, 0.16);
        startnummer(ctx, a, 0.82, 0.02, kindVon(a).name.charAt(0));   // Anfangsbuchstabe des Fahrers
        // Lenkrad
        rohr(ctx, [[0.3, 0.3], [0.12, 0.56]], 0.05, "#4a5578");
        ctx.strokeStyle = "#2c3550"; ctx.lineWidth = 0.05;
        ctx.beginPath(); ctx.ellipse(0.1, 0.58, 0.05, 0.13, 0.5, 0, Math.PI * 2); ctx.stroke();
      };
      return { hinten: hinten, vorne: vorne, fahrerKoerper: [-0.62, 0.15, 0.4, 0.38], arme: [-0.34, 0.44, 0.13, 0.52] };
    },

    moped: function (ctx, a, z, fz) {
      var c = basisFarbe(a);
      var vorneR = fz.raeder[1];
      var hinten = function () {
        // Teleskopgabel zum Vorderrad (bewegt sich mit der Federung), Lenker
        rohr(ctx, [[0.62, 0.72], [vorneR.lokalX, vorneR.lokalY]], 0.07, "#b6bdcc");
        rohr(ctx, [[0.5, 0.86], [0.8, 0.82]], 0.05, "#2c3550");
        ctx.fillStyle = "#2c3550"; ctx.beginPath(); ctx.arc(0.8, 0.82, 0.04, 0, Math.PI * 2); ctx.fill();
        // Rückspiegel
        rohr(ctx, [[0.58, 0.86], [0.52, 1.0]], 0.025, "#2c3550");
        ctx.fillStyle = "#c9ced9"; ctx.beginPath(); ctx.ellipse(0.5, 1.03, 0.06, 0.04, 0.3, 0, Math.PI * 2); ctx.fill();
      };
      var koerper = function () {
        ctx.beginPath();
        ctx.moveTo(-0.82, 0.02);
        ctx.quadraticCurveTo(-0.9, 0.38, -0.55, 0.42);
        ctx.lineTo(-0.05, 0.42);
        ctx.quadraticCurveTo(0.05, 0.12, 0.3, 0.06);
        ctx.lineTo(0.48, 0.06); ctx.lineTo(0.68, 0.78); ctx.lineTo(0.54, 0.8);
        ctx.quadraticCurveTo(0.42, 0.3, 0.25, -0.12);
        ctx.lineTo(-0.6, -0.12);
        ctx.closePath();
      };
      var vorne = function () {
        auspuff(ctx, -0.95, -0.06, 0.55, 0.05);
        karosserie(ctx, a, z, koerper, -0.9, 0.7, -0.12, 0.8);
        // Sitzbank mit Naht
        ctx.fillStyle = "#2c3550"; rundRechteck(ctx, -0.64, 0.4, 0.62, 0.12, 0.06); ctx.fill();
        ctx.strokeStyle = "rgba(255,255,255,0.25)"; ctx.lineWidth = 0.015; ctx.setLineDash([0.04, 0.03]);
        ctx.beginPath(); ctx.moveTo(-0.6, 0.47); ctx.lineTo(-0.06, 0.47); ctx.stroke(); ctx.setLineDash([]);
        glanz(ctx, -0.7, 0.3, -0.25, 0.34, 0.04);
        glanz(ctx, 0.5, 0.2, 0.6, 0.6, 0.03);
        scheinwerfer(ctx, 0.66, 0.64, 0.065);
        ruecklicht(ctx, -0.9, 0.16, 0.07, 0.12);
      };
      return { hinten: hinten, vorne: vorne, fahrerKoerper: [-0.35, 0.42, 0.42, 0.42], arme: [0.06, 0.66, 0.58, 0.84] };
    },

    skateboard: function (ctx, a, z, fz) {
      // Das Kind steht auf dem Brett: Beine (Anzugfarbe) und Schuhe, Arme zum Balancieren
      var o = outfitVon(a);
      var hinten = function () {
        ctx.lineCap = "round"; ctx.lineJoin = "round";
        [[-0.08, -0.26], [0.1, 0.24]].forEach(function (b) {
          ctx.strokeStyle = o.seiten || o.anzug; ctx.lineWidth = 0.13;
          ctx.beginPath(); ctx.moveTo(b[0], 0.2); ctx.lineTo((b[0] + b[1]) / 2 + 0.03, -0.06); ctx.lineTo(b[1], -0.28); ctx.stroke();
          ctx.fillStyle = "#2b2f3a"; rundRechteck(ctx, b[1] - 0.1, -0.31, 0.22, 0.08, 0.03); ctx.fill();
        });
      };
      var deck = function () {
        ctx.beginPath();
        ctx.moveTo(-0.7, -0.3); ctx.lineTo(0.7, -0.3); ctx.quadraticCurveTo(0.84, -0.3, 0.86, -0.2);
        ctx.lineTo(0.72, -0.38); ctx.lineTo(-0.72, -0.38); ctx.lineTo(-0.86, -0.2); ctx.quadraticCurveTo(-0.84, -0.3, -0.7, -0.3); ctx.closePath();
      };
      var vorne = function () {
        karosserie(ctx, a, z, deck, -0.86, 0.86, -0.38, -0.2);
        ctx.fillStyle = "#2b2f3a"; rundRechteck(ctx, -0.25, -0.47, 0.5, 0.09, 0.03); ctx.fill();      // Akku unter dem Brett
        ctx.fillStyle = "#7dffb8"; ctx.fillRect(-0.18, -0.44, 0.06, 0.03); ctx.fillRect(-0.09, -0.44, 0.06, 0.03);
        ctx.fillStyle = "#c9cfdb"; [-0.52, 0.52].forEach(function (x) { ctx.fillRect(x - 0.06, -0.42, 0.12, 0.05); });   // Achsen
      };
      return { hinten: hinten, vorne: vorne, fahrerKoerper: [-0.17, 0.18, 0.34, 0.42], arme: [0.05, 0.5, 0.36, 0.36] };
    },

    sofa: function (ctx, a, z, fz) {
      // Sofa auf Möbelrollen, hinten an der Lehne eine Flugzeugturbine mit Flammenstrahl
      var c = basisFarbe(a), o = outfitVon(a), lauf = fz.turbine || 0;
      var hinten = function () {
        // Turbine: Gondel, Einlass mit Fan (vorne, zur Lehne), Düse hinten
        rohr(ctx, [[-1.25, 0.62], [-1.45, 0.72]], 0.08, "#6f7686");
        rohr(ctx, [[-1.25, 0.92], [-1.45, 0.88]], 0.06, "#6f7686");
        if (lauf > 0.02) {                                                   // Flammenstrahl
          var fl = 0.3 + 1.2 * lauf * (0.85 + 0.15 * Math.sin(z * 47));
          [["rgba(80,140,255,0.55)", 1, 0.17], ["rgba(255,150,40,0.85)", 0.75, 0.12], ["rgba(255,245,200,0.95)", 0.45, 0.06]].forEach(function (f) {
            ctx.fillStyle = f[0]; ctx.beginPath(); ctx.moveTo(-2.0, 0.8 - f[2]);
            ctx.quadraticCurveTo(-2.0 - fl * f[1] * 0.6, 0.8 - f[2] * 0.6, -2.0 - fl * f[1], 0.8);
            ctx.quadraticCurveTo(-2.0 - fl * f[1] * 0.6, 0.8 + f[2] * 0.6, -2.0, 0.8 + f[2]); ctx.fill();
          });
        }
        var tg = ctx.createLinearGradient(0, 1.02, 0, 0.58); tg.addColorStop(0, "#e9edf5"); tg.addColorStop(0.5, "#aab3c5"); tg.addColorStop(1, "#6f7686");
        ctx.fillStyle = tg; rundRechteck(ctx, -1.98, 0.58, 0.72, 0.44, 0.2); ctx.fill();
        ctx.strokeStyle = "rgba(0,0,0,0.3)"; ctx.lineWidth = 0.02; ctx.stroke();
        ctx.fillStyle = "#3a4152"; ctx.beginPath(); ctx.ellipse(-2.0, 0.8, 0.05, 0.15, 0, 0, Math.PI * 2); ctx.fill();   // Düse
        ctx.fillStyle = "#2b2f3a"; ctx.beginPath(); ctx.ellipse(-1.27, 0.8, 0.06, 0.2, 0, 0, Math.PI * 2); ctx.fill();   // Einlass
        ctx.strokeStyle = "#c9cfdb"; ctx.lineWidth = 0.025;                          // Fan dreht
        for (var k = 0; k < 3; k++) { var w = z * (8 + 60 * lauf) + k * 2.1; ctx.beginPath(); ctx.moveTo(-1.27, 0.8); ctx.lineTo(-1.27 + Math.cos(w) * 0.04, 0.8 + Math.sin(w) * 0.17); ctx.stroke(); }
        ctx.fillStyle = "#e8453c"; ctx.fillRect(-1.75, 0.95, 0.25, 0.04);           // Warnstreifen
      };
      var sockel = function () { rundRechteck(ctx, -1.3, -0.3, 2.6, 0.38, 0.1); };
      var vorne = function () {
        ctx.fillStyle = "#7a5232";                                                   // Holzfüße zu den Rollen
        fz.raeder.forEach(function (R) { ctx.fillRect(R.lokalX - 0.06, R.lokalY, 0.12, -0.3 - R.lokalY); });
        karosserie(ctx, a, z, sockel, -1.3, 1.3, -0.3, 0.08);
        var lehne = function () { rundRechteck(ctx, -1.32, 0.0, 0.38, 1.08, 0.16); };
        karosserie(ctx, a, z, lehne, -1.32, -0.94, 0.0, 1.08, true);
        ctx.fillStyle = hell(c, 0.12); rundRechteck(ctx, -0.98, 0.06, 2.05, 0.26, 0.12); ctx.fill();    // Sitzkissen
        ctx.strokeStyle = dunkel(c, 0.25); ctx.lineWidth = 0.02; ctx.stroke();
        ctx.beginPath(); ctx.moveTo(0.05, 0.08); ctx.lineTo(0.05, 0.3); ctx.stroke();
        ctx.fillStyle = dunkel(c, 0.3);                                              // Knopfpolsterung
        [[-1.13, 0.85], [-1.13, 0.55], [-1.13, 0.25]].forEach(function (p) { ctx.beginPath(); ctx.arc(p[0], p[1], 0.035, 0, Math.PI * 2); ctx.fill(); });
        // Fietes Beine liegen auf dem Kissen
        ctx.lineCap = "round"; ctx.strokeStyle = o.seiten || o.anzug; ctx.lineWidth = 0.15;
        ctx.beginPath(); ctx.moveTo(-0.15, 0.4); ctx.lineTo(0.5, 0.42); ctx.lineTo(0.62, 0.05); ctx.stroke();
        ctx.fillStyle = "#2b2f3a"; rundRechteck(ctx, 0.56, -0.02, 0.24, 0.1, 0.04); ctx.fill();
        var arm = function () { rundRechteck(ctx, 1.02, -0.05, 0.36, 0.5, 0.16); };    // vordere Armlehne
        karosserie(ctx, a, z, arm, 1.02, 1.38, -0.05, 0.45, true);
        glanz(ctx, -0.9, 0.27, 0.9, 0.29, 0.03);
      };
      return { hinten: hinten, vorne: vorne, fahrerKoerper: [-0.4, 0.3, 0.5, 0.42], arme: [-0.05, 0.6, 0.55, 0.62], fahrerNachVorneNicht: true };
    },

    dampflok: function (ctx, a, z, fz) {
      // Kleine Dampf-Lok: Kessel mit Schornstein und Dampfdom, Führerhaus hinten (Fiete
      // schaut aus dem Fenster), rote Räder mit Kuppel- und Treibstange, Schienenräumer
      var c = basisFarbe(a), rot = "#c8322b", messing = "#e0b24a";
      var R1 = fz.raeder[1];
      var scheibe = [[-1.2, 0.5], [-0.48, 0.5], [-0.48, 1.12], [-1.2, 1.12]];
      var yZyl = R1.lokalY + 0.17;
      var kessel = function () { rundRechteck(ctx, -0.34, 0.04, 1.66, 0.58, 0.14); };
      var haus = function () {
        ctx.beginPath(); ctx.moveTo(-1.4, 0.0); ctx.lineTo(-0.28, 0.0); ctx.lineTo(-0.28, 1.24);
        ctx.lineTo(-1.4, 1.24); ctx.closePath();
      };
      var hinten = function () {
        ctx.fillStyle = "#2a2d35";                                              // Rahmen (Umlauf)
        ctx.fillRect(-1.42, -0.27, 2.96, 0.27);
        ctx.fillStyle = rot; ctx.fillRect(-1.42, -0.06, 2.96, 0.07);            // rote Kante
      };
      var vorne = function () {
        // Zylinder mit Gleitbahn (die Treibstange kommt nach den Rädern)
        ctx.fillStyle = "#4a505e"; rundRechteck(ctx, 1.0, yZyl - 0.13, 0.42, 0.26, 0.05); ctx.fill();
        ctx.strokeStyle = TINTE; ctx.lineWidth = 0.025; ctx.stroke();
        ctx.fillStyle = "#8a93a6"; ctx.fillRect(1.04, yZyl - 0.1, 0.05, 0.2); ctx.fillRect(1.33, yZyl - 0.1, 0.05, 0.2);
        ctx.fillStyle = "#9aa3b8"; ctx.fillRect(0.6, yZyl + 0.06, 0.42, 0.03); ctx.fillRect(0.6, yZyl - 0.09, 0.42, 0.03);
        // Kessel
        karosserie(ctx, a, z, kessel, -0.34, 1.32, 0.04, 0.62);
        ctx.fillStyle = "#1c1e24"; rundRechteck(ctx, 1.06, 0.04, 0.26, 0.58, 0.12); ctx.fill();   // Rauchkammer
        ctx.strokeStyle = messing; ctx.lineWidth = 0.035;                       // Messingbänder
        [0.12, 0.56, 1.04].forEach(function (x) { ctx.beginPath(); ctx.moveTo(x, 0.06); ctx.lineTo(x, 0.6); ctx.stroke(); });
        ctx.strokeStyle = "#c9cfdb"; ctx.lineWidth = 0.02;                       // Griffstange
        ctx.beginPath(); ctx.moveTo(-0.25, 0.44); ctx.lineTo(1.25, 0.44); ctx.stroke();
        ctx.fillStyle = "#c9cfdb";                                               // Nieten an der Rauchkammer
        [0.14, 0.33, 0.52].forEach(function (y) { ctx.beginPath(); ctx.arc(1.29, y, 0.018, 0, Math.PI * 2); ctx.fill(); });
        // Schornstein mit Krone
        ctx.fillStyle = "#1c1e24";
        ctx.beginPath(); ctx.moveTo(0.99, 0.6); ctx.lineTo(1.15, 0.6); ctx.lineTo(1.17, 0.98); ctx.lineTo(0.97, 0.98); ctx.closePath(); ctx.fill();
        ctx.fillStyle = "#3a3e4a"; rundRechteck(ctx, 0.93, 0.96, 0.28, 0.12, 0.04); ctx.fill();
        ctx.fillStyle = "#b5652e"; ctx.fillRect(0.93, 1.03, 0.28, 0.03);        // Kupferring
        // Dampfdom (Messing) und Sanddom
        var dg = ctx.createLinearGradient(0.36, 0, 0.68, 0);
        dg.addColorStop(0, "#a87a22"); dg.addColorStop(0.4, "#ffe38a"); dg.addColorStop(1, "#b98a2a");
        ctx.fillStyle = dg; ctx.beginPath(); ctx.moveTo(0.34, 0.6); ctx.quadraticCurveTo(0.36, 0.84, 0.52, 0.85);
        ctx.quadraticCurveTo(0.68, 0.84, 0.7, 0.6); ctx.closePath(); ctx.fill();
        ctx.fillStyle = dunkel(c, 0.15); ctx.beginPath(); ctx.moveTo(0.0, 0.6); ctx.quadraticCurveTo(0.02, 0.76, 0.12, 0.76);
        ctx.quadraticCurveTo(0.22, 0.76, 0.24, 0.6); ctx.closePath(); ctx.fill();
        // Pfeife vorn am Führerhaus
        ctx.fillStyle = messing; ctx.fillRect(-0.24, 0.62, 0.05, 0.22); rundRechteck(ctx, -0.27, 0.82, 0.11, 0.1, 0.03); ctx.fill();
        // Lampe vorn
        ctx.fillStyle = "#2a2d35"; ctx.fillRect(1.28, 0.66, 0.1, 0.16);
        scheinwerfer(ctx, 1.4, 0.74, 0.06);
        // Führerhaus (lackiert, mit Aufkleber), Fenster innen dunkel, Dach
        karosserie(ctx, a, z, haus, -1.4, -0.28, 0.0, 1.24);
        ctx.fillStyle = "#2a2018";
        ctx.beginPath(); scheibe.forEach(function (p, i) { if (i) ctx.lineTo(p[0], p[1]); else ctx.moveTo(p[0], p[1]); }); ctx.closePath(); ctx.fill();
        ctx.strokeStyle = messing; ctx.lineWidth = 0.04; ctx.stroke();
        ctx.fillStyle = "#1c1e24"; rundRechteck(ctx, -1.5, 1.2, 1.32, 0.12, 0.05); ctx.fill();
        ctx.fillStyle = "rgba(255,255,255,0.18)"; ctx.fillRect(-1.46, 1.28, 1.24, 0.025);
        // Messingschild mit Nummer
        ctx.fillStyle = messing; rundRechteck(ctx, -1.18, 0.15, 0.62, 0.22, 0.08); ctx.fill();
        ctx.strokeStyle = "#8a6418"; ctx.lineWidth = 0.02; ctx.stroke();
        textLokal(ctx, "F 1", -0.87, 0.255, 0.17, "#5a3a08", true);
        // Pufferbohle mit Puffern, Schienenräumer
        ctx.fillStyle = rot; ctx.fillRect(1.46, -0.3, 0.1, 0.32); ctx.fillRect(-1.5, -0.3, 0.1, 0.32);
        ctx.fillStyle = "#6b7387";
        [[1.56, 1], [-1.5, -1]].forEach(function (pp) { ctx.fillRect(pp[1] > 0 ? pp[0] : pp[0] - 0.08, -0.2, 0.08, 0.06); ctx.fillRect(pp[1] > 0 ? pp[0] + 0.06 : pp[0] - 0.11, -0.25, 0.04, 0.16); });
        ctx.fillStyle = rot;
        ctx.beginPath(); ctx.moveTo(1.44, -0.3); ctx.lineTo(1.46, -0.6); ctx.lineTo(1.82, -0.6); ctx.closePath(); ctx.fill();
        ctx.strokeStyle = dunkel(rot, 0.35); ctx.lineWidth = 0.025;
        [0.3, 0.55, 0.8].forEach(function (t) { ctx.beginPath(); ctx.moveTo(1.45 + 0.01 * t, -0.3 - 0.3 * t); ctx.lineTo(1.46 + 0.36 * t, -0.6); ctx.stroke(); });
        glanz(ctx, -0.2, 0.55, 1.0, 0.55, 0.03);
      };
      // Nach den Rädern: Kuppelstange (verbindet die Treibräder) und Treibstange zum Kolben
      var nachRaedern = function () {
        var A = fz.raeder[0], B = fz.raeder[1];
        var w = A.k.a - A.chassisWinkel, rp = A.r * 0.55, cw = Math.cos(w), sw = Math.sin(w);
        var p0 = [A.lokalX + rp * cw, A.lokalY + rp * sw], p1 = [B.lokalX + rp * cw, B.lokalY + rp * sw];
        var L = 0.62, dy = yZyl - p1[1], xk = p1[0] + Math.sqrt(Math.max(0.01, L * L - dy * dy));
        rohr(ctx, [[xk, yZyl], [1.05, yZyl]], 0.035, "#c9cfdb");                 // Kolbenstange
        ctx.fillStyle = "#6b7387"; ctx.fillRect(xk - 0.06, yZyl - 0.06, 0.12, 0.12);   // Kreuzkopf
        rohr(ctx, [p1, [xk, yZyl]], 0.06, "#b9c0cf");                            // Treibstange
        rohr(ctx, [p0, p1], 0.06, "#d0d5df");                                    // Kuppelstange
        [p0, p1].forEach(function (p) { ctx.fillStyle = "#4a505e"; ctx.beginPath(); ctx.arc(p[0], p[1], 0.04, 0, Math.PI * 2); ctx.fill(); });
      };
      return { hinten: hinten, vorne: vorne, nachRaedern: nachRaedern, ohneFedern: true,
               fahrerKoerper: null, fahrerNachVorne: true, scheibe: scheibe };
    },

    flugzeug: function (ctx, a, z, fz) {
      // Kleiner Doppelsitzer-Flieger mit offenem Cockpit, Propeller dreht sich
      var c = basisFarbe(a);
      var rumpf = function () {
        ctx.beginPath();
        ctx.moveTo(-1.9, 0.08); ctx.quadraticCurveTo(-0.5, -0.2, 1.45, -0.1);
        ctx.quadraticCurveTo(1.85, 0.0, 1.8, 0.2); ctx.quadraticCurveTo(1.7, 0.42, 1.4, 0.44);
        ctx.lineTo(0.15, 0.44); ctx.quadraticCurveTo(-0.25, 0.3, -0.65, 0.44);
        ctx.lineTo(-1.5, 0.4); ctx.lineTo(-1.9, 0.08); ctx.closePath();
      };
      var hinten = function () {
        ctx.fillStyle = dunkel(c, 0.3);                                              // ferne Tragfläche
        ctx.beginPath(); ctx.ellipse(0.25, 0.12, 0.95, 0.09, 0.02, 0, Math.PI * 2); ctx.fill();
        ctx.beginPath(); ctx.ellipse(-1.62, 0.36, 0.38, 0.05, 0, 0, Math.PI * 2); ctx.fill();   // Höhenruder hinten
      };
      var vorne = function () {
        var rL = fz.raeder[1], rH = fz.raeder[0];
        rohr(ctx, [[0.55, 0.0], [rL.lokalX, rL.lokalY]], 0.06, "#3a4152");          // Fahrwerk
        rohr(ctx, [[1.0, -0.05], [rL.lokalX, rL.lokalY]], 0.05, "#3a4152");
        rohr(ctx, [[-1.5, 0.12], [rH.lokalX, rH.lokalY]], 0.05, "#3a4152");
        // Seitenleitwerk
        ctx.fillStyle = c; ctx.beginPath(); ctx.moveTo(-1.45, 0.4); ctx.lineTo(-1.75, 0.95); ctx.lineTo(-1.95, 0.95); ctx.lineTo(-1.9, 0.1); ctx.closePath(); ctx.fill();
        ctx.strokeStyle = "rgba(0,0,0,0.25)"; ctx.lineWidth = 0.02; ctx.stroke();
        karosserie(ctx, a, z, rumpf, -1.95, 1.85, -0.2, 0.45);
        // nahe Tragfläche mit Streben
        rohr(ctx, [[0.0, 0.0], [0.4, 0.38]], 0.035, "#c9cfdb");
        var tf = function () { ctx.beginPath(); ctx.ellipse(0.25, -0.02, 1.05, 0.11, 0.02, 0, Math.PI * 2); };
        karosserie(ctx, a, z, tf, -0.8, 1.3, -0.13, 0.09, true);
        glanz(ctx, -0.6, 0.02, 1.0, 0.04, 0.03);
        // Windschutzscheibe vor dem Cockpit, Motorhaube, Auspuff
        ctx.fillStyle = "rgba(200,235,255,0.6)"; ctx.strokeStyle = "#3a4152"; ctx.lineWidth = 0.02;
        ctx.beginPath(); ctx.moveTo(0.12, 0.44); ctx.lineTo(0.22, 0.66); ctx.lineTo(0.32, 0.44); ctx.closePath(); ctx.fill(); ctx.stroke();
        ctx.fillStyle = "#c9cfdb"; ctx.beginPath(); ctx.ellipse(1.82, 0.17, 0.09, 0.09, 0, 0, Math.PI * 2); ctx.fill();
        // Propeller: Unschärfe-Scheibe und zwei drehende Blätter
        var w = z * 45;
        ctx.fillStyle = "rgba(200,205,220,0.35)"; ctx.beginPath(); ctx.ellipse(1.9, 0.17, 0.07, 0.62, 0, 0, Math.PI * 2); ctx.fill();
        ctx.fillStyle = "#3a2a1a"; ctx.beginPath(); ctx.ellipse(1.9, 0.17 + Math.sin(w) * 0.3, 0.04, Math.abs(Math.cos(w)) * 0.05 + 0.3 * Math.abs(Math.sin(w)) * 0.2, 0, 0, Math.PI * 2); ctx.fill();
        ctx.fillStyle = "#3a2a1a"; ctx.fillRect(1.86, 0.17 + Math.sin(w) * 0.55 - 0.04, 0.06, 0.08); ctx.fillRect(1.86, 0.17 - Math.sin(w) * 0.55 - 0.04, 0.06, 0.08);
        ctx.fillStyle = "#e8453c"; ctx.beginPath(); ctx.arc(1.93, 0.17, 0.06, 0, Math.PI * 2); ctx.fill();
        scheinwerfer(ctx, 1.62, 0.02, 0.05);
      };
      return { hinten: hinten, vorne: vorne, fahrerKoerper: [-0.48, 0.2, 0.46, 0.36], arme: null, fahrerZuerst: true };
    },

    traktor: function (ctx, a, z) {
      var c = basisFarbe(a);
      var hinten = function () {
        // Kabinen-Pfosten
        rohr(ctx, [[-1.4, 0.24], [-1.4, 1.58]], 0.09, "#3b4566");
        rohr(ctx, [[-0.08, 0.62], [-0.08, 1.58]], 0.09, "#3b4566");
      };
      var rahmen = function () { rundRechteck(ctx, -1.45, -0.2, 1.5, 0.48, 0.08); };
      var haube = function () { rundRechteck(ctx, -0.02, -0.18, 1.74, 0.78, 0.14); };
      var vorne = function () {
        karosserie(ctx, a, z, rahmen, -1.45, 0.05, -0.2, 0.28, true);
        karosserie(ctx, a, z, haube, -0.02, 1.72, -0.18, 0.6);
        // Lüftungsschlitze, Haubenfuge, Typenschild
        ctx.fillStyle = dunkel(c, 0.4);
        for (var i = 0; i < 4; i++) { rundRechteck(ctx, 0.95 + i * 0.12, 0.1, 0.06, 0.3, 0.03); ctx.fill(); }
        fuge(ctx, [[0.05, 0.36], [1.66, 0.36]], dunkel(c, 0.3));
        ctx.fillStyle = "#f4f6fb"; rundRechteck(ctx, 0.25, 0.08, 0.5, 0.16, 0.05); ctx.fill();
        ctx.fillStyle = dunkel(c, 0.2); rundRechteck(ctx, 0.29, 0.12, 0.42, 0.08, 0.03); ctx.fill();
        glanz(ctx, 0.12, 0.52, 1.5, 0.52, 0.05);
        // Kühlergrill in Chrom
        var gg = ctx.createLinearGradient(1.48, 0, 1.66, 0);
        gg.addColorStop(0, "#8d95a8"); gg.addColorStop(0.5, "#eef1f7"); gg.addColorStop(1, "#7d8597");
        ctx.fillStyle = gg; rundRechteck(ctx, 1.48, -0.1, 0.2, 0.62, 0.06); ctx.fill();
        ctx.strokeStyle = TINTE; ctx.lineWidth = 0.03; ctx.stroke();
        ctx.strokeStyle = "#3b4566"; ctx.lineWidth = 0.025;
        for (i = 0; i < 5; i++) { ctx.beginPath(); ctx.moveTo(1.51, -0.02 + i * 0.11); ctx.lineTo(1.65, -0.02 + i * 0.11); ctx.stroke(); }
        // Auspuff senkrecht mit Klappe
        var ag = ctx.createLinearGradient(0.86, 0, 1.0, 0);
        ag.addColorStop(0, "#6b7387"); ag.addColorStop(0.5, "#eef1f7"); ag.addColorStop(1, "#5f6779");
        ctx.fillStyle = ag; rundRechteck(ctx, 0.87, 0.58, 0.11, 0.66, 0.04); ctx.fill();
        ctx.strokeStyle = TINTE; ctx.lineWidth = 0.025; ctx.stroke();
        ctx.fillStyle = "#2c3550"; ctx.save(); ctx.translate(0.925, 1.24); ctx.rotate(-0.35); rundRechteck(ctx, -0.08, 0, 0.18, 0.04, 0.02); ctx.fill(); ctx.restore();
        // Kabine: Glas, Dach mit Schatten
        glas(ctx, [[-1.36, 0.3], [-0.12, 0.62], [-0.12, 1.54], [-1.36, 1.54]], "rgba(44,53,80,0.5)");
        var dach = function () { rundRechteck(ctx, -1.62, 1.54, 1.72, 0.17, 0.07); };
        karosserie(ctx, { farbe: hell(c, 0.15), muster: "keins" }, z, dach, -1.62, 0.1, 1.54, 1.71, true);
        ctx.fillStyle = "#ffcf3a"; ctx.beginPath(); ctx.arc(-0.75, 1.76, 0.07, Math.PI, 0); ctx.fill();   // Rundumleuchte
        // Kotflügel über dem großen Rad
        ctx.strokeStyle = TINTE; ctx.lineWidth = 0.17;
        ctx.beginPath(); ctx.arc(-0.85, -0.2, 0.82, Math.PI * 0.12, Math.PI * 0.88); ctx.stroke();
        ctx.strokeStyle = dunkel(c, 0.15); ctx.lineWidth = 0.12;
        ctx.beginPath(); ctx.arc(-0.85, -0.2, 0.82, Math.PI * 0.12, Math.PI * 0.88); ctx.stroke();
        ctx.strokeStyle = "rgba(255,255,255,0.4)"; ctx.lineWidth = 0.03;
        ctx.beginPath(); ctx.arc(-0.85, -0.2, 0.86, Math.PI * 0.3, Math.PI * 0.7); ctx.stroke();
        scheinwerfer(ctx, 1.6, 0.5, 0.07);
      };
      return { hinten: hinten, vorne: vorne, fahrerKoerper: [-0.95, 0.3, 0.48, 0.42], fahrerVorDach: true };
    },

    bus: function (ctx, a, z) {
      var c = basisFarbe(a);
      var scheibe = [[1.84, 0.62], [2.72, 0.62], [2.52, 1.42], [1.84, 1.42]];
      var koerper = function () {
        ctx.beginPath();
        ctx.moveTo(-2.7, -0.35); ctx.lineTo(2.62, -0.35);
        ctx.quadraticCurveTo(2.82, -0.33, 2.8, 0.1);
        ctx.lineTo(2.78, 0.6); ctx.lineTo(2.58, 1.5);
        ctx.quadraticCurveTo(2.55, 1.58, 2.4, 1.58);
        ctx.lineTo(-2.55, 1.58);
        ctx.quadraticCurveTo(-2.72, 1.58, -2.72, 1.4);
        ctx.closePath();
      };
      var vorne = function () {
        karosserie(ctx, a, z, koerper, -2.7, 2.8, -0.35, 1.58);
        // Zierstreifen unter den Fenstern
        ctx.fillStyle = "rgba(255,255,255,0.85)"; ctx.fillRect(-2.7, 0.5, 5.46, 0.06);
        ctx.fillStyle = dunkel(c, 0.3); ctx.fillRect(-2.7, 0.44, 5.46, 0.05);
        // Fensterreihe mit Tierkindern
        var tiere = ["🐰", "🐻", "🐱", "🐶", "🦊"];
        for (var i = 0; i < 5; i++) {
          var fx = -2.42 + i * 0.84;
          ctx.fillStyle = "rgba(200,232,255,0.9)";
          rundRechteck(ctx, fx, 0.68, 0.66, 0.66, 0.1); ctx.fill();
          ctx.save(); ctx.beginPath(); rundRechteck(ctx, fx, 0.68, 0.66, 0.66, 0.1); ctx.clip();
          ctx.save(); ctx.translate(fx + 0.33, 0.9); ctx.scale(1, -1);
          var spr = emojiSprite(tiere[i], 64);
          ctx.drawImage(spr, -0.3, -0.3, 0.6, 0.6);
          ctx.restore();
          ctx.fillStyle = "rgba(255,255,255,0.35)";
          ctx.beginPath(); ctx.moveTo(fx + 0.4, 1.4); ctx.lineTo(fx + 0.55, 1.4); ctx.lineTo(fx + 0.3, 0.6); ctx.lineTo(fx + 0.15, 0.6); ctx.fill();
          ctx.restore();
          ctx.strokeStyle = "#2c3550"; ctx.lineWidth = 0.045;
          rundRechteck(ctx, fx, 0.68, 0.66, 0.66, 0.1); ctx.stroke();
        }
        // Frontscheibe, Tür mit Fugen, Griff
        glas(ctx, scheibe);
        fuge(ctx, [[1.62, -0.28], [1.62, 1.46]], dunkel(c, 0.35));
        fuge(ctx, [[1.22, -0.28], [1.22, 1.46]], dunkel(c, 0.35));
        fuge(ctx, [[1.42, -0.28], [1.42, 1.46]], dunkel(c, 0.25));
        // Radkästen
        ctx.fillStyle = "#2c3550";
        [-1.75, 1.85].forEach(function (x) { ctx.beginPath(); ctx.arc(x, -0.35, 0.58, Math.PI, 0); ctx.fill(); });
        // Stoßstangen in Chrom
        var sg = ctx.createLinearGradient(0, -0.42, 0, -0.24);
        sg.addColorStop(0, "#6b7387"); sg.addColorStop(0.5, "#eef1f7"); sg.addColorStop(1, "#7d8597");
        ctx.fillStyle = sg; rundRechteck(ctx, 2.5, -0.42, 0.38, 0.18, 0.06); ctx.fill(); rundRechteck(ctx, -2.8, -0.42, 0.4, 0.18, 0.06); ctx.fill();
        glanz(ctx, -2.5, 1.48, 2.3, 1.48, 0.05);
        scheinwerfer(ctx, 2.7, 0.02, 0.09);
        ruecklicht(ctx, -2.76, 0.02, 0.08, 0.26);
        // Liniennummer
        ctx.fillStyle = "#2c3550"; rundRechteck(ctx, 2.0, 1.44, 0.46, 0.12, 0.03); ctx.fill();
        textLokal(ctx, kindVon(a).name.toUpperCase(), 2.23, 1.5, 0.09, "#ffcf3a", true);
      };
      return { hinten: function () {}, vorne: vorne, fahrerKoerper: null, fahrerNachVorne: true, scheibe: scheibe };
    },

    monster: function (ctx, a, z) {
      var c = basisFarbe(a);
      var scheibe = [[0.46, 0.74], [0.66, 0.74], [0.45, 1.16], [-0.38, 1.16], [-0.55, 0.74]];
      var hinten = function () {
        // Rahmen und Stoßdämpfer-Türme
        ctx.fillStyle = "#2c3550"; rundRechteck(ctx, -1.65, -0.14, 3.3, 0.24, 0.06); ctx.fill();
        rohr(ctx, [[-1.2, 0.05], [-1.0, -0.5]], 0.09, "#ff9e2c");
        rohr(ctx, [[1.2, 0.05], [1.0, -0.5]], 0.09, "#ff9e2c");
      };
      var koerper = function () {
        ctx.beginPath();
        ctx.moveTo(-1.8, 0.05); ctx.lineTo(1.85, 0.05); ctx.lineTo(1.92, 0.55);
        ctx.lineTo(0.9, 0.7); ctx.lineTo(0.58, 1.22);
        ctx.quadraticCurveTo(0.52, 1.28, 0.42, 1.28);
        ctx.lineTo(-0.48, 1.28); ctx.lineTo(-0.7, 0.7); ctx.lineTo(-1.8, 0.62);
        ctx.closePath();
      };
      var vorne = function () {
        karosserie(ctx, a, z, koerper, -1.8, 1.92, 0.05, 1.28);
        glas(ctx, scheibe);
        // Tür, Griff, Ladefläche, Kühlergrill
        fuge(ctx, [[0.62, 0.7], [0.6, 0.12], [-0.6, 0.12], [-0.62, 0.7]], dunkel(c, 0.35));
        ctx.fillStyle = "#c9ced9"; rundRechteck(ctx, 0.3, 0.55, 0.18, 0.05, 0.025); ctx.fill();
        fuge(ctx, [[-0.75, 0.6], [-1.7, 0.56]], dunkel(c, 0.35));
        var gg = ctx.createLinearGradient(0, 0.12, 0, 0.5);
        gg.addColorStop(0, "#7d8597"); gg.addColorStop(0.5, "#eef1f7"); gg.addColorStop(1, "#7d8597");
        ctx.fillStyle = gg; rundRechteck(ctx, 1.72, 0.12, 0.18, 0.3, 0.04); ctx.fill();
        // Radlauf-Verbreiterungen
        ctx.fillStyle = "#2c3550";
        [-1.15, 1.15].forEach(function (x) { ctx.beginPath(); ctx.arc(x, 0.05, 0.62, Math.PI, 0); ctx.lineTo(x + 0.5, 0.05); ctx.arc(x, 0.05, 0.5, 0, Math.PI, true); ctx.fill(); });
        glanz(ctx, -1.6, 0.55, -0.85, 0.6, 0.05);
        glanz(ctx, 1.0, 0.6, 1.75, 0.5, 0.045);
        scheinwerfer(ctx, 1.84, 0.4, 0.08);
        ruecklicht(ctx, -1.84, 0.3, 0.07, 0.22);
        // Lichtleiste auf dem Dach
        ctx.fillStyle = "#2c3550"; rundRechteck(ctx, -0.45, 1.28, 0.9, 0.06, 0.02); ctx.fill();
        for (var i = 0; i < 3; i++) scheinwerfer(ctx, -0.3 + i * 0.3, 1.38, 0.055);
        // Seitliche Auspuffrohre
        auspuff(ctx, -0.25, 0.0, 0.7, 0.05);
      };
      return { hinten: hinten, vorne: vorne, fahrerKoerper: null, fahrerNachVorne: true, scheibe: scheibe };
    },

    renner: function (ctx, a, z) {
      var c = basisFarbe(a), dk = dunkel(c, 0.3);
      var hinten = function () {
        // Heckflügel: zwei nach hinten gepfeilte Streben, durchsichtige Endplatte,
        // gewölbtes Hauptblatt (Lack, Unterseite dunkel) und ein kleiner Flap darüber
        rohr(ctx, [[-1.45, 0.3], [-1.66, 0.86]], 0.055, "#3b4566");
        rohr(ctx, [[-1.78, 0.3], [-1.95, 0.9]], 0.055, "#3b4566");
        ctx.beginPath(); ctx.moveTo(-1.5, 0.78); ctx.lineTo(-1.56, 1.14); ctx.quadraticCurveTo(-1.58, 1.2, -1.66, 1.2);
        ctx.lineTo(-2.24, 1.22); ctx.quadraticCurveTo(-2.32, 1.22, -2.32, 1.14); ctx.lineTo(-2.3, 0.8); ctx.closePath();
        ctx.fillStyle = "rgba(44,53,80,0.28)"; ctx.fill(); ctx.strokeStyle = "rgba(30,44,82,0.8)"; ctx.lineWidth = 0.03; ctx.stroke();
        fluegel(ctx, -1.48, 0.88, -2.3, 1.02, 0.14, lack(ctx, a, -2.3, -1.48, z));
        glanz(ctx, -1.56, 0.92, -2.1, 1.01, 0.03);
        fluegel(ctx, -1.98, 1.09, -2.31, 1.18, 0.07, dk);
        // Lufthutze hinter dem Fahrer
        ctx.beginPath(); ctx.moveTo(-0.55, 0.28); ctx.quadraticCurveTo(-0.6, 0.62, -0.38, 0.62);
        ctx.lineTo(-0.3, 0.62); ctx.quadraticCurveTo(-0.24, 0.62, -0.24, 0.5); ctx.lineTo(-1.2, 0.36); ctx.closePath();
        ctx.fillStyle = dk; ctx.fill(); ctx.strokeStyle = TINTE; ctx.lineWidth = 0.035; ctx.stroke();
        ctx.fillStyle = "#1a2033"; ctx.beginPath(); ctx.ellipse(-0.3, 0.54, 0.035, 0.06, 0, 0, Math.PI * 2); ctx.fill();
      };
      var koerper = function () {
        ctx.beginPath();
        ctx.moveTo(-2.0, -0.22); ctx.lineTo(2.05, -0.22); ctx.lineTo(2.14, -0.06);
        ctx.quadraticCurveTo(1.2, 0.1, 0.62, 0.24);
        ctx.quadraticCurveTo(0.2, 0.32, 0.02, 0.26);
        ctx.lineTo(-0.5, 0.26);
        ctx.quadraticCurveTo(-0.7, 0.36, -1.4, 0.36);
        ctx.lineTo(-2.0, 0.32); ctx.closePath();
      };
      var vorne = function () {
        auspuff(ctx, -2.22, 0.02, 0.3, 0.055);
        karosserie(ctx, a, z, koerper, -2.0, 2.14, -0.22, 0.36);
        // Seitenkasten mit Lufteinlass
        ctx.fillStyle = dk;
        ctx.beginPath(); ctx.moveTo(0.2, 0.1); ctx.quadraticCurveTo(0.05, -0.12, -0.2, -0.12); ctx.lineTo(-1.1, -0.12); ctx.lineTo(-1.1, 0.06); ctx.lineTo(-0.2, 0.08); ctx.closePath(); ctx.fill();
        ctx.fillStyle = "#1a2033"; ctx.beginPath(); ctx.ellipse(0.12, 0.0, 0.05, 0.09, 0.3, 0, Math.PI * 2); ctx.fill();
        glanz(ctx, 0.75, 0.16, 1.8, -0.01, 0.04);
        glanz(ctx, -1.85, 0.28, -0.8, 0.3, 0.04);
        startnummer(ctx, a, 0.95, 0.02, "1");
        // Windschild
        glas(ctx, [[0.02, 0.26], [0.16, 0.48], [0.44, 0.27]]);
        // Unterboden / Diffusor
        ctx.fillStyle = "#2c3550"; rundRechteck(ctx, -2.08, -0.28, 4.24, 0.08, 0.03); ctx.fill();
        // Frontflügel mit Endplatte
        ctx.fillStyle = "rgba(44,53,80,0.85)"; rundRechteck(ctx, 2.02, -0.32, 0.24, 0.2, 0.04); ctx.fill();
        fluegel(ctx, 1.62, -0.26, 2.3, -0.22, 0.07, lack(ctx, a, 1.6, 2.3, z));
        ruecklicht(ctx, -2.04, 0.12, 0.06, 0.12);
      };
      return { hinten: hinten, vorne: vorne, fahrerKoerper: null, fahrerZuerst: true };
    },

    /* H₂-Blubber: rundes Kapselauto mit Glaskuppel, hinten zwei stehende H₂-Tanks,
       zwei blaue Schläuche zur Brennstoffzelle unter der Haube, Wasser-Auspuff. */
    wasserstoff: function (ctx, a, z) {
      var c = basisFarbe(a);
      var scheibe = [[0.56, 0.44], [0.38, 0.74], [0.02, 0.96], [-0.42, 0.98], [-0.78, 0.80], [-0.92, 0.50]];
      var koerper = function () {
        ctx.beginPath();
        ctx.moveTo(-1.58, -0.28); ctx.lineTo(1.5, -0.28);
        ctx.quadraticCurveTo(1.82, -0.24, 1.76, 0.06);
        ctx.quadraticCurveTo(1.66, 0.34, 1.2, 0.38);
        ctx.quadraticCurveTo(0.8, 0.4, 0.58, 0.46);
        ctx.bezierCurveTo(0.4, 0.86, 0.1, 1.06, -0.36, 1.06);
        ctx.bezierCurveTo(-0.78, 1.06, -0.94, 0.78, -0.98, 0.5);
        ctx.lineTo(-1.5, 0.46);
        ctx.quadraticCurveTo(-1.7, 0.4, -1.66, 0.06);
        ctx.quadraticCurveTo(-1.66, -0.26, -1.58, -0.28);
        ctx.closePath();
      };
      var tank = function (x, hinten) {          // stehende Druckflasche
        var w = 0.3, y0 = 0.36, y1 = 1.12;
        rundRechteck(ctx, x - w / 2, y0, w, y1 - y0, w * 0.48);
        var g = ctx.createLinearGradient(x - w / 2, 0, x + w / 2, 0);
        g.addColorStop(0, hinten ? "#9cb3cf" : "#c5d8ee"); g.addColorStop(0.4, hinten ? "#e6eef8" : "#ffffff"); g.addColorStop(1, hinten ? "#7d93b0" : "#9fb6d2");
        ctx.fillStyle = g; ctx.fill(); ctx.strokeStyle = TINTE; ctx.lineWidth = 0.04; ctx.stroke();
        ctx.fillStyle = "#2f7fe0"; ctx.fillRect(x - w / 2 + 0.02, 0.62, w - 0.04, 0.2);       // blaues Band
        textLokal(ctx, "H₂", x, 0.725, 0.19, "#ffffff", true);
        ctx.fillStyle = "#8f9ab3"; rundRechteck(ctx, x - 0.05, y1 - 0.02, 0.1, 0.09, 0.02); ctx.fill();   // Ventil
        ctx.fillStyle = "#3b4566"; rundRechteck(ctx, x - 0.09, y1 + 0.06, 0.18, 0.04, 0.02); ctx.fill();
      };
      var schlauch = function (x0, y0, x1, y1, x2, y2, x3, y3, farbe) {
        [[TINTE, 0.1], [farbe, 0.07], ["rgba(255,255,255,0.45)", 0.022]].forEach(function (L) {
          ctx.strokeStyle = L[0]; ctx.lineWidth = L[1]; ctx.lineCap = "round";
          ctx.beginPath(); ctx.moveTo(x0, y0); ctx.bezierCurveTo(x1, y1, x2, y2, x3, y3); ctx.stroke();
        });
      };
      var hinten = function () {
        tank(-1.36, true);                        // der hintere Tank steht etwas versetzt dahinter
      };
      var vorne = function () {
        auspuff(ctx, -1.82, -0.16, 0.3, 0.06);
        karosserie(ctx, a, z, koerper, -1.66, 1.82, -0.28, 1.06);
        glas(ctx, scheibe);
        tank(-1.16, false);
        // zwei blaue Schläuche: von den Tank-Ventilen im Bogen nach vorn zur Brennstoffzelle
        var wipp = Math.sin(z * 3) * 0.02;
        schlauch(-1.36, 1.16, -1.75, 1.5 + wipp, -1.8, 0.2, -0.6, 0.12, "#1f6fe0");
        schlauch(-1.16, 1.16, -0.92, 1.42 + wipp, -1.08, 0.22, 0.9, 0.18, "#39a0ff");
        // Brennstoffzelle unter der Haube: Kasten mit Lüftungsschlitzen
        ctx.fillStyle = "#2c3550"; rundRechteck(ctx, 0.72, 0.06, 0.62, 0.24, 0.05); ctx.fill();
        ctx.fillStyle = "#39a0ff";
        for (var i = 0; i < 4; i++) { rundRechteck(ctx, 0.78 + i * 0.14, 0.1, 0.07, 0.16, 0.03); ctx.fill(); }
        // blaues Leuchtband unten, Wassertropfen-Dekor an der Tür
        ctx.fillStyle = "#2c3550"; rundRechteck(ctx, -1.2, -0.36, 2.5, 0.1, 0.04); ctx.fill();
        ctx.fillStyle = "#7cc4ff"; rundRechteck(ctx, -1.15, -0.34, 2.4, 0.03, 0.015); ctx.fill();
        ctx.fillStyle = "#2f7fe0"; ctx.beginPath();
        ctx.moveTo(-0.1, 0.32); ctx.bezierCurveTo(-0.24, 0.12, -0.2, -0.04, -0.1, -0.04);
        ctx.bezierCurveTo(0.0, -0.04, 0.04, 0.12, -0.1, 0.32); ctx.fill();
        ctx.strokeStyle = dunkel(c, 0.35); ctx.lineWidth = 0.02; ctx.stroke();
        fuge(ctx, [[0.5, 0.42], [0.46, -0.2], [-0.92, -0.2], [-0.94, 0.48]], dunkel(c, 0.3));
        // Scheinwerfer-Leiste, Rücklicht
        var lg = ctx.createLinearGradient(1.3, 0, 1.85, 0);
        lg.addColorStop(0, "rgba(185,230,255,0)"); lg.addColorStop(1, "rgba(185,230,255,0.6)");
        ctx.fillStyle = lg; rundRechteck(ctx, 1.3, 0.02, 0.6, 0.2, 0.08); ctx.fill();
        ctx.fillStyle = "#e9f6ff"; rundRechteck(ctx, 1.44, 0.1, 0.28, 0.06, 0.03); ctx.fill();
        ruecklicht(ctx, -1.72, 0.14, 0.1, 0.14);
        glanz(ctx, 0.4, 0.38, 1.2, 0.33, 0.04);
      };
      return { hinten: hinten, vorne: vorne, fahrerKoerper: null, fahrerNachVorne: true, scheibe: scheibe };
    },
    eauto: function (ctx, a, z) {
      var c = basisFarbe(a);
      var scheibe = [[0.58, 0.38], [0.1, 0.7], [-0.55, 0.72], [-1.15, 0.6], [-1.3, 0.34]];
      var koerper = function () {
        // flache Fließheck-Karosserie (Akku sitzt ganz unten)
        ctx.beginPath();
        ctx.moveTo(-1.62, -0.28); ctx.lineTo(1.52, -0.28);
        ctx.quadraticCurveTo(1.78, -0.26, 1.75, 0.02);
        ctx.quadraticCurveTo(1.72, 0.24, 1.38, 0.30);
        ctx.quadraticCurveTo(0.95, 0.34, 0.6, 0.44);
        ctx.quadraticCurveTo(0.2, 0.78, -0.4, 0.78);
        ctx.quadraticCurveTo(-1.18, 0.78, -1.47, 0.44);
        ctx.quadraticCurveTo(-1.68, 0.24, -1.62, -0.28);
        ctx.closePath();
      };
      var vorne = function () {
        karosserie(ctx, a, z, koerper, -1.62, 1.75, -0.28, 0.78);
        glas(ctx, scheibe);
        // B-Säule, Türfugen, Griffe
        ctx.strokeStyle = "#2c3550"; ctx.lineWidth = 0.07;
        ctx.beginPath(); ctx.moveTo(-0.7, 0.36); ctx.lineTo(-0.7, 0.72); ctx.stroke();
        fuge(ctx, [[0.55, 0.36], [0.5, -0.2], [-0.7, -0.2], [-0.7, 0.36]], dunkel(c, 0.35));
        fuge(ctx, [[-0.7, -0.2], [-1.35, -0.2], [-1.4, 0.32]], dunkel(c, 0.35));
        ctx.fillStyle = "#c9ced9"; rundRechteck(ctx, 0.12, 0.24, 0.2, 0.045, 0.02); ctx.fill(); rundRechteck(ctx, -1.05, 0.24, 0.2, 0.045, 0.02); ctx.fill();
        // Akku im Unterboden + Blitz-Dekor
        ctx.fillStyle = "#2c3550"; rundRechteck(ctx, -1.15, -0.36, 2.35, 0.1, 0.04); ctx.fill();
        ctx.fillStyle = "#6ff3ff"; rundRechteck(ctx, -1.1, -0.34, 2.25, 0.03, 0.015); ctx.fill();
        blitzForm(ctx, 0.0, 0.08, 0.3); ctx.fillStyle = "#ffe066"; ctx.fill();
        ctx.strokeStyle = dunkel(c, 0.35); ctx.lineWidth = 0.02; ctx.stroke();
        // LED-Lichtleiste vorn mit Schein, Rücklicht-Band, Ladeklappe
        var lg = ctx.createLinearGradient(1.3, 0, 1.8, 0);
        lg.addColorStop(0, "rgba(185,251,255,0)"); lg.addColorStop(1, "rgba(185,251,255,0.6)");
        ctx.fillStyle = lg; rundRechteck(ctx, 1.3, 0.0, 0.6, 0.2, 0.08); ctx.fill();
        ctx.fillStyle = "#e9feff"; rundRechteck(ctx, 1.42, 0.08, 0.3, 0.06, 0.03); ctx.fill();
        ruecklicht(ctx, -1.68, 0.12, 0.1, 0.14);
        ctx.fillStyle = dunkel(c, 0.12); ctx.beginPath(); ctx.arc(-1.18, 0.1, 0.09, 0, Math.PI * 2); ctx.fill();
        blitzForm(ctx, -1.18, 0.1, 0.11); ctx.fillStyle = "#6ff3ff"; ctx.fill();
        glanz(ctx, -1.15, 0.7, -0.2, 0.74, 0.045);
        glanz(ctx, 0.75, 0.33, 1.35, 0.26, 0.04);
      };
      return { hinten: function () {}, vorne: vorne, fahrerKoerper: null, fahrerNachVorne: true, scheibe: scheibe };
    },

    mond: function (ctx, a, z) {
      var c = basisFarbe(a);
      var hinten = function () {
        // Solarpaneel + Antenne
        ctx.save(); ctx.translate(-1.05, 0.48); ctx.rotate(0.12);
        var sg = ctx.createLinearGradient(0, -0.06, 0, 0.08);
        sg.addColorStop(0, "#1f4aa8"); sg.addColorStop(1, "#4f86e8");
        ctx.fillStyle = sg; ctx.fillRect(-0.62, -0.06, 1.24, 0.14);
        ctx.strokeStyle = "#9cc3ff"; ctx.lineWidth = 0.02;
        for (var i = 1; i < 6; i++) { ctx.beginPath(); ctx.moveTo(-0.62 + i * 0.207, -0.06); ctx.lineTo(-0.62 + i * 0.207, 0.08); ctx.stroke(); }
        ctx.strokeStyle = TINTE; ctx.lineWidth = 0.025; ctx.strokeRect(-0.62, -0.06, 1.24, 0.14);
        ctx.restore();
        rohr(ctx, [[-1.05, 0.25], [-1.05, 0.44]], 0.04, "#b6bdcc");
        rohr(ctx, [[1.3, 0.25], [1.3, 0.95]], 0.04, "#b6bdcc");
        var sch = ctx.createLinearGradient(1.1, 0, 1.5, 0);
        sch.addColorStop(0, "#c9ced9"); sch.addColorStop(0.5, "#ffffff"); sch.addColorStop(1, "#aeb5c6");
        ctx.fillStyle = sch;
        ctx.beginPath(); ctx.arc(1.3, 1.0, 0.22, Math.PI * 1.1, Math.PI * 1.9); ctx.closePath(); ctx.fill();
        ctx.strokeStyle = TINTE; ctx.lineWidth = 0.02; ctx.stroke();
        ctx.fillStyle = "#ff5b5b"; ctx.beginPath(); ctx.arc(1.3, 1.05 + Math.sin(z * 6) * 0.01, 0.04, 0, Math.PI * 2); ctx.fill();
      };
      var koerper = function () { rundRechteck(ctx, -1.78, -0.22, 3.62, 0.5, 0.12); };
      var vorne = function () {
        karosserie(ctx, a, z, koerper, -1.78, 1.84, -0.22, 0.28);
        // Goldfolie (Hitzeschutz) mit Knitter-Glanz
        var gf = ctx.createLinearGradient(-1.6, 0, 1.6, 0);
        gf.addColorStop(0, "#c9962a"); gf.addColorStop(0.3, "#ffe58a"); gf.addColorStop(0.5, "#d9a83a"); gf.addColorStop(0.7, "#fff1b0"); gf.addColorStop(1, "#c9962a");
        ctx.fillStyle = gf; ctx.fillRect(-1.6, -0.06, 3.2, 0.08);
        ctx.fillStyle = dunkel(c, 0.2);
        for (var i = 0; i < 3; i++) { ctx.beginPath(); ctx.arc(-1.3 + i * 1.3, 0.28, 0.12, 0, Math.PI); ctx.fill(); }
        // Nieten
        ctx.fillStyle = "rgba(255,255,255,0.6)";
        for (i = 0; i < 9; i++) { ctx.beginPath(); ctx.arc(-1.62 + i * 0.4, 0.13, 0.018, 0, Math.PI * 2); ctx.fill(); }
        glanz(ctx, -1.6, 0.22, 1.6, 0.22, 0.04);
        scheinwerfer(ctx, 1.78, 0.08, 0.06);
      };
      return { hinten: hinten, vorne: vorne, fahrerKoerper: [-0.35, 0.22, 0.6, 0.34], raumhelm: true };
    }
  };

  /* Anhänger der Dampf-Lok (lokale Koordinaten des Anhängers, y nach oben).
     haken = Kupplung des Vordermanns in lokalen Koordinaten des Anhängers – dorthin
     reicht die Deichsel, auch wenn die Kupplung gerade etwas nachgibt. */
  var ANHAENGER = {
    kohlewagen: function (ctx, a, z, A, haken) {
      var c = basisFarbe(a), rot = "#c8322b";
      // kurze Kupplung mit Bügel
      rohr(ctx, [[0.72, 0.06], haken], 0.06, "#4a505e");
      ctx.strokeStyle = "#2a2d35"; ctx.lineWidth = 0.035;
      ctx.beginPath(); ctx.arc(haken[0], haken[1], 0.05, 0, Math.PI * 2); ctx.stroke();
      ctx.fillStyle = "#2a2d35"; ctx.fillRect(-0.78, -0.24, 1.56, 0.12);          // Rahmen
      ctx.fillStyle = rot; ctx.fillRect(-0.78, -0.14, 1.56, 0.05);
      // Kohlehaufen (oben hinausragend)
      ctx.fillStyle = "#16171c";
      ctx.beginPath(); ctx.moveTo(-0.7, 0.5);
      [[-0.55, 0.66], [-0.35, 0.72], [-0.15, 0.8], [0.05, 0.76], [0.25, 0.82], [0.45, 0.7], [0.62, 0.62], [0.7, 0.5]].forEach(function (p) { ctx.lineTo(p[0], p[1]); });
      ctx.closePath(); ctx.fill();
      ctx.fillStyle = "#3a3d48";
      [[-0.4, 0.66], [-0.05, 0.74], [0.3, 0.74], [0.52, 0.64], [-0.2, 0.62]].forEach(function (p) { ctx.beginPath(); ctx.arc(p[0], p[1], 0.04, 0, Math.PI * 2); ctx.fill(); });
      var kasten = function () { rundRechteck(ctx, -0.74, -0.1, 1.48, 0.62, 0.06); };
      karosserie(ctx, a, z, kasten, -0.74, 0.74, -0.1, 0.52);
      ctx.strokeStyle = "#e0b24a"; ctx.lineWidth = 0.03;
      ctx.beginPath(); ctx.moveTo(-0.7, 0.44); ctx.lineTo(0.7, 0.44); ctx.stroke();
      ctx.fillStyle = dunkel(c, 0.2); [-0.5, 0, 0.5].forEach(function (x) { ctx.fillRect(x - 0.015, -0.08, 0.03, 0.5); });
      // Puffer hinten
      ctx.fillStyle = rot; ctx.fillRect(-0.84, -0.24, 0.08, 0.3);
      ctx.fillStyle = "#6b7387"; ctx.fillRect(-0.9, -0.12, 0.06, 0.06);
    },
    anhaenger: function (ctx, a, z, A, haken) {
      // kleiner Holzwagen mit Gepäck und langer Deichsel (wackelt lustig)
      var c = basisFarbe(a);
      rohr(ctx, [[0.5, 0.0], [haken[0] - 0.06, haken[1]]], 0.05, "#6b4a2a");         // Deichsel (zwei Stangen)
      rohr(ctx, [[0.62, 0.12], [haken[0] - 0.06, haken[1]]], 0.04, "#7a5232");
      ctx.strokeStyle = "#4a505e"; ctx.lineWidth = 0.035;                          // Zugöse
      ctx.beginPath(); ctx.arc(haken[0], haken[1], 0.06, 0, Math.PI * 2); ctx.stroke();
      // Gepäck: Koffer, Paket mit Schleife, Ball
      ctx.fillStyle = "#c46a2a"; rundRechteck(ctx, -0.55, 0.3, 0.5, 0.34, 0.05); ctx.fill();
      ctx.strokeStyle = "#7a3c12"; ctx.lineWidth = 0.025; ctx.stroke();
      ctx.fillStyle = "#e0b24a"; ctx.fillRect(-0.36, 0.64, 0.12, 0.04);
      ctx.fillStyle = "#3cc35a"; rundRechteck(ctx, 0.0, 0.3, 0.38, 0.3, 0.03); ctx.fill();
      ctx.fillStyle = "#ffd23f"; ctx.fillRect(0.16, 0.3, 0.06, 0.3); ctx.fillRect(0.0, 0.42, 0.38, 0.06);
      ctx.fillStyle = "#e8453c"; ctx.beginPath(); ctx.arc(-0.15, 0.78, 0.12, 0, Math.PI * 2); ctx.fill();
      ctx.fillStyle = "#ffffff"; ctx.beginPath(); ctx.arc(-0.19, 0.82, 0.04, 0, Math.PI * 2); ctx.fill();
      // Holzkasten mit Brettern
      var kasten = function () { rundRechteck(ctx, -0.66, -0.12, 1.32, 0.5, 0.05); };
      ctx.fillStyle = "#a8743f"; kasten(); ctx.fill();
      ctx.strokeStyle = "#6b4a2a"; ctx.lineWidth = 0.025;
      [0.05, 0.22].forEach(function (y) { ctx.beginPath(); ctx.moveTo(-0.64, y); ctx.lineTo(0.64, y); ctx.stroke(); });
      kasten(); ctx.lineWidth = 0.04; ctx.stroke();
      ctx.fillStyle = c; ctx.fillRect(-0.66, 0.3, 1.32, 0.08);                     // Kante in Lokfarbe
      // Fähnchen hinten
      ctx.strokeStyle = "#4a505e"; ctx.lineWidth = 0.025;
      ctx.beginPath(); ctx.moveTo(-0.6, 0.38); ctx.lineTo(-0.6, 1.05); ctx.stroke();
      var weh = Math.sin(z * 9) * 0.04;
      ctx.fillStyle = "#ffd23f"; ctx.beginPath(); ctx.moveTo(-0.6, 1.05); ctx.lineTo(-0.9, 0.97 + weh); ctx.lineTo(-0.6, 0.89); ctx.closePath(); ctx.fill();
    }
  };

  /* Anhänger zeichnen (hinter der Lok, also vorher) */
  function zeichneAnhaenger(ctx, K, fz, def, aussehen, zeit) {
    var AN = fz.anhaenger || [];
    for (var i = AN.length - 1; i >= 0; i--) {
      var A = AN[i], C = A.chassis, V = FF.Physik.vordermann(fz, i), ad = def.anhaenger[i];
      var ca = Math.cos(C.a), sa = Math.sin(C.a);
      A.raeder.forEach(function (R) {
        var dx = R.k.x - C.x, dy = R.k.y - C.y;
        R.lokalX = ca * dx + sa * dy; R.lokalY = -sa * dx + ca * dy; R.chassisWinkel = C.a;
      });
      var H = V.chassis, hk = A.gelenk.haken, ch = Math.cos(H.a), shh = Math.sin(H.a);
      var hx = H.x + ch * hk[0] - shh * hk[1] - C.x, hy = H.y + shh * hk[0] + ch * hk[1] - C.y;
      var haken = [ca * hx + sa * hy, -sa * hx + ca * hy];
      ctx.save();
      ctx.translate(sx(K, C.x), sy(K, C.y));
      ctx.rotate(-C.a);
      ctx.scale(K.s, -K.s);
      (ANHAENGER[ad.form] || ANHAENGER.kohlewagen)(ctx, aussehen, zeit, A, haken);
      felgeJetzt = aussehen.felge || "standard";
      A.raeder.forEach(function (R) { zeichneRad(ctx, R, R.lokalX, R.lokalY, ad.form === "anhaenger" ? "normal" : "lok"); });
      felgeJetzt = "standard";
      ctx.restore();
    }
  }

  /* Fahrzeug an seiner Weltposition zeichnen */
  function zeichneFahrzeug(ctx, K, fz, def, aussehen, zeit, ausdruck) {
    var C = fz.chassis;
    if (fz.anhaenger && fz.anhaenger.length) zeichneAnhaenger(ctx, K, fz, def, aussehen, zeit);
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
    if (fz.duese > 0) zeichneDuesen(ctx, fz, def, zeit);
    else if (fz.mini > 0) zeichneDuesen(ctx, fz, def, zeit, true);
    zeichneFahrzeugLokal(ctx, fz, def, aussehen, zeit, ausdruck);
    if (fz.feder > 0) zeichneSprungfedern(ctx, fz);
    ctx.restore();
  }

  /* 🚀 Boost: Düsen fahren hinten aus der Karosserie, Flammen schießen heraus
     (lokale Fahrzeug-Koordinaten, y nach oben) */
  function zeichneDuesen(ctx, fz, def, zeit, klein) {
    // klein: Mini-Turbo vom Obst – nur eine kleine Rakete, kürzere Flamme
    var dauer = klein ? 1 : FF.CONFIG.regeln.extras.boostDauer, rest = klein ? fz.mini : fz.duese;
    var ein = Math.min(1, (dauer - rest) / 0.15, rest / 0.25);       // ausfahren / einfahren
    var xMin = Infinity, yU = Infinity, yO = -Infinity;
    def.huelle.forEach(function (p) { xMin = Math.min(xMin, p[0]); });
    def.huelle.forEach(function (p) { if (p[0] < xMin + 0.35) { yU = Math.min(yU, p[1]); yO = Math.max(yO, p[1]); } });
    var y = (yU + yO) / 2, rD = klein ? 0.1 : 0.14, x = xMin + 0.15 - (klein ? 0.25 : 0.35) * ein;
    (klein ? [y] : [y - 0.13, y + 0.13]).forEach(function (yd, i) {
      var fl = (0.9 + 0.5 * Math.sin(zeit * 47 + i * 2) + 0.3 * Math.sin(zeit * 83)) * ein * (0.5 + 0.5 * Math.min(1, rest / 0.5)) * (klein ? 0.6 : 1);
      // Flamme: außen orange, innen gelb, ganz innen weiß
      [["#ff5a1f", 1, 1], ["#ffcc33", 0.7, 0.62], ["#fffbe0", 0.4, 0.32]].forEach(function (f) {
        ctx.fillStyle = f[0];
        ctx.beginPath();
        ctx.moveTo(x - 0.1, yd + rD * f[2]);
        ctx.quadraticCurveTo(x - 0.1 - fl * 0.8 * f[1], yd + rD * 1.1 * f[2], x - 0.1 - fl * 1.6 * f[1], yd);
        ctx.quadraticCurveTo(x - 0.1 - fl * 0.8 * f[1], yd - rD * 1.1 * f[2], x - 0.1, yd - rD * f[2]);
        ctx.fill();
      });
      // Düse (Metallkegel)
      ctx.fillStyle = "#6b7590";
      ctx.beginPath(); ctx.moveTo(x + 0.3, yd + rD * 0.6); ctx.lineTo(x - 0.1, yd + rD); ctx.lineTo(x - 0.1, yd - rD); ctx.lineTo(x + 0.3, yd - rD * 0.6); ctx.fill();
      ctx.fillStyle = "#3b4566"; ctx.fillRect(x - 0.14, yd - rD, 0.06, 2 * rD);
    });
  }

  /* 🦘 Sprungfeder: dicke Federn schießen unter den Rädern heraus und fahren wieder ein */
  function zeichneSprungfedern(ctx, fz) {
    var t = fz.feder / 0.6, L = 1.3 * Math.sin(Math.PI * Math.min(1, (1 - t) * 1.6 + 0.15));
    if (L <= 0.05) return;
    fz.raeder.forEach(function (R) {
      var x = R.lokalX, y0 = R.lokalY - R.r * 0.6, y1 = y0 - L, n = 6, b = 0.2;
      ctx.lineCap = "round"; ctx.lineJoin = "round";
      ctx.strokeStyle = "#c2302a"; ctx.lineWidth = 0.11;
      ctx.beginPath(); ctx.moveTo(x, y0);
      for (var i = 1; i < n; i++) ctx.lineTo(x + (i % 2 ? b : -b), y0 - L * i / n);
      ctx.lineTo(x, y1); ctx.stroke();
      ctx.fillStyle = "#ffd23f"; ctx.fillRect(x - 0.3, y1 - 0.08, 0.6, 0.12);
    });
  }

  var taucherHelm = false;                   // Meeresgrund: Fiete trägt einen Taucherhelm (Glaskugel)
  function zeichneFahrzeugLokal(ctx, fz, def, aussehen, zeit, ausdruck) {
    var form = KAROSSERIE[def.form] ? def.form : "buggy";
    var teile = KAROSSERIE[form](ctx, aussehen, zeit, fz);
    var kp = fz.kopf;
    var tempo = Math.hypot(fz.chassis.vx, fz.chassis.vy);
    var artRad = form === "traktor" ? "traktor" : form === "monster" ? "monster" : form === "mond" ? "mond" : form === "eauto" || form === "wasserstoff" ? "aero" : form === "dampflok" ? "lok" : "normal";

    // Federn
    if (!teile.ohneFedern) fz.raeder.forEach(function (R) {
      zeichneFeder(ctx, R.ankerX, R.ankerY, R.lokalX, R.lokalY, Math.min(0.13, R.r * 0.3));
    });
    var o = outfitVon(aussehen), kind = kindVon(aussehen);
    var tk = koerperFuer(teile, kind);
    var kopf = { x: kp.x, y: kp.y + kind.groesse, r: KOPF_R };
    var fahrer = function () {
      zeichneAnzug(ctx, o, tk, kopf, KOPF_R);
      zeichneKind(ctx, kopf.x, kopf.y, KOPF_R, ausdruck, teile.raumhelm || taucherHelm, kind, Math.min(1, tempo / 12), zeit);
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
    // Beifahrer: ein Tier sitzt hinter dem Kind (beim Skateboard vorne auf dem Brett)
    if (aussehen.beifahrer) {
      var bx = form === "skateboard" ? 0.45 : kp.x - 0.52, by = form === "skateboard" ? -0.05 : kp.y - 0.08 + kind.groesse * 0.5;
      var bfe = aussehen.beifahrer, spr = emojiSprite(bfe, 64, 1), hopp = Math.abs(Math.sin(zeit * 6)) * 0.03;
      ctx.save(); ctx.translate(bx, by + hopp); ctx.scale(-1, -1);   // schaut nach vorn
      // kleine Eigenarten der Tiere (Version 30)
      if (bfe === "🐧") { ctx.translate(Math.sin(zeit * 3.2) * 0.05, 0); ctx.rotate(Math.sin(zeit * 6.4) * 0.22); }       // watschelt
      else if (bfe === "🦊") ctx.rotate(Math.sin(zeit * 9) * 0.1);                                                    // im Fahrtwind
      else if (bfe === "🦉" && Math.sin(zeit * 0.9) > 0.75) ctx.scale(-1, 1);                                         // dreht den Kopf
      else if (bfe === "🐺") ctx.rotate(-0.06 + Math.sin(zeit * 2) * 0.04);
      ctx.drawImage(spr, -0.3, -0.3, 0.6, 0.6);
      if (bfe === "🐼") {                                     // Bambus zum Mampfen
        var bam = emojiSprite("🎋", 40, 1), kau = Math.sin(zeit * 7) * 0.04;
        ctx.save(); ctx.translate(0.24, 0.06 + kau); ctx.rotate(0.4); ctx.drawImage(bam, -0.2, -0.2, 0.4, 0.4); ctx.restore();
      } else if (bfe === "🐢") {                              // Sturzhelm (Bildkoordinaten: −y oben, −x vorn)
        ctx.fillStyle = "#e8413b"; ctx.strokeStyle = TINTE; ctx.lineWidth = 0.025;
        ctx.beginPath(); ctx.ellipse(-0.15, -0.06, 0.1, 0.085, 0, Math.PI, 0); ctx.closePath(); ctx.fill(); ctx.stroke();
        ctx.fillStyle = "rgba(255,255,255,0.7)"; ctx.beginPath(); ctx.ellipse(-0.18, -0.1, 0.03, 0.018, -0.3, 0, Math.PI * 2); ctx.fill();
        ctx.fillStyle = "#ffd23f"; ctx.fillRect(-0.25, -0.075, 0.2, 0.02);
      }
      ctx.restore();
    }
    // Räder zuletzt (vorn)
    felgeJetzt = aussehen.felge || "standard";
    fz.raeder.forEach(function (R) { zeichneRad(ctx, R, R.lokalX, R.lokalY, artRad); });
    felgeJetzt = "standard";
    if (teile.nachRaedern) teile.nachRaedern();
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
    var R = (Math.max(0.55 * g.def.groesse.laenge, FF.Physik.zugHinten(g.def) + 0.3) + 1.4) * s, nachOben = R;
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
      } else if (p.art === "tropfen") {
        ctx.fillStyle = p.farbe;
        ctx.beginPath(); ctx.arc(X, Y, p.r0 * K.s * (1 - u * 0.4), 0, Math.PI * 2); ctx.fill();
      } else if (p.art === "scherbe") {                       // Glasscherbe: Dreieck, dreht sich
        var sr = p.r0 * K.s;
        ctx.save(); ctx.translate(X, Y); ctx.rotate(p.w || 0);
        ctx.fillStyle = "rgba(170,225,250,0.85)"; ctx.strokeStyle = "rgba(50,130,195,0.8)"; ctx.lineWidth = 1.2;
        ctx.beginPath(); ctx.moveTo(-sr, -sr * 0.6); ctx.lineTo(sr * 0.9, -sr * 0.2); ctx.lineTo(-sr * 0.1, sr); ctx.closePath(); ctx.fill(); ctx.stroke();
        ctx.restore();
      } else if (p.art === "klotz") {                         // fliegender Baustein
        var kb = p.r0 * K.s, kh = kb * 0.55;
        ctx.save(); ctx.translate(X, Y); ctx.rotate(p.w || 0);
        ctx.fillStyle = p.farbe; ctx.fillRect(-kb / 2, -kh / 2, kb, kh);
        ctx.fillRect(-kb * 0.35, -kh / 2 - kh * 0.25, kb * 0.25, kh * 0.25); ctx.fillRect(kb * 0.1, -kh / 2 - kh * 0.25, kb * 0.25, kh * 0.25);
        ctx.fillStyle = "rgba(0,0,0,0.15)"; ctx.fillRect(-kb / 2, kh * 0.25, kb, kh * 0.25);
        ctx.restore();
      } else if (p.art === "herz") {
        var hr = p.r0 * K.s;
        ctx.fillStyle = p.farbe;
        ctx.beginPath(); ctx.moveTo(X, Y + hr * 0.9);
        ctx.bezierCurveTo(X - hr * 1.6, Y - hr * 0.1, X - hr * 0.7, Y - hr * 1.2, X, Y - hr * 0.45);
        ctx.bezierCurveTo(X + hr * 0.7, Y - hr * 1.2, X + hr * 1.6, Y - hr * 0.1, X, Y + hr * 0.9); ctx.fill();
      } else if (p.art === "blase") {
        var rb = (p.r0 + (p.r1 - p.r0) * u) * K.s;
        ctx.strokeStyle = "rgba(225,248,255,0.85)"; ctx.lineWidth = Math.max(1, rb * 0.25);
        ctx.beginPath(); ctx.arc(X, Y, rb, 0, Math.PI * 2); ctx.stroke();
        ctx.fillStyle = "rgba(255,255,255,0.8)"; ctx.beginPath(); ctx.arc(X - rb * 0.35, Y - rb * 0.35, rb * 0.25, 0, Math.PI * 2); ctx.fill();
      } else if (p.art === "stroh") {                         // Strohhalm: kurzer gelber Strich, dreht sich
        var sl = p.r0 * K.s;
        ctx.save(); ctx.translate(X, Y); ctx.rotate(p.w || 0);
        ctx.strokeStyle = p.farbe || "#f2cf5e"; ctx.lineWidth = Math.max(1.5, 0.06 * K.s); ctx.lineCap = "round";
        ctx.beginPath(); ctx.moveTo(-sl, 0); ctx.lineTo(sl, 0); ctx.stroke();
        ctx.restore();
      } else if (p.art === "emoji") {                         // Spur-Gegenstand (Ente, Banane, Socke, Tatze)
        var es = p.r0 * K.s, espr = emojiSprite(p.emoji, Math.min(96, Math.max(16, es * 1.2)), 1);
        ctx.save(); ctx.translate(X, Y); ctx.rotate(p.w || 0);
        ctx.drawImage(espr, -es / 2, -es / 2, es, es); ctx.restore();
      } else if (p.art === "pups") {                          // grünes Pups-Wölkchen aus drei Kugeln
        var pr = (p.r0 + (p.r1 - p.r0) * Math.sqrt(u)) * K.s;
        ctx.fillStyle = "rgba(150,205,90,0.75)";
        ctx.beginPath(); ctx.arc(X, Y, pr, 0, Math.PI * 2);
        ctx.arc(X + pr * 0.75 * Math.cos(p.w), Y + pr * 0.6 * Math.sin(p.w), pr * 0.7, 0, Math.PI * 2);
        ctx.arc(X - pr * 0.7 * Math.sin(p.w), Y + pr * 0.55 * Math.cos(p.w), pr * 0.6, 0, Math.PI * 2); ctx.fill();
        ctx.fillStyle = "rgba(200,240,150,0.6)"; ctx.beginPath(); ctx.arc(X - pr * 0.3, Y - pr * 0.3, pr * 0.35, 0, Math.PI * 2); ctx.fill();
      } else if (p.art === "popcorn") {                       // Popcorn: weißes Knubbelchen mit gelbem Kern
        var po = p.r0 * K.s;
        ctx.save(); ctx.translate(X, Y); ctx.rotate(p.w || 0);
        ctx.fillStyle = "#fffaf0"; ctx.strokeStyle = "rgba(160,120,60,0.6)"; ctx.lineWidth = Math.max(1, po * 0.12);
        ctx.beginPath(); ctx.arc(-po * 0.45, 0, po * 0.65, 0, Math.PI * 2); ctx.arc(po * 0.45, -po * 0.1, po * 0.6, 0, Math.PI * 2);
        ctx.arc(0, -po * 0.55, po * 0.6, 0, Math.PI * 2); ctx.fill(); ctx.stroke();
        ctx.fillStyle = "#f2c94c"; ctx.beginPath(); ctx.arc(0, po * 0.35, po * 0.35, 0, Math.PI * 2); ctx.fill();
        ctx.restore();
      } else if (p.art === "konfetti") {
        ctx.save(); ctx.translate(X, Y); ctx.rotate(p.w || 0);
        ctx.fillStyle = p.farbe; ctx.fillRect(-0.09 * K.s, -0.05 * K.s, 0.18 * K.s, 0.1 * K.s);
        ctx.restore();
      }
    }
    ctx.globalAlpha = 1;
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
  /* Rundinstrument. skala = Zahlen an den großen Strichen (z. B. [0, 20, 40 …] km/h
     oder [0, 2, 4 …] tausend U/min), einheit = kleine Zeile unter dem Wert */
  function zeichneInstrument(ctx, x, y, r, wert, max, titel, beschriftung, rotAb, skala, einheit) {
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
      var a = a0 + (a1 - a0) * i / 10, l = i % 5 === 0 ? 0.68 : 0.76;
      ctx.beginPath(); ctx.moveTo(Math.cos(a) * r * l, Math.sin(a) * r * l); ctx.lineTo(Math.cos(a) * r * 0.88, Math.sin(a) * r * 0.88); ctx.stroke();
    }
    if (skala && r >= 30) {                                     // Zahlen an der Skala
      ctx.fillStyle = "rgba(255,255,255,0.7)"; ctx.font = "700 " + Math.round(r * 0.15) + "px 'Nunito', sans-serif";
      ctx.textAlign = "center"; ctx.textBaseline = "middle";
      skala.forEach(function (z) { var az = a0 + (a1 - a0) * z / max; ctx.fillText(String(z), Math.cos(az) * r * 0.6, Math.sin(az) * r * 0.6); });
    }
    var w = a0 + (a1 - a0) * Math.max(0, Math.min(1, wert / max));
    ctx.strokeStyle = "#ff9e2c"; ctx.lineWidth = 3; ctx.lineCap = "round";
    ctx.beginPath(); ctx.moveTo(0, 0); ctx.lineTo(Math.cos(w) * r * 0.78, Math.sin(w) * r * 0.78); ctx.stroke();
    ctx.fillStyle = "#f3c44a"; ctx.beginPath(); ctx.arc(0, 0, r * 0.1, 0, Math.PI * 2); ctx.fill();
    ctx.fillStyle = "#ffffff"; ctx.textAlign = "center"; ctx.textBaseline = "middle";
    ctx.font = "800 " + Math.round(r * (beschriftung.length > 4 ? 0.3 : 0.36)) + "px 'Baloo 2', sans-serif";
    ctx.fillText(beschriftung, 0, r * 0.3);
    ctx.font = "800 " + Math.round(r * 0.17) + "px 'Nunito', sans-serif";
    ctx.fillStyle = "#ffd27a";
    ctx.fillText(titel, 0, -r * 0.14);
    if (einheit) { ctx.fillStyle = "#aebce6"; ctx.font = "700 " + Math.round(r * 0.17) + "px 'Nunito', sans-serif"; ctx.fillText(einheit, 0, r * 0.5); }
    ctx.restore();
  }

  /* „Schöne“ Schrittweite für die Skala, etwa 4–6 Zahlen */
  function skalaSchritte(max) {
    var roh = max / 5, p = Math.pow(10, Math.floor(Math.log(roh) / Math.LN10)), n = roh / p;
    var st = (n <= 1 ? 1 : n <= 2 ? 2 : n <= 2.5 ? 2.5 : n <= 5 ? 5 : 10) * p, aus = [];
    for (var z = 0; z <= max + 1e-6; z += st) aus.push(Math.round(z * 10) / 10);
    return aus;
  }

  /* Tacho und Drehzahlmesser. Drehzahl wie beim Klang aus dem virtuellen Getriebe:
     Verbrenner mit Gang darüber und rotem Bereich, Elektromotor ohne Gänge (dreht bis
     15 000–22 000 U/min), Flieger ohne Getriebe (Propellerdrehzahl). Die Skala zeigt
     tausend U/min, in der Mitte steht die volle Zahl. */
  function zeichneInstrumente(ctx, K, fahrt) {
    if (!fahrt.getriebe) return;
    var st = fahrt.fz.status;
    var r = Math.max(26, Math.min(44, K.h * 0.085));
    var y = K.h - r * 0.75 - 8;
    var kmh = Math.round(Math.abs(st.vorwaerts) * 3.6);
    var vmaxKmh = Math.max(40, Math.ceil(fahrt.werte.motor.vmax * 3.6 / 20) * 20 + 20);
    zeichneInstrument(ctx, K.b / 2 - r * 1.15, y, r, kmh, vmaxKmh, "", String(kmh), 0, skalaSchritte(vmaxKmh), "km/h");
    var G = fahrt.getriebe, tsd = Math.ceil(G.max / 1000), umin = Math.round(G.rpm / 100) * 100;
    var titel = G.elektro ? "⚡ E-Motor" : G.turbine ? "🔥 Turbine" : G.dampf ? "♨️ Dampf" : (G.gaenge > 1 ? G.gang + ". Gang" : "Motor");
    if (G.dampf) umin = Math.round(G.rpm / 10) * 10;
    zeichneInstrument(ctx, K.b / 2 + r * 1.15, y, r, G.rpm / 1000, tsd, titel, umin.toLocaleString("de-DE"),
                      G.elektro || G.turbine || G.dampf ? 0 : 0.9 * G.max / 1000 / tsd, skalaSchritte(tsd), "U/min");
  }

  /* =========================================================================
     9) GESAMTE SZENE
     sz = { fahrt, kamera, zeit, dt, partikel, texte, wetter, aussehen, kraefte, instrumente, ausdruck }
     ========================================================================= */
  function zeichneSzene(ctx, sz) {
    var K = sz.kamera, f = sz.fahrt, welt = f.welt, gel = f.gelaende, z = sz.zeit, W = FF.GrafikWelt;
    taucherHelm = !!(welt.unterwasser || welt.helm);
    W.windAktualisieren(K, welt, gel, sz.dt);
    W.zeichneHimmel(ctx, K, welt, z, sz.himmelPerCss);
    W.zeichneWolken(ctx, K, welt, z);
    sz.wetter.zeichne(ctx, K, sz.dt, z, true);
    W.zeichneBerge(ctx, K, welt, z, gel);
    W.zeichneDecke(ctx, K, gel, welt, z);
    var b = sichtbereich(K, gel);
    zeichneDeko(ctx, K, gel, b[2], b[3], sz.dpr || 1, z);
    W.zeichneGelaende(ctx, K, gel, welt, z);
    if (gel.pfuetzen.length) W.zeichneWasser(ctx, K, gel, welt, z, b[2], b[3]);
    if (gel.trampoline.length) W.zeichneTrampoline(ctx, K, gel, f.zeit);
    if (gel.baender.length) W.zeichneBaender(ctx, K, gel, z);
    if (gel.schwebezonen.length) W.zeichneSchwebezonen(ctx, K, gel, z);
    if (gel.objekte.length) W.zeichneObjekte(ctx, K, gel, b[2], b[3]);
    if (gel.spuk.length) W.zeichneSpuk(ctx, K, gel, f.fz.chassis.x, z);
    if (gel.katapulte.length) W.zeichneKatapulte(ctx, K, gel, f.zeit);
    if (gel.scheunen.length) W.zeichneScheunen(ctx, K, gel, "hinten");
    if (gel.roehren.length) W.zeichneRoehren(ctx, K, gel, welt, "hinten", z);
    zeichneSchilder(ctx, K, gel, b[2], b[3]);
    zeichneLoopings(ctx, K, gel);
    zeichneStartZiel(ctx, K, gel, z);
    zeichneItems(ctx, K, gel, z, b[2], b[3], f.werte.akku ? "akku" : f.werte.wasserstoff ? "h2" : "", sz.dpr || 1);
    var geistSichtbar = sz.geist ? zeichneGeist(ctx, K, sz.geist, z) : true;
    zeichneHilfe(ctx, K, f.hilfe, f.fz.chassis, z);
    if (f.roehre && f.roehre.z) {
      // Röhre mit Kurve nach links (näher, größer) oder rechts (weiter weg, kleiner):
      // eigene Kamera mit anderem Maßstab, das Auto bleibt an derselben Stelle im Bild
      var q = 1 + 0.22 * f.roehre.z, ch = f.fz.chassis, K2 = Object.create(K);
      K2.s = K.s * q; K2.x = ch.x - (ch.x - K.x) / q; K2.y = ch.y - (ch.y - K.y) / q;
      zeichneFahrzeug(ctx, K2, f.fz, f.def, sz.aussehen, z, sz.ausdruck);
    } else zeichneFahrzeug(ctx, K, f.fz, f.def, sz.aussehen, z, sz.ausdruck);
    if (gel.roehren.length) W.zeichneRoehren(ctx, K, gel, welt, "vorn", z);
    if (gel.scheunen.length) W.zeichneScheunen(ctx, K, gel, "vorn");
    sz.partikel.zeichne(ctx, K);
    if (welt.nacht) W.zeichneNacht(ctx, K, f, sz);
    zeichneTexte(ctx, K, sz.texte);
    sz.wetter.zeichne(ctx, K, sz.dt, z, false);
    if (sz.geist && !geistSichtbar) zeichneGeistPfeil(ctx, K, sz.geist, f.fz.chassis);
    if (sz.kraefte) zeichneKraefte(ctx, K, f);
    if (sz.instrumente) zeichneInstrumente(ctx, K, f);
  }

  /* Vorschau in der Garage: Fahrzeug auf kleinem Boden, leicht wippend */
  var vorschauCache = {};
  function zeichneVorschau(ctx, b, h, def, aussehen, zeit, ohneBuehne) {
    taucherHelm = false;
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
      (c.anhaenger || []).forEach(function (A) { A.raeder.forEach(function (R) { R.k.y += 0.05; }); });
    }
    var fz = c;
    // Höhe aus Rädern, Umriss, Dach und Kopf bestimmen (Monstertruck ist hoch!)
    var unten = Infinity, oben = -Infinity;
    fz.raeder.forEach(function (R) { unten = Math.min(unten, R.ankerY - R.L0 - R.r); });
    def.huelle.concat(def.dach || []).forEach(function (p) { oben = Math.max(oben, p[1]); });
    oben = Math.max(oben, def.kopf.y + def.kopf.r * (def.form === "mond" ? 1.6 : 1.15));
    var laenge = def.groesse.laenge + 0.8, hoehe = (oben - unten) * 1.12 + 0.3, mitteX = 0;
    if (def.anhaenger) {                                 // Zug: von der Nase bis zum letzten Anhänger
      var vorn = 0; def.huelle.forEach(function (p) { vorn = Math.max(vorn, p[0]); });
      var hinten = FF.Physik.zugHinten(def);
      laenge = vorn + hinten + 0.6; mitteX = (vorn - hinten) / 2;
    }
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
    fz.raeder.forEach(function (R) { R.k.a = -zeit * 2.5 * (def.kuppelstange ? 0.42 / R.r : 1); });
    (fz.anhaenger || []).forEach(function (A) { A.raeder.forEach(function (R) { R.k.a = -zeit * 2.5 * 0.42 / R.r; }); });
    var K = { x: mitteX, y: unterkante, s: s, b: b, h: h, ankerX: 0.5, ankerY: bodenY / h };
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
    // Nur-Kopf-Bild (Fortschrittsleiste, Spielerwahl, Lobby): fester Rahmen aus kinder.js,
    // beide Kinder gleich groß, Dutt und Cap passen hinein
    if (nurKopf) { FF.Kinder.zeichneKopfbild(ctx, b, h, kind, ausdruck || "normal", zeit || 0); return; }
    var tk = koerperFuer(PORTRAIT_TEILE, kind), kp = { x: 0, y: g, r: KOPF_R };
    var s = Math.min(b / 1.2, h / (1.32 + g));
    ctx.save();
    ctx.translate(b / 2 + 0.08 * s, h / 2 - (0.18 - g / 2) * s);
    ctx.scale(s, -s);
    zeichneRuecken(ctx, o, tk, kp, KOPF_R, zeit || 0, 6);
    zeichneAnzug(ctx, o, tk, kp, KOPF_R);
    zeichneKind(ctx, 0, g, KOPF_R, ausdruck || "normal", false, kind, 0.5, zeit || 0);
    ctx.restore();
  }

  FF.Grafik = {
    zeichneSzene: zeichneSzene,
    zeichneVorschau: zeichneVorschau,
    zeichnePortrait: zeichnePortrait,
    zeichneMuenze: zeichneMuenze,
    Partikel: Partikel,
    emojiSprite: emojiSprite,
    hell: hell, dunkel: dunkel,
    // Wetter und himmelCss trägt grafik-welt.js ein
    // für grafik-welt.js: gemeinsame Helfer
    hilfe: { sx: sx, sy: sy, weltX: weltX, mische: mische, hell: hell, dunkel: dunkel, sichtbereich: sichtbereich, TINTE: TINTE }
  };
})();
