/* ===========================================================================
   Fiete Flitzer – editor.js
   ---------------------------------------------------------------------------
   STRECKEN-EDITOR (noch versteckt: Einstellungen → Entwickler-Bereich →
   „✏️ Strecken-Editor“, dann erscheint oben in der Weltenliste „Eigene Strecke“).

   Mit dem Finger ein Höhenprofil von links nach rechts malen, Welt und Länge
   wählen, losfahren. Gemalt wird übertrieben steil (2,5-fach), damit Kinder
   große Bewegungen machen können. Was wirklich gefahren wird, zeigt die
   Vorschau: Der Strecken-Generator (gelaende.js, optionen.strecke) begrenzt
   die Steigung auf das, was die Reifen in der Welt halten, rundet die Kanten
   ab und verteilt Münzen und Kanister wie in jedem Level.

   Gespeichert werden die letzten 8 Strecken im Spielstand (S.strecken), nicht
   im Spielstand-Code.

   Schnittstelle: FF.Editor.oeffne({ strecken, strecke, speichern(), fahren(strecke),
   schliessen(), klick() })
   Eine Strecke: { id, name, welt (id), laenge [m], dx [m], h: [Höhen in m] }
   =========================================================================== */

var FF = window.FF = window.FF || {};

(function () {
  "use strict";
  var C = FF.CONFIG;
  var DX = 2;                       // Abstand der gemalten Höhenpunkte [m]
  var UEBERHOEHUNG = 2.5;           // so viel steiler sieht man beim Malen
  var LAENGEN = [[300, "Kurz"], [500, "Mittel"], [800, "Lang"]];
  var MAX_STRECKEN = 8;

  var el = null, bild = null, g = null, opt = null, strecke = null, vorschau = null, gemalt = false;
  var letzter = null;               // letzter Malpunkt {i, y}
  var DPR = 1;

  function $(id) { return document.getElementById(id); }
  function weltVon(id) { for (var i = 0; i < C.welten.length; i++) if (C.welten[i].id === id) return i; return 0; }

  function neueStrecke(laenge, weltId) {
    var h = [];
    for (var i = 0; i <= laenge / DX; i++) h.push(0);
    return { id: null, name: null, welt: weltId || C.welten[0].id, laenge: laenge, dx: DX, h: h };
  }

  /* ---------- Aufbau (einmal) ---------- */
  function baue() {
    el = document.createElement("div");
    el.className = "editor"; el.id = "editor"; el.hidden = true;
    el.innerHTML =
      '<header class="editor-kopf">' +
        '<span class="editor-titel">✏️ Strecke malen</span>' +
        '<div class="editor-welten" id="editor-welten"></div>' +
        '<button type="button" class="editor-zu" id="editor-zu" aria-label="Schließen">✕</button>' +
      "</header>" +
      '<div class="editor-buehne"><canvas id="editor-bild" aria-label="Malfläche für die Strecke"></canvas>' +
        '<div class="editor-hinweis" id="editor-hinweis">✏️ Male mit dem Finger einen Weg von links nach rechts!</div></div>' +
      '<footer class="editor-fuss">' +
        '<div class="editor-laengen" id="editor-laengen"></div>' +
        '<div class="editor-strecken" id="editor-strecken"></div>' +
        '<button type="button" class="editor-knopf" id="editor-neu">🗑️ Neu</button>' +
        '<button type="button" class="editor-knopf editor-los" id="editor-los">▶️ Fahren!</button>' +
      "</footer>";
    document.body.appendChild(el);
    bild = $("editor-bild"); g = bild.getContext("2d");

    $("editor-zu").addEventListener("click", function () { opt.klick(); schliesse(); });
    $("editor-neu").addEventListener("click", function () {
      opt.klick();
      strecke = neueStrecke(strecke.laenge, strecke.welt); gemalt = false; neuBerechnen(); leisten();
    });
    $("editor-los").addEventListener("click", function () {
      opt.klick();
      if (!gemalt && !strecke.id) { wackeln($("editor-hinweis")); return; }
      merken();
      schliesse(true);
      opt.fahren(strecke);
    });
    bild.addEventListener("pointerdown", function (e) { bild.setPointerCapture(e.pointerId); letzter = null; male(e); });
    bild.addEventListener("pointermove", function (e) { if (e.buttons || e.pointerType === "touch") male(e); });
    ["pointerup", "pointercancel"].forEach(function (t) { bild.addEventListener(t, function () { letzter = null; neuBerechnen(); }); });
    window.addEventListener("resize", function () { if (!el.hidden) groesse(); });
  }

  function wackeln(x) { x.classList.remove("wackelt"); void x.offsetWidth; x.classList.add("wackelt"); }

  /* ---------- Leisten: Welten, Längen, gespeicherte Strecken ---------- */
  function leisten() {
    $("editor-welten").innerHTML = C.welten.map(function (w) {
      return '<button type="button" class="editor-welt' + (w.id === strecke.welt ? " aktiv" : "") + '" data-welt="' + w.id +
             '" title="' + w.name + '" aria-label="' + w.name + '">' + w.emoji + "</button>";
    }).join("");
    $("editor-welten").querySelectorAll("[data-welt]").forEach(function (b) {
      b.addEventListener("click", function () { opt.klick(); strecke.welt = b.dataset.welt; leisten(); neuBerechnen(); });
    });
    $("editor-laengen").innerHTML = LAENGEN.map(function (l) {
      return '<button type="button" class="editor-knopf' + (l[0] === strecke.laenge ? " aktiv" : "") + '" data-laenge="' + l[0] + '">' +
             l[1] + "<small>" + l[0] + " m</small></button>";
    }).join("");
    $("editor-laengen").querySelectorAll("[data-laenge]").forEach(function (b) {
      b.addEventListener("click", function () { opt.klick(); laengeAendern(+b.dataset.laenge); leisten(); neuBerechnen(); });
    });
    var L = opt.strecken;
    $("editor-strecken").innerHTML = L.map(function (s, i) {
      return '<button type="button" class="editor-knopf editor-gespeichert' + (s.id === strecke.id ? " aktiv" : "") + '" data-nr="' + i + '">' +
             (C.welten[weltVon(s.welt)].emoji) + " " + s.name + "</button>";
    }).join("");
    $("editor-strecken").querySelectorAll("[data-nr]").forEach(function (b) {
      b.addEventListener("click", function () { opt.klick(); strecke = kopie(L[+b.dataset.nr]); gemalt = true; leisten(); neuBerechnen(); });
    });
    $("editor-hinweis").hidden = gemalt;
  }

  function kopie(s) { return JSON.parse(JSON.stringify(s)); }

  /* Länge ändern: das Gemalte wird gestreckt oder gestaucht */
  function laengeAendern(neu) {
    var alt = strecke.h, n = neu / DX, h = [];
    for (var i = 0; i <= n; i++) {
      var f = i / n * (alt.length - 1), k = Math.min(alt.length - 2, Math.floor(f)), t = f - k;
      h.push(alt[k] * (1 - t) + alt[k + 1] * t);
    }
    strecke.h = h; strecke.laenge = neu;
  }

  /* In die Liste der gespeicherten Strecken (neueste vorn) */
  function merken() {
    var L = opt.strecken;
    if (!strecke.id) {
      strecke.id = Date.now();
      var nr = 1;
      L.forEach(function (s) { var m = /(\d+)$/.exec(s.name || ""); if (m) nr = Math.max(nr, +m[1] + 1); });
      strecke.name = "Strecke " + nr;
    }
    strecke.h = strecke.h.map(function (v) { return Math.round(v * 10) / 10; });
    for (var i = L.length - 1; i >= 0; i--) if (L[i].id === strecke.id) L.splice(i, 1);
    L.unshift(kopie(strecke));
    if (L.length > MAX_STRECKEN) L.length = MAX_STRECKEN;
    opt.speichern();
  }

  /* ---------- Malen ---------- */
  function masstab() {
    var b = bild.clientWidth, hh = bild.clientHeight, s = b / strecke.laenge;
    return { b: b, h: hh, sx: s, sy: s * UEBERHOEHUNG, y0: hh * 0.62 };
  }
  function male(e) {
    var r = bild.getBoundingClientRect(), M = masstab();
    var x = (e.clientX - r.left) / M.sx, y = (M.y0 - (e.clientY - r.top)) / M.sy;
    y = Math.max(-(M.h - M.y0 - 6) / M.sy, Math.min((M.y0 - 6) / M.sy, y));
    var i = Math.round(Math.max(0, Math.min(strecke.laenge, x)) / DX);
    if (letzter) {                                     // Lücken zwischen zwei Malpunkten füllen
      var a = letzter.i, d = i - a;
      for (var k = 1; k <= Math.abs(d); k++) { var j = a + k * Math.sign(d); strecke.h[j] = letzter.y + (y - letzter.y) * k / Math.abs(d); }
    }
    strecke.h[i] = y;
    letzter = { i: i, y: y };
    if (!gemalt) { gemalt = true; $("editor-hinweis").hidden = true; }
    zeichne();
  }

  /* Vorschau: genau die Strecke, die gefahren wird (gelaende.js) */
  function neuBerechnen() {
    var welt = C.welten[weltVon(strecke.welt)];
    vorschau = new FF.Gelaende(welt, { stufe: 1, laenge: strecke.laenge, seed: 4242, strecke: strecke });
    zeichne();
  }

  function zeichne() {
    if (!g) return;
    var M = masstab(), welt = C.welten[weltVon(strecke.welt)], f = welt.farben;
    g.setTransform(DPR, 0, 0, DPR, 0, 0);
    var himmel = g.createLinearGradient(0, 0, 0, M.h);
    himmel.addColorStop(0, f.himmel[0]); himmel.addColorStop(1, f.himmel[1]);
    g.fillStyle = himmel; g.fillRect(0, 0, M.b, M.h);
    function X(x) { return x * M.sx; }
    function Y(y) { return M.y0 - y * M.sy; }
    // Raster alle 50 m
    g.strokeStyle = "rgba(255,255,255,0.35)"; g.lineWidth = 1; g.font = "700 11px 'Nunito', sans-serif"; g.fillStyle = "rgba(255,255,255,0.8)";
    for (var m = 50; m < strecke.laenge; m += 50) {
      g.beginPath(); g.moveTo(X(m), 0); g.lineTo(X(m), M.h); g.stroke();
      if (m % 100 === 0) g.fillText(m + " m", X(m) + 3, 14);
    }
    // gefahrene Strecke (Vorschau): Boden, Oberfläche, Münzen, Kanister
    if (vorschau) {
      g.beginPath(); g.moveTo(0, M.h);
      for (var x = 0; x <= strecke.laenge; x += 1) g.lineTo(X(x), Y(vorschau.hoeheBei(x)));
      g.lineTo(M.b, M.h); g.closePath();
      g.fillStyle = f.boden[0]; g.fill();
      g.strokeStyle = f.oberflaeche; g.lineWidth = 5; g.lineJoin = "round"; g.stroke();
      g.fillStyle = "#ffcf3a";
      vorschau.muenzen.forEach(function (mu) { if (mu.x < strecke.laenge) { g.beginPath(); g.arc(X(mu.x), Y(mu.y), 2.2, 0, Math.PI * 2); g.fill(); } });
      g.fillStyle = "#e8453c";
      vorschau.tanks.forEach(function (t) { g.fillRect(X(t.x) - 4, Y(t.y) - 10, 8, 10); });
    }
    // was gemalt wurde (gestrichelt)
    g.setLineDash([6, 5]); g.strokeStyle = "rgba(30,44,82,0.65)"; g.lineWidth = 2.5;
    g.beginPath();
    strecke.h.forEach(function (y, i) { if (i) g.lineTo(X(i * DX), Y(y)); else g.moveTo(X(0), Y(y)); });
    g.stroke(); g.setLineDash([]);
    // Start und Ziel (je 12 m eben)
    g.fillStyle = "rgba(255,255,255,0.35)"; g.fillRect(0, 0, X(12), M.h); g.fillRect(X(strecke.laenge - 12), 0, X(12), M.h);
    g.font = "22px sans-serif"; g.textAlign = "center";
    g.fillText("🚙", X(6), Y(vorschau ? vorschau.hoeheBei(0) : 0) - 8);
    g.fillText("🏁", X(strecke.laenge - 6), Y(vorschau ? vorschau.hoeheBei(strecke.laenge) : 0) - 8);
    g.textAlign = "left";
  }

  function groesse() {
    DPR = Math.min(2, window.devicePixelRatio || 1);
    bild.width = Math.max(1, Math.round(bild.clientWidth * DPR)); bild.height = Math.max(1, Math.round(bild.clientHeight * DPR));
    zeichne();
  }

  /* ---------- Öffnen / Schließen ---------- */
  function oeffne(o) {
    opt = o;
    if (!el) baue();
    strecke = o.strecke ? kopie(o.strecke) : (o.strecken[0] ? kopie(o.strecken[0]) : neueStrecke(500));
    gemalt = !!strecke.id;
    el.hidden = false;
    leisten();
    groesse();
    neuBerechnen();
  }
  function schliesse(zumFahren) {
    if (!el) return;
    el.hidden = true;
    if (!zumFahren && opt && opt.schliessen) opt.schliessen();
  }

  FF.Editor = { oeffne: oeffne, schliesse: schliesse, offen: function () { return !!el && !el.hidden; } };
})();
