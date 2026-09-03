export class QBitClient {
  constructor(config) {
    this.config = config;
    this.base = QBitClient.makeBase(config);
  }

  static makeBase(config) {
    let host = String(config.host || '').trim();
    if (!host) throw new Error('qBittorrent WebUI address is not configured.');
    if (!/^https?:\/\//i.test(host)) host = `${config.ssl ? 'https' : 'http'}://${host}`;
    return host.replace(/\/+$/, '');
  }

  async request(path, options = {}) {
    const responseType = options.responseType || 'json';
    const {responseType: _responseType, ...fetchOptions} = options;
    const headers = new Headers(options.headers || {});
    headers.set('Authorization', `Bearer ${this.config.apiKey}`);
    const response = await fetch(`${this.base}/api/v2/${path.replace(/^\//, '')}`, {
      ...fetchOptions,
      headers,
      credentials: 'omit'
    });
    const text = await response.text();
    if (!response.ok) {
      const detail = text.trim();
      const error = new Error(detail || `qBittorrent returned HTTP ${response.status}`);
      error.status = response.status;
      throw error;
    }
    if (!text) return null;
    return responseType === 'text' ? text : JSON.parse(text);
  }

  async test() {
    const version = await this.request('app/version', {responseType: 'text'});
    return version;
  }

  async torrents() {
    return this.request('torrents/info?sort=name');
  }

  async mainData() {
    return this.request('sync/maindata');
  }

  async start(hashes) {
    return this.action('torrents/start', hashes);
  }

  async stop(hashes) {
    return this.action('torrents/stop', hashes);
  }

  async forceStart(hashes, value = true) {
    return this.request('torrents/setForceStart', {
      method: 'POST',
      headers: {'Content-Type': 'application/x-www-form-urlencoded'},
      body: new URLSearchParams({hashes: hashes.join('|'), value: String(value)})
    });
  }

  async recheck(hashes) {
    return this.action('torrents/recheck', hashes);
  }

  async remove(hashes, deleteFiles = false) {
    return this.request('torrents/delete', {
      method: 'POST',
      headers: {'Content-Type': 'application/x-www-form-urlencoded'},
      body: new URLSearchParams({hashes: hashes.join('|'), deleteFiles: String(deleteFiles)})
    });
  }

  async action(endpoint, hashes) {
    return this.request(endpoint, {
      method: 'POST',
      headers: {'Content-Type': 'application/x-www-form-urlencoded'},
      body: new URLSearchParams({hashes: hashes.join('|')})
    });
  }

  async addUrl(url) {
    return this.request('torrents/add', {
      method: 'POST',
      headers: {'Content-Type': 'application/x-www-form-urlencoded'},
      body: new URLSearchParams({urls: url})
    });
  }

  async addFile(file) {
    const form = new FormData();
    form.append('torrents', file, file.name);
    return this.request('torrents/add', {method: 'POST', body: form});
  }

  async properties(hash) {
    return this.request(`torrents/properties?hash=${encodeURIComponent(hash)}`);
  }

  async pieceStates(hash) {
    return this.request(`torrents/pieceStates?hash=${encodeURIComponent(hash)}`);
  }
}
