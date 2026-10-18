import type { CompilerOptions } from 'vue/compiler-sfc';

type NodeTransform = NonNullable<CompilerOptions['nodeTransforms']>[number];
import type { Plugin } from 'vite';

// Node types used in the Vue AST for identifying elements, attributes, and expressions.
const NodeTypes = { ELEMENT: 1, ATTRIBUTE: 6, SIMPLE_EXPRESSION: 4 } as const;

export const TEST_ID_ATTRIBUTE = 'data-testid';

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

/**
 * Removes data-testid attributes from the HTML during the Vite build process.
 * @returns {Plugin} Vite plugin that strips data-testid attributes.
 */
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
