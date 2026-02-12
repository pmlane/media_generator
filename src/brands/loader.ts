/**
 * Brand profile loader
 * Loads YAML brand profiles, validates with Zod, resolves asset paths
 */

import { readFileSync, existsSync, readdirSync } from "fs";
import path from "path";
import yaml from "js-yaml";
import { brandProfileSchema } from "./schema.js";
import type { BrandProfile } from "../media/types.js";

const BRANDS_DIR = path.resolve(
  import.meta.dirname ?? path.dirname(new URL(import.meta.url).pathname),
  "../../brands"
);

/**
 * Load and validate a brand profile from YAML
 */
export function loadBrand(brandId: string, brandsDir?: string): BrandProfile {
  const dir = brandsDir ?? BRANDS_DIR;
  const filePath = path.join(dir, `${brandId}.yaml`);

  if (!existsSync(filePath)) {
    throw new Error(`Brand profile not found: ${filePath}`);
  }

  const raw = readFileSync(filePath, "utf-8");
  const data = yaml.load(raw);

  const result = brandProfileSchema.safeParse(data);
  if (!result.success) {
    const issues = result.error.issues
      .map((i) => `  ${i.path.join(".")}: ${i.message}`)
      .join("\n");
    throw new Error(`Invalid brand profile "${brandId}":\n${issues}`);
  }

  const brand = result.data as BrandProfile;

  // Resolve logo paths relative to the brand YAML file
  for (const logo of brand.logos) {
    logo.resolvedPath = path.resolve(dir, logo.path);
  }

  // Resolve additional asset paths
  if (brand.additional_assets) {
    for (const asset of brand.additional_assets) {
      asset.resolvedPath = path.resolve(dir, asset.path);
    }
  }

  return brand;
}

/**
 * List available brand IDs by scanning the brands directory
 */
export function listBrands(brandsDir?: string): string[] {
  const dir = brandsDir ?? BRANDS_DIR;
  return readdirSync(dir)
    .filter((f) => f.endsWith(".yaml") || f.endsWith(".yml"))
    .map((f) => f.replace(/\.ya?ml$/, ""));
}

/**
 * Validate that all resolved asset paths exist on disk
 */
export function validateBrandAssets(
  brand: BrandProfile
): { valid: boolean; missing: string[] } {
  const missing: string[] = [];

  for (const logo of brand.logos) {
    if (logo.resolvedPath && !existsSync(logo.resolvedPath)) {
      missing.push(`logo "${logo.id}": ${logo.resolvedPath}`);
    }
  }

  if (brand.additional_assets) {
    for (const asset of brand.additional_assets) {
      if (asset.resolvedPath && !existsSync(asset.resolvedPath)) {
        missing.push(`asset "${asset.id}": ${asset.resolvedPath}`);
      }
    }
  }

  return { valid: missing.length === 0, missing };
}
