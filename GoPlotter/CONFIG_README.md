# Configuration Guide

## Overview

The SFAF Plotter application now uses environment-based configuration for improved security and flexibility. All sensitive credentials and configuration options are stored in a `.env` file that is **not** committed to version control.

## Quick Start

1. **Copy the example configuration:**
   ```bash
   cp .env.example .env
   ```

2. **Edit `.env` with your actual credentials:**
   ```bash
   # Use your preferred text editor
   nano .env
   # or
   notepad .env
   ```

3. **Update the database credentials:**
   ```env
   DB_HOST=your_database_host
   DB_USER=your_database_user
   DB_PASSWORD=your_secure_password
   DB_NAME=your_database_name
   ```

4. **Run the application:**
   ```bash
   go run .
   # or
   ./sfaf-plotter
   ```

## Configuration Options

### Server Configuration

| Variable | Description | Default | Required |
|----------|-------------|---------|----------|
| `SERVER_HOST` | Host to bind the server to | `0.0.0.0` | No |
| `SERVER_PORT` | Port to run the server on | `8080` | No |
| `GIN_MODE` | Gin framework mode (`debug`, `release`, `test`) | `debug` | No |
| `LOG_LEVEL` | Application log level | `info` | No |

### Database Configuration

| Variable | Description | Default | Required |
|----------|-------------|---------|----------|
| `DB_HOST` | PostgreSQL database host | None | **Yes** |
| `DB_PORT` | PostgreSQL database port | `5432` | No |
| `DB_USER` | Database username | None | **Yes** |
| `DB_PASSWORD` | Database password | None | **Yes** |
| `DB_NAME` | Database name | None | **Yes** |
| `DB_SSLMODE` | SSL mode for database connection | `disable` | No |

### CORS Configuration

| Variable | Description | Default |
|----------|-------------|---------|
| `CORS_ALLOWED_ORIGINS` | Comma-separated list of allowed origins | `*` |
| `CORS_ALLOWED_METHODS` | Comma-separated list of allowed HTTP methods | `GET,POST,PUT,DELETE,OPTIONS` |
| `CORS_ALLOWED_HEADERS` | Comma-separated list of allowed headers | `Content-Type,Authorization` |

### Feature Flags

| Variable | Description | Default |
|----------|-------------|---------|
| `ENABLE_MCEB_VALIDATION` | Enable MCEB Publication 7 validation | `true` |
| `ENABLE_COORDINATE_CACHING` | Enable coordinate conversion caching | `true` |

## Environment-Specific Configurations

### Development

```env
GIN_MODE=debug
LOG_LEVEL=debug
SERVER_PORT=8080
```

### Production

```env
GIN_MODE=release
LOG_LEVEL=info
SERVER_PORT=80
DB_SSLMODE=require
CORS_ALLOWED_ORIGINS=https://yourdomain.com
```

### Testing

```env
GIN_MODE=test
LOG_LEVEL=warn
DB_NAME=freqnom_DB_test
```

## Security Best Practices

1. **Never commit `.env` files** - The `.gitignore` file is configured to exclude `.env` files
2. **Use strong passwords** - Ensure database passwords are complex and unique
3. **Limit CORS origins** - In production, specify exact allowed origins instead of `*`
4. **Enable SSL** - Set `DB_SSLMODE=require` for production databases
5. **Rotate credentials** - Periodically update database passwords and other secrets

## Using System Environment Variables

If you prefer not to use a `.env` file, you can set environment variables directly:

### Windows (PowerShell)
```powershell
$env:DB_HOST="10.0.200.4"
$env:DB_USER="freqman"
$env:DB_PASSWORD="your_password"
$env:DB_NAME="freqnom_DB"
```

### Linux/macOS (Bash)
```bash
export DB_HOST="10.0.200.4"
export DB_USER="freqman"
export DB_PASSWORD="your_password"
export DB_NAME="freqnom_DB"
```

## Troubleshooting

### Error: "Required environment variable DB_HOST is not set"

**Solution:** Ensure your `.env` file exists and contains all required variables.

### Error: "No .env file found, using system environment variables"

**Solution:** This is a warning, not an error. The application will work if system environment variables are set. Create a `.env` file if you prefer file-based configuration.

### Database connection fails

**Solution:**
1. Verify database credentials in `.env`
2. Check database server is running
3. Ensure network connectivity to database host
4. Verify firewall rules allow connection on specified port

## Migration from Hardcoded Configuration

If you're upgrading from a version with hardcoded credentials:

1. The old default values were:
   - Host: `10.0.200.4`
   - Port: `5432`
   - User: `freqman`
   - Database: `freqnom_DB`

2. These are **no longer hardcoded** for security reasons
3. You **must** create a `.env` file with your credentials
4. Use `.env.example` as a template

## Configuration Loading Order

The application loads configuration in this order:

1. Attempts to load `.env` file from current directory
2. Falls back to system environment variables if `.env` not found
3. Uses default values for optional settings
4. **Fails with error** if required variables are missing

## Support

For issues related to configuration, check:
- `.env` file exists and is readable
- All required variables are set
- Variable names match exactly (case-sensitive)
- No extra spaces around `=` signs in `.env` file
