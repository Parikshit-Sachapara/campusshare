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
  Copy,
  Check,
  Palette,
  Type,
  Ticket,
  LayoutGrid,
  Sliders,
  CheckCircle2,
  Clock,
  Layers,
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
  useToast,
  Timeline,
  DataTable,
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
  const [activeTab, setActiveTab] = useState<'tokens' | 'typography' | 'passes' | 'components' | 'controls'>('tokens');
  const [copiedHex, setCopiedHex] = useState<string | null>(null);

  // Modal / Drawer demo states
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [isConfirmOpen, setIsConfirmOpen] = useState(false);
  const [isDrawerOpen, setIsDrawerOpen] = useState(false);
  const [selectedSlotId, setSelectedSlotId] = useState<string | null>('slot-2');
  const [textareaVal, setTextareaVal] = useState('Senior Capstone Project: Autonomous multi-agent drone system.');

  const copyToClipboard = (hex: string, label: string) => {
    navigator.clipboard?.writeText(hex);
    setCopiedHex(hex);
    toast.success(`Copied ${label} (${hex}) to clipboard!`);
    setTimeout(() => setCopiedHex(null), 2000);
  };

  const corePalette = [
    { label: 'Oat Canvas (50)', hex: '#FBF9F4', token: '--oat-50', text: '#262422' },
    { label: 'Oat Surface (100)', hex: '#F3EFE6', token: '--oat-100', text: '#262422' },
    { label: 'Oat Border (200)', hex: '#E5DEC9', token: '--oat-200', text: '#262422' },
    { label: 'Ink Dark (900)', hex: '#262422', token: '--ink', text: '#FAF7F0' },
    { label: 'Ink Soft (600)', hex: '#5E5A53', token: '--ink-soft', text: '#FAF7F0' },
    { label: 'Persimmon Primary', hex: '#DD4E25', token: '--persimmon-500', text: '#FFFFFF' },
    { label: 'Persimmon Dark', hex: '#BF3C16', token: '--persimmon-600', text: '#FFFFFF' },
    { label: 'Fern Green', hex: '#3B7A57', token: '--fern-500', text: '#FFFFFF' },
    { label: 'Fern Forest', hex: '#2B583E', token: '--fern-600', text: '#FFFFFF' },
    { label: 'Mulberry Plum', hex: '#7C3048', token: '--mulberry-500', text: '#FFFFFF' },
    { label: 'Lilac Institutional', hex: '#8F85D8', token: '--lilac-500', text: '#FFFFFF' },
    { label: 'Apricot Alert', hex: '#E07A5F', token: '--apricot-500', text: '#FFFFFF' },
  ];

  const demoSlots: TimeSlot[] = [
    { id: 'slot-1', startTime: '09:00', endTime: '10:00', available: true },
    { id: 'slot-2', startTime: '10:00', endTime: '11:00', available: true },
    { id: 'slot-3', startTime: '11:00', endTime: '12:00', available: false, statusLabel: 'Reserved' },
    { id: 'slot-4', startTime: '12:00', endTime: '13:00', available: true },
    { id: 'slot-5', startTime: '13:00', endTime: '14:00', available: false, statusLabel: 'Maintenance' },
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
    <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--space-6)', maxWidth: 1120, margin: '0 auto' }}>
      {/* Header Banner */}
      <div
        style={{
          backgroundColor: 'var(--milk)',
          border: '1.5px solid var(--ink-border)',
          borderRadius: 'var(--radius-card)',
          padding: 'var(--space-5) var(--space-6)',
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
          flexWrap: 'wrap',
          gap: 'var(--space-4)',
        }}
      >
        <div>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 6 }}>
            <span
              style={{
                fontFamily: 'var(--font-mono)',
                fontSize: 'var(--text-xs)',
                color: 'var(--persimmon-600)',
                backgroundColor: 'var(--persimmon-100)',
                padding: '2px 8px',
                borderRadius: 'var(--radius-sm)',
                fontWeight: 700,
                letterSpacing: '0.05em',
              }}
            >
              DESIGN SYSTEM SPECIFICATION
            </span>
            <Badge variant="oat">v2.4 Editorial</Badge>
          </div>
          <h1 style={{ margin: 0, fontSize: 'var(--text-3xl)', color: 'var(--ink)' }}>
            CampusShare <span className="squiggle-word">Design Tokens</span> & Spec
          </h1>
          <p style={{ margin: '6px 0 0', color: 'var(--ink-soft)', fontSize: 'var(--text-sm)', maxWidth: 640 }}>
            Curated visual foundation: Warm Oat (#FBF9F4) canvas, tactile pressed ink, Fraunces editorial serif typography, perforated boarding passes, and stamped status marks.
          </p>
        </div>

        {/* Tab Switcher */}
        <div
          style={{
            display: 'flex',
            backgroundColor: 'var(--oat-100)',
            padding: 4,
            borderRadius: 'var(--radius-full)',
            border: '1.5px solid var(--ink-border)',
            gap: 4,
            flexWrap: 'wrap',
          }}
        >
          {[
            { id: 'tokens', label: 'Color Tokens', icon: <Palette size={14} /> },
            { id: 'typography', label: 'Typography', icon: <Type size={14} /> },
            { id: 'passes', label: 'Passes & Stamps', icon: <Ticket size={14} /> },
            { id: 'components', label: 'Components', icon: <LayoutGrid size={14} /> },
            { id: 'controls', label: 'Interactive Controls', icon: <Sliders size={14} /> },
          ].map((t) => {
            const active = activeTab === t.id;
            return (
              <button
                key={t.id}
                type="button"
                onClick={() => setActiveTab(t.id as any)}
                style={{
                  display: 'inline-flex',
                  alignItems: 'center',
                  gap: 6,
                  padding: '6px 14px',
                  borderRadius: 'var(--radius-full)',
                  border: active ? '1.5px solid var(--ink-border)' : '1.5px solid transparent',
                  backgroundColor: active ? 'var(--milk)' : 'transparent',
                  color: active ? 'var(--ink)' : 'var(--ink-soft)',
                  fontWeight: active ? 700 : 500,
                  fontSize: 'var(--text-xs)',
                  cursor: 'pointer',
                  boxShadow: active ? '0 1px 3px rgba(0,0,0,0.06)' : 'none',
                  transition: 'all 0.15s ease',
                }}
              >
                {t.icon}
                <span>{t.label}</span>
              </button>
            );
          })}
        </div>
      </div>

      {/* TAB 1: COLOR TOKENS */}
      {activeTab === 'tokens' && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--space-5)' }}>
          <div
            style={{
              backgroundColor: 'var(--milk)',
              border: '1.5px solid var(--ink-border)',
              borderRadius: 'var(--radius-card)',
              padding: 'var(--space-5)',
            }}
          >
            <h3 style={{ margin: '0 0 var(--space-2)', fontSize: 'var(--text-lg)', color: 'var(--ink)' }}>
              Brand Color Tokens (Click to Copy HEX)
            </h3>
            <p style={{ margin: '0 0 var(--space-4)', color: 'var(--ink-soft)', fontSize: 'var(--text-xs)' }}>
              Warm canvas Oat replaces cold gray. Strict rule: Zero generic blue, zero pure #000 black, zero yellow gold.
            </p>

            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(200px, 1fr))', gap: 'var(--space-3)' }}>
              {corePalette.map((c) => {
                const isCopied = copiedHex === c.hex;
                return (
                  <div
                    key={c.token}
                    onClick={() => copyToClipboard(c.hex, c.label)}
                    style={{
                      backgroundColor: c.hex,
                      color: c.text,
                      borderRadius: 'var(--radius-md)',
                      border: '1.5px solid var(--ink-border)',
                      padding: 'var(--space-3) var(--space-4)',
                      display: 'flex',
                      flexDirection: 'column',
                      justifyContent: 'space-between',
                      minHeight: 88,
                      cursor: 'pointer',
                      transition: 'transform 0.15s ease, box-shadow 0.15s ease',
                    }}
                    onMouseEnter={(e) => (e.currentTarget.style.transform = 'translateY(-2px)')}
                    onMouseLeave={(e) => (e.currentTarget.style.transform = 'translateY(0)')}
                  >
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                      <span style={{ fontWeight: 700, fontSize: 13 }}>{c.label}</span>
                      {isCopied ? <Check size={14} /> : <Copy size={13} style={{ opacity: 0.6 }} />}
                    </div>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-end', fontSize: 11, fontFamily: 'var(--font-mono)' }}>
                      <span>{c.hex}</span>
                      <span style={{ opacity: 0.75 }}>{c.token}</span>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>

          {/* Utilization Heatmap Gradient */}
          <div
            style={{
              backgroundColor: 'var(--milk)',
              border: '1.5px solid var(--ink-border)',
              borderRadius: 'var(--radius-card)',
              padding: 'var(--space-5)',
            }}
          >
            <h3 style={{ margin: '0 0 var(--space-2)', fontSize: 'var(--text-lg)', color: 'var(--ink)' }}>
              Campus Pulse Heat-Tinted Telemetry Scale
            </h3>
            <p style={{ margin: '0 0 var(--space-3)', color: 'var(--ink-soft)', fontSize: 'var(--text-xs)' }}>
              Real-time resource and spatial floor plan occupancy mapping from idle green to full load mulberry.
            </p>
            <div style={{ display: 'flex', height: 36, borderRadius: 'var(--radius-md)', overflow: 'hidden', border: '1.5px solid var(--ink-border)' }}>
              <div style={{ flex: 1, backgroundColor: 'var(--sage-300)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 11, fontWeight: 700, color: 'var(--ink)' }}>0-25% Idle</div>
              <div style={{ flex: 1, backgroundColor: 'var(--fern-500)', color: '#FFF', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 11, fontWeight: 700 }}>25-50% Light</div>
              <div style={{ flex: 1, backgroundColor: 'var(--apricot-500)', color: '#FFF', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 11, fontWeight: 700 }}>50-75% Moderate</div>
              <div style={{ flex: 1, backgroundColor: 'var(--persimmon-500)', color: '#FFF', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 11, fontWeight: 700 }}>75-90% Peak</div>
              <div style={{ flex: 1, backgroundColor: 'var(--mulberry-500)', color: '#FFF', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 11, fontWeight: 700 }}>90-100% Full</div>
            </div>
          </div>
        </div>
      )}

      {/* TAB 2: TYPOGRAPHY */}
      {activeTab === 'typography' && (
        <div
          style={{
            backgroundColor: 'var(--milk)',
            border: '1.5px solid var(--ink-border)',
            borderRadius: 'var(--radius-card)',
            padding: 'var(--space-6)',
            display: 'flex',
            flexDirection: 'column',
            gap: 'var(--space-5)',
          }}
        >
          <div>
            <h3 style={{ margin: '0 0 var(--space-2)', fontSize: 'var(--text-lg)', color: 'var(--ink)' }}>
              Editorial Type Hierarchy
            </h3>
            <p style={{ margin: '0 0 var(--space-4)', color: 'var(--ink-soft)', fontSize: 'var(--text-xs)' }}>
              Fraunces serif display for institutional warmth paired with Outfit for interface precision and JetBrains Mono for cryptographic telemetry.
            </p>
          </div>

          <div style={{ borderBottom: '1px solid var(--ink-border)', paddingBottom: 'var(--space-4)' }}>
            <div style={{ fontSize: 12, fontFamily: 'var(--font-mono)', color: 'var(--ink-mute)', marginBottom: 4 }}>Display 1 &bull; Fraunces 700 (36px)</div>
            <h1 style={{ margin: 0, fontSize: 36, color: 'var(--ink)', fontFamily: 'var(--font-display)' }}>
              Decentralized <span className="squiggle-word">Equipment Commons</span> for Modern Campus
            </h1>
          </div>

          <div style={{ borderBottom: '1px solid var(--ink-border)', paddingBottom: 'var(--space-4)' }}>
            <div style={{ fontSize: 12, fontFamily: 'var(--font-mono)', color: 'var(--ink-mute)', marginBottom: 4 }}>Section Heading &bull; Fraunces 600 (24px)</div>
            <h2 style={{ margin: 0, fontSize: 24, color: 'var(--ink)', fontFamily: 'var(--font-display)' }}>
              Fairness-Weighted Allocation & Telemetry
            </h2>
          </div>

          <div style={{ borderBottom: '1px solid var(--ink-border)', paddingBottom: 'var(--space-4)' }}>
            <div style={{ fontSize: 12, fontFamily: 'var(--font-mono)', color: 'var(--ink-mute)', marginBottom: 4 }}>Body Text &bull; Outfit 400 (15px)</div>
            <p style={{ margin: 0, fontSize: 15, color: 'var(--ink-soft)', lineHeight: 1.6 }}>
              CampusShare enforces zero double-bookings with transactional row locks and immutable audit event logging. When equipment is returned, condition verification photos and inspection notes are cryptographically linked to preserve historical custody.
            </p>
          </div>

          <div>
            <div style={{ fontSize: 12, fontFamily: 'var(--font-mono)', color: 'var(--ink-mute)', marginBottom: 4 }}>Monospace Metric & Code &bull; JetBrains Mono (13px)</div>
            <code style={{ fontFamily: 'var(--font-mono)', fontSize: 13, backgroundColor: 'var(--oat-100)', padding: '6px 12px', borderRadius: 'var(--radius-sm)', border: '1px solid var(--ink-border)' }}>
              PASS#CS-2026-F981C &bull; PRIORITY: 96/100 (TIER-1) &bull; SHA256: 4f12...e8a9
            </code>
          </div>
        </div>
      )}

      {/* TAB 3: PASSES & STAMPS */}
      {activeTab === 'passes' && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--space-5)' }}>
          {/* Status Stamps */}
          <div
            style={{
              backgroundColor: 'var(--milk)',
              border: '1.5px solid var(--ink-border)',
              borderRadius: 'var(--radius-card)',
              padding: 'var(--space-5)',
            }}
          >
            <h3 style={{ margin: '0 0 var(--space-2)', fontSize: 'var(--text-lg)', color: 'var(--ink)' }}>
              Official Status Stamps (-4° Rotated Ink)
            </h3>
            <p style={{ margin: '0 0 var(--space-4)', color: 'var(--ink-soft)', fontSize: 'var(--text-xs)' }}>
              Tactile physical impression stamps designed to simulate genuine university registrar ink seals.
            </p>

            <div style={{ display: 'flex', flexWrap: 'wrap', gap: 'var(--space-4)' }}>
              {allStatuses.map((st) => (
                <div key={st} style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 6 }}>
                  <StatusStamp status={st} />
                  <span style={{ fontSize: 10, fontFamily: 'var(--font-mono)', color: 'var(--ink-mute)' }}>{st}</span>
                </div>
              ))}
            </div>
          </div>

          {/* Boarding Pass Preview */}
          <div
            style={{
              backgroundColor: 'var(--milk)',
              border: '1.5px solid var(--ink-border)',
              borderRadius: 'var(--radius-card)',
              padding: 'var(--space-5)',
            }}
          >
            <h3 style={{ margin: '0 0 var(--space-2)', fontSize: 'var(--text-lg)', color: 'var(--ink)' }}>
              Signature Digital Boarding Pass
            </h3>
            <p style={{ margin: '0 0 var(--space-4)', color: 'var(--ink-soft)', fontSize: 'var(--text-xs)' }}>
              Perforated split ticket with verification QR, custodial location, student credentials, and physical handover status.
            </p>

            <div style={{ maxWidth: 740 }}>
              <BookingPass
                bookingId="CS-2026-8941B"
                resourceTitle="Sony FX3 Cinema Line Camera Kit"
                category="Photography"
                borrowerName="Aarav Mehta"
                borrowerRole="Student"
                department="Media Arts Center"
                dateStr="Saturday, Nov 01, 2026"
                timeSlot="10:00 – 14:00"
                location="Media Arts Desk B &bull; Custodian: Maya Sen"
                status="APPROVED"
                verificationCode="PASS-8941"
              />
            </div>
          </div>
        </div>
      )}

      {/* TAB 4: COMPONENTS */}
      {activeTab === 'components' && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--space-5)' }}>
          {/* Category SVGs */}
          <div
            style={{
              backgroundColor: 'var(--milk)',
              border: '1.5px solid var(--ink-border)',
              borderRadius: 'var(--radius-card)',
              padding: 'var(--space-5)',
            }}
          >
            <h3 style={{ margin: '0 0 var(--space-2)', fontSize: 'var(--text-lg)', color: 'var(--ink)' }}>
              Hand-Drawn Category Icons
            </h3>
            <p style={{ margin: '0 0 var(--space-4)', color: 'var(--ink-soft)', fontSize: 'var(--text-xs)' }}>
              Custom stroke iconography for all 9 campus faculties and equipment categories.
            </p>

            <div style={{ display: 'flex', flexWrap: 'wrap', gap: 'var(--space-3)' }}>
              {allCategories.map((cat) => (
                <div
                  key={cat}
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    gap: 8,
                    padding: '8px 14px',
                    borderRadius: 'var(--radius-md)',
                    border: '1.5px solid var(--ink-border)',
                    backgroundColor: 'var(--oat-50)',
                    fontSize: 'var(--text-xs)',
                    fontWeight: 600,
                    color: 'var(--ink)',
                  }}
                >
                  <CategoryIcon category={cat} size={18} />
                  <span>{cat}</span>
                </div>
              ))}
            </div>
          </div>

          {/* Resource Cards Grid */}
          <div
            style={{
              backgroundColor: 'var(--milk)',
              border: '1.5px solid var(--ink-border)',
              borderRadius: 'var(--radius-card)',
              padding: 'var(--space-5)',
            }}
          >
            <h3 style={{ margin: '0 0 var(--space-2)', fontSize: 'var(--text-lg)', color: 'var(--ink)' }}>
              Resource Cards with Hand-Crafted Category Badges
            </h3>
            <p style={{ margin: '0 0 var(--space-4)', color: 'var(--ink-soft)', fontSize: 'var(--text-xs)' }}>
              Dynamic stock units counter, custodian badge, hover lift, and direct reservation triggers.
            </p>

            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(300px, 1fr))', gap: 'var(--space-4)' }}>
              <ResourceCard
                id="res-demo-1"
                title="Keysight 4-Ch Digital Oscilloscope"
                category="Electronics"
                department="Electrical & Computer Eng"
                location="Bench 07, Faraday Lab"
                availableQty={4}
                totalQty={4}
                maxDurationHours={3}
                description="1 GHz bandwidth, 5 GSa/s sample rate, with differential probes and logic analyzer pod."
                onRequest={() => toast.info('Reservation modal opened')}
              />

              <ResourceCard
                id="res-demo-2"
                title="NVIDIA RTX 4090 Workstation 04"
                category="Computing"
                department="AI Research Lab"
                location="Turing Hall Rm 302"
                availableQty={0}
                totalQty={3}
                maxDurationHours={8}
                description="24GB VRAM, dual Xeon processors, PyTorch & CUDA 12 environment pre-configured."
                onRequest={() => toast.info('Waitlist join triggered')}
              />
            </div>
          </div>

          {/* Stat Cards with Sparklines */}
          <div
            style={{
              backgroundColor: 'var(--milk)',
              border: '1.5px solid var(--ink-border)',
              borderRadius: 'var(--radius-card)',
              padding: 'var(--space-5)',
            }}
          >
            <h3 style={{ margin: '0 0 var(--space-2)', fontSize: 'var(--text-lg)', color: 'var(--ink)' }}>
              Institutional Stat Cards with Sparklines
            </h3>
            <p style={{ margin: '0 0 var(--space-4)', color: 'var(--ink-soft)', fontSize: 'var(--text-xs)' }}>
              Fraunces editorial metric numbers with trend arrows and SVG sparkline trajectories.
            </p>

            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))', gap: 'var(--space-4)' }}>
              <StatCard
                label="Active Campus Passes"
                value="48"
                delta="+14.2%"
                trend="up"
                sparklineData={[12, 18, 25, 34, 42, 48]}
                note="Issued across 7 facilities"
              />
              <StatCard
                label="Fleet Utilization"
                value="88.4%"
                delta="Peak Load"
                trend="neutral"
                sparklineData={[60, 72, 80, 85, 88]}
                note="Target benchmark: 80%"
              />
              <StatCard
                label="Overdue Alert Rate"
                value="0"
                delta="Zero Violations"
                trend="up"
                sparklineData={[2, 1, 0, 0, 0]}
                note="100% on-time return rate"
              />
            </div>
          </div>

          {/* Priority Score Breakdown */}
          <div
            style={{
              backgroundColor: 'var(--milk)',
              border: '1.5px solid var(--ink-border)',
              borderRadius: 'var(--radius-card)',
              padding: 'var(--space-5)',
            }}
          >
            <h3 style={{ margin: '0 0 var(--space-2)', fontSize: 'var(--text-lg)', color: 'var(--ink)' }}>
              Algorithmic Fairness Priority Breakdown
            </h3>
            <p style={{ margin: '0 0 var(--space-4)', color: 'var(--ink-soft)', fontSize: 'var(--text-xs)' }}>
              Multivariate weighted scoring formula: Need (40%) + Department Standing (20%) + Eligibility (25%) + Academic History (15%).
            </p>

            <PriorityScoreBreakdown
              score={94}
              need={38}
              disadvantage={18}
              efficiency={24}
              accountability={14}
            />
          </div>
        </div>
      )}

      {/* TAB 5: INTERACTIVE CONTROLS */}
      {activeTab === 'controls' && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--space-5)' }}>
          <div
            style={{
              backgroundColor: 'var(--milk)',
              border: '1.5px solid var(--ink-border)',
              borderRadius: 'var(--radius-card)',
              padding: 'var(--space-5)',
            }}
          >
            <h3 style={{ margin: '0 0 var(--space-2)', fontSize: 'var(--text-lg)', color: 'var(--ink)' }}>
              Tactile Button Variants & Overlays
            </h3>
            <p style={{ margin: '0 0 var(--space-4)', color: 'var(--ink-soft)', fontSize: 'var(--text-xs)' }}>
              Primary, secondary, and destructive actions featuring slight pressed-ink depth and tactile drop shadows.
            </p>

            <div style={{ display: 'flex', flexWrap: 'wrap', gap: 'var(--space-3)', alignItems: 'center' }}>
              <Button variant="primary" onClick={() => toast.success('Primary Action Confirmed')}>
                Primary Action
              </Button>
              <Button variant="secondary" onClick={() => toast.info('Secondary Clicked')}>
                Secondary Outline
              </Button>
              <Button variant="danger" onClick={() => toast.error('Destructive Action')}>
                Destructive Action
              </Button>
              <Button variant="primary" loading={true}>
                Loading State
              </Button>
              <Button variant="secondary" onClick={() => setIsModalOpen(true)}>
                Open Modal Preview
              </Button>
              <Button variant="secondary" onClick={() => setIsDrawerOpen(true)}>
                Open Side Drawer
              </Button>
            </div>
          </div>

          {/* Time Slot Selector */}
          <div
            style={{
              backgroundColor: 'var(--milk)',
              border: '1.5px solid var(--ink-border)',
              borderRadius: 'var(--radius-card)',
              padding: 'var(--space-5)',
            }}
          >
            <h3 style={{ margin: '0 0 var(--space-2)', fontSize: 'var(--text-lg)', color: 'var(--ink)' }}>
              Interactive Slot Selector
            </h3>
            <p style={{ margin: '0 0 var(--space-4)', color: 'var(--ink-soft)', fontSize: 'var(--text-xs)' }}>
              Pill slots displaying live availability status and multi-unit capacity indicators.
            </p>

            <TimeSlotPicker
              slots={demoSlots}
              selectedSlotId={selectedSlotId}
              onSelectSlot={(slot) => {
                setSelectedSlotId(slot.id);
                toast.info(`Selected time slot #${slot.id}`);
              }}
            />
          </div>
        </div>
      )}

      {/* Modal Preview */}
      <Modal
        isOpen={isModalOpen}
        onClose={() => setIsModalOpen(false)}
        title="Institutional Verification Modal"
      >
        <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--space-4)' }}>
          <p style={{ margin: 0, color: 'var(--ink-soft)', fontSize: 'var(--text-sm)' }}>
            This modal demonstrates standard confirmation dialogs with Oat canvas styling, rounded radius, and accessible keyboard escape listeners.
          </p>
          <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 'var(--space-3)' }}>
            <Button variant="secondary" onClick={() => setIsModalOpen(false)}>
              Cancel
            </Button>
            <Button
              variant="primary"
              onClick={() => {
                setIsModalOpen(false);
                toast.success('Confirmed from modal!');
              }}
            >
              Confirm Action
            </Button>
          </div>
        </div>
      </Modal>

      {/* Drawer Preview */}
      <Drawer
        isOpen={isDrawerOpen}
        onClose={() => setIsDrawerOpen(false)}
        title="Side Inspection Drawer"
      >
        <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--space-4)' }}>
          <p style={{ margin: 0, color: 'var(--ink-soft)', fontSize: 'var(--text-sm)' }}>
            Used for detailed booking pass inspection, timeline audit streams, and equipment handover verification.
          </p>
          <Button variant="primary" onClick={() => setIsDrawerOpen(false)}>
            Close Drawer
          </Button>
        </div>
      </Drawer>
    </div>
  );
};
