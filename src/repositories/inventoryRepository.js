import { dbMethods, db } from '../config/database.js';

/**
 * Repository layer for inventory data access
 */
class InventoryRepository {
  /**
   * Get inventory by SKU
   */
  async getBySku(sku) {
    return await dbMethods.get('SELECT * FROM inventory WHERE sku = ?', [sku]);
  }

  /**
   * Create or update inventory
   */
  async upsert(sku, totalQuantity) {
    return new Promise((resolve, reject) => {
      const { db } = require('../config/database.js');
      const stmt = `
        INSERT INTO inventory (sku, total_quantity, available_quantity, reserved_quantity)
        VALUES (?, ?, ?, 0)
        ON CONFLICT(sku) DO UPDATE SET
          total_quantity = excluded.total_quantity,
          available_quantity = excluded.total_quantity - reserved_quantity,
          updated_at = CURRENT_TIMESTAMP
      `;
      db.run(stmt, [sku, totalQuantity, totalQuantity], function(err) {
        if (err) {
          reject(err);
        } else {
          resolve({ changes: this.changes, lastID: this.lastID });
        }
      });
    });
  }

  /**
   * Reserve inventory atomically (with transaction)
   * Returns the updated inventory row or null if insufficient stock
   */
  async reserveInventory(sku, quantity) {
    return new Promise((resolve, reject) => {
      db.serialize(() => {
        db.run('BEGIN TRANSACTION', (err) => {
          if (err) return reject(err);

          // Lock the row by selecting it
          db.get('SELECT * FROM inventory WHERE sku = ?', [sku], (err, inventory) => {
            if (err) {
              db.run('ROLLBACK');
              return reject(err);
            }

            if (!inventory) {
              db.run('ROLLBACK');
              return resolve(null);
            }

            if (inventory.available_quantity < quantity) {
              db.run('ROLLBACK');
              return resolve(null); // Insufficient stock
            }

            // Update inventory atomically
            db.run(
              `UPDATE inventory
               SET available_quantity = available_quantity - ?,
                   reserved_quantity = reserved_quantity + ?,
                   updated_at = CURRENT_TIMESTAMP
               WHERE sku = ? AND available_quantity >= ?`,
              [quantity, quantity, sku, quantity],
              function(err) {
                if (err) {
                  db.run('ROLLBACK');
                  return reject(err);
                }

                if (this.changes === 0) {
                  db.run('ROLLBACK');
                  return resolve(null); // Concurrent update failed
                }

                // Get updated inventory
                db.get('SELECT * FROM inventory WHERE sku = ?', [sku], (err, updated) => {
                  if (err) {
                    db.run('ROLLBACK');
                    return reject(err);
                  }

                  db.run('COMMIT', (err) => {
                    if (err) return reject(err);
                    resolve(updated);
                  });
                });
              }
            );
          });
        });
      });
    });
  }

  /**
   * Release reserved inventory back to available
   */
  async releaseInventory(sku, quantity) {
    return new Promise((resolve, reject) => {
      const { db } = require('../config/database.js');
      const stmt = `
        UPDATE inventory
        SET available_quantity = available_quantity + ?,
            reserved_quantity = reserved_quantity - ?,
            updated_at = CURRENT_TIMESTAMP
        WHERE sku = ? AND reserved_quantity >= ?
      `;
      db.run(stmt, [quantity, quantity, sku, quantity], function(err) {
        if (err) {
          reject(err);
        } else {
          resolve({ changes: this.changes, lastID: this.lastID });
        }
      });
    });
  }

  /**
   * Confirm reservation - move from reserved to confirmed (deduct from total)
   */
  async confirmReservation(sku, quantity) {
    return new Promise((resolve, reject) => {
      const { db } = require('../config/database.js');
      const stmt = `
        UPDATE inventory
        SET reserved_quantity = reserved_quantity - ?,
            total_quantity = total_quantity - ?,
            updated_at = CURRENT_TIMESTAMP
        WHERE sku = ? AND reserved_quantity >= ?
      `;
      db.run(stmt, [quantity, quantity, sku, quantity], function(err) {
        if (err) {
          console.error('[REPO] confirmReservation error:', err);
          reject(err);
        } else {
          resolve({ changes: this.changes, lastID: this.lastID });
        }
      });
    });
  }

  /**
   * Get all inventory items
   */
  async getAll() {
    return await dbMethods.all('SELECT * FROM inventory');
  }
}

export default new InventoryRepository();
