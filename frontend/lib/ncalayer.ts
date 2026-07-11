"use client";

// NCALayer client — signs base64 data via the local desktop app over WebSocket
// (wss://127.0.0.1:13579). Real integration, not a mock: it calls
// kz.gov.pki.knca.commonUtils.createCMSSignatureFromBase64 and returns the CMS.
// If NCALayer isn't running, it rejects with NCALAYER_NOT_FOUND within `timeoutMs`.

export class NcaLayerError extends Error {}
export const NCALAYER_NOT_FOUND = "NCALAYER_NOT_FOUND";
export const NCALAYER_CANCELLED = "NCALAYER_CANCELLED";

const NCALAYER_URL = "wss://127.0.0.1:13579";

export function signCmsBase64(
  base64Data: string,
  timeoutMs = 2000
): Promise<string> {
  return new Promise((resolve, reject) => {
    let settled = false;
    let ws: WebSocket;
    const done = (fn: () => void) => {
      if (settled) return;
      settled = true;
      clearTimeout(timer);
      try {
        ws?.close();
      } catch {
        /* ignore */
      }
      fn();
    };

    const timer = setTimeout(
      () => done(() => reject(new NcaLayerError(NCALAYER_NOT_FOUND))),
      timeoutMs
    );

    try {
      ws = new WebSocket(NCALAYER_URL);
    } catch {
      done(() => reject(new NcaLayerError(NCALAYER_NOT_FOUND)));
      return;
    }

    ws.onopen = () => {
      ws.send(
        JSON.stringify({
          module: "kz.gov.pki.knca.commonUtils",
          method: "createCMSSignatureFromBase64",
          args: ["PKCS12", "SIGNATURE", base64Data, true],
        })
      );
    };

    ws.onmessage = (ev) => {
      let data: Record<string, unknown> = {};
      try {
        data = JSON.parse(ev.data as string);
      } catch {
        done(() => reject(new NcaLayerError(NCALAYER_CANCELLED)));
        return;
      }
      const code = String(data.code ?? data.status ?? "200");
      const cms =
        (data.responseObject as string) ??
        (data.result as string) ??
        ((data.body as Record<string, unknown> | undefined)?.result as string);
      if (code !== "200" || !cms) {
        done(() =>
          reject(
            new NcaLayerError(
              (data.message as string) ?? NCALAYER_CANCELLED
            )
          )
        );
        return;
      }
      done(() => resolve(cms));
    };

    ws.onerror = () =>
      done(() => reject(new NcaLayerError(NCALAYER_NOT_FOUND)));
  });
}
