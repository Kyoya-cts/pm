import { format } from "date-fns";
import React from "react";
import {
  CartesianGrid,
  Legend,
  Line,
  LineChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";

interface BurndownData {
  date: string;
  remainingStoryPoints: number | null;
  completedStoryPoints: number;
  idealLine?: number;
  scopeLine: number;
  workingDayPrediction?: number;
  burnupWorkingDayPrediction?: number;
  isActual: boolean;
  isPrediction: boolean;
}

interface BurndownChartProps {
  data: BurndownData[];
  title: string;
  type: "burndown" | "burnup";
}

const BurndownChart: React.FC<BurndownChartProps> = ({ data, title, type }) => {
  return (
    <div className="bg-white rounded-lg shadow p-6">
      <h3 className="text-lg font-semibold mb-4">{title}</h3>
      <div className="h-80">
        <ResponsiveContainer width="100%" height="100%">
          <LineChart data={data}>
            <CartesianGrid strokeDasharray="3 3" />
            <XAxis
              dataKey="date"
              tickFormatter={(date) => format(new Date(date), "M/d")}
            />
            <YAxis />
            <Tooltip
              labelFormatter={(date) => format(new Date(date), "yyyy年M月d日")}
              formatter={(value: any, name: string) => [
                typeof value === "number" ? value.toFixed(1) : value,
                name,
              ]}
            />
            <Legend />

            {/* スコープライン */}
            <Line
              type="monotone"
              dataKey="scopeLine"
              stroke="#6b7280"
              strokeWidth={2}
              name="スコープ"
              dot={false}
            />

            {type === "burndown" ? (
              <>
                {/* 実績残りSP */}
                <Line
                  type="monotone"
                  dataKey="remainingStoryPoints"
                  stroke="#ef4444"
                  strokeWidth={3}
                  name="実績残りSP"
                  dot={false}
                  connectNulls={false}
                />

                {/* 営業日予測 */}
                <Line
                  type="monotone"
                  dataKey="workingDayPrediction"
                  stroke="#3b82f6"
                  strokeWidth={2}
                  strokeDasharray="5 5"
                  name="営業日予測"
                  dot={false}
                  connectNulls={true}
                />
              </>
            ) : (
              <>
                {/* 実績完了SP */}
                <Line
                  type="monotone"
                  dataKey="completedStoryPoints"
                  stroke="#10b981"
                  strokeWidth={3}
                  name="実績完了SP"
                  dot={false}
                />

                {/* 営業日予測 */}
                <Line
                  type="monotone"
                  dataKey="burnupWorkingDayPrediction"
                  stroke="#8b5cf6"
                  strokeWidth={2}
                  strokeDasharray="5 5"
                  name="営業日予測"
                  dot={false}
                  connectNulls={true}
                />
              </>
            )}
          </LineChart>
        </ResponsiveContainer>
      </div>
    </div>
  );
};

export default BurndownChart;
