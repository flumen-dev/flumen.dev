<template>
  <div class="px-4 py-3 border-b border-default last:border-b-0">
    <div class="flex items-start gap-3">
      <!-- State icon -->
      <USkeleton class="size-4 mt-0.5 rounded-full shrink-0" />

      <div class="min-w-0 flex-1 space-y-2">
        <!-- Row 1: Title + number -->
        <div class="flex items-center gap-2">
          <USkeleton class="h-4 w-48 rounded" />
          <USkeleton class="h-3 w-8 rounded" />
        </div>

        <!-- Row 2: Repo + labels -->
        <div class="flex items-center gap-2">
          <USkeleton class="h-3 w-28 rounded" />
          <USkeleton class="h-4 w-14 rounded-full" />
          <USkeleton class="h-4 w-10 rounded-full" />
        </div>

        <!-- Row 3: Stats bar -->
        <div class="flex items-center gap-3">
          <USkeleton class="h-3 w-8 rounded" />
          <USkeleton class="h-3 w-12 rounded" />
          <USkeleton class="h-3 w-10 rounded" />
          <USkeleton class="ml-auto h-3 w-14 rounded" />
        </div>
      </div>
    </div>
  </div>
</template>
