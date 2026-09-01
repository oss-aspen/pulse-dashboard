<template>
  <div class="max-w-7xl mx-auto px-4 py-6">
    <div class="mb-6">
      <h1 class="text-2xl font-bold text-gray-900 dark:text-gray-100">Product Upstreams</h1>
      <p class="mt-2 text-gray-600 dark:text-gray-400">
        Select a product to see the upstream projects that make it up. Grayed-out tiles are listed
        for awareness but are not yet catalogued by Red Hat AI Engineering.
      </p>
    </div>

    <div class="mb-6">
      <label class="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1" for="product-upstreams-quick-search">
        Looking for a package instead?
      </label>
      <form class="flex gap-2" @submit.prevent="goToSearch">
        <input
          id="product-upstreams-quick-search"
          v-model="quickQuery"
          type="search"
          placeholder="Search a package name (for example vllm or kserve)"
          class="flex-1 px-3 py-2 text-sm border border-gray-200 dark:border-gray-600
                 bg-white dark:bg-gray-800 text-gray-900 dark:text-gray-100 rounded-lg
                 focus:ring-2 focus:ring-primary-500 focus:border-primary-500 outline-none"
          data-testid="quick-package-search"
        />
        <button
          type="submit"
          class="px-4 py-2 text-sm font-medium text-white bg-primary-600 hover:bg-primary-700 rounded-lg"
        >
          Search packages
        </button>
      </form>
      <p class="mt-1 text-xs text-gray-500 dark:text-gray-400">
        Package search uses the same static catalog. Need a package we do not list?
        <a
          v-if="meta && meta.customDataRequestUrl"
          :href="meta.customDataRequestUrl"
          target="_blank"
          rel="noopener noreferrer"
          class="text-primary-700 dark:text-primary-300 hover:underline"
        >Request custom data</a>.
      </p>
    </div>

    <div v-if="loading && !products.length" class="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
      <div v-for="n in 6" :key="n" class="h-40 rounded-xl bg-gray-200 dark:bg-gray-700 animate-pulse" />
    </div>

    <div v-else-if="error" class="text-center py-12">
      <p class="text-red-600 dark:text-red-400">{{ error }}</p>
      <button
        class="mt-4 px-4 py-2 text-sm font-medium text-white bg-primary-600 hover:bg-primary-700 rounded-lg"
        @click="loadCatalog"
      >
        Retry
      </button>
    </div>

    <template v-else>
      <p class="mb-4 text-sm text-gray-500 dark:text-gray-400">
        {{ availableCount }} catalogued product{{ availableCount === 1 ? '' : 's' }}
        · {{ grayedCount }} listed but not yet catalogued
      </p>

      <div class="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4" data-testid="product-tile-grid">
        <ProductTile
          v-for="product in products"
          :key="product.id"
          :product="product"
          @select="selectProduct(product.id)"
        />
      </div>
    </template>

    <DataOriginCallout :meta="meta" variant="footer" class="mt-8" />
  </div>
</template>

<script setup>
import { computed, inject, ref } from 'vue'
import { useCatalog } from '../composables/useCatalog.js'
import DataOriginCallout from '../components/DataOriginCallout.vue'
import ProductTile from '../components/ProductTile.vue'

const nav = inject('moduleNav')
const { catalog, loading, error, loadCatalog } = useCatalog()
const quickQuery = ref('')

const meta = computed(() => catalog.value && catalog.value.meta)
const products = computed(() => (catalog.value && catalog.value.products) || [])
const availableCount = computed(() => products.value.filter(p => p.available !== false).length)
const grayedCount = computed(() => products.value.filter(p => p.available === false).length)

function selectProduct(id) {
  nav.navigateTo('product-detail', { id })
}

function goToSearch() {
  const q = quickQuery.value.trim()
  nav.navigateTo('search', q ? { q } : {})
}
</script>
