import { MRI_MODALITIES } from "@/lib/mriModalities";

export type MriModalityId = (typeof MRI_MODALITIES)[number]["id"];

export type MriSlice = {
  index: number;
  url: string;
};

export type MriVolume = {
  modality: MriModalityId;
  totalSlices: number;
  slices: MriSlice[];
  source: "synthetic-demo";
};

// These paths are explicitly ordered by their numeric slice index rather than a file-system listing.
export const SYNTHETIC_DEMO_SLICE_URLS = [
  "/manus-storage/slice_001_660ae647.png", "/manus-storage/slice_002_d726f4d2.png", "/manus-storage/slice_003_2bf16dcf.png", "/manus-storage/slice_004_65c1a950.png", "/manus-storage/slice_005_1bdc4378.png",
  "/manus-storage/slice_006_7dd067c8.png", "/manus-storage/slice_007_a5575363.png", "/manus-storage/slice_008_e66eee0c.png", "/manus-storage/slice_009_186e3cf4.png", "/manus-storage/slice_010_a96358ad.png",
  "/manus-storage/slice_011_1e79b876.png", "/manus-storage/slice_012_01857dc0.png", "/manus-storage/slice_013_89d0f03f.png", "/manus-storage/slice_014_2a950f2c.png", "/manus-storage/slice_015_f98f55af.png",
  "/manus-storage/slice_016_57a8e997.png", "/manus-storage/slice_017_ea040502.png", "/manus-storage/slice_018_340f14c7.png", "/manus-storage/slice_019_c8b1aaad.png", "/manus-storage/slice_020_a8e5f8b5.png",
  "/manus-storage/slice_021_7888952a.png", "/manus-storage/slice_022_bd3dfaca.png", "/manus-storage/slice_023_5c1db0dd.png", "/manus-storage/slice_024_1292cecc.png", "/manus-storage/slice_025_a99d50a7.png",
  "/manus-storage/slice_026_d0dfa1e2.png", "/manus-storage/slice_027_d1d68829.png", "/manus-storage/slice_028_acf46231.png", "/manus-storage/slice_029_82114c4d.png", "/manus-storage/slice_030_79a56650.png",
  "/manus-storage/slice_031_d1c721a8.png", "/manus-storage/slice_032_94353aba.png", "/manus-storage/slice_033_29a18041.png", "/manus-storage/slice_034_f156d4f5.png", "/manus-storage/slice_035_ac04ebe0.png",
  "/manus-storage/slice_036_2e9ab53a.png", "/manus-storage/slice_037_d3d8e70c.png", "/manus-storage/slice_038_ba2876e0.png", "/manus-storage/slice_039_b3d085c8.png", "/manus-storage/slice_040_2bb470cb.png",
  "/manus-storage/slice_041_24db15fb.png", "/manus-storage/slice_042_17209fe9.png", "/manus-storage/slice_043_6e45f556.png", "/manus-storage/slice_044_de9c2851.png", "/manus-storage/slice_045_80b984a3.png",
  "/manus-storage/slice_046_abb05365.png", "/manus-storage/slice_047_8b61989b.png", "/manus-storage/slice_048_3bc175d5.png", "/manus-storage/slice_049_50100162.png", "/manus-storage/slice_050_e57b09b6.png",
  "/manus-storage/slice_051_30d32c2c.png", "/manus-storage/slice_052_8ba90ce6.png", "/manus-storage/slice_053_89b0a804.png", "/manus-storage/slice_054_d15020db.png", "/manus-storage/slice_055_b9a7f082.png",
  "/manus-storage/slice_056_540e0746.png", "/manus-storage/slice_057_13441b02.png", "/manus-storage/slice_058_8f711c6c.png", "/manus-storage/slice_059_ba3d497b.png", "/manus-storage/slice_060_d62d2bf2.png",
] as const;

const demoSlices = SYNTHETIC_DEMO_SLICE_URLS.map((url, index) => ({ index, url }));

export const SYNTHETIC_DEMO_VOLUMES: Record<MriModalityId, MriVolume> = MRI_MODALITIES.reduce((volumes, modality) => {
  volumes[modality.id] = { modality: modality.id, totalSlices: demoSlices.length, slices: demoSlices, source: "synthetic-demo" };
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
