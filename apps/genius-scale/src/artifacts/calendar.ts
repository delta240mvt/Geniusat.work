import {
  ScaleCalendarSchema,
  type CalendarRunSummary,
  type ContentAsset,
  type ContentItem,
  type ProjectConfig,
  type ScaleCalendar,
} from '../config/schema.js';

export type LatestRunSummaries = CalendarRunSummary[];

const bodyPreview = (body: string): string => (body.length <= 120 ? body : `${body.slice(0, 117)}...`);

const calendarAssets = (assets: ContentAsset[]) =>
  assets.map(({id, type, localPath, publicUrl, altText}) => ({
    id,
    type,
    ...(localPath ? {localPath} : {}),
    ...(publicUrl ? {publicUrl} : {}),
    ...(altText ? {altText} : {}),
  }));

export const buildCalendar = (
  items: ContentItem[],
  projects: ProjectConfig[],
  latestRuns: LatestRunSummaries = [],
  generatedAt = new Date().toISOString(),
): ScaleCalendar => {
  const projectsById = new Map(projects.map((project) => [project.projectId, project]));
  const latestRunsByItemId = new Map(latestRuns.map((run) => [run.itemId, run]));

  return ScaleCalendarSchema.parse({
    generatedAt,
    entries: [...items]
      .sort((left, right) => left.scheduledAt.localeCompare(right.scheduledAt) || left.id.localeCompare(right.id))
      .map((item) => {
        const project = projectsById.get(item.projectId);
        if (!project) {
          throw new Error(`Missing project config for content item ${item.id}: ${item.projectId}`);
        }

        return {
          id: item.id,
          projectId: item.projectId,
          projectName: project.name,
          platforms: item.platforms.threads ? ['threads'] : [],
          scheduledAt: item.scheduledAt,
          timezone: project.timezone,
          status: item.status,
          title: item.title,
          bodyPreview: bodyPreview(item.body),
          source: item.source,
          assets: calendarAssets(item.assets),
          ...(latestRunsByItemId.get(item.id) ? {latestRun: latestRunsByItemId.get(item.id)} : {}),
        };
      }),
  });
};

export const renderCalendarMarkdown = (calendar: ScaleCalendar): string => {
  const lines = ['# Genius@Scale Calendar', '', `Generated: ${calendar.generatedAt}`, '', '| Scheduled At | Project | Item | Status | Latest Run |', '| --- | --- | --- | --- | --- |'];

  for (const entry of calendar.entries) {
    const latestRun = entry.latestRun ? `${entry.latestRun.type}:${entry.latestRun.status}` : '';
    lines.push(`| ${entry.scheduledAt} | ${entry.projectName} | ${entry.id} - ${entry.title} | ${entry.status} | ${latestRun} |`);
  }

  return `${lines.join('\n')}\n`;
};
