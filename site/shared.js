// ------------------------------------------------------------------
// Shared helpers for the gallery (index.html) and the admin page.
// Loaded after config.js and the Supabase library, before page scripts.
// ------------------------------------------------------------------
(function () {
  "use strict";

  var cfg = window.APP_CONFIG || {};
  var bucket = cfg.BUCKET || "photos";

  var configured = !!(cfg.SUPABASE_URL && cfg.SUPABASE_ANON_KEY) &&
    cfg.SUPABASE_URL.indexOf("YOUR-") === -1 &&
    cfg.SUPABASE_ANON_KEY.indexOf("YOUR-") === -1;

  var problem = null;
  if (!configured) problem = "Add your Supabase URL and key in config.js (see README.md).";
  else if (!window.supabase) problem = "Could not load the photo library. Check your connection and refresh.";

  var client = problem ? null : window.supabase.createClient(cfg.SUPABASE_URL, cfg.SUPABASE_ANON_KEY);

  // ---------- Photo links ----------
  // The bucket is private: each photo is loaded through a signed link that
  // only works for a while, created for the logged-in user when photos load.
  var SIGNED_FOR = 60 * 60 * 12; // seconds (12 hours; reloading the page makes fresh links)
  var signed = {};

  function signAll(rows) {
    var paths = rows.map(function (r) { return r.image_path; }).filter(function (p) { return p && !signed[p]; });
    if (!paths.length) return Promise.resolve(rows);
    return client.storage.from(bucket).createSignedUrls(paths, SIGNED_FOR).then(function (res) {
      if (res.error) throw res.error;
      (res.data || []).forEach(function (d) {
        var url = d.signedUrl || d.signedURL;
        if (url && d.path) signed[d.path] = url;
      });
      return rows;
    });
  }

  // the link for one photo ("" until its link has been made)
  function publicUrl(path) {
    return signed[path] || "";
  }

  // "2026-03-04" -> "March 4, 2026" (in the viewer's language)
  function formatDate(iso) {
    if (!iso) return "";
    var d = new Date(iso + "T00:00:00");
    if (isNaN(d)) return "";
    return d.toLocaleDateString(undefined, { month: "long", day: "numeric", year: "numeric" });
  }

  // ---------- Time together ----------
  function startDate() {
    var d = new Date((cfg.START_DATE || "") + "T00:00:00");
    return isNaN(d) ? null : d;
  }
  // the start date plus n months (day clamped, so Jan 31 + 1 month = Feb 28)
  function addMonths(d, n) {
    var y = d.getFullYear(), m = d.getMonth() + n;
    var last = new Date(y, m + 1, 0).getDate();
    return new Date(y, m, Math.min(d.getDate(), last), d.getHours(), d.getMinutes(), d.getSeconds());
  }
  // whole months since the start date
  function monthsTogether(now) {
    var s = startDate();
    if (!s) return 0;
    now = now || new Date();
    var n = (now.getFullYear() - s.getFullYear()) * 12 + (now.getMonth() - s.getMonth());
    if (addMonths(s, n) > now) n--;
    return Math.max(0, n);
  }
  // replace {months} in config text
  function fill(text) {
    return String(text || "").replace(/\{months\}/g, String(monthsTogether()));
  }

  // Month label as shown to people: a bare number like "2" reads as "Month 2".
  function monthName(label) {
    var s = (label || "").trim();
    return /^\d+$/.test(s) ? "Month " + s : s;
  }

  // Short label: the month label if there is one, otherwise the date.
  function whenLabel(p) {
    return monthName(p.month_label) || formatDate(p.taken_on);
  }

  // Full label: both, when both exist.
  function whenFull(p) {
    return [monthName(p.month_label), formatDate(p.taken_on)].filter(Boolean).join(", ");
  }

  // Oldest first, undated photos last; resolves to an array or rejects.
  function fetchPhotos() {
    return client.from("photos")
      .select("*")
      .order("taken_on", { ascending: true, nullsFirst: false })
      .order("created_at", { ascending: true })
      .then(function (res) {
        if (res.error) throw res.error;
        return signAll(res.data || []);
      });
  }

  window.Memories = {
    cfg: cfg,
    bucket: bucket,
    client: client,
    problem: problem,
    publicUrl: publicUrl,
    formatDate: formatDate,
    startDate: startDate,
    addMonths: addMonths,
    monthsTogether: monthsTogether,
    fill: fill,
    monthName: monthName,
    whenLabel: whenLabel,
    whenFull: whenFull,
    fetchPhotos: fetchPhotos
  };
})();
