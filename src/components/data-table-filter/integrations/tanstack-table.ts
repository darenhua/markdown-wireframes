import type { ColumnDef, ColumnFiltersState } from "@tanstack/react-table";
import type { Column, FilterModel, FiltersState } from "../core/types";
import {
  dateFilterFn,
  multiOptionFilterFn,
  numberFilterFn,
  optionFilterFn,
  textFilterFn,
} from "../lib/filter-fns";

/**
 * Creates TanStack Table column definitions with filter functions
 * based on the data-table-filter column configs
 */
export function createTSTColumns<TData>({
  columns,
  configs,
}: {
  columns: ColumnDef<TData, any>[];
  configs: Column<TData>[];
}): ColumnDef<TData, any>[] {
  return columns.map((col) => {
    const config = configs.find((c) => c.id === (col.id ?? (col as any).accessorKey));
    if (!config) return col;

    return {
      ...col,
      filterFn: (row, columnId, filterValue: FilterModel<any>) => {
        const value = row.getValue(columnId);

        switch (config.type) {
          case "text":
            return textFilterFn(value as string, filterValue);
          case "number":
            return numberFilterFn(value as number, filterValue);
          case "date":
            return dateFilterFn(value as Date, filterValue);
          case "option":
            return optionFilterFn(value as string, filterValue);
          case "multiOption":
            return multiOptionFilterFn(value as string[], filterValue);
          default:
            return true;
        }
      },
    };
  });
}

/**
 * Converts data-table-filter FiltersState to TanStack Table ColumnFiltersState
 */
export function createTSTFilters(filters: FiltersState): ColumnFiltersState {
  return filters.map((filter) => ({
    id: filter.columnId,
    value: filter,
  }));
}
