export const MRI_MODALITIES = [
  { id: "t1", label: "T1", detail: "Anatomical reference for structural review." },
  { id: "t1ce", label: "T1CE", detail: "Contrast-enhanced context for regions of interest." },
  { id: "t2", label: "T2", detail: "Fluid-sensitive context within the study." },
  { id: "flair", label: "FLAIR", detail: "Suppressed fluid view for additional tissue context." },
] as const;
