import { Skeleton } from "@/components/ui/skeleton";

/** Grey placeholder of the home page shown while the first data loads. */
const HomeSkeleton = () => (
  <div dir="rtl" className="min-h-screen bg-background" role="status" aria-label="טוען">
    <div className="h-[60px] px-4 flex items-center justify-between border-b border-border">
      <Skeleton className="h-5 w-7" />
      <Skeleton className="h-10 w-10 rounded-full" />
      <Skeleton className="h-9 w-20 rounded-full" />
    </div>
    <Skeleton className="h-[260px] w-full rounded-none" />
    <div className="mx-auto max-w-screen-md px-4 pt-5 flex flex-col gap-3.5">
      <div className="flex gap-4 pb-3.5 border-b border-border">
        <Skeleton className="h-[18px] w-28" />
        <Skeleton className="h-[18px] w-24" />
        <Skeleton className="h-[18px] w-16" />
      </div>
      <Skeleton className="h-6 w-44" />
      {[0, 1, 2].map((i) => (
        <div key={i} className="flex gap-3.5 p-3 rounded-2xl border border-border bg-card/50">
          <Skeleton className="h-[118px] w-[118px] shrink-0 rounded-xl" />
          <div className="flex-1 flex flex-col gap-2 pt-1">
            <Skeleton className="h-[18px] w-3/4" />
            <Skeleton className="h-3 w-[95%]" />
            <Skeleton className="h-3 w-4/5" />
            <div className="mt-auto flex items-center justify-between">
              <Skeleton className="h-[18px] w-12" />
              <Skeleton className="h-11 w-11 rounded-full" />
            </div>
          </div>
        </div>
      ))}
    </div>
  </div>
);

export default HomeSkeleton;
