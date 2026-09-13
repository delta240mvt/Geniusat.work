import type {ContentHistoryEvent, ContentItem} from '../config/schema.js';

const appendHistory = (item: ContentItem, event: ContentHistoryEvent): ContentItem => ({
  ...item,
  history: [...item.history, event],
});

export const prepareContentItems = (items: ContentItem[], createdAt = new Date().toISOString()): ContentItem[] =>
  items.map((item) =>
    appendHistory(
      {
        ...item,
        status: item.status === 'draft' ? 'ready' : item.status,
      },
      {
        type: 'prepare',
        status: 'ok',
        createdAt,
      },
    ),
  );
