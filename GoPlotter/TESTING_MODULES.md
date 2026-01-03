# Module Refactoring - Testing Checklist

## Phase 1: Initial Module Integration Test

### Modules Implemented
- ✅ **api-client.js** - Centralized API communication
- ✅ **tooltip-manager.js** - Tooltip rendering and coordinate caching

### Changes Made

1. **map_viewer.html**
   - Added script tags for new modules (loaded before map.js)
   - Order: api-client.js → tooltip-manager.js → map.js

2. **map.js**
   - Updated `loadExistingMarkers()` to use `APIClient.fetchMarkers()`
   - Updated marker drag handler to use `APIClient.updateMarker()`
   - Updated all `updateMarkerTooltip()` calls to use `TooltipManager.updateMarkerTooltip()`
   - Updated all `updateCircleTooltip()` calls to use `TooltipManager.updateCircleTooltip()`
   - Commented out old function definitions (moved to modules)

### Test Checklist

#### 1. Page Load Test
- [ ] Application loads without JavaScript errors
- [ ] Console shows no "undefined" errors for APIClient or TooltipManager
- [ ] Map renders correctly
- [ ] Leaflet controls appear

#### 2. API Client Tests
- [ ] **Load Markers**: Existing markers load on page load
- [ ] **Create Marker**: Can create new manual marker
- [ ] **Update Marker**: Can drag marker and see "Marker position saved" log
- [ ] **Coordinate Conversion**: DMS coordinates appear in tooltips

#### 3. Tooltip Manager Tests
- [ ] **Marker Tooltip**: Manual markers show tooltip with DMS coordinates
- [ ] **Circle Tooltip**: Circles show tooltip with radius/area info
- [ ] **Linked Circle/Marker**: When circle exists, marker tooltip is hidden
- [ ] **Coordinate Cache**: Second marker at same location uses cached DMS (no API call)
- [ ] **Tooltip Updates**: Dragging marker updates tooltip immediately

#### 4. Integration Tests
- [ ] **Create Circle**: Can create authorization circle
- [ ] **Circle Updates**: Editing circle updates tooltip
- [ ] **SFAF Integration**: Click marker opens sidebar (SFAF functions still work)
- [ ] **Field 306**: Authorization radius syncs with circle

#### 5. Error Handling
- [ ] **Network Error**: Graceful fallback when coordinate conversion fails
- [ ] **Missing Data**: Tooltips show "(N/A)" for missing fields
- [ ] **Console Logs**: No unexpected errors in console

### How to Test

1. **Start the Server**
   ```bash
   cd "z:\DriveBackup\Nerdery\SFAF Plotter\GoPlotter"
   go run .
   ```

2. **Open Browser**
   - Navigate to `http://localhost:8080`
   - Open Developer Tools (F12)
   - Check Console tab for errors

3. **Test Sequence**
   a. Page loads → Check for errors
   b. Create new marker → Verify tooltip appears with DMS
   c. Drag marker → Verify tooltip updates and position saves
   d. Create circle → Verify circle tooltip appears, marker tooltip hides
   e. Check console for API calls through APIClient

### Expected Console Output

```javascript
✅ Loaded configuration from .env file
📝 Loading application configuration...
✅ Tooltip updated with DMS coordinates: 30°25'48.0"N, 86°41'42.0"W
✅ Marker position saved to server
```

### Debugging

If errors occur:

1. **Check module loading order**
   - View Page Source → Verify script tags are in correct order
   - APIClient and TooltipManager must load before map.js

2. **Check global exports**
   - In Console, type: `window.APIClient`
   - Should show object with methods
   - Type: `window.TooltipManager`
   - Should show object with methods

3. **Check function calls**
   - Set breakpoints in modules/api-client.js
   - Verify functions are being called
   - Check network tab for API requests

### Known Issues

None expected - this is a straightforward refactoring that maintains exact same functionality.

### Rollback Plan

If critical issues occur:

1. Comment out module script tags in map_viewer.html:
   ```html
   <!-- <script src="/js/modules/api-client.js"></script> -->
   <!-- <script src="/js/modules/tooltip-manager.js"></script> -->
   ```

2. Revert map.js changes:
   - Replace `APIClient.` calls with direct `fetch()`
   - Replace `TooltipManager.` calls with direct function calls
   - Uncomment the old function definitions

### Success Criteria

✅ All checklist items pass
✅ No console errors
✅ Same functionality as before refactoring
✅ Cleaner, more maintainable code structure

### Next Steps After Successful Test

If all tests pass:
1. Create remaining modules (ui-helpers, marker-manager, circle-manager, sfaf-integration)
2. Continue refactoring map.js
3. Add unit tests for modules
4. Update documentation

---

## Test Results

**Date**: ___________
**Tester**: ___________
**Result**: [ ] PASS  [ ] FAIL
**Notes**:
___________________________________________
___________________________________________
___________________________________________
