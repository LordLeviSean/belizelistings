import { validateGeographyForm } from "./geography/legacyGeoBackfill";

/** Stage-gate for Continue — blocks only on invalid required fields, not sync retries. */
export function validateWorkspaceStageForContinue(stage, form) {
  const nextErrors = {};
  if (stage === 1) {
    if (!String(form.title || "").trim()) nextErrors.title = "Add a title to continue.";
    if (!String(form.property_type || "").trim()) {
      nextErrors.property_type = "Select a property type.";
    }
    const geo = validateGeographyForm(form);
    if (!geo.ok) Object.assign(nextErrors, geo.errors);
    const price = Number(form.price);
    if (form.price !== "" && form.price != null && (Number.isNaN(price) || price < 0)) {
      nextErrors.price = "Enter a valid price.";
    }
  }
  return { ok: Object.keys(nextErrors).length === 0, errors: nextErrors };
}

/**
 * Whether a stage label can be activated without submitting the form.
 * Backward and previously visited forward stages are allowed; unvisited forward stages use Continue.
 */
export function isWorkspaceStageClickable({
  targetStage,
  currentStage,
  maxVisitedStage,
  maxWorkspaceStage,
}) {
  const target = Number(targetStage);
  const current = Number(currentStage);
  const visited = Number(maxVisitedStage);
  const cap = Number(maxWorkspaceStage);
  if (!Number.isFinite(target) || !Number.isFinite(current) || !Number.isFinite(visited) || !Number.isFinite(cap)) {
    return false;
  }
  if (target < 1 || target > cap) return false;
  if (target === current) return false;
  if (target < current) return true;
  return target <= visited;
}

export function resolveWorkspaceStageNavTarget({
  targetStage,
  currentStage,
  maxVisitedStage,
  maxWorkspaceStage,
}) {
  const allowed = isWorkspaceStageClickable({
    targetStage,
    currentStage,
    maxVisitedStage,
    maxWorkspaceStage,
  });
  if (allowed) {
    return { allowed: true, targetStage: Number(targetStage) };
  }
  if (Number(targetStage) > Number(maxVisitedStage)) {
    return {
      allowed: false,
      reason: "forward_unvisited",
      message: "Complete this step with Continue to unlock the next stage.",
    };
  }
  return { allowed: false, reason: "blocked" };
}

export function computeMaxVisitedStageAfterAdvance(currentStage, maxVisitedStage, stageCap) {
  const nextStage = Math.min(Number(stageCap), Number(currentStage) + 1);
  return Math.max(Number(maxVisitedStage), nextStage);
}
