# Authorization Radius (Field 306) - User Guide

## 📐 Overview

The Authorization Radius feature displays circular coverage areas for selected SFAF records that include Field 306 (Authorization Radius). These circles visualize the authorized operating area for each station on the map.

**Important**: Circles are **OFF by default**. You must select which records to display.

## 🎯 How It Works

### Field 306 Format

Field 306 specifies the authorization radius using the format: `###` or `###U`

- **###**: Numeric radius value in **kilometers** (1-999)
- **U** (optional): Authorization type indicator
  - `B` = Basic/Both (transmitter AND receiver authorized) - **Purple circle**
  - `T` = Tactical/Transmit (transmitter only authorized) - **Blue circle**
  - *No suffix* = Defaults to Both (B) - **Purple circle**

**Examples**:
```
306.     50      → 50 km radius, Both TX & RX (purple)
306.     50B     → 50 km radius, Both TX & RX (purple)
306.     25T     → 25 km radius, Transmit only (blue)
306.     100     → 100 km radius, Both TX & RX (purple)
```

**Display**: All radii are shown in **both kilometers and nautical miles**
- Example: 50 km = 27.0 NM

## 🗺️ Map Visualization

### Selective Display

**Circles are OFF by default.** To display circles:

1. **Multi-Select Approach** (recommended):
   - Use JavaScript console or custom UI:
   ```javascript
   // Show circles for specific marker IDs
   AuthorizationRadiusManager.showCirclesForMarkers(['marker-id-1', 'marker-id-2']);

   // Show only selected circles (hide all others)
   AuthorizationRadiusManager.showOnlySelectedCircles(['marker-id-1', 'marker-id-2']);
   ```

2. **Global Toggle**:
   - Click "Show All Radii" button in sidebar to display all available circles
   - Click "Hide All Radii" to remove all circles from map

3. **Individual Toggle**:
   - Click any visible circle's popup and use "Hide This Radius" button

### Visual Appearance

- **Colors**:
  - **Purple (#9933ff)**: Both TX & RX authorization (B or no suffix)
  - **Blue (#0066ff)**: Transmit only authorization (T)
- **Fill Opacity**: 10% (semi-transparent)
- **Border**: 2px solid line with 60% opacity
- **Hover Effect**: Fill opacity increases to 20%, border becomes thicker

## 🎛️ Controls

### Global Controls (Sidebar)

The sidebar contains a control panel with the following buttons:

#### 1. Show/Hide All Radii Toggle
- **Purpose**: Turn all authorization radius circles on or off with one click
- **States**:
  - 🟢 **"Hide All Radii"** (green) - Circles are currently visible
  - ⚪ **"Show All Radii"** (red when hidden) - Circles are currently hidden
- **Usage**: Click to toggle between showing and hiding all circles

#### 2. Zoom to Radii Button
- **Purpose**: Automatically zoom and pan the map to fit all authorization radii in view
- **Usage**: Click to see all authorization circles at once
- **Note**: Only works when circles are visible and at least one exists

#### 3. Circle Count Display
- Shows how many circles are currently visible
- Format: "X of Y radii visible"
- Updates automatically when toggling visibility

### Per-Circle Controls

#### Circle Click
- Click any authorization radius circle to open a popup with details:
  - Serial Number
  - Radius value (in kilometers)
  - Original Field 306 value

#### Hide Individual Circle
- Each circle popup contains a **"Hide This Radius"** button
- Click to hide just that specific circle
- Circle remains hidden until you use the global "Show All Radii" button

#### Circle Tooltip
- Hover over any circle to see a tooltip
- Displays: Serial Number and Radius (e.g., "AF 014589 - 50.0 km")

## 📊 Usage Examples

### Example 1: View All Authorization Radii

1. Open the map viewer
2. Authorization radius circles load automatically
3. Check the sidebar control panel to see how many radii are displayed
4. Click "Zoom to Radii" to see all circles at once

### Example 2: Toggle Visibility

1. Click **"Hide All Radii"** in the sidebar to clear the map
2. The button changes to **"Show All Radii"**
3. Click again to restore all circles

### Example 3: Inspect Individual Circle

1. Click on any blue authorization radius circle
2. Popup shows:
   - Serial Number: "AF 014589"
   - Radius: "50.0 km"
   - Field 306: "50B"
3. Click **"Hide This Radius"** to remove just this one circle

### Example 4: Import SFAF with Field 306

Sample SFAF file:
```
005.     UE
102.     AF  014589
110.     123.456 MHZ
303.     450000N0050000E
306.     50B
```

After importing:
1. Marker appears at 45°N, 5°E
2. Authorization radius circle automatically created
3. Circle shows 50 km radius around the marker
4. Click circle to verify details

## 🔧 Technical Details

### Unit Display

Field 306 values are always in kilometers. The system displays both units for convenience:
- **1 Kilometer = 0.539957 Nautical Miles**
- Example: `50` (50 km) is displayed as "50.0 km (27.0 NM)"
- Example: `25T` (25 km, TX only) is displayed as "25.0 km (13.5 NM)"

### Supported Formats

✅ **Valid Field 306 Values**:
- `50` - 50 km, Both TX & RX (default)
- `50B` - 50 km, Both TX & RX (explicit)
- `25T` - 25 km, Transmit only
- `100` - 100 km, Both TX & RX (default)
- `1` - 1 km, Both TX & RX (default)
- `999B` - 999 km, Both TX & RX

❌ **Invalid Field 306 Values**:
- `B50` - Unit before number
- `50K` - Invalid unit (must be B or T)
- `-50B` - Negative values not allowed
- `0B` - Zero radius not allowed
- `50NM` - Invalid unit indicator

### Layer Management

- Authorization radius circles are stored in a separate Leaflet layer group
- They persist across map pan/zoom operations
- Circles are independent of markers (deleting a marker doesn't auto-delete its circle)
- Global toggle affects the entire layer group for performance

## 💡 Tips

1. **Performance**: Use the global toggle to temporarily hide all circles when working with many markers
2. **Comparison**: Keep Field 306 circles and Field 530 polygons both visible to compare authorized areas
3. **Overlapping Circles**: Use the "Hide This Radius" button to hide specific circles that overlap
4. **Zoom Levels**: Authorization circles remain visible at all zoom levels
5. **Mobile**: All controls are responsive and work on mobile devices

## 🐛 Troubleshooting

### Circles Not Appearing

**Check**:
1. Does the SFAF record have Field 306 data?
2. Is the Field 306 format valid (e.g., `50B` or `25T`)?
3. Are circles globally hidden? (Check toggle button state)
4. Does the marker have valid Field 303 coordinates?

### Circle Count Shows 0

**Reasons**:
- No SFAF records have Field 306 data
- All circles have been individually hidden
- Field 306 values are invalid/unparseable

**Solution**:
- Import SFAF files with valid Field 306 data
- Click "Show All Radii" to restore individually hidden circles

### Circle Appears at Wrong Location

**Issue**: The authorization radius is centered at Field 303 (station coordinates)
**Solution**: Verify Field 303 has correct latitude/longitude values

## 📖 MCEB Pub 7 Compliance

This feature implements MCEB Pub 7 Field 306 (Authorization Radius) specifications:
- Supports both kilometer (B) and nautical mile (T) units
- Centers circles at station coordinates (Field 303)
- Provides visual representation of authorized operating area
- Maintains data integrity with original SFAF values

## 🔗 Related Features

- **Field 530 Polygons**: Authorized area polygons (more precise than circles)
- **Field 303 Coordinates**: Station location (circle center point)
- **Marker Clustering**: Groups nearby markers for better performance
- **Database Viewer**: Query SFAF records by Field 306 values

## 📝 Notes

- Authorization radius circles are **informational overlays** - they don't restrict map interactions
- Circle visibility state is **not saved** between sessions (all visible by default on load)
- Multiple SFAF records at the same location will show **overlapping circles**
- The feature works **offline** once data is loaded (uses browser cache)
