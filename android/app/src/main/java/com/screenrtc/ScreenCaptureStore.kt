package com.screenrtc

import android.content.Intent
import android.util.Log

object ScreenCapturerStore {

    private const val TAG = "ScreenCapturerStore"
    private val store: MutableMap<String, ScreenCaptureData> = HashMap()

    fun setData(id: String, resultCode: Int, data: Intent) {
        store[id] = ScreenCaptureData(resultCode, data)
        Log.d(TAG, "Stored screen capture data for ID: $id")
    }

    fun getData(id: String): ScreenCaptureData? = store[id]

    fun removeData(id: String) {
        store.remove(id)
        Log.d(TAG, "Removed screen capture data for ID: $id")
    }

    data class ScreenCaptureData(val resultCode: Int, val data: Intent)
}
