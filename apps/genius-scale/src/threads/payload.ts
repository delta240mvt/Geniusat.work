import type {ContentAsset, ContentItem} from '../config/schema.js';

export type ThreadsMediaType = 'TEXT' | 'IMAGE' | 'VIDEO' | 'CAROUSEL';

export interface ThreadsCreateRequest {
  media_type: ThreadsMediaType;
  text?: string;
  image_url?: string;
  video_url?: string;
  alt_text?: string;
  is_carousel_item?: true;
  children?: string[];
  reply_control?: string;
  reply_to_id?: string;
  topic_tag?: string;
}

export interface ThreadsDryRunPayload {
  platform: 'threads';
  itemId: string;
  projectId: string;
  requests: ThreadsCreateRequest[];
  publish: {
    creation_id: string;
  };
}

const requireThreadsOptions = (item: ContentItem) => {
  if (!item.platforms.threads) {
    throw new Error(`Content item ${item.id} requires Threads platform options.`);
  }

  return item.platforms.threads;
};

const missingPublicUrlPlaceholder = (asset: ContentAsset): string => `<missing-public-url:${asset.id}>`;

const requireAssetUrl = (
  asset: ContentAsset,
  field: 'image_url' | 'video_url',
  options: {allowMissingPublicUrl?: boolean},
): string => {
  if (!asset.publicUrl) {
    if (options.allowMissingPublicUrl) {
      return missingPublicUrlPlaceholder(asset);
    }

    throw new Error(`Threads ${field === 'image_url' ? 'image' : 'video'} asset ${asset.id} requires publicUrl.`);
  }

  return asset.publicUrl;
};

const addThreadOptions = (request: ThreadsCreateRequest, item: ContentItem): ThreadsCreateRequest => {
  const threads = requireThreadsOptions(item);

  return {
    ...request,
    ...(threads.replyControl ? {reply_control: threads.replyControl} : {}),
    ...(threads.replyToId ? {reply_to_id: threads.replyToId} : {}),
    ...(threads.topicTag ? {topic_tag: threads.topicTag} : {}),
  };
};

const buildMediaRequest = (
  asset: ContentAsset | undefined,
  options: {carouselItem: boolean; allowMissingPublicUrl?: boolean},
): ThreadsCreateRequest => {
  if (!asset) {
    throw new Error('Threads media payload requires an asset.');
  }

  const request =
    asset.type === 'image'
      ? {
          media_type: 'IMAGE' as const,
          image_url: requireAssetUrl(asset, 'image_url', options),
          ...(asset.altText ? {alt_text: asset.altText} : {}),
        }
      : {
          media_type: 'VIDEO' as const,
          video_url: requireAssetUrl(asset, 'video_url', options),
        };

  return {
    ...request,
    ...(options.carouselItem ? {is_carousel_item: true as const} : {}),
  };
};

export const buildThreadsCreateRequests = (item: ContentItem): ThreadsCreateRequest[] => {
  const threads = requireThreadsOptions(item);

  if (threads.postType === 'text') {
    return [addThreadOptions({media_type: 'TEXT', text: item.body}, item)];
  }

  if (threads.postType === 'image' || threads.postType === 'video') {
    return [addThreadOptions({...buildMediaRequest(item.assets[0], {carouselItem: false}), text: item.body}, item)];
  }

  const children = item.assets.map((asset) => buildMediaRequest(asset, {carouselItem: true}));

  return [
    ...children,
    addThreadOptions(
      {
        media_type: 'CAROUSEL',
        text: item.body,
        children: [],
      },
      item,
    ),
  ];
};

const buildThreadsDryRunCreateRequests = (item: ContentItem): ThreadsCreateRequest[] => {
  const threads = requireThreadsOptions(item);

  if (threads.postType === 'text') {
    return [addThreadOptions({media_type: 'TEXT', text: item.body}, item)];
  }

  if (threads.postType === 'image' || threads.postType === 'video') {
    return [
      addThreadOptions(
        {...buildMediaRequest(item.assets[0], {carouselItem: false, allowMissingPublicUrl: true}), text: item.body},
        item,
      ),
    ];
  }

  const children = item.assets.map((asset) =>
    buildMediaRequest(asset, {carouselItem: true, allowMissingPublicUrl: true}),
  );

  return [
    ...children,
    addThreadOptions(
      {
        media_type: 'CAROUSEL',
        text: item.body,
        children: [],
      },
      item,
    ),
  ];
};

export const buildThreadsDryRunPayload = (item: ContentItem): ThreadsDryRunPayload => {
  const threads = requireThreadsOptions(item);
  const requests = buildThreadsDryRunCreateRequests(item);

  if (threads.postType === 'carousel') {
    return {
      platform: 'threads',
      itemId: item.id,
      projectId: item.projectId,
      requests: requests.map((request) =>
        request.media_type === 'CAROUSEL'
          ? {
              ...request,
              children: item.assets.map((asset) => `<child-container-${asset.id}>`),
            }
          : request,
      ),
      publish: {
        creation_id: '<container-id>',
      },
    };
  }

  return {
    platform: 'threads',
    itemId: item.id,
    projectId: item.projectId,
    requests,
    publish: {
      creation_id: '<container-id>',
    },
  };
};
