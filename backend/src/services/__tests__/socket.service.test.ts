import { describe, it, expect, vi, beforeEach } from "vitest";

// We test the emit helpers which depend on the module-level `io` variable.
// Since io starts as null and is set by initializeSocket, we test:
// 1. Emit functions are no-ops when io is null
// 2. getIO throws when not initialized

import {
  getIO,
  emitClipUpdate,
  emitClipsRefresh,
  emitNewAnnouncement,
  emitComfyJobUpdate,
  emitScriptJobUpdate,
  emitUGCVideoJobUpdate,
  emitAdCloneJobUpdate,
} from "../socket.service";

describe("socket.service (without initialization)", () => {
  it("getIO throws when socket not initialized", () => {
    expect(() => getIO()).toThrow("Socket.io not initialized");
  });

  it("emitClipUpdate is a no-op when io is null", () => {
    // Should not throw
    expect(() => emitClipUpdate(1, { id: 1 })).not.toThrow();
  });

  it("emitClipsRefresh is a no-op when io is null", () => {
    expect(() => emitClipsRefresh(1)).not.toThrow();
  });

  it("emitNewAnnouncement is a no-op when io is null", () => {
    expect(() =>
      emitNewAnnouncement({ id: 1, title: "Test", priority: "info", published_at: null })
    ).not.toThrow();
  });

  it("emitComfyJobUpdate is a no-op when io is null", () => {
    expect(() =>
      emitComfyJobUpdate(1, {
        id: "j1",
        status: "completed",
        progress: 100,
        progressMessage: null,
        outputUrl: null,
        errorMessage: null,
        finishedAt: null,
      })
    ).not.toThrow();
  });

  it("emitScriptJobUpdate is a no-op when io is null", () => {
    expect(() =>
      emitScriptJobUpdate(1, {
        scriptId: "s1",
        status: "completed",
        progress: 100,
        progressMessage: "Done",
      })
    ).not.toThrow();
  });

  it("emitUGCVideoJobUpdate is a no-op when io is null", () => {
    expect(() =>
      emitUGCVideoJobUpdate(1, {
        jobId: "j1",
        status: "completed",
        progress: 100,
        progressMessage: "Done",
      })
    ).not.toThrow();
  });

  it("emitAdCloneJobUpdate is a no-op when io is null", () => {
    expect(() =>
      emitAdCloneJobUpdate(1, {
        projectId: "p1",
        status: "completed",
        progress: 100,
        progressMessage: "Done",
      })
    ).not.toThrow();
  });
});
