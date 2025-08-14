import { format } from "date-fns";
import React from "react";

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

interface IssueListProps {
  issues: Issue[];
  selectedSprint: string;
  selectedUser: string;
  totalStoryPoints: number;
}

const IssueList: React.FC<IssueListProps> = ({
  issues,
  selectedSprint,
  selectedUser,
  totalStoryPoints,
}) => {
  const filteredIssues = issues.filter((issue) => {
    const sprintMatch =
      selectedSprint === "all" || issue.sprint?.title === selectedSprint;
    const userMatch = selectedUser === "all" || issue.assignee === selectedUser;
    return sprintMatch && userMatch;
  });

  return (
    <div className="bg-white rounded-lg shadow p-6">
      <h3 className="text-lg font-semibold mb-4">
        イシューリスト ({filteredIssues.length}件 / 総{totalStoryPoints}SP)
      </h3>
      <div className="overflow-x-auto">
        <table className="min-w-full text-sm">
          <thead>
            <tr className="border-b">
              <th className="px-4 py-2 text-left">タイトル</th>
              <th className="px-4 py-2 text-left">ステータス</th>
              <th className="px-4 py-2 text-left">担当者</th>
              <th className="px-4 py-2 text-left">スプリント</th>
              <th className="px-4 py-2 text-left">SP</th>
              <th className="px-4 py-2 text-left">作成日</th>
              <th className="px-4 py-2 text-left">完了日</th>
            </tr>
          </thead>
          <tbody>
            {filteredIssues.map((issue) => (
              <tr key={issue.id} className="border-b hover:bg-gray-50">
                <td className="px-4 py-2">
                  <div className="font-medium">{issue.title}</div>
                  <div className="text-xs text-gray-500">
                    {issue.labels.map((label) => (
                      <span
                        key={label}
                        className="inline-block bg-gray-200 rounded px-2 py-1 mr-1"
                      >
                        {label}
                      </span>
                    ))}
                  </div>
                </td>
                <td className="px-4 py-2">
                  <span
                    className={`inline-block px-2 py-1 rounded text-xs font-medium ${
                      issue.state === "CLOSED"
                        ? "bg-green-100 text-green-800"
                        : "bg-blue-100 text-blue-800"
                    }`}
                  >
                    {issue.state === "CLOSED" ? "完了" : "進行中"}
                  </span>
                </td>
                <td className="px-4 py-2">{issue.assignee || "-"}</td>
                <td className="px-4 py-2">{issue.sprint?.title || "-"}</td>
                <td className="px-4 py-2 font-mono">{issue.storyPoints}</td>
                <td className="px-4 py-2">
                  {format(new Date(issue.createdAt), "yyyy-MM-dd")}
                </td>
                <td className="px-4 py-2">
                  {issue.closedAt
                    ? format(new Date(issue.closedAt), "yyyy-MM-dd")
                    : "-"}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
};

export default IssueList;
