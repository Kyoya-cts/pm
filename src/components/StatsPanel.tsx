import { format } from "date-fns";
import React from "react";

interface Sprint {
  id: string;
  title: string;
  startDate: string | null;
  endDate: string | null;
}

interface SprintStats {
  totalStoryPoints: number;
  completedStoryPoints: number;
  remainingStoryPoints: number;
  completionRate: number;
  velocity: number;
  workingDayVelocity: number;
  daysElapsed: number;
  workingDaysElapsed: number;
  predictedCompletionDate: string;
  workingDayCompletionDate: string;
}

interface StatsPanelProps {
  stats: SprintStats;
  selectedSprint: string;
  selectedSprintInfo: Sprint | null | undefined;
}

const StatsPanel: React.FC<StatsPanelProps> = ({
  stats,
  selectedSprint,
  selectedSprintInfo,
}) => {
  return (
    <div className="space-y-4 mb-8">
      {/* スプリント期間情報 */}
      {selectedSprint !== "all" &&
        selectedSprintInfo?.startDate &&
        selectedSprintInfo?.endDate && (
          <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
            <div className="text-sm font-medium text-blue-800 mb-2">
              📅 スプリント期間: {selectedSprint}
            </div>
            <div className="text-sm text-blue-600">
              {format(new Date(selectedSprintInfo.startDate), "yyyy年M月d日")}{" "}
              〜 {format(new Date(selectedSprintInfo.endDate), "yyyy年M月d日")}
            </div>
          </div>
        )}

      {/* 統計情報 */}
      <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-8 gap-4">
        <div className="bg-white rounded-lg shadow p-4">
          <div className="text-xs text-gray-500 uppercase tracking-wide">
            総SP
          </div>
          <div className="text-2xl font-bold text-gray-900">
            {stats.totalStoryPoints}
          </div>
        </div>
        <div className="bg-white rounded-lg shadow p-4">
          <div className="text-xs text-gray-500 uppercase tracking-wide">
            完了SP
          </div>
          <div className="text-2xl font-bold text-green-600">
            {stats.completedStoryPoints}
          </div>
        </div>
        <div className="bg-white rounded-lg shadow p-4">
          <div className="text-xs text-gray-500 uppercase tracking-wide">
            残りSP
          </div>
          <div className="text-2xl font-bold text-orange-600">
            {stats.remainingStoryPoints}
          </div>
        </div>
        <div className="bg-white rounded-lg shadow p-4">
          <div className="text-xs text-gray-500 uppercase tracking-wide">
            完了率
          </div>
          <div className="text-2xl font-bold text-blue-600">
            {stats.completionRate.toFixed(1)}%
          </div>
        </div>
        <div className="bg-white rounded-lg shadow p-4">
          <div className="text-xs text-gray-500 uppercase tracking-wide">
            営業日ベロシティ
          </div>
          <div className="text-2xl font-bold text-purple-600">
            {stats.workingDayVelocity.toFixed(2)}
          </div>
          <div className="text-xs text-gray-500">SP/営業日</div>
        </div>
        <div className="bg-white rounded-lg shadow p-4">
          <div className="text-xs text-gray-500 uppercase tracking-wide">
            経過日数
          </div>
          <div className="text-2xl font-bold text-indigo-600">
            {stats.workingDaysElapsed}
          </div>
          <div className="text-xs text-gray-500">営業日</div>
        </div>
        <div className="bg-white rounded-lg shadow p-4 col-span-2">
          <div className="text-xs text-gray-500 uppercase tracking-wide">
            予測完了日
          </div>
          <div className="text-lg font-bold text-red-600">
            {stats.workingDayCompletionDate ? (
              stats.workingDayCompletionDate
            ) : (
              <span className="text-gray-400">計算できません</span>
            )}
          </div>
          <div className="text-xs text-gray-500">
            {stats.workingDayCompletionDate
              ? "営業日ベース"
              : "完了済みチケットが必要"}
          </div>
        </div>
      </div>
    </div>
  );
};

export default StatsPanel;
