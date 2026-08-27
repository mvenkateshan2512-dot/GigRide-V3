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
        handleCfoResult(getIntent());
    }

    @Override
    protected void onNewIntent(Intent intent) {
        super.onNewIntent(intent);
        setIntent(intent);
        handleCfoResult(intent);
    }

    private void handleCfoResult(Intent intent) {
        if (intent == null || intent.getData() == null) return;
        Uri uri = intent.getData();
        if (!"gigride".equals(uri.getScheme()) || !"cfo-result".equals(uri.getAuthority())) return;
        final String transactionId = uri.getQueryParameter("transactionId");
        final String status = uri.getQueryParameter("status");
        if (transactionId == null || transactionId.length() == 0 || transactionId.length() > 256) return;
        if (!("accepted".equals(status) || "rejected".equals(status) || "needs_review".equals(status))) return;
        if (webView == null) return;
        final String js = "window.handleCfoResult&&window.handleCfoResult(" + quoteJs(transactionId) + "," + quoteJs(status) + ")";
        webView.post(() -> webView.evaluateJavascript(js, null));
    }

    private static String quoteJs(String value) {
        return "\"" + value.replace("\\", "\\\\").replace("\"", "\\\"").replace("\n", "\\n").replace("\r", "\\r") + "\"";
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
