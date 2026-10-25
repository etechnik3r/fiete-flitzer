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
    if (upg.allrad) w.raeder.forEach(function (r) { r.antrieb = true; });
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
    this.gaenge = this.elektro ? 1 : (this.P.gaenge || 4);
    this.leerlauf = this.elektro ? 0 : (this.P.leerlauf || 800);
    this.max = this.P.max || (this.elektro ? 12000 : 6000);
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
    if (this.gang === 1 && !this.elektro) rf = Math.max(rf, gas * 0.42);   // Kupplung schleift beim Anfahren
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
     o = { weltIndex, stufe (0..3), endlos, fahrzeugId, upgrades, schwierigkeit }
     ------------------------------------------------------------------------- */
  function Fahrt(o) {
    var C = FF.CONFIG;
    this.weltIndex = o.weltIndex;
    this.welt = C.welten[o.weltIndex];
    this.endlos = !!o.endlos;
    this.stufe = o.stufe || 0;
    var lv = this.endlos ? null : this.welt.level[this.stufe];
    this.gelaende = new FF.Gelaende(this.welt, {
      endlos: this.endlos, stufe: this.stufe,
      laenge: lv ? lv.laenge : 0,
      seed: lv ? lv.seed : (o.seed || 9000 + o.weltIndex * 31)
    });
    this.def = fahrzeugDef(o.fahrzeugId);
    this.werte = berechneWerte(this.def, o.upgrades, o.schwierigkeit);
    this.schw = C.schwierigkeit[o.schwierigkeit] || C.schwierigkeit.normal;
    this.bruchAn = o.bruchlandung !== false;   // Einstellung „Bruchlandung“ (aus: Auto prallt ab und fährt weiter)
    this.fz = FF.Physik.baueFahrzeug(this.werte, 0, this.gelaende);

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
    this.zeit = 0; this.strecke = 0; this.akku = 0;
    this.zustand = "fahrt";        // fahrt | hilfe | ziel | ende
    this.grund = null;             // "ziel" | "leer"
    this.ereignisse = [];
    this.luftZeit = 0; this.luftDrehung = 0;
    this.leerZeit = 0; this.stillZeit = 0; this.liegeZeit = 0; this.seitenZeit = 0;
    this.klemmZeit = 0; this.letzterTipp = -99; this.festZeit = 0; this.weitesterX = 0;
    this.tankGewarnt = false; this.leerGemeldet = false; this.kopfGemeldet = false;
    this.hilfe = null;
    this.zielZeit = null;            // Zeitpunkt der Zieldurchfahrt [s]
    this.nachZielZeit = 0;           // wie lange schon hinter dem Ziel
    this.naechsterMeilenstein = 500;
  }

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

    this.setzeAntrieb();
    this.setzeZusatzMoment();
    FF.Physik.schritt(fz, this.gelaende, this.welt, h);

    // Tankverbrauch: Leerlauf + Gasstellung + abgegebene Leistung
    if (this.zustand === "fahrt" && this.tank > 0) {
      var gasWirk = this.gas + (this.rueckwaerts ? 0.6 * this.bremse : 0);
      var pAnteil = Math.min(1, st.leistung / this.leistungMax);
      var L = w.leerlauf !== undefined ? w.leerlauf : Rg.leerlaufAnteil;
      this.tank -= (L + (1 - L) * (0.55 * Math.min(1, gasWirk) + 0.45 * pAnteil)) / w.tankSekunden * h;
      if (!this.tankGewarnt && this.tank < Rg.tankWarnung) { this.tankGewarnt = true; this.melde("tankWarnung"); }
      if (this.tank <= 0) { this.tank = 0; }
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

    for (var i = 0; i < nAlle; i++) {
      var R = fz.raeder[i];
      var rel = Math.abs(R.k.w - C.w);
      var wEck = this.eck * R.wMax;
      var Tkurve = rel <= wEck ? Tmax : Tmax * wEck / rel;   // konstantes Moment, dann konstante Leistung
      if (this.gas > 0.01 && motorAn) {
        R.motorZiel = -R.wMax;                               // vorwärts = Rad dreht im Uhrzeigersinn
        R.motorMax = R.antrieb ? Tkurve * this.gas / nA : 0;
      } else if (bremsen) {
        R.motorZiel = 0;
        R.motorMax = w.bremse * this.bremse / nAlle;
      } else if (this.rueckwaerts && motorAn) {
        R.motorZiel = R.wMax * S.rueckwaertsTempo;
        R.motorMax = R.antrieb ? Tkurve * S.rueckwaertsKraft * this.bremse / nA : 0;
      } else {
        // ohne Pedal: Motorbremse – beim Elektroauto stärker (Generator lädt den Akku)
        R.motorZiel = 0;
        R.motorMax = R.antrieb && motorAn ? Tmax * (w.rekuperation ? S.motorBremseElektro : S.motorBremse) / nA : 0;
      }
    }
  };

  /* Luftsteuerung (Spiel-Hilfe) und – im Modus "Leicht" – ein sanfter Stabilisator */
  Fahrt.prototype.setzeZusatzMoment = function () {
    var fz = this.fz, C = fz.chassis, st = fz.status, w = this.werte, J = C.J;
    var M = 0;
    var inDerLuft = st.radKontakte === 0 && !st.huellKontakt && !st.kopfKontakt;
    if (this.zustand === "fahrt" && inDerLuft) {
      var steuer = this.gas - this.bremse;                   // + = Nase hoch
      M = steuer * w.luftsteuerung * J;
      if ((steuer > 0 && C.w > 5.5) || (steuer < 0 && C.w < -5.5)) M = 0;
      if (w.stabilisator && Math.abs(steuer) < 0.1) {
        M += (-3 * normWinkel(C.a) - 1.5 * C.w) * J * w.stabilisator;
      }
    } else if (w.stabilisator && st.radKontakte > 0) {
      var d = normWinkel(C.a - Math.atan(this.gelaende.steigungBei(C.x)));
      var frei = 0.4;
      if (Math.abs(d) > frei) {
        var M2 = (-(d - Math.sign(d) * frei) * 20 - C.w * 3) * J * w.stabilisator;
        M += Math.max(-J * 12, Math.min(J * 12, M2));
      }
    }
    fz.zusatzMoment = M;
  };

  /* Flugphasen: Saltos und Luftsprünge */
  Fahrt.prototype.pruefeLuft = function (h) {
    var st = this.fz.status, C = this.fz.chassis, Rg = FF.CONFIG.regeln;
    var amBoden = st.radKontakte > 0 || st.huellKontakt || st.kopfKontakt;
    if (!amBoden) {
      this.luftZeit += h;
      this.luftDrehung += C.w * h;
      return;
    }
    if (this.luftZeit > 0) {
      var schief = normWinkel(C.a - Math.atan(this.gelaende.steigungBei(C.x)));   // + = Nase zu hoch
      var aufrecht = st.radKontakte > 0 && Math.abs(schief) < 1.1;
      if (this.luftZeit > 0.3) this.melde("landung", { staerke: Math.min(1, this.luftZeit / 1.5) });
      // Bruchlandung: viel zu schief zum Hang aufgekommen
      if (this.bruchAn && this.zustand === "fahrt" && this.luftZeit > 0.45 && Math.abs(schief) > (this.schw.bruchWinkel || 90) * Math.PI / 180) {
        this.luftZeit = 0; this.luftDrehung = 0;
        this.melde("bruch", { nase: schief > 0 ? "hoch" : "tief" });
        this.starteHilfe();
        return;
      }
      if (aufrecht && this.zustand === "fahrt") {
        var n = Math.floor((Math.abs(this.luftDrehung) + 0.7) / ZWEI_PI);
        if (n >= 1) {
          var b = n * Rg.saltoBonus;
          this.salti += n; this.bonus += b;
          this.melde("salto", { anzahl: n, rueckwaerts: this.luftDrehung > 0, bonus: b });
        }
        var gFaktor = Math.sqrt(this.welt.schwerkraft / 9.81);   // auf dem Mond fliegt man länger
        var tWirk = this.luftZeit * gFaktor;
        if (tWirk >= Rg.luftZeitMin) {
          var lb = Math.round(tWirk * Rg.luftBonusProSekunde);
          this.bonus += lb;
          this.melde("luftsprung", { zeit: this.luftZeit, bonus: lb });
        }
        if (this.luftZeit > this.besteLuftzeit) this.besteLuftzeit = this.luftZeit;
      }
      this.luftZeit = 0; this.luftDrehung = 0;
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
    if (this.festZeit > (this.werte.stabilisator ? F.hilfeLeicht : F.hilfe)) { this.starteHilfe(this.weitesterX); }
  };

  /* Wo setzt der Ballon ab? Nicht mitten in einen Steilhang (von dort kommt
     man ohne Anlauf nicht weg), sondern auf eine flache Stelle: nach einem
     Überschlag oder einer Bruchlandung die nächste in der Nähe, sonst zurück an
     den Fuß des Hangs (dort kann man Anlauf nehmen – der Ballon ist keine
     Abkürzung). Wer festhängt (vorwaerts), wird über das Hindernis getragen;
     die längsten Steilstücke sind gut 35 m lang. */
  Fahrt.prototype.landeplatz = function (x, vorwaerts) {
    var gel = this.gelaende, ziel = this.endlos ? Infinity : gel.ziel - 2, d;
    function flach(xp) {                          // unter dem ganzen Auto höchstens ≈ 20° bergauf, 27° bergab
      for (var k = -1.5; k <= 1.5; k += 0.5) {
        var sk = gel.steigungBei(xp + k);
        if (sk > 0.36 || sk < -0.5) return false;
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
    var x1 = ueberX !== undefined ? this.landeplatz(Math.max(C.x, ueberX + 3), true) : this.landeplatz(C.x);
    var zielA = Math.atan(gel.steigungBei(x1));
    // auf kürzestem Weg aufrichten
    var a0 = C.a, d = normWinkel(zielA - a0);
    this.hilfe = {
      t: 0, dauer: H.dauer,
      x: C.x, x0: C.x, x1: x1, y0: C.y, a0: a0, a1: a0 + d,
      yHoch: Math.max(C.y, gel.hoeheBei(C.x), gel.hoeheBei(x1)) + 2.6
    };
    this.zustand = "hilfe";
    this.hoppla++;
    this.liegeZeit = 0; this.seitenZeit = 0; this.kopfGemeldet = false;
    this.klemmZeit = 0; this.festZeit = 0; this.weitesterX = Math.max(this.weitesterX, x1);
    this.luftZeit = 0; this.luftDrehung = 0;
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
