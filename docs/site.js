const themeButtons = document.querySelectorAll('[data-theme-choice]');
const themeIcons = document.querySelectorAll('[data-theme-icon]');
const systemTheme = window.matchMedia('(prefers-color-scheme: dark)');

const getStoredTheme = () => {
  try {
    return localStorage.getItem('forge-theme') || 'system';
  } catch (error) {
    return 'system';
  }
};

const storeTheme = (theme) => {
  try {
    localStorage.setItem('forge-theme', theme);
  } catch (error) {}
};

const resolveTheme = (theme) => {
  if (theme === 'light' || theme === 'dark') return theme;
  return systemTheme.matches ? 'dark' : 'light';
};

const syncIcons = (resolvedTheme) => {
  themeIcons.forEach((icon) => {
    const nextSource = resolvedTheme === 'dark' ? icon.dataset.darkSrc : icon.dataset.lightSrc;
    if (nextSource && icon.getAttribute('src') !== nextSource) {
      icon.setAttribute('src', nextSource);
    }
  });
};

const applyTheme = (theme) => {
  const resolvedTheme = resolveTheme(theme);

  if (theme === 'system') {
    document.documentElement.removeAttribute('data-theme');
  } else {
    document.documentElement.dataset.theme = theme;
  }

  document.documentElement.dataset.resolvedTheme = resolvedTheme;
  syncIcons(resolvedTheme);

  themeButtons.forEach((button) => {
    button.setAttribute('aria-pressed', String(button.dataset.themeChoice === theme));
  });
};

applyTheme(getStoredTheme());

const animateThemeChange = () => {
  if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) return;

  document.documentElement.classList.add('theme-transitioning');
  window.setTimeout(() => {
    document.documentElement.classList.remove('theme-transitioning');
  }, 460);
};

themeButtons.forEach((button) => {
  button.addEventListener('click', () => {
    const theme = button.dataset.themeChoice || 'system';
    if (theme === getStoredTheme()) return;

    animateThemeChange();
    storeTheme(theme);
    applyTheme(theme);
  });
});

const handleSystemThemeChange = () => {
  if (getStoredTheme() === 'system') applyTheme('system');
};

if (typeof systemTheme.addEventListener === 'function') {
  systemTheme.addEventListener('change', handleSystemThemeChange);
} else if (typeof systemTheme.addListener === 'function') {
  systemTheme.addListener(handleSystemThemeChange);
}

const contactForm = document.querySelector('[data-contact-form]');
const appUpdateCards = document.querySelectorAll('[data-app-updates]');

if (contactForm) {
  contactForm.addEventListener('submit', (event) => {
    event.preventDefault();

    const data = new FormData(contactForm);
    const app = data.get('app') || 'Forge Apps';
    const name = data.get('name') || 'Not provided';
    const email = data.get('email') || 'Not provided';
    const device = data.get('device') || 'Not provided';
    const message = data.get('message') || '';

    const subject = encodeURIComponent(`${app} support request`);
    const body = encodeURIComponent([
      `Name: ${name}`,
      `Email: ${email}`,
      `App: ${app}`,
      `Device / iOS: ${device}`,
      '',
      'Message:',
      message
    ].join('\n'));

    window.location.href = `mailto:support@louisbirch.co.uk?subject=${subject}&body=${body}`;
  });
}

const formatReleaseDate = (isoDate) => {
  if (!isoDate) return null;
  const parsed = new Date(isoDate);
  if (Number.isNaN(parsed.getTime())) return null;
  return new Intl.DateTimeFormat('en-GB', {
    day: 'numeric',
    month: 'short',
    year: 'numeric'
  }).format(parsed);
};

const releaseIdentity = (release) => {
  if (!release) return '';
  return [release.version || '', release.releaseDate || ''].join('|');
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

const getPreviousUpdates = (appData) => {
  if (Array.isArray(appData?.previousUpdates)) return appData.previousUpdates.filter((release) => release?.version);

  const currentRelease = currentReleaseFromApp(appData);
  const currentIdentity = releaseIdentity(currentRelease);
  return (Array.isArray(appData?.releaseHistory) ? appData.releaseHistory : [])
    .filter((release) => release?.version && releaseIdentity(release) !== currentIdentity);
};

const appendText = (parent, tagName, className, text) => {
  const child = document.createElement(tagName);
  if (className) child.className = className;
  child.textContent = text;
  parent.appendChild(child);
  return child;
};

const renderUpdateHistory = (element, appData) => {
  const history = element.querySelector('[data-update-history]');
  if (!history) return;

  history.replaceChildren();

  if (!appData || appData.status === 'missing_app_id' || !appData.version) {
    history.hidden = true;
    return;
  }

  history.hidden = false;

  const details = document.createElement('details');
  details.className = 'update-history';

  const previousUpdates = getPreviousUpdates(appData);
  const summaryText = previousUpdates.length === 1
    ? 'Previous update'
    : `Previous updates${previousUpdates.length > 0 ? ` (${previousUpdates.length})` : ''}`;
  appendText(details, 'summary', null, summaryText);

  const list = document.createElement('div');
  list.className = 'update-history-list';

  if (previousUpdates.length === 0) {
    appendText(list, 'p', 'update-history-empty', 'Previous App Store updates will appear here after a newer version is detected.');
  } else {
    previousUpdates.forEach((release) => {
      const item = document.createElement('article');
      item.className = 'update-history-item';

      const heading = appendText(item, 'h3', null, `Version ${release.version}`);
      if (release.appStoreUrl) {
        const releaseLink = document.createElement('a');
        releaseLink.href = release.appStoreUrl;
        releaseLink.target = '_blank';
        releaseLink.rel = 'noopener noreferrer';
        releaseLink.textContent = heading.textContent;
        heading.replaceChildren(releaseLink);
      }

      const formattedDate = formatReleaseDate(release.releaseDate);
      if (formattedDate) appendText(item, 'p', 'update-history-date', formattedDate);
      appendText(item, 'p', 'update-history-notes', release.notes || 'No release notes were provided for this version.');

      list.appendChild(item);
    });
  }

  details.appendChild(list);
  history.appendChild(details);
};

const renderUpdateCard = (element, appData) => {
  const title = element.querySelector('[data-update-title]');
  const version = element.querySelector('[data-update-version]');
  const date = element.querySelector('[data-update-date]');
  const notes = element.querySelector('[data-update-notes]');
  const link = element.querySelector('[data-update-link]');
  renderUpdateHistory(element, appData);

  if (!appData || appData.status === 'missing_app_id') {
    if (element.dataset.appComingSoon === 'true') {
      if (title) title.textContent = 'Update history available after launch';
      if (version) version.textContent = 'WatchCue is not yet published on the App Store.';
      if (date) date.textContent = '';
      if (notes) notes.textContent = 'Release notes and previous versions will appear here automatically once WatchCue launches.';
      if (link) link.hidden = true;
      return;
    }

    if (title) title.textContent = 'App Store feed pending';
    if (version) version.textContent = 'No App Store ID configured yet for this app.';
    if (date) date.textContent = '';
    if (notes) notes.textContent = 'Set the app ID in the update script to enable automatic release-note syncing.';
    if (link) link.hidden = true;
    return;
  }

  if (!appData.version) {
    if (title) title.textContent = 'No published update data yet';
    if (version) version.textContent = 'We could not find version details from the App Store feed.';
    if (date) date.textContent = '';
    if (notes) notes.textContent = 'Check back soon after the next release.';
    if (link) link.hidden = !appData.appStoreUrl;
    if (link && appData.appStoreUrl) link.href = appData.appStoreUrl;
    return;
  }

  if (title) title.textContent = `Version ${appData.version}`;
  if (version) version.textContent = appData.hasUpdate && appData.previousVersion
    ? `Updated from ${appData.previousVersion} to ${appData.version}.`
    : `Latest version currently listed on the App Store.`;
  if (date) date.textContent = formatReleaseDate(appData.releaseDate) || '';
  if (notes) notes.textContent = appData.notes || 'No release notes were provided for this version.';
  if (link && appData.appStoreUrl) {
    link.hidden = false;
    link.href = appData.appStoreUrl;
  }
};

const loadAppStoreUpdates = async () => {
  if (appUpdateCards.length === 0) return;

  try {
    const response = await fetch('./assets/appstore-updates.json', { cache: 'no-store' });
    if (!response.ok) throw new Error(`Failed to load app updates: ${response.status}`);
    const payload = await response.json();

    appUpdateCards.forEach((card) => {
      const appKey = card.dataset.appUpdates;
      const appData = payload?.apps?.[appKey] || null;
      renderUpdateCard(card, appData);
    });
  } catch (error) {
    appUpdateCards.forEach((card) => {
      const title = card.querySelector('[data-update-title]');
      const version = card.querySelector('[data-update-version]');
      const date = card.querySelector('[data-update-date]');
      const notes = card.querySelector('[data-update-notes]');
      const link = card.querySelector('[data-update-link]');
      const history = card.querySelector('[data-update-history]');

      if (title) title.textContent = 'Unable to load updates';
      if (version) version.textContent = 'The App Store feed is temporarily unavailable.';
      if (date) date.textContent = '';
      if (notes) notes.textContent = 'Please try refreshing this page in a moment.';
      if (history) {
        history.replaceChildren();
        history.hidden = true;
      }
      if (link) link.hidden = true;
    });
  }
};

loadAppStoreUpdates();
