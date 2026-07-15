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
class SafariWebExtensionHandler: NSObject, NSExtensionRequestHandling {

    func beginRequest(with context: NSExtensionContext) {
        let request = context.inputItems.first as? NSExtensionItem

        let message: Any?
        if #available(iOS 15.0, macOS 11.0, *) {
            message = request?.userInfo?[SFExtensionMessageKey]
        } else {
            message = request?.userInfo?["message"]
        }

        if let state = message as? [String: Any] {
            GuardAppGroup.recordExtensionState(
                hasCompletedSetup: state["hasCompletedSetup"] as? Bool ?? false,
                hasSiteAccess: state["hasSiteAccess"] as? Bool ?? false,
                websiteUrl: state["websiteUrl"] as? String
            )
        } else {
            os_log(.default, "Unexpected native message payload: %@", String(describing: message))
        }

        // Draining is deliberate: a queued command must fire once, not on every subsequent report.
        var reply: [String: Any] = [:]
        switch GuardAppGroup.takePendingCommand() {
        case .openSetup: reply["openSetup"] = true
        case .openOptions: reply["openOptions"] = true
        case .none: break
        }

        let response = NSExtensionItem()
        if #available(iOS 15.0, macOS 11.0, *) {
            response.userInfo = [SFExtensionMessageKey: reply]
        } else {
            response.userInfo = ["message": reply]
        }

        context.completeRequest(returningItems: [response], completionHandler: nil)
    }

}
