export const navigationSections = [
  {
    id: 'brains',
    label: 'Genius@Brains',
    eyebrow: 'Viral intelligence',
    icon: 'B',
    items: [
      {id: 'brains-summary', label: 'Podsumowanie', app: 'brains', tab: 'summary'},
      {id: 'brains-radar', label: 'Viral radar', app: 'brains', tab: 'radar'},
      {id: 'brains-analysis', label: 'Analiza treści', app: 'brains', tab: 'analysis'},
      {id: 'brains-trends', label: 'Trendy i raporty', app: 'brains', tab: 'trends'},
    ],
  },
  {
    id: 'content',
    label: 'Genius@Content',
    eyebrow: 'Studio treści',
    icon: 'C',
    items: [
      {id: 'content-studio', label: 'Studio rolek', app: 'content', workspace: 'reels', tab: 'studio'},
      {id: 'content-flow', label: 'Przepływ', app: 'content', workspace: 'reels', tab: 'flow'},
      {id: 'content-prompts', label: 'Scenariusze', app: 'content', workspace: 'reels', tab: 'prompts'},
      {id: 'content-render', label: 'Podgląd plików', app: 'content', workspace: 'reels', tab: 'render'},
    ],
  },
  {
    id: 'scale',
    label: 'Genius@Scale',
    eyebrow: 'Publikacja i dystrybucja',
    icon: 'S',
    items: [
      {id: 'scale-calendar', label: 'Kalendarz', app: 'scale', tab: 'calendar'},
      {id: 'scale-history', label: 'Historia', app: 'scale', tab: 'runs'},
      {id: 'scale-assets', label: 'Materiały', app: 'scale', tab: 'assets'},
      {id: 'scale-accounts', label: 'Połączenia', app: 'scale', tab: 'accounts'},
    ],
  },
  {
    id: 'settings',
    label: 'Ustawienia',
    eyebrow: 'Konfiguracja workspace',
    icon: '↗',
    items: [
      {id: 'settings-composio', label: 'Composio', app: 'scale', tab: 'accounts', anchor: 'composio-settings'},
      {id: 'settings-accounts', label: 'Konta natywne', app: 'scale', tab: 'accounts', anchor: 'pub-native-accounts'},
      {id: 'settings-hosting', label: 'Hosting mediów', app: 'scale', tab: 'accounts', anchor: 'pub-settings-extra'},
      {id: 'settings-local', label: 'Narzędzia lokalne', action: 'health'},
    ],
  },
];

export const getNavigationState = ({activeApp, activeSubTab}) => {
  const activeSection = navigationSections.find((section) => section.id === activeApp) || navigationSections[0];
  const activeItem = activeSection.items.find((item) => item.tab === activeSubTab)?.id || activeSection.items[0].id;
  return {openSection: activeSection.id, activeItem};
};

export const isNavigationItemActive = (item, state) => item.id === state.activeItem;
