import type {RunArtifact} from '../artifacts/runs.js';
import {redactArtifactSecrets} from '../artifacts/redaction.js';
import type {ContentItem, ProjectConfig} from '../config/schema.js';
import {validateForThreadsPublish} from '../content/validation.js';
import {createThreadsClient, ThreadsApiError, type ThreadsFetch} from './client.js';
import {buildThreadsCreateRequests, type ThreadsCreateRequest} from './payload.js';

export interface PublishContentItemInput {
  item: ContentItem;
  project: ProjectConfig;
  accessToken?: string;
  fetch?: ThreadsFetch;
  fetchImpl?: ThreadsFetch;
  waitMs?: number;
  createdAt?: string;
}

const publishableStatuses = new Set(['ready', 'dry_run_ok']);

const getContainerId = (response: unknown): string => {
  if (typeof response === 'object' && response !== null && 'id' in response && typeof response.id === 'string') {
    return response.id;
  }

  throw new Error('Threads create container response did not include an id.');
};

const sleep = async (waitMs: number): Promise<void> => {
  if (waitMs > 0) {
    await new Promise((resolve) => setTimeout(resolve, waitMs));
  }
};

const redacted = (value: unknown, accessToken: string | undefined): unknown => redactArtifactSecrets(value, [accessToken]);

export const publishContentItem = async (input: PublishContentItemInput): Promise<RunArtifact> => {
  const createdAt = input.createdAt ?? new Date().toISOString();
  const threads = input.project.platforms.threads;
  const accessToken = input.accessToken;

  if (!publishableStatuses.has(input.item.status)) {
    return {
      itemId: input.item.id,
      type: 'publish',
      status: 'blocked',
      createdAt,
      message: `publish_blocked: item status ${input.item.status} is not ready or dry_run_ok`,
      payloads: [{itemStatus: input.item.status}],
    };
  }

  const validation = validateForThreadsPublish(input.item, input.project, {hasAccessToken: Boolean(accessToken)});

  if (!validation.ok || !threads?.threadsUserId || !accessToken) {
    const missingAccessToken = validation.errors.some((error) => error.code === 'missing_access_token');

    return {
      itemId: input.item.id,
      type: 'publish',
      status: 'blocked',
      createdAt,
      message: missingAccessToken
        ? 'publish_blocked: missing Threads access token.'
        : 'publish_blocked: Threads publish validation failed.',
      validation,
    };
  }

  const client = createThreadsClient({accessToken, fetchImpl: input.fetchImpl ?? input.fetch});
  const createRequests = buildThreadsCreateRequests(input.item);
  const createdContainers: unknown[] = [];

  try {
    let finalCreateRequest: ThreadsCreateRequest;

    if (input.item.platforms.threads?.postType === 'carousel') {
      const childRequests = createRequests.slice(0, -1);
      const childIds: string[] = [];

      for (const request of childRequests) {
        const response = await client.createContainer(threads.threadsUserId, request);
        createdContainers.push(response);
        childIds.push(getContainerId(response));
      }

      finalCreateRequest = {...createRequests.at(-1)!, children: childIds};
    } else {
      finalCreateRequest = createRequests[0];
    }

    const finalCreateResponse = await client.createContainer(threads.threadsUserId, finalCreateRequest);
    createdContainers.push(finalCreateResponse);

    await sleep(input.waitMs ?? 0);

    const publishResponse = await client.publishContainer(threads.threadsUserId, getContainerId(finalCreateResponse));

    return {
      itemId: input.item.id,
      type: 'publish',
      status: 'ok',
      createdAt,
      message: 'Published to Threads.',
      payloads: redacted(
        [
          ...(input.item.platforms.threads?.postType === 'carousel'
            ? [...createRequests.slice(0, -1), finalCreateRequest]
            : [finalCreateRequest]),
          {creation_id: getContainerId(finalCreateResponse)},
        ],
        accessToken,
      ) as unknown[],
      response: redacted({createdContainers, publishResponse}, accessToken),
    };
  } catch (error) {
    const errorBody = error instanceof ThreadsApiError ? error.responseBody : undefined;

    return {
      itemId: input.item.id,
      type: 'publish',
      status: 'failed',
      createdAt,
      message: error instanceof Error ? error.message : String(error),
      payloads: redacted(createRequests, accessToken) as unknown[],
      response: redacted(
        {
          createdContainers,
          ...(errorBody === undefined ? {} : {errorBody}),
        },
        accessToken,
      ),
    };
  }
};
