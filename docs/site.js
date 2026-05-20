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
