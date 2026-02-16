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
import { ALL_FORMATS, resolveFormats } from "./media/formats.js";
import { buildPrompt, type PromptContext } from "./prompts/builder.js";
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
  .option("--logo-color <hex>", "Tint the logo with a hex color, e.g. #8B00FF")
  .option("--provider <name>", "Image provider: openai, gemini")
  .option("--quality <level>", "Image quality: low, medium, high (OpenAI only)")
  .option("--tag <tags...>", "Tags for organization")
  .option("--campaign <name>", "Campaign name")
  .option("--new", "Force new generation (bypass idempotency)")
  .option("--dry-run", "Preview prompt and cost without generating")
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
      logoColor: opts.logoColor,
      provider: opts.provider,
      quality: opts.quality,
      images: opts.image,
      parentId: opts.like,
      forceNew: opts.new,
      tags: opts.tag,
      campaign: opts.campaign,
    };

    if (opts.dryRun) {
      await runDryRun(request);
    } else {
      await runGeneration(request, opts.output);
    }
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
  .option("--logo-color <hex>", "Tint the logo with a hex color, e.g. #8B00FF")
  .option("--provider <name>", "Image provider: openai, gemini")
  .option("--quality <level>", "Image quality: low, medium, high (OpenAI only)")
  .option("--tag <tags...>", "Tags")
  .option("--campaign <name>", "Campaign name")
  .option("--text-overlay", "Use programmatic text rendering (no AI text)")
  .option("--export-pptx", "Also export editable PowerPoint file")
  .option("--export-pdf", "Also export editable PDF file")
  .option("--new", "Force new generation")
  .option("--dry-run", "Preview prompt and cost without generating")
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
      logoColor: opts.logoColor,
      provider: opts.provider,
      quality: opts.quality,
      images: images.length > 0 ? images : undefined,
      forceNew: opts.new,
      tags: opts.tag,
      campaign: opts.campaign,
      sides: parseInt(opts.sides),
      textOverlay: opts.textOverlay,
      exportPptx: opts.exportPptx,
      exportPdf: opts.exportPdf,
    };

    if (opts.dryRun) {
      await runDryRun(request);
    } else {
      await runGeneration(request, opts.output);
    }
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
  .option("--logo-color <hex>", "Tint the logo with a hex color, e.g. #8B00FF")
  .option("--provider <name>", "Image provider: openai, gemini")
  .option("--quality <level>", "Image quality: low, medium, high (OpenAI only)")
  .option("--tag <tags...>", "Tags")
  .option("--campaign <name>", "Campaign name")
  .option("--new", "Force new generation")
  .option("--dry-run", "Preview prompt and cost without generating")
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
      logoColor: opts.logoColor,
      provider: opts.provider,
      quality: opts.quality,
      images: opts.image,
      parentId: opts.like,
      forceNew: opts.new,
      tags: opts.tag,
      campaign: opts.campaign,
    };

    if (opts.dryRun) {
      await runDryRun(request);
    } else {
      await runGeneration(request, opts.output);
    }
  });

// Generate edit (modify an existing image)
generate
  .command("edit")
  .description("Edit an existing generated image")
  .requiredOption("--source <path>", "Path to the image to edit")
  .requiredOption("--instructions <text>", "What to change in the image")
  .requiredOption("--brand <id>", "Brand profile ID")
  .requiredOption("--format <formats...>", "Output formats")
  .option("--image <paths...>", "Additional reference images")
  .option("--provider <name>", "Image provider: openai, gemini")
  .option("--quality <level>", "Image quality: low, medium, high (OpenAI only)")
  .option("--tag <tags...>", "Tags for organization")
  .option("--campaign <name>", "Campaign name")
  .option("--new", "Force new generation (bypass idempotency)")
  .option("--dry-run", "Preview instructions without generating")
  .option("--output <dir>", "Output directory", "output")
  .action(async (opts) => {
    const sourcePath = opts.source.replace(/^~/, process.env.HOME ?? "~");
    if (!existsSync(sourcePath)) {
      console.error(`Error: Source image not found: ${sourcePath}`);
      process.exit(1);
    }

    const request: GenerationRequest = {
      brandId: opts.brand,
      mediaType: "print-menu",
      formats: opts.format,
      content: { title: "Edit", sections: [] } as MenuContent,
      provider: opts.provider,
      quality: opts.quality,
      images: opts.image,
      forceNew: opts.new,
      tags: opts.tag,
      campaign: opts.campaign,
      editSource: sourcePath,
      editInstructions: opts.instructions,
    };

    if (opts.dryRun) {
      console.log(`\n--- DRY RUN: edit ---\n`);
      console.log(`Source: ${sourcePath}`);
      console.log(`Format: ${opts.format.join(", ")}`);
      console.log(`\n=== EDIT INSTRUCTIONS ===`);
      console.log(opts.instructions);
      console.log(`\n--- No API call made ---`);
    } else {
      console.log(`Editing image for brand "${opts.brand}"...`);
      console.log(`Source: ${sourcePath}`);
      console.log(`Formats: ${opts.format.join(", ")}`);

      try {
        const pipeline = new GenerationPipeline({ outputDir: opts.output });
        const job = await pipeline.edit(request);

        console.log(`\nJob ${job.id.slice(0, 8)} - ${job.status}`);

        let totalCost = 0;
        for (const result of job.results) {
          if (result.success) {
            console.log(`  [OK] ${result.format}: ${result.mediaRecord!.filePath}`);
            if (result.costCents) {
              console.log(`       Cost: ${result.costCents}c`);
              totalCost += result.costCents;
            }
          } else {
            console.log(`  [FAIL] ${result.format}: ${result.error}`);
          }
        }

        if (totalCost > 0) {
          const dailyBudget = Number(process.env.DAILY_BUDGET_CENTS) || 500;
          console.log(`\nCost: ${totalCost}c ($${(totalCost / 100).toFixed(2)}) | Budget: ${dailyBudget}c ($${(dailyBudget / 100).toFixed(2)})`);
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

async function runDryRun(request: GenerationRequest): Promise<void> {
  console.log(`\n--- DRY RUN: ${request.mediaType} for "${request.brandId}" ---\n`);

  const brand = loadBrand(request.brandId);
  const formats = resolveFormats(request.formats);

  // Determine provider
  const providerName = request.provider ?? (process.env.OPENAI_API_KEY ? "openai" : "gemini");
  console.log(`Provider: ${providerName}`);
  if (request.quality) {
    console.log(`Quality: ${request.quality}`);
  }
  console.log();

  const costPerImage = providerName === "openai"
    ? (Number(process.env.OPENAI_COST_PER_IMAGE_CENTS) || 4)
    : (Number(process.env.GEMINI_COST_PER_IMAGE_CENTS) || 4);
  const maxRetries = Number(process.env.MAX_RETRIES) || 2;

  // Build prompt for the first format to show what would be sent
  const promptCtx: PromptContext = {
    brand,
    format: formats[0],
    mediaType: request.mediaType,
    content: request.content,
    style: request.style,
    customPrompt: request.customPrompt,
    hasBrandAssets: brand.logos.some(
      (l) => l.type === "primary" || l.type === "secondary"
    ),
    textOverlay: request.textOverlay,
  };
  const prompt = buildPrompt(promptCtx);

  console.log("=== PROMPT ===");
  console.log(prompt);
  console.log("\n=== FORMATS ===");
  for (const f of formats) {
    console.log(`  ${f.name}: ${f.width}x${f.height} (${f.category})`);
  }

  console.log("\n=== COST ESTIMATE ===");
  const bestCase = formats.length * costPerImage;
  const worstCase = formats.length * costPerImage * (1 + maxRetries);
  console.log(`  Per image: ${costPerImage}c`);
  console.log(`  Formats: ${formats.length}`);
  console.log(`  Best case: ${bestCase}c ($${(bestCase / 100).toFixed(2)})`);
  console.log(`  Worst case (with retries): ${worstCase}c ($${(worstCase / 100).toFixed(2)})`);

  const dailyBudget = Number(process.env.DAILY_BUDGET_CENTS) || 500;
  console.log(`  Daily budget: ${dailyBudget}c ($${(dailyBudget / 100).toFixed(2)})`);

  console.log("\n--- No API call made ---");
}

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

    let totalCost = 0;
    for (const result of job.results) {
      if (result.success) {
        console.log(`  [OK] ${result.format}: ${result.mediaRecord!.filePath}`);
        if (result.costCents) {
          console.log(`       Cost: ${result.costCents}c`);
          totalCost += result.costCents;
        }
      } else {
        console.log(`  [FAIL] ${result.format}: ${result.error}`);
      }
    }

    // Cost summary
    if (totalCost > 0) {
      const dailyBudget = Number(process.env.DAILY_BUDGET_CENTS) || 500;
      console.log(`\nCost: ${totalCost}c ($${(totalCost / 100).toFixed(2)}) | Budget: ${dailyBudget}c ($${(dailyBudget / 100).toFixed(2)})`);
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
