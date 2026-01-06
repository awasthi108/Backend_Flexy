import express from 'express';
import { initializeDatabase } from './config/database.js';
import inventoryRoutes from './routes/inventoryRoutes.js';
import checkoutRoutes from './routes/checkoutRoutes.js';
import reservationRoutes from './routes/reservationRoutes.js';
import inventoryService from './services/inventoryService.js';
import inventoryRepository from './repositories/inventoryRepository.js';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';
import { mkdirSync } from 'fs';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

// Ensure data directory exists
const dataDir = join(__dirname, '../data');
try {
  mkdirSync(dataDir, { recursive: true });
} catch (error) {
  // Directory might already exist
}

// Initialize database and seed inventory
async function startServer() {
  try {
    await initializeDatabase();

    // Initialize hard-coded inventory
    await inventoryRepository.upsert('IPHONE_15', 5);
    await inventoryRepository.upsert('AIRPODS_PRO', 3);
    await inventoryRepository.upsert('PIXEL_8', 4);
    await inventoryRepository.upsert('SAMSUNG_S23', 6);
    console.log('Inventory initialized');

    // Run an immediate cleanup at startup to clear stale reservations
    try {
      const cleaned = await inventoryService.cleanupExpiredReservations();
      if (cleaned > 0) {
        console.log(`[CLEANUP] Startup cleanup expired ${cleaned} reservations`);
      }
    } catch (error) {
      console.error('[CLEANUP] Startup cleanup error:', error);
    }

    // Setup Express app
    const app = express();
    const PORT = process.env.PORT || 3000;

    // Middleware
    app.use(express.json());
    
    // Serve static files from public directory
    app.use(express.static(join(__dirname, '../public')));

    // Routes
    app.use('/inventory', inventoryRoutes);
    app.use('/checkout', checkoutRoutes);
    app.use('/reservations', reservationRoutes);

    // Health check endpoint
    app.get('/health', (req, res) => {
      res.json({ status: 'ok', timestamp: new Date().toISOString() });
    });

    // Start cleanup job for expired reservations (runs every 30 seconds)
    setInterval(async () => {
      try {
        const cleaned = await inventoryService.cleanupExpiredReservations();
        if (cleaned > 0) {
          console.log(`[CLEANUP] Cleaned up ${cleaned} expired reservations`);
        }
      } catch (error) {
        console.error('[CLEANUP] Error:', error);
      }
    }, 30 * 1000); // Every 30 seconds

    // Start server
    app.listen(PORT, () => {
      console.log(`Server running on http://localhost:${PORT}`);
      console.log('Available endpoints:');
      console.log('  POST /inventory/reserve');
      console.log('  GET  /inventory/:sku');
      console.log('  POST /checkout/confirm');
      console.log('  POST /checkout/cancel');
      console.log('  GET  /health');
    });
  } catch (error) {
    console.error('Failed to start server:', error);
    process.exit(1);
  }
}

startServer();
