'use strict';

// Modules
const fs = require('fs');
const https = require('https');
const path = require('path');
const process = require('process');
const puppeteer = require('puppeteer');
const { spawn } = require('child_process');

// Settings
const dumpURL = 'https://stripchat.com/[username]';
const outputDir = 'samples';
const maxRecordTime = false;
// const maxRecordTime = 60000;
// const maxRecordTime = (60000*10);
const useRemoteInstance = false;
const stopRecordingOnPreviewClose = true;
const pocFile = path.basename(__filename);
let dumpedURLs = [];
let dumpedData = {};

// Browser Instance
// Does not work anymore without API token :(
const getBrowser = () => useRemoteInstance
        // ? puppeteer.connect({ browserWSEndpoint: 'wss://chrome.browserless.io?token=YOUR-API-TOKEN' })
        ? puppeteer.connect({ browserWSEndpoint: 'wss://chrome.browserless.io' })
        : puppeteer.launch();

// Methods
function createDataFolder(path) {
  if (!path) { return false; }
  fs.mkdir(path, { recursive: true }, (err) => {
    if (err) throw err;
  });
}
function logRequest(interceptedRequest) {
  console.log('A request was made:', interceptedRequest.url());
}
function dumpRequest(interceptedRequest) {
  dumpedURLs.push(interceptedRequest.url());
}
function dumpStreamURL() {
  let streamURL;

  if (Array.isArray(dumpedURLs) && dumpedURLs.length > 0) {
    dumpedURLs.forEach(dumpedURL => {
      if (String(dumpedURL).endsWith('.m3u8')) {
        streamURL = dumpedURL;
      }
    });
  }

  // DONE:
  // Format URL from https://b-hls-03.strpst.com/hls/16595881/master/16595881_auto.m3u8
  // To https://b-hls-03.strpst.com/hls/16595881/16595881.m3u8
  //
  // Required because not all streams have the same amounts of programs or mappings
  // then settings like '-map 0:6 -map 0.7' for `ffmpeg` or '-ast p:3 -vst p:3' for `ffplay`
  // will only work for certain streams but not all

  if (streamURL) {
    streamURL = String(streamURL).replace('master/', '');
    streamURL = String(streamURL).replace('_auto', '');
  }

  return streamURL;
}
function dumpSiteSettingsURL() {
  let siteSettingsURL;

  if (Array.isArray(dumpedURLs) && dumpedURLs.length > 0) {
    dumpedURLs.forEach(dumpedURL => {
      if (String(dumpedURL).includes('/availableSettings?')) {
        siteSettingsURL = dumpedURL;
      }
    });
  }

  return siteSettingsURL;
}
function dumpStreamSettingsURL(modelName) {
  let streamSettingsURL = dumpSiteSettingsURL();

  const parsedStreamSettingsURL = new URL(streamSettingsURL);

  let customStreamSettingsURL = parsedStreamSettingsURL.protocol;
  customStreamSettingsURL += '//' + parsedStreamSettingsURL.host;
  customStreamSettingsURL += parsedStreamSettingsURL.pathname.replace('users/availableSettings', `v2/models/username/${modelName}/cam`);

  return customStreamSettingsURL;
}
function dumpSiteConfigURL() {
  let siteConfigURL = dumpSiteSettingsURL();

  const parsedSiteConfigURL = new URL(siteConfigURL);

  let customSiteConfigURL = parsedSiteConfigURL.protocol;
  customSiteConfigURL += '//' + parsedSiteConfigURL.host;
  customSiteConfigURL += parsedSiteConfigURL.pathname.replace('users/availableSettings', 'v2/config');

  return customSiteConfigURL;
}
function dumpSiteModelsURL() {
  let siteModelsURL = dumpSiteSettingsURL();

  const parsedSiteModelsURL = new URL(siteModelsURL);

  let customSiteModelsURL = parsedSiteModelsURL.protocol;
  customSiteModelsURL += '//' + parsedSiteModelsURL.host;
  customSiteModelsURL += parsedSiteModelsURL.pathname.replace('users/availableSettings', 'v2/models');

  return customSiteModelsURL;
}
function dumpModelIntroURL() {
  let modelIntroURL;

  if (Array.isArray(dumpedURLs) && dumpedURLs.length > 0) {
    dumpedURLs.forEach(dumpedURL => {
      if (String(dumpedURL).includes('/intros/latest')) {
        modelIntroURL = dumpedURL;
      }
    });
  }

  return modelIntroURL;
}
function dumpModelInfoURL() {
  let modelInfoURL = dumpModelIntroURL();
  const parsedModelInfoURL = new URL(modelInfoURL);

  let customModelInfoURL = parsedModelInfoURL.protocol;
  customModelInfoURL += '//' + parsedModelInfoURL.host;
  customModelInfoURL += parsedModelInfoURL.pathname.replace('/intros/latest', '');

  return customModelInfoURL;
}
function dumpOnlineModelsURL() {
  let onlineModelsURL;

  if (Array.isArray(dumpedURLs) && dumpedURLs.length > 0) {
    dumpedURLs.forEach(dumpedURL => {
      if (String(dumpedURL).includes('/models?') && String(dumpedURL).includes('offset=')) {
        onlineModelsURL = dumpedURL;
      }
    });
  }

  const parsedOnlineModelsURL = new URL(onlineModelsURL);
  let customOnlineModelURL = parsedOnlineModelsURL.protocol;
  customOnlineModelURL += '//' + parsedOnlineModelsURL.host;
  customOnlineModelURL += parsedOnlineModelsURL.pathname;
  customOnlineModelURL += '?limit=10000&offset=0';

  return customOnlineModelURL;
}
function storeJSON(data, type) {
  dumpedData[type] = data;
  console.log(`[${pocFile}] json: stored data:\n${JSON.stringify(dumpedData)}`);
}
async function dumpJSON(url, path) {
  if (!url) {
    console.error(`[${pocFile}] json: missing URL to fetch.`);
    return false;
  }
  if (!path) {
    console.error(`[${pocFile}] json: missing path to write.`);
    return false;
  }

  console.log(`[${pocFile}] json: fetching [${url}]...`);
  https.get(url, (res) => {
    let rawData = '';

    res.setEncoding('utf8');
    res.on('data', (chunk) => {
      rawData += chunk;
    });

    res.on('end', () => {
        try {
            console.log(`[${pocFile}] json: received data:\n${rawData}`);
            let json = JSON.parse(rawData);
            writeJSON(json, path);
        } catch (error) {
            console.error(error.message);
        };
    });
  }).on('error', (error) => {
      console.error(error.message);
  });
}
async function fetchJSON(url, type) {
  if (!url) {
    console.error(`[${pocFile}] json: missing URL to fetch.`);
    return false;
  }
  if (!type) {
    console.error(`[${pocFile}] json: missing data type to fetch.`);
    return false;
  }

  console.log(`[${pocFile}] json: fetching [${url}]...`);
  https.get(url, (res) => {
    let rawData = '';

    res.setEncoding('utf8');
    res.on('data', (chunk) => {
      rawData += chunk;
    });

    res.on('end', () => {
        try {
            console.log(`[${pocFile}] json: received data:\n${rawData}`);
            let json = JSON.parse(rawData);
            storeJSON(json, type);
            return json;
        } catch (error) {
            console.error(error.message);
        };
    });
  }).on('error', (error) => {
      console.error(error.message);
  });
}
function readJSON(path, cb) {
  if (!path) {
    console.error(`[${pocFile}] json: missing path where to read.`);
    return false;
  }

  console.log(`[${pocFile}] json: reading file [${path}]...`);

  fs.readFile(path, (err, data) => {
    if (err) {
      return cb && cb(err);
    }
    try {
      const obj = JSON.parse(data)
      return cb && cb(null, obj);
      // return cb && cb(null, JSON.parse(obj));
    } catch(err) {
      return cb && cb(err);
    }
  });
}
function writeJSON(data, path) {
  if (!data) {
    console.error(`[${pocFile}] json: missing data to write.`);
    return false;
  }
  if (!path) {
    console.error(`[${pocFile}] json: missing path where to write.`);
    return false;
  }

  fs.writeFile(path, JSON.stringify(data), (err) => {
    if (err) {
      console.error(`[${pocFile}] json: error while writing file [${path}].`);
      // throw err;
    }
    console.log(`[${pocFile}] json: file [${path}] saved.`);
  });
}
async function playStream(streamURL) {
  console.log(`\n[${pocFile}] Playing stream [${streamURL}]...\n`);

  const ffplay = spawn('ffplay', ['-hide_banner', '-i', streamURL]);

  ffplay.stdout.on('data', (data) => {
    console.log(`[ffplay] stdout: ${data}`);
  });

  ffplay.stderr.on('data', (data) => {
    console.error(`[ffplay] stderr: ${data}`);
  });

  ffplay.on('close', (code) => {
    console.log(`[ffplay] process exited with code: ${code}`);
  });
}
async function recordStreamMP4(streamURL, modelName) {
  console.log(`\n[${pocFile}] Recording stream [${streamURL}]...\n`);

  const ffmpeg = spawn('ffmpeg', ['-hide_banner', '-threads', '0', '-y', '-i', streamURL, '-movflags', 'faststart', `${outputDir}/${modelName}.mp4`]);

  // Killing recording process when max time reached
  let recordingTimeout;
  if (maxRecordTime) {
    recordingTimeout = setTimeout(() => {
      console.log(`\n[${pocFile}] Max recording time reached. Killing [ffmpeg]...\n`);
      ffmpeg.kill();
    }, maxRecordTime);
  }
  else {
    console.error(`[${pocFile}] maxRecordTime must be set in this mode.`);
    process.exit(1);
  }

  ffmpeg.stdout.on('data', (data) => {
    console.log(`[ffmpeg] stdout: ${data}`);
  });

  ffmpeg.stderr.on('data', (data) => {
    console.error(`[ffmpeg] stderr: ${data}`);
  });

  ffmpeg.on('error', (err) => {
    console.error(`[ffmpeg] unexpected error: ${err}`);
    ffmpeg.kill();
  });

  ffmpeg.on('close', (code) => {
    console.log(`[ffmpeg] process exited with code: ${code}`);

    // Stop recording timeout
    if (maxRecordTime && recordingTimeout) {
      clearTimeout(recordingTimeout);
    }
  });

  ffmpeg.on('exit', (code) => {
    if (code !== 0) {
      console.log(`[ffmpeg] process stopped with code: ${code}`);
    }
  });
}
async function recordStreamMKV(streamURL, modelName) {
  console.log(`\n[${pocFile}] Recording stream [${streamURL}]...\n`);

  const ffmpeg = spawn('ffmpeg', ['-hide_banner', '-threads', '0', '-y', '-i', streamURL, `${outputDir}/${modelName}.mkv`]);

  // Killing recording process when max time reached
  let recordingTimeout;
  if (maxRecordTime) {
    recordingTimeout = setTimeout(() => {
      console.log(`\n[${pocFile}] Max recording time reached. Killing [ffmpeg]...\n`);
      ffmpeg.kill();
    }, maxRecordTime);
  }
  else {
    console.error(`[${pocFile}] maxRecordTime must be set in this mode.`);
    process.exit(1);
  }

  ffmpeg.stdout.on('data', (data) => {
    console.log(`[ffmpeg] stdout: ${data}`);
  });

  ffmpeg.stderr.on('data', (data) => {
    console.error(`[ffmpeg] stderr: ${data}`);
  });

  ffmpeg.on('error', (err) => {
    console.error(`[ffmpeg] unexpected error: ${err}`);
    ffmpeg.kill();
  });

  ffmpeg.on('close', (code) => {
    console.log(`[ffmpeg] process exited with code: ${code}`);

    // Stop recording timeout
    if (maxRecordTime && recordingTimeout) {
      clearTimeout(recordingTimeout);
    }
  });

  ffmpeg.on('exit', (code) => {
    if (code !== 0) {
      console.log(`[ffmpeg] process stopped with code: ${code}`);
    }
  });
}
async function recordAndPlayStreamMP4(streamURL, modelName) {
  console.log(`\n[${pocFile}] Recording/Replaying stream [${streamURL}]...\n`);

  // ffmpeg -hide_banner -threads 0 -y -i streamURL -map 0:6 -map 0:7 -c:v h264 -c:a aac -movflags faststart -f tee "${modelName}.mp4|[f=nut]pipe:" | ffplay -hide_banner pipe:
  // ffmpeg -hide_banner -threads 0 -y -i streamURL -map 0 -c:v h264 -c:a aac -movflags faststart -f tee "${modelName}.mp4|[f=nut]pipe:" | ffplay -hide_banner pipe:
  // ffmpeg -hide_banner -threads 0 -y -i streamURL -t (maxRecordTime/1000) -map 0 -c:v h264 -c:a aac -movflags faststart -f tee "${modelName}.mp4|[f=nut]pipe:" | ffplay -hide_banner pipe:

  const ffmpeg = spawn('ffmpeg', [
    '-hide_banner',
    '-threads',
    '0',
    '-y',
    '-i',
    streamURL,
    '-map',
    '0',
    '-c:v',
    'h264',
    '-c:a',
    'aac',
    '-movflags',
    'faststart',
    '-f',
    'tee',
    `${outputDir}/${modelName}.mp4|[f=nut]pipe:`
  ]);

  const ffplay = spawn('ffplay', ['-hide_banner', 'pipe:']);

  // Killing recording process when max time reached
  let recordingTimeout;
  if (stopRecordingOnPreviewClose || maxRecordTime) {
    if (maxRecordTime) {
      recordingTimeout = setTimeout(() => {
        console.log(`\n[${pocFile}] Max recording time reached. Killing [ffmpeg]...\n`);
        ffmpeg.kill();
      }, maxRecordTime);
    }
  }
  else {
    console.error(`[${pocFile}] stopRecordingOnPreviewClose or maxRecordTime must be set in this mode.`);
    process.exit(1);
  }

  ffmpeg.stdout.on('data', (data) => {
    ffplay.stdin.write(data);
  });

  ffmpeg.stderr.on('data', (data) => {
    console.error(`[ffmpeg] stderr: ${data}`);
  });

  ffmpeg.on('error', (err) => {
    console.error(`[ffmpeg] unexpected error: ${err}`);
    ffmpeg.kill();
  });

  ffmpeg.on('close', (code) => {
    if (code !== 0) {
      console.log(`[ffmpeg] process exited with code: ${code}`);
    }

    // Stop recording timeout
    if (maxRecordTime && recordingTimeout) {
      clearTimeout(recordingTimeout);
    }

    // Stop receiving data from pipe
    ffplay.stdin.end();

    // Kill replaying process after few seconds
    // It is required to let enough time to receive all piped data
    // And also in the hope to avoid EPIPE errors
    if (!ffplay.killed) {
      setTimeout(() => {
        ffplay.kill();
      }, 6000);
    }
  });

  ffmpeg.on('exit', (code) => {
    if (code !== 0) {
      console.log(`[ffmpeg] process stopped with code: ${code}`);
    }
  });

  ffplay.stdin.on('error', (err) => {
    console.error(`[ffplay] stdin: unexpected error with code: ${err.code}`);
    if (err.code == "EPIPE") {
        // process.exit(1);
        // ffplay.stdin.end();
        ffplay.kill();
    }
  });

  ffplay.stdout.on('data', (data) => {
    console.log(`[ffplay] stdout: ${data}`);
  });

  ffplay.stderr.on('data', (data) => {
    console.error(`[ffplay] stderr: ${data}`);
  });

  ffplay.on('error', (err) => {
    console.error(`[ffplay] unexpected error: ${err}`);
    ffplay.kill();
  });

  ffplay.on('close', (code) => {
    if (code !== 0) {
      console.log(`[ffplay] process exited with code: ${code}`);
    }
    if (stopRecordingOnPreviewClose === true) {
      ffplay.stdin.end();
      ffmpeg.kill();
    }
  });

  ffplay.on('exit', (code) => {
    if (code !== 0) {
      console.log(`[ffplay] process stopped with code: ${code}`);
    }
  });
}
async function recordAndPlayStreamMKV(streamURL, modelName) {
  console.log(`\n[${pocFile}] Recording/Replaying stream [${streamURL}]...\n`);

  // ffmpeg -hide_banner -threads 0 -y -i streamURL -map 0:6 -map 0:7 -c:v h264 -c:a aac -f tee "${modelName}.mkv|[f=nut]pipe:" | ffplay -hide_banner pipe:
  // ffmpeg -hide_banner -threads 0 -y -i streamURL -map 0 -c:v h264 -c:a aac -f tee "${modelName}.mkv|[f=nut]pipe:" | ffplay -hide_banner pipe:
  // ffmpeg -hide_banner -threads 0 -y -i streamURL -t (maxRecordTime/1000) -map 0 -c:v h264 -c:a aac -f tee "${modelName}.mkv|[f=nut]pipe:" | ffplay -hide_banner pipe:

  const ffmpeg = spawn('ffmpeg', [
    '-hide_banner',
    '-threads',
    '0',
    '-y',
    '-i',
    streamURL,
    '-map',
    '0',
    '-c:v',
    'h264',
    '-c:a',
    'aac',
    '-f',
    'tee',
    `${outputDir}/${modelName}.mkv|[f=nut]pipe:`
  ]);

  const ffplay = spawn('ffplay', ['-hide_banner', 'pipe:']);

  // Killing recording process when max time reached
  let recordingTimeout;
  if (stopRecordingOnPreviewClose || maxRecordTime) {
    if (maxRecordTime) {
      recordingTimeout = setTimeout(() => {
        console.log(`\n[${pocFile}] Max recording time reached. Killing [ffmpeg]...\n`);
        ffmpeg.kill();
      }, maxRecordTime);
    }
  }
  else {
    console.error(`[${pocFile}] stopRecordingOnPreviewClose or maxRecordTime must be set in this mode.`);
    process.exit(1);
  }

  ffmpeg.stdout.on('data', (data) => {
    ffplay.stdin.write(data);
  });

  ffmpeg.stderr.on('data', (data) => {
    console.error(`[ffmpeg] stderr: ${data}`);
  });

  ffmpeg.on('error', (err) => {
    console.error(`[ffmpeg] unexpected error: ${err}`);
    ffmpeg.kill();
  });

  ffmpeg.on('close', (code) => {
    if (code !== 0) {
      console.log(`[ffmpeg] process exited with code: ${code}`);
    }

    // Stop recording timeout
    if (maxRecordTime && recordingTimeout) {
      clearTimeout(recordingTimeout);
    }

    // Stop receiving data from pipe
    ffplay.stdin.end();

    // Kill replaying process after few seconds
    // It is required to let enough time to receive all piped data
    // And also in the hope to avoid EPIPE errors
    if (!ffplay.killed) {
      setTimeout(() => {
        ffplay.kill();
      }, 6000);
    }
  });

  ffmpeg.on('exit', (code) => {
    if (code !== 0) {
      console.log(`[ffmpeg] process stopped with code: ${code}`);
    }
  });

  ffplay.stdin.on('error', (err) => {
    console.error(`[ffplay] stdin: unexpected error with code: ${err.code}`);
    if (err.code == "EPIPE") {
        // process.exit(1);
        // ffplay.stdin.end();
        ffplay.kill();
    }
  });

  ffplay.stdout.on('data', (data) => {
    console.log(`[ffplay] stdout: ${data}`);
  });

  ffplay.stderr.on('data', (data) => {
    console.error(`[ffplay] stderr: ${data}`);
  });

  ffplay.on('error', (err) => {
    console.error(`[ffplay] unexpected error: ${err}`);
    ffplay.kill();
  });

  ffplay.on('close', (code) => {
    if (code !== 0) {
      console.log(`[ffplay] process exited with code: ${code}`);
    }
    if (stopRecordingOnPreviewClose === true) {
      ffplay.stdin.end();
      ffmpeg.kill();
    }
  });

  ffplay.on('exit', (code) => {
    if (code !== 0) {
      console.log(`[ffplay] process stopped with code: ${code}`);
    }
  });
}
async function doScreenshot(page, modelName) {
  // Wait for agreement overlay to appear and click on the 'accept' button
  const agreementSelector = '.btn-visitors-agreement-accept';
  await page.waitForSelector(agreementSelector);
  await page.click(agreementSelector);

  // Screenshot the page
  await page.screenshot({ path: `${outputDir}/${modelName}.1920x1080.png`, fullPage: false });

  // Wait for agreement video element to appear
  const videoSelector = '.video-element';
  await page.waitForSelector(videoSelector);
  const videoElement = await page.$(videoSelector);

  // Screenshot the cam
  await videoElement.screenshot({ path: `${outputDir}/${modelName}.cam.png` });

  // Release element from memory
  await videoElement.dispose();
}

// Trying to handle EPIPE error
process.on('uncaughtException', (err, origin) => {
  fs.writeSync(
    process.stderr.fd,
    `Caught exception: ${err}\n` +
    `Exception origin: ${origin}`
  );
  // console.warn(`[${pocFile}] Caught exception: ${err}\nException origin: ${origin}`);
  process.exit(1);
});

// Process end status
process.on('beforeExit', (code) => {
  console.log(`[${pocFile}] process received 'beforeExit' event with code: ${code}`);
});
process.on('exit', (code) => {
  console.log(`[${pocFile}] process received 'exit' event with code: ${code}`);
});

// Dump engine
(async () => {
  // Fake start status
  console.log(`[${pocFile}] Started.`);

  // Create required output folder
  createDataFolder(outputDir);

  // Init browser instance
  let browser = null;

  try {
    // Create browser instance
    browser = await getBrowser();

    // Parse given URL
    const parsedURL = new URL(dumpURL);
    const parsedModelName = parsedURL.pathname.split('/')[1];

    // Create initial target
    const page = await browser.newPage();

    // Log and/or dump page requests
    // page.on('request', logRequest);
    page.on('request', dumpRequest);

    // Show page loading and dump results
    page.once('load', () => {
      console.log('==> Page loaded!');
      console.log(`==> Model Name: ${parsedModelName}`);
      console.log(`==> Dumped URLs: ${dumpedURLs.length}`);
      console.log(` - ${dumpedURLs.join('\n - ')}`);
      // console.log(`==> Last URL: ${dumpedURLs[(dumpedURLs.length-1)]}`);
      console.log(`==> Processed URLs:`);
      console.log(` - Stream URL: ${dumpStreamURL()}`);
      console.log(` - Stream Settings URL: ${dumpStreamSettingsURL(parsedModelName)}`);
      console.log(` - Model Intro URL: ${dumpModelIntroURL()}`);
      console.log(` - Model Infos URL: ${dumpModelInfoURL()}`);
      console.log(` - Site Config URL: ${dumpSiteConfigURL()}`);
      console.log(` - Site Settings URL: ${dumpSiteSettingsURL()}`);
      console.log(` - Site Models URL: ${dumpSiteModelsURL()}`);
      console.log(` - Online Models URL: ${dumpOnlineModelsURL()}`);
    });

    // Browser loading status
    browser.once('targetcreated', () => console.log(`[${pocFile}] Launching browser instance [${useRemoteInstance === true ? 'remote' : 'local'}]...`));
    browser.once('disconnected', () => console.log(`\n[${pocFile}] Closed browser instance [${useRemoteInstance === true ? 'remote' : 'local'}].`));

    // Set viewport size to fullhd
    await page.setViewport({
      width: 1920,
      height: 1080,
      deviceScaleFactor: 1,
    });

    // Define URL to dump
    await page.goto(dumpURL);

    // Store dumped stream URL
    const streamURL = dumpStreamURL();

    // Check if we got a stream URL
    if (typeof streamURL === 'undefined') {
      console.error(`[${pocFile}] Could not find any stream URL to process. Exiting.`);
      process.exit(1);
    }

    // Make screenshots
    await doScreenshot(page, parsedModelName);

    // Stop logging requests
    page.off('request', logRequest);

    // Fetch model cam from JSON
    // await fetchJSON('https://stripchat.com/api/front/v2/models/username/AmyValdiry/cam', 'modelIntro');

    // Fetch model intro from JSON
    // await fetchJSON('https://stripchat.com/api/front/users/40374803/intros', 'modelIntro');

    // Fetch model data from JSON
    // await fetchJSON('https://stripchat.com/api/front/users/40374803', 'modelData');

    // Fetch model apps from JSON
    // await fetchJSON('https://stripchat.com/api/front/models/40374803/apps', 'modelApps');

    // Fetch site config from JSON
    // await fetchJSON('https://stripchat.com/api/front/v2/config', 'siteConfig');

    // Fetch site settings from JSON
    // await fetchJSON('https://stripchat.com/api/front/users/availableSettings', 'siteSettings');

    // Fetch all displayed models on site from JSON
    // await fetchJSON('https://stripchat.com/api/front/v2/models', 'siteModels');

    // Fetch all connected models from JSON
    // await fetchJSON('https://stripchat.com/api/front/models?limit=10000&offset=0', 'onlineModels');

    // Dump stream settings from JSON
    // This stream is the only one found that has some protection like user-agent checks
    // TODO: bypass checks to make results similar to those gathered from real browser
    await dumpJSON(dumpStreamSettingsURL(), `${outputDir}/${parsedModelName}.cam.json`);

    // Dump model intro from JSON
    await dumpJSON(dumpModelIntroURL(), `${outputDir}/${parsedModelName}.intro.json`);

    // Dump model info from JSON
    await dumpJSON(dumpModelInfoURL(), `${outputDir}/${parsedModelName}.json`);

    // Dump site config from JSON
    await dumpJSON(dumpSiteConfigURL(), `${outputDir}/site-config.json`);

    // Dump site settings from JSON
    await dumpJSON(dumpSiteSettingsURL(), `${outputDir}/site-settings.json`);

    // Dump all displayed models on site from JSON
    await dumpJSON(dumpSiteModelsURL(), `${outputDir}/site-models.json`);

    // Dump all connected models to JSON
    await dumpJSON(dumpOnlineModelsURL(), `${outputDir}/online-models.json`);

    // Show dumped data from file
    /* readJSON(`${outputDir}/online-models.json`, (err, onlineModels) => {
      if (err) {
        console.error(err);
        return;
      }
      // console.log(`[${pocFile}] dumped online models:\n${onlineModels}`);
      console.log(`[${pocFile}] dumped online models count: ${onlineModels.totalCount}`);
    }); */

    // Play dumped stream
    await playStream(streamURL);

    // Record dumped stream
    // await recordStreamMP4(streamURL, parsedModelName);

    // Record and play dumped stream
    // await recordAndPlayStreamMP4(streamURL, parsedModelName);
  } catch (error) {
    console.error('[browser]', error.message);
  } finally {
    // Close browser instance
    if (browser) {
      browser.close();
    }
  }
})();
