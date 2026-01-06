import inventoryService from '../services/inventoryService.js';

/**
 * Controller layer for checkout API endpoints
 */
class CheckoutController {
  /**
   * POST /checkout/confirm
   * Confirm a reservation
   */
  async confirm(req, res) {
    try {
      const { reservationId } = req.body;

      if (!reservationId) {
        return res.status(400).json({
          success: false,
          error: 'Missing required field: reservationId',
        });
      }

      const result = await inventoryService.confirmReservation(reservationId);

      // Use the statusCode from the service response
      const statusCode = result.statusCode || (result.success ? 200 : 400);

      // Remove statusCode from response body
      const responseBody = { ...result };
      delete responseBody.statusCode;

      return res.status(statusCode).json(responseBody);
    } catch (error) {
      console.error('[CONFIRM] Unexpected error:', error);
      return res.status(500).json({
        success: false,
        error: 'Internal server error',
      });
    }
  }

  /**
   * POST /checkout/cancel
   * Cancel a reservation
   */
  async cancel(req, res) {
    try {
      const { reservationId } = req.body;

      if (!reservationId) {
        return res.status(400).json({
          success: false,
          error: 'Missing required field: reservationId',
        });
      }

      const result = await inventoryService.cancelReservation(reservationId);

      if (result.success) {
        return res.status(200).json(result);
      } else {
        return res.status(400).json(result);
      }
    } catch (error) {
      console.error('[CANCEL] Error:', error);
      return res.status(500).json({
        success: false,
        error: 'Internal server error',
      });
    }
  }
}

export default new CheckoutController();

