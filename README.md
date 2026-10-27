# SetupScope: guitar tuner and setup check

K E Vaibhav · ME22B048 · Data Visualisation, Assignment 2

**Live app:** https://vaibhavkev.github.io/setupscope/ (open on a phone, tap *Start listening*, allow the microphone)

A phone web app that uses the microphone to tune a guitar and check its intonation. One HTML file (`index.html`), no libraries, no network use; the sound is analysed on the phone and never recorded.

## Screens

| Screen | What it measures | What you see | What you do with it |
|---|---|---|---|
| **Tune** | Pitch of the string being played | A guitar headstock: the string you're playing lights up (auto-detect), or tap a string to pick it. A zoomed dial plus a ±10-cent fine bar, a "Tighten / Loosen / In tune" instruction, a tick on each string once it holds in tune, and a 10-second pitch line | Turn the peg until it's green; see when all six strings are done, and whether a string is slipping |
| **Tune → tuning change** | String tension in the chosen tuning vs standard (T = 4μL²f²) | One sentence under the tuner, e.g. "String 6 drops to 79% of standard tension… use .052" | Decide whether an alternate tuning needs heavier strings |
| **Intonation** | 12th-fret fretted note vs 12th-fret harmonic, per string | Guided 3-step check, a result card, and a bridge diagram with an arrow and millimetres per saddle | Which saddles to move, which way and how far |
| **About & accuracy** | Self-test on synthetic plucked strings; reference tone | Worst error over 24 test tones | Whether to trust the readings |

Settings (behind the *Settings* button): reference pitch A4, scale length, string set.

## Method

- **Pitch**: McLeod normalised square-difference function on ~85 ms of raw audio (echo cancellation, noise suppression and auto-gain off), parabolic interpolation, then refinement to the fundamental with two band-pass filters centred on the first estimate (removes a ~4-cent sharp bias from stretched overtones just after the pluck). Updates every screen frame; the needle settles within ~0.2 s after a small change.
- **Smooth tracking**: when the normal detector loses a fading note, the app keeps following it by band-pass filtering around the last pitch (accepted only if that band holds real energy and the waveform is clean). Jumps over 70 cents must repeat for 3 frames before they are shown. The needle follows the measurements through a critically damped spring at screen rate, so it glides while you turn the peg. In a simulated test (peg turned 35 cents while the string decays) the meter keeps reading about twice as long as before (`node tests/glide_test.js`).
- **Auto mode**: nearest string in the chosen tuning. A string counts as tuned after ~0.8 s within ±3 cents and loses its tick if it drifts past ±6.
- **Saddle move**: moving the saddle back by Δ lowers the fretted 12th-fret note relative to the harmonic by Δ/L, so Δ = L(k − 1)/(2 − k), k = 2<sup>error/1200</sup> (≈0.37 mm per cent on a 648 mm scale).
- **Tension**: T = 4μL²f², μ from D'Addario's published unit weights (EXL110 10–46, EXL120 9–42) or values entered from any maker's chart. "Slack" = below 80% of standard tension (a common rule of thumb); the suggested gauge restores standard tension (diameter ∝ √μ).

## How I checked it

| Check | Result |
|---|---|
| Pitch detector on 64 synthetic plucks (82–659 Hz; 48 and 44.1 kHz; attack, late decay, weak fundamental, heavy noise) | Worst error 0.65 cents (in-tune band ±3) |
| Saddle formula: simulated bridge geometry after the move | Residual 0 cents; 0.375 mm per cent at 648 mm matches the guitar techs' rule of thumb |
| Tension vs D'Addario's published EXL110 chart at 25.5" | 16.2, 15.4, 16.6, 18.4, 19.5, 17.5 lb: identical |
| Full app with a synthetic tone in place of the microphone | Auto-detect finds all six strings and the right cents; a string 150 cents flat is handled by picking it; Drop D tension note correct; intonation errors give the expected saddle moves to 0.1 mm |
| On the phone | Compare with the reference tone (About tab) or another tuner |

Test script: `node tests/test_dsp.js` (it loads the signal-processing code from `index.html`).

## Limits

- One string ringing at a time, in a quiet room. If a string is more than ~2.5 semitones off, auto mode may pick the neighbouring string: tap the string instead.
- Phone microphones are weak below ~80 Hz; the low E still works through its overtones.
- Tension figures depend on the unit weights; other brands need their own values.
