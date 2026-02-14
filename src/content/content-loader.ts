/**
 * Content loader - parse menu text files, read images
 */

import { readFileSync, existsSync } from "fs";
import path from "path";
import type { MenuContent, MenuSection, MenuItem } from "../media/types.js";

/**
 * Parse a plain text menu file into structured MenuContent.
 *
 * Format:
 *   Section Name
 *   Item Name - $Price
 *   Item Name - $Price (description)
 *
 *   Next Section
 *   ...
 *
 * Sections are separated by blank lines.
 * The first non-blank line after a blank line (or at start) is a section header.
 */
export function parseMenuText(text: string, title = "Menu"): MenuContent {
  const lines = text.split("\n");
  const sections: MenuSection[] = [];
  let currentSection: MenuSection | null = null;

  for (const rawLine of lines) {
    const line = rawLine.trim();

    if (!line) {
      // Blank line = end of current section
      if (currentSection && currentSection.items.length > 0) {
        sections.push(currentSection);
        currentSection = null;
      }
      continue;
    }

    // Try to parse as menu item first
    const item = parseMenuItem(line);

    if (!currentSection) {
      if (item) {
        // Line looks like a menu item but no section yet - create default section
        currentSection = { title, items: [item] };
      } else {
        // Line is a section header
        currentSection = { title: line, items: [] };
      }
      continue;
    }

    if (item) {
      currentSection.items.push(item);
    } else {
      // Not a menu item - treat as a new section header
      if (currentSection.items.length > 0) {
        sections.push(currentSection);
      }
      currentSection = { title: line, items: [] };
    }
  }

  // Push final section
  if (currentSection && currentSection.items.length > 0) {
    sections.push(currentSection);
  }

  // If no sections were created, put everything as items in a default section
  if (sections.length === 0) {
    const items: MenuItem[] = [];
    for (const rawLine of lines) {
      const line = rawLine.trim();
      if (!line) continue;
      const item = parseMenuItem(line);
      if (item) {
        items.push(item);
      }
    }
    if (items.length > 0) {
      sections.push({ title, items });
    }
  }

  return { title, sections };
}

/**
 * Parse a single menu item line.
 * Formats:
 *   "Name - $Price"
 *   "Name — $Price"
 *   "Name - $Price (description)"
 *   "Name $Price"
 *   "Name - Description" (no price)
 */
function parseMenuItem(line: string): MenuItem | null {
  // Pattern: Name [-—] $Price [(description)]
  const dashPriceMatch = line.match(
    /^(.+?)\s*[-—]+\s*(\$[\d.]+)\s*(?:\((.+?)\))?\s*$/
  );
  if (dashPriceMatch) {
    return {
      name: dashPriceMatch[1].trim(),
      price: dashPriceMatch[2],
      description: dashPriceMatch[3]?.trim(),
    };
  }

  // Pattern: Name $Price
  const spaceMatch = line.match(/^(.+?)\s+(\$[\d.]+)\s*$/);
  if (spaceMatch) {
    return {
      name: spaceMatch[1].trim(),
      price: spaceMatch[2],
    };
  }

  // Pattern: Name - Description (no price, dash-separated)
  const dashDescMatch = line.match(/^(.+?)\s*[-—]+\s+(.+)$/);
  if (dashDescMatch) {
    return {
      name: dashDescMatch[1].trim(),
      description: dashDescMatch[2].trim(),
    };
  }

  // Pattern: Name (description) — last parenthesized group is description
  const parenDescMatch = line.match(/^(.+?)\s+\(([^)]+)\)\s*$/);
  if (parenDescMatch) {
    return {
      name: parenDescMatch[1].trim(),
      description: parenDescMatch[2].trim(),
    };
  }

  return null;
}

/**
 * Read a text file and parse it as a menu
 */
export function loadMenuFile(filePath: string, title?: string): MenuContent {
  if (!existsSync(filePath)) {
    throw new Error(`Menu file not found: ${filePath}`);
  }
  const text = readFileSync(filePath, "utf-8");
  return parseMenuText(text, title);
}

/**
 * Load an image file and return its buffer and MIME type
 */
export function loadImageFile(
  filePath: string
): { data: Buffer; mimeType: string } | null {
  if (!existsSync(filePath)) {
    return null;
  }

  const ext = path.extname(filePath).toLowerCase();
  let mimeType = "image/png";
  if (ext === ".jpg" || ext === ".jpeg") mimeType = "image/jpeg";
  else if (ext === ".webp") mimeType = "image/webp";
  else if (ext === ".svg") mimeType = "image/svg+xml";

  const data = readFileSync(filePath);
  return { data, mimeType };
}
