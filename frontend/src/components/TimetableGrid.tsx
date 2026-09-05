import type { ReactNode } from "react";
import type { TimeSlot } from "../api/types";

export type TimetableVariant = "mobile" | "desktop" | "builder";

export interface GridDay {
  value: number;
  label: string;
}

interface Props {
  variant: TimetableVariant;
  days: GridDay[];
  slots: TimeSlot[];
  /** Content to render inside a cell, or null if the cell is empty. */
  renderCell: (day: number, slotId: number) => ReactNode | null;
  /** Called when any cell (filled or empty) is clicked — omit to make the grid read-only. */
  onCellClick?: (day: number, slotId: number) => void;
}

const GUTTER_WIDTH: Record<TimetableVariant, string> = {
  mobile: "34px",
  desktop: "64px",
  builder: "64px",
};

const MIN_COL_WIDTH: Record<TimetableVariant, string> = {
  mobile: "0",
  desktop: "140px",
  builder: "140px",
};

export default function TimetableGrid({ variant, days, slots, renderCell, onCellClick }: Props) {
  const gutter = GUTTER_WIDTH[variant];
  const minCol = MIN_COL_WIDTH[variant];

  return (
    <div
      className="timetable"
      style={{
        gridTemplateColumns: `${gutter} repeat(${days.length}, minmax(${minCol}, 1fr))`,
      }}
    >
      {/* header row */}
      <div />
      {days.map((day) => (
        <div
          key={day.value}
          style={{
            fontSize: variant === "mobile" ? 11.5 : 13,
            fontWeight: 600,
            color: "var(--color-neutral-700)",
            paddingLeft: variant === "mobile" ? 37 : 0,
            textAlign: variant === "mobile" ? "left" : "center",
          }}
        >
          {day.label}
        </div>
      ))}

      {slots.map((slot) => (
        <FragmentRow
          key={slot.id}
          slot={slot}
          days={days}
          variant={variant}
          renderCell={renderCell}
          onCellClick={onCellClick}
        />
      ))}
    </div>
  );
}

function FragmentRow({
  slot,
  days,
  variant,
  renderCell,
  onCellClick,
}: {
  slot: TimeSlot;
  days: GridDay[];
  variant: TimetableVariant;
  renderCell: Props["renderCell"];
  onCellClick: Props["onCellClick"];
}) {
  return (
    <>
      <div style={{ fontSize: 10, color: "var(--color-neutral-500)" }}>
        <strong style={{ fontSize: 10, color: "var(--color-neutral-700)" }}>{slot.order}</strong>
        <br />
        {slot.start_time.slice(0, 5)}
      </div>
      {days.map((day) => {
        const content = renderCell(day.value, slot.id);
        const filled = content !== null && content !== undefined;
        const clickable = Boolean(onCellClick) && (filled || variant === "builder");

        if (!clickable) {
          return (
            <div
              key={day.value}
              className={filled ? "" : "timetable-cell-empty"}
              style={filled ? undefined : {}}
            >
              {filled ? content : null}
            </div>
          );
        }

        return (
          <button
            key={day.value}
            type="button"
            className={
              filled
                ? variant === "desktop"
                  ? "timetable-cell-desktop"
                  : "timetable-cell-filled"
                : variant === "builder"
                  ? "timetable-cell-empty buildable"
                  : "timetable-cell-empty"
            }
            onClick={() => onCellClick?.(day.value, slot.id)}
          >
            {filled ? content : variant === "builder" ? "+" : null}
          </button>
        );
      })}
    </>
  );
}
