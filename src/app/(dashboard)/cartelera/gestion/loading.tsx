import { Skeleton } from "@/components/ui/skeleton";

export default function CarteleraGestionLoading() {
  return (
    <div className="flex flex-col gap-5 pb-10">
      <div className="siga-glass-surface rounded-[28px] border p-6">
        <Skeleton className="h-5 w-52 rounded-full" />
        <Skeleton className="mt-3 h-8 w-72" />
        <Skeleton className="mt-2 h-4 w-96 max-w-full" />
      </div>

      <div className="grid grid-cols-1 gap-6 xl:grid-cols-12">
        <Skeleton className="h-[580px] rounded-[28px] xl:col-span-7" />
        <Skeleton className="h-[480px] rounded-[28px] xl:col-span-5" />
      </div>
    </div>
  );
}
