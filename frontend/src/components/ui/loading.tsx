import { Loader2 } from "lucide-react";
import { cn } from "@/lib/utils";

function Spinner({ className }: { className?: string }) {
  return <Loader2 className={cn("h-5 w-5 animate-spin", className)} aria-hidden="true" />;
}

function PageSpinner({ label = "Memuat data..." }: { label?: string }) {
  return (
    <div className="flex flex-col items-center justify-center gap-3 py-20 text-sm text-gray-500">
      <Spinner className="h-9 w-9 text-[var(--color-leaf-600)]" />
      <span>{label}</span>
    </div>
  );
}

function Skeleton({ className }: { className?: string }) {
  return <div className={cn("animate-pulse rounded-md bg-gray-200/80 dark:bg-gray-800/80", className)} />;
}

function ProductCardSkeleton() {
  return (
    <div className="glass overflow-hidden rounded-2xl">
      <Skeleton className="aspect-square rounded-none" />
      <div className="space-y-3 p-4">
        <Skeleton className="h-3 w-20" />
        <Skeleton className="h-4 w-full" />
        <Skeleton className="h-4 w-3/4" />
        <div className="flex items-end justify-between pt-2">
          <Skeleton className="h-5 w-24" />
          <Skeleton className="h-3 w-12" />
        </div>
      </div>
    </div>
  );
}

function ProductGridSkeleton({ count = 8 }: { count?: number }) {
  return (
    <div className="grid grid-cols-2 gap-5 md:grid-cols-3 lg:grid-cols-4">
      {Array.from({ length: count }).map((_, index) => (
        <ProductCardSkeleton key={index} />
      ))}
    </div>
  );
}

function CartSkeleton({ count = 3 }: { count?: number }) {
  return (
    <div className="grid grid-cols-1 gap-8 lg:grid-cols-[1fr_360px]">
      <div className="flex flex-col gap-3">
        {Array.from({ length: count }).map((_, index) => (
          <div key={index} className="glass flex items-center gap-4 rounded-2xl p-4">
            <Skeleton className="h-6 w-6 rounded-lg" />
            <Skeleton className="h-20 w-20 rounded-xl" />
            <div className="min-w-0 flex-1 space-y-3">
              <Skeleton className="h-4 w-3/4" />
              <Skeleton className="h-3 w-1/2" />
              <Skeleton className="h-5 w-28" />
            </div>
            <Skeleton className="h-9 w-28 rounded-lg" />
          </div>
        ))}
      </div>
      <div className="glass h-max rounded-2xl p-6">
        <Skeleton className="mb-6 h-6 w-36" />
        <div className="space-y-4">
          <Skeleton className="h-4 w-full" />
          <Skeleton className="h-4 w-5/6" />
          <Skeleton className="h-6 w-full" />
          <Skeleton className="h-12 w-full rounded-xl" />
        </div>
      </div>
    </div>
  );
}

function OrderListSkeleton({ count = 3 }: { count?: number }) {
  return (
    <div className="flex flex-col gap-4">
      {Array.from({ length: count }).map((_, index) => (
        <div key={index} className="rounded-2xl border border-gray-200 bg-white p-5 dark:border-gray-800 dark:bg-zinc-900">
          <div className="flex flex-col gap-4 md:flex-row md:items-start">
            <Skeleton className="h-12 w-12 rounded-xl" />
            <div className="flex-1 space-y-3">
              <Skeleton className="h-4 w-44" />
              <div className="flex items-start gap-3">
                <Skeleton className="h-14 w-14 rounded-xl" />
                <div className="flex-1 space-y-2">
                  <Skeleton className="h-4 w-2/3" />
                  <Skeleton className="h-3 w-1/2" />
                  <Skeleton className="h-3 w-3/4" />
                </div>
              </div>
            </div>
            <Skeleton className="h-7 w-32" />
          </div>
        </div>
      ))}
    </div>
  );
}

function TableRowsSkeleton({ columns, rows = 5 }: { columns: number; rows?: number }) {
  return (
    <>
      {Array.from({ length: rows }).map((_, rowIndex) => (
        <tr key={rowIndex} className="border-t border-gray-100 dark:border-gray-800">
          {Array.from({ length: columns }).map((_, columnIndex) => (
            <td key={columnIndex} className="p-4">
              <Skeleton className={cn("h-4", columnIndex === 0 ? "w-28" : "w-full")} />
            </td>
          ))}
        </tr>
      ))}
    </>
  );
}

function DashboardSkeleton() {
  return (
    <div className="space-y-8">
      <div className="grid grid-cols-1 gap-5 sm:grid-cols-2 xl:grid-cols-4">
        {Array.from({ length: 4 }).map((_, index) => (
          <div key={index} className="rounded-lg border bg-card p-5">
            <Skeleton className="mb-4 h-10 w-10 rounded-md" />
            <Skeleton className="mb-3 h-4 w-28" />
            <Skeleton className="mb-2 h-7 w-36" />
            <Skeleton className="h-3 w-24" />
          </div>
        ))}
      </div>
      <div className="grid grid-cols-1 gap-6 xl:grid-cols-[2fr_1fr]">
        <Skeleton className="h-80 rounded-lg" />
        <Skeleton className="h-80 rounded-lg" />
      </div>
      <div className="grid grid-cols-1 gap-6 lg:grid-cols-3">
        <Skeleton className="h-64 rounded-lg" />
        <Skeleton className="h-64 rounded-lg" />
        <Skeleton className="h-64 rounded-lg" />
      </div>
    </div>
  );
}

export {
  CartSkeleton,
  DashboardSkeleton,
  OrderListSkeleton,
  PageSpinner,
  ProductGridSkeleton,
  Skeleton,
  Spinner,
  TableRowsSkeleton,
};
