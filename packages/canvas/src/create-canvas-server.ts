import {createServer, type Server, type ServerResponse} from 'node:http';
import {createReadStream} from 'node:fs';
import {stat} from 'node:fs/promises';
import path from 'node:path';
import {handleReelRequest} from './reels.js';
import {readHealth} from './health.js';
import {publisherHttp} from './publisher/http.js';
import {readViralBrainsDashboard} from './brains-intelligence.js';
import type {Publisher} from './publisher/service.js';

import {
  listAnalysisEntries,
  readBrainsRuns,
  readContentRuns,
  readPreviewAssets,
  readResponseBody,
  readScaleCalendar,
} from './files.js';
import {resolveRequestPath} from './paths.js';
import type {CanvasConfig} from './types.js';

const sendJson = (response: ServerResponse, body: unknown) => {
  response.writeHead(200, {'Content-Type': 'application/json; charset=utf-8'});
  response.end(JSON.stringify(body));
};

const sendError = (response: ServerResponse, error: unknown) => {
  const statusCode =
    error instanceof Error && /escapes root/i.test(error.message)
      ? 400
      : error instanceof Error && /scale calendar/i.test(error.message)
        ? 500
        : 404;
  response.writeHead(statusCode, {'Content-Type': 'text/plain; charset=utf-8'});
  response.end(error instanceof Error ? error.message : 'Not found');
};

export const createCanvasServer = (config: CanvasConfig, publisher?: Publisher): Server => {
  const publishing = publisherHttp(config, publisher);
  const server = createServer(async (request, response) => {
    try {
      const url = new URL(request.url ?? '/', `http://${request.headers.host ?? 'localhost'}`);

      const oauthReturn = request.method === 'GET' && url.pathname === '/api/publisher/oauth/callback';
      if (!oauthReturn && (!['localhost', '127.0.0.1', '[::1]'].includes(url.hostname) || (request.headers.origin && request.headers.origin !== url.origin))) {
        response.writeHead(403, {'Content-Type': 'application/json'}); response.end(JSON.stringify({error: 'Dozwolony jest tylko lokalny adres aplikacji.'})); return;
      }
      if (request.method === 'POST' && url.pathname === '/api/publisher/shutdown') {
        if (request.headers['x-genius-local'] !== '1') {response.writeHead(403); response.end(); return;}
        sendJson(response, {stopping: true, message: 'Kończę bieżącą wysyłkę i zatrzymuję aplikację.'});
        void publishing.publisher.stop().then(() => server.close()); return;
      }
      if (await publishing.handle(request, response, url)) return;

      if (await handleReelRequest(request,response,url,config)) return;

      if (url.pathname === '/api/health' && request.method === 'GET') {
        sendJson(response, await readHealth(config.workspaceRoot));
        return;
      }

      if (url.pathname === '/api/analysis-list') {
        sendJson(response, await listAnalysisEntries(config.analysisRoot));
        return;
      }

      if (url.pathname === '/api/scale-calendar') {
        sendJson(response, await readScaleCalendar(config.scaleCalendarPath));
        return;
      }

      if (url.pathname === '/api/content-runs') {
        sendJson(response, await readContentRuns(config.workspaceRoot));
        return;
      }

      if (url.pathname === '/api/brains-runs') {
        sendJson(response, await readBrainsRuns(config.workspaceRoot));
        return;
      }

      if (url.pathname === '/api/genius-brains') {
        sendJson(response, await readViralBrainsDashboard(config.geniusBrainsDataRoot));
        return;
      }

      if (url.pathname === '/api/assets') {
        sendJson(response, await readPreviewAssets(config.workspaceRoot));
        return;
      }

      const filePath = resolveRequestPath(url.pathname, config);
      if (/\.(mp4|mov)$/i.test(filePath)) {
        const {size}=await stat(filePath);
        const headers={'Content-Type':path.extname(filePath).toLowerCase()==='.mov'?'video/quicktime':'video/mp4','Accept-Ranges':'bytes'};
        const range=request.headers.range;
        if(range) {
          const match=range.match(/^bytes=(\d*)-(\d*)$/);
          let start=0,end=size-1;
          if(match&&match[1]) {start=Number(match[1]);end=match[2]?Math.min(Number(match[2]),size-1):size-1;}
          else if(match&&match[2])start=Math.max(0,size-Number(match[2]));
          if(!match||(!match[1]&&!match[2])||start>end||start>=size) {response.writeHead(416,{'Content-Range':`bytes */${size}`});response.end();return;}
          response.writeHead(206,{...headers,'Content-Range':`bytes ${start}-${end}/${size}`,'Content-Length':end-start+1});
          const stream=createReadStream(filePath,{start,end});stream.on('error',()=>response.destroy());response.on('close',()=>stream.destroy());stream.pipe(response);
        } else {
          response.writeHead(200,{...headers,'Content-Length':size});
          const stream=createReadStream(filePath);stream.on('error',()=>response.destroy());response.on('close',()=>stream.destroy());stream.pipe(response);
        }
        return;
      }
      const {body, contentType} = await readResponseBody(filePath);

      response.writeHead(200, {'Content-Type': contentType});
      response.end(body);
    } catch (error) {
      sendError(response, error);
    }
  });
  server.on('listening', () => publishing.publisher.start());
  server.on('close', () => {void publishing.publisher.stop();});
  return server;
};

export const startCanvasServer = (config: CanvasConfig): Server => {
  const server = createCanvasServer(config);
  server.listen(config.port, '127.0.0.1', () => {
    console.log(`GENIUS@WORK available at http://127.0.0.1:${config.port}`);
  });
  return server;
};
