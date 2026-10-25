# 🦸🚙 Fiete Flitzer

Ein kindgerechtes Berg-Rennspiel von **✨ JONFIE STUDIOS ✨** für Kinder ab
ca. 6 Jahren, gebaut nach dem Vorbild von *Hill Climb Racing*:
**rechts Gas, links Bremse**, Münzen und Benzin sammeln, das Auto in der
Garage verbessern. Läuft im Browser, ist als **PWA installierbar** und auch
offline spielbar.

**Fiete** ist ein rotblonder Junge mit braunen Augen und seitlich in die
Stirn gekämmtem Pony, auf Wunsch mit schwarzer Baseball-Cap. **Jonte** ist
größer und schlanker, hat hellbraune lange Haare (zum Dutt gebunden oder
offen), braune Augen und eine runde schwarze Brille. Beide tragen Kleidung in
Superhelden-Farben, zum Beispiel einen blauen Anzug mit gelbem Stern und einen
roten Umhang, der im Fahrtwind flattert. Sie spielen allein oder **zu zweit
im Geisterrennen** gegeneinander. Niemand kann sich **wehtun**. Bei einem
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
| Gas in der Luft | Nase hoch (Rückwärts-Salto), auf dem Pedal erscheint ⤴ |
| Bremse in der Luft | Nase runter (Vorwärts-Salto), auf dem Pedal erscheint ⤵ |
| 🚀-Knopf (links über der Bremse) / B / Umschalt | **Turbo**, wenn eine Rakete geladen ist |
| 🦘-Knopf (links über der Bremse) / Leertaste / J | **Sprungfeder**, wenn sie aufgeladen ist und die Räder am Boden sind |
| ⏸️ / Esc / P | Pause |
| K (Tastatur) | Kräfte-Pfeile an/aus |

Multitouch geht: Gas und Bremse lassen sich gleichzeitig halten.

Vor jeder Fahrt zählt eine **Start-Ampel 🚦** 3 – 2 – 1 – LOS (rot, rot,
rot-gelb, grün, je 0,8 s). Bis dahin stehen Physik, Zeit und Geist still,
Gas lässt nur den Motor aufheulen. **Tipps 💡** zur Bedienung stehen klein
oben links ohne Kasten und lassen sich in den Einstellungen ausschalten.

## 🧩 Spielidee

- **13 Welten × 4 Level** mit wachsender Länge, dazu je Welt ein
  **Endlos-Modus ♾️** („Wie weit kommst du?“, alle 500 m ein Bonus):
  🌼 Blumenwiese · 🏜️ Sandwüste · 🚧 Baustelle · ❄️ Schneeberge ·
  🌙 Mondlandschaft · 🍭 Bonbon-Land · 🌴 Dschungel · 🦕 Urzeit · 🌋 Vulkaninsel ·
  🎢 Achterbahn-Park · 🌈 Regenbogenland · 🎡 Freizeitpark · 💎 Kristallhöhle.
  Level 4 ist ein freiwilliges **🔥 Profi-Level**: Die nächste Welt öffnet
  sich schon nach Level 3, und dort führt der große Knopf in die neue Welt.
  Das Profi-Level gibt es als zweiten Knopf.
- **Gelände, das Gefühl verlangt.** Ab Level 2 kommen große Bau-Elemente
  dazu, in späteren Welten auch schon früher:
  - **Berge**, so steil, wie die Reifen in der Welt gerade noch halten:
    Mit Vollgas hebt das Auto vorne ab und überschlägt sich nach hinten.
  - **Steilrampen** (bis 50°, auf rutschigem Boden flacher) mit runder
    Einfahrt: Wer mit Schwung hinauffährt, fliegt oben mit erhobener Nase ab
    und muss in der Luft bremsen.
  - **Scharfe Kuppen** vor einem steilen Abhang: Bei Tempo hebt das Auto ab
    und landet zu flach auf dem Hang. Also vorher bremsen.
  - **Sprungschanzen** mit Abbruchkante und langem Landehang: In der Luft
    stellt man mit Gas (Nase hoch) und Bremse (Nase runter) den Winkel
    passend zum Hang ein.
  - **Stufen**, die das Vorderrad hochschlagen, **große Wellen**, auf denen
    das Auto bei Tempo hüpft, und **Klippen** (Plateau, dann geht es
    senkrecht hinunter: Nase mit Gas hochhalten).
  - **Loopings** im 🎡 Freizeitpark, einzeln oder zwei hintereinander: Nur mit
    Vollgas schafft man es über Kopf durch den Ring (Bonus +75 Münzen). Wer
    zu langsam ist, fällt oben ab oder rollt zurück.
  - **💎 Kristallhöhle** mit Felsdecke, Tropfsteinen, leuchtenden Kristallen
    und Laternen. Die Decke liegt 8,2 m über dem höchsten Boden in ±12 m
    (`welt.decke`, `gelaende.deckeBei`). Die Kamera hält sie oben im Bild.
    Wer doch hochfliegt, prallt sanft ab (alle Umrisspunkte und der Kopf
    werden geprüft), und der Ballon bleibt darunter.
  - **Grubensprünge** im Freizeitpark: Steiler Absprung, eine Grube und auf
    der anderen Seite ein Landehang. Wer zu kurz springt, landet in der Grube.
- **🚀 Turbo und 🦘 Sprungfeder**: zwei kleine Extras, bewusst selten, damit sie
  das Spiel nicht grundsätzlich ändern. Die runden Knöpfe sitzen links über der
  Bremse (linke Hand, die meist frei ist). Grau = noch nicht bereit, der Ring
  zeigt den Ladestand, bunt und pulsierend = bereit.
  - **Turbo**: ein bis zwei **lila Raketen-Kanister** pro Level (Level 1–2: einer,
    Level 3–4: zwei, Endlos: alle 500 m), höchstens 2 auf Vorrat. Drücken:
    Düsen fahren hinten heraus und spucken Feuer, 1,6 s lang 13 m/s² Schub
    entlang der Längsachse, bis zum 2,1-fachen der Höchstgeschwindigkeit.
  - **Sprungfeder**: lädt sich mit **3 Saltos** auf (ein Looping zählt wie ein
    Salto, am Knopf steht „1/3“). Nach jedem Sprung 15 s Abkühlzeit (⏳ am
    Knopf), in der Saltos nicht mitzählen – sonst könnte man fast dauernd
    springen. Mit den Rädern am Boden drücken: Federn
    schießen unter den Rädern heraus, Δv = 8,5 m/s senkrecht zum Auto-Boden
    (aus dem Stand ≈ 3,7 m hoch). Oben auf dem Berg gedrückt, fliegt man weit.
  - Einstellbar unter `regeln.extras` in `config.js`.
- **Saltos** zählen relativ zum Gelände: Absprung von der Schanze mit
  erhobener Nase, Landung auf dem Abhang, dann ist ein Rückwärts-Salto
  absolut nur ~290°, gegenüber dem Boden aber eine ganze Umdrehung. Ein Flug
  endet erst, wenn das Auto 0,1 s ruhig auf den Rädern steht. Abpraller und
  kurzes Aufsetzen mit Karosserie oder Kopf gehören noch zum Flug.
- **❓ Hilfe** (Einstellungen → „Hilfe & Was ist neu?“): erklärt Fahren, Tricks,
  Extras, Garage und Welten und zeigt den **Changelog** (`neuigkeiten` in
  `config.js`) mit der eigenen Version hervorgehoben. Ein Klick auf den
  Update-Hinweis nach einem App-Update öffnet sie auch.
- **Kulisse** (`requisiten.js`, `grafik.js`): Bäume, Tannen, Palmen, Kakteen,
  Felsen, Farne, Vulkankegel, Kristalle, Pilze, Dinosaurier (4 Arten × 3
  Farben) … werden gezeichnet, nicht als Emoji. Jede Art gibt es in mehreren
  Varianten, dazu zufällige Größe, Spiegelung und kleines Beiwerk (Gras,
  Steinchen). Dieselbe Deko kommt nie zweimal hintereinander. In `config.js`
  steht `"@art:Höhe"` für eine Requisite, `"🐄:1.6"` für ein Emoji.
  Der Hintergrund hat drei Ebenen (die hinterste im Dunst) mit Silhouetten je
  Welt (`welt.kulisse`: wald, tannen, tafelberg, stadt, kran, gipfel, vulkan,
  dschungel, brachio, riesenrad, bonbon, wolkenberg, stalagmiten).
  Jede Requisite steht auf dem tiefsten Bodenpunkt unter ihrer Breite (am
  Hang steckt der Rest im Boden, nichts schwebt). Die Ebenen ziehen
  verschieden schnell vorbei (Parallaxe 0,08 / 0,2 / 0,42).
  **Rechenzeit**: Jede Variante wird einmal in ein kleines Bild gemalt (in
  Größenstufen ×1,25) und stufenlos verkleinert gezeichnet – beim Zoomen mit
  dem Tempo springt so keine Größe, und es muss kaum neu gemalt werden.
  Wetter-Teilchen (Schnee, Blätter, Funken …) sind bewusst wenige (14–20). Jede Hintergrund-Ebene wird nur bis
  knapp unter die Ebene davor gemalt (weniger Fläche), das Glühen der
  Vulkaninsel liegt im CSS-Hintergrund. Im direkten Vergleich bei 4×
  gedrosselter CPU ist das Spiel damit eher etwas schneller als vorher.
- **Bruchlandung 💥** (Einstellung, voreingestellt **aus**): Ist sie aus,
  prallt das Auto bei einer schiefen Landung ab, verliert etwas Tempo und
  fährt weiter. Ist sie an, gilt eine Landung schiefer als 40° zum Hang
  (Profi: 38°) als Bruch: Der Ballon hilft, und das Spiel sagt, was geholfen
  hätte („Nase zu hoch, in der Luft bremsen!“ oder „Nase zu tief, in der Luft
  Gas geben!“). Im Modus **Leicht** gibt es nie eine Bruchlandung.
- **Hinweise zum Zuhören** für Kinder, die noch nicht lesen: beim ersten
  Sprung „Gas hebt die Nase, Bremse senkt sie“, nach einem Überschlag am
  Berg „Weniger Gas am Berg!“, auf dem Mond „nur sanft Gas geben“.

  Wer einfach Vollgas hält oder in der Luft nur loslässt, kommt in den
  meisten Leveln nicht ins Ziel (siehe Messung unten).
- **Ballon-Hilfe** erst, wenn das Auto wirklich festliegt (auf dem Dach, mit dem
  Kopf am Boden, hochkant oder auf der Seite): nach 2 s ohne Pedal, nach 4 s,
  wenn man noch Gas oder Bremse gibt. Der Ballon
  setzt das Auto auf eine flache Stelle in der Nähe, nie mitten in einen
  Steilhang. Gibt es vorn keine, kommt es zurück an den Fuß des Hangs, damit
  man Anlauf nehmen kann. Der Ballon ist also keine Abkürzung.
- **Festgefahren?** Das Spiel misst den Fortschritt: Kommt das Auto trotz
  Pedal nicht über seinen weitesten Punkt hinaus (zum Beispiel weil es immer
  wieder den Hang hinunterrutscht), gibt es nach 3,5 s den Tipp „Nimm
  Anlauf!“ und nach 8 s (Leicht: 6 s) trägt der Ballon das Auto über das
  Hindernis. Hilfe kostet Benzin (Normal 20 %, Leicht 5 %, Profi 26 %), aber
  kein Kind bleibt für immer stecken.
- Jede Welt hat **eigene Physik**: Auf dem Mond gilt g = 1,62 m/s² (riesige
  Sprünge, keine Luft), auf Schnee ist der Reibwert klein, im Sand der
  Rollwiderstand groß, und im Bonbon-Land federt der Wackelpudding-Boden.
- **Benzin ⛽** wird verbraucht. Rote Kanister füllen den Tank wieder auf.
  Ist er leer, rollt das Auto aus, und die Fahrt endet. Die Kanister liegen
  nach **Aufwand** verteilt: Bergauf kostet jeder Meter mehr Benzin, darum
  liegen sie dort dichter. Und sie liegen nie dort, wo man drüberfliegt
  (auf Kuppen oder hinter Schanzen), sondern in Mulden und auf flachen
  Stücken.
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
| 🚜 Trecker | 2.000 | Bärenkraft (0→50 km/h in 3,0 s statt 4,3 s), etwas schneller als der Flitzer, aber mit Vollgas am Berg hebt er vorne ab und überschlägt sich, wie ein echter Traktor |
| 🛵 Hüpf-Moped | 3.500 | federleicht, tolle Saltos, kippt schnell |
| ⚡ E-Auto | 5.000 | leise und spritzig (0→50 km/h in 2,3 s): volles Drehmoment aus dem Stand, schwerer Akku ganz unten. **Bremsen und Rollen laden den Akku** (Rekuperation, beim Profi-Fahrer etwa 6–16 % Akku je Level), im Stand kein Verbrauch; sammelt grüne Batterien statt Kanister |
| 🚌 Bummel-Bus | 7.000 | lang und schwer, kaum umzuwerfen, dreht sich in der Luft nur langsam (mit Tierkindern an Bord) |
| 🛻 Monster-Max | 10.000 | gigantische Räder, Allrad, hoher Schwerpunkt |
| 🏎️ Blitz-Rakete | 15.000 | superschnell, Heckflügel mit echtem Abtrieb |
| 🚀 Mondmobil | 22.000 | sechs angetriebene Räder, superweiche Federn, fährt mit Akku wie die echten Mondautos |

**Tuning** pro Fahrzeug, je 5 Stufen: 🔧 Motor (Drehmoment und
Höchstgeschwindigkeit), 🛞 Reifen (Reibwert µ), 🌀 Federung (Dämpfung und
Federweg), ⛽ Tank (beim E-Auto 🔋 Akku). Bei manchen Fahrzeugen gibt es
zusätzlich **4×4 Allrad**. In der Garage spielt **🔊 Motor anhören** den
Klang jedes Fahrzeugs ab.
**💇 Look** (gratis, jedes Kind hat seinen eigenen): Fiete ohne oder mit
schwarzer Baseball-Cap, Jonte mit Dutt oder mit offenen Haaren. Der Look gilt
überall, auch beim Geist im Duell.
**🦸 Outfit** (jedes Kind hat sein eigenes): fünf Superhelden-Looks, die man nur an den Farben
erkennt (ohne Namen, Buchstaben oder Logos): blau mit rotem Umhang, rot-blau
mit Netz, grau mit gezacktem schwarzem Umhang, rot-gold mit leuchtendem Kreis,
blau mit Stern, Streifen und Rundschild. Das Outfit gilt überall: in jedem
Fahrzeug, in der Garage, auf dem Titelbild, in der Fortschrittsleiste, im
Ergebnis und auf dem App-Icon. Fiete und Jonte werden an allen Stellen mit
denselben Zeichenfunktionen gemalt, damit man immer dieselbe Person sieht.
Auf der Tür des Flitzers steht der Anfangsbuchstabe des Fahrers.

**Optik**: 14 Lackfarben (darunter Gold und Regenbogen) und 6 Muster (Streifen,
Punkte, Sterne, Flammen, Blitze, Karo). Farben und Muster kauft man einmal und
kann sie dann für alle Fahrzeuge nutzen.

## ⚙️ Einstellungen

- **Schwierigkeit**: 🐢 Leicht (sanfter Stabilisator, größerer Tank),
  🐇 Normal, 🚀 Profi (weniger Benzin, Hoppla kostet mehr)
- 🔊 Töne · 🗣️ Vorlesen (für Kinder, die noch nicht lesen) · ⏱️ Tacho und
  Drehzahlmesser (zeigt die Motordrehzahl und den Gang, wie man sie hört)
- 🔬 **Kräfte**: zeigt beim Fahren Gewichtskraft (lila), Normalkräfte (grün) und
  Reibung/Antrieb (orange) als Pfeile
- 💥 Bruchlandung an/aus (siehe oben)
- 📲 App installieren. Gibt es eine neue Version, holt die App sie beim Start
  oder beim Zurückkehren selbst, lädt neu (nie mitten in einer Fahrt) und
  zeigt oben kurz „Fiete Flitzer wurde aktualisiert: Version … → …“.
- ♻️ Spielstand zurücksetzen (mit einer Rechenaufgabe
  für Erwachsene gesichert)
- 🛠️ **Versteckter Entwickler-Bereich** zum Testen: In den Einstellungen
  unten **7× schnell auf „Fiete Flitzer · Version …“ tippen** und die
  Rechenaufgabe für Erwachsene lösen. Es zählt nichts sichtbar mit, damit
  Kinder ihn nicht zufällig finden. Dann gibt es „🪙 +10.000“ für beide
  Kinder und den Schalter „🔓 Alle Level“, der jede Welt öffnet, ohne den
  Fortschritt zu verändern. Solange er an ist, steht über den Welten ein
  Hinweis mit „Ausschalten“. „🙈 Verstecken“ blendet den Bereich wieder aus.

## 🔊 Motorklang

Alle Töne entstehen live per WebAudio, es gibt keine Sound-Dateien. Jedes
Fahrzeug hat in `config.js` ein eigenes Klang-Profil.

**Verbrenner** nach dem Puls-Resonator-Prinzip:

- **Ein Arbeitsspiel** (beim Viertakter zwei Kurbelwellen-Umdrehungen) wird
  als Wellenform gebaut: je Zylinder ein Auspuff-Druckstoß, leicht ungleich
  wie bei echten Motoren. Per Fourier-Reihe wird daraus eine `PeriodicWave`.
  Die Zündfrequenz ist `n/120 · Zylinder` (4-Takt) bzw. `n/60 · Zylinder`
  (2-Takt), mit n in U/min.
- **Auspuffrohr** als Kammfilter mit Rückkopplung (Laufzeit ≈ 2·Rohrlänge/c),
  dazu eine Körperresonanz. Diese Resonanzen wandern nicht mit der Drehzahl,
  deshalb klingt es nach Motor statt nach Synthesizer. Unter Last kommen
  Sättigung und ein Tiefpass dazu, der mit der Drehzahl öffnet.
- **Verbrennungsrauschen** im Takt der Druckstöße. Beim Diesel ist es kräftig
  („Nageln“).
- Kleine **Unruhe** von Arbeitsspiel zu Arbeitsspiel, im Leerlauf mehr. Neu
  ausgewürfelt wird je Arbeitsspiel, nicht je Bild, damit es auf 60-Hz- und
  120-Hz-Bildschirmen gleich klingt.
- **Virtuelles Getriebe** (`FF.Getriebe` in `fahrt.js`): Der Gang richtet
  sich nach dem Fahrtempo, die Drehzahl nach der Raddrehzahl. Man hört das
  Schalten, und der Drehzahlmesser zeigt genau diese Drehzahl und den Gang.
  In der Luft dreht der Motor in den Begrenzer („brrrap“), beim Gaswegnehmen
  wird er leiser, rückwärts zieht er wie vorwärts. Beim Start hört man den
  Anlasser.
- **🔊 Motor anhören** in der Garage: Der Motor läuft im Leerlauf, ohne Gang,
  und man gibt zweimal kurz Gas.

| Fahrzeug | Motor |
|---|---|
| Flitzer | 4-Zylinder-Boxer, blubbernd |
| Trecker | 3-Zylinder-Diesel, langes Auspuffrohr |
| Hüpf-Moped | Einzylinder-Zweitakter |
| Bummel-Bus | 6-Zylinder-Diesel, 5 Gänge |
| Monster-Max | V8 mit Kreuzebenen-Bollern und Fehlzündungs-Puff |
| Blitz-Rakete | hochdrehender 10-Zylinder, 6 Gänge |
| E-Auto, Mondmobil | Elektromotor |

**Elektro** (leise, wie echte E-Autos):

- Motor-Surren, dessen Ton mit der Drehzahl steigt und mit der Trägheit des
  Rotors gleitet, statt zu springen.
- Getriebe-Heulen.
- Leises Umrichter-Pfeifen, das beim Anfahren in Stufen springt.
- Unter 20 km/h ein weicher **Fußgänger-Warnklang (AVAS)**, wie ihn die
  EU-Verordnung 540/2014 für E-Autos vorschreibt.
- Beim Mondmobil klingt es etwas „weltraumiger“.

**Fahrgeräusche** für alle: Abrollen und Reifenrauschen (nur mit
Bodenkontakt) und Fahrtwind (∝ v²). Auf dem Mond gibt es keine Luft, also auch
keinen Wind.

Gemessen an einer echten Fahrt (Baustelle 2, Profi-Fahrer, 40 s, offline
gerendert, A-bewertet): E-Auto −42,5 und Mondmobil −43,9 dB(A) sind zusammen
mit dem Trecker (−42,6) die leisesten Fahrzeuge, der Flitzer liegt bei −38,6,
Monster-Max mit −34,8 am lautesten. Mit einem einfachen Tablet-Lautsprecher-
Modell (Hochpass 250 Hz) bleibt die Reihenfolge erhalten: E-Auto −42,5,
Flitzer −40,1 dB(A).

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

1. Rauschen und Bau-Elemente ergeben die Rohhöhe: Schanzen, Buckel,
   Steilhänge, Täler, Berge, Sprünge, Wellen, Klippen, Steilrampen, Kuppen und
   Stufen. Ab Level 2 kommen die großen Elemente häufiger und werden größer
   (`wild` je Level, `wildBasis` je Welt).
2. Ein **Slew-Rate-Begrenzer** stellt sicher, dass keine Steigung steiler als
   `maxAuf` ist. `maxAuf` hängt vom Level ab und ist nie steiler, als die
   Reifen in der Welt halten (µ·0,85, plus 3° für Schwung). Nur Rampen,
   Stufen und Abbruchkanten dürfen kurz steiler sein (bis 68°).
3. Ein zweifacher **Tiefpass 1. Ordnung** (wie ein RC-Glied) rundet die Kanten
   ab.

Alles ist deterministisch über einen Seed. Jedes Level sieht also immer gleich
aus.

### Quellen und Hintergrund

Motorklang:

- S. Baldan, H. Lachambre, S. Delle Monache, P. Boussard: *Physically
  informed car engine sound synthesis for virtual and augmented
  environments*, IEEE SIVE 2015
  ([air.iuav.it](https://air.iuav.it/handle/11578/264484))
- Sound Design Toolkit, Motor-Modell mit Wellenleitern für Ansaugung,
  Krümmer, Rohr und Schalldämpfer
  ([sdt.lim.di.unimi.it](https://sdt.lim.di.unimi.it/docs/API/v2.2-078/group__motor.html))
- Doerfler & Wyse: Pulse-Train-Resonator-Modell für Motorgeräusche, 2026
  ([arXiv 2603.09391](https://arxiv.org/abs/2603.09391))
- Zündfrequenz und Abgasanlagen-Moden:
  [Borla Engineering](https://www.borla.com/blog/post/engine-sound-exhaust-drone-physics)
- AVAS: Verordnung (EU) Nr. 540/2014, Anhang VIII (Warnklang bis ca.
  20 km/h), geändert durch (EU) 2017/1576
- E-Antriebe: Umrichter-Taktfrequenz und Motor-Ordnungen, z. B. SAE 2020-01-1269
  (8. Ordnung eines PMSM, [saemobilus.sae.org](https://saemobilus.sae.org/content/2020-01-1269))

Physik:

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

`werkzeuge/testfahrt.js` lässt Roboter-Fahrer alle Level abfahren. Es gibt
vier Fahrer:

- **Profi** sagt in der Luft den Landepunkt voraus und stellt die Nase mit
  Gas/Bremse passend zum Hang. Er dosiert am Berg das Gas, bremst vor steilen
  Abhängen und nimmt Anlauf, wenn er festhängt.
- **Kind** hält am Boden immer Vollgas und korrigiert in der Luft nur grob.
- **Loslassen** hält am Boden Vollgas und lässt in der Luft alles los, bremst
  also nie. Das ist die naheliegendste Strategie ohne Bremse.
- **Vollgas** lässt das Gas nie los.

```bash
node werkzeuge/testfahrt.js                       # Flitzer ohne Upgrades, Fahrer Profi
node werkzeuge/testfahrt.js --vergleich --upgrade auto   # alle vier Fahrer je Level
node werkzeuge/testfahrt.js --kind                # Fahrer "Kind"
node werkzeuge/testfahrt.js --loslassen           # Fahrer "Loslassen"
node werkzeuge/testfahrt.js --vollgas             # Fahrer "Vollgas"
node werkzeuge/testfahrt.js --upgrade 3           # alle Upgrades auf Stufe 3
node werkzeuge/testfahrt.js --upgrade auto        # so viele Upgrades, wie man bis zur Welt etwa hat
node werkzeuge/testfahrt.js --schwierigkeit leicht
node werkzeuge/testfahrt.js --fahrzeug moped --welt 3
node werkzeuge/testfahrt.js --physik              # Physik-Plausibilitätstests
node werkzeuge/testfahrt.js --geist               # Geisterrennen: Aufnahme, Wiedergabe, Sieger
```

Die Ausgabe zeigt je Level: Ziel erreicht oder Tank leer, Strecke, Münzen,
Sterne, Ballon-Hilfen und den niedrigsten Tankstand. Im Vergleich steht beim
Profi außerdem, wie oft er abgehoben ist und wie viel Zeit er am Boden Gas
weggenommen oder gebremst hat.

**Messung** (Schwierigkeit Normal, Upgrades „auto“, 40 Level je Fahrzeug,
`--vergleich` mit `--welt 0` … `--welt 9`). „im Ziel“ zählt Level, Ballon-Hilfen
sind je Level gemittelt.

| Fahrzeug | Profi im Ziel | Kind | Loslassen | Loslassen in Level 2–4 | Vollgas | Ballon-Hilfen Profi | Ballon-Hilfen Loslassen |
|---|---|---|---|---|---|---|---|
| Flitzer | 39 | 4 | 27 | 18 von 30 | 6 | 0,07 | 2,62 |
| Trecker | 39 | 4 | 18 | 12 von 30 | 4 | 0,57 | 4,53 |
| Hüpf-Moped | 39 | 2 | 22 | 15 von 30 | 2 | 0,15 | 2,98 |
| E-Auto | 39 | 8 | 26 | 17 von 30 | 3 | 0,15 | 2,77 |
| Bummel-Bus | 39 | 12 | 26 | 17 von 30 | 11 | 0,25 | 1,75 |
| Monster-Max | 40 | 7 | 26 | 17 von 30 | 6 | 0,12 | 2,75 |
| Blitz-Rakete | 39 | 9 | 26 | 17 von 30 | 3 | 0,30 | 1,98 |
| Mondmobil | 40 | 3 | 27 | 18 von 30 | 3 | 0,00 | 2,15 |

- **Gas und Bremse braucht man wirklich.** Wer in der Luft nur loslässt,
  kommt in den Leveln 2–4 mit jedem Fahrzeug in höchstens 60 % ins Ziel
  (vor Bruchlandung, Steilrampen, Kuppen und Stufen waren es mit dem
  Flitzer 38 von 40 Leveln). Er landet zu oft zu schief: Mit dem Flitzer sind 14,9 % seiner
  693 Sprünge um mehr als 40° schief, beim Profi 0,4 % von 857.
- **Der Profi bremst selten, aber im richtigen Moment.** Am Boden gibt er
  94 % der Zeit Vollgas und bremst 6 %, in der Luft drückt er 16 % der Zeit
  Gas und 5 % Bremse. Diese kurzen Stöße vor Kuppen, Abhängen und bei der
  Landung machen den Unterschied zum Loslassen.
- **Reines Vollgas** kommt nur in 2 bis 11 von 40 Leveln ins Ziel.
- Die Lücken beim Profi sind ein Profi-Level oder ein Level auf dem Mond:
  Dort geht ihm das Benzin knapp aus (z. B. Flitzer in Mondlandschaft 4,
  Bus in Mondlandschaft 2, Trecker in Vulkaninsel 4).
- Der Fahrer „Kind“ ist absichtlich schlecht (am Boden immer Vollgas). Für
  Kinder gibt es den Modus **Leicht** (keine Bruchlandung, Hilfe kostet nur
  5 % Benzin, größerer Tank, sanfter Stabilisator): Dort kommt der Fahrer
  „Kind“ mit Flitzer und Trecker in allen 40 Leveln ins Ziel, mit den anderen
  Fahrzeugen in 36–39.

## 🧪 Im Browser prüfen

`werkzeuge/browsertest.js` startet einen eigenen kleinen Webserver und prüft
das Spiel in Chromium (Playwright: `npm i -D playwright && npx playwright
install chromium`):

```bash
node werkzeuge/browsertest.js                     # ablauf, layout, robust, offline, inhalte
node werkzeuge/browsertest.js leistung            # Bildrate (nur Info)
node werkzeuge/browsertest.js layout --bilder fotos   # mit Bildschirmfotos
```

| Prüfung | Was wird geprüft? |
|---|---|
| `ablauf` | Spielerwahl, Solo, getrennte Konten und Garagen, Lobby, Würfeln, Geisterrennen mit Roboter-Fahrer, Siegerehrung, Revanche |
| `layout` | 17 Bildschirme in 7 Formaten (Handy quer/hoch, kleines Handy quer, sehr schmales Handy mit 320 px, Tablet quer/hoch, PC): Knöpfe mind. 44 px, erreichbar, ohne Überlappung, mit Namen; Fenster passen ohne Scrollen |
| `robust` | kaputter, alter (v1, v2 mit alter Welten-Reihenfolge: offene Welten bleiben offen) und unsinniger Spielstand, gesperrter Speicher (Privatmodus), Drehen während der Fahrt, App im Hintergrund, Neustart/Abbruch im Duell, Unentschieden, Endlos-Duell |
| `offline` | Cache-Liste vollständig, Versionen passen, Service Worker aktiv, Spielen ohne Internet |
| `inhalte` | Entwickler-Bereich (ohne sichtbaren Zähler, mit Rechenaufgabe), alle 44 Level starten, nach Level 3 „Neue Welt“ plus Profi-Knopf, Pedal-Pfeile und Tipps in der Luft und bei Bruchlandung, Looks der Kinder, E-Auto mit Akku-Anzeige und Rekuperation (Bremsen und Rollen), Motorklang aller Fahrzeuge (offline gerendert: kein NaN, nicht übersteuert, hörbar) |
| `leistung` | Bildrate normal und bei 4× gedrosselter CPU |

Stand der Messung (Chromium ohne Grafikkarte, also ungünstigster Fall): ohne
Drosselung durchgehend 60 Bilder/s. Bei 4× gedrosselter CPU (wie ein altes
Tablet) je nach Welt 27–33 Bilder/s allein und 24 im Geisterrennen. Die Werte
schwanken stark mit dem Rechner und seiner Auslastung, ein anderer Rechner
maß 18–26 Bilder/s. Damit es flüssig bleibt, liegt der Himmelsverlauf als CSS
hinter dem Spielfeld, Deko-Emojis werden pixelgenau kopiert und der Geist
wird in einer kleinen eigenen Ebene gemalt.

## 🗂️ Dateien: wo ändere ich was?

| Datei | Inhalt |
|---|---|
| `config.js` | **Alle Stellschrauben**: Physik-Löser, Fahrzeuge (Masse, Federn, Motor, Umriss), Upgrades und Preise, Farben, Muster, Welten (Schwerkraft, Grip, Gelände, Kanister-Abstand, Deko). Hier zuerst schauen! |
| `gelaende.js` | Strecken-Generator, Münzen, Kanister, Deko, Schilder |
| `physik.js` | 2D-Fahrzeugphysik (Federn, Reifen, Motor, Kontakte) |
| `fahrt.js` | Regeln einer Fahrt: Pedale, Tank und Akku, Saltos, Bruchlandung, Ballon-Hilfe, Festgefahren-Hilfe, virtuelles Getriebe, Ziel, Ergebnis |
| `geist.js` | Geisterrennen: Fahrt aufzeichnen, als Geist abspielen, Sieger bestimmen |
| `kinder.js` | So sehen Fiete und Jonte aus: Gesicht, Haare, Brille und die Looks (Cap, Dutt), nach einem Foto der beiden. Steckbrief und Bilder: [`docs/KINDER.md`](docs/KINDER.md), Vorschau: `werkzeuge/kinder-vorschau.html` |
| `grafik.js` | Zeichnen: Himmel, Parallax-Berge, Strecke, Fahrzeuge mit Fiete und Jonte (Körper und Outfit; den Kopf malt `kinder.js`), Geist, Partikel, Wetter, Kräfte-Pfeile, Tacho |
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
(`"🌳:2.8"` = Emoji und Größe in Metern), Gelände-Parameter (Gewichte der
Bau-Elemente, `wildBasis`, Kanister-Abstand) und vier Level mit Länge und
Seed (das vierte ist das Profi-Level). Alte Spielstände merken sich die
Welten per Name, eine neue Welt dazwischen sperrt also nichts.

### Eigenes Fahrzeug bauen

In `config.js` einen Eintrag an `fahrzeuge` anhängen (Masse, Räder,
Federung, Motor, Umriss, Kopfposition, Tank). Optional: `klang` (sonst klingt
es wie der Flitzer), `akku` und `rekuperation` für einen Elektroantrieb,
`leerlauf`, `eck`. Die Felder stehen oben im Abschnitt „Fahrzeuge“ erklärt. In
`grafik.js` unter `KAROSSERIE` eine Zeichenfunktion mit dem Namen aus `form`
ergänzen.

## 🌐 Ausblick: übers WLAN oder Internet

Das Geisterrennen auf einem Gerät ist umgesetzt. Wie zwei Kinder auch im
gleichen WLAN oder übers Internet gegeneinander fahren könnten:
Möglichkeiten, Bewertung und Empfehlung stehen in
[`docs/MEHRSPIELER.md`](docs/MEHRSPIELER.md).
