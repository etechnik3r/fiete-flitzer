# 🦸🚙 Fiete Flitzer

Ein kindgerechtes Berg-Rennspiel von **✨ JONFIE STUDIOS ✨** für Kinder ab
ca. 6 Jahren, gebaut nach dem Vorbild von *Hill Climb Racing*:
**rechts Gas, links Bremse**, Münzen und Benzin sammeln, das Auto in der
Garage verbessern. Läuft im Browser, ist als **PWA installierbar** und auch
offline spielbar.

**Fiete** ist ein blonder Junge mit braunen Augen, verstrubbelten Haaren und
Kleidung in Superhelden-Farben: blauer Anzug mit gelbem Stern und roter
Umhang, der im Fahrtwind flattert. **Jonte** ist größer und etwas schmaler,
hat braune Augen und lange braune Haare. Beide spielen allein oder
**zu zweit im Geisterrennen** gegeneinander. Niemand kann sich **wehtun**. Bei einem
Überschlag gibt es kein „Game Over“ und kein ekliges Geräusch. Stattdessen
ruft das Spiel
**„Hoppla!“**, ein Bündel Luftballons hebt das Auto hoch und stellt es wieder
auf die Räder. Das kostet nur etwas Benzin. Schwierig bleibt es trotzdem:
Wer zu oft Hilfe braucht oder zu wild Gas gibt, dem geht das Benzin aus.

## ▶️ Spielen

`index.html` im Browser öffnen, fertig: kein Server, kein Build, keine
Installation. Alles ist Vanilla HTML5 + CSS3 + JavaScript (Canvas, WebAudio).

Für das Handy im gleichen WLAN (Ton, Vorlesen und PWA funktionieren über einen
Server am zuverlässigsten):

```bash
python3 -m http.server 8000
# am Handy öffnen: http://<IP-des-Computers>:8000
```

Am schönsten spielt es sich im **Querformat**.

## 🎮 Steuerung

| Eingabe | Wirkung |
|---|---|
| Rechte Bildschirmhälfte / grünes Pedal / → ↑ D W | **Gas** |
| Linke Bildschirmhälfte / rotes Pedal / ← ↓ A S | **Bremse**, im Stand **rückwärts** |
| Gas in der Luft | Nase hoch (Rückwärts-Salto) |
| Bremse in der Luft | Nase runter (Vorwärts-Salto) |
| ⏸️ / Esc / P | Pause |
| K (Tastatur) | Kräfte-Pfeile an/aus |

Multitouch geht: Gas und Bremse lassen sich gleichzeitig halten.

## 🧩 Spielidee

- **8 Welten × 3 Level** mit wachsender Länge, dazu je Welt ein
  **Endlos-Modus ♾️** („Wie weit kommst du?“, alle 500 m ein Bonus):
  🌼 Blumenwiese · 🏜️ Sandwüste · ❄️ Schneeberge · 🌙 Mondlandschaft ·
  🍭 Bonbon-Land · 🌴 Dschungel · 🌋 Vulkaninsel · 🌈 Regenbogenland
- Jede Welt hat **eigene Physik**: Auf dem Mond gilt g = 1,62 m/s² (riesige
  Sprünge, keine Luft), auf Schnee ist der Reibwert klein, im Sand der
  Rollwiderstand groß, und im Bonbon-Land federt der Wackelpudding-Boden.
- **Benzin ⛽** wird verbraucht. Rote Kanister füllen den Tank wieder auf.
  Ist er leer, rollt das Auto aus, und die Fahrt endet.
- **Münzen 🪙**: 5er am Boden, 10er als Bogen über Kuppen (nur mit Schwung
  erreichbar), 25er-Sterne-Münzen und **💎 100er-Diamanten** hinter Schanzen
  und auf Gipfeln.
- **Tricks**: Salto (+50), Luftsprung (Flugzeit-Bonus).
- **Ziel 🏁** erreicht → Ziel-Bonus und **Sterne**: ⭐ Ziel, ⭐⭐ ab 60 %,
  ⭐⭐⭐ ab 90 % der Münzen. Das nächste Level wird freigeschaltet.
- Gesammelte Münzen darf man **immer behalten**, auch bei leerem Tank oder
  Abbruch.

## 👫 Wer fährt? Allein oder zu zweit

Nach dem Titel fragt das Spiel **„Wer fährt?“**: Fiete, Jonte oder
**Zu zweit**. Jedes Kind hat ein **eigenes Profil** mit eigenen Münzen,
eigener Garage (Fahrzeuge, Tuning, Farben), eigenem Outfit und eigenem
Level-Fortschritt. Gewechselt wird jederzeit über den Kopf links oben.

**Zu zweit: Geisterrennen auf einem Gerät**

1. **Lobby**: Jedes Kind wählt sein Auto. Über „🔧 Fietes Garage“ bzw.
   „🔧 Jontes Garage“ baut jedes Kind sein eigenes Auto zusammen. Dazu wählt
   ihr gemeinsam die Strecke: Level 1–3 („Wer ist schneller?“) oder
   ♾️ Endlos („Wer kommt weiter?“). Offen ist alles, was **eines** der beiden
   Kinder schon freigespielt hat. Geschaffte Level zählen auch für den
   Mitfahrer.
2. **Wer fängt an?** Selbst aussuchen oder **🎲 würfeln**: Beide würfeln, die
   höhere Zahl beginnt, bei Gleichstand wird nochmal gewürfelt.
3. **Übergabe**: „👉 Jonte ist dran!“ Jetzt das Tablet weitergeben.
4. **Fahrt 1** wird aufgezeichnet (20-mal pro Sekunde: Lage, Räder, Gesicht,
   Ballon-Hilfe).
5. **Fahrt 2** fährt gegen den **Geist** der ersten Fahrt: halbdurchsichtig,
   mit Namensschild, ohne Zusammenstöße. Ist er außerhalb des Bildes, zeigt
   ein Pfeil am Rand, wie weit er weg ist. „Überholt! 🚀“ meldet das Spiel
   laut.
6. **Siegerehrung**: Beide im Ziel → kürzere Zeit gewinnt (unter 0,05 s ist
   es unentschieden). Nur einer im Ziel → der gewinnt. Sonst zählt die
   weitere Strecke (unter 1 m unentschieden). Jedes Kind behält seine
   Münzen. Der Sieger bekommt **🪙 100 Bonus**, bei Gleichstand gibt es für
   beide 50. Ein Zähler merkt sich, wer wie oft gewonnen hat.
7. **🔄 Revanche**: Diesmal fängt das andere Kind an.

Fair ist das, weil beide auf **exakt derselben Strecke** fahren (gleicher
Seed) und jede Zeit ab dem eigenen Start gemessen wird.

## 🔧 Garage

| Fahrzeug | Preis | Charakter |
|---|---|---|
| 🚙 Flitzer | gratis | der flinke Buggy, kann von allem ein bisschen |
| 🚜 Trecker | 2.000 | riesige Hinterräder, viel Kraft, langsam |
| 🛵 Hüpf-Moped | 3.500 | federleicht, tolle Saltos, kippt schnell |
| 🚌 Bummel-Bus | 6.000 | lang und schwer, fällt fast nie um (mit Tierkindern an Bord) |
| 🛻 Monster-Max | 10.000 | gigantische Räder, Allrad, hoher Schwerpunkt |
| 🏎️ Blitz-Rakete | 15.000 | superschnell, Heckflügel mit echtem Abtrieb |
| 🚀 Mondmobil | 22.000 | sechs angetriebene Räder, superweiche Federn |

**Tuning** pro Fahrzeug, je 5 Stufen: 🔧 Motor (Drehmoment und
Höchstgeschwindigkeit), 🛞 Reifen (Reibwert µ), 🌀 Federung (Dämpfung und
Federweg), ⛽ Tank. Bei manchen Fahrzeugen gibt es zusätzlich **4×4 Allrad**.
**🦸 Outfit** (jedes Kind hat sein eigenes): fünf Superhelden-Looks, die man nur an den Farben
erkennt (ohne Namen, Buchstaben oder Logos): blau mit rotem Umhang, rot-blau
mit Netz, grau mit gezacktem schwarzem Umhang, rot-gold mit leuchtendem Kreis,
blau mit Stern, Streifen und Rundschild. Das Outfit gilt überall: in jedem
Fahrzeug, in der Garage, auf dem Titelbild, in der Fortschrittsleiste, im
Ergebnis und auf dem App-Icon. Fiete und Jonte werden an allen Stellen mit
denselben Zeichenfunktionen gemalt, damit man immer dieselbe Person sieht.
Auf der Tür des Flitzers steht der Anfangsbuchstabe des Fahrers.

**Optik**: 13 Lackfarben (darunter Gold und Regenbogen) und 6 Muster (Streifen,
Punkte, Sterne, Flammen, Blitze, Karo). Farben und Muster kauft man einmal und
kann sie dann für alle Fahrzeuge nutzen.

## ⚙️ Einstellungen

- **Schwierigkeit**: 🐢 Leicht (sanfter Stabilisator, größerer Tank),
  🐇 Normal, 🚀 Profi (weniger Benzin, Hoppla kostet mehr)
- 🔊 Töne · 🗣️ Vorlesen (für Kinder, die noch nicht lesen) · ⏱️ Tacho und
  Drehzahlmesser
- 🔬 **Kräfte**: zeigt beim Fahren Gewichtskraft (lila), Normalkräfte (grün) und
  Reibung/Antrieb (orange) als Pfeile
- 📲 App installieren · ♻️ Spielstand zurücksetzen (mit einer Rechenaufgabe
  für Erwachsene gesichert)

## 🔬 Die Physik (für Große)

Das Spiel nutzt **keine Physik-Bibliothek**. `physik.js` ist eine eigene kleine
2D-Starrkörper-Simulation, gemacht für Fahrzeuge auf einer Strecke:

**Aufbau.** Die Karosserie und jedes Rad sind eigene Starrkörper mit Masse und
Trägheitsmoment. Die Räder drehen sich also wirklich. Jedes Rad hängt an
einer Radaufhängung (wie der *Wheel Joint* in Box2D):

- **Linienführung** (hart): Das Rad darf sich nur entlang der Federachse
  bewegen.
- **Feder-Dämpfer** als *weiche Bindung* nach Catto: Eigenfrequenz f und
  Dämpfungsgrad ζ ergeben `k = m·ω²` und `c = 2·m·ζ·ω` mit `ω = 2πf`. Im Löser
  wirken daraus `γ = 1/(h·(c + h·k))` und `Bias = C·h·k·γ`. Das bleibt auch bei
  harten Landungen stabil.
- **Anschläge** oben und unten als Ungleichungs-Bindungen.
- **Motor/Bremse** als Bindung auf die *relative* Drehzahl Rad ↔ Karosserie mit
  begrenztem Moment. Das **Gegenmoment wirkt auf die Karosserie**, deshalb
  macht der Flitzer beim Anfahren am Hang einen Wheelie.

**Reifen.** Die Normalkraft ist ≥ 0 (Nichteindringen mit Baumgarte-Korrektur
und Stoßzahl). Für die Haftreibung gilt `|F_t| ≤ µ·F_N`. Das ist der
Spitzenwert der Kraftschlusskurve (Pacejkas *Magic Formula*). Darüber dreht das
Rad durch, und es staubt. Der Rollwiderstand wirkt als Gegenmoment
`c_rr·F_N·r`.

**Längsdynamik.** Am Hang wirkt die Hangabtriebskraft `m·g·sin α`, die
Normalkraft sinkt auf `m·g·cos α`. Die Lastverlagerung auf die Hinterachse
ergibt sich von selbst aus den Federkräften. Ein Heckantrieb kommt nur hoch,
solange `µ·F_N,hinten` reicht. Darum hilft auf Schnee das **Allrad-Upgrade**.
Dazu kommen Luftwiderstand `½·ρ·c_w·A·v²` und bei der Blitz-Rakete Abtrieb
`½·ρ·c_A·A·v²`, der bei Tempo mehr Grip bringt. Die Motorkennlinie liefert
konstantes Moment bis zur Eckdrehzahl, darüber konstante Leistung.

**Sprünge.** Über eine Kuppe mit Radius R hebt das Auto ab, sobald
`v²/R > g·cos α`. In der Luft bleibt der Gesamtdrehimpuls
`J_K·ω_K + Σ J_R·ω_R` erhalten: Werden die Räder beschleunigt (Gas), dreht sich
die Karosserie entgegen, und die Nase geht hoch. Bremsen dreht die Nase
runter. So steuern auch echte Motocross-Fahrer und Geländeroboter ihre
Nicklage im Sprung.

**Löser.** Semi-implizites Euler-Verfahren mit *Sequential Impulses*
(akkumulierte Impulse, Warmstart, 8 Iterationen) bei fest 240 Hz.

**Bewusste Spiel-Hilfen** (nicht 1:1 Physik, damit es für Kinder spielbar
bleibt):

- Die Luftsteuerung ist verstärkt. Die echte Rad-Rückwirkung allein wäre für
  ein Spiel zu schwach.
- Ballon-Hilfe statt Unfall.
- Im Modus „Leicht“ richtet ein sanfter Stabilisator das Auto auf.

**Plausibilitätstests** (`node werkzeuge/testfahrt.js --physik`):

- In Ruhe ist die Summe der Normalkräfte gleich m·g.
- Gebremst hält der Flitzer am 30°-Hang und rutscht bei 40°.
- Die Steigfähigkeit aus dem Stand ist durch das Drehmoment begrenzt.
- 1 s Gas in der Luft (ohne Schwerkraft) hebt die Nase allein durch
  Drehimpulserhaltung.

**Strecke.** `gelaende.js` erzeugt das Höhenprofil so:

1. Rauschen und Bau-Elemente (Schanzen, Buckel, Steilhänge, Täler) ergeben die
   Rohhöhe.
2. Ein **Slew-Rate-Begrenzer** stellt sicher, dass keine Steigung steiler als
   `maxAuf` ist.
3. Ein zweifacher **Tiefpass 1. Ordnung** (wie ein RC-Glied) rundet die Kanten
   ab.

Alles ist deterministisch über einen Seed. Jedes Level sieht also immer gleich
aus.

### Quellen und Hintergrund

- E. Catto: *Fast and Simple Physics using Sequential Impulses*, GDC 2006, und
  *Soft Constraints*, GDC 2011 (box2d.org/files)
- Box2D, `b2WheelJoint` (Linienführung, Federung, Motor)
- J. Y. Wong: *Theory of Ground Vehicles*, Wiley: Fahrwiderstände,
  Lastverlagerung, Steigfähigkeit
- Vorlesung *Vehicle Dynamics*, TSFS02, Linköping University, Lecture 4:
  Längsdynamik
- H. B. Pacejka: *Tyre and Vehicle Dynamics*: Magic Formula, Kraftschluss
- Nicklage im ballistischen Sprung durch Beschleunigen und Bremsen der Räder:
  Konferenzbeitrag 2016 (HAL hal-01380990) sowie der Preprint *DART* (arXiv
  2607.29011)

## 🤖 Balancing ohne Browser

`werkzeuge/testfahrt.js` lässt einen Roboter-Fahrer alle Level abfahren:

```bash
node werkzeuge/testfahrt.js                       # Flitzer ohne Upgrades, geübter Fahrer
node werkzeuge/testfahrt.js --kind                # "Kind": hält immer Vollgas
node werkzeuge/testfahrt.js --upgrade 3           # alle Upgrades auf Stufe 3
node werkzeuge/testfahrt.js --fahrzeug moped --welt 3
node werkzeuge/testfahrt.js --physik              # Physik-Plausibilitätstests
node werkzeuge/testfahrt.js --geist               # Geisterrennen: Aufnahme, Wiedergabe, Sieger
```

Die Ausgabe zeigt je Level: Ziel erreicht oder Tank leer, Strecke, Münzen,
Sterne, Überschläge und den niedrigsten Tankstand.

## 🧪 Im Browser prüfen

`werkzeuge/browsertest.js` startet einen eigenen kleinen Webserver und prüft
das Spiel in Chromium (Playwright: `npm i -D playwright && npx playwright
install chromium`):

```bash
node werkzeuge/browsertest.js                     # ablauf, layout, robust, offline
node werkzeuge/browsertest.js leistung            # Bildrate (nur Info)
node werkzeuge/browsertest.js layout --bilder fotos   # mit Bildschirmfotos
```

| Prüfung | Was wird geprüft? |
|---|---|
| `ablauf` | Spielerwahl, Solo, getrennte Konten und Garagen, Lobby, Würfeln, Geisterrennen mit Roboter-Fahrer, Siegerehrung, Revanche |
| `layout` | 17 Bildschirme in 6 Formaten (Handy quer/hoch, kleines Handy, Tablet quer/hoch, PC): Knöpfe mind. 44 px, erreichbar, ohne Überlappung, mit Namen; Fenster passen ohne Scrollen |
| `robust` | kaputter, alter und unsinniger Spielstand, gesperrter Speicher (Privatmodus), Drehen während der Fahrt, App im Hintergrund, Neustart/Abbruch im Duell, Unentschieden, Endlos-Duell |
| `offline` | Cache-Liste vollständig, Versionen passen, Service Worker aktiv, Spielen ohne Internet |
| `leistung` | Bildrate normal und bei 4× gedrosselter CPU |

Stand der Messung (Chromium ohne Grafikkarte, also ungünstigster Fall): ohne
Drosselung durchgehend 60 Bilder/s. Bei 4× gedrosselter CPU (wie ein altes
Tablet) ≈ 35 Bilder/s allein und ≈ 29 im Geisterrennen. Damit das so bleibt,
liegt der Himmelsverlauf als CSS hinter dem Spielfeld, Deko-Emojis werden
pixelgenau kopiert und der Geist wird in einer kleinen eigenen Ebene gemalt.

## 🗂️ Dateien: wo ändere ich was?

| Datei | Inhalt |
|---|---|
| `config.js` | **Alle Stellschrauben**: Physik-Löser, Fahrzeuge (Masse, Federn, Motor, Umriss), Upgrades und Preise, Farben, Muster, Welten (Schwerkraft, Grip, Gelände, Kanister-Abstand, Deko). Hier zuerst schauen! |
| `gelaende.js` | Strecken-Generator, Münzen, Kanister, Deko, Schilder |
| `physik.js` | 2D-Fahrzeugphysik (Federn, Reifen, Motor, Kontakte) |
| `fahrt.js` | Regeln einer Fahrt: Pedale, Tank, Saltos, Ballon-Hilfe, Ziel, Ergebnis |
| `geist.js` | Geisterrennen: Fahrt aufzeichnen, als Geist abspielen, Sieger bestimmen |
| `grafik.js` | Zeichnen: Himmel, Parallax-Berge, Strecke, Fahrzeuge mit Fiete und Jonte, Geist, Partikel, Wetter, Kräfte-Pfeile, Tacho |
| `klang.js` | Motorsound und Effekte per WebAudio, Vorlesen per Sprachsynthese |
| `spiel.js` | Spielerwahl, Profile je Kind, Menüs, Garage, Geisterrennen-Ablauf (Lobby, Würfeln, Übergabe, Siegerehrung), Speicherstand (localStorage), Eingabe, Kamera, Spielschleife |
| `index.html`, `style.css` | Bildschirme und Aussehen im JONFIE-STUDIOS-Stil |
| `manifest.webmanifest`, `sw.js`, `icon-*.png` | PWA. Die Icons erzeugt `node werkzeuge/icons.js` direkt aus der Spielgrafik. Bei Änderungen die Version in `sw.js` **und** die `?v=`-Nummern in `index.html` hochzählen! |
| `fonts/` | Baloo 2 und Nunito, lokal eingebunden (SIL Open Font License) |
| `werkzeuge/testfahrt.js` | Roboter-Testfahrer, Physik- und Geist-Tests (Node) |
| `werkzeuge/browsertest.js` | Prüfungen im echten Browser (Playwright) |

Der Code ist durchgehend **auf Deutsch kommentiert**.

### Eigene Welt bauen

In `config.js` einen Eintrag an `welten` anhängen. Dazu gehören Name, Emoji,
Physik (Schwerkraft, Grip, Rollwiderstand, Abprall), Farben, Deko
(`"🌳:2.8"` = Emoji und Größe in Metern), Gelände-Parameter und drei Level
mit Länge und Seed.

### Eigenes Fahrzeug bauen

In `config.js` einen Eintrag an `fahrzeuge` anhängen (Masse, Räder,
Federung, Motor, Umriss, Kopfposition). In `grafik.js` unter `KAROSSERIE`
eine Zeichenfunktion mit dem Namen aus `form` ergänzen.

## 🌐 Ausblick: übers WLAN oder Internet

Das Geisterrennen auf einem Gerät ist umgesetzt. Wie zwei Kinder auch im
gleichen WLAN oder übers Internet gegeneinander fahren könnten:
Möglichkeiten, Bewertung und Empfehlung stehen in
[`docs/MEHRSPIELER.md`](docs/MEHRSPIELER.md).
