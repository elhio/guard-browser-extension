//
//  ViewController.swift
//  Shared (App)
//
//  Created by Stefan Scholz on 15.07.26.
//

import WebKit

#if os(iOS)
import UIKit
typealias PlatformViewController = UIViewController
#elseif os(macOS)
import Cocoa
import SafariServices
typealias PlatformViewController = NSViewController
#endif

let extensionBundleIdentifier = "com.elhio.guard.Extension"

/// Fallback for the site this build talks to, used only until the extension has reported its own.
///
/// The extension bakes the real value in from `VITE_WEBSITE_URL` at build time and tells us over the
/// App Group, because it differs between a dev server and production and a native target can't read
/// it. Guessing wrong doesn't just send the user somewhere odd — the handoff marker is only honoured
/// on the extension's own host, so a mismatch silently breaks Setup and Settings.
let fallbackWebsiteURL = URL(string: "https://elhio.com")!

class ViewController: PlatformViewController, WKNavigationDelegate, WKScriptMessageHandler {

    @IBOutlet var webView: WKWebView!

    private var isPageLoaded = false

    override func viewDidLoad() {
        super.viewDidLoad()

        self.webView.navigationDelegate = self

#if os(iOS)
        self.webView.scrollView.isScrollEnabled = false
#endif

        self.webView.configuration.userContentController.add(self, name: "controller")

        self.webView.loadFileURL(Bundle.main.url(forResource: "Main", withExtension: "html")!, allowingReadAccessTo: Bundle.main.resourceURL!)

        // Granting permissions and running setup both happen outside this app, so the answer can
        // change while we're in the background. Re-resolve on every return rather than trusting what
        // we rendered on launch.
#if os(iOS)
        NotificationCenter.default.addObserver(
            self, selector: #selector(refresh),
            name: UIApplication.willEnterForegroundNotification, object: nil)
#elseif os(macOS)
        NotificationCenter.default.addObserver(
            self, selector: #selector(refresh),
            name: NSApplication.didBecomeActiveNotification, object: nil)
#endif
    }

#if os(macOS)
    override func viewDidAppear() {
        super.viewDidAppear()
        // The wizard is a fixed vertical flow with no scroll, and German runs longer than English, so
        // stop the window being shrunk to where content clips. The storyboard sets the default size;
        // this only guards the floor. Set once — the window is up by now, and re-imposing it on every
        // activation would fight a user who resized.
        view.window?.contentMinSize = NSSize(width: 520, height: 600)
    }
#endif

    func webView(_ webView: WKWebView, didFinish navigation: WKNavigation!) {
        isPageLoaded = true
        render(initial: true)
    }

    /// Re-evaluate when the app comes back to the front — granting permissions and running setup both
    /// happen elsewhere, so the answer may have changed while we were away.
    @objc private func refresh() {
        render(initial: false)
    }

    private func render(initial: Bool) {
        guard isPageLoaded else { return }
        resolvePermissionsGranted { [weak self] granted in
            self?.render(permissionsGranted: granted, initial: initial)
        }
    }

    /// Whether Safari has granted Guard access to websites.
    ///
    /// macOS can ask outright. iOS has no such API, so the extension reports it through the App Group
    /// — which means it stays false until the extension has actually run once, and can't notice a
    /// later revocation. macOS additionally requires the extension to be enabled at all, which is a
    /// stronger check than the App Group alone can make.
    private func resolvePermissionsGranted(_ completion: @escaping (Bool) -> Void) {
#if os(iOS)
        completion(GuardAppGroup.hasSiteAccess)
#elseif os(macOS)
        SFSafariExtensionManager.getStateOfSafariExtension(withIdentifier: extensionBundleIdentifier) { state, error in
            let enabled = (error == nil && state?.isEnabled == true)
            DispatchQueue.main.async {
                completion(enabled && GuardAppGroup.hasSiteAccess)
            }
        }
#endif
    }

    private func render(permissionsGranted: Bool, initial: Bool) {
        // `hasCompletedSetup` comes from the extension (the single source of truth for onboarding),
        // relayed through the App Group. The app keeps no onboarding state of its own — so if the
        // extension's setup is reset, the app shows the wizard again, always from the start, with
        // nothing stale of its own to resume into.
        let setupDone = GuardAppGroup.hasCompletedSetup

        // Which screen to force, if any. Once setup is done, always the home hub — the app never
        // drags the user to the permissions step; home has its own Permissions button for when they
        // want to grant or re-grant access. During first-time setup the *user* drives navigation, so
        // we only pick the starting screen (step 1) on the initial load — a later refresh (e.g.
        // returning from granting permissions in Safari) leaves them where they are and merely updates
        // the permission state below, so step 2's button can turn into Continue.
        let screen: String?
        switch (setupDone, permissionsGranted) {
        case (true, _): screen = "home"
        case (false, _): screen = initial ? "step-1" : nil
        }

#if os(iOS)
        let platform = "ios"
        // iOS 18 moved Safari's settings under an "Apps" section; older iOS uses the flat path.
        let modernSettings = if #available(iOS 18, *) { true } else { false }
#elseif os(macOS)
        let platform = "mac"
        // The macOS deployment target is 13, and macOS 13 renamed "Preferences" to "Settings", so the
        // modern wording always applies.
        let modernSettings = true
#endif

        let version = Bundle.main.object(forInfoDictionaryKey: "CFBundleShortVersionString") as? String ?? ""

        var payload: [String: Any] = [
            "platform": platform,
            "permissionsGranted": permissionsGranted,
            "setupComplete": setupDone,
            "modernSettings": modernSettings,
            "version": version,
        ]
        // Omitted when there's no screen to force, so the page keeps its current step.
        if let screen { payload["screen"] = screen }

        guard let json = try? JSONSerialization.data(withJSONObject: payload),
              let literal = String(data: json, encoding: .utf8) else { return }
        webView.evaluateJavaScript("render(\(literal))")
    }

    func userContentController(_ userContentController: WKUserContentController, didReceive message: WKScriptMessage) {
        guard let action = message.body as? String else { return }

        switch action {
        case "open-website":
            openWebsite()
        // The app can't open the extension's own pages — iOS refuses safari-web-extension:// URLs
        // from an app — so it leaves the job for the extension and nudges the browser awake.
        case "open-setup":
            GuardAppGroup.queue(.openSetup)
            openBrowser()
        case "open-options":
            GuardAppGroup.queue(.openOptions)
            openBrowser()
        case "open-privacy":
            openLegalPage("privacy")
        case "open-terms":
            openLegalPage("terms")
        case "open-contact":
            openLegalPage("contact")
#if os(iOS)
        case "open-settings":
            openSettings()
#elseif os(macOS)
        case "open-preferences":
            openSafariExtensionPreferences()
#endif
        default:
            return
        }
    }

    /// The site this build talks to, as reported by the extension; the constant is only a fallback.
    private var websiteURL: URL { GuardAppGroup.websiteUrl ?? fallbackWebsiteURL }

    /// A throwaway page whose only job is to reach the extension.
    ///
    /// We can't open the extension's own pages (iOS refuses `safari-web-extension://` from an app),
    /// and the extension won't notice a queued command until its background page next loads — which,
    /// being non-persistent, may be a long time. Opening a page it *does* run on gets its content
    /// script to wake it immediately; the marker tells the extension this page is disposable, and it
    /// navigates this very tab on to the real page. The user should end up on Setup/Settings, not here.
    private var handoffURL: URL {
        let base = websiteURL
        guard var components = URLComponents(url: base, resolvingAgainstBaseURL: false) else { return base }
        components.queryItems = (components.queryItems ?? []) + [URLQueryItem(name: "guard-handoff", value: "1")]
        return components.url ?? base
    }

    /// Hands off to the extension so it can carry out the queued command.
    private func openBrowser() {
#if os(iOS)
        UIApplication.shared.open(handoffURL)
#elseif os(macOS)
        // The extension lives in Safari specifically, so target it rather than whatever the default
        // browser happens to be. Fall back to the default browser only if Safari can't be located.
        if let safari = NSWorkspace.shared.urlForApplication(withBundleIdentifier: "com.apple.Safari") {
            NSWorkspace.shared.open([handoffURL], withApplicationAt: safari, configuration: NSWorkspace.OpenConfiguration())
        } else {
            NSWorkspace.shared.open(handoffURL)
        }
#endif
    }

    /// Opens the Elhio site so the user can sign in. The extension itself picks up the token from
    /// the page, so nothing needs to be handed back to it from here.
    private func openWebsite() {
        openExternal(websiteURL)
    }

    /// Opens a legal page (Privacy / Terms / Contact) on the marketing site, matching the extension's
    /// `${websiteURL}/${locale}/${slug}` convention. Locale mirrors the app's own localization, so it
    /// lines up with the copy on screen; the base URL is the extension-reported site (App Group), or
    /// the fallback until the extension has reported one.
    private func openLegalPage(_ slug: String) {
        let language = Bundle.main.preferredLocalizations.first?.prefix(2).lowercased()
        let locale = (language == "de") ? "de" : "en"
        let url = websiteURL.appendingPathComponent(locale).appendingPathComponent(slug)
        openExternal(url)
    }

    /// Opens a URL in the system browser, leaving this app's UI intact.
    private func openExternal(_ url: URL) {
#if os(iOS)
        UIApplication.shared.open(url)
#elseif os(macOS)
        NSWorkspace.shared.open(url)
#endif
    }

#if os(iOS)
    /// Opens Settings — but note this lands on *Guard's own* Settings page, not Safari's extension
    /// list: iOS exposes no public deep link to that list. It's only a shortcut into Settings; the
    /// numbered steps in Main.html are the actual instruction.
    private func openSettings() {
        guard let url = URL(string: UIApplication.openSettingsURLString) else { return }
        UIApplication.shared.open(url)
    }
#elseif os(macOS)
    /// Opens Safari's Settings → Extensions pane for Guard, then steps aside so it's visible.
    private func openSafariExtensionPreferences() {
        SFSafariApplication.showPreferencesForExtension(withIdentifier: extensionBundleIdentifier) { error in
            DispatchQueue.main.async {
                if let error {
                    // Couldn't open the pane (e.g. the app is being run from Xcode's DerivedData rather
                    // than /Applications, so Safari hasn't registered it). Log it and at least bring
                    // Safari forward so the user can reach Settings → Extensions by hand.
                    NSLog("Guard: showPreferencesForExtension(%@) failed: %@",
                          extensionBundleIdentifier, error.localizedDescription)
                    self.activateSafari()
                    return
                }
                // Success: Safari has opened the Settings → Extensions pane and come forward. Just hide
                // this app so the pane is revealed. Re-activating Safari here would instead raise its
                // browsing window on top of the pane — which looked like "Safari opened but no settings".
                // Hide rather than quit so the user can return here after granting access.
                NSApp.hide(nil)
            }
        }
    }

    /// Brings Safari to the front (launching it if needed).
    private func activateSafari() {
        guard let safari = NSWorkspace.shared.urlForApplication(withBundleIdentifier: "com.apple.Safari") else { return }
        NSWorkspace.shared.openApplication(at: safari, configuration: NSWorkspace.OpenConfiguration())
    }
#endif

}
