# stream-capture-poc

Stream capture PoC to prove the lack of security in biggest adult streaming platforms.

## Origins

One day, I've discovered the adult streaming platform called __Stripchat__ and decided to look at what I could find in the web console and found several weakness in their API and streaming implementations.

I've made an initial report and contacted them. After a long and very useless discussion and later complete silence, it seems clear to me they didn't considered the high risks for people using their platform(s) while thinking their private information and identity can't be stolen.

So my discoveries were not serious enough I guess for them to understand the problem so gave up for some time until finally deciding to get back on it create something that would prove my discoveries.

Here comes this `PoC` that later gave birth to a bigger project called [porn-dump-cli](https://github.com/DgSe95/porn-dump-cli).

This `PoC` will still be used to implement new features in [porn-dump-cli](https://github.com/DgSe95/porn-dump-cli) so you can keep an eye on it as normally new methods might appears from time to time.

## Install

Simply run the following commands:

```
git clone https://github.com/DgSe95/stream-capture-poc.git
cd stream-capture-poc
npm install
```

You might also need to install `ffmpeg`:

```bash
# CentOS / RedHat / Rocky Linux
sudo yum install ffmpeg

# Ubuntu based distribs
sudo apt install ffmpeg
```

## Config

Open the `dump.js` file and change the settings according to your needs/goals:

```js
// Settings
const dumpURL = 'https://stripchat.com/[username]';
const maxRecordTime = false;
// const maxRecordTime = 60000;
// const maxRecordTime = (60000*10);
const useRemoteInstance = true;
const stopRecordingOnPreviewClose = true;
```

> Replace `[username]` by the user/model you want to dump the stream.
>
> __*This `PoC` only support [stripchat.com](https://stripchat.com) for the moment and other white label website based on it (e.g. [xHamsterLive](https://xhamsterlive.com) and [MyCamTV](https://mycamtv.com)).*__

By default, if you enable the `recordAndPlayStreamMP4` or `recordAndPlayStreamMKV` methods, it will stop recording when the `ffplay` preview will be closed but you can change this behavior by changing the following settings:

```js
const maxRecordTime = (60000*10); // Will record during 10 minutes
const stopRecordingOnPreviewClose = false; // When set to false, it will keep recording until the defined duration is reached
```

## Features

What this `PoC` can do:

* Make screenshots of the user/model page ([source](dump.js#L718)):

  ```js
  // Make screenshots
  await doScreenshot(page, parsedModelName);
  ```

* Dump several details from the discovered API ([source](dump.js#L750)):

  ```js
  // Dump stream settings from JSON
  // This stream is the only one found that has some protection like user-agent checks
  // TODO: bypass checks to make results similar to those gathered from real browser
  await dumpJSON(dumpStreamSettingsURL(), `samples/${parsedModelName}.cam.json`);

  // Dump model intro from JSON
  await dumpJSON(dumpModelIntroURL(), `samples/${parsedModelName}.intro.json`);

  // Dump model info from JSON
  await dumpJSON(dumpModelInfoURL(), `samples/${parsedModelName}.json`);

  // Dump site config from JSON
  await dumpJSON(dumpSiteConfigURL(), 'samples/site-config.json');

  // Dump site settings from JSON
  await dumpJSON(dumpSiteSettingsURL(), 'samples/site-settings.json');

  // Dump all displayed models on site from JSON
  await dumpJSON(dumpSiteModelsURL(), 'samples/site-models.json');

  // Dump all connected models to JSON
  await dumpJSON(dumpOnlineModelsURL(), 'samples/online-models.json');
  ```

* Replay the user/model stream only ([source](dump.js#L781)):

  ```js
  // Play dumped stream
  await playStream(streamURL);
  ```

* Record the user/model stream only ([source](dump.js#L784)):

  ```js
  // Record dumped stream
  await recordStreamMP4(streamURL, parsedModelName);
  ```

* Record and replay the user/model stream ([source](dump.js#L787)):

  ```js
  // Record and play dumped stream
  await recordAndPlayStreamMP4(streamURL, parsedModelName);
  ```

All the `*MP4` methods can be replaced by `MKV` to generate video files in `*.mkv` format instead of `*.mp4`. (_it might be changed in the future for more convenient methods that can take format as argument_)

> __Note:__ As there is no control structure or arguments management in this `PoC`, you have comment and/or uncomment the feature you want to use.

## Usage

Once you have updated the code of `dump.js` according to your needs, you can run it that way:

```bash
# Create the 'samples' folder
# It will be used to store dumped content
mkdir -v samples

# Run the PoC
node dump.js
```

## Disclaimer

This project has been made in the hope that biggest adult streaming platforms will make sure to really protect the identity and then privacy of their users and models.

I consider to not be responsible about your usage of this project at the moment the code don't break anything in the target websites and only use their lack of security in their API and streaming platform implementation.

Any script kiddies with some browsers and web console knowledge and at least a software like `vlc` or `ffmpeg` is litterally able to dump everything themselves without using this project.

Thus, this project is just a way to make things easier and less repetitive but there is no _real magic_ behind.

## Credits

Author: [@DgSe95](https://twitter.com/DgSe95)
