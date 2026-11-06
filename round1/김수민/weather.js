(() => {
  const status = document.querySelector("#weather-status");
  // Seoul coordinates. Requests run in the extension page, not in the website.
  const url = new URL("https://api.open-meteo.com/v1/forecast");
  url.search = new URLSearchParams({
    latitude: "37.5665",
    longitude: "126.9780",
    current: "temperature_2m,weather_code",
    temperature_unit: "celsius",
    timezone: "Asia/Seoul",
    forecast_days: "1"
  }).toString();

  // WMO weather codes documented by Open-Meteo.
  const descriptions = {
    0: "맑음", 1: "대체로 맑음", 2: "구름 조금", 3: "흐림",
    45: "안개", 48: "착빙 안개",
    51: "약한 이슬비", 53: "이슬비", 55: "강한 이슬비",
    56: "약한 어는 이슬비", 57: "강한 어는 이슬비",
    61: "약한 비", 63: "비", 65: "강한 비",
    66: "약한 어는 비", 67: "강한 어는 비",
    71: "약한 눈", 73: "눈", 75: "강한 눈", 77: "싸락눈",
    80: "약한 소나기", 81: "소나기", 82: "강한 소나기",
    85: "약한 눈 소나기", 86: "강한 눈 소나기",
    95: "뇌우", 96: "우박을 동반한 뇌우", 97: "강한 뇌우", 99: "강한 우박을 동반한 뇌우"
  };
  let loading = false;
  let lastLoaded = 0;

  async function loadWeather() {
    if (loading) return;
    loading = true;
    status.textContent = "불러오는 중…";
    status.classList.remove("weather-error");
    status.setAttribute("aria-busy", "true");
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 10000);
    try {
      const response = await fetch(url, { signal: controller.signal, credentials: "omit" });
      if (!response.ok) throw new Error("Weather request failed");
      const data = await response.json();
      const temperature = data.current?.temperature_2m;
      const code = data.current?.weather_code;
      if (!Number.isFinite(temperature) || !Number.isInteger(code) || !descriptions[code]) {
        throw new Error("Invalid weather response");
      }
      status.textContent = `현재 ${temperature.toFixed(1)}°C · ${descriptions[code]}`;
      lastLoaded = Date.now();
    } catch {
      status.textContent = "날씨를 가져오지 못했어요";
      status.classList.add("weather-error");
    } finally {
      clearTimeout(timeout);
      loading = false;
      status.setAttribute("aria-busy", "false");
    }
  }

  // Refresh an older floating panel when the user returns to it.
  window.addEventListener("focus", () => {
    if (Date.now() - lastLoaded >= 10 * 60 * 1000) loadWeather();
  });
  loadWeather();
})();
