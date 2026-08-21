import { useCallback, useEffect, useRef, useState } from 'react';
import { io, type Socket } from 'socket.io-client';

/**
 * Pareamento de um dispositivo WaVoIP (ler QR Code) de dentro do CRM.
 *
 * Por que existe: o WaVoIP NAO tem endpoint REST que devolva o QR. O QR chega
 * como evento no socket do proprio dispositivo (`device:init` / `device:connecting`).
 * E antes disso tem um passo que ninguem documenta: o dispositivo hiberna quando
 * fica sem uso, e nesse estado a API responde 503 `device_not_running` e o socket
 * simplesmente recusa a conexao ("websocket error"). Sem acordar o device primeiro,
 * nenhum QR aparece nunca.
 *
 * Fluxo: all_info -> se 503, /device/restart -> espera subir -> abre socket -> QR.
 *
 * O CallContext tambem mantem um socket, mas so do device do usuario logado. Este
 * hook serve pra tela de admin parear QUALQUER dispositivo (ex: o número da Camila,
 * cadastrado na conta dela). Dois sockets no mesmo token atrapalham o ack de
 * chamadas, entao quem chama este hook deve mante-lo ligado somente enquanto o
 * modal de pareamento estiver aberto — e usar o CallContext quando o device for
 * o do proprio usuario.
 */

const BASE = 'https://devices.wavoip.com';

export type WavoipPairingStatus =
  | 'idle' | 'waking' | 'connecting' | 'open' | 'close'
  | 'hibernating' | 'restarting' | 'BUILDING' | 'error';

interface DeviceInfo {
  name?: string;
  status?: string;
  integration?: string;
  num_channels?: number;
}

async function fetchDeviceInfo(token: string): Promise<{ ok: boolean; info?: DeviceInfo; notRunning?: boolean }> {
  try {
    const res = await fetch(`${BASE}/${token}/whatsapp/all_info`);
    if (res.status === 503) return { ok: false, notRunning: true };
    if (!res.ok) return { ok: false };
    const body = await res.json();
    return { ok: true, info: body?.result };
  } catch {
    return { ok: false };
  }
}

export function useWavoipPairing(token: string | null, enabled: boolean) {
  const [status, setStatus] = useState<WavoipPairingStatus>('idle');
  const [qrCode, setQrCode] = useState<string | null>(null);
  const [contact, setContact] = useState<any>(null);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const sockRef = useRef<Socket | null>(null);
  const cancelRef = useRef(false);
  const rebootTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const rebootCountRef = useRef(0);
  const bootRef = useRef<((tk: string) => Promise<void>) | null>(null);
  // Quando o QR chegou. O WaVoIP expira a sessao de pareamento em ~75s e
  // derruba o device inteiro; a UI usa isso pra dizer que o codigo e' recente.
  const [qrAt, setQrAt] = useState<number | null>(null);

  const clearReboot = useCallback(() => {
    if (rebootTimerRef.current) { clearTimeout(rebootTimerRef.current); rebootTimerRef.current = null; }
  }, []);

  const closeSocket = useCallback(() => {
    if (sockRef.current) {
      try { sockRef.current.removeAllListeners(); sockRef.current.close(); } catch { /* noop */ }
      sockRef.current = null;
    }
  }, []);

  const openSocket = useCallback((tk: string) => {
    closeSocket();
    // Mesmo handshake do SDK: o token vai no PATH, nao no namespace, e o
    // servidor exige `auth.version` + `auth.platform` senao ignora o cliente.
    const sock = io(BASE, {
      transports: ['websocket'],
      path: `/${tk}/websocket`,
      auth: { version: 'official', platform: 'squaad-crm' },
      // Reconexao agressiva: o device reinicia sozinho o tempo todo enquanto
      // ninguem escaneia, e cada volta traz um QR novo.
      reconnectionAttempts: 10,
      reconnectionDelay: 1500,
    });
    sockRef.current = sock;

    // O device morre sozinho ~75s depois de emitir o QR (sessao de pareamento
    // expirada). Quando isso acontece o socket cai e a API volta a 503 — sem
    // religar, a tela fica com um QR morto e ninguem consegue escanear.
    const scheduleReboot = (delay: number) => {
      if (cancelRef.current) return;
      if (rebootCountRef.current >= 20) {
        setError('O dispositivo não se mantém no ar. Tente novamente em alguns minutos.');
        return;
      }
      rebootCountRef.current += 1;
      clearReboot();
      rebootTimerRef.current = setTimeout(() => {
        if (!cancelRef.current) bootRef.current?.(tk);
      }, delay);
    };

    sock.on('connect_error', (e: any) => {
      console.warn('[WaVoIP pairing] connect_error:', e?.message || e);
      scheduleReboot(3000);
    });
    sock.on('disconnect', (reason: string) => {
      console.warn('[WaVoIP pairing] socket caiu:', reason);
      if (reason === 'io client disconnect') return; // fechamos de proposito
      scheduleReboot(3000);
    });
    sock.on('device:init', (st: string, _callType: string, ct: any, qr?: string) => {
      setStatus((st as WavoipPairingStatus) || 'connecting');
      setContact(ct ?? null);
      setQrCode(qr ?? null);
      if (qr) { setQrAt(Date.now()); rebootCountRef.current = 0; }
      setError(null);
    });
    sock.on('device:connecting', (qr?: string) => {
      setStatus('connecting');
      setContact(null);
      setQrCode(qr ?? null);
      if (qr) { setQrAt(Date.now()); rebootCountRef.current = 0; }
    });
    sock.on('device:open', (ct: any) => {
      setStatus('open');
      setContact(ct ?? null);
      setQrCode(null);
      setQrAt(null);
      clearReboot();
    });
    sock.on('device:close', () => {
      setStatus('close');
      setContact(null);
      setQrCode(null);
      setQrAt(null);
      scheduleReboot(2000);
    });
    sock.on('device:restarting', () => setStatus('restarting'));
    sock.on('device:hibernating', () => setStatus('hibernating'));
    sock.on('device:building', () => setStatus('BUILDING'));
  }, [closeSocket, clearReboot]);

  // Acorda o device (se preciso) e abre o socket
  const boot = useCallback(async (tk: string) => {
    setBusy(true);
    setError(null);
    let probe = await fetchDeviceInfo(tk);

    if (probe.notRunning) {
      // Hibernando: acorda e espera subir. O restart leva alguns segundos.
      setStatus('waking');
      try {
        await fetch(`${BASE}/${tk}/device/restart`);
      } catch {
        setError('Não foi possível acordar o dispositivo (verifique o token).');
        setBusy(false);
        return;
      }
      for (let i = 0; i < 15 && !cancelRef.current; i++) {
        await new Promise(r => setTimeout(r, 2000));
        probe = await fetchDeviceInfo(tk);
        if (probe.ok) break;
      }
    }

    if (cancelRef.current) { setBusy(false); return; }
    if (!probe.ok) {
      setError('O dispositivo não respondeu. Confira o token no painel do WaVoIP.');
      setBusy(false);
      return;
    }

    setStatus((probe.info?.status as WavoipPairingStatus) || 'connecting');
    openSocket(tk);
    setBusy(false);
  }, [openSocket]);

  useEffect(() => { bootRef.current = boot; }, [boot]);

  useEffect(() => {
    cancelRef.current = false;
    rebootCountRef.current = 0;
    if (!enabled || !token) {
      clearReboot();
      closeSocket();
      setStatus('idle');
      setQrCode(null);
      setError(null);
      return;
    }
    boot(token);
    return () => { cancelRef.current = true; clearReboot(); closeSocket(); };
  }, [enabled, token, boot, closeSocket, clearReboot]);

  /** Reinicia o dispositivo no servidor e reabre o socket */
  const restart = useCallback(async () => {
    if (!token) return;
    setBusy(true);
    setStatus('restarting');
    setQrCode(null);
    rebootCountRef.current = 0;
    clearReboot();
    closeSocket();
    try {
      await fetch(`${BASE}/${token}/device/restart`);
    } catch {
      setError('Falha ao reiniciar o dispositivo.');
      setBusy(false);
      return;
    }
    await new Promise(r => setTimeout(r, 4000));
    await boot(token);
  }, [token, boot, closeSocket, clearReboot]);

  /** Desvincula o número atual — o device volta pra "connecting" e emite QR novo */
  const logout = useCallback(async () => {
    if (!token) return;
    setBusy(true);
    try {
      await fetch(`${BASE}/${token}/whatsapp/logout`);
      setContact(null);
      setQrCode(null);
      setStatus('connecting');
    } catch {
      setError('Falha ao desvincular o número.');
    }
    setBusy(false);
  }, [token]);

  return { status, qrCode, qrAt, contact, error, busy, restart, logout };
}
