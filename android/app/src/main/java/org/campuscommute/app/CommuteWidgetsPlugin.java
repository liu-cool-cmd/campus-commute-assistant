package org.campuscommute.app;

import android.content.Intent;
import android.net.Uri;
import android.os.Build;
import android.os.PowerManager;
import android.provider.Settings;
import com.getcapacitor.JSObject;
import com.getcapacitor.Plugin;
import com.getcapacitor.PluginCall;
import com.getcapacitor.PluginMethod;
import com.getcapacitor.annotation.CapacitorPlugin;

@CapacitorPlugin(name = "CommuteWidgets")
public class CommuteWidgetsPlugin extends Plugin {

    @PluginMethod
    public void refresh(PluginCall call) {
        CommuteWidgetProvider.refreshAll(getContext());
        call.resolve();
    }

    @PluginMethod
    public void getBatteryOptimizationStatus(PluginCall call) {
        JSObject result = new JSObject();
        boolean supported = Build.VERSION.SDK_INT >= Build.VERSION_CODES.M;
        boolean exempt = true;
        if (supported) {
            PowerManager manager = (PowerManager) getContext().getSystemService(PowerManager.class);
            exempt = manager != null && manager.isIgnoringBatteryOptimizations(getContext().getPackageName());
        }
        result.put("supported", supported);
        result.put("exempt", exempt);
        call.resolve(result);
    }

    @PluginMethod
    public void openBatteryOptimizationSettings(PluginCall call) {
        Intent intent = new Intent(Settings.ACTION_IGNORE_BATTERY_OPTIMIZATION_SETTINGS);
        intent.addFlags(Intent.FLAG_ACTIVITY_NEW_TASK);
        if (intent.resolveActivity(getContext().getPackageManager()) == null) {
            intent = new Intent(
                Settings.ACTION_APPLICATION_DETAILS_SETTINGS,
                Uri.parse("package:" + getContext().getPackageName())
            );
            intent.addFlags(Intent.FLAG_ACTIVITY_NEW_TASK);
        }
        getContext().startActivity(intent);
        call.resolve();
    }
}
