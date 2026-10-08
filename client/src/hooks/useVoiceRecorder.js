import { useCallback, useEffect, useRef, useState } from 'react';

/**
 * Record audio with the browser's microphone (voice notes on reports, spoken
 * explanations in Teach-Back). `onRecorded(file)` gets a WebM file when the
 * recording stops; it stops by itself after `maxSeconds`.
 */
export default function useVoiceRecorder({ onRecorded, maxSeconds = 120, fileName = 'voice-note.webm' }) {
  const [recording, setRecording] = useState(false);
  const [seconds, setSeconds] = useState(0);
  const [error, setError] = useState('');
  const recorder = useRef(null);
  const timer = useRef(null);
  const callback = useRef(onRecorded);
  callback.current = onRecorded;

  useEffect(() => () => {
    clearInterval(timer.current);
    recorder.current?.stream?.getTracks().forEach((t) => t.stop());
  }, []);

  const stop = useCallback(() => {
    clearInterval(timer.current);
    if (recorder.current?.state === 'recording') recorder.current.stop();
    setRecording(false);
  }, []);

  const start = useCallback(async () => {
    setError('');
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      const type = window.MediaRecorder?.isTypeSupported?.('audio/webm') ? 'audio/webm' : '';
      const rec = new window.MediaRecorder(stream, type ? { mimeType: type } : undefined);
      const chunks = [];
      rec.ondataavailable = (e) => { if (e.data.size) chunks.push(e.data); };
      rec.onstop = () => {
        stream.getTracks().forEach((t) => t.stop());
        const blob = new Blob(chunks, { type: rec.mimeType || 'audio/webm' });
        callback.current?.(new File([blob], fileName, { type: blob.type }));
      };
      recorder.current = rec;
      rec.start();
      setSeconds(0);
      setRecording(true);
      timer.current = setInterval(() => setSeconds((s) => {
        if (s + 1 >= maxSeconds) stop();
        return s + 1;
      }), 1000);
    } catch {
      setError('Your microphone could not be used. Check the browser permission, or type instead.');
    }
  }, [fileName, maxSeconds, stop]);

  return { recording, seconds, error, start, stop };
}
