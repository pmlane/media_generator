# Media Maker

General-purpose branded media generation tool for The Triple Lindy (and any brand with a YAML profile).

## Quick Start

```bash
npm install
cp .env.example .env  # Add GOOGLE_AI_API_KEY
npx tsx src/cli.ts generate flyer --brand triple-lindy --event "Test" --date "2025-01-01" --format instagram
```

## Commands

```bash
# Run CLI
npx tsx src/cli.ts <command>

# Run tests
npm test

# Type check
npm run typecheck
```

## Architecture

- **Brand profiles** (`brands/*.yaml`): YAML configs with colors, typography, voice, design rules, logos
- **Generation pipeline** (`src/generation/pipeline.ts`): validate -> prompt -> generate -> quality gate -> process -> store
- **Providers** (`src/providers/`): Gemini image generation (provider-agnostic interface)
- **Prompts** (`src/prompts/`): Template-based prompt assembly with brand injection
- **Quality gate** (`src/quality/gate.ts`): Automated checks (decodable, dimensions, blank detection, brand colors)
- **Processing** (`src/processing/`): Sharp-based resize for social (RGB PNG) and print (300 DPI + bleed + crop marks)
- **Storage** (`src/storage/`): File output with JSON metadata sidecars, library queries
- **Jobs** (`src/jobs/`): Async runner with retries, idempotency, budget tracking

## Key Files

| Purpose | Path |
|---------|------|
| CLI entry | `src/cli.ts` |
| Pipeline orchestrator | `src/generation/pipeline.ts` |
| Brand schema | `src/brands/schema.ts` |
| Format constants | `src/media/formats.ts` |
| Core types | `src/media/types.ts` |
| Prompt builder | `src/prompts/builder.ts` |
| Quality checks | `src/quality/gate.ts` |
| Triple Lindy brand | `brands/triple-lindy.yaml` |

## Testing

```bash
npm test              # Run all tests
npm run test:watch    # Watch mode
```

Tests use a mock provider (no API calls). Integration tests cover the full pipeline lifecycle.

## Adding a New Brand

1. Create `brands/<brand-id>.yaml` following the schema in `src/brands/schema.ts`
2. Include: id, name, tagline, venue, social, colors, typography, voice, design_rules, logos
3. Verify: `npx tsx src/cli.ts brands show <brand-id>`
