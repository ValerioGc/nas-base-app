import { readdirSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';
import { compileTemplate } from 'vue/compiler-sfc';
import { nasPurgeSafelist } from '../../../../scripts/build/purge-safelist';
import { stripTestIdsNodeTransform } from '../../../../scripts/build/strip-test-ids';

const COMPONENTS = join(__dirname, '../../../components');

describe('shared frontend build tools', () => {
  it('removes static and bound test IDs while preserving accessible controls and classes', () => {
    const result = compileTemplate({
      filename: 'Consumer.vue',
      id: 'consumer',
      source:
        '<button class="app_button" aria-label="Save" data-testid="save">Save</button><input :data-testid="fieldId" aria-label="Name" />',
      compilerOptions: { nodeTransforms: [stripTestIdsNodeTransform] },
    });
    expect(result.errors).toEqual([]);
    expect(result.code).not.toContain('data-testid');
    expect(result.code).toContain('aria-label');
    expect(result.code).toContain('app_button');
  });

  it('lists every class and element of the component templates, for the purge of an application', () => {
    const used = new Set<string>();
    for (const file of readdirSync(COMPONENTS)) {
      const template =
        readFileSync(join(COMPONENTS, file), 'utf8').split('<template>')[1]?.split('<style')[0] ??
        '';
      for (const [, tag] of template.matchAll(/<([a-z][a-z0-9]*)[\s>/]/g)) {
        if (!['template', 'slot'].includes(tag!)) {
          used.add(tag!);
        }
      }
      for (const [, value] of template.matchAll(/\sclass="([^"]+)"/g)) {
        value!.split(/\s+/).forEach((name) => used.add(name));
      }
      // The keys of the bound class objects: `{ active: ... }`, `{ 'app_button--primary': ... }`.
      for (const [, value] of template.matchAll(/:class="\{([^}]+)\}"/g)) {
        for (const [, name] of value!.matchAll(/'?([\w-]+)'?\s*:/g)) {
          used.add(name!);
        }
      }
    }
    expect([...used].sort()).toEqual([...nasPurgeSafelist].sort());
  });
});
