(() => {
const updateHistoryCards = document.querySelectorAll('[data-app-updates]');

const formatHistoryReleaseDate = (isoDate) => {
  if (!isoDate) return null;
  const parsed = new Date(isoDate);
  if (Number.isNaN(parsed.getTime())) return null;
  return new Intl.DateTimeFormat('en-GB', {
    day: 'numeric',
    month: 'short',
    year: 'numeric'
  }).format(parsed);
};

const releaseIdentity = (release) => release?.version || '';

const sortReleasesNewestFirst = (a, b) => {
  const aTime = a?.releaseDate ? new Date(a.releaseDate).getTime() : 0;
  const bTime = b?.releaseDate ? new Date(b.releaseDate).getTime() : 0;

  if (Number.isNaN(aTime) && Number.isNaN(bTime)) return 0;
  if (Number.isNaN(aTime)) return 1;
  if (Number.isNaN(bTime)) return -1;
  return bTime - aTime;
};

const currentReleaseFromApp = (appData) => {
  if (!appData?.version) return null;
  return {
    version: appData.version,
    releaseDate: appData.releaseDate || null,
    notes: appData.notes || null,
    appStoreUrl: appData.appStoreUrl || null
  };
};

const mergeReleaseHistory = (appData, backfilledReleaseHistory = []) => {
  if (!appData) return [];

  const releases = [];
  const addRelease = (release) => {
    if (!release?.version || releases.some((existing) => releaseIdentity(existing) === releaseIdentity(release))) return;
    releases.push({
      version: release.version,
      releaseDate: release.releaseDate || null,
      notes: release.notes || null,
      appStoreUrl: release.appStoreUrl || appData.appStoreUrl || null
    });
  };

  addRelease(currentReleaseFromApp(appData));
  (Array.isArray(appData.releaseHistory) ? appData.releaseHistory : []).forEach(addRelease);
  (Array.isArray(appData.previousUpdates) ? appData.previousUpdates : []).forEach(addRelease);
  (Array.isArray(backfilledReleaseHistory) ? backfilledReleaseHistory : []).forEach(addRelease);

  releases.sort(sortReleasesNewestFirst);
  return releases;
};

const appendHistoryText = (parent, tagName, className, text) => {
  const child = document.createElement(tagName);
  if (className) child.className = className;
  child.textContent = text;
  parent.appendChild(child);
  return child;
};

const renderUpdateHistory = (element, appData, backfilledReleaseHistory = []) => {
  const history = element.querySelector('[data-update-history]');
  if (!history) return;

  history.replaceChildren();

  const releases = mergeReleaseHistory(appData, backfilledReleaseHistory);
  if (!appData || appData.status === 'missing_app_id' || releases.length === 0) {
    history.hidden = true;
    return;
  }

  const currentIdentity = releaseIdentity(currentReleaseFromApp(appData));
  const previousUpdates = releases.filter((release) => releaseIdentity(release) !== currentIdentity);
  history.hidden = false;

  const details = document.createElement('details');
  details.className = 'update-history';

  const summaryText = previousUpdates.length === 1
    ? 'Previous update'
    : `Previous updates${previousUpdates.length > 0 ? ` (${previousUpdates.length})` : ''}`;
  appendHistoryText(details, 'summary', null, summaryText);

  const list = document.createElement('div');
  list.className = 'update-history-list';

  if (previousUpdates.length === 0) {
    appendHistoryText(list, 'p', 'update-history-empty', 'No earlier App Store updates were found for this app yet.');
  } else {
    previousUpdates.forEach((release) => {
      const item = document.createElement('article');
      item.className = 'update-history-item';

      const heading = appendHistoryText(item, 'h3', null, `Version ${release.version}`);
      if (release.appStoreUrl) {
        const releaseLink = document.createElement('a');
        releaseLink.href = release.appStoreUrl;
        releaseLink.target = '_blank';
        releaseLink.rel = 'noopener noreferrer';
        releaseLink.textContent = heading.textContent;
        heading.replaceChildren(releaseLink);
      }

      const formattedDate = formatHistoryReleaseDate(release.releaseDate);
      if (formattedDate) appendHistoryText(item, 'p', 'update-history-date', formattedDate);
      appendHistoryText(item, 'p', 'update-history-notes', release.notes || 'No release notes were provided for this version.');

      list.appendChild(item);
    });
  }

  details.appendChild(list);
  history.appendChild(details);
};

const loadUpdateHistory = async () => {
  if (updateHistoryCards.length === 0) return;

  try {
    const [updatesResponse, historyResponse] = await Promise.all([
      fetch('./assets/appstore-updates.json', { cache: 'no-store' }),
      fetch('./assets/appstore-release-history.json', { cache: 'no-store' }).catch(() => null)
    ]);

    if (!updatesResponse.ok) throw new Error(`Failed to load app updates: ${updatesResponse.status}`);

    const updatesPayload = await updatesResponse.json();
    const historyPayload = historyResponse?.ok ? await historyResponse.json() : null;

    updateHistoryCards.forEach((card) => {
      const appKey = card.dataset.appUpdates;
      renderUpdateHistory(card, updatesPayload?.apps?.[appKey] || null, historyPayload?.apps?.[appKey] || []);
    });
  } catch (error) {
    updateHistoryCards.forEach((card) => {
      const history = card.querySelector('[data-update-history]');
      if (!history) return;
      history.replaceChildren();
      history.hidden = true;
    });
  }
};

loadUpdateHistory();
})();
