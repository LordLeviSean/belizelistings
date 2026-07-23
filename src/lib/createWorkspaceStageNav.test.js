import {
  computeMaxVisitedStageAfterAdvance,
  isWorkspaceStageClickable,
  resolveWorkspaceStageNavTarget,
  validateWorkspaceStageForContinue,
} from "./createWorkspaceStageNav";

describe("createWorkspaceStageNav", () => {
  const baseNav = {
    currentStage: 1,
    maxVisitedStage: 3,
    maxWorkspaceStage: 5,
  };

  test("clicking Property Details navigates when stage was previously visited", () => {
    expect(
      isWorkspaceStageClickable({
        ...baseNav,
        targetStage: 2,
      })
    ).toBe(true);
    expect(
      resolveWorkspaceStageNavTarget({
        ...baseNav,
        targetStage: 2,
      })
    ).toEqual({ allowed: true, targetStage: 2 });
  });

  test("clicking Property Basics navigates backward correctly", () => {
    expect(
      isWorkspaceStageClickable({
        ...baseNav,
        currentStage: 3,
        targetStage: 1,
      })
    ).toBe(true);
  });

  test("forward click to an unvisited stage is blocked", () => {
    expect(
      resolveWorkspaceStageNavTarget({
        currentStage: 1,
        maxVisitedStage: 1,
        maxWorkspaceStage: 5,
        targetStage: 2,
      })
    ).toEqual({
      allowed: false,
      reason: "forward_unvisited",
      message: "Complete this step with Continue to unlock the next stage.",
    });
  });

  test("create mode keeps forward navigation gated until Continue advances", () => {
    expect(
      isWorkspaceStageClickable({
        currentStage: 1,
        maxVisitedStage: 1,
        maxWorkspaceStage: 5,
        targetStage: 3,
      })
    ).toBe(false);
    expect(computeMaxVisitedStageAfterAdvance(1, 1, 5)).toBe(2);
    expect(computeMaxVisitedStageAfterAdvance(2, 2, 5)).toBe(3);
  });

  test("edit mode can expose all stages once hydration marks them visited", () => {
    expect(
      isWorkspaceStageClickable({
        currentStage: 1,
        maxVisitedStage: 4,
        maxWorkspaceStage: 4,
        targetStage: 3,
      })
    ).toBe(true);
  });

  test("stage navigation helpers do not mutate form values", () => {
    const form = {
      title: "Coastal Villa",
      property_type: "house",
      beds: "3",
    };
    validateWorkspaceStageForContinue(1, form);
    expect(form.beds).toBe("3");
    expect(form.title).toBe("Coastal Villa");
  });

  test("validateWorkspaceStageForContinue preserves stage 1 requirements", () => {
    const invalid = validateWorkspaceStageForContinue(1, { title: "", property_type: "" });
    expect(invalid.ok).toBe(false);
    expect(invalid.errors.title).toBeTruthy();
    expect(invalid.errors.property_type).toBeTruthy();
  });
});
