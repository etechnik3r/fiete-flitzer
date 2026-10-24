/* ===========================================================================
   Fiete Flitzer – klang.js
   ---------------------------------------------------------------------------
   Alle Töne entstehen live per WebAudio (keine Sound-Dateien nötig):
     • Motor: zwei Oszillatoren (Sägezahn + Rechteck) durch einen Tiefpass,
       Tonhöhe folgt der Drehzahl, Lautstärke dem Gaspedal.
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

  /* ---------- Motor ---------- */
  function motorStart() {
    if (!ctx || motor) return;
    var o1 = ctx.createOscillator(), o2 = ctx.createOscillator();
    o1.type = "sawtooth"; o2.type = "square";
    var f = ctx.createBiquadFilter(); f.type = "lowpass"; f.frequency.value = 500; f.Q.value = 3;
    var g = ctx.createGain(); g.gain.value = 0;
    var g2 = ctx.createGain(); g2.gain.value = 0.35;
    o1.connect(f); o2.connect(g2); g2.connect(f); f.connect(g); g.connect(master);
    o1.start(); o2.start();
    motor = { o1: o1, o2: o2, f: f, g: g };
  }

  function motorSetze(drehzahl, last, laeuft) {
    if (!motor) return;
    var t = ctx.currentTime;
    var fq = 42 + 120 * Math.min(1.25, drehzahl) + 18 * last;
    motor.o1.frequency.setTargetAtTime(fq, t, 0.05);
    motor.o2.frequency.setTargetAtTime(fq * 0.5, t, 0.05);
    motor.f.frequency.setTargetAtTime(350 + 1100 * Math.min(1, drehzahl) + 500 * last, t, 0.06);
    motor.g.gain.setTargetAtTime(laeuft ? 0.05 + 0.07 * last : 0, t, 0.08);
  }

  function motorStopp() {
    if (!motor) return;
    var m = motor; motor = null;
    m.g.gain.setTargetAtTime(0, ctx.currentTime, 0.05);
    setTimeout(function () { try { m.o1.stop(); m.o2.stop(); } catch (e) { /* schon gestoppt */ } }, 300);
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
    motorStart: motorStart, motorSetze: motorSetze, motorStopp: motorStopp,
    spiele: spiele,
    sprich: sprich
  };
})();
