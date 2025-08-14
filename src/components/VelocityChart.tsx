import { format } from "date-fns";
import React from "react";
import {
  Bar,
  CartesianGrid,
  ComposedChart,
  Legend,
  Line,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";

interface VelocityData {
  date: string;
  completedSP: number;
  cumulativeSP: number;
  velocity: number;
}

interface VelocityChartProps {
  data: VelocityData[];
}

const VelocityChart: React.FC<VelocityChartProps> = ({ data }) => {
  return (
    <div className="bg-white rounded-lg shadow p-6 mb-8">
      <h3 className="text-lg font-semibold mb-4">ベロシティ分析</h3>
      <div className="h-80">
        <ResponsiveContainer width="100%" height="100%">
          <ComposedChart data={data}>
            <CartesianGrid strokeDasharray="3 3" />
            <XAxis
              dataKey="date"
              tickFormatter={(date) => format(new Date(date), "M/d")}
            />
            <YAxis yAxisId="left" />
            <YAxis yAxisId="right" orientation="right" />
            <Tooltip
              labelFormatter={(date) => format(new Date(date), "yyyy年M月d日")}
              formatter={(value: any, name: string) => [
                typeof value === "number" ? value.toFixed(1) : value,
                name,
              ]}
            />
            <Legend />

            {/* 日毎完了SP（バー） */}
            <Bar
              yAxisId="left"
              dataKey="completedSP"
              fill="#10b981"
              name="日毎完了SP"
              opacity={0.7}
            />

            {/* 累積完了SP（ライン） */}
            <Line
              yAxisId="right"
              type="monotone"
              dataKey="cumulativeSP"
              stroke="#3b82f6"
              strokeWidth={2}
              name="累積完了SP"
              dot={false}
            />

            {/* 7日平均ベロシティ（ライン） */}
            <Line
              yAxisId="left"
              type="monotone"
              dataKey="velocity"
              stroke="#f59e0b"
              strokeWidth={2}
              name="7日平均ベロシティ"
              dot={false}
            />
          </ComposedChart>
        </ResponsiveContainer>
      </div>
    </div>
  );
};

export default VelocityChart;
