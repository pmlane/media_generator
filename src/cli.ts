#!/usr/bin/env node
/**
 * Media Maker CLI
 *
 * Generate branded media: event flyers, print menus, social posts
 */

import "dotenv/config";
import { Command } from "commander";
import { readFileSync, existsSync } from "fs";
import path from "path";
import { GenerationPipeline } from "./generation/pipeline.js";
import { loadBrand, listBrands, validateBrandAssets } from "./brands/loader.js";
import { queryLibrary, findById, updateRecordStatus } from "./storage/library.js";
import { parseMenuText, loadMenuFile } from "./content/content-loader.js";
import { ALL_FORMATS } from "./media/formats.js";
import type {
  GenerationRequest,
  EventContent,
  MenuContent,
  SocialContent,
  MediaType,
} from "./media/types.js";

const program = new Command();

program
  .name("media-maker")
  .description("Generate branded media: event flyers, print menus, social posts")
  .version("0.1.0");

// --- Generate Commands ---

const generate = program
  .command("generate")
  .description("Generate media");

// Generate flyer
generate
  .command("flyer")
  .description("Generate an event flyer")
  .requiredOption("--brand <id>", "Brand profile ID")
  .requiredOption("--event <name>", "Event name")
  .requiredOption("--date <date>", "Event date")
  .option("--time <time>", "Event time")
  .option("--description <text>", "Event description")
  .option("--format <formats...>", "Output formats", ["instagram"])
  .option("--style <style>", "Visual style: vibrant, minimal, retro, neon")
  .option("--image <paths...>", "Content images to include")
  .option("--like <id>", "Use a previous generation as template")
  .option("--custom-prompt <text>", "Additional instructions for the AI")
  .option("--tag <tags...>", "Tags for organization")
  .option("--campaign <name>", "Campaign name")
  .option("--new", "Force new generation (bypass idempotency)")
  .option("--output <dir>", "Output directory", "output")
  .action(async (opts) => {
    const content: EventContent = {
      eventName: opts.event,
      date: opts.date,
      time: opts.time,
      description: opts.description,
      tags: opts.tag,
      campaign: opts.campaign,
    };

    const request: GenerationRequest = {
      brandId: opts.brand,
      mediaType: "event-flyer",
      formats: opts.format,
      content,
      style: opts.style,
      customPrompt: opts.customPrompt,
      images: opts.image,
      parentId: opts.like,
      forceNew: opts.new,
      tags: opts.tag,
      campaign: opts.campaign,
    };

    await runGeneration(request, opts.output);
  });

// Generate menu
generate
  .command("menu")
  .description("Generate a print menu")
  .requiredOption("--brand <id>", "Brand profile ID")
  .option("--input <file>", "Menu text file")
  .option("--title <title>", "Menu title", "Menu")
  .option("--subtitle <text>", "Menu subtitle")
  .option("--footer <text>", "Menu footer text")
  .option("--format <formats...>", "Output formats", ["half-letter"])
  .option("--style <style>", "Visual style")
  .option("--sides <n>", "Number of sides (1 or 2)", "1")
  .option("--image <paths...>", "Reference images")
  .option("--reference <path>", "Reference image for style inspiration")
  .option("--custom-prompt <text>", "Additional instructions")
  .option("--tag <tags...>", "Tags")
  .option("--campaign <name>", "Campaign name")
  .option("--new", "Force new generation")
  .option("--output <dir>", "Output directory", "output")
  .action(async (opts) => {
    let menuContent: MenuContent;

    if (opts.input) {
      menuContent = loadMenuFile(opts.input, opts.title);
    } else {
      // Try reading from stdin
      const stdinData = await readStdin();
      if (stdinData) {
        menuContent = parseMenuText(stdinData, opts.title);
      } else {
        console.error(
          "Error: Provide a menu file with --input or pipe menu text via stdin"
        );
        process.exit(1);
      }
    }

    if (opts.subtitle) menuContent.subtitle = opts.subtitle;
    if (opts.footer) menuContent.footer = opts.footer;
    menuContent.tags = opts.tag;
    menuContent.campaign = opts.campaign;

    const images = [...(opts.image ?? [])];
    if (opts.reference) images.push(opts.reference);

    const request: GenerationRequest = {
      brandId: opts.brand,
      mediaType: "print-menu",
      formats: opts.format,
      content: menuContent,
      style: opts.style,
      customPrompt: opts.customPrompt,
      images: images.length > 0 ? images : undefined,
      forceNew: opts.new,
      tags: opts.tag,
      campaign: opts.campaign,
      sides: parseInt(opts.sides),
    };

    await runGeneration(request, opts.output);
  });

// Generate social post
generate
  .command("social")
  .description("Generate a social media post")
  .requiredOption("--brand <id>", "Brand profile ID")
  .requiredOption("--headline <text>", "Post headline")
  .option("--body <text>", "Post body text")
  .option("--format <formats...>", "Output formats", ["instagram"])
  .option("--style <style>", "Visual style")
  .option("--image <paths...>", "Content images to include")
  .option("--like <id>", "Use a previous generation as template")
  .option("--custom-prompt <text>", "Additional instructions")
  .option("--tag <tags...>", "Tags")
  .option("--campaign <name>", "Campaign name")
  .option("--new", "Force new generation")
  .option("--output <dir>", "Output directory", "output")
  .action(async (opts) => {
    const content: SocialContent = {
      headline: opts.headline,
      body: opts.body,
      tags: opts.tag,
      campaign: opts.campaign,
    };

    const request: GenerationRequest = {
      brandId: opts.brand,
      mediaType: "social-post",
      formats: opts.format,
      content,
      style: opts.style,
      customPrompt: opts.customPrompt,
      images: opts.image,
      parentId: opts.like,
      forceNew: opts.new,
      tags: opts.tag,
      campaign: opts.campaign,
    };

    await runGeneration(request, opts.output);
  });

// --- Brands Commands ---

const brands = program
  .command("brands")
  .description("Manage brand profiles");

brands
  .command("list")
  .description("List available brands")
  .action(() => {
    const brandIds = listBrands();
    if (brandIds.length === 0) {
      console.log("No brand profiles found in brands/ directory");
      return;
    }
    console.log("Available brands:");
    for (const id of brandIds) {
      try {
        const brand = loadBrand(id);
        console.log(`  ${id} - ${brand.name}`);
      } catch {
        console.log(`  ${id} - (invalid profile)`);
      }
    }
  });

brands
  .command("show <id>")
  .description("Show brand profile details")
  .action((id) => {
    try {
      const brand = loadBrand(id);
      console.log(`Brand: ${brand.name}`);
      console.log(`Tagline: "${brand.tagline}"`);
      console.log(`\nVenue: ${brand.venue.address}, ${brand.venue.city}, ${brand.venue.state} ${brand.venue.zip}`);
      console.log(`Phone: ${brand.venue.phone}`);
      console.log(`Email: ${brand.venue.email}`);
      console.log(`\nColors:`);
      for (const [name, hex] of Object.entries(brand.colors)) {
        console.log(`  ${name}: ${hex}`);
      }
      console.log(`\nTypography: ${brand.typography.heading} / ${brand.typography.body} / ${brand.typography.accent}`);
      console.log(`\nLogos: ${brand.logos.map((l) => l.id).join(", ")}`);

      const validation = validateBrandAssets(brand);
      if (!validation.valid) {
        console.log(`\nMissing assets:`);
        for (const m of validation.missing) {
          console.log(`  ${m}`);
        }
      }
    } catch (err) {
      console.error(`Error: ${err instanceof Error ? err.message : err}`);
      process.exit(1);
    }
  });

// --- Library Commands ---

const library = program
  .command("library")
  .description("Browse and manage generated media");

library
  .command("list")
  .description("List generated media")
  .option("--brand <id>", "Filter by brand")
  .option("--type <type>", "Filter by type: flyer, menu, social")
  .option("--campaign <name>", "Filter by campaign")
  .option("--since <date>", "Filter by date (ISO)")
  .option("--tag <tags...>", "Filter by tags")
  .option("--output <dir>", "Output directory", "output")
  .action((opts) => {
    const typeMap: Record<string, MediaType> = {
      flyer: "event-flyer",
      menu: "print-menu",
      social: "social-post",
    };

    const records = queryLibrary(
      {
        brandId: opts.brand,
        mediaType: opts.type ? typeMap[opts.type] : undefined,
        campaign: opts.campaign,
        since: opts.since,
        tags: opts.tag,
      },
      opts.output
    );

    if (records.length === 0) {
      console.log("No media found matching query");
      return;
    }

    console.log(`Found ${records.length} item(s):\n`);
    for (const r of records) {
      const tags = r.tags.length > 0 ? ` [${r.tags.join(", ")}]` : "";
      console.log(
        `  ${r.id.slice(0, 8)} | ${r.mediaType} | ${r.format} | ${r.status}${tags}`
      );
      console.log(`         ${r.filePath}`);
      console.log(`         ${r.generatedAt}`);
      console.log();
    }
  });

library
  .command("approve <id>")
  .description("Approve a generated image")
  .option("--output <dir>", "Output directory", "output")
  .action((id, opts) => {
    const record = updateRecordStatus(id, "approved", opts.output);
    if (!record) {
      console.error(`Media not found: ${id}`);
      process.exit(1);
    }
    console.log(`Approved: ${record.filePath}`);
  });

// --- Helper Functions ---

async function runGeneration(
  request: GenerationRequest,
  outputDir: string
): Promise<void> {
  console.log(
    `Generating ${request.mediaType} for brand "${request.brandId}"...`
  );
  console.log(`Formats: ${request.formats.join(", ")}`);

  try {
    const pipeline = new GenerationPipeline({ outputDir });
    const job = await pipeline.generate(request);

    console.log(`\nJob ${job.id.slice(0, 8)} - ${job.status}`);

    for (const result of job.results) {
      if (result.success) {
        console.log(`  [OK] ${result.format}: ${result.mediaRecord!.filePath}`);
        if (result.costCents) {
          console.log(`       Cost: ${result.costCents}c`);
        }
      } else {
        console.log(`  [FAIL] ${result.format}: ${result.error}`);
      }
    }

    if (job.warnings.length > 0) {
      console.log(`\nWarnings:`);
      for (const w of job.warnings) {
        console.log(`  - ${w}`);
      }
    }

    const failed = job.results.filter((r) => !r.success);
    if (failed.length > 0) {
      process.exit(1);
    }
  } catch (err) {
    console.error(`Error: ${err instanceof Error ? err.message : err}`);
    process.exit(1);
  }
}

async function readStdin(): Promise<string | null> {
  if (process.stdin.isTTY) return null;

  return new Promise((resolve) => {
    let data = "";
    process.stdin.setEncoding("utf-8");
    process.stdin.on("data", (chunk) => (data += chunk));
    process.stdin.on("end", () => resolve(data || null));
    // Timeout after 100ms if no data
    setTimeout(() => {
      if (!data) resolve(null);
    }, 100);
  });
}

program.parse();
