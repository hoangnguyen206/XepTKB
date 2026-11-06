#!/usr/bin/env node
import { readFileSync, readdirSync, statSync } from "node:fs";
import { join, relative, resolve, sep } from "node:path";
import { pathToFileURL } from "node:url";
import ts from "typescript";

const allowedExtensions = new Set([".ts", ".tsx", ".js", ".jsx", ".mjs", ".cjs"]);
const ignoredDirectories = new Set(["node_modules", "dist", "dist-e2e", "test-results", "playwright-report"]);

const common = [
  { pattern: /\b(?:studentId|birthDate|fullName)\b/i, message: "PII field name in source" },
  { pattern: /\b(?:eval|Function)\s*\(/, message: "dynamic code execution" },
];
// SEC-M3-005: any reference to a network API (not only `fetch(`), so aliases such as `const f = fetch` are caught too.
const NETWORK_API = /\b(?:fetch|XMLHttpRequest|sendBeacon|WebSocket|EventSource|RTCPeerConnection|importScripts)\b/;
const packageRules = [
  ...common,
  { pattern: NETWORK_API, message: "network access in foundation packages" },
];
// apps/web: one network module (ADR-0010 §4) and no HTML injection sinks.
const NETWORK_MODULE = ["apps", "web", "src", "data", "loader.ts"].join(sep);
// Tests stub `fetch`; they are never part of a build.
const isTestFile = (file) => /\.test\.[cm]?[jt]sx?$/.test(file) || file.split(/[/\\]/).includes("test");
const isLoaderFile = (file) => file.split(/[/\\]/).join(sep).endsWith(NETWORK_MODULE);

const webRules = [
  ...common,
  { pattern: NETWORK_API, message: "network access outside the artifact loader", allow: (file) => isLoaderFile(file) || isTestFile(file) },
  { pattern: /\binnerHTML\b|\bouterHTML\b|insertAdjacentHTML|dangerouslySetInnerHTML|document\.write/, message: "HTML injection sink" },
  { pattern: /\blocalStorage\b|\bsessionStorage\b|document\.cookie/, message: "storage outside IndexedDB" },
  // ADR-0008 / ADR-0013: apps/web may only import the browser-safe registration subpath of @ky-nay/parser.
  { pattern: /["']@ky-nay\/parser(?!\/registration["'])(?:\/[^"']*)?["']/, message: "parser import outside @ky-nay/parser/registration" },
  { pattern: /["']node:[^"']+["']/, message: "Node built-in import in browser source", allow: (file) => isTestFile(file) },
];
// The service worker source is generated from vite.config.ts: it may only pass same-origin requests through
// (`fetch(request)`), never open another channel.
const workerRules = [
  { pattern: /\b(?:XMLHttpRequest|sendBeacon|WebSocket|EventSource|RTCPeerConnection|importScripts)\b/, message: "network channel in the service worker" },
  { pattern: /(?<!["'])\bfetch\b(?!\(request\))/, message: "service worker fetch other than the same-origin passthrough `fetch(request)`" },
];

const NETWORK_NAMES = new Set([
  "fetch",
  "XMLHttpRequest",
  "sendBeacon",
  "WebSocket",
  "EventSource",
  "RTCPeerConnection",
  "importScripts",
]);
const CONSTRUCTOR_SINKS = new Set(["Image", "Audio", "Worker", "SharedWorker"]);
const HTML_SINKS = new Set(["innerHTML", "outerHTML", "insertAdjacentHTML", "dangerouslySetInnerHTML"]);
const STORAGE_NAMES = new Set(["localStorage", "sessionStorage"]);
const GLOBAL_OBJECTS = new Set(["window", "globalThis", "self", "document", "navigator", "location"]);
const LOCATION_SINKS = new Set(["href", "assign", "replace"]);
const PII_FIELD_RE = /^(?:studentId|birthDate|fullName)$/i;

/** Blanks comments (ignoring `//` or `/*` inside string literals) while keeping line breaks (SEC-M3-005). */
export function stripComments(source) {
  return source.replace(
    /"(?:\\[\s\S]|[^"\\\n])*"|'(?:\\[\s\S]|[^'\\\n])*'|`(?:\\[\s\S]|[^`\\])*`|\/\*[\s\S]*?\*\/|\/\/[^\n]*/g,
    (match) => (match.startsWith("/") ? match.replace(/[^\n]/g, " ") : match),
  );
}

function scriptKindFor(file) {
  if (file.endsWith(".tsx")) return ts.ScriptKind.TSX;
  if (file.endsWith(".jsx")) return ts.ScriptKind.JSX;
  if (file.endsWith(".js") || file.endsWith(".mjs") || file.endsWith(".cjs")) return ts.ScriptKind.JS;
  return ts.ScriptKind.TS;
}

function unwrapExpression(node) {
  let current = node;
  while (
    current &&
    (ts.isParenthesizedExpression(current) ||
      ts.isAsExpression(current) ||
      ts.isTypeAssertionExpression(current) ||
      ts.isSatisfiesExpression(current) ||
      ts.isNonNullExpression(current))
  ) {
    current = current.expression;
  }
  return current;
}

/** Evaluates compile-time string expressions (`"fe" + "tch"`, template literals, `["fe","tch"].join("")`, const bindings). */
function evalStaticString(node, constStrings) {
  const expr = unwrapExpression(node);
  if (!expr) return undefined;
  if (ts.isStringLiteral(expr) || ts.isNoSubstitutionTemplateLiteral(expr)) return expr.text;
  if (ts.isIdentifier(expr) && constStrings.has(expr.text)) return constStrings.get(expr.text);
  if (ts.isBinaryExpression(expr) && expr.operatorToken.kind === ts.SyntaxKind.PlusToken) {
    const left = evalStaticString(expr.left, constStrings);
    const right = evalStaticString(expr.right, constStrings);
    if (left !== undefined && right !== undefined) return left + right;
  }
  if (ts.isTemplateExpression(expr)) {
    let out = expr.head.text;
    for (const span of expr.templateSpans) {
      const part = evalStaticString(span.expression, constStrings);
      if (part === undefined) return undefined;
      out += part + span.literal.text;
    }
    return out;
  }
  if (
    ts.isCallExpression(expr) &&
    ts.isPropertyAccessExpression(expr.expression) &&
    expr.expression.name.text === "join" &&
    ts.isArrayLiteralExpression(expr.expression.expression)
  ) {
    const sepNode = expr.arguments[0];
    const joiner = sepNode === undefined ? "," : evalStaticString(sepNode, constStrings);
    if (joiner === undefined) return undefined;
    const parts = [];
    for (const el of expr.expression.expression.elements) {
      const val = evalStaticString(el, constStrings);
      if (val === undefined) return undefined;
      parts.push(val);
    }
    return parts.join(joiner);
  }
  return undefined;
}

function memberName(node, constStrings) {
  if (ts.isPropertyAccessExpression(node)) return node.name.text;
  if (ts.isElementAccessExpression(node)) return evalStaticString(node.argumentExpression, constStrings);
  return undefined;
}

function isGlobalObject(node, constStrings) {
  const expr = unwrapExpression(node);
  if (!expr) return false;
  if (ts.isIdentifier(expr)) return GLOBAL_OBJECTS.has(expr.text);
  if (ts.isPropertyAccessExpression(expr) || ts.isElementAccessExpression(expr)) {
    const prop = memberName(expr, constStrings);
    return isGlobalObject(expr.expression, constStrings) && prop !== undefined && GLOBAL_OBJECTS.has(prop);
  }
  return false;
}

function isLocationObject(node, constStrings) {
  const expr = unwrapExpression(node);
  if (!expr) return false;
  if (ts.isIdentifier(expr) && expr.text === "location") return true;
  if (ts.isPropertyAccessExpression(expr) || ts.isElementAccessExpression(expr)) {
    const prop = memberName(expr, constStrings);
    return prop === "location" && isGlobalObject(expr.expression, constStrings);
  }
  return false;
}

/** AST-based security & boundary checks (SEC-M3-005). */
function checkAst(rawSource, file, scopeName, addError) {
  const sourceFile = ts.createSourceFile(file, rawSource, ts.ScriptTarget.Latest, true, scriptKindFor(file));
  const constStrings = new Map();
  const isTest = isTestFile(file);
  const allowNetwork = scopeName === "web" && (isLoaderFile(file) || isTest);
  const allowNodeBuiltins = scopeName !== "web" || isTest;
  const networkMsg = scopeName === "packages" ? "network access in foundation packages" : "network access outside the artifact loader";

  const lineOf = (node) => sourceFile.getLineAndCharacterOfPosition(node.getStart(sourceFile)).line + 1;

  // First pass: collect `const` string bindings for constant propagation.
  const collectConsts = (node) => {
    if (
      ts.isVariableDeclaration(node) &&
      ts.isIdentifier(node.name) &&
      node.initializer &&
      node.parent &&
      ts.isVariableDeclarationList(node.parent) &&
      (node.parent.flags & ts.NodeFlags.Const) !== 0
    ) {
      const value = evalStaticString(node.initializer, constStrings);
      if (value !== undefined) constStrings.set(node.name.text, value);
    }
    ts.forEachChild(node, collectConsts);
  };
  collectConsts(sourceFile);

  const checkModuleSpecifier = (specNode, nodeForLine) => {
    if (scopeName !== "web") return;
    const spec = evalStaticString(specNode, constStrings);
    if (spec === undefined) {
      if (!isTest) addError(lineOf(nodeForLine), "dynamic module import in browser source");
      return;
    }
    if ((spec === "@ky-nay/parser" || spec.startsWith("@ky-nay/parser/")) && spec !== "@ky-nay/parser/registration") {
      addError(lineOf(nodeForLine), "parser import outside @ky-nay/parser/registration");
    }
    if (!allowNodeBuiltins && spec.startsWith("node:")) {
      addError(lineOf(nodeForLine), "Node built-in import in browser source");
    }
  };

  const visit = (node) => {
    const line = lineOf(node);

    // 1. Common rules (all scopes): PII field names & dynamic code execution (`eval`, `Function`).
    if (ts.isIdentifier(node)) {
      if (PII_FIELD_RE.test(node.text)) addError(line, "PII field name in source");
      if ((node.text === "eval" || node.text === "Function") && (!node.parent || !ts.isTypeNode(node.parent))) {
        addError(line, "dynamic code execution");
      }
      if ((scopeName === "packages" || (scopeName === "web" && !allowNetwork)) && NETWORK_NAMES.has(node.text)) {
        addError(line, networkMsg);
      }
      if (scopeName === "web" && HTML_SINKS.has(node.text)) {
        addError(line, "HTML injection sink");
      }
      if (scopeName === "web" && STORAGE_NAMES.has(node.text)) {
        addError(line, "storage outside IndexedDB");
      }
    }

    // Check computed property access (`obj[expr]`) and static string property names.
    if (ts.isElementAccessExpression(node) || ts.isPropertyAccessExpression(node)) {
      const prop = memberName(node, constStrings);
      if (prop !== undefined) {
        if (PII_FIELD_RE.test(prop)) addError(line, "PII field name in source");
        if (prop === "eval" || prop === "Function") addError(line, "dynamic code execution");
        if ((scopeName === "packages" || (scopeName === "web" && !allowNetwork)) && NETWORK_NAMES.has(prop)) {
          addError(line, networkMsg);
        }
        if (scopeName === "worker" && NETWORK_NAMES.has(prop) && prop !== "fetch") {
          addError(line, "network channel in the service worker");
        }
        if ((scopeName === "packages" || scopeName === "web") && !isTest && CONSTRUCTOR_SINKS.has(prop) && isGlobalObject(node.expression, constStrings)) {
          addError(line, "network/worker constructor sink (Image/Audio/Worker/SharedWorker)");
        }
        if (scopeName === "web") {
          if (HTML_SINKS.has(prop)) addError(line, "HTML injection sink");
          if ((prop === "write" || prop === "writeln") && isGlobalObject(node.expression, constStrings)) {
            addError(line, "HTML injection sink");
          }
          if (STORAGE_NAMES.has(prop) || (prop === "cookie" && isGlobalObject(node.expression, constStrings))) {
            addError(line, "storage outside IndexedDB");
          }
        }
        if ((scopeName === "packages" || scopeName === "web") && !isTest) {
          if (prop === "open" && isGlobalObject(node.expression, constStrings)) {
            addError(line, "navigation/popup sink (window.open)");
          }
          if (LOCATION_SINKS.has(prop) && isLocationObject(node.expression, constStrings)) {
            addError(line, "navigation sink (location)");
          }
        }
      } else if (
        ts.isElementAccessExpression(node) &&
        (scopeName === "packages" || scopeName === "web") &&
        !isTest &&
        isGlobalObject(node.expression, constStrings)
      ) {
        addError(line, "computed property access on global/DOM object");
      }
    }

    // Check object literal / class property names (`{ ["student" + "Id"]: ... }`).
    if (ts.isPropertyAssignment(node) || ts.isPropertyDeclaration(node) || ts.isPropertySignature(node)) {
      const propName = ts.isComputedPropertyName(node.name)
        ? evalStaticString(node.name.expression, constStrings)
        : ts.isIdentifier(node.name) || ts.isStringLiteralLike(node.name)
          ? node.name.text
          : undefined;
      if (propName !== undefined) {
        if (PII_FIELD_RE.test(propName)) addError(line, "PII field name in source");
        if (scopeName === "web" && HTML_SINKS.has(propName)) addError(line, "HTML injection sink");
      }
    }

    // Check constructors (`new Image()`, `new Audio()`, `new Worker()`, `new SharedWorker()`).
    if (ts.isNewExpression(node) && (scopeName === "packages" || scopeName === "web") && !isTest) {
      const target = unwrapExpression(node.expression);
      if (ts.isIdentifier(target) && CONSTRUCTOR_SINKS.has(target.text)) {
        addError(line, "network/worker constructor sink (Image/Audio/Worker/SharedWorker)");
      } else if (ts.isPropertyAccessExpression(target) || ts.isElementAccessExpression(target)) {
        const prop = memberName(target, constStrings);
        if (prop !== undefined && CONSTRUCTOR_SINKS.has(prop)) {
          addError(line, "network/worker constructor sink (Image/Audio/Worker/SharedWorker)");
        }
      }
    }

    // Check bare `open(...)` call or dynamic `import(...)` call.
    if (ts.isCallExpression(node)) {
      if (node.expression.kind === ts.SyntaxKind.ImportKeyword && node.arguments.length > 0) {
        checkModuleSpecifier(node.arguments[0], node);
      }
      const callee = unwrapExpression(node.expression);
      if ((scopeName === "packages" || scopeName === "web") && !isTest && ts.isIdentifier(callee) && callee.text === "open") {
        addError(line, "navigation/popup sink (window.open)");
      }
    }

    // Check direct assignment to `location` / `window.location` / `document.location`.
    if (
      ts.isBinaryExpression(node) &&
      node.operatorToken.kind === ts.SyntaxKind.EqualsToken &&
      (scopeName === "packages" || scopeName === "web") &&
      !isTest &&
      isLocationObject(node.left, constStrings)
    ) {
      addError(line, "navigation sink (location)");
    }

    // Check imports & re-exports.
    if ((ts.isImportDeclaration(node) || ts.isExportDeclaration(node)) && node.moduleSpecifier) {
      checkModuleSpecifier(node.moduleSpecifier, node.moduleSpecifier);
    }

    ts.forEachChild(node, visit);
  };

  visit(sourceFile);
}

const SCOPE_RULES = {
  packages: packageRules,
  web: webRules,
  worker: workerRules,
};

/** Lints a single source string under a named scope (`"packages" | "web" | "worker"`). */
export function lintSource(rawSource, filePath, scopeName, rootDir = process.cwd()) {
  const rules = SCOPE_RULES[scopeName] ?? webRules;
  const relPath = relative(rootDir, resolve(rootDir, filePath));
  const found = new Set();
  const addError = (line, message) => {
    found.add(`${relPath}:${line}: ${message}`);
  };

  const stripped = stripComments(rawSource);
  for (const rule of rules) {
    if (rule.allow?.(filePath)) continue;
    const global = new RegExp(rule.pattern.source, rule.pattern.flags.includes("g") ? rule.pattern.flags : `${rule.pattern.flags}g`);
    for (const match of stripped.matchAll(global)) {
      const line = stripped.slice(0, match.index).split("\n").length;
      addError(line, rule.message);
    }
  }

  checkAst(rawSource, filePath, scopeName, addError);
  return [...found];
}

export function lintRepo(rootDir = process.cwd()) {
  const scopes = [
    { path: "packages", scopeName: "packages" },
    { path: join("apps", "web", "src"), scopeName: "web" },
    { path: join("apps", "web", "vite.config.ts"), scopeName: "worker" },
  ];
  const errors = [];

  const checkFile = (file, scopeName) => {
    const raw = readFileSync(file, "utf8");
    errors.push(...lintSource(raw, file, scopeName, rootDir));
  };

  const walk = (dir, scopeName) => {
    for (const entry of readdirSync(dir, { withFileTypes: true })) {
      const full = join(dir, entry.name);
      if (entry.isDirectory()) {
        if (!ignoredDirectories.has(entry.name)) walk(full, scopeName);
      } else if (allowedExtensions.has(full.slice(full.lastIndexOf(".")))) {
        checkFile(full, scopeName);
      }
    }
  };

  for (const scope of scopes) {
    const target = join(rootDir, scope.path);
    const stat = statSync(target, { throwIfNoEntry: false });
    if (stat?.isDirectory()) walk(target, scope.scopeName);
    else if (stat?.isFile()) checkFile(target, scope.scopeName);
  }
  return errors;
}

if (process.argv[1] && import.meta.url === pathToFileURL(resolve(process.argv[1])).href) {
  const errors = lintRepo(process.cwd());
  if (errors.length > 0) {
    console.error(errors.join("\n"));
    process.exitCode = 1;
  } else {
    console.log("lint: foundation and web boundary checks passed");
  }
}
