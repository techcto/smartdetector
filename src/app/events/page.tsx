import Console from '../platform-console';
import EventSearch from '../event-search';
import People from '../people';
export default function HistoryPage(){return <><section className="hero"><p className="eyebrow">Activity history</p><h1>Your detected events.</h1><p className="muted">Review observations, thumbnails, and AI context from your active location.</p></section><EventSearch/><Console historyOnly/><People/></>}
