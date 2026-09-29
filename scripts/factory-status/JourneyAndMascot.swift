import AppKit
import Foundation
import SwiftUI

enum JourneyStage: String, CaseIterable, Identifiable {
    case setup
    case discovery
    case planning
    case build
    case release
    case postLaunch = "post_launch"

    var id: String { rawValue }

    var title: String {
        switch self {
        case .setup: return "Setup"
        case .discovery: return "Discovery"
        case .planning: return "Plan"
        case .build: return "Build"
        case .release: return "Release"
        case .postLaunch: return "Growth"
        }
    }

    var next: JourneyStage? {
        guard let index = Self.allCases.firstIndex(of: self), index + 1 < Self.allCases.count else { return nil }
        return Self.allCases[index + 1]
    }

    static func resolve(_ rawValue: String) -> JourneyStage { JourneyStage(rawValue: rawValue) ?? .setup }
}

enum MascotMode: String {
    case walking
    case running
    case waiting
    case recovering
    case celebrating

    static func resolve(run: RunState?) -> MascotMode {
        guard let run else { return .walking }
        if !run.problemTasks.isEmpty { return .recovering }
        if run.progress.total > 0 && run.progress.completed == run.progress.total { return .celebrating }
        if !run.openActions.isEmpty { return .waiting }
        if !run.activeTasks.isEmpty { return .running }
        return .walking
    }
}

struct JourneyProgressView: View {
    let stage: JourneyStage
    let run: RunState?
    let onAdvance: (JourneyStage) -> Void

    private var stageIndex: Int { JourneyStage.allCases.firstIndex(of: stage) ?? 0 }
    private var runIsComplete: Bool {
        guard let run else { return false }
        return run.progress.total > 0 && run.progress.completed == run.progress.total
    }

    var body: some View {
        VStack(alignment: .leading, spacing: 12) {
            HStack(spacing: 6) {
                ForEach(Array(JourneyStage.allCases.enumerated()), id: \.element.id) { index, item in
                    VStack(spacing: 5) {
                        HStack(spacing: 4) {
                            Image(systemName: symbol(for: index))
                            Text(item.title)
                                .lineLimit(1)
                        }
                        .font(.caption.bold())
                        .foregroundStyle(foregroundStyle(for: index))
                        Capsule()
                            .fill(segmentStyle(for: index))
                            .frame(height: 4)
                    }
                    .frame(maxWidth: .infinity)
                    .accessibilityElement(children: .combine)
                    .accessibilityLabel(accessibilityLabel(for: index, stage: item))
                }
            }

            if let run, run.progress.total > 0 {
                VStack(alignment: .leading, spacing: 6) {
                    HStack {
                        Text(runIsComplete ? "\(stage.title) complete" : "\(stage.title) in progress")
                            .font(.headline)
                        Spacer()
                        Text("\(run.progress.completed)/\(run.progress.total)")
                            .font(.callout.monospacedDigit())
                            .foregroundStyle(.secondary)
                    }
                    ProgressView(value: Double(run.progress.percent), total: 100)
                        .tint(run.problemTasks.isEmpty ? .blue : .orange)
                        .accessibilityLabel("Current run progress")
                        .accessibilityValue("\(run.progress.percent) percent")
                    HStack {
                        Text(activeSummary(run))
                            .font(.callout)
                            .foregroundStyle(.secondary)
                        Spacer()
                        if runIsComplete, let next = stage.next {
                            Button("Move to \(next.title)") { onAdvance(next) }
                                .buttonStyle(.bordered)
                        }
                    }
                }
            } else {
                Text("Step \(stageIndex + 1) of \(JourneyStage.allCases.count) · \(stage.title)")
                    .font(.callout)
                    .foregroundStyle(.secondary)
            }
        }
        .padding(14)
        .background(Color.secondary.opacity(0.07), in: RoundedRectangle(cornerRadius: 14))
    }

    private func symbol(for index: Int) -> String {
        if index < stageIndex { return "checkmark.circle.fill" }
        if index == stageIndex && runIsComplete { return "checkmark.circle.fill" }
        if index == stageIndex { return "circle.inset.filled" }
        return "circle"
    }

    private func foregroundStyle(for index: Int) -> Color {
        if index < stageIndex || (index == stageIndex && runIsComplete) { return .green }
        return index == stageIndex ? .blue : .secondary
    }

    private func segmentStyle(for index: Int) -> Color {
        if index < stageIndex || (index == stageIndex && runIsComplete) { return .green }
        return index == stageIndex ? .blue : Color.secondary.opacity(0.2)
    }

    private func accessibilityLabel(for index: Int, stage item: JourneyStage) -> String {
        if index < stageIndex || (index == stageIndex && runIsComplete) { return "\(item.title), complete" }
        if index == stageIndex { return "\(item.title), current step" }
        return "\(item.title), upcoming"
    }

    private func activeSummary(_ run: RunState) -> String {
        if runIsComplete, let next = stage.next { return "Ready for \(next.title). The stage will not advance automatically." }
        if let current = run.activeTasks.first { return current.title }
        if !run.openActions.isEmpty { return "Waiting for \(run.openActions.count) human action(s)." }
        if !run.problemTasks.isEmpty { return "A problem needs review before progress continues." }
        return "The factory is keeping its place."
    }
}

struct MascotView: View {
    let mode: MascotMode
    let cue: String

    @Environment(\.accessibilityReduceMotion) private var reduceMotion
    @State private var frameName = "idle"

    var body: some View {
        Group {
            if let image = mascotImage(named: frameName) {
                Image(nsImage: image)
                    .resizable()
                    .interpolation(.high)
                    .scaledToFit()
            } else {
                Image(systemName: "cpu")
                    .resizable()
                    .scaledToFit()
                    .foregroundStyle(.teal)
                    .padding(24)
            }
        }
        .frame(width: 124, height: 104)
        .animation(reduceMotion ? nil : .easeInOut(duration: 0.16), value: frameName)
        .accessibilityHidden(true)
        .task(id: "\(mode.rawValue)-\(cue)-\(reduceMotion)") {
            if reduceMotion {
                frameName = staticFrame(for: mode)
                return
            }
            await animate(mode)
        }
    }

    private func mascotImage(named name: String) -> NSImage? {
        guard let resourceURL = Bundle.main.resourceURL?
            .appendingPathComponent("Robot")
            .appendingPathComponent("\(name).png") else { return nil }
        return NSImage(contentsOf: resourceURL)
    }

    private func staticFrame(for mode: MascotMode) -> String {
        switch mode {
        case .walking: return "idle"
        case .running: return "run-a"
        case .waiting: return "waiting"
        case .recovering: return "getting-up"
        case .celebrating: return "celebrate"
        }
    }

    private func animate(_ mode: MascotMode) async {
        switch mode {
        case .walking:
            await ambientWalk()
        case .running:
            await loop(frames: ["run-a", "run-b"], milliseconds: 420)
        case .waiting:
            await loop(frames: ["waiting", "waiting", "idle"], milliseconds: 2_400)
        case .recovering:
            await playOnce(frames: ["trip", "fallen", "getting-up", "waiting"], milliseconds: 650)
        case .celebrating:
            await playOnce(frames: ["shoot-windup", "shoot", "celebrate", "idle"], milliseconds: 700)
        }
    }

    private func loop(frames: [String], milliseconds: Int) async {
        while !Task.isCancelled {
            for frame in frames {
                guard !Task.isCancelled else { return }
                frameName = frame
                try? await Task.sleep(for: .milliseconds(milliseconds))
            }
        }
    }

    private func ambientWalk() async {
        while !Task.isCancelled {
            frameName = "idle"
            try? await Task.sleep(for: .seconds(6))
            for frame in ["walk-a", "walk-b", "walk-a", "idle"] {
                guard !Task.isCancelled else { return }
                frameName = frame
                try? await Task.sleep(for: .milliseconds(700))
            }
        }
    }

    private func playOnce(frames: [String], milliseconds: Int) async {
        for frame in frames {
            guard !Task.isCancelled else { return }
            frameName = frame
            try? await Task.sleep(for: .milliseconds(milliseconds))
        }
    }
}
