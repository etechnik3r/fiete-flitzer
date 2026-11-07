/* ===========================================================================
   Fiete Flitzer – config.js
   ---------------------------------------------------------------------------
   ALLE STELLSCHRAUBEN des Spiels an einem Ort: Physik, Fahrzeuge, Upgrades,
   Farben, Welten und Level. Wer das Spiel leichter/schwerer machen will,
   schaut zuerst hier hinein.

   Einheiten: SI – Meter, Kilogramm, Sekunden, Newton, Newtonmeter.
   Koordinaten im Fahrzeug: Ursprung = Schwerpunkt, x nach vorn, y nach oben.

   Diese Datei hat KEINE Abhängigkeit zum Browser (kein window/document) –
   sie wird auch von der Testfahrt in werkzeuge/testfahrt.js (Node) geladen.
   =========================================================================== */

var FF = globalThis.FF = globalThis.FF || {};

FF.CONFIG = {

  /* -------------------------------------------------------------------------
     1) PHYSIK-LÖSER
     ------------------------------------------------------------------------- */
  physik: {
    schrittweite: 1 / 240,     // feste Zeitschrittweite h [s] (240 Hz)
    iterationen: 8,            // Geschwindigkeits-Iterationen pro Schritt (Sequential Impulses)
    baumgarte: 0.2,            // Anteil des Lagefehlers, der pro Schritt korrigiert wird
    eindringToleranz: 0.005,   // erlaubte Eindringtiefe [m], verhindert Zittern
    kontaktRand: 0.03,         // spekulativer Kontakt-Abstand [m]
    maxWinkelGeschw: 14,       // Sicherheitsgrenze Karosserie-Drehrate [rad/s]
    huellReibung: 0.55,        // Reibwert Karosserie ↔ Boden
    huellAbprall: 0.1,         // Stoßzahl Karosserie ↔ Boden
    punktAbstand: 0.45         // Hüllkanten werden in Punkte mit max. diesem Abstand zerlegt [m]
  },

  /* -------------------------------------------------------------------------
     2) STEUERUNG + KAMERA
     ------------------------------------------------------------------------- */
  steuerung: {
    gasAnstieg: 7,             // wie schnell das Pedal "durchgetreten" wird [1/s]
    gasAbfall: 12,             // wie schnell es zurückgeht [1/s]
    rueckwaertsSchwelle: 0.8,  // unter dieser Vorwärtsgeschwindigkeit [m/s] fährt Bremse rückwärts
    rueckwaertsTempo: 0.4,     // Anteil von vmax beim Rückwärtsfahren
    rueckwaertsKraft: 0.6,     // Anteil des Drehmoments beim Rückwärtsfahren
    rueckGrenzeBremse: -14,    // ab hier [m] hinter dem Start kein Rückwärtsgang mehr, rückwärts wird aktiv gebremst
    rueckGrenzeWand: -22,      // spätestens hier [m] steht das Auto (unsichtbare Wand, Gelände beginnt bei -40 m)
    motorBremse: 0.03,         // Schleppmoment ohne Pedal (Anteil vom Drehmoment)
    motorBremseElektro: 0.1,   // dasselbe beim Elektroauto: der Motor bremst als Generator (lädt den Akku)
    eckDrehzahl: 0.35          // Bis zu diesem Anteil von vmax volles Drehmoment, danach konstante Leistung
  },

  kamera: {
    sichtHoehe: 10.5,          // sichtbare Höhe [m] im Querformat
    sichtBreiteHoch: 14,       // sichtbare Breite [m] im Hochformat
    vorausschau: 0.45,         // Kamera schaut v · diese Zeit [s] voraus
    zoomBeiTempo: 0.28,        // bis zu 28 % rauszoomen bei hohem Tempo
    tempoFuerZoom: 28,         // bei dieser Geschwindigkeit [m/s] ist voll rausgezoomt
    glaettung: 4.5             // Nachführ-Geschwindigkeit [1/s]
  },

  /* -------------------------------------------------------------------------
     3) SPIELREGELN
     ------------------------------------------------------------------------- */
  regeln: {
    leerlaufAnteil: 0.3,       // Tankverbrauch im Leerlauf (Anteil vom Vollgas-Verbrauch)
    tankWarnung: 0.25,         // ab hier blinkt die Tankanzeige
    stillstandBisEnde: 1.6,    // Tank leer + so lange stillstehen [s] → Fahrt vorbei
    maxRollzeitLeer: 14,       // spätestens nach so vielen Sekunden mit leerem Tank ist Schluss
    hoppla: {                  // Überschlag: KEIN "Tod" – ein Ballon stellt das Auto wieder hin
      dauer: 2.4,              // [s] Animation
      liegezeit: 2,            // so lange [s] auf Dach/Kopf/Seite ohne Pedal, bevor der Ballon hilft
      liegezeitMitPedal: 4,    // … wenn man noch Gas oder Bremse gibt (vielleicht kommt man selbst frei)
      seitenWinkel: 1.4        // ab diesem Winkel [rad] (≈ 80°) gilt "liegt auf der Seite" / hochkant
    },
    fest: {                    // Festgefahren: gemessen am Fortschritt nach vorn
      schritt: 2.5,            // so weit [m] muss das Auto über seinen bisher weitesten Punkt kommen
      tipp: 3.5,               // so lange [s] Pedal ohne Fortschritt → Tipp "Nimm Anlauf!"
      hilfe: 8,                // … → der Ballon trägt das Auto über das Hindernis
      hilfeLeicht: 6           // dasselbe bei Schwierigkeit "Leicht"
    },
    saltoBonus: 50,            // Münzen pro Salto
    loopingBonus: 75,          // Münzen pro geschafftem Looping
    roehrenLoopBonus: 20,      // … pro Looping in einer Röhre (Röhrenwelt: man fährt automatisch hindurch, darum weniger)
    extras: {                  // kleine Zusatz-Knöpfe links über der Bremse (selten, ändern das Spiel nicht grundsätzlich)
      boostDauer: 1.6,         // 🚀 Raketen-Boost: so lange [s] schießen Flammen aus den Düsen
      boostBeschl: 13,         // Schub als Beschleunigung [m/s²] entlang der Fahrzeug-Längsachse
      boostTempoMax: 2.1,      // … nur bis zum 2,1-fachen der Motor-Höchstgeschwindigkeit
      boostMax: 2,             // so viele Raketen-Ladungen kann man höchstens sammeln
      raketenProLevel: [1, 1, 2, 2],   // Raketen-Kanister je Level (Level 1–4); Endlos: alle raketenAbstandEndlos m
      raketenAbstandEndlos: 500,
      federSalti: 3,           // 🦘 Sprungfeder: lädt sich mit Saltos auf (ein Looping zählt wie ein Salto)
      federPause: 15,          // … nach dem Sprung so lange [s] Abkühlzeit; Saltos darin laden nicht auf
      federSprung: 8.5         // Absprung [m/s] senkrecht zum Auto-Boden
    },
    luftZeitMin: 1.2,          // ab so viel Flugzeit [s] gibt es einen Luftsprung-Bonus
    luftBonusProSekunde: 15,   // Münzen pro Sekunde Flugzeit
    sammelRadius: 0.75,        // Münze/Kanister wird eingesammelt, wenn so nah [m] an Rad, Kopf oder Karosserie
    sterne2: 0.6,              // ab 60 % der Münzen (Wert) gibt es 2 Sterne
    sterne3: 0.85,             // ab 85 % 3 Sterne (bis Version 15: 90 % – selbst der Roboter-Profi schaffte meist nur 2)
    zielBonusBasis: 100,       // Ziel-Bonus = (Basis + Welt-Nr · Zuschlag) · Sterne
    zielBonusZuschlag: 60,
    siegBonus: 100,            // Geisterrennen zu zweit: Extra-Münzen für den Sieg (Unentschieden: die Hälfte für beide)
    geistTakt: 1 / 20          // so oft [s] wird die Fahrt für den Geist aufgezeichnet
  },

  /* Schwierigkeit (Einstellungen): wirkt auf Hilfe, Tank und Luftsteuerung.
     bruchWinkel: Landet das Auto nach einem Sprung schiefer als dieser Winkel [°]
     zum Hang, ist es eine Bruchlandung (echte Achsen und Federbeine würden das
     nicht aushalten) → Ballon-Hilfe. Darum muss man die Nase in der Luft mit
     Gas (hoch) und Bremse (runter) passend zum Landehang stellen. */
  schwierigkeit: {
    leicht: { name: "Leicht", icon: "🐢", tank: 1.35, hopplaTank: 0.05, stabilisator: 1, luftsteuerung: 1.15, bruchWinkel: 80 },
    normal: { name: "Normal", icon: "🐇", tank: 1.0,  hopplaTank: 0.2,  stabilisator: 0, luftsteuerung: 1.0,  bruchWinkel: 40 },
    profi:  { name: "Profi",  icon: "🚀", tank: 0.85, hopplaTank: 0.26,  stabilisator: 0, luftsteuerung: 0.9,  bruchWinkel: 38 }
  },

  /* -------------------------------------------------------------------------
     4) FAHRZEUGE
     Felder:
       masse        Karosserie inkl. Fiete [kg]
       groesse      Länge/Höhe für das Trägheitsmoment J = m·(l²+h²)/12 [m]
       raeder       Aufhängepunkt x/y (Schwerpunkt-Koordinaten), Radius r, Radmasse, Antrieb
       federung     ruhe = entspannte Federlänge, weg = Federweg [m],
                    frequenz = Eigenfrequenz [Hz], daempfung = Dämpfungsgrad ζ
       motor        drehmoment = Summe an den Antriebsrädern [Nm], vmax [m/s],
                    eck = bis zu diesem Anteil von vmax volles Drehmoment (sonst steuerung.eckDrehzahl)
       bremse       Bremsmoment gesamt [Nm]
       grip         Reifen-Reibwert µ (Spitzenwert der Kraftschlusskurve)
       tankSekunden so lange reicht ein voller Tank bei Vollgas [s]
       leerlauf     Verbrauch im Stand (Anteil vom Vollgas-Verbrauch; sonst regeln.leerlaufAnteil)
       rekuperation Elektroauto: Anteil der Bremsleistung, der zurück in den Akku fließt
       akku         true = Akku statt Tank (Anzeige, Kanister werden zu Batterien)
       luftsteuerung Winkelbeschleunigung in der Luft [rad/s²] (Spiel-Hilfe, s. README)
       cwA, abtrieb Luftwiderstandsfläche cw·A und Abtriebsfläche cA·A [m²]
       huelle       Umriss der Karosserie (Kollision), dach = Punkte "Dach/Überrollbügel",
       kopf         Fietes Kopf (Kreis) – berührt er den Boden → "Hoppla!"
       klang        Motorgeräusch (klang.js), darf fehlen (dann klingt es wie der Flitzer):
                    art "verbrenner": zylinder, takte (2/4), leerlauf/max [U/min], gaenge,
                      abkling (Druckstoß), ungleich (Ungleichförmigkeit), v8 (Bollern der
                      Zylinderbänke), rohr = Auspuff-Laufzeit [s] + rueck (Rückkopplung),
                      koerper = Körperresonanz [Hz], hell, diesel (Nageln), unruhe [Cent],
                      traegheit [1/s], knallen (Puffen beim Gaswegnehmen);
                    art "elektro": surren [Hz bei Höchstdrehzahl], avasTon [Hz] (Warnklang),
                      max [U/min] für den Drehzahlmesser, weltraum (Wabern);
                    für alle: lautstaerke, abrollen (Stärke der Reifen-/Abrollgeräusche)
     ------------------------------------------------------------------------- */
  fahrzeuge: [
    {
      id: "flitzer", name: "Flitzer", emoji: "🚙", preis: 0, preisBasis: 120,
      text: "Der flinke Buggy – kann von allem ein bisschen.",
      masse: 240, groesse: { laenge: 2.9, hoehe: 1.0 },
      raeder: [
        { x: -1.05, y: -0.05, r: 0.42, masse: 18, antrieb: true },
        { x:  1.05, y: -0.05, r: 0.40, masse: 16, antrieb: false }
      ],
      federung: { ruhe: 0.36, weg: 0.26, frequenz: 1.9, daempfung: 0.42 },
      motor: { drehmoment: 640, vmax: 16 }, bremse: 900, grip: 0.95,
      tankSekunden: 21, luftsteuerung: 5.5, cwA: 0.45, abtrieb: 0,
      huelle: [[-1.45, -0.30], [1.30, -0.30], [1.55, 0.02], [1.25, 0.30], [0.35, 0.34], [-1.45, 0.34]],
      dach: [[-0.80, 1.06], [0.02, 1.06]],
      kopf: { x: -0.32, y: 0.70, r: 0.30 },
      farbe: "orange", form: "buggy",
      klang: { art: "verbrenner", zylinder: 4, takte: 4, leerlauf: 900, max: 5600, gaenge: 4, abkling: 7, ungleich: 0.35,
               rohr: 0.0065, rueck: 0.45, koerper: 150, hell: 1.0, diesel: 0.1, unruhe: 12, traegheit: 12, lautstaerke: 1.0 },
      upgrades: ["motor", "reifen", "federung", "tank", "kreisel", "spoiler", "bremse", "leichtbau", "allrad"]
    },
    {
      id: "traktor", name: "Trecker", emoji: "🚜", preis: 2000, preisBasis: 150,
      text: "Riesige Hinterräder und Bärenkraft! Aber Vorsicht: Mit zu viel Gas am Berg hebt er vorne ab.",
      masse: 520, groesse: { laenge: 3.2, hoehe: 1.8 },
      raeder: [
        { x: -0.85, y:  0.00, r: 0.68, masse: 45, antrieb: true },
        { x:  1.15, y: -0.25, r: 0.40, masse: 18, antrieb: false }
      ],
      federung: { ruhe: 0.25, weg: 0.18, frequenz: 2.0, daempfung: 0.5 },
      motor: { drehmoment: 3000, vmax: 16.5 }, bremse: 3000, grip: 1.15,
      tankSekunden: 27, luftsteuerung: 3.4, cwA: 0.9, abtrieb: 0,
      huelle: [[-1.45, -0.20], [1.60, -0.20], [1.72, 0.55], [0.05, 0.70], [-1.45, 0.20]],
      dach: [[-1.45, 1.66], [-0.05, 1.66]],
      kopf: { x: -0.70, y: 0.86, r: 0.30 },
      farbe: "gruen", form: "traktor",
      klang: { art: "verbrenner", zylinder: 3, takte: 4, leerlauf: 750, max: 2700, gaenge: 4, abkling: 6, ungleich: 0.25,
               rohr: 0.011, rueck: 0.55, koerper: 95, hell: 0.7, diesel: 0.9, unruhe: 10, traegheit: 7, lautstaerke: 1.05, abrollen: 1.2 },
      upgrades: ["motor", "reifen", "federung", "tank", "kreisel", "spoiler", "bremse", "allrad"]
    },
    {
      id: "moped", name: "Hüpf-Moped", emoji: "🛵", preis: 3500, preisBasis: 160,
      text: "Leicht wie ein Floh – macht tolle Saltos, kippt aber schnell.",
      masse: 110, groesse: { laenge: 1.9, hoehe: 1.3 },
      raeder: [
        { x: -0.68, y: 0.04, r: 0.36, masse: 9, antrieb: true },
        { x:  0.72, y: 0.04, r: 0.36, masse: 8, antrieb: false }
      ],
      federung: { ruhe: 0.32, weg: 0.28, frequenz: 2.2, daempfung: 0.4 },
      motor: { drehmoment: 300, vmax: 17 }, bremse: 420, grip: 1.0,
      tankSekunden: 19.5, luftsteuerung: 6.5, cwA: 0.35, abtrieb: 0,
      huelle: [[-0.78, -0.16], [0.70, -0.16], [0.86, 0.36], [0.30, 0.30], [-0.82, 0.30]],
      dach: [],
      kopf: { x: -0.08, y: 0.98, r: 0.30 },
      farbe: "tuerkis", form: "moped",
      klang: { art: "verbrenner", zylinder: 1, takte: 2, leerlauf: 1700, max: 9500, gaenge: 3, abkling: 9, ungleich: 0.1,
               rohr: 0.0035, rueck: 0.6, koerper: 420, hell: 1.3, diesel: 0.05, unruhe: 20, traegheit: 18, lautstaerke: 0.75, abrollen: 0.6 },
      upgrades: ["motor", "reifen", "federung", "tank", "kreisel", "spoiler", "bremse", "leichtbau"]
    },
    {
      id: "eauto", name: "E-Auto", emoji: "⚡", preis: 5000, preisBasis: 180,
      text: "Leise und spritzig, mit schwerem Akku ganz unten. Bremsen lädt den Akku wieder auf!",
      masse: 300, groesse: { laenge: 3.3, hoehe: 1.0 },
      raeder: [
        { x: -1.10, y: 0.02, r: 0.38, masse: 15, antrieb: true },
        { x:  1.15, y: 0.02, r: 0.38, masse: 15, antrieb: false }
      ],
      federung: { ruhe: 0.30, weg: 0.22, frequenz: 2.0, daempfung: 0.5 },
      // Elektromotor: volles Drehmoment bis 55 % der Höchstgeschwindigkeit (eck), kein Leerlauf-Verbrauch
      motor: { drehmoment: 900, vmax: 19, eck: 0.55 }, bremse: 1300, grip: 1.0,
      tankSekunden: 14.5, luftsteuerung: 5.0, cwA: 0.36, abtrieb: 0,
      leerlauf: 0, rekuperation: 0.6, akku: true,
      huelle: [[-1.60, -0.30], [1.62, -0.30], [1.74, -0.02], [1.40, 0.30], [0.60, 0.44], [-0.30, 0.76], [-1.40, 0.46], [-1.62, 0.05]],
      dach: [[-0.80, 0.76], [0.10, 0.72]],
      kopf: { x: -0.14, y: 0.5, r: 0.26 },
      farbe: "eisblau", form: "eauto",
      klang: { art: "elektro", surren: 2100, avasTon: 330, max: 15000, lautstaerke: 1.0, abrollen: 1.1 },
      upgrades: ["motor", "reifen", "federung", "tank", "kreisel", "spoiler", "bremse", "leichtbau", "allrad"]
    },
    {
      id: "bus", name: "Bummel-Bus", emoji: "🚌", preis: 7000, preisBasis: 220,
      text: "Lang, schwer und kaum umzuwerfen – aber in der Luft dreht er sich nur langsam.",
      masse: 900, groesse: { laenge: 5.4, hoehe: 2.0 },
      raeder: [
        { x: -1.75, y: -0.15, r: 0.50, masse: 40, antrieb: true },
        { x:  1.85, y: -0.15, r: 0.50, masse: 40, antrieb: false }
      ],
      federung: { ruhe: 0.30, weg: 0.24, frequenz: 1.6, daempfung: 0.5 },
      motor: { drehmoment: 3300, vmax: 17 }, bremse: 4200, grip: 1.0,
      tankSekunden: 17, luftsteuerung: 2.5, cwA: 1.6, abtrieb: 0,
      huelle: [[-2.70, -0.35], [2.70, -0.35], [2.78, 0.60], [2.55, 1.55], [-2.70, 1.55]],
      dach: [[-2.60, 1.60], [0.00, 1.60], [2.45, 1.60]],
      kopf: { x: 2.05, y: 0.86, r: 0.28 },
      farbe: "gelb", form: "bus",
      klang: { art: "verbrenner", zylinder: 6, takte: 4, leerlauf: 650, max: 2500, gaenge: 5, abkling: 6, ungleich: 0.15,
               rohr: 0.013, rueck: 0.5, koerper: 80, hell: 0.65, diesel: 0.6, unruhe: 8, traegheit: 6, lautstaerke: 1.1, abrollen: 1.3 },
      upgrades: ["motor", "reifen", "federung", "tank", "kreisel", "spoiler", "bremse", "leichtbau", "allrad"]
    },
    {
      id: "monster", name: "Monster-Max", emoji: "🛻", preis: 10000, preisBasis: 280,
      text: "Gigantische Räder, langer Federweg und Allrad – aber hoher Schwerpunkt!",
      masse: 650, groesse: { laenge: 3.6, hoehe: 1.6 },
      raeder: [
        { x: -1.30, y: 0.00, r: 0.78, masse: 45, antrieb: true },
        { x:  1.30, y: 0.00, r: 0.78, masse: 45, antrieb: true }
      ],
      federung: { ruhe: 0.55, weg: 0.50, frequenz: 1.4, daempfung: 0.45 },
      motor: { drehmoment: 2700, vmax: 19 }, bremse: 3200, grip: 1.1,
      tankSekunden: 20.5, luftsteuerung: 5.0, cwA: 1.1, abtrieb: 0,
      huelle: [[-1.80, 0.05], [1.85, 0.05], [1.92, 0.55], [0.90, 0.70], [0.55, 1.25], [-0.50, 1.25], [-0.70, 0.70], [-1.80, 0.62]],
      dach: [[-0.45, 1.30], [0.50, 1.30]],
      kopf: { x: 0.05, y: 0.96, r: 0.28 },
      farbe: "rot", form: "monster",
      klang: { art: "verbrenner", zylinder: 8, takte: 4, leerlauf: 750, max: 5800, gaenge: 4, abkling: 6, ungleich: 0.4, v8: true,
               rohr: 0.008, rueck: 0.5, koerper: 105, hell: 0.85, diesel: 0.1, unruhe: 14, traegheit: 10, lautstaerke: 1.15, knallen: 0.3, abrollen: 1.4 },
      upgrades: ["motor", "reifen", "federung", "tank", "kreisel", "spoiler", "bremse", "leichtbau"]
    },
    {
      id: "renner", name: "Blitz-Rakete", emoji: "🏎️", preis: 15000, preisBasis: 340,
      text: "Superschnell mit Heckflügel: Abtrieb drückt ihn bei Tempo fest auf die Straße.",
      masse: 330, groesse: { laenge: 4.0, hoehe: 0.8 },
      raeder: [
        { x: -1.35, y: -0.05, r: 0.36, masse: 16, antrieb: true },
        { x:  1.35, y: -0.05, r: 0.34, masse: 14, antrieb: false }
      ],
      federung: { ruhe: 0.18, weg: 0.13, frequenz: 3.0, daempfung: 0.6 },
      motor: { drehmoment: 1150, vmax: 30 }, bremse: 1800, grip: 1.05,
      tankSekunden: 15.5, luftsteuerung: 4.0, cwA: 0.35, abtrieb: 1.4,
      huelle: [[-2.00, -0.22], [2.05, -0.22], [2.12, -0.05], [0.60, 0.25], [-1.40, 0.35], [-2.00, 0.32]],
      dach: [[-1.95, 0.78], [-0.22, 0.72]],
      kopf: { x: -0.25, y: 0.42, r: 0.26 },
      farbe: "blau", form: "renner",
      klang: { art: "verbrenner", zylinder: 10, takte: 4, leerlauf: 1200, max: 9500, gaenge: 6, abkling: 11, ungleich: 0.15,
               rohr: 0.0045, rueck: 0.45, koerper: 260, hell: 1.4, diesel: 0, unruhe: 10, traegheit: 16, lautstaerke: 0.9, knallen: 0.5, abrollen: 0.8 },
      upgrades: ["motor", "reifen", "federung", "tank", "kreisel", "spoiler", "bremse", "leichtbau", "allrad"]
    },
    {
      id: "mond", name: "Mondmobil", emoji: "🚀", preis: 22000, preisBasis: 400,
      text: "Sechs Räder, alle angetrieben, superweiche Federn – kraxelt überall hoch. Fährt mit Akku wie die echten Mondautos.",
      masse: 300, groesse: { laenge: 3.4, hoehe: 1.2 },
      raeder: [
        { x: -1.30, y: -0.10, r: 0.45, masse: 14, antrieb: true },
        { x:  0.00, y: -0.10, r: 0.45, masse: 14, antrieb: true },
        { x:  1.30, y: -0.10, r: 0.45, masse: 14, antrieb: true }
      ],
      federung: { ruhe: 0.40, weg: 0.38, frequenz: 1.5, daempfung: 0.55 },
      motor: { drehmoment: 1300, vmax: 18 }, bremse: 1500, grip: 1.15,
      tankSekunden: 12, luftsteuerung: 7.5, cwA: 0.6, abtrieb: 0,
      leerlauf: 0, rekuperation: 0.3, akku: true,
      huelle: [[-1.75, -0.20], [1.75, -0.20], [1.82, 0.25], [-1.75, 0.25]],
      dach: [[-0.05, 1.16]],
      kopf: { x: -0.05, y: 0.70, r: 0.32 },
      farbe: "weiss", form: "mond",
      klang: { art: "elektro", surren: 900, avasTon: 220, max: 9000, weltraum: true, lautstaerke: 1.0, abrollen: 1.0 },
      upgrades: ["motor", "reifen", "federung", "tank", "kreisel", "spoiler", "bremse", "leichtbau"]
    },
    {
      /* E-Skateboard: Das Kind steht drauf (Schwerpunkt hoch, Kopf oben) – leicht,
         flott, sehr wendig in der Luft, aber wackelig. Akku im Brett. */
      id: "skateboard", name: "E-Skateboard", emoji: "🛹", preis: 8000, preisBasis: 200,
      text: "Elektro-Skateboard: Du stehst drauf! Flink und wendig – aber wackelig.",
      masse: 75, groesse: { laenge: 1.2, hoehe: 1.6 },
      raeder: [
        { x: -0.52, y: -0.40, r: 0.21, masse: 2.5, antrieb: true },
        { x:  0.52, y: -0.40, r: 0.21, masse: 2.5, antrieb: false }
      ],
      federung: { ruhe: 0.12, weg: 0.1, frequenz: 2.2, daempfung: 0.7 },
      motor: { drehmoment: 55, vmax: 15.5, eck: 0.5 }, bremse: 140, grip: 1.1,
      tankSekunden: 25, luftsteuerung: 7.0, cwA: 0.5, abtrieb: 0,
      balance: 1.0,                     // das Kind balanciert am Boden selbst (wie der Stabilisator bei „Leicht“)
      leerlauf: 0, rekuperation: 0.4, akku: true,
      huelle: [[-0.68, -0.40], [0.68, -0.40], [0.74, -0.30], [-0.74, -0.30]],
      dach: [[0.0, 0.62], [-0.05, 0.3]],
      kopf: { x: 0.02, y: 0.86, r: 0.28 },
      farbe: "lila", form: "skateboard",
      klang: { art: "elektro", surren: 3200, avasTon: 440, max: 22000, lautstaerke: 0.8, abrollen: 0.9 },
      upgrades: ["motor", "reifen", "federung", "tank", "kreisel", "spoiler", "bremse", "leichtbau"]
    },
    {
      /* Propeller-Flieger mit offenem Cockpit: fährt wie ein Auto, aber nahe am Boden
         trägt der Bodeneffekt (auftrieb): mit Tempo wird er leichter und segelt weiter.
         Ab hoehe [m] über dem Boden ist der Auftrieb weg – höher fliegen geht nicht.
         In der Luft schiebt der Propeller ein wenig (schub [m/s²], weniger als g). */
      id: "flugzeug", name: "Propeller-Flieger", emoji: "✈️", preis: 30000, preisBasis: 450,
      text: "Ein kleiner Flieger mit offenem Cockpit. Er segelt knapp über dem Boden – aber hoch hinaus kommt er nicht.",
      masse: 320, groesse: { laenge: 3.8, hoehe: 1.2 },
      raeder: [
        { x: -1.55, y: -0.05, r: 0.2, masse: 6, antrieb: false },
        { x:  0.75, y: -0.15, r: 0.4, masse: 14, antrieb: true }
      ],
      federung: { ruhe: 0.32, weg: 0.24, frequenz: 1.8, daempfung: 0.5 },
      motor: { drehmoment: 1150, vmax: 20 }, bremse: 1300, grip: 1.0,
      tankSekunden: 17, luftsteuerung: 5.0, cwA: 0.5, abtrieb: 0,
      auftrieb: { max: 0.5, vRef: 22, hoehe: 3.2, boden: 0.75 }, schub: 3.5,
      huelle: [[-1.9, 0.05], [1.5, -0.12], [1.8, 0.15], [1.5, 0.42], [-1.4, 0.38], [-1.95, 0.85]],
      dach: [[-0.25, 0.98]],
      kopf: { x: -0.25, y: 0.62, r: 0.28 },
      farbe: "rot", form: "flugzeug",
      klang: { art: "verbrenner", zylinder: 4, takte: 4, leerlauf: 800, max: 2900, gaenge: 1, abkling: 8, ungleich: 0.2,
               rohr: 0.005, rueck: 0.4, koerper: 140, hell: 1.15, diesel: 0.05, unruhe: 10, traegheit: 8, lautstaerke: 1.0, abrollen: 0.8 },
      upgrades: ["motor", "reifen", "federung", "tank", "kreisel", "spoiler", "bremse", "leichtbau"]
    },
    {
      /* Turbinen-Sofa: ein Sofa auf Möbelrollen, hinten eine Flugzeugturbine. Die Räder
         treiben kaum an – die Turbine schiebt (turbine.schub [m/s²] entlang des Sofas,
         auch in der Luft), braucht aber erst „anlauf“ Sekunden zum Hochdrehen.
         Weiche Polster, gut gedämpft (hüpft nach Sprüngen nicht mehr endlos). Durstig! */
      id: "sofa", name: "Turbinen-Sofa", emoji: "🛋️", preis: 18000, preisBasis: 380,
      text: "Ein Sofa mit Flugzeugturbine! Erst jault sie, dann faucht sie – und dann geht's ab. Festhalten!",
      masse: 230, groesse: { laenge: 2.6, hoehe: 1.3 },
      raeder: [
        { x: -0.95, y: -0.28, r: 0.24, masse: 5, antrieb: true },
        { x:  0.95, y: -0.28, r: 0.24, masse: 5, antrieb: false }
      ],
      federung: { ruhe: 0.2, weg: 0.18, frequenz: 1.7, daempfung: 0.6 },
      motor: { drehmoment: 260, vmax: 20 }, bremse: 1100, grip: 0.95,
      tankSekunden: 23, luftsteuerung: 5.0, cwA: 0.9, abtrieb: 0,
      turbine: { schub: 2.8, anlauf: 1.4, vmax: 20 },
      huelle: [[-1.3, -0.3], [1.3, -0.3], [1.35, 0.25], [1.05, 0.3], [-0.95, 0.3], [-1.2, 1.05], [-1.95, 1.0], [-1.95, 0.6], [-1.3, 0.45]],
      dach: [[-0.95, 1.05], [0.3, 0.95]],
      kopf: { x: -0.1, y: 0.82, r: 0.28 },
      farbe: "pink", form: "sofa",
      klang: { art: "turbine", max: 30000, leerlauf: 7000, traegheit: 1.5, lautstaerke: 1.0, abrollen: 0.7 },
      upgrades: ["motor", "reifen", "federung", "tank", "kreisel", "spoiler", "bremse", "leichtbau"]
    },
    {
      /* Dampf-Lok mit Kohlewagen und kleinem Anhänger. Drei Starrkörper, jeweils über
         ein Drehgelenk verbunden (physik.js): haken = Kupplung hinten, deichsel = Spitze
         der Deichsel vorn am Anhänger, knick = größter Winkel zum Vordermann [rad],
         gelenk = Federung der Kupplung (frequenz [Hz], daempfung ζ – wenig Dämpfung:
         der Anhänger ruckelt und wackelt). Der Zug ist lang: Looping-Bahnen fährt er
         nicht (er rollt unten durch), und in der Luft dreht er sich als Ganzes nur
         langsam – luftsteuerung ist hier die Winkelbeschleunigung des ganzen Zuges,
         maxDrehung die größte Drehrate [rad/s], die man selbst noch steuern kann.
         Dampfmaschine: volle Kraft schon beim Anfahren (eck), Kuppelstangen verbinden
         alle Räder (kuppelstange). bruchExtra [°]: so viel schiefer darf der lange Zug
         landen, bevor es eine Bruchlandung ist (seine Federn schlucken mehr). */
      id: "dampflok", name: "Dampf-Lok", emoji: "🚂", preis: 26000, preisBasis: 420,
      text: "Tschu-tschu! Eine kleine Dampflok mit Kohlewagen und Anhänger. Zu lang für Saltos und Loopings – aber lenken kann man sie trotzdem.",
      masse: 560, groesse: { laenge: 2.9, hoehe: 1.5 },
      raeder: [
        { x: -0.62, y: -0.12, r: 0.42, masse: 22, antrieb: true },
        { x:  0.36, y: -0.12, r: 0.42, masse: 22, antrieb: true },
        { x:  1.12, y: -0.12, r: 0.24, masse: 8, antrieb: true }
      ],
      federung: { ruhe: 0.24, weg: 0.18, frequenz: 1.8, daempfung: 0.45 },
      motor: { drehmoment: 2500, vmax: 16, eck: 0.45 }, bremse: 2800, grip: 1.1,
      tankSekunden: 27, luftsteuerung: 2.4, maxDrehung: 1.1, kuppelstange: true, bruchExtra: 10, cwA: 1.0, abtrieb: 0,
      huelle: [[-1.38, -0.25], [1.5, -0.25], [1.56, 0.08], [1.38, 0.62], [-0.3, 0.62], [-0.26, 1.3], [-1.42, 1.3], [-1.38, 0.3]],
      dach: [[-1.38, 1.36], [-0.3, 1.36], [1.02, 1.16]],
      kopf: { x: -0.82, y: 0.74, r: 0.28 },
      haken: [-1.5, -0.14],
      anhaenger: [
        { form: "kohlewagen", masse: 85, groesse: { laenge: 1.5, hoehe: 0.9 },
          raeder: [ { x: -0.45, y: -0.14, r: 0.25, masse: 7 }, { x: 0.45, y: -0.14, r: 0.25, masse: 7 } ],
          federung: { ruhe: 0.2, weg: 0.14, frequenz: 2.0, daempfung: 0.35 },
          grip: 1.0, cwA: 0.5, abtrieb: 0,
          huelle: [[-0.74, -0.2], [0.74, -0.2], [0.74, 0.55], [0.2, 0.78], [-0.2, 0.78], [-0.74, 0.55]],
          deichsel: [1.2, 0.06], haken: [-0.86, 0.0], knick: 0.45,
          gelenk: { frequenz: 6, daempfung: 0.35 } },
        { form: "anhaenger", masse: 45, groesse: { laenge: 1.3, hoehe: 0.8 },
          raeder: [ { x: -0.12, y: -0.1, r: 0.3, masse: 6 } ],
          federung: { ruhe: 0.18, weg: 0.14, frequenz: 2.3, daempfung: 0.12 },
          grip: 1.0, cwA: 0.4, abtrieb: 0,
          huelle: [[-0.66, -0.14], [0.66, -0.14], [0.66, 0.42], [-0.66, 0.42]],
          deichsel: [1.62, 0.02], knick: 0.6,
          gelenk: { frequenz: 3.2, daempfung: 0.12 } }
      ],
      farbe: "schwarz", form: "dampflok",
      klang: { art: "dampf", max: 420, lautstaerke: 1.0, abrollen: 1.3 },
      upgrades: ["motor", "reifen", "federung", "tank", "kreisel", "spoiler", "bremse", "leichtbau"]
    },
    {
      /* Wasserstoffauto (Version 31): Brennstoffzelle unter der Haube macht aus Wasserstoff
         und Luft Strom – also fährt es wie ein E-Auto (volles Drehmoment aus dem Stand), aber
         aus dem Auspuff kommt nur Wasser. Zwei große H₂-Tanks stehen hinten (der Schwerpunkt
         liegt dadurch etwas weiter hinten: Mit Vollgas hebt die Nase leichter ab). Gesammelt
         werden blaue H₂-Flaschen. Keine Rekuperation in den Tank – Wasserstoff entsteht nicht
         beim Bremsen. */
      id: "wasserstoff", name: "H₂-Blubber", emoji: "💧", preis: 12000, preisBasis: 300,
      text: "Fährt mit Wasserstoff! Aus dem Auspuff tropft nur Wasser – sammle die blauen H₂-Flaschen.",
      masse: 340, groesse: { laenge: 3.4, hoehe: 1.4 },
      raeder: [
        { x: -1.10, y: 0.00, r: 0.40, masse: 16, antrieb: true },
        { x:  1.15, y: 0.00, r: 0.40, masse: 16, antrieb: false }
      ],
      federung: { ruhe: 0.32, weg: 0.24, frequenz: 1.9, daempfung: 0.5 },
      motor: { drehmoment: 980, vmax: 19.5, eck: 0.55 }, bremse: 1400, grip: 1.0,
      tankSekunden: 16, luftsteuerung: 5.0, cwA: 0.4, abtrieb: 0,
      leerlauf: 0, wasserstoff: true,
      huelle: [[-1.62, -0.30], [1.62, -0.30], [1.76, 0.04], [1.35, 0.36], [0.60, 0.44], [-0.20, 1.02], [-0.90, 0.60],
               [-1.10, 1.12], [-1.55, 1.12], [-1.66, 0.10]],
      dach: [[-0.55, 0.96], [0.10, 0.90], [-1.50, 1.14], [-1.15, 1.14]],
      kopf: { x: -0.24, y: 0.64, r: 0.26 },
      farbe: "weiss", form: "wasserstoff",
      klang: { art: "elektro", surren: 1800, avasTon: 392, max: 14000, lautstaerke: 1.0, abrollen: 1.1, brennstoffzelle: true },
      upgrades: ["motor", "reifen", "federung", "tank", "kreisel", "spoiler", "bremse", "leichtbau", "allrad"]
    },
    {
      /* Donner-Truck (Version 37): amerikanische Zugmaschine – lange Motorhaube, Chromgrill,
         Schlafkabine, zwei hohe Auspuffrohre mit schwarzem Rauch. Kräftig, aber träge:
           • niedrige Höchstgeschwindigkeit (gut 41 km/h, Version 39: −15 %), aber riesiges Drehmoment, das bis
             fast zum Höchsttempo anliegt (eck 0,9) – bergauf verliert er kaum Tempo
           • matschFest: Pfützen, Matsch und Schleim bremsen ihn nur zu 30 %
           • schwer und lang, in der Luft dreht er sich nur langsam (luftsteuerung 1,7; Bus 2,5); dafür darf er wie die Lok 10° schiefer landen (bruchExtra), der lange Radstand fängt das ab
         Antrieb auf beiden Hinterachsen (Tandem), vorne die Lenkachse. */
      id: "lkw", name: "Donner-Truck", emoji: "🚛", preis: 14000, preisBasis: 320,
      text: "Ein riesiger Truck: gemütlich, aber bärenstark – Berge, Matsch und Schleim schaffen ihn kaum. In der Luft ganz träge.",
      masse: 1300, groesse: { laenge: 5.3, hoehe: 2.2 },
      raeder: [
        { x: -1.95, y: -0.10, r: 0.55, masse: 55, antrieb: true },
        { x: -0.80, y: -0.10, r: 0.55, masse: 55, antrieb: true },
        { x:  1.75, y: -0.10, r: 0.55, masse: 50, antrieb: false }
      ],
      federung: { ruhe: 0.28, weg: 0.22, frequenz: 1.5, daempfung: 0.55 },
      motor: { drehmoment: 9000, vmax: 11.5, eck: 0.9 }, bremse: 7000, grip: 1.15,
      tankSekunden: 24, luftsteuerung: 1.7, bruchExtra: 10, cwA: 2.4, abtrieb: 0, matschFest: 0.3,
      huelle: [[-2.55, -0.08], [-1.4, -0.12], [1.2, -0.12], [2.72, -0.20], [2.72, 0.15], [2.52, 1.05], [0.95, 1.12], [0.88, 1.82], [-1.30, 2.02], [-1.38, 0.25], [-2.55, 0.25]],
      dach: [[-1.20, 2.02], [-0.10, 1.95], [0.80, 1.84]],
      kopf: { x: 0.42, y: 1.18, r: 0.28 },
      farbe: "rot", form: "lkw",
      klang: { art: "verbrenner", zylinder: 6, takte: 4, leerlauf: 520, max: 2000, gaenge: 6, abkling: 6, ungleich: 0.12,
               rohr: 0.016, rueck: 0.55, koerper: 95, hell: 0.5, diesel: 0.9, unruhe: 6, traegheit: 8, lautstaerke: 1.2, abrollen: 1.5 },
      upgrades: ["motor", "reifen", "federung", "tank", "kreisel", "spoiler", "bremse"]
    },
    {
      /* Seifenkiste (Version 39): aus einem Umzugskarton gebastelt, mit Klebeband und
         Filzstift. Kein Motor – das Kind läuft mit den Füßen unten durch den offenen Boden
         (fussAntrieb). Eigenarten:
           • freilauf: ohne Pedal rollt sie ganz frei (keine Motorbremse) – bergab wird sie
             schneller als ihr Lauftempo (vmax gilt nur fürs Laufen)
           • puste: Statt Benzin hat das Kind Puste. Beim Rollen ohne Gas (ab 2 m/s) kommt
             sie langsam zurück (erholung: Anteil des Verbrauchs bei Vollgas). Gesammelt
             werden Äpfel 🍎 statt Kanister.
           • Pappe federt: weiche Federung, darf 15° schiefer landen (bruchExtra)
           • leicht und klein: bergauf mühsam, in der Luft gut zu drehen */
      id: "seifenkiste", name: "Seifenkiste", emoji: "📦", preis: 3000, preisBasis: 120,
      text: "Selbst gebastelt aus einem Karton! Du läufst mit den Füßen – und bergab rollt sie frei und wird richtig schnell. Ohne Gas kommt die Puste zurück.",
      masse: 55, groesse: { laenge: 2.0, hoehe: 1.1 },
      raeder: [
        { x: -0.72, y: -0.12, r: 0.25, masse: 3, antrieb: true },
        { x:  0.72, y: -0.12, r: 0.25, masse: 3, antrieb: true }
      ],
      federung: { ruhe: 0.14, weg: 0.13, frequenz: 2.3, daempfung: 0.4 },
      motor: { drehmoment: 90, vmax: 9.5, eck: 0.5 }, bremse: 420, grip: 1.0,
      tankSekunden: 34, luftsteuerung: 6.0, bruchExtra: 15, cwA: 0.45, abtrieb: 0,
      leerlauf: 0, fussAntrieb: true, freilauf: true, puste: { erholung: 0.45 },
      huelle: [[-0.98, -0.12], [0.98, -0.12], [1.02, 0.36], [-0.98, 0.40]],
      dach: [[-0.3, 0.98], [0.05, 0.94]],
      kopf: { x: -0.12, y: 0.62, r: 0.28 },
      farbe: "orange", form: "seifenkiste",
      klang: { art: "elektro", surren: 600, avasTon: 220, max: 4000, lautstaerke: 0.15, abrollen: 1.5 },
      upgrades: ["motor", "reifen", "federung", "tank", "kreisel", "bremse", "leichtbau"]
    },
    {
      /* E-Scooter (Version 39): Tretroller mit Elektromotor im Hinterrad. Das Kind steht
         drauf und hält den Lenker. Eigenarten:
           • sehr wendig: dreht in der Luft am schnellsten von allen (luftsteuerung 8,5)
           • zieht sofort los (volles Drehmoment fast bis zum Höchsttempo, eck 0,8),
             aber das Höchsttempo ist niedrig (10 m/s = 36 km/h)
           • Stunts: Bei hohen Sprüngen zeigt das Kind Tricks – Flieger (am Lenker
             ausgestreckt), Hände hoch, Bein nach hinten – und steht vor der Landung
             wieder sicher auf dem Brett (nur Grafik, spiel.js stuntAktualisieren)
           • balanciert am Boden selbst (wie das Skateboard), lädt beim Bremsen */
      id: "scooter", name: "E-Scooter", emoji: "🛴", preis: 5000, preisBasis: 160,
      text: "Ein E-Scooter: zieht sofort los und ist super wendig – bei hohen Sprüngen machst du Stunts! Aber er fährt nicht besonders schnell.",
      masse: 68, groesse: { laenge: 1.3, hoehe: 1.7 },
      raeder: [
        { x: -0.5, y: -0.42, r: 0.17, masse: 2, antrieb: true },
        { x:  0.54, y: -0.42, r: 0.17, masse: 2, antrieb: false }
      ],
      federung: { ruhe: 0.09, weg: 0.08, frequenz: 2.5, daempfung: 0.7 },
      motor: { drehmoment: 46, vmax: 10, eck: 0.8 }, bremse: 170, grip: 1.1,
      tankSekunden: 30, luftsteuerung: 8.5, cwA: 0.45, abtrieb: 0,
      balance: 1.0, leerlauf: 0, rekuperation: 0.3, akku: true,
      huelle: [[-0.66, -0.42], [0.66, -0.42], [0.68, -0.32], [-0.66, -0.32]],
      dach: [[0.0, 0.62], [-0.05, 0.3]],
      kopf: { x: 0.0, y: 0.88, r: 0.28 },
      farbe: "blau", form: "scooter",
      klang: { art: "elektro", surren: 3800, avasTon: 494, max: 26000, lautstaerke: 0.75, abrollen: 0.9 },
      upgrades: ["motor", "reifen", "federung", "tank", "kreisel", "spoiler", "bremse", "leichtbau"]
    }
  ],

  /* -------------------------------------------------------------------------
     5) UPGRADES – pro Fahrzeug, je 5 Stufen (Allrad: 1 Stufe)
     Preis einer Stufe s (0-basiert): preisBasis · faktor^s (gerundet auf 10)
     ------------------------------------------------------------------------- */
  upgrades: {
    motor:    { name: "Motor",    icon: "🔧", stufen: 5, text: "Mehr Kraft und Tempo",       faktor: 1.75 },
    reifen:   { name: "Reifen",   icon: "🛞", stufen: 5, text: "Mehr Grip – weniger Durchdrehen", faktor: 1.75 },
    federung: { name: "Federung", icon: "🌀", stufen: 5, text: "Weicher landen, weniger Hüpfen", faktor: 1.75 },
    tank:     { name: "Tank",     icon: "⛽", stufen: 5, text: "Größerer Tank – weiter fahren",  faktor: 1.75 },
    // Version 32: vier weitere Upgrades (Wirkung in upgradeWirkung, berechneWerte in fahrt.js)
    kreisel:  { name: "Luft-Kreisel", icon: "🌪️", stufen: 5, text: "Hält dich in der Luft ruhig – leichter sauber landen", faktor: 1.75 },
    spoiler:  { name: "Spoiler",  icon: "🪽", stufen: 5, text: "Drückt das Auto auf die Straße, etwas schneller", faktor: 1.75 },
    bremse:   { name: "Bremsen",  icon: "🛑", stufen: 5, text: "Kräftiger bremsen, schneller rückwärts", faktor: 1.6 },
    leichtbau: { name: "Leichtbau", icon: "🪶", stufen: 5, text: "Leichter: schneller los und weitere Sprünge", faktor: 1.8 },
    allrad:   { name: "Allrad",   icon: "4×4", stufen: 1, text: "Alle Räder treiben an",       faktor: 1, preisMal: 9 }
  },
  /* Wirkung pro Upgrade-Stufe */
  upgradeWirkung: {
    motorDrehmoment: 0.15,     // +15 % Drehmoment je Stufe
    motorTempo: 0.07,          // +7 % Höchstgeschwindigkeit je Stufe
    reifenGrip: 0.08,          // +0,08 Reibwert je Stufe
    federDaempfung: 0.07,      // +0,07 Dämpfungsgrad je Stufe
    federWeg: 0.07,            // +7 % Federweg je Stufe
    tank: 0.22,                // +22 % Tankinhalt je Stufe
    // Version 36: die vier neuen Upgrades deutlich schwächer (vorher 0,12 / 0,5 / 0,15 /
    // 0,02 / 0,15 / 0,1 / 0,025) – sie sollen sich lohnen, aber das Spiel nicht leicht machen
    kreisel: 0.04,             // Gegensteuern in der Luft: +4 % Drehmoment je Stufe (Stufe 5: +20 %)
    kreiselRuhe: 0.12,         // ohne Pedal: Drehung in der Luft gedämpft, 0,12/s je Stufe
    spoilerAbtrieb: 0.04,      // +0,04 m² Abtriebsbeiwert·Fläche je Stufe (Blitz-Rakete hat ab Werk 1,4)
    spoilerTempo: 0.006,       // +0,6 % Höchstgeschwindigkeit je Stufe (Stufe 5: +3 %)
    bremse: 0.06,              // +6 % Bremskraft je Stufe
    rueckwaerts: 0.04,         // +4 % Rückwärtskraft je Stufe
    leichtbau: 0.008           // −0,8 % Masse des Aufbaus je Stufe (Stufe 5: −4 %)
  },

  /* -------------------------------------------------------------------------
     6) OPTIK – Farben und Muster (einmal kaufen, für alle Fahrzeuge nutzbar)
     ------------------------------------------------------------------------- */
  farben: [
    { id: "orange",  name: "Orange",   wert: "#ff9e2c", preis: 0 },
    { id: "rot",     name: "Rot",      wert: "#e8453c", preis: 0 },
    { id: "gelb",    name: "Gelb",     wert: "#ffd23f", preis: 0 },
    { id: "gruen",   name: "Grün",     wert: "#3cc35a", preis: 0 },
    { id: "blau",    name: "Blau",     wert: "#2f6fd6", preis: 0 },
    { id: "tuerkis", name: "Türkis",   wert: "#1fc7c1", preis: 0 },
    { id: "weiss",   name: "Weiß",     wert: "#f4f6fb", preis: 0 },
    { id: "eisblau", name: "Eisblau",  wert: "#5ec8f2", preis: 0 },
    { id: "lila",    name: "Lila",     wert: "#8e5bd8", preis: 150 },
    { id: "pink",    name: "Pink",     wert: "#ff6fb5", preis: 150 },
    { id: "nacht",   name: "Nachtblau", wert: "#24345e", preis: 200 },
    { id: "mint",    name: "Minze",    wert: "#8ee6b8", preis: 200 },
    { id: "gold",    name: "Gold",     wert: "#f3c44a", preis: 1500, glanz: true },
    { id: "regenbogen", name: "Regenbogen", wert: "regenbogen", preis: 3000 },
    { id: "schwarz", name: "Schwarz",  wert: "#2b2e38", preis: 0 }      // für die Dampf-Lok (hinten angehängt: Spielstand-Code)
  ],
  muster: [
    { id: "keins",   name: "Ohne",      icon: "⬜", preis: 0 },
    { id: "streifen", name: "Streifen", icon: "〰️", preis: 150 },
    { id: "punkte",  name: "Punkte",    icon: "⚪", preis: 200 },
    { id: "sterne",  name: "Sterne",    icon: "⭐", preis: 350 },
    { id: "flammen", name: "Flammen",   icon: "🔥", preis: 500 },
    { id: "blitze",  name: "Blitze",    icon: "⚡", preis: 600 },
    { id: "zielflagge", name: "Karo",   icon: "🏁", preis: 400 }
  ],
  /* Felgen: Aussehen der Räder (für alle Fahrzeuge) */
  felgen: [
    { id: "standard",   name: "Silber",    icon: "⚪", preis: 0 },
    { id: "gold",       name: "Gold",      icon: "🟡", preis: 1500 },
    { id: "stern",      name: "Stern",     icon: "⭐", preis: 2500 },
    { id: "blume",      name: "Blume",     icon: "🌸", preis: 3000 },
    { id: "neon",       name: "Neon",      icon: "💠", preis: 4500 },
    { id: "regenbogen", name: "Regenbogen", icon: "🌈", preis: 6000 }
  ],
  /* Beifahrer: ein Tier fährt mit (sitzt hinter dem Kind, bei Skateboard vorne auf dem Brett) */
  beifahrer: [
    { id: "keiner",  name: "Keiner",   icon: "🚫", emoji: "",   preis: 0 },
    { id: "hund",    name: "Hund",     icon: "🐶", emoji: "🐶", preis: 3000 },
    { id: "katze",   name: "Katze",    icon: "🐱", emoji: "🐱", preis: 3000 },
    { id: "hase",    name: "Hase",     icon: "🐰", emoji: "🐰", preis: 4000 },
    { id: "papagei", name: "Papagei",  icon: "🦜", emoji: "🦜", preis: 5000 },
    { id: "dino",    name: "Mini-Dino", icon: "🦖", emoji: "🦖", preis: 8000 },
    { id: "einhorn", name: "Einhorn",  icon: "🦄", emoji: "🦄", preis: 12000 },
    // Version 30: sechs neue Tiere, jedes mit einer kleinen Eigenart (grafik.js, Beifahrer)
    { id: "wolf",    name: "Wolf",     icon: "🐺", emoji: "🐺", preis: 6000 },   // heult nach jedem Salto „Auuu!“
    { id: "pinguin", name: "Pinguin",  icon: "🐧", emoji: "🐧", preis: 4500 },   // watschelt hin und her
    { id: "panda",   name: "Panda",    icon: "🐼", emoji: "🐼", preis: 7000 },   // mampft Bambus
    { id: "fuchs",   name: "Fuchs",    icon: "🦊", emoji: "🦊", preis: 5000 },   // wackelt im Fahrtwind
    { id: "eule",    name: "Eule",     icon: "🦉", emoji: "🦉", preis: 5500 },   // dreht ab und zu den Kopf
    { id: "schildkroete", name: "Schildkröte", icon: "🐢", emoji: "🐢", preis: 6500 }   // mit Sturzhelm
  ],
  /* Spuren: Was hinter dem Auto herfliegt, solange es fährt (spiel.js spurZiehen).
     Einmal kaufen, für alle Fahrzeuge – damit Münzen auch später noch etwas wert sind. */
  spuren: [
    { id: "keine",      name: "Ohne",         icon: "⬜", preis: 0 },
    { id: "sterne",     name: "Sternenstaub", icon: "✨", preis: 1500 },
    { id: "blasen",     name: "Seifenblasen", icon: "🧼", preis: 2500 },
    { id: "herzen",     name: "Herzen",       icon: "💖", preis: 3500 },
    { id: "funken",     name: "Funken",       icon: "🔥", preis: 5000 },
    { id: "konfetti",   name: "Konfetti",     icon: "🎊", preis: 7000 },
    { id: "regenbogen", name: "Regenbogen",   icon: "🌈", preis: 10000 },
    // Version 30: lustige Spuren
    { id: "pups",       name: "Pupswolken",   icon: "💨", preis: 2000 },
    { id: "enten",      name: "Gummienten",   icon: "🦆", preis: 3000 },
    { id: "bananen",    name: "Bananen",      icon: "🍌", preis: 3000 },
    { id: "popcorn",    name: "Popcorn",      icon: "🍿", preis: 4000 },
    { id: "tatzen",     name: "Tatzen",       icon: "🐾", preis: 4500 },
    { id: "socken",     name: "Socken",       icon: "🧦", preis: 6000 }
  ],

  /* -------------------------------------------------------------------------
     6a) DIE KINDER – jedes hat ein eigenes Profil (Münzen, Garage, Outfit,
     Look, Fortschritt). Gesicht, Haare, Brille und die wählbaren Looks (Fiete
     mit oder ohne Cap, Jonte mit Dutt oder offenen Haaren) stehen in kinder.js.
     Hier nur die Körpermaße:
       groesse     so viel [m] sitzt der Kopf höher (größeres Kind)
       breite      Faktor für Oberkörper, Arme und Gesicht (schlanker < 1)
     Die Physik ist für beide gleich – nur das Aussehen unterscheidet sich.
     ------------------------------------------------------------------------- */
  kinder: [
    { id: "fiete", name: "Fiete", groesse: 0, breite: 1 },
    { id: "jonte", name: "Jonte", groesse: 0.09, breite: 0.86 },
    // Version 38: eigener Charakter – Name und Aussehen stellt man im Spiel ein
    // (Spielerwahl → ⚙️ am Kärtchen, gespeichert in spielstand.eigen, Aussehen: kinder.js setzeEigenes)
    { id: "eigen", name: "Ich", groesse: 0.04, breite: 0.93, eigen: true }
  ],

  /* -------------------------------------------------------------------------
     6b) FIETES OUTFITS – fünf Superhelden-Looks
     Bewusst OHNE Namen, Buchstaben oder Logos: Kinder erkennen sie allein an
     den Farben und einfachen Formen. Einmal kaufen, dann gilt das Outfit
     überall (alle Fahrzeuge, Garage, Titel, Fortschrittsleiste, Ergebnis).
       anzug/anzugRand  Grundfarbe + Kontur        seiten   zweite Farbe unten
       aermel, haende   Ärmel, Handschuhe (null = Haut)
       guertel          Gürtelfarbe (null = keiner)
       umhang           Umhangfarbe (null = keiner), umhangZacken = gezackter Saum
       emblem           raute | oval | spinne | reaktor | stern
       netz             Netz-Linien      streifen  rot-weiße Streifen
       schild           runder Schild auf dem Rücken
     ------------------------------------------------------------------------- */
  outfits: [
    { id: "himmel", preis: 0,    anzug: "#2f6fd6", anzugRand: "#1d4fa8", aermel: "#2f6fd6", haende: null,
      guertel: "#ffd23f", umhang: "#e8453c", emblem: "raute" },
    { id: "netz",   preis: 500,  anzug: "#e0302f", anzugRand: "#9e1f1f", seiten: "#2a5bd7", aermel: "#e0302f", haende: "#e0302f",
      guertel: null, umhang: null, emblem: "spinne", netz: true },
    { id: "nacht",  preis: 800,  anzug: "#646c80", anzugRand: "#2d3242", aermel: "#646c80", haende: "#262b3b",
      guertel: "#ffd23f", umhang: "#262b3b", umhangZacken: true, emblem: "oval" },
    { id: "panzer", preis: 1200, anzug: "#c8302c", anzugRand: "#7f1c1a", seiten: "#f3c44a", aermel: "#c8302c", haende: "#f3c44a",
      guertel: "#f3c44a", umhang: null, emblem: "reaktor" },
    { id: "schild", preis: 1600, anzug: "#2f5fbf", anzugRand: "#1c3c80", aermel: "#2f5fbf", haende: "#d9363e",
      guertel: null, umhang: null, emblem: "stern", streifen: true, schild: true }
  ],

  /* -------------------------------------------------------------------------
     7) WELTEN + LEVEL
     Physik je Welt: schwerkraft [m/s²], grip (Faktor auf Reifen-µ),
     rollwiderstand c_rr, abprall (Stoßzahl Boden), luftdichte [kg/m³].
     gelaende: amp/welle = große Hügel [m], holperAmp/holperWelle = kleine Wellen,
               trend = mittlere Steigung, maxAuf/maxAb = steilste Steigung/Gefälle [°],
               schanzen/buckel/steil/taeler = Häufigkeit der Bau-Elemente (Gewichte),
               berg/sprung/wellen/klippe/rampe/kuppe = anspruchsvolle Elemente (Gewichte, wirken ab Level 2
               bzw. mit wildBasis schon früher), wildBasis = Grund-Wildheit der Welt,
               abstandElemente = mittlerer Abstand zwischen Bau-Elementen [m]
     tankAbstand: mittlerer Abstand der Benzinkanister [m] auf typischer Strecke
                  (bergauf liegen sie dichter, bergab weiter auseinander, s. gelaende.js)
     deko: reine Kulisse, "Emoji:Größe in Metern" oder "@requisite:Größe";
           ein drittes Feld schwebt so hoch über dem Boden: "🐠:0.7:2.2"
     ------------------------------------------------------------------------- */
  welten: [
    {
      id: "wiese", name: "Blumenwiese", emoji: "🌼", hinweis: "Sanfte Hügel zum Üben",
      schwerkraft: 9.81, grip: 1.0, rollwiderstand: 0.015, abprall: 0.05, luftdichte: 1.2,
      farben: {
        himmel: ["#6fc3ff", "#d8f1ff"], berge: ["#a8dc95", "#7cc77e"],
        boden: ["#9a6535", "#6e4423"], oberflaeche: "#46b04a", kante: "#7fdc5a", punkte: "#b07a45"
      },
      sonne: "sonne", wetter: null,
      deko: ["@laubbaum:3.4", "@laubbaum:2.6", "@busch:1.1", "@blumen:0.7", "@laubbaum:3.0", "@busch:0.8", "@blumen:0.6", "@stein:0.7", "🐄:1.6", "@tanne:3.4", "🐇:0.6", "@laubbaum:2.2"],
      beiwerk: ["@gras:0.45", "@blumen:0.45", "@stein:0.35", "@gras:0.35"], kulisse: ["wald", "wald", "wald"],
      gelaende: { amp: 6.5, welle: 42, holperAmp: 0.2, holperWelle: 6, trend: 0.015,
                  maxAuf: 27, maxAb: 38, schanzen: 1.0, buckel: 1.0, steil: 0.6, taeler: 0.6, berg: 0.5, sprung: 0.5, wellen: 0.6, klippe: 0.5, rampe: 0.6, kuppe: 0.8, stufe: 0.8, wildBasis: 0,
                  abstandElemente: 38 },
      tankAbstand: 190, muenzAbstand: 24,
      level: [ { laenge: 320, seed: 101 }, { laenge: 480, seed: 102 }, { laenge: 650, seed: 103 }, { laenge: 800, seed: 104 } ]
    },
    {
      id: "wueste", name: "Sandwüste", emoji: "🏜️", hinweis: "Weicher Sand bremst (Rollwiderstand!)",
      schwerkraft: 9.81, grip: 0.85, rollwiderstand: 0.07, abprall: 0.03, luftdichte: 1.15,
      farben: {
        himmel: ["#ffb35c", "#ffe7b0"], berge: ["#f0c27a", "#e0a95a"],
        boden: ["#e9b864", "#c48a3c"], oberflaeche: "#f4cf7e", kante: "#ffe3a3", punkte: "#d49a4a"
      },
      sonne: "sonne", wetter: null,
      sonnenDeko: "brille", wolkenStil: "wenige",
      deko: ["@kaktus:2.4", "@kaktus:1.6", "@sandfels:1.8", "@sandfels:1.1", "@palme:3.4", "@kaktus:2.0", "@sandfels:2.6", "🐪:2.2", "@stein:0.6", "🦎:0.45"],
      beiwerk: ["@stein:0.35", "@gras:0.35", "@sandfels:0.45"], kulisse: ["tafelberg", "tafelberg", null],
      gelaende: { amp: 8.0, welle: 55, holperAmp: 0.15, holperWelle: 9, trend: 0.018,
                  maxAuf: 28, maxAb: 38, schanzen: 1.0, buckel: 0.7, steil: 0.8, taeler: 0.7, berg: 0.7, sprung: 0.6, wellen: 1.0, klippe: 0.6, rampe: 0.7, kuppe: 1.0, stufe: 1.0, wildBasis: 0.1,
                  abstandElemente: 36 },
      tankAbstand: 190, muenzAbstand: 24,
      level: [ { laenge: 420, seed: 201 }, { laenge: 580, seed: 202 }, { laenge: 760, seed: 203 }, { laenge: 920, seed: 204 } ]
    },
    {
      id: "baustelle", name: "Baustelle", emoji: "🚧", hinweis: "Rampen, Erdhügel und Abbruchkanten",
      schwerkraft: 9.81, grip: 0.9, rollwiderstand: 0.035, abprall: 0.04, luftdichte: 1.2,
      farben: {
        himmel: ["#79c3f2", "#e9f6ff"], berge: ["#d8c19a", "#bfa175"],
        boden: ["#a8733f", "#74491f"], oberflaeche: "#d9a253", kante: "#f4cf7f", punkte: "#86592f"
      },
      sonne: "sonne", wetter: "staub",
      sonnenDeko: "helm",
      deko: ["🏗️:4.4", "🚧:1.0", "🧱:0.9", "🛢️:1.0", "🚛:2.6", "@stein:0.9", "🚧:0.8", "📦:0.8", "@stein:1.3", "⛏️:0.7"],
      beiwerk: ["@stein:0.35", "@gras:0.35"], kulisse: ["stadt", "stadt", "kran"],
      gelaende: { amp: 6.5, welle: 34, holperAmp: 0.3, holperWelle: 5, trend: 0.02,
                  maxAuf: 30, maxAb: 42, schanzen: 1.6, buckel: 1.0, steil: 1.2, taeler: 0.8, berg: 0.8, sprung: 1.4, wellen: 0.5, klippe: 1.2, rampe: 1.4, kuppe: 1.2, stufe: 1.0, wildBasis: 0.2,
                  abstandElemente: 30 },
      tankAbstand: 240, muenzAbstand: 23,
      level: [ { laenge: 450, seed: 901 }, { laenge: 620, seed: 902 }, { laenge: 800, seed: 903 }, { laenge: 980, seed: 904 } ]
    },
    {
      id: "schnee", name: "Schneeberge", emoji: "❄️", hinweis: "Rutschig! Wenig Grip auf Schnee",
      schwerkraft: 9.81, grip: 0.58, rollwiderstand: 0.02, abprall: 0.05, luftdichte: 1.25,
      farben: {
        himmel: ["#8fb8ef", "#eef6ff"], berge: ["#8fa6cc", "#b9cce8"], schnee: "#f4f8ff",
        boden: ["#9fb5d4", "#6f86aa"], oberflaeche: "#ffffff", kante: "#e6f2ff", punkte: "#c9d8ee"
      },
      sonne: "sonne", wetter: "schnee",
      sonnenDeko: "muetze", wolkenStil: "wenige",
      deko: ["@tanneSchnee:3.6", "@tanneSchnee:2.6", "@tanneSchnee:1.8", "@steinSchnee:1.0", "@tanneSchnee:3.0", "⛄:1.4", "@steinSchnee:1.5", "🦌:1.6", "@tanneSchnee:2.2", "🐧:0.8"],
      beiwerk: ["@steinSchnee:0.4", "@tanneSchnee:0.9"], kulisse: ["gipfel", "gipfel", "tannen"],
      gelaende: { amp: 9.0, welle: 46, holperAmp: 0.22, holperWelle: 7, trend: 0.025,
                  maxAuf: 26, maxAb: 40, schanzen: 1.0, buckel: 0.8, steil: 0.9, taeler: 0.6, berg: 0.6, sprung: 0.8, wellen: 0.6, klippe: 0.6, rampe: 0.2, kuppe: 0.8, stufe: 1.0, wildBasis: 0.2,
                  abstandElemente: 34 },
      tankAbstand: 225, muenzAbstand: 23,
      level: [ { laenge: 450, seed: 301 }, { laenge: 640, seed: 302 }, { laenge: 820, seed: 303 }, { laenge: 1000, seed: 304 } ]
    },
    {
      id: "mond", name: "Mondlandschaft", emoji: "🌙", hinweis: "Kaum Schwerkraft – riesige Sprünge!",
      schwerkraft: 1.62, grip: 0.9, rollwiderstand: 0.03, abprall: 0.08, luftdichte: 0,
      farben: {
        himmel: ["#0b1030", "#2b3366"], berge: ["#5d6283", "#474b69"],
        boden: ["#8d90a6", "#5b5e75"], oberflaeche: "#c4c7d6", kante: "#e4e6f0", punkte: "#7a7d94"
      },
      sonne: "erde", wetter: "sterne",
      deko: ["@mondstein:1.1", "@mondstein:0.7", "🛸:1.6", "@mondstein:1.6", "🚩:1.1", "@mondstein:0.9", "🛰️:1.4", "@mondstein:2.0", "👽:0.8"],
      beiwerk: ["@mondstein:0.35", "@mondstein:0.5"], kulisse: ["gipfel", null, null],
      gelaende: { amp: 7.0, welle: 40, holperAmp: 0.28, holperWelle: 8, trend: 0.012,
                  maxAuf: 25, maxAb: 38, schanzen: 1.4, buckel: 0.6, steil: 0.4, taeler: 1.2, berg: 0.6, sprung: 1.2, wellen: 0.8, klippe: 1.0, rampe: 0.3, kuppe: 1.0, stufe: 1.0, wildBasis: 0.3,
                  abstandElemente: 32 },
      tankAbstand: 195, muenzAbstand: 26,
      level: [ { laenge: 500, seed: 401 }, { laenge: 700, seed: 402 }, { laenge: 900, seed: 403 }, { laenge: 1100, seed: 404 } ]
    },
    {
      id: "bonbon", name: "Bonbon-Land", emoji: "🍭", hinweis: "Wackelpudding-Boden: alles federt!",
      schwerkraft: 9.81, grip: 1.0, rollwiderstand: 0.02, abprall: 0.38, luftdichte: 1.2,
      farben: {
        himmel: ["#ffb7e0", "#fff0fa"], berge: ["#ffd1ec", "#f7a8d8"],
        boden: ["#ff8fc7", "#e0619f"], oberflaeche: "#fff7fc", kante: "#ffffff", punkte: "#ffd6ef"
      },
      sonne: "sonne", wetter: "konfetti",
      sonnenArt: "lolli", wolkenStil: "zuckerwatte",
      deko: ["🍭:2.2", "🍬:0.8", "🧁:1.0", "🍩:1.1", "🍦:1.5", "🍫:0.9", "🍭:1.6", "🎂:1.3"],
      beiwerk: [], kulisse: ["bonbon", "bonbon", null],
      gelaende: { amp: 8.0, welle: 38, holperAmp: 0.35, holperWelle: 6, trend: 0.02,
                  maxAuf: 30, maxAb: 40, schanzen: 1.0, buckel: 1.4, steil: 0.8, taeler: 0.8, berg: 0.7, sprung: 0.8, wellen: 1.4, klippe: 0.5, rampe: 0.6, kuppe: 1.0, stufe: 1.0, wildBasis: 0.3,
                  abstandElemente: 32 },
      tankAbstand: 270, muenzAbstand: 22,
      level: [ { laenge: 560, seed: 501 }, { laenge: 760, seed: 502 }, { laenge: 960, seed: 503 }, { laenge: 1150, seed: 504 } ]
    },
    {
      id: "dschungel", name: "Dschungel", emoji: "🌴", hinweis: "Matschig und steil",
      schwerkraft: 9.81, grip: 0.75, rollwiderstand: 0.05, abprall: 0.04, luftdichte: 1.2,
      farben: {
        himmel: ["#5fc9a8", "#d5f7e6"], berge: ["#3e9a63", "#2f7d4f"],
        boden: ["#6b4a2b", "#4a311b"], oberflaeche: "#3f8f3a", kante: "#69c24a", punkte: "#7e5a36"
      },
      sonne: "sonne", wetter: "blaetter",
      sonnenDeko: "bluete",
      deko: ["@palme:3.6", "@palme:2.8", "@farn:1.3", "@busch:1.3", "@laubbaum:3.8", "@farn:1.0", "🦜:0.8", "@palme:3.2", "🐒:1.1", "@busch:1.0", "@blumen:0.6", "🦋:0.5"],
      beiwerk: ["@farn:0.6", "@gras:0.5"], kulisse: ["dschungel", "dschungel", "dschungel"],
      gelaende: { amp: 9.5, welle: 36, holperAmp: 0.3, holperWelle: 5, trend: 0.028,
                  maxAuf: 32, maxAb: 42, schanzen: 0.9, buckel: 1.2, steil: 1.2, taeler: 0.9, berg: 1.2, sprung: 0.6, wellen: 0.8, klippe: 1.0, rampe: 1.0, kuppe: 1.1, stufe: 1.0, wildBasis: 0.35,
                  abstandElemente: 30 },
      tankAbstand: 270, muenzAbstand: 22,
      level: [ { laenge: 620, seed: 601 }, { laenge: 820, seed: 602 }, { laenge: 1020, seed: 603 }, { laenge: 1220, seed: 604 } ]
    },
    {
      /* Urzeit: Dinosaurier (gezeichnet, verschiedene Arten und Farben), Farne,
         Palmfarne, Schachtelhalme; hinten Vulkane und Brachiosaurier im Dunst */
      id: "urzeit", name: "Urzeit", emoji: "🦕", hinweis: "Bei den Dinosauriern – Farne, Sümpfe, rauchende Vulkane",
      schwerkraft: 9.81, grip: 0.95, rollwiderstand: 0.025, abprall: 0.06, luftdichte: 1.2,
      farben: {
        himmel: ["#6fb6b4", "#f4e2a8"], berge: ["#5f8a72", "#3f6a52"],
        boden: ["#6b4f2e", "#4a3520"], oberflaeche: "#5c9e3a", kante: "#86c95a", punkte: "#7a5c38"
      },
      sonne: "sonne", wetter: "staub",
      deko: ["@farn:1.5", "@palmfarn:2.4", "@schachtelhalm:2.6", "@dino:3.6", "@farn:1.1", "@stein:1.0", "@palmfarn:1.8", "@nest:0.8",
             "@schachtelhalm:1.8", "@dino:2.6", "@farn:1.3", "@palme:3.4"],
      beiwerk: ["@farn:0.5", "@gras:0.45", "@stein:0.35"], kulisse: ["vulkan", "brachio", "dschungel"],
      gelaende: { amp: 9.5, welle: 40, holperAmp: 0.25, holperWelle: 7, trend: 0.028,
                  maxAuf: 33, maxAb: 42, schanzen: 1.2, buckel: 1.0, steil: 1.1, taeler: 1.0, berg: 1.1, sprung: 1.0, wellen: 0.8, klippe: 0.8, rampe: 0.9, kuppe: 1.0, stufe: 1.0, wildBasis: 0.4,
                  abstandElemente: 27 },
      tankAbstand: 280, muenzAbstand: 22,
      level: [ { laenge: 680, seed: 1301 }, { laenge: 880, seed: 1302 }, { laenge: 1100, seed: 1303 }, { laenge: 1300, seed: 1304 } ]
    },
    {
      id: "vulkan", name: "Vulkaninsel", emoji: "🌋", hinweis: "Große Schanzen und steile Rampen",
      schwerkraft: 9.81, grip: 0.95, rollwiderstand: 0.025, abprall: 0.05, luftdichte: 1.2,
      farben: {
        himmel: ["#43213f", "#ff8a5c"], berge: ["#5a2d3a", "#3d1f2c"],
        boden: ["#4a3a3a", "#2e2424"], oberflaeche: "#6b5555", kante: "#ff7b3a", punkte: "#5c4646"
      },
      sonne: "glut", wetter: "funken",
      deko: ["@lavastein:1.2", "@kegel:2.6", "@lavastein:0.8", "@baumtot:2.6", "@kegel:1.7", "@lavastein:1.6", "@palme:3.0", "@stein:0.9", "@kegel:3.4", "@lavastein:1.0"],
      beiwerk: ["@lavastein:0.35", "@lavastein:0.5", "@stein:0.35"], kulisse: ["vulkan", "vulkan", null],
      gelaende: { amp: 11.0, welle: 42, holperAmp: 0.25, holperWelle: 7, trend: 0.032,
                  maxAuf: 34, maxAb: 44, schanzen: 1.6, buckel: 0.8, steil: 1.2, taeler: 1.0, berg: 1.2, sprung: 1.4, wellen: 0.6, klippe: 1.0, rampe: 1.0, kuppe: 1.0, stufe: 1.0, wildBasis: 0.4,
                  abstandElemente: 28 },
      tankAbstand: 315, muenzAbstand: 22,
      level: [ { laenge: 700, seed: 701 }, { laenge: 900, seed: 702 }, { laenge: 1150, seed: 703 }, { laenge: 1350, seed: 704 } ]
    },
    {
      id: "achterbahn", name: "Achterbahn-Park", emoji: "🎢", hinweis: "Rauf, runter, Sprung: Gas und Bremse dosieren!",
      schwerkraft: 9.81, grip: 1.0, rollwiderstand: 0.015, abprall: 0.08, luftdichte: 1.2,
      farben: {
        himmel: ["#2d2470", "#ff9ec4"], berge: ["#6c52b8", "#4e3a93"],
        boden: ["#5a4a90", "#372a62"], oberflaeche: "#ff6f9f", kante: "#ffe066", punkte: "#7f6bc6",
        wolken: "rgba(255,190,225,0.5)"
      },
      sonne: "mondsichel", wetter: "feuerwerk",
      deko: ["🎡:4.6", "🎢:4.0", "🎠:2.6", "🎪:3.2", "🎈:1.2", "🍿:0.8", "🍦:1.0", "🧸:0.9", "@busch:1.0", "🎈:1.6", "@laubbaum:3.0"],
      beiwerk: ["@gras:0.4", "@blumen:0.45"], kulisse: ["riesenrad", "wald", null],
      gelaende: { amp: 12.0, welle: 34, holperAmp: 0.25, holperWelle: 6, trend: 0.03,
                  maxAuf: 35, maxAb: 46, schanzen: 1.0, buckel: 0.6, steil: 1.0, taeler: 1.2, berg: 1.6, sprung: 1.2, wellen: 1.6, klippe: 0.8, rampe: 1.0, kuppe: 1.4, stufe: 1.0, wildBasis: 0.5,
                  abstandElemente: 24 },
      tankAbstand: 350, muenzAbstand: 21,
      level: [ { laenge: 760, seed: 1001 }, { laenge: 980, seed: 1002 }, { laenge: 1200, seed: 1003 }, { laenge: 1420, seed: 1004 } ]
    },
    {
      id: "regenbogen", name: "Regenbogenland", emoji: "🌈", hinweis: "Die große Abschluss-Tour über den Wolken",
      schwerkraft: 7.5, grip: 0.9, rollwiderstand: 0.02, abprall: 0.15, luftdichte: 1.0,
      farben: {
        himmel: ["#7a8cff", "#ffe1f4"], berge: ["#ffffff", "#e7e3ff"],
        boden: ["#c9c2ff", "#9d92f0"], oberflaeche: "#ffffff", kante: "#fff4a8", punkte: "#e0dbff"
      },
      sonne: "regenbogen", wetter: "sterne",
      deko: ["🦄:1.8", "☁️:2.0", "⭐:0.8", "🌈:2.4", "🎈:1.2", "🦄:1.4", "🏰:3.2"],
      beiwerk: [], kulisse: ["wolkenberg", "wolkenberg", null],
      gelaende: { amp: 12.0, welle: 40, holperAmp: 0.3, holperWelle: 6, trend: 0.035,
                  maxAuf: 35, maxAb: 44, schanzen: 1.4, buckel: 1.0, steil: 1.3, taeler: 1.0, berg: 1.3, sprung: 1.3, wellen: 1.2, klippe: 1.0, rampe: 1.0, kuppe: 1.2, stufe: 1.0, wildBasis: 0.5,
                  abstandElemente: 27 },
      tankAbstand: 320, muenzAbstand: 21,
      level: [ { laenge: 800, seed: 801 }, { laenge: 1050, seed: 802 }, { laenge: 1300, seed: 803 }, { laenge: 1550, seed: 804 } ]
    },
    {
      id: "freizeitpark", name: "Freizeitpark", emoji: "🎡", hinweis: "Loopings mit Vollgas, Sprünge über Gruben",
      schwerkraft: 9.81, grip: 1.0, rollwiderstand: 0.015, abprall: 0.08, luftdichte: 1.2,
      farben: {
        himmel: ["#58c7ff", "#fff1c9"], berge: ["#ffb6d5", "#f78fbd"],
        boden: ["#7d5fd0", "#5a3ea8"], oberflaeche: "#ffcc3a", kante: "#ff6f9f", punkte: "#9a82e0"
      },
      sonne: "sonne", wetter: "konfetti",
      deko: ["🎡:5.0", "🎠:2.8", "🎪:3.4", "🎢:4.2", "🎈:1.3", "@laubbaum:3.0", "🍭:1.4", "🍿:0.8", "@busch:1.0", "🧸:0.9", "🍦:1.0", "🎟️:0.7"],
      beiwerk: ["@gras:0.4", "@blumen:0.45"], kulisse: ["riesenrad", "wald", null],
      gelaende: { amp: 9.0, welle: 40, holperAmp: 0.2, holperWelle: 6, trend: 0.02,
                  maxAuf: 32, maxAb: 42, schanzen: 1.0, buckel: 0.6, steil: 0.8, taeler: 0.8, berg: 0.8, sprung: 0.8, wellen: 1.0, klippe: 0.5, rampe: 0.8, kuppe: 0.8, stufe: 0.6,
                  looping: 2.2, luecke: 1.6, wildBasis: 0.4,
                  abstandElemente: 26 },
      tankAbstand: 300, muenzAbstand: 22,
      level: [ { laenge: 750, seed: 1101 }, { laenge: 1000, seed: 1102 }, { laenge: 1250, seed: 1103 }, { laenge: 1500, seed: 1104 } ]
    },
    {
      /* Höhle: Über der Strecke hängt eine Felsdecke mit Tropfsteinen, Kristallen und
         Laternen (grafik.js zeichneDecke). Sie liegt decke.abstand [m] über dem höchsten
         Boden in ±decke.fenster [m]. Normalerweise kommt man nicht dran – wer doch
         hochfliegt, prallt sanft ab (fahrt.js). Darum wenig große Sprünge. */
      id: "hoehle", name: "Kristallhöhle", emoji: "💎", hinweis: "Unter der Erde – über dir hängen Tropfsteine",
      schwerkraft: 9.81, grip: 0.92, rollwiderstand: 0.022, abprall: 0.06, luftdichte: 1.2,
      farben: {
        himmel: ["#0d0a1c", "#2a2148"], berge: ["#2b2443", "#1c1730"],
        boden: ["#4a3f5e", "#2a2238"], oberflaeche: "#7a6a92", kante: "#8fe8ff", punkte: "#5d5075",
        decke: ["#5b4d78", "#16121f"], deckeKante: "#8fe8ff"
      },
      sonne: "keine", wetter: "glitzer",
      decke: { abstand: 8.2, fenster: 12, wellig: 0.8 },
      deko: ["@kristall:1.2", "@stalagmit:2.0", "@pilz:0.9", "@kristall:0.8", "@stein:1.0", "@stalagmit:1.2", "@kristall:1.6", "🦇:0.9", "@pilz:1.3", "🕯️:0.7"],
      beiwerk: ["@kristall:0.4", "@stein:0.35"], kulisse: ["stalagmiten", "stalagmiten", null],
      gelaende: { amp: 7.0, welle: 36, holperAmp: 0.25, holperWelle: 6, trend: 0.02,
                  maxAuf: 32, maxAb: 40, schanzen: 0.25, buckel: 1.0, steil: 1.1, taeler: 1.1, berg: 1.0, sprung: 0.2, wellen: 1.2, klippe: 0.6, rampe: 0.3, kuppe: 0.6, stufe: 1.2, wildBasis: 0.4,
                  abstandElemente: 26 },
      tankAbstand: 300, muenzAbstand: 22,
      level: [ { laenge: 750, seed: 1201 }, { laenge: 1000, seed: 1202 }, { laenge: 1250, seed: 1203 }, { laenge: 1500, seed: 1204 } ]
    },

    /* ---------------------------------------------------------------------
       Ab hier: fünf Welten mit je einer eigenen Spielidee (Version 15).
       Zusätzliche Felder (alle optional, siehe gelaende.js / fahrt.js):
         wasser   Pfützen: In jeder Mulde steht Wasser bis tiefe [m] (höchstens
                  maxBreite [m] breit). Wasser spritzt und bremst: a = bremse·v²
                  (anteilig, wie tief die Räder eintauchen)
         wind     Sturm: Rückenwind und Gegenwind wechseln sich ab (staerke [m/s²],
                  laenge [m] = Größe der Windzonen, bias > 0: öfter Rückenwind)
         unterwasser  alles unter Wasser: Taucherhelm, Blasen, dumpfer Klang;
                  dazu wenig Schwerkraft (Auftrieb), dichtes "luftdichte" (Wasser
                  bremst) und drehDaempfung [1/s] (Drehungen werden langsamer)
         nacht    Dunkelheit (dunkel 0..1): Scheinwerfer, Laternen, Glühwürmchen
         gelaende.trampolin  Hüpfpilze: wer drauffährt, fliegt hoch
         gelaende.band       Förderbänder (Spielzeugfabrik)
         objekte  Dinge auf der Strecke, die man umfährt: { art: "glas"|"stein", abstand [m],
                  saeule: Anteil Baustein-Säulen }; glas: Boden halb durchsichtig
         tipp     [Text, vorgelesener Satz] beim Start eines Levels
       --------------------------------------------------------------------- */
    {
      /* Regen: In den Tälern stehen Pfützen. Durchfahren spritzt, das Wasser bremst
         ein bisschen. Viele Täler, damit es viele Pfützen gibt. */
      id: "pfuetzen", name: "Pfützenland", emoji: "🌧️", hinweis: "Es regnet! In den Tälern stehen Pfützen – platsch!",
      schwerkraft: 9.81, grip: 0.85, rollwiderstand: 0.025, abprall: 0.04, luftdichte: 1.2,
      farben: {
        himmel: ["#7f93ad", "#d3dde8"], berge: ["#94b79c", "#6d9a7c"],
        boden: ["#7a5a3c", "#53402b"], oberflaeche: "#4f9e48", kante: "#86c46a", punkte: "#6b4c30",
        wolken: "rgba(118,132,158,0.82)", wasser: "#5fa8de"
      },
      sonne: "wolkig", wetter: "regen",
      wasser: { tiefe: 0.6, maxBreite: 16, bremse: 0.055 },
      tipp: ["🌧️ Fahr durch die Pfützen – platsch! Das Wasser bremst ein bisschen.", "Platsch! Fahr durch die Pfützen!"],
      deko: ["@laubbaum:3.4", "@regenschirm:1.5", "@busch:1.1", "🐸:0.55", "@laubbaum:2.8", "@pilzrot:0.7", "@gummistiefel:0.6", "🐌:0.5",
             "@busch:0.9", "@laubbaum:3.8", "@blumen:0.6", "@tanne:3.2"],
      beiwerk: ["@gras:0.45", "@stein:0.35", "@pilzrot:0.35"], kulisse: ["wald", "dorf", "wald"],
      gelaende: { amp: 7.5, welle: 40, holperAmp: 0.15, holperWelle: 7, trend: 0.02,
                  maxAuf: 30, maxAb: 40, schanzen: 0.9, buckel: 0.8, steil: 0.9, taeler: 2.4, berg: 0.8, sprung: 0.9, wellen: 1.2, klippe: 0.5, rampe: 0.6, kuppe: 1.0, stufe: 0.7, wildBasis: 0.4,
                  abstandElemente: 26 },
      tankAbstand: 300, muenzAbstand: 22,
      level: [ { laenge: 760, seed: 1401 }, { laenge: 1000, seed: 1402 }, { laenge: 1250, seed: 1403 }, { laenge: 1500, seed: 1404 } ]
    },
    {
      /* Riesengarten: Fiete ist winzig zwischen riesigen Blumen, Grashalmen und Käfern.
         Hüpfpilze (Trampoline) schleudern das Auto hoch – darüber hängen Münzen. */
      id: "garten", name: "Riesengarten", emoji: "🌻", hinweis: "Du bist winzig! Hüpfpilze schleudern dich hoch",
      schwerkraft: 9.81, grip: 1.0, rollwiderstand: 0.02, abprall: 0.05, luftdichte: 1.2,
      farben: {
        himmel: ["#74c8ff", "#eaf8ff"], berge: ["#86d06e", "#4fa94a"],
        boden: ["#6e4a2a", "#4b321c"], oberflaeche: "#58b545", kante: "#a2e46e", punkte: "#8a6038"
      },
      sonne: "sonne", wetter: "pollen", kulisseGroesse: 1.5,
      sonnenArt: "sonnenblume",
      tipp: ["🍄 Fahr auf die rot-weißen Hüpfpilze – boing! In der Luft Gas und Bremse zum Drehen.", "Fahr auf die Hüpfpilze!"],
      deko: ["@riesenblume:5.5", "@grashalm:3.2", "🐞:0.8", "@riesenblume:4.2", "@kleeblatt:1.4", "🐌:1.1", "@grashalm:2.6", "🐝:0.7:2.6",
             "@riesenblume:6.5", "🐜:0.45", "@pilzrot:1.5", "🦋:0.8:3.2", "@kleeblatt:1.1", "@grashalm:3.8"],
      beiwerk: ["@gras:0.7", "@stein:0.5", "@kleeblatt:0.6"], kulisse: ["zaun", "riesenblumen", "halme"],
      gelaende: { amp: 7.0, welle: 40, holperAmp: 0.2, holperWelle: 6, trend: 0.02,
                  maxAuf: 31, maxAb: 42, schanzen: 0.8, buckel: 1.0, steil: 0.8, taeler: 0.7, berg: 0.8, sprung: 0.6, wellen: 0.8, klippe: 0.6, rampe: 0.7, kuppe: 0.8, stufe: 1.0,
                  trampolin: 1.5, wildBasis: 0.4,
                  abstandElemente: 26 },
      tankAbstand: 300, muenzAbstand: 22,
      level: [ { laenge: 780, seed: 1501 }, { laenge: 1020, seed: 1502 }, { laenge: 1270, seed: 1503 }, { laenge: 1520, seed: 1504 } ]
    },
    {
      /* Herbststurm: Windzonen (gelaende.windBei). Rückenwind schiebt und trägt weit,
         Gegenwind bremst. Leichte Fahrzeuge (Moped) pustet er stärker, schwere weniger.
         Die Berge sind etwas flacher, damit man auch gegen den Wind hochkommt. */
      id: "herbst", name: "Herbststurm", emoji: "🍂", hinweis: "Sturm! Rückenwind schiebt, Gegenwind bremst",
      schwerkraft: 9.81, grip: 0.9, rollwiderstand: 0.025, abprall: 0.05, luftdichte: 1.2,
      farben: {
        himmel: ["#86a9d6", "#f6dcb8"], berge: ["#d0904e", "#a7663a"],
        boden: ["#7a5230", "#553820"], oberflaeche: "#b47a32", kante: "#eba748", punkte: "#6b4a2a",
        wolken: "rgba(255,244,232,0.85)"
      },
      sonne: "sonne", wetter: "laub",
      sonnenDeko: "schal",
      wind: { staerke: 1.7, laenge: 85, bias: 0.25 },
      tipp: ["🍂 Sturm! Rückenwind 💨 schiebt dich, bei Gegenwind 🌬️ mehr Gas geben.", "Sturm! Rückenwind schiebt, Gegenwind bremst!"],
      deko: ["@herbstbaum:3.6", "@kuerbis:0.8", "@laubhaufen:0.9", "@herbstbaum:2.8", "🦔:0.55", "@pilzrot:0.7", "🐿️:0.55", "@vogelscheuche:2.3",
             "@kuerbis:1.1", "@tanne:3.2", "@herbstbaum:4.0", "@laubhaufen:1.2"],
      beiwerk: ["@laubhaufen:0.4", "@pilzrot:0.35", "@stein:0.35"], kulisse: ["windrad", "wald", "wald"],
      gelaende: { amp: 8.0, welle: 42, holperAmp: 0.22, holperWelle: 6, trend: 0.02,
                  maxAuf: 26, maxAb: 40, schanzen: 1.3, buckel: 0.8, steil: 0.9, taeler: 0.8, berg: 0.9, sprung: 1.3, wellen: 1.0, klippe: 0.7, rampe: 0.7, kuppe: 1.0, stufe: 0.8, wildBasis: 0.45,
                  abstandElemente: 27 },
      tankAbstand: 265, muenzAbstand: 22,
      level: [ { laenge: 800, seed: 1601 }, { laenge: 1040, seed: 1602 }, { laenge: 1290, seed: 1603 }, { laenge: 1540, seed: 1604 } ]
    },
    {
      /* Meeresgrund: Auftrieb (wenig Schwerkraft), Wasser bremst (dichtes Medium für den
         Strömungswiderstand ½·ρ·cwA·v²) und dämpft Drehungen. Fiete trägt einen
         Taucherhelm, aus dem Auspuff blubbern Blasen, der Klang ist dumpf. */
      id: "meer", name: "Meeresgrund", emoji: "🐠", hinweis: "Unter Wasser: alles schwebt, aber das Wasser bremst",
      schwerkraft: 4.6, grip: 0.85, rollwiderstand: 0.03, abprall: 0.05, luftdichte: 6, drehDaempfung: 1.1, unterwasser: true,
      farben: {
        himmel: ["#55cbe6", "#0d3d70"], berge: ["#22729a", "#185e80"],
        boden: ["#e2c48a", "#bc9b62"], oberflaeche: "#f0d9a2", kante: "#fff2c8", punkte: "#b08d58"
      },
      sonne: "lichtstrahlen", wetter: "blasen",
      tipp: ["🐠 Unter Wasser schwebt alles – aber das Wasser bremst. Gib ruhig mehr Gas!", "Unter Wasser schwebt alles!"],
      deko: ["@koralle:1.6", "@seetang:3.0", "🐠:0.7:2.2", "@muschel:0.5", "@koralle:1.1", "🦀:0.6", "@seetang:2.2", "🐙:1.0",
             "🐟:0.6:3.0", "@seestern:0.5", "@koralle:2.0", "🐢:1.1:2.6", "@anker:1.4", "🐡:0.7:1.8", "@seetang:3.6", "@schatzkiste:0.9"],
      beiwerk: ["@muschel:0.35", "@seestern:0.35", "@stein:0.4"], kulisse: ["riff", "wrack", "tang"],
      gelaende: { amp: 8.0, welle: 44, holperAmp: 0.25, holperWelle: 7, trend: 0.02,
                  maxAuf: 28, maxAb: 40, schanzen: 1.2, buckel: 1.0, steil: 0.9, taeler: 1.0, berg: 0.9, sprung: 1.0, wellen: 1.0, klippe: 0.8, rampe: 0.6, kuppe: 0.8, stufe: 0.8, wildBasis: 0.45,
                  abstandElemente: 28 },
      tankAbstand: 270, muenzAbstand: 23,
      level: [ { laenge: 800, seed: 1701 }, { laenge: 1050, seed: 1702 }, { laenge: 1300, seed: 1703 }, { laenge: 1550, seed: 1704 } ]
    },
    {
      /* Nachtwald: Es ist dunkel (grafik.js zeichneNacht). Licht geben die Scheinwerfer,
         Laternen, Lagerfeuer, Leuchtpilze und Glühwürmchen; Münzen und Kanister
         schimmern, damit man sie findet. Das Abschluss-Abenteuer. */
      id: "nacht", name: "Nachtwald", emoji: "🦉", hinweis: "Nachts im Wald: Scheinwerfer an! Glühwürmchen leuchten",
      schwerkraft: 9.81, grip: 0.95, rollwiderstand: 0.022, abprall: 0.05, luftdichte: 1.2,
      farben: {
        himmel: ["#0b1534", "#2e4378"], berge: ["#24365f", "#1a2848"],
        boden: ["#3d302a", "#251c19"], oberflaeche: "#356a40", kante: "#6aa860", punkte: "#4d3c33",
        wolken: "rgba(70,88,140,0.45)", fenster: "#ffd27a"
      },
      sonne: "vollmond", wetter: "gluehwuermchen",
      nacht: { dunkel: 0.6 },
      tipp: ["🔦 Im Dunkeln leuchten deine Scheinwerfer. Fahr lieber etwas langsamer!", "Im Dunkeln leuchten deine Scheinwerfer!"],
      deko: ["@tanne:3.6", "@laterne:2.0", "@pilz:0.9", "@tanne:2.8", "@eule:1.6", "@laubbaum:3.4", "🦔:0.55", "@zelt:1.8",
             "@pilz:1.2", "@tanne:3.2", "@stein:0.8", "🦊:0.8", "@laterne:2.2", "@laubbaum:2.8"],
      beiwerk: ["@gras:0.4", "@pilz:0.4", "@stein:0.35"], kulisse: ["dorf", "tannen", "tannen"],
      gelaende: { amp: 9.5, welle: 40, holperAmp: 0.25, holperWelle: 6, trend: 0.026,
                  maxAuf: 32, maxAb: 42, schanzen: 1.2, buckel: 1.0, steil: 1.1, taeler: 1.0, berg: 1.2, sprung: 1.2, wellen: 1.0, klippe: 0.9, rampe: 0.9, kuppe: 1.1, stufe: 1.0, wildBasis: 0.5,
                  abstandElemente: 26 },
      tankAbstand: 320, muenzAbstand: 22,
      level: [ { laenge: 820, seed: 1801 }, { laenge: 1080, seed: 1802 }, { laenge: 1340, seed: 1803 }, { laenge: 1600, seed: 1804 } ]
    },
    {
      /* Spielzeugfabrik: Förderbänder (Bau-Element "band" in gelaende.js,
         physik.js: Reifen haften relativ zum laufenden Band). Vorwärtsbänder machen
         schnell, gegen Rückwärtsbänder muss man anfahren. */
      id: "fabrik", name: "Spielzeugfabrik", emoji: "🧸", hinweis: "Förderbänder schieben dich – oder laufen dir entgegen!",
      schwerkraft: 9.81, grip: 0.95, rollwiderstand: 0.018, abprall: 0.06, luftdichte: 1.2,
      farben: {
        himmel: ["#8fd0f5", "#fdf0d5"], berge: ["#c9b8e8", "#a593d1"],
        boden: ["#8a8fa0", "#5c6170"], oberflaeche: "#6f7686", kante: "#ffd23f", punkte: "#5c6370",
        wolken: "rgba(255,255,255,0.8)"
      },
      sonne: "sonne", wetter: "konfetti",
      sonnenArt: "zahnrad", wolkenStil: "dampf",
      tipp: ["⏩ Förderbänder! Vorwärts machen sie dich schnell, rückwärts musst du kräftig Gas geben.", "Förderbänder!"],
      deko: ["@bauklotz:1.4", "🧸:1.1", "@zahnrad:1.6", "@kiste:1.0", "🚂:1.5", "@kreisel:0.9", "@bauklotz:1.0", "🎁:0.9", "🤖:1.2",
             "@kiste:1.4", "@zahnrad:1.1", "🎈:1.3", "@kreisel:0.7"],
      beiwerk: ["@stein:0.3", "@bauklotz:0.45"], kulisse: ["fabrik", "zahnraeder", "kran"],
      gelaende: { amp: 7.0, welle: 40, holperAmp: 0.15, holperWelle: 6, trend: 0.02,
                  maxAuf: 31, maxAb: 42, schanzen: 1.1, buckel: 0.8, steil: 0.9, taeler: 0.8, berg: 0.9, sprung: 0.9, wellen: 0.8, klippe: 0.8, rampe: 0.9, kuppe: 0.9, stufe: 1.2,
                  band: 2.2, wildBasis: 0.5,
                  abstandElemente: 25 },
      tankAbstand: 310, muenzAbstand: 22,
      level: [ { laenge: 840, seed: 1901 }, { laenge: 1100, seed: 1902 }, { laenge: 1360, seed: 1903 }, { laenge: 1620, seed: 1904 } ]
    },
    {
      /* Mars: wenig Schwerkraft (3,71 m/s²), dünne Luft und trotzdem Staubstürme. Weil
         man so leicht ist, schiebt der Wind kräftig – deshalb ist er schwächer
         eingestellt als im Herbststurm. Zwei kleine Monde (Phobos, Deimos). */
      id: "mars", name: "Roter Planet", emoji: "🪐", hinweis: "Mars: weite Sprünge und Staubstürme",
      schwerkraft: 3.71, grip: 0.85, rollwiderstand: 0.04, abprall: 0.06, luftdichte: 0.02,
      farben: {
        himmel: ["#c8744e", "#f3c9a4"], berge: ["#b4603f", "#8f4431"],
        boden: ["#a4502f", "#6e3220"], oberflaeche: "#c9663e", kante: "#eda070", punkte: "#7a3a24",
        wolken: "rgba(245,200,170,0.45)"
      },
      sonne: "zweimonde", wetter: "marsstaub", helm: true,
      wind: { staerke: 0.75, laenge: 110, bias: 0.3 },
      tipp: ["🪐 Auf dem Mars fliegst du weit – nur sanft Gas geben! Staubstürme schieben dich mal vor, mal zurück.", "Mars! Nur sanft Gas geben!"],
      deko: ["@marsstein:1.2", "@rover:1.3", "@marsstein:0.8", "@marsbasis:2.4", "@marsstein:1.8", "🚩:1.1", "@marsstein:1.0", "👽:0.8", "@rover:1.0", "@marsstein:2.2"],
      beiwerk: ["@marsstein:0.35", "@marsstein:0.5"], kulisse: ["gipfel", "tafelberg", null],
      gelaende: { amp: 8.0, welle: 44, holperAmp: 0.28, holperWelle: 7, trend: 0.015,
                  maxAuf: 26, maxAb: 38, schanzen: 1.4, buckel: 0.8, steil: 0.6, taeler: 1.1, berg: 0.8, sprung: 1.3, wellen: 0.9, klippe: 1.0, rampe: 0.4, kuppe: 1.0, stufe: 0.9, wildBasis: 0.5,
                  abstandElemente: 30 },
      tankAbstand: 230, muenzAbstand: 25,
      level: [ { laenge: 860, seed: 2001 }, { laenge: 1120, seed: 2002 }, { laenge: 1380, seed: 2003 }, { laenge: 1640, seed: 2004 } ]
    },
    {
      /* Raumstation: künstliche Schwerkraft – nur in den leuchtenden Schwebe-Säulen
         (Bau-Element "schwebe", gelaende.schwereBei) wirken 18 %. Vor jeder Säule eine
         kleine Sprungkante, darunter eine Senke, oben Münzen und ein Diamant. */
      id: "station", name: "Raumstation", emoji: "🛸", hinweis: "In den leuchtenden Säulen schwebst du!",
      schwerkraft: 9.81, grip: 0.95, rollwiderstand: 0.02, abprall: 0.06, luftdichte: 1.2,
      farben: {
        himmel: ["#04061a", "#1b2150"], berge: ["#36406a", "#252d50"],
        boden: ["#6f7a94", "#424a62"], oberflaeche: "#aab4cc", kante: "#7af0ff", punkte: "#566079",
        fenster: "#7af0ff"
      },
      sonne: "erde", wetter: "sterne", helm: true,
      tipp: ["✨ In den leuchtenden Säulen ist die Schwerkraft fast weg – du schwebst! Hol dir die Münzen oben.", "In den Säulen schwebst du!"],
      deko: ["@antenne:2.0", "@solarpanel:1.6", "🤖:1.0", "@kiste:1.0", "🛸:1.3:3.2", "@kristall:1.0", "@antenne:1.5", "🛰️:1.2:3.8", "@solarpanel:2.2", "@kristall:0.7"],
      beiwerk: ["@kristall:0.35", "@stein:0.35"], kulisse: ["station", "station", null],
      gelaende: { amp: 7.5, welle: 42, holperAmp: 0.12, holperWelle: 6, trend: 0.02,
                  maxAuf: 31, maxAb: 42, schanzen: 1.1, buckel: 0.8, steil: 1.0, taeler: 0.9, berg: 1.0, sprung: 1.0, wellen: 0.9, klippe: 0.9, rampe: 0.9, kuppe: 1.0, stufe: 1.0,
                  schwebe: 2.0, wildBasis: 0.55,
                  abstandElemente: 25 },
      tankAbstand: 300, muenzAbstand: 22,
      level: [ { laenge: 880, seed: 2101 }, { laenge: 1140, seed: 2102 }, { laenge: 1400, seed: 2103 }, { laenge: 1660, seed: 2104 } ]
    },
    {
      /* Glaswelt: Boden, Kulisse und Deko sind halb durchsichtig (welt.glas). Auf der
         Strecke stehen Glasblöcke, -kugeln und -türme (welt.objekte): Wer hindurchfährt,
         lässt sie in Scherben zerspringen und verliert ein bisschen Tempo. */
      id: "glas", name: "Glaswelt", emoji: "🔷", hinweis: "Alles ist aus Glas – fahr durch, dann klirrt es!",
      schwerkraft: 9.81, grip: 0.82, rollwiderstand: 0.015, abprall: 0.08, luftdichte: 1.2,
      farben: {
        himmel: ["#a9dcf7", "#f2fbff"], berge: ["#cdebf8", "#a9d7ef"],
        boden: ["#9fd9f2", "#5fb2dc"], oberflaeche: "#e9fbff", kante: "#ffffff", punkte: "#bfe8f8"
      },
      sonne: "sonne", wetter: "glitzer", glas: true,
      sonnenArt: "glas", wolkenStil: "glas",
      objekte: { art: "glas", abstand: 24 },
      tipp: ["🔷 Alles ist aus Glas! Fahr durch die Glasblöcke – klirr! Das bremst dich nur ein bisschen.", "Fahr durch das Glas!"],
      deko: ["@glasbaum:2.6", "@glasskulptur:1.6", "@kristall:1.1", "@glasbaum:3.4", "@glasskulptur:2.2", "@kristall:0.8", "@glasbaum:2.0", "@glasskulptur:1.2"],
      beiwerk: ["@kristall:0.4"], kulisse: ["glastuerme", "glastuerme", null],
      gelaende: { amp: 8.0, welle: 42, holperAmp: 0.15, holperWelle: 6, trend: 0.022,
                  maxAuf: 30, maxAb: 42, schanzen: 1.3, buckel: 0.9, steil: 1.0, taeler: 0.9, berg: 1.0, sprung: 1.2, wellen: 1.0, klippe: 0.8, rampe: 0.9, kuppe: 1.0, stufe: 0.8, wildBasis: 0.55,
                  abstandElemente: 25 },
      tankAbstand: 300, muenzAbstand: 22,
      level: [ { laenge: 880, seed: 2201 }, { laenge: 1140, seed: 2202 }, { laenge: 1400, seed: 2203 }, { laenge: 1660, seed: 2204 } ]
    },
    {
      /* Klemmbaustein-Land: alles aus Bausteinen mit Noppen. Kleine Steine auf der
         Strecke fliegen weg, große Säulen bremsen das Auto fast ganz ab und zerfallen. */
      id: "bausteine", name: "Klemmbaustein-Land", emoji: "🧱", hinweis: "Alles aus Bausteinen – Säulen zerfallen beim Durchfahren!",
      schwerkraft: 9.81, grip: 1.0, rollwiderstand: 0.02, abprall: 0.06, luftdichte: 1.2,
      farben: {
        himmel: ["#6fc3ff", "#e4f5ff"], berge: ["#ffd86a", "#6f9fe0"],
        boden: ["#3cc35a", "#2a8f42"], oberflaeche: "#4fd068", kante: "#8ff09f", punkte: "#2a8f42"
      },
      sonne: "sonne", wetter: null,
      sonnenArt: "baustein", wolkenStil: "baustein", stufig: true,
      objekte: { art: "stein", abstand: 20, saeule: 0.18 },
      tipp: ["🧱 Bausteine fliegen weg, wenn du sie anstupst. Die großen Säulen bremsen dich – nimm Anlauf oder spring drüber!", "Alles aus Bausteinen!"],
      deko: ["@steinbaum:2.6", "@steinhaus:2.4", "@steinblume:0.9", "@steinbaum:3.2", "@steinblume:1.2", "@steinhaus:3.0", "@steinbaum:2.0"],
      beiwerk: ["@steinblume:0.5"], kulisse: ["bausteine", "bausteine", "bausteine"],
      gelaende: { amp: 7.5, welle: 40, holperAmp: 0.1, holperWelle: 6, trend: 0.02,
                  maxAuf: 31, maxAb: 42, schanzen: 1.2, buckel: 0.6, steil: 1.0, taeler: 0.9, berg: 1.0, sprung: 1.1, wellen: 0.8, klippe: 0.9, rampe: 1.0, kuppe: 0.9, stufe: 1.6, wildBasis: 0.55,
                  abstandElemente: 26 },
      tankAbstand: 300, muenzAbstand: 22,
      level: [ { laenge: 900, seed: 2301 }, { laenge: 1160, seed: 2302 }, { laenge: 1420, seed: 2303 }, { laenge: 1680, seed: 2304 } ]
    },
    {
      /* Gebirge: hohe, steile Berge ohne Schnee, Abgründe (Grubensprünge, Klippen) und
         Sprungschanzen. Steinböcke stehen auf Felsen, Adler kreisen am Himmel. */
      id: "gebirge", name: "Gebirge", emoji: "⛰️", hinweis: "Steile Felsen, tiefe Abgründe und große Schanzen",
      schwerkraft: 9.81, grip: 1.0, rollwiderstand: 0.025, abprall: 0.05, luftdichte: 1.2,
      farben: {
        himmel: ["#5fb2ef", "#e2f3ff"], berge: ["#8c97a8", "#6c7686"],
        boden: ["#7d7468", "#544c43"], oberflaeche: "#6f9a4a", kante: "#9cc36a", punkte: "#5e564c"
      },
      sonne: "sonne", wetter: "adler",
      tipp: ["⛰️ Achtung, Abgründe! Nimm vor den Schanzen Schwung, sonst fällst du hinunter.", "Achtung, Abgründe!"],
      deko: ["@tanne:3.4", "@stein:1.4", "@steinbock:1.4", "@tanne:2.6", "@stein:2.2", "@gipfelkreuz:2.2", "@busch:0.9", "@stein:1.0", "@steinbock:1.1", "@tanne:3.0", "@blumen:0.5"],
      beiwerk: ["@stein:0.4", "@gras:0.4", "@stein:0.6"], kulisse: ["gipfel", "gipfel", "tannen"],
      gelaende: { amp: 13.0, welle: 44, holperAmp: 0.3, holperWelle: 6, trend: 0.04,
                  maxAuf: 33, maxAb: 46, schanzen: 1.6, buckel: 0.6, steil: 1.3, taeler: 0.8, berg: 1.5, sprung: 1.8, wellen: 0.6, klippe: 2.0, rampe: 1.0, kuppe: 1.2, stufe: 1.0,
                  luecke: 0.9, wildBasis: 0.6,
                  abstandElemente: 24 },
      tankAbstand: 320, muenzAbstand: 21,
      level: [ { laenge: 900, seed: 2401 }, { laenge: 1180, seed: 2402 }, { laenge: 1440, seed: 2403 }, { laenge: 1700, seed: 2404 } ]
    },
    {
      /* Geisterwelt: dunkel (Nacht-Schleier wie im Nachtwald), Vollmond, Fledermäuse,
         Spukhäuser. Freundliche Geister tauchen kurz vor dem Auto auf (welt.spuk). */
      id: "geister", name: "Geisterwelt", emoji: "👻", hinweis: "Dunkel und spukig – Geister tauchen plötzlich auf!",
      schwerkraft: 9.81, grip: 0.92, rollwiderstand: 0.022, abprall: 0.05, luftdichte: 1.2,
      farben: {
        himmel: ["#1a1035", "#4a2f6e"], berge: ["#3a2a55", "#2a1d40"],
        boden: ["#3a2f3f", "#221a26"], oberflaeche: "#4a3f5c", kante: "#9a7bd0", punkte: "#2f2638",
        wolken: "rgba(90,70,130,0.45)", fenster: "#ffd27a"
      },
      sonne: "vollmond", wetter: "fledermaeuse", spuk: true,
      nacht: { dunkel: 0.5 },
      tipp: ["👻 In der Geisterwelt tauchen plötzlich Geister auf – keine Angst, die sind lieb!", "Keine Angst, die Geister sind lieb!"],
      deko: ["@baumtot:2.8", "@laternenkuerbis:0.9", "@pilz:0.9", "@baumtot:2.2", "@laterne:2.0", "@laternenkuerbis:1.2", "🕸️:1.0", "@stein:0.9", "@baumtot:3.2", "🦉:0.7", "@pilz:1.2"],
      beiwerk: ["@gras:0.35", "@stein:0.35", "@pilz:0.35"], kulisse: ["spukhaus", "tannen", "tannen"],
      gelaende: { amp: 9.0, welle: 40, holperAmp: 0.25, holperWelle: 6, trend: 0.025,
                  maxAuf: 31, maxAb: 42, schanzen: 1.1, buckel: 1.0, steil: 1.0, taeler: 1.0, berg: 1.1, sprung: 1.1, wellen: 1.0, klippe: 0.9, rampe: 0.9, kuppe: 1.1, stufe: 1.0, wildBasis: 0.55,
                  abstandElemente: 26 },
      tankAbstand: 310, muenzAbstand: 22,
      level: [ { laenge: 900, seed: 2501 }, { laenge: 1180, seed: 2502 }, { laenge: 1440, seed: 2503 }, { laenge: 1700, seed: 2504 } ]
    },
    {
      /* Katapultwelt: Katapulte vor Burggräben (Bau-Element "katapult", fahrt.js
         katapultSchritt): Das Auto wird in der Schale festgehalten, Gas drücken
         schleudert es über den Graben. Dazu Trampoline (Sprungmatten) und Rampen. */
      id: "katapult", name: "Katapultwelt", emoji: "🏰", hinweis: "Katapulte schleudern dich über Burggräben!",
      schwerkraft: 9.81, grip: 1.0, rollwiderstand: 0.02, abprall: 0.05, luftdichte: 1.2,
      farben: {
        himmel: ["#78c4f5", "#fff1d6"], berge: ["#9cc58a", "#78a86a"],
        boden: ["#8a6a48", "#5e4630"], oberflaeche: "#6fae4a", kante: "#a2d46e", punkte: "#6e5238", wasser: "#4f9bd6"
      },
      sonne: "sonne", wetter: null, trampolinStil: "matte",
      sonnenDeko: "krone",
      wasser: { tiefe: 0.6, maxBreite: 20, bremse: 0.055 },
      tipp: ["🎯 Fahr ins Katapult – dann drück Gas und du fliegst über den Burggraben! Trampoline schleudern dich auch hoch.", "Fahr ins Katapult und drück Gas!"],
      deko: ["@laubbaum:3.2", "🛡️:0.9", "@busch:1.0", "@kiste:1.0", "@laubbaum:2.6", "🏹:0.9", "@stein:1.0", "@blumen:0.6", "@tanne:3.0", "🎪:2.6"],
      beiwerk: ["@gras:0.4", "@blumen:0.4", "@stein:0.35"], kulisse: ["burg", "wald", "wald"],
      gelaende: { amp: 7.0, welle: 40, holperAmp: 0.15, holperWelle: 6, trend: 0.02,
                  maxAuf: 30, maxAb: 42, schanzen: 1.3, buckel: 0.7, steil: 0.8, taeler: 0.6, berg: 0.8, sprung: 0.9, wellen: 0.7, klippe: 0.6, rampe: 1.4, kuppe: 0.8, stufe: 0.8,
                  katapult: 1.6, trampolin: 0.9, wildBasis: 0.5,
                  abstandElemente: 25 },
      tankAbstand: 300, muenzAbstand: 22,
      level: [ { laenge: 920, seed: 2601 }, { laenge: 1200, seed: 2602 }, { laenge: 1460, seed: 2603 }, { laenge: 1720, seed: 2604 } ]
    },

    /* ---------------------------------------------------------------------
       Version 25: Bauernhof, Obstplantage, Röhrenwelt.
         wasser.schlamm  Pfützen sind Matsch: braun, bremsen stärker; wasser.tier
                         suhlt sich darin (statt der Ente)
         gelaende.scheunen  so viele Scheunen je Level, gleichmäßig verteilt (Endlos: alle
                         150 m): links durchs offene Tor hinein, rechts hinaus – dann
                         fliegt Stroh (fahrt.js pruefeScheunen)
         obst            Obst auf der Strecke: Einsammeln gibt einen kurzen Mini-Turbo
                         { abstand [m], dauer [s], beschl [m/s²], tempoMax (× vmax) }
         gelaende.roehre Röhren: alle roehreAbstand [m] eine (nicht zufällig), das Auto
                         fährt automatisch hindurch (fahrt.js roehrenSchritt)
       --------------------------------------------------------------------- */
    {
      /* Bauernhof: Schweine, Kühe, Hühner, Heuballen. In vielen Mulden steht Matsch,
         der doppelt so stark bremst wie Wasser (dort suhlt sich ein Schwein). Ab und zu
         eine Scheune: mitten hindurch, hinten fliegt das Stroh. */
      id: "bauernhof", name: "Bauernhof", emoji: "🐷", hinweis: "Matsch bremst – und mitten durch die Scheune!",
      schwerkraft: 9.81, grip: 0.95, rollwiderstand: 0.02, abprall: 0.05, luftdichte: 1.2,
      farben: {
        himmel: ["#79c6f5", "#fdf1cf"], berge: ["#b9d983", "#8dbf5f"],
        boden: ["#8a5a32", "#5e3c22"], oberflaeche: "#69ad3c", kante: "#a5d76a", punkte: "#6e4526", wasser: "#5a3416"
      },
      sonne: "sonne", wetter: null, sonnenDeko: "strohhut",
      wasser: { tiefe: 0.55, maxBreite: 14, bremse: 0.11, schlamm: true, tier: "🐖" },
      tipp: ["🐷 Matsch bremst dich – spring mit Schwung drüber! Und fahr durch die Scheunen!", "Matsch bremst! Fahr durch die Scheunen!"],
      deko: ["@schwein:0.9", "@heuballen:1.3", "@laubbaum:3.2", "@schwein:1.1", "🐄:1.6", "@strohballen:0.9", "@schwein:0.75", "🐔:0.55",
             "@vogelscheuche:1.8", "@milchkanne:0.7", "🐑:0.9", "@schwein:1.0", "@busch:1.0", "@heuballen:1.1"],
      beiwerk: ["@gras:0.45", "@stein:0.35", "@blumen:0.4"], kulisse: ["hof", "wald", "weide"],
      gelaende: { amp: 6.5, welle: 40, holperAmp: 0.2, holperWelle: 6, trend: 0.015,
                  maxAuf: 29, maxAb: 40, schanzen: 1.6, buckel: 0.8, steil: 0.6, taeler: 1.4, berg: 0.6, sprung: 1.3, wellen: 0.8, klippe: 0.4, rampe: 0.8, kuppe: 0.8, stufe: 0.5,
                  scheunen: 5, wildBasis: 0.45,
                  abstandElemente: 26 },
      tankAbstand: 280, muenzAbstand: 22,
      level: [ { laenge: 780, seed: 2701 }, { laenge: 1040, seed: 2702 }, { laenge: 1300, seed: 2703 }, { laenge: 1560, seed: 2704 } ]
    },
    {
      /* Obstplantage: Reihen von Apfel-, Birnen-, Kirsch-, Pflaumen- und Orangenbäumen.
         Auf der Strecke liegt Obst: Wer es einsammelt, bekommt einen kurzen Mini-Turbo
         (kleine Rakete, 1 s). */
      id: "obstgarten", name: "Obstplantage", emoji: "🍎", hinweis: "Sammle Obst – jedes gibt dir einen kleinen Turbo!",
      schwerkraft: 9.81, grip: 1.0, rollwiderstand: 0.018, abprall: 0.05, luftdichte: 1.2,
      farben: {
        himmel: ["#86cff9", "#fff4d8"], berge: ["#a9d78b", "#7dbd68"],
        boden: ["#8a6038", "#5e4026"], oberflaeche: "#58b548", kante: "#94de6a", punkte: "#6e4a2c"
      },
      sonne: "sonne", wetter: "pollen", sonnenDeko: "bluete",
      obst: { abstand: 30, dauer: 1.0, beschl: 10, tempoMax: 1.6 },
      tipp: ["🍎 Sammle das Obst ein – jedes gibt dir einen kleinen Raketen-Schub!", "Sammle Obst für einen kleinen Turbo!"],
      deko: ["@obstbaum:3.2", "@obstbaum:2.7", "@obstkiste:0.8", "@obstbaum:3.6", "@busch:1.0", "@obstbaum:2.9", "🐝:0.35:1.5",
             "@blumen:0.6", "@obstbaum:3.3", "@obstkiste:0.7", "🦋:0.4:1.3", "@obstbaum:2.5"],
      beiwerk: ["@gras:0.45", "@blumen:0.45", "@gras:0.35"], kulisse: ["wald", "obstreihen", "obstreihen"],
      gelaende: { amp: 8.0, welle: 42, holperAmp: 0.2, holperWelle: 6, trend: 0.02,
                  maxAuf: 30, maxAb: 42, schanzen: 1.3, buckel: 1.0, steil: 0.9, taeler: 0.8, berg: 1.0, sprung: 1.2, wellen: 1.1, klippe: 0.7, rampe: 0.9, kuppe: 1.0, stufe: 0.7, wildBasis: 0.55,
                  abstandElemente: 25 },
      tankAbstand: 300, muenzAbstand: 22,
      level: [ { laenge: 820, seed: 2801 }, { laenge: 1080, seed: 2802 }, { laenge: 1340, seed: 2803 }, { laenge: 1600, seed: 2804 } ]
    },
    {
      /* Röhrenwelt: Alle roehreAbstand Meter kommt eine riesige Glasröhre (groß genug
         für Trecker und Monster-Max). Hineinfahren – dann geht es automatisch senkrecht
         hoch, durch Loopings und Kurven nach links (näher) und rechts (weiter weg), bis
         die Röhre wieder auf dem Boden endet. Dazwischen kleine Hügel und Schanzen. */
      id: "roehren", name: "Röhrenwelt", emoji: "🌀", hinweis: "Verrückte Röhren: hoch, Looping, Kurven – und wieder raus!",
      schwerkraft: 9.81, grip: 1.0, rollwiderstand: 0.015, abprall: 0.06, luftdichte: 1.2,
      farben: {
        himmel: ["#a98bff", "#ffe2f3"], berge: ["#ffa6d6", "#c08cff"],
        boden: ["#5a3ea8", "#3d2a7a"], oberflaeche: "#3fd6c4", kante: "#b8fff4", punkte: "#7a5fd0"
      },
      sonne: "sonne", wetter: "konfetti", sonnenDeko: "brille", wolkenStil: "zuckerwatte",
      roehrenFarben: ["#ff4f9a", "#3fc8ff", "#ffc83f", "#6fe86f", "#ff8a3f", "#b07aff"],
      tipp: ["🌀 Fahr in die Röhre – dann geht's hoch, im Looping herum und um die Kurven!", "Ab in die Röhre!"],
      deko: ["@rohrbogen:1.8", "@busch:1.0", "@rohrwirbel:2.4", "@pilz:0.9", "@rohrbogen:1.3", "@kristall:0.9", "@rohrwirbel:1.8", "@blumen:0.6"],
      beiwerk: ["@gras:0.4", "@blumen:0.4"], kulisse: ["roehren", "wolkenberg", "roehren"],
      gelaende: { amp: 4.0, welle: 36, holperAmp: 0.15, holperWelle: 6, trend: 0.012,
                  maxAuf: 26, maxAb: 36, schanzen: 1.4, buckel: 1.3, steil: 0.2, taeler: 0.4, berg: 0, sprung: 0.5, wellen: 0.5, klippe: 0, rampe: 0.2, kuppe: 0.6, stufe: 0.3,
                  roehreAbstand: 30, wildBasis: 0.2,
                  abstandElemente: 13 },
      tankAbstand: 320, muenzAbstand: 22,
      level: [ { laenge: 800, seed: 2901 }, { laenge: 1050, seed: 2902 }, { laenge: 1300, seed: 2903 }, { laenge: 1550, seed: 2904 } ]
    },
    {
      /* Kopfüberwelt (Version 33): Kurz nach dem Start fährt man durch ein Umdreh-Tor –
         das ganze Bild klappt um, der Boden ist oben, der Himmel unten, Sprünge gehen
         nach unten. Weitere Tore drehen hin und her (welt.kopfueber, gelaende.tore,
         fahrt.pruefeTore). Die Physik bleibt dieselbe, nur die Grafik steht kopf –
         darum ist auch das Geisterrennen fair. Tasten und Anzeigen bleiben normal. */
      id: "kopfueber", name: "Kopfüberwelt", emoji: "🙃", hinweis: "Alles steht kopf – Sprünge gehen nach unten!",
      schwerkraft: 9.81, grip: 1.0, rollwiderstand: 0.016, abprall: 0.05, luftdichte: 1.2,
      farben: {
        himmel: ["#7ad7ff", "#fff1c9"], berge: ["#ffb6e1", "#c9a2ff"],
        boden: ["#7a4fc2", "#55348f"], oberflaeche: "#4fd1a5", kante: "#b6ffd9", punkte: "#9b74e0"
      },
      sonne: "sonne", wetter: "konfetti", sonnenDeko: "brille", wolkenStil: "zuckerwatte",
      kopfueber: { start: 12, abstand: 130, streuung: 70 },
      tipp: ["🙃 Fahr durchs Umdreh-Tor – dann steht alles kopf! Gas und Bremse bleiben gleich.", "Gleich steht alles kopf!"],
      deko: ["@laubbaum:3.0", "🎈:1.2:1.6", "@pilz:1.0", "@blumen:0.7", "@laubbaum:2.4", "🎈:1.0:2.4", "@busch:1.0", "🦇:0.7:3.0", "@pilz:1.4", "🐒:0.9"],
      beiwerk: ["@gras:0.4", "@blumen:0.45", "@stein:0.35"], kulisse: ["wald", "wolkenberg", "wald"],
      gelaende: { amp: 6.5, welle: 42, holperAmp: 0.18, holperWelle: 6, trend: 0.015,
                  maxAuf: 28, maxAb: 38, schanzen: 1.2, buckel: 1.0, steil: 0.7, taeler: 0.7, berg: 0.6, sprung: 0.9, wellen: 0.8, klippe: 0.5, rampe: 0.8, kuppe: 0.8, stufe: 0.7, wildBasis: 0.3,
                  abstandElemente: 28 },
      tankAbstand: 260, muenzAbstand: 22,
      level: [ { laenge: 760, seed: 3001 }, { laenge: 1000, seed: 3002 }, { laenge: 1250, seed: 3003 }, { laenge: 1500, seed: 3004 } ]
    },
    {
      /* Superheldenwelt (Version 34): Stadt in der Abenddämmerung, gefahren wird über
         Hochhausdächer mit Lücken. Am Himmel kreist ein Suchscheinwerfer mit Blitz
         (welt.scheinwerfer). Keine Logos oder Namen – nur Superhelden-Elemente:
           • Comic-Sprechblasen „BÄM!“, „ZACK!“ … bei Landung, Salto, Turbo (welt.comic)
           • Telefonzellen (welt.held.zelle): durchfahren → Heldenumhang für einige
             Sekunden: kleiner Schub, und in der Luft fällt man langsamer (gleiten)
           • Kätzchen auf den Dächern retten (welt.held.katze): einsammeln gibt Münzen */
      id: "helden", name: "Superheldenwelt", emoji: "🦸", hinweis: "Über die Dächer der Stadt – Umhang an und gleiten!",
      schwerkraft: 9.81, grip: 1.0, rollwiderstand: 0.015, abprall: 0.05, luftdichte: 1.2,
      farben: {
        himmel: ["#2a2f6e", "#ff9f6e"], berge: ["#4a3f7a", "#33295c"],
        boden: ["#4b5266", "#2e3242"], oberflaeche: "#6a7288", kante: "#ffd23f", punkte: "#3a4054",
        wolken: "rgba(255,190,170,0.55)", fenster: "#ffe27a"
      },
      sonne: "sonne", sonnenDeko: "brille", wetter: null, wolkenStil: "wenige",
      scheinwerfer: true, comic: true,
      held: { zelle: { abstand: 170, dauer: 7, sinkMax: 3.2 }, katze: { abstand: 85, muenzen: 25 },
              turbo: { beschl: 9, tempoMax: 1.5, dauer: 1.2 } },
      tipp: ["🦸 Fahr durch die Telefonzelle – dann bekommst du einen Heldenumhang und kannst gleiten!", "Ab in die Telefonzelle!"],
      deko: ["@laterne:2.4", "🏢:4.6", "@antenne:1.6", "@kiste:0.9", "🏬:4.0", "@solarpanel:1.1", "🚒:1.7", "@laterne:2.0", "🏢:3.6", "🚁:1.3:4.5", "@kiste:1.2", "🦸:1.0"],
      beiwerk: ["@stein:0.3", "@kiste:0.45"], kulisse: ["stadt", "stadt", "stadt"], kulisseGroesse: 1.3,
      gelaende: { amp: 5.0, welle: 46, holperAmp: 0.08, holperWelle: 8, trend: 0.012,
                  maxAuf: 26, maxAb: 36, schanzen: 1.3, buckel: 0.5, steil: 0.4, taeler: 0.4, berg: 0.4, sprung: 1.1, wellen: 0.3, klippe: 1.0, rampe: 0.9, kuppe: 0.5, stufe: 1.5,
                  luecke: 1.3, wildBasis: 0.35,
                  abstandElemente: 24 },
      tankAbstand: 280, muenzAbstand: 22,
      level: [ { laenge: 800, seed: 3101 }, { laenge: 1060, seed: 3102 }, { laenge: 1320, seed: 3103 }, { laenge: 1580, seed: 3104 } ]
    },
    {
      /* Schleimwelt (Version 35): giftgrüner Schleim überall – aber freundlich.
           • Schleimpfützen (welt.wasser mit schleim): kleben – bremsen wie Matsch und
             zusätzlich gleichmäßig (kleben [m/s²] · Eintauchtiefe), auch wenn man langsam ist
           • Schleimbäche (Bau-Element "band" mit welt.schleimbach): fließen immer gegen
             die Fahrtrichtung (2,5–4,5 m/s) und bremsen
           • Schleimtropfen fallen von oben aufs Auto (welt.schleimtropfen) und lassen
             grüne Flecken zurück, die langsam verblassen
           • Wackelschleim-Hügel (Trampoline im Stil "schleim"), dazu federt der Boden (abprall)
           • Blubberblasen in den Pfützen, freundliche Glibbermonster und Schleimfässer */
      id: "schleim", name: "Schleimwelt", emoji: "🟢", hinweis: "Giftgrüner Schleim – klebrig und glibberig!",
      schwerkraft: 9.81, grip: 1.05, rollwiderstand: 0.02, abprall: 0.26, luftdichte: 1.2,
      farben: {
        himmel: ["#3b2a5e", "#b6ef7a"], berge: ["#5a8a3a", "#3d6a2a"],
        boden: ["#4c3a66", "#2e2342"], oberflaeche: "#7fe23a", kante: "#ccff7a", punkte: "#3a2c52", wasser: "#6ee83a",
        wolken: "rgba(200,255,170,0.55)"
      },
      sonne: "sonne", sonnenDeko: "brille", wetter: "schleim", wolkenStil: "zuckerwatte",
      wasser: { tiefe: 0.5, maxBreite: 13, bremse: 0.12, schlamm: true, schleim: true, kleben: 2.2 },
      schleimbach: true, schleimtropfen: { abstand: 3.2 }, trampolinStil: "schleim",
      tipp: ["🟢 Schleim! Pfützen und Bäche sind klebrig – nimm Schwung! Die Wackelhügel federn dich hoch.", "Achtung, klebriger Schleim!"],
      deko: ["@glibber:1.0", "@schleimfass:1.1", "@pilz:1.0", "@glibber:1.4", "@baumtot:2.6", "@schleimfass:0.9", "@glibber:0.8", "@kristall:1.0", "🐸:0.6", "@glibber:1.2"],
      beiwerk: ["@stein:0.35", "@gras:0.4", "@pilz:0.35"], kulisse: ["roehren", "wolkenberg", "roehren"],
      gelaende: { amp: 6.0, welle: 40, holperAmp: 0.16, holperWelle: 6, trend: 0.014,
                  maxAuf: 27, maxAb: 36, schanzen: 1.1, buckel: 0.9, steil: 0.6, taeler: 1.1, berg: 0.6, sprung: 0.9, wellen: 0.8, klippe: 0.4, rampe: 0.7, kuppe: 0.7, stufe: 0.6,
                  trampolin: 0.7, band: 1.0, wildBasis: 0.3,
                  abstandElemente: 26 },
      tankAbstand: 240, muenzAbstand: 22,
      level: [ { laenge: 800, seed: 3201 }, { laenge: 1060, seed: 3202 }, { laenge: 1320, seed: 3203 }, { laenge: 1580, seed: 3204 } ]
    }
  ],

  /* Schwierigkeit innerhalb einer Welt: Level 1–4 (Level 4 = Profi-Level).
     auf/ab: Zuschlag auf die steilste Steigung/das steilste Gefälle [°],
     wild: wie oft Berge, Sprünge, Wellen und Klippen kommen (0 = nie) */
  levelStufen: [
    { amp: 0.8,  tank: 1.0,  steil: 0.8, auf: -2, ab: -2, wild: 0.0 },
    { amp: 1.0,  tank: 1.0,  steil: 1.0, auf: 1,  ab: 2,  wild: 0.6 },
    { amp: 1.15, tank: 1.0,  steil: 1.2, auf: 4,  ab: 5,  wild: 1.0 },
    { amp: 1.3,  tank: 0.95, steil: 1.4, auf: 7,  ab: 8,  wild: 1.35 }
  ],

  /* Endlos-Modus: wird mit der Strecke langsam schwerer */
  endlos: { ampMax: 1.35, ampStrecke: 1800, tankZuwachsStrecke: 3000 },

  /* Startguthaben für neue Spieler */
  startMuenzen: 0,

  /* Was ist neu? (Hilfe-Seite). Neueste Version oben; die Nummer ist dieselbe wie
     VERSION in sw.js und ?v= in index.html. */
  neuigkeiten: [
    { version: "39", titel: "Seifenkiste und E-Scooter", punkte: [
      "📦 Seifenkiste aus Karton und Klebeband: du läufst mit den Füßen, bergab rollt sie frei – ohne Gas kommt die Puste zurück",
      "🛴 E-Scooter: zieht sofort los, super wendig – und bei hohen Sprüngen machst du Stunts!",
      "🚛 Der Donner-Truck fährt jetzt gemütlicher" ] },
    { version: "38", titel: "Dein eigener Charakter", punkte: [
      "🧒 Bei „Wer fährt?“ gibt es jetzt ein eigenes Kärtchen: Name, Junge oder Mädchen, Haare kurz, mittel oder lang, Haar-, Augen- und Hautfarbe",
      "⚙️ Mit dem Zahnrad am Kärtchen kannst du deinen Charakter jederzeit ändern – er hat eigene Münzen, eigene Garage und eigene Level" ] },
    { version: "37", titel: "Der Donner-Truck", punkte: [
      "🚛 Neues Fahrzeug: eine riesige Zugmaschine mit hohen Auspuffrohren und schwarzem Rauch",
      "💪 Gemütlich, aber bärenstark: Berge, Matsch und Schleim bremsen ihn kaum – in der Luft ist er ganz träge" ] },
    { version: "36", titel: "Fairer fahren", punkte: [
      "⚖️ Luft-Kreisel, Spoiler, Bremsen und Leichtbau wirken jetzt viel schwächer",
      "🎛️ Gas und Bremse zugleich: Jetzt zählt das Gas – der Trick mit den perfekten Sprüngen geht nicht mehr" ] },
    { version: "35", titel: "Die Schleimwelt", punkte: [
      "🟢 Neue Welt Schleimwelt: Überall tropft giftgrüner Schleim!",
      "🫠 Schleimpfützen und Schleimbäche sind klebrig – nimm Schwung!",
      "💚 Schleimtropfen landen auf deinem Auto und machen grüne Flecken",
      "🟩 Wackelschleim-Hügel federn dich hoch, freundliche Glibbermonster schauen zu" ] },
    { version: "34", titel: "Die Superheldenwelt", punkte: [
      "🦸 Neue Welt Superheldenwelt: über die Dächer der Stadt, am Himmel kreist der Suchscheinwerfer",
      "📞 Fahr durch die Telefonzelle: Heldenumhang an – du bekommst Schwung und kannst gleiten!",
      "🐱 Rette die Kätzchen auf den Dächern",
      "💥 BÄM! ZACK! WUSCH! – Comic-Sprechblasen bei Landungen und Saltos" ] },
    { version: "33", titel: "Die Kopfüberwelt", punkte: [
      "🙃 Neue Welt Kopfüberwelt: Fahr durchs Umdreh-Tor – und plötzlich steht alles kopf!",
      "⬇️ Kopfüber springst du nach unten, der Himmel ist unten und der Boden oben",
      "🔄 Weitere Tore drehen die Welt wieder um – hin und her" ] },
    { version: "32", titel: "Vier neue Upgrades", punkte: [
      "🌪️ Luft-Kreisel: hält dich in der Luft ruhig – so landest du leichter sauber",
      "🪽 Spoiler: drückt dich auf die Straße und macht etwas schneller – man sieht ihn hinten am Auto!",
      "🛑 Bremsen: kräftiger bremsen und schneller rückwärts",
      "🪶 Leichtbau: leichter, schneller los und weitere Sprünge" ] },
    { version: "31", titel: "Das Wasserstoffauto", punkte: [
      "💧 Neues Fahrzeug H₂-Blubber: fährt mit Wasserstoff – zwei große Tanks hinten drauf, blaue Schläuche, und aus dem Auspuff tropft nur Wasser!",
      "🧪 Statt Kanister sammelt es blaue H₂-Flaschen" ] },
    { version: "30", titel: "Neue Tiere und lustige Spuren", punkte: [
      "🐺 Neue Beifahrer: Wolf (heult nach jedem Salto!), Pinguin, Panda, Fuchs, Eule und Schildkröte mit Sturzhelm",
      "💨 Neue Spuren: Pupswolken, Gummienten, Bananen, Popcorn, Tatzen und Socken" ] },
    { version: "29", titel: "Schnellere Förderbänder und Ton-Hilfe", punkte: [
      "⏩ Spielzeugfabrik: Die Förderbänder laufen jetzt schneller – vorwärts ein richtiger Schub!",
      "📱 Kein Ton auf dem Handy? In den Einstellungen gibt es jetzt „Handy-Ton“ und „Ton testen“" ] },
    { version: "28", titel: "Dampf-Lok mit Anhänger", punkte: [
      "🚂 Neues Fahrzeug Dampf-Lok: Tschu-tschu! Mit Kohlewagen und einem kleinen Anhänger an der Deichsel, der lustig hin und her wackelt",
      "🚂 Der Zug ist lang: Saltos und Loopings gehen nicht – in der Luft kann man ihn aber trotzdem lenken",
      "🛋️ Das Turbinen-Sofa ist jetzt gemütlicher: weniger Schub und nicht mehr ganz so schnell" ] },
    { version: "27", titel: "Kein Absturz hinter dem Start", punkte: [
      "🛑 Wer vom Start aus rückwärts fährt, wird nach gut einem Bildschirm sanft angehalten – das Auto fällt nicht mehr vom Rand der Welt" ] },
    { version: "26", titel: "Scheunen und schönere Röhren", punkte: [
      "🛖 Bauernhof: In jedem Level stehen jetzt fünf Scheunen – links durchs offene Tor hinein, rechts wieder hinaus!",
      "🛫 Mehr Schanzen auf dem Bauernhof: Spring über den Matsch!",
      "🌀 Röhrenwelt: Loopings liegen nie mehr übereinander – einer nach oben, einer nach unten" ] },
    { version: "25", titel: "Bauernhof, Obstplantage und Röhrenwelt", punkte: [
      "🐷 Neue Welt Bauernhof: Schweine, Kühe und Hühner – Matschpfützen bremsen dich!",
      "🛖 Fahr mitten durch die Scheune – hinten fliegt das Stroh hoch!",
      "🍎 Neue Welt Obstplantage: Äpfel, Birnen, Kirschen, Pflaumen und Orangen an den Bäumen",
      "🚀 Sammle das Obst auf der Strecke – jedes gibt dir einen kleinen Raketen-Schub",
      "🌀 Neue Welt Röhrenwelt: riesige Glasröhren – hinein, senkrecht hoch, Looping, Kurven und wieder raus!" ] },
    { version: "24", titel: "Ruhiger, echter Hintergrund", punkte: [
      "🏔️ Die Berge im Hintergrund flimmern nicht mehr: Sie gleiten jetzt wie echte Kulissen vorbei",
      "🔭 Beim Schnellfahren zoomen nahe Hügel mit, ferne Berge bleiben fast gleich groß",
      "⛰️ Auf hohen Bergen rutscht der Hintergrund nicht mehr weg",
      "🏠 Nichts hängt mehr halb in der Luft oder steckt halb im Hang",
      "❄️ Schnee, Blätter und Funken bleiben beim Springen in der Luft stehen",
      "🧱 Klemmbaustein-Land: ruhige Stufen und Wolken aus richtigen Steinen" ] },
    { version: "23", titel: "Beifahrer, Felgen und Themen-Sonnen", punkte: [
      "🐾 In der Garage: Ein Tier fährt mit – Hund, Katze, Hase, Papagei, Mini-Dino oder sogar ein Einhorn!",
      "🛞 Neue Felgen: Gold, Stern, Blume, Neon und Regenbogen",
      "☀️ Jede Welt hat ihre eigene Sonne: aus Bausteinen, als Lolli, Zahnrad, Sonnenblume, mit Bauhelm, Mütze, Sonnenbrille …",
      "🧱 Im Klemmbaustein-Land sind auch Wolken und Hügel aus Bausteinen",
      "🛋️ Das Turbinen-Sofa hüpft nicht mehr so wild",
      "🦅 Die Adler im Gebirge und die Fledermäuse kreisen jetzt ruhig am Himmel" ] },
    { version: "22", titel: "Turbinen-Sofa und echter Drehzahlmesser", punkte: [
      "🛋️ Neues Fahrzeug Turbinen-Sofa: Erst jault die Turbine, dann faucht sie – und dann geht's ab!",
      "⏱️ Der Drehzahlmesser zeigt jetzt die ganze Drehzahl (z. B. 4.600 U/min) und den Gang",
      "⚡ Elektromotoren drehen bis 22.000 U/min, haben keine Gänge – und sind im Stand ganz leise" ] },
    { version: "21", titel: "Geheime Welten und besseres Skateboard", punkte: [
      "🤫 Im ❓ siehst du nur die Welten, die du schon freigespielt hast – die anderen bleiben eine Überraschung",
      "🛹 Das Skateboard kippt am Berg nicht mehr so leicht nach hinten: Meistens kannst du auf dem Gas bleiben",
      "👦 Jonte sieht jetzt mehr wie ein Junge aus" ] },
    { version: "20", titel: "Fünf neue Welten, Skateboard und Flugzeug", punkte: [
      "⛰️ Gebirge: steile Felsen, tiefe Abgründe, große Schanzen, Steinböcke und Adler",
      "👻 Geisterwelt: dunkel, Vollmond, Fledermäuse – und freundliche Geister, die plötzlich auftauchen",
      "🏰 Katapultwelt: Fahr ins Katapult, drück Gas – und du fliegst über den Burggraben! Dazu Trampoline",
      "🔷 Glaswelt: alles fast durchsichtig, Glasblöcke zerspringen beim Durchfahren in Scherben",
      "🧱 Klemmbaustein-Land: Bausteine fliegen weg, große Säulen zerfallen – und bremsen dich ab",
      "🛹 Neues Fahrzeug E-Skateboard: Du stehst drauf!",
      "✈️ Neues Fahrzeug Propeller-Flieger: segelt knapp über dem Boden",
      "❓ Neuer Knopf „So geht's“: das Spiel kurz erklärt und alle Welten mit Bild" ] },
    { version: "19", titel: "Raumstation", punkte: [
      "🛸 Neue Welt Raumstation: Antennen, Solarflügel, die Erde am Himmel",
      "✨ In den leuchtenden Säulen ist die Schwerkraft fast weg – du schwebst und holst dir die Münzen ganz oben" ] },
    { version: "18", titel: "Roter Planet", punkte: [
      "🪐 Neue Welt auf dem Mars: wenig Schwerkraft, riesige Sprünge und zwei kleine Monde am Himmel",
      "🌪️ Staubstürme schieben dich mal nach vorn, mal zurück – und Fiete trägt einen Raumhelm" ] },
    { version: "17", titel: "Spielzeugfabrik", punkte: [
      "🧸 Neue Welt Spielzeugfabrik: Bauklötze, Kreisel, Zahnräder und bunter Dampf aus den Schornsteinen",
      "⏩ Förderbänder! Vorwärts machen sie dich doppelt so schnell, gegen Rückwärtsbänder musst du kräftig Gas geben" ] },
    { version: "16", titel: "Spielstand sichern und Spuren", punkte: [
      "💾 Spielstand-Code: In den Einstellungen steht ein Code. Kopieren, dir selbst schicken – und auf jedem Handy wieder eingeben",
      "💫 Neu in der Garage: Spuren! Sternenstaub, Seifenblasen, Herzen, Funken, Konfetti oder ein Regenbogen fliegen hinter dir her",
      "⭐ Drei Sterne gibt es jetzt schon ab 85 % der Münzen",
      "💡 Erklär-Tipps kommen nur die ersten Male – auch nach einem Neustart. Und keiner geht mehr verloren",
      "📱 Hochkant verdeckt der Hinweis „Handy quer halten“ den Tacho nicht mehr" ] },
    { version: "15", titel: "Fünf neue Welten", punkte: [
      "🌧️ Pfützenland: Es regnet, in den Tälern stehen Pfützen – platsch! Das Wasser spritzt und bremst ein bisschen",
      "🌻 Riesengarten: Du bist winzig zwischen Riesenblumen. Hüpfpilze schleudern dich hoch – boing!",
      "🍂 Herbststurm: Rückenwind schiebt dich, Gegenwind bremst. Das Moped pustet der Wind am meisten weg",
      "🐠 Meeresgrund: Unter Wasser schwebt alles, Fiete trägt einen Taucherhelm und der Auspuff blubbert",
      "🦉 Nachtwald: Im Dunkeln leuchten deine Scheinwerfer, Laternen und Glühwürmchen" ] },
    { version: "14", titel: "Hochkant oder quer", punkte: [
      "📱 In der installierten App kannst du in den Einstellungen wählen: quer, hochkant oder mit dem Handy mitdrehen",
      "↕️ Wer hochkant spielt, bekommt keinen „Handy quer halten“-Hinweis mehr" ] },
    { version: "13", titel: "Start-Ampel", punkte: [
      "🚦 Vor jedem Rennen zählt eine Ampel 3 – 2 – 1 – LOS! Vorher kannst du nur den Motor aufheulen lassen",
      "💡 Tipps stehen jetzt klein oben links und lassen sich in den Einstellungen ausschalten",
      "🦘 Die Sprungfeder braucht jetzt 3 Saltos und nach dem Sprung 15 Sekunden Pause" ] },
    { version: "12", titel: "Ruhiger und schöner", punkte: [
      "🌵 Bäume, Kakteen und Felsen wackeln nicht mehr in der Größe, wenn das Auto schneller oder langsamer wird",
      "⛰️ Am Hang hängt nichts mehr in der Luft: alles steht fest auf dem Boden",
      "🏞️ Echte Tiefe: die Berge hinten ziehen langsam, die vorderen schneller vorbei",
      "❄️ Weniger Schneeflocken, Blätter und Funken in der Luft – man sieht das Auto besser" ] },
    { version: "11", titel: "Urzeit und schönere Landschaften", punkte: [
      "🦕 Neue Welt Urzeit: Dinosaurier (Brachiosaurus, Stegosaurus, Triceratops, T-Rex) in vielen Farben, Farne und Dino-Nester",
      "🌋 Vulkaninsel neu: rauchende Vulkane im Hintergrund, Lavasteine mit glühenden Rissen, kleine Vulkankegel",
      "🌲 Alle Welten mit gezeichneten Bäumen, Tannen, Palmen, Kakteen, Felsen und Kristallen – jedes Mal ein bisschen anders",
      "⛰️ Hintergründe mit drei Ebenen: Wälder, Tafelberge, Stadt, Gipfel, Riesenräder …" ] },
    { version: "10", titel: "Kristallhöhle und schönere Autos", punkte: [
      "💎 Neue Welt Kristallhöhle: unter der Erde, mit Tropfsteinen, leuchtenden Kristallen und Laternen an der Decke",
      "🚗 Alle Fahrzeuge glänzen jetzt: Licht und Schatten, Scheinwerfer, Chrom, und der Rennwagen hat einen echten Heckflügel",
      "⭐ Aufkleber (Flammen, Sterne …) sitzen jetzt immer genau auf dem Auto",
      "🤸 Saltos zählen jetzt immer, vorwärts und rückwärts, auch nach Schanzen und wenn das Auto beim Landen kurz hüpft",
      "🚀 Die Knöpfe leuchten nur noch bunt, wenn sie wirklich gehen" ] },
    { version: "9", titel: "Turbo, Sprungfeder und Hilfe", punkte: [
      "🚀 Turbo: Lila Raketen-Kanister einsammeln, dann den 🚀-Knopf links drücken. Flammen kommen aus den Düsen, und das Auto wird doppelt so schnell!",
      "🦘 Sprungfeder: Mach 3 Saltos oder Loopings, dann den 🦘-Knopf drücken, und das Auto hüpft hoch. Am besten oben auf dem Berg!",
      "❓ Diese Hilfe-Seite mit allem, was man im Spiel machen kann" ] },
    { version: "8", titel: "Freizeitpark", punkte: [
      "🎡 Neue Welt Freizeitpark mit 4 Leveln",
      "🎢 Loopings, auch zwei hintereinander. Nur mit Vollgas kommst du durch! +75 Münzen",
      "🕳️ Grubensprünge: steil hoch und auf der anderen Seite landen" ] },
    { version: "7", titel: "Bruchlandung und Updates", punkte: [
      "💥 Bruchlandung kann man in den Einstellungen ausschalten (ist am Anfang aus)",
      "🎈 Der Ballon kommt erst, wenn das Auto wirklich festliegt",
      "✨ Die App aktualisiert sich selbst und sagt Bescheid" ] },
    { version: "6", titel: "Fiete und Jonte", punkte: [
      "🧒 Fiete und Jonte sehen aus wie auf dem Foto",
      "🧢 Looks zum Auswählen: Fiete mit oder ohne Cap, Jonte mit Dutt oder offenen Haaren" ] },
    { version: "5", titel: "Neue Fahrzeuge und Welten", punkte: [
      "🚜 Trecker und ⚡ E-Auto mit eigenem Klang",
      "🔊 Echter Motorklang mit Gangschaltung",
      "🎢 Achterbahn-Park und 🌈 Regenbogenland, mehr und schwerere Level" ] },
    { version: "4", titel: "Zu zweit", punkte: [
      "👥 Jonte fährt mit: zwei Spieler, jeder mit eigener Garage",
      "👻 Geisterrennen gegeneinander, 🎲 Würfeln, wer anfängt" ] },
    { version: "1–3", titel: "Los geht's", punkte: [
      "🚙 Das Spiel: Berge rauf, Münzen und Benzin sammeln, Garage",
      "🦸 Fiete in fünf Superhelden-Looks" ] }
  ]
};
