// ------------------------------------------------------------------
// The story half of the page:
//   - live "together for ..." counter in the hero
//   - "Our story": a timeline that draws itself as she scrolls
//   - "Reasons I love you": tap-to-flip cards
//   - "A letter for you": types itself out when she reaches it
// Story.init({ photos, openLightbox }) builds the timeline once photos load.
// ------------------------------------------------------------------
(function () {
  "use strict";

  var M = window.Memories, cfg = M.cfg;
  var $ = function (id) { return document.getElementById(id); };
  var root = document.documentElement;
  var reduceMotion = window.matchMedia && window.matchMedia("(prefers-reduced-motion: reduce)").matches;
  function unlocked() { return root.classList.contains("unlocked"); }
  var Story = window.Story = {};

  function ordinal(n) {
    var s = ["th", "st", "nd", "rd"], v = n % 100;
    return n + (s[(v - 20) % 10] || s[v] || s[0]);
  }

  // ================= Together counter =================
  function startCounter() {
    var start = M.startDate();
    if (!start) return;
    var box = $("together-time");
    var units = [["day", 864e5], ["hour", 36e5], ["minute", 6e4], ["second", 1e3]];
    var cells = units.map(function (u, i) {
      var span = document.createElement("span");
      span.className = "t-unit";
      var b = document.createElement("b");
      var w = document.createElement("span");
      span.appendChild(b);
      span.appendChild(w);
      box.appendChild(span);
      if (i < units.length - 2) box.appendChild(document.createTextNode(", "));
      else if (i === units.length - 2) box.appendChild(document.createTextNode(" and "));
      return { b: b, w: w, unit: u };
    });

    function tick() {
      var ms = Math.max(0, Date.now() - start.getTime());
      var vals = [Math.floor(ms / 864e5), Math.floor(ms / 36e5) % 24, Math.floor(ms / 6e4) % 60, Math.floor(ms / 1e3) % 60];
      cells.forEach(function (c, i) {
        var v = vals[i];
        c.b.textContent = i === 0 ? v.toLocaleString() : v;
        c.w.textContent = " " + c.unit[0] + (v === 1 ? "" : "s");
      });
    }
    tick();
    setInterval(tick, 1000);

    // next monthsary
    var n = M.monthsTogether();
    var today = new Date(); today.setHours(0, 0, 0, 0);
    var thisOne = M.addMonths(start, n);
    var next = M.addMonths(start, n + 1);
    var msg;
    if (n > 0 && thisOne.getTime() === today.getTime()) msg = "Happy " + ordinal(n) + " monthsary, today!";
    else {
      var days = Math.round((next - today) / 864e5);
      msg = "Our " + ordinal(n + 1) + " monthsary is " + (days === 1 ? "tomorrow" : "in " + days + " days");
    }
    $("together-next").textContent = msg;
    $("together").classList.remove("hidden");
  }

  // ================= Reasons =================
  function renderReasons() {
    var list = cfg.REASONS || [];
    if (!list.length) return;
    var grid = $("reason-grid");
    list.forEach(function (text, i) {
      var li = document.createElement("li");
      var b = document.createElement("button");
      b.type = "button";
      b.className = "reason";
      b.style.setProperty("--tilt", ((i * 5) % 7 - 3) * 0.6 + "deg");
      b.setAttribute("aria-pressed", "false");
      b.setAttribute("aria-label", "Reason " + (i + 1) + ". Tap to read.");
      b.innerHTML =
        '<span class="r-inner">' +
          '<span class="r-face r-front"><svg viewBox="0 0 32 32" aria-hidden="true"><use href="#i-heart"/></svg><span class="r-because">because…</span></span>' +
          '<span class="r-face r-back"></span>' +
        "</span>";
      b.querySelector(".r-back").textContent = text;
      b.addEventListener("click", function () {
        var on = b.getAttribute("aria-pressed") !== "true";
        b.setAttribute("aria-pressed", on ? "true" : "false");
        b.setAttribute("aria-label", on ? text : "Reason " + (i + 1) + ". Tap to read.");
      });
      li.appendChild(b);
      grid.appendChild(li);
    });
    $("reasons").classList.remove("hidden");
  }

  // ================= Letter =================
  var letterTyped = false, letterSkip = null;
  function renderLetter() {
    var L = cfg.LETTER;
    if (!L || !(L.paragraphs || []).length) return;
    var parts = [L.greeting].concat(L.paragraphs, [L.signoff]).filter(Boolean).map(M.fill);
    var box = $("letter-text");

    // full text for screen readers; the typed copy is decoration
    var sr = document.createElement("div");
    sr.className = "sr-only";
    sr.textContent = parts.join(" ") + " " + (L.signature || "");
    box.appendChild(sr);

    var shown = document.createElement("div");
    shown.setAttribute("aria-hidden", "true");
    var ps = parts.map(function (t, i) {
      var p = document.createElement("p");
      if (i === 0) p.className = "letter-greeting";
      if (i === parts.length - 1 && L.signoff) p.className = "letter-signoff";
      shown.appendChild(p);
      return { el: p, text: t };
    });
    box.appendChild(shown);
    var sign = $("letter-sign");
    sign.setAttribute("aria-hidden", "true");
    $("letter-section").classList.remove("hidden");

    function showAll() {
      ps.forEach(function (x) { x.el.textContent = x.text; });
      sign.textContent = L.signature || "";
      sign.classList.add("in");
      $("letter-paper").classList.add("done");
      letterTyped = true;
    }
    if (reduceMotion) { showAll(); return; }

    function type() {
      if (letterTyped) return;
      letterTyped = true;
      var pi = 0, ci = 0, stop = false;
      letterSkip = function () { stop = true; showAll(); };
      $("letter-paper").classList.add("typing");
      (function step() {
        if (stop) return;
        var cur = ps[pi];
        if (!cur) {
          $("letter-paper").classList.remove("typing");
          sign.textContent = L.signature || "";
          sign.classList.add("in");
          $("letter-paper").classList.add("done");
          return;
        }
        ci += 2;
        cur.el.textContent = cur.text.slice(0, ci);
        if (ci >= cur.text.length) { pi++; ci = 0; setTimeout(step, 380); }
        else setTimeout(step, 24);
      })();
    }
    $("letter-paper").addEventListener("click", function () { if (letterSkip) letterSkip(); });

    if ("IntersectionObserver" in window) {
      var io = new IntersectionObserver(function (en) {
        if (en[0].isIntersecting && unlocked()) { io.disconnect(); type(); }
      }, { threshold: 0.35 });
      io.observe($("letter-paper"));
      Story._retryLetter = function () { io.disconnect(); io.observe($("letter-paper")); };
    } else showAll();
  }

  // ================= Our story timeline =================
  var opts = {};
  function monthKey(iso) { return iso ? iso.slice(0, 7) : "undated"; }
  function monthTitle(key) {
    if (key === "undated") return "And so many more";
    var d = new Date(key + "-01T00:00:00");
    return d.toLocaleDateString(undefined, { month: "long", year: "numeric" });
  }

  function renderTimeline(photos) {
    var groups = [], byKey = {};
    photos.forEach(function (p, i) {
      var k = monthKey(p.taken_on);
      if (!byKey[k]) { byKey[k] = { key: k, items: [] }; groups.push(byKey[k]); }
      byKey[k].items.push(i);
    });
    if (!groups.length) return;
    // undated memories go last
    groups.sort(function (a, b) {
      if (a.key === "undated") return 1;
      if (b.key === "undated") return -1;
      return a.key < b.key ? -1 : 1;
    });

    var list = $("story-list");
    list.innerHTML = "";
    groups.forEach(function (g) {
      var li = document.createElement("li");
      li.className = "story-node";

      var dot = document.createElement("span");
      dot.className = "node-dot";
      dot.setAttribute("aria-hidden", "true");
      dot.innerHTML = '<svg viewBox="0 0 32 32"><use href="#i-heart"/></svg>';

      var card = document.createElement("div");
      card.className = "node-card";

      var head = document.createElement("div");
      head.className = "node-head";
      var first = photos[g.items[0]];
      if (g.key !== "undated" && M.startDate()) {
        var tag = document.createElement("p");
        tag.className = "node-tag";
        var n = M.monthsTogether(new Date(first.taken_on + "T12:00:00")) + 1;
        tag.textContent = n === 1 ? "Our first month" : "Month " + n;
        head.appendChild(tag);
      }
      var h3 = document.createElement("h3");
      h3.textContent = monthTitle(g.key);
      head.appendChild(h3);

      var fan = document.createElement("div");
      fan.className = "node-fan";
      var show = g.items.slice(0, 3);
      show.forEach(function (i, k) {
        var p = photos[i];
        var b = document.createElement("button");
        b.type = "button";
        b.className = "fan-photo";
        b.style.setProperty("--k", k);
        b.style.setProperty("--n", show.length);
        b.setAttribute("aria-label", "Open photo" + (p.caption ? ": " + p.caption : ""));
        var img = document.createElement("img");
        img.loading = "lazy";
        img.decoding = "async";
        img.alt = "";
        img.src = M.publicUrl(p.image_path);
        b.appendChild(img);
        b.addEventListener("click", function () { opts.openLightbox(i, b); });
        fan.appendChild(b);
      });
      if (g.items.length > 3) {
        var more = document.createElement("span");
        more.className = "fan-more";
        more.textContent = "+" + (g.items.length - 3);
        fan.appendChild(more);
      }

      var caps = document.createElement("ul");
      caps.className = "node-caps";
      g.items.forEach(function (i) {
        var c = photos[i].caption;
        if (!c) return;
        var item = document.createElement("li");
        item.textContent = c;
        caps.appendChild(item);
      });

      card.appendChild(head);
      card.appendChild(fan);
      if (caps.children.length) card.appendChild(caps);
      li.appendChild(dot);
      li.appendChild(card);
      list.appendChild(li);
    });
    $("story").classList.remove("hidden");
    watchTimeline();
  }

  // the rail fills and each month lights up as she scrolls
  function watchTimeline() {
    var line = $("story-line"), fill = $("story-fill");
    var nodes = Array.prototype.slice.call(document.querySelectorAll(".story-node"));
    if (reduceMotion || !("IntersectionObserver" in window)) {
      fill.style.transform = "scaleY(1)";
      nodes.forEach(function (n) { n.classList.add("in"); });
      return;
    }
    var io = new IntersectionObserver(function (entries) {
      entries.forEach(function (en) {
        if (en.isIntersecting) { en.target.classList.add("in"); io.unobserve(en.target); }
      });
    }, { threshold: 0.25, rootMargin: "0px 0px -10% 0px" });
    nodes.forEach(function (n) { io.observe(n); });

    var ticking = false;
    function update() {
      ticking = false;
      var r = line.getBoundingClientRect();
      var p = (window.innerHeight * 0.62 - r.top) / r.height;
      fill.style.transform = "scaleY(" + Math.max(0, Math.min(1, p)) + ")";
    }
    window.addEventListener("scroll", function () {
      if (!ticking) { ticking = true; requestAnimationFrame(update); }
    }, { passive: true });
    window.addEventListener("resize", update);
    update();
  }

  // ================= start =================
  startCounter();
  renderReasons();
  renderLetter();

  Story.init = function (o) { opts = o; renderTimeline(o.photos); };
  Story.onUnlock = function () { if (Story._retryLetter && !letterTyped) Story._retryLetter(); };
})();
