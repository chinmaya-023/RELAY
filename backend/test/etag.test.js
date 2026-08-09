import test from 'node:test';
import assert from 'node:assert/strict';
import { resourceEtag } from '../src/lib/etag.js';

test('ETags are deterministic and version based', () => {
  assert.equal(resourceEtag('project', 'prj_1', 42), '"project-prj_1-v42"');
  assert.equal(resourceEtag('project', 'prj_1', 42), resourceEtag('project', 'prj_1', 42));
  assert.notEqual(resourceEtag('project', 'prj_1', 42), resourceEtag('project', 'prj_1', 43));
});
