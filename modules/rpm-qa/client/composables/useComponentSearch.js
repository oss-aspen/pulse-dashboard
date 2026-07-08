import { computed, ref, watch } from 'vue'
import Fuse from 'fuse.js'

/**
 * Fields searched by Fuse.js, with relative weights.
 * Component name matches are weighted highest so an exact prefix search
 * always sorts the right package to the top.
 */
const FUSE_KEYS = [
  { name: 'Component', weight: 3 },
  { name: 'QA Contact', weight: 2 },
  { name: 'Embargo QA Contact', weight: 1.5 },
  { name: 'Developer', weight: 1.5 },
  { name: 'Default Assignee', weight: 1 },
  { name: 'Product', weight: 1 },
  { name: 'Description', weight: 0.5 },
]

const FUSE_OPTIONS = {
  keys: FUSE_KEYS,
  threshold: 0.35,     // 0 = exact, 1 = match anything — 0.35 is tolerant but not noisy
  includeScore: true,
  ignoreLocation: true, // match anywhere in the string, not just near the start
  minMatchCharLength: 2,
}

const SEARCH_DEBOUNCE_MS = 300

/**
 * Provides fuzzy-search over component records using Fuse.js.
 *
 * @param {import('vue').Ref<object[]>} records - Ref to the full records array
 * @returns {{ query: Ref<string>, results: ComputedRef<object[]> }}
 */
export function useComponentSearch(records) {
  /** Raw value bound to the input — updates on every keystroke */
  const query = ref('')
  /** Debounced copy that actually drives the search — updates 300 ms after typing stops */
  const debouncedQuery = ref('')

  let debounceTimer = null
  watch(query, (val) => {
    clearTimeout(debounceTimer)
    debounceTimer = setTimeout(() => {
      debouncedQuery.value = val
    }, SEARCH_DEBOUNCE_MS)
  })

  /** Rebuild the Fuse index whenever the records array changes */
  const fuse = computed(() => new Fuse(records.value, FUSE_OPTIONS))

  /**
   * Pre-sorted default view — computed independently of query so it is cached
   * and not recomputed every time the user types or clears the search box.
   */
  const sortedRecords = computed(() =>
    [...records.value].sort((a, b) =>
      (a['Component'] || '').localeCompare(b['Component'] || '')
    )
  )

  const results = computed(() => {
    const q = debouncedQuery.value.trim()
    if (!q) return sortedRecords.value
    // Fuse returns { item, score } — unwrap to plain records, best match first
    return fuse.value.search(q).map(r => r.item)
  })

  return { query, results }
}
