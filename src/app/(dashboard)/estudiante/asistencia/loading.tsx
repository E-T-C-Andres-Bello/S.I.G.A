import { Skeleton } from "@/components/ui/skeleton";

export default function EstudianteAsistenciaLoading() {
  return (
    <div className="flex flex-col gap-5 pb-8" aria-busy="true">
      <div className="flex flex-col justify-between gap-3 sm:flex-row sm:items-end">
        <div className="space-y-2">
          <Skeleton className="h-8 w-64 rounded-xl" />
          <Skeleton className="h-4 w-80 rounded-lg" />
        </div>
        <Skeleton className="h-9 w-48 rounded-full" />
      </div>

      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        {[1, 2, 3, 4].map((idx) => (
          <Skeleton key={idx} className="h-28 rounded-2xl" />
        ))}
      </div>

      <div className="grid grid-cols-1 gap-5 lg:grid-cols-12">
        <Skeleton className="h-72 rounded-[24px] lg:col-span-7" />
        <Skeleton className="h-72 rounded-[24px] lg:col-span-5" />
      </div>

      <Skeleton className="h-80 rounded-[24px]" />
      <Skeleton className="h-96 rounded-[24px]" />
    </div>
  );
}
