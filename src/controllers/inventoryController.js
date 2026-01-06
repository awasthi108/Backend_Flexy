import inventoryService from '../services/inventoryService.js';

/**
 * Controller layer for inventory API endpoints
 */
class InventoryController {
  /**
   * POST /inventory/reserve
   * Reserve inventory for a user
   */
  async reserve(req, res) {
    try {
      const { userId, sku, quantity } = req.body;

      // Validation
      if (!userId || !sku || !quantity) {
        return res.status(400).json({
          success: false,
          error: 'Missing required fields: userId, sku, quantity',
        });
      }

      if (quantity <= 0 || !Number.isInteger(quantity)) {
        return res.status(400).json({
          success: false,
          error: 'Quantity must be a positive integer',
        });
      }

      const result = await inventoryService.reserveInventory(userId, sku, quantity);

      if (result.success) {
        return res.status(200).json(result);
      } else {
        return res.status(409).json(result); // 409 Conflict for insufficient inventory
      }
    } catch (error) {
      console.error('[RESERVE] Error:', error);
      return res.status(500).json({
        success: false,
        error: 'Internal server error',
      });
    }
  }

  /**
   * GET /inventory/:sku
   * Get available quantity for a SKU
   */
  async getInventory(req, res) {
    try {
      const { sku } = req.params;

      const inventory = await inventoryService.getAvailableQuantity(sku);

      if (!inventory) {
        return res.status(404).json({
          success: false,
          error: 'SKU not found',
        });
      }

      return res.status(200).json({
        success: true,
        data: inventory,
      });
    } catch (error) {
      console.error('[GET_INVENTORY] Error:', error);
      return res.status(500).json({
        success: false,
        error: 'Internal server error',
      });
    }
  }
}

export default new InventoryController();

