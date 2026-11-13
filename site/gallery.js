(function () {
  "use strict";

  var M = window.Memories;
  var cfg = M.cfg;
  var $ = function (id) { return document.getElementById(id); };
  var root = document.documentElement;
  var reduceMotion = window.matchMedia && window.matchMedia("(prefers-reduced-motion: reduce)").matches;

  var AUTOPLAY_MS = 5000;

  // ---------- Static text from config ----------
  $("title").textContent = cfg.TITLE || "Kiligram";
  $("subtitle").textContent = M.fill(cfg.SUBTITLE);
  $("closing").textContent = M.fill(cfg.CLOSING_MESSAGE);
  document.title = cfg.TITLE || document.title;

  var photos = [];

  // ---------- Login gate: the first screen ----------
  // Logged out: email + password. Logged in (remembered on this device):
  // "Hi, Langga" and a button. Either way the envelope opens after.
  // The <head> script adds .unlocked when this tab already opened it,
  // and .has-session when a saved login exists (so the right card shows at once).
  function isUnlocked() { return root.classList.contains("unlocked"); }
  var gate = $("gate"), stageEl = $("gate-stage");

  function showGateFor(user) {
    root.classList.toggle("has-session", !!user);
    if (user) {
      $("gate-open").focus({ preventScroll: true });
    } else {
      $("gate-email").focus({ preventScroll: true });
    }
  }

  function shake(el) {
    if (reduceMotion) return;
    el.classList.remove("shake");
    void el.offsetWidth; // restart the animation
    el.classList.add("shake");
  }

  // seal pops, flap opens, the letter rises, then the quote card takes over
  function openEnvelope() {
    if (document.activeElement) document.activeElement.blur();
    try { sessionStorage.setItem("unlocked", "1"); } catch (err) {}
    if (reduceMotion) { showLetter(); return; }
    stageEl.classList.add("opening");
    setTimeout(showLetter, 1900);
  }
  function showLetter() {
    stageEl.classList.add("read");
    $("gate-letter").focus({ preventScroll: true });
    window.Lavender.bloom($("gate-lavender"));
  }

  function relock() {
    try { sessionStorage.removeItem("unlocked"); } catch (err) {}
    root.classList.remove("unlocked", "has-session");
    gate.classList.remove("leaving");
    stageEl.classList.remove("opening", "read");
    $("gate-password").value = "";
    window.scrollTo(0, 0);
    showGateFor(null);
  }

  function startGate() {
    var client = M.client;

    $("gate-form").addEventListener("submit", function (e) {
      e.preventDefault();
      var form = e.target, btn = form.querySelector("button[type=submit]");
      if (!client) { $("gate-err").textContent = M.problem; return; }
      btn.disabled = true;
      $("gate-err").textContent = "";
      client.auth.signInWithPassword({
        email: $("gate-email").value.trim(),
        password: $("gate-password").value
      }).then(function (r) {
        if (r.error) throw r.error;
        $("gate-password").value = "";
        loadPhotos();
        openEnvelope();
      }).catch(function (err) {
        var msg = (err && err.message) || "";
        $("gate-err").textContent = /invalid/i.test(msg) ? "That email or password isn't right. Try again." :
          (msg || "Couldn't log in. Check your connection and try again.");
        $("gate-password").select();
        shake(form);
      }).then(function () { btn.disabled = false; });
    });

    $("gate-open").addEventListener("click", openEnvelope);
    $("gate-switch").addEventListener("click", function () {
      if (client) client.auth.signOut();
      showGateFor(null);
    });

    $("gate-enter").addEventListener("click", function () {
      var finish = function () {
        root.classList.add("unlocked");
        layout();       // the first photos develop now
        restartTimer();
        window.Story.onUnlock();
        window.Lavender.bloom($("hero-lavender"));
      };
      if (reduceMotion) { finish(); return; }
      gate.classList.add("leaving");
      setTimeout(finish, 700);
    });

    $("logout").addEventListener("click", function () {
      if (client) client.auth.signOut(); else relock();
    });

    if (!client) { $("gate-err").textContent = M.problem; return; }

    client.auth.getSession().then(function (r) {
      var user = r.data && r.data.session && r.data.session.user;
      if (!user) { relock(); return; }
      loadPhotos();
      if (!isUnlocked()) showGateFor(user);
    });
    // Logging out here or in another tab, or an expired login: start over from a
    // fresh page, so no photos or letters stay loaded behind the login screen.
    client.auth.onAuthStateChange(function (event) {
      if (event === "SIGNED_OUT") {
        try { sessionStorage.removeItem("unlocked"); } catch (err) {}
        location.reload();
      }
    });
  }

  // ---------- Coverflow ----------
  var cf = $("cf"), stage = $("cf-stage"), timeline = $("timeline"), playBtn = $("cf-play");
  var items = [], chips = [], cur = 0;
  var playing = !reduceMotion, keyboardFocus = false, timer = null;
  var mouse = null; // last pointer position over the stage
  var suppressClick = false;

  function tiltFor(p) {
    if (typeof p.tilt === "number") return p.tilt;
    var s = String(p.id), h = 0;
    for (var i = 0; i < s.length; i++) h = (h * 31 + s.charCodeAt(i)) | 0;
    return ((Math.abs(h) % 61) - 30) / 10; // -3.0 .. +3.0 degrees
  }

  function maxVisible() { return window.innerWidth < 700 ? 1 : 2; }

  // shortest signed distance from the current photo, wrapping round the ends
  function offset(i) {
    var n = photos.length, d = i - cur;
    if (d > n / 2) d -= n;
    if (d < -n / 2) d += n;
    return d;
  }

  function polaroid(p) {
    var fig = document.createElement("figure");
    fig.className = "polaroid";
    fig.style.setProperty("--tilt", tiltFor(p) + "deg");

    var frame = document.createElement("div");
    frame.className = "frame";
    var img = document.createElement("img");
    img.alt = p.caption || "Our photo";
    img.draggable = false;
    img.decoding = "async";
    img.addEventListener("load", function () { frame.classList.add("loaded"); });
    frame.appendChild(img);

    var cap = document.createElement("figcaption");
    cap.textContent = p.caption || "";

    fig.appendChild(frame);
    fig.appendChild(cap);
    return fig;
  }

  function ensureSrc(i) {
    var img = items[i].querySelector("img");
    if (!img.getAttribute("src")) img.src = M.publicUrl(photos[i].image_path);
  }

  function layout() {
    var max = maxVisible(), unlocked = isUnlocked();
    items.forEach(function (item, i) {
      var d = offset(i), a = Math.abs(d);
      item.style.setProperty("--d", d);
      item.style.setProperty("--a", a);
      item.style.zIndex = 20 - a;
      item.classList.toggle("is-active", d === 0);
      item.classList.toggle("is-hidden", a > max);
      item.tabIndex = d === 0 ? 0 : -1;
      item.setAttribute("aria-hidden", d === 0 ? "false" : "true");
      if (a <= max + 1) ensureSrc(i);
      if (unlocked && a <= max) item.classList.add("seen");
    });

    var p = photos[cur];
    setAmbient(M.publicUrl(p.image_path));
    window.Saver.prefetch(p);
    $("cf-when").textContent = M.whenFull(p);
    $("cf-count").textContent = photos.length > 1 ? (cur + 1) + " of " + photos.length : "";

    chips.forEach(function (c) {
      var on = cur >= c.from && cur <= c.to;
      c.el.classList.toggle("is-active", on);
      if (on) c.el.setAttribute("aria-current", "true"); else c.el.removeAttribute("aria-current");
    });
  }

  function go(i, fromUser) {
    if (!photos.length) return;
    cur = (i + photos.length) % photos.length;
    layout();
    if (fromUser) restartTimer();
  }

  // Consecutive photos that share a month label form one stop on the timeline.
  function buildTimeline() {
    timeline.innerHTML = "";
    chips = [];
    var last = null;
    photos.forEach(function (p, i) {
      var label = (p.month_label || "").trim();
      if (last && last.key === label.toLowerCase()) { last.to = i; return; }
      last = { key: label.toLowerCase(), label: label, from: i, to: i };
      if (label) chips.push(last);
    });
    chips.forEach(function (c) {
      var b = document.createElement("button");
      b.type = "button";
      b.className = "chip";
      b.textContent = M.monthName(c.label);
      b.addEventListener("click", function () { go(c.from, true); });
      timeline.appendChild(b);
      c.el = b;
    });
    timeline.classList.toggle("hidden", !chips.length);
  }

  function render() {
    $("gallery").setAttribute("aria-busy", "false");
    if (!photos.length) { showState("No photos yet. Check back soon!"); return; }

    stage.innerHTML = "";
    items = photos.map(function (p, i) {
      var item = document.createElement("div");
      item.className = "cf-item";
      item.setAttribute("role", "button");
      item.setAttribute("aria-label", "Open photo" + (p.caption ? ": " + p.caption : ""));
      item.appendChild(polaroid(p));
      var activate = function () {
        if (suppressClick) return;
        if (i === cur) openLightbox(i, item); else go(i, true);
      };
      item.addEventListener("click", activate);
      item.addEventListener("keydown", function (e) {
        if (e.key === "Enter" || e.key === " ") { e.preventDefault(); activate(); }
      });
      stage.appendChild(item);
      return item;
    });

    var single = photos.length < 2;
    cf.classList.toggle("single", single);
    if (single) playing = false;
    $("tray").classList.remove("hidden");
    $("views").classList.remove("hidden");
    window.Album.init({ photos: photos, openLightbox: openLightbox, toast: toast });
    window.Story.init({ photos: photos, openLightbox: openLightbox, unlocked: isUnlocked });
    buildTimeline();
    updatePlayButton();
    layout();
    restartTimer();
  }

  // ---------- Slideshow / All photos ----------
  var view = "slideshow";
  function setView(v) {
    view = v;
    document.querySelectorAll(".view-btn").forEach(function (b) {
      b.setAttribute("aria-pressed", b.getAttribute("data-view") === v ? "true" : "false");
    });
    cf.classList.toggle("hidden", v !== "slideshow");
    $("album").classList.toggle("hidden", v !== "album");
    if (v === "album") window.Album.show(); else window.Album.hide();
    restartTimer();
  }
  document.querySelectorAll(".view-btn").forEach(function (b) {
    b.addEventListener("click", function () { setView(b.getAttribute("data-view")); });
  });

  // ---------- Small message at the bottom ----------
  var toastT;
  function toast(msg) {
    var t = $("toast");
    t.textContent = msg;
    t.classList.add("show");
    clearTimeout(toastT);
    toastT = setTimeout(function () { t.classList.remove("show"); }, 3200);
  }

  // ---------- Saving one photo ----------
  function saveResult(r) {
    if (r === "shared") toast("Saved");
    else if (r === "downloaded") toast("Downloading the photo");
  }
  function saveFailed(err) {
    console.error(err);
    toast("Couldn't save that photo. Try again in a moment.");
  }
  $("cf-save").addEventListener("click", function () {
    if (photos[cur]) window.Saver.saveOne(photos[cur], cur).then(saveResult, saveFailed);
  });
  $("lb-save").addEventListener("click", function () {
    if (photos[lbCur]) window.Saver.saveOne(photos[lbCur], lbCur).then(saveResult, saveFailed);
  });

  function showState(text) {
    cf.classList.add("hidden");
    var s = $("state");
    s.textContent = text;
    s.classList.remove("hidden");
    $("gallery").setAttribute("aria-busy", "false");
  }

  // ---------- Ambient glow: the current photo, blurred behind the page ----------
  var ambLayers = document.querySelectorAll("#ambient .amb-layer"), ambOn = 0, ambUrl = null;
  function setAmbient(url) {
    if (url === ambUrl) return;
    ambUrl = url;
    var next = ambLayers[1 - ambOn];
    next.style.backgroundImage = "url(\"" + url + "\")";
    next.classList.add("on");
    $("ambient").classList.add("has-photo");
    ambLayers[ambOn].classList.remove("on");
    ambOn = 1 - ambOn;
  }
  window.Backdrop.addHearts($("ambient"), 9);

  // ---------- Autoplay ----------
  // Pauses only while the pointer rests on the centre photo, or while someone
  // is moving through the carousel with the keyboard. Mouse clicks don't pause it.
  function pointerOnCentre() {
    if (!mouse) return false;
    var el = document.elementFromPoint(mouse.x, mouse.y);
    return !!(el && el.closest && el.closest(".cf-item.is-active"));
  }
  function canAdvance() {
    return playing && view === "slideshow" && !keyboardFocus && !pointerOnCentre() && isUnlocked() && !document.hidden &&
      !lb.classList.contains("open") && photos.length > 1;
  }
  function restartTimer() {
    clearInterval(timer);
    timer = setInterval(function () { if (canAdvance()) go(cur + 1); }, AUTOPLAY_MS);
  }
  function updatePlayButton() {
    playBtn.querySelector("use").setAttribute("href", playing ? "#i-pause" : "#i-play");
    playBtn.querySelector("span").textContent = playing ? "Pause" : "Play";
    playBtn.setAttribute("aria-label", playing ? "Pause the slideshow" : "Play the slideshow");
    playBtn.classList.toggle("hidden", photos.length < 2);
  }
  playBtn.addEventListener("click", function () {
    playing = !playing;
    updatePlayButton();
    restartTimer();
  });

  stage.addEventListener("mousemove", function (e) { mouse = { x: e.clientX, y: e.clientY }; });
  stage.addEventListener("mouseleave", function () { mouse = null; });
  cf.addEventListener("focusin", function (e) {
    var visible = false;
    try { visible = e.target.matches(":focus-visible"); } catch (err) {}
    keyboardFocus = visible && e.target !== playBtn;
  });
  cf.addEventListener("focusout", function () { keyboardFocus = false; });

  $("cf-prev").addEventListener("click", function () { go(cur - 1, true); });
  $("cf-next").addEventListener("click", function () { go(cur + 1, true); });

  // swipe / drag
  var startX = null;
  stage.addEventListener("pointerdown", function (e) { startX = e.clientX; });
  stage.addEventListener("pointerup", function (e) {
    if (startX === null) return;
    var dx = e.clientX - startX;
    startX = null;
    if (Math.abs(dx) > 40 && photos.length > 1) {
      suppressClick = true;
      setTimeout(function () { suppressClick = false; }, 60);
      go(cur + (dx < 0 ? 1 : -1), true);
    }
  });
  stage.addEventListener("pointercancel", function () { startX = null; });

  var resizeT;
  window.addEventListener("resize", function () {
    clearTimeout(resizeT);
    resizeT = setTimeout(function () { if (items.length) layout(); }, 120);
  });

  // ---------- Load ----------
  // Photos are private: they load only once someone is logged in.
  // Until then the login screen shows a wall of blank polaroids.
  var photosRequested = false;
  function loadPhotos() {
    if (photosRequested || M.problem) return;
    photosRequested = true;
    M.fetchPhotos().then(function (data) {
      photos = data;
      if (!isUnlocked()) window.Backdrop.mount($("gate-backdrop"), photos, M.publicUrl);
      render();
    }).catch(function (err) {
      console.error(err);
      photosRequested = false;
      showState("Couldn't load the photos right now. Please refresh in a moment.");
    });
  }

  window.Backdrop.mount($("gate-backdrop"), [], null);
  if (M.problem) showState(M.problem);
  startGate();

  // ---------- Lightbox ----------
  var lb = $("lightbox"), lbImg = $("lb-img"), lbCap = $("lb-cap"), lbWhen = $("lb-when"), lbCount = $("lb-count");
  var page = $("page");
  var lbCur = 0, opener = null;

  function preload(i) {
    var p = photos[(i + photos.length) % photos.length];
    if (p) (new Image()).src = M.publicUrl(p.image_path);
  }

  function show(i) {
    if (!photos.length) return;
    lbCur = (i + photos.length) % photos.length;
    var p = photos[lbCur];
    lbImg.classList.add("loading");
    lbImg.src = M.publicUrl(p.image_path);
    lbImg.alt = p.caption || "Our photo";
    lbCap.textContent = p.caption || "";
    lbWhen.textContent = M.whenFull(p);
    lbCount.textContent = photos.length > 1 ? (lbCur + 1) + " of " + photos.length : "";
    if (photos.length > 1) { preload(lbCur + 1); preload(lbCur - 1); }
    window.Saver.prefetch(p);
  }
  lbImg.addEventListener("load", function () { lbImg.classList.remove("loading"); });
  lbImg.addEventListener("error", function () { lbImg.classList.remove("loading"); });

  function openLightbox(i, fromEl) {
    opener = fromEl || null;
    lb.classList.toggle("single", photos.length < 2);
    show(i);
    lb.classList.add("open");
    page.inert = true;
    document.body.style.overflow = "hidden";
    $("lb-close").focus();
  }
  function closeLightbox() {
    lb.classList.remove("open");
    page.inert = false;
    document.body.style.overflow = "";
    lbImg.removeAttribute("src");
    if (view === "slideshow" && opener && cf.contains(opener)) {
      go(lbCur, true); // the carousel follows where the viewer ended up
      var active = items[cur];
      if (active) { active.focus({ preventScroll: true }); return; }
    }
    if (opener) opener.focus({ preventScroll: true });
  }

  $("lb-close").addEventListener("click", closeLightbox);
  $("lb-prev").addEventListener("click", function () { show(lbCur - 1); });
  $("lb-next").addEventListener("click", function () { show(lbCur + 1); });
  lb.addEventListener("click", function (e) { if (e.target === lb) closeLightbox(); });

  document.addEventListener("keydown", function (e) {
    if (lb.classList.contains("open")) {
      if (e.key === "Escape") closeLightbox();
      else if (e.key === "ArrowLeft") show(lbCur - 1);
      else if (e.key === "ArrowRight") show(lbCur + 1);
      else if (e.key === "Tab") {
        // keep focus inside the viewer
        var btns = Array.prototype.filter.call(lb.querySelectorAll("button"), function (b) {
          return b.offsetParent !== null;
        });
        var at = btns.indexOf(document.activeElement);
        e.preventDefault();
        btns[(at + (e.shiftKey ? -1 : 1) + btns.length) % btns.length].focus();
      }
      return;
    }
    // arrow keys move the carousel unless someone is typing
    var t = e.target && e.target.tagName;
    if (!isUnlocked() || view !== "slideshow" || t === "INPUT" || t === "TEXTAREA") return;
    if (e.key === "ArrowLeft") go(cur - 1, true);
    else if (e.key === "ArrowRight") go(cur + 1, true);
  });

  // swipe inside the viewer on phones
  var lbX = null;
  lb.addEventListener("touchstart", function (e) { lbX = e.touches[0].clientX; }, { passive: true });
  lb.addEventListener("touchend", function (e) {
    if (lbX === null) return;
    var dx = e.changedTouches[0].clientX - lbX;
    lbX = null;
    if (Math.abs(dx) > 50 && photos.length > 1) show(dx < 0 ? lbCur + 1 : lbCur - 1);
  }, { passive: true });
})();
