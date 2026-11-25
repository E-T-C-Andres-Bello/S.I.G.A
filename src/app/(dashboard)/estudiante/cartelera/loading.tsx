import { Skeleton } from "@/components/ui/skeleton";

export default function EstudianteCarteleraLoading() {
  return (
    <div className="flex flex-col gap-6 pb-8">
      <div className="siga-glass-surface rounded-[28px] border p-6">
        <Skeleton className="h-5 w-44 rounded-full" />
        <Skeleton className="mt-3 h-8 w-64" />
        <Skeleton className="mt-2 h-4 w-96 max-w-full" />
      </div>

      <Skeleton className="h-[420px] w-full rounded-[28px]" />

      <div className="grid grid-cols-1 gap-5 md:grid-cols-2 xl:grid-cols-3">
        {Array.from({ length: 6 }, (_, i) => (
          <Skeleton key={i} className="h-72 rounded-[24px]" />
        ))}
      </div>
    </div>
  );
}
