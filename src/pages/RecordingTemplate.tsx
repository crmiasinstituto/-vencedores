// Template carregado pelo egress browser do LiveKit Cloud.
// Recebe ?url=<wss>&token=<jwt> via query string e conecta como
// participante "subscriber-only" pra renderizar o layout que vai pro MP4.
//
// Layout + que Vencedores: tela compartilhada ocupa 100% + bubble circular da camera no
// canto inferior esquerdo com borda dourada + logo + que Vencedores topo direito.
// Sem chat, sem control bar, sem nada que polua a aula gravada.

import { useEffect, useMemo, useRef, useState } from 'react';
import { Room, RoomEvent, Track, RemoteTrack, RemoteParticipant, RemoteTrackPublication, ConnectionState } from 'livekit-client';

interface VideoTile {
  participantSid: string;
  participantName: string;
  track: RemoteTrack;
  source: Track.Source;
}

function attachVideo(track: RemoteTrack, el: HTMLVideoElement | null) {
  if (!el) return;
  try { track.attach(el); } catch (e) { console.error('[REC-TEMPLATE] attach failed', e); }
}

function detachVideo(track: RemoteTrack, el: HTMLVideoElement | null) {
  if (!el) return;
  try { track.detach(el); } catch {}
}

export default function RecordingTemplate() {
  const params = new URLSearchParams(window.location.search);
  const url = params.get('url') || '';
  const token = params.get('token') || '';

  const roomRef = useRef<Room | null>(null);
  const [tiles, setTiles] = useState<VideoTile[]>([]);
  const [connected, setConnected] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!url || !token) {
      setError('Missing url/token query params');
      return;
    }

    const room = new Room({
      adaptiveStream: false,
      dynacast: false,
    });
    roomRef.current = room;

    const refreshTiles = () => {
      const list: VideoTile[] = [];
      for (const p of room.remoteParticipants.values()) {
        for (const pub of p.trackPublications.values()) {
          if (pub.kind !== Track.Kind.Video) continue;
          if (!pub.isSubscribed || !pub.track) continue;
          list.push({
            participantSid: p.sid,
            participantName: p.name || p.identity,
            track: pub.track as RemoteTrack,
            source: pub.source,
          });
        }
      }
      setTiles(list);
    };

    room
      .on(RoomEvent.Connected, () => { setConnected(true); refreshTiles(); })
      .on(RoomEvent.Disconnected, () => setConnected(false))
      .on(RoomEvent.TrackSubscribed, refreshTiles)
      .on(RoomEvent.TrackUnsubscribed, refreshTiles)
      .on(RoomEvent.ParticipantConnected, refreshTiles)
      .on(RoomEvent.ParticipantDisconnected, refreshTiles)
      .on(RoomEvent.LocalTrackPublished, refreshTiles);

    room.connect(url, token, { autoSubscribe: true })
      .then(() => {
        console.log('[REC-TEMPLATE] connected', room.name);
        refreshTiles();
      })
      .catch((e) => {
        console.error('[REC-TEMPLATE] connect failed', e);
        setError(`Connect failed: ${e.message}`);
      });

    return () => { room.disconnect().catch(() => {}); };
  }, [url, token]);

  const screenShare = useMemo(() => tiles.find(t => t.source === Track.Source.ScreenShare), [tiles]);
  const cameras = useMemo(() => tiles.filter(t => t.source === Track.Source.Camera), [tiles]);

  // Loading frame (still records — egress captures whatever is rendered)
  if (error) {
    return (
      <div style={{ width: '100vw', height: '100vh', background: '#0a0a0a', display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#fff', fontFamily: 'sans-serif' }}>
        <div style={{ textAlign: 'center' }}>
          <div style={{ color: '#3B82F6', fontSize: 24, fontWeight: 700, marginBottom: 8 }}>+ que Vencedores</div>
          <div style={{ color: '#ef4444' }}>Erro: {error}</div>
        </div>
      </div>
    );
  }

  return (
    <div style={{ width: '100vw', height: '100vh', background: '#0a0a0a', position: 'relative', overflow: 'hidden', fontFamily: 'system-ui, -apple-system, sans-serif' }}>
      {/* Branding pill — top right */}
      <div style={{
        position: 'absolute', top: 20, right: 20, zIndex: 30,
        display: 'flex', alignItems: 'center', gap: 8,
        background: 'rgba(0,0,0,0.55)', backdropFilter: 'blur(8px)',
        borderRadius: 9999, padding: '6px 16px 6px 6px',
        border: '1.5px solid rgba(250,200,0,0.4)',
      }}>
        <div style={{
          width: 30, height: 30, borderRadius: '50%',
          background: '#3B82F6', display: 'flex', alignItems: 'center', justifyContent: 'center',
          color: '#000', fontWeight: 800, fontSize: 14,
        }}>S</div>
        <span style={{ color: '#fff', fontWeight: 700, fontSize: 13, letterSpacing: '0.05em' }}>+ que Vencedores</span>
      </div>

      {screenShare ? (
        // Tela compartilhada + FAIXA LATERAL de cameras (nunca sobrepoe a tela).
        <div style={{ display: 'flex', width: '100%', height: '100%', background: '#000' }}>
          <div style={{ flex: '1 1 auto', minWidth: 0, position: 'relative', background: '#000' }}>
            <VideoTileEl tile={screenShare} fit="contain" rounded={false} ring={false} className="ss" />
          </div>
          {cameras.length > 0 && (
            <div style={{
              width: 236, flex: '0 0 236px', height: '100%', boxSizing: 'border-box',
              background: '#0a0a0a', borderLeft: '2px solid rgba(250,200,0,0.28)',
              display: 'flex', flexDirection: 'column', gap: 8, padding: 10, overflow: 'hidden',
            }}>
              {cameras.slice(0, 5).map((c, i) => (
                <div key={c.participantSid + '-' + i} style={{
                  position: 'relative', width: '100%', height: 128, flex: '0 0 auto',
                  borderRadius: 14, overflow: 'hidden', background: '#000',
                  border: '3px solid rgba(250,200,0,0.45)',
                }}>
                  <VideoTileEl tile={c} fit="cover" rounded={false} ring={false} className="cam" />
                  <div style={{
                    position: 'absolute', bottom: 8, left: '50%', transform: 'translateX(-50%)',
                    background: 'rgba(0,0,0,0.65)', color: '#fff', fontSize: 12, fontWeight: 600,
                    padding: '3px 10px', borderRadius: 9999, whiteSpace: 'nowrap',
                    maxWidth: '90%', overflow: 'hidden', textOverflow: 'ellipsis',
                  }}>{c.participantName}</div>
                </div>
              ))}
            </div>
          )}
        </div>
      ) : cameras.length === 1 ? (
        // Solo speaker: cinematic full-frame camera
        <VideoTileEl tile={cameras[0]} fit="cover" rounded={false} ring={false} className="solo" />
      ) : cameras.length === 2 ? (
        // 2 ppl: split 50/50 horizontal with thin gold divider
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', width: '100%', height: '100%', gap: 2, background: '#3B82F6' }}>
          {cameras.map((c, i) => (
            <div key={c.participantSid + i} style={{ position: 'relative', background: '#000' }}>
              <VideoTileEl tile={c} fit="cover" rounded={false} ring={false} className={`p${i}`} />
              <div style={{
                position: 'absolute', bottom: 16, left: 16,
                background: 'rgba(0,0,0,0.6)', backdropFilter: 'blur(4px)',
                color: '#fff', fontSize: 13, fontWeight: 600,
                padding: '4px 12px', borderRadius: 9999,
              }}>{c.participantName}</div>
            </div>
          ))}
        </div>
      ) : cameras.length > 2 ? (
        // 3+: grid
        <div style={{
          display: 'grid', width: '100%', height: '100%', gap: 4, padding: 4, background: '#0a0a0a',
          gridTemplateColumns: `repeat(${Math.ceil(Math.sqrt(cameras.length))}, 1fr)`,
        }}>
          {cameras.map((c, i) => (
            <div key={c.participantSid + i} style={{ position: 'relative', background: '#000', borderRadius: 12, overflow: 'hidden', border: '2px solid rgba(250,200,0,0.3)' }}>
              <VideoTileEl tile={c} fit="cover" rounded={false} ring={false} className={`g${i}`} />
              <div style={{
                position: 'absolute', bottom: 8, left: 8,
                background: 'rgba(0,0,0,0.6)', backdropFilter: 'blur(4px)',
                color: '#fff', fontSize: 11, fontWeight: 600,
                padding: '2px 10px', borderRadius: 9999,
              }}>{c.participantName}</div>
            </div>
          ))}
        </div>
      ) : (
        // Empty room — solid + que Vencedores splash so the recording isnt a black void
        <div style={{ width: '100%', height: '100%', display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#fff', flexDirection: 'column', gap: 16 }}>
          <div style={{ width: 100, height: 100, borderRadius: '50%', background: '#3B82F6', display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#000', fontSize: 48, fontWeight: 800 }}>S</div>
          <div style={{ fontSize: 24, fontWeight: 700, letterSpacing: '0.1em' }}>+ que Vencedores</div>
          <div style={{ fontSize: 12, color: '#888' }}>{connected ? 'Aguardando participantes...' : 'Conectando...'}</div>
        </div>
      )}
    </div>
  );
}

// Single video tile — attaches the LiveKit RemoteTrack to a <video> element
function VideoTileEl({ tile, fit, rounded, ring, className }: {
  tile: VideoTile;
  fit: 'cover' | 'contain';
  rounded: boolean;
  ring: boolean;
  className?: string;
}) {
  const ref = useRef<HTMLVideoElement>(null);

  useEffect(() => {
    attachVideo(tile.track, ref.current);
    return () => detachVideo(tile.track, ref.current);
  }, [tile.track]);

  return (
    <video
      ref={ref}
      autoPlay
      playsInline
      muted // egress captures audio from LK directly; muting the video tag avoids double audio
      className={className}
      style={{
        width: '100%', height: '100%',
        objectFit: fit,
        borderRadius: rounded ? '50%' : 0,
        outline: ring ? '4px solid #3B82F6' : 'none',
        background: '#000',
      }}
    />
  );
}
