---
name: media-generation
description: Use when generating branded media (flyers, menus, social posts) for The Triple Lindy or any configured brand. Guides conversational media creation through the CLI tool.
---

# Media Generation Skill

## Overview

Generate branded event flyers, print menus, and social media posts using AI image generation. This skill guides conversational creation through the `media-maker` CLI.

**Announce at start:** "I'm using the media-generation skill to help create branded media."

## When to Use

- Creating event flyers (Drag Bingo, live music, trivia, etc.)
- Generating print menus (cocktail menus, food menus, tap lists)
- Making social media posts (happy hour, announcements, promotions)
- Editing existing generated images
- Managing brand assets or browsing generated media

## Quick Reference

### Available Brands

```bash
npx tsx src/cli.ts brands list
```

### Generate Event Flyer

```bash
npx tsx src/cli.ts generate flyer \
  --brand triple-lindy \
  --event "Event Name" \
  --date "2025-03-15" \
  --time "7pm" \
  --format instagram story \
  --style vibrant
```

### Generate Print Menu

From a text file:
```bash
npx tsx src/cli.ts generate menu \
  --brand triple-lindy \
  --input menu.txt \
  --title "Cocktail Menu" \
  --format half-letter \
  --text-overlay \
  --export-pptx \
  --export-pdf
```

From inline text (create a temp file):
```bash
cat > /tmp/menu.txt << 'EOF'
Classics
Old Fashioned - $14
Margarita - $12

Signatures
The Triple Lindy - $16 (rum, lime, coconut)
EOF

npx tsx src/cli.ts generate menu \
  --brand triple-lindy \
  --input /tmp/menu.txt \
  --title "Cocktail Menu" \
  --format half-letter
```

### Generate Social Post

```bash
npx tsx src/cli.ts generate social \
  --brand triple-lindy \
  --headline "Happy Hour 3-6pm" \
  --body "Half off well drinks" \
  --format instagram story
```

### Edit an Existing Image

```bash
npx tsx src/cli.ts generate edit \
  --brand triple-lindy \
  --source output/flyers/previous.png \
  --instructions "Change the background color to blue" \
  --format instagram
```

### Include Images

```bash
# One-off images for a specific generation
npx tsx src/cli.ts generate flyer \
  --brand triple-lindy \
  --event "St. Patrick's Day" \
  --date "2025-03-17" \
  --image ./shamrock.png \
  --format instagram

# Reuse a previous design
npx tsx src/cli.ts generate social \
  --like <previous-id> \
  --headline "Updated headline"
```

### Browse Library

```bash
npx tsx src/cli.ts library list --brand triple-lindy
npx tsx src/cli.ts library list --campaign st-patricks-2025
npx tsx src/cli.ts library approve <id>
```

## Conversational Workflow

When a user asks to create media:

1. **Identify the type**: flyer, menu, social post, or edit
2. **Gather required info**:
   - Flyer: event name, date, time
   - Menu: items (text file or inline), title
   - Social: headline, optional body
   - Edit: source image path, edit instructions
3. **Ask about preferences**:
   - Formats: instagram, story, facebook, twitter, letter-portrait, half-letter, table-tent, a4, a6, etc.
   - Style: vibrant (default), minimal, retro, neon
   - Provider: gemini (default) or openai
   - Campaign or tags for organization
   - Any images to include
   - For menus: `--text-overlay` for programmatic text, `--export-pptx` for editable PowerPoint, `--export-pdf` for editable PDF
4. **Generate** using the CLI
5. **Show results**: file paths and any warnings
6. **Iterate** if needed: adjust prompt, style, or try `--new` for a different variation

## Formats

### Social Media
| Name | Dimensions | Use |
|------|-----------|-----|
| instagram | 1080x1080 | Instagram feed |
| story | 1080x1920 | IG/FB stories |
| facebook | 1200x630 | Facebook posts |
| twitter | 1200x675 | Twitter/X |

### Print
| Name | Paper Size | Use |
|------|------------|-----|
| letter-portrait | 8.5x11 | Flyers, full menus |
| letter-landscape | 11x8.5 | Bar menus, tap lists |
| half-letter | 5.5x8.5 | Cocktail menus |
| legal | 8.5x14 | Extended menus |
| a4 | 210x297mm | International A4 |
| a6 | 105x148mm | Postcards, small flyers |
| table-tent | 5x7 | Table tents |

## Advanced Flags

### All Generate Commands

| Flag | Description |
|------|-------------|
| `--provider <name>` | Image provider: `gemini` or `openai` |
| `--quality <level>` | Image quality: `low`, `medium`, `high` (OpenAI only) |
| `--logo-color <hex>` | Tint the logo to a specific color, e.g. `#8B00FF` |
| `--style <name>` | Visual style: `vibrant`, `minimal`, `retro`, `neon` |
| `--custom-prompt <text>` | Additional instructions for the AI |
| `--image <paths...>` | Content images to include |
| `--tag <tags...>` | Tags for organization |
| `--campaign <name>` | Campaign name for grouping |
| `--dry-run` | Preview prompt and cost without generating |
| `--new` | Force new generation (bypass idempotency) |

### Menu-Specific Flags

| Flag | Description |
|------|-------------|
| `--text-overlay` | Programmatic text rendering over AI background (crisp vector text) |
| `--export-pptx` | Also export an editable PowerPoint file |
| `--export-pdf` | Also export an editable PDF file |
| `--reference <path>` | Reference image for style inspiration |
| `--sides <n>` | Number of sides: 1 or 2 |
| `--subtitle <text>` | Menu subtitle |
| `--footer <text>` | Menu footer text |

## Styles

- **vibrant**: Colorful and energetic with bold contrasts
- **minimal**: Clean and modern with elegant typography
- **retro**: Vintage pub aesthetic with warm tones
- **neon**: Neon signs on dark background with glowing effects

## Menu Text Format

When creating menus, items follow this format:
```
Section Name
Item Name - $Price
Item Name - $Price (description)

Next Section
...
```

## Scripts

Standalone utilities for re-export and debugging workflows:

| Script | Usage |
|--------|-------|
| `export-pdf.ts` | `npx tsx scripts/export-pdf.ts <bg.png> <menu.txt> [--title '...'] [--heading-font '...'] [--body-font '...']` |
| `recomposite.ts` | `npx tsx scripts/recomposite.ts <bg.png> <menu.txt> [--title '...'] [--accent-color '#hex'] [--heading-font '...'] [--body-font '...']` |
| `layout-debug.ts` | `npx tsx scripts/layout-debug.ts <bg.png> <menu.txt>` |
| `measure-debug.ts` | `npx tsx scripts/measure-debug.ts <bg.png>` |

## Tips

- Use `--campaign` to group related media (e.g., "summer-menu-2025")
- Use `--tag` for searchable labels (e.g., "seasonal", "cocktails")
- Use `--new` to get a different creative variation with the same inputs
- Use `--like <id>` to create variations of a successful design
- Use `--text-overlay` for menus when you want crisp, editable text over an AI-generated background
- Use `--export-pptx` to get an editable PowerPoint for further design tweaks
- Use `--export-pdf` to get an editable PDF for further design tweaks
- Use `--provider openai` for a different artistic style (or as fallback)

## Project Structure

| Path | Purpose |
|------|---------|
| `brands/` | YAML brand profiles |
| `content/` | Menu text files |
| `output/` | Generated media (gitignored) |
| `scripts/` | Standalone export and debug utilities |
| `src/cli.ts` | CLI entry point |
| `src/generation/pipeline.ts` | Generation orchestrator |
| `src/providers/` | Gemini and OpenAI image providers + registry |
| `src/prompts/` | Prompt templates and builder |
| `src/text/` | Text overlay pipeline (measure, layout, SVG render, wrap) |
| `src/processing/` | Image processors (social resize, print bleed, logo tint) |
| `src/export/` | PDF and PowerPoint exporters |
| `src/storage/` | File storage and library management |

## Environment

Requires at least one API key in `.env` (copy from `.env.example`):

- `GOOGLE_AI_API_KEY` — for Gemini provider
- `OPENAI_API_KEY` — for OpenAI provider
