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

themeButtons.forEach((button) => {
  button.addEventListener('click', () => {
    const theme = button.dataset.themeChoice || 'system';
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
