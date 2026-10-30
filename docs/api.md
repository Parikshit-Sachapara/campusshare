# CampusShare Backend API Documentation & cURL Reference

CampusShare is an institutional resource-sharing platform engineered with FastAPI, PostgreSQL 17, and SQLAlchemy 2.0.
Base URL (Local Development): `http://localhost:8000`

---

## 1. Authentication & Identity (`/auth`)

### 1.1 Student Self-Registration
- **Endpoint**: `POST /auth/register`
- **Security Rule**: Role is forced to `STUDENT` regardless of payload. Automatically verified.
- **Department**: Accepts `department_id` or `dept_id` as a **string** (e.g. `"CS"`, `"ECE"`, `"MECH"`, `"DESIGN"`, `"PHYSICS"`, or department UUID).

```bash
curl -X POST "http://localhost:8000/auth/register" \
  -H "Content-Type: application/json" \
  -d '{
    "email": "riya.sharma@campusshare.demo",
    "password": "Password123!",
    "full_name": "Riya Sharma",
    "dept_id": "CS",
    "student_id": "STU-2026-099",
    "phone": "+91 98765 43210"
  }'
```

---

### 1.2 Resource Owner Registration
- **Endpoint**: `POST /auth/register`
- **Security Rule**: Creates an unverified pending account (`is_verified: false`) that requires ADMIN verification.

```bash
curl -X POST "http://localhost:8000/auth/register" \
  -H "Content-Type: application/json" \
  -d '{
    "email": "dr.kavita@campusshare.demo",
    "password": "Password123!",
    "full_name": "Dr. Kavita Raman",
    "role": "OWNER",
    "phone": "+91 91234 56789"
  }'
```

---

### 1.3 User Login
- **Endpoint**: `POST /auth/login`
- **Protection**: Rate limited to **5 attempts per minute per IP**. Suspended or inactive accounts are rejected with `403 ACCOUNT_SUSPENDED`.
- **Response**: JWT access token (valid for 15 min) + `refreshToken` set in HttpOnly cookie (valid for 7 days).

```bash
curl -X POST "http://localhost:8000/auth/login" \
  -H "Content-Type: application/json" \
  -c cookies.txt \
  -d '{
    "email": "student1@campusshare.demo",
    "password": "Campus@123"
  }'
```

**Response Example:**
```json
{
  "access_token": "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...",
  "token_type": "bearer",
  "expires_in": 900,
  "user": {
    "id": "11111111-1111-1111-1111-111111111101",
    "email": "student1@campusshare.demo",
    "full_name": "Aarav Patel",
    "role": "STUDENT",
    "is_active": true,
    "is_verified": true
  }
}
```

---

### 1.4 Refresh Access Token
- **Endpoint**: `POST /auth/refresh`
- **Authentication**: Accepts explicit JSON `refresh_token` string (from `/auth/login` response) OR automatically uses the 7-day `campusshare_refresh` HttpOnly cookie.

#### Method A: Using JSON Payload (Recommended for Swagger UI / Testing)
```bash
curl -X POST "http://localhost:8000/auth/refresh" \
  -H "Content-Type: application/json" \
  -d '{
    "refresh_token": "<PASTE_REFRESH_TOKEN_FROM_LOGIN_HERE>"
  }'
```

#### Method B: Using Browser / Cookie Jar
```bash
curl -X POST "http://localhost:8000/auth/refresh" \
  -b cookies.txt \
  -H "Content-Type: application/json" \
  -d '{}'
```

---

### 1.5 Get Current User Profile (`/me`)
- **Endpoint**: `GET /auth/me`

```bash
curl -X GET "http://localhost:8000/auth/me" \
  -H "Authorization: Bearer <ACCESS_TOKEN>"
```

---

### 1.6 Update Current User Profile (`/me`)
- **Endpoint**: `PATCH /auth/me`

```bash
curl -X PATCH "http://localhost:8000/auth/me" \
  -H "Authorization: Bearer <ACCESS_TOKEN>" \
  -H "Content-Type: application/json" \
  -d '{
    "phone": "+91 98888 77777",
    "avatar_url": "https://images.unsplash.com/photo-1534528741775-53994a69daeb?auto=format&fit=crop&w=256&q=80"
  }'
```

---

### 1.7 Forgot Password (Dev Mode Flow)
- **Endpoint**: `POST /auth/forgot-password`
- In development, the reset token and mock reset link are printed to the application logs with a clearly marked dev mode banner.

```bash
curl -X POST "http://localhost:8000/auth/forgot-password" \
  -H "Content-Type: application/json" \
  -d '{
    "email": "student1@campusshare.demo"
  }'
```

---

### 1.8 Reset Password
- **Endpoint**: `POST /auth/reset-password`

```bash
curl -X POST "http://localhost:8000/auth/reset-password" \
  -H "Content-Type: application/json" \
  -d '{
    "token": "<RESET_TOKEN_FROM_LOGS>",
    "new_password": "NewStrongPassword456!"
  }'
```

---

## 2. Resources Catalog & Search (`/resources`)

### 2.1 Search & Filter Resources
- **Endpoint**: `GET /resources`
- **Features**: Trigram similarity search (`pg_trgm`), department/category filters, sorting (`popularity`, `recently_added`, `name`), pagination.

```bash
# Keyword search with trigram index
curl -X GET "http://localhost:8000/resources?q=oscilloscope&page=1&page_size=10"

# Filter by resource type and sort by popularity
curl -X GET "http://localhost:8000/resources?resource_type=EQUIPMENT&sort_by=popularity"
```

---

### 2.2 Resource Full Detail & 30-Day Availability
- **Endpoint**: `GET /resources/{id}`
- **Returns**: Full metadata, physical units, usage summary, similar resources, and computed daily status (`free`, `partial`, `full`) for the next 30 days.

```bash
curl -X GET "http://localhost:8000/resources/22222222-2222-2222-2222-222222222201"
```

---

### 2.3 Date-Specific Availability Slots
- **Endpoint**: `GET /resources/{id}/availability?date=YYYY-MM-DD`
- Calculates available windows after subtracting approved bookings, blackout windows, and schedule hours, factoring in equipment units or facility capacity.

```bash
curl -X GET "http://localhost:8000/resources/22222222-2222-2222-2222-222222222201/availability?date=2026-11-02"
```

---

### 2.4 Resource Booking Eligibility Evaluation
- **Endpoint**: `GET /resources/{id}/eligibility`
- **Purpose**: Evaluates current user's role, account standing, prerequisite training certifications, and active borrow limits so the UI can explain exactly why an action is allowed or blocked.

```bash
curl -X GET "http://localhost:8000/resources/22222222-2222-2222-2222-222222222201/eligibility" \
  -H "Authorization: Bearer <ACCESS_TOKEN>"
```

**Response Example:**
```json
{
  "resource_id": "22222222-2222-2222-2222-222222222201",
  "eligible": true,
  "checks": [
    {
      "name": "Account Standing",
      "passed": true,
      "message": "Account in good standing with zero suspension holds."
    },
    {
      "name": "Role Authorization",
      "passed": true,
      "message": "Authorized for your role"
    },
    {
      "name": "Department Enrollment",
      "passed": true,
      "message": "Open cross-campus to all faculties"
    },
    {
      "name": "Safety Certification",
      "passed": true,
      "message": "Verified: DSLR & Studio Production Safety"
    },
    {
      "name": "Active Borrow Limit",
      "passed": true,
      "message": "3/5 active loans in circulation"
    }
  ]
}
```

---

### 2.5 Create Resource (Owner / Manager / Admin)
- **Endpoint**: `POST /resources`

```bash
curl -X POST "http://localhost:8000/resources" \
  -H "Authorization: Bearer <OWNER_TOKEN>" \
  -H "Content-Type: application/json" \
  -d '{
    "name": "Sony FX3 Cinema Camera Kit",
    "description": "Full-frame cinema line camera with XLR top handle and 24-70mm f/2.8 GM lens.",
    "category_id": "33333333-3333-3333-3333-333333333303",
    "department_id": "44444444-4444-4444-4444-444444444404",
    "location": "Media Production Studio - Audio Booth 1",
    "resource_type": "EQUIPMENT",
    "quantity": 2,
    "deposit_amount": 1000.00,
    "approval_required": true,
    "training_required": true,
    "is_restricted": false,
    "condition_note": "Brand new condition.",
    "specifications": {
      "sensor": "Full-Frame 12.1MP Exmor R",
      "recording": "4K 120p 10-bit 4:2:2",
      "mount": "Sony E-Mount"
    }
  }'
```

---

### 2.6 Multi-Image Upload
- **Endpoint**: `POST /resources/{id}/images`
- Validates file formats (`jpg`, `jpeg`, `png`, `webp`) and maximum file size (5MB per image).

```bash
curl -X POST "http://localhost:8000/resources/22222222-2222-2222-2222-222222222201/images" \
  -H "Authorization: Bearer <OWNER_TOKEN>" \
  -F "files=@/path/to/dslr_front.webp" \
  -F "files=@/path/to/dslr_accessories.jpg"
```

---

### 2.7 Soft Archive Resource
- **Endpoint**: `DELETE /resources/{id}`
- Preserves referential integrity; changes status to `ARCHIVED` without destructive cascades.

```bash
curl -X DELETE "http://localhost:8000/resources/22222222-2222-2222-2222-222222222201" \
  -H "Authorization: Bearer <ADMIN_OR_OWNER_TOKEN>"
```

---

## 3. Categories & Departments (`/categories`, `/departments`)

### 3.1 List All Resource Categories
```bash
curl -X GET "http://localhost:8000/categories"
```

### 3.2 List All Academic Departments
```bash
curl -X GET "http://localhost:8000/departments"
```

---

## 4. Bookings & Core Reservation Engine (`/bookings`)

### 4.1 Live Dry-Run Eligibility Validation
- **Endpoint**: `POST /bookings/validate`
- **Purpose**: Real-time frontend form validation displaying all 14 ordered checks, first failing message, priority preview, and suggested alternate slots.
```bash
curl -X POST "http://localhost:8000/bookings/validate" \
  -H "Authorization: Bearer <STUDENT_TOKEN>" \
  -H "Content-Type: application/json" \
  -d '{
    "resource_id": "<RESOURCE_UUID>",
    "start_ts": "2026-11-03T10:00:00Z",
    "end_ts": "2026-11-03T11:00:00Z",
    "attendees": 1,
    "purpose": "IoT sensor testing for senior capstone research project",
    "project_name": "Smart Campus IoT"
  }'
```

### 4.2 Create Booking
- **Endpoint**: `POST /bookings`
- **Headers**: Supports `Idempotency-Key` for duplicate-submit protection.
- **Transaction**: Executed in single atomic transaction with `SELECT ... FOR UPDATE` (facility) or `FOR UPDATE SKIP LOCKED` (free physical unit). Auto-approves if `approval_required=false` and `is_restricted=false`.
```bash
curl -X POST "http://localhost:8000/bookings" \
  -H "Authorization: Bearer <STUDENT_TOKEN>" \
  -H "Idempotency-Key: e8d4f790-23a1-4d10-8fa0-109012a67bc4" \
  -H "Content-Type: application/json" \
  -d '{
    "resource_id": "<RESOURCE_UUID>",
    "start_ts": "2026-11-03T10:00:00Z",
    "end_ts": "2026-11-03T11:00:00Z",
    "attendees": 1,
    "purpose": "Hardware sensor testing for senior capstone research project",
    "project_name": "IoT Campus Sensing"
  }'
```

### 4.3 Student My Bookings
- **Endpoint**: `GET /bookings/me?status=APPROVED&page=1&page_size=10`
```bash
curl -X GET "http://localhost:8000/bookings/me" \
  -H "Authorization: Bearer <STUDENT_TOKEN>"
```

### 4.4 Booking Details with Audit Timeline
- **Endpoint**: `GET /bookings/{id}`
- **Features**: Includes full audit timeline (`audit_logs`) and live eligibility breakdown.
```bash
curl -X GET "http://localhost:8000/bookings/<BOOKING_UUID>" \
  -H "Authorization: Bearer <TOKEN>"
```

### 4.5 Cancel Booking
- **Endpoint**: `POST /bookings/{id}/cancel`
- **Features**: Transitions booking to `CANCELLED`, frees physical unit/slot, and triggers waiting list slot redistribution.
```bash
curl -X POST "http://localhost:8000/bookings/<BOOKING_UUID>/cancel" \
  -H "Authorization: Bearer <TOKEN>" \
  -H "Content-Type: application/json" \
  -d '{"reason": "Conflict with academic schedule"}'
```

### 4.6 Priority Score Override (Manager / Admin)
- **Endpoint**: `POST /bookings/{id}/override-priority`
```bash
curl -X POST "http://localhost:8000/bookings/<BOOKING_UUID>/override-priority" \
  -H "Authorization: Bearer <MANAGER_OR_ADMIN_TOKEN>" \
  -H "Content-Type: application/json" \
  -d '{"priority_score": 98.5, "reason": "Institutional Dean special research directive"}'
```

---

## 5. Approvals & Triage Workflow (`/approvals`, `/bookings/{id}/...`)

### 5.1 Scoped Approvals Queue
- **Endpoint**: `GET /approvals/queue`
- **Scoping**:
  - `OWNER`: Resources owned by current user
  - `MANAGER`: Resources in user's academic department or restricted items
  - `ADMIN`: Institutional cross-department queue
- **Sorting**: Priority Score `DESC`, Created At `ASC`.
```bash
curl -X GET "http://localhost:8000/approvals/queue" \
  -H "Authorization: Bearer <OWNER_OR_MANAGER_TOKEN>"
```

### 5.2 Approve Booking
- **Endpoint**: `POST /bookings/{id}/approve`
- **Features**: Optimistic concurrency guard, auto unit assignment, overlap check, student notification. Duplicate calls are idempotent-safe.
```bash
curl -X POST "http://localhost:8000/bookings/<BOOKING_UUID>/approve" \
  -H "Authorization: Bearer <APPROVER_TOKEN>"
```

### 5.3 Reject Booking
- **Endpoint**: `POST /bookings/{id}/reject`
```bash
curl -X POST "http://localhost:8000/bookings/<BOOKING_UUID>/reject" \
  -H "Authorization: Bearer <APPROVER_TOKEN>" \
  -H "Content-Type: application/json" \
  -d '{"reason": "Equipment reserved for scheduled maintenance"}'
```

### 5.4 Suggest Alternative Slot
- **Endpoint**: `POST /bookings/{id}/suggest-alternative`
```bash
curl -X POST "http://localhost:8000/bookings/<BOOKING_UUID>/suggest-alternative" \
  -H "Authorization: Bearer <APPROVER_TOKEN>" \
  -H "Content-Type: application/json" \
  -d '{
    "alternative_start_ts": "2026-11-03T14:00:00Z",
    "alternative_end_ts": "2026-11-03T15:00:00Z",
    "note": "Morning slot is fully booked for lab maintenance"
  }'
```

### 5.5 Accept Alternative Slot (Student)
- **Endpoint**: `POST /bookings/{id}/accept-alternative`
```bash
curl -X POST "http://localhost:8000/bookings/<BOOKING_UUID>/accept-alternative" \
  -H "Authorization: Bearer <STUDENT_TOKEN>"
```

---

## 6. Waiting List & Slot Redistribution (`/waitlist`)

### 6.1 Join Waitlist
- **Endpoint**: `POST /waitlist`
```bash
curl -X POST "http://localhost:8000/waitlist" \
  -H "Authorization: Bearer <STUDENT_TOKEN>" \
  -H "Content-Type: application/json" \
  -d '{
    "resource_id": "<RESOURCE_UUID>",
    "desired_start_ts": "2026-11-03T10:00:00Z",
    "desired_end_ts": "2026-11-03T11:00:00Z"
  }'
```

### 6.2 View My Waitlist (With Live Calculated Queue Position)
- **Endpoint**: `GET /waitlist/me`
```bash
curl -X GET "http://localhost:8000/waitlist/me" \
  -H "Authorization: Bearer <STUDENT_TOKEN>"
```

### 6.3 Accept Waitlist Slot Offer
- **Endpoint**: `POST /waitlist/{id}/accept`
```bash
curl -X POST "http://localhost:8000/waitlist/<WAITLIST_UUID>/accept" \
  -H "Authorization: Bearer <STUDENT_TOKEN>"
```

---

## 7. Fairness Standing & Institutional Governance (`/fairness`, `/admin`)

### 7.1 View Student Fairness Profile
- **Endpoint**: `GET /fairness/me`
- **Response**: Current standing, no-shows, usage vs limits, and priority formula explanation.
```bash
curl -X GET "http://localhost:8000/fairness/me" \
  -H "Authorization: Bearer <STUDENT_TOKEN>"
```

### 7.2 Update Priority Formula Weights (Admin)
- **Endpoint**: `PUT /admin/fairness/weights`
- **Validation**: `wN + wD + wE + wA == 100%`.
```bash
curl -X PUT "http://localhost:8000/admin/fairness/weights" \
  -H "Authorization: Bearer <ADMIN_TOKEN>" \
  -H "Content-Type: application/json" \
  -d '{
    "wN": 40.0,
    "wD": 30.0,
    "wE": 20.0,
    "wA": 10.0
  }'
```

---

## 8. Health & OpenAPI

### 8.1 System & Database Health Check
- **Endpoint**: `GET /health`

```bash
curl -X GET "http://localhost:8000/health"
```

### 8.2 Interactive Swagger UI
Open in browser:
- Swagger UI: `http://localhost:8000/docs`
- ReDoc: `http://localhost:8000/redoc`

---

## 9. Accountability: Physical Handover & Returns (`/bookings/{id}`)

### 9.1 Equipment Handover (Check-Out)
- **Endpoint**: `POST /bookings/{id}/checkout`
- **Authorized Roles**: `OWNER`, `MANAGER`, `ADMIN`
- **Preconditions**: Booking status must be `APPROVED` and within start window (+/- 30 min).
- **Validation**: Accepts student booking code or cryptographic QR token. Records unit condition (up to 6 photos) and confirms student handover.

```bash
curl -X POST "http://localhost:8000/bookings/<BOOKING_UUID>/checkout" \
  -H "Authorization: Bearer <OWNER_TOKEN>" \
  -H "Content-Type: application/json" \
  -d '{
    "booking_code_or_token": "BK-2026-ABC123XY",
    "condition": "EXCELLENT",
    "notes": "Battery fully charged. Handed over with carrying case and 50mm lens.",
    "photo_urls": ["https://uploads.campusshare.internal/pickup_front.jpg"],
    "confirmed_in_person": true
  }'
```

### 9.2 Facility Check-in & Occupancy Recording
- **Endpoint**: `POST /bookings/{id}/checkin-occupancy`
- **Authorized Roles**: `STUDENT` (booking owner), `OWNER`, `MANAGER`, `ADMIN`

```bash
curl -X POST "http://localhost:8000/bookings/<BOOKING_UUID>/checkin-occupancy" \
  -H "Authorization: Bearer <STUDENT_TOKEN>" \
  -H "Content-Type: application/json" \
  -d '{
    "headcount": 14,
    "room_condition": "GOOD",
    "notes": "Projector powered on; whiteboard markers present"
  }'
```

### 9.3 Student Return Submission
- **Endpoint**: `POST /bookings/{id}/return`
- **Authorized Roles**: `STUDENT` (booking owner)
- **Status Transition**: Moves booking to `RETURN_PENDING`.

```bash
curl -X POST "http://localhost:8000/bookings/<BOOKING_UUID>/return" \
  -H "Authorization: Bearer <STUDENT_TOKEN>" \
  -H "Content-Type: application/json" \
  -d '{
    "notes": "Camera returned with lens cap, 2 batteries, and 64GB SD card in side pouch.",
    "photo_urls": ["https://uploads.campusshare.internal/return_front.jpg"]
  }'
```

### 9.4 Owner Return Verification & Inspection
- **Endpoint**: `POST /bookings/{id}/verify-return`
- **Authorized Roles**: Resource `OWNER`, `MANAGER`, `ADMIN`
- **Behavior**: Returns pickup vs return comparison side-by-side. If `damage_observed: true` or `DAMAGED`, automatically generates an `Incident` in the same transaction, updates unit status to inactive/damaged, and sets booking to `INCIDENT_REPORTED`. If clean, marks `COMPLETED`.

```bash
curl -X POST "http://localhost:8000/bookings/<BOOKING_UUID>/verify-return" \
  -H "Authorization: Bearer <OWNER_TOKEN>" \
  -H "Content-Type: application/json" \
  -d '{
    "final_condition": "EXCELLENT",
    "notes": "Inspection complete. Sensor clean, no defects.",
    "damage_observed": false,
    "item_missing": false
  }'
```

---

## 10. Incidents & Privacy-Preserving Evidence (`/incidents`)

### 10.1 Report Incident
- **Endpoint**: `POST /incidents`
- **Authorized Roles**: `STUDENT` (own booking), `OWNER`, `MANAGER`, `ADMIN`

```bash
curl -X POST "http://localhost:8000/incidents" \
  -H "Authorization: Bearer <STUDENT_TOKEN>" \
  -H "Content-Type: application/json" \
  -d '{
    "booking_id": "<BOOKING_UUID>",
    "resource_id": "<RESOURCE_UUID>",
    "type": "DAMAGE",
    "severity": "HIGH",
    "description": "Tripod mount bracket snapped during controlled studio shoot.",
    "evidence_urls": ["tripod_crack_closeup.jpg"]
  }'
```

### 10.2 Incident Lifecycle & Resolution
- **Endpoint**: `PATCH /incidents/{id}/status`
- **Lifecycle**: `REPORTED -> UNDER_REVIEW -> INVESTIGATING -> RESOLVED -> CLOSED`
- **Security Rule**: Only `MANAGER` or `ADMIN` can set `RESOLVED` or `CLOSED`, and `resolution` explanation is strictly required.

```bash
curl -X PATCH "http://localhost:8000/incidents/<INCIDENT_UUID>/status" \
  -H "Authorization: Bearer <MANAGER_TOKEN>" \
  -H "Content-Type: application/json" \
  -d '{
    "status": "RESOLVED",
    "resolution": "Manufacturer warranty covered the mount repair; student cleared of malice."
  }'
```

### 10.3 Confidential Evidence Signed URL (5-Minute Expiry)
- **Endpoint**: `GET /incidents/{id}/evidence-url?filename=...`
- **Access Control**: Strictly restricted to reporter, resource owner, involved student, managers, and admins.

```bash
curl -X GET "http://localhost:8000/incidents/<INCIDENT_UUID>/evidence-url?filename=tripod_crack_closeup.jpg" \
  -H "Authorization: Bearer <OWNER_TOKEN>"
```

---

## 11. Real-Time Notification Center (`/notifications`)

### 11.1 Polling Unread Count (Polled Every 15s)
- **Endpoint**: `GET /notifications/unread-count`
- **Response**: `{"unread_count": 3}`

```bash
curl -X GET "http://localhost:8000/notifications/unread-count" \
  -H "Authorization: Bearer <STUDENT_TOKEN>"
```

### 11.2 Paginated Notifications & Mark as Read
- **List Notifications**: `GET /notifications?page=1&size=20&unread_only=false`
- **Mark Single Read**: `PATCH /notifications/<NOTIF_UUID>/read`
- **Mark All Read**: `PATCH /notifications/read-all`

```bash
curl -X PATCH "http://localhost:8000/notifications/read-all" \
  -H "Authorization: Bearer <STUDENT_TOKEN>"
```

---

## 12. Immutability & Audit Trails (`/audit`, `/bookings/{id}/timeline`)

### 12.1 Human-Readable Booking Narrative Timeline
- **Endpoint**: `GET /bookings/{id}/timeline`
- **Security**: Accessible to the student, resource owner, manager, and admin.
- **Output**: Chronological prose stories (e.g., *"Aarav Mehta requested the booking"*, *"Equipment handed over to student in EXCELLENT condition by Lab Manager"*).

```bash
curl -X GET "http://localhost:8000/bookings/<BOOKING_UUID>/timeline" \
  -H "Authorization: Bearer <STUDENT_TOKEN>"
```

### 12.2 Institutional Audit Log Search & CSV Export (Admin Only)
- **Endpoint**: `GET /audit`
- **Query Params**: `actor_id`, `action`, `entity_type`, `date_from`, `date_to`, `export=csv`
- **Database Guarantee**: PostgreSQL database trigger strictly enforces append-only security (DELETE or UPDATE operations raise exceptions).

```bash
curl -X GET "http://localhost:8000/audit?export=csv" \
  -H "Authorization: Bearer <ADMIN_TOKEN>" \
  --output campusshare_audit_trail.csv
```
