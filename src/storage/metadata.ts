/**
 * Structured metadata read/write (JSON sidecar)
 *
 * Includes schema migration support.
 */

import { readFileSync, writeFileSync, renameSync, existsSync } from "fs";
import type { MediaRecord } from "../media/types.js";

const CURRENT_SCHEMA_VERSION = 1;

/**
 * Read a metadata sidecar file and migrate to current schema if needed
 */
export function readMetadata(filePath: string): MediaRecord {
  const raw = readFileSync(filePath, "utf-8");
  const record = JSON.parse(raw);
  return migrate(record);
}

/**
 * Write a metadata sidecar file atomically (write to .tmp, rename over original)
 */
export function writeMetadata(
  filePath: string,
  record: MediaRecord,
  backup = false
): void {
  const tmpPath = filePath + ".tmp";

  // Write to temp file
  writeFileSync(tmpPath, JSON.stringify(record, null, 2), "utf-8");

  // Backup existing file if requested
  if (backup && existsSync(filePath)) {
    const bakPath = filePath + ".bak";
    renameSync(filePath, bakPath);
  }

  // Atomic rename
  renameSync(tmpPath, filePath);
}

/**
 * Migrate a metadata record to the current schema version.
 * Runs lazily on read.
 */
export function migrate(record: any): MediaRecord {
  let version = record.schemaVersion ?? 0;

  // Migration chain: each case falls through to the next
  if (version < 1) {
    // v0 → v1: Add schemaVersion, ensure all required fields
    record.schemaVersion = 1;
    record.tags = record.tags ?? [];
    record.sourceInputs = record.sourceInputs ?? [];
    record.version = record.version ?? 1;
    record.status = record.status ?? "generated";
    version = 1;
  }

  // Future migrations would go here:
  // if (version < 2) { ... }

  return record as MediaRecord;
}

export { CURRENT_SCHEMA_VERSION };
