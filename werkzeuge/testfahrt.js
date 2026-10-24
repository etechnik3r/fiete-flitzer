#!/usr/bin/env node
/* ===========================================================================
   Fiete Flitzer – werkzeuge/testfahrt.js
   ---------------------------------------------------------------------------
   Ein kleiner Roboter-Fahrer fährt alle Level ohne Browser ab. So lässt sich
   prüfen, ob die Level schaffbar sind und die Benzinkanister passen.

   Aufruf:
     node werkzeuge/testfahrt.js                 alle Welten, Flitzer ohne Upgrades
     node werkzeuge/testfahrt.js --upgrade 3     alle Upgrades auf Stufe 3
     node werkzeuge/testfahrt.js --fahrzeug monster --welt 3
     node werkzeuge/testfahrt.js --physik        Physik-Plausibilitätstests
     node werkzeuge/testfahrt.js --geist         Geisterrennen: Aufnahme, Wiedergabe, Sieger

   Der Bot gibt Vollgas, nimmt Gas weg, wenn die Nase zu weit hochgeht, und
   richtet das Auto in der Luft gerade aus – ungefähr wie ein geübtes Kind.
   =========================================================================== */
"use strict";

var fs = require("fs");
var path = require("path");
var vm = require("vm");

var basis = path.join(__dirname, "..");
["config.js", "gelaende.js", "physik.js", "fahrt.js", "geist.js"].forEach(function (datei) {
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
var upgradeStufe = +arg("upgrade", 0);
var fahrzeugId = arg("fahrzeug", "flitzer");
var nurWelt = arg("welt", null);
var schwierigkeit = arg("schwierigkeit", "normal");

/* ---------- Bot ---------- */
var kindModus = arg("kind", false);

/* "Kind": gibt am Boden immer Vollgas und steuert in der Luft nur grob */
function kindEingabe(f) {
  var C = f.fz.chassis, st = f.fz.status;
  var a = FF.normWinkel(C.a);
  var inLuft = st.radKontakte === 0 && !st.huellKontakt;
  if (inLuft && a > 0.9) return { gas: false, bremse: true };
  if (inLuft && a < -0.9) return { gas: true, bremse: false };
  return { gas: true, bremse: false };
}

function botEingabe(f) {
  if (kindModus) return kindEingabe(f);
  var fz = f.fz, C = fz.chassis, st = fz.status;
  var a = FF.normWinkel(C.a);
  var boden = Math.atan(f.gelaende.steigungBei(C.x));
  var rel = FF.normWinkel(a - boden);
  var inLuft = st.radKontakte === 0 && !st.huellKontakt;
  if (inLuft) {
    if (a > 0.25) return { gas: false, bremse: true };
    if (a < -0.25) return { gas: true, bremse: false };
    return { gas: false, bremse: false };
  }
  if (rel > 0.75) return { gas: false, bremse: rel > 1.0 };
  return { gas: true, bremse: false };
}

function fahre(weltIndex, stufe, fzId, upg, maxZeit) {
  var f = new FF.Fahrt({ weltIndex: weltIndex, stufe: stufe, fahrzeugId: fzId, upgrades: upg, schwierigkeit: schwierigkeit });
  var dt = 1 / 60, minTank = 1, tanks = 0;
  maxZeit = maxZeit || 400;
  while (f.zustand !== "ende" && f.zeit < maxZeit) {
    f.aktualisiere(dt, botEingabe(f));
    if (f.tank < minTank) minTank = f.tank;
    for (var i = 0; i < f.ereignisse.length; i++) if (f.ereignisse[i].typ === "tank") tanks++;
    f.ereignisse.length = 0;
    if (!isFinite(f.fz.chassis.x) || !isFinite(f.fz.chassis.y)) { return { fehler: "NaN!" }; }
  }
  var e = f.ergebnis();
  e.minTank = minTank; e.tanks = tanks; e.zeitAbbruch = f.zeit >= maxZeit;
  e.wertGesamt = f.gelaende.muenzWertGesamt;
  e.laenge = f.gelaende.ziel;
  return e;
}

function upgradesAlle(stufe) {
  return { motor: stufe, reifen: stufe, federung: stufe, tank: stufe, allrad: stufe >= 4 ? 1 : 0 };
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
  var echt = [];
  while (f.zustand !== "ende" && f.zeit < 200) {
    f.aktualisiere(1 / 60, botEingabe(f));
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
if (arg("physik", false)) { physikTests(); process.exit(0); }
if (arg("geist", false)) { process.exit(geistTests() ? 1 : 0); }

var upg = upgradesAlle(upgradeStufe);
console.log("Fahrzeug: " + fahrzeugId + ", Upgrades: Stufe " + upgradeStufe + ", Schwierigkeit: " + schwierigkeit);
console.log("Welt/Level         Länge  Ergebnis   Strecke  Zeit   Münzen/Gesamt  Anteil  Sterne  Salti  Hoppla  minTank  Kanister");
FF.CONFIG.welten.forEach(function (welt, wi) {
  if (nurWelt !== null && +nurWelt !== wi) return;
  welt.level.forEach(function (lv, li) {
    var e = fahre(wi, li, fahrzeugId, upg);
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
