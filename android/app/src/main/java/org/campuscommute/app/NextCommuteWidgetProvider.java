package org.campuscommute.app;

public class NextCommuteWidgetProvider extends CommuteWidgetProvider {
    @Override
    protected Mode getMode() {
        return Mode.NEXT;
    }
}
