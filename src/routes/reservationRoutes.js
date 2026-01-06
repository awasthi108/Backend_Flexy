import express from 'express';
import reservationsController from '../controllers/reservationsController.js';

const router = express.Router();

router.get('/pending', reservationsController.getPending.bind(reservationsController));

export default router;

