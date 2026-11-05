/**
 * Host half of the music player bundle.
 *
 * The browser panel cannot fetch music catalogues directly (CORS), so the Host
 * exposes a few same-origin JSON routes under /api/dsh-music/* and talks to the
 * public music endpoints itself.
 *
 * Sources:
 *  - NetEase Cloud Music search API (song metadata).
 *  - Meting-compatible public endpoint (playable url / cover / lyric / charts).
 */

import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';

const PREFIX = '/api/dsh-music';
const METING = 'https://api.injahow.cn/meting/';
const UA =
  'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0 Safari/537.36';

const FETCH_OPTS = {
  headers: { 'user-agent': UA, referer: 'https://music.163.com/' },
  signal: null, // filled per request
};

function json(res, status, data) {
  const body = JSON.stringify(data);
  res.writeHead(status, {
    'content-type': 'application/json; charset=utf-8',
    'cache-control': 'no-store',
    'content-length': Buffer.byteLength(body),
  });
  res.end(body);
}

async function getJson(url, timeoutMs = 12000) {
  const response = await fetch(url, {
    headers: FETCH_OPTS.headers,
    signal: AbortSignal.timeout(timeoutMs),
  });
  if (!response.ok) throw new Error(`upstream ${response.status}`);
  return response.json();
}

function metingUrl(params) {
  const search = new URLSearchParams({ server: 'netease', ...params });
  return `${METING}?${search.toString()}`;
}

// ---------------------------------------------------------------- library ---
// Playlists live in a small JSON file under DSH_HOME so they survive restarts
// and page reloads without depending on browser storage.

const LIBRARY_DIR = path.join(process.env.DSH_HOME || path.join(os.homedir(), '.dsh'), 'dsh-music');
const LIBRARY_FILE = path.join(LIBRARY_DIR, 'library.json');
const ACCOUNT_FILE = path.join(LIBRARY_DIR, 'account.json');

function readAccount() {
  try {
    const parsed = JSON.parse(fs.readFileSync(ACCOUNT_FILE, 'utf8'));
    if (parsed && typeof parsed.cookie === 'string' && parsed.cookie) return parsed;
  } catch {
    // not logged in
  }
  return null;
}

function writeAccount(account) {
  fs.mkdirSync(LIBRARY_DIR, { recursive: true });
  const temp = `${ACCOUNT_FILE}.tmp`;
  fs.writeFileSync(temp, JSON.stringify(account, null, 2), 'utf8');
  fs.renameSync(temp, ACCOUNT_FILE);
}

function clearAccount() {
  try {
    fs.unlinkSync(ACCOUNT_FILE);
  } catch {
    // already absent
  }
}

function accountCookie() {
  const account = readAccount();
  return account ? account.cookie : '';
}

function defaultLibrary() {
  return { playlists: [{ id: 'favorites', name: '我的收藏', songs: [] }] };
}

function readLibrary() {
  try {
    const parsed = JSON.parse(fs.readFileSync(LIBRARY_FILE, 'utf8'));
    if (parsed && Array.isArray(parsed.playlists)) {
      return {
        playlists: parsed.playlists
          .filter((pl) => pl && typeof pl.id === 'string' && typeof pl.name === 'string')
          .map((pl) => ({ id: pl.id, name: pl.name, songs: Array.isArray(pl.songs) ? pl.songs : [] })),
      };
    }
  } catch {
    // missing or corrupt file: start from the default shape
  }
  return defaultLibrary();
}

function writeLibrary(library) {
  fs.mkdirSync(LIBRARY_DIR, { recursive: true });
  const temp = `${LIBRARY_FILE}.tmp`;
  fs.writeFileSync(temp, JSON.stringify(library, null, 2), 'utf8');
  fs.renameSync(temp, LIBRARY_FILE);
}

async function readBody(req, limit = 1024 * 1024) {
  const chunks = [];
  let size = 0;
  for await (const chunk of req) {
    size += chunk.length;
    if (size > limit) throw new Error('请求体过大');
    chunks.push(chunk);
  }
  if (chunks.length === 0) return {};
  return JSON.parse(Buffer.concat(chunks).toString('utf8'));
}

function newPlaylistId() {
  return `pl-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 7)}`;
}

function pickSong(raw) {
  if (!raw || typeof raw !== 'object') return null;
  const id = typeof raw.id === 'string' || typeof raw.id === 'number' ? String(raw.id) : '';
  const name = typeof raw.name === 'string' ? raw.name.slice(0, 200) : '';
  if (!/^\d+$/.test(id) || !name) return null;
  return {
    id,
    name,
    artist: typeof raw.artist === 'string' ? raw.artist.slice(0, 200) : '',
    album: typeof raw.album === 'string' ? raw.album.slice(0, 200) : '',
    duration: Number.isFinite(raw.duration) ? raw.duration : 0,
    picId: raw.picId ?? null,
    pic: typeof raw.pic === 'string' ? raw.pic : '',
    fee: typeof raw.fee === 'number' ? raw.fee : 0,
  };
}

function normalizeSearch(payload) {
  const songs = payload?.result?.songs;
  if (!Array.isArray(songs)) return [];
  return songs.map((song) => ({
    id: song.id,
    name: song.name,
    artist: (song.artists || []).map((artist) => artist.name).filter(Boolean).join(' / '),
    album: song.album?.name || '',
    duration: song.duration || 0,
    picId: song.album?.picId,
    fee: typeof song.fee === 'number' ? song.fee : 0,
  }));
}

function normalizePlaylist(payload) {
  if (!Array.isArray(payload)) return [];
  return payload
    .filter((item) => item && item.name)
    .map((item) => ({
      id: extractId(item.url),
      name: item.name,
      artist: item.artist || '',
      album: '',
      duration: 0,
      pic: item.pic || '',
      url: item.url || '',
      lyric: item.lrc || '',
    }));
}

function extractId(url) {
  if (typeof url !== 'string') return '';
  const match = /[?&]id=(\d+)/.exec(url);
  return match ? match[1] : '';
}

async function handleSearch(query, res) {
  const url =
    `https://music.163.com/api/search/get?s=${encodeURIComponent(query)}` +
    `&type=1&limit=30&offset=0`;
  const payload = await getJson(url);
  json(res, 200, { songs: normalizeSearch(payload) });
}

async function handlePlaylist(id, res) {
  const payload = await getJson(metingUrl({ type: 'playlist', id }));
  json(res, 200, { songs: normalizePlaylist(payload) });
}

const QUALITY_LADDER = [320000, 192000, 128000];
const ENHANCE_URL = 'https://music.163.com/api/song/enhance/player/url';
const COOKIE = 'os=pc; appver=2.0.2';

/** Ask NetEase for one bitrate and return its playable url (or null when the account level forbids it). */
async function fetchEnhanceUrl(id, br) {
  const account = accountCookie();
  const response = await fetch(`${ENHANCE_URL}?ids=%5B${id}%5D&br=${br}`, {
    headers: { ...FETCH_OPTS.headers, cookie: account ? `${COOKIE}; ${account}` : COOKIE },
    signal: AbortSignal.timeout(10000),
  });
  if (!response.ok) return null;
  const payload = await response.json();
  const item = payload?.data?.[0];
  return item?.url || null;
}

/** Meting fallback, mostly useful for tracks NetEase gates but the proxy still serves. */
async function fetchMetingUrl(id) {
  try {
    const response = await fetch(metingUrl({ type: 'url', id }), {
      headers: FETCH_OPTS.headers,
      redirect: 'manual',
      signal: AbortSignal.timeout(12000),
    });
    const location = response.headers.get('location');
    if (location) return location;
    if (response.ok) return metingUrl({ type: 'url', id });
  } catch {
    // fall through to "no source"
  }
  return null;
}

/**
 * Resolve a playable url.
 * `quality` is 'auto' (highest bitrate the account is actually allowed to stream)
 * or one of the ladder values, in which case lower bitrates are tried on failure.
 */
async function resolvePlayable(id, quality) {
  const requested = Number(quality);
  const ladder = Number.isFinite(requested) && requested > 0
    ? [requested, ...QUALITY_LADDER.filter((br) => br < requested)]
    : QUALITY_LADDER;
  const seen = new Set();
  for (const br of ladder) {
    if (!br || seen.has(br)) continue;
    seen.add(br);
    try {
      const url = await fetchEnhanceUrl(id, br);
      if (url) return { url, br };
    } catch {
      // try the next bitrate
    }
  }
  const fallback = await fetchMetingUrl(id);
  if (fallback) return { url: fallback, br: 0 };
  return null;
}

async function handleUrl(id, quality, res) {
  const playable = await resolvePlayable(id, quality);
  if (!playable) {
    json(res, 404, { error: '该歌曲需要会员或已下架，暂时没有可用音源' });
    return;
  }
  json(res, 200, playable);
}

async function handleLyric(id, res) {
  const response = await fetch(metingUrl({ type: 'lrc', id }), {
    headers: FETCH_OPTS.headers,
    signal: AbortSignal.timeout(12000),
  });
  const text = response.ok ? await response.text() : '';
  json(res, 200, { lrc: text });
}

// ------------------------------------------------------------------ login ---

const LOGIN_BASE = 'https://music.163.com';

function pickCookies(response) {
  let list = [];
  if (typeof response.headers.getSetCookie === 'function') {
    list = response.headers.getSetCookie();
  } else {
    const raw = response.headers.get('set-cookie');
    if (raw) list = [raw];
  }
  const pairs = [];
  for (const item of list) {
    const first = String(item).split(';')[0];
    if (first && first.includes('=')) pairs.push(first.trim());
  }
  return pairs.join('; ');
}

async function handleLoginQr(res) {
  const response = await fetch(`${LOGIN_BASE}/api/login/qrcode/unikey?type=1`, {
    headers: FETCH_OPTS.headers,
    signal: AbortSignal.timeout(10000),
  });
  const payload = await response.json();
  const key = payload?.unikey;
  if (!key) throw new Error('获取登录二维码失败');
  const loginUrl = `${LOGIN_BASE}/login?codekey=${key}`;
  const qrImage =
    `https://api.qrserver.com/v1/create-qr-code/?size=220x220&data=${encodeURIComponent(loginUrl)}`;
  json(res, 200, { key, loginUrl, qrImage });
}

async function handleLoginCheck(key, res) {
  const response = await fetch(
    `${LOGIN_BASE}/api/login/qrcode/client/login?key=${encodeURIComponent(key)}&type=1`,
    { headers: FETCH_OPTS.headers, signal: AbortSignal.timeout(10000) },
  );
  const payload = await response.json();
  const code = payload?.code;
  if (code === 803) {
    const cookie = pickCookies(response);
    let profile = null;
    try {
      const me = await fetch(`${LOGIN_BASE}/api/nuser/account/get`, {
        headers: { ...FETCH_OPTS.headers, cookie: cookie || COOKIE },
        signal: AbortSignal.timeout(10000),
      });
      const body = await me.json();
      const user = body?.profile;
      if (user) profile = { nickname: user.nickname, avatar: user.avatarUrl, userId: user.userId };
    } catch {
      // profile is optional
    }
    if (cookie) writeAccount({ cookie, profile, savedAt: new Date().toISOString() });
    json(res, 200, { status: 'ok', profile });
    return;
  }
  if (code === 800) {
    json(res, 200, { status: 'expired' });
    return;
  }
  if (code === 802) {
    json(res, 200, { status: 'confirmed' });
    return;
  }
  json(res, 200, { status: 'waiting' });
}

function handleAccount(res) {
  const account = readAccount();
  json(res, 200, account ? { loggedIn: true, profile: account.profile || null } : { loggedIn: false, profile: null });
}

function route(ctx, path, handler) {
  return ctx.effect(() =>
    ctx.webServer.register({
      kind: 'exact',
      path: `${PREFIX}${path}`,
      handler: async (req, res) => {
        try {
          const requestUrl = new URL(req.url || '/', 'http://localhost');
          await handler(requestUrl.searchParams, res, req);
        } catch (error) {
          const message = error instanceof Error ? error.message : String(error);
          if (message.includes('timeout') || message.includes('Timeout')) {
            json(res, 504, { error: '音乐服务响应超时，请稍后再试' });
          } else {
            json(res, 502, { error: `音乐服务暂时不可用：${message}` });
          }
        }
      },
    }),
  );
}

export const inject = ['webServer'];

export function apply(ctx) {
  route(ctx, '/search', async (search, res) => {
    const query = (search.get('q') || '').trim().slice(0, 80);
    if (!query) {
      json(res, 400, { error: '搜索关键词为空' });
      return;
    }
    await handleSearch(query, res);
  });

  route(ctx, '/playlist', async (search, res) => {
    const id = (search.get('id') || '').trim();
    if (!/^\d+$/.test(id)) {
      json(res, 400, { error: '歌单 ID 不合法' });
      return;
    }
    await handlePlaylist(id, res);
  });

  route(ctx, '/url', async (search, res) => {
    const id = (search.get('id') || '').trim();
    if (!/^\d+$/.test(id)) {
      json(res, 400, { error: '歌曲 ID 不合法' });
      return;
    }
    await handleUrl(id, (search.get('br') || 'auto').trim(), res);
  });

  route(ctx, '/lyric', async (search, res) => {
    const id = (search.get('id') || '').trim();
    if (!/^\d+$/.test(id)) {
      json(res, 400, { error: '歌曲 ID 不合法' });
      return;
    }
    await handleLyric(id, res);
  });

  // -------- playlists (persisted on the Host) --------

  route(ctx, '/library', async (_search, res) => {
    json(res, 200, readLibrary());
  });

  // -------- NetEase account (QR login, credentials stay on this machine) --------

  route(ctx, '/login/qr', async (_search, res) => {
    await handleLoginQr(res);
  });

  route(ctx, '/login/check', async (search, res) => {
    const key = (search.get('key') || '').trim();
    if (!key) {
      json(res, 400, { error: '缺少登录 key' });
      return;
    }
    await handleLoginCheck(key, res);
  });

  route(ctx, '/logout', async (_search, res) => {
    clearAccount();
    json(res, 200, { ok: true });
  });

  route(ctx, '/account', async (_search, res) => {
    handleAccount(res);
  });

  route(ctx, '/library/create', async (_search, res, req) => {
    const body = await readBody(req);
    const name = typeof body.name === 'string' ? body.name.trim().slice(0, 40) : '';
    if (!name) {
      json(res, 400, { error: '歌单名称不能为空' });
      return;
    }
    const library = readLibrary();
    const playlist = { id: newPlaylistId(), name, songs: [] };
    library.playlists.push(playlist);
    writeLibrary(library);
    json(res, 200, library);
  });

  route(ctx, '/library/add', async (_search, res, req) => {
    const body = await readBody(req);
    const playlistId = typeof body.playlistId === 'string' ? body.playlistId : '';
    const song = pickSong(body.song);
    if (!playlistId || !song) {
      json(res, 400, { error: '参数不完整' });
      return;
    }
    const library = readLibrary();
    const playlist = library.playlists.find((item) => item.id === playlistId);
    if (!playlist) {
      json(res, 404, { error: '歌单不存在' });
      return;
    }
    if (!playlist.songs.some((item) => item.id === song.id)) playlist.songs.push(song);
    writeLibrary(library);
    json(res, 200, library);
  });

  route(ctx, '/library/remove', async (_search, res, req) => {
    const body = await readBody(req);
    const playlistId = typeof body.playlistId === 'string' ? body.playlistId : '';
    const songId = typeof body.songId === 'string' || typeof body.songId === 'number' ? String(body.songId) : '';
    if (!playlistId || !songId) {
      json(res, 400, { error: '参数不完整' });
      return;
    }
    const library = readLibrary();
    const playlist = library.playlists.find((item) => item.id === playlistId);
    if (playlist) {
      playlist.songs = playlist.songs.filter((song) => song.id !== songId);
      writeLibrary(library);
    }
    json(res, 200, library);
  });

  route(ctx, '/library/delete', async (_search, res, req) => {
    const body = await readBody(req);
    const playlistId = typeof body.playlistId === 'string' ? body.playlistId : '';
    if (!playlistId || playlistId === 'favorites') {
      json(res, 400, { error: '该歌单不能删除' });
      return;
    }
    const library = readLibrary();
    library.playlists = library.playlists.filter((item) => item.id !== playlistId);
    writeLibrary(library);
    json(res, 200, library);
  });
}
