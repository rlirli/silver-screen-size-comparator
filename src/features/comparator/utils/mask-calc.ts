/**
 * Calculates the maximum area fitting a target aspect ratio inside a physical screen.
 * Fits to height if physical screen is wider than the target mask (pillarboxing).
 * Fits to width if physical screen is taller than the target mask (letterboxing).
 */
export function calculateMaskedDimensions(
  widthMeters: number,
  heightMeters: number,
  maskRatioStr: string,
) {
  if (!maskRatioStr || maskRatioStr === "none") {
    return {
      width: widthMeters,
      height: heightMeters,
      area: widthMeters * heightMeters,
      isMasked: false,
    };
  }

  const maskRatio = parseFloat(maskRatioStr);
  if (isNaN(maskRatio) || maskRatio <= 0) {
    return {
      width: widthMeters,
      height: heightMeters,
      area: widthMeters * heightMeters,
      isMasked: false,
    };
  }

  const physicalRatio = widthMeters / heightMeters;

  let croppedWidth = widthMeters;
  let croppedHeight = heightMeters;

  if (physicalRatio > maskRatio) {
    // Physical screen is wider than the mask: pillarboxing
    // Height is preserved, width is reduced to fit mask ratio
    croppedHeight = heightMeters;
    croppedWidth = heightMeters * maskRatio;
  } else if (physicalRatio < maskRatio) {
    // Physical screen is taller than the mask: letterboxing
    // Width is preserved, height is reduced to fit mask ratio
    croppedWidth = widthMeters;
    croppedHeight = widthMeters / maskRatio;
  }

  return {
    width: croppedWidth,
    height: croppedHeight,
    area: croppedWidth * croppedHeight,
    isMasked: true,
  };
}
export type MaskedDimensions = ReturnType<typeof calculateMaskedDimensions>;
