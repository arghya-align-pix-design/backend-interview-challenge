import { Router, Request, Response } from 'express';
import { SyncService } from '../services/syncService';
import { TaskService } from '../services/taskService';
import { Database } from '../db/database';

export function createSyncRouter(db: Database): Router {
  const router = Router();
  const taskService = new TaskService(db);
  const syncService = new SyncService(db, taskService);

  // Trigger manual sync
  router.post('/sync', async (req: Request, res: Response) => {
    // TODO: Implement sync endpoint
    // 1. Check connectivity first
    // 2. Call syncService.sync()
    // 3. Return sync result
    try {
      const isConnected = await syncService.checkConnectivity();
      if (!isConnected) {
        return res.status(503).json({ error: 'Server not reachable. Please try again later.' });
      }

      const result = await syncService.sync();
      return res.status(200).json({
        message: 'Sync completed',
        result,
      });
    } catch (error) {
      console.error('Sync failed:', error);
      res.status(500).json({ error: 'Failed to sync data - (check syncts)' });
    }
  });

  // Check sync status
  router.get('/status', async (req: Request, res: Response) => {
    // TODO: Implement sync status endpoint
    // 1. Get pending sync count
    // 2. Get last sync timestamp
    // 3. Check connectivity
    // 4. Return status summary
    try {
      // Get number of pending items
      const pendingItems = await db.all('SELECT * FROM sync_queue');
      const lastSynced = await db.get(
        'SELECT MAX(last_synced_at) as last_synced_at FROM tasks WHERE last_synced_at IS NOT NULL'
      );

       const isConnected = await syncService.checkConnectivity();

      return res.status(200).json({
        pending_count: pendingItems.length,
        last_synced_at: lastSynced?.last_synced_at ?? null,
        server_reachable: isConnected,
      });
    } catch (error) {
      console.error('Failed to get sync status:', error);
      res.status(500).json({ error: 'Faled to check sync status- (check syncts)' });
    }
  });

  // Batch sync endpoint (for server-side)
  router.post('/batch', async (req: Request, res: Response) => {
    // TODO: Implement batch sync endpoint
    // This would be implemented on the server side
    // to handle batch sync requests from clients
    
    res.status(501).json({ error: 'Not implemented' });
  });

  // Health check endpoint
  router.get('/health', async (req: Request, res: Response) => {
    res.json({ status: 'ok', timestamp: new Date() });
  });

  return router;
}