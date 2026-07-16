/**
 * BelizeListings platform update registry — single source of truth for
 * Learn More archive, timed homepage modals, and future announcement surfaces.
 */

export const PLATFORM_UPDATE_STATUS = Object.freeze({
  LIVE: "LIVE",
  OPEN_BETA: "OPEN BETA",
  FEATURED_UPDATE: "FEATURED UPDATE",
  FOUNDATION: "FOUNDATION",
});

export const PLATFORM_UPDATE_IDS = Object.freeze({
  GEOGRAPHIC_V1: "geographic-update-v1",
  COMMUNICATION_V1: "communication-update-v1",
  PERFORMANCE_V1: "performance-update-v1",
  CRM_V1: "crm-v1",
  OPEN_BETA: "open-beta",
  BUILT_FOR_BELIZE: "built-for-belize",
});

/** @typedef {'role-aware-listings' | 'href' | 'auth-signup'} PlatformUpdateCtaType */

/**
 * @typedef {Object} PlatformUpdateCta
 * @property {string} label
 * @property {PlatformUpdateCtaType} [type]
 * @property {string} [href]
 */

/**
 * @typedef {Object} PlatformUpdate
 * @property {string} id
 * @property {string} slug
 * @property {string} title
 * @property {string} version
 * @property {string} summary
 * @property {string} body
 * @property {string} [modalSummary]
 * @property {string} releaseDate
 * @property {string} status
 * @property {string} statusLabel
 * @property {string} [modalStart]
 * @property {string} [modalEnd]
 * @property {PlatformUpdateCta} [primaryCta]
 * @property {PlatformUpdateCta} [secondaryCta]
 * @property {number} archiveOrder
 * @property {boolean} [featured]
 * @property {string} archiveLabel
 * @property {string} archiveDescriptor
 * @property {string[]} highlights
 * @property {{ title: string, items: string[] }[]} [sections]
 */

/** @type {PlatformUpdate[]} */
export const PLATFORM_UPDATES = Object.freeze([
  Object.freeze({
    id: PLATFORM_UPDATE_IDS.GEOGRAPHIC_V1,
    slug: PLATFORM_UPDATE_IDS.GEOGRAPHIC_V1,
    title: "V1.0 — Geographic Update",
    version: "V1.0",
    summary:
      "Structured Belize geography—from eight interactive map regions to communities, neighborhoods, highways, and mile markers.",
    body:
      "BelizeListings now includes detailed locations across Belize—from districts and independent island regions to cities, towns, villages, neighborhoods, highways, and mile markers.\n\nEight interactive map regions, structured location editing for listings, improved search and discovery, and support for updating existing listing locations are all live.",
    modalSummary:
      "BelizeListings now supports detailed District, City/Town/Village, Neighborhood, Highway and locality information across Belize. Update your current listings now to make sure buyers can find them in the correct area.",
    releaseDate: "2026-07-13",
    status: PLATFORM_UPDATE_STATUS.LIVE,
    statusLabel: "LIVE · V1.0",
    modalStart: "2026-07-13",
    modalEnd: "2026-07-16",
    notificationEventType: "geographic_update_v1",
    notificationDedupeKey: "geographic_update_v1:2026-07-13",
    featured: true,
    archiveOrder: 1,
    archiveLabel: "V1.0 — Geographic Update",
    archiveDescriptor: "Map regions, communities, and structured locations",
    primaryCta: Object.freeze({
      label: "Update My Listings",
      type: "role-aware-listings",
    }),
    secondaryCta: Object.freeze({
      label: "Explore Belize Geography",
      type: "href",
      href: "/",
    }),
    highlights: Object.freeze([
      "8 interactive map regions",
      "232 communities",
      "107 neighborhoods and localities",
      "Highway support",
      "Mile markers",
      "Existing listings updated",
      "Structured location editing for listings",
      "Improved search and discovery",
    ]),
    sections: Object.freeze([
      Object.freeze({
        title: "What changed",
        items: Object.freeze([
          "Listing location fields now follow Belize geography layers",
          "Map regions align with discovery and search filters",
          "Owners and agents can refine locations on existing listings",
        ]),
      }),
    ]),
  }),
  Object.freeze({
    id: PLATFORM_UPDATE_IDS.COMMUNICATION_V1,
    slug: PLATFORM_UPDATE_IDS.COMMUNICATION_V1,
    title: "V1.1 — Communication Update",
    version: "V1.1",
    summary:
      "Inbox, viewing requests, and notification-driven follow-up—role-aware across buyer, owner, agent, and admin workflows.",
    body:
      "BelizeListings V1.1 brings structured buyer–seller communication and viewing coordination into the platform—with notifications when messages arrive or viewing status changes.",
    releaseDate: "2026-06-01",
    status: PLATFORM_UPDATE_STATUS.LIVE,
    statusLabel: "LIVE · V1.1",
    archiveOrder: 2,
    archiveLabel: "V1.1 — Communication Update",
    archiveDescriptor: "Inbox, viewings, and notifications",
    primaryCta: Object.freeze({
      label: "Open Inbox",
      type: "href",
      href: "/dashboard/user?tab=inbox",
    }),
    secondaryCta: Object.freeze({
      label: "Explore the Map",
      type: "href",
      href: "/",
    }),
    highlights: Object.freeze([
      "Inbox",
      "Viewing Requests",
      "Notifications",
      "CRM improvements",
      "Role-aware deep links from alerts",
      "Owner and agent inbox surfaces",
      "Admin moderation visibility",
    ]),
    sections: Object.freeze([
      Object.freeze({
        title: "Capabilities",
        items: Object.freeze([
          "Message via BelizeListings on listing detail pages",
          "Schedule and track viewing requests",
          "Notification center routes to the right dashboard tab",
        ]),
      }),
    ]),
  }),
  Object.freeze({
    id: PLATFORM_UPDATE_IDS.PERFORMANCE_V1,
    slug: PLATFORM_UPDATE_IDS.PERFORMANCE_V1,
    title: "V1.2 — Performance Update",
    version: "V1.2",
    summary:
      "Faster loading, sharper search, and mobile polish—keeping the map-first experience responsive across devices.",
    body:
      "BelizeListings V1.2 focuses on perceived speed and browse quality: quicker homepage readiness, smoother district discovery, and tighter mobile interaction patterns without changing core workflows.",
    releaseDate: "2026-07-10",
    status: PLATFORM_UPDATE_STATUS.LIVE,
    statusLabel: "LIVE · V1.2",
    archiveOrder: 3,
    archiveLabel: "V1.2 — Performance Update",
    archiveDescriptor: "Faster loading, search, and mobile polish",
    primaryCta: Object.freeze({
      label: "Explore Listings",
      type: "href",
      href: "/",
    }),
    secondaryCta: Object.freeze({
      label: "Search Belize",
      type: "href",
      href: "/search",
    }),
    highlights: Object.freeze([
      "Faster loading",
      "Search improvements",
      "Mobile polish",
      "Map-first homepage readiness",
      "District browse refinements",
      "Scroll and carousel continuity",
    ]),
    sections: Object.freeze([
      Object.freeze({
        title: "Shipped improvements",
        items: Object.freeze([
          "Homepage map and featured listings load with staged readiness",
          "District and search surfaces share calmer spacing and hierarchy",
          "Mobile filter and navigation patterns aligned with desktop quality",
        ]),
      }),
    ]),
  }),
  Object.freeze({
    id: PLATFORM_UPDATE_IDS.CRM_V1,
    slug: PLATFORM_UPDATE_IDS.CRM_V1,
    title: "CRM V1.0 — Inbox & Viewings",
    version: "CRM V1.0",
    summary:
      "Legacy archive entry — see V1.1 Communication Update for the current communication milestone.",
    body:
      "This entry is preserved for older links. The Communication Update (V1.1) is the canonical release note for inbox, viewings, and notifications.",
    releaseDate: "2026-06-01",
    status: PLATFORM_UPDATE_STATUS.LIVE,
    statusLabel: "ARCHIVED ENTRY",
    archiveOrder: 4,
    archiveLabel: "CRM V1.0 (legacy link)",
    archiveDescriptor: "Redirects to Communication Update",
    primaryCta: Object.freeze({
      label: "View V1.1 Communication Update",
      type: "href",
      href: "/learn-more#communication-update-v1",
    }),
    secondaryCta: Object.freeze({
      label: "Explore the Map",
      type: "href",
      href: "/",
    }),
    highlights: Object.freeze([
      "See V1.1 — Communication Update for current details",
    ]),
    sections: Object.freeze([]),
  }),
  Object.freeze({
    id: PLATFORM_UPDATE_IDS.OPEN_BETA,
    slug: PLATFORM_UPDATE_IDS.OPEN_BETA,
    title: "Open Beta",
    version: "Platform",
    summary:
      "BelizeListings is fully functional and open for public use—moderation, listing lifecycle, accounts, favorites, and map-first discovery.",
    body:
      "BelizeListings is live in Open Beta: a curated, moderated marketplace where buyers, renters, owners, agents, and administrators can participate today while we continue shipping improvements.",
    releaseDate: "2025-01-01",
    status: PLATFORM_UPDATE_STATUS.OPEN_BETA,
    statusLabel: "OPEN BETA",
    archiveOrder: 5,
    archiveLabel: "Open Beta",
    archiveDescriptor: "Live marketplace, evolving weekly",
    primaryCta: Object.freeze({
      label: "Create Free Account",
      type: "auth-signup",
    }),
    secondaryCta: Object.freeze({
      label: "Explore the Map",
      type: "href",
      href: "/",
    }),
    highlights: Object.freeze([
      "Editorial moderation and listing lifecycle",
      "Accounts, roles, and dashboards",
      "Favorites and saved discovery",
      "Interactive national property map",
      "Owner, agent, broker, and admin workflows",
      "Regular interface and capability updates",
    ]),
    sections: Object.freeze([
      Object.freeze({
        title: "During Open Beta",
        items: Object.freeze([
          "Interface improvements ship regularly",
          "New features roll out with archive entries here",
          "Performance and verification tools continue expanding",
        ]),
      }),
    ]),
  }),
  Object.freeze({
    id: PLATFORM_UPDATE_IDS.BUILT_FOR_BELIZE,
    slug: PLATFORM_UPDATE_IDS.BUILT_FOR_BELIZE,
    title: "Built for Belize",
    version: "Mission",
    summary:
      "A modern Belize-focused property marketplace connecting buyers, renters, owners, and professionals in one trusted, curated place.",
    body:
      "BelizeListings is a modern property marketplace designed specifically for Belize. Our mission is to create one trusted place where buyers, renters, property owners, and real estate professionals can confidently connect.\n\nExplore. Invest. Thrive.",
    releaseDate: "2025-01-01",
    status: PLATFORM_UPDATE_STATUS.FOUNDATION,
    statusLabel: "FOUNDATION",
    archiveOrder: 6,
    archiveLabel: "Built for Belize",
    archiveDescriptor: "Mission & marketplace purpose",
    primaryCta: Object.freeze({
      label: "Create Free Account",
      type: "auth-signup",
    }),
    secondaryCta: Object.freeze({
      label: "Explore the Map",
      type: "href",
      href: "/",
    }),
    highlights: Object.freeze([
      "Modern Belize-focused property marketplace",
      "Trusted connection between buyers, renters, owners, and professionals",
      "Curated, moderated inventory",
      "Interactive map-first discovery",
      "Verification and lifecycle clarity",
      "Explore. Invest. Thrive.",
    ]),
    sections: Object.freeze([
      Object.freeze({
        title: "Why we built BelizeListings",
        items: Object.freeze([
          "Finding property in Belize has traditionally meant scattered posts and word of mouth",
          "We bring discovery together with clarity, trust, and verification",
          "Every design decision favors simplicity and Belize-specific context",
        ]),
      }),
      Object.freeze({
        title: "What you can do today",
        items: Object.freeze([
          "Browse verified listings and explore the interactive map",
          "Search by district and save favorites",
          "Contact agents, schedule viewings, and manage listings",
          "Secure buyer–owner messaging through Inbox",
        ]),
      }),
      Object.freeze({
        title: "What makes us different",
        items: Object.freeze([
          "Interactive property map instead of endless scrolling",
          "Verification that builds confidence between buyers and sellers",
          "Built around real Belize professionals—not replacing them",
          "Belize-first features, not generic marketplace clones",
        ]),
      }),
    ]),
  }),
]);

const UPDATES_BY_ID = new Map(PLATFORM_UPDATES.map((u) => [u.id, u]));
const UPDATES_BY_SLUG = new Map(PLATFORM_UPDATES.map((u) => [u.slug, u]));

export function getPlatformUpdatesArchive() {
  return [...PLATFORM_UPDATES].sort((a, b) => a.archiveOrder - b.archiveOrder);
}

/** @param {string} id */
export function getPlatformUpdateById(id) {
  return UPDATES_BY_ID.get(String(id || "").trim()) || null;
}

/** @param {string} slug */
export function getPlatformUpdateBySlug(slug) {
  return UPDATES_BY_SLUG.get(String(slug || "").trim()) || null;
}

export function getFeaturedPlatformUpdate() {
  return PLATFORM_UPDATES.find((u) => u.featured) || PLATFORM_UPDATES[0] || null;
}

export function getDefaultPlatformUpdate() {
  return getFeaturedPlatformUpdate() || getPlatformUpdatesArchive()[0] || null;
}

/** Modal-linked update (timed homepage announcement). */
export function getGeographicUpdatePlatformEntry() {
  return getPlatformUpdateById(PLATFORM_UPDATE_IDS.GEOGRAPHIC_V1);
}
