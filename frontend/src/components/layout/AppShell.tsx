import React from 'react';
import { NavLink, Outlet, useNavigate } from 'react-router-dom';
import {
  LayoutDashboard,
  Compass,
  Ticket,
  QrCode,
  FolderKanban,
  AlertTriangle,
  BarChart3,
  FileCheck2,
  Palette,
  Search,
  Bell,
  Sun,
  Moon,
  LogOut,
  Layers,
  Users,
  Building,
  RotateCcw,
  Sliders,
  ShieldCheck,
  User,
} from 'lucide-react';
import { useAuth } from '../../context/AuthContext';
import { UserRole } from '../../api/types';
import { useTheme } from '../../context/ThemeContext';
import { Avatar, Badge } from '../ui';
import styles from './AppShell.module.css';

export const AppShell: React.FC = () => {
  const { user, role, setRole, unreadCount, logout } = useAuth();
  const { theme, toggleTheme } = useTheme();
  const navigate = useNavigate();

  // Role accents following the strict token palette
  const roleColors: Record<UserRole, { color: string; bg: string }> = {
    STUDENT: { color: 'var(--persimmon-500)', bg: 'var(--persimmon-100)' },
    OWNER: { color: 'var(--fern-500)', bg: 'var(--fern-100)' },
    MANAGER: { color: 'var(--mulberry-500)', bg: 'var(--mulberry-100)' },
    ADMIN: { color: 'var(--lilac-400)', bg: 'var(--lilac-100)' },
  };

  const currentRoleStyle = {
    '--role-accent': roleColors[role].color,
    '--role-accent-bg': roleColors[role].bg,
  } as React.CSSProperties;

  const handleLogout = async () => {
    await logout();
    navigate('/login');
  };

  return (
    <div className={styles.layout} style={currentRoleStyle}>
      {/* Desktop Left Sidebar */}
      <aside className={styles.sidebar}>
        <div className={styles.brandWrap} onClick={() => navigate('/dashboard')} style={{ cursor: 'pointer' }}>
          <div className={styles.logoIcon}>
            CS
          </div>
          <div className={styles.brandText}>
            <span className={styles.brandTitle}>CampusShare</span>
            <span className={styles.brandTagline}>Institutional Commons</span>
          </div>
        </div>

        {/* Quick Role Switcher for Hackathon Evaluation */}
        <div className={styles.roleSelectorWrap}>
          <div className={styles.roleLabel}>Testing Persona:</div>
          <div className={styles.roleTabs}>
            {(['STUDENT', 'OWNER', 'MANAGER', 'ADMIN'] as UserRole[]).map((r) => (
              <button
                key={r}
                type="button"
                onClick={() => setRole(r)}
                className={`${styles.roleBtn} ${role === r ? styles.roleBtnActive : ''}`}
                style={role === r ? { color: roleColors[r].color } : undefined}
              >
                {r.slice(0, 4)}
              </button>
            ))}
          </div>
        </div>

        {/* Grouped Nav Items According to Role */}
        <nav className={styles.navSection}>
          {role === 'STUDENT' && (
            <div>
              <div className={styles.navGroupTitle}>Student Portal</div>
              <NavLink to="/dashboard" className={({ isActive }) => `${styles.navItem} ${isActive ? styles.navItemActive : ''}`}>
                <LayoutDashboard size={17} />
                <span>Dashboard</span>
              </NavLink>
              <NavLink to="/marketplace" className={({ isActive }) => `${styles.navItem} ${isActive ? styles.navItemActive : ''}`}>
                <Compass size={17} />
                <span>Marketplace Catalog</span>
              </NavLink>
              <NavLink to="/bookings" className={({ isActive }) => `${styles.navItem} ${isActive ? styles.navItemActive : ''}`}>
                <Ticket size={17} />
                <span>My Booking Passes</span>
              </NavLink>
              <NavLink to="/waitlist" className={({ isActive }) => `${styles.navItem} ${isActive ? styles.navItemActive : ''}`}>
                <Layers size={17} />
                <span>Waiting Lists</span>
              </NavLink>
              <NavLink to="/notifications" className={({ isActive }) => `${styles.navItem} ${isActive ? styles.navItemActive : ''}`}>
                <Bell size={17} />
                <span>Notifications ({unreadCount})</span>
              </NavLink>
              <NavLink to="/profile" className={({ isActive }) => `${styles.navItem} ${isActive ? styles.navItemActive : ''}`}>
                <User size={17} />
                <span>Fairness & Profile</span>
              </NavLink>
            </div>
          )}

          {role === 'OWNER' && (
            <div>
              <div className={styles.navGroupTitle}>Lab Owner & Custodian</div>
              <NavLink to="/dashboard" className={({ isActive }) => `${styles.navItem} ${isActive ? styles.navItemActive : ''}`}>
                <LayoutDashboard size={17} />
                <span>Operations Dashboard</span>
              </NavLink>
              <NavLink to="/resources" className={({ isActive }) => `${styles.navItem} ${isActive ? styles.navItemActive : ''}`}>
                <FolderKanban size={17} />
                <span>My Managed Assets</span>
              </NavLink>
              <NavLink to="/handover" className={({ isActive }) => `${styles.navItem} ${isActive ? styles.navItemActive : ''}`}>
                <QrCode size={17} />
                <span>Check-Out Desk</span>
              </NavLink>
              <NavLink to="/returns" className={({ isActive }) => `${styles.navItem} ${isActive ? styles.navItemActive : ''}`}>
                <RotateCcw size={17} />
                <span>Return Verification</span>
              </NavLink>
              <NavLink to="/requests" className={({ isActive }) => `${styles.navItem} ${isActive ? styles.navItemActive : ''}`}>
                <FileCheck2 size={17} />
                <span>Booking Requests</span>
              </NavLink>
              <NavLink to="/incidents" className={({ isActive }) => `${styles.navItem} ${isActive ? styles.navItemActive : ''}`}>
                <AlertTriangle size={17} />
                <span>Incidents Logged</span>
              </NavLink>
            </div>
          )}

          {role === 'MANAGER' && (
            <div>
              <div className={styles.navGroupTitle}>Facility Management</div>
              <NavLink to="/dashboard" className={({ isActive }) => `${styles.navItem} ${isActive ? styles.navItemActive : ''}`}>
                <LayoutDashboard size={17} />
                <span>Console Dashboard</span>
              </NavLink>
              <NavLink to="/approvals" className={({ isActive }) => `${styles.navItem} ${isActive ? styles.navItemActive : ''}`}>
                <Layers size={17} />
                <span>Approval Queue</span>
              </NavLink>
              <NavLink to="/eligibility" className={({ isActive }) => `${styles.navItem} ${isActive ? styles.navItemActive : ''}`}>
                <ShieldCheck size={17} />
                <span>Eligibility Review</span>
              </NavLink>
              <NavLink to="/restricted" className={({ isActive }) => `${styles.navItem} ${isActive ? styles.navItemActive : ''}`}>
                <FolderKanban size={17} />
                <span>Restricted Bookings</span>
              </NavLink>
              <NavLink to="/incidents" className={({ isActive }) => `${styles.navItem} ${isActive ? styles.navItemActive : ''}`}>
                <AlertTriangle size={17} />
                <span>Incident Review</span>
              </NavLink>
              <NavLink to="/stats" className={({ isActive }) => `${styles.navItem} ${isActive ? styles.navItemActive : ''}`}>
                <BarChart3 size={17} />
                <span>Department Analytics</span>
              </NavLink>
            </div>
          )}

          {role === 'ADMIN' && (
            <div>
              <div className={styles.navGroupTitle}>Platform Administration</div>
              <NavLink to="/dashboard" className={({ isActive }) => `${styles.navItem} ${isActive ? styles.navItemActive : ''}`}>
                <LayoutDashboard size={17} />
                <span>Admin Dashboard</span>
              </NavLink>
              <NavLink to="/users" className={({ isActive }) => `${styles.navItem} ${isActive ? styles.navItemActive : ''}`}>
                <Users size={17} />
                <span>User Identity & RBAC</span>
              </NavLink>
              <NavLink to="/departments" className={({ isActive }) => `${styles.navItem} ${isActive ? styles.navItemActive : ''}`}>
                <Building size={17} />
                <span>Departments CRUD</span>
              </NavLink>
              <NavLink to="/categories" className={({ isActive }) => `${styles.navItem} ${isActive ? styles.navItemActive : ''}`}>
                <Layers size={17} />
                <span>Taxonomy Categories</span>
              </NavLink>
              <NavLink to="/admin/bookings" className={({ isActive }) => `${styles.navItem} ${isActive ? styles.navItemActive : ''}`}>
                <Ticket size={17} />
                <span>All Campus Bookings</span>
              </NavLink>
              <NavLink to="/audit" className={({ isActive }) => `${styles.navItem} ${isActive ? styles.navItemActive : ''}`}>
                <FileCheck2 size={17} />
                <span>Append-Only Audit</span>
              </NavLink>
              <NavLink to="/settings" className={({ isActive }) => `${styles.navItem} ${isActive ? styles.navItemActive : ''}`}>
                <Sliders size={17} />
                <span>Fairness & Settings</span>
              </NavLink>
            </div>
          )}

          <div>
            <div className={styles.navGroupTitle}>Design System</div>
            <NavLink to="/styleguide" className={({ isActive }) => `${styles.navItem} ${isActive ? styles.navItemActive : ''}`}>
              <Palette size={17} />
              <span>Design Tokens & Spec</span>
            </NavLink>
          </div>
        </nav>

        {/* User Chip */}
        <div className={styles.userChip}>
          <Avatar name={user.full_name || 'Campus User'} roleColor={roleColors[role].color} />
          <div className={styles.userInfo}>
            <span className={styles.userName}>{user.full_name || 'User'}</span>
            <span className={styles.userDept}>
              <Badge variant={role === 'STUDENT' ? 'persimmon' : role === 'OWNER' ? 'fern' : role === 'MANAGER' ? 'mulberry' : 'lilac'}>
                {role}
              </Badge>
            </span>
          </div>
          <button
            type="button"
            onClick={handleLogout}
            title="Log out"
            style={{ background: 'none', border: 'none', color: 'var(--ink-mute)', cursor: 'pointer', padding: 4 }}
          >
            <LogOut size={16} />
          </button>
        </div>
      </aside>

      {/* Main Container */}
      <div className={styles.mainContainer}>
        {/* Topbar */}
        <header className={styles.topbar}>
          <div className={styles.searchWrap}>
            <Search size={16} color="var(--ink-mute)" />
            <input
              type="text"
              placeholder="Quick search equipment, booking codes..."
              className={styles.searchInput}
              onKeyDown={(e) => {
                if (e.key === 'Enter') {
                  const val = (e.target as HTMLInputElement).value;
                  navigate(`/marketplace?q=${encodeURIComponent(val)}`);
                }
              }}
            />
          </div>

          <div className={styles.topActions}>
            <button
              type="button"
              className={styles.iconBtn}
              onClick={toggleTheme}
              title={`Switch to ${theme === 'light' ? 'Forest Dark' : 'Oat Light'} Mode`}
              aria-label="Toggle dark mode"
            >
              {theme === 'light' ? <Moon size={17} /> : <Sun size={17} />}
            </button>

            <NavLink to="/notifications" className={styles.iconBtn} title="Notifications">
              <Bell size={17} />
              {unreadCount > 0 && <span className={styles.unreadDot} />}
            </NavLink>

            <div
              style={{ display: 'flex', alignItems: 'center', gap: 8, paddingLeft: 6, cursor: 'pointer' }}
              onClick={() => navigate('/profile')}
            >
              <Avatar name={user.full_name || 'User'} size="sm" roleColor={roleColors[role].color} />
            </div>
          </div>
        </header>

        {/* Dynamic Outlet */}
        <main className={styles.contentArea}>
          <Outlet />
        </main>
      </div>

      {/* Mobile Bottom Tab Bar */}
      <nav className={styles.mobileTabBar}>
        <NavLink to="/dashboard" className={({ isActive }) => `${styles.mobileTabItem} ${isActive ? styles.mobileTabActive : ''}`}>
          <LayoutDashboard size={18} />
          <span>Dashboard</span>
        </NavLink>
        <NavLink to="/marketplace" className={({ isActive }) => `${styles.mobileTabItem} ${isActive ? styles.mobileTabActive : ''}`}>
          <Compass size={18} />
          <span>Catalog</span>
        </NavLink>
        <NavLink to="/bookings" className={({ isActive }) => `${styles.mobileTabItem} ${isActive ? styles.mobileTabActive : ''}`}>
          <Ticket size={18} />
          <span>Passes</span>
        </NavLink>
        <NavLink to="/notifications" className={({ isActive }) => `${styles.mobileTabItem} ${isActive ? styles.mobileTabActive : ''}`}>
          <Bell size={18} />
          <span>Alerts</span>
        </NavLink>
      </nav>
    </div>
  );
};
