export function clampDragPreviewPoint(
  x: number,
  y: number,
  viewportWidth: number,
  viewportHeight: number,
): { x: number; y: number } {
  const horizontalRoom = Math.max(0, viewportWidth - 132);
  const verticalRoom = Math.min(82, viewportHeight / 2);
  return {
    x: Math.min(Math.max(0, x), horizontalRoom),
    y: Math.min(Math.max(verticalRoom, y), viewportHeight - verticalRoom),
  };
}
