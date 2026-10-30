import React from 'react';
import { Link } from 'react-router-dom';
import {
  Compass,
  ArrowRight,
  ShieldCheck,
  CheckCircle2,
  XCircle,
  QrCode,
  FileCheck2,
  Clock,
  Sparkles,
} from 'lucide-react';
import {
  Button,
  BookingPass,
  ResourceCard,
  StatCard,
  PriorityScoreBreakdown,
  CategoryIcon,
  ResourceCategory,
} from '../components/ui';
import styles from './LandingPage.module.css';

export const LandingPage: React.FC = () => {
  const categories: { name: ResourceCategory; count: string; desc: string }[] = [
    { name: 'Computing', count: '42 Units', desc: 'GPU Workstations, AI Clusters & HPC nodes' },
    { name: 'Electronics', count: '68 Units', desc: 'Oscilloscopes, Soldering Stations, Logic Analyzers' },
    { name: 'Robotics', count: '29 Units', desc: 'Manipulator Arms, Quadrotors & SLAM Kits' },
    { name: 'Photography', count: '35 Units', desc: 'Cinema Cameras, Studio Lighting & Prime Lenses' },
    { name: 'Laboratories', count: '18 Facilities', desc: 'Spectrophotometers, Centrifuges & Fume Hoods' },
    { name: 'Classrooms', count: '24 Spaces', desc: 'Smart Seminar Rooms & Tiered Lecture Theatres' },
    { name: 'Audio/Visual', count: '52 Units', desc: 'Wireless Microphones, Mixers & Stage Projectors' },
    { name: 'Manufacturing', count: '16 Machines', desc: '3D SLA Printers, CNC Mills & Laser Cutters' },
    { name: 'Sports', count: '30 Kits', desc: 'Performance Trackers & Tournament Gear' },
  ];

  return (
    <div className={styles.landing}>
      {/* Navigation */}
      <header className={styles.nav}>
        <Link to="/" className={styles.brand}>
          <div className={styles.logoBadge}>CS</div>
          <span className={styles.brandName}>CampusShare</span>
        </Link>

        <nav className={styles.navLinks}>
          <a href="#how-it-works" className={styles.navLink}>How it Works</a>
          <a href="#categories" className={styles.navLink}>Categories</a>
          <a href="#fairness" className={styles.navLink}>Fair by Design</a>
          <a href="#stats" className={styles.navLink}>Platform Metrics</a>
          <Link to="/styleguide" className={styles.navLink}>Styleguide</Link>
        </nav>

        <div style={{ display: 'flex', gap: 10 }}>
          <Link to="/dashboard">
            <Button variant="secondary" size="sm">
              Log In
            </Button>
          </Link>
          <Link to="/dashboard">
            <Button variant="primary" size="sm" rightIcon={<ArrowRight size={14} />}>
              Open Portal
            </Button>
          </Link>
        </div>
      </header>

      {/* Hero Section */}
      <section className={styles.heroSection}>
        <div className={styles.heroContent}>
          <div className={styles.pillTagline}>
            <Sparkles size={13} />
            Every Resource Deserves Utilization. Every User Deserves Fair Access.
          </div>

          <h1 className={styles.headline}>
            Unlock Your <span className="squiggle-word">Campus</span> Resources.
          </h1>

          <p className={styles.subtext}>
            Discover, access, and share institutional equipment and facilities through one intelligent, transparent, and secure campus ecosystem.
          </p>

          <div className={styles.heroCtas}>
            <Link to="/resources">
              <Button variant="primary" size="lg" leftIcon={<Compass size={18} />}>
                Explore Resources
              </Button>
            </Link>
            <Link to="/dashboard">
              <Button variant="secondary" size="lg">
                Get Started
              </Button>
            </Link>
          </div>

          <div style={{ display: 'flex', alignItems: 'center', gap: 16, marginTop: 12, fontSize: 12, color: 'var(--ink-mute)' }}>
            <span style={{ display: 'inline-flex', alignItems: 'center', gap: 4 }}>
              <ShieldCheck size={14} color="var(--fern-500)" /> Role-Based Backend Access
            </span>
            <span style={{ display: 'inline-flex', alignItems: 'center', gap: 4 }}>
              <FileCheck2 size={14} color="var(--fern-500)" /> Append-Only Audit Trail
            </span>
          </div>
        </div>

        {/* Hero Visual: Overlapping Boarding Pass & Resource Card Stack with Persimmon Sun */}
        <div className={styles.heroVisualWrapper}>
          <div className={styles.sunCircle} />

          <div className={styles.ticketStack}>
            <div className={styles.ticketTop}>
              <BookingPass
                bookingId="CS-8921-A"
                resourceTitle="NVIDIA RTX 4090 Workstation 04"
                category="Computing"
                borrowerName="Aarav Sharma"
                borrowerRole="Student"
                department="AI & Robotics"
                dateStr="Today, Oct 30"
                timeSlot="14:00 – 17:30"
                location="Turing Hall Rm 302"
                status="APPROVED"
                verificationCode="PASS-9821"
              />
            </div>

            <div className={styles.ticketBottom}>
              <ResourceCard
                id="res-demo-01"
                title="Universal Laser Cutter VLS 3.50"
                category="Manufacturing"
                department="Mechanical Engineering"
                location="Makerspace Pod B"
                availableQty={2}
                totalQty={3}
                maxDurationHours={4}
                requiresTraining={true}
                trainingName="Makerspace Safety L2"
                description="Precision CO2 laser system for acrylic, delrin, and prototype cutting."
              />
            </div>
          </div>
        </div>
      </section>

      {/* Live Stats Strip */}
      <section className={styles.statsStrip} id="stats">
        <div className={styles.statsGrid}>
          <StatCard
            label="Total Resources"
            value="248"
            delta="+18% new"
            trend="up"
            sparklineData={[120, 140, 180, 200, 225, 240, 248]}
            note="Across 9 specialized departments"
          />
          <StatCard
            label="Verified Borrows"
            value="1,842"
            delta="+24.5%"
            trend="up"
            sparklineData={[300, 520, 780, 1100, 1450, 1720, 1842]}
            note="Zero loss / zero unreturned items"
          />
          <StatCard
            label="Campus Utilization"
            value="84.6%"
            delta="+31.2%"
            trend="up"
            sparklineData={[42, 50, 61, 69, 74, 80, 84.6]}
            note="Up from ~22% siloed baseline"
          />
          <StatCard
            label="Audit Trail Entries"
            value="6,419"
            delta="Immutable"
            trend="neutral"
            sparklineData={[1000, 2100, 3200, 4100, 5200, 6419]}
            note="Guaranteed append-only DB trigger"
          />
        </div>
      </section>

      {/* Problem vs Solution Section */}
      <section className={styles.problemSection}>
        <div className={styles.sectionInner}>
          <div className={styles.sectionHeader}>
            <div className={styles.sectionSubtitle}>The Campus Dilemma</div>
            <h2>Why Institutional Sharing Needed a <span className="squiggle-word">Reset</span></h2>
          </div>

          <div className={styles.comparisonGrid}>
            <div className={styles.painCard}>
              <div className={styles.cardHead} style={{ color: 'var(--cherry-500)' }}>
                <XCircle size={22} />
                Traditional Campus Barriers
              </div>
              <ul className={styles.painPointsList}>
                <li>
                  <strong>Department Silos:</strong> Equipment bought with institutional funds sits locked inside individual labs 80% of the academic year.
                </li>
                <li>
                  <strong>Favoritism & Gatekeeping:</strong> Booking access relies on who knows the lab technician, leaving younger or cross-discipline students stranded.
                </li>
                <li>
                  <strong>Broken Accountability:</strong> Paper logs get lost, damages go unreported, and nobody tracks condition upon return.
                </li>
                <li>
                  <strong>Lost Research Productivity:</strong> Students spend weeks writing email requests or hunting down equipment that is idling two buildings away.
                </li>
              </ul>
            </div>

            <div className={styles.solutionCard}>
              <div className={styles.cardHead} style={{ color: 'var(--fern-500)' }}>
                <CheckCircle2 size={22} />
                The CampusShare Standard
              </div>
              <ul className={styles.painPointsList}>
                <li>
                  <strong>Single Campus Commons:</strong> Unified real-time availability across all 9 academic and technical faculties.
                </li>
                <li>
                  <strong>Algorithmic Fairness:</strong> Transparent Priority Score (N/D/E/A) balances student need, project urgency, and past reliability.
                </li>
                <li>
                  <strong>Cryptographic Handover Passes:</strong> Digital boarding passes with scannable QR tokens ensure verified equipment custody transfers.
                </li>
                <li>
                  <strong>Human-Supervised Incident Trail:</strong> Zero automated penalties; managers resolve discrepancies with full immutable audit logs.
                </li>
              </ul>
            </div>
          </div>
        </div>
      </section>

      {/* How it Works: 6-Step Winding Path */}
      <section className={styles.routeSection} id="how-it-works">
        <div className={styles.sectionInner}>
          <div className={styles.sectionHeader}>
            <div className={styles.sectionSubtitle}>End-to-End Workflow</div>
            <h2>From Discovery to Return in <span className="squiggle-word">Six Steps</span></h2>
            <p style={{ marginTop: 8 }}>
              Every transaction is strictly validated by backend transactions and append-only database triggers.
            </p>
          </div>

          <div className={styles.stepsContainer}>
            <div className={styles.stepStop}>
              <div className={styles.stepNumber}>01</div>
              <div className={styles.stepTitle}>Discover</div>
              <div className={styles.stepDesc}>
                Browse campus-wide inventory by category, specs, location, and real-time slot availability.
              </div>
            </div>

            <div className={styles.stepStop}>
              <div className={styles.stepNumber}>02</div>
              <div className={styles.stepTitle}>Request</div>
              <div className={styles.stepDesc}>
                Select time window and state academic purpose. The system checks prerequisite certifications.
              </div>
            </div>

            <div className={styles.stepStop}>
              <div className={styles.stepNumber}>03</div>
              <div className={styles.stepTitle}>Approve</div>
              <div className={styles.stepDesc}>
                Facility owners review transparent priority scores and grant access with slot lock guarantees.
              </div>
            </div>

            <div className={styles.stepStop}>
              <div className={styles.stepNumber}>04</div>
              <div className={styles.stepTitle}>Collect</div>
              <div className={styles.stepDesc}>
                Present your digital Booking Pass at the desk. Scan QR code to execute physical handover.
              </div>
            </div>

            <div className={styles.stepStop}>
              <div className={styles.stepNumber}>05</div>
              <div className={styles.stepTitle}>Return</div>
              <div className={styles.stepDesc}>
                Hand back equipment before the window expires. Staff inspects condition and confirms return.
              </div>
            </div>

            <div className={styles.stepStop}>
              <div className={styles.stepNumber}>06</div>
              <div className={styles.stepTitle}>Verify</div>
              <div className={styles.stepDesc}>
                Check custody logs. Any reported defect transitions cleanly to human incident resolution.
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* Resource Categories Grid */}
      <section className={styles.categoriesSection} id="categories">
        <div className={styles.sectionInner}>
          <div className={styles.sectionHeader}>
            <div className={styles.sectionSubtitle}>Campus Catalog</div>
            <h2>Nine Specialized <span className="squiggle-word">Resource</span> Disciplines</h2>
          </div>

          <div className={styles.categoryGrid}>
            {categories.map((cat) => (
              <Link to="/resources" key={cat.name} className={styles.categoryTile}>
                <div className={styles.categoryIconBox}>
                  <CategoryIcon category={cat.name} size={24} />
                </div>
                <div>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                    <h4 style={{ margin: 0, fontSize: 'var(--text-base)' }}>{cat.name}</h4>
                    <span style={{ fontSize: 11, fontFamily: 'var(--font-mono)', color: 'var(--ink-mute)' }}>
                      ({cat.count})
                    </span>
                  </div>
                  <p style={{ margin: '4px 0 0', fontSize: 12, color: 'var(--ink-soft)' }}>
                    {cat.desc}
                  </p>
                </div>
              </Link>
            ))}
          </div>
        </div>
      </section>

      {/* Fair by Design Section */}
      <section className={styles.fairnessSection} id="fairness">
        <div className={styles.fairnessGrid}>
          <div>
            <div className={styles.sectionSubtitle}>Equity Algorithm</div>
            <h2>Fair by Design: The <span className="squiggle-word">Priority</span> Formula</h2>
            <p style={{ marginTop: 12, lineHeight: 1.6 }}>
              Instead of opaque first-come-first-served gatekeeping, CampusShare computes an open, auditable priority score when multiple researchers request high-demand equipment simultaneously.
            </p>

            <div style={{ marginTop: 20, display: 'flex', flexDirection: 'column', gap: 12 }}>
              <div style={{ display: 'flex', gap: 10, alignItems: 'flex-start' }}>
                <span style={{ width: 12, height: 12, borderRadius: '50%', backgroundColor: 'var(--persimmon-500)', marginTop: 4, flexShrink: 0 }} />
                <div>
                  <strong>Academic Need (N):</strong> Urgency based on capstone deadlines, peer-reviewed research, or scheduled laboratory courses.
                </div>
              </div>

              <div style={{ display: 'flex', gap: 10, alignItems: 'flex-start' }}>
                <span style={{ width: 12, height: 12, borderRadius: '50%', backgroundColor: 'var(--apricot-500)', marginTop: 4, flexShrink: 0 }} />
                <div>
                  <strong>Resource Disadvantage (D):</strong> Leveling the field for under-funded departments and first-time student researchers.
                </div>
              </div>

              <div style={{ display: 'flex', gap: 10, alignItems: 'flex-start' }}>
                <span style={{ width: 12, height: 12, borderRadius: '50%', backgroundColor: 'var(--fern-500)', marginTop: 4, flexShrink: 0 }} />
                <div>
                  <strong>Efficiency (E):</strong> Collaborative group size and optimal usage block scheduling to minimize idle gaps.
                </div>
              </div>

              <div style={{ display: 'flex', gap: 10, alignItems: 'flex-start' }}>
                <span style={{ width: 12, height: 12, borderRadius: '50%', backgroundColor: 'var(--mulberry-500)', marginTop: 4, flexShrink: 0 }} />
                <div>
                  <strong>Accountability (A):</strong> Historical track record of punctuality, equipment care, and zero unreturned items.
                </div>
              </div>
            </div>
          </div>

          <div style={{ backgroundColor: 'var(--milk)', padding: 'var(--space-6)', borderRadius: 'var(--radius-card)', border: '1.5px solid var(--ink)', boxShadow: '6px 6px 0 var(--ink)' }}>
            <h3 style={{ marginBottom: 16 }}>Live Allocation Sample</h3>
            <PriorityScoreBreakdown
              need={38}
              disadvantage={24}
              efficiency={22}
              accountability={14}
              maxScore={100}
            />
            <div style={{ marginTop: 20, padding: 12, backgroundColor: 'var(--oat-100)', borderRadius: 'var(--radius-md)', fontSize: 12, color: 'var(--ink-soft)' }}>
              <strong>Result: 98/100 (Tier 1 Priority)</strong>
              <div style={{ marginTop: 4 }}>
                Request automatically prioritized for approval with full audit log entry.
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* Call to Action */}
      <section className={styles.ctaSection}>
        <div style={{ maxWidth: 640, margin: '0 auto' }}>
          <h2>Ready to Explore Your Campus Commons?</h2>
          <p style={{ margin: '12px 0 24px' }}>
            Log in as Student, Lab Owner, Facility Manager, or Dean Admin to test the complete end-to-end workflow.
          </p>
          <div style={{ display: 'flex', justifyContent: 'center', gap: 12 }}>
            <Link to="/dashboard">
              <Button variant="primary" size="lg" rightIcon={<ArrowRight size={18} />}>
                Launch Application
              </Button>
            </Link>
            <Link to="/styleguide">
              <Button variant="secondary" size="lg">
                View UI System
              </Button>
            </Link>
          </div>
        </div>
      </section>

      {/* Footer */}
      <footer className={styles.footer}>
        <div style={{ maxWidth: 'var(--max-content-width)', margin: '0 auto', display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: 12 }}>
          <div>
            <strong>CampusShare</strong> — National Hackathon Edition. Built with FastAPI, PostgreSQL, and React.
          </div>
          <div>
            Every Resource Deserves Utilization. Every User Deserves Fair Access.
          </div>
        </div>
      </footer>
    </div>
  );
};
