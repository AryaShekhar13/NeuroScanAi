import { MRI_MODALITIES } from "@/lib/mriModalities";

export type MriModalityId = (typeof MRI_MODALITIES)[number]["id"];

export type MriVolume = {
  modality: MriModalityId;
  spriteUrl: string;
  totalSlices: number;
  columns: number;
  rows: number;
  tileWidth: number;
  tileHeight: number;
  sourceDimensions: readonly [number, number, number];
  source: "reference-nifti-preview";
};

const REFERENCE_VOLUME_META = {
  flair: "/manus-storage/brats-001-flair-axial-sprite_bb8a89be.webp",
  t1: "/manus-storage/brats-001-t1-axial-sprite_88fb9ed4.webp",
  t1ce: "/manus-storage/brats-001-t1ce-axial-sprite_31589546.webp",
  t2: "/manus-storage/brats-001-t2-axial-sprite_a44ee832.webp",
} satisfies Record<MriModalityId, string>;

const sourceDimensions = [240, 240, 155] as const;

export const REFERENCE_MRI_VOLUMES: Record<MriModalityId, MriVolume> = MRI_MODALITIES.reduce((volumes, modality) => {
  volumes[modality.id] = {
    modality: modality.id,
    spriteUrl: REFERENCE_VOLUME_META[modality.id],
    totalSlices: sourceDimensions[2],
    columns: 5,
    rows: 31,
    tileWidth: sourceDimensions[0],
    tileHeight: sourceDimensions[1],
    sourceDimensions,
    source: "reference-nifti-preview",
  };
  return volumes;
}, {} as Record<MriModalityId, MriVolume>);

export function clampSliceIndex(index: number, totalSlices: number) {
  return Math.min(Math.max(index, 0), Math.max(totalSlices - 1, 0));
}

export function neighboringSliceIndices(index: number, totalSlices: number) {
  return Array.from(new Set([index - 1, index, index + 1].map((candidate) => clampSliceIndex(candidate, totalSlices))));
}

export function nextSliceIndex(index: number, totalSlices: number) {
  return clampSliceIndex(index + 1, totalSlices);
}

export function previousSliceIndex(index: number, totalSlices: number) {
  return clampSliceIndex(index - 1, totalSlices);
}

export function sliceIndexForKey(key: string, index: number, totalSlices: number) {
  if (key === "ArrowRight") return nextSliceIndex(index, totalSlices);
  if (key === "ArrowLeft") return previousSliceIndex(index, totalSlices);
  if (key === "Home") return 0;
  if (key === "End") return Math.max(totalSlices - 1, 0);
  return null;
}

export function referenceSliceBackground(volume: MriVolume, index: number) {
  const safeIndex = clampSliceIndex(index, volume.totalSlices);
  const column = safeIndex % volume.columns;
  const row = Math.floor(safeIndex / volume.columns);
  return {
    backgroundImage: `url("${volume.spriteUrl}")`,
    backgroundPosition: `${volume.columns === 1 ? 0 : (column / (volume.columns - 1)) * 100}% ${volume.rows === 1 ? 0 : (row / (volume.rows - 1)) * 100}%`,
    backgroundSize: `${volume.columns * 100}% ${volume.rows * 100}%`,
  };
}
