#!/usr/bin/env node
/* ===========================================================================
   Fiete Flitzer – werkzeuge/icons.js
   ---------------------------------------------------------------------------
   Erzeugt die App-Icons (PNG) direkt aus der Spielgrafik (grafik.js), damit
   Fiete auf dem Startbildschirm genauso aussieht wie im Spiel.

   Aufruf (braucht Playwright mit Chromium):
     node werkzeuge/icons.js
   Ergebnis: icon-512.png, icon-192.png, apple-touch-icon.png (180 px)
   =========================================================================== */
"use strict";
var path = require("path");
var fs = require("fs");
var { chromium } = require("playwright");

var basis = path.join(__dirname, "..");
var skripte = ["config.js", "gelaende.js", "physik.js", "fahrt.js", "kinder.js", "grafik.js"]
  .map(function (d) { return fs.readFileSync(path.join(basis, d), "utf8"); }).join("\n;\n");

function zeichneIcon(groesse) {
  /* läuft im Browser */
  var c = document.createElement("canvas");
  c.width = c.height = groesse;
  var g = c.getContext("2d"), s = groesse;
  // Himmel
  var hg = g.createLinearGradient(0, 0, 0, s);
  hg.addColorStop(0, "#3a6fd8"); hg.addColorStop(1, "#9fd0ff");
  g.fillStyle = hg; g.fillRect(0, 0, s, s);
  g.fillStyle = "#ffd23f"; g.beginPath(); g.arc(s * 0.86, s * 0.15, s * 0.07, 0, Math.PI * 2); g.fill();
  // Hügel
  g.fillStyle = "#7a4a22";
  g.beginPath(); g.moveTo(0, s * 0.86); g.quadraticCurveTo(s * 0.5, s * 0.8, s, s * 0.56); g.lineTo(s, s); g.lineTo(0, s); g.closePath(); g.fill();
  g.strokeStyle = "#46b04a"; g.lineWidth = s * 0.06; g.lineCap = "round";
  g.beginPath(); g.moveTo(0, s * 0.86); g.quadraticCurveTo(s * 0.5, s * 0.8, s, s * 0.56); g.stroke();
  // Flitzer mit Fiete (aus der Spielgrafik), leicht bergauf gedreht
  var auto = document.createElement("canvas");
  auto.width = auto.height = s;
  var ag = auto.getContext("2d");
  var def = FF.fahrzeugDef("flitzer");
  FF.Grafik.zeichneVorschau(ag, s, s * 0.78, def,
    { farbe: "#ff9e2c", muster: "keins", outfit: FF.CONFIG.outfits[0] }, 0.6, true);
  g.save();
  g.translate(s * 0.5, s * 0.66); g.rotate(-0.29); g.translate(-s * 0.5, -s * 0.47);
  g.drawImage(auto, s * 0.08, s * 0.02, s * 0.84, s * 0.84);
  g.restore();
  // Münzen
  [[0.58, 0.17], [0.7, 0.12]].forEach(function (m) {
    g.fillStyle = "#f3c44a"; g.strokeStyle = "#b9851c"; g.lineWidth = s * 0.012;
    g.beginPath(); g.arc(s * m[0], s * m[1], s * 0.04, 0, Math.PI * 2); g.fill(); g.stroke();
  });
  return c.toDataURL("image/png");
}

(async function () {
  var browser = await chromium.launch();
  var page = await browser.newPage();
  await page.setContent("<!doctype html><html><body></body></html>");
  await page.addScriptTag({ content: skripte });
  for (var paar of [[512, "icon-512.png"], [192, "icon-192.png"], [180, "apple-touch-icon.png"]]) {
    var url = await page.evaluate(zeichneIcon, paar[0]);
    fs.writeFileSync(path.join(basis, paar[1]), Buffer.from(url.split(",")[1], "base64"));
    console.log("geschrieben:", paar[1]);
  }
  await browser.close();
})();
