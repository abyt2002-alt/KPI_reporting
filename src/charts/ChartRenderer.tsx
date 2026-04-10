import {
  LineChart,
  Line,
  BarChart,
  Bar,
  PieChart,
  Pie,
  Cell,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
  ResponsiveContainer,
} from "recharts";
import type { ChartConfig } from "../store/useStore";
import { useStore } from "../store/useStore";

// Brand colors
const COLORS = ["#FFBD59", "#41C185", "#458EE2", "#8B5CF6", "#EF4444", "#F59E0B", "#EC4899"];

interface Props {
  config: ChartConfig;
  data?: Record<string, unknown>[];
  height?: number;
}

// Normalize a column to 0-1 range
function normalizeData(data: Record<string, unknown>[], columns: string[]): Record<string, unknown>[] {
  const stats: Record<string, { min: number; max: number }> = {};
  
  // Calculate min/max for each column
  columns.forEach(col => {
    const values = data.map(row => Number(row[col]) || 0);
    stats[col] = {
      min: Math.min(...values),
      max: Math.max(...values),
    };
  });
  
  // Normalize values
  return data.map(row => {
    const normalized: Record<string, unknown> = { ...row };
    columns.forEach(col => {
      const { min, max } = stats[col];
      const range = max - min;
      const val = Number(row[col]) || 0;
      normalized[col] = range === 0 ? 0.5 : (val - min) / range;
    });
    return normalized;
  });
}

export function ChartRenderer({ config, data, height = 300 }: Props) {
  const dataset = useStore((s) => s.dataset);
  const rawData = data || dataset?.rows || [];
  
  // Apply normalization if enabled
  const chartData = config.normalize 
    ? normalizeData(rawData, config.yColumns)
    : rawData;

  if (config.type === "pie") {
    const pieData = chartData.reduce(
      (acc, row) => {
        const key = String(row[config.xColumn]);
        const val = Number(row[config.yColumns[0]]) || 0;
        const existing = acc.find((d) => d.name === key);
        if (existing) existing.value += val;
        else acc.push({ name: key, value: val });
        return acc;
      },
      [] as { name: string; value: number }[]
    );

    return (
      <ResponsiveContainer width="100%" height={height}>
        <PieChart>
          <Pie data={pieData} dataKey="value" nameKey="name" cx="50%" cy="50%" outerRadius={Math.min(height * 0.35, 120)} label>
            {pieData.map((_, i) => (
              <Cell key={i} fill={COLORS[i % COLORS.length]} />
            ))}
          </Pie>
          {config.showLegend && <Legend />}
          <Tooltip />
        </PieChart>
      </ResponsiveContainer>
    );
  }

  const leftCols = config.dualAxis ? (config.leftAxisColumns || []) : config.yColumns;
  const rightCols = config.dualAxis ? (config.rightAxisColumns || []) : [];

  if (config.type === "bar") {
    return (
      <ResponsiveContainer width="100%" height={height}>
        <BarChart data={chartData}>
          <CartesianGrid strokeDasharray="3 3" stroke="#E5E5E5" />
          <XAxis dataKey={config.xColumn} tick={{ fontSize: 12, fill: "#666666" }} />
          <YAxis
            yAxisId="left"
            tick={{ fontSize: 12, fill: "#666666" }}
            domain={[config.leftAxisMin ?? "auto", config.leftAxisMax ?? "auto"]}
          />
          {config.dualAxis && rightCols.length > 0 && (
            <YAxis
              yAxisId="right"
              orientation="right"
              tick={{ fontSize: 12, fill: "#666666" }}
              domain={[config.rightAxisMin ?? "auto", config.rightAxisMax ?? "auto"]}
            />
          )}
          <Tooltip contentStyle={{ borderRadius: 8, border: "1px solid #E5E5E5" }} />
          {config.showLegend && <Legend />}
          {leftCols.map((col, i) => (
            <Bar key={col} yAxisId="left" dataKey={col} fill={COLORS[i % COLORS.length]} radius={[4, 4, 0, 0]} />
          ))}
          {rightCols.map((col, i) => (
            <Bar key={col} yAxisId="right" dataKey={col} fill={COLORS[(leftCols.length + i) % COLORS.length]} radius={[4, 4, 0, 0]} />
          ))}
        </BarChart>
      </ResponsiveContainer>
    );
  }

  // Line chart
  return (
    <ResponsiveContainer width="100%" height={height}>
      <LineChart data={chartData}>
        <CartesianGrid strokeDasharray="3 3" stroke="#E5E5E5" />
        <XAxis dataKey={config.xColumn} tick={{ fontSize: 12, fill: "#666666" }} />
        <YAxis
          yAxisId="left"
          tick={{ fontSize: 12, fill: "#666666" }}
          domain={[config.leftAxisMin ?? "auto", config.leftAxisMax ?? "auto"]}
        />
        {config.dualAxis && rightCols.length > 0 && (
          <YAxis
            yAxisId="right"
            orientation="right"
            tick={{ fontSize: 12, fill: "#666666" }}
            domain={[config.rightAxisMin ?? "auto", config.rightAxisMax ?? "auto"]}
          />
        )}
        <Tooltip contentStyle={{ borderRadius: 8, border: "1px solid #E5E5E5" }} />
        {config.showLegend && <Legend />}
        {leftCols.map((col, i) => (
          <Line
            key={col}
            yAxisId="left"
            type="monotone"
            dataKey={col}
            stroke={COLORS[i % COLORS.length]}
            strokeWidth={2}
            dot={false}
          />
        ))}
        {rightCols.map((col, i) => (
          <Line
            key={col}
            yAxisId="right"
            type="monotone"
            dataKey={col}
            stroke={COLORS[(leftCols.length + i) % COLORS.length]}
            strokeWidth={2}
            dot={false}
            strokeDasharray="5 5"
          />
        ))}
      </LineChart>
    </ResponsiveContainer>
  );
}
