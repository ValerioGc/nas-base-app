import { readdirSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';
import { compileTemplate } from 'vue/compiler-sfc';
import { nasPurgeSafelist } from '../../../../scripts/build/purge-safelist';
import { stripTestIdsNodeTransform, stripTestIds } from '../../../../scripts/build/strip-test-ids';
import { frontendBoundary } from '../../../../scripts/build/frontend-boundary';

const COMPONENTS = join(__dirname, '../../../components');

describe('shared frontend build tools', () => {
  it('rejects native dependencies in the NAS bundle while allowing ordinary and desktop imports', () => {
    for (const target of ['axum', 'tauri'] as const) {
      const load = frontendBoundary(target).load;
      if (typeof load !== 'function') {
        throw new Error('Missing frontend boundary hook');
      }
      expect(Reflect.apply(load, {}, ['/src/main.ts'])).toBeNull();
      for (const id of [
        '/node_modules/@tauri-apps/api/core.js',
        'C:\\node_modules\\@tauri-apps\\api\\core.js',
      ]) {
        if (target === 'axum') {
          expect(() => Reflect.apply(load, {}, [id])).toThrow('cannot import native modules');
        } else {
          expect(Reflect.apply(load, {}, [id])).toBeNull();
        }
      }
    }
  });

  it('strips static HTML test IDs without removing accessible labels or other attributes', () => {
    const transform = stripTestIds().transformIndexHtml;
    if (typeof transform !== 'function') {
      throw new Error('Missing HTML transform hook');
    }
    const html =
      '<button data-testid="save" aria-label="Save">Save</button><input data-testid="name" name="name">';
    expect(Reflect.apply(transform, {}, [html])).toBe(
      '<button aria-label="Save">Save</button><input name="name">',
    );
    expect(Reflect.apply(transform, {}, ['<main>Content</main>'])).toBe('<main>Content</main>');
  });

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

  it('preserves dynamic bindings and directives that do not name the static test ID attribute', () => {
    const result = compileTemplate({
      filename: 'Consumer.vue',
      id: 'consumer',
      source: '<input :[attribute]="value" :name="name" v-model="value" /><p>Text</p>',
      compilerOptions: { nodeTransforms: [stripTestIdsNodeTransform] },
    });
    expect(result.errors).toEqual([]);
    expect(result.code).toContain('_ctx.attribute');
    expect(result.code).toContain('name: _ctx.name');
    expect(result.code).toContain('onUpdate:modelValue');
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
