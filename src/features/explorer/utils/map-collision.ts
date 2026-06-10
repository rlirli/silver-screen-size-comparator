export interface CollisionBox {
  id: string;
  x: number; // current x pixel coordinate
  y: number; // current y pixel coordinate
  ox: number; // original x pixel coordinate
  oy: number; // original y pixel coordinate
  width: number;
  height: number;
}

/**
 * Resolves overlaps between rectangular boxes using a simple relaxation solver.
 * Also pulls boxes slightly back to their original anchors to avoid wandering.
 */
export function resolveCollisions(boxes: CollisionBox[], iterations = 40): CollisionBox[] {
  const result = boxes.map((b) => ({ ...b }));
  const padding = 15; // px padding between boxes

  for (let iter = 0; iter < iterations; iter++) {
    let hasCollision = false;

    for (let i = 0; i < result.length; i++) {
      for (let j = i + 1; j < result.length; j++) {
        const bi = result[i];
        const bj = result[j];

        // Calculate distances on X and Y axes
        const dx = bj.x - bi.x;
        const dy = bj.y - bi.y;

        // Minimum distance required on X and Y axes to prevent overlap
        const minX = (bi.width + bj.width) / 2 + padding;
        const minY = (bi.height + bj.height) / 2 + padding;

        const absDx = Math.abs(dx);
        const absDy = Math.abs(dy);

        // Check if there is overlap on both axes
        if (absDx < minX && absDy < minY) {
          hasCollision = true;

          // Compute overlap amounts
          const overlapX = minX - absDx;
          const overlapY = minY - absDy;

          // Push boxes apart in the direction of the smaller overlap
          if (overlapX < overlapY) {
            const forceX = overlapX / 2;
            const direction = dx >= 0 ? 1 : -1;
            bj.x += forceX * direction;
            bi.x -= forceX * direction;
          } else {
            const forceY = overlapY / 2;
            const direction = dy >= 0 ? 1 : -1;
            bj.y += forceY * direction;
            bi.y -= forceY * direction;
          }
        }
      }
    }

    // Apply a weak gravity pull back to the original anchor coordinate
    for (const b of result) {
      const pullForce = 0.12;
      b.x += (b.ox - b.x) * pullForce;
      b.y += (b.oy - b.y) * pullForce;
    }

    // Early exit if no overlaps detected in this iteration
    if (!hasCollision) break;
  }

  return result;
}
export type { CollisionBox as CollisionBoxType };
