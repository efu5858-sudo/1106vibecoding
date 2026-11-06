const REFERENCE_FOLDER = "detail-page-references";

function sanitizeFileName(value) {
  return (value || "detail-page").replace(/[\\/:*?\"<>|]/g, "-").replace(/\s+/g, " ").trim().slice(0, 80) || "detail-page";
}
function dateStamp() {
  const d = new Date();
  return [d.getFullYear(), d.getMonth() + 1, d.getDate(), d.getHours(), d.getMinutes(), d.getSeconds()]
    .map((n, i) => i ? String(n).padStart(2, "0") : n).join("-");
}
async function save(options) { return chrome.downloads.download({ conflictAction: "uniquify", saveAs: false, ...options }); }

async function captureFullPage(tab) {
  let attached = false;
  try {
    await chrome.debugger.attach({ tabId: tab.id }, "1.3"); attached = true;
    const shot = await chrome.debugger.sendCommand({ tabId: tab.id }, "Page.captureScreenshot", { format: "png", captureBeyondViewport: true, fromSurface: true });
    const filename = `${REFERENCE_FOLDER}/${sanitizeFileName(tab.title)}_${dateStamp()}.png`;
    await save({ url: `data:image/png;base64,${shot.data}`, filename });
    return { ok: true };
  } catch (error) { return { ok: false, error: error.message || "전체 페이지를 캡처할 수 없습니다." }; }
  finally { if (attached) try { await chrome.debugger.detach({ tabId: tab.id }); } catch (_) {} }
}

chrome.runtime.onMessage.addListener((message, sender, respond) => {
  if (message.type === "CAPTURE_FULL_PAGE") { captureFullPage(sender.tab).then(respond); return true; }
  if (message.type === "DOWNLOAD_IMAGES") {
    (async () => {
      const urls = [...new Set(message.urls || [])].filter((url) => /^(https?:|data:image\/)/.test(url));
      const title = sanitizeFileName(sender.tab?.title);
      const results = await Promise.allSettled(urls.map((url, index) => {
        const ext = (url.match(/\.([a-zA-Z0-9]{2,5})(?:[?#]|$)/)?.[1] || "jpg").toLowerCase();
        return save({ url, filename: `${REFERENCE_FOLDER}/${title}/image-${String(index + 1).padStart(2, "0")}.${ext}` });
      }));
      respond({ ok: true, count: results.filter((result) => result.status === "fulfilled").length });
    })(); return true;
  }
});
