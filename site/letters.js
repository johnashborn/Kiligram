// ------------------------------------------------------------------
// "Letters to each other": a private mailbox for the two of you.
// Both of you log in once (Supabase accounts); only signed-in users can
// read or write, and each of you can delete only your own letters.
// Needs the "letters" table from supabase-setup.sql.
// ------------------------------------------------------------------
(function () {
  "use strict";

  var M = window.Memories, client = M.client;
  var $ = function (id) { return document.getElementById(id); };
  var user = null, letters = [];

  function setMsg(el, text, kind) {
    el.textContent = text || "";
    el.className = "msg" + (kind ? " " + kind : "");
  }

  if (!client) return;

  function displayName(u) {
    var md = (u && u.user_metadata) || {};
    return (md.display_name || md.full_name || md.name || "").trim();
  }

  // ---------- who is signed in (the login screen at the top handles logging in) ----------
  function setUser(u) {
    var changed = (u && u.id) !== (user && user.id);
    user = u || null;
    $("mail-app").classList.toggle("hidden", !user);
    if (!user) { $("mail-list").innerHTML = ""; return; }
    var name = displayName(user);
    $("compose-label").textContent = "Write a letter, Langga";
    $("sign-as-row").classList.toggle("hidden", !!name);
    if (changed) load();
  }

  client.auth.getSession().then(function (r) { setUser(r.data && r.data.session && r.data.session.user); });
  client.auth.onAuthStateChange(function (_e, session) { setUser(session && session.user); });

  // ---------- "sign your letters as" (asked once, saved on the account) ----------
  (function addSignAs() {
    var row = document.createElement("div");
    row.className = "field sign-as hidden";
    row.id = "sign-as-row";
    row.innerHTML = '<label for="sign-as">Sign your letters as</label><input type="text" id="sign-as" maxlength="30" placeholder="your name or nickname">';
    $("compose").insertBefore(row, $("compose-body"));
  })();

  // ---------- reading ----------
  function seenKey() { return "letters-seen-" + (user ? user.id : ""); }
  function lastSeen() { try { return localStorage.getItem(seenKey()) || ""; } catch (e) { return ""; } }
  function markSeen() { try { localStorage.setItem(seenKey(), new Date().toISOString()); } catch (e) {} }

  function when(iso) {
    var d = new Date(iso);
    return d.toLocaleDateString(undefined, { month: "long", day: "numeric", year: "numeric" }) +
      ", " + d.toLocaleTimeString(undefined, { hour: "numeric", minute: "2-digit" });
  }

  function load() {
    client.from("letters").select("*").order("created_at", { ascending: false }).then(function (r) {
      if (r.error) {
        var missing = /letters/.test(r.error.message || "") && /(exist|find|schema cache)/i.test(r.error.message || "");
        setMsg($("compose-msg"), missing
          ? "Letters aren't set up yet. Run the letters part of supabase-setup.sql in Supabase."
          : (r.error.message || "Couldn't load the letters."), "bad");
        return;
      }
      letters = r.data || [];
      render();
    });
  }

  function render() {
    var list = $("mail-list"), seen = lastSeen();
    list.innerHTML = "";
    $("mail-empty").classList.toggle("hidden", letters.length > 0);
    letters.forEach(function (l) {
      var mine = l.author_id === user.id;
      var li = document.createElement("li");
      li.className = "mail-item" + (mine ? " mine" : " theirs");

      var head = document.createElement("div");
      head.className = "mail-head";
      var from = document.createElement("p");
      from.className = "mail-from";
      from.textContent = mine ? "From you" : "From " + (l.author_name || "your love");
      if (!mine && seen && l.created_at > seen) {
        var badge = document.createElement("span");
        badge.className = "mail-new";
        badge.textContent = "New";
        from.appendChild(badge);
      }
      var date = document.createElement("p");
      date.className = "mail-date";
      date.textContent = when(l.created_at);
      head.appendChild(from);
      head.appendChild(date);

      var body = document.createElement("div");
      body.className = "mail-body";
      body.textContent = l.body;

      li.appendChild(head);
      li.appendChild(body);

      if (mine) {
        var del = document.createElement("button");
        del.type = "button";
        del.className = "text-btn mail-del";
        del.textContent = "Delete";
        del.addEventListener("click", function () {
          if (!confirm("Delete this letter for good?")) return;
          del.disabled = true;
          client.from("letters").delete().eq("id", l.id).then(function (r) {
            if (r.error) { del.disabled = false; setMsg($("compose-msg"), r.error.message, "bad"); return; }
            load();
          });
        });
        li.appendChild(del);
      }
      list.appendChild(li);
    });
    markSeen();
  }

  // ---------- writing ----------
  $("compose").addEventListener("submit", function (e) {
    e.preventDefault();
    var body = $("compose-body").value.trim();
    if (!body) { setMsg($("compose-msg"), "Write something first.", "bad"); return; }

    var name = displayName(user);
    var newName = $("sign-as").value.trim();
    if (!name && !newName) { setMsg($("compose-msg"), "Add the name to sign your letters with.", "bad"); $("sign-as").focus(); return; }

    var btn = $("compose-send");
    btn.disabled = true;
    setMsg($("compose-msg"), "Sending...");

    var saveName = name ? Promise.resolve(name) : client.auth.updateUser({ data: { display_name: newName } }).then(function (r) {
      if (r.error) throw r.error;
      if (r.data && r.data.user) user = r.data.user;
      return newName;
    });

    saveName.then(function (signAs) {
      return client.from("letters").insert({ body: body, author_name: signAs });
    }).then(function (r) {
      if (r.error) throw r.error;
      $("compose-body").value = "";
      setMsg($("compose-msg"), "Letter sent.", "ok");
      setUser(user);
      load();
    }).catch(function (err) {
      setMsg($("compose-msg"), (err && err.message) || "Couldn't send. Check your connection and try again.", "bad");
    }).then(function () { btn.disabled = false; });
  });
})();
