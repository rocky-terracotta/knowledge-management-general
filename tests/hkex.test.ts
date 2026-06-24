import { describe, expect, it } from "vitest";
import { parseHkexAnnouncementContent, parseHkexAnnouncements } from "@/lib/hkex";

describe("HKEx adapter", () => {
  it("parses regulatory announcement rows with HKEx source URLs", () => {
    const html = `
      <div class="section_container_in whats_on_tdy">
        <div class="whats_on_tdy_row"><div class="whats_on_tdy_ball"><div class="whats_on_tdy_ball_number"><div>18</div></div><div>Jun 2026</div></div><div class="whats_on_tdy_right"><div class="whats_on_tdy_row_in"><div class="whats_on_tdy_text_container w-inline-block"><div class="whats_on_tdy_text_1"><a href="/News/Regulatory-Announcements?sc_lang=en&Category=Regulatory">Regulatory</a></div><div class="whats_on_tdy_text_2"><a href="/News/Regulatory-Announcements/2026/2606183news?sc_lang=en" target="_blank">Announcement - In relation to the matter of Ruixin International Holdings Limited  (incorporated in Bermuda with limited liability) (Stock Code: 724) Cancellation of listing</a></div><div class="whats_on_tdy_text_3"><div></div></div></div></div></div></div>
        <div class="whats_on_tdy_row"><div class="whats_on_tdy_ball"><div class="whats_on_tdy_ball_number"><div>12</div></div><div>Mar 2026</div></div><div class="whats_on_tdy_right"><div class="whats_on_tdy_row_in"><div class="whats_on_tdy_text_container w-inline-block"><div class="whats_on_tdy_text_1"><a href="/News/Regulatory-Announcements?sc_lang=en&Category=Regulatory">Regulatory</a></div><div class="whats_on_tdy_text_2"><a href="/News/Regulatory-Announcements/2026/2603122news?sc_lang=en" target="_blank">Announcement - In relation to the matter of China e-Wallet Payment Group Limited  (incorporated in Bermuda with limited liability) (Stock Code: 802) Cancellation of listing</a></div><div class="whats_on_tdy_text_3"><div></div></div></div></div></div></div>
        <div class="whats_on_tdy_more_row grid"></div>
      </div>
    `;

    const items = parseHkexAnnouncements(html);

    expect(items).toHaveLength(2);
    expect(items[0]).toMatchObject({
      newsRefNo: "hkex-2606183news",
      sourceUrl: "https://www.hkex.com.hk/News/Regulatory-Announcements/2026/2606183news?sc_lang=en",
      newsType: "HKEX_REGULATORY",
    });
    expect(items[1].title).toContain("China e-Wallet Payment Group Limited");
    expect(items[1].issueDate).toContain("2026-03-12");
  });

  it("extracts the HKEx article body", () => {
    const content = parseHkexAnnouncementContent(
      `
        <h1>Announcement - Test</h1>
        <div class="news-timetag-container" data-news-last-updated="1781775000"> 18 Jun 2026</div>
        <div class="listing-committee__brief"><p>The Exchange announces that the listing will be cancelled.</p><p>Ends</p></div>
        <div class="container loadMore__timetag-container"></div>
      `,
      {
        newsRefNo: "hkex-2606183news",
        lang: "EN",
        title: "Fallback",
        newsExtLink: null,
        newsType: "HKEX_REGULATORY",
        issueDate: "2026-06-18T08:00:00.000Z",
        modificationTime: null,
        targetCeList: [],
        sourceUrl: "https://www.hkex.com.hk/News/Regulatory-Announcements/2026/2606183news?sc_lang=en",
      },
    );

    expect(content.title).toBe("Announcement - Test");
    expect(content.issueDate).toContain("2026-06-18");
    expect(content.html).toContain("listing will be cancelled");
  });
});
