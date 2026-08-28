package org.campuscommute.app;

import android.os.Bundle;
import android.webkit.WebSettings;
import android.webkit.WebView;
import com.getcapacitor.BridgeActivity;

public class MainActivity extends BridgeActivity {
    @Override
    protected void onCreate(Bundle savedInstanceState) {
        registerPlugin(CommuteWidgetsPlugin.class);
        super.onCreate(savedInstanceState);

        // Campus Commute uses responsive app-native layouts. Allowing WebView page zoom can leave
        // the visual viewport horizontally offset even when the document itself has no overflow.
        // Leaflet continues to handle gestures inside its own map containers.
        WebView webView = getBridge().getWebView();
        WebSettings settings = webView.getSettings();
        settings.setSupportZoom(false);
        settings.setBuiltInZoomControls(false);
        settings.setDisplayZoomControls(false);
        webView.setHorizontalScrollBarEnabled(false);
    }
}
