import {
  captureCreateWorkspaceSessionBaseline,
  hasCreateWorkspaceSessionChanges,
  mapCreateWorkspaceExitError,
  resolveCreateWorkspaceExitAction,
  resolveCreateWorkspaceExitCopy,
  serializeCreateWorkspaceForm,
  serializeRemoteImageSnapshot,
} from "./createWorkspaceSession";

describe("createWorkspaceSession", () => {
  test("detects form and media changes against session baseline", () => {
    const baseline = captureCreateWorkspaceSessionBaseline({
      form: { title: "Original", property_type: "house" },
      remoteImages: [{ id: "img-1", image_url: "https://example.test/a.webp", position: 0 }],
    });
    expect(
      hasCreateWorkspaceSessionChanges({
        form: { title: "Original", property_type: "house" },
        baseline,
        remoteImages: baseline.remoteImages,
      })
    ).toBe(false);
    expect(
      hasCreateWorkspaceSessionChanges({
        form: { title: "Changed", property_type: "house" },
        baseline,
        remoteImages: baseline.remoteImages,
      })
    ).toBe(true);
    expect(
      hasCreateWorkspaceSessionChanges({
        form: baseline.form,
        baseline,
        remoteImages: [{ id: "img-2", image_url: "https://example.test/b.webp", position: 0 }],
      })
    ).toBe(true);
    expect(
      hasCreateWorkspaceSessionChanges({
        form: baseline.form,
        baseline,
        remoteImages: baseline.remoteImages,
        pendingUploadCount: 1,
      })
    ).toBe(true);
  });

  test("preserves zero-value numeric fields in snapshots", () => {
    const snapshot = serializeCreateWorkspaceForm({
      beds: "0",
      baths: "0",
      garage: "0",
      square_feet: "0",
      property_type: "land",
      listing_type: "sale",
    });
    expect(snapshot).toContain('"beds":"0"');
    expect(snapshot).toContain('"garage":"0"');
  });

  test("session-created drafts discard; pre-existing drafts restore", () => {
    expect(
      resolveCreateWorkspaceExitAction({
        openedWithDraftId: "",
        draftCreatedInSession: true,
        draftListingId: "draft-1",
      })
    ).toBe("discard_session_draft");
    expect(
      resolveCreateWorkspaceExitAction({
        openedWithDraftId: "draft-9",
        draftCreatedInSession: false,
        draftListingId: "draft-9",
      })
    ).toBe("restore_baseline");
    expect(
      resolveCreateWorkspaceExitAction({
        openedWithDraftId: "draft-9",
        draftCreatedInSession: true,
        draftListingId: "draft-9",
      })
    ).toBe("restore_baseline");
  });

  test("exit copy distinguishes create and edit modes", () => {
    expect(
      resolveCreateWorkspaceExitCopy({ exitAction: "discard_session_draft", isEditingExistingListing: false })
        .body
    ).toContain("new draft data");
    expect(
      resolveCreateWorkspaceExitCopy({ exitAction: "restore_baseline", isEditingExistingListing: true })
        .body
    ).toContain("published listing will remain unchanged");
  });

  test("maps cleanup failures to friendly errors", () => {
    expect(mapCreateWorkspaceExitError(new Error("Only drafts can be discarded from here."))).not.toMatch(
      /SQL|RPC|trigger/i
    );
    expect(mapCreateWorkspaceExitError(new Error("permission denied for table listings"))).toBe(
      "Unable to exit without saving. Please try again."
    );
  });

  test("image snapshot ordering is stable", () => {
    const a = serializeRemoteImageSnapshot([
      { id: "2", position: 1, image_url: "b.webp" },
      { id: "1", position: 0, image_url: "a.webp" },
    ]);
    const b = serializeRemoteImageSnapshot([
      { id: "1", position: 0, image_url: "a.webp" },
      { id: "2", position: 1, image_url: "b.webp" },
    ]);
    expect(a).toBe(b);
  });
});
