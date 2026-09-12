/* =========================================================
   FT WEB2APK — Application Script
   - Loads background video from APP_CONFIG
   - Handles the Join (WhatsApp) modal
   - Handles the entire Web2APK builder flow (unchanged logic)
   ========================================================= */
(() => {
  "use strict";

  const CFG = window.APP_CONFIG || {};

  /* =====================================================
     1. Background video loader (non-blocking, graceful)
     ===================================================== */
  function initBackgroundVideo() {
    const video = document.getElementById("bgVideo");
    if (!video) return;

    if (CFG.BACKGROUND_POSTER_URL) {
      video.setAttribute("poster", CFG.BACKGROUND_POSTER_URL);
    }

    const url = (CFG.BACKGROUND_VIDEO_URL || "").trim();
    if (!url) {
      // No video configured — the dark overlay alone provides the backdrop.
      return;
    }

    // Only attach the source once we know we have a valid-looking URL.
    video.src = url;

    const reveal = () => video.classList.add("is-ready");
    const fail   = () => {
      // Silent fallback: leave the overlay gradient in place.
      video.removeAttribute("src");
      video.load?.();
    };

    video.addEventListener("loadeddata", reveal, { once: true });
    video.addEventListener("canplay",    reveal, { once: true });
    video.addEventListener("error",      fail,   { once: true });

    // Some browsers block autoplay until a user gesture.
    // If it fails, retry once on the first user interaction.
    const playPromise = video.play();
    if (playPromise && typeof playPromise.catch === "function") {
      playPromise.catch(() => {
        const retry = () => {
          video.play().then(reveal).catch(() => {});
          window.removeEventListener("pointerdown", retry);
          window.removeEventListener("touchstart", retry);
          window.removeEventListener("keydown", retry);
        };
        window.addEventListener("pointerdown", retry, { once: true, passive: true });
        window.addEventListener("touchstart",  retry, { once: true, passive: true });
        window.addEventListener("keydown",     retry, { once: true });
      });
    }
  }

  /* =====================================================
     2. Join modal (WhatsApp)
     ===================================================== */
  const SESSION_KEY = "ftw2a_join_seen";
  const LOCAL_KEY   = "ftw2a_join_seen_persistent";

  function hasSeenJoinModal() {
    try {
      if (CFG.JOIN_MODAL_SESSION_ONLY !== false) {
        return sessionStorage.getItem(SESSION_KEY) === "1";
      }
      return localStorage.getItem(LOCAL_KEY) === "1";
    } catch {
      // If storage is corrupted / blocked, treat as not seen but never crash.
      return false;
    }
  }

  function markJoinSeen() {
    try {
      if (CFG.JOIN_MODAL_SESSION_ONLY !== false) {
        sessionStorage.setItem(SESSION_KEY, "1");
      } else {
        localStorage.setItem(LOCAL_KEY, "1");
      }
    } catch {/* ignore */}
  }

  function initJoinModal() {
    const modal     = document.getElementById("joinModal");
    const waBtn     = document.getElementById("whatsappBtn");
    const cancelBtn = document.getElementById("cancelJoin");
    const appRoot   = document.getElementById("appRoot");
    if (!modal || !waBtn || !cancelBtn || !appRoot) return;

    const waUrl = (CFG.WHATSAPP_GROUP_URL || "").trim();

    const shouldShow =
      CFG.SHOW_JOIN_MODAL !== false &&
      waUrl &&
      !hasSeenJoinModal();

    const revealApp = () => {
      appRoot.setAttribute("aria-hidden", "false");
      appRoot.classList.add("is-visible");
    };

    if (!shouldShow) {
      modal.hidden = true;
      revealApp();
      return;
    }

    // Configure WhatsApp button.
    waBtn.href = waUrl;

    // Prepare modal.
    modal.hidden = false;
    // Force a reflow so the transition triggers.
    void modal.offsetWidth;
    modal.classList.add("is-open");
    cancelBtn.focus({ preventScroll: true });

    let closing = false;
    const closeModal = (openedWhatsApp = false) => {
      if (closing) return;
      closing = true;
      modal.classList.remove("is-open");
      markJoinSeen();

      const onEnd = () => {
        modal.hidden = true;
        modal.removeEventListener("transitionend", onEnd);
      };
      modal.addEventListener("transitionend", onEnd, { once: true });
      // Safety net in case transitionend doesn't fire.
      setTimeout(onEnd, 450);

      revealApp();
      if (!openedWhatsApp) cancelBtn.blur();
    };

    cancelBtn.addEventListener("click", () => closeModal(false));

    // Escape key closes the modal (accessibility).
    document.addEventListener("keydown", (e) => {
      if (e.key === "Escape" && modal.classList.contains("is-open")) {
        closeModal(false);
      }
    });

    // WhatsApp click → close modal too (open link happens natively via <a>).
    waBtn.addEventListener("click", () => closeModal(true));
  }

  /* =====================================================
     3. Web2APK Builder — preserved logic
     ===================================================== */
  function initBuilder() {
    const API = CFG.API_BASE;
    const $ = (id) => document.getElementById(id);

    const name      = $("name");
    const pkg       = $("pkg");
    const ver       = $("ver");
    const code      = $("code");
    const site      = $("site");
    const file      = $("file");
    const iconUrl   = $("iconUrl");
    const preview   = $("preview");
    const generate  = $("generate");
    const progress  = $("progress");
    const result    = $("result");
    const error     = $("error");
    const bar       = $("bar");
    const statusTitle = $("statusTitle");
    const statusText  = $("statusText");
    const download  = $("download");
    const errorText = $("errorText");
    const resultText= $("resultText");
    const fileNameEl= $("fileName");
    const retryBtn  = $("retry");

    if (!name || !generate || !API) return;

    let iconData = "";
    let busy = false;
    let pollTimer = null;
    let progressValue = 3;

    const show = (el, v) => el.classList.toggle("hide", !v);
    const packageOk = (v) => /^[A-Za-z][A-Za-z0-9_]*(\.[A-Za-z][A-Za-z0-9_]*)+$/.test(v);
    const normalize = (v) => /^https?:\/\//i.test(v.trim()) ? v.trim() : "https://" + v.trim();

    function setBar(v) {
      progressValue = Math.max(3, Math.min(98, v));
      bar.style.width = progressValue + "%";
    }

    function reset() {
      show(result, false);
      show(error, false);
      download.removeAttribute("href");
      setBar(3);
    }

    /* -------- Safe icon preview (no innerHTML) -------- */
    function previewImage(src) {
      // Clear preview safely.
      while (preview.firstChild) preview.removeChild(preview.firstChild);

      const img = document.createElement("img");
      img.alt = "Icon preview";
      img.decoding = "async";
      img.loading = "lazy";
      img.onerror = () => {
        while (preview.firstChild) preview.removeChild(preview.firstChild);
        const span = document.createElement("span");
        span.textContent = "ICON";
        preview.appendChild(span);
      };
      img.src = src;
      preview.appendChild(img);
    }

    function dataUri(f) {
      return new Promise((resolve, reject) => {
        const r = new FileReader();
        r.onload = () => resolve(String(r.result));
        r.onerror = reject;
        r.readAsDataURL(f);
      });
    }

    /* -------- Safe URL check for icon URL -------- */
    function isSafeHttpUrl(v) {
      try {
        const u = new URL(v);
        return u.protocol === "http:" || u.protocol === "https:";
      } catch { return false; }
    }

    /* -------- File input -------- */
    file.addEventListener("change", async () => {
      const f = file.files && file.files[0];
      if (!f) return;

      const allowed = Array.isArray(CFG.ALLOWED_ICON_MIME)
        ? CFG.ALLOWED_ICON_MIME
        : ["image/png", "image/jpeg", "image/webp"];
      const maxBytes = Number(CFG.MAX_ICON_BYTES) || 5 * 1024 * 1024;

      if (!allowed.includes(f.type) || f.size > maxBytes) {
        file.value = "";
        iconData = "";
        fileNameEl.textContent = "Choose icon file";
        alert("Select a PNG, JPG, or WebP image up to 5MB.");
        return;
      }
      iconData = await dataUri(f);
      iconUrl.value = "";
      fileNameEl.textContent = f.name;
      previewImage(iconData);
    });

    /* -------- Icon URL input -------- */
    iconUrl.addEventListener("input", () => {
      const v = iconUrl.value.trim();
      if (!v) return;
      if (!isSafeHttpUrl(v)) return; // Don't preview unsafe protocols.
      iconData = "";
      previewImage(v);
    });

    /* -------- Build ID extraction (unchanged) -------- */
    function extractId(d) {
      const keys = ["buildId", "build_id", "projectId", "id", "uuid"];
      for (const k of keys) {
        if (d && typeof d[k] === "string" &&
            /^[a-f0-9]{8}-[a-f0-9-]{27}$/i.test(d[k])) return d[k];
      }
      const s = JSON.stringify(d || "").match(
        /[a-f0-9]{8}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{12}/i
      );
      return s ? s[0] : "";
    }

    function extractUrl(d) {
      if (!d || typeof d !== "object") return "";
      for (const k of ["downloadUrl","download_url","apkUrl","apk_url","url"]) {
        if (typeof d[k] === "string" && /^https?:\/\//i.test(d[k])) return d[k];
      }
      return extractUrl(d.data) || extractUrl(d.result);
    }

    /* -------- Progress animation -------- */
    function beginProgress() {
      let n = 3;
      setBar(n);
      clearInterval(pollTimer);
      pollTimer = setInterval(() => {
        if (n < 86) {
          n += n < 35 ? 2 : n < 65 ? 1 : 0.35;
          setBar(n);
        }
      }, 1000);
    }
    function stopProgress(ok) {
      clearInterval(pollTimer);
      if (ok) setBar(100);
    }

    /* -------- Poll status (unchanged behaviour) -------- */
    async function pollStatus(buildId, statusUrl, downloadUrl) {
      const interval = Number(CFG.POLL_INTERVAL_MS) || 3000;
      const maxAttempts = Number(CFG.POLL_MAX_ATTEMPTS) || 180;
      let attempts = 0;

      while (attempts < maxAttempts) {
        attempts++;
        await new Promise((r) => setTimeout(r, interval));
        try {
          const u = statusUrl || (API + "/status?build_id=" + encodeURIComponent(buildId));
          const r = await fetch(u, { cache: "no-store" });
          const d = await r.json();

          if (d.ready === true || d.status === "success") {
            const finalUrl = d.downloadUrl || downloadUrl;
            if (finalUrl) {
              stopProgress(true);
              show(progress, false);
              resultText.textContent = name.value.trim() + " is ready to download.";
              download.href = finalUrl;
              show(result, true);
              return true;
            }
          }
          if (d.stage) statusText.textContent = d.stage;
          if (typeof d.progress === "number") setBar(d.progress);
          else setBar(Math.min(90, progressValue + 0.6));
        } catch {/* swallow and retry */}
        statusText.textContent = "APK is still being built. Please keep this page open.";
      }
      throw new Error("APK build is taking longer than expected. Please try again shortly.");
    }

    /* -------- Build (unchanged core logic) -------- */
    async function build() {
      if (busy) return;
      reset();

      const n = name.value.trim();
      const p = pkg.value.trim();
      const v = ver.value.trim();
      const c = code.value.trim();
      const s = normalize(site.value);
      const i = iconData || iconUrl.value.trim();

      if (!n) return alert("Enter App Name.");
      if (!packageOk(p)) return alert("Enter a valid Package Name, e.g. com.example.app");
      if (!/^\d+\.\d+\.\d+$/.test(v)) return alert("Version must be like 1.0.0");
      if (!/^[1-9]\d*$/.test(c)) return alert("Version Code must be a positive number.");
      try { new URL(s); } catch { return alert("Enter a valid Website URL."); }
      if (!i) return alert("Upload an icon or enter an Image URL.");
      if (!iconData && !isSafeHttpUrl(i)) return alert("Image URL must be a valid http(s) link.");

      busy = true;
      generate.disabled = true;
      show(progress, true);
      show(error, false);
      statusTitle.textContent = "Building APK…";
      statusText.textContent = "Submitting your app to FT Web2APK.";
      beginProgress();

      try {
        let response;

        if (iconData) {
          // Multipart upload path (unchanged).
          const fd = new FormData();
          fd.append("name", n);
          fd.append("appName", n);
          fd.append("package", p);
          fd.append("packageName", p);
          fd.append("version", v);
          fd.append("versionName", v);
          fd.append("versioncode", c);
          fd.append("versionCode", c);
          fd.append("url", s);
          fd.append("websiteUrl", s);

          const mime = (iconData.match(/^data:(image\/[a-z0-9.+-]+);base64,/i) || [])[1] || "image/png";
          const raw = atob(iconData.split(",")[1]);
          const bytes = new Uint8Array(raw.length);
          for (let x = 0; x < raw.length; x++) bytes[x] = raw.charCodeAt(x);

          const ext = mime === "image/jpeg" ? "jpg" : mime === "image/webp" ? "webp" : "png";
          fd.append("icon", new Blob([bytes], { type: mime }), "icon." + ext);

          response = await fetch(API, { method: "POST", body: fd, cache: "no-store" });
        } else {
          // GET path with query params (unchanged).
          const u = new URL(API);
          u.searchParams.set("name", n);
          u.searchParams.set("package", p);
          u.searchParams.set("version", v);
          u.searchParams.set("versioncode", c);
          u.searchParams.set("icon", i);
          u.searchParams.set("url", s);

          response = await fetch(u.toString(), {
            method: "GET",
            headers: { Accept: "application/json" },
            cache: "no-store"
          });
        }

        const raw = await response.text();
        let d = {};
        try { d = JSON.parse(raw); } catch {/* non-JSON */}

        if (!response.ok) {
          throw new Error(d.error || d.message || "API returned HTTP " + response.status);
        }
        if (d.status === "error") {
          throw new Error(d.error || "Build request failed");
        }

        const id = extractId(d);
        const direct = extractUrl(d);

        if (!id) {
          if (direct) {
            stopProgress(true);
            show(progress, false);
            download.href = direct;
            resultText.textContent = n + " is ready to download.";
            show(result, true);
            return;
          }
          throw new Error("API did not return a build ID.");
        }

        statusTitle.textContent = "Building APK…";
        statusText.textContent = d.stage || "Your APK is queued for building.";
        setBar(typeof d.progress === "number" ? d.progress : Math.max(8, progressValue));

        const statusUrl = d.statusUrl || (API + "/status?build_id=" + encodeURIComponent(id));
        await pollStatus(id, statusUrl, direct);

      } catch (e) {
        stopProgress(false);
        show(progress, false);
        errorText.textContent =
          /failed to fetch|networkerror|load failed/i.test(e.message || "")
            ? "Could not connect to FT Web2APK API. Please check the Worker URL and try again."
            : (e.message || "APK generation failed.");
        show(error, true);
      } finally {
        busy = false;
        generate.disabled = false;
      }
    }

    generate.addEventListener("click", build);
    retryBtn.addEventListener("click", build);

    [name, pkg, ver, code, site, iconUrl].forEach((el) => {
      el.addEventListener("keydown", (e) => {
        if (e.key === "Enter") { e.preventDefault(); build(); }
      });
    });
  }

  /* =====================================================
     4. Apply branding from config
     ===================================================== */
  function applyBranding() {
    const setText = (sel, val) => {
      const el = document.querySelector(sel);
      if (el && val) el.textContent = val;
    };
    setText(".sub", CFG.SITE_TAGLINE);
    setText(".watermark", CFG.FOOTER_TEXT);
    if (CFG.SITE_NAME) document.title = CFG.SITE_NAME;
  }

  /* =====================================================
     Bootstrap
     ===================================================== */
  function boot() {
    applyBranding();
    initBackgroundVideo();
    initJoinModal();
    initBuilder();
  }

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", boot, { once: true });
  } else {
    boot();
  }
})();