import AppKit
import Darwin
import Foundation
import SwiftUI

private let allowedTaskStatuses = Set([
    "queued", "running", "waiting_human", "blocked", "succeeded", "skipped", "failed",
    "review_pending", "needs_revision",
])

struct Progress: Decodable {
    let completed: Int
    let total: Int
    let percent: Int
    let running: Int
    let waitingHuman: Int
    let blocked: Int
    let failed: Int
    let queued: Int
    let reviewPending: Int
    let needsRevision: Int

    init(
        completed: Int, total: Int, percent: Int, running: Int, waitingHuman: Int,
        blocked: Int, failed: Int, queued: Int, reviewPending: Int = 0, needsRevision: Int = 0
    ) {
        self.completed = completed
        self.total = total
        self.percent = percent
        self.running = running
        self.waitingHuman = waitingHuman
        self.blocked = blocked
        self.failed = failed
        self.queued = queued
        self.reviewPending = reviewPending
        self.needsRevision = needsRevision
    }

    private enum CodingKeys: String, CodingKey {
        case completed, total, percent, running, waitingHuman, blocked, failed, queued, reviewPending, needsRevision
    }

    init(from decoder: Decoder) throws {
        let values = try decoder.container(keyedBy: CodingKeys.self)
        self.init(
            completed: try values.decode(Int.self, forKey: .completed),
            total: try values.decode(Int.self, forKey: .total),
            percent: try values.decode(Int.self, forKey: .percent),
            running: try values.decode(Int.self, forKey: .running),
            waitingHuman: try values.decode(Int.self, forKey: .waitingHuman),
            blocked: try values.decode(Int.self, forKey: .blocked),
            failed: try values.decode(Int.self, forKey: .failed),
            queued: try values.decode(Int.self, forKey: .queued),
            reviewPending: try values.decodeIfPresent(Int.self, forKey: .reviewPending) ?? 0,
            needsRevision: try values.decodeIfPresent(Int.self, forKey: .needsRevision) ?? 0
        )
    }
}

struct FactoryTask: Decodable, Identifiable {
    let id: String
    let title: String
    let status: String
    let dependsOn: [String]
    let executionLane: String?
    let error: String?
    let waitingReason: String?
    let blockedReason: String?
    let capsuleId: String?
    let exactNextAction: String?
    let sourceDigest: String?
    let handoffSequence: Int?

    init(
        id: String, title: String, status: String, dependsOn: [String], executionLane: String?,
        error: String?, waitingReason: String?, blockedReason: String?, capsuleId: String? = nil,
        exactNextAction: String? = nil, sourceDigest: String? = nil, handoffSequence: Int? = nil
    ) {
        self.id = id
        self.title = title
        self.status = status
        self.dependsOn = dependsOn
        self.executionLane = executionLane
        self.error = error
        self.waitingReason = waitingReason
        self.blockedReason = blockedReason
        self.capsuleId = capsuleId
        self.exactNextAction = exactNextAction
        self.sourceDigest = sourceDigest
        self.handoffSequence = handoffSequence
    }
}

struct RunContextSummary: Decodable {
    let health: String?
    let taskId: String?
    let capsuleId: String?
    let sourceDigest: String?
    let handoffSequence: Int?
    let exactNextAction: String?
    let capsuleBytes: Int?
    let estimatedTokens: Int?
    let harnessStatus: String?
    let harnessTarget: String?
    let adapterVersion: String?
    let packetDigest: String?
}

struct HumanAction: Decodable, Identifiable {
    let id: String
    let title: String
    let instructions: String
    let status: String
    let taskId: String?
    let url: String?
}

struct Evidence: Decodable, Identifiable {
    let id: String
    let taskId: String
    let path: String
    let kind: String
    let label: String
    let createdAt: String
}

struct RunState: Decodable {
    let schemaVersion: Int
    let runId: String
    let phase: String
    let source: String
    let localeProfile: String
    let tasks: [FactoryTask]
    let humanActions: [HumanAction]
    let evidence: [Evidence]
    let progress: Progress
    let humanActiveMinutes: Double?
    let updatedAt: String
    let context: RunContextSummary?

    var openActions: [HumanAction] {
        humanActions.filter { $0.status == "open" }
    }

    var activeTasks: [FactoryTask] {
        tasks.filter { $0.status == "running" }
    }

    var problemTasks: [FactoryTask] {
        tasks.filter { $0.status == "failed" || $0.status == "blocked" }
    }

    var queuedTasks: [FactoryTask] {
        tasks.filter { $0.status == "queued" || $0.status == "waiting_human" }
    }

    var completedTasks: [FactoryTask] {
        tasks.filter { $0.status == "succeeded" || $0.status == "skipped" }
    }

    var reviewPendingTasks: [FactoryTask] {
        tasks.filter { $0.status == "review_pending" }
    }

    var handoffTask: FactoryTask? {
        tasks.first { $0.id == context?.taskId }
            ?? tasks.first { ["running", "needs_revision", "review_pending"].contains($0.status) }
            ?? tasks.first { $0.status == "queued" }
    }

    init(
        schemaVersion: Int, runId: String, phase: String, source: String, localeProfile: String,
        tasks: [FactoryTask], humanActions: [HumanAction], evidence: [Evidence], progress: Progress,
        humanActiveMinutes: Double?, updatedAt: String, context: RunContextSummary? = nil
    ) {
        self.schemaVersion = schemaVersion
        self.runId = runId
        self.phase = phase
        self.source = source
        self.localeProfile = localeProfile
        self.tasks = tasks
        self.humanActions = humanActions
        self.evidence = evidence
        self.progress = progress
        self.humanActiveMinutes = humanActiveMinutes
        self.updatedAt = updatedAt
        self.context = context
    }
}

struct CapabilityDelegation: Decodable {
    let mode: String
    let maxWorkers: Int
}

struct CapabilityWorkflowPolicy: Decodable {
    let strategy: String
    let defaultConcurrency: Int
    let maxConcurrency: Int
    let defaultTotalAgents: Int
    let approvalRequiredAboveTotal: Int
    let requiresWorktreeForWrites: Bool
}

struct CatalogCapability: Decodable, Identifiable {
    let id: String
    let title: String
    let summary: String
    let stages: [String]
    let claudeInvocation: String
    let skillInvocation: String
    let roleIds: [String]
    let prerequisites: [String]
    let availabilityChecks: [String]
    let risk: String
    let delegation: CapabilityDelegation
    let promotional: Bool
    let rank: Int
    let category: String
    let platforms: [String]
    let whenUseful: String?
    let workflowPolicy: CapabilityWorkflowPolicy?

    private enum CodingKeys: String, CodingKey {
        case id, title, summary, stages, claudeInvocation, skillInvocation, roleIds
        case prerequisites, availabilityChecks
        case risk, delegation, promotional, rank, category, platforms, whenUseful, workflowPolicy
    }

    init(from decoder: Decoder) throws {
        let values = try decoder.container(keyedBy: CodingKeys.self)
        id = try values.decode(String.self, forKey: .id)
        title = try values.decode(String.self, forKey: .title)
        summary = try values.decode(String.self, forKey: .summary)
        stages = try values.decode([String].self, forKey: .stages)
        claudeInvocation = try values.decode(String.self, forKey: .claudeInvocation)
        skillInvocation = try values.decode(String.self, forKey: .skillInvocation)
        roleIds = try values.decode([String].self, forKey: .roleIds)
        prerequisites = try values.decodeIfPresent([String].self, forKey: .prerequisites) ?? []
        availabilityChecks = try values.decodeIfPresent([String].self, forKey: .availabilityChecks) ?? []
        risk = try values.decode(String.self, forKey: .risk)
        delegation = try values.decode(CapabilityDelegation.self, forKey: .delegation)
        promotional = try values.decode(Bool.self, forKey: .promotional)
        rank = try values.decode(Int.self, forKey: .rank)
        category = try values.decodeIfPresent(String.self, forKey: .category) ?? "Other"
        platforms = try values.decodeIfPresent([String].self, forKey: .platforms) ?? ["local"]
        whenUseful = try values.decodeIfPresent(String.self, forKey: .whenUseful)
        workflowPolicy = try values.decodeIfPresent(CapabilityWorkflowPolicy.self, forKey: .workflowPolicy)
    }
}

struct CapabilityCatalog: Decodable {
    let schemaVersion: Int
    let capabilities: [CatalogCapability]
}

struct CapabilityRecommendation: Decodable, Identifiable {
    let id: String
    let capabilityId: String
    let title: String
    let reason: String
    let priority: String
    let status: String
    let availability: String
    let invocation: String
    let claudeInvocation: String?
    let skillInvocation: String?
    let roleIds: [String]
    let executionLane: String
    let requiresApproval: Bool
    let dueAt: String?
    let queuePlacement: String?
    let queueOrder: Int?
    let queuedAt: String?
    let recurrence: String?
    let blockedBy: [String]?
    let createdAt: String
    let updatedAt: String
}

struct ExtraCapability: Decodable, Identifiable {
    let id: String
    let title: String
    let summary: String
    let source: String
    let invocation: String?
    let roleIds: [String]

    private enum CodingKeys: String, CodingKey {
        case id, title, name, summary, description, source, invocation, skillInvocation, roleIds
    }

    init(from decoder: Decoder) throws {
        let values = try decoder.container(keyedBy: CodingKeys.self)
        let decodedTitle = try values.decodeIfPresent(String.self, forKey: .title)
            ?? values.decodeIfPresent(String.self, forKey: .name)
            ?? "Discovered capability"
        title = decodedTitle
        let decodedId = try values.decodeIfPresent(String.self, forKey: .id)
        source = try values.decodeIfPresent(String.self, forKey: .source)
            ?? (decodedId?.hasPrefix("extra.mcp.") == true ? "Configured MCP" : "Installed skill")
        id = decodedId
            ?? "\(source):\(decodedTitle)".lowercased().replacingOccurrences(of: " ", with: "-")
        summary = try values.decodeIfPresent(String.self, forKey: .summary)
            ?? values.decodeIfPresent(String.self, forKey: .description)
            ?? "Discovered locally; select it explicitly before use."
        invocation = try values.decodeIfPresent(String.self, forKey: .invocation)
            ?? values.decodeIfPresent(String.self, forKey: .skillInvocation)
        roleIds = try values.decodeIfPresent([String].self, forKey: .roleIds) ?? []
    }
}

struct CapabilityState: Decodable {
    let schemaVersion: Int
    let lifecycleStage: String
    let recommendations: [CapabilityRecommendation]
    let unlockNext: [UnlockCapability]?
    let extras: [ExtraCapability]
    let capabilityAvailability: [String: String]?
    let lastRefreshAt: String?
    let healthRed: Bool?
    let updatedAt: String
}

struct UnlockCapability: Decodable, Identifiable {
    let capabilityId: String
    let title: String
    let reason: String
    let availability: String
    let missingChecks: [String]?
    let blockedBy: [String]?
    let claudeInvocation: String?
    let skillInvocation: String?

    var id: String { capabilityId }
}

struct CapabilityGroup: Identifiable {
    let category: String
    let capabilities: [CatalogCapability]

    var id: String { category }
}

enum DashboardTab: String, CaseIterable, Identifiable {
    case today = "Today"
    case queue = "Queue"
    case capabilities = "Capabilities"

    var id: String { rawValue }
}

struct AndroidProgress: Decodable {
    let completed: Int
    let total: Int
    let percent: Int

    private enum CodingKeys: String, CodingKey {
        case completed, total, percent
    }

    init(from decoder: Decoder) throws {
        let values = try decoder.container(keyedBy: CodingKeys.self)
        completed = max(0, try values.decodeIfPresent(Int.self, forKey: .completed) ?? 0)
        total = max(0, try values.decodeIfPresent(Int.self, forKey: .total) ?? 0)
        let derivedPercent = total > 0 ? Int((Double(completed) / Double(total) * 100).rounded()) : 0
        percent = min(100, max(0, try values.decodeIfPresent(Int.self, forKey: .percent) ?? derivedPercent))
    }
}

struct AndroidParity: Decodable {
    let total: Int
    let pending: Int
    let verified: Int
    let exceptions: Int
    let percent: Int

    private enum CodingKeys: String, CodingKey {
        case total, pending, verified, exceptions, exception, percent
    }

    init(from decoder: Decoder) throws {
        let values = try decoder.container(keyedBy: CodingKeys.self)
        pending = max(0, try values.decodeIfPresent(Int.self, forKey: .pending) ?? 0)
        verified = max(0, try values.decodeIfPresent(Int.self, forKey: .verified) ?? 0)
        exceptions = max(
            0,
            try values.decodeIfPresent(Int.self, forKey: .exceptions)
                ?? values.decodeIfPresent(Int.self, forKey: .exception)
                ?? 0
        )
        total = max(0, try values.decodeIfPresent(Int.self, forKey: .total) ?? pending + verified + exceptions)
        let derivedPercent = total > 0 ? Int((Double(verified) / Double(total) * 100).rounded()) : 0
        percent = min(100, max(0, try values.decodeIfPresent(Int.self, forKey: .percent) ?? derivedPercent))
    }
}

struct AndroidTask: Decodable, Identifiable {
    let id: String
    let title: String
    let status: String
    let error: String?
    let waitingReason: String?
    let blockedReason: String?

    var detail: String? {
        error ?? blockedReason ?? waitingReason
    }
}

struct AndroidHumanAction: Decodable, Identifiable {
    let id: String
    let title: String
    let instructions: String
    let status: String
}

struct AndroidState: Decodable {
    let schemaVersion: Int
    let phase: String
    let progress: AndroidProgress
    let parity: AndroidParity
    let tasks: [AndroidTask]
    let humanActions: [AndroidHumanAction]
    let updatedAt: String?

    var openActions: [AndroidHumanAction] {
        humanActions.filter { ["open", "pending", "required"].contains($0.status) }
    }

    var problemTasks: [AndroidTask] {
        tasks.filter { $0.status == "failed" || $0.status == "blocked" }
    }

    var nextTask: AndroidTask? {
        let activeStatuses = ["running", "in_progress"]
        let nextStatuses = ["waiting_human", "queued", "pending"]
        return tasks.first { nextStatuses.contains($0.status) }
            ?? tasks.first { activeStatuses.contains($0.status) }
    }
}

struct DashboardState {
    let run: RunState?
    let android: AndroidState?
    let capabilityState: CapabilityState?
    let catalog: CapabilityCatalog?
    let warnings: [String]

    var hasContent: Bool {
        run != nil || android != nil || capabilityState != nil || catalog != nil
    }

    var lifecycleStage: String {
        capabilityState?.lifecycleStage ?? run?.phase ?? android?.phase ?? "setup"
    }

    var recommendations: [CapabilityRecommendation] {
        Array((capabilityState?.recommendations ?? [])
            .filter { $0.status == "suggested" && $0.priority == "now" }
            .prefix(3))
    }

    var todos: [CapabilityRecommendation] {
        Array((capabilityState?.recommendations ?? [])
            .filter { $0.status == "todo" }
            .sorted {
                let placement = ["after_current_checkpoint": 0, "after_milestone": 1, "later": 2]
                let left = placement[$0.queuePlacement ?? "after_milestone"] ?? 1
                let right = placement[$1.queuePlacement ?? "after_milestone"] ?? 1
                if left != right { return left < right }
                if ($0.queueOrder ?? .max) != ($1.queueOrder ?? .max) {
                    return ($0.queueOrder ?? .max) < ($1.queueOrder ?? .max)
                }
                return $0.id < $1.id
            }
            .prefix(10))
    }

    var unlockNext: UnlockCapability? { capabilityState?.unlockNext?.first }
}

private enum LoadResult {
    case waiting(String)
    case loaded(DashboardState)
}

private struct WindowConfigurator: NSViewRepresentable {
    func makeNSView(context: Context) -> NSView {
        let view = NSView()
        Task { @MainActor in
            await Task.yield()
            guard let window = view.window else { return }
            window.level = .floating
            window.collectionBehavior = [.canJoinAllSpaces, .fullScreenAuxiliary]
            window.title = "Factory Status"
            window.isReleasedWhenClosed = false
        }
        return view
    }

    func updateNSView(_ nsView: NSView, context: Context) {}
}

struct StatusView: View {
    let statePath: URL
    let previewTaskOnLaunch: PreparedTask?
    @State private var result: LoadResult = .waiting("Waiting for a factory run…")
    @State private var preferredScheme: ColorScheme?
    @State private var selectedTab: DashboardTab = .today
    @State private var capabilitySearch = ""
    @State private var capabilitySurface: CapabilitySurface = .suggested
    @State private var stageFilter = "All"
    @State private var roleFilter = "All"
    @State private var platformFilter = "All"
    @State private var riskFilter = "All"
    @State private var availabilityFilter = "All"
    @State private var undoSnapshot: Data?
    @State private var undoWasMissing = false
    @State private var toastMessage: String?
    @State private var preparedTask: PreparedTask?
    @State private var selectedCapability: CatalogCapability?
    @State private var selectedExtra: ExtraCapability?
    @State private var pendingStageAdvance: JourneyStage?
    @State private var showStageAdvanceConfirmation = false
    @State private var didPresentPreviewTask = false

    init(statePath: URL) {
        self.statePath = statePath
        let arguments = CommandLine.arguments
        let requestedTab: DashboardTab
        if let index = arguments.firstIndex(of: "--tab"), arguments.indices.contains(index + 1) {
            switch arguments[index + 1].lowercased() {
            case "queue": requestedTab = .queue
            case "capabilities": requestedTab = .capabilities
            default: requestedTab = .today
            }
        } else {
            requestedTab = .today
        }
        _selectedTab = State(initialValue: requestedTab)
        if arguments.contains("--preview-task") {
            previewTaskOnLaunch = PreparedTask(
                title: "Review capability",
                prompt: "Review this capability, explain its value and prerequisites, and do not execute external writes without explicit approval."
            )
        } else {
            previewTaskOnLaunch = nil
        }
    }

    var body: some View {
        Group {
            switch result {
            case .waiting(let message):
                fallback(title: "Factory is ready", message: message, symbol: "sparkles")
            case .loaded(let state):
                dashboard(state)
            }
        }
        .frame(minWidth: 680, idealWidth: 760, minHeight: 620, idealHeight: 760)
        .background(Color(nsColor: .windowBackgroundColor))
        .preferredColorScheme(preferredScheme)
        .overlay(alignment: .bottom) {
            if let message = toastMessage {
                HStack(spacing: 12) {
                    Text(message).font(.callout)
                    if undoSnapshot != nil || undoWasMissing {
                        Button("Undo") { undoCapabilityMutation() }
                            .buttonStyle(.bordered)
                    }
                    Button("Dismiss", systemImage: "xmark") { toastMessage = nil }
                        .labelStyle(.iconOnly)
                        .buttonStyle(.borderless)
                }
                .padding(12)
                .background(.regularMaterial, in: Capsule())
                .shadow(radius: 8)
                .padding(.bottom, 14)
            }
        }
        .background(WindowConfigurator())
        .task(id: statePath) {
            if let previewTaskOnLaunch, !didPresentPreviewTask {
                await Task.yield()
                preparedTask = previewTaskOnLaunch
                didPresentPreviewTask = true
            }
            while !Task.isCancelled {
                result = await readDashboard()
                try? await Task.sleep(for: .milliseconds(750))
            }
        }
        .onReceive(NotificationCenter.default.publisher(for: .factoryStatusRefresh)) { _ in
            Task { result = await readDashboard() }
        }
        .onReceive(NotificationCenter.default.publisher(for: .factoryStatusOpenTask)) { notification in
            guard let title = notification.userInfo?["title"] as? String,
                  let prompt = notification.userInfo?["prompt"] as? String else { return }
            selectedTab = .today
            prepareTask(title: title, prompt: prompt)
        }
        .onReceive(NotificationCenter.default.publisher(for: .factoryStatusShowCapabilities)) { _ in
            selectedTab = .capabilities
            capabilitySurface = .suggested
            clearCapabilityFilters()
        }
        .onOpenURL { url in
            guard url.scheme == "app-factory-status", url.host == "status" else { return }
            let tab = URLComponents(url: url, resolvingAgainstBaseURL: false)?
                .queryItems?.first(where: { $0.name == "tab" })?.value
            if tab == "capabilities" {
                selectedTab = .capabilities
                capabilitySurface = .suggested
                clearCapabilityFilters()
            }
        }
        .sheet(item: $preparedTask) { task in
            AgentHandoffSheet(task: task) { outcome in
                toastMessage = outcome.message
                undoSnapshot = nil
                undoWasMissing = false
            }
        }
        .sheet(item: $selectedCapability) { capability in
            let availability = currentAvailability(for: capability.id)
            CapabilityDetailSheet(
                capability: capability,
                availability: availability,
                expectedImprovement: expectedImprovement(for: capability),
                onPrepare: {
                    prepareTaskAfterSheetDismiss(
                        title: capability.title,
                        prompt: prompt(for: capability, availability: availability)
                    )
                },
                onAddLater: { enqueueCapability(capability.id, placement: "later") }
            )
        }
        .sheet(item: $selectedExtra) { extra in
            ExtraCapabilityDetailSheet(
                extra: extra,
                isQueued: isExtraQueued(extra),
                onPrepare: { prepareExtraReview(extra, afterSheetDismiss: true) },
                onAddLater: { enqueueExtraReview(extra) }
            )
        }
        .confirmationDialog(
            pendingStageAdvance.map { "Move to \($0.title)?" } ?? "Move to next stage?",
            isPresented: $showStageAdvanceConfirmation
        ) {
            if let stage = pendingStageAdvance {
                Button("Move to \(stage.title)") { advanceLifecycleStage(to: stage) }
            }
            Button("Cancel", role: .cancel) { pendingStageAdvance = nil }
        } message: {
            Text("This updates only the local capability state. It does not run, deploy, publish, or submit anything.")
        }
    }

    private var themeButton: some View {
        Button {
            preferredScheme = preferredScheme == .dark ? .light : .dark
        } label: {
            Image(systemName: preferredScheme == .dark ? "sun.max" : "moon")
        }
        .buttonStyle(.borderless)
        .help("Toggle light or dark appearance")
        .accessibilityLabel("Toggle appearance")
    }

    private func prepareContextHandoff(_ snapshot: ContextSnapshot) {
        let root = statePath.deletingLastPathComponent().deletingLastPathComponent().path
        let bootstrap = """
        Continue app-factory task \(snapshot.taskId). Project root: \(root).
        Capsule: .factory/context/\(snapshot.capsuleId).json.
        First run `python3 scripts/factoryctl.py context audit \(snapshot.capsuleId)`, then read only the capsule and its contextRefs.
        Exact next action: \(snapshot.exactNextAction)
        Handoff sequence: \(snapshot.handoffSequence). Source digest: \(snapshot.sourceDigest).
        Do not perform external writes without the recorded approval.
        """
        preparedTask = PreparedTask(
            title: "Continue \(snapshot.taskId)",
            prompt: bootstrap,
            projectKey: snapshot.repositoryFingerprint,
            handoffSequence: snapshot.handoffSequence,
            sourceDigest: snapshot.sourceDigest,
            harnessTarget: snapshot.harnessTarget
        )
    }

    private func prepareHarnessRepair(_ snapshot: ContextSnapshot) {
        let root = statePath.deletingLastPathComponent().deletingLastPathComponent().path
        let command = snapshot.validationErrors.isEmpty
            ? "python3 scripts/factoryctl.py harness render \(snapshot.taskId) --target=\(snapshot.harnessTarget == "unknown" ? "cli" : snapshot.harnessTarget)"
            : "python3 scripts/factoryctl.py harness inspect \(snapshot.taskId)"
        let prompt = """
        Diagnose the app-factory harness contract in \(root) for task \(snapshot.taskId).
        Current harness status: \(snapshot.harnessHealth.rawValue). Errors: \(snapshot.validationErrors.joined(separator: ", ")).
        Run `\(command)`, preserve the task scope and approval boundary, and do not retry external writes or protected-file mutations.
        If a local contract is malformed or stale, regenerate it with a fresh `harness render`.
        """
        preparedTask = PreparedTask(
            title: snapshot.repairTitle,
            prompt: prompt,
            projectKey: snapshot.repositoryFingerprint,
            handoffSequence: snapshot.handoffSequence,
            sourceDigest: snapshot.sourceDigest
        )
    }

    private func dashboard(_ dashboard: DashboardState) -> some View {
        ScrollView {
            LazyVStack(alignment: .leading, spacing: 18) {
                HStack(alignment: .top, spacing: 16) {
                    VStack(alignment: .leading, spacing: 6) {
                        Text(dashboard.lifecycleStage.replacingOccurrences(of: "_", with: " ").uppercased())
                            .font(.caption.bold())
                            .foregroundStyle(.secondary)
                        Text(headline(for: dashboard))
                            .font(.largeTitle.bold())
                        Text(subheadline(for: dashboard))
                            .font(.title3)
                            .foregroundStyle(.secondary)
                    }
                    Spacer(minLength: 8)
                    VStack(alignment: .trailing, spacing: 0) {
                        HStack(spacing: 10) {
                            Button("What can I do?") {
                                selectedTab = .capabilities
                                capabilitySurface = .suggested
                                clearCapabilityFilters()
                            }
                            .buttonStyle(.bordered)
                            .help("Browse the capabilities that are useful now")
                            themeButton
                        }
                        MascotView(
                            mode: MascotMode.resolve(run: dashboard.run),
                            cue: dashboard.run?.problemTasks.map(\.id).sorted().joined(separator: ",") ?? ""
                        )
                    }
                }

                JourneyProgressView(
                    stage: JourneyStage.resolve(dashboard.lifecycleStage),
                    run: dashboard.run,
                    onAdvance: {
                        pendingStageAdvance = $0
                        showStageAdvanceConfirmation = true
                    }
                )

                let contextSnapshot = ContextSnapshotLoader.load(
                    projectRoot: statePath.deletingLastPathComponent().deletingLastPathComponent(),
                    run: dashboard.run
                )
                ContextHealthCard(
                    snapshot: contextSnapshot,
                    onContinue: { prepareContextHandoff(contextSnapshot) },
                    onRepair: { prepareHarnessRepair(contextSnapshot) }
                )

                Picker("Factory view", selection: $selectedTab) {
                    ForEach(DashboardTab.allCases) { tab in
                        Text(
                            tab == .queue && !dashboard.todos.isEmpty
                                ? "Queue · \(dashboard.todos.count)"
                                : tab.rawValue
                        )
                        .tag(tab)
                    }
                }
                .pickerStyle(.segmented)

                switch selectedTab {
                case .today:
                    todaySections(dashboard)
                case .queue:
                    queueSections(dashboard)
                case .capabilities:
                    capabilityCenter(dashboard)
                }

                if !dashboard.warnings.isEmpty {
                    statusBanner(
                        icon: "exclamationmark.triangle",
                        title: "Some status data is unavailable",
                        detail: dashboard.warnings.joined(separator: "\n"),
                        color: .orange
                    )
                }

                Divider()
                HStack {
                    Label(dashboard.run?.localeProfile ?? "Project", systemImage: "globe")
                    if let minutes = dashboard.run?.humanActiveMinutes, minutes > 0 {
                        Text("·")
                        Label("\(minutes, specifier: "%.1f") min human", systemImage: "person")
                    }
                    Spacer()
                    Text("Updated \(dashboard.capabilityState?.updatedAt ?? dashboard.run?.updatedAt ?? dashboard.android?.updatedAt ?? "—")")
                }
                .font(.caption)
                .foregroundStyle(.secondary)
            }
            .padding(24)
        }
    }

    @ViewBuilder
    private func todaySections(_ dashboard: DashboardState) -> some View {
        if let state = dashboard.run { runSections(state) }
        if let android = dashboard.android { androidPortSection(android) }
        if !dashboard.recommendations.isEmpty {
            sectionTitle("Recommended now", count: dashboard.recommendations.count, color: .blue)
            ForEach(dashboard.recommendations) { recommendation in
                recommendationCard(recommendation, catalog: dashboard.catalog)
            }
        }
        if let unlock = dashboard.unlockNext {
            sectionTitle("Unlock next", count: 1, color: .purple)
            VStack(alignment: .leading, spacing: 8) {
                HStack {
                    Text(unlock.title).font(.headline)
                    Spacer()
                    availabilityLabel(unlock.availability)
                }
                Text(unlock.reason).font(.callout).foregroundStyle(.secondary)
                if let checks = unlock.missingChecks, !checks.isEmpty {
                    Text("Missing: \(checks.joined(separator: ", "))")
                        .font(.caption2).foregroundStyle(.orange).textSelection(.enabled)
                }
                Button("Prepare task…") {
                    prepareTask(
                        title: unlock.title,
                        prompt: unlock.skillInvocation ?? unlock.claudeInvocation ?? unlock.reason
                    )
                }
                .buttonStyle(.bordered)
            }
            .padding(14)
            .background(Color.purple.opacity(0.09), in: RoundedRectangle(cornerRadius: 12))
        }
        if !dashboard.todos.isEmpty {
            sectionTitle("Queued next", count: dashboard.todos.count, color: .orange)
            ForEach(dashboard.todos.prefix(3)) { recommendation in
                todoRow(recommendation, dashboard: dashboard)
            }
            if dashboard.todos.count > 3 {
                Button("Open full queue") { selectedTab = .queue }
                    .buttonStyle(.bordered)
            }
        }
    }

    @ViewBuilder
    private func queueSections(_ dashboard: DashboardState) -> some View {
        sectionTitle("Your capability queue", count: dashboard.todos.count, color: .orange)
        Text("Queued work is prepared at a safe checkpoint. It never authorizes shell commands, provider writes, publishing, or spend.")
            .font(.callout)
            .foregroundStyle(.secondary)
        if dashboard.todos.isEmpty {
            statusBanner(
                icon: "tray",
                title: "Your queue is empty",
                detail: "Browse Capabilities and add work for the next checkpoint, milestone end, or later.",
                color: .secondary
            )
        } else {
            ForEach(["after_current_checkpoint", "after_milestone", "later"], id: \.self) { placement in
                let items = dashboard.todos.filter { ($0.queuePlacement ?? "after_milestone") == placement }
                if !items.isEmpty {
                    Text(queuePlacementLabel(placement)).font(.headline)
                    ForEach(items) { recommendation in
                        todoRow(recommendation, dashboard: dashboard)
                    }
                }
            }
        }
    }

    @ViewBuilder
    private func capabilityCenter(_ dashboard: DashboardState) -> some View {
        if let catalog = dashboard.catalog {
            capabilityFilters(catalog, dashboard: dashboard)
            if capabilitySurface == .extras {
                let extras = filteredExtras(dashboard.capabilityState?.extras ?? [])
                sectionTitle("Installed extras", count: extras.count, color: .purple)
                if extras.isEmpty {
                    statusBanner(
                        icon: "magnifyingglass",
                        title: "No installed extras match",
                        detail: "Clear the search or refresh capability discovery.",
                        color: .secondary
                    )
                    externalSkillSearchActionIfNeeded()
                } else {
                    ForEach(extras) { extra in extraRow(extra, dashboard: dashboard) }
                }
            } else {
                let filtered = filteredCapabilities(catalog.capabilities, dashboard: dashboard)
                sectionTitle(capabilitySurface.rawValue, count: filtered.count, color: .secondary)
                if filtered.isEmpty {
                    statusBanner(
                        icon: "magnifyingglass",
                        title: "No capabilities match",
                        detail: "Try another view or prepare a reviewed external-skill search below.",
                        color: .secondary
                    )
                    externalSkillSearchActionIfNeeded()
                } else {
                    ForEach(groupedCapabilities(filtered)) { group in
                        capabilityGroup(
                            group.category,
                            capabilities: group.capabilities,
                            availability: dashboard.capabilityState?.capabilityAvailability ?? [:],
                            dashboard: dashboard
                        )
                    }
                }
            }
        }
    }

    @ViewBuilder
    private func runSections(_ state: RunState) -> some View {
        if let current = state.activeTasks.first {
            statusBanner(
                icon: "hourglass",
                title: current.title,
                detail: state.activeTasks.count > 1 ? "+ \(state.activeTasks.count - 1) other task(s) running" : "Working now",
                color: .blue
            )
        }

        if !state.openActions.isEmpty {
            sectionTitle("Needs you", count: state.openActions.count, color: .orange)
            ForEach(state.openActions) { action in
                humanCard(action)
            }
        }

        if !state.problemTasks.isEmpty {
            sectionTitle("Problems", count: state.problemTasks.count, color: .red)
            ForEach(state.problemTasks) { task in
                taskRow(task, emphasized: true)
            }
        }

        if !state.queuedTasks.isEmpty {
            sectionTitle("Next", count: state.queuedTasks.count, color: .secondary)
            ForEach(state.queuedTasks.prefix(12)) { task in
                taskRow(task, emphasized: false)
            }
        }

        if !state.completedTasks.isEmpty {
            sectionTitle("Recently completed", count: state.completedTasks.count, color: .green)
            ForEach(Array(state.completedTasks.suffix(8).reversed())) { task in
                taskRow(task, emphasized: false)
            }
        }

        if !state.evidence.isEmpty {
            sectionTitle("Evidence", count: state.evidence.count, color: .secondary)
            ForEach(Array(state.evidence.suffix(6).reversed())) { item in
                evidenceRow(item)
            }
        }
    }

    @ViewBuilder
    private func androidPortSection(_ state: AndroidState) -> some View {
        VStack(alignment: .leading, spacing: 12) {
            HStack(alignment: .firstTextBaseline) {
                Label("Android Port", systemImage: "apps.iphone.badge.plus")
                    .font(.title2.bold())
                Spacer()
                Text(state.phase.replacingOccurrences(of: "_", with: " ").capitalized)
                    .font(.caption.weight(.semibold))
                    .foregroundStyle(.secondary)
            }

            ProgressView(value: Double(state.progress.percent), total: 100)
                .tint(state.problemTasks.isEmpty ? .green : .orange)
            Text("\(state.progress.percent)%  ·  \(state.progress.completed)/\(state.progress.total) Android tasks complete")
                .font(.callout.monospacedDigit())
                .foregroundStyle(.secondary)

            HStack(spacing: 8) {
                androidParityMetric("Pending", value: state.parity.pending, color: .orange)
                androidParityMetric("Verified", value: state.parity.verified, color: .green)
                androidParityMetric("Exceptions", value: state.parity.exceptions, color: .secondary)
            }

            if !state.openActions.isEmpty {
                sectionTitle("Android needs you", count: state.openActions.count, color: .orange)
                ForEach(state.openActions) { action in
                    androidHumanActionRow(action)
                }
            }

            if !state.problemTasks.isEmpty {
                sectionTitle("Android problems", count: state.problemTasks.count, color: .red)
                ForEach(state.problemTasks) { task in
                    androidTaskRow(task, emphasized: true)
                }
            }

            if let task = state.nextTask {
                Text("Next Android task")
                    .font(.headline)
                androidTaskRow(task, emphasized: false)
            }
        }
        .frame(maxWidth: .infinity, alignment: .leading)
        .padding(16)
        .background(Color.green.opacity(0.08), in: RoundedRectangle(cornerRadius: 14))
    }

    private func androidParityMetric(_ title: String, value: Int, color: Color) -> some View {
        VStack(alignment: .leading, spacing: 2) {
            Text(value, format: .number)
                .font(.headline.monospacedDigit())
                .foregroundStyle(color)
            Text(title)
                .font(.caption)
                .foregroundStyle(.secondary)
        }
        .frame(maxWidth: .infinity, alignment: .leading)
        .padding(10)
        .background(Color.secondary.opacity(0.07), in: RoundedRectangle(cornerRadius: 10))
        .accessibilityElement(children: .combine)
        .accessibilityLabel("\(title): \(value)")
    }

    private func androidHumanActionRow(_ action: AndroidHumanAction) -> some View {
        HStack(alignment: .top, spacing: 10) {
            Image(systemName: "person.crop.circle.badge.exclamationmark")
                .foregroundStyle(.orange)
                .accessibilityHidden(true)
            VStack(alignment: .leading, spacing: 3) {
                Text(action.title).font(.headline)
                Text(action.instructions)
                    .font(.caption)
                    .foregroundStyle(.secondary)
                    .textSelection(.enabled)
            }
        }
        .frame(maxWidth: .infinity, alignment: .leading)
    }

    private func androidTaskRow(_ task: AndroidTask, emphasized: Bool) -> some View {
        HStack(alignment: .top, spacing: 10) {
            Image(systemName: symbol(for: task.status))
                .foregroundStyle(color(for: task.status))
                .accessibilityHidden(true)
            VStack(alignment: .leading, spacing: 3) {
                Text(task.title)
                    .font(emphasized ? .headline : .body)
                if let detail = task.detail, !detail.isEmpty {
                    Text(detail)
                        .font(.caption)
                        .foregroundStyle(emphasized ? .red : .secondary)
                        .textSelection(.enabled)
                }
            }
            Spacer()
            Text(task.status.replacingOccurrences(of: "_", with: " "))
                .font(.caption)
                .foregroundStyle(.secondary)
        }
        .padding(.vertical, 3)
        .accessibilityElement(children: .combine)
    }

    private func fallback(title: String, message: String, symbol: String) -> some View {
        VStack(spacing: 14) {
            Image(systemName: symbol)
                .font(.system(size: 42))
                .foregroundStyle(.secondary)
            Text(title)
                .font(.title2.bold())
            Text(message)
                .multilineTextAlignment(.center)
                .foregroundStyle(.secondary)
                .textSelection(.enabled)
            Button("Copy state path") {
                copy(statePath.path)
            }
        }
        .padding(32)
    }

    private func statusBanner(icon: String, title: String, detail: String, color: Color) -> some View {
        HStack(alignment: .top, spacing: 12) {
            Image(systemName: icon)
                .foregroundStyle(color)
            VStack(alignment: .leading, spacing: 3) {
                Text(title).font(.headline)
                Text(detail).font(.caption).foregroundStyle(.secondary)
            }
        }
        .frame(maxWidth: .infinity, alignment: .leading)
        .padding(14)
        .background(color.opacity(0.10), in: RoundedRectangle(cornerRadius: 12))
    }

    private func sectionTitle(_ title: String, count: Int, color: Color) -> some View {
        HStack(spacing: 8) {
            Circle().fill(color).frame(width: 8, height: 8)
            Text("\(count) \(title)").font(.headline)
        }
    }

    private func humanCard(_ action: HumanAction) -> some View {
        VStack(alignment: .leading, spacing: 9) {
            Text(action.title).font(.headline)
            Text(action.instructions)
                .foregroundStyle(.secondary)
                .textSelection(.enabled)
            HStack {
                Button("Copy instructions") { copy(action.instructions) }
                if let rawURL = action.url, let url = safeURL(rawURL) {
                    Button("Open secure link") { NSWorkspace.shared.open(url) }
                }
            }
            .buttonStyle(.bordered)
        }
        .frame(maxWidth: .infinity, alignment: .leading)
        .padding(14)
        .background(Color.orange.opacity(0.10), in: RoundedRectangle(cornerRadius: 12))
    }

    private func recommendationCard(
        _ recommendation: CapabilityRecommendation,
        catalog: CapabilityCatalog?
    ) -> some View {
        let capability = catalog?.capabilities.first { $0.id == recommendation.capabilityId }
        return VStack(alignment: .leading, spacing: 9) {
            HStack(alignment: .firstTextBaseline) {
                Text(recommendation.title).font(.headline)
                Spacer()
                availabilityLabel(recommendation.availability)
            }
            Text(recommendation.reason)
                .foregroundStyle(.secondary)
                .textSelection(.enabled)
            if let summary = capability?.summary, !summary.isEmpty {
                Text("Expected improvement: \(summary)")
                    .font(.caption)
                    .foregroundStyle(.secondary)
            }
            metadataLabels(
                roles: recommendation.roleIds,
                risk: capability?.risk,
                lane: recommendation.executionLane,
                workflowPolicy: capability?.workflowPolicy,
                requiresApproval: recommendation.requiresApproval
            )
            Button("Prepare task…", systemImage: "arrow.forward.square") {
                prepareTask(
                    title: recommendation.title,
                    prompt: prompt(for: recommendation, capability: capability)
                )
            }
            .buttonStyle(.borderedProminent)
            .disabled(recommendation.availability == "unavailable")
            .help("Previews a credential-redacted task and lets you choose an agent. It does not run a command.")
            queueMenu(capabilityId: recommendation.capabilityId)
        }
        .frame(maxWidth: .infinity, alignment: .leading)
        .padding(14)
        .background(Color.blue.opacity(0.10), in: RoundedRectangle(cornerRadius: 12))
    }

    private func todoRow(_ recommendation: CapabilityRecommendation, dashboard: DashboardState) -> some View {
        VStack(alignment: .leading, spacing: 9) {
            HStack(alignment: .top, spacing: 10) {
                Image(systemName: "checklist")
                    .foregroundStyle(.orange)
                    .frame(width: 18)
                VStack(alignment: .leading, spacing: 4) {
                    Text(recommendation.title).font(.headline)
                    Text(recommendation.reason)
                        .font(.caption)
                        .foregroundStyle(.secondary)
                        .textSelection(.enabled)
                    Label(queuePlacementLabel(recommendation.queuePlacement ?? "after_milestone"), systemImage: "arrow.right.to.line")
                        .font(.caption2)
                        .foregroundStyle(.secondary)
                    if let blockedBy = recommendation.blockedBy, !blockedBy.isEmpty {
                        Label("Waiting on \(blockedBy.joined(separator: ", "))", systemImage: "lock")
                            .font(.caption2)
                            .foregroundStyle(.orange)
                    }
                    if let dueAt = recommendation.dueAt {
                        Label("Due \(dueAt)", systemImage: "calendar")
                            .font(.caption2)
                            .foregroundStyle(.secondary)
                    }
                }
                Spacer()
                availabilityLabel(recommendation.availability)
            }
            HStack {
                Button("Prepare task…") {
                    prepareTask(
                        title: recommendation.title,
                        prompt: prompt(for: recommendation, capability: nil)
                    )
                }
                .buttonStyle(.borderedProminent)
                .disabled(recommendation.availability != "ready")
                Menu("Move") {
                    queuePlacementButton("Next checkpoint", id: recommendation.capabilityId, placement: "after_current_checkpoint")
                    queuePlacementButton("Milestone end", id: recommendation.capabilityId, placement: "after_milestone")
                    queuePlacementButton("Later", id: recommendation.capabilityId, placement: "later")
                    Divider()
                    Button("Move up") { moveQueued(recommendation, direction: -1, dashboard: dashboard) }
                    Button("Move down") { moveQueued(recommendation, direction: 1, dashboard: dashboard) }
                }
                Button("Done") { setRecommendationStatus(recommendation.capabilityId, status: "completed") }
                Button("Remove") { setRecommendationStatus(recommendation.capabilityId, status: "dismissed") }
                    .foregroundStyle(.red)
            }
            .buttonStyle(.bordered)
        }
        .padding(12)
        .background(Color.orange.opacity(0.08), in: RoundedRectangle(cornerRadius: 12))
    }

    private func capabilityGroup(
        _ category: String,
        capabilities: [CatalogCapability],
        availability: [String: String],
        dashboard: DashboardState
    ) -> some View {
        DisclosureGroup {
            VStack(alignment: .leading, spacing: 10) {
                ForEach(capabilities) { capability in
                    capabilityRow(
                        capability,
                        availability: availability[capability.id] ?? "unknown",
                        dashboard: dashboard
                    )
                }
            }
            .padding(.top, 8)
        } label: {
            Text("\(category) · \(capabilities.count)")
                .font(.subheadline.weight(.semibold))
        }
    }

    private func capabilityRow(
        _ capability: CatalogCapability,
        availability: String,
        dashboard: DashboardState
    ) -> some View {
        let isQueued = dashboard.todos.contains(where: { $0.capabilityId == capability.id })
        return VStack(alignment: .leading, spacing: 8) {
            HStack(alignment: .firstTextBaseline) {
                Text(capability.title).font(.headline)
                if isQueued {
                    Label("Queued", systemImage: "checklist")
                        .font(.caption2)
                        .foregroundStyle(.orange)
                }
                Spacer()
                availabilityLabel(availability)
            }
            Text(capability.summary)
                .font(.callout)
                .foregroundStyle(.secondary)
                .lineLimit(2)
            Label(expectedImprovement(for: capability), systemImage: "arrow.up.right")
                .font(.caption)
                .foregroundStyle(.secondary)
            if availability != "ready" {
                Label("Needs setup before preparation", systemImage: "lock")
                    .font(.caption)
                    .foregroundStyle(.orange)
            }
            HStack(alignment: .firstTextBaseline) {
                Button("Prepare task…") {
                    prepareTask(
                        title: capability.title,
                        prompt: prompt(for: capability, availability: availability)
                    )
                }
                .buttonStyle(.borderedProminent)
                .disabled(availability != "ready")
                Button(isQueued ? "Queued ✓" : "Add to Later") {
                    enqueueCapability(capability.id, placement: "later")
                }
                .buttonStyle(.bordered)
                .disabled(isQueued)
                Button("Details") { selectedCapability = capability }
                    .buttonStyle(.bordered)
            }
        }
        .padding(10)
        .background(Color.secondary.opacity(0.07), in: RoundedRectangle(cornerRadius: 10))
    }

    private func extraRow(_ extra: ExtraCapability, dashboard: DashboardState) -> some View {
        let queued = isExtraQueued(extra, dashboard: dashboard)
        return HStack(alignment: .top, spacing: 10) {
            Image(systemName: "puzzlepiece.extension")
                .foregroundStyle(.purple)
                .frame(width: 18)
            VStack(alignment: .leading, spacing: 4) {
                Text(extra.title).font(.headline)
                Text(extra.summary).font(.caption).foregroundStyle(.secondary)
                Text(extra.source).font(.caption2).foregroundStyle(.secondary)
            }
            Spacer()
            VStack(alignment: .trailing, spacing: 6) {
                Button("Details") { selectedExtra = extra }
                    .buttonStyle(.bordered)
                Button(queued ? "Queued ✓" : "Add to Later") { enqueueExtraReview(extra) }
                    .buttonStyle(.bordered)
                    .disabled(queued)
            }
        }
        .padding(10)
        .background(Color.purple.opacity(0.07), in: RoundedRectangle(cornerRadius: 10))
    }

    private func availabilityLabel(_ availability: String) -> some View {
        Label(
            availability.replacingOccurrences(of: "_", with: " ").capitalized,
            systemImage: availability == "ready" ? "checkmark.circle" : "exclamationmark.circle"
        )
        .font(.caption2)
        .foregroundStyle(availability == "ready" ? .green : .secondary)
    }

    private func metadataLabels(
        roles: [String],
        risk: String?,
        lane: String,
        maxWorkers: Int? = nil,
        workflowPolicy: CapabilityWorkflowPolicy? = nil,
        requiresApproval: Bool
    ) -> some View {
        HStack(spacing: 10) {
            if !roles.isEmpty {
                Label(roles.map(roleLabel).joined(separator: ", "), systemImage: "person.2")
            }
            if lane == "cloud_safe" {
                Label("Subagent-safe · up to \(maxWorkers ?? 1)", systemImage: "cloud")
            } else {
                Label("Root agent", systemImage: "laptopcomputer")
            }
            if let policy = workflowPolicy {
                Label(
                    "Dynamic · \(policy.maxConcurrency) concurrent / \(policy.defaultTotalAgents) total",
                    systemImage: "point.3.connected.trianglepath.dotted"
                )
                if policy.requiresWorktreeForWrites {
                    Label("Worktree-isolated writes", systemImage: "arrow.triangle.branch")
                }
                Label(
                    "Approval above \(policy.approvalRequiredAboveTotal)",
                    systemImage: "hand.raised"
                )
            }
            if let risk {
                Label(risk.replacingOccurrences(of: "_", with: " "), systemImage: "shield")
            }
            if requiresApproval || risk == "approval_gated_external" {
                Label("Approval required", systemImage: "hand.raised")
            }
        }
        .font(.caption2)
        .foregroundStyle(.secondary)
    }

    private func taskRow(_ task: FactoryTask, emphasized: Bool) -> some View {
        HStack(alignment: .top, spacing: 10) {
            Image(systemName: symbol(for: task.status))
                .foregroundStyle(color(for: task.status))
                .frame(width: 18)
            VStack(alignment: .leading, spacing: 3) {
                HStack(spacing: 7) {
                    Text(task.title)
                        .font(emphasized ? .headline : .body)
                    if task.executionLane == "cloud_safe" {
                        Label("Cloud-safe", systemImage: "cloud")
                            .font(.caption2)
                            .foregroundStyle(.blue)
                    } else {
                        Label("Mac-local", systemImage: "laptopcomputer")
                            .font(.caption2)
                            .foregroundStyle(.secondary)
                    }
                }
                if let detail = task.error ?? task.blockedReason ?? task.waitingReason {
                    Text(detail)
                        .font(.caption)
                        .foregroundStyle(emphasized ? .red : .secondary)
                        .textSelection(.enabled)
                }
            }
            Spacer()
            Text(task.status.replacingOccurrences(of: "_", with: " "))
                .font(.caption)
                .foregroundStyle(.secondary)
        }
        .padding(.vertical, 4)
    }

    private func evidenceRow(_ item: Evidence) -> some View {
        HStack(alignment: .top, spacing: 10) {
            Image(systemName: "doc.text.magnifyingglass")
                .foregroundStyle(.secondary)
                .frame(width: 18)
            VStack(alignment: .leading, spacing: 3) {
                Text(item.label)
                Text("\(item.taskId) · \(item.kind)")
                    .font(.caption)
                    .foregroundStyle(.secondary)
            }
            Spacer()
            Button("Copy path") { copy(item.path) }
                .buttonStyle(.borderless)
            if let url = safeEvidenceURL(item.path) {
                Button("Open") { NSWorkspace.shared.open(url) }
                    .buttonStyle(.borderless)
            }
        }
        .padding(.vertical, 4)
    }

    private func headline(for dashboard: DashboardState) -> String {
        if let state = dashboard.run, !state.openActions.isEmpty { return "\(state.openActions.count) task(s) for you" }
        if let state = dashboard.run, !state.problemTasks.isEmpty { return "Attention needed" }
        if let state = dashboard.run, state.progress.total > 0, state.progress.completed == state.progress.total {
            let stage = JourneyStage.resolve(dashboard.lifecycleStage)
            if let next = stage.next { return "\(stage.title) complete — ready for \(next.title)" }
            return "\(stage.title) complete"
        }
        if !dashboard.recommendations.isEmpty { return "Your best next moves" }
        return "Factory is ready"
    }

    private func subheadline(for dashboard: DashboardState) -> String {
        if let state = dashboard.run, !state.openActions.isEmpty { return "Only you can complete these. The factory is keeping its place." }
        if let state = dashboard.run, !state.problemTasks.isEmpty { return "Review the errors below; no destructive retry will run automatically." }
        if let state = dashboard.run, state.progress.total > 0, state.progress.completed == state.progress.total {
            return "Advance only when you are ready; the journey stage never changes automatically."
        }
        if !dashboard.recommendations.isEmpty { return "Prepare a portable task without memorizing a command." }
        return "Suggestions and actions will appear here as the app moves through its lifecycle."
    }

    private func groupedCapabilities(_ capabilities: [CatalogCapability]) -> [CapabilityGroup] {
        let categoryOrder = [
            "Setup & providers", "CEO & product", "Design, onboarding & monetization",
            "Code, quality, motion & docs", "Store & release", "Android parity",
            "Growth, video, web & operations", "Phone access", "Other",
        ]
        var groups: [String: [CatalogCapability]] = [:]
        for capability in capabilities {
            groups[displayCategory(for: capability), default: []].append(capability)
        }
        let orderedCategories = categoryOrder + groups.keys.filter { !categoryOrder.contains($0) }.sorted()
        return orderedCategories.compactMap { category in
            guard let items = groups[category], !items.isEmpty else { return nil }
            return CapabilityGroup(
                category: category,
                capabilities: items.sorted {
                    if $0.rank == $1.rank { return $0.title.localizedCaseInsensitiveCompare($1.title) == .orderedAscending }
                    return $0.rank < $1.rank
                }
            )
        }
    }

    private func displayCategory(for capability: CatalogCapability) -> String {
        if capability.category != "Other" { return capability.category }
        if capability.id == "remote-access" { return "Phone access" }
        if capability.id == "port-android" { return "Android parity" }
        if capability.stages.contains("post_launch") { return "Growth, video, web & operations" }
        if capability.stages.contains("release") { return "Store & release" }
        if capability.roleIds.contains("design_director") || capability.roleIds.contains("monetization_lead") {
            return "Design, onboarding & monetization"
        }
        if capability.roleIds.contains("product_ceo") || capability.roleIds.contains("product_owner") {
            return "CEO & product"
        }
        if capability.stages.contains("setup") || capability.stages.contains("discovery") {
            return "Setup & providers"
        }
        return "Code, quality, motion & docs"
    }

    private func expectedImprovement(for capability: CatalogCapability) -> String {
        switch displayCategory(for: capability) {
        case "Setup & providers": return "fewer environment and provider blockers, with credentials kept outside project state"
        case "CEO & product": return "a sharper opportunity, smaller decision risk, and a better-defined product outcome"
        case "Design, onboarding & monetization": return "clearer native UX, stronger activation, and more trustworthy conversion"
        case "Code, quality, motion & docs": return "lower defect risk, better runtime quality, and memory that matches the code"
        case "Store & release": return "a technically valid, truthful, review-ready release package"
        case "Android parity": return "verified native Android behavior without weakening the shipped iOS product contract"
        case "Growth, video, web & operations": return "repeatable evidence-led growth work with measurable follow-up"
        case "Phone access": return "safe project continuity away from the Mac without exposing a custom public tunnel"
        default: return "a safer next checkpoint with explicit evidence and acceptance criteria"
        }
    }

    @ViewBuilder
    private func capabilityFilters(_ catalog: CapabilityCatalog, dashboard: DashboardState) -> some View {
        VStack(alignment: .leading, spacing: 10) {
            Picker("Capability view", selection: $capabilitySurface) {
                ForEach(CapabilitySurface.allCases) { surface in
                    Text(surface.rawValue).tag(surface)
                }
            }
            .pickerStyle(.segmented)
            TextField("Search capabilities", text: $capabilitySearch)
                .textFieldStyle(.roundedBorder)
            if capabilitySurface != .extras {
                DisclosureGroup("More filters") {
                    VStack(spacing: 8) {
                        HStack {
                            filterPicker("Stage", selection: $stageFilter, values: ["All", "setup", "discovery", "planning", "build", "release", "post_launch"])
                            filterPicker("Role", selection: $roleFilter, values: ["All"] + Array(Set(catalog.capabilities.flatMap(\.roleIds))).sorted())
                            filterPicker("Platform", selection: $platformFilter, values: ["All", "ios", "android", "local", "web"])
                        }
                        HStack {
                            filterPicker("Risk", selection: $riskFilter, values: ["All", "read_only", "local_write", "approval_gated_external"])
                            filterPicker("Availability", selection: $availabilityFilter, values: ["All", "ready", "setup_required", "unavailable", "not_applicable"])
                            Spacer()
                        }
                    }
                    .padding(.top, 8)
                }
            }
            HStack {
                Text(
                    capabilitySurface == .extras
                        ? "Discovered local skills, plugins, and MCPs."
                        : "Start with Suggested, or search in plain language. If the kit has no match, it can prepare a reviewed external-skill search."
                )
                    .font(.caption)
                    .foregroundStyle(.secondary)
                Spacer()
                Button("Clear filters", action: clearCapabilityFilters)
                    .buttonStyle(.borderless)
            }
        }
        .padding(12)
        .background(Color.secondary.opacity(0.07), in: RoundedRectangle(cornerRadius: 12))
    }

    private func filterPicker(_ title: String, selection: Binding<String>, values: [String]) -> some View {
        Picker(title, selection: selection) {
            ForEach(values, id: \.self) { value in
                Text(value.replacingOccurrences(of: "_", with: " ").capitalized).tag(value)
            }
        }
        .labelsHidden()
        .frame(maxWidth: 190)
    }

    private func filteredCapabilities(
        _ capabilities: [CatalogCapability],
        dashboard: DashboardState
    ) -> [CatalogCapability] {
        let suggestedIds = Set(
            dashboard.recommendations.map(\.capabilityId)
                + dashboard.todos.map(\.capabilityId)
                + [dashboard.unlockNext?.capabilityId].compactMap { $0 }
        )
        return capabilities.filter { capability in
            let availability = dashboard.capabilityState?.capabilityAvailability?[capability.id] ?? "unknown"
            let haystack = "\(capability.title) \(capability.summary) \(capability.whenUseful ?? "") \(capability.id)".lowercased()
            let matchesSurface: Bool
            switch capabilitySurface {
            case .suggested: matchesSurface = suggestedIds.contains(capability.id)
            case .ready: matchesSurface = availability == "ready"
            case .needsSetup: matchesSurface = !["ready", "not_applicable"].contains(availability)
            case .extras: matchesSurface = false
            case .all: matchesSurface = true
            }
            return matchesSurface
                && (capabilitySearch.isEmpty || haystack.contains(capabilitySearch.lowercased()))
                && (stageFilter == "All" || capability.stages.contains(stageFilter))
                && (roleFilter == "All" || capability.roleIds.contains(roleFilter))
                && (platformFilter == "All" || capability.platforms.contains(platformFilter))
                && (riskFilter == "All" || capability.risk == riskFilter)
                && (availabilityFilter == "All" || availability == availabilityFilter)
        }
    }

    private func filteredExtras(_ extras: [ExtraCapability]) -> [ExtraCapability] {
        extras.filter { extra in
            capabilitySearch.isEmpty
                || "\(extra.title) \(extra.summary) \(extra.source)".localizedCaseInsensitiveContains(capabilitySearch)
        }
    }

    private func clearCapabilityFilters() {
        capabilitySearch = ""
        stageFilter = "All"
        roleFilter = "All"
        platformFilter = "All"
        riskFilter = "All"
        availabilityFilter = "All"
    }

    @ViewBuilder
    private func externalSkillSearchActionIfNeeded() -> some View {
        let query = capabilitySearch.trimmingCharacters(in: .whitespacesAndNewlines)
        if !query.isEmpty {
            Button("Prepare external skill search…") {
                prepareExternalSkillSearch(query: query)
            }
            .buttonStyle(.borderedProminent)
            .help("Prepare a reviewed search task for the selected agent; Factory Status will not access the network")
        }
    }

    private func prepareExternalSkillSearch(query: String) {
        let safeQuery = AgentHandoffService.redact(
            query.replacingOccurrences(of: "\n", with: " ")
        ).prefix(180)
        let prompt = """
        Find a trusted Agent Skill for this goal: \(safeQuery)

        Work in \(projectRoot.path). First run the local app-factory context router. If it has a high-confidence capability, use that and stop. Otherwise read docs/playbooks/skill-discovery.md and use the installed find-skills skill to perform a credential-free search.

        Return at most three candidates. Verify each candidate's source, purpose, install/reputation signals, license, maintenance, SKILL.md, referenced scripts, requested tools, and shell/network/credential/external-write scope. Do not install anything until I approve the exact skill, source, destination, and target agent. Prefer project-local installation and never execute a newly installed skill automatically.
        """
        preparedTask = PreparedTask(
            title: "Find a skill for \(safeQuery)",
            prompt: prompt,
            projectKey: projectRoot.path
        )
    }

    private func queuePlacementLabel(_ placement: String) -> String {
        switch placement {
        case "after_current_checkpoint": return "Next safe checkpoint"
        case "later": return "Later"
        default: return "End of current milestone"
        }
    }

    private func queueMenu(capabilityId: String) -> some View {
        Menu("Add to queue") {
            queuePlacementButton("Next checkpoint", id: capabilityId, placement: "after_current_checkpoint")
            queuePlacementButton("Milestone end", id: capabilityId, placement: "after_milestone")
            queuePlacementButton("Later", id: capabilityId, placement: "later")
        }
        .buttonStyle(.bordered)
    }

    private func queuePlacementButton(_ title: String, id: String, placement: String) -> some View {
        Button(title) { enqueueCapability(id, placement: placement) }
    }

    private func enqueueCapability(_ capabilityId: String, placement: String) {
        guard case .loaded(let dashboard) = result,
              let capability = dashboard.catalog?.capabilities.first(where: { $0.id == capabilityId }) else {
            showMutationError("Capability is no longer available in the catalog.")
            return
        }
        let availability = dashboard.capabilityState?.capabilityAvailability?[capability.id] ?? "unknown"
        mutateCapabilityState(message: "Added \(capability.title) to \(queuePlacementLabel(placement).lowercased()).") { state in
            var recommendations = state["recommendations"] as? [[String: Any]] ?? []
            let now = Self.timestamp()
            let stage = state["lifecycleStage"] as? String ?? "setup"
            let completed = Set(recommendations.compactMap { item -> String? in
                item["status"] as? String == "completed" ? item["capabilityId"] as? String : nil
            })
            let blockedBy = capabilityPrerequisites(capability).filter { !completed.contains($0) }
            let nextOrder = recommendations.compactMap { item -> Int? in
                guard item["status"] as? String == "todo",
                      item["queuePlacement"] as? String == placement else { return nil }
                return item["queueOrder"] as? Int
            }.max().map { $0 + 1 } ?? 0
            if let index = recommendations.firstIndex(where: {
                ($0["capabilityId"] as? String) == capability.id
                    && ["suggested", "todo"].contains($0["status"] as? String ?? "")
            }) {
                recommendations[index]["status"] = "todo"
                recommendations[index]["priority"] = placement == "after_current_checkpoint" ? "now" : placement == "later" ? "later" : "next"
                recommendations[index]["queuePlacement"] = placement
                recommendations[index]["queueOrder"] = nextOrder
                recommendations[index]["queuedAt"] = recommendations[index]["queuedAt"] ?? now
                recommendations[index]["updatedAt"] = now
            } else {
                var entry: [String: Any] = [
                    "id": "\(capability.id):\(stage)",
                    "capabilityId": capability.id,
                    "title": capability.title,
                    "reason": blockedBy.isEmpty
                        ? "Queued by you for \(queuePlacementLabel(placement).lowercased())."
                        : "Complete prerequisites first: \(blockedBy.joined(separator: ", ")).",
                    "priority": placement == "after_current_checkpoint" ? "now" : placement == "later" ? "later" : "next",
                    "status": "todo",
                    "availability": blockedBy.isEmpty ? availability : "setup_required",
                    "invocation": capability.claudeInvocation,
                    "claudeInvocation": capability.claudeInvocation,
                    "skillInvocation": capability.skillInvocation,
                    "roleIds": capability.roleIds,
                    "executionLane": capability.delegation.mode,
                    "maxWorkers": capability.delegation.maxWorkers,
                    "requiresApproval": capability.risk == "approval_gated_external",
                    "queuePlacement": placement,
                    "queueOrder": nextOrder,
                    "queuedAt": now,
                    "createdAt": now,
                    "updatedAt": now,
                ]
                if !blockedBy.isEmpty { entry["blockedBy"] = blockedBy }
                recommendations.append(entry)
            }
            state["recommendations"] = recommendations
        }
    }

    private func capabilityPrerequisites(_ capability: CatalogCapability) -> [String] {
        guard let catalog = try? Data(contentsOf: projectRoot.appendingPathComponent("docs/capabilities.json")),
              let object = try? JSONSerialization.jsonObject(with: catalog) as? [String: Any],
              let capabilities = object["capabilities"] as? [[String: Any]],
              let raw = capabilities.first(where: { $0["id"] as? String == capability.id }) else { return [] }
        return raw["prerequisites"] as? [String] ?? []
    }

    private func setRecommendationStatus(_ capabilityId: String, status: String) {
        mutateCapabilityState(message: status == "completed" ? "Marked complete." : "Removed from the active queue.") { state in
            var recommendations = state["recommendations"] as? [[String: Any]] ?? []
            guard let index = recommendations.firstIndex(where: { $0["capabilityId"] as? String == capabilityId }) else {
                throw CapabilityStateWriteError.invalid("Queued capability was not found.")
            }
            recommendations[index]["status"] = status
            recommendations[index]["updatedAt"] = Self.timestamp()
            for key in ["queuePlacement", "queueOrder", "queuedAt"] { recommendations[index].removeValue(forKey: key) }
            state["recommendations"] = recommendations
        }
    }

    private func moveQueued(_ recommendation: CapabilityRecommendation, direction: Int, dashboard: DashboardState) {
        let placement = recommendation.queuePlacement ?? "after_milestone"
        let peers = dashboard.todos.filter { ($0.queuePlacement ?? "after_milestone") == placement }
        guard let index = peers.firstIndex(where: { $0.id == recommendation.id }) else { return }
        let target = index + direction
        guard peers.indices.contains(target) else { return }
        let orderedIds = peers.map(\.capabilityId)
        var reordered = orderedIds
        reordered.swapAt(index, target)
        mutateCapabilityState(message: "Queue order updated.") { state in
            var recommendations = state["recommendations"] as? [[String: Any]] ?? []
            for (order, capabilityId) in reordered.enumerated() {
                if let itemIndex = recommendations.firstIndex(where: {
                    $0["status"] as? String == "todo" && $0["capabilityId"] as? String == capabilityId
                }) {
                    recommendations[itemIndex]["queuePlacement"] = placement
                    recommendations[itemIndex]["queueOrder"] = order
                    recommendations[itemIndex]["updatedAt"] = Self.timestamp()
                }
            }
            state["recommendations"] = recommendations
        }
    }

    private func enqueueExtraReview(_ extra: ExtraCapability) {
        let placement = "later"
        mutateCapabilityState(message: "Added \(extra.title) as a review TODO.") { state in
            var recommendations = state["recommendations"] as? [[String: Any]] ?? []
            let now = Self.timestamp()
            let identifier = "extra-review.\(Self.safeIdentifier(extra.id))"
            if recommendations.contains(where: { $0["id"] as? String == identifier && $0["status"] as? String == "todo" }) {
                throw CapabilityStateWriteError.invalid("This extra is already queued for review.")
            }
            let nextOrder = recommendations.compactMap { item -> Int? in
                guard item["status"] as? String == "todo", item["queuePlacement"] as? String == placement else { return nil }
                return item["queueOrder"] as? Int
            }.max().map { $0 + 1 } ?? 0
            recommendations.append([
                "id": identifier,
                "capabilityId": identifier,
                "title": Self.safeStateText(extra.title),
                "reason": "Review this discovered capability before trusting or running it.",
                "priority": "later",
                "status": "todo",
                "availability": "setup_required",
                "invocation": Self.safeStateText(extra.invocation ?? "Review this installed capability before use."),
                "claudeInvocation": "Review this discovered capability before use.",
                "skillInvocation": Self.safeStateText(extra.invocation ?? "Review this installed capability before use."),
                "roleIds": ["tech_lead"],
                "executionLane": "local",
                "maxWorkers": 0,
                "requiresApproval": false,
                "queuePlacement": placement,
                "queueOrder": nextOrder,
                "queuedAt": now,
                "createdAt": now,
                "updatedAt": now,
            ])
            state["recommendations"] = recommendations
        }
    }

    private var projectRoot: URL {
        statePath.deletingLastPathComponent().deletingLastPathComponent().standardizedFileURL
    }

    private func currentAvailability(for capabilityId: String) -> String {
        guard case .loaded(let dashboard) = result else { return "unknown" }
        return dashboard.capabilityState?.capabilityAvailability?[capabilityId] ?? "unknown"
    }

    private func isExtraQueued(_ extra: ExtraCapability, dashboard: DashboardState? = nil) -> Bool {
        let currentDashboard: DashboardState?
        if let dashboard {
            currentDashboard = dashboard
        } else if case .loaded(let loaded) = result {
            currentDashboard = loaded
        } else {
            currentDashboard = nil
        }
        let identifier = "extra-review.\(Self.safeIdentifier(extra.id))"
        return currentDashboard?.todos.contains(where: { $0.capabilityId == identifier }) == true
    }

    private func prepareExtraReview(_ extra: ExtraCapability, afterSheetDismiss: Bool = false) {
        let invocation = extra.invocation ?? "No trusted invocation is available; inspect local metadata first."
        let title = "Review \(extra.title)"
        let prompt = """
        Review this discovered capability before using it.

        Capability: \(extra.title)
        Source: \(extra.source)
        Invocation: \(invocation)

        Do not execute external writes without explicit approval. Never request or expose credentials.
        """
        if afterSheetDismiss {
            prepareTaskAfterSheetDismiss(title: title, prompt: prompt)
        } else {
            prepareTask(title: title, prompt: prompt)
        }
    }

    private func advanceLifecycleStage(to stage: JourneyStage) {
        pendingStageAdvance = nil
        mutateCapabilityState(message: "Moved the local journey to \(stage.title).") { state in
            state["lifecycleStage"] = stage.rawValue
        }
    }

    private func mutateCapabilityState(
        message: String,
        mutation: @escaping (inout [String: Any]) throws -> Void
    ) {
        do {
            undoSnapshot = try CapabilityStateWriter.mutate(projectRoot: projectRoot, mutation: mutation)
            undoWasMissing = false
            toastMessage = message
            Task { result = await readDashboard() }
        } catch {
            showMutationError(error.localizedDescription)
        }
    }

    private func undoCapabilityMutation() {
        guard let undoSnapshot else { return }
        do {
            try CapabilityStateWriter.restore(projectRoot: projectRoot, snapshot: undoSnapshot)
            self.undoSnapshot = nil
            toastMessage = "Last queue change was undone."
            Task { result = await readDashboard() }
        } catch {
            showMutationError(error.localizedDescription)
        }
    }

    private func showMutationError(_ message: String) {
        undoSnapshot = nil
        toastMessage = "Could not update the local queue: \(message)"
    }

    private static func timestamp() -> String {
        ISO8601DateFormatter().string(from: Date())
    }

    private static func safeIdentifier(_ value: String) -> String {
        let allowed = CharacterSet(charactersIn: "abcdefghijklmnopqrstuvwxyz0123456789._-")
        let normalized = value.lowercased().unicodeScalars.map { allowed.contains($0) ? Character(String($0)) : "-" }
        return String(normalized).prefix(80).description
    }

    private static func safeStateText(_ value: String) -> String {
        AgentHandoffService.redact(value)
    }

    private func roleLabel(_ role: String) -> String {
        role.replacingOccurrences(of: "_", with: " ").capitalized
    }

    private func prompt(
        for recommendation: CapabilityRecommendation,
        capability: CatalogCapability?
    ) -> String {
        let approval = recommendation.requiresApproval || capability?.risk == "approval_gated_external"
            ? "Preview any external write and ask for explicit approval before executing it."
            : "Stay within the capability's declared risk boundary."
        let claudeInvocation = recommendation.claudeInvocation ?? recommendation.invocation
        let skillInvocation = recommendation.skillInvocation ?? "Use the matching portable Agent Skill or continue from this natural-language task."
        let prerequisiteInstruction: String
        if let blockedBy = recommendation.blockedBy, !blockedBy.isEmpty {
            prerequisiteInstruction = "Do not run the target yet. Prepare and complete these prerequisites first: \(blockedBy.joined(separator: ", "))."
        } else {
            prerequisiteInstruction = "Prerequisites are ready."
        }
        return """
        Continue this app-factory project using the recommended capability below.

        Capability: \(recommendation.title)
        Why now: \(recommendation.reason)
        Roles: \(recommendation.roleIds.map(roleLabel).joined(separator: ", "))
        Execution lane: \(recommendation.executionLane)
        Portable invocation: \(skillInvocation)
        Claude invocation (alternate): \(claudeInvocation)

        \(prerequisiteInstruction)
        \(approval)
        After every acceptance criterion passes, run: python3 scripts/factoryctl.py recommend done \(recommendation.capabilityId)
        Then refresh recommendations. Do not mark the capability complete on partial or failed work.
        Never request, copy, or include credentials in chat, prompts, status, or logs.
        """
    }

    private func prompt(for capability: CatalogCapability, availability: String) -> String {
        return """
        Continue this app-factory project with the following capability.

        Capability: \(capability.title)
        Goal: \(capability.summary)
        Roles: \(capability.roleIds.map(roleLabel).joined(separator: ", "))
        Availability: \(availability)
        Portable invocation: \(capability.skillInvocation)
        Claude invocation (alternate): \(capability.claudeInvocation)

        Respect the \(capability.risk) risk boundary. Preview external writes and request explicit approval when required. Never include credentials in prompts, status, or logs.
        After every acceptance criterion passes, run: python3 scripts/factoryctl.py recommend done \(capability.id), then refresh recommendations.
        """
    }

    private func symbol(for status: String) -> String {
        switch status {
        case "failed": return "xmark.circle.fill"
        case "blocked": return "hand.raised.fill"
        case "waiting_human": return "person.crop.circle.badge.exclamationmark"
        case "running", "in_progress": return "hourglass"
        case "succeeded": return "checkmark.circle.fill"
        case "skipped": return "forward.circle"
        default: return "circle"
        }
    }

    private func color(for status: String) -> Color {
        switch status {
        case "failed": return .red
        case "blocked", "waiting_human": return .orange
        case "running", "in_progress": return .blue
        case "succeeded": return .green
        default: return .secondary
        }
    }

    private func safeURL(_ string: String) -> URL? {
        guard let url = URL(string: string), url.scheme?.lowercased() == "https", url.host != nil else { return nil }
        return url
    }

    private func safeEvidenceURL(_ path: String) -> URL? {
        let projectRoot = statePath.deletingLastPathComponent().deletingLastPathComponent().standardizedFileURL
        let candidate = path.hasPrefix("/")
            ? URL(fileURLWithPath: path).standardizedFileURL
            : projectRoot.appendingPathComponent(path).standardizedFileURL
        guard candidate.path == projectRoot.path || candidate.path.hasPrefix(projectRoot.path + "/") else { return nil }
        guard FileManager.default.fileExists(atPath: candidate.path) else { return nil }
        return candidate
    }

    private func copy(_ string: String) {
        NSPasteboard.general.clearContents()
        NSPasteboard.general.setString(string, forType: .string)
    }

    private func prepareTask(title: String, prompt: String) {
        preparedTask = PreparedTask(title: title, prompt: AgentHandoffService.redact(prompt))
    }

    private func prepareTaskAfterSheetDismiss(title: String, prompt: String) {
        Task { @MainActor in
            try? await Task.sleep(for: .milliseconds(180))
            prepareTask(title: title, prompt: prompt)
        }
    }

    private func readDashboard() async -> LoadResult {
        let runPath = statePath
        let projectRoot = runPath.deletingLastPathComponent().deletingLastPathComponent().standardizedFileURL
        let capabilityStatePath = projectRoot.appendingPathComponent(".factory/capability-state.json")
        let androidStatePath = projectRoot.appendingPathComponent(".factory/android-state.json")
        let catalogPath = projectRoot.appendingPathComponent("docs/capabilities.json")
        return await Task.detached(priority: .utility) {
            var run: RunState?
            var android: AndroidState?
            var capabilityState: CapabilityState?
            var catalog: CapabilityCatalog?
            var warnings: [String] = []

            if FileManager.default.fileExists(atPath: runPath.path) {
                do {
                    let data = try Data(contentsOf: runPath, options: .mappedIfSafe)
                    let decoded = try JSONDecoder().decode(RunState.self, from: data)
                    guard decoded.schemaVersion == 2 else {
                        warnings.append("Run state uses unsupported schema \(decoded.schemaVersion).")
                        throw DashboardLoadError.rejected
                    }
                    guard decoded.tasks.allSatisfy({ allowedTaskStatuses.contains($0.status) }) else {
                        warnings.append("Run state contains an unknown task status.")
                        throw DashboardLoadError.rejected
                    }
                    run = decoded
                } catch DashboardLoadError.rejected {
                    // The actionable validation warning is already recorded above.
                } catch {
                    warnings.append("Run state is malformed; run status is hidden.")
                }
            }

            if FileManager.default.fileExists(atPath: androidStatePath.path) {
                do {
                    let data = try Data(contentsOf: androidStatePath, options: .mappedIfSafe)
                    let decoded = try JSONDecoder().decode(AndroidState.self, from: data)
                    guard decoded.schemaVersion == 1 else {
                        warnings.append("Android state uses unsupported schema \(decoded.schemaVersion).")
                        throw DashboardLoadError.rejected
                    }
                    guard decoded.tasks.allSatisfy({ allowedTaskStatuses.contains($0.status) }) else {
                        warnings.append("Android state contains an unknown task status.")
                        throw DashboardLoadError.rejected
                    }
                    android = decoded
                } catch DashboardLoadError.rejected {
                    // The actionable validation warning is already recorded above.
                } catch {
                    warnings.append("Android state is malformed; Android Port status is hidden.")
                }
            }

            if FileManager.default.fileExists(atPath: capabilityStatePath.path) {
                do {
                    let data = try Data(contentsOf: capabilityStatePath, options: .mappedIfSafe)
                    let decoded = try JSONDecoder().decode(CapabilityState.self, from: data)
                    guard decoded.schemaVersion == 1 || decoded.schemaVersion == 2 else {
                        warnings.append("Capability state uses unsupported schema \(decoded.schemaVersion).")
                        throw DashboardLoadError.rejected
                    }
                    capabilityState = decoded
                } catch DashboardLoadError.rejected {
                    // The actionable validation warning is already recorded above.
                } catch {
                    warnings.append("Capability state is malformed; suggestions are hidden.")
                }
            }

            if FileManager.default.fileExists(atPath: catalogPath.path) {
                do {
                    let data = try Data(contentsOf: catalogPath, options: .mappedIfSafe)
                    let decoded = try JSONDecoder().decode(CapabilityCatalog.self, from: data)
                    // Keep in sync with CAPABILITY_CATALOG_SCHEMA_VERSION in
                    // scripts/factoryctl.py (parity-tested from tests/test_factory_status.py).
                    guard (1...3).contains(decoded.schemaVersion) else {
                        warnings.append("Capability catalog uses unsupported schema \(decoded.schemaVersion).")
                        throw DashboardLoadError.rejected
                    }
                    catalog = decoded
                } catch DashboardLoadError.rejected {
                    // The actionable validation warning is already recorded above.
                } catch {
                    warnings.append("Capability catalog is malformed; the catalog is hidden.")
                }
            }

            let dashboard = DashboardState(
                run: run,
                android: android,
                capabilityState: capabilityState,
                catalog: catalog,
                warnings: warnings
            )
            guard dashboard.hasContent else {
                let detail = warnings.isEmpty
                    ? "Run /factory-next to create suggestions, or start a factory run."
                    : warnings.joined(separator: " ")
                return .waiting(detail)
            }
            return .loaded(dashboard)
        }.value
    }
}

extension Notification.Name {
    static let factoryStatusRefresh = Notification.Name("app-factory.status.refresh")
    static let factoryStatusOpenTask = Notification.Name("app-factory.status.open-task")
    static let factoryStatusShowCapabilities = Notification.Name("app-factory.status.show-capabilities")
}

struct RecentProject: Decodable, Identifiable {
    let id: String
    let name: String
    let path: String
    let lastOpenedAt: String

    var rootURL: URL { URL(fileURLWithPath: path).standardizedFileURL }
    var stateURL: URL { rootURL.appendingPathComponent(".factory/run-state.json") }
}

struct RecentProjectRegistry: Decodable {
    let schemaVersion: Int
    let projects: [RecentProject]
}

struct MenuSnapshot {
    let humanActions: Int
    let recommendations: [CapabilityRecommendation]
    let unlock: UnlockCapability?

    static func load(statePath: URL) -> MenuSnapshot {
        let root = statePath.deletingLastPathComponent().deletingLastPathComponent().standardizedFileURL
        let decoder = JSONDecoder()
        var humanActions = 0
        var recommendations: [CapabilityRecommendation] = []
        var unlock: UnlockCapability?
        if let data = try? Data(contentsOf: root.appendingPathComponent(".factory/run-state.json")),
           let state = try? decoder.decode(RunState.self, from: data) {
            humanActions = state.openActions.count
        }
        if let data = try? Data(contentsOf: root.appendingPathComponent(".factory/capability-state.json")),
           let state = try? decoder.decode(CapabilityState.self, from: data) {
            recommendations = Array(state.recommendations.filter { $0.status == "suggested" }.prefix(3))
            unlock = state.unlockNext?.first
        }
        return MenuSnapshot(humanActions: humanActions, recommendations: recommendations, unlock: unlock)
    }
}
