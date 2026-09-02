<template>
  <div
    :class="variant === 'footer'
      ? 'rounded-lg border border-gray-200 dark:border-gray-700 bg-gray-50 dark:bg-gray-800/60 px-4 py-3 text-xs text-gray-600 dark:text-gray-400'
      : 'rounded-xl border border-primary-200 dark:border-primary-800 bg-primary-50 dark:bg-primary-900/20 px-4 py-4 text-sm text-gray-700 dark:text-gray-300'"
    data-testid="data-origin-callout"
  >
    <p class="font-medium text-gray-900 dark:text-gray-100 mb-1">
      Data origin — {{ team }}
    </p>
    <p class="mb-2">
      {{ sourceNote }}
    </p>
    <p v-if="coverageNote && variant !== 'footer'" class="mb-2 text-gray-600 dark:text-gray-400">
      {{ coverageNote }}
    </p>
    <p v-if="lastUpdated" class="mb-3 text-gray-500 dark:text-gray-400">
      Snapshot last updated {{ lastUpdated }}.
    </p>
    <div class="flex flex-wrap gap-x-4 gap-y-1">
      <a
        v-if="featureRequestUrl"
        :href="featureRequestUrl"
        target="_blank"
        rel="noopener noreferrer"
        class="text-primary-700 dark:text-primary-300 hover:underline font-medium"
        data-testid="feature-request-link"
      >
        Suggest a feature
      </a>
      <a
        v-if="customDataRequestUrl"
        :href="customDataRequestUrl"
        target="_blank"
        rel="noopener noreferrer"
        class="text-primary-700 dark:text-primary-300 hover:underline font-medium"
        data-testid="custom-data-request-link"
      >
        Request custom data
      </a>
      <a
        v-if="getInTouchUrl"
        :href="getInTouchUrl"
        target="_blank"
        rel="noopener noreferrer"
        class="text-primary-700 dark:text-primary-300 hover:underline font-medium"
      >
        Get in Touch
      </a>
    </div>
    <p v-if="contactHint && variant !== 'footer'" class="mt-2 text-xs text-gray-500 dark:text-gray-400">
      {{ contactHint }}
    </p>
  </div>
</template>

<script setup>
import { computed } from 'vue'

const props = defineProps({
  meta: { type: Object, default: null },
  variant: { type: String, default: 'banner' }
})

const team = computed(() => (props.meta && props.meta.stewardTeam) || 'Red Hat OSAIPO')
const sourceNote = computed(() => (props.meta && props.meta.sourceNote) ||
  'This catalog is a static snapshot curated by Red Hat OSAIPO and shipped with this module.')
const coverageNote = computed(() => props.meta && props.meta.coverageNote)
const lastUpdated = computed(() => props.meta && props.meta.lastUpdated)
const featureRequestUrl = computed(() => props.meta && props.meta.featureRequestUrl)
const customDataRequestUrl = computed(() => props.meta && props.meta.customDataRequestUrl)
const getInTouchUrl = computed(() => props.meta && props.meta.getInTouchUrl)
const contactHint = computed(() => props.meta && props.meta.contactHint)
</script>
