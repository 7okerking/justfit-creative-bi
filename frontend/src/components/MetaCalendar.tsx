/**
 * 时间筛选：快选 + 日期区间，紧凑单行布局。
 */
import { DatePicker, Typography } from "antd";
import type { Dayjs } from "dayjs";
import dayjs from "dayjs";
import { useCallback, useEffect, useMemo, useState } from "react";
import type { PresetKey } from "../types";

const { RangePicker } = DatePicker;

interface Props {
  minDate?: string | null;
  maxDate?: string | null;
  start: string;
  end: string;
  onChange: (start: string, end: string) => void;
}

const PRESETS: { key: PresetKey; label: string }[] = [
  { key: "custom", label: "自定义" },
  { key: "yesterday", label: "昨天" },
  { key: "last7", label: "近7天" },
  { key: "last30", label: "近30天" },
];

function fmt(d: Dayjs): string {
  return d.format("YYYY-MM-DD");
}

function normalizeRange(start: Dayjs, end: Dayjs): [string, string] {
  if (end.isBefore(start)) {
    [start, end] = [end, start];
  }
  return [fmt(start.startOf("day")), fmt(end.startOf("day"))];
}

export default function MetaCalendar({
  minDate,
  maxDate,
  start,
  end,
  onChange,
}: Props) {
  const [preset, setPreset] = useState<PresetKey>("last7");

  const dataMax = useMemo(
    () => (maxDate ? dayjs(maxDate) : dayjs()),
    [maxDate]
  );
  const dataMin = useMemo(
    () => (minDate ? dayjs(minDate) : dataMax.subtract(90, "day")),
    [minDate, dataMax]
  );

  const applyPreset = useCallback(
    (key: PresetKey) => {
      setPreset(key);
      const anchor = dataMax;
      let s: Dayjs;
      let e: Dayjs = anchor;

      switch (key) {
        case "yesterday":
          s = anchor.subtract(1, "day");
          e = s;
          break;
        case "last7":
          s = anchor.subtract(6, "day");
          break;
        case "last30":
          s = anchor.subtract(29, "day");
          break;
        default:
          return;
      }
      const [startStr, endStr] = normalizeRange(
        s.startOf("day"),
        e.startOf("day")
      );
      onChange(startStr, endStr);
    },
    [dataMax, onChange]
  );

  useEffect(() => {
    if (preset !== "custom" && maxDate) {
      applyPreset(preset);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [maxDate]);

  const rangeValue: [Dayjs, Dayjs] | null = useMemo(() => {
    if (!start || !end) return null;
    const s = dayjs(start);
    const e = dayjs(end);
    if (!s.isValid() || !e.isValid()) return null;
    return [s, e];
  }, [start, end]);

  const handleRangeChange = (dates: null | (Dayjs | null)[]) => {
    if (!dates || !dates[0]) return;
    setPreset("custom");
    const s = dates[0].startOf("day");
    const e = (dates[1] ?? dates[0]).startOf("day");
    const [startStr, endStr] = normalizeRange(s, e);
    onChange(startStr, endStr);
  };

  const disabledDate = (current: Dayjs) => {
    if (!current) return false;
    return current.isBefore(dataMin, "day") || current.isAfter(dataMax, "day");
  };

  return (
    <div className="time-filter-panel">
      <Typography.Text className="time-filter-label">时间</Typography.Text>
      <div className="meta-calendar-presets">
        {PRESETS.map((p) => (
          <button
            key={p.key}
            type="button"
            className={`preset-chip${preset === p.key ? " preset-chip--active" : ""}`}
            onClick={() => {
              if (p.key === "custom") {
                setPreset("custom");
              } else {
                applyPreset(p.key);
              }
            }}
          >
            {p.label}
          </button>
        ))}
      </div>
      <RangePicker
        className="time-filter-picker"
        size="small"
        value={rangeValue}
        onChange={handleRangeChange}
        disabledDate={disabledDate}
        allowEmpty={[false, true]}
        format="YYYY-MM-DD"
        placeholder={["开始", "结束"]}
      />
      <Typography.Text className="time-filter-range" type="secondary">
        {start} ~ {end}
        {start === end ? " · 单日" : ""}
      </Typography.Text>
    </div>
  );
}
