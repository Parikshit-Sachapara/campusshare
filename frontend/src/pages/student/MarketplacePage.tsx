import React, { useState, useMemo } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import {
  Search,
  Filter,
  CheckCircle2,
  Calendar,
  Layers,
  Sparkles,
  SlidersHorizontal,
  RotateCcw,
  MapPin,
  Bot,
} from 'lucide-react';
import { api } from '../../api/client';
import { ResourceItem } from '../../api/types';
import { CampusPulseMap } from '../../components/CampusPulse/CampusPulseMap';
import { ProjectBuddy } from '../../components/ai/ProjectBuddy';
import {
  ResourceCard,
  CategoryIcon,
  ResourceCategory,
  Button,
  Input,
  Select,
  Skeleton,
  EmptyState,
} from '../../components/ui';

export const MarketplacePage: React.FC = () => {
  const navigate = useNavigate();
  const [searchParams, setSearchParams] = useSearchParams();

  // View mode switcher: catalog | map | buddy
  const [viewMode, setViewMode] = useState<'catalog' | 'map' | 'buddy'>('catalog');

  // Search & Filters state
  const [searchQuery, setSearchQuery] = useState(searchParams.get('q') || '');
  const [selectedCategory, setSelectedCategory] = useState<string>(searchParams.get('category') || 'ALL');
  const [selectedDept, setSelectedDept] = useState<string>('ALL');
  const [selectedType, setSelectedType] = useState<string>('ALL');
  const [eligibleOnly, setEligibleOnly] = useState<boolean>(false);
  const [sortBy, setSortBy] = useState<string>('popularity');

  // Fetch departments
  const { data: departments } = useQuery({
    queryKey: ['departments'],
    queryFn: () => api.listDepartments(),
  });

  // Fetch categories
  const { data: categories } = useQuery({
    queryKey: ['categories'],
    queryFn: () => api.listCategories(),
  });

  // Fetch resources from API
  const {
    data: resourcesData,
    isLoading,
    isError,
    refetch,
  } = useQuery({
    queryKey: ['resources', searchQuery, selectedCategory, selectedDept, selectedType, sortBy],
    queryFn: () =>
      api.listResources({
        search: searchQuery || undefined,
        category_id: selectedCategory !== 'ALL' ? selectedCategory : undefined,
        department_id: selectedDept !== 'ALL' ? selectedDept : undefined,
        resource_type: selectedType !== 'ALL' ? selectedType : undefined,
        sort_by: sortBy,
        size: 50,
      }),
  });

  const categoryTabs = useMemo(() => {
    const list: { key: string; label: string; icon: ResourceCategory }[] = [
      { key: 'ALL', label: 'All Catalog', icon: 'Computing' },
    ];
    if (categories) {
      categories.forEach((c) => {
        list.push({
          key: c.id,
          label: c.name,
          icon: (c.name as ResourceCategory) || 'Computing',
        });
      });
    } else {
      // Fallback categories
      [
        'Computing',
        'Electronics',
        'Robotics',
        'Photography',
        'Laboratories',
        'Classrooms',
        'Audio/Visual',
        'Manufacturing',
      ].forEach((cat) => {
        list.push({ key: cat, label: cat, icon: cat as ResourceCategory });
      });
    }
    return list;
  }, [categories]);

  const items = resourcesData?.items || [];

  // Filter client side for "I'm eligible" toggle if checked
  const filteredItems = useMemo(() => {
    if (!eligibleOnly) return items;
    return items.filter((item) => !item.is_restricted && !item.training_required);
  }, [items, eligibleOnly]);

  const resetFilters = () => {
    setSearchQuery('');
    setSelectedCategory('ALL');
    setSelectedDept('ALL');
    setSelectedType('ALL');
    setEligibleOnly(false);
    setSortBy('popularity');
    setSearchParams({});
  };

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--space-6)' }}>
      {/* Sticky Search and Header */}
      <div
        style={{
          position: 'sticky',
          top: 0,
          zIndex: 10,
          backgroundColor: 'var(--oat-50)',
          paddingTop: 'var(--space-2)',
          paddingBottom: 'var(--space-4)',
          borderBottom: '1px solid var(--oat-200)',
          display: 'flex',
          flexDirection: 'column',
          gap: 'var(--space-4)',
        }}
      >
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: 12 }}>
          <div>
            <h1 style={{ margin: 0, fontSize: 'var(--text-2xl)', color: 'var(--ink)' }}>
              Campus Resource <span className="squiggle-word">Marketplace</span>
            </h1>
            <p style={{ margin: '4px 0 0', color: 'var(--ink-soft)', fontSize: 'var(--text-sm)' }}>
              Real-time slot locking and reservation across all campus facilities & labs
            </p>
          </div>

          <div style={{ display: 'flex', alignItems: 'center', gap: 'var(--space-3)', flexWrap: 'wrap' }}>
            {/* View Mode Switcher */}
            <div
              style={{
                display: 'inline-flex',
                alignItems: 'center',
                backgroundColor: 'var(--oat-100)',
                border: '1.5px solid var(--ink-border)',
                borderRadius: 'var(--radius-md)',
                padding: 4,
                gap: 4,
              }}
            >
              <button
                type="button"
                onClick={() => setViewMode('catalog')}
                style={{
                  display: 'inline-flex',
                  alignItems: 'center',
                  gap: 6,
                  padding: '6px 14px',
                  borderRadius: 'var(--radius-sm)',
                  border: viewMode === 'catalog' ? '1.5px solid var(--persimmon-500)' : '1px solid transparent',
                  backgroundColor: viewMode === 'catalog' ? 'var(--milk)' : 'transparent',
                  color: viewMode === 'catalog' ? 'var(--persimmon-600)' : 'var(--ink-soft)',
                  fontWeight: viewMode === 'catalog' ? 700 : 500,
                  fontSize: 'var(--text-xs)',
                  cursor: 'pointer',
                  transition: 'all 0.15s ease',
                  boxShadow: viewMode === 'catalog' ? 'var(--shadow-xs)' : 'none',
                }}
              >
                <Layers size={14} />
                <span>Catalog Grid</span>
              </button>
              <button
                type="button"
                onClick={() => setViewMode('map')}
                style={{
                  display: 'inline-flex',
                  alignItems: 'center',
                  gap: 6,
                  padding: '6px 14px',
                  borderRadius: 'var(--radius-sm)',
                  border: viewMode === 'map' ? '1.5px solid var(--fern-500)' : '1px solid transparent',
                  backgroundColor: viewMode === 'map' ? 'var(--milk)' : 'transparent',
                  color: viewMode === 'map' ? 'var(--fern-700)' : 'var(--ink-soft)',
                  fontWeight: viewMode === 'map' ? 700 : 500,
                  fontSize: 'var(--text-xs)',
                  cursor: 'pointer',
                  transition: 'all 0.15s ease',
                  boxShadow: viewMode === 'map' ? 'var(--shadow-xs)' : 'none',
                }}
              >
                <MapPin size={14} />
                <span>Browse by Map</span>
              </button>
              <button
                type="button"
                onClick={() => setViewMode('buddy')}
                style={{
                  display: 'inline-flex',
                  alignItems: 'center',
                  gap: 6,
                  padding: '6px 14px',
                  borderRadius: 'var(--radius-sm)',
                  border: viewMode === 'buddy' ? '1.5px solid var(--lilac-500)' : '1px solid transparent',
                  backgroundColor: viewMode === 'buddy' ? 'var(--milk)' : 'transparent',
                  color: viewMode === 'buddy' ? 'var(--lilac-700)' : 'var(--ink-soft)',
                  fontWeight: viewMode === 'buddy' ? 700 : 500,
                  fontSize: 'var(--text-xs)',
                  cursor: 'pointer',
                  transition: 'all 0.15s ease',
                  boxShadow: viewMode === 'buddy' ? 'var(--shadow-xs)' : 'none',
                }}
              >
                <Bot size={14} />
                <span>Project Buddy (AI)</span>
              </button>
            </div>

            {viewMode === 'catalog' && (
              <Select
                value={sortBy}
                onChange={(e) => setSortBy(e.target.value)}
                options={[
                  { label: 'Sort: Most Popular', value: 'popularity' },
                  { label: 'Sort: Highest Availability', value: 'availability' },
                  { label: 'Sort: Name (A-Z)', value: 'name' },
                ]}
              />
            )}
          </div>
        </div>

        {/* Search Bar */}
        <div style={{ display: 'flex', gap: 'var(--space-2)' }}>
          <div style={{ position: 'relative', flex: 1, display: 'flex', alignItems: 'center' }}>
            <Search size={18} style={{ position: 'absolute', left: 14, color: 'var(--ink-mute)' }} />
            <input
              type="text"
              placeholder="Search by equipment name, keywords (e.g. DSLR, GPU, 3D printer, oscilloscope)..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              style={{
                width: '100%',
                padding: '10px 14px 10px 42px',
                borderRadius: 'var(--radius-md)',
                border: '1.5px solid var(--ink-border)',
                backgroundColor: 'var(--milk)',
                color: 'var(--ink)',
                fontSize: 'var(--text-base)',
                outline: 'none',
              }}
            />
          </div>
          {searchQuery && (
            <Button variant="ghost" onClick={() => setSearchQuery('')}>
              Clear
            </Button>
          )}
        </div>

        {/* Category Icon Tabs Horizontal Scroll */}
        <div
          style={{
            display: 'flex',
            gap: 'var(--space-2)',
            overflowX: 'auto',
            paddingBottom: 4,
          }}
        >
          {categoryTabs.map((tab) => {
            const isActive = selectedCategory === tab.key;
            return (
              <button
                key={tab.key}
                type="button"
                onClick={() => setSelectedCategory(tab.key)}
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: 8,
                  padding: '8px 14px',
                  borderRadius: 'var(--radius-full)',
                  border: isActive ? '1.5px solid var(--persimmon-500)' : '1px solid var(--oat-200)',
                  backgroundColor: isActive ? 'var(--persimmon-100)' : 'var(--milk)',
                  color: isActive ? 'var(--persimmon-600)' : 'var(--ink)',
                  fontSize: 'var(--text-xs)',
                  fontWeight: 600,
                  whiteSpace: 'nowrap',
                  cursor: 'pointer',
                  transition: 'all 0.15s ease',
                }}
              >
                <CategoryIcon category={tab.icon} size={15} />
                <span>{tab.label}</span>
              </button>
            );
          })}
        </div>
      </div>

      {/* Conditional View Rendering */}
      {viewMode === 'map' && (
        <section style={{ marginTop: 'var(--space-2)' }}>
          <CampusPulseMap compact onSelectResource={(id) => navigate(`/resources/${id}`)} />
        </section>
      )}

      {viewMode === 'buddy' && (
        <section style={{ marginTop: 'var(--space-2)' }}>
          <ProjectBuddy onBookResource={(id) => navigate(`/resources/${id}`)} />
        </section>
      )}

      {viewMode === 'catalog' && (
        <div
          style={{
            display: 'grid',
            gridTemplateColumns: '260px 1fr',
            gap: 'var(--space-6)',
            alignItems: 'start',
          }}
        >
        {/* Filter Sidebar */}
        <aside
          style={{
            backgroundColor: 'var(--milk)',
            border: '1.5px solid var(--ink-border)',
            borderRadius: 'var(--radius-card)',
            padding: 'var(--space-5)',
            display: 'flex',
            flexDirection: 'column',
            gap: 'var(--space-5)',
          }}
        >
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 6, fontWeight: 700, fontSize: 'var(--text-sm)', color: 'var(--ink)' }}>
              <SlidersHorizontal size={16} />
              <span>Filters</span>
            </div>
            <button
              type="button"
              onClick={resetFilters}
              style={{
                background: 'none',
                border: 'none',
                color: 'var(--persimmon-600)',
                fontSize: 'var(--text-xs)',
                fontWeight: 600,
                cursor: 'pointer',
                display: 'flex',
                alignItems: 'center',
                gap: 4,
              }}
            >
              <RotateCcw size={12} />
              Reset
            </button>
          </div>

          {/* Department Filter */}
          <div>
            <label style={{ display: 'block', fontSize: 'var(--text-xs)', fontWeight: 700, color: 'var(--ink)', marginBottom: 6 }}>
              Department
            </label>
            <select
              value={selectedDept}
              onChange={(e) => setSelectedDept(e.target.value)}
              style={{
                width: '100%',
                padding: '8px 10px',
                borderRadius: 'var(--radius-sm)',
                border: '1px solid var(--ink-border)',
                backgroundColor: 'var(--oat-50)',
                color: 'var(--ink)',
                fontSize: 'var(--text-xs)',
              }}
            >
              <option value="ALL">All Departments</option>
              {departments?.map((d) => (
                <option key={d.id} value={d.id}>
                  {d.name} ({d.code})
                </option>
              ))}
            </select>
          </div>

          {/* Type Filter */}
          <div>
            <label style={{ display: 'block', fontSize: 'var(--text-xs)', fontWeight: 700, color: 'var(--ink)', marginBottom: 6 }}>
              Resource Type
            </label>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
              {[
                { label: 'All Resources', val: 'ALL' },
                { label: 'Equipment & Gear', val: 'EQUIPMENT' },
                { label: 'Facilities & Rooms', val: 'FACILITY' },
              ].map((t) => (
                <label key={t.val} style={{ display: 'flex', alignItems: 'center', gap: 8, fontSize: 'var(--text-xs)', color: 'var(--ink-soft)', cursor: 'pointer' }}>
                  <input
                    type="radio"
                    name="resource_type"
                    checked={selectedType === t.val}
                    onChange={() => setSelectedType(t.val)}
                    style={{ accentColor: 'var(--persimmon-500)' }}
                  />
                  <span>{t.label}</span>
                </label>
              ))}
            </div>
          </div>

          {/* "I'm Eligible" Toggle */}
          <div
            style={{
              padding: 'var(--space-3)',
              backgroundColor: 'var(--oat-100)',
              borderRadius: 'var(--radius-md)',
              border: '1px solid var(--oat-200)',
            }}
          >
            <label style={{ display: 'flex', alignItems: 'flex-start', gap: 8, cursor: 'pointer' }}>
              <input
                type="checkbox"
                checked={eligibleOnly}
                onChange={(e) => setEligibleOnly(e.target.checked)}
                style={{ accentColor: 'var(--fern-500)', marginTop: 2 }}
              />
              <div>
                <div style={{ fontSize: 'var(--text-xs)', fontWeight: 700, color: 'var(--ink)' }}>
                  I'm Eligible Only
                </div>
                <div style={{ fontSize: 11, color: 'var(--ink-mute)', marginTop: 2 }}>
                  Show only resources that require no training or departmental permits
                </div>
              </div>
            </label>
          </div>
        </aside>

        {/* Resource Cards Grid */}
        <section>
          {isLoading ? (
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(280px, 1fr))', gap: 'var(--space-4)' }}>
              <Skeleton height={280} borderRadius="var(--radius-card)" />
              <Skeleton height={280} borderRadius="var(--radius-card)" />
              <Skeleton height={280} borderRadius="var(--radius-card)" />
              <Skeleton height={280} borderRadius="var(--radius-card)" />
              <Skeleton height={280} borderRadius="var(--radius-card)" />
              <Skeleton height={280} borderRadius="var(--radius-card)" />
            </div>
          ) : isError ? (
            <EmptyState
              title="Failed to load catalog"
              description="There was a communication issue retrieving campus inventory."
              actionLabel="Retry"
              onAction={() => refetch()}
            />
          ) : filteredItems.length === 0 ? (
            <EmptyState
              title="No resources matched your criteria"
              description="Try adjusting your filters, selecting a different department, or clearing your search."
              actionLabel="Reset All Filters"
              onAction={resetFilters}
            />
          ) : (
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(280px, 1fr))', gap: 'var(--space-4)' }}>
              {filteredItems.map((r: ResourceItem) => (
                <ResourceCard
                  key={r.id}
                  id={r.id}
                  title={r.name}
                  category={r.category_name || 'Equipment'}
                  department={r.department_code || 'Campus'}
                  location={r.location}
                  availableQty={r.available_quantity}
                  totalQty={r.quantity}
                  maxDurationHours={r.max_booking_minutes ? Math.round(r.max_booking_minutes / 60) : r.rule?.max_duration_minutes ? Math.round(r.rule.max_duration_minutes / 60) : 4}
                  requiresTraining={r.training_required}
                  requiresApproval={r.approval_required}
                  description={r.description}
                  imageUrl={r.primary_image_url}
                  onSelect={() => navigate(`/resources/${r.id}`)}
                />
              ))}
            </div>
          )}
        </section>
      </div>
      )}
    </div>
  );
};

