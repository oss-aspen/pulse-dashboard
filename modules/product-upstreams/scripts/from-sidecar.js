#!/usr/bin/env node

/**
 * Convert sidecar JSON (file, JSONL, or directory) into a Hummingbird catalog product.
 *
 *   node modules/product-upstreams/scripts/from-sidecar.js ./sidecars.json
 *   node modules/product-upstreams/scripts/from-sidecar.js ./sidecars/ --merge
 */

const fs = require('fs')
const path = require('path')
const {
  collectSidecars,
  buildHummingbirdProduct,
  mergeProductIntoCatalog
} = require('../server/from-sidecar')

const DEFAULT_CATALOG = path.resolve(
  __dirname,
  '../data/catalog.json'
)

function parseArgs(argv) {
  const args = { input: null, merge: false, catalog: DEFAULT_CATALOG, version: null }
  const rest = argv.slice(2)
  for (let i = 0; i < rest.length; i++) {
    const token = rest[i]
    if (token === '--merge') {
      args.merge = true
      const next = rest[i + 1]
      if (next && !next.startsWith('--')) {
        args.catalog = path.resolve(next)
        i++
      }
    } else if (token === '--version') {
      args.version = rest[++i]
    } else if (token === '--help' || token === '-h') {
      args.help = true
    } else if (!token.startsWith('-') && !args.input) {
      args.input = path.resolve(token)
    }
  }
  return args
}

function readJsonLike(filePath) {
  const raw = fs.readFileSync(filePath, 'utf8')
  const ext = path.extname(filePath).toLowerCase()
  if (ext === '.jsonl' || ext === '.ndjson') {
    return collectSidecars(raw)
  }
  try {
    return JSON.parse(raw)
  } catch {
    return collectSidecars(raw)
  }
}

function loadInput(inputPath) {
  const stat = fs.statSync(inputPath)
  if (stat.isDirectory()) {
    const files = fs.readdirSync(inputPath)
      .filter(name => /\.(json|jsonl|ndjson)$/i.test(name))
      .sort()
      .map(name => path.join(inputPath, name))
    return files.flatMap(file => collectSidecars(readJsonLike(file)))
  }
  return collectSidecars(readJsonLike(inputPath))
}

function main() {
  const args = parseArgs(process.argv)
  if (args.help || !args.input) {
    console.log(`Convert Fedora sidecar records to a Product Upstreams catalog product.

Usage:
  node modules/product-upstreams/scripts/from-sidecar.js <file-or-dir>
  node modules/product-upstreams/scripts/from-sidecar.js <file-or-dir> --merge
  node modules/product-upstreams/scripts/from-sidecar.js <file-or-dir> --merge path/to/catalog.json
  node modules/product-upstreams/scripts/from-sidecar.js <file-or-dir> --version rawhide

Accepts a JSON object, JSON array, JSONL/NDJSON, or a directory of those files.
Each record may be { "sidecar": { ... } } or the sidecar object itself.
`)
    process.exit(args.help ? 0 : 1)
  }

  const sidecars = loadInput(args.input)
  const product = buildHummingbirdProduct(sidecars, { version: args.version })

  if (!args.merge) {
    process.stdout.write(JSON.stringify(product, null, 2) + '\n')
    return
  }

  const catalog = JSON.parse(fs.readFileSync(args.catalog, 'utf8'))
  const merged = mergeProductIntoCatalog(catalog, product)
  fs.writeFileSync(args.catalog, JSON.stringify(merged, null, 2) + '\n')
  console.error(`Wrote ${product.upstreams.length} upstreams / ${
    product.upstreams.reduce((n, u) => n + u.packages.length, 0)
  } packages for ${product.id} to ${args.catalog}`)
}

main()
