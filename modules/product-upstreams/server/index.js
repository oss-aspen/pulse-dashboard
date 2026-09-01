const {
  getCatalog,
  getProduct,
  isValidProductId,
  searchPackages,
  getStats
} = require('./catalog')

/**
 * @param {import('express').Router} router
 * @param {import('@shared/server/module-context').ModuleContext} context
 */
module.exports = function registerRoutes(router, context) {
  const { requireScope } = context

  context.registerScopes([
    {
      key: 'product-upstreams:read',
      label: 'Product Upstreams (Read)',
      description: 'Read the static product-to-upstream catalog',
      category: 'Product Upstreams'
    }
  ])

  const readScope = requireScope('product-upstreams:read')

  /**
   * @openapi
   * /api/modules/product-upstreams/catalog:
   *   get:
   *     tags: [product-upstreams]
   *     summary: Static product-to-upstream catalog
   *     description: Returns the hardcoded catalog shipped with this module, including origin metadata.
   *     responses:
   *       200:
   *         description: Catalog metadata and products
   */
  router.get('/catalog', readScope, function(req, res) {
    res.json(getCatalog())
  })

  /**
   * @openapi
   * /api/modules/product-upstreams/products/{id}:
   *   get:
   *     tags: [product-upstreams]
   *     summary: Single product with its upstreams
   *     parameters:
   *       - in: path
   *         name: id
   *         required: true
   *         schema:
   *           type: string
   *     responses:
   *       200:
   *         description: Product and upstream list
   *       400:
   *         description: Invalid product id
   *       404:
   *         description: Product not found
   */
  router.get('/products/:id', readScope, function(req, res) {
    const id = req.params.id
    if (!isValidProductId(id)) {
      return res.status(400).json({ error: 'Invalid product id' })
    }
    const product = getProduct(id)
    if (!product) {
      return res.status(404).json({ error: 'Product not found' })
    }
    res.json({ meta: getCatalog().meta, product })
  })

  /**
   * @openapi
   * /api/modules/product-upstreams/search:
   *   get:
   *     tags: [product-upstreams]
   *     summary: Search packages by name or version
   *     parameters:
   *       - in: query
   *         name: q
   *         required: true
   *         schema:
   *           type: string
   *         description: Package name or version substring
   *     responses:
   *       200:
   *         description: Matching packages with product and upstream URL
   *       400:
   *         description: Missing search query
   */
  router.get('/search', readScope, function(req, res) {
    const q = req.query.q
    if (q == null || !String(q).trim()) {
      return res.status(400).json({ error: 'Query parameter "q" is required' })
    }
    res.json(searchPackages(q))
  })

  if (context.registerDiagnostics) {
    context.registerDiagnostics(async function() {
      return {
        source: 'bundled-json',
        ...getStats()
      }
    })
  }
}
