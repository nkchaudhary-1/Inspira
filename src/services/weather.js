// Weather via Open-Meteo (no API key, no account). Location is chosen by the
// user — city search or "use my location" — never guessed from IP.

import { getDevice, setDevice, prefs } from '../core/store.js';

const TTL = 30 * 60 * 1000;

// WMO weather codes → label + atmosphere group (drives the background tint).
const CODES = {
  0: ['Clear skies', 'clear'],
  1: ['Mostly clear', 'clear'],
  2: ['Partly cloudy', 'cloudy'],
  3: ['Overcast', 'cloudy'],
  45: ['Fog', 'fog'],
  48: ['Freezing fog', 'fog'],
  51: ['Light drizzle', 'rain'],
  53: ['Drizzle', 'rain'],
  55: ['Heavy drizzle', 'rain'],
  56: ['Freezing drizzle', 'rain'],
  57: ['Freezing drizzle', 'rain'],
  61: ['Light rain', 'rain'],
  63: ['Rain', 'rain'],
  65: ['Heavy rain', 'rain'],
  66: ['Freezing rain', 'rain'],
  67: ['Freezing rain', 'rain'],
  71: ['Light snow', 'snow'],
  73: ['Snow', 'snow'],
  75: ['Heavy snow', 'snow'],
  77: ['Snow grains', 'snow'],
  80: ['Light showers', 'rain'],
  81: ['Showers', 'rain'],
  82: ['Heavy showers', 'rain'],
  85: ['Snow showers', 'snow'],
  86: ['Snow showers', 'snow'],
  95: ['Thunderstorm', 'storm'],
  96: ['Thunderstorm', 'storm'],
  99: ['Thunderstorm', 'storm'],
};

export function describe(code) {
  const [label, group] = CODES[code] || ['—', 'clear'];
  return { label, group };
}

export function convert(celsius) {
  return prefs().units === 'f' ? Math.round((celsius * 9) / 5 + 32) : Math.round(celsius);
}

export async function refreshWeather({ force = false } = {}) {
  const { location, weather } = getDevice();
  if (!location) return null;
  const fresh = weather && weather.lat === location.lat && weather.lon === location.lon && Date.now() - weather.fetchedAt < TTL;
  if (fresh && !force) return weather;
  const params = new URLSearchParams({
    latitude: location.lat,
    longitude: location.lon,
    current: 'temperature_2m,weather_code,is_day',
    daily: 'temperature_2m_max,temperature_2m_min',
    timezone: 'auto',
    forecast_days: '1',
  });
  try {
    const res = await fetch(`https://api.open-meteo.com/v1/forecast?${params}`);
    if (!res.ok) throw new Error(`weather ${res.status}`);
    const json = await res.json();
    const next = {
      lat: location.lat,
      lon: location.lon,
      temp: json.current.temperature_2m,
      code: json.current.weather_code,
      isDay: json.current.is_day === 1,
      high: json.daily.temperature_2m_max[0],
      low: json.daily.temperature_2m_min[0],
      fetchedAt: Date.now(),
    };
    setDevice({ weather: next });
    return next;
  } catch (err) {
    console.warn('[inspira] weather failed', err);
    return weather;
  }
}

export async function searchCity(query) {
  const params = new URLSearchParams({ name: query, count: '6', language: 'en', format: 'json' });
  const res = await fetch(`https://geocoding-api.open-meteo.com/v1/search?${params}`);
  if (!res.ok) throw new Error('search failed');
  const { results = [] } = await res.json();
  return results.map((r) => ({
    lat: r.latitude,
    lon: r.longitude,
    name: r.name,
    detail: [r.admin1, r.country].filter(Boolean).join(', '),
  }));
}

/** Browser geolocation → nearest place name. */
export function locateMe() {
  return new Promise((resolve, reject) => {
    if (!navigator.geolocation) return reject(new Error('Location unavailable'));
    navigator.geolocation.getCurrentPosition(
      async ({ coords }) => {
        const lat = Number(coords.latitude.toFixed(3));
        const lon = Number(coords.longitude.toFixed(3));
        let name = 'Current location';
        try {
          const res = await fetch(`https://api.bigdatacloud.net/data/reverse-geocode-client?latitude=${lat}&longitude=${lon}&localityLanguage=en`);
          const json = await res.json();
          name = json.city || json.locality || json.principalSubdivision || name;
        } catch {
          /* keep generic name */
        }
        resolve({ lat, lon, name });
      },
      (err) => reject(err),
      { timeout: 10000, maximumAge: 60 * 60 * 1000 },
    );
  });
}

export async function setLocation(location) {
  setDevice({ location, weather: null });
  return refreshWeather({ force: true });
}
