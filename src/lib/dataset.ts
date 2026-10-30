import type { SiteInfo, SiteRecord } from "./types";

export interface Dataset {
  records: SiteRecord[];
  byKey: Map<string, SiteRecord>;
  /** 자료에 있는 월(오름차순) */
  months: string[];
  /** 현장 ID 순 */
  sites: SiteInfo[];
  siteMap: Map<string, SiteInfo>;
}

export function recordKey(month: string, siteId: string): string {
  return `${month}|${siteId}`;
}

/** "2026-09" → "2026-08", "2026-01" → "2025-12" */
export function prevMonth(month: string): string {
  const [y, m] = month.split("-").map(Number);
  return m === 1 ? `${y - 1}-12` : `${y}-${String(m - 1).padStart(2, "0")}`;
}

/** "2026-02" → "2026-02-28" (윤년 반영) */
export function monthEndDate(month: string): string {
  const [y, m] = month.split("-").map(Number);
  const last = new Date(Date.UTC(y, m, 0)).getUTCDate();
  return `${month}-${String(last).padStart(2, "0")}`;
}

export function buildDataset(records: SiteRecord[]): Dataset {
  const byKey = new Map<string, SiteRecord>();
  const siteMap = new Map<string, SiteInfo>();
  const monthSet = new Set<string>();
  for (const r of records) {
    byKey.set(recordKey(r.month, r.siteId), r);
    monthSet.add(r.month);
    if (!siteMap.has(r.siteId)) {
      siteMap.set(r.siteId, {
        siteId: r.siteId,
        siteName: r.siteName,
        region: r.region,
        projectType: r.projectType,
        contractAmount: r.contractAmount,
        startDate: r.startDate,
        contractEndDate: r.contractEndDate,
      });
    }
  }
  const months = [...monthSet].sort();
  const sites = [...siteMap.values()].sort((a, b) => a.siteId.localeCompare(b.siteId));
  return { records, byKey, months, sites, siteMap };
}
