import { Skeleton } from "@/components/ui/skeleton";

export default function EstudiantePerfilLoading() {
  return (
    <div className="font-hero flex flex-col gap-5 pb-8">
      <div className="flex flex-col justify-between gap-3 sm:flex-row sm:items-end">
        <div className="space-y-2">
          <Skeleton className="h-8 w-64 rounded-xl" />
          <Skeleton className="h-4 w-80 max-w-full rounded-lg" />
        </div>
        <Skeleton className="h-10 w-full rounded-2xl sm:w-96" />
      </div>

      <Skeleton className="h-40 w-full rounded-[28px]" />

      <div className="grid grid-cols-1 gap-5 lg:grid-cols-12">
        <Skeleton className="h-80 w-full rounded-[28px] lg:col-span-5" />
        <Skeleton className="h-80 w-full rounded-[28px] lg:col-span-7" />
      </div>
    </div>
  );
}
