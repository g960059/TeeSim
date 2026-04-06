import type { CenterlinePath } from '../core';
import type {
  CaseIndexEntry,
  CaseIndexFile,
  CaseManifest,
  LoadedCaseBundle,
  ProbePathAsset,
  ViewsAsset,
} from './types';

const CASES_BASE_PATH = '/cases';

const fetchJson = async <T>(url: string): Promise<T> => {
  const response = await fetch(url);
  if (!response.ok) {
    throw new Error(`Failed to fetch ${url}: ${response.status} ${response.statusText}`);
  }

  return (await response.json()) as T;
};

const getCaseBasePath = (entry: CaseIndexEntry): string =>
  `${CASES_BASE_PATH}/${entry.bundleVersion}/${entry.id}`;

const toCenterlinePath = (asset: ProbePathAsset): CenterlinePath => ({
  coordinateSystem: asset.coordinateSystem,
  points: asset.points,
  sampleSpacingMm: asset.sampleSpacingMm,
  stations: asset.stations,
  units: asset.units,
});

export const loadCaseIndex = async (): Promise<CaseIndexEntry[]> => {
  const index = await fetchJson<CaseIndexFile>(`${CASES_BASE_PATH}/index.json`);
  return index.cases;
};

export const loadCaseBundle = async (entry: CaseIndexEntry): Promise<LoadedCaseBundle> => {
  const basePath = getCaseBasePath(entry);
  const manifest = await fetchJson<CaseManifest>(`${basePath}/case_manifest.json`);

  if (manifest.caseId !== entry.id) {
    throw new Error(
      `Case bundle mismatch: index requested "${entry.id}" but manifest declares "${manifest.caseId}".`,
    );
  }

  const [probePathAsset, views] = await Promise.all([
    fetchJson<ProbePathAsset>(`${basePath}/${manifest.metadata.probePath}`),
    fetchJson<ViewsAsset>(`${basePath}/${manifest.metadata.views}`),
  ]);

  return {
    entry,
    manifest,
    probePath: toCenterlinePath(probePathAsset),
    views,
  };
};
