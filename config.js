/* ============================================================
   FT WEB2APK — Global configuration
   ------------------------------------------------------------
   ⚠ EDIT ONLY THIS FILE for public configuration values.
   Do not scatter URLs/keys across the codebase.
   ============================================================ */

window.APP_CONFIG = {
  /* ---- Background video (edit this one line when ready) ----
     Paste a direct video file URL (must end in .mp4 / .webm, or a CDN
     delivery URL that streams a video file). Do NOT use Drive/Dropbox
     share links, YouTube links, or any URL that returns an HTML page. */
  BACKGROUND_VIDEO_URL: "",

  /* ---- WhatsApp group invite link ----
     e.g. https://chat.whatsapp.com/XXXXXXXXXXXXXXX  */
  WHATSAPP_GROUP_URL: "https://chat.whatsapp.com/",

  /* ---- Backend API (do not change unless you migrate the Worker) ---- */
  API_BASE: "https://ft-web2apk.ftshehryar10044.workers.dev/api",

  /* ---- Feature flags ---- */
  SHOW_JOIN_MODAL: true,          // Show the "Connect With Us" modal on first visit per session
  JOIN_MODAL_STORAGE_KEY: "ft_join_dismissed_v1",

  /* ---- Branding ---- */
  SITE_NAME: "FT WEB2APK"
};