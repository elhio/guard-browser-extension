//
//  GuardStore.swift
//  Shared (App)
//
//  Selling token bundles through the App Store. Lives in the app because StoreKit will not present a
//  payment sheet from `SafariWebExtensionHandler` — an app extension has no window to anchor one to —
//  so the extension's Buy button hands the session over and launches us.
//

import Foundation
import os.log
import StoreKit

/// Why the store cannot be shown, or why a purchase did not go through.
///
/// A code rather than a sentence: every user-visible string in this app lives in the localized
/// `Main.html`, and the web view picks the right one from this value. It is an `Error` only so that
/// opening the store can answer with a `Result`.
enum GuardStoreReason: String, Error {

    // MARK: The store could not be opened

    /// No session was handed over, or the server no longer recognises it.
    case session
    /// The extension has never reported where its API lives, so there is nothing to call. Only
    /// happens on a build that has not run in Safari yet, and is worth telling apart from `session`
    /// because the fix is different: the extension has to run once, not be signed into.
    case notReported
    /// The server or the network was unreachable. Worth trying again.
    case network
    /// Nothing is on sale: no bundle is paired with a product the App Store knows.
    case unavailable
    /// There is no subscription, or the plan does not allow buying bundles.
    case plan
    /// The account is barred from buying, which happens after a refund.
    case restricted

    // MARK: A purchase ended

    /// The App Store did not charge. Nothing was taken and nothing is owed.
    case payment
    /// Charged, and the server has not confirmed it yet. The tokens are still coming.
    case reporting
    /// Charged, and waiting on someone else to approve it, typically a parent.
    case approval
    /// Charged, and the server will not credit it. Only a person can sort this out.
    case unsettled
}

/// One bundle as it is offered, priced by the App Store rather than by us.
///
/// The price shown must be the storefront's own — that is what Apple charges and what review expects
/// to see — so it comes from `Product`, not from the API's price list.
struct GuardStoreItem {
    let productId: String
    let name: String
    /// The bundle's own sentence, in the app's language, as the server resolved it.
    let description: String
    let tokenAmount: Int
    let displayPrice: String
}

/// What came of asking to buy something.
///
/// Three of these are shown to the user as three different things, and the difference is whether the
/// App Store took any money. Saying "it failed" over a charge that went through, and whose tokens are
/// on their way, is the one answer that would be a lie.
enum GuardPurchaseOutcome {
    /// Charged, reported, credited and finished. The tokens are on the account now.
    case credited
    /// The user backed out of the payment sheet.
    case cancelled
    /// Charged, not yet credited. Nothing is lost: the transaction stays unfinished, so the App Store
    /// redelivers it, and the server credits it from the account stamp regardless of this app.
    case pending(GuardStoreReason)
    /// Either nothing was charged, or something was and only a person can now put it right.
    case failed(GuardStoreReason)
}

/// Owns everything StoreKit, and the rule that a charge is only finished once the server has it.
///
/// Main-actor bound because its state is shared between the view controller and the background loop
/// watching for charges that arrived while the app was closed, and both must not touch it at once.
/// Nothing here blocks: every long step is an `await`.
@MainActor
final class GuardStore {

    static let shared = GuardStore()

    /// How many times a report that might still succeed is retried, and how long between attempts.
    ///
    /// The endpoint allows six calls a minute, so the waits are deliberately unhurried. Giving up
    /// costs nothing: the transaction stays unfinished, the App Store redelivers it, and the server's
    /// own `ONE_TIME_CHARGE` notification credits it regardless.
    private static let reportAttempts = 3
    private static let reportBackoff: [UInt64] = [5, 15]

    /// The answers that mean this charge will never credit itself.
    ///
    /// Everything else — a server error, a lost connection, a session that expired mid-flow — is
    /// worth another attempt now or on the next launch, so it is reported to the user as pending
    /// rather than as a failure.
    private static let refusals: Set<Int> = [400, 402, 403, 404, 409]

    /// The live store session: an API client, who is buying, and what is on sale.
    ///
    /// In memory only, and only for as long as the app runs. It is set up from a token the extension
    /// handed over and is never written anywhere.
    private var api: GuardApi?
    private var userId: UUID?
    private var products: [String: Product] = [:]
    private var updatesTask: Task<Void, Never>?

    private init() {}

    // MARK: - Launch

    /// Starts listening for charges that arrived while the app was not running.
    ///
    /// Called before any UI, because this is the App Store's own retry channel: anything reported but
    /// never finished — the app died mid-purchase, or the server was down — comes back through here.
    /// Without a session it can only be noted; the tokens still arrive, because the server credits the
    /// purchase from the account stamped on the transaction.
    func startListeningForTransactions() {
        guard updatesTask == nil else { return }

        updatesTask = Task { [weak self] in
            for await update in Transaction.updates {
                guard case .verified(let transaction) = update else { continue }
                await self?.settle(transaction)
            }
        }
    }

    // MARK: - Opening the store

    /// Collects the handed-over session and works out what can be sold.
    ///
    /// - Returns: What to offer, or why there is nothing to offer.
    func open() async -> Result<[GuardStoreItem], GuardStoreReason> {
        // A handover is good for one collection, so the session set up by the first open is reused.
        // Backing out of a payment sheet returns here, and there would be nothing left to take.
        let api: GuardApi
        if let existing = self.api {
            api = existing
        } else {
            guard let token = await GuardAppGroup.takeAuthToken() else { return .failure(.session) }

            guard let baseUrl = GuardAppGroup.apiUrl else {
                os_log(.error, "Guard: a session was handed over but no api url has been reported")
                return .failure(.notReported)
            }

            do {
                api = try GuardApi(token: token, baseUrl: baseUrl)
            } catch {
                return .failure(.notReported)
            }

            os_log(.default, "Guard: opening the store against %{public}@", baseUrl.absoluteString)
        }

        // Kept before the first call rather than after the last, so a store that failed on an
        // unreachable server can be retried: the handover was already spent collecting this.
        self.api = api

        do {
            let user = try await api.user()
            guard !user.isRestricted else { return .failure(.restricted) }

            guard let subscription = try await api.subscription(), subscription.allowBundlePurchases
            else { return .failure(.plan) }

            let bundles = try await api.bundles()

            self.userId = user.id

            // Now that there is a session, anything the App Store charged for but we never reported
            // can finally be settled. Deliberately not awaited: it must not hold up the store.
            Task { await self.settleUnfinished() }

            return await offer(bundles)
        } catch {
            return .failure(Self.reason(for: error))
        }
    }

    /// Pairs each bundle with its App Store product, cheapest first.
    ///
    /// A bundle with no product id, or one the App Store does not know, is dropped rather than shown
    /// unbuyable — and the server would refuse it anyway, since it maps the product back to a bundle.
    private func offer(_ bundles: [GuardBundle]) async -> Result<[GuardStoreItem], GuardStoreReason> {
        let byProductId = Dictionary(
            bundles.compactMap { bundle in bundle.appleProductId.map { ($0, bundle) } },
            uniquingKeysWith: { first, _ in first }
        )
        guard !byProductId.isEmpty else {
            os_log(.error, "Guard: no bundle carries an apple product id")
            return .failure(.unavailable)
        }

        let products: [Product]
        do {
            products = try await Product.products(for: Array(byProductId.keys))
        } catch {
            os_log(.error, "Guard: could not read products from the app store: %{public}@",
                   String(describing: error))
            return .failure(.network)
        }

        // Worth saying out loud: an id the App Store does not know is silently missing from the
        // answer, and the only symptom would otherwise be a shorter list than expected.
        let missing = byProductId.keys.filter { id in !products.contains { $0.id == id } }
        if !missing.isEmpty {
            os_log(.error, "Guard: the app store knows nothing of %{public}@",
                   missing.sorted().joined(separator: ", "))
        }

        // Kept so buying does not have to ask the App Store a second time for something already in
        // front of the user.
        self.products = Dictionary(products.map { ($0.id, $0) }, uniquingKeysWith: { first, _ in first })

        let items = products
            .sorted { $0.price < $1.price }
            .compactMap { product -> GuardStoreItem? in
                guard let bundle = byProductId[product.id] else { return nil }
                return GuardStoreItem(
                    productId: product.id,
                    name: bundle.name,
                    description: bundle.description,
                    tokenAmount: bundle.tokenAmount,
                    displayPrice: product.displayPrice
                )
            }

        return items.isEmpty ? .failure(.unavailable) : .success(items)
    }

    // MARK: - Buying

    /// Charges for a bundle and does not call it done until the server has credited it.
    func buy(productId: String) async -> GuardPurchaseOutcome {
        guard let userId else { return .failed(.session) }

        guard let product = products[productId] else { return .failed(.unavailable) }

        do {
            // The account stamp is the only link from an App Store transaction back to an Elhio
            // account. Without it a charge this app fails to report can never be credited
            // automatically, because the server's fallback has no way to tell whose it was.
            switch try await product.purchase(options: [.appAccountToken(userId)]) {
            case .success(let verification):
                guard case .verified(let transaction) = verification else {
                    // Charged, but the App Store's own signature does not check out. Nothing this app
                    // can do settles that, and it is too odd to tell the user nothing happened.
                    os_log(.error, "Guard: the app store returned an unverified transaction")
                    return .failed(.unsettled)
                }
                return await settle(transaction)
            case .userCancelled:
                return .cancelled
            case .pending:
                return .pending(.approval)
            @unknown default:
                return .failed(.payment)
            }
        } catch {
            // Thrown before any charge: the sheet could not be presented, or the payment itself was
            // refused. Nothing was taken.
            os_log(.error, "Guard: the purchase did not start: %{public}@", String(describing: error))
            return .failed(.payment)
        }
    }

    // MARK: - Report, then finish

    /// Reports a charge to the server and finishes it only once that has worked.
    ///
    /// The ordering is the whole contract. Until a transaction is finished the App Store redelivers it
    /// on every launch, and that redelivery is what makes an interrupted purchase recoverable;
    /// finishing one the server never saw throws the purchase away silently.
    @discardableResult
    private func settle(_ transaction: Transaction) async -> GuardPurchaseOutcome {
        // No session means this is a charge redelivered on a launch the user did not come to us
        // through. It cannot be reported now, and it is not lost: it stays unfinished.
        guard let api else { return .pending(.reporting) }

        let transactionId = String(transaction.id)

        for attempt in 0..<Self.reportAttempts {
            do {
                try await api.reportPurchase(transactionId: transactionId)
                await transaction.finish()
                return .credited
            } catch {
                if case GuardApiError.rejected(let status, let detail) = error,
                   Self.refusals.contains(status) {
                    os_log(.error, "Guard: the purchase was refused with %d: %{public}@",
                           status, detail ?? "no detail")

                    // A 400 means the App Store handed us something the server can never accept: not
                    // verifiable, from another app, or already revoked. Leaving it unfinished would
                    // bring it back on every launch for ever, so it is finished here — the one case
                    // where finishing without a credit is right. The other refusals can come out
                    // differently once a person has acted, so they keep their place in the queue.
                    if status == 400 { await transaction.finish() }
                    return .failed(.unsettled)
                }

                os_log(.default, "Guard: could not report the purchase yet: %{public}@",
                       String(describing: error))
                guard attempt < Self.reportBackoff.count else { break }
                try? await Task.sleep(nanoseconds: Self.reportBackoff[attempt] * 1_000_000_000)
            }
        }

        // Out of attempts, but the charge is real and the transaction is still unfinished, so the App
        // Store will offer it again and the server's own notification credits it either way.
        return .pending(.reporting)
    }

    /// Settles anything the App Store still considers outstanding.
    private func settleUnfinished() async {
        for await unfinished in Transaction.unfinished {
            guard case .verified(let transaction) = unfinished else { continue }
            await settle(transaction)
        }
    }

    // MARK: - Reading the server's answer

    /// Turns a failure while opening the store into the reason the user is shown.
    ///
    /// Only used before anything has been charged, which is what lets these read as plain
    /// explanations. The same statuses mean something quite different once money has moved, and are
    /// mapped separately in `settle`.
    private static func reason(for error: Error) -> GuardStoreReason {
        guard let apiError = error as? GuardApiError else { return .network }

        switch apiError {
        case .unreachable: return .network
        case .notConfigured: return .notReported
        case .rejected(let status, _):
            switch status {
            case 401, 404: return .session
            case 402: return .plan
            case 403: return .restricted
            default: return .network
            }
        }
    }
}

/// A pending request to show the store, left by the `elhio-guard://store` URL the extension opens.
///
/// A flag as well as a notification because the two arrival times differ. Opened while the app is
/// already running, the notification is enough. Opened cold, the URL is handled before the web view
/// has finished loading its page, so there is nobody listening yet — the flag is what survives until
/// there is.
enum GuardStoreRequest {

    static let notification = Notification.Name("GuardStoreRequested")

    /// Whether the store's own scheme is what brought the app up or forward.
    static func matches(_ url: URL) -> Bool {
        url.scheme == "elhio-guard" && url.host == "store"
    }

    private static var isPending = false

    /// Records the request and tells anyone already listening.
    static func post() {
        isPending = true
        NotificationCenter.default.post(name: notification, object: nil)
    }

    /// Consumes the request, so a later refresh does not reopen the store the user has left.
    static func take() -> Bool {
        defer { isPending = false }
        return isPending
    }
}
