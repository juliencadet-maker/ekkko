/**
 * WAV Recorder — captures raw PCM audio from a MediaStream
 * and produces a proper WAV file blob on stop.
 * 
 * Uses ScriptProcessorNode (widely supported) to collect Float32 samples,
 * then encodes them as 16-bit PCM WAV.
 */

export class WavRecorder {
  private audioContext: AudioContext | null = null;
  private sourceNode: MediaStreamAudioSourceNode | null = null;
  private processorNode: ScriptProcessorNode | null = null;
  private chunks: Float32Array[] = [];
  private sampleRate = 24000; // Voxtral expects 24kHz
  private recording = false;

  /**
   * Start recording audio from the given stream.
   * Resamples to 24kHz mono for optimal Voxtral compatibility.
   */
  start(stream: MediaStream): void {
    this.chunks = [];
    this.recording = true;

    // Create an AudioContext at the target sample rate if possible,
    // otherwise we'll resample later
    this.audioContext = new AudioContext({ sampleRate: this.sampleRate });
    this.sourceNode = this.audioContext.createMediaStreamSource(stream);

    // Buffer size 4096 is a good balance between latency and performance
    this.processorNode = this.audioContext.createScriptProcessor(4096, 1, 1);

    this.processorNode.onaudioprocess = (e: AudioProcessingEvent) => {
      if (!this.recording) return;
      // Copy the input channel data (mono)
      const inputData = e.inputBuffer.getChannelData(0);
      this.chunks.push(new Float32Array(inputData));
    };

    this.sourceNode.connect(this.processorNode);
    this.processorNode.connect(this.audioContext.destination);
  }

  /**
   * Stop recording and return a WAV Blob.
   */
  async stop(): Promise<Blob> {
    this.recording = false;

    if (this.processorNode) {
      this.processorNode.disconnect();
      this.processorNode = null;
    }
    if (this.sourceNode) {
      this.sourceNode.disconnect();
      this.sourceNode = null;
    }

    const actualSampleRate = this.audioContext?.sampleRate ?? this.sampleRate;

    if (this.audioContext) {
      await this.audioContext.close();
      this.audioContext = null;
    }

    // Merge all chunks into a single Float32Array
    const totalLength = this.chunks.reduce((acc, c) => acc + c.length, 0);
    const merged = new Float32Array(totalLength);
    let offset = 0;
    for (const chunk of this.chunks) {
      merged.set(chunk, offset);
      offset += chunk.length;
    }
    this.chunks = [];

    return encodeWav(merged, actualSampleRate);
  }

  /** Whether the recorder is currently active */
  get isRecording(): boolean {
    return this.recording;
  }
}

/**
 * Encode Float32 PCM samples into a 16-bit WAV blob.
 */
function encodeWav(samples: Float32Array, sampleRate: number): Blob {
  const numChannels = 1;
  const bitsPerSample = 16;
  const bytesPerSample = bitsPerSample / 8;
  const blockAlign = numChannels * bytesPerSample;
  const dataLength = samples.length * bytesPerSample;
  const headerLength = 44;
  const buffer = new ArrayBuffer(headerLength + dataLength);
  const view = new DataView(buffer);

  // RIFF header
  writeString(view, 0, "RIFF");
  view.setUint32(4, 36 + dataLength, true);
  writeString(view, 8, "WAVE");

  // fmt chunk
  writeString(view, 12, "fmt ");
  view.setUint32(16, 16, true); // chunk size
  view.setUint16(20, 1, true); // PCM format
  view.setUint16(22, numChannels, true);
  view.setUint32(24, sampleRate, true);
  view.setUint32(28, sampleRate * blockAlign, true); // byte rate
  view.setUint16(32, blockAlign, true);
  view.setUint16(34, bitsPerSample, true);

  // data chunk
  writeString(view, 36, "data");
  view.setUint32(40, dataLength, true);

  // Convert float32 to int16
  let writeOffset = 44;
  for (let i = 0; i < samples.length; i++) {
    const s = Math.max(-1, Math.min(1, samples[i]));
    const val = s < 0 ? s * 0x8000 : s * 0x7fff;
    view.setInt16(writeOffset, val, true);
    writeOffset += 2;
  }

  return new Blob([buffer], { type: "audio/wav" });
}

function writeString(view: DataView, offset: number, str: string): void {
  for (let i = 0; i < str.length; i++) {
    view.setUint8(offset + i, str.charCodeAt(i));
  }
}
