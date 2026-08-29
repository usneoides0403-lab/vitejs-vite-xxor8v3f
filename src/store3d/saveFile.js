/**
 * ファイルの保存。
 *
 * 通常のブラウザでは <a download> で保存する。
 * claude.ai の Artifact のようにページからの直接ダウンロードが禁じられた
 * 環境では、ホストが用意する保存API（downloads）に切り替える。
 */

let hostPromise = null;

function hostDownloads() {
  if (!hostPromise) {
    hostPromise =
      typeof window.claude?.use === 'function'
        ? Promise.resolve(window.claude.use('downloads')).catch(() => null)
        : Promise.resolve(null);
  }
  return hostPromise;
}

/** `data:` URL を Blob に変換する */
export function dataUrlToBlob(dataUrl) {
  const [head, b64] = dataUrl.split(',');
  const mime = head.match(/:(.*?);/)?.[1] || 'application/octet-stream';
  const bin = atob(b64);
  const bytes = new Uint8Array(bin.length);
  for (let i = 0; i < bin.length; i++) bytes[i] = bin.charCodeAt(i);
  return new Blob([bytes], { type: mime });
}

/**
 * ファイルを保存する。
 * 戻り値: 'saved' … 保存した / 'declined' … 利用者が取りやめた
 * 失敗した場合は Error を投げる。
 */
export async function saveFile(filename, blob) {
  const host = await hostDownloads();

  if (host) {
    try {
      await host.save({ filename, data: blob });
      return 'saved';
    } catch (err) {
      if (err?.code === 'declined') return 'declined';
      throw new Error(err?.message || '保存できませんでした');
    }
  }

  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  a.click();
  window.setTimeout(() => URL.revokeObjectURL(url), 1000);
  return 'saved';
}
