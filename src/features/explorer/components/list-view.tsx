import { useUrlState } from "@/features/url-state";
import { type CinemaScreen } from "@/features/database";
import { calculateMaskedDimensions } from "@/features/comparator/utils/mask-calc";
import { formatToSystemDate } from "@/utils/date";
import {
  useReactTable,
  getCoreRowModel,
  flexRender,
  createColumnHelper,
  getSortedRowModel,
  type SortingState,
} from "@tanstack/react-table";
import { useState, useMemo, useCallback } from "react";
import { Check } from "lucide-react";

interface ListViewProps {
  screens: CinemaScreen[];
}

/** Minimal SVG chevron for column sort indicators — replaces emoji */
function ChevronUp({ className }: { className?: string }) {
  return (
    <svg
      className={className}
      viewBox="0 0 12 12"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
    >
      <polyline points="2,8 6,4 10,8" />
    </svg>
  );
}
function ChevronDown({ className }: { className?: string }) {
  return (
    <svg
      className={className}
      viewBox="0 0 12 12"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
    >
      <polyline points="2,4 6,8 10,4" />
    </svg>
  );
}

const columnHelper = createColumnHelper<CinemaScreen>();

export function ListView({ screens }: ListViewProps) {
  const [state, setState] = useUrlState();
  const [sorting, setSorting] = useState<SortingState>([]);

  const handleToggleSelect = useCallback(
    (id: string) => {
      const isSelected = state.selected.includes(id);
      const nextSelected = isSelected
        ? state.selected.filter((x) => x !== id)
        : [...state.selected, id];
      setState({ selected: nextSelected });
    },
    [state.selected, setState],
  );

  const columns = useMemo(
    () => [
      columnHelper.accessor("id", {
        id: "select",
        header: "",
        cell: (info) => {
          const id = info.getValue();
          const isSelected = state.selected.includes(id);
          return (
            <div className="flex items-center justify-center">
              {/* Circle select button — inspired by IMAX Theatre Finder's + circle */}
              <button
                type="button"
                onClick={() => handleToggleSelect(id)}
                className={`w-6 h-6 rounded-full border flex items-center justify-center transition-all cursor-pointer ${
                  isSelected
                    ? "bg-brand border-brand text-white"
                    : "bg-transparent border-app-border-strong hover:border-brand"
                }`}
              >
                {isSelected && <Check className="w-3 h-3" />}
              </button>
            </div>
          );
        },
      }),
      columnHelper.accessor((row) => row.venue.name, {
        id: "cinemaName",
        header: "Cinema / Screen",
        cell: (info) => {
          const row = info.row.original;
          return (
            <div className="text-left">
              <div className="text-[11px] font-semibold text-text-primary leading-tight">
                {row.venue.name}
              </div>
              <div className="text-[11px] text-text-muted mt-0.5">
                {row.name}
                {row.tech.standards.length > 0 && (
                  <span className="ml-1.5">
                    {row.tech.standards.map((s) => (
                      <span
                        key={s}
                        className="inline-block mr-1 px-1.5 py-0 label-caps text-[8px] border border-app-border text-text-secondary rounded-none"
                      >
                        {s}
                      </span>
                    ))}
                  </span>
                )}
              </div>
            </div>
          );
        },
      }),
      columnHelper.accessor((row) => row.venue.location.city, {
        id: "city",
        header: "Location",
        cell: (info) => {
          const row = info.row.original;
          return (
            <div className="text-left text-[11px] text-text-secondary">
              {row.venue.location.city}
              <span className="text-text-muted">, {row.venue.location.country}</span>
            </div>
          );
        },
      }),
      columnHelper.accessor((row) => row.dimensions.widthMeters, {
        id: "widthMeters",
        header: "Dimensions",
        cell: (info) => {
          const row = info.row.original;
          return (
            <div className="text-left font-mono text-[11px] text-text-secondary">
              {row.dimensions.widthMeters.toFixed(1)}m × {row.dimensions.heightMeters.toFixed(1)}m
              <div className="text-[11px] text-text-muted mt-0.5">
                {row.dimensions.nativeAspectRatio.toFixed(2)}:1
              </div>
            </div>
          );
        },
      }),
      columnHelper.accessor((row) => row.dimensions.widthMeters, {
        id: "area",
        header: "Screen Area",
        cell: (info) => {
          const row = info.row.original;
          const nativeArea = row.dimensions.widthMeters * row.dimensions.heightMeters;
          const maskCalc = calculateMaskedDimensions(
            row.dimensions.widthMeters,
            row.dimensions.heightMeters,
            state.mask,
          );
          return (
            <div className="text-left font-mono">
              {maskCalc.isMasked ? (
                <>
                  <div className="text-[11px] font-semibold text-brand">
                    {maskCalc.area.toFixed(1)} m²
                  </div>
                  <div className="text-[11px] text-text-disabled line-through mt-0.5">
                    {nativeArea.toFixed(1)} m²
                  </div>
                </>
              ) : (
                <div className="text-[11px] text-text-secondary">{nativeArea.toFixed(1)} m²</div>
              )}
            </div>
          );
        },
      }),
      columnHelper.accessor(
        (row) => row.provenance["dimensions.widthMeters"]?.sourceType || "lfexaminer",
        {
          id: "sourceType",
          header: "Source",
          cell: (info) => {
            const row = info.row.original;
            const dimensionsSource = row.provenance["dimensions.widthMeters"];
            const sourceType = dimensionsSource?.sourceType || "lfexaminer";
            const accentColors = {
              operator: "border-l-emerald-500",
              lfexaminer: "border-l-blue-500",
              user_contributed: "border-l-amber-500",
              estimated: "border-l-amber-500",
            };
            const labels = {
              operator: "Operator",
              lfexaminer: "LFExaminer",
              user_contributed: "Crowdsourced",
              estimated: "Estimated",
            };
            return (
              <div className={`border-l-2 pl-2 flex flex-col gap-0.5 ${accentColors[sourceType]}`}>
                <span className="text-[11px] font-semibold text-text-secondary">
                  {labels[sourceType]}
                </span>
                <span className="text-[9px] text-text-muted">
                  {formatToSystemDate(dimensionsSource?.updatedAt, "No date")}
                </span>
              </div>
            );
          },
        },
      ),
    ],
    [state.selected, state.mask, handleToggleSelect],
  );

  const table = useReactTable({
    data: screens,
    columns,
    state: { sorting },
    onSortingChange: setSorting,
    getCoreRowModel: getCoreRowModel(),
    getSortedRowModel: getSortedRowModel(),
  });

  return (
    <div className="flex flex-col gap-4 h-full overflow-hidden">
      {/* Stats row */}
      <div className="flex justify-between items-center py-2 flex-shrink-0">
        <div>
          <span className="text-sm font-semibold text-text-primary">{screens.length}</span>
          <span className="text-xs text-text-muted ml-1.5">screens found</span>
        </div>
      </div>

      {/* Table — borderless rows, hairline dividers only */}
      <div className="flex-1 overflow-auto border-t border-black/[0.06] dark:border-white/[0.06]">
        <table className="w-full border-collapse">
          <thead>
            {table.getHeaderGroups().map((headerGroup) => (
              <tr
                key={headerGroup.id}
                className="border-b border-black/[0.06] dark:border-white/[0.06]"
              >
                {headerGroup.headers.map((header) => (
                  <th
                    key={header.id}
                    onClick={
                      header.column.getCanSort()
                        ? header.column.getToggleSortingHandler()
                        : undefined
                    }
                    className={`px-3 py-2 text-left label-caps text-text-muted ${
                      header.column.getCanSort()
                        ? "cursor-pointer select-none hover:text-brand"
                        : ""
                    }`}
                  >
                    <span className="inline-flex items-center gap-1">
                      {flexRender(header.column.columnDef.header, header.getContext())}
                      {header.column.getIsSorted() === "asc" && (
                        <ChevronUp className="w-2.5 h-2.5" />
                      )}
                      {header.column.getIsSorted() === "desc" && (
                        <ChevronDown className="w-2.5 h-2.5" />
                      )}
                    </span>
                  </th>
                ))}
              </tr>
            ))}
          </thead>
          <tbody>
            {table.getRowModel().rows.map((row) => (
              <tr
                key={row.id}
                className="border-b border-black/[0.04] dark:border-white/[0.04] hover:bg-black/[0.02] dark:hover:bg-white/[0.02] transition-colors"
              >
                {row.getVisibleCells().map((cell) => (
                  <td key={cell.id} className="px-3 py-2.5 align-middle">
                    {flexRender(cell.column.columnDef.cell, cell.getContext())}
                  </td>
                ))}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
