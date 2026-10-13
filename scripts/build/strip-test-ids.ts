import type { CompilerOptions } from 'vue/compiler-sfc';

type NodeTransform = NonNullable<CompilerOptions['nodeTransforms']>[number];
import type { Plugin } from 'vite';

// Stable Vue template AST node kinds. Types come from the existing Vue peer.
const NodeTypes = { ELEMENT: 1, ATTRIBUTE: 6, SIMPLE_EXPRESSION: 4 } as const;
export const TEST_ID_ATTRIBUTE = 'data-testid';

/**
 * Removes data-testid attributes from Vue templates during production builds.
 * Tests and Playwright keep the attributes while running in development.
 */
export const stripTestIdsNodeTransform: NodeTransform = (node) => {
  if (node.type !== NodeTypes.ELEMENT) {
    return;
  }

  node.props = node.props.filter((prop) => {
    if (prop.type === NodeTypes.ATTRIBUTE) {
      return prop.name !== TEST_ID_ATTRIBUTE;
    }

    return !(
      prop.name === 'bind' &&
      prop.arg?.type === NodeTypes.SIMPLE_EXPRESSION &&
      prop.arg.isStatic &&
      prop.arg.content === TEST_ID_ATTRIBUTE
    );
  });
};

/** Removes data-testid attributes from the static HTML served by Vite. */
export function stripTestIds(): Plugin {
  return {
    name: 'strip-test-ids',
    apply: 'build',
    enforce: 'post',
    transformIndexHtml(html) {
      return html.replaceAll(new RegExp(String.raw`\s${TEST_ID_ATTRIBUTE}="[^"]*"`, 'g'), '');
    },
  };
}
