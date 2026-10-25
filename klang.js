/* ===========================================================================
   Fiete Flitzer – klang.js
   ---------------------------------------------------------------------------
   Alle Töne entstehen live per WebAudio (keine Sound-Dateien nötig):
     • Motor: je Fahrzeug ein eigener Klang (Verbrenner mit Zündtakt,
       Auspuff-Resonanz und Gängen, oder Elektromotor mit Surren und
       Fußgänger-Warnklang), dazu Abroll- und Windgeräusche – siehe unten.
     • Kurze Effekte: Münze, Kanister ("gluck-gluck"), Salto-Fanfare,
       Landung, Ballon-Hilfe, Ziel-Fanfare, Tank-Warnung …
   Bewusst KEINE erschreckenden oder ekligen Geräusche – alles freundlich.

   Sprachausgabe (Vorlesen für Kinder, die noch nicht lesen) läuft über die
   Sprachsynthese des Browsers.

   EIGENE SOUNDS: in spiele() einfach eine Audio-Datei abspielen.
   =========================================================================== */

var FF = globalThis.FF = globalThis.FF || {};

(function () {
  "use strict";

  var ctx = null, master = null, motor = null;
  var an = true, sprachAn = true;

  function init() {
    if (ctx) { if (ctx.state === "suspended") ctx.resume(); return; }
    var AC = window.AudioContext || window.webkitAudioContext;
    if (!AC) return;
    ctx = new AC();
    master = ctx.createGain();
    master.gain.value = an ? 0.8 : 0;
    master.connect(ctx.destination);
  }

  function setzeAn(wert) {
    an = wert;
    if (master) master.gain.setTargetAtTime(an ? 0.8 : 0, ctx.currentTime, 0.05);
  }

  /* ---------- Bausteine ---------- */
  function ton(frequenz, start, dauer, typ, lautstaerke, zielFrequenz) {
    if (!ctx) return;
    var t = ctx.currentTime + (start || 0);
    var o = ctx.createOscillator(), g = ctx.createGain();
    o.type = typ || "sine";
    o.frequency.setValueAtTime(frequenz, t);
    if (zielFrequenz) o.frequency.exponentialRampToValueAtTime(zielFrequenz, t + dauer);
    g.gain.setValueAtTime(0.0001, t);
    g.gain.exponentialRampToValueAtTime(lautstaerke || 0.2, t + 0.012);
    g.gain.exponentialRampToValueAtTime(0.0001, t + dauer);
    o.connect(g); g.connect(master);
    o.start(t); o.stop(t + dauer + 0.05);
  }

  var rauschPuffer = null;
  function rauschen(start, dauer, lautstaerke, filterFrequenz) {
    if (!ctx) return;
    if (!rauschPuffer) {
      rauschPuffer = ctx.createBuffer(1, ctx.sampleRate * 0.5, ctx.sampleRate);
      var d = rauschPuffer.getChannelData(0);
      for (var i = 0; i < d.length; i++) d[i] = Math.random() * 2 - 1;
    }
    var t = ctx.currentTime + (start || 0);
    var q = ctx.createBufferSource(); q.buffer = rauschPuffer;
    var f = ctx.createBiquadFilter(); f.type = "lowpass"; f.frequency.value = filterFrequenz || 400;
    var g = ctx.createGain();
    g.gain.setValueAtTime(lautstaerke || 0.2, t);
    g.gain.exponentialRampToValueAtTime(0.0001, t + dauer);
    q.connect(f); f.connect(g); g.connect(master);
    q.start(t); q.stop(t + dauer + 0.05);
  }

  /* =========================================================================
     MOTOR
     Verbrenner – nach dem Puls-Resonator-Prinzip (vgl. Baldan et al. 2015;
     Doerfler & Wyse 2026):
       • Ein Arbeitsspiel (4-Takt: zwei Kurbelwellen-Umdrehungen) wird als
         Wellenform gebaut: je Zylinder ein Auspuff-Druckstoß (schneller
         Anstieg, abklingend), leicht ungleich wie bei echten Motoren
         ("Blubbern"). Per Fourier-Reihe → PeriodicWave. Der Oszillator läuft
         mit der Arbeitsspiel-Frequenz f = n/120 (4-Takt) bzw. n/60 (2-Takt),
         n in U/min; die Zündfrequenz ist f · Zylinderzahl.
       • Auspuffrohr = Kammfilter mit Rückkopplung (Laufzeit ≈ 2·Rohrlänge/c):
         feste Resonanzen, die NICHT mit der Drehzahl wandern – deshalb klingt
         es nach Motor statt nach Synthesizer. Dazu eine Körperresonanz,
         Sättigung unter Last und ein Tiefpass, der mit der Drehzahl öffnet.
       • Verbrennungsrauschen im Takt der Druckstöße (Diesel: "Nageln").
       • Virtuelles Getriebe (FF.Getriebe in fahrt.js, dieselbe Drehzahl
         zeigt der Drehzahlmesser): Gang nach Fahrtempo, Drehzahl aus der
         Raddrehzahl → hörbares Schalten; in der Luft dreht der Motor in den
         Drehzahlbegrenzer. Zufällige Schwankungen je Arbeitsspiel.
     Elektro: leises Motor-Surren (Ton ∝ Drehzahl, gleitet mit der Trägheit
       des Rotors), Getriebe-Heulen, Umrichter-Pfeifen beim Anfahren und unter
       20 km/h ein Warnklang (AVAS, EU 540/2014).
     Fahrgeräusche für alle: Abrollen und Reifenrauschen (nur mit Bodenkontakt)
       und Fahrtwind (∝ v², nur wo es Luft gibt – auf dem Mond bleibt es still).
     Die Klang-Profile stehen in config.js bei jedem Fahrzeug unter "klang".
     ========================================================================= */
  var rauschPuffer2 = {};
  function rauschQuelle(ac) {
    var b = rauschPuffer2[ac.sampleRate];
    if (!b) {
      b = rauschPuffer2[ac.sampleRate] = ac.createBuffer(1, ac.sampleRate * 2, ac.sampleRate);
      var d = b.getChannelData(0), z = 1;
      for (var i = 0; i < d.length; i++) { z = (z * 16807) % 2147483647; d[i] = z / 1073741823.5 - 1; }
    }
    var q = ac.createBufferSource(); q.buffer = b; q.loop = true;
    return q;
  }

  /* Ein Arbeitsspiel als PeriodicWave (je Fahrzeug einmal berechnet) */
  var wellenCache = typeof WeakMap === "function" ? new WeakMap() : null;
  function zyklusWelle(ac, P) {
    var key = [P.zylinder, P.abkling, P.ungleich, P.v8 ? 1 : 0, P.leerlauf].join("|");
    var proAc = wellenCache && wellenCache.get(ac);
    if (proAc && proAc[key]) return proAc[key];
    var M = 2048, x = new Float32Array(M), n = P.zylinder, z = 4242 + n * 977 + P.leerlauf;
    function zuf() { z = (z * 16807) % 2147483647; return z / 2147483647; }
    for (var k = 0; k < n; k++) {
      var phase = (k + (zuf() - 0.5) * 0.14 * P.ungleich) / n;
      var amp = 1 + (zuf() - 0.5) * 0.9 * P.ungleich;
      if (P.v8) amp *= k % 2 ? 0.78 : 1.18;              // Kreuzebenen-V8: Bänke ungleich → Bollern
      for (var m = 0; m < M; m++) {
        var t = m / M - phase; t -= Math.floor(t); t *= n;   // Zeit seit der Zündung in Zündabständen
        x[m] += amp * (1 - Math.exp(-t * 30)) * Math.exp(-t * P.abkling);
      }
    }
    var N = 220, re = new Float32Array(N + 1), im = new Float32Array(N + 1);
    var cos = new Float32Array(M), sin = new Float32Array(M);
    for (m = 0; m < M; m++) { cos[m] = Math.cos(2 * Math.PI * m / M); sin[m] = Math.sin(2 * Math.PI * m / M); }
    for (var h = 1; h <= N; h++) {
      var a = 0, b = 0;
      for (m = 0; m < M; m++) { var j = (h * m) % M; a += x[m] * cos[j]; b += x[m] * sin[j]; }
      re[h] = a / M; im[h] = b / M;
    }
    var welle = ac.createPeriodicWave(re, im);
    if (wellenCache) { if (!proAc) wellenCache.set(ac, proAc = {}); proAc[key] = welle; }
    return welle;
  }

  function saettigung(staerke) {
    var n = 1024, c = new Float32Array(n), k = staerke;
    for (var i = 0; i < n; i++) { var x = i / (n - 1) * 2 - 1; c[i] = Math.tanh(k * x) / Math.tanh(k); }
    return c;
  }

  /* Ein Motor-Klang an einem AudioContext (live oder offline zum Testen).
     P = Klang-Profil aus config.js, ziel = Ausgang (GainNode). */
  function Motor(ac, ziel, P) {
    this.ac = ac; this.P = P;
    this.bus = ac.createGain(); this.bus.gain.value = 1; this.bus.connect(ziel);
    this.quellen = [];
    this.rpm = 0; this.t0 = ac.currentTime;
    this.zz = 99991;
    if (P.art === "elektro") this.baueElektro(); else this.baueVerbrenner();
    this.baueFahrgeraeusch();
  }
  Motor.prototype.zufall = function () { this.zz = (this.zz * 16807) % 2147483647; return this.zz / 2147483647; };
  Motor.prototype.starte = function (q) { q.start(); this.quellen.push(q); return q; };

  Motor.prototype.baueVerbrenner = function () {
    var ac = this.ac, P = this.P;
    var osc = ac.createOscillator(); osc.setPeriodicWave(zyklusWelle(ac, P)); osc.frequency.value = 5;
    var vor = ac.createGain(); vor.gain.value = 1;
    var form = ac.createWaveShaper(); form.curve = saettigung(2.2); form.oversample = "2x";
    var rohrEin = ac.createGain();
    var rohr = ac.createDelay(0.05); rohr.delayTime.value = P.rohr;
    var rueck = ac.createGain(); rueck.gain.value = P.rueck;
    var hp = ac.createBiquadFilter(); hp.type = "highpass"; hp.frequency.value = 32;
    var koerper = ac.createBiquadFilter(); koerper.type = "peaking"; koerper.frequency.value = P.koerper; koerper.Q.value = 1.1; koerper.gain.value = 7;
    var tp = ac.createBiquadFilter(); tp.type = "lowpass"; tp.frequency.value = 800; tp.Q.value = 0.8;
    var laut = ac.createGain(); laut.gain.value = 0;
    osc.connect(vor); vor.connect(form); form.connect(rohrEin);
    rohrEin.connect(rohr); rohr.connect(rueck); rueck.connect(rohrEin);
    rohrEin.connect(hp); hp.connect(koerper); koerper.connect(tp); tp.connect(laut); laut.connect(this.bus);

    // Verbrennungsrauschen, im Takt der Druckstöße moduliert (Diesel: Nageln)
    var rq = rauschQuelle(ac);
    var rbp = ac.createBiquadFilter(); rbp.type = "bandpass"; rbp.frequency.value = P.diesel > 0.4 ? 2600 : 1500; rbp.Q.value = 0.9;
    var rg = ac.createGain(); rg.gain.value = 0;
    var am = ac.createGain(); am.gain.value = 0;
    rq.connect(rbp); rbp.connect(rg); rg.connect(rohrEin);
    osc.connect(am); am.connect(rg.gain);

    // Tiefe Grundschwingung für "Wumms" (Zündfrequenz, beim V8 die halbe)
    var sub = ac.createOscillator(); sub.type = "sine"; sub.frequency.value = 20;
    var subG = ac.createGain(); subG.gain.value = 0;
    sub.connect(subG); subG.connect(laut);

    // Anlasser (nur kurz beim Start)
    var anl = ac.createOscillator(); anl.type = "sawtooth"; anl.frequency.value = 95;
    var anlTp = ac.createBiquadFilter(); anlTp.type = "lowpass"; anlTp.frequency.value = 900;
    var anlG = ac.createGain(); anlG.gain.value = 0;
    anl.connect(anlTp); anlTp.connect(anlG); anlG.connect(this.bus);
    var t = ac.currentTime;
    anlG.gain.setValueAtTime(0, t);
    anlG.gain.linearRampToValueAtTime(0.035, t + 0.05);
    anlG.gain.setValueAtTime(0.035, t + 0.42);
    anlG.gain.linearRampToValueAtTime(0, t + 0.5);
    anl.frequency.setValueAtTime(70, t); anl.frequency.linearRampToValueAtTime(115, t + 0.45);
    anl.start(t); anl.stop(t + 0.55);

    [osc, rq, sub].forEach(this.starte, this);
    this.v = { osc: osc, vor: vor, tp: tp, laut: laut, rg: rg, am: am, sub: sub, subG: subG };
  };

  Motor.prototype.baueElektro = function () {
    var ac = this.ac, P = this.P;
    var surr = ac.createOscillator(); surr.type = "sine";
    var heul = ac.createOscillator(); heul.type = "triangle";
    var pwm = ac.createOscillator(); pwm.type = "square";
    var pwmBp = ac.createBiquadFilter(); pwmBp.type = "bandpass"; pwmBp.Q.value = 7; pwmBp.frequency.value = 2400;
    var gS = ac.createGain(), gH = ac.createGain(), gP = ac.createGain();
    [gS, gH, gP].forEach(function (g) { g.gain.value = 0; });
    var hp = ac.createBiquadFilter(); hp.type = "highpass"; hp.frequency.value = 50;
    surr.connect(gS); heul.connect(gH); pwm.connect(pwmBp); pwmBp.connect(gP);
    gS.connect(hp); gH.connect(hp); gP.connect(hp); hp.connect(this.bus);
    // Leises Wabern (Mondmobil: "Weltraum"-Klang)
    var lfo = ac.createOscillator(); lfo.frequency.value = P.weltraum ? 5.5 : 0.7;
    var lfoG = ac.createGain(); lfoG.gain.value = P.weltraum ? 30 : 6;   // Cent
    lfo.connect(lfoG); lfoG.connect(surr.detune); lfoG.connect(heul.detune);
    // AVAS: zwei weiche Töne (Quinte) mit Tremolo, nur langsam unterwegs
    var a1 = ac.createOscillator(), a2 = ac.createOscillator(); a1.type = a2.type = "sine";
    a1.frequency.value = P.avasTon; a2.frequency.value = P.avasTon * 1.5;
    var aG = ac.createGain(); aG.gain.value = 0;
    var trem = ac.createOscillator(); trem.frequency.value = 3.2;
    var tremG = ac.createGain(); tremG.gain.value = 0;
    trem.connect(tremG); tremG.connect(aG.gain);
    a1.connect(aG); a2.connect(aG); aG.connect(this.bus);
    // Einschalt-Klang ("Bereit!")
    var t = ac.currentTime;
    var ein = ac.createOscillator(), einG = ac.createGain(); ein.type = "sine";
    ein.frequency.setValueAtTime(P.avasTon * 0.75, t); ein.frequency.exponentialRampToValueAtTime(P.avasTon * 2, t + 0.35);
    einG.gain.setValueAtTime(0.0001, t); einG.gain.exponentialRampToValueAtTime(0.06, t + 0.04); einG.gain.exponentialRampToValueAtTime(0.0001, t + 0.5);
    ein.connect(einG); einG.connect(this.bus); ein.start(t); ein.stop(t + 0.55);
    [surr, heul, pwm, lfo, a1, a2, trem].forEach(this.starte, this);
    this.v = { surr: surr, heul: heul, pwm: pwm, gS: gS, gH: gH, gP: gP, aG: aG, a1: a1, a2: a2, tremG: tremG };
  };

  Motor.prototype.baueFahrgeraeusch = function () {
    var ac = this.ac;
    var q = rauschQuelle(ac);
    var rTp = ac.createBiquadFilter(); rTp.type = "lowpass"; rTp.frequency.value = 200; rTp.Q.value = 0.5;
    var rG = ac.createGain(); rG.gain.value = 0;
    // Reifen auf der Straße: breites Rauschen um 1 kHz (beim E-Auto das lauteste Fahrgeräusch)
    var pBp = ac.createBiquadFilter(); pBp.type = "bandpass"; pBp.frequency.value = 900; pBp.Q.value = 0.45;
    var pG = ac.createGain(); pG.gain.value = 0;
    var wBp = ac.createBiquadFilter(); wBp.type = "bandpass"; wBp.frequency.value = 600; wBp.Q.value = 0.6;
    var wG = ac.createGain(); wG.gain.value = 0;
    q.connect(rTp); rTp.connect(rG); rG.connect(this.bus);
    q.connect(pBp); pBp.connect(pG); pG.connect(this.bus);
    q.connect(wBp); wBp.connect(wG); wG.connect(this.bus);
    this.starte(q);
    this.f = { rTp: rTp, rG: rG, pBp: pBp, pG: pG, wBp: wBp, wG: wG };
  };

  /* z = { drehzahl (Raddrehzahl/Höchstdrehzahl), gas (Motorlast 0..1, auch rückwärts),
           bremse, rueckwaerts, laeuft, tempo [m/s], vmax [m/s], boden (Räder am Boden),
           luft (Luft vorhanden), getriebe (FF.Getriebe der Fahrt – dieselbe Drehzahl wie
           der Drehzahlmesser; fehlt es, rechnet der Klang selbst), probe (Garage: Leerlauf
           ohne Gang), stumm, dt [s] } */
  Motor.prototype.setze = function (z) {
    var ac = this.ac, t = ac.currentTime, P = this.P, dt = Math.min(0.1, z.dt || 1 / 60);
    this.bus.gain.setTargetAtTime(z.stumm ? 0 : 1, t, 0.04);
    if (z.stumm) return;
    var tempo = Math.max(0, z.tempo || 0), vmax = z.vmax || 15;
    var r = Math.max(0, z.drehzahl || 0), v = tempo / vmax;
    var gas = z.laeuft ? (z.gas || 0) : 0;

    // Fahrgeräusche
    var ab = P.abrollen || 1;
    this.f.rG.gain.setTargetAtTime(z.boden ? 0.05 * Math.min(1, tempo / 14) * ab : 0, t, 0.08);
    this.f.rTp.frequency.setTargetAtTime(170 + 32 * tempo, t, 0.1);
    this.f.pG.gain.setTargetAtTime(z.boden ? 0.02 * Math.min(1, tempo / 18) * ab : 0, t, 0.08);
    this.f.pBp.frequency.setTargetAtTime(650 + 18 * tempo, t, 0.1);
    this.f.wG.gain.setTargetAtTime(z.luft === false ? 0 : 0.04 * Math.min(1, Math.pow(tempo / 24, 2)), t, 0.15);
    this.f.wBp.frequency.setTargetAtTime(380 + 48 * tempo, t, 0.15);

    // Getriebe: aus der Fahrt (dieselbe Drehzahl wie der Drehzahlmesser), sonst ein eigenes
    var gt = z.probe ? this.leerlaufGetriebe(r, dt)
           : z.getriebe || (this.getriebe = this.getriebe || new FF.Getriebe(P)).schritt(r, v, gas, z.boden, z.laeuft, dt);
    if (P.art === "elektro") return this.setzeElektro(z, gt, tempo, gas, t, dt);

    var abgeregelt = gt.begrenzer && Math.sin(t * 2 * Math.PI * 12) < 0;   // Begrenzer unterbricht die Zündung
    var last = gt.schalten ? gas * 0.45 : (abgeregelt ? gas * 0.3 : gas);

    var seitStart = t - this.t0, ziel;
    if (!z.laeuft) ziel = gt.rpm;
    else if (seitStart < 0.45) ziel = 230;                        // Anlasser dreht den Motor durch
    else if (seitStart < 0.75) ziel = P.leerlauf * 1.7;           // springt an: kurz hochdrehen
    else ziel = gt.rpm * (abgeregelt ? 0.95 : 1);
    this.rpm += (ziel - this.rpm) * Math.min(1, dt * (seitStart < 0.75 ? P.traegheit : 40));
    var rpm = Math.max(0, this.rpm);
    var fZyklus = rpm / (P.takte === 2 ? 60 : 120);
    var fZuend = fZyklus * P.zylinder;
    var V = this.v, rel = Math.max(0, Math.min(1, (rpm - P.leerlauf) / (P.max - P.leerlauf)));

    // Unruhe und Lautstärke schwanken von Arbeitsspiel zu Arbeitsspiel (im Leerlauf mehr) –
    // neu ausgewürfelt wird je Arbeitsspiel, nicht je Bild (sonst hinge es von der Bildrate ab)
    this.zyklus = (this.zyklus || 0) + fZyklus * dt;
    if (this.zyklus >= 1 || this.unruheWert === undefined) {
      this.zyklus %= 1;
      this.unruheWert = this.zufall() - 0.5;
      this.lautWert = this.zufall() - 0.5;
    }
    V.osc.frequency.setTargetAtTime(Math.max(1, fZyklus), t, 0.012);
    V.osc.detune.setTargetAtTime(this.unruheWert * 2 * P.unruhe * (1.6 - rel), t, 0.02);
    V.sub.frequency.setTargetAtTime(Math.max(1, P.v8 ? fZuend / 2 : fZuend), t, 0.015);
    V.vor.gain.setTargetAtTime(0.55 + 1.9 * last, t, 0.03);
    V.tp.frequency.setTargetAtTime(Math.min(9000, P.hell * (520 + 2900 * Math.pow(rel, 0.8) + 1700 * last)), t, 0.04);
    var laut = rpm < 60 ? 0 : P.lautstaerke * (0.45 + 0.55 * last) * (0.65 + 0.35 * rel);
    laut *= 1 + this.lautWert * 0.14 * (1.3 - rel);
    if (seitStart < 0.45 && z.laeuft) laut *= 0.35;
    if (!z.laeuft) laut *= Math.min(1, rpm / P.leerlauf);
    V.laut.gain.setTargetAtTime(0.045 * laut, t, gt.schalten ? 0.015 : 0.035);
    V.subG.gain.setTargetAtTime(0.5 * laut * (P.v8 ? 1.3 : P.diesel > 0.4 ? 1.0 : 0.7), t, 0.04);
    var nageln = (0.12 + P.diesel) * (0.35 + 0.65 * last);
    V.am.gain.setTargetAtTime(0.5 * nageln, t, 0.03);
    V.rg.gain.setTargetAtTime(0.25 * nageln, t, 0.03);

    // Fehlzündung beim Gaswegnehmen (nur sportliche Motoren, freundlich leise),
    // im Mittel knallen·3 Mal pro Sekunde – unabhängig von der Bildrate
    if (P.knallen && gas < 0.05 && rel > 0.45 && z.laeuft && this.zufall() < P.knallen * 3 * dt) this.puff();
  };

  /* Garage: Motor im Leerlauf hochdrehen (kein Gang, kein Begrenzer) */
  Motor.prototype.leerlaufGetriebe = function (r, dt) {
    var P = this.P, g = this.leer || (this.leer = { rpm: P.leerlauf || 0, rf: 0, schalten: false, begrenzer: false, gang: 0 });
    g.rf = Math.min(1, r);
    var ziel = (P.leerlauf || 0) + ((P.max || 10000) - (P.leerlauf || 0)) * g.rf;
    g.rpm += (ziel - g.rpm) * Math.min(1, dt * (P.traegheit || 10));
    return g;
  };

  Motor.prototype.puff = function () {
    var ac = this.ac, t = ac.currentTime;
    var q = rauschQuelle(ac), tp = ac.createBiquadFilter(), g = ac.createGain();
    tp.type = "lowpass"; tp.frequency.value = 700;
    g.gain.setValueAtTime(0.06, t); g.gain.exponentialRampToValueAtTime(0.0001, t + 0.07);
    q.connect(tp); tp.connect(g); g.connect(this.bus);
    q.start(t); q.stop(t + 0.09);
  };

  Motor.prototype.setzeElektro = function (z, gt, tempo, gas, t, dt) {
    var P = this.P, V = this.v;
    // Motordrehzahl ∝ Raddrehzahl (ein Gang); der Rotor ist träge – dreht ein Rad in der
    // Luft frei hoch, gleitet der Ton, statt zu springen
    var rmZiel = Math.min(1.3, gt.rf);
    this.rm = (this.rm || 0) + (rmZiel - (this.rm || 0)) * Math.min(1, dt * 5);
    var rm = this.rm;
    var regen = z.laeuft && !z.rueckwaerts && (z.bremse || 0) > 0.05 && tempo > 1 ? z.bremse : 0;
    var strom = Math.max(gas, regen * 0.6);
    var an = z.laeuft && rm > 0.01 ? Math.min(1, rm * 6) : 0;
    V.surr.frequency.setTargetAtTime(60 + P.surren * rm, t, 0.03);
    V.heul.frequency.setTargetAtTime((60 + P.surren * rm) * 1.5, t, 0.03);
    // Umrichter: Taktfrequenz springt bei kleiner Drehzahl in Stufen (wie bei manchen E-Autos und Bahnen)
    var stufe = Math.min(4, Math.floor(rm * 12));
    V.pwm.frequency.setTargetAtTime(700 * Math.pow(1.26, stufe), t, 0.01);
    // leise: das Surren liegt knapp über den Reifen, nicht darüber (E-Autos sind leise!)
    var L = P.lautstaerke || 1;
    V.gS.gain.setTargetAtTime(L * 0.012 * an * (0.3 + 0.7 * strom), t, 0.04);
    V.gH.gain.setTargetAtTime(L * 0.0045 * an * (0.2 + 0.8 * strom), t, 0.04);
    V.gP.gain.setTargetAtTime(L * 0.004 * an * strom * (1 - Math.min(1, rm * 2)), t, 0.04);
    // AVAS: hörbar von 0 bis ca. 20 km/h (5,6 m/s), danach übertönen Reifen und Wind
    var kmh = tempo * 3.6, avas = z.laeuft ? Math.max(0, 1 - kmh / 20) * (kmh < 0.5 ? 0.5 : 1) : 0;
    V.aG.gain.setTargetAtTime(L * 0.013 * avas, t, 0.1);
    V.tremG.gain.setTargetAtTime(L * 0.005 * avas, t, 0.1);
    V.a1.frequency.setTargetAtTime(P.avasTon * (1 + 0.25 * Math.min(1, kmh / 20)), t, 0.1);
    V.a2.frequency.setTargetAtTime(P.avasTon * 1.5 * (1 + 0.25 * Math.min(1, kmh / 20)), t, 0.1);
  };

  Motor.prototype.stopp = function () {
    var ac = this.ac, t = ac.currentTime, q = this.quellen;
    this.bus.gain.setTargetAtTime(0, t, 0.05);
    q.forEach(function (x) { try { x.stop(t + 0.4); } catch (e) { /* schon gestoppt */ } });
  };

  /* --- Live-Schnittstelle für das Spiel --- */
  var probe = null;                    // Garage: "Motor anhören"
  function motorStart(profil) {
    if (!ctx) return;
    if (motor) motor.stopp();
    if (probe) { clearInterval(probe.timer); probe.m.stopp(); probe = null; }
    motor = new Motor(ctx, master, profil || FF.CONFIG.fahrzeuge[0].klang);
  }
  function motorSetze(z) { if (motor) motor.setze(z); }
  function motorStopp() { if (motor) { motor.stopp(); motor = null; } }

  /* Garage: Motor kurz anhören – im Leerlauf (kein Gang): anlassen, zweimal
     Gas geben, ausdrehen lassen */
  function motorProbe(profil, vmax) {
    if (!ctx || !an) return;
    if (probe) { clearInterval(probe.timer); probe.m.stopp(); }
    var m = new Motor(ctx, master, profil || FF.CONFIG.fahrzeuge[0].klang), t0 = performance.now(), letzte = t0;
    probe = { m: m, timer: setInterval(function () {
      var jetzt = performance.now(), s = (jetzt - t0) / 1000, dt = (jetzt - letzte) / 1000;
      letzte = jetzt;
      var gas = (s > 1.0 && s < 1.6) || (s > 2.1 && s < 2.9) ? 1 : 0;
      var r = gas ? Math.min(0.85, (s > 2.1 ? s - 2.1 : s - 1.0) * 1.2) : 0;
      m.setze({ drehzahl: r, gas: gas, laeuft: true, tempo: 0, vmax: vmax, boden: true, luft: true, probe: true, dt: dt });
      if (s > 3.8) { clearInterval(probe.timer); m.stopp(); probe = null; }
    }, 33) };
  }

  /* ---------- Effekte ---------- */
  function spiele(typ, wert) {
    if (!ctx || !an) return;
    switch (typ) {
      case "muenze":
        ton(988, 0, 0.08, "square", 0.06); ton(1319, 0.06, 0.16, "square", 0.06);
        break;
      case "muenzeGross":
        ton(1047, 0, 0.08, "square", 0.07); ton(1319, 0.06, 0.08, "square", 0.07); ton(1568, 0.12, 0.22, "square", 0.07);
        break;
      case "diamant":
        [1319, 1568, 1976, 2637].forEach(function (f, i) { ton(f, i * 0.05, 0.2, "triangle", 0.12); });
        break;
      case "tank":
        ton(420, 0, 0.12, "sine", 0.3, 260); ton(380, 0.13, 0.12, "sine", 0.3, 230); ton(340, 0.26, 0.14, "sine", 0.3, 200);
        ton(784, 0.42, 0.2, "triangle", 0.15); ton(1047, 0.5, 0.3, "triangle", 0.15);
        break;
      case "laden":
        ton(330, 0, 0.35, "sawtooth", 0.04, 1320);
        [784, 988, 1319].forEach(function (f, i) { ton(f, 0.3 + i * 0.07, 0.18, "triangle", 0.13); });
        break;
      case "salto":
        [523, 659, 784, 1047, 1319].forEach(function (f, i) { ton(f, i * 0.07, 0.18, "triangle", 0.16); });
        break;
      case "luftsprung":
        ton(600, 0, 0.25, "sine", 0.12, 1200);
        break;
      case "landung":
        rauschen(0, 0.18 + 0.15 * (wert || 0.5), 0.15 + 0.25 * (wert || 0.5), 260);
        ton(90, 0, 0.15, "sine", 0.2 * (wert || 0.5), 50);
        break;
      case "hoppla":
        ton(392, 0, 0.18, "triangle", 0.2); ton(330, 0.2, 0.28, "triangle", 0.2);
        break;
      case "hilfe":
        ton(300, 0, 0.5, "sine", 0.15, 900); ton(1200, 0.45, 0.15, "triangle", 0.1);
        break;
      case "hilfeFertig":
        ton(500, 0, 0.12, "sine", 0.15, 300); ton(659, 0.1, 0.18, "triangle", 0.12);
        break;
      case "ziel":
        [523, 659, 784].forEach(function (f, i) { ton(f, i * 0.14, 0.16, "square", 0.08); });
        ton(1047, 0.42, 0.6, "square", 0.09);
        ton(523, 0.42, 0.6, "triangle", 0.1); ton(659, 0.42, 0.6, "triangle", 0.08);
        break;
      case "tankWarnung":
        ton(880, 0, 0.1, "square", 0.05); ton(880, 0.18, 0.1, "square", 0.05);
        break;
      case "tankLeer":
        ton(220, 0, 0.5, "sawtooth", 0.08, 70);
        ton(160, 0.55, 0.25, "sawtooth", 0.05, 60);
        break;
      case "stern":
        ton(1568 + (wert || 0) * 220, 0, 0.35, "triangle", 0.16);
        ton(2093 + (wert || 0) * 220, 0.05, 0.4, "sine", 0.08);
        break;
      case "zaehlen":
        ton(1400, 0, 0.03, "square", 0.025);
        break;
      case "klick":
        ton(660, 0, 0.05, "triangle", 0.1);
        break;
      case "kauf":
        [784, 988, 1175, 1568].forEach(function (f, i) { ton(f, i * 0.06, 0.2, "triangle", 0.14); });
        rauschen(0.25, 0.1, 0.05, 4000);
        break;
      case "fehler":
        ton(220, 0, 0.14, "triangle", 0.15); ton(196, 0.15, 0.2, "triangle", 0.15);
        break;
      case "ampel":                    // Countdown 3, 2, 1
        ton(523, 0, 0.18, "square", 0.08);
        break;
      case "ampelLos":                 // grün: LOS!
        ton(1047, 0, 0.45, "square", 0.09); ton(1568, 0.02, 0.4, "triangle", 0.08);
        break;
      case "boost":                    // Raketen-Düsen: Fauchen + aufsteigender Heulton
        rauschen(0, 1.5, 0.35, 700);
        ton(110, 0, 1.4, "sawtooth", 0.07, 330);
        break;
      case "feder":                    // Boooing!
        ton(150, 0, 0.45, "sine", 0.32, 700); ton(300, 0.02, 0.35, "triangle", 0.12, 1200);
        break;
      case "rakete":                   // Raketen-Kanister eingesammelt
        [523, 784, 1047, 1568].forEach(function (f, i) { ton(f, i * 0.05, 0.16, "square", 0.06); });
        break;
      case "extraBereit":              // Knopf ist voll aufgeladen
        ton(1047, 0, 0.1, "triangle", 0.14); ton(1568, 0.09, 0.25, "triangle", 0.14);
        break;
      case "meilenstein":
        ton(784, 0, 0.12, "triangle", 0.14); ton(1175, 0.1, 0.25, "triangle", 0.14);
        break;
    }
  }

  /* ---------- Vorlesen ---------- */
  var stimme = null;
  function waehleStimme() {
    if (!window.speechSynthesis) return;
    var liste = window.speechSynthesis.getVoices();
    for (var i = 0; i < liste.length; i++) {
      if (/^de/i.test(liste[i].lang)) { stimme = liste[i]; if (/female|frau|anna|petra|helena/i.test(liste[i].name)) break; }
    }
  }
  if (typeof window !== "undefined" && window.speechSynthesis) {
    waehleStimme();
    window.speechSynthesis.onvoiceschanged = waehleStimme;
  }

  function sprich(text) {
    if (!sprachAn || !window.speechSynthesis) return;
    try {
      window.speechSynthesis.cancel();
      var u = new SpeechSynthesisUtterance(text.replace(/[\u{1F300}-\u{1FAFF}☀-➿]/gu, ""));
      u.lang = "de-DE"; u.rate = 1.0; u.pitch = 1.15;
      if (stimme) u.voice = stimme;
      window.speechSynthesis.speak(u);
    } catch (e) { /* Vorlesen ist nur ein Extra */ }
  }

  FF.Klang = {
    init: init,
    setzeAn: setzeAn,
    setzeSprache: function (wert) { sprachAn = wert; if (!wert && window.speechSynthesis) window.speechSynthesis.cancel(); },
    motorStart: motorStart, motorSetze: motorSetze, motorStopp: motorStopp, motorProbe: motorProbe,
    Motor: Motor,                       // für Tests (OfflineAudioContext)
    spiele: spiele,
    sprich: sprich
  };
})();
