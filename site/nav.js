// ------------------------------------------------------------------
// The sticky navigation bar: smooth jumps to each part of the page,
// highlights the part you're looking at, and hides links to parts
// that aren't on the page (for example no reasons in config.js).
// ------------------------------------------------------------------
(function () {
  "use strict";

  var reduceMotion = window.matchMedia && window.matchMedia("(prefers-reduced-motion: reduce)").matches;
  var track = document.getElementById("nav-track");
  var links = Array.prototype.slice.call(document.querySelectorAll('.nav-link[href^="#"]'));
  var items = links.map(function (a) {
    return { link: a, target: document.getElementById(a.getAttribute("href").slice(1)) };
  }).filter(function (x) { return x.target; });

  // ---------- hide links to sections that are hidden ----------
  function syncVisible() {
    items.forEach(function (x) {
      x.link.hidden = x.target.classList.contains("hidden");
    });
  }
  syncVisible();
  if ("MutationObserver" in window) {
    var mo = new MutationObserver(syncVisible);
    items.forEach(function (x) { mo.observe(x.target, { attributes: true, attributeFilter: ["class"] }); });
  }

  // ---------- jump smoothly ----------
  items.forEach(function (x) {
    x.link.addEventListener("click", function (e) {
      e.preventDefault();
      x.target.scrollIntoView({ behavior: reduceMotion ? "auto" : "smooth", block: "start" });
      setActive(x);
      // move keyboard focus along, without a second jump
      x.target.setAttribute("tabindex", "-1");
      x.target.focus({ preventScroll: true });
    });
  });

  // ---------- highlight the part on screen ----------
  var current = null;
  function setActive(x) {
    if (current === x) return;
    current = x;
    items.forEach(function (y) {
      if (y === x) y.link.setAttribute("aria-current", "true");
      else y.link.removeAttribute("aria-current");
    });
    // on phones the bar scrolls sideways: keep the highlighted link in view
    if (x && track.scrollWidth > track.clientWidth) {
      var l = x.link;
      track.scrollTo({
        left: l.offsetLeft - (track.clientWidth - l.offsetWidth) / 2,
        behavior: reduceMotion ? "auto" : "smooth"
      });
    }
  }

  if ("IntersectionObserver" in window) {
    var visible = {};
    var io = new IntersectionObserver(function (entries) {
      entries.forEach(function (en) { visible[en.target.id] = en.isIntersecting; });
      // the first section (in page order) crossing the middle band wins
      var hit = null;
      items.forEach(function (x) { if (!hit && visible[x.target.id]) hit = x; });
      if (hit) setActive(hit);
    }, { rootMargin: "-35% 0px -55% 0px" });
    items.forEach(function (x) { io.observe(x.target); });
  }
})();
