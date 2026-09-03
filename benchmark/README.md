# Photo-metric benchmark data

Real benchmark cases are intentionally not committed to the public application repository because they contain home imagery and ground truth. Run the benchmark against an approved, access-controlled JSON dataset with at least 25–50 rooms before treating photo measurement as production-validated.

Each case must contain `roomId`, real `groundTruth` values, and model `estimates` for `width`, `length`, and `height`. Optional capture context should include device family, lighting, and room type. Example shape:

```json
[{"roomId":"private-id","deviceFamily":"ios-mobile","lighting":"daylight","roomType":"bedroom","groundTruth":{"width":12.5,"length":15.8,"height":9.0},"estimates":{"width":{"value":12.7,"confidence":0.8},"length":{"value":15.6,"confidence":0.7},"height":{"value":9.1,"confidence":0.9}}}]
```

Do not substitute generated or guessed cases for real tape/laser ground truth.
