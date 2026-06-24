export type SfcNewsListItem = {
  newsRefNo: string;
  lang: string;
  title: string;
  newsExtLink: string | null;
  newsType: string;
  issueDate: string;
  modificationTime: string | null;
  targetCeList: Array<{ ceName: string; lang: string; masked: boolean }>;
};

export type SfcNewsContent = {
  newsRefNo: string;
  lang: string;
  title: string;
  html: string;
  issueDate: string;
  modificationTime: string | null;
  imageList: unknown[];
  appendixDocList: unknown[];
  maskedFooterType: string | null;
};

export type StoredNews = SfcNewsListItem & {
  source: "sfc" | "hkex";
  sourceUrl: string;
  summary: string | null;
  keywords: string[];
  contentHtml: string | null;
  seen: boolean;
  sent: boolean;
  createdAt: string;
  updatedAt: string;
};

export type FirmPerson = {
  id: number;
  name: string;
  profileUrl: string;
  title: string;
  practiceAreas: string[];
  intro: string;
  imageUrl: string | null;
};

export type ArticleDraft = {
  id: number;
  newsRefNo: string;
  personId: number | null;
  personName: string | null;
  personProfileUrl: string | null;
  anonymize: string;
  requirements: string;
  markdown: string;
  createdAt: string;
};

export type DigestPayload = {
  generatedAt: string;
  subject: string;
  items: Array<{
    newsRefNo: string;
    title: string;
    issueDate: string;
    summary: string;
    keywords: string[];
    sourceUrl: string;
  }>;
};

export type GenerateArticleInput = {
  newsRefNo: string;
  personId: number | null;
  personIds?: number[];
  anonymize: string;
  requirements: string;
};
