const { PREMIUM_PRICE_XTR, PREMIUM_DURATION_DAYS } = require('../premium/config');

module.exports = function registerPremiumPaymentHandlers(bot) {

  bot.on('callback_query', async (query) => {
    if (query.data !== 'premium_buy') return;

    const chatId = query.message.chat.id;

    if (query.message.chat.type !== 'private') {
      await bot.answerCallbackQuery(query.id, {
        text: 'Оплата доступна только в личке с ботом.',
        show_alert: true
      });
      return;
    }

    console.log('payment');
    await bot.answerCallbackQuery(query.id);

    const title = 'Премиум-подписка';
    const description = `Премиум-доступ к функциям бота на ${PREMIUM_DURATION_DAYS} дней.`;
    const payload = JSON.stringify({
      type: 'premium_subscription',
      durationDays: PREMIUM_DURATION_DAYS
    });

    const prices = [
      {
        label: `Премиум на ${PREMIUM_DURATION_DAYS} дней`,
        amount: PREMIUM_PRICE_XTR   // число, напр. 100
      }
    ];

    console.log('invoice');
    console.log(prices);
    console.log(chatId);
    console.log(title);
    console.log(description);
    console.log(payload);

    await bot.sendInvoice(
      chatId,
      title,
      description,
      payload,
      '',          // providerToken — ПУСТО для звёзд
      'XTR',       // currency
      prices,      // МАССИВ объектов, БЕЗ stringify
      {
        need_name: false,
        need_phone_number: false,
        need_email: false,
        need_shipping_address: false,
        is_flexible: false
      }
    );
  });
};
