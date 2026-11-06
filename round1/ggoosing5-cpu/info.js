"use strict";

const dateDisplay = document.querySelector("#today-date");
const timeDisplay = document.querySelector("#today-time");
const citySelect = document.querySelector("#weather-city");
const weatherStatus = document.querySelector("#weather-status");
const weatherRefresh = document.querySelector("#weather-refresh");
const cities = {
  seoul: [37.5665, 126.978], busan: [35.1796, 129.0756],
  incheon: [37.4563, 126.7052], daegu: [35.8714, 128.6014],
  daejeon: [36.3504, 127.3845], gwangju: [35.1595, 126.8526],
  ulsan: [35.5384, 129.3114], sejong: [36.4801, 127.289],
  suwon: [37.2636, 127.0286], chuncheon: [37.8813, 127.73],
  gangneung: [37.7519, 128.8761], cheongju: [36.6424, 127.489],
  jeonju: [35.8242, 127.148], mokpo: [34.8118, 126.3922],
  pohang: [36.019, 129.3435], changwon: [35.228, 128.6811],
  jeju: [33.4996, 126.5312]
};

function updateClock() {
  const now = new Date();
  dateDisplay.textContent = new Intl.DateTimeFormat("ko-KR", {
    year: "numeric", month: "long", day: "numeric", weekday: "long"
  }).format(now);
  timeDisplay.textContent = new Intl.DateTimeFormat("ko-KR", {
    hour: "2-digit", minute: "2-digit", second: "2-digit", hour12: false
  }).format(now);
  timeDisplay.dateTime = now.toISOString();
}

function weatherDescription(code) {
  if (code === 0) return "☀️ 맑음";
  if (code === 1) return "🌤️ 대체로 맑음";
  if (code === 2) return "⛅ 구름 조금";
  if (code === 3) return "☁️ 흐림";
  if ([45, 48].includes(code)) return "🌫️ 안개";
  if ([51, 53, 55, 56, 57].includes(code)) return "🌧️ 이슬비";
  if ([61, 63, 65, 66, 67].includes(code)) return "🌧️ 비";
  if ([71, 73, 75, 77, 85, 86].includes(code)) return "🌨️ 눈";
  if ([80, 81, 82].includes(code)) return "🌦️ 소나기";
  if ([95, 96, 99].includes(code)) return "⛈️ 뇌우";
  return "날씨 정보";
}

let loadingWeather = false;
async function loadWeather() {
  if (loadingWeather) return;
  loadingWeather = true;
  citySelect.disabled = true;
  weatherRefresh.disabled = true;
  weatherStatus.textContent = "날씨를 불러오는 중이에요.";
  const city = citySelect.value;
  const [latitude, longitude] = cities[city];
  const cityName = citySelect.selectedOptions[0].textContent;
  try {
    const url = new URL("https://api.open-meteo.com/v1/forecast");
    url.search = new URLSearchParams({ latitude, longitude,
      current: "temperature_2m,weather_code", timezone: "Asia/Seoul" });
    const response = await fetch(url, { signal: AbortSignal.timeout(10000) });
    if (!response.ok) throw new Error("Weather unavailable");
    const data = await response.json();
    const current = data.current;
    if (!Number.isFinite(current?.temperature_2m) || !Number.isFinite(current?.weather_code)) {
      throw new Error("Invalid weather data");
    }
    weatherStatus.textContent = `${cityName} · ${weatherDescription(current.weather_code)} · ${Math.round(current.temperature_2m)}°C`;
    const updated = new Intl.DateTimeFormat("ko-KR", { hour: "2-digit", minute: "2-digit", hour12: false }).format(new Date());
    weatherStatus.title = `${updated}에 조회한 날씨`;
  } catch {
    weatherStatus.textContent = `${cityName} 날씨를 불러오지 못했어요. ↻를 눌러 주세요.`;
    weatherStatus.title = "";
  } finally {
    loadingWeather = false;
    citySelect.disabled = false;
    weatherRefresh.disabled = false;
  }
}

citySelect.addEventListener("change", async () => {
  const selected = citySelect.value;
  await loadWeather();
  try { await chrome.storage.local.set({ weatherCity: selected }); }
  catch { weatherStatus.textContent += " (지역 저장 실패)"; }
});
weatherRefresh.addEventListener("click", loadWeather);

async function initInfo() {
  updateClock();
  setInterval(updateClock, 1000);
  try {
    const { weatherCity } = await chrome.storage.local.get("weatherCity");
    citySelect.value = Object.hasOwn(cities, weatherCity) ? weatherCity : "seoul";
  } catch { citySelect.value = "seoul"; }
  await loadWeather();
  setInterval(loadWeather, 10 * 60 * 1000);
}
initInfo();
