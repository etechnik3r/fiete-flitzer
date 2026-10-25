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
      liegezeit: 0.9,          // so lange [s] auf dem Dach / der Seite, bevor geholfen wird
      seitenWinkel: 1.4,       // ab diesem Winkel [rad] (≈ 80°) gilt "liegt auf der Seite"
      seitenZeit: 2.2          // so lange auf der Seite + kaum Tempo → Hilfe
    },
    fest: {                    // Festgefahren: gemessen am Fortschritt nach vorn
      schritt: 2.5,            // so weit [m] muss das Auto über seinen bisher weitesten Punkt kommen
      tipp: 3.5,               // so lange [s] Pedal ohne Fortschritt → Tipp "Nimm Anlauf!"
      hilfe: 8,                // … → der Ballon trägt das Auto über das Hindernis
      hilfeLeicht: 6           // dasselbe bei Schwierigkeit "Leicht"
    },
    saltoBonus: 50,            // Münzen pro Salto
    luftZeitMin: 1.2,          // ab so viel Flugzeit [s] gibt es einen Luftsprung-Bonus
    luftBonusProSekunde: 15,   // Münzen pro Sekunde Flugzeit
    sammelRadius: 0.75,        // Münze/Kanister wird eingesammelt, wenn so nah [m] an Rad, Kopf oder Karosserie
    sterne2: 0.6,              // ab 60 % der Münzen (Wert) gibt es 2 Sterne
    sterne3: 0.9,              // ab 90 % 3 Sterne
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
      upgrades: ["motor", "reifen", "federung", "tank", "allrad"]
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
      upgrades: ["motor", "reifen", "federung", "tank", "allrad"]
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
      upgrades: ["motor", "reifen", "federung", "tank"]
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
      klang: { art: "elektro", surren: 2100, avasTon: 330, max: 12000, lautstaerke: 1.0, abrollen: 1.1 },
      upgrades: ["motor", "reifen", "federung", "tank", "allrad"]
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
      upgrades: ["motor", "reifen", "federung", "tank", "allrad"]
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
      upgrades: ["motor", "reifen", "federung", "tank"]
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
      upgrades: ["motor", "reifen", "federung", "tank", "allrad"]
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
      klang: { art: "elektro", surren: 900, avasTon: 220, max: 8000, weltraum: true, lautstaerke: 1.0, abrollen: 1.0 },
      upgrades: ["motor", "reifen", "federung", "tank"]
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
    allrad:   { name: "Allrad",   icon: "4×4", stufen: 1, text: "Alle Räder treiben an",       faktor: 1, preisMal: 9 }
  },
  /* Wirkung pro Upgrade-Stufe */
  upgradeWirkung: {
    motorDrehmoment: 0.15,     // +15 % Drehmoment je Stufe
    motorTempo: 0.07,          // +7 % Höchstgeschwindigkeit je Stufe
    reifenGrip: 0.08,          // +0,08 Reibwert je Stufe
    federDaempfung: 0.07,      // +0,07 Dämpfungsgrad je Stufe
    federWeg: 0.07,            // +7 % Federweg je Stufe
    tank: 0.22                 // +22 % Tankinhalt je Stufe
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
    { id: "regenbogen", name: "Regenbogen", wert: "regenbogen", preis: 3000 }
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

  /* -------------------------------------------------------------------------
     6a) DIE KINDER – jedes hat ein eigenes Profil (Münzen, Garage, Outfit,
     Fortschritt). Aussehen:
       haut/hautRand, haar/haarDunkel, augen   Farben
       frisur      "strubbel" (kurz, verwuschelt) | "lang" (bis zur Schulter)
       groesse     so viel [m] sitzt der Kopf höher (größeres Kind)
       breite      Faktor für Oberkörper, Arme und Gesicht (schlanker < 1)
     Die Physik ist für beide gleich – nur das Aussehen unterscheidet sich.
     ------------------------------------------------------------------------- */
  kinder: [
    { id: "fiete", name: "Fiete", haut: "#ffdcc4", hautRand: "#d99b78", haar: "#f6d35e", haarDunkel: "#d29f2a",
      augen: "#7b4a22", frisur: "strubbel", groesse: 0, breite: 1 },
    { id: "jonte", name: "Jonte", haut: "#ffd9c0", hautRand: "#d69a7a", haar: "#8a5a32", haarDunkel: "#5c381b",
      augen: "#6b3f1d", frisur: "lang", groesse: 0.09, breite: 0.86 }
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
     deko: reine Kulisse, "Emoji:Größe in Metern"
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
      deko: ["🌳:2.8", "🌳:2.3", "🌲:3.0", "🌷:0.7", "🌻:1.1", "🌼:0.6", "🍄:0.6", "🐞:0.35", "🐄:1.6", "🐇:0.6"],
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
      deko: ["🌵:2.2", "🌵:1.5", "🐪:2.2", "🌴:3.2", "🏺:0.7", "🦎:0.45", "🪨:1.0"],
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
      deko: ["🏗️:4.4", "🚧:1.0", "🧱:0.9", "🛢️:1.0", "🚛:2.6", "🪨:1.0", "🚧:0.8", "📦:0.8", "⛏️:0.7"],
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
        himmel: ["#8fb8ef", "#eef6ff"], berge: ["#e3eefc", "#c3d6f2"],
        boden: ["#9fb5d4", "#6f86aa"], oberflaeche: "#ffffff", kante: "#e6f2ff", punkte: "#c9d8ee"
      },
      sonne: "sonne", wetter: "schnee",
      deko: ["🌲:3.0", "🌲:2.4", "⛄:1.4", "🐧:0.8", "🦌:1.6", "🏔️:3.5", "🪨:0.9"],
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
      deko: ["🪨:1.0", "🪨:0.6", "🛸:1.6", "🚩:1.1", "🛰️:1.4", "👽:0.8"],
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
      deko: ["🍭:2.2", "🍬:0.8", "🧁:1.0", "🍩:1.1", "🍦:1.5", "🍫:0.9", "🍭:1.6", "🎂:1.3"],
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
      deko: ["🌴:3.4", "🌴:2.6", "🦜:0.8", "🌺:0.8", "🐒:1.1", "🌿:1.2", "🦋:0.5", "🐸:0.45", "🍌:0.6"],
      gelaende: { amp: 9.5, welle: 36, holperAmp: 0.3, holperWelle: 5, trend: 0.028,
                  maxAuf: 32, maxAb: 42, schanzen: 0.9, buckel: 1.2, steil: 1.2, taeler: 0.9, berg: 1.2, sprung: 0.6, wellen: 0.8, klippe: 1.0, rampe: 1.0, kuppe: 1.1, stufe: 1.0, wildBasis: 0.35,
                  abstandElemente: 30 },
      tankAbstand: 270, muenzAbstand: 22,
      level: [ { laenge: 620, seed: 601 }, { laenge: 820, seed: 602 }, { laenge: 1020, seed: 603 }, { laenge: 1220, seed: 604 } ]
    },
    {
      id: "vulkan", name: "Vulkaninsel", emoji: "🌋", hinweis: "Große Schanzen und steile Rampen",
      schwerkraft: 9.81, grip: 0.95, rollwiderstand: 0.025, abprall: 0.05, luftdichte: 1.2,
      farben: {
        himmel: ["#43213f", "#ff8a5c"], berge: ["#5a2d3a", "#3d1f2c"],
        boden: ["#4a3a3a", "#2e2424"], oberflaeche: "#6b5555", kante: "#ff7b3a", punkte: "#5c4646"
      },
      sonne: "vulkan", wetter: "funken",
      deko: ["🌋:3.5", "🦕:2.8", "🪨:1.2", "🌴:2.6", "🦖:2.2", "🪨:0.7"],
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
      deko: ["🎡:4.6", "🎢:4.0", "🎠:2.6", "🎪:3.2", "🎈:1.2", "🍿:0.8", "🍦:1.0", "🧸:0.9", "🎈:1.6"],
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
      gelaende: { amp: 12.0, welle: 40, holperAmp: 0.3, holperWelle: 6, trend: 0.035,
                  maxAuf: 35, maxAb: 44, schanzen: 1.4, buckel: 1.0, steil: 1.3, taeler: 1.0, berg: 1.3, sprung: 1.3, wellen: 1.2, klippe: 1.0, rampe: 1.0, kuppe: 1.2, stufe: 1.0, wildBasis: 0.5,
                  abstandElemente: 27 },
      tankAbstand: 340, muenzAbstand: 21,
      level: [ { laenge: 800, seed: 801 }, { laenge: 1050, seed: 802 }, { laenge: 1300, seed: 803 }, { laenge: 1550, seed: 804 } ]
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
  startMuenzen: 0
};
