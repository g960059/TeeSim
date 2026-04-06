import type { CenterlinePath, ViewPreset } from '../core';
import type {
  CaseIndexEntry,
  CaseIndexFile,
  CaseManifest,
  LandmarksAsset,
  LoadedCaseBundle,
  ProbePathAsset,
  RawCaseIndexEntry,
  RawCaseManifest,
  ViewAsset,
  ViewsAsset,
} from './types';
import { loadGlbActors, loadVtiVolume } from './runtime-loaders';

const CASES_BASE_PATH = '/cases';
const DEFAULT_CASE_VERSION = '0.1.0';
const DEFAULT_BUNDLE_VERSION = '0.1.0';
const IDENTITY_MATRIX_4X4 = [1, 0, 0, 0, 0, 1, 0, 0, 0, 0, 1, 0, 0, 0, 0, 1];
const DEFAULT_VIEW_VALIDATION = {
  approvedBy: null,
  approvedAt: null,
  status: 'pending' as const,
};

const fetchJson = async <T>(url: string): Promise<T> => {
  const response = await fetch(url);
  if (!response.ok) {
    throw new Error(`Failed to fetch ${url}: ${response.status} ${response.statusText}`);
  }

  return (await response.json()) as T;
};

const getCaseBasePath = (entry: CaseIndexEntry): string =>
  `${CASES_BASE_PATH}/${entry.bundleVersion}/${entry.id}`;

const getAssetUrl = (entry: CaseIndexEntry, relativePath: string): string =>
  `${getCaseBasePath(entry)}/${relativePath}`;

const dedupeStrings = (values: readonly string[]): string[] =>
  values.filter((value, index) => values.indexOf(value) === index);

const normalizeCaseIndexEntry = (entry: RawCaseIndexEntry): CaseIndexEntry => {
  const id = entry.id ?? entry.caseId;
  if (!id) {
    throw new Error('Case index entry is missing both "id" and "caseId".');
  }

  return {
    id,
    title: entry.title,
    description: entry.description,
    bundleVersion: entry.bundleVersion ?? DEFAULT_BUNDLE_VERSION,
    caseVersion: entry.caseVersion ?? DEFAULT_CASE_VERSION,
  };
};

const normalizeCaseManifest = (
  entry: CaseIndexEntry,
  manifest: RawCaseManifest,
  views: ViewsAsset,
  landmarks: LandmarksAsset | null,
): CaseManifest => {
  const derivedStructures = dedupeStrings([
    ...(manifest.structures ?? []),
    ...views.flatMap((view) => view.targetStructures ?? []),
    ...((landmarks?.points ?? []).flatMap((point) => (point.structureId ? [point.structureId] : []))),
  ]);

  return {
    schemaVersion: manifest.schemaVersion ?? '1.0.0',
    caseId: manifest.caseId,
    caseVersion: manifest.caseVersion ?? entry.caseVersion,
    bundleVersion: manifest.bundleVersion ?? entry.bundleVersion,
    coordinateSystem: manifest.coordinateSystem ?? 'RAS',
    units: manifest.units ?? 'mm',
    worldFromImage: manifest.worldFromImage ?? IDENTITY_MATRIX_4X4,
    worldFromMesh: manifest.worldFromMesh ?? IDENTITY_MATRIX_4X4,
    generator: {
      pipelineVersion: manifest.generator?.pipelineVersion ?? 'unknown',
      gitCommit: manifest.generator?.gitCommit ?? 'unknown',
      generatedAt: manifest.generator?.generatedAt ?? 'unknown',
    },
    sources: manifest.sources ?? [],
    structures: derivedStructures,
    assets: manifest.assets,
    metadata: manifest.metadata,
  };
};

const toCenterlinePath = (asset: ProbePathAsset): CenterlinePath => {
  if (Array.isArray(asset.points) && asset.points.length > 0 && Array.isArray(asset.points[0])) {
    if (!asset.arcLengthMm || !asset.frames) {
      throw new Error('Probe path asset is missing arc lengths or parallel-transport frames.');
    }

    if (
      asset.points.length !== asset.arcLengthMm.length ||
      asset.points.length !== asset.frames.length
    ) {
      throw new Error('Probe path asset has mismatched points, arcLengthMm, and frame counts.');
    }

    const positions = asset.points as unknown as readonly [number, number, number][];

    return {
      coordinateSystem: asset.coordinateSystem,
      points: positions.map((position, index) => ({
        position,
        arcLengthMm: asset.arcLengthMm![index],
        tangent: asset.frames![index].tangent,
        normal: asset.frames![index].normal,
        binormal: asset.frames![index].binormal,
      })),
      sampleSpacingMm: asset.sampleSpacingMm,
      stations: asset.stations?.map((station) => ({
        id: station.id,
        sRange: station.sRange ?? station.sRangeMm ?? [0, 0],
      })),
      units: asset.units,
    };
  }

  return {
    coordinateSystem: asset.coordinateSystem,
    points: asset.points as CenterlinePath['points'],
    sampleSpacingMm: asset.sampleSpacingMm,
    stations: asset.stations?.map((station) => ({
      id: station.id,
      sRange: station.sRange ?? station.sRangeMm ?? [0, 0],
    })),
    units: asset.units,
  };
};

const normalizeViewAsset = (view: ViewAsset): ViewPreset => {
  const angleRange = view.tolerance?.angleDeg;
  const ranges =
    view.ranges ??
    (view.tolerance
      ? {
          sMm: view.tolerance.sMm,
          rollDeg: angleRange,
          anteDeg: angleRange,
          lateralDeg: angleRange,
          omniplaneDeg: angleRange,
        }
      : undefined);

  return {
    id: view.id,
    label: view.label,
    aseCode: view.aseCode,
    station: view.station,
    probePose: view.probePose,
    validation: view.validation ?? DEFAULT_VIEW_VALIDATION,
    weights: view.weights,
    ranges,
  };
};

export const loadCaseIndex = async (): Promise<CaseIndexEntry[]> => {
  const index = await fetchJson<CaseIndexFile>(`${CASES_BASE_PATH}/index.json`);
  return index.cases.map(normalizeCaseIndexEntry);
};

export const loadCaseBundle = async (entry: CaseIndexEntry): Promise<LoadedCaseBundle> => {
  const manifest = await fetchJson<RawCaseManifest>(`${getCaseBasePath(entry)}/case_manifest.json`);

  if (manifest.caseId !== entry.id) {
    throw new Error(
      `Case bundle mismatch: index requested "${entry.id}" but manifest declares "${manifest.caseId}".`,
    );
  }

  const [probePathAsset, rawViews, landmarks, sceneMeshes, heartDetailMeshes, volume] = await Promise.all([
    fetchJson<ProbePathAsset>(getAssetUrl(entry, manifest.metadata.probePath)),
    fetchJson<ViewsAsset>(getAssetUrl(entry, manifest.metadata.views)),
    manifest.metadata.landmarks
      ? fetchJson<LandmarksAsset>(getAssetUrl(entry, manifest.metadata.landmarks))
      : Promise.resolve(null),
    manifest.assets?.sceneGlb?.path
      ? loadGlbActors(getAssetUrl(entry, manifest.assets.sceneGlb.path))
      : Promise.resolve([]),
    manifest.assets?.heartDetailGlb?.path
      ? loadGlbActors(getAssetUrl(entry, manifest.assets.heartDetailGlb.path))
      : Promise.resolve([]),
    manifest.assets?.heartRoiVti?.path
      ? loadVtiVolume(getAssetUrl(entry, manifest.assets.heartRoiVti.path))
      : Promise.resolve(null),
  ]);
  const views = rawViews.map(normalizeViewAsset);
  const normalizedManifest = normalizeCaseManifest(entry, manifest, rawViews, landmarks);

  return {
    entry,
    manifest: normalizedManifest,
    meshes: [...sceneMeshes, ...heartDetailMeshes],
    probePath: toCenterlinePath(probePathAsset),
    volume,
    views,
  };
};
