import {fileURLToPath} from 'node:url';
import {mkdir, writeFile} from 'node:fs/promises';
import path from 'node:path';
import {writeDeterministicJson} from '../artifacts/json.js';
import {buildCalendar, renderCalendarMarkdown} from '../artifacts/calendar.js';
import {createScalePaths} from '../artifacts/paths.js';
import {redactArtifactSecrets, redactArtifactValue} from '../artifacts/redaction.js';
import {listLatestRunSummaries, writeRunArtifact, type RunArtifact} from '../artifacts/runs.js';
import {loadContentItemsFromFile, loadProjectFromFile} from '../config/loaders.js';
import {prepareContentItems} from '../content/normalize.js';
import {validateForThreadsDryRun} from '../content/validation.js';
import type {ContentHistoryEvent, ContentItem, ProjectConfig} from '../config/schema.js';
import {createThreadsClient, type ThreadsFetch} from '../threads/client.js';
import {buildThreadsDryRunPayload} from '../threads/payload.js';
import {publishContentItem} from '../threads/publish.js';
import {composioUserId, loadWorkspaceEnv, resolveEnvSecret} from '../utils/env.js';
import {ComposioClient, publishThroughComposio} from '../composio.js';

export interface CliDependencies {
  fetch?: ThreadsFetch;
  fetchImpl?: ThreadsFetch;
}

const helpMessage = `Genius@Scale CLI

Commands:
  prepare
  calendar
  dry-run
  publish
  check:threads
  composio:capabilities
  composio:connections
  composio:connect --auth-config-id <id>`;

interface CliOptions {
  projectFile?: string;
  contentFile?: string;
  outputRoot?: string;
  item?: string;
  provider?: 'composio';
  actionSlug?: string;
  connectionId?: string;
  authConfigId?: string;
  alias?: string;
}

const parseArgs = (argv: string[]): {command?: string; options: CliOptions} => {
  const [command, ...args] = argv;
  const options: CliOptions = {};

  for (let index = 0; index < args.length; index += 1) {
    const arg = args[index];
    const value = args[index + 1];

    if (!arg.startsWith('--')) {
      throw new Error(`Unexpected argument: ${arg}`);
    }

    if (!value || value.startsWith('--')) {
      throw new Error(`${arg} requires a value`);
    }

    index += 1;

    if (arg === '--project-file') {
      options.projectFile = value;
    } else if (arg === '--content-file') {
      options.contentFile = value;
    } else if (arg === '--output-root') {
      options.outputRoot = value;
    } else if (arg === '--item') {
      options.item = value;
    } else if (arg === '--provider') {
      if (value !== 'composio') throw new Error('provider must be composio');
      options.provider = 'composio';
    } else if (arg === '--action-slug') {
      options.actionSlug = value;
    } else if (arg === '--connection-id') {
      options.connectionId = value;
    } else if (arg === '--auth-config-id') {
      options.authConfigId = value;
    } else if (arg === '--alias') {
      options.alias = value;
    } else {
      throw new Error(`Unknown option: ${arg}`);
    }
  }

  return {command, options};
};

const requireOption = (options: CliOptions, key: keyof CliOptions, command: string): string => {
  const value = options[key];
  if (!value) {
    throw new Error(`${command} requires --${key.replace(/[A-Z]/g, (letter) => `-${letter.toLowerCase()}`)} <path>`);
  }
  return value;
};

const composioClientFromEnv = (): ComposioClient => {
  const apiKey = resolveEnvSecret('COMPOSIO_API_KEY');
  if (!apiKey) throw new Error('Missing COMPOSIO_API_KEY.');
  const userId = composioUserId();
  return new ComposioClient({apiKey, userId, baseUrl: process.env.COMPOSIO_BASE_URL});
};

const runComposioCapabilities = async (): Promise<string> => {
  loadWorkspaceEnv();
  return JSON.stringify(await composioClientFromEnv().listPublishingCapabilities(), null, 2);
};

const runComposioConnections = async (): Promise<string> => {
  loadWorkspaceEnv();
  return JSON.stringify(await composioClientFromEnv().listConnections(), null, 2);
};

const runComposioConnect = async (options: CliOptions): Promise<string> => {
  loadWorkspaceEnv();
  const authConfigId = requireOption(options, 'authConfigId', 'composio:connect');
  const result = await composioClientFromEnv().createConnectLink({authConfigId, alias: options.alias});
  return result.redirectUrl;
};

const writeCalendarArtifacts = async (
  paths: ReturnType<typeof createScalePaths>,
  items: ContentItem[],
  projects: ProjectConfig[],
): Promise<void> => {
  const latestRuns = await listLatestRunSummaries(paths);
  const calendar = buildCalendar(items, projects, latestRuns);
  const redactedCalendar = redactArtifactValue(calendar) as typeof calendar;
  await writeDeterministicJson(paths.calendarFile, redactedCalendar);
  await mkdir(path.dirname(paths.calendarMarkdownFile), {recursive: true});
  await writeFile(paths.calendarMarkdownFile, renderCalendarMarkdown(redactedCalendar), 'utf8');
};

const appendEvent = (item: ContentItem, event: ContentHistoryEvent): ContentItem => ({
  ...item,
  history: [...item.history, event],
});

const validateItemsBelongToProject = (items: ContentItem[], project: ProjectConfig): void => {
  const mismatchedItem = items.find((item) => item.projectId !== project.projectId);

  if (mismatchedItem) {
    throw new Error(
      `Content item ${mismatchedItem.id} belongs to project ${mismatchedItem.projectId} but project file is ${project.projectId}`,
    );
  }
};

const runPrepare = async (options: CliOptions): Promise<string> => {
  const contentFile = requireOption(options, 'contentFile', 'prepare');
  const paths = createScalePaths({outputRoot: options.outputRoot});
  const preparedItems = prepareContentItems(await loadContentItemsFromFile(contentFile));
  await writeDeterministicJson(paths.preparedItemsFile, redactArtifactValue(preparedItems));
  return `Prepared ${preparedItems.length} item(s).`;
};

const runCalendar = async (options: CliOptions): Promise<string> => {
  const contentFile = requireOption(options, 'contentFile', 'calendar');
  const projectFile = requireOption(options, 'projectFile', 'calendar');
  const paths = createScalePaths({outputRoot: options.outputRoot});
  const items = await loadContentItemsFromFile(contentFile);
  const project = await loadProjectFromFile(projectFile);

  await writeCalendarArtifacts(paths, items, [project]);

  return `Wrote calendar for ${items.length} item(s).`;
};

const dryRunItem = async (
  paths: ReturnType<typeof createScalePaths>,
  item: ContentItem,
  project: ProjectConfig,
  createdAt: string,
): Promise<ContentItem> => {
  const validation = validateForThreadsDryRun(item, project);
  const status = validation.ok ? 'ok' : 'failed';
  const message = validation.ok ? 'Dry run validation passed.' : 'Dry run validation failed.';
  const dryRunPayload = validation.ok ? buildThreadsDryRunPayload(item) : undefined;
  const redactedDryRunPayload = dryRunPayload
    ? (redactArtifactSecrets(dryRunPayload) as ReturnType<typeof buildThreadsDryRunPayload>)
    : undefined;
  const artifact: RunArtifact = {
    itemId: item.id,
    type: 'dry_run',
    status,
    createdAt,
    message,
    validation,
    ...(redactedDryRunPayload
      ? {
          payload: redactedDryRunPayload,
          payloads: [...redactedDryRunPayload.requests, redactedDryRunPayload.publish],
        }
      : {}),
    summary: {
      title: item.title,
      scheduledAt: item.scheduledAt,
    },
  };
  const artifactPath = await writeRunArtifact(paths, artifact);

  return appendEvent(
    {
      ...item,
      status: validation.ok ? 'dry_run_ok' : 'validation_failed',
    },
    {
      type: 'dry_run',
      status,
      message,
      artifactPath,
      createdAt,
    },
  );
};

const runDryRun = async (options: CliOptions): Promise<string> => {
  const contentFile = requireOption(options, 'contentFile', 'dry-run');
  const projectFile = requireOption(options, 'projectFile', 'dry-run');
  const paths = createScalePaths({outputRoot: options.outputRoot});
  const project = await loadProjectFromFile(projectFile);
  const createdAt = new Date().toISOString();
  const preparedItems = prepareContentItems(await loadContentItemsFromFile(contentFile), createdAt);
  validateItemsBelongToProject(preparedItems, project);

  const selectedItems = options.item ? preparedItems.filter((item) => item.id === options.item) : preparedItems;

  if (options.item && selectedItems.length === 0) {
    throw new Error(`Content item not found: ${options.item}`);
  }

  const dryRunItems = await Promise.all(
    preparedItems.map(async (item) => {
      if (options.item && item.id !== options.item) {
        return item;
      }

      return dryRunItem(paths, item, project, createdAt);
    }),
  );

  await writeDeterministicJson(paths.preparedItemsFile, redactArtifactValue(dryRunItems));
  await writeCalendarArtifacts(paths, dryRunItems, [project]);

  return `Dry-run completed for ${options.item ? 1 : dryRunItems.length} item(s).`;
};

const runPublish = async (options: CliOptions, dependencies: CliDependencies): Promise<string> => {
  const selectedItemId = options.item;

  if (!selectedItemId) {
    throw new Error('publish requires --item <id>');
  }

  const contentFile = requireOption(options, 'contentFile', 'publish');
  const projectFile = requireOption(options, 'projectFile', 'publish');

  loadWorkspaceEnv();

  const paths = createScalePaths({outputRoot: options.outputRoot});
  const project = await loadProjectFromFile(projectFile);
  const items = await loadContentItemsFromFile(contentFile);
  validateItemsBelongToProject(items, project);

  const selectedItem = items.find((item) => item.id === selectedItemId);

  if (!selectedItem) {
    throw new Error(`Content item not found: ${selectedItemId}`);
  }

  let artifact: RunArtifact;
  if (options.provider === 'composio') {
    const actionSlug = requireOption(options, 'actionSlug', 'publish --provider composio');
    const connectionId = requireOption(options, 'connectionId', 'publish --provider composio');
    const client = composioClientFromEnv();
    const capability = (await client.listPublishingCapabilities()).find((item) => item.actionSlug === actionSlug);
    if (!capability) throw new Error(`Composio publishing action not found or not allowed: ${actionSlug}`);
    artifact = await publishThroughComposio({client, capability, connectionId, item: selectedItem});
  } else {
    const accessTokenEnv = project.platforms.threads?.accessTokenEnv;
    const accessToken = accessTokenEnv ? resolveEnvSecret(accessTokenEnv) : undefined;
    artifact = await publishContentItem({
      item: selectedItem,
      project,
      accessToken,
      fetchImpl: dependencies.fetchImpl ?? dependencies.fetch,
    });
  }
  const artifactPath = await writeRunArtifact(paths, artifact);
  const message = artifact.message ?? (artifact.status === 'ok' ? 'Published to Threads.' : 'Threads publish failed.');
  const updatedItems = items.map((item) => {
    if (item.id !== selectedItemId) {
      return item;
    }

    const nextStatus =
      artifact.status === 'ok' ? 'published' : artifact.status === 'blocked' ? 'publish_blocked' : 'failed';

    return appendEvent(
      {
        ...item,
        status: nextStatus,
      },
      {
        type: 'publish',
        status: artifact.status,
        message,
        artifactPath,
        createdAt: artifact.createdAt,
      },
    );
  });

  await writeDeterministicJson(paths.preparedItemsFile, redactArtifactValue(updatedItems));
  await writeCalendarArtifacts(paths, updatedItems, [project]);

  if (artifact.status === 'blocked') {
    return message;
  }

  if (artifact.status === 'failed') {
    return `failed: ${message}`;
  }

  return options.provider === 'composio'
    ? `Published ${selectedItemId} through Composio.`
    : `Published ${selectedItemId} to Threads.`;
};

const runCheckThreads = async (options: CliOptions, dependencies: CliDependencies): Promise<string> => {
  const projectFile = requireOption(options, 'projectFile', 'check:threads');
  loadWorkspaceEnv();
  const project = await loadProjectFromFile(projectFile);
  const threads = project.platforms.threads;

  if (!threads?.threadsUserId) {
    return 'blocked: missing Threads user id';
  }

  if (!threads.accessTokenEnv) {
    return 'blocked: missing Threads access token environment variable name';
  }

  const accessToken = resolveEnvSecret(threads.accessTokenEnv);

  if (!accessToken) {
    return `blocked: missing token env ${threads.accessTokenEnv}`;
  }

  await createThreadsClient({accessToken, fetchImpl: dependencies.fetchImpl ?? dependencies.fetch}).checkUser(threads.threadsUserId);

  return 'ok: Threads user check passed';
};

export async function runCli(argv = process.argv.slice(2), dependencies: CliDependencies = {}): Promise<string> {
  const {command, options} = parseArgs(argv);

  if (!command) {
    return helpMessage;
  }

  if (command === 'prepare') {
    return runPrepare(options);
  }

  if (command === 'calendar') {
    return runCalendar(options);
  }

  if (command === 'dry-run') {
    return runDryRun(options);
  }

  if (command === 'publish') {
    return runPublish(options, dependencies);
  }

  if (command === 'check:threads') {
    return runCheckThreads(options, dependencies);
  }

  if (command === 'composio:capabilities') {
    return runComposioCapabilities();
  }

  if (command === 'composio:connections') {
    return runComposioConnections();
  }

  if (command === 'composio:connect') {
    return runComposioConnect(options);
  }

  throw new Error(`Unknown command: ${command}`);
}

if (process.argv[1] && fileURLToPath(import.meta.url) === process.argv[1]) {
  runCli()
    .then((message) => console.log(message))
    .catch((error) => {
      console.error(error instanceof Error ? error.message : String(error));
      process.exitCode = 1;
    });
}
