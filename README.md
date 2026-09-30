# WorkTracker 🚀

A modern, full-stack **Date-wise & Project-wise Task Tracking** web application built with **HTML5, CSS3, Vanilla JavaScript, and Node.js / Express**.

---

## ✨ Features

- 📅 **Date-Wise Task Tracking**:
  - Automatically groups tasks by target date (Today, Tomorrow, Overdue, Upcoming, or specific date).
  - Quick date filter pills (`Today`, `Tomorrow`, `This Week`, `Overdue`, `All`).
  - Custom date picker to focus on any specific day.
  - Quick-date helper buttons (`Today`, `Tomorrow`, `+7 Days`) when adding or editing tasks.

- 📁 **Project-Wise Organization**:
  - Categorize tasks by project (e.g. Website Redesign, Mobile App, Marketing, Operations).
  - Custom color coding for each project.
  - Project task counter pills and fast one-click project filtering.
  - Modal to create custom projects with palette selection.

- 📊 **Dynamic Dashboard Metrics**:
  - Real-time counters: **Total Tasks**, **Due Today**, **In Progress**, **Completed**, and **Completion Rate %**.
  - Interactive stat cards: Click any stat card to quickly filter the workspace.

- 🎯 **3 Multiple View Modes**:
  1. **Date-wise View**: Grouped timeline organized by calendar dates with relative urgency tags.
  2. **Kanban Board**: Drag/status columns (`Pending`, `In Progress`, `Completed`).
  3. **Compact List**: Clean, rapid data table with inline status changers and checkboxes.

- ⚡ **Full CRUD & Micro-Interactions**:
  - Create, read, update, and delete tasks & projects.
  - Quick 1-click status checkbox toggle and instant status dropdowns.
  - Instant live keyword search with debouncing.
  - One-click **Export to CSV**.
  - Toast notifications and keyboard shortcuts (`Esc` to dismiss modals).

---

## 🛠️ Tech Stack

- **Frontend**: HTML5, Vanilla CSS3 (modern glassmorphism, responsive grid & flexbox, glowing accents, Google Fonts *Plus Jakarta Sans*), Modern JavaScript (ES6+ async/await & Fetch API).
- **Backend**: Node.js & Express.
- **Data Persistence**: JSON-based file storage (`data/tasks.json` and `data/projects.json`). Zero external database configuration required.

---

## 🚀 Getting Started

### 1. Install Dependencies
```bash
npm install
```

### 2. Start the Server
```bash
npm start
```
Or run with auto-reload:
```bash
npm run dev
```

### 3. Open in Browser
Navigate to:
```
http://localhost:3000
```

---

## 🔌 REST API Endpoints

| Method | Endpoint | Description |
|---|---|---|
| `GET` | `/api/tasks` | Get filtered tasks (`projectId`, `date`, `startDate`, `endDate`, `status`, `priority`, `search`) |
| `POST` | `/api/tasks` | Create a new task |
| `GET` | `/api/tasks/:id` | Get task by ID |
| `PUT` | `/api/tasks/:id` | Update task details |
| `PATCH` | `/api/tasks/:id/status` | Update task status |
| `DELETE` | `/api/tasks/:id` | Delete a task |
| `GET` | `/api/projects` | List all projects with computed task counts & progress |
| `POST` | `/api/projects` | Create a new project |
| `DELETE` | `/api/projects/:id` | Delete project and its tasks |
| `GET` | `/api/stats` | Summary statistics for dashboard |
| `GET` | `/api/export/csv` | Download tasks in CSV format |
