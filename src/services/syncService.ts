import axios from 'axios';
import { Task, SyncQueueItem, SyncResult, BatchSyncRequest, BatchSyncResponse } from '../types';
import { Database } from '../db/database';
import { TaskService } from './taskService';

export class SyncService {
  private apiUrl: string;
  
  constructor(
    private db: Database,
    private taskService: TaskService,
    apiUrl: string = process.env.API_BASE_URL || 'http://localhost:3000/api'
  ) {
    this.apiUrl = apiUrl;
  }

  async sync(): Promise<SyncResult> {
    const syncResult: SyncResult = {
      success: true,
      synced_items: 0,
      failed_items: 0,
      errors: []
    };
    // TODO: Main sync orchestration method
    // 1. Get all items from sync queue
   try {
      const items = await this.db.getAllSyncQueueItems();
      if (!items.length) return syncResult;

      const batchSize = parseInt(process.env.SYNC_BATCH_SIZE || '10', 10);
      const batches = this.chunkArray(items, batchSize);

      for (const batch of batches) {
        try {
          const response = await this.processBatch(batch);

          for (const result of response.processed_items) {
            const queueItem = batch.find(i => i.id === result.client_id);
            if (!queueItem) continue;

            if (result.status === 'success') {
              await this.updateSyncStatus(queueItem.task_id, 'synced', {
                server_id: result.server_id
              });
              syncResult.synced_items++;
            } else if (result.status === 'conflict' && result.resolved_data) {
              const task=await this.taskService.getTask(queueItem.task_id)
              if(!task){
                console.warn(`Task with ID ${queueItem.task_id} not found locally. Skipping.`);
                continue;
              }
              const resolved = await this.resolveConflict(
                task,
                result.resolved_data
              );
              await this.taskService.updateTask(resolved.id, resolved);
              await this.updateSyncStatus(queueItem.task_id, 'synced');
              syncResult.synced_items++;
            } else {
              await this.handleSyncError(queueItem, new Error(result.error || 'Unknown error'));
              syncResult.failed_items++;
              syncResult.errors.push({
                task_id: queueItem.task_id,
                operation: queueItem.operation,
                error: result.error || 'Unknown error',
                timestamp: new Date()
              });
            }
          }
        } catch (err: any) {
          // If the whole batch fails, mark all as errors
          for (const item of batch) {
            await this.handleSyncError(item, err);
            syncResult.failed_items++;
            syncResult.errors.push({
              task_id: item.task_id,
              operation: item.operation,
              error: err.message,
              timestamp: new Date()
            });
          }
          syncResult.success = false;
        }
      }
    } catch (error) {
      console.error('[Sync] Unexpected error during sync', error);
      syncResult.success = false;
    }

    return syncResult;
  }


  async addToSyncQueue(taskId: string,
    operation: 'create' | 'update' | 'delete', 
    data: Partial<Task>): Promise<void> {
    // TODO: Add operation to sync queue
    const queueItem: SyncQueueItem = {
      id: crypto.randomUUID(),
      task_id: taskId,
      operation,
      data,
      created_at: new Date(),
      retry_count: 0
    };

    await this.db.insertSyncQueueItem(queueItem);
    // 1. Create sync queue item
    // 2. Store serialized task data
    // 3. Insert into sync_queue table
    throw new Error('Not implemented');
  }

  private async processBatch(items: SyncQueueItem[]): Promise<BatchSyncResponse> {
    // TODO: Process a batch of sync items
    // 1. Prepare batch request
    // 2. Send to server
    // 3. Handle response
    
    
    const requestPayload: BatchSyncRequest = {
      items,
      client_timestamp: new Date()
    };

    const response = await axios.post<BatchSyncResponse>(`${this.apiUrl}/sync`, requestPayload);
    return response.data;// 4. Apply conflict resolution if needed
    throw new Error('Not implemented');
  }

  private async resolveConflict(localTask: Task, serverTask: Task): Promise<Task> {
    // TODO: Implement last-write-wins conflict resolution
    // 1. Compare updated_at timestamps
    // 2. Return the more recent version
    // 3. Log conflict resolution decision
    if (new Date(localTask.updated_at) > new Date(serverTask.updated_at)) {
      console.log(`[Sync] Conflict resolved: keeping LOCAL version for task ${localTask.id}`);
      return localTask;
    } else {
      console.log(`[Sync] Conflict resolved: keeping SERVER version for task ${localTask.id}`);
      return serverTask;
    }
    throw new Error('Not implemented');
  }

  private async updateSyncStatus(taskId: string, status: 'synced' | 'error', serverData?: Partial<Task>): Promise<void> {
    // TODO: Update task sync status
    // 1. Update sync_status field
    // 2. Update server_id if provided
    // 3. Update last_synced_at timestamp
    // 4. Remove from sync queue if successful
    const updates: Partial<Task> = {
      sync_status: status,
      last_synced_at: new Date()
    };

    if (serverData?.server_id) updates.server_id = serverData.server_id;

    await this.taskService.updateTask(taskId, updates);

    if (status === 'synced') {
      await this.db.removeFromSyncQueue(taskId);
    }
    throw new Error('Not implemented');
  }

  private async handleSyncError(item: SyncQueueItem, error: Error): Promise<void> {
    // TODO: Handle sync errors
    // 1. Increment retry count
    // 2. Store error message
    // 3. If retry count exceeds limit, mark as permanent failure
    const retryLimit = parseInt(process.env.SYNC_MAX_RETRIES || '3', 10);

    item.retry_count += 1;
    item.error_message = error.message;

    if (item.retry_count > retryLimit) {
      console.error(`[Sync] Permanent failure for task ${item.task_id}: ${error.message}`);
      await this.updateSyncStatus(item.task_id, 'error');
      await this.db.removeFromSyncQueue(item.id);
    } else {
      await this.db.updateSyncQueueItem(item);
    }
  }

  async checkConnectivity(): Promise<boolean> {
    // TODO: Check if server is reachable
    // 1. Make a simple health check request
    // 2. Return true if successful, false otherwise
    try {
      await axios.get(`${this.apiUrl}/health`, { timeout: 5000 });
      return true;
    } catch {
      return false;
    }
  }
  
  private chunkArray<T>(array: T[], size: number): T[][] {
    const result: T[][] = [];
    for (let i = 0; i < array.length; i += size) {
      result.push(array.slice(i, i + size));
    }
    return result;
  }
}