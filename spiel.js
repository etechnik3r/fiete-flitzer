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
  // Wer gerade wählbar ist: Fiete, Jonte und die sichtbaren eigenen Charaktere
  function verfuegbar() { return C.kinder.filter(function (k) { return !k.eigen || (S.eigene[k.id] && S.eigene[k.id].aktiv); }); }
  // Zu zweit (Geisterrennen): wer gegen wen fährt, steht in S.duell.paar (Standard: Fiete gegen Jonte)
  function paar() {
    var ids = (S.duell.paar || []).filter(function (id, i, L) {
      return L.indexOf(id) === i && verfuegbar().some(function (k) { return k.id === id; });
    });
    var grund = C.kinder.filter(function (k) { return !k.eigen; }).map(function (k) { return k.id; });
    for (var i = 0; ids.length < 2 && i < grund.length; i++) if (ids.indexOf(grund[i]) < 0) ids.push(grund[i]);
    S.duell.paar = ids.slice(0, 2);
    return S.duell.paar.map(kindDef);
  }
  function anderesKind(id) { var P2 = paar(); return P2[0].id === id ? P2[1].id : P2[0].id; }
  function genitiv(name) { return /[sxzß]$/i.test(name) ? name + "’" : name + "s"; }

  /* =========================================================================
     1) SPEICHERSTAND + PROFILE
     ========================================================================= */
  var SCHLUESSEL = "fiete-flitzer-spielstand-v1";
  // Profile, Laden alter Stände und der Spielstand-Code stehen in spielstand.js
  var SP = FF.Spielstand, neuerSpielstand = SP.neuerSpielstand;

  function lade() {
    var roh = null;
    try { roh = window.localStorage.getItem(SCHLUESSEL); } catch (e) { /* gesperrter Speicher */ }
    return SP.lade(roh);
  }

  function speichere() {
    try { window.localStorage.setItem(SCHLUESSEL, SP.alsText(S)); } catch (e) { /* privat-Modus o. ä. */ }
  }

  var S = lade();
  /* Eigener Charakter: Name und Aussehen aus dem Spielstand übernehmen */
  function eigenAnwenden() {
    C.kinder.forEach(function (k) {
      if (!k.eigen) return;
      var E = S.eigene[k.id];
      k.name = E.name || "Ich";
      FF.Kinder.setzeEigenes(k.id, E);
    });
    if (typeof kindLookCache !== "undefined") { kindLookCache = {}; bildCache = {}; }
    var akt = kindDef(S.aktiv);
    if (akt.eigen && !S.eigene[akt.id].aktiv) S.aktiv = C.kinder[0].id;
  }
  eigenAnwenden();
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
  function hexOk(t) { return typeof t === "string" && /^#[0-9a-f]{6}$/i.test(t); }
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
    var f = farbWert(fs.farbe || FF.fahrzeugDef(fzId).farbe), lackWert = f.wert, verlauf = null;
    if (f.wert === "eigene") lackWert = hexOk(fs.eigeneFarbe) ? fs.eigeneFarbe : farbWert(FF.fahrzeugDef(fzId).farbe).wert;
    if (f.wert === "verlauf") {
      var V = fs.verlauf || {};
      verlauf = { a: hexOk(V.a) ? V.a : "#2f6fd6", b: hexOk(V.b) ? V.b : "#ffd23f", r: V.r === "ou" ? "ou" : "vh" };
      lackWert = FF.Grafik.mische(verlauf.a, verlauf.b, 0.5);
    }
    var bf = C.beifahrer.filter(function (b) { return b.id === prof.beifahrer; })[0];
    return { farbe: lackWert, verlauf: verlauf, glanz: !!f.glanz, muster: fs.muster || "keins", outfit: outfitWert(prof.outfit), kind: kindMitLook(kindId),
             felge: prof.felge || "standard", beifahrer: bf ? bf.emoji : "", spoiler: (fs.upgrades && fs.upgrades.spoiler) || 0 };
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
  var himmelWelt = null, himmelWarKopf = false;          // Welt, deren Himmelsverlauf gerade als CSS hinter dem Canvas liegt
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
  var pedaleLuft = false;          // Pedale zeigen gerade die Luft-Pfeile
  var auspuffTakt = 0, staubTakt = 0, dampfPhase = 0, dampfStand = 0;
  var luftTippDieseFahrt = false;            // "Gas hebt die Nase" wurde in dieser Fahrt schon geprüft

  function groesseAnpassen() {
    DPR = Math.min(2, window.devicePixelRatio || 1, modus === "titel" && show && show.dprMax ? show.dprMax : 2);
    B = window.innerWidth; H = window.innerHeight;
    canvas.width = Math.round(B * DPR); canvas.height = Math.round(H * DPR);
    kamera.b = B; kamera.h = H;
    if (fahrt) wetter.setze(fahrt.welt.wetter, kamera);
    ["vorschau"].forEach(function (id) {
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
  function extraDruecken(art) {
    if (!fahrt || modus !== "fahrt" || pausiert || ergebnisOffen) return;
    FF.Klang.init();
    if (fahrt.zuende(art)) return;
    var X = C.regeln.extras, es = fahrt.extraStand();
    if (fahrt.zustand !== "fahrt") return;               // Ballon, Ziel: Knopf ist ohnehin grau
    FF.Klang.spiele("fehler");
    if (art === "boost") tipp(fahrt.boostZeit > 0 ? "🚀 Der Turbo läuft schon!" : "🚀 Sammle einen lila Raketen-Kanister – dann gibt der Knopf Turbo!", 3000);
    else if (es.federSperre > 0) tipp("🦘 Die Sprungfeder muss sich erholen – noch " + Math.ceil(es.federSperre) + " Sekunden.", 2500);
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
  var roehrenZoom = 1;
  var kopfLage = 0;                         // Kopfüberwelt: 0 = normal, 1 = kopfüber (weich dazwischen beim Umklappen)
  function kameraNachfuehren(dt, sofort) {
    var Kc = C.kamera, ch = fahrt.fz.chassis;
    var quer = B >= H;
    var basisS = quer ? H / Kc.sichtHoehe : B / Kc.sichtBreiteHoch;
    var v = Math.hypot(ch.vx, ch.vy);
    var zoomZiel = 1 - Kc.zoomBeiTempo * Math.min(1, v / Kc.tempoFuerZoom);
    kamera.zoom = sofort ? zoomZiel : kamera.zoom + (zoomZiel - kamera.zoom) * Math.min(1, dt * 1.2);
    kamera.s = basisS * kamera.zoom;
    kamera.ankerX = quer ? 0.4 : 0.38;
    kamera.ankerY = (quer ? 0.58 : 0.55) - 0.1 * kopfLage;   // kopfüber: Auto etwas höher, damit es gespiegelt in der Mitte fährt
    var zielX = ch.x + klemme(ch.vx * Kc.vorausschau, -3, 6);
    var zielY = ch.y + 0.6;
    // In der Röhre: etwas weiter weg, damit man Loopings und Kurven ganz sieht
    // Chemiewelt: im oder kurz vor einem Behälter auch, damit man ihn ganz sieht (Wände, Spiegel, Ausgang)
    var beiBecken = false, BK = fahrt.gelaende.becken;
    for (var bi = 0; bi < BK.length; bi++) if (ch.x > BK[bi].xl - 10 && ch.x < BK[bi].xr + 2) { beiBecken = true; break; }
    roehrenZoom += ((fahrt.roehre ? 0.78 : beiBecken ? 0.72 : 1) - roehrenZoom) * (sofort ? 1 : Math.min(1, dt * 1.5));
    kamera.s *= roehrenZoom;
    if (fahrt.zugHinten) {                       // Dampf-Lok: etwas weiter weg und weniger voraus, damit der ganze Zug ins Bild passt
      kamera.s *= quer ? 0.94 : 0.84;
      zielX = ch.x + klemme(ch.vx * Kc.vorausschau, -3, 3) - 1.0;
    }
    if (fahrt.welt.wolken) {
      // Wolkeninseln: Auto etwas höher im Bild und etwas weiter weg, damit man die nächste
      // (meist tiefere) Wolke und die Lücke davor gut sieht
      kamera.ankerY -= 0.1; kamera.s *= 0.92;
    }
    if (fahrt.welt.decke) {
      // Höhle: etwas weiter weg und so hoch, dass die Decke oben im Bild bleibt –
      // aber das Auto rutscht nie tiefer als 80 % der Bildhöhe
      kamera.s *= 0.9;
      var sichtOben = kamera.ankerY * H / kamera.s, sichtUnten = (0.8 - kamera.ankerY) * H / kamera.s;
      var decke = fahrt.gelaende.deckeBei(zielX);
      zielY = Math.min(Math.max(zielY, decke - sichtOben + 2.0), ch.y + sichtUnten);
    }
    if (modus === "titel" && !quer) kamera.s *= 1.3;          // Startseiten-Show hochkant: näher ran, das Auto ist der Star
    if (sofort) { kamera.x = zielX; kamera.y = zielY; return; }
    var k = Math.min(1, dt * Kc.glaettung);
    kamera.x += (zielX - kamera.x) * k;
    kamera.y += (zielY - kamera.y) * Math.min(1, k * 1.3);
  }

  /* =========================================================================
     5) EFFEKTE: Partikel, Schwebetexte, Meldungen, Konfetti, Popover
     ========================================================================= */
  /* Superheldenwelt: Comic-Sprechblase (gezackter Stern hinter der Schrift) */
  var COMIC = ["BÄM!", "ZACK!", "WUSCH!", "KAWUMM!", "PENG!", "HUI!", "ZOING!"], comicNr = 0, comicBis = 0;
  function comic(x, y, wort) {
    if (!fahrt || !fahrt.welt.comic || zeit < comicBis) return;
    comicBis = zeit + 0.7;                                // nicht zu viele auf einmal
    texte.push({ x: x, y: y, text: wort || COMIC[comicNr++ % COMIC.length], farbe: "#ffffff", gross: true, comic: true, t: 0, dauer: 1.2 });
    if (texte.length > 24) texte.shift();
  }
  function schwebeText(x, y, text, farbe, gross) {
    texte.push({ x: x, y: y, text: text, farbe: farbe, gross: gross, t: 0, dauer: gross ? 1.6 : 1.0 });
    if (texte.length > 24) texte.shift();
  }
  function texteAktualisieren(dt) {
    for (var i = texte.length - 1; i >= 0; i--) { texte[i].t += dt; if (texte[i].t >= texte[i].dauer) texte.splice(i, 1); }
  }

  var meldungTimer = null;
  function meldung(text) {
    if (demo) return;
    var el = $("meldung");
    el.hidden = false;
    el.textContent = text;
    el.classList.remove("zeigen"); void el.offsetWidth; el.classList.add("zeigen");
    clearTimeout(meldungTimer);
    meldungTimer = setTimeout(function () { el.hidden = true; }, 1700);
  }

  /* Tipps zur Bedienung: dezent oben links, abschaltbar (Einstellung „Tipps“).
     sag: dazu vorlesen (nur wenn Tipps an sind) */
  var tippTimer = null;
  var tippSchlange = [];             // Tipps, die während der Start-Ampel kommen, warten hier – keiner geht verloren
  function tipp(text, dauer, sag) {
    if (!S.einstellungen.tipps || demo) return;
    if (countdown) {                                                    // erst nach der Start-Ampel, der Reihe nach
      if (!tippSchlange.some(function (t) { return t[0] === text; })) tippSchlange.push([text, dauer, sag]);
      return;
    }
    tippZeigen(text, dauer, sag);
  }
  function tippZeigen(text, dauer, sag) {
    if (sag) FF.Klang.sprich(sag);
    var el = $("tipp");
    el.textContent = text; el.hidden = false;
    clearTimeout(tippTimer);
    tippTimer = setTimeout(function () {
      el.hidden = true;
      if (tippSchlange.length && !countdown && modus === "fahrt") tippTimer = setTimeout(function () { tippZeigen.apply(null, tippSchlange.shift()); }, 350);
    }, dauer || 3500);
  }
  function tippsLeeren() { tippSchlange = []; clearTimeout(tippTimer); $("tipp").hidden = true; }
  /* Erklär-Tipps nur die ersten Male (gemerkt im Spielstand, auch nach einem Neustart der App) */
  function ersteMale(id, n) {
    if (demo) return false;                    // Startseiten-Show zählt nicht mit
    var k = S.gesehen[id] || 0;
    if (k >= n) return false;
    S.gesehen[id] = k + 1; speichere();
    return true;
  }

  function konfetti(anzahl) {
    if (demo) return;
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
      var wasser = fahrt.gelaende.pfuetzen.length > 0;
      fz.raeder.forEach(function (R) {
        if (wasser && R.imWasser) {                            // Pfütze: Wasser spritzt nach hinten und oben
          var v = Math.abs(R.k.vx);
          if (v > 1.5) {
            var L = fahrt.gelaende.wasserBei(R.k.x), n = Math.min(4, 1 + Math.floor(v / 4));
            for (var k = 0; k < n; k++) {
              partikel.neu({ art: "tropfen", x: R.k.x - Math.sign(R.k.vx) * R.r * 0.6, y: L + 0.05, t: 0, dauer: 0.55 + Math.random() * 0.3,
                             vx: -R.k.vx * (0.15 + Math.random() * 0.25) + (Math.random() - 0.5), vy: 1.5 + Math.random() * (1 + v * 0.25),
                             r0: 0.06 + Math.random() * 0.06, farbe: "rgba(190,225,255,0.9)", schwer: 1, reibung: 0.5 });
            }
          }
          return;
        }
        var ko = R.kontakt;
        if (!ko.aktiv || ko.pen < -0.02) return;
        if (fahrt.werte.kufen) { kufenStaub(R, ko); return; }
        if (fahrt.werte.schweben) return;                      // Teppich: berührt den Boden nicht
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
    if (fahrt.werte.kufen) schneeKanone(dt);
    if (fahrt.werte.wanne) wannenWasser(dt);
    if (fahrt.werte.zauber) teppichGlitzer(dt);
    if (fahrt.getriebe.dampf) dampfWolken(dt);
    if (fahrt.werte.wasserstoff) wasserAuspuff(dt);
    if (fahrt.welt.schleimtropfen || fahrt.fz.flecken) schleimTropfen(dt);
    if (fahrt.def.form === "scooter") stuntAktualisieren(dt);
    if (fahrt.werte.fussAntrieb) schritte();
    if (fahrt.werte.turbine && (fahrt.turbinenLauf || 0) > 0.25 && auspuffTakt <= 0) {     // Turbine: heiße Abgase hinter der Düse
      auspuffTakt = 0.05;
      var ct = Math.cos(ch.a), stt = Math.sin(ch.a), xt = -2.1 - fahrt.turbinenLauf * 0.8, yt = 0.8;
      partikel.neu({ art: "rauch", x: ch.x + ct * xt - stt * yt, y: ch.y + stt * xt + ct * yt,
                     vx: -ct * 3 + ch.vx * 0.4, vy: -stt * 3 + ch.vy * 0.4 + 0.3, t: 0, dauer: 0.5, r0: 0.15, r1: 0.6,
                     farbe: "rgba(210,215,230,0.8)", alpha: 0.45, reibung: 1.5 });
    } else if (fahrt.werte.feuer && fahrt.tank > 0 && auspuffTakt <= 0) {   // Feuerkutsche: dicker, rußiger Qualm aus dem Feuerrohr
      var fe = fahrt.fz.feuer || 0, cf = Math.cos(ch.a), sf = Math.sin(ch.a);
      auspuffTakt = fe > 0.15 ? 0.035 : 0.3;                          // ohne Gas kokelt es nur ein bisschen
      var xf = -1.35 - fe * 1.6, yf = 0.5, xw = ch.x + cf * xf - sf * yf, yw = ch.y + sf * xf + cf * yf;
      if (welt.unterwasser || fahrt.imBecken) partikel.neu({ art: "blase", x: xw, y: yw, vx: ch.vx * 0.3, vy: 0.6, t: 0, dauer: 1.4, r0: 0.08, r1: 0.22, schwer: -0.35, reibung: 1.2 });
      else partikel.neu({ art: "rauch", x: xw, y: yw, vx: ch.vx * 0.35 - cf * (1 + 2.5 * fe),           // ohne Luft (Mond) steigt kein Qualm auf
                          vy: ch.vy * 0.35 + Math.min(1, welt.luftdichte / 1.2) * (0.6 + 1.2 * fe + Math.random() * 0.4),
                          t: 0, dauer: 1.1 + 1.3 * fe, r0: 0.12 + 0.12 * fe, r1: 0.45 + 0.9 * fe,
                          farbe: ["#2e3138", "#454a55", "#5d626e"][Math.floor(Math.random() * 3)], alpha: 0.35 + 0.4 * fe, reibung: 1.2 });
    } else if (fahrt.def.form === "kettenwagen" && fahrt.tank > 0 && auspuffTakt <= 0 && fahrt.fz.glieder[0]) {   // Kettenwagen: Auspuff am Motorblock
      var GR = fahrt.fz.glieder[0], gk = GR.k, ck2 = Math.cos(gk.a), sk2 = Math.sin(gk.a), ap = GR.def.motor.auspuff;
      auspuffTakt = fahrt.gas > 0.3 ? 0.08 : 0.35;
      var xa = gk.x + ck2 * ap[0] - sk2 * ap[1], ya = gk.y + sk2 * ap[0] + ck2 * ap[1];
      if (welt.unterwasser || fahrt.imBecken) partikel.neu({ art: "blase", x: xa, y: ya, vx: ch.vx * 0.3, vy: 0.6, t: 0, dauer: 1.2, r0: 0.05, r1: 0.14, schwer: -0.35, reibung: 1.2 });
      else partikel.neu({ art: "rauch", x: xa, y: ya, vx: gk.vx * 0.4 - ck2 * 0.8, vy: gk.vy * 0.4 + Math.min(1, welt.luftdichte / 1.2) * (0.5 + 0.8 * fahrt.gas),
                          t: 0, dauer: 0.7 + 0.5 * fahrt.gas, r0: 0.05, r1: 0.22 + 0.2 * fahrt.gas, farbe: "rgba(120,126,140,0.85)", alpha: 0.35 + 0.25 * fahrt.gas, reibung: 1.6 });
    } else if (fahrt.def.form === "lkw" && fahrt.tank > 0 && auspuffTakt <= 0) {   // Donner-Truck: schwarzer Rauch aus beiden Rohren
      var gl = fahrt.gas, ck = Math.cos(ch.a), sk = Math.sin(ch.a);
      auspuffTakt = gl > 0.3 ? 0.06 : 0.28;
      if (gasWarAn < 0.3 && gl > 0.6) auspuffTakt = 0;                 // beim Gasgeben ein dicker Schwall
      gasWarAn = gl;
      [[-0.32, 2.74], [-0.5, 2.7]].forEach(function (r, n) {
        if (n && Math.random() < 0.5) return;
        var xk = ch.x + ck * r[0] - sk * r[1], yk = ch.y + sk * r[0] + ck * r[1];
        if (welt.unterwasser || fahrt.imBecken) { partikel.neu({ art: "blase", x: xk, y: yk, vx: ch.vx * 0.3, vy: 0.6, t: 0, dauer: 1.4, r0: 0.08, r1: 0.2, schwer: -0.35, reibung: 1.2 }); return; }
        partikel.neu({ art: "rauch", x: xk, y: yk, vx: ch.vx * 0.5 - sk * (1 + 2 * gl), vy: ch.vy * 0.5 + ck * (1 + 2.5 * gl),
                       t: 0, dauer: 0.9 + 0.6 * gl, r0: 0.12, r1: 0.45 + 0.6 * gl, farbe: gl > 0.3 ? "rgba(35,35,40,0.95)" : "rgba(90,90,100,0.8)",
                       alpha: gl > 0.3 ? 0.75 : 0.35, reibung: 1.3 });
      });
    } else if (fahrt.gas > 0.4 && fahrt.tank > 0 && auspuffTakt <= 0 && !fahrt.werte.kufen && !fahrt.werte.wanne && !fahrt.getriebe.elektro && !fahrt.werte.turbine && !fahrt.getriebe.dampf) {   // Elektro: kein Auspuff
      auspuffTakt = 0.09;
      var L = fahrt.werte.groesse.laenge;
      var ca = Math.cos(ch.a), sa = Math.sin(ch.a), lx = -L * 0.5, ly = -0.05;
      if (welt.unterwasser || fahrt.imBecken) {                                  // unter Wasser blubbert der Auspuff
        partikel.neu({ art: "blase", x: ch.x + ca * lx - sa * ly, y: ch.y + sa * lx + ca * ly,
                       vx: -ca * 0.8 + ch.vx * 0.3, vy: 0.4, t: 0, dauer: 1.4, r0: 0.05, r1: 0.14, schwer: -0.35, reibung: 1.2 });
      } else partikel.neu({ art: "rauch", x: ch.x + ca * lx - sa * ly, y: ch.y + sa * lx + ca * ly,
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

  /* Schnee-Schlitten: Die Kanone schießt Schneeflocken im Bogen über das Kind. Jede Flocke
     fliegt genau so, dass sie nach „flug“ Sekunden im gerade beschneiten Stück landet
     (fahrt.fz.kanoneZiel = [xa, xb]) – dann verschwindet sie, und dort liegt der Schnee. */
  var kanonenTakt = 0;
  function schneeKanone(dt) {
    var fz = fahrt.fz, ch = fz.chassis, Z = fz.kanoneZiel, gel = fahrt.gelaende;
    kanonenTakt -= dt;
    if (!fz.kanone || !Z || kanonenTakt > 0) return;
    kanonenTakt = 0.025;
    var ca = Math.cos(ch.a), sa = Math.sin(ch.a), lx = -0.42, ly = 1.3;
    var x0 = ch.x + ca * lx - sa * ly, y0 = ch.y + sa * lx + ca * ly, g = fahrt.welt.schwerkraft;
    for (var k = 0; k < 2; k++) {
      // Jede Flocke landet dort, wo die Kufenspitze nach IHRER Flugzeit ist (Ziel gilt für kanone.flug)
      var flug = fahrt.werte.kanone.flug * (0.85 + Math.random() * 0.3);
      var xt = Z[0] + (flug - fahrt.werte.kanone.flug) * ch.vx + Math.random() * (Z[1] - Z[0]), yt = gel.hoeheBei(xt) + 0.1;
      partikel.neu({ art: "tropfen", x: x0, y: y0, t: 0, dauer: flug, schwer: 1, reibung: 0,
                     vx: (xt - x0) / flug, vy: (yt - y0 + 0.5 * g * flug * flug) / flug,
                     r0: 0.06 + Math.random() * 0.07, alpha: 1.8, farbe: k ? "rgba(255,255,255,0.95)" : "rgba(225,240,255,0.95)" });   // alpha > 1: verblasst erst kurz vor der Landung
    }
    if (Math.random() < 0.35) {                                 // Pulver staubt beim Auftreffen
      var xp = Z[0] + Math.random() * (Z[1] - Z[0]);
      partikel.neu({ art: "staub", x: xp, y: gel.hoeheBei(xp) + 0.15, vx: ch.vx * 0.3 + (Math.random() - 0.5), vy: 0.4 + Math.random() * 0.5,
                     t: 0, dauer: 0.5, r0: 0.08, r1: 0.3, farbe: "#ffffff", alpha: 0.7, reibung: 2 });
    }
  }
  /* Badewanne: Wasserstrahl aus dem Abfluss (Tropfen fliegen nach hinten und fallen) und
     Wasser, das beim Schwappen über den Rand läuft */
  var wannenTakt = 0;
  function wannenWasser(dt) {
    var fz = fahrt.fz, ch = fz.chassis, ca = Math.cos(ch.a), sa = Math.sin(ch.a);
    wannenTakt -= dt;
    if (wannenTakt > 0) return;
    wannenTakt = 0.03;
    var s = fz.strahl || 0;
    if (s > 0.08) {
      var x0 = ch.x + ca * -1.22 - sa * -0.12, y0 = ch.y + sa * -1.22 + ca * -0.12;
      for (var k = 0; k < 2; k++) {
        var v = 2.5 + 3.5 * s + Math.random();
        partikel.neu({ art: "tropfen", x: x0, y: y0, t: 0, dauer: 0.5 + Math.random() * 0.3, schwer: 1, reibung: 0.3,
                       vx: ch.vx - ca * v + (Math.random() - 0.5) * 0.6, vy: ch.vy - sa * v + 0.4 + Math.random() * 0.6,
                       r0: 0.05 + Math.random() * 0.05, alpha: 1.4, farbe: k ? "rgba(120,195,255,0.95)" : "rgba(220,240,255,0.95)" });
      }
    }
    if (fz.schwapp && fahrt.zeit - fz.schwapp.zeit < 0.06) {
      for (var j = 0; j < 4; j++) {
        partikel.neu({ art: "tropfen", x: fz.schwapp.x, y: fz.schwapp.y, t: 0, dauer: 0.6 + Math.random() * 0.3, schwer: 1, reibung: 0.4,
                       vx: ch.vx * 0.6 + fz.schwapp.seite * (0.5 + Math.random() * 1.5), vy: ch.vy * 0.4 + 0.5 + Math.random() * 1.5,
                       r0: 0.06 + Math.random() * 0.07, alpha: 1.3, farbe: "rgba(110,190,250,0.95)" });
      }
    }
  }
  /* Fliegender Teppich: Zauberstaub rieselt unter dem Teppich heraus (mehr beim Gasgeben) und
     ein Lufthauch kräuselt den Boden darunter */
  var glitzerTakt = 0, GLITZER = ["#fff3a8", "#ffd23f", "#ffffff", "#c9a6ff", "#9fe0ff"];
  function teppichGlitzer(dt) {
    var fz = fahrt.fz, ch = fz.chassis, ca = Math.cos(ch.a), sa = Math.sin(ch.a), z = Math.abs(fahrt.zauberLauf || 0);
    glitzerTakt -= dt * (0.35 + 1.6 * z);
    if (glitzerTakt > 0 || fahrt.zustand !== "fahrt") return;
    glitzerTakt = 0.05;
    var lx = -1.25 + Math.random() * 2.3, ly = -0.22;
    partikel.neu({ art: "funkel", x: ch.x + ca * lx - sa * ly, y: ch.y + sa * lx + ca * ly, t: 0, dauer: 0.5 + Math.random() * 0.4,
                   vx: ch.vx * 0.3 - ca * (0.5 + 2 * z) + (Math.random() - 0.5), vy: ch.vy * 0.3 - 0.4 - Math.random() * 0.6,
                   r0: 0.05 + Math.random() * 0.06, farbe: GLITZER[(Math.random() * 5) | 0], schwer: 0.15, reibung: 1.5 });
  }
  /* Kufen: auf Schnee stiebt etwas Pulver, auf blankem Boden kratzen sie (Staub in Bodenfarbe) */
  function kufenStaub(R, ko) {
    var v = Math.hypot(R.k.vx, R.k.vy);
    if (v < 1.5 || Math.random() > 0.35) return;
    var px = R.k.x - ko.nx * R.r, py = R.k.y - ko.ny * R.r, ch = fahrt.fz.chassis;
    var schnee = fahrt.welt.schneeBoden || fahrt.gelaende.schneeBei(px);
    partikel.neu({ art: "staub", x: px, y: py + 0.05, vx: -ch.vx * 0.15 + (Math.random() - 0.5), vy: 0.5 + Math.random() * 0.7,
                   t: 0, dauer: 0.5 + Math.random() * 0.3, r0: 0.08, r1: schnee ? 0.28 : 0.4,
                   farbe: schnee ? "#ffffff" : fahrt.welt.farben.punkte, alpha: schnee ? 0.6 : 0.8, reibung: 2 });
  }

  /* E-Scooter: Bei hohen Sprüngen zeigt das Kind einen Trick und steht vor der Landung
     wieder auf dem Brett. fz.stunt.u läuft weich von 0 (steht) bis 1 (Trick) – nur Grafik. */
  var STUNTS = [["flieger", "Abflug! 🦸"], ["haende", "Freihändig! 🙌"], ["bein", "Ein Bein! 🦵"]], stuntNr = 0, stuntArt = null;
  function stuntAktualisieren(dt) {
    var fz = fahrt.fz, C = fz.chassis, st = fz.status;
    fz.stunt = fz.stunt || { art: null, u: 0 };
    var luft = st.radKontakte === 0 && !st.huellKontakt && fahrt.zustand === "fahrt" && !fahrt.hilfe;
    var hoehe = C.y - fahrt.gelaende.hoeheBei(C.x);
    var bald = C.vy < 0 && hoehe + C.vy * 0.4 < 1.3;                     // Landung naht: rechtzeitig wieder hinstellen
    if (luft && !stuntArt && fahrt.luftZeit > 0.2 && hoehe > 1.6 && !bald) {
      var S0 = STUNTS[stuntNr++ % STUNTS.length]; stuntArt = S0[0];
      schwebeText(C.x, C.y + 1.8, S0[1], "#ffe27a", false);
    }
    var ziel = luft && stuntArt && !bald && hoehe > 1.1 ? 1 : 0;
    fz.stunt.u += (ziel - fz.stunt.u) * Math.min(1, dt * (ziel ? 5 : 10));
    if (!luft && fz.stunt.u < 0.03) { stuntArt = null; fz.stunt.u = 0; }
    fz.stunt.art = stuntArt || fz.stunt.art;
  }
  /* Seifenkiste: Tapp-tapp bei jedem Schritt */
  var schrittAlt = 0;
  function schritte() {
    var fz = fahrt.fz, n = Math.floor((fz.lauf || 0) / Math.PI);
    if (n !== schrittAlt) { schrittAlt = n; if (fz.laeuft) FF.Klang.spiele("tapp"); }
  }

  /* Schleimwelt: Ab und zu fällt ein dicker Tropfen von oben genau dorthin, wo das Auto
     gleich ist; trifft er, bleibt ein grüner Fleck auf dem Auto (nur Grafik, verblasst). */
  var schleimTakt = 2, schleimFaelle = [];
  function schleimFleck(n, farbe) {
    var fz = fahrt.fz, L = fahrt.werte.groesse.laenge, H0 = fahrt.werte.groesse.hoehe;
    fz.flecken = fz.flecken || [];
    for (var i = 0; i < n; i++) {
      if (fz.flecken.length >= 9) fz.flecken.shift();
      fz.flecken.push({ x: (Math.random() - 0.5) * L * 0.8, y: Math.random() * H0 * 0.55, r: 0.1 + Math.random() * 0.12, t: 9 + Math.random() * 4, w: Math.random() * 6, farbe: farbe });
    }
  }
  function schleimTropfen(dt) {
    var ST = fahrt.welt.schleimtropfen, ch = fahrt.fz.chassis, fz = fahrt.fz;
    if (fz.flecken) fz.flecken = fz.flecken.filter(function (f) { f.t -= dt; return f.t > 0; });
    if (!ST || fahrt.zustand !== "fahrt") return;
    schleimTakt -= dt;
    if (schleimTakt <= 0) {
      schleimTakt = ST.abstand * (0.6 + 0.8 * Math.random());
      var x = ch.x + ch.vx * 1.0 + (Math.random() - 0.5) * 0.8, h0 = 4.9;       // fällt in 1 s aus 4,9 m (g · t² / 2)
      partikel.neu({ art: "tropfen", x: x, y: ch.y + 1 + h0, vx: 0, vy: 0, t: 0, dauer: 1.0, r0: 0.2, farbe: "rgba(120,235,60,0.95)", schwer: 1, reibung: 0 });
      schleimFaelle.push({ x: x, t: 1.0 });
    }
    for (var i = schleimFaelle.length - 1; i >= 0; i--) {
      var f = schleimFaelle[i];
      f.t -= dt;
      if (f.t > 0) continue;
      schleimFaelle.splice(i, 1);
      if (Math.abs(f.x - ch.x) < fahrt.werte.groesse.laenge * 0.55) {
        schleimFleck(1); FF.Klang.spiele("schlurp", 0.4);
        if (Math.random() < 0.5) schwebeText(ch.x, ch.y + 2, ["Iiih!", "Glibber!", "Schleim! 🟢"][Math.floor(Math.random() * 3)], "#c6ff7a", false);
        for (var k = 0; k < 6; k++) partikel.neu({ art: "tropfen", x: f.x, y: ch.y + 1.2, vx: (Math.random() - 0.5) * 4, vy: 1 + Math.random() * 2,
                                                   t: 0, dauer: 0.6, r0: 0.07, farbe: "rgba(120,235,60,0.95)", schwer: 1, reibung: 0.3 });
      }
    }
  }

  /* H₂-Blubber: Aus dem Auspuff tropft Wasser (je mehr Gas, desto mehr), beim Gasgeben
     kommen kleine Dampfwölkchen dazu – mehr kommt bei einer Brennstoffzelle nicht heraus. */
  var tropfTakt = 0;
  function wasserAuspuff(dt) {
    if (fahrt.zustand === "ende" || fahrt.tank <= 0) return;
    var ch = fahrt.fz.chassis, ca = Math.cos(ch.a), sa = Math.sin(ch.a), lx = -1.84, ly = -0.16, gas = fahrt.gas;
    tropfTakt -= dt;
    if (tropfTakt > 0) return;
    tropfTakt = 0.45 - 0.33 * gas + Math.random() * 0.1;
    var x = ch.x + ca * lx - sa * ly, y = ch.y + sa * lx + ca * ly;
    if (fahrt.welt.unterwasser || fahrt.imBecken) {
      partikel.neu({ art: "blase", x: x, y: y, vx: ch.vx * 0.3, vy: 0.4, t: 0, dauer: 1.2, r0: 0.04, r1: 0.12, schwer: -0.35, reibung: 1.2 });
      return;
    }
    partikel.neu({ art: "tropfen", x: x, y: y, vx: ch.vx * 0.8 - ca * 0.4, vy: ch.vy * 0.8 - 0.2, t: 0, dauer: 0.7, r0: 0.07,
                   farbe: "rgba(110,190,255,0.95)", schwer: 1, reibung: 0.3 });
    if (gas > 0.4 && Math.random() < 0.6) partikel.neu({ art: "rauch", x: x, y: y, vx: -ca * 1.2 + ch.vx * 0.5, vy: 0.5 - sa * 1.2 + ch.vy * 0.5,
                   t: 0, dauer: 0.6, r0: 0.06, r1: 0.3, farbe: "rgba(240,248,255,0.95)", alpha: 0.45, reibung: 1.8 });
  }

  /* Dampf-Lok: Bei jedem Kolbenhub (4 je Radumdrehung, wie der Klang) pufft eine
     Dampfwolke aus dem Schornstein, beim Anfahren zischt Dampf aus den Zylindern,
     im Stand steigt ab und zu ein Wölkchen auf. */
  function dampfWolken(dt) {
    var fz = fahrt.fz, ch = fz.chassis, R = fz.raeder[0], welt = fahrt.welt;
    if (fahrt.zustand === "ende") return;
    var an = fahrt.tank > 0 && fahrt.zustand !== "hilfe", ca = Math.cos(ch.a), sa = Math.sin(ch.a);
    var rate = an ? 4 * Math.abs(R.k.w - ch.w) / (2 * Math.PI) : 0;
    if (an && fahrt.gas > 0.05 && rate < 1.2) rate = 1.2 * fahrt.gas;
    dampfPhase += rate * dt;
    var puff = dampfPhase >= 1;
    if (puff) dampfPhase %= 1;
    dampfStand -= dt;
    if (!puff && an && rate < 0.3 && dampfStand <= 0) { puff = true; dampfStand = 0.8 + Math.random() * 0.6; }
    if (!puff || (rate > 12 && Math.random() < 0.4)) return;
    var gas = fahrt.gas, lx = 1.07, ly = 1.12;
    var x = ch.x + ca * lx - sa * ly, y = ch.y + sa * lx + ca * ly;
    if (welt.unterwasser || fahrt.imBecken) {
      partikel.neu({ art: "blase", x: x, y: y, vx: ch.vx * 0.3, vy: 0.6, t: 0, dauer: 1.4, r0: 0.06, r1: 0.16, schwer: -0.35, reibung: 1.2 });
      return;
    }
    partikel.neu({ art: "rauch", x: x, y: y, vx: ch.vx * 0.45 - sa * 1.2, vy: ch.vy * 0.45 + ca * (1.4 + 2.2 * gas),
                   t: 0, dauer: 1.0 + 0.4 * gas, r0: 0.16, r1: 0.65 + 0.5 * gas,
                   farbe: "rgba(246,247,251,0.95)", alpha: 0.5 + 0.3 * gas, reibung: 1.6 });
    if (gas > 0.3 && Math.abs(fz.status.vorwaerts) < 3.5) {            // Anfahren: Zylinderhähne zischen
      var zx = 1.45, zy = fz.raeder[1].lokalY !== undefined ? fz.raeder[1].lokalY + 0.17 : -0.2;
      partikel.neu({ art: "rauch", x: ch.x + ca * zx - sa * zy, y: ch.y + sa * zx + ca * zy,
                     vx: ch.vx * 0.3 + ca * 2.2 + (Math.random() - 0.5), vy: -0.3 + Math.random() * 0.6,
                     t: 0, dauer: 0.6, r0: 0.1, r1: 0.5, farbe: "rgba(255,255,255,0.9)", alpha: 0.55, reibung: 2.5 });
    }
  }

  /* Gekaufte Spur (config.spuren): Teilchen am Heck, solange das Auto fährt */
  var gasWarAn = 0, spurTakt = 0, pupsTakt = 0, tatzenSeite = false, REGENBOGEN = ["#ff5b5b", "#ff9e2c", "#ffd23f", "#3cc35a", "#2f6fd6", "#8e5bd8"];
  function spurZiehen(dt) {
    var art = P.spur, ch = fahrt.fz.chassis;
    if (!art || art === "keine" || fahrt.zustand !== "fahrt" || Math.hypot(ch.vx, ch.vy) < 2.5) return;
    spurTakt -= dt;
    if (spurTakt > 0) return;
    spurTakt = art === "regenbogen" ? 0.025 : 0.06;
    var L = fahrt.werte.groesse.laenge, lx = -L * 0.48, ly = 0.15, AN = fahrt.fz.anhaenger;
    if (AN && AN.length) { ch = AN[AN.length - 1].chassis; lx = -1.35; ly = 0.2; }   // Zug: hinter dem letzten Wagen, nicht zwischen Lok und Tender
    var ca = Math.cos(ch.a), sa = Math.sin(ch.a);
    var x = ch.x + ca * lx - sa * ly, y = ch.y + sa * lx + ca * ly, zf = Math.random;
    if (art === "regenbogen") {
      for (var i = 0; i < 6; i++) partikel.neu({ art: "staub", x: x - sa * (0.3 - i * 0.12), y: y + ca * (0.3 - i * 0.12), vx: 0, vy: 0,
                                                 t: 0, dauer: 0.9, r0: 0.1, r1: 0.08, farbe: REGENBOGEN[i], alpha: 1 });
    } else if (art === "sterne") {
      partikel.neu({ art: "funkel", x: x, y: y + (zf() - 0.5) * 0.4, vx: (zf() - 0.5), vy: (zf() - 0.5), t: 0, dauer: 0.8,
                     r0: 0.16 + zf() * 0.1, farbe: zf() < 0.5 ? "#fff3a0" : "#ffffff", reibung: 2 });
    } else if (art === "blasen") {
      partikel.neu({ art: "blase", x: x, y: y + (zf() - 0.5) * 0.3, vx: (zf() - 0.5) * 0.6, vy: 0.4 + zf() * 0.4, t: 0, dauer: 1.3,
                     r0: 0.08, r1: 0.22 + zf() * 0.1, schwer: -0.05, reibung: 1 });
    } else if (art === "herzen") {
      partikel.neu({ art: "herz", x: x, y: y + (zf() - 0.5) * 0.3, vx: (zf() - 0.5) * 0.5, vy: 0.6 + zf() * 0.5, t: 0, dauer: 1.1,
                     r0: 0.16 + zf() * 0.08, farbe: zf() < 0.6 ? "#ff5b8a" : "#ff9ec4", reibung: 1 });
    } else if (art === "funken") {
      for (var k = 0; k < 2; k++) partikel.neu({ art: "funkel", x: x, y: y, vx: -ca * (1 + zf() * 2) + (zf() - 0.5) * 2, vy: zf() * 2.5, t: 0, dauer: 0.55,
                                                 r0: 0.1 + zf() * 0.08, farbe: zf() < 0.5 ? "#ff8a2e" : "#ffd23f", schwer: 0.6, reibung: 1 });
    } else if (art === "konfetti") {
      partikel.neu({ art: "konfetti", x: x, y: y, vx: (zf() - 0.5) * 2, vy: 1 + zf() * 1.5, t: 0, dauer: 1.2,
                     farbe: REGENBOGEN[Math.floor(zf() * 6)], schwer: 0.3, reibung: 1, w: zf() * 6, dreh: (zf() - 0.5) * 10 });
    } else if (art === "pups") {                          // grüne Wölkchen, ab und zu ein leises „Pfff“
      partikel.neu({ art: "pups", x: x, y: y, vx: -ca * 0.8 + (zf() - 0.5) * 0.4, vy: 0.2 + zf() * 0.3, t: 0, dauer: 1.3,
                     r0: 0.12, r1: 0.45 + zf() * 0.15, reibung: 1.5, w: zf() * 6 });
      pupsTakt -= 0.12;
      if (pupsTakt <= 0) { pupsTakt = 1.6 + zf() * 1.4; FF.Klang.spiele("pups"); }
    } else if (art === "enten" || art === "bananen" || art === "socken") {   // fallen herunter und purzeln
      partikel.neu({ art: "emoji", emoji: { enten: "🦆", bananen: "🍌", socken: "🧦" }[art], x: x, y: y, vx: -ca * 0.5 + (zf() - 0.5) * 1.2,
                     vy: 1.2 + zf() * 1.2, t: 0, dauer: 1.4, r0: 0.38 + zf() * 0.1, schwer: 0.35, reibung: 0.6, w: zf() * 6,
                     dreh: art === "enten" ? (zf() - 0.5) * 3 : (zf() - 0.5) * 9 });
    } else if (art === "popcorn") {                       // poppt nach oben und fällt
      for (var pc = 0; pc < 2; pc++) partikel.neu({ art: "popcorn", x: x, y: y, vx: (zf() - 0.5) * 2.5, vy: 2.5 + zf() * 2.5, t: 0, dauer: 1.1,
                     r0: 0.09 + zf() * 0.05, schwer: 0.45, reibung: 0.5, w: zf() * 6, dreh: (zf() - 0.5) * 8 });
    } else if (art === "tatzen") {                        // Abdrücke auf dem Boden, abwechselnd links/rechts
      var tx = x, ty = fahrt.gelaende.hoeheBei(tx) + 0.07 + (tatzenSeite ? 0.08 : 0);
      tatzenSeite = !tatzenSeite;
      if (ch.y - ty < 2.5) partikel.neu({ art: "emoji", emoji: "🐾", x: tx, y: ty, vx: 0, vy: 0, t: 0, dauer: 2.2, r0: 0.45,
                                          w: -Math.atan(fahrt.gelaende.hoeheBei(tx + 0.5) - fahrt.gelaende.hoeheBei(tx - 0.5)) });
      spurTakt = 0.22;
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
    if (def.puste) return { icon: "💨", name: "Puste", voll: "🍎 Mampf – neue Puste!", knapp: "💨 Die Puste wird knapp – rollen lassen oder einen Apfel sammeln!",
      knappSag: "Die Puste wird knapp!", leer: "Keine Puste mehr! 💨", ergebnis: "Keine Puste mehr – gut gelaufen!", garage: "die Puste 💨",
      info: "💨 Deine Puste<small>Laufen kostet Puste. Rollst du ohne Gas, kommt sie langsam zurück – und Äpfel 🍎 geben neue!</small>" };
    if (def.zauberTank) return { icon: "✨", name: "Zauberstaub", voll: "🧪 Zauberstaub nachgefüllt!", knapp: "✨ Der Zauberstaub wird knapp – sammle ein lila Fläschchen!",
      knappSag: "Der Zauberstaub wird knapp!", leer: "Zauberstaub alle! ✨", ergebnis: "Zauberstaub alle – schön geflogen!", garage: "den Zauberstaub ✨",
      info: "✨ Dein Zauberstaub<small>Der Zauberwind schiebt den Teppich. Sammle die lila Zauberfläschchen 🧪!</small>" };
    if (def.wannenTank) return { icon: "🛁", name: "Badewasser", voll: "🪣 Wasser nachgefüllt!", knapp: "🛁 Das Badewasser wird knapp – sammle einen blauen Eimer!",
      knappSag: "Das Badewasser wird knapp!", leer: "Wanne leer! 🛁", ergebnis: "Wanne leer – gut geplanscht!", garage: "das Badewasser 🛁",
      info: "🛁 Dein Badewasser<small>Der Abfluss spritzt Wasser nach hinten und schiebt dich an. Bei Sprüngen schwappt es raus – sammle blaue Eimer 🪣!</small>" };
    if (def.schneeTank) return { icon: "❄️", name: "Schnee-Tank", voll: "❄️ Schnee nachgefüllt!", knapp: "❄️ Der Schnee wird knapp – sammle einen blauen Schnee-Kanister!",
      knappSag: "Der Schnee wird knapp!", leer: "Kein Schnee mehr! ❄️", ergebnis: "Schnee alle – gut gerodelt!", garage: "den Schnee-Tank ❄️",
      info: "❄️ Dein Schnee-Tank<small>Die Kanone schießt Schnee vor die Kufen, der Propeller schiebt. Sammle die blauen Schnee-Kanister!</small>" };
    if (def.wasserstoff) return { icon: "💧", name: "Wasserstoff", voll: "💧 Aufgetankt!", knapp: "💧 Wasserstoff wird knapp – sammle eine blaue H₂-Flasche!",
      knappSag: "Wasserstoff wird knapp!", leer: "Wasserstoff leer! 💧", ergebnis: "Wasserstoff leer – gut gefahren!", garage: "den H₂-Tank 💧",
      info: "💧 Dein Wasserstoff<small>Sammle die blauen H₂-Flaschen. Aus dem Auspuff kommt nur Wasser!</small>" };
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
          tipp(en.knapp, 3500, en.knappSag);
          break;
        case "tankLeer":
          FF.Klang.spiele("tankLeer");
          meldung(en.leer);
          setzeAusdruck("staunen", 6);
          break;
        case "salto":
          FF.Klang.spiele("salto");
          comic(ch.x - 1.2, ch.y + 3, "ZACK!");
          meldung((e.anzahl > 1 ? e.anzahl + "× " : "") + "Salto!");
          schwebeText(ch.x, ch.y + 1.8, "+" + e.bonus, "#ffd23f", true);
          konfettiWelt(ch.x, ch.y + 1, 18);
          setzeAusdruck("freude", 1.6);
          FF.Klang.sprich(e.anzahl > 1 ? e.anzahl + " Saltos!" : "Salto!");
          if (P.beifahrer === "wolf" && !demo) {            // der Wolf freut sich mit
            setTimeout(function () { FF.Klang.spiele("heulen"); }, 650);
            schwebeText(ch.x - 0.6, ch.y + 2.6, "Auuu! 🐺", "#cfe3ff");
          }
          break;
        case "looping":
          FF.Klang.spiele("salto");
          meldung("Looping!");
          schwebeText(e.x, e.y + 1.8, "+" + e.bonus, "#ffd23f", true);
          konfettiWelt(e.x, e.y + 1, 14);
          setzeAusdruck("freude", 1.6);
          FF.Klang.sprich("Looping!");
          break;
        case "turbineVoll":
          break;
        case "zuLang":                   // Dampf-Lok: der Zug ist zu lang für den Looping
          meldung("Zu lang für den Looping! 🚂");
          FF.Klang.sprich("Tschu-tschu! Zu lang für den Looping!");
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
          if (!e.voll && ersteMale("tipp-boost", 2)) {
            tipp("🚀 Rakete eingesammelt! Drück den 🚀-Knopf links – dann gibt es Turbo!", 4500, "Rakete! Drück den Raketen-Knopf für Turbo!"); spruchBis = zeit + 3;
          }
          break;
        case "extraBereit":
          FF.Klang.spiele("extraBereit");
          plopp($("knopf-feder"));
          if (ersteMale("tipp-feder", 2)) {
            tipp("🦘 Sprungfeder bereit! Oben auf dem Berg drücken – dann fliegst du weit!", 4500, "Sprungfeder bereit!"); spruchBis = zeit + 3;
          }
          break;
        case "decke":                    // Höhle: an die Decke gestoßen
          FF.Klang.spiele("landung", 0.4 * e.staerke + 0.2);
          for (var dk = 0; dk < 6; dk++) {
            partikel.neu({ art: "staub", x: e.x + (Math.random() - 0.5) * 1.5, y: e.y + 0.3, vx: (Math.random() - 0.5) * 3, vy: -1 - Math.random() * 2,
                           t: 0, dauer: 0.8, r0: 0.08, r1: 0.3, farbe: fahrt.welt.farben.punkte, alpha: 0.7, reibung: 1 });
          }
          break;
        case "wippe":                    // Zirkus: die Wippe schlägt auf
          FF.Klang.spiele("landung", 0.3 + 0.5 * e.staerke);
          break;
        case "netz":                     // Zirkus: vom Hochseil ins Netz gefallen
          schwebeText(ch.x, ch.y + 2, "Ins Netz! 🎪", "#ffd23f", true);
          break;
        case "wolkeFall":                // Wolkeninseln: in die Lücke gefallen
          schwebeText(ch.x, ch.y + 2, "Huiii! ☁️", "#ffffff", true);
          break;
        case "schwapp":                  // Badewanne: Wasser läuft über den Rand
          if (e.menge > 0.03) FF.Klang.spiele("platsch", Math.min(1, e.menge * 8));
          break;
        case "platsch":                  // in eine Pfütze gefahren (Bauernhof: Matsch)
          var matsch = fahrt.welt.wasser && fahrt.welt.wasser.schlamm, schleim = matsch && fahrt.welt.wasser.schleim;
          FF.Klang.spiele(schleim ? "schlurp" : matsch ? "matsch" : "platsch", e.staerke);
          for (var pt = 0; pt < 6 + 10 * e.staerke; pt++) {
            var pw = Math.PI * (0.15 + 0.7 * Math.random()), pv = (matsch ? 1.5 : 2) + Math.random() * (matsch ? 3 : 4) * (0.5 + e.staerke);
            partikel.neu({ art: "tropfen", x: e.x + (Math.random() - 0.5) * 0.8, y: e.y + 0.05, vx: Math.cos(pw) * pv, vy: Math.sin(pw) * pv,
                           t: 0, dauer: 0.7 + Math.random() * 0.3, r0: (matsch ? 0.09 : 0.07) + Math.random() * 0.07,
                           farbe: schleim ? "rgba(120,230,60,0.95)" : matsch ? "rgba(110,72,38,0.95)" : "rgba(190,225,255,0.9)", schwer: 1, reibung: 0.4 });
          }
          if (schleim) {
            if (e.staerke > 0.45) { schwebeText(e.x, e.y + 1.6, "Schlurp! 🟢", "#c6ff7a", false); setzeAusdruck("staunen", 1.2); }
            schleimFleck(2);
            if (ersteMale("tipp-schleim", 2)) FF.Klang.sprich("Iiih, Schleim!");
            break;
          }
          if (e.staerke > 0.55) { schwebeText(e.x, e.y + 1.6, matsch ? "Matsch! 🐷" : "Platsch! 💦", matsch ? "#e8c08a" : "#bfe4ff", false); setzeAusdruck("freude", 1.2); }
          if (ersteMale(matsch ? "tipp-matsch" : "tipp-platsch", 2)) FF.Klang.sprich(matsch ? "Matsch!" : "Platsch!");
          break;
        case "scheune":                  // in die Scheune gefahren
          FF.Klang.spiele("scheune");
          break;
        case "stroh":                    // aus der Scheune hinaus: Stroh fliegt hoch
          FF.Klang.spiele("stroh");
          var vs = Math.max(3, e.tempo || 5);
          for (var st2 = 0; st2 < 34; st2++) {
            partikel.neu({ art: "stroh", x: e.x + Math.random() * 1.2, y: e.y + 0.3 + Math.random() * 2.4,
                           vx: vs * (0.2 + 0.7 * Math.random()) + (Math.random() - 0.5) * 3, vy: 2.5 + Math.random() * 6, t: 0, dauer: 1.3 + Math.random() * 0.8,
                           r0: 0.18 + Math.random() * 0.2, farbe: ["#f2cf5e", "#e6b84a", "#f8e08a"][st2 % 3], schwer: 0.35, reibung: 1.2,
                           w: Math.random() * 6, dreh: (Math.random() - 0.5) * 14 });
          }
          for (var sd = 0; sd < 6; sd++) {
            partikel.neu({ art: "staub", x: e.x + Math.random(), y: e.y + 0.4 + Math.random() * 1.5, vx: vs * 0.3 + (Math.random() - 0.5) * 2, vy: 0.5 + Math.random(),
                           t: 0, dauer: 0.9, r0: 0.2, r1: 0.9, farbe: "#f3dc94", alpha: 0.5, reibung: 1.5 });
          }
          schwebeText(e.x + 1.5, e.y + 3.2, "Stroh! 🌾", "#ffe27a", true);
          setzeAusdruck("freude", 2);
          if (ersteMale("tipp-stroh", 2)) FF.Klang.sprich("Stroh!");
          break;
        case "obst":                     // Obst eingesammelt: Mini-Turbo
          FF.Klang.spiele("obst");
          funkeln(e.x, e.y, "#ffcf6a", 8);
          schwebeText(e.x, e.y + 1.0, ["🍎", "🍐", "🍒", "🍑", "🍊", "🍌", "🍓"][e.art % 7] + " Mini-Turbo!", "#ffcf6a", false);
          setzeAusdruck("freude", 1.4);
          if (ersteMale("tipp-obst", 2)) { tipp("🍎 Lecker! Jedes Obst gibt dir einen kleinen Raketen-Schub.", 4000, "Lecker! Ein kleiner Turbo!"); spruchBis = zeit + 3; }
          break;
        case "eintauchen":               // Chemiewelt: hinein in einen Behälter
          var bkE = e.bk, flE = bkE.fl, farbeE = flE.farbe;
          FF.Klang.spiele("eintauchen", e.staerke);
          for (var pe = 0; pe < 10 + 18 * e.staerke; pe++) {
            var pwe = Math.PI * (0.12 + 0.76 * Math.random()), pve = 2.5 + Math.random() * 5 * (0.4 + e.staerke);
            partikel.neu({ art: "tropfen", x: e.x + (Math.random() - 0.5) * 1.6, y: e.y + 0.05, vx: Math.cos(pwe) * pve, vy: Math.sin(pwe) * pve,
                           t: 0, dauer: 0.8 + Math.random() * 0.4, r0: 0.08 + Math.random() * 0.1, farbe: farbeE, schwer: 1, reibung: 0.4 });
          }
          for (var pb = 0; pb < 10; pb++) partikel.neu({ art: "blase", x: e.x + (Math.random() - 0.5) * 2, y: e.y - 0.5 - Math.random() * 1.5, vx: (Math.random() - 0.5) * 0.6,
                                                     vy: 0.6 + Math.random() * 0.6, t: 0, dauer: 1.2 + Math.random(), r0: 0.06, r1: 0.2, schwer: -0.35, reibung: 1.2 });
          if (e.staerke > 0.35) schwebeText(e.x, e.y + 1.8, ["Platsch!", "Blubb!", "Splash!", "Plumps!"][Math.floor(Math.random() * 4)] + " ⚗️", FF.Grafik.hell(farbeE, 0.35), true);
          setzeAusdruck(e.staerke > 0.5 ? "staunen" : "freude", 1.6);
          if (ersteMale("tipp-becken", 2)) { tipp("⚗️ Im Behälter fährst du wie unter Wasser: alles schwebt, die Brühe bremst. Gib Gas, dann kommst du wieder raus!", 5000, "Platsch! Ab in die " + (flE.name || "Brühe") + "!"); spruchBis = zeit + 3; }
          else if (zeit > spruchBis && Math.random() < 0.5) { FF.Klang.sprich(flE.name ? flE.name + "!" : "Platsch!"); spruchBis = zeit + 3; }
          if (bkE.mixer && ersteMale("tipp-mixer", 1)) tipp("🌀 Achtung, ein Mixer! Er wirbelt dich herum.", 3500);
          else if (bkE.strom && ersteMale("tipp-strom" + (bkE.strom > 0 ? "+" : "-"), 1)) tipp(bkE.strom > 0 ? "➡️ Eine Strömung schiebt dich vorwärts!" : "⬅️ Die Strömung drückt dagegen – gib Gas!", 3500);
          else if (bkE.sprudel && ersteMale("tipp-sprudel", 1)) tipp("🫧 Sprudel! Die Blasen heben dich hoch.", 3500);
          break;
        case "auftauchen":               // Chemiewelt: wieder heraus
          FF.Klang.spiele("auftauchen");
          for (var pa = 0; pa < 8; pa++) partikel.neu({ art: "tropfen", x: ch.x + (Math.random() - 0.5) * 2, y: ch.y + Math.random(), vx: ch.vx * 0.3 + (Math.random() - 0.5) * 2,
                                                    vy: Math.random() * 2, t: 0, dauer: 0.7, r0: 0.06 + Math.random() * 0.06, farbe: e.bk.fl.farbe, schwer: 1, reibung: 0.4 });
          schleimFleck(3, e.bk.fl.farbe);                 // es tropft noch ein bisschen bunt vom Auto
          break;
        case "roehre":                   // hinein in die Röhre
          FF.Klang.spiele("roehre");
          if (e.schlauch) {                               // Chemiewelt: Glasrohr aus dem Behälter
            schwebeText(e.x + 2, e.y + 4, "Schlürf! 🧪", "#ffffff", true);
            setzeAusdruck("freude", 3);
            if (ersteMale("tipp-glasrohr", 2)) { tipp("🧪 Das Glasrohr saugt dich nach oben – mit Gas geht's schneller!", 4500, "Ab durchs Glasrohr nach oben!"); spruchBis = zeit + 3; }
            break;
          }
          schwebeText(e.x + 2, e.y + 4, "Hui! 🌀", "#ffffff", true);
          setzeAusdruck("freude", 3);
          if (ersteMale("tipp-roehre", 2)) { tipp("🌀 Die Röhre fährt dich ganz von allein – mit Gas wirst du schneller!", 4500, "Hui! Ab durch die Röhre!"); spruchBis = zeit + 3; }
          break;
        case "roehrenLoop":              // Looping in der Röhre
          FF.Klang.spiele("salto");
          schwebeText(e.x, e.y + 1.8, "Looping +" + e.bonus, "#ffd23f", false);
          konfettiWelt(e.x, e.y + 1, 8);
          if (ersteMale("tipp-roehrenLoop", 2)) FF.Klang.sprich("Looping!");
          break;
        case "roehreAus":                // Röhre zu Ende
          FF.Klang.spiele("roehreAus");
          break;
        case "boing":                    // Hüpfpilz
          var tStil = fahrt.welt.trampolinStil;
          if (tStil === "taste") {                        // Datenwelt: Enter-Knopf
            FF.Klang.spiele("enter");
            schwebeText(e.x, e.y + 2.2, "Enter! ⏎", "#9ff6ff", true);
            funkeln(e.x, e.y + 0.8, "#9ff6ff", 8);
            setzeAusdruck("freude", 2.5);
            if (ersteMale("tipp-enter", 2)) { tipp("⏎ Enter gedrückt! In der Luft mit Gas und Bremse die Nase gerade halten", 4500, "Enter!"); spruchBis = zeit + 3; }
            break;
          }
          FF.Klang.spiele("boing");
          schwebeText(e.x, e.y + 2.2, tStil === "schleim" ? "Wabbel! 🟢" : tStil === "matte" ? "Boing! 🤸" : "Boing! 🍄", tStil === "schleim" ? "#c6ff7a" : "#ffd23f", true);
          funkeln(e.x, e.y + 0.8, "#ffffff", 8);
          setzeAusdruck("freude", 2.5);
          if (ersteMale("tipp-boing", 2)) {
            tipp((tStil === "schleim" ? "🟢 Wabbel!" : "🍄 Boing!") + " In der Luft mit Gas und Bremse die Nase gerade halten", 4500, tStil === "schleim" ? "Wabbel!" : "Boing!"); spruchBis = zeit + 3;
          }
          break;
        case "objekt":                   // Glas zerspringt, Bausteine fliegen, Säule zerfällt
          var FO = FF.GrafikWelt.STEIN_FARBEN, vo = Math.max(3, e.tempo);
          if (e.art === "glas") {
            FF.Klang.spiele("klirr");
            for (var gs = 0; gs < 11; gs++) partikel.neu({ art: "scherbe", x: e.x + (Math.random() - 0.5) * e.b, y: e.y + Math.random() * e.h,
              vx: vo * (0.3 + Math.random() * 0.6) + (Math.random() - 0.5) * 3, vy: 2 + Math.random() * 4, t: 0, dauer: 0.9 + Math.random() * 0.4,
              r0: 0.12 + Math.random() * 0.14, schwer: 1, reibung: 0.3, w: Math.random() * 6, dreh: (Math.random() - 0.5) * 16 });
            if (ersteMale("tipp-glas", 1)) schwebeText(e.x, e.y + 2, "Klirr! 💎", "#cdf4ff", true);
          } else {
            var saeule = e.art === "saeule", nk = saeule ? 16 : Math.max(2, Math.round(e.h / 0.38) + 1);
            FF.Klang.spiele(saeule ? "einsturz" : "klack");
            for (var ks = 0; ks < nk; ks++) partikel.neu({ art: "klotz", x: e.x + (Math.random() - 0.5) * e.b, y: e.y + Math.random() * e.h,
              vx: (saeule ? 1.5 : vo * 0.6) * (0.4 + Math.random()) + (Math.random() - 0.5) * 3, vy: 2 + Math.random() * (saeule ? 5 : 4), t: 0, dauer: 1.1,
              r0: 0.45 + Math.random() * 0.25, farbe: FO[(e.v + ks) % 6], schwer: 1, reibung: 0.2, w: Math.random() * 6, dreh: (Math.random() - 0.5) * 12 });
            if (saeule) {
              schwebeText(e.x, e.y + e.h + 0.5, "Krawumm! 🧱", "#ffd23f", true);
              if (ersteMale("tipp-saeule", 2)) { tipp("🧱 Baustein-Säulen bremsen dich fast ganz ab – spring drüber oder nimm Anlauf!", 4500, "Krawumm!"); spruchBis = zeit + 3; }
            }
          }
          break;
        case "katapultBereit":           // im Katapult eingefangen
          FF.Klang.spiele("spannen");
          meldung("🎯 Drück Gas!");
          if (ersteMale("tipp-katapult", 3)) FF.Klang.sprich("Drück Gas, dann fliegst du!");
          break;
        case "ladebalken":               // Datenwelt: die Ladebalken-Brücke beginnt zu laden
          FF.Klang.spiele("daten");
          schwebeText(e.x + 1, e.y + 3.2, "Lädt … ⏳", "#9ff6ff", true);
          if (ersteMale("tipp-ladebalken", 2)) { tipp("⏳ Die Brücke lädt noch! Fahr langsam hinter dem Balken her – oder warte, bis sie fertig ist.", 5200, "Warte, bis die Brücke geladen ist!"); spruchBis = zeit + 3; }
          break;
        case "ladebalkenFertig":         // … und ist fertig
          FF.Klang.spiele("stern");
          schwebeText(e.x, e.y + 3.4, "100 % ✅", "#5dffa8", true);
          funkeln(e.x, e.y + 0.6, "#5dffa8", 10);
          break;
        case "papierkorb":               // zu schnell: in den Papierkorb gefallen
          FF.Klang.spiele("fehler");
          schwebeText(e.x, e.y + 2.5, "Papierkorb! 🗑️", "#ffffff", true);
          setzeAusdruck("staunen", 2);
          break;
        case "portal":                   // Kopieren & Einfügen: hinter die Firewall versetzt
          FF.Klang.spiele("enter");
          FF.Klang.spiele("daten");
          for (var pg = 0; pg < 3; pg++) { funkeln(e.x1, e.y1, ["#46f0ff", "#ff5fd2", "#ffffff"][pg], 8); funkeln(e.x2, e.y2, ["#ff5fd2", "#46f0ff", "#ffffff"][pg], 8); }
          schwebeText(e.x1, e.y1 + 2.6, "Kopiert! 📋", "#9ff6ff", true);
          schwebeText(e.x2 + 2, e.y2 + 2.6, "Eingefügt! ✨", "#ffb3f0", true);
          setzeAusdruck("freude", 2.5);
          kameraNachfuehren(0, true);
          if (ersteMale("tipp-portal", 2)) { tipp("📋 Kopieren & Einfügen: Spring durch den Ring – dann bist du hinter der Firewall!", 5200, "Kopiert und eingefügt!"); spruchBis = zeit + 3; }
          break;
        case "katapult":                 // abgeschossen
          FF.Klang.spiele("boing");
          schwebeText(e.x + 2, e.y + 2, "Wuuusch! 🎯", "#ffd23f", true);
          setzeAusdruck("freude", 2.5);
          break;
        case "zelle":                    // Superheldenwelt: durch die Telefonzelle → Heldenumhang
          FF.Klang.spiele("held");
          meldung("Heldenumhang an! 🦸");
          comicBis = 0; comic(e.x + 2, e.y + 4.4, "WUSCH!");
          funkeln(e.x + 1.5, e.y + 1.5, "#ffe14d", 10);
          setzeAusdruck("freude", 2.5);
          if (ersteMale("tipp-umhang", 2)) { tipp("🦸 Mit dem Umhang fällst du in der Luft ganz langsam – gleite über die Lücken!", 4500, "Mit dem Umhang kannst du gleiten!"); spruchBis = zeit + 3; }
          else FF.Klang.sprich("Heldenumhang!");
          break;
        case "katze":                    // Kätzchen gerettet
          FF.Klang.spiele("miau");
          schwebeText(e.x, e.y + 1.2, "Gerettet! 🐱 +" + e.wert, "#ffe27a", true);
          funkeln(e.x, e.y + 0.4, "#ffd1e8", 8);
          setzeAusdruck("freude", 1.6);
          if (ersteMale("tipp-katze", 1)) FF.Klang.sprich("Kätzchen gerettet!");
          break;
        case "umdrehen":                 // Kopfüberwelt: durchs Umdreh-Tor
          FF.Klang.spiele("umdrehen", e.kopf ? 1 : 0);
          meldung(e.kopf ? "Kopfüber! 🙃" : "Wieder richtig herum! 🙂");
          konfettiWelt(e.x, e.y + 2.5, 16);
          setzeAusdruck("staunen", 1.6);
          if (e.kopf && ersteMale("tipp-kopf", 2)) { tipp("🙃 Alles steht kopf! Gas und Bremse sind gleich – und Sprünge gehen nach unten.", 4500, "Alles steht kopf!"); spruchBis = zeit + 3; }
          else FF.Klang.sprich(e.kopf ? "Kopfüber!" : "Wieder richtig herum!");
          break;
        case "spuk":                     // Geisterwelt: ein Geist taucht auf
          FF.Klang.spiele("spuk");
          if (Math.random() < 0.5) setzeAusdruck("staunen", 1.2);
          if (ersteMale("tipp-spuk", 1)) { tipp("👻 Keine Angst – die Geister sind freundlich und wollen nur spielen!", 4000, "Keine Angst, die Geister sind lieb!"); spruchBis = zeit + 3; }
          break;
        case "schwebe":                  // Schwebe-Säule betreten
          FF.Klang.spiele("schwebe");
          schwebeText(e.x, e.y + 2, "Schwerelos! ✨", "#9ff6ff", true);
          funkeln(e.x, e.y + 0.5, "#c9fbff", 8);
          setzeAusdruck("freude", 2.5);
          if (ersteMale("tipp-schwebe", 2)) {
            tipp("✨ In der Säule bist du fast schwerelos! Mit Gas und Bremse drehst du dich – sammle die Münzen oben.", 4500, "Schwerelos!");
            spruchBis = zeit + 3;
          }
          break;
        case "band":                     // Förderband
          if (fahrt.welt.schleimbach) {                   // Schleimwelt: Schleimbach statt Förderband
            FF.Klang.spiele("schlurp", 0.8);
            schwebeText(ch.x, ch.y + 2, "Schleimbach! 🟢", "#c6ff7a", true);
            if (ersteMale("tipp-schleimbach", 2)) { tipp("🟢 Der Schleimbach fließt dir entgegen und klebt – gib kräftig Gas!", 4000, "Schleimbach! Gib Gas!"); spruchBis = zeit + 3; }
            break;
          }
          if (fahrt.welt.datenstrom) {                    // Datenwelt: Datenstrom statt Förderband
            FF.Klang.spiele("daten");
            schwebeText(ch.x, ch.y + 2, "Datenstrom! 💾", "#9ff6ff", true);
            if (ersteMale("tipp-datenstrom", 2)) { tipp("💾 Der Datenstrom nimmt dich mit – mit Gas bist du superschnell!", 4000, "Datenstrom! Ab geht's!"); spruchBis = zeit + 3; }
            break;
          }
          FF.Klang.spiele("band", e.v > 0);
          schwebeText(ch.x, ch.y + 2, e.v > 0 ? "Förderband ⏩" : "Förderband ⏪", e.v > 0 ? "#7dffb8" : "#ffd6a0", true);
          if (ersteMale("tipp-band" + (e.v > 0 ? "+" : "-"), 2)) {
            if (e.v > 0) tipp("⏩ Das Förderband fährt mit – mit Gas bist du doppelt so schnell!", 4000, "Förderband! Gib Gas!");
            else tipp("⏪ Dieses Band läuft rückwärts – gib kräftig Gas!", 4000, "Das Band läuft rückwärts! Gib Gas!");
            spruchBis = zeit + 3;
          }
          break;
        case "wind":                     // Sturm: Rückenwind oder Gegenwind beginnt
          FF.Klang.spiele("windstoss");
          schwebeText(ch.x, ch.y + 2, e.richtung > 0 ? "Rückenwind! 💨" : "Gegenwind! 🌬️", e.richtung > 0 ? "#7dffb8" : "#ffd6a0", true);
          if (ersteMale("tipp-wind" + e.richtung, 2)) {
            if (e.richtung > 0) tipp("💨 Rückenwind schiebt dich – und trägt dich bei Sprüngen weit!", 4000, "Rückenwind!");
            else tipp("🌬️ Gegenwind bremst – gib mehr Gas!", 4000, "Gegenwind! Gib mehr Gas!");
            spruchBis = zeit + 3;
          }
          break;
        case "luftsprung":
          FF.Klang.spiele("luftsprung");
          schwebeText(ch.x, ch.y + 1.5, "Luftsprung +" + e.bonus, "#9fe0ff", false);
          break;
        case "landung":
          FF.Klang.spiele("landung", e.staerke);
          if (e.staerke > 0.45) comic(ch.x + 1.2, ch.y + 2.2);
          fahrt.fz.raeder.forEach(function (R) {
            for (var k = 0; k < 4; k++) {
              partikel.neu({ art: "staub", x: R.k.x + (Math.random() - 0.5) * 0.6, y: R.k.y - R.r + 0.1,
                             vx: (Math.random() - 0.5) * 4, vy: 0.5 + Math.random() * 1.5, t: 0, dauer: 0.7,
                             r0: 0.15, r1: 0.6, farbe: fahrt.werte.kufen && (fahrt.welt.schneeBoden || fahrt.gelaende.schneeBei(R.k.x)) ? "#ffffff" : fahrt.welt.farben.punkte, alpha: 0.7, reibung: 2 });
            }
          });
          break;
        case "hoppla":
          FF.Klang.spiele("hoppla");
          setzeAusdruck("staunen", 3);
          schwebeText(ch.x, ch.y + 1.6, "Hoppla!", "#ffffff", true);
          if (e.bergauf && e.rueckwaerts) {              // am Berg nach hinten gekippt: zu viel Gas
            tipp("⛰️ Am Berg nicht so viel Gas – sonst kippt das Auto nach hinten!", 4500, "Weniger Gas am Berg!");
            spruchBis = zeit + 3;
          }
          break;
        case "bruch":
          // Bruchlandung: viel zu schief zum Hang aufgekommen – sagen, was hilft
          FF.Klang.spiele("hoppla");
          setzeAusdruck("staunen", 3);
          schwebeText(ch.x, ch.y + 1.6, "Bums! 💥", "#ffffff", true);
          if (e.nase === "hoch") {
            tipp("💥 Nase zu hoch ⤴ – in der Luft kurz BREMSEN, dann senkt sie sich!", 4500, "Bums! Die Nase war zu hoch. In der Luft bremsen!");
          } else {
            tipp("💥 Nase zu tief ⤵ – in der Luft GAS geben, dann hebt sie sich!", 4500, "Bums! Die Nase war zu tief. In der Luft Gas geben!");
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
          tipp(e.text, 4000, e.text.replace(/[^\wäöüÄÖÜß!.,\s-]/g, ""));
          break;
        case "geladen":
          if (fahrt.werte.puste) {
            schwebeText(ch.x, ch.y + 1.3, "+💨", "#cfe9ff", false);
            if (!fahrt.ladeTippGezeigt) { fahrt.ladeTippGezeigt = true; tipp("💨 Rollen lassen: Ohne Gas kommt die Puste zurück!", 3500, "Rollen lassen, dann kommt die Puste zurück!"); }
            break;
          }
          schwebeText(ch.x, ch.y + 1.3, "+⚡", "#7dffb8", false);
          if (!fahrt.ladeTippGezeigt) {
            fahrt.ladeTippGezeigt = true;
            tipp("⚡ Bremsen lädt den Akku wieder auf!", 3000, "Bremsen lädt den Akku!");
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
          if (demo) break;                 // Startseiten-Show: kein Ergebnis
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
  function starteFahrt(wi, li, endlos, strecke) {
    FF.Klang.init();
    fahrtInfo = { weltIndex: wi, stufe: li, endlos: !!endlos, strecke: strecke || null };
    kopfLage = 0; schleimFaelle = []; schleimTakt = 2;
    var fs = P.fahrzeuge[P.fahrzeug];
    fahrt = new FF.Fahrt({
      weltIndex: wi, stufe: li, endlos: !!endlos, strecke: strecke || null,
      fahrzeugId: P.fahrzeug, upgrades: fs.upgrades, schwierigkeit: S.einstellungen.schwierigkeit,
      bruchlandung: S.einstellungen.bruchlandung, gasBremseAlt: !!S.entwickler.gasBremseAlt
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
    partikel.liste.length = 0; texte.length = 0; luftTippDieseFahrt = false;
    tippsLeeren();
    wetter.setze(fahrt.welt.wetter, kamera);
    if (!fahrt.welt.nacht) $("nacht-ebene").style.display = "none";
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
    $("hud-tank").classList.toggle("wasserstoff", !!fahrt.def.wasserstoff);
    $("hud-tank").classList.toggle("schnee", !!fahrt.def.schneeTank);
    $("hud-tank").classList.toggle("wasserstoff", !!fahrt.def.wasserstoff || !!fahrt.def.wannenTank);
    $("hud-tank").classList.toggle("zauber", !!fahrt.def.zauberTank);
    $("hud-fortschritt").hidden = !!endlos;
    $("hud-strecke").hidden = !endlos;
    $("hud-geist-strecke").hidden = !(endlos && geist);
    $("hud-fortschritt-auto").src = kindBild(S.aktiv, 40, 40, "normal", true);
    $("hud-fortschritt-geist").hidden = !geist || !!endlos;
    if (geist) $("hud-fortschritt-geist").src = kindBild(geist.kind, 40, 40, "normal", true);
    FF.Klang.motorStart(fahrt.def.klang, fahrt.werte.motor.vmax);
    var w = fahrt.welt;
    // Kaum Schwerkraft: schon wenig Gas hebt die Nase (besonders beim Trecker) – gleich sagen
    var mondHinweis = w.schwerkraft < 3 ? " Auf dem Mond nur sanft Gas geben!" : "";
    var titel = geist ? "👻 Gegen " + genitiv(geist.name) + " Geist!" : strecke ? "✏️ " + strecke.name :
                (endlos ? "♾️ Wie weit kommst du?" : w.emoji + " " + w.name + " " + (li + 1));
    starteCountdown(titel);
    if (mondHinweis) tipp("🌙 Kaum Schwerkraft: nur sanft Gas geben – sonst kippt das Auto nach hinten!", 5000, mondHinweis.trim());
    FF.Klang.setzeUmgebung(w.wetter === "regen" ? "regen" : w.wind ? "wind" : w.unterwasser ? "meer" : null);
    // Neue Spielidee der Welt erklären – die ersten beiden Male je Welt (pro Spielsitzung)
    if (w.tipp && !strecke && S.einstellungen.tipps && ersteMale("welt-" + w.id, 2)) tipp(w.tipp[0], 5500, w.tipp[1]);
    if (H > B && S.einstellungen.ausrichtung !== "hoch") { $("hochkant-hinweis").hidden = false; setTimeout(function () { $("hochkant-hinweis").hidden = true; }, 4500); }
    hudCache = {};
    hudAktualisieren(true);
  }

  /* Start-Ampel: 3 (rot) – 2 (rot) – 1 (rot-gelb) – LOS (grün). Bis dahin steht
     alles still (keine Physik, keine Zeit, kein Geist); Gas geben lässt nur den
     Motor aufheulen. Pause hält auch den Countdown an. */
  var countdown = null, COUNTDOWN_SCHRITT = 0.8;
  function starteCountdown(titel) {
    $("ampel-titel").textContent = titel; $("ampel-titel").style.visibility = "";
    if (window.FF_OHNE_COUNTDOWN) { countdown = null; $("ampel").hidden = true; return; }
    countdown = { t: 0, stufe: -1 };
    $("ampel").hidden = false;
    countdownZeigen(3);
  }
  function countdownZeigen(n) {
    var a = $("ampel");
    a.querySelector(".lampe-rot").classList.toggle("an", n >= 1);
    a.querySelector(".lampe-gelb").classList.toggle("an", n === 1);
    a.querySelector(".lampe-gruen").classList.toggle("an", n === 0);
    var z = $("ampel-zahl");
    z.textContent = n > 0 ? n : "LOS!";
    z.classList.toggle("los", n === 0);
    z.classList.remove("plopp"); void z.offsetWidth; z.classList.add("plopp");
  }
  /* true, solange die Fahrt noch nicht losgehen darf */
  function countdownSchritt(dt) {
    if (!countdown) return false;
    countdown.t += dt;
    var stufe = Math.floor(countdown.t / COUNTDOWN_SCHRITT);         // 0 → „3“ … 3 → „LOS“
    if (stufe !== countdown.stufe) {
      countdown.stufe = stufe;
      if (stufe <= 3) {
        countdownZeigen(3 - stufe);
        FF.Klang.spiele(stufe < 3 ? "ampel" : "ampelLos");
        if (stufe === 3) {
          FF.Klang.sprich("Los!");
          $("ampel-titel").style.visibility = "hidden";
          $("hochkant-hinweis").hidden = true;
          if (tippSchlange.length) tippZeigen.apply(null, tippSchlange.shift());
        }
      }
    }
    if (stufe >= 4) { $("ampel").hidden = true; countdown = null; return false; }
    return stufe < 3;
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
    var schluessel = es.boost + "|" + Math.round(es.boostAn * 40) + "|" + es.federSalti + "|" + es.boostBereit + "|" + es.federBereit + "|" + Math.ceil(es.federSperre);
    if (erzwingen || hudCache.ex !== schluessel) {
      hudCache.ex = schluessel;
      var kb = $("knopf-boost"), kf = $("knopf-feder");
      kb.style.setProperty("--ladung", es.boostAn > 0 ? es.boostAn : (es.boost > 0 ? 1 : 0));
      kb.classList.toggle("bereit", es.boostBereit);
      kb.classList.toggle("an", es.boostAn > 0);
      $("boost-zahl").hidden = es.boost < 2;
      $("boost-zahl").textContent = "×" + es.boost;
      kf.style.setProperty("--ladung", es.feder);
      kf.classList.toggle("bereit", es.federBereit);
      // Abkühlzeit: Sanduhr mit Sekunden, sonst gesammelte Saltos („2/3“)
      $("feder-zahl").hidden = !(es.federSperre > 0) && (es.federSalti === 0 || es.feder >= 1);
      $("feder-zahl").textContent = es.federSperre > 0 ? "⏳" + Math.ceil(es.federSperre) : es.federSalti + "/" + es.federNoetig;
      kf.classList.toggle("abkuehlen", es.federSperre > 0);
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
    starteFahrt(fahrtInfo.weltIndex, fahrtInfo.stufe, fahrtInfo.endlos, fahrtInfo.strecke);
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
    if (fahrtInfo.strecke) { speichere(); return false; }      // eigene Strecke: Münzen ja, Level-Fortschritt nein
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

    var nl = fahrtInfo.strecke ? null : naechstesLevel(wi, li);
    var weiterKnopf = $("knopf-ergebnis-weiter"), nochmalKnopf = $("knopf-ergebnis-nochmal");
    // Level 3 geschafft: Profi-Level als freiwillige zweite Wahl
    $("knopf-ergebnis-profi").hidden = !(e.ziel && li === PROFI - 1 && nl && nl[1] !== PROFI && levelOffen(wi, PROFI));
    if (fahrtInfo.strecke) {                       // eigene Strecke: zurück in den Editor oder nochmal
      weiterKnopf.textContent = "✏️ Weiter malen";
      weiterKnopf.dataset.ziel = "editor";
      nochmalKnopf.hidden = false;
      $("knopf-ergebnis-profi").hidden = true;
    } else if (e.ziel && nl && levelOffen(nl[0], nl[1])) {
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
    if (z === "nochmal") starteFahrt(fahrtInfo.weltIndex, fahrtInfo.stufe, fahrtInfo.endlos, fahrtInfo.strecke);
    else if (z === "editor") { zeigeMenue("fahren"); oeffneEditor(fahrtInfo.strecke); }
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
    starteFahrt(fahrtInfo.weltIndex, fahrtInfo.stufe, fahrtInfo.endlos, fahrtInfo.strecke);
  });
  $("knopf-ergebnis-garage").addEventListener("click", function () { FF.Klang.spiele("klick"); schliesseModal("ergebnis"); zeigeMenue("garage"); });
  $("knopf-ergebnis-menue").addEventListener("click", function () { FF.Klang.spiele("klick"); schliesseModal("ergebnis"); zeigeMenue("fahren"); });

  /* =========================================================================
     9) SPIELERWAHL, MENÜ, WELTEN
     ========================================================================= */
  function zeigeBildschirm(name) {
    if (name !== "titel") showStopp();
    $("titelscreen").hidden = name !== "titel";
    $("spielerwahl").hidden = name !== "wahl";
    $("menue").hidden = name !== "menue";
    $("hud").hidden = name !== "fahrt";
    $("pedale").hidden = name !== "fahrt";
    $("extras").hidden = name !== "fahrt";
    if (name !== "fahrt") { countdown = null; $("ampel").hidden = true; }
    pedaleLuft = false; $("pedale").classList.remove("luft");
    if (name !== "fahrt") {
      $("meldung").hidden = true; tippsLeeren(); $("hochkant-hinweis").hidden = true;
      FF.Klang.motorStopp();
      $("nacht-ebene").style.display = "none";
      fahrt = null; aufnahme = null; geist = null;
    }
  }

  /* "Wer fährt?" – Fiete, Jonte oder zu zweit */
  function zeigeSpielerwahl() {
    modus = "wahl";
    duell = null;
    zeigeBildschirm("wahl");
    var html = "";
    paar().forEach(function (k) {
      var prof = S.spieler[k.id];
      html += '<button type="button" class="wahl-karte" data-kind="' + k.id + '">' +
              '<img class="wahl-bild" src="' + kindBild(k.id, 130, 140, "freude") + '" alt="">' +
              '<span class="wahl-name">' + k.name + "</span>" +
              '<span class="wahl-info">🪙 ' + zahl(prof.muenzen) + " · ⭐ " + sterneSumme(prof) + "</span></button>";
    });
    html += '<button type="button" class="wahl-karte zu-zweit" data-zuzweit="1">' +
            '<span class="wahl-paar">' + paar().map(function (k) {
              return '<img src="' + kindBild(k.id, 70, 70, "freude", true) + '" alt="">';
            }).join("") + "</span>" +
            '<span class="wahl-name">Zu zweit</span><span class="wahl-info">👻 Geisterrennen</span></button>';
    // Eigene Charaktere: je ein Kärtchen mit Zahnrad, dahinter „＋“, solange ein Platz frei ist
    var frei = null;
    C.kinder.forEach(function (k) {
      if (!k.eigen) return;
      if (!S.eigene[k.id].aktiv) { if (!frei) frei = k.id; return; }
      var pe = S.spieler[k.id];
      html += '<div role="button" tabindex="0" class="wahl-karte eigen" data-kind="' + k.id + '">' +
              '<img class="wahl-bild" src="' + kindBild(k.id, 130, 140, "freude") + '" alt="">' +
              '<span class="wahl-name">' + k.name + "</span>" +
              '<span class="wahl-info">🪙 ' + zahl(pe.muenzen) + " · ⭐ " + sterneSumme(pe) + "</span>" +
              '<button type="button" class="wahl-zahnrad" data-eigen-einstellen="' + k.id + '" aria-label="' + k.name + ' einstellen">⚙️</button></div>';
    });
    if (frei) {
      html += '<button type="button" class="wahl-karte eigen neu" data-eigen-einstellen="' + frei + '">' +
              '<span class="wahl-plus">＋</span><span class="wahl-name">Neu</span><span class="wahl-info">⚙️ Charakter bauen</span></button>';
    }
    var el = $("spielerwahl-karten");
    el.innerHTML = html;
    var anzahl = el.querySelectorAll(".wahl-karte").length;
    el.classList.toggle("vier", anzahl <= 4);
    el.classList.toggle("viele", anzahl > 4);
    el.querySelectorAll(".wahl-zahnrad").forEach(function (z) {
      z.addEventListener("click", function (ev) { ev.stopPropagation(); FF.Klang.init(); FF.Klang.spiele("klick"); oeffneEigen(z.dataset.eigenEinstellen); });
    });
    el.querySelectorAll(".wahl-karte").forEach(function (b) {
      b.addEventListener("click", function () {
        FF.Klang.init(); FF.Klang.spiele("klick");
        if (b.dataset.eigenEinstellen) { oeffneEigen(b.dataset.eigenEinstellen); return; }
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

  /* Dialog „Eigener Charakter“: Name, Junge/Mädchen, Haare (kurz/mittel/lang),
     Haarfarbe, Augenfarbe, Hautfarbe – mit Live-Vorschau */
  var eigenEntwurf = null, eigenId = "eigen";
  var EIGEN_ZEILEN = [
    { k: "geschlecht", titel: "Ich bin", werte: { m: "👦 Junge", w: "👧 Mädchen" } },
    { k: "haare", titel: "Haare", werte: { kurz: "✂️ Kurz", mittel: "💇 Mittel", lang: "🦁 Lang" } },
    { k: "haarfarbe", titel: "Haarfarbe", farben: "haar" },
    { k: "augen", titel: "Augenfarbe", farben: "augen" },
    { k: "haut", titel: "Hautfarbe", farben: "haut" }
  ];
  function eigenVorschau() {
    FF.Kinder.setzeEigenes(eigenId, eigenEntwurf);
    var c = document.createElement("canvas"); c.width = 260; c.height = 280;
    var g = c.getContext("2d"); g.scale(2, 2);
    var kind = { id: eigenId, name: eigenEntwurf.name || "Ich", groesse: 0.04, breite: 0.93, eigen: true };
    FF.Grafik.zeichnePortrait(g, 130, 140, { outfit: outfitWert(S.spieler[eigenId].outfit), kind: kind }, "freude", 0.4, false);
    $("eigen-vorschau").src = c.toDataURL();
  }
  function baueEigenWahl() {
    var EF = FF.Kinder.EIGEN_FARBEN, html = "";
    EIGEN_ZEILEN.forEach(function (z) {
      html += '<div class="eigen-zeile"><span class="eigen-zeile-titel">' + z.titel + '</span><div class="eigen-knoepfe">';
      if (z.werte) Object.keys(z.werte).forEach(function (w) {
        html += '<button type="button" class="eigen-knopf' + (eigenEntwurf[z.k] === w ? " aktiv" : "") + '" data-k="' + z.k + '" data-w="' + w + '">' + z.werte[w] + "</button>";
      });
      else Object.keys(EF[z.farben]).forEach(function (w) {
        var f = EF[z.farben][w], farbe = Array.isArray(f.farbe) ? f.farbe[0] : f.farbe;
        html += '<button type="button" class="eigen-farbe' + (eigenEntwurf[z.k] === w ? " aktiv" : "") + '" data-k="' + z.k + '" data-w="' + w +
                '" style="background:' + farbe + '" aria-label="' + f.name + '" title="' + f.name + '"></button>';
      });
      html += "</div></div>";
    });
    $("eigen-wahl").innerHTML = html;
    $("eigen-wahl").querySelectorAll("[data-k]").forEach(function (b) {
      b.addEventListener("click", function () {
        FF.Klang.spiele("klick");
        eigenEntwurf[b.dataset.k] = b.dataset.w;
        baueEigenWahl(); eigenVorschau();
      });
    });
  }
  function oeffneEigen(id) {
    eigenId = id || "eigen";
    eigenEntwurf = JSON.parse(JSON.stringify(S.eigene[eigenId]));
    $("eigen-name").value = eigenEntwurf.name || "";
    $("eigen-ausblenden").hidden = !S.eigene[eigenId].aktiv;
    baueEigenWahl(); eigenVorschau();
    oeffneModal("eigen-dialog");
  }
  function schliesseEigen() {
    schliesseModal("eigen-dialog");
    FF.Kinder.setzeEigenes(eigenId, S.eigene[eigenId]);   // Entwurf verwerfen
    eigenEntwurf = null;
  }
  $("eigen-name").addEventListener("input", function () {
    if (eigenEntwurf) eigenEntwurf.name = this.value.replace(/[<>&"]/g, "").slice(0, 14);
  });
  $("eigen-zu").addEventListener("click", function () { FF.Klang.spiele("klick"); schliesseEigen(); });
  $("eigen-fertig").addEventListener("click", function () {
    var neu = !S.eigene[eigenId].aktiv;
    eigenEntwurf.name = ($("eigen-name").value || "").replace(/[<>&"]/g, "").trim().slice(0, 14);
    eigenEntwurf.aktiv = true;
    S.eigene[eigenId] = eigenEntwurf; eigenEntwurf = null;
    eigenAnwenden(); speichere();
    schliesseModal("eigen-dialog");
    FF.Klang.spiele("kauf");
    FF.Klang.sprich(neu ? "Hallo " + kindDef(eigenId).name + "!" : "Gespeichert!");
    if (modus === "wahl") zeigeSpielerwahl();
  });
  $("eigen-ausblenden").addEventListener("click", function () {
    FF.Klang.spiele("klick");
    S.eigene[eigenId].aktiv = false;             // Profil (Münzen, Garage, Level) bleibt erhalten
    eigenAnwenden(); P = S.spieler[S.aktiv]; speichere();
    schliesseModal("eigen-dialog"); eigenEntwurf = null;
    popover("🙈 Ausgeblendet – Münzen und Level bleiben gespeichert", 2600);
    if (modus === "wahl") zeigeSpielerwahl();
  });

  var aktiverTab = "fahren";
  function zeigeMenue(tab) {
    modus = "menue";
    zeigeBildschirm("menue");
    var tabFahren = spielModus === "duell" ? ["👫", "Rennen"] : ["🏁", "Fahren"];
    $("tab-knopf-fahren").innerHTML = tabFahren[0] + '<span class="tab-wort"> ' + tabFahren[1] + "</span>";
    $("tab-knopf-fahren").setAttribute("aria-label", tabFahren[1]);
    waehleTab(tab || aktiverTab);
    kontoAktualisieren();
    if (aktiverTab === "fahren" && spielModus !== "duell") zeigeNaechstesLevel();
  }

  /* Bei 18 Welten liegt das nächste Level oft weit unten: die Liste dorthin
     scrollen (nur wenn die Welt-Karte nicht ohnehin schon zu sehen ist) */
  function zeigeNaechstesLevel() {
    var knopf = document.querySelector("#welten-liste .level-knopf.naechstes");
    var box = knopf && knopf.closest(".menue-inhalt"), karte = knopf && knopf.closest(".welt-karte");
    if (!box || !karte) return;
    var k = karte.getBoundingClientRect(), b = box.getBoundingClientRect();
    if (k.top >= b.top && k.bottom <= b.bottom) return;
    box.scrollTop = Math.max(0, box.scrollTop + k.top - b.top - Math.max(8, (b.height - k.height) * 0.3));
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
    if (S.entwickler.editor) {                      // Strecken-Editor (noch versteckt: nur über den Entwickler-Bereich)
      var eigene = (S.strecken || []).slice(0, 4);
      html += '<div class="welt-karte editor-karte"><div class="welt-kopf" style="background:linear-gradient(135deg,#ffd23f,#ff8a5c 70%,#8e5bd8)">' +
        '<span class="welt-emoji">✏️</span><div><div class="welt-name">Eigene Strecke</div>' +
        '<div class="welt-hinweis">Male deine Strecke mit dem Finger – und fahr sie!</div></div></div><div class="welt-level">' +
        '<button type="button" class="level-knopf editor-oeffnen" data-strecke="-1" aria-label="Strecke malen">🖌️<small>Malen</small></button>' +
        eigene.map(function (st, i) {
          return '<button type="button" class="level-knopf editor-oeffnen" data-strecke="' + i + '" data-fahren="1" aria-label="' + st.name + ' fahren">' +
                 C.welten[Math.max(0, SP.weltIndex(st.welt))].emoji + "<small>" + st.name.replace("Strecke ", "Nr. ") + "</small></button>";
        }).join("") + "</div></div>";
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
    el.querySelectorAll(".editor-oeffnen").forEach(function (b) {
      b.addEventListener("click", function () {
        FF.Klang.spiele("klick");
        var st = (S.strecken || [])[+b.dataset.strecke];
        if (st && b.dataset.fahren) starteFahrt(Math.max(0, SP.weltIndex(st.welt)), 1, false, st);
        else oeffneEditor(st || null);
      });
    });
    el.querySelectorAll(".level-knopf:not(.editor-oeffnen)").forEach(function (b) {
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

  /* Strecken-Editor (editor.js) */
  function oeffneEditor(strecke) {
    if (!Array.isArray(S.strecken)) S.strecken = [];
    FF.Editor.oeffne({
      strecken: S.strecken, strecke: strecke,
      speichern: function () { speichere(); },
      fahren: function (st) { starteFahrt(Math.max(0, SP.weltIndex(st.welt)), 1, false, st); },
      schliessen: function () { baueWelten(); },
      klick: function () { FF.Klang.init(); FF.Klang.spiele("klick"); }
    });
  }

  /* =========================================================================
     10) GEISTERRENNEN ZU ZWEIT
     Ablauf: Lobby (Autos + Strecke) → wer fängt an (wählen oder würfeln) →
     Übergabe → Fahrt 1 (wird aufgezeichnet) → Übergabe → Fahrt 2 gegen den
     Geist → Siegerehrung → Revanche (andere Reihenfolge).
     ========================================================================= */
  function stueckOffen(wi, li, endlos) {
    return paar().some(function (k) {
      var p = S.spieler[k.id];
      return endlos ? endlosOffen(wi, p) : levelOffen(wi, li, p);
    });
  }

  function siegStand() {
    var a = paar()[0], b = paar()[1];
    return "🏆 " + a.name + " " + (S.duell.siege[a.id] || 0) + " : " + (S.duell.siege[b.id] || 0) + " " + b.name;
  }

  function baueLobby() {
    var D = S.duell;
    if (!stueckOffen(D.welt, D.stufe, D.endlos)) { D.welt = 0; D.stufe = 0; D.endlos = false; }
    $("duell-spielerwahl").innerHTML = paar().map(function (k) {
      return '<img src="' + kindBild(k.id, 40, 40, "normal", true) + '" alt="">';
    }).join("");
    $("duell-stand").textContent = siegStand();

    // Wer fährt gegen wen? (nur sichtbar, wenn es mehr als zwei Fahrer gibt)
    var alle = verfuegbar(), ids = paar().map(function (k) { return k.id; });
    $("duell-paarung").hidden = alle.length <= 2;
    $("duell-paarung").innerHTML = '<span class="duell-paarung-titel">Wer gegen wen?</span>' + alle.map(function (k) {
      return '<button type="button" class="garage-kind' + (ids.indexOf(k.id) >= 0 ? " aktiv" : "") + '" data-paar="' + k.id + '">' +
             '<img src="' + kindBild(k.id, 40, 40, "normal", true) + '" alt="">' + k.name + "</button>";
    }).join("");
    $("duell-paarung").querySelectorAll("[data-paar]").forEach(function (b) {
      b.addEventListener("click", function () {
        var id = b.dataset.paar, P2 = paar().map(function (k) { return k.id; });
        if (P2.indexOf(id) >= 0) return;
        FF.Klang.spiele("klick");
        S.duell.paar = [P2[1], id];                      // der zuerst gewählte macht Platz
        speichere(); baueLobby();
      });
    });

    // Die beiden Fahrer mit ihren Autos
    $("duell-spieler").innerHTML = paar().map(function (k) {
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
    $("duell-start").innerHTML = paar().map(function (k) {
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
    el.innerHTML = '<span class="garage-kinder-titel">Wessen Garage?</span>' + paar().map(function (k) {
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
    $("wuerfel-reihe").innerHTML = paar().map(function (k) {
      return '<div class="wuerfel-spalte"><img src="' + kindBild(k.id, 60, 60, "normal", true) + '" alt="">' +
             '<span class="wuerfel-name">' + k.name + '</span><div class="wuerfel rollt" id="wuerfel-' + k.id + '">' + wuerfelHtml(1) + "</div></div>";
    }).join("");
    $("wuerfel-text").textContent = "Die Würfel rollen …";
    oeffneModal("wuerfeln");
    FF.Klang.sprich("Wer fängt an?");
    var runde = function () {
      var t0 = performance.now(), werte = {};
      var tick = setInterval(function () {
        paar().forEach(function (k) {
          werte[k.id] = 1 + Math.floor(Math.random() * 6);
          var w = $("wuerfel-" + k.id);
          w.innerHTML = wuerfelHtml(werte[k.id]);
          w.classList.add("rollt");
        });
        FF.Klang.spiele("zaehlen");
        if (performance.now() - t0 > 1300) {
          clearInterval(tick);
          paar().forEach(function (k) { $("wuerfel-" + k.id).classList.remove("rollt"); });
          FF.Klang.spiele("stern", 1);
          var a = paar()[0], b = paar()[1];
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
    var mGes = w.masse + w.raeder.reduce(function (s, r) { return s + r.masse; }, 0) + (w.glieder || []).reduce(function (s, g) { return s + g.masse; }, 0);
    var nA = 0, rA = 0;
    w.raeder.forEach(function (r) { if (r.antrieb) { nA++; rA += r.r; } });
    rA /= nA;
    if (w.wanne) return [                                     // Badewanne: der Wasserstrahl schiebt
      ["🏎️ Tempo", w.wanne.vmax / 34],
      ["💪 Kraft", w.wanne.schub / 9.81 / 1.1],
      ["🛞 Grip", w.grip / 1.9],
      ["🌀 Federung", (w.federung.weg / 0.75) * 0.6 + w.federung.daempfung * 0.4],
      ["🛁 Badewasser", w.tankSekunden / 70],
      ["🤸 Saltos", w.luftsteuerung / 9]
    ];
    if (w.zauber) return [                                    // Fliegender Teppich: Zauberwind statt Motor
      ["🏎️ Tempo", w.zauber.vmax / 34],
      ["💪 Kraft", w.zauber.schub / 9.81 / 1.1],
      ["🧶 Halt", 0.25 + w.schweben.mu * 2],
      ["☁️ Schweben", (w.federung.weg / 0.75) * 0.6 + w.federung.daempfung * 0.4],
      ["✨ Zauberstaub", w.tankSekunden / 70],
      ["🤸 Saltos", w.luftsteuerung / 9]
    ];
    if (w.feuer) return [                                     // Feuerkutsche: das Feuerrohr schiebt
      ["🏎️ Tempo", w.feuer.vmax / 34],
      ["💪 Kraft", w.feuer.schub / 9.81 / 1.1],
      ["🛞 Grip", w.grip / 1.9],
      ["🌀 Federung", (w.federung.weg / 0.75) * 0.6 + w.federung.daempfung * 0.4],
      ["⛽ Tank", w.tankSekunden / 70],
      ["🤸 Saltos", w.luftsteuerung / 9]
    ];
    if (w.luftkissen) return [                                // Luftkissenboot: der Propeller schiebt
      ["🏎️ Tempo", w.luftkissen.vmax / 34],
      ["💪 Kraft", w.luftkissen.schub / 9.81 / 1.1],
      ["🛟 Halt", 0.25 + w.schweben.mu * 2],
      ["☁️ Schweben", (w.federung.weg / 0.75) * 0.6 + w.federung.daempfung * 0.4],
      ["⛽ Tank", w.tankSekunden / 70],
      ["🤸 Saltos", w.luftsteuerung / 9]
    ];
    if (w.kufen) return [                                     // Schnee-Schlitten: keine angetriebenen Räder
      ["🏎️ Tempo", w.propeller.vmax / 34],
      ["💪 Kraft", w.propeller.schub / 9.81 / 1.1],
      ["🛷 Gleiten", 0.9],
      ["🌀 Federung", 0.15],
      ["❄️ Schnee-Tank", w.tankSekunden / 70],
      ["🤸 Saltos", w.luftsteuerung / 9]
    ];
    return [
      ["🏎️ Tempo", w.motor.vmax / 34],
      ["💪 Kraft", (w.motor.drehmoment / rA) / (mGes * 9.81) / 1.1],
      ["🛞 Grip", (w.grip * (nA === w.raeder.length ? 1.25 : 1)) / 1.9],
      ["🌀 Federung", (w.federung.weg / 0.75) * 0.6 + w.federung.daempfung * 0.4],
      [def.akku ? "🔋 Akku" : def.wasserstoff ? "💧 H₂-Tank" : def.puste ? "💨 Puste" : "⛽ Tank", w.tankSekunden / 70],
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
      if (key === "tank" && def.puste) U = { name: "Puste", icon: "💨", text: "Mehr Puste – weiter laufen", stufen: U.stufen };
      if (key === "motor" && def.propeller) U = { name: "Propeller", icon: "🌀", text: "Größerer Propeller – schiebt kräftiger", stufen: U.stufen };
      if (key === "motor" && def.fussAntrieb) U = { name: "Turnschuhe", icon: "👟", text: "Schnellere Füße – mehr Kraft beim Laufen", stufen: U.stufen };
      if (key === "tank" && def.wannenTank) U = { name: "Badewasser", icon: "🛁", text: "Größere Wanne – mehr Wasser", stufen: U.stufen };
      if (key === "motor" && def.wanne) U = { name: "Abfluss", icon: "🚿", text: "Weiterer Abfluss – kräftigerer Strahl", stufen: U.stufen };
      if (key === "tank" && def.schneeTank) U = { name: "Schnee-Tank", icon: "❄️", text: "Mehr Schnee im Tank – weiter rodeln", stufen: U.stufen };
      if (key === "tank" && def.wasserstoff) U = { name: "H₂-Tank", icon: "💧", text: "Größere Wasserstoff-Tanks – weiter fahren", stufen: U.stufen };
      if (def.upgradeNamen && def.upgradeNamen[key]) { var UN = def.upgradeNamen[key]; U = { name: UN.name, icon: UN.icon, text: UN.text, stufen: U.stufen }; }
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

    // Farben (dazu: eigene Farbe mit Farbwähler, Farbverlauf aus zwei Farben)
    var fl = $("farb-liste"), ae = aussehenVon(S.aktiv, def.id);
    fl.innerHTML = C.farben.map(function (f) {
      var hat = P.farben.indexOf(f.id) >= 0, inhalt = "";
      var bg = f.wert === "regenbogen" ? "conic-gradient(#ff5b5b,#ffd23f,#3cc35a,#2f6fd6,#8e5bd8,#ff5b5b)"
             : f.glanz ? "linear-gradient(135deg,#c9962a,#fff6c8,#d9a83a)" : f.wert;
      if (f.wert === "eigene") {
        bg = fs.farbe === "eigene" ? ae.farbe : "radial-gradient(circle,#fff 0 22%,transparent 23%),conic-gradient(#ff5b5b,#ffd23f,#3cc35a,#1fc7c1,#2f6fd6,#8e5bd8,#ff5b5b)";
        inhalt = fs.farbe === "eigene" ? "" : "🎨";
      }
      if (f.wert === "verlauf") {
        var V = fs.farbe === "verlauf" ? ae.verlauf : { a: "#2f6fd6", b: "#ffd23f", r: "vh" };
        bg = "linear-gradient(" + (V.r === "ou" ? "180deg" : "270deg") + "," + V.a + "," + V.b + ")";
      }
      return '<button type="button" class="farb-knopf' + (inhalt ? " eigen-knopf" : "") + (fs.farbe === f.id ? " aktiv" : "") + (hat ? "" : " gesperrt") +
             '" data-farbe="' + f.id + '" data-preis="🪙' + zahl(f.preis) + '" style="background:' + bg + '" aria-label="' + f.name + '">' + inhalt + '</button>';
    }).join("");
    farbEditor(def, fs, ae);
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
    kachelAuswahl("muster-liste", C.muster, P.muster, function () { return fs.muster; }, function (id) { fs.muster = id; });

    // Spur, Felgen, Beifahrer: gelten für alle Fahrzeuge, jedes Kind hat seine eigenen
    $("spur-titel").textContent = "💫 " + genitiv(name) + " Spur";
    $("felgen-titel").textContent = "🛞 " + genitiv(name) + " Felgen";
    $("beifahrer-titel").textContent = "🐾 " + genitiv(name) + " Beifahrer";
    kachelAuswahl("spur-liste", C.spuren, P.spuren, function () { return P.spur; }, function (id) { P.spur = id; });
    kachelAuswahl("felgen-liste", C.felgen, P.felgen, function () { return P.felge; }, function (id) { P.felge = id; });
    kachelAuswahl("beifahrer-liste", C.beifahrer, P.beifahrerListe, function () { return P.beifahrer; }, function (id) { P.beifahrer = id; });
  }

  /* Farbwähler für „Eigene Farbe“ und „Farbverlauf“ (nur sichtbar, wenn gewählt). Beim Ziehen
     im Farbwähler ('input') ändert sich nur das Profil – die Vorschau malt jedes Bild neu;
     erst beim Loslassen ('change') wird gespeichert und die Garage neu aufgebaut. */
  function farbEditor(def, fs, ae) {
    var ed = $("farb-editor"), art = fs.farbe;
    if (art !== "eigene" && art !== "verlauf") { ed.hidden = true; ed.innerHTML = ""; return; }
    ed.hidden = false;
    var feld = function (id, titel, wert) {
      return '<label class="farb-feld">' + titel + ' <input type="color" id="' + id + '" value="' + wert + '"></label>';
    };
    if (art === "eigene") {
      ed.innerHTML = feld("farbe-eigen", "🎨 Deine Farbe", ae.farbe);
      var e1 = $("farbe-eigen");
      e1.addEventListener("input", function () { fs.eigeneFarbe = e1.value.toLowerCase(); });
      e1.addEventListener("change", function () { fs.eigeneFarbe = e1.value.toLowerCase(); speichere(); baueGarage(); });
      return;
    }
    var V = ae.verlauf, ou = V.r === "ou";
    ed.innerHTML = feld("verlauf-a", ou ? "⬆️ Oben" : "➡️ Vorne", V.a) + feld("verlauf-b", ou ? "⬇️ Unten" : "⬅️ Hinten", V.b) +
      '<div class="farb-richtung"><button type="button" data-r="vh" class="' + (ou ? "" : "aktiv") + '">↔️ Vorne – Hinten</button>' +
      '<button type="button" data-r="ou" class="' + (ou ? "aktiv" : "") + '">↕️ Oben – Unten</button>' +
      '<button type="button" data-r="tausch" aria-label="Farben tauschen">🔄</button></div>';
    var setze = function () { fs.verlauf = { a: $("verlauf-a").value.toLowerCase(), b: $("verlauf-b").value.toLowerCase(), r: (fs.verlauf && fs.verlauf.r) || V.r }; };
    ["verlauf-a", "verlauf-b"].forEach(function (id) {
      $(id).addEventListener("input", setze);
      $(id).addEventListener("change", function () { setze(); speichere(); baueGarage(); });
    });
    ed.querySelectorAll(".farb-richtung button").forEach(function (b) {
      b.addEventListener("click", function () {
        FF.Klang.spiele("klick"); setze();
        if (b.dataset.r === "tausch") { var t = fs.verlauf.a; fs.verlauf.a = fs.verlauf.b; fs.verlauf.b = t; }
        else fs.verlauf.r = b.dataset.r;
        speichere(); baueGarage();
      });
    });
  }

  /* Gleichmäßiges Kachelraster: Symbol, Name, Preis (oder ✓ gekauft) */
  function kachelAuswahl(elId, liste, besitz, aktuell, waehle) {
    var el = $(elId);
    el.innerHTML = liste.map(function (e) {
      var hat = besitz.indexOf(e.id) >= 0;
      return '<button type="button" class="kachel' + (aktuell() === e.id ? " aktiv" : "") + (hat ? "" : " zu") + '" data-id="' + e.id + '" aria-label="' + e.name + '">' +
             '<span class="kachel-icon">' + e.icon + '</span><span class="kachel-name">' + e.name + "</span>" +
             (hat ? "" : '<span class="kachel-preis">🪙' + zahl(e.preis) + "</span>") + "</button>";
    }).join("");
    el.querySelectorAll(".kachel").forEach(function (b) {
      b.addEventListener("click", function () {
        var id = b.dataset.id, e = liste.filter(function (x) { return x.id === id; })[0];
        if (besitz.indexOf(id) < 0) { kaufe(e.preis, function () { besitz.push(id); waehle(id); }, b); return; }
        FF.Klang.spiele("klick");
        waehle(id); speichere(); baueGarage();
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
    FF.Klang.setzeHandyTon(S.einstellungen.tonHandy);
    FF.Klang.setzeAn(S.einstellungen.ton);
    FF.Klang.setzeSprache(S.einstellungen.sprache);
    ausrichtungAnwenden();
  }
  /* Bildschirm-Ausrichtung (nur in der installierten App): Das Manifest gibt Querformat
     vor; screen.orientation.lock() überschreibt das zur Laufzeit. Im Browser-Tab geht das
     nur im Vollbild, auf iPhone/iPad gar nicht – dort bleibt die Auswahl verborgen. */
  var ALS_APP = ["fullscreen", "standalone"].some(function (m) {
    return window.matchMedia && window.matchMedia("(display-mode: " + m + ")").matches;
  });
  var AUSRICHTUNG_MOEGLICH = ALS_APP && !!(screen.orientation && screen.orientation.lock) &&
    !/iphone|ipad|ipod/i.test(navigator.userAgent);
  function ausrichtungAnwenden() {
    if (!AUSRICHTUNG_MOEGLICH) return;
    var art = { quer: "landscape", hoch: "portrait", auto: "any" }[S.einstellungen.ausrichtung] || "landscape";
    try { screen.orientation.lock(art).catch(function () { /* Gerät erlaubt es nicht */ }); } catch (e) { /* egal */ }
  }
  $("ausrichtung-gruppe").hidden = !AUSRICHTUNG_MOEGLICH;
  ausrichtungAnwenden();
  document.addEventListener("visibilitychange", function () { if (!document.hidden) ausrichtungAnwenden(); });
  document.querySelectorAll("[data-setting]").forEach(function (b) {
    b.addEventListener("click", function () {
      FF.Klang.init(); FF.Klang.spiele("klick");
      S.einstellungen[b.dataset.setting] = b.dataset.wert; speichere(); einstellungenAnzeigen();
      if (b.dataset.setting === "ausrichtung") ausrichtungAnwenden();
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
  $("knopf-ton-test").addEventListener("click", function () {
    FF.Klang.init();
    if (!S.einstellungen.ton) { S.einstellungen.ton = true; speichere(); einstellungenAnwenden(); einstellungenAnzeigen(); }
    FF.Klang.spiele("ziel");
    if (S.einstellungen.sprache) FF.Klang.sprich("Hallo! Hörst du mich?");
    var z = $("ton-zustand");
    z.textContent = FF.Klang.tonZustand();
    setTimeout(function () { z.textContent = FF.Klang.tonZustand(); }, 700);   // resume() braucht einen Moment
  });
  function oeffneEinstellungen() { FF.Klang.init(); FF.Klang.spiele("klick"); einstellungenAnzeigen(); codeAnzeigen(); oeffneModal("einstellungen"); }

  /* Spielstand-Code (spielstand.js): anzeigen, kopieren, teilen, eingeben */
  function codeAnzeigen() {
    $("spielstand-code").textContent = SP.codeErzeugen(S);
    $("code-eingabe").hidden = true; $("code-fehler").textContent = "";
  }
  $("code-teilen").hidden = !navigator.share;
  $("safari-warnung").hidden = !(/iphone|ipad|ipod/i.test(navigator.userAgent) && !navigator.standalone && !ALS_APP);
  function codeText() { return $("spielstand-code").textContent; }
  $("code-kopieren").addEventListener("click", function () {
    FF.Klang.spiele("klick");
    var fertig = function () { popover("📋 Code kopiert! Schick ihn dir selbst, dann ist er sicher.", 2600); };
    var notfall = function () {                                   // ältere Browser: Text markieren und kopieren
      var t = document.createElement("textarea"); t.value = codeText(); t.setAttribute("readonly", "");
      t.style.position = "fixed"; t.style.opacity = "0"; document.body.appendChild(t); t.select();
      try { document.execCommand("copy"); fertig(); } catch (e) { popover("Bitte den Code markieren und kopieren.", 2600); }
      t.remove();
    };
    if (navigator.clipboard && navigator.clipboard.writeText) navigator.clipboard.writeText(codeText()).then(fertig, notfall);
    else notfall();
  });
  $("code-teilen").addEventListener("click", function () {
    FF.Klang.spiele("klick");
    navigator.share({ title: "Fiete Flitzer – Spielstand", text: "Spielstand-Code für Fiete Flitzer (Einstellungen → 💾 → Code eingeben):\n" + codeText() })
      .catch(function () { /* abgebrochen */ });
  });
  $("code-eingeben").addEventListener("click", function () {
    FF.Klang.spiele("klick");
    $("code-eingabe").hidden = !$("code-eingabe").hidden;
    if (!$("code-eingabe").hidden) $("code-feld").focus();
  });
  $("code-laden").addEventListener("click", function () {
    var r = SP.codeLesen($("code-feld").value, S);
    if (!r.ok) { FF.Klang.spiele("fehler"); $("code-fehler").textContent = r.fehler; wackeln($("code-feld")); return; }
    $("code-fehler").textContent = "";
    var info = C.kinder.map(function (k) { return k.name + " " + zahl(r.stand.spieler[k.id].muenzen) + " 🪙"; }).join(", ");
    elternFrage("Spielstand aus dem Code laden (" + info + ")? Der jetzige wird ersetzt.", function () {
      S = r.stand; eigenAnwenden(); P = S.spieler[S.aktiv]; speichere();
      bildCache = {};
      $("code-feld").value = "";
      schliesseModal("einstellungen");
      einstellungenAnwenden();
      FF.Klang.spiele("kauf");
      popover("💾 Spielstand geladen – willkommen zurück!", 3000);
      if (modus === "menue" || modus === "wahl") zeigeSpielerwahl();
    });
  });
  $("knopf-einstellungen").addEventListener("click", oeffneEinstellungen);
  $("knopf-titel-einstellungen").addEventListener("click", oeffneEinstellungen);
  $("knopf-spielerwahl-einstellungen").addEventListener("click", oeffneEinstellungen);
  ["einstellungen-zu", "einstellungen-fertig"].forEach(function (id) {
    $(id).addEventListener("click", function () {
      FF.Klang.spiele("klick"); schliesseModal("einstellungen");
      if (modus === "menue") waehleTab(aktiverTab);
    });
  });

  /* Anleitung (❓): Kurzfassung und Details, alle Welten mit Bildschirmfoto und
     Merkmalen (aus config.js abgeleitet), „Was ist neu?“ (C.neuigkeiten) */
  function weltMerkmale(w) {
    var g = w.gelaende || {}, m = [];
    if (w.schwerkraft < 5) m.push("🪶 wenig Schwerkraft");
    if (w.grip < 0.8) m.push("🧊 rutschig");
    if (w.rollwiderstand >= 0.05) m.push("🐌 Boden bremst");
    if (w.abprall > 0.3) m.push("🍮 alles federt");
    if (w.wasser) m.push("💧 Pfützen");
    if (w.wind) m.push("💨 Wind");
    if (w.unterwasser) m.push("🫧 unter Wasser");
    if (g.becken) m.push("⚗️ Behälter zum Reintauchen");
    if (w.nacht) m.push("🔦 dunkel");
    if (w.decke) m.push("🪨 Höhlendecke");
    if (w.spuk) m.push("👻 Geister");
    if (w.kopfueber) m.push("🙃 Umdreh-Tore");
    if (w.held) m.push("📞 Heldenumhang", "🐱 Kätzchen retten");
    if (w.comic) m.push("💥 Comic-Blasen");
    if (w.schleimbach) m.push("🟢 Schleimbäche");
    if (w.schleimtropfen) m.push("💚 Schleimtropfen");
    if (w.datenstrom) m.push("💾 Datenströme");
    if (g.looping) m.push("🎢 Loopings");
    if (g.luecke) m.push("🕳️ Abgründe");
    if (g.trampolin) m.push(w.trampolinStil === "matte" ? "🤸 Trampoline" : w.trampolinStil === "schleim" ? "🟩 Wackelschleim" : w.trampolinStil === "taste" ? "⏎ Enter-Knöpfe" : "🍄 Hüpfpilze");
    if (g.band && !w.schleimbach && !w.datenstrom) m.push("⏩ Förderbänder");
    if (g.schwebe) m.push("✨ Schwebe-Säulen");
    if (g.katapult) m.push("🎯 Katapulte");
    if (w.objekte) m.push(w.objekte.art === "glas" ? "💎 Glas zerspringt" : "🧱 Bausteine fliegen");
    if (w.objekte && w.objekte.saeule) m.push("🏛️ Säulen");
    if (w.wasser && w.wasser.schlamm) { m.splice(m.indexOf("💧 Pfützen"), 1, w.wasser.schleim ? "🫠 klebriger Schleim" : "🐷 Matsch"); }
    if (g.scheune) m.push("🛖 Scheunen mit Stroh");
    if (w.obst) m.push("🍎 Obst-Turbo");
    if (g.roehreAbstand) m.push("🌀 Röhren");
    if ((g.klippe || 0) >= 1.5) m.push("⛰️ Klippen");
    if ((g.sprung || 0) >= 1.4 || (g.schanzen || 0) >= 1.5) m.push("🛫 große Schanzen");
    return m;
  }
  var hilfeSeite = "anleitung";
  function zeigeHilfeSeite(seite) {
    hilfeSeite = seite;
    document.querySelectorAll(".hilfe-reiter [data-seite]").forEach(function (b) {
      var an = b.dataset.seite === seite; b.classList.toggle("aktiv", an); b.setAttribute("aria-selected", an ? "true" : "false");
    });
    document.querySelectorAll("[data-seite-inhalt]").forEach(function (d) { d.hidden = d.dataset.seiteInhalt !== seite; });
    $("hilfe-inhalt").scrollTop = 0;
  }
  function oeffneHilfe(seite) {
    FF.Klang.init(); FF.Klang.spiele("klick");
    $("hilfe-neuigkeiten").innerHTML = C.neuigkeiten.map(function (n, i) {
      var aktuell = n.version === VERSION;
      return '<div class="neu-version' + (aktuell ? " aktuell" : "") + '"><div class="neu-kopf"><span class="neu-nummer">Version ' + n.version +
             "</span>" + n.titel + (aktuell ? ' <span class="neu-marke">⭐ deine Version</span>' : "") + "</div><ul>" +
             n.punkte.map(function (p) { return "<li>" + p + "</li>"; }).join("") + "</ul></div>";
    }).join("");
    $("hilfe-weltenzahl").textContent = C.welten.length + " Welten";
    $("hilfe-fahrzeuge").textContent = C.fahrzeuge.length + " Fahrzeuge: " + C.fahrzeuge.map(function (f) { return f.emoji + " " + f.name; }).join(", ");
    // Nur freigeschaltete Welten werden gezeigt – die anderen bleiben eine Überraschung
    var geheim = 0;
    $("welt-info-liste").innerHTML = C.welten.map(function (w, wi) {
      var sterne = 0, offen = levelOffen(wi, 0);
      if (!offen) { geheim++; return '<div class="welt-info geheim" aria-label="Geheime Welt"><div class="geheim-bild">❓</div>' +
        '<div class="welt-info-text"><div class="welt-info-name"><span>🔒 Geheime Welt</span></div><div class="geheim-zeile"></div><div class="geheim-zeile kurz"></div></div></div>'; }
      for (var li = 0; li < w.level.length; li++) sterne += levelStand(wi, li).sterne || 0;
      return '<div class="welt-info"><img src="bilder/welten/' + w.id + '.jpg" alt="Bild aus der Welt ' + w.name + '" loading="lazy" width="320" height="150">' +
        '<div class="welt-info-text"><div class="welt-info-name"><span>' + w.emoji + " " + w.name + "</span><small>" +
        (offen ? "⭐ " + sterne + "/" + 3 * w.level.length : "🔒 noch zu") + "</small></div>" +
        '<div class="welt-info-hinweis">' + w.hinweis + "</div>" +
        '<div class="welt-info-marken">' + weltMerkmale(w).map(function (m) { return "<span>" + m + "</span>"; }).join("") + "</div></div></div>";
    }).join("");
    $("welten-intro").textContent = geheim ? "Deine Welten – und " + geheim + " geheime, die du noch freispielen kannst! 🤫" : "Alle Welten freigespielt – super! 🌟";
    oeffneModal("hilfe");
    zeigeHilfeSeite(typeof seite === "string" ? seite : "anleitung");
  }
  $("knopf-hilfe").addEventListener("click", function () { oeffneHilfe("neu"); });
  $("knopf-anleitung").addEventListener("click", function () { oeffneHilfe("anleitung"); });
  $("knopf-titel-anleitung").addEventListener("click", function () { oeffneHilfe("anleitung"); });
  ["hilfe-zu", "hilfe-fertig"].forEach(function (id) {
    $(id).addEventListener("click", function () { FF.Klang.spiele("klick"); schliesseModal("hilfe"); });
  });
  document.querySelectorAll(".hilfe-reiter [data-seite]").forEach(function (b) {
    b.addEventListener("click", function () { FF.Klang.spiele("klick"); zeigeHilfeSeite(b.dataset.seite); });
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
  function entwicklerAnzeigen() {
    $("dev-alle-offen").classList.toggle("aktiv", S.entwickler.alleOffen);
    $("dev-editor").classList.toggle("aktiv", !!S.entwickler.editor);
    $("dev-gasbremse").classList.toggle("aktiv", !!S.entwickler.gasBremseAlt);
    var sw = S.entwickler.startseite || "auto";
    $("dev-startseite").querySelector(".opt-schalter-status").textContent = { auto: "Auto", voll: "Voll", spar: "Spar" }[sw];
  }
  /* Startseiten-Show: Auto (misst die Bildrate) → immer voll → immer Sparmodus */
  $("dev-startseite").addEventListener("click", function () {
    var reihe = ["auto", "voll", "spar"], sw = S.entwickler.startseite || "auto";
    S.entwickler.startseite = reihe[(reihe.indexOf(sw) + 1) % 3];
    speichere(); entwicklerAnzeigen();
    FF.Klang.spiele("klick");
    popover("🎬 Startseite: " + { auto: "Automatisch (Sparmodus, wenn das Gerät zu langsam ist)", voll: "Immer die volle Show", spar: "Immer Sparmodus" }[S.entwickler.startseite] +
            (letzteShowFps ? "<small>Zuletzt gemessen: " + Math.round(letzteShowFps) + " Bilder/s" + (letzteShowSpar ? " → Sparmodus" : "") + "</small>" : "") +
            "<small>Gilt beim nächsten Öffnen des Spiels.</small>", 3600);
  });
  $("dev-gasbremse").addEventListener("click", function () {
    S.entwickler.gasBremseAlt = !S.entwickler.gasBremseAlt;
    speichere(); entwicklerAnzeigen();
    FF.Klang.spiele("klick");
    popover(S.entwickler.gasBremseAlt ? "🎛️ Gas + Bremse zugleich: alte Wirkung (Auto bleibt in der Luft ruhig)" : "🎛️ Gas + Bremse zugleich: Gas hat Vorrang", 2200);
  });
  $("dev-editor").addEventListener("click", function () {
    S.entwickler.editor = !S.entwickler.editor;
    speichere(); entwicklerAnzeigen();
    FF.Klang.spiele("klick");
    popover(S.entwickler.editor ? "✏️ Strecken-Editor an: oben in der Weltenliste" : "✏️ Strecken-Editor aus", 1800);
  });
  $("dev-muenzen").addEventListener("click", function () {
    C.kinder.forEach(function (k) { S.spieler[k.id].muenzen += 10000; });
    speichere(); kontoAktualisieren();
    FF.Klang.spiele("kauf");
    popover("🪙 +10.000 für alle (" + C.kinder.map(function (k) { return k.name; }).join(", ") + ")", 1600);
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
     12b) STARTSEITEN-SHOW: Hinter dem Titel fährt ein Roboter (roboter.js)
     vorberechnete Szenen aus allen Welten (startseite-szenen.js, erzeugt von
     werkzeuge/startseite.js) – mit echter Physik und Grafik, aber ohne Ton,
     Tipps und Spielstand. Gerechnet wird in festen 1/60-s-Schritten, so ist
     jede Szene genau die, die das Werkzeug ausgesucht hat.
     Die nächste Szene wird im Hintergrund vorgefahren (ein paar ms je Bild).
     Ist das Gerät zu langsam, erst mit halber Auflösung, dann Sparmodus:
     Weltbilder mit langsamer Kamerafahrt (CSS, kaum Rechenlast).
     ========================================================================= */
  var SHOW_DT = 1 / 60, SHOW_BUDGET_MS = 4, SHOW_BLENDE = 0.35;
  var show = null;
  var demo = false;                       // true, während die Show rechnet: keine Tipps, Meldungen, Töne, kein Speichern
  var KLANG_STUMM = null;
  var letzteShowFps = 0, letzteShowSpar = false;   // für den Entwickler-Bereich

  function showKinder() {
    return C.kinder.filter(function (k) { return !k.eigen || (S.eigene[k.id] && S.eigene[k.id].aktiv); }).map(function (k) { return k.id; });
  }
  function mischen(a) {
    for (var i = a.length - 1; i > 0; i--) { var j = Math.floor(Math.random() * (i + 1)), t = a[i]; a[i] = a[j]; a[j] = t; }
    return a;
  }
  function showSzenenListe() {
    var Z = (FF.STARTSEITE && FF.STARTSEITE.szenen) || [];
    return mischen(Z.filter(function (sz) {
      return C.welten.some(function (w) { return w.id === sz.welt; }) && C.fahrzeuge.some(function (f) { return f.id === sz.fahrzeug; });
    }).slice());
  }
  /* Szene vorbereiten: Fahrt anlegen; vorfahren() rechnet den Vorlauf in Häppchen */
  function showNeueSzene() {
    if (!show.liste.length) show.liste = showSzenenListe();
    var sz = show.liste.shift();
    if (!sz) return null;
    var wi = C.welten.findIndex(function (w) { return w.id === sz.welt; });
    var f = new FF.Fahrt({ weltIndex: wi, stufe: sz.stufe, fahrzeugId: sz.fahrzeug, upgrades: FF.STARTSEITE.upgrades, schwierigkeit: "normal" });
    var s = sz.seed % 2147483646 + 1;
    var kinder = showKinder();
    show.kindNr = (show.kindNr + 1) % kinder.length;
    return { sz: sz, fahrt: f, fahrer: FF.Roboter.show(function () { s = s * 16807 % 2147483647; return (s - 1) / 2147483646; }),
             schritte: 0, t: 0, kind: kinder[show.kindNr] };
  }
  function showVorfahren(n, budgetMs) {
    if (!n) return true;
    var t0 = performance.now();
    while (n.schritte < n.sz.vorlauf) {
      n.fahrt.aktualisiere(SHOW_DT, n.fahrer.eingabe(n.fahrt, SHOW_DT));
      n.fahrt.ereignisse.length = 0;
      n.schritte++;
      if (budgetMs && (n.schritte & 7) === 0 && performance.now() - t0 > budgetMs) return false;
    }
    return true;
  }
  /* Aufs Spielfeld: Kamera, Wetter, Partikel für die neue Szene */
  function showAufbuehne(n) {
    show.aktiv = n;
    fahrt = n.fahrt;
    partikel.liste.length = 0; texte.length = 0;
    kopfLage = fahrt.kopf ? 1 : 0; schleimFaelle = []; schleimTakt = 2;
    ausdruck = "normal"; ausdruckBis = 0;
    wetter.setze(fahrt.welt.wetter, kamera);
    $("nacht-ebene").style.display = "none";
    kameraNachfuehren(0, true);
    var w = fahrt.welt, d = fahrt.def;
    var schild = $("show-welt");
    schild.innerHTML = '<span aria-hidden="true">' + w.emoji + "</span> " + w.name + ' <span class="show-welt-fz" aria-hidden="true">' + d.emoji + "</span>";
    schild.classList.remove("rein"); void schild.offsetWidth; schild.classList.add("rein");
  }

  function showStart() {
    if (!FF.STARTSEITE || !FF.Roboter) { showLeicht(true); return; }
    var modusWunsch = S.entwickler.startseite || "auto";       // auto | voll | spar
    show = { liste: showSzenenListe(), kindNr: -1, aktiv: null, naechste: null, acc: 0, blende: 0, wechsel: false,
             messung: { n: 0, summe: 0 }, fps: 0, dprMax: 0, leicht: false, wunsch: modusWunsch };
    if (modusWunsch === "spar" || (window.matchMedia && window.matchMedia("(prefers-reduced-motion: reduce)").matches)) { showLeicht(true); return; }
    $("titelscreen").classList.add("mit-show");
    var n = showNeueSzene();
    if (!n) { showLeicht(true); return; }
    showVorfahren(n, 0);
    showAufbuehne(n);
    show.naechste = showNeueSzene();
  }
  function showStopp() {
    if (!show) return;
    if (show.aktiv && fahrt === show.aktiv.fahrt) fahrt = null;
    var hatteDpr = show.dprMax;
    show = null;
    partikel.liste.length = 0; texte.length = 0;
    $("nacht-ebene").style.display = "none";
    ctx.setTransform(1, 0, 0, 1, 0, 0); ctx.clearRect(0, 0, canvas.width, canvas.height);
    canvas.style.background = ""; himmelWelt = null;
    $("show-leicht").hidden = true;
    $("titelscreen").classList.remove("mit-show", "leicht");
    if (hatteDpr) groesseAnpassen();
  }

  function showSchritt(dt) {
    if (!show) return;
    if (show.leicht) { showLeichtSchritt(dt); return; }
    var n = show.aktiv;
    if (!n) return;
    // Bildrate messen (nicht während der Blende, da wird im Hintergrund mehr gerechnet)
    if (dt > 0 && !show.wechsel && n.t > 1) {
      var M = show.messung;
      M.n++; M.summe += dt;
      if (M.n >= 60) {
        show.fps = letzteShowFps = M.n / M.summe; M.n = 0; M.summe = 0;
        // zu langsam: erst halbe Auflösung, reicht das nicht, Sparmodus
        if (show.wunsch === "auto" && show.fps < 24) {
          if (!show.dprMax && DPR > 1) { show.dprMax = 1; groesseAnpassen(); kameraNachfuehren(0, true); }
          else { showLeicht(false); return; }
        }
      }
    }
    // Physik in festen Schritten (höchstens 3 je Bild – lieber kurz Zeitlupe als Ruckeln)
    show.acc = Math.min(show.acc + dt, 3 * SHOW_DT);
    var K = FF.Klang;
    if (!KLANG_STUMM) { KLANG_STUMM = {}; Object.keys(K).forEach(function (k) { KLANG_STUMM[k] = typeof K[k] === "function" ? function () {} : K[k]; }); }
    FF.Klang = KLANG_STUMM; demo = true;
    try {
      while (show.acc >= SHOW_DT) {
        show.acc -= SHOW_DT;
        n.fahrt.aktualisiere(SHOW_DT, n.fahrer.eingabe(n.fahrt, SHOW_DT));
        n.t += SHOW_DT;
        verarbeiteEreignisse();
        fahrEffekte(SHOW_DT);
        spurZiehen(SHOW_DT);
        kameraNachfuehren(SHOW_DT, false);
        var st = n.fahrt.fz.status, inLuft = st.radKontakte === 0 && !st.huellKontakt && n.fahrt.zustand === "fahrt";
        if (zeit > ausdruckBis) ausdruck = n.fahrt.luftZeit > 0.35 && inLuft ? "freude" : "normal";
      }
      // nächste Szene im Hintergrund vorfahren
      var fertig = showVorfahren(show.naechste, SHOW_BUDGET_MS);
      szeneZeichnen(dt, aussehenVon(n.kind, n.sz.fahrzeug), null, false, false);
    } finally { FF.Klang = K; demo = false; }
    // Szenenwechsel mit Blende
    var D = FF.STARTSEITE.dauer;
    if (!show.wechsel && n.t >= D - SHOW_BLENDE && fertig && show.naechste) {
      show.wechsel = true;
      $("show-blende").classList.add("zu");
    }
    if (show.wechsel && n.t >= D) {
      showAufbuehne(show.naechste);
      show.naechste = showNeueSzene();
      show.wechsel = false; show.messung.n = 0; show.messung.summe = 0;
      $("show-blende").classList.remove("zu");
    }
    if (n.fahrt.zustand === "ende" && !show.wechsel && show.naechste && fertig) { show.wechsel = true; $("show-blende").classList.add("zu"); n.t = Math.max(n.t, D - SHOW_BLENDE); }
  }

  /* Sparmodus: Weltbilder (bilder/welten, Fiete fährt darauf) gleiten langsam durchs Bild – nur CSS */
  function showLeicht(sofort) {
    if (!show) show = { leicht: true, wunsch: "spar", fps: 0 };
    if (show.aktiv && fahrt === show.aktiv.fahrt) fahrt = null;
    show.leicht = true; show.aktiv = null; show.naechste = null;
    if (!sofort) letzteShowSpar = true;
    if (show.dprMax) { show.dprMax = 0; groesseAnpassen(); }
    ctx.setTransform(1, 0, 0, 1, 0, 0); ctx.clearRect(0, 0, canvas.width, canvas.height);
    canvas.style.background = ""; himmelWelt = null;
    $("nacht-ebene").style.display = "none";
    $("titelscreen").classList.add("mit-show", "leicht");
    $("show-blende").classList.remove("zu");
    $("show-leicht").hidden = false;
    show.bilder = mischen(C.welten.map(function (w) { return w; }));
    show.bildNr = -1; show.bildT = 99; show.ebene = 0;
    showLeichtSchritt(0);
  }
  function showLeichtSchritt(dt) {
    show.bildT += dt;
    if (show.bildT < (FF.STARTSEITE ? FF.STARTSEITE.dauer : 8)) return;
    show.bildT = 0;
    show.bildNr = (show.bildNr + 1) % show.bilder.length;
    var w = show.bilder[show.bildNr], E = $("show-leicht").children, neu = E[show.ebene], alt = E[1 - show.ebene];
    neu.style.backgroundImage = 'url("bilder/welten/' + w.id + '.jpg")';
    neu.classList.remove("fahrt"); void neu.offsetWidth; neu.classList.add("fahrt", "sichtbar");
    alt.classList.remove("sichtbar");
    show.ebene = 1 - show.ebene;
    var schild = $("show-welt");
    schild.innerHTML = '<span aria-hidden="true">' + w.emoji + "</span> " + w.name;
    schild.classList.remove("rein"); void schild.offsetWidth; schild.classList.add("rein");
  }

  /* =========================================================================
     13) TITEL + PWA
     ========================================================================= */
  var startGedrueckt = false;
  /* Nur der große grüne Knopf startet (Tippen daneben tut nichts), am Rechner auch Enter/Leertaste */
  $("knopf-start").addEventListener("click", titelStart);
  window.addEventListener("keydown", function (e) {
    if (modus !== "titel" || $("titelscreen").hidden || document.querySelector(".modal-overlay.offen")) return;
    if (e.code === "Enter" || e.code === "Space" || e.code === "NumpadEnter") { e.preventDefault(); titelStart(); }
  });
  function titelStart() {
    if (startGedrueckt) return;
    startGedrueckt = true;
    FF.Klang.init(); einstellungenAnwenden(); FF.Klang.spiele("klick");
    var t = $("titelscreen");
    t.classList.add("aus");
    setTimeout(function () { t.classList.remove("aus"); startGedrueckt = false; zeigeSpielerwahl(); }, 380);
  }

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
      b.addEventListener("click", function () { b.hidden = true; if (modus !== "fahrt") oeffneHilfe("neu"); });
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
        var wartet = countdownSchritt(dt);
        if (!wartet) {
          fahrt.aktualisiere(dt, eingabe);
          if (aufnahme) aufnahme.erfasse(fahrt, ausdruck);
          if (geist) { geist.obj.setzeZeit(fahrt.zeit); geistVergleich(); }
        }
        verarbeiteEreignisse();
        if (!fahrt) return;
        fahrEffekte(dt);
        if (!wartet) spurZiehen(dt);
        kameraNachfuehren(dt, false);
        hudAktualisieren(false);
        var st = fahrt.fz.status, hilfe = fahrt.zustand === "hilfe";
        if (wartet) {                                   // an der Ampel: nur Motor aufheulen lassen
          FF.Klang.motorSetze({ drehzahl: eingabe.gas ? 0.55 : 0, gas: eingabe.gas ? 1 : 0, bremse: 0, laeuft: true, tempo: 0,
                                vmax: fahrt.werte.motor.vmax, boden: true, luft: fahrt.welt.luftdichte > 0 && !fahrt.welt.unterwasser, probe: true, dt: dt });
        } else FF.Klang.motorSetze({
          drehzahl: hilfe ? 0 : st.drehzahl, bremse: fahrt.bremse, rueckwaerts: fahrt.rueckwaerts,
          gas: fahrt.gas + (fahrt.rueckwaerts ? 0.6 * fahrt.bremse : 0),       // rückwärts treibt der Motor auch
          laeuft: fahrt.tank > 0 && fahrt.zustand !== "ende", tempo: hilfe ? 0 : st.tempo, vmax: fahrt.werte.motor.vmax,
          boden: !hilfe && st.radKontakte > 0, luft: fahrt.welt.luftdichte > 0 && !fahrt.welt.unterwasser && !fahrt.imBecken, getriebe: fahrt.getriebe, dt: dt
        });
        if (fahrt.welt.wind) FF.Klang.umgebungStaerke(Math.min(1, Math.abs(fahrt.gelaende.windBei(fahrt.fz.chassis.x)) / fahrt.welt.wind.staerke));
        var inLuft = st.radKontakte === 0 && !st.huellKontakt && fahrt.zustand === "fahrt";
        if (zeit > ausdruckBis) {
          ausdruck = fahrt.luftZeit > 0.35 && inLuft ? "freude" : (fahrt.tank <= 0 ? "staunen" : "normal");
        }
        // In der Luft zeigen die Pedale, wohin sie die Nase drehen (⤴ Gas, ⤵ Bremse)
        var luftPedale = inLuft && fahrt.luftZeit > 0.3;
        if (luftPedale !== pedaleLuft) { pedaleLuft = luftPedale; $("pedale").classList.toggle("luft", luftPedale); }
        if (luftPedale && fahrt.luftZeit > 0.5 && !luftTippDieseFahrt) {
          luftTippDieseFahrt = true;                     // je Fahrt einmal prüfen, insgesamt die ersten 3 Male zeigen
          if (S.einstellungen.tipps && ersteMale("tipp-luft", 3)) {
            tipp("✈️ In der Luft: GAS hebt die Nase ⤴, BREMSE senkt sie ⤵", 4500, "In der Luft: Gas hebt die Nase, Bremse senkt sie!");
            spruchBis = zeit + 3;
          }
        }
      }
      szeneZeichnen(pausiert ? 0 : dt, aussehenVon(S.aktiv), geist ? { fz: geist.obj.fz, def: geist.obj.def, aussehen: geist.aussehen,
                    ausdruck: geist.obj.ausdruck, hilfe: geist.obj.hilfe, name: geist.name } : null, S.einstellungen.kraefte, S.einstellungen.instrumente);
    } else if (modus === "menue" && aktiverTab === "garage") {
      zeichneKleinCanvas("vorschau");
    } else if (modus === "titel") {
      showSchritt(dt);
    }
  }

  /* Eine Fahrt aufs Spielfeld zeichnen (Fahrt im Spiel und Startseiten-Show).
     Partikel, Schwebetexte und das Umklappen der Kopfüberwelt laufen mit dt weiter. */
  function szeneZeichnen(dt, aussehen, geistInfo, kraefte, instrumente) {
    partikel.aktualisiere(dt, fahrt.welt.schwerkraft);
    texteAktualisieren(dt);
    kopfLage += ((fahrt.kopf ? 1 : 0) - kopfLage) * Math.min(1, dt * 3.2);
    if (Math.abs(kopfLage - (fahrt.kopf ? 1 : 0)) < 0.002) kopfLage = fahrt.kopf ? 1 : 0;
    var kf = Math.cos(Math.PI * kopfLage), himmelKopf = kf < 0;
    if (himmelWelt !== fahrt.welt || himmelKopf !== himmelWarKopf) {
      himmelWelt = fahrt.welt; himmelWarKopf = himmelKopf;
      canvas.style.background = FF.Grafik.himmelCss(himmelWelt, himmelKopf);
    }
    ctx.setTransform(DPR, 0, 0, DPR, 0, 0);
    FF.Grafik.zeichneSzene(ctx, {
      fahrt: fahrt, kamera: kamera, zeit: zeit, dt: dt, dpr: DPR, himmelPerCss: true, kopf: kf,
      partikel: partikel, texte: texte, wetter: wetter,
      aussehen: aussehen, ausdruck: ausdruck, geist: geistInfo,
      kraefte: kraefte, instrumente: instrumente,
      nachtEbene: fahrt.welt.nacht ? $("nacht-ebene") : null
    });
  }

  einstellungenAnwenden();
  zeigeBildschirm("titel");
  modus = "titel";
  groesseAnpassen();
  showStart();
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
    oeffneEditor: oeffneEditor,
    starteFahrt: starteFahrt,
    zeigeMenue: zeigeMenue,
    zeigeSpielerwahl: zeigeSpielerwahl,
    setzeAktiv: setzeAktiv,
    setzeEingabe: function (g, b) { tasten.gas = !!g; tasten.bremse = !!b; eingabeAktualisieren(); }
  };
})();
