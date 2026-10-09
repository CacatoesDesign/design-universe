# Optional sound

DS Universe ships **without audio files**. The **Sound** button only appears when the files below are present in this folder (`app/public/audio/`). Bring your own, with a license that lets you use them.

| File | Used for |
| --- | --- |
| `music-a.mp3` … `music-d.mp3` | Background music, one part per Explorer level: `a` Library, `b` Usage, `c` Pattern, `d` Component. Loop points are set in bars in `src/lib/sound.ts` (`PARTS`, `BEAT`). |
| `sfx-select.wav` | Click on a component zone |
| `sfx-option.wav` | Next zone (← →) or zone menu |
| `sfx-pick.wav` | Variant change; also level change (pitched up when diving, down when going up) |
| `sfx-open.wav` / `sfx-close.wav` | Panel opened / closed |
| `sfx-tick.wav` | Tabs, Light / Dark, collection modes |
| `sfx-grab.wav` / `sfx-drop.wav` | Builder: pick up / drop a component or node |
| `sfx-link.wav` | Builder: link two nodes |
| `sfx-save.wav` | Builder: pattern saved |

`sfx-select.wav` is required for the button to show up; any other missing file is simply silent.
