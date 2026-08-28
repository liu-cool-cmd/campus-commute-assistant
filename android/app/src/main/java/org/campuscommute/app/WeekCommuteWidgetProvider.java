package org.campuscommute.app;

public class WeekCommuteWidgetProvider extends CommuteWidgetProvider {
    @Override
    protected Mode getMode() {
        return Mode.WEEK;
    }
}
