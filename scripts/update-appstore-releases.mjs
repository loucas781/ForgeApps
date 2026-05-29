import { readFile, writeFile } from 'node:fs/promises';

const COUNTRY = process.env.APP_STORE_COUNTRY || 'gb';
const OUTPUT_PATH = 'docs/assets/appstore-updates.json';
const HISTORY_PLATFORMS = ['ios', 'iphone', 'ipad'];

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

const releaseIdentity = (release) => release?.version || null;

const toReleaseSnapshot = (appData) => {
  const version = appData?.version || appData?.versionDisplay || appData?.versionString || null;
  if (!version) return null;

  return {
    version,
    releaseDate: toIsoDate(appData.releaseDate || appData.releaseTimestamp || appData.date),
    notes: appData.notes || appData.releaseNotes || null,
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

const mergeReleaseHistory = (latest, priorApp, storeReleaseHistory = []) => {
  const releases = [];
  const addRelease = (release) => {
    const snapshot = toReleaseSnapshot(release);
    const identity = releaseIdentity(snapshot);
    if (!identity || releases.some((existing) => releaseIdentity(existing) === identity)) return;
    releases.push(snapshot);
  };

  addRelease(latest);
  storeReleaseHistory.forEach(addRelease);

  if (Array.isArray(priorApp?.releaseHistory)) {
    priorApp.releaseHistory.forEach(addRelease);
  }

  addRelease(priorApp);

  releases.sort(sortReleasesNewestFirst);
  return releases;
};

const extractAmpApiToken = (html) => {
  const encodedToken = /token%22%3A%22([^%]+)%22%7D/.exec(html);
  if (encodedToken?.[1]) return encodedToken[1];

  const plainToken = /"token":"([^"]+)"/.exec(html);
  if (plainToken?.[1]) return plainToken[1];

  return null;
};

const findVersionHistory = (platformAttributes) => {
  if (!platformAttributes || typeof platformAttributes !== 'object') return [];

  for (const platform of HISTORY_PLATFORMS) {
    const history = platformAttributes[platform]?.versionHistory;
    if (Array.isArray(history)) return history;
  }

  const fallback = Object.values(platformAttributes)
    .map((platform) => platform?.versionHistory)
    .find(Array.isArray);

  return fallback || [];
};

const fetchVersionHistory = async (app) => {
  if (!app.appId) return [];

  const country = COUNTRY.toLowerCase();
  const appPageUrl = `https://apps.apple.com/${encodeURIComponent(country)}/app/id${encodeURIComponent(app.appId)}`;
  const pageResponse = await fetch(appPageUrl, {
    headers: { Accept: 'text/html' }
  });

  if (!pageResponse.ok) {
    throw new Error(`Version history page failed for ${app.key} (${pageResponse.status})`);
  }

  const pageHtml = await pageResponse.text();
  const token = extractAmpApiToken(pageHtml);

  if (!token) {
    throw new Error(`Version history token missing for ${app.key}`);
  }

  const historyParams = new URLSearchParams({
    platform: 'web',
    extend: 'versionHistory',
    additionalPlatforms: 'appletv,ipad,iphone,mac,realityDevice'
  });
  const historyUrl = `https://amp-api-edge.apps.apple.com/v1/catalog/${encodeURIComponent(country)}/apps/${encodeURIComponent(app.appId)}?${historyParams}`;

  const historyResponse = await fetch(historyUrl, {
    headers: {
      Accept: 'application/json',
      Authorization: `Bearer ${token}`,
      Origin: 'https://apps.apple.com'
    }
  });

  if (!historyResponse.ok) {
    throw new Error(`Version history lookup failed for ${app.key} (${historyResponse.status})`);
  }

  const body = await historyResponse.json();
  const platformAttributes = body?.data?.[0]?.attributes?.platformAttributes;

  return findVersionHistory(platformAttributes)
    .map((release) => ({
      ...release,
      appStoreUrl: release.appStoreUrl || app.fallbackStoreUrl
    }))
    .map(toReleaseSnapshot)
    .filter(Boolean);
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
    let storeReleaseHistory = [];

    if (latest.status === 'ok') {
      try {
        storeReleaseHistory = await fetchVersionHistory(app);
        latest.historyStatus = 'ok';
      } catch (error) {
        latest.historyStatus = 'unavailable';
        latest.historyError = error.message;
        console.warn(`Unable to fetch version history for ${app.name}: ${error.message}`);
      }
    }

    latest.previousVersion = priorVersion;
    latest.hasUpdate = Boolean(latest.version && priorVersion && latest.version !== priorVersion);
    latest.releaseHistory = mergeReleaseHistory(latest, priorApp, storeReleaseHistory);
    latest.previousUpdates = latest.releaseHistory.slice(1);
    latestApps.push(latest);
  }

  const payload = {
    source: 'itunes-lookup',
    historySource: 'app-store-web-version-history',
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
