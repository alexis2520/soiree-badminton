/* =====================================================================
   ⚙️  CONFIGURATION DE L'ÉVÉNEMENT — c'est LE fichier à modifier
   Pour un nouvel événement : change les textes, le logo, le thème et EVENT_ID.
   ===================================================================== */
const CONFIG = {
  /* ── Événement ── */
  THEME_NAME: "Tournoi Fluo",                 // nom affiché sur l'appli et sur chaque photo
  SUBTITLE: "Vendredi 30 octobre · Immortalise la soirée, découvre les photos demain !",
  CLUB_NAME: "BCV 43",                        // petit texte sous le titre sur les photos
  LOGO_URL: "logo.png",                       // remplace simplement le fichier logo.png

  /* ── Stockage des photos (dépôt GitHub PRIVÉ) ── */
  GH_OWNER: "alexis2520",
  GH_REPO: "soiree-badminton-photos",
  EVENT_ID: "",            // "" = dossier de base. Nouvel événement : "soiree-noel-2026" (photos rangées à part)
  ADMIN_PASSWORD: "badminton2026",            // ⚠️ à changer
  JPEG_QUALITY: 0.85,

  /* ── Design ── */
  THEME: "fluo",           // "fluo" | "elegant" | "sunset" | le nom d'un thème que tu ajoutes plus bas
  THEME_OVERRIDES: {}      // pour retoucher UN détail sans tout refaire, ex : { accent: "#00e5ff" }
};

/* =====================================================================
   🎨  THEMES — copie un bloc, renomme-le, change les couleurs, puis mets son nom dans THEME
   Couleurs au format "#rrggbb". Polices : noms Google Fonts (fonts.google.com).
   ===================================================================== */
const THEMES = {
  fluo: {
    bg: ["#b00fc9", "#7a1fb8", "#d8369a"],     // dégradé du fond (3 couleurs)
    stripes: true,                              // rayures diagonales
    text: "#ffffff",                            // couleur du texte
    accent: "#5dff3a", accentText: "#111111",   // gros boutons + bouton photo / leur texte
    highlight: "#ffe93d",                       // compteur, barre « maintenir 3 s »
    outline: "#111111",                         // contour noir des lettres
    panel: "rgba(25,0,50,.45)",                 // fond des cartes
    frame: ["#16052b", "#2a0a4a"],              // fond du cadre photo
    frameBorder: "#ff3d9a",                     // liseré du cadre / halo du titre
    neon: ["#ff3d9a", "#2de2ff", "#5dff3a", "#ffe93d", "#ff7a3d", "#b57bff"], // contours aléatoires des photos
    titleColors: ["#5dff3a", "#ff7a3d", "#ffe93d", "#ff5a5a"],                // lettres du titre (1 couleur = unie)
    photoHue: [250, 330], photoSat: 60,         // teinte du fond de la photo finale (aléatoire dans cette plage)
    filter: { sat: 1.4, con: 1.15, tint: [8, -4, 10] }, // saturation, contraste, teinte (rouge, vert, bleu)
    titleFont: "Titan One", titleWeight: 400, bodyFont: "Fredoka",
    fonts: ["Titan+One", "Fredoka:wght@400;500;600"],
    floaters: ["🏸", "✨", "⚡", "🏸", "✨"]     // emojis qui flottent en fond
  },
  elegant: {
    bg: ["#0b1d3a", "#12315c", "#0b1d3a"], stripes: false, text: "#f8f5ec",
    accent: "#d4af37", accentText: "#111111", highlight: "#f5d76e", outline: "#000000",
    panel: "rgba(5,12,30,.55)", frame: ["#07122a", "#12315c"], frameBorder: "#d4af37",
    neon: ["#d4af37", "#f5e6b3", "#ffffff", "#b8c4d6"], titleColors: ["#d4af37", "#f5e6b3"],
    photoHue: [205, 230], photoSat: 50, filter: { sat: 1.1, con: 1.08, tint: [4, 0, -2] },
    titleFont: "Playfair Display", titleWeight: 800, bodyFont: "Poppins",
    fonts: ["Playfair+Display:wght@800", "Poppins:wght@400;500;600"], floaters: ["🏸", "⭐", "✨"]
  },
  sunset: {
    bg: ["#ff7a3d", "#ff3d6e", "#8a2be2"], stripes: true, text: "#ffffff",
    accent: "#ffe93d", accentText: "#2b0a3d", highlight: "#fff3a0", outline: "#2b0a3d",
    panel: "rgba(60,5,40,.4)", frame: ["#2b0a3d", "#5a1450"], frameBorder: "#ffe93d",
    neon: ["#ffe93d", "#ff7a3d", "#ff3d9a", "#ffffff"], titleColors: ["#ffe93d", "#ffffff", "#ff9f43"],
    photoHue: [290, 350], photoSat: 55, filter: { sat: 1.3, con: 1.1, tint: [12, 2, -6] },
    titleFont: "Lilita One", titleWeight: 400, bodyFont: "Nunito",
    fonts: ["Lilita+One", "Nunito:wght@400;600;700"], floaters: ["🏸", "🌅", "✨"]
  }
};
