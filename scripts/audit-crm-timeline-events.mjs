#!/usr/bin/env node
/**
 * Verify CRM listing_events types and visibility (Workstream F).
 * Usage: node scripts/audit-crm-timeline-events.mjs
 */
import { createClient } from "@supabase/supabase-js";
import { requireSupabase } from "./_load-env.mjs";

const CRM_EVENT_SPECS = [
  { type: "listing.crm.conversation_created", visibility: "internal" },
  { type: "listing.crm.agent_responded", visibility: "internal" },
  { type: "listing.crm.viewing_cancelled", visibility: "internal" },
  { type: "listing.viewing.scheduled", visibility: "public" },
];

async function main() {
  const { url, key } = requireSupabase();
  const supabase = createClient(url, key);

  const { data: events, error } = await supabase
    .from("listing_events")
    .select("id,listing_id,event_type,visibility,occurred_at,source,payload")
    .or(
      CRM_EVENT_SPECS.map((s) => `event_type.eq.${s.type}`).join(",")
    )
    .order("occurred_at", { ascending: false })
    .limit(200);

  if (error) {
    console.error(JSON.stringify({ ok: false, error: error.message }, null, 2));
    process.exit(1);
  }

  const byType = {};
  const visibilityMismatches = [];
  const missingPayloadKeys = [];

  for (const ev of events || []) {
    byType[ev.event_type] = (byType[ev.event_type] || 0) + 1;
    const spec = CRM_EVENT_SPECS.find((s) => s.type === ev.event_type);
    if (spec && ev.visibility !== spec.visibility) {
      visibilityMismatches.push({
        id: ev.id,
        event_type: ev.event_type,
        expected: spec.visibility,
        actual: ev.visibility,
      });
    }
    if (ev.event_type === "listing.crm.conversation_created" && !ev.payload?.conversation_id && !ev.payload?.inquiry_id) {
      missingPayloadKeys.push({ id: ev.id, event_type: ev.event_type });
    }
  }

  const report = {
    ok: visibilityMismatches.length === 0,
    total_crm_events: (events || []).length,
    by_event_type: byType,
    expected_specs: CRM_EVENT_SPECS,
    types_never_emitted: CRM_EVENT_SPECS.filter((s) => !byType[s.type]).map((s) => s.type),
    visibility_mismatches: visibilityMismatches,
    payload_gaps: missingPayloadKeys,
    recent_sample: (events || []).slice(0, 10).map((e) => ({
      listing_id: e.listing_id,
      event_type: e.event_type,
      visibility: e.visibility,
      occurred_at: e.occurred_at,
    })),
  };

  console.log(JSON.stringify(report, null, 2));
  if (!report.ok && process.argv.includes("--strict")) process.exit(1);
}

main().catch((e) => {
  console.error(e.message || e);
  process.exit(1);
});
