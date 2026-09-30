const express = require('express');
const cors = require('cors');
const path = require('path');
const fs = require('fs');

const app = express();
const PORT = process.env.PORT || 3000;

const DATA_DIR = path.join(__dirname, 'data');
const PROJECTS_FILE = path.join(DATA_DIR, 'projects.json');
const TASKS_FILE = path.join(DATA_DIR, 'tasks.json');

// Ensure data folder and files exist
if (!fs.existsSync(DATA_DIR)) {
  fs.mkdirSync(DATA_DIR, { recursive: true });
}
if (!fs.existsSync(PROJECTS_FILE)) {
  fs.writeFileSync(PROJECTS_FILE, JSON.stringify([], null, 2));
}
if (!fs.existsSync(TASKS_FILE)) {
  fs.writeFileSync(TASKS_FILE, JSON.stringify([], null, 2));
}

// Helpers
function readData(filePath) {
  try {
    const raw = fs.readFileSync(filePath, 'utf-8');
    return JSON.parse(raw || '[]');
  } catch (err) {
    console.error(`Error reading ${filePath}:`, err);
    return [];
  }
}

function writeData(filePath, data) {
  try {
    fs.writeFileSync(filePath, JSON.stringify(data, null, 2), 'utf-8');
    return true;
  } catch (err) {
    console.error(`Error writing ${filePath}:`, err);
    return false;
  }
}

// Middleware
app.use(cors());
app.use(express.json());
app.use(express.static(path.join(__dirname, 'public')));

// ----------------------------------------------------
// PROJECT ROUTES
// ----------------------------------------------------

// GET /api/projects
app.get('/api/projects', (req, res) => {
  const projects = readData(PROJECTS_FILE);
  const tasks = readData(TASKS_FILE);

  // Compute counts
  const enriched = projects.map(p => {
    const projectTasks = tasks.filter(t => t.projectId === p.id);
    const completedCount = projectTasks.filter(t => t.status === 'Completed').length;
    return {
      ...p,
      taskCount: projectTasks.length,
      completedCount,
      progress: projectTasks.length > 0 ? Math.round((completedCount / projectTasks.length) * 100) : 0
    };
  });

  res.json({ success: true, data: enriched });
});

// POST /api/projects
app.post('/api/projects', (req, res) => {
  const { name, description, color } = req.body;
  if (!name || !name.trim()) {
    return res.status(400).json({ success: false, message: 'Project name is required' });
  }

  const projects = readData(PROJECTS_FILE);
  const newProject = {
    id: 'proj-' + Date.now(),
    name: name.trim(),
    description: description ? description.trim() : '',
    color: color || '#6366f1',
    createdAt: new Date().toISOString()
  };

  projects.unshift(newProject);
  writeData(PROJECTS_FILE, projects);

  res.status(201).json({ success: true, data: newProject, message: 'Project created successfully' });
});

// DELETE /api/projects/:id
app.delete('/api/projects/:id', (req, res) => {
  const { id } = req.params;
  const projects = readData(PROJECTS_FILE);
  const filteredProjects = projects.filter(p => p.id !== id);

  if (projects.length === filteredProjects.length) {
    return res.status(404).json({ success: false, message: 'Project not found' });
  }

  // Also remove or unlink associated tasks
  const tasks = readData(TASKS_FILE);
  const remainingTasks = tasks.filter(t => t.projectId !== id);

  writeData(PROJECTS_FILE, filteredProjects);
  writeData(TASKS_FILE, remainingTasks);

  res.json({ success: true, message: 'Project and associated tasks deleted successfully' });
});

// ----------------------------------------------------
// TASK ROUTES
// ----------------------------------------------------

// GET /api/tasks
app.get('/api/tasks', (req, res) => {
  let tasks = readData(TASKS_FILE);
  const projects = readData(PROJECTS_FILE);
  const { projectId, date, startDate, endDate, status, priority, search } = req.query;

  if (projectId) {
    tasks = tasks.filter(t => t.projectId === projectId);
  }
  if (date) {
    tasks = tasks.filter(t => t.date === date);
  }
  if (startDate) {
    tasks = tasks.filter(t => t.date >= startDate);
  }
  if (endDate) {
    tasks = tasks.filter(t => t.date <= endDate);
  }
  if (status) {
    tasks = tasks.filter(t => t.status.toLowerCase() === status.toLowerCase());
  }
  if (priority) {
    tasks = tasks.filter(t => t.priority.toLowerCase() === priority.toLowerCase());
  }
  if (search) {
    const q = search.toLowerCase();
    tasks = tasks.filter(t =>
      (t.title && t.title.toLowerCase().includes(q)) ||
      (t.description && t.description.toLowerCase().includes(q))
    );
  }

  // Enrich with project details
  const projectMap = new Map(projects.map(p => [p.id, p]));
  const enriched = tasks.map(t => ({
    ...t,
    project: projectMap.get(t.projectId) || { name: 'Unassigned', color: '#94a3b8' }
  }));

  // Sort by date ascending, then priority
  const priorityOrder = { High: 1, Medium: 2, Low: 3 };
  enriched.sort((a, b) => {
    if (a.date !== b.date) {
      return a.date.localeCompare(b.date);
    }
    return (priorityOrder[a.priority] || 4) - (priorityOrder[b.priority] || 4);
  });

  res.json({ success: true, count: enriched.length, data: enriched });
});

// POST /api/tasks
app.post('/api/tasks', (req, res) => {
  const { title, description, projectId, date, priority, status, hours, minutes } = req.body;

  if (!title || !title.trim()) {
    return res.status(400).json({ success: false, message: 'Task title is required' });
  }
  if (!date) {
    return res.status(400).json({ success: false, message: 'Task date is required' });
  }

  const tasks = readData(TASKS_FILE);
  const newTask = {
    id: 'task-' + Date.now(),
    title: title.trim(),
    description: description ? description.trim() : '',
    projectId: projectId || '',
    date: date, // YYYY-MM-DD
    priority: priority || 'Medium', // Low, Medium, High
    status: status || 'Pending', // Pending, In Progress, Completed
    hours: Math.max(0, parseInt(hours) || 0),
    minutes: Math.max(0, Math.min(59, parseInt(minutes) || 0)),
    createdAt: new Date().toISOString()
  };

  tasks.unshift(newTask);
  writeData(TASKS_FILE, tasks);

  const projects = readData(PROJECTS_FILE);
  const project = projects.find(p => p.id === newTask.projectId) || { name: 'Unassigned', color: '#94a3b8' };

  res.status(201).json({
    success: true,
    data: { ...newTask, project },
    message: 'Task added successfully'
  });
});

// PUT /api/tasks/:id
app.put('/api/tasks/:id', (req, res) => {
  const { id } = req.params;
  const { title, description, projectId, date, priority, status, hours, minutes } = req.body;

  const tasks = readData(TASKS_FILE);
  const idx = tasks.findIndex(t => t.id === id);

  if (idx === -1) {
    return res.status(404).json({ success: false, message: 'Task not found' });
  }

  tasks[idx] = {
    ...tasks[idx],
    title: title !== undefined ? title.trim() : tasks[idx].title,
    description: description !== undefined ? description.trim() : tasks[idx].description,
    projectId: projectId !== undefined ? projectId : tasks[idx].projectId,
    date: date !== undefined ? date : tasks[idx].date,
    priority: priority !== undefined ? priority : tasks[idx].priority,
    status: status !== undefined ? status : tasks[idx].status,
    hours: hours !== undefined ? Math.max(0, parseInt(hours) || 0) : (tasks[idx].hours || 0),
    minutes: minutes !== undefined ? Math.max(0, Math.min(59, parseInt(minutes) || 0)) : (tasks[idx].minutes || 0),
    updatedAt: new Date().toISOString()
  };

  writeData(TASKS_FILE, tasks);

  const projects = readData(PROJECTS_FILE);
  const project = projects.find(p => p.id === tasks[idx].projectId) || { name: 'Unassigned', color: '#94a3b8' };

  res.json({
    success: true,
    data: { ...tasks[idx], project },
    message: 'Task updated successfully'
  });
});

// PATCH /api/tasks/:id/status
app.patch('/api/tasks/:id/status', (req, res) => {
  const { id } = req.params;
  const { status } = req.body;

  if (!status) {
    return res.status(400).json({ success: false, message: 'Status is required' });
  }

  const tasks = readData(TASKS_FILE);
  const idx = tasks.findIndex(t => t.id === id);

  if (idx === -1) {
    return res.status(404).json({ success: false, message: 'Task not found' });
  }

  tasks[idx].status = status;
  tasks[idx].updatedAt = new Date().toISOString();
  writeData(TASKS_FILE, tasks);

  res.json({ success: true, data: tasks[idx], message: `Status updated to ${status}` });
});

// DELETE /api/tasks/:id
app.delete('/api/tasks/:id', (req, res) => {
  const { id } = req.params;
  const tasks = readData(TASKS_FILE);
  const filtered = tasks.filter(t => t.id !== id);

  if (tasks.length === filtered.length) {
    return res.status(404).json({ success: false, message: 'Task not found' });
  }

  writeData(TASKS_FILE, filtered);
  res.json({ success: true, message: 'Task deleted successfully' });
});

// ----------------------------------------------------
// STATS ROUTE
// ----------------------------------------------------

app.get('/api/stats', (req, res) => {
  const tasks = readData(TASKS_FILE);
  const projects = readData(PROJECTS_FILE);

  const todayStr = new Date().toISOString().split('T')[0];

  const total = tasks.length;
  const completed = tasks.filter(t => t.status === 'Completed').length;
  const inProgress = tasks.filter(t => t.status === 'In Progress').length;
  const pending = tasks.filter(t => t.status === 'Pending').length;
  const dueToday = tasks.filter(t => t.date === todayStr).length;
  const overdue = tasks.filter(t => t.date < todayStr && t.status !== 'Completed').length;

  // Calculate total time logged in hours and minutes
  const totalMinutesSpent = tasks.reduce((sum, t) => sum + ((parseInt(t.hours) || 0) * 60) + (parseInt(t.minutes) || 0), 0);
  const totalHoursOnly = Math.floor(totalMinutesSpent / 60);
  const remainingMinsOnly = totalMinutesSpent % 60;
  const totalTimeFormatted = totalMinutesSpent > 0 ? `${totalHoursOnly}h ${remainingMinsOnly}m` : '0h 0m';

  // Date groups summary
  const dateGroups = {};
  tasks.forEach(t => {
    dateGroups[t.date] = (dateGroups[t.date] || 0) + 1;
  });

  res.json({
    success: true,
    data: {
      total,
      completed,
      inProgress,
      pending,
      dueToday,
      overdue,
      completionRate: total > 0 ? Math.round((completed / total) * 100) : 0,
      totalProjects: projects.length,
      totalMinutesSpent,
      totalTimeFormatted,
      dateDistribution: dateGroups
    }
  });
});

// ----------------------------------------------------
// EXPORT ROUTE (CSV)
// ----------------------------------------------------

app.get('/api/export/csv', (req, res) => {
  const tasks = readData(TASKS_FILE);
  const projects = readData(PROJECTS_FILE);
  const projectMap = new Map(projects.map(p => [p.id, p.name]));

  let csv = 'ID,Title,Description,Project,Date,Time Spent,Priority,Status,Created At\n';
  tasks.forEach(t => {
    const projName = projectMap.get(t.projectId) || 'Unassigned';
    const cleanTitle = `"${(t.title || '').replace(/"/g, '""')}"`;
    const cleanDesc = `"${(t.description || '').replace(/"/g, '""')}"`;
    const timeFormatted = `${t.hours || 0}h ${t.minutes || 0}m`;
    csv += `${t.id},${cleanTitle},${cleanDesc},"${projName}",${t.date},"${timeFormatted}",${t.priority},${t.status},${t.createdAt}\n`;
  });

  res.setHeader('Content-Type', 'text/csv');
  res.setHeader('Content-Disposition', 'attachment; filename="work-tracking-tasks.csv"');
  res.send(csv);
});

// Fallback for SPA
app.use((req, res) => {
  res.sendFile(path.join(__dirname, 'public', 'index.html'));
});

app.listen(PORT, () => {
  console.log(`===============================================`);
  console.log(`🚀 Work-Tracking server running on http://localhost:${PORT}`);
  console.log(`===============================================`);
});
