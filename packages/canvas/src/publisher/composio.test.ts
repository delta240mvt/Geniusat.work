import assert from 'node:assert/strict';
import test from 'node:test';

import {isPotentialPublishAction} from './composio.js';

test('dashboard only advertises publishing actions', () => {
  assert.equal(isPotentialPublishAction({slug: 'SOCIAL_CREATE_POST'}), true);
  assert.equal(isPotentialPublishAction({slug: 'SOCIAL_CREATE_CAMPAIGN', description: 'Create a campaign to promote posts'}), false);
  assert.equal(isPotentialPublishAction({slug: 'SOCIAL_SEND_MESSAGE', description: 'Send a post as a message'}), false);
});
