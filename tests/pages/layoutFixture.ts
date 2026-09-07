import { deflateSync } from "node:zlib";
import type { BrowserContext } from "@playwright/test";

/**
 * A page reproducing the layout patterns the badge overlay has to survive.
 *
 * Two of these are regressions taken from real sites, and they are the reason this fixture exists:
 * `padding-hack` is tagesschau.de, where wrapping an image collapsed the wrapper to zero height and
 * dropped every teaser image exactly its own height down the page; `child-slot` is the Chakra
 * `AspectRatio` box on elhio.com, whose `> :not(style)` rule styles whichever element occupies the
 * slot, so a wrapper silently stole the image's fill styling. The rest of the cases cover the other
 * ways an interposed element changes layout.
 */

/** The origin the fixture is served from. Deliberately not the configured website origin, which the
 *  content script treats specially for the auth handoff. */
export const FIXTURE_ORIGIN = "http://layout-fixture.test";

function crc32(buffer: Buffer): number {
  let crc = 0xffffffff;
  for (const byte of buffer) {
    crc ^= byte;
    for (let bit = 0; bit < 8; bit++) crc = (crc >>> 1) ^ (0xedb88320 & -(crc & 1));
  }
  return (crc ^ 0xffffffff) >>> 0;
}

/** A solid-colour PNG. Real intrinsic dimensions matter: `object-fit` and `<picture>` depend on them. */
function makePng(width: number, height: number, rgb: [number, number, number]): Buffer {
  const chunk = (type: string, data: Buffer) => {
    const typed = Buffer.concat([Buffer.from(type, "ascii"), data]);
    const length = Buffer.alloc(4);
    length.writeUInt32BE(data.length);
    const crc = Buffer.alloc(4);
    crc.writeUInt32BE(crc32(typed));
    return Buffer.concat([length, typed, crc]);
  };

  const header = Buffer.alloc(13);
  header.writeUInt32BE(width, 0);
  header.writeUInt32BE(height, 4);
  header[8] = 8; // bit depth
  header[9] = 2; // truecolour

  const row = Buffer.concat([Buffer.from([0]), Buffer.from(Array(width).fill(rgb).flat())]);
  const raw = Buffer.concat(Array(height).fill(row));

  return Buffer.concat([
    Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]),
    chunk("IHDR", header),
    chunk("IDAT", deflateSync(raw, { level: 9 })),
    chunk("IEND", Buffer.alloc(0)),
  ]);
}

const WIDE_PNG = makePng(800, 450, [40, 90, 160]);
const SQUARE_PNG = makePng(400, 400, [170, 70, 60]);

const STYLES = `
  * { box-sizing: border-box }
  body { margin: 0; padding: 24px; font: 16px/1.5 monospace; background: #fff }
  section { margin-bottom: 32px }

  /* 1. tagesschau: aspect-ratio padding hack with an absolutely positioned image. */
  .padding-hack { position: relative; height: 0; padding-top: 56.25%; background: #ccc; width: 480px }
  .padding-hack img { position: absolute; top: 0; left: 0; width: 100%; height: auto }

  /* 2. elhio/Chakra: the parent styles its slot, not the image. */
  .child-slot { position: relative; height: 220px; width: 380px; background: #eee }
  .child-slot > :not(style) {
    position: absolute; inset: 0; display: flex; align-items: center; justify-content: center;
    width: 100%; height: 100%; overflow: hidden;
  }

  /* 3. Modern aspect-ratio box. */
  .aspect { aspect-ratio: 16 / 9; width: 400px }
  .aspect img { width: 100%; height: 100%; object-fit: cover }

  /* 4. Image as a flex item. */
  .flex-row { display: flex; gap: 16px; align-items: flex-start; width: 620px }
  .flex-row img { flex: 1 1 0; min-width: 0 }

  /* 5. Grid item with explicit placement, which auto-placement would not reproduce. */
  .grid { display: grid; grid-template-columns: repeat(4, 1fr); gap: 8px; width: 600px }
  .grid img { grid-column: 2 / 4; grid-row: 1; width: 100%; height: 120px; object-fit: cover }
  .grid .cell { background: #ddd; min-height: 120px }

  /* 7. Float, where text wrapping is the tell. */
  .float-box { width: 520px }
  .float-box img { float: left; margin: 0 12px 8px 0; width: 140px; height: 140px }

  /* 8. Percentage sizing chain into object-fit. */
  .cover { width: 320px; height: 180px }
  .cover img { width: 100%; height: 100%; object-fit: cover }

  /* 9. Rules that only match while the image is a direct, first child. */
  .card { width: 360px; border: 1px solid #999 }
  .card > img { border-top: 6px solid #f00; margin-top: 20px; width: 100% }
  .card img:first-child { outline: 3px solid #00f; border-top-left-radius: 14px }

  /* 12. Horizontally clipped carousel, for the ring clipping behaviour. */
  .carousel { width: 420px; overflow-x: auto; display: flex; gap: 8px }
  .carousel img { flex: none; width: 300px; height: 170px; object-fit: cover }

  /* 13. One URL rendered three times, the way Reddit backs a photo with blurred copies of itself. */
  .dupes { display: flex; gap: 8px }
  .dupes img { width: 200px; height: 112px; object-fit: cover }

  /* An app shell taken out of flow, which collapses the <body> border box to zero height. */
  .app-shell { position: fixed; inset: 0; overflow-y: auto }
`;

const BODY = `
  <section data-case="padding-hack">
    <div class="padding-hack" data-m="ph-box"><img data-m="ph-img" src="/img/wide-1.png" alt=""></div>
  </section>

  <section data-case="child-slot">
    <div class="child-slot" data-m="slot-box"><img data-m="slot-img" src="/img/wide-2.png" alt=""></div>
  </section>

  <section data-case="aspect-ratio">
    <div class="aspect" data-m="ar-box"><img data-m="ar-img" src="/img/wide-3.png" alt=""></div>
  </section>

  <section data-case="flex-item">
    <div class="flex-row" data-m="flex-box">
      <img data-m="flex-img" src="/img/wide-4.png" alt="">
      <p data-m="flex-text">Flex sibling text that moves if the item box changes.</p>
    </div>
  </section>

  <section data-case="grid-item">
    <div class="grid" data-m="grid-box">
      <div class="cell" data-m="grid-a">A</div>
      <img data-m="grid-img" src="/img/square-1.png" alt="">
      <div class="cell" data-m="grid-b">B</div>
    </div>
  </section>

  <section data-case="picture">
    <picture data-m="pic-box">
      <source media="(min-width: 600px)" srcset="/img/wide-5.png">
      <img data-m="pic-img" src="/img/square-2.png" alt="">
    </picture>
  </section>

  <section data-case="float">
    <div class="float-box" data-m="float-box">
      <img data-m="float-img" src="/img/square-3.png" alt="">
      <p data-m="float-text">Text that wraps around the float. If the float stops applying this
      paragraph jumps left and down, which is what makes it worth measuring.</p>
    </div>
  </section>

  <section data-case="object-fit-cover">
    <div class="cover" data-m="cover-box"><img data-m="cover-img" src="/img/wide-6.png" alt=""></div>
  </section>

  <section data-case="child-selectors">
    <div class="card" data-m="css-box">
      <img data-m="css-img" src="/img/wide-7.png" alt="">
      <p data-m="css-text">Caption</p>
    </div>
  </section>

  <section data-case="table">
    <table data-m="tbl-box"><tbody><tr>
      <td data-m="tbl-td"><img data-m="tbl-img" src="/img/square-4.png" width="96" height="96" alt=""></td>
      <td data-m="tbl-td2">Adjacent cell</td>
    </tr></tbody></table>
  </section>

  <section data-case="inline">
    <p data-m="inline-p">Inline text before
      <img data-m="inline-img" src="/img/square-5.png" width="90" height="90" alt="">
      and inline text after, on the same baseline.</p>
  </section>

  <section data-case="video-poster">
    <video data-m="video-el" poster="/img/wide-8.png" width="320" height="180"></video>
  </section>

  <section data-case="carousel">
    <div class="carousel" id="carousel" data-m="car-box">
      <img data-m="car-1" src="/img/wide-9.png" alt="">
      <img data-m="car-2" src="/img/square-6.png" alt="">
      <img data-m="car-3" src="/img/wide-10.png" alt="">
    </div>
  </section>

  <section data-case="duplicate-src">
    <div class="dupes" data-m="dup-box">
      <img data-m="dup-1" src="/img/dup.png" alt="">
      <img data-m="dup-2" src="/img/dup.png" alt="">
      <img data-m="dup-3" src="/img/dup.png" alt="">
    </div>
  </section>
`;

function page(bodyStyle: string, shell = false): string {
  const body = shell ? `<div class="app-shell">${BODY}</div>` : BODY;
  return `<!doctype html><html><head><meta charset="utf-8">
<style>${STYLES}${bodyStyle}</style></head><body>${body}</body></html>`;
}

/** The taxonomy page. */
export const LAYOUT_FIXTURE_HTML = page("");

/**
 * Same content on a flex body. This is the only page that can expose a non-layout-neutral shadow
 * host: an in-flow host becomes an extra flex item and the `gap` between items then shifts the page.
 */
export const BODY_FLEX_FIXTURE_HTML = page(
  "body { display: flex; flex-direction: column; gap: 24px }"
);

/**
 * The youtube.com shape: `overflow-y: scroll` on a `<body>` whose only child is out of flow, so the
 * body border box is zero pixels tall. Treating `<body>` as a clipping ancestor collapsed every ring's
 * visible box to nothing here and hid all badges on the site.
 */
export const CLIPPING_BODY_FIXTURE_HTML = page(
  "body { overflow-y: scroll; margin: 0 }",
  true
);

/** Serves the fixture and its images on {@link FIXTURE_ORIGIN}. */
export async function routeFixture(context: BrowserContext, html: string): Promise<void> {
  await context.route(`${FIXTURE_ORIGIN}/**`, (route) => {
    // Most <img> elements get their own URL (wide-1.png, wide-2.png, ...) so that a per-element
    // failure is attributable; `/img/dup.png` is shared on purpose by the duplicate-src section.
    const path = new URL(route.request().url()).pathname;
    if (path === "/img/dup.png") {
      return route.fulfill({ contentType: "image/png", body: WIDE_PNG });
    }
    if (path.startsWith("/img/wide-")) {
      return route.fulfill({ contentType: "image/png", body: WIDE_PNG });
    }
    if (path.startsWith("/img/square-")) {
      return route.fulfill({ contentType: "image/png", body: SQUARE_PNG });
    }
    return route.fulfill({ contentType: "text/html", body: html });
  });
}
