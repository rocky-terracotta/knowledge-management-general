import { fireEvent, render, screen } from "@testing-library/react";
import React from "react";
import { describe, expect, it } from "vitest";
import { AlertsWorkspace } from "@/components/AlertsWorkspace";
import type { FirmPerson, StoredNews } from "@/lib/types";

const news: StoredNews[] = [
  {
    newsRefNo: "26PR90",
    source: "sfc",
    lang: "EN",
    title: "SFC seeks share buy-out order",
    newsExtLink: null,
    newsType: "EF",
    issueDate: "2026-06-17T17:15:00",
    modificationTime: null,
    targetCeList: [{ ceName: "NG Yu", lang: "EN", masked: false }],
    sourceUrl: "https://apps.sfc.hk/doc?refNo=26PR90",
    summary:
      "The SFC commenced proceedings seeking a buy-out order and disqualification orders after alleged governance failures connected with a listed insurer. The announcement identifies the relevant respondents, the regulatory action, and the source release for lawyers reviewing the enforcement development.",
    keywords: ["SFO enforcement", "Shareholder remedies", "Director disqualification", "SFC enforcement", "Regulatory action"],
    contentHtml: "<p>Body</p>",
    seen: false,
    sent: false,
    createdAt: "2026-06-18T00:00:00Z",
    updatedAt: "2026-06-18T00:00:00Z",
  },
];

const people: FirmPerson[] = [
  {
    id: 1,
    name: "Adrian Chan",
    title: "Partner",
    profileUrl: "https://terracotta.dev/people/adrian-chan",
    practiceAreas: ["Corporate and Commercial"],
    intro: "Profile",
    imageUrl: null,
  },
  {
    id: 2,
    name: "Jason Wong",
    title: "Associate",
    profileUrl: "https://terracotta.dev/people/jason-wong",
    practiceAreas: ["Regulatory Compliance"],
    intro: "Profile",
    imageUrl: null,
  },
];

describe("AlertsWorkspace", () => {
  it("renders the digest list and generator controls", () => {
    const { container } = render(React.createElement(AlertsWorkspace, { initialNews: news, people, syncError: null }));

    expect(screen.getByRole("heading", { name: /SFC Enforcement Daily/i })).toBeInTheDocument();
    expect(screen.getAllByText("seeks share buy-out order").length).toBeGreaterThan(0);
    expect(screen.getAllByRole("link", { name: /seeks share buy-out order/i }).some((link) => link.getAttribute("href") === "https://apps.sfc.hk/doc?refNo=26PR90")).toBe(true);
    expect(container.querySelector('a[href="#news-26PR90"]')).toBeNull();
    expect(screen.getByRole("button", { name: /Show news navigation/i })).toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: /Show news navigation/i }));
    fireEvent.click(screen.getByRole("button", { name: /Shareholder Remedies/i }));
    expect(container.querySelector('a[href="#news-26PR90"]')).toHaveTextContent("seeks share buy-out order");
    expect(screen.getAllByRole("group", { name: "Contact person" }).length).toBeGreaterThan(0);
    expect(screen.getAllByLabelText(/Adrian Chan/i).length).toBeGreaterThan(0);
    expect(screen.getAllByText("Partner").length).toBeGreaterThan(0);
    expect(screen.getAllByLabelText(/Jason Wong/i).length).toBeGreaterThan(0);
    expect(screen.getByText("SFO enforcement")).toBeInTheDocument();
    expect(screen.getAllByRole("button", { name: /Generate article/i }).length).toBeGreaterThan(0);
    expect(screen.queryByRole("link", { name: /Digest JSON/i })).toBeNull();
    expect(screen.getAllByText("Article list").length).toBeGreaterThan(0);
    expect(screen.getAllByRole("button", { name: /Generate article/i }).length).toBeGreaterThan(1);
    expect(screen.getAllByLabelText("Additional requirements").length).toBeGreaterThan(0);

    const newsGenerateButton = screen.getAllByRole("button", { name: /Generate article/i }).find((button) => !button.hasAttribute("disabled"));
    expect(newsGenerateButton).toBeDefined();
    fireEvent.click(newsGenerateButton!);

    expect(screen.getByRole("button", { name: /Added/i })).toBeInTheDocument();
    expect(screen.getAllByText("1/5").length).toBeGreaterThan(0);
    expect(screen.getAllByText(/Adrian Chan · Partner/i).length).toBeGreaterThan(0);
    expect(screen.getAllByLabelText(/Prompt direction 1/i).length).toBeGreaterThan(0);
    const customPrompt = screen.getAllByLabelText(/Custom prompt direction/i)[0];
    fireEvent.change(customPrompt, { target: { value: "Explain implications for licensed intermediaries." } });

    expect(customPrompt).toHaveValue("Explain implications for licensed intermediaries.");

    fireEvent.click(screen.getByRole("button", { name: /Collapse news navigation/i }));

    expect(screen.getByRole("button", { name: /Show news navigation/i })).toBeInTheDocument();
    expect(container.querySelector('a[href="#news-26PR90"]')).toBeNull();

    fireEvent.click(screen.getByRole("button", { name: /Show news navigation/i }));

    expect(container.querySelector('a[href="#news-26PR90"]')).toHaveTextContent("seeks share buy-out order");
  });
});
