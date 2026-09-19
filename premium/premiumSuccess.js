// handlers/premiumSuccessHandler.js

const { addPremium } = require('../premium/addSubscription');

module.exports = function registerPremiumSuccessHandler(bot) {

  // ===== Ответ на pre_checkout_query =====
  bot.on('pre_checkout_query', async (query) => {
    console.log('checkout_query');
    try {
      await bot.answerPreCheckoutQuery(query.id, true);
    } catch (e) {
      console.error('pre_checkout_query error:', e);
      await bot.answerPreCheckoutQuery(query.id, false, 'Ошибка при подтверждении оплаты');
    }
  });

  // ===== Обработка успешной оплаты =====
  bot.on('message', async (msg) => {
    if (!msg.successful_payment) return;

    const payment = msg.successful_payment;
    let payload;

    try {
      payload = JSON.parse(payment.invoice_payload);
    } catch (e) {
      payload = {};
    }

    // Если это премиум-подписка
    if (payload.type === 'premium_subscription') {
      const userId = msg.from.id;
      const chatId = msg.chat.id;          // ЛС с пользователем
      const amountXtr = payment.total_amount;

      try {
        const sub = await addPremium(userId, chatId, amountXtr);
        await bot.sendMessage(
          chatId,
          [
            '✅ <b>Премиум-подписка успешно активирована!</b>',
            '',
            `Оплачено: <b>${amountXtr}⭐</b>`,
            `Премиум действует до: <b>${new Date(sub.premium_until).toLocaleString('ru-RU')}</b>`,
            '',
            'Спасибо за поддержку проекта 💜'
          ].join('\n'),
          { parse_mode: 'HTML' }
        );
      } catch (err) {
        console.error('Ошибка при активации премиума:', err);
        await bot.sendMessage(chatId, '❗ Произошла ошибка при активации премиума.');
      }
    }

  });
};
