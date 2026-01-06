import express from 'express';
import checkoutController from '../controllers/checkoutController.js';

const router = express.Router();

router.post('/confirm', checkoutController.confirm.bind(checkoutController));
router.post('/cancel', checkoutController.cancel.bind(checkoutController));

export default router;

