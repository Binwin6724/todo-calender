import { useEffect, useRef, useState, useCallback } from 'react';

const useNotifications = (tasks) => {
  const [notificationPermission, setNotificationPermission] = useState(Notification.permission);
  const [isNotificationEnabled, setIsNotificationEnabled] = useState(false);
  const notifiedTasksRef = useRef(new Set());
  const intervalRef = useRef(null);

  // Request notification permission
  const requestNotificationPermission = async () => {
    if ('Notification' in window) {
      try {
        const permission = await Notification.requestPermission();
        setNotificationPermission(permission);
        setIsNotificationEnabled(permission === 'granted');
        return permission === 'granted';
      } catch (error) {
        console.error('Error requesting notification permission:', error);
        return false;
      }
    } else {
      console.warn('This browser does not support notifications');
      return false;
    }
  };

  // Show notification for a task
  const showTaskNotification = useCallback((task, dateKey) => {
    if (notificationPermission !== 'granted') {
      console.warn('Notification permission not granted');
      return;
    }

    const taskId = task.isRepeatingInstance ? `${task.originalId}-${dateKey}` : `${task.id}-${dateKey}`;
    
    // Avoid duplicate notifications for the same task on the same day
    if (notifiedTasksRef.current.has(taskId)) return;
    
    console.log('Showing notification for task:', task.title, 'at', task.time);
    
    const notification = new Notification('Todo Calendar - Task Due!', {
      body: `"${task.title}" is scheduled for ${task.time}`,
      icon: '/1.png',
      badge: '/1.png',
      tag: taskId,
      requireInteraction: false, // Changed to false for better cross-browser compatibility
      silent: false
    });

    // Handle notification click
    notification.onclick = () => {
      window.focus();
      notification.close();
    };

    // Handle notification error
    notification.onerror = (error) => {
      console.error('Notification error:', error);
    };

    // Mark this task as notified
    notifiedTasksRef.current.add(taskId);

    // Auto-close notification after 15 seconds
    setTimeout(() => {
      notification.close();
    }, 15000);

    return notification;
  }, [notificationPermission]);

  // Get current time in HH:MM format
  const getCurrentTime = () => {
    const now = new Date();
    return now.toTimeString().slice(0, 5);
  };

  // Get current date key
  const getCurrentDateKey = () => {
    return new Date().toISOString().split('T')[0];
  };

  // Get tasks for a specific date (including repeating tasks)
  const getTasksForDate = useCallback((date, allTasks) => {
    const dateKey = date.toISOString().split('T')[0];
    let dateTasks = allTasks[dateKey] || [];
    
    // Add repeating tasks
    const repeatingTasks = [];
    const completions = allTasks.completions || {};
    
    Object.keys(allTasks).forEach(key => {
      if (key === 'completions') return;
      allTasks[key].forEach(task => {
        if (task.isRepeating && shouldTaskRepeatOnDate(task, date, key)) {
          const instanceKey = `${task.id}-${dateKey}`;
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
  }, []);

  // Check if a repeating task should appear on a specific date
  const shouldTaskRepeatOnDate = (task, targetDate, originalDateKey) => {
    if (!task.isRepeating) return false;
    
    const originalDate = new Date(originalDateKey);
    const daysDiff = Math.floor((targetDate - originalDate) / (1000 * 60 * 60 * 24));
    
    if (daysDiff === 0) return false;
    if (daysDiff < 0) return false;
    
    switch (task.repeatType) {
      case 'daily':
        return true;
      case 'weekly':
        return daysDiff % 7 === 0;
      case 'weekdays':
        const dayOfWeek = targetDate.getDay();
        return dayOfWeek >= 1 && dayOfWeek <= 5;
      case 'custom':
        const targetDay = targetDate.getDay();
        return task.repeatDays.includes(targetDay);
      default:
        return false;
    }
  };

  // Check for due tasks
  const checkForDueTasks = useCallback(() => {
    if (!isNotificationEnabled || !tasks) return;

    const now = new Date();
    const currentTime = getCurrentTime();
    const currentDateKey = getCurrentDateKey();
    const todayTasks = getTasksForDate(now, tasks);

    console.log('Checking for due tasks at', currentTime, 'Found', todayTasks.length, 'tasks today');

    todayTasks.forEach(task => {
      // Only notify for tasks with time set and not completed
      if (task.time && !task.completed) {
        console.log('Task:', task.title, 'scheduled for:', task.time, 'current time:', currentTime);
        if (task.time === currentTime) {
          console.log('Task is due! Showing notification');
          showTaskNotification(task, currentDateKey);
        }
      }
    });
  }, [isNotificationEnabled, tasks, getTasksForDate, showTaskNotification]);

  // Clear notifications for completed tasks
  const clearNotificationsForCompletedTasks = useCallback(() => {
    const currentDateKey = getCurrentDateKey();
    const now = new Date();
    const todayTasks = getTasksForDate(now, tasks);

    todayTasks.forEach(task => {
      if (task.completed) {
        const taskId = task.isRepeatingInstance ? `${task.originalId}-${currentDateKey}` : `${task.id}-${currentDateKey}`;
        notifiedTasksRef.current.delete(taskId);
      }
    });
  }, [tasks, getTasksForDate]);

  // Reset notifications at midnight
  const resetNotificationsAtMidnight = useCallback(() => {
    const now = new Date();
    const tomorrow = new Date(now);
    tomorrow.setDate(tomorrow.getDate() + 1);
    tomorrow.setHours(0, 0, 0, 0);
    
    const msUntilMidnight = tomorrow.getTime() - now.getTime();
    
    setTimeout(() => {
      notifiedTasksRef.current.clear();
      // Set up the next midnight reset
      resetNotificationsAtMidnight();
    }, msUntilMidnight);
  }, []);

  // Initialize notifications
  useEffect(() => {
    if (notificationPermission === 'granted') {
      setIsNotificationEnabled(true);
    }
  }, [notificationPermission]);

  // Set up task checking interval
  useEffect(() => {
    if (isNotificationEnabled && tasks) {
      // Check every 30 seconds for more reliable background operation
      intervalRef.current = setInterval(() => {
        checkForDueTasks();
        clearNotificationsForCompletedTasks();
      }, 30000);

      // Also check immediately
      checkForDueTasks();

      // Set up midnight reset
      resetNotificationsAtMidnight();

      // Add visibility change listener to check when tab becomes active
      const handleVisibilityChange = () => {
        if (!document.hidden) {
          // Tab became active, check for due tasks immediately
          checkForDueTasks();
        }
      };

      document.addEventListener('visibilitychange', handleVisibilityChange);

      return () => {
        if (intervalRef.current) {
          clearInterval(intervalRef.current);
        }
        document.removeEventListener('visibilitychange', handleVisibilityChange);
      };
    }
  }, [isNotificationEnabled, tasks, checkForDueTasks, clearNotificationsForCompletedTasks, resetNotificationsAtMidnight]);

  // Clean up on unmount
  useEffect(() => {
    return () => {
      if (intervalRef.current) {
        clearInterval(intervalRef.current);
      }
    };
  }, []);

  return {
    notificationPermission,
    isNotificationEnabled,
    requestNotificationPermission,
    showTaskNotification
  };
};

export default useNotifications;
