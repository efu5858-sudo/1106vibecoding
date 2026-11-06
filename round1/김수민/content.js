(() => {
  // Reinjection replaces the previous widget rather than stacking buttons.
  try { globalThis.__dailyFocusCleanup?.(); } catch { /* Previous extension context may have expired. */ }
  document.getElementById("daily-focus-widget")?.remove();
  const popupUrl = chrome.runtime.getURL("popup.html");
  const extensionOrigin = chrome.runtime.getURL("").replace(/\/$/, "");
  const host = document.createElement("div");
  host.id = "daily-focus-widget";
  // Keep website styles out of the widget, and widget styles out of the website.
  host.style.setProperty("all", "initial", "important");
  host.style.setProperty("position", "fixed", "important");
  host.style.setProperty("inset", "auto 0 0 auto", "important");
  host.style.setProperty("z-index", "2147483647", "important");
  host.style.setProperty("display", "block", "important");
  host.style.setProperty("width", "0", "important");
  host.style.setProperty("height", "0", "important");
  host.style.setProperty("pointer-events", "none", "important");
  const root = host.attachShadow({ mode: "closed" });
  const style = document.createElement("style");
  style.textContent = `
    * { box-sizing: border-box; }
    .launcher, iframe { pointer-events: auto; }
    [hidden] { display: none !important; }
    .launcher { position: fixed; right: 24px; bottom: 24px; display: flex; align-items: center; gap: 10px; height: 52px; padding: 0 17px; border: 1px solid #ffffff24; border-radius: 18px; background: #213c65; color: #fff; box-shadow: 0 6px 24px #18253d30; font: 600 14px "Malgun Gothic", sans-serif; cursor: pointer; transition: background .15s, transform .15s; }
    .launcher:hover { background: #305485; transform: translateY(-2px); }
    .launcher:focus-visible { outline: 3px solid #93b5f5; outline-offset: 4px; }
    .mark { font-size: 20px; }
    .count { display: grid; place-items: center; min-width: 23px; height: 23px; padding: 0 5px; border-radius: 7px; background: #ffffff24; font-size: 11px; }
    iframe { position: fixed; right: 24px; bottom: 88px; width: min(380px, calc(100vw - 32px)); height: min(560px, calc(100dvh - 112px)); border: 1px solid #e1e7ef; border-radius: 20px; background: #fff; box-shadow: 0 16px 64px #18253d26, 0 2px 8px #18253d14; color-scheme: light; }
    @media (max-width: 480px) { .launcher { right: 16px; bottom: 16px; } iframe { right: 16px; bottom: 80px; } }
    @media (prefers-reduced-motion: reduce) { .launcher { transition: none; } }
  `;
  // A constructed stylesheet is isolated from the website's styles and does
  // not depend on the website allowing inline <style> elements in its CSP.
  const sheet = new CSSStyleSheet();
  sheet.replaceSync(style.textContent);
  root.adoptedStyleSheets = [sheet];
  const panel = document.createElement("iframe");
  panel.id = "daily-focus-panel";
  panel.title = "오늘 할 일";
  panel.hidden = true;
  const button = document.createElement("button");
  button.type = "button";
  button.className = "launcher";
  button.setAttribute("aria-expanded", "false");
  button.setAttribute("aria-controls", panel.id);
  const mark = document.createElement("span");
  mark.className = "mark";
  mark.textContent = "✓";
  mark.setAttribute("aria-hidden", "true");
  const label = document.createElement("span");
  label.textContent = "할 일";
  const badge = document.createElement("span");
  badge.className = "count";
  badge.hidden = true;
  badge.setAttribute("aria-hidden", "true");
  button.append(mark, label, badge);
  function setOpen(open) {
    if (open && !panel.hasAttribute("src")) panel.src = popupUrl;
    panel.hidden = !open;
    button.setAttribute("aria-expanded", String(open));
    if (open) panel.focus();
    else button.focus();
  }
  button.addEventListener("click", () => setOpen(panel.hidden));
  function onMessage(event) {
    if (event.source === panel.contentWindow && event.origin === extensionOrigin && event.data?.type === "daily-focus:close") setOpen(false);
  }
  function onKeydown(event) {
    if (event.key === "Escape" && !panel.hidden) setOpen(false);
  }
  window.addEventListener("message", onMessage);
  document.addEventListener("keydown", onKeydown);
  function updateBadge(todos) {
    const count = Array.isArray(todos) ? todos.filter((todo) => todo && typeof todo.text === "string" && !todo.completed).length : 0;
    badge.textContent = count > 99 ? "99+" : String(count);
    badge.hidden = count === 0;
    button.setAttribute("aria-label", `오늘 할 일 열기, 남은 할 일 ${count}개`);
  }
  root.append(panel, button);
  document.documentElement.append(host);
  // Restore the floating button if a client-side page transition removes it.
  const observer = new MutationObserver(() => {
    if (!host.isConnected) document.documentElement.append(host);
  });
  observer.observe(document.documentElement, { childList: true });
  function onStorageChanged(changes, area) {
    if (area === "local" && changes.todos) updateBadge(changes.todos.newValue);
  }
  chrome.storage.onChanged.addListener(onStorageChanged);
  globalThis.__dailyFocusCleanup = () => {
    observer.disconnect();
    window.removeEventListener("message", onMessage);
    document.removeEventListener("keydown", onKeydown);
    chrome.storage.onChanged.removeListener(onStorageChanged);
    host.remove();
  };
  chrome.storage.local.get("todos").then((stored) => updateBadge(stored.todos)).catch(() => updateBadge([]));
})();
