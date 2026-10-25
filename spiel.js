/* ===========================================================================
   Fiete Flitzer – spiel.js
   ---------------------------------------------------------------------------
   Klebt alles zusammen: Spielschleife, Eingabe (Pedale, Touch, Tastatur),
   Kamera, Effekte, HUD, Spielerwahl (Fiete / Jonte / zu zweit), Menü mit
   Welten, Garage (Kaufen, Tuning, Farben, Outfits), Geisterrennen zu zweit,
   Ergebnis, Einstellungen, Speicherstand (localStorage) und PWA.

   Jedes Kind hat ein EIGENES Profil (Münzen, Garage, Outfit, Fortschritt).
   P zeigt immer auf das Profil des Kindes, das gerade dran ist.

   Gliederung:
     1) Speicherstand + Profile      9) Spielerwahl + Menü + Welten
     2) Zustand + Canvas            10) Geisterrennen: Lobby, Würfeln,
     3) Eingabe                         Übergabe, Siegerehrung
     4) Kamera                      11) Garage
     5) Effekte (Partikel …)        12) Einstellungen, Eltern-Dialog
     6) Ereignisse der Fahrt        13) Titel, PWA
     7) Fahrt starten/beenden, HUD  14) Spielschleife + Start
     8) Ergebnis (allein)
   =========================================================================== */

(function () {
  "use strict";

  var C = FF.CONFIG;
  var VERSION = ((document.currentScript && /[?&]v=(\w+)/.exec(document.currentScript.src)) || [])[1] || "?";
  function $(id) { return document.getElementById(id); }
  function klemme(v, a, b) { return Math.max(a, Math.min(b, v)); }
  function zahl(n) { return Math.round(n).toLocaleString("de-DE"); }
  function sekunden(t) { return t.toFixed(1).replace(".", ",") + " s"; }

  function kindDef(id) {
    for (var i = 0; i < C.kinder.length; i++) if (C.kinder[i].id === id) return C.kinder[i];
    return C.kinder[0];
  }
  function anderesKind(id) { return C.kinder[0].id === id ? C.kinder[1].id : C.kinder[0].id; }
  function genitiv(name) { return /[sxzß]$/i.test(name) ? name + "’" : name + "s"; }

  /* =========================================================================
     1) SPEICHERSTAND + PROFILE
     ========================================================================= */
  var SCHLUESSEL = "fiete-flitzer-spielstand-v1";

  function neuesFahrzeug(f) { return { gekauft: f.preis === 0, upgrades: {}, farbe: f.farbe, muster: "keins" }; }

  function neuesProfil() {
    var p = {
      muenzen: C.startMuenzen,
      fahrzeug: "flitzer",
      fahrzeuge: {},
      farben: C.farben.filter(function (f) { return f.preis === 0; }).map(function (f) { return f.id; }),
      muster: ["keins"],
      outfit: C.outfits[0].id,
      outfits: [C.outfits[0].id],
      look: null,                  // Variante aus kinder.js (z. B. Fiete mit Cap); null = Grundform
      level: {},
      endlos: {},
      freigeschaltet: [],          // Welten (ids), die offen bleiben – z. B. aus alten Spielständen
      statistik: { fahrten: 0, meter: 0, salti: 0, muenzen: 0 }
    };
    C.fahrzeuge.forEach(function (f) { p.fahrzeuge[f.id] = neuesFahrzeug(f); });
    return p;
  }

  function neuerSpielstand() {
    var s = {
      version: 3,
      aktiv: C.kinder[0].id,
      spieler: {},
      einstellungen: { ton: true, sprache: true, schwierigkeit: "normal", instrumente: true, kraefte: false, bruchlandung: false },
      duell: { welt: 0, stufe: 0, endlos: false, siege: {} },
      entwickler: { alleOffen: false }      // versteckter Entwickler-Bereich (Einstellungen → 7× auf die Version tippen)
    };
    C.kinder.forEach(function (k) { s.spieler[k.id] = neuesProfil(); s.duell.siege[k.id] = 0; });
    return s;
  }

  /* Gespeicherte Daten vorsichtig in ein frisches Profil übernehmen */
  function uebernimmProfil(ziel, d) {
    if (!d || typeof d !== "object") return;
    Object.keys(ziel).forEach(function (k) {
      if (d[k] === undefined || d[k] === null) return;
      if (k === "fahrzeuge" || k === "statistik") {
        if (typeof d[k] === "object") Object.keys(d[k]).forEach(function (kk) { ziel[k][kk] = d[k][kk]; });
      } else ziel[k] = d[k];
    });
    C.fahrzeuge.forEach(function (f) { if (!ziel.fahrzeuge[f.id]) ziel.fahrzeuge[f.id] = neuesFahrzeug(f); });
    var frisch = neuesProfil();
    ["farben", "muster", "outfits", "freigeschaltet"].forEach(function (k) { if (!Array.isArray(ziel[k])) ziel[k] = frisch[k]; });
    frisch.farben.forEach(function (f) { if (ziel.farben.indexOf(f) < 0) ziel.farben.push(f); });   // neue Gratis-Farben
    if (typeof ziel.muenzen !== "number" || !isFinite(ziel.muenzen) || ziel.muenzen < 0) ziel.muenzen = 0;
    if (!ziel.fahrzeuge[ziel.fahrzeug] || !ziel.fahrzeuge[ziel.fahrzeug].gekauft) ziel.fahrzeug = "flitzer";
    if (ziel.outfits.indexOf(ziel.outfit) < 0) ziel.outfit = C.outfits[0].id;
  }

  /* Bis Spielstand-Version 2 gab es diese acht Welten in dieser Reihenfolge (je
     drei Level). Damals öffnete Level 3 die nächste Welt. Inzwischen liegen
     Baustelle und Achterbahn-Park dazwischen – was schon offen war, bleibt offen. */
  var ALTE_WELTEN = ["wiese", "wueste", "schnee", "mond", "bonbon", "dschungel", "vulkan", "regenbogen"];
  function weltIndex(id) {
    for (var i = 0; i < C.welten.length; i++) if (C.welten[i].id === id) return i;
    return -1;
  }
  function alteFreischaltungen(p) {
    for (var k = 1; k < ALTE_WELTEN.length; k++) {
      var vorher = p.level[ALTE_WELTEN[k - 1] + "-3"];
      if (vorher && vorher.geschafft && p.freigeschaltet.indexOf(ALTE_WELTEN[k]) < 0) p.freigeschaltet.push(ALTE_WELTEN[k]);
    }
  }

  function lade() {
    var s = neuerSpielstand();
    try {
      var roh = window.localStorage.getItem(SCHLUESSEL);
      if (roh) {
        var d = JSON.parse(roh);
        var alt = !d || !(d.version >= 3);
        if (d && d.spieler) {
          C.kinder.forEach(function (k) { uebernimmProfil(s.spieler[k.id], d.spieler[k.id]); });
          if (s.spieler[d.aktiv]) s.aktiv = d.aktiv;
          if (d.duell) {
            ["welt", "stufe", "endlos"].forEach(function (k) { if (d.duell[k] !== undefined) s.duell[k] = d.duell[k]; });
            // Welt per Name (ab Version 3), alte Stände: Index der alten Reihenfolge
            var wid = alt ? ALTE_WELTEN[d.duell.welt] : d.duell.weltId;
            if (wid && weltIndex(wid) >= 0) s.duell.welt = weltIndex(wid);
            if (!(s.duell.welt >= 0 && s.duell.welt < C.welten.length)) s.duell.welt = 0;
            if (!(s.duell.stufe >= 0 && s.duell.stufe < C.welten[s.duell.welt].level.length)) s.duell.stufe = 0;
            s.duell.endlos = s.duell.endlos === true;
            if (d.duell.siege) C.kinder.forEach(function (k) { s.duell.siege[k.id] = +d.duell.siege[k.id] || 0; });
          }
        } else if (d) {
          uebernimmProfil(s.spieler[C.kinder[0].id], d);       // alter Spielstand (v1) gehört Fiete
        }
        if (d && d.einstellungen) Object.keys(s.einstellungen).forEach(function (k) {
          if (d.einstellungen[k] !== undefined) s.einstellungen[k] = d.einstellungen[k];
        });
        if (d && d.entwickler) s.entwickler.alleOffen = d.entwickler.alleOffen === true;
        if (alt) C.kinder.forEach(function (k) { alteFreischaltungen(s.spieler[k.id]); });
      }
    } catch (e) { /* kaputter Speicher → frisch anfangen */ }
    return s;
  }

  function speichere() {
    S.duell.weltId = C.welten[S.duell.welt] ? C.welten[S.duell.welt].id : C.welten[0].id;
    try { window.localStorage.setItem(SCHLUESSEL, JSON.stringify(S)); } catch (e) { /* privat-Modus o. ä. */ }
  }

  var S = lade();
  var P = S.spieler[S.aktiv];                // Profil des Kindes, das gerade dran ist
  function setzeAktiv(id) { S.aktiv = id; P = S.spieler[id]; }

  function levelSchluessel(wi, li) { return C.welten[wi].id + "-" + (li + 1); }
  function levelStand(wi, li, prof) { return (prof || P).level[levelSchluessel(wi, li)] || { geschafft: false, sterne: 0 }; }
  /* Level n+1 öffnet sich mit Level n. Die nächste Welt öffnet sich schon mit
     Level 3 – Level 4 ist ein freiwilliges Profi-Level. Was einmal geschafft
     wurde, bleibt offen (auch wenn sich die Reihenfolge der Welten ändert). */
  var PROFI = 3;                                   // Index des Profi-Levels
  function levelOffen(wi, li, prof) {
    if ((wi === 0 && li === 0) || S.entwickler.alleOffen) return true;
    if (levelStand(wi, li, prof).geschafft) return true;
    if (li === 0 && (prof || P).freigeschaltet.indexOf(C.welten[wi].id) >= 0) return true;
    return li > 0 ? levelStand(wi, li - 1, prof).geschafft : levelStand(wi - 1, PROFI - 1, prof).geschafft;
  }
  function endlosOffen(wi, prof) { return S.entwickler.alleOffen || levelStand(wi, 0, prof).geschafft; }
  function sterneSumme(prof) {
    return Object.keys(prof.level).reduce(function (s, k) { return s + (prof.level[k].sterne || 0); }, 0);
  }
  function farbWert(id) {
    for (var i = 0; i < C.farben.length; i++) if (C.farben[i].id === id) return C.farben[i];
    return C.farben[0];
  }
  function outfitWert(id) {
    for (var i = 0; i < C.outfits.length; i++) if (C.outfits[i].id === id) return C.outfits[i];
    return C.outfits[0];
  }
  /* Wie sieht das Auto eines Kindes aus (Lack, Muster, Outfit, Kind)? */
  /* Look des Kindes (kinder.js: Fiete mit oder ohne Cap, Jonte mit Dutt oder
     offenen Haaren). Gratis, gilt überall – auch für den Geist im Duell. */
  function lookListe(kindId) { return FF.Kinder.VARIANTEN[kindId] || []; }
  function lookVon(kindId) {
    var L = lookListe(kindId), l = S.spieler[kindId].look;
    for (var i = 0; i < L.length; i++) if (L[i].id === l) return l;
    return L.length ? L[0].id : null;
  }
  var kindLookCache = {};
  function kindMitLook(kindId, look) {
    look = look || lookVon(kindId);
    var key = kindId + "|" + look;
    if (!kindLookCache[key]) {
      var k = kindDef(kindId), m = {};
      Object.keys(k).forEach(function (f) { m[f] = k[f]; });
      m.variante = look;
      kindLookCache[key] = m;
    }
    return kindLookCache[key];
  }

  function aussehenVon(kindId, fzId) {
    var prof = S.spieler[kindId];
    fzId = fzId || prof.fahrzeug;
    var fs = prof.fahrzeuge[fzId] || {};
    var f = farbWert(fs.farbe || FF.fahrzeugDef(fzId).farbe);
    return { farbe: f.wert, glanz: !!f.glanz, muster: fs.muster || "keins", outfit: outfitWert(prof.outfit), kind: kindMitLook(kindId) };
  }

  /* Kind als Bild (Brustbild oder nur Kopf) – gezeichnet mit denselben
     Funktionen wie im Auto, damit es überall gleich aussieht. */
  var bildCache = {};
  function kindBild(kindId, b, h, ausdruck, nurKopf, outfitId, look) {
    var o = outfitWert(outfitId || S.spieler[kindId].outfit), kind = kindMitLook(kindId, look);
    var key = [kindId, b, h, ausdruck, nurKopf, o.id, kind.variante].join("|");
    if (bildCache[key]) return bildCache[key];
    var c = document.createElement("canvas");
    c.width = b * 2; c.height = h * 2;
    var g = c.getContext("2d");
    g.scale(2, 2);
    FF.Grafik.zeichnePortrait(g, b, h, { outfit: o, kind: kind }, ausdruck, 0.4, nurKopf);
    return (bildCache[key] = c.toDataURL());
  }

  /* =========================================================================
     2) ZUSTAND + CANVAS
     ========================================================================= */
  var canvas = $("spielfeld"), ctx = canvas.getContext("2d");
  var himmelWelt = null;          // Welt, deren Himmelsverlauf gerade als CSS hinter dem Canvas liegt
  var B = 0, H = 0, DPR = 1;
  var modus = "titel";                 // titel | wahl | menue | fahrt
  var spielModus = "solo";             // solo | duell
  var fahrt = null, fahrtInfo = null, pausiert = false, ergebnisOffen = false;
  var duell = null;                    // laufendes Geisterrennen (siehe Abschnitt 10)
  var aufnahme = null, geist = null;   // Aufzeichnung (1. Fahrt) bzw. Geist (2. Fahrt)
  var kamera = { x: 0, y: 0, s: 40, b: 0, h: 0, ankerX: 0.42, ankerY: 0.56, zoom: 1 };
  var partikel = new FF.Grafik.Partikel(), texte = [], wetter = new FF.Grafik.Wetter();
  var zeit = 0, letzteZeit = 0;
  var ausdruck = "normal", ausdruckBis = 0;
  var spruchBis = 0;               // bis dahin läuft ein wichtiger gesprochener Hinweis (nicht überreden)
  var luftTippGezeigt = false;     // "Gas hebt die Nase, Bremse senkt sie" – einmal pro Spielstart
  var pedaleLuft = false;          // Pedale zeigen gerade die Luft-Pfeile
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
    if (modus !== "fahrt" || pausiert || ergebnisOffen) return;
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

  /* Zusatz-Knöpfe 🚀 Boost und 🦘 Sprungfeder. Noch nicht bereit → kurzer Tipp, wie man sie auflädt. */
  var extraTipps = { boost: false, feder: false };
  function extraDruecken(art) {
    if (!fahrt || modus !== "fahrt" || pausiert || ergebnisOffen) return;
    FF.Klang.init();
    if (fahrt.zuende(art)) return;
    var X = C.regeln.extras, es = fahrt.extraStand();
    FF.Klang.spiele("fehler");
    if (art === "boost") tipp(fahrt.boostZeit > 0 ? "🚀 Der Turbo läuft schon!" : "🚀 Sammle einen lila Raketen-Kanister – dann gibt der Knopf Turbo!", 3000);
    else if (es.feder >= 1) tipp("🦘 Die Sprungfeder geht nur, wenn die Räder auf dem Boden sind.", 3000);
    else tipp("🦘 Mach " + (X.federSalti - es.federSalti) + (X.federSalti - es.federSalti === 1 ? " Salto" : " Saltos") +
              " (oder Loopings) – dann ist die Sprungfeder bereit!", 3500);
  }
  [["knopf-boost", "boost"], ["knopf-feder", "feder"]].forEach(function (p) {
    $(p[0]).addEventListener("pointerdown", function (e) { e.preventDefault(); e.stopPropagation(); extraDruecken(p[1]); });
  });

  var TASTEN_GAS = ["ArrowRight", "ArrowUp", "KeyD", "KeyW"], TASTEN_BREMSE = ["ArrowLeft", "ArrowDown", "KeyA", "KeyS"];
  window.addEventListener("keydown", function (e) {
    if (modus !== "fahrt") return;
    if (TASTEN_GAS.indexOf(e.code) >= 0) { tasten.gas = true; e.preventDefault(); FF.Klang.init(); }
    else if (TASTEN_BREMSE.indexOf(e.code) >= 0) { tasten.bremse = true; e.preventDefault(); FF.Klang.init(); }
    else if (e.code === "Escape" || e.code === "KeyP") { if (!ergebnisOffen) (pausiert ? weiter() : pause()); }
    else if (e.code === "Space" || e.code === "KeyJ") { if (!e.repeat) extraDruecken("feder"); e.preventDefault(); }
    else if (e.code === "KeyB" || e.code === "ShiftLeft" || e.code === "ShiftRight") { if (!e.repeat) extraDruecken("boost"); e.preventDefault(); }
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
  function wackeln(el) { if (!el) return; el.classList.remove("wackelt"); void el.offsetWidth; el.classList.add("wackelt"); }

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
    if (fahrt.gas > 0.4 && fahrt.tank > 0 && auspuffTakt <= 0 && !fahrt.getriebe.elektro) {   // Elektro: kein Auspuff
      auspuffTakt = 0.09;
      var L = fahrt.werte.groesse.laenge;
      var ca = Math.cos(ch.a), sa = Math.sin(ch.a), lx = -L * 0.5, ly = -0.05;
      partikel.neu({ art: "rauch", x: ch.x + ca * lx - sa * ly, y: ch.y + sa * lx + ca * ly,
                     vx: -ca * 1.5 + ch.vx * 0.6, vy: 0.6 - sa * 1.5 + ch.vy * 0.6,
                     t: 0, dauer: 0.7, r0: 0.08, r1: 0.35, farbe: "rgba(200,205,220,0.9)", alpha: 0.6, reibung: 1.5 });
    }
    if (fahrt.boostZeit > 0 && Math.random() < 0.7) {          // 🚀 Turbo: Rauchwolken hinter den Düsen
      var Lb = fahrt.werte.groesse.laenge, cb = Math.cos(ch.a), sb = Math.sin(ch.a), xb = -Lb * 0.5 - 1.2;
      partikel.neu({ art: "rauch", x: ch.x + cb * xb, y: ch.y + sb * xb,
                     vx: -cb * 3 + ch.vx * 0.3, vy: 0.5 - sb * 3 + ch.vy * 0.3,
                     t: 0, dauer: 0.6, r0: 0.2, r1: 0.7, farbe: "rgba(255,190,120,0.9)", alpha: 0.55, reibung: 1.5 });
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

  /* Benzin oder Akku? Texte passend zum Fahrzeug */
  function energie(def) {
    return def.akku
      ? { icon: "🔋", name: "Akku", voll: "⚡ Geladen!", knapp: "🔋 Akku wird leer – sammle eine grüne Batterie!", knappSag: "Akku wird leer!",
          leer: "Akku leer! 🔋", ergebnis: "Akku leer – gut gefahren!", garage: "den Akku 🔋",
          info: "🔋 Dein Akku<small>Sammle die grünen Batterien – und Bremsen lädt ihn wieder auf!</small>" }
      : { icon: "⛽", name: "Tank", voll: "⛽ Voll!", knapp: "⛽ Benzin wird knapp – sammle einen roten Kanister!", knappSag: "Benzin wird knapp!",
          leer: "Tank leer! ⛽", ergebnis: "Tank leer – gut gefahren!", garage: "den Tank ⛽",
          info: "⛽ Dein Benzin<small>Sammle die roten Kanister, sonst bleibt das Auto stehen.</small>" };
  }

  /* =========================================================================
     6) EREIGNISSE DER FAHRT → Ton, Effekte, Texte
     ========================================================================= */
  function setzeAusdruck(a, dauer) { ausdruck = a; ausdruckBis = zeit + (dauer || 1.5); }

  function verarbeiteEreignisse() {
    var E = fahrt.ereignisse, ch = fahrt.fz.chassis, en = energie(fahrt.def);
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
          FF.Klang.spiele(fahrt.def.akku ? "laden" : "tank");
          funkeln(e.x, e.y + 0.6, "#ffd23f", 8);
          schwebeText(e.x, e.y + 1.4, en.voll, "#7dffb8", true);
          $("hud-tank").classList.remove("knapp");
          break;
        case "tankWarnung":
          FF.Klang.spiele("tankWarnung");
          tipp(en.knapp);
          FF.Klang.sprich(en.knappSag);
          break;
        case "tankLeer":
          FF.Klang.spiele("tankLeer");
          meldung(en.leer);
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
        case "looping":
          FF.Klang.spiele("salto");
          meldung("Looping! 🎢");
          schwebeText(e.x, e.y + 1.8, "+" + e.bonus, "#ffd23f", true);
          konfettiWelt(e.x, e.y + 1, 14);
          setzeAusdruck("freude", 1.6);
          FF.Klang.sprich("Looping!");
          break;
        case "boost":
          FF.Klang.spiele("boost");
          schwebeText(ch.x, ch.y + 1.6, "Turbo! 🚀", "#ffb02e", true);
          setzeAusdruck("freude", 2);
          break;
        case "feder":
          FF.Klang.spiele("feder");
          schwebeText(ch.x, ch.y + 1.6, "Boing! 🦘", "#7dffb8", true);
          setzeAusdruck("freude", 2);
          fahrt.fz.raeder.forEach(function (R) {
            for (var k = 0; k < 5; k++) {
              partikel.neu({ art: "staub", x: R.k.x + (Math.random() - 0.5) * 0.6, y: R.k.y - R.r + 0.1,
                             vx: (Math.random() - 0.5) * 5, vy: Math.random() * 1.5, t: 0, dauer: 0.7,
                             r0: 0.15, r1: 0.7, farbe: fahrt.welt.farben.punkte, alpha: 0.7, reibung: 2 });
            }
          });
          break;
        case "rakete":
          FF.Klang.spiele("rakete");
          funkeln(e.x, e.y + 0.6, "#c9a8ff", 10);
          schwebeText(e.x, e.y + 1.4, e.voll ? "🚀 schon voll" : "🚀 Turbo +1", "#c9a8ff", true);
          plopp($("knopf-boost"));
          if (!e.voll && !extraTipps.boost) {
            extraTipps.boost = true;
            tipp("🚀 Rakete eingesammelt! Drück den 🚀-Knopf links – dann gibt es Turbo!", 4500);
            FF.Klang.sprich("Rakete! Drück den Raketen-Knopf für Turbo!"); spruchBis = zeit + 3;
          }
          break;
        case "extraBereit":
          FF.Klang.spiele("extraBereit");
          plopp($("knopf-feder"));
          if (!extraTipps.feder) {
            extraTipps.feder = true;
            tipp("🦘 Sprungfeder bereit! Oben auf dem Berg drücken – dann fliegst du weit!", 4500);
            FF.Klang.sprich("Sprungfeder bereit!"); spruchBis = zeit + 3;
          }
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
          if (e.bergauf && e.rueckwaerts) {              // am Berg nach hinten gekippt: zu viel Gas
            tipp("⛰️ Am Berg nicht so viel Gas – sonst kippt das Auto nach hinten!", 4500);
            FF.Klang.sprich("Weniger Gas am Berg!");
            spruchBis = zeit + 3;
          }
          break;
        case "bruch":
          // Bruchlandung: viel zu schief zum Hang aufgekommen – sagen, was hilft
          FF.Klang.spiele("hoppla");
          setzeAusdruck("staunen", 3);
          schwebeText(ch.x, ch.y + 1.6, "Bums! 💥", "#ffffff", true);
          if (e.nase === "hoch") {
            tipp("💥 Nase zu hoch ⤴ – in der Luft kurz BREMSEN, dann senkt sie sich!", 4500);
            FF.Klang.sprich("Bums! Die Nase war zu hoch. In der Luft bremsen!");
          } else {
            tipp("💥 Nase zu tief ⤵ – in der Luft GAS geben, dann hebt sie sich!", 4500);
            FF.Klang.sprich("Bums! Die Nase war zu tief. In der Luft Gas geben!");
          }
          spruchBis = zeit + 3;
          break;
        case "hilfe":
          FF.Klang.spiele("hilfe");
          meldung("Ballon-Hilfe! 🎈");
          if (zeit > spruchBis) FF.Klang.sprich("Hoppla! Der Ballon hilft dir.");
          if (e.abzug > 0) schwebeText(ch.x, ch.y + 2.4, "−" + Math.round(e.abzug * 100) + " % " + en.icon, "#ffb3ad", false);
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
        case "geladen":
          schwebeText(ch.x, ch.y + 1.3, "+⚡", "#7dffb8", false);
          if (!fahrt.ladeTippGezeigt) {
            fahrt.ladeTippGezeigt = true;
            tipp("⚡ Bremsen lädt den Akku wieder auf!", 3000);
            FF.Klang.sprich("Bremsen lädt den Akku!");
          }
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
          // nur diese Fahrt beenden – nicht eine inzwischen neu gestartete
          setTimeout(function (f) { if (f === fahrt) fahrtZuEnde(); }.bind(null, fahrt), e.grund === "ziel" ? 200 : 600);
          break;
      }
    }
    E.length = 0;
  }

  /* Live-Vergleich mit dem Geist: Überholen und "Geist ist schon im Ziel" ansagen */
  function geistVergleich() {
    if (!geist) return;
    var g = geist.obj, vorsprung = fahrt.strecke - g.strecke;
    if (geist.vorne === null) geist.vorne = vorsprung > 0;
    if (!geist.vorne && vorsprung > 1.5 && g.strecke > 15) {
      geist.vorne = true;
      meldung("Überholt! 🚀");
      FF.Klang.spiele("meilenstein");
      FF.Klang.sprich("Überholt!");
    } else if (geist.vorne && vorsprung < -1.5) {
      geist.vorne = false;
    }
    var eg = duell.aufnahme.ergebnis;
    if (!geist.zielGemeldet && g.fertig && eg.ziel && fahrt.zustand === "fahrt") {
      geist.zielGemeldet = true;
      tipp("👻 " + geist.name + " ist schon im Ziel – gib Gas!", 3500);
    }
  }

  /* =========================================================================
     7) FAHRT STARTEN / BEENDEN + HUD
     ========================================================================= */
  function starteFahrt(wi, li, endlos) {
    FF.Klang.init();
    fahrtInfo = { weltIndex: wi, stufe: li, endlos: !!endlos };
    var fs = P.fahrzeuge[P.fahrzeug];
    fahrt = new FF.Fahrt({
      weltIndex: wi, stufe: li, endlos: !!endlos,
      fahrzeugId: P.fahrzeug, upgrades: fs.upgrades, schwierigkeit: S.einstellungen.schwierigkeit,
      bruchlandung: S.einstellungen.bruchlandung
    });
    // Geisterrennen: 1. Fahrt wird aufgezeichnet, 2. Fahrt sieht den Geist
    aufnahme = null; geist = null;
    if (spielModus === "duell" && duell) {
      if (duell.runde === 0) {
        aufnahme = new FF.Geist.Aufnahme({
          kind: S.aktiv, fahrzeugId: P.fahrzeug, upgrades: JSON.parse(JSON.stringify(fs.upgrades)),
          aussehen: aussehenVon(S.aktiv)
        });
      } else {
        var erster = duell.reihenfolge[0];
        geist = { obj: new FF.Geist.Geist(duell.aufnahme, fahrt.gelaende), kind: erster,
                  name: kindDef(erster).name, aussehen: duell.aufnahme.info.aussehen, vorne: null, zielGemeldet: false };
      }
    }
    partikel.liste.length = 0; texte.length = 0;
    wetter.setze(fahrt.welt.wetter, kamera);
    kameraNachfuehren(0, true);
    ausdruck = "normal"; ausdruckBis = 0;
    pausiert = false; ergebnisOffen = false;
    alleZeigerLos();
    modus = "fahrt";
    zeigeBildschirm("fahrt");
    $("hud-tank").classList.remove("knapp");
    var en = energie(fahrt.def);
    $("hud-tank-icon").textContent = en.icon;
    $("hud-tank").setAttribute("aria-label", en.name);
    $("hud-tank").classList.toggle("akku", !!fahrt.def.akku);
    $("hud-fortschritt").hidden = !!endlos;
    $("hud-strecke").hidden = !endlos;
    $("hud-geist-strecke").hidden = !(endlos && geist);
    $("hud-fortschritt-auto").src = kindBild(S.aktiv, 40, 40, "normal", true);
    $("hud-fortschritt-geist").hidden = !geist || !!endlos;
    if (geist) $("hud-fortschritt-geist").src = kindBild(geist.kind, 40, 40, "normal", true);
    FF.Klang.motorStart(fahrt.def.klang);
    var w = fahrt.welt;
    // Kaum Schwerkraft: schon wenig Gas hebt die Nase (besonders beim Trecker) – gleich sagen
    var mondHinweis = w.schwerkraft < 3 ? " Auf dem Mond nur sanft Gas geben!" : "";
    if (geist) {
      meldung("👻 Gegen " + genitiv(geist.name) + " Geist!");
      FF.Klang.sprich("Los, " + kindDef(S.aktiv).name + "! Fahr gegen " + genitiv(geist.name) + " Geist!" + mondHinweis);
    } else {
      meldung(endlos ? "♾️ Wie weit kommst du?" : w.emoji + " " + w.name + " " + (li + 1));
      FF.Klang.sprich((spielModus === "duell" ? "Los, " + kindDef(S.aktiv).name + "!" : (endlos ? "Wie weit kommst du?" : "Los geht's!")) + mondHinweis);
    }
    if (mondHinweis) tipp("🌙 Kaum Schwerkraft: nur sanft Gas geben – sonst kippt das Auto nach hinten!", 5000);
    if (H > B) { $("hochkant-hinweis").hidden = false; setTimeout(function () { $("hochkant-hinweis").hidden = true; }, 4500); }
    hudCache = {};
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
    var es = fahrt.extraStand();
    var schluessel = es.boost + "|" + Math.round(es.boostAn * 40) + "|" + es.federSalti;
    if (erzwingen || hudCache.ex !== schluessel) {
      hudCache.ex = schluessel;
      var kb = $("knopf-boost"), kf = $("knopf-feder");
      kb.style.setProperty("--ladung", es.boostAn > 0 ? es.boostAn : (es.boost > 0 ? 1 : 0));
      kb.classList.toggle("bereit", es.boost > 0 && es.boostAn === 0);
      kb.classList.toggle("an", es.boostAn > 0);
      $("boost-zahl").hidden = es.boost < 2;
      $("boost-zahl").textContent = "×" + es.boost;
      kf.style.setProperty("--ladung", es.feder);
      kf.classList.toggle("bereit", es.feder >= 1);
      $("feder-zahl").hidden = es.federSalti === 0 || es.feder >= 1;
      $("feder-zahl").textContent = es.federSalti + "/" + es.federNoetig;
    }
    if (fahrt.endlos) {
      var s = Math.max(0, Math.round(fahrt.strecke));
      if (erzwingen || hudCache.s !== s) { $("hud-strecke-wert").textContent = zahl(s) + " m"; hudCache.s = s; }
      if (geist) {
        var gs = Math.max(0, Math.round(geist.obj.strecke));
        if (erzwingen || hudCache.gs !== gs) { $("hud-geist-strecke-wert").textContent = geist.name + " " + zahl(gs) + " m"; hudCache.gs = gs; }
      }
    } else {
      var p = Math.round(fahrt.fortschritt() * 1000) / 10;
      if (erzwingen || hudCache.p !== p) {
        $("hud-fortschritt-balken").style.width = p + "%";
        $("hud-fortschritt-auto").style.left = p + "%";
        hudCache.p = p;
      }
      if (geist) {
        var gp = Math.round(klemme(geist.obj.fz.chassis.x / fahrt.gelaende.ziel, 0, 1) * 1000) / 10;
        if (erzwingen || hudCache.gp !== gp) { $("hud-fortschritt-geist").style.left = gp + "%"; hudCache.gp = gp; }
      }
    }
  }

  function pause() {
    if (modus !== "fahrt" || pausiert || ergebnisOffen) return;
    pausiert = true;
    alleZeigerLos();
    FF.Klang.motorSetze({ stumm: true });
    $("knopf-menue").textContent = spielModus === "duell" ? "🏠 Rennen abbrechen" : "🏠 Zum Menü";
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
    duell = null;
    zeigeMenue("fahren");
    if (g > 0) popover("🪙 +" + zahl(g) + " Münzen gespeichert!");
  });

  /* Bei Abbruch dürfen die Münzen behalten werden */
  function gutschreibenAbbruch() {
    if (!fahrt || fahrt.gutgeschrieben) return 0;
    var g = fahrt.muenzen + fahrt.bonus;
    fahrt.gutgeschrieben = true;
    P.muenzen += g; P.statistik.muenzen += g;
    if (fahrt.endlos) P.endlos[fahrt.welt.id] = Math.max(P.endlos[fahrt.welt.id] || 0, Math.round(fahrt.strecke));
    speichere();
    return g;
  }

  /* Ergebnis einer Fahrt auf das Profil buchen. Rückgabe: neuer Endlos-Rekord? */
  function verbucheFahrt(e, prof) {
    var wi = fahrtInfo.weltIndex, li = fahrtInfo.stufe, welt = C.welten[wi];
    prof.muenzen += e.gesamt;
    prof.statistik.fahrten++; prof.statistik.meter += e.strecke; prof.statistik.salti += e.salti; prof.statistik.muenzen += e.gesamt;
    var rekord = false;
    if (e.endlos) {
      rekord = e.strecke > (prof.endlos[welt.id] || 0);
      prof.endlos[welt.id] = Math.max(prof.endlos[welt.id] || 0, e.strecke);
    } else {
      var k = levelSchluessel(wi, li), alt = prof.level[k] || { geschafft: false, sterne: 0, beste: 0 };
      if (e.ziel) { alt.geschafft = true; alt.sterne = Math.max(alt.sterne, e.sterne); }
      alt.beste = Math.max(alt.beste || 0, e.strecke);
      prof.level[k] = alt;
    }
    speichere();
    return rekord;
  }

  /* Eine Fahrt ist zu Ende (Ziel oder Tank leer) */
  function fahrtZuEnde() {
    if (!fahrt || ergebnisOffen) return;
    if (pausiert) { schliesseModal("pause"); pausiert = false; }
    ergebnisOffen = true;
    alleZeigerLos();
    FF.Klang.motorSetze({ stumm: true });
    if (spielModus === "duell" && duell) duellRundeFertig();
    else zeigeErgebnis();
  }

  document.addEventListener("visibilitychange", function () {
    if (document.hidden) { if (modus === "fahrt") pause(); FF.Klang.motorSetze({ stumm: true }); }
  });

  /* =========================================================================
     8) ERGEBNIS (allein)
     ========================================================================= */
  /* Wohin führt "Weiter"? Nach Level 3 in die nächste Welt – das Profi-Level ist
     freiwillig und wird nur als zweiter Knopf angeboten (in der letzten Welt
     gibt es danach nur noch das Profi-Level). */
  function naechstesLevel(wi, li) {
    if (li < PROFI - 1) return [wi, li + 1];
    if (wi < C.welten.length - 1) return [wi + 1, 0];
    if (li < PROFI) return [wi, PROFI];
    return null;
  }

  function zeigeErgebnis() {
    var e = fahrt.ergebnis(), wi = fahrtInfo.weltIndex, li = fahrtInfo.stufe, welt = fahrt.welt;
    fahrt.gutgeschrieben = true;
    var rekord = verbucheFahrt(e, P);

    var titel, icon;
    if (e.ziel) { titel = "Ziel erreicht!"; icon = "🏆"; }
    else if (e.endlos) { titel = rekord ? "Neuer Rekord!" : "Super gefahren!"; icon = rekord ? "🥇" : "📏"; }
    else { titel = energie(fahrt.def).ergebnis; icon = energie(fahrt.def).icon; }
    $("ergebnis-titel").textContent = titel;
    $("ergebnis-icon").textContent = icon;
    $("ergebnis-fiete").src = kindBild(S.aktiv, 120, 130, e.ziel || rekord ? "freude" : "normal");

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
    if (e.ziel) zeilen.push(["⏱️ Zeit", sekunden(e.zielZeit)]);
    if (e.salti > 0) zeilen.push(["🔄 Saltos", e.salti]);
    if (e.hoppla > 0) zeilen.push(["🎈 Ballon-Hilfen", e.hoppla]);
    if (!e.endlos) zeilen.push(["⭐ Münzen-Anteil", Math.round(e.anteil * 100) + " %"]);
    $("ergebnis-liste").innerHTML = zeilen.map(function (z) { return "<li><span>" + z[0] + "</span><b>" + z[1] + "</b></li>"; }).join("");

    zaehleHoch($("ergebnis-summe"), e.gesamt);

    var tippText = "";
    if (!e.ziel && !e.endlos) tippText = "Tipp: In der Garage 🔧 " + energie(fahrt.def).garage + " oder den Motor verbessern – dann kommst du weiter!";
    else if (e.ziel && e.sterne < 3) tippText = "Sammle " + Math.round(C.regeln.sterne3 * 100) + " % der Münzen für alle 3 Sterne!";
    else if (e.ziel) tippText = "Perfekt! Alle Sterne! 🌟";
    else if (e.endlos) tippText = "Bester Wert hier: " + zahl(P.endlos[welt.id]) + " m";
    $("ergebnis-tipp").textContent = tippText;

    var nl = naechstesLevel(wi, li);
    var weiterKnopf = $("knopf-ergebnis-weiter"), nochmalKnopf = $("knopf-ergebnis-nochmal");
    // Level 3 geschafft: Profi-Level als freiwillige zweite Wahl
    $("knopf-ergebnis-profi").hidden = !(e.ziel && li === PROFI - 1 && nl && nl[1] !== PROFI && levelOffen(wi, PROFI));
    if (e.ziel && nl && levelOffen(nl[0], nl[1])) {
      weiterKnopf.textContent = nl[0] !== wi ? "▶️ Neue Welt: " + C.welten[nl[0]].emoji : (nl[1] === PROFI ? "🔥 Profi-Level" : "▶️ Nächstes Level");
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

  function zaehleHoch(el, ziel) {
    var start = performance.now(), dauer = Math.min(1600, 300 + ziel * 0.6);
    (function zaehle(t) {
      var u = Math.min(1, (t - start) / dauer);
      el.textContent = zahl(ziel * (1 - Math.pow(1 - u, 3)));
      if (u < 1) { if (Math.random() < 0.35) FF.Klang.spiele("zaehlen"); requestAnimationFrame(zaehle); }
    })(start);
  }

  $("knopf-ergebnis-weiter").addEventListener("click", function () {
    FF.Klang.spiele("klick");
    schliesseModal("ergebnis");
    var z = this.dataset.ziel;
    if (z === "nochmal") starteFahrt(fahrtInfo.weltIndex, fahrtInfo.stufe, fahrtInfo.endlos);
    else { var t = z.split(",").map(Number); starteFahrt(t[0], t[1], false); }
  });
  $("knopf-ergebnis-profi").addEventListener("click", function () {
    FF.Klang.spiele("klick");
    schliesseModal("ergebnis");
    starteFahrt(fahrtInfo.weltIndex, PROFI, false);
  });
  $("knopf-ergebnis-nochmal").addEventListener("click", function () {
    FF.Klang.spiele("klick");
    schliesseModal("ergebnis");
    starteFahrt(fahrtInfo.weltIndex, fahrtInfo.stufe, fahrtInfo.endlos);
  });
  $("knopf-ergebnis-garage").addEventListener("click", function () { FF.Klang.spiele("klick"); schliesseModal("ergebnis"); zeigeMenue("garage"); });
  $("knopf-ergebnis-menue").addEventListener("click", function () { FF.Klang.spiele("klick"); schliesseModal("ergebnis"); zeigeMenue("fahren"); });

  /* =========================================================================
     9) SPIELERWAHL, MENÜ, WELTEN
     ========================================================================= */
  function zeigeBildschirm(name) {
    $("titelscreen").hidden = name !== "titel";
    $("spielerwahl").hidden = name !== "wahl";
    $("menue").hidden = name !== "menue";
    $("hud").hidden = name !== "fahrt";
    $("pedale").hidden = name !== "fahrt";
    $("extras").hidden = name !== "fahrt";
    pedaleLuft = false; $("pedale").classList.remove("luft");
    if (name !== "fahrt") {
      $("meldung").hidden = true; $("tipp").hidden = true; $("hochkant-hinweis").hidden = true;
      FF.Klang.motorStopp();
      fahrt = null; aufnahme = null; geist = null;
    }
  }

  /* "Wer fährt?" – Fiete, Jonte oder zu zweit */
  function zeigeSpielerwahl() {
    modus = "wahl";
    duell = null;
    zeigeBildschirm("wahl");
    var html = "";
    C.kinder.forEach(function (k) {
      var prof = S.spieler[k.id];
      html += '<button type="button" class="wahl-karte" data-kind="' + k.id + '">' +
              '<img class="wahl-bild" src="' + kindBild(k.id, 130, 140, "freude") + '" alt="">' +
              '<span class="wahl-name">' + k.name + "</span>" +
              '<span class="wahl-info">🪙 ' + zahl(prof.muenzen) + " · ⭐ " + sterneSumme(prof) + "</span></button>";
    });
    html += '<button type="button" class="wahl-karte zu-zweit" data-zuzweit="1">' +
            '<span class="wahl-paar">' + C.kinder.map(function (k) {
              return '<img src="' + kindBild(k.id, 70, 70, "freude", true) + '" alt="">';
            }).join("") + "</span>" +
            '<span class="wahl-name">Zu zweit</span><span class="wahl-info">👻 Geisterrennen</span></button>';
    var el = $("spielerwahl-karten");
    el.innerHTML = html;
    el.querySelectorAll(".wahl-karte").forEach(function (b) {
      b.addEventListener("click", function () {
        FF.Klang.init(); FF.Klang.spiele("klick");
        if (b.dataset.zuzweit) {
          spielModus = "duell";
          FF.Klang.sprich("Geisterrennen zu zweit!");
        } else {
          spielModus = "solo";
          setzeAktiv(b.dataset.kind);
          speichere();
          FF.Klang.sprich("Hallo " + kindDef(b.dataset.kind).name + "!");
        }
        zeigeMenue("fahren");
      });
    });
  }

  var aktiverTab = "fahren";
  function zeigeMenue(tab) {
    modus = "menue";
    zeigeBildschirm("menue");
    var tabFahren = spielModus === "duell" ? ["👫", "Rennen"] : ["🏁", "Fahren"];
    $("tab-knopf-fahren").innerHTML = tabFahren[0] + '<span class="tab-wort"> ' + tabFahren[1] + "</span>";
    $("tab-knopf-fahren").setAttribute("aria-label", tabFahren[1]);
    waehleTab(tab || aktiverTab);
    kontoAktualisieren();
  }

  function waehleTab(tab) {
    aktiverTab = tab;
    ["fahren", "garage"].forEach(function (t) {
      $("tab-" + t).hidden = t !== tab;
      $("tab-knopf-" + t).classList.toggle("aktiv", t === tab);
    });
    var duo = spielModus === "duell";
    $("fahrzeug-leiste").hidden = duo;
    $("welten-liste").hidden = duo;
    $("duell-lobby").hidden = !duo;
    $("garage-kinder").hidden = !duo;
    $("konto").hidden = duo && tab === "fahren";       // in der Lobby zeigt jedes Kind seine Münzen selbst
    if (tab === "fahren") { if (duo) baueLobby(); else baueWelten(); }
    else { garageIndex = indexVon(P.fahrzeug); baueGarage(); }
    kontoAktualisieren();
    groesseAnpassen();
  }
  document.querySelectorAll(".tab").forEach(function (t) {
    t.addEventListener("click", function () { FF.Klang.spiele("klick"); waehleTab(t.dataset.tab); });
  });

  function kontoAktualisieren() { $("konto-wert").textContent = zahl(P.muenzen); }
  $("konto").addEventListener("click", function () {
    popover("🪙 " + zahl(P.muenzen) + " Münzen von " + kindDef(S.aktiv).name +
            "<small>Damit kaufst du in der Garage neue Teile, Farben, Outfits und Fahrzeuge.</small>");
  });

  function baueFahrzeugLeiste() {
    var el = $("fahrzeug-leiste");
    var html = '<button type="button" class="fiete-chip wechsel" data-wahl="1" aria-label="Wer fährt? Kind wechseln">' +
               '<img src="' + kindBild(S.aktiv, 44, 44, "normal", true) + '" alt="' + kindDef(S.aktiv).name + '"></button>' +
               '<span class="fahrzeug-leiste-titel">' + kindDef(S.aktiv).name + " fährt:</span>";
    C.fahrzeuge.forEach(function (f) {
      if (!P.fahrzeuge[f.id].gekauft) return;
      html += '<button type="button" class="fz-chip' + (P.fahrzeug === f.id ? " aktiv" : "") + '" data-fz="' + f.id + '">' +
              '<span class="fz-emoji">' + f.emoji + "</span>" + f.name + "</button>";
    });
    html += '<button type="button" class="fz-chip" data-garage="1"><span class="fz-emoji">🔧</span>Garage</button>';
    el.innerHTML = html;
    el.querySelectorAll(".fz-chip, .fiete-chip").forEach(function (b) {
      b.addEventListener("click", function () {
        FF.Klang.spiele("klick");
        if (b.dataset.wahl) { zeigeSpielerwahl(); return; }
        if (b.dataset.garage) { waehleTab("garage"); return; }
        P.fahrzeug = b.dataset.fz; speichere(); baueFahrzeugLeiste();
      });
    });
  }

  function baueWelten() {
    baueFahrzeugLeiste();
    var el = $("welten-liste"), html = "";
    var naechstes = null;
    // Sichtbar machen, wenn der Entwickler-Schalter alles geöffnet hat
    if (S.entwickler.alleOffen) {
      html += '<div class="entwickler-hinweis">🛠️ Entwickler-Modus: alle Level offen' +
              '<button type="button" id="dev-alle-zu">Ausschalten</button></div>';
    }
    C.welten.forEach(function (w, wi) {
      for (var li = 0; li < PROFI && !naechstes; li++) if (levelOffen(wi, li) && !levelStand(wi, li).geschafft) naechstes = wi + "," + li;
    });
    C.welten.forEach(function (w, wi) {
      var offen = levelOffen(wi, 0), sterne = 0, n = w.level.length;
      for (var li = 0; li < n; li++) sterne += levelStand(wi, li).sterne || 0;
      html += '<div class="welt-karte' + (offen ? "" : " gesperrt") + '">' +
        '<div class="welt-kopf" style="background:linear-gradient(135deg,' + w.farben.himmel[0] + "," + w.farben.berge[1] + ' 70%,' + w.farben.boden[0] + ')">' +
        '<span class="welt-emoji">' + w.emoji + "</span><div><div class=\"welt-name\">" + w.name + "</div>" +
        '<div class="welt-hinweis">' + w.hinweis + "</div></div>" +
        '<span class="welt-sterne">⭐ ' + sterne + "/" + 3 * n + "</span></div>" +
        '<div class="welt-level">';
      for (li = 0; li < n; li++) {
        var o = levelOffen(wi, li), ls = levelStand(wi, li), kl = "level-knopf", profi = li === PROFI;
        if (!o) kl += " gesperrt";
        if (profi) kl += " profi";
        if (naechstes === wi + "," + li) kl += " naechstes";
        var st = "";
        for (var k = 0; k < 3; k++) st += '<span class="' + (k < ls.sterne ? "an" : "") + '">★</span>';
        html += '<button type="button" class="' + kl + '" data-welt="' + wi + '" data-level="' + li + '" aria-label="' + (profi ? "Profi-Level " : "Level ") + (li + 1) + '">' +
                (o ? (profi ? "🔥" : li + 1) : "🔒") + '<span class="level-sterne">' + st + "</span></button>";
      }
      var eo = endlosOffen(wi), best = P.endlos[w.id] || 0;
      html += '<button type="button" class="level-knopf endlos' + (eo ? "" : " gesperrt") + '" data-welt="' + wi + '" data-endlos="1" aria-label="Endlos fahren">' +
              (eo ? "♾️" : "🔒") + "<small>" + (eo ? (best ? zahl(best) + " m" : "Endlos") : "Endlos") + "</small></button>";
      html += "</div></div>";
    });
    el.innerHTML = html;
    if ($("dev-alle-zu")) $("dev-alle-zu").addEventListener("click", function () {
      FF.Klang.spiele("klick");
      S.entwickler.alleOffen = false;
      speichere(); entwicklerAnzeigen(); baueWelten();
    });
    el.querySelectorAll(".level-knopf").forEach(function (b) {
      b.addEventListener("click", function () {
        var wi = +b.dataset.welt, li = +(b.dataset.level || 0), endlos = !!b.dataset.endlos;
        if (endlos ? !endlosOffen(wi) : !levelOffen(wi, li)) {
          FF.Klang.spiele("fehler");
          wackeln(b);
          popover(endlos ? "🔒 Schaffe zuerst Level 1 dieser Welt!" : "🔒 Schaffe zuerst das Level davor!");
          return;
        }
        FF.Klang.spiele("klick");
        starteFahrt(wi, li, endlos);
      });
    });
  }

  /* =========================================================================
     10) GEISTERRENNEN ZU ZWEIT
     Ablauf: Lobby (Autos + Strecke) → wer fängt an (wählen oder würfeln) →
     Übergabe → Fahrt 1 (wird aufgezeichnet) → Übergabe → Fahrt 2 gegen den
     Geist → Siegerehrung → Revanche (andere Reihenfolge).
     ========================================================================= */
  function stueckOffen(wi, li, endlos) {
    return C.kinder.some(function (k) {
      var p = S.spieler[k.id];
      return endlos ? endlosOffen(wi, p) : levelOffen(wi, li, p);
    });
  }

  function siegStand() {
    var a = C.kinder[0], b = C.kinder[1];
    return "🏆 " + a.name + " " + (S.duell.siege[a.id] || 0) + " : " + (S.duell.siege[b.id] || 0) + " " + b.name;
  }

  function baueLobby() {
    var D = S.duell;
    if (!stueckOffen(D.welt, D.stufe, D.endlos)) { D.welt = 0; D.stufe = 0; D.endlos = false; }
    $("duell-spielerwahl").innerHTML = C.kinder.map(function (k) {
      return '<img src="' + kindBild(k.id, 40, 40, "normal", true) + '" alt="">';
    }).join("");
    $("duell-stand").textContent = siegStand();

    // Die beiden Kinder mit ihren Autos
    $("duell-spieler").innerHTML = C.kinder.map(function (k) {
      var prof = S.spieler[k.id];
      var autos = C.fahrzeuge.filter(function (f) { return prof.fahrzeuge[f.id].gekauft; }).map(function (f) {
        return '<button type="button" class="fz-chip' + (prof.fahrzeug === f.id ? " aktiv" : "") + '" data-kind="' + k.id + '" data-fz="' + f.id + '">' +
               '<span class="fz-emoji">' + f.emoji + "</span>" + f.name + "</button>";
      }).join("");
      return '<div class="duell-kind">' +
             '<img class="duell-kind-bild" src="' + kindBild(k.id, 80, 88, "normal") + '" alt="">' +
             '<div class="duell-kind-info"><b>' + k.name + '</b><span>🪙 ' + zahl(prof.muenzen) + "</span>" +
             '<button type="button" class="klein-knopf" data-garage-kind="' + k.id + '">🔧 ' + genitiv(k.name) + " Garage</button></div>" +
             '<div class="duell-autos">' + autos + "</div></div>";
    }).join("");
    $("duell-spieler").querySelectorAll("[data-fz]").forEach(function (b) {
      b.addEventListener("click", function () {
        FF.Klang.spiele("klick");
        S.spieler[b.dataset.kind].fahrzeug = b.dataset.fz; speichere(); baueLobby();
      });
    });
    $("duell-spieler").querySelectorAll("[data-garage-kind]").forEach(function (b) {
      b.addEventListener("click", function () {
        FF.Klang.spiele("klick");
        setzeAktiv(b.dataset.garageKind);
        waehleTab("garage");
      });
    });

    // Strecke: Welt + Level (offen, wenn EINES der Kinder es freigespielt hat)
    $("duell-welten").innerHTML = C.welten.map(function (w, wi) {
      var offen = stueckOffen(wi, 0, false);
      return '<button type="button" class="welt-chip' + (D.welt === wi ? " aktiv" : "") + (offen ? "" : " gesperrt") +
             '" data-welt="' + wi + '" style="--welt-farbe:' + w.farben.himmel[0] + '">' + w.emoji + " " + (offen ? w.name : "🔒") + "</button>";
    }).join("");
    $("duell-welten").querySelectorAll(".welt-chip").forEach(function (b) {
      b.addEventListener("click", function () {
        var wi = +b.dataset.welt;
        if (!stueckOffen(wi, 0, false)) { FF.Klang.spiele("fehler"); wackeln(b); popover("🔒 Diese Welt hat noch keiner von euch erreicht!"); return; }
        FF.Klang.spiele("klick");
        D.welt = wi; D.stufe = 0; D.endlos = false; speichere(); baueLobby();
      });
    });
    var lv = "";
    for (var li = 0; li < C.welten[D.welt].level.length; li++) {
      var o = stueckOffen(D.welt, li, false);
      lv += '<button type="button" class="level-knopf' + (!D.endlos && D.stufe === li ? " gewaehlt" : "") + (o ? "" : " gesperrt") +
            (li === PROFI ? " profi" : "") + '" data-level="' + li + '" aria-label="' + (li === PROFI ? "Profi-Level " : "Level ") + (li + 1) + '">' +
            (o ? (li === PROFI ? "🔥" : li + 1) : "🔒") + "</button>";
    }
    var eo = stueckOffen(D.welt, 0, true);
    lv += '<button type="button" class="level-knopf endlos' + (D.endlos ? " gewaehlt" : "") + (eo ? "" : " gesperrt") +
          '" data-endlos="1">' + (eo ? "♾️" : "🔒") + "<small>Wer kommt weiter?</small></button>";
    $("duell-level").innerHTML = lv;
    $("duell-level").querySelectorAll(".level-knopf").forEach(function (b) {
      b.addEventListener("click", function () {
        var endlos = !!b.dataset.endlos, li = +(b.dataset.level || 0);
        if (!stueckOffen(D.welt, li, endlos)) {
          FF.Klang.spiele("fehler"); wackeln(b);
          popover(endlos ? "🔒 Schafft zuerst Level 1 dieser Welt!" : "🔒 Dieses Level hat noch keiner von euch geschafft!");
          return;
        }
        FF.Klang.spiele("klick");
        D.endlos = endlos; D.stufe = endlos ? 0 : li; speichere(); baueLobby();
      });
    });

    // Wer fährt zuerst? Selbst wählen oder würfeln
    $("duell-start").innerHTML = C.kinder.map(function (k) {
      return '<button type="button" class="start-knopf" data-erster="' + k.id + '">' +
             '<img src="' + kindBild(k.id, 52, 52, "freude", true) + '" alt=""><span>' + k.name + "</span></button>";
    }).join("") + '<button type="button" class="start-knopf wuerfel-knopf" data-wuerfeln="1"><span class="wuerfel-icon">🎲</span><span>Würfeln</span></button>';
    $("duell-start").querySelectorAll(".start-knopf").forEach(function (b) {
      b.addEventListener("click", function () {
        FF.Klang.init(); FF.Klang.spiele("klick");
        if (b.dataset.wuerfeln) wuerfeln();
        else starteDuell(b.dataset.erster);
      });
    });
  }
  $("duell-spielerwahl").addEventListener("click", function () { FF.Klang.spiele("klick"); zeigeSpielerwahl(); });

  /* Garage im Duell: zwischen den Kindern umschalten */
  function baueGarageKinder() {
    var el = $("garage-kinder");
    el.innerHTML = '<span class="garage-kinder-titel">Wessen Garage?</span>' + C.kinder.map(function (k) {
      return '<button type="button" class="garage-kind' + (S.aktiv === k.id ? " aktiv" : "") + '" data-kind="' + k.id + '">' +
             '<img src="' + kindBild(k.id, 40, 40, "normal", true) + '" alt="">' + k.name + "</button>";
    }).join("") + '<button type="button" class="garage-kind zurueck" data-zurueck="1">👫 Zum Rennen</button>';
    el.querySelectorAll(".garage-kind").forEach(function (b) {
      b.addEventListener("click", function () {
        FF.Klang.spiele("klick");
        if (b.dataset.zurueck) { waehleTab("fahren"); return; }
        setzeAktiv(b.dataset.kind);
        garageIndex = indexVon(P.fahrzeug);
        baueGarage(); kontoAktualisieren();
      });
    });
  }

  /* Würfeln: Jedes Kind würfelt, die höhere Zahl fängt an (bei Gleichstand nochmal) */
  var AUGEN = { 1: [4], 2: [0, 8], 3: [0, 4, 8], 4: [0, 2, 6, 8], 5: [0, 2, 4, 6, 8], 6: [0, 2, 3, 5, 6, 8] };
  function wuerfelHtml(wert) {
    var s = "";
    for (var i = 0; i < 9; i++) s += '<span class="' + (AUGEN[wert].indexOf(i) >= 0 ? "an" : "") + '"></span>';
    return s;
  }
  var wuerfelLaeuft = false;
  function wuerfeln() {
    if (wuerfelLaeuft) return;
    wuerfelLaeuft = true;
    $("wuerfel-reihe").innerHTML = C.kinder.map(function (k) {
      return '<div class="wuerfel-spalte"><img src="' + kindBild(k.id, 60, 60, "normal", true) + '" alt="">' +
             '<span class="wuerfel-name">' + k.name + '</span><div class="wuerfel rollt" id="wuerfel-' + k.id + '">' + wuerfelHtml(1) + "</div></div>";
    }).join("");
    $("wuerfel-text").textContent = "Die Würfel rollen …";
    oeffneModal("wuerfeln");
    FF.Klang.sprich("Wer fängt an?");
    var runde = function () {
      var t0 = performance.now(), werte = {};
      var tick = setInterval(function () {
        C.kinder.forEach(function (k) {
          werte[k.id] = 1 + Math.floor(Math.random() * 6);
          var w = $("wuerfel-" + k.id);
          w.innerHTML = wuerfelHtml(werte[k.id]);
          w.classList.add("rollt");
        });
        FF.Klang.spiele("zaehlen");
        if (performance.now() - t0 > 1300) {
          clearInterval(tick);
          C.kinder.forEach(function (k) { $("wuerfel-" + k.id).classList.remove("rollt"); });
          FF.Klang.spiele("stern", 1);
          var a = C.kinder[0], b = C.kinder[1];
          if (werte[a.id] === werte[b.id]) {
            $("wuerfel-text").textContent = "Beide " + werte[a.id] + " – nochmal! 🎲";
            setTimeout(runde, 1100);
            return;
          }
          var erster = werte[a.id] > werte[b.id] ? a : b;
          $("wuerfel-text").innerHTML = "<b>" + erster.name + "</b> würfelt die " + werte[erster.id] + " und fängt an! 🎉";
          FF.Klang.sprich(erster.name + " fängt an!");
          setTimeout(function () {
            schliesseModal("wuerfeln");
            wuerfelLaeuft = false;
            starteDuell(erster.id);
          }, 1900);
        }
      }, 90);
    };
    runde();
  }

  function starteDuell(erster) {
    var D = S.duell;
    duell = { welt: D.welt, stufe: D.stufe, endlos: D.endlos, reihenfolge: [erster, anderesKind(erster)],
              runde: 0, aufnahme: null, ergebnisse: [] };
    zeigeUebergabe();
  }

  function ergebnisText(e) {
    return e.ziel ? "🏁 " + sekunden(e.zielZeit) : "📏 " + zahl(e.strecke) + " m";
  }

  /* "Jetzt ist … dran!" – damit das Gerät in Ruhe weitergegeben werden kann */
  function zeigeUebergabe() {
    var kid = duell.reihenfolge[duell.runde], name = kindDef(kid).name;
    var erster = kindDef(duell.reihenfolge[0]).name, zweiter = kindDef(duell.reihenfolge[1]).name;
    var vorher = $("uebergabe-vorher");
    if (duell.runde === 1) {
      var e0 = duell.ergebnisse[0];
      vorher.innerHTML = "<b>" + erster + "</b> ist fertig: " + ergebnisText(e0) + " · 🪙 +" + zahl(e0.gesamt);
      vorher.hidden = false;
    } else vorher.hidden = true;
    $("uebergabe-bild").src = kindBild(kid, 140, 150, "freude");
    $("uebergabe-titel").textContent = "👉 " + name + " ist dran!";
    $("uebergabe-text").textContent = duell.runde === 0
      ? "Danach fährt " + zweiter + " gegen deinen Geist 👻"
      : "Fahr gegen " + genitiv(erster) + " Geist 👻 – " + (duell.endlos ? "wer kommt weiter?" : "wer ist schneller?");
    $("knopf-uebergabe-los").textContent = "▶️ Los, " + name + "!";
    oeffneModal("uebergabe");
    FF.Klang.sprich(name + " ist dran!");
  }
  $("knopf-uebergabe-los").addEventListener("click", function () {
    if (!duell) return;
    FF.Klang.init(); FF.Klang.spiele("klick");
    schliesseModal("uebergabe");
    setzeAktiv(duell.reihenfolge[duell.runde]);
    starteFahrt(duell.welt, duell.stufe, duell.endlos);
  });
  $("knopf-uebergabe-abbruch").addEventListener("click", function () {
    FF.Klang.spiele("klick");
    schliesseModal("uebergabe");
    duell = null;
    zeigeMenue("fahren");
  });

  function duellRundeFertig() {
    var e = fahrt.ergebnis();
    fahrt.gutgeschrieben = true;
    verbucheFahrt(e, P);
    duell.ergebnisse[duell.runde] = e;
    if (duell.runde === 0) {
      aufnahme.abschliessen(fahrt, ausdruck);
      duell.aufnahme = aufnahme;
      duell.runde = 1;
      FF.Klang.motorStopp();
      zeigeUebergabe();
    } else {
      FF.Klang.motorStopp();
      zeigeDuellErgebnis();
    }
  }

  function zeigeDuellErgebnis() {
    var r = duell.reihenfolge, e = duell.ergebnisse;
    var sieger = FF.Geist.vergleiche(e[0], e[1]);           // 0, 1 oder -1 (unentschieden)
    var bonus = C.regeln.siegBonus, plus = [e[0].gesamt, e[1].gesamt];
    if (sieger >= 0) {
      S.spieler[r[sieger]].muenzen += bonus; plus[sieger] += bonus;
      S.duell.siege[r[sieger]] = (S.duell.siege[r[sieger]] || 0) + 1;
    } else {
      [0, 1].forEach(function (i) { S.spieler[r[i]].muenzen += Math.round(bonus / 2); plus[i] += Math.round(bonus / 2); });
    }
    speichere();

    var titel = sieger < 0 ? "🤝 Unentschieden!" : "🏆 " + kindDef(r[sieger]).name + " gewinnt!";
    $("duell-ergebnis-titel").textContent = titel;
    var reihe = sieger === 1 ? [1, 0] : [0, 1];               // Sieger links
    $("duell-podest").innerHTML = reihe.map(function (i) {
      var gewonnen = sieger === i || sieger < 0, k = kindDef(r[i]);
      return '<div class="podest-platz' + (sieger === i ? " sieger" : "") + '">' +
             (sieger === i ? '<span class="podest-krone">👑</span>' : "") +
             '<img src="' + kindBild(k.id, 110, 120, gewonnen ? "freude" : "normal") + '" alt="">' +
             '<b class="podest-name">' + k.name + "</b>" +
             '<span class="podest-wert">' + ergebnisText(e[i]) + "</span>" +
             '<span class="podest-muenzen">🪙 +' + zahl(plus[i]) + "</span>" +
             '<span class="podest-lob">' + (sieger === i ? "Sieger! 🎉" : (sieger < 0 ? "Gleich gut! 🤝" : "Super gekämpft! 💪")) + "</span></div>";
    }).join("");
    $("duell-ergebnis-stand").textContent = siegStand();
    oeffneModal("duell-ergebnis");
    FF.Klang.spiele("ziel");
    konfetti(80);
    FF.Klang.sprich(sieger < 0 ? "Unentschieden! Ihr seid beide super!" : kindDef(r[sieger]).name + " gewinnt! Super gemacht, ihr beiden!");
  }

  $("knopf-revanche").addEventListener("click", function () {
    FF.Klang.spiele("klick");
    schliesseModal("duell-ergebnis");
    starteDuell(duell.reihenfolge[1]);                        // diesmal fängt das andere Kind an
  });
  $("knopf-duell-strecke").addEventListener("click", function () {
    FF.Klang.spiele("klick"); schliesseModal("duell-ergebnis"); duell = null; zeigeMenue("fahren");
  });
  $("knopf-duell-garage").addEventListener("click", function () {
    FF.Klang.spiele("klick"); schliesseModal("duell-ergebnis"); duell = null; zeigeMenue("garage");
  });
  $("knopf-duell-menue").addEventListener("click", function () {
    FF.Klang.spiele("klick"); schliesseModal("duell-ergebnis"); zeigeSpielerwahl();
  });

  /* =========================================================================
     11) GARAGE: Fahrzeuge, Tuning, Outfit, Farben, Muster (je Kind)
     ========================================================================= */
  var garageIndex = 0;
  function indexVon(id) { for (var i = 0; i < C.fahrzeuge.length; i++) if (C.fahrzeuge[i].id === id) return i; return 0; }

  function upgradePreis(def, key, stufe) {
    var U = C.upgrades[key];
    if (key === "allrad") return def.preisBasis * U.preisMal;
    return Math.round(def.preisBasis * Math.pow(U.faktor, stufe) / 10) * 10;
  }

  function kaufe(preis, aktion, el) {
    if (P.muenzen >= preis) {
      P.muenzen -= preis;
      aktion();
      speichere();
      FF.Klang.spiele("kauf");
      konfetti(25);
      kontoAktualisieren();
      baueGarage();
      return true;
    }
    FF.Klang.spiele("fehler");
    wackeln(el);
    popover("Dir fehlen noch 🪙 " + zahl(preis - P.muenzen) + "<small>Fahr los und sammle Münzen! 🏁</small>");
    FF.Klang.sprich("Dir fehlen noch " + Math.ceil(preis - P.muenzen) + " Münzen.");
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
      [def.akku ? "🔋 Akku" : "⛽ Tank", w.tankSekunden / 70],
      ["🤸 Saltos", w.luftsteuerung / 9]
    ];
  }

  function baueGarage() {
    if (spielModus === "duell") baueGarageKinder();
    var def = C.fahrzeuge[garageIndex], fs = P.fahrzeuge[def.id], name = kindDef(S.aktiv).name;
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
      if (P.fahrzeug === def.id) { aktion.textContent = "✅ Ausgewählt"; aktion.classList.add("ausgewaehlt"); }
      else aktion.textContent = "👉 Damit fahren";
    } else {
      aktion.textContent = "🪙 " + zahl(def.preis) + " – Kaufen";
      aktion.classList.add(P.muenzen >= def.preis ? "kaufen" : "zu-teuer");
    }

    // Tuning
    var ul = $("upgrade-liste"), html = "";
    def.upgrades.forEach(function (key) {
      var U = C.upgrades[key], stufe = fs.upgrades[key] || 0, voll = stufe >= U.stufen;
      if (key === "tank" && def.akku) U = { name: "Akku", icon: "🔋", text: "Größerer Akku – weiter fahren", stufen: U.stufen };
      var preis = voll ? 0 : upgradePreis(def, key, stufe);
      var punkte = "";
      for (var i = 0; i < U.stufen; i++) punkte += '<span class="' + (i < stufe ? "an" : "") + '"></span>';
      var knopfKlasse = "upgrade-kaufen" + (voll ? " voll" : (P.muenzen < preis ? " zu-teuer" : ""));
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
      var hat = P.farben.indexOf(f.id) >= 0;
      var bg = f.wert === "regenbogen" ? "conic-gradient(#ff5b5b,#ffd23f,#3cc35a,#2f6fd6,#8e5bd8,#ff5b5b)"
             : f.glanz ? "linear-gradient(135deg,#c9962a,#fff6c8,#d9a83a)" : f.wert;
      return '<button type="button" class="farb-knopf' + (fs.farbe === f.id ? " aktiv" : "") + (hat ? "" : " gesperrt") +
             '" data-farbe="' + f.id + '" data-preis="🪙' + zahl(f.preis) + '" style="background:' + bg + '" aria-label="' + f.name + '"></button>';
    }).join("");
    fl.querySelectorAll(".farb-knopf").forEach(function (b) {
      b.addEventListener("click", function () {
        var f = farbWert(b.dataset.farbe);
        if (P.farben.indexOf(f.id) < 0) {
          kaufe(f.preis, function () { P.farben.push(f.id); fs.farbe = f.id; }, b);
          return;
        }
        FF.Klang.spiele("klick");
        fs.farbe = f.id; speichere(); baueGarage();
      });
    });

    // Look (gratis, gilt überall): Fiete mit oder ohne Cap, Jonte mit Dutt oder offenen Haaren
    var looks = lookListe(S.aktiv), lookJetzt = lookVon(S.aktiv);
    $("look-titel").textContent = "💇 " + genitiv(name) + " Look";
    $("look-titel").hidden = $("look-liste").hidden = looks.length < 2;
    $("look-liste").innerHTML = looks.map(function (v) {
      return '<button type="button" class="outfit-knopf look-knopf' + (v.id === lookJetzt ? " aktiv" : "") +
             '" data-look="' + v.id + '" aria-label="' + v.name + '">' +
             '<img src="' + kindBild(S.aktiv, 70, 70, "freude", true, null, v.id) + '" alt=""></button>';
    }).join("");
    $("look-liste").querySelectorAll(".look-knopf").forEach(function (b) {
      b.addEventListener("click", function () {
        FF.Klang.spiele("klick");
        P.look = b.dataset.look; speichere(); baueGarage();
      });
    });

    // Outfit (gilt für alle Fahrzeuge) – nur Bilder, keine Namen
    $("outfit-titel").textContent = "🦸 " + genitiv(name) + " Outfit";
    var ol = $("outfit-liste");
    ol.innerHTML = C.outfits.map(function (o, i) {
      var hat = P.outfits.indexOf(o.id) >= 0;
      return '<button type="button" class="outfit-knopf' + (P.outfit === o.id ? " aktiv" : "") + (hat ? "" : " gesperrt") +
             '" data-outfit="' + o.id + '" aria-label="Outfit ' + (i + 1) + '">' +
             '<img src="' + kindBild(S.aktiv, 76, 84, "normal", false, o.id) + '" alt="">' +
             (hat ? "" : '<span class="preis">🪙' + zahl(o.preis) + "</span>") + "</button>";
    }).join("");
    ol.querySelectorAll(".outfit-knopf").forEach(function (b) {
      b.addEventListener("click", function () {
        var o = outfitWert(b.dataset.outfit);
        if (P.outfits.indexOf(o.id) < 0) {
          kaufe(o.preis, function () { P.outfits.push(o.id); P.outfit = o.id; }, b);
          return;
        }
        FF.Klang.spiele("klick");
        P.outfit = o.id; speichere(); baueGarage();
      });
    });

    // Muster
    var ml = $("muster-liste");
    ml.innerHTML = C.muster.map(function (m) {
      var hat = P.muster.indexOf(m.id) >= 0;
      return '<button type="button" class="muster-knopf' + (fs.muster === m.id ? " aktiv" : "") + '" data-muster="' + m.id + '">' +
             m.icon + " " + m.name + (hat ? "" : ' <span class="preis">🪙' + zahl(m.preis) + "</span>") + "</button>";
    }).join("");
    ml.querySelectorAll(".muster-knopf").forEach(function (b) {
      b.addEventListener("click", function () {
        var id = b.dataset.muster, m = C.muster.filter(function (x) { return x.id === id; })[0];
        if (P.muster.indexOf(id) < 0) {
          kaufe(m.preis, function () { P.muster.push(id); fs.muster = id; }, b);
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
  $("fz-motor").addEventListener("click", function () {
    FF.Klang.init();
    var def = C.fahrzeuge[garageIndex], v = $("vorschau");
    FF.Klang.motorProbe(def.klang, def.motor.vmax);
    plopp(this);
    v.classList.add("brummt");
    clearTimeout(v.brummTimer);
    v.brummTimer = setTimeout(function () { v.classList.remove("brummt"); }, 3600);
  });
  $("fz-aktion").addEventListener("click", function () {
    var def = C.fahrzeuge[garageIndex], fs = P.fahrzeuge[def.id];
    if (fs.gekauft) {
      FF.Klang.spiele("klick");
      P.fahrzeug = def.id; speichere(); baueGarage();
      popover(def.emoji + " " + kindDef(S.aktiv).name + " fährt jetzt mit dem " + def.name + "!", 1800);
      return;
    }
    kaufe(def.preis, function () { fs.gekauft = true; P.fahrzeug = def.id; }, $("fz-aktion"));
  });

  /* =========================================================================
     12) EINSTELLUNGEN, ELTERN-DIALOG, MODALS
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
  $("knopf-spielerwahl-einstellungen").addEventListener("click", oeffneEinstellungen);
  ["einstellungen-zu", "einstellungen-fertig"].forEach(function (id) {
    $(id).addEventListener("click", function () {
      FF.Klang.spiele("klick"); schliesseModal("einstellungen");
      if (modus === "menue") waehleTab(aktiverTab);
    });
  });

  /* Hilfe: alles, was man im Spiel machen kann, und „Was ist neu?“ (aus C.neuigkeiten) */
  function oeffneHilfe() {
    FF.Klang.init(); FF.Klang.spiele("klick");
    $("hilfe-neuigkeiten").innerHTML = C.neuigkeiten.map(function (n, i) {
      var aktuell = n.version === VERSION;
      return '<div class="neu-version' + (aktuell ? " aktuell" : "") + '"><div class="neu-kopf"><span class="neu-nummer">Version ' + n.version +
             "</span>" + n.titel + (aktuell ? ' <span class="neu-marke">⭐ deine Version</span>' : "") + "</div><ul>" +
             n.punkte.map(function (p) { return "<li>" + p + "</li>"; }).join("") + "</ul></div>";
    }).join("");
    oeffneModal("hilfe");
    $("hilfe-inhalt").scrollTop = 0;
  }
  $("knopf-hilfe").addEventListener("click", oeffneHilfe);
  ["hilfe-zu", "hilfe-fertig"].forEach(function (id) {
    $(id).addEventListener("click", function () { FF.Klang.spiele("klick"); schliesseModal("hilfe"); });
  });
  document.querySelectorAll(".hilfe-sprung button").forEach(function (b) {
    b.addEventListener("click", function () {
      var z = $(b.dataset.ziel), box = $("hilfe-inhalt");
      box.scrollTo({ top: box.scrollTop + z.getBoundingClientRect().top - box.getBoundingClientRect().top - 4, behavior: "smooth" });
    });
  });

  /* Frage für Erwachsene: kleine Rechenaufgabe (6–9 × 6–9), erst dann geht es weiter */
  function elternFrage(frage, beiRichtig) {
    var a = 6 + Math.floor(Math.random() * 4), b = 6 + Math.floor(Math.random() * 4), loesung = a * b;
    $("eltern-frage").textContent = frage;
    $("eltern-aufgabe").textContent = a + " × " + b;
    var antworten = [loesung, loesung + a, loesung - b].sort(function () { return Math.random() - 0.5; });
    $("eltern-antworten").innerHTML = antworten.map(function (x) {
      return '<button type="button" class="eltern-antwort" data-wert="' + x + '">' + x + "</button>";
    }).join("");
    $("eltern-antworten").querySelectorAll("button").forEach(function (knopf) {
      knopf.addEventListener("click", function () {
        if (+knopf.dataset.wert === loesung) {
          schliesseModal("eltern");
          beiRichtig();
        } else {
          wackeln(document.querySelector(".eltern-modal"));
          FF.Klang.spiele("fehler");
        }
      });
    });
    oeffneModal("eltern");
  }

  // Zurücksetzen: nur mit kleiner Rechenaufgabe für Erwachsene
  $("knopf-zuruecksetzen").addEventListener("click", function () {
    elternFrage("Wirklich alles löschen?", function () {
      S = neuerSpielstand(); P = S.spieler[S.aktiv]; speichere();
      bildCache = {};
      schliesseModal("einstellungen");
      einstellungenAnwenden();
      popover("♻️ Alles zurückgesetzt (beide Kinder) – viel Spaß beim neuen Start!");
      if (modus === "menue" || modus === "wahl") zeigeSpielerwahl();
    });
  });
  $("eltern-abbrechen").addEventListener("click", function () { schliesseModal("eltern"); });

  /* Versteckter Entwickler-Bereich: 7× schnell auf die Versionsnummer tippen (wie
     bei Android), dann die Rechenaufgabe für Erwachsene. Kein Zähler auf dem
     Bildschirm – Kinder sollen ihn nicht zufällig finden. Zum Testen von
     Upgrades und Leveln, ohne Münzen erspielen zu müssen. */
  var versionTipps = 0, versionZeit = 0;
  $("opt-version").textContent = "Fiete Flitzer · Version " + VERSION;
  $("opt-version").addEventListener("click", function () {
    var jetzt = performance.now();
    versionTipps = jetzt - versionZeit < 1500 ? versionTipps + 1 : 1;
    versionZeit = jetzt;
    if (!$("entwickler-gruppe").hidden || versionTipps < 7) return;
    versionTipps = 0;
    elternFrage("Entwickler-Bereich öffnen?", function () {
      $("entwickler-gruppe").hidden = false;
      entwicklerAnzeigen();
      FF.Klang.spiele("kauf");
      popover("🛠️ Entwickler-Bereich ist offen", 1600);
    });
  });
  function entwicklerAnzeigen() { $("dev-alle-offen").classList.toggle("aktiv", S.entwickler.alleOffen); }
  $("dev-muenzen").addEventListener("click", function () {
    C.kinder.forEach(function (k) { S.spieler[k.id].muenzen += 10000; });
    speichere(); kontoAktualisieren();
    FF.Klang.spiele("kauf");
    popover("🪙 +10.000 für " + C.kinder.map(function (k) { return k.name; }).join(" und "), 1600);
  });
  $("dev-alle-offen").addEventListener("click", function () {
    S.entwickler.alleOffen = !S.entwickler.alleOffen;
    speichere(); entwicklerAnzeigen();
    FF.Klang.spiele("klick");
  });
  $("dev-aus").addEventListener("click", function () {
    FF.Klang.spiele("klick");
    $("entwickler-gruppe").hidden = true; versionTipps = 0;
  });

  $("knopf-info").addEventListener("click", function () {
    FF.Klang.spiele("klick");
    var st = P.statistik;
    popover('<img class="popover-fiete" src="' + kindBild(S.aktiv, 110, 120, "freude") + '" alt="">' +
            "<b>Fiete Flitzer</b><br>ein Spiel von JONFIE STUDIOS<small>Rechts Gas ➡️, links Bremse ⬅️. Sammle Münzen 🪙 und Benzin ⛽ – " +
            "und mach dein Auto in der Garage 🔧 immer besser!<br>" + kindDef(S.aktiv).name + ": " + zahl(st.meter) +
            " m gefahren · " + st.salti + " Saltos</small>", 5000);
  });
  $("hud-muenzen").addEventListener("click", function () { popover("🪙 Münzen in dieser Fahrt<small>Die darfst du immer behalten!</small>", 2000); });
  $("hud-tank").addEventListener("click", function () { if (fahrt) popover(energie(fahrt.def).info, 2400); });

  /* =========================================================================
     13) TITEL + PWA
     ========================================================================= */
  var startGedrueckt = false;
  $("knopf-start").addEventListener("click", function () {
    if (startGedrueckt) return;
    startGedrueckt = true;
    FF.Klang.init(); einstellungenAnwenden(); FF.Klang.spiele("klick");
    var t = $("titelscreen");
    t.classList.add("aus");
    setTimeout(function () { t.classList.remove("aus"); startGedrueckt = false; zeigeSpielerwahl(); }, 380);
  });

  /* App-Update (PWA): Der Service Worker sucht beim Start und beim Zurückkehren in die
     App nach einer neuen Version. Ist eine da, lädt das Spiel neu – aber nie mitten in
     einer Fahrt – und zeigt danach oben kurz „Update auf Version …“. */
  var VERSION_SCHLUESSEL = "fiete-flitzer-version", neuLaden = false;
  (function () {
    var alt = null;
    try { alt = localStorage.getItem(VERSION_SCHLUESSEL); localStorage.setItem(VERSION_SCHLUESSEL, VERSION); } catch (e) { /* egal */ }
    if (alt && alt !== VERSION) {
      var b = $("update-banner");
      b.textContent = "✨ Fiete Flitzer wurde aktualisiert: Version " + alt + " → " + VERSION + " · Was ist neu? ❓";
      b.hidden = false;
      b.addEventListener("click", function () { b.hidden = true; if (modus !== "fahrt") oeffneHilfe(); });
      setTimeout(function () { b.hidden = true; }, 7000);
    }
  })();
  if ("serviceWorker" in navigator && location.protocol !== "file:") {
    var hatteSteuerung = !!navigator.serviceWorker.controller;
    navigator.serviceWorker.addEventListener("controllerchange", function () {
      if (!hatteSteuerung) { hatteSteuerung = true; return; }    // erste Installation, kein Update
      neuLaden = true;
    });
    setInterval(function () { if (neuLaden && modus !== "fahrt") location.reload(); }, 1500);
    window.addEventListener("load", function () {
      navigator.serviceWorker.register("sw.js").then(function (reg) {
        document.addEventListener("visibilitychange", function () { if (!document.hidden) reg.update().catch(function () {}); });
      }).catch(function () { /* egal */ });
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
     14) SPIELSCHLEIFE + START
     ========================================================================= */
  function zeichneKleinCanvas(id) {
    var c = $(id);
    if (!c || !c.width) return;
    var g = c.getContext("2d");
    g.setTransform(1, 0, 0, 1, 0, 0);
    var def = id === "vorschau" ? C.fahrzeuge[garageIndex] : FF.fahrzeugDef(P.fahrzeug);
    g.save(); g.scale(DPR, DPR);
    FF.Grafik.zeichneVorschau(g, c.width / DPR, c.height / DPR, def, aussehenVon(S.aktiv, def.id), zeit);
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
        if (aufnahme) aufnahme.erfasse(fahrt, ausdruck);
        if (geist) { geist.obj.setzeZeit(fahrt.zeit); geistVergleich(); }
        verarbeiteEreignisse();
        if (!fahrt) return;
        fahrEffekte(dt);
        kameraNachfuehren(dt, false);
        hudAktualisieren(false);
        var st = fahrt.fz.status, hilfe = fahrt.zustand === "hilfe";
        FF.Klang.motorSetze({
          drehzahl: hilfe ? 0 : st.drehzahl, bremse: fahrt.bremse, rueckwaerts: fahrt.rueckwaerts,
          gas: fahrt.gas + (fahrt.rueckwaerts ? 0.6 * fahrt.bremse : 0),       // rückwärts treibt der Motor auch
          laeuft: fahrt.tank > 0 && fahrt.zustand !== "ende", tempo: hilfe ? 0 : st.tempo, vmax: fahrt.werte.motor.vmax,
          boden: !hilfe && st.radKontakte > 0, luft: fahrt.welt.luftdichte > 0, getriebe: fahrt.getriebe, dt: dt
        });
        var inLuft = st.radKontakte === 0 && !st.huellKontakt && fahrt.zustand === "fahrt";
        if (zeit > ausdruckBis) {
          ausdruck = fahrt.luftZeit > 0.35 && inLuft ? "freude" : (fahrt.tank <= 0 ? "staunen" : "normal");
        }
        // In der Luft zeigen die Pedale, wohin sie die Nase drehen (⤴ Gas, ⤵ Bremse)
        var luftPedale = inLuft && fahrt.luftZeit > 0.3;
        if (luftPedale !== pedaleLuft) { pedaleLuft = luftPedale; $("pedale").classList.toggle("luft", luftPedale); }
        if (luftPedale && !luftTippGezeigt && fahrt.luftZeit > 0.5) {
          luftTippGezeigt = true;
          tipp("✈️ In der Luft: GAS hebt die Nase ⤴, BREMSE senkt sie ⤵", 4500);
          FF.Klang.sprich("In der Luft: Gas hebt die Nase, Bremse senkt sie!");
          spruchBis = zeit + 3;
        }
      }
      partikel.aktualisiere(pausiert ? 0 : dt, fahrt.welt.schwerkraft);
      texteAktualisieren(pausiert ? 0 : dt);
      if (himmelWelt !== fahrt.welt) { himmelWelt = fahrt.welt; canvas.style.background = FF.Grafik.himmelCss(himmelWelt); }
      ctx.setTransform(DPR, 0, 0, DPR, 0, 0);
      FF.Grafik.zeichneSzene(ctx, {
        fahrt: fahrt, kamera: kamera, zeit: zeit, dt: pausiert ? 0 : dt, dpr: DPR, himmelPerCss: true,
        partikel: partikel, texte: texte, wetter: wetter,
        aussehen: aussehenVon(S.aktiv), ausdruck: ausdruck,
        geist: geist ? { fz: geist.obj.fz, def: geist.obj.def, aussehen: geist.aussehen, ausdruck: geist.obj.ausdruck,
                         hilfe: geist.obj.hilfe, name: geist.name } : null,
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
  modus = "titel";
  groesseAnpassen();
  // Schriften laden, dann Canvas-Größen neu bestimmen (Layout kann sich ändern)
  if (document.fonts && document.fonts.ready) document.fonts.ready.then(groesseAnpassen);
  requestAnimationFrame(schleife);

  // Für Tests in der Konsole / Playwright
  FF.spiel = {
    get spielstand() { return S; },
    get profil() { return P; },
    get fahrt() { return fahrt; },
    get duell() { return duell; },
    get geist() { return geist; },
    get modus() { return modus; },
    starteFahrt: starteFahrt,
    zeigeMenue: zeigeMenue,
    zeigeSpielerwahl: zeigeSpielerwahl,
    setzeAktiv: setzeAktiv,
    setzeEingabe: function (g, b) { tasten.gas = !!g; tasten.bremse = !!b; eingabeAktualisieren(); }
  };
})();
