import {
  addDays,
  differenceInDays,
  format,
  isWeekend,
  min,
  parseISO,
} from "date-fns";
// @ts-ignore
import { isHoliday } from "japanese-holidays";
import React, { useEffect, useState } from "react";
import BurndownChart from "./components/BurndownChart";
import IssueList from "./components/IssueList";
import StatsPanel from "./components/StatsPanel";
import VelocityChart from "./components/VelocityChart";
import {
  fetchGitHubProjectData,
  GitHubConfig,
  validateGitHubConfig,
} from "./github-api";

// インターフェース定義
interface Sprint {
  id: string;
  title: string;
  startDate: string | null;
  endDate: string | null;
}

interface Issue {
  id: string;
  title: string;
  state: string;
  storyPoints: number;
  closedAt: string | null;
  createdAt: string;
  assignee: string | null;
  labels: string[];
  sprint: Sprint | null;
}

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

interface VelocityData {
  date: string;
  completedSP: number;
  cumulativeSP: number;
  velocity: number;
}

// 営業日計算のヘルパー関数
const isBusinessDay = (date: Date): boolean => {
  return !isWeekend(date);
};

const isWorkingDay = (date: Date): boolean => {
  return isBusinessDay(date) && !isHoliday(date);
};

const addWorkingDays = (startDate: Date, days: number): Date => {
  let currentDate = new Date(startDate);
  let addedDays = 0;

  while (addedDays < days) {
    currentDate = addDays(currentDate, 1);
    if (isWorkingDay(currentDate)) {
      addedDays++;
    }
  }

  return currentDate;
};

const getWorkingDaysBetween = (startDate: Date, endDate: Date): number => {
  let count = 0;
  let currentDate = new Date(startDate);

  while (currentDate <= endDate) {
    if (isWorkingDay(currentDate)) {
      count++;
    }
    currentDate = addDays(currentDate, 1);
  }

  return count;
};

const calculateWorkingDayVelocity = (
  completedSP: number,
  workingDays: number
): number => {
  return workingDays > 0 ? completedSP / workingDays : 0;
};

const App: React.FC = () => {
  // ローカルストレージから設定を復元
  const loadSavedConfig = (): GitHubConfig | null => {
    try {
      const saved = localStorage.getItem("github-dashboard-config");
      if (saved) {
        const config = JSON.parse(saved);
        // 必要なプロパティが全て存在するかチェック
        if (config.token && config.organization && config.projectNumber) {
          return config;
        }
      }
    } catch (error) {
      console.error("Failed to load saved config:", error);
    }
    return null;
  };

  // 設定をローカルストレージに保存
  const saveConfig = (config: GitHubConfig) => {
    try {
      localStorage.setItem("github-dashboard-config", JSON.stringify(config));
    } catch (error) {
      console.error("Failed to save config:", error);
    }
  };

  // 設定をローカルストレージから削除
  const clearSavedConfig = () => {
    try {
      localStorage.removeItem("github-dashboard-config");
    } catch (error) {
      console.error("Failed to clear saved config:", error);
    }
  };

  const savedConfig = loadSavedConfig();

  const [currentScreen, setCurrentScreen] = useState<"setup" | "dashboard">(
    savedConfig ? "dashboard" : "setup"
  );
  const [githubConfig, setGithubConfig] = useState<GitHubConfig>(
    savedConfig || {
      token: "",
      organization: "",
      projectNumber: 0,
    }
  );

  // セットアップ用の状態
  const [token, setToken] = useState(savedConfig?.token || "");
  const [organization, setOrganization] = useState(
    savedConfig?.organization || ""
  );
  const [projectNumber, setProjectNumber] = useState(
    savedConfig?.projectNumber || 0
  );
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  // ダッシュボード用の状態
  const [issues, setIssues] = useState<Issue[]>([]);
  const [burndownData, setBurndownData] = useState<BurndownData[]>([]);
  const [velocityData, setVelocityData] = useState<VelocityData[]>([]);
  const [sprintStats, setSprintStats] = useState<SprintStats | null>(null);

  // フィルター状態
  const [selectedUser] = useState<string>("all");

  // GitHub接続処理
  const handleConnect = async () => {
    if (!token || !organization || !projectNumber) {
      setError("すべての項目を入力してください");
      return;
    }

    setLoading(true);
    setError("");

    const config: GitHubConfig = {
      token,
      organization,
      projectNumber,
    };

    try {
      await validateGitHubConfig(config);
      setGithubConfig(config);
      saveConfig(config); // 設定を保存
      setCurrentScreen("dashboard");
    } catch (err) {
      setError(err instanceof Error ? err.message : "接続に失敗しました");
    } finally {
      setLoading(false);
    }
  };

  // プロジェクトリセット
  const handleReset = () => {
    setCurrentScreen("setup");
    setGithubConfig({ token: "", organization: "", projectNumber: 0 });
    setToken("");
    setOrganization("");
    setProjectNumber(0);
    setError("");
    setIssues([]);
    setBurndownData([]);
    setVelocityData([]);
    setSprintStats(null);
    clearSavedConfig(); // リセット時にも設定を削除
  };

  // データ取得
  useEffect(() => {
    if (currentScreen === "dashboard") {
      loadProjectData();
    }
  }, [currentScreen, githubConfig]);

  // フィルター変更時の再計算
  useEffect(() => {
    if (issues.length > 0) {
      calculateDashboardData();
    }
  }, [issues, selectedUser]);

  const loadProjectData = async () => {
    setLoading(true);
    try {
      const projectData = await fetchGitHubProjectData(githubConfig);

      console.log("=== Project Data Debug ===");
      console.log("Project Data:", projectData);

      const convertedIssues = projectData.items.nodes.map(
        (item: any): Issue => {
          const storyPointsField = item.fieldValues.nodes.find(
            (field: any) =>
              field.__typename === "ProjectV2ItemFieldNumberValue" &&
              field.field?.name === "Story Points"
          );

          const sprintField = item.fieldValues.nodes.find(
            (field: any) =>
              field.__typename === "ProjectV2ItemFieldIterationValue"
          );

          const assigneeField = item.fieldValues.nodes.find(
            (field: any) => field.__typename === "ProjectV2ItemFieldUserValue"
          );

          return {
            id: item.content.id,
            title: item.content.title,
            state: item.content.state,
            storyPoints: storyPointsField?.number || 0,
            closedAt: item.content.closedAt,
            createdAt: item.content.createdAt,
            assignee: assigneeField?.user?.login || null,
            labels:
              item.content.labels?.nodes?.map((label: any) => label.name) || [],
            sprint: sprintField
              ? {
                  id: sprintField.id || null,
                  title: sprintField.title,
                  startDate: sprintField.startDate || null,
                  endDate: sprintField.endDate || null,
                }
              : null,
          };
        }
      );

      setIssues(convertedIssues);

      const users = [
        ...new Set(
          convertedIssues.map((issue: Issue) => issue.assignee).filter(Boolean)
        ),
      ] as string[];

      console.log("Available users:", users);

    } catch (error) {
      console.error("Failed to fetch project data:", error);
      setError("プロジェクトデータの取得に失敗しました");
    } finally {
      setLoading(false);
    }
  };

  const calculateDashboardData = () => {
    // フィルタリング（ユーザーのみ）
    const filteredIssues = issues.filter((issue) => {
      const userMatch =
        selectedUser === "all" || issue.assignee === selectedUser;
      return userMatch;
    });

    if (filteredIssues.length === 0) {
      setBurndownData([]);
      setVelocityData([]);
      setSprintStats(null);
      return;
    }

    // 統計計算
    const totalStoryPoints = filteredIssues.reduce(
      (sum, issue) => sum + issue.storyPoints,
      0
    );
    const completedIssues = filteredIssues.filter(
      (issue) => issue.state === "CLOSED"
    );
    const completedStoryPoints = completedIssues.reduce(
      (sum, issue) => sum + issue.storyPoints,
      0
    );
    const remainingStoryPoints = totalStoryPoints - completedStoryPoints;
    const completionRate =
      totalStoryPoints > 0
        ? (completedStoryPoints / totalStoryPoints) * 100
        : 0;

    // 期間計算（全体期間）
    const startDate =
      filteredIssues.length > 0
        ? new Date(
            min(filteredIssues.map((issue) => new Date(issue.createdAt)))
          )
        : new Date();
    const endDate = new Date();

    const daysElapsed = differenceInDays(endDate, startDate) + 1;
    const workingDaysElapsed = getWorkingDaysBetween(startDate, endDate);

    // ベロシティ計算（直近14日ベース）
    const today = new Date();
    const recent14Days = addDays(today, -14);
    const recentCompletedSP = filteredIssues
      .filter(
        (issue) =>
          issue.closedAt &&
          new Date(issue.closedAt) >= recent14Days &&
          new Date(issue.closedAt) <= today
      )
      .reduce((sum, issue) => sum + issue.storyPoints, 0);
    const recentWorkingDays = getWorkingDaysBetween(recent14Days, today);
    const recentVelocity = calculateWorkingDayVelocity(
      recentCompletedSP,
      recentWorkingDays
    );

    // 全期間ベロシティ（参考値）
    const velocity = daysElapsed > 0 ? completedStoryPoints / daysElapsed : 0;

    // 予測完了日（条件を満たす場合のみ計算）
    let predictedCompletionDate = "";
    let workingDayCompletionDate = "";

    // 予測完了日を計算する条件：
    // 1. 完了済みチケットが存在する
    // 2. 有効なベロシティ（> 0）が計算できる
    // 3. 残りのストーリーポイントが存在する
    if (
      completedStoryPoints > 0 &&
      recentVelocity > 0 &&
      remainingStoryPoints > 0
    ) {
      const remainingDays =
        velocity > 0 ? Math.ceil(remainingStoryPoints / velocity) : 0;
      const remainingWorkingDays = Math.ceil(
        remainingStoryPoints / recentVelocity
      );

      if (remainingDays > 0) {
        const predictedDate = addDays(endDate, remainingDays);
        predictedCompletionDate = format(predictedDate, "yyyy-MM-dd");
      }

      if (remainingWorkingDays > 0) {
        const workingDayDate = addWorkingDays(today, remainingWorkingDays);
        workingDayCompletionDate = format(workingDayDate, "yyyy-MM-dd");
      }
    }

    const stats: SprintStats = {
      totalStoryPoints,
      completedStoryPoints,
      remainingStoryPoints,
      completionRate,
      velocity,
      workingDayVelocity: recentVelocity,
      daysElapsed,
      workingDaysElapsed,
      predictedCompletionDate,
      workingDayCompletionDate,
    };

    setSprintStats(stats);

    // バーンダウン/バーンアップデータ生成
    generateBurndownData(filteredIssues, stats, startDate);

    // ベロシティデータ生成（常に今日まで）
    const velocityEndDate = new Date(); // 今日まで
    generateVelocityData(filteredIssues, startDate, velocityEndDate);
  };

  const generateBurndownData = (
    filteredIssues: Issue[],
    stats: SprintStats,
    startDate: Date,
  ) => {
    const data: BurndownData[] = [];
    const today = new Date();

    // 表示期間を決定（全体期間）
    const displayStartDate = new Date(startDate);
    const predictedCompletionDateForDisplay = new Date(
      stats.workingDayCompletionDate
    );
    const displayEndDate = addDays(predictedCompletionDateForDisplay, 7);

    // 統計パネルで計算済みの直近14日ベロシティを使用
    const recentVelocity = stats.workingDayVelocity;

    const fixedScope = stats.totalStoryPoints;

    for (
      let date = new Date(displayStartDate);
      date <= displayEndDate;
      date = addDays(date, 1)
    ) {
      const dateStr = format(date, "yyyy-MM-dd");
      const isActual = date <= today;
      const isPrediction = date > today;

      // その日までに完了したSP
      const completedSP = filteredIssues
        .filter((issue) => issue.closedAt && new Date(issue.closedAt) <= date)
        .reduce((sum, issue) => sum + issue.storyPoints, 0);

      // 残りSP（固定スコープベース）
      const remainingSP = fixedScope - completedSP;

      // スコープライン（その日までに追加されたイシューの総SP）
      const scopeAtDate = filteredIssues
        .filter((issue) => new Date(issue.createdAt) <= date)
        .reduce((sum, issue) => sum + issue.storyPoints, 0);

      const dataPoint: BurndownData = {
        date: dateStr,
        remainingStoryPoints: isActual ? remainingSP : null,
        completedStoryPoints: completedSP,
        scopeLine: scopeAtDate,
        isActual,
        isPrediction,
      };

      data.push(dataPoint);
    }

    // 今日の実績値から予測線を開始
    const todayData = data.find(
      (d) =>
        d.isActual &&
        format(parseISO(d.date), "yyyy-MM-dd") === format(today, "yyyy-MM-dd")
    );
    if (todayData) {
      todayData.workingDayPrediction =
        todayData.remainingStoryPoints ?? undefined;
      todayData.burnupWorkingDayPrediction = todayData.completedStoryPoints;
    }

    // 予測完了日を計算（条件を満たす場合のみ計算）
    const currentRemaining =
      todayData?.remainingStoryPoints ?? stats.remainingStoryPoints;
    const currentCompleted =
      todayData?.completedStoryPoints ?? stats.completedStoryPoints;

    // 予測線を描画する条件：
    // 1. 完了済みチケットが存在する
    // 2. 有効なベロシティ（> 0）が計算できる
    // 3. 残りのストーリーポイントが存在する
    if (currentCompleted > 0 && recentVelocity > 0 && currentRemaining > 0) {
      const daysToComplete = Math.ceil(currentRemaining / recentVelocity);
      const predictedCompletionDate = addWorkingDays(today, daysToComplete);

      const futureData = data.filter((d) => d.isPrediction);
      if (predictedCompletionDate) {
        futureData.forEach((item) => {
          const itemDate = parseISO(item.date);

          if (itemDate <= predictedCompletionDate) {
            const workingDaysFromToday = getWorkingDaysBetween(today, itemDate);

            // 直線的な予測
            const predictedRemaining = Math.max(
              0,
              currentRemaining - recentVelocity * workingDaysFromToday
            );
            const predictedCompleted = Math.min(
              fixedScope,
              currentCompleted + recentVelocity * workingDaysFromToday
            );

            item.workingDayPrediction = predictedRemaining;
            item.burnupWorkingDayPrediction = predictedCompleted;
          } else {
            // 完了予定日以降は完了状態
            item.workingDayPrediction = 0;
            item.burnupWorkingDayPrediction = fixedScope;
          }
        });
      }
    }

    setBurndownData(data);
  };

  const generateVelocityData = (
    filteredIssues: Issue[],
    startDate: Date,
    endDate: Date
  ) => {
    const data: VelocityData[] = [];
    let cumulativeSP = 0;

    for (
      let date = new Date(startDate);
      date <= endDate;
      date = addDays(date, 1)
    ) {
      const dateStr = format(date, "yyyy-MM-dd");

      // その日に完了したSP
      const completedSP = filteredIssues
        .filter(
          (issue) =>
            issue.closedAt &&
            format(new Date(issue.closedAt), "yyyy-MM-dd") === dateStr
        )
        .reduce((sum, issue) => sum + issue.storyPoints, 0);

      cumulativeSP += completedSP;

      // 過去7日間の平均ベロシティ
      const weekAgo = addDays(date, -7);
      const weeklyCompletedSP = filteredIssues
        .filter(
          (issue) =>
            issue.closedAt &&
            new Date(issue.closedAt) >= weekAgo &&
            new Date(issue.closedAt) <= date
        )
        .reduce((sum, issue) => sum + issue.storyPoints, 0);
      const velocity = weeklyCompletedSP / 7;

      data.push({
        date: dateStr,
        completedSP,
        cumulativeSP,
        velocity,
      });
    }

    setVelocityData(data);
  };

  if (currentScreen === "setup") {
    return (
      <div className="min-h-screen bg-gray-100 flex items-center justify-center">
        <div className="max-w-md w-full mx-auto p-6 bg-white rounded-lg shadow-md">
          <h1 className="text-2xl font-bold mb-6 text-center">
            GitHub Projects ダッシュボード
          </h1>
          <div className="space-y-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                GitHub Token
              </label>
              <input
                type="password"
                value={token}
                onChange={(e) => setToken(e.target.value)}
                placeholder="ghp_..."
                className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Organization Name
              </label>
              <input
                type="text"
                value={organization}
                onChange={(e) => setOrganization(e.target.value)}
                placeholder="your-org"
                className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Project Number
              </label>
              <input
                type="number"
                value={projectNumber}
                onChange={(e) => setProjectNumber(Number(e.target.value))}
                placeholder="1"
                className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
              />
            </div>
            <button
              onClick={handleConnect}
              disabled={!token || !organization || !projectNumber || loading}
              className="w-full bg-blue-600 text-white py-2 px-4 rounded-md hover:bg-blue-700 disabled:bg-gray-400 disabled:cursor-not-allowed"
            >
              {loading ? "接続中..." : "接続"}
            </button>
            {error && (
              <div className="text-red-600 text-sm text-center">{error}</div>
            )}
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-100">
      <div className="max-w-7xl mx-auto px-4 py-8">
        {/* ヘッダー */}
        <div className="flex justify-between items-center mb-8">
          <div>
            <h1 className="text-3xl font-bold text-gray-900">
              プロジェクト進捗ダッシュボード
            </h1>
            <div className="text-sm text-gray-600 mt-2">
              {githubConfig.organization}/Project#{githubConfig.projectNumber}
              <span className="ml-2 text-xs">
                (Token: {githubConfig.token.substring(0, 8)}...)
              </span>
            </div>
          </div>
          <button
            onClick={handleReset}
            className="px-4 py-2 bg-gray-600 text-white rounded hover:bg-gray-700"
          >
            プロジェクトリセット
          </button>
        </div>

        {loading && (
          <div className="text-center py-8">
            <div className="text-lg">読み込み中...</div>
          </div>
        )}

        {!loading && sprintStats && (
          <>
            {/* フィルター */}

            {/* 統計パネル */}
            <StatsPanel
              stats={sprintStats}
              selectedSprint="all"
              selectedSprintInfo={null}
            />

            {/* チャートグリッド */}
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-8 mb-8">
              {/* バーンダウンチャート */}
              <BurndownChart
                data={burndownData}
                title="バーンダウン（営業日ベース）"
                type="burndown"
              />

              {/* バーンアップチャート */}
              <BurndownChart
                data={burndownData}
                title="バーンアップ（営業日ベース）"
                type="burnup"
              />
            </div>

            {/* ベロシティ分析 */}
            <VelocityChart data={velocityData} />

            {/* イシューリスト */}
            <IssueList
              issues={issues}
              selectedSprint="all"
              selectedUser={selectedUser}
              totalStoryPoints={sprintStats.totalStoryPoints}
            />
          </>
        )}

        {!loading && !sprintStats && (
          <div className="text-center py-8">
            <div className="text-gray-500">
              データがありません。フィルターを調整してください。
            </div>
          </div>
        )}
      </div>
    </div>
  );
};

export default App;
