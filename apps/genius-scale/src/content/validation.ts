import type {ContentAsset, ContentItem, ProjectConfig} from '../config/schema.js';

export interface ValidationIssue {
  code: string;
  message: string;
  path?: string;
}

export interface ValidationResult {
  ok: boolean;
  errors: ValidationIssue[];
  warnings: ValidationIssue[];
}

const MAX_BODY_LENGTH = 500;

const issue = (code: string, message: string, path?: string): ValidationIssue => ({
  code,
  message,
  ...(path ? {path} : {}),
});

const isMissing = (value: string | undefined): boolean => value === undefined || value.length === 0;

const mediaAssets = (assets: ContentAsset[]): ContentAsset[] =>
  assets.filter((asset) => asset.type === 'image' || asset.type === 'video');

const missingPublicUrlIssues = (assets: ContentAsset[]): ValidationIssue[] =>
  mediaAssets(assets)
    .map((asset, index) => ({asset, index}))
    .filter(({asset}) => isMissing(asset.publicUrl))
    .map(({asset, index}) =>
      issue('missing_public_url', `Asset ${asset.id} requires publicUrl for Threads publish.`, `assets.${index}.publicUrl`),
    );

const validateSharedThreadsRules = (item: ContentItem): ValidationIssue[] => {
  const errors: ValidationIssue[] = [];
  const threads = item.platforms.threads;

  if (!threads) {
    errors.push(issue('missing_threads_options', 'Content item requires Threads platform options.', 'platforms.threads'));
    return errors;
  }

  if (item.body.length < 1 || item.body.length > MAX_BODY_LENGTH) {
    errors.push(
      issue(
        'invalid_body_length',
        `Threads body must be between 1 and ${MAX_BODY_LENGTH} JavaScript string characters.`,
        'body',
      ),
    );
  }

  if (threads.postType === 'text' && item.assets.length !== 0) {
    errors.push(issue('invalid_asset_count', 'Threads text posts require zero assets.', 'assets'));
  }

  if (threads.postType === 'image') {
    const imageCount = item.assets.filter((asset) => asset.type === 'image').length;
    if (item.assets.length !== 1 || imageCount !== 1) {
      errors.push(issue('invalid_asset_count', 'Threads image posts require exactly one image asset.', 'assets'));
    }
  }

  if (threads.postType === 'video') {
    const videoCount = item.assets.filter((asset) => asset.type === 'video').length;
    if (item.assets.length !== 1 || videoCount !== 1) {
      errors.push(issue('invalid_asset_count', 'Threads video posts require exactly one video asset.', 'assets'));
    }
  }

  if (threads.postType === 'carousel' && (item.assets.length < 2 || item.assets.length > 20)) {
    errors.push(issue('invalid_asset_count', 'Threads carousel posts require 2-20 image or video assets.', 'assets'));
  }

  return errors;
};

const validateProjectForPublish = (project: ProjectConfig, hasAccessToken: boolean): ValidationIssue[] => {
  const threads = project.platforms.threads;
  const errors: ValidationIssue[] = [];

  if (!threads?.threadsUserId) {
    errors.push(issue('missing_threads_user_id', 'Project Threads config requires threadsUserId.', 'platforms.threads.threadsUserId'));
  }

  if (!threads?.accessTokenEnv) {
    errors.push(issue('missing_access_token_env', 'Project Threads config requires accessTokenEnv.', 'platforms.threads.accessTokenEnv'));
  }

  if (!hasAccessToken) {
    errors.push(issue('missing_access_token', 'Threads access token is not available from the configured environment.'));
  }

  return errors;
};

export const validateForThreadsDryRun = (item: ContentItem, _project: ProjectConfig): ValidationResult => {
  const errors = validateSharedThreadsRules(item);
  const warnings = item.platforms.threads?.postType === 'text' ? [] : missingPublicUrlIssues(item.assets);

  return {
    ok: errors.length === 0,
    errors,
    warnings,
  };
};

export const validateForThreadsPublish = (
  item: ContentItem,
  project: ProjectConfig,
  options: {hasAccessToken: boolean},
): ValidationResult => {
  const errors = [
    ...validateSharedThreadsRules(item),
    ...(item.platforms.threads?.postType === 'text' ? [] : missingPublicUrlIssues(item.assets)),
    ...validateProjectForPublish(project, options.hasAccessToken),
  ];

  return {
    ok: errors.length === 0,
    errors,
    warnings: [],
  };
};
