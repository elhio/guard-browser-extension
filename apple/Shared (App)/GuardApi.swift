//
//  GuardApi.swift
//  Shared (App)
//
//  The container app's own client for the Elhio API. Only the store needs it — everything else the
//  app shows comes from the App Group.
//

import Foundation

/// What the API answered, in the terms the store cares about.
///
/// The status matters more than the message here, because it decides whether an App Store transaction
/// may be finished. Finishing one the server never credited loses the purchase for good, so a failure
/// that might yet succeed has to stay distinguishable from one that never will.
enum GuardApiError: Error {
    /// The request never reached the server, or the reply was unreadable.
    case unreachable(Error)
    /// The server answered, and said no. `detail` is its own wording where it gave one.
    case rejected(status: Int, detail: String?)
    /// The extension has not reported an API url yet, so there is nothing to call.
    case notConfigured

    /// Whether asking again could plausibly answer differently.
    ///
    /// Anything in the 400s is a settled answer about this request: a rejected transaction stays
    /// rejected, a restricted account stays restricted until the user does something about it. The
    /// 500s and a lost connection are the server's problem, not the request's.
    var isTransient: Bool {
        switch self {
        case .unreachable: return true
        case .notConfigured: return false
        case .rejected(let status, _): return status >= 500
        }
    }
}

/// The signed-in user, as much of it as the store needs.
struct GuardUser: Decodable {
    /// The account id. StoreKit stamps it onto the transaction as `appAccountToken`, and it is the
    /// only thing that lets the server credit a purchase the app failed to report.
    let id: UUID
    let isRestricted: Bool

    private enum CodingKeys: String, CodingKey {
        case id
        case isRestricted = "is_restricted"
    }
}

/// One sellable bundle, paired with the App Store product that charges for it.
struct GuardBundle: Decodable {
    let name: String
    /// A sentence describing the bundle, already in the caller's language. The server resolves it and
    /// falls back to English, so this is empty only when the bundle carries no description at all.
    let description: String
    let tokenAmount: Int
    /// `nil` until someone has pointed this bundle at a product in App Store Connect. Such a bundle
    /// cannot be sold in the app, and the server would refuse the purchase anyway.
    let appleProductId: String?

    private enum CodingKeys: String, CodingKey {
        case name
        case description
        case tokenAmount = "token_amount"
        case appleProductId = "apple_product_id"
    }
}

private struct GuardBundleList: Decodable {
    let data: [GuardBundle]
}

/// The plan's rules, as far as buying goes.
struct GuardSubscription: Decodable {
    let allowBundlePurchases: Bool

    private enum CodingKeys: String, CodingKey {
        case allowBundlePurchases = "allow_bundle_purchases"
    }
}

/// Calls the Elhio API as the signed-in user.
///
/// Built per store session around a token the extension handed over, and thrown away with it. Nothing
/// here is cached or written to disk.
struct GuardApi {

    private let baseUrl: URL
    private let token: String
    private let session: URLSession

    /// - Parameters:
    ///   - token: The bearer token the extension handed over.
    ///   - baseUrl: Where the API lives, as the extension reported it. `nil` means the extension has
    ///     never run, so there is nothing to talk to.
    init(token: String, baseUrl: URL?) throws {
        guard let baseUrl else { throw GuardApiError.notConfigured }

        self.token = token
        self.baseUrl = baseUrl

        // Ephemeral so nothing about a signed-in session survives the store being closed: no cookie
        // jar, no response cache, no credential store on disk.
        let configuration = URLSessionConfiguration.ephemeral
        configuration.timeoutIntervalForRequest = 20
        self.session = URLSession(configuration: configuration)
    }

    /// The account behind the token.
    func user() async throws -> GuardUser {
        try await get("/api/v1/users/me")
    }

    /// The current plan, or `nil` when there is no active subscription — the API says so with a 404.
    func subscription() async throws -> GuardSubscription? {
        do {
            return try await get("/api/v1/users/me/subscription") as GuardSubscription
        } catch GuardApiError.rejected(404, _) {
            return nil
        }
    }

    /// Every bundle on sale. Public, but sent with the token anyway so the API sees one caller.
    func bundles() async throws -> [GuardBundle] {
        let list: GuardBundleList = try await get("/api/v1/bundles/")
        return list.data
    }

    /// Reports a charge the App Store has already taken, so the tokens are credited.
    ///
    /// The transaction id is the whole message. The server fetches the signed transaction from Apple
    /// and verifies it there, so anything else this app claimed would be ignored.
    ///
    /// Idempotent: reporting the same transaction again answers 200 with the purchase it already
    /// made, which is what makes retrying safe.
    func reportPurchase(transactionId: String) async throws {
        var request = try authorized(URLRequest(url: url(for: "/api/v1/purchases/app-store")))
        request.httpMethod = "POST"
        request.setValue("application/json", forHTTPHeaderField: "Content-Type")
        request.httpBody = try JSONEncoder().encode(["transaction_id": transactionId])

        _ = try await send(request)
    }

    // MARK: - Plumbing

    /// The language to ask for, as the app itself is localized.
    ///
    /// Taken from the running app rather than from the system so the store reads in the same language
    /// as the screen around it. The server falls back to English for anything it cannot match, both
    /// when choosing a language and when a particular translation is missing.
    private static var language: String {
        let preferred = Bundle.main.preferredLocalizations.first?.prefix(2).lowercased()
        return preferred == "de" ? "de" : "en"
    }

    private func url(for path: String) -> URL {
        let absolute = URL(string: path, relativeTo: baseUrl) ?? baseUrl.appendingPathComponent(path)

        // Every call carries it, matching what the extension's own client sends. It decides the
        // language of anything the server has translated, and the bundle list is cached per language.
        guard var components = URLComponents(url: absolute, resolvingAgainstBaseURL: true) else {
            return absolute
        }
        components.queryItems = (components.queryItems ?? []) + [
            URLQueryItem(name: "lang", value: Self.language)
        ]
        return components.url ?? absolute
    }

    private func authorized(_ request: URLRequest) throws -> URLRequest {
        var request = request
        request.setValue("Bearer \(token)", forHTTPHeaderField: "Authorization")
        request.setValue("application/json", forHTTPHeaderField: "Accept")
        return request
    }

    private func get<T: Decodable>(_ path: String) async throws -> T {
        let data = try await send(try authorized(URLRequest(url: url(for: path))))
        do {
            return try JSONDecoder().decode(T.self, from: data)
        } catch {
            throw GuardApiError.unreachable(error)
        }
    }

    private func send(_ request: URLRequest) async throws -> Data {
        let data: Data
        let response: URLResponse
        do {
            (data, response) = try await session.data(for: request)
        } catch {
            throw GuardApiError.unreachable(error)
        }

        guard let http = response as? HTTPURLResponse else {
            throw GuardApiError.unreachable(URLError(.badServerResponse))
        }
        guard (200..<300).contains(http.statusCode) else {
            throw GuardApiError.rejected(status: http.statusCode, detail: Self.detail(from: data))
        }
        return data
    }

    /// API puts its own wording in `detail`; anything else is not worth showing.
    private static func detail(from data: Data) -> String? {
        guard let body = try? JSONSerialization.jsonObject(with: data) as? [String: Any] else {
            return nil
        }
        return body["detail"] as? String
    }
}
