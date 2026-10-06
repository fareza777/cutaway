import { existsSync, readFileSync } from 'node:fs';
import { createRequire } from 'node:module';
import { dirname, resolve } from 'node:path';
import vm from 'node:vm';
import ts from 'typescript';

/** Test-only TS loader. Native SDKs are replaced at their platform boundary. */
export function sourceLoader(mocks = {}, globals = {}) {
  const cache = new Map();
  function load(filename) {
    const file = resolve(filename);
    if (cache.has(file)) return cache.get(file).exports;
    if (!existsSync(file)) return {};
    const module = { exports: {} };
    cache.set(file, module);
    const nativeRequire = createRequire(file);
    const require = (name) => {
      if (Object.hasOwn(mocks, name)) return mocks[name];
      if (name.startsWith('.') || name.startsWith('@/')) {
        const base = name.startsWith('@/') ? resolve('src', name.slice(2)) : resolve(dirname(file), name);
        const target = [base, `${base}.ts`, `${base}.tsx`, `${base}.js`].find(existsSync);
        if (target && /\.[cm]?[jt]sx?$/.test(target)) return load(target);
      }
      return nativeRequire(name);
    };
    const code = ts.transpileModule(readFileSync(file, 'utf8'), {
      compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022, jsx: ts.JsxEmit.ReactJSX },
      fileName: file,
    }).outputText;
    vm.runInNewContext(code, { module, exports: module.exports, require, console, setTimeout, clearTimeout, ...globals }, { filename: file });
    return module.exports;
  }
  return load;
}
