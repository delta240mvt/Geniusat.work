export async function showConfiguration() {
  const dialog = document.createElement('dialog');
  dialog.className = 'reel-dialog configuration-dialog';
  dialog.setAttribute('aria-labelledby', 'configuration-title');
  dialog.innerHTML =
    '<div class="reel-panel-label">USTAWIENIA<button type="button" aria-label="Zamknij">×</button></div><h2 id="configuration-title">Konfiguracja i klucze</h2><p id="health-loading">Sprawdzam lokalne narzędzia…</p><div id="health-result"></div>';
  document.body.appendChild(dialog);
  dialog.showModal();
  dialog.querySelector('button').onclick = () => dialog.close();
  dialog.onclose = () => {
    dialog.remove();
    document.querySelector('#open-health')?.focus();
  };
  try {
    const response = await fetch('/api/health');
    if (!response.ok)
      throw new Error(
        'Nie udało się sprawdzić konfiguracji. Spróbuj ponownie.',
      );
    const data = await response.json();
    if (!dialog.isConnected) return;
    dialog.querySelector('#health-loading').textContent =
      'Edycja i eksport rolek działają lokalnie, bez kluczy API.';
    const result = dialog.querySelector('#health-result');
    for (const check of data.checks) {
      const row = document.createElement('div');
      row.className = 'health-row';
      const title = document.createElement('strong');
      title.textContent = `${check.ready ? '✓' : '○'} ${check.name}`;
      const detail = document.createElement('p');
      detail.textContent = check.detail;
      row.append(title, detail);
      result.appendChild(row);
    }
    const heading = document.createElement('h3');
    heading.textContent = 'Opcjonalne połączenia';
    result.appendChild(heading);
    for (const integration of data.integrations) {
      const row = document.createElement('details');
      row.className = 'health-row';
      const title = document.createElement('summary');
      title.textContent = `${integration.name} · ${integration.configured ? 'ustawione' : 'do skonfigurowania'}`;
      const detail = document.createElement('p');
      detail.textContent = integration.detail;
      const variables = document.createElement('code');
      variables.textContent = integration.variables.join(', ');
      row.append(title, detail, variables);
      result.appendChild(row);
    }
    const note = document.createElement('p');
    note.textContent = `${data.note} Klucze wpisz w lokalnym pliku .env.`;
    result.appendChild(note);
  } catch (error) {
    if (dialog.isConnected)
      dialog.querySelector('#health-loading').textContent = error.message;
  }
}
