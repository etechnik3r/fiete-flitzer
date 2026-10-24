# 👫 Mehrspieler für Fiete Flitzer – Konzept zur Bewertung

Ziel: Zwei Kinder fahren **gegeneinander** – am selben Gerät, im **gleichen
WLAN** oder **übers Internet**. Dieses Dokument sammelt die Möglichkeiten,
bewertet sie und schlägt einen Weg vor.

> **Stand:** Umgesetzt ist das **Geisterrennen zu zweit auf einem Gerät**
> (Teil von Stufe 1, siehe Abschnitt 4): `geist.js` zeichnet die erste Fahrt
> auf und spielt sie in der zweiten als Geist ab. Dazu kommen Spielerwahl
> (Fiete/Jonte), Lobby, Würfeln und Siegerehrung. Split-Screen und alles mit
> Netz (Stufe 2 und 3) sind noch offen.

---

## 1. Die wichtigste Entscheidung vorab: „Geister-Autos“ statt Zusammenstöße

| | **Geister-Autos** (empfohlen) | **Echte Zusammenstöße** |
|---|---|---|
| Prinzip | Jedes Gerät simuliert nur **sein eigenes** Auto. Das andere Auto wird halbdurchsichtig angezeigt und kann nicht berührt werden. | Beide Autos sind in **einer gemeinsamen** Physik und können sich anstoßen. |
| Was muss übertragen werden? | Nur die Lage zum Anzeigen (≈ 20 Byte, 15–20× pro Sekunde). | Eingaben oder Zustände beider Autos, mit Abgleich bei jeder Abweichung. |
| Verzögerung (Latenz) | Egal: Der Gegner wird z. B. 100 ms später angezeigt. Gewertet wird die eigene, lokal gemessene Zeit. | Kritisch: Autos „springen“, Zusammenstöße wirken unfair. |
| Physik muss auf allen Geräten bitgenau gleich rechnen? | **Nein** | **Ja.** `Math.sin`/`cos`/`atan` sind in JavaScript nicht auf allen Browsern bitgleich (die Norm erlaubt Näherungen). iPad und Android würden auseinanderlaufen. Abhilfe: eigene Festkomma-Physik oder ein Server rechnet für beide. |
| Aufwand | klein bis mittel | hoch (Wochen) |
| Für 6-Jährige | gut: niemand kann den anderen umschubsen | Frustpotenzial („Er hat mich runtergeschubst!“) |

Hill Climb Racing 2 löst seine Rennen nach meinem Kenntnisstand ebenfalls mit
Geister-Autos statt mit Kollisionen.
**Empfehlung: Geister-Autos.** Die Physik in `physik.js` bleibt dann
unverändert; es kommt nur eine Anzeige- und Netzwerkschicht dazu.

Günstig ist außerdem: Die Strecke entsteht aus einem Seed
(`gelaende.js`). Beide Geräte erzeugen also aus derselben Level-Nummer
**dieselbe Strecke**, ohne dass Höhendaten übertragen werden müssen.

---

## 2. Die Möglichkeiten im Überblick

### A) Zu zweit auf einem Gerät (Split-Screen)
Ein Tablet im Querformat wird in zwei Hälften geteilt. Jedes Kind hat in
seiner Hälfte eigene Pedale (Bremse links, Gas rechts). Das Spiel rechnet zwei
`Fahrt`-Objekte; die Physik kostet fast nichts (9 Spielminuten in 0,7 s).
- ➕ kein Netz, kein Server, sofort spielbar, perfekt für Geschwister
- ➖ auf dem Handy zu eng; nur zwei Spieler

### B) Geister-Rennen ohne Echtzeit (asynchron)
Jede Fahrt wird aufgezeichnet (Lage 20× pro Sekunde, ≈ 15–20 kB pro Minute).
Danach kann man gegen den **Geist** fahren: gegen die eigene Bestzeit oder gegen
die Fahrt des Geschwisterkinds auf demselben Gerät.
- ➕ kein Netz, keine Wartezeit, keine Verbindungsprobleme, sehr kindgerecht
- ➕ Grundstein für alles Weitere: Aufzeichnungsformat und Geister-Anzeige
  werden später auch online gebraucht
- ➖ kein gleichzeitiges Fahren
- Teilen zwischen Geräten: Ein QR-Code fasst etwa 3 kB. Das reicht nur für
  stark ausgedünnte Geister (5 Hz, Delta-Kodierung) und ergibt dichte,
  schwer scanbare Codes. Besser über einen Server (siehe C).

### C) Echtzeit über einen kleinen WebSocket-Server (Relais)
Beide Geräte verbinden sich mit einem kleinen Server, der die Nachrichten eines
„Raums“ weiterreicht. Der Server rechnet keine Physik.
- **Gleiches WLAN ohne Eintippen:** Der Server gruppiert Geräte mit derselben
  öffentlichen IP-Adresse (dasselbe Heimnetz). Im Spiel erscheint dann
  „Jonte ist in deinem WLAN – mitfahren?“. PairDrop/Snapdrop arbeiten nach
  diesem Prinzip.
- **Übers Internet:** Raumcode aus **3 Bildern** (z. B. 🐶🍎🚗) statt Zahlen,
  damit Kinder ihn vorlesen bzw. antippen können. Bei 16 Bildern ergibt das
  4.096 Codes; ein Code gilt nur 10 Minuten.
- ➕ funktioniert in jedem Netz (Heim-WLAN, Mobilfunk, Hotspot), robust
- ➕ wenig Code: Server ≈ 150–300 Zeilen (Node.js mit `ws`) oder ein
  Cloudflare Worker mit Durable Object
- ➖ ein Server muss betrieben werden (HTTPS/`wss://` Pflicht, weil das Spiel
  über HTTPS läuft), Datenschutz-Hinweis nötig (IP-Adressen)

### D) Echtzeit direkt von Gerät zu Gerät (WebRTC)
Browser können sich per WebRTC-Datenkanal direkt verbinden. Für den
Verbindungsaufbau (Signalisierung) braucht es trotzdem einen kleinen Server
wie in C. Hinter strengen Routern und im Mobilfunk ist zusätzlich ein
**TURN-Relaisserver** nötig.
- ➕ im gleichen WLAN geht der Datenverkehr direkt; der Server sieht nur den
  Verbindungsaufbau
- ➖ mehr Sonderfälle: NAT-Typen, mDNS-Verschleierung der lokalen IPs,
  iOS-Eigenheiten. Ohne TURN scheitern manche Verbindungen.
- ➖ für Geister-Autos bringt die geringere Latenz praktisch nichts

### E) WebRTC ganz ohne Server (Handshake per QR-Code)
Gerät A zeigt einen QR-Code (Verbindungsangebot), Gerät B scannt ihn und
zeigt seinerseits einen QR-Code, den A scannt.
- ➕ keinerlei Server, Daten bleiben im Heimnetz
- ➖ zweimal scannen, Kamera-Erlaubnis, QR-Bibliothek: für Kinder umständlich
  (eher eine Elternaufgabe). Übers Internet ohne TURN unzuverlässig.

### F) Fertige Fremddienste (PeerJS-Cloud, Trystero über Nostr/MQTT, Firebase)
- ➕ schnell eingebaut
- ➖ Abhängigkeit von fremden, kostenlosen Diensten. Kinder-IP-Adressen landen
  bei Dritten (teils außerhalb der EU). Für ein Kinderspiel eher nicht.

### G) Native App mit Nahfunk (Capacitor + Android „Nearby“ / iOS „Multipeer“)
- ➕ findet Geräte in der Nähe sogar **ohne WLAN und ohne Internet**
- ➖ App-Store-Konten, Review, deutlich mehr Aufwand, zwei Plattformen

### Was im reinen Browser **nicht** geht
- Geräte im WLAN selbst finden (UDP-Broadcast, mDNS): Dafür gibt es keine
  Browser-Schnittstelle.
- Ein Gerät als Server betreiben: Browser können keine Verbindungen annehmen.
- Ein Heimserver (z. B. Raspberry Pi) im WLAN: Das Spiel läuft über HTTPS,
  daher blockiert der Browser `ws://`-Verbindungen ins LAN (Mixed Content).
  Abhilfe wäre ein gültiges Zertifikat für den Pi oder das Spiel ebenfalls
  vom Pi auszuliefern. Dann gehen aber PWA und Offline-Cache nicht mehr.
- Web Bluetooth zwischen zwei Handys: nicht vorgesehen, auf iOS gar nicht
  verfügbar.

---

## 3. Bewertung

★ = schlecht … ★★★★★ = sehr gut

| Option | gleiches WLAN | Internet | Server nötig | Aufwand* | Betriebskosten | Kinder-Bedienung | Zuverlässigkeit | Datenschutz |
|---|---|---|---|---|---|---|---|---|
| **A** Split-Screen | – (ein Gerät) | – | nein | ★★★★★ (2–3 T.) | 0 € | ★★★★★ | ★★★★★ | ★★★★★ |
| **B** Geister asynchron | ✓ (gleiches Gerät) | (✓ mit Server) | nein | ★★★★★ (2 T.) | 0 € | ★★★★☆ | ★★★★★ | ★★★★★ |
| **C** WebSocket-Relais | ✓ automatisch | ✓ Bildercode | ja, klein | ★★★☆☆ (6–10 T.) | 0–5 €/Monat | ★★★★★ | ★★★★☆ | ★★★★☆ |
| **D** WebRTC + Signal | ✓ direkt | ✓ (mit TURN) | ja + TURN | ★★☆☆☆ (10–15 T.) | 0–10 €/Monat | ★★★★★ | ★★★☆☆ | ★★★★☆ |
| **E** WebRTC per QR | ✓ | eingeschränkt | nein | ★★★☆☆ (5–8 T.) | 0 € | ★★☆☆☆ | ★★★☆☆ | ★★★★★ |
| **F** Fremddienst | ✓ | ✓ | fremd | ★★★★☆ (3–5 T.) | 0 € | ★★★★☆ | ★★★☆☆ | ★★☆☆☆ |
| **G** Native App | ✓ auch offline | ✓ | optional | ★☆☆☆☆ (4–6 Wo.) | Store-Gebühren | ★★★★★ | ★★★★☆ | ★★★★☆ |

\* grobe Schätzung in Entwicklertagen inklusive Tests auf iOS/Android. Die
Sterne bewerten den Aufwand: mehr Sterne = weniger Aufwand.

---

## 4. Empfehlung: in drei Stufen

**Stufe 1 – ohne Netz (≈ 4–5 Tage):** **B + A**
1. Geister-Rennen: gegen die eigene Bestzeit oder das Geschwisterkind
   („Schlag Jontes Zeit!“).
2. Split-Screen auf dem Tablet.

Das ist sofort spielbar, braucht keine Infrastruktur und baut die Teile, die
Stufe 2 ohnehin braucht: Aufzeichnung, Geister-Anzeige und eine zweite
`Fahrt`.

**Stufe 2 – online (≈ 6–10 Tage):** **C**, also ein kleiner WebSocket-Server
mit automatischer „Freund im gleichen WLAN“-Erkennung und Bildercodes fürs
Internet. Hosting z. B. bei Hetzner in Deutschland (kleiner VPS, ein paar Euro
pro Monat, DSGVO einfacher) oder als Cloudflare Worker (Gratis-Kontingent
reicht vermutlich).

**Stufe 3 – nur bei Bedarf:** **D** (WebRTC direkt), falls Last oder
Kosten des Servers je ein Thema werden. Bei Geister-Rennen ist das nicht zu
erwarten: ≈ 1 kB/s pro Spieler.

---

## 5. So würde es technisch aussehen (Stufe 1 + 2)

### Neue/geänderte Dateien
| Datei | Aufgabe |
|---|---|
| `geist.js` (neu) | Fahrt aufzeichnen und abspielen. Kompaktes Format pro Abtastwert: `x`,`y` (Float32), Winkel (Int16), je Rad Federweg und Drehwinkel (je 1 Byte), Flags (Gesicht, Ballon-Hilfe). Interpolation zwischen den Abtastwerten. |
| `netz.js` (neu) | Transport-Schicht mit einheitlicher Schnittstelle `verbinde(raum)`, `sende(nachricht)`, `beiNachricht(fn)`, `trenne()`. Umsetzungen: **BroadcastChannel** (zwei Browser-Tabs, ideal zum Testen am PC), **WebSocket**, später **WebRTC**. |
| `mehrspieler.js` (neu) | Ablauf: Lobby → beide „Bereit“ → Countdown → Rennen → Ergebnis → „Nochmal?“ |
| `grafik.js` | `zeichneSzene` zeichnet zusätzlich eine Liste von Geistern (halbdurchsichtig, eigenes Outfit und Fahrzeug), dazu einen Pfeil am Bildrand mit „Jonte: 35 m vor dir“. Für Split-Screen wird zweimal in zwei Bildhälften gezeichnet. |
| `spiel.js` | Menüpunkt „👫 Zu zweit“, Lobby-Bildschirme, zweite Pedal-Gruppe für Split-Screen, Ergebnis mit beiden Zeiten. Die Fortschrittsleiste zeigt beide Fiete-Köpfe. |
| `server/` (neu, Stufe 2) | ≈ 200 Zeilen: Räume, Bildercodes, Weiterleiten, „gleiches WLAN“ über die öffentliche IP, Raum-Ablauf nach 10 Minuten, max. 2 (oder 4) Spieler pro Raum. |

### Nachrichten (Beispiel)
```js
{ t: "hallo", avatar: "🦊", fahrzeug: "moped", outfit: "netz", farbe: "rot" }
{ t: "level", welt: 2, stufe: 1, fair: true }           // Gastgeber wählt
{ t: "bereit" }
{ t: "start", um: 1730000000000 }                       // Countdown-Ende (Serverzeit)
{ t: "lage", z: 12.35, x: 182.4, y: 7.1, a: 0.21, r: [..], f: 3 }   // 15–20 Hz
{ t: "ereignis", e: "ziel", zeit: 41.82 }               // oder "leer", "hoppla"
```

### Fairness und Zeitmessung
- Jedes Gerät misst **seine eigene** Fahrzeit ab seinem eigenen „Los!“.
  Die Latenz spielt für die Wertung daher keine Rolle.
- Uhrenabgleich für einen gleichzeitigen Countdown per Ping/Pong
  (Prinzip NTP: Versatz = ((t1 − t0) + (t2 − t3)) / 2).
- **Fair-Modus** (wählbar): Beide fahren dasselbe Fahrzeug ohne Upgrades.
  Sonst gewinnt immer das Kind mit der besseren Garage.
- Optional ein Vorsprung für das jüngere Kind (z. B. 3 s oder +20 % Tank).

### Rennarten für Kinder
- **Wer ist zuerst im Ziel?** (die normalen Level)
- **Wer kommt weiter?** (Endlos-Modus bis der Tank leer ist; Benzin-Taktik
  bleibt spannend)
- Münzen sammelt jeder für sich und behält sie auch bei einer Niederlage.
  Für den Sieg gibt es einen Pokal-Bonus.

### Kindersicherheit und Datenschutz
- Kein Chat, keine freien Namen: Tier-Avatar plus vorgegebene Spitznamen,
  keine Konten.
- Server speichert nichts dauerhaft; Räume verfallen nach 10 Minuten.
- IP-Adressen werden nur für die Dauer der Verbindung verarbeitet.
  Datenschutzhinweis in den Einstellungen. Online-Spiel nur nach Freigabe
  durch die Eltern (gleiche Rechenaufgabe wie beim Zurücksetzen).
- Ein Server in Deutschland bzw. der EU vereinfacht die DSGVO-Fragen.

### Testen
- Zwei Browser-Tabs am PC über `BroadcastChannel` (ohne Server).
- Automatisch mit Playwright: zwei Browser-Kontexte, ein Bot fährt jeweils
  (wie `werkzeuge/testfahrt.js`).
- Echte Geräte: iPad und Android-Handy im gleichen WLAN, dazu ein Handy
  über Mobilfunk.

---

## 6. Offene Entscheidungen

1. **Geister-Autos** (empfohlen) oder echte Zusammenstöße?
2. Mit **Stufe 1** (ohne Netz) anfangen?
3. **Server** betreiben: ja oder nein? Falls ja, wo (Hetzner in DE oder
   Cloudflare) und wer kümmert sich darum?
4. **Fair-Modus** als Standard, oder mit der eigenen Garage fahren?
5. **2 Spieler** oder bis zu **4**?
6. Auf welchen Geräten wird hauptsächlich gespielt (Tablet oder Handy)?
   Davon hängt ab, wie wichtig der Split-Screen ist.
