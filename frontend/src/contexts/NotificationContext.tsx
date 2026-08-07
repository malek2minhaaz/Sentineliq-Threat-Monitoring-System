import React, { createContext, useContext, useState, useEffect, useCallback, useRef } from 'react';
import { api } from '../utils/api';
import { useToast } from './ToastContext';

interface Notification {
  id: string;
  user_id: string;
  title: string;
  message: string;
  category: string;
  severity: string;
  is_read: boolean;
  created_at: string;
  related_id: string;
}

interface NotificationContextType {
  notifications: Notification[];
  unreadCount: number;
  loading: boolean;
  markRead: (id: string) => Promise<void>;
  markAllRead: () => Promise<void>;
  addNotification: (n: Notification) => void;
  clearAll: () => void;
}

const NotificationContext = createContext<NotificationContextType | null>(null);

export function NotificationProvider({ children }: { children: React.ReactNode }) {
  const [notifications, setNotifications] = useState<Notification[]>([]);
  const [unreadCount, setUnreadCount] = useState(0);
  const [loading, setLoading] = useState(true);
  const wsRef = useRef<WebSocket | null>(null);
  const isFirstLoad = useRef(true);
  const { addToast } = useToast();

  // Fetch initial notifications
  const fetchNotifications = useCallback(async () => {
    try {
      const res = await api.get<{ items: Notification[]; unread_count: number }>('/notifications');
      setNotifications(res.items);
      setUnreadCount(res.unread_count);
    } catch {
      // Silently fail
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchNotifications();
  }, [fetchNotifications]);

  // WebSocket connection
  useEffect(() => {
    const token = api.getToken();
    if (!token) return;

    const protocol = window.location.protocol === 'https:' ? 'wss:' : 'ws:';
    const host = window.location.host;
    const ws = new WebSocket(`${protocol}//${host}/ws`);
    wsRef.current = ws;

    isFirstLoad.current = true;

    ws.onmessage = (event) => {
      try {
        const data = JSON.parse(event.data);

        // Skip toasts for bulk initial data
        if (data.bulk) {
          if (isFirstLoad.current) {
            // First bulk load - don't toast
          }
          return;
        }

        if (isFirstLoad.current) {
          isFirstLoad.current = false;
          return;
        }

        // A notification was created for this user (e.g. a SOC lead assigned a
        // new investigation) — re-fetch from the server so the bell + unread
        // count stay in sync in real time.
        if (data.type === 'notification') {
          fetchNotifications();
          return;
        }

        if (data.type === 'new_event' || data.type === 'incident_update') {
          const item = data.data;
          const sev = item.severity || 'info';

          // Create notification
          const notif: Notification = {
            id: item.id || Math.random().toString(36).substring(2),
            user_id: '',
            title: data.type === 'new_event' ? 'New Security Event' : 'Incident Updated',
            message: item.message || item.title || 'Security alert received',
            category: 'alert',
            severity: sev,
            is_read: false,
            created_at: new Date().toISOString(),
            related_id: item.id || '',
          };

          setNotifications(prev => [notif, ...prev]);
          if (sev === 'critical' || sev === 'high') {
            setUnreadCount(prev => prev + 1);
            addToast({
              type: sev === 'critical' ? 'error' : 'warning',
              title: notif.title,
              message: notif.message,
            });
          } else {
            setUnreadCount(prev => prev + 1);
          }
        }
      } catch {
        // Ignore parse errors
      }
    };

    ws.onclose = () => {
      // Reconnect after 5 seconds
      setTimeout(() => {
        const token = api.getToken();
        if (!token) return;
        const protocol = window.location.protocol === 'https:' ? 'wss:' : 'ws:';
        const host = window.location.host;
        const newWs = new WebSocket(`${protocol}//${host}/ws`);
        wsRef.current = newWs;
        isFirstLoad.current = true;
      }, 5000);
    };

    return () => {
      ws.close();
    };
  }, [addToast, fetchNotifications]);

  const markRead = useCallback(async (id: string) => {
    try {
      await api.post(`/notifications/${id}/read`);
      setNotifications(prev =>
        prev.map(n => n.id === id ? { ...n, is_read: true } : n)
      );
      setUnreadCount(prev => Math.max(0, prev - 1));
    } catch {
      // Ignore
    }
  }, []);

  const markAllRead = useCallback(async () => {
    try {
      await api.post('/notifications/read-all');
      setNotifications(prev => prev.map(n => ({ ...n, is_read: true })));
      setUnreadCount(0);
    } catch {
      // Ignore
    }
  }, []);

  const addNotification = useCallback((n: Notification) => {
    setNotifications(prev => [n, ...prev]);
    if (!n.is_read) setUnreadCount(prev => prev + 1);
  }, []);

  const clearAll = useCallback(() => {
    setNotifications([]);
    setUnreadCount(0);
  }, []);

  return (
    <NotificationContext.Provider value={{
      notifications, unreadCount, loading,
      markRead, markAllRead, addNotification, clearAll,
    }}>
      {children}
    </NotificationContext.Provider>
  );
}

export function useNotifications() {
  const ctx = useContext(NotificationContext);
  if (!ctx) throw new Error('useNotifications must be used within NotificationProvider');
  return ctx;
}
