package org.campuscommute.app;

public class MiniCommuteWidgetProvider extends CommuteWidgetProvider {
    @Override
    protected Mode getMode() {
        return Mode.MINI;
    }
}
