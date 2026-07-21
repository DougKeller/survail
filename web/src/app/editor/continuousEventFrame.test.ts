import { describe, expect, it, vi } from "vitest";

import { createLatestFrame } from "../../core/continuousEventFrame";

describe("createLatestFrame", () => {
  it("coalesces continuous input and processes only the latest value per frame", () => {
    const frames: FrameRequestCallback[] = [];
    const requestFrame = vi.fn((callback: FrameRequestCallback) => {
      frames.push(callback);
      return 1;
    });
    const process = vi.fn();
    const scheduler = createLatestFrame(process, requestFrame, vi.fn());

    scheduler.push({ x: 1, y: 1 });
    scheduler.push({ x: 2, y: 2 });
    scheduler.push({ x: 3, y: 3 });

    expect(requestFrame).toHaveBeenCalledOnce();
    expect(process).not.toHaveBeenCalled();
    const frame = frames[0];
    if (frame === undefined) throw new Error("Expected a scheduled frame");
    frame(0);
    expect(process).toHaveBeenCalledOnce();
    expect(process).toHaveBeenCalledWith({ x: 3, y: 3 });
  });

  it("cancels queued work during cleanup", () => {
    const cancelFrame = vi.fn();
    const process = vi.fn();
    const scheduler = createLatestFrame(
      process,
      vi.fn(() => 7),
      cancelFrame,
    );

    scheduler.push("queued");
    scheduler.cancel();

    expect(cancelFrame).toHaveBeenCalledWith(7);
    expect(process).not.toHaveBeenCalled();
  });
});
