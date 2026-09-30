const express = require('express');
const cors = require('cors');
const path = require('path');
const fs = require('fs');
const crypto = require('crypto');

const app = express();
const PORT = process.env.PORT || 3000;

const DATA_DIR = path.join(__dirname, 'data');
const USERS_DIR = path.join(DATA_DIR, 'users');
const USERS_FILE = path.join(DATA_DIR, 'users.json');
const SESSIONS_FILE = path.join(DATA_DIR, 'sessions.json');
const LEGACY_TASKS_FILE = path.join(DATA_DIR, 'tasks.json');
const LEGACY_PROJECTS_FILE = path.join(DATA_DIR, 'projects.json');

// Ensure base directories exist
if (!fs.existsSync(DATA_DIR)) fs.mkdirSync(DATA_DIR, { recursive: true });
if (!fs.existsSync(USERS_DIR)) fs.mkdirSync(USERS_DIR, { recursive: true });
if (!fs.existsSync(USERS_FILE)) fs.writeFileSync(USERS_FILE, JSON.stringify([], null, 2));
if (!fs.existsSync(SESSIONS_FILE)) fs.writeFileSync(SESSIONS_FILE, JSON.stringify({}, null, 2));

// Helper: Read/Write JSON
function readData(filePath) {
  try {
    if (!fs.existsSync(filePath)) return null;
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

// Password Hashing
const SALT = 'work_tracking_secret_salt_2026';
function hashPassword(password) {
  return crypto.createHash('sha256').update(password + SALT).digest('hex');
}

// User Storage Resolver
function getUserStorage(userId) {
  const safeId = userId.toLowerCase().replace(/[^a-z0-9_-]/g, '_');
  const userFolder = path.join(USERS_DIR, safeId);

  if (!fs.existsSync(userFolder)) {
    fs.mkdirSync(userFolder, { recursive: true });
  }

  const tasksFile = path.join(userFolder, 'tasks.json');
  const projectsFile = path.join(userFolder, 'projects.json');

  if (!fs.existsSync(tasksFile)) {
    const legacyTasks = readData(LEGACY_TASKS_FILE);
    if (legacyTasks && legacyTasks.length > 0) {
      fs.writeFileSync(tasksFile, JSON.stringify(legacyTasks, null, 2));
      writeData(LEGACY_TASKS_FILE, []);
    } else {
      fs.writeFileSync(tasksFile, JSON.stringify([], null, 2));
    }
  }

  if (!fs.existsSync(projectsFile)) {
    const legacyProjects = readData(LEGACY_PROJECTS_FILE);
    if (legacyProjects && legacyProjects.length > 0) {
      fs.writeFileSync(projectsFile, JSON.stringify(legacyProjects, null, 2));
      writeData(LEGACY_PROJECTS_FILE, []);
    } else {
      fs.writeFileSync(projectsFile, JSON.stringify([], null, 2));
    }
  }

  return { tasksFile, projectsFile, safeId };
}

// Middleware
app.use(cors());
app.use(express.json());
app.use(express.static(path.join(__dirname, 'public')));

// ----------------------------------------------------
// AUTHENTICATION MIDDLEWARE
// ----------------------------------------------------

function requireAuth(req, res, next) {
  const authHeader = req.headers['authorization'];
  const token = authHeader && authHeader.startsWith('Bearer ') ? authHeader.slice(7) : (req.query.token || req.headers['x-auth-token']);

  if (!token) {
    return res.status(401).json({ success: false, message: 'Authentication required. Please log in.' });
  }

  const sessions = readData(SESSIONS_FILE) || {};
  const session = sessions[token];

  if (!session) {
    return res.status(401).json({ success: false, message: 'Session expired or invalid. Please log in again.' });
  }

  req.user = session;
  req.userStorage = getUserStorage(session.userId);
  next();
}

// ----------------------------------------------------
// AUTH ROUTES
// ----------------------------------------------------

// POST /api/auth/register
app.post('/api/auth/register', (req, res) => {
  const { userId, name, password } = req.body;

  if (!userId || !userId.trim()) {
    return res.status(400).json({ success: false, message: 'User ID is required' });
  }
  if (!password || password.length < 4) {
    return res.status(400).json({ success: false, message: 'Password must be at least 4 characters long' });
  }

  const cleanUserId = userId.trim().toLowerCase();
  const users = readData(USERS_FILE) || [];

  const existing = users.find(u => u.userId.toLowerCase() === cleanUserId);
  if (existing) {
    return res.status(400).json({ success: false, message: 'User ID already exists. Please choose another.' });
  }

  const newUser = {
    id: 'user-' + Date.now(),
    userId: cleanUserId,
    name: name && name.trim() ? name.trim() : cleanUserId,
    passwordHash: hashPassword(password),
    createdAt: new Date().toISOString()
  };

  users.push(newUser);
  writeData(USERS_FILE, users);

  // Initialize per-user JSON files
  getUserStorage(cleanUserId);

  // Create session
  const token = crypto.randomBytes(32).toString('hex');
  const sessions = readData(SESSIONS_FILE) || {};
  sessions[token] = {
    id: newUser.id,
    userId: newUser.userId,
    name: newUser.name,
    createdAt: new Date().toISOString()
  };
  writeData(SESSIONS_FILE, sessions);

  res.status(201).json({
    success: true,
    message: 'Registration successful',
    token,
    user: { id: newUser.id, userId: newUser.userId, name: newUser.name }
  });
});

// POST /api/auth/login
app.post('/api/auth/login', (req, res) => {
  const { userId, password } = req.body;

  if (!userId || !password) {
    return res.status(400).json({ success: false, message: 'User ID and password are required' });
  }

  const cleanUserId = userId.trim().toLowerCase();
  const users = readData(USERS_FILE) || [];
  const user = users.find(u => u.userId.toLowerCase() === cleanUserId);

  if (!user || user.passwordHash !== hashPassword(password)) {
    return res.status(401).json({ success: false, message: 'Invalid User ID or password' });
  }

  // Create session
  const token = crypto.randomBytes(32).toString('hex');
  const sessions = readData(SESSIONS_FILE) || {};
  sessions[token] = {
    id: user.id,
    userId: user.userId,
    name: user.name,
    createdAt: new Date().toISOString()
  };
  writeData(SESSIONS_FILE, sessions);

  // Ensure user directory exists
  getUserStorage(cleanUserId);

  res.json({
    success: true,
    message: 'Login successful',
    token,
    user: { id: user.id, userId: user.userId, name: user.name }
  });
});

// GET /api/auth/me
app.get('/api/auth/me', requireAuth, (req, res) => {
  res.json({ success: true, user: req.user });
});

// POST /api/auth/logout
app.post('/api/auth/logout', (req, res) => {
  const authHeader = req.headers['authorization'];
  const token = authHeader && authHeader.startsWith('Bearer ') ? authHeader.slice(7) : (req.query.token || req.headers['x-auth-token']);

  if (token) {
    const sessions = readData(SESSIONS_FILE) || {};
    delete sessions[token];
    writeData(SESSIONS_FILE, sessions);
  }
  res.json({ success: true, message: 'Logged out successfully' });
});

// ----------------------------------------------------
// USER SPECIFIC PROJECT ROUTES (Protected)
// ----------------------------------------------------

// GET /api/projects
app.get('/api/projects', requireAuth, (req, res) => {
  const { projectsFile, tasksFile } = req.userStorage;
  const projects = readData(projectsFile) || [];
  const tasks = readData(tasksFile) || [];

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
app.post('/api/projects', requireAuth, (req, res) => {
  const { name, description, color } = req.body;
  if (!name || !name.trim()) {
    return res.status(400).json({ success: false, message: 'Project name is required' });
  }

  const { projectsFile } = req.userStorage;
  const projects = readData(projectsFile) || [];
  const newProject = {
    id: 'proj-' + Date.now(),
    name: name.trim(),
    description: description ? description.trim() : '',
    color: color || '#6366f1',
    createdAt: new Date().toISOString()
  };

  projects.unshift(newProject);
  writeData(projectsFile, projects);

  res.status(201).json({ success: true, data: newProject, message: 'Project created successfully' });
});

// DELETE /api/projects/:id
app.delete('/api/projects/:id', requireAuth, (req, res) => {
  const { id } = req.params;
  const { projectsFile, tasksFile } = req.userStorage;

  const projects = readData(projectsFile) || [];
  const filteredProjects = projects.filter(p => p.id !== id);

  if (projects.length === filteredProjects.length) {
    return res.status(404).json({ success: false, message: 'Project not found' });
  }

  const tasks = readData(tasksFile) || [];
  const remainingTasks = tasks.filter(t => t.projectId !== id);

  writeData(projectsFile, filteredProjects);
  writeData(tasksFile, remainingTasks);

  res.json({ success: true, message: 'Project and associated tasks deleted successfully' });
});

// ----------------------------------------------------
// USER SPECIFIC TASK ROUTES (Protected)
// ----------------------------------------------------

// GET /api/tasks
app.get('/api/tasks', requireAuth, (req, res) => {
  const { tasksFile, projectsFile } = req.userStorage;
  let tasks = readData(tasksFile) || [];
  const projects = readData(projectsFile) || [];
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

  const projectMap = new Map(projects.map(p => [p.id, p]));
  const enriched = tasks.map(t => ({
    ...t,
    project: projectMap.get(t.projectId) || { name: 'Unassigned', color: '#94a3b8' }
  }));

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
app.post('/api/tasks', requireAuth, (req, res) => {
  const { title, description, projectId, date, priority, status, hours, minutes } = req.body;

  if (!title || !title.trim()) {
    return res.status(400).json({ success: false, message: 'Task title is required' });
  }
  if (!date) {
    return res.status(400).json({ success: false, message: 'Task date is required' });
  }

  const { tasksFile, projectsFile } = req.userStorage;
  const tasks = readData(tasksFile) || [];

  const newTask = {
    id: 'task-' + Date.now(),
    title: title.trim(),
    description: description ? description.trim() : '',
    projectId: projectId || '',
    date: date,
    priority: priority || 'Medium',
    status: status || 'Pending',
    hours: Math.max(0, parseInt(hours) || 0),
    minutes: Math.max(0, Math.min(59, parseInt(minutes) || 0)),
    createdAt: new Date().toISOString()
  };

  tasks.unshift(newTask);
  writeData(tasksFile, tasks);

  const projects = readData(projectsFile) || [];
  const project = projects.find(p => p.id === newTask.projectId) || { name: 'Unassigned', color: '#94a3b8' };

  res.status(201).json({
    success: true,
    data: { ...newTask, project },
    message: 'Task added successfully'
  });
});

// PUT /api/tasks/:id
app.put('/api/tasks/:id', requireAuth, (req, res) => {
  const { id } = req.params;
  const { title, description, projectId, date, priority, status, hours, minutes } = req.body;
  const { tasksFile, projectsFile } = req.userStorage;

  const tasks = readData(tasksFile) || [];
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

  writeData(tasksFile, tasks);

  const projects = readData(projectsFile) || [];
  const project = projects.find(p => p.id === tasks[idx].projectId) || { name: 'Unassigned', color: '#94a3b8' };

  res.json({
    success: true,
    data: { ...tasks[idx], project },
    message: 'Task updated successfully'
  });
});

// PATCH /api/tasks/:id/status
app.patch('/api/tasks/:id/status', requireAuth, (req, res) => {
  const { id } = req.params;
  const { status } = req.body;

  if (!status) {
    return res.status(400).json({ success: false, message: 'Status is required' });
  }

  const { tasksFile } = req.userStorage;
  const tasks = readData(tasksFile) || [];
  const idx = tasks.findIndex(t => t.id === id);

  if (idx === -1) {
    return res.status(404).json({ success: false, message: 'Task not found' });
  }

  tasks[idx].status = status;
  tasks[idx].updatedAt = new Date().toISOString();
  writeData(tasksFile, tasks);

  res.json({ success: true, data: tasks[idx], message: `Status updated to ${status}` });
});

// DELETE /api/tasks/:id
app.delete('/api/tasks/:id', requireAuth, (req, res) => {
  const { id } = req.params;
  const { tasksFile } = req.userStorage;
  const tasks = readData(tasksFile) || [];
  const filtered = tasks.filter(t => t.id !== id);

  if (tasks.length === filtered.length) {
    return res.status(404).json({ success: false, message: 'Task not found' });
  }

  writeData(tasksFile, filtered);
  res.json({ success: true, message: 'Task deleted successfully' });
});

// ----------------------------------------------------
// USER SPECIFIC STATS ROUTE (Protected)
// ----------------------------------------------------

app.get('/api/stats', requireAuth, (req, res) => {
  const { tasksFile, projectsFile } = req.userStorage;
  const tasks = readData(tasksFile) || [];
  const projects = readData(projectsFile) || [];

  const todayStr = new Date().toISOString().split('T')[0];

  const total = tasks.length;
  const completed = tasks.filter(t => t.status === 'Completed').length;
  const inProgress = tasks.filter(t => t.status === 'In Progress').length;
  const pending = tasks.filter(t => t.status === 'Pending').length;
  const dueToday = tasks.filter(t => t.date === todayStr).length;
  const overdue = tasks.filter(t => t.date < todayStr && t.status !== 'Completed').length;

  const totalMinutesSpent = tasks.reduce((sum, t) => sum + ((parseInt(t.hours) || 0) * 60) + (parseInt(t.minutes) || 0), 0);
  const totalHoursOnly = Math.floor(totalMinutesSpent / 60);
  const remainingMinsOnly = totalMinutesSpent % 60;
  const totalTimeFormatted = totalMinutesSpent > 0 ? `${totalHoursOnly}h ${remainingMinsOnly}m` : '0h 0m';

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
// USER SPECIFIC CSV EXPORT ROUTE (Protected)
// ----------------------------------------------------

app.get('/api/export/csv', requireAuth, (req, res) => {
  const { tasksFile, projectsFile } = req.userStorage;
  const tasks = readData(tasksFile) || [];
  const projects = readData(projectsFile) || [];
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
  res.setHeader('Content-Disposition', `attachment; filename="${req.user.userId}-tasks.csv"`);
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
