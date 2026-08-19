import { readFile } from "node:fs/promises";
import { gunzipSync } from "node:zlib";

const paths = process.argv.slice(2);
if (!paths.length) throw new Error("Provide one or more .nii.gz files to inspect.");

for (const path of paths) {
  const compressed = await readFile(path);
  const bytes = gunzipSync(compressed);
  if (bytes.length < 352) throw new Error(`${path}: file is too short for NIfTI-1.`);
  const littleEndian = bytes.readInt32LE(0) === 348;
  const bigEndian = bytes.readInt32BE(0) === 348;
  if (!littleEndian && !bigEndian) throw new Error(`${path}: invalid NIfTI-1 header.`);
  const int16 = (offset) => littleEndian ? bytes.readInt16LE(offset) : bytes.readInt16BE(offset);
  const float32 = (offset) => littleEndian ? bytes.readFloatLE(offset) : bytes.readFloatBE(offset);
  const dimensions = [int16(42), int16(44), int16(46)];
  const voxelSpacing = [float32(80), float32(84), float32(88)];
  const magic = bytes.subarray(344, 348).toString("latin1");
  console.log(JSON.stringify({ path, compressedBytes: compressed.length, uncompressedBytes: bytes.length, format: magic, endian: littleEndian ? "little" : "big", dimensions, voxelSpacing, datatype: int16(70), bitpix: int16(72), voxelOffset: float32(108) }));
}
