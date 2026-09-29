import CryptoKit
import Foundation
import SwiftUI

enum ContextHealth: String, Equatable {
    case ready
    case stale
    case needsEvidence = "needs_evidence"

    var title: String {
        switch self {
        case .ready: return "Context ready"
        case .stale: return "Context stale"
        case .needsEvidence: return "Context needs evidence"
        }
    }

    var symbol: String {
        switch self {
        case .ready: return "checkmark.shield.fill"
        case .stale: return "clock.badge.exclamationmark"
        case .needsEvidence: return "doc.badge.ellipsis"
        }
    }

    var color: Color {
        switch self {
        case .ready: return .green
        case .stale: return .orange
        case .needsEvidence: return .purple
        }
    }
}

enum HarnessHealth: String, Equatable {
    case compatible
    case degraded
    case blocked

    var title: String { "Harness: \(rawValue.capitalized)" }
    var symbol: String {
        switch self {
        case .compatible: return "checkmark.seal.fill"
        case .degraded: return "exclamationmark.triangle.fill"
        case .blocked: return "xmark.octagon.fill"
        }
    }
    var color: Color {
        switch self {
        case .compatible: return .green
        case .degraded: return .orange
        case .blocked: return .red
        }
    }
}

struct ContextSnapshot: Equatable {
    let health: ContextHealth
    let taskId: String
    let capsuleId: String
    let repositoryFingerprint: String
    let exactNextAction: String
    let sourceDigest: String
    let handoffSequence: Int
    let detail: String
    let capsuleBytes: Int?
    let estimatedTokens: Int?
    let harnessHealth: HarnessHealth
    let harnessTarget: String
    let adapterVersion: String
    let capsuleSchemaVersion: Int?
    let packetDigest: String
    let validationErrors: [String]
    let opaqueHarnessOverhead: String

    var allowsHandoff: Bool { health == .ready && harnessHealth == .compatible }
    var repairTitle: String { "Refresh context" }
}

enum ContextSnapshotLoader {
    static func load(projectRoot: URL, run: RunState?) -> ContextSnapshot {
        guard let run else {
            return missing(projectRoot: projectRoot, detail: "Start or resume a factory task to prepare a context capsule.")
        }
        let task = run.handoffTask
        let taskId = task?.id ?? run.context?.taskId ?? "unassigned"
        let capsuleId = task?.capsuleId ?? run.context?.capsuleId ?? taskId
        let nextAction = task?.exactNextAction ?? run.context?.exactNextAction ?? task?.title
            ?? "Select the next accepted factory task."
        let capsuleURL = safeCapsuleURL(projectRoot: projectRoot, capsuleId: capsuleId)

        guard let capsuleURL,
              let data = try? Data(contentsOf: capsuleURL, options: .mappedIfSafe),
              let object = try? JSONSerialization.jsonObject(with: data) as? [String: Any] else {
            return ContextSnapshot(
                health: .needsEvidence,
                taskId: taskId,
                capsuleId: capsuleId,
                repositoryFingerprint: repositoryFingerprint(projectRoot: projectRoot, head: currentGitHead(projectRoot)),
                exactNextAction: nextAction,
                sourceDigest: task?.sourceDigest ?? run.context?.sourceDigest ?? "unavailable",
                handoffSequence: max(0, task?.handoffSequence ?? run.context?.handoffSequence ?? 0),
                detail: run.reviewPendingTasks.isEmpty
                    ? "Prepare a verified capsule before continuing in another agent."
                    : "A completion receipt is waiting for lead review.",
                capsuleBytes: nil,
                estimatedTokens: nil,
                harnessHealth: .blocked,
                harnessTarget: run.context?.harnessTarget ?? "unknown",
                adapterVersion: run.context?.adapterVersion ?? "unknown",
                capsuleSchemaVersion: nil,
                packetDigest: run.context?.packetDigest ?? "unavailable",
                validationErrors: ["missing_capsule"],
                opaqueHarnessOverhead: "unknown"
            )
        }

        let project = object["project"] as? [String: Any]
        let source = object["source"] as? [String: Any]
        let current = object["current"] as? [String: Any]
        let contract = object["contract"] as? [String: Any]
        let schemaVersion = object["schemaVersion"] as? Int
        let capsuleHead = firstString(
            object["head"], object["sourceRevision"], object["revision"],
            project?["head"], project?["revision"], source?["head"], source?["revision"]
        )
        let currentHead = currentGitHead(projectRoot)
        let digest = sha256(data)
        let declaredDigest = firstString(
            object["sourceDigest"], source?["digest"], project?["workingTreeDigest"],
            task?.sourceDigest, run.context?.sourceDigest
        )
        let explicitHealth = firstString(object["health"], object["status"], run.context?.health)
        let headMismatch = capsuleHead != nil && currentHead != nil && capsuleHead != currentHead
        let reviewPending = !run.reviewPendingTasks.isEmpty
        var validationErrors: [String] = []
        if schemaVersion != 2 { validationErrors.append("unsupported_schema") }
        if firstString(object["contractType"]) != "context_capsule" { validationErrors.append("invalid_contract_type") }
        let target = firstString(contract?["target"], run.context?.harnessTarget) ?? "unknown"
        let adapterVersion = firstString(contract?["adapterVersion"], run.context?.adapterVersion) ?? "unknown"
        let packetDigest = firstString(contract?["packetDigest"], run.context?.packetDigest) ?? "unavailable"
        if !["codex", "claude", "cli"].contains(target) { validationErrors.append("invalid_harness_target") }
        if adapterVersion == "unknown" { validationErrors.append("missing_adapter_version") }
        if !packetDigest.hasPrefix("sha256:") || packetDigest.count != 71 { validationErrors.append("invalid_packet_digest") }
        if let stateDigest = run.context?.sourceDigest, let declaredDigest, stateDigest != declaredDigest {
            validationErrors.append("source_digest_mismatch")
        }
        let declaredHarness = firstString(run.context?.harnessStatus)
        let harnessHealth: HarnessHealth
        if declaredHarness == "blocked" || !validationErrors.isEmpty || headMismatch {
            harnessHealth = .blocked
        } else if declaredHarness == "degraded" {
            harnessHealth = .degraded
        } else {
            harnessHealth = .compatible
        }
        let health: ContextHealth
        let detail: String

        if explicitHealth == "stale" || headMismatch {
            health = .stale
            detail = "The capsule no longer matches the current project source. Refresh it before handoff."
        } else if explicitHealth == "needs_evidence" || reviewPending {
            health = .needsEvidence
            detail = "Lead review must accept the receipt before this task counts as complete."
        } else {
            health = .ready
            detail = "Capsule and project source match. The handoff is safe to copy."
        }

        return ContextSnapshot(
            health: health,
            taskId: firstString(object["taskId"], taskId) ?? taskId,
            capsuleId: firstString(object["capsuleId"], object["id"], capsuleId) ?? capsuleId,
            repositoryFingerprint: firstString(object["repositoryFingerprint"], project?["fingerprint"])
                ?? repositoryFingerprint(projectRoot: projectRoot, head: currentHead),
            exactNextAction: firstString(
                object["exactNextAction"], object["nextAction"], current?["exactNextAction"], nextAction
            ) ?? nextAction,
            sourceDigest: declaredDigest ?? digest,
            handoffSequence: max(0, firstInt(object["handoffSequence"], run.context?.handoffSequence) ?? 0),
            detail: detail,
            capsuleBytes: data.count,
            estimatedTokens: run.context?.estimatedTokens ?? max(1, data.count / 4),
            harnessHealth: harnessHealth,
            harnessTarget: target,
            adapterVersion: adapterVersion,
            capsuleSchemaVersion: schemaVersion,
            packetDigest: packetDigest,
            validationErrors: Array(Set(validationErrors)).sorted(),
            opaqueHarnessOverhead: "unknown"
        )
    }

    private static func missing(projectRoot: URL, detail: String) -> ContextSnapshot {
        ContextSnapshot(
            health: .needsEvidence,
            taskId: "unassigned",
            capsuleId: "unavailable",
            repositoryFingerprint: repositoryFingerprint(projectRoot: projectRoot, head: currentGitHead(projectRoot)),
            exactNextAction: "Prepare the next factory task.",
            sourceDigest: "unavailable",
            handoffSequence: 0,
            detail: detail,
            capsuleBytes: nil,
            estimatedTokens: nil,
            harnessHealth: .blocked,
            harnessTarget: "unknown",
            adapterVersion: "unknown",
            capsuleSchemaVersion: nil,
            packetDigest: "unavailable",
            validationErrors: ["missing_context"],
            opaqueHarnessOverhead: "unknown"
        )
    }

    private static func safeCapsuleURL(projectRoot: URL, capsuleId: String) -> URL? {
        let allowed = CharacterSet(charactersIn: "abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789._-")
        guard !capsuleId.isEmpty, capsuleId.unicodeScalars.allSatisfy(allowed.contains) else { return nil }
        let directory = projectRoot.appendingPathComponent(".factory/context", isDirectory: true)
        let candidate = directory.appendingPathComponent("\(capsuleId).json").standardizedFileURL
        guard candidate.path.hasPrefix(directory.standardizedFileURL.path + "/") else { return nil }
        return candidate
    }

    private static func currentGitHead(_ projectRoot: URL) -> String? {
        let git = projectRoot.appendingPathComponent(".git")
        var gitDirectory = git
        if let text = try? String(contentsOf: git, encoding: .utf8), text.hasPrefix("gitdir:") {
            let raw = text.dropFirst("gitdir:".count).trimmingCharacters(in: .whitespacesAndNewlines)
            gitDirectory = raw.hasPrefix("/")
                ? URL(fileURLWithPath: raw)
                : projectRoot.appendingPathComponent(raw).standardizedFileURL
        }
        guard let head = try? String(contentsOf: gitDirectory.appendingPathComponent("HEAD"), encoding: .utf8)
            .trimmingCharacters(in: .whitespacesAndNewlines) else { return nil }
        guard head.hasPrefix("ref: ") else { return head.isEmpty ? nil : head }
        let ref = String(head.dropFirst(5))
        if let value = try? String(contentsOf: gitDirectory.appendingPathComponent(ref), encoding: .utf8)
            .trimmingCharacters(in: .whitespacesAndNewlines), !value.isEmpty { return value }
        guard let packed = try? String(contentsOf: gitDirectory.appendingPathComponent("packed-refs"), encoding: .utf8) else {
            return nil
        }
        return packed.split(separator: "\n").first { $0.hasSuffix(" \(ref)") }.map {
            String($0.split(separator: " ", maxSplits: 1)[0])
        }
    }

    private static func repositoryFingerprint(projectRoot: URL, head: String?) -> String {
        "\(projectRoot.lastPathComponent)@\((head ?? "unknown").prefix(10))"
    }

    private static func sha256(_ data: Data) -> String {
        SHA256.hash(data: data).map { String(format: "%02x", $0) }.joined()
    }

    private static func firstString(_ values: Any?...) -> String? {
        values.compactMap { $0 as? String }.first { !$0.isEmpty }
    }

    private static func firstInt(_ values: Any?...) -> Int? {
        values.compactMap { $0 as? Int }.first
    }
}

struct ContextHealthCard: View {
    let snapshot: ContextSnapshot
    let onContinue: () -> Void
    let onRepair: () -> Void

    var body: some View {
        VStack(alignment: .leading, spacing: 10) {
            HStack(alignment: .firstTextBaseline) {
                Label(snapshot.health.title, systemImage: snapshot.health.symbol)
                    .font(.headline)
                    .foregroundStyle(snapshot.health.color)
                Spacer()
                Text(snapshot.repositoryFingerprint)
                    .font(.caption.monospaced())
                    .foregroundStyle(.secondary)
                    .textSelection(.enabled)
            }
            Text(snapshot.detail)
                .font(.callout)
                .foregroundStyle(.secondary)
            Label(snapshot.harnessHealth.title, systemImage: snapshot.harnessHealth.symbol)
                .font(.subheadline.bold())
                .foregroundStyle(snapshot.harnessHealth.color)
            LabeledContent("Next", value: snapshot.exactNextAction)
            DisclosureGroup("Context inspector") {
                VStack(alignment: .leading, spacing: 5) {
                    LabeledContent("Target", value: snapshot.harnessTarget)
                    LabeledContent("Adapter", value: snapshot.adapterVersion)
                    LabeledContent("Schemas", value: "capsule v\(snapshot.capsuleSchemaVersion.map(String.init) ?? "?") · receipt v2")
                    LabeledContent("Packet", value: snapshot.packetDigest)
                    LabeledContent("Source", value: snapshot.sourceDigest)
                    LabeledContent("Opaque overhead", value: snapshot.opaqueHarnessOverhead)
                    if let bytes = snapshot.capsuleBytes, let tokens = snapshot.estimatedTokens {
                        LabeledContent("Capsule", value: "\(bytes) B · ~\(tokens) tokens")
                    }
                    if !snapshot.validationErrors.isEmpty {
                        LabeledContent("Errors", value: snapshot.validationErrors.joined(separator: ", "))
                    }
                }
                .font(.caption)
                .textSelection(.enabled)
                .padding(.top, 4)
            }
            HStack {
                Text("Task \(snapshot.taskId) · Capsule \(snapshot.capsuleId)")
                    .font(.caption.monospaced())
                    .foregroundStyle(.secondary)
                    .lineLimit(1)
                Spacer()
                if snapshot.allowsHandoff {
                    Button("Continue in…", action: onContinue)
                        .buttonStyle(.borderedProminent)
                        .help("Copy a verified handoff and open the selected agent")
                } else {
                    Button(snapshot.repairTitle, action: onRepair)
                        .buttonStyle(.borderedProminent)
                        .help(snapshot.detail)
                }
            }
        }
        .padding(14)
        .background(snapshot.health.color.opacity(0.08), in: RoundedRectangle(cornerRadius: 14))
        .accessibilityElement(children: .contain)
    }
}
