# Media Maker

General-purpose branded media generation tool for The Triple Lindy (and any brand with a YAML profile).

## Quick Start

```bash
npm install
cp .env.example .env  # Add GOOGLE_AI_API_KEY and/or OPENAI_API_KEY
npx tsx src/cli.ts generate flyer --brand triple-lindy --event "Test" --date "2025-01-01" --format instagram
```

## Commands

```bash
# Run CLI
npx tsx src/cli.ts <command>

# Generate media
npx tsx src/cli.ts generate flyer  --brand <id> --event <name> --date <date> [options]
npx tsx src/cli.ts generate menu   --brand <id> --input <file> [--text-overlay] [--export-pptx] [options]
npx tsx src/cli.ts generate social --brand <id> --headline <text> [options]
npx tsx src/cli.ts generate edit   --brand <id> --source <path> --instructions <text> --format <fmt> [options]

# Manage brands
npx tsx src/cli.ts brands list
npx tsx src/cli.ts brands show <id>

# Browse library
npx tsx src/cli.ts library list [--brand <id>] [--type flyer|menu|social] [--campaign <name>]
npx tsx src/cli.ts library approve <id>

# Run tests
npm test

# Type check
npm run typecheck
```

### Common Flags (all generate commands)

| Flag | Description |
|------|-------------|
| `--provider <name>` | Image provider: `gemini` or `openai` |
| `--quality <level>` | Image quality: `low`, `medium`, `high` (OpenAI only) |
| `--logo-color <hex>` | Tint logo to a specific color, e.g. `#8B00FF` |
| `--style <name>` | Visual style: `vibrant`, `minimal`, `retro`, `neon` |
| `--format <fmts...>` | Output formats (see Formats section) |
| `--custom-prompt <text>` | Additional instructions for the AI |
| `--dry-run` | Preview prompt without generating |
| `--new` | Force new generation (bypass idempotency) |

### Menu-Only Flags

| Flag | Description |
|------|-------------|
| `--text-overlay` | Programmatic text rendering over AI background (no AI-generated text) |
| `--export-pptx` | Also export an editable PowerPoint file |
| `--export-pdf` | Also export an editable PDF file |
| `--reference <path>` | Reference image for style inspiration |
| `--sides <n>` | Number of sides: 1 or 2 |

## Architecture

- **Brand profiles** (`brands/*.yaml`): YAML configs with colors, typography, voice, design rules, logos
- **Generation pipeline** (`src/generation/pipeline.ts`): validate → prompt → generate → quality gate → process → store
- **Providers** (`src/providers/`): Gemini and OpenAI image generation via a provider registry with budget tracking and rate controls
- **Prompts** (`src/prompts/`): Template-based prompt assembly with brand injection (flyer, menu, menu background, social post)
- **Quality gate** (`src/quality/gate.ts`): Automated checks (decodable, dimensions, blank detection, brand colors, aspect ratio)
- **Text overlay** (`src/text/`): Programmatic text rendering pipeline: measure clear zone → layout → SVG render → Sharp composite
- **Processing** (`src/processing/`): Sharp-based resize for social (RGB PNG), print (300 DPI + bleed + crop marks), and logo tinting
- **Export** (`src/export/`): Editable PDF (pdf-lib + fontkit) and PowerPoint (python-pptx via subprocess)
- **Storage** (`src/storage/`): File output with JSON metadata sidecars, library queries and approval
- **Jobs** (`src/jobs/`): Async runner with retries, idempotency, budget tracking

## Key Files

| Purpose | Path |
|---------|------|
| CLI entry | `src/cli.ts` |
| Pipeline orchestrator | `src/generation/pipeline.ts` |
| Brand schema | `src/brands/schema.ts` |
| Brand loader | `src/brands/loader.ts` |
| Format constants | `src/media/formats.ts` |
| Core types | `src/media/types.ts` |
| Prompt builder | `src/prompts/builder.ts` |
| Flyer template | `src/prompts/templates/event-flyer.ts` |
| Menu template | `src/prompts/templates/print-menu.ts` |
| Menu BG template | `src/prompts/templates/print-menu-background.ts` |
| Social template | `src/prompts/templates/social-post.ts` |
| Quality checks | `src/quality/gate.ts` |
| Gemini provider | `src/providers/gemini.ts` |
| OpenAI provider | `src/providers/openai.ts` |
| Provider registry | `src/providers/registry.ts` |
| Clear-zone measure | `src/text/measure.ts` |
| Text layout engine | `src/text/layout.ts` |
| SVG text renderer | `src/text/svg-renderer.ts` |
| Text wrapping | `src/text/wrap.ts` |
| Social processor | `src/processing/social.ts` |
| Print processor | `src/processing/print.ts` |
| Logo tinting | `src/processing/tint.ts` |
| PDF exporter | `src/export/pdf-exporter.ts` |
| PDF renderer | `src/export/pdf-renderer.ts` |
| PPTX exporter | `src/export/pptx-exporter.ts` |
| File storage | `src/storage/file-storage.ts` |
| Library queries | `src/storage/library.ts` |
| Content loader | `src/content/content-loader.ts` |
| Job runner | `src/jobs/runner.ts` |
| Triple Lindy brand | `brands/triple-lindy.yaml` |

## Scripts

Standalone utilities run with `npx tsx scripts/<name>.ts`:

| Script | Description |
|--------|-------------|
| `export-pdf.ts` | Export editable PDF from a background image + menu text file |
| `recomposite.ts` | Re-composite text overlay onto a background with font/color overrides |
| `layout-debug.ts` | Debug: measure clear zone and print calculated layout positions |
| `measure-debug.ts` | Debug: analyze a background image and print clear-zone dimensions |
| `generate-pptx.py` | Python script (called by PPTX exporter) to build PowerPoint via python-pptx |

Script flags (`export-pdf.ts`, `recomposite.ts`): `--title`, `--accent-color`, `--heading-font`, `--body-font`

## Formats

### Social (72 DPI, RGB PNG)

| Key | Dimensions | Use |
|-----|-----------|-----|
| `instagram` | 1080x1080 | Instagram feed |
| `story` | 1080x1920 | IG/FB stories |
| `facebook` | 1200x630 | Facebook posts |
| `twitter` | 1200x675 | Twitter/X |

### Print (300 DPI, bleed + crop marks)

| Key | Paper Size | Dimensions | Use |
|-----|------------|-----------|-----|
| `letter-portrait` | 8.5x11 | 2550x3300 | Flyers, full menus |
| `letter-landscape` | 11x8.5 | 3300x2550 | Bar menus, tap lists |
| `half-letter` | 5.5x8.5 | 1650x2550 | Cocktail menus |
| `legal` | 8.5x14 | 2550x4200 | Extended menus |
| `a4` | 210x297mm | 2480x3508 | International A4 |
| `a6` | 105x148mm | 1240x1748 | Postcards, small flyers |
| `table-tent` | 5x7 | 1500x2100 | Table tents |

## Environment Variables

See `.env.example` for all options. Key variables:

| Variable | Default | Description |
|----------|---------|-------------|
| `GOOGLE_AI_API_KEY` | — | Required for Gemini provider |
| `OPENAI_API_KEY` | — | Required for OpenAI provider |
| `GEMINI_IMAGE_MODEL` | `gemini-3-pro-image-preview` | Gemini model name |
| `OPENAI_IMAGE_MODEL` | `gpt-image-1` | OpenAI model name |
| `OPENAI_IMAGE_QUALITY` | `medium` | OpenAI quality: low, medium, high |
| `DAILY_BUDGET_CENTS` | `500` | Daily budget cap ($5.00) |

## Testing

```bash
npm test              # Run all tests
npm run test:watch    # Watch mode
```

Tests use a mock provider (no API calls). Test directories: `tests/brands/`, `tests/content/`, `tests/integration/`, `tests/processing/`, `tests/prompts/`, `tests/providers/`, `tests/quality/`, `tests/text/`.

## Environment Notes

- The working Gemini image model is `gemini-3-pro-image-preview` (set in `.env` and as default in `src/providers/gemini.ts`)
- API key is shared with the trivia_generator project (`GOOGLE_AI_API_KEY`)
- Brand logos reference `../new_website/media_assets/logos/` via relative paths in the brand YAML
- The `output/` directory is gitignored; generated media stays local
- PPTX export requires Python 3 with `python-pptx` installed

## Adding a New Brand

1. Create `brands/<brand-id>.yaml` following the schema in `src/brands/schema.ts`
2. Include: id, name, tagline, venue, social, colors, typography, voice, design_rules, logos
3. Verify: `npx tsx src/cli.ts brands show <brand-id>`
