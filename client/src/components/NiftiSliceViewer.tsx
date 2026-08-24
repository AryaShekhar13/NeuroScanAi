import { LoaderCircle } from "lucide-react";
import { useEffect, useRef, useState } from "react";
import { createDerivedPngArtifact, type DerivedPngArtifact } from "@/lib/niftiPreview";

type NiftiVolume = { dimensions: [number, number, number]; getValue: (index: number) => number };
type Source = { url: string; fileName: string; metadata?: unknown };

async function decompressGzip(bytes: ArrayBuffer) {
  if (typeof DecompressionStream === "undefined") throw new Error("This browser cannot decompress compressed NIfTI files for preview.");
  return new Response(new Blob([bytes]).stream().pipeThrough(new DecompressionStream("gzip"))).arrayBuffer();
}

function decodeNifti(buffer: ArrayBuffer): NiftiVolume {
  const view = new DataView(buffer); const littleEndian = view.getInt32(0, true) === 348;
  if (!littleEndian && view.getInt32(0, false) !== 348) throw new Error("The stored file is not a valid NIfTI-1 volume.");
  const read16 = (offset: number) => view.getInt16(offset, littleEndian); const read32 = (offset: number) => view.getInt32(offset, littleEndian); const readFloat = (offset: number) => view.getFloat32(offset, littleEndian);
  const dimensions = [read16(42), read16(44), read16(46)] as [number, number, number]; const dataType = read16(70); const bitPix = read16(72); const offset = Math.max(352, Math.floor(readFloat(108)));
  const voxels = dimensions[0] * dimensions[1] * dimensions[2]; const bytesPerVoxel = bitPix / 8;
  if (dimensions.some((value) => value <= 0) || !Number.isInteger(bytesPerVoxel) || offset + voxels * bytesPerVoxel > buffer.byteLength) throw new Error("The stored NIfTI volume has unsupported dimensions.");
  const getValue = (index: number) => { const position = offset + index * bytesPerVoxel; if (dataType === 2) return view.getUint8(position); if (dataType === 4) return view.getInt16(position, littleEndian); if (dataType === 512) return view.getUint16(position, littleEndian); if (dataType === 8) return read32(position); if (dataType === 16) return readFloat(position); if (dataType === 64) return view.getFloat64(position, littleEndian); throw new Error("The stored NIfTI datatype is not supported for preview."); };
  return { dimensions, getValue };
}

async function loadVolume(source: Source) { const response = await fetch(source.url); if (!response.ok) throw new Error("The stored NIfTI volume could not be loaded for preview."); return decodeNifti(await decompressGzip(await response.arrayBuffer())); }

export default function NiftiSliceViewer({ source, segmentation }: { source: Source; segmentation: Source | null }) {
  const canvasRef = useRef<HTMLCanvasElement>(null); const [volume, setVolume] = useState<NiftiVolume | null>(null); const [mask, setMask] = useState<NiftiVolume | null>(null); const [slice, setSlice] = useState(0); const [error, setError] = useState<string | null>(null); const [derivedPng, setDerivedPng] = useState<DerivedPngArtifact | null>(null);
  useEffect(() => { let live = true; setVolume(null); setMask(null); setError(null); setDerivedPng(null); void Promise.all([loadVolume(source), segmentation ? loadVolume(segmentation) : Promise.resolve(null)]).then(([nextVolume, nextMask]) => { if (!live) return; if (nextMask && nextMask.dimensions.some((value, index) => value !== nextVolume.dimensions[index])) throw new Error("The stored segmentation mask is not aligned with the source MRI volume."); setVolume(nextVolume); setMask(nextMask); setSlice(Math.floor(nextVolume.dimensions[2] / 2)); }).catch((reason: unknown) => { if (live) setError(reason instanceof Error ? reason.message : "The NIfTI preview could not be prepared."); }); return () => { live = false; }; }, [source.url, segmentation?.url]);
  useEffect(() => { if (!volume || !canvasRef.current) return; const [width, height] = volume.dimensions; const canvas = canvasRef.current; canvas.width = width; canvas.height = height; const context = canvas.getContext("2d"); if (!context) return; const pixels = context.createImageData(width, height); const start = slice * width * height; let min = Infinity; let max = -Infinity; for (let index = 0; index < width * height; index += 1) { const value = volume.getValue(start + index); min = Math.min(min, value); max = Math.max(max, value); } const range = Math.max(max - min, 0.00001); for (let index = 0; index < width * height; index += 1) { const intensity = Math.max(0, Math.min(255, Math.round(((volume.getValue(start + index) - min) / range) * 255))); const base = index * 4; pixels.data[base] = intensity; pixels.data[base + 1] = intensity; pixels.data[base + 2] = intensity; pixels.data[base + 3] = 255; if (mask && mask.getValue(start + index) > 0) { pixels.data[base] = 230; pixels.data[base + 1] = Math.round(intensity * 0.35); pixels.data[base + 2] = 255; } } context.putImageData(pixels, 0, 0); try { setDerivedPng(createDerivedPngArtifact(canvas, source.fileName, slice)); } catch (reason) { setError(reason instanceof Error ? reason.message : "The NIfTI preview could not be encoded as PNG."); } }, [volume, mask, slice, source.fileName]);
  if (error) return <div className="mri-slice-viewer-error">{error}</div>;
  if (!volume) return <div className="mri-slice-viewer-loading"><LoaderCircle className="spin-icon" size={18} /> Preparing NIfTI-derived preview…</div>;
  return <section className="mri-slice-viewer"><canvas ref={canvasRef} aria-label={`NIfTI-derived axial MRI slice ${slice + 1} of ${volume.dimensions[2]}`} /><div className="mri-slice-caption"><span>NIfTI-derived axial preview · {source.fileName}</span><span>Slice {slice + 1} / {volume.dimensions[2]}</span></div><label className="mri-slice-range">Slice <input type="range" min="0" max={volume.dimensions[2] - 1} value={slice} onChange={(event) => setSlice(Number(event.target.value))} /></label><p>{mask ? "Overlay is derived from the stored authoritative NIfTI segmentation mask." : "No authoritative segmentation NIfTI mask has been stored for this study."}</p>{derivedPng && <a className="derived-png-export" href={derivedPng.dataUrl} download={derivedPng.fileName}>Download derived PNG preview</a>}</section>;
}
