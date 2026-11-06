(() => {
  const STORAGE_KEY = "savedArticles";
  const FEED_URL = "https://feeds.feedburner.com/geeknews-feed";
  const FEED_ORIGIN = "https://feeds.feedburner.com/*";
  const list = document.querySelector("#news-list");
  const status = document.querySelector("#news-status");
  const storageError = document.querySelector("#news-storage-error");
  const refresh = document.querySelector("#news-refresh");
  const latestTab = document.querySelector("#news-latest");
  const savedTab = document.querySelector("#news-saved");
  const permissionButton = document.querySelector("#news-permission");
  const restartButton = document.querySelector("#news-restart");
  let articles = [];
  let saved = [];
  let view = "latest";
  let loading = false;
  let loadFailed = false;
  let permissionMissing = false;
  let permissionMessage = "";
  let requestingPermission = false;
  let storageReady = false;
  let saving = false;

  function safeUrl(value) {
    try {
      const url = new URL(value);
      if (!["https:", "http:"].includes(url.protocol)) return null;
      url.hash = "";
      for (const key of [...url.searchParams.keys()]) {
        if (key.startsWith("utm_")) url.searchParams.delete(key);
      }
      return url.href;
    } catch { return null; }
  }

  function plainText(value) {
    const doc = new DOMParser().parseFromString(value, "text/html");
    doc.querySelectorAll("script, style").forEach(node => node.remove());
    return (doc.body.textContent || "").replace(/\s+/g, " ").trim();
  }

  function parseFeed(xml) {
    const doc = new DOMParser().parseFromString(xml, "application/xml");
    if (doc.querySelector("parsererror")) throw new Error("Invalid RSS");
    const seenLinks = new Set();
    const seenTitles = new Set();
    return [...doc.querySelectorAll("entry, item")].map(entry => {
      const text = selector => entry.querySelector(selector)?.textContent?.trim() || "";
      const link = entry.querySelector('link[rel="alternate"]') || entry.querySelector("link");
      const url = safeUrl(link?.getAttribute("href") || link?.textContent || "");
      const title = plainText(text("title"));
      const publishedAt = Date.parse(text("published") || text("pubDate") || text("updated"));
      const description = plainText(text("summary") || text("description") || text("content"));
      return { title, url, publishedAt, source: "GeekNews", description: description.length > 160 ? description.slice(0, 160) + "…" : description };
    }).filter(article => article.url && article.title && Number.isFinite(article.publishedAt))
      .sort((a, b) => b.publishedAt - a.publishedAt)
      .filter(article => {
        const titleKey = article.title.replace(/\s+/g, "").toLowerCase();
        if (seenLinks.has(article.url) || seenTitles.has(titleKey)) return false;
        seenLinks.add(article.url);
        seenTitles.add(titleKey);
        return true;
      }).slice(0, 5);
  }

  function renderNews() {
    latestTab.setAttribute("aria-pressed", String(view === "latest"));
    savedTab.setAttribute("aria-pressed", String(view === "saved"));
    savedTab.textContent = `저장한 기사 (${saved.length})`;
    refresh.disabled = loading;
    permissionButton.hidden = !permissionMissing;
    permissionButton.disabled = requestingPermission;
    if (view === "saved") {
      status.textContent = !storageReady ? "저장한 기사를 불러오지 못했어요" : saved.length ? `저장한 기사 ${saved.length}개` : "아직 저장한 기사가 없어요. ☆ 저장을 눌러 보세요.";
    } else {
      status.textContent = loading ? "뉴스를 불러오는 중…" : permissionMissing
        ? permissionMessage || "뉴스 사이트 접근이 허용되지 않았어요. ‘뉴스 접근 허용’을 눌러 주세요."
        : loadFailed
        ? (articles.length ? "새 뉴스를 가져오지 못했어요. 이전에 불러온 기사를 표시합니다." : "뉴스를 가져오지 못했어요. 새로고침을 눌러 주세요.")
        : `최신 뉴스 ${articles.length}개 · 게시일순`;
    }
    list.replaceChildren();
    for (const article of view === "saved" ? saved : articles) {
      const item = document.createElement("li");
      item.className = "news-card";
      const title = document.createElement("a");
      title.className = "news-title";
      title.textContent = article.title;
      title.href = article.url;
      title.target = "_blank";
      title.rel = "noopener noreferrer";
      const meta = document.createElement("p");
      meta.className = "news-meta";
      meta.textContent = `${article.source} · ${new Intl.DateTimeFormat("ko-KR", { timeZone: "Asia/Seoul", month: "long", day: "numeric", hour: "2-digit", minute: "2-digit" }).format(article.publishedAt)}`;
      const description = document.createElement("p");
      description.className = "news-description";
      description.textContent = article.description || "제목을 눌러 원문을 확인해 보세요.";
      const button = document.createElement("button");
      button.type = "button";
      button.className = "news-save";
      const isSaved = saved.some(value => value.url === article.url);
      button.textContent = isSaved ? "★ 저장 해제" : "☆ 저장";
      button.setAttribute("aria-label", `${article.title} ${isSaved ? "저장 해제" : "저장"}`);
      button.setAttribute("aria-pressed", String(isSaved));
      button.disabled = !storageReady || saving;
      button.addEventListener("click", () => toggleSaved(article));
      item.append(title, meta, description, button);
      list.append(item);
    }
  }

  async function toggleSaved(article) {
    if (!storageReady || saving) return;
    saving = true;
    storageError.hidden = true;
    const next = saved.some(value => value.url === article.url)
      ? saved.filter(value => value.url !== article.url) : [article, ...saved];
    renderNews();
    try {
      await chrome.storage.local.set({ [STORAGE_KEY]: next });
      saved = next;
    } catch {
      storageError.textContent = "저장 상태를 변경하지 못했어요. 다시 시도해 주세요.";
      storageError.hidden = false;
    } finally {
      saving = false;
      renderNews();
    }
  }

  async function loadNews() {
    if (loading) return;
    loading = true;
    loadFailed = false;
    permissionMissing = false;
    permissionMessage = "";
    restartButton.hidden = true;
    renderNews();
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), 10000);
    try {
      const granted = await chrome.permissions.contains({ origins: [FEED_ORIGIN] });
      if (!granted) {
        permissionMissing = true;
        throw new Error("RSS host permission is not granted. Reload the extension at chrome://extensions.");
      }
      const response = await fetch(FEED_URL, { signal: controller.signal, cache: "no-store" });
      if (!response.ok) throw new Error(`RSS request failed: HTTP ${response.status}`);
      const next = parseFeed(await response.text());
      if (!next.length) throw new Error("Empty RSS");
      articles = next;
    } catch (error) {
      loadFailed = true;
      console.warn("IT news request failed:", error);
    } finally {
      clearTimeout(timer);
      loading = false;
      renderNews();
    }
  }

  async function initializeNews() {
    try {
      const stored = (await chrome.storage.local.get(STORAGE_KEY))[STORAGE_KEY];
      const seen = new Set();
      saved = (Array.isArray(stored) ? stored : []).filter(article => {
        if (!article || typeof article.title !== "string" || !article.title || !safeUrl(article.url) || !Number.isFinite(article.publishedAt)) return false;
        article.url = safeUrl(article.url);
        if (seen.has(article.url)) return false;
        seen.add(article.url);
        return true;
      }).map(article => ({ ...article, source: "GeekNews", description: typeof article.description === "string" ? article.description : "" }));
      storageReady = true;
    } catch {
      storageError.textContent = "저장한 기사를 불러오지 못했어요. 팝업을 다시 열어 주세요.";
      storageError.hidden = false;
    }
    loadNews();
  }

  latestTab.addEventListener("click", () => { view = "latest"; renderNews(); });
  savedTab.addEventListener("click", () => { view = "saved"; renderNews(); });
  permissionButton.addEventListener("click", async () => {
    if (requestingPermission) return;
    const manifest = chrome.runtime.getManifest();
    const declared = [...(manifest.host_permissions || []), ...(manifest.optional_host_permissions || [])];
    if (!declared.includes(FEED_ORIGIN)) {
      permissionMessage = "크롬이 이전 설정을 사용하고 있어요. ‘확장 다시 시작’을 누른 뒤 팝업을 다시 열어 주세요.";
      restartButton.hidden = false;
      renderNews();
      return;
    }
    requestingPermission = true;
    try {
      // Request directly from the click so Chrome retains the user gesture.
      const result = chrome.permissions.request({ origins: [FEED_ORIGIN] });
      renderNews();
      if (await result) {
        await loadNews();
      } else {
        permissionMessage = "뉴스 접근을 허용해야 기사를 가져올 수 있어요. 다시 허용할 수 있습니다.";
      }
    } catch (error) {
      console.warn("IT news permission request failed:", error);
      permissionMessage = "권한을 적용하지 못했어요. ‘확장 다시 시작’을 누른 뒤 팝업을 다시 열어 주세요.";
      restartButton.hidden = false;
    } finally {
      requestingPermission = false;
      renderNews();
    }
  });
  restartButton.addEventListener("click", () => chrome.runtime.reload());
  refresh.addEventListener("click", loadNews);
  initializeNews();
})();
