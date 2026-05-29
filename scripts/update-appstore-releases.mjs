import { readFile, writeFile } from 'node:fs/promises';

const COUNTRY = process.env.APP_STORE_COUNTRY || 'gb';
const OUTPUT_PATH = 'docs/assets/appstore-updates.json';

const APPS = [
  {
    key: 'payforge',
    name: 'PayForge',
    appId: '6766063577',
    fallbackStoreUrl: 'https://apps.apple.com/gb/app/payforge/id6766063577?uo=4'
  },
  {
    key: 'forgeshift',
    name: 'ForgeShift',
    appId: '6762021609',
    fallbackStoreUrl: 'https://apps.apple.com/gb/app/forgeshift/id6762021609?uo=4'
  },
  {
    key: 'forgetrack',
    name: 'ForgeTrack',
    appId: null,
    fallbackStoreUrl: null
  }
];

const toIsoDate = (value) => {
  if (!value) return null;
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return null;
  return date.toISOString();
};

const releaseIdentity = (release) => {
  if (!release?.version) return null;
  return [release.version, release.releaseDate || ''].join('|');
};

const toReleaseSnapshot = (appData) => {
  if (!appData?.version) return null;

  return {
    version: appData.version,
    releaseDate: appData.releaseDate || null,
    notes: appData.notes || null,
    appStoreUrl: appData.appStoreUrl || null
  };
};

const sortReleasesNewestFirst = (a, b) => {
  const aTime = a.releaseDate ? new Date(a.releaseDate).getTime() : 0;
  const bTime = b.releaseDate ? new Date(b.releaseDate).getTime() : 0;

  if (Number.isNaN(aTime) && Number.isNaN(bTime)) return 0;
  if (Number.isNaN(aTime)) return 1;
  if (Number.isNaN(bTime)) return -1;
  return bTime - aTime;
};

const mergeReleaseHistory = (latest, priorApp) => {
  const releases = [];
  const addRelease = (release) => {
    const snapshot = toReleaseSnapshot(release);
    const identity = releaseIdentity(snapshot);
    if (!identity || releases.some((existing) => releaseIdentity(existing) === identity)) return;
    releases.push(snapshot);
  };

  addRelease(latest);

  if (Array.isArray(priorApp?.releaseHistory)) {
    priorApp.releaseHistory.forEach(addRelease);
  }

  addRelease(priorApp);

  releases.sort(sortReleasesNewestFirst);
  return releases;
};

const fetchAppData = async (app) => {
  if (!app.appId) {
    return {
      key: app.key,
      name: app.name,
      appId: null,
      status: 'missing_app_id',
      version: null,
      releaseDate: null,
      notes: null,
      appStoreUrl: app.fallbackStoreUrl
    };
  }

  const url = `https://itunes.apple.com/lookup?id=${encodeURIComponent(app.appId)}&country=${encodeURIComponent(COUNTRY)}`;
  const response = await fetch(url, {
    headers: { Accept: 'application/json' }
  });

  if (!response.ok) {
    throw new Error(`Lookup failed for ${app.key} (${response.status})`);
  }

  const body = await response.json();
  const first = Array.isArray(body?.results) ? body.results[0] : null;

  if (!first) {
    return {
      key: app.key,
      name: app.name,
      appId: app.appId,
      status: 'not_found',
      version: null,
      releaseDate: null,
      notes: null,
      appStoreUrl: app.fallbackStoreUrl
    };
  }

  return {
    key: app.key,
    name: app.name,
    appId: app.appId,
    status: 'ok',
    version: first.version || null,
    releaseDate: toIsoDate(first.currentVersionReleaseDate),
    notes: first.releaseNotes || null,
    appStoreUrl: first.trackViewUrl || app.fallbackStoreUrl
  };
};

const run = async () => {
  const priorRaw = await readFile(OUTPUT_PATH, 'utf8').catch(() => null);
  const prior = priorRaw ? JSON.parse(priorRaw) : null;

  const latestApps = [];
  for (const app of APPS) {
    const latest = await fetchAppData(app);
    const priorApp = prior?.apps?.[app.key] || null;
    const priorVersion = priorApp?.version || null;
    latest.previousVersion = priorVersion;
    latest.hasUpdate = Boolean(latest.version && priorVersion && latest.version !== priorVersion);
    latest.releaseHistory = mergeReleaseHistory(latest, priorApp);
    latest.previousUpdates = latest.releaseHistory.slice(1);
    latestApps.push(latest);
  }

  const payload = {
    source: 'itunes-lookup',
    country: COUNTRY,
    generatedAt: new Date().toISOString(),
    apps: Object.fromEntries(latestApps.map((app) => [app.key, app]))
  };

  await writeFile(OUTPUT_PATH, `${JSON.stringify(payload, null, 2)}\n`, 'utf8');

  const changed = latestApps
    .filter((app) => app.hasUpdate)
    .map((app) => `${app.name} ${app.previousVersion} -> ${app.version}`);

  if (changed.length > 0) {
    console.log(`Detected updates: ${changed.join(', ')}`);
  } else {
    console.log('No version changes detected.');
  }
};

run().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
