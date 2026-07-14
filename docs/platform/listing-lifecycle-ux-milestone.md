# Listing lifecycle UX — next milestone

## Current state (Open Beta)

User, agent, and admin dashboards expose listing lifecycle as **separate top-level tabs**:

- **My Listings** (active)
- **Pending**
- **Archived**

Each tab loads the same underlying listing management primitives with different filters. Functionality is correct; navigation treats the three states as unrelated destinations.

## Target UX (post–Open Beta)

Consolidate into a **single listing management area**:

```
My Listings
  ├── All
  ├── Active
  ├── Pending
  └── Archived
```

Alternative acceptable pattern:

```
My Listings | Active | Pending | Archived
```

(sub-tabs or segmented control within one shell)

## Why deferred

- Touches user, agent, admin, and operator dashboards plus deep links and notification routing for listing lifecycle events.
- Requires empty-state copy, mobile tab overflow, and metric chips to be redesigned as one system.
- No regression to current publish / pending / archive flows is required for CRM V1.0.

## Implementation notes for next pass

1. Introduce `LISTING_MANAGEMENT_TAB` or nested `?tab=my-listings&filter=active` without breaking existing `?tab=pending` URLs (301/alias via `normalizeUserDashboardTab`).
2. Reuse agent inventory filter pattern (`AGENT_INVENTORY_FILTERS`) as the model for user nested filters.
3. Update `resolveListingManagementPath` and geographic guidance links after tab consolidation.
4. Keep **Inbox** and **Viewings** as peer CRM tabs — do not nest under My Listings.

## Acceptance criteria (future)

- One mental model: “My Listings” is where all owned inventory lives.
- Legacy URLs (`?tab=pending`, `?tab=archived`) still resolve.
- No duplicate listing rows across tabs.
- Mobile: filters accessible without horizontal tab sprawl.
