import React, { createContext, useContext, useState, useEffect, useCallback } from 'react';
import { api } from '../api/client';
import { UserRole, UserProfile } from '../api/types';

export const DEMO_CREDENTIALS: Record<UserRole, { email: string; pass: string; title: string }> = {
  STUDENT: {
    email: 'student1@campusshare.demo',
    pass: 'Password123!',
    title: 'Aarav Mehta (Student)',
  },
  OWNER: {
    email: 'owner@campusshare.demo',
    pass: 'Password123!',
    title: 'Prof. Maya Sen (Lab Owner)',
  },
  MANAGER: {
    email: 'manager@campusshare.demo',
    pass: 'Password123!',
    title: 'Vikram Joshi (Facility Manager)',
  },
  ADMIN: {
    email: 'admin@campusshare.demo',
    pass: 'Password123!',
    title: 'Dr. Ramesh Nair (Administrator)',
  },
};

const FALLBACK_USERS: Record<UserRole, UserProfile> = {
  STUDENT: {
    id: 'u-std-01',
    email: 'student1@campusshare.demo',
    full_name: 'Aarav Mehta',
    role: 'STUDENT',
    department_id: 'dept-cs-01',
    dept_id: 'CS',
    student_id: 'STU-2026-001',
    phone: '+91 98765 43210',
    is_active: true,
    is_verified: true,
    no_show_count: 0,
    created_at: new Date().toISOString(),
  },
  OWNER: {
    id: 'u-own-02',
    email: 'owner@campusshare.demo',
    full_name: 'Prof. Maya Sen',
    role: 'OWNER',
    department_id: 'dept-me-02',
    dept_id: 'MECH',
    is_active: true,
    is_verified: true,
    no_show_count: 0,
    created_at: new Date().toISOString(),
  },
  MANAGER: {
    id: 'u-mgr-03',
    email: 'manager@campusshare.demo',
    full_name: 'Vikram Joshi',
    role: 'MANAGER',
    department_id: 'dept-ops-03',
    dept_id: 'OPS',
    is_active: true,
    is_verified: true,
    no_show_count: 0,
    created_at: new Date().toISOString(),
  },
  ADMIN: {
    id: 'u-adm-04',
    email: 'admin@campusshare.demo',
    full_name: 'Dr. Ramesh Nair',
    role: 'ADMIN',
    department_id: 'dept-adm-04',
    dept_id: 'ADMIN',
    is_active: true,
    is_verified: true,
    no_show_count: 0,
    created_at: new Date().toISOString(),
  },
};

interface AuthContextValue {
  user: UserProfile;
  role: UserRole;
  isAuthenticated: boolean;
  isLoading: boolean;
  setRole: (role: UserRole) => Promise<void>;
  login: (email: string, pass: string) => Promise<UserProfile>;
  logout: () => Promise<void>;
  unreadCount: number;
  refreshUnread: () => Promise<void>;
  clearUnread: () => void;
}

const AuthContext = createContext<AuthContextValue | undefined>(undefined);

export const AuthProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [role, setRoleState] = useState<UserRole>(() => {
    return (localStorage.getItem('cs_demo_role') as UserRole) || 'STUDENT';
  });

  const [user, setUser] = useState<UserProfile>(() => {
    const saved = localStorage.getItem('cs_user_profile');
    if (saved) {
      try {
        return JSON.parse(saved);
      } catch {
        // fallback
      }
    }
    return FALLBACK_USERS[role];
  });

  const [isAuthenticated, setIsAuthenticated] = useState<boolean>(() => {
    return Boolean(localStorage.getItem('cs_access_token'));
  });

  const [isLoading, setIsLoading] = useState<boolean>(false);
  const [unreadCount, setUnreadCount] = useState<number>(2);

  // Poll notifications every 15s
  const refreshUnread = useCallback(async () => {
    if (!api.getAccessToken()) return;
    try {
      const data = await api.getUnreadCount();
      setUnreadCount(data.unread_count);
    } catch {
      // quiet poll
    }
  }, []);

  useEffect(() => {
    const interval = setInterval(() => {
      refreshUnread();
    }, 15000);
    return () => clearInterval(interval);
  }, [refreshUnread]);

  // Sync profile on mount if token exists
  useEffect(() => {
    if (api.getAccessToken()) {
      api.getMe()
        .then((profile) => {
          setUser(profile);
          setRoleState(profile.role);
          setIsAuthenticated(true);
          localStorage.setItem('cs_demo_role', profile.role);
          localStorage.setItem('cs_user_profile', JSON.stringify(profile));
        })
        .catch(() => {
          // Token expired or invalid
        });
    }
  }, []);

  const login = async (email: string, pass: string): Promise<UserProfile> => {
    setIsLoading(true);
    try {
      const res = await api.login({ email, password: pass });
      api.setAccessToken(res.access_token);
      setUser(res.user);
      setRoleState(res.user.role);
      setIsAuthenticated(true);
      localStorage.setItem('cs_demo_role', res.user.role);
      localStorage.setItem('cs_user_profile', JSON.stringify(res.user));
      refreshUnread();
      return res.user;
    } finally {
      setIsLoading(false);
    }
  };

  const logout = async () => {
    try {
      await api.logout();
    } catch {
      // ignore
    } finally {
      api.setAccessToken(null);
      setIsAuthenticated(false);
      localStorage.removeItem('cs_user_profile');
      // default back to student demo
      setUser(FALLBACK_USERS.STUDENT);
      setRoleState('STUDENT');
      localStorage.setItem('cs_demo_role', 'STUDENT');
    }
  };

  // Switch persona (for evaluation or testing)
  const setRole = async (newRole: UserRole) => {
    setRoleState(newRole);
    localStorage.setItem('cs_demo_role', newRole);
    const demo = DEMO_CREDENTIALS[newRole];

    try {
      const res = await api.login({ email: demo.email, password: demo.pass });
      api.setAccessToken(res.access_token);
      setUser(res.user);
      setIsAuthenticated(true);
      localStorage.setItem('cs_user_profile', JSON.stringify(res.user));
      refreshUnread();
    } catch {
      // Fallback to local profile if offline
      const fallback = FALLBACK_USERS[newRole];
      setUser(fallback);
      localStorage.setItem('cs_user_profile', JSON.stringify(fallback));
    }
  };

  const clearUnread = () => setUnreadCount(0);

  return (
    <AuthContext.Provider
      value={{
        user,
        role,
        isAuthenticated,
        isLoading,
        setRole,
        login,
        logout,
        unreadCount,
        refreshUnread,
        clearUnread,
      }}
    >
      {children}
    </AuthContext.Provider>
  );
};

export const useAuth = (): AuthContextValue => {
  const ctx = useContext(AuthContext);
  if (!ctx) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return ctx;
};
