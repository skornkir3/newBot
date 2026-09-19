// testConnection.js
const db = require('./db');

async function test() {
  try {
    const res = await db.query('SELECT NOW()');
    console.log('Успешное подключение:', res.rows[0]);
  } catch (err) {
    console.error('Ошибка подключения:', err.message);
  }
}

test();
