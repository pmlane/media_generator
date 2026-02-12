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
  --format half-letter
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

1. **Identify the type**: flyer, menu, or social post
2. **Gather required info**:
   - Flyer: event name, date, time
   - Menu: items (text file or inline), title
   - Social: headline, optional body
3. **Ask about preferences**:
   - Formats: instagram, story, facebook, twitter, letter-portrait, half-letter, etc.
   - Style: vibrant (default), minimal, retro, neon
   - Campaign or tags for organization
   - Any images to include
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
| half-letter | 5.5x8.5 | Cocktail menus, table tents |
| legal | 8.5x14 | Extended menus |

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

## Tips

- Use `--campaign` to group related media (e.g., "summer-menu-2025")
- Use `--tag` for searchable labels (e.g., "seasonal", "cocktails")
- Use `--new` to get a different creative variation with the same inputs
- Use `--like <id>` to create variations of a successful design
- Use `--custom-prompt` for specific design instructions

## Project Structure

| Path | Purpose |
|------|---------|
| `brands/` | YAML brand profiles |
| `output/` | Generated media (gitignored) |
| `src/cli.ts` | CLI entry point |
| `src/generation/pipeline.ts` | Generation orchestrator |
| `src/prompts/builder.ts` | Prompt assembly |

## Environment

Requires `GOOGLE_AI_API_KEY` in `.env` for real generation. Copy `.env.example` to `.env` and add your key.
