package org.campuscommute.app;

public class TodayTomorrowCommuteWidgetProvider extends CommuteWidgetProvider {
    @Override
    protected Mode getMode() {
        return Mode.TODAY_TOMORROW;
    }
}
