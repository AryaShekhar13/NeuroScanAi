import type { CSSProperties } from "react";
import { REFERENCE_MRI_VOLUMES, referenceSliceBackground, type MriModalityId } from "@/lib/mriVolume";
import { MRI_MODALITIES } from "@/lib/mriModalities";

export function MriReferenceSlice({ modality, sliceIndex, className = "", labelPrefix = "Reference MRI" }: { modality: MriModalityId; sliceIndex: number; className?: string; labelPrefix?: string }) {
  const volume = REFERENCE_MRI_VOLUMES[modality];
  const detail = MRI_MODALITIES.find((candidate) => candidate.id === modality)!;
  return <div className={`mri-reference-slice ${className}`} role="img" aria-label={`${labelPrefix}: ${detail.label}, axial slice ${sliceIndex + 1} of ${volume.totalSlices}`} style={referenceSliceBackground(volume, sliceIndex) as CSSProperties} />;
}
