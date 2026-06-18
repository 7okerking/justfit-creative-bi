/**
 * 属性过滤：方向、主题、风格化、痛点、锻炼类型 多选，默认全部。
 */
import { Select, Space, Typography } from "antd";
import { ALL_VALUE } from "../api/client";
import type { FilterOptions } from "../types";
import { normalizeAttributeSelection } from "../utils/filterSelection";

interface Props {
  options: FilterOptions;
  fxs: string[];
  zts: string[];
  styles: string[];
  pains: string[];
  exercises: string[];
  onFxsChange: (v: string[]) => void;
  onZtsChange: (v: string[]) => void;
  onStylesChange: (v: string[]) => void;
  onPainsChange: (v: string[]) => void;
  onExercisesChange: (v: string[]) => void;
}

const selectProps = {
  mode: "multiple" as const,
  allowClear: true,
  maxTagCount: 3,
  style: { minWidth: 140 },
  placeholder: "全部",
};

function withAllOption(items: string[]) {
  return [{ label: "全部", value: ALL_VALUE }, ...items.map((i) => ({ label: i, value: i }))];
}

/** 展示用：选「全部」时不与其它项混显 */
function displayValue(values: string[]): string[] {
  if (!values.length || values.includes(ALL_VALUE)) {
    return [ALL_VALUE];
  }
  return values;
}

export default function AttributeFilters({
  options,
  fxs,
  zts,
  styles,
  pains,
  exercises,
  onFxsChange,
  onZtsChange,
  onStylesChange,
  onPainsChange,
  onExercisesChange,
}: Props) {
  return (
    <div className="filter-panel attr-filter-panel">
      <Typography.Text className="time-filter-label">属性</Typography.Text>
      <Space wrap size="middle">
        <Space>
          <span>方向</span>
          <Select
            {...selectProps}
            value={displayValue(fxs)}
            options={withAllOption(options.fx ?? [])}
            onChange={(v) => onFxsChange(normalizeAttributeSelection(v))}
          />
        </Space>
        <Space>
          <span>主题</span>
          <Select
            {...selectProps}
            value={displayValue(zts)}
            options={withAllOption(options.zt ?? [])}
            onChange={(v) => onZtsChange(normalizeAttributeSelection(v))}
          />
        </Space>
        <Space>
          <span>风格化</span>
          <Select
            {...selectProps}
            value={displayValue(styles)}
            options={withAllOption(options.styles)}
            onChange={(v) => onStylesChange(normalizeAttributeSelection(v))}
          />
        </Space>
        <Space>
          <span>痛点</span>
          <Select
            {...selectProps}
            value={displayValue(pains)}
            options={withAllOption(options.pains)}
            onChange={(v) => onPainsChange(normalizeAttributeSelection(v))}
          />
        </Space>
        <Space>
          <span>锻炼类型</span>
          <Select
            {...selectProps}
            value={displayValue(exercises)}
            options={withAllOption(options.exercises)}
            onChange={(v) => onExercisesChange(normalizeAttributeSelection(v))}
          />
        </Space>
      </Space>
    </div>
  );
}
