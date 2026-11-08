# Marble music video generator

Makes vertical (1080×1920) "marble music" videos. A red-and-white marble bounces from tube to tube,
landing on every note. Each tube lights up in a color set by its pitch, and long pauses become a
rolling wire rail. A "Top N" countdown list fills in as each song starts. The output is an MP4 with
your song audio, ready for TikTok, Reels or Shorts.

## Setup (once)

Needs Node 18+ and `ffmpeg` on your PATH.

```bash
cd tools/marble-video
npm install
npx playwright install chromium   # skip if Chromium for Playwright is already installed
```

## Make a video

1. Put your songs in `tools/marble-video/songs/` (mp3, wav, m4a, even an mp4; anything ffmpeg reads).
2. Copy `examples/my-songs.json` and edit it: a song name, file and start time for each clip.
3. Render:

```bash
node make-video.mjs examples/my-songs.json --preview      # quick 540x960 check
node make-video.mjs examples/my-songs.json                 # full 1080x1920 → out/my-songs.mp4
```

Useful flags:

| flag | what it does |
|---|---|
| `--preview` | 540×960 render, about 4× faster |
| `--limit 10` | render only the first 10 seconds |
| `--analyze-only` | print the detected hit times for each song; renders nothing |
| `--out path.mp4` | output file |
| `--fps 60` | frame rate (default 30) |
| `--gpu` | use your real GPU instead of software WebGL (much faster on a desktop) |

## Config reference

Top level:

```jsonc
{
  "title": "Top 6 Most\nRecognizable Melodies",  // \n = line break
  "handle": "@yourname",        // optional text, bottom right
  "countdown": true,            // songs play in order; first listed = highest rank number (6 → 1)
  "clipSeconds": 9,             // default length of each clip
  "hitsPerSecond": 4,           // default density of marble bounces for audio files
  "gapBetweenSongs": 0.25,
  "colorMode": "pitch-class",   // or "rainbow-octave"
  "seed": 7,                    // change for a different course layout
  "bloom": 0.55, "cameraDistance": 1, "decoration": 1.6, "railGap": 0.9,
  "background": "#2b2d33", "floor": "#30323a",
  "songs": [ ... ]
}
```

Each song has a `name`, plus one of the following as the timing source:

| keys | sound | marble timing |
|---|---|---|
| `"audio": "file.mp3", "start": 45` | the real song | auto-detected onsets (tune with `hitsPerSecond`, `minGap`) |
| `"audio"` + `"midi": "file.mid", "midiStart": 20` | the real song | exact melody notes from the MIDI (best sync) |
| `"audio"` + `"hits": [0.0, 0.42, 0.8, ...]` | the real song | your own hit times (seconds from clip start) |
| `"midi": "file.mid", "start": 0` | synthesized chimes | MIDI melody |
| `"notes": [[time, midiNote, dur], ...]` | synthesized chimes | those notes |

Other per-song options: `duration`, `volume`, `rank`, `track` (MIDI track index), `hitOffset` (shift
the hits in seconds when auto-detection runs early or late).

### Tips for the best sync

- Pick the clip `start` at the song's hook: the most recognizable part of the melody.
- Auto-detection follows the strongest attacks in the 250–4000 Hz band, so busy drum-heavy tracks
  can pull it toward the beat. Lower `hitsPerSecond` (try 2.5–3), or use a MIDI of the melody.
- MIDI files for well-known songs are easy to find. Set `midiStart` to the point in the MIDI that
  lines up with `start` in the audio.
- Run `--analyze-only` first to check the hit counts, then a `--preview` before the full render.

## How it works

`make-video.mjs` cuts each clip with ffmpeg, finds hits (spectral-flux onsets or MIDI melody),
mixes the audio timeline, then drives a three.js scene (`render/scene.js`) frame by frame in
headless Chromium. Each tube sits where the marble lands at a hit's exact time, so the bounces are
synced to the frame. The frames go straight into ffmpeg (H.264 + AAC).
