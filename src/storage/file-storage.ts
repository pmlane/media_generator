/**
 * File storage for generated media and metadata sidecars
 *
 * Directory structure:
 *   output/{brand}/{date}/                    — no campaign
 *   output/{brand}/{date}/{campaign}/         — with campaign
 *
 * Auto-increments version numbers by scanning existing files.
 */

import { writeFileSync, mkdirSync, existsSync, readdirSync, renameSync } from "fs";
import path from "path";
import type { MediaRecord, MediaType } from "../media/types.js";

export interface SaveOptions {
  brandId: string;
  mediaType: MediaType;
  format: string;
  campaign?: string;
  /** Explicit version. If omitted, auto-increments from existing files. */
  version?: number;
  /** Optional suffix appended before the extension, e.g. "background" */
  suffix?: string;
}

/**
 * Save a generated image to the output directory.
 * Returns the resolved file path, file size, and version used.
 */
export function saveMedia(
  buffer: Buffer,
  options: SaveOptions,
  outputDir = "output"
): { filePath: string; fileSize: number; version: number } {
  const dir = buildOutputDir(outputDir, options);
  mkdirSync(dir, { recursive: true });

  const version = options.version ?? nextVersion(dir, options);
  const filename = buildFilename({ ...options, version });
  const filePath = path.join(dir, filename);

  writeFileSync(filePath, buffer);

  return { filePath, fileSize: buffer.length, version };
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

/**
 * Scan existing files in the directory to determine the next version number.
 * Looks for files matching the same type/format/suffix pattern.
 */
function nextVersion(dir: string, options: SaveOptions): number {
  if (!existsSync(dir)) return 1;

  const typePart = options.mediaType.replace("-", "_");
  const formatPart = options.format.toLowerCase();
  const suffixPart = options.suffix ? `-${options.suffix}` : "";
  // Match: {type}_{format}_v{N}{suffix}.png
  const pattern = new RegExp(
    `^${typePart}_${formatPart}_v(\\d+)${suffixPart.replace("-", "\\-")}\\.png$`
  );

  let maxVersion = 0;
  for (const file of readdirSync(dir)) {
    const match = file.match(pattern);
    if (match) {
      maxVersion = Math.max(maxVersion, parseInt(match[1], 10));
    }
  }

  return maxVersion + 1;
}

/**
 * Build the output directory path.
 * Always uses date-based directories, with campaign as an optional subdirectory.
 */
function buildOutputDir(outputDir: string, options: SaveOptions): string {
  const datePart = new Date().toISOString().slice(0, 10);
  const base = path.join(outputDir, options.brandId, datePart);
  return options.campaign ? path.join(base, options.campaign) : base;
}

function buildFilename(options: SaveOptions & { version: number }): string {
  const typePart = options.mediaType.replace("-", "_");
  const formatPart = options.format.toLowerCase();
  const suffixPart = options.suffix ? `-${options.suffix}` : "";
  return `${typePart}_${formatPart}_v${options.version}${suffixPart}.png`;
}
