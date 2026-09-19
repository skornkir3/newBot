const { google } = require('googleapis');
const db = require('./db');
const isAllowedChat = require('../admin/permissionChats');

// сопоставление клан -> имя листа в Google Sheets
const CLAN_SHEETS = {
  1: 'Clan1',
  2: 'Clan2',
  3: 'Clan3',
  4: 'Clan4'
};

// какие колонки пишем в лист
// A        B         C             D        E      F      G       H        I
// name | nickname | telegram_tag | pubg_id | age | city | clan | actor_id | created_at
const HEADER = ['name','nickname','telegram_tag','pubg_id','age','city','clan','actor_id','created_at'];

module.exports = function syncSheetsByClan(bot, auth, SPREADSHEET_ID) {
  bot.onText(/^!обновить таблицы гугл$/i, async (msg) => {
    console.log('synth');
    const chatId = msg.chat.id;
    if (!isAllowedChat(chatId)) return;

    try {
      const client = await auth.getClient();
      const sheets = google.sheets({ version: 'v4', auth: client });

      // 1) читаем активных участников из БД
      const { rows: members } = await db.query(
        `SELECT name, nickname, telegram_tag, pubg_id, age, city, clan, actor_id, created_at
         FROM clan_members
         WHERE active = true AND clan IS NOT NULL`
      );

      if (members.length === 0) {
        await bot.sendMessage(chatId, '⚠️ В базе нет активных участников для синхронизации.');
        return;
      }

      // 2) группируем по клану
      const byClan = new Map();
      for (const m of members) {
        const c = Number(m.clan);
        if (!CLAN_SHEETS[c]) continue; // пропускаем неизвестные кланы
        if (!byClan.has(c)) byClan.set(c, []);
        byClan.get(c).push(m);
      }

      // 3) по каждому клану синхронизируем лист
      let totalAdded = 0;
      for (const [clanId, list] of byClan.entries()) {
        const sheetName = CLAN_SHEETS[clanId];

        // 3.1) читаем существующие строки листа
        // если пустой лист — сначала запишем заголовок
        let getRes = await sheets.spreadsheets.values.get({
          spreadsheetId: SPREADSHEET_ID,
          range: `${sheetName}!A1:I`,
        }).catch(() => ({ data: { values: [] }}));

        let rows = getRes.data.values || [];
        const hasHeader = rows.length > 0 && Array.isArray(rows[0]) && rows[0].length >= HEADER.length;

        if (!hasHeader) {
          // пишем заголовок
          await sheets.spreadsheets.values.update({
            spreadsheetId: SPREADSHEET_ID,
            range: `${sheetName}!A1:I1`,
            valueInputOption: 'RAW',
            requestBody: { values: [HEADER] }
          });
          rows = [HEADER];
        }

        // строим Set существующих тегов для антидупликатов (без регистра)
        const existingTags = new Set(
          rows.slice(1) // без заголовка
              .map(r => (r[2] || '').toString().trim().toLowerCase()) // колонка C = telegram_tag
              .filter(Boolean)
        );

        // 3.2) готовим новые строки (только те, кого ещё нет)
        const toAppend = [];
        for (const m of list) {
          const tag = (m.telegram_tag || '').trim();
          if (!tag) continue;
          if (existingTags.has(tag.toLowerCase())) {
            // при желании можно сделать обновление строки, пример ниже (закомментировано)
            continue;
          }

          toAppend.push([
            m.name || '',
            m.nickname || '',
            tag,
            m.pubg_id ? String(m.pubg_id) : '',
            m.age != null ? String(m.age) : '',
            m.city || '',
            String(clanId),
            m.actor_id ? String(m.actor_id) : '',
            m.created_at ? new Date(m.created_at).toISOString() : new Date().toISOString(),
          ]);
        }

        // 3.3) дописываем в конец листа
        if (toAppend.length > 0) {
          await sheets.spreadsheets.values.append({
            spreadsheetId: SPREADSHEET_ID,
            range: `${sheetName}!A:A`,
            valueInputOption: 'USER_ENTERED',
            insertDataOption: 'INSERT_ROWS',
            requestBody: { values: toAppend },
          });
          totalAdded += toAppend.length;
        }
      }

      await bot.sendMessage(
        chatId,
        `✅ Синхронизация завершена. Добавлено новых строк: ${totalAdded}.`
      );

    } catch (err) {
      console.error('❌ Ошибка при синхронизации Google Sheets:', err);
      await bot.sendMessage(chatId, '❌ Ошибка при синхронизации таблиц Google.',{
          reply_to_message_id: msg.message_id, }
     );
    }
  });
};
