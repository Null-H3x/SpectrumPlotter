# SFAF View Manager

A standalone tool for managing custom SFAF (Spectrum Frequency Assignment Form) database views.

## Overview

The View Manager is a separate web application that allows users to create, edit, and manage custom views for the SFAF database. It provides a visual interface for selecting which fields to display, organizing them, and exporting/importing view configurations.

## Features

### 📋 View Management
- **Create Custom Views**: Select specific SFAF fields to display
- **Edit Views**: Modify existing view configurations
- **Duplicate Views**: Clone views for quick customization
- **Delete Views**: Remove unwanted views
- **Preview Views**: See which fields are included before applying

### ⚙️ Settings
- **Set Default View**: Choose which view loads by default
- **Import/Export**: Share view configurations between systems
- **Bulk Operations**: Clear all views or reset to defaults

### 🏷️ Field Organization
Fields are organized into logical groups:
- Administrative Information
- Frequency Information
- Emission Characteristics (113-116)
- Time/Date Information
- Organizational Information
- Transmitter Location
- Transmitter Equipment
- FAO & Control
- Computed Fields

## File Structure

```
web/
├── templates/
│   └── view_manager.html          # Main HTML template
├── static/
│   ├── css/
│   │   └── view_manager.css       # Styling
│   └── js/
│       └── view_manager.js        # Application logic
```

## Architecture

### Frontend (JavaScript)
**File**: `web/static/js/view_manager.js`

The ViewManager class handles all client-side operations:

```javascript
class ViewManager {
    constructor() {
        this.views = [];           // Array of custom views
        this.editingViewId = null; // Currently editing view
        this.defaultView = null;   // Default view preference
    }

    // Storage Methods
    loadViews()
    saveViews()
    loadDefaultView()
    saveDefaultView()

    // CRUD Operations
    showCreateView()
    editView(viewId)
    saveView()
    deleteView(viewId)
    duplicateView(viewId)
    previewView(viewId)

    // Rendering
    renderViewsList()
    renderFieldSelector()

    // Import/Export
    exportViews()
    importViews()
}
```

### Data Storage
Views are stored in browser localStorage with the following structure:

```javascript
{
    id: "1234567890",
    name: "Basic Info",
    description: "Essential SFAF fields",
    fields: [
        { key: "field005", label: "005 - Security Classification" },
        { key: "field110", label: "110 - Frequency" },
        ...
    ],
    createdAt: "2025-12-25T12:00:00.000Z",
    updatedAt: "2025-12-25T13:00:00.000Z"
}
```

### Backend (Go)
**File**: `main.go`

Simple route handler:

```go
r.GET("/view-manager", func(c *gin.Context) {
    c.HTML(200, "view_manager.html", gin.H{
        "title": "SFAF View Manager",
    })
})
```

## Usage

### Accessing the View Manager
Navigate to: `http://localhost:8080/view-manager`

### Creating a View

1. Click **"Create New View"** button
2. Enter a view name and optional description
3. Select fields to include from the organized list
4. Click **"Save View"**

### Editing a View

1. Find the view card in the list
2. Click the **Edit** button (pencil icon)
3. Modify name, description, or field selection
4. Click **"Update View"**

### Exporting Views

1. Click **"Export Views"** in the header
2. A JSON file will download containing all your custom views
3. Share this file with other users or use for backup

### Importing Views

1. Click **"Import Views"** in the header
2. Select a previously exported JSON file
3. Views will be added to your existing collection

## Integration with Database Viewer

The View Manager shares localStorage with the main database viewer (`db_viewer.html`):

- Views created in the View Manager appear in the database viewer's view dropdown
- Default view preference applies to both applications
- Changes sync automatically through localStorage

### localStorage Keys

```javascript
'sfaf_custom_views'  // Array of custom view objects
'sfaf_default_view'  // Default view ID or name
```

## Converting to Standalone Application

To convert this tool into a completely separate application:

### 1. Backend API

Create RESTful endpoints in Go:

```go
// handlers/view_handler.go
type ViewHandler struct {
    service *ViewService
}

func (h *ViewHandler) GetViews(c *gin.Context) {
    // GET /api/views
}

func (h *ViewHandler) CreateView(c *gin.Context) {
    // POST /api/views
}

func (h *ViewHandler) UpdateView(c *gin.Context) {
    // PUT /api/views/:id
}

func (h *ViewHandler) DeleteView(c *gin.Context) {
    // DELETE /api/views/:id
}
```

### 2. Database Schema

```sql
CREATE TABLE custom_views (
    id VARCHAR(36) PRIMARY KEY,
    user_id VARCHAR(36),
    name VARCHAR(100) NOT NULL,
    description TEXT,
    fields JSON NOT NULL,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    FOREIGN KEY (user_id) REFERENCES users(id)
);

CREATE TABLE view_fields (
    id INT AUTO_INCREMENT PRIMARY KEY,
    view_id VARCHAR(36) NOT NULL,
    field_key VARCHAR(50) NOT NULL,
    field_label VARCHAR(100) NOT NULL,
    display_order INT,
    FOREIGN KEY (view_id) REFERENCES custom_views(id) ON DELETE CASCADE
);
```

### 3. Service Layer

```go
// services/view_service.go
type ViewService struct {
    repo *ViewRepository
}

type View struct {
    ID          string    `json:"id"`
    UserID      string    `json:"user_id"`
    Name        string    `json:"name"`
    Description string    `json:"description"`
    Fields      []Field   `json:"fields"`
    CreatedAt   time.Time `json:"created_at"`
    UpdatedAt   time.Time `json:"updated_at"`
}

type Field struct {
    Key   string `json:"key"`
    Label string `json:"label"`
}

func (s *ViewService) GetUserViews(userID string) ([]View, error)
func (s *ViewService) CreateView(view *View) error
func (s *ViewService) UpdateView(view *View) error
func (s *ViewService) DeleteView(viewID, userID string) error
```

### 4. Update JavaScript to Use API

```javascript
// Update ViewManager methods to use fetch API
async loadViews() {
    const response = await fetch('/api/views');
    this.views = await response.json();
}

async saveView() {
    const viewData = { name, description, fields };

    if (this.editingViewId) {
        await fetch(`/api/views/${this.editingViewId}`, {
            method: 'PUT',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(viewData)
        });
    } else {
        await fetch('/api/views', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(viewData)
        });
    }
}
```

## Field Definitions

All SFAF fields are defined in `getFieldGroups()`. To add new fields:

1. Locate the appropriate group in `view_manager.js`
2. Add the field definition:
```javascript
{ key: 'field###', label: '### - Field Description' }
```

## Browser Compatibility

- Chrome/Edge: ✅ Full support
- Firefox: ✅ Full support
- Safari: ✅ Full support
- IE11: ❌ Not supported (uses modern ES6+ features)

## Development

### Running Locally

1. Ensure Go server is running:
```bash
cd "z:\DriveBackup\Nerdery\SFAF Plotter\GoPlotter"
go run main.go
```

2. Navigate to:
```
http://localhost:8080/view-manager
```

### Making Changes

**HTML**: Edit `web/templates/view_manager.html`
**CSS**: Edit `web/static/css/view_manager.css`
**JavaScript**: Edit `web/static/js/view_manager.js`

Changes to static files (CSS/JS) are served immediately.
Changes to templates require a server restart.

## Future Enhancements

### Planned Features
- [ ] User authentication and per-user views
- [ ] Server-side view storage (database)
- [ ] View sharing between users
- [ ] View templates/presets
- [ ] Field-level permissions
- [ ] Column width customization
- [ ] Sorting/filtering preferences per view
- [ ] Color coding/conditional formatting rules
- [ ] Export views to CSV/Excel format
- [ ] View usage analytics
- [ ] Version history for views
- [ ] Collaborative editing

### API Endpoints (Future)
```
GET    /api/views              # List all views
POST   /api/views              # Create view
GET    /api/views/:id          # Get single view
PUT    /api/views/:id          # Update view
DELETE /api/views/:id          # Delete view
POST   /api/views/:id/clone    # Duplicate view
GET    /api/views/templates    # Get view templates
POST   /api/views/:id/share    # Share with other users
```

## Troubleshooting

### Views not appearing in database viewer
- Check that both pages use the same localStorage keys
- Verify localStorage is enabled in browser
- Check browser console for JavaScript errors

### Changes not saving
- Ensure localStorage quota not exceeded (usually 5-10MB)
- Check browser privacy settings (incognito mode may block localStorage)
- Verify no JavaScript errors in console

### Fields missing from selector
- Check `getFieldGroups()` in `view_manager.js`
- Ensure field is defined in the appropriate group
- Verify field key matches SFAF model

## Support

For issues or questions:
1. Check browser console for errors
2. Verify server is running
3. Check localStorage in DevTools
4. Review this documentation

## License

Part of the SFAF Plotter application.
