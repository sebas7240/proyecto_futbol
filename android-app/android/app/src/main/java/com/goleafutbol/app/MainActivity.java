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
            default:
                return super.dispatchKeyEvent(event);
        }
    }

    private void runTvRemoteScript(String key) {
        WebView webView = bridge != null ? bridge.getWebView() : null;
        if (webView == null) return;

        webView.evaluateJavascript(
            "(function(key){" +
                "var selector='[data-tv-focus=\"true\"],button:not([disabled]),a[href],input:not([disabled])';" +
                "function visible(el){var r=el.getBoundingClientRect();var s=getComputedStyle(el);return r.width>0&&r.height>0&&s.visibility!=='hidden'&&s.display!=='none';}" +
                "function textInput(el){if(!el)return false;var t=(el.tagName||'').toLowerCase();return t==='input'||t==='textarea'||el.isContentEditable;}" +
                "function els(){return Array.prototype.slice.call(document.querySelectorAll(selector)).filter(visible);}" +
                "function fallback(list){return list.find(function(el){return el.dataset&&el.dataset.tvPrimary==='true';})||list[0]||null;}" +
                "function center(rect){return {x:rect.left+rect.width/2,y:rect.top+rect.height/2};}" +
                "function score(item,vertical){return (vertical?Math.abs(item.dy):Math.abs(item.dx))*3+(vertical?Math.abs(item.dx):Math.abs(item.dy));}" +
                "var list=els();if(!list.length)return false;" +
                "var active=document.activeElement instanceof HTMLElement?document.activeElement:null;" +
                "if(key==='Enter'){if(active&&list.indexOf(active)>=0&&!textInput(active)){active.click();return true;}var first=fallback(list);if(first){first.focus({preventScroll:true});first.scrollIntoView({block:'nearest',inline:'nearest'});}return true;}" +
                "if(active&&textInput(active)){active.blur();active=null;}" +
                "if(!active||list.indexOf(active)<0){var start=fallback(list);if(start){start.focus({preventScroll:true});start.scrollIntoView({block:'nearest',inline:'nearest'});}return true;}" +
                "var current=center(active.getBoundingClientRect());" +
                "var vertical=key==='ArrowUp'||key==='ArrowDown';" +
                "var options=list.filter(function(el){return el!==active;}).map(function(el){var c=center(el.getBoundingClientRect());return {el:el,dx:c.x-current.x,dy:c.y-current.y};}).filter(function(item){if(key==='ArrowDown')return item.dy>8;if(key==='ArrowUp')return item.dy<-8;if(key==='ArrowRight')return item.dx>8;if(key==='ArrowLeft')return item.dx<-8;return false;}).sort(function(a,b){return score(a,vertical)-score(b,vertical);});" +
                "var next=options.length?options[0].el:null;" +
                "if(!next){var i=list.indexOf(active);next=(key==='ArrowDown'||key==='ArrowRight')?list[(i+1)%list.length]:list[(i-1+list.length)%list.length];}" +
                "next.focus({preventScroll:true});next.scrollIntoView({block:'nearest',inline:'nearest',behavior:'smooth'});return true;" +
            "})('" + key + "');",
            null
        );
    }
}
