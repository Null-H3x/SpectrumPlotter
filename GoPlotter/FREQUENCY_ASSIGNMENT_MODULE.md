# Frequency Assignment Module

## Overview
This module provides a complete system for managing military unit frequency assignments and handling frequency assignment requests.

## Features

### 1. Unit Management
- **Units**: Military units/organizations (brigades, battalions, companies, etc.)
- **Hierarchical Structure**: Units can have parent units
- **User-Unit Assignments**: Users can belong to multiple units with different roles
  - Roles: commander, s6 (signal officer), member, viewer

### 2. Frequency Assignments
- **Assignment Types**: primary, alternate, emergency, tactical
- **Comprehensive Details**:
  - Frequency, net name, callsign
  - Emission designator, bandwidth, power
  - Authorization radius, dates, authority
  - Priority levels, encryption, classification
- **Lifecycle Management**: Track assignment/expiration dates
- **Multi-unit Support**: View all frequencies for your assigned units

### 3. Frequency Requests
- **Request Types**: new_assignment, modification, renewal, cancellation
- **Workflow States**: pending → under_review → approved/denied
- **Priority Levels**: emergency, urgent, priority, routine
- **Technical Requirements**: Specify frequency range, power, coverage, etc.
- **Justification**: Require detailed justification and mission impact
- **Approval Workflow**: Review and approval tracking

### 4. Conflict Detection
- Track potential interference between assignments
- Types: geographic_overlap, frequency_adjacent, co_channel
- Severity ratings and mitigation tracking

### 5. Usage Logging
- Track when frequencies are actively used
- Location and duration tracking

## Database Schema

### Tables Created (Migration 009)
1. **units** - Military units/organizations
2. **user_units** - User-to-unit assignments
3. **frequency_assignments** - Assigned frequencies
4. **frequency_requests** - Frequency assignment requests
5. **frequency_conflicts** - Interference tracking
6. **frequency_usage_logs** - Usage tracking

## API Endpoints (To Be Implemented)

### Units
- `GET /api/frequency/units` - List user's units
- `GET /api/frequency/units/:id` - Get unit details with assignments
- `POST /api/frequency/units` - Create unit (admin only)
- `PUT /api/frequency/units/:id` - Update unit
- `DELETE /api/frequency/units/:id` - Delete unit (admin only)

### Frequency Assignments
- `GET /api/frequency/assignments` - List assignments for user's units
- `GET /api/frequency/assignments/:id` - Get assignment details
- `POST /api/frequency/assignments` - Create assignment (s6/admin)
- `PUT /api/frequency/assignments/:id` - Update assignment (s6/admin)
- `DELETE /api/frequency/assignments/:id` - Deactivate assignment (s6/admin)

### Frequency Requests
- `GET /api/frequency/requests` - List requests for user's units
- `GET /api/frequency/requests/:id` - Get request details
- `POST /api/frequency/requests` - Submit new request
- `PUT /api/frequency/requests/:id/review` - Review request (s6/admin)
- `PUT /api/frequency/requests/:id/approve` - Approve request (admin)
- `PUT /api/frequency/requests/:id/deny` - Deny request (admin)
- `DELETE /api/frequency/requests/:id` - Cancel request (requester only)

### Frequency Search
- `POST /api/frequency/search` - Search for available frequencies
- `GET /api/frequency/conflicts/:assignmentId` - Check for conflicts

### Usage Logs
- `POST /api/frequency/usage/start` - Log frequency usage start
- `PUT /api/frequency/usage/:id/end` - Log frequency usage end
- `GET /api/frequency/usage/history/:assignmentId` - View usage history

## Frontend Components (To Be Implemented)

### 1. Unit Frequencies View (`unit-frequencies.html` / `unit-frequencies.js`)
**Purpose**: View all frequencies assigned to user's units

**Features**:
- Table view of all assigned frequencies
- Filter by unit, assignment type, status
- Sort by frequency, expiration date, priority
- Visual indicators for:
  - Expiring frequencies (< 30 days)
  - Encrypted frequencies
  - Classification levels
- Export to CSV/PDF

**Layout**:
```
┌─────────────────────────────────────────────────────────────┐
│ Unit Frequencies                                     [Export]│
├─────────────────────────────────────────────────────────────┤
│ Filter: [Unit ▼] [Type ▼] [Status ▼]           [Search...]  │
├─────────────────────────────────────────────────────────────┤
│ Frequency │ Net Name    │ Callsign │ Type    │ Expires      │
│ 123.450   │ Command Net │ DRAGON 6 │ Primary │ 2026-01-15   │
│ 123.475   │ Alt Command │ DRAGON ALT│ Alternate│ 2026-01-15  │
│ 149.350   │ Admin/Log   │ DEVIL 3  │ Primary │ 2026-03-01   │
└─────────────────────────────────────────────────────────────┘
```

### 2. Frequency Request Form (`request-frequency.html` / `request-frequency.js`)
**Purpose**: Submit new frequency assignment requests

**Features**:
- Multi-step form wizard
- Dynamic fields based on request type
- Validation for required fields
- Real-time conflict checking
- Save draft functionality
- Submit for approval

**Form Steps**:
1. **Request Type & Priority**
   - Select: new_assignment, modification, renewal, cancellation
   - Priority: emergency, urgent, priority, routine

2. **Frequency Requirements**
   - Specific frequency or range
   - Assignment type (primary/alternate/etc.)
   - Purpose, net name, callsign

3. **Technical Specifications**
   - Emission designator, bandwidth
   - Power, coverage area, radius
   - Hours of operation

4. **Security & Coordination**
   - Encryption requirements
   - Classification level
   - Coordination needs

5. **Justification**
   - Detailed justification
   - Mission impact if denied
   - Start/end dates

6. **Review & Submit**

### 3. Request Management Dashboard (`request-dashboard.html` / `request-dashboard.js`)
**Purpose**: View and manage frequency requests

**Features**:
- **My Requests Tab**: Requests submitted by user
- **Unit Requests Tab**: All requests for user's units
- **Pending Reviews Tab**: Requests awaiting review (s6/admin)
- Status indicators and workflow tracking
- Quick actions: review, approve, deny, cancel
- Comments and notes thread

### 4. Frequency Assignment Module Integration
Add to existing sidebar/navigation:
```html
<li class="nav-item">
    <a href="#" class="nav-link" data-module="frequency">
        <i class="fas fa-broadcast-tower"></i> Frequency Management
    </a>
    <ul class="sub-menu">
        <li><a href="/frequency/assignments">My Unit Frequencies</a></li>
        <li><a href="/frequency/request">Request Frequency</a></li>
        <li><a href="/frequency/requests">My Requests</a></li>
        <li class="admin-only"><a href="/frequency/review">Review Requests</a></li>
    </ul>
</li>
```

## Security & Permissions

### Role-Based Access Control
- **Viewer**: View frequencies for assigned units only
- **Member**: View + submit requests
- **S6 (Signal Officer)**: Member + review requests + manage assignments
- **Commander**: S6 + approve requests
- **Admin**: Full access to all units and requests

### Data Classification
- Respect classification levels (UNCLASS, FOUO)
- Filter data based on user clearance
- Audit all access to classified frequencies

## Workflow Examples

### Example 1: Submitting a Frequency Request
1. User clicks "Request Frequency"
2. Fills out multi-step form
3. System checks for potential conflicts
4. User submits request (status: pending)
5. S6 receives notification
6. S6 reviews and marks under_review
7. S6 adds technical review notes
8. Admin/Commander approves request
9. System creates frequency assignment
10. User notified of approval

### Example 2: Viewing Unit Frequencies
1. User navigates to "My Unit Frequencies"
2. System loads all frequencies for user's units
3. User filters to show only primary frequencies
4. User sees frequency expiring in 20 days (highlighted)
5. User exports list to PDF for commander

### Example 3: Renewing Expiring Frequency
1. System sends alert for frequency expiring in 30 days
2. User clicks "Renew" button
3. System pre-fills renewal request with current data
4. User updates justification
5. Submits renewal request
6. Follows approval workflow

## Implementation Status

✅ **Completed**:
- Database schema (migration 009)
- Go models (frequency_models.go)

🚧 **In Progress**:
- Repository layer
- Service layer
- API handlers
- Frontend components

📋 **Planned**:
- Email notifications
- Automated expiration alerts
- Conflict detection algorithm
- Frequency coordination with external systems
- Mobile-responsive UI
- Real-time updates via WebSockets

## Next Steps

1. ✅ Create repository layer (`repositories/frequency_repository.go`)
2. ✅ Create service layer (`services/frequency_service.go`)
3. ✅ Create API handlers (`handlers/frequency_handler.go`)
4. ✅ Add routes to main.go
5. ✅ Create frontend HTML templates
6. ✅ Create frontend JavaScript modules
7. ✅ Test complete workflow
8. ✅ Deploy and document

## Testing

### Unit Tests
- Test all repository CRUD operations
- Test service business logic
- Test request workflow state transitions
- Test conflict detection

### Integration Tests
- Test complete request submission workflow
- Test approval workflow
- Test multi-unit frequency viewing
- Test permission enforcement

### User Acceptance Testing
- Submit frequency request as member
- Review request as S6
- Approve request as admin
- View assignments across multiple units
- Test expiration alerts

## Notes

- All frequency values stored in MHz for consistency
- Dates/times in UTC, converted to local on display
- Classification levels must be enforced at API level
- Audit all modifications to assignments and requests
- Consider integration with NTIA/FCC systems for real coordination
- Future: Add spectrum analyzer integration
- Future: Add propagation modeling for conflict detection
