# Frequency Nomination & Deconfliction Tool

Converted from Excel VBA to web-based JavaScript/Go application.

## Overview

The Frequency Nomination Tool performs automated frequency deconfliction analysis to identify available frequencies that avoid interference with existing SFAF records. This tool was originally implemented in Excel VBA (`Frequency Nomination.xlsm`) and has been converted to a modern web application.

## Features

### ✅ Converted from VBA

- **Bandwidth Calculation** - Extracts bandwidth from Emission Designators
- **Frequency Deconfliction** - Scans frequency ranges for availability
- **Conflict Detection** - Identifies overlapping frequency assignments
- **Guard Band Support** - Adds safety margins around frequencies
- **Nomination List Generation** - Creates lists of available frequencies

### 🚀 New Web Features

- **Real-time Analysis** - Instant results without Excel
- **Modern UI** - Clean, responsive interface
- **Database Integration** - Works with existing SFAF records
- **CSV Export** - Export nomination lists (planned)
- **API Ready** - Built for future backend integration

## File Structure

```
web/
├── templates/
│   └── frequency_nomination.html     # Main page
├── static/
│   ├── css/
│   │   └── frequency_nomination.css  # Styling
│   └── js/
│       └── frequency_nomination.js   # Core logic
```

## VBA to JavaScript Conversion

### Original VBA Functions → JavaScript Methods

| VBA Function | JavaScript Method | Status | Notes |
|--------------|------------------|--------|-------|
| `getBandwidthEMS()` | `getBandwidthEMS()` | ✅ Complete | Emission designator parser |
| `Calculate_Bandwidths_for_Frequency_Deconfliction()` | `calculateBandwidthsForDeconfliction()` | ✅ Complete | Bandwidth analysis |
| `Create_Frequency_Set()` | `createFrequencySet()` | ✅ Complete | Frequency set creation |
| `Frequency_Deconfliction()` | `checkFrequencyConflict()` | ✅ Complete | Conflict detection |
| `Compile_Nomination_List()` | `generateNominationList()` | ✅ Complete | List generation |
| `Compile_And_table()` | `compileAndConstraints()` | ⚠️ Partial | AND constraints |
| `Compile_Or_Table()` | `compileOrConstraints()` | ⚠️ Partial | OR constraints |
| `Input_Validation()` | `validateInput()` | ✅ Complete | Input validation |
| `testBandwidths()` | `testBandwidths()` | ✅ Complete | Test function |

## How It Works

### 1. Bandwidth Calculation

The `getBandwidthEMS()` function parses emission designators according to ITU standards:

**Format**: `[bandwidth][unit][modulation]`

Examples:
- `6K00A3E` → 6 kHz
- `130MA3E` → 130 MHz
- `10H00P23E` → 10 Hz

**Algorithm**:
1. Find bandwidth unit (`H`, `K`, `M`, or `G`)
2. Extract numeric portion
3. Insert decimal point if needed
4. Convert to requested unit (Hz, kHz, MHz, GHz)

### 2. Frequency Deconfliction

**Process**:
1. Define frequency range (start → end)
2. Set step size (e.g., 25 kHz)
3. For each step:
   - Calculate proposed bandwidth range
   - Check for conflicts with existing records
   - Apply guard band
   - Add to nomination list if clear

**Conflict Detection**:
```javascript
proposedLower = frequency - (bandwidth / 2) - guardBand
proposedUpper = frequency + (bandwidth / 2) + guardBand

hasConflict = !(proposedUpper < existingLower || proposedLower > existingUpper)
```

### 3. Constraint Management

**AND Constraints**: All must be satisfied
**OR Constraints**: At least one must be satisfied

Currently implemented as placeholders for future development.

## Usage

### Accessing the Tool

Navigate to: **http://localhost:8080/frequency-nomination**

### Basic Workflow

1. **Enter Parameters**:
   - Start Frequency (MHz)
   - End Frequency (MHz)
   - Bandwidth (MHz)
   - Step Size (kHz)
   - Guard Band (MHz)

2. **Click "Generate Frequency List"**

3. **Review Results**:
   - Available frequencies shown in table
   - Statistics displayed (Available/Conflicts/Scanned)
   - Click "Select" to use a frequency

4. **Export Results** (coming soon):
   - CSV export for documentation
   - Integration with SFAF creation

### Example Usage

**Scenario**: Find VHF frequencies for voice communication

```
Start Frequency: 225.0 MHz
End Frequency:   400.0 MHz
Bandwidth:       0.025 MHz (25 kHz)
Step Size:       25 kHz
Guard Band:      0.05 MHz (50 kHz)
Max Results:     100
```

**Result**: List of 100 available frequencies with 50 kHz guard bands

## API Reference

### FrequencyNomination Class

```javascript
class FrequencyNomination {
    // Bandwidth calculation
    getBandwidthEMS(inputEMS, unit)

    // Frequency analysis
    calculateBandwidthsForDeconfliction(records)
    checkFrequencyConflict(proposedFreqMHz, proposedBandwidthMHz, existingRecords, guardBandMHz)
    generateNominationList(params)

    // Constraint management
    compileAndConstraints(constraints)
    compileOrConstraints(constraints)
    checkAndConstraints(frequency, bandwidth)
    checkOrConstraints(frequency, bandwidth)

    // Utilities
    parseFrequency(freqString)
    formatFrequency(freqMHz)
    validateInput(params)
}
```

### Method: getBandwidthEMS()

**Purpose**: Extract bandwidth from emission designator

**Parameters**:
- `inputEMS` (string) - Emission designator (e.g., "6K00A3E")
- `unit` (string) - Output unit: "H", "K", "M", "G"

**Returns**: `number` - Bandwidth in specified unit

**Example**:
```javascript
const bw = frequencyNomination.getBandwidthEMS("6K00A3E", "M");
// Returns: 0.006 (6 kHz in MHz)
```

### Method: generateNominationList()

**Purpose**: Generate list of available frequencies

**Parameters**:
```javascript
{
    startFreqMHz: number,
    endFreqMHz: number,
    stepKHz: number,
    bandwidthMHz: number,
    existingRecords: Array,
    guardBandMHz: number,
    maxResults: number
}
```

**Returns**: `Array` of nomination objects:
```javascript
[
    {
        frequencyMHz: 225.0,
        frequencyFormatted: "M225.000",
        bandwidthMHz: 0.025,
        status: "Available",
        conflicts: []
    },
    ...
]
```

## Testing

### Bandwidth Calculator Test

Click **"Test Bandwidth Calculator"** to verify emission designator parsing:

| Emission Designator | Expected (MHz) |
|---------------------|----------------|
| 6K00A3E | 0.006 |
| 130MA3E | 130.0 |
| 10H00P23E | 0.00001 |
| 3K4A | 0.0034 |
| 23M4W345 | 23.4 |

### Manual Testing

1. Open browser console (F12)
2. Run tests:
```javascript
frequencyNomination.testBandwidths();
```

## Database Integration

### Current Implementation

Currently uses **localStorage** for constraints and runs analysis client-side.

### Future Backend Integration

**Fetch existing records from database**:
```javascript
async function fetchExistingRecords() {
    const response = await fetch('/api/sfaf/records');
    const records = await response.json();

    // Calculate bandwidths
    const analyzed = frequencyNomination.calculateBandwidthsForDeconfliction(records);

    return analyzed;
}
```

**Create SFAF record from nomination**:
```javascript
async function createSFAFFromNomination(frequency, bandwidth) {
    const response = await fetch('/api/sfaf/create', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
            field110: frequency,  // Frequency
            field113: bandwidth,  // Bandwidth
            // ... other fields
        })
    });
}
```

## Differences from Excel VBA

### Improvements

✅ **No Excel Required** - Runs in any web browser
✅ **Real-time Processing** - Instant results
✅ **Modern UI** - Better user experience
✅ **Database Integration** - Works with existing records
✅ **Collaborative** - Multiple users can access
✅ **Version Control** - Code tracked in Git
✅ **Cross-platform** - Windows, Mac, Linux

### Not Yet Implemented

⚠️ **Channel Plan Constraints** - Requires additional development
⚠️ **Sub-assignment from Lists** - Planned for future
⚠️ **Complex AND/OR Constraints** - Partially implemented
⚠️ **Sort Order Management** - Not converted (was UI-only)

## Future Enhancements

### Planned Features

- [ ] **Database Integration** - Fetch existing SFAF records
- [ ] **Create SFAF Button** - Directly create record from nomination
- [ ] **CSV Export** - Export nomination lists
- [ ] **PDF Reports** - Generate analysis reports
- [ ] **Channel Plan Support** - Implement frequency pairing/sets
- [ ] **Advanced Constraints** - Full AND/OR constraint logic
- [ ] **Visualization** - Frequency spectrum graphs
- [ ] **Batch Analysis** - Analyze multiple bandwidths at once
- [ ] **Save Templates** - Save common search parameters
- [ ] **History** - Track previous analyses

### API Endpoints (Future)

```
POST   /api/frequency/analyze          # Run deconfliction analysis
POST   /api/frequency/create-sfaf      # Create SFAF from nomination
GET    /api/frequency/constraints      # Get constraints
POST   /api/frequency/constraints      # Save constraints
GET    /api/frequency/channel-plans    # Get available channel plans
POST   /api/frequency/export           # Export results
```

## Troubleshooting

### No Results Found

**Problem**: Analysis returns 0 available frequencies

**Solutions**:
- Reduce guard band
- Increase frequency range
- Use smaller bandwidth
- Check for conflicting existing records

### Incorrect Bandwidth Calculation

**Problem**: Bandwidth doesn't match expected value

**Solutions**:
- Verify emission designator format
- Check for typos in designator
- Ensure unit is in first 4 characters
- Test with known good designator

### Browser Performance

**Problem**: Analysis is slow with large ranges

**Solutions**:
- Reduce max results
- Use larger step size
- Narrow frequency range
- Consider backend processing for large analyses

## Technical Notes

### Emission Designator Format

According to ITU Radio Regulations:

**Bandwidth Characters**:
- 3-4 characters (e.g., "6K00", "130M")
- Format: `[digits][unit][digits]` or `[digits][unit]`
- Unit: H (Hz), K (kHz), M (MHz), G (GHz)

**Modulation Type**:
- First character after bandwidth
- Examples: A (Amplitude), F (Frequency), P (Phase)

**Information Type**:
- Second character after bandwidth
- Examples: 3 (Analog), W (Digital)

**Additional Details**:
- Third character after bandwidth
- Examples: E (Telephony), W (Data)

### Performance Considerations

**Client-side Processing**:
- Fast for ranges up to 10,000 steps
- Suitable for most use cases
- No server load

**Backend Processing** (future):
- Better for very large ranges
- Can process overnight
- Stores results in database

## Support

For issues or questions:
1. Check browser console for errors
2. Verify parameters are valid
3. Test bandwidth calculator independently
4. Review this documentation

## References

- Original Excel VBA: `Frequency Nomination.xlsm`
- ITU Radio Regulations: [ITU-R](https://www.itu.int)
- MCEB Pub 7: SFAF Field Definitions
