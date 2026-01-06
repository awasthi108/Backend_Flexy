import { dbMethods } from '../config/database.js';

/**
 * Repository layer for reservation data access
 */
class ReservationRepository {
  /**
   * Create a new reservation
   */
  async create(reservation) {
    return new Promise((resolve, reject) => {
      const { db } = require('../config/database.js');
      const stmt = `
        INSERT INTO reservations (id, user_id, sku, quantity, status, expires_at)
        VALUES (?, ?, ?, ?, ?, ?)
      `;
      db.run(stmt, [
        reservation.id,
        reservation.userId,
        reservation.sku,
        reservation.quantity,
        reservation.status || 'RESERVED',
        reservation.expiresAt,
      ], function(err) {
        if (err) {
          reject(err);
        } else {
          resolve({ changes: this.changes, lastID: this.lastID });
        }
      });
    });
  }

  /**
   * Find active reservation by user and SKU (idempotency check)
   */
  async findActiveByUserAndSku(userId, sku) {
    return await dbMethods.get(
      `SELECT * FROM reservations
       WHERE user_id = ? AND sku = ? AND status = 'RESERVED' AND expires_at > datetime('now')
       ORDER BY created_at DESC
       LIMIT 1`,
      [userId, sku]
    );
  }

  /**
   * Get reservation by ID
   */
  async getById(id) {
    return await dbMethods.get('SELECT * FROM reservations WHERE id = ?', [id]);
  }

  /**
   * Update reservation status
   */
  async updateStatus(id, status) {
    return new Promise((resolve, reject) => {
      const { db } = require('../config/database.js');
      const stmt = `
        UPDATE reservations
        SET status = ?, updated_at = CURRENT_TIMESTAMP
        WHERE id = ?
      `;
      db.run(stmt, [status, id], function(err) {
        if (err) {
          reject(err);
        } else {
          resolve({ changes: this.changes, lastID: this.lastID });
        }
      });
    });
  }

  /**
   * Get all expired reservations for one or more statuses
   */
  async getExpiredByStatuses(statuses = []) {
    if (!statuses.length) return [];
    const placeholders = statuses.map(() => '?').join(', ');
    return await dbMethods.all(
      `SELECT * FROM reservations
       WHERE status IN (${placeholders}) AND julianday(expires_at) <= julianday('now')`,
      statuses
    );
  }

  /**
   * Get active reservations (by status) that have not expired
   */
  async getActiveByStatuses(statuses = []) {
    if (!statuses.length) return [];
    const placeholders = statuses.map(() => '?').join(', ');
    return await dbMethods.all(
      `SELECT * FROM reservations
       WHERE status IN (${placeholders}) AND julianday(expires_at) > julianday('now')
       ORDER BY expires_at ASC`,
      statuses
    );
  }

  /**
   * Delete reservation (for cleanup)
   */
  async delete(id) {
    return new Promise((resolve, reject) => {
      const { db } = require('../config/database.js');
      db.run('DELETE FROM reservations WHERE id = ?', [id], function(err) {
        if (err) {
          reject(err);
        } else {
          resolve({ changes: this.changes, lastID: this.lastID });
        }
      });
    });
  }

  /**
   * Get all reservations for a user
   */
  async getByUserId(userId) {
    return await dbMethods.all(
      'SELECT * FROM reservations WHERE user_id = ? ORDER BY created_at DESC',
      [userId]
    );
  }
}

export default new ReservationRepository();
