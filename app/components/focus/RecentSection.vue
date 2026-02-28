<script setup lang="ts">
import type { FreeformItemData } from 'nuxt-freeform'

const { t } = useI18n()
const recentStore = useRecentStore()

interface RecentDragItem extends FreeformItemData {
  id: string
}

function makeDragModel(
  getItems: () => { key: string }[],
  move: (from: number, to: number) => void,
) {
  return computed<RecentDragItem[]>({
    get: () => getItems().map(i => ({ id: i.key })),
    set: (newOrder) => {
      const oldOrder = getItems().map(i => i.key)
      for (let to = 0; to < newOrder.length; to++) {
        const from = oldOrder.indexOf(newOrder[to]!.id)
        if (from !== to) {
          move(from, to)
          return
        }
      }
    },
  })
}

const favDragItems = makeDragModel(
  () => recentStore.favorites,
  (from, to) => recentStore.moveFavorite(from, to),
)

const recentDragItems = makeDragModel(
  () => recentStore.items,
  (from, to) => recentStore.moveItem(from, to),
)

const isEmpty = computed(() => recentStore.items.length === 0 && recentStore.favorites.length === 0)
</script>

<template>
  <div
    v-if="isEmpty"
    class="p-6 text-center"
  >
    <UIcon
      name="i-lucide-activity"
      class="size-8 text-dimmed mx-auto mb-2"
    />
    <p class="text-sm text-muted">
      {{ t('focus.recent.empty') }}
    </p>
  </div>

  <ClientOnly v-else>
    <!-- Favorites -->
    <div
      v-if="recentStore.favorites.length > 0"
      class="border-b border-default"
    >
      <div class="flex items-center gap-1.5 px-3 pt-2 pb-1">
        <UIcon
          name="i-lucide-star"
          class="size-3.5 text-amber-400"
        />
        <span class="text-xs font-medium text-muted">{{ t('focus.recent.favorites') }}</span>
      </div>

      <div class="max-h-50 overflow-y-auto pt-1 pr-1">
        <TheFreeform
          v-model="favDragItems"
          class="flex flex-wrap gap-2 px-3 pb-3"
        >
          <FreeformItem
            v-for="item in recentStore.favorites"
            :key="item.key"
            :item="{ id: item.key }"
            class="w-56"
          >
            <template #default="{ dragging }">
              <FocusRecentCard
                :item="item"
                :dragging="dragging"
                variant="favorite"
                @toggle-favorite="recentStore.removeFavorite(item.key)"
              />
            </template>
          </FreeformItem>

          <FreeformPlaceholder class="w-56">
            <div class="rounded-lg border-2 border-dashed border-amber-500/20 bg-amber-500/5 p-3 h-full" />
          </FreeformPlaceholder>
        </TheFreeform>
      </div>
    </div>

    <!-- Recent -->
    <TheFreeform
      v-if="recentStore.items.length > 0"
      v-model="recentDragItems"
      class="flex flex-wrap gap-2 p-3"
    >
      <FreeformItem
        v-for="item in recentStore.items"
        :key="item.key"
        :item="{ id: item.key }"
        class="w-56"
      >
        <template #default="{ dragging }">
          <FocusRecentCard
            :item="item"
            :dragging="dragging"
            variant="recent"
            @toggle-favorite="recentStore.addFavorite(item.key)"
          />
        </template>
      </FreeformItem>

      <FreeformPlaceholder class="w-56">
        <div class="rounded-lg border-2 border-dashed border-default p-3 h-full" />
      </FreeformPlaceholder>
    </TheFreeform>
  </ClientOnly>
</template>
