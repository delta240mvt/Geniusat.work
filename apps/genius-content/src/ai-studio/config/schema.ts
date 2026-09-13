import {z} from 'zod';

export const aiStudioFrameModeSchema = z.enum(['first_only', 'first_and_last']);

export const aiStudioStudioConfigSchema = z.object({
  sourceFile: z.string().min(1),
  outputRoot: z.string().min(1),
  defaultAspectRatio: z.string().min(1),
  defaultLanguage: z.string().min(1),
  timestampFormat: z.string().min(1),
  naming: z.object({
    jobSeparator: z.string().min(1),
  }),
});

export const aiStudioModelsConfigSchema = z.object({
  nanoBanana: z.object({
    defaultModel: z.string().min(1),
    imageSize: z.string().min(1),
    aspectRatio: z.string().min(1),
  }),
  veo: z.object({
    defaultModel: z.string().min(1),
    fallbackModel: z.string().min(1),
    durationSeconds: z.number().int().positive(),
    resolution: z.string().min(1),
    personGeneration: z.enum(['allow_adult']),
  }),
});

export const aiStudioVoiceProfileSchema = z.object({
  timbre: z.string().min(1),
  cadence: z.string().min(1),
  mouthMovement: z.string().min(1),
  acousticEnvironment: z.string().min(1),
});

export const aiStudioPersonaDefinitionSchema = z.object({
  displayName: z.string().min(1),
  references: z.array(z.string().min(1)).min(1),
  identity: z.array(z.string().min(1)).min(1),
  negativeConstraints: z.array(z.string().min(1)).min(1),
  voice: aiStudioVoiceProfileSchema,
});

export const aiStudioPersonasConfigSchema = z.object({
  personas: z.record(z.string().min(1), aiStudioPersonaDefinitionSchema),
});

export const aiStudioShotDefinitionSchema = z.object({
  activePersona: z.string().min(1),
  frameMode: aiStudioFrameModeSchema,
});

export const aiStudioShotsConfigSchema = z.object({
  shotOrder: z.array(z.string().min(1)).min(1),
  definitions: z.record(z.string().min(1), aiStudioShotDefinitionSchema),
});

export const aiStudioPromptsConfigSchema = z.object({
  nanoBanana: z.object({
    firstFrameTemplate: z.string().min(1),
    lastFrameTemplate: z.string().min(1),
  }),
  veo: z.object({
    shotTemplate: z.string().min(1),
  }),
  audio: z.object({
    dialogueTemplate: z.string().min(1),
    ambientTemplate: z.string().min(1),
  }),
});

export type AiStudioStudioConfig = z.infer<typeof aiStudioStudioConfigSchema>;
export type AiStudioModelsConfig = z.infer<typeof aiStudioModelsConfigSchema>;
export type AiStudioPersonasConfig = z.infer<typeof aiStudioPersonasConfigSchema>;
export type AiStudioShotsConfig = z.infer<typeof aiStudioShotsConfigSchema>;
export type AiStudioPromptsConfig = z.infer<typeof aiStudioPromptsConfigSchema>;
