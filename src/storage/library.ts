/**
 * Media library - query, filter, and search generated media
 */

import { readdirSync, existsSync } from "fs";
import path from "path";
import { readMetadata, writeMetadata } from "./metadata.js";
import type { MediaRecord, MediaType } from "../media/types.js";

interface LibraryQuery {
  brandId?: string;
  mediaType?: MediaType;
  campaign?: string;
  tags?: string[];
  since?: string;
  status?: MediaRecord["status"];
}

/**
 * Query the media library by scanning output directory metadata sidecars
 */
export function queryLibrary(
  query: LibraryQuery,
  outputDir = "output"
): MediaRecord[] {
  if (!existsSync(outputDir)) return [];

  const records: MediaRecord[] = [];
  scanDirectory(outputDir, records);

  return records.filter((record) => {
    if (query.brandId && record.brandId !== query.brandId) return false;
    if (query.mediaType && record.mediaType !== query.mediaType) return false;
    if (query.campaign && record.campaign !== query.campaign) return false;
    if (query.status && record.status !== query.status) return false;
    if (query.since && record.generatedAt < query.since) return false;
    if (query.tags?.length) {
      const hasAllTags = query.tags.every((t) => record.tags.includes(t));
      if (!hasAllTags) return false;
    }
    return true;
  });
}

/**
 * Find a single record by ID
 */
export function findById(
  id: string,
  outputDir = "output"
): MediaRecord | undefined {
  if (!existsSync(outputDir)) return undefined;

  const records: MediaRecord[] = [];
  scanDirectory(outputDir, records);

  return records.find((r) => r.id === id);
}

/**
 * Update a record's status (e.g., approve, reject, archive)
 */
export function updateRecordStatus(
  id: string,
  status: MediaRecord["status"],
  outputDir = "output",
  approvedBy?: string
): MediaRecord | undefined {
  const record = findById(id, outputDir);
  if (!record) return undefined;

  record.status = status;
  if (status === "approved") {
    record.approvedAt = new Date().toISOString();
    record.approvedBy = approvedBy;
  }

  // Write back
  const metadataPath = record.filePath.replace(/\.(png|jpg|jpeg)$/i, ".json");
  writeMetadata(metadataPath, record);

  return record;
}

function scanDirectory(dir: string, records: MediaRecord[]): void {
  const entries = readdirSync(dir, { withFileTypes: true });

  for (const entry of entries) {
    const fullPath = path.join(dir, entry.name);

    if (entry.isDirectory()) {
      scanDirectory(fullPath, records);
    } else if (entry.name.endsWith(".json") && !entry.name.endsWith(".tmp")) {
      try {
        const record = readMetadata(fullPath);
        records.push(record);
      } catch {
        // Skip invalid JSON files
      }
    }
  }
}
