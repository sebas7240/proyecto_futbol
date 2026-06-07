package com.goleafutbol.app;

import android.os.Bundle;
import android.view.KeyEvent;
import android.webkit.WebView;

import androidx.activity.OnBackPressedCallback;

import com.getcapacitor.BridgeActivity;

public class MainActivity extends BridgeActivity {
    @Override
    public void onCreate(Bundle savedInstanceState) {
        super.onCreate(savedInstanceState);

        WebView webView = bridge != null ? bridge.getWebView() : null;
        if (webView != null) {
            webView.setFocusable(true);
            webView.setFocusableInTouchMode(true);
            webView.requestFocus();
        }

        getOnBackPressedDispatcher().addCallback(this, new OnBackPressedCallback(true) {
            @Override
            public void handleOnBackPressed() {
                WebView webView = bridge != null ? bridge.getWebView() : null;

                if (webView != null && webView.canGoBack()) {
                    webView.goBack();
                    return;
                }

                moveTaskToBack(true);
            }
        });
    }

    @Override
    public boolean dispatchKeyEvent(KeyEvent event) {
        if (event.getAction() != KeyEvent.ACTION_DOWN) {
            return super.dispatchKeyEvent(event);
        }

        switch (event.getKeyCode()) {
            case KeyEvent.KEYCODE_DPAD_UP:
                runTvRemoteScript("ArrowUp");
                return true;
            case KeyEvent.KEYCODE_DPAD_DOWN:
                runTvRemoteScript("ArrowDown");
                return true;
            case KeyEvent.KEYCODE_DPAD_LEFT:
                runTvRemoteScript("ArrowLeft");
                return true;
            case KeyEvent.KEYCODE_DPAD_RIGHT:
                runTvRemoteScript("ArrowRight");
                return true;
            case KeyEvent.KEYCODE_DPAD_CENTER:
            case KeyEvent.KEYCODE_ENTER:
            case KeyEvent.KEYCODE_NUMPAD_ENTER:
            case KeyEvent.KEYCODE_BUTTON_A:
                runTvRemoteScript("Enter");
                return true;
            case KeyEvent.KEYCODE_MEDIA_PLAY_PAUSE:
            case KeyEvent.KEYCODE_MEDIA_PLAY:
            case KeyEvent.KEYCODE_MEDIA_PAUSE:
                runTvRemoteScript("MediaPlayPause");
                return true;
            default:
                return super.dispatchKeyEvent(event);
        }
    }

    private void runTvRemoteScript(String key) {
        WebView webView = bridge != null ? bridge.getWebView() : null;
        if (webView == null) return;

        webView.evaluateJavascript(
            "window.__goleaTvNavigate && window.__goleaTvNavigate('" + key + "');",
            null
        );
    }
}
