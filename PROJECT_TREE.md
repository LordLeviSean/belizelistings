# Project tree

BelizeListings frontend repository layout (generated 2026-06-23).

**Excluded from this tree:** `node_modules/`, `.next/`, `coverage/`, `dist/`, `build/`, `.git/`, `.swc/` (and other hidden paths except `.cursor/`, `.gitignore`, `.env.local`).

```
belizelistings-frontend/
├── .cursor/
│   └── rules/
│       └── belizelistings-design-dna.mdc
├── docs/
│   ├── BELIZELISTINGS_LISTING_CARD_DNA.md
│   ├── BELIZELISTINGS_SYSTEM_RULES.md
│   ├── step6-backend-sync-plan.md
│   └── ui-layout-rules.md
├── public/
│   ├── brand/
│   │   └── mayflower-atmosphere.png
│   ├── listings/
│   │   ├── house1.PNG
│   │   ├── house2.PNG
│   │   └── house3.png
│   ├── maps/
│   │   ├── bz.svg
│   │   └── clean-mainland-districts.svg
│   ├── fallback.svg
│   ├── favicon.ico
│   ├── file.svg
│   ├── globe.svg
│   ├── next.svg
│   ├── placeholder.png
│   ├── vercel.svg
│   └── window.svg
├── scripts/
├── src/
│   ├── components/
│   │   ├── auth/
│   │   │   ├── AlreadySignedInModal.jsx
│   │   │   ├── AlreadySignedInModal.module.css
│   │   │   ├── AuthGateProvider.jsx
│   │   │   └── GatedAccountCtaLink.jsx
│   │   ├── dashboard/
│   │   │   ├── DashboardShell.jsx
│   │   │   ├── DashboardShell.module.css
│   │   │   ├── index.js
│   │   │   ├── RoleBadge.jsx
│   │   │   └── RoleBadge.module.css
│   │   ├── icons/
│   │   │   └── LandParcelGlyph.jsx
│   │   ├── inquiry/
│   │   │   ├── AgentInquiryList.jsx
│   │   │   └── AgentInquiryList.module.css
│   │   ├── listing/
│   │   │   ├── ContactAgentModal.jsx
│   │   │   ├── ContactAgentModal.module.css
│   │   │   ├── DiscardDraftModal.jsx
│   │   │   ├── DiscardDraftModal.module.css
│   │   │   ├── index.js
│   │   │   ├── ListingContactActions.jsx
│   │   │   ├── ListingContactActions.module.css
│   │   │   ├── ListingMediaImage.jsx
│   │   │   ├── ListingMediaImage.module.css
│   │   │   ├── ListingMediaIntrinsic.jsx
│   │   │   ├── ListingMessageModal.jsx
│   │   │   ├── ListingMessageModal.module.css
│   │   │   ├── ListingTrustStrip.jsx
│   │   │   ├── ListingTrustStrip.module.css
│   │   │   ├── ListingViewingBookingModal.jsx
│   │   │   ├── ListingViewingBookingModal.module.css
│   │   │   ├── ListingViewingModal.jsx
│   │   │   └── ListingViewingModal.module.css
│   │   ├── notifications/
│   │   │   ├── NotificationCenter.jsx
│   │   │   └── NotificationCenter.module.css
│   │   ├── operational/
│   │   │   ├── ActivityFeedCard.jsx
│   │   │   ├── AgentActivityFeed.jsx
│   │   │   ├── AgentQuickActionBar.jsx
│   │   │   ├── index.js
│   │   │   ├── ListingHealthBadge.jsx
│   │   │   ├── ListingIntelStrip.jsx
│   │   │   ├── ListingPerformanceStrip.jsx
│   │   │   ├── OperationalIntel.module.css
│   │   │   └── OperationalWarningChips.jsx
│   │   ├── ui/
│   │   │   ├── ListingImage.jsx
│   │   │   ├── PremiumEmptyState.jsx
│   │   │   ├── PremiumEmptyState.module.css
│   │   │   └── ToastProvider.jsx
│   │   ├── user/
│   │   │   ├── UserArchivedListingsPanel.jsx
│   │   │   ├── UserDashboardAccountTier.jsx
│   │   │   ├── UserDashboardAtmosphere.jsx
│   │   │   ├── UserDashboardAtmosphere.module.css
│   │   │   ├── UserDashboardMetrics.jsx
│   │   │   ├── UserListingRowIntel.jsx
│   │   │   ├── UserMyListingsPanel.jsx
│   │   │   ├── UserPendingListingsPanel.jsx
│   │   │   ├── UserUpgradePathModal.jsx
│   │   │   └── UserUpgradePathModal.module.css
│   │   ├── AdminOperationalStats.jsx
│   │   ├── AgentAccessGate.jsx
│   │   ├── AgentOperationalStrip.jsx
│   │   ├── AgentOperationalStrip.module.css
│   │   ├── AllListingsPanel.jsx
│   │   ├── AmbientPalmBackdrop.jsx
│   │   ├── AmbientPalmBackdrop.module.css
│   │   ├── AppErrorBoundary.jsx
│   │   ├── AppErrorBoundary.module.css
│   │   ├── BackButton.jsx
│   │   ├── BelizeMap.jsx
│   │   ├── BelizeMap.module.css
│   │   ├── Breadcrumbs.jsx
│   │   ├── CreateListingAmenitiesSelector.jsx
│   │   ├── CreateListingAmenitiesSelector.module.css
│   │   ├── DeleteConfirmModal.jsx
│   │   ├── DeleteConfirmModal.module.css
│   │   ├── DistrictLayout.jsx
│   │   ├── FavoriteSignupPrompt.module.css
│   │   ├── FavoriteSignupPromptProvider.jsx
│   │   ├── FilterBar.jsx
│   │   ├── FilterBar.module.css
│   │   ├── Footer.jsx
│   │   ├── HomeAdvancedFiltersModal.jsx
│   │   ├── HomeAdvancedFiltersModal.module.css
│   │   ├── HomePropertyCard.jsx
│   │   ├── ListingCard.jsx
│   │   ├── ListingCard.module.css
│   │   ├── ListingOwnershipMeta.jsx
│   │   ├── ListingOwnershipMeta.module.css
│   │   ├── ListingTrustStrip.jsx
│   │   ├── ListingTrustStrip.module.css
│   │   ├── ManageUsersPanel.jsx
│   │   ├── ManageUsersPanel.module.css
│   │   ├── OperatorListingsPanel.jsx
│   │   ├── PendingListingsPanel.jsx
│   │   ├── PropertiesPanel.jsx
│   │   ├── RejectListingModal.jsx
│   │   ├── RejectListingModal.module.css
│   │   ├── ShareListingIconButton.jsx
│   │   ├── SiteNav.jsx
│   │   ├── SiteNavUnified.module.css
│   │   ├── TrustMetadataStrip.jsx
│   │   └── VacancyPanel.jsx
│   ├── constants/
│   │   ├── authRoutes.js
│   │   ├── belizeMapRegions.js
│   │   ├── dashboardRoles.js
│   │   ├── dashboardUserConfig.js
│   │   ├── geographyLayer.js
│   │   ├── imageQuality.js
│   │   ├── inquiryModel.js
│   │   ├── listingAmenities.js
│   │   ├── listingAmenities.test.js
│   │   ├── listingsSchemaAllowlist.js
│   │   ├── operationalIntel.js
│   │   ├── operationalModel.js
│   │   ├── ownershipModel.js
│   │   ├── rejectionModel.js
│   │   ├── rejectionModel.test.js
│   │   └── trustModel.js
│   ├── data/
│   │   └── listings.js
│   ├── hooks/
│   │   ├── useAlerts.js
│   │   ├── useAuth.js
│   │   ├── useCountUp.js
│   │   ├── useFavorites.js
│   │   ├── useLivePaletteMode.js
│   │   ├── usePulseMode.js
│   │   ├── useRoleAccess.js
│   │   ├── useRouteMemory.js
│   │   ├── useSavedSearches.js
│   │   ├── useScrollMemory.js
│   │   ├── useSeaFlowMode.js
│   │   └── useUserRole.js
│   ├── lib/
│   │   ├── approvedListingsCache.js
│   │   ├── approvedListingsCache.test.js
│   │   ├── brokerTeamScope.js
│   │   ├── canonicalMutationStrips.js
│   │   ├── createListingUploads.js
│   │   ├── createWorkspaceDashboardRoutes.js
│   │   ├── dashboardGreeting.js
│   │   ├── dashboardGreeting.test.js
│   │   ├── dashboardMetricsTelemetry.js
│   │   ├── debug.js
│   │   ├── districtExploreRoutes.js
│   │   ├── draftListingInsertContract.js
│   │   ├── ensureProfile.js
│   │   ├── favorites.js
│   │   ├── featureFlags.js
│   │   ├── legacyDraftCompat.js
│   │   ├── legacyDraftCompat.test.js
│   │   ├── listingDashboardSelectContract.audit.test.js
│   │   ├── listingDashboardSelectContract.js
│   │   ├── listingDashboardSelectContract.test.js
│   │   ├── listingInquiries.js
│   │   ├── listingMutationDiagnostics.js
│   │   ├── listingOperationalStats.js
│   │   ├── listingPayloadSanitize.js
│   │   ├── listingPersistence.js
│   │   ├── listingPersistence.test.js
│   │   ├── listingQueries.js
│   │   ├── listingReapproval.js
│   │   ├── listingWriteContract.js
│   │   ├── listingWriteContract.test.js
│   │   ├── mobileFoundation.js
│   │   ├── motionTokens.js
│   │   ├── profileDisplayName.js
│   │   ├── profileMutationDiagnostics.js
│   │   ├── profileSelectContract.audit.test.js
│   │   ├── profileSelectContract.js
│   │   ├── profileSelectContract.test.js
│   │   ├── profileSessionCache.js
│   │   ├── profileSessionCache.test.js
│   │   ├── supabaseClient.js
│   │   ├── supabaseCompat.js
│   │   ├── supabaseCompat.test.js
│   │   ├── supabaseRawError.js
│   │   ├── supabaseRawError.test.js
│   │   ├── trace.js
│   │   ├── userDashboardListingTruth.js
│   │   ├── userDashboardListingTruth.test.js
│   │   ├── userDashboardMetricsBus.js
│   │   ├── usernameAvailability.js
│   │   ├── usernameRules.js
│   │   └── usernameRules.test.js
│   ├── pages/
│   │   ├── admin/
│   │   │   └── index.jsx
│   │   ├── api/
│   │   │   ├── admin/
│   │   │   │   ├── create-user.js
│   │   │   │   └── repair-missing-profiles.js
│   │   │   ├── auth/
│   │   │   │   └── check-username.js
│   │   │   ├── listings/
│   │   │   │   └── enforce-active-cap.js
│   │   │   └── hello.js
│   │   ├── banner/
│   │   ├── dashboard/
│   │   │   ├── operator/
│   │   │   │   └── property/
│   │   │   │       └── [id].jsx
│   │   │   ├── agent.jsx
│   │   │   ├── broker.jsx
│   │   │   ├── create.jsx
│   │   │   ├── index.jsx
│   │   │   └── user.jsx
│   │   ├── listing/
│   │   │   └── [id].js
│   │   ├── listings/
│   │   │   └── district/
│   │   │       └── [district].jsx
│   │   ├── _app.js
│   │   ├── _document.js
│   │   ├── agents.jsx
│   │   ├── favorites.jsx
│   │   ├── forgot-password.jsx
│   │   ├── index.js
│   │   ├── login.jsx
│   │   ├── reset-password.jsx
│   │   ├── search.jsx
│   │   ├── signin.jsx
│   │   └── signup.jsx
│   ├── stores/
│   │   └── useUserDashboardStore.js
│   ├── styles/
│   │   ├── Agents.module.css
│   │   ├── ambientOcean.module.css
│   │   ├── Auth.module.css
│   │   ├── BackNav.module.css
│   │   ├── CreateWorkspace.module.css
│   │   ├── Dashboard.module.css
│   │   ├── District.module.css
│   │   ├── FavoriteButton.module.css
│   │   ├── Favorites.module.css
│   │   ├── globals.css
│   │   ├── Home.module.css
│   │   ├── HomeMapFirst.module.css
│   │   ├── ListingDetail.module.css
│   │   ├── SavedSearches.module.css
│   │   ├── SearchResults.module.css
│   │   ├── tokens.css
│   │   └── UserDashboard.module.css
│   └── utils/
│       ├── canonicalListing.js
│       ├── canonicalListing.test.js
│       ├── createListingForm.js
│       ├── filterListings.js
│       ├── filterListings.test.js
│       ├── intentionalSmoothScroll.js
│       ├── listingAtmosphere.js
│       ├── listingImage.js
│       ├── listingIntel.js
│       ├── listingIntel.test.js
│       ├── listingMediaBlur.js
│       ├── listingOperationalMeta.js
│       ├── listingPresentation.js
│       ├── listingPresentation.test.js
│       ├── livePaletteMode.js
│       ├── navBadge.js
│       ├── ownershipAttribution.js
│       ├── passwordValidation.js
│       ├── propertyHighlights.js
│       ├── pulseMode.js
│       ├── queryStringify.js
│       ├── savedSearchUtils.js
│       ├── seaFlowMode.js
│       ├── shareListing.js
│       └── trustSignals.js
├── supabase/
│   ├── migrations/
│   │   ├── 20260512120000_handle_new_user_profile.sql
│   │   ├── 20260512140000_profiles_rls_and_trigger_hardening.sql
│   │   ├── 20260512160000_listings_user_dashboard_index.sql
│   │   ├── 20260512180000_profiles_admin_rls.sql
│   │   └── 20260512190000_profiles_admin_rls_fix.sql
│   └── verification/
│       └── verify_profiles_admin_rls.sql
├── .env.local
├── .gitignore
├── eslint.config.mjs
├── jest.config.js
├── jsconfig.json
├── next.config.js
├── package-lock.json
├── package.json
├── project-tree.txt
├── README.md
├── supabase-add-listings-amenities.sql
├── supabase-add-listings-description.sql
├── supabase-agent-system.sql
├── supabase-diagnose-listings-archive-400.sql
├── supabase-diagnose-listings-insert.sql
├── supabase-favorites-rls.sql
├── supabase-fix-archive-allow-status-archived.sql
├── supabase-listing-inquiries.sql
├── supabase-listing-status-migration.sql
├── supabase-listings-canonical-alignment.sql
├── supabase-listings-migrate-to-user-id.sql
├── supabase-migration-profiles-username.sql
├── supabase-property-unit-management.sql
├── supabase-rpc-username-is-taken.sql
└── supabase-step6-additive-sync.sql
```
