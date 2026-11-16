# Strata brand assets

Everything here is built by `python scripts/brand-assets.py` from the geometry and palette in that script. Change the script, run it, and commit the result: never edit a file here by hand.

| File | Use |
| ---- | --- |
| `strata-icon.svg`, `strata-icon-<size>.png`, `strata.ico` | The app icon. `strata.ico` holds 16 to 256 px |
| `strata-icon-small.svg` | The three-band mark used at 16 and 24 px |
| `strata-mark.svg`, `strata-mark-mono.svg` | The mark alone, in colour and in `currentColor` |
| `strata-wordmark.svg`, `strata-wordmark-light.svg` | The wordmark for light and dark grounds |
| `strata-lockup.svg`, `strata-lockup-light.svg` | Mark and wordmark together |
| `social-preview.svg`, `social-preview.png` | 1280 by 640, the repository's social preview |
| `readme-banner.svg`, `readme-banner.png` | 1280 by 320, the README banner |

## The mark

A drilled core of sediment: five bands, one per layer of a disk. The ochre band sits 10 units out of line on a 96 unit grid. It is the change an examiner is looking for.

## Palette

| Name | Hex | Use |
| ---- | --- | --- |
| Bedrock | `#0E1420` | Ground, text on light |
| Slate | `#5B6B82` | Secondary bands |
| Stone | `#8E9BB0` | Tertiary bands |
| Silt | `#C9D3E0` | Light bands, secondary text on dark |
| Ochre | `#E0A340` | The accent: one band, selection, what is out of line |
| Chalk | `#F5F6F8` | Light ground, text on dark |

## Type

Space Grotesk 700 for the wordmark, in capitals tracked 0.14 em, and for headings. Inter for text. JetBrains Mono for offsets and hashes. The files are in `assets/fonts` under the SIL Open Font License.

## Rules

- Keep clear space around the mark of at least one band's height.
- The ochre band is never recoloured and never moved back into line.
- On a dark ground use the light wordmark; never place the mark on ochre.
