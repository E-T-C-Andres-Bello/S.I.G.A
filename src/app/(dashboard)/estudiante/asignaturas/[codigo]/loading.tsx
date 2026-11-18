import { Skeleton } from "@/components/ui/skeleton";

export default function AsignaturaDetailLoading() {
  return (
    <div
      aria-busy="true"
      aria-label="Cargando detalle de asignatura"
      className="flex flex-col gap-5 pb-8"
    >
      <div className="flex items-center justify-between gap-3">
        <Skeleton className="h-9 w-48 rounded-xl" />
        <Skeleton className="h-9 w-64 rounded-xl" />
      </div>

      <Skeleton className="h-52 w-full rounded-[28px]" />

      <div className="grid grid-cols-1 gap-6 xl:grid-cols-12">
        <Skeleton className="h-96 rounded-[28px] xl:col-span-8" />
        <Skeleton className="h-80 rounded-[24px] xl:col-span-4" />
      </div>
    </div>
  );
}
