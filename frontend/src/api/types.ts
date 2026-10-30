// TypeScript interfaces matching CampusShare backend schemas

export type UserRole = 'STUDENT' | 'OWNER' | 'MANAGER' | 'ADMIN';
export type ResourceType = 'EQUIPMENT' | 'FACILITY';
export type ResourceStatus = 'AVAILABLE' | 'MAINTENANCE' | 'ARCHIVED';
export type BookingStatus =
  | 'PENDING'
  | 'APPROVED'
  | 'REJECTED'
  | 'CANCELLED'
  | 'CHECKED_OUT'
  | 'RETURN_PENDING'
  | 'COMPLETED'
  | 'INCIDENT_REPORTED'
  | 'OVERDUE'
  | 'WAITLISTED';

export type UnitCondition = 'EXCELLENT' | 'GOOD' | 'FAIR' | 'DAMAGED';
export type IncidentStatus = 'REPORTED' | 'UNDER_REVIEW' | 'INVESTIGATING' | 'RESOLVED' | 'CLOSED';
export type IncidentSeverity = 'LOW' | 'MEDIUM' | 'HIGH' | 'CRITICAL';
export type IncidentType = 'DAMAGE' | 'LATE_RETURN' | 'LOSS' | 'POLICY_VIOLATION' | 'SAFETY_HAZARD';

export interface UserProfile {
  id: string;
  email: string;
  full_name: string;
  role: UserRole;
  department_id?: string;
  dept_id?: string;
  student_id?: string;
  phone?: string;
  is_active: boolean;
  is_verified: boolean;
  no_show_count: number;
  created_at: string;
}

export interface Department {
  id: string;
  name: string;
  code: string;
  description?: string;
}

export interface ResourceCategory {
  id: string;
  name: string;
  icon_key: string;
  sort_order: number;
}

export interface ResourceUnit {
  id: string;
  resource_id: string;
  unit_code: string;
  condition: UnitCondition;
  is_active: boolean;
  last_inspected_at?: string;
}

export interface ResourceImage {
  id: string;
  image_url?: string;
  url?: string;
  is_primary: boolean;
  sort_order: number;
}

export interface ResourceItem {
  id: string;
  name: string;
  description?: string;
  category_id: string;
  category_name?: string;
  department_id: string;
  department_code?: string;
  owner_id: string;
  owner_name?: string;
  location: string;
  resource_type: ResourceType;
  quantity: number;
  available_quantity: number;
  capacity?: number;
  status: ResourceStatus;
  deposit_amount: number;
  approval_required: boolean;
  training_required: boolean;
  is_restricted: boolean;
  min_booking_minutes?: number;
  max_booking_minutes?: number;
  slot_minutes?: number;
  advance_booking_days?: number;
  popularity_count: number;
  primary_image_url?: string;
  images?: ResourceImage[];
  units?: ResourceUnit[];
  rule?: {
    min_duration_minutes?: number;
    max_duration_minutes?: number;
    advance_booking_days?: number;
    cancellation_deadline_hours?: number;
  };
}

export interface EligibilityItem {
  key: string;
  name: string;
  passed: boolean;
  reason?: string;
}

export interface EligibilityEvaluation {
  eligible: boolean;
  first_failing_reason?: string;
  completed_items_count: number;
  total_required_items: number;
  checks: EligibilityItem[];
}

export interface PriorityScoreBreakdown {
  score: number;
  breakdown: {
    N: { value: number; weighted: number; reason: string };
    D: { value: number; weighted: number; reason: string };
    E: { value: number; weighted: number; reason: string };
    A: { value: number; weighted: number; reason: string };
  };
}

export interface Booking {
  id: string;
  booking_code: string;
  resource_id: string;
  resource_name?: string;
  resource_type?: ResourceType;
  location?: string;
  student_id: string;
  student_name?: string;
  student_email?: string;
  unit_id?: string;
  unit_code?: string;
  start_ts: string;
  end_ts: string;
  status: BookingStatus;
  purpose: string;
  project_name?: string;
  attendees: number;
  priority_score: number;
  priority_breakdown?: PriorityScoreBreakdown['breakdown'];
  created_at: string;
  collected_at?: string;
  returned_at?: string;
  cancellation_reason?: string;
  rejection_reason?: string;
  qr_token?: string;
}

export interface TimelineItem {
  id: string;
  action: string;
  actor_name: string;
  actor_role: string;
  timestamp: string;
  narrative: string;
  metadata?: Record<string, unknown>;
}

export interface Incident {
  id: string;
  booking_id?: string;
  resource_id: string;
  resource_name?: string;
  reporter_id: string;
  reporter_name?: string;
  type: IncidentType;
  severity: IncidentSeverity;
  description: string;
  status: IncidentStatus;
  resolution?: string;
  evidence_urls: string[];
  created_at: string;
  comments?: IncidentComment[];
}

export interface IncidentComment {
  id: string;
  incident_id: string;
  author_id: string;
  author_name: string;
  author_role: UserRole;
  comment: string;
  created_at: string;
}

export interface NotificationItem {
  id: string;
  user_id: string;
  type: string;
  title: string;
  body: string;
  link?: string;
  is_read: boolean;
  created_at: string;
}

export interface WaitlistEntry {
  id: string;
  resource_id: string;
  resource_name?: string;
  student_id: string;
  desired_start: string;
  desired_end: string;
  status: 'WAITING' | 'OFFERED' | 'ACCEPTED' | 'EXPIRED' | 'CANCELLED';
  priority_score: number;
  position: number;
  offer_expires_at?: string;
  created_at: string;
}

export interface FairnessProfile {
  user_id: string;
  standing_score: number;
  no_show_count: number;
  usage_this_month: number;
  monthly_limit: number;
  active_bookings_count: number;
  max_active_bookings: number;
  formula_weights: {
    wN: number;
    wD: number;
    wE: number;
    wA: number;
  };
  explanation: string;
}

export interface PublicStats {
  total_resources: number;
  total_bookings: number;
  active_users: number;
  departments_count: number;
  categories_count: number;
  utilization_rate: number;
  avg_booking_duration_hours: number;
  satisfaction_rate: number;
}

export interface AnalyticsOverview {
  totals: {
    users: number;
    resources: number;
    available_resources: number;
    active_bookings: number;
    pending_bookings: number;
    completed_bookings: number;
    overdue_bookings: number;
    total_incidents: number;
  };
  no_show_rate: number;
  avg_approval_minutes: number;
  status_distribution: Array<{ status: string; count: number }>;
  most_used_resources: Array<{
    id: string;
    name: string;
    dept: string;
    booking_count: number;
    booked_hours: number;
  }>;
  least_used_resources: Array<{
    id: string;
    name: string;
    dept: string;
    booking_count: number;
    booked_hours: number;
  }>;
  monthly_trend: Array<{
    month: string;
    bookings: number;
    completed: number;
    hours: number;
  }>;
  department_utilization: Array<{
    id: string;
    code: string;
    name: string;
    utilization_pct: number | null;
    booked_hours?: number;
    available_hours?: number;
    status: string;
  }>;
  peak_hours_grid: Array<{
    day: string;
    day_idx: number;
    hour: number;
    label: string;
    intensity: number;
  }>;
}

export interface CampusPulseUpcomingBooking {
  id: string;
  start_time: string;
  end_time: string;
  purpose: string;
  project_name: string;
  user_name: string;
  attendees: number;
  capacity: number;
  status: string;
}

export interface CampusPulseRoom {
  id: string;
  name: string;
  short_name: string;
  block: string;
  floor: string;
  capacity: number;
  current_attendees: number;
  utilization_pct: number;
  color_token: 'sage' | 'fern' | 'apricot' | 'persimmon' | 'mulberry';
  hex_fill: string;
  status_label: string;
  map_x: number;
  map_y: number;
  map_w: number;
  map_h: number;
  resource_id?: string | null;
  upcoming_bookings: CampusPulseUpcomingBooking[];
}

export interface CampusPulseResponse {
  target_date: string;
  hour: number;
  hour_label: string;
  blocks: string[];
  rooms: CampusPulseRoom[];
}

export interface AiRecommendationNeed {
  keyword: string;
  category: string;
  priority: 'high' | 'medium' | 'low';
}

export interface AiRecommendationItem {
  id: string;
  name: string;
  category: string;
  department: string;
  location: string;
  type: string;
  image_url?: string | null;
  score: number;
  reason: string;
  is_eligible: boolean;
  eligibility_note: string;
  is_available: boolean;
  next_free_slot?: {
    start: string;
    end: string;
    start_iso: string;
    end_iso: string;
  } | null;
  requires_approval: boolean;
  requires_training: boolean;
}

export interface AiRecommendationResponse {
  query: string;
  badge: 'Smart matching' | 'AI-assisted';
  mode: 'ai' | 'deterministic';
  needs: AiRecommendationNeed[];
  recommendations: AiRecommendationItem[];
  alternatives: AiRecommendationItem[];
  cached_at: string;
}

export interface PersonalizedResourceItem {
  id: string;
  name: string;
  category: string;
  department: string;
  location: string;
  type: string;
  image_url?: string | null;
  deposit_amount: number;
  approval_required: boolean;
  requires_training: boolean;
  match_reason: string;
}


