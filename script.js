/* =====================================================================
   ⚙️  CONFIGURATION — à modifier
   ===================================================================== */
const CONFIG = {
  THEME_NAME: "Tournoi Fluo",
  SUBTITLE: "Vendredi 30 octobre · Immortalise la soirée, découvre les photos demain !",
  CLUB_NAME: "BCV 43",
  LOGO_URL: "logo.png",
  GH_OWNER: "alexis2520",
  GH_REPO: "soiree-badminton-photos",   // dépôt PRIVÉ des photos
  ADMIN_PASSWORD: "badminton2026",      // ⚠️ à changer (visible dans le code)
  JPEG_QUALITY: 0.85,
  FONT_THEME: "Titan One"
};
/* ===================================================================== */
const FLUO = ["#5dff3a", "#ff7a3d", "#ffe93d", "#ff5a5a"];
const NEON = ["#ff3d9a", "#2de2ff", "#5dff3a", "#ffe93d", "#ff7a3d", "#b57bff"];
const $ = (id) => document.getElementById(id);
const sleep = (ms) => new Promise(r => setTimeout(r, ms));
const rnd = (a, b) => a + Math.random() * (b - a);
const pick = (a) => a[Math.floor(Math.random() * a.length)];
const reduced = matchMedia("(prefers-reduced-motion: reduce)").matches;

function toast(msg, err) {
  const t = $("toast"); t.textContent = msg; t.className = "toast show" + (err ? " err" : "");
  clearTimeout(toast.t); toast.t = setTimeout(() => t.className = "toast", 3000);
}
function fluoSpans(text, off = 0) {
  return [...text.toUpperCase()].map((ch, i) => ch === " " ? " " : `<span style="color:${FLUO[(i + off) % 4]}">${ch}</span>`).join("");
}
function confetti() {
  if (reduced) return;
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
  ...opts, headers: { Authorization: `Bearer ${token()}`, Accept: "application/vnd.github+json", ...(opts.headers || {}) }
});
const toB64 = (blob) => new Promise(res => { const r = new FileReader(); r.onload = () => res(r.result.split(",")[1]); r.readAsDataURL(blob); });
async function putFile(path, blob, message) {
  const content = await toB64(blob);
  for (let i = 0; i < 8; i++) {
    const r = await gh(path, { method: "PUT", body: JSON.stringify({ message, content }) });
    if (r.ok || r.status === 422) return;
    if (r.status === 409 || r.status >= 500) { await sleep(300 + Math.random() * 1500); continue; }
    throw new Error(await r.text());
  }
  throw new Error("Trop de tentatives");
}
async function isUnlockedRemotely() {
  if (!token()) return false;
  try { return (await gh("unlocked.txt")).ok; } catch { return false; }
}

/* ---------- État & navigation ---------- */
let admin = sessionStorage.getItem("capsule_admin") === "1";
let mode = sessionStorage.getItem("capsule_mode") || "auto";   // auto | photo | gallery
let unlocked = false, inGallery = false;
let sent = parseInt(localStorage.getItem("capsule_sent") || "0", 10);

$("themeTitle").innerHTML = fluoSpans(CONFIG.THEME_NAME);
$("footTitle").innerHTML = fluoSpans(CONFIG.THEME_NAME);
$("subtitle").textContent = CONFIG.SUBTITLE;
$("logoHeader").src = CONFIG.LOGO_URL; $("footLogo").src = CONFIG.LOGO_URL;
document.title = `${CONFIG.THEME_NAME} – ${CONFIG.CLUB_NAME}`;
function updateCount() { $("sentCount").textContent = sent ? `${sent} photo${sent > 1 ? "s" : ""} dans la capsule 🔒` : ""; }
updateCount();

async function route() {
  unlocked = await isUnlockedRemotely();
  const gallery = admin ? (mode === "gallery" || (mode === "auto" && unlocked)) : unlocked;
  gallery ? openGallery() : showCapture();
}
function showCapture() {
  inGallery = false;
  $("viewCapture").classList.remove("hidden"); $("viewGallery").classList.add("hidden");
  updateAdminBar();
  if (!token()) toast("Scanne le QR code de la soirée pour participer.", true);
}
function setMode(m) { mode = m; sessionStorage.setItem("capsule_mode", m); m === "gallery" ? openGallery() : showCapture(); }

/* ---------- Caméra stylisée ---------- */
let stream, facing = "environment", hasTorch = false, flash = false, busy = false;
const video = $("video");
const landscapeNow = () => matchMedia("(orientation: landscape)").matches;

async function startCamera() {
  stopCamera();
  try {
    stream = await navigator.mediaDevices.getUserMedia({ video: { facingMode: { ideal: facing }, width: { ideal: 1920 }, height: { ideal: 1920 } }, audio: false });
    video.srcObject = stream; await video.play();
    $("camStart").classList.add("hidden");
    video.style.transform = facing === "user" ? "scaleX(-1)" : "";
    const caps = stream.getVideoTracks()[0].getCapabilities?.() || {};
    hasTorch = !!caps.torch;
    $("btnFlash").classList.toggle("hidden", !(hasTorch || facing === "user"));
  } catch {
    $("camStart").textContent = "Caméra indisponible : utilise « Importer »";
    $("camStart").classList.remove("hidden");
  }
}
function stopCamera() {
  stream?.getTracks().forEach(t => t.stop()); stream = null; video.srcObject = null;
  $("camStart").classList.remove("hidden"); $("camStart").textContent = "📸 Ouvrir l'appareil photo";
}
$("camStart").onclick = startCamera;
$("btnFlip").onclick = () => { facing = facing === "user" ? "environment" : "user"; stream ? startCamera() : startCamera(); };
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
    await putFile(`photos/${Date.now()}-${Math.random().toString(36).slice(2, 7)}.jpg`, blob, "Nouvelle photo");
    sent++; localStorage.setItem("capsule_sent", sent); updateCount();
    toast("Photo scellée dans la capsule 🔒 Rendez-vous demain !");
  } catch (e) { console.error(e); toast("Envoi échoué. Vérifie ta connexion et réessaie.", true); }
}

/* ---------- Traitement de la photo ---------- */
function loadImage(src) { return new Promise((res, rej) => { const i = new Image(); i.onload = () => res(i); i.onerror = rej; i.src = src; }); }
function rr(ctx, x, y, w, h, r) {
  r = Math.max(0, Math.min(r, w / 2, h / 2));
  ctx.beginPath(); ctx.moveTo(x + r, y); ctx.arcTo(x + w, y, x + w, y + h, r); ctx.arcTo(x + w, y + h, x, y + h, r);
  ctx.arcTo(x, y + h, x, y, r); ctx.arcTo(x, y, x + w, y, r); ctx.closePath();
}

async function processPhoto(src, landscape, mirror) {
  await document.fonts.load(`80px "${CONFIG.FONT_THEME}"`); await document.fonts.load('500 40px "Fredoka"');
  const sw = src.videoWidth || src.naturalWidth, sh = src.videoHeight || src.naturalHeight;
  const W = landscape ? 1440 : 1080, M = Math.round(W * .04), iw = W - 2 * M;
  const ih = Math.round(iw * (landscape ? .75 : 1.1)), footer = Math.round(W * (landscape ? .17 : .26)), H = M + ih + footer;

  // Style aléatoire (unique à chaque photo, sobre)
  const neon = pick(NEON), hue = Math.floor(rnd(250, 330)), style = pick(["glow", "double", "dashed", "brackets"]), radius = Math.round(rnd(0, 48));

  const c = document.createElement("canvas"); c.width = W; c.height = H;
  const ctx = c.getContext("2d");
  const bg = ctx.createLinearGradient(0, 0, W, H); bg.addColorStop(0, `hsl(${hue},60%,9%)`); bg.addColorStop(1, `hsl(${hue + 30},70%,19%)`);
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
    r = l + (r - l) * 1.4; g = l + (g - l) * 1.4; b = l + (b - l) * 1.4;
    r = (r - 128) * 1.15 + 136; g = (g - 128) * 1.15 + 124; b = (b - 128) * 1.15 + 138;
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
    const logo = await loadImage(CONFIG.LOGO_URL);
    const lh = footer * .62, lw = lh * (logo.width / logo.height);
    ctx.drawImage(logo, M + 10, cy - lh / 2, lw, lh);
    textX = M + 10 + lw + (W - M - (M + 10 + lw)) / 2;
  } catch {}
  const title = CONFIG.THEME_NAME.toUpperCase(), off = Math.floor(rnd(0, 4));
  ctx.textAlign = "left"; ctx.textBaseline = "middle"; ctx.lineJoin = "round";
  let fs = footer * .36; const setF = () => ctx.font = `${fs}px "${CONFIG.FONT_THEME}"`; setF();
  const maxW = (W - 2 * M) * (textX === W / 2 ? 1 : .7);
  while (ctx.measureText(title).width > maxW && fs > 20) { fs -= 2; setF(); }
  let x = textX - ctx.measureText(title).width / 2; const ty = cy - footer * .08;
  [...title].forEach((chr, i) => {
    ctx.lineWidth = fs * .16; ctx.strokeStyle = "#000"; ctx.strokeText(chr, x, ty);
    ctx.fillStyle = FLUO[(i + off) % 4]; ctx.fillText(chr, x, ty); x += ctx.measureText(chr).width;
  });
  ctx.textAlign = "center"; ctx.fillStyle = "#fff"; ctx.font = `500 ${footer * .12}px "Fredoka", sans-serif`;
  ctx.fillText(`${CONFIG.CLUB_NAME} · ${new Date().toLocaleDateString("fr-FR")}`, textX, cy + footer * .28);

  return new Promise(res => c.toBlob(res, "image/jpeg", CONFIG.JPEG_QUALITY));
}

/* ---------- Galerie ---------- */
const blobCache = {}; let currentPhoto = null, currentEl = null;
async function fetchBlobUrl(path) {
  if (blobCache[path]) return blobCache[path];
  const r = await gh(path, { headers: { Accept: "application/vnd.github.raw+json" } });
  if (!r.ok) throw new Error(r.status);
  return (blobCache[path] = URL.createObjectURL(await r.blob()));
}
async function openGallery() {
  stopCamera(); inGallery = true;
  $("viewCapture").classList.add("hidden"); $("viewGallery").classList.remove("hidden"); updateAdminBar();
  try {
    const r = await gh("photos");
    if (!r.ok && r.status !== 404) throw new Error(r.status);
    const files = r.status === 404 ? [] : await r.json();
    const photos = files.filter(f => f.name.endsWith(".jpg")).sort((a, b) => b.name.localeCompare(a.name));
    $("galleryEmpty").classList.toggle("hidden", photos.length > 0); $("grid").innerHTML = "";
    const io = new IntersectionObserver(es => es.forEach(async en => {
      if (!en.isIntersecting) return; io.unobserve(en.target);
      try { en.target.src = await fetchBlobUrl(en.target.dataset.path); } catch {}
    }), { rootMargin: "300px" });
    photos.forEach(f => {
      const img = document.createElement("img");
      img.className = "thumb"; img.alt = "Photo de la soirée"; img.dataset.path = f.path;
      img.onclick = () => openLightbox(f, img); $("grid").appendChild(img); io.observe(img);
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
  currentEl.remove(); $("lightbox").classList.add("hidden"); toast("Photo supprimée 🗑");
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
  admin = true; sessionStorage.setItem("capsule_admin", "1"); $("adminPanel").classList.add("hidden"); $("adminPwd").value = ""; route();
};
$("btnLogout").onclick = () => { admin = false; sessionStorage.removeItem("capsule_admin"); sessionStorage.removeItem("capsule_mode"); mode = "auto"; route(); };
$("btnToPhoto").onclick = () => setMode("photo");
$("btnToGallery").onclick = () => setMode("gallery");

function updateAdminBar() {
  $("adminBar").classList.toggle("hidden", !admin);
  if (!admin) return;
  $("lockState").textContent = unlocked ? "🔓 Galerie ouverte" : "🔒 Galerie verrouillée";
  $("holdLabel").textContent = unlocked ? "Maintenir 3 s : REBLOQUER" : "Maintenir 3 s : DÉBLOQUER";
  $("btnToPhoto").classList.toggle("hidden", !inGallery); $("btnToGallery").classList.toggle("hidden", inGallery);
}
async function setUnlocked(on) {
  if (on) await putFile("unlocked.txt", new Blob(["1"]), "Galerie débloquée");
  else {
    const r = await gh("unlocked.txt");
    if (r.ok) {
      const { sha } = await r.json();
      const d = await gh("unlocked.txt", { method: "DELETE", body: JSON.stringify({ message: "Galerie reverrouillée", sha }) });
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
    timer = setTimeout(async () => { stop(); navigator.vibrate?.(120); try { await setUnlocked(!unlocked); } catch { toast("Action échouée. Vérifie le jeton.", true); } }, ms);
  });
  ["pointerup", "pointerleave", "pointercancel"].forEach(ev => el.addEventListener(ev, stop));
  el.addEventListener("contextmenu", e => e.preventDefault());
})($("holdBtn"), 3000);

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

route();
