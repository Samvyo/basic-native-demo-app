package com.screenrtc

import android.util.Log
import com.facebook.react.bridge.ReadableMap
import com.facebook.react.bridge.ReadableMapKeySetIterator
import org.webrtc.MediaConstraints
import org.webrtc.ScreenCapturerAndroid
import org.webrtc.VideoCapturer

object WebRTCModuleExtension {

    private const val TAG = "WebRTCModuleExtension"

    fun createScreenCapturer(streamId: String): VideoCapturer? {
        val data = ScreenCapturerStore.getData(streamId)
        if (data == null) {
            Log.e(TAG, "No screen capture data found for ID: $streamId")
            return null
        }

        return try {
            ScreenCapturerAndroid(data.data, null)
        } catch (e: Exception) {
            Log.e(TAG, "Error creating screen capturer: ${e.message}")
            null
        }
    }

    fun parseMediaConstraints(constraints: ReadableMap?): MediaConstraints {
        val mediaConstraints = MediaConstraints()

        if (constraints == null) return mediaConstraints

        val iterator: ReadableMapKeySetIterator = constraints.keySetIterator()
        while (iterator.hasNextKey()) {
            val key = iterator.nextKey()
            val value = constraints.getString(key)
            if (value != null) {
                mediaConstraints.mandatory.add(MediaConstraints.KeyValuePair(key, value))
            }
        }

        return mediaConstraints
    }
}
