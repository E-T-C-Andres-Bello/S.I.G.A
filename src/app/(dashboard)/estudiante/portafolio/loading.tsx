import { Skeleton } from "@/components/ui/skeleton";

export default function EstudiantePortafolioLoading() {
  return (
    <div className="mx-auto flex w-full max-w-[1440px] flex-col gap-5 pb-10">
      <Skeleton className="h-24 w-full rounded-2xl" />
      <Skeleton className="h-28 w-full rounded-2xl" />
      <div className="grid grid-cols-1 gap-6 xl:grid-cols-12">
        <Skeleton className="h-[520px] rounded-2xl xl:col-span-5" />
        <Skeleton className="h-[680px] rounded-2xl xl:col-span-7" />
      </div>
    </div>
  );
}
