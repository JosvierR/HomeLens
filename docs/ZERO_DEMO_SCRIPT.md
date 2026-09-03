# Zero Homes demo script

HomeLens estimates room geometry from visual evidence and carries the uncertainty forward. It can tell when the answer is stable and when one measurement is worth checking.

Use `/analysis?demo=1`. That room is synthetic and labeled **Demo**. Do not present it as a real scan.

## 60–90 seconds

**0–10 s — Open**
Open HomeLens. “Three phone photos become a room estimate, with a range on each dimension.”

**10–25 s — Estimates**
Show Width 9.4 ft, 77%, likely 8.5–10.3 ft. Length and height are tighter. “These are photo estimates, not tape measurements.”

**25–40 s — Will it fit?**
Scroll to Will it fit? The L-shaped sectional is **Uncertain**, about 70–85%. “The sectional only fits in part of the measured range.”

**40–50 s — The ask**
HomeLens says **Check width**. Width is the only dimension that can change that answer. Length is less confident and does not matter here.

**50–65 s — Verify**
Enter 9.8 ft. Status becomes **Verified**. The original photo estimate stays visible: 9.4 ft · 77%.

**65–75 s — The answer settles**
The sectional becomes **Fits · 100%**. “Fits with the verified room dimensions.”

**75–90 s — The loop**
Open Technical details. Photo estimate, verified value, and the difference are all there. Calibration preview is labeled synthetic. “The human value is ground truth. The photo estimate is kept for learning.”

## Alternate ending

Verify width as **8.9 ft**. The sectional becomes **Doesn't fit · 0%**. Same product story.

## What not to say

- Not “AI-powered room scanner.”
- Not “It knows exactly what fits.”
- Not “20 comparable verified measurements” unless you also say they are synthetic.

## If a real room is too stable

Do not change production numbers. Use this labeled demo fixture for the uncertainty story. A real camera scan is the photo-metric story; this fixture is the decision story.
