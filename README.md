# SFAF Plotter

A spectrum-community led effort to replace SXXI and integrate with all aspects of the DoD to deliver a frequency coordination and mapping platform built with Go. The goal is cohesive spectrum planning across all functions with a visual aspect that has been absent from previous products.

PostgreSQL is used to store all tables and provide perpetual information storage across sessions and users.




---

## Features


### Map Viewer
- Interactive Leaflet-based map with real-time coordinate tooltips on hover
- Place manual markers (draggable) or import directly from SFAF files (fixed position)
- On-the-fly coordinate conversion between decimal degrees, DMS, and military compact formats
- Draw and persist geometry overlays — circles, polygons, and rectangles — linked to the database
- Field 530 polygon visualization renders MCEB authorization radius boundaries directly on the map
- Viewport-based marker loading keeps performance smooth with large datasets
<img width="1521" height="1131" alt="image" src="https://github.com/user-attachments/assets/9ab2c82c-bf91-4ef5-9864-bf685abdbeb6" />

### SFAF Management
- Import raw SFAF text files — records are parsed, validated, and stored automatically
- Full CRUD operations on all SFAF records with 900+ field definitions
- Field validation enforces MCEB Publication 7, Change 1 standards
- Export individual records, a selected subset, or the entire dataset
- SFAF Table Manager provides a structured spreadsheet-style view for browsing and inline editing

### Frequency Management
- Track frequency assignments per unit with automatic serial number generation
- Submit, review, and approve frequency requests through a built-in workflow
- Conflict detection identifies overlapping assignments across units before approval
- Expiring frequency alerts surface assignments approaching their end date
- Frequency Nomination & Deconfliction module supports the full nomination cycle from request to assignment
<img width="1765" height="1278" alt="image" src="https://github.com/user-attachments/assets/d75e9065-a682-4264-98ee-58033ec9343e" />

- Request form walks user through with intuitive "Turbo-Tax style" questions to ensure user isn't overwhelmed and ISM gets best information available
- User is able to select coordinates on map and set veiwable radius, enabling full understanding of selected operation area
- Dynamic selection of Serial Number, Frequency, and 710/702 fields with real-time availability for each tracking option

<img width="1750" height="841" alt="image" src="https://github.com/user-attachments/assets/59eb38c4-a057-4f6b-9832-aceece71d69c" />

<img width="1763" height="874" alt="image" src="https://github.com/user-attachments/assets/720f19fd-971a-44d4-a4af-dd54f9b203df" />

<img width="1897" height="846" alt="image" src="https://github.com/user-attachments/assets/dc2ee507-f33e-44ae-abb2-e616a02b71a5" />

### Database Viewer
- Unified interface to browse and search markers, SFAF records, IRAC notes, and analytics
- 388 IRAC coordination notes across 6 categories: coordination, emission, limitation, special, priority, and minute
- Bulk select, edit, and delete operations across all record types
- Analytics dashboard with frequency distribution, spectrum occupancy chart and compliance reporting
- Export data in multiple formats
- View record on map with a single click
- Customizable views to show only the fields pertinent to your task
- Exportable data in any order or sorted in any order the user prefers

<img width="1750" height="1399" alt="image" src="https://github.com/user-attachments/assets/951a6440-af58-459b-89f3-7e05c40131f4" />

### Authentication & Access Control
- Session-based login and logout with server-side session management
- PKI certificate authentication support for CAC/PIV card environments
- Role-based access with superuser account creation
- Development auth bypass available for local testing (disabled in production)

---

## Tech Stack

| Layer | Technology |
|---|---|
| Backend | Go 1.25, Gin |
| Database | PostgreSQL (via sqlx) |
| Frontend | Vanilla JS, Leaflet.js |
| Logging | Uber Zap |
| Config | godotenv |
| Auth | Session tokens, PKI |

---

## Project Structure

```
GoPlotter/
├── cmd/                  # CLI utilities (db init, migrations, data tools)
├── config/               # App config, DB connection, logging setup
├── docs/                 # Feature and deployment documentation
├── handlers/             # HTTP route handlers
├── middleware/           # Logging, recovery, auth middleware
├── migrations/           # SQL migration files
├── models/               # Data models
├── repositories/         # Database access layer
├── services/             # Business logic
├── utils/                # Response serialization helpers
└── web/
    ├── static/           # CSS, JS, images
    └── templates/        # HTML templates
```

---

## Pages

| Route | Description |
|---|---|
| `/` | Landing page |
| `/map-viewer` | Interactive map with markers and geometry |
| `/database` | Database viewer and analytics |
| `/view-manager` | SFAF Table Manager |
| `/frequency-nomination` | Frequency nomination and deconfliction |
| `/frequency/assignments` | Unit frequency assignments |
| `/frequency/request` | Submit a frequency request |
| `/frequency/requests` | Frequency request dashboard |
| `/profile` | User profile |

---

## Getting Started

### Prerequisites
- Go 1.21+
- PostgreSQL

### Setup

1. Clone the repo and navigate to the project:
   ```bash
   git clone https://github.com/SpectrumIlluminati/SpectrumPlotter.git
   cd SpectrumPlotter/GoPlotter
   ```

2. Copy the example environment file and configure it:
   ```bash
   cp .env.example .env
   ```

3. Initialize the database:
   ```bash
   go run cmd/init_database/main.go
   go run cmd/run_migration/main.go
   ```

4. Start the server:
   ```bash
   go run main.go
   ```

5. Open `http://localhost:8080` in your browser.

### Environment Variables

See `.env.example` for all configuration options including database connection, server port, Gin mode, CORS settings, and logging level.

---

## Documentation

Detailed documentation is available in [`GoPlotter/docs/`](GoPlotter/docs/):

- [AWS Deployment](GoPlotter/docs/AWS_DEPLOYMENT.md)
- [PKI Authentication](GoPlotter/docs/PKI_AUTHENTICATION.md)
- [Authorization Radius Guide](GoPlotter/docs/AUTHORIZATION_RADIUS_GUIDE.md)
- [Field 530 Implementation](GoPlotter/docs/FIELD_530_IMPLEMENTATION.md)
- [Frequency Assignment Module](GoPlotter/docs/FREQUENCY_ASSIGNMENT_MODULE.md)
- [Frequency Nomination](GoPlotter/docs/FREQUENCY_NOMINATION_README.md)
