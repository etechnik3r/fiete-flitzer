/* ===========================================================================
   Fiete Flitzer – spiel.js
   ---------------------------------------------------------------------------
   Klebt alles zusammen: Spielschleife, Eingabe (Pedale, Touch, Tastatur),
   Kamera, Effekte, HUD, Menü mit Welten, Garage (Kaufen, Tuning, Farben),
   Ergebnis, Einstellungen, Speicherstand (localStorage) und PWA.

   Gliederung:
     1) Speicherstand          8) Ergebnis
     2) Zustand + Canvas        9) Menü: Welten + Fahrzeug-Leiste
     3) Eingabe                10) Garage
     4) Kamera                 11) Einstellungen, Eltern-Dialog, Popover
     5) Effekte (Partikel …)   12) Titel, PWA
     6) Ereignisse der Fahrt   13) Spielschleife + Start
     7) Fahrt starten/beenden
   =========================================================================== */

(function () {
  "use strict";

  var C = FF.CONFIG;
  function $(id) { return document.getElementById(id); }
  function klemme(v, a, b) { return Math.max(a, Math.min(b, v)); }
  function zahl(n) { return Math.round(n).toLocaleString("de-DE"); }

  /* =========================================================================
     1) SPEICHERSTAND
     ========================================================================= */
  var SCHLUESSEL = "fiete-flitzer-spielstand-v1";

  function neuerSpielstand() {
    var s = {
      version: 1,
      muenzen: C.startMuenzen,
      fahrzeug: "flitzer",
      fahrzeuge: {},
      farben: C.farben.filter(function (f) { return f.preis === 0; }).map(function (f) { return f.id; }),
      muster: ["keins"],
      outfit: C.outfits[0].id,
      outfits: [C.outfits[0].id],
      level: {},
      endlos: {},
      einstellungen: { ton: true, sprache: true, schwierigkeit: "normal", instrumente: true, kraefte: false },
      statistik: { fahrten: 0, meter: 0, salti: 0, muenzen: 0 }
    };
    C.fahrzeuge.forEach(function (f) {
      s.fahrzeuge[f.id] = { gekauft: f.preis === 0, upgrades: {}, farbe: f.farbe, muster: "keins" };
    });
    return s;
  }

  function lade() {
    var s = neuerSpielstand();
    try {
      var roh = window.localStorage.getItem(SCHLUESSEL);
      if (roh) {
        var d = JSON.parse(roh);
        Object.keys(s).forEach(function (k) {
          if (d[k] === undefined) return;
          if (k === "fahrzeuge" || k === "einstellungen" || k === "statistik") {
            Object.keys(d[k]).forEach(function (kk) { s[k][kk] = d[k][kk]; });
          } else s[k] = d[k];
        });
        C.fahrzeuge.forEach(function (f) {
          if (!s.fahrzeuge[f.id]) s.fahrzeuge[f.id] = { gekauft: f.preis === 0, upgrades: {}, farbe: f.farbe, muster: "keins" };
        });
      }
    } catch (e) { /* kaputter Speicher → frisch anfangen */ }
    return s;
  }

  function speichere() {
    try { window.localStorage.setItem(SCHLUESSEL, JSON.stringify(S)); } catch (e) { /* privat-Modus o. ä. */ }
  }

  var S = lade();

  function levelSchluessel(wi, li) { return C.welten[wi].id + "-" + (li + 1); }
  function levelStand(wi, li) { return S.level[levelSchluessel(wi, li)] || { geschafft: false, sterne: 0 }; }
  function levelOffen(wi, li) {
    if (wi === 0 && li === 0) return true;
    return li > 0 ? levelStand(wi, li - 1).geschafft : levelStand(wi - 1, 2).geschafft;
  }
  function endlosOffen(wi) { return levelStand(wi, 0).geschafft; }
  function farbWert(id) {
    for (var i = 0; i < C.farben.length; i++) if (C.farben[i].id === id) return C.farben[i];
    return C.farben[0];
  }
  function outfitWert(id) {
    for (var i = 0; i < C.outfits.length; i++) if (C.outfits[i].id === id) return C.outfits[i];
    return C.outfits[0];
  }
  function aussehenVon(fzId) {
    var fs = S.fahrzeuge[fzId] || {};
    var f = farbWert(fs.farbe || FF.fahrzeugDef(fzId).farbe);
    return { farbe: f.wert, glanz: !!f.glanz, muster: fs.muster || "keins", outfit: outfitWert(S.outfit) };
  }

  /* Fiete als Bild (Brustbild oder nur Kopf) – gezeichnet mit denselben
     Funktionen wie im Auto, damit er überall gleich aussieht. */
  var bildCache = {};
  function fieteBild(b, h, ausdruck, nurKopf, outfitId) {
    var o = outfitWert(outfitId || S.outfit);
    var key = [b, h, ausdruck, nurKopf, o.id].join("|");
    if (bildCache[key]) return bildCache[key];
    var c = document.createElement("canvas");
    c.width = b * 2; c.height = h * 2;
    var g = c.getContext("2d");
    g.scale(2, 2);
    FF.Grafik.zeichnePortrait(g, b, h, { outfit: o }, ausdruck, 0.4, nurKopf);
    return (bildCache[key] = c.toDataURL());
  }

  /* =========================================================================
     2) ZUSTAND + CANVAS
     ========================================================================= */
  var canvas = $("spielfeld"), ctx = canvas.getContext("2d");
  var B = 0, H = 0, DPR = 1;
  var modus = "titel";                 // titel | menue | fahrt
  var fahrt = null, fahrtInfo = null, pausiert = false, ergebnisOffen = false;
  var kamera = { x: 0, y: 0, s: 40, b: 0, h: 0, ankerX: 0.42, ankerY: 0.56, zoom: 1 };
  var partikel = new FF.Grafik.Partikel(), texte = [], wetter = new FF.Grafik.Wetter();
  var zeit = 0, letzteZeit = 0;
  var ausdruck = "normal", ausdruckBis = 0;
  var auspuffTakt = 0, staubTakt = 0;

  function groesseAnpassen() {
    DPR = Math.min(2, window.devicePixelRatio || 1);
    B = window.innerWidth; H = window.innerHeight;
    canvas.width = Math.round(B * DPR); canvas.height = Math.round(H * DPR);
    kamera.b = B; kamera.h = H;
    if (fahrt) wetter.setze(fahrt.welt.wetter, kamera);
    ["vorschau", "titel-auto"].forEach(function (id) {
      var c = $(id);
      if (!c) return;
      var r = c.getBoundingClientRect();
      c.width = Math.max(1, Math.round(r.width * DPR)); c.height = Math.max(1, Math.round(r.height * DPR));
    });
  }
  window.addEventListener("resize", groesseAnpassen);
  window.addEventListener("orientationchange", function () { setTimeout(groesseAnpassen, 200); });

  /* =========================================================================
     3) EINGABE: Pedal-Knöpfe, ganze Bildschirmhälften (Multitouch), Tastatur
     ========================================================================= */
  var zeiger = {};                     // pointerId → "gas" | "bremse"
  var tasten = { gas: false, bremse: false };
  var eingabe = { gas: false, bremse: false };

  function eingabeAktualisieren() {
    var g = tasten.gas, b = tasten.bremse;
    Object.keys(zeiger).forEach(function (id) { if (zeiger[id] === "gas") g = true; else b = true; });
    eingabe.gas = g; eingabe.bremse = b;
    $("pedal-gas").classList.toggle("aktiv", g);
    $("pedal-bremse").classList.toggle("aktiv", b);
  }

  function zeigerRunter(e, pedal) {
    if (modus !== "fahrt" || pausiert) return;
    e.preventDefault();
    FF.Klang.init();
    zeiger[e.pointerId] = pedal || (e.clientX < B / 2 ? "bremse" : "gas");
    try { e.target.setPointerCapture(e.pointerId); } catch (x) { /* egal */ }
    eingabeAktualisieren();
  }
  function zeigerHoch(e) {
    if (zeiger[e.pointerId] !== undefined) { delete zeiger[e.pointerId]; eingabeAktualisieren(); }
  }
  function alleZeigerLos() { zeiger = {}; tasten.gas = tasten.bremse = false; eingabeAktualisieren(); }

  canvas.addEventListener("pointerdown", function (e) { zeigerRunter(e, null); });
  ["pointerup", "pointercancel", "lostpointercapture"].forEach(function (t) { canvas.addEventListener(t, zeigerHoch); });
  [["pedal-gas", "gas"], ["pedal-bremse", "bremse"]].forEach(function (p) {
    var el = $(p[0]);
    el.addEventListener("pointerdown", function (e) { zeigerRunter(e, p[1]); });
    ["pointerup", "pointercancel", "lostpointercapture"].forEach(function (t) { el.addEventListener(t, zeigerHoch); });
  });
  document.addEventListener("contextmenu", function (e) { if (modus === "fahrt") e.preventDefault(); });

  var TASTEN_GAS = ["ArrowRight", "ArrowUp", "KeyD", "KeyW"], TASTEN_BREMSE = ["ArrowLeft", "ArrowDown", "KeyA", "KeyS"];
  window.addEventListener("keydown", function (e) {
    if (modus !== "fahrt") return;
    if (TASTEN_GAS.indexOf(e.code) >= 0) { tasten.gas = true; e.preventDefault(); FF.Klang.init(); }
    else if (TASTEN_BREMSE.indexOf(e.code) >= 0) { tasten.bremse = true; e.preventDefault(); FF.Klang.init(); }
    else if (e.code === "Escape" || e.code === "KeyP") { if (!ergebnisOffen) (pausiert ? weiter() : pause()); }
    else if (e.code === "KeyK") { S.einstellungen.kraefte = !S.einstellungen.kraefte; speichere(); }
    eingabeAktualisieren();
  });
  window.addEventListener("keyup", function (e) {
    if (TASTEN_GAS.indexOf(e.code) >= 0) tasten.gas = false;
    if (TASTEN_BREMSE.indexOf(e.code) >= 0) tasten.bremse = false;
    eingabeAktualisieren();
  });
  window.addEventListener("blur", alleZeigerLos);

  /* =========================================================================
     4) KAMERA
     ========================================================================= */
  function kameraNachfuehren(dt, sofort) {
    var Kc = C.kamera, ch = fahrt.fz.chassis;
    var quer = B >= H;
    var basisS = quer ? H / Kc.sichtHoehe : B / Kc.sichtBreiteHoch;
    var v = Math.hypot(ch.vx, ch.vy);
    var zoomZiel = 1 - Kc.zoomBeiTempo * Math.min(1, v / Kc.tempoFuerZoom);
    kamera.zoom = sofort ? zoomZiel : kamera.zoom + (zoomZiel - kamera.zoom) * Math.min(1, dt * 1.2);
    kamera.s = basisS * kamera.zoom;
    kamera.ankerX = quer ? 0.4 : 0.38;
    kamera.ankerY = quer ? 0.58 : 0.55;
    var zielX = ch.x + klemme(ch.vx * Kc.vorausschau, -3, 6);
    var zielY = ch.y + 0.6;
    if (sofort) { kamera.x = zielX; kamera.y = zielY; return; }
    var k = Math.min(1, dt * Kc.glaettung);
    kamera.x += (zielX - kamera.x) * k;
    kamera.y += (zielY - kamera.y) * Math.min(1, k * 1.3);
  }

  /* =========================================================================
     5) EFFEKTE: Partikel, Schwebetexte, Meldungen, Konfetti, Popover
     ========================================================================= */
  function schwebeText(x, y, text, farbe, gross) {
    texte.push({ x: x, y: y, text: text, farbe: farbe, gross: gross, t: 0, dauer: gross ? 1.6 : 1.0 });
    if (texte.length > 24) texte.shift();
  }
  function texteAktualisieren(dt) {
    for (var i = texte.length - 1; i >= 0; i--) { texte[i].t += dt; if (texte[i].t >= texte[i].dauer) texte.splice(i, 1); }
  }

  var meldungTimer = null;
  function meldung(text) {
    var el = $("meldung");
    el.hidden = false;
    el.textContent = text;
    el.classList.remove("zeigen"); void el.offsetWidth; el.classList.add("zeigen");
    clearTimeout(meldungTimer);
    meldungTimer = setTimeout(function () { el.hidden = true; }, 1700);
  }

  var tippTimer = null;
  function tipp(text, dauer) {
    var el = $("tipp");
    el.textContent = text; el.hidden = false;
    clearTimeout(tippTimer);
    tippTimer = setTimeout(function () { el.hidden = true; }, dauer || 3500);
  }

  function konfetti(anzahl) {
    var ebene = $("konfetti"), farben = ["#ff5b5b", "#ffd23f", "#28c08a", "#2f6fd6", "#ff6fb5", "#ff9e2c"];
    for (var i = 0; i < (anzahl || 60); i++) {
      var t = document.createElement("div");
      t.className = "konfetti-teil";
      t.style.left = Math.random() * 100 + "vw";
      t.style.background = farben[i % farben.length];
      t.style.animationDelay = Math.random() * 0.6 + "s";
      t.style.animationDuration = 1.8 + Math.random() * 1.4 + "s";
      ebene.appendChild(t);
      setTimeout(function (el) { el.remove(); }.bind(null, t), 3800);
    }
  }

  var popTimer = null;
  function popover(html, dauer) {
    var el = $("popover");
    el.innerHTML = html; el.hidden = false;
    clearTimeout(popTimer);
    popTimer = setTimeout(function () { el.hidden = true; }, dauer || 3200);
  }
  $("popover").addEventListener("click", function () { $("popover").hidden = true; });

  function plopp(el) { el.classList.remove("plopp"); void el.offsetWidth; el.classList.add("plopp"); }

  /* Staub an durchdrehenden Rädern, Auspuff-Wölkchen */
  function fahrEffekte(dt) {
    var fz = fahrt.fz, welt = fahrt.welt, ch = fz.chassis;
    staubTakt -= dt; auspuffTakt -= dt;
    if (staubTakt <= 0) {
      staubTakt = 0.045;
      fz.raeder.forEach(function (R) {
        var ko = R.kontakt;
        if (!ko.aktiv || ko.pen < -0.02) return;
        var tx = ko.ny, ty = -ko.nx;
        var vBoden = R.k.vx * tx + R.k.vy * ty;
        var schlupf = Math.abs(-R.k.w * R.r - vBoden);
        if (schlupf > 2.2 || (Math.abs(vBoden) > 9 && Math.random() < 0.25)) {
          var px = R.k.x - ko.nx * R.r, py = R.k.y - ko.ny * R.r;
          var richtung = R.k.w < 0 ? -1 : 1;
          partikel.neu({ art: "staub", x: px, y: py + 0.1, vx: richtung * (1 + Math.random() * 2) + ch.vx * 0.2, vy: 0.8 + Math.random(),
                         t: 0, dauer: 0.6 + Math.random() * 0.4, r0: 0.12, r1: 0.45, farbe: welt.farben.punkte, alpha: 0.7, reibung: 2 });
        }
      });
    }
    if (fahrt.gas > 0.4 && fahrt.tank > 0 && auspuffTakt <= 0) {
      auspuffTakt = 0.09;
      var L = fahrt.werte.groesse.laenge;
      var ca = Math.cos(ch.a), sa = Math.sin(ch.a), lx = -L * 0.5, ly = -0.05;
      partikel.neu({ art: "rauch", x: ch.x + ca * lx - sa * ly, y: ch.y + sa * lx + ca * ly,
                     vx: -ca * 1.5 + ch.vx * 0.6, vy: 0.6 - sa * 1.5 + ch.vy * 0.6,
                     t: 0, dauer: 0.7, r0: 0.08, r1: 0.35, farbe: "rgba(200,205,220,0.9)", alpha: 0.6, reibung: 1.5 });
    }
  }

  function funkeln(x, y, farbe, n) {
    for (var i = 0; i < (n || 5); i++) {
      var w = Math.random() * Math.PI * 2, v = 1.5 + Math.random() * 2.5;
      partikel.neu({ art: "funkel", x: x, y: y, vx: Math.cos(w) * v, vy: Math.sin(w) * v, t: 0, dauer: 0.5 + Math.random() * 0.3,
                     r0: 0.18 + Math.random() * 0.1, farbe: farbe || "#ffe58a", reibung: 3 });
    }
  }
  function konfettiWelt(x, y, n) {
    var farben = ["#ff5b5b", "#ffd23f", "#28c08a", "#2f6fd6", "#ff6fb5"];
    for (var i = 0; i < n; i++) {
      partikel.neu({ art: "konfetti", x: x, y: y, vx: (Math.random() - 0.5) * 8, vy: 3 + Math.random() * 6, t: 0, dauer: 1.6,
                     farbe: farben[i % 5], schwer: 0.4, reibung: 1, w: Math.random() * 6, dreh: (Math.random() - 0.5) * 12 });
    }
  }

  /* =========================================================================
     6) EREIGNISSE DER FAHRT → Ton, Effekte, Texte
     ========================================================================= */
  function setzeAusdruck(a, dauer) { ausdruck = a; ausdruckBis = zeit + (dauer || 1.5); }

  function verarbeiteEreignisse() {
    var E = fahrt.ereignisse, ch = fahrt.fz.chassis;
    for (var i = 0; i < E.length; i++) {
      var e = E[i];
      switch (e.typ) {
        case "muenze":
          FF.Klang.spiele(e.wert >= 100 ? "diamant" : e.wert >= 25 ? "muenzeGross" : "muenze");
          funkeln(e.x, e.y, e.wert >= 100 ? "#9fe0ff" : "#ffe58a", e.wert >= 25 ? 7 : 4);
          if (e.wert >= 10) schwebeText(e.x, e.y + 0.4, "+" + e.wert, e.wert >= 100 ? "#9fe0ff" : "#ffd23f");
          plopp($("hud-muenzen"));
          break;
        case "tank":
          FF.Klang.spiele("tank");
          funkeln(e.x, e.y + 0.6, "#ffd23f", 8);
          schwebeText(e.x, e.y + 1.4, "⛽ Voll!", "#7dffb8", true);
          $("hud-tank").classList.remove("knapp");
          break;
        case "tankWarnung":
          FF.Klang.spiele("tankWarnung");
          tipp("⛽ Benzin wird knapp – sammle einen roten Kanister!");
          FF.Klang.sprich("Benzin wird knapp!");
          break;
        case "tankLeer":
          FF.Klang.spiele("tankLeer");
          meldung("Tank leer! ⛽");
          setzeAusdruck("staunen", 6);
          break;
        case "salto":
          FF.Klang.spiele("salto");
          meldung((e.anzahl > 1 ? e.anzahl + "× " : "") + "Salto! 🤸");
          schwebeText(ch.x, ch.y + 1.8, "+" + e.bonus, "#ffd23f", true);
          konfettiWelt(ch.x, ch.y + 1, 18);
          setzeAusdruck("freude", 1.6);
          FF.Klang.sprich(e.anzahl > 1 ? e.anzahl + " Saltos!" : "Salto!");
          break;
        case "luftsprung":
          FF.Klang.spiele("luftsprung");
          schwebeText(ch.x, ch.y + 1.5, "Luftsprung +" + e.bonus, "#9fe0ff", false);
          break;
        case "landung":
          FF.Klang.spiele("landung", e.staerke);
          fahrt.fz.raeder.forEach(function (R) {
            for (var k = 0; k < 4; k++) {
              partikel.neu({ art: "staub", x: R.k.x + (Math.random() - 0.5) * 0.6, y: R.k.y - R.r + 0.1,
                             vx: (Math.random() - 0.5) * 4, vy: 0.5 + Math.random() * 1.5, t: 0, dauer: 0.7,
                             r0: 0.15, r1: 0.6, farbe: fahrt.welt.farben.punkte, alpha: 0.7, reibung: 2 });
            }
          });
          break;
        case "hoppla":
          FF.Klang.spiele("hoppla");
          setzeAusdruck("staunen", 3);
          schwebeText(ch.x, ch.y + 1.6, "Hoppla!", "#ffffff", true);
          break;
        case "hilfe":
          FF.Klang.spiele("hilfe");
          meldung("Ballon-Hilfe! 🎈");
          FF.Klang.sprich("Hoppla! Der Ballon hilft dir.");
          if (e.abzug > 0) schwebeText(ch.x, ch.y + 2.4, "−" + Math.round(e.abzug * 100) + " % ⛽", "#ffb3ad", false);
          alleZeigerLos();
          break;
        case "hilfeFertig":
          FF.Klang.spiele("hilfeFertig");
          setzeAusdruck("freude", 1.2);
          break;
        case "tipp":
          tipp(e.text, 4000);
          FF.Klang.sprich(e.text.replace(/[^\wäöüÄÖÜß!.,\s-]/g, ""));
          break;
        case "meilenstein":
          FF.Klang.spiele("meilenstein");
          meldung(e.meter + " m! 🎉");
          schwebeText(ch.x, ch.y + 2, "+" + e.bonus, "#ffd23f", true);
          break;
        case "ziel":
          FF.Klang.spiele("ziel");
          meldung("Ziel! 🏁");
          setzeAusdruck("freude", 5);
          konfettiWelt(ch.x + 2, ch.y + 3, 50);
          konfetti(70);
          FF.Klang.sprich("Ziel erreicht! Super!");
          break;
        case "ende":
          setTimeout(zeigeErgebnis, e.grund === "ziel" ? 200 : 600);
          break;
      }
    }
    E.length = 0;
  }

  /* =========================================================================
     7) FAHRT STARTEN / BEENDEN + HUD
     ========================================================================= */
  function starteFahrt(wi, li, endlos) {
    FF.Klang.init();
    fahrtInfo = { weltIndex: wi, stufe: li, endlos: !!endlos };
    var fs = S.fahrzeuge[S.fahrzeug];
    fahrt = new FF.Fahrt({
      weltIndex: wi, stufe: li, endlos: !!endlos,
      fahrzeugId: S.fahrzeug, upgrades: fs.upgrades, schwierigkeit: S.einstellungen.schwierigkeit
    });
    partikel.liste.length = 0; texte.length = 0;
    wetter.setze(fahrt.welt.wetter, kamera);
    kameraNachfuehren(0, true);
    ausdruck = "normal"; ausdruckBis = 0;
    pausiert = false; ergebnisOffen = false;
    alleZeigerLos();
    modus = "fahrt";
    zeigeBildschirm("fahrt");
    $("hud-tank").classList.remove("knapp");
    $("hud-fortschritt").hidden = !!endlos;
    $("hud-strecke").hidden = !endlos;
    $("hud-fortschritt-auto").src = fieteBild(40, 40, "normal", true);
    FF.Klang.motorStart();
    var w = fahrt.welt;
    meldung(endlos ? "♾️ Wie weit kommst du?" : w.emoji + " " + w.name + " " + (li + 1));
    FF.Klang.sprich(endlos ? "Wie weit kommst du?" : "Los geht's!");
    if (H > B) { $("hochkant-hinweis").hidden = false; setTimeout(function () { $("hochkant-hinweis").hidden = true; }, 4500); }
    hudAktualisieren(true);
  }

  var hudCache = {};
  function hudAktualisieren(erzwingen) {
    var m = fahrt.muenzen + fahrt.bonus;
    if (erzwingen || hudCache.m !== m) { $("hud-muenzen-wert").textContent = zahl(m); hudCache.m = m; }
    var t = Math.round(fahrt.tank * 200) / 2;
    if (erzwingen || hudCache.t !== t) {
      $("hud-tank-fuellung").style.width = t + "%";
      $("hud-tank").classList.toggle("knapp", fahrt.tank < C.regeln.tankWarnung);
      hudCache.t = t;
    }
    if (fahrt.endlos) {
      var s = Math.max(0, Math.round(fahrt.strecke));
      if (erzwingen || hudCache.s !== s) { $("hud-strecke-wert").textContent = zahl(s) + " m"; hudCache.s = s; }
    } else {
      var p = Math.round(fahrt.fortschritt() * 1000) / 10;
      if (erzwingen || hudCache.p !== p) {
        $("hud-fortschritt-balken").style.width = p + "%";
        $("hud-fortschritt-auto").style.left = p + "%";
        hudCache.p = p;
      }
    }
  }

  function pause() {
    if (modus !== "fahrt" || pausiert || ergebnisOffen) return;
    pausiert = true;
    alleZeigerLos();
    FF.Klang.motorSetze(0, 0, false);
    oeffneModal("pause");
  }
  function weiter() {
    if (!pausiert) return;
    schliesseModal("pause");
    pausiert = false;
    letzteZeit = performance.now();
  }
  $("knopf-pause").addEventListener("click", function () { FF.Klang.spiele("klick"); pause(); });
  $("knopf-weiter").addEventListener("click", function () { FF.Klang.spiele("klick"); weiter(); });
  $("knopf-nochmal").addEventListener("click", function () {
    FF.Klang.spiele("klick");
    schliesseModal("pause");
    gutschreibenAbbruch();
    starteFahrt(fahrtInfo.weltIndex, fahrtInfo.stufe, fahrtInfo.endlos);
  });
  $("knopf-menue").addEventListener("click", function () {
    FF.Klang.spiele("klick");
    schliesseModal("pause");
    var g = gutschreibenAbbruch();
    zeigeMenue("fahren");
    if (g > 0) popover("🪙 +" + zahl(g) + " Münzen gespeichert!");
  });

  /* Bei Abbruch dürfen die Münzen behalten werden */
  function gutschreibenAbbruch() {
    if (!fahrt || fahrt.gutgeschrieben) return 0;
    var g = fahrt.muenzen + fahrt.bonus;
    fahrt.gutgeschrieben = true;
    S.muenzen += g; S.statistik.muenzen += g;
    if (fahrt.endlos) S.endlos[fahrt.welt.id] = Math.max(S.endlos[fahrt.welt.id] || 0, Math.round(fahrt.strecke));
    speichere();
    return g;
  }

  document.addEventListener("visibilitychange", function () {
    if (document.hidden) { if (modus === "fahrt") pause(); FF.Klang.motorSetze(0, 0, false); }
  });

  /* =========================================================================
     8) ERGEBNIS
     ========================================================================= */
  function naechstesLevel(wi, li) {
    if (li < 2) return [wi, li + 1];
    if (wi < C.welten.length - 1) return [wi + 1, 0];
    return null;
  }

  function zeigeErgebnis() {
    if (!fahrt || ergebnisOffen) return;
    ergebnisOffen = true;
    alleZeigerLos();
    FF.Klang.motorSetze(0, 0, false);
    var e = fahrt.ergebnis(), wi = fahrtInfo.weltIndex, li = fahrtInfo.stufe, welt = fahrt.welt;
    fahrt.gutgeschrieben = true;

    // Konto + Fortschritt speichern
    S.muenzen += e.gesamt;
    S.statistik.fahrten++; S.statistik.meter += e.strecke; S.statistik.salti += e.salti; S.statistik.muenzen += e.gesamt;
    var rekord = false;
    if (e.endlos) {
      rekord = e.strecke > (S.endlos[welt.id] || 0);
      S.endlos[welt.id] = Math.max(S.endlos[welt.id] || 0, e.strecke);
    } else {
      var k = levelSchluessel(wi, li), alt = S.level[k] || { geschafft: false, sterne: 0, beste: 0 };
      if (e.ziel) { alt.geschafft = true; alt.sterne = Math.max(alt.sterne, e.sterne); }
      alt.beste = Math.max(alt.beste || 0, e.strecke);
      S.level[k] = alt;
    }
    speichere();

    // Anzeige
    var titel, icon;
    if (e.ziel) { titel = "Ziel erreicht!"; icon = "🏆"; }
    else if (e.endlos) { titel = rekord ? "Neuer Rekord!" : "Super gefahren!"; icon = rekord ? "🥇" : "📏"; }
    else { titel = "Tank leer – gut gefahren!"; icon = "⛽"; }
    $("ergebnis-titel").textContent = titel;
    $("ergebnis-icon").textContent = icon;
    $("ergebnis-fiete").src = fieteBild(120, 130, e.ziel || rekord ? "freude" : "normal");

    var sterneEl = $("ergebnis-sterne");
    sterneEl.hidden = e.endlos;
    var st = sterneEl.querySelectorAll(".stern-gross");
    for (var i = 0; i < st.length; i++) st[i].classList.remove("an");
    if (!e.endlos) {
      for (i = 0; i < e.sterne; i++) {
        setTimeout(function (j) { st[j].classList.add("an"); FF.Klang.spiele("stern", j); }.bind(null, i), 450 + i * 380);
      }
    }

    var zeilen = [["🪙 Münzen gesammelt", zahl(e.muenzen)]];
    if (e.bonus > 0) zeilen.push(["🤸 Trick-Bonus", "+" + zahl(e.bonus)]);
    if (e.zielBonus > 0) zeilen.push(["🏁 Ziel-Bonus", "+" + zahl(e.zielBonus)]);
    zeilen.push(["📏 Strecke", zahl(e.strecke) + " m"]);
    if (e.salti > 0) zeilen.push(["🔄 Saltos", e.salti]);
    if (e.hoppla > 0) zeilen.push(["🎈 Ballon-Hilfen", e.hoppla]);
    if (!e.endlos) zeilen.push(["⭐ Münzen-Anteil", Math.round(e.anteil * 100) + " %"]);
    $("ergebnis-liste").innerHTML = zeilen.map(function (z) { return "<li><span>" + z[0] + "</span><b>" + z[1] + "</b></li>"; }).join("");

    // Summe hochzählen
    var summeEl = $("ergebnis-summe"), ziel = e.gesamt, start = performance.now(), dauer = Math.min(1600, 300 + ziel * 0.6);
    (function zaehle(t) {
      var u = Math.min(1, (t - start) / dauer);
      summeEl.textContent = zahl(ziel * (1 - Math.pow(1 - u, 3)));
      if (u < 1) { if (Math.random() < 0.35) FF.Klang.spiele("zaehlen"); requestAnimationFrame(zaehle); }
    })(start);

    var tippText = "";
    if (!e.ziel && !e.endlos) tippText = "Tipp: In der Garage 🔧 den Tank ⛽ oder Motor verbessern – dann kommst du weiter!";
    else if (e.ziel && e.sterne < 3) tippText = "Sammle " + Math.round(C.regeln.sterne3 * 100) + " % der Münzen für alle 3 Sterne!";
    else if (e.ziel) tippText = "Perfekt! Alle Sterne! 🌟";
    else if (e.endlos) tippText = "Bester Wert hier: " + zahl(S.endlos[welt.id]) + " m";
    $("ergebnis-tipp").textContent = tippText;

    var nl = naechstesLevel(wi, li);
    var weiterKnopf = $("knopf-ergebnis-weiter"), nochmalKnopf = $("knopf-ergebnis-nochmal");
    if (e.ziel && nl && levelOffen(nl[0], nl[1])) {
      weiterKnopf.textContent = nl[0] !== wi ? "▶️ Neue Welt: " + C.welten[nl[0]].emoji : "▶️ Nächstes Level";
      weiterKnopf.dataset.ziel = nl.join(",");
      nochmalKnopf.hidden = false;
    } else {
      weiterKnopf.textContent = "🔄 Nochmal";
      weiterKnopf.dataset.ziel = "nochmal";
      nochmalKnopf.hidden = true;
    }
    oeffneModal("ergebnis");
    if (e.ziel) konfetti(50);
    FF.Klang.sprich(e.ziel ? (e.sterne === 3 ? "Wow, drei Sterne!" : "Geschafft!") : titel);
  }

  $("knopf-ergebnis-weiter").addEventListener("click", function () {
    FF.Klang.spiele("klick");
    schliesseModal("ergebnis");
    var z = this.dataset.ziel;
    if (z === "nochmal") starteFahrt(fahrtInfo.weltIndex, fahrtInfo.stufe, fahrtInfo.endlos);
    else { var t = z.split(",").map(Number); starteFahrt(t[0], t[1], false); }
  });
  $("knopf-ergebnis-nochmal").addEventListener("click", function () {
    FF.Klang.spiele("klick");
    schliesseModal("ergebnis");
    starteFahrt(fahrtInfo.weltIndex, fahrtInfo.stufe, fahrtInfo.endlos);
  });
  $("knopf-ergebnis-garage").addEventListener("click", function () { FF.Klang.spiele("klick"); schliesseModal("ergebnis"); zeigeMenue("garage"); });
  $("knopf-ergebnis-menue").addEventListener("click", function () { FF.Klang.spiele("klick"); schliesseModal("ergebnis"); zeigeMenue("fahren"); });

  /* =========================================================================
     9) MENÜ: Bildschirme, Tabs, Welten + Fahrzeug-Leiste
     ========================================================================= */
  function zeigeBildschirm(name) {
    $("titelscreen").hidden = name !== "titel";
    $("menue").hidden = name !== "menue";
    $("hud").hidden = name !== "fahrt";
    $("pedale").hidden = name !== "fahrt";
    if (name !== "fahrt") { $("meldung").hidden = true; $("tipp").hidden = true; $("hochkant-hinweis").hidden = true; FF.Klang.motorStopp(); }
  }

  var aktiverTab = "fahren";
  function zeigeMenue(tab) {
    modus = "menue";
    fahrt = null;
    zeigeBildschirm("menue");
    waehleTab(tab || aktiverTab);
    kontoAktualisieren();
  }

  function waehleTab(tab) {
    aktiverTab = tab;
    ["fahren", "garage"].forEach(function (t) {
      $("tab-" + t).hidden = t !== tab;
      $("tab-knopf-" + t).classList.toggle("aktiv", t === tab);
    });
    if (tab === "fahren") baueWelten();
    else { garageIndex = indexVon(S.fahrzeug); baueGarage(); }
    groesseAnpassen();
  }
  document.querySelectorAll(".tab").forEach(function (t) {
    t.addEventListener("click", function () { FF.Klang.spiele("klick"); waehleTab(t.dataset.tab); });
  });

  function kontoAktualisieren() { $("konto-wert").textContent = zahl(S.muenzen); }
  $("konto").addEventListener("click", function () {
    popover("🪙 " + zahl(S.muenzen) + " Münzen<small>Damit kaufst du in der Garage neue Teile, Farben und Fahrzeuge.</small>");
  });

  function baueFahrzeugLeiste() {
    var el = $("fahrzeug-leiste");
    var html = '<button type="button" class="fiete-chip" data-garage="1" aria-label="Fietes Outfit ändern">' +
               '<img src="' + fieteBild(44, 44, "normal", true) + '" alt="Fiete"></button>' +
               '<span class="fahrzeug-leiste-titel">Fahrzeug:</span>';
    C.fahrzeuge.forEach(function (f) {
      if (!S.fahrzeuge[f.id].gekauft) return;
      html += '<button type="button" class="fz-chip' + (S.fahrzeug === f.id ? " aktiv" : "") + '" data-fz="' + f.id + '">' +
              '<span class="fz-emoji">' + f.emoji + "</span>" + f.name + "</button>";
    });
    html += '<button type="button" class="fz-chip" data-garage="1"><span class="fz-emoji">🔧</span>Garage</button>';
    el.innerHTML = html;
    el.querySelectorAll(".fz-chip, .fiete-chip").forEach(function (b) {
      b.addEventListener("click", function () {
        FF.Klang.spiele("klick");
        if (b.dataset.garage) { waehleTab("garage"); return; }
        S.fahrzeug = b.dataset.fz; speichere(); baueFahrzeugLeiste();
      });
    });
  }

  function baueWelten() {
    baueFahrzeugLeiste();
    var el = $("welten-liste"), html = "";
    var naechstes = null;
    C.welten.forEach(function (w, wi) {
      for (var li = 0; li < 3 && !naechstes; li++) if (levelOffen(wi, li) && !levelStand(wi, li).geschafft) naechstes = wi + "," + li;
    });
    C.welten.forEach(function (w, wi) {
      var offen = levelOffen(wi, 0), sterne = 0;
      for (var li = 0; li < 3; li++) sterne += levelStand(wi, li).sterne || 0;
      html += '<div class="welt-karte' + (offen ? "" : " gesperrt") + '">' +
        '<div class="welt-kopf" style="background:linear-gradient(135deg,' + w.farben.himmel[0] + "," + w.farben.berge[1] + ' 70%,' + w.farben.boden[0] + ')">' +
        '<span class="welt-emoji">' + w.emoji + "</span><div><div class=\"welt-name\">" + w.name + "</div>" +
        '<div class="welt-hinweis">' + w.hinweis + "</div></div>" +
        '<span class="welt-sterne">⭐ ' + sterne + "/9</span></div>" +
        '<div class="welt-level">';
      for (li = 0; li < 3; li++) {
        var o = levelOffen(wi, li), ls = levelStand(wi, li), kl = "level-knopf";
        if (!o) kl += " gesperrt";
        if (naechstes === wi + "," + li) kl += " naechstes";
        var st = "";
        for (var k = 0; k < 3; k++) st += '<span class="' + (k < ls.sterne ? "an" : "") + '">★</span>';
        html += '<button type="button" class="' + kl + '" data-welt="' + wi + '" data-level="' + li + '" aria-label="Level ' + (li + 1) + '">' +
                (o ? li + 1 : "🔒") + '<span class="level-sterne">' + st + "</span></button>";
      }
      var eo = endlosOffen(wi), best = S.endlos[w.id] || 0;
      html += '<button type="button" class="level-knopf endlos' + (eo ? "" : " gesperrt") + '" data-welt="' + wi + '" data-endlos="1" aria-label="Endlos fahren">' +
              (eo ? "♾️" : "🔒") + "<small>" + (eo ? (best ? zahl(best) + " m" : "Endlos") : "Endlos") + "</small></button>";
      html += "</div></div>";
    });
    el.innerHTML = html;
    el.querySelectorAll(".level-knopf").forEach(function (b) {
      b.addEventListener("click", function () {
        var wi = +b.dataset.welt, li = +(b.dataset.level || 0), endlos = !!b.dataset.endlos;
        if (endlos ? !endlosOffen(wi) : !levelOffen(wi, li)) {
          FF.Klang.spiele("fehler");
          b.classList.remove("wackelt"); void b.offsetWidth; b.classList.add("wackelt");
          popover(endlos ? "🔒 Schaffe zuerst Level 1 dieser Welt!" : "🔒 Schaffe zuerst das Level davor!");
          return;
        }
        FF.Klang.spiele("klick");
        starteFahrt(wi, li, endlos);
      });
    });
  }

  /* =========================================================================
     10) GARAGE: Fahrzeuge, Tuning, Farben, Muster
     ========================================================================= */
  var garageIndex = 0;
  function indexVon(id) { for (var i = 0; i < C.fahrzeuge.length; i++) if (C.fahrzeuge[i].id === id) return i; return 0; }

  function upgradePreis(def, key, stufe) {
    var U = C.upgrades[key];
    if (key === "allrad") return def.preisBasis * U.preisMal;
    return Math.round(def.preisBasis * Math.pow(U.faktor, stufe) / 10) * 10;
  }

  function kaufe(preis, aktion, el) {
    if (S.muenzen >= preis) {
      S.muenzen -= preis;
      aktion();
      speichere();
      FF.Klang.spiele("kauf");
      konfetti(25);
      kontoAktualisieren();
      baueGarage();
      return true;
    }
    FF.Klang.spiele("fehler");
    if (el) { el.classList.remove("wackelt"); void el.offsetWidth; el.classList.add("wackelt"); }
    popover("Dir fehlen noch 🪙 " + zahl(preis - S.muenzen) + "<small>Fahr los und sammle Münzen! 🏁</small>");
    FF.Klang.sprich("Dir fehlen noch " + Math.ceil(preis - S.muenzen) + " Münzen.");
    return false;
  }

  function werteBalken(def, upg) {
    var w = FF.berechneWerte(def, upg, "normal");
    var mGes = w.masse + w.raeder.reduce(function (s, r) { return s + r.masse; }, 0);
    var nA = 0, rA = 0;
    w.raeder.forEach(function (r) { if (r.antrieb) { nA++; rA += r.r; } });
    rA /= nA;
    return [
      ["🏎️ Tempo", w.motor.vmax / 34],
      ["💪 Kraft", (w.motor.drehmoment / rA) / (mGes * 9.81) / 1.1],
      ["🛞 Grip", (w.grip * (nA === w.raeder.length ? 1.25 : 1)) / 1.9],
      ["🌀 Federung", (w.federung.weg / 0.75) * 0.6 + w.federung.daempfung * 0.4],
      ["⛽ Tank", w.tankSekunden / 70],
      ["🤸 Saltos", w.luftsteuerung / 9]
    ];
  }

  function baueGarage() {
    var def = C.fahrzeuge[garageIndex], fs = S.fahrzeuge[def.id];
    $("fz-name").textContent = def.emoji + " " + def.name;
    $("fz-nummer").textContent = (garageIndex + 1) + " / " + C.fahrzeuge.length;
    $("fz-text").textContent = def.text;
    $("fz-werte").innerHTML = werteBalken(def, fs.upgrades).map(function (b) {
      return '<span class="fz-wert-name">' + b[0] + '</span><span class="fz-wert-balken"><span style="width:' +
             Math.round(klemme(b[1], 0.05, 1) * 100) + '%"></span></span>';
    }).join("");

    var aktion = $("fz-aktion");
    aktion.className = "aktion-knopf";
    if (fs.gekauft) {
      if (S.fahrzeug === def.id) { aktion.textContent = "✅ Ausgewählt"; aktion.classList.add("ausgewaehlt"); }
      else aktion.textContent = "👉 Damit fahren";
    } else {
      aktion.textContent = "🪙 " + zahl(def.preis) + " – Kaufen";
      aktion.classList.add(S.muenzen >= def.preis ? "kaufen" : "zu-teuer");
    }

    // Tuning
    var ul = $("upgrade-liste"), html = "";
    def.upgrades.forEach(function (key) {
      var U = C.upgrades[key], stufe = fs.upgrades[key] || 0, voll = stufe >= U.stufen;
      var preis = voll ? 0 : upgradePreis(def, key, stufe);
      var punkte = "";
      for (var i = 0; i < U.stufen; i++) punkte += '<span class="' + (i < stufe ? "an" : "") + '"></span>';
      var knopfKlasse = "upgrade-kaufen" + (voll ? " voll" : (S.muenzen < preis ? " zu-teuer" : ""));
      var knopfText = !fs.gekauft ? "🔒" : (voll ? "MAX ✓" : "🪙 " + zahl(preis));
      html += '<div class="upgrade-karte' + (fs.gekauft ? "" : " gesperrt") + '">' +
              '<span class="upgrade-icon">' + U.icon + '</span><span class="upgrade-name">' + U.name + "</span>" +
              '<span class="upgrade-text">' + U.text + '</span><span class="upgrade-punkte">' + punkte + "</span>" +
              '<button type="button" class="' + knopfKlasse + '" data-upgrade="' + key + '">' + knopfText + "</button></div>";
    });
    ul.innerHTML = html;
    ul.querySelectorAll(".upgrade-kaufen").forEach(function (b) {
      b.addEventListener("click", function () {
        var key = b.dataset.upgrade, U = C.upgrades[key], stufe = fs.upgrades[key] || 0;
        if (!fs.gekauft) { FF.Klang.spiele("fehler"); popover("🔒 Kaufe zuerst das Fahrzeug!"); return; }
        if (stufe >= U.stufen) return;
        kaufe(upgradePreis(def, key, stufe), function () { fs.upgrades[key] = stufe + 1; }, b);
      });
    });

    // Farben
    var fl = $("farb-liste");
    fl.innerHTML = C.farben.map(function (f) {
      var hat = S.farben.indexOf(f.id) >= 0;
      var bg = f.wert === "regenbogen" ? "conic-gradient(#ff5b5b,#ffd23f,#3cc35a,#2f6fd6,#8e5bd8,#ff5b5b)"
             : f.glanz ? "linear-gradient(135deg,#c9962a,#fff6c8,#d9a83a)" : f.wert;
      return '<button type="button" class="farb-knopf' + (fs.farbe === f.id ? " aktiv" : "") + (hat ? "" : " gesperrt") +
             '" data-farbe="' + f.id + '" data-preis="🪙' + zahl(f.preis) + '" style="background:' + bg + '" aria-label="' + f.name + '"></button>';
    }).join("");
    fl.querySelectorAll(".farb-knopf").forEach(function (b) {
      b.addEventListener("click", function () {
        var f = farbWert(b.dataset.farbe);
        if (S.farben.indexOf(f.id) < 0) {
          kaufe(f.preis, function () { S.farben.push(f.id); fs.farbe = f.id; }, b);
          return;
        }
        FF.Klang.spiele("klick");
        fs.farbe = f.id; speichere(); baueGarage();
      });
    });

    // Fietes Outfit (gilt für alle Fahrzeuge) – nur Bilder, keine Namen
    var ol = $("outfit-liste");
    ol.innerHTML = C.outfits.map(function (o, i) {
      var hat = S.outfits.indexOf(o.id) >= 0;
      return '<button type="button" class="outfit-knopf' + (S.outfit === o.id ? " aktiv" : "") + (hat ? "" : " gesperrt") +
             '" data-outfit="' + o.id + '" aria-label="Outfit ' + (i + 1) + '">' +
             '<img src="' + fieteBild(76, 84, "normal", false, o.id) + '" alt="">' +
             (hat ? "" : '<span class="preis">🪙' + zahl(o.preis) + "</span>") + "</button>";
    }).join("");
    ol.querySelectorAll(".outfit-knopf").forEach(function (b) {
      b.addEventListener("click", function () {
        var o = outfitWert(b.dataset.outfit);
        if (S.outfits.indexOf(o.id) < 0) {
          kaufe(o.preis, function () { S.outfits.push(o.id); S.outfit = o.id; }, b);
          return;
        }
        FF.Klang.spiele("klick");
        S.outfit = o.id; speichere(); baueGarage();
      });
    });

    // Muster
    var ml = $("muster-liste");
    ml.innerHTML = C.muster.map(function (m) {
      var hat = S.muster.indexOf(m.id) >= 0;
      return '<button type="button" class="muster-knopf' + (fs.muster === m.id ? " aktiv" : "") + '" data-muster="' + m.id + '">' +
             m.icon + " " + m.name + (hat ? "" : ' <span class="preis">🪙' + zahl(m.preis) + "</span>") + "</button>";
    }).join("");
    ml.querySelectorAll(".muster-knopf").forEach(function (b) {
      b.addEventListener("click", function () {
        var id = b.dataset.muster, m = C.muster.filter(function (x) { return x.id === id; })[0];
        if (S.muster.indexOf(id) < 0) {
          kaufe(m.preis, function () { S.muster.push(id); fs.muster = id; }, b);
          return;
        }
        FF.Klang.spiele("klick");
        fs.muster = id; speichere(); baueGarage();
      });
    });
  }

  $("fz-zurueck").addEventListener("click", function () {
    FF.Klang.spiele("klick");
    garageIndex = (garageIndex + C.fahrzeuge.length - 1) % C.fahrzeuge.length; baueGarage();
  });
  $("fz-vor").addEventListener("click", function () {
    FF.Klang.spiele("klick");
    garageIndex = (garageIndex + 1) % C.fahrzeuge.length; baueGarage();
  });
  $("fz-aktion").addEventListener("click", function () {
    var def = C.fahrzeuge[garageIndex], fs = S.fahrzeuge[def.id];
    if (fs.gekauft) {
      FF.Klang.spiele("klick");
      S.fahrzeug = def.id; speichere(); baueGarage();
      popover(def.emoji + " Du fährst jetzt mit dem " + def.name + "!", 1800);
      return;
    }
    kaufe(def.preis, function () { fs.gekauft = true; S.fahrzeug = def.id; }, $("fz-aktion"));
  });

  /* =========================================================================
     11) EINSTELLUNGEN, ELTERN-DIALOG, MODALS
     ========================================================================= */
  function oeffneModal(id) { var m = $(id); m.classList.add("offen"); m.setAttribute("aria-hidden", "false"); }
  function schliesseModal(id) { var m = $(id); m.classList.remove("offen"); m.setAttribute("aria-hidden", "true"); }

  function einstellungenAnzeigen() {
    document.querySelectorAll("[data-setting]").forEach(function (b) {
      b.classList.toggle("aktiv", S.einstellungen[b.dataset.setting] === b.dataset.wert);
    });
    document.querySelectorAll("[data-schalter]").forEach(function (b) {
      b.classList.toggle("aktiv", !!S.einstellungen[b.dataset.schalter]);
    });
  }
  function einstellungenAnwenden() {
    FF.Klang.setzeAn(S.einstellungen.ton);
    FF.Klang.setzeSprache(S.einstellungen.sprache);
  }
  document.querySelectorAll("[data-setting]").forEach(function (b) {
    b.addEventListener("click", function () {
      FF.Klang.init(); FF.Klang.spiele("klick");
      S.einstellungen[b.dataset.setting] = b.dataset.wert; speichere(); einstellungenAnzeigen();
    });
  });
  document.querySelectorAll("[data-schalter]").forEach(function (b) {
    b.addEventListener("click", function () {
      FF.Klang.init();
      var k = b.dataset.schalter;
      S.einstellungen[k] = !S.einstellungen[k]; speichere();
      einstellungenAnwenden(); einstellungenAnzeigen();
      FF.Klang.spiele("klick");
      if (k === "sprache" && S.einstellungen.sprache) FF.Klang.sprich("Ich lese dir vor!");
    });
  });
  function oeffneEinstellungen() { FF.Klang.init(); FF.Klang.spiele("klick"); einstellungenAnzeigen(); oeffneModal("einstellungen"); }
  $("knopf-einstellungen").addEventListener("click", oeffneEinstellungen);
  $("knopf-titel-einstellungen").addEventListener("click", oeffneEinstellungen);
  ["einstellungen-zu", "einstellungen-fertig"].forEach(function (id) {
    $(id).addEventListener("click", function () {
      FF.Klang.spiele("klick"); schliesseModal("einstellungen");
      if (modus === "menue") { baueWelten(); if (aktiverTab === "garage") baueGarage(); }
    });
  });

  // Zurücksetzen: nur mit kleiner Rechenaufgabe für Erwachsene
  $("knopf-zuruecksetzen").addEventListener("click", function () {
    var a = 6 + Math.floor(Math.random() * 4), b = 6 + Math.floor(Math.random() * 4), loesung = a * b;
    $("eltern-aufgabe").textContent = a + " × " + b;
    var antworten = [loesung, loesung + a, loesung - b].sort(function () { return Math.random() - 0.5; });
    $("eltern-antworten").innerHTML = antworten.map(function (x) {
      return '<button type="button" class="eltern-antwort" data-wert="' + x + '">' + x + "</button>";
    }).join("");
    $("eltern-antworten").querySelectorAll("button").forEach(function (knopf) {
      knopf.addEventListener("click", function () {
        if (+knopf.dataset.wert === loesung) {
          S = neuerSpielstand(); speichere();
          schliesseModal("eltern"); schliesseModal("einstellungen");
          einstellungenAnwenden();
          popover("♻️ Alles zurückgesetzt – viel Spaß beim neuen Start!");
          if (modus === "menue") zeigeMenue("fahren");
        } else {
          var m = document.querySelector(".eltern-modal");
          m.classList.remove("wackelt"); void m.offsetWidth; m.classList.add("wackelt");
          FF.Klang.spiele("fehler");
        }
      });
    });
    oeffneModal("eltern");
  });
  $("eltern-abbrechen").addEventListener("click", function () { schliesseModal("eltern"); });

  $("knopf-info").addEventListener("click", function () {
    FF.Klang.spiele("klick");
    popover('<img class="popover-fiete" src="' + fieteBild(110, 120, "freude") + '" alt="Fiete">' +
            "<b>Fiete Flitzer</b><br>ein Spiel von JONFIE STUDIOS<small>Rechts Gas ➡️, links Bremse ⬅️. Sammle Münzen 🪙 und Benzin ⛽ – " +
            "und mach Fietes Auto in der Garage 🔧 immer besser!<br>Gefahren: " + zahl(S.statistik.meter) + " m · Saltos: " + S.statistik.salti + "</small>", 5000);
  });
  $("hud-muenzen").addEventListener("click", function () { popover("🪙 Münzen in dieser Fahrt<small>Die darfst du immer behalten!</small>", 2000); });
  $("hud-tank").addEventListener("click", function () { popover("⛽ Dein Benzin<small>Sammle die roten Kanister, sonst bleibt das Auto stehen.</small>", 2400); });

  /* =========================================================================
     12) TITEL + PWA
     ========================================================================= */
  $("knopf-start").addEventListener("click", function () {
    FF.Klang.init(); einstellungenAnwenden(); FF.Klang.spiele("klick");
    var t = $("titelscreen");
    t.classList.add("aus");
    setTimeout(function () { t.classList.remove("aus"); zeigeMenue("fahren"); }, 380);
  });

  if ("serviceWorker" in navigator && location.protocol !== "file:") {
    window.addEventListener("load", function () {
      navigator.serviceWorker.register("sw.js").catch(function () { /* egal */ });
    });
  }
  var installEreignis = null;
  window.addEventListener("beforeinstallprompt", function (e) {
    e.preventDefault(); installEreignis = e;
    $("install-gruppe").hidden = false;
    $("install-hinweis").textContent = "Dann ist Fiete Flitzer wie eine richtige App auf dem Startbildschirm – auch ohne Internet.";
  });
  $("knopf-installieren").addEventListener("click", function () {
    if (!installEreignis) return;
    installEreignis.prompt();
    installEreignis.userChoice.finally(function () { installEreignis = null; $("install-gruppe").hidden = true; });
  });
  (function iosHinweis() {
    var ios = /iphone|ipad|ipod/i.test(navigator.userAgent) && !window.navigator.standalone;
    if (ios) {
      $("install-gruppe").hidden = false;
      $("knopf-installieren").hidden = true;
      $("install-hinweis").innerHTML = "📲 Aufs iPhone/iPad holen: unten auf <b>Teilen</b> tippen, dann <b>„Zum Home-Bildschirm“</b>.";
    }
  })();

  /* =========================================================================
     13) SPIELSCHLEIFE + START
     ========================================================================= */
  function zeichneKleinCanvas(id) {
    var c = $(id);
    if (!c || !c.width) return;
    var g = c.getContext("2d");
    g.setTransform(1, 0, 0, 1, 0, 0);
    var def = id === "vorschau" ? C.fahrzeuge[garageIndex] : FF.fahrzeugDef(S.fahrzeug);
    g.save(); g.scale(DPR, DPR);
    FF.Grafik.zeichneVorschau(g, c.width / DPR, c.height / DPR, def, aussehenVon(def.id), zeit);
    g.restore();
  }

  function schleife(t) {
    requestAnimationFrame(schleife);
    var dt = letzteZeit ? Math.min(0.05, (t - letzteZeit) / 1000) : 0;
    letzteZeit = t;
    zeit += dt;

    if (modus === "fahrt" && fahrt) {
      if (!pausiert && !ergebnisOffen) {
        fahrt.aktualisiere(dt, eingabe);
        verarbeiteEreignisse();
        if (!fahrt) return;
        fahrEffekte(dt);
        kameraNachfuehren(dt, false);
        hudAktualisieren(false);
        var st = fahrt.fz.status;
        FF.Klang.motorSetze(st.drehzahl, fahrt.gas, fahrt.tank > 0 && (fahrt.zustand === "fahrt" || fahrt.zustand === "ziel"));
        if (zeit > ausdruckBis) {
          var inLuft = st.radKontakte === 0 && !st.huellKontakt;
          ausdruck = fahrt.luftZeit > 0.35 && inLuft ? "freude" : (fahrt.tank <= 0 ? "staunen" : "normal");
        }
      }
      partikel.aktualisiere(pausiert ? 0 : dt, fahrt.welt.schwerkraft);
      texteAktualisieren(pausiert ? 0 : dt);
      ctx.setTransform(DPR, 0, 0, DPR, 0, 0);
      FF.Grafik.zeichneSzene(ctx, {
        fahrt: fahrt, kamera: kamera, zeit: zeit, dt: pausiert ? 0 : dt,
        partikel: partikel, texte: texte, wetter: wetter,
        aussehen: aussehenVon(S.fahrzeug), ausdruck: ausdruck,
        kraefte: S.einstellungen.kraefte, instrumente: S.einstellungen.instrumente
      });
    } else if (modus === "menue" && aktiverTab === "garage") {
      zeichneKleinCanvas("vorschau");
    } else if (modus === "titel") {
      zeichneKleinCanvas("titel-auto");
    }
  }

  einstellungenAnwenden();
  zeigeBildschirm("titel");
  groesseAnpassen();
  // Schriften laden, dann Canvas-Größen neu bestimmen (Layout kann sich ändern)
  if (document.fonts && document.fonts.ready) document.fonts.ready.then(groesseAnpassen);
  requestAnimationFrame(schleife);

  // Für Tests in der Konsole
  FF.spiel = {
    get spielstand() { return S; },
    starteFahrt: starteFahrt,
    get fahrt() { return fahrt; },
    zeigeMenue: zeigeMenue,
    setzeEingabe: function (g, b) { tasten.gas = !!g; tasten.bremse = !!b; eingabeAktualisieren(); }
  };
})();
