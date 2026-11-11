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
    { welt: "vulkan", fahrzeug: "feuerkutsche", stufe: 0, seed: 2036, vorlauf: 630 },
    { welt: "achterbahn", fahrzeug: "feuerkutsche", stufe: 2, seed: 2147, vorlauf: 1110 },
    { welt: "regenbogen", fahrzeug: "flugzeug", stufe: 1, seed: 2094, vorlauf: 465 },
    { welt: "freizeitpark", fahrzeug: "wasserstoff", stufe: 0, seed: 2223, vorlauf: 780 },
    { welt: "hoehle", fahrzeug: "eauto", stufe: 2, seed: 2217, vorlauf: 915 },
    { welt: "pfuetzen", fahrzeug: "monster", stufe: 2, seed: 2340, vorlauf: 990 },
    { welt: "garten", fahrzeug: "renner", stufe: 0, seed: 2436, vorlauf: 1020 },
    { welt: "herbst", fahrzeug: "sofa", stufe: 1, seed: 2592, vorlauf: 1185 },
    { welt: "meer", fahrzeug: "wasserstoff", stufe: 1, seed: 2715, vorlauf: 465 },
    { welt: "nacht", fahrzeug: "moped", stufe: 1, seed: 2682, vorlauf: 465 },
    { welt: "fabrik", fahrzeug: "renner", stufe: 1, seed: 2831, vorlauf: 480 },
    { welt: "mars", fahrzeug: "mond", stufe: 1, seed: 2941, vorlauf: 405 },
    { welt: "station", fahrzeug: "flugzeug", stufe: 0, seed: 3057, vorlauf: 495 },
    { welt: "glas", fahrzeug: "flitzer", stufe: 1, seed: 3044, vorlauf: 375 },
    { welt: "bausteine", fahrzeug: "traktor", stufe: 0, seed: 3147, vorlauf: 435 },
    { welt: "gebirge", fahrzeug: "traktor", stufe: 2, seed: 3258, vorlauf: 300 },
    { welt: "geister", fahrzeug: "sofa", stufe: 1, seed: 3465, vorlauf: 705 },
    { welt: "katapult", fahrzeug: "mond", stufe: 1, seed: 3523, vorlauf: 225 },
    { welt: "bauernhof", fahrzeug: "eauto", stufe: 2, seed: 3575, vorlauf: 510 },
    { welt: "obstgarten", fahrzeug: "scooter", stufe: 1, seed: 3821, vorlauf: 360 },
    { welt: "roehren", fahrzeug: "skateboard", stufe: 1, seed: 3827, vorlauf: 795 },
    { welt: "kopfueber", fahrzeug: "renner", stufe: 0, seed: 3891, vorlauf: 990 },
    { welt: "helden", fahrzeug: "mond", stufe: 0, seed: 4001, vorlauf: 750 },
    { welt: "schleim", fahrzeug: "monster", stufe: 0, seed: 4072, vorlauf: 465 },
    { welt: "wolken", fahrzeug: "sofa", stufe: 2, seed: 4248, vorlauf: 465 },
    { welt: "zirkus", fahrzeug: "moped", stufe: 0, seed: 4227, vorlauf: 615 },
    { welt: "daten", fahrzeug: "wasserstoff", stufe: 1, seed: 4461, vorlauf: 285 },
    { welt: "chemie", fahrzeug: "badewanne", stufe: 2, seed: 4630, vorlauf: 525 }
  ]
};
