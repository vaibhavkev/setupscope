# SetupScope: guitar setup analyser

K E Vaibhav · ME22B048 · Data Visualisation, Assignment 2

A phone web app that uses the microphone to measure a guitar and tell you what to adjust. It is one HTML file (`index.html`) with no libraries and no network use; the sound is analysed on the phone.

## What it measures and what you do with it

| Screen | Measurement | Visual | Decision it supports |
|---|---|---|---|
| **Tune** | Pitch of the plucked string (Hz, cents off target) | Needle gauge; 10-second pitch history; overtone spectrum with inharmonicity B and decay time | Tighten or loosen; whether the string has settled; string condition compared with a fresh set |
| **Intonation** | 12th-fret harmonic vs 12th-fret fretted note for each string | Bridge diagram with an arrow and millimetres per saddle; summary table | Which bridge saddles to move, which way and how far |
| **Tension** | Tension per string from frequency, scale length and the string maker's unit weight | Bar chart of each string in the chosen tuning against standard tuning; total neck load | Whether an alternate tuning (Drop D, D standard, Open G…) will feel slack, and which gauge restores the feel |
| **Accuracy** | Self-test on synthetic plucked strings; reference tone generator | Table of true vs detected frequency | Whether the readings can be trusted |

## How to use

1. Open the https link on the phone (the microphone only works on https pages). Tap **Start microphone** and allow access.
2. Choose tuning, scale length and string set.
3. **Tune** each string until the gauge is green (within ±3 cents).
4. **Intonation**: pick a string, play the 12th-fret harmonic and let it ring until it is captured, mute, then fret at the 12th and play. The app shows the saddle move. Move the saddle, retune, check again.
5. **Tension**: pick an alternate tuning to see which strings would go slack and what gauge to use.

## Method

- **Pitch**: McLeod normalised square-difference function on ~85 ms of raw audio (echo cancellation, noise suppression and auto-gain off), parabolic interpolation, then refinement to the fundamental with two band-pass filters centred on the first estimate. The refinement removes a ~4-cent sharp bias that stretched overtones cause right after the pluck.
- **Display**: the needle uses a square-root scale so the last few cents take most of the dial, plus a linear ±10-cent fine bar; it updates every frame from a 120 ms median with light smoothing, and settles within about 0.2 s after a 0.5–2 cent change (measured with a synthetic tone).
- **Inharmonicity**: overtone peaks in a 32,768-point spectrum (~1.5 Hz bins) with peak interpolation; B from a least-squares fit of (f<sub>n</sub>/(n·f<sub>1</sub>))² − 1 = B(n² − 1).
- **Saddle move**: moving the saddle back by Δ lowers the fretted 12th-fret note relative to the harmonic by Δ/L, so Δ = L(k − 1)/(2 − k), k = 2<sup>error/1200</sup>. That is ≈0.37 mm per cent on a 648 mm scale.
- **Tension**: T = 4μL²f², μ from D'Addario's published unit weights (EXL110 10–46, EXL120 9–42) or values entered from any maker's chart.

## How I checked it

| Check | Result |
|---|---|
| Pitch detector on 64 synthetic plucks (8 notes from 82 Hz to 659 Hz; 48 kHz and 44.1 kHz; early attack, late decay, weak fundamental, heavy noise) | Worst error 0.65 cents (in-tune band is ±3) |
| Inharmonicity fit on synthetic strings with known B | Within 4% of the true value |
| Saddle formula: simulated the bridge geometry after the move | Residual error 0 cents; 0.375 mm per cent at 648 mm matches the luthiers' rule of thumb |
| Tension vs D'Addario's published EXL110 chart at 25.5" | 16.2, 15.4, 16.6, 18.4, 19.5, 17.5 lb: identical |
| Full app with a synthetic tone in place of the microphone | Reads a string 7 cents flat as 6.9 flat; intonation errors of −9 to +6 cents give the expected saddle moves to 0.1 mm |
| On the phone | Compare with the reference tone (Accuracy tab) or another tuner |

The test script is `tests/test_dsp.js` (run with `node tests/test_dsp.js`); it loads the same signal-processing code from `index.html`.

## Limits

- Needs a quiet room and one string ringing at a time. Very weak harmonics may not be captured.
- Phone microphones roll off below ~80 Hz; the low E still works because its overtones carry the period.
- Tension figures are only as good as the unit weights; other string brands need their own values (Custom).
- The 80% "slack" threshold is a common rule of thumb, not a standard.
