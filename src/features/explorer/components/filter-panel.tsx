import { useUrlState } from "@/features/url-state";
import { Input } from "@/components/ui/input";
import { Select } from "@/components/ui/select";
import { type CinemaScreen } from "@/features/database";
import { calculateMaskedDimensions } from "@/features/comparator/utils/mask-calc";

interface FilterPanelProps {
  availableStandards: string[];
  filteredScreens: CinemaScreen[];
}

export function FilterPanel({ availableStandards, filteredScreens }: FilterPanelProps) {
  const [state, setState] = useUrlState();

  const handleSearchChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    setState({ search: e.target.value });
  };

  const handleStandardToggle = (std: string) => {
    const active = state.standards.includes(std);
    const nextStandards = active
      ? state.standards.filter((s) => s !== std)
      : [...state.standards, std];
    setState({ standards: nextStandards });
  };

  const movieOptions = [
    { value: "both", label: "Commercial & Institutional" },
    { value: "commercial", label: "Commercial Only" },
    { value: "institutional", label: "Institutional Only" },
  ];

  const sortOptions = [
    { value: "cinemaName", label: "Cinema Name" },
    { value: "screen.widthMeters", label: "Screen Width" },
    { value: "screen.heightMeters", label: "Screen Height" },
    { value: "screen.area", label: "Total Area" },
    { value: "location.country", label: "Country" },
  ];

  const sortOrderOptions = [
    { value: "asc", label: "Ascending" },
    { value: "desc", label: "Descending" },
  ];

  const mapRectOptions = [
    { value: "all", label: "Draw All on Map" },
    { value: "selected", label: "Draw Selected on Map" },
    { value: "none", label: "None" },
  ];

  const exportData = (format: "csv" | "json") => {
    if (!filteredScreens || filteredScreens.length === 0) return;

    const list = filteredScreens.map((s) => {
      const maskCalc = calculateMaskedDimensions(
        s.dimensions.widthMeters,
        s.dimensions.heightMeters,
        state.mask,
      );
      const widthSrc = s.provenance["dimensions.widthMeters"];
      return {
        Name: s.venue.name,
        Theatre: s.name,
        City: s.venue.location.city,
        Country: s.venue.location.country,
        Width_m: s.dimensions.widthMeters,
        Height_m: s.dimensions.heightMeters,
        Native_AR: s.dimensions.nativeAspectRatio,
        Area_sq_m: s.dimensions.widthMeters * s.dimensions.heightMeters,
        Masked_Area_sq_m: maskCalc.area,
        Standards: s.tech.standards.join(", "),
        Seating: s.tech.numberOfSeats || "N/A",
        Reliability: widthSrc?.sourceType || "lfexaminer",
        Last_Updated: widthSrc?.updatedAt || "N/A",
      };
    });

    if (format === "json") {
      const dataStr =
        "data:text/json;charset=utf-8," + encodeURIComponent(JSON.stringify(list, null, 2));
      const a = document.createElement("a");
      a.setAttribute("href", dataStr);
      a.setAttribute(
        "download",
        `screen_size_export_${state.mask !== "none" ? "masked_" : ""}${new Date().toISOString().slice(0, 10)}.json`,
      );
      document.body.appendChild(a);
      a.click();
      a.remove();
    } else {
      const headers = Object.keys(list[0]).join(",");
      const rows = list.map((item) =>
        Object.values(item)
          .map((val) => `"${String(val).replace(/"/g, '""')}"`)
          .join(","),
      );
      const csvContent = "data:text/csv;charset=utf-8," + [headers, ...rows].join("\n");
      const a = document.createElement("a");
      a.setAttribute("href", encodeURI(csvContent));
      a.setAttribute(
        "download",
        `screen_size_export_${state.mask !== "none" ? "masked_" : ""}${new Date().toISOString().slice(0, 10)}.csv`,
      );
      document.body.appendChild(a);
      a.click();
      a.remove();
    }
  };

  return (
    <div className="flex flex-col gap-6">
      <div className="flex flex-col gap-0.5">
        <h3 className="label-caps text-text-primary tracking-[0.18em]">Filters</h3>
        <p className="text-xs text-text-muted mt-0.5">Refine and update selections</p>
      </div>

      {/* Text Search */}
      <Input
        placeholder="Search cinema or city…"
        value={state.search}
        onChange={handleSearchChange}
        label="Search"
      />

      {/* Movies Type */}
      <Select
        label="Theater Profile"
        value={state.movies}
        onChange={(e) => setState({ movies: e.target.value })}
        options={movieOptions}
      />

      {/* Cinema Formats */}
      <div className="flex flex-col gap-2">
        <span className="label-caps text-text-muted">Cinema Formats</span>
        <div className="flex flex-wrap gap-1.5">
          {availableStandards.map((std) => {
            const active = state.standards.includes(std);
            return (
              <button
                key={std}
                type="button"
                onClick={() => handleStandardToggle(std)}
                className={`px-2.5 py-1 text-xs font-semibold uppercase tracking-[0.08em] border transition-all cursor-pointer rounded-none ${
                  active
                    ? "bg-brand border-brand text-white"
                    : "bg-transparent border-app-border-strong text-text-secondary hover:border-brand/50 hover:text-brand"
                }`}
              >
                {std}
              </button>
            );
          })}
        </div>
      </div>

      <div className="grid grid-cols-2 gap-4">
        {/* Sort By */}
        <Select
          label="Sort By"
          value={state.sortBy}
          onChange={(e) => setState({ sortBy: e.target.value })}
          options={sortOptions}
        />

        {/* Sort Order */}
        <Select
          label="Order"
          value={state.sortDesc ? "desc" : "asc"}
          onChange={(e) => setState({ sortDesc: e.target.value === "desc" })}
          options={sortOrderOptions}
        />
      </div>

      <div className="border-t border-app-border pt-4 flex flex-col gap-4">
        <Select
          label="Map Visuals"
          value={state.mapRects}
          onChange={(e) => setState({ mapRects: e.target.value })}
          options={mapRectOptions}
        />

        <Select
          label="Export Data"
          value=""
          onChange={(e) => {
            if (e.target.value === "csv") exportData("csv");
            if (e.target.value === "json") exportData("json");
          }}
          options={[
            { value: "", label: "Select Format..." },
            { value: "csv", label: "Export as CSV" },
            { value: "json", label: "Export as JSON" },
          ]}
        />

        {/* License & Attribution Notice */}
        <div className="mt-2 text-[10px] text-text-muted leading-relaxed border-t border-app-border/40 pt-3 flex flex-col gap-1">
          <div>
            Data source:{" "}
            <a
              href="https://lfexaminer.com/theaters/"
              target="_blank"
              rel="noopener noreferrer"
              className="text-brand hover:underline font-semibold"
            >
              LF Examiner
            </a>
          </div>
          <div>
            Licensed under{" "}
            <a
              href="https://creativecommons.org/licenses/by-nc-sa/4.0/"
              target="_blank"
              rel="noopener noreferrer"
              className="text-brand hover:underline font-semibold"
            >
              CC BY-NC-SA 4.0
            </a>{" "}
            (ShareAlike).
          </div>
        </div>
      </div>
    </div>
  );
}
