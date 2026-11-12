// ------------------------------------------------------------------
// "All photos" view: every photo as an album page, grouped by month,
// with heart-select for saving several at once.
// Album.init({ photos, openLightbox(i, el), toast(msg) }) renders it.
// ------------------------------------------------------------------
(function () {
  "use strict";

  var M = window.Memories, S = window.Saver;
  var $ = function (id) { return document.getElementById(id); };

  var photos = [], opts = {}, rendered = false;
  var selecting = false, chosen = {}, prepared = false, busy = false;
  var cards = [];

  function count() { return Object.keys(chosen).length; }
  function chosenPhotos() {
    return Object.keys(chosen).map(Number).sort(function (a, b) { return a - b; })
      .map(function (i) { return Object.assign({ _index: i }, photos[i]); });
  }
  function plural(n) { return n === 1 ? "1 photo" : n + " photos"; }

  function shortDate(iso) {
    var d = new Date(iso + "T00:00:00");
    return isNaN(d) ? "" : d.toLocaleDateString(undefined, { month: "long", day: "numeric" });
  }

  // consecutive photos with the same month label share a heading
  function groups() {
    var out = [], last = null;
    photos.forEach(function (p, i) {
      var label = (p.month_label || "").trim();
      if (!last || last.key !== label.toLowerCase()) {
        last = { key: label.toLowerCase(), label: label, items: [] };
        out.push(last);
      }
      last.items.push(i);
    });
    return out;
  }

  function heading(g) {
    var dates = g.items.map(function (i) { return photos[i].taken_on; }).filter(Boolean).sort();
    var range = "";
    if (dates.length) {
      var a = shortDate(dates[0]), b = shortDate(dates[dates.length - 1]);
      range = a === b ? a : a + " – " + b;
    }
    return { title: M.monthName(g.label) || range || "More photos", sub: g.label ? range : "" };
  }

  function card(i) {
    var p = photos[i];
    var fig = document.createElement("figure");
    fig.className = "polaroid album-card";
    fig.tabIndex = 0;
    fig.setAttribute("role", "button");
    fig.style.setProperty("--tilt", ((i * 37) % 7 - 3) * 0.5 + "deg");

    var frame = document.createElement("div");
    frame.className = "frame";
    var img = document.createElement("img");
    img.loading = "lazy";
    img.decoding = "async";
    img.src = M.publicUrl(p.image_path);
    img.alt = p.caption || "Our photo";
    img.addEventListener("load", function () { frame.classList.add("loaded"); });
    frame.appendChild(img);

    var cap = document.createElement("figcaption");
    cap.textContent = p.caption || "";

    var pick = document.createElement("span");
    pick.className = "pick";
    pick.setAttribute("aria-hidden", "true");
    pick.innerHTML = '<svg viewBox="0 0 32 32"><use href="#i-heart"/></svg>';

    fig.appendChild(frame);
    fig.appendChild(cap);
    fig.appendChild(pick);

    var act = function () {
      if (selecting) toggle(i); else opts.openLightbox(i, fig);
    };
    fig.addEventListener("click", act);
    fig.addEventListener("keydown", function (e) {
      if (e.key === "Enter" || e.key === " ") { e.preventDefault(); act(); }
    });
    cards[i] = fig;
    return fig;
  }

  function render() {
    var body = $("album-body");
    body.innerHTML = "";
    cards = [];
    groups().forEach(function (g) {
      var sec = document.createElement("section");
      sec.className = "album-group";
      var h = heading(g);

      var head = document.createElement("div");
      head.className = "group-head";
      var h3 = document.createElement("h3");
      h3.className = "group-title";
      h3.textContent = h.title;
      if (h.sub) {
        var small = document.createElement("small");
        small.textContent = h.sub;
        h3.appendChild(small);
      }
      var pickGroup = document.createElement("button");
      pickGroup.type = "button";
      pickGroup.className = "text-btn group-pick";
      pickGroup.textContent = "Choose these " + g.items.length;
      pickGroup.addEventListener("click", function () {
        var all = g.items.every(function (i) { return chosen[i]; });
        g.items.forEach(function (i) { if (all) delete chosen[i]; else chosen[i] = true; });
        sync();
      });
      head.appendChild(h3);
      head.appendChild(pickGroup);

      var grid = document.createElement("div");
      grid.className = "album-grid";
      g.items.forEach(function (i) { grid.appendChild(card(i)); });

      sec.appendChild(head);
      sec.appendChild(grid);
      body.appendChild(sec);
    });
    rendered = true;
    sync();
  }

  // ---------- selection ----------
  function toggle(i) {
    if (chosen[i]) delete chosen[i]; else chosen[i] = true;
    sync();
  }

  function setSelecting(on) {
    selecting = on;
    if (!on) chosen = {};
    sync();
  }

  function sync() {
    var n = count();
    prepared = false;
    $("album").classList.toggle("selecting", selecting);
    $("sel-toggle").textContent = selecting ? "Done" : "Select photos";
    $("sel-all").classList.toggle("hidden", !selecting);
    $("sel-all").textContent = n === photos.length ? "Clear all" : "Select all";
    $("sel-hint").classList.toggle("hidden", !selecting);
    cards.forEach(function (c, i) {
      var on = !!chosen[i];
      c.classList.toggle("chosen", on);
      var cap = photos[i].caption || "photo";
      c.setAttribute("aria-label", selecting ? (on ? "Chosen: " : "Choose: ") + cap : "Open photo: " + cap);
      if (selecting) c.setAttribute("aria-pressed", on ? "true" : "false"); else c.removeAttribute("aria-pressed");
    });
    document.querySelectorAll(".group-pick").forEach(function (b) { b.classList.toggle("hidden", !selecting); });

    var bar = $("select-bar");
    bar.classList.toggle("open", selecting);
    document.body.classList.toggle("has-select-bar", selecting);
    $("sel-count").textContent = n ? plural(n) + " chosen" : "Nothing chosen yet";
    var save = $("sel-save");
    save.disabled = !n || busy;
    if (!busy) save.textContent = n ? (S.usesShare ? "Save " : "Download ") + plural(n) : "Save photos";
    $("sel-zip").classList.toggle("hidden", !(S.usesShare && n));
  }

  // ---------- saving ----------
  function finish(result) {
    busy = false;
    if (result === "shared") opts.toast("Saved " + plural(count()));
    else if (result === "downloaded") opts.toast("Downloading " + S.ZIP_NAME);
    setSelecting(false);
  }
  function fail(err) {
    console.error(err);
    busy = false;
    sync();
    opts.toast("Couldn't get the photos. Check your connection and try again.");
  }
  function progress(label) {
    return function (done, total) { $("sel-save").textContent = label + " " + done + " of " + total + "…"; };
  }

  $("sel-save").addEventListener("click", function () {
    var list = chosenPhotos();
    if (!list.length || busy) return;
    var btn = $("sel-save");

    if (!S.usesShare) {
      busy = true; btn.disabled = true;
      S.zipMany(list, progress("Zipping")).then(finish, fail);
      return;
    }
    if (prepared) {
      // second tap: the share sheet needs a fresh tap, so it opens here
      S.shareMany(list).then(function (r) {
        if (r === "cancelled") { prepared = true; return; }
        finish(r);
      }, fail);
      return;
    }
    // first tap on a phone: get the photos ready
    busy = true; btn.disabled = true;
    S.prepareMany(list, progress("Getting photos ready")).then(function () {
      busy = false;
      sync();
      prepared = true;
      btn.textContent = "Tap to save " + plural(list.length);
    }, fail);
  });

  $("sel-zip").addEventListener("click", function () {
    var list = chosenPhotos();
    if (!list.length || busy) return;
    busy = true; $("sel-save").disabled = true;
    S.zipMany(list, progress("Zipping")).then(finish, fail);
  });

  $("sel-toggle").addEventListener("click", function () { setSelecting(!selecting); });
  $("sel-all").addEventListener("click", function () {
    if (count() === photos.length) chosen = {};
    else photos.forEach(function (_, i) { chosen[i] = true; });
    sync();
  });

  window.Album = {
    init: function (o) {
      opts = o;
      photos = o.photos;
      chosen = {};
      rendered = false;
      if (!$("album").classList.contains("hidden")) render(); // already open: fill it now
    },
    show: function () { if (!rendered) render(); },
    hide: function () { if (selecting) setSelecting(false); }
  };
})();
