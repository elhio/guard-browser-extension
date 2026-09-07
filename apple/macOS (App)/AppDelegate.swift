//
//  AppDelegate.swift
//  macOS (App)
//
//  Created by Stefan Scholz on 15.07.26.
//

import Cocoa

@main
class AppDelegate: NSObject, NSApplicationDelegate {

    func applicationDidFinishLaunching(_ notification: Notification) {
        // Before any UI: this is the App Store's retry channel for a charge that was taken but never
        // reported, and it has to be listening from the moment the app is alive.
        GuardStore.shared.startListeningForTransactions()
    }

    /// Opens the store when the extension's Buy button launches us.
    ///
    /// The extension cannot start a purchase itself — StoreKit will not present a payment sheet from
    /// an app extension — so it hands the session over and opens `elhio-guard://store`.
    func application(_ application: NSApplication, open urls: [URL]) {
        // Hopped onto the main actor because the request is shared state the view controller also
        // reads. The hop costs nothing: a request that lands before there is a page to show it on
        // waits as a flag either way.
        Task { @MainActor in
            guard urls.contains(where: GuardStoreRequest.matches) else { return }
            GuardStoreRequest.post()
        }
    }

    func applicationShouldTerminateAfterLastWindowClosed(_ sender: NSApplication) -> Bool {
        return true
    }

}
