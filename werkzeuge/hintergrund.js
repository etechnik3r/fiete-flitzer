#!/usr/bin/env node
/* ===========================================================================
   Fiete Flitzer – werkzeuge/hintergrund.js
   ---------------------------------------------------------------------------
   Prüft, ob der Hintergrund sich wie echte Kulissen bewegt: Jede Berg-Ebene
   (mit ihren Silhouetten) muss beim Fahren STARR bleiben – sie darf sich nur
   verschieben bzw. gleichmäßig zoomen, nie ihre Form ändern (das wäre Flimmern,
   „schwimmende“ Gipfel oder springende Stufen).

   Je Welt und Ebene wird die Ebene allein gemalt (zeichneBerge(..., nurEbene)):
     1) Fahren:  Kamera um genau 5 Pixel der Ebene weiter → Bild muss exakt um
                 5 px verschoben sein. Gemessen an 6 Stellen der Strecke.
     2) Zoomen:  Tempo-Zoom 1 → 0,85 → Bild muss gleichmäßig um den Anker skaliert
                 sein (Breite und Höhe gleich).
     3) Höhe:    Kamera 1 m höher → Bild darf sich nur senkrecht verschieben.
   Ergebnis: Anteil falscher Pixel (‰) nach der erwarteten Bewegung. Kanten-
   glättung allein ergibt etwa 1–3 ‰.
   Außerdem: Die Bezugshöhe der Berge darf entlang der Strecke nicht springen
   oder abknicken (sonst ruckt der Hintergrund senkrecht).

     node werkzeuge/hintergrund.js                 alle Welten
     node werkzeuge/hintergrund.js bausteine schnee
     HG_ERSATZ=/pfad/grafik-welt.js node werkzeuge/hintergrund.js   andere Fassung messen

   Braucht Playwright mit Chromium (wie werkzeuge/browsertest.js).
   =========================================================================== */
"use strict";
var path = require("path"), http = require("http"), fs = require("fs");
var chromium = require("playwright").chromium;
var BASIS = path.join(__dirname, ".."), ERSATZ = process.env.HG_ERSATZ;
var nur = process.argv.slice(2);
var GRENZE = { fahren: 6, zoomen: 12, hoehe: 10, knick: 0.05 };   // ‰

var TYPEN = { ".html": "text/html", ".js": "application/javascript", ".css": "text/css", ".png": "image/png", ".woff2": "font/woff2", ".jpg": "image/jpeg" };
var server = http.createServer(function (req, res) {
  var d = decodeURIComponent(req.url.split("?")[0]); if (d === "/") d = "/index.html";
  var v = path.join(BASIS, path.normalize(d));
  if (ERSATZ && d === "/grafik-welt.js") v = ERSATZ;
  else if (v.indexOf(BASIS) !== 0 || !fs.existsSync(v) || fs.statSync(v).isDirectory()) { res.writeHead(404); res.end(); return; }
  res.writeHead(200, { "Content-Type": TYPEN[path.extname(v)] || "application/octet-stream" }); fs.createReadStream(v).pipe(res);
});

server.listen(0, "127.0.0.1", async function () {
  var browser = await chromium.launch();
  var page = await (await browser.newContext({ viewport: { width: 844, height: 390 }, deviceScaleFactor: 1 })).newPage();
  var fehler = [];
  page.on("pageerror", function (e) { fehler.push(e.message); });
  await page.addInitScript(function () { window.FF_OHNE_COUNTDOWN = true; });
  await page.goto("http://127.0.0.1:" + server.address().port + "/");
  await page.waitForTimeout(400);
  var erg = await page.evaluate(function (nur) {
    var B = 844, H = 390, W = FF.GrafikWelt;
    function leinwand() { var c = document.createElement("canvas"); c.width = B; c.height = H; return c; }
    var cA = leinwand(), cB = leinwand(), cE = leinwand();
    function male(c, K, welt, gel, e) {
      var x = c.getContext("2d"); x.setTransform(1, 0, 0, 1, 0, 0); x.clearRect(0, 0, B, H);
      W.zeichneBerge(x, K, welt, 1.0, gel, e);
    }
    // Anteil Pixel, die sich unterscheiden (Alpha oder Farbe), im Inneren (Rand 16 px)
    function fehlerAnteil(c1, c2, r) {
      r = r || [16, 16, B - 16, H - 16];
      var x0 = Math.ceil(r[0]), y0 = Math.ceil(r[1]), bb = Math.floor(r[2]) - x0, hh = Math.floor(r[3]) - y0;
      var a = c1.getContext("2d").getImageData(x0, y0, bb, hh).data, b = c2.getContext("2d").getImageData(x0, y0, bb, hh).data;
      var falsch = 0, belegt = 0;
      for (var i = 0; i < a.length; i += 4) {
        var d = Math.abs(a[i] - b[i]) + Math.abs(a[i + 1] - b[i + 1]) + Math.abs(a[i + 2] - b[i + 2]) + Math.abs(a[i + 3] - b[i + 3]);
        if (a[i + 3] || b[i + 3]) belegt++;
        if (d > 200) falsch++;   // nur echte Fehler, keine weichen Kanten
      }
      return belegt ? 1000 * falsch / belegt : 0;
    }
    function erwartet(quelle, dx, dy, skala, ax, ay) {   // quelle verschoben/skaliert nach cE
      var x = cE.getContext("2d"); x.setTransform(1, 0, 0, 1, 0, 0); x.clearRect(0, 0, B, H);
      x.imageSmoothingEnabled = true;   // Bruchteile von Pixeln: Kanten weich wie beim Malen
      x.translate(ax + dx, ay + dy); x.scale(skala, skala); x.translate(-ax, -ay);
      x.drawImage(quelle, 0, 0); x.setTransform(1, 0, 0, 1, 0, 0);
      return cE;
    }
    // mittlere Oberkante (Zeile des ersten deckenden Pixels je Spalte)
    function oberkante(c) {
      var d = c.getContext("2d").getImageData(0, 0, B, H).data, s = 0, n = 0;
      for (var x = 16; x < B - 16; x += 4) for (var y = 0; y < H; y++) if (d[(y * B + x) * 4 + 3] > 128) { s += y; n++; break; }
      return n ? s / n : 0;
    }
    // Bereich, den das skalierte alte Bild noch abdeckt (Rand 16 px)
    function innen(zf) { var ax = B * 0.4, ay = H * 0.58; return [ax - (ax - 16) * zf, ay - (ay - 16) * zf, ax + (B - 16 - ax) * zf, ay + (H - 16 - ay) * zf]; }
    var aus = [];
    FF.CONFIG.welten.forEach(function (welt, wi) {
      if (nur.length && nur.indexOf(welt.id) < 0) return;
      FF.spiel.starteFahrt(wi, 1, false);
      var gel = FF.spiel.fahrt.gelaende, ende = gel.x0 + (gel.h.length - 1) * gel.dx;
      var S = H / FF.CONFIG.kamera.sichtHoehe;
      var r = { welt: welt.id, fahren: 0, zoomen: 0, hoehe: 0, sprung: 0 };
      var fak = [0.08, 0.2, 0.42];
      for (var st = 0; st < 6; st++) {
        var x0 = 20 + (ende - 60) * (st + 0.37) / 6, y0 = gel.hoeheBei(x0) + 1.2;
        var K = { x: x0, y: y0, s: S, b: B, h: H, ankerX: 0.4, ankerY: 0.58, zoom: 1 };
        for (var e = 0; e < 3; e++) {
          // 1) Fahren: genau 5 px dieser Ebene (ohne Gelände: nur die Form zählt)
          male(cA, K, welt, null, e);
          var K2 = Object.assign({}, K, { x: K.x + 5 / (S * fak[e]) });
          male(cB, K2, welt, null, e);
          r.fahren = Math.max(r.fahren, fehlerAnteil(erwartet(cA, -5, 0, 1, 0, 0), cB));
          // 2) Zoomen: 1 → 0,85, Skalierung um den Anker, Faktor je Ebene aus dem Bild geschätzt
          var K3 = Object.assign({}, K, { s: S * 0.85, zoom: 0.85 }), besterZ = Infinity;
          male(cB, K3, welt, null, e);
          var zBest = 1;
          for (var zf = 0.84; zf <= 1.0001; zf += 0.01) { var fz = fehlerAnteil(erwartet(cA, 0, 0, zf, B * 0.4, H * 0.58), cB, innen(zf)); if (fz < besterZ) { besterZ = fz; zBest = zf; } }
          for (var zf2 = zBest - 0.01; zf2 <= zBest + 0.01; zf2 += 0.001) besterZ = Math.min(besterZ, fehlerAnteil(erwartet(cA, 0, 0, zf2, B * 0.4, H * 0.58), cB, innen(zf2)));
          r.zoomen = Math.max(r.zoomen, besterZ);
          // 3) Höhe: Kamera 1 m höher (mit Gelände) – nur senkrechte Verschiebung erlaubt
          male(cA, K, welt, gel, e);
          male(cB, Object.assign({}, K, { y: K.y + 1 }), welt, gel, e);
          var besterH = Infinity, dyBest = oberkante(cB) - oberkante(cA);   // Schätzung, dann fein suchen
          for (var dy2 = dyBest - 1.5; dy2 <= dyBest + 1.5; dy2 += 0.25) besterH = Math.min(besterH, fehlerAnteil(erwartet(cA, 0, dy2, 1, 0, 0), cB));
          r.hoehe = Math.max(r.hoehe, besterH);
        }
      }
      // Bezugshöhe: Sie darf sich nur sanft ändern – gemessen wird der größte Knick
      // (zweite Differenz alle 0,5 m, in Pixeln der vordersten Ebene)
      var v0 = null, v1 = null;
      if (W.bezugsHoehe) for (var xx = 0; xx < ende; xx += 0.5) {
        var v = W.bezugsHoehe(gel, xx) * S * 0.42 * 0.7;
        if (v1 !== null) r.sprung = Math.max(r.sprung, Math.abs(v - 2 * v0 + v1));
        v1 = v0; v0 = v;
      } else r.sprung = -1;
      aus.push(r);
    });
    FF.spiel.zeigeMenue && FF.spiel.zeigeMenue();
    return aus;
  }, nur);
  var schlecht = 0;
  console.log("Welt            Fahren  Zoomen  Höhe   (‰ falsche Pixel)   Knick Bezugshöhe [px]");
  erg.forEach(function (r) {
    var ok = r.fahren <= GRENZE.fahren && r.zoomen <= GRENZE.zoomen && r.hoehe <= GRENZE.hoehe && r.sprung < GRENZE.knick;
    if (!ok) schlecht++;
    console.log((ok ? "✓ " : "✗ ") + (r.welt + "              ").slice(0, 14) + r.fahren.toFixed(1).padStart(6) + r.zoomen.toFixed(1).padStart(8) + r.hoehe.toFixed(1).padStart(7) + "                      " + (r.sprung < 0 ? "–" : r.sprung.toFixed(3)));
  });
  if (fehler.length) { console.log("Fehler im Browser:", fehler.slice(0, 3)); schlecht++; }
  console.log(schlecht ? schlecht + " Welten mit unruhigem Hintergrund" : "Hintergrund überall starr und ruhig.");
  await browser.close(); server.close();
  process.exit(schlecht ? 1 : 0);
});
