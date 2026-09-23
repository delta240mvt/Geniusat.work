import assert from 'node:assert/strict';
import {describe, it} from 'vitest';
import {ComposioClient, buildComposioArguments, isPotentialPublishAction, publishThroughComposio} from '../src/composio.js';
import {createHash} from 'node:crypto';
import path from 'node:path';
import {composioUserId} from '../src/utils/env.js';
import type {ContentItem} from '../src/config/schema.js';

const item: ContentItem = {
  id: 'item-1',
  projectId: 'project-1',
  title: 'AI workflow',
  body: 'A practical workflow for AI agents.',
  scheduledAt: '2026-09-21T10:00:00.000Z',
  status: 'ready',
  source: {type: 'manual', path: 'input.json'},
  assets: [{id: 'asset-1', type: 'image', publicUrl: 'https://cdn.example/image.jpg'}],
  platforms: {},
  history: [],
};

describe('Composio publishing adapter', () => {
it('does not advertise social messaging or campaigns as publishing actions', () => {
  assert.equal(isPotentialPublishAction({slug: 'SOCIAL_CREATE_POST'}), true);
  assert.equal(isPotentialPublishAction({slug: 'SOCIAL_CREATE_CAMPAIGN', description: 'Create a campaign to promote posts'}), false);
  assert.equal(isPotentialPublishAction({slug: 'SOCIAL_SEND_MESSAGE', description: 'Send a post as a message'}), false);
});
it('uses the same workspace identity as the localhost dashboard', () => {
  const root = path.resolve('C:/workspace/genius');
  const expected = `genius-${createHash('sha256').update(root.toLowerCase()).digest('hex').slice(0, 16)}`;
  assert.equal(composioUserId(root, {}), expected);
  assert.equal(composioUserId(root, {COMPOSIO_USER_ID: 'custom-user'}), 'custom-user');
});
it('exposes social publishing actions and hides unrelated toolkits', async () => {
  const calls: string[] = [];
  const client = new ComposioClient({
    apiKey: 'test-key',
    userId: 'genius-test',
    baseUrl: 'https://composio.test/api/v3.1',
    fetchImpl: async (input, init) => {
      const url = String(input);
      calls.push(`${init?.method ?? 'GET'} ${url}`);
      if (url.endsWith('/tools?toolkit_versions=latest&limit=1000')) return Response.json({items: [
        {slug: 'SOCIAL_CREATE_POST', name: 'Create post', toolkit: {slug: 'example-social', name: 'Example Social'}, input_parameters: {text: {required: true}}},
        {slug: 'GITHUB_CREATE_ISSUE', name: 'Create issue', toolkit: {slug: 'github', name: 'GitHub'}},
      ]});
      if (url.endsWith('/toolkits/example-social')) return Response.json({slug: 'example-social', name: 'Example Social', meta: {categories: [{id: 'social-media'}]}, auth_configs: [{id: 'ac_social'}]});
      if (url.endsWith('/toolkits/github')) return Response.json({slug: 'github', name: 'GitHub', meta: {categories: [{id: 'developer-tools'}]}});
      throw new Error(`Unexpected ${url}`);
    },
  });
  const capabilities = await client.listPublishingCapabilities();
  assert.deepEqual(capabilities.map((capability) => capability.actionSlug), ['SOCIAL_CREATE_POST']);
  assert.equal(capabilities[0].authConfigId, 'ac_social');
  assert.ok(calls.every((call) => !call.includes('x-api-key')));
});

it('connects and publishes while keeping the provider key in request headers only', async () => {
  const requests: Array<{url: string; init?: RequestInit}> = [];
  const client = new ComposioClient({
    apiKey: 'secret-provider-key',
    userId: 'genius-test',
    baseUrl: 'https://composio.test/api/v3.1',
    fetchImpl: async (input, init) => {
      requests.push({url: String(input), init});
      const url = String(input);
      if (url.endsWith('/connected_accounts/link')) return Response.json({redirect_url: 'https://connect.composio.dev/link/test', connected_account_id: 'ca_1'}, {status: 201});
      if (url.endsWith('/tools/execute/SOCIAL_CREATE_POST')) return Response.json({successful: true, data: {id: 'post-1'}});
      throw new Error(`Unexpected ${url}`);
    },
  });
  const link = await client.createConnectLink({authConfigId: 'ac_social', alias: 'main'});
  assert.equal(link.connectedAccountId, 'ca_1');
  const capability = {
    actionSlug: 'SOCIAL_CREATE_POST',
    actionName: 'Create post',
    description: 'Create a social post',
    toolkitSlug: 'example-social',
    toolkitName: 'Example Social',
    inputParameters: {text: {required: true}, image_url: {required: false}},
    authConfigId: 'ac_social',
  };
  assert.deepEqual(buildComposioArguments(capability, item).arguments, {text: item.body, image_url: 'https://cdn.example/image.jpg'});
  const artifact = await publishThroughComposio({client, capability, connectionId: 'ca_1', item});
  assert.equal(artifact.status, 'ok');
  assert.ok(requests.every(({init}) => !JSON.stringify(init?.body ?? '').includes('secret-provider-key')));
  assert.equal(new Headers(requests[0].init?.headers).get('x-api-key'), 'secret-provider-key');
});

it('does not report publication when Composio returns an execution failure', async () => {
  const client = new ComposioClient({
    apiKey: 'test-key',
    userId: 'genius-test',
    fetchImpl: async () => Response.json({successful: false, error: 'Platform rejected the post'}),
  });
  const artifact = await publishThroughComposio({
    client,
    capability: {
      actionSlug: 'SOCIAL_CREATE_POST',
      actionName: 'Create post',
      description: '',
      toolkitSlug: 'social',
      toolkitName: 'Social',
      inputParameters: {text: {required: true}},
      authConfigId: 'ac_social',
    },
    connectionId: 'ca_1',
    item,
  });
  assert.equal(artifact.status, 'failed');
  assert.match(artifact.message ?? '', /Platform rejected the post/);
});
});
