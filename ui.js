/* ============================================================
   FT WEB2APK — UI helpers
   DOM refs, modal control, progress bar, icon preview.
   ============================================================ */

window.FT_UI = (function () {
  const $ = (id) => document.getElementById(id);

  /* ---- DOM references ---- */
  const dom = {
    // form
    name: $("name"),
    pkg: $("pkg"),
    ver: $("ver"),
    code: $("code"),
    site: $("site"),
    file: $("file"),
    iconUrl: $("iconUrl"),
    fileName: $("fileName"),
    preview: $("preview"),
    generate: $("generate"),

    // panels
    progress: $("progress"),
    result: $("result"),
    error: $("error"),

    // progress
    bar: $("bar"),
    statusTitle: $("statusTitle"),
    statusText: $("statusText"),

    // result / error
    resultText: $("resultText"),
    download: $("download"),
    errorText: $("errorText"),
    retry: $("retry"),

    // modal
    joinModal: $("join-modal"),
    joinCard: $("join-modal-card"),
    joinWhatsapp: $("join-whatsapp"),
    joinCancel: $("join-cancel"),

    // background
    bgVideo: $("bg-video")
  };

  /* ============================================================
     Panel visibility
     ============================================================ */
  function show(el, visible) {
    if (!el) return;
    el.classList.toggle("hide", !visible);
  }

  /* ============================================================
     Progress bar
     ============================================================ */
  let progressValue = 3;

  function setBar(value) {
    progressValue = Math.max(3, Math.min(98, value));
    if (dom.bar) dom.bar.style.width = progressValue + "%";
  }

  function bumpBar(amount) {
    setBar(Math.min(90, progressValue + (amount || 0.6)));
  }

  function getProgress() { return progressValue; }

  /* ============================================================
     Icon preview (safe: no innerHTML with user data)
     ============================================================ */
  function setPreviewImage(src) {
    if (!dom.preview) return;
    dom.preview.textContent = "";
    if (!src) {
      const span = document.createElement("span");
      span.textContent = "ICON";
      dom.preview.appendChild(span);
      return;
    }
    const img = document.createElement("img");
    img.alt = "Icon preview";
    img.src = src;
    img.addEventListener("error", () => {
      dom.preview.textContent = "";
      const span = document.createElement("span");
      span.textContent = "INVALID";
      dom.preview.appendChild(span);
    });
    dom.preview.appendChild(img);
  }

  /* ============================================================
     Input lock during build
     ============================================================ */
  function lockInputs(lock) {
    [dom.name, dom.pkg, dom.ver, dom.code, dom.site, dom.iconUrl, dom.file, dom.generate]
      .forEach(el => { if (el) el.disabled = !!lock; });
  }

  /* ============================================================
     Join modal
     ============================================================ */
  let lastFocused = null;

  function openJoinModal() {
    if (!dom.joinModal) return;
    lastFocused = document.activeElement;
    dom.joinModal.hidden = false;
    dom.joinModal.classList.remove("is-closing");
    dom.joinCard.classList.remove("is-closing");
    document.body.classList.add("modal-open");

    // focus the cancel button (safer default than auto-opening WhatsApp)
    setTimeout(() => {
      if (dom.joinCancel) dom.joinCancel.focus();
    }, 60);

    document.addEventListener("keydown", onModalKey);
  }

  function closeJoinModal() {
    if (!dom.joinModal) return;
    dom.joinModal.classList.add("is-closing");
    dom.joinCard.classList.add("is-closing");

    const finish = () => {
      dom.joinModal.hidden = true;
      dom.joinModal.classList.remove("is-closing");
      dom.joinCard.classList.remove("is-closing");
      document.body.classList.remove("modal-open");
      document.removeEventListener("keydown", onModalKey);
      if (lastFocused && typeof lastFocused.focus === "function") {
        try { lastFocused.focus(); } catch (_) {}
      }
    };

    // Respect reduced motion
    const reduce = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    if (reduce) finish();
    else setTimeout(finish, 320);

    markJoinModalDismissed();
  }

  function onModalKey(e) {
    if (e.key === "Escape") {
      e.preventDefault();
      closeJoinModal();
    }
  }

  /* ============================================================
     Session persistence for the join modal
     ============================================================ */
  function hasDismissedJoinModal() {
    try {
      return sessionStorage.getItem(window.APP_CONFIG.JOIN_MODAL_STORAGE_KEY) === "1";
    } catch (_) {
      return false;
    }
  }

  function markJoinModalDismissed() {
    try {
      sessionStorage.setItem(window.APP_CONFIG.JOIN_MODAL_STORAGE_KEY, "1");
    } catch (_) { /* storage disabled — ignore */ }
  }

  /* ============================================================
     Background video
     ============================================================ */
  function initBackgroundVideo() {
    const video = dom.bgVideo;
    if (!video) return;

    const url = (window.APP_CONFIG.BACKGROUND_VIDEO_URL || "").trim();
    if (!url) {
      // No video configured yet — the .bg-fallback layer is already visible.
      // Remove the empty video to avoid console noise.
      video.remove();
      dom.bgVideo = null;
      return;
    }

    const source = document.createElement("source");
    source.src = url;
    source.type = url.toLowerCase().endsWith(".webm") ? "video/webm" : "video/mp4";
    video.appendChild(source);
    video.load();

    // Try to autoplay; on failure keep poster visible.
    const p = video.play();
    if (p && typeof p.catch === "function") p.catch(() => { /* keep poster */ });

    // Make sure errors don't spam console
    video.addEventListener("error", () => { video.style.display = "none"; }, { once: true });
  }

  /* ============================================================
     Reveal main app after modal
     ============================================================ */
  function revealApp() {
    // Ensure the layout paints before fading in
    requestAnimationFrame(() => {
      document.body.classList.add("app-ready");
    });
  }

  return {
    dom,
    $,
    show,
    setBar,
    bumpBar,
    getProgress,
    setPreviewImage,
    lockInputs,
    openJoinModal,
    closeJoinModal,
    hasDismissedJoinModal,
    initBackgroundVideo,
    revealApp
  };
})();