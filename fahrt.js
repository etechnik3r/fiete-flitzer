/* ===========================================================================
   Fiete Flitzer – fahrt.js
   ---------------------------------------------------------------------------
   Die Spielregeln EINER Fahrt (unabhängig von Grafik, Ton und Menüs):
     • Pedale → Motor/Bremse/Rückwärtsgang an den Rädern
     • Tankverbrauch, Benzinkanister, Münzen einsammeln
     • Luftsteuerung, Saltos und Luftsprünge erkennen
     • Überschlag = "Hoppla!" → ein Ballon stellt das Auto wieder hin
       (kein Game Over, nur etwas Benzin weg – kindgerecht)
     • Bruchlandung: nach einem Sprung zu schief zum Hang gelandet → ebenso
       Ballon-Hilfe (siehe CONFIG.schwierigkeit.bruchWinkel)
     • Ziel erreicht / Tank leer → Ergebnis
     • Besondere Welten: Pfützen (bremsen, spritzen), Hüpfpilze (Trampolin),
       Sturm (Meldung bei Rücken-/Gegenwind; die Kraft selbst rechnet physik.js)

   Was passiert, wird als Ereignis in fahrt.ereignisse gemeldet
   (z. B. {typ:"muenze", wert:5}); spiel.js macht daraus Ton und Effekte.

   Kein Browser nötig: wird auch von werkzeuge/testfahrt.js (Node) benutzt.
   =========================================================================== */

var FF = globalThis.FF = globalThis.FF || {};

(function () {
  "use strict";

  var ZWEI_PI = Math.PI * 2;

  function normWinkel(a) {
    a = (a + Math.PI) % ZWEI_PI;
    if (a < 0) a += ZWEI_PI;
    return a - Math.PI;
  }

  function fahrzeugDef(id) {
    var liste = FF.CONFIG.fahrzeuge;
    for (var i = 0; i < liste.length; i++) if (liste[i].id === id) return liste[i];
    return liste[0];
  }

  /* Basiswerte + Upgrades + Schwierigkeit → wirksame Fahrzeugwerte */
  function berechneWerte(def, upg, schwierigkeitId) {
    var U = FF.CONFIG.upgradeWirkung;
    var S = FF.CONFIG.schwierigkeit[schwierigkeitId] || FF.CONFIG.schwierigkeit.normal;
    upg = upg || {};
    var w = JSON.parse(JSON.stringify(def));
    var m = upg.motor || 0, re = upg.reifen || 0, fe = upg.federung || 0, ta = upg.tank || 0;
    w.motor.drehmoment *= 1 + U.motorDrehmoment * m;
    w.motor.vmax *= 1 + U.motorTempo * m;
    w.grip += U.reifenGrip * re;
    w.federung.daempfung += U.federDaempfung * fe;
    w.federung.weg *= 1 + U.federWeg * fe;
    w.tankSekunden *= (1 + U.tank * ta) * S.tank;
    // Version 32: Luft-Kreisel, Spoiler, Bremsen, Leichtbau
    var kr = upg.kreisel || 0, sp = upg.spoiler || 0, br = upg.bremse || 0, lb = def.upgrades && def.upgrades.indexOf("leichtbau") < 0 ? 0 : upg.leichtbau || 0;
    if (w.maxDrehung) w.maxDrehung *= 1 + U.kreisel * kr * 0.5;           // Zug: auch etwas schneller drehen
    w.abtrieb = (w.abtrieb || 0) + U.spoilerAbtrieb * sp;
    w.motor.vmax *= 1 + U.spoilerTempo * sp;
    w.bremse *= 1 + U.bremse * br;
    w.rueckMal = 1 + U.rueckwaerts * br;
    w.masse *= 1 - U.leichtbau * lb;
    w.spoiler = sp;                                                         // für die Grafik
    w.kreisel = kr;
    if (upg.allrad) w.raeder.forEach(function (r) { r.antrieb = true; });
    if (w.wanne) w.wanne.schub *= 1 + 0.6 * U.motorDrehmoment * m;          // Badewanne: Motor-Upgrade = kräftigerer Strahl
    if (w.propeller) {                                                      // Schlitten: Motor-Upgrade = stärkerer Propeller
      w.propeller.schub *= 1 + 0.6 * U.motorDrehmoment * m;
      w.propeller.vmax *= 1 + U.motorTempo * m;
    }
    w.luftsteuerung *= S.luftsteuerung;
    w.stabilisator = S.stabilisator;
    return w;
  }

  /* -------------------------------------------------------------------------
     Virtuelles Getriebe – für Drehzahlmesser und Motorklang (klang.js)
     Gang nach Fahrtempo (mit Hysterese), Motordrehzahl aus der Raddrehzahl,
     beim Anfahren schleift die Kupplung. Elektromotoren haben einen Gang.
     klang = Klang-Profil des Fahrzeugs (leerlauf, max, gaenge, traegheit, art)
     ------------------------------------------------------------------------- */
  function Getriebe(klang) {
    this.P = klang || {};
    this.elektro = this.P.art === "elektro";
    this.turbine = this.P.art === "turbine" || this.P.art === "propeller" || this.P.art === "wasser";   // Drehzahl folgt dem Hochlaufen, nicht den Rädern
    this.propeller = this.P.art === "propeller";
    this.dampf = this.P.art === "dampf";                // Dampfmaschine: kein Getriebe, Drehzahl = Raddrehzahl
    this.gaenge = this.elektro || this.dampf ? 1 : (this.P.gaenge || 4);
    this.leerlauf = this.elektro ? 0 : (this.P.leerlauf || 800);
    this.max = this.P.max || (this.elektro ? 12000 : 6000);
    if (this.turbine) { this.gaenge = 1; this.leerlauf = this.P.leerlauf || 8000; }
    if (this.dampf) { this.leerlauf = 0; this.max = this.P.max || 400; }
    this.gang = 1; this.schaltZeit = 0;
    this.rf = 0;                  // Drehzahl relativ zur Höchstdrehzahl im Gang (> 1: Begrenzer)
    this.schalten = false; this.begrenzer = false;
    this.rpm = 0;                 // Motordrehzahl [U/min], mit Trägheit
  }
  /* r = Raddrehzahl/Höchstdrehzahl, v = Tempo/vmax, gas 0..1, boden, laeuft, dt [s] */
  Getriebe.prototype.schritt = function (r, v, gas, boden, laeuft, dt) {
    var G = this.gaenge;
    function gangOben(k) { return Math.pow(k / G, 0.8); }
    this.schaltZeit = Math.max(0, this.schaltZeit - dt);
    if (this.gang < G && v > 0.9 * gangOben(this.gang) && boden) { this.gang++; this.schaltZeit = 0.13; }
    else if (this.gang > 1 && v < 0.62 * gangOben(this.gang - 1)) { this.gang--; this.schaltZeit = 0.08; }
    var rf = r / gangOben(this.gang);
    if (this.gang === 1 && !this.elektro && !this.dampf) rf = Math.max(rf, gas * 0.42);   // Kupplung schleift beim Anfahren
    this.rf = rf;
    this.schalten = this.schaltZeit > 0;
    this.begrenzer = rf > 1 && gas > 0.5;
    var ziel = laeuft ? this.leerlauf + (this.max - this.leerlauf) * Math.min(1, rf) : 0;
    var tr = !laeuft ? 2.5 : this.begrenzer ? 30 : (this.P.traegheit || 10);
    this.rpm += (ziel - this.rpm) * Math.min(1, dt * tr);
    return this;
  };

  /* -------------------------------------------------------------------------
     Fahrt
     o = { weltIndex, stufe (0..3), endlos, fahrzeugId, upgrades, schwierigkeit, strecke }
     ------------------------------------------------------------------------- */
  function Fahrt(o) {
    var C = FF.CONFIG;
    this.weltIndex = o.weltIndex;
    this.gasBremseAlt = !!o.gasBremseAlt;     // Entwickler: alte Wirkung von Gas + Bremse zugleich
    this.welt = C.welten[o.weltIndex];
    this.endlos = !!o.endlos;
    this.stufe = o.stufe || 0;
    var lv = this.endlos ? null : this.welt.level[this.stufe];
    this.strecke = o.strecke || null;              // selbst gemalt (Strecken-Editor): { dx, h, laenge }
    if (this.strecke) { this.endlos = false; lv = { laenge: this.strecke.laenge, seed: 4242 }; }
    this.gelaende = new FF.Gelaende(this.welt, {
      endlos: this.endlos, stufe: this.stufe,
      laenge: lv ? lv.laenge : 0,
      seed: lv ? lv.seed : (o.seed || 9000 + o.weltIndex * 31),
      strecke: this.strecke
    });
    this.def = fahrzeugDef(o.fahrzeugId);
    this.werte = berechneWerte(this.def, o.upgrades, o.schwierigkeit);
    this.schw = C.schwierigkeit[o.schwierigkeit] || C.schwierigkeit.normal;
    this.bruchAn = o.bruchlandung !== false;   // Einstellung „Bruchlandung“ (aus: Auto prallt ab und fährt weiter)
    this.fz = FF.Physik.baueFahrzeug(this.werte, 0, this.gelaende);
    this.zugHinten = FF.Physik.zugHinten(this.werte);   // Zug (Dampf-Lok): so weit [m] reicht er hinter die Lok

    var rSumme = 0, nA = 0;
    this.fz.raeder.forEach(function (R) { if (R.antrieb) { rSumme += R.r; nA++; } });
    this.nAntrieb = nA;
    this.eck = this.werte.motor.eck || C.steuerung.eckDrehzahl;
    this.leistungMax = this.werte.motor.drehmoment * this.eck * this.werte.motor.vmax / (rSumme / nA);
    this.geladen = 0;              // Elektroauto: durch Bremsen zurückgewonnen (Anteil Akku)
    this.getriebe = new Getriebe(this.def.klang);

    this.tank = 1;
    this.gas = 0; this.bremse = 0; this.rueckwaerts = false;
    this.muenzen = 0; this.bonus = 0;
    this.salti = 0; this.hoppla = 0; this.besteLuftzeit = 0;
    this.zeit = 0; this.strecke = 0; this.akku = 0; this.kopf = false;
    this.zustand = "fahrt";        // fahrt | hilfe | ziel | ende
    this.grund = null;             // "ziel" | "leer"
    this.ereignisse = [];
    this.luftZeit = 0; this.luftDrehung = 0; this.flug = null;
    this.leerZeit = 0; this.stillZeit = 0; this.liegeZeit = 0; this.seitenZeit = 0;
    this.klemmZeit = 0; this.letzterTipp = -99; this.festZeit = 0; this.weitesterX = 0;
    this.tankGewarnt = false; this.leerGemeldet = false; this.kopfGemeldet = false;
    this.hilfe = null;
    this.zielZeit = null;            // Zeitpunkt der Zieldurchfahrt [s]
    this.nachZielZeit = 0;           // wie lange schon hinter dem Ziel
    this.naechsterMeilenstein = 500;
    // Zusatz-Knöpfe: 🚀 Boost (Ladungen aus Raketen-Kanistern), 🦘 Sprungfeder (lädt sich mit Saltos auf)
    this.boostLadung = 0; this.boostZeit = 0;
    this.federLadung = 0; this.federZeit = 0; this.federSperre = 0;
    this.imWasser = false; this.letztesPlatsch = -9;
    this.windZone = 0; this.letzterWind = -99;
    this.roehre = null;            // Röhrenwelt: gerade in einer Röhre unterwegs {R, s, v, …}
    this.miniZeit = 0;             // Obstplantage: Mini-Turbo nach dem Einsammeln von Obst [s]
    this.umhangZeit = 0;           // Superheldenwelt: Heldenumhang nach der Telefonzelle [s]
    this.fz.masseGesamt = this.werte.masse + this.werte.raeder.reduce(function (s, r) { return s + r.masse; }, 0);
    if (this.werte.kufen) this.schneeAnlegen();
    if (this.werte.wanne) this.wanneAnlegen();
  }

  /* -------------------------------------------------------------------------
     Schnee-Schlitten: Schneedecke, Schneekanone, Propeller
     Die Schneedecke ist ein Raster mit 25 cm Zellen (1 = Schnee liegt), über die absolute
     x-Position adressiert. gel.schneeBei(x) fragt physik.js für die Kufen-Reibung ab.
     ------------------------------------------------------------------------- */
  var SCHNEE_ZELLE = 0.25, SCHNEE_VERSATZ = 400;          // 400 Zellen = 100 m Platz hinter dem Start
  /* Spur-Raster (Schnee des Schlittens, Wasser der Badewanne): 25-cm-Zellen über die absolute
     x-Position, 1 = belegt. bei(x) fragt ab, legen(xa, xb) belegt (wächst im Endlos-Modus mit). */
  function SpurRaster() {
    this.daten = new Uint8Array(8192); this.zelle = SCHNEE_ZELLE; this.versatz = SCHNEE_VERSATZ;
  }
  SpurRaster.prototype.bei = function (x) {
    var i = Math.floor(x / SCHNEE_ZELLE) + SCHNEE_VERSATZ;
    return i >= 0 && i < this.daten.length && this.daten[i] === 1;
  };
  SpurRaster.prototype.legen = function (xa, xb) {
    var i0 = Math.max(0, Math.floor(xa / SCHNEE_ZELLE) + SCHNEE_VERSATZ), i1 = Math.floor(xb / SCHNEE_ZELLE) + SCHNEE_VERSATZ;
    if (i1 >= this.daten.length) {
      var neu = new Uint8Array(Math.max(this.daten.length * 2, i1 + 1024));
      neu.set(this.daten); this.daten = neu;
    }
    for (var i = i0; i <= i1; i++) this.daten[i] = 1;
  };
  FF.SpurRaster = SpurRaster;

  Fahrt.prototype.schneeAnlegen = function () {
    var gel = this.gelaende, D = new SpurRaster();
    gel.schneeDecke = D;
    gel.schneeBei = function (x) { return D.bei(x); };
    this.kanoneAn = false; this.propLauf = 0; this.turbinenLauf = 0;
    this.schneeLegen(this.fz.chassis.x - 1.6, this.fz.chassis.x + 1.6);   // am Start steht er schon auf Schnee
  };
  Fahrt.prototype.schneeLegen = function (xa, xb) { this.gelaende.schneeDecke.legen(xa, xb); };

  /* -------------------------------------------------------------------------
     Badewanne: Aus dem Abfluss hinten spritzt ein Wasserstrahl nach hinten und schiebt die
     Wanne (Rückstoß, wanne.schub [m/s²] entlang der Wanne, auch in der Luft). Der „Tank“ ist
     das Badewasser: Der Strahl verbraucht es, und beim Schwappen läuft es über den Rand.
     Schwappen: Die Wasseroberfläche ist ein gedämpftes Pendel (Winkel phi im Wannen-
     Koordinatensystem), das der scheinbaren Schwerkraft g_s = g − a folgt. Steht sie
     schiefer als der Rand erlaubt (randWinkel, je voller desto kleiner), läuft Wasser aus.
     Im freien Flug ist g_s ≈ 0: Das Wasser schwebt, und beim Aufsetzen schwappt es heftig.
     Kopfüber (Looping, Überschlag) läuft es schnell aus. Wasser, das herauskommt, bleibt
     als Pfütze auf dem Boden liegen (gel.wasserDecke). */
  Fahrt.prototype.wanneAnlegen = function () {
    var gel = this.gelaende, D = new SpurRaster();
    gel.wasserDecke = D;
    this.wanne = { phi: 0, om: 0, vx: this.fz.chassis.vx, vy: this.fz.chassis.vy, lauf: 0, verlust: 0, rand: 0 };
    this.turbinenLauf = 0;
  };
  Fahrt.prototype.wanneSchritt = function (h) {
    var W = this.werte.wanne, B = this.wanne, fz = this.fz, C = fz.chassis, st = fz.status;
    var laeuft = this.zustand === "fahrt" && this.tank > 0;
    // Strahl: dreht mit Gas auf (Wasserhahn), rückwärts gibt es nicht – Bremse bremst nur
    var ziel = laeuft ? this.gas : 0;
    B.lauf += Math.max(-h / W.anlauf, Math.min(h / W.anlauf, ziel - B.lauf));
    this.turbinenLauf = B.lauf; fz.strahl = B.lauf;
    var gRel = Math.min(1, this.welt.schwerkraft / 9.81);
    var schub = W.schub * B.lauf * (0.4 + 0.6 * gRel);
    if (schub > 0.01 && st.vorwaerts < W.vmax) {
      var ax = Math.cos(C.a) * schub, ay = Math.sin(C.a) * schub;
      C.vx += ax * h; C.vy += ay * h;
      fz.raeder.forEach(function (R) { R.k.vx += ax * h; R.k.vy += ay * h; });
    }
    // scheinbare Schwerkraft im Wannen-System (x = vorn, y = oben)
    // Beschleunigung gefiltert (Tiefpass ≈ 0,1 s): einzelne Kontakt-Stöße der Federung zählen nicht
    var f = Math.min(1, h / 0.1);
    B.ax = (B.ax || 0) + f * ((C.vx - B.vx) / h - (B.ax || 0)); B.ay = (B.ay || 0) + f * ((C.vy - B.vy) / h - (B.ay || 0));
    B.vx = C.vx; B.vy = C.vy;
    var g = this.welt.schwerkraft, gx = -B.ax, gy = -g - B.ay;
    var ca = Math.cos(C.a), sa = Math.sin(C.a);
    var gxl = gx * ca + gy * sa, gyl = -gx * sa + gy * ca;          // in Wannen-Koordinaten
    var gs = Math.hypot(gxl, gyl);
    // Gleichgewicht: Oberfläche senkrecht zu g_s; phi > 0 = Wasser schwappt nach hinten hoch
    var phiZiel = gs > 1.5 ? Math.atan2(-gxl, -gyl) : B.phi;
    var k = W.schwapp * W.schwapp * Math.min(1, gs / 9.81 + 0.15), d = 2 * 0.18 * W.schwapp;
    B.om += (-k * normWinkel(B.phi - phiZiel) - d * B.om) * h;
    B.om = Math.max(-12, Math.min(12, B.om));
    B.phi = normWinkel(B.phi + B.om * h);
    fz.wasserWinkel = B.phi; fz.wasserStand = this.tank;
    // Im Looping hält die Fliehkraft das Wasser zwar in der Wanne, aber es schwappt wild hin und her
    if (this.imLooping) B.om += Math.sin(this.zeit * 11) * W.loopSchwapp * h;
    // Auslaufen: je voller, desto früher. Kopfüber (|phi| > 90°) läuft es in Strömen
    var rand = W.randWinkel * (0.75 + 1.2 * (1 - this.tank));             // voll: ≈ 21°, halb: ≈ 38°, fast leer: kaum noch
    B.rand = rand;
    var ueber = Math.abs(B.phi) - rand;
    if (this.zustand === "fahrt" && this.tank > 0 && ueber > 0) {
      var rate = Math.min(W.auslaufMax, W.auslauf * ueber * ueber * 4 + (Math.abs(B.phi) > 1.6 ? W.auslaufMax : 0));
      var weg = Math.min(this.tank, rate * h);
      this.tank -= weg; B.verlust += weg;
      // die Seite, über die es läuft: phi > 0 → hinten, phi < 0 → vorne
      var xr = B.phi > 0 ? W.hinten : W.vorne, yr = W.randHoehe;
      fz.schwapp = { x: C.x + ca * xr - sa * yr, y: C.y + sa * xr + ca * yr, seite: B.phi > 0 ? -1 : 1, zeit: this.zeit };
      if (B.verlust > 0.02) { this.melde("schwapp", { x: fz.schwapp.x, y: fz.schwapp.y, menge: B.verlust }); B.verlust = 0; }
    }
    // Wasser landet auf dem Boden und bleibt liegen: der Strahl hinter der Wanne, Schwapp-Wasser unter dem Rand
    if (B.lauf > 0.15 && laeuft) {
      var xs = C.x + ca * W.hinten - B.lauf * (1.2 + 0.08 * Math.max(0, st.vorwaerts));
      this.gelaende.wasserDecke.legen(xs - 0.5, xs + 0.4);
    }
    if (fz.schwapp && this.zeit - fz.schwapp.zeit < 0.05) this.gelaende.wasserDecke.legen(fz.schwapp.x - 0.4, fz.schwapp.x + 0.4);
  };

  Fahrt.prototype.schlittenSchritt = function (h) {
    var w = this.werte, P = w.propeller, KA = w.kanone, fz = this.fz, C = fz.chassis, st = fz.status, gel = this.gelaende;
    var laeuft = this.zustand === "fahrt" && this.tank > 0;
    // Propeller: dreht mit Gas hoch, rückwärts mit der Bremse im Stand
    var ziel = laeuft ? (this.gas > 0.01 ? this.gas : this.rueckwaerts ? -P.rueck * this.bremse : 0) : 0;
    var lauf = this.propLauf;
    lauf += Math.max(-h / P.anlauf, Math.min(h / P.anlauf, ziel - lauf));
    this.propLauf = lauf; this.turbinenLauf = Math.abs(lauf); fz.propeller = lauf;
    var gRel = Math.min(1, this.welt.schwerkraft / 9.81);
    var schub = P.schub * lauf * (0.4 + 0.6 * gRel);
    if ((schub > 0 && st.vorwaerts < P.vmax) || (schub < 0 && st.vorwaerts > -3)) {
      var ax = Math.cos(C.a) * schub, ay = Math.sin(C.a) * schub;
      C.vx += ax * h; C.vy += ay * h;
      fz.raeder.forEach(function (R) { R.k.vx += ax * h; R.k.vy += ay * h; });
    }
    // Bremskralle (nur vorwärts, nicht beim Rückwärtsfahren)
    fz.kufenBremse = this.rueckwaerts ? 0 : this.bremse;

    // Schneekanone: an, wenn die Kufen auf dem Boden sind oder der Schlitten gleich landet.
    // Aus: in der Luft, kopfüber, im Looping, in Schneewelten, ohne Tank.
    var an = false, xa = 0, xb = 0, za = 0, zb = 0;
    if (laeuft && !this.welt.schneeBoden) {
      var ca = Math.cos(C.a), sa = Math.sin(C.a);
      var schief = Math.abs(normWinkel(C.a - Math.atan(gel.steigungBei(C.x))));
      var xv = C.x + ca * 1.15, yv = C.y + sa * 1.15 - ca * 0.3;          // Kufenspitze vorn
      var hoehe = yv - gel.hoeheBei(xv);
      var aufLoop = false;
      fz.raeder.forEach(function (R) { if (R.kontakt.aktiv && R.kontakt.ny < 0.35) aufLoop = true; });
      if (schief < 0.9 && !aufLoop && ca > 0.3) {
        if (hoehe < 0.45 || st.radKontakte > 0) {        // Kufen am Boden (oder knapp darüber):
          // Schnee nur unmittelbar vor die Kufen. Die Flocken (Grafik) fliegen im Bogen und landen
          // dort, wo die Kufenspitze nach „flug“ Sekunden ist – also immer kurz vor dem Schlitten.
          an = true; xa = xv - 0.1; xb = xv + KA.reichweite;
          var xs = xv + C.vx * KA.flug; za = xs + 0.1; zb = xs + KA.reichweite;
        } else if (C.vy < -0.5 && hoehe / -C.vy < KA.vorlauf) {   // gleich landen: Schnee auf den Landeplatz
          var tl = hoehe / -C.vy, xl = xv + C.vx * tl;
          an = true; xa = xl - 1.6; xb = xl + KA.reichweite; za = xl - 0.8; zb = xl + KA.reichweite;
        }
      }
    }
    if (an) this.schneeLegen(xa, xb);
    if (an !== this.kanoneAn) this.melde(an ? "kanoneAn" : "kanoneAus");
    this.kanoneAn = an; fz.kanone = an; fz.kanoneZiel = an ? [za, zb] : null;   // Grafik: dort landen die Flocken
  };

  /* Zusatz-Knopf gedrückt: "boost" oder "feder". Gibt true zurück, wenn es losging. */
  /* Geht der Knopf JETZT? (Nur dann leuchtet er bunt.) */
  Fahrt.prototype.extraMoeglich = function (art) {
    if (this.zustand !== "fahrt") return false;
    if (art === "boost") return this.boostLadung >= 1 && this.boostZeit <= 0;
    return this.federLadung >= FF.CONFIG.regeln.extras.federSalti && this.federSperre <= 0 && this.fz.status.radKontakte > 0 && !this.roehre && !this.katapult;
  };

  Fahrt.prototype.zuende = function (art) {
    var X = FF.CONFIG.regeln.extras, fz = this.fz, C = fz.chassis;
    if (!this.extraMoeglich(art)) return false;
    if (art === "boost") {
      this.boostLadung--; this.boostZeit = X.boostDauer;
      this.melde("boost");
      return true;
    }
    if (art === "feder") {
      // nur mit den Rädern am Boden – dann katapultiert die Feder das Auto senkrecht zum Auto-Boden hoch
      this.federLadung = 0; this.federZeit = 0.6; this.federSperre = X.federPause;
      var nx = -Math.sin(C.a), ny = Math.cos(C.a), dv = X.federSprung;
      FF.Physik.stoss(fz, nx * dv, ny * dv);
      this.melde("feder", { x: C.x, y: C.y });
      return true;
    }
    return false;
  };

  /* 0…1 für die Knopf-Anzeige */
  Fahrt.prototype.extraStand = function () {
    var X = FF.CONFIG.regeln.extras;
    return { boost: this.boostLadung, boostAn: this.boostZeit > 0 ? this.boostZeit / X.boostDauer : 0,
             feder: Math.min(1, this.federLadung / X.federSalti), federSalti: this.federLadung, federNoetig: X.federSalti,
             boostBereit: this.extraMoeglich("boost"), federBereit: this.extraMoeglich("feder"), federSperre: this.federSperre };
  };

  Fahrt.prototype.federLaden = function (n) {
    var X = FF.CONFIG.regeln.extras, vorher = this.federLadung;
    if (this.federSperre > 0) return;                    // Abkühlzeit nach dem Sprung: Saltos zählen nicht
    this.federLadung = Math.min(X.federSalti, this.federLadung + n);
    if (vorher < X.federSalti && this.federLadung >= X.federSalti) this.melde("extraBereit", { art: "feder" });
  };

  Fahrt.prototype.melde = function (typ, daten) {
    var e = daten || {};
    e.typ = typ;
    this.ereignisse.push(e);
  };

  /* Haupt-Update: dt [s], eingabe = {gas: bool, bremse: bool} */
  Fahrt.prototype.aktualisiere = function (dt, eingabe) {
    if (this.zustand === "ende") return;
    var h = FF.CONFIG.physik.schrittweite;
    this.akku += Math.min(dt, 0.05);
    while (this.akku >= h) {
      this.akku -= h;
      this.schritt(h, eingabe);
      if (this.zustand === "ende") break;
    }
    var st = this.fz.status, hilfe = this.zustand === "hilfe";
    this.getriebe.schritt(hilfe ? 0 : st.drehzahl, hilfe ? 0 : st.tempo / this.werte.motor.vmax,
                          this.gas + (this.rueckwaerts ? 0.6 * this.bremse : 0), !hilfe && st.radKontakte > 0,
                          this.tank > 0 && this.zustand !== "ende", Math.min(dt, 0.05));
    if (this.getriebe.turbine) {                        // Turbine: Drehzahl folgt dem Hochlaufen, nicht den Rädern
      var Gt = this.getriebe, an = this.tank > 0 && this.zustand !== "ende";
      Gt.rpm = an ? Gt.leerlauf + (Gt.max - Gt.leerlauf) * this.turbinenLauf : Gt.rpm * 0.95;
      Gt.rf = this.turbinenLauf; Gt.begrenzer = false;
    }
    this.sammle();
    if (this.endlos) {
      var x = this.fz.chassis.x;
      this.gelaende.erweitereBis(x + 260);
      this.gelaende.aufraeumen(x - 80);
    }
  };

  Fahrt.prototype.schritt = function (h, eingabe) {
    var S = FF.CONFIG.steuerung, Rg = FF.CONFIG.regeln;
    var fz = this.fz, C = fz.chassis, st = fz.status, w = this.werte;
    this.zeit += h;

    // Pedale weich nachführen
    var zielGas = eingabe.gas && this.zustand === "fahrt" ? 1 : 0;
    var zielBremse = eingabe.bremse && this.zustand === "fahrt" ? 1 : 0;
    if (this.zustand === "ziel") { zielGas = 0; zielBremse = 1; }
    this.gas = naehern(this.gas, zielGas, (zielGas > this.gas ? S.gasAnstieg : S.gasAbfall) * h);
    this.bremse = naehern(this.bremse, zielBremse, (zielBremse > this.bremse ? S.gasAnstieg : S.gasAbfall) * h);

    if (this.zustand === "hilfe") { this.hilfeSchritt(h); return; }
    if (this.katapult) { this.katapultSchritt(h, eingabe); return; }
    if (this.roehre) { this.roehrenSchritt(h, eingabe); return; }

    this.setzeAntrieb();
    this.setzeZusatzMoment();
    if (this.boostZeit > 0) {
      // Raketen-Schub entlang der Längsachse (auch in der Luft), bis gut doppelt so schnell wie sonst
      var X = FF.CONFIG.regeln.extras;
      this.boostZeit = Math.max(0, this.boostZeit - h);
      if (st.vorwaerts < X.boostTempoMax * w.motor.vmax) {
        C.vx += Math.cos(C.a) * X.boostBeschl * h;
        C.vy += Math.sin(C.a) * X.boostBeschl * h;
      }
    }
    if (this.miniZeit > 0) {
      // Obst: kleiner Raketen-Schub (kürzer, schwächer und nicht so schnell wie der Turbo)
      var O = this.welt.obst || this.welt.held.turbo;
      this.miniZeit = Math.max(0, this.miniZeit - h);
      if (this.boostZeit <= 0 && st.vorwaerts < O.tempoMax * w.motor.vmax) {
        C.vx += Math.cos(C.a) * O.beschl * h;
        C.vy += Math.sin(C.a) * O.beschl * h;
      }
    }
    fz.mini = this.miniZeit;                    // für die Grafik: kleine Rakete
    if (this.umhangZeit > 0) {
      // Heldenumhang (Superheldenwelt): in der Luft sinkt man höchstens mit sinkMax [m/s] –
      // auf alle Körper gleich, damit die Federn nicht gedehnt werden
      this.umhangZeit = Math.max(0, this.umhangZeit - h);
      var sinkMax = this.welt.held.zelle.sinkMax;
      if (st.radKontakte === 0 && C.vy < -sinkMax) {
        var dvU = Math.min(-sinkMax - C.vy, 2.2 * this.welt.schwerkraft * h);
        C.vy += dvU; fz.raeder.forEach(function (R) { R.k.vy += dvU; });
      }
    }
    fz.umhang = this.umhangZeit;                // für die Grafik: großer Umhang
    if (this.federZeit > 0) this.federZeit = Math.max(0, this.federZeit - h);
    if (this.federSperre > 0) this.federSperre = Math.max(0, this.federSperre - h);
    fz.duese = this.boostZeit;                  // für die Grafik: Düsen und Flammen
    fz.feder = this.federZeit;                  // … ausgefahrene Sprungfedern
    if (this.welt.wasser) this.wasser(h);
    if (w.auftrieb) this.fliegen(h);
    if (w.turbine) this.turbinenSchub(h);
    if (w.kufen) this.schlittenSchritt(h);
    if (w.wanne) this.wanneSchritt(h);
    if (this.gelaende.dyn.length) { var self = this; this.gelaende.dynSchritt(h, fz, function (t, d) { self.melde(t, d); }); }
    FF.Physik.schritt(fz, this.gelaende, this.welt, h);
    if (this.welt.wolken) this.wolkenPruefen(h);
    if (C.x < S.rueckGrenzeWand && C.vx < 0) {               // unsichtbare Wand am Weltanfang (auch im Flug)
      C.vx = 0;
      fz.raeder.forEach(function (R) { if (R.k.vx < 0) R.k.vx = 0; });
    }
    if (this.welt.decke) this.deckenStoss();
    if (this.gelaende.trampoline.length) this.pruefeTrampolin();
    if (this.welt.wind) this.pruefeWind();
    if (this.gelaende.baender.length) this.pruefeBand();
    if (this.gelaende.objekte.length) this.pruefeObjekte();
    if (this.gelaende.tore.length) this.pruefeTore();
    if (this.gelaende.katapulte.length && this.zustand === "fahrt") {          // in die Katapult-Schale gefahren?
      var KA = this.gelaende.katapulte;
      for (var ki = 0; ki < KA.length; ki++) {
        if (!KA[ki].benutzt && C.x > KA[ki].x - 0.6 && C.x < KA[ki].x + 1.5 && st.radKontakte > 0) {
          KA[ki].benutzt = true;
          this.katapult = { k: KA[ki], zeit: 0, gasVorher: eingabe.gas };
          this.melde("katapultBereit", { x: KA[ki].x });
          break;
        }
      }
    }
    if (this.gelaende.scheunen.length) this.pruefeScheunen();
    if (this.gelaende.roehren.length && this.zustand === "fahrt") this.pruefeRoehren();
    var SP = this.gelaende.spuk;                              // Geisterwelt: Geist taucht auf
    for (var si = 0; si < SP.length; si++) {
      if (!SP[si].gesehen && C.x > SP[si].x - 13 && C.x < SP[si].x) { SP[si].gesehen = true; this.melde("spuk", { x: SP[si].x }); }
    }
    if (this.gelaende.schwebezonen.length) {                 // Schwebe-Säule betreten?
      var leicht = this.gelaende.schwereBei(C.x) < 0.5;
      if (leicht && !this.schwebt && this.zustand === "fahrt") this.melde("schwebe", { x: C.x, y: C.y });
      this.schwebt = leicht;
    }

    // Tankverbrauch: Leerlauf + Gasstellung + abgegebene Leistung
    if (this.zustand === "fahrt" && this.tank > 0) {
      var gasWirk = this.gas + (this.rueckwaerts ? 0.6 * this.bremse : 0);
      var pAnteil = Math.min(1, st.leistung / this.leistungMax);
      var L = w.leerlauf !== undefined ? w.leerlauf : Rg.leerlaufAnteil;
      var last = w.turbine ? 0.25 + 0.75 * (this.turbinenLauf || 0) : 0.55 * Math.min(1, gasWirk) + 0.45 * pAnteil;   // Turbine: Verbrauch nach Drehzahl
      if (w.kufen) last = 0.7 * Math.abs(this.propLauf) + (this.kanoneAn ? w.kanone.verbrauch : 0);          // Schlitten: Propeller + Schneekanone
      if (w.wanne) last = this.wanne.lauf;                                                                   // Badewanne: nur der Strahl (Schwappen rechnet wanneSchritt)
      this.tank -= (L + (1 - L) * last) / w.tankSekunden * h;
      if (!this.tankGewarnt && this.tank < Rg.tankWarnung) { this.tankGewarnt = true; this.melde("tankWarnung"); }
      if (this.tank <= 0) { this.tank = 0; }
    }
    // Puste (Seifenkiste): Wer ohne Gas rollt, verschnauft – die Puste kommt langsam zurück
    if (w.puste && this.zustand === "fahrt" && this.tank > 0 && this.gas < 0.05 && st.vorwaerts > 2) {
      var vorP = this.tank;
      this.tank = Math.min(1, this.tank + w.puste.erholung / w.tankSekunden * h);
      this.geladen += this.tank - vorP;
      if (this.geladen >= 0.04) { this.melde("geladen", { anteil: this.geladen }); this.geladen = 0; }
    }
    // Füße der Seifenkiste (nur Grafik): Laufschritt nach zurückgelegtem Weg
    if (w.fussAntrieb) {
      fz.lauf = (fz.lauf || 0) + Math.abs(st.vorwaerts) * h * 2.2;
      fz.laeuft = this.gas > 0.1 && st.radKontakte > 0 && this.tank > 0;
    }
    // Rekuperation (Elektroauto): Bremsleistung P = M·ω fließt zum Teil zurück in den Akku –
    // beim Bremsen und beim Rollen ohne Pedal (dann bremst der Motor als Generator)
    if (w.rekuperation && this.zustand === "fahrt" && this.tank > 0 && (this.bremse > 0.05 || this.gas < 0.01) &&
        !this.rueckwaerts && st.vorwaerts > 1) {
      var pBrems = 0;
      fz.raeder.forEach(function (R) { if (R.motorZiel === 0) pBrems += Math.abs(R.jMotor / h * (R.k.w - C.w)); });
      var vorher = this.tank;
      this.tank = Math.min(1, this.tank + w.rekuperation * Math.min(1, pBrems / this.leistungMax) / w.tankSekunden * h);
      this.geladen += this.tank - vorher;                  // nur was wirklich in den Akku passt
      if (this.geladen >= 0.02) { this.melde("geladen", { anteil: this.geladen }); this.geladen = 0; }
      if (this.tank >= Rg.tankWarnung) this.tankGewarnt = false;
    }

    // Strecke
    if (C.x > this.strecke) this.strecke = C.x;
    if (this.endlos && this.strecke >= this.naechsterMeilenstein) {
      this.bonus += 100;
      this.melde("meilenstein", { meter: this.naechsterMeilenstein, bonus: 100 });
      this.naechsterMeilenstein += 500;
    }

    this.pruefeLooping(h);
    this.pruefeLuft(h);
    if (this.zustand === "fahrt") this.pruefeHoppla(h);
    this.pruefeEnde(h);
  };

  function naehern(wert, ziel, schritt) {
    if (wert < ziel) return Math.min(ziel, wert + schritt);
    return Math.max(ziel, wert - schritt);
  }

  /* Motor, Bremse, Rückwärtsgang → Motor-Bindung an jedem Rad */
  Fahrt.prototype.setzeAntrieb = function () {
    var S = FF.CONFIG.steuerung, w = this.werte, fz = this.fz, C = fz.chassis;
    var motorAn = this.tank > 0 && this.zustand === "fahrt";
    var halten = this.zustand === "ziel";
    // Bei wenig Schwerkraft (Mond) regelt die Motorsteuerung die Kraft herunter, sonst
    // überschlägt sich ein starkes Fahrzeug schon beim Anfahren auf ebener Strecke
    var gRel = Math.min(1, this.welt.schwerkraft / 9.81);
    var nA = this.nAntrieb, nAlle = fz.raeder.length, Tmax = w.motor.drehmoment * (0.4 + 0.6 * gRel);
    this.rueckwaerts = false;
    var bremsen = this.bremse > 0.01 && (halten || !motorAn || fz.status.vorwaerts > S.rueckwaertsSchwelle);
    if (!bremsen && this.bremse > 0.01 && this.gas <= 0.01) this.rueckwaerts = true;

    // Weltanfang: hinter dem Start ist nach gut einem Bildschirm Schluss. Kein Rückwärtsgang
    // mehr, und wer rückwärts rollt, wird kräftig abgebremst (sonst fällt das Auto von der Welt)
    var bremsKraft = this.bremse;
    if (C.x < S.rueckGrenzeBremse && this.gas <= 0.01) {
      this.rueckwaerts = false;
      if (C.vx < 0.05) { bremsen = true; bremsKraft = 1; }
      else bremsen = this.bremse > 0.01;                     // Bremspedal bremst hier nur noch
    }

    for (var i = 0; i < nAlle; i++) {
      var R = fz.raeder[i];
      if (w.kufen) { R.motorZiel = 0; R.motorMax = 1e5; continue; }   // Kufen: drehen sich nicht (Gleitreibung)
      var rel = Math.abs(R.k.w - C.w);
      var wEck = this.eck * R.wMax;
      var Tkurve = rel <= wEck ? Tmax : Tmax * wEck / rel;   // konstantes Moment, dann konstante Leistung
      if (this.gas > 0.01 && motorAn) {
        R.motorZiel = -R.wMax;                               // vorwärts = Rad dreht im Uhrzeigersinn
        R.motorMax = R.antrieb ? Tkurve * this.gas / nA : 0;
      } else if (bremsen) {
        R.motorZiel = 0;
        R.motorMax = w.bremse * bremsKraft / nAlle;
      } else if (this.rueckwaerts && motorAn) {
        R.motorZiel = R.wMax * S.rueckwaertsTempo;
        R.motorMax = R.antrieb ? Tkurve * S.rueckwaertsKraft * (w.rueckMal || 1) * this.bremse / nA : 0;
      } else {
        // ohne Pedal: Motorbremse – beim Elektroauto stärker (Generator lädt den Akku).
        // Seifenkiste (freilauf): rollt ganz frei
        R.motorZiel = 0;
        R.motorMax = R.antrieb && motorAn && !w.freilauf ? Tmax * (w.rekuperation ? S.motorBremseElektro : S.motorBremse) / nA : 0;
      }
    }
    // Anhänger (Dampf-Lok): rollen frei, beim Bremsen bremsen sie mit
    fz.anhaenger.forEach(function (A) {
      A.raeder.forEach(function (R) {
        R.motorZiel = 0;
        R.motorMax = bremsen ? w.bremse * bremsKraft / nAlle * 0.6 : 0;
      });
    });
  };

  /* Luftsteuerung (Spiel-Hilfe) und – im Modus "Leicht" – ein sanfter Stabilisator */
  Fahrt.prototype.setzeZusatzMoment = function () {
    var fz = this.fz, C = fz.chassis, st = fz.status, w = this.werte, J = C.J;
    var M = 0;
    var inDerLuft = st.radKontakte === 0 && !st.huellKontakt && !st.kopfKontakt && !st.anhaengerBoden;
    if (this.zustand === "fahrt" && inDerLuft) {
      // Gas und Bremse zugleich: Gas hat Vorrang (wie am Boden). Früher (bis Version 35)
      // hoben sich beide auf (steuer = 0), und Stabilisator bzw. Luft-Kreisel hielten das
      // Auto dann ruhig, während am Boden Vollgas lief – mit beiden Pedalen gelang jeder
      // Sprung von allein. Wieder einschalten: Entwickler-Bereich „Gas+Bremse alt“.
      var beide = this.gas > 0.1 && this.bremse > 0.1;
      var steuer = beide && !this.gasBremseAlt ? this.gas : this.gas - this.bremse;   // + = Nase hoch
      var losgelassen = this.gasBremseAlt ? Math.abs(steuer) < 0.1 : this.gas < 0.1 && this.bremse < 0.1;
      M = steuer * w.luftsteuerung * J;
      if ((steuer > 0 && C.w > 5.5) || (steuer < 0 && C.w < -5.5)) M = 0;
      if (w.stabilisator && losgelassen) {
        M += (-3 * normWinkel(C.a) - 1.5 * C.w) * J * w.stabilisator;
      }
      // Luft-Kreisel (Upgrade): hält das Auto in der Luft ruhig wie ein Kreiselinstrument.
      // Ohne Pedal dämpft er die Drehung, beim Gegensteuern fängt er sie schneller ab.
      // (Mehr Drehkraft in Drehrichtung wäre schlecht: Wer Gas hält, überschlägt sich dann öfter.)
      if (w.kreisel) {
        var UK = FF.CONFIG.upgradeWirkung;
        if (losgelassen) M -= C.w * J * UK.kreiselRuhe * w.kreisel;
        else if (steuer * C.w < 0) M *= 1 + UK.kreisel * w.kreisel;          // Gegensteuern wirkt stärker
      }
    } else if ((w.stabilisator || w.balance) && st.radKontakte > 0) {
      // Stabilisator (Leicht) bzw. Gleichgewichtssinn (Skateboard: das Kind balanciert)
      var d = normWinkel(C.a - Math.atan(this.gelaende.steigungBei(C.x)));
      // Beim Skateboard lehnt sich das Kind kräftig vor: früher und stärker (bis 28 rad/s²),
      // so bleibt das Brett bergauf auch mit Gas meist unten – nur steil muss man kurz lupfen
      var balanciert = w.balance && !w.stabilisator;
      var frei = balanciert ? 0.1 : 0.4, stab = Math.max(w.stabilisator || 0, w.balance || 0), grenze = balanciert ? 28 : 12;
      if (Math.abs(d) > frei) {
        var M2 = (-(d - Math.sign(d) * frei) * 20 - C.w * (balanciert ? 7 : 3)) * J * stab;
        M += Math.max(-J * grenze, Math.min(J * grenze, M2));
      }
    }
    if (fz.anhaenger.length) {
      // Zug: als Ganzes drehen (physik.js zugDrehen), selbst nur bis maxDrehung [rad/s] –
      // so lässt sich die Nase zur Landung stellen, aber Saltos gehen nicht
      var alpha = M / J, wm = w.maxDrehung || 1;
      if ((alpha > 0 && C.w > wm) || (alpha < 0 && C.w < -wm)) alpha = 0;
      fz.zusatzAlpha = alpha; M = 0;
    }
    fz.zusatzMoment = M;
  };

  /* Wolkeninseln: Die Wolke unter dem Auto sinkt (gelaende.wolkenSchritt). Wer in eine Lücke
     fällt, den trägt der Ballon auf die nächste Wolke (kostet Benzin wie ein Überschlag). */
  Fahrt.prototype.wolkenPruefen = function (h) {
    var gel = this.gelaende, fz = this.fz, C = fz.chassis, last = null;
    if (this.zustand === "fahrt") {
      for (var i = 0; i < fz.raeder.length && !last; i++) {
        var R = fz.raeder[i];
        if (R.kontakt.aktiv && R.kontakt.pen > -0.05) last = gel.wolkeBei(R.k.x);
      }
      if (!last && (fz.status.huellKontakt || fz.status.kopfKontakt)) last = gel.wolkeBei(C.x);
    }
    var vorher = this.wolkeLast;
    gel.wolkenSchritt(h, last);
    if (last && last !== vorher && last !== gel.wolken[0]) this.melde("wolke", { x: C.x, y: C.y });
    this.wolkeLast = last;
    if (this.zustand !== "fahrt") return;
    var L = gel.wolkenLuecke(C.x);
    if (L && C.y < L.unten) { this.melde("wolkeFall", { x: C.x, y: C.y }); this.starteHilfe(L.ende); }
  };

  /* Höhle: Wer bis an die Decke fliegt, prallt sanft nach unten ab. Geprüft
     werden alle Umrisspunkte und der Kopf (auch bei hochkant stehendem Auto). */
  Fahrt.prototype.deckenStoss = function () {
    var fz = this.fz, C = fz.chassis, gel = this.gelaende, ca = Math.cos(C.a), sa = Math.sin(C.a);
    var tief = -Infinity, px = 0, py = 0;
    var punkte = fz.huelle.concat([{ x: fz.kopf.x, y: fz.kopf.y + fz.kopf.r }]);
    for (var i = 0; i < punkte.length; i++) {
      var p = punkte[i], wx = C.x + ca * p.x - sa * p.y, wy = C.y + sa * p.x + ca * p.y;
      var pen = wy - gel.deckeBei(wx) + 0.15;
      if (pen > tief) { tief = pen; px = wx; py = wy; }
    }
    if (tief <= 0) return;
    var vyPunkt = C.vy + C.w * (px - C.x);              // Geschwindigkeit des Punktes nach oben
    if (tief > 0.05) {                                   // aus der Decke herausschieben
      var d = Math.min(tief, 0.3);
      C.y -= d; fz.raeder.forEach(function (R) { R.k.y -= d; });
    }
    if (vyPunkt > 0) {
      C.vy -= 1.3 * vyPunkt; C.w *= 0.5;
      fz.raeder.forEach(function (R) { if (R.k.vy > C.vy) R.k.vy = C.vy; });
      if (vyPunkt > 1.5) this.melde("decke", { x: px, y: py, staerke: Math.min(1, vyPunkt / 8) });
    }
  };

  /* Turbinen-Sofa: Die Turbine dreht mit Gas langsam hoch (turbine.anlauf Sekunden bis
     voll), ohne Gas langsam herunter – sie schiebt also noch nach, wenn man loslässt.
     Schub entlang der Sofa-Längsachse, auch in der Luft, bis turbine.vmax. */
  Fahrt.prototype.turbinenSchub = function (h) {
    var T = this.werte.turbine, fz = this.fz, C = fz.chassis, st = fz.status;
    var ziel = this.zustand === "fahrt" && this.tank > 0 ? this.gas : 0;
    var lauf = this.turbinenLauf || 0;
    lauf += (ziel > lauf ? h / T.anlauf : -h / (T.anlauf * 1.8)) ;
    lauf = Math.max(0, Math.min(1, lauf)); if (ziel > lauf - 0.001 && ziel < lauf) lauf = ziel;
    this.turbinenLauf = lauf; fz.turbine = lauf;
    var gRel = Math.min(1, this.welt.schwerkraft / 9.81);
    var schub = T.schub * Math.pow(lauf, 1.6) * (0.4 + 0.6 * gRel);   // erst wenig, dann kräftig; bei wenig Schwerkraft gedrosselt
    if (schub < 0.01 || st.vorwaerts > T.vmax) return;
    var ax = Math.cos(C.a) * schub, ay = Math.sin(C.a) * schub;
    C.vx += ax * h; C.vy += ay * h;
    fz.raeder.forEach(function (R) { R.k.vx += ax * h; R.k.vy += ay * h; });
  };

  /* Flugzeug: Bodeneffekt-Auftrieb und Propeller. Auftrieb a = g · max · (v/vRef)²,
     voll bis 1 m über der normalen Höhe, bis „hoehe“ linear weg – darüber trägt nichts.
     Ohne Luft (Mond) kein Auftrieb. In der Luft schiebt der Propeller mit Gas. */
  Fahrt.prototype.fliegen = function (h) {
    var A = this.werte.auftrieb, fz = this.fz, C = fz.chassis, gel = this.gelaende, st = fz.status;
    var luft = Math.min(1, this.welt.luftdichte / 1.2);
    if (!luft || this.zustand !== "fahrt") return;
    var frei = C.y - gel.hoeheBei(C.x) - A.boden;
    var nah = frei < 1 ? 1 : Math.max(0, 1 - (frei - 1) / (A.hoehe - 1));
    var v = Math.max(0, st.vorwaerts), g = this.welt.schwerkraft * (gel.schwereBei ? gel.schwereBei(C.x) : 1);
    var a = g * A.max * Math.min(1, (v / A.vRef) * (v / A.vRef)) * nah * luft, ax = 0, ay = a;
    if (st.radKontakte === 0 && this.gas > 0.05 && this.tank > 0 && st.vorwaerts < this.werte.motor.vmax * 1.15) {
      ax += Math.cos(C.a) * this.werte.schub * this.gas; ay += Math.sin(C.a) * this.werte.schub * this.gas;
    }
    C.vx += ax * h; C.vy += ay * h;
    fz.raeder.forEach(function (R) { R.k.vx += ax * h; R.k.vy += ay * h; });
  };

  /* Katapult: Das Auto liegt in der Schale (Lage fest, Nase leicht hoch). Gas drücken
     (neu drücken – wer schon Gas hält, lässt kurz los) schleudert es los; spätestens
     nach 4 s geht es von selbst, damit niemand hängen bleibt. */
  Fahrt.prototype.katapultSchritt = function (h, eingabe) {
    var K = this.katapult, k = K.k, fz = this.fz, gel = this.gelaende;
    K.zeit += h;
    var a = 0.18;
    FF.Physik.setzePose(fz, k.x, gel.hoeheBei(k.x) + 1.2 + this.werte.groesse.hoehe * 0.3, a);
    fz.status.tempo = 0; fz.status.vorwaerts = 0; fz.status.drehzahl = 0;
    var neu = eingabe.gas && !K.gasVorher;
    K.gasVorher = eingabe.gas;
    if (!((neu && K.zeit > 0.35) || K.zeit > 4)) return;
    this.katapult = null; k.schuss = this.zeit;
    var vx = k.v * Math.cos(k.winkel), vy = k.v * Math.sin(k.winkel), C = fz.chassis;
    C.vx = vx; C.vy = vy; C.w = 0;
    fz.raeder.forEach(function (R) { R.k.vx = vx; R.k.vy = vy; });
    FF.Physik.anhaengerTempo(fz);
    this.melde("katapult", { x: k.x, y: C.y });
  };

  /* Scheune: Meldung beim Hineinfahren und beim Hinausfahren (dann fliegt Stroh, spiel.js) */
  Fahrt.prototype.pruefeScheunen = function () {
    var S = this.gelaende.scheunen, C = this.fz.chassis;
    if (this.zustand !== "fahrt" && this.zustand !== "ziel") return;
    for (var i = 0; i < S.length; i++) {
      var sc = S[i];
      if (C.x < sc.x0 - 2 || C.x > sc.x1 + 8) continue;
      if (!sc.drin && C.x > sc.x0 && C.x < sc.x1) { sc.drin = true; this.melde("scheune", { x: sc.x0, y: this.gelaende.hoeheBei(sc.x0) }); }
      if (sc.drin && !sc.durch && C.x > sc.x1 + 0.2) {
        sc.durch = true;
        this.melde("stroh", { x: sc.x1, y: this.gelaende.hoeheBei(sc.x1), tempo: Math.abs(C.vx) });
      }
    }
  };

  /* Röhre: Wer am Boden (oder knapp darüber) in die Öffnung fährt, wird von der Röhre
     übernommen. Fliegt man hoch über die Öffnung, fährt man unten weiter. */
  Fahrt.prototype.pruefeRoehren = function () {
    var RS = this.gelaende.roehren, fz = this.fz, C = fz.chassis, st = fz.status, gel = this.gelaende;
    for (var i = 0; i < RS.length; i++) {
      var R = RS[i];
      if (C.x < R.x - 0.3 || C.x > R.x + 3) continue;
      if (st.vorwaerts < 0.5 || C.y - gel.hoeheBei(R.x) > 3.6) continue;
      var hc = 0;                                   // Abstand Schwerpunkt ↔ Unterkante der Räder (Räder ausgefedert)
      fz.raeder.forEach(function (Rd) { hc = Math.max(hc, Rd.r + Rd.L0 - Rd.ankerY); });
      this.roehre = { R: R, s: Math.max(0, C.x - R.x), v: Math.max(8, st.vorwaerts), hc: hc, t: 0, loopI: 0,
                      dx: 0, dy: 0, da: 0, z: 0, aVorher: null };
      var P0 = gel.roehrenPunkt(R, this.roehre.s), K = this.roehre;
      K.dx = C.x - (P0.x - Math.sin(P0.a) * hc); K.dy = C.y - (P0.y + Math.cos(P0.a) * hc); K.da = normWinkel(C.a - P0.a);
      while (K.loopI < R.pfad.loops.length && R.pfad.loops[K.loopI] <= K.s) K.loopI++;
      this.luftZeit = 0; this.luftDrehung = 0; this.flug = null;
      this.melde("roehre", { x: R.x, y: gel.hoeheBei(R.x) });
      return;
    }
  };

  /* In der Röhre: Das Auto gleitet die Fahrlinie entlang (nicht ganz echte Physik).
     Bergauf wird es nur etwas langsamer, ein Gebläse hält es auf ≈ 13 m/s (mit Gas
     16 m/s), nie unter 7 m/s – niemand bleibt stecken. Kein Benzinverbrauch. */
  Fahrt.prototype.roehrenSchritt = function (h, eingabe) {
    var K = this.roehre, R = K.R, fz = this.fz, C = fz.chassis, st = fz.status, gel = this.gelaende;
    K.t += h;
    var P = gel.roehrenPunkt(R, K.s);
    var vZiel = (eingabe.gas ? 16 : 13) + (this.boostZeit > 0 ? 5 : 0) + (this.miniZeit > 0 ? 3 : 0);
    K.v += (-this.welt.schwerkraft * Math.sin(P.a) * 0.45 + (vZiel - K.v) * 0.9) * h;
    K.v = Math.max(7, Math.min(24, K.v));
    if (this.boostZeit > 0) this.boostZeit = Math.max(0, this.boostZeit - h);
    if (this.miniZeit > 0) this.miniZeit = Math.max(0, this.miniZeit - h);
    if (this.federSperre > 0) this.federSperre = Math.max(0, this.federSperre - h);
    fz.duese = this.boostZeit; fz.mini = this.miniZeit; fz.feder = 0;
    K.s += K.v * h;
    while (K.loopI < R.pfad.loops.length && R.pfad.loops[K.loopI] <= K.s) {
      K.loopI++;
      var b = FF.CONFIG.regeln.roehrenLoopBonus;
      this.bonus += b; this.loopings = (this.loopings || 0) + 1;
      this.federLaden(1);
      this.melde("roehrenLoop", { bonus: b, x: C.x, y: C.y });
    }
    var fertig = K.s >= R.L;
    if (fertig) K.s = R.L;
    P = gel.roehrenPunkt(R, K.s);
    var Pv = gel.roehrenPunkt(R, Math.max(0, K.s - 0.5));
    var kr = (P.a - Pv.a) / Math.max(0.01, Math.min(0.5, K.s));     // Krümmung [rad/m]
    var blend = Math.max(0, 1 - K.t / 0.3); blend = blend * blend;  // erst sanft in die Fahrlinie gleiten
    var a = P.a + K.da * blend;
    var x = P.x - Math.sin(P.a) * K.hc + K.dx * blend, y = P.y + Math.cos(P.a) * K.hc + K.dy * blend;
    if (fertig) a = normWinkel(P.a);
    FF.Physik.setzePose(fz, x, y, a);
    var ca = Math.cos(P.a), sa = Math.sin(P.a);
    C.vx = K.v * ca; C.vy = K.v * sa; C.w = fertig ? 0 : kr * K.v;
    var nA = 0, dz = 0;
    fz.raeder.forEach(function (Rd) {
      Rd.k.vx = C.vx; Rd.k.vy = C.vy;
      Rd.k.w = C.w - K.v / Rd.r; Rd.k.a += Rd.k.w * h;
      if (Rd.antrieb) { dz += (K.v / Rd.r) / Rd.wMax; nA++; }
    });
    FF.Physik.anhaengerTempo(fz);
    K.z = P.z;
    st.radKontakte = fz.raeder.length; st.tempo = K.v; st.vorwaerts = K.v; st.leistung = 0;
    st.drehzahl = nA ? dz / nA : 0; st.huellKontakt = st.dachKontakt = st.kopfKontakt = false;
    if (C.x > this.strecke) this.strecke = C.x;
    if (!fertig) return;
    this.roehre = null;
    this.luftZeit = 0; this.luftDrehung = 0; this.flug = null;
    this.weitesterX = Math.max(this.weitesterX, C.x); this.festZeit = 0;
    this.melde("roehreAus", { x: C.x, y: C.y });
  };

  function v_quadrat(v) { return v * v; }

  /* Pfützen: Räder, die ins Wasser tauchen, spritzen (Ereignis "platsch") und
     bremsen das Auto: a = bremse · v² · Eintauchtiefe (Mittel über alle Räder).
     Die Bremse wirkt auf Karosserie und Räder gleich (wie die Schwerkraft). */
  Fahrt.prototype.wasser = function (h) {
    var gel = this.gelaende, W = this.welt.wasser, fz = this.fz, C = fz.chassis, self = this, tief = 0;
    fz.raeder.forEach(function (R) {
      var d = gel.wasserBei(R.k.x) - (R.k.y - R.r), drin = d > 0.03;
      if (drin) tief += Math.min(1, d / (1.4 * R.r));
      if (drin && !R.imWasser && Math.abs(R.k.vx) > 2.5 && self.zeit - self.letztesPlatsch > 0.3 && self.zustand === "fahrt") {
        self.letztesPlatsch = self.zeit;
        self.melde("platsch", { x: R.k.x, y: gel.wasserBei(R.k.x), staerke: Math.min(1, Math.abs(R.k.vy) / 6 + Math.abs(R.k.vx) / 14) });
      }
      R.imWasser = drin;
    });
    this.imWasser = tief > 0;
    if (!tief) return;
    tief /= fz.raeder.length;
    var a = W.bremse * tief * v_quadrat(C.vx);
    if (W.kleben) a += W.kleben * Math.min(1, tief / 0.3);   // Schleim klebt: bremst auch langsame Autos
    if (this.werte.matschFest) a *= this.werte.matschFest;     // Donner-Truck: pflügt hindurch
    var v = C.vx, dv = Math.min(Math.abs(v), a * h) * (v > 0 ? -1 : 1);
    C.vx += dv;
    fz.raeder.forEach(function (R) { R.k.vx += dv; });
  };

  /* Hüpfpilz (Trampolin): Berührt ein Rad den Pilzhut, fliegt das Auto senkrecht mit
     T.v hoch und mindestens mit 6 m/s nach vorn (damit es nicht auf demselben Pilz
     landet und ewig hüpft). Die Drehung wird gedämpft, damit es gerade hochgeht.
     Erst nach dem Abflug oder wenn das Auto den Pilz verlassen hat, geht er wieder. */
  Fahrt.prototype.pruefeTrampolin = function () {
    var T = this.gelaende.trampoline, fz = this.fz, C = fz.chassis;
    if (this.zustand !== "fahrt") return;
    for (var i = 0; i < T.length; i++) {
      var t = T[i];
      if (C.x < t.x0 - 8 || C.x > t.x1 + 8) { t.benutzt = false; continue; }
      if (t.benutzt) { if (this.luftZeit > 0.6) t.benutzt = false; continue; }
      var drauf = fz.raeder.some(function (R) { return R.kontakt.aktiv && R.kontakt.pen > -0.02 && R.k.x > t.x0 + 0.3 && R.k.x < t.x1 - 0.3; });
      if (!drauf) continue;
      t.benutzt = true; t.boing = this.zeit;
      var vx = C.vx < -1 ? Math.min(C.vx, -4) : Math.max(C.vx, 6), dvx = vx - C.vx, dvy = t.v - C.vy;
      FF.Physik.stoss(fz, dvx, dvy); C.w *= 0.3;
      this.melde("boing", { x: (t.x0 + t.x1) / 2, y: this.gelaende.hoeheBei((t.x0 + t.x1) / 2) });
    }
  };

  /* Objekte auf der Strecke: Wer hindurchfährt (nicht drüberfliegt), zerbricht sie.
     Glas zerspringt (das Auto verliert 7 % Tempo), kleine Bausteine fliegen weg (3 %),
     eine Baustein-Säule hält das Auto fast an (70 % Tempo weg) und zerfällt. */
  var OBJEKT_BREMSE = { glas: 0.93, stein: 0.97, saeule: 0.3 };
  Fahrt.prototype.pruefeObjekte = function () {
    var O = this.gelaende.objekte, fz = this.fz, C = fz.chassis, L = this.werte.groesse.laenge * 0.5;
    if (this.zustand !== "fahrt" && this.zustand !== "ziel") return;
    var unten = Infinity;
    fz.raeder.forEach(function (R) { unten = Math.min(unten, R.k.y - R.r); });
    unten = Math.min(unten, C.y - 0.2);
    for (var i = 0; i < O.length; i++) {
      var o = O[i];
      if (o.kaputt || o.x + o.b / 2 < C.x - L || o.x - o.b / 2 > C.x + L) continue;
      if (unten > o.y + o.h - 0.05) continue;                     // drübergeflogen
      o.kaputt = true;
      var f = OBJEKT_BREMSE[o.art] || 1;
      if (C.vx > 0) { var dv = C.vx * (f - 1); C.vx += dv; fz.raeder.forEach(function (R) { R.k.vx += dv; R.k.w *= f; }); }
      this.melde("objekt", { art: o.art, x: o.x, y: o.y, b: o.b, h: o.h, v: o.v, tempo: Math.abs(C.vx) });
    }
  };

  /* Förderband: Meldung beim Auffahren (Richtung und Tempo zeigt spiel.js) */
  Fahrt.prototype.pruefeBand = function () {
    var v = this.fz.status.radKontakte > 0 ? this.gelaende.bandBei(this.fz.chassis.x) : 0;
    if (v && !this.letztesBand && this.zustand === "fahrt") this.melde("band", { v: v });   // nur beim Auffahren
    if (v || this.fz.status.radKontakte > 0) this.letztesBand = v;
  };

  /* Sturm: Meldung, wenn kräftiger Rücken- oder Gegenwind beginnt (höchstens alle 6 s) */
  Fahrt.prototype.pruefeWind = function () {
    var n = this.gelaende.windBei(this.fz.chassis.x) / this.welt.wind.staerke;
    var zone = n > 0.6 ? 1 : (n < -0.6 ? -1 : (Math.abs(n) < 0.25 ? 0 : this.windZone));
    if (zone !== this.windZone) {
      if (zone && this.zeit - this.letzterWind > 6 && this.zustand === "fahrt") { this.letzterWind = this.zeit; this.melde("wind", { richtung: zone }); }
      this.windZone = zone;
    }
  };

  /* Flugphasen: Saltos und Luftsprünge.
     Ein Flug beginnt beim Abheben und endet erst, wenn das Auto wieder ruhig auf den
     Rädern steht – kurzes Aufsetzen mit Karosserie oder Kopf und Abpraller gehören
     noch zum Flug. Gezählt wird die Drehung RELATIV ZUM GELÄNDE: Wer mit erhobener
     Nase von der Schanze springt und auf dem Abhang landet, dreht sich bei einem
     Rückwärts-Salto absolut nur gut 290°, gegenüber dem Boden aber ganz herum. */
  Fahrt.prototype.pruefeLuft = function (h) {
    var st = this.fz.status, C = this.fz.chassis, Rg = FF.CONFIG.regeln, gel = this.gelaende;
    // Zug: solange ein Anhänger noch am Boden ist, fliegt er nicht (hängt nur über der Kante)
    var amBoden = st.radKontakte > 0 || st.huellKontakt || st.kopfKontakt || st.anhaengerBoden;
    if (!amBoden) {
      if (!this.flug) {
        // Bezug: der Hang unter dem hintersten Rad – das verlässt die Schanze zuletzt
        var xHinten = Infinity;
        this.fz.raeder.forEach(function (R) { xHinten = Math.min(xHinten, R.k.x); });
        this.flug = { zeit: 0, drehung: 0, boden0: Math.atan(gel.steigungBei(xHinten - 0.3)), ruhig: 0, nach: 0 };
      }
      this.luftZeit += h;
      this.flug.zeit += h; this.flug.drehung += C.w * h; this.flug.ruhig = 0; this.flug.nach = 0;
      this.luftDrehung = this.flug.drehung;
      return;
    }
    var schief = normWinkel(C.a - Math.atan(gel.steigungBei(C.x)));   // + = Nase zu hoch
    if (this.luftZeit > 0) {
      if (this.luftZeit > 0.3) this.melde("landung", { staerke: Math.min(1, this.luftZeit / 1.5) });
      // Bruchlandung: viel zu schief zum Hang aufgekommen
      if (this.bruchAn && this.zustand === "fahrt" && this.luftZeit > 0.45 && Math.abs(schief) > ((this.schw.bruchWinkel || 90) + (this.werte.bruchExtra || 0)) * Math.PI / 180) {
        this.luftZeit = 0; this.luftDrehung = 0; this.flug = null;
        this.melde("bruch", { nase: schief > 0 ? "hoch" : "tief" });
        this.starteHilfe();
        return;
      }
      if (this.luftZeit > this.besteLuftzeit) this.besteLuftzeit = this.luftZeit;
      this.luftZeit = 0;
    }
    var F = this.flug;
    if (!F) return;
    F.drehung += C.w * h; F.nach += h;
    var aufrecht = st.radKontakte > 0 && !st.kopfKontakt && Math.abs(schief) < 1.1;
    F.ruhig = aufrecht ? F.ruhig + h : 0;
    if (F.ruhig < 0.1 && F.nach < 1.5) return;          // noch nicht entschieden (Abpraller, Aufsetzen)
    this.flug = null; this.luftDrehung = 0;
    if (!aufrecht || this.zustand !== "fahrt") return;  // auf Dach oder Seite gelandet: kein Salto
    var relativ = F.drehung - (Math.atan(gel.steigungBei(C.x)) - F.boden0);
    var n = Math.floor((Math.abs(relativ) + 0.8) / ZWEI_PI);
    if (n >= 1) {
      var b = n * Rg.saltoBonus;
      this.salti += n; this.bonus += b;
      this.melde("salto", { anzahl: n, rueckwaerts: relativ > 0, bonus: b });
      this.federLaden(n);
    }
    var gFaktor = Math.sqrt(this.welt.schwerkraft / 9.81);   // auf dem Mond fliegt man länger
    var tWirk = F.zeit * gFaktor;
    if (tWirk >= Rg.luftZeitMin) {
      var lb = Math.round(tWirk * Rg.luftBonusProSekunde);
      this.bonus += lb;
      this.melde("luftsprung", { zeit: F.zeit, bonus: lb });
    }
  };

  /* Looping: Fährt das Auto unten in einen Looping hinein, wird die Kreisbahn aktiv
     (gelaende.loopKontakt) – bis es einmal ganz herum ist, rückwärts hinausrollt oder
     oben zu langsam war und herunterfällt (dann unten wieder ganz normal weiter). */
  Fahrt.prototype.pruefeLooping = function (h) {
    var gel = this.gelaende, Ls = gel.loopings;
    if (!Ls.length) return;
    var C = this.fz.chassis, st = this.fz.status, L = gel.aktiverLoop;
    if (!L) {
      if (this.zustand !== "fahrt" || st.radKontakte === 0 || st.vorwaerts < 2) return;
      for (var i = 0; i < Ls.length; i++) {
        var K = Ls[i];
        if (K.fertig || C.x < K.xc - 0.4 || C.x > K.xc + 1.2 || C.y > gel.loopMitte(K)) continue;
        if (this.fz.anhaenger.length) {              // Zug: viel zu lang für den Looping – rollt unten durch
          K.fertig = true;
          this.melde("zuLang", { x: C.x, y: C.y });
          continue;
        }
        gel.aktiverLoop = L = K;
        L.phi = Math.atan2(C.x - L.xc, -(C.y - L.yc)); L.summe = 0; L.ohneKontakt = 0; L.gefallen = false;
        this.imLooping = true;
        return;
      }
      return;
    }
    var phi = Math.atan2(C.x - L.xc, -(C.y - L.yc));
    L.summe += normWinkel(phi - L.phi); L.phi = phi;
    if (st.radKontakte === 0 && L.summe > 1.2 && L.summe < 5.2) L.ohneKontakt += h; else L.ohneKontakt = 0;
    if (L.ohneKontakt > 0.2) L.gefallen = true;              // oben zu langsam: fällt herunter
    var ende = null;
    if (L.summe >= 2 * Math.PI - 0.15) ende = "geschafft";
    else if (L.summe < -0.8) ende = "zurueck";
    else if (L.gefallen && st.radKontakte > 0 && C.y < L.yc - 0.5 * L.R) ende = "gefallen";
    else if (this.zustand !== "fahrt") ende = "hilfe";
    if (!ende) return;
    gel.aktiverLoop = null; this.imLooping = false;
    if (ende !== "zurueck") L.fertig = true;
    if (ende === "geschafft") {
      var b = FF.CONFIG.regeln.loopingBonus;
      this.bonus += b; this.loopings = (this.loopings || 0) + 1;
      this.melde("looping", { bonus: b, x: C.x, y: C.y });
      this.federLaden(1);
    }
  };

  /* Liegt das Auto auf dem Dach / Kopf / der Seite? → Ballon-Hilfe */
  Fahrt.prototype.pruefeHoppla = function (h) {
    var st = this.fz.status, C = this.fz.chassis, H = FF.CONFIG.regeln.hoppla;
    var kopfOderDach = st.kopfKontakt || st.dachKontakt;
    if (kopfOderDach) {
      this.liegeZeit += h;
      if (!this.kopfGemeldet) {
        this.kopfGemeldet = true;
        // nach hinten gekippt (Nase oben/hinten) und am Berg? → zu viel Gas am Berg
        this.melde("hoppla", { rueckwaerts: normWinkel(C.a) > 0.6, bergauf: this.gelaende.steigungBei(C.x) > 0.25 });
      }
    } else {
      this.liegeZeit = Math.max(0, this.liegeZeit - 2 * h);
      if (this.liegeZeit === 0) this.kopfGemeldet = false;
    }
    // Hochkant oder auf der Seite und es geht nicht mehr weiter?
    var aufDerSeite = Math.abs(normWinkel(C.a)) > H.seitenWinkel && (st.huellKontakt || st.radKontakte > 0) && st.tempo < 1.2;
    this.seitenZeit = aufDerSeite ? this.seitenZeit + h : 0;
    // Der Ballon kommt erst, wenn das Auto wirklich festliegt (Dach, Kopf, hochkant) –
    // nach 2 s ohne Pedal, oder nach 4 s, wenn man noch versucht, selbst freizukommen
    var pedal = this.gas > 0.5 || this.bremse > 0.5;
    var warte = pedal ? H.liegezeitMitPedal : H.liegezeit;
    if ((kopfOderDach && this.liegeZeit > warte) || this.seitenZeit > warte) this.starteHilfe();

    // Hängt das Auto fest oder rutscht es immer wieder den Steilhang hinunter? Gemessen
    // am Fortschritt: Kommt es trotz Pedal nicht über seinen weitesten Punkt hinaus, gibt
    // es erst einen Tipp, dann trägt der Ballon es über das Hindernis (kostet Benzin
    // wie ein Hoppla, aber kein Kind bleibt für immer stecken)
    var F = FF.CONFIG.regeln.fest;
    if (C.x > this.weitesterX + F.schritt) { this.weitesterX = C.x; this.festZeit = 0; }
    else if ((this.gas > 0.5 || this.bremse > 0.5) && this.tank > 0) this.festZeit += h;   // auch Anlauf-Versuche zählen
    var klemmt = this.gas > 0.9 && st.tempo < 0.6 && this.tank > 0 && st.radKontakte > 0;
    this.klemmZeit = klemmt ? this.klemmZeit + h : 0;
    if ((this.klemmZeit > 3 || this.festZeit > F.tipp) && this.zeit - this.letzterTipp > 12) {
      this.letzterTipp = this.zeit; this.klemmZeit = 0;
      this.melde("tipp", { text: "Nimm Anlauf! Fahr ein Stück zurück 🔙" });
    }
    if (this.festZeit > Math.min(this.welt.wolken ? this.welt.wolken.festHilfe : 99, this.werte.stabilisator ? F.hilfeLeicht : F.hilfe)) { this.starteHilfe(this.weitesterX); }   // Wolken: hängt man an der nächsten Wolke fest, hilft der Ballon schnell
  };

  /* Wo setzt der Ballon ab? Nicht mitten in einen Steilhang (von dort kommt
     man ohne Anlauf nicht weg), sondern auf eine flache Stelle: nach einem
     Überschlag oder einer Bruchlandung die nächste in der Nähe, sonst zurück an
     den Fuß des Hangs (dort kann man Anlauf nehmen – der Ballon ist keine
     Abkürzung). Wer festhängt (vorwaerts), wird über das Hindernis getragen;
     die längsten Steilstücke sind gut 35 m lang. */
  Fahrt.prototype.landeplatz = function (x, vorwaerts) {
    var gel = this.gelaende, ziel = this.endlos ? Infinity : gel.ziel - 2, d;
    var hinten = 1.5 + (this.zugHinten || 0);    // Zug: auch unter den Anhängern muss es passen
    function flach(xp) {                          // unter dem ganzen Auto höchstens ≈ 20° bergauf, 27° bergab
      for (var k = -hinten; k <= 1.5; k += 0.5) {
        var sk = gel.steigungBei(xp + k);
        if (sk > 0.36 || sk < -0.5 || gel.gesperrt(xp + k)) return false;
      }
      return true;
    }
    for (d = 0; d <= (vorwaerts ? 45 : 8) && x + d < ziel; d += 0.5) if (flach(x + d)) return x + d;
    for (d = 0.5; d <= 40 && x - d > 0; d += 0.5) if (flach(x - d)) return x - d;
    for (d = 0; d <= 45 && x + d < ziel; d += 0.5) if (flach(x + d)) return x + d;
    return x;
  };

  /* Ballon-Hilfe; ueberX: festgefahren → hinter diesem Punkt (weitester Fortschritt) absetzen */
  Fahrt.prototype.starteHilfe = function (ueberX) {
    var C = this.fz.chassis, gel = this.gelaende, H = FF.CONFIG.regeln.hoppla;
    this.boostZeit = 0; this.fz.duese = 0; this.miniZeit = 0; this.fz.mini = 0; this.umhangZeit = 0; this.fz.umhang = 0;
    var x1 = ueberX !== undefined ? this.landeplatz(Math.max(C.x, ueberX + 3 + this.zugHinten), true) : this.landeplatz(C.x);
    var zielA = Math.atan(gel.steigungBei(x1));
    // auf kürzestem Weg aufrichten
    var a0 = C.a, d = normWinkel(zielA - a0);
    this.hilfe = {
      t: 0, dauer: H.dauer,
      x: C.x, x0: C.x, x1: x1, y0: C.y, a0: a0, a1: a0 + d,
      yHoch: Math.max(C.y, gel.hoeheBei(C.x), gel.hoeheBei(x1)) + 2.6
    };
    // Höhle: Ballon samt Auto bleibt unter der Decke
    var unterDecke = Math.min(gel.deckeBei(C.x), gel.deckeBei(x1), gel.deckeBei((C.x + x1) / 2)) - this.werte.groesse.hoehe - 2.4;
    this.hilfe.yHoch = Math.max(Math.min(this.hilfe.yHoch, unterDecke), Math.max(gel.hoeheBei(C.x), gel.hoeheBei(x1)) + 1.2);
    this.zustand = "hilfe";
    if (gel.aktiverLoop) { gel.aktiverLoop.fertig = true; gel.aktiverLoop = null; this.imLooping = false; }
    this.hoppla++;
    this.liegeZeit = 0; this.seitenZeit = 0; this.kopfGemeldet = false;
    this.klemmZeit = 0; this.festZeit = 0; this.weitesterX = Math.max(this.weitesterX, x1);
    this.luftZeit = 0; this.luftDrehung = 0; this.flug = null;
    var abzug = this.schw.hopplaTank;
    this.tank = Math.max(0, this.tank - abzug);
    this.melde("hilfe", { abzug: abzug });
  };

  function weich(t) { t = Math.min(1, Math.max(0, t)); return t * t * (3 - 2 * t); }

  Fahrt.prototype.hilfeSchritt = function (h) {
    var hf = this.hilfe, fz = this.fz;
    hf.t += h;
    var u = hf.t / hf.dauer;
    if (u < 0.28) return;                          // Ballon schwebt herunter
    if (u < 0.68) {                                // anheben, aufrichten, zum Landeplatz schweben
      var q = weich((u - 0.28) / 0.4);
      hf.x = hf.x0 + (hf.x1 - hf.x0) * q;
      FF.Physik.setzePose(fz, hf.x, hf.y0 + (hf.yHoch - hf.y0) * q, hf.a0 + (hf.a1 - hf.a0) * q);
      return;
    }
    if (u < 1) {                                   // sanft absetzen
      if (hf.yBoden === undefined) {
        FF.Physik.setzeAufBoden(fz, this.gelaende, hf.x, hf.a1);
        hf.yBoden = fz.chassis.y;
      }
      var q2 = weich((u - 0.68) / 0.32);
      FF.Physik.setzePose(fz, hf.x, hf.yHoch + (hf.yBoden - hf.yHoch) * q2, hf.a1);
      return;
    }
    FF.Physik.setzeAufBoden(fz, this.gelaende, hf.x, hf.a1);
    this.hilfe = null;
    this.zustand = "fahrt";
    if (this.werte.kufen) this.schneeLegen(hf.x - 1.4, hf.x + 1.4);    // Schlitten: der Ballon setzt ihn auf ein Schneefeld
    this.melde("hilfeFertig");
  };

  /* Ziel erreicht? Tank leer? */
  Fahrt.prototype.pruefeEnde = function (h) {
    var Rg = FF.CONFIG.regeln, C = this.fz.chassis, st = this.fz.status;
    if (this.zustand === "fahrt" && !this.endlos && C.x >= this.gelaende.ziel) {
      this.zustand = "ziel";
      this.grund = "ziel";
      this.zielZeit = this.zeit;                       // exakter Zeitschritt der Zieldurchfahrt
      this.melde("ziel");
      return;
    }
    if (this.zustand === "ziel") {
      this.nachZielZeit += h;
      if (this.nachZielZeit > 2.2) { this.zustand = "ende"; this.melde("ende", { grund: "ziel" }); }
      return;
    }
    if (this.zustand !== "fahrt") return;
    if (this.tank <= 0) {
      if (!this.leerGemeldet) { this.leerGemeldet = true; this.melde("tankLeer"); }
      this.leerZeit += h;
      this.stillZeit = st.tempo < 0.35 ? this.stillZeit + h : 0;
      if (this.stillZeit > Rg.stillstandBisEnde || this.leerZeit > Rg.maxRollzeitLeer) {
        this.zustand = "ende"; this.grund = "leer";
        this.melde("ende", { grund: "leer" });
      }
    } else {
      this.leerZeit = 0; this.stillZeit = 0;
    }
  };

  /* Münzen und Kanister einsammeln */
  function untereGrenze(liste, x) {
    var lo = 0, hi = liste.length;
    while (lo < hi) { var mid = (lo + hi) >> 1; if (liste[mid].x < x) lo = mid + 1; else hi = mid; }
    return lo;
  }

  Fahrt.prototype.sammelPunkte = function () {
    var fz = this.fz, C = fz.chassis, ca = Math.cos(C.a), sa = Math.sin(C.a);
    var pkt = [], L = this.werte.groesse.laenge, H = this.werte.groesse.hoehe;
    fz.raeder.forEach(function (R) { pkt.push(R.k.x, R.k.y, R.r); });
    var kp = fz.kopf;
    pkt.push(C.x + ca * kp.x - sa * kp.y, C.y + sa * kp.x + ca * kp.y, kp.r + 0.1);
    for (var s = -0.35; s <= 0.36; s += 0.35) {
      var lx = s * L, ly = 0.15 * H;
      pkt.push(C.x + ca * lx - sa * ly, C.y + sa * lx + ca * ly, Math.min(0.7, H * 0.5));
    }
    return pkt;
  };

  Fahrt.prototype.sammle = function () {
    if (this.zustand === "ende") return;
    var gel = this.gelaende, C = this.fz.chassis, Rad = FF.CONFIG.regeln.sammelRadius;
    var pkt = this.sammelPunkte(), reichweite = this.werte.groesse.laenge * 0.5 + 2;
    var M = gel.muenzen, i, j, m, d;
    for (i = untereGrenze(M, C.x - reichweite); i < M.length && M[i].x < C.x + reichweite; i++) {
      m = M[i];
      if (m.weg) continue;
      for (j = 0; j < pkt.length; j += 3) {
        d = Math.hypot(m.x - pkt[j], m.y - pkt[j + 1]);
        if (d < Rad + pkt[j + 2] * 0.6) {
          m.weg = true;
          this.muenzen += m.wert;
          this.melde("muenze", { wert: m.wert, x: m.x, y: m.y });
          break;
        }
      }
    }
    var T = gel.tanks;
    for (i = 0; i < T.length; i++) {
      var t = T[i];
      if (t.weg || Math.abs(t.x - C.x) > reichweite) continue;
      for (j = 0; j < pkt.length; j += 3) {
        d = Math.hypot(t.x - pkt[j], t.y + 0.45 - pkt[j + 1]);
        if (d < Rad + 0.8 + pkt[j + 2] * 0.6) {         // großzügig: knapp drüber fliegen zählt auch
          t.weg = true;
          this.tank = 1;
          this.tankGewarnt = false; this.leerGemeldet = false;
          this.melde("tank", { x: t.x, y: t.y });
          break;
        }
      }
    }
    var X = FF.CONFIG.regeln.extras, RK = gel.raketen;
    for (i = 0; i < RK.length; i++) {
      var rk = RK[i];
      if (rk.weg || Math.abs(rk.x - C.x) > reichweite) continue;
      for (j = 0; j < pkt.length; j += 3) {
        d = Math.hypot(rk.x - pkt[j], rk.y + 0.45 - pkt[j + 1]);
        if (d < Rad + 0.8 + pkt[j + 2] * 0.6) {
          rk.weg = true;
          var neu = this.boostLadung < X.boostMax;
          if (neu) this.boostLadung++;
          this.melde("rakete", { x: rk.x, y: rk.y, voll: !neu });
          break;
        }
      }
    }
    var KZ = gel.katzen;                             // Superheldenwelt: Kätzchen retten
    for (i = 0; i < KZ.length; i++) {
      var kz = KZ[i];
      if (kz.weg || Math.abs(kz.x - C.x) > reichweite) continue;
      for (j = 0; j < pkt.length; j += 3) {
        if (Math.hypot(kz.x - pkt[j], kz.y - pkt[j + 1]) < Rad + 0.5 + pkt[j + 2] * 0.6) {
          kz.weg = true;
          this.muenzen += this.welt.held.katze.muenzen;
          this.melde("katze", { x: kz.x, y: kz.y, wert: this.welt.held.katze.muenzen });
          break;
        }
      }
    }
    var ZE = gel.zellen;                             // Telefonzelle: hindurchfahren (am Boden)
    for (i = 0; i < ZE.length; i++) {
      var ze = ZE[i];
      if (ze.benutzt || C.x < ze.x || C.x > ze.x + 3 || C.y - gel.hoeheBei(ze.x) > 3) continue;
      ze.benutzt = true;
      var HZ = this.welt.held;
      this.umhangZeit = HZ.zelle.dauer;
      this.miniZeit = HZ.turbo.dauer;
      this.melde("zelle", { x: ze.x, y: gel.hoeheBei(ze.x) });
    }
    var OB = gel.obst;                               // Obst: kurzer Mini-Turbo
    for (i = 0; i < OB.length; i++) {
      var ob = OB[i];
      if (ob.weg || Math.abs(ob.x - C.x) > reichweite) continue;
      for (j = 0; j < pkt.length; j += 3) {
        d = Math.hypot(ob.x - pkt[j], ob.y - pkt[j + 1]);
        if (d < Rad + 0.5 + pkt[j + 2] * 0.6) {
          ob.weg = true;
          this.miniZeit = this.welt.obst.dauer;
          this.melde("obst", { x: ob.x, y: ob.y, art: ob.art });
          break;
        }
      }
    }
  };

  /* Kopfüberwelt: Wer durch ein Umdreh-Tor fährt (auch im Flug), dreht das Bild um.
     Nur die Grafik dreht sich (spiel.js, grafik.js), die Physik bleibt gleich. */
  Fahrt.prototype.pruefeTore = function () {
    var T = this.gelaende.tore, x = this.fz.chassis.x;
    for (var i = 0; i < T.length; i++) {
      if (T[i].durch || x < T[i].x) continue;
      T[i].durch = true;
      this.kopf = !this.kopf;
      this.melde("umdrehen", { x: T[i].x, y: this.gelaende.hoeheBei(T[i].x), kopf: this.kopf });
    }
  };

  /* Ergebnis der Fahrt (für den Ergebnis-Bildschirm und das Konto) */
  Fahrt.prototype.ergebnis = function () {
    var Rg = FF.CONFIG.regeln;
    var ziel = this.grund === "ziel";
    var anteil = this.gelaende.muenzWertGesamt > 0 ? this.muenzen / this.gelaende.muenzWertGesamt : 0;
    var sterne = 0;
    if (ziel) sterne = 1 + (anteil >= Rg.sterne2 ? 1 : 0) + (anteil >= Rg.sterne3 ? 1 : 0);
    var zielBonus = ziel ? (Rg.zielBonusBasis + this.weltIndex * Rg.zielBonusZuschlag) * sterne : 0;
    return {
      grund: this.grund || "abbruch", ziel: ziel, endlos: this.endlos,
      muenzen: this.muenzen, bonus: this.bonus, zielBonus: zielBonus,
      gesamt: this.muenzen + this.bonus + zielBonus,
      sterne: sterne, anteil: anteil,
      strecke: Math.max(0, Math.round(this.strecke)), zeit: this.zeit,
      salti: this.salti, hoppla: this.hoppla, luftzeit: this.besteLuftzeit,
      zielZeit: ziel ? this.zielZeit : null
    };
  };

  /* Fortschritt 0..1 (für die Anzeige oben) */
  Fahrt.prototype.fortschritt = function () {
    if (this.endlos) return 0;
    return Math.max(0, Math.min(1, this.fz.chassis.x / this.gelaende.ziel));
  };

  FF.Fahrt = Fahrt;
  FF.Getriebe = Getriebe;
  FF.berechneWerte = berechneWerte;
  FF.fahrzeugDef = fahrzeugDef;
  FF.normWinkel = normWinkel;
})();
