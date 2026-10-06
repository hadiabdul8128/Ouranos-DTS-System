'use client';
import {useMemo, useState} from 'react';
import {ArrowDown, ArrowUp, Search} from 'lucide-react';
import type {Entity} from '@/packages/contracts';
import {approvalLevelName, approvalLevelsOf, approvalWait, currentApprovalLevel} from '@/packages/contracts/approval-chain';
import {Table, TableBody, TableCell, TableHead, TableHeader, TableRow} from '@/components/ui/table';
import './request-table.css';

type Filter = 'open' | 'decided' | 'all';
type SortKey = 'waiting' | 'submitted';
const text = (value: unknown) => typeof value === 'string' ? value : '';
const shortDate = (value: string) => value ? new Date(value).toLocaleDateString('en-US', {month: 'short', day: 'numeric'}) : '—';

/** The review queue as a table: filter, search, sort, and open a request by clicking its row. */
export function RequestTable({requests, now, busy, onOpen, kindText, statusText}: {requests: Entity[]; now: Date; busy: boolean; onOpen: (request: Entity) => void; kindText: (kind: unknown) => string; statusText: (status: unknown) => string}) {
  const [filter, setFilter] = useState<Filter>('open');
  const [query, setQuery] = useState('');
  const [sort, setSort] = useState<{key: SortKey; descending: boolean}>({key: 'waiting', descending: true});

  const rows = useMemo(() => requests.map(request => {
    const levels = approvalLevelsOf(request), current = currentApprovalLevel(levels), wait = approvalWait(request, now);
    const submitted = text(request.data.submittedAt) || request.updatedAt;
    const step = request.status === 'in_review' && current
      ? `Level ${current.position + 1} of ${levels.length} · ${approvalLevelName(current.position, current.label)}`
      : request.status === 'approved' ? `All ${levels.length} ${levels.length === 1 ? 'level' : 'levels'} done` : '—';
    return {request, open: request.status === 'in_review', title: `${kindText(request.data.kind)}${text(request.data.destination) ? ` · ${text(request.data.destination)}` : ''}`, step, submitted, waitDays: request.status === 'in_review' && wait ? wait.days : null, late: request.status === 'in_review' && Boolean(wait?.late)};
  }), [requests, now, kindText]);

  const counts = {open: rows.filter(r => r.open).length, decided: rows.filter(r => !r.open).length, all: rows.length};
  const needle = query.trim().toLowerCase();
  const shown = rows
    .filter(r => filter === 'all' || (filter === 'open') === r.open)
    .filter(r => !needle || r.title.toLowerCase().includes(needle) || r.step.toLowerCase().includes(needle))
    .sort((a, b) => {
      const order = sort.key === 'waiting' ? (a.waitDays ?? -1) - (b.waitDays ?? -1) || a.submitted.localeCompare(b.submitted) : a.submitted.localeCompare(b.submitted);
      return sort.descending ? -order : order;
    });
  function sortBy(key: SortKey) { setSort(s => s.key === key ? {key, descending: !s.descending} : {key, descending: true}); }
  const sortIcon = (key: SortKey) => sort.key === key ? (sort.descending ? <ArrowDown size={14} aria-hidden="true"/> : <ArrowUp size={14} aria-hidden="true"/>) : null;
  const ariaSort = (key: SortKey) => sort.key === key ? (sort.descending ? 'descending' : 'ascending') : 'none';

  return <section className="request-table" aria-label="Review requests">
    <div className="request-table-tools">
      <div className="request-table-filter" role="group" aria-label="Show">
        {([['open', 'To decide'], ['decided', 'Decided'], ['all', 'All']] as const).map(([value, name]) => <button key={value} type="button" aria-pressed={filter === value} onClick={() => setFilter(value)}>{name}<span>{counts[value]}</span></button>)}
      </div>
      <label className="request-table-search"><Search size={16} aria-hidden="true"/><span className="sr-only">Search requests</span><input type="search" placeholder="Search by destination" value={query} onChange={event => setQuery(event.target.value)}/></label>
    </div>
    {shown.length ? <Table>
      <TableHeader><TableRow>
        <TableHead scope="col">Request</TableHead>
        <TableHead scope="col" className="request-table-step">Step</TableHead>
        <TableHead scope="col" className="request-table-date" aria-sort={ariaSort('submitted')}><button type="button" onClick={() => sortBy('submitted')}>Submitted {sortIcon('submitted')}</button></TableHead>
        <TableHead scope="col" aria-sort={ariaSort('waiting')}><button type="button" onClick={() => sortBy('waiting')}>Waiting {sortIcon('waiting')}</button></TableHead>
        <TableHead scope="col" className="request-table-state">Status</TableHead>
      </TableRow></TableHeader>
      <TableBody>{shown.map(row => <TableRow key={row.request.id} className={row.late ? 'is-late' : ''} onClick={() => { if (!busy) onOpen(row.request); }}>
        <TableCell><button type="button" className="request-table-open" disabled={busy} onClick={event => { event.stopPropagation(); onOpen(row.request); }}>{row.title}</button><small className="request-table-meta">{row.step} · {row.open ? 'In review' : statusText(row.request.status)}</small></TableCell>
        <TableCell className="request-table-step">{row.step}</TableCell>
        <TableCell className="request-table-date">{shortDate(row.submitted)}</TableCell>
        <TableCell className="request-table-wait">{row.waitDays === null ? '—' : row.late ? <strong>{row.waitDays} {row.waitDays === 1 ? 'day' : 'days'}</strong> : `${row.waitDays} ${row.waitDays === 1 ? 'day' : 'days'}`}</TableCell>
        <TableCell className="request-table-state"><span className={`request-table-status is-${row.request.status}`}>{row.open ? 'In review' : statusText(row.request.status)}</span></TableCell>
      </TableRow>)}</TableBody>
    </Table> : <p className="request-table-empty">{needle ? `No requests match “${query.trim()}”.` : filter === 'open' ? 'Nothing is waiting for a decision.' : 'No requests here yet.'}</p>}
    {counts.open > 0 && rows.some(r => r.late) && <p className="request-table-note">Bold waits are past the 72-hour mark.</p>}
  </section>;
}
