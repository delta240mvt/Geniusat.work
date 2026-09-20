import assert from 'node:assert/strict';
import test from 'node:test';
import {getNavigationState, isNavigationItemActive, navigationSections} from '../public/navigation.js';

test('dashboard exposes the four requested sections in stable order', () => {
  assert.deepEqual(
    navigationSections.map((section) => section.label),
    ['Genius@Brains', 'Genius@Content', 'Genius@Scale', 'Ustawienia'],
  );
});

test('navigation maps important module views to expandable menu items', () => {
  assert.deepEqual(
    navigationSections.map((section) => section.items.map((item) => item.id)),
    [
      ['brains-summary', 'brains-radar', 'brains-analysis', 'brains-trends'],
      ['content-studio', 'content-flow', 'content-prompts', 'content-render'],
      ['scale-calendar', 'scale-history', 'scale-assets', 'scale-accounts'],
      ['settings-composio', 'settings-accounts', 'settings-hosting', 'settings-local'],
    ],
  );
});

test('navigation state keeps only the active section open and maps current view', () => {
  const state = getNavigationState({activeApp: 'brains', activeSubTab: 'radar'});

  assert.equal(state.openSection, 'brains');
  assert.equal(state.activeItem, 'brains-radar');
  assert.equal(isNavigationItemActive(navigationSections[0].items[1], state), true);
  assert.equal(isNavigationItemActive(navigationSections[1].items[0], state), false);
});
