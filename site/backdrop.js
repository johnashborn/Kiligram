// ------------------------------------------------------------------
// Photo-wall backdrop for the passcode screen and the admin login:
// columns of your photos drifting slowly (neighbours in opposite
// directions) under a soft veil, with a few hearts floating up.
// Usage: Backdrop.mount(element, photos, publicUrl)
// ------------------------------------------------------------------
(function () {
  "use strict";

  var reduceMotion = window.matchMedia && window.matchMedia("(prefers-reduced-motion: reduce)").matches;
  var HEART = "data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 32 32'%3E%3Cpath fill='%23D9668F' d='M16 28S3 20 3 11.5A6.5 6.5 0 0 1 16 8a6.5 6.5 0 0 1 13 3.5C29 20 16 28 16 28z'/%3E%3C/svg%3E";

  var TINTS = [
    "linear-gradient(160deg, #E9DDF4, #C9B0E3)",
    "linear-gradient(160deg, #F6E1EA, #E3A9C0)",
    "linear-gradient(160deg, #EFE6F7, #B79AD0)",
    "linear-gradient(160deg, #F3E9F1, #D7B7D9)",
    "linear-gradient(160deg, #E4DAF0, #A98BCB)"
  ];

  function rand(min, max) { return min + Math.random() * (max - min); }

  function wall(urls) {
    var COLS = 3, PER_COL = 5;
    // no photos (nobody logged in yet): blank polaroids in soft tints instead
    var pool = urls.length ? urls.slice() : [null];
    while (pool.length < COLS * PER_COL) pool = pool.concat(urls.length ? urls : [null]);

    var w = document.createElement("div");
    w.className = "bd-wall";
    for (var c = 0; c < COLS; c++) {
      var col = document.createElement("div");
      col.className = "bd-col" + (c % 2 ? " rev" : "");
      var track = document.createElement("div");
      track.className = "bd-track";
      track.style.animationDuration = (80 + c * 14) + "s";
      var mine = pool.filter(function (_, i) { return i % COLS === c; });
      // two identical halves so the loop is seamless
      mine.concat(mine).forEach(function (u, k) {
        if (!u) {
          var ph = document.createElement("div");
          ph.className = "bd-ph";
          ph.style.setProperty("--ph", TINTS[(c * 2 + k) % TINTS.length]);
          track.appendChild(ph);
          return;
        }
        var img = document.createElement("img");
        img.src = u;
        img.alt = "";
        img.decoding = "async";
        track.appendChild(img);
      });
      col.appendChild(track);
      w.appendChild(col);
    }
    return w;
  }

  function hearts(count) {
    var h = document.createElement("div");
    h.className = "bd-hearts";
    for (var i = 0; i < (count || 14); i++) {
      var s = document.createElement("span");
      var size = rand(10, 24);
      s.style.left = rand(2, 98) + "%";
      s.style.width = s.style.height = size + "px";
      s.style.animationDuration = rand(11, 20) + "s";
      s.style.animationDelay = -rand(0, 20) + "s";
      s.style.backgroundImage = "url(\"" + HEART + "\")";
      s.style.setProperty("--sway", rand(-40, 40) + "px");
      h.appendChild(s);
    }
    return h;
  }

  // Draws the wall: real photos when given (only after login, since photos
  // need a signed-in user), otherwise blank polaroids. Calling it again with
  // photos swaps the blank wall for the real one.
  function mount(el, photos, publicUrl) {
    if (!el) return;
    var urls = (photos || []).map(function (p) { return publicUrl ? publicUrl(p.image_path) : ""; }).filter(Boolean);
    var old = el.querySelector(".bd-wall");
    if (old && (el.getAttribute("data-photos") || !urls.length)) return;
    var w = wall(urls);
    if (old) el.replaceChild(w, old); else el.insertBefore(w, el.firstChild);
    if (urls.length) el.setAttribute("data-photos", "1");
    if (el.getAttribute("data-ready")) return;
    el.setAttribute("data-ready", "1");
    if (!reduceMotion) el.appendChild(hearts());
    requestAnimationFrame(function () { el.classList.add("on"); });
  }

  // Just the floating hearts, for pages that have their own background.
  function addHearts(el, count) {
    if (el && !reduceMotion) el.appendChild(hearts(count));
  }

  window.Backdrop = { mount: mount, addHearts: addHearts };
})();
