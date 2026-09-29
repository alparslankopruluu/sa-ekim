import SwiftUI

enum CapabilitySurface: String, CaseIterable, Identifiable {
    case suggested = "Suggested"
    case ready = "Ready"
    case needsSetup = "Needs setup"
    case extras = "Installed extras"
    case all = "All"

    var id: String { rawValue }
}

struct CapabilityDetailSheet: View {
    let capability: CatalogCapability
    let availability: String
    let expectedImprovement: String
    let onPrepare: () -> Void
    let onAddLater: () -> Void

    @Environment(\.dismiss) private var dismiss

    var body: some View {
        VStack(alignment: .leading, spacing: 16) {
            HStack(alignment: .top) {
                VStack(alignment: .leading, spacing: 4) {
                    Text(capability.title).font(.title2.bold())
                    Text(capability.summary).foregroundStyle(.secondary)
                }
                Spacer()
                readinessLabel
            }

            LabeledContent("Expected improvement", value: expectedImprovement)
            if let whenUseful = capability.whenUseful {
                LabeledContent("When useful", value: whenUseful)
            }
            LabeledContent("Stages", value: capability.stages.joined(separator: ", "))
            LabeledContent("Platforms", value: capability.platforms.joined(separator: ", ").uppercased())
            LabeledContent("Risk", value: capability.risk.replacingOccurrences(of: "_", with: " "))
            LabeledContent("Roles", value: capability.roleIds.map(displayLabel).joined(separator: ", "))
            if !capability.prerequisites.isEmpty {
                LabeledContent("Prerequisites", value: capability.prerequisites.joined(separator: ", "))
            }
            if availability != "ready" {
                LabeledContent("Availability checks", value: capability.availabilityChecks.joined(separator: ", "))
                    .foregroundStyle(.orange)
            }

            DisclosureGroup("Technical invocation") {
                VStack(alignment: .leading, spacing: 6) {
                    Text("Portable: \(capability.skillInvocation)")
                    Text("Claude: \(capability.claudeInvocation)")
                }
                .font(.callout.monospaced())
                .textSelection(.enabled)
                .padding(.top, 6)
            }

            Spacer()
            HStack {
                Button("Close", role: .cancel) { dismiss() }
                Spacer()
                Button("Add to Later", action: onAddLater)
                    .buttonStyle(.bordered)
                Button("Prepare task…") {
                    dismiss()
                    onPrepare()
                }
                .buttonStyle(.borderedProminent)
                .disabled(availability != "ready")
            }
        }
        .padding(24)
        .frame(minWidth: 600, minHeight: 480)
    }

    private var readinessLabel: some View {
        Label(
            availability.replacingOccurrences(of: "_", with: " ").capitalized,
            systemImage: availability == "ready" ? "checkmark.circle" : "exclamationmark.circle"
        )
        .foregroundStyle(availability == "ready" ? .green : .secondary)
    }

    private func displayLabel(_ value: String) -> String {
        value.replacingOccurrences(of: "_", with: " ").capitalized
    }
}

struct ExtraCapabilityDetailSheet: View {
    let extra: ExtraCapability
    let isQueued: Bool
    let onPrepare: () -> Void
    let onAddLater: () -> Void

    @Environment(\.dismiss) private var dismiss

    var body: some View {
        VStack(alignment: .leading, spacing: 16) {
            Label(extra.title, systemImage: "puzzlepiece.extension")
                .font(.title2.bold())
                .foregroundStyle(.purple)
            Text(extra.summary).foregroundStyle(.secondary)
            LabeledContent("Source", value: extra.source)
            if let invocation = extra.invocation {
                LabeledContent("Invocation", value: invocation)
                    .textSelection(.enabled)
            }
            Label(
                "Installed extras are reviewed before trust. Preparing a task never authorizes external writes.",
                systemImage: "lock.shield"
            )
            .font(.callout)
            .foregroundStyle(.secondary)
            Spacer()
            HStack {
                Button("Close", role: .cancel) { dismiss() }
                Spacer()
                Button(isQueued ? "Queued ✓" : "Add to Later") {
                    onAddLater()
                    dismiss()
                }
                .buttonStyle(.bordered)
                .disabled(isQueued)
                Button("Prepare review task…") {
                    dismiss()
                    onPrepare()
                }
                .buttonStyle(.borderedProminent)
            }
        }
        .padding(24)
        .frame(minWidth: 560, minHeight: 360)
    }
}
