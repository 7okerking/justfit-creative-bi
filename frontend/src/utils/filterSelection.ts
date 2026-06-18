import { ALL_VALUE } from "../api/client";

/**
 * 多选属性筛选：选具体维度时去掉「全部」；点「全部」时清空其它项。
 */
export function normalizeAttributeSelection(values: string[]): string[] {
  if (!values.length) {
    return [ALL_VALUE];
  }
  const last = values[values.length - 1];
  if (last === ALL_VALUE) {
    return [ALL_VALUE];
  }
  const specific = values.filter((v) => v !== ALL_VALUE);
  return specific.length ? specific : [ALL_VALUE];
}

/** 当前是否为「全部」筛选 */
export function isAllSelected(values: string[]): boolean {
  return !values.length || values.includes(ALL_VALUE);
}
