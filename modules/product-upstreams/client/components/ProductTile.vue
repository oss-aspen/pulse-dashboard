<template>
  <component
    :is="available ? 'button' : 'div'"
    :type="available ? 'button' : undefined"
    class="rounded-xl border p-4 text-left transition-all duration-150 h-full w-full"
    :class="tileClass"
    :data-testid="'product-tile-' + product.id"
    :data-available="available ? 'true' : 'false'"
    :aria-disabled="available ? undefined : 'true'"
    @click="onSelect"
  >
    <div class="flex items-start justify-between gap-2 mb-2">
      <h3 class="text-base font-semibold" :class="titleClass">
        {{ product.shortName || product.name }}
      </h3>
      <span
        class="shrink-0 inline-flex items-center px-2 py-0.5 rounded text-xs font-semibold"
        :class="badgeClass"
      >
        {{ product.available !== false ? (product.version ? 'v' + product.version : 'Available') : 'Not yet catalogued' }}
      </span>
    </div>
    <p class="text-sm mb-3" :class="descriptionClass">
      {{ product.name }}
    </p>
    <p class="text-sm mb-3 line-clamp-3" :class="descriptionClass">
      {{ product.description }}
    </p>
    <p v-if="product.available !== false" class="text-xs" :class="metaClass">
      {{ upstreamCount }} upstream{{ upstreamCount === 1 ? '' : 's' }}
    </p>
    <p v-else class="text-xs" :class="metaClass">
      {{ product.unavailableReason || 'Listed for awareness — mapping is not published yet.' }}
    </p>
  </component>
</template>

<script setup>
import { computed } from 'vue'

const props = defineProps({
  product: { type: Object, required: true }
})

const emit = defineEmits(['select'])

const available = computed(() => props.product.available !== false)
const upstreamCount = computed(() => (props.product.upstreams || []).length)

function onSelect() {
  if (available.value) {
    emit('select')
  }
}

const tileClass = computed(() => available.value
  ? 'border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800 hover:border-primary-400 dark:hover:border-primary-500 hover:shadow-md cursor-pointer'
  : 'border-gray-200 dark:border-gray-800 bg-gray-100 dark:bg-gray-900/60 opacity-60 grayscale cursor-not-allowed')

const titleClass = computed(() => available.value
  ? 'text-gray-900 dark:text-gray-100'
  : 'text-gray-500 dark:text-gray-400')

const descriptionClass = computed(() => available.value
  ? 'text-gray-600 dark:text-gray-400'
  : 'text-gray-500 dark:text-gray-500')

const metaClass = computed(() => available.value
  ? 'text-gray-500 dark:text-gray-400'
  : 'text-gray-400 dark:text-gray-500')

const badgeClass = computed(() => available.value
  ? 'bg-primary-100 dark:bg-primary-900/40 text-primary-700 dark:text-primary-300'
  : 'bg-gray-200 dark:bg-gray-800 text-gray-500 dark:text-gray-400')
</script>
