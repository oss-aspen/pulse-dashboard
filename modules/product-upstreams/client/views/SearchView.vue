<template>
  <div class="max-w-6xl mx-auto px-4 py-6">
    <div class="mb-6">
      <h1 class="text-2xl font-bold text-gray-900 dark:text-gray-100">Package Search</h1>
      <p class="mt-2 text-gray-600 dark:text-gray-400">
        Search the Red Hat AI Engineering catalog by package name. Results show the version we
        recorded, the product that ships it, and the upstream source URL.
      </p>
    </div>

    <div class="mb-6">
      <label class="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1" for="package-search-input">
        Package name
      </label>
      <input
        id="package-search-input"
        v-model="queryInput"
        type="search"
        placeholder="Try vllm, kserve, instructlab, or kfp"
        class="w-full px-3 py-2 text-sm border border-gray-200 dark:border-gray-600
               bg-white dark:bg-gray-800 text-gray-900 dark:text-gray-100 rounded-lg
               focus:ring-2 focus:ring-primary-500 focus:border-primary-500 outline-none"
        data-testid="package-search-input"
      />
      <p class="mt-1 text-xs text-gray-500 dark:text-gray-400">
        Matches are substring searches against package names and versions in the static snapshot.
        Missing a package?
        <a
          v-if="meta && meta.customDataRequestUrl"
          :href="meta.customDataRequestUrl"
          target="_blank"
          rel="noopener noreferrer"
          class="text-primary-700 dark:text-primary-300 hover:underline"
        >Request custom data</a>
        or
        <a
          v-if="meta && meta.featureRequestUrl"
          :href="meta.featureRequestUrl"
          target="_blank"
          rel="noopener noreferrer"
          class="text-primary-700 dark:text-primary-300 hover:underline"
        >suggest a feature</a>.
      </p>
    </div>

    <div v-if="loading && !catalog" class="h-32 rounded-xl bg-gray-200 dark:bg-gray-700 animate-pulse" />

    <div v-else-if="error" class="text-center py-12">
      <p class="text-red-600 dark:text-red-400">{{ error }}</p>
    </div>

    <div v-else-if="!query" class="text-sm text-gray-500 dark:text-gray-400" data-testid="search-empty-hint">
      Enter a package name to search the catalogued products.
    </div>

    <div v-else-if="!results.length" class="text-sm text-gray-500 dark:text-gray-400" data-testid="search-no-results">
      No packages match "{{ query }}". This snapshot only includes catalogued products.
      Grayed-out products on the Products page are not searchable yet —
      <a
        v-if="meta && meta.customDataRequestUrl"
        :href="meta.customDataRequestUrl"
        target="_blank"
        rel="noopener noreferrer"
        class="text-primary-700 dark:text-primary-300 hover:underline"
      >request custom data</a>
      if you need them.
    </div>

    <div v-else>
      <p class="mb-3 text-sm text-gray-500 dark:text-gray-400">
        {{ results.length }} match{{ results.length === 1 ? '' : 'es' }} in the AI Engineering snapshot.
      </p>
      <div class="overflow-x-auto rounded-xl border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800">
        <table class="w-full text-sm" data-testid="package-search-results">
          <thead class="bg-gray-50 dark:bg-gray-900/40 text-left text-xs uppercase tracking-wide text-gray-500 dark:text-gray-400">
            <tr>
              <th class="px-4 py-2 font-medium">Package</th>
              <th class="px-4 py-2 font-medium">Version</th>
              <th class="px-4 py-2 font-medium">Product</th>
              <th class="px-4 py-2 font-medium">Upstream URL</th>
            </tr>
          </thead>
          <tbody>
            <tr
              v-for="(row, idx) in results"
              :key="row.name + row.version + row.productId + idx"
              class="border-t border-gray-100 dark:border-gray-700"
            >
              <td class="px-4 py-2 font-mono text-gray-900 dark:text-gray-100">{{ row.name }}</td>
              <td class="px-4 py-2 text-gray-700 dark:text-gray-300">{{ row.version }}</td>
              <td class="px-4 py-2">
                <button
                  type="button"
                  class="text-primary-700 dark:text-primary-300 hover:underline"
                  @click="openProduct(row.productId)"
                >
                  {{ row.productName }}
                </button>
              </td>
              <td class="px-4 py-2">
                <a
                  :href="row.upstreamUrl"
                  target="_blank"
                  rel="noopener noreferrer"
                  class="text-primary-700 dark:text-primary-300 hover:underline break-all"
                >
                  {{ row.upstreamUrl }}
                </a>
              </td>
            </tr>
          </tbody>
        </table>
      </div>
    </div>

    <DataOriginCallout :meta="meta" variant="footer" class="mt-8" />
  </div>
</template>

<script setup>
import { computed, inject, onUnmounted, ref, watch } from 'vue'
import { useCatalog } from '../composables/useCatalog.js'
import DataOriginCallout from '../components/DataOriginCallout.vue'

const nav = inject('moduleNav')
const { catalog, loading, error, searchPackages } = useCatalog()

const queryInput = ref('')
let searchTimer = null

const query = computed(() => String(queryInput.value || '').trim())
const meta = computed(() => catalog.value && catalog.value.meta)
const results = computed(() => searchPackages(query.value))

function openProduct(id) {
  nav.navigateTo('product-detail', { id })
}

watch(queryInput, function(val) {
  clearTimeout(searchTimer)
  searchTimer = setTimeout(function() {
    if (nav && typeof nav.updateParams === 'function') {
      nav.updateParams({ q: String(val || '').trim() || undefined })
    }
  }, 200)
})

onUnmounted(function() {
  clearTimeout(searchTimer)
})

watch(function() {
  return nav && nav.params && nav.params.value && nav.params.value.q
}, function() {
  const q = (nav && nav.params && nav.params.value && nav.params.value.q) || ''
  if (q !== queryInput.value) {
    queryInput.value = q
  }
}, { immediate: true })
</script>
