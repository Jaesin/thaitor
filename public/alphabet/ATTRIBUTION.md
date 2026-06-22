# Alphabet pictographs — attribution

The pictograph SVGs in this directory (`cons-*.svg`) illustrate the **acrophonic word**
in each Thai consonant's name (e.g. ก ไก่ → chicken, ช ช้าง → elephant). They are used
in the Alphabet Chart reference (spec 21).

## Source & license

All pictographs are from **OpenMoji** — the open-source emoji and icon project.

- Project: https://openmoji.org
- License: **Creative Commons Attribution-ShareAlike 4.0 International (CC BY-SA 4.0)**
  — https://creativecommons.org/licenses/by-sa/4.0/
- Version: OpenMoji 15.0.0 (color SVGs)

The glyphs are used unmodified. Per the license, attribution must be visible where these
assets appear and any modified versions must be shared under the same license. The app
surfaces this credit in Settings → About / the chart's info affordance.

## Mapping

Each file is named by the consonant id it illustrates (`public/alphabet/<consonant-id>.svg`,
matching `CONSONANTS[].id` in `src/data/script.ts`). 37 of the 44 consonants have a
pictograph; the 7 acrophonic words with no honest match — cymbals (ฉิ่ง), goad (ปฏัก),
pedestal (ฐาน), novice monk (เณร), lid (ฝา), offering tray (พาน), and sala pavilion (ศาลา)
— intentionally have none and fall back to the word alone. See `NO_PICTOGRAPH` /
`consonantPictograph()` in `src/data/script.ts`.
