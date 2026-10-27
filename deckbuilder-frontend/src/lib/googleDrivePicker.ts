/**
 * Minimal Google Drive Picker for proxy art.
 * Requires VITE_GOOGLE_CLIENT_ID and VITE_GOOGLE_API_KEY.
 * Uses the drive.file scope so only user-selected files are accessible.
 */

const CLIENT_ID = import.meta.env.VITE_GOOGLE_CLIENT_ID as string | undefined;
const API_KEY = import.meta.env.VITE_GOOGLE_API_KEY as string | undefined;
const APP_ID = import.meta.env.VITE_GOOGLE_APP_ID as string | undefined;
const SCOPE = "https://www.googleapis.com/auth/drive.file";

declare global {
  interface Window {
    gapi?: any;
    google?: any;
  }
}

function loadScript(src: string): Promise<void> {
  return new Promise((resolve, reject) => {
    if (document.querySelector(`script[src="${src}"]`)) {
      resolve();
      return;
    }
    const s = document.createElement("script");
    s.src = src;
    s.async = true;
    s.onload = () => resolve();
    s.onerror = () => reject(new Error(`Failed to load ${src}`));
    document.head.appendChild(s);
  });
}

let scriptsReady: Promise<void> | null = null;

function ensureScripts(): Promise<void> {
  if (scriptsReady) return scriptsReady;
  scriptsReady = (async () => {
    await loadScript("https://apis.google.com/js/api.js");
    await loadScript("https://accounts.google.com/gsi/client");
    await new Promise<void>((resolve) => {
      window.gapi.load("picker", () => resolve());
    });
  })();
  return scriptsReady;
}

export function isDrivePickerConfigured(): boolean {
  return Boolean(CLIENT_ID && API_KEY);
}

/**
 * Open the Google Drive Picker (images only) and return the selected file.
 * Returns null if the user cancels.
 */
export async function pickDriveImage(): Promise<File | null> {
  if (!CLIENT_ID || !API_KEY) {
    throw new Error(
      "Google Drive picker is not configured. Set VITE_GOOGLE_CLIENT_ID and VITE_GOOGLE_API_KEY."
    );
  }
  await ensureScripts();

  const token = await new Promise<string>((resolve, reject) => {
    const client = window.google.accounts.oauth2.initTokenClient({
      client_id: CLIENT_ID,
      scope: SCOPE,
      callback: (resp: { access_token?: string; error?: string }) => {
        if (resp.error || !resp.access_token) {
          reject(new Error(resp.error || "Google sign-in cancelled"));
          return;
        }
        resolve(resp.access_token);
      },
    });
    client.requestAccessToken({ prompt: "" });
  });

  const file = await new Promise<File | null>((resolve, reject) => {
    const view = new window.google.picker.DocsView(window.google.picker.ViewId.DOCS);
    view.setMimeTypes("image/png,image/jpeg,image/webp,image/gif");
    view.setIncludeFolders(true);

    const picker = new window.google.picker.PickerBuilder()
      .setOAuthToken(token)
      .setDeveloperKey(API_KEY)
      .setAppId(APP_ID || "")
      .addView(view)
      .setCallback((data: any) => {
        if (data.action === window.google.picker.Action.PICKED) {
          const doc = data.docs?.[0];
          if (!doc?.id) {
            resolve(null);
            return;
          }
          // Download with the token
          void (async () => {
            try {
              const res = await fetch(
                `https://www.googleapis.com/drive/v3/files/${doc.id}?alt=media`,
                { headers: { Authorization: `Bearer ${token}` } }
              );
              if (!res.ok) throw new Error(`Drive download failed (${res.status})`);
              const blob = await res.blob();
              const name = doc.name || "drive-image.jpg";
              const type = blob.type || "image/jpeg";
              resolve(new File([blob], name, { type }));
            } catch (err) {
              reject(err);
            }
          })();
        } else if (data.action === window.google.picker.Action.CANCEL) {
          resolve(null);
        }
      })
      .build();
    picker.setVisible(true);
  });

  return file;
}
