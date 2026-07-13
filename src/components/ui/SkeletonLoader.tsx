import { Skeleton } from "@/components/ui/skeleton";

export const SkeletonCard = () => (
  <div className="glass-container border-primary/20 p-6 space-y-4">
    <div className="flex items-center space-x-4">
      <Skeleton className="h-12 w-12 rounded-lg" />
      <div className="space-y-2 flex-1">
        <Skeleton className="h-4 w-3/4" />
        <Skeleton className="h-3 w-1/2" />
      </div>
    </div>
    <div className="space-y-2">
      <Skeleton className="h-3 w-full" />
      <Skeleton className="h-3 w-full" />
      <Skeleton className="h-3 w-3/4" />
    </div>
  </div>
);

export const SkeletonGrid = ({ count = 3 }: { count?: number }) => (
  <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
    {Array.from({ length: count }).map((_, i) => (
      <SkeletonCard key={i} />
    ))}
  </div>
);

export const SkeletonHero = () => (
  <div className="min-h-screen flex items-center justify-center px-4">
    <div className="container mx-auto">
      <div className="grid lg:grid-cols-2 gap-8 items-center">
        <div className="text-center lg:text-left space-y-6">
          <Skeleton className="h-6 w-32 mx-auto lg:mx-0" />
          <div className="space-y-4">
            <Skeleton className="h-8 w-full" />
            <Skeleton className="h-8 w-4/5" />
            <Skeleton className="h-8 w-3/4" />
          </div>
          <div className="space-y-2">
            <Skeleton className="h-4 w-full" />
            <Skeleton className="h-4 w-5/6" />
          </div>
          <div className="flex gap-4 justify-center lg:justify-start">
            <Skeleton className="h-12 w-48" />
            <Skeleton className="h-12 w-32" />
          </div>
        </div>
        <div className="flex justify-center">
          <Skeleton className="h-80 w-80 rounded-full" />
        </div>
      </div>
    </div>
  </div>
);