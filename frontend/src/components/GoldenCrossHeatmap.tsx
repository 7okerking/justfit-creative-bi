/**
 * 黄金交叉热力图：方向(FX) × 主题(ZT)，按素材出单率着色。
 */
import type { GoldenCrossMatrix } from "../types";
import { orderRateHeatColor } from "../utils/heatmap";

interface Props {
  matrix: GoldenCrossMatrix | null;
}

export default function GoldenCrossHeatmap({ matrix }: Props) {
  if (!matrix?.fx_list?.length || !matrix?.zt_list?.length) {
    return null;
  }

  const { fx_list, zt_list, cells } = matrix;
  const lookup = new Map(
    cells.map((c) => [`${c.fx}|${c.zt}`, c])
  );

  return (
    <div className="table-card heatmap-card">
      <div className="card-title">黄金交叉热力图 · 出单率（FX × ZT）</div>
      <div className="heatmap-legend">
        <span className="heatmap-legend-item heatmap-legend-low">0%</span>
        <span className="heatmap-legend-bar" />
        <span className="heatmap-legend-item heatmap-legend-high">高出单率</span>
      </div>
      <div className="heatmap-scroll">
        <table className="heatmap-table">
          <thead>
            <tr>
              <th className="heatmap-corner">FX \ ZT</th>
              {zt_list.map((zt) => (
                <th key={zt} className="heatmap-col-head">
                  {zt}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {fx_list.map((fx) => (
              <tr key={fx}>
                <th className="heatmap-row-head">{fx}</th>
                {zt_list.map((zt) => {
                  const cell = lookup.get(`${fx}|${zt}`);
                  const rate = cell?.order_rate ?? null;
                  return (
                    <td
                      key={`${fx}-${zt}`}
                      className="heatmap-cell"
                      style={{ backgroundColor: orderRateHeatColor(rate) }}
                      title={
                        cell
                          ? `出单率 ${rate}% · 素材 ${cell.total_materials} · 出单 ${cell.ordered_materials}`
                          : "无数据"
                      }
                    >
                      {rate !== null ? (
                        <>
                          <span className="heatmap-rate">{rate}%</span>
                          <span className="heatmap-sub">
                            {cell?.ordered_materials}/{cell?.total_materials}
                          </span>
                        </>
                      ) : (
                        <span className="heatmap-empty">—</span>
                      )}
                    </td>
                  );
                })}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
