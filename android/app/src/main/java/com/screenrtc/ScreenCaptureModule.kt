package com.screenrtc

import android.app.Activity
import android.content.Context
import android.content.Intent
import android.media.projection.MediaProjectionManager
import android.os.Build
import android.util.Log
import androidx.annotation.Nullable
import com.facebook.react.bridge.*
import com.facebook.react.modules.core.DeviceEventManagerModule

class ScreenCaptureModule(private val reactContext: ReactApplicationContext) :
    ReactContextBaseJavaModule(reactContext) {

    companion object {
        private const val TAG = "ScreenCaptureModule"
        private const val SCREEN_CAPTURE_REQUEST_CODE = 1234
    }

    private var screenCapturePromise: Promise? = null
    private var screenCaptureIntent: Intent? = null
    private var screenCaptureResultCode: Int = 0
    private var foregroundServiceIntent: Intent? = null

    private val activityEventListener = object : BaseActivityEventListener() {
        override fun onActivityResult(
            activity: Activity,
            requestCode: Int,
            resultCode: Int,
            data: Intent?
        ) {
            if (requestCode == SCREEN_CAPTURE_REQUEST_CODE) {
                if (resultCode == Activity.RESULT_OK && data != null) {
                    screenCaptureIntent = data
                    screenCaptureResultCode = resultCode

                    startForegroundService()

                    val streamId = "android_screen_" + System.currentTimeMillis()

                    ScreenCapturerStore.setData(streamId, resultCode, data)

                    sendEvent("onScreenCaptureReady", streamId)

                    screenCapturePromise?.resolve(streamId)
                    screenCapturePromise = null
                } else {
                    screenCapturePromise?.reject("USER_CANCELED", "User canceled screen capture")
                    screenCapturePromise = null
                }
            }
        }
    }

    init {
        reactContext.addActivityEventListener(activityEventListener)
    }

    override fun getName(): String = "ScreenCaptureModule"

    @ReactMethod
    fun startScreenCapture(promise: Promise) {
        val currentActivity = currentActivity
        if (currentActivity == null) {
            promise.reject("ACTIVITY_NOT_FOUND", "Activity not found")
            return
        }

        if (Build.VERSION.SDK_INT < Build.VERSION_CODES.LOLLIPOP) {
            promise.reject("UNSUPPORTED_VERSION", "Screen capture requires Android 5.0+")
            return
        }

        val mediaProjectionManager =
            currentActivity.getSystemService(Context.MEDIA_PROJECTION_SERVICE) as? MediaProjectionManager

        if (mediaProjectionManager == null) {
            promise.reject("PROJECTION_SERVICE_NOT_FOUND", "Media projection service not available")
            return
        }

        screenCapturePromise = promise
        val captureIntent = mediaProjectionManager.createScreenCaptureIntent()
        currentActivity.startActivityForResult(captureIntent, SCREEN_CAPTURE_REQUEST_CODE)
    }

    @ReactMethod
    fun stopScreenCapture(streamId: String, promise: Promise) {
        val currentActivity = currentActivity
        if (currentActivity != null && foregroundServiceIntent != null) {
            currentActivity.stopService(foregroundServiceIntent)
            foregroundServiceIntent = null
        }

        ScreenCapturerStore.removeData(streamId)

        screenCaptureIntent = null
        screenCaptureResultCode = 0

        sendEvent("onScreenCaptureStopped", streamId)

        promise.resolve(null)
    }

    private fun startForegroundService() {
        val currentActivity = currentActivity
        if (currentActivity != null) {
            foregroundServiceIntent = Intent(currentActivity, ScreenCaptureService::class.java)

            if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.O) {
                currentActivity.startForegroundService(foregroundServiceIntent)
            } else {
                currentActivity.startService(foregroundServiceIntent)
            }
        }
    }

    private fun sendEvent(eventName: String, @Nullable data: String?) {
        reactContext
            .getJSModule(DeviceEventManagerModule.RCTDeviceEventEmitter::class.java)
            .emit(eventName, data)
    }

    @ReactMethod
    fun addListener(eventName: String) {
        // Required for React Native Event Emitter
    }

    @ReactMethod
    fun removeListeners(count: Int) {
        // Required for React Native Event Emitter
    }
}
