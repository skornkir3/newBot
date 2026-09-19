// deactivateOwnerClans.js
const db = require('../handlers/db');

/**
 * Деактивировать все кланы владельца
 *
 * @param {string|number} ownerActorId - actor_id владельца (можно строкой или числом)
 * @returns {Promise<Array>} - массив деактивированных строк (id, name, owner_actor_id, is_active)
 * @throws {Error} - при ошибке БД или некорректном ownerActorId
 */
module.exports = async function deactivateOwnerClans(ownerActorId) {
  if (ownerActorId === undefined || ownerActorId === null) {
    throw new Error('Не указан ownerActorId');
  }

  // Нормализуем ввод — оставляем только цифры (в вашем проекте actor_id числовой int8)
  const owner = String(ownerActorId).replace(/\D/g, '');
  if (!owner) throw new Error('Некорректный ownerActorId');

  try {
    const res = await db.query(
      `UPDATE public.clans
       SET is_active = FALSE           
       WHERE owner_actor_id = $1
         AND is_active = TRUE
       RETURNING id, name, owner_actor_id, is_active`,
      [owner]
    );

    return res.rows; // массив деактивированных кланов
  } catch (err) {
    console.error('deactivateOwnerClans error:', err);
    throw err;
  }
};
