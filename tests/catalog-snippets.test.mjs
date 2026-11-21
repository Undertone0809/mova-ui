import assert from 'node:assert/strict';
import { createRequire } from 'node:module';
import test from 'node:test';
import ts from 'typescript';
import { renderToStaticMarkup } from 'react-dom/server';
import { ditherChartsData } from '@mova-ui/react/catalog/data/ditherCharts';

const require = createRequire(import.meta.url);

test('dither usage snippets execute through published catalog subpaths', () => {
  assert.equal(ditherChartsData.length, 11);
  for (const item of ditherChartsData) {
    assert.doesNotMatch(item.codeSnippet, /@\/components/);
    const compiled = ts.transpileModule(item.codeSnippet, {
      compilerOptions: { jsx: ts.JsxEmit.ReactJSX, module: ts.ModuleKind.CommonJS,
        target: ts.ScriptTarget.ES2022, esModuleInterop: true },
    });
    const exports = {};
    new Function('require', 'exports', compiled.outputText)(require, exports);
    assert.equal(typeof exports.default, 'function', item.id);
    assert.ok(renderToStaticMarkup(exports.default()).length > 0, item.id);
  }
});
