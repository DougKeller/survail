export interface LatestFrame<T> {
  cancel: () => void;
  push: (value: T) => void;
}

export function createLatestFrame<T>(
  process: (value: T) => void,
  requestFrame: (
    callback: FrameRequestCallback,
  ) => number = requestAnimationFrame,
  cancelFrame: (handle: number) => void = cancelAnimationFrame,
): LatestFrame<T> {
  let frameId: number | null = null;
  let hasValue = false;
  let latest: T;
  return {
    cancel: () => {
      if (frameId !== null) cancelFrame(frameId);
      frameId = null;
      hasValue = false;
    },
    push: (value) => {
      latest = value;
      hasValue = true;
      if (frameId !== null) return;
      frameId = requestFrame(() => {
        frameId = null;
        if (!hasValue) return;
        hasValue = false;
        process(latest);
      });
    },
  };
}

interface PointerPoint {
  x: number;
  y: number;
}

export function listenForPointerDrag(
  pointerId: number,
  handlers: {
    cancel: () => void;
    move: (point: PointerPoint) => void;
    up: (point: PointerPoint) => void;
  },
): () => void {
  const moves = createLatestFrame<PointerPoint>(handlers.move);
  const handleMove = (event: PointerEvent): void => {
    if (event.pointerId !== pointerId) return;
    event.preventDefault();
    moves.push({ x: event.clientX, y: event.clientY });
  };
  const handleUp = (event: PointerEvent): void => {
    if (event.pointerId !== pointerId) return;
    remove();
    handlers.up({ x: event.clientX, y: event.clientY });
  };
  const handleCancel = (event: PointerEvent): void => {
    if (event.pointerId !== pointerId) return;
    remove();
    handlers.cancel();
  };
  const remove = (): void => {
    moves.cancel();
    window.removeEventListener("pointermove", handleMove);
    window.removeEventListener("pointerup", handleUp);
    window.removeEventListener("pointercancel", handleCancel);
  };
  window.addEventListener("pointermove", handleMove, { passive: false });
  window.addEventListener("pointerup", handleUp);
  window.addEventListener("pointercancel", handleCancel);
  return remove;
}

export function listenForViewportChanges(
  update: () => void,
  captureScroll = false,
): () => void {
  const updates = createLatestFrame<void>(update);
  const schedule = (): void => {
    updates.push();
  };
  window.addEventListener("scroll", schedule, {
    capture: captureScroll,
    passive: true,
  });
  window.addEventListener("resize", schedule, { passive: true });
  return () => {
    updates.cancel();
    window.removeEventListener("scroll", schedule, captureScroll);
    window.removeEventListener("resize", schedule);
  };
}
