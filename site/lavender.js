// ------------------------------------------------------------------
// A small lavender bouquet that slowly blooms: the stems grow, then the
// florets open one by one from the bottom of each spike to the tip,
// and the bouquet sways gently once it's done.
// Lavender.mount(el) draws it; Lavender.bloom(el) starts the bloom.
// ------------------------------------------------------------------
(function () {
  "use strict";

  var NS = "http://www.w3.org/2000/svg";
  var reduceMotion = window.matchMedia && window.matchMedia("(prefers-reduced-motion: reduce)").matches;
  var PURPLES = ["#8C66C4", "#A585D6", "#7652B0", "#B79AD0", "#9673CC"];

  function node(name, attrs, parent) {
    var n = document.createElementNS(NS, name);
    for (var k in attrs) n.setAttribute(k, attrs[k]);
    if (parent) parent.appendChild(n);
    return n;
  }

  // point and tangent on a quadratic curve
  function at(p0, p1, p2, t) {
    var u = 1 - t;
    return {
      x: u * u * p0[0] + 2 * u * t * p1[0] + t * t * p2[0],
      y: u * u * p0[1] + 2 * u * t * p1[1] + t * t * p2[1],
      dx: 2 * u * (p1[0] - p0[0]) + 2 * t * (p2[0] - p1[0]),
      dy: 2 * u * (p1[1] - p0[1]) + 2 * t * (p2[1] - p1[1])
    };
  }

  function draw() {
    var svg = node("svg", { viewBox: "0 0 120 168", class: "lv-svg", focusable: "false" });
    var g = node("g", { class: "lv-bouquet" }, svg);
    var base = [60, 156];
    var stems = [
      { c: [44, 96], tip: [30, 26], delay: 0.35 },
      { c: [62, 90], tip: [61, 10], delay: 0 },
      { c: [76, 98], tip: [92, 30], delay: 0.6 }
    ];

    // leaves first, low on the stems
    [[-1, 0.2, 52, 120], [1, 0.25, 70, 116], [-1, 0.35, 56, 104]].forEach(function (l, i) {
      var x = l[2], y = l[3], s = l[0];
      node("path", {
        class: "lv-leaf",
        d: "M" + x + " " + y + " q " + (s * 14) + " -10 " + (s * 22) + " -30 q " + (s * -12) + " 12 " + (s * -22) + " 30z",
        style: "--d:" + (1.1 + i * 0.3) + "s"
      }, g);
    });

    stems.forEach(function (st, s) {
      node("path", {
        class: "lv-stem",
        d: "M" + base[0] + " " + base[1] + " Q" + st.c[0] + " " + st.c[1] + " " + st.tip[0] + " " + st.tip[1],
        pathLength: "1",
        style: "--d:" + st.delay + "s"
      }, g);

      // florets along the top part of the stem, opening from the bottom up
      var N = 18;
      for (var i = 0; i < N; i++) {
        var f = i / (N - 1);
        var t = 0.46 + 0.54 * f;
        var p = at(base, st.c, st.tip, t);
        var len = Math.sqrt(p.dx * p.dx + p.dy * p.dy) || 1;
        var nx = -p.dy / len, ny = p.dx / len;               // normal
        var side = i % 2 ? 1 : -1;
        var spread = 3.9 * (1 - 0.5 * f);
        var angle = Math.atan2(p.dy, p.dx) * 180 / Math.PI + 90 + side * 28;
        var delay = 2.2 + st.delay + i * 0.27;
        var rx = (3.4 * (1 - 0.4 * f)).toFixed(2), ry = (4.7 * (1 - 0.4 * f)).toFixed(2);
        var cx = (p.x + nx * side * spread).toFixed(2), cy = (p.y + ny * side * spread).toFixed(2);
        // the rotation lives on a wrapper, so the CSS bloom (a scale) doesn't replace it
        var holder = node("g", { transform: "rotate(" + angle.toFixed(1) + " " + cx + " " + cy + ")" }, g);
        node("ellipse", {
          class: "lv-bud",
          cx: cx,
          cy: cy,
          rx: rx,
          ry: ry,
          fill: PURPLES[(i + s * 2) % PURPLES.length],
          style: "--d:" + delay.toFixed(2) + "s"
        }, holder);
        // a smaller floret sitting on the stem every other step fills the spike
        if (i % 2 === 0 && i < N - 1) {
          node("circle", {
            class: "lv-bud",
            cx: p.x.toFixed(2),
            cy: p.y.toFixed(2),
            r: (2.4 * (1 - 0.45 * f)).toFixed(2),
            fill: PURPLES[(i + 3) % PURPLES.length],
            style: "--d:" + (delay + 0.15).toFixed(2) + "s"
          }, g);
        }
      }
    });

    // rose ribbon where the stems meet
    var bow = node("g", { class: "lv-bow" }, g);
    node("path", { d: "M60 136 c -10 -8 -18 -4 -16 2 c 2 6 10 4 16 -2z", fill: "#D9668F" }, bow);
    node("path", { d: "M60 136 c 10 -8 18 -4 16 2 c -2 6 -10 4 -16 -2z", fill: "#D9668F" }, bow);
    node("path", { d: "M58 137 l -8 16 l 5 -1 l 5 -14z M62 137 l 8 16 l -5 -1 l -5 -14z", fill: "#C2517B" }, bow);
    node("circle", { cx: 60, cy: 136.5, r: 3, fill: "#A83A64" }, bow);
    return svg;
  }

  function mount(el) {
    if (!el || el.firstChild) return;
    el.appendChild(draw());
    if (reduceMotion) el.classList.add("bloom", "still");
  }

  function bloom(el) {
    if (!el) return;
    mount(el);
    // next frame, so the closed state paints first and the bloom is visible
    requestAnimationFrame(function () { requestAnimationFrame(function () { el.classList.add("bloom"); }); });
  }

  window.Lavender = { mount: mount, bloom: bloom };

  // draw both bouquets closed straight away
  mount(document.getElementById("hero-lavender"));
  mount(document.getElementById("gate-lavender"));
  // no gate to open (or already opened this visit): bloom the hero one now
  if (document.documentElement.classList.contains("unlocked")) {
    setTimeout(function () { bloom(document.getElementById("hero-lavender")); }, 400);
  }
})();
