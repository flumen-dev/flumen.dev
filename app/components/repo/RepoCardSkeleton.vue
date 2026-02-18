<template>
  <div class="px-4 py-3">
    <div class="flex items-start gap-3">
      <!-- Activity dot -->
      <USkeleton class="mt-1.5 size-2.5 rounded-full shrink-0" />

      <!-- Content -->
      <div class="min-w-0 flex-1 space-y-2">
        <!-- Row 1: Name + badges + time -->
        <div class="flex items-center gap-2">
          <USkeleton class="h-4 w-36 rounded" />
          <USkeleton class="h-4 w-12 rounded" />
          <div class="ml-auto flex items-center gap-2">
            <USkeleton class="h-3 w-16 rounded" />
            <USkeleton class="h-3 w-14 rounded" />
          </div>
        </div>

        <!-- Row 2: Description -->
        <USkeleton class="h-3.5 w-3/4 rounded" />

        <!-- Row 3: Stats (language dot + language + star + fork + topics) -->
        <div class="flex items-center gap-3">
          <div class="flex items-center gap-1">
            <USkeleton class="size-2.5 rounded-full" />
            <USkeleton class="h-3 w-14 rounded" />
          </div>
          <div class="flex items-center gap-1">
            <USkeleton class="size-3.5 rounded" />
            <USkeleton class="h-3 w-6 rounded" />
          </div>
          <div class="flex items-center gap-1">
            <USkeleton class="size-3.5 rounded" />
            <USkeleton class="h-3 w-6 rounded" />
          </div>
          <div class="ml-auto flex items-center gap-1">
            <USkeleton class="h-4 w-12 rounded-full" />
            <USkeleton class="h-4 w-16 rounded-full" />
          </div>
        </div>
      </div>
    </div>
  </div>
</template>
