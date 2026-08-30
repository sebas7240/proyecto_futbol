import React, { useEffect, useRef, useState } from 'react';
import Hls from 'hls.js';

interface VideoPlayerProps {
  src: string;
}

const VideoPlayer: React.FC<VideoPlayerProps> = ({ src }) => {
  const videoRef = useRef<HTMLVideoElement>(null);
  const [error, setError] = useState<string | null>(null);
  const isHlsStream = /\.m3u8(?:$|[?#])/i.test(src);
  const isNativeVideo = /\.(?:mp4|webm|ogg)(?:$|[?#])/i.test(src);
  const isEmbedPage = !isHlsStream && !isNativeVideo;

  useEffect(() => {
    let hls: any = null;
    let nativeVideo: HTMLVideoElement | null = null;
    const playNativeVideo = () => {
      nativeVideo?.play().catch(e => console.error('Autoplay prevented', e));
    };
    setError(null);

    if (isEmbedPage) return undefined;

    if (videoRef.current) {
      const video = videoRef.current;

      if (isHlsStream && Hls.isSupported()) {
        hls = new Hls({
          enableWorker: true,
          lowLatencyMode: true,
          backBufferLength: 90
        });

        hls.loadSource(src);
        hls.attachMedia(video);

        hls.on(Hls.Events.MANIFEST_PARSED, () => {
          video.play().catch(e => console.error("Autoplay prevented", e));
        });

        hls.on(Hls.Events.ERROR, (_event: any, data: any) => {
          console.error("HLS Error:", data);
          if (data.fatal) {
            switch (data.type) {
              case Hls.ErrorTypes.NETWORK_ERROR:
                hls?.startLoad();
                break;
              case Hls.ErrorTypes.MEDIA_ERROR:
                hls?.recoverMediaError();
                break;
              default:
                setError(`Fatal error: ${data.details}`);
                hls?.destroy();
                break;
            }
          }
        });
      } else {
        nativeVideo = video;
        video.src = src;
        video.addEventListener('loadedmetadata', playNativeVideo);
      }
    }

    return () => {
      if (hls) {
        hls.destroy();
      }
      nativeVideo?.removeEventListener('loadedmetadata', playNativeVideo);
    };
  }, [isEmbedPage, isHlsStream, src]);

  if (isEmbedPage) {
    return (
      <div className="w-full h-full bg-black">
        <iframe
          src={src}
          title="Señal en vivo"
          data-golea-player-iframe="true"
          className="w-full h-full border-0 bg-black"
          allow="autoplay; fullscreen; encrypted-media; picture-in-picture"
          allowFullScreen
          referrerPolicy="origin-when-cross-origin"
        />
      </div>
    );
  }

  return (
    <div className="w-full h-full flex flex-col items-center justify-center bg-black relative">
      <video 
        ref={videoRef} 
        data-golea-player-video="true"
        className="w-full h-full object-contain"
        controls
        autoPlay
        playsInline
      />
      {error && (
        <div className="absolute inset-0 flex items-center justify-center bg-black/80 text-white p-4 text-center">
          <p>{error}</p>
        </div>
      )}
    </div>
  );
}

export default VideoPlayer;
