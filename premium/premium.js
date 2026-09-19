// commands/premiumCommand.js
const { PREMIUM_PRICE_XTR, PREMIUM_DURATION_DAYS } = require('../premium/config');
const { hasPremium, getPremiumInfo } = require('../premium/addSubscription');

module.exports = function registerPremiumCommand(bot, botUsername) {
  bot.onText(/^!премиум$/i, async (msg) => {
    const chatId = msg.chat.id;
    const userId = msg.from.id;

    // Если команда не в личке — говорим, что нужно писать в ЛС
    if (msg.chat.type !== 'private') {
      const link = `https://t.me/${botUsername}?start=premium`;
      return bot.sendMessage(
        chatId,
        [
          'Команду <code>!премиум</code> нужно писать в личку боту 💬',
          '',
          `Открой бота: ${link}`,
          'И там отправь: <code>!премиум</code>.'
        ].join('\n'),
        { parse_mode: 'HTML' }
      );
    }

    const active = await hasPremium(userId);
    const info = await getPremiumInfo(userId);

    let statusText;
    if (active && info) {
      statusText = `У тебя уже есть активная премиум-подписка 💎\nДействует до: <b>${new Date(info.premium_until).toLocaleString('ru-RU')}</b>`;
    } else {
      statusText = 'У тебя пока нет премиум-подписки.';
    }

    const text = [
      '⭐ <b>Премиум-подписка</b>',
      '',
      statusText,
      '',
      `Цена: <b>${PREMIUM_PRICE_XTR}⭐</b> за ${PREMIUM_DURATION_DAYS} дней.`,
      '',
      'Нажми кнопку ниже, чтобы оплатить звёздами.'
    ].join('\n');

    await bot.sendMessage(chatId, text, {
      parse_mode: 'HTML',
      reply_markup: {
        inline_keyboard: [
          [
            { text: `Оплатить ${PREMIUM_PRICE_XTR}⭐`, callback_data: 'premium_buy' }
          ]
        ]
      }
    });
  });
};
