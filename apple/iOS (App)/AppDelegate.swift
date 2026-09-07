//
//  AppDelegate.swift
//  iOS (App)
//
//  Created by Stefan Scholz on 15.07.26.
//

import UIKit

@main
class AppDelegate: UIResponder, UIApplicationDelegate {

    var window: UIWindow?

    func application(_ application: UIApplication, didFinishLaunchingWithOptions launchOptions: [UIApplication.LaunchOptionsKey: Any]?) -> Bool {
        // Before any UI: this is the App Store's retry channel for a charge that was taken but never
        // reported, and it has to be listening from the moment the app is alive.
        GuardStore.shared.startListeningForTransactions()
        return true
    }

    func application(_ application: UIApplication, configurationForConnecting connectingSceneSession: UISceneSession, options: UIScene.ConnectionOptions) -> UISceneConfiguration {
        return UISceneConfiguration(name: "Default Configuration", sessionRole: connectingSceneSession.role)
    }

}
