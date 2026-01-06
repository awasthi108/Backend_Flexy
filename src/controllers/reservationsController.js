import reservationRepository from '../repositories/reservationRepository.js';

class ReservationsController {
  /**
   * GET /reservations/pending
   * Returns active (unexpired) reserved reservations for admin/debug
   */
  async getPending(req, res) {
    try {
      const reservations = await reservationRepository.getActiveByStatuses(['RESERVED']);
      if (!reservations || reservations.length === 0) {
        return res.status(200).json({ success: true, data: [], message: 'No active reservations' });
      }
      return res.status(200).json({ success: true, data: reservations });
    } catch (error) {
      console.error('[PENDING_RESERVATIONS] Error:', error);
      return res.status(500).json({ success: false, error: 'Internal server error' });
    }
  }
}

export default new ReservationsController();

