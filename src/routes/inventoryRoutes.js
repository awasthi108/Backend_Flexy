import express from 'express';
import inventoryController from '../controllers/inventoryController.js';

const router = express.Router();

router.post('/reserve', inventoryController.reserve.bind(inventoryController));
router.get('/:sku', inventoryController.getInventory.bind(inventoryController));

export default router;

