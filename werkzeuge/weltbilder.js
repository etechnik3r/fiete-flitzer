#!/usr/bin/env node
/* ===========================================================================
   Fiete Flitzer – werkzeuge/weltbilder.js
   ---------------------------------------------------------------------------
   Macht für die Anleitung (❓ → 🗺️ Welten) von jeder Welt ein Bildschirmfoto:
   bilder/welten/<welt-id>.jpg (640 × 300, JPEG). Gefahren wird Level 2 an
   einer typischen Stelle (kurz vor Katapult, Hüpfpilz, Förderband, Säule,
   Pfütze, Geist …), ohne Pedale, Anzeigen und Tipps.

     node werkzeuge/weltbilder.js            alle Welten
     node werkzeuge/weltbilder.js mars glas  nur diese

   Braucht Playwright mit Chromium (wie werkzeuge/browsertest.js).
   =========================================================================== */
"use strict";
var path = require("path"), http = require("http"), fs = require("fs");
var chromium = require("playwright").chromium;
var BASIS = path.join(__dirname, ".."), AUS = path.join(BASIS, "bilder", "welten");
var nur = process.argv.slice(2);
fs.mkdirSync(AUS, { recursive: true });

var TYPEN = { ".html": "text/html", ".js": "application/javascript", ".css": "text/css", ".png": "image/png", ".woff2": "font/woff2", ".jpg": "image/jpeg" };
var server = http.createServer(function (req, res) {
  var d = decodeURIComponent(req.url.split("?")[0]); if (d === "/") d = "/index.html";
  var v = path.join(BASIS, path.normalize(d));
  if (v.indexOf(BASIS) !== 0 || !fs.existsSync(v) || fs.statSync(v).isDirectory()) { res.writeHead(404); res.end(); return; }
  res.writeHead(200, { "Content-Type": TYPEN[path.extname(v)] || "application/octet-stream" }); fs.createReadStream(v).pipe(res);
});

server.listen(0, "127.0.0.1", async function () {
  var browser = await chromium.launch();
  var ctx = await browser.newContext({ viewport: { width: 640, height: 300 }, deviceScaleFactor: 1 });
  var page = await ctx.newPage();
  var fehler = [];
  page.on("pageerror", function (e) { fehler.push(e.message); });
  await page.addInitScript(function () { window.FF_OHNE_COUNTDOWN = true; });
  await page.goto("http://127.0.0.1:" + server.address().port + "/");
  await page.addStyleTag({ content: "#hud,#pedale,#extras,#tipp,#meldung,#ampel,#hochkant-hinweis,.konfetti-ebene,.popover{display:none!important}" });
  await page.waitForTimeout(500);
  var welten = await page.evaluate(function () { return FF.CONFIG.welten.map(function (w) { return w.id; }); });
  for (var wi = 0; wi < welten.length; wi++) {
    if (nur.length && nur.indexOf(welten[wi]) < 0) continue;
    await page.evaluate(function (wi) {
      var S = FF.spiel.spielstand;
      S.einstellungen.instrumente = false; S.einstellungen.tipps = false;
      FF.spiel.setzeAktiv("fiete");
      FF.spiel.starteFahrt(wi, 1, false);
      var f = FF.spiel.fahrt, g = f.gelaende;
      // typische Stelle: kurz vor dem Besonderen der Welt (wichtigstes zuerst), sonst bei 130 m
      var kandidaten = [];
      function gel_schleim(g) { return g.welt.schleimbach && g.trampoline.length; }
      if (g.roehren.length) kandidaten.push(g.roehren[0].x - 8);
      if (gel_schleim(g)) kandidaten.push(g.trampoline[0].x0 - 9);
      if (g.welt.datenstrom && g.baender.length) kandidaten.push(g.baender[0].x0 - 3);
      if (g.zellen.length) kandidaten.push(g.zellen[1] ? g.zellen[1].x - 9 : g.zellen[0].x - 9);
      if (g.scheunen.length) kandidaten.push(g.scheunen[0].x0 - 21);
      if (g.obst.length) kandidaten.push((g.obst[1] || g.obst[0]).x - 17);
      if (g.katapulte.length) kandidaten.push(g.katapulte[0].x - 7);
      if (g.trampoline.length) kandidaten.push(g.trampoline[0].x0 - 6);
      if (g.baender.length) kandidaten.push(g.baender[0].x0 - 3);
      if (g.schwebezonen.length) kandidaten.push(g.schwebezonen[0].x0 + 4);
      if (g.objekte.length) { var o = g.objekte.filter(function (o) { return o.art === "saeule"; })[0] || g.objekte[1] || g.objekte[0]; kandidaten.push(o.x - 7); }
      if (g.spuk.length) kandidaten.push(g.spuk[1] ? g.spuk[1].x - 9 : g.spuk[0].x - 9);
      if (g.pfuetzen.length) kandidaten.push(g.pfuetzen[1] ? g.pfuetzen[1].x0 - 3 : g.pfuetzen[0].x0 - 3);
      if (g.loopings.length) kandidaten.push(g.loopings[0].xc - 9);
      var x = kandidaten.length ? Math.max(25, kandidaten[0]) : 130;      // das Wichtigste zuerst (Reihenfolge oben)
      FF.Physik.setzeAufBoden(f.fz, g, x, Math.atan(g.steigungBei(x)));
      f.weitesterX = x; f.strecke = x;
      f.fz.chassis.vx = 7; f.fz.raeder.forEach(function (R) { R.k.vx = 7; });
      FF.spiel.setzeEingabe(true, false);
    }, wi);
    await page.waitForTimeout(1500);
    await page.evaluate(function () { FF.spiel.setzeEingabe(false, false); });
    await page.screenshot({ path: path.join(AUS, welten[wi] + ".jpg"), type: "jpeg", quality: 72 });
    console.log("✓ " + welten[wi]);
  }
  if (fehler.length) console.log("Fehler:", fehler);
  await browser.close(); server.close();
});
