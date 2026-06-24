import { supabase } from "./supabaseClient";
import { isMissingColumnError } from "./supabaseCompat";
import { normalizeUsername } from "./usernameRules";
import {
  logProfileEnsureGrouped,
  isProfileEnsureDiagnosticsEnabled,
  buildPostgrestMutationDetails,
} from "./profileMutationDiagnostics";
import { logSupabaseMutationResult } from "./supabaseRawError";
import { fetchProfileRowWithTiers, insertProfileRowReturn } from "./profileSelectContract";

function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function isProfilesUniqueViolation(error) {
  if (!error) return false;
  if (error.code === "23505") return true;
  const msg = String(error.message ?? "").toLowerCase();
  return msg.includes("duplicate key") || msg.includes("unique constraint");
}

const TERMINAL_STORAGE_PREFIX = "bl_profile_ensure_terminal_";

function storageKey(userId) {
  return `${TERMINAL_STORAGE_PREFIX}${userId}`;
}

function readTerminalRecord(userId) {
  if (typeof sessionStorage === "undefined" || !userId) return null;
  try {
    const raw = sessionStorage.getItem(storageKey(userId));
    return raw ? JSON.parse(raw) : null;
  } catch {
    return null;
  }
}

function writeTerminalRecord(userId, details) {
  if (typeof sessionStorage === "undefined" || !userId) return;
  try {
    sessionStorage.setItem(storageKey(userId), JSON.stringify({ at: Date.now(), ...details }));
  } catch {
    /* ignore quota / private mode */
  }
}

function clearTerminalRecord(userId) {
  if (typeof sessionStorage === "undefined" || !userId) return;
  try {
    sessionStorage.removeItem(storageKey(userId));
  } catch {
    /* ignore */
  }
}

async function fetchProfileRowWithBackoff(userId, tries = 5, delayMs = 140) {
  let lastError = null;
  for (let i = 0; i < tries; i += 1) {
    const { data, error } = await fetchProfileRowWithTiers(supabase, userId);
    if (!error && data?.id) {
      return { profile: data, error: null };
    }
    if (error) lastError = error;
    if (i < tries - 1) await sleep(delayMs);
  }
  return { profile: null, error: lastError };
}

async function insertProfileRepair(payload) {
  return insertProfileRowReturn(supabase, payload);
}

/**
 * @param {import("@supabase/supabase-js").User|null|undefined} user
 * @param {{
 *   flow?: string,
 *   signUpSummary?: object,
 *   log?: boolean,
 *   force?: boolean
 * }} [options]
 * @returns {Promise<{
 *   ok: boolean,
 *   profile: object|null,
 *   clientVerified: boolean,
 *   deferredWithoutSession: boolean,
 *   lastError: unknown|null,
 *   skippedDueToPriorFailure?: boolean
 * }>}
 */
export async function ensureProfile(user, options = {}) {
  const flow = options.flow || "unspecified";
  const force = options.force === true;

  if (!user?.id) {
    return {
      ok: false,
      profile: null,
      clientVerified: false,
      deferredWithoutSession: false,
      lastError: null,
    };
  }

  if (force) {
    clearTerminalRecord(user.id);
  }

  const { data: sessionData } = await supabase.auth.getSession();
  const hasSession = Boolean(sessionData?.session?.access_token);

  const diag = isProfileEnsureDiagnosticsEnabled();
  const signupVerbose = diag && (flow === "signup" || flow === "signup-retry" || options.log === true);

  if (signupVerbose) {
    logProfileEnsureGrouped({
      flow,
      stage: "start",
      userId: user.id,
      hasSession,
      signUpSummary: options.signUpSummary ?? null,
    });
  }

  const terminal = readTerminalRecord(user.id);
  if (terminal && !force && hasSession) {
    const { profile: quick } = await fetchProfileRowWithBackoff(user.id, 2, 60);
    if (quick?.id) {
      clearTerminalRecord(user.id);
    } else {
      if (diag) {
        logProfileEnsureGrouped({
          flow,
          stage: "skipped (prior terminal failure; use force or clear sessionStorage)",
          userId: user.id,
          hasSession,
          priorTerminal: terminal,
        });
      }
      return {
        ok: false,
        profile: null,
        clientVerified: true,
        deferredWithoutSession: false,
        lastError: terminal?.lastErrorSnapshot ?? null,
        skippedDueToPriorFailure: true,
      };
    }
  }

  const desiredUsername = normalizeUsername(user.user_metadata?.username || "");
  const email = user.email ?? null;

  const { profile: initial, error: initialSelectError } = await fetchProfileRowWithBackoff(user.id);
  if (initialSelectError && signupVerbose) {
    logProfileEnsureGrouped({
      flow,
      stage: "initial select",
      userId: user.id,
      hasSession,
      error: initialSelectError,
    });
  }

  if (initial?.id) {
    if (desiredUsername && !initial.username) {
      const { error: upErr } = await supabase
        .from("profiles")
        .update({ username: desiredUsername })
        .eq("id", user.id);
      if (upErr && !isMissingColumnError(upErr) && !isProfilesUniqueViolation(upErr)) {
        if (signupVerbose) {
          logProfileEnsureGrouped({
            flow,
            stage: "username update",
            userId: user.id,
            hasSession,
            error: upErr,
          });
        }
      }
    }
    const { profile: refreshed } = await fetchProfileRowWithBackoff(user.id, 2, 80);
    const prof = refreshed || initial;
    if (signupVerbose) {
      logProfileEnsureGrouped({
        flow,
        stage: "existing row",
        userId: user.id,
        hasSession,
        finalProfile: prof,
      });
    }
    return {
      ok: true,
      profile: prof,
      clientVerified: hasSession && Boolean(prof?.id),
      deferredWithoutSession: false,
      lastError: null,
    };
  }

  if (!hasSession) {
    if (diag) {
      logProfileEnsureGrouped({
        flow,
        stage: "defer (no JWT; DB trigger owns insert — no client upsert)",
        userId: user.id,
        hasSession: false,
        error: initialSelectError,
      });
    }
    return {
      ok: true,
      profile: null,
      clientVerified: false,
      deferredWithoutSession: true,
      lastError: initialSelectError,
    };
  }

  const minimalInsert = { id: user.id, role: "user", email };
  let repairPayload = desiredUsername ? { ...minimalInsert, username: desiredUsername } : minimalInsert;

  const logRepairFailureOnce = (stage, payload, result) => {
    if (!diag) return;
    const details = buildPostgrestMutationDetails(result, payload);
    logProfileEnsureGrouped({
      flow,
      stage,
      userId: user.id,
      hasSession,
      ensurePayload: payload,
      error: result?.error ?? null,
      postgrest: details,
    });
    logSupabaseMutationResult(`profile-ensure:${flow}:${stage}`, result, { payloadKeys: details.payloadKeys });
  };

  let repairResult = await insertProfileRepair(repairPayload);

  if (repairResult.error && isMissingColumnError(repairResult.error) && desiredUsername) {
    repairPayload = minimalInsert;
    repairResult = await insertProfileRepair(minimalInsert);
  }

  if (repairResult.error && desiredUsername && isProfilesUniqueViolation(repairResult.error)) {
    repairPayload = minimalInsert;
    repairResult = await insertProfileRepair(minimalInsert);
  }

  if (repairResult.error && isProfilesUniqueViolation(repairResult.error)) {
    const { profile: raced } = await fetchProfileRowWithBackoff(user.id, 5, 120);
    if (raced?.id) {
      repairResult = { data: raced, error: null };
    }
  }

  if (repairResult.error && !isProfilesUniqueViolation(repairResult.error) && !isMissingColumnError(repairResult.error)) {
    logRepairFailureOnce("insert repair failed", repairPayload, repairResult);
    writeTerminalRecord(user.id, {
      lastErrorSnapshot: buildPostgrestMutationDetails(repairResult, repairPayload),
    });
    const { profile: afterFail } = await fetchProfileRowWithBackoff(user.id, 3, 120);
    if (afterFail?.id) {
      clearTerminalRecord(user.id);
      const prof = afterFail;
      if (desiredUsername && !prof.username) {
        await supabase.from("profiles").update({ username: desiredUsername }).eq("id", user.id);
      }
      const { profile: finalP } = await fetchProfileRowWithBackoff(user.id, 2, 80);
      return {
        ok: true,
        profile: finalP || prof,
        clientVerified: true,
        deferredWithoutSession: false,
        lastError: null,
      };
    }
    return {
      ok: false,
      profile: null,
      clientVerified: true,
      deferredWithoutSession: false,
      lastError: repairResult.error,
    };
  }

  const readTries = 6;
  const { profile: afterRepair, error: afterErr } = await fetchProfileRowWithBackoff(user.id, readTries, 160);

  if (afterRepair?.id) {
    if (desiredUsername && !afterRepair.username) {
      const { error: upErr2 } = await supabase
        .from("profiles")
        .update({ username: desiredUsername })
        .eq("id", user.id);
      if (upErr2 && !isMissingColumnError(upErr2) && !isProfilesUniqueViolation(upErr2) && signupVerbose) {
        logProfileEnsureGrouped({
          flow,
          stage: "post-repair username",
          userId: user.id,
          hasSession,
          error: upErr2,
        });
      }
    }
    const { profile: finalP } = await fetchProfileRowWithBackoff(user.id, 2, 80);
    const prof = finalP || afterRepair;
    clearTerminalRecord(user.id);
    if (signupVerbose) {
      logProfileEnsureGrouped({
        flow,
        stage: "after repair insert",
        userId: user.id,
        hasSession,
        ensurePayload: repairPayload,
        error: repairResult.error,
        finalProfile: prof,
      });
    }
    return {
      ok: true,
      profile: prof,
      clientVerified: true,
      deferredWithoutSession: false,
      lastError: repairResult.error,
    };
  }

  if (diag) {
    logProfileEnsureGrouped({
      flow,
      stage: "failed (row still missing after repair)",
      userId: user.id,
      hasSession,
      ensurePayload: repairPayload,
      error: repairResult.error || initialSelectError || afterErr,
      postgrest: buildPostgrestMutationDetails(repairResult, repairPayload),
    });
  }

  writeTerminalRecord(user.id, {
    lastErrorSnapshot: buildPostgrestMutationDetails(repairResult, repairPayload),
  });

  return {
    ok: false,
    profile: null,
    clientVerified: true,
    deferredWithoutSession: false,
    lastError: repairResult.error || initialSelectError || afterErr,
  };
}
