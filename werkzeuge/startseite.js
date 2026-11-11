#!/usr/bin/env node
/* ===========================================================================
   Fiete Flitzer – werkzeuge/startseite.js
   ---------------------------------------------------------------------------
   Sucht für die Startseiten-Show je Welt die schönste Szene: Der Show-Fahrer
   (roboter.js) fährt jede Welt mit vielen Fahrzeugen und Leveln ab; bewertet
   wird jedes 8-Sekunden-Fenster (Saltos, Loopings, Röhren, Katapulte,
   Hüpfpilze … gut; Ballon-Hilfe, Stillstand schlecht). Die besten Szenen
   landen in startseite-szenen.js.

   Weil Fahrt + Physik deterministisch sind und die Startseite mit festen
   1/60-s-Schritten rechnet, fährt das Spiel im Browser genau diese Szene nach.

   Aufruf:
     node werkzeuge/startseite.js            neu berechnen (dauert einige Minuten)
     node werkzeuge/startseite.js --pruefen  nur prüfen, ob die Szenen noch passen
                                             (nach Änderungen an Physik/Gelände!)
   =========================================================================== */
"use strict";

var fs = require("fs"), path = require("path"), vm = require("vm");
var basis = path.join(__dirname, "..");
["config.js", "gelaende.js", "physik.js", "fahrt.js", "roboter.js"].forEach(function (d) {
  vm.runInThisContext(fs.readFileSync(path.join(basis, d), "utf8"), { filename: d });
});
var FF = globalThis.FF, C = FF.CONFIG;

var DT = 1 / 60, DAUER = 8, MAX_VORLAUF = 20, UPGRADES = { motor: 3, reifen: 3, federung: 3, tank: 5, kreisel: 3, bremse: 2 };
var LEVEL = [0, 1, 2];

/* Passende Fahrzeuge je Welt (erstes = Lieblingswahl) – die übrigen werden auch probiert */
var THEMA = {
  wiese: ["flitzer", "seifenkiste"], wueste: ["monster", "lkw"], baustelle: ["lkw", "traktor"], schnee: ["schlitten", "monster"],
  mond: ["mond", "eauto"], bonbon: ["badewanne", "seifenkiste"], dschungel: ["kettenwagen", "monster"], urzeit: ["monster", "kettenwagen"],
  vulkan: ["feuerkutsche", "monster"], achterbahn: ["renner", "seifenkiste"], regenbogen: ["teppich", "flugzeug"],
  freizeitpark: ["bus", "scooter"], hoehle: ["eauto", "kettenwagen"], pfuetzen: ["luftkissen", "monster"], garten: ["seifenkiste", "scooter"],
  herbst: ["moped", "traktor"], meer: ["wasserstoff", "luftkissen"], nacht: ["eauto", "moped"], fabrik: ["dampflok", "lkw"],
  mars: ["mond", "kettenwagen"], station: ["eauto", "renner"], glas: ["renner", "flitzer"], bausteine: ["traktor", "monster"],
  gebirge: ["traktor", "kettenwagen"], geister: ["sofa", "bus"], katapult: ["flitzer", "seifenkiste"], bauernhof: ["traktor", "moped"],
  obstgarten: ["scooter", "skateboard"], roehren: ["skateboard", "renner"], kopfueber: ["renner", "flitzer"], helden: ["flitzer", "renner"],
  schleim: ["badewanne", "monster"], wolken: ["flugzeug", "teppich"], zirkus: ["moped", "scooter"], daten: ["eauto", "renner"],
  chemie: ["badewanne", "wasserstoff"]
};

/* Punkte für Ereignisse im Fenster */
var PUNKTE = { salto: 7, looping: 7, roehre: 5, roehrenLoop: 3, katapult: 6, boing: 4, zelle: 6, umdrehen: 6, schwebe: 4,
               stroh: 5, scheune: 1, objekt: 1.5, platsch: 1, obst: 1.2, katze: 2, wind: 0.5, band: 1, luftsprung: 1.5, landung: 0.3,
               portal: 9, ladebalkenFertig: 4, ladebalken: 2 };
var DECKEL = { objekt: 5, platsch: 3, obst: 4, landung: 1.5, luftsprung: 3 };

function zufallAus(seed) { var s = seed % 2147483646 + 1; return function () { s = s * 16807 % 2147483647; return (s - 1) / 2147483646; }; }

/* Eine Fahrt aufzeichnen: je Bild Tempo, Luft, Ereignisse */
function aufzeichnen(wi, fzId, stufe, seed, sekunden) {
  var f = new FF.Fahrt({ weltIndex: wi, stufe: stufe, fahrzeugId: fzId, upgrades: UPGRADES, schwierigkeit: "normal" });
  var fahrer = FF.Roboter.show(zufallAus(seed)), bilder = [];
  for (var i = 0; i < sekunden * 60; i++) {
    f.aktualisiere(DT, fahrer.eingabe(f, DT));
    var st = f.fz.status;
    bilder.push({ v: st.tempo, luft: FF.Roboter.inDerLuft(st), ev: f.ereignisse.map(function (e) { return e.typ === "salto" ? "salto" + (e.anzahl || 1) : e.typ; }),
                  hilfe: f.zustand === "hilfe", ende: f.zustand === "ende" || f.zustand === "ziel" });
    f.ereignisse.length = 0;
    if (!isFinite(f.fz.chassis.x)) break;
    if (f.zustand === "ende") break;
  }
  return bilder;
}

function bewerte(bilder, a) {
  var n = DAUER * 60, e = a + n;
  if (e > bilder.length) return null;
  if (bilder[a].v < 3 || bilder[a].hilfe) return null;               // mitten in der Fahrt beginnen
  var p = 0, zaehl = {}, luft = 0, vSumme = 0, still = 0, hilfe = false;
  for (var i = a; i < e; i++) {
    var B = bilder[i];
    if (B.ende) return null;
    if (B.hilfe) hilfe = true;
    if (B.luft) luft += DT;
    vSumme += B.v;
    if (B.v < 1.5 && !B.hilfe) still += DT;
    B.ev.forEach(function (t) {
      var anz = 1;
      if (t.indexOf("salto") === 0) { anz = +t.slice(5); t = "salto"; }
      if (!PUNKTE[t]) return;
      zaehl[t] = (zaehl[t] || 0) + PUNKTE[t] * anz;
    });
  }
  Object.keys(zaehl).forEach(function (t) { p += DECKEL[t] ? Math.min(DECKEL[t], zaehl[t]) : zaehl[t]; });
  p += 1.2 * Math.min(4, luft) + 0.15 * vSumme / n - 3 * still - (hilfe ? 10 : 0);
  return { punkte: p, zaehl: zaehl, luft: luft, hilfe: hilfe };
}

function besteFenster(bilder) {
  var best = null;
  for (var a = 90; a <= MAX_VORLAUF * 60; a += 15) {                 // Vorlauf 1,5 … 20 s, Raster 0,25 s
    var b = bewerte(bilder, a);
    if (b && (!best || b.punkte > best.punkte)) { best = b; best.vorlauf = a; }
  }
  return best;
}

function kandidatenFuer(wi) {
  var w = C.welten[wi], lieb = THEMA[w.id] || [], liste = [];
  C.fahrzeuge.forEach(function (fz, k) {
    LEVEL.forEach(function (stufe) {
      var seed = 1000 + wi * 97 + k * 13 + stufe * 7;
      var bilder = aufzeichnen(wi, fz.id, stufe, seed, MAX_VORLAUF + DAUER + 1);
      var b = besteFenster(bilder);
      if (!b) return;
      var bonus = lieb[0] === fz.id ? 4 : lieb[1] === fz.id ? 2 : 0;
      liste.push({ welt: w.id, fahrzeug: fz.id, stufe: stufe, seed: seed, vorlauf: b.vorlauf, punkte: b.punkte + bonus, roh: b });
    });
  });
  liste.sort(function (x, y) { return y.punkte - x.punkte; });
  return liste.slice(0, 8);
}

function schreibe(szenen) {
  var zeilen = szenen.map(function (s) {
    return '    { welt: "' + s.welt + '", fahrzeug: "' + s.fahrzeug + '", stufe: ' + s.stufe + ", seed: " + s.seed + ", vorlauf: " + s.vorlauf + " }";
  });
  var text = "/* ===========================================================================\n" +
    "   Fiete Flitzer – startseite-szenen.js  (ERZEUGT von werkzeuge/startseite.js)\n" +
    "   ---------------------------------------------------------------------------\n" +
    "   Je Welt eine Szene für die Startseiten-Show: Fahrzeug, Level, Zufalls-Seed des\n" +
    "   Show-Fahrers und Vorlauf (so viele 1/60-s-Schritte wird unsichtbar vorgefahren,\n" +
    "   dann sieht man " + DAUER + " Sekunden). Nicht von Hand ändern – neu erzeugen.\n" +
    "   =========================================================================== */\n" +
    "var FF = globalThis.FF = globalThis.FF || {};\n\n" +
    "FF.STARTSEITE = {\n  dauer: " + DAUER + ",\n  upgrades: " + JSON.stringify(UPGRADES).replace(/"/g, "").replace(/,/g, ", ").replace(/:/g, ": ") + ",\n  szenen: [\n" +
    zeilen.join(",\n") + "\n  ]\n};\n";
  fs.writeFileSync(path.join(basis, "startseite-szenen.js"), text);
}

function pruefen() {
  vm.runInThisContext(fs.readFileSync(path.join(basis, "startseite-szenen.js"), "utf8"));
  var fehler = 0;
  FF.STARTSEITE.szenen.forEach(function (s) {
    var wi = C.welten.findIndex(function (w) { return w.id === s.welt; });
    var bilder = aufzeichnen(wi, s.fahrzeug, s.stufe, s.seed, s.vorlauf / 60 + DAUER + 0.5);
    var b = bewerte(bilder, s.vorlauf);
    var ok = b && !b.hilfe && b.punkte > 3;
    if (!ok) fehler++;
    console.log((ok ? "ok    " : "FEHLER") + "  " + s.welt + " / " + s.fahrzeug + " L" + (s.stufe + 1) + "  " + (b ? b.punkte.toFixed(1) + " P  " + JSON.stringify(b.zaehl) : "—"));
  });
  console.log(fehler ? fehler + " Szene(n) passen nicht mehr → node werkzeuge/startseite.js" : "Alle Szenen passen.");
  process.exitCode = fehler ? 1 : 0;
}

if (process.argv.indexOf("--pruefen") >= 0) { pruefen(); return; }
/* --zusammen a.json b.json …: Teilergebnisse (aus --teil i/n --json datei) zusammenführen */
if (process.argv.indexOf("--zusammen") >= 0) {
  var gesamt = {};
  process.argv.slice(process.argv.indexOf("--zusammen") + 1).forEach(function (d) { Object.assign(gesamt, JSON.parse(fs.readFileSync(d, "utf8"))); });
  zusammenfuehren(gesamt);
  return;
}

/* Kandidaten je Welt (optional nur ein Teil: --teil 0/2 für paralleles Rechnen) */
var teilArg = process.argv.indexOf("--teil"), teil = teilArg > 0 ? process.argv[teilArg + 1].split("/").map(Number) : [0, 1];
var ergebnisDatei = process.argv.indexOf("--json") > 0 ? process.argv[process.argv.indexOf("--json") + 1] : null;
var alle = {};
C.welten.forEach(function (w, wi) {
  if (wi % teil[1] !== teil[0]) return;
  alle[w.id] = kandidatenFuer(wi);
  var b = alle[w.id][0];
  console.error(w.id + ": " + (b ? b.fahrzeug + " L" + (b.stufe + 1) + " ab " + (b.vorlauf / 60).toFixed(1) + " s, " + b.punkte.toFixed(1) + " P " + JSON.stringify(b.roh.zaehl) : "—"));
});
if (ergebnisDatei) { fs.writeFileSync(ergebnisDatei, JSON.stringify(alle)); return; }
zusammenfuehren(alle);

function zusammenfuehren(alleK) {
  /* Abwechslung: dasselbe Fahrzeug in mehreren Welten kostet Punkte */
  var benutzt = {}, szenen = [];
  C.welten.forEach(function (w) {
    var k = alleK[w.id] || [];
    var best = null, bestP = -1e9;
    k.forEach(function (s) { var p = s.punkte - 5 * (benutzt[s.fahrzeug] || 0); if (p > bestP) { bestP = p; best = s; } });
    if (!best || best.roh.hilfe || best.punkte < 2) { console.error("  (keine gute Szene für " + w.id + ")"); return; }
    benutzt[best.fahrzeug] = (benutzt[best.fahrzeug] || 0) + 1;
    szenen.push(best);
  });
  schreibe(szenen);
  console.error(szenen.length + " Szenen → startseite-szenen.js");
}
module.exports = { zusammenfuehren: zusammenfuehren };
