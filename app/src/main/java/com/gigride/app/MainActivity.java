package com.gigride.app;

import android.app.Activity;
import android.content.ActivityNotFoundException;
import android.content.Intent;
import android.net.Uri;
import android.os.Bundle;
import android.webkit.JavascriptInterface;
import android.webkit.WebSettings;
import android.webkit.WebView;
import android.webkit.WebViewClient;

public final class MainActivity extends Activity {
    private WebView webView;

    @Override
    protected void onCreate(Bundle savedInstanceState) {
        super.onCreate(savedInstanceState);
        webView = new WebView(this);
        WebSettings settings = webView.getSettings();
        settings.setJavaScriptEnabled(true);
        settings.setDomStorageEnabled(true);
        settings.setAllowFileAccess(true);
        settings.setAllowContentAccess(false);
        webView.addJavascriptInterface(new CfoBridge(), "CfoBridge");
        webView.setWebViewClient(new WebViewClient());
        webView.loadUrl("file:///android_asset/www/index.html");
        setContentView(webView);
    }

    public final class CfoBridge {
        @JavascriptInterface
        public boolean sendTransaction(String payload) {
            if (payload == null || payload.length() == 0 || payload.length() > 16384) return false;
            Uri uri = new Uri.Builder()
                    .scheme("cfoengine")
                    .authority("gigride-transaction")
                    .appendQueryParameter("payload", payload)
                    .build();
            Intent intent = new Intent(Intent.ACTION_VIEW, uri);
            intent.setPackage("com.cfoengine.app");
            intent.addFlags(Intent.FLAG_ACTIVITY_NEW_TASK);
            try {
                startActivity(intent);
                return true;
            } catch (ActivityNotFoundException ex) {
                return false;
            }
        }
    }

    @Override
    public void onBackPressed() {
        if (webView != null && webView.canGoBack()) webView.goBack();
        else super.onBackPressed();
    }
}
