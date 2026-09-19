// lib/geocodeWithCache.js
const fetch = require('node-fetch');
const pool = require('../handlers/db');

const UA = process.env.GEOCODER_UA || 'CheckmateBot/1.0 (email@example.com)';

// Nominatim просит не чаще 1 req/sec
let lastCall = 0;
async function throttle() {
  const now = Date.now();
  const wait = 1000 - (now - lastCall);
  if (wait > 0) await new Promise(r => setTimeout(r, wait));
  lastCall = Date.now();
}

function normCity(s) { return (s || '').trim(); }

async function geocodeOSM(city) {
  console.log(city);
  await throttle();
  const url = `https://nominatim.openstreetmap.org/search?format=json&limit=1&q=${encodeURIComponent(city)}`;
  const res = await fetch(url, { headers: { 'User-Agent': UA } });
  if (!res.ok) throw new Error(`OSM HTTP ${res.status}`);
  const data = await res.json();
  if (!Array.isArray(data) || data.length === 0) throw new Error('not_found');
  return { lat: parseFloat(data[0].lat), lon: parseFloat(data[0].lon) };
}

/** Берёт {lat,lon} из city_coords; если нет — геокодит и кладёт в БД. */
async function getOrInsertCityCoords(cityRaw) {
  const city = normCity(cityRaw);
  const client = await pool.connect();
  try {
    const hit = await client.query(
      'select lat, lon from city_coords where lower(city) = lower($1) limit 1',
      [city]
    );
    if (hit.rows.length) return hit.rows[0];

    const { lat, lon } = await geocodeOSM(city);
    await client.query(
      `insert into city_coords(city, lat, lon)
       values ($1, $2, $3)
       on conflict (city) do update set lat=excluded.lat, lon=excluded.lon, updated_at=now()`,
      [city, lat, lon]
    );
    return { lat, lon };
  } finally {
    client.release();
  }
}

module.exports = { getOrInsertCityCoords };
