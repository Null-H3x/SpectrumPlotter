# Logging Guide

## Overview

SFAF Plotter uses **Uber's Zap** library for high-performance, structured logging. All logs are output in a structured format that's easy to parse, search, and analyze.

## Log Levels

The application supports the following log levels (configured via `LOG_LEVEL` in `.env`):

| Level | Description | Use Case |
|-------|-------------|----------|
| `debug` | Detailed diagnostic information | Development, troubleshooting |
| `info` | General informational messages | Normal operations |
| `warn` | Warning messages for non-critical issues | Potential problems |
| `error` | Error messages for failures | Application errors |
| `fatal` | Fatal errors that cause app shutdown | Critical failures |

## Configuration

### Environment Variables

```env
# Set log level
LOG_LEVEL=info

# Set application mode (affects log format)
GIN_MODE=debug   # Pretty console logs
GIN_MODE=release # JSON logs for production
```

### Log Output Formats

**Development Mode (`GIN_MODE=debug`):**
```
2025-01-09T10:30:45.123Z  INFO  Application starting  {"version": "1.0.0", "mode": "debug"}
2025-01-09T10:30:45.456Z  INFO  HTTP Request  {"method": "GET", "path": "/api/markers", "status": 200, "latency": "15ms"}
```

**Production Mode (`GIN_MODE=release`):**
```json
{"level":"info","ts":"2025-01-09T10:30:45.123Z","msg":"Application starting","version":"1.0.0","mode":"release"}
{"level":"info","ts":"2025-01-09T10:30:45.456Z","msg":"HTTP Request","method":"GET","path":"/api/markers","status":200,"latency":"15ms"}
```

## Request Logging

Every HTTP request is automatically logged with the following information:

- **Method**: HTTP method (GET, POST, etc.)
- **Path**: Request path
- **Query**: Query string parameters
- **Status**: HTTP status code
- **Latency**: Request processing time
- **IP**: Client IP address
- **User-Agent**: Client user agent

Example:
```json
{
  "level": "info",
  "msg": "HTTP Request",
  "method": "POST",
  "path": "/api/markers",
  "query": "",
  "status": 201,
  "latency": "45.2ms",
  "ip": "10.0.200.100",
  "user_agent": "Mozilla/5.0..."
}
```

## Error Logging

Errors are logged with full context and stack traces:

```json
{
  "level": "error",
  "msg": "Failed to create marker",
  "error": "database connection lost",
  "marker_id": "abc-123",
  "caller": "handlers/marker_handler.go:45"
}
```

## Panic Recovery

The application includes automatic panic recovery middleware that:
1. Catches panics before they crash the server
2. Logs the panic with full stack trace
3. Returns a 500 error response to the client
4. Allows the server to continue running

Example panic log:
```json
{
  "level": "error",
  "msg": "Panic recovered",
  "error": "runtime error: index out of range",
  "path": "/api/markers/123",
  "method": "GET",
  "stack": "goroutine 1 [running]:\n..."
}
```

## Using the Logger in Code

### Getting the Global Logger

```go
import (
    "sfaf-plotter/config"
    "go.uber.org/zap"
)

logger := config.GetLogger()
```

### Basic Logging

```go
// Info level
logger.Info("Marker created successfully")

// With structured fields
logger.Info("Marker created",
    zap.String("marker_id", markerID),
    zap.Float64("lat", latitude),
    zap.Float64("lng", longitude),
)

// Error level
logger.Error("Failed to save marker",
    zap.Error(err),
    zap.String("marker_id", markerID),
)

// Warning level
logger.Warn("Database connection slow",
    zap.Duration("latency", latency),
)

// Debug level (only logged when LOG_LEVEL=debug)
logger.Debug("Processing request",
    zap.Any("request_data", requestData),
)
```

### Structured Fields

Zap provides typed fields for better performance and safety:

```go
// Strings
zap.String("key", "value")

// Numbers
zap.Int("count", 42)
zap.Float64("latitude", 30.43)

// Errors
zap.Error(err)

// Durations
zap.Duration("latency", time.Since(start))

// Timestamps
zap.Time("created_at", time.Now())

// Any type (uses reflection, slower)
zap.Any("data", complexObject)

// Arrays
zap.Strings("tags", []string{"tag1", "tag2"})
```

## Best Practices

### 1. Use Appropriate Log Levels

```go
// ❌ Bad
logger.Error("User logged in")  // Not an error!

// ✅ Good
logger.Info("User logged in",
    zap.String("user_id", userID),
)
```

### 2. Add Context to Logs

```go
// ❌ Bad
logger.Info("Marker created")

// ✅ Good
logger.Info("Marker created",
    zap.String("marker_id", markerID),
    zap.String("type", "manual"),
    zap.String("user", username),
)
```

### 3. Log Errors with Context

```go
// ❌ Bad
logger.Error("Error", zap.Error(err))

// ✅ Good
logger.Error("Failed to create marker",
    zap.Error(err),
    zap.String("marker_id", markerID),
    zap.Float64("lat", lat),
    zap.Float64("lng", lng),
)
```

### 4. Don't Log Sensitive Data

```go
// ❌ Bad - logs password!
logger.Info("User authentication",
    zap.String("username", username),
    zap.String("password", password),  // NEVER!
)

// ✅ Good
logger.Info("User authentication",
    zap.String("username", username),
    zap.Bool("success", true),
)
```

### 5. Use Debug Level for Verbose Logs

```go
// Only logged when LOG_LEVEL=debug
logger.Debug("Detailed request data",
    zap.Any("headers", headers),
    zap.Any("body", requestBody),
)
```

## Log Analysis

### Filtering Logs by Level

```bash
# All errors
cat app.log | grep '"level":"error"'

# All requests to specific endpoint
cat app.log | grep '"/api/markers"'

# Slow requests (> 1 second)
cat app.log | grep 'latency' | grep -E '"latency":"[0-9]+\.[0-9]+s"'
```

### Using jq for JSON Logs

```bash
# Pretty print all logs
cat app.log | jq '.'

# Filter by level
cat app.log | jq 'select(.level == "error")'

# Extract specific fields
cat app.log | jq '{time: .ts, message: .msg, status: .status}'

# Count requests by status code
cat app.log | jq 'select(.status != null) | .status' | sort | uniq -c
```

## Performance

Zap is one of the fastest structured logging libraries for Go:

- **Structured logging**: Fields are strongly typed, avoiding reflection
- **Zero allocations**: In many common cases
- **Async writes**: Option to buffer logs for high-throughput scenarios

## Migration from Standard Library

If updating existing code that uses `log` package:

```go
// Old
import "log"
log.Println("Message")
log.Printf("Value: %s", value)

// New
import (
    "sfaf-plotter/config"
    "go.uber.org/zap"
)
logger := config.GetLogger()
logger.Info("Message")
logger.Info("Value", zap.String("value", value))
```

## Troubleshooting

### Logs not appearing

1. Check `LOG_LEVEL` in `.env` - messages below this level won't appear
2. Ensure logger is initialized before use
3. Call `defer logger.Sync()` in main to flush buffered logs

### Too much noise in logs

```env
# Reduce log verbosity
LOG_LEVEL=warn  # Only warnings and errors
GIN_MODE=release  # Disable debug logs
```

### Want more details

```env
# Increase log verbosity
LOG_LEVEL=debug  # Show everything
GIN_MODE=debug  # Pretty console output
```

## Example Configurations

### Development

```env
LOG_LEVEL=debug
GIN_MODE=debug
```

Output: Colorful, pretty-printed console logs with full details

### Staging

```env
LOG_LEVEL=info
GIN_MODE=release
```

Output: JSON logs with standard operational messages

### Production

```env
LOG_LEVEL=warn
GIN_MODE=release
```

Output: JSON logs with only warnings and errors
