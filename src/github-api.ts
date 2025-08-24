interface GitHubProjectItem {
  id: string;
  content?: {
    __typename: string;
    title: string;
    state: string;
    createdAt: string;
    closedAt?: string;
    labels?: {
      nodes: Array<{
        name: string;
        color: string;
      }>;
    };
    assignees?: {
      nodes: Array<{
        login: string;
        avatarUrl: string;
      }>;
    };
  };
  fieldValues: {
    nodes: Array<{
      __typename: string;
      name?: string;
      text?: string;
      date?: string;
      title?: string;
      startDate?: string;
      duration?: number;
      number?: number;
      field?: {
        name: string;
      };
    }>;
  };
}

export interface Sprint {
  id: string;
  title: string;
  startDate: string;
  endDate: string;
  duration: number;
}

export interface User {
  login: string;
  avatarUrl: string;
}

export interface ProjectData {
  id: string;
  title: string;
  items: {
    nodes: GitHubProjectItem[];
  };
}

export interface EnhancedIssue {
  id: number;
  title: string;
  state: "open" | "closed";
  created_at: string;
  closed_at?: string;
  labels: { name: string; color: string }[];
  assignee?: {
    login: string;
    avatar_url: string;
  };
  sprint?: Sprint;
  storyPoints: number;
  addedToSprintDate?: string;
}

export interface GitHubConfig {
  token: string;
  organization: string;
  projectNumber: number;
}

const GITHUB_GRAPHQL_QUERY = `
  query($org: String!, $projectNumber: Int!, $after: String) {
    organization(login: $org) {
      projectV2(number: $projectNumber) {
        id
        title
        items(first: 100, after: $after) {
          pageInfo {
            hasNextPage
            endCursor
          }
          nodes {
            id
            content {
              __typename
              ... on Issue {
                title
                state
                createdAt
                closedAt
                labels(first: 10) {
                  nodes {
                    name
                    color
                  }
                }
                assignees(first: 5) {
                  nodes {
                    login
                    avatarUrl
                  }
                }
              }
              ... on PullRequest {
                title
                state
                createdAt
                closedAt
                labels(first: 10) {
                  nodes {
                    name
                    color
                  }
                }
                assignees(first: 5) {
                  nodes {
                    login
                    avatarUrl
                  }
                }
              }
            }
            fieldValues(first: 20) {
              nodes {
                __typename
                ... on ProjectV2ItemFieldTextValue {
                  text
                  field {
                    ... on ProjectV2FieldCommon {
                      name
                    }
                  }
                }
                ... on ProjectV2ItemFieldDateValue {
                  date
                  field {
                    ... on ProjectV2FieldCommon {
                      name
                    }
                  }
                }
                ... on ProjectV2ItemFieldSingleSelectValue {
                  name
                  field {
                    ... on ProjectV2FieldCommon {
                      name
                    }
                  }
                }
                ... on ProjectV2ItemFieldIterationValue {
                  title
                  startDate
                  duration
                  field {
                    ... on ProjectV2FieldCommon {
                      name
                    }
                  }
                }
                ... on ProjectV2ItemFieldNumberValue {
                  number
                  field {
                    ... on ProjectV2FieldCommon {
                      name
                    }
                  }
                }
              }
            }
          }
        }
      }
    }
  }
`;

export async function fetchGitHubProjectData(
  config: GitHubConfig
): Promise<ProjectData> {
  try {
    let allItems: any[] = [];
    let hasNextPage = true;
    let endCursor: string | null = null;
    let projectId = "";
    let projectTitle = "";

    // ページングを使って全てのアイテムを取得
    while (hasNextPage) {
      const response = await fetch("https://api.github.com/graphql", {
        method: "POST",
        headers: {
          Authorization: `Bearer ${config.token}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          query: GITHUB_GRAPHQL_QUERY,
          variables: {
            org: config.organization,
            projectNumber: config.projectNumber,
            after: endCursor,
          },
        }),
      });

      if (!response.ok) {
        throw new Error(
          `GitHub API request failed: ${response.status} ${response.statusText}`
        );
      }

      const data = await response.json();

      if (data.errors) {
        throw new Error(`GraphQL errors: ${JSON.stringify(data.errors)}`);
      }

      if (!data.data?.organization?.projectV2) {
        throw new Error("Project not found or access denied");
      }

      const project = data.data.organization.projectV2;
      const items = project.items;

      // 最初のページでプロジェクト情報を保存
      if (endCursor === null) {
        projectId = project.id;
        projectTitle = project.title;
      }

      // アイテムを配列に追加
      allItems = allItems.concat(items.nodes);

      // ページング情報を更新
      hasNextPage = items.pageInfo.hasNextPage;
      endCursor = items.pageInfo.endCursor;

      // レート制限を避けるために少し待機
      if (hasNextPage) {
        await new Promise((resolve) => setTimeout(resolve, 100));
      }
    }

    // 全てのアイテムを含むProjectDataを返す
    return {
      id: projectId,
      title: projectTitle,
      items: {
        nodes: allItems,
      },
    };
  } catch (error) {
    console.error("Error fetching GitHub project data:", error);
    throw error;
  }
}

export async function validateGitHubConfig(
  config: GitHubConfig
): Promise<{ isValid: boolean; projectTitle?: string; error?: string }> {
  try {
    const projectData = await fetchGitHubProjectData(config);
    return {
      isValid: true,
      projectTitle: projectData.title,
    };
  } catch (error) {
    return {
      isValid: false,
      error: error instanceof Error ? error.message : "Unknown error",
    };
  }
}

export function convertToIssueFormat(
  projectData: ProjectData
): EnhancedIssue[] {
  // itemsが配列でない場合の対処
  const items = projectData.items?.nodes || [];

  if (!Array.isArray(items)) {
    console.error("Items is not an array:", items);
    return [];
  }

  return items
    .filter(
      (item) =>
        item.content &&
        (item.content.__typename === "Issue" ||
          item.content.__typename === "PullRequest")
    )
    .map((item, index) => {
      const content = item.content!;

      // プロジェクトのカスタムフィールドからステータスを取得
      const statusField = item.fieldValues.nodes.find(
        (field) =>
          field.__typename === "ProjectV2ItemFieldSingleSelectValue" &&
          field.name &&
          ["Status", "ステータス", "状態", "done", "completed", "完了"].some(
            (name) =>
              field.name?.toLowerCase().includes(name.toLowerCase()) ||
              field.field?.name?.toLowerCase().includes(name.toLowerCase())
          )
      );

      // スプリント情報を取得
      const iterationField = item.fieldValues.nodes.find(
        (field) => field.__typename === "ProjectV2ItemFieldIterationValue"
      );

      // ストーリーポイントを取得
      const storyPointsField = item.fieldValues.nodes.find(
        (field) =>
          field.__typename === "ProjectV2ItemFieldNumberValue" &&
          field.field?.name &&
          ["Story Points", "ストーリーポイント", "SP", "Points", "Point"].some(
            (name) =>
              field.field?.name?.toLowerCase().includes(name.toLowerCase())
          )
      );

      let sprint: Sprint | undefined;
      if (iterationField && iterationField.title && iterationField.startDate) {
        // startDate + duration = endDate として計算
        const startDate = new Date(iterationField.startDate);
        const duration = iterationField.duration || 11; // デフォルト11日間

        console.log("=== Sprint Duration Debug ===");
        console.log("Sprint:", iterationField.title);
        console.log("Start Date:", iterationField.startDate);
        console.log("Duration from API:", iterationField.duration);
        console.log("Duration used:", duration);

        const endDate = new Date(startDate);
        endDate.setDate(startDate.getDate() + duration);

        console.log("Calculated End Date:", endDate.toISOString());

        sprint = {
          id: iterationField.title,
          title: iterationField.title,
          startDate: iterationField.startDate,
          endDate: endDate.toISOString(),
          duration: duration,
        };
      }

      // ステータスの判定（GitHub Issueのstateまたはプロジェクトのカスタムフィールドから）
      const isDone =
        content.state === "CLOSED" ||
        statusField?.name?.toLowerCase().includes("done") ||
        statusField?.name?.toLowerCase().includes("完了") ||
        statusField?.name?.toLowerCase().includes("closed") ||
        statusField?.name?.toLowerCase().includes("completed");

      // ストーリーポイント（デフォルトは1）
      const storyPoints = storyPointsField?.number || 1;

      // スプリントに追加された日時（イテレーションフィールドの追加日時と仮定）
      const addedToSprintDate = sprint ? content.createdAt : undefined;

      return {
        id: index + 1,
        title: content.title,
        state: isDone ? ("closed" as const) : ("open" as const),
        created_at: content.createdAt,
        closed_at:
          content.closedAt || (isDone ? new Date().toISOString() : undefined),
        labels:
          content.labels?.nodes.map((label) => ({
            name: label.name,
            color: label.color,
          })) || [],
        assignee: content.assignees?.nodes[0]
          ? {
              login: content.assignees.nodes[0].login,
              avatar_url: content.assignees.nodes[0].avatarUrl,
            }
          : undefined,
        sprint,
        storyPoints,
        addedToSprintDate,
      };
    });
}

export function extractSprintsFromIssues(issues: EnhancedIssue[]): Sprint[] {
  const sprintMap = new Map<string, Sprint>();

  issues.forEach((issue) => {
    if (issue.sprint) {
      sprintMap.set(issue.sprint.id, issue.sprint);
    }
  });

  return Array.from(sprintMap.values()).sort(
    (a, b) => new Date(a.startDate).getTime() - new Date(b.startDate).getTime()
  );
}

export function extractUsersFromIssues(issues: EnhancedIssue[]): User[] {
  const userMap = new Map<string, User>();

  issues.forEach((issue) => {
    if (issue.assignee) {
      userMap.set(issue.assignee.login, {
        login: issue.assignee.login,
        avatarUrl: issue.assignee.avatar_url,
      });
    }
  });

  return Array.from(userMap.values()).sort((a, b) =>
    a.login.localeCompare(b.login)
  );
}
