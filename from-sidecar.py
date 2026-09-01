#!/usr/bin/env python3
"""Convert Fedora/Hummingbird sidecar JSON into a Product Upstreams catalog product.

Stdlib only. Copy this file anywhere and run it with Python 3.

  python3 from-sidecar.py sidecars.json
  python3 from-sidecar.py sidecars.jsonl -o hummingbird.json
  python3 from-sidecar.py ./sidecars/ --merge ../data/catalog.json
  cat dump.json | python3 from-sidecar.py -
"""

from __future__ import annotations

import argparse
import json
import re
import sys
from datetime import date
from pathlib import Path
from urllib.parse import urlparse

SCRIPT_DIR = Path(__file__).resolve().parent
DEFAULT_CATALOG = SCRIPT_DIR.parent / "data" / "catalog.json"
JSON_SUFFIXES = {".json", ".jsonl", ".ndjson"}


def unwrap_sidecar(record):
    if not isinstance(record, dict):
        return None
    inner = record.get("sidecar")
    if isinstance(inner, dict):
        return inner
    if any(key in record for key in ("Package", "package", "upstream_repo", "source")):
        return record
    return None


def collect_sidecars(data):
    if data is None:
        return []
    if isinstance(data, str):
        text = data.strip()
        if not text:
            return []
        try:
            return collect_sidecars(json.loads(text))
        except json.JSONDecodeError:
            records = []
            for line in text.splitlines():
                row = line.strip()
                if row:
                    records.extend(collect_sidecars(json.loads(row)))
            return records
    if isinstance(data, list):
        records = []
        for item in data:
            records.extend(collect_sidecars(item))
        return records
    if isinstance(data, dict):
        for key in ("packages", "sidecars", "records"):
            if isinstance(data.get(key), list):
                return collect_sidecars(data[key])
        sidecar = unwrap_sidecar(data)
        return [sidecar] if sidecar else []
    return []


def slugify(value):
    slug = re.sub(r"[^a-z0-9]+", "-", str(value or "").lower()).strip("-")
    return slug[:80]


def normalize_repo_url(url):
    if not isinstance(url, str) or not url.strip():
        return ""
    return re.sub(r"/+$", "", re.sub(r"\.git$", "", url.strip(), flags=re.I))


def repo_path_parts(url):
    parsed = urlparse(url)
    if not parsed.scheme:
        return []
    path = re.sub(r"\.git$", "", parsed.path, flags=re.I)
    return [part for part in path.split("/") if part]


def upstream_id_from_url(url, package_name):
    parts = repo_path_parts(url)
    if parts:
        last = slugify(parts[-1])
        if last:
            return last
    return slugify(package_name) or "unknown"


def upstream_name_from_url(url, package_name):
    parts = repo_path_parts(url)
    if parts:
        return parts[-1]
    return package_name or url or "Unknown"


def unique_id(base, used):
    ident = base or "unknown"
    if ident not in used:
        used.add(ident)
        return ident
    n = 2
    while f"{ident}-{n}" in used:
        n += 1
    next_id = f"{ident}-{n}"
    used.add(next_id)
    return next_id


def package_name_of(sidecar):
    return str(sidecar.get("Package") or sidecar.get("package") or sidecar.get("name") or "").strip()


def build_hummingbird_product(input_data, **options):
    sidecars = collect_sidecars(input_data)
    groups = {}

    for sidecar in sidecars:
        name = package_name_of(sidecar)
        if not name:
            continue
        url = normalize_repo_url(sidecar.get("upstream_repo"))
        key = url or f"package:{name.lower()}"
        group = groups.setdefault(key, {"url": url, "packages": {}})
        version = sidecar.get("version")
        group["packages"][name] = {
            "name": name,
            "version": "" if version is None else str(version),
        }

    used_ids = set()
    upstreams = []
    for group in groups.values():
        packages = sorted(group["packages"].values(), key=lambda pkg: pkg["name"])
        sample_name = packages[0]["name"] if packages else ""
        url = group["url"] or None
        id_base = upstream_id_from_url(url, sample_name) if url else (slugify(sample_name) or "unmapped")
        names = ", ".join(pkg["name"] for pkg in packages)
        upstreams.append({
            "id": unique_id(id_base, used_ids),
            "name": upstream_name_from_url(url, sample_name) if url else sample_name,
            "url": url or "",
            "description": (
                f"Upstream repository for {names}."
                if url
                else "No upstream_repo was provided for this package."
            ),
            "packages": packages,
        })
    upstreams.sort(key=lambda item: item["name"])

    branches = [sidecar.get("branch") for sidecar in sidecars if sidecar.get("branch")]
    unique_branches = list(dict.fromkeys(branches))
    version = options.get("version")
    if version is None:
        version = unique_branches[0] if len(unique_branches) == 1 else None

    return {
        "id": options.get("id") or "hummingbird",
        "name": options.get("name") or "Hummingbird",
        "shortName": options.get("short_name") or "Hummingbird",
        "description": options.get("description")
        or "Fedora Hummingbird image packages mapped to their upstream repositories.",
        "category": options.get("category") or "Platform",
        "version": version,
        "available": True,
        "upstreams": upstreams,
    }


def merge_product_into_catalog(catalog, product):
    products = list(catalog.get("products") or [])
    for index, existing in enumerate(products):
        if existing.get("id") == product["id"]:
            products[index] = product
            break
    else:
        products.append(product)
    merged = dict(catalog)
    merged["products"] = products
    meta = dict(catalog.get("meta") or {})
    if meta or catalog.get("meta") is not None:
        meta["lastUpdated"] = date.today().isoformat()
        merged["meta"] = meta
    return merged


def read_json_like(path: Path):
    text = path.read_text(encoding="utf-8")
    if path.suffix.lower() in {".jsonl", ".ndjson"}:
        return collect_sidecars(text)
    try:
        return json.loads(text)
    except json.JSONDecodeError:
        return collect_sidecars(text)


def load_input(input_path: str):
    if input_path == "-":
        return collect_sidecars(sys.stdin.read())
    path = Path(input_path)
    if path.is_dir():
        records = []
        for file_path in sorted(path.iterdir()):
            if file_path.suffix.lower() in JSON_SUFFIXES:
                records.extend(collect_sidecars(read_json_like(file_path)))
        return records
    return collect_sidecars(read_json_like(path))


def parse_args(argv=None):
    parser = argparse.ArgumentParser(
        description="Convert Fedora sidecar records to a Product Upstreams catalog product."
    )
    parser.add_argument(
        "input",
        nargs="?",
        help="JSON / JSONL file, directory of those files, or '-' for stdin",
    )
    parser.add_argument(
        "-o",
        "--output",
        help="Write the Hummingbird product JSON to this file (default: stdout)",
    )
    parser.add_argument(
        "--merge",
        nargs="?",
        const=str(DEFAULT_CATALOG),
        metavar="CATALOG",
        help=f"Merge into a catalog.json (default: {DEFAULT_CATALOG})",
    )
    parser.add_argument("--id", default="hummingbird", help="Product id (default: hummingbird)")
    parser.add_argument("--name", default="Hummingbird", help="Product display name")
    parser.add_argument("--version", help="Product version (default: sidecar branch if unique)")
    parser.add_argument("--self-test", action="store_true", help=argparse.SUPPRESS)
    return parser.parse_args(argv)


def run(args):
    sidecars = load_input(args.input)
    product = build_hummingbird_product(
        sidecars,
        id=args.id,
        name=args.name,
        version=args.version,
    )
    rendered = json.dumps(product, indent=2) + "\n"

    if args.merge:
        catalog_path = Path(args.merge)
        catalog = json.loads(catalog_path.read_text(encoding="utf-8"))
        merged = merge_product_into_catalog(catalog, product)
        catalog_path.write_text(json.dumps(merged, indent=2) + "\n", encoding="utf-8")
        pkg_count = sum(len(upstream["packages"]) for upstream in product["upstreams"])
        print(
            f"Wrote {len(product['upstreams'])} upstreams / {pkg_count} packages "
            f"for {product['id']} to {catalog_path}",
            file=sys.stderr,
        )
        return

    if args.output:
        Path(args.output).write_text(rendered, encoding="utf-8")
        return
    sys.stdout.write(rendered)


def _self_test():
    sample = {
        "sidecar": {
            "branch": "rawhide",
            "upstream_repo": "https://gitlab.freedesktop.org/NetworkManager/NetworkManager.git",
            "version": "1.58.0",
            "Package": "NetworkManager",
        }
    }
    libs = {
        "Package": "NetworkManager-libnm",
        "version": "1.58.0",
        "upstream_repo": "https://gitlab.freedesktop.org/NetworkManager/NetworkManager",
        "branch": "rawhide",
    }
    product = build_hummingbird_product([sample, libs])
    assert product["id"] == "hummingbird"
    assert product["version"] == "rawhide"
    assert len(product["upstreams"]) == 1
    nm = product["upstreams"][0]
    assert nm["id"] == "networkmanager"
    assert nm["url"] == "https://gitlab.freedesktop.org/NetworkManager/NetworkManager"
    assert [pkg["name"] for pkg in nm["packages"]] == ["NetworkManager", "NetworkManager-libnm"]
    print("self-test ok", file=sys.stderr)


def main(argv=None):
    args = parse_args(argv)
    if args.self_test:
        _self_test()
        return
    if not args.input:
        print("error: input file, directory, or '-' is required", file=sys.stderr)
        sys.exit(2)
    run(args)


if __name__ == "__main__":
    main()
