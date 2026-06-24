import { describe, expect, it } from "vitest";
import { buildClientAlertEmailHtml } from "@/lib/email-template";

describe("client alert email template", () => {
  it("wraps generated article HTML in the reference email typography without the red campaign background", () => {
    const html = buildClientAlertEmailHtml(
      '<h1>Client alert title</h1><p>Body copy with <a href="https://example.com">source link</a>.</p><h2>Trend</h2><ul><li>First point</li></ul>',
    );

    expect(html).toContain("max-width:600px");
    expect(html).toContain("font-size:22px");
    expect(html).toContain("font-size:14px");
    expect(html).toContain("line-height:22px");
    expect(html).toContain("color:#470b1a");
    expect(html).toContain("'Segoe UI'");
    expect(html).not.toContain('"Segoe UI"');
    expect(html).toContain('href="https://example.com"');
    expect(html).toContain("background-color:#ffffff");
    expect(html).not.toContain("background-color:#6b001b");
  });
});
