// modules/cmd.earthmates.js
const pool = require('../handlers/db');
const { getOrInsertCityCoords } = require('../data/geocodeWithCache');
const RADIUS_M = (parseInt(process.env.RADIUS_KM, 10) || 400) * 1000;
const getClanId = require('../clan/getClanId');

function normCity(s) { return (s || '').trim(); }

// экранирование для HTML parse_mode
function esc(s = '') {
  return String(s)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;');
}

module.exports = function (bot) {
  bot.onText(/^!земляк(?:\s+@(\S+))?$/iu, async (msg, match) => {
    const chatId = msg.chat.id;
    const targetTag = match[1]
      ? `@${match[1]}`
      : (msg.from.username ? `@${msg.from.username}` : null);

    if (!targetTag) {
      return bot.sendMessage(chatId, '❗️У тебя не установлен username в Telegram.', {
        reply_to_message_id: msg.message_id
      });
    }

    const client = await pool.connect();
    
    try {
      // 1) город пользователя
      const rCity = await client.query(
        `select city
         from clan_members
         where telegram_tag = $1
         order by id desc
         limit 1`,
        [targetTag]
      );

      const myCity = normCity(rCity.rows[0]?.city || '');
      if (!myCity) {
        return bot.sendMessage(chatId, `❌ Не найден город для ${targetTag}.`, {
          reply_to_message_id: msg.message_id
        });
      }

      // 2) координаты моего города (с кэшем)
      const me = await getOrInsertCityCoords(myCity);

      // 3) поиски соседей
      const clanId = await getClanId(chatId);
      const q = `
        with me as (
          select $1::float8 as tlat, $2::float8 as tlon, $3::text as my_tag
        )
        select
          cm.telegram_tag,
          cm.city,
          round(
            earth_distance(
              ll_to_earth(m.tlat, m.tlon),
              ll_to_earth(cc.lat, cc.lon)
            ) / 1000.0
          )::int as km
        from clan_members cm
        join city_coords cc
          on lower(cc.city) = lower(cm.city)
        cross join me m
        where cm.telegram_tag is not null
          and cm.telegram_tag <> m.my_tag
          and cm.active = TRUE
          and cm.clan_id = $5
          and earth_box(ll_to_earth(m.tlat, m.tlon), $4) @> ll_to_earth(cc.lat, cc.lon)
          and earth_distance(ll_to_earth(m.tlat, m.tlon), ll_to_earth(cc.lat, cc.lon)) <= $4
        group by cm.telegram_tag, cm.city, cc.lat, cc.lon, m.tlat, m.tlon
        order by km asc
        limit 50;
      `;
      const r = await client.query(q, [me.lat, me.lon, targetTag, RADIUS_M, clanId ]);

      const radiusKm = RADIUS_M / 1000;

      if (r.rows.length === 0) {
        // без разметки — безопасно
        return bot.sendMessage(
          chatId,
          `В радиусе ${radiusKm} км от ${myCity} никого не нашлось.`,
          { reply_to_message_id: msg.message_id }
        );
      }

      // 4) ответ в HTML с экранированием
      const header = match[1]
        ? `Земляки для ${esc(targetTag)} из <b>${esc(myCity)}</b> (≤ ${radiusKm} км):`
        : `Твои земляки из <b>${esc(myCity)}</b> (≤ ${radiusKm} км):`;

      const lines = r.rows.map((x, i) =>
        `${i + 1}. ${esc(x.telegram_tag)} — ${esc(x.city)} • ${x.km} км`
      );

      await bot.sendMessage(chatId, [header, '', ...lines].join('\n'), {
        parse_mode: 'HTML',
        reply_to_message_id: msg.message_id
      });
    } catch (e) {
      console.error('!земляк error:', e);
      bot.sendMessage(chatId, '❌ Ошибка при поиске земляков.', {
        reply_to_message_id: msg.message_id
      });
    } finally {
      client.release();
    }
  });
};
