import { describe, it, expect, beforeEach, afterEach } from 'vitest';

import { clipsOverflow, collectClipAncestors } from '../clipChain';

describe('clipsOverflow', () => {
  it('does not clip when both axes are visible', () => {
    expect(clipsOverflow('visible', 'visible')).toBe(false);
  });

  it('clips for every non-visible value on either axis', () => {
    for (const value of ['hidden', 'clip', 'scroll', 'auto', 'overlay']) {
      expect(clipsOverflow(value, 'visible')).toBe(true);
      expect(clipsOverflow('visible', value)).toBe(true);
      expect(clipsOverflow(value, value)).toBe(true);
    }
  });
});

/** A minimal element chain: each node knows its parent and its overflow. */
interface FakeElement {
  name: string;
  overflow: string;
  parentElement: FakeElement | null;
}

function chain(...nodes: Array<[string, string]>): FakeElement[] {
  // Built root-first, linked child to parent.
  const built: FakeElement[] = [];
  let parent: FakeElement | null = null;
  for (const [name, overflow] of nodes) {
    const node: FakeElement = { name, overflow, parentElement: parent };
    built.push(node);
    parent = node;
  }
  return built;
}

const originals = { document: globalThis.document, getComputedStyle: globalThis.getComputedStyle };

describe('collectClipAncestors', () => {
  let html: FakeElement;
  let body: FakeElement;

  beforeEach(() => {
    (globalThis as { getComputedStyle?: unknown }).getComputedStyle = (element: FakeElement) => ({
      overflowX: element.overflow,
      overflowY: element.overflow
    });
  });

  afterEach(() => {
    (globalThis as { document?: unknown }).document = originals.document;
    (globalThis as { getComputedStyle?: unknown }).getComputedStyle = originals.getComputedStyle;
  });

  function setRoots(nodes: FakeElement[]): void {
    html = nodes[0];
    body = nodes[1];
    (globalThis as { document?: unknown }).document = { documentElement: html, body };
  }

  it('collects only the clipping ancestors between the image and <body>', () => {
    const nodes = chain(
      ['html', 'visible'],
      ['body', 'visible'],
      ['page', 'visible'],
      ['carousel', 'hidden'],
      ['slide', 'visible'],
      ['img', 'visible']
    );
    setRoots(nodes);

    const collected = collectClipAncestors(nodes[5] as unknown as Element) as unknown as FakeElement[];

    expect(collected.map((node) => node.name)).toEqual(['carousel']);
  });

  it('never includes <body> or <html>, even when they clip', () => {
    // youtube.com: `overflow-y: scroll` on a zero-height <body>. Including it collapsed the visible
    // box to nothing and hid every badge on the site.
    const nodes = chain(['html', 'scroll'], ['body', 'scroll'], ['app', 'hidden'], ['img', 'visible']);
    setRoots(nodes);

    const collected = collectClipAncestors(nodes[3] as unknown as Element) as unknown as FakeElement[];

    expect(collected.map((node) => node.name)).toEqual(['app']);
    expect(collected).not.toContain(body);
    expect(collected).not.toContain(html);
  });

  it('returns nothing when no ancestor clips', () => {
    const nodes = chain(['html', 'visible'], ['body', 'visible'], ['wrap', 'visible'], ['img', 'visible']);
    setRoots(nodes);

    expect(collectClipAncestors(nodes[3] as unknown as Element)).toEqual([]);
  });
});
