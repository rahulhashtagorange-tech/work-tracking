// WorkTracker - Client Application Logic

const state = {
  tasks: [],
  projects: [],
  stats: {},
  filters: {
    projectId: '',
    dateFilter: 'all', // 'all', 'today', 'tomorrow', 'week', 'overdue', 'custom'
    customDate: '',
    status: '',
    priority: '',
    search: ''
  },
  viewMode: 'date' // 'date', 'board', 'list'
};

// DOM References
const tasksViewContainer = document.getElementById('tasksViewContainer');
const projectListContainer = document.getElementById('projectListContainer');
const taskProjectSelect = document.getElementById('taskProjectSelect');
const activeFilterBadges = document.getElementById('activeFilterBadges');
const currentViewTitle = document.getElementById('currentViewTitle');
const searchInput = document.getElementById('searchInput');
const clearSearchBtn = document.getElementById('clearSearchBtn');
const customDatePicker = document.getElementById('customDatePicker');
const resetDateFilterBtn = document.getElementById('resetDateFilterBtn');

// Modals
const taskModalOverlay = document.getElementById('taskModalOverlay');
const projectModalOverlay = document.getElementById('projectModalOverlay');
const taskForm = document.getElementById('taskForm');
const projectForm = document.getElementById('projectForm');
const taskModalTitle = document.getElementById('taskModalTitle');
const taskIdField = document.getElementById('taskIdField');
const openAddTaskModalBtn = document.getElementById('openAddTaskModalBtn');
const closeTaskModalBtn = document.getElementById('closeTaskModalBtn');
const cancelTaskModalBtn = document.getElementById('cancelTaskModalBtn');
const openAddProjectModalBtn = document.getElementById('openAddProjectModalBtn');
const closeProjectModalBtn = document.getElementById('closeProjectModalBtn');
const cancelProjectModalBtn = document.getElementById('cancelProjectModalBtn');
const exportBtn = document.getElementById('exportBtn');

// View switchers
const viewModeDate = document.getElementById('viewModeDate');
const viewModeBoard = document.getElementById('viewModeBoard');
const viewModeList = document.getElementById('viewModeList');

// Stats elements
const statTotal = document.getElementById('statTotal');
const statDueToday = document.getElementById('statDueToday');
const statInProgress = document.getElementById('statInProgress');
const statCompleted = document.getElementById('statCompleted');
const statCompletionRate = document.getElementById('statCompletionRate');
const statTotalTime = document.getElementById('statTotalTime');

// --- Initialization ---
document.addEventListener('DOMContentLoaded', () => {
  initClock();
  initColorPicker();
  setupEventListeners();
  loadData();
});

// Live Clock & Date Helper
function initClock() {
  const clockEl = document.getElementById('currentDateStr');
  function updateTime() {
    const now = new Date();
    const options = { weekday: 'short', day: 'numeric', month: 'short', year: 'numeric' };
    clockEl.textContent = now.toLocaleDateString('en-US', options);
  }
  updateTime();
  setInterval(updateTime, 60000);
}

// Fetch all initial data
async function loadData() {
  await Promise.all([fetchProjects(), fetchTasks(), fetchStats()]);
}

// ----------------------------------------------------
// API CALLS
// ----------------------------------------------------

async function fetchProjects() {
  try {
    const res = await fetch('/api/projects');
    const json = await res.json();
    if (json.success) {
      state.projects = json.data;
      renderProjects();
      populateProjectDropdown();
    }
  } catch (err) {
    showToast('Failed to load projects', 'error');
    console.error(err);
  }
}

async function fetchTasks() {
  try {
    const params = new URLSearchParams();
    if (state.filters.projectId) params.append('projectId', state.filters.projectId);
    if (state.filters.status) params.append('status', state.filters.status);
    if (state.filters.priority) params.append('priority', state.filters.priority);
    if (state.filters.search) params.append('search', state.filters.search);

    // Date filtering logic
    const today = getTodayStr();
    if (state.filters.dateFilter === 'today') {
      params.append('date', today);
    } else if (state.filters.dateFilter === 'tomorrow') {
      params.append('date', getTomorrowStr());
    } else if (state.filters.dateFilter === 'week') {
      params.append('startDate', today);
      params.append('endDate', getDatePlusDays(7));
    } else if (state.filters.dateFilter === 'custom' && state.filters.customDate) {
      params.append('date', state.filters.customDate);
    }

    const res = await fetch(`/api/tasks?${params.toString()}`);
    const json = await res.json();
    if (json.success) {
      let tasks = json.data;

      // Handle overdue client side filter if needed
      if (state.filters.dateFilter === 'overdue') {
        tasks = tasks.filter(t => t.date < today && t.status !== 'Completed');
      }

      state.tasks = tasks;
      renderTasks();
      renderActiveFilterBadges();
    }
  } catch (err) {
    showToast('Failed to load tasks', 'error');
    console.error(err);
  }
}

async function fetchStats() {
  try {
    const res = await fetch('/api/stats');
    const json = await res.json();
    if (json.success) {
      state.stats = json.data;
      renderStats();
    }
  } catch (err) {
    console.error(err);
  }
}

// ----------------------------------------------------
// RENDERING FUNCTIONS
// ----------------------------------------------------

function renderStats() {
  const { total = 0, dueToday = 0, inProgress = 0, completed = 0, completionRate = 0, totalTimeFormatted = '0h 0m' } = state.stats;
  statTotal.textContent = total;
  statDueToday.textContent = dueToday;
  statInProgress.textContent = inProgress;
  statCompleted.textContent = completed;
  statCompletionRate.textContent = `${completionRate}% completed`;
  if (statTotalTime) statTotalTime.textContent = totalTimeFormatted;
}

function renderProjects() {
  projectListContainer.innerHTML = '';

  // All Projects Item
  const totalCount = state.projects.reduce((acc, p) => acc + (p.taskCount || 0), 0);
  const allItem = document.createElement('div');
  allItem.className = `project-item ${state.filters.projectId === '' ? 'active' : ''}`;
  allItem.innerHTML = `
    <div class="project-item-left">
      <span class="project-color-dot" style="background: #94a3b8;"></span>
      <span class="project-name">All Projects</span>
    </div>
    <div class="project-item-right">
      <span class="project-count">${totalCount}</span>
    </div>
  `;
  allItem.addEventListener('click', () => {
    state.filters.projectId = '';
    renderProjects();
    fetchTasks();
  });
  projectListContainer.appendChild(allItem);

  // Individual Projects
  state.projects.forEach(project => {
    const item = document.createElement('div');
    item.className = `project-item ${state.filters.projectId === project.id ? 'active' : ''}`;
    item.innerHTML = `
      <div class="project-item-left">
        <span class="project-color-dot" style="background: ${project.color || '#6366f1'};"></span>
        <span class="project-name" title="${escapeHtml(project.name)}">${escapeHtml(project.name)}</span>
      </div>
      <div class="project-item-right">
        <span class="project-count">${project.taskCount || 0}</span>
        <button class="project-delete-btn" title="Delete Project" data-id="${project.id}">
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
            <line x1="18" y1="6" x2="6" y2="18"></line>
            <line x1="6" y1="6" x2="18" y2="18"></line>
          </svg>
        </button>
      </div>
    `;

    item.addEventListener('click', (e) => {
      if (e.target.closest('.project-delete-btn')) {
        e.stopPropagation();
        confirmDeleteProject(project.id, project.name);
        return;
      }
      state.filters.projectId = project.id;
      renderProjects();
      fetchTasks();
    });

    projectListContainer.appendChild(item);
  });
}

function populateProjectDropdown() {
  taskProjectSelect.innerHTML = `<option value="">General (No Project)</option>`;
  state.projects.forEach(p => {
    const opt = document.createElement('option');
    opt.value = p.id;
    opt.textContent = p.name;
    taskProjectSelect.appendChild(opt);
  });
}

function renderActiveFilterBadges() {
  activeFilterBadges.innerHTML = '';

  // Project badge
  if (state.filters.projectId) {
    const proj = state.projects.find(p => p.id === state.filters.projectId);
    if (proj) {
      createActiveBadge(`Project: ${proj.name}`, () => {
        state.filters.projectId = '';
        renderProjects();
        fetchTasks();
      });
    }
  }

  // Date badge
  if (state.filters.dateFilter !== 'all') {
    let label = `Date: ${state.filters.dateFilter.toUpperCase()}`;
    if (state.filters.dateFilter === 'custom' && state.filters.customDate) {
      label = `Date: ${state.filters.customDate}`;
    }
    createActiveBadge(label, () => {
      resetDateFilter();
    });
  }

  // Status badge
  if (state.filters.status) {
    createActiveBadge(`Status: ${state.filters.status}`, () => {
      state.filters.status = '';
      updateStatusTabUI();
      fetchTasks();
    });
  }

  // Priority badge
  if (state.filters.priority) {
    createActiveBadge(`Priority: ${state.filters.priority}`, () => {
      state.filters.priority = '';
      updatePriorityChipUI();
      fetchTasks();
    });
  }

  // Search badge
  if (state.filters.search) {
    createActiveBadge(`Search: "${state.filters.search}"`, () => {
      state.filters.search = '';
      searchInput.value = '';
      clearSearchBtn.style.display = 'none';
      fetchTasks();
    });
  }

  // Update Section Title
  let title = 'Date-wise Timeline';
  if (state.viewMode === 'board') title = 'Kanban Task Board';
  if (state.viewMode === 'list') title = 'Tasks Directory';
  if (state.filters.projectId) {
    const proj = state.projects.find(p => p.id === state.filters.projectId);
    if (proj) title = `${proj.name} — ${title}`;
  }
  currentViewTitle.textContent = `${title} (${state.tasks.length})`;
}

function createActiveBadge(text, onRemove) {
  const badge = document.createElement('span');
  badge.className = 'active-pill';
  badge.innerHTML = `${escapeHtml(text)} <span style="cursor:pointer; font-weight:bold; margin-left:4px;">&times;</span>`;
  badge.addEventListener('click', onRemove);
  activeFilterBadges.appendChild(badge);
}

// ----------------------------------------------------
// TASKS RENDERING ROUTER
// ----------------------------------------------------

function renderTasks() {
  tasksViewContainer.innerHTML = '';

  if (state.tasks.length === 0) {
    renderEmptyState();
    return;
  }

  if (state.viewMode === 'date') {
    renderDateGroupedView();
  } else if (state.viewMode === 'board') {
    renderBoardView();
  } else if (state.viewMode === 'list') {
    renderListView();
  }
}

function renderEmptyState() {
  tasksViewContainer.innerHTML = `
    <div class="empty-state">
      <div class="empty-state-icon">
        <svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
          <circle cx="12" cy="12" r="10"></circle>
          <line x1="12" y1="8" x2="12" y2="12"></line>
          <line x1="12" y1="16" x2="12.01" y2="16"></line>
        </svg>
      </div>
      <h3>No tasks found</h3>
      <p>There are no tasks matching your selected date or project filters. Create a new task to get started!</p>
      <button class="btn btn-primary" onclick="openAddTaskModal()">
        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round">
          <line x1="12" y1="5" x2="12" y2="19"></line>
          <line x1="5" y1="12" x2="19" y2="12"></line>
        </svg>
        Add New Task
      </button>
    </div>
  `;
}

// 1. DATE-WISE GROUPED VIEW
function renderDateGroupedView() {
  const today = getTodayStr();
  const tomorrow = getTomorrowStr();

  // Group tasks by date string
  const grouped = {};
  state.tasks.forEach(task => {
    const d = task.date || 'No Date';
    if (!grouped[d]) grouped[d] = [];
    grouped[d].push(task);
  });

  // Sort dates
  const sortedDates = Object.keys(grouped).sort();

  sortedDates.forEach(dateStr => {
    const tasksForDate = grouped[dateStr];
    const groupEl = document.createElement('div');
    groupEl.className = 'date-group';

    // Format human-readable date & status badge
    let dateLabel = dateStr;
    let tagHtml = '';

    if (dateStr !== 'No Date') {
      const dObj = new Date(dateStr + 'T00:00:00');
      dateLabel = dObj.toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric', year: 'numeric' });

      if (dateStr === today) {
        tagHtml = '<span class="date-relative-tag tag-today">Today</span>';
      } else if (dateStr === tomorrow) {
        tagHtml = '<span class="date-relative-tag tag-tomorrow">Tomorrow</span>';
      } else if (dateStr < today) {
        const hasUncompleted = tasksForDate.some(t => t.status !== 'Completed');
        if (hasUncompleted) {
          tagHtml = '<span class="date-relative-tag tag-overdue">Overdue</span>';
        } else {
          tagHtml = '<span class="date-relative-tag tag-future">Past</span>';
        }
      } else {
        tagHtml = '<span class="date-relative-tag tag-future">Upcoming</span>';
      }
    }

    groupEl.innerHTML = `
      <div class="date-group-header">
        <div class="date-group-title-wrap">
          <span class="date-group-title">${dateLabel}</span>
          ${tagHtml}
        </div>
        <span class="date-group-count">${tasksForDate.length} ${tasksForDate.length === 1 ? 'task' : 'tasks'}</span>
      </div>
      <div class="date-group-tasks" id="date-group-${dateStr}"></div>
    `;

    const tasksContainer = groupEl.querySelector(`#date-group-${CSS.escape(dateStr)}`);
    tasksForDate.forEach(task => {
      tasksContainer.appendChild(createTaskCard(task));
    });

    tasksViewContainer.appendChild(groupEl);
  });
}

// 2. KANBAN BOARD VIEW
function renderBoardView() {
  const columns = [
    { id: 'Pending', title: 'Pending', bulletClass: 'pending' },
    { id: 'In Progress', title: 'In Progress', bulletClass: 'progress' },
    { id: 'Completed', title: 'Completed', bulletClass: 'completed' }
  ];

  const grid = document.createElement('div');
  grid.className = 'board-grid';

  columns.forEach(col => {
    const colTasks = state.tasks.filter(t => t.status === col.id);
    const colEl = document.createElement('div');
    colEl.className = 'board-col';
    colEl.innerHTML = `
      <div class="board-col-header">
        <div class="board-col-title">
          <span class="status-bullet ${col.bulletClass}"></span>
          <span>${col.title}</span>
        </div>
        <span class="board-col-count">${colTasks.length}</span>
      </div>
      <div class="board-cards-wrap" id="board-col-${col.id}"></div>
    `;

    const cardsWrap = colEl.querySelector('.board-cards-wrap');
    if (colTasks.length === 0) {
      cardsWrap.innerHTML = `<div style="font-size: 0.8rem; color: var(--text-dim); text-align: center; padding: 20px 0;">No tasks here</div>`;
    } else {
      colTasks.forEach(task => {
        cardsWrap.appendChild(createTaskCard(task, true));
      });
    }

    grid.appendChild(colEl);
  });

  tasksViewContainer.appendChild(grid);
}

// 3. COMPACT LIST VIEW
function renderListView() {
  const table = document.createElement('table');
  table.className = 'list-view-table';
  table.innerHTML = `
    <thead>
      <tr>
        <th style="width: 36px;">Done</th>
        <th>Task Title</th>
        <th>Project</th>
        <th>Date</th>
        <th>Time Taken</th>
        <th>Priority</th>
        <th>Status</th>
        <th style="text-align: right;">Actions</th>
      </tr>
    </thead>
    <tbody></tbody>
  `;

  const tbody = table.querySelector('tbody');

  state.tasks.forEach(task => {
    const tr = document.createElement('tr');
    const isCompleted = task.status === 'Completed';

    tr.innerHTML = `
      <td>
        <div class="custom-checkbox ${isCompleted ? 'checked' : ''}" data-id="${task.id}">
          ${isCompleted ? '✓' : ''}
        </div>
      </td>
      <td style="font-weight: 600; ${isCompleted ? 'text-decoration: line-through; color: var(--text-muted);' : ''}">
        ${escapeHtml(task.title)}
      </td>
      <td>
        <span class="badge-project" style="background: ${task.project?.color || '#6366f1'};">
          ${escapeHtml(task.project?.name || 'Unassigned')}
        </span>
      </td>
      <td style="font-size: 0.82rem; color: var(--text-muted);">${task.date}</td>
      <td style="font-size: 0.82rem; font-weight: 600; color: #60a5fa;">
        ${formatTaskTime(task.hours, task.minutes) || '-'}
      </td>
      <td>
        <span class="badge-priority priority-${task.priority}">${task.priority}</span>
      </td>
      <td>
        <select class="status-dropdown-select status-${task.status.replace(/\s+/g, '-')}" data-id="${task.id}">
          <option value="Pending" ${task.status === 'Pending' ? 'selected' : ''}>Pending</option>
          <option value="In Progress" ${task.status === 'In Progress' ? 'selected' : ''}>In Progress</option>
          <option value="Completed" ${task.status === 'Completed' ? 'selected' : ''}>Completed</option>
        </select>
      </td>
      <td style="text-align: right;">
        <div style="display: inline-flex; gap: 4px;">
          <button class="action-btn edit-task-btn" title="Edit task" data-id="${task.id}">
            <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
              <path d="M12 20h9"></path>
              <path d="M16.5 3.5a2.121 2.121 0 0 1 3 3L7 19l-4 1 1-4L16.5 3.5z"></path>
            </svg>
          </button>
          <button class="action-btn delete-btn delete-task-btn" title="Delete task" data-id="${task.id}">
            <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
              <polyline points="3 6 5 6 21 6"></polyline>
              <path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"></path>
            </svg>
          </button>
        </div>
      </td>
    `;

    // Event listeners
    tr.querySelector('.custom-checkbox').addEventListener('click', () => toggleTaskCompletion(task));
    tr.querySelector('.status-dropdown-select').addEventListener('change', (e) => updateTaskStatus(task.id, e.target.value));
    tr.querySelector('.edit-task-btn').addEventListener('click', () => openEditTaskModal(task));
    tr.querySelector('.delete-task-btn').addEventListener('click', () => confirmDeleteTask(task.id));

    tbody.appendChild(tr);
  });

  tasksViewContainer.appendChild(table);
}

// Helper: Create Task Card Component
function createTaskCard(task, compact = false) {
  const card = document.createElement('div');
  const isCompleted = task.status === 'Completed';
  card.className = `task-card ${isCompleted ? 'task-completed' : ''}`;
  card.id = `task-card-${task.id}`;

  const projColor = task.project?.color || '#6366f1';
  const projName = task.project?.name || 'Unassigned';

  card.innerHTML = `
    <div class="task-card-top">
      <div class="task-badges">
        <span class="badge-project" style="background: ${projColor};">
          <span style="width: 6px; height: 6px; border-radius: 50%; background: #fff;"></span>
          ${escapeHtml(projName)}
        </span>
        <span class="badge-priority priority-${task.priority}">
          ${task.priority === 'High' ? '🔴' : task.priority === 'Medium' ? '🟡' : '🟢'} ${task.priority}
        </span>
        ${formatTaskTime(task.hours, task.minutes) ? `<span class="badge-time">⏱️ ${formatTaskTime(task.hours, task.minutes)}</span>` : ''}
      </div>
      <div class="task-actions">
        <button class="action-btn edit-task-btn" title="Edit Task" data-id="${task.id}">
          <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
            <path d="M12 20h9"></path>
            <path d="M16.5 3.5a2.121 2.121 0 0 1 3 3L7 19l-4 1 1-4L16.5 3.5z"></path>
          </svg>
        </button>
        <button class="action-btn delete-btn delete-task-btn" title="Delete Task" data-id="${task.id}">
          <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
            <polyline points="3 6 5 6 21 6"></polyline>
            <path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"></path>
          </svg>
        </button>
      </div>
    </div>

    <div class="task-body">
      <div class="custom-checkbox ${isCompleted ? 'checked' : ''}" title="Mark completed">
        ${isCompleted ? '✓' : ''}
      </div>
      <div class="task-content">
        <h4 class="task-title">${escapeHtml(task.title)}</h4>
        ${task.description ? `<p class="task-desc">${escapeHtml(task.description)}</p>` : ''}
      </div>
    </div>

    <div class="task-footer">
      <div class="task-date-info">
        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
          <rect x="3" y="4" width="18" height="18" rx="2" ry="2"></rect>
          <line x1="16" y1="2" x2="16" y2="6"></line>
          <line x1="8" y1="2" x2="8" y2="6"></line>
          <line x1="3" y1="10" x2="21" y2="10"></line>
        </svg>
        <span>${formatDateReadable(task.date)}</span>
      </div>

      <select class="status-dropdown-select status-${task.status.replace(/\s+/g, '-')}" data-id="${task.id}">
        <option value="Pending" ${task.status === 'Pending' ? 'selected' : ''}>Pending</option>
        <option value="In Progress" ${task.status === 'In Progress' ? 'selected' : ''}>In Progress</option>
        <option value="Completed" ${task.status === 'Completed' ? 'selected' : ''}>Completed</option>
      </select>
    </div>
  `;

  // Hook event handlers
  card.querySelector('.custom-checkbox').addEventListener('click', () => toggleTaskCompletion(task));
  card.querySelector('.status-dropdown-select').addEventListener('change', (e) => updateTaskStatus(task.id, e.target.value));
  card.querySelector('.edit-task-btn').addEventListener('click', () => openEditTaskModal(task));
  card.querySelector('.delete-task-btn').addEventListener('click', () => confirmDeleteTask(task.id));

  return card;
}

// ----------------------------------------------------
// TASK ACTIONS
// ----------------------------------------------------

async function toggleTaskCompletion(task) {
  const newStatus = task.status === 'Completed' ? 'Pending' : 'Completed';
  await updateTaskStatus(task.id, newStatus);
}

async function updateTaskStatus(taskId, newStatus) {
  try {
    const res = await fetch(`/api/tasks/${taskId}/status`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ status: newStatus })
    });
    const json = await res.json();
    if (json.success) {
      showToast(`Status updated to ${newStatus}`, 'info');
      // Update in memory and re-render
      const t = state.tasks.find(x => x.id === taskId);
      if (t) t.status = newStatus;
      renderTasks();
      fetchProjects();
      fetchStats();
    } else {
      showToast(json.message || 'Error updating status', 'error');
    }
  } catch (err) {
    showToast('Failed to update status', 'error');
    console.error(err);
  }
}

async function confirmDeleteTask(taskId) {
  if (!confirm('Are you sure you want to delete this task?')) return;
  try {
    const res = await fetch(`/api/tasks/${taskId}`, { method: 'DELETE' });
    const json = await res.json();
    if (json.success) {
      showToast('Task deleted', 'info');
      state.tasks = state.tasks.filter(t => t.id !== taskId);
      renderTasks();
      fetchProjects();
      fetchStats();
    } else {
      showToast(json.message || 'Error deleting task', 'error');
    }
  } catch (err) {
    showToast('Failed to delete task', 'error');
    console.error(err);
  }
}

async function confirmDeleteProject(projectId, projectName) {
  if (!confirm(`Delete project "${projectName}" and all its tasks? This action cannot be undone.`)) return;
  try {
    const res = await fetch(`/api/projects/${projectId}`, { method: 'DELETE' });
    const json = await res.json();
    if (json.success) {
      showToast(`Project "${projectName}" deleted`, 'info');
      if (state.filters.projectId === projectId) {
        state.filters.projectId = '';
      }
      await loadData();
    } else {
      showToast(json.message || 'Error deleting project', 'error');
    }
  } catch (err) {
    showToast('Failed to delete project', 'error');
    console.error(err);
  }
}

// ----------------------------------------------------
// MODALS LOGIC
// ----------------------------------------------------

window.openAddTaskModal = function() {
  taskModalTitle.textContent = 'Add New Task';
  taskIdField.value = '';
  taskForm.reset();

  // Pre-fill defaults
  document.getElementById('taskDateField').value = getTodayStr();
  document.getElementById('taskHoursInput').value = '0';
  document.getElementById('taskMinutesInput').value = '0';
  if (state.filters.projectId) {
    taskProjectSelect.value = state.filters.projectId;
  }
  taskModalOverlay.classList.add('active');
  document.getElementById('taskTitleInput').focus();
};

function openEditTaskModal(task) {
  taskModalTitle.textContent = 'Edit Task';
  taskIdField.value = task.id;
  document.getElementById('taskTitleInput').value = task.title;
  document.getElementById('taskDescriptionInput').value = task.description || '';
  taskProjectSelect.value = task.projectId || '';
  document.getElementById('taskDateField').value = task.date;
  document.getElementById('taskPrioritySelect').value = task.priority;
  document.getElementById('taskStatusSelect').value = task.status;
  document.getElementById('taskHoursInput').value = task.hours || 0;
  document.getElementById('taskMinutesInput').value = task.minutes || 0;

  taskModalOverlay.classList.add('active');
  document.getElementById('taskTitleInput').focus();
}

function closeTaskModal() {
  taskModalOverlay.classList.remove('active');
}

function openAddProjectModal() {
  projectForm.reset();
  projectModalOverlay.classList.add('active');
  document.getElementById('projectNameInput').focus();
}

function closeProjectModal() {
  projectModalOverlay.classList.remove('active');
}

// Helper: Set task form date
window.setTaskFormDate = function(preset) {
  const dateInput = document.getElementById('taskDateField');
  if (preset === 'today') {
    dateInput.value = getTodayStr();
  } else if (preset === 'tomorrow') {
    dateInput.value = getTomorrowStr();
  } else if (preset === 'nextWeek') {
    dateInput.value = getDatePlusDays(7);
  }
};

// Helper: Set task form time preset
window.setTaskFormTime = function(h, m) {
  document.getElementById('taskHoursInput').value = h;
  document.getElementById('taskMinutesInput').value = m;
};

// Color Picker Selection in Project Modal
function initColorPicker() {
  const picker = document.getElementById('colorPalettePicker');
  const hiddenInput = document.getElementById('projectColorInput');
  picker.querySelectorAll('.color-option').forEach(opt => {
    opt.addEventListener('click', () => {
      picker.querySelectorAll('.color-option').forEach(o => o.classList.remove('selected'));
      opt.classList.add('selected');
      hiddenInput.value = opt.getAttribute('data-color');
    });
  });
}

// ----------------------------------------------------
// EVENT LISTENERS SETUP
// ----------------------------------------------------

function setupEventListeners() {
  // Modal Buttons
  openAddTaskModalBtn.addEventListener('click', openAddTaskModal);
  closeTaskModalBtn.addEventListener('click', closeTaskModal);
  cancelTaskModalBtn.addEventListener('click', closeTaskModal);

  openAddProjectModalBtn.addEventListener('click', openAddProjectModal);
  closeProjectModalBtn.addEventListener('click', closeProjectModal);
  cancelProjectModalBtn.addEventListener('click', closeProjectModal);

  const taskModalNewProjLink = document.getElementById('taskModalNewProjLink');
  if (taskModalNewProjLink) {
    taskModalNewProjLink.addEventListener('click', () => {
      openAddProjectModal();
    });
  }

  // Close modals on outside click or ESC
  [taskModalOverlay, projectModalOverlay].forEach(overlay => {
    overlay.addEventListener('click', (e) => {
      if (e.target === overlay) {
        overlay.classList.remove('active');
      }
    });
  });

  window.addEventListener('keydown', (e) => {
    if (e.key === 'Escape') {
      closeTaskModal();
      closeProjectModal();
    }
  });

  // Task Form Submit
  taskForm.addEventListener('submit', async (e) => {
    e.preventDefault();
    const id = taskIdField.value;
    const taskPayload = {
      title: document.getElementById('taskTitleInput').value.trim(),
      description: document.getElementById('taskDescriptionInput').value.trim(),
      projectId: taskProjectSelect.value,
      date: document.getElementById('taskDateField').value,
      priority: document.getElementById('taskPrioritySelect').value,
      status: document.getElementById('taskStatusSelect').value,
      hours: parseInt(document.getElementById('taskHoursInput').value) || 0,
      minutes: parseInt(document.getElementById('taskMinutesInput').value) || 0
    };

    try {
      const url = id ? `/api/tasks/${id}` : '/api/tasks';
      const method = id ? 'PUT' : 'POST';

      const res = await fetch(url, {
        method,
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(taskPayload)
      });
      const json = await res.json();

      if (json.success) {
        showToast(id ? 'Task updated successfully' : 'Task created successfully', 'success');
        closeTaskModal();
        await loadData();
      } else {
        showToast(json.message || 'Error saving task', 'error');
      }
    } catch (err) {
      showToast('Failed to save task', 'error');
      console.error(err);
    }
  });

  // Project Form Submit
  projectForm.addEventListener('submit', async (e) => {
    e.preventDefault();
    const projectPayload = {
      name: document.getElementById('projectNameInput').value.trim(),
      description: document.getElementById('projectDescriptionInput').value.trim(),
      color: document.getElementById('projectColorInput').value
    };

    try {
      const res = await fetch('/api/projects', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(projectPayload)
      });
      const json = await res.json();

      if (json.success) {
        showToast('Project created successfully', 'success');
        closeProjectModal();
        await fetchProjects();
      } else {
        showToast(json.message || 'Error creating project', 'error');
      }
    } catch (err) {
      showToast('Failed to create project', 'error');
      console.error(err);
    }
  });

  // Search Input with Debounce
  let searchTimeout = null;
  searchInput.addEventListener('input', (e) => {
    const query = e.target.value.trim();
    clearSearchBtn.style.display = query ? 'block' : 'none';
    clearTimeout(searchTimeout);
    searchTimeout = setTimeout(() => {
      state.filters.search = query;
      fetchTasks();
    }, 250);
  });

  clearSearchBtn.addEventListener('click', () => {
    searchInput.value = '';
    clearSearchBtn.style.display = 'none';
    state.filters.search = '';
    fetchTasks();
  });

  // Date Quick Filters
  document.querySelectorAll('[data-date-filter]').forEach(btn => {
    btn.addEventListener('click', () => {
      document.querySelectorAll('[data-date-filter]').forEach(b => b.classList.remove('active'));
      btn.classList.add('active');
      state.filters.dateFilter = btn.getAttribute('data-date-filter');
      customDatePicker.value = '';
      state.filters.customDate = '';
      fetchTasks();
    });
  });

  // Custom Date Picker
  customDatePicker.addEventListener('change', (e) => {
    const val = e.target.value;
    if (val) {
      document.querySelectorAll('[data-date-filter]').forEach(b => b.classList.remove('active'));
      state.filters.dateFilter = 'custom';
      state.filters.customDate = val;
      fetchTasks();
    }
  });

  resetDateFilterBtn.addEventListener('click', resetDateFilter);

  // Status Filter Tabs
  document.querySelectorAll('[data-status-filter]').forEach(tab => {
    tab.addEventListener('click', () => {
      state.filters.status = tab.getAttribute('data-status-filter');
      updateStatusTabUI();
      fetchTasks();
    });
  });

  // Priority Chips
  document.querySelectorAll('[data-priority-filter]').forEach(chip => {
    chip.addEventListener('click', () => {
      state.filters.priority = chip.getAttribute('data-priority-filter');
      updatePriorityChipUI();
      fetchTasks();
    });
  });

  // View Switchers
  viewModeDate.addEventListener('click', () => setViewMode('date'));
  viewModeBoard.addEventListener('click', () => setViewMode('board'));
  viewModeList.addEventListener('click', () => setViewMode('list'));

  // Export CSV
  exportBtn.addEventListener('click', () => {
    window.location.href = '/api/export/csv';
  });

  // Stat Card click shortcuts
  document.querySelectorAll('.stat-card').forEach(card => {
    card.addEventListener('click', () => {
      const filter = card.getAttribute('data-filter');
      if (filter === 'all') {
        state.filters.dateFilter = 'all';
        state.filters.status = '';
      } else if (filter === 'today') {
        state.filters.dateFilter = 'today';
      } else if (filter === 'in_progress') {
        state.filters.status = 'In Progress';
      } else if (filter === 'completed') {
        state.filters.status = 'Completed';
      }
      syncFilterUIs();
      fetchTasks();
    });
  });
}

// ----------------------------------------------------
// UI HELPERS
// ----------------------------------------------------

function setViewMode(mode) {
  state.viewMode = mode;
  [viewModeDate, viewModeBoard, viewModeList].forEach(b => b.classList.remove('active'));
  if (mode === 'date') viewModeDate.classList.add('active');
  if (mode === 'board') viewModeBoard.classList.add('active');
  if (mode === 'list') viewModeList.classList.add('active');
  renderTasks();
  renderActiveFilterBadges();
}

function resetDateFilter() {
  state.filters.dateFilter = 'all';
  state.filters.customDate = '';
  customDatePicker.value = '';
  document.querySelectorAll('[data-date-filter]').forEach(b => {
    b.classList.toggle('active', b.getAttribute('data-date-filter') === 'all');
  });
  fetchTasks();
}

function updateStatusTabUI() {
  document.querySelectorAll('[data-status-filter]').forEach(tab => {
    tab.classList.toggle('active', tab.getAttribute('data-status-filter') === state.filters.status);
  });
}

function updatePriorityChipUI() {
  document.querySelectorAll('[data-priority-filter]').forEach(chip => {
    chip.classList.toggle('active', chip.getAttribute('data-priority-filter') === state.filters.priority);
  });
}

function syncFilterUIs() {
  document.querySelectorAll('[data-date-filter]').forEach(b => {
    b.classList.toggle('active', b.getAttribute('data-date-filter') === state.filters.dateFilter);
  });
  updateStatusTabUI();
  updatePriorityChipUI();
}

// Toast Notifications
function showToast(message, type = 'info') {
  const container = document.getElementById('toastContainer');
  const toast = document.createElement('div');
  toast.className = `toast toast-${type}`;
  toast.innerHTML = `
    <span>${type === 'success' ? '✓' : type === 'error' ? '✕' : 'ℹ'}</span>
    <span>${escapeHtml(message)}</span>
  `;
  container.appendChild(toast);

  setTimeout(() => {
    toast.style.opacity = '0';
    toast.style.transform = 'translateX(100%)';
    toast.style.transition = 'all 0.3s ease';
    setTimeout(() => toast.remove(), 300);
  }, 3000);
}

// ----------------------------------------------------
// DATE & STRING UTILITIES
// ----------------------------------------------------

function getTodayStr() {
  const d = new Date();
  return d.toISOString().split('T')[0];
}

function getTomorrowStr() {
  const d = new Date();
  d.setDate(d.getDate() + 1);
  return d.toISOString().split('T')[0];
}

function getDatePlusDays(days) {
  const d = new Date();
  d.setDate(d.getDate() + days);
  return d.toISOString().split('T')[0];
}

function formatDateReadable(dateStr) {
  if (!dateStr) return '';
  const [y, m, d] = dateStr.split('-');
  if (!y || !m || !d) return dateStr;
  const dateObj = new Date(y, m - 1, d);
  return dateObj.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
}

function formatTaskTime(hours, minutes) {
  const h = parseInt(hours) || 0;
  const m = parseInt(minutes) || 0;
  if (h === 0 && m === 0) return '';
  if (h > 0 && m > 0) return `${h}h ${m}m`;
  if (h > 0) return `${h}h`;
  return `${m}m`;
}

function escapeHtml(str) {
  if (!str) return '';
  return str
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#039;');
}
