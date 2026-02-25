<template>
  <div class="border-b border-default last:border-b-0">
    <div class="flex items-start gap-3 px-4 py-3">
      <USkeleton class="size-4 mt-0.5 rounded-full shrink-0" />

      <div class="min-w-0 flex-1">
        <div class="flex items-center gap-2">
          <USkeleton class="h-4 w-52 rounded" />
          <USkeleton class="h-3 w-8 rounded" />
        </div>

        <div class="flex items-center gap-2 mt-0.5">
          <USkeleton class="h-3 w-24 rounded" />
          <USkeleton class="size-4 rounded-full" />
          <USkeleton class="h-3 w-16 rounded" />
          <USkeleton class="h-5 w-12 rounded-full" />
          <USkeleton class="ml-auto h-3 w-14 rounded" />
        </div>
      </div>
    </div>
  </div>
</template>
