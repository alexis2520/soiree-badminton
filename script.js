const BASE = JSON.stringify({ THEME_NAME: CONFIG.THEME_NAME, SUBTITLE: CONFIG.SUBTITLE, CLUB_NAME: CONFIG.CLUB_NAME, THEME: CONFIG.THEME, THEME_OVERRIDES: CONFIG.THEME_OVERRIDES || {} });
const P = CONFIG.EVENT_ID ? CONFIG.EVENT_ID + "/" : "";   // dossier de l'événement dans le dépôt privé
const SKEY = "capsule_settings_" + (CONFIG.EVENT_ID || "");
let T, FLUO, NEON, fontLink;
const $ = (id) => document.getElementById(id);
const sleep = (ms) => new Promise(r => setTimeout(r, ms));
const rnd = (a, b) => a + Math.random() * (b - a);
const pick = (a) => a[Math.floor(Math.random() * a.length)];
const reduced = matchMedia("(prefers-reduced-motion: reduce)").matches;

function toast(msg, err) {
  const t = $("toast"); t.textContent = msg; t.className = "toast show" + (err ? " err" : "");
  clearTimeout(toast.t); toast.t = setTimeout(() => t.className = "toast", 3000);
}
function explainErr(e) {
  if (!token()) return "Aucun jeton dans ce navigateur : colle-le dans l'onglet Accès, ou ouvre le lien du QR code (avec #k=…).";
  const st = e && e.status;
  if (st === 401) return "Jeton invalide ou expiré : crée-en un nouveau sur GitHub (onglet Accès).";
  if (st === 403 || st === 404) return "Le jeton n'a pas le droit d'écrire (Contents : Read and write) ou ne couvre pas ce dépôt.";
  return "Échec (code " + (st || "?") + "). Vérifie ta connexion et le jeton.";
}
function fluoSpans(text, off = 0) {
  return [...text.toUpperCase()].map((ch, i) => ch === " " ? " " : `<span style="color:${FLUO[(i + off) % FLUO.length]}">${ch}</span>`).join("");
}
function confetti() {
  if (reduced || (T && T.confetti === false)) return;
  const c = $("confetti"), x = c.getContext("2d"); c.width = innerWidth; c.height = innerHeight;
  const ps = Array.from({ length: 100 }, () => ({ x: innerWidth / 2, y: innerHeight * .75, vx: rnd(-8, 8), vy: rnd(-18, -6), s: rnd(6, 12), r: rnd(0, 6), c: pick([...FLUO, ...NEON]) }));
  let t = 0;
  (function f() {
    x.clearRect(0, 0, c.width, c.height);
    ps.forEach(p => { p.x += p.vx; p.y += p.vy; p.vy += .45; p.r += .2; x.save(); x.translate(p.x, p.y); x.rotate(p.r); x.fillStyle = p.c; x.fillRect(-p.s / 2, -p.s / 2, p.s, p.s * .6); x.restore(); });
    if (++t < 100) requestAnimationFrame(f); else x.clearRect(0, 0, c.width, c.height);
  })();
}

/* ---------- GitHub (stockage) ---------- */
const hashParams = new URLSearchParams(location.hash.slice(1));
if (hashParams.get("k")) localStorage.setItem("gh_token", hashParams.get("k"));
const WANT_ADMIN = hashParams.has("admin");
if (location.hash) history.replaceState(null, "", location.pathname + location.search);
const token = () => localStorage.getItem("gh_token");
const API = `https://api.github.com/repos/${CONFIG.GH_OWNER}/${CONFIG.GH_REPO}/contents`;
const gh = (path, opts = {}) => fetch(`${API}/${path}`, {
  cache: "no-cache", ...opts, headers: { Authorization: `Bearer ${token()}`, Accept: "application/vnd.github+json", ...(opts.headers || {}) }
});
const toB64 = (blob) => new Promise(res => { const r = new FileReader(); r.onload = () => res(r.result.split(",")[1]); r.readAsDataURL(blob); });
async function putFile(path, blob, message) {
  const content = await toB64(blob);
  for (let i = 0; i < 8; i++) {
    const r = await gh(path, { method: "PUT", body: JSON.stringify({ message, content }) });
    if (r.ok || r.status === 422) return;
    if (r.status === 409 || r.status >= 500) { await sleep(300 + Math.random() * 1500); continue; }
    throw Object.assign(new Error(await r.text()), { status: r.status });
  }
  throw new Error("Trop de tentatives");
}
async function isUnlockedRemotely() {
  if (!token()) return false;
  try { return (await gh(P + "unlocked.txt")).ok; } catch { return false; }
}

/* ---------- État & navigation ---------- */
let admin = sessionStorage.getItem("capsule_admin") === "1";
let view = sessionStorage.getItem("capsule_admin") === "1" ? sessionStorage.getItem("capsule_view") : null;
let unlocked = false, inGallery = false;
let sent = parseInt(localStorage.getItem("capsule_sent_" + (CONFIG.EVENT_ID || "")) || "0", 10);

function applyAll() {
  T = { ...(THEMES[CONFIG.THEME] || THEMES.fluo), ...(CONFIG.THEME_OVERRIDES || {}) }; FLUO = T.titleColors; NEON = T.neon;
  const set = (k, v) => document.documentElement.style.setProperty(k, v);
  T.bg.forEach((c, i) => set(`--bg${i + 1}`, c));
  set("--stripe", T.stripes ? "rgba(255,255,255,.08)" : "transparent");
  set("--text", T.text); set("--accent", T.accent); set("--accent-text", T.accentText); set("--highlight", T.highlight);
  set("--outline", T.outline); set("--panel", T.panel); set("--frame-a", T.frame[0]); set("--frame-b", T.frame[1]); set("--frame-border", T.frameBorder);
  set("--title-font", `"${T.titleFont}"`); set("--title-weight", T.titleWeight); set("--body-font", `"${T.bodyFont}"`);
  set("--f-sat", T.filter.sat); set("--f-con", T.filter.con);
  if (!fontLink) { fontLink = document.createElement("link"); fontLink.rel = "stylesheet"; document.head.appendChild(fontLink); }
  const fu = "https://fonts.googleapis.com/css2?" + T.fonts.map(f => "family=" + f).join("&") + "&display=swap";
  if (fontLink.dataset.u !== fu) { fontLink.dataset.u = fu; fontLink.href = fu; }
  document.querySelector('meta[name="theme-color"]')?.setAttribute("content", T.bg[1]);
  const fl = document.querySelector(".floaters"), fh = T.floaters.map(x => `<span>${esc(x)}</span>`).join("");
  if (fl.dataset.h !== fh) { fl.dataset.h = fh; fl.innerHTML = fh; }
  $("themeTitle").innerHTML = fluoSpans(CONFIG.THEME_NAME); $("themeTitle").classList.toggle("pulse", T.pulse !== false);
  $("footTitle").innerHTML = fluoSpans(CONFIG.THEME_NAME); $("subtitle").textContent = CONFIG.SUBTITLE;
  ["logoHeader", "footLogo"].forEach(id => { $(id).style.display = T.showLogo === false ? "none" : ""; $(id).src = CONFIG.LOGO_URL; });
  document.title = `${CONFIG.THEME_NAME} – ${CONFIG.CLUB_NAME}`;
}
const esc = (x) => String(x).replace(/[&<>"]/g, c => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" }[c]));
function mergeSettings(o) {
  ["THEME_NAME", "SUBTITLE", "CLUB_NAME", "THEME"].forEach(k => { if (o[k] !== undefined) CONFIG[k] = o[k]; });
  CONFIG.THEME_OVERRIDES = o.THEME_OVERRIDES || {};
}
async function loadSettings() {
  try { const c = JSON.parse(localStorage.getItem(SKEY) || "null"); if (c) mergeSettings(c); } catch {}
  applyAll();
  if (!token()) return;
  try {
    const r = await gh(P + "settings.json", { headers: { Accept: "application/vnd.github.raw+json" } });
    if (r.ok) { const o = await r.json(); localStorage.setItem(SKEY, JSON.stringify(o)); if (!draftDirty) { mergeSettings(o); applyAll(); } }
  } catch {}
}
let draftDirty = false;
function updateCount() { $("sentCount").textContent = sent ? `${sent} photo${sent > 1 ? "s" : ""} dans la capsule 🔒` : ""; }
updateCount();

const VIEWS = ["capture", "gallery", "design", "access"];
function showView(v) {
  view = v; inGallery = v === "gallery"; document.body.dataset.view = v;
  VIEWS.forEach(n => $("view" + n[0].toUpperCase() + n.slice(1)).classList.toggle("hidden", n !== v));
  if (v !== "capture") stopCamera();
  updateAdminBar(); window.scrollTo(0, 0);
  if (v === "design") renderDesign();
}
async function route() {
  unlocked = await isUnlockedRemotely();
  go(admin && view ? view : unlocked ? "gallery" : "capture");
}
function go(v) {
  sessionStorage.setItem("capsule_view", v);
  if (v === "capture") showCapture(); else if (v === "gallery") openGallery(); else showView(v);
}
function showCapture() {
  showView("capture");
  if (!token()) toast("Scanne le QR code de la soirée pour participer.", true);
  autoStart();
}

/* ---------- Caméra stylisée ---------- */
let stream, facing = "environment", hasTorch = false, flash = false, busy = false;
const video = $("video");
const landscapeNow = () => matchMedia("(orientation: landscape)").matches;

const HINT_OFF = `<span class="tap-ico">👆</span><span>Touche ici pour ouvrir<br>l'appareil photo</span>`;
let starting = false, autoTried = false;
function syncUi() {
  $("btnShot").classList.toggle("idle", !stream);
  $("camHint").innerHTML = stream ? "Appuie sur le <b>bouton vert</b> pour prendre la photo.<br><small>Elle est scellée aussitôt : découverte demain !</small>"
    : "Touche d'abord l'écran pour <b>ouvrir l'appareil photo</b>.";
}
function setOverlay(html) { $("camStart").innerHTML = html; $("camStart").classList.remove("hidden"); }
async function openStream() {
  const tries = [
    { video: { facingMode: { ideal: facing }, width: { ideal: 1920 }, height: { ideal: 1920 } }, audio: false },
    { video: { facingMode: { ideal: facing } }, audio: false },
    { video: true, audio: false }];
  let err;
  for (let i = 0; i < 4; i++) {                       // réessaie : la caméra met parfois du temps à se libérer
    try { return await navigator.mediaDevices.getUserMedia(tries[Math.min(i, 2)]); }
    catch (e) { err = e; if (e.name === "NotAllowedError" || e.name === "SecurityError") break; await sleep(450); }
  }
  throw err;
}
async function startCamera() {
  if (starting) return; starting = true;
  setOverlay(`<span class="tap-ico">⏳</span><span>Ouverture de la caméra…</span>`);
  stopCamera(true); await sleep(350);                 // laisse le temps de libérer l'ancienne caméra
  try {
    if (!navigator.mediaDevices?.getUserMedia) throw Object.assign(new Error(), { name: "NoApi" });
    const s = stream = await openStream();
    video.srcObject = s; await video.play();
    $("camStart").classList.add("hidden");
    video.style.transform = facing === "user" ? "scaleX(-1)" : "";
    const track = s.getVideoTracks()[0];
    track.onended = () => { if (stream === s) stopCamera(); };
    hasTorch = !!track.getCapabilities?.().torch;
    $("btnFlash").classList.toggle("hidden", !(hasTorch || facing === "user"));
    navigator.mediaDevices.enumerateDevices().then(d => $("btnFlip").classList.toggle("hidden", d.filter(x => x.kind === "videoinput").length < 2)).catch(() => {});
  } catch (e) {
    console.error(e); stream = null;
    setOverlay(`<span class="tap-ico">⚠️</span><span>${e.name === "NotAllowedError" ? "Autorise la caméra dans ton navigateur,<br>puis touche ici" : e.name === "NoApi" ? "Caméra indisponible ici.<br>Utilise « Importer »" : "Caméra occupée ou indisponible.<br>Touche ici pour réessayer"}</span>`);
  } finally { starting = false; syncUi(); }
}
function stopCamera(silent) {
  stream?.getTracks().forEach(t => t.stop()); stream = null; video.srcObject = null;
  if (!silent) { setOverlay(HINT_OFF); syncUi(); }
}
function autoStart() {                                // si la permission est déjà accordée, on ouvre directement
  if (autoTried || stream) return; autoTried = true;
  navigator.permissions?.query({ name: "camera" }).then(p => { if (p.state === "granted") startCamera(); }).catch(() => {});
}
document.addEventListener("visibilitychange", () => {
  if (!document.hidden && !inGallery && stream && stream.getVideoTracks()[0].readyState === "ended") startCamera();
});
$("camStart").onclick = startCamera;
$("btnFlip").onclick = async () => {
  if (starting) return;
  const prev = facing; facing = facing === "user" ? "environment" : "user";
  await startCamera();
  if (!stream) { facing = prev; await startCamera(); }  // si l'autre caméra échoue, on revient à la précédente
};
setOverlay(HINT_OFF); syncUi();
$("btnFlash").onclick = () => { flash = !flash; $("btnFlash").classList.toggle("on", flash); $("flashLbl").textContent = flash ? "Flash on" : "Flash off"; };

$("btnShot").onclick = async () => {
  if (busy) return;
  if (!token()) return toast("Scanne le QR code de la soirée pour envoyer une photo.", true);
  if (!stream) return startCamera();
  busy = true;
  const track = stream.getVideoTracks()[0];
  try {
    if (flash) {
      if (facing === "user") { $("screenFlash").classList.remove("hidden"); await sleep(350); }
      else if (hasTorch) { await track.applyConstraints({ advanced: [{ torch: true }] }); await sleep(450); }
    }
    const blob = await processPhoto(video, landscapeNow(), facing === "user");
    const fx = $("shutterFx"); fx.classList.remove("go"); void fx.offsetWidth; fx.classList.add("go");
    navigator.vibrate?.(60); confetti();
    sendBlob(blob);
  } catch (e) { console.error(e); toast("Oups, la photo a échoué. Réessaie !", true); }
  finally {
    $("screenFlash").classList.add("hidden");
    if (flash && hasTorch) track.applyConstraints({ advanced: [{ torch: false }] }).catch(() => {});
    busy = false;
  }
};
$("fileInput").addEventListener("change", async (e) => {
  const f = e.target.files[0]; e.target.value = "";
  if (!f) return;
  if (!token()) return toast("Scanne le QR code de la soirée pour envoyer une photo.", true);
  try {
    const img = await loadImage(URL.createObjectURL(f));
    sendBlob(await processPhoto(img, img.naturalWidth > img.naturalHeight, false)); confetti();
  } catch { toast("Image illisible.", true); }
});

async function sendBlob(blob) {
  toast("Envoi en cours…");
  try {
    await putFile(`${P}photos/${Date.now()}-${Math.random().toString(36).slice(2, 7)}.jpg`, blob, "Nouvelle photo");
    sent++; localStorage.setItem("capsule_sent_" + (CONFIG.EVENT_ID || ""), sent); updateCount();
    toast("Photo scellée dans la capsule 🔒 Rendez-vous demain !");
  } catch (e) { console.error(e); toast(e.status === 401 || e.status === 403 ? "Lien expiré : rescanne le nouveau QR code de la soirée." : "Envoi échoué. Vérifie ta connexion et réessaie.", true); }
}

/* ---------- Traitement de la photo ---------- */
function loadImage(src) { return new Promise((res, rej) => { const i = new Image(); i.onload = () => res(i); i.onerror = rej; i.src = src; }); }
function rr(ctx, x, y, w, h, r) {
  r = Math.max(0, Math.min(r, w / 2, h / 2));
  ctx.beginPath(); ctx.moveTo(x + r, y); ctx.arcTo(x + w, y, x + w, y + h, r); ctx.arcTo(x + w, y + h, x, y + h, r);
  ctx.arcTo(x, y + h, x, y, r); ctx.arcTo(x, y, x + w, y, r); ctx.closePath();
}

async function processPhoto(src, landscape, mirror) {
  await document.fonts.load(`${T.titleWeight} 80px "${T.titleFont}"`); await document.fonts.load(`500 40px "${T.bodyFont}"`);
  const sw = src.videoWidth || src.naturalWidth || src.width, sh = src.videoHeight || src.naturalHeight || src.height;
  const W = landscape ? 1440 : 1080, M = Math.round(W * .04), iw = W - 2 * M;
  const ih = Math.round(iw * (landscape ? .75 : 1.1)), footer = Math.round(W * (landscape ? .17 : .26)), H = M + ih + footer;

  // Style aléatoire (unique à chaque photo, sobre)
  const neon = pick(NEON), hue = Math.floor(rnd(T.photoHue[0], T.photoHue[1])), style = pick(["glow", "double", "dashed", "brackets"]), radius = Math.round(rnd(0, 48));

  const c = document.createElement("canvas"); c.width = W; c.height = H;
  const ctx = c.getContext("2d");
  const bg = ctx.createLinearGradient(0, 0, W, H); bg.addColorStop(0, `hsl(${hue},${T.photoSat}%,9%)`); bg.addColorStop(1, `hsl(${hue + 30},${T.photoSat + 10}%,19%)`);
  ctx.fillStyle = bg; ctx.fillRect(0, 0, W, H);

  // Photo + filtre fluo (sur un calque à part)
  const t = document.createElement("canvas"); t.width = iw; t.height = ih; const tc = t.getContext("2d");
  const s = Math.max(iw / sw, ih / sh), cw = iw / s, ch = ih / s;
  if (mirror) { tc.translate(iw, 0); tc.scale(-1, 1); }
  tc.drawImage(src, (sw - cw) / 2, (sh - ch) / 2, cw, ch, 0, 0, iw, ih);
  tc.setTransform(1, 0, 0, 1, 0, 0);
  const d = tc.getImageData(0, 0, iw, ih), p = d.data;
  for (let i = 0; i < p.length; i += 4) {
    let r = p[i], g = p[i + 1], b = p[i + 2]; const l = .3 * r + .59 * g + .11 * b;
    r = l + (r - l) * T.filter.sat; g = l + (g - l) * T.filter.sat; b = l + (b - l) * T.filter.sat;
    r = (r - 128) * T.filter.con + 128 + T.filter.tint[0]; g = (g - 128) * T.filter.con + 128 + T.filter.tint[1]; b = (b - 128) * T.filter.con + 128 + T.filter.tint[2];
    p[i] = Math.max(0, Math.min(255, r)); p[i + 1] = Math.max(0, Math.min(255, g)); p[i + 2] = Math.max(0, Math.min(255, b));
  }
  tc.putImageData(d, 0, 0);
  const vg = tc.createRadialGradient(iw / 2, ih / 2, iw * .35, iw / 2, ih / 2, iw * .85);
  vg.addColorStop(0, "rgba(0,0,0,0)"); vg.addColorStop(1, "rgba(0,0,0,.28)"); tc.fillStyle = vg; tc.fillRect(0, 0, iw, ih);

  ctx.save(); rr(ctx, M, M, iw, ih, radius); ctx.clip(); ctx.drawImage(t, M, M); ctx.restore();

  // Contour
  ctx.save(); ctx.strokeStyle = neon; ctx.shadowColor = neon; ctx.lineJoin = "round";
  if (style === "glow") { ctx.lineWidth = 6; ctx.shadowBlur = 26; rr(ctx, M, M, iw, ih, radius); ctx.stroke(); }
  else if (style === "double") {
    ctx.lineWidth = 5; ctx.shadowBlur = 14; rr(ctx, M, M, iw, ih, radius); ctx.stroke();
    ctx.lineWidth = 2.5; rr(ctx, M - 14, M - 14, iw + 28, ih + 28, radius + 14); ctx.stroke();
  } else if (style === "dashed") {
    ctx.lineWidth = 6; ctx.shadowBlur = 0; ctx.setLineDash([24, 16]); ctx.lineCap = "round"; rr(ctx, M - 12, M - 12, iw + 24, ih + 24, radius + 12); ctx.stroke();
  } else {
    ctx.lineWidth = 9; ctx.shadowBlur = 20; ctx.lineCap = "round"; const o = 12, L = 90, x0 = M - o, y0 = M - o, x1 = M + iw + o, y1 = M + ih + o;
    ctx.beginPath();
    ctx.moveTo(x0, y0 + L); ctx.lineTo(x0, y0); ctx.lineTo(x0 + L, y0);
    ctx.moveTo(x1 - L, y0); ctx.lineTo(x1, y0); ctx.lineTo(x1, y0 + L);
    ctx.moveTo(x0, y1 - L); ctx.lineTo(x0, y1); ctx.lineTo(x0 + L, y1);
    ctx.moveTo(x1 - L, y1); ctx.lineTo(x1, y1); ctx.lineTo(x1, y1 - L); ctx.stroke();
  }
  ctx.restore();

  // Pied : logo + titre multicolore + club/date
  const fy = M + ih, cy = fy + footer / 2; let textX = W / 2;
  try {
    if (T.showLogo === false) throw 0;
    const logo = await loadImage(CONFIG.LOGO_URL);
    const lh = footer * .62, lw = lh * (logo.width / logo.height);
    ctx.drawImage(logo, M + 10, cy - lh / 2, lw, lh);
    textX = M + 10 + lw + (W - M - (M + 10 + lw)) / 2;
  } catch {}
  const title = CONFIG.THEME_NAME.toUpperCase(), off = Math.floor(rnd(0, FLUO.length));
  ctx.textAlign = "left"; ctx.textBaseline = "middle"; ctx.lineJoin = "round";
  let fs = footer * .36; const setF = () => ctx.font = `${T.titleWeight} ${fs}px "${T.titleFont}"`; setF();
  const maxW = (W - 2 * M) * (textX === W / 2 ? 1 : .7);
  while (ctx.measureText(title).width > maxW && fs > 20) { fs -= 2; setF(); }
  let x = textX - ctx.measureText(title).width / 2; const ty = cy - footer * .08;
  [...title].forEach((chr, i) => {
    ctx.lineWidth = fs * .16; ctx.strokeStyle = T.outline; ctx.strokeText(chr, x, ty);
    ctx.fillStyle = FLUO[(i + off) % FLUO.length]; ctx.fillText(chr, x, ty); x += ctx.measureText(chr).width;
  });
  ctx.textAlign = "center"; ctx.fillStyle = T.text; ctx.font = `500 ${footer * .12}px "${T.bodyFont}", sans-serif`;
  ctx.fillText(`${CONFIG.CLUB_NAME} · ${new Date().toLocaleDateString("fr-FR")}`, textX, cy + footer * .28);

  return new Promise(res => c.toBlob(res, "image/jpeg", CONFIG.JPEG_QUALITY));
}

/* ---------- Galerie ---------- */
let galleryItems = [];
const blobCache = {}; let currentPhoto = null, currentEl = null;
async function fetchBlobUrl(path) {
  if (blobCache[path]) return blobCache[path];
  const r = await gh(path, { headers: { Accept: "application/vnd.github.raw+json" } });
  if (!r.ok) throw new Error(r.status);
  return (blobCache[path] = URL.createObjectURL(await r.blob()));
}
async function openGallery() {
  showView("gallery");
  try {
    const r = await gh(P + "photos");
    if (!r.ok && r.status !== 404) throw new Error(r.status);
    const files = r.status === 404 ? [] : await r.json();
    const photos = files.filter(f => f.name.endsWith(".jpg")).sort((a, b) => b.name.localeCompare(a.name));
    $("galleryEmpty").classList.toggle("hidden", photos.length > 0); $("grid").innerHTML = ""; galleryItems = [];
    const io = new IntersectionObserver(es => es.forEach(async en => {
      if (!en.isIntersecting) return; io.unobserve(en.target);
      try { en.target.src = await fetchBlobUrl(en.target.dataset.path); } catch {}
    }), { rootMargin: "300px" });
    photos.forEach(f => {
      const img = document.createElement("img");
      img.className = "thumb"; img.alt = "Photo de la soirée"; img.dataset.path = f.path;
      img.onclick = () => openLightbox(f, img); galleryItems.push({ f, img }); $("grid").appendChild(img); io.observe(img);
    });
  } catch { toast("Impossible de charger la galerie. Rescanne le QR code.", true); }
}
async function openLightbox(f, el) {
  currentPhoto = f; currentEl = el;
  $("lightbox").classList.remove("hidden"); $("lightboxDel").classList.toggle("hidden", !admin);
  const url = await fetchBlobUrl(f.path);
  $("lightboxImg").src = url; $("lightboxDl").href = url; $("lightboxDl").download = `${CONFIG.THEME_NAME}-${f.name}`;
}
$("lightboxClose").onclick = () => $("lightbox").classList.add("hidden");
$("lightbox").onclick = (e) => { if (e.target.id === "lightbox") $("lightbox").classList.add("hidden"); };
$("lightboxDel").onclick = async () => {
  if (!admin || !currentPhoto || !confirm("Supprimer définitivement cette photo ?")) return;
  const r = await gh(currentPhoto.path, { method: "DELETE", body: JSON.stringify({ message: "Suppression d'une photo", sha: currentPhoto.sha }) });
  if (!r.ok) return toast("Suppression échouée.", true);
  currentEl.remove(); galleryItems = galleryItems.filter(x => x.f !== currentPhoto); $("lightbox").classList.add("hidden"); toast("Photo supprimée 🗑");
  $("galleryEmpty").classList.toggle("hidden", $("grid").children.length > 0);
};

/* ---------- Admin ---------- */
let taps = 0, tapTimer;
$("logoHeader").addEventListener("click", () => {
  taps++; clearTimeout(tapTimer); tapTimer = setTimeout(() => taps = 0, 1500);
  if (taps >= 5) { $("adminPanel").classList.remove("hidden"); taps = 0; }
});
if (WANT_ADMIN) $("adminPanel").classList.remove("hidden");
$("adminBtn").onclick = () => {
  if ($("adminPwd").value !== CONFIG.ADMIN_PASSWORD) return toast("Mot de passe incorrect.", true);
  admin = true; sessionStorage.setItem("capsule_admin", "1"); $("adminPanel").classList.add("hidden"); $("adminPwd").value = ""; view = null; route();
};
$("adminPwd").addEventListener("keydown", e => { if (e.key === "Enter") $("adminBtn").click(); });
$("btnLogout").onclick = () => { admin = false; sessionStorage.removeItem("capsule_admin"); sessionStorage.removeItem("capsule_view"); view = null; route(); };
$("adminBar").addEventListener("click", e => { const b = e.target.closest("[data-go]"); if (b) go(b.dataset.go); });

function updateAdminBar() {
  $("adminBar").classList.toggle("hidden", !admin);
  if (!admin) return;
  $("lockState").textContent = unlocked ? "🔓" : "🔒";
  document.querySelectorAll("[data-go]").forEach(b => b.classList.toggle("active", b.dataset.go === view));
  $("accessIcon").textContent = unlocked ? "🔓" : "🔒";
  $("accessState").textContent = unlocked ? "Galerie OUVERTE : tout le monde voit les photos" : "Galerie VERROUILLÉE : personne ne voit les photos";
  $("holdLabel").textContent = unlocked ? "Maintenir 3 s pour REBLOQUER" : "Maintenir 3 s pour DÉBLOQUER";
}
async function setUnlocked(on) {
  if (on) await putFile(P + "unlocked.txt", new Blob(["1"]), "Galerie débloquée");
  else {
    const r = await gh(P + "unlocked.txt");
    if (r.ok) {
      const { sha } = await r.json();
      const d = await gh(P + "unlocked.txt", { method: "DELETE", body: JSON.stringify({ message: "Galerie reverrouillée", sha }) });
      if (!d.ok) throw new Error("delete");
    }
  }
  unlocked = on; updateAdminBar(); confetti();
  toast(on ? "Galerie débloquée pour tout le monde 🎉" : "Galerie reverrouillée 🔒");
}
(function holdButton(el, ms) {
  let timer;
  const stop = () => { clearTimeout(timer); el.classList.remove("holding"); };
  el.addEventListener("pointerdown", () => {
    el.classList.add("holding");
    timer = setTimeout(async () => { stop(); navigator.vibrate?.(120); try { await setUnlocked(!unlocked); } catch (e) { toast(explainErr(e), true); } }, ms);
  });
  ["pointerup", "pointerleave", "pointercancel"].forEach(ev => el.addEventListener(ev, stop));
  el.addEventListener("contextmenu", e => e.preventDefault());
})($("holdBtn"), 3000);

/* ---------- Apparence (admin) ---------- */
const FONTS = [["Titan One", "Titan+One", 400], ["Lilita One", "Lilita+One", 400], ["Bangers", "Bangers", 400], ["Bungee", "Bungee", 400],
  ["Righteous", "Righteous", 400], ["Pacifico", "Pacifico", 400], ["Permanent Marker", "Permanent+Marker", 400], ["Playfair Display", "Playfair+Display:wght@800", 800], ["Mountains of Christmas", "Mountains+of+Christmas:wght@700", 700]];
const setOv = (o) => { draftDirty = true; CONFIG.THEME_OVERRIDES = { ...CONFIG.THEME_OVERRIDES, ...o }; applyAll(); };
const tc4 = () => Array.from({ length: 4 }, (_, i) => T.titleColors[i % T.titleColors.length]);
function renderDesign() {
  if (!window._fontsPrev) { window._fontsPrev = 1; const l = document.createElement("link"); l.rel = "stylesheet"; l.href = "https://fonts.googleapis.com/css2?" + FONTS.map(f => "family=" + f[1]).join("&") + "&display=swap"; document.head.appendChild(l); }
  const col = (id, label, v) => `<label class="color-item"><input type="color" data-c="${id}" value="${v}">${label}</label>`;
  const chk = (k, label) => `<label class="toggle"><input type="checkbox" data-t="${k}" ${(k === "stripes" ? T.stripes : T[k] !== false) ? "checked" : ""}>${label}</label>`;
  $("designForm").innerHTML = `
    <h3 class="sec">✏️ Textes</h3>
    <label class="f-row">Titre<input type="text" data-k="THEME_NAME" value="${esc(CONFIG.THEME_NAME)}"></label>
    <label class="f-row">Sous-titre<input type="text" data-k="SUBTITLE" value="${esc(CONFIG.SUBTITLE)}"></label>
    <label class="f-row">Nom du club (sur les photos)<input type="text" data-k="CLUB_NAME" value="${esc(CONFIG.CLUB_NAME)}"></label>
    <h3 class="sec">🎨 Thème de départ</h3>
    <div class="presets">${Object.keys(THEMES).map(k => `<button class="preset ${k === CONFIG.THEME ? "on" : ""}" data-preset="${k}" style="background:linear-gradient(135deg,${THEMES[k].bg.join(",")})">${THEMES[k].label || k}</button>`).join("")}</div>
    <h3 class="sec">🌈 Couleurs</h3>
    <div class="colors">${[col("bg0", "Fond 1", T.bg[0]), col("bg1", "Fond 2", T.bg[1]), col("bg2", "Fond 3", T.bg[2]), col("accent", "Boutons", T.accent),
      col("text", "Texte", T.text), col("frameBorder", "Contour / halo", T.frameBorder), ...tc4().map((c, i) => col("t" + i, "Lettre " + (i + 1), c))].join("")}</div>
    <h3 class="sec">🔤 Police du titre</h3>
    <div class="fonts">${FONTS.map(f => `<button class="font-btn ${f[0] === T.titleFont ? "on" : ""}" data-fontname="${f[0]}" style="font-family:'${f[0]}',sans-serif;font-weight:${f[2]}">${f[0]}</button>`).join("")}</div>
    <h3 class="sec">✨ Petits ajouts</h3>
    <label class="f-row">Emojis qui flottent en fond (séparés par des espaces)<input type="text" data-emoji value="${esc(T.floaters.join(" "))}"></label>
    ${chk("stripes", "Rayures diagonales")}${chk("confetti", "Confettis à chaque photo")}${chk("pulse", "Titre qui pulse")}${chk("showLogo", "Afficher le logo (page et photos)")}`;
}
$("designForm").addEventListener("input", e => {
  const t = e.target, d = t.dataset;
  if (d.k) { draftDirty = true; CONFIG[d.k] = t.value; applyAll(); }
  else if (d.c) {
    if (d.c.startsWith("bg")) { const bg = [...T.bg]; bg[+d.c[2]] = t.value; setOv({ bg }); }
    else if (d.c !== "text" && d.c[0] === "t") { const a = tc4(); a[+d.c[1]] = t.value; setOv({ titleColors: a }); }
    else setOv({ [d.c]: t.value });
  } else if (d.emoji !== undefined) setOv({ floaters: t.value.split(/\s+/).filter(Boolean).slice(0, 6) });
  else if (d.t) setOv({ [d.t]: t.checked });
  else if (d.font !== undefined) { const f = FONTS.find(x => x[0] === t.value); setOv({ titleFont: f[0], titleWeight: f[2], fonts: [f[1], (THEMES[CONFIG.THEME] || THEMES.fluo).fonts.slice(-1)[0]] }); }
});
$("designForm").addEventListener("click", e => {
  const fb = e.target.closest("[data-fontname]");
  if (fb) { const f = FONTS.find(x => x[0] === fb.dataset.fontname); setOv({ titleFont: f[0], titleWeight: f[2], fonts: [f[1], (THEMES[CONFIG.THEME] || THEMES.fluo).fonts.slice(-1)[0]] }); renderDesign(); return; }
  const b = e.target.closest("[data-preset]"); if (!b) return;
  draftDirty = true; CONFIG.THEME = b.dataset.preset; CONFIG.THEME_OVERRIDES = {}; applyAll(); renderDesign();
});
async function saveSettings() {
  const o = { THEME_NAME: CONFIG.THEME_NAME, SUBTITLE: CONFIG.SUBTITLE, CLUB_NAME: CONFIG.CLUB_NAME, THEME: CONFIG.THEME, THEME_OVERRIDES: CONFIG.THEME_OVERRIDES || {} };
  const content = btoa(unescape(encodeURIComponent(JSON.stringify(o, null, 1))));
  let st;
  for (let i = 0; i < 5; i++) {
    const r0 = await gh(P + "settings.json"), sha = r0.ok ? (await r0.json()).sha : undefined;
    const r = await gh(P + "settings.json", { method: "PUT", body: JSON.stringify({ message: "Réglages d'apparence", content, sha }) });
    if (r.ok) { localStorage.setItem(SKEY, JSON.stringify(o)); draftDirty = false; return; }
    st = r.status; if (st === 401 || st === 403 || st === 404) break;
    await sleep(500 + Math.random() * 800);
  }
  throw Object.assign(new Error("save"), { status: st });
}
$("btnSaveDesign").onclick = async () => { try { await saveSettings(); toast("Apparence enregistrée pour tout le monde ✅"); } catch (e) { toast(explainErr(e), true); } };
$("btnResetDesign").onclick = () => { if (!confirm("Revenir aux réglages du fichier config.js ?")) return; draftDirty = true; mergeSettings(JSON.parse(BASE)); applyAll(); renderDesign(); };
$("btnTestPhoto").onclick = async () => {
  const c = document.createElement("canvas"); c.width = 1200; c.height = 900; const x = c.getContext("2d");
  const g = x.createLinearGradient(0, 0, 1200, 900); g.addColorStop(0, "#3a86ff"); g.addColorStop(.5, "#8338ec"); g.addColorStop(1, "#ff006e");
  x.fillStyle = g; x.fillRect(0, 0, 1200, 900); x.font = "320px serif"; x.textAlign = "center"; x.textBaseline = "middle"; x.fillText("🏸", 600, 450);
  const url = URL.createObjectURL(await processPhoto(c, landscapeNow(), false));
  currentPhoto = null; $("lightboxImg").src = url; $("lightboxDl").href = url; $("lightboxDl").download = "photo-test.jpg";
  $("lightboxDel").classList.add("hidden"); $("lightbox").classList.remove("hidden");
};

/* ---------- Raccourcis clavier (PC) ---------- */
addEventListener("keydown", e => {
  if (/INPUT|TEXTAREA|SELECT/.test(e.target.tagName)) return;
  if (!$("lightbox").classList.contains("hidden")) {
    if (e.key === "Escape") $("lightboxClose").click();
    const i = galleryItems.findIndex(x => x.f === currentPhoto), n = galleryItems[i + (e.key === "ArrowRight" ? 1 : e.key === "ArrowLeft" ? -1 : 0)];
    if (i >= 0 && n && e.key.startsWith("Arrow")) openLightbox(n.f, n.img);
    return;
  }
  if ((e.key === " " || e.key === "Enter") && view === "capture" && e.target.tagName !== "BUTTON") { e.preventDefault(); $("btnShot").click(); }
});

/* ---------- Jeton GitHub (admin) ---------- */
$("btnSaveToken").onclick = () => {
  const v = $("tokenInput").value.trim();
  if (!v) return toast("Colle d'abord un jeton.", true);
  localStorage.setItem("gh_token", v); $("tokenInput").value = ""; toast("Jeton enregistré. Teste la connexion 👇");
};
$("btnTestToken").onclick = async () => {
  if (!token()) return toast(explainErr(), true);
  try {
    const r = await fetch(`https://api.github.com/repos/${CONFIG.GH_OWNER}/${CONFIG.GH_REPO}`, { cache: "no-cache", headers: { Authorization: `Bearer ${token()}`, Accept: "application/vnd.github+json" } });
    if (!r.ok) return toast(explainErr({ status: r.status }), true);
    const d = await r.json();
    d.permissions && d.permissions.push === false ? toast("Connexion OK, mais jeton en LECTURE seule ⚠️", true) : toast("Connexion OK ✅ écriture autorisée");
  } catch { toast("Pas de connexion internet ?", true); }
};

/* ---------- Appli installable (raccourci écran d'accueil) ---------- */
(function setupInstall() {
  const dir = new URL("./", location.href).href;
  const manifest = {
    name: `${CONFIG.THEME_NAME} – ${CONFIG.CLUB_NAME}`, short_name: CONFIG.THEME_NAME, display: "standalone",
    background_color: "#7a1fb8", theme_color: "#7a1fb8", scope: dir, start_url: dir + (token() ? `#k=${token()}` : ""),
    icons: [192, 512].map(n => ({ src: dir + `icon-${n}.png`, sizes: `${n}x${n}`, type: "image/png", purpose: "any" }))
  };
  const l = document.createElement("link"); l.rel = "manifest";
  l.href = URL.createObjectURL(new Blob([JSON.stringify(manifest)], { type: "application/manifest+json" })); document.head.appendChild(l);
  navigator.serviceWorker?.register("sw.js").catch(() => {});
  let deferred;
  addEventListener("beforeinstallprompt", e => { e.preventDefault(); deferred = e; });
  if (!(matchMedia("(display-mode: standalone)").matches || navigator.standalone)) $("btnInstall").classList.remove("hidden");
  $("btnInstall").onclick = () => deferred ? deferred.prompt()
    : alert("iPhone : touche Partager (carré avec flèche) puis « Sur l'écran d'accueil ».\nAndroid : menu ⋮ du navigateur puis « Installer l'application ».");
})();

applyAll();
loadSettings();
route();
