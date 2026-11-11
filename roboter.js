/* ===========================================================================
   Fiete Flitzer – roboter.js
   ---------------------------------------------------------------------------
   Roboter-Fahrer, die eine Fahrt (fahrt.js) ganz ohne Mensch steuern.
   Genutzt von
     • werkzeuge/testfahrt.js   (Level ohne Browser abfahren)
     • spiel.js, Startseiten-Show (Fiete fährt auf der Startseite von allein)

   Kein window/document – läuft im Browser und in Node.

     FF.Roboter.profi()        wie ein geübter Spieler: sagt in der Luft den
                               Landepunkt voraus und stellt die Nase passend
                               zum Hang, dosiert am Berg das Gas, bremst vor
                               steilen Abhängen, nimmt Anlauf, wenn er hängt.
     FF.Roboter.show(zufall)   der Profi für die Startseite – macht ab und zu
                               einen Salto, wenn ein Sprung lang genug ist.
     FF.Roboter.inDerLuft(st)  true, wenn weder Räder noch Karosserie den
                               Boden berühren
   Jeder Fahrer: { eingabe(fahrt, dt) → { gas, bremse }, statistik }
   =========================================================================== */
var FF = globalThis.FF = globalThis.FF || {};

(function () {
  "use strict";

  function inDerLuft(st) { return st.radKontakte === 0 && !st.huellKontakt && !st.kopfKontakt; }

  /* Landepunkt aus der Wurfparabel: { x, t } (t = Restflugzeit [s]) */
  function landung(f) {
    var C = f.fz.chassis, gel = f.gelaende, g = f.welt.schwerkraft;
    var x = C.x, y = C.y, t = 0;
    for (var k = 0; k < 90; k++) {
      t += 0.04; x = C.x + C.vx * t; y = C.y + C.vy * t - 0.5 * g * t * t;
      if (y - 0.9 < gel.hoeheBei(x)) break;
    }
    return { x: x, t: t };
  }

  function profi() {
    var rueck = 0, rueckBis = 0, klemm = 0, statistik = { boden: 0, gasWeg: 0, bremse: 0, luft: 0 };
    function eingabe(f, dt) {
      var fz = f.fz, C = fz.chassis, st = fz.status, gel = f.gelaende;
      var a = FF.normWinkel(C.a);
      if (f.imLooping) return { gas: true, bremse: false };   // im Looping: Vollgas durch
      if (inDerLuft(st)) {
        statistik.luft += dt;
        // am Landepunkt soll die Nase zum Hang passen
        var L = landung(f);
        var fehler = FF.normWinkel(Math.atan(gel.steigungBei(L.x)) - a);
        var u = fehler / Math.max(0.3, L.t) - C.w;          // gewünschte minus aktuelle Drehrate
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
      if (klemm > 1.5 && !gel.wolken.length) { klemm = 0; rueck = 5; rueckBis = C.x - 12; }   // Wolken: hinter einem ist eine Lücke
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
      if (gel.wolken.length && gel.wolkenLuecke(vorX) || gel.wolken.length && gel.wolkenLuecke(vorX + 4)) vMax = 99;   // Wolken: vor der Lücke nicht bremsen, sondern springen
      if (gel.dyn && gel.dyn.some(function (d) { return d.typ === "hochseil" && C.x > d.x0 - 6 && C.x < d.x1; })) vMax = 99;   // Zirkus: Hochseil mit Schwung
      if (gel.dyn && gel.dyn.some(function (d) { return d.typ === "podest" && C.x > d.x0 - 6 && C.x < d.x1; })) vMax = 10;     // Hocker: mit Gefühl
      // Datenwelt: Ladebalken-Brücke – nicht schneller als der Balken lädt, notfalls davor warten
      if (gel.dyn) for (var di = 0; di < gel.dyn.length; di++) {
        var D = gel.dyn[di];
        if (D.typ !== "laden" || D.fertig || C.x > D.b || C.x < D.a - 40) continue;
        var frei = (D.gestartet ? D.front - 2.5 : D.a - 3) - (C.x + 1.6), laeuft = D.gestartet && !D.stockt;
        if (frei < 0.6 && v < 1.5) return { gas: false, bremse: false };                         // stehen und warten
        vMax = Math.min(vMax, Math.sqrt(2 * 3.5 * Math.max(0, frei)) + (laeuft ? D.v * 0.8 : 0));
      }
      // Datenwelt: Kopieren-Ring – mit dem passenden Tempo über die Rampe
      if (gel.portale) for (var pi = 0; pi < gel.portale.length; pi++) {
        var P = gel.portale[pi];
        if (P.benutzt || C.x > P.lippe || C.x < P.lippe - 35) continue;
        if (v > P.vRing + 0.4) { statistik.bremse += dt; return { gas: false, bremse: true }; }
        if (v > P.vRing - 0.3) return { gas: false, bremse: false };
      }
      if (v > vMax) { statistik.bremse += dt; return { gas: false, bremse: v > 0.8 }; }
      return { gas: true, bremse: false };
    }
    return { eingabe: eingabe, statistik: statistik };
  }

  /* Show-Fahrer für die Startseite: fährt wie der Profi, dreht aber bei einem
     langen Sprung einen Salto rückwärts (Gas in der Luft hebt die Nase) und
     überlässt die Landung dann wieder dem Profi. zufall(): Zahl 0 … 1 */
  function show(zufall) {
    zufall = zufall || Math.random;
    var basis = profi(), trick = null, warInLuft = false;
    /* Salto als Zwei-Punkt-Regelung: erst mit Gas andrehen, dann so rechtzeitig
       bremsen, dass die Drehung genau bei „eine Umdrehung + Hangwinkel“ ausläuft.
       alpha: Drehbeschleunigung in der Luft [rad/s²], während der Fahrt gemessen. */
    function eingabe(f, dt) {
      var st = f.fz.status, C = f.fz.chassis;
      var luft = inDerLuft(st) && f.zustand === "fahrt" && !f.imLooping && !f.roehre;
      if (!luft) { trick = null; warInLuft = false; return basis.eingabe(f, dt); }
      var L = landung(f), a = FF.normWinkel(C.a);
      if (!warInLuft) {                                  // gerade abgehoben: lohnt sich ein Salto?
        warInLuft = true;
        // genug Flugzeit, nicht bei wenig Schwerkraft (Mond: zu langsam fürs Auge), und nicht immer
        if (L.t > 1.35 && f.welt.schwerkraft > 5 && zufall() < 0.8) trick = { drehung: 0, a0: a, w: C.w, alpha: 4, phase: "an" };
      }
      if (trick) {
        var dw = (C.w - trick.w) / dt;
        if (trick.phase === "an" && dw > 0.5) trick.alpha += (dw - trick.alpha) * 0.08;
        trick.w = C.w;
        trick.drehung += C.w * dt;
        // noch zu drehen bis „eine Umdrehung und Nase passend zum Hang am Landepunkt“
        var rest = 2 * Math.PI + FF.normWinkel(Math.atan(f.gelaende.steigungBei(L.x)) - trick.a0) - trick.drehung;
        var bremsWeg = C.w > 0 ? C.w * C.w / (2 * trick.alpha) : 0;
        var zeit = L.t - 0.2;
        if (trick.phase === "an") {
          // reicht die Zeit überhaupt? (andrehen + abbremsen, grob)
          var maxDreh = Math.max(0, C.w) * zeit + 0.25 * trick.alpha * zeit * zeit;
          if (trick.drehung < 1.2 && maxDreh < rest) { trick = null; return basis.eingabe(f, dt); }   // abbrechen, solange es noch geht
          if (rest > bremsWeg + 0.15) return { gas: true, bremse: false };
          trick.phase = "aus";
        }
        if (trick.phase === "aus") {
          if (C.w > 0.8 && rest > 0.3) return { gas: false, bremse: true };
          trick = null;                                  // Drehung fast weg: den Rest macht der Profi
        }
      }
      return basis.eingabe(f, dt);
    }
    return { eingabe: eingabe, statistik: basis.statistik };
  }

  FF.Roboter = { profi: profi, show: show, inDerLuft: inDerLuft };
})();
