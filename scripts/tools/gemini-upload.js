#!/usr/bin/env node
/**
 * gemini-upload.js
 *
 * Automates uploading an image and sending a JSON prompt to Google Gemini Pro
 * via Chrome browser. Uses puppeteer-core connecting to Chrome's remote debugging.
 *
 * Usage:
 *   node gemini-upload.js --image /path/to/image.png --prompt "your prompt"
 *   node gemini-upload.js --image /path/to/image.png --prompt-file /path/to/prompt.txt
 *   node gemini-upload.js --prompt "just a text prompt, no image"
 */

const puppeteer = require('puppeteer-core');
const path = require('path');
const fs = require('fs');
const { execSync, spawn } = require('child_process');

const CHROME_PATH = '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome';
const DEBUG_PORT = 9222;
const GEMINI_URL = 'https://gemini.google.com/app';
const PROFILE_DIR = path.join(process.env.HOME, '.chrome-gemini-profile');

// ── Parse Args ──
function parseArgs() {
  const args = process.argv.slice(2);
  const parsed = {};
  for (let i = 0; i < args.length; i++) {
    if (args[i] === '--image' && args[i + 1]) parsed.image = args[++i];
    if (args[i] === '--prompt' && args[i + 1]) parsed.prompt = args[++i];
    if (args[i] === '--prompt-file' && args[i + 1]) parsed.promptFile = args[++i];
    if (args[i] === '--no-launch') parsed.noLaunch = true;
    if (args[i] === '--no-submit') parsed.noSubmit = true;
  }
  if (parsed.promptFile) {
    parsed.prompt = fs.readFileSync(parsed.promptFile, 'utf8');
  }
  return parsed;
}

// ── Launch Chrome with remote debugging ──
function launchChrome() {
  try {
    execSync(`curl -s http://localhost:${DEBUG_PORT}/json/version`, { timeout: 2000 });
    console.log('[OK] Chrome already running with remote debugging on port ' + DEBUG_PORT);
    return null;
  } catch {}

  console.log('[...] Launching Chrome with remote debugging...');
  const child = spawn(CHROME_PATH, [
    `--remote-debugging-port=${DEBUG_PORT}`,
    '--no-first-run',
    '--no-default-browser-check',
    `--user-data-dir=${PROFILE_DIR}`,
  ], { detached: true, stdio: 'ignore' });
  child.unref();
  return child;
}

// ── Wait for Chrome ──
async function waitForChrome(maxWait = 15000) {
  const start = Date.now();
  while (Date.now() - start < maxWait) {
    try {
      execSync(`curl -s http://localhost:${DEBUG_PORT}/json/version`, { timeout: 2000 });
      return true;
    } catch { await new Promise(r => setTimeout(r, 500)); }
  }
  throw new Error('Chrome did not start within ' + maxWait + 'ms');
}

const wait = (ms) => new Promise(r => setTimeout(r, ms));

// ── Main ──
async function main() {
  const args = parseArgs();

  if (!args.prompt && !args.image) {
    console.error('Usage: node gemini-upload.js --image /path/to/image.png --prompt "your prompt"');
    process.exit(1);
  }

  // Validate image
  let imagePath;
  if (args.image) {
    imagePath = path.resolve(args.image);
    if (!fs.existsSync(imagePath)) {
      console.error('[ERROR] Image not found: ' + imagePath);
      process.exit(1);
    }
  }

  // Step 1: Launch Chrome
  if (!args.noLaunch) {
    launchChrome();
    await waitForChrome();
  }

  // Step 2: Connect
  console.log('[...] Connecting to Chrome...');
  const browser = await puppeteer.connect({
    browserURL: `http://localhost:${DEBUG_PORT}`,
    defaultViewport: null
  });

  // Step 3: Find or open Gemini tab
  let pages = await browser.pages();
  let page = pages.find(p => p.url().includes('gemini.google.com'));

  if (!page) {
    console.log('[...] Opening Gemini...');
    page = await browser.newPage();
    await page.goto(GEMINI_URL, { waitUntil: 'networkidle2', timeout: 30000 });
  } else {
    console.log('[OK] Found existing Gemini tab');
    await page.bringToFront();
  }

  // Step 4: Wait for the Quill editor
  console.log('[...] Waiting for Gemini interface...');
  await page.waitForSelector('.ql-editor[aria-label="Enter a prompt for Gemini"]', { timeout: 20000 });
  await wait(1500);
  console.log('[OK] Gemini interface loaded');

  // ═══════════════════════════════════════════════════════════════
  // Step 5: Upload image — using Puppeteer's FileChooser interception
  // ═══════════════════════════════════════════════════════════════
  if (imagePath) {
    console.log('[...] Uploading image: ' + path.basename(imagePath));
    let uploadSuccess = false;

    // ── Method 1: waitForFileChooser (best — intercepts before dialog opens) ──
    try {
      // Step A: Click the upload menu button to open dropdown
      await page.evaluate(() => {
        const btns = Array.from(document.querySelectorAll('button'));
        const uploadBtn = btns.find(b => (b.getAttribute('aria-label') || '').includes('Open upload file menu'));
        if (uploadBtn) uploadBtn.click();
      });
      await wait(800);

      // Step B: Set up the file chooser interception BEFORE clicking the menu item
      // waitForFileChooser() must be called before the action that triggers the chooser
      const fileChooserPromise = page.waitForFileChooser({ timeout: 5000 });

      // Step C: Click "Upload file" menu item (this triggers the file chooser)
      await page.evaluate(() => {
        const menuItems = Array.from(document.querySelectorAll('[role="menuitem"], .mat-mdc-menu-item, button'));
        const uploadItem = menuItems.find(el => {
          const txt = (el.textContent || '').toLowerCase();
          return txt.includes('upload file') || txt.includes('upload from computer') || txt.includes('from computer');
        });
        if (uploadItem) uploadItem.click();
      });

      // Step D: Accept the file chooser with our image (no dialog ever opens)
      const fileChooser = await fileChooserPromise;
      await fileChooser.accept([imagePath]);

      console.log('[OK] Image uploaded via FileChooser interception (no dialog)');
      uploadSuccess = true;
      await wait(3000); // Wait for upload processing + thumbnail to appear

    } catch (err) {
      console.log('[...] FileChooser method failed (' + err.message.substring(0, 50) + '), trying fallback...');
    }

    // ── Method 2: Direct file input (fallback) ──
    if (!uploadSuccess) {
      try {
        let fileInput = await page.$('input[type="file"]');

        if (!fileInput) {
          // The menu click above may have already created the input — just find it
          await wait(1000);
          fileInput = await page.$('input[type="file"]');
        }

        if (fileInput) {
          await fileInput.uploadFile(imagePath);
          console.log('[OK] Image uploaded via file input');
          uploadSuccess = true;
          await wait(3000);
        }
      } catch (err) {
        console.log('[...] File input method failed: ' + err.message.substring(0, 50));
      }
    }

    // ── Method 3: Drag-and-drop simulation (last resort) ──
    if (!uploadSuccess) {
      try {
        // Read the file and create a drag-drop event
        const fileBuffer = fs.readFileSync(imagePath);
        const mimeType = imagePath.endsWith('.png') ? 'image/png' :
                         imagePath.endsWith('.webp') ? 'image/webp' :
                         imagePath.endsWith('.jpg') || imagePath.endsWith('.jpeg') ? 'image/jpeg' : 'image/png';
        const fileName = path.basename(imagePath);

        await page.evaluate(async (fileData, mime, name) => {
          const byteArray = new Uint8Array(fileData);
          const blob = new Blob([byteArray], { type: mime });
          const file = new File([blob], name, { type: mime });
          const dt = new DataTransfer();
          dt.items.add(file);

          const editor = document.querySelector('.ql-editor') || document.body;
          const dropEvent = new DragEvent('drop', {
            bubbles: true,
            cancelable: true,
            dataTransfer: dt
          });
          editor.dispatchEvent(dropEvent);
        }, Array.from(fileBuffer), mimeType, fileName);

        console.log('[OK] Image uploaded via drag-drop simulation');
        uploadSuccess = true;
        await wait(3000);

      } catch (err) {
        console.log('[ERROR] All upload methods failed: ' + err.message.substring(0, 80));
        console.log('[INFO] Image path copied to clipboard — please upload manually.');
        execSync(`printf '%s' "${imagePath}" | pbcopy`);
      }
    }

    // Verify the image is actually attached
    if (uploadSuccess) {
      const attached = await page.evaluate(() => {
        // Check for the upload preview (Gemini shows "Uploaded image preview")
        const preview = document.querySelector('.file-preview-container img, [alt="Uploaded image preview"]');
        return !!preview;
      });
      if (attached) {
        console.log('[OK] Image attachment confirmed in editor');
      } else {
        console.log('[WARN] Image may not be attached — verify in Gemini tab');
      }
    }
  }

  // ═══════════════════════════════════════════════════════════════
  // Step 6: Enter prompt — using execCommand for framework compat
  // ═══════════════════════════════════════════════════════════════
  if (args.prompt) {
    console.log('[...] Entering prompt (' + args.prompt.length + ' chars)...');

    // Focus the editor
    await page.click('.ql-editor[aria-label="Enter a prompt for Gemini"]');
    await wait(300);

    // Select all + delete any existing content
    await page.keyboard.down('Meta');
    await page.keyboard.press('a');
    await page.keyboard.up('Meta');
    await page.keyboard.press('Backspace');
    await wait(200);

    // Strategy: Use Chrome DevTools Protocol (CDP) Input.insertText.
    // This bypasses Quill's execCommand handling and injects text at the
    // browser engine level — it handles newlines, triggers all framework
    // events, and keeps Quill/Angular state in sync.
    const client = await page.createCDPSession();

    // Focus the editor via evaluate to ensure cursor is placed
    await page.evaluate(() => {
      const editor = document.querySelector('.ql-editor[aria-label="Enter a prompt for Gemini"]');
      if (editor) {
        editor.focus();
        // Place cursor at start
        const sel = window.getSelection();
        sel.selectAllChildren(editor);
        document.execCommand('delete', false);
      }
    });
    await wait(200);

    // Insert the full multi-line text via CDP
    await client.send('Input.insertText', { text: args.prompt });
    await client.detach();

    console.log('[OK] Prompt entered via CDP Input.insertText');

    // Verify
    const finalCheck = await page.evaluate(() => {
      const editor = document.querySelector('.ql-editor');
      const text = editor ? editor.innerText.trim() : '';
      return { length: text.length, preview: text.substring(0, 120) };
    });
    console.log('[CHECK] Editor has ' + finalCheck.length + ' chars: "' + finalCheck.preview + '..."');

    await wait(500);

    // ═══════════════════════════════════════════════════════════════
    // Step 7: Submit
    // ═══════════════════════════════════════════════════════════════
    if (!args.noSubmit && finalCheck.length > 0) {
      console.log('[...] Submitting to Gemini...');

      // Click the send/submit button directly
      const submitClicked = await page.evaluate(() => {
        const btns = Array.from(document.querySelectorAll('button'));
        const submitBtn = btns.find(b => {
          const label = (b.getAttribute('aria-label') || '').toLowerCase();
          return label.includes('send') || label.includes('submit') || label.includes('run');
        });
        if (submitBtn && !submitBtn.disabled) { submitBtn.click(); return true; }
        return false;
      });

      if (submitClicked) {
        console.log('[OK] Submitted via send button');
      } else {
        await page.keyboard.press('Enter');
        console.log('[OK] Submitted via Enter key');
      }
    } else if (finalCheck.length === 0) {
      console.log('[ERROR] No text in editor. Prompt copied to clipboard — paste manually.');
      fs.writeFileSync('/tmp/.gemini-prompt-clipboard', args.prompt);
      execSync('cat /tmp/.gemini-prompt-clipboard | pbcopy');
    } else {
      console.log('[INFO] --no-submit flag set.');
    }
  }

  // ═══════════════════════════════════════════════════════════════
  // Step 8: Wait for Gemini to finish, then download generated image
  // ═══════════════════════════════════════════════════════════════
  if (!args.noSubmit && args.prompt) {
    const outputDir = imagePath ? path.dirname(imagePath) : path.join(process.env.HOME, 'Desktop');
    const baseName = imagePath ? path.parse(imagePath).name : 'gemini-output';
    const timestamp = new Date().toISOString().replace(/[:.]/g, '-').substring(0, 19);
    const outputFilename = `${baseName}_edited_${timestamp}.png`;
    const outputPath = path.join(outputDir, outputFilename);

    // --- Phase A: Wait for generation to complete ---
    // Gemini image gen typically takes 15-60s. Don't poll for images too early.
    // Instead, detect when Gemini STOPS generating by watching for:
    //   1. "Stop generating" button disappears
    //   2. No more progress bars / spinners / aria-busy on response
    //   3. <GENERATED-IMAGE> element appears in the DOM

    // Count existing generated images BEFORE submission so we can detect the NEW one
    const imageCountBefore = await page.evaluate(() => {
      return document.querySelectorAll('generated-image img, single-image.generated-image img').length;
    });
    console.log(`[INFO] ${imageCountBefore} generated image(s) already in conversation`);
    console.log('[...] Waiting for Gemini to finish generating (max 5 min)...');

    const maxWaitMs = 300000; // 5 minutes
    const pollInterval = 3000;
    const startTime = Date.now();
    let generationDone = false;

    // Initial wait — image generation always takes at least 10-15s
    await wait(10000);

    while (Date.now() - startTime < maxWaitMs) {
      const status = await page.evaluate(() => {
        // Detect active generation:
        // 1. "Stop generating" button visible = still generating
        const stopBtn = Array.from(document.querySelectorAll('button')).find(b => {
          const label = (b.getAttribute('aria-label') || b.textContent || '').toLowerCase();
          return label.includes('stop') && b.offsetParent !== null;
        });
        // 2. Progress bars or spinners
        const spinner = document.querySelector('mat-progress-bar, mat-spinner, .loading-indicator');
        // 3. Response area still has aria-busy
        const busyEl = document.querySelector('model-response[aria-busy="true"], [aria-busy="true"]');

        const isGenerating = !!(stopBtn || spinner || (busyEl && busyEl.offsetParent !== null));

        // Detect generated images — count ALL of them to compare with pre-submission count
        const generatedImgs = Array.from(document.querySelectorAll(
          'generated-image img, single-image.generated-image img'
        )).filter(img => {
          const w = img.naturalWidth || img.width || 0;
          const h = img.naturalHeight || img.height || 0;
          return w >= 200 && h >= 200;
        });

        return {
          isGenerating,
          currentImageCount: generatedImgs.length,
          debugStopBtn: !!stopBtn,
          debugSpinner: !!spinner,
          debugBusy: !!(busyEl && busyEl.offsetParent !== null)
        };
      });

      const elapsed = Math.round((Date.now() - startTime) / 1000);

      if (status.isGenerating) {
        process.stdout.write(`\r[...] Gemini generating... (${elapsed}s) [stop=${status.debugStopBtn} spinner=${status.debugSpinner} busy=${status.debugBusy}] images: ${status.currentImageCount}/${imageCountBefore}    `);
        await wait(pollInterval);
        continue;
      }

      // Check if a NEW image appeared (count increased from before submission)
      if (status.currentImageCount > imageCountBefore) {
        // Wait 3 more seconds for the image to fully render at high resolution
        await wait(3000);
        console.log(`\n[OK] New generated image detected after ${elapsed}s (was ${imageCountBefore}, now ${status.currentImageCount})`);
        generationDone = true;
        break;
      }

      // No active generation, no new image yet — might be processing text response first
      if (elapsed > 120 && status.currentImageCount <= imageCountBefore) {
        console.log(`\n[WARN] No new generated image found after ${elapsed}s. Gemini may have responded with text only.`);
        break;
      }

      await wait(pollInterval);
    }

    if (!generationDone && Date.now() - startTime >= maxWaitMs) {
      console.log('\n[TIMEOUT] Generation did not complete within 5 minutes.');
    }

    // --- Phase B: Download the LATEST generated image at FULL RESOLUTION ---
    //
    // STRATEGY: Click the download button directly on the LAST generated-image
    // card element (NOT the expansion dialog). This triggers Gemini's native
    // download which saves the correct full-size image (~6MB, 2500+ px) to
    // ~/Downloads/ as "Gemini_Generated_Image_*.png". Then move it to the
    // output directory.
    if (generationDone) {
      let imageFound = false;

      // Scroll to bottom so the last image is visible
      await page.evaluate(() => window.scrollTo(0, document.body.scrollHeight));
      await wait(1000);

      // Get image count for logging
      const imgCount = await page.evaluate(() => {
        return document.querySelectorAll('generated-image img, single-image.generated-image img')
          .length;
      });
      console.log(`[INFO] ${imgCount} generated image(s) in conversation`);

      // Snapshot ~/Downloads before clicking download (to detect the new file)
      const dlDir = path.join(process.env.HOME, 'Downloads');
      const beforeFiles = new Set(fs.readdirSync(dlDir));

      // Click the download button on the LAST generated-image card
      const dlClicked = await page.evaluate(() => {
        const genImgs = Array.from(document.querySelectorAll('generated-image'));
        if (genImgs.length === 0) return false;
        const lastGen = genImgs[genImgs.length - 1];
        const dlBtn = lastGen.querySelector('button[aria-label="Download full size image"]');
        if (dlBtn) { dlBtn.click(); return true; }
        return false;
      });

      if (dlClicked) {
        console.log('[OK] Download clicked on image card ' + imgCount + ' (latest)');
        console.log('[...] Waiting for file in ~/Downloads/...');

        // Poll ~/Downloads for a new file (max 30 seconds)
        const dlMaxWait = 30000;
        const dlStart = Date.now();
        let newFile = null;

        while (Date.now() - dlStart < dlMaxWait) {
          await wait(2000);
          const afterFiles = fs.readdirSync(dlDir);
          const newFiles = afterFiles.filter(f =>
            !beforeFiles.has(f) &&
            !f.startsWith('.') &&
            !f.endsWith('.crdownload') // Chrome partial download
          );

          if (newFiles.length > 0) {
            // Pick the largest new file (should be the full-size image)
            const candidates = newFiles.map(f => {
              const p = path.join(dlDir, f);
              try { const s = fs.statSync(p); return { name: f, path: p, size: s.size }; }
              catch { return null; }
            }).filter(f => f && f.size > 50000).sort((a, b) => b.size - a.size);

            if (candidates.length > 0) {
              newFile = candidates[0];
              break;
            }
          }

          const elapsed = Math.round((Date.now() - dlStart) / 1000);
          process.stdout.write(`\r[...] Waiting... (${elapsed}s)   `);
        }

        console.log('');

        if (newFile) {
          // Move the downloaded file to the output directory with our naming
          try { fs.renameSync(newFile.path, outputPath); }
          catch { fs.copyFileSync(newFile.path, outputPath); fs.unlinkSync(newFile.path); }

          const sizeKB = Math.round(newFile.size / 1024);
          console.log(`[OK] Full-size image saved: ${outputPath} (${sizeKB}KB)`);
          imageFound = true;

          // Log dimensions
          try {
            const dims = execSync(`sips -g pixelWidth -g pixelHeight "${outputPath}" 2>/dev/null`).toString();
            const w = dims.match(/pixelWidth:\s*(\d+)/);
            const h = dims.match(/pixelHeight:\s*(\d+)/);
            if (w && h) console.log(`[INFO] Resolution: ${w[1]}x${h[1]}`);
          } catch {}
        } else {
          console.log('[WARN] No new file detected in ~/Downloads/ after 30s');
        }
      } else {
        console.log('[WARN] No download button found on the last image card');
      }

      // Fallback: direct URL with =w2048-h2048 (correct image, lower res)
      if (!imageFound) {
        console.log('[...] Fallback: downloading via direct URL (=w2048-h2048)...');
        const targetSrc = await page.evaluate(() => {
          const imgs = Array.from(document.querySelectorAll('generated-image img, single-image.generated-image img'))
            .filter(i => (i.naturalWidth || i.width) >= 200);
          return imgs.length > 0 ? imgs[imgs.length - 1].src : null;
        });

        if (targetSrc) {
          try {
            const directUrl = targetSrc.replace(/=[^/]*$/, '=w2048-h2048');
            const imgPage = await browser.newPage();
            const resp = await imgPage.goto(directUrl, { waitUntil: 'load', timeout: 15000 });
            if (resp && resp.ok()) {
              const buf = await resp.buffer();
              fs.writeFileSync(outputPath, buf);
              console.log(`[OK] Image saved (fallback): ${outputPath} (${Math.round(buf.length / 1024)}KB)`);
              imageFound = true;
            }
            await imgPage.close();
          } catch {}
        }
      }

      if (!imageFound) console.log('[ERROR] Could not download. Check Gemini tab manually.');
    }
  }

  console.log('[DONE] Check your Gemini tab in Chrome.');
  browser.disconnect();
}

main().catch(err => {
  console.error('[ERROR]', err.message);
  process.exit(1);
});
