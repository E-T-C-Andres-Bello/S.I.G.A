import { Skeleton } from "@/components/ui/skeleton";

export default function AsignaturasLoading() {
  return (
    <div
      aria-busy="true"
      aria-label="Cargando asignaturas y mapa curricular"
      className="flex flex-col gap-5 pb-8"
    >
      <div className="space-y-2">
        <Skeleton className="h-8 w-72 rounded-xl" />
        <Skeleton className="h-4 w-96 max-w-full rounded-lg" />
      </div>

      <Skeleton className="h-10 w-64 rounded-xl" />

      <div className="flex flex-col gap-2.5">
        <Skeleton className="h-16 rounded-2xl" />
        <Skeleton className="h-16 rounded-2xl" />
        <Skeleton className="h-16 rounded-2xl" />
        <Skeleton className="h-16 rounded-2xl" />
        <Skeleton className="h-16 rounded-2xl" />
      </div>
    </div>
  );
}
