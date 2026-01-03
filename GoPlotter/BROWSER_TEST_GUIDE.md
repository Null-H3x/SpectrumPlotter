# Browser Testing Guide - Module Refactoring

## Quick Start

**Server is already running on port 8080**

1. Open your browser to: **http://localhost:8080**
2. Open Developer Tools (F12)
3. Go to the **Console** tab
4. Follow the tests below

---

## ✅ Test 1: Module Loading (30 seconds)

### What to Check:
1. Page loads without errors
2. No "undefined" errors for APIClient or TooltipManager
3. Map displays correctly

### How to Test:
```javascript
// In browser console, type:
console.log(window.APIClient);
// Expected: Object with methods (fetchMarkers, createMarker, etc.)

console.log(window.TooltipManager);
// Expected: Object with methods (updateMarkerTooltip, updateCircleTooltip, etc.)
```

### ✅ PASS Criteria:
- [ ] No red errors in console
- [ ] Both APIClient and TooltipManager show as objects
- [ ] Map renders with controls

---

## ✅ Test 2: API Client - Load Markers (1 minute)

### What to Check:
- Existing markers load via APIClient.fetchMarkers()
- Network tab shows GET request to /api/markers

### How to Test:
1. Open **Network** tab in DevTools
2. Refresh the page (F5)
3. Look for request to `/api/markers`
4. Check console for logs

### ✅ PASS Criteria:
- [ ] Network tab shows: `GET /api/markers` with status 200
- [ ] Markers appear on map
- [ ] No console errors related to APIClient

---

## ✅ Test 3: Tooltip Manager - Marker Tooltips (2 minutes)

### What to Check:
- Markers show tooltips with DMS coordinates
- Coordinate caching works

### How to Test:
1. Look at any marker on the map
2. Tooltip should show:
   - Serial number
   - DecDeg (decimal coordinates)
   - DMS (degrees/minutes/seconds)
   - Frequency
   - Notes

3. Check console for this log:
   ```
   ✅ Tooltip updated with DMS coordinates: 30°25'48.0"N, 86°41'42.0"W
   ```

### ✅ PASS Criteria:
- [ ] Tooltips appear automatically
- [ ] DMS coordinates display correctly
- [ ] Console shows "Tooltip updated with DMS coordinates" message

---

## ✅ Test 4: API Client - Update Marker (2 minutes)

### What to Check:
- Dragging marker uses APIClient.updateMarker()
- Position saves to backend

### How to Test:
1. Click and **drag** any green marker to a new location
2. Release the mouse
3. Wait 0.5 seconds (debounce delay)
4. Check console for:
   ```
   ✅ Marker position saved to server
   ```
5. Check Network tab for:
   ```
   PUT /api/markers/{id}
   ```

### ✅ PASS Criteria:
- [ ] Can drag marker
- [ ] Tooltip updates immediately while dragging
- [ ] Console shows "Marker position saved to server"
- [ ] Network tab shows PUT request

---

## ✅ Test 5: Tooltip Manager - Circle Tooltips (3 minutes)

### What to Check:
- Circle tooltips show geometry data
- Marker tooltip hides when circle is linked

### How to Test:
1. Click the **circle tool** (drawing controls)
2. Draw a circle on the map
3. Enter radius (e.g., "5") and select unit (km or NM)
4. Click "Create Circle"
5. Observe the tooltip on the circle

### ✅ PASS Criteria:
- [ ] Circle tooltip appears
- [ ] Shows: Serial, Center (Dec), Center (DMS), Radius, Area
- [ ] Shows Field 306 value (e.g., "Field 306: 5B")
- [ ] **Marker tooltip is HIDDEN** (only circle tooltip shows)

---

## ✅ Test 6: Integration - Multiple Operations (5 minutes)

### Test Sequence:
1. **Create a new marker**
   - Click anywhere on map
   - Verify tooltip with DMS coordinates

2. **Drag the marker**
   - Drag to new position
   - Verify tooltip updates
   - Verify console shows "position saved"

3. **Create circle around marker**
   - Draw circle
   - Set radius
   - Verify marker tooltip disappears
   - Verify circle tooltip appears

4. **Click marker/circle**
   - Click to open SFAF sidebar
   - Verify sidebar opens
   - Verify no errors

### ✅ PASS Criteria:
- [ ] All operations work smoothly
- [ ] No JavaScript errors
- [ ] Tooltips behave correctly
- [ ] API calls succeed

---

## 🐛 Common Issues & Solutions

### Issue: "APIClient is not defined"
**Solution**: Modules didn't load. Check:
1. View Page Source
2. Verify these script tags exist:
   ```html
   <script src="/js/modules/api-client.js"></script>
   <script src="/js/modules/tooltip-manager.js"></script>
   ```
3. Check Network tab - did they load with status 200?

### Issue: Tooltips don't show DMS coordinates
**Solution**:
1. Check console for coordinate conversion errors
2. Verify `/api/convert-coords` endpoint works
3. Test manually:
   ```javascript
   APIClient.convertCoordinates(30.43, -86.695)
     .then(r => console.log(r));
   ```

### Issue: "Cannot read property of undefined"
**Solution**: Check module loading order
1. APIClient must load before map.js
2. TooltipManager must load before map.js
3. Refresh page with Ctrl+F5 (hard refresh)

---

## 📊 Test Results Template

**Date**: December 23, 2025
**Tester**: _______________
**Browser**: Chrome / Firefox / Edge

| Test | Status | Notes |
|------|--------|-------|
| 1. Module Loading | ☐ Pass ☐ Fail | |
| 2. Load Markers | ☐ Pass ☐ Fail | |
| 3. Marker Tooltips | ☐ Pass ☐ Fail | |
| 4. Update Marker | ☐ Pass ☐ Fail | |
| 5. Circle Tooltips | ☐ Pass ☐ Fail | |
| 6. Integration | ☐ Pass ☐ Fail | |

**Overall**: ☐ ALL TESTS PASSED ☐ ISSUES FOUND

**Issues Found**:
_____________________________________________
_____________________________________________
_____________________________________________

**Next Steps**:
☐ If all pass → Continue creating more modules
☐ If issues → Debug and fix

---

## 🎯 Success Criteria

The module refactoring is successful if:
- ✅ All 6 tests pass
- ✅ No console errors
- ✅ Same functionality as before refactoring
- ✅ Cleaner code structure (500 lines removed from map.js!)

---

## Need Help?

If you encounter issues:
1. Check console for specific error messages
2. Verify module files exist in `/js/modules/`
3. Check [TESTING_MODULES.md](TESTING_MODULES.md) for debugging steps
4. Review [MODULE_STRUCTURE.md](web/static/js/MODULE_STRUCTURE.md) for architecture

**Ready to test!** 🚀

Open http://localhost:8080 and start with Test 1!
