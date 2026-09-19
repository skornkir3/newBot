// scripts/warmupCities.js
const pool = require('../handlers/db');
const { getOrInsertCityCoords } = require('../data/geocodeWithCache');

(async () => {
  const { rows } = await pool.query(`
    select distinct trim(city) as city
    from clan_members
    where city is not null and length(trim(city)) > 0
    order by 1
  `);
  console.log(`Городов: ${rows.length}`);
  for (const { city } of rows) {
    try {
      const c = await getOrInsertCityCoords(city);
      console.log('OK:', city, c.lat.toFixed(4), c.lon.toFixed(4));
    } catch (e) {
      console.warn('FAIL:', city, e.message);
    }
  }
  process.exit(0);
})();
