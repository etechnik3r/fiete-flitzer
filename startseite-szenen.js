/* ===========================================================================
   Fiete Flitzer – startseite-szenen.js  (ERZEUGT von werkzeuge/startseite.js)
   ---------------------------------------------------------------------------
   Je Welt eine Szene für die Startseiten-Show: Fahrzeug, Level, Zufalls-Seed des
   Show-Fahrers und Vorlauf (so viele 1/60-s-Schritte wird unsichtbar vorgefahren,
   dann sieht man 8 Sekunden). Nicht von Hand ändern – neu erzeugen.
   =========================================================================== */
var FF = globalThis.FF = globalThis.FF || {};

FF.STARTSEITE = {
  dauer: 8,
  upgrades: {motor: 3, reifen: 3, federung: 3, tank: 5, kreisel: 3, bremse: 2},
  szenen: [
    { welt: "wiese", fahrzeug: "flitzer", stufe: 0, seed: 1000, vorlauf: 315 },
    { welt: "wueste", fahrzeug: "renner", stufe: 0, seed: 1175, vorlauf: 570 },
    { welt: "baustelle", fahrzeug: "lkw", stufe: 1, seed: 1370, vorlauf: 990 },
    { welt: "schnee", fahrzeug: "schlitten", stufe: 2, seed: 1513, vorlauf: 960 },
    { welt: "mond", fahrzeug: "luftkissen", stufe: 2, seed: 1649, vorlauf: 750 },
    { welt: "bonbon", fahrzeug: "badewanne", stufe: 1, seed: 1713, vorlauf: 480 },
    { welt: "dschungel", fahrzeug: "kettenwagen", stufe: 2, seed: 1869, vorlauf: 825 },
    { welt: "urzeit", fahrzeug: "eauto", stufe: 0, seed: 1718, vorlauf: 390 },
    { welt: "vulkan", fahrzeug: "feuerkutsche", stufe: 1, seed: 2043, vorlauf: 1065 },
    { welt: "achterbahn", fahrzeug: "sofa", stufe: 2, seed: 2017, vorlauf: 195 },
    { welt: "regenbogen", fahrzeug: "flugzeug", stufe: 1, seed: 2094, vorlauf: 465 },
    { welt: "freizeitpark", fahrzeug: "wasserstoff", stufe: 0, seed: 2223, vorlauf: 780 },
    { welt: "hoehle", fahrzeug: "eauto", stufe: 2, seed: 2217, vorlauf: 915 },
    { welt: "pfuetzen", fahrzeug: "monster", stufe: 2, seed: 2340, vorlauf: 990 },
    { welt: "garten", fahrzeug: "moped", stufe: 2, seed: 2398, vorlauf: 720 },
    { welt: "herbst", fahrzeug: "traktor", stufe: 1, seed: 2475, vorlauf: 1080 },
    { welt: "meer", fahrzeug: "wasserstoff", stufe: 1, seed: 2715, vorlauf: 465 },
    { welt: "nacht", fahrzeug: "mond", stufe: 1, seed: 2747, vorlauf: 450 },
    { welt: "fabrik", fahrzeug: "renner", stufe: 1, seed: 2831, vorlauf: 480 },
    { welt: "mars", fahrzeug: "dampflok", stufe: 0, seed: 2986, vorlauf: 435 },
    { welt: "station", fahrzeug: "flugzeug", stufe: 0, seed: 3057, vorlauf: 495 },
    { welt: "glas", fahrzeug: "renner", stufe: 1, seed: 3122, vorlauf: 915 },
    { welt: "bausteine", fahrzeug: "mond", stufe: 1, seed: 3232, vorlauf: 435 },
    { welt: "gebirge", fahrzeug: "traktor", stufe: 2, seed: 3258, vorlauf: 300 },
    { welt: "geister", fahrzeug: "sofa", stufe: 1, seed: 3465, vorlauf: 705 },
    { welt: "katapult", fahrzeug: "flitzer", stufe: 1, seed: 3432, vorlauf: 270 },
    { welt: "bauernhof", fahrzeug: "eauto", stufe: 2, seed: 3575, vorlauf: 510 },
    { welt: "obstgarten", fahrzeug: "scooter", stufe: 1, seed: 3821, vorlauf: 360 },
    { welt: "roehren", fahrzeug: "skateboard", stufe: 1, seed: 3827, vorlauf: 795 },
    { welt: "kopfueber", fahrzeug: "renner", stufe: 0, seed: 3891, vorlauf: 990 },
    { welt: "helden", fahrzeug: "moped", stufe: 0, seed: 3936, vorlauf: 795 },
    { welt: "schleim", fahrzeug: "monster", stufe: 0, seed: 4072, vorlauf: 465 },
    { welt: "wolken", fahrzeug: "sofa", stufe: 2, seed: 4248, vorlauf: 465 },
    { welt: "zirkus", fahrzeug: "scooter", stufe: 0, seed: 4396, vorlauf: 870 },
    { welt: "daten", fahrzeug: "wasserstoff", stufe: 2, seed: 4468, vorlauf: 1095 },
    { welt: "chemie", fahrzeug: "flugzeug", stufe: 1, seed: 4519, vorlauf: 540 }
  ]
};
