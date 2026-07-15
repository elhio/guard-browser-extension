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

    /// Where the wizard was left off, so returning to the app resumes rather than restarting.
    /// Only meaningful while setup is unfinished — afterwards the App Group decides what to show.
    private var savedScreen: String {
        get { UserDefaults.standard.string(forKey: "wizardScreen") ?? "step-1" }
        set { UserDefaults.standard.set(newValue, forKey: "wizardScreen") }
    }

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

    func webView(_ webView: WKWebView, didFinish navigation: WKNavigation!) {
        isPageLoaded = true
        refresh()
    }

    @objc private func refresh() {
        guard isPageLoaded else { return }
        resolvePermissionsGranted { [weak self] granted in
            self?.render(permissionsGranted: granted)
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

    private func render(permissionsGranted: Bool) {
        let setupDone = GuardAppGroup.hasCompletedSetup

        // Setup is the finish line. Once it's crossed the wizard is gone for good — except that
        // access can still be taken away afterwards, and without it Guard silently does nothing. So
        // that one case detours back through the permissions step. Where that step then leads, in
        // both directions, is the page's business: `setupDone` is all it needs to work it out.
        let screen: String
        switch (setupDone, permissionsGranted) {
        case (true, true): screen = "home"
        case (true, false): screen = "step-2"
        case (false, _): screen = savedScreen
        }

#if os(iOS)
        let platform = "ios"
        let modernSettings = if #available(iOS 18, *) { true } else { false }
#elseif os(macOS)
        let platform = "mac"
        let modernSettings = if #available(macOS 13, *) { true } else { false }
#endif

        let payload: [String: Any] = [
            "platform": platform,
            "screen": screen,
            "permissionsGranted": permissionsGranted,
            "setupComplete": setupDone,
            "modernSettings": modernSettings,
        ]
        guard let json = try? JSONSerialization.data(withJSONObject: payload),
              let literal = String(data: json, encoding: .utf8) else { return }
        webView.evaluateJavaScript("render(\(literal))")
    }

    func userContentController(_ userContentController: WKUserContentController, didReceive message: WKScriptMessage) {
        guard let action = message.body as? String else { return }

        // The wizard reports each move so we can resume there; nothing else to do.
        if action.hasPrefix("screen:") {
            let screen = String(action.dropFirst("screen:".count))
            if !GuardAppGroup.hasCompletedSetup { savedScreen = screen }
            return
        }

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
    /// closes it once the real page is open. The user should end up on Setup/Settings, not here.
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
        // Explicitly Safari: the extension lives there, and the default browser may be something else.
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
#if os(iOS)
        UIApplication.shared.open(websiteURL)
#elseif os(macOS)
        NSWorkspace.shared.open(websiteURL)
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
    /// Opens Safari's extension settings, then quits — Safari won't reveal the pane while this app
    /// stays frontmost.
    private func openSafariExtensionPreferences() {
        SFSafariApplication.showPreferencesForExtension(withIdentifier: extensionBundleIdentifier) { error in
            guard error == nil else {
                // Insert code to inform the user that something went wrong.
                return
            }

            DispatchQueue.main.async {
                NSApp.terminate(self)
            }
        }
    }
#endif

}
