const express = require('express');
const app = express();

function keepAlive() {
  const PORT = process.env.PORT || 3000;
  app.get('/', (req, res) => {
    res.send('🤖 Бот активен!');
  });

  app.listen(PORT, () => {
    console.log(`Сервер запущен на порту ${PORT}`);
  });
}

module.exports = keepAlive;