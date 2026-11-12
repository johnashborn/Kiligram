// ------------------------------------------------------------------
// Saving photos: one at a time, or several at once.
//   Phones that can share files (iPhone, most Android) get the share
//   sheet, so photos go straight into the Photos app.
//   Everything else gets a normal download (one photo) or a .zip.
// Usage: Saver.saveOne(photo) / Saver.saveMany(photos, onProgress)
// ------------------------------------------------------------------
(function () {
  "use strict";

  var M = window.Memories;
  var JSZIP_URL = "https://cdnjs.cloudflare.com/ajax/libs/jszip/3.10.1/jszip.min.js";
  var ZIP_NAME = "our-little-memories.zip";

  var isPhone = window.matchMedia && window.matchMedia("(pointer: coarse)").matches;
  var canShareFiles = (function () {
    try {
      return isPhone && !!navigator.canShare &&
        navigator.canShare({ files: [new File([""], "x.jpg", { type: "image/jpeg" })] });
    } catch (e) { return false; }
  })();

  // "2026-03-14 2nd dateee.jpg"; undated photos keep their place number
  function fileName(p, i) {
    var cap = (p.caption || "").replace(/[\\/:*?"<>|#%\u0000-\u001f]+/g, "").replace(/\s+/g, " ").trim().slice(0, 50);
    var head = p.taken_on || "photo " + String(i + 1).padStart(2, "0");
    return (cap ? head + " " + cap : head) + ".jpg";
  }

  function uniqueNames(list) {
    var seen = {};
    return list.map(function (p, i) {
      var n = fileName(p, typeof p._index === "number" ? p._index : i);
      if (seen[n]) { seen[n]++; n = n.replace(/\.jpg$/, " (" + seen[n] + ").jpg"); } else seen[n] = 1;
      return n;
    });
  }

  // ---------- blobs, cached so a phone can share instantly on tap ----------
  var cache = {};
  function getBlob(p) {
    var key = p.image_path;
    if (!cache[key]) {
      cache[key] = fetch(M.publicUrl(p.image_path)).then(function (r) {
        if (!r.ok) throw new Error("HTTP " + r.status);
        return r.blob();
      }).catch(function (err) { delete cache[key]; throw err; });
      cache[key].then(function (b) { cache[key].ready = b; }, function () {});
    }
    return cache[key];
  }
  function readyBlob(p) { var c = cache[p.image_path]; return c && c.ready; }

  function prefetch(p) { if (canShareFiles && p) getBlob(p).catch(function () {}); }

  function toFile(blob, name) { return new File([blob], name, { type: blob.type || "image/jpeg" }); }

  function triggerDownload(href, name) {
    var a = document.createElement("a");
    a.href = href;
    a.download = name;
    a.rel = "noopener";
    document.body.appendChild(a);
    a.click();
    a.remove();
  }

  function share(files) {
    return navigator.share({ files: files }).then(function () { return "shared"; }, function (err) {
      if (err && err.name === "AbortError") return "cancelled";
      throw err;
    });
  }

  // ---------- one photo ----------
  // Must be called straight from a tap: the share sheet needs the tap.
  function saveOne(p, index) {
    var name = fileName(p, index || 0);
    var blob = readyBlob(p);
    if (canShareFiles && blob) return share([toFile(blob, name)]);
    // fetch the photo through its signed link and save it under a readable name
    return getBlob(p).then(function (b) {
      var url = URL.createObjectURL(b);
      triggerDownload(url, name);
      setTimeout(function () { URL.revokeObjectURL(url); }, 30000);
      return "downloaded";
    });
  }

  // ---------- several photos ----------
  function fetchAll(list, onProgress) {
    var done = 0;
    return Promise.all(list.map(function (p) {
      return getBlob(p).then(function (b) { done++; if (onProgress) onProgress(done, list.length); return b; });
    }));
  }

  var jszipLoading = null;
  function loadJSZip() {
    if (window.JSZip) return Promise.resolve(window.JSZip);
    if (!jszipLoading) {
      jszipLoading = new Promise(function (resolve, reject) {
        var s = document.createElement("script");
        s.src = JSZIP_URL;
        s.onload = function () { resolve(window.JSZip); };
        s.onerror = function () { jszipLoading = null; reject(new Error("Couldn't load the zip tool.")); };
        document.head.appendChild(s);
      });
    }
    return jszipLoading;
  }

  // Step 1 for phones: get every photo ready, so the share can happen on the next tap.
  function prepareMany(list, onProgress) { return fetchAll(list, onProgress); }

  // Phones: share sheet (photos must be prepared first). Others: one .zip.
  function shareMany(list) {
    var names = uniqueNames(list);
    var files = list.map(function (p, i) { return toFile(readyBlob(p), names[i]); });
    return share(files);
  }

  function zipMany(list, onProgress) {
    var names = uniqueNames(list);
    return Promise.all([loadJSZip(), fetchAll(list, onProgress)]).then(function (res) {
      var zip = new res[0]();
      res[1].forEach(function (b, i) { zip.file(names[i], b); });
      return zip.generateAsync({ type: "blob" });
    }).then(function (blob) {
      var url = URL.createObjectURL(blob);
      triggerDownload(url, ZIP_NAME);
      setTimeout(function () { URL.revokeObjectURL(url); }, 30000);
      return "downloaded";
    });
  }

  window.Saver = {
    usesShare: canShareFiles,
    ZIP_NAME: ZIP_NAME,
    prefetch: prefetch,
    saveOne: saveOne,
    prepareMany: prepareMany,
    shareMany: shareMany,
    zipMany: zipMany
  };
})();
