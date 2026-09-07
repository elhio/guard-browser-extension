//
//  SceneDelegate.swift
//  iOS (App)
//
//  Created by Stefan Scholz on 15.07.26.
//

import UIKit

class SceneDelegate: UIResponder, UIWindowSceneDelegate {

    var window: UIWindow?

    func scene(_ scene: UIScene, willConnectTo session: UISceneSession, options connectionOptions: UIScene.ConnectionOptions) {
        guard let _ = (scene as? UIWindowScene) else { return }

        // The cold-launch case: tapping Buy tokens in Safari starts the app, so the URL arrives here
        // rather than through `openURLContexts`.
        note(connectionOptions.urlContexts)
    }

    func scene(_ scene: UIScene, openURLContexts URLContexts: Set<UIOpenURLContext>) {
        note(URLContexts)
    }

    /// Records a request to open the store, which the extension makes by opening `elhio-guard://store`.
    private func note(_ contexts: Set<UIOpenURLContext>) {
        guard contexts.contains(where: { GuardStoreRequest.matches($0.url) }) else { return }
        GuardStoreRequest.post()
    }

}
