import { describe, it, expect } from 'vitest'
import {
  collectSidecars,
  buildHummingbirdProduct,
  mergeProductIntoCatalog
} from '../../server/from-sidecar.js'

const networkManager = {
  sidecar: {
    branch: 'rawhide',
    modification_status: 'clean',
    release: '1',
    release_monitoring_project_id: 21197,
    sha: '47d7c2762e4fde4ce90ad216e73a7c8a4fefd509',
    source: 'https://src.fedoraproject.org/rpms/NetworkManager.git',
    upstream_repo: 'https://gitlab.freedesktop.org/NetworkManager/NetworkManager',
    version: '1.58.0',
    Package: 'NetworkManager'
  }
}

describe('collectSidecars', () => {
  it('unwraps sidecar wrappers, arrays, and JSONL', () => {
    expect(collectSidecars(networkManager)[0].Package).toBe('NetworkManager')
    expect(collectSidecars([networkManager, networkManager.sidecar])).toHaveLength(2)
    const jsonl = `${JSON.stringify(networkManager)}\n${JSON.stringify(networkManager.sidecar)}\n`
    expect(collectSidecars(jsonl)).toHaveLength(2)
  })
})

describe('buildHummingbirdProduct', () => {
  it('groups packages that share an upstream_repo', () => {
    const libs = {
      ...networkManager.sidecar,
      Package: 'NetworkManager-libnm',
      version: '1.58.0'
    }
    const vllm = {
      Package: 'python-vllm',
      version: '0.8.5',
      upstream_repo: 'https://github.com/vllm-project/vllm.git',
      branch: 'rawhide'
    }
    const product = buildHummingbirdProduct([networkManager, libs, vllm])
    expect(product.id).toBe('hummingbird')
    expect(product.available).toBe(true)
    expect(product.version).toBe('rawhide')
    expect(product.upstreams.map(u => u.id).sort()).toEqual(['networkmanager', 'vllm'])

    const nm = product.upstreams.find(u => u.id === 'networkmanager')
    expect(nm.url).toBe('https://gitlab.freedesktop.org/NetworkManager/NetworkManager')
    expect(nm.packages.map(p => p.name)).toEqual(['NetworkManager', 'NetworkManager-libnm'])
    expect(nm.packages[0].version).toBe('1.58.0')

    const vllmUp = product.upstreams.find(u => u.id === 'vllm')
    expect(vllmUp.url).toBe('https://github.com/vllm-project/vllm')
    expect(vllmUp.packages).toEqual([{ name: 'python-vllm', version: '0.8.5' }])
  })

  it('keeps packages without upstream_repo as their own group', () => {
    const product = buildHummingbirdProduct({
      Package: 'orphan-rpm',
      version: '1.0'
    })
    expect(product.upstreams).toHaveLength(1)
    expect(product.upstreams[0].id).toBe('orphan-rpm')
    expect(product.upstreams[0].url).toBe('')
    expect(product.upstreams[0].packages[0].name).toBe('orphan-rpm')
  })
})

describe('mergeProductIntoCatalog', () => {
  it('replaces an existing product id and stamps lastUpdated', () => {
    const catalog = {
      meta: { lastUpdated: '2020-01-01' },
      products: [{ id: 'hummingbird', name: 'old', upstreams: [] }, { id: 'rhoai' }]
    }
    const merged = mergeProductIntoCatalog(catalog, {
      id: 'hummingbird',
      name: 'Hummingbird',
      upstreams: [{ id: 'vllm', packages: [] }]
    })
    expect(merged.products).toHaveLength(2)
    expect(merged.products[0].name).toBe('Hummingbird')
    expect(merged.products[1].id).toBe('rhoai')
    expect(merged.meta.lastUpdated).toMatch(/^\d{4}-\d{2}-\d{2}$/)
  })
})
