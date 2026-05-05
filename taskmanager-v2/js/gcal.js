// ordify.me — Google Calendar integration (Phase 9)
//
// Two-way sync of meetings between ordify (local Store) and the user's
// primary Google Calendar.
//
//   • READ  — list events for a date range, merge into local view
//   • WRITE — create / update / delete an event from a local meeting
//
// External event identity is preserved via meeting.gcal_id; once written,
// subsequent edits go through update() not insert().

const GCal = {
    SCOPE: 'https://www.googleapis.com/auth/calendar.events',
    BASE: 'https://www.googleapis.com/calendar/v3/calendars/primary',

    isConnected() {
        return Google.isConnected(this.SCOPE);
    },

    async connect() {
        await Google.requestToken(this.SCOPE);
    },

    /**
     * List events between two ISO dates. Returns normalized objects
     * shaped like local meetings: { id, gcal_id, title, starts_at, ends_at,
     * location, description, video_url, source: 'gcal' }.
     */
    async listEvents(startISO, endISO) {
        const params = new URLSearchParams({
            timeMin: startISO,
            timeMax: endISO,
            singleEvents: 'true',
            orderBy: 'startTime',
            maxResults: '250',
        });
        const url = `${this.BASE}/events?${params.toString()}`;
        const data = await Google.get(url, this.SCOPE);
        return (data.items || []).map(this._toLocal);
    },

    _toLocal(ev) {
        const start = ev.start?.dateTime || ev.start?.date;
        const end   = ev.end?.dateTime   || ev.end?.date;
        return {
            id: 'gcal-' + ev.id,
            gcal_id: ev.id,
            title: ev.summary || '(no title)',
            starts_at: start ? new Date(start).toISOString() : null,
            ends_at:   end   ? new Date(end).toISOString()   : null,
            location: ev.location || '',
            description: ev.description || '',
            video_url: ev.hangoutLink || (ev.conferenceData?.entryPoints?.find(p => p.entryPointType === 'video')?.uri) || '',
            source: 'gcal',
            html_link: ev.htmlLink || '',
        };
    },

    /** Create a Google event from a local meeting. Returns the new gcal_id. */
    async insert(meeting) {
        const tok = await Google.requestToken(this.SCOPE);
        const body = this._fromLocal(meeting);
        const res = await fetch(`${this.BASE}/events`, {
            method: 'POST',
            headers: {
                Authorization: `Bearer ${tok}`,
                'Content-Type': 'application/json',
            },
            body: JSON.stringify(body),
        });
        if (!res.ok) throw new Error(`Calendar ${res.status}: ${await res.text()}`);
        const data = await res.json();
        return data.id;
    },

    /** Update an existing Google event from a local meeting. */
    async update(meeting) {
        if (!meeting.gcal_id) throw new Error('No gcal_id');
        const tok = await Google.requestToken(this.SCOPE);
        const body = this._fromLocal(meeting);
        const res = await fetch(`${this.BASE}/events/${encodeURIComponent(meeting.gcal_id)}`, {
            method: 'PATCH',
            headers: {
                Authorization: `Bearer ${tok}`,
                'Content-Type': 'application/json',
            },
            body: JSON.stringify(body),
        });
        if (!res.ok) throw new Error(`Calendar ${res.status}: ${await res.text()}`);
        return true;
    },

    async delete(gcalId) {
        const tok = await Google.requestToken(this.SCOPE);
        const res = await fetch(`${this.BASE}/events/${encodeURIComponent(gcalId)}`, {
            method: 'DELETE',
            headers: { Authorization: `Bearer ${tok}` },
        });
        if (!res.ok && res.status !== 410) throw new Error(`Calendar ${res.status}`);
        return true;
    },

    _fromLocal(m) {
        const out = {
            summary: m.title,
            description: m.description || '',
            location: m.location || '',
            start: m.starts_at ? { dateTime: m.starts_at } : null,
            end:   m.ends_at   ? { dateTime: m.ends_at }   : null,
        };
        if (!out.end && out.start) {
            // Default 30-min duration if no end
            const e = new Date(m.starts_at); e.setMinutes(e.getMinutes() + 30);
            out.end = { dateTime: e.toISOString() };
        }
        return out;
    },
};

window.GCal = GCal;
