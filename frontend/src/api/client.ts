import {
  UserProfile,
  Department,
  ResourceCategory,
  ResourceItem,
  EligibilityEvaluation,
  Booking,
  TimelineItem,
  Incident,
  NotificationItem,
  WaitlistEntry,
  FairnessProfile,
  PublicStats,
  UserRole,
  UnitCondition,
  IncidentStatus,
  IncidentComment,
  AnalyticsOverview,
  CampusPulseResponse,
  AiRecommendationResponse,
  PersonalizedResourceItem,
} from './types';

const getApiBase = () => {
  const envUrl = import.meta.env.VITE_API_URL;
  if (envUrl && envUrl.trim() !== '') {
    return envUrl.trim().replace(/\/+$/, '');
  }
  if (typeof window !== 'undefined') {
    const saved = localStorage.getItem('cs_custom_api_url');
    if (saved && saved.trim() !== '') {
      return saved.trim().replace(/\/+$/, '');
    }
    const host = window.location.hostname;
    // Check if running on local machine / LAN
    if (host === 'localhost' || host === '127.0.0.1') {
      return 'http://localhost:8000';
    }
    const isPrivateIP = /^(192\.168\.|10\.|172\.(1[6-9]|2[0-9]|3[0-1])\.)/.test(host);
    if (isPrivateIP) {
      return `http://${host}:8000`;
    }
    // Deployed to cloud (Vercel, Netlify, Render, etc.)
    return 'https://large-shrimps-shout.loca.lt';
  }
  return 'http://localhost:8000';
};

const API_BASE = getApiBase();

class ApiClient {
  private accessToken: string | null = null;
  private isRefreshing = false;
  private refreshSubscribers: ((token: string) => void)[] = [];

  constructor() {
    this.accessToken = localStorage.getItem('cs_access_token');
  }

  public setAccessToken(token: string | null) {
    this.accessToken = token;
    if (token) {
      localStorage.setItem('cs_access_token', token);
    } else {
      localStorage.removeItem('cs_access_token');
    }
  }

  public getAccessToken(): string | null {
    return this.accessToken || localStorage.getItem('cs_access_token');
  }

  private onRefreshed(token: string) {
    this.refreshSubscribers.forEach((callback) => callback(token));
    this.refreshSubscribers = [];
  }

  private addRefreshSubscriber(callback: (token: string) => void) {
    this.refreshSubscribers.push(callback);
  }

  public async request<T>(
    endpoint: string,
    options: RequestInit = {},
    isRetry = false
  ): Promise<T> {
    const url = endpoint.startsWith('http') ? endpoint : `${API_BASE}${endpoint}`;
    const headers: Record<string, string> = {
      Accept: 'application/json',
      'bypass-tunnel-reminder': 'true',
      ...((options.headers as Record<string, string>) || {}),
    };

    if (!(options.body instanceof FormData) && !headers['Content-Type']) {
      headers['Content-Type'] = 'application/json';
    }

    const token = this.getAccessToken();
    if (token) {
      headers['Authorization'] = `Bearer ${token}`;
    }

    const config: RequestInit = {
      ...options,
      headers,
      credentials: 'include',
    };

    try {
      const response = await fetch(url, config);

      if (response.status === 401 && !isRetry && !endpoint.includes('/auth/login') && !endpoint.includes('/auth/refresh')) {
        if (!this.isRefreshing) {
          this.isRefreshing = true;
          try {
            const refreshRes = await fetch(`${API_BASE}/auth/refresh`, {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              credentials: 'include',
            });

            if (refreshRes.ok) {
              const data = await refreshRes.json();
              this.setAccessToken(data.access_token);
              this.isRefreshing = false;
              this.onRefreshed(data.access_token);
              return this.request<T>(endpoint, options, true);
            } else {
              this.setAccessToken(null);
              this.isRefreshing = false;
              throw new Error('Session expired. Please log in again.');
            }
          } catch (err) {
            this.setAccessToken(null);
            this.isRefreshing = false;
            throw err;
          }
        } else {
          return new Promise<T>((resolve, reject) => {
            this.addRefreshSubscriber(async (newToken: string) => {
              try {
                headers['Authorization'] = `Bearer ${newToken}`;
                const retryRes = await fetch(url, { ...config, headers });
                if (!retryRes.ok) {
                  const errorData = await retryRes.json().catch(() => ({}));
                  reject(new Error(errorData.message || `Request failed with status ${retryRes.status}`));
                } else {
                  resolve(await retryRes.json());
                }
              } catch (retryErr) {
                reject(retryErr);
              }
            });
          });
        }
      }

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({}));
        const message = errorData.message || errorData.detail || `Request failed (${response.status})`;
        const error = new Error(message) as Error & { code?: string; status?: number; details?: unknown };
        error.code = errorData.code;
        error.status = response.status;
        error.details = errorData.details;
        throw error;
      }

      if (response.status === 204) {
        return {} as T;
      }

      return await response.json();
    } catch (error) {
      throw error;
    }
  }

  // Auth API
  public login = (data: { email: string; password: string }) =>
    this.request<{ access_token: string; refresh_token: string; user: UserProfile }>('/auth/login', {
      method: 'POST',
      body: JSON.stringify(data),
    });

  public register = (data: Record<string, unknown>) =>
    this.request<UserProfile>('/auth/register', {
      method: 'POST',
      body: JSON.stringify(data),
    });

  public getMe = () => this.request<UserProfile>('/auth/me');

  public updateMe = (data: Partial<UserProfile>) =>
    this.request<UserProfile>('/auth/me', {
      method: 'PATCH',
      body: JSON.stringify(data),
    });

  public forgotPassword = (email: string) =>
    this.request<{ message: string }>('/auth/forgot-password', {
      method: 'POST',
      body: JSON.stringify({ email }),
    });

  public resetPassword = (data: { token: string; new_password: string }) =>
    this.request<{ message: string }>('/auth/reset-password', {
      method: 'POST',
      body: JSON.stringify(data),
    });

  public logout = () =>
    this.request<{ message: string }>('/auth/logout', { method: 'POST' }).finally(() => {
      this.setAccessToken(null);
    });

  // Public Stats
  public getPublicStats = () => this.request<PublicStats>('/public/stats');

  // Departments & Categories
  public listDepartments = () => this.request<Department[]>('/departments');
  public createDepartment = (data: { name: string; code: string; description?: string }) =>
    this.request<Department>('/departments', { method: 'POST', body: JSON.stringify(data) });
  public updateDepartment = (id: string, data: { name: string; code: string; description?: string }) =>
    this.request<Department>(`/departments/${id}`, { method: 'PUT', body: JSON.stringify(data) });
  public deleteDepartment = (id: string) =>
    this.request<void>(`/departments/${id}`, { method: 'DELETE' });

  public listCategories = () => this.request<ResourceCategory[]>('/categories');
  public createCategory = (data: { name: string; icon_key: string; sort_order?: number }) =>
    this.request<ResourceCategory>('/categories', { method: 'POST', body: JSON.stringify(data) });
  public updateCategory = (id: string, data: { name: string; icon_key: string; sort_order?: number }) =>
    this.request<ResourceCategory>(`/categories/${id}`, { method: 'PUT', body: JSON.stringify(data) });
  public deleteCategory = (id: string) =>
    this.request<void>(`/categories/${id}`, { method: 'DELETE' });

  // Resources
  public listResources = (params: Record<string, string | number | boolean | undefined> = {}) => {
    const q = new URLSearchParams();
    Object.entries(params).forEach(([k, v]) => {
      if (v !== undefined && v !== '') q.append(k, String(v));
    });
    return this.request<{ items: ResourceItem[]; total: number; page: number; size: number }>(
      `/resources?${q.toString()}`
    );
  };

  public getResource = (id: string) => this.request<ResourceItem>(`/resources/${id}`);

  public createResource = (data: Record<string, unknown>) =>
    this.request<ResourceItem>('/resources', { method: 'POST', body: JSON.stringify(data) });

  public updateResource = (id: string, data: Record<string, unknown>) =>
    this.request<ResourceItem>(`/resources/${id}`, { method: 'PATCH', body: JSON.stringify(data) });

  public deleteResource = (id: string) =>
    this.request<{ message: string }>(`/resources/${id}`, { method: 'DELETE' });

  public checkEligibility = (id: string) =>
    this.request<EligibilityEvaluation>(`/resources/${id}/eligibility`);

  public getAvailability = async (id: string, date: string) => {
    const res = await this.request<{
      resource_id: string;
      date: string;
      slots: Array<{
        start?: string;
        end?: string;
        start_time?: string;
        end_time?: string;
        available: boolean;
        available_units?: number;
        total_units?: number;
      }>;
    }>(`/resources/${id}/availability?date=${date}`);
    return {
      ...res,
      slots: (res?.slots || []).map((s) => {
        const start = s.start || s.start_time || '09:00';
        const end = s.end || s.end_time || '10:00';
        return {
          start,
          end,
          start_time: start,
          end_time: end,
          available: Boolean(s.available),
          remaining_capacity: s.available_units ?? 1,
        };
      }),
    };
  };

  public getCalendar = (id: string) =>
    this.request<{ resource_id: string; days: { date: string; occupancy_pct: number; status: string }[] }>(
      `/resources/${id}/calendar`
    );

  public addResourceUnit = (id: string, data: { unit_code: string; condition: UnitCondition }) =>
    this.request<unknown>(`/resources/${id}/units`, { method: 'POST', body: JSON.stringify(data) });

  // Bookings & Approvals
  public validateBooking = (data: {
    resource_id: string;
    start_ts: string;
    end_ts: string;
    attendees?: number;
    purpose?: string;
  }) => this.request<EligibilityEvaluation>('/bookings/validate', { method: 'POST', body: JSON.stringify(data) });

  public createBooking = (
    data: {
      resource_id: string;
      start_ts: string;
      end_ts: string;
      attendees: number;
      purpose: string;
      project_name?: string;
    },
    idempotencyKey?: string
  ) => {
    const headers: Record<string, string> = {};
    if (idempotencyKey) headers['X-Idempotency-Key'] = idempotencyKey;
    return this.request<Booking>('/bookings', {
      method: 'POST',
      body: JSON.stringify(data),
      headers,
    });
  };

  public cancelBooking = (id: string, reason?: string) =>
    this.request<Booking>(`/bookings/${id}/cancel`, {
      method: 'POST',
      body: JSON.stringify({ reason }),
    });

  public getMyBookings = (params: Record<string, string | number | undefined> = {}) => {
    const q = new URLSearchParams();
    Object.entries(params).forEach(([k, v]) => {
      if (v !== undefined) q.append(k, String(v));
    });
    return this.request<{ items: Booking[]; total: number; page: number; size: number }>(
      `/bookings/me?${q.toString()}`
    );
  };

  public getBookingDetail = (id: string) => this.request<Booking>(`/bookings/${id}`);

  public getBookingTimeline = (id: string) => this.request<TimelineItem[]>(`/bookings/${id}/timeline`);

  public getAllBookings = (params: { status?: string; page?: number; size?: number } = {}) => {
    const q = new URLSearchParams();
    if (params.status && params.status !== 'ALL') q.append('status', params.status);
    if (params.page) q.append('page', String(params.page));
    if (params.size) q.append('page_size', String(params.size));
    return this.request<{ items: Booking[]; total: number; page: number; total_pages: number }>(`/bookings/all?${q.toString()}`);
  };

  // Approval Management
  public getApprovalQueue = async (params: Record<string, string | number | undefined> = {}): Promise<{ items: Booking[]; total: number }> => {
    const q = new URLSearchParams();
    Object.entries(params).forEach(([k, v]) => {
      if (v !== undefined) q.append(k, String(v));
    });
    const res = await this.request<any>(`/approvals/queue?${q.toString()}`);
    const rawList: any[] = Array.isArray(res) ? res : (res?.items || []);
    const items: Booking[] = rawList.map((item: any) => {
      if (item && item.booking) {
        return {
          ...item.booking,
          student: item.student,
          resource: item.resource,
          student_name: item.booking?.student_name || item.student?.name || item.student?.full_name || 'Student Applicant',
          student_email: item.booking?.student_email || item.student?.email || '',
          resource_name: item.booking?.resource_name || item.resource?.name || 'Campus Resource',
          eligibility_checks: item.eligibility_checks,
          conflict_details: item.conflict_details,
          has_conflicts: item.has_conflicts,
        };
      }
      return item;
    });
    return { items, total: items.length };
  };

  public approveBooking = (id: string, unit_id?: string) =>
    this.request<Booking>(`/bookings/${id}/approve`, {
      method: 'POST',
      body: JSON.stringify({ unit_id }),
    });

  public rejectBooking = (id: string, reason: string) =>
    this.request<Booking>(`/bookings/${id}/reject`, {
      method: 'POST',
      body: JSON.stringify({ reason }),
    });

  public suggestAlternative = (id: string, alternative_slots: { start_ts: string; end_ts: string }[], notes?: string) =>
    this.request<Booking>(`/bookings/${id}/suggest-alternative`, {
      method: 'POST',
      body: JSON.stringify({ alternative_slots, notes }),
    });

  public acceptAlternative = (id: string, slot_index = 0) =>
    this.request<Booking>(`/bookings/${id}/accept-alternative`, {
      method: 'POST',
      body: JSON.stringify({ slot_index }),
    });

  public overridePriority = (id: string, new_priority_score: number, reason: string) =>
    this.request<Booking>(`/bookings/${id}/override-priority`, {
      method: 'POST',
      body: JSON.stringify({ new_priority_score, reason }),
    });

  // Waiting List
  public joinWaitlist = (data: { resource_id: string; desired_start: string; desired_end: string }) =>
    this.request<WaitlistEntry>('/waitlist', { method: 'POST', body: JSON.stringify(data) });

  public listMyWaitlist = () => this.request<WaitlistEntry[]>('/waitlist/me');

  public cancelWaitlist = (id: string) => this.request<void>(`/waitlist/${id}`, { method: 'DELETE' });

  public acceptWaitlistOffer = (id: string) =>
    this.request<Booking>(`/waitlist/${id}/accept`, { method: 'POST' });

  // Handover & Return
  public checkout = (id: string, data: { booking_code_or_token: string; condition: UnitCondition; notes?: string; photo_urls?: string[]; confirmed_in_person?: boolean }) =>
    this.request<Booking>(`/bookings/${id}/checkout`, { method: 'POST', body: JSON.stringify(data) });

  public confirmPickup = (id: string) =>
    this.request<Booking>(`/bookings/${id}/confirm-pickup`, { method: 'POST' });

  public checkinOccupancy = (id: string, data: { headcount: number; room_condition: UnitCondition; notes?: string }) =>
    this.request<Booking>(`/bookings/${id}/checkin-occupancy`, { method: 'POST', body: JSON.stringify(data) });

  public submitReturn = (id: string, data: { notes?: string; photo_urls?: string[] }) =>
    this.request<Booking>(`/bookings/${id}/return`, { method: 'POST', body: JSON.stringify(data) });

  public verifyReturn = (id: string, data: {
    final_condition: UnitCondition;
    notes?: string;
    damage_observed: boolean;
    item_missing?: boolean;
    incident_description?: string;
  }) => this.request<{ status: string; incident_created?: unknown; pickup_condition?: unknown; return_condition?: unknown }>(
    `/bookings/${id}/verify-return`,
    { method: 'POST', body: JSON.stringify(data) }
  );

  // Incidents
  public listIncidents = (params: Record<string, string | number | undefined> = {}) => {
    const q = new URLSearchParams();
    Object.entries(params).forEach(([k, v]) => {
      if (v !== undefined) q.append(k, String(v));
    });
    return this.request<{ items: Incident[]; total: number }>(`/incidents?${q.toString()}`);
  };

  public getIncident = (id: string) => this.request<Incident>(`/incidents/${id}`);

  public createIncident = (data: {
    resource_id: string;
    booking_id?: string;
    type: string;
    severity: string;
    description: string;
    evidence_urls?: string[];
  }) => this.request<Incident>('/incidents', { method: 'POST', body: JSON.stringify(data) });

  public updateIncidentStatus = (id: string, data: { status: IncidentStatus; resolution?: string }) =>
    this.request<Incident>(`/incidents/${id}/status`, { method: 'PATCH', body: JSON.stringify(data) });

  public addIncidentComment = (id: string, comment: string) =>
    this.request<IncidentComment>(`/incidents/${id}/comments`, { method: 'POST', body: JSON.stringify({ comment }) });

  public getSignedEvidenceUrl = (id: string, filename: string) =>
    this.request<{ signed_url: string; expires_in_seconds: number }>(`/incidents/${id}/evidence-url?filename=${encodeURIComponent(filename)}`);

  // Notifications
  public listNotifications = (params: Record<string, string | number | boolean | undefined> = {}) => {
    const q = new URLSearchParams();
    Object.entries(params).forEach(([k, v]) => {
      if (v !== undefined) q.append(k, String(v));
    });
    return this.request<{ items: NotificationItem[]; total: number; unread_count: number }>(`/notifications?${q.toString()}`);
  };

  public getUnreadCount = () => this.request<{ unread_count: number }>('/notifications/unread-count');

  public markNotificationRead = (id: string) =>
    this.request<NotificationItem>(`/notifications/${id}/read`, { method: 'PATCH' });

  public markAllNotificationsRead = () =>
    this.request<{ message: string; updated_count: number }>('/notifications/read-all', { method: 'PATCH' });

  // Fairness
  public getFairnessProfile = () => this.request<FairnessProfile>('/fairness/me');

  public updateFairnessWeights = (weights: { wN: number; wD: number; wE: number; wA: number }) =>
    this.request<unknown>('/admin/fairness/weights', { method: 'PUT', body: JSON.stringify(weights) });

  // Admin User Management & Audit
  public listAdminUsers = (params: Record<string, string | number | undefined> = {}) => {
    const q = new URLSearchParams();
    Object.entries(params).forEach(([k, v]) => {
      if (v !== undefined) q.append(k, String(v));
    });
    return this.request<{ items: UserProfile[]; total: number; page: number; size: number }>(`/auth/users?${q.toString()}`);
  };

  public updateUserRole = (userId: string, role: UserRole) =>
    this.request<{ message: string; role: string }>(`/auth/users/${userId}/role`, {
      method: 'PATCH',
      body: JSON.stringify({ role }),
    });

  public verifyUser = (userId: string) =>
    this.request<{ message: string; is_verified: boolean }>(`/auth/users/${userId}/verify`, { method: 'PATCH' });

  public updateUserStatus = (userId: string, is_active: boolean, reason: string) =>
    this.request<{ message: string; is_active: boolean }>(`/auth/users/${userId}/status`, {
      method: 'PATCH',
      body: JSON.stringify({ is_active, reason }),
    });

  public listAuditLogs = (params: Record<string, string | number | undefined> = {}) => {
    const q = new URLSearchParams();
    Object.entries(params).forEach(([k, v]) => {
      if (v !== undefined) q.append(k, String(v));
    });
    return this.request<{ items: unknown[]; total: number; page: number; size: number }>(`/audit?${q.toString()}`);
  };

  // Analytics & Campus Pulse
  public getAnalyticsOverview = () => this.request<AnalyticsOverview>('/analytics/overview');

  public getCampusPulse = (date?: string, hour?: number) => {
    const q = new URLSearchParams();
    if (date) q.append('date', date);
    if (hour !== undefined) q.append('hour', String(hour));
    return this.request<CampusPulseResponse>(`/analytics/campus-pulse?${q.toString()}`);
  };

  // AI Project Buddy Assistant
  public getAiRecommendations = (query: string, timeframe_days: number = 7) =>
    this.request<AiRecommendationResponse>('/ai/recommend', {
      method: 'POST',
      body: JSON.stringify({ query, timeframe_days }),
    });

  public getRecommendedForYou = (limit: number = 4) =>
    this.request<PersonalizedResourceItem[]>(`/ai/recommended-for-you?limit=${limit}`);

  public getSimilarResources = (resourceId: string, limit: number = 4) =>
    this.request<PersonalizedResourceItem[]>(`/ai/similar/${resourceId}?limit=${limit}`);

  // Admin Reset & System
  public resetDemoData = () =>
    this.request<{ message: string }>('/admin/reset-demo-data', { method: 'POST' });

  public pingHealth = () =>
    this.request<{ status: string }>('/health');
}

export const api = new ApiClient();
