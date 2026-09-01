import { describe, it, expect, vi, beforeEach } from 'vitest'
import { mount, flushPromises } from '@vue/test-utils'
import ProductsView from '../../client/views/ProductsView.vue'
import { _resetForTesting } from '../../client/composables/useCatalog.js'

const catalog = {
  meta: {
    stewardTeam: 'Red Hat AI Engineering',
    sourceNote: 'Static snapshot for tests.',
    coverageNote: 'Gray tiles are not catalogued yet.',
    lastUpdated: '2026-09-01',
    featureRequestUrl: 'https://github.com/red-hat-data-services/rhai-org-pulse/issues/new?title=feature',
    customDataRequestUrl: 'https://github.com/red-hat-data-services/rhai-org-pulse/issues/new?title=custom',
    issuesUrl: 'https://github.com/red-hat-data-services/rhai-org-pulse/issues',
    contactHint: 'Open a GitHub issue.'
  },
  products: [
    {
      id: 'rhaiis',
      name: 'Red Hat AI Inference Server',
      shortName: 'RHAIIS',
      description: 'vLLM distribution',
      category: 'Inference',
      version: '3.1',
      available: true,
      upstreams: [{ id: 'vllm', name: 'vLLM', url: 'https://github.com/vllm-project/vllm', packages: [{ name: 'vllm', version: '0.8.5' }] }]
    },
    {
      id: 'llama-stack',
      name: 'Llama Stack',
      shortName: 'Llama Stack',
      description: 'Not catalogued yet',
      category: 'Platform',
      version: null,
      available: false,
      unavailableReason: 'Catalog in progress',
      upstreams: []
    }
  ]
}

vi.mock('@shared/client/services/api.js', () => ({
  apiRequest: vi.fn()
}))

import { apiRequest } from '@shared/client/services/api.js'

function mountView() {
  const nav = {
    navigateTo: vi.fn(),
    goBack: vi.fn(),
    params: { value: {} }
  }
  const wrapper = mount(ProductsView, {
    global: {
      provide: {
        moduleNav: nav
      }
    }
  })
  return { wrapper, nav }
}

describe('ProductsView', () => {
  beforeEach(() => {
    _resetForTesting()
    vi.clearAllMocks()
  })

  it('renders origin text and both available and grayed product tiles', async () => {
    apiRequest.mockResolvedValue(catalog)
    const { wrapper } = mountView()
    await flushPromises()

    expect(wrapper.text()).toContain('Product Upstreams')
    expect(wrapper.text()).toContain('Red Hat AI Engineering')
    expect(wrapper.text()).toContain('Suggest a feature')
    expect(wrapper.text()).toContain('Request custom data')
    expect(wrapper.find('[data-testid="product-tile-rhaiis"]').exists()).toBe(true)
    expect(wrapper.find('[data-testid="product-tile-llama-stack"]').exists()).toBe(true)
    expect(wrapper.find('[data-testid="product-tile-llama-stack"]').attributes('data-available')).toBe('false')
    expect(wrapper.text()).toContain('Not yet catalogued')
  })

  it('navigates to product detail for available tiles only', async () => {
    apiRequest.mockResolvedValue(catalog)
    const { wrapper, nav } = mountView()
    await flushPromises()

    await wrapper.find('[data-testid="product-tile-rhaiis"]').trigger('click')
    expect(nav.navigateTo).toHaveBeenCalledWith('product-detail', { id: 'rhaiis' })

    nav.navigateTo.mockClear()
    await wrapper.find('[data-testid="product-tile-llama-stack"]').trigger('click')
    expect(nav.navigateTo).not.toHaveBeenCalled()
  })

  it('sends package search to the search view', async () => {
    apiRequest.mockResolvedValue(catalog)
    const { wrapper, nav } = mountView()
    await flushPromises()

    await wrapper.find('[data-testid="quick-package-search"]').setValue('vllm')
    await wrapper.find('form').trigger('submit')
    expect(nav.navigateTo).toHaveBeenCalledWith('search', { q: 'vllm' })
  })
})
