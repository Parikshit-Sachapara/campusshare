import React, { useState } from 'react';
import {
  Compass,
  ArrowRight,
  Search,
  Mail,
  Lock,
  Sparkles,
  Info,
  Calendar,
  AlertTriangle,
} from 'lucide-react';
import {
  Button,
  Input,
  Select,
  Textarea,
  DatePicker,
  TimeSlotPicker,
  TimeSlot,
  Modal,
  ConfirmDialog,
  Drawer,
  Tabs,
  StatusStamp,
  BookingStatus,
  BookingPass,
  ResourceCard,
  StatCard,
  EmptyState,
  Skeleton,
  CardSkeleton,
  useToast,
  Timeline,
  DataTable,
  FileUpload,
  Avatar,
  Badge,
  ProgressBar,
  Tooltip,
  CategoryIcon,
  PriorityScoreBreakdown,
  ResourceCategory,
} from '../components/ui';

export const StyleguidePage: React.FC = () => {
  const toast = useToast();

  // Component States
  const [activeTab, setActiveTab] = useState('all');
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [isConfirmOpen, setIsConfirmOpen] = useState(false);
  const [isDrawerOpen, setIsDrawerOpen] = useState(false);
  const [selectedDate, setSelectedDate] = useState<Date | null>(new Date());
  const [selectedSlotId, setSelectedSlotId] = useState<string | null>('slot-2');
  const [textareaVal, setTextareaVal] = useState('Research project on autonomous swarm robotics.');

  const demoSlots: TimeSlot[] = [
    { id: 'slot-1', startTime: '09:00', endTime: '10:30', available: true },
    { id: 'slot-2', startTime: '10:30', endTime: '12:00', available: true },
    { id: 'slot-3', startTime: '13:00', endTime: '14:30', available: false, statusLabel: 'Reserved' },
    { id: 'slot-4', startTime: '14:30', endTime: '16:00', available: true },
    { id: 'slot-5', startTime: '16:00', endTime: '17:30', available: false, statusLabel: 'Maintenance' },
  ];

  const demoTimeline = [
    { id: 'e-1', timestamp: 'Oct 30, 09:15 AM', title: 'Request Submitted', actor: 'Aarav Sharma (Student)', variant: 'persimmon' as const, description: 'Requested 3.5h GPU cluster block for neural network training.' },
    { id: 'e-2', timestamp: 'Oct 30, 10:00 AM', title: 'Priority Verified', actor: 'System Algorithm', variant: 'fern' as const, description: 'Score computed: 94/100 (Tier 1 Priority).' },
    { id: 'e-3', timestamp: 'Oct 30, 10:45 AM', title: 'Booking Approved', actor: 'Prof. Maya Sen (Owner)', variant: 'fern' as const, description: 'Granted access pass #CS-8921-A.' },
    { id: 'e-4', timestamp: 'Oct 30, 02:00 PM', title: 'Handover Executed', actor: 'Vikram Joshi (Manager)', variant: 'mulberry' as const, description: 'QR verification token validated at Turing Desk B.' },
  ];

  const demoTableData = [
    { id: 'RES-01', title: 'Keysight 4-Ch Digital Oscilloscope', category: 'Electronics', dept: 'EE Lab', qty: '4/4', status: 'AVAILABLE' },
    { id: 'RES-02', title: 'Sony FX3 Cinema Line Camera Kit', category: 'Photography', dept: 'Media Arts', qty: '1/2', status: 'AVAILABLE' },
    { id: 'RES-03', title: 'NVIDIA RTX 4090 Workstation 04', category: 'Computing', dept: 'AI Lab', qty: '0/3', status: 'WAITLIST' },
    { id: 'RES-04', title: 'Formlabs Form 3+ SLA Printer', category: 'Manufacturing', dept: 'Makerspace', qty: '2/2', status: 'AVAILABLE' },
    { id: 'RES-05', title: 'Universal Robotics UR5e Robotic Arm', category: 'Robotics', dept: 'Robotics Lab', qty: '1/1', status: 'AVAILABLE' },
    { id: 'RES-06', title: 'Thermo Fisher Scientific Centrifuge', category: 'Laboratories', dept: 'Bio Eng', qty: '3/3', status: 'AVAILABLE' },
  ];

  const allStatuses: BookingStatus[] = [
    'PENDING',
    'APPROVED',
    'REJECTED',
    'WAITLISTED',
    'CHECKED_OUT',
    'RETURN_PENDING',
    'COMPLETED',
    'CANCELLED',
    'OVERDUE',
    'INCIDENT_REPORTED',
  ];

  const allCategories: ResourceCategory[] = [
    'Computing',
    'Electronics',
    'Robotics',
    'Photography',
    'Laboratories',
    'Classrooms',
    'Audio/Visual',
    'Manufacturing',
    'Sports',
  ];

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--space-10)', paddingBottom: 'var(--space-16)' }}>
      {/* Title */}
      <div>
        <div style={{ display: 'inline-flex', alignItems: 'center', gap: 6, fontSize: 11, fontFamily: 'var(--font-mono)', padding: '3px 8px', borderRadius: 'var(--radius-sm)', backgroundColor: 'var(--lilac-100)', color: 'var(--lilac-500)', marginBottom: 8, border: '1px solid var(--lilac-400)' }}>
          <Sparkles size={13} />
          Internal Design System & Living Component Library
        </div>
        <h1>CampusShare <span className="squiggle-word">Design</span> System</h1>
        <p style={{ marginTop: 6 }}>
          Handcrafted, warm, and distinctive tokens and components built for the 48-hour National Hackathon.
        </p>
      </div>

      {/* 1. Color Palette Tokens */}
      <section style={{ display: 'flex', flexDirection: 'column', gap: 'var(--space-4)' }}>
        <h2>1. Color Tokens & Heatmap Scale</h2>
        <p>No generic SaaS blues or cold purples. Tailored Oat Canvas with Deep Forest Ink and warm earthy accents.</p>

        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(160px, 1fr))', gap: 'var(--space-3)' }}>
          {[
            { name: '--oat-50', hex: '#FBF7EF', label: 'Canvas Oat' },
            { name: '--oat-100', hex: '#F4EDE0', label: 'Sidebar Oat' },
            { name: '--oat-200', hex: '#E8DDC9', label: 'Border Oat' },
            { name: '--milk', hex: '#FFFDF8', label: 'Milk Surface' },
            { name: '--ink', hex: '#1D2B25', label: 'Forest Ink', textLight: true },
            { name: '--persimmon-500', hex: '#E4572E', label: 'Persimmon (Student)', textLight: true },
            { name: '--fern-500', hex: '#3F8F5B', label: 'Fern (Owner)', textLight: true },
            { name: '--mulberry-500', hex: '#7B2D5B', label: 'Mulberry (Manager)', textLight: true },
            { name: '--lilac-400', hex: '#A48BE0', label: 'Lilac (Admin)', textLight: true },
            { name: '--apricot-500', hex: '#F08A3C', label: 'Apricot (Warning)', textLight: true },
            { name: '--cherry-500', hex: '#C22B4B', label: 'Cherry (Danger)', textLight: true },
            { name: '--sage-300', hex: '#B9D3A8', label: 'Sage (Heat 0-25%)' },
          ].map((c) => (
            <div
              key={c.name}
              style={{
                backgroundColor: c.hex,
                color: c.textLight ? '#FFFDF8' : '#1D2B25',
                padding: 'var(--space-4)',
                borderRadius: 'var(--radius-md)',
                border: '1.5px solid var(--ink)',
                boxShadow: '2px 2px 0 var(--ink)',
                display: 'flex',
                flexDirection: 'column',
                justifyContent: 'space-between',
                minHeight: '80px',
              }}
            >
              <span style={{ fontWeight: 700, fontSize: 13 }}>{c.label}</span>
              <span style={{ fontFamily: 'var(--font-mono)', fontSize: 11, opacity: 0.85 }}>{c.hex}</span>
            </div>
          ))}
        </div>

        {/* Heatmap Demonstration */}
        <div style={{ marginTop: 'var(--space-3)' }}>
          <h4 style={{ marginBottom: 8 }}>Utilization Heatmap Scale:</h4>
          <div style={{ display: 'flex', height: 26, borderRadius: 'var(--radius-md)', overflow: 'hidden', border: '1.5px solid var(--ink)' }}>
            <div style={{ flex: 1, backgroundColor: 'var(--sage-300)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 11, fontFamily: 'var(--font-mono)' }}>0-25%</div>
            <div style={{ flex: 1, backgroundColor: 'var(--fern-500)', color: '#FFF', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 11, fontFamily: 'var(--font-mono)' }}>25-50%</div>
            <div style={{ flex: 1, backgroundColor: 'var(--apricot-500)', color: '#FFF', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 11, fontFamily: 'var(--font-mono)' }}>50-75%</div>
            <div style={{ flex: 1, backgroundColor: 'var(--persimmon-500)', color: '#FFF', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 11, fontFamily: 'var(--font-mono)' }}>75-90%</div>
            <div style={{ flex: 1, backgroundColor: 'var(--mulberry-500)', color: '#FFF', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 11, fontFamily: 'var(--font-mono)' }}>90-100%+</div>
          </div>
        </div>
      </section>

      {/* 2. Signature Visual Components */}
      <section style={{ display: 'flex', flexDirection: 'column', gap: 'var(--space-4)' }}>
        <h2>2. Signature Component: Booking Pass (Boarding Pass)</h2>
        <p>Rendered with perforated dashed divider, notched circular cutouts, status stamp, and QR stub.</p>

        <div style={{ maxWidth: 740 }}>
          <BookingPass
            bookingId="CS-9042-B"
            resourceTitle="Universal Robotics UR5e Robotic Arm"
            category="Robotics"
            borrowerName="Aarav Sharma"
            borrowerRole="Student"
            department="Robotics Lab"
            dateStr="Friday, Nov 01"
            timeSlot="10:30 – 14:00"
            location="Mechatronics Building Station 02"
            status="APPROVED"
            verificationCode="PASS-8941"
          />
        </div>
      </section>

      {/* 3. Status Stamps */}
      <section style={{ display: 'flex', flexDirection: 'column', gap: 'var(--space-4)' }}>
        <h2>3. Status Stamps (Rotated -4° Stamped Ink)</h2>
        <p>No generic pill badges. Stamped into the oat canvas with a signature "thud" mount animation.</p>

        <div style={{ display: 'flex', flexWrap: 'wrap', gap: 'var(--space-4)', padding: 'var(--space-4)', backgroundColor: 'var(--milk)', border: 'var(--card-border)', borderRadius: 'var(--radius-card)' }}>
          {allStatuses.map((st) => (
            <div key={st} style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 6 }}>
              <StatusStamp status={st} />
              <span style={{ fontSize: 10, fontFamily: 'var(--font-mono)', color: 'var(--ink-mute)' }}>{st}</span>
            </div>
          ))}
        </div>
      </section>

      {/* 4. Handcrafted Category SVGs & Resource Cards */}
      <section style={{ display: 'flex', flexDirection: 'column', gap: 'var(--space-4)' }}>
        <h2>4. Resource Cards with Hand-Drawn Category Tabs</h2>
        <p>Custom SVG icons for all 9 campus disciplines with stock units and soft-ink hover lift.</p>

        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(300px, 1fr))', gap: 'var(--space-4)' }}>
          <ResourceCard
            id="res-1"
            title="Sony FX3 Cinema Line Camera Kit"
            category="Photography"
            department="Media Arts Center"
            location="Studio A, 2nd Fl"
            availableQty={2}
            totalQty={3}
            maxDurationHours={6}
            description="Full-frame cinema camera with 24-70mm GM II lens, XLR handle unit, and wireless mic kit."
            onRequest={(id) => toast.info(`Request modal opened for ${id}`)}
          />

          <ResourceCard
            id="res-2"
            title="Keysight 4-Ch Digital Oscilloscope"
            category="Electronics"
            department="Electrical & Computer Eng"
            location="Bench 07, Faraday Lab"
            availableQty={4}
            totalQty={4}
            maxDurationHours={3}
            description="1 GHz bandwidth, 5 GSa/s sample rate, with differential probes and logic analyzer pod."
            onRequest={(id) => toast.info(`Request modal opened for ${id}`)}
          />

          <ResourceCard
            id="res-3"
            title="NVIDIA RTX 4090 Workstation 04"
            category="Computing"
            department="AI Research Group"
            location="Turing Hall Rm 302"
            availableQty={0}
            totalQty={3}
            maxDurationHours={8}
            requiresTraining={true}
            trainingName="HPC Cluster Safety"
            description="24GB VRAM, dual Xeon processors, PyTorch & CUDA 12 environment pre-configured."
            onRequest={(id) => toast.warning(`Joined waitlist for ${id}`)}
          />
        </div>

        {/* Category Icons Row */}
        <div style={{ marginTop: 'var(--space-3)' }}>
          <h4 style={{ marginBottom: 8 }}>Hand-Drawn Category SVGs:</h4>
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: 'var(--space-3)' }}>
            {allCategories.map((cat) => (
              <div
                key={cat}
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: 8,
                  padding: '6px 12px',
                  backgroundColor: 'var(--milk)',
                  border: '1.5px solid var(--oat-200)',
                  borderRadius: 'var(--radius-md)',
                  fontSize: 12,
                }}
              >
                <CategoryIcon category={cat} size={18} strokeColor="var(--persimmon-500)" />
                <span>{cat}</span>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* 5. StatCard & Editorial Numbers */}
      <section style={{ display: 'flex', flexDirection: 'column', gap: 'var(--space-4)' }}>
        <h2>5. Stat Cards (Fraunces Editorial Numbers + Sparklines)</h2>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))', gap: 'var(--space-4)' }}>
          <StatCard
            label="Active Bookings"
            value="42"
            delta="+8.4%"
            trend="up"
            sparklineData={[20, 24, 28, 32, 38, 42]}
            note="Across 7 facilities"
          />
          <StatCard
            label="Utilization Rate"
            value="84.6%"
            delta="+12.1%"
            trend="up"
            sparklineData={[60, 65, 72, 78, 80, 84.6]}
            note="Platform target: >80%"
          />
          <StatCard
            label="Overdue Alerts"
            value="0"
            delta="0%"
            trend="neutral"
            sparklineData={[2, 1, 1, 0, 0, 0]}
            note="Zero active violations"
          />
        </div>
      </section>

      {/* 6. Fair Access Breakdown */}
      <section style={{ display: 'flex', flexDirection: 'column', gap: 'var(--space-4)' }}>
        <h2>6. Priority Score Breakdown (Stacked N/D/E/A Bar)</h2>
        <div style={{ maxWidth: 640, backgroundColor: 'var(--milk)', padding: 'var(--space-5)', borderRadius: 'var(--radius-card)', border: 'var(--card-border)', boxShadow: 'var(--card-shadow)' }}>
          <PriorityScoreBreakdown
            need={35}
            disadvantage={25}
            efficiency={20}
            accountability={15}
            maxScore={100}
          />
        </div>
      </section>

      {/* 7. Buttons & Form Components */}
      <section style={{ display: 'flex', flexDirection: 'column', gap: 'var(--space-4)' }}>
        <h2>7. Buttons, Forms & Pickers</h2>

        {/* Buttons */}
        <div style={{ display: 'flex', flexWrap: 'wrap', gap: 'var(--space-3)', alignItems: 'center' }}>
          <Button variant="primary" size="md">Primary Action</Button>
          <Button variant="secondary" size="md">Secondary Outlined</Button>
          <Button variant="ghost" size="md">Ghost Link</Button>
          <Button variant="danger" size="md">Destructive</Button>
          <Button variant="primary" size="md" isLoading>Loading State</Button>
          <Button variant="primary" size="sm">Small</Button>
          <Button variant="primary" size="lg">Large CTA</Button>
        </div>

        {/* Form Controls */}
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(260px, 1fr))', gap: 'var(--space-4)', marginTop: 'var(--space-2)' }}>
          <Input
            label="Resource Search / Query"
            placeholder="e.g. Oscilloscope or 4090"
            leftIcon={<Search size={16} />}
            hint="Type keywords or equipment serial"
          />

          <Input
            label="Borrower College Email"
            placeholder="student@campus.edu"
            leftIcon={<Mail size={16} />}
            error="Only institutional (.edu) email addresses are permitted"
          />

          <Select
            label="Target Campus Department"
            placeholder="Select academic department"
            options={[
              { value: 'eng', label: 'Faculty of Engineering' },
              { value: 'sci', label: 'Faculty of Sciences' },
              { value: 'arts', label: 'Media & Digital Arts' },
              { value: 'med', label: 'Biomedical Labs' },
            ]}
          />

          <Textarea
            label="Project Description & Justification"
            value={textareaVal}
            onChange={(e) => setTextareaVal(e.target.value)}
            maxLength={180}
            showCount
            hint="Evaluated by the equity algorithm"
          />
        </div>

        {/* Date and Time Slot Picker */}
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(320px, 1fr))', gap: 'var(--space-4)', marginTop: 'var(--space-2)' }}>
          <DatePicker
            label="1. Select Reservation Date"
            selectedDate={selectedDate}
            onSelectDate={(d) => {
              setSelectedDate(d);
              toast.info(`Selected date: ${d.toLocaleDateString()}`);
            }}
          />

          <div>
            <TimeSlotPicker
              label="2. Select Booking Time Window"
              slots={demoSlots}
              selectedSlotId={selectedSlotId}
              onSelectSlot={(slot) => {
                setSelectedSlotId(slot.id);
                toast.success(`Selected slot: ${slot.startTime} – ${slot.endTime}`);
              }}
            />
          </div>
        </div>
      </section>

      {/* 8. Modals, ConfirmDialog & Drawer */}
      <section style={{ display: 'flex', flexDirection: 'column', gap: 'var(--space-4)' }}>
        <h2>8. Overlays: Modal, Confirm Dialog & Drawer</h2>
        <div style={{ display: 'flex', gap: 'var(--space-3)', flexWrap: 'wrap' }}>
          <Button variant="secondary" onClick={() => setIsModalOpen(true)}>
            Open Standard Modal
          </Button>

          <Button variant="danger" onClick={() => setIsConfirmOpen(true)}>
            Open Confirm Dialog
          </Button>

          <Button variant="secondary" onClick={() => setIsDrawerOpen(true)}>
            Open Side Drawer
          </Button>
        </div>

        {/* Standard Modal */}
        <Modal
          isOpen={isModalOpen}
          onClose={() => setIsModalOpen(false)}
          title="Reservation Policy & Safety"
          footer={
            <Button variant="primary" onClick={() => setIsModalOpen(false)}>
              I Understand
            </Button>
          }
        >
          <p>
            Resources must be collected within 15 minutes of the slot start time. Handover requires scanning your QR boarding pass with the facility attendant.
          </p>
        </Modal>

        {/* Confirm Dialog */}
        <ConfirmDialog
          isOpen={isConfirmOpen}
          onClose={() => setIsConfirmOpen(false)}
          onConfirm={() => {
            setIsConfirmOpen(false);
            toast.error('Booking #CS-9042 was cancelled.');
          }}
          title="Cancel Reservation?"
          description="Are you sure you want to cancel this booking? The slot will immediately be released to waitlisted researchers."
          confirmLabel="Yes, Cancel Booking"
          isDestructive
        />

        {/* Drawer */}
        <Drawer
          isOpen={isDrawerOpen}
          onClose={() => setIsDrawerOpen(false)}
          title="Filter Campus Inventory"
          footer={
            <Button variant="primary" onClick={() => setIsDrawerOpen(false)}>
              Apply Filters
            </Button>
          }
        >
          <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--space-4)' }}>
            <Select
              label="Category"
              options={allCategories.map((c) => ({ value: c, label: c }))}
            />
            <Input label="Minimum Units Free" type="number" defaultValue="1" />
            <Textarea label="Notes / Special Requirements" placeholder="e.g. Requires fume hood..." />
          </div>
        </Drawer>
      </section>

      {/* 9. Timeline (Travel Itinerary Style) */}
      <section style={{ display: 'flex', flexDirection: 'column', gap: 'var(--space-4)' }}>
        <h2>9. Activity Timeline (Itinerary Style with Fern Nodes)</h2>
        <p>Vertical dotted line with rounded nodes tracking the full audit path.</p>

        <div style={{ maxWidth: 600, backgroundColor: 'var(--milk)', padding: 'var(--space-6)', borderRadius: 'var(--radius-card)', border: 'var(--card-border)', boxShadow: 'var(--card-shadow)' }}>
          <Timeline events={demoTimeline} />
        </div>
      </section>

      {/* 10. Data Table */}
      <section style={{ display: 'flex', flexDirection: 'column', gap: 'var(--space-4)' }}>
        <h2>10. Sortable & Paginated Data Table</h2>
        <DataTable
          data={demoTableData}
          pageSize={4}
          columns={[
            { key: 'id', header: 'Resource Code', sortable: true, render: (r) => <span className="mono" style={{ fontWeight: 600 }}>{r.id}</span> },
            { key: 'title', header: 'Equipment / Space', sortable: true, render: (r) => <strong>{r.title}</strong> },
            { key: 'category', header: 'Category', sortable: true, render: (r) => <Badge variant="oat">{r.category}</Badge> },
            { key: 'dept', header: 'Department' },
            { key: 'qty', header: 'Available Units' },
            {
              key: 'status',
              header: 'Status',
              render: (r) => (
                <Badge variant={r.status === 'AVAILABLE' ? 'fern' : 'apricot'}>
                  {r.status}
                </Badge>
              ),
            },
          ]}
        />
      </section>

      {/* 11. File Upload (Validation & Preview) */}
      <section style={{ display: 'flex', flexDirection: 'column', gap: 'var(--space-4)' }}>
        <h2>11. File Upload Component</h2>
        <p>Client-side MIME type and size limit validation with instant thumbnail preview.</p>
        <div style={{ maxWidth: 520 }}>
          <FileUpload
            label="Upload Proof of Safety Certification (PDF, PNG, JPG max 5MB)"
            maxSizeMb={5}
            onFilesSelected={(files) => {
              if (files.length > 0) {
                toast.success(`Attached ${files.length} document(s)`);
              }
            }}
          />
        </div>
      </section>

      {/* 12. Skeletons & Empty State */}
      <section style={{ display: 'flex', flexDirection: 'column', gap: 'var(--space-4)' }}>
        <h2>12. Loading Skeletons & Friendly Empty State</h2>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(280px, 1fr))', gap: 'var(--space-4)' }}>
          <CardSkeleton />

          <EmptyState
            title="No Active Incidents"
            description="Every resource currently in circulation has passed checkout verification with an intact audit seal."
            actionLabel="Return to Catalog"
            onAction={() => toast.info('Navigating to catalog')}
          />
        </div>
      </section>

      {/* 13. Toast Notification Triggers */}
      <section style={{ display: 'flex', flexDirection: 'column', gap: 'var(--space-4)' }}>
        <h2>13. Toast Notification System</h2>
        <p>Trigger instant feedback alerts anchored to bottom-right with auto-dismiss.</p>
        <div style={{ display: 'flex', gap: 'var(--space-3)', flexWrap: 'wrap' }}>
          <Button variant="primary" onClick={() => toast.success('Booking #CS-9042 successfully approved!')}>
            Fire Success Toast
          </Button>
          <Button variant="danger" onClick={() => toast.error('Prerequisite safety certificate missing.')}>
            Fire Error Toast
          </Button>
          <Button variant="secondary" onClick={() => toast.warning('Resource due for return in 30 minutes.')}>
            Fire Warning Toast
          </Button>
          <Button variant="ghost" onClick={() => toast.info('New resource added to Robotics Lab inventory.')}>
            Fire Info Toast
          </Button>
        </div>
      </section>
    </div>
  );
};
