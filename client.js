window.__ModuleLoader__.load({
  id: '@local/dsh-music',
  factory(require) {
    const React = require('react');
    const h = React.createElement;
    const { useEffect, useReducer } = React;

    const FORMAT_TIME = (seconds) => {
      if (!Number.isFinite(seconds) || seconds <= 0) return '0:00';
      const total = Math.floor(seconds);
      const m = Math.floor(total / 60);
      const s = total % 60;
      return `${m}:${s < 10 ? '0' : ''}${s}`;
    };

    const displayName = (song) => {
      if (!song) return '';
      if (song.fee === 1) return `${song.name}（VIP）`;
      if (song.fee === 8) return `${song.name}（VIP高音质）`;
      return song.name;
    };

    const QUALITY_LABEL = { 999000: '无损', 320000: '320K', 192000: '192K', 128000: '128K' };

    const HISTORY_KEY = 'dsh-music-search-history';
    const HISTORY_LIMIT = 10;

    function loadHistory() {
      try {
        const raw = localStorage.getItem(HISTORY_KEY);
        const parsed = raw ? JSON.parse(raw) : [];
        return Array.isArray(parsed) ? parsed.filter((item) => typeof item === 'string').slice(0, HISTORY_LIMIT) : [];
      } catch {
        return [];
      }
    }

    function saveHistory(list) {
      try {
        localStorage.setItem(HISTORY_KEY, JSON.stringify(list));
      } catch {
        // storage unavailable: history simply stops persisting
      }
    }

    const MODE_KEY = 'dsh-music-play-mode';
    const MODE_ORDER = ['list', 'single', 'sequence'];
    const MODE_LABEL = { list: '列表循环', single: '单曲循环', sequence: '顺序播放' };
    const MODE_ICON = { list: '🔁', single: '🔂', sequence: '➡' };

    function loadMode() {
      try {
        const saved = localStorage.getItem(MODE_KEY);
        return MODE_ORDER.includes(saved) ? saved : 'list';
      } catch {
        return 'list';
      }
    }

    function saveMode(mode) {
      try {
        localStorage.setItem(MODE_KEY, mode);
      } catch {
        // ignore
      }
    }

    const CSS = `
      .dmp-root {
        position: relative; height: 100%; min-height: 0; overflow: hidden;
        background: var(--dsw-alias-bg-base); color: var(--dsw-alias-label-primary);
      }
      .dmp-bg { position: absolute; inset: 0; pointer-events: none; z-index: 0; }
      .dmp-bg::before {
        content: ''; position: absolute; inset: -25%;
        background:
          radial-gradient(55% 45% at 12% 0%, var(--dsw-alias-brand-primary) 0%, transparent 62%),
          radial-gradient(45% 40% at 92% 8%, #8b5cf6 0%, transparent 60%),
          radial-gradient(50% 45% at 70% 100%, #22d3ee 0%, transparent 65%);
        opacity: .18; filter: blur(26px);
        animation: dmp-drift 26s ease-in-out infinite alternate;
      }
      @keyframes dmp-drift {
        from { transform: translate3d(0, 0, 0) scale(1); }
        to { transform: translate3d(-2%, 2%, 0) scale(1.06); }
      }
      .dmp-coverbg {
        position: absolute; inset: -10%; background-size: cover; background-position: center;
        filter: blur(58px) saturate(1.5); opacity: .34; transform: scale(1.15);
        transition: opacity .8s ease;
      }
      .dmp-scrim {
        position: absolute; inset: 0;
        background: linear-gradient(180deg,
          color-mix(in srgb, var(--dsw-alias-bg-base) 74%, transparent) 0%,
          color-mix(in srgb, var(--dsw-alias-bg-base) 88%, transparent) 55%,
          var(--dsw-alias-bg-base) 100%);
      }
      .dmp-content {
        position: relative; z-index: 1; display: flex; flex-direction: column;
        height: 100%; min-height: 0;
      }
      .dmp-head { padding: 18px 22px 12px; display: flex; flex-direction: column; gap: 12px; border-bottom: 1px solid var(--dsw-alias-border-l1); }
      .dmp-title { font-size: 17px; font-weight: 600; letter-spacing: .2px; }
      .dmp-search { display: flex; gap: 8px; }
      .dmp-search input {
        flex: 1; min-width: 0; height: 34px; padding: 0 12px; border-radius: 8px;
        border: 1px solid var(--dsw-alias-border-l1); background: var(--dsw-alias-bg-layer-1);
        color: var(--dsw-alias-label-primary); font-size: 13px; outline: none;
      }
      .dmp-search input:focus { border-color: var(--dsw-alias-brand-primary); }
      .dmp-btn {
        height: 34px; padding: 0 14px; border-radius: 8px; cursor: pointer; font-size: 13px;
        border: 1px solid var(--dsw-alias-border-l1); background: var(--dsw-alias-bg-layer-1);
        color: var(--dsw-alias-label-primary);
      }
      .dmp-btn:hover { background: var(--dsw-alias-bg-layer-2); }
      .dmp-btn.primary { background: var(--dsw-alias-brand-primary); border-color: transparent; color: #fff; }
      .dmp-tabs { display: flex; gap: 6px; }
      .dmp-tab {
        border: none; background: transparent; color: var(--dsw-alias-label-secondary);
        font-size: 13px; padding: 5px 10px; border-radius: 999px; cursor: pointer;
      }
      .dmp-tab.active { background: var(--dsw-alias-bg-layer-2); color: var(--dsw-alias-label-primary); }
      .dmp-quality {
        margin-left: auto; height: 28px; max-width: 46%; border-radius: 8px; padding: 0 8px;
        border: 1px solid var(--dsw-alias-border-l1); background: var(--dsw-alias-bg-layer-1);
        color: var(--dsw-alias-label-primary); font-size: 12px; outline: none; cursor: pointer;
      }
      .dmp-br {
        font-size: 11px; font-weight: 600; letter-spacing: .3px; padding: 2px 7px; border-radius: 6px;
        color: var(--dsw-alias-brand-primary);
        border: 1px solid color-mix(in srgb, var(--dsw-alias-brand-primary) 45%, transparent);
        background: color-mix(in srgb, var(--dsw-alias-brand-primary) 12%, transparent);
        white-space: nowrap;
      }
      .dmp-body { flex: 1; min-height: 0; overflow-y: auto; padding: 6px 12px 12px; }
      .dmp-history { display: flex; flex-wrap: wrap; gap: 6px; align-items: center; padding: 8px 2px 2px; }
      .dmp-history-label { font-size: 11px; color: var(--dsw-alias-label-secondary); margin-right: 2px; }
      .dmp-chip {
        border: 1px solid var(--dsw-alias-border-l1); background: var(--dsw-alias-bg-layer-1);
        color: var(--dsw-alias-label-primary); font-size: 12px; padding: 4px 10px;
        border-radius: 999px; cursor: pointer; max-width: 160px;
        white-space: nowrap; overflow: hidden; text-overflow: ellipsis;
      }
      .dmp-chip:hover { background: var(--dsw-alias-bg-layer-2); border-color: var(--dsw-alias-border-l2); }
      .dmp-chip-clear { color: var(--dsw-alias-label-secondary); }
      .dmp-hint { padding: 28px 12px; text-align: center; font-size: 13px; color: var(--dsw-alias-label-secondary); }
      .dmp-error { color: var(--dsw-alias-state-error-primary); }
      .dmp-row {
        display: flex; align-items: center; gap: 12px; padding: 7px 10px; border-radius: 10px;
        cursor: pointer;
      }
      .dmp-row:hover { background: var(--dsw-alias-bg-layer-1); }
      .dmp-row.playing { background: var(--dsw-alias-bg-layer-2); }
      .dmp-idx { width: 20px; text-align: center; font-size: 12px; color: var(--dsw-alias-state-idle-primary); font-variant-numeric: tabular-nums; }
      .dmp-row.playing .dmp-idx { color: var(--dsw-alias-brand-primary); }
      .dmp-cover {
        width: 40px; height: 40px; border-radius: 7px; object-fit: cover; flex: none;
        background: var(--dsw-alias-bg-layer-2);
      }
      .dmp-meta { flex: 1; min-width: 0; }
      .dmp-name { font-size: 13.5px; line-height: 1.35; white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }
      .dmp-sub { font-size: 12px; line-height: 1.35; color: var(--dsw-alias-label-secondary); white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }
      .dmp-dur { font-size: 12px; color: var(--dsw-alias-label-secondary); font-variant-numeric: tabular-nums; }
      .dmp-bar {
        display: flex; align-items: center; gap: 14px; padding: 10px 18px;
        border-top: 1px solid var(--dsw-alias-border-l1);
        background: color-mix(in srgb, var(--dsw-alias-bg-layer-1) 78%, transparent);
        backdrop-filter: blur(10px);
        flex-wrap: wrap;
      }
      .dmp-now { display: flex; align-items: center; gap: 10px; min-width: 0; flex: 1; }
      .dmp-now .dmp-cover { width: 38px; height: 38px; }
      .dmp-now .dmp-name { font-size: 13px; }
      .dmp-controls { display: flex; align-items: center; gap: 6px; }
      .dmp-ctrl {
        width: 32px; height: 32px; border-radius: 50%; border: 1px solid var(--dsw-alias-border-l1);
        background: transparent; color: var(--dsw-alias-label-primary); cursor: pointer; font-size: 12px;
        display: flex; align-items: center; justify-content: center;
      }
      .dmp-ctrl:hover { background: var(--dsw-alias-bg-layer-2); }
      .dmp-ctrl.main { width: 36px; height: 36px; background: var(--dsw-alias-brand-primary); border-color: transparent; color: #fff; font-size: 13px; }
      .dmp-progress { display: flex; align-items: center; gap: 8px; flex: 2; min-width: 160px; }
      .dmp-time { font-size: 11px; color: var(--dsw-alias-label-secondary); font-variant-numeric: tabular-nums; min-width: 30px; }
      .dmp-range { flex: 1; min-width: 60px; accent-color: var(--dsw-alias-brand-primary); height: 16px; cursor: pointer; }
      .dmp-vol { width: 70px; }
      .dmp-ctrl.mode { font-size: 13px; }
      .dmp-fav {
        flex: none; width: 28px; height: 28px; border-radius: 50%; cursor: pointer;
        border: none; background: transparent; color: var(--dsw-alias-label-secondary);
        font-size: 14px; line-height: 1; display: flex; align-items: center; justify-content: center;
      }
      .dmp-fav:hover { color: var(--dsw-alias-brand-primary); background: var(--dsw-alias-bg-layer-2); }
      .dmp-chip.active {
        color: #fff; background: var(--dsw-alias-brand-primary); border-color: transparent;
      }
      .dmp-plbar { display: flex; flex-wrap: wrap; gap: 6px; padding: 8px 2px 4px; }
      .dmp-plhead { display: flex; align-items: center; justify-content: space-between; padding: 4px 2px; }
      .dmp-newpl { display: flex; gap: 8px; padding: 4px 2px 8px; }
      .dmp-newpl input {
        flex: 1; min-width: 0; height: 30px; padding: 0 10px; border-radius: 8px;
        border: 1px solid var(--dsw-alias-border-l1); background: var(--dsw-alias-bg-layer-1);
        color: var(--dsw-alias-label-primary); font-size: 12px; outline: none;
      }
      .dmp-newpl input:focus { border-color: var(--dsw-alias-brand-primary); }
      .dmp-mask {
        position: absolute; inset: 0; z-index: 20; display: flex; align-items: center; justify-content: center;
        background: rgba(0, 0, 0, 0.35); backdrop-filter: blur(2px);
      }
      .dmp-modal {
        width: min(360px, 86%); max-height: 70%; overflow-y: auto; display: flex; flex-direction: column; gap: 8px;
        padding: 14px; border-radius: 14px;
        background: var(--dsw-alias-bg-overlay); color: var(--dsw-alias-label-primary);
        border: 1px solid var(--dsw-alias-border-l1);
        box-shadow: 0 16px 40px rgba(0, 0, 0, 0.35);
      }
      .dmp-modal-title { font-size: 14px; font-weight: 600; line-height: 1.4; }
      .dmp-modal-list { display: flex; flex-direction: column; gap: 4px; }
      .dmp-modal-item {
        display: flex; align-items: center; justify-content: space-between; gap: 10px;
        padding: 9px 10px; border-radius: 9px; cursor: pointer; font-size: 13px; text-align: left;
        border: 1px solid transparent; background: var(--dsw-alias-bg-layer-1);
        color: var(--dsw-alias-label-primary);
      }
      .dmp-modal-item:hover { border-color: var(--dsw-alias-brand-primary); }
      .dmp-modal-new { display: flex; gap: 8px; }
      .dmp-modal-new input {
        flex: 1; min-width: 0; height: 30px; padding: 0 10px; border-radius: 8px;
        border: 1px solid var(--dsw-alias-border-l1); background: var(--dsw-alias-bg-layer-1);
        color: var(--dsw-alias-label-primary); font-size: 12px; outline: none;
      }
      .dmp-topline { display: flex; align-items: center; justify-content: space-between; gap: 10px; }
      .dmp-account {
        height: 26px; max-width: 55%; padding: 0 10px; border-radius: 999px; cursor: pointer;
        border: 1px solid var(--dsw-alias-border-l1); background: var(--dsw-alias-bg-layer-1);
        color: var(--dsw-alias-label-secondary); font-size: 12px;
        white-space: nowrap; overflow: hidden; text-overflow: ellipsis;
      }
      .dmp-account:hover { border-color: var(--dsw-alias-border-l2); color: var(--dsw-alias-label-primary); }
      .dmp-account.on {
        color: var(--dsw-alias-brand-primary);
        border-color: color-mix(in srgb, var(--dsw-alias-brand-primary) 45%, transparent);
        background: color-mix(in srgb, var(--dsw-alias-brand-primary) 12%, transparent);
      }
      .dmp-qr {
        align-self: center; width: 200px; height: 200px; border-radius: 10px;
        background: #fff; object-fit: contain;
      }
      .dmp-login-tip { font-size: 12px; color: var(--dsw-alias-label-secondary); text-align: center; line-height: 1.5; }
      .dmp-account-card { display: flex; align-items: center; gap: 12px; }
      .dmp-avatar {
        width: 44px; height: 44px; border-radius: 50%; object-fit: cover; flex: none;
        background: var(--dsw-alias-bg-layer-2);
      }
    `;

    function MusicIcon({ size = 20, active = false }) {
      const stroke = active ? 'var(--dsw-alias-brand-primary)' : 'currentColor';
      return h(
        'svg',
        {
          width: size,
          height: size,
          viewBox: '0 0 24 24',
          fill: 'none',
          stroke,
          strokeWidth: 1.8,
          strokeLinecap: 'round',
          strokeLinejoin: 'round',
          'aria-hidden': true,
          style: { display: 'block' },
        },
        h('path', { d: 'M9 18V5l11-2v13' }),
        h('circle', { cx: 6, cy: 18, r: 3 }),
        h('circle', { cx: 17, cy: 16, r: 3 }),
      );
    }

    function coverOf(song) {
      if (!song) return '';
      if (song.pic) return song.pic;
      if (song.picId) return `https://api.injahow.cn/meting/?server=netease&type=pic&id=${song.picId}`;
      return '';
    }

    /**
     * The player lives outside the React tree so that switching to another main
     * panel (which unmounts this component) does not stop the audio.
     */
    const player = {
      audio: null,
      current: null,
      songs: [],
      listTitle: '搜索歌曲开始聆听',
      searchCache: { songs: [], title: '搜索歌曲开始聆听' },
      chartCache: { songs: [], title: '网易云热歌榜' },
      loading: false,
      status: '',
      playing: false,
      progress: 0,
      duration: 0,
      volume: 0.8,
      quality: 'auto',
      actualBr: 0,
      tab: 'search',
      query: '',
      searchHistory: loadHistory(),
      mode: loadMode(),
      playlists: [],
      activePlaylist: 'favorites',
      menuSong: null,
      newPlaylistName: '',
      libraryLoaded: false,
      account: { loggedIn: false, profile: null },
      showLogin: false,
      loginKey: '',
      loginQr: '',
      loginStatus: '',
      loginTimer: 0,
      chartLoaded: false,
      searchToken: 0,
      listeners: new Set(),

      set(patch) {
        const changed = [];
        for (const key of Object.keys(patch)) {
          if (this[key] !== patch[key]) {
            this[key] = patch[key];
            changed.push(key);
          }
        }
        if (changed.length > 0) this.emit(changed);
      },

      emit(changed) {
        for (const listener of Array.from(this.listeners)) listener(changed);
      },

      subscribe(listener) {
        this.listeners.add(listener);
        return () => this.listeners.delete(listener);
      },

      ensureAudio() {
        if (this.audio) return this.audio;
        const audio = new Audio();
        audio.preload = 'none';
        audio.volume = this.volume;
        audio.addEventListener('play', () => this.set({ playing: true }));
        audio.addEventListener('pause', () => this.set({ playing: false }));
        audio.addEventListener('timeupdate', () => this.set({ progress: audio.currentTime }));
        audio.addEventListener('loadedmetadata', () => {
          if (Number.isFinite(audio.duration)) this.set({ duration: audio.duration });
        });
        audio.addEventListener('ended', () => this.handleEnded());
        audio.addEventListener('error', () => {
          if (this.current) this.set({ status: '该歌曲暂时无法播放（可能受版权限制），试试下一首', playing: false });
        });
        this.audio = audio;
        return audio;
      },

      async play(song) {
        const audio = this.ensureAudio();
        this.set({
          status: '',
          current: song,
          progress: 0,
          actualBr: 0,
          duration: song.duration ? song.duration / 1000 : 0,
        });
        let url = '';
        try {
          const response = await fetch(
            `/api/dsh-music/url?id=${song.id}&br=${encodeURIComponent(this.quality)}`,
          );
          const payload = await response.json();
          if (!response.ok || !payload.url) throw new Error(payload.error || '没有可用音源');
          url = payload.url;
          this.set({ actualBr: payload.br || 0 });
        } catch (error) {
          this.set({ status: error.message || String(error), playing: false });
          return;
        }
        audio.src = url;
        try {
          await audio.play();
          this.set({ playing: true });
        } catch (error) {
          this.set({ status: '浏览器阻止了自动播放，请再点一次播放按钮', playing: false });
        }
      },

      toggleSong(song) {
        const audio = this.audio;
        if (this.current && this.current.id === song.id && audio && audio.src) {
          if (audio.paused) {
            audio.play().then(() => this.set({ playing: true })).catch(() => this.set({ status: '播放失败，试试下一首' }));
          } else {
            audio.pause();
            this.set({ playing: false });
          }
          return;
        }
        this.play(song);
      },

      togglePlay() {
        const audio = this.audio;
        if (!this.current) {
          if (this.songs.length > 0) this.play(this.songs[0]);
          return;
        }
        if (!audio) return;
        if (audio.paused) {
          audio.play().then(() => this.set({ playing: true })).catch(() => this.set({ status: '播放失败，试试下一首' }));
        } else {
          audio.pause();
          this.set({ playing: false });
        }
      },

      step(delta) {
        if (this.songs.length === 0) return;
        const index = this.current ? this.songs.findIndex((item) => item.id === this.current.id) : -1;
        const next = index < 0 ? 0 : (index + delta + this.songs.length) % this.songs.length;
        this.play(this.songs[next]);
      },

      handleEnded() {
        if (this.mode === 'single') {
          const audio = this.audio;
          if (audio) {
            audio.currentTime = 0;
            audio.play().then(() => this.set({ playing: true })).catch(() => this.set({ playing: false }));
          }
          return;
        }
        if (this.mode === 'sequence' && this.songs.length > 0 && this.current) {
          const index = this.songs.findIndex((item) => item.id === this.current.id);
          if (index >= 0 && index === this.songs.length - 1) {
            this.set({ playing: false, status: '已播放到列表末尾' });
            return;
          }
        }
        this.step(1);
      },

      cycleMode() {
        const next = MODE_ORDER[(MODE_ORDER.indexOf(this.mode) + 1) % MODE_ORDER.length];
        saveMode(next);
        this.set({ mode: next, status: `播放模式：${MODE_LABEL[next]}` });
      },

      async loadLibrary() {
        try {
          const response = await fetch('/api/dsh-music/library');
          const payload = await response.json();
          if (!response.ok) throw new Error(payload.error || '歌单加载失败');
          this.set({ playlists: payload.playlists || [], libraryLoaded: true });
        } catch (error) {
          this.set({ status: error.message || String(error) });
        }
      },

      async loadAccount() {
        try {
          const response = await fetch('/api/dsh-music/account');
          const payload = await response.json();
          this.set({ account: { loggedIn: !!payload.loggedIn, profile: payload.profile || null } });
        } catch {
          // keep the current state when the Host is briefly unavailable
        }
      },

      stopLoginPoll() {
        if (this.loginTimer) {
          clearInterval(this.loginTimer);
          this.loginTimer = 0;
        }
      },

      async startLogin() {
        this.stopLoginPoll();
        this.set({ showLogin: true, loginKey: '', loginQr: '', loginStatus: '正在获取二维码…' });
        try {
          const response = await fetch('/api/dsh-music/login/qr');
          const payload = await response.json();
          if (!response.ok || !payload.key) throw new Error(payload.error || '获取二维码失败');
          this.set({ loginKey: payload.key, loginQr: payload.qrImage, loginStatus: '用网易云音乐 App 扫码' });
          this.pollLogin(payload.key);
        } catch (error) {
          this.set({ loginStatus: error.message || String(error) });
        }
      },

      pollLogin(key) {
        const tick = async () => {
          if (this.loginKey !== key || !this.showLogin) return;
          try {
            const response = await fetch(`/api/dsh-music/login/check?key=${encodeURIComponent(key)}`);
            const payload = await response.json();
            if (this.loginKey !== key) return;
            if (payload.status === 'ok') {
              this.stopLoginPoll();
              this.set({
                showLogin: false,
                loginKey: '',
                loginQr: '',
                loginStatus: '',
                account: { loggedIn: true, profile: payload.profile || null },
                status: `已登录网易云：${payload.profile?.nickname || '账号'}`,
              });
            } else if (payload.status === 'expired') {
              this.stopLoginPoll();
              this.set({ loginStatus: '二维码已过期，点下面的按钮重新获取' });
            } else if (payload.status === 'confirmed') {
              this.set({ loginStatus: '已扫码，请在手机上确认登录' });
            }
          } catch {
            // transient failure: the next tick retries
          }
        };
        this.loginTimer = setInterval(tick, 2000);
        tick();
      },

      closeLogin() {
        this.stopLoginPoll();
        this.set({ showLogin: false, loginKey: '', loginQr: '', loginStatus: '' });
      },

      async logout() {
        try {
          await fetch('/api/dsh-music/logout');
        } catch {
          // still clear the local view
        }
        this.set({ account: { loggedIn: false, profile: null }, status: '已退出网易云账号' });
      },

      async createPlaylist(name) {
        const trimmed = (name || '').trim();
        if (!trimmed) return undefined;
        try {
          const response = await fetch('/api/dsh-music/library/create', {
            method: 'POST',
            headers: { 'content-type': 'application/json' },
            body: JSON.stringify({ name: trimmed }),
          });
          const payload = await response.json();
          if (!response.ok) throw new Error(payload.error || '新建歌单失败');
          const playlists = payload.playlists || this.playlists;
          this.set({ playlists, newPlaylistName: '' });
          return playlists[playlists.length - 1];
        } catch (error) {
          this.set({ status: error.message || String(error) });
          return undefined;
        }
      },

      async addToPlaylist(playlistId, song) {
        try {
          const response = await fetch('/api/dsh-music/library/add', {
            method: 'POST',
            headers: { 'content-type': 'application/json' },
            body: JSON.stringify({ playlistId, song }),
          });
          const payload = await response.json();
          if (!response.ok) throw new Error(payload.error || '收藏失败');
          this.set({ playlists: payload.playlists || this.playlists, menuSong: null, status: '已加入歌单' });
        } catch (error) {
          this.set({ status: error.message || String(error) });
        }
      },

      async removeFromPlaylist(playlistId, songId) {
        try {
          const response = await fetch('/api/dsh-music/library/remove', {
            method: 'POST',
            headers: { 'content-type': 'application/json' },
            body: JSON.stringify({ playlistId, songId }),
          });
          const payload = await response.json();
          if (!response.ok) throw new Error(payload.error || '移除失败');
          this.set({ playlists: payload.playlists || this.playlists });
        } catch (error) {
          this.set({ status: error.message || String(error) });
        }
      },

      async deletePlaylist(playlistId) {
        if (playlistId === 'favorites') return;
        try {
          const response = await fetch('/api/dsh-music/library/delete', {
            method: 'POST',
            headers: { 'content-type': 'application/json' },
            body: JSON.stringify({ playlistId }),
          });
          const payload = await response.json();
          if (!response.ok) throw new Error(payload.error || '删除失败');
          this.set({
            playlists: payload.playlists || this.playlists,
            activePlaylist: this.activePlaylist === playlistId ? 'favorites' : this.activePlaylist,
          });
        } catch (error) {
          this.set({ status: error.message || String(error) });
        }
      },

      activePlaylistSongs() {
        const playlist = this.playlists.find((item) => item.id === this.activePlaylist);
        return playlist ? playlist.songs : [];
      },

      async reloadCurrent(nextQuality) {
        const audio = this.audio;
        if (!audio || !this.current) return;
        const at = audio.currentTime || 0;
        const wasPlaying = !audio.paused;
        try {
          const response = await fetch(
            `/api/dsh-music/url?id=${this.current.id}&br=${encodeURIComponent(nextQuality)}`,
          );
          const payload = await response.json();
          if (!response.ok || !payload.url) throw new Error(payload.error || '这首暂时没有可用音源');
          audio.src = payload.url;
          this.set({ actualBr: payload.br || 0 });
          const onMeta = () => {
            audio.removeEventListener('loadedmetadata', onMeta);
            if (at > 0) audio.currentTime = Math.min(at, audio.duration || at);
            if (wasPlaying) audio.play().then(() => this.set({ playing: true })).catch(() => this.set({ playing: false }));
          };
          audio.addEventListener('loadedmetadata', onMeta);
          const label = QUALITY_LABEL[payload.br];
          if (nextQuality !== 'auto' && payload.br && String(payload.br) !== String(nextQuality)) {
            this.set({ status: `这首最高只有 ${label || Math.round(payload.br / 1000) + 'K'}，已按可用音质播放` });
          } else {
            this.set({ status: label ? `已切到 ${label}` : '' });
          }
        } catch (error) {
          this.set({ status: error.message || String(error) });
        }
      },

      changeQuality(value) {
        this.set({ quality: value });
        this.reloadCurrent(value);
      },

      setVolume(value) {
        this.set({ volume: value });
        if (this.audio) this.audio.volume = value;
      },

      seek(seconds) {
        if (this.audio) this.audio.currentTime = seconds;
        this.set({ progress: seconds });
      },

      async search() {
        const keyword = this.query.trim();
        if (!keyword) return;
        const token = ++this.searchToken;
        this.set({ loading: true, status: '' });
        try {
          const response = await fetch(`/api/dsh-music/search?q=${encodeURIComponent(keyword)}`);
          const payload = await response.json();
          if (token !== this.searchToken) return;
          if (!response.ok) throw new Error(payload.error || '搜索失败');
          const found = payload.songs || [];
          const title = `“${keyword}” 的搜索结果`;
          this.searchCache = { songs: found, title };
          this.set({
            songs: found,
            listTitle: title,
            status: found.length > 0 ? '' : '没有找到相关歌曲，换个关键词试试',
          });
          this.rememberKeyword(keyword);
        } catch (error) {
          if (token !== this.searchToken) return;
          this.set({ status: error.message || String(error) });
        } finally {
          if (token === this.searchToken) this.set({ loading: false });
        }
      },

      async loadChart() {
        this.set({ loading: true, status: '' });
        try {
          const response = await fetch('/api/dsh-music/playlist?id=3778678');
          const payload = await response.json();
          if (!response.ok) throw new Error(payload.error || '歌单加载失败');
          const found = payload.songs || [];
          this.chartCache = { songs: found, title: '网易云热歌榜' };
          this.set({ songs: found, listTitle: '网易云热歌榜', chartLoaded: true });
        } catch (error) {
          this.set({ status: error.message || String(error) });
        } finally {
          this.set({ loading: false });
        }
      },

      rememberKeyword(keyword) {
        const list = [keyword, ...this.searchHistory.filter((item) => item !== keyword)].slice(0, HISTORY_LIMIT);
        saveHistory(list);
        this.set({ searchHistory: list });
      },

      clearHistory() {
        saveHistory([]);
        this.set({ searchHistory: [] });
      },

      runSearch(keyword) {
        this.set({ query: keyword });
        this.search();
      },

      openTab(tab) {
        if (tab === 'library') {
          this.set({ tab });
          if (!this.libraryLoaded) this.loadLibrary();
          return;
        }
        const cache = tab === 'chart' ? this.chartCache : this.searchCache;
        this.set({ tab, songs: cache.songs, listTitle: cache.title });
        if (tab === 'chart' && !this.chartLoaded) this.loadChart();
      },
    };

    const PANEL_KEYS = new Set([
      'songs', 'listTitle', 'loading', 'status', 'current', 'playing', 'quality', 'tab', 'query', 'searchHistory',
      'playlists', 'activePlaylist', 'menuSong', 'newPlaylistName', 'mode', 'libraryLoaded',
      'account', 'showLogin', 'loginQr', 'loginStatus',
    ]);
    const BAR_KEYS = new Set(['current', 'playing', 'progress', 'duration', 'volume', 'actualBr', 'mode']);

    function usePlayerState(keys) {
      const [, force] = useReducer((x) => x + 1, 0);
      useEffect(() => player.subscribe((changed) => {
        if (!keys || changed.some((key) => keys.has(key))) force();
      }), []);
    }

    function PlayerBar() {
      usePlayerState(BAR_KEYS);
      const { current, playing, progress, duration, volume, actualBr, mode } = player;
      return h(
        'div',
        { className: 'dmp-bar' },
        h(
          'div',
          { className: 'dmp-now' },
          current
            ? h(
                React.Fragment,
                null,
                coverOf(current)
                  ? h('img', { className: 'dmp-cover', src: coverOf(current), alt: '' })
                  : h('div', { className: 'dmp-cover' }),
                h(
                  'div',
                  { style: { minWidth: 0 } },
                  h('div', { className: 'dmp-name' }, displayName(current)),
                  h('div', { className: 'dmp-sub' }, current.artist || '未知歌手'),
                ),
              )
            : h('div', { className: 'dmp-hint', style: { padding: 0 } }, '未在播放'),
        ),
        h(
          'div',
          { className: 'dmp-controls' },
          h(
            'button',
            {
              className: 'dmp-ctrl mode',
              title: `播放模式：${MODE_LABEL[mode]}（点击切换）`,
              onClick: () => player.cycleMode(),
            },
            MODE_ICON[mode],
          ),
          h('button', { className: 'dmp-ctrl', title: '上一首', onClick: () => player.step(-1) }, '⏮'),
          h(
            'button',
            { className: 'dmp-ctrl main', title: playing ? '暂停' : '播放', onClick: () => player.togglePlay() },
            playing ? '❚❚' : '▶',
          ),
          h('button', { className: 'dmp-ctrl', title: '下一首', onClick: () => player.step(1) }, '⏭'),
        ),
        actualBr
          ? h(
              'div',
              { className: 'dmp-br', title: '当前实际音质' },
              QUALITY_LABEL[actualBr] || `${Math.round(actualBr / 1000)}K`,
            )
          : null,
        h(
          'div',
          { className: 'dmp-progress' },
          h('span', { className: 'dmp-time' }, FORMAT_TIME(progress)),
          h('input', {
            className: 'dmp-range',
            type: 'range',
            min: 0,
            max: duration > 0 ? duration : 100,
            step: 0.1,
            value: Math.min(progress, duration || 100),
            disabled: !current,
            onChange: (event) => player.seek(Number(event.target.value)),
          }),
          h('span', { className: 'dmp-time' }, FORMAT_TIME(duration)),
        ),
        h('input', {
          className: 'dmp-range dmp-vol',
          type: 'range',
          min: 0,
          max: 1,
          step: 0.01,
          value: volume,
          title: '音量',
          onChange: (event) => player.setVolume(Number(event.target.value)),
        }),
      );
    }

    function SongRow({ song, index, current, playing, onFavorite, library }) {
      const isCurrent = current && current.id === song.id;
      const playingThis = isCurrent && playing;
      return h(
        'div',
        {
          className: `dmp-row${isCurrent ? ' playing' : ''}`,
          title: playingThis ? '点击暂停' : '点击播放',
          onClick: () => player.toggleSong(song),
        },
        h('div', { className: 'dmp-idx' }, playingThis ? '♪' : String(index + 1)),
        coverOf(song)
          ? h('img', { className: 'dmp-cover', src: coverOf(song), alt: '', loading: 'lazy' })
          : h('div', { className: 'dmp-cover' }),
        h(
          'div',
          { className: 'dmp-meta' },
          h('div', { className: 'dmp-name' }, displayName(song)),
          h('div', { className: 'dmp-sub' }, [song.artist, song.album].filter(Boolean).join(' · ') || '未知歌手'),
        ),
        h('div', { className: 'dmp-dur' }, song.duration ? FORMAT_TIME(song.duration / 1000) : ''),
        library
          ? h(
              'button',
              {
                className: 'dmp-fav',
                title: '从歌单移除',
                onClick: (event) => {
                  event.stopPropagation();
                  player.removeFromPlaylist(player.activePlaylist, song.id);
                },
              },
              '✕',
            )
          : h(
              'button',
              {
                className: 'dmp-fav',
                title: '收藏到歌单',
                onClick: (event) => {
                  event.stopPropagation();
                  if (onFavorite) onFavorite();
                },
              },
              '♥',
            ),
      );
    }

    function LibraryView() {
      usePlayerState(PANEL_KEYS);
      const { playlists, activePlaylist, newPlaylistName, current, playing } = player;
      const songs = player.activePlaylistSongs();
      const active = playlists.find((item) => item.id === activePlaylist);
      return h(
        'div',
        { className: 'dmp-body' },
        h(
          'div',
          { className: 'dmp-plbar' },
          playlists.map((playlist) =>
            h(
              'button',
              {
                key: playlist.id,
                className: `dmp-chip${playlist.id === activePlaylist ? ' active' : ''}`,
                onClick: () => player.set({ activePlaylist: playlist.id }),
              },
              `${playlist.name} · ${playlist.songs.length}`,
            ),
          ),
        ),
        h(
          'div',
          { className: 'dmp-plhead' },
          h(
            'span',
            { className: 'dmp-hint', style: { padding: 0, textAlign: 'left' } },
            active ? `${active.name} · ${songs.length} 首` : '选择歌单',
          ),
          activePlaylist !== 'favorites'
            ? h(
                'button',
                { className: 'dmp-chip dmp-chip-clear', onClick: () => player.deletePlaylist(activePlaylist) },
                '删除歌单',
              )
            : null,
        ),
        h(
          'div',
          { className: 'dmp-newpl' },
          h('input', {
            value: newPlaylistName,
            placeholder: '新建歌单名称',
            onChange: (event) => player.set({ newPlaylistName: event.target.value }),
            onKeyDown: (event) => {
              if (event.key === 'Enter') player.createPlaylist(newPlaylistName);
            },
          }),
          h('button', { className: 'dmp-btn', onClick: () => player.createPlaylist(newPlaylistName) }, '新建'),
        ),
        songs.length === 0
          ? h('div', { className: 'dmp-hint' }, '这个歌单还是空的，去搜索页点行尾的 ♥ 收藏')
          : songs.map((song, index) =>
              h(SongRow, { key: `${song.id}-${index}`, song, index, current, playing, library: true }),
            ),
      );
    }

    function MusicPanel() {
      usePlayerState(PANEL_KEYS);
      useEffect(() => {
        player.ensureAudio();
        player.loadAccount();
      }, []);
      const {
        songs, listTitle, loading, status, current, playing, quality, tab, query, searchHistory,
        playlists, activePlaylist, menuSong, newPlaylistName,
        account, showLogin, loginQr, loginStatus,
      } = player;

      const rows = songs.map((song, index) =>
        h(SongRow, {
          key: `${song.id}-${index}`,
          song,
          index,
          current,
          playing,
          onFavorite: () => player.set({ menuSong: song }),
        }),
      );

      return h(
        'div',
        { className: 'dmp-root' },
        h('style', null, CSS),
        h(
          'div',
          { className: 'dmp-bg' },
          current && coverOf(current)
            ? h('div', { className: 'dmp-coverbg', style: { backgroundImage: `url("${coverOf(current)}")` } })
            : null,
          h('div', { className: 'dmp-scrim' }),
        ),
        h(
          'div',
          { className: 'dmp-content' },
          h(
            'div',
            { className: 'dmp-head' },
            h(
              'div',
              { className: 'dmp-topline' },
              h('div', { className: 'dmp-title' }, '音乐'),
              h(
                'button',
                {
                  className: `dmp-account${account.loggedIn ? ' on' : ''}`,
                  title: account.loggedIn ? '网易云账号' : '登录网易云账号（登录后可听完整音质）',
                  onClick: () => {
                    if (account.loggedIn) player.set({ showLogin: true, loginStatus: '' });
                    else player.startLogin();
                  },
                },
                account.loggedIn ? account.profile?.nickname || '已登录' : '登录网易云',
              ),
            ),
            h(
              'div',
              { className: 'dmp-tabs' },
              h(
                'button',
                { className: `dmp-tab${tab === 'search' ? ' active' : ''}`, onClick: () => player.openTab('search') },
                '搜索',
              ),
              h(
                'button',
                { className: `dmp-tab${tab === 'chart' ? ' active' : ''}`, onClick: () => player.openTab('chart') },
                '热歌榜',
              ),
              h(
                'button',
                {
                  className: `dmp-tab${tab === 'library' ? ' active' : ''}`,
                  onClick: () => player.openTab('library'),
                },
                '收藏',
              ),
              h(
                'select',
                {
                  className: 'dmp-quality',
                  value: quality,
                  title: '音质：自动会按这首歌实际可用的最高档次拉取（非会员最高 320K）',
                  onChange: (event) => player.changeQuality(event.target.value),
                },
                h('option', { value: 'auto' }, '音质：自动（最高）'),
                h('option', { value: '320000' }, '高品质 320K'),
                h('option', { value: '192000' }, '较高 192K'),
                h('option', { value: '128000' }, '标准 128K'),
              ),
            ),
            tab === 'search'
              ? h(
                  'div',
                  { className: 'dmp-search' },
                  h('input', {
                    value: query,
                    placeholder: '搜索歌曲、歌手，回车确认',
                    onChange: (event) => player.set({ query: event.target.value }),
                    onKeyDown: (event) => {
                      if (event.key === 'Enter') player.search();
                    },
                  }),
                  h(
                    'button',
                    { className: 'dmp-btn primary', onClick: () => player.search(), disabled: loading },
                    loading ? '搜索中' : '搜索',
                  ),
                )
              : null,
          ),
          tab === 'library'
            ? h(LibraryView)
            : h(
                'div',
                { className: 'dmp-body' },
                tab === 'search' && searchHistory.length > 0
                  ? h(
                      'div',
                      { className: 'dmp-history' },
                      h('span', { className: 'dmp-history-label' }, '最近搜索'),
                      searchHistory.map((keyword) =>
                        h(
                          'button',
                          {
                            key: keyword,
                            className: 'dmp-chip',
                            title: `重新搜索 ${keyword}`,
                            onClick: () => player.runSearch(keyword),
                          },
                          keyword,
                        ),
                      ),
                      h(
                        'button',
                        {
                          className: 'dmp-chip dmp-chip-clear',
                          title: '清空搜索历史',
                          onClick: () => player.clearHistory(),
                        },
                        '清空',
                      ),
                    )
                  : null,
                h('div', { className: 'dmp-hint' }, listTitle),
                status ? h('div', { className: 'dmp-hint dmp-error' }, status) : null,
                rows,
              ),
          h(PlayerBar),
          menuSong
            ? h(
                'div',
                { className: 'dmp-mask', onClick: () => player.set({ menuSong: null }) },
                h(
                  'div',
                  { className: 'dmp-modal', onClick: (event) => event.stopPropagation() },
                  h('div', { className: 'dmp-modal-title' }, `把《${displayName(menuSong)}》加入歌单`),
                  h(
                    'div',
                    { className: 'dmp-modal-list' },
                    playlists.map((playlist) =>
                      h(
                        'button',
                        {
                          key: playlist.id,
                          className: 'dmp-modal-item',
                          onClick: () => player.addToPlaylist(playlist.id, menuSong),
                        },
                        h('span', null, playlist.name),
                        h('span', { className: 'dmp-sub' }, `${playlist.songs.length} 首`),
                      ),
                    ),
                  ),
                  h(
                    'div',
                    { className: 'dmp-modal-new' },
                    h('input', {
                      value: newPlaylistName,
                      placeholder: '新建歌单',
                      onChange: (event) => player.set({ newPlaylistName: event.target.value }),
                      onKeyDown: (event) => {
                        if (event.key === 'Enter') player.createPlaylist(newPlaylistName);
                      },
                    }),
                    h('button', { className: 'dmp-btn primary', onClick: () => player.createPlaylist(newPlaylistName) }, '新建'),
                  ),
                  h('button', { className: 'dmp-btn', onClick: () => player.set({ menuSong: null }) }, '取消'),
                ),
              )
            : null,
          showLogin
            ? h(
                'div',
                { className: 'dmp-mask', onClick: () => player.closeLogin() },
                h(
                  'div',
                  { className: 'dmp-modal', onClick: (event) => event.stopPropagation() },
                  h(
                    'div',
                    { className: 'dmp-modal-title' },
                    account.loggedIn ? '网易云账号' : '登录网易云音乐',
                  ),
                  account.loggedIn
                    ? h(
                        React.Fragment,
                        null,
                        h(
                          'div',
                          { className: 'dmp-account-card' },
                          account.profile?.avatar
                            ? h('img', { className: 'dmp-avatar', src: account.profile.avatar, alt: '' })
                            : h('div', { className: 'dmp-avatar' }),
                          h(
                            'div',
                            null,
                            h('div', { className: 'dmp-name' }, account.profile?.nickname || '已登录'),
                            h('div', { className: 'dmp-sub' }, '登录后可播放完整音质'),
                          ),
                        ),
                        h(
                          'button',
                          {
                            className: 'dmp-btn',
                            onClick: () => {
                              player.logout();
                              player.closeLogin();
                            },
                          },
                          '退出登录',
                        ),
                      )
                    : h(
                        React.Fragment,
                        null,
                        loginQr ? h('img', { className: 'dmp-qr', src: loginQr, alt: '登录二维码' }) : null,
                        h('div', { className: 'dmp-login-tip' }, loginStatus || '正在准备二维码…'),
                        h(
                          'div',
                          { className: 'dmp-modal-new' },
                          h(
                            'button',
                            { className: 'dmp-btn', onClick: () => player.startLogin() },
                            '重新获取二维码',
                          ),
                          h('button', { className: 'dmp-btn', onClick: () => player.closeLogin() }, '关闭'),
                        ),
                      ),
                ),
              )
            : null,
        ),
      );
    }

    return {
      inject: ['slots'],
      apply(ctx) {
        // Register only after each slot exists: during a cold web boot the slots
        // arrive later than plugin activation, and registering eagerly throws —
        // which fails the whole boot entry.
        try {
          ctx.effect(() =>
            ctx.slots.inject('sidebar.panellist', () =>
              ctx.slots.register(
                { name: 'sidebar.panellist', id: 'music', order: 20, label: '音乐' },
                MusicIcon,
              ),
            ),
          );
        } catch (error) {
          console.warn('[dsh-music] sidebar 图标注册失败', error);
        }
        try {
          ctx.effect(() =>
            ctx.slots.inject('main', () => ctx.slots.register({ name: 'main', key: 'music' }, MusicPanel)),
          );
        } catch (error) {
          console.warn('[dsh-music] 主面板注册失败', error);
        }
      },
    };
  },
});
