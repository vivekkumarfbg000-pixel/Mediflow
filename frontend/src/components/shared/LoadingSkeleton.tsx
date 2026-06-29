// Mediflow — Premium Loading Skeleton System
// Contextual shimmer skeletons for each dashboard type
// Replaces spinner-only Suspense fallback with professional progressive loading UI

import React from 'react';
import { BrandMark } from './BrandMark';

interface SkeletonProps {
  className?: string;
}

// Base shimmer block
function SkeletonBlock({ className = '' }: SkeletonProps) {
  return (
    <div
      className={`skeleton-shimmer rounded-lg ${className}`}
      aria-hidden="true"
    />
  );
}

// Metric card skeleton (used in all dashboards)
export function MetricCardSkeleton() {
  return (
    <div className="bg-white border border-slate-200/60 rounded-2xl p-5 space-y-3">
      <div className="flex items-center justify-between">
        <SkeletonBlock className="h-4 w-24" />
        <SkeletonBlock className="h-9 w-9 rounded-xl" />
      </div>
      <SkeletonBlock className="h-8 w-32 mt-1" />
      <SkeletonBlock className="h-3 w-20" />
    </div>
  );
}

// Table row skeleton
function TableRowSkeleton() {
  return (
    <div className="flex items-center gap-4 px-4 py-3 border-b border-slate-100">
      <SkeletonBlock className="h-9 w-9 rounded-full flex-shrink-0" />
      <div className="flex-1 space-y-2">
        <SkeletonBlock className="h-4 w-40" />
        <SkeletonBlock className="h-3 w-24" />
      </div>
      <SkeletonBlock className="h-6 w-20 rounded-full" />
      <SkeletonBlock className="h-8 w-16 rounded-lg" />
    </div>
  );
}

// Dashboard header skeleton
function DashboardHeaderSkeleton() {
  return (
    <div className="flex items-center justify-between mb-6">
      <div className="space-y-2">
        <SkeletonBlock className="h-7 w-52" />
        <SkeletonBlock className="h-4 w-36" />
      </div>
      <div className="flex gap-3">
        <SkeletonBlock className="h-10 w-28 rounded-xl" />
        <SkeletonBlock className="h-10 w-10 rounded-xl" />
      </div>
    </div>
  );
}

// Compounder / general dashboard skeleton
export function DashboardSkeleton() {
  return (
    <div className="p-4 md:p-6 space-y-6 animate-pulse" role="status" aria-label="Loading dashboard...">
      <DashboardHeaderSkeleton />

      {/* Metric cards row */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        {[0, 1, 2, 3].map(i => <MetricCardSkeleton key={i} />)}
      </div>

      {/* Table skeleton */}
      <div className="bg-white border border-slate-200/60 rounded-2xl overflow-hidden">
        {/* Table header */}
        <div className="flex items-center gap-4 px-4 py-3 bg-slate-50 border-b border-slate-200/60">
          {[80, 48, 32, 24].map((w, i) => (
            <SkeletonBlock key={i} className={`h-3 w-${w === 80 ? '40' : w === 48 ? '24' : w === 32 ? '16' : '12'}`} />
          ))}
        </div>
        {[0, 1, 2, 3, 4, 5].map(i => <TableRowSkeleton key={i} />)}
      </div>

      <span className="sr-only">Loading dashboard content, please wait...</span>
    </div>
  );
}

// Doctor dashboard skeleton (with chart placeholder)
export function DoctorDashboardSkeleton() {
  return (
    <div className="p-4 md:p-6 space-y-6 animate-pulse" role="status" aria-label="Loading doctor dashboard...">
      <DashboardHeaderSkeleton />
      <div className="grid grid-cols-3 gap-4">
        {[0, 1, 2].map(i => <MetricCardSkeleton key={i} />)}
      </div>

      <div className="grid md:grid-cols-2 gap-4">
        {/* Active encounters card */}
        <div className="bg-white border border-slate-200/60 rounded-2xl p-5 space-y-3">
          <SkeletonBlock className="h-5 w-36" />
          {[0, 1, 2].map(i => (
            <div key={i} className="flex items-center gap-3 p-3 bg-slate-50 rounded-xl">
              <SkeletonBlock className="h-10 w-10 rounded-full flex-shrink-0" />
              <div className="flex-1 space-y-2">
                <SkeletonBlock className="h-4 w-28" />
                <SkeletonBlock className="h-3 w-20" />
              </div>
              <SkeletonBlock className="h-8 w-20 rounded-lg" />
            </div>
          ))}
        </div>

        {/* Biomarker chart placeholder */}
        <div className="bg-white border border-slate-200/60 rounded-2xl p-5 space-y-3">
          <SkeletonBlock className="h-5 w-44" />
          <SkeletonBlock className="h-48 w-full rounded-xl" />
        </div>
      </div>

      <span className="sr-only">Loading doctor dashboard, please wait...</span>
    </div>
  );
}

// Lab dashboard skeleton (barcode / table focus)
export function LabDashboardSkeleton() {
  return (
    <div className="p-4 md:p-6 space-y-6 animate-pulse" role="status" aria-label="Loading lab dashboard...">
      <DashboardHeaderSkeleton />
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        {[0, 1, 2, 3].map(i => <MetricCardSkeleton key={i} />)}
      </div>
      {/* Tabs skeleton */}
      <div className="flex gap-2">
        {[0, 1, 2].map(i => (
          <SkeletonBlock key={i} className={`h-10 ${i === 0 ? 'w-36' : 'w-28'} rounded-xl`} />
        ))}
      </div>
      <div className="bg-white border border-slate-200/60 rounded-2xl overflow-hidden">
        {[0, 1, 2, 3, 4].map(i => <TableRowSkeleton key={i} />)}
      </div>
      <span className="sr-only">Loading lab dashboard, please wait...</span>
    </div>
  );
}

// Pharmacy dashboard skeleton
export function PharmacyDashboardSkeleton() {
  return (
    <div className="p-4 md:p-6 space-y-6 animate-pulse" role="status" aria-label="Loading pharmacy dashboard...">
      <DashboardHeaderSkeleton />
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        {[0, 1, 2, 3].map(i => <MetricCardSkeleton key={i} />)}
      </div>
      {/* Inventory grid skeleton */}
      <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-4">
        {[0, 1, 2, 3, 4, 5].map(i => (
          <div key={i} className="bg-white border border-slate-200/60 rounded-2xl p-4 space-y-3">
            <div className="flex justify-between">
              <SkeletonBlock className="h-4 w-32" />
              <SkeletonBlock className="h-6 w-16 rounded-full" />
            </div>
            <SkeletonBlock className="h-3 w-24" />
            <SkeletonBlock className="h-2 w-full rounded-full" />
            <div className="flex justify-between">
              <SkeletonBlock className="h-3 w-16" />
              <SkeletonBlock className="h-3 w-20" />
            </div>
          </div>
        ))}
      </div>
      <span className="sr-only">Loading pharmacy dashboard, please wait...</span>
    </div>
  );
}

// Full-page loading spinner (for initial auth check)
export function FullPageLoader({ message = 'Loading VitalSync...' }: { message?: string }) {
  return (
    <div className="min-h-screen bg-slate-50 flex flex-col items-center justify-center gap-6">
      {/* Animated VitalSync logo mark */}
      <div className="relative">
        <div className="w-16 h-16 rounded-2xl bg-white p-1 shadow-lg shadow-indigo-500/20 ring-1 ring-slate-200/70">
          <BrandMark size={56} title="VitalSync loading mark" />
        </div>
        {/* Orbiting pulse ring */}
        <div className="absolute inset-0 rounded-2xl border-2 border-indigo-400/30 animate-ping" />
      </div>

      <div className="text-center space-y-2">
        <div className="flex items-center gap-2">
          <div className="flex gap-1">
            {[0, 1, 2].map(i => (
              <div
                key={i}
                className="w-2 h-2 rounded-full bg-indigo-500 animate-bounce"
                style={{ animationDelay: `${i * 0.15}s` }}
              />
            ))}
          </div>
        </div>
        <p className="text-sm font-medium text-slate-500 tracking-wide">{message}</p>
      </div>
    </div>
  );
}
