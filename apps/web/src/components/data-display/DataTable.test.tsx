import { render, screen, within } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';

import { DataTable, type Column } from './DataTable';

interface Row {
  id: string;
  name: string;
  amount: string;
}

const columns: Column<Row>[] = [
  { key: 'name', header: 'Name', primary: true, cell: (row) => row.name },
  { key: 'amount', header: 'Amount', cell: (row) => row.amount },
  { key: 'actions', header: 'Actions', actions: true, cell: (row) => <button>Pay {row.name}</button> },
];

const rows: Row[] = [
  { id: '1', name: 'Bole Equb', amount: 'ETB 1,000' },
  { id: '2', name: 'Gerji Edir', amount: 'ETB 500' },
];

function stubViewport(wide: boolean) {
  vi.stubGlobal('matchMedia', (query: string) => ({
    matches: wide,
    media: query,
    addEventListener: () => {},
    removeEventListener: () => {},
  }));
}

describe('DataTable', () => {
  afterEach(() => vi.unstubAllGlobals());

  it('renders a real, labelled table on wide screens', () => {
    stubViewport(true);
    render(<DataTable caption="Contributions" columns={columns} rows={rows} getRowKey={(row) => row.id} />);

    const table = screen.getByRole('table', { name: 'Contributions' });

    expect(within(table).getAllByRole('columnheader').map((header) => header.textContent)).toEqual(['Name', 'Amount', 'Actions']);
    expect(within(table).getAllByRole('row')).toHaveLength(3);
    expect(screen.queryByRole('list')).not.toBeInTheDocument();
  });

  it('renders stacked cards, not a squeezed table, on phones', () => {
    stubViewport(false);
    render(<DataTable caption="Contributions" columns={columns} rows={rows} getRowKey={(row) => row.id} />);

    expect(screen.queryByRole('table')).not.toBeInTheDocument();

    const cards = within(screen.getByRole('list', { name: 'Contributions' })).getAllByRole('listitem');

    expect(cards).toHaveLength(2);
    expect(within(cards[0]).getByText('Bole Equb')).toBeInTheDocument();
    expect(within(cards[0]).getByText('Amount')).toBeInTheDocument();
    expect(within(cards[0]).getByText('ETB 1,000')).toBeInTheDocument();
    expect(within(cards[0]).getByRole('button', { name: 'Pay Bole Equb' })).toBeInTheDocument();
  });

  it('renders each row action exactly once (no duplicate hidden layout)', () => {
    stubViewport(true);
    render(<DataTable caption="Contributions" columns={columns} rows={rows} getRowKey={(row) => row.id} />);

    expect(screen.getAllByRole('button', { name: 'Pay Bole Equb' })).toHaveLength(1);
  });
});
