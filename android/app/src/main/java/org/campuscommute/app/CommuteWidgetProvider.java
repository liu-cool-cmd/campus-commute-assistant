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

    /**
     * How many rows a list widget renders. The layout decides how many of them actually appear:
     * every row is measured with the space that is left, so a row that cannot fit shrinks instead
     * of pushing its siblings out. No dp constant has to mirror the layouts any more.
     */
    private static final int MAX_ROWS = 8;
    private static final int MAX_MINI_ROWS = 7;
    /** One primary entry plus the following "up next" lines. */
    private static final int MAX_NEXT_ENTRIES = 5;

    private static final int ULTRA_NARROW_WIDTH_DP = 100;
    private static final int NARROW_WIDTH_DP = 180;
    /** Below this height the list header is dropped so a row still fits. */
    private static final int HEADER_MIN_HEIGHT_DP = 110;
    private static final int FOOTER_MIN_HEIGHT_DP = 170;
    private static final int MINI_HEADER_MIN_WIDTH_DP = 140;

    /**
     * NEXT renders every line and lets the layout drop what does not fit: a child measured with the
     * remaining space as its bound shrinks to zero instead of pushing its siblings out. This gate
     * only stays as a guard for launchers that report a very short card.
     */
    private static final int NEXT_DETAILS_MIN_HEIGHT_DP = 90;
    private static final int NEXT_TWO_THEN_MIN_HEIGHT_DP = 90;
    private static final int NEXT_THREE_THEN_MIN_HEIGHT_DP = 130;
    private static final int NEXT_FOUR_THEN_MIN_HEIGHT_DP = 170;

    private static final int[] ROW_CONTAINERS = {
        R.id.widget_row_1,
        R.id.widget_row_2,
        R.id.widget_row_3,
        R.id.widget_row_4,
        R.id.widget_row_5,
        R.id.widget_row_6,
        R.id.widget_row_7,
        R.id.widget_row_8
    };
    private static final int[] ROW_DAYS = {
        R.id.widget_row_day_1,
        R.id.widget_row_day_2,
        R.id.widget_row_day_3,
        R.id.widget_row_day_4,
        R.id.widget_row_day_5,
        R.id.widget_row_day_6,
        R.id.widget_row_day_7,
        R.id.widget_row_day_8
    };
    private static final int[] ROW_TIME_COLUMNS = {
        R.id.widget_row_time_column_1,
        R.id.widget_row_time_column_2,
        R.id.widget_row_time_column_3,
        R.id.widget_row_time_column_4,
        R.id.widget_row_time_column_5,
        R.id.widget_row_time_column_6,
        R.id.widget_row_time_column_7,
        R.id.widget_row_time_column_8
    };
    private static final int[] ROW_TIMES = {
        R.id.widget_row_time_1,
        R.id.widget_row_time_2,
        R.id.widget_row_time_3,
        R.id.widget_row_time_4,
        R.id.widget_row_time_5,
        R.id.widget_row_time_6,
        R.id.widget_row_time_7,
        R.id.widget_row_time_8
    };
    private static final int[] ROW_TITLES = {
        R.id.widget_row_title_1,
        R.id.widget_row_title_2,
        R.id.widget_row_title_3,
        R.id.widget_row_title_4,
        R.id.widget_row_title_5,
        R.id.widget_row_title_6,
        R.id.widget_row_title_7,
        R.id.widget_row_title_8
    };
    private static final int[] ROW_DETAILS = {
        R.id.widget_row_detail_1,
        R.id.widget_row_detail_2,
        R.id.widget_row_detail_3,
        R.id.widget_row_detail_4,
        R.id.widget_row_detail_5,
        R.id.widget_row_detail_6,
        R.id.widget_row_detail_7,
        R.id.widget_row_detail_8
    };
    private static final int[] MINI_ROWS = {
        R.id.widget_mini_row_1,
        R.id.widget_mini_row_2,
        R.id.widget_mini_row_3,
        R.id.widget_mini_row_4,
        R.id.widget_mini_row_5,
        R.id.widget_mini_row_6,
        R.id.widget_mini_row_7
    };
    private static final int[] MINI_DAYS = {
        R.id.widget_mini_day_1,
        R.id.widget_mini_day_2,
        R.id.widget_mini_day_3,
        R.id.widget_mini_day_4,
        R.id.widget_mini_day_5,
        R.id.widget_mini_day_6,
        R.id.widget_mini_day_7
    };
    private static final int[] MINI_TIMES = {
        R.id.widget_mini_time_1,
        R.id.widget_mini_time_2,
        R.id.widget_mini_time_3,
        R.id.widget_mini_time_4,
        R.id.widget_mini_time_5,
        R.id.widget_mini_time_6,
        R.id.widget_mini_time_7
    };
    private static final int[] MINI_TITLES = {
        R.id.widget_mini_title_1,
        R.id.widget_mini_title_2,
        R.id.widget_mini_title_3,
        R.id.widget_mini_title_4,
        R.id.widget_mini_title_5,
        R.id.widget_mini_title_6,
        R.id.widget_mini_title_7
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
        RemoteViews views =
            mode == Mode.NEXT
                ? renderNext(context, snapshot, entries, size)
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
        int defaultHeight = mode == Mode.TODAY_TOMORROW ? 180 : mode == Mode.WEEK ? 250 : 110;
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

    /**
     * Applies the mode's day filter only. The old fixed caps (2 / 4 / 6) are gone on purpose: how
     * many plans are shown is decided by the measured widget height, so resizing shows more.
     */
    private static List<JSONObject> selectEntries(JSONObject snapshot, Mode mode) {
        List<JSONObject> selected = new ArrayList<>();
        JSONArray entries = snapshot.optJSONArray("entries");
        if (entries == null) return selected;
        long now = System.currentTimeMillis();
        int limit = entryLimit(mode);
        int lastMiniDay = -1;
        for (int index = 0; index < entries.length() && selected.size() < limit; index++) {
            JSONObject entry = entries.optJSONObject(index);
            if (entry == null) continue;
            long classStart = entry.optLong("classStart", 0);
            if (classStart <= now) continue;
            int dayOffset = dayOffset(now, classStart);
            if (dayOffset < 0) continue;
            if (mode == Mode.TODAY && dayOffset != 0) continue;
            if (mode == Mode.TODAY_TOMORROW && dayOffset > 1) continue;
            if (mode == Mode.WEEK && dayOffset > 6) continue;
            if (mode == Mode.MINI) {
                if (dayOffset > 6 || dayOffset == lastMiniDay) continue;
                lastMiniDay = dayOffset;
            }
            selected.add(entry);
        }
        return selected;
    }

    private static int entryLimit(Mode mode) {
        if (mode == Mode.NEXT) return MAX_NEXT_ENTRIES;
        if (mode == Mode.MINI) return MAX_MINI_ROWS;
        return MAX_ROWS;
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

    /**
     * The leave time lives in an auto-sized block (see widget_next_commute.xml), so the number grows
     * with the card and the layout absorbs whatever the fixed lines leave over.
     */
    private static RemoteViews renderNext(
        Context context,
        JSONObject snapshot,
        List<JSONObject> entries,
        WidgetSize size
    ) {
        RemoteViews views = new RemoteViews(context.getPackageName(), R.layout.widget_next_commute);
        views.setTextViewText(R.id.widget_title, label(snapshot, "next", "Next commute"));
        if (entries.isEmpty()) {
            String empty = label(snapshot, "noPlans", "No upcoming commute plan");
            views.setTextViewText(R.id.widget_next_class, empty);
            views.setTextViewText(
                R.id.widget_next_location,
                label(snapshot, "openApp", "Open app")
            );
            views.setViewVisibility(R.id.widget_next_location, View.VISIBLE);
            views.setViewVisibility(R.id.widget_next_hero, View.GONE);
            views.setViewVisibility(R.id.widget_next_route, View.GONE);
            views.setViewVisibility(R.id.widget_next_divider, View.GONE);
            views.setViewVisibility(R.id.widget_next_then, View.GONE);
            views.setContentDescription(R.id.widget_next_class, empty);
            return views;
        }

        JSONObject entry = entries.get(0);
        String classTitle = entry.optString("classTitle");
        views.setTextViewText(R.id.widget_next_class, classTitle);
        views.setContentDescription(
            R.id.widget_next_class,
            joinNonEmpty(classTitle, entry.optString("classTime"), " · ")
        );
        views.setTextViewText(
            R.id.widget_next_location,
            joinNonEmpty(entry.optString("classTime"), entry.optString("location"), " · ")
        );
        views.setViewVisibility(R.id.widget_next_hero, View.VISIBLE);

        String leaveTime = entry.optString("leaveTime");
        if (leaveTime.isEmpty()) {
            // No computed departure: the hero block carries the explanation instead of a time, and
            // keeps the (empty) number box so the message stays centred in the card.
            views.setTextViewText(R.id.widget_next_leave_label, entry.optString("statusText"));
            views.setViewVisibility(R.id.widget_next_leave, View.VISIBLE);
            views.setTextViewText(R.id.widget_next_leave, "");
        } else {
            views.setTextViewText(R.id.widget_next_leave_label, label(snapshot, "leave", "Leave"));
            views.setViewVisibility(R.id.widget_next_leave, View.VISIBLE);
            views.setTextViewText(R.id.widget_next_leave, leaveTime);
        }

        String route = leaveTime.isEmpty()
            ? ""
            : joinNonEmpty(entry.optString("route"), entry.optString("departureTime"), " · ");
        views.setTextViewText(R.id.widget_next_route, route);
        boolean detailsVisible = size.heightDp >= NEXT_DETAILS_MIN_HEIGHT_DP;
        views.setViewVisibility(
            R.id.widget_next_route,
            route.isEmpty() || !detailsVisible ? View.GONE : View.VISIBLE
        );
        views.setViewVisibility(
            R.id.widget_next_location,
            detailsVisible ? View.VISIBLE : View.GONE
        );

        int thenSlots = thenSlots(entries, size);
        views.setViewVisibility(
            R.id.widget_next_divider,
            thenSlots > 0 ? View.VISIBLE : View.GONE
        );
        views.setViewVisibility(R.id.widget_next_then, thenSlots > 0 ? View.VISIBLE : View.GONE);
        if (thenSlots > 0) {
            long now = System.currentTimeMillis();
            int primaryDay = dayOffset(now, entry.optLong("classStart", 0));
            StringBuilder builder = new StringBuilder(label(snapshot, "upNext", "Up next"));
            for (int index = 1; index <= thenSlots; index++) {
                JSONObject following = entries.get(index);
                // Only repeat the day when it differs from the primary entry: without it, two
                // sessions of the same course read as a duplicated line.
                String day = dayOffset(now, following.optLong("classStart", 0)) == primaryDay
                    ? ""
                    : shortDay(following);
                String line = joinNonEmpty(
                    day,
                    joinNonEmpty(
                        primaryTime(snapshot, following),
                        following.optString("classTitle"),
                        " · "
                    ),
                    " · "
                );
                if (!line.isEmpty()) builder.append('\n').append(line);
            }
            views.setTextViewText(R.id.widget_next_then, builder.toString());
        }
        return views;
    }

    private static int thenSlots(List<JSONObject> entries, WidgetSize size) {
        int following = entries.size() - 1;
        if (following <= 0) return 0;
        int slots = size.heightDp >= NEXT_FOUR_THEN_MIN_HEIGHT_DP
            ? 4
            : size.heightDp >= NEXT_THREE_THEN_MIN_HEIGHT_DP
                ? 3
                : size.heightDp >= NEXT_TWO_THEN_MIN_HEIGHT_DP ? 2 : 0;
        return Math.min(slots, following);
    }

    private static RemoteViews renderList(
        Context context,
        JSONObject snapshot,
        List<JSONObject> entries,
        Mode mode,
        WidgetSize size
    ) {
        RemoteViews views = new RemoteViews(context.getPackageName(), R.layout.widget_plan_list);
        boolean ultraNarrow = size.widthDp < ULTRA_NARROW_WIDTH_DP;
        boolean narrow = size.widthDp < NARROW_WIDTH_DP;
        boolean populated = !entries.isEmpty();
        boolean headerVisible = !ultraNarrow && size.heightDp >= HEADER_MIN_HEIGHT_DP;
        boolean footerVisible = populated && !ultraNarrow && size.heightDp >= FOOTER_MIN_HEIGHT_DP;

        String titleKey = mode == Mode.TODAY
            ? "today"
            : mode == Mode.TODAY_TOMORROW ? "todayTomorrow" : "week";
        String fallback = mode == Mode.TODAY
            ? "Today"
            : mode == Mode.TODAY_TOMORROW ? "Today + tomorrow" : "Next 7 days";
        views.setTextViewText(R.id.widget_title, label(snapshot, titleKey, fallback));
        views.setViewVisibility(R.id.widget_header, headerVisible ? View.VISIBLE : View.GONE);
        views.setViewVisibility(R.id.widget_brand, narrow ? View.GONE : View.VISIBLE);
        views.setTextViewText(R.id.widget_empty, label(snapshot, "noPlans", "No upcoming commute plan"));
        views.setViewVisibility(R.id.widget_empty, populated ? View.GONE : View.VISIBLE);
        views.setViewVisibility(R.id.widget_rows, populated ? View.VISIBLE : View.GONE);
        views.setViewVisibility(R.id.widget_footer, footerVisible ? View.VISIBLE : View.GONE);
        views.setTextViewText(
            R.id.widget_footer,
            joinNonEmpty(
                label(snapshot, "updated", "Updated"),
                snapshot.optString("generatedAtLabel"),
                " "
            )
        );

        long now = System.currentTimeMillis();
        for (int index = 0; index < ROW_CONTAINERS.length; index++) {
            boolean visible = populated && index < entries.size();
            views.setViewVisibility(ROW_CONTAINERS[index], visible ? View.VISIBLE : View.GONE);
            if (!visible) continue;
            JSONObject entry = entries.get(index);
            views.setViewVisibility(
                ROW_TIME_COLUMNS[index],
                narrow ? View.GONE : View.VISIBLE
            );
            views.setTextViewText(ROW_DAYS[index], shortDay(entry));
            views.setTextViewText(ROW_TIMES[index], primaryTime(snapshot, entry));
            if (narrow) {
                // One column: lead with the leave time and drop the redundant "Today".
                String day = ultraNarrow && dayOffset(now, entry.optLong("classStart", 0)) == 0
                    ? ""
                    : shortDay(entry);
                views.setTextViewText(
                    ROW_TITLES[index],
                    joinNonEmpty(day, primaryTime(snapshot, entry), " · ")
                );
                views.setTextViewText(
                    ROW_DETAILS[index],
                    joinNonEmpty(
                        entry.optString("classTitle"),
                        listDetail(snapshot, entry, false),
                        " · "
                    )
                );
            } else {
                views.setTextViewText(ROW_TITLES[index], entry.optString("classTitle"));
                views.setTextViewText(ROW_DETAILS[index], listDetail(snapshot, entry, true));
            }
            views.setContentDescription(
                ROW_CONTAINERS[index],
                joinNonEmpty(entry.optString("dayLabel"), entry.optString("classTitle"), " · ")
            );
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
        boolean populated = !entries.isEmpty();
        boolean headerVisible = size.widthDp >= MINI_HEADER_MIN_WIDTH_DP &&
            size.heightDp >= HEADER_MIN_HEIGHT_DP;
        views.setTextViewText(R.id.widget_mini_title, label(snapshot, "mini", "Mini schedule"));
        views.setViewVisibility(
            R.id.widget_mini_header,
            headerVisible ? View.VISIBLE : View.GONE
        );
        views.setTextViewText(
            R.id.widget_mini_empty,
            label(snapshot, "noPlans", "No upcoming commute plan")
        );
        views.setViewVisibility(R.id.widget_mini_empty, populated ? View.GONE : View.VISIBLE);
        views.setViewVisibility(R.id.widget_mini_rows, populated ? View.VISIBLE : View.GONE);

        for (int index = 0; index < MINI_ROWS.length; index++) {
            boolean visible = populated && index < entries.size();
            views.setViewVisibility(MINI_ROWS[index], visible ? View.VISIBLE : View.GONE);
            if (!visible) continue;
            JSONObject entry = entries.get(index);
            views.setTextViewText(MINI_DAYS[index], shortDay(entry));
            views.setTextViewText(MINI_TIMES[index], miniTime(entry));
            views.setTextViewText(MINI_TITLES[index], entry.optString("classTitle"));
            views.setContentDescription(
                MINI_ROWS[index],
                joinNonEmpty(entry.optString("dayLabel"), entry.optString("classTitle"), " · ")
            );
        }
        return views;
    }

    /** The bolded line: when the student has to leave, falling back to the class start time. */
    private static String primaryTime(JSONObject snapshot, JSONObject entry) {
        String leaveTime = entry.optString("leaveTime");
        if (leaveTime.isEmpty()) return entry.optString("classTime");
        return joinNonEmpty(label(snapshot, "leave", "Leave"), leaveTime, " ");
    }

    private static String miniTime(JSONObject entry) {
        String leaveTime = entry.optString("leaveTime");
        return leaveTime.isEmpty() ? entry.optString("classTime") : leaveTime;
    }

    private static String classTimeText(JSONObject snapshot, JSONObject entry) {
        String classTime = entry.optString("classTime");
        if (classTime.isEmpty()) return "";
        return joinNonEmpty(label(snapshot, "classAt", "Class"), classTime, " ");
    }

    private static String listDetail(
        JSONObject snapshot,
        JSONObject entry,
        boolean withLocation
    ) {
        if (entry.optString("leaveTime").isEmpty()) return entry.optString("statusText");
        String detail = joinNonEmpty(
            entry.optString("route"),
            classTimeText(snapshot, entry),
            " · "
        );
        return withLocation
            ? joinNonEmpty(detail, entry.optString("location"), " · ")
            : detail;
    }

    private static String shortDay(JSONObject entry) {
        String value = entry.optString("dayShort");
        return value.isEmpty() ? entry.optString("dayLabel") : value;
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
