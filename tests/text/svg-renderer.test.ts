import { describe, it, expect } from "vitest";
import { renderTextSvg } from "@/text/svg-renderer";
import type { TextLayout } from "@/text/layout";

function makeLayout(overrides?: Partial<TextLayout>): TextLayout {
  return {
    width: 800,
    height: 600,
    elements: [
      {
        text: "Title",
        x: 400,
        y: 100,
        fontSize: 40,
        fontFamily: "Arial",
        fontWeight: "bold",
        color: "#FF0000",
        anchor: "middle",
      },
      {
        text: "Body text",
        x: 50,
        y: 200,
        fontSize: 20,
        fontFamily: "Helvetica",
        fontWeight: "normal",
        color: "#000000",
        anchor: "start",
      },
    ],
    ...overrides,
  };
}

describe("renderTextSvg", () => {
  it("outputs valid SVG with correct dimensions", () => {
    const svg = renderTextSvg(makeLayout()).toString();
    expect(svg).toMatch(/^<svg/);
    expect(svg).toContain('width="800"');
    expect(svg).toContain('height="600"');
    expect(svg).toContain("xmlns=");
  });

  it("includes text elements in output", () => {
    const svg = renderTextSvg(makeLayout()).toString();
    expect(svg).toContain("Title");
    expect(svg).toContain("Body text");
  });

  it("escapes special XML characters", () => {
    const layout = makeLayout({
      elements: [
        {
          text: "Tom & Jerry's <special>",
          x: 100,
          y: 100,
          fontSize: 20,
          fontFamily: "Arial",
          fontWeight: "normal",
          color: "#000",
          anchor: "start",
        },
      ],
    });
    const svg = renderTextSvg(layout).toString();
    expect(svg).toContain("&amp;");
    expect(svg).toContain("&lt;");
    expect(svg).toContain("&gt;");
    expect(svg).toContain("&apos;");
  });

  it("renders short text without tspan", () => {
    const layout = makeLayout({
      elements: [
        {
          text: "Short",
          x: 100,
          y: 100,
          fontSize: 20,
          fontFamily: "Arial",
          fontWeight: "normal",
          color: "#000",
          anchor: "start",
        },
      ],
    });
    const svg = renderTextSvg(layout).toString();
    expect(svg).not.toContain("<tspan");
  });

  it("renders long text with maxWidth using tspan elements", () => {
    const layout = makeLayout({
      elements: [
        {
          text: "This is a very long text that should definitely need wrapping into multiple lines",
          x: 100,
          y: 100,
          fontSize: 20,
          fontFamily: "Arial",
          fontWeight: "normal",
          color: "#000",
          anchor: "start",
          maxWidth: 150,
        },
      ],
    });
    const svg = renderTextSvg(layout).toString();
    expect(svg).toContain("<tspan");
    expect(svg).toMatch(/dy="/);
  });

  it("uses serif fallback for serif fonts", () => {
    const layout = makeLayout({
      elements: [
        {
          text: "Serif text",
          x: 100,
          y: 100,
          fontSize: 20,
          fontFamily: "Playfair Display",
          fontWeight: "normal",
          color: "#000",
          anchor: "start",
        },
      ],
    });
    const svg = renderTextSvg(layout).toString();
    expect(svg).toContain("serif");
    // Should not have "sans-serif" for this font
    expect(svg).not.toContain("sans-serif");
  });

  it("uses sans-serif fallback for sans-serif fonts", () => {
    const layout = makeLayout({
      elements: [
        {
          text: "Sans text",
          x: 100,
          y: 100,
          fontSize: 20,
          fontFamily: "Arial",
          fontWeight: "normal",
          color: "#000",
          anchor: "start",
        },
      ],
    });
    const svg = renderTextSvg(layout).toString();
    expect(svg).toContain("sans-serif");
  });

  it("includes font weight and color in style", () => {
    const svg = renderTextSvg(makeLayout()).toString();
    expect(svg).toContain("font-weight: bold");
    expect(svg).toContain("fill: #FF0000");
  });
});
