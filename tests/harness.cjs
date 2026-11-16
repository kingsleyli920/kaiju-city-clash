'use strict';

// This small DOM stand-in runs the real browser game in Node. It deliberately
// contains no combat rules; all state changes come from dist/game.js.
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');

const root = path.resolve(__dirname, '..');

function boot({ stored = {}, seed = 12345 } = {}) {
  const listeners = new Map();
  const elements = [];
  const byId = new Map();
  const storage = new Map(Object.entries(stored));
  const frames = new Map();
  let frameId = 0;
  let clock = 0;

  class EventTarget {
    constructor() { this.listeners = new Map(); }
    addEventListener(type, listener) {
      if (!this.listeners.has(type)) this.listeners.set(type, []);
      this.listeners.get(type).push(listener);
    }
    removeEventListener(type, listener) {
      this.listeners.set(type, (this.listeners.get(type) || []).filter(item => item !== listener));
    }
    dispatchEvent(event) {
      event.target ||= this;
      event.currentTarget = this;
      event.preventDefault ||= function () { this.defaultPrevented = true; };
      event.stopPropagation ||= function () {};
      for (const listener of this.listeners.get(event.type) || []) listener.call(this, event);
      return !event.defaultPrevented;
    }
  }

  const canvasCalls = [];
  const context = new Proxy({
    measureText: text => ({ width: String(text).length * 7 }),
    createLinearGradient: () => ({ addColorStop() {} }),
    createRadialGradient: () => ({ addColorStop() {} }),
    fillText: (...args) => canvasCalls.push(args),
  }, {
    get: (target, key) => key in target ? target[key] : () => {},
    set: (target, key, value) => (target[key] = value, true),
  });

  function matches(element, selector) {
    selector = selector.trim();
    if (selector.startsWith('#')) return element.id === selector.slice(1);
    if (selector.startsWith('.')) return selector.slice(1).split('.').every(name => element.classList.contains(name));
    const attribute = selector.match(/^([\w-]+)?\[([\w-]+)(?:=["']?([^"'\]]+)["']?)?\]$/);
    if (attribute) {
      if (attribute[1] && element.tagName.toLowerCase() !== attribute[1]) return false;
      return attribute[3] === undefined ? element.hasAttribute(attribute[2]) : element.getAttribute(attribute[2]) === attribute[3];
    }
    return element.tagName.toLowerCase() === selector.toLowerCase();
  }

  class Element extends EventTarget {
    constructor(tagName = 'div') {
      super();
      this.tagName = tagName.toUpperCase();
      this.children = [];
      this.parentElement = null;
      this.attributes = new Map();
      this.dataset = {};
      this.style = { setProperty(name, value) { this[name] = value; }, removeProperty(name) { delete this[name]; } };
      this.className = '';
      this.textContent = '';
      this.open = false;
      this.hidden = false;
      this.checked = false;
      this.disabled = false;
      this.value = '';
      this.width = 768;
      this.height = 432;
      this.classList = {
        contains: name => this.className.split(/\s+/).includes(name),
        add: (...names) => { this.className = [...new Set([...this.className.split(/\s+/).filter(Boolean), ...names])].join(' '); },
        remove: (...names) => { this.className = this.className.split(/\s+/).filter(name => !names.includes(name)).join(' '); },
        toggle: (name, force) => {
          const enabled = force === undefined ? !this.classList.contains(name) : force;
          this.classList[enabled ? 'add' : 'remove'](name);
          return enabled;
        },
      };
      elements.push(this);
    }
    set id(value) { this._id = value; byId.set(value, this); }
    get id() { return this._id || ''; }
    setAttribute(name, value) {
      value = String(value);
      this.attributes.set(name, value);
      if (name === 'id') this.id = value;
      if (name === 'class') this.className = value;
      if (name === 'value') this.value = value;
      if (name === 'checked') this.checked = true;
      if (name === 'disabled') this.disabled = true;
      if (name.startsWith('data-')) this.dataset[name.slice(5).replace(/-([a-z])/g, (_, char) => char.toUpperCase())] = value;
    }
    getAttribute(name) { return this.attributes.get(name) ?? null; }
    hasAttribute(name) { return this.attributes.has(name); }
    removeAttribute(name) { this.attributes.delete(name); if (name === 'disabled') this.disabled = false; }
    append(...children) {
      for (const child of children) {
        if (typeof child === 'object') { child.parentElement = this; this.children.push(child); }
        else this.textContent += String(child);
      }
    }
    appendChild(child) { this.append(child); return child; }
    replaceChildren(...children) { for (const child of this.children) child.parentElement = null; this.children = []; this.append(...children); }
    set innerHTML(value) { this._innerHTML = value; this.replaceChildren(); }
    get innerHTML() { return this._innerHTML || ''; }
    get innerText() { return this.textContent; }
    set innerText(value) { this.textContent = value; }
    getContext() { return context; }
    getBoundingClientRect() { return { x: 0, y: 0, left: 0, top: 0, width: this.width, height: this.height, right: this.width, bottom: this.height }; }
    querySelectorAll(selector) {
      const result = [];
      const descend = element => {
        for (const child of element.children) {
          if (selector.split(',').some(part => matches(child, part))) result.push(child);
          descend(child);
        }
      };
      descend(this);
      return result;
    }
    querySelector(selector) { return this.querySelectorAll(selector)[0] || null; }
    closest(selector) { return matches(this, selector) ? this : this.parentElement?.closest(selector) || null; }
    click() { if (!this.disabled) this.dispatchEvent({ type: 'click' }); }
    focus() { document.activeElement = this; }
    blur() { if (document.activeElement === this) document.activeElement = null; }
    setPointerCapture() {}
    releasePointerCapture() {}
    hasPointerCapture() { return true; }
    showModal() { this.open = true; }
    close() { this.open = false; this.dispatchEvent({ type: 'close' }); }
  }

  const document = new EventTarget();
  document.hidden = false;
  document.visibilityState = 'visible';
  document.activeElement = null;
  document.createElement = tagName => new Element(tagName);
  document.getElementById = id => byId.get(id) || null;
  document.querySelectorAll = selector => elements.filter(element => selector.split(',').some(part => matches(element, part)));
  document.querySelector = selector => document.querySelectorAll(selector)[0] || null;

  // Parse element nesting and attributes from the real HTML so missing IDs and
  // renamed controls fail tests instead of silently creating fictitious nodes.
  const html = fs.readFileSync(path.join(root, 'dist/index.html'), 'utf8');
  const stack = [];
  const voidTags = new Set(['meta', 'link', 'input', 'img', 'br', 'hr', 'source', 'area', 'base', 'embed', 'param', 'wbr']);
  for (const token of html.matchAll(/<!--[\s\S]*?-->|<![^>]*>|<\/?[^>]+>/g)) {
    if (token[0].startsWith('<!')) continue;
    const closing = /^<\//.test(token[0]);
    const tag = token[0].match(/^<\/?([\w-]+)/)?.[1]?.toLowerCase();
    if (!tag) continue;
    if (closing) { while (stack.length && stack.pop().tagName.toLowerCase() !== tag) {} continue; }
    const element = new Element(tag);
    const attributes = token[0].slice(tag.length + 1).replace(/\/?\s*>$/, '');
    for (const match of attributes.matchAll(/([\w:-]+)(?:\s*=\s*(?:"([^"]*)"|'([^']*)'|([^\s>]+)))?/g)) {
      element.setAttribute(match[1], match[2] ?? match[3] ?? match[4] ?? '');
    }
    stack.at(-1)?.append(element);
    if (tag === 'body') document.body = element;
    if (tag === 'html') document.documentElement = element;
    if (!voidTags.has(tag)) stack.push(element);
  }

  const window = new EventTarget();
  window.KaijuArt = { drawMonster() {}, drawBuilding() {} };
  window.matchMedia = () => ({ matches: false, addEventListener() {}, removeEventListener() {} });
  window.devicePixelRatio = 1;
  const localStorage = {
    getItem: key => storage.get(String(key)) ?? null,
    setItem: (key, value) => storage.set(String(key), String(value)),
    removeItem: key => storage.delete(String(key)),
  };
  const seededMath = Object.create(Math);
  seededMath.random = () => ((seed = (Math.imul(seed, 1664525) + 1013904223) >>> 0) / 4294967296);
  const requestAnimationFrame = callback => { frames.set(++frameId, callback); return frameId; };
  const sandbox = {
    document, window, localStorage, console, Math: seededMath,
    performance: { now: () => clock },
    requestAnimationFrame, cancelAnimationFrame: id => frames.delete(id),
    setTimeout: () => 0, clearTimeout() {},
    navigator: {},
  };
  window.document = document;
  window.localStorage = localStorage;
  window.requestAnimationFrame = requestAnimationFrame;
  window.performance = sandbox.performance;
  sandbox.globalThis = sandbox;

  let source = fs.readFileSync(path.join(root, 'dist/game.js'), 'utf8');
  const closing = source.lastIndexOf('})();');
  if (closing === -1) throw new Error('Cannot instrument the game closure for tests.');
  const expose = `
    globalThis.__test = {
      evaluate: (expression) => eval(expression),
      tick, startMatch, resetScene, grab, punch, dealHit, special, fireSpecial,
      updateProjectiles, updateFighter, togglePause, returnToSelect, updatePin,
      beginPin, selectFighter, draw,
      state: () => ({ player, enemy, mode, pin, countdown, elapsed, score,
        buildings, projectiles,
        gameMode: typeof gameMode === 'undefined' ? 'arcade' : gameMode,
        stageIndex: typeof stageIndex === 'undefined' ? 0 : stageIndex,
        pendingNext, runFinished, runElapsed, maxCombo, completedRuns, settings,
        controlSources, physicalKeys, pointerKeys })
    };
  `;
  source = source.slice(0, closing) + expose + source.slice(closing);
  vm.runInNewContext(source, sandbox, { filename: 'dist/game.js', timeout: 3000 });
  const api = sandbox.__test;

  function dispatch(target, type, properties = {}) {
    const event = { type, repeat: false, ...properties };
    target.dispatchEvent(event);
    return event;
  }
  function keyDown(code, repeat = false) { return dispatch(document, 'keydown', { code, repeat, target: document.activeElement || document.body }); }
  function keyUp(code) { return dispatch(document, 'keyup', { code, target: document.activeElement || document.body }); }
  function click(id) {
    const element = byId.get(id);
    if (!element) throw new Error(`No DOM element with id=${id}`);
    element.click();
  }
  function clickData(name, value) {
    const element = document.querySelector(`[data-${name}="${value}"]`);
    if (!element) throw new Error(`No DOM control data-${name}=${value}`);
    element.click();
  }
  function advance(seconds, step = 1 / 60) {
    const count = Math.ceil(seconds / step);
    for (let i = 0; i < count; i++) { const dt = Math.min(step, seconds - i * step); clock += dt * 1000; api.tick(dt); }
  }
  function keyTap(code) { keyDown(code); advance(1 / 60); keyUp(code); }
  function start(gameMode = 'arcade') {
    if (gameMode !== api.state().gameMode) clickData('mode', gameMode);
    click('startButton');
    advance(3.2);
    if (api.state().mode !== 'playing') throw new Error(`Game did not start: ${api.state().mode}`);
  }
  return { api, document, window, byId, storage, frames, canvasCalls, dispatch, keyDown, keyUp, keyTap, click, clickData, advance, start };
}

module.exports = { boot };
