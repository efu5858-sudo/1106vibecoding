function resolveUrl(value) { try { return value ? new URL(value, location.href).href : null; } catch (_) { return null; } }
function collectImages() {
  const found = new Map();
  document.querySelectorAll("img").forEach((image) => {
    const candidates = [image.currentSrc, image.src, image.dataset.src, image.dataset.original, image.dataset.lazySrc, image.dataset.lazy, image.getAttribute("data-original")];
    const src = candidates.map(resolveUrl).find(Boolean);
    const width = image.naturalWidth || image.width, height = image.naturalHeight || image.height;
    if (src && width >= 240 && height >= 240 && !found.has(src)) found.set(src, { src, width, height, alt: image.alt || "참고 이미지" });
  });
  return [...found.values()].sort((a, b) => b.width * b.height - a.width * a.height);
}
chrome.runtime.onMessage.addListener((message, _sender, respond) => {
  if (message.type === "GET_REFERENCE_IMAGES") respond({ images: collectImages() });
  if (message.type === "CAPTURE_FULL_PAGE" || message.type === "DOWNLOAD_IMAGES") {
    chrome.runtime.sendMessage(message).then(respond).catch((error) => respond({ ok: false, error: error.message }));
    return true;
  }
});
