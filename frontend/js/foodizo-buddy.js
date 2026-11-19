(function () {
  'use strict';

  const widget = document.getElementById('foodizo-buddy');
  if (!widget) return;

  const appConfig = window.FoodizoAppConfig || {
    outlet: 'FOODIZO_HAM_TOWERS',
    brandName: 'Foodizo'
  };
  const buddyName = `${appConfig.brandName} Buddy`;
  const toggle = widget.querySelector('[data-buddy-toggle]');
  const panel = widget.querySelector('[data-buddy-panel]');
  const closeButton = widget.querySelector('[data-buddy-close]');
  const messages = widget.querySelector('[data-buddy-messages]');
  const status = widget.querySelector('[data-buddy-status]');
  const form = widget.querySelector('[data-buddy-form]');
  const input = widget.querySelector('[data-buddy-input]');
  const submit = widget.querySelector('[data-buddy-submit]');
  const prompts = widget.querySelector('[data-buddy-prompts]');
  const outletSelect = document.getElementById('home-outlet');
  let recentQuestions = [];
  let busy = false;

  if (!toggle || !panel || !messages || !form || !input || !submit || !prompts) return;

  function appendMessage(role, text) {
    const message = document.createElement('div');
    message.className = 'foodizo-buddy-message';
    message.dataset.role = role;

    const label = document.createElement('strong');
    label.textContent = role === 'user' ? 'You' : buddyName;

    const body = document.createElement('p');
    body.textContent = text;

    message.append(label, body);
    messages.appendChild(message);
    messages.scrollTop = messages.scrollHeight;
  }

  function setBusy(value) {
    busy = value;
    input.disabled = value;
    submit.disabled = value;
    prompts.querySelectorAll('button').forEach((button) => {
      button.disabled = value;
    });
    if (status) status.textContent = value ? `${buddyName} is checking the menu…` : '';
  }

  function setOpen(open) {
    panel.hidden = !open;
    toggle.setAttribute('aria-expanded', String(open));
    if (open) input.focus();
    else toggle.focus();
  }

  async function sendMessage(value) {
    const message = String(value || '').trim();
    if (!message || busy) return;

    appendMessage('user', message);
    input.value = '';
    const history = recentQuestions.slice(-4);
    recentQuestions = [...history, message].slice(-4);
    setBusy(true);

    try {
      const response = await fetch('/api/v1/buddy/chat', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          outlet: outletSelect && outletSelect.value
            ? outletSelect.value
            : appConfig.outlet,
          message,
          history
        })
      });

      let payload;
      try {
        payload = await response.json();
      } catch (error) {
        if (error instanceof SyntaxError) {
          throw new Error('The Buddy service returned an unreadable response. Please try again.');
        }
        throw error;
      }

      if (!response.ok) {
        throw new Error(
          payload && typeof payload.message === 'string'
            ? payload.message
            : `${buddyName} could not answer right now. Please try again shortly.`
        );
      }
      if (!payload || typeof payload.answer !== 'string' || !payload.answer.trim()) {
        throw new Error(`${buddyName} returned no answer. Please try again.`);
      }

      appendMessage('buddy', payload.answer);
    } catch (error) {
      const detail = error instanceof Error
        ? error.message
        : 'Please check your connection and try again.';
      appendMessage('buddy', `Sorry, I couldn't answer that. ${detail}`);
    } finally {
      setBusy(false);
      if (!panel.hidden) input.focus();
    }
  }

  toggle.addEventListener('click', () => setOpen(panel.hidden));
  if (closeButton) closeButton.addEventListener('click', () => setOpen(false));

  panel.addEventListener('keydown', (event) => {
    if (event.key === 'Escape') setOpen(false);
  });

  form.addEventListener('submit', (event) => {
    event.preventDefault();
    sendMessage(input.value);
  });

  prompts.addEventListener('click', (event) => {
    const target = event.target;
    if (!(target instanceof Element)) return;
    const button = target.closest('[data-buddy-prompt]');
    if (button instanceof HTMLButtonElement) sendMessage(button.dataset.buddyPrompt);
  });
})();
