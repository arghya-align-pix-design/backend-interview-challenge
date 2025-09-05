import sqlite3 from 'sqlite3';
import { promisify } from 'util';
import { Task, SyncQueueItem } from '../types';
import { randomUUID } from 'crypto';

const sqlite = sqlite3.verbose();

export class Database {
  private db: sqlite3.Database;

  constructor(filename: string = ':memory:') {
    this.db = new sqlite.Database(filename);
  }

  async initialize(): Promise<void> {
    await this.createTables();
  }

  private async createTables(): Promise<void> {
    const createTasksTable = `
      CREATE TABLE IF NOT EXISTS tasks (
        id TEXT PRIMARY KEY,
        title TEXT NOT NULL,
        description TEXT,
        completed INTEGER DEFAULT 0,
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
        updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
        is_deleted INTEGER DEFAULT 0,
        sync_status TEXT DEFAULT 'pending',
        server_id TEXT,
        last_synced_at DATETIME
      )
    `;

    const createSyncQueueTable = `
      CREATE TABLE IF NOT EXISTS sync_queue (
        id TEXT PRIMARY KEY,
        task_id TEXT NOT NULL,
        operation TEXT NOT NULL,
        data TEXT NOT NULL,
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
        retry_count INTEGER DEFAULT 0,
        error_message TEXT,
        FOREIGN KEY (task_id) REFERENCES tasks(id)
      )
    `;

    await this.run(createTasksTable);
    await this.run(createSyncQueueTable);
  }

  // Helper methods
  run(sql: string, params: any[] = []): Promise<void> {
    return new Promise((resolve, reject) => {
      this.db.run(sql, params, (err) => {
        if (err) reject(err);
        else resolve();
      });
    });
  }

  get(sql: string, params: any[] = []): Promise<any> {
    return new Promise((resolve, reject) => {
      this.db.get(sql, params, (err, row) => {
        if (err) reject(err);
        else resolve(row);
      });
    });
  }

  all(sql: string, params: any[] = []): Promise<any[]> {
    return new Promise((resolve, reject) => {
      this.db.all(sql, params, (err, rows) => {
        if (err) reject(err);
        else resolve(rows);
      });
    });
  }

  close(): Promise<void> {
    return new Promise((resolve, reject) => {
      this.db.close((err) => {
        if (err) reject(err);
        else resolve();
      });
    });
  }

  /** Get all items in sync queue */
  async getAllSyncQueueItems(): Promise<SyncQueueItem[]> {
    const rows = await this.all(`SELECT * FROM sync_queue ORDER BY created_at ASC`);
    return rows.map(row => ({
      ...row,
      created_at: new Date(row.created_at),
      data: JSON.parse(row.data) // parse JSON back to object
    }));
  }

  /** Insert a new sync queue item */
  async insertSyncQueueItem(item: SyncQueueItem): Promise<void> {
    await this.run(
      `INSERT INTO sync_queue (id, task_id, operation, data, created_at, retry_count, error_message)
       VALUES (?, ?, ?, ?, ?, ?, ?)`,
      [
        item.id || randomUUID(),
        item.task_id,
        item.operation,
        JSON.stringify(item.data),
        item.created_at.toISOString(),
        item.retry_count,
        item.error_message || null
      ]
    );
  }

  /** Remove a sync queue item by task ID */
  async removeFromSyncQueue(taskId: string): Promise<void> {
    await this.run(`DELETE FROM sync_queue WHERE task_id = ?`, [taskId]);
  }

   /** Update an existing sync queue item (for retries) */
  async updateSyncQueueItem(item: SyncQueueItem): Promise<void> {
    await this.run(
      `UPDATE sync_queue SET retry_count = ?, error_message = ? WHERE id = ?`,
      [item.retry_count, item.error_message || null, item.id]
    );
  }
}