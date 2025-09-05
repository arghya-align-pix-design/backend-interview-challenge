import { v4 as uuidv4 } from 'uuid';
import { Task } from '../types';
import { Database } from '../db/database';

export class TaskService {
  constructor(private db: Database) {}

  async createTask(taskData: Partial<Task>): Promise<Task> {
    // TODO: Implement task creation
    // 1. Generate UUID for the task
    // 2. Set default values (completed: false, is_deleted: false)
    // 3. Set sync_status to 'pending'
    // 4. Insert into database
    // 5. Add to sync queue
    //Time when the task is reached here
    const now = new Date();
    const id = uuidv4();

    const newTask: Task = {
    id,
    title: taskData.title ?? "",
    description: taskData.description ?? "",
    completed: false,
    created_at: now,
    updated_at: now,
    is_deleted: false,
    sync_status: "pending",
    server_id: undefined,   
    last_synced_at: undefined,   
    };

    const sql = `
      INSERT INTO tasks (id, title, description, completed, created_at, updated_at, is_deleted, sync_status, server_id, last_synced_at)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `;

    await this.db.run(sql, [
      newTask.id,
      newTask.title,
      newTask.description,
      newTask.completed ? 1:0,
      newTask.created_at,
      newTask.updated_at,
      newTask.is_deleted ? 1 : 0,
      newTask.sync_status,
      newTask.server_id,
      newTask.last_synced_at,
    ]); 

    //Adding to the sync queue
    const syncSql = `
      INSERT INTO sync_queue (id, task_id, operation, data)
      VALUES (?, ?, ?, ?)
    `;

    await this.db.run(syncSql, [
      uuidv4(),
      newTask.id,
      'create',
      JSON.stringify(newTask),
      //attempts: 0,
  ]);

  return newTask;

    //throw new Error('Not implemented');
  }

  async updateTask(id: string, updates: Partial<Task>): Promise<Task | null> {
    // TODO: Implement task update
    // 1. Check if task exists
    // 2. Update task in database
    // 3. Update updated_at timestamp
    // 4. Set sync_status to 'pending'
    // 5. Add to sync queue

    const existing = await this.db.get(
      'SELECT * FROM tasks WHERE id = ? AND is_deleted = 0',
      [id]
    );
    if (!existing) return null;

    const updatedTask: Task = {
      ...existing,
      ...updates,
      updated_at: new Date().toISOString(),
      sync_status: 'pending',
    };

    const sql = `
      UPDATE tasks
      SET title = ?, description = ?, completed = ?, updated_at = ?, is_deleted = ?, sync_status = ?
      WHERE id = ?
    `;

    await this.db.run(sql, [
      updatedTask.title,
      updatedTask.description,
      updatedTask.completed ? 1 : 0,
      updatedTask.updated_at,
      updatedTask.is_deleted ? 1 : 0,
      updatedTask.sync_status,
      id,
    ]);

    const syncSql = `
      INSERT INTO sync_queue (id, task_id, operation, data)
      VALUES (?, ?, ?, ?)
    `;
    await this.db.run(syncSql, [
      uuidv4(),
      updatedTask.id,
      'update',
      JSON.stringify(updatedTask),
    ]);  

  return updatedTask;
    //throw new Error('Not implemented');
  }

  async deleteTask(id: string): Promise<boolean> {
    // TODO: Implement soft delete
    // 1. Check if task exists
    // 2. Set is_deleted to true
    // 3. Update updated_at timestamp
    // 4. Set sync_status to 'pending'
    // 5. Add to sync queue

    const existing = await this.db.get(
      'SELECT * FROM tasks WHERE id = ? AND is_deleted = 0',
      [id]
    );
    if (!existing) return false;

    const updatedAt = new Date().toISOString();

    const sql = `
      UPDATE tasks
      SET is_deleted = 1, updated_at = ?, sync_status = 'pending'
      WHERE id = ?
    `;

    await this.db.run(sql, [updatedAt, id]);

    const syncSql = `
      INSERT INTO sync_queue (id, task_id, operation, data)
      VALUES (?, ?, ?, ?)
    `;
    await this.db.run(syncSql, [
      uuidv4(),
      id,
      'delete',
      JSON.stringify({ ...existing, is_deleted: true, updated_at: updatedAt }),
    ]);  

  return true;

    throw new Error('Not implemented');
  }

  async getTask(id: string): Promise<Task | null> {
    // TODO: Implement get single task
    // 1. Query database for task by id
    // 2. Return null if not found or is_deleted is true
    const task = await this.db.get(
      'SELECT * FROM tasks WHERE id = ? AND is_deleted = 0',
      [id]
    );
    return task ?this.mapRowToTask(task): null;

    throw new Error('Not implemented');
  }

  async getAllTasks(): Promise<Task[]> {
    // TODO: Implement get all non-deleted tasks
    // 1. Query database for all tasks where is_deleted = false
    // 2. Return array of tasks
    const tasks= await this.db.all(
      'SELECT * FROM tasks WHERE is_deleted = 0'
    );
    return tasks.map((i) =>this.mapRowToTask(i));
    //throw new Error('Not implemented');
  }

  async getTasksNeedingSync(): Promise<Task[]> {
    // TODO: Get all tasks with sync_status = 'pending' or 'error'
    return await this.db.all(
      "SELECT * FROM tasks WHERE sync_status IN ('pending', 'error')"
    );
    throw new Error('Not implemented');
  }

  private mapRowToTask(row: any): Task {
  return {
    ...row,
    completed: !!row.completed,
    is_deleted: !!row.is_deleted,
    created_at: new Date(row.created_at),
    updated_at: new Date(row.updated_at),
    last_synced_at: row.last_synced_at ? new Date(row.last_synced_at) : null,
  };
}
}