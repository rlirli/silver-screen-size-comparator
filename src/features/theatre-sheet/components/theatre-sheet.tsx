import { type CinemaScreen } from "@/features/database";
import { type CustomScreen } from "@/features/url-state";
import { MapPin, Film, Volume2, ShieldCheck, HelpCircle, Users, Projector } from "lucide-react";
import { formatToSystemDate } from "@/utils/date";

interface TheatreSheetProps {
  screen?: CinemaScreen;
  customScreen?: CustomScreen;
}

/**
 * TheatreSheet — details panel shown on hover over a screen label.
 * Theme-responsive details panel, monospaced data values.
 */
export function TheatreSheet({ screen, customScreen }: TheatreSheetProps) {
  if (customScreen) {
    const area = customScreen.width * customScreen.height;
    const ratio = customScreen.width / customScreen.height;

    return (
      <div className="flex flex-col gap-3 w-full text-left select-none">
        {/* Header */}
        <div className="flex flex-col gap-0.5 border-b border-app-border pb-2.5">
          <span className="text-[10px] font-semibold tracking-wide text-brand">Custom target</span>
          <h4 className="font-bold text-sm text-text-primary leading-tight truncate mt-1">
            {customScreen.name}
          </h4>
        </div>

        {/* Specs grid */}
        <div className="grid grid-cols-2 gap-x-4 gap-y-2.5">
          {[
            { label: "Width", value: `${customScreen.width.toFixed(1)} m` },
            { label: "Height", value: `${customScreen.height.toFixed(1)} m` },
            { label: "Area", value: `${area.toFixed(1)} m²` },
            { label: "Aspect ratio", value: `${ratio.toFixed(2)}:1` },
          ].map(({ label, value }) => (
            <div key={label} className="flex flex-col gap-0.5">
              <span className="text-[10px] font-semibold tracking-wide text-text-muted">
                {label}
              </span>
              <span className="font-mono text-xs font-medium text-text-secondary">{value}</span>
            </div>
          ))}
        </div>

        <div className="border-t border-app-border pt-2 text-[10px] text-text-muted flex items-center gap-1.5">
          <ShieldCheck className="w-3.5 h-3.5 text-emerald-500 dark:text-emerald-400/70 shrink-0" />
          User-defined custom size reference
        </div>
      </div>
    );
  }

  if (!screen) return null;

  const area = screen.dimensions.widthMeters * screen.dimensions.heightMeters;
  const dimensionsSource = screen.provenance["dimensions.widthMeters"];
  const sourceType = dimensionsSource?.sourceType || "lfexaminer";

  const reliabilityColors = {
    operator: "text-emerald-600 dark:text-emerald-400",
    lfexaminer: "text-brand",
    user_contributed: "text-amber-600 dark:text-amber-400",
    estimated: "text-amber-600 dark:text-amber-400",
  };
  const reliabilityLabels = {
    operator: "Operator confirmed",
    lfexaminer: "LFExaminer DB",
    user_contributed: "Crowdsourced",
    estimated: "Estimated",
  };
  const movieProfileLabels = {
    commercial: "Commercial release only",
    institutional: "Institutional / museum only",
    both: "Commercial & educational",
  };

  return (
    <div className="flex flex-col gap-3 w-full text-left select-none leading-normal">
      {/* Header */}
      <div className="flex flex-col border-b border-app-border pb-2.5 gap-1">
        <div className="flex justify-between items-start gap-2">
          <h4 className="font-bold text-sm text-text-primary leading-tight">
            {screen.venue.website ? (
              <a
                href={screen.venue.website}
                target="_blank"
                rel="noopener noreferrer"
                className="hover:text-brand underline decoration-dotted transition-colors"
              >
                {screen.venue.name}
              </a>
            ) : (
              screen.venue.name
            )}
          </h4>
          <span className={`text-[10px] font-semibold shrink-0 ${reliabilityColors[sourceType]}`}>
            {reliabilityLabels[sourceType]}
          </span>
        </div>
        <span className="text-[10px] text-text-muted flex items-center gap-1 mt-0.5">
          <MapPin className="w-3 h-3 shrink-0" />
          {screen.name} · {screen.venue.location.city}, {screen.venue.location.country}
        </span>
      </div>

      {/* Main stats */}
      <div className="grid grid-cols-2 gap-x-4 gap-y-2.5 border-b border-app-border pb-2.5">
        <div className="flex flex-col gap-0.5">
          <span className="text-[10px] font-semibold tracking-wide text-text-muted">
            Dimensions
          </span>
          <span className="font-mono text-xs font-semibold text-text-secondary">
            {screen.dimensions.widthMeters.toFixed(1)}m ×{" "}
            {screen.dimensions.heightMeters.toFixed(1)}m
          </span>
          <span className="text-[9px] text-text-muted mt-0.5">
            {screen.dimensions.isCurved ? "Curved" : "Flat"} screen{" "}
            {screen.dimensions.isDome ? "· Dome" : ""}
          </span>
        </div>
        <div className="flex flex-col gap-0.5">
          <span className="text-[10px] font-semibold tracking-wide text-text-muted">
            Area & ratio
          </span>
          <span className="font-mono text-xs font-bold text-brand">{area.toFixed(1)} m²</span>
          <span className="text-[9px] font-mono text-text-muted mt-0.5">
            {screen.dimensions.nativeAspectRatio.toFixed(2)}:1
          </span>
        </div>
      </div>

      {/* Hardware specs */}
      <div className="flex flex-col gap-1.5 text-xs text-text-secondary">
        <div className="flex items-center gap-2">
          <Film className="w-3.5 h-3.5 text-text-muted/70 shrink-0" />
          <span className="text-[10px] font-semibold tracking-wide text-text-muted w-14 shrink-0">
            Formats
          </span>
          <span className="truncate text-text-primary">
            {screen.tech.standards.join(", ")}
            {screen.tech.formatCode && ` (${screen.tech.formatCode})`}
          </span>
        </div>

        {screen.tech.projectionType && (
          <div className="flex items-center gap-2">
            <Projector className="w-3.5 h-3.5 text-text-muted/70 shrink-0" />
            <span className="text-[10px] font-semibold tracking-wide text-text-muted w-14 shrink-0">
              Projector
            </span>
            <span className="truncate text-text-primary">{screen.tech.projectionType}</span>
          </div>
        )}

        {screen.tech.audioEquipment && (
          <div className="flex items-center gap-2">
            <Volume2 className="w-3.5 h-3.5 text-text-muted/70 shrink-0" />
            <span className="text-[10px] font-semibold tracking-wide text-text-muted w-14 shrink-0">
              Audio
            </span>
            <span className="truncate text-text-primary">{screen.tech.audioEquipment}</span>
          </div>
        )}

        {screen.tech.numberOfSeats && (
          <div className="flex items-center gap-2">
            <Users className="w-3.5 h-3.5 text-text-muted/70 shrink-0" />
            <span className="text-[10px] font-semibold tracking-wide text-text-muted w-14 shrink-0">
              Seats
            </span>
            <span className="text-text-primary">{screen.tech.numberOfSeats.toLocaleString()}</span>
          </div>
        )}

        <div className="flex items-center gap-2">
          <HelpCircle className="w-3.5 h-3.5 text-text-muted/70 shrink-0" />
          <span className="text-[10px] font-semibold tracking-wide text-text-muted w-14 shrink-0">
            Profile
          </span>
          <span className="truncate text-text-primary">
            {movieProfileLabels[screen.moviesType]}
          </span>
        </div>
      </div>

      {/* Footer */}
      <div className="border-t border-app-border pt-2 flex justify-between items-center text-[9px] text-text-muted gap-2">
        <span>Updated: {formatToSystemDate(dimensionsSource?.updatedAt)}</span>
        {(screen.venue.openedDate || screen.venue.closedDate) && (
          <span className="flex items-center gap-1 shrink-0">
            <ShieldCheck className="w-3.5 h-3.5 text-emerald-500 dark:text-emerald-400/60 shrink-0" />
            {screen.venue.openedDate && `Opened: ${formatToSystemDate(screen.venue.openedDate)}`}
            {screen.venue.openedDate && screen.venue.closedDate && " · "}
            {screen.venue.closedDate && `Closed: ${formatToSystemDate(screen.venue.closedDate)}`}
          </span>
        )}
      </div>
    </div>
  );
}
