/* =========================================================
   FT WEB2APK — Central Configuration
   ---------------------------------------------------------
   👉 CHANGE ONLY THESE TWO VALUES WHEN YOU GET THEM:
      1. BACKGROUND_VIDEO_URL
      2. WHATSAPP_GROUP_URL
   Everything else is optional branding / behaviour.
   ========================================================= */

window.APP_CONFIG = {
  /* ---- Backend API (unchanged) ---- */
  API_BASE: "https://ft-web2apk.ftshehryar10044.workers.dev/api",

  /* ---- Background video -------------------------------------------------
     Paste a DIRECT video file URL (must end in .mp4 or .webm).
     Examples of valid sources:
       • Cloudflare R2 bucket public URL
       • Bunny.net Storage CDN URL
       • jsDelivr / GitHub raw file URL
     Invalid: Google Drive share link, YouTube link, Dropbox preview link.
     Leave empty ("") to disable the video and use a pure dark gradient.
  ---------------------------------------------------------------------- */
  BACKGROUND_VIDEO_URL: "",

  /* Optional poster shown immediately while the video loads.
     Use a small (100–200KB) JPG/WebP. Can be a data URI or a URL. */
  BACKGROUND_POSTER_URL: "",

  /* ---- WhatsApp group --------------------------------------------------
     Full invite link, e.g. https://chat.whatsapp.com/XXXXXXXXXXXXXX
     Leave empty ("") to hide the popup automatically.
  ---------------------------------------------------------------------- */
  WHATSAPP_GROUP_URL: "",

  /* ---- Feature flags ---- */
  SHOW_JOIN_MODAL: true,        // show the "Connect With Us" popup on first visit
  JOIN_MODAL_SESSION_ONLY: true,// true  = once per browser tab session
                                // false = remember forever (localStorage)

  /* ---- Branding (optional) ---- */
  SITE_NAME: "FT WEB2APK",
  SITE_TAGLINE: "Professional Web2APK Builder — Website → APK",
  FOOTER_TEXT: "© 2026 Dev TECHNICAL FAHAD — All Rights Reserved",

  /* ---- Behaviour ---- */
  ALLOWED_ICON_MIME: ["image/png", "image/jpeg", "image/webp"],
  MAX_ICON_BYTES: 5 * 1024 * 1024,   // 5 MB
  POLL_INTERVAL_MS: 3000,
  POLL_MAX_ATTEMPTS: 180
};