import { Skeleton } from "@/components/ui/skeleton";

export default function EstudianteLoading() {
  return (
    <div
      aria-busy="true"
      aria-label="Cargando portal del estudiante"
      className="flex flex-col gap-5 pb-8"
    >
      <div className="flex flex-col justify-between gap-3 sm:flex-row sm:items-end">
        <div className="space-y-2">
          <Skeleton className="h-9 w-64 rounded-xl" />
          <Skeleton className="h-4 w-80 rounded-lg" />
        </div>
        <Skeleton className="h-8 w-44 rounded-full" />
      </div>

      <Skeleton className="h-11 w-full rounded-2xl sm:w-96" />

      <div className="grid grid-cols-1 gap-5 lg:grid-cols-12">
        <Skeleton className="h-64 rounded-[28px] lg:col-span-8" />
        <Skeleton className="h-64 rounded-[28px] lg:col-span-4" />
      </div>

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <Skeleton className="h-36 rounded-[24px]" />
        <Skeleton className="h-36 rounded-[24px]" />
        <Skeleton className="h-36 rounded-[24px]" />
        <Skeleton className="h-36 rounded-[24px]" />
      </div>
    </div>
  );
}
