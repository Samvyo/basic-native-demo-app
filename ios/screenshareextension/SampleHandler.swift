import ReplayKit
import CoreVideo

class SampleHandler: RPBroadcastSampleHandler {
    var outputStream: OutputStream?
    let appGroupID = "group.com.samvyo.screenshare"
    let streamFileName = "screen.raw"
    
    override func broadcastStarted(withSetupInfo setupInfo: [String : NSObject]?) {
        // Create shared file path in App Group container
        let sharedContainer = FileManager.default.containerURL(forSecurityApplicationGroupIdentifier: appGroupID)
        let streamPath = sharedContainer?.appendingPathComponent(streamFileName)
        
        // Clean up any existing file
        try? FileManager.default.removeItem(at: streamPath!)
        
        // Create stream
        outputStream = OutputStream(url: streamPath!, append: false)
        outputStream?.schedule(in: .current, forMode: .default)
        outputStream?.open()
    }

    override func broadcastFinished() {
        outputStream?.close()
    }

    override func processSampleBuffer(_ sampleBuffer: CMSampleBuffer, with sampleBufferType: RPSampleBufferType) {
        guard sampleBufferType == .video,
              let imageBuffer = CMSampleBufferGetImageBuffer(sampleBuffer) else { return }

        CVPixelBufferLockBaseAddress(imageBuffer, .readOnly)
        
        let width = CVPixelBufferGetWidth(imageBuffer)
        let height = CVPixelBufferGetHeight(imageBuffer)
        let baseAddress = CVPixelBufferGetBaseAddress(imageBuffer)
        let bytesPerRow = CVPixelBufferGetBytesPerRow(imageBuffer)

        let data = Data(bytes: baseAddress!, count: height * bytesPerRow)

        var metadata = withUnsafeBytes(of: UInt32(width)) { Data($0) }
        metadata.append(withUnsafeBytes(of: UInt32(height)) { Data($0) })

        let frameWithHeader = metadata + data
        _ = frameWithHeader.withUnsafeBytes { outputStream?.write($0.bindMemory(to: UInt8.self).baseAddress!, maxLength: frameWithHeader.count) }

        CVPixelBufferUnlockBaseAddress(imageBuffer, .readOnly)
    }
}

