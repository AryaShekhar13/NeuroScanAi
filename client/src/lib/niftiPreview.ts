export type CanvasPngEncoder = { toDataURL: (type?: string) => string };
export type DerivedPngArtifact = { dataUrl: string; fileName: string; mediaType: "image/png"; provenance: "derived-from-nifti" };

export function createDerivedPngArtifact(canvas: CanvasPngEncoder, sourceFileName: string, slice: number): DerivedPngArtifact {
  const dataUrl = canvas.toDataURL("image/png");
  if (!/^data:image\/png;base64,[A-Za-z0-9+/=]+$/.test(dataUrl)) throw new Error("The browser could not create a PNG preview from the NIfTI slice.");
  return { dataUrl, fileName: `derived-${sourceFileName.replace(/\.nii\.gz$/i, "")}-slice-${slice + 1}.png`, mediaType: "image/png", provenance: "derived-from-nifti" };
}
