# SFAF Plotter Landing Page

## Overview

The landing page provides a professional, user-friendly entry point to the SFAF Plotter platform with login functionality and module selection.

## Features

### 1. **Modern Dark Theme Design**
- Gradient accents with purple/blue color scheme
- Smooth animations and transitions
- Fully responsive layout for all devices
- Glassmorphism effects with backdrop blur

### 2. **Hero Section**
- Eye-catching gradient headline
- Platform statistics cards (MCEB Pub 7 Compliant, Global Coverage, Secure Platform)
- Animated map preview with pulsing markers
- Clear value proposition

### 3. **Login System**
- Modal-based login interface
- LocalStorage-based session management
- "Remember Me" functionality
- Demo mode (accepts any username/password for development)
- Secure design ready for backend integration

### 4. **Module Selection**
Four main platform modules with detailed descriptions:

#### Map Viewer (`/map-viewer`)
- Interactive mapping interface
- Marker management
- Geometry tools
- Multiple base layers

#### Database Viewer (`/database`)
- Record management
- Advanced filtering
- Bulk operations
- Export/Import

#### View Manager (`/view-manager`)
- Custom views
- Saved filters
- Workspace presets
- Quick access

#### Frequency Nomination (`/frequency-nomination`)
- Frequency analysis
- Deconfliction tools
- Spectrum visualization
- Automated nomination

### 5. **Features Section**
Highlights platform capabilities:
- Import & Export (SXXI format)
- Geocoding
- Measurement Tools
- Spectrum Analysis
- IRAC Notes
- Customizable settings

### 6. **Footer**
- Platform information
- Compliance details (MCEB Publication 7, SXXI Format)
- Support links

## File Structure

```
web/
├── templates/
│   └── landing.html          # Main landing page template
├── static/
    ├── css/
    │   └── landing.css        # Landing page styles
    └── js/
        └── landing.js         # Login and navigation logic
```

## Routes

### Landing Page
- **Route**: `/`
- **Template**: `landing.html`
- **Description**: Main entry point with login and module selection

### Module Routes
- **Map Viewer**: `/map-viewer`
- **Database Viewer**: `/database`
- **View Manager**: `/view-manager`
- **Frequency Nomination**: `/frequency-nomination`

## Login System

### Current Implementation (Demo Mode)
The login system is currently in **demo mode** for development:
- Accepts any username/password combination
- Stores session in localStorage
- Supports "Remember Me" functionality

### Storage Keys
- `sfaf_logged_in`: Boolean flag for login status
- `sfaf_username`: Logged-in username
- `sfaf_remember_me`: Remember me preference

### Production Integration
To integrate with a real authentication backend:

1. **Update `landing.js`** - Replace the `performLogin()` function:
```javascript
async function performLogin(username, password) {
    try {
        const response = await fetch('/api/auth/login', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json'
            },
            body: JSON.stringify({ username, password })
        });

        if (!response.ok) {
            throw new Error('Login failed');
        }

        const data = await response.json();

        // Store auth token
        localStorage.setItem('sfaf_auth_token', data.token);
        localStorage.setItem('sfaf_logged_in', 'true');
        localStorage.setItem('sfaf_username', username);

        return true;
    } catch (error) {
        showNotification('Login failed: ' + error.message, 'error');
        return false;
    }
}
```

2. **Add Backend Routes** in `main.go`:
```go
// Authentication routes
api.POST("/auth/login", authHandler.Login)
api.POST("/auth/logout", authHandler.Logout)
api.GET("/auth/verify", authHandler.VerifyToken)
```

3. **Add Middleware** to protect routes:
```go
// Protected routes
protected := r.Group("/")
protected.Use(middleware.AuthRequired())
{
    protected.GET("/map-viewer", mapViewerHandler)
    protected.GET("/database", databaseHandler)
    // ...
}
```

## Customization

### Color Scheme
Update CSS variables in `landing.css`:
```css
:root {
    --primary-gradient: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
    --accent-purple: #a78bfa;
    --accent-blue: #667eea;
    /* ... */
}
```

### Module Cards
Add or modify modules in `landing.html`:
```html
<div class="module-card" data-module="new-module">
    <div class="module-icon">
        <i class="fas fa-icon-name"></i>
    </div>
    <h3 class="module-title">Module Name</h3>
    <p class="module-description">Description...</p>
    <ul class="module-features">
        <li><i class="fas fa-check"></i> Feature 1</li>
        <!-- ... -->
    </ul>
    <button class="module-btn" onclick="navigateToModule('/route')">
        <i class="fas fa-arrow-right"></i> Launch Module
    </button>
</div>
```

## Responsive Design

### Breakpoints
- **Desktop**: > 1024px (2-column hero, multi-column grids)
- **Tablet**: 768px - 1024px (single column hero, 2-column grids)
- **Mobile**: < 768px (single column layout)
- **Small Mobile**: < 480px (compact navigation)

## Browser Support
- Chrome/Edge (latest)
- Firefox (latest)
- Safari (latest)
- Mobile browsers (iOS Safari, Chrome Mobile)

## Performance
- CSS animations use GPU-accelerated transforms
- Minimal JavaScript for fast load times
- Lazy loading for images (if added)
- LocalStorage for instant login status check

## Accessibility
- Semantic HTML structure
- ARIA labels for interactive elements
- Keyboard navigation support
- Focus indicators for all interactive elements
- High contrast text for readability

## Future Enhancements

### Potential Additions
1. **User Registration**: Add sign-up functionality
2. **Password Recovery**: Forgot password flow
3. **2FA Support**: Two-factor authentication
4. **User Profiles**: Profile management page
5. **Activity Dashboard**: Recent activity feed
6. **Module Analytics**: Usage statistics
7. **Dark/Light Theme Toggle**: Theme switcher
8. **Module Search**: Quick module finder
9. **Keyboard Shortcuts**: Power user features
10. **Onboarding Tour**: First-time user guide

## Development Notes

- The landing page is fully independent of other modules
- No dependencies on map libraries (Leaflet) for fast loading
- Uses Font Awesome 6.4.0 for icons
- Pure JavaScript (no jQuery or frameworks)
- CSS Grid and Flexbox for layouts
- LocalStorage for client-side state management

## Testing Checklist

- [ ] Login modal opens/closes correctly
- [ ] Form validation works
- [ ] Login success notification appears
- [ ] Username displays after login
- [ ] Logout functionality works
- [ ] Module navigation requires login
- [ ] All module links navigate correctly
- [ ] Responsive design works on mobile
- [ ] Animations perform smoothly
- [ ] Accessibility features work (keyboard nav, screen readers)
- [ ] Remember Me persists across page reloads
