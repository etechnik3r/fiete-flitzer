# 👦 Fiete und Jonte: so sehen sie aus

Die beiden Kinder im Spiel sind nach einem Foto der echten Fiete und Jonte
nachgebaut, damit man sie sofort erkennt: im Auto, in der Garage, in der
Spielerwahl und in der Fortschrittsleiste.

![Fiete und Jonte in allen Größen](kinder-vorschau.png)

> **Stand:** Eingebaut (Spielversion 6). Jedes Kind hat zwei **Looks**, die
> man in der Garage unter „💇 Look“ wählt: **Fiete** ohne oder mit schwarzer
> Baseball-Cap, **Jonte** mit Dutt oder mit offenen Haaren. Der Look ist
> gratis, wird je Kind gespeichert und gilt überall, auch beim Geist im
> Duell.

---

## 1. Steckbrief

| | **Fiete** | **Jonte** |
|---|---|---|
| Figur | kleiner | größer, schlanker (wie bisher: `groesse`, `breite` in `CONFIG.kinder`) |
| Haarfarbe | **rotblond**: Kupfergold, Ansatz dunkler, Spitzen heller | **hellbraun**, leicht aschig |
| Frisur | voller, weicher Schopf; **Pony seitlich in die Stirn** gekämmt, läuft vorne in Spitzen aus; Ohren halb unter den Haaren | lange Haare, **zum Dutt gebunden** (hinten oben, mit Haargummi); **Stirn frei**, feine abstehende Härchen an Schläfe, Ohr und Nacken |
| Brille | – | **runde schwarze Brille** mit kräftigem Rahmen, Bügel zum Ohr, Lichtreflex auf den Gläsern |
| Augen | braun | braun (hinter der Brille) |
| Gesicht | rund, volle Wangen, rosige Bäckchen | schmaler und länger, Kinn schmaler |
| Mund | verschmitztes Lächeln, Lippen zusammen | schiefes Lächeln, rechts höher, einen Spalt offen |
| Ohren | halb verdeckt | frei, stehen etwas ab |

**Woran man sie im Spiel erkennt.** Im Auto ist der Kopf nur etwa 8–12 px
groß. Dort zählen Umriss und Farbe:
Fiete ist der **goldene, runde Schopf**, Jonte der **braune Kopf mit Dutt
obendrauf und zwei schwarzen Brillenringen**.

**Looks (Varianten):**

| | erster Look (voreingestellt, wie auf dem Foto) | zweiter Look |
|---|---|---|
| **Fiete** | „Ohne Cap“ | „Mit Cap“: schwarze Baseball-Cap mit Nähten, Knopf und Schirm nach vorn. Pony und Nacken schauen darunter hervor, im Fahrtwind wehen sie weniger. |
| **Jonte** | „Mit Dutt“ | „Haare offen“: bis auf die Schultern, hinters Ohr gestrichen, ohne Pony. Die Brille bleibt. Im Fahrtwind wehen die Haare nach hinten. |

Das Foto selbst liegt bewusst **nicht** im Repo. Alles Nötige steht in
diesem Steckbrief und in den Farbwerten in `kinder.js`.

---

## 2. Dateien

| Datei | Inhalt |
|---|---|
| `kinder.js` | Steckbriefe als Daten (`AUSSEHEN`: Farben, Frisur, Brille, Gesichtsform), die Looks (`VARIANTEN`) und alle Zeichenfunktionen für den Kopf. Eigenständig: braucht nur einen Canvas-2D-Kontext. |
| `werkzeuge/kinder-vorschau.html` | Im Browser öffnen: beide Kinder in allen Looks groß, mit allen Gesichtsausdrücken, in Spielgröße und als Kopfbild. Mit „Fahrtwind“-Schalter. |
| `docs/kinder-vorschau.png` | Bildschirmfoto dieser Vorschau (Bild oben) |

### Schnittstelle (`FF.Kinder`)

```js
// Kopf mit Mittelpunkt (x, y) und Radius r. Gleiche Parameter wie das
// bisherige zeichneKind() in grafik.js, also direkt austauschbar.
FF.Kinder.zeichneKopf(ctx, x, y, r, ausdruck, raumhelm, kind, wind, zeit);
//   ausdruck: "normal" | "freude" | "staunen"
//   kind:     Eintrag aus CONFIG.kinder (gebraucht wird kind.id) und
//             kind.variante = id des Looks (fehlt sie: der erste Look)
//   wind:     0..1 Fahrtwind, zeit: Sekunden (für wehende Haare)

// Nur-Kopf-Bild in einem Rechteck b × h (Pixel, y nach unten). Fester
// Rahmen: Beide Kinder erscheinen gleich groß, der Dutt passt hinein.
FF.Kinder.zeichneKopfbild(ctx, b, h, kind, ausdruck, zeit);

FF.Kinder.aussehenVon(kind);   // Steckbrief-Daten samt Look, z. B. .haut für Hals und Hände
FF.Kinder.AUSSEHEN;            // { fiete: {...}, jonte: {...} }
FF.Kinder.VARIANTEN;           // { fiete: [{ id: "pony", name: "Ohne Cap", … }, { id: "cap", … }], jonte: […] }
```

Koordinaten wie überall im Spiel: Meter, y nach oben, das Kind schaut nach
+x (Dreiviertel-Ansicht). Ein neues Kind bekommt am besten einen eigenen
Eintrag in `AUSSEHEN`. Fehlt er, zeichnet `kinder.js` das Kind aus den alten
`CONFIG.kinder`-Feldern (`haar`, `haarDunkel`, `augen`, `frisur` …), falls
vorhanden, sonst wie Fiete.

---

## 3. So ist es eingebaut

- `index.html`, `sw.js` und `werkzeuge/icons.js` laden `kinder.js` vor
  `grafik.js` (in `sw.js` steht es in der Cache-Liste, damit es offline geht).
- `grafik.js`: `zeichneKind()` ruft nur noch `FF.Kinder.zeichneKopf()` auf,
  die Hautfarbe für Hals und Hände kommt aus `FF.Kinder.aussehenVon(kind)`,
  und Nur-Kopf-Bilder (Fortschrittsleiste, Spielerwahl, Lobby, Würfeln) malt
  `FF.Kinder.zeichneKopfbild()`.
- `CONFIG.kinder` enthält nur noch `id`, `name`, `groesse` und `breite`. Für
  das Aussehen gibt es also genau eine Quelle.
- `spiel.js` speichert den Look je Kind (`look` im Profil) und gibt ihn als
  `kind.variante` an alle Zeichenfunktionen weiter. Die Garage zeigt unter
  „💇 Look“ beide Varianten als Kopfbild. Die zwischengespeicherten Bilder
  haben den Look im Schlüssel, ein Wechsel ist also sofort überall zu sehen.
- Die App-Icons sind mit `node werkzeuge/icons.js` neu erzeugt.
- Geprüft mit `node werkzeuge/browsertest.js` (alle Prüfungen, darunter
  „Looks: Fiete ohne/mit Cap, Jonte mit Dutt/Haare offen – wählbar und je
  Kind gespeichert“) und an Bildschirmfotos von Garage, Fahrt, Spielerwahl
  und Fortschrittsleiste.

Einen weiteren Look baut man in `kinder.js` unter `VARIANTEN` ein: Felder
einer Variante ergänzen oder überschreiben den Steckbrief (zum Beispiel
`frisur` oder `kappe` mit Stoff-, Schatten-, Glanz- und Schirmfarbe).

## 4. Technik

- **Kopf-Einheiten:** `zeichneKopf` skaliert auf den Kopfradius. Alle Maße,
  Linienbreiten und Verläufe sind in Vielfachen von r angegeben und wachsen
  mit dem Kopf mit.
- **Weiche Formen:** Haare und Gesicht sind Punktlisten, durch die eine
  glatte Kurve gelegt wird (Catmull-Rom als Bézier). Punkte mit
  `spitz = true` werden zu Ecken, etwa für Haarspitzen. Formen lassen sich
  so leicht anpassen, ohne Kontrollpunkte von Hand zu rechnen.
- **Plastisch:** Gesicht, Haare und Iris haben einen leichten Verlauf,
  vorne heller und zum Hinterkopf dunkler.
- **Kleine Köpfe bleiben klar:** `kinder.js` misst über `getTransform()`,
  wie groß der Kopf in Gerätepixeln ist. Konturen werden nie dünner als
  etwa 1 px, der Brillenrahmen nie dünner als etwa 1,8 px. Strähnen,
  Härchen und Glanzlichter werden zwischen 18 und 30 px Kopfradius weich
  ein- und ausgeblendet. So blitzt nichts auf, wenn die Kamera beim Fahren
  zoomt.
- **Leistung** (Chromium, Brustbild mit Anzug in Auto-Größe): etwa 0,4 ms
  statt 0,25 ms pro Kind und Bild. Das sind rund 1 % von 16,7 ms (60
  Bilder/s), im Geisterrennen das Doppelte. Kopfbilder in Menüs werden
  ohnehin zwischengespeichert.

## 5. Anpassen

Alles Wichtige steht oben in `kinder.js` unter `AUSSEHEN`:

- **Farben:** `haar` (Grundton), `haarHell` (Glanz, Spitzen),
  `haarDunkel` (Schatten, Kontur), `haut`, `augen`, `brauen`
- **Frisur:** `frisur: "pony"`, `"dutt"` oder `"lang"` (die Looks unter
  `VARIANTEN` setzen sie je nach Wahl in der Garage)
- **Brille** an/aus: `brille: null` bzw. Rahmen- und Glasfarbe
- **Gesichtsform:** `gesicht.breite`, `gesicht.hoehe`, `gesicht.kinn`;
  `ohr` (Größe, über 1 = abstehend)

Nach jeder Änderung `werkzeuge/kinder-vorschau.html` neu laden.
