import Darwin
import Foundation

enum DashboardLoadError: Error {
    case rejected
}

enum CapabilityStateWriteError: LocalizedError {
    case invalid(String)
    case system(String)

    var errorDescription: String? {
        switch self {
        case .invalid(let message), .system(let message): return message
        }
    }
}

enum CapabilityStateWriter {
    static func mutate(
        projectRoot: URL,
        mutation: (inout [String: Any]) throws -> Void
    ) throws -> Data {
        try withLock(projectRoot: projectRoot) {
            let stateURL = projectRoot.appendingPathComponent(".factory/capability-state.json")
            let prior = try snapshotOrEmpty(stateURL: stateURL)
            guard var state = try JSONSerialization.jsonObject(with: prior) as? [String: Any] else {
                throw CapabilityStateWriteError.invalid("Capability state root must be an object.")
            }
            try mutation(&state)
            state["updatedAt"] = ISO8601DateFormatter().string(from: Date())
            try validate(state, projectRoot: projectRoot)
            let encoded = try encodedState(state)
            try writeAtomic(encoded, to: stateURL)
            return prior
        }
    }

    static func restore(projectRoot: URL, snapshot: Data) throws {
        try withLock(projectRoot: projectRoot) {
            guard let state = try JSONSerialization.jsonObject(with: snapshot) as? [String: Any] else {
                throw CapabilityStateWriteError.invalid("Undo snapshot is invalid.")
            }
            try validate(state, projectRoot: projectRoot)
            try writeAtomic(
                try encodedState(state),
                to: projectRoot.appendingPathComponent(".factory/capability-state.json")
            )
        }
    }

    private static func snapshotOrEmpty(stateURL: URL) throws -> Data {
        if FileManager.default.fileExists(atPath: stateURL.path) {
            return try Data(contentsOf: stateURL, options: .mappedIfSafe)
        }
        let now = ISO8601DateFormatter().string(from: Date())
        return try encodedState([
            "schemaVersion": 2,
            "lifecycleStage": "setup",
            "recommendations": [],
            "unlockNext": [],
            "extras": [],
            "capabilityAvailability": [:],
            "lastRefreshAt": NSNull(),
            "updatedAt": now,
        ])
    }

    private static func validate(_ state: [String: Any], projectRoot: URL) throws {
        guard state["schemaVersion"] as? Int == 2 else {
            throw CapabilityStateWriteError.invalid("Only capability-state schema 2 can be updated.")
        }
        let stages = Set(["setup", "discovery", "planning", "build", "release", "post_launch"])
        guard let stage = state["lifecycleStage"] as? String, stages.contains(stage) else {
            throw CapabilityStateWriteError.invalid("Capability state has an invalid lifecycle stage.")
        }
        guard let recommendations = state["recommendations"] as? [[String: Any]] else {
            throw CapabilityStateWriteError.invalid("Capability recommendations must be an array.")
        }
        let statuses = Set(["suggested", "todo", "dismissed", "completed"])
        let placements = Set(["after_current_checkpoint", "after_milestone", "later"])
        let catalogIds = try catalogCapabilityIds(projectRoot: projectRoot)
        var todoCount = 0
        for recommendation in recommendations {
            guard let status = recommendation["status"] as? String, statuses.contains(status) else {
                throw CapabilityStateWriteError.invalid("A recommendation contains an invalid status.")
            }
            if status == "todo" {
                todoCount += 1
                let identifier = recommendation["id"] as? String ?? ""
                let capabilityId = recommendation["capabilityId"] as? String ?? ""
                let trusted = catalogIds.contains(capabilityId)
                    || identifier.hasPrefix("extra-review.")
                    || identifier.hasPrefix("factory-blocker.")
                guard trusted else {
                    throw CapabilityStateWriteError.invalid(
                        "Only catalog capabilities or explicit extra reviews may be queued."
                    )
                }
                if let placement = recommendation["queuePlacement"] as? String,
                   !placements.contains(placement) {
                    throw CapabilityStateWriteError.invalid(
                        "A queued recommendation has an invalid placement."
                    )
                }
            }
        }
        guard todoCount <= 10 else {
            throw CapabilityStateWriteError.invalid("The active queue is limited to ten TODOs.")
        }
    }

    private static func catalogCapabilityIds(projectRoot: URL) throws -> Set<String> {
        let url = projectRoot.appendingPathComponent("docs/capabilities.json")
        let data = try Data(contentsOf: url, options: .mappedIfSafe)
        guard let root = try JSONSerialization.jsonObject(with: data) as? [String: Any],
              let capabilities = root["capabilities"] as? [[String: Any]] else {
            throw CapabilityStateWriteError.invalid("Capability catalog is unavailable or malformed.")
        }
        return Set(capabilities.compactMap { $0["id"] as? String })
    }

    private static func encodedState(_ state: [String: Any]) throws -> Data {
        guard JSONSerialization.isValidJSONObject(state) else {
            throw CapabilityStateWriteError.invalid("Capability state contains an unsupported value.")
        }
        var data = try JSONSerialization.data(
            withJSONObject: state,
            options: [.prettyPrinted, .sortedKeys]
        )
        data.append(0x0A)
        return data
    }

    private static func withLock<T>(projectRoot: URL, body: () throws -> T) throws -> T {
        let directory = projectRoot.appendingPathComponent(".factory", isDirectory: true)
        try FileManager.default.createDirectory(at: directory, withIntermediateDirectories: true)
        let lockURL = directory.appendingPathComponent("capability-state.lock")
        let descriptor = Darwin.open(lockURL.path, O_RDWR | O_CREAT, S_IRUSR | S_IWUSR)
        guard descriptor >= 0 else { throw systemError("Could not open the capability-state lock.") }
        defer { Darwin.close(descriptor) }
        guard Darwin.fchmod(descriptor, S_IRUSR | S_IWUSR) == 0 else {
            throw systemError("Could not protect the capability-state lock.")
        }
        guard Darwin.lockf(descriptor, F_LOCK, 0) == 0 else {
            throw systemError("Could not lock capability state.")
        }
        defer { Darwin.lockf(descriptor, F_ULOCK, 0) }
        return try body()
    }

    private static func writeAtomic(_ data: Data, to destination: URL) throws {
        let directory = destination.deletingLastPathComponent()
        try FileManager.default.createDirectory(at: directory, withIntermediateDirectories: true)
        let temporary = directory.appendingPathComponent(
            ".\(destination.lastPathComponent).\(UUID().uuidString).tmp"
        )
        let descriptor = Darwin.open(
            temporary.path,
            O_WRONLY | O_CREAT | O_EXCL,
            S_IRUSR | S_IWUSR
        )
        guard descriptor >= 0 else {
            throw systemError("Could not create a temporary capability-state file.")
        }
        var writeSucceeded = false
        defer {
            Darwin.close(descriptor)
            if !writeSucceeded { Darwin.unlink(temporary.path) }
        }
        let complete = data.withUnsafeBytes { bytes -> Bool in
            guard let base = bytes.baseAddress else { return data.isEmpty }
            var offset = 0
            while offset < bytes.count {
                let count = Darwin.write(descriptor, base.advanced(by: offset), bytes.count - offset)
                if count <= 0 { return false }
                offset += count
            }
            return true
        }
        guard complete,
              Darwin.fsync(descriptor) == 0,
              Darwin.fchmod(descriptor, S_IRUSR | S_IWUSR) == 0 else {
            throw systemError("Could not persist capability state safely.")
        }
        guard Darwin.rename(temporary.path, destination.path) == 0 else {
            throw systemError("Could not atomically replace capability state.")
        }
        writeSucceeded = true
        let directoryDescriptor = Darwin.open(directory.path, O_RDONLY)
        if directoryDescriptor >= 0 {
            _ = Darwin.fsync(directoryDescriptor)
            Darwin.close(directoryDescriptor)
        }
    }

    private static func systemError(_ message: String) -> CapabilityStateWriteError {
        .system("\(message) \(String(cString: strerror(errno)))")
    }
}
