import AppKit
import Foundation
import SwiftUI

enum AgentTarget: String, CaseIterable, Identifiable {
    case codex
    case claude
    case grok
    case copyOnly

    var id: String { rawValue }

    var title: String {
        switch self {
        case .codex: return "Codex"
        case .claude: return "Claude"
        case .grok: return "Grok / CLI"
        case .copyOnly: return "Other"
        }
    }

    var symbol: String {
        switch self {
        case .codex: return "sparkles"
        case .claude: return "message"
        case .grok: return "terminal"
        case .copyOnly: return "doc.on.clipboard"
        }
    }

    var bundleIdentifiers: [String] {
        switch self {
        case .codex: return ["com.openai.codex", "com.openai.codex.desktop"]
        case .claude: return ["com.anthropic.claudefordesktop"]
        case .grok, .copyOnly: return []
        }
    }

    var opensDesktopApp: Bool { !bundleIdentifiers.isEmpty }
    var harnessTarget: String {
        switch self {
        case .codex: return "codex"
        case .claude: return "claude"
        case .grok, .copyOnly: return "cli"
        }
    }
}

enum HandoffOutcome: Equatable {
    case opened(AgentTarget)
    case copiedForCLI(AgentTarget)
    case copiedOnly
    case copiedButAppMissing(AgentTarget)

    var message: String {
        switch self {
        case .opened(let target): return "Copied and opened \(target.title)."
        case .copiedForCLI: return "Copied for Grok — paste it in your terminal."
        case .copiedOnly: return "Task copied — paste it into any agent."
        case .copiedButAppMissing: return "Copied — selected agent is not installed."
        }
    }
}

struct PreparedTask: Identifiable {
    let id = UUID()
    let title: String
    let prompt: String
    let projectKey: String
    let handoffSequence: Int
    let sourceDigest: String
    let harnessTarget: String?

    init(
        title: String,
        prompt: String,
        projectKey: String = "default",
        handoffSequence: Int = 0,
        sourceDigest: String = "unavailable",
        harnessTarget: String? = nil
    ) {
        self.title = title
        self.prompt = prompt
        self.projectKey = projectKey
        self.handoffSequence = handoffSequence
        self.sourceDigest = sourceDigest
        self.harnessTarget = harnessTarget
    }
}

protocol AgentWorkspaceAdapter {
    func applicationURL(forBundleIdentifier bundleIdentifier: String) -> URL?
    func openApplication(at applicationURL: URL, completion: @escaping (Bool) -> Void)
}

struct SystemAgentWorkspaceAdapter: AgentWorkspaceAdapter {
    let workspace: NSWorkspace

    init(workspace: NSWorkspace = .shared) {
        self.workspace = workspace
    }

    func applicationURL(forBundleIdentifier bundleIdentifier: String) -> URL? {
        workspace.urlForApplication(withBundleIdentifier: bundleIdentifier)
    }

    func openApplication(at applicationURL: URL, completion: @escaping (Bool) -> Void) {
        let configuration = NSWorkspace.OpenConfiguration()
        configuration.activates = true
        workspace.openApplication(at: applicationURL, configuration: configuration) { application, error in
            completion(application != nil && error == nil)
        }
    }
}

protocol AgentClipboardAdapter {
    func write(_ value: String)
}

struct SystemAgentClipboardAdapter: AgentClipboardAdapter {
    func write(_ value: String) {
        NSPasteboard.general.clearContents()
        NSPasteboard.general.setString(value, forType: .string)
    }
}

enum AgentHandoffService {
    private struct RedactionRules: Decodable {
        let valuePatterns: [String]
        let assignmentPattern: String
    }

    // Keep these fallback pattern strings byte-identical to
    // Resources/redaction-patterns.json (parity-tested from tests/test_factory_status.py).
    private static let fallbackPatterns = [
        "(?s)-----BEGIN [^-]*PRIVATE KEY-----.*?-----END [^-]*PRIVATE KEY-----",
        "(?i)\\bBearer\\s+[A-Za-z0-9._~+/=-]+",
        "(?i)\\b(?:sk|pk)_(?:live|test)_[A-Za-z0-9_-]{8,}\\b",
        "\\bsk_[A-Za-z0-9_-]{12,}\\b",
        "(?i)\\b(?:sk-|fal-)[A-Za-z0-9_-]{8,}\\b",
        "\\bAIza[0-9A-Za-z_-]{20,}\\b",
        "\\beyJ[A-Za-z0-9_-]{8,}\\.[A-Za-z0-9_-]{8,}\\.[A-Za-z0-9_-]{8,}\\b",
        "\\bghp_[A-Za-z0-9]{20,}\\b",
        "\\bgithub_pat_[A-Za-z0-9_]{22,}\\b",
        "\\bgh[ousr]_[A-Za-z0-9]{20,}\\b",
        "\\bAKIA[0-9A-Z]{16}\\b",
        "\\bxox[baprs]-[A-Za-z0-9-]{10,}\\b",
        "\\brk_(?:live|test)_[A-Za-z0-9]{8,}\\b",
        "\\bwhsec_[A-Za-z0-9]{16,}\\b",
        "\\bnpm_[A-Za-z0-9]{30,}\\b",
        "\\bSG\\.[A-Za-z0-9_-]{16,}\\.[A-Za-z0-9_-]{16,}\\b",
        "\\bAC[0-9a-f]{32}\\b",
        "\\bappl_[A-Za-z0-9]{16,}\\b",
        "(?i)\\b[a-z][a-z0-9+.-]*://[^/\\s:@]+:[^/\\s:@]+@[^\\s]+",
        "\\bMII[A-Za-z0-9+/=\\r\\n]{60,}",
        "(?i)[\"']?([A-Za-z0-9_.-]*(?:api[_ -]?key|private[_ -]?key|client[_ -]?secret|secret|password|passwd|token|authorization|credential|access[_ -]?token)[A-Za-z0-9_.-]*)[\"']?\\s*[:=]\\s*(?:[\"'][^\"']+[\"']|(?!\\d+(?:[\\s,;]|$))[^\\s,;\"']+)",
    ]

    private static var redactionRules: RedactionRules {
        guard let url = Bundle.main.url(
            forResource: "patterns",
            withExtension: "json",
            subdirectory: "Redaction"
        ), let data = try? Data(contentsOf: url),
           let rules = try? JSONDecoder().decode(RedactionRules.self, from: data) else {
            return RedactionRules(
                valuePatterns: Array(fallbackPatterns.dropLast()),
                assignmentPattern: fallbackPatterns.last ?? "(?!)"
            )
        }
        return rules
    }

    static func redact(_ input: String) -> String {
        let rules = redactionRules
        let valuesRedacted = rules.valuePatterns.reduce(input) { output, pattern in
            guard let expression = try? NSRegularExpression(pattern: pattern) else { return output }
            return expression.stringByReplacingMatches(
                in: output,
                range: NSRange(output.startIndex..<output.endIndex, in: output),
                withTemplate: "[REDACTED]"
            )
        }
        guard let assignment = try? NSRegularExpression(pattern: rules.assignmentPattern) else {
            return valuesRedacted
        }
        return assignment.stringByReplacingMatches(
            in: valuesRedacted,
            range: NSRange(valuesRedacted.startIndex..<valuesRedacted.endIndex, in: valuesRedacted),
            withTemplate: "$1=[REDACTED]"
        )
    }

    static func outcome(for target: AgentTarget, appWasOpened: Bool) -> HandoffOutcome {
        switch target {
        case .grok: return .copiedForCLI(target)
        case .copyOnly: return .copiedOnly
        case .codex, .claude:
            return appWasOpened ? .opened(target) : .copiedButAppMissing(target)
        }
    }

    static func isInstalled(
        _ target: AgentTarget,
        workspace: any AgentWorkspaceAdapter = SystemAgentWorkspaceAdapter()
    ) -> Bool {
        target.bundleIdentifiers.contains { workspace.applicationURL(forBundleIdentifier: $0) != nil }
    }

    static func deliver(
        _ prompt: String,
        to target: AgentTarget,
        workspace: any AgentWorkspaceAdapter = SystemAgentWorkspaceAdapter(),
        clipboard: any AgentClipboardAdapter = SystemAgentClipboardAdapter(),
        completion: @escaping (HandoffOutcome) -> Void
    ) {
        let safePrompt = redact(prompt)
        clipboard.write(safePrompt)

        guard target.opensDesktopApp else {
            completion(outcome(for: target, appWasOpened: false))
            return
        }
        guard let applicationURL = target.bundleIdentifiers.compactMap({
            workspace.applicationURL(forBundleIdentifier: $0)
        }).first else {
            completion(outcome(for: target, appWasOpened: false))
            return
        }

        workspace.openApplication(at: applicationURL) { opened in
            completion(outcome(for: target, appWasOpened: opened))
        }
    }
}

struct AgentHandoffSheet: View {
    let task: PreparedTask
    let onComplete: (HandoffOutcome) -> Void

    @Environment(\.dismiss) private var dismiss
    @AppStorage private var preferredTarget: String
    @State private var isDelivering = false

    init(task: PreparedTask, onComplete: @escaping (HandoffOutcome) -> Void) {
        self.task = task
        self.onComplete = onComplete
        let preparedTarget: AgentTarget = task.harnessTarget == "claude" ? .claude
            : task.harnessTarget == "cli" ? .grok : .codex
        _preferredTarget = AppStorage(
            wrappedValue: preparedTarget.rawValue,
            "preferredAgentTarget.\(task.projectKey)"
        )
    }

    private var target: AgentTarget {
        AgentTarget(rawValue: preferredTarget) ?? .codex
    }

    private var targetMatchesContract: Bool {
        task.harnessTarget == nil || task.harnessTarget == target.harnessTarget
    }

    var body: some View {
        VStack(alignment: .leading, spacing: 16) {
            VStack(alignment: .leading, spacing: 4) {
                Text("Continue in…").font(.title2.bold())
                Text(task.title).font(.headline)
                Text("Verified handoff \(task.handoffSequence) is copied first. Desktop agents are only brought forward; no prompt is injected or executed.")
                    .font(.callout)
                    .foregroundStyle(.secondary)
            }

            Picker("Agent", selection: $preferredTarget) {
                ForEach(AgentTarget.allCases) { target in
                    Label(target.title, systemImage: target.symbol).tag(target.rawValue)
                }
            }
            .pickerStyle(.segmented)

            if target.opensDesktopApp && !AgentHandoffService.isInstalled(target) {
                Label("This desktop app was not found. The task will still be copied.", systemImage: "exclamationmark.triangle")
                    .foregroundStyle(.orange)
            } else if !target.opensDesktopApp {
                Label("Copy-only handoff. Factory Status will not run a CLI or shell command.", systemImage: "lock.shield")
                    .foregroundStyle(.secondary)
            }
            if !targetMatchesContract {
                Label("This packet was prepared for \(task.harnessTarget ?? "another adapter"). Refresh context for \(target.title) before handoff.", systemImage: "arrow.triangle.2.circlepath")
                    .foregroundStyle(.orange)
            }

            ScrollView {
                Text(AgentHandoffService.redact(task.prompt))
                    .font(.callout.monospaced())
                    .textSelection(.enabled)
                    .frame(maxWidth: .infinity, alignment: .leading)
                    .padding(12)
            }
            .frame(minHeight: 180, maxHeight: 280)
            .background(Color.secondary.opacity(0.07), in: RoundedRectangle(cornerRadius: 12))
            Text("Source \(task.sourceDigest)")
                .font(.caption.monospaced())
                .foregroundStyle(.secondary)
                .lineLimit(1)

            HStack {
                Button("Cancel", role: .cancel) { dismiss() }
                Spacer()
                Button(target.opensDesktopApp ? "Copy & Open \(target.title)" : "Copy task") {
                    isDelivering = true
                    AgentHandoffService.deliver(task.prompt, to: target) { outcome in
                        DispatchQueue.main.async {
                            isDelivering = false
                            onComplete(outcome)
                            dismiss()
                        }
                    }
                }
                .buttonStyle(.borderedProminent)
                .keyboardShortcut(.defaultAction)
                .disabled(isDelivering || !targetMatchesContract)
            }
        }
        .padding(24)
        .frame(minWidth: 560, minHeight: 460)
    }
}
