/**
 * Drives the wizard's appearance. Every user-visible string lives in the localized Main.html — this
 * file only toggles classes on <body>, so nothing here needs translating.
 *
 * Navigation between steps is entirely local (a round trip to Swift per tap would flicker). The app
 * decides only the STARTING screen, via render(); it keeps no per-step state, so there's nothing to
 * report back as the user moves around.
 */

/**
 * Whether the browser-side setup has been completed. Decides where the permissions step leads in
 * both directions: during first-time setup it sits between welcome and the setup step, but once
 * setup is done it's reached from home and belongs to home — the wizard is over, so the welcome
 * screen must not be reachable from it again.
 */
let setupComplete = false;

/** Which screens offer a back button, and where it goes. */
function backTargetFor(screen) {
    switch (screen) {
        case 'step-2': return setupComplete ? 'home' : 'step-1';
        case 'step-3': return 'step-2';
        case 'about': return 'home';
        case 'store': return 'home';
        default: return undefined;
    }
}

function send(action) {
    webkit.messageHandlers.controller.postMessage(action);
}

function showScreen(screen) {
    // Swift keeps the store on screen across an app switch, so it has to be told when the user
    // finally leaves it — otherwise returning to the app would strand them here.
    if (document.body.dataset.screen === 'store' && screen !== 'store') send('store-closed');

    for (const name of ['step-1', 'step-2', 'step-3', 'home', 'about', 'store']) {
        document.body.classList.toggle(`screen-${name}`, name === screen);
    }

    const back = backTargetFor(screen);
    document.body.classList.toggle('has-back', Boolean(back));
    document.body.dataset.backTarget = back ?? '';
    document.body.dataset.screen = screen;
}

/**
 * Called by ViewController on load and whenever the app returns to the foreground.
 *
 * @param screen  Which screen to force. Omitted on a refresh mid-setup — the user is driving
 *        navigation then, so we only update the state below and leave them where they are.
 * @param permissionsGranted  Whether Safari has granted website access. Real on macOS
 *        (SFSafariExtensionManager); on iOS it is whatever the extension last reported through the
 *        App Group, so it stays false until the extension has run at least once.
 * @param setupComplete  Whether setup was finished in the browser — see the module-level note.
 * @param modernSettings  Newer OS naming: macOS 13 renamed Preferences to Settings; iOS 18 moved
 *        Safari under an "Apps" section.
 */
function render({ platform, screen, permissionsGranted, setupComplete: done, modernSettings, version }) {
    document.body.classList.add(`platform-${platform}`);
    document.body.classList.toggle('settings-modern', Boolean(modernSettings));
    document.body.classList.toggle('settings-legacy', !modernSettings);
    // This is what flips step 2's button between "Open Safari Settings…" and "Continue".
    document.body.classList.toggle('permissions-granted', Boolean(permissionsGranted));

    setupComplete = Boolean(done);
    // Reaching the permissions step after setup is done (via Home's Permissions button) is just a
    // re-grant, not a wizard flow — so the "Already allowed it? Continue" escape hatch is hidden then.
    document.body.classList.toggle('setup-complete', setupComplete);

    if (version) document.querySelector('.version').textContent = `v${version}`;

    if (screen) showScreen(screen);
}

/**
 * Called by ViewController whenever the token store changes state.
 *
 * The store is the one screen whose content isn't known when this page is written: bundle names come
 * from the API and prices from the App Store, both at runtime. Everything else it says — including
 * every failure message — is still written out in the localized Main.html and merely selected here,
 * so nothing user-visible is built from a string in this file.
 *
 * @param state  Which block to show: loading, ready, buying, deferred, success, error or failed.
 * @param items  The bundles on sale, for the ready state. Each carries productId, name, description,
 *        tokenAmount and displayPrice — the description already in the app's language, and the price
 *        already formatted for the user's storefront by StoreKit.
 * @param reason  Which failure message to show, for the error and failed states.
 */
function renderStore({ state, items, reason }) {
    document.body.dataset.storeState = state;
    document.body.dataset.storeReason = reason ?? '';

    if (items) {
        const list = document.querySelector('.store-items');
        const template = document.querySelector('#store-item');

        list.replaceChildren(...items.map((item) => {
            const row = template.content.cloneNode(true);
            row.querySelector('.store-item').dataset.action = `buy:${item.productId}`;
            row.querySelector('.store-item-name').textContent = item.name;
            row.querySelector('.store-item-amount').textContent = item.tokenAmount.toLocaleString();

            // The server resolves the description into the requested language and falls back to
            // English, so an empty one means the bundle simply has none. Hidden rather than left
            // blank, or the card would carry the gap of a line that isn't there.
            const description = row.querySelector('.store-item-description');
            description.textContent = item.description ?? '';
            description.hidden = !description.textContent;

            row.querySelector('.store-item-price').textContent = item.displayPrice;
            return row;
        }));
    }

    showScreen('store');
}

document.addEventListener('click', (event) => {
    const target = event.target.closest('[data-goto], [data-goto-continue], [data-action], [data-back]');
    if (!target) return;

    if (target.hasAttribute('data-back')) {
        const back = document.body.dataset.backTarget;
        if (back) showScreen(back);
        return;
    }
    if (target.hasAttribute('data-goto-continue')) {
        // Mid-setup this leads on to the setup step; afterwards there's nothing left to do but go home.
        showScreen(setupComplete ? 'home' : 'step-3');
        return;
    }
    if (target.dataset.goto) {
        showScreen(target.dataset.goto);
        return;
    }
    send(target.dataset.action);
});
