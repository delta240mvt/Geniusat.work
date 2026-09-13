import {createCanvasConfig, startCanvasServer} from './index.js';

const port = process.env.CANVAS_PORT ? Number(process.env.CANVAS_PORT) : undefined;

startCanvasServer(
  createCanvasConfig({
    workspaceRoot: process.env.CANVAS_WORKSPACE_ROOT,
    analysisRoot: process.env.CANVAS_ANALYSIS_ROOT,
    videoRoot: process.env.CANVAS_VIDEO_ROOT,
    port: Number.isFinite(port) ? port : undefined,
  }),
);
