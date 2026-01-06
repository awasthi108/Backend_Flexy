import inventoryRepository from '../repositories/inventoryRepository.js';
import reservationRepository from '../repositories/reservationRepository.js';
import { v4 as uuidv4 } from 'uuid';

/**
 * Service layer for inventory business logic
 */
class InventoryService {
  /**
   * Reserve inventory for a user
   * - Concurrency-safe using database transactions
   * - Idempotent: same user + SKU returns existing reservation
   * - Prevents negative inventory
   * - Creates 5-minute expiry reservation
   */
  async reserveInventory(userId, sku, quantity) {
    // Check for existing active reservation (idempotency)
    const existingReservation = await reservationRepository.findActiveByUserAndSku(
      userId,
      sku
    );

    if (existingReservation) {
      console.log(
        `[RESERVE] Idempotent return: User ${userId} already has active reservation ${existingReservation.id} for SKU ${sku}`
      );
      return {
        success: true,
        reservationId: existingReservation.id,
        message: 'Existing reservation found',
        expiresAt: existingReservation.expires_at,
      };
    }

    // Check current inventory
    const inventory = await inventoryRepository.getBySku(sku);
    if (!inventory) {
      console.log(`[RESERVE] Failed: SKU ${sku} not found`);
      return {
        success: false,
        error: 'SKU not found',
      };
    }

    // Attempt to reserve inventory atomically
    const updatedInventory = await inventoryRepository.reserveInventory(sku, quantity);

    if (!updatedInventory) {
      console.log(
        `[RESERVE] Failed: Insufficient stock for SKU ${sku}. Requested: ${quantity}, Available: ${inventory.available_quantity}`
      );
      return {
        success: false,
        error: 'Insufficient inventory',
        availableQuantity: inventory.available_quantity,
      };
    }

    // Create reservation
    const reservationId = uuidv4();
    const expiresAt = new Date(Date.now() + 5 * 60 * 1000); // 5 minutes from now

    await reservationRepository.create({
      id: reservationId,
      userId,
      sku,
      quantity,
      status: 'RESERVED',
      expiresAt: expiresAt.toISOString(),
    });

    console.log(
      `[RESERVE] Success: Reservation ${reservationId} created for User ${userId}, SKU ${sku}, Quantity ${quantity}`
    );

    return {
      success: true,
      reservationId,
      expiresAt: expiresAt.toISOString(),
      availableQuantity: updatedInventory.available_quantity,
    };
  }

  /**
   * Confirm a reservation
   * - Checks if reservation exists and is not expired
   * - Handles duplicate confirms safely
   * - Moves inventory from reserved to confirmed
   */
  async confirmReservation(reservationId) {
    // Validate input
    if (!reservationId || typeof reservationId !== 'string') {
      return {
        success: false,
        error: 'Invalid reservation ID',
        statusCode: 400
      };
    }

    // Fetch reservation
    const reservation = await reservationRepository.getById(reservationId);
    if (!reservation) {
      console.log(`[CONFIRM] Reservation ${reservationId} not found`);
      return {
        success: false,
        error: 'Reservation not found',
        statusCode: 404
      };
    }

    // Check if already confirmed (idempotent)
    if (reservation.status === 'CONFIRMED') {
      console.log(`[CONFIRM] Reservation ${reservationId} already confirmed`);
      return {
        success: true,
        message: 'Reservation already confirmed',
        reservationId,
        statusCode: 200
      };
    }

    // Check if cancelled
    if (reservation.status === 'CANCELLED') {
      console.log(`[CONFIRM] Reservation ${reservationId} was cancelled`);
      return {
        success: false,
        error: 'Reservation was cancelled',
        statusCode: 400
      };
    }

    // Check if expired
    if (reservation.status === 'EXPIRED' || new Date(reservation.expires_at) <= new Date()) {
      // Mark as expired if not already
      if (reservation.status !== 'EXPIRED') {
        await inventoryRepository.releaseInventory(reservation.sku, reservation.quantity);
        await reservationRepository.updateStatus(reservationId, 'EXPIRED');
      }
      console.log(`[CONFIRM] Reservation ${reservationId} expired`);
      return {
        success: false,
        error: 'Reservation expired',
        statusCode: 400
      };
    }

    // Confirm reservation - move from reserved to confirmed
    try {
      // First check if there's enough reserved inventory
      const inventory = await inventoryRepository.getBySku(reservation.sku);
      if (!inventory || inventory.reserved_quantity < reservation.quantity) {
        console.log(`[CONFIRM] Insufficient reserved inventory for ${reservationId}`);
        return {
          success: false,
          error: 'Insufficient inventory',
          statusCode: 400
        };
      }

      // Confirm by deducting from total (inventory is already reserved)
      const result = await inventoryRepository.confirmReservation(
        reservation.sku,
        reservation.quantity
      );

      if (!result || result.changes === 0) {
        console.log(`[CONFIRM] Failed to update inventory for ${reservationId}`);
        return {
          success: false,
          error: 'Failed to confirm reservation',
          statusCode: 500
        };
      }

      // Mark reservation as confirmed
      await reservationRepository.updateStatus(reservationId, 'CONFIRMED');

      console.log(`[CONFIRM] Reservation ${reservationId} confirmed successfully`);
      return {
        success: true,
        reservationId,
        message: 'Reservation confirmed',
        statusCode: 200
      };

    } catch (error) {
      console.error(`[CONFIRM] Database error for ${reservationId}:`, error);
      return {
        success: false,
        error: 'Internal server error',
        statusCode: 500
      };
    }
  }

  /**
   * Cancel a reservation
   * - Releases inventory back to available
   * - Handles duplicate cancels safely
   */
  async cancelReservation(reservationId) {
    const reservation = await reservationRepository.getById(reservationId);

    if (!reservation) {
      console.log(`[CANCEL] Failed: Reservation ${reservationId} not found`);
      return {
        success: false,
        error: 'Reservation not found',
      };
    }

    // Check if already cancelled (idempotency)
    if (reservation.status === 'CANCELLED') {
      console.log(
        `[CANCEL] Idempotent return: Reservation ${reservationId} already cancelled`
      );
      return {
        success: true,
        message: 'Reservation already cancelled',
        reservationId,
      };
    }

    // Check if already confirmed
    if (reservation.status === 'CONFIRMED') {
      console.log(
        `[CANCEL] Failed: Reservation ${reservationId} already confirmed`
      );
      return {
        success: false,
        error: 'Cannot cancel confirmed reservation',
      };
    }

    // Release inventory
    await inventoryRepository.releaseInventory(reservation.sku, reservation.quantity);
    await reservationRepository.updateStatus(reservationId, 'CANCELLED');

    console.log(
      `[CANCEL] Success: Reservation ${reservationId} cancelled, inventory released`
    );

    return {
      success: true,
      reservationId,
      message: 'Reservation cancelled',
    };
  }

  /**
   * Get available quantity for a SKU
   */
  async getAvailableQuantity(sku) {
    const inventory = await inventoryRepository.getBySku(sku);
    if (!inventory) {
      return null;
    }
    return {
      sku,
      totalQuantity: inventory.total_quantity,
      availableQuantity: inventory.available_quantity,
      reservedQuantity: inventory.reserved_quantity,
    };
  }

  /**
   * Cleanup expired reservations
   * Called periodically to release inventory from expired reservations
   */
  async cleanupExpiredReservations() {
    // Clean up legacy 'PENDING' rows as well as current 'RESERVED'
    const expiredReservations = await reservationRepository.getExpiredByStatuses([
      'RESERVED',
      'PENDING',
    ]);

    for (const reservation of expiredReservations) {
      // Release inventory
      await inventoryRepository.releaseInventory(reservation.sku, reservation.quantity);
      await reservationRepository.updateStatus(reservation.id, 'EXPIRED');

      console.log(
        `[CLEANUP] Expired reservation ${reservation.id} for SKU ${reservation.sku}, released ${reservation.quantity} units`
      );
    }

    return expiredReservations.length;
  }
}

export default new InventoryService();
