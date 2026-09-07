//
//  SafariWebExtensionHandler.swift
//  Shared (Extension)
//

import SafariServices
import os.log

/// Bridges the web extension and the container app.
///
/// The app can see nothing of the extension by itself — iOS has no API to report whether an extension
/// is enabled, and `browser.storage` is unreachable from native code — so the extension's background
/// reports its state here and this handler parks it in an App Group that the app can read.
///
/// Traffic flows both ways on the one round trip. The app cannot open extension pages itself (iOS
/// refuses `safari-web-extension://` URLs from an app), so it leaves a command in the App Group and
/// this handler hands it back as the reply for the background to carry out.
///
/// Two kinds of message arrive here, told apart by whether one carries a session. A routine state
/// report says what the extension is doing; a handover says who is about to buy something, and is
/// sent only when the user presses Buy tokens. They are kept apart deliberately: a report must never
/// touch the parked session, and a handover must never overwrite the extension state with the blanks
/// it does not carry.
///
/// Buying cannot happen here. This handler runs in an app extension, which has no window for StoreKit
/// to anchor a payment sheet to, so all it does is park the session for the app that can.
class SafariWebExtensionHandler: NSObject, NSExtensionRequestHandling {

    func beginRequest(with context: NSExtensionContext) {
        let request = context.inputItems.first as? NSExtensionItem

        // `SFExtensionMessageKey` is available from iOS 15 / macOS 11, both at or below our deployment
        // targets (iOS 15, macOS 13), so no availability fallback is needed.
        let message = request?.userInfo?[SFExtensionMessageKey]

        var reply: [String: Any] = [:]

        if let payload = message as? [String: Any] {
            if let authToken = payload["authToken"] as? String {
                // A handover, not a report. It says nothing about setup or site access, so recording
                // it as state would blank both.
                let apiUrl = payload["apiUrl"] as? String
                reply["handoverAccepted"] = GuardAppGroup.handOverAuthToken(authToken, apiUrl: apiUrl)

                os_log(.default, "Guard: handed a session to the app for %{public}@",
                       apiUrl ?? "no reported api url")
            } else {
                GuardAppGroup.recordExtensionState(
                    hasCompletedSetup: payload["hasCompletedSetup"] as? Bool ?? false,
                    hasSiteAccess: payload["hasSiteAccess"] as? Bool ?? false,
                    websiteUrl: payload["websiteUrl"] as? String,
                    apiUrl: payload["apiUrl"] as? String
                )

                // Draining is deliberate: a queued command must fire once, not on every subsequent
                // report. Only a report drains it — a handover happens while the user is in the
                // settings page, where a queued "open Settings" would have nothing to do.
                switch GuardAppGroup.takePendingCommand() {
                case .openSetup: reply["openSetup"] = true
                case .openOptions: reply["openOptions"] = true
                case .none: break
                }
            }
        } else {
            os_log(.default, "Unexpected native message payload: %@", String(describing: message))
        }

        let response = NSExtensionItem()
        response.userInfo = [SFExtensionMessageKey: reply]

        context.completeRequest(returningItems: [response], completionHandler: nil)
    }

}
