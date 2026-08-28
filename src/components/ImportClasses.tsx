import { useRef, useState } from 'react';
import { parseIcs } from '../core/calendar/ics';
import type { AppLanguage, ClassEvent } from '../core/types';
import { translate } from '../i18n';

interface ImportClassesProps {
  language: AppLanguage;
  mode?: 'import' | 'replace';
  onImport(events: ClassEvent[]): void;
}

export function ImportClasses({ language, mode = 'import', onImport }: ImportClassesProps) {
  const input = useRef<HTMLInputElement>(null);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');

  const importFile = async (file?: File) => {
    if (!file) return;
    try {
      const now = new Date();
      const rangeStart = new Date(now.getTime() - 30 * 86_400_000);
      const rangeEnd = new Date(now);
      rangeEnd.setFullYear(rangeEnd.getFullYear() + 1);
      const events = parseIcs(await file.text(), rangeStart, rangeEnd);
      if (events.length === 0) throw new Error(translate(language, 'noCourseEvents'));
      setError('');
      onImport(events);
      setSuccess(
        translate(language, 'calendarImported', { count: events.length, file: file.name }),
      );
    } catch (caught) {
      setSuccess('');
      setError(
        caught instanceof Error ? caught.message : translate(language, 'calendarReadFailed'),
      );
    } finally {
      if (input.current) input.current.value = '';
    }
  };

  return (
    <div className="import-panel">
      <input
        ref={input}
        className="visually-hidden"
        type="file"
        accept=".ics,text/calendar"
        onChange={(event) => void importFile(event.target.files?.[0])}
      />
      <button className="primary-button" onClick={() => input.current?.click()}>
        {translate(language, mode === 'replace' ? 'replaceCalendar' : 'importCalendar')}
      </button>
      <p>{translate(language, mode === 'replace' ? 'replaceCalendarHint' : 'importHint')}</p>
      {success && <p className="success-text">{success}</p>}
      {error && <p className="error-text">{error}</p>}
    </div>
  );
}
