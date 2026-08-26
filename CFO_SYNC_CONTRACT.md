# GigRide → CFO Engine transaction contract

## Authority boundary

GigRide captures operational facts. CFO Engine validates, reconciles, analyses and makes financial recommendations. GigRide must never modify CFO debt balances or make debt/payment decisions.

## Transaction envelope

Every transaction sent to CFO Engine must contain:

- `transactionId`: immutable UUID generated once at capture.
- `schemaVersion`: currently `1`.
- `capturedAt`: ISO-8601 timestamp.
- `sourceApp`: `gigride`.
- `captureMethod`: `voice`, `manual`, `gps`, or `system`.
- `type`: `income` or `expense`.
- `category`: normalized category such as `trip_income`, `incentive`, `fuel`, `toll`, `parking`, `maintenance`, `food`, or `other`.
- `amountMinor`: integer amount in paise to avoid floating-point currency errors.
- `currency`: `INR`.
- `platform`: optional gig platform/source.
- `note`: optional user note.
- `shiftId`: optional shift identifier.
- `syncStatus`: `pending`, `sent`, `accepted`, `rejected`, or `needs_review`.
- `revision`: integer beginning at 1.

CFO Engine must treat `transactionId` as the primary idempotency key and reject duplicate imports.

## Voice safety rules

Supported essential intents include start shift, stop shift, income entry, expense entry, undo last transaction, today's earnings, today's expenses, net profit, distance and fuel status.

Voice parsing must never silently guess a missing or ambiguous amount/category. Ambiguous commands require confirmation. Financial transactions must be read back or visibly confirmed before final save when recognition confidence or parsing is uncertain.

Examples:

- `Start shift`
- `Stop shift`
- `Ola 350`
- `Uber income 420`
- `Petrol 500`
- `Toll 80`
- `Parking 50`
- `Undo last transaction`

## Offline-first synchronization

Transactions are committed locally before synchronization. Network failure must not delete or mutate the local transaction. Retry uses the same `transactionId`. CFO acknowledgement changes only the sync status. Rejected or review-required transactions remain visible in GigRide.

## Audit rule

Edits must not silently overwrite financial history. Increment `revision` and preserve enough audit metadata to identify that a transaction was corrected or reversed.
