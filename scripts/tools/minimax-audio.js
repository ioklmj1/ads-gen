#!/usr/bin/env node

/**
 * Minimax Audio Generation — TTS Voiceover & Music
 *
 * Generates voiceover narration and background music using Minimax APIs.
 *
 * Usage:
 *   # Generate voiceover from text
 *   node minimax-audio.js --tts --text "Your narration text" --output /path/to/vo.mp3
 *
 *   # Generate voiceover from storyboard (uses voiceover fields)
 *   node minimax-audio.js --tts --storyboard /path/to/storyboard.json --output /path/to/vo/
 *
 *   # Generate background music
 *   node minimax-audio.js --music --prompt "Ambient electronic, warm, Nordic" --duration 60 --output /path/to/music.mp3
 *
 *   # Assemble final video with VO + music + clips
 *   node minimax-audio.js --assemble --clips /path/to/clips/ --vo /path/to/vo/ --music /path/to/music.mp3 --output /path/to/final.mp4
 */

const fs = require('fs');
const path = require('path');
const https = require('https');

const API_BASE = 'https://api.minimax.io/v1';

// ── Argument Parsing ───────────────────────────────────────────────────────

function parseArgs() {
  const args = process.argv.slice(2);
  const opts = {
    mode: null, // 'tts', 'music', 'assemble'
    text: null,
    storyboard: null,
    prompt: null,
    output: null,
    duration: 60,
    voice: 'English_Insightful_Speaker',
    model: 'speech-2.8-hd',
    musicModel: 'music-2.5+',
    speed: 0.95,
    pitch: 0,
    apiKey: process.env.MINIMAX_API_KEY || null,
    clips: null,
    vo: null,
    music: null,
    crossfade: 0.5,
  };

  for (let i = 0; i < args.length; i++) {
    switch (args[i]) {
      case '--tts': opts.mode = 'tts'; break;
      case '--music': opts.mode = 'music'; break;
      case '--assemble': opts.mode = 'assemble'; break;
      case '--text': opts.text = args[++i]; break;
      case '--storyboard': opts.storyboard = args[++i]; break;
      case '--prompt': opts.prompt = args[++i]; break;
      case '--output': opts.output = args[++i]; break;
      case '--duration': opts.duration = parseInt(args[++i]); break;
      case '--voice': opts.voice = args[++i]; break;
      case '--model': opts.model = args[++i]; break;
      case '--speed': opts.speed = parseFloat(args[++i]); break;
      case '--pitch': opts.pitch = parseInt(args[++i]); break;
      case '--api-key': opts.apiKey = args[++i]; break;
      case '--clips': opts.clips = args[++i]; break;
      case '--vo': opts.vo = args[++i]; break;
      case '--music-file': opts.music = args[++i]; break;
      case '--crossfade': opts.crossfade = parseFloat(args[++i]); break;
      case '--help': printUsage(); process.exit(0);
    }
  }
  return opts;
}

function printUsage() {
  console.log(`
Minimax Audio Generation — TTS & Music

MODES:
  --tts       Generate voiceover narration
  --music     Generate background music
  --assemble  Combine clips + VO + music into final video

TTS OPTIONS:
  --text <text>         Text to narrate
  --storyboard <path>   Generate VO for each frame's voiceover field
  --voice <id>          Voice ID (default: English_Insightful_Speaker)
  --model <name>        TTS model (default: speech-2.8-hd)
  --speed <float>       Speech speed (default: 0.95)
  --output <path>       Output file or directory

MUSIC OPTIONS:
  --prompt <text>       Music style description
  --duration <sec>      Approximate duration (default: 60)
  --output <path>       Output file

ASSEMBLE OPTIONS:
  --clips <dir>         Directory with video clips
  --vo <dir>            Directory with VO audio files
  --music-file <path>   Background music file
  --crossfade <sec>     Crossfade between clips (default: 0.5)
  --output <path>       Final video output path

VOICES (English, calm/narration):
  English_Insightful_Speaker  — Calm, thoughtful male narrator
  English_Graceful_Lady       — Warm, elegant female narrator
  English_Persuasive_Man      — Confident, authoritative male
  `);
}

// ── HTTP Helper ────────────────────────────────────────────────────────────

function makeRequest(method, urlPath, body, apiKey) {
  return new Promise((resolve, reject) => {
    const url = new URL(urlPath.startsWith('http') ? urlPath : `${API_BASE}${urlPath}`);
    const options = {
      hostname: url.hostname,
      port: 443,
      path: url.pathname + url.search,
      method,
      headers: {
        'Authorization': `Bearer ${apiKey}`,
        'Content-Type': 'application/json',
      },
    };
    const req = https.request(options, (res) => {
      let data = '';
      res.on('data', chunk => data += chunk);
      res.on('end', () => {
        try { resolve({ status: res.statusCode, data: JSON.parse(data) }); }
        catch (e) { resolve({ status: res.statusCode, data }); }
      });
    });
    req.on('error', reject);
    if (body) req.write(JSON.stringify(body));
    req.end();
  });
}

// ── TTS Generation ─────────────────────────────────────────────────────────

async function generateTTS(text, outputPath, opts) {
  console.log(`[...] Generating voiceover (${text.length} chars, voice: ${opts.voice})...`);

  const body = {
    model: opts.model,
    text: text,
    stream: false,
    output_format: 'hex',
    language_boost: 'auto',
    voice_setting: {
      voice_id: opts.voice,
      speed: opts.speed,
      vol: 1,
      pitch: opts.pitch,
    },
    audio_setting: {
      sample_rate: 44100,
      bitrate: 256000,
      format: 'mp3',
      channel: 1,
    },
  };

  const res = await makeRequest('POST', '/t2a_v2', body, opts.apiKey);

  if (res.data.base_resp && res.data.base_resp.status_code !== 0) {
    throw new Error(`TTS error: ${res.data.base_resp.status_msg}`);
  }

  if (res.data.data && res.data.data.audio) {
    const audioBuffer = Buffer.from(res.data.data.audio, 'hex');
    fs.writeFileSync(outputPath, audioBuffer);
    const durationMs = res.data.extra_info?.audio_length || 0;
    console.log(`[OK] Saved: ${outputPath} (${(audioBuffer.length / 1024).toFixed(0)}KB, ~${(durationMs / 1000).toFixed(1)}s)`);
    return { path: outputPath, duration: durationMs / 1000 };
  }

  throw new Error(`Unexpected TTS response: ${JSON.stringify(res.data).substring(0, 200)}`);
}

async function generateStoryboardVO(storyboardPath, outputDir, opts) {
  const config = JSON.parse(fs.readFileSync(storyboardPath, 'utf-8'));
  fs.mkdirSync(outputDir, { recursive: true });

  console.log(`\n========================================`);
  console.log(`  Voiceover Generation`);
  console.log(`  ${config.frames.length} frames | ${opts.voice}`);
  console.log(`========================================\n`);

  const results = [];

  for (let i = 0; i < config.frames.length; i++) {
    const frame = config.frames[i];
    const voText = frame.voiceover;

    if (!voText) {
      console.log(`[SKIP] Frame ${i + 1}: no voiceover text`);
      results.push(null);
      continue;
    }

    const fileName = `vo_${String(i + 1).padStart(2, '0')}.mp3`;
    const outputPath = path.join(outputDir, fileName);

    if (fs.existsSync(outputPath)) {
      console.log(`[SKIP] ${fileName} already exists`);
      results.push({ path: outputPath });
      continue;
    }

    console.log(`\n── Frame ${i + 1}: ${frame.title || ''} ──`);
    const result = await generateTTS(voText, outputPath, opts);
    results.push(result);
  }

  console.log(`\n[DONE] All voiceovers generated in ${outputDir}`);
  return results;
}

// ── Music Generation ───────────────────────────────────────────────────────

async function generateMusic(prompt, outputPath, opts) {
  console.log(`[...] Generating music...`);
  console.log(`      Model: ${opts.musicModel}`);
  console.log(`      Prompt: ${prompt.substring(0, 80)}...`);

  const body = {
    model: opts.musicModel,
    prompt: prompt,
    is_instrumental: true,
    output_format: 'url',
    audio_setting: {
      sample_rate: 44100,
      bitrate: 256000,
      format: 'mp3',
    },
  };

  const res = await makeRequest('POST', '/music_generation', body, opts.apiKey);

  if (res.data.base_resp && res.data.base_resp.status_code !== 0) {
    throw new Error(`Music error: ${res.data.base_resp.status_msg}`);
  }

  // Handle hex-encoded audio
  if (res.data.data && res.data.data.audio) {
    const audioBuffer = Buffer.from(res.data.data.audio, 'hex');
    fs.writeFileSync(outputPath, audioBuffer);
    console.log(`[OK] Music saved: ${outputPath} (${(audioBuffer.length / 1024).toFixed(0)}KB)`);
    return outputPath;
  }

  // Handle URL response
  if (res.data.data && res.data.data.audio_url) {
    console.log(`[...] Downloading music from URL...`);
    await downloadFile(res.data.data.audio_url, outputPath);
    console.log(`[OK] Music saved: ${outputPath}`);
    return outputPath;
  }

  // May need polling for async
  if (res.data.task_id) {
    console.log(`[...] Music generation async (task: ${res.data.task_id}), polling...`);
    // Poll similar to video
    for (let i = 0; i < 60; i++) {
      await new Promise(r => setTimeout(r, 5000));
      const poll = await makeRequest('GET', `/query/music_generation?task_id=${res.data.task_id}`, null, opts.apiKey);
      if (poll.data.status === 'Success' || poll.data.status === 2) {
        if (poll.data.data && poll.data.data.audio) {
          const buf = Buffer.from(poll.data.data.audio, 'hex');
          fs.writeFileSync(outputPath, buf);
          console.log(`[OK] Music saved: ${outputPath} (${(buf.length / 1024).toFixed(0)}KB)`);
          return outputPath;
        }
        if (poll.data.file_id) {
          const fileRes = await makeRequest('GET', `/files/retrieve?file_id=${poll.data.file_id}`, null, opts.apiKey);
          if (fileRes.data.file && fileRes.data.file.download_url) {
            await downloadFile(fileRes.data.file.download_url, outputPath);
            console.log(`[OK] Music saved: ${outputPath}`);
            return outputPath;
          }
        }
      }
      process.stdout.write(`\r[...] Generating music (${(i + 1) * 5}s elapsed)`);
    }
    throw new Error('Music generation timeout');
  }

  throw new Error(`Unexpected music response: ${JSON.stringify(res.data).substring(0, 300)}`);
}

function downloadFile(url, outputPath) {
  return new Promise((resolve, reject) => {
    const file = fs.createWriteStream(outputPath);
    const doRequest = (reqUrl) => {
      https.get(reqUrl, (res) => {
        if (res.statusCode >= 300 && res.statusCode < 400 && res.headers.location) {
          doRequest(res.headers.location);
          return;
        }
        res.pipe(file);
        file.on('finish', () => { file.close(); resolve(); });
      }).on('error', (err) => { fs.unlink(outputPath, () => {}); reject(err); });
    };
    doRequest(url);
  });
}

// ── Final Assembly ─────────────────────────────────────────────────────────

async function assembleVideo(opts) {
  const { execSync } = require('child_process');

  // Find clips
  const clips = fs.readdirSync(opts.clips)
    .filter(f => f.match(/^clip_\d+\.mp4$/))
    .sort()
    .map(f => path.join(opts.clips, f));

  if (clips.length === 0) throw new Error(`No clips found in ${opts.clips}`);

  console.log(`\n========================================`);
  console.log(`  Final Video Assembly`);
  console.log(`  ${clips.length} clips + VO + music`);
  console.log(`========================================\n`);

  // Step 1: Concatenate video clips
  const concatFile = path.join(opts.clips, '_concat.txt');
  fs.writeFileSync(concatFile, clips.map(c => `file '${c}'`).join('\n'));

  const concatVideo = path.join(path.dirname(opts.output), '_concat_video.mp4');
  console.log('[...] Concatenating video clips...');
  execSync(`ffmpeg -y -f concat -safe 0 -i "${concatFile}" -c:v libx264 -preset slow -crf 18 -pix_fmt yuv420p "${concatVideo}"`, { stdio: 'pipe' });

  // Step 2: Concatenate VO audio files (if provided)
  let voAudio = null;
  if (opts.vo && fs.existsSync(opts.vo)) {
    const voFiles = fs.readdirSync(opts.vo)
      .filter(f => f.match(/^vo_\d+\.mp3$/))
      .sort()
      .map(f => path.join(opts.vo, f));

    if (voFiles.length > 0) {
      voAudio = path.join(path.dirname(opts.output), '_concat_vo.mp3');
      const voConcat = path.join(opts.vo, '_vo_concat.txt');
      fs.writeFileSync(voConcat, voFiles.map(f => `file '${f}'`).join('\n'));
      console.log('[...] Concatenating voiceover audio...');
      execSync(`ffmpeg -y -f concat -safe 0 -i "${voConcat}" -c:a libmp3lame -b:a 256k "${voAudio}"`, { stdio: 'pipe' });
      fs.unlinkSync(voConcat);
    }
  }

  // Step 3: Mix audio tracks and combine with video
  console.log('[...] Mixing final video...');

  let ffmpegCmd;
  if (voAudio && opts.music) {
    // Video + VO + Music
    ffmpegCmd = `ffmpeg -y -i "${concatVideo}" -i "${voAudio}" -i "${opts.music}" -filter_complex "[1:a]volume=1.0[vo];[2:a]volume=0.15,afade=t=in:st=0:d=2,afade=t=out:st=${opts.duration - 3}:d=3[music];[vo][music]amix=inputs=2:duration=longest[aout]" -map 0:v -map "[aout]" -c:v copy -c:a aac -b:a 256k -shortest "${opts.output}"`;
  } else if (voAudio) {
    // Video + VO only
    ffmpegCmd = `ffmpeg -y -i "${concatVideo}" -i "${voAudio}" -map 0:v -map 1:a -c:v copy -c:a aac -b:a 256k -shortest "${opts.output}"`;
  } else if (opts.music) {
    // Video + Music only
    ffmpegCmd = `ffmpeg -y -i "${concatVideo}" -i "${opts.music}" -filter_complex "[1:a]volume=0.3,afade=t=in:st=0:d=2,afade=t=out:st=${opts.duration - 3}:d=3[music]" -map 0:v -map "[music]" -c:v copy -c:a aac -b:a 256k -shortest "${opts.output}"`;
  } else {
    // Video only
    ffmpegCmd = `ffmpeg -y -i "${concatVideo}" -c copy "${opts.output}"`;
  }

  execSync(ffmpegCmd, { stdio: 'pipe' });

  // Cleanup temp files
  fs.unlinkSync(concatFile);
  fs.unlinkSync(concatVideo);
  if (voAudio) fs.unlinkSync(voAudio);

  const stats = fs.statSync(opts.output);
  console.log(`\n[DONE] Final video: ${opts.output} (${(stats.size / 1024 / 1024).toFixed(1)}MB)`);
}

// ── Main ───────────────────────────────────────────────────────────────────

async function main() {
  const opts = parseArgs();

  if (!opts.apiKey && opts.mode !== 'assemble') {
    console.error('[ERROR] No API key. Set MINIMAX_API_KEY or use --api-key');
    process.exit(1);
  }

  try {
    switch (opts.mode) {
      case 'tts':
        if (opts.storyboard) {
          await generateStoryboardVO(opts.storyboard, opts.output, opts);
        } else if (opts.text) {
          await generateTTS(opts.text, opts.output, opts);
        } else {
          console.error('[ERROR] --text or --storyboard required for TTS mode');
          process.exit(1);
        }
        break;

      case 'music':
        if (!opts.prompt) {
          console.error('[ERROR] --prompt required for music mode');
          process.exit(1);
        }
        await generateMusic(opts.prompt, opts.output, opts);
        break;

      case 'assemble':
        if (!opts.clips || !opts.output) {
          console.error('[ERROR] --clips and --output required for assemble mode');
          process.exit(1);
        }
        await assembleVideo(opts);
        break;

      default:
        printUsage();
        process.exit(1);
    }
  } catch (err) {
    console.error(`\n[ERROR] ${err.message}`);
    process.exit(1);
  }
}

main();
