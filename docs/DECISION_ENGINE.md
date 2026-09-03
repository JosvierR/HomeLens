# Decision Confidence Engine

## Problem

A measurement can be uncertain without being important. Another measurement can look fairly reliable but sit close to a decision boundary where a small error matters.

A generic "confidence badge" cannot answer the operational question:

> What should a human verify first?

## Approach

HomeLens evaluates measurement uncertainty and decision sensitivity. The engine runs deterministic uncertainty scenarios, observes how often the recommendation stays in the same planning band, and ranks measurements by expected decision impact.

## Output

- expected planning band
- decision stability percentage
- likely planning-index range
- distribution across planning bands
- ranked human verification queue

## Why deterministic scenarios?

The current prototype uses deterministic pseudo-random samples so test runs and demos are reproducible. A production system could replace this with calibrated distributions learned from device, capture, room-type, or computer-vision performance data.

## Not an HVAC calculator

The planning index in this repository is deliberately illustrative. It is not Manual J, is not certified, and must not be used to size real equipment.

The engineering contribution is the uncertainty/decision layer, not the placeholder thermal model.
