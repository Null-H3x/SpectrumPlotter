// Package cache provides a simple in-memory TTL cache for reference data
// that changes infrequently (units, installations, IRAC notes, etc.).
package cache

import (
	"sync"
	"time"
)

type entry struct {
	value     any
	expiresAt time.Time
}

// Cache is a goroutine-safe key/value store with per-entry TTL.
type Cache struct {
	mu      sync.RWMutex
	entries map[string]entry
	ttl     time.Duration
}

// New returns a Cache where every stored value expires after ttl.
func New(ttl time.Duration) *Cache {
	return &Cache{
		entries: make(map[string]entry),
		ttl:     ttl,
	}
}

// Get returns the cached value and true, or nil and false if missing/expired.
func (c *Cache) Get(key string) (any, bool) {
	c.mu.RLock()
	e, ok := c.entries[key]
	c.mu.RUnlock()
	if !ok || time.Now().After(e.expiresAt) {
		return nil, false
	}
	return e.value, true
}

// Set stores value under key, overwriting any existing entry.
func (c *Cache) Set(key string, value any) {
	c.mu.Lock()
	c.entries[key] = entry{value: value, expiresAt: time.Now().Add(c.ttl)}
	c.mu.Unlock()
}

// Delete removes key immediately (call after writes to reference tables).
func (c *Cache) Delete(key string) {
	c.mu.Lock()
	delete(c.entries, key)
	c.mu.Unlock()
}

// Flush removes all entries.
func (c *Cache) Flush() {
	c.mu.Lock()
	c.entries = make(map[string]entry)
	c.mu.Unlock()
}
