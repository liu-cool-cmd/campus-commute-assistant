package org.campuscommute.app;

import android.app.PendingIntent;
import android.appwidget.AppWidgetManager;
import android.appwidget.AppWidgetProvider;
import android.content.ComponentName;
import android.content.Context;
import android.content.Intent;
import android.content.SharedPreferences;
import android.os.Bundle;
import android.view.View;
import android.widget.RemoteViews;
import java.util.ArrayList;
import java.util.Calendar;
import java.util.List;
import org.json.JSONArray;
import org.json.JSONObject;

public abstract class CommuteWidgetProvider extends AppWidgetProvider {

    protected enum Mode {
        NEXT,
        TODAY,
        TODAY_TOMORROW,
        WEEK,
        MINI
    }

    private static final String PREFERENCES_GROUP = "CapacitorStorage";
    private static final String SNAPSHOT_KEY = "widget-plans-v1";
    private static final int[] ROW_CONTAINERS = {
        R.id.widget_row_1,
        R.id.widget_row_2,
        R.id.widget_row_3,
        R.id.widget_row_4,
        R.id.widget_row_5,
        R.id.widget_row_6
    };
    private static final int[] ROW_DAYS = {
        R.id.widget_row_day_1,
        R.id.widget_row_day_2,
        R.id.widget_row_day_3,
        R.id.widget_row_day_4,
        R.id.widget_row_day_5,
        R.id.widget_row_day_6
    };
    private static final int[] ROW_TIME_COLUMNS = {
        R.id.widget_row_time_column_1,
        R.id.widget_row_time_column_2,
        R.id.widget_row_time_column_3,
        R.id.widget_row_time_column_4,
        R.id.widget_row_time_column_5,
        R.id.widget_row_time_column_6
    };
    private static final int[] ROW_TIMES = {
        R.id.widget_row_time_1,
        R.id.widget_row_time_2,
        R.id.widget_row_time_3,
        R.id.widget_row_time_4,
        R.id.widget_row_time_5,
        R.id.widget_row_time_6
    };
    private static final int[] ROW_TITLES = {
        R.id.widget_row_title_1,
        R.id.widget_row_title_2,
        R.id.widget_row_title_3,
        R.id.widget_row_title_4,
        R.id.widget_row_title_5,
        R.id.widget_row_title_6
    };
    private static final int[] ROW_DETAILS = {
        R.id.widget_row_detail_1,
        R.id.widget_row_detail_2,
        R.id.widget_row_detail_3,
        R.id.widget_row_detail_4,
        R.id.widget_row_detail_5,
        R.id.widget_row_detail_6
    };
    private static final int[] MINI_ROWS = {
        R.id.widget_mini_row_1,
        R.id.widget_mini_row_2,
        R.id.widget_mini_row_3,
        R.id.widget_mini_row_4,
        R.id.widget_mini_row_5,
        R.id.widget_mini_row_6
    };

    protected abstract Mode getMode();

    @Override
    public void onUpdate(Context context, AppWidgetManager manager, int[] widgetIds) {
        for (int widgetId : widgetIds) updateWidget(context, manager, widgetId, getMode());
    }

    @Override
    public void onAppWidgetOptionsChanged(
        Context context,
        AppWidgetManager manager,
        int widgetId,
        Bundle newOptions
    ) {
        updateWidget(context, manager, widgetId, getMode());
    }

    public static void refreshAll(Context context) {
        AppWidgetManager manager = AppWidgetManager.getInstance(context);
        refreshProvider(context, manager, NextCommuteWidgetProvider.class, Mode.NEXT);
        refreshProvider(context, manager, TodayCommuteWidgetProvider.class, Mode.TODAY);
        refreshProvider(
            context,
            manager,
            TodayTomorrowCommuteWidgetProvider.class,
            Mode.TODAY_TOMORROW
        );
        refreshProvider(context, manager, WeekCommuteWidgetProvider.class, Mode.WEEK);
        refreshProvider(context, manager, MiniCommuteWidgetProvider.class, Mode.MINI);
    }

    private static void refreshProvider(
        Context context,
        AppWidgetManager manager,
        Class<? extends AppWidgetProvider> provider,
        Mode mode
    ) {
        int[] ids = manager.getAppWidgetIds(new ComponentName(context, provider));
        for (int id : ids) updateWidget(context, manager, id, mode);
    }

    private static void updateWidget(
        Context context,
        AppWidgetManager manager,
        int widgetId,
        Mode mode
    ) {
        JSONObject snapshot = readSnapshot(context);
        List<JSONObject> entries = selectEntries(snapshot, mode);
        WidgetSize size = readWidgetSize(manager, widgetId, mode);
        RemoteViews views = mode == Mode.NEXT
            ? renderNext(context, snapshot, entries)
            : mode == Mode.MINI
            ? renderMini(context, snapshot, entries, size)
            : renderList(context, snapshot, entries, mode, size);
        Intent intent = new Intent(context, MainActivity.class);
        intent.setFlags(Intent.FLAG_ACTIVITY_NEW_TASK | Intent.FLAG_ACTIVITY_CLEAR_TOP);
        PendingIntent pendingIntent = PendingIntent.getActivity(
            context,
            mode.ordinal() + 100,
            intent,
            PendingIntent.FLAG_UPDATE_CURRENT | PendingIntent.FLAG_IMMUTABLE
        );
        views.setOnClickPendingIntent(R.id.widget_root, pendingIntent);
        manager.updateAppWidget(widgetId, views);
    }

    private static WidgetSize readWidgetSize(
        AppWidgetManager manager,
        int widgetId,
        Mode mode
    ) {
        Bundle options = manager.getAppWidgetOptions(widgetId);
        int defaultHeight = mode == Mode.TODAY || mode == Mode.MINI
            ? 110
            : mode == Mode.TODAY_TOMORROW
            ? 180
            : 250;
        int width = options.getInt(AppWidgetManager.OPTION_APPWIDGET_MIN_WIDTH, 250);
        int height = options.getInt(AppWidgetManager.OPTION_APPWIDGET_MIN_HEIGHT, defaultHeight);
        return new WidgetSize(Math.max(width, 40), Math.max(height, 70));
    }

    private static JSONObject readSnapshot(Context context) {
        SharedPreferences preferences = context.getSharedPreferences(
            PREFERENCES_GROUP,
            Context.MODE_PRIVATE
        );
        String raw = preferences.getString(SNAPSHOT_KEY, null);
        if (raw == null) return new JSONObject();
        try {
            return new JSONObject(raw);
        } catch (Exception ignored) {
            return new JSONObject();
        }
    }

    private static List<JSONObject> selectEntries(JSONObject snapshot, Mode mode) {
        List<JSONObject> selected = new ArrayList<>();
        JSONArray entries = snapshot.optJSONArray("entries");
        if (entries == null) return selected;
        long now = System.currentTimeMillis();
        int lastMiniDay = -1;
        for (int index = 0; index < entries.length(); index++) {
            JSONObject entry = entries.optJSONObject(index);
            if (entry == null) continue;
            long classStart = entry.optLong("classStart", 0);
            if (classStart <= now) continue;
            int dayOffset = dayOffset(now, classStart);
            if (mode == Mode.TODAY && dayOffset != 0) continue;
            if (mode == Mode.TODAY_TOMORROW && (dayOffset < 0 || dayOffset > 1)) continue;
            if (mode == Mode.MINI) {
                if (dayOffset < 0 || dayOffset > 6 || dayOffset == lastMiniDay) continue;
                lastMiniDay = dayOffset;
            }
            selected.add(entry);
        }
        int maximum = mode == Mode.NEXT
            ? 1
            : mode == Mode.TODAY
            ? 2
            : mode == Mode.TODAY_TOMORROW
            ? 4
            : 6;
        return selected.subList(0, Math.min(maximum, selected.size()));
    }

    private static int dayOffset(long fromMillis, long toMillis) {
        Calendar from = Calendar.getInstance();
        from.setTimeInMillis(fromMillis);
        clearTime(from);
        Calendar to = Calendar.getInstance();
        to.setTimeInMillis(toMillis);
        clearTime(to);
        int days = 0;
        while (from.before(to) && days <= 8) {
            from.add(Calendar.DAY_OF_YEAR, 1);
            days++;
        }
        return from.equals(to) ? days : -1;
    }

    private static void clearTime(Calendar calendar) {
        calendar.set(Calendar.HOUR_OF_DAY, 0);
        calendar.set(Calendar.MINUTE, 0);
        calendar.set(Calendar.SECOND, 0);
        calendar.set(Calendar.MILLISECOND, 0);
    }

    private static JSONObject labels(JSONObject snapshot) {
        JSONObject labels = snapshot.optJSONObject("labels");
        return labels == null ? new JSONObject() : labels;
    }

    private static String label(JSONObject snapshot, String key, String fallback) {
        return labels(snapshot).optString(key, fallback);
    }

    private static RemoteViews renderNext(
        Context context,
        JSONObject snapshot,
        List<JSONObject> entries
    ) {
        RemoteViews views = new RemoteViews(context.getPackageName(), R.layout.widget_next_commute);
        views.setTextViewText(R.id.widget_title, label(snapshot, "next", "Next commute"));
        if (entries.isEmpty()) {
            views.setTextViewText(
                R.id.widget_next_class,
                label(snapshot, "noPlans", "No upcoming commute plan")
            );
            views.setTextViewText(R.id.widget_next_location, label(snapshot, "openApp", "Open app"));
            views.setViewVisibility(R.id.widget_next_leave, View.GONE);
            views.setViewVisibility(R.id.widget_next_route, View.GONE);
            return views;
        }
        JSONObject entry = entries.get(0);
        views.setTextViewText(R.id.widget_next_class, entry.optString("classTitle"));
        views.setTextViewText(
            R.id.widget_next_location,
            joinNonEmpty(entry.optString("classTime"), entry.optString("location"), " · ")
        );
        String leaveTime = entry.optString("leaveTime");
        if (leaveTime.isEmpty()) {
            views.setViewVisibility(R.id.widget_next_leave, View.GONE);
            views.setViewVisibility(R.id.widget_next_route, View.VISIBLE);
            views.setTextViewText(R.id.widget_next_route, entry.optString("statusText"));
        } else {
            views.setViewVisibility(R.id.widget_next_leave, View.VISIBLE);
            views.setViewVisibility(R.id.widget_next_route, View.VISIBLE);
            views.setTextViewText(
                R.id.widget_next_leave,
                label(snapshot, "leave", "Leave") + " " + leaveTime
            );
            views.setTextViewText(
                R.id.widget_next_route,
                joinNonEmpty(entry.optString("route"), entry.optString("departureTime"), " · ")
            );
        }
        return views;
    }

    private static RemoteViews renderList(
        Context context,
        JSONObject snapshot,
        List<JSONObject> entries,
        Mode mode,
        WidgetSize size
    ) {
        RemoteViews views = new RemoteViews(context.getPackageName(), R.layout.widget_plan_list);
        boolean narrow = size.widthDp < 180;
        boolean singleColumn = size.widthDp < 100;
        int headerHeight = singleColumn ? 0 : 32;
        int rowCapacity = Math.max(1, Math.min(
            ROW_CONTAINERS.length,
            (size.heightDp - headerHeight - 20) / 42
        ));
        String titleKey = mode == Mode.TODAY ? "today" : mode == Mode.TODAY_TOMORROW ? "todayTomorrow" : "week";
        String fallback = mode == Mode.TODAY ? "Today" : mode == Mode.TODAY_TOMORROW ? "Today + tomorrow" : "Next 7 days";
        views.setTextViewText(R.id.widget_title, label(snapshot, titleKey, fallback));
        views.setViewVisibility(R.id.widget_header, singleColumn ? View.GONE : View.VISIBLE);
        views.setViewVisibility(R.id.widget_brand, narrow ? View.GONE : View.VISIBLE);
        views.setTextViewText(R.id.widget_empty, label(snapshot, "noPlans", "No upcoming commute plan"));
        views.setViewVisibility(R.id.widget_empty, entries.isEmpty() ? View.VISIBLE : View.GONE);

        for (int index = 0; index < ROW_CONTAINERS.length; index++) {
            if (index >= entries.size() || index >= rowCapacity) {
                views.setViewVisibility(ROW_CONTAINERS[index], View.GONE);
                continue;
            }
            JSONObject entry = entries.get(index);
            views.setViewVisibility(ROW_CONTAINERS[index], View.VISIBLE);
            views.setViewVisibility(ROW_TIME_COLUMNS[index], narrow ? View.GONE : View.VISIBLE);
            views.setTextViewText(ROW_DAYS[index], entry.optString("dayLabel"));
            views.setTextViewText(ROW_TIMES[index], entry.optString("classTime"));
            String leaveTime = entry.optString("leaveTime");
            String detail = leaveTime.isEmpty()
                ? entry.optString("statusText")
                : label(snapshot, "leave", "Leave") + " " + leaveTime + " · " + entry.optString("route");
            if (narrow) {
                views.setTextViewText(
                    ROW_TITLES[index],
                    joinNonEmpty(entry.optString("dayLabel"), entry.optString("classTime"), " ")
                );
                views.setTextViewText(
                    ROW_DETAILS[index],
                    joinNonEmpty(entry.optString("classTitle"), detail, " · ")
                );
            } else {
                views.setTextViewText(ROW_TITLES[index], entry.optString("classTitle"));
                views.setTextViewText(ROW_DETAILS[index], detail);
            }
        }
        return views;
    }

    private static RemoteViews renderMini(
        Context context,
        JSONObject snapshot,
        List<JSONObject> entries,
        WidgetSize size
    ) {
        RemoteViews views = new RemoteViews(context.getPackageName(), R.layout.widget_mini_plan);
        int rowCapacity = Math.max(1, Math.min(MINI_ROWS.length, (size.heightDp - 42) / 24));
        views.setTextViewText(R.id.widget_mini_title, label(snapshot, "mini", "Mini schedule"));
        views.setViewVisibility(R.id.widget_mini_title, size.widthDp < 140 ? View.GONE : View.VISIBLE);
        views.setTextViewText(
            R.id.widget_mini_empty,
            label(snapshot, "noPlans", "No upcoming commute plan")
        );
        views.setViewVisibility(R.id.widget_mini_empty, entries.isEmpty() ? View.VISIBLE : View.GONE);

        for (int index = 0; index < MINI_ROWS.length; index++) {
            if (index >= entries.size() || index >= rowCapacity) {
                views.setViewVisibility(MINI_ROWS[index], View.GONE);
                continue;
            }
            JSONObject entry = entries.get(index);
            String primaryTime = entry.optString("leaveTime");
            if (primaryTime.isEmpty()) primaryTime = entry.optString("classTime");
            String text = joinNonEmpty(entry.optString("dayLabel"), primaryTime, " · ");
            text = joinNonEmpty(text, entry.optString("classTitle"), " · ");
            views.setViewVisibility(MINI_ROWS[index], View.VISIBLE);
            views.setTextViewText(MINI_ROWS[index], text);
        }
        return views;
    }

    private static final class WidgetSize {
        final int widthDp;
        final int heightDp;

        WidgetSize(int widthDp, int heightDp) {
            this.widthDp = widthDp;
            this.heightDp = heightDp;
        }
    }

    private static String joinNonEmpty(String first, String second, String separator) {
        if (first == null || first.isEmpty()) return second == null ? "" : second;
        if (second == null || second.isEmpty()) return first;
        return first + separator + second;
    }
}
