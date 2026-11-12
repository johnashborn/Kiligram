(function () {
  "use strict";

  var M = window.Memories;
  var $ = function (id) { return document.getElementById(id); };

  var MAX_SIDE = 1600;      // longest side after compression, in px
  var JPEG_QUALITY = 0.85;

  function setMsg(el, text, kind) {
    el.textContent = text || "";
    el.className = "msg" + (kind ? " " + kind : "");
  }

  if (M.problem) {
    window.Backdrop.mount($("login-backdrop"), [], null);
    setMsg($("login-msg"), M.problem, "bad");
    $("login-form").querySelector("button").disabled = true;
    return;
  }

  var client = M.client;
  var bucket = M.bucket;
  var photos = [];
  var editing = null;   // the photo row being edited, or null
  var previewUrl = null;

  // ---------- Auth ----------
  function showApp(signedIn) {
    $("login-panel").classList.toggle("hidden", signedIn);
    $("app").classList.toggle("hidden", !signedIn);
    if (signedIn) loadPhotos(); else showLoginBackdrop();
  }

  // Photos are private, so before login the wall shows blank polaroids.
  function showLoginBackdrop() {
    window.Backdrop.mount($("login-backdrop"), [], null);
  }

  client.auth.getSession().then(function (r) {
    showApp(!!(r.data && r.data.session));
  });
  client.auth.onAuthStateChange(function (event) {
    // start over from a fresh page so nothing stays loaded behind the login screen
    if (event === "SIGNED_OUT") location.reload();
  });

  $("login-form").addEventListener("submit", function (e) {
    e.preventDefault();
    var btn = e.target.querySelector("button");
    btn.disabled = true;
    setMsg($("login-msg"), "Logging in...");
    client.auth.signInWithPassword({
      email: $("email").value.trim(),
      password: $("password").value
    }).then(function (r) {
      if (r.error) throw r.error;
      setMsg($("login-msg"), "");
      $("password").value = "";
      showApp(true);
    }).catch(function (err) {
      setMsg($("login-msg"), (err && err.message) || "Couldn't log in. Check your connection.", "bad");
    }).then(function () {
      btn.disabled = false;
    });
  });

  $("logout").addEventListener("click", function () {
    client.auth.signOut().then(function () { location.reload(); });
  });

  // ---------- Preview ----------
  function updatePreview() {
    $("prev-cap").textContent = $("caption").value.trim() || "Your caption here";
    $("prev-when").textContent = M.whenLabel({ month_label: $("month").value, taken_on: $("taken").value });
    var deg = $("tilt").value;
    $("tilt-val").textContent = deg;
    $("preview").style.setProperty("--tilt", deg + "deg");
  }
  ["caption", "month", "taken", "tilt"].forEach(function (id) {
    $(id).addEventListener("input", updatePreview);
  });

  $("shuffle").addEventListener("click", function () {
    var v = (Math.floor(Math.random() * 17) - 8) / 2; // -4 .. 4 in 0.5 steps
    $("tilt").value = v;
    updatePreview();
  });

  function setPreviewImage(src) {
    if (src) $("prev-img").src = src; else $("prev-img").removeAttribute("src");
  }

  // ---------- File picker + drag and drop ----------
  var drop = $("drop");
  var DEFAULT_FILE_TEXT = "Choose a photo";

  function onFileChosen() {
    var f = $("file").files && $("file").files[0];
    if (previewUrl) { URL.revokeObjectURL(previewUrl); previewUrl = null; }
    if (f) {
      previewUrl = URL.createObjectURL(f);
      setPreviewImage(previewUrl);
      $("file-name").textContent = f.name;
      drop.classList.add("has-file");
    } else {
      setPreviewImage(editing ? M.publicUrl(editing.image_path) : null);
      $("file-name").textContent = editing ? "Replace the photo (optional)" : DEFAULT_FILE_TEXT;
      drop.classList.remove("has-file");
    }
  }
  $("file").addEventListener("change", onFileChosen);

  ["dragenter", "dragover"].forEach(function (t) {
    drop.addEventListener(t, function (e) { e.preventDefault(); drop.classList.add("over"); });
  });
  ["dragleave", "drop"].forEach(function (t) {
    drop.addEventListener(t, function () { drop.classList.remove("over"); });
  });
  drop.addEventListener("drop", function (e) {
    e.preventDefault();
    var files = e.dataTransfer && e.dataTransfer.files;
    if (!files || !files.length) return;
    if (!/^image\//.test(files[0].type)) {
      setMsg($("form-msg"), "That file isn't an image. Drop a JPG, PNG or WebP.", "bad");
      return;
    }
    $("file").files = files;
    setMsg($("form-msg"), "");
    onFileChosen();
  });

  // ---------- Image compression ----------
  function compress(file) {
    return new Promise(function (resolve, reject) {
      var url = URL.createObjectURL(file);
      var img = new Image();
      img.onload = function () {
        var w = img.naturalWidth, h = img.naturalHeight;
        var scale = Math.min(1, MAX_SIDE / Math.max(w, h));
        var cw = Math.round(w * scale), ch = Math.round(h * scale);
        var canvas = document.createElement("canvas");
        canvas.width = cw; canvas.height = ch;
        var ctx = canvas.getContext("2d");
        ctx.fillStyle = "#ffffff";
        ctx.fillRect(0, 0, cw, ch);
        ctx.drawImage(img, 0, 0, cw, ch);
        URL.revokeObjectURL(url);
        canvas.toBlob(function (blob) {
          if (blob) resolve(blob); else reject(new Error("Could not compress the image."));
        }, "image/jpeg", JPEG_QUALITY);
      };
      img.onerror = function () {
        URL.revokeObjectURL(url);
        reject(new Error("That file couldn't be read as an image. HEIC photos from iPhone need converting to JPG first."));
      };
      img.src = url;
    });
  }

  function newPath() {
    var id = (window.crypto && crypto.randomUUID) ? crypto.randomUUID()
      : String(Date.now()) + "-" + Math.random().toString(16).slice(2);
    return id + ".jpg";
  }

  function uploadBlob(blob) {
    var path = newPath();
    return client.storage.from(bucket)
      .upload(path, blob, { contentType: "image/jpeg", cacheControl: "31536000", upsert: false })
      .then(function (r) {
        if (r.error) throw r.error;
        return path;
      });
  }

  function removeFile(path) {
    if (!path) return Promise.resolve();
    return client.storage.from(bucket).remove([path]).catch(function () {});
  }

  // ---------- Form: add / edit ----------
  function markEditing() {
    var items = $("items").children;
    for (var i = 0; i < items.length; i++) {
      items[i].classList.toggle("editing", !!editing && items[i].dataset.id === String(editing.id));
    }
  }

  function resetForm() {
    editing = null;
    $("photo-form").reset();
    $("tilt").value = 0;
    $("form-title").textContent = "Add a photo";
    $("save").textContent = "Add photo";
    $("cancel-edit").classList.add("hidden");
    onFileChosen();
    updatePreview();
    markEditing();
  }

  function startEdit(p) {
    editing = p;
    $("form-title").textContent = "Edit photo";
    $("save").textContent = "Save changes";
    $("cancel-edit").classList.remove("hidden");
    $("file").value = "";
    $("caption").value = p.caption || "";
    $("month").value = p.month_label || "";
    $("taken").value = p.taken_on || "";
    $("tilt").value = typeof p.tilt === "number" ? p.tilt : 0;
    onFileChosen();
    updatePreview();
    markEditing();
    setMsg($("form-msg"), "");
    $("form-panel").scrollIntoView({ behavior: "smooth", block: "start" });
    $("caption").focus({ preventScroll: true });
  }
  $("cancel-edit").addEventListener("click", function () { resetForm(); setMsg($("form-msg"), ""); });

  $("photo-form").addEventListener("submit", function (e) {
    e.preventDefault();
    var file = $("file").files && $("file").files[0];
    if (!editing && !file) { setMsg($("form-msg"), "Choose a photo first.", "bad"); return; }

    var saveBtn = $("save");
    var label = saveBtn.textContent;
    var wasEditing = !!editing;
    saveBtn.disabled = true;
    saveBtn.textContent = file ? "Uploading..." : "Saving...";
    setMsg($("form-msg"), "");

    var fields = {
      caption: $("caption").value.trim(),
      month_label: $("month").value.trim() || null,
      taken_on: $("taken").value || null,
      tilt: parseFloat($("tilt").value) || 0
    };

    var target = editing;
    var oldPath = target ? target.image_path : null;
    var newUploaded = null;
    var committed = false;   // true once the database row points at the new image

    var step = file
      ? compress(file).then(uploadBlob).then(function (path) { newUploaded = path; return path; })
      : Promise.resolve(oldPath);

    step.then(function (path) {
      fields.image_path = path;
      return target
        ? client.from("photos").update(fields).eq("id", target.id)
        : client.from("photos").insert(fields);
    }).then(function (r) {
      if (r.error) throw r.error;
      committed = true;
      // remove the replaced image only after the row points at the new one
      if (target && newUploaded && oldPath) return removeFile(oldPath);
    }).then(function () {
      resetForm();
      setMsg($("form-msg"), wasEditing ? "Changes saved." : "Photo added. It's on the gallery now.", "ok");
      loadPhotos();
    }).catch(function (err) {
      // don't leave an orphaned upload behind if the row failed
      if (newUploaded && !committed) removeFile(newUploaded);
      setMsg($("form-msg"), (err && err.message) || "Couldn't save. Check your connection and try again.", "bad");
      saveBtn.textContent = label;
    }).then(function () {
      saveBtn.disabled = false;
    });
  });

  // ---------- List ----------
  function loadPhotos(okMessage) {
    M.fetchPhotos().then(function (data) {
      setMsg($("list-msg"), okMessage || "", okMessage ? "ok" : "");
      photos = data;
      renderList();
    }).catch(function (err) {
      setMsg($("list-msg"), (err && err.message) || "Couldn't load your photos.", "bad");
    });
  }

  function fillMonthOptions() {
    var seen = {}, list = $("month-options");
    list.innerHTML = "";
    photos.forEach(function (p) {
      var m = (p.month_label || "").trim();
      if (m && !seen[m]) {
        seen[m] = true;
        var o = document.createElement("option");
        o.value = m;
        list.appendChild(o);
      }
    });
  }

  function renderList() {
    var box = $("items");
    box.innerHTML = "";
    $("count").textContent = photos.length;
    fillMonthOptions();
    if (!photos.length) {
      setMsg($("list-msg"), "Nothing here yet. Add your first photo above.");
      return;
    }
    photos.forEach(function (p) {
      var item = document.createElement("div");
      item.className = "item";
      item.dataset.id = p.id;

      var img = document.createElement("img");
      img.loading = "lazy";
      img.src = M.publicUrl(p.image_path);
      img.alt = "";

      var meta = document.createElement("div");
      meta.className = "meta";
      meta.textContent = M.whenFull(p) || "No date";

      var cap = document.createElement("div");
      cap.className = "cap-text";
      cap.textContent = p.caption || "No caption";
      if (!p.caption) cap.classList.add("empty");

      var actions = document.createElement("div");
      actions.className = "actions";

      var edit = document.createElement("button");
      edit.className = "btn ghost small";
      edit.type = "button";
      edit.textContent = "Edit";
      edit.setAttribute("aria-label", "Edit " + (p.caption || "photo"));
      edit.addEventListener("click", function () { startEdit(p); });

      var del = document.createElement("button");
      del.className = "btn danger small";
      del.type = "button";
      del.textContent = "Delete";
      del.setAttribute("aria-label", "Delete " + (p.caption || "photo"));
      del.addEventListener("click", function () {
        if (!confirm("Delete this photo for good? This can't be undone.")) return;
        del.disabled = true;
        client.from("photos").delete().eq("id", p.id).then(function (r) {
          if (r.error) throw r.error;
          return removeFile(p.image_path);
        }).then(function () {
          if (editing && editing.id === p.id) resetForm();
          loadPhotos("Photo deleted.");
        }).catch(function (err) {
          del.disabled = false;
          setMsg($("list-msg"), (err && err.message) || "Couldn't delete. Try again.", "bad");
        });
      });

      actions.appendChild(edit);
      actions.appendChild(del);
      item.appendChild(img);
      item.appendChild(meta);
      item.appendChild(cap);
      item.appendChild(actions);
      box.appendChild(item);
    });
    markEditing();
  }

  updatePreview();
})();
