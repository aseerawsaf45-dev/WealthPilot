'use client';

import React from 'react';
import { Pencil, Trash2 } from 'lucide-react';

/** Edit / delete icon buttons for a card or row. Delete asks for confirmation first. */
export function RowActions({ label, onEdit, onDelete }: { label: string; onEdit?: () => void; onDelete?: () => void }) {
  return (
    <div className="flex items-center gap-0.5">
      {onEdit && (
        <button
          type="button"
          onClick={onEdit}
          aria-label={`Edit ${label}`}
          title="Edit"
          className="p-1.5 rounded-lg text-slate-400 hover:text-slate-900 hover:bg-slate-100 transition-colors cursor-pointer"
        >
          <Pencil className="w-3.5 h-3.5" />
        </button>
      )}
      {onDelete && (
        <button
          type="button"
          onClick={() => {
            if (window.confirm(`Delete "${label}"? This cannot be undone.`)) onDelete();
          }}
          aria-label={`Delete ${label}`}
          title="Delete"
          className="p-1.5 rounded-lg text-slate-400 hover:text-rose-600 hover:bg-rose-50 transition-colors cursor-pointer"
        >
          <Trash2 className="w-3.5 h-3.5" />
        </button>
      )}
    </div>
  );
}
