const { createTestContext } = require('../../../../shared/server/module-context')

vi.spyOn(console, 'log').mockImplementation(() => {})
vi.spyOn(console, 'error').mockImplementation(() => {})

const registerRoutes = require('../../server/index')

function makeRouter() {
  return { get: vi.fn(), post: vi.fn() }
}

describe('rpm-qa server routes', () => {
  let router
  let context

  beforeEach(() => {
    router = makeRouter()
    context = createTestContext({
      storage: {
        readFromStorage: vi.fn().mockReturnValue(null),
        writeToStorage: vi.fn(),
      },
      registerDiagnostics: vi.fn(),
      registerExport: vi.fn(),
    })
    registerRoutes(router, context)
  })

  it('registers GET /components', () => {
    expect(router.get).toHaveBeenCalledWith('/components', expect.any(Function))
  })

  it('registers POST /upload', () => {
    expect(router.post).toHaveBeenCalledWith('/upload', expect.any(Function), expect.any(Function))
  })

  it('GET /components returns empty records when no data is stored', () => {
    const [, handler] = router.get.mock.calls.find(([p]) => p === '/components')
    const res = { json: vi.fn() }
    handler({}, res)
    expect(res.json).toHaveBeenCalledWith(
      expect.objectContaining({ records: [], total: 0 })
    )
  })

  it('registers a diagnostics hook', () => {
    expect(context.registerDiagnostics).toHaveBeenCalledWith(expect.any(Function))
  })

  it('diagnostics returns expected shape', async () => {
    const [diagFn] = context.registerDiagnostics.mock.calls[0]
    const result = await diagFn()
    expect(result).toMatchObject({
      recordCount: expect.any(Number),
      dataAvailable: expect.any(Boolean),
    })
  })

  it('registers an export hook', () => {
    expect(context.registerExport).toHaveBeenCalledWith(expect.any(Function))
  })
})
