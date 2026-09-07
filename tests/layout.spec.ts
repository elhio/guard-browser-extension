import type { BrowserContext, Page } from "@playwright/test";

import { test, expect, seedSettings, API_ORIGIN, type Settings } from "./fixtures";
import {
  BODY_FLEX_FIXTURE_HTML,
  CLIPPING_BODY_FIXTURE_HTML,
  FIXTURE_ORIGIN,
  LAYOUT_FIXTURE_HTML,
  routeFixture,
} from "./pages/layoutFixture";

/**
 * Layout-neutrality regression tests.
 *
 * The overlay used to wrap every `<img>` in a positioning span, which displaced images on real
 * sites. Rings now render in a viewport-fixed layer instead, and these tests lock that in:
 * activating the extension on a page must not move a single element.
 *
 * Measurement is taken twice inside ONE document, flipping `isActive` live rather than reloading.
 * Two `page.goto()` calls differ by sub-pixels from font timing, image decode order and scrollbar
 * appearance, which would drown a 1px assertion; flipping the setting holds everything else
 * constant, so any delta is attributable to the extension.
 */

const BASE_SETTINGS: Partial<Settings> = {
  hasCompletedSetup: true,
  hasPromptedSetup: true,
  detectionAction: "mark",
  useDetectorLocalModel: false,
};

interface Measurement {
  rects: Record<string, number[]>;
  scrollHeight: number;
  currentSrc: string[];
  parents: string[];
  cardStyles: Record<string, string>;
}

/** Every marked element's geometry, plus the signals rect comparison alone cannot see. */
function measure(page: Page): Promise<Measurement> {
  return page.evaluate(() => {
    const rects: Record<string, number[]> = {};
    for (const element of document.querySelectorAll("[data-m]")) {
      const rect = element.getBoundingClientRect();
      rects[element.getAttribute("data-m")!] = [rect.x, rect.y, rect.width, rect.height];
    }

    // Child and first-child rules can stop matching without necessarily moving anything.
    const card = document.querySelector('[data-m="css-img"]');
    const cardStyles: Record<string, string> = {};
    if (card) {
      const style = getComputedStyle(card);
      cardStyles.outlineWidth = style.outlineWidth;
      cardStyles.borderTopWidth = style.borderTopWidth;
      cardStyles.borderTopLeftRadius = style.borderTopLeftRadius;
      cardStyles.marginTop = style.marginTop;
    }

    return {
      rects,
      scrollHeight: document.documentElement.scrollHeight,
      // `<source media>` selection dies if the image stops being a `<picture>` child, and that is
      // invisible to geometry because both candidate images render at the same CSS size.
      currentSrc: [...document.images].map((image) => image.currentSrc),
      // The direct "we did not touch the page DOM" fingerprint.
      parents: [...document.images].map(
        (image) => `${image.parentElement?.tagName}.${image.parentElement?.className}`
      ),
      cardStyles,
    };
  });
}

/** Fonts loaded and images decoded, so neither run is measured mid-reflow. */
async function settle(page: Page): Promise<void> {
  await page.evaluate(async () => {
    await document.fonts.ready;
    await Promise.all([...document.images].map((image) => image.decode().catch(() => {})));
  });
}

/** Rings live in the open `guard-menu` shadow root; each ring's own shadow is closed. */
function ringCount(page: Page): Promise<number> {
  return page.evaluate(() => {
    const host = document.querySelector("guard-menu");
    return host?.shadowRoot?.querySelectorAll("[data-guard-ring]").length ?? 0;
  });
}

/**
 * How many images the overlay has badged, counting the removed wrapper mechanism as well as rings.
 *
 * The legacy selector is deliberate. Without it, a regression that brought the wrapper back would
 * simply produce zero rings, and these tests would fail while waiting rather than while measuring —
 * reporting "no badges appeared" instead of "the extension moved 74 images". Counting both means
 * the layout assertions are always the thing that fails.
 */
function badgedCount(page: Page): Promise<number> {
  return page.evaluate(() => {
    const host = document.querySelector("guard-menu");
    const rings = host?.shadowRoot?.querySelectorAll("[data-guard-ring]").length ?? 0;
    return rings + document.querySelectorAll("[data-guard-badge-wrapper]").length;
  });
}

async function openFixture(page: Page, context: BrowserContext, html: string): Promise<void> {
  await routeFixture(context, html);
  await context.route(`${API_ORIGIN}/**`, (route) =>
    route.fulfill({ status: 200, contentType: "application/json", body: '{"data":[]}' })
  );
  // A fixed viewport keeps the `<source media="(min-width: 600px)">` choice deterministic.
  await page.setViewportSize({ width: 1280, height: 900 });
  await page.goto(`${FIXTURE_ORIGIN}/`);
  // The shadow host mounts even while the extension is inactive.
  await page.waitForSelector("guard-menu", { state: "attached", timeout: 15_000 });
  await settle(page);
}

/** Asserts two measurements describe the same layout, within a pixel. */
function expectSameLayout(before: Measurement, after: Measurement): void {
  for (const key of Object.keys(before.rects)) {
    const b = before.rects[key];
    const a = after.rects[key];
    expect(a, `no measurement for ${key}`).toBeTruthy();
    for (const [index, label] of ["x", "y", "width", "height"].entries()) {
      expect(Math.abs(a[index] - b[index]), `${key}.${label}: ${b[index]} -> ${a[index]}`)
        .toBeLessThanOrEqual(1);
    }
  }
  expect(after.scrollHeight).toBe(before.scrollHeight);
}

test("activating the extension does not change the page", async ({
  page,
  context,
  serviceWorker,
}) => {
  await seedSettings(serviceWorker, { ...BASE_SETTINGS, isActive: false });
  await openFixture(page, context, LAYOUT_FIXTURE_HTML);

  const baseline = await measure(page);

  await seedSettings(serviceWorker, { ...BASE_SETTINGS, isActive: true });
  await expect.poll(() => badgedCount(page), { timeout: 15_000 }).toBeGreaterThanOrEqual(2);
  await settle(page);

  const after = await measure(page);

  expectSameLayout(baseline, after);
  // Responsive source selection and child-selector rules must survive too.
  expect(after.currentSrc).toEqual(baseline.currentSrc);
  expect(after.cardStyles).toEqual(baseline.cardStyles);
  // No image was reparented, and the wrapper this replaced is gone for good.
  expect(after.parents).toEqual(baseline.parents);
  expect(await page.locator("[data-guard-badge-wrapper]").count()).toBe(0);
});

test("the shadow host does not participate in page layout", async ({
  page,
  context,
  serviceWorker,
}) => {
  // A flex body is what exposes an in-flow host: it would become an extra flex item, and the
  // container's `gap` would then push every section down. This is the only arrangement that
  // isolates the host, because the host is mounted in both halves of the test above.
  await seedSettings(serviceWorker, { ...BASE_SETTINGS, isActive: true });
  await openFixture(page, context, BODY_FLEX_FIXTURE_HTML);
  await expect.poll(() => badgedCount(page), { timeout: 15_000 }).toBeGreaterThanOrEqual(2);

  const withHost = await measure(page);

  await page.evaluate(() => {
    const host = document.querySelector("guard-menu")!;
    Object.assign(window, { __host: host, __next: host.nextSibling });
    host.remove();
  });
  const withoutHost = await measure(page);
  await page.evaluate(() => {
    const { __host, __next } = window as unknown as { __host: Element; __next: Node | null };
    document.body.insertBefore(__host, __next);
  });

  expectSameLayout(withHost, withoutHost);
});

test("rings track their image and stay inside a clipping ancestor", async ({
  page,
  context,
  serviceWorker,
}) => {
  await seedSettings(serviceWorker, { ...BASE_SETTINGS, isActive: true });
  await openFixture(page, context, LAYOUT_FIXTURE_HTML);
  await expect.poll(() => ringCount(page), { timeout: 15_000 }).toBeGreaterThanOrEqual(2);

  /**
   * Whether a ring sits 8px inside the top-right corner of an image's *visible* box.
   *
   * `anchor: "image"` expects the image's own top edge; `anchor: "viewport"` expects the viewport's,
   * which is where the ring must pin once the image's top has scrolled above the fold — otherwise
   * the ring on a tall image would scroll out of reach.
   */
  const ringOnImage = (marker: string, anchor: "image" | "viewport" = "image") =>
    page.evaluate(
      ({ name, anchor }) => {
        const image = document.querySelector(`[data-m="${name}"]`)!.getBoundingClientRect();
        const wantRight = image.right - 8;
        const wantTop = anchor === "image" ? image.top + 8 : 8;
        const host = document.querySelector("guard-menu")!;
        return [...host.shadowRoot!.querySelectorAll("[data-guard-ring]")].some((ring) => {
          const rect = ring.getBoundingClientRect();
          return Math.abs(rect.right - wantRight) <= 1 && Math.abs(rect.top - wantTop) <= 1;
        });
      },
      { name: marker, anchor }
    );

  const nextFrame = () =>
    page.evaluate(() => new Promise((r) => requestAnimationFrame(() => requestAnimationFrame(r))));

  expect(await ringOnImage("ph-img")).toBe(true);

  // Scroll the image's top above the fold: the ring pins to the viewport edge and stays clickable.
  await page.evaluate(() => window.scrollTo(0, 150));
  await nextFrame();
  expect(await ringOnImage("ph-img", "viewport")).toBe(true);

  await page.evaluate(() => window.scrollTo(0, 0));
  await nextFrame();
  expect(await ringOnImage("ph-img")).toBe(true);

  // Scroll the carousel horizontally: no ring may escape the scroller's box, which is what the
  // clip chain exists to prevent.
  await page.evaluate(() => document.querySelector("#carousel")!.scrollIntoView({ block: "center" }));
  await nextFrame();
  await page.evaluate(() => {
    document.querySelector("#carousel")!.scrollLeft = 260;
  });
  await nextFrame();

  const carouselRings = await page.evaluate(() => {
    const carousel = document.querySelector("#carousel")!.getBoundingClientRect();
    const host = document.querySelector("guard-menu")!;
    const inBand = [...host.shadowRoot!.querySelectorAll("[data-guard-ring]")]
      .map((ring) => ring.getBoundingClientRect())
      .filter((rect) => rect.top < carousel.bottom && rect.bottom > carousel.top);
    return {
      total: inBand.length,
      escaped: inBand
        .filter((rect) => rect.left < carousel.left - 1 || rect.right > carousel.right + 1)
        .map((rect) => [Math.round(rect.left), Math.round(rect.top)]),
    };
  });

  expect(carouselRings.total).toBeGreaterThan(0);
  expect(carouselRings.escaped).toEqual([]);
});

/** Rings that are actually placed, i.e. present and not hidden by the reposition pass. */
function visibleRingCount(page: Page): Promise<number> {
  return page.evaluate(() => {
    const host = document.querySelector("guard-menu");
    const rings = [...(host?.shadowRoot?.querySelectorAll("[data-guard-ring]") ?? [])];
    return rings.filter((ring) => getComputedStyle(ring).display !== "none").length;
  });
}

test("every element showing a repeated URL gets its own ring", async ({
  page,
  context,
  serviceWorker
}) => {
  await seedSettings(serviceWorker, { ...BASE_SETTINGS, isActive: true });
  await openFixture(page, context, LAYOUT_FIXTURE_HTML);

  // Rings only exist near the viewport, and the duplicates sit far down the taxonomy page.
  await page.evaluate(() => document.querySelector('[data-m="dup-box"]')?.scrollIntoView());
  await settle(page);

  // The three .dupes images share one URL. Before element-keyed tracking only the first was badged.
  await expect
    .poll(
      () =>
        page.evaluate(() => {
          const host = document.querySelector("guard-menu");
          const rings = [...(host?.shadowRoot?.querySelectorAll("[data-guard-ring]") ?? [])].filter(
            (ring) => getComputedStyle(ring).display !== "none"
          );
          const boxes = [...document.querySelectorAll('img[data-m^="dup-"]')].map((img) =>
            img.getBoundingClientRect()
          );
          // A ring belongs to a duplicate if it sits inside that image's box.
          return boxes.filter((box) =>
            rings.some((ring) => {
              const r = ring.getBoundingClientRect();
              return (
                r.left >= box.left - 1 &&
                r.right <= box.right + 1 &&
                r.top >= box.top - 1 &&
                r.bottom <= box.bottom + 1
              );
            })
          ).length;
        }),
      { timeout: 15_000 }
    )
    .toBe(3);
});

test("badges survive a clipping, zero-height body", async ({ page, context, serviceWorker }) => {
  await seedSettings(serviceWorker, { ...BASE_SETTINGS, isActive: true });
  await openFixture(page, context, CLIPPING_BODY_FIXTURE_HTML);

  await expect.poll(() => badgedCount(page), { timeout: 15_000 }).toBeGreaterThanOrEqual(2);
  await settle(page);

  expect(await visibleRingCount(page)).toBeGreaterThanOrEqual(2);

  // The tell: the <body> border box does not reach the badged images, so treating it as a clipping
  // ancestor would have emptied their visible box and hidden the rings.
  const escapesBody = await page.evaluate(() => {
    const host = document.querySelector("guard-menu");
    const bodyBottom = document.body.getBoundingClientRect().bottom;
    return [...(host?.shadowRoot?.querySelectorAll("[data-guard-ring]") ?? [])].some(
      (ring) =>
        getComputedStyle(ring).display !== "none" && ring.getBoundingClientRect().top > bodyBottom
    );
  });
  expect(escapesBody, "no visible ring sits below the body box, so the case is not exercised").toBe(true);
});
