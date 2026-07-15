/**
 * Drives the wizard's appearance. Every user-visible string lives in the localized Main.html — this
 * file only toggles classes on <body>, so nothing here needs translating.
 *
 * Navigation is handled locally (a round trip to Swift per tap would flicker), but each move is
 * reported back so the app can persist the step and resume there next launch.
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
        default: return undefined;
    }
}

function send(action) {
    webkit.messageHandlers.controller.postMessage(action);
}

function showScreen(screen, { report = true } = {}) {
    for (const name of ['step-1', 'step-2', 'step-3', 'home', 'about']) {
        document.body.classList.toggle(`screen-${name}`, name === screen);
    }

    const back = backTargetFor(screen);
    document.body.classList.toggle('has-back', Boolean(back));
    document.body.dataset.backTarget = back ?? '';
    document.body.dataset.screen = screen;

    // Let the app persist where we are, so returning mid-wizard resumes here rather than restarting.
    if (report) send(`screen:${screen}`);
}

/**
 * Called by ViewController on load and whenever the app returns to the foreground.
 *
 * @param screen  Which screen to show — the app decides, since only it knows whether setup is done.
 * @param permissionsGranted  Whether Safari has granted website access. Real on macOS
 *        (SFSafariExtensionManager); on iOS it is whatever the extension last reported through the
 *        App Group, so it stays false until the extension has run at least once.
 * @param setupComplete  Whether setup was finished in the browser — see the module-level note.
 * @param modernSettings  Newer OS naming: macOS 13 renamed Preferences to Settings; iOS 18 moved
 *        Safari under an "Apps" section.
 */
function render({ platform, screen, permissionsGranted, setupComplete: done, modernSettings }) {
    document.body.classList.add(`platform-${platform}`);
    document.body.classList.toggle('settings-modern', Boolean(modernSettings));
    document.body.classList.toggle('settings-legacy', !modernSettings);
    document.body.classList.toggle('permissions-granted', Boolean(permissionsGranted));

    setupComplete = Boolean(done);

    // Don't report this one back: the app just told us, and echoing it would overwrite the persisted
    // step with one the app derived (e.g. the re-grant detour through step-2).
    showScreen(screen, { report: false });
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
