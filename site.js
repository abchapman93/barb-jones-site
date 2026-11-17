// Fills the page from data.js and runs the draft-options panel (choices live in the URL).
(function () {
  const $ = (id) => document.getElementById(id);
  const esc = (s) => String(s).replace(/[&<>"]/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" }[c]));
  const P = PROFILE;

  // ---- content
  document.title = P.name;
  $("kicker").textContent = P.kicker;
  $("name").textContent = P.name;
  $("lede").textContent = P.lede;
  $("roles").innerHTML = P.roles.map(esc).join("<br>");
  $("links").innerHTML = P.links.map((l) => `<a href="${esc(l.url)}" target="_blank" rel="noopener">${esc(l.label)}</a>`).join("");
  $("stats").innerHTML = P.stats.map((s) => `<div class="stat"><b>${esc(s.value)}</b><span>${esc(s.label)}</span></div>`).join("");
  $("bio").innerHTML = P.bio.map((p) => `<p>${esc(p)}</p>`).join("");
  $("areas").innerHTML = TOPICS.map((t) => `
    <button class="area" data-t="${t.id}" style="--c:var(--c-${t.id})">
      <h3>${esc(t.label)}</h3><p>${esc(t.blurb)}</p>
      <span class="count">${PUBS.filter((p) => p.topics.includes(t.id)).length} papers</span>
    </button>`).join("");
  document.querySelectorAll(".area").forEach((a) => a.onclick = () => {
    Viz.setTopic(a.dataset.t);
    $("pubs").scrollIntoView({ behavior: "smooth" });
  });
  $("grantlist").innerHTML = GRANTS.map((g) => `<article class="grant">
      <div class="g-when">${esc(g.years)}</div>
      <div><div class="g-title">${esc(g.title)}</div><div class="g-meta">${esc(g.funder)}${g.role ? " &middot; " + esc(g.role) : ""}</div></div>
    </article>`).join("");
  Viz.renderCareer($("careerlist"));
  $("contactbody").innerHTML = P.contact.map((c) => `<p>${c}</p>`).join("");
  $("foot").textContent = P.footer;

  Viz.renderMatrix($("matrix"));
  Viz.renderPubs($("publist"));
  const syncAreas = (t) => document.querySelectorAll(".area").forEach((a) => a.classList.toggle("on", a.dataset.t === t));
  Viz.onTopic(syncAreas);

  // ---- editable text: edits stay in this browser and go out with the picks email
  const EDITABLE = { lede: "Tagline", roles: "Titles", bio: "About" };
  const original = {};
  const store = (k, v) => { try { v == null ? localStorage.removeItem("edit:" + k) : localStorage.setItem("edit:" + k, v); } catch {} };
  for (const id in EDITABLE) {
    const el = $(id);
    original[id] = el.innerText.trim();
    let saved = null;
    try { saved = localStorage.getItem("edit:" + id); } catch {}
    if (saved) el.innerHTML = saved;
    el.contentEditable = "true";
    el.spellcheck = true;
    el.classList.add("editable");
    el.addEventListener("input", () => { store(id, el.innerHTML); updateMail(); });
  }
  const edits = () => Object.keys(EDITABLE).filter((id) => $(id).innerText.trim() !== original[id]);

  // ---- draft options
  const defaults = { layout: "editorial", pal: "red", map: "matrix", hide: "" };
  const params = new URLSearchParams(location.search);
  const pick = {};
  for (const k in defaults) pick[k] = params.get(k) ?? defaults[k];

  let netDrawn = false;
  function apply() {
    const root = document.documentElement;
    root.dataset.layout = pick.layout;
    root.dataset.pal = pick.pal;
    const hidden = pick.hide ? pick.hide.split(",") : [];
    $("grants").hidden = hidden.includes("grants");
    $("career").hidden = hidden.includes("career");
    $("stats").hidden = hidden.includes("stats");
    const net = pick.map === "net";
    $("matrix").hidden = net;
    $("net").hidden = !net;
    if (net && !netDrawn) { Viz.renderNetwork($("net"), { height: 520 }); netDrawn = true; }
    else if (net) Viz.renderNetwork($("net"), { height: 520 }); // colours follow the palette
    document.querySelectorAll(".picker .seg").forEach((seg) => {
      const k = seg.dataset.key;
      seg.querySelectorAll("button").forEach((b) => b.classList.toggle("on",
        k === "hide" ? !hidden.includes(b.dataset.v) : pick[k] === b.dataset.v));
    });
    document.querySelectorAll(".map-seg button").forEach((b) => b.classList.toggle("on", b.dataset.map === pick.map));
    const q = new URLSearchParams(location.search);
    for (const k in pick) { if (pick[k] && pick[k] !== defaults[k]) q.set(k, pick[k]); else q.delete(k); }
    const qs = q.toString();
    history.replaceState(null, "", location.pathname + (qs ? "?" + qs : "") + location.hash);
    updateMail();
  }

  document.querySelectorAll(".picker .seg").forEach((seg) => seg.querySelectorAll("button").forEach((b) => b.onclick = () => {
    const k = seg.dataset.key;
    if (k === "hide") {
      const set = new Set(pick.hide ? pick.hide.split(",") : []);
      set.has(b.dataset.v) ? set.delete(b.dataset.v) : set.add(b.dataset.v);
      pick.hide = [...set].join(",");
    } else pick[k] = b.dataset.v;
    apply();
  }));
  document.querySelectorAll(".map-seg button").forEach((b) => b.onclick = () => { pick.map = b.dataset.map; apply(); });

  const label = (k, v) => (document.querySelector(`.picker .seg[data-key="${k}"] button[data-v="${v}"]`) || {}).textContent;
  function summary() {
    const hidden = pick.hide ? pick.hide.split(",") : [];
    const lines = [
      "Layout: " + label("layout", pick.layout),
      "Color: " + label("pal", pick.pal),
      "Paper map: " + label("map", pick.map),
      "Leave out: " + (hidden.length ? hidden.map((h) => label("hide", h)).join(", ") : "nothing"),
    ];
    const notes = $("pickNotes").value.trim();
    if (notes) lines.push("", "Notes: " + notes);
    edits().forEach((id) => lines.push("", EDITABLE[id] + " (edited):", $(id).innerText.trim()));
    return lines.join("\n");
  }
  function updateMail() {
    const body = summary() + "\n\nLink: " + location.href;
    $("sendPicks").href = `mailto:${P.reviewer}?subject=${encodeURIComponent("Website picks")}&body=${encodeURIComponent(body)}`;
  }
  $("pickNotes").oninput = updateMail;
  // Zip of the site's files plus my-picks.md, so Barb (or her Claude) can finish it.
  const SOURCE = ["index.html", "site.css", "site.js", "viz.js", "data.js", "build-data.py", "source/barb.json", "README.md"];
  $("downloadSource").onclick = async () => {
    const btn = $("downloadSource");
    btn.textContent = "Preparing...";
    try {
      if (!window.JSZip) await new Promise((ok, fail) => {
        const sc = document.createElement("script");
        sc.src = "https://cdnjs.cloudflare.com/ajax/libs/jszip/3.10.1/jszip.min.js";
        sc.onload = ok; sc.onerror = fail; document.head.appendChild(sc);
      });
      const zip = new JSZip(), dir = zip.folder("barb-jones-site");
      for (const f of SOURCE) {
        const res = await fetch(f, { cache: "no-store" });
        if (!res.ok) throw new Error(f);
        dir.file(f, await res.blob());
      }
      dir.file("my-picks.md", "# Picks\n\n" + summary() + "\n\nLink: " + location.href + "\n");
      const a = document.createElement("a");
      a.href = URL.createObjectURL(await zip.generateAsync({ type: "blob" }));
      a.download = "barb-jones-site.zip";
      a.click();
      setTimeout(() => URL.revokeObjectURL(a.href), 5000);
      btn.textContent = "Download source";
    } catch {
      btn.textContent = "Download failed";
      setTimeout(() => btn.textContent = "Download source", 2000);
    }
  };
  $("resetText").onclick = () => {
    if (!edits().length) return;
    for (const id in EDITABLE) store(id, null);
    location.reload();
  };
  $("copyPicks").onclick = async () => {
    try { await navigator.clipboard.writeText(location.href); $("copyPicks").textContent = "Copied"; }
    catch { $("copyPicks").textContent = "Copy failed"; }
    setTimeout(() => $("copyPicks").textContent = "Copy link", 1600);
  };
  const picker = $("picker");
  if (window.matchMedia("(max-width: 760px)").matches) picker.classList.add("closed");
  $("pickerToggle").onclick = () => {
    picker.classList.toggle("closed");
    $("pickerToggle").setAttribute("aria-expanded", !picker.classList.contains("closed"));
  };

  apply();
})();
