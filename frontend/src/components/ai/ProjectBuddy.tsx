import React, { useState } from 'react';
import { useMutation } from '@tanstack/react-query';
import { Link } from 'react-router-dom';
import { api } from '../../api/client';
import { AiRecommendationResponse, AiRecommendationItem } from '../../api/types';
import { Badge, Button } from '../ui';

interface ProjectBuddyProps {
  initialQuery?: string;
  onBookResource?: (resourceId: string) => void;
  className?: string;
}

const QUICK_PROMPTS = [
  'Line-following robot for national robotics challenge',
  'Short documentary film shoot with interviews',
  '3D prototype fabrication with SLA resin parts',
  'Interactive IoT sensor node with logic analyzer',
  'Academic symposium presentation in tiered hall',
];

export const ProjectBuddy: React.FC<ProjectBuddyProps> = ({
  initialQuery = '',
  onBookResource,
  className = '',
}) => {
  const [query, setQuery] = useState<string>(initialQuery);
  const [timeframeDays, setTimeframeDays] = useState<number>(7);

  const recommendMutation = useMutation({
    mutationFn: (projectQuery: string) =>
      api.getAiRecommendations(projectQuery, timeframeDays),
  });

  const handleSearch = (e?: React.FormEvent) => {
    if (e) e.preventDefault();
    if (!query.trim()) return;
    recommendMutation.mutate(query.trim());
  };

  const handleQuickPrompt = (prompt: string) => {
    setQuery(prompt);
    recommendMutation.mutate(prompt);
  };

  const data: AiRecommendationResponse | undefined = recommendMutation.data;

  return (
    <div
      className={`bg-[var(--milk)] border-2 border-[var(--lilac-300)] rounded-3xl p-6 shadow-sm overflow-hidden text-[var(--ink-900)] ${className}`}
    >
      {/* Header bar with Lilac Accent */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pb-5 border-b border-[var(--oat-200)]">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-2xl bg-[var(--lilac-100)] border border-[var(--lilac-200)] flex items-center justify-center text-[var(--lilac-700)] shadow-sm">
            <svg
              className="w-5 h-5"
              fill="none"
              stroke="currentColor"
              viewBox="0 0 24 24"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d="M13 10V3L4 14h7v7l9-11h-7z"
              />
            </svg>
          </div>
          <div>
            <div className="flex items-center gap-2">
              <h2 className="text-xl font-bold font-serif text-[var(--ink-900)]">
                Project Buddy
              </h2>
              {data && (
                <Badge
                  variant={data.badge === 'AI-assisted' ? 'mulberry' : 'lilac'}
                >
                  {data.badge}
                </Badge>
              )}
            </div>
            <p className="text-xs text-[var(--ink-600)]">
              AI recommendation assistant for student projects, labs, and equipment.
            </p>
          </div>
        </div>

        {/* Timeframe selector */}
        <div className="flex items-center gap-2 text-xs bg-[var(--oat-100)] border border-[var(--oat-200)] px-3 py-1.5 rounded-xl">
          <span className="text-[var(--ink-500)]">Window:</span>
          {[7, 14, 21].map((days) => (
            <button
              key={days}
              type="button"
              onClick={() => setTimeframeDays(days)}
              className={`px-2 py-0.5 rounded font-medium transition-all ${
                timeframeDays === days
                  ? 'bg-[var(--milk)] text-[var(--ink-900)] shadow-xs'
                  : 'text-[var(--ink-600)] hover:text-[var(--ink-900)]'
              }`}
            >
              {days}d
            </button>
          ))}
        </div>
      </div>

      {/* Input Form */}
      <form onSubmit={handleSearch} className="mt-5 space-y-3">
        <div className="relative">
          <input
            type="text"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Describe your project (e.g. 'I am developing a line-following robot for a national robotics competition')..."
            className="w-full bg-[var(--oat-50)] border border-[var(--oat-300)] focus:border-[var(--lilac-500)] focus:ring-2 focus:ring-[var(--lilac-100)] rounded-2xl py-3.5 pl-4 pr-28 text-sm text-[var(--ink-900)] placeholder-[var(--ink-400)] transition-all outline-none"
          />
          <div className="absolute right-2 top-2">
            <Button
              type="submit"
              variant="primary"
              size="sm"
              loading={recommendMutation.isPending}
              disabled={!query.trim()}
              className="bg-[var(--lilac-600)] hover:bg-[var(--lilac-700)] text-white border-none rounded-xl px-4 py-2"
            >
              Discover
            </Button>
          </div>
        </div>

        {/* Quick prompt chips */}
        <div className="flex flex-wrap items-center gap-1.5 pt-1">
          <span className="text-[11px] font-semibold text-[var(--ink-500)] uppercase tracking-wider mr-1">
            Try:
          </span>
          {QUICK_PROMPTS.map((p) => (
            <button
              key={p}
              type="button"
              onClick={() => handleQuickPrompt(p)}
              className="text-xs bg-[var(--oat-100)] hover:bg-[var(--lilac-50)] text-[var(--ink-700)] hover:text-[var(--lilac-800)] border border-[var(--oat-200)] hover:border-[var(--lilac-200)] px-2.5 py-1 rounded-lg transition-colors cursor-pointer"
            >
              {p}
            </button>
          ))}
        </div>
      </form>

      {/* Structured Needs Extracted Tags */}
      {data && data.needs && data.needs.length > 0 && (
        <div className="mt-6 p-3.5 bg-[var(--oat-50)] border border-[var(--oat-200)] rounded-2xl flex flex-wrap items-center gap-2">
          <span className="text-xs font-semibold text-[var(--ink-600)]">Synthesized Needs:</span>
          {data.needs.map((need, idx) => (
            <span
              key={idx}
              className="text-xs font-medium px-2.5 py-0.5 rounded-lg bg-[var(--milk)] border border-[var(--lilac-200)] text-[var(--lilac-800)]"
            >
              {need.keyword} ({need.category})
            </span>
          ))}
        </div>
      )}

      {/* Results Section */}
      {recommendMutation.isPending && (
        <div className="py-12 flex flex-col items-center justify-center gap-3">
          <div className="w-8 h-8 border-2 border-[var(--lilac-500)] border-t-transparent rounded-full animate-spin" />
          <p className="text-xs text-[var(--ink-600)]">
            Synthesizing requirements & verifying live 7-day slot availability...
          </p>
        </div>
      )}

      {data && !recommendMutation.isPending && (
        <div className="mt-6 space-y-6">
          {/* Top Recommendations */}
          <div>
            <h3 className="text-sm font-bold uppercase tracking-wider text-[var(--ink-700)] mb-3 flex items-center justify-between">
              <span>Primary Matched Resources ({data.recommendations.length})</span>
              <span className="text-xs font-normal text-[var(--ink-500)]">
                Ranked by relevance & availability
              </span>
            </h3>

            {data.recommendations.length === 0 ? (
              <div className="p-6 text-center border border-dashed border-[var(--oat-300)] rounded-2xl text-xs text-[var(--ink-500)]">
                No matching resources found for this specific query. Try adjusting your search description.
              </div>
            ) : (
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                {data.recommendations.map((res) => (
                  <RecommendationCard
                    key={res.id}
                    item={res}
                    onBook={onBookResource}
                  />
                ))}
              </div>
            )}
          </div>

          {/* Alternatives & Fallbacks */}
          {data.alternatives && data.alternatives.length > 0 && (
            <div className="pt-4 border-t border-[var(--oat-200)]">
              <h3 className="text-xs font-bold uppercase tracking-wider text-[var(--ink-600)] mb-3 flex items-center gap-2">
                <span className="w-2 h-2 rounded-full bg-[var(--apricot-500)]" />
                Alternative & Auxiliary Options
              </h3>
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                {data.alternatives.map((res) => (
                  <RecommendationCard
                    key={res.id}
                    item={res}
                    isAlternative
                    onBook={onBookResource}
                  />
                ))}
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
};

interface CardProps {
  item: AiRecommendationItem;
  isAlternative?: boolean;
  onBook?: (id: string) => void;
}

const RecommendationCard: React.FC<CardProps> = ({
  item,
  isAlternative = false,
  onBook,
}) => {
  return (
    <div
      className={`flex flex-col justify-between bg-[var(--oat-50)] border rounded-2xl p-4 transition-all hover:shadow-md ${
        isAlternative
          ? 'border-[var(--oat-300)] opacity-90'
          : 'border-[var(--lilac-200)] bg-[var(--milk)]'
      }`}
    >
      <div>
        {/* Image / Header */}
        <div className="flex items-start gap-3 mb-3">
          {item.image_url ? (
            <img
              src={item.image_url}
              alt={item.name}
              className="w-14 h-14 rounded-xl object-cover border border-[var(--oat-200)] flex-shrink-0"
            />
          ) : (
            <div className="w-14 h-14 rounded-xl bg-[var(--oat-200)] border border-[var(--oat-300)] flex items-center justify-center text-[var(--ink-500)] font-bold text-lg flex-shrink-0">
              {item.name.charAt(0)}
            </div>
          )}
          <div className="min-w-0 flex-1">
            <div className="flex items-center gap-1.5 mb-0.5">
              <Badge variant="oat">
                {item.category}
              </Badge>
              <span className="text-[10px] font-mono text-[var(--ink-500)]">
                {item.department}
              </span>
            </div>
            <h4 className="text-sm font-bold text-[var(--ink-900)] leading-tight line-clamp-1">
              {item.name}
            </h4>
            <p className="text-[11px] text-[var(--ink-500)] line-clamp-1">{item.location}</p>
          </div>
        </div>

        {/* AI Match Reason */}
        <div className="bg-[var(--oat-100)] rounded-xl p-2.5 mb-3 border border-[var(--oat-200)]">
          <p className="text-xs text-[var(--ink-700)] leading-snug">
            <span className="font-semibold text-[var(--lilac-800)] mr-1">Match Reason:</span>
            {item.reason}
          </p>
        </div>

        {/* Next Free Slot & Eligibility */}
        <div className="space-y-1.5 text-xs mb-3">
          {item.next_free_slot ? (
            <div className="flex items-center gap-1.5 text-[var(--fern-700)]">
              <span className="w-2 h-2 rounded-full bg-[var(--fern-500)] flex-shrink-0" />
              <span className="font-mono text-[11px] font-medium">
                Free slot: {item.next_free_slot.start}
              </span>
            </div>
          ) : (
            <div className="flex items-center gap-1.5 text-[var(--persimmon-700)]">
              <span className="w-2 h-2 rounded-full bg-[var(--persimmon-500)] flex-shrink-0" />
              <span className="text-[11px]">No slots in next 7d</span>
            </div>
          )}

          <div className="flex items-center gap-1.5 text-[11px]">
            {item.is_eligible ? (
              <span className="text-[var(--fern-700)] flex items-center gap-1">
                ✓ <span className="text-[var(--ink-600)]">Student eligible</span>
              </span>
            ) : (
              <span className="text-[var(--persimmon-700)] flex items-center gap-1">
                ✕ <span className="text-[var(--ink-600)]">{item.eligibility_note}</span>
              </span>
            )}
          </div>
        </div>
      </div>

      {/* Action */}
      <div className="pt-2 border-t border-[var(--oat-200)] flex items-center justify-between gap-2">
        <Link
          to={`/resources/${item.id}`}
          className="text-xs font-semibold text-[var(--ink-700)] hover:text-[var(--ink-900)] underline"
        >
          View Details
        </Link>
        <Link to={`/resources/${item.id}`}>
          <Button
            size="sm"
            variant={item.is_eligible && item.is_available ? 'primary' : 'secondary'}
            className="text-xs px-3 py-1.5"
            onClick={() => onBook?.(item.id)}
          >
            {item.is_available ? 'Book Slot' : 'Join Waitlist'}
          </Button>
        </Link>
      </div>
    </div>
  );
};
