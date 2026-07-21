interface DragScrollBounds {
  bottom: number;
  left: number;
  right: number;
  top: number;
}

const EDGE_SIZE = 40;
const SCROLL_STEP = 24;

export function dragScrollDelta(
  bounds: DragScrollBounds,
  x: number,
  y: number,
): { x: number; y: number } {
  return {
    x:
      x < bounds.left + EDGE_SIZE
        ? -SCROLL_STEP
        : x > bounds.right - EDGE_SIZE
          ? SCROLL_STEP
          : 0,
    y:
      y < bounds.top + EDGE_SIZE
        ? -SCROLL_STEP
        : y > bounds.bottom - EDGE_SIZE
          ? SCROLL_STEP
          : 0,
  };
}

export function autoScrollCardRow(
  target: Element | null,
  x: number,
  y: number,
): boolean {
  const row = target?.closest<HTMLElement>("[data-zone-scroll]");
  if (row === null || row === undefined) return false;
  const delta = dragScrollDelta(row.getBoundingClientRect(), x, y);
  if (delta.x === 0 && delta.y === 0) return false;
  const previousLeft = row.scrollLeft;
  const previousTop = row.scrollTop;
  row.scrollBy(delta.x, delta.y);
  return row.scrollLeft !== previousLeft || row.scrollTop !== previousTop;
}
