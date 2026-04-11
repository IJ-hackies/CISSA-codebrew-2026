#!/bin/bash
# Downloads Solar System Scope 2K textures (CC BY 4.0) into public/textures/planets/
# Run once from the apps/client directory: bash scripts/download-planet-textures.sh

OUT="$(dirname "$0")/../public/textures/planets"
mkdir -p "$OUT"
BASE="https://www.solarsystemscope.com/textures/download"

dl() {
  local name=$1 url=$2
  if [ -f "$OUT/$name" ]; then
    echo "  skip $name (already exists)"
  else
    echo "  → $name"
    curl -sL -o "$OUT/$name" "$url" || echo "  WARN: failed $name"
  fi
}

dl earth.jpg      "$BASE/2k_earth_daymap.jpg"
dl mars.jpg       "$BASE/2k_mars.jpg"
dl moon.jpg       "$BASE/2k_moon.jpg"
dl jupiter.jpg    "$BASE/2k_jupiter.jpg"
dl saturn.jpg     "$BASE/2k_saturn.jpg"
dl saturn_ring.png "$BASE/2k_saturn_ring_alpha.png"
dl uranus.jpg     "$BASE/2k_uranus.jpg"
dl neptune.jpg    "$BASE/2k_neptune.jpg"
dl venus.jpg      "$BASE/2k_venus_surface.jpg"
dl mercury.jpg    "$BASE/2k_mercury.jpg"

echo "Done. Textures in $OUT"
