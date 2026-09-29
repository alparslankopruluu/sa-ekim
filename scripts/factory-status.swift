import AppKit
import Foundation
import SwiftUI

final class FactoryStatusAppDelegate: NSObject, NSApplicationDelegate {
    func applicationShouldHandleReopen(
        _ sender: NSApplication,
        hasVisibleWindows flag: Bool
    ) -> Bool {
        if let window = sender.windows.first(where: { $0.title == "Factory Status" }) {
            sender.activate(ignoringOtherApps: true)
            window.makeKeyAndOrderFront(nil)
            return false
        }
        return true
    }
}

@main
struct FactoryStatusApp: App {
    @NSApplicationDelegateAdaptor(FactoryStatusAppDelegate.self) private var appDelegate
    @State private var statePath: URL
    @State private var projects: [RecentProject]

    init() {
        let loadedProjects = Self.loadProjects()
        _projects = State(initialValue: loadedProjects)
        _statePath = State(initialValue: Self.initialStatePath(projects: loadedProjects))
    }

    var body: some Scene {
        WindowGroup("Factory Status") {
            StatusView(statePath: statePath)
        }
        .defaultSize(width: 780, height: 800)
        .windowStyle(.hiddenTitleBar)
        .handlesExternalEvents(matching: ["status"])

        MenuBarExtra {
            Text(activeProject?.name ?? "Factory Status").font(.headline)
            if menuSnapshot.humanActions > 0 {
                Label(
                    "\(menuSnapshot.humanActions) human action(s)",
                    systemImage: "person.crop.circle.badge.exclamationmark"
                )
            }
            if !menuSnapshot.recommendations.isEmpty {
                Section("Recommended now") {
                    ForEach(menuSnapshot.recommendations) { recommendation in
                        Button(recommendation.title) {
                            openTask(
                                title: recommendation.title,
                                prompt: recommendation.skillInvocation ?? recommendation.invocation
                            )
                        }
                    }
                }
            }
            if let unlock = menuSnapshot.unlock {
                Section("Unlock next") {
                    Button(unlock.title) {
                        openTask(
                            title: unlock.title,
                            prompt: unlock.skillInvocation ?? unlock.claudeInvocation ?? unlock.reason
                        )
                    }
                }
            }
            if projects.count > 1 {
                Menu("Projects") {
                    ForEach(projects) { project in
                        Button(project.name) {
                            statePath = project.stateURL
                            NotificationCenter.default.post(name: .factoryStatusRefresh, object: nil)
                            openStatusWindow()
                        }
                    }
                }
            }
            Divider()
            Button("What can I do?") {
                openStatusWindow()
                NotificationCenter.default.post(name: .factoryStatusShowCapabilities, object: nil)
            }
            Button("Open Status", action: openStatusWindow)
            Button("Refresh") {
                NotificationCenter.default.post(name: .factoryStatusRefresh, object: nil)
            }
            Button("Copy Project Path", action: copyProjectPath)
            Divider()
            Button("Quit") { NSApp.terminate(nil) }
        } label: {
            Label(
                menuSnapshot.humanActions > 0 ? "Factory \(menuSnapshot.humanActions)" : "Factory",
                systemImage: menuSnapshot.humanActions > 0 ? "cpu.fill" : "cpu"
            )
        }
    }

    private static func initialStatePath(projects: [RecentProject]) -> URL {
        let arguments = CommandLine.arguments
        if let index = arguments.firstIndex(of: "--state"), arguments.indices.contains(index + 1) {
            return URL(fileURLWithPath: arguments[index + 1]).standardizedFileURL
        }
        if let project = projects.first { return project.stateURL }
        return URL(fileURLWithPath: FileManager.default.currentDirectoryPath)
            .appendingPathComponent(".factory/run-state.json")
    }

    private static func registryPath() -> URL {
        let arguments = CommandLine.arguments
        if let index = arguments.firstIndex(of: "--registry"), arguments.indices.contains(index + 1) {
            return URL(fileURLWithPath: arguments[index + 1]).standardizedFileURL
        }
        return FileManager.default.homeDirectoryForCurrentUser
            .appendingPathComponent(".config/app-factory/projects.json")
    }

    private static func loadProjects() -> [RecentProject] {
        guard let data = try? Data(contentsOf: registryPath()),
              let registry = try? JSONDecoder().decode(RecentProjectRegistry.self, from: data),
              registry.schemaVersion == 1 else { return [] }
        return registry.projects.filter {
            $0.rootURL.path.hasPrefix("/")
                && FileManager.default.fileExists(
                    atPath: $0.rootURL.appendingPathComponent("docs/capabilities.json").path
                )
        }
    }

    private var activeProject: RecentProject? {
        projects.first { $0.stateURL == statePath }
    }

    private var menuSnapshot: MenuSnapshot { MenuSnapshot.load(statePath: statePath) }

    private func openTask(title: String, prompt: String) {
        openStatusWindow()
        NotificationCenter.default.post(
            name: .factoryStatusOpenTask,
            object: nil,
            userInfo: ["title": title, "prompt": prompt]
        )
    }

    private func copyProjectPath() {
        let root = statePath.deletingLastPathComponent().deletingLastPathComponent().path
        NSPasteboard.general.clearContents()
        NSPasteboard.general.setString(root, forType: .string)
    }

    private func openStatusWindow() {
        NSApp.activate(ignoringOtherApps: true)
        if let window = NSApp.windows.first(where: { $0.title == "Factory Status" }) {
            window.makeKeyAndOrderFront(nil)
        }
    }
}
