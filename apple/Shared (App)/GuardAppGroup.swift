//
//  GuardAppGroup.swift
//  Shared
//
//  Compiled into BOTH the app and the extension targets — it is the only thing they share.
//

import Foundation
import os.log

/// The one channel between the container app and the web extension.
///
/// Everything the app knows about the extension arrives here: the extension's background reports its
/// state through native messaging, `SafariWebExtensionHandler` writes it into this group, and the app
/// reads it. Commands travel the other way for the same reason — iOS won't let the app open
/// `safari-web-extension://` URLs, so it asks the extension to do it.
///
/// It also carries the session, briefly, when the user asks to buy tokens. Buying has to happen in the
/// app — StoreKit will not present a payment sheet from an app extension — and the app has no way to
/// read the extension's storage, so the token comes across here. It is handed over rather than stored:
/// `takeAuthToken` clears it as it reads it and ignores anything stale.
///
/// Requires the `com.apple.security.application-groups` entitlement on both targets; without it
/// `UserDefaults(suiteName:)` still hands back a working object, but it's a private store and the two
/// sides silently stop seeing each other.
enum GuardAppGroup {

    static let identifier = "group.com.elhio.guard"

    /// A job the app wants the extension to do on its behalf.
    enum Command: String {
        case openSetup
        case openOptions
    }

    private enum Key {
        static let hasCompletedSetup = "hasCompletedSetup"
        static let hasSiteAccess = "hasSiteAccess"
        static let websiteUrl = "websiteUrl"
        static let apiUrl = "apiUrl"
        static let lastSeen = "lastSeen"
        static let pendingCommand = "pendingCommand"
        static let authToken = "authToken"
        static let authTokenAt = "authTokenAt"
    }

    /// How long a handed-over session stays collectable.
    ///
    /// It only has to survive the app launching, which is seconds. Anything older is a handover whose
    /// app never arrived, and holding on to it would turn a deliberately transient credential into a
    /// stored one.
    private static let authTokenLifetime: TimeInterval = 120

    /// How long to keep looking for a handover before deciding there isn't one.
    ///
    /// The app is usually launched by the very request it is looking for, so the value may still be on
    /// its way across from the extension's process. Ten looks a tenth of a second apart is a second of
    /// patience, which costs nothing on the one path that has to wait and is never reached otherwise.
    private static let handoverPollAttempts = 10
    private static let handoverPollInterval: UInt64 = 100_000_000

    private static var defaults: UserDefaults? {
        UserDefaults(suiteName: identifier)
    }

    // MARK: - Extension side

    /// Records what the extension reported about itself.
    static func recordExtensionState(
        hasCompletedSetup: Bool,
        hasSiteAccess: Bool,
        websiteUrl: String?,
        apiUrl: String?
    ) {
        guard let defaults else { return }
        defaults.set(hasCompletedSetup, forKey: Key.hasCompletedSetup)
        defaults.set(hasSiteAccess, forKey: Key.hasSiteAccess)
        defaults.set(Date(), forKey: Key.lastSeen)
        if let websiteUrl { defaults.set(websiteUrl, forKey: Key.websiteUrl) }
        if let apiUrl { defaults.set(apiUrl, forKey: Key.apiUrl) }
    }

    /// Parks the signed-in session for the app to collect, and reports whether it landed.
    ///
    /// Handed over, not stored: the app drains it the moment it reads it, and `takeAuthToken` refuses
    /// anything older than `authTokenLifetime`, so a handover whose app never launched expires
    /// instead of lingering. The extension calls this only when the user asks to buy something.
    static func handOverAuthToken(_ token: String, apiUrl: String?) -> Bool {
        guard let defaults else { return false }
        defaults.set(token, forKey: Key.authToken)
        defaults.set(Date(), forKey: Key.authTokenAt)
        if let apiUrl { defaults.set(apiUrl, forKey: Key.apiUrl) }
        return true
    }

    /// Returns any queued command and clears it, so it runs exactly once.
    static func takePendingCommand() -> Command? {
        guard let defaults, let raw = defaults.string(forKey: Key.pendingCommand) else { return nil }
        defaults.removeObject(forKey: Key.pendingCommand)
        return Command(rawValue: raw)
    }

    // MARK: - App side

    /// True once setup has been completed in the browser.
    static var hasCompletedSetup: Bool {
        defaults?.bool(forKey: Key.hasCompletedSetup) ?? false
    }

    /// True when the extension last told us the user had granted access to websites.
    ///
    /// Only ever as fresh as the extension's last run. On iOS that's the best available: there is no
    /// API to ask, and a user who revokes access without reopening Safari leaves this stale — a known,
    /// accepted gap. macOS cross-checks it against `SFSafariExtensionManager`.
    static var hasSiteAccess: Bool {
        defaults?.bool(forKey: Key.hasSiteAccess) ?? false
    }

    /// When the extension last reported in; `nil` means it has never run, so it isn't enabled yet.
    static var lastSeen: Date? {
        defaults?.object(forKey: Key.lastSeen) as? Date
    }

    /// The site this extension build talks to, as the extension itself reports it.
    ///
    /// Worth taking from the extension rather than hardcoding here: it's baked into the extension at
    /// build time and points at a dev server during development. The handoff depends on agreeing —
    /// the content script only honours the marker on this exact host — so a guess would break the
    /// very flow it's meant to serve. `nil` until the extension has reported at least once.
    static var websiteUrl: URL? {
        guard let raw = defaults?.string(forKey: Key.websiteUrl) else { return nil }
        return URL(string: raw)
    }

    /// The API this extension build talks to, as the extension itself reports it.
    ///
    /// Same reasoning as `websiteUrl`: baked into the extension at build time, pointing at a dev
    /// server during development, and unreachable from a native target. `nil` until the extension has
    /// reported at least once, which is why the store cannot be opened before then.
    static var apiUrl: URL? {
        guard let raw = defaults?.string(forKey: Key.apiUrl) else { return nil }
        return URL(string: raw)
    }

    /// Collects the handed-over session and clears it, so it is usable exactly once.
    ///
    /// Returns `nil` when there is nothing to collect or when what is there has gone stale — an app
    /// opened on its own, rather than from the extension's Buy button, gets nothing and must say so.
    ///
    /// Waits a moment first. The handover is written by the Safari extension's process and read here
    /// in the app's, moments after the extension asked the system to launch us, and shared defaults
    /// do not always cross that boundary the instant they are written.
    static func takeAuthToken() async -> String? {
        for attempt in 0..<handoverPollAttempts {
            if let token = collectAuthToken() { return token }
            if attempt + 1 < handoverPollAttempts {
                try? await Task.sleep(nanoseconds: handoverPollInterval)
            }
        }

        os_log(.default, "Guard: no session was handed over")
        return nil
    }

    /// One look for a handed-over session, clearing whatever it finds.
    private static func collectAuthToken() -> String? {
        guard let defaults else { return nil }

        // A fresh read rather than a cached one: the value was written by another process since this
        // one started, and shared defaults are only reliably current after synchronizing.
        defaults.synchronize()

        guard let token = defaults.string(forKey: Key.authToken) else { return nil }

        let handedOverAt = defaults.object(forKey: Key.authTokenAt) as? Date
        defaults.removeObject(forKey: Key.authToken)
        defaults.removeObject(forKey: Key.authTokenAt)

        guard let handedOverAt, Date().timeIntervalSince(handedOverAt) <= authTokenLifetime else {
            os_log(.default, "Guard: discarded a stale handover")
            return nil
        }
        return token
    }

    /// Leaves a job for the extension to pick up the next time it reports in.
    static func queue(_ command: Command) {
        defaults?.set(command.rawValue, forKey: Key.pendingCommand)
    }
}
