import React, { useState, useEffect } from 'react';
import { Calendar, Clock, Plus, Check, Trash2, Edit3, X, Repeat, Wifi, WifiOff, Bell, BellOff } from 'lucide-react';
import './todo-calendar.css';
import useNotifications from '../hooks/useNotifications';
// MongoDB API functions
const API_BASE = process.env.REACT_APP_BACKEND_URL || 'http://localhost:3001/api';
console.log('API_BASE:', API_BASE);

// Helper function to get auth headers
const getAuthHeaders = () => {
  const token = localStorage.getItem('todoapp_token');
  return {
    'Content-Type': 'application/json',
    'Authorization': token ? `Bearer ${token}` : '',
  };
};

const api = {
  // Get all tasks
  getTasks: async () => {
    try {
      const response = await fetch(`${API_BASE}/tasks`, {
        headers: getAuthHeaders(),
      });
      if (!response.ok) {
        if (response.status === 403) {
          console.error('Unauthorized: Token expired or invalid');
          // Clear auth data and redirect to login
          localStorage.removeItem('todoapp_token');
          localStorage.removeItem('todoapp_user');
          window.location.reload();
          return { error: 'Unauthorized' };
        }
        throw new Error('Failed to fetch tasks');
      }
      return await response.json();
    } catch (error) {
      console.error('Error fetching tasks:', error);
      return {};
    }
  },

  // Save task
  saveTask: async (dateKey, task) => {
    try {
      const response = await fetch(`${API_BASE}/tasks`, {
        method: 'POST',
        headers: getAuthHeaders(),
        body: JSON.stringify({ dateKey, task }),
      });
      if (!response.ok) throw new Error('Failed to save task');
      return await response.json();
    } catch (error) {
      console.error('Error saving task:', error);
      throw error;
    }
  },

  // Update task
  updateTask: async (dateKey, taskIndex, task) => {
    try {
      const response = await fetch(`${API_BASE}/tasks`, {
        method: 'PUT',
        headers: getAuthHeaders(),
        body: JSON.stringify({ dateKey, taskIndex, task }),
      });
      if (!response.ok) throw new Error('Failed to update task');
      return await response.json();
    } catch (error) {
      console.error('Error updating task:', error);
      throw error;
    }
  },

  // Delete task
  deleteTask: async (dateKey, taskIndex) => {
    try {
      const response = await fetch(`${API_BASE}/tasks`, {
        method: 'DELETE',
        headers: getAuthHeaders(),
        body: JSON.stringify({ dateKey, taskIndex }),
      });
      if (!response.ok) throw new Error('Failed to delete task');
      return await response.json();
    } catch (error) {
      console.error('Error deleting task:', error);
      throw error;
    }
  },

  // Update task completion
  updateTaskCompletion: async (completions) => {
    try {
      const response = await fetch(`${API_BASE}/completions`, {
        method: 'POST',
        headers: getAuthHeaders(),
        body: JSON.stringify({ completions }),
      });
      if (!response.ok) throw new Error('Failed to update completion');
      return await response.json();
    } catch (error) {
      console.error('Error updating completion:', error);
      throw error;
    }
  }
};

const TodoCalendarApp = () => {
  const [currentDate, setCurrentDate] = useState(new Date());
  const [selectedDate, setSelectedDate] = useState(new Date());
  const [tasks, setTasks] = useState({});
  const [showTaskModal, setShowTaskModal] = useState(false);
  const [newTask, setNewTask] = useState({ 
    title: '', 
    time: '', 
    completed: false, 
    isRepeating: false, 
    repeatType: 'daily', // 'daily', 'weekly', 'weekdays'
    repeatDays: [] // for custom weekly repeats
  });
  const [editingTask, setEditingTask] = useState(null);
  const [view, setView] = useState('day'); // 'day' or 'calendar'
  const [isOnline, setIsOnline] = useState(true);
  const [isLoading, setIsLoading] = useState(false);

  // Initialize notifications hook
  const { 
    isNotificationEnabled, 
    requestNotificationPermission 
  } = useNotifications(tasks);

  // Load tasks from MongoDB on component mount
  useEffect(() => {
    loadTasks();
  }, []);

  // Load all tasks from database
  const loadTasks = async () => {
    setIsLoading(true);
    try {
      const data = await api.getTasks();
      setTasks(data);
      setIsOnline(true);
    } catch (error) {
      setIsOnline(false);
      console.error('Failed to load tasks from database');
    } finally {
      setIsLoading(false);
    }
  };

  // Format date as YYYY-MM-DD for storage key (using local timezone)
  const formatDateKey = (date) => {
    const year = date.getFullYear();
    const month = String(date.getMonth() + 1).padStart(2, '0');
    const day = String(date.getDate()).padStart(2, '0');
    return `${year}-${month}-${day}`;
  };

  // Get tasks for selected date (including repeating tasks)
  const getTasksForDate = (date) => {
    const dateKey = formatDateKey(date);
    let dateTasks = tasks[dateKey] || [];
    
    // Add repeating tasks
    const repeatingTasks = [];
    const completions = tasks.completions || {};
    
    Object.keys(tasks).forEach(key => {
      if (key === 'completions') return;
      tasks[key].forEach(task => {
        if (task.isRepeating && shouldTaskRepeatOnDate(task, date, key)) {
          const instanceKey = `${task.id}-${dateKey}`;
          // Create a copy with unique ID for this date
          const repeatingTask = {
            ...task,
            id: `${task.id}-${dateKey}`,
            isRepeatingInstance: true,
            originalId: task.id,
            originalDate: key,
            completed: completions[instanceKey] || false
          };
          repeatingTasks.push(repeatingTask);
        }
      });
    });
    
    return [...dateTasks, ...repeatingTasks];
  };

  // Check if a repeating task should appear on a specific date
  const shouldTaskRepeatOnDate = (task, targetDate, originalDateKey) => {
    if (!task.isRepeating) return false;
    
    const originalDate = new Date(originalDateKey);
    const daysDiff = Math.floor((targetDate - originalDate) / (1000 * 60 * 60 * 24));
    
    // Don't show on the original date (it's already there)
    if (daysDiff === 0) return false;
    // Don't show for past dates before the original
    if (daysDiff < 0) return false;
    
    switch (task.repeatType) {
      case 'daily':
        return true;
      case 'weekly':
        return daysDiff % 7 === 0;
      case 'weekdays':
        const dayOfWeek = targetDate.getDay();
        return dayOfWeek >= 1 && dayOfWeek <= 5; // Monday to Friday
      case 'custom':
        const targetDay = targetDate.getDay();
        return task.repeatDays.includes(targetDay);
      default:
        return false;
    }
  };

  // Add or update task
  const saveTask = async () => {
    if (!newTask.title.trim()) return;

    setIsLoading(true);
    const dateKey = formatDateKey(selectedDate);
    const currentTasks = tasks[dateKey] || [];
    
    try {
      if (editingTask !== null) {
        // Update existing task
        const updatedTask = { 
          ...newTask, 
          id: currentTasks[editingTask].id,
          originalDate: newTask.isRepeating ? dateKey : undefined
        };
        
        await api.updateTask(dateKey, editingTask, updatedTask);
        
        const updatedTasks = currentTasks.map((task, index) => 
          index === editingTask ? updatedTask : task
        );
        setTasks({ ...tasks, [dateKey]: updatedTasks });
      } else {
        // Add new task
        const taskWithId = { 
          ...newTask, 
          id: Date.now(),
          originalDate: newTask.isRepeating ? dateKey : undefined
        };
        
        await api.saveTask(dateKey, taskWithId);
        setTasks({ ...tasks, [dateKey]: [...currentTasks, taskWithId] });
      }

      setIsOnline(true);
    } catch (error) {
      setIsOnline(false);
      console.error('Failed to save task to database');
    } finally {
      setIsLoading(false);
    }

    setNewTask({ 
      title: '', 
      time: '', 
      completed: false, 
      isRepeating: false, 
      repeatType: 'daily',
      repeatDays: []
    });
    setShowTaskModal(false);
    setEditingTask(null);
  };

  // Toggle task completion
  const toggleTask = async (taskIndex) => {
    const dateKey = formatDateKey(selectedDate);
    const currentTasks = getTasksForDate(selectedDate);
    const task = currentTasks[taskIndex];
    
    if (!task) return; // Safety check
    
    setIsLoading(true);
    
    try {
      if (task.isRepeatingInstance) {
        // For repeating task instances, we need to store completion status separately
        const completionKey = `completions`;
        const currentCompletions = tasks[completionKey] || {};
        const instanceKey = `${task.originalId}-${dateKey}`;
        
        const updatedCompletions = {
          ...currentCompletions,
          [instanceKey]: !task.completed
        };
        
        // Save completion status to database
        await api.updateTaskCompletion(updatedCompletions);
        
        setTasks({
          ...tasks,
          [completionKey]: updatedCompletions
        });
      } else {
        // Regular task completion toggle
        const actualTasks = tasks[dateKey] || [];
        const actualIndex = actualTasks.findIndex(t => t.id === task.id);
        if (actualIndex !== -1) {
          const updatedTask = { ...actualTasks[actualIndex], completed: !actualTasks[actualIndex].completed };
          
          // Update task in database
          await api.updateTask(dateKey, actualIndex, updatedTask);
          
          const updatedTasks = actualTasks.map((t, index) => 
            index === actualIndex ? updatedTask : t
          );
          setTasks({ ...tasks, [dateKey]: updatedTasks });
        }
      }
      setIsOnline(true);
    } catch (error) {
      setIsOnline(false);
      console.error('Failed to update task completion:', error);
    } finally {
      setIsLoading(false);
    }
  };

  // Delete task
  const deleteTask = async (taskIndex) => {
    const dateKey = formatDateKey(selectedDate);
    const currentTasks = getTasksForDate(selectedDate);
    const task = currentTasks[taskIndex];
    
    if (!task) return; // Safety check
    
    if (task.isRepeatingInstance) {
      alert("Cannot delete repeating task instances. Edit the original task to stop repeating.");
      return;
    }
    
    setIsLoading(true);
    
    try {
      const actualTasks = tasks[dateKey] || [];
      const actualIndex = actualTasks.findIndex(t => t.id === task.id);
      if (actualIndex !== -1) {
        await api.deleteTask(dateKey, actualIndex);
        
        const updatedTasks = actualTasks.filter((_, index) => index !== actualIndex);
        setTasks({ ...tasks, [dateKey]: updatedTasks });
      }
      setIsOnline(true);
    } catch (error) {
      setIsOnline(false);
      console.error('Failed to delete task from database');
    } finally {
      setIsLoading(false);
    }
  };

  // Edit task
  const editTask = (taskIndex) => {
    const currentTasks = getTasksForDate(selectedDate);
    const task = currentTasks[taskIndex];
    
    if (!task) return; // Safety check
    
    if (task.isRepeatingInstance) {
      // For repeating instances, we need to edit the original
      const originalDateKey = task.originalDate;
      const originalTasks = tasks[originalDateKey] || [];
      const originalTask = originalTasks.find(t => t.id === task.originalId);
      if (originalTask) {
        setNewTask({ ...originalTask });
        setEditingTask(originalTasks.findIndex(t => t.id === task.originalId));
        setSelectedDate(new Date(originalDateKey)); // Switch to original date
      }
    } else {
      const dateKey = formatDateKey(selectedDate);
      const actualTasks = tasks[dateKey] || [];
      const actualIndex = actualTasks.findIndex(t => t.id === task.id);
      if (actualIndex !== -1) {
        setNewTask({ ...task });
        setEditingTask(actualIndex);
      }
    }
    setShowTaskModal(true);
  };

  // Generate calendar days
  const getCalendarDays = () => {
    const year = currentDate.getFullYear();
    const month = currentDate.getMonth();
    const firstDay = new Date(year, month, 1);
    const startDate = new Date(firstDay);
    startDate.setDate(startDate.getDate() - firstDay.getDay());

    const days = [];
    for (let i = 0; i < 42; i++) {
      const date = new Date(startDate);
      date.setDate(startDate.getDate() + i);
      days.push(date);
    }
    return days;
  };

  const calendarDays = getCalendarDays();
  const todayTasks = getTasksForDate(selectedDate);
  const completedTasks = todayTasks.filter(task => task.completed).length;

  return (
    <div className="todo-calendar-app">
      <div className="app-container">
        {/* Header */}
        <div className="app-header">
          <h1 className="header-title">Todo Calendar</h1>
          <div className="view-toggle">
            <button
              onClick={() => setView('day')}
              className={`view-toggle-btn ${view === 'day' ? 'active' : ''}`}
            >
              Day View
            </button>
            <button
              onClick={() => setView('calendar')}
              className={`view-toggle-btn ${view === 'calendar' ? 'active' : ''}`}
            >
              Calendar
            </button>
          </div>
          
          <div className="header-info">
            <div className="date-display">
              <Calendar className="text-blue-500" size={24} />
              <span className="date-text">
                {selectedDate.toLocaleDateString('en-US', { 
                  weekday: 'long', 
                  year: 'numeric', 
                  month: 'long', 
                  day: 'numeric' 
                })}
              </span>
              {/* Connection Status */}
              <div className={`connection-status ${isOnline ? 'online' : 'offline'}`}>
                {isOnline ? <Wifi size={16} /> : <WifiOff size={16} />}
                {isOnline ? 'Connected' : 'Offline'}
              </div>
              
              {/* Notification Status */}
              <div className={`notification-status ${isNotificationEnabled ? 'enabled' : 'disabled'}`}>
                <button
                  onClick={requestNotificationPermission}
                  className="notification-toggle-btn"
                  title={isNotificationEnabled ? 'Notifications enabled' : 'Click to enable notifications'}
                >
                  {isNotificationEnabled ? <Bell size={16} /> : <BellOff size={16} />}
                  {isNotificationEnabled ? 'Notifications On' : 'Enable Notifications'}
                </button>
              </div>
            </div>
            <div className="task-stats">
              <p className="task-stats-label">Tasks Completed</p>
              <p className="task-stats-count">{completedTasks}/{todayTasks.length}</p>
            </div>
          </div>
        </div>

        <div className="content-grid" style={{ display: 'grid', gridTemplateColumns: view === 'calendar' ? '1fr 1fr' : '1fr' }}>
          {/* Calendar View */}
          {view === 'calendar' && (
            <div className="card">
              <div className="calendar-header">
                <button
                  onClick={() => setCurrentDate(new Date(currentDate.setMonth(currentDate.getMonth() - 1)))}
                  className="calendar-nav-btn"
                >
                  ←
                </button>
                <h2 className="calendar-month-year">
                  {currentDate.toLocaleDateString('en-US', { month: 'long', year: 'numeric' })}
                </h2>
                <button
                  onClick={() => setCurrentDate(new Date(currentDate.setMonth(currentDate.getMonth() + 1)))}
                  className="calendar-nav-btn"
                >
                  →
                </button>
              </div>

              <div className="calendar-days-header">
                {['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'].map(day => (
                  <div key={day} className="calendar-day-header">
                    {day}
                  </div>
                ))}
              </div>

              <div className="calendar-grid">
                {calendarDays.map((date, index) => {
                  const isCurrentMonth = date.getMonth() === currentDate.getMonth();
                  const isToday = date.toDateString() === new Date().toDateString();
                  const isSelected = date.toDateString() === selectedDate.toDateString();
                  const dayTasks = getTasksForDate(date);
                  const hasTask = dayTasks.length > 0;

                  return (
                    <button
                      key={index}
                      onClick={() => setSelectedDate(new Date(date))}
                      className={`calendar-day ${
                        isSelected ? 'selected' : ''
                      } ${
                        isToday ? 'today' : ''
                      } ${
                        !isCurrentMonth ? 'other-month' : ''
                      } ${
                        hasTask ? 'has-tasks' : ''
                      }`}
                    >
                      {date.getDate()}
                    </button>
                  );
                })}
              </div>
            </div>
          )}

          {/* Tasks List */}
          <div className="card">
            <div className="tasks-header">
              <h2 className="tasks-title">
                Tasks for {selectedDate.toLocaleDateString()}
              </h2>
              <button
                onClick={() => setShowTaskModal(true)}
                disabled={isLoading}
                className="add-task-btn"
              >
                {isLoading ? (
                  <div className="loading-spinner" />
                ) : (
                  <Plus size={20} />
                )}
              </button>
            </div>

            <div className="tasks-list">
              {todayTasks.length === 0 ? (
                <div className="empty-state">
                  <Calendar size={48} className="empty-state-icon" />
                  <p className="empty-state-text">No tasks scheduled for this day</p>
                </div>
              ) : (
                todayTasks
                  .map((task, originalIndex) => ({ task, originalIndex }))
                  .sort((a, b) => (a.task.time || '').localeCompare(b.task.time || ''))
                  .map(({ task, originalIndex }) => (
                    <div
                      key={task.id || originalIndex}
                      className={`task-item ${task.completed ? 'completed' : ''}`}
                    >
                      <button
                        onClick={() => toggleTask(originalIndex)}
                        className={`task-checkbox ${task.completed ? 'completed' : ''}`}
                      >
                        {task.completed && <Check size={12} />}
                      </button>
                      
                      <div className="task-content">
                        <div className={`task-title ${task.completed ? 'completed' : ''}`}>
                          {task.title}
                          {task.isRepeating && (
                            <Repeat size={14} className="task-repeat-icon" />
                          )}
                          {task.isRepeatingInstance && (
                            <span className="task-repeat-label">(repeating)</span>
                          )}
                        </div>
                        {task.time && (
                          <div className="task-time">
                            <Clock size={12} />
                            {task.time}
                          </div>
                        )}
                      </div>

                      <div className="task-actions">
                        <button
                          onClick={() => editTask(originalIndex)}
                          className="task-action-btn edit"
                        >
                          <Edit3 size={16} />
                        </button>
                        <button
                          onClick={() => deleteTask(originalIndex)}
                          className="task-action-btn delete"
                        >
                          <Trash2 size={16} />
                        </button>
                      </div>
                    </div>
                  ))
              )}
            </div>
          </div>
        </div>

        {/* Task Modal */}
        {showTaskModal && (
          <div className="modal-overlay">
            <div className="modal">
              <div className="modal-header">
                <h3 className="modal-title">
                  {editingTask !== null ? 'Edit Task' : 'Add New Task'}
                </h3>
                <button
                  onClick={() => {
                    setShowTaskModal(false);
                    setEditingTask(null);
                    setNewTask({ 
                      title: '', 
                      time: '', 
                      completed: false, 
                      isRepeating: false, 
                      repeatType: 'daily',
                      repeatDays: []
                    });
                  }}
                  className="modal-close-btn"
                >
                  <X size={20} />
                </button>
              </div>

              <div>
                <div className="form-group">
                  <label className="form-label">
                    Task Title
                  </label>
                  <input
                    type="text"
                    value={newTask.title}
                    onChange={(e) => setNewTask({ ...newTask, title: e.target.value })}
                    placeholder="Enter task description"
                    className="form-input"
                    autoFocus
                  />
                </div>

                <div className="form-group">
                  <label className="form-label">
                    Time (optional)
                  </label>
                  <input
                    type="time"
                    value={newTask.time}
                    onChange={(e) => setNewTask({ ...newTask, time: e.target.value })}
                    className="form-input"
                  />
                </div>

                <div className="checkbox-group">
                  <input
                    type="checkbox"
                    checked={newTask.isRepeating}
                    onChange={(e) => setNewTask({ ...newTask, isRepeating: e.target.checked })}
                    className="checkbox-input"
                    id="repeating-checkbox"
                  />
                  <label htmlFor="repeating-checkbox" className="checkbox-label">
                    <Repeat size={16} />
                    Make this a repeating task
                  </label>
                </div>

                  {newTask.isRepeating && (
                    <div className="repeat-options">
                      <div className="form-group">
                        <label className="form-label">
                          Repeat Type
                        </label>
                        <select
                          value={newTask.repeatType}
                          onChange={(e) => setNewTask({ ...newTask, repeatType: e.target.value })}
                          className="form-select"
                        >
                          <option value="daily">Every Day</option>
                          <option value="weekly">Every Week</option>
                          <option value="weekdays">Weekdays Only</option>
                          <option value="custom">Custom Days</option>
                        </select>
                      </div>

                      {newTask.repeatType === 'custom' && (
                        <div className="form-group">
                          <label className="form-label">
                            Select Days
                          </label>
                          <div className="days-grid">
                            {['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'].map((day, index) => (
                              <div key={day} className="day-checkbox">
                                <input
                                  type="checkbox"
                                  checked={newTask.repeatDays.includes(index)}
                                  onChange={(e) => {
                                    if (e.target.checked) {
                                      setNewTask({
                                        ...newTask,
                                        repeatDays: [...newTask.repeatDays, index]
                                      });
                                    } else {
                                      setNewTask({
                                        ...newTask,
                                        repeatDays: newTask.repeatDays.filter(d => d !== index)
                                      });
                                    }
                                  }}
                                  id={`day-${index}`}
                                />
                                <label htmlFor={`day-${index}`}>{day}</label>
                              </div>
                            ))}
                          </div>
                        </div>
                      )}
                    </div>
                  )}

                <div className="btn-group">
                  <button
                    onClick={() => {
                      setShowTaskModal(false);
                      setEditingTask(null);
                      setNewTask({ 
                        title: '', 
                        time: '', 
                        completed: false, 
                        isRepeating: false, 
                        repeatType: 'daily',
                        repeatDays: []
                      });
                    }}
                    className="btn btn-secondary"
                  >
                    Cancel
                  </button>
                  <button
                    onClick={saveTask}
                    className="btn btn-primary"
                  >
                    {editingTask !== null ? 'Update Task' : 'Add Task'}
                  </button>
                </div>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};

export default TodoCalendarApp;