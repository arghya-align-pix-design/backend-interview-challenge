import { Router, Request, Response } from 'express';
import { TaskService } from '../services/taskService';
import { SyncService } from '../services/syncService';
import { Database } from '../db/database';

export function createTaskRouter(db: Database): Router {
  const router = Router();
  const taskService = new TaskService(db);
  const syncService = new SyncService(db, taskService);

  // Get all tasks
  router.get('/', async (req: Request, res: Response) => {
    try {
      const tasks = await taskService.getAllTasks();
      res.status(200).json(tasks);
    } catch (error) {
      res.status(500).json({ error: 'Failed to fetch tasks (check tasks.ts- all tasks)' });
    }
  });

  // Get single task
  router.get('/:id', async (req: Request, res: Response) => {
    try {
      const task = await taskService.getTask(req.params.id);
      if (!task) {
        return res.status(404).json({ error: 'Task not found' });
      }
      return res.status(200).json(task);
    } catch (error) {
      res.status(500).json({ error: 'Failed to fetch task (check tasks.ts- single task)' });
    }
  });

  // Create task 
  router.post('/', async (req: Request, res: Response) => {
    // TODO: Implement task creation endpoint
    // 1. Validate request body
    // 2. Call taskService.createTask()
    // 3. Return created task
      try {
      const { title, description } = req.body;

      // 1. Basic validation
      if (!title || typeof title !== 'string') {
        return res.status(400).json({ error: 'Title is required and must be a string' });
      }
      // 2. Create task
      const createdTask = await taskService.createTask({
        title,
        description: description ?? undefined,
      });

      res.status(201).json(createdTask);
    }
    catch (error) {
      console.error(error);
      res.status(500).json({ error: 'Not implemented (check tasks.ts- create tasks)' });
    }
  });

  // Update task-
  router.put('/:id', async (req: Request, res: Response) => {
    // TODO: Implement task update endpoint
    // 1. Validate request body
    // 2. Call taskService.updateTask()
    // 3. Handle not found case
    // 4. Return updated task
    try {
      const { title, description, completed } = req.body;

      // Validate at least one field is provided
      if (title === undefined && description === undefined && completed === undefined) {
        return res.status(400).json({ error: 'No update fields provided' });
      }

      const updatedTask = await taskService.updateTask(req.params.id, {
        title,
        description,
        completed,
      });

      if (!updatedTask) {
        return res.status(404).json({ error: 'Task not found' });
      }
      res.json(updatedTask);
    } catch (error) {
      console.error(error);
      res.status(500).json({ error: 'Failed to Update task (check tasks.ts- update tasks)' });
    }  
  });

  // Delete task
  router.delete('/:id', async (req: Request, res: Response) => {
    // TODO: Implement task deletion endpoint
    // 1. Call taskService.deleteTask()
    // 2. Handle not found case
    // 3. Return success response

    try {
      const success = await taskService.deleteTask(req.params.id);

      if (!success) {
        return res.status(404).json({ error: 'Task not found' });
      }
       res.status(204).json({ success: true });
    } catch (error) {
      console.error(error);
      res.status(500).json({ error: 'Failed to delete task (check tasks.ts- delete task)' });
    }  
  });

  return router;
}