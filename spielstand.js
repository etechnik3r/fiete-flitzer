/* ===========================================================================
   Fiete Flitzer – spielstand.js
   ---------------------------------------------------------------------------
   Der Spielstand: Profile der Kinder, Laden alter Stände (Migration) und der
   SPIELSTAND-CODE zum Sichern und Wiederherstellen (Einstellungen → 💾).

   Kein Browser nötig (kein window/document): spiel.js liest und schreibt den
   localStorage, werkzeuge/testfahrt.js --spielstand prüft den Code in Node.

   DER CODE
     Fortschritt beider Kinder (Münzen, Level und Sterne, Endlos-Rekorde,
     Fahrzeuge mit Tuning, Farben, Muster, Outfits, Look, Spuren, Statistik,
     Duell-Siege) wird Bit für Bit gepackt – Einstellungen gehören zum Gerät
     und bleiben draußen. Welten, Fahrzeuge, Farben … stehen als Nummer in der
     Reihenfolge von config.js; neue Einträge dürfen deshalb nur HINTEN
     angehängt werden (so wird es ohnehin gemacht), dann passen alte Codes.
     Am Ende steht eine 16-Bit-Prüfsumme (Fletcher-16): ein vertippter oder
     abgeschnittener Code wird erkannt statt halb geladen.
     Schrift: Crockford-Base32 (0–9 und A–Z ohne I, L, O, U), in Fünfergruppen.
     Groß-/Kleinschreibung, Leerzeichen und Bindestriche sind beim Eingeben
     egal; O wird als 0, I und L als 1 gelesen.
   =========================================================================== */

var FF = globalThis.FF = globalThis.FF || {};

(function () {
  "use strict";
  var C = FF.CONFIG;

  /* -------------------------------------------------------------------------
     Profile
     ------------------------------------------------------------------------- */
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
      spur: "keine",               // was hinter dem Auto herfliegt (config.spuren)
      spuren: ["keine"],
      felge: "standard",           // Felgen (config.felgen)
      felgen: ["standard"],
      beifahrer: "keiner",         // Tier, das mitfährt (config.beifahrer)
      beifahrerListe: ["keiner"],
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
      einstellungen: { ton: true, sprache: true, schwierigkeit: "normal", instrumente: true, kraefte: false, bruchlandung: false, tipps: true, ausrichtung: "quer" },
      duell: { welt: 0, stufe: 0, endlos: false, siege: {} },
      gesehen: {},                          // welche Tipps schon wie oft kamen (bleibt über Neustarts)
      entwickler: { alleOffen: false, editor: false }   // versteckter Entwickler-Bereich (Einstellungen → 7× auf die Version tippen)
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
    ["farben", "muster", "outfits", "freigeschaltet", "spuren", "felgen", "beifahrerListe"].forEach(function (k) { if (!Array.isArray(ziel[k])) ziel[k] = frisch[k]; });
    if (ziel.felgen.indexOf("standard") < 0) ziel.felgen.unshift("standard");
    if (ziel.felgen.indexOf(ziel.felge) < 0) ziel.felge = "standard";
    if (ziel.beifahrerListe.indexOf("keiner") < 0) ziel.beifahrerListe.unshift("keiner");
    if (ziel.beifahrerListe.indexOf(ziel.beifahrer) < 0) ziel.beifahrer = "keiner";
    frisch.farben.forEach(function (f) { if (ziel.farben.indexOf(f) < 0) ziel.farben.push(f); });   // neue Gratis-Farben
    if (ziel.spuren.indexOf("keine") < 0) ziel.spuren.unshift("keine");
    if (ziel.spuren.indexOf(ziel.spur) < 0) ziel.spur = "keine";
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

  /* Spielstand aus dem gespeicherten Text (localStorage) – alles Kaputte wird ignoriert */
  function lade(roh) {
    var s = neuerSpielstand();
    try {
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
        if (d && d.gesehen && typeof d.gesehen === "object") Object.keys(d.gesehen).forEach(function (k) { s.gesehen[k] = +d.gesehen[k] || 0; });
        if (d && d.entwickler) { s.entwickler.alleOffen = d.entwickler.alleOffen === true; s.entwickler.editor = d.entwickler.editor === true; }
        if (d && Array.isArray(d.strecken)) s.strecken = d.strecken;
        if (alt) C.kinder.forEach(function (k) { alteFreischaltungen(s.spieler[k.id]); });
      }
    } catch (e) { /* kaputter Speicher → frisch anfangen */ }
    return s;
  }

  function alsText(S) {
    S.duell.weltId = C.welten[S.duell.welt] ? C.welten[S.duell.welt].id : C.welten[0].id;
    return JSON.stringify(S);
  }

  /* -------------------------------------------------------------------------
     Spielstand-Code
     ------------------------------------------------------------------------- */
  var ALPHABET = "0123456789ABCDEFGHJKMNPQRSTVWXYZ";
  /* Fahrzeuge im Code nach fester Reihenfolge (so bleiben alte Codes gültig, auch wenn
     ein neues Fahrzeug in CONFIG.fahrzeuge weiter vorn einsortiert wird). Neue Fahrzeuge
     hier HINTEN anhängen; was fehlt, kommt automatisch ans Ende. */
  var CODE_FAHRZEUGE = ["flitzer", "traktor", "moped", "eauto", "bus", "monster", "renner", "mond",
                        "skateboard", "flugzeug", "sofa", "raupe"];
  function codeFahrzeuge() {
    var liste = [];
    CODE_FAHRZEUGE.forEach(function (id) { C.fahrzeuge.forEach(function (f) { if (f.id === id) liste.push(f); }); });
    C.fahrzeuge.forEach(function (f) { if (CODE_FAHRZEUGE.indexOf(f.id) < 0) liste.push(f); });
    return liste;
  }
  var CODE_VERSION = 2;               // 2: mit Felgen und Beifahrern (Codes der Version 1 werden weiter gelesen)
  var UPG = ["motor", "reifen", "federung", "tank"];

  function Schreiber() { this.bits = []; }
  Schreiber.prototype.bit = function (v) { this.bits.push(v ? 1 : 0); };
  Schreiber.prototype.feld = function (v, n) { for (var i = n - 1; i >= 0; i--) this.bits.push((v >>> i) & 1); };
  // Zahl beliebiger Größe: erst die Bitlänge (5 Bit), dann die Bits
  Schreiber.prototype.zahl = function (v) {
    v = Math.max(0, Math.min(2147483647, Math.floor(+v || 0)));
    var n = 0; while (n < 31 && (v >>> n) > 0) n++;
    this.feld(n, 5); this.feld(v, n);
  };
  Schreiber.prototype.text = function (t) {
    t = String(t || "").replace(/[^\x20-\x7e]/g, "").slice(0, 15);
    this.feld(t.length, 4);
    for (var i = 0; i < t.length; i++) this.feld(t.charCodeAt(i), 7);
  };
  Schreiber.prototype.maske = function (liste, haben) {
    for (var i = 0; i < liste.length; i++) this.bit(haben.indexOf(liste[i].id) >= 0);
  };

  function Leser(bits) { this.bits = bits; this.i = 0; }
  Leser.prototype.bit = function () { if (this.i >= this.bits.length) throw new Error("zu kurz"); return this.bits[this.i++]; };
  Leser.prototype.feld = function (n) { var v = 0; for (var k = 0; k < n; k++) v = v * 2 + this.bit(); return v; };
  Leser.prototype.zahl = function () { return this.feld(this.feld(5)); };
  Leser.prototype.text = function () { var n = this.feld(4), t = ""; for (var k = 0; k < n; k++) t += String.fromCharCode(this.feld(7)); return t; };
  Leser.prototype.maske = function (n, liste) {
    var aus = [];
    for (var k = 0; k < n; k++) if (this.bit() && liste[k]) aus.push(liste[k].id);
    return aus;
  };

  function index(liste, id) { for (var i = 0; i < liste.length; i++) if (liste[i].id === id) return i; return 0; }

  function pruefsumme(bytes) {                          // Fletcher-16
    var a = 0, b = 0;
    for (var i = 0; i < bytes.length; i++) { a = (a + bytes[i]) % 255; b = (b + a) % 255; }
    return (b << 8) | a;
  }

  function zuBytes(bits) {
    var bytes = [];
    for (var i = 0; i < bits.length; i += 8) {
      var v = 0;
      for (var k = 0; k < 8; k++) v = v * 2 + (bits[i + k] || 0);
      bytes.push(v);
    }
    return bytes;
  }

  /* Code aus dem Spielstand S (beide Kinder) */
  function codeErzeugen(S) {
    var w = new Schreiber(), F = codeFahrzeuge(), W = C.welten;
    w.feld(CODE_VERSION, 4);
    w.feld(C.kinder.length, 2); w.feld(W.length, 7); w.feld(F.length, 5);
    w.feld(C.farben.length, 5); w.feld(C.muster.length, 4); w.feld(C.outfits.length, 4); w.feld(C.spuren.length, 4);
    w.feld(C.felgen.length, 4); w.feld(C.beifahrer.length, 4);
    w.feld(index(C.kinder, S.aktiv), 2);
    C.kinder.forEach(function (kind) {
      var p = S.spieler[kind.id];
      w.zahl(p.muenzen);
      w.feld(index(F, p.fahrzeug), 5);
      F.forEach(function (f) {
        var fs = p.fahrzeuge[f.id] || neuesFahrzeug(f);
        w.bit(fs.gekauft);
        if (!fs.gekauft) return;
        UPG.forEach(function (u) { w.feld(Math.min(7, fs.upgrades[u] || 0), 3); });
        w.bit(fs.upgrades.allrad);
        w.feld(index(C.farben, fs.farbe), 5); w.feld(index(C.muster, fs.muster), 4);
      });
      w.maske(C.farben, p.farben); w.maske(C.muster, p.muster);
      w.maske(C.outfits, p.outfits); w.feld(index(C.outfits, p.outfit), 4);
      w.text(p.look || "");
      w.maske(C.spuren, p.spuren || ["keine"]); w.feld(index(C.spuren, p.spur), 4);
      w.maske(C.felgen, p.felgen || ["standard"]); w.feld(index(C.felgen, p.felge), 4);
      w.maske(C.beifahrer, p.beifahrerListe || ["keiner"]); w.feld(index(C.beifahrer, p.beifahrer), 4);
      W.forEach(function (welt) {
        for (var li = 0; li < 4; li++) {
          var l = p.level[welt.id + "-" + (li + 1)] || {};
          w.bit(l.geschafft); w.feld(Math.min(3, l.sterne || 0), 2);
        }
        w.bit(p.freigeschaltet.indexOf(welt.id) >= 0);
        var e = p.endlos[welt.id] || 0;
        w.bit(e > 0); if (e > 0) w.zahl(e);
      });
      ["fahrten", "meter", "salti", "muenzen"].forEach(function (k) { w.zahl(p.statistik[k]); });
      w.zahl(S.duell.siege[kind.id]);
    });
    var bytes = zuBytes(w.bits), ps = pruefsumme(bytes);
    bytes.push(ps >> 8, ps & 255);
    // Bytes → Base32 (5 Bit je Zeichen)
    var bits = [], t = "";
    bytes.forEach(function (b) { for (var k = 7; k >= 0; k--) bits.push((b >> k) & 1); });
    for (var i = 0; i < bits.length; i += 5) {
      var v = 0;
      for (var k = 0; k < 5; k++) v = v * 2 + (bits[i + k] || 0);
      t += ALPHABET[v];
    }
    return t.match(/.{1,5}/g).join("-");
  }

  /* Code → Spielstand-Teile. Rückgabe { ok, spieler, siege, aktiv } oder { ok: false, fehler } */
  function codeLesen(text, alterStand) {
    var rein = String(text || "").toUpperCase().replace(/O/g, "0").replace(/[IL]/g, "1").replace(/[^0-9A-Z]/g, "");
    if (rein.length < 20) return { ok: false, fehler: "Der Code ist zu kurz." };
    var bits = [];
    for (var i = 0; i < rein.length; i++) {
      var v = ALPHABET.indexOf(rein[i]);
      if (v < 0) return { ok: false, fehler: "Im Code ist ein falsches Zeichen: " + rein[i] };
      for (var k = 4; k >= 0; k--) bits.push((v >> k) & 1);
    }
    var bytes = zuBytes(bits.slice(0, Math.floor(bits.length / 8) * 8));
    // Die Füllbits am Ende (weniger als 5) ergeben kein ganzes Byte – die letzten zwei Bytes sind die Prüfsumme
    var daten = bytes.slice(0, -2), ps = (bytes[bytes.length - 2] << 8) | bytes[bytes.length - 1];
    if (pruefsumme(daten) !== ps) return { ok: false, fehler: "Der Code stimmt nicht – bitte genau vergleichen (ein Zeichen falsch oder fehlt)." };
    var bitsDaten = [];
    daten.forEach(function (b) { for (var k = 7; k >= 0; k--) bitsDaten.push((b >> k) & 1); });
    try {
      var r = new Leser(bitsDaten);
      var version = r.feld(4);
      if (version < 1 || version > CODE_VERSION) return { ok: false, fehler: "Dieser Code ist von einer neueren Version des Spiels. Bitte erst die App aktualisieren." };
      var nK = r.feld(2), nW = r.feld(7), nF = r.feld(5), nFarben = r.feld(5), nMuster = r.feld(4), nOutfits = r.feld(4), nSpuren = r.feld(4);
      var nFelgen = version >= 2 ? r.feld(4) : 0, nBeif = version >= 2 ? r.feld(4) : 0;
      var aktiv = r.feld(2);
      var S = neuerSpielstand(), F = codeFahrzeuge();
      if (alterStand) {                                   // Einstellungen des Geräts behalten
        S.einstellungen = alterStand.einstellungen; S.gesehen = alterStand.gesehen || {};
        S.entwickler = alterStand.entwickler; if (alterStand.strecken) S.strecken = alterStand.strecken;
      }
      for (var ki = 0; ki < nK; ki++) {
        var kind = C.kinder[ki], p = neuesProfil();
        p.muenzen = r.zahl();
        var fzI = r.feld(5);
        for (var fi = 0; fi < nF; fi++) {
          var f = F[fi], fs = f ? neuesFahrzeug(f) : {};
          fs.gekauft = !!r.bit();
          if (fs.gekauft) {
            fs.upgrades = {};
            UPG.forEach(function (u) { var st = r.feld(3); if (st) fs.upgrades[u] = st; });
            if (r.bit()) fs.upgrades.allrad = 1;
            var fa = C.farben[r.feld(5)], mu = C.muster[r.feld(4)];
            if (fa) fs.farbe = fa.id;
            if (mu) fs.muster = mu.id;
          } else if (f && f.preis === 0) fs.gekauft = true;
          if (f) p.fahrzeuge[f.id] = fs;
        }
        p.farben = r.maske(nFarben, C.farben); p.muster = r.maske(nMuster, C.muster);
        p.outfits = r.maske(nOutfits, C.outfits);
        var oI = r.feld(4); if (C.outfits[oI]) p.outfit = C.outfits[oI].id;
        p.look = r.text() || null;
        p.spuren = r.maske(nSpuren, C.spuren);
        var sI = r.feld(4); if (C.spuren[sI]) p.spur = C.spuren[sI].id;
        if (version >= 2) {
          p.felgen = r.maske(nFelgen, C.felgen); var feI = r.feld(4); if (C.felgen[feI]) p.felge = C.felgen[feI].id;
          p.beifahrerListe = r.maske(nBeif, C.beifahrer); var bI = r.feld(4); if (C.beifahrer[bI]) p.beifahrer = C.beifahrer[bI].id;
        }
        for (var wi = 0; wi < nW; wi++) {
          var welt = C.welten[wi];
          for (var li = 0; li < 4; li++) {
            var geschafft = r.bit(), sterne = r.feld(2);
            if (welt && (geschafft || sterne)) p.level[welt.id + "-" + (li + 1)] = { geschafft: !!geschafft, sterne: sterne };
          }
          if (r.bit() && welt) p.freigeschaltet.push(welt.id);
          if (r.bit()) { var e = r.zahl(); if (welt) p.endlos[welt.id] = e; }
        }
        p.statistik = { fahrten: r.zahl(), meter: r.zahl(), salti: r.zahl(), muenzen: r.zahl() };
        var siege = r.zahl();
        if (kind) {
          if (F[fzI]) p.fahrzeug = F[fzI].id;
          var sauber = neuesProfil(); uebernimmProfil(sauber, p);     // gleiche Prüfungen wie beim Laden
          S.spieler[kind.id] = sauber; S.duell.siege[kind.id] = siege;
        }
      }
      if (C.kinder[aktiv]) S.aktiv = C.kinder[aktiv].id;
      return { ok: true, stand: S };
    } catch (e) {
      return { ok: false, fehler: "Der Code ist unvollständig." };
    }
  }

  FF.Spielstand = {
    neuesFahrzeug: neuesFahrzeug, neuesProfil: neuesProfil, neuerSpielstand: neuerSpielstand,
    uebernimmProfil: uebernimmProfil, weltIndex: weltIndex, lade: lade, alsText: alsText,
    codeErzeugen: codeErzeugen, codeLesen: codeLesen
  };
})();
