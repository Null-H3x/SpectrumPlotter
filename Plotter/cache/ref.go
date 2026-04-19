package cache

import "time"

// Ref is the shared cache for reference data (units, installations, IRAC notes, etc.).
// 5-minute TTL: data is stale at most 5 minutes after a write.
var Ref = New(5 * time.Minute)
