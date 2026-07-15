//
//  GuardAppGroup.swift
//  Shared
//
//  Compiled into BOTH the app and the extension targets — it is the only thing they share.
//

import Foundation

/// The one channel between the container app and the web extension.
///
/// Everything the app knows about the extension arrives here: the extension's background reports its
/// state through native messaging, `SafariWebExtensionHandler` writes it into this group, and the app
/// reads it. Commands travel the other way for the same reason — iOS won't let the app open
/// `safari-web-extension://` URLs, so it asks the extension to do it.
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
        static let lastSeen = "lastSeen"
        static let pendingCommand = "pendingCommand"
    }

    private static var defaults: UserDefaults? {
        UserDefaults(suiteName: identifier)
    }

    // MARK: - Extension side

    /// Records what the extension reported about itself.
    static func recordExtensionState(hasCompletedSetup: Bool, hasSiteAccess: Bool, websiteUrl: String?) {
        guard let defaults else { return }
        defaults.set(hasCompletedSetup, forKey: Key.hasCompletedSetup)
        defaults.set(hasSiteAccess, forKey: Key.hasSiteAccess)
        defaults.set(Date(), forKey: Key.lastSeen)
        if let websiteUrl { defaults.set(websiteUrl, forKey: Key.websiteUrl) }
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

    /// Leaves a job for the extension to pick up the next time it reports in.
    static func queue(_ command: Command) {
        defaults?.set(command.rawValue, forKey: Key.pendingCommand)
    }
}
