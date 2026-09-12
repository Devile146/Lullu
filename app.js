/* ============================================================
   FT WEB2APK — Main application logic
   Validation, build orchestration, event wiring.
   ============================================================ */

(function () {
  "use strict";

  const CFG = window.APP_CONFIG;
  const UI = window.FT_UI;
  const API = window.FT_API;
  const dom = UI.dom;

  /* ============================================================
     Internal state
     ============================================================ */
  const state = {
    iconDataUri: "",
    busy: false,
    pollTimer: null
  };

  /* ============================================================
     Validation helpers
     ============================================================ */
  const PACKAGE_RE = /^[A-Za-z][A-Za-z0-9_]*(\.[A-Za-z][A-Za-z0-9_]*)+$/;
  const VERSION_RE = /^\d+\.\d+\.\d+$/;
  const VERSION_CODE_RE = /^[1-9]\d*$/;

  function isValidPackageName(v) { return PACKAGE_RE.test(v); }
  function isValidVersion(v) { return VERSION_RE.test(v); }
  function isValidVersionCode(v) { return VERSION_CODE_RE.test(v); }

  function normalizeUrl(v) {
    const trimmed = (v || "").trim();
    if (!trimmed) return "";
    return /^https?:\/\//i.test(trimmed) ? trimmed : "https://" + trimmed;
  }

  /* ============================================================
     Progress animation (deterministic crawl while polling)
     ============================================================ */
  function beginProgress() {
    let n = 3;
    UI.setBar(n);
    clearInterval(state.pollTimer);
    state.pollTimer = setInterval(() => {
      if (n < 86) {
        n += n < 35 ? 2 : n < 65 ? 1 : 0.35;
        UI.setBar(n);
      }
    }, 1000);
  }

  function stopProgress() {
    clearInterval(state.pollTimer);
    state.pollTimer = null;
  }

  /* ============================================================
     Reset panels
     ============================================================ */
  function resetPanels() {
    UI.show(dom.result, false);
    UI.show(dom.error, false);
    dom.download.removeAttribute("href");
    UI.setBar(3);
  }

  /* ============================================================
     Icon handling
     ============================================================ */
  function fileToDataUri(file) {
    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = () => resolve(String(reader.result));
      reader.onerror = reject;
      reader.readAsDataURL(file);
    });
  }

  function wireIconInputs() {
    dom.file.addEventListener("change", async () => {
      const f = dom.file.files && dom.file.files[0];
      if (!f) return;

      const allowed = ["image/png", "image/jpeg", "image/webp"];
      if (!allowed.includes(f.type) || f.size > 5 * 1024 * 1024) {
        dom.file.value = "";
        state.iconDataUri = "";
        dom.fileName.textContent = "Choose icon file";
        alert("Select a PNG, JPG, or WebP image up to 5MB.");
        return;
      }

      try {
        state.iconDataUri = await fileToDataUri(f);
        dom.iconUrl.value = "";
        dom.fileName.textContent = f.name;
        UI.setPreviewImage(state.iconDataUri);
      } catch (_) {
        state.iconDataUri = "";
        alert("Could not read that image. Please try another.");
      }
    });

    dom.iconUrl.addEventListener("input", () => {
      const v = dom.iconUrl.value.trim();
      if (!v) return;
      state.iconDataUri = "";
      UI.setPreviewImage(v);
    });
  }

  /* ============================================================
     Build flow
     ============================================================ */
  async function build() {
    if (state.busy) return;
    resetPanels();

    const name        = dom.name.value.trim();
    const pkg         = dom.pkg.value.trim();
    const version     = dom.ver.value.trim();
    const versionCode = dom.code.value.trim();
    const url         = normalizeUrl(dom.site.value);
    const iconUrl     = dom.iconUrl.value.trim();
    const iconSource  = state.iconDataUri || iconUrl;

    // --- validation ---
    if (!name) return alert("Enter App Name.");
    if (!isValidPackageName(pkg)) return alert("Enter a valid Package Name, e.g. com.example.app");
    if (!isValidVersion(version)) return alert("Version must be like 1.0.0");
    if (!isValidVersionCode(versionCode)) return alert("Version Code must be a positive number.");

    try { new URL(url); } catch (_) { return alert("Enter a valid Website URL."); }
    if (!iconSource) return alert("Upload an icon or enter an Image URL.");

    // --- start ---
    state.busy = true;
    UI.lockInputs(true);
    UI.show(dom.progress, true);
    UI.show(dom.error, false);
    dom.statusTitle.textContent = "Building APK…";
    dom.statusText.textContent  = "Submitting your app to FT Web2APK.";
    beginProgress();

    try {
      const fields = { name, pkg, version, versionCode, url };
      const payload = state.iconDataUri
        ? await API.submitWithFile(fields, state.iconDataUri)
        : await API.submitWithIconUrl(fields, iconSource);

      const buildId     = API.extractBuildId(payload);
      const directUrl   = API.extractDownloadUrl(payload);

      // If the API returned a direct URL with no build id — we're done.
      if (!buildId) {
        if (directUrl) {
          stopProgress();
          UI.setBar(100);
          UI.show(dom.progress, false);
          dom.download.href = directUrl;
          dom.resultText.textContent = name + " is ready to download.";
          UI.show(dom.result, true);
          return;
        }
        throw new Error("API did not return a build ID.");
      }

      // Otherwise poll until ready.
      dom.statusTitle.textContent = "Building APK…";
      dom.statusText.textContent  = payload.stage || "Your APK is queued for building.";
      UI.setBar(typeof payload.progress === "number" ? payload.progress : Math.max(8, UI.getProgress()));

      const statusUrl = payload.statusUrl || (CFG.API_BASE + "/status?build_id=" + encodeURIComponent(buildId));

      const finalUrl = await API.pollStatus({
        buildId,
        statusUrl,
        downloadUrl: directUrl,
        onStage: (stage) => { dom.statusText.textContent = stage; },
        onProgress: (val) => { if (val != null) UI.setBar(val); else UI.bumpBar(0.6); }
      });

      stopProgress();
      UI.setBar(100);
      UI.show(dom.progress, false);
      dom.download.href = finalUrl;
      dom.resultText.textContent = name + " is ready to download.";
      UI.show(dom.result, true);

    } catch (err) {
      stopProgress();
      UI.show(dom.progress, false);
      const msg = (err && err.message) ? err.message : "APK generation failed.";
      const friendly = /failed to fetch|networkerror|load failed/i.test(msg)
        ? "Could not connect to FT Web2APK API. Please check your connection and try again."
        : msg;
      dom.errorText.textContent = friendly;
      UI.show(dom.error, true);
    } finally {
      state.busy = false;
      UI.lockInputs(false);
    }
  }

  /* ============================================================
     Modal wiring
     ============================================================ */
  function wireModal() {
    // Configure WhatsApp link once
    if (dom.joinWhatsapp) {
      dom.joinWhatsapp.href = CFG.WHATSAPP_GROUP_URL || "#";
      if (!CFG.WHATSAPP_GROUP_URL) {
        dom.joinWhatsapp.setAttribute("aria-disabled", "true");
        dom.joinWhatsapp.addEventListener("click", (e) => e.preventDefault());
      }
    }

    if (dom.joinCancel) {
      dom.joinCancel.addEventListener("click", () => UI.closeJoinModal());
    }

    // Click on backdrop closes modal
    if (dom.joinModal) {
      dom.joinModal.addEventListener("click", (e) => {
        if (e.target === dom.joinModal) UI.closeJoinModal();
      });
    }
  }

  /* ============================================================
     Init
     ============================================================ */
  function init() {
    // 1) Background video — start loading ASAP
    UI.initBackgroundVideo();

    // 2) Icon inputs
    wireIconInputs();

    // 3) Modal wiring
    wireModal();

    // 4) Build button + retry
    dom.generate.addEventListener("click", build);
    dom.retry.addEventListener("click", build);

    // 5) Enter submits — but not inside the modal
    [dom.name, dom.pkg, dom.ver, dom.code, dom.site, dom.iconUrl].forEach((el) => {
      el.addEventListener("keydown", (e) => {
        if (e.key === "Enter") {
          e.preventDefault();
          build();
        }
      });
    });

    // 6) Modal display
    const showModal = CFG.SHOW_JOIN_MODAL && !UI.hasDismissedJoinModal();

    if (showModal) {
      // Render the app behind the modal but keep it dimmed until dismissed
      UI.openJoinModal();
      // Reveal behind-the-modal layout immediately (still partly hidden by backdrop)
      // We add app-ready on close only, to give a nice reveal.
      dom.joinCancel.addEventListener("click", () => UI.revealApp(), { once: true });
      // If user closes via ESC/backdrop, also reveal
      const revealOnce = () => { UI.revealApp(); document.removeEventListener("ft:modal-closed", revealOnce); };
      document.addEventListener("ft:modal-closed", revealOnce);
    } else {
      UI.revealApp();
    }
  }

  // Run after DOM is ready (scripts are at end of body, but be safe)
  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", init);
  } else {
    init();
  }
})();