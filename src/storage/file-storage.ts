/**
 * File storage for generated media and metadata sidecars
 *
 * Directory structure: output/{brand}/{campaign|date}/{type}_{format}_v{n}.png
 */

import { writeFileSync, mkdirSync, existsSync, renameSync } from "fs";
import path from "path";
import type { MediaRecord, MediaType } from "../media/types.js";

interface SaveOptions {
  brandId: string;
  mediaType: MediaType;
  format: string;
  campaign?: string;
  version: number;
}

/**
 * Save a generated image to the output directory
 */
export function saveMedia(
  buffer: Buffer,
  options: SaveOptions,
  outputDir = "output"
): { filePath: string; fileSize: number } {
  const dir = buildOutputDir(outputDir, options);
  mkdirSync(dir, { recursive: true });

  const filename = buildFilename(options);
  const filePath = path.join(dir, filename);

  writeFileSync(filePath, buffer);

  return { filePath, fileSize: buffer.length };
}

/**
 * Save a metadata sidecar JSON alongside the image
 */
export function saveMetadata(record: MediaRecord, outputDir = "output"): void {
  const dir = path.dirname(record.filePath);

  // Ensure directory exists
  if (!existsSync(dir)) {
    mkdirSync(dir, { recursive: true });
  }

  const metadataPath = record.filePath.replace(/\.(png|jpg|jpeg)$/i, ".json");
  const tmpPath = metadataPath + ".tmp";

  // Atomic write
  writeFileSync(tmpPath, JSON.stringify(record, null, 2), "utf-8");
  renameSync(tmpPath, metadataPath);
}

function buildOutputDir(outputDir: string, options: SaveOptions): string {
  const datePart =
    options.campaign ?? new Date().toISOString().slice(0, 10);
  return path.join(outputDir, options.brandId, datePart);
}

function buildFilename(options: SaveOptions): string {
  const typePart = options.mediaType.replace("-", "_");
  const formatPart = options.format.toLowerCase();
  return `${typePart}_${formatPart}_v${options.version}.png`;
}
