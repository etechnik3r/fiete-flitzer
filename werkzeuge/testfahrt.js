#!/usr/bin/env node
/* ===========================================================================
   Fiete Flitzer – werkzeuge/testfahrt.js
   ---------------------------------------------------------------------------
   Ein kleiner Roboter-Fahrer fährt alle Level ohne Browser ab. So lässt sich
   prüfen, ob die Level schaffbar sind und die Benzinkanister passen.

   Aufruf:
     node werkzeuge/testfahrt.js                 alle Welten, Flitzer ohne Upgrades
     node werkzeuge/testfahrt.js --upgrade 3     alle Upgrades auf Stufe 3
     node werkzeuge/testfahrt.js --upgrade auto  Upgrades, die man bis zur Welt etwa hat
     node werkzeuge/testfahrt.js --fahrzeug monster --welt 3
     node werkzeuge/testfahrt.js --kind          Fahrer "Kind" (siehe unten)
     node werkzeuge/testfahrt.js --vollgas       Fahrer "Vollgas" (siehe unten)
     node werkzeuge/testfahrt.js --loslassen     Fahrer "Loslassen" (siehe unten)
     node werkzeuge/testfahrt.js --vergleich     alle vier Fahrer je Level nebeneinander
     node werkzeuge/testfahrt.js --physik        Physik-Plausibilitätstests
     node werkzeuge/testfahrt.js --geist         Geisterrennen: Aufnahme, Wiedergabe, Sieger
     node werkzeuge/testfahrt.js --spielideen    Pfützen, Hüpfpilze, Wind, Wasser der neuen Welten
     node werkzeuge/testfahrt.js --spielstand    Spielstand-Code: hin und zurück, Tippfehler erkennen

   Drei Roboter-Fahrer:
     Profi    sagt in der Luft den Landepunkt voraus und stellt die Nase mit
              Gas/Bremse passend zum Hang, dosiert am Berg das Gas (sonst
              Überschlag nach hinten), bremst vor steilen Abhängen und nimmt
              Anlauf, wenn er festhängt – so fährt ein geübter Spieler.
     Kind     hält am Boden immer Vollgas, korrigiert in der Luft nur grob.
     Loslassen  hält am Boden Vollgas und lässt in der Luft alles los –
              bremst also nie (die naheliegendste Strategie ohne Bremse).
     Vollgas  lässt das Gas nie los – auch nicht in der Luft.
   Gute Level: Der Profi kommt ins Ziel, Loslassen und Vollgas überschlagen
   sich oft – dann braucht man wirklich Gefühl für Gas UND Bremse.
   =========================================================================== */
"use strict";

var fs = require("fs");
var path = require("path");
var vm = require("vm");

var basis = path.join(__dirname, "..");
["config.js", "gelaende.js", "physik.js", "fahrt.js", "geist.js", "spielstand.js"].forEach(function (datei) {
  vm.runInThisContext(fs.readFileSync(path.join(basis, datei), "utf8"), { filename: datei });
});
var FF = globalThis.FF;

/* ---------- Kommandozeile ---------- */
var argv = process.argv.slice(2);
function arg(name, standard) {
  var i = argv.indexOf("--" + name);
  if (i < 0) return standard;
  var v = argv[i + 1];
  return v === undefined || v.indexOf("--") === 0 ? true : v;
}
var upgradeArg = arg("upgrade", 0);
var fahrzeugId = arg("fahrzeug", "flitzer");
var nurWelt = arg("welt", null);
var schwierigkeit = arg("schwierigkeit", "normal");

/* ---------- Roboter-Fahrer ---------- */
var fahrerArt = arg("vollgas", false) ? "vollgas" : arg("loslassen", false) ? "loslassen" : (arg("kind", false) ? "kind" : "profi");

function inDerLuft(st) { return st.radKontakte === 0 && !st.huellKontakt && !st.kopfKontakt; }

/* "Vollgas": lässt das Gas nie los */
function vollgasEingabe() { return { gas: true, bremse: false }; }

/* "Loslassen": am Boden Vollgas, in der Luft nichts drücken – bremst nie */
function loslassenEingabe(f) { return inDerLuft(f.fz.status) ? { gas: false, bremse: false } : { gas: true, bremse: false }; }

/* "Kind": gibt am Boden immer Vollgas und steuert in der Luft nur grob */
function kindEingabe(f) {
  var C = f.fz.chassis, a = FF.normWinkel(C.a);
  if (inDerLuft(f.fz.status) && a > 0.9) return { gas: false, bremse: true };
  if (inDerLuft(f.fz.status) && a < -0.9) return { gas: true, bremse: false };
  return { gas: true, bremse: false };
}

/* "Profi": wie ein geübter Spieler (siehe Kopf der Datei) */
function profiFahrer() {
  var rueck = 0, rueckBis = 0, klemm = 0, statistik = { boden: 0, gasWeg: 0, bremse: 0, luft: 0 };
  function eingabe(f, dt) {
    var fz = f.fz, C = fz.chassis, st = fz.status, gel = f.gelaende, g = f.welt.schwerkraft;
    var a = FF.normWinkel(C.a);
    if (f.imLooping) return { gas: true, bremse: false };   // im Looping: Vollgas durch
    if (inDerLuft(st)) {
      statistik.luft += dt;
      // Landepunkt aus der Wurfparabel, dort soll die Nase zum Hang passen
      var x = C.x, y = C.y, t = 0;
      for (var k = 0; k < 90; k++) {
        t += 0.04; x = C.x + C.vx * t; y = C.y + C.vy * t - 0.5 * g * t * t;
        if (y - 0.9 < gel.hoeheBei(x)) break;
      }
      var fehler = FF.normWinkel(Math.atan(gel.steigungBei(x)) - a);
      var u = fehler / Math.max(0.3, t) - C.w;            // gewünschte minus aktuelle Drehrate
      if (u > 0.4) return { gas: true, bremse: false };
      if (u < -0.4) return { gas: false, bremse: true };
      return { gas: false, bremse: false };
    }
    statistik.boden += dt;
    var v = st.vorwaerts;
    // festgefahren? → zurückrollen/-fahren und Anlauf nehmen
    if (rueck > 0) {
      rueck -= dt; statistik.bremse += dt;
      if (C.x < rueckBis) rueck = 0;
      return { gas: false, bremse: true };
    }
    klemm = (st.tempo < 0.5 && f.gas > 0.9) ? klemm + dt : 0;
    if (klemm > 1.5) { klemm = 0; rueck = 5; rueckBis = C.x - 12; }
    var rel = FF.normWinkel(a - Math.atan(gel.steigungBei(C.x)));   // + = Nase höher als der Boden
    if (rel > 0.5 || (rel > 0.3 && C.w > 0.6)) {                 // Überschlag nach hinten droht
      statistik.gasWeg += dt;
      if (rel > 0.75) { statistik.bremse += dt; return { gas: false, bremse: true }; }
      return { gas: false, bremse: false };
    }
    // vor steilem Gefälle oder Abbruchkante nicht zu schnell
    var vorX = C.x + 3 + Math.max(0, v) * 0.6;
    var gef = Math.min(gel.steigungBei(vorX), gel.steigungBei(vorX + 4));
    var vMax = gef < -0.9 ? 8 : (gef < -0.6 ? 11 : 99);
    if (v > vMax) { statistik.bremse += dt; return { gas: false, bremse: true }; }
    return { gas: true, bremse: false };
  }
  return { eingabe: eingabe, statistik: statistik };
}

function neuerFahrer(art) {
  if (art === "vollgas") return { eingabe: vollgasEingabe, statistik: null };
  if (art === "loslassen") return { eingabe: loslassenEingabe, statistik: null };
  if (art === "kind") return { eingabe: kindEingabe, statistik: null };
  return profiFahrer();
}

function fahre(weltIndex, stufe, fzId, upg, maxZeit, art) {
  var f = new FF.Fahrt({ weltIndex: weltIndex, stufe: stufe, fahrzeugId: fzId, upgrades: upg, schwierigkeit: schwierigkeit });
  var dt = 1 / 60, minTank = 1, tanks = 0, fahrer = neuerFahrer(art || fahrerArt), luftSpruenge = 0, luft = 0;
  maxZeit = maxZeit || 400;
  while (f.zustand !== "ende" && f.zeit < maxZeit) {
    f.aktualisiere(dt, fahrer.eingabe(f, dt));
    if (f.tank < minTank) minTank = f.tank;
    if (inDerLuft(f.fz.status) && f.zustand === "fahrt") luft += dt; else { if (luft > 0.6) luftSpruenge++; luft = 0; }
    for (var i = 0; i < f.ereignisse.length; i++) if (f.ereignisse[i].typ === "tank") tanks++;
    f.ereignisse.length = 0;
    if (!isFinite(f.fz.chassis.x) || !isFinite(f.fz.chassis.y)) { return { fehler: "NaN!" }; }
  }
  var e = f.ergebnis();
  e.minTank = minTank; e.tanks = tanks; e.zeitAbbruch = f.zeit >= maxZeit;
  e.wertGesamt = f.gelaende.muenzWertGesamt;
  e.laenge = f.gelaende.ziel;
  e.spruenge = luftSpruenge;
  e.statistik = fahrer.statistik;
  return e;
}

function upgradesAlle(stufe) {
  return { motor: stufe, reifen: stufe, federung: stufe, tank: stufe, allrad: stufe >= 4 ? 1 : 0 };
}
/* "auto": so viele Upgrades, wie man bis zu dieser Welt ungefähr erspielt hat */
function upgradesFuer(weltIndex) {
  return upgradesAlle(upgradeArg === "auto" ? Math.min(5, Math.floor(weltIndex / 2)) : +upgradeArg || 0);
}

/* ---------- Physik-Plausibilität ---------- */
function physikTests() {
  var welt = FF.CONFIG.welten[0];
  function ebeneWelt(steigungGrad, grip) {
    var w = JSON.parse(JSON.stringify(welt));
    w.grip = grip || 1;
    var gel = {
      dx: 0.5, x0: -40, h: [],
      hoeheBei: function (x) { return Math.max(0, x) * Math.tan(steigungGrad * Math.PI / 180); },
      steigungBei: function (x) { return x > 0 ? Math.tan(steigungGrad * Math.PI / 180) : 0; }
    };
    for (var i = 0; i < 4000; i++) gel.h.push(gel.hoeheBei(-40 + i * 0.5));
    gel.kreisKontakt = FF.Gelaende.prototype.kreisKontakt;
    gel.punktKontakt = FF.Gelaende.prototype.punktKontakt;
    gel.loopKontakt = FF.Gelaende.prototype.loopKontakt;
    return { welt: w, gel: gel };
  }
  var h = FF.CONFIG.physik.schrittweite;

  // 1) Ruhelage: Auto steht still, Federn tragen das Gewicht
  var t = ebeneWelt(0);
  var w = FF.berechneWerte(FF.fahrzeugDef("flitzer"), {}, "normal");
  var fz = FF.Physik.baueFahrzeug(w, 0, t.gel);
  for (var i = 0; i < 240 * 3; i++) FF.Physik.schritt(fz, t.gel, t.welt, h);
  var summeN = fz.raeder.reduce(function (s, R) { return s + R.kontakt.kraftN; }, 0);
  var mGes = w.masse + w.raeder.reduce(function (s, r) { return s + r.masse; }, 0);
  console.log("Ruhelage: Σ Normalkraft = " + summeN.toFixed(0) + " N, m·g = " + (mGes * 9.81).toFixed(0) +
              " N, Tempo = " + fz.status.tempo.toFixed(4) + " m/s, Winkel = " + (fz.chassis.a * 180 / Math.PI).toFixed(2) + "°");
  fz.raeder.forEach(function (R, i) {
    console.log("  Rad " + i + ": Fn = " + R.kontakt.kraftN.toFixed(0) + " N, Federweg genutzt = " + ((R.L0 - R.trans) * 100).toFixed(1) + " cm");
  });

  // 2) Hangabtrieb: Wann rutscht/rollt das Auto am Hang (gebremst)?
  [10, 20, 30, 40].forEach(function (grad) {
    var t2 = ebeneWelt(grad);
    var fz2 = FF.Physik.baueFahrzeug(w, 5, t2.gel);
    for (var j = 0; j < 240 * 3; j++) {
      fz2.raeder.forEach(function (R) { R.motorZiel = 0; R.motorMax = w.bremse / fz2.raeder.length; });
      FF.Physik.schritt(fz2, t2.gel, t2.welt, h);
    }
    console.log("Gebremst am " + grad + "°-Hang (tan = " + Math.tan(grad * Math.PI / 180).toFixed(2) + ", µ = " + w.grip +
                "): v = " + fz2.status.vorwaerts.toFixed(2) + " m/s " + (Math.abs(fz2.status.vorwaerts) < 0.05 ? "→ hält" : "→ rutscht"));
  });

  // 3) Steigfähigkeit aus dem Stand (Heckantrieb): Traktionsgrenze µ·Fn,hinten vs. m·g·sin α
  [15, 22, 28, 34].forEach(function (grad) {
    var t3 = ebeneWelt(grad);
    var fz3 = FF.Physik.baueFahrzeug(w, 3, t3.gel);
    var x0 = fz3.chassis.x, Tmax = w.motor.drehmoment;
    for (var j = 0; j < 240 * 4; j++) {
      fz3.raeder.forEach(function (R) {
        R.motorZiel = -R.wMax; R.motorMax = R.antrieb ? Tmax : 0;
      });
      FF.Physik.schritt(fz3, t3.gel, t3.welt, h);
    }
    var Rh = fz3.raeder[0];
    var schlupf = Math.abs(Rh.k.w * Rh.r) - Math.abs(fz3.status.vorwaerts);
    console.log("Anfahren am " + grad + "°: Strecke " + (fz3.chassis.x - x0).toFixed(1) + " m in 4 s, v = " +
                fz3.status.vorwaerts.toFixed(2) + " m/s, Schlupf hinten = " + schlupf.toFixed(2) + " m/s, Nickwinkel = " +
                ((fz3.chassis.a) * 180 / Math.PI).toFixed(0) + "°");
  });

  // 4) Freier Flug: Drehimpulserhaltung – Rad beschleunigen dreht die Karosserie entgegen
  var t4 = ebeneWelt(0);
  var fz4 = FF.Physik.baueFahrzeug(w, 0, t4.gel);
  fz4.chassis.y += 50; fz4.raeder.forEach(function (R) { R.k.y += 50; });
  var welt0 = JSON.parse(JSON.stringify(t4.welt)); welt0.schwerkraft = 0; welt0.luftdichte = 0;
  function drehimpuls() {
    var L = fz4.chassis.J * fz4.chassis.w;
    fz4.raeder.forEach(function (R) {
      L += R.k.J * R.k.w + R.k.m * ((R.k.x - fz4.chassis.x) * R.k.vy - (R.k.y - fz4.chassis.y) * R.k.vx);
    });
    L += fz4.chassis.m * 0;
    return L;
  }
  for (var j2 = 0; j2 < 240; j2++) {
    fz4.raeder.forEach(function (R) { R.motorZiel = -R.wMax; R.motorMax = R.antrieb ? 400 : 0; });
    FF.Physik.schritt(fz4, t4.gel, welt0, h);
  }
  console.log("Flug ohne Schwerkraft, 1 s Gas: Karosserie ω = " + fz4.chassis.w.toFixed(3) + " rad/s (positiv = Nase hoch), " +
              "Rad ω = " + fz4.raeder[0].k.w.toFixed(1) + " rad/s");
}

/* ---------- Geisterrennen: Aufnahme, Wiedergabe, Sieger ---------- */
function geistTests() {
  var fehler = 0;
  function pruefe(bed, text) { console.log((bed ? "✓ " : "✗ ") + text); if (!bed) fehler++; }
  // 1) Fahrt aufzeichnen
  var f = new FF.Fahrt({ weltIndex: 0, stufe: 0, fahrzeugId: "flitzer", upgrades: {}, schwierigkeit: "normal" });
  var auf = new FF.Geist.Aufnahme({ kind: "fiete", fahrzeugId: "flitzer", upgrades: {} });
  var echt = [], fahrer = profiFahrer();
  while (f.zustand !== "ende" && f.zeit < 200) {
    f.aktualisiere(1 / 60, fahrer.eingabe(f, 1 / 60));
    auf.erfasse(f, "normal");
    echt.push({ t: f.zeit, x: f.fz.chassis.x, y: f.fz.chassis.y });
    f.ereignisse.length = 0;
  }
  auf.abschliessen(f, "freude");
  var e0 = auf.ergebnis;
  pruefe(auf.proben.length > 200, "Aufnahme hat " + auf.proben.length + " Proben (" + (auf.proben.length / auf.dauer()).toFixed(1) + " pro Sekunde)");
  pruefe(e0.ziel && e0.zielZeit > 0, "Fahrt 1 im Ziel nach " + (e0.zielZeit || 0).toFixed(2) + " s");
  // 2) Wiedergabe trifft die echte Bahn (max. Abweichung)
  var g = new FF.Geist.Geist(auf, f.gelaende), maxAbw = 0;
  echt.forEach(function (p, i) {
    if (i % 7) return;
    g.setzeZeit(p.t);
    maxAbw = Math.max(maxAbw, Math.hypot(g.fz.chassis.x - p.x, g.fz.chassis.y - p.y));
  });
  pruefe(maxAbw < 0.5, "Geist folgt der echten Bahn (max. Abweichung " + maxAbw.toFixed(3) + " m)");
  g.setzeZeit(0); var anfang = g.fz.chassis.x; g.setzeZeit(1e9);
  pruefe(g.fertig && g.fz.chassis.x > f.gelaende.ziel, "Geist steht am Ende hinter dem Ziel (zurückspulen geht: Start x=" + anfang.toFixed(1) + ")");
  // 3) Sieger-Regeln
  var V = FF.Geist.vergleiche;
  pruefe(V({ ziel: true, zielZeit: 40 }, { ziel: true, zielZeit: 42 }) === 0, "beide im Ziel: schnellere Zeit gewinnt");
  pruefe(V({ ziel: true, zielZeit: 40 }, { ziel: true, zielZeit: 40.02 }) === -1, "fast gleiche Zeit: unentschieden");
  pruefe(V({ ziel: false, strecke: 300 }, { ziel: true, zielZeit: 90 }) === 1, "nur einer im Ziel: der gewinnt");
  pruefe(V({ ziel: false, strecke: 300, endlos: true }, { ziel: false, strecke: 280 }) === 0, "keiner im Ziel: weitere Strecke gewinnt");
  pruefe(V({ ziel: false, strecke: 300 }, { ziel: false, strecke: 300.4 }) === -1, "gleiche Strecke: unentschieden");
  // 4) Zweite Fahrt auf derselben Strecke (gleicher Seed → gleiche Höhen)
  var f2 = new FF.Fahrt({ weltIndex: 0, stufe: 0, fahrzeugId: "traktor", upgrades: {}, schwierigkeit: "normal" });
  var gleich = f2.gelaende.h.length === f.gelaende.h.length && f2.gelaende.h.every(function (h, i) { return h === f.gelaende.h[i]; });
  pruefe(gleich, "zweite Fahrt hat exakt dieselbe Strecke");
  console.log(fehler ? fehler + " Fehler" : "Alle Geist-Tests bestanden.");
  return fehler;
}

/* ---------- Hauptprogramm ---------- */
/* Spielideen der neuen Welten: Pfütze, Hüpfpilz, Wind, Wasser, Nacht – und dass
   die alten Welten davon nichts abbekommen */
function spielideenTests() {
  var fehler = 0, C = FF.CONFIG;
  function pruefe(bed, text, extra) { console.log((bed ? "✓ " : "✗ ") + text + (bed || extra === undefined ? "" : " → " + JSON.stringify(extra))); if (!bed) fehler++; }
  function wi(id) { for (var i = 0; i < C.welten.length; i++) if (C.welten[i].id === id) return i; return -1; }
  function neu(id, stufe) { return new FF.Fahrt({ weltIndex: wi(id), stufe: stufe || 0, fahrzeugId: "flitzer", upgrades: {}, schwierigkeit: "normal" }); }
  // Pfützen: liegen in Mulden, Wasserspiegel über dem Boden, nicht breiter als erlaubt
  var f = neu("pfuetzen", 1), P = f.gelaende.pfuetzen, W = f.welt.wasser, ok = P.length > 5;
  P.forEach(function (p, i) {
    var mitte = (p.x0 + p.x1) / 2;
    if (!(p.x1 - p.x0 <= W.maxBreite + 1 && f.gelaende.hoeheBei(mitte) < p.y && (i === 0 || P[i - 1].x1 < p.x0))) ok = false;
  });
  pruefe(ok, "Pfützenland: " + P.length + " Pfützen in Mulden, sortiert, höchstens " + W.maxBreite + " m breit");
  // Durchfahren: spritzt und bremst
  var p0 = P[0], x = p0.x0 - 6;
  FF.Physik.setzeAufBoden(f.fz, f.gelaende, x, 0);
  f.fz.chassis.vx = 10; f.fz.raeder.forEach(function (R) { R.k.vx = 10; });
  var platsch = false, vMin = 99;
  for (var i = 0; i < 240 * 2 && f.fz.chassis.x < p0.x1 + 3; i++) {
    f.aktualisiere(1 / 240, { gas: false, bremse: false });
    f.ereignisse.forEach(function (e) { if (e.typ === "platsch") platsch = true; });
    f.ereignisse.length = 0;
    if (f.imWasser) vMin = Math.min(vMin, f.fz.chassis.vx);
  }
  pruefe(platsch && vMin < 10, "Pfütze: spritzt (Ereignis „platsch“) und bremst (v im Wasser bis " + vMin.toFixed(1) + " m/s)");
  // Hüpfpilz: schleudert hoch
  var h = neu("garten", 1), T = h.gelaende.trampoline[0];
  pruefe(h.gelaende.trampoline.length > 0, "Riesengarten: " + h.gelaende.trampoline.length + " Hüpfpilze in Level 2");
  FF.Physik.setzeAufBoden(h.fz, h.gelaende, T.x0 - 4, 0);
  h.fz.chassis.vx = 8; h.fz.raeder.forEach(function (R) { R.k.vx = 8; });
  var boing = false, hoch = 0, y0 = h.fz.chassis.y;
  for (i = 0; i < 240 * 3; i++) {
    h.aktualisiere(1 / 240, { gas: true, bremse: false });
    h.ereignisse.forEach(function (e) { if (e.typ === "boing") boing = true; });
    h.ereignisse.length = 0;
    hoch = Math.max(hoch, h.fz.chassis.y - y0);
  }
  pruefe(boing && hoch > 3, "Hüpfpilz: „boing“ und das Auto fliegt " + hoch.toFixed(1) + " m hoch");
  pruefe(h.gelaende.gesperrt((T.x0 + T.x1) / 2), "Der Ballon setzt nie auf einem Hüpfpilz ab (Sperrzone)");
  // Wind: Rücken- und Gegenwind kommen vor, am Start ist es ruhig, schiebt wirklich
  var w = neu("herbst", 1), gel = w.gelaende, plus = 0, minus = 0;
  for (x = 0; x < gel.ziel; x += 5) { var a = gel.windBei(x); if (a > 1) plus++; if (a < -1) minus++; }
  pruefe(plus > 10 && minus > 5 && gel.windBei(10) === 0, "Herbststurm: Rückenwind (" + plus + "×) und Gegenwind (" + minus + "×), am Start windstill");
  var xr = 0; for (x = 80; x < gel.ziel; x += 2) if (gel.windBei(x) > 1.5) { xr = x; break; }
  function rollen(f2, xs) {
    FF.Physik.setzeAufBoden(f2.fz, f2.gelaende, xs, 0);
    var sc = { hoeheBei: function () { return 0; }, steigungBei: function () { return 0; } };   // ebener Boden, gleicher Wind
    var ge = f2.gelaende; ge.hoeheBei = sc.hoeheBei; ge.steigungBei = sc.steigungBei;
    FF.Physik.setzeAufBoden(f2.fz, ge, xs, 0);
    for (var k = 0; k < 240; k++) FF.Physik.schritt(f2.fz, ge, f2.welt, 1 / 240);
    return f2.fz.chassis.vx;
  }
  var vWind = rollen(neu("herbst", 1), xr), mo = new FF.Fahrt({ weltIndex: wi("herbst"), stufe: 1, fahrzeugId: "moped", upgrades: {}, schwierigkeit: "normal" });
  var vMoped = rollen(mo, xr);
  pruefe(vWind > 0.5 && vMoped > vWind, "Rückenwind schiebt ein stehendes Auto an (Flitzer " + vWind.toFixed(2) + " m/s, Moped stärker: " + vMoped.toFixed(2) + " m/s nach 1 s)");
  // Unter Wasser: Drehung wird gedämpft
  var m = neu("meer", 0), C0 = m.fz.chassis;
  C0.y += 30; m.fz.raeder.forEach(function (R) { R.k.y += 30; }); C0.w = 3;
  for (i = 0; i < 240; i++) FF.Physik.schritt(m.fz, m.gelaende, m.welt, 1 / 240);
  pruefe(Math.abs(C0.w) < 3 * Math.exp(-0.8), "Meeresgrund: Drehung im Wasser gedämpft (3 → " + C0.w.toFixed(2) + " rad/s in 1 s)");
  // Alte Welten: keine Pfützen, keine Hüpfpilze, kein Wind
  var sauber = true;
  C.welten.forEach(function (welt, j) {
    if (welt.wasser || welt.wind || welt.gelaende.trampolin) return;
    var q = new FF.Gelaende(welt, { stufe: 2, laenge: welt.level[2].laenge, seed: welt.level[2].seed });
    if (q.pfuetzen.length || q.trampoline.length || q.windBei(200) !== 0) sauber = false;
  });
  pruefe(sauber, "Alle anderen Welten: keine Pfützen, keine Hüpfpilze, kein Wind");
  // Förderband: Gas auf einem Vorwärtsband macht schneller, rückwärts langsamer, ohne Ruck an der Kante
  function aufBand(v) {
    var fb = neu("fabrik", 1), ge = fb.gelaende;
    ge.h = ge.h.map(function () { return 0; });                     // ebener Boden
    ge.baender = [{ x0: 40, x1: 400, v: v }];
    FF.Physik.setzeAufBoden(fb.fz, ge, 30, 0);
    var maxW = 0;
    for (var k = 0; k < 240 * 4; k++) { fb.aktualisiere(1 / 240, { gas: true, bremse: false }); maxW = Math.max(maxW, Math.abs(FF.normWinkel(fb.fz.chassis.a))); }
    return [fb.fz.chassis.vx, maxW];
  }
  var b0 = aufBand(0), bv = aufBand(6), br = aufBand(-4);
  pruefe(bv[0] > b0[0] + 2 && br[0] < b0[0] - 1 && bv[1] < 0.6 && br[1] < 0.6,
    "Förderband: mit Gas vorwärts " + bv[0].toFixed(1) + ", ohne Band " + b0[0].toFixed(1) + ", rückwärts " + br[0].toFixed(1) + " m/s; kein Überschlag beim Auffahren");
  // Schwebe-Säule: dort fast keine Schwerkraft, das Auto fliegt weit und hoch, kein Kanister darin
  var st = neu("station", 1), Zs = st.gelaende.schwebezonen[0], mitte = (Zs.x0 + Zs.x1) / 2;
  var keinTank = st.gelaende.tanks.every(function (t) { return !st.gelaende.gesperrt(t.x); });
  FF.Physik.setzeAufBoden(st.fz, st.gelaende, Zs.x0 - 14, 0);
  st.fz.chassis.vx = 10; st.fz.raeder.forEach(function (R) { R.k.vx = 10; });
  var schwebe = false, hoechst = 0;
  for (i = 0; i < 240 * 4; i++) {
    st.aktualisiere(1 / 240, { gas: true, bremse: false });
    st.ereignisse.forEach(function (ev) { if (ev.typ === "schwebe") schwebe = true; }); st.ereignisse.length = 0;
    hoechst = Math.max(hoechst, st.fz.chassis.y - st.gelaende.hoeheBei(st.fz.chassis.x));
  }
  pruefe(st.gelaende.schwereBei(mitte) < 0.2 && st.gelaende.schwereBei(Zs.x1 + 10) === 1 && schwebe && hoechst > 3 && keinTank,
    "Schwebe-Säule: 18 % Schwerkraft, Meldung „schwebe“, bis " + hoechst.toFixed(1) + " m über dem Boden, kein Kanister in der Säule");
  // Objekte: Glas zerspringt (wenig Bremse), Baustein-Säule bremst stark
  function objektTest(welt, art) {
    var fo = neu(welt, 1), O = fo.gelaende.objekte.filter(function (o) { return o.art === art; })[0];
    FF.Physik.setzeAufBoden(fo.fz, fo.gelaende, O.x - 8, 0);
    fo.fz.chassis.vx = 10; fo.fz.raeder.forEach(function (R) { R.k.vx = 10; });
    var ev = null, vVor = 0;
    for (var k = 0; k < 240 * 3 && !ev; k++) {
      vVor = fo.fz.chassis.vx;
      fo.aktualisiere(1 / 240, { gas: true, bremse: false });
      fo.ereignisse.forEach(function (e) { if (e.typ === "objekt") ev = e; }); fo.ereignisse.length = 0;
    }
    return { ev: ev, kaputt: O.kaputt, faktor: fo.fz.chassis.vx / vVor };
  }
  var og = objektTest("glas", "glas"), os = objektTest("bausteine", "saeule");
  pruefe(og.ev && og.kaputt && og.faktor > 0.85 && os.ev && os.faktor < 0.45,
    "Glas zerspringt (Tempo × " + (og.faktor || 0).toFixed(2) + "), Baustein-Säule bremst stark (× " + (os.faktor || 0).toFixed(2) + ")");
  // Katapult: einfangen, nach Gas abschießen, hinter dem Graben landen
  var fk = neu("katapult", 0), KK = fk.gelaende.katapulte[0], spK = fk.gelaende.sperrzonen.filter(function (z) { return z[0] < KK.x + 2 && z[1] > KK.x; })[0];
  FF.Physik.setzeAufBoden(fk.fz, fk.gelaende, KK.x - 6, 0); fk.fz.chassis.vx = 5;
  var bereit = -1, schuss = -1, land = null;
  for (i = 0; i < 240 * 10 && land === null; i++) {
    var gasK = bereit < 0 || fk.zeit - bereit > 1;                // erst Gas, dann loslassen, dann neu drücken
    if (bereit >= 0 && fk.zeit - bereit > 0.5 && fk.zeit - bereit < 1) gasK = false;
    fk.aktualisiere(1 / 240, { gas: gasK, bremse: false });
    fk.ereignisse.forEach(function (ev) { if (ev.typ === "katapultBereit") bereit = fk.zeit; if (ev.typ === "katapult") schuss = fk.zeit; if (ev.typ === "landung" && schuss > 0) land = fk.fz.chassis.x; });
    fk.ereignisse.length = 0;
  }
  pruefe(bereit > 0 && schuss - bereit < 1.3 && land > spK[1], "Katapult: hält fest, schießt auf Gas ab (nach " + (schuss - bereit).toFixed(1) + " s), Landung hinter dem Graben (" + Math.round(land) + " > " + Math.round(spK[1]) + ")");
  // Geisterwelt: Geister tauchen auf
  var fg = neu("geister", 1), spukZahl = 0;
  FF.Physik.setzeAufBoden(fg.fz, fg.gelaende, 40, 0);
  for (i = 0; i < 240 * 8; i++) { fg.aktualisiere(1 / 240, { gas: true, bremse: false }); fg.ereignisse.forEach(function (ev) { if (ev.typ === "spuk") spukZahl++; }); fg.ereignisse.length = 0; }
  pruefe(spukZahl >= 1, "Geisterwelt: " + spukZahl + " Geister tauchen in 8 s auf");
  // Flugzeug: trägt nahe am Boden, aber nicht höher als ~3 m (kein Steigflug)
  var ff = new FF.Fahrt({ weltIndex: 0, stufe: 0, fahrzeugId: "flugzeug", upgrades: {}, schwierigkeit: "normal" }), maxFrei = 0;
  ff.gelaende.h = ff.gelaende.h.map(function () { return 0; });
  FF.Physik.setzeAufBoden(ff.fz, ff.gelaende, 20, 0);
  ff.fz.chassis.vx = 22; ff.fz.chassis.vy = 6; ff.fz.raeder.forEach(function (R) { R.k.vx = 22; R.k.vy = 6; });
  for (i = 0; i < 240 * 6; i++) { ff.aktualisiere(1 / 240, { gas: true, bremse: false }); maxFrei = Math.max(maxFrei, ff.fz.chassis.y - ff.gelaende.hoeheBei(ff.fz.chassis.x)); }
  var ohne = new FF.Fahrt({ weltIndex: 0, stufe: 0, fahrzeugId: "flitzer", upgrades: {}, schwierigkeit: "normal" });
  pruefe(maxFrei < 4.6, "Flugzeug: mit Schwung nach oben höchstens " + maxFrei.toFixed(1) + " m über dem Boden – kein Steigflug");
  // Skateboard: Anfahren mit Vollgas auf ebener Strecke ohne Umkippen
  var fs2 = new FF.Fahrt({ weltIndex: 0, stufe: 0, fahrzeugId: "skateboard", upgrades: {}, schwierigkeit: "normal" }), maxA = 0;
  fs2.gelaende.h = fs2.gelaende.h.map(function () { return 0; });
  FF.Physik.setzeAufBoden(fs2.fz, fs2.gelaende, 10, 0);
  for (i = 0; i < 240 * 4; i++) { fs2.aktualisiere(1 / 240, { gas: true, bremse: false }); maxA = Math.max(maxA, Math.abs(FF.normWinkel(fs2.fz.chassis.a))); }
  pruefe(maxA < 0.5 && fs2.hoppla === 0 && fs2.fz.chassis.vx > 8, "Skateboard: Vollgas aus dem Stand ohne Umkippen (höchstens " + (maxA * 57.3).toFixed(0) + "°, " + fs2.fz.chassis.vx.toFixed(1) + " m/s nach 4 s)");
  // Strecken-Editor: gemalte Strecke wird befahrbar (Steigung begrenzt), Inhalte verteilt, Ziel erreichbar
  var hh = []; for (i = 0; i <= 150; i++) hh.push(i * 2 < 60 ? 0 : (i * 2 < 120 ? (i * 2 - 60) * 1.5 : 90 - (i * 2 - 120) * 0.4));
  var e = new FF.Fahrt({ weltIndex: 0, stufe: 1, fahrzeugId: "flitzer", upgrades: {}, schwierigkeit: "normal", strecke: { dx: 2, h: hh, laenge: 300 } });
  var steil = 0; for (x = 0; x < 300; x++) steil = Math.max(steil, Math.atan(e.gelaende.steigungBei(x)) * 180 / Math.PI);
  pruefe(e.gelaende.ziel === 300 && e.gelaende.bauplan.length === 0 && steil < 40 && e.gelaende.muenzWertGesamt > 0 && e.gelaende.tanks.length > 0,
    "Eigene Strecke: 56° gemalt → höchstens " + steil.toFixed(0) + "° befahrbar, keine Bau-Elemente, Münzen und Kanister verteilt");
  // Bauernhof: Matsch bremst stärker als Wasser; durch die Scheune fliegt Stroh
  function bremsTest(id) {
    var fb = neu(id, 1), Pb = fb.gelaende.pfuetzen[1], ve = 0, va = 0;
    fb.gelaende.h = fb.gelaende.h.map(function () { return 0; });       // eben, damit nur das Nasse bremst
    Pb = { x0: 40, x1: 52, y: 0.5 }; fb.gelaende.pfuetzen = [Pb];
    FF.Physik.setzeAufBoden(fb.fz, fb.gelaende, 30, 0); fb.fz.chassis.vx = 12; fb.fz.raeder.forEach(function (R) { R.k.vx = 12; });
    for (var k = 0; k < 240 * 3 && fb.fz.chassis.x < 56; k++) { if (fb.fz.chassis.x < Pb.x0) ve = fb.fz.chassis.vx; fb.aktualisiere(1 / 240, { gas: false, bremse: false }); va = fb.fz.chassis.vx; }
    return va / ve;
  }
  var bw = bremsTest("pfuetzen"), bm = bremsTest("bauernhof");
  pruefe(bm < bw - 0.05, "Matsch bremst stärker als Wasser (Tempo danach × " + bm.toFixed(2) + " statt × " + bw.toFixed(2) + ")");
  var fh = neu("bauernhof", 1), Sc = fh.gelaende.scheunen[0], stroh = null, rein = false, keinTankScheune = true;
  fh.gelaende.tanks.forEach(function (t) { if (t.x > Sc.x0 && t.x < Sc.x1) keinTankScheune = false; });
  FF.Physik.setzeAufBoden(fh.fz, fh.gelaende, Sc.x0 - 10, 0); fh.fz.chassis.vx = 6;
  for (i = 0; i < 240 * 8 && !stroh; i++) { fh.aktualisiere(1 / 240, { gas: true, bremse: false }); fh.ereignisse.forEach(function (ev) { if (ev.typ === "scheune") rein = true; if (ev.typ === "stroh") stroh = ev; }); fh.ereignisse.length = 0; }
  pruefe(Sc && rein && stroh && Math.abs(stroh.x - Sc.x1) < 0.01 && keinTankScheune && fh.gelaende.scheunen.length === 5,
    "Scheune: " + fh.gelaende.scheunen.length + " im Level, hinein (Meldung), hinten hinaus fliegt Stroh, kein Kanister darin");
  // Obstplantage: Obst gibt ≈ 1 s Mini-Turbo (schwächer als die Rakete)
  var fo2 = neu("obstgarten", 1), Ob = fo2.gelaende.obst[0], vObst = 0, tObst = -1, vNach = 0;
  fo2.gelaende.h = fo2.gelaende.h.map(function () { return 0; });
  Ob.y = 0.95; FF.Physik.setzeAufBoden(fo2.fz, fo2.gelaende, Ob.x - 6, 0); fo2.fz.chassis.vx = 7; fo2.fz.raeder.forEach(function (R) { R.k.vx = 7; });
  for (i = 0; i < 240 * 3; i++) {
    fo2.aktualisiere(1 / 240, { gas: false, bremse: false });
    fo2.ereignisse.forEach(function (ev) { if (ev.typ === "obst") { tObst = fo2.zeit; vObst = fo2.fz.chassis.vx; } }); fo2.ereignisse.length = 0;
    if (tObst > 0 && fo2.zeit - tObst < 1.0) vNach = fo2.fz.chassis.vx;
  }
  pruefe(Ob.weg && tObst > 0 && vNach - vObst > 5 && fo2.miniZeit === 0 && fo2.gelaende.obst.length >= 10,
    "Obst: " + fo2.gelaende.obst.length + " im Level, Einsammeln gibt Mini-Turbo (" + vObst.toFixed(1) + " → " + vNach.toFixed(1) + " m/s in 1 s, ohne Gas)");
  // Röhrenwelt: regelmäßig Röhren; jedes Fahrzeug passt hinein, fährt durch und kommt am Boden heraus
  var fr = neu("roehren", 1), RS = fr.gelaende.roehren, abst = [];
  for (i = 1; i < RS.length; i++) abst.push(RS[i].x - (RS[i - 1].x + RS[i - 1].span));
  pruefe(RS.length >= 5 && Math.max.apply(null, abst) < 120 && Math.min.apply(null, abst) > 25, "Röhrenwelt: " + RS.length + " Röhren, dazwischen " + Math.round(Math.min.apply(null, abst)) + "–" + Math.round(Math.max.apply(null, abst)) + " m Gelände mit Hügeln");
  var Rmax = FF.GrafikWelt ? FF.GrafikWelt.ROEHRE_R : 1.85, ergebnisse = [];
  C.fahrzeuge.forEach(function (def) {
    var fz2 = new FF.Fahrt({ weltIndex: wi("roehren"), stufe: 1, fahrzeugId: def.id, upgrades: {}, schwierigkeit: "normal" });
    var R0 = fz2.gelaende.roehren[0], hoch = 0, lo = 0, hi = 0, drin = false, raus = null, loops = 0, mz0 = 0;
    fz2.fz.raeder.forEach(function (Rd) { lo = Math.min(lo, Rd.ankerY - Rd.L0 - Rd.r); });
    def.huelle.concat(def.dach || []).forEach(function (p) { hi = Math.max(hi, p[1]); });
    hi = Math.max(hi, def.kopf.y + def.kopf.r);
    FF.Physik.setzeAufBoden(fz2.fz, fz2.gelaende, R0.x - 8, 0); fz2.fz.chassis.vx = 6; fz2.fz.raeder.forEach(function (Rd) { Rd.k.vx = 6; });
    for (var k = 0; k < 240 * 20 && !raus; k++) {
      fz2.aktualisiere(1 / 240, { gas: true, bremse: false });
      if (fz2.roehre && !drin) { drin = true; mz0 = fz2.muenzen; }
      if (fz2.roehre) hoch = Math.max(hoch, fz2.fz.chassis.y - fz2.gelaende.hoeheBei(R0.x));
      fz2.ereignisse.forEach(function (ev) { if (ev.typ === "roehrenLoop") loops++; if (ev.typ === "roehreAus") raus = { x: fz2.fz.chassis.x, vx: fz2.fz.chassis.vx, a: fz2.fz.chassis.a }; });
      fz2.ereignisse.length = 0;
    }
    for (k = 0; k < 240 * 1.5; k++) fz2.aktualisiere(1 / 240, { gas: true, bremse: false });
    ergebnisse.push({ id: def.id, passt: hi - lo < 2 * Rmax, drin: drin, raus: !!raus && Math.abs(raus.x - (R0.x + R0.span)) < 1 && raus.vx > 6 && Math.abs(raus.a) < 0.05,
                      loops: loops === R0.pfad.loops.length && loops > 0, muenzen: fz2.muenzen - mz0 > 0, weiter: fz2.hoppla === 0 && fz2.fz.chassis.x > R0.x + R0.span + 8, hoch: hoch });
  });
  var schlecht = ergebnisse.filter(function (e) { return !(e.passt && e.drin && e.raus && e.loops && e.muenzen && e.weiter); });
  pruefe(!schlecht.length, "Röhre: alle " + ergebnisse.length + " Fahrzeuge passen hinein (Ø " + (2 * Rmax).toFixed(1) + " m), fahren bis " +
    Math.round(Math.max.apply(null, ergebnisse.map(function (e) { return e.hoch; }))) + " m hoch, zählen die Loopings, sammeln Münzen und kommen am Boden heraus", schlecht);
  console.log(fehler ? fehler + " Test(s) fehlgeschlagen." : "Alle Spielideen-Tests bestanden.");
  return fehler;
}

/* Spielstand-Code: alles kommt genau so zurück, Fehler werden erkannt */
function spielstandTests() {
  var fehler = 0, C = FF.CONFIG, SP = FF.Spielstand;
  function pruefe(bed, text) { console.log((bed ? "✓ " : "✗ ") + text); if (!bed) fehler++; }
  function sortiert(o) { return JSON.stringify(o, function (k, v) { return v && typeof v === "object" && !Array.isArray(v) ? Object.keys(v).sort().reduce(function (a, kk) { a[kk] = v[kk]; return a; }, {}) : v; }); }
  var S = SP.neuerSpielstand(), z = FF.zufallsQuelle(7);
  C.kinder.forEach(function (k, ki) {
    var p = S.spieler[k.id];
    p.muenzen = Math.floor(z() * 200000);
    C.fahrzeuge.forEach(function (f, fi) {
      var fs = p.fahrzeuge[f.id]; fs.gekauft = fs.gekauft || z() < 0.6;
      if (fs.gekauft) { fs.upgrades = { motor: 1 + fi % 5, reifen: fi % 6 }; if (z() < 0.5) fs.upgrades.allrad = 1; fs.farbe = C.farben[fi].id; fs.muster = C.muster[fi % C.muster.length].id; }
      if (fs.gekauft && !fs.upgrades.reifen) delete fs.upgrades.reifen;
    });
    p.fahrzeug = "moped"; p.fahrzeuge.moped.gekauft = true;
    p.farben = C.farben.map(function (f) { return f.id; });
    p.muster.push("sterne"); p.outfits.push("schild"); p.outfit = "schild"; p.look = ki ? "lang" : "cap";
    p.spuren.push("regenbogen"); p.spur = "regenbogen";
    p.felgen.push("gold", "neon"); p.felge = "neon"; p.beifahrerListe.push("dino"); p.beifahrer = "dino";
    C.welten.forEach(function (w, wi) {
      for (var l = 1; l <= 4; l++) if (z() < 0.8) p.level[w.id + "-" + l] = { geschafft: true, sterne: 1 + Math.floor(z() * 3) };
      if (z() < 0.5) p.endlos[w.id] = Math.floor(z() * 9000) + 1;
    });
    p.freigeschaltet = ["mond", "vulkan"];
    p.statistik = { fahrten: 321, meter: 4567890, salti: 999, muenzen: 7654321 };
    S.duell.siege[k.id] = 4 + ki;
  });
  S.aktiv = "jonte";
  var code = SP.codeErzeugen(S);
  pruefe(/^[0-9A-Z-]+$/.test(code), "Code besteht nur aus 0–9, A–Z und Bindestrichen (" + code.replace(/-/g, "").length + " Zeichen)");
  var r = SP.codeLesen(code.toLowerCase().replace(/-/g, " ").replace(/0/g, "o"), S);
  var vorher = SP.lade(SP.alsText(S));
  pruefe(r.ok && sortiert(r.stand.spieler) === sortiert(vorher.spieler), "Code hin und zurück: beide Profile genau gleich (Kleinbuchstaben, O statt 0, Leerzeichen egal)");
  pruefe(r.ok && r.stand.aktiv === "jonte" && r.stand.duell.siege.jonte === 5, "Aktives Kind und Duell-Siege kommen mit");
  var falsch = 0, kurz = SP.codeLesen(code.slice(0, -5));
  for (var i = 0; i < code.length; i++) {
    if (code[i] === "-") continue;
    var c = code.slice(0, i) + (code[i] === "7" ? "8" : "7") + code.slice(i + 1);
    if (!SP.codeLesen(c).ok) falsch++;
  }
  var anzahl = code.replace(/-/g, "").length;
  pruefe(falsch >= anzahl - 1 && !kurz.ok, "Ein falsches Zeichen (" + falsch + " von " + anzahl + " Stellen) oder ein abgeschnittener Code wird erkannt");
  pruefe(!SP.codeLesen("HALLO").ok && !SP.codeLesen("").ok, "Unsinn wird abgelehnt");
  console.log(fehler ? fehler + " Test(s) fehlgeschlagen." : "Alle Spielstand-Tests bestanden.");
  return fehler;
}

if (arg("physik", false)) { physikTests(); process.exit(0); }
if (arg("spielstand", false)) { process.exit(spielstandTests() ? 1 : 0); }
if (arg("spielideen", false)) { process.exit(spielideenTests() ? 1 : 0); }
if (arg("geist", false)) { process.exit(geistTests() ? 1 : 0); }

if (arg("vergleich", false)) {
  console.log("Fahrzeug: " + fahrzeugId + ", Upgrades: " + upgradeArg + ", Schwierigkeit: " + schwierigkeit);
  console.log("Welt/Level          | Profi: Ergebnis ⭐ Hoppla Tank Sprünge GasWeg Bremse | Kind: Ergebnis Hoppla | Loslassen: Ergebnis Hoppla | Vollgas: Ergebnis Hoppla");
  var summe = { profi: 0, kind: 0, los: 0, vollgas: 0, n: 0, hpProfi: 0, hpLos: 0, hpVoll: 0, n2: 0, los2: 0 };
  FF.CONFIG.welten.forEach(function (welt, wi) {
    if (nurWelt !== null && +nurWelt !== wi) return;
    welt.level.forEach(function (lv, li) {
      var upg2 = upgradesFuer(wi);
      var p = fahre(wi, li, fahrzeugId, upg2, 400, "profi"), k = fahre(wi, li, fahrzeugId, upg2, 400, "kind"),
          l = fahre(wi, li, fahrzeugId, upg2, 400, "loslassen"), v = fahre(wi, li, fahrzeugId, upg2, 400, "vollgas");
      var erg = function (e) { return e.fehler ? "NaN!" : (e.ziel ? "ZIEL" : (e.zeitAbbruch ? "Zeit" : e.strecke + "m")); };
      var bd = p.statistik.boden || 1;
      console.log((welt.name + " " + (li + 1)).padEnd(20) + "| " + erg(p).padStart(6) + " " + String(p.sterne).padStart(1) + " " +
        String(p.hoppla).padStart(6) + " " + (Math.round(p.minTank * 100) + "%").padStart(4) + " " + String(p.spruenge).padStart(7) + " " +
        (Math.round(p.statistik.gasWeg / bd * 100) + "%").padStart(6) + " " + (Math.round(p.statistik.bremse / bd * 100) + "%").padStart(6) +
        " | " + erg(k).padStart(6) + " " + String(k.hoppla).padStart(6) + " | " + erg(l).padStart(6) + " " + String(l.hoppla).padStart(6) +
        " | " + erg(v).padStart(6) + " " + String(v.hoppla).padStart(6));
      summe.n++; if (p.ziel) summe.profi++; if (k.ziel) summe.kind++; if (l.ziel) summe.los++; if (v.ziel) summe.vollgas++;
      summe.hpProfi += p.hoppla; summe.hpLos += l.hoppla; summe.hpVoll += v.hoppla;
      if (li > 0) { summe.n2++; if (l.ziel) summe.los2++; }
    });
  });
  console.log("Im Ziel: Profi " + summe.profi + "/" + summe.n + ", Kind " + summe.kind + "/" + summe.n + ", Loslassen " + summe.los + "/" + summe.n +
              ", Vollgas " + summe.vollgas + "/" + summe.n + " · Hoppla gesamt: Profi " + summe.hpProfi + ", Loslassen " + summe.hpLos + ", Vollgas " + summe.hpVoll +
              " · Loslassen in Level 2–4: " + summe.los2 + "/" + summe.n2);
  process.exit(0);
}

console.log("Fahrzeug: " + fahrzeugId + ", Upgrades: " + upgradeArg + ", Fahrer: " + fahrerArt + ", Schwierigkeit: " + schwierigkeit);
console.log("Welt/Level         Länge  Ergebnis   Strecke  Zeit   Münzen/Gesamt  Anteil  Sterne  Salti  Hoppla  minTank  Kanister");
FF.CONFIG.welten.forEach(function (welt, wi) {
  if (nurWelt !== null && +nurWelt !== wi) return;
  welt.level.forEach(function (lv, li) {
    var e = fahre(wi, li, fahrzeugId, upgradesFuer(wi));
    if (e.fehler) { console.log(welt.name + " " + (li + 1) + ": " + e.fehler); return; }
    console.log(
      (welt.name + " " + (li + 1)).padEnd(18) +
      String(e.laenge).padStart(5) + "  " +
      (e.ziel ? "ZIEL ✓" : (e.zeitAbbruch ? "Zeit?!" : "leer  ")).padEnd(9) +
      String(e.strecke).padStart(7) + "  " +
      e.zeit.toFixed(0).padStart(4) + "s  " +
      (e.muenzen + "/" + e.wertGesamt).padStart(13) + "  " +
      (Math.round(e.anteil * 100) + "%").padStart(6) + "  " +
      String(e.sterne).padStart(6) + "  " +
      String(e.salti).padStart(5) + "  " +
      String(e.hoppla).padStart(6) + "  " +
      (Math.round(e.minTank * 100) + "%").padStart(7) + "  " +
      String(e.tanks).padStart(8)
    );
  });
});
