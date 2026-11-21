import { Skeleton } from "@/components/ui/skeleton";

export default function DashboardLoading() {
  return (
    <div
      aria-busy="true"
      aria-label="Cargando módulo"
      className="mx-auto flex max-w-7xl flex-col gap-6 pb-10"
    >
      <Skeleton className="h-36 w-full rounded-3xl" />

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <Skeleton className="h-28 rounded-2xl" />
        <Skeleton className="h-28 rounded-2xl" />
        <Skeleton className="h-28 rounded-2xl" />
        <Skeleton className="h-28 rounded-2xl" />
      </div>

      <div className="flex flex-wrap gap-2">
        <Skeleton className="h-10 w-52 rounded-2xl" />
        <Skeleton className="h-10 w-40 rounded-2xl" />
        <Skeleton className="h-10 w-40 rounded-2xl" />
      </div>

      <Skeleton className="h-80 w-full rounded-3xl" />
    </div>
  );
}
