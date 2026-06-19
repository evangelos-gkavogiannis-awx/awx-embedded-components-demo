import path from 'node:path';
import { fileURLToPath } from 'node:url';
import react from '@vitejs/plugin-react';
import { defineConfig } from 'vite';

const __dirname = path.dirname(fileURLToPath(import.meta.url));

/**
 * AirForge build-time source annotation plugin.
 *
 * Injects three data attributes onto every intrinsic JSX element (div, span,
 * button, etc.) during development builds only:
 *
 *   data-af-file      — relative path from the template root (e.g. "src/App.jsx")
 *   data-af-line      — source line number as a string
 *   data-af-component — name of the nearest enclosing React component function
 *
 * These attributes let the AirForge preview overlay identify exactly which
 * source file and component a clicked DOM element belongs to, enabling
 * precise "Point & Prompt" AI edits without CDP or React DevTools.
 *
 * Production builds (vite build without --mode development) are completely
 * clean — the plugin is not applied and no data-af-* attributes are emitted.
 */
function airforgeAnnotate({ types: t }) {
  return {
    visitor: {
      JSXOpeningElement(nodePath, state) {
        // Only annotate intrinsic (HTML) elements — lowercase tag names.
        // Custom component props are not forwarded to the DOM, so annotating
        // them would be both useless and would trigger React prop warnings.
        const tagName = nodePath.node.name;
        if (tagName.type !== 'JSXIdentifier' || !/^[a-z]/.test(tagName.name)) return;

        // Skip elements already annotated (prevents duplicate attributes on
        // re-runs that can occur with Vite's hot-module replacement).
        if (nodePath.node.attributes.some((a) => a.name?.name === 'data-af-file')) return;

        const filename = state.filename ?? '';
        const line = nodePath.node.loc?.start.line ?? 0;
        const relFile = path.relative(__dirname, filename);

        // Walk up the AST to find the nearest enclosing React component —
        // identified as a named function whose name starts with an uppercase letter.
        let componentName = '';
        let cur = nodePath.parentPath;
        while (cur) {
          let name = null;
          if (cur.isFunctionDeclaration() && cur.node.id) {
            name = cur.node.id.name;
          } else if (
            (cur.isArrowFunctionExpression() || cur.isFunctionExpression()) &&
            cur.parentPath?.isVariableDeclarator()
          ) {
            name = cur.parentPath.node.id?.name ?? null;
          }
          if (name && /^[A-Z]/.test(name)) {
            componentName = name;
            break;
          }
          cur = cur.parentPath;
        }

        nodePath.node.attributes.push(
          t.jsxAttribute(t.jsxIdentifier('data-af-file'), t.stringLiteral(relFile)),
          t.jsxAttribute(t.jsxIdentifier('data-af-line'), t.stringLiteral(String(line))),
          t.jsxAttribute(
            t.jsxIdentifier('data-af-component'),
            t.stringLiteral(componentName),
          ),
        );
      },
    },
  };
}

export default defineConfig(({ mode }) => ({
  plugins: [
    react({
      // Only inject source annotations in development — production builds are clean.
      babel: mode === 'development' ? { plugins: [airforgeAnnotate] } : {},
    }),
  ],
  base: './',   // relative asset paths so preview proxy (/preview/{id}/) works correctly
  build: {
    outDir: 'dist',
    emptyOutDir: false,  // keep existing files during watch rebuilds to avoid serving gaps
  },
}));
