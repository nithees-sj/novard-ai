import React from 'react';

/**
 * A table in the app's card style (the same classes as the Profile page's
 * tests-history table). Wide tables scroll inside their card on small screens.
 *
 * columns: [{ key, label, render?(row), className?, headClassName? }]
 */
export default function DataTable({ columns, rows, rowKey = (r, i) => r._id || r.id || i, onRowClick, empty = 'Nothing here yet.', footer = null }) {
  return (
    <div className="overflow-x-auto">
      <table className="w-full text-sm">
        <thead>
          <tr className="border-y border-gray-100 bg-gray-50/70 text-left text-[11px] font-semibold uppercase tracking-wide text-gray-500">
            {columns.map((c, i) => (
              <th key={c.key} className={`${i === 0 ? 'px-6' : 'px-4'} py-2.5 whitespace-nowrap ${c.headClassName || ''}`}>{c.label}</th>
            ))}
          </tr>
        </thead>
        <tbody className="divide-y divide-gray-100">
          {rows.length === 0 && (
            <tr><td colSpan={columns.length} className="px-6 py-10 text-center text-sm text-gray-500">{empty}</td></tr>
          )}
          {rows.map((row, ri) => (
            <tr
              key={rowKey(row, ri)}
              className={`hover:bg-gray-50/60 ${onRowClick ? 'cursor-pointer' : ''}`}
              onClick={onRowClick ? () => onRowClick(row) : undefined}
            >
              {columns.map((c, i) => (
                <td key={c.key} className={`${i === 0 ? 'px-6' : 'px-4'} py-3 ${c.className || ''}`}>{c.render ? c.render(row) : row[c.key]}</td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
      {footer}
    </div>
  );
}
