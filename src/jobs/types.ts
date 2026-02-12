/**
 * Job system types and utilities
 */

import { createHash } from "crypto";
import type { GenerationRequest } from "../media/types.js";

/**
 * Generate an idempotency key from request content.
 * SHA256 of brandId + mediaType + format + content values + image hashes + parentId + customPrompt
 */
export function generateIdempotencyKey(
  request: GenerationRequest,
  format: string,
  imageHashes?: string[]
): string {
  const parts = [
    request.brandId,
    request.mediaType,
    format,
    JSON.stringify(request.content),
    ...(imageHashes ?? []),
    request.parentId ?? "",
    request.customPrompt ?? "",
    request.style ?? "",
  ];

  return createHash("sha256").update(parts.join("|")).digest("hex");
}

/**
 * Generate a content hash for a buffer
 */
export function hashBuffer(buffer: Buffer): string {
  return createHash("sha256").update(buffer).digest("hex");
}

/**
 * Generate a content hash for a string (e.g., prompt)
 */
export function hashString(str: string): string {
  return createHash("sha256").update(str).digest("hex");
}
