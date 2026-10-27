/* =====================================================================
   ⚙️  CONFIGURATION — à modifier
   ===================================================================== */
const CONFIG = {
  THEME_NAME: "Soirée Fluo",                  // Thème affiché sur la page ET sur chaque photo
  SUBTITLE: "Capture un souvenir, découvre-le demain !",
  CLUB_NAME: "Badminton Brives-Charensac",
  LOGO_URL: "logo.png",                       // Remplace simplement le fichier logo.png (PNG, idéalement fond transparent)

  // GitHub : dépôt PRIVÉ qui stocke les photos (≠ dépôt du site). Voir le guide.
  GH_OWNER: "alexis2520",
  GH_REPO: "soiree-badminton-photos",

  // Déblocage automatique (optionnel) : ex. "2026-10-17T10:00:00" ou null
  UNLOCK_DATE: null,   // (la galerie ne s'ouvre que pour ceux qui ont le jeton, voir guide)

  // ⚠️ Mot de passe admin : visible dans le code, donc simple barrière « anti-curieux »
  ADMIN_PASSWORD: "badminton2026",

  // Style de la photo
  PHOTO_WIDTH: 1080,
  JPEG_QUALITY: 0.85,
  FRAME_COLOR: "#f5f1e6",
  ACCENT_COLOR: "#ff5a4e",
  FONT_THEME: "Pacifico"
};

/* ===================================================================== */
const $ = (id) => document.getElementById(id);
const views = ["viewCapture", "viewSending", "viewDone", "viewGallery"];
const show = (id) => views.forEach(v => $(v).classList.toggle("hidden", v !== id));
/* ---------- GitHub (stockage) ---------- */
// Le jeton arrive dans l'URL du QR code (#k=...), il n'est donc JAMAIS écrit dans le code public.
const hashParams = new URLSearchParams(location.hash.slice(1));
if (hashParams.get("k")) localStorage.setItem("gh_token", hashParams.get("k"));
const WANT_ADMIN = hashParams.has("admin");
if (location.hash) history.replaceState(null, "", location.pathname + location.search);
const token = () => localStorage.getItem("gh_token");
const API = `https://api.github.com/repos/${CONFIG.GH_OWNER}/${CONFIG.GH_REPO}/contents`;
const gh = (path, opts = {}) => fetch(`${API}/${path}`, {
  ...opts, headers: { Authorization: `Bearer ${token()}`, Accept: "application/vnd.github+json", ...(opts.headers || {}) }
});
const sleep = (ms) => new Promise(r => setTimeout(r, ms));
const toB64 = (blob) => new Promise(res => { const r = new FileReader(); r.onload = () => res(r.result.split(",")[1]); r.readAsDataURL(blob); });

// Ajoute un fichier dans le dépôt (réessaie si plusieurs personnes envoient en même temps)
async function putFile(path, blob, message) {
  const content = await toB64(blob);
  for (let i = 0; i < 8; i++) {
    const r = await gh(path, { method: "PUT", body: JSON.stringify({ message, content }) });
    if (r.ok || r.status === 422) return;               // 422 = existe déjà
    if (r.status === 409 || r.status >= 500) { await sleep(300 + Math.random() * 1500); continue; }
    throw new Error(await r.text());
  }
  throw new Error("Trop de tentatives");
}

function showError(msg) { const e = $("errorMsg"); e.textContent = msg; e.classList.remove("hidden"); }
function clearError() { $("errorMsg").classList.add("hidden"); }

/* ---------- Init ---------- */
$("themeTitle").textContent = CONFIG.THEME_NAME;
$("subtitle").textContent = CONFIG.SUBTITLE;
$("logoHeader").src = CONFIG.LOGO_URL;
document.title = `${CONFIG.THEME_NAME} – ${CONFIG.CLUB_NAME}`;

let sent = parseInt(localStorage.getItem("capsule_sent") || "0", 10);
function updateCount() { $("sentCount").textContent = sent ? `${sent} photo${sent > 1 ? "s" : ""} dans la capsule 🔒` : ""; }
updateCount();

async function init() {
  const forcedLocal = localStorage.getItem("capsule_admin_preview") === "1";
  const dateOpen = CONFIG.UNLOCK_DATE && Date.now() >= new Date(CONFIG.UNLOCK_DATE).getTime();
  if (forcedLocal || dateOpen || await isUnlockedRemotely()) openGallery();
  else show("viewCapture");
}

async function isUnlockedRemotely() {
  if (!token()) return false;
  try { return (await gh("unlocked.txt")).ok; } catch { return false; }
}

/* ---------- Capture & traitement ---------- */
["fileInput", "fileInputGallery"].forEach(id =>
  $(id).addEventListener("change", (e) => { if (e.target.files[0]) handleFile(e.target.files[0]); e.target.value = ""; }));
$("btnAgain").addEventListener("click", () => show("viewCapture"));

async function handleFile(file) {
  clearError();
  if (!token()) { showError("Scanne le QR code de la soirée pour pouvoir envoyer une photo."); return; }
  show("viewSending");
  try {
    const blob = await processPhoto(file);
    await putFile(`photos/${Date.now()}-${Math.random().toString(36).slice(2, 7)}.jpg`, blob, "Nouvelle photo");
    sent++; localStorage.setItem("capsule_sent", sent); updateCount();
    show("viewDone");
  } catch (err) {
    console.error(err);
    show("viewCapture");
    showError("L'envoi a échoué. Vérifie ta connexion et réessaie.");
  }
}

function loadImage(src) {
  return new Promise((res, rej) => { const i = new Image(); i.crossOrigin = "anonymous"; i.onload = () => res(i); i.onerror = rej; i.src = src; });
}

async function processPhoto(file) {
  await document.fonts.load(`80px "${CONFIG.FONT_THEME}"`);
  const bitmap = await loadImage(URL.createObjectURL(file)); // le navigateur applique l'orientation EXIF
  const W = CONFIG.PHOTO_WIDTH, M = Math.round(W * 0.04);
  const innerW = W - 2 * M, innerH = Math.round(innerW * 1.1), footer = Math.round(W * 0.26);
  const H = M + innerH + footer;

  const c = document.createElement("canvas"); c.width = W; c.height = H;
  const ctx = c.getContext("2d");
  ctx.fillStyle = CONFIG.FRAME_COLOR; ctx.fillRect(0, 0, W, H);

  // Recadrage "cover" dans la zone photo
  const s = Math.max(innerW / bitmap.width, innerH / bitmap.height);
  const sw = innerW / s, sh = innerH / s;
  ctx.drawImage(bitmap, (bitmap.width - sw) / 2, (bitmap.height - sh) / 2, sw, sh, M, M, innerW, innerH);

  // Filtre "photomaton" : contraste + chaleur + saturation (pixels, compatible iOS)
  const d = ctx.getImageData(M, M, innerW, innerH), p = d.data;
  for (let i = 0; i < p.length; i += 4) {
    let r = p[i], g = p[i + 1], b = p[i + 2];
    const l = 0.3 * r + 0.59 * g + 0.11 * b;
    r = l + (r - l) * 1.25; g = l + (g - l) * 1.25; b = l + (b - l) * 1.25;   // saturation
    r = (r - 128) * 1.12 + 128 + 10; g = (g - 128) * 1.12 + 128 + 2; b = (b - 128) * 1.12 + 128 - 8; // contraste + chaud
    p[i] = Math.max(0, Math.min(255, r)); p[i + 1] = Math.max(0, Math.min(255, g)); p[i + 2] = Math.max(0, Math.min(255, b));
  }
  ctx.putImageData(d, M, M);

  // Vignettage léger
  const g = ctx.createRadialGradient(W / 2, M + innerH / 2, innerW * 0.35, W / 2, M + innerH / 2, innerW * 0.85);
  g.addColorStop(0, "rgba(0,0,0,0)"); g.addColorStop(1, "rgba(0,0,0,.28)");
  ctx.save(); ctx.beginPath(); ctx.rect(M, M, innerW, innerH); ctx.clip(); ctx.fillStyle = g; ctx.fillRect(M, M, innerW, innerH); ctx.restore();

  // Pied : logo + thème + date
  const fy = M + innerH, cy = fy + footer / 2;
  let textX = W / 2, align = "center";
  try {
    const logo = await loadImage(CONFIG.LOGO_URL);
    const lh = footer * 0.62, lw = lh * (logo.width / logo.height);
    ctx.drawImage(logo, M + 10, cy - lh / 2, lw, lh);
    textX = M + 10 + lw + (W - M - (M + 10 + lw)) / 2; // centre l'espace restant
  } catch { /* pas de logo : texte centré */ }

  ctx.textAlign = align; ctx.textBaseline = "middle";
  ctx.fillStyle = CONFIG.ACCENT_COLOR;
  let fs = footer * 0.36; ctx.font = `${fs}px "${CONFIG.FONT_THEME}"`;
  const maxW = (W - 2 * M) * (textX === W / 2 ? 1 : 0.72);
  while (ctx.measureText(CONFIG.THEME_NAME).width > maxW && fs > 20) { fs -= 2; ctx.font = `${fs}px "${CONFIG.FONT_THEME}"`; }
  ctx.fillText(CONFIG.THEME_NAME, textX, cy - footer * 0.08);
  ctx.fillStyle = "#16324f"; ctx.font = `600 ${footer * 0.12}px "Bricolage Grotesque", sans-serif`;
  ctx.fillText(`${CONFIG.CLUB_NAME} · ${new Date().toLocaleDateString("fr-FR")}`, textX, cy + footer * 0.28);

  return new Promise(res => c.toBlob(res, "image/jpeg", CONFIG.JPEG_QUALITY));
}

/* ---------- Galerie ---------- */
const blobCache = {};
async function fetchBlobUrl(path) {
  if (blobCache[path]) return blobCache[path];
  const r = await gh(path, { headers: { Accept: "application/vnd.github.raw+json" } });
  if (!r.ok) throw new Error(r.status);
  return (blobCache[path] = URL.createObjectURL(await r.blob()));
}

async function openGallery() {
  show("viewGallery");
  try {
    const r = await gh("photos");
    const files = r.status === 404 ? [] : await r.json();
    if (!r.ok && r.status !== 404) throw new Error(r.status);
    const photos = files.filter(f => f.name.endsWith(".jpg")).sort((x, y) => y.name.localeCompare(x.name));
    $("galleryEmpty").classList.toggle("hidden", photos.length > 0);
    $("grid").innerHTML = "";
    const io = new IntersectionObserver(entries => entries.forEach(async en => {
      if (!en.isIntersecting) return;
      io.unobserve(en.target);
      try { en.target.src = await fetchBlobUrl(en.target.dataset.path); } catch {}
    }), { rootMargin: "300px" });
    photos.forEach(f => {
      const img = document.createElement("img");
      img.className = "thumb"; img.alt = "Photo de la soirée"; img.dataset.path = f.path;
      img.onclick = () => openLightbox(f);
      $("grid").appendChild(img); io.observe(img);
    });
  } catch {
    showError("Impossible de charger la galerie. Scanne à nouveau le QR code de la soirée.");
  }
}

async function openLightbox(f) {
  $("lightbox").classList.remove("hidden");
  const url = await fetchBlobUrl(f.path);
  $("lightboxImg").src = url;
  $("lightboxDl").href = url; $("lightboxDl").download = `${CONFIG.THEME_NAME}-${f.name}`;
}
$("lightboxClose").onclick = () => $("lightbox").classList.add("hidden");
$("lightbox").onclick = (e) => { if (e.target.id === "lightbox") $("lightbox").classList.add("hidden"); };

/* ---------- Admin ---------- */
let taps = 0, tapTimer;
$("logoHeader").addEventListener("click", () => {
  taps++; clearTimeout(tapTimer); tapTimer = setTimeout(() => taps = 0, 1500);
  if (taps >= 5) { $("adminPanel").classList.remove("hidden"); taps = 0; }
});
if (WANT_ADMIN) $("adminPanel").classList.remove("hidden");

$("adminBtn").onclick = () => {
  if ($("adminPwd").value === CONFIG.ADMIN_PASSWORD) {
    $("adminLogin").classList.add("hidden"); $("adminActions").classList.remove("hidden"); clearError();
  } else showError("Mot de passe incorrect.");
};
$("btnPreview").onclick = () => { localStorage.setItem("capsule_admin_preview", "1"); location.reload(); };
$("btnUnlock").onclick = async () => {
  try {
    await putFile("unlocked.txt", new Blob(["1"]), "Galerie débloquée");
    alert("Galerie débloquée ! Les participants la verront dès qu'ils rechargent la page.");
    location.reload();
  } catch { showError("Échec du déblocage. Vérifie le jeton et le dépôt GitHub."); }
};

if (!token()) showError("Scanne le QR code de la soirée pour participer.");
init();
