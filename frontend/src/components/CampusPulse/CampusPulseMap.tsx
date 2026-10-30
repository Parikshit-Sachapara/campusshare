import React, { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { Link } from 'react-router-dom';
import { api } from '../../api/client';
import { CampusPulseRoom } from '../../api/types';
import { Badge, Button } from '../ui';

interface CampusPulseMapProps {
  compact?: boolean;
  onSelectResource?: (resourceId: string) => void;
}

export const CampusPulseMap: React.FC<CampusPulseMapProps> = ({
  compact = false,
  onSelectResource,
}) => {
  const [selectedDate, setSelectedDate] = useState<string>(
    new Date().toISOString().split('T')[0]
  );
  const [selectedHour, setSelectedHour] = useState<number>(14);
  const [activeRoomId, setActiveRoomId] = useState<string>('room-turing-302');
  const [hoveredRoom, setHoveredRoom] = useState<CampusPulseRoom | null>(null);
  const [selectedBlock, setSelectedBlock] = useState<string>('ALL');

  const { data, isLoading } = useQuery({
    queryKey: ['campus-pulse', selectedDate, selectedHour],
    queryFn: () => api.getCampusPulse(selectedDate, selectedHour),
    refetchInterval: 30000,
  });

  const rooms = data?.rooms || [];
  const selectedRoom = rooms.find((r) => r.id === activeRoomId) || rooms[0];

  const filteredRooms =
    selectedBlock === 'ALL'
      ? rooms
      : rooms.filter((r) => r.block === selectedBlock);

  // SVG canvas dimensions
  const svgWidth = 700;
  const svgHeight = 460;

  return (
    <div className="bg-[var(--oat-50)] border border-[var(--oat-200)] rounded-3xl p-6 shadow-sm overflow-hidden text-[var(--ink-900)]">
      {/* Header bar */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 pb-6 border-b border-[var(--oat-200)]">
        <div>
          <div className="flex items-center gap-2 mb-1">
            <span className="inline-block w-2.5 h-2.5 rounded-full bg-[var(--fern-500)] animate-pulse" />
            <span className="text-xs font-semibold tracking-wider uppercase text-[var(--ink-500)]">
              Signature Institutional Feature
            </span>
          </div>
          <h2 className="text-2xl font-bold font-serif text-[var(--ink-900)] flex items-center gap-2">
            Campus Pulse
            <span className="text-sm font-normal text-[var(--ink-600)] font-sans">
              • Spatial Floor Plan Utilization
            </span>
          </h2>
          <p className="text-xs text-[var(--ink-600)] mt-0.5">
            Real-time campus spatial occupancy telemetry across Academic Blocks A, B, and C.
          </p>
        </div>

        {/* Controls: Date Picker & Block Filter */}
        <div className="flex flex-wrap items-center gap-3">
          <div className="flex items-center bg-[var(--milk)] border border-[var(--oat-200)] rounded-xl px-3 py-1.5 shadow-sm text-xs">
            <label htmlFor="pulse-date" className="text-[var(--ink-500)] mr-2 font-medium">
              Date:
            </label>
            <input
              id="pulse-date"
              type="date"
              value={selectedDate}
              onChange={(e) => setSelectedDate(e.target.value)}
              className="bg-transparent text-[var(--ink-900)] font-medium focus:outline-none cursor-pointer"
            />
          </div>

          <div className="inline-flex rounded-xl p-1 bg-[var(--oat-100)] border border-[var(--oat-200)] text-xs">
            {['ALL', 'Block A', 'Block B', 'Block C'].map((b) => (
              <button
                key={b}
                onClick={() => setSelectedBlock(b)}
                className={`px-2.5 py-1 rounded-lg font-medium transition-all ${
                  selectedBlock === b
                    ? 'bg-[var(--milk)] text-[var(--ink-900)] shadow-sm'
                    : 'text-[var(--ink-600)] hover:text-[var(--ink-900)]'
                }`}
              >
                {b}
              </button>
            ))}
          </div>
        </div>
      </div>

      {/* Scrubber Bar: Hour-by-hour timeline replay */}
      <div className="my-5 bg-[var(--milk)] border border-[var(--oat-200)] rounded-2xl p-4 shadow-sm">
        <div className="flex items-center justify-between mb-2">
          <div className="flex items-center gap-2">
            <span className="text-xs font-semibold text-[var(--ink-700)] uppercase tracking-wide">
              Time Scrubber:
            </span>
            <span className="text-sm font-bold font-mono px-2 py-0.5 rounded bg-[var(--oat-100)] text-[var(--ink-900)] border border-[var(--oat-200)]">
              {String(selectedHour).padStart(2, '0')}:00 – {String(selectedHour + 1).padStart(2, '0')}:00
            </span>
          </div>
          <span className="text-xs text-[var(--ink-500)]">
            Drag slider to inspect hourly historical or forecast occupancy
          </span>
        </div>

        <div className="relative flex items-center gap-3">
          <span className="text-xs font-mono font-medium text-[var(--ink-500)]">08:00</span>
          <input
            type="range"
            min={8}
            max={20}
            step={1}
            value={selectedHour}
            onChange={(e) => setSelectedHour(Number(e.target.value))}
            className="w-full h-2 bg-[var(--oat-200)] rounded-lg appearance-none cursor-pointer accent-[var(--fern-600)]"
          />
          <span className="text-xs font-mono font-medium text-[var(--ink-500)]">20:00</span>
        </div>

        {/* Hour markers */}
        <div className="flex justify-between px-8 mt-1.5 text-[10px] font-mono text-[var(--ink-400)]">
          {Array.from({ length: 13 }, (_, i) => i + 8).map((h) => (
            <span
              key={h}
              onClick={() => setSelectedHour(h)}
              className={`cursor-pointer transition-colors ${
                selectedHour === h ? 'font-bold text-[var(--fern-700)] underline' : 'hover:text-[var(--ink-700)]'
              }`}
            >
              {h}h
            </span>
          ))}
        </div>
      </div>

      {/* Main Grid: SVG Map on Left, Room Detail on Right */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
        {/* Left: Paper-map SVG canvas */}
        <div className={`relative ${compact ? 'lg:col-span-12' : 'lg:col-span-8'}`}>
          <div className="bg-[var(--oat-100)] border border-[var(--oat-300)] rounded-2xl p-4 shadow-inner relative overflow-hidden">
            {/* Paper Texture Overlay */}
            <div
              className="absolute inset-0 opacity-15 pointer-events-none"
              style={{
                backgroundImage: `radial-gradient(var(--ink-300) 0.75px, transparent 0.75px)`,
                backgroundSize: '16px 16px',
              }}
            />

            {isLoading ? (
              <div className="h-[460px] flex items-center justify-center">
                <div className="flex flex-col items-center gap-3">
                  <div className="w-8 h-8 border-2 border-[var(--fern-500)] border-t-transparent rounded-full animate-spin" />
                  <p className="text-xs text-[var(--ink-600)]">Synchronizing campus sensor grid...</p>
                </div>
              </div>
            ) : (
              <div className="relative w-full overflow-x-auto">
                <svg
                  viewBox={`0 0 ${svgWidth} ${svgHeight}`}
                  className="w-full h-auto select-none font-sans"
                  style={{ minWidth: '600px' }}
                >
                  <defs>
                    <filter id="paper-shadow" x="-5%" y="-5%" width="110%" height="110%">
                      <feDropShadow dx="1" dy="2" stdDeviation="2" floodColor="#2D282A" floodOpacity="0.08" />
                    </filter>
                  </defs>

                  {/* Block boundaries & Watermarks */}
                  {/* Block A */}
                  <rect
                    x="40"
                    y="30"
                    width="620"
                    height="100"
                    rx="14"
                    fill="var(--milk)"
                    stroke="var(--oat-300)"
                    strokeWidth="1.5"
                    strokeDasharray="4 4"
                    opacity="0.8"
                  />
                  <text x="50" y="48" fill="var(--ink-400)" fontSize="11" fontWeight="700" letterSpacing="0.08em">
                    BLOCK A • COMPUTING & HARDWARE
                  </text>

                  {/* Block B */}
                  <rect
                    x="40"
                    y="150"
                    width="620"
                    height="105"
                    rx="14"
                    fill="var(--milk)"
                    stroke="var(--oat-300)"
                    strokeWidth="1.5"
                    strokeDasharray="4 4"
                    opacity="0.8"
                  />
                  <text x="50" y="168" fill="var(--ink-400)" fontSize="11" fontWeight="700" letterSpacing="0.08em">
                    BLOCK B • MEDIA, LASER & PROTOTYPING
                  </text>

                  {/* Block C */}
                  <rect
                    x="40"
                    y="275"
                    width="620"
                    height="145"
                    rx="14"
                    fill="var(--milk)"
                    stroke="var(--oat-300)"
                    strokeWidth="1.5"
                    strokeDasharray="4 4"
                    opacity="0.8"
                  />
                  <text x="50" y="293" fill="var(--ink-400)" fontSize="11" fontWeight="700" letterSpacing="0.08em">
                    BLOCK C • CENTRAL AUDITORIUM & ADVANCED SCIENCES
                  </text>

                  {/* Room Nodes */}
                  {filteredRooms.map((room) => {
                    const isSelected = room.id === activeRoomId;
                    const isHovered = hoveredRoom?.id === room.id;

                    return (
                      <g
                        key={room.id}
                        onClick={() => setActiveRoomId(room.id)}
                        onMouseEnter={() => setHoveredRoom(room)}
                        onMouseLeave={() => setHoveredRoom(null)}
                        className="cursor-pointer transition-all duration-200"
                      >
                        {/* Room polygon */}
                        <rect
                          x={room.map_x}
                          y={room.map_y}
                          width={room.map_w}
                          height={room.map_h}
                          rx="10"
                          fill={room.hex_fill}
                          fillOpacity={isSelected ? 0.95 : isHovered ? 0.85 : 0.75}
                          stroke={isSelected ? 'var(--ink-900)' : 'var(--ink-600)'}
                          strokeWidth={isSelected ? '2.5' : '1.2'}
                          filter="url(#paper-shadow)"
                        />

                        {/* Room short label */}
                        <text
                          x={room.map_x + 12}
                          y={room.map_y + 22}
                          fill="var(--ink-900)"
                          fontSize="12"
                          fontWeight="700"
                        >
                          {room.short_name}
                        </text>

                        {/* Room floor / capacity info */}
                        <text
                          x={room.map_x + 12}
                          y={room.map_y + 38}
                          fill="var(--ink-700)"
                          fontSize="10"
                          fontWeight="500"
                        >
                          {room.floor} • Cap: {room.capacity}
                        </text>

                        {/* Utilization Pill inside room */}
                        <rect
                          x={room.map_x + 12}
                          y={room.map_y + room.map_h - 26}
                          width={72}
                          height={18}
                          rx="5"
                          fill="var(--milk)"
                          stroke="var(--ink-400)"
                          strokeWidth="0.75"
                          opacity="0.95"
                        />
                        <text
                          x={room.map_x + 18}
                          y={room.map_y + room.map_h - 13}
                          fill="var(--ink-900)"
                          fontSize="10"
                          fontWeight="700"
                          fontFamily="monospace"
                        >
                          {room.utilization_pct}% Occ
                        </text>

                        {/* Active selection halo ring */}
                        {isSelected && (
                          <rect
                            x={room.map_x - 3}
                            y={room.map_y - 3}
                            width={room.map_w + 6}
                            height={room.map_h + 6}
                            rx="13"
                            fill="none"
                            stroke="var(--persimmon-500)"
                            strokeWidth="2"
                            strokeDasharray="3 3"
                          />
                        )}
                      </g>
                    );
                  })}
                </svg>

                {/* Hover Tooltip Overlay */}
                {hoveredRoom && (
                  <div
                    className="absolute pointer-events-none bg-[var(--milk)] border border-[var(--ink-300)] rounded-xl px-3 py-2 shadow-lg z-30 transition-all text-xs"
                    style={{
                      left: `${Math.min(hoveredRoom.map_x + 30, svgWidth - 180)}px`,
                      top: `${Math.max(10, hoveredRoom.map_y - 45)}px`,
                    }}
                  >
                    <p className="font-bold text-[var(--ink-900)]">{hoveredRoom.name}</p>
                    <div className="flex items-center gap-2 mt-0.5">
                      <span className="font-mono text-[var(--ink-700)]">
                        {hoveredRoom.current_attendees} / {hoveredRoom.capacity} Occupied
                      </span>
                      <span className="font-semibold text-[var(--ink-900)]">({hoveredRoom.utilization_pct}%)</span>
                    </div>
                  </div>
                )}
              </div>
            )}
          </div>

          {/* Color Legend (Brand Heatmap Scale: Sage -> Fern -> Apricot -> Persimmon -> Mulberry) */}
          <div className="flex flex-wrap items-center justify-between gap-3 mt-4 px-2 py-3 bg-[var(--milk)] border border-[var(--oat-200)] rounded-xl">
            <span className="text-xs font-semibold text-[var(--ink-700)]">Utilization Scale:</span>
            <div className="flex flex-wrap items-center gap-4 text-xs">
              <div className="flex items-center gap-1.5">
                <span className="w-3.5 h-3.5 rounded" style={{ backgroundColor: '#B9D3A8' }} />
                <span className="text-[var(--ink-700)]">0–25% (Sage: Low)</span>
              </div>
              <div className="flex items-center gap-1.5">
                <span className="w-3.5 h-3.5 rounded" style={{ backgroundColor: '#3F8F5B' }} />
                <span className="text-[var(--ink-700)]">25–50% (Fern: Moderate)</span>
              </div>
              <div className="flex items-center gap-1.5">
                <span className="w-3.5 h-3.5 rounded" style={{ backgroundColor: '#F08A3C' }} />
                <span className="text-[var(--ink-700)]">50–75% (Apricot: Brisk)</span>
              </div>
              <div className="flex items-center gap-1.5">
                <span className="w-3.5 h-3.5 rounded" style={{ backgroundColor: '#E4572E' }} />
                <span className="text-[var(--ink-700)]">75–90% (Persimmon: High)</span>
              </div>
              <div className="flex items-center gap-1.5">
                <span className="w-3.5 h-3.5 rounded" style={{ backgroundColor: '#7B2D5B' }} />
                <span className="text-[var(--ink-700)]">90–100% (Mulberry: Peak)</span>
              </div>
            </div>
          </div>
        </div>

        {/* Right Panel: Selected Room Details & Schedule */}
        {!compact && selectedRoom && (
          <div className="lg:col-span-4 bg-[var(--milk)] border border-[var(--oat-200)] rounded-2xl p-5 shadow-sm space-y-5">
            <div>
              <div className="flex items-center justify-between">
                <span className="text-xs font-semibold uppercase tracking-wider text-[var(--ink-500)]">
                  {selectedRoom.block} • {selectedRoom.floor}
                </span>
                <span
                  className="text-xs font-bold px-2 py-0.5 rounded-full"
                  style={{
                    backgroundColor: selectedRoom.hex_fill,
                    color: selectedRoom.utilization_pct > 50 ? '#FFF' : 'var(--ink-900)',
                  }}
                >
                  {selectedRoom.status_label}
                </span>
              </div>
              <h3 className="text-lg font-bold font-serif text-[var(--ink-900)] mt-1">
                {selectedRoom.name}
              </h3>
            </div>

            {/* Attendance vs Capacity progress bar */}
            <div className="bg-[var(--oat-100)] p-4 rounded-xl border border-[var(--oat-200)] space-y-2">
              <div className="flex justify-between text-xs font-medium">
                <span className="text-[var(--ink-600)]">Active Attendance / Capacity</span>
                <span className="font-mono font-bold text-[var(--ink-900)]">
                  {selectedRoom.current_attendees} / {selectedRoom.capacity} seats
                </span>
              </div>
              <div className="w-full bg-[var(--oat-200)] h-3 rounded-full overflow-hidden">
                <div
                  className="h-full rounded-full transition-all duration-300"
                  style={{
                    width: `${selectedRoom.utilization_pct}%`,
                    backgroundColor: selectedRoom.hex_fill,
                  }}
                />
              </div>
              <div className="flex justify-between text-[11px] text-[var(--ink-500)]">
                <span>{selectedRoom.utilization_pct}% capacity occupied</span>
                <span>{Math.max(0, selectedRoom.capacity - selectedRoom.current_attendees)} open</span>
              </div>
            </div>

            {/* Upcoming bookings list */}
            <div>
              <h4 className="text-xs font-bold uppercase tracking-wider text-[var(--ink-700)] mb-2 flex items-center justify-between">
                <span>Upcoming Bookings ({selectedRoom.upcoming_bookings.length})</span>
                <span className="text-[10px] font-normal text-[var(--ink-500)]">Today</span>
              </h4>

              {selectedRoom.upcoming_bookings.length === 0 ? (
                <div className="p-4 text-center border border-dashed border-[var(--oat-300)] rounded-xl text-xs text-[var(--ink-500)]">
                  No upcoming reservations today. Space is fully open for ad-hoc bookings!
                </div>
              ) : (
                <div className="space-y-2.5 max-h-[220px] overflow-y-auto pr-1">
                  {selectedRoom.upcoming_bookings.map((b) => (
                    <div
                      key={b.id}
                      className="p-3 bg-[var(--oat-50)] border border-[var(--oat-200)] rounded-xl text-xs space-y-1"
                    >
                      <div className="flex items-center justify-between">
                        <span className="font-mono font-bold text-[var(--fern-700)]">
                          {b.start_time} – {b.end_time}
                        </span>
                        <Badge variant="oat">
                          {b.attendees} / {b.capacity} pax
                        </Badge>
                      </div>
                      <p className="font-medium text-[var(--ink-900)] line-clamp-1">{b.project_name}</p>
                      <p className="text-[11px] text-[var(--ink-500)] line-clamp-1">
                        Reserved by {b.user_name}
                      </p>
                    </div>
                  ))}
                </div>
              )}
            </div>

            {/* Action buttons */}
            <div className="pt-2">
              {selectedRoom.resource_id ? (
                <Link to={`/resources/${selectedRoom.resource_id}`} className="block">
                  <Button variant="primary" className="w-full justify-center">
                    Book this Space
                  </Button>
                </Link>
              ) : (
                <Button
                  variant="secondary"
                  className="w-full justify-center"
                  onClick={() => onSelectResource?.(selectedRoom.id)}
                >
                  View Space Specs
                </Button>
              )}
            </div>
          </div>
        )}
      </div>
    </div>
  );
};
