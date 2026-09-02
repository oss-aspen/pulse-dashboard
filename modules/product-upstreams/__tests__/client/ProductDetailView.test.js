import { describe, it, expect, vi, beforeEach } from 'vitest'
import { mount, flushPromises } from '@vue/test-utils'
import { ref } from 'vue'
import ProductDetailView from '../../client/views/ProductDetailView.vue'
import { _resetForTesting } from '../../client/composables/useCatalog.js'

const catalog = {
  meta: {
    stewardTeam: 'Red Hat OSAIPO',
    sourceNote: 'Static snapshot for tests.',
    lastUpdated: '2026-09-01',
    customDataRequestUrl: 'https://example.test/custom'
  },
  products: [
    {
      id: 'rhaiis',
      name: 'Red Hat AI Inference Server',
      shortName: 'RHAIIS',
      description: 'Enterprise vLLM',
      category: 'Inference',
      available: true,
      upstreams: [
        {
          id: 'vllm',
          name: 'vLLM',
          url: 'https://github.com/vllm-project/vllm',
          description: 'Inference engine',
          packages: [{ name: 'vllm', version: '0.8.5' }]
        }
      ]
    }
  ]
}

vi.mock('@shared/client/services/api.js', () => ({
  apiRequest: vi.fn()
}))

import { apiRequest } from '@shared/client/services/api.js'

function mountView(id) {
  return mount(ProductDetailView, {
    global: {
      provide: {
        moduleNav: {
          navigateTo: vi.fn(),
          params: ref({ id })
        }
      }
    }
  })
}

describe('ProductDetailView', () => {
  beforeEach(() => {
    _resetForTesting()
    vi.clearAllMocks()
  })

  it('lists upstreams, packages, and origin text for a product', async () => {
    apiRequest.mockResolvedValue(catalog)
    const wrapper = mountView('rhaiis')
    await flushPromises()

    expect(wrapper.text()).toContain('Red Hat AI Inference Server')
    expect(wrapper.text()).toContain('curated by Red Hat OSAIPO')
    expect(wrapper.find('[data-testid="upstream-list"]').exists()).toBe(true)
    expect(wrapper.text()).toContain('vLLM')
    expect(wrapper.text()).toContain('vllm')
    expect(wrapper.text()).toContain('0.8.5')
    expect(wrapper.text()).toContain('https://github.com/vllm-project/vllm')
  })
})
