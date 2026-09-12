/* ============================================================
   FT WEB2APK — Worker API client
   Encapsulates all backend communication (submit + poll).
   ============================================================ */

window.FT_API = (function () {
  const API = window.APP_CONFIG.API_BASE;

  /* ---- helpers ---- */

  function extractBuildId(payload) {
    if (!payload || typeof payload !== "object") return "";
    for (const key of ["buildId", "build_id", "projectId", "id", "uuid"]) {
      const v = payload[key];
      if (typeof v === "string" && /^[a-f0-9]{8}-[a-f0-9-]{27}$/i.test(v)) return v;
    }
    const match = JSON.stringify(payload).match(
      /[a-f0-9]{8}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{12}/i
    );
    return match ? match[0] : "";
  }

  function extractDownloadUrl(payload) {
    if (!payload || typeof payload !== "object") return "";
    for (const key of ["downloadUrl", "download_url", "apkUrl", "apk_url", "url"]) {
      const v = payload[key];
      if (typeof v === "string" && /^https?:\/\//i.test(v)) return v;
    }
    return extractDownloadUrl(payload.data) || extractDownloadUrl(payload.result);
  }

  /* ---- POST with FormData (icon uploaded as file) ---- */
  async function submitWithFile(fields, iconDataUri) {
    const fd = new FormData();
    fd.append("name", fields.name);
    fd.append("appName", fields.name);
    fd.append("package", fields.pkg);
    fd.append("packageName", fields.pkg);
    fd.append("version", fields.version);
    fd.append("versionName", fields.version);
    fd.append("versioncode", fields.versionCode);
    fd.append("versionCode", fields.versionCode);
    fd.append("url", fields.url);
    fd.append("websiteUrl", fields.url);

    const mimeMatch = iconDataUri.match(/^data:(image\/[a-z0-9.+-]+);base64,/i);
    const mime = (mimeMatch && mimeMatch[1]) || "image/png";
    const b64 = iconDataUri.split(",")[1] || "";
    const raw = atob(b64);
    const bytes = new Uint8Array(raw.length);
    for (let i = 0; i < raw.length; i++) bytes[i] = raw.charCodeAt(i);
    const ext = mime === "image/jpeg" ? "jpg" : mime === "image/webp" ? "webp" : "png";
    fd.append("icon", new Blob([bytes], { type: mime }), `icon.${ext}`);

    const res = await fetch(API, { method: "POST", body: fd, cache: "no-store" });
    return parseResponse(res);
  }

  /* ---- GET with query params (icon provided via URL) ---- */
  async function submitWithIconUrl(fields, iconUrl) {
    const u = new URL(API);
    u.searchParams.set("name", fields.name);
    u.searchParams.set("package", fields.pkg);
    u.searchParams.set("version", fields.version);
    u.searchParams.set("versioncode", fields.versionCode);
    u.searchParams.set("icon", iconUrl);
    u.searchParams.set("url", fields.url);

    const res = await fetch(u.toString(), {
      method: "GET",
      headers: { Accept: "application/json" },
      cache: "no-store"
    });
    return parseResponse(res);
  }

  async function parseResponse(response) {
    const text = await response.text();
    let data = {};
    try { data = JSON.parse(text); } catch (_) { /* keep empty */ }

    if (!response.ok) {
      const msg = (data && (data.error || data.message)) || ("API returned HTTP " + response.status);
      throw new Error(msg);
    }
    if (data && data.status === "error") {
      throw new Error(data.error || "Build request failed.");
    }
    return data;
  }

  /* ---- Poll build status until ready or timeout ---- */
  async function pollStatus({ buildId, statusUrl, downloadUrl, onProgress, onStage }) {
    const MAX_ATTEMPTS = 180;   // ~9 min at 3s intervals
    let attempts = 0;

    while (attempts < MAX_ATTEMPTS) {
      attempts++;
      await new Promise(r => setTimeout(r, 3000));

      try {
        const url = statusUrl || (API + "/status?build_id=" + encodeURIComponent(buildId));
        const res = await fetch(url, { cache: "no-store" });
        const data = await res.json();

        const ready = data.ready === true || data.status === "success";
        if (ready) {
          const finalUrl = data.downloadUrl || downloadUrl;
          if (finalUrl) return finalUrl;
        }

        if (data.stage && typeof onStage === "function") onStage(data.stage);
        if (typeof onProgress === "function") {
          if (typeof data.progress === "number") onProgress(data.progress);
          else onProgress(null); // signal "advance slightly"
        }
      } catch (_) {
        // transient network error — keep polling
      }
    }
    throw new Error("APK build is taking longer than expected. Please try again shortly.");
  }

  return {
    extractBuildId,
    extractDownloadUrl,
    submitWithFile,
    submitWithIconUrl,
    pollStatus
  };
})();
