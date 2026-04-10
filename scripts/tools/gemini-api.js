#!/usr/bin/env node
/**
 * gemini-api.js
 *
 * Calls the Gemini API directly for image editing — no browser automation needed.
 * Produces high-quality images without the visible sparkle watermark.
 *
 * Two-stage pipeline:
 *   Iteration: gemini-3.1-flash-image-preview @ 1K (fast, cheap)
 *   Final:     gemini-3-pro-image-preview @ 4K (highest quality)
 *
 * Usage:
 *   node gemini-api.js --image /path/to/image.png --prompt-file /tmp/prompt.txt
 *   node gemini-api.js --prompt-file /tmp/prompt.txt --follow-up
 *   node gemini-api.js --prompt-file /tmp/prompt.txt --final
 *
 * Options:
 *   --image        Path to reference image (optional for text-to-image)
 *   --prompt       Inline text prompt
 *   --prompt-file  Path to file containing the prompt
 *   --model        Model ID override (default: pipeline auto-selects)
 *   --size         Output size override: 1K, 2K, 4K (default: pipeline auto-selects)
 *   --aspect       Aspect ratio: 1:1, 16:9, 4:3, 3:4, 9:16 (default: auto)
 *   --output       Output directory (default: same as input image, or ~/Desktop)
 *   --follow-up    Use conversation history from previous run for iterative edits
 *   --final        Final render: upscale via 3.1 Flash at 4K (default, cheaper)
 *   --final-hq     Final render: native 4K via 3 Pro (highest quality, costs more)
 *   --api-key      Gemini API key (or set GEMINI_API_KEY env var)
 *   --extra-images  Comma-separated paths to additional reference images (e.g., --extra-images face.png,shoe.png,location.png)
 *   --creative     Higher temperature (1.4) for generating varied versions
 *   --person-gen   Enable person generation: ALLOW_ALL, ALLOW_ADULT, ALLOW_NONE
 */

import { GoogleGenAI } from '@google/genai';
import fs from 'node:fs';
import path from 'node:path';

const HISTORY_FILE = '/tmp/gemini-api-history.json';
const SESSION_FILE = '/tmp/gemini-api-session.json';

// Pipeline defaults
const ITERATION_MODEL = 'gemini-3.1-flash-image-preview';
const ITERATION_SIZE = '1K';
const FINAL_UPSCALE_MODEL = 'gemini-3.1-flash-image-preview';  // default: upscale via Flash
const FINAL_HQ_MODEL = 'gemini-3-pro-image-preview';           // --final-hq: native Pro
const FINAL_SIZE = '4K';

// ── Parse Args ──
function parseArgs() {
  const args = process.argv.slice(2);
  const parsed = {};
  for (let i = 0; i < args.length; i++) {
    if (args[i] === '--image' && args[i + 1]) parsed.image = args[++i];
    if (args[i] === '--prompt' && args[i + 1]) parsed.prompt = args[++i];
    if (args[i] === '--prompt-file' && args[i + 1]) parsed.promptFile = args[++i];
    if (args[i] === '--model' && args[i + 1]) parsed.model = args[++i];
    if (args[i] === '--size' && args[i + 1]) parsed.size = args[++i];
    if (args[i] === '--aspect' && args[i + 1]) parsed.aspect = args[++i];
    if (args[i] === '--output' && args[i + 1]) parsed.output = args[++i];
    if (args[i] === '--api-key' && args[i + 1]) parsed.apiKey = args[++i];
    if (args[i] === '--follow-up') parsed.followUp = true;
    if (args[i] === '--final') parsed.final = true;
    if (args[i] === '--final-hq') { parsed.final = true; parsed.finalHQ = true; }
    if (args[i] === '--creative') parsed.creative = true;
    if (args[i] === '--person-gen' && args[i + 1]) parsed.personGen = args[++i];
    if (args[i] === '--extra-images' && args[i + 1]) parsed.extraImages = args[++i];
  }
  if (parsed.promptFile) {
    parsed.prompt = fs.readFileSync(parsed.promptFile, 'utf8');
  }
  return parsed;
}

// ── Detect MIME type ──
function getMimeType(filePath) {
  const ext = path.extname(filePath).toLowerCase();
  const mimeTypes = {
    '.png': 'image/png',
    '.jpg': 'image/jpeg',
    '.jpeg': 'image/jpeg',
    '.webp': 'image/webp',
    '.gif': 'image/gif',
    '.bmp': 'image/bmp',
  };
  return mimeTypes[ext] || 'image/png';
}

// ── Load conversation history for follow-ups ──
function loadHistory() {
  try {
    if (fs.existsSync(HISTORY_FILE)) {
      return JSON.parse(fs.readFileSync(HISTORY_FILE, 'utf8'));
    }
  } catch {}
  return [];
}

// ── Save conversation history ──
function saveHistory(history) {
  fs.writeFileSync(HISTORY_FILE, JSON.stringify(history, null, 2));
}

// ── Load/save session (persists original image path and accumulated prompts) ──
function loadSession() {
  try {
    if (fs.existsSync(SESSION_FILE)) {
      return JSON.parse(fs.readFileSync(SESSION_FILE, 'utf8'));
    }
  } catch {}
  return {};
}

function saveSession(session) {
  fs.writeFileSync(SESSION_FILE, JSON.stringify(session, null, 2));
}

// ── Main ──
async function main() {
  const args = parseArgs();

  if (!args.prompt && !args.final) {
    console.error('Usage: node gemini-api.js --image /path/to/image.png --prompt "your edit"');
    console.error('  Or:  node gemini-api.js --prompt "generate an image of..."');
    console.error('  Or:  node gemini-api.js --final  (re-render at 4K with Pro model)');
    process.exit(1);
  }

  // Resolve API key
  const apiKey = args.apiKey || process.env.GEMINI_API_KEY;
  if (!apiKey) {
    console.error('[ERROR] No API key provided.');
    console.error('  Set GEMINI_API_KEY environment variable, or pass --api-key YOUR_KEY');
    console.error('  Get a free key at: https://aistudio.google.com/apikey');
    process.exit(1);
  }

  // Load session for persistent state
  let session = loadSession();

  // ── Final render mode ──
  if (args.final) {
    if (!session.originalImagePath || !session.allPrompts || session.allPrompts.length === 0) {
      console.error('[ERROR] No session found. Run an iteration first before using --final.');
      process.exit(1);
    }

    const isHQ = args.finalHQ;
    const finalMode = isHQ ? 'NATIVE 4K (Highest Quality)' : 'UPSCALED 4K (Default)';
    const finalModelName = isHQ ? 'Gemini 3 Pro Image' : 'Gemini 3.1 Flash Image';

    console.log('═══════════════════════════════════════════════════');
    console.log(`  FINAL 4K RENDER — ${finalModelName}`);
    console.log(`  Mode: ${finalMode}`);
    console.log('═══════════════════════════════════════════════════');

    // Combine all prompts from the session into a single comprehensive prompt
    // Prepend strict element lock-in constraints to prevent drift between 1K→4K
    const FINAL_RENDER_CONSTRAINTS = `CRITICAL CONSTRAINTS FOR FINAL RENDER — YOU MUST FOLLOW THESE:
1. This is a higher-resolution re-render of an already-approved edit. The output MUST match the approved 1K preview exactly, just at higher resolution.
2. DO NOT change the camera angle, perspective, or framing. The viewpoint must remain IDENTICAL to the reference image.
3. DO NOT add, remove, reposition, or resize ANY element beyond what the edit instructions below specify.
4. DO NOT change any artwork content, wall decorations, or shelf contents beyond what is explicitly requested.
5. DO NOT alter furniture positions, room layout, or spatial relationships.
6. DO NOT shift colors, lighting intensity, or shadow positions beyond what is explicitly requested.
7. DO NOT change text on books, labels, or signs unless explicitly requested.
8. Every object, decoration, and detail must appear in the EXACT same position and form as in the reference image, with only the explicitly requested modifications applied.
9. ONLY modify what is explicitly listed in the edit instructions below. Everything else must remain pixel-perfect identical to the reference image.

`;

    let combinedPrompt = FINAL_RENDER_CONSTRAINTS + session.allPrompts.join('\n\nADDITIONALLY, apply these follow-up changes:\n\n');

    const imagePath = path.resolve(session.originalImagePath);
    if (!fs.existsSync(imagePath)) {
      console.error('[ERROR] Original image not found: ' + imagePath);
      process.exit(1);
    }

    // For upscale mode, prepend an explicit upscale instruction
    if (!isHQ) {
      combinedPrompt = 'IMPORTANT: Generate this at the highest possible resolution with maximum sharpness and fine detail.\n\n' + combinedPrompt;
    }

    const model = args.model || (isHQ ? FINAL_HQ_MODEL : FINAL_UPSCALE_MODEL);
    const size = args.size || FINAL_SIZE;
    console.log(`[INFO] Model: ${model} @ ${size}`);
    console.log(`[INFO] Cost: ~${isHQ ? '$0.240' : '$0.067'} per image`);
    console.log(`[INFO] Reference image: ${path.basename(imagePath)}`);

    const imageData = fs.readFileSync(imagePath);
    const base64Image = imageData.toString('base64');
    const mimeType = getMimeType(imagePath);
    console.log(`[OK] Original image loaded (${Math.round(imageData.length / 1024)}KB, ${mimeType})`);

    const outputDir = args.output ? path.resolve(args.output) : path.dirname(imagePath);
    const baseName = path.parse(imagePath).name;
    const timestamp = new Date().toISOString().replace(/[:.]/g, '-').substring(0, 19);
    const outputPath = path.join(outputDir, `${baseName}_FINAL_4K_${timestamp}.png`);

    const ai = new GoogleGenAI({ apiKey });

    const generationConfig = {
      responseModalities: ['TEXT', 'IMAGE'],
      temperature: args.creative ? 1.4 : 0.4,
      imageConfig: { imageSize: size },
    };
    if (args.aspect) generationConfig.imageConfig.aspectRatio = args.aspect;
    // personGeneration parameter is not supported by Gemini API — people are generated natively from the prompt
    console.log(`[INFO] Temperature: ${generationConfig.temperature} (${args.creative ? 'creative' : 'consistent'})`);
    if (args.personGen) console.log(`[INFO] Person generation: ${args.personGen}`);

    const contents = [{
      role: 'user',
      parts: [
        { inlineData: { mimeType, data: base64Image } },
        { text: combinedPrompt },
      ],
    }];

    console.log(`[...] Sending FINAL render to Gemini API (${combinedPrompt.length} chars)...`);
    const startTime = Date.now();

    let response;
    try {
      response = await ai.models.generateContent({
        model,
        contents,
        config: generationConfig,
      });
    } catch (err) {
      console.error(`[ERROR] API call failed: ${err.message}`);
      process.exit(1);
    }

    const elapsed = Math.round((Date.now() - startTime) / 1000);
    console.log(`[OK] Response received in ${elapsed}s`);

    let imageFound = false;
    if (response.candidates && response.candidates[0]?.content?.parts) {
      for (const part of response.candidates[0].content.parts) {
        if (part.text) {
          console.log(`[INFO] Gemini says: ${part.text.substring(0, 200)}`);
        } else if (part.inlineData) {
          const buffer = Buffer.from(part.inlineData.data, 'base64');
          fs.writeFileSync(outputPath, buffer);
          const sizeKB = Math.round(buffer.length / 1024);
          console.log(`[OK] FINAL 4K image saved: ${outputPath} (${sizeKB}KB)`);
          imageFound = true;
          try {
            const { execSync } = await import('node:child_process');
            const dims = execSync(`sips -g pixelWidth -g pixelHeight "${outputPath}" 2>/dev/null`).toString();
            const w = dims.match(/pixelWidth:\s*(\d+)/);
            const h = dims.match(/pixelHeight:\s*(\d+)/);
            if (w && h) console.log(`[INFO] Resolution: ${w[1]}x${h[1]}`);
          } catch {}
        }
      }
    }

    if (!imageFound) {
      console.log('[WARN] No image in response.');
      process.exit(1);
    }

    console.log('[DONE] Final 4K render complete.');
    return;
  }

  // ── Iteration mode (default) ──
  // Auto-select model/size for iteration unless explicitly overridden
  const model = args.model || ITERATION_MODEL;
  const size = args.size || ITERATION_SIZE;
  console.log(`[INFO] Model: ${model} @ ${size} (iteration mode)`);

  // Resolve image path
  let imagePath;
  if (args.image) {
    imagePath = path.resolve(args.image);
    if (!fs.existsSync(imagePath)) {
      console.error('[ERROR] Image not found: ' + imagePath);
      process.exit(1);
    }
    console.log(`[INFO] Reference image: ${path.basename(imagePath)}`);
    // Save original image path to session
    session.originalImagePath = imagePath;
    session.allPrompts = [args.prompt];
    saveSession(session);
  }

  // Output path — always use original image's directory
  const outputDir = args.output
    ? path.resolve(args.output)
    : session.originalImagePath
      ? path.dirname(path.resolve(session.originalImagePath))
      : imagePath
        ? path.dirname(imagePath)
        : path.join(process.env.HOME, 'Desktop');
  const baseName = imagePath
    ? path.parse(imagePath).name
    : session.originalImagePath
      ? path.parse(session.originalImagePath).name
      : 'gemini-api-output';
  const timestamp = new Date().toISOString().replace(/[:.]/g, '-').substring(0, 19);
  const outputPath = path.join(outputDir, `${baseName}_edited_${timestamp}.png`);

  // Initialize the SDK
  const ai = new GoogleGenAI({ apiKey });

  // Build generation config
  // Default: low temperature (0.4) for consistency. --creative raises to 1.4 for varied output.
  const generationConfig = {
    responseModalities: ['TEXT', 'IMAGE'],
    temperature: args.creative ? 1.4 : 0.4,
  };
  console.log(`[INFO] Temperature: ${generationConfig.temperature} (${args.creative ? 'creative' : 'consistent'})`);
  const imageConfig = {};
  if (size) imageConfig.imageSize = size;
  if (args.aspect) imageConfig.aspectRatio = args.aspect;
  if (args.personGen) {
    console.log(`[INFO] Person generation flag ignored — Gemini generates people natively from the prompt. No API parameter needed.`);
  }
  if (Object.keys(imageConfig).length > 0) {
    generationConfig.imageConfig = imageConfig;
  }

  // Build the content parts
  const parts = [];
  let contents;

  if (args.followUp) {
    const history = loadHistory();
    if (history.length > 0) {
      console.log(`[INFO] Follow-up mode: loaded ${history.length} previous turns`);
      contents = [...history, { role: 'user', parts: [{ text: args.prompt }] }];
      // Append prompt to session
      session = loadSession();
      if (!session.allPrompts) session.allPrompts = [];
      session.allPrompts.push(args.prompt);
      saveSession(session);
    } else {
      console.log('[WARN] No conversation history found. Starting fresh.');
      args.followUp = false;
    }
  }

  if (!args.followUp) {
    if (imagePath) {
      const imageData = fs.readFileSync(imagePath);
      const base64Image = imageData.toString('base64');
      const mimeType = getMimeType(imagePath);
      parts.push({ inlineData: { mimeType, data: base64Image } });
      console.log(`[OK] Image loaded (${Math.round(imageData.length / 1024)}KB, ${mimeType})`);
    }
    // Load extra reference images (--extra-images face.png,shoe.png,location.png)
    if (args.extraImages) {
      const extraPaths = args.extraImages.split(',').map(p => p.trim()).filter(Boolean);
      for (const extraPath of extraPaths) {
        const resolvedExtra = path.resolve(extraPath);
        if (fs.existsSync(resolvedExtra)) {
          const extraData = fs.readFileSync(resolvedExtra);
          const extraBase64 = extraData.toString('base64');
          const extraMime = getMimeType(resolvedExtra);
          parts.push({ inlineData: { mimeType: extraMime, data: extraBase64 } });
          console.log(`[OK] Extra reference loaded: ${path.basename(resolvedExtra)} (${Math.round(extraData.length / 1024)}KB)`);
        } else {
          console.log(`[WARN] Extra image not found: ${resolvedExtra}`);
        }
      }
    }
    parts.push({ text: args.prompt });
    contents = [{ role: 'user', parts }];
  }

  // Call the API
  console.log(`[...] Sending to Gemini API (prompt: ${args.prompt.length} chars)...`);
  const startTime = Date.now();

  let response;
  try {
    response = await ai.models.generateContent({
      model,
      contents,
      config: generationConfig,
    });
  } catch (err) {
    console.error(`[ERROR] API call failed: ${err.message}`);
    if (err.message.includes('API key')) {
      console.error('[HINT] Check your API key at https://aistudio.google.com/apikey');
    }
    if (err.message.includes('quota') || err.message.includes('rate')) {
      console.error('[HINT] You may have hit the free tier rate limit (~500 req/day)');
    }
    process.exit(1);
  }

  const elapsed = Math.round((Date.now() - startTime) / 1000);
  console.log(`[OK] Response received in ${elapsed}s`);

  // Process response
  let imageFound = false;
  let responseText = '';

  if (response.candidates && response.candidates[0]?.content?.parts) {
    for (const part of response.candidates[0].content.parts) {
      if (part.text) {
        responseText += part.text;
      } else if (part.inlineData) {
        const buffer = Buffer.from(part.inlineData.data, 'base64');
        fs.writeFileSync(outputPath, buffer);
        const sizeKB = Math.round(buffer.length / 1024);
        console.log(`[OK] Image saved: ${outputPath} (${sizeKB}KB)`);
        imageFound = true;
        try {
          const { execSync } = await import('node:child_process');
          const dims = execSync(`sips -g pixelWidth -g pixelHeight "${outputPath}" 2>/dev/null`).toString();
          const w = dims.match(/pixelWidth:\s*(\d+)/);
          const h = dims.match(/pixelHeight:\s*(\d+)/);
          if (w && h) console.log(`[INFO] Resolution: ${w[1]}x${h[1]}`);
        } catch {}
      }
    }
  }

  if (responseText) {
    console.log(`[INFO] Gemini says: ${responseText.substring(0, 200)}`);
  }

  if (!imageFound) {
    console.log('[WARN] No image in response. Gemini may have responded with text only.');
    if (responseText) console.log('[FULL RESPONSE TEXT]:', responseText);
    process.exit(1);
  }

  // Save conversation history for follow-up edits
  const newHistory = contents.slice();
  if (response.candidates && response.candidates[0]?.content) {
    const modelParts = response.candidates[0].content.parts
      .filter(p => p.text)
      .map(p => ({ text: p.text }));
    if (imageFound) {
      modelParts.push({ text: '[Image was generated and saved]' });
    }
    newHistory.push({ role: 'model', parts: modelParts });
  }
  saveHistory(newHistory);

  console.log('[DONE] Image editing complete (iteration preview — final 4K render available with --final).');
}

main().catch(err => {
  console.error('[ERROR]', err.message);
  process.exit(1);
});
