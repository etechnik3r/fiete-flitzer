#!/usr/bin/env node
/* ===========================================================================
   Fiete Flitzer – werkzeuge/browsertest.js
   ---------------------------------------------------------------------------
   Prüft das Spiel in einem echten Browser (Chromium über Playwright). Ein
   kleiner eingebauter Webserver liefert die Spieldateien aus – Python oder
   ein anderer Server sind nicht nötig.

   Aufruf:
     node werkzeuge/browsertest.js                  alle Prüfungen außer Leistung
     node werkzeuge/browsertest.js ablauf layout    nur bestimmte Prüfungen
     node werkzeuge/browsertest.js leistung         Bildrate messen (dauert ≈ 1 min)
     node werkzeuge/browsertest.js --bilder ordner  Bildschirmfotos dort ablegen

   Prüfungen:
     ablauf    Spielerwahl, Solo, getrennte Garagen, Lobby, Würfeln,
               Geisterrennen mit Roboter-Fahrer, Siegerehrung, Revanche
     layout    alle Bildschirme in 6 Formaten (Handy quer/hoch, Tablet, PC):
               Knöpfe ≥ 44 px, erreichbar, ohne Überlappung, mit Namen;
               Dialoge passen ohne Scrollen
     robust    kaputter/alter/unsinniger Spielstand (v1, v2 mit alter Welten-
               Reihenfolge), gesperrter Speicher, Drehen, App im Hintergrund,
               Duell-Sonderfälle
     offline   PWA: Cache-Liste, Service Worker, Spielen ohne Internet
     inhalte   Entwickler-Bereich (Elternsperre), alle Welten und Level startbar,
               Ergebnis nach Level 3 (neue Welt / Profi-Level), Hinweise in der
               Luft und bei Bruchlandung, E-Auto (Akku, Rekuperation beim Bremsen
               und Rollen), Motorklänge aller Fahrzeuge (offline gerendert)
     leistung  Bildrate normal und bei 4× gedrosselter CPU (nur Info)

   Voraussetzung: Playwright mit Chromium (npm i -D playwright &&
   npx playwright install chromium).
   =========================================================================== */
"use strict";

var http = require("http");
var fs = require("fs");
var path = require("path");
var chromium;
try { chromium = require("playwright").chromium; } catch (e) {
  console.error("Playwright fehlt: npm i -D playwright && npx playwright install chromium");
  process.exit(2);
}

var BASIS = path.join(__dirname, "..");
var argv = process.argv.slice(2);
var bilderIndex = argv.indexOf("--bilder");
var BILDER = bilderIndex >= 0 ? path.resolve(argv[bilderIndex + 1]) : null;
if (bilderIndex >= 0) argv.splice(bilderIndex, 2);
var STANDARD = ["ablauf", "layout", "robust", "offline", "inhalte"];
var auswahl = argv.length ? argv : STANDARD;
if (BILDER) fs.mkdirSync(BILDER, { recursive: true });

/* ---------- kleiner statischer Webserver ---------- */
var TYPEN = { ".html": "text/html", ".js": "application/javascript", ".css": "text/css", ".png": "image/png",
              ".webmanifest": "application/manifest+json", ".woff2": "font/woff2", ".json": "application/json" };
function starteServer() {
  var server = http.createServer(function (req, res) {
    var datei = decodeURIComponent(req.url.split("?")[0]);
    if (datei === "/") datei = "/index.html";
    var voll = path.join(BASIS, path.normalize(datei));
    if (voll.indexOf(BASIS) !== 0 || !fs.existsSync(voll) || fs.statSync(voll).isDirectory()) { res.writeHead(404); res.end(); return; }
    res.writeHead(200, { "Content-Type": TYPEN[path.extname(voll)] || "application/octet-stream" });
    fs.createReadStream(voll).pipe(res);
  });
  return new Promise(function (ok) { server.listen(0, "127.0.0.1", function () { ok(server); }); });
}

/* ---------- Werkzeuge ---------- */
var bestanden = 0, fehlgeschlagen = 0;
function pruef(bed, text, extra) {
  if (bed) { bestanden++; console.log("  ✓ " + text); }
  else { fehlgeschlagen++; console.log("  ✗ " + text + (extra !== undefined ? " → " + JSON.stringify(extra) : "")); }
}
var URL = "";
async function neueSeite(browser, opt) {
  opt = opt || {};
  var ctx = await browser.newContext(Object.assign({ viewport: { width: 844, height: 390 }, hasTouch: true }, opt.kontext || {}));
  if (opt.init) await ctx.addInitScript(opt.init);
  var page = await ctx.newPage();
  page.fehler = [];
  page.on("pageerror", function (e) { page.fehler.push(e.message); });
  page.on("console", function (m) { if (m.type() === "error") page.fehler.push(m.text()); });
  await page.goto(URL + "index.html");
  await page.evaluate(function (s) { localStorage.clear(); if (s) localStorage.setItem("fiete-flitzer-spielstand-v1", s); }, opt.spielstand || null)
    .catch(function () { /* Speicher gesperrt */ });
  await page.reload();
  await page.waitForTimeout(500);
  return page;
}
async function warte(page, fn, ms, arg) {
  for (var i = 0; i < ms / 100; i++) { if (await page.evaluate(fn, arg)) return true; await page.waitForTimeout(100); }
  return false;
}
function offen(id) { return document.getElementById(id).classList.contains("offen"); }
function sichtbar(sel) {
  var el = document.querySelector(sel);
  return !!el && !el.hidden && getComputedStyle(el).display !== "none" && (!el.classList.contains("modal-overlay") || el.classList.contains("offen"));
}
function zumZiel(page) {
  return page.evaluate(function () {
    var f = FF.spiel.fahrt, x = f.gelaende.ziel - 3;
    FF.Physik.setzePose(f.fz, x, f.gelaende.hoeheBei(x) + 1.2, 0); f.fz.chassis.vx = 8;
  });
}
async function foto(page, name) { if (BILDER) await page.screenshot({ path: path.join(BILDER, name + ".png") }); }
async function weiterZu(page, kind) {
  await page.click("#knopf-start"); await page.waitForTimeout(700);
  if (kind) { await page.click('.wahl-karte[data-kind="' + kind + '"]'); await page.waitForTimeout(300); }
}

/* Roboter-Fahrer wie in testfahrt.js: Gas, an steilen Stellen vorsichtig, in der Luft gerade halten */
var BOT = "clearInterval(window.__bot); window.__bot = setInterval(function () {" +
  " var f = FF.spiel.fahrt; if (!f) return;" +
  " if (window.__warte && f.zeit < window.__warte) { FF.spiel.setzeEingabe(false, false); return; }" +
  " var C = f.fz.chassis, st = f.fz.status, a = FF.normWinkel(C.a);" +
  " var rel = FF.normWinkel(a - Math.atan(f.gelaende.steigungBei(C.x))), luft = st.radKontakte === 0 && !st.huellKontakt;" +
  " var g = true, b = false;" +
  " if (luft) { if (a > 0.25) { g = false; b = true; } else if (a < -0.25) g = true; else g = false; }" +
  " else if (rel > 0.75) { g = false; b = rel > 1.0; }" +
  " FF.spiel.setzeEingabe(g, b); }, 30);";

/* =========================================================================
   ABLAUF
   ========================================================================= */
async function ablauf(browser) {
  var page = await neueSeite(browser, { kontext: { deviceScaleFactor: 1.5 } });
  await foto(page, "ablauf-01-titel");
  await weiterZu(page);
  pruef(await page.evaluate(sichtbar, "#spielerwahl"), "Spielerwahl nach dem Titel");
  await page.click('.wahl-karte[data-kind="fiete"]'); await page.waitForTimeout(400);
  pruef(await page.evaluate(function () { return FF.spiel.spielstand.aktiv === "fiete" && FF.spiel.modus === "menue"; }), "Solo: Fiete aktiv im Menü");
  pruef((await page.textContent(".fahrzeug-leiste-titel")).indexOf("Fiete") >= 0, "Fahrzeugleiste zeigt „Fiete fährt“");
  await page.click(".fiete-chip.wechsel"); await page.waitForTimeout(300);
  await page.click('.wahl-karte[data-kind="jonte"]'); await page.waitForTimeout(400);
  pruef(await page.evaluate(function () { return FF.spiel.spielstand.aktiv === "jonte"; }), "Wechsel zu Jonte");
  await page.click("#tab-knopf-garage"); await page.waitForTimeout(400);
  pruef((await page.textContent("#outfit-titel")).indexOf("Jonte") >= 0, "Garage zeigt Jontes Outfit");
  await page.evaluate(function () { FF.spiel.profil.muenzen = 3000; });
  await page.click('.outfit-knopf[data-outfit="netz"]'); await page.waitForTimeout(200);
  await page.click('.upgrade-kaufen[data-upgrade="motor"]'); await page.waitForTimeout(200);
  var k = await page.evaluate(function () {
    var S = FF.spiel.spielstand.spieler;
    return { f: S.fiete.muenzen, j: S.jonte.muenzen, jo: S.jonte.outfit, fo: S.fiete.outfit, jm: S.jonte.fahrzeuge.flitzer.upgrades.motor };
  });
  pruef(k.f === 0 && k.j === 3000 - 500 - 120 && k.jo === "netz" && k.fo === "himmel" && k.jm === 1, "Getrennte Konten und Garagen", k);
  await foto(page, "ablauf-02-garage-jonte");

  await page.click('.tab[data-tab="fahren"]'); await page.waitForTimeout(200);
  await page.click(".fiete-chip.wechsel"); await page.waitForTimeout(300);
  await page.click(".wahl-karte[data-zuzweit]"); await page.waitForTimeout(400);
  pruef(await page.evaluate(sichtbar, "#duell-lobby") && !(await page.evaluate(sichtbar, "#welten-liste")), "Zu zweit: Lobby statt Solo-Weltenliste");
  await foto(page, "ablauf-03-lobby");
  await page.click('[data-garage-kind="fiete"]'); await page.waitForTimeout(300);
  pruef(await page.evaluate(sichtbar, "#garage-kinder") && await page.evaluate(function () { return FF.spiel.spielstand.aktiv === "fiete"; }), "Lobby → Fietes Garage mit Umschalter");
  await page.click('.garage-kind[data-kind="jonte"]'); await page.waitForTimeout(200);
  pruef(await page.evaluate(function () { return FF.spiel.spielstand.aktiv === "jonte"; }), "Umschalten auf Jontes Garage");
  await page.click(".garage-kind[data-zurueck]"); await page.waitForTimeout(300);

  await page.click(".start-knopf[data-wuerfeln]"); await page.waitForTimeout(500);
  pruef(await page.evaluate(sichtbar, "#wuerfeln"), "Würfel-Fenster offen");
  await foto(page, "ablauf-04-wuerfeln");
  pruef(await warte(page, offen, 12000, "uebergabe"), "Nach dem Würfeln: Übergabe");
  var erster = await page.evaluate(function () { return FF.spiel.duell.reihenfolge[0]; });
  await page.click("#knopf-uebergabe-los"); await page.waitForTimeout(300);
  pruef(await page.evaluate(function (e) { return FF.spiel.spielstand.aktiv === e && !!FF.spiel.fahrt; }, erster), "Fahrt 1 mit " + erster);
  await page.evaluate(BOT);
  pruef(await warte(page, offen, 70000, "uebergabe"), "Nach Fahrt 1: Übergabe an das zweite Kind");
  await foto(page, "ablauf-05-uebergabe");
  await page.click("#knopf-uebergabe-los"); await page.waitForTimeout(200);
  await page.evaluate(function () { window.__warte = 3; });
  await page.evaluate(BOT);
  await page.waitForTimeout(1500);
  pruef(await page.evaluate(function () { return !!FF.spiel.geist && FF.spiel.geist.obj.fz.chassis.x > FF.spiel.fahrt.fz.chassis.x; }), "Geist fährt vorne weg");
  await foto(page, "ablauf-06-geist");
  await page.evaluate(function () { window.__warte = 0; });
  pruef(await warte(page, offen, 90000, "duell-ergebnis"), "Siegerehrung erscheint");
  await page.waitForTimeout(1200);
  await foto(page, "ablauf-07-siegerehrung");
  var stand = await page.evaluate(function () { return FF.spiel.spielstand.duell.siege; });
  pruef(stand.fiete + stand.jonte === 1, "Siegzähler +1", stand);
  await page.click("#knopf-revanche"); await page.waitForTimeout(400);
  pruef(await page.evaluate(function (e) { return FF.spiel.duell.reihenfolge[0] !== e; }, erster), "Revanche: das andere Kind fängt an");
  await page.click("#knopf-uebergabe-abbruch"); await page.waitForTimeout(300);
  pruef(await page.evaluate(sichtbar, "#duell-lobby"), "Abbrechen führt zur Lobby");
  pruef(!page.fehler.length, "keine Fehler in der Konsole", page.fehler);
  await page.context().close();
}

/* =========================================================================
   LAYOUT
   ========================================================================= */
var FORMATE = [["quer", 844, 390], ["kleinquer", 667, 375], ["hoch", 390, 844], ["tablet", 1024, 768], ["tablethoch", 768, 1024], ["desktop", 1440, 900]];

/* Läuft im Browser: sucht Layout-Probleme auf der obersten Ebene (offenes Fenster oder Bildschirm) */
function layoutProbleme() {
  var probleme = [];
  function istSichtbar(el) {
    if (!el.offsetParent && getComputedStyle(el).position !== "fixed") return false;
    var r = el.getBoundingClientRect(); if (r.width < 1 || r.height < 1) return false;
    for (var p = el; p; p = p.parentElement) {
      var cs = getComputedStyle(p);
      if (cs.display === "none" || cs.visibility === "hidden" || p.hidden) return false;
      if (p.classList && p.classList.contains("modal-overlay") && !p.classList.contains("offen")) return false;
    }
    return true;
  }
  var modale = document.querySelectorAll(".modal-overlay.offen"), modal = modale[modale.length - 1];
  var wurzel = modal || document.body;
  // sichtbares Rechteck: an scrollenden/abschneidenden Vorfahren beschnitten
  function sichtRect(el) {
    var r = el.getBoundingClientRect(); r = { left: r.left, top: r.top, right: r.right, bottom: r.bottom };
    for (var p = el.parentElement; p; p = p.parentElement) {
      var cs = getComputedStyle(p);
      if (/(auto|scroll|hidden)/.test(cs.overflowX + cs.overflowY)) {
        var q = p.getBoundingClientRect();
        r = { left: Math.max(r.left, q.left), top: Math.max(r.top, q.top), right: Math.min(r.right, q.right), bottom: Math.min(r.bottom, q.bottom) };
      }
    }
    return r;
  }
  function name(el) { return ((el.getAttribute("aria-label") || el.textContent || "").trim().replace(/\s+/g, " ").slice(0, 30)) || el.id || el.className; }
  var knoepfe = Array.prototype.filter.call(wurzel.querySelectorAll("button, [role=button]"), istSichtbar);
  knoepfe.forEach(function (el) {
    var r = el.getBoundingClientRect();
    if (r.width < 43.5 || r.height < 43.5) probleme.push("zu klein " + Math.round(r.width) + "×" + Math.round(r.height) + ": " + name(el));
    if (!(el.getAttribute("aria-label") || el.textContent.trim() || el.querySelector('img[alt]:not([alt=""])'))) probleme.push("ohne Namen: " + el.className);
    if (r.right > innerWidth + 1 || r.bottom > innerHeight + 1 || r.left < -1 || r.top < -1) {
      var scrollbar = false;
      for (var p = el.parentElement; p; p = p.parentElement) {
        var cs = getComputedStyle(p);
        if ((/(auto|scroll)/.test(cs.overflowY) && p.scrollHeight > p.clientHeight) || (/(auto|scroll)/.test(cs.overflowX) && p.scrollWidth > p.clientWidth)) { scrollbar = true; break; }
      }
      if (!scrollbar) probleme.push("außerhalb, nicht scrollbar: " + name(el));
    }
    if (el.scrollWidth > el.clientWidth + 2 && getComputedStyle(el).overflow !== "visible") probleme.push("Text abgeschnitten: " + name(el));
  });
  for (var i = 0; i < knoepfe.length; i++) for (var j = i + 1; j < knoepfe.length; j++) {
    var a = knoepfe[i], b = knoepfe[j];
    if (a.contains(b) || b.contains(a)) continue;
    var r1 = sichtRect(a), r2 = sichtRect(b);
    var ux = Math.min(r1.right, r2.right) - Math.max(r1.left, r2.left), uy = Math.min(r1.bottom, r2.bottom) - Math.max(r1.top, r2.top);
    if (ux > 3 && uy > 3) probleme.push("überlappt: " + name(a) + " ↔ " + name(b));
  }
  if (modal && modal.id !== "einstellungen") {                 // Einstellungen dürfen scrollen
    var karte = modal.querySelector(".karte, .modal");
    if (karte && karte.scrollHeight > karte.clientHeight + 2) probleme.push("Dialog muss scrollen: " + modal.id + " (" + karte.scrollHeight + " > " + karte.clientHeight + ")");
  }
  return probleme;
}

async function layout(browser) {
  var voll = JSON.stringify((function () {
    var p = { muenzen: 123456, fahrzeuge: {}, level: {} };
    ["traktor", "moped", "bus"].forEach(function (f) { p.fahrzeuge[f] = { gekauft: true, upgrades: {} }; });
    ["wiese", "wueste", "schnee", "mond"].forEach(function (w) { for (var l = 1; l <= 3; l++) p.level[w + "-" + l] = { geschafft: true, sterne: l }; });
    return { version: 2, aktiv: "fiete", spieler: { fiete: p, jonte: JSON.parse(JSON.stringify(p)) } };
  })());
  for (var n = 0; n < FORMATE.length; n++) {
    var tag = FORMATE[n][0];
    var page = await neueSeite(browser, { kontext: { viewport: { width: FORMATE[n][1], height: FORMATE[n][2] } }, spielstand: voll });
    var probleme = [];
    var pruefe = async function (zustand) {
      await page.waitForTimeout(450);
      (await page.evaluate(layoutProbleme)).forEach(function (p) { probleme.push("[" + zustand + "] " + p); });
      await foto(page, "layout-" + tag + "-" + zustand);
    };
    await pruefe("titel");
    await weiterZu(page); await pruefe("spielerwahl");
    await page.click('.wahl-karte[data-kind="fiete"]'); await pruefe("solo-fahren");
    await page.click("#tab-knopf-garage"); await pruefe("solo-garage");
    await page.click("#knopf-einstellungen"); await pruefe("einstellungen");
    await page.click("#knopf-zuruecksetzen"); await pruefe("eltern");
    await page.click("#eltern-abbrechen"); await page.click("#einstellungen-fertig");
    await page.evaluate(function () { FF.spiel.starteFahrt(0, 0, false); }); await pruefe("fahrt");
    await page.click("#knopf-pause"); await pruefe("pause");
    await page.click("#knopf-weiter");
    await zumZiel(page); await warte(page, offen, 8000, "ergebnis"); await pruefe("ergebnis");
    await page.click("#knopf-ergebnis-menue");
    await page.evaluate(function () { FF.spiel.zeigeSpielerwahl(); });
    await page.click(".wahl-karte[data-zuzweit]"); await pruefe("lobby");
    await page.click('[data-garage-kind="jonte"]'); await pruefe("duell-garage");
    await page.click(".garage-kind[data-zurueck]");
    await page.click(".start-knopf[data-wuerfeln]"); await pruefe("wuerfeln");
    await warte(page, offen, 12000, "uebergabe"); await pruefe("uebergabe1");
    await page.click("#knopf-uebergabe-los"); await page.waitForTimeout(300);
    await zumZiel(page); await warte(page, offen, 9000, "uebergabe"); await pruefe("uebergabe2");
    await page.click("#knopf-uebergabe-los"); await page.waitForTimeout(1500); await pruefe("fahrt-geist");
    await zumZiel(page); await warte(page, offen, 9000, "duell-ergebnis"); await pruefe("siegerehrung");
    page.fehler.forEach(function (f) { probleme.push("[konsole] " + f); });
    pruef(!probleme.length, tag + " (" + FORMATE[n][1] + "×" + FORMATE[n][2] + "): 17 Bildschirme ohne Layout-Probleme", probleme);
    await page.context().close();
  }
}

/* =========================================================================
   ROBUST
   ========================================================================= */
async function robust(browser) {
  var p = await neueSeite(browser, { spielstand: "{kaputt!!" });
  var r = await p.evaluate(function () { return { m: FF.spiel.spielstand.spieler.fiete.muenzen, a: FF.spiel.spielstand.aktiv }; });
  pruef(r.m === 0 && r.a === "fiete" && !p.fehler.length, "Kaputter Spielstand → frischer Start ohne Fehler", { r: r, f: p.fehler });
  await p.context().close();

  p = await neueSeite(browser, { spielstand: JSON.stringify({ version: 1, muenzen: 4321, fahrzeug: "traktor",
    fahrzeuge: { flitzer: { gekauft: true, upgrades: { motor: 2 } }, traktor: { gekauft: true, upgrades: {} } },
    level: { "wiese-1": { geschafft: true, sterne: 3 } }, einstellungen: { ton: false } }) });
  r = await p.evaluate(function () {
    var S = FF.spiel.spielstand, f = S.spieler.fiete;
    return { f: f.muenzen, fz: f.fahrzeug, mot: f.fahrzeuge.flitzer.upgrades.motor, j: S.spieler.jonte.muenzen, lv: f.level["wiese-1"], ton: S.einstellungen.ton };
  });
  pruef(r.f === 4321 && r.fz === "traktor" && r.mot === 2 && r.j === 0 && r.lv && r.lv.sterne === 3 && r.ton === false,
    "Alter Spielstand (v1) → Fiete übernimmt alles, Jonte startet frisch", r);
  await p.context().close();

  p = await neueSeite(browser, { spielstand: JSON.stringify({ version: 2, aktiv: "hacker",
    spieler: { fiete: { muenzen: -50, fahrzeug: "ufo", outfit: "batman", farben: "rot" }, jonte: { muenzen: "viel", fahrzeug: "mond" } },
    duell: { siege: { fiete: "x", jonte: 3 } } }) });
  r = await p.evaluate(function () {
    var S = FF.spiel.spielstand, f = S.spieler.fiete, j = S.spieler.jonte;
    return { a: S.aktiv, fm: f.muenzen, ff: f.fahrzeug, fo: f.outfit, jm: j.muenzen, jf: j.fahrzeug, farben: Array.isArray(f.farben), s: S.duell.siege };
  });
  pruef(r.a === "fiete" && r.fm === 0 && r.ff === "flitzer" && r.fo === "himmel" && r.jm === 0 && r.jf === "flitzer" && r.farben && r.s.fiete === 0 && r.s.jonte === 3,
    "Unsinnige Werte werden bereinigt", r);
  await weiterZu(p, "jonte");
  await p.evaluate(function () { FF.spiel.starteFahrt(0, 0, false); }); await p.waitForTimeout(600);
  pruef(!p.fehler.length && await p.evaluate(function () { return FF.spiel.modus === "fahrt"; }), "… und das Spiel ist damit spielbar", p.fehler);
  await p.context().close();

  // Spielstand aus der Zeit vor Baustelle und Achterbahn-Park (v2): was offen war, bleibt offen
  p = await neueSeite(browser, { spielstand: JSON.stringify({ version: 2, aktiv: "fiete",
    spieler: { fiete: { level: { "wiese-3": { geschafft: true, sterne: 2 }, "wueste-3": { geschafft: true, sterne: 1 }, "vulkan-3": { geschafft: true, sterne: 1 } } } },
    duell: { welt: 2, stufe: 1 } }) });
  await weiterZu(p, "fiete");
  r = await p.evaluate(function () {
    var S = FF.spiel.spielstand, W = FF.CONFIG.welten.map(function (w) { return w.id; });
    var karten = document.querySelectorAll("#welten-liste .welt-karte");
    function frei(id) { return !karten[W.indexOf(id)].classList.contains("gesperrt"); }
    return { schnee: frei("schnee"), regenbogen: frei("regenbogen"), baustelle: frei("baustelle"), mond: frei("mond"),
             duellWelt: W[S.duell.welt], version: S.version };
  });
  pruef(r.schnee && r.regenbogen && r.baustelle && !r.mond && r.duellWelt === "schnee",
    "Alter Spielstand (v2): offene Welten bleiben offen, die Duell-Welt bleibt die Schneeberge", r);
  await p.evaluate(function () { FF.spiel.starteFahrt(0, 0, false); }); await p.waitForTimeout(400);
  r = await p.evaluate(function () { return JSON.parse(localStorage.getItem("fiete-flitzer-spielstand-v1")); });
  pruef(r.version === 3 && r.duell.weltId === "schnee" && r.spieler.fiete.freigeschaltet.indexOf("schnee") >= 0,
    "… und wird als Version 3 gespeichert (Duell-Welt per Name)", { v: r.version, w: r.duell.weltId });
  await p.context().close();

  p = await neueSeite(browser, { init: function () {
    Storage.prototype.getItem = function () { throw new Error("gesperrt"); };
    Storage.prototype.setItem = function () { throw new Error("gesperrt"); };
  } });
  await weiterZu(p, "fiete");
  await p.evaluate(function () { FF.spiel.starteFahrt(0, 0, false); }); await p.waitForTimeout(400);
  await zumZiel(p);
  var erg = await warte(p, offen, 8000, "ergebnis");
  pruef(erg && !p.fehler.filter(function (x) { return !/gesperrt/.test(x); }).length, "Gesperrter Speicher (Privatmodus): Spiel läuft bis zum Ergebnis", p.fehler);
  await p.context().close();

  p = await neueSeite(browser);
  await weiterZu(p, "fiete");
  await p.evaluate(function () { FF.spiel.starteFahrt(1, 0, false); FF.spiel.setzeEingabe(true, false); }); await p.waitForTimeout(500);
  await p.setViewportSize({ width: 390, height: 844 }); await p.waitForTimeout(500);
  var c = await p.evaluate(function () { var c = document.getElementById("spielfeld"); return { w: c.width, h: c.height, cw: c.clientWidth, ch: c.clientHeight }; });
  pruef(c.cw === 390 && c.ch === 844 && c.w >= 390 && c.h >= 844, "Drehen auf hochkant während der Fahrt: Bild passt sich an", c);
  await p.setViewportSize({ width: 844, height: 390 }); await p.waitForTimeout(500);
  c = await p.evaluate(function () { var c = document.getElementById("spielfeld"); return { cw: c.clientWidth, ch: c.clientHeight }; });
  pruef(c.cw === 844 && c.ch === 390 && !p.fehler.length, "Zurückdrehen: Bild passt, keine Fehler", { c: c, f: p.fehler });
  await p.evaluate(function () {
    Object.defineProperty(document, "hidden", { configurable: true, get: function () { return true; } });
    document.dispatchEvent(new Event("visibilitychange"));
  });
  await p.waitForTimeout(200);
  var z0 = await p.evaluate(function () { return FF.spiel.fahrt.zeit; }); await p.waitForTimeout(500);
  var z1 = await p.evaluate(function () { return FF.spiel.fahrt.zeit; });
  pruef(await p.evaluate(offen, "pause") && z0 === z1, "App im Hintergrund → automatische Pause, Zeit steht", { z0: z0, z1: z1 });
  await p.evaluate(function () { Object.defineProperty(document, "hidden", { configurable: true, get: function () { return false; } }); });
  await p.click("#knopf-weiter"); await p.waitForTimeout(400);
  pruef(await p.evaluate(function () { return FF.spiel.fahrt.zeit; }) > z1, "Weiter → Fahrt läuft wieder");
  await p.evaluate(function () { FF.spiel.setzeEingabe(false, false); });
  await p.context().close();

  // Duell-Sonderfälle
  p = await neueSeite(browser);
  async function duellStart(erster) {
    await p.evaluate(function () { FF.spiel.zeigeSpielerwahl(); }); await p.waitForTimeout(200);
    await p.click(".wahl-karte[data-zuzweit]"); await p.waitForTimeout(300);
    await p.click('.start-knopf[data-erster="' + erster + '"]'); await p.waitForTimeout(300);
    await p.click("#knopf-uebergabe-los"); await p.waitForTimeout(400);
  }
  await weiterZu(p);
  await duellStart("jonte");
  pruef(await p.evaluate(function () { return FF.spiel.spielstand.aktiv === "jonte"; }), "Duell: gewähltes Kind (Jonte) fährt zuerst");
  await p.evaluate(function () { FF.spiel.setzeEingabe(true, false); }); await p.waitForTimeout(1500);
  await p.click("#knopf-pause"); await p.waitForTimeout(200);
  pruef(/abbrechen/i.test(await p.textContent("#knopf-menue")), "Duell-Pause bietet „Rennen abbrechen“");
  await p.click("#knopf-nochmal"); await p.waitForTimeout(300);
  r = await p.evaluate(function () { return { runde: FF.spiel.duell.runde, zeit: FF.spiel.fahrt.zeit, aktiv: FF.spiel.spielstand.aktiv }; });
  pruef(r.runde === 0 && r.zeit < 0.6 && r.aktiv === "jonte", "Runde 1: „Nochmal“ startet die Aufnahme neu", r);
  await zumZiel(p); await warte(p, offen, 9000, "uebergabe");
  await p.click("#knopf-uebergabe-los"); await p.waitForTimeout(400);
  r = await p.evaluate(function () { return { runde: FF.spiel.duell.runde, aktiv: FF.spiel.spielstand.aktiv, geist: !!FF.spiel.geist }; });
  pruef(r.runde === 1 && r.aktiv === "fiete" && r.geist, "Runde 2: Fiete fährt gegen Jontes Geist", r);
  await p.click("#knopf-pause"); await p.waitForTimeout(200);
  await p.click("#knopf-menue"); await p.waitForTimeout(400);
  r = await p.evaluate(function () { return { duell: FF.spiel.duell, modus: FF.spiel.modus, lobby: !document.getElementById("duell-lobby").hidden }; });
  pruef(r.duell === null && r.lobby && r.modus === "menue", "Abbruch in Runde 2 → zurück in die Lobby", r);

  var vor = await p.evaluate(function () { var S = FF.spiel.spielstand; return { siege: JSON.stringify(S.duell.siege), f: S.spieler.fiete.muenzen, j: S.spieler.jonte.muenzen }; });
  await duellStart("fiete");
  await zumZiel(p); await warte(p, offen, 9000, "uebergabe");
  await p.click("#knopf-uebergabe-los"); await p.waitForTimeout(400);
  await p.evaluate(function () { FF.Geist.__vergleiche = FF.Geist.vergleiche; FF.Geist.vergleiche = function () { return -1; }; });
  await zumZiel(p); await warte(p, offen, 9000, "duell-ergebnis");
  r = await p.evaluate(function () {
    var S = FF.spiel.spielstand, e = FF.spiel.duell.ergebnisse;
    return { titel: document.getElementById("duell-ergebnis-titel").textContent, siege: JSON.stringify(S.duell.siege),
             f: S.spieler.fiete.muenzen, j: S.spieler.jonte.muenzen, e0: e[0].gesamt, e1: e[1].gesamt, halb: Math.round(FF.CONFIG.regeln.siegBonus / 2),
             krone: document.querySelectorAll(".podest-krone").length };
  });
  pruef(/Unentschieden/.test(r.titel) && r.siege === vor.siege && r.f - vor.f === r.e0 + r.halb && r.j - vor.j === r.e1 + r.halb && r.krone === 0,
    "Unentschieden: kein Sieg gezählt, Bonus halbiert für beide, keine Krone", r);
  await p.evaluate(function () { FF.Geist.vergleiche = FF.Geist.__vergleiche; });

  await p.click("#knopf-duell-strecke"); await p.waitForTimeout(300);
  await p.click("#duell-level [data-endlos]"); await p.waitForTimeout(200);
  pruef(await p.evaluate(function () { return FF.spiel.spielstand.duell.endlos === true; }), "Lobby: „Wer kommt weiter?“ (Endlos) wählbar");
  await p.click('.start-knopf[data-erster="fiete"]'); await p.waitForTimeout(300);
  await p.click("#knopf-uebergabe-los"); await p.waitForTimeout(400);
  await p.evaluate(function () { var f = FF.spiel.fahrt; FF.Physik.setzePose(f.fz, 120, f.gelaende.hoeheBei(120) + 1, 0); f.tank = 0; });
  await warte(p, offen, 15000, "uebergabe");
  await p.click("#knopf-uebergabe-los"); await p.waitForTimeout(400);
  pruef(await p.evaluate(function () { return !document.getElementById("hud-geist-strecke").hidden && !!FF.spiel.geist; }), "Endlos-Duell: Abstand zum Geist wird angezeigt");
  await p.evaluate(function () { var f = FF.spiel.fahrt; FF.Physik.setzePose(f.fz, 200, f.gelaende.hoeheBei(200) + 1, 0); f.tank = 0; });
  await warte(p, offen, 15000, "duell-ergebnis");
  r = await p.evaluate(function () { return { titel: document.getElementById("duell-ergebnis-titel").textContent, e: FF.spiel.duell.ergebnisse.map(function (x) { return Math.round(x.strecke); }) }; });
  pruef(/Jonte gewinnt/.test(r.titel) && r.e[1] > r.e[0], "Endlos-Duell: weitere Strecke gewinnt", r);
  pruef(!p.fehler.length, "Duell-Sonderfälle ohne Konsolenfehler", p.fehler);
  await p.context().close();
}

/* =========================================================================
   OFFLINE (PWA)
   ========================================================================= */
async function offline(browser) {
  var sw = fs.readFileSync(path.join(BASIS, "sw.js"), "utf8");
  var dateien = JSON.parse("[" + sw.match(/var DATEIEN = \[([\s\S]*?)\];/)[1] + "]");
  var version = sw.match(/VERSION = "v(\d+)"/)[1];
  var html = fs.readFileSync(path.join(BASIS, "index.html"), "utf8");
  var refs = []; html.replace(/(?:src|href)="([^"#:]+\?v=(\d+))"/g, function (m, d, v) { refs.push([d, v]); });
  pruef(refs.length >= 9 && refs.every(function (x) { return x[1] === version; }), "index.html: alle ?v= passen zur Version v" + version + " in sw.js");
  pruef(refs.every(function (x) { return dateien.indexOf(x[0]) >= 0; }), "jede geladene Datei steht in der Cache-Liste",
    refs.filter(function (x) { return dateien.indexOf(x[0]) < 0; }));
  var man = JSON.parse(fs.readFileSync(path.join(BASIS, "manifest.webmanifest"), "utf8"));
  pruef(man.name && man.start_url && man.display && man.icons.some(function (i) { return /maskable/.test(i.purpose || ""); }) &&
    man.icons.every(function (i) { return fs.existsSync(path.join(BASIS, i.src)); }), "Manifest vollständig, Icons vorhanden");

  var ctx = await browser.newContext({ viewport: { width: 844, height: 390 } });
  var page = await ctx.newPage(), fehler = [];
  page.on("pageerror", function (e) { fehler.push(e.message); });
  var kaputt = [];
  for (var i = 0; i < dateien.length; i++) { var a = await page.request.get(URL + dateien[i]); if (a.status() !== 200) kaputt.push(dateien[i]); }
  pruef(!kaputt.length, "alle " + dateien.length + " Dateien der Cache-Liste sind erreichbar", kaputt);
  await page.goto(URL + "index.html");
  pruef(await page.evaluate(async function () { var r = await navigator.serviceWorker.ready; return !!r.active; }), "Service Worker aktiv");
  await page.waitForTimeout(800);
  var cache = await page.evaluate(async function () { var n = await caches.keys(); var c = await caches.open(n[0]); return { namen: n, anzahl: (await c.keys()).length }; });
  pruef(cache.namen.length === 1 && cache.namen[0] === "fiete-flitzer-v" + version && cache.anzahl === dateien.length, "Cache vollständig befüllt", cache);
  await ctx.setOffline(true);
  await page.reload(); await page.waitForTimeout(800);
  pruef(await page.evaluate(function () { return !!(window.FF && FF.spiel) && document.fonts.check("16px 'Baloo 2'"); }), "ohne Internet: Spiel lädt samt Schrift");
  await weiterZu(page, "fiete");
  await page.evaluate(function () { FF.spiel.starteFahrt(0, 0, false); }); await page.waitForTimeout(800);
  pruef(await page.evaluate(function () { return FF.spiel.modus === "fahrt" && FF.spiel.fahrt.zeit > 0.3; }) && !fehler.length, "ohne Internet: Fahrt läuft, keine Fehler", fehler);
  await ctx.close();
}

/* =========================================================================
   INHALTE: Entwickler-Bereich, E-Auto, alle Level, Motorklänge
   ========================================================================= */
async function inhalte(browser) {
  var page = await neueSeite(browser);
  await weiterZu(page, "fiete");
  // Entwickler-Bereich: versteckt; 7× auf die Version tippen, dann die Rechenaufgabe für Erwachsene
  await page.click("#knopf-einstellungen"); await page.waitForTimeout(200);
  pruef(await page.evaluate(function () { return document.getElementById("entwickler-gruppe").hidden; }), "Entwickler-Bereich ist zuerst versteckt");
  await page.evaluate(function () { document.getElementById("popover").hidden = true; });
  for (var i = 0; i < 6; i++) await page.click("#opt-version");
  pruef(await page.evaluate(function () { return document.getElementById("popover").hidden && !document.getElementById("eltern").classList.contains("offen"); }),
    "Beim Tippen zählt nichts sichtbar mit (Kinder finden den Bereich nicht zufällig)");
  await page.click("#opt-version"); await page.waitForTimeout(200);
  pruef(await page.evaluate(function () { return document.getElementById("eltern").classList.contains("offen") && document.getElementById("entwickler-gruppe").hidden; }),
    "Nach dem 7. Tippen kommt erst die Rechenaufgabe für Erwachsene");
  await page.evaluate(function () {
    var t = document.getElementById("eltern-aufgabe").textContent.split("×"), l = (+t[0]) * (+t[1]);
    document.querySelector('.eltern-antwort[data-wert="' + l + '"]').click();
  });
  await page.waitForTimeout(200);
  pruef(await page.evaluate(function () { return !document.getElementById("entwickler-gruppe").hidden && !document.getElementById("eltern").classList.contains("offen"); }),
    "Richtige Antwort öffnet den Entwickler-Bereich");
  var vor = await page.evaluate(function () { var S = FF.spiel.spielstand.spieler; return S.fiete.muenzen + S.jonte.muenzen; });
  await page.click("#dev-muenzen");
  var nach = await page.evaluate(function () { var S = FF.spiel.spielstand.spieler; return [S.fiete.muenzen, S.jonte.muenzen]; });
  pruef(nach[0] + nach[1] - vor === 20000, "+10.000 Münzen für beide Kinder", nach);
  await page.click("#dev-alle-offen");
  await page.click("#einstellungen-fertig"); await page.waitForTimeout(300);
  var offen = await page.evaluate(function () { return document.querySelectorAll("#welten-liste .level-knopf.gesperrt").length; });
  pruef(offen === 0, "„Alle Level“: keine Welt mehr gesperrt", offen);
  pruef(await page.evaluate(function () { return !!document.querySelector("#welten-liste .entwickler-hinweis #dev-alle-zu"); }),
    "„Alle Level“ ist in der Weltenliste sichtbar markiert (mit Ausschalter)");
  pruef(await page.evaluate(function () { return document.querySelectorAll("#welten-liste .welt-karte").length === FF.CONFIG.welten.length &&
    document.querySelectorAll("#welten-liste .level-knopf.profi").length === FF.CONFIG.welten.length; }), "Jede Welt hat 4 Level, das vierte ist ein Profi-Level");

  // Nach Level 3 geht es in die neue Welt, das Profi-Level ist die zweite Wahl
  await page.evaluate(function () { FF.spiel.starteFahrt(0, 2, false); }); await page.waitForTimeout(400);
  await zumZiel(page); await warte(page, offen, 8000, "ergebnis");
  var knoepfe = await page.evaluate(function () {
    return { weiter: document.getElementById("knopf-ergebnis-weiter").textContent, profi: !document.getElementById("knopf-ergebnis-profi").hidden };
  });
  pruef(/Neue Welt/.test(knoepfe.weiter) && knoepfe.profi, "Nach Level 3: Hauptknopf „Neue Welt“, Profi-Level als zweiter Knopf", knoepfe);
  await page.click("#knopf-ergebnis-profi"); await page.waitForTimeout(400);
  pruef(await page.evaluate(function () { return FF.spiel.fahrt.stufe === 3 && FF.spiel.fahrt.weltIndex === 0; }), "… der zweite Knopf startet das Profi-Level");

  // In der Luft: Pfeile auf den Pedalen und einmal der gesprochene Tipp; Bruchlandung erklärt, was hilft
  var luft = await page.evaluate(async function () {
    var f = FF.spiel.fahrt, warte = function (ms) { return new Promise(function (ok) { setTimeout(ok, ms); }); };
    FF.Physik.setzePose(f.fz, f.fz.chassis.x, f.fz.chassis.y + 25, 0);
    await warte(800);
    var r = { pfeile: document.getElementById("pedale").classList.contains("luft"), tipp: document.getElementById("tipp").textContent };
    f.melde("bruch", { nase: "hoch" }); await warte(250);
    r.bruch = document.getElementById("tipp").textContent;
    f.melde("bruch", { nase: "tief" }); await warte(250);
    r.bruch2 = document.getElementById("tipp").textContent;
    return r;
  });
  pruef(luft.pfeile && /hebt die Nase/.test(luft.tipp), "In der Luft: Pfeile auf den Pedalen und Tipp „Gas hebt die Nase, Bremse senkt sie“", luft);
  pruef(/Nase zu hoch/.test(luft.bruch) && /BREMSEN/.test(luft.bruch) && /Nase zu tief/.test(luft.bruch2) && /GAS/.test(luft.bruch2),
    "Bruchlandung: der Tipp sagt, was hilft (zu hoch → bremsen, zu tief → Gas)", luft);

  // Alle Welten und Level lassen sich starten (je 0,4 s fahren)
  var probleme = await page.evaluate(async function () {
    var fehler = [];
    for (var wi = 0; wi < FF.CONFIG.welten.length; wi++) {
      for (var li = 0; li < FF.CONFIG.welten[wi].level.length; li++) {
        try {
          FF.spiel.starteFahrt(wi, li, false); FF.spiel.setzeEingabe(true, false);
          await new Promise(function (ok) { setTimeout(ok, 400); });
          var f = FF.spiel.fahrt;
          if (!f || !isFinite(f.fz.chassis.x) || f.zeit <= 0) fehler.push(wi + "/" + li);
        } catch (e) { fehler.push(wi + "/" + li + ": " + e.message); }
      }
    }
    FF.spiel.setzeEingabe(false, false);
    return fehler;
  });
  pruef(!probleme.length, "alle " + (await page.evaluate(function () { return FF.CONFIG.welten.length * 4; })) + " Level starten und fahren", probleme);

  // E-Auto kaufen, fahren, Akku-Anzeige, Rekuperation
  await page.evaluate(function () { FF.spiel.zeigeMenue("garage"); });
  await page.waitForTimeout(200);
  await page.evaluate(function () { while (document.getElementById("fz-name").textContent.indexOf("E-Auto") < 0) document.getElementById("fz-vor").click(); });
  await page.click("#fz-aktion"); await page.waitForTimeout(200);
  pruef(await page.evaluate(function () { return FF.spiel.profil.fahrzeug === "eauto"; }), "E-Auto gekauft und ausgewählt");
  await page.click("#fz-motor"); await page.waitForTimeout(400);
  await page.evaluate(function () { FF.spiel.starteFahrt(0, 0, false); });
  await page.waitForTimeout(300);
  pruef(await page.evaluate(function () { return document.getElementById("hud-tank-icon").textContent === "🔋" && document.getElementById("hud-tank").classList.contains("akku"); }), "HUD zeigt beim E-Auto den Akku 🔋");
  var r = await page.evaluate(async function () {
    var f = FF.spiel.fahrt, warte = function (ms) { return new Promise(function (ok) { setTimeout(ok, ms); }); };
    FF.spiel.setzeEingabe(true, false); await warte(3000);
    f.tank = 0.5; var vorher = f.tank;
    FF.spiel.setzeEingabe(false, true);                          // bremsen, bis fast stehend
    for (var n = 0; n < 40 && f.fz.status.vorwaerts > 1.5; n++) await warte(50);
    var nachher = f.tank;
    // auf der flachen Startgeraden: Tempo holen, dann ohne Pedal rollen lassen
    FF.spiel.setzeEingabe(false, false);
    FF.Physik.setzeAufBoden(f.fz, f.gelaende, 2, 0);
    FF.spiel.setzeEingabe(true, false); await warte(1800);
    FF.spiel.setzeEingabe(false, false); await warte(300);      // Pedal ist los
    var rollVor = f.tank; await warte(1000);
    var rollNach = f.tank;
    FF.Physik.setzeAufBoden(f.fz, f.gelaende, 2, 0);            // im Stand auf ebenem Boden
    await warte(800);
    var stand = f.tank; await warte(1500);
    return { vorher: vorher, nachher: nachher, rollVor: rollVor, rollNach: rollNach, stand: stand, standSpaeter: f.tank };
  });
  pruef(r.nachher > r.vorher, "Rekuperation: Bremsen lädt den Akku (" + (r.vorher * 100).toFixed(1) + " % → " + (r.nachher * 100).toFixed(1) + " %)", r);
  pruef(r.rollNach > r.rollVor, "Rekuperation: Rollen ohne Pedal lädt den Akku auch (" + (r.rollVor * 100).toFixed(1) + " % → " + (r.rollNach * 100).toFixed(1) + " %)", r);
  pruef(Math.abs(r.standSpaeter - r.stand) < 1e-9, "E-Auto verbraucht im Stand nichts", r);

  // Motorklänge aller Fahrzeuge: offline rendern, keine Fehler, kein NaN, nicht übersteuert, hörbar
  var klang = await page.evaluate(async function () {
    var erg = [];
    for (var i = 0; i < FF.CONFIG.fahrzeuge.length; i++) {
      var def = FF.CONFIG.fahrzeuge[i], ac = new OfflineAudioContext(1, 44100 * 4, 44100);
      var m = new FF.Klang.Motor(ac, ac.destination, def.klang);
      for (var k = 1; k < 4 * 30; k++) {
        (function (t) {
          ac.suspend(t).then(function () {
            var u = Math.min(1, Math.max(0, (t - 0.8) / 2.5));
            m.setze({ drehzahl: u, gas: t > 0.8 ? 1 : 0, bremse: 0, laeuft: true, tempo: u * def.motor.vmax, vmax: def.motor.vmax, boden: true, luft: true, dt: 1 / 30 });
            ac.resume();
          });
        })(k / 30);
      }
      var d = (await ac.startRendering()).getChannelData(0), spitze = 0, nan = 0, summe = 0;
      for (var j = 0; j < d.length; j++) { if (!isFinite(d[j])) nan++; else { spitze = Math.max(spitze, Math.abs(d[j])); if (j > 44100 * 2) summe += d[j] * d[j]; } }
      erg.push({ id: def.id, spitze: spitze, nan: nan, rms: Math.sqrt(summe / (44100 * 2)) });
    }
    return erg;
  });
  pruef(klang.every(function (k) { return k.nan === 0 && k.spitze < 0.9 && k.rms > 0.005; }), "Motorklang aller " + klang.length + " Fahrzeuge: sauber, hörbar, nicht übersteuert",
    klang.map(function (k) { return k.id + " " + k.spitze.toFixed(2) + "/" + k.rms.toFixed(3); }));
  pruef(!page.fehler.length, "keine Fehler in der Konsole", page.fehler);
  await page.context().close();
}

/* =========================================================================
   LEISTUNG (nur Info – hängt stark vom Rechner ab)
   ========================================================================= */
async function leistung(browser) {
  for (var drossel of [1, 4]) {
    var page = await neueSeite(browser, { kontext: { deviceScaleFactor: 2 } });
    var cdp = await page.context().newCDPSession(page);
    await cdp.send("Emulation.setCPUThrottlingRate", { rate: drossel });
    var messe = async function (titel) {
      await page.waitForTimeout(1200);
      await page.evaluate(function () {
        FF.spiel.setzeEingabe(true, false); window.__fr = []; var l = 0;
        window.__rid = requestAnimationFrame(function f(t) { if (l) __fr.push(t - l); l = t; window.__rid = requestAnimationFrame(f); });
      });
      await page.waitForTimeout(5000);
      var r = await page.evaluate(function () {
        cancelAnimationFrame(__rid); FF.spiel.setzeEingabe(false, false);
        var s = __fr.slice().sort(function (a, b) { return a - b; }), m = s.reduce(function (a, b) { return a + b; }, 0) / s.length;
        return { fps: 1000 / m, p95: s[Math.floor(0.95 * (s.length - 1))] };
      });
      console.log("    " + (drossel + "× CPU").padEnd(7) + titel.padEnd(26) + r.fps.toFixed(1).padStart(5) + " Bilder/s, 95 % der Bilder ≤ " + r.p95.toFixed(1) + " ms");
      return r;
    };
    await weiterZu(page, "fiete");
    var ergebnisse = [];
    for (var wi of [0, 2, 4, 7]) {
      await page.evaluate(function (w) { FF.spiel.starteFahrt(w, 2, false); }, wi);
      ergebnisse.push(await messe(await page.evaluate(function (w) { return FF.CONFIG.welten[w].name; }, wi)));
    }
    await page.evaluate(function () { FF.spiel.zeigeSpielerwahl(); });
    await page.click(".wahl-karte[data-zuzweit]"); await page.waitForTimeout(300);
    await page.click('.start-knopf[data-erster="fiete"]'); await page.waitForTimeout(300);
    await page.click("#knopf-uebergabe-los"); await page.waitForTimeout(300);
    await page.evaluate(function () { FF.spiel.setzeEingabe(true, false); }); await page.waitForTimeout(6000);
    await zumZiel(page); await warte(page, offen, 15000, "uebergabe");
    await page.click("#knopf-uebergabe-los");
    ergebnisse.push(await messe("Geisterrennen"));
    if (drossel === 1) pruef(ergebnisse.every(function (r) { return r.fps > 55; }), "ohne Drosselung durchgehend ≈ 60 Bilder/s");
    await page.context().close();
  }
}

/* ---------- los ---------- */
(async function () {
  var server = await starteServer();
  URL = "http://127.0.0.1:" + server.address().port + "/";
  var browser = await chromium.launch();
  var pruefungen = { ablauf: ablauf, layout: layout, robust: robust, offline: offline, inhalte: inhalte, leistung: leistung };
  try {
    for (var i = 0; i < auswahl.length; i++) {
      if (!pruefungen[auswahl[i]]) { console.error("Unbekannte Prüfung: " + auswahl[i]); fehlgeschlagen++; continue; }
      console.log("\n▶ " + auswahl[i]);
      await pruefungen[auswahl[i]](browser);
    }
  } catch (e) {
    fehlgeschlagen++;
    console.error("  ✗ Abbruch: " + (e && e.stack || e));
  }
  await browser.close();
  server.close();
  console.log("\n" + bestanden + " bestanden, " + fehlgeschlagen + " fehlgeschlagen" + (BILDER ? " – Fotos in " + BILDER : ""));
  process.exit(fehlgeschlagen ? 1 : 0);
})();
