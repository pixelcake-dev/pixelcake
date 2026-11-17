// From timed frames to a GIF (two passes: palette, then the picture), an MP4
// and a PNG poster, with ffmpeg.
import { spawnSync } from 'node:child_process';
import { copyFileSync, statSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';

function ffmpeg(args, label) {
  const result = spawnSync('ffmpeg', ['-hide_banner', '-loglevel', 'error', '-y', ...args], { encoding: 'utf-8' });
  if (result.error) throw new Error('ffmpeg could not run (is it on the PATH?): ' + result.error.message);
  if (result.status !== 0) throw new Error(`ffmpeg failed (${label}): ${result.stderr}`);
}

/**
 * The time of the video for a moment of the real clock: stretches played at
 * `factor` times the speed count 1/factor as long.
 */
function videoClock(speeds, startAt) {
  const marks = speeds.map((s) => ({ at: Math.max(s.at, startAt), factor: s.factor })).sort((a, b) => a.at - b.at);
  return (wall) => {
    let out = 0;
    let from = startAt;
    let factor = 1;
    for (const mark of marks) {
      if (mark.at <= startAt) {
        factor = mark.factor;
        continue;
      }
      if (mark.at >= wall) break;
      out += (mark.at - from) / factor;
      from = mark.at;
      factor = mark.factor;
    }
    return out + (wall - from) / factor;
  };
}

/**
 * Frames: [{ file, at }] where `at` is on the clock of the browser. `wallOf`
 * turns that into the clock of Node (where the steps timed their speed
 * changes); `startWall` and `endWall` are when the recording began and ended.
 */
export function timeline({ frames, wallOf, speeds, startWall, endWall }) {
  if (frames.length === 0) throw new Error('no frames were recorded');
  const clockMs = videoClock(speeds, startWall);
  const clock = (wall) => clockMs(wall) / 1000;
  // the first frame stands from the start of the recording
  const starts = frames.map((f, i) => (i === 0 ? 0 : clock(Math.max(startWall, wallOf(f)))));
  const end = clock(endWall);
  return frames.map((f, i) => ({ file: f.file, start: starts[i], duration: Math.max(0.001, (i + 1 < frames.length ? starts[i + 1] : end) - starts[i]), wall: wallOf(f) }));
}

/** The frame on screen at a moment of the real clock (the poster) */
export function frameAt(timed, wall) {
  let chosen = timed[0];
  for (const f of timed) if (f.wall <= wall) chosen = f;
  return chosen;
}

/**
 * @param {object} o
 * @param {Array} o.timed       from timeline()
 * @param {string} o.workDir    where the intermediate files go
 * @param {string} o.outBase    path without extension, e.g. /x/demo.en
 * @param {string[]} o.formats  any of gif, mp4, png
 * @param {number} o.fps        frames per second of the GIF
 * @param {number} [o.gifWidth] width of the GIF (default: the width of the frames)
 * @param {string} [o.dither]   paletteuse dither (default sierra2_4a; try bayer, none)
 * @param {number} [o.posterWall] real-clock moment of the poster; default the last frame
 * @param {number} [o.tailHold] seconds to add to the end of the last frame (the pause before the loop)
 */
export function encode({ timed, workDir, outBase, formats, fps, gifWidth, dither = 'sierra2_4a', posterWall, tailHold = 0 }) {
  const list = join(workDir, 'frames.txt');
  const lines = [];
  timed.forEach((f, i) => {
    const d = f.duration + (i === timed.length - 1 ? tailHold : 0);
    lines.push(`file '${f.file.replace(/\\/g, '/')}'`, `duration ${d.toFixed(4)}`);
  });
  // (the demuxer ignores the duration of the last entry unless it is named twice)
  lines.push(`file '${timed[timed.length - 1].file.replace(/\\/g, '/')}'`);
  writeFileSync(list, lines.join('\n') + '\n');
  const duration = timed.reduce((sum, f) => sum + f.duration, 0) + tailHold;
  const made = { duration };

  if (formats.includes('gif')) {
    const palette = join(workDir, 'palette.png');
    const base = [`fps=${fps}`, ...(gifWidth ? [`scale=${gifWidth}:-1:flags=lanczos`] : [])].join(',');
    ffmpeg(['-f', 'concat', '-safe', '0', '-i', list, '-vf', `${base},palettegen=stats_mode=diff:max_colors=256`, palette], 'palette');
    const file = outBase + '.gif';
    ffmpeg(
      ['-f', 'concat', '-safe', '0', '-i', list, '-i', palette, '-lavfi', `[0:v]${base}[x];[x][1:v]paletteuse=dither=${dither}:diff_mode=rectangle`, '-loop', '0', file],
      'gif'
    );
    made.gif = { file, bytes: statSync(file).size };
  }
  if (formats.includes('mp4')) {
    const file = outBase + '.mp4';
    ffmpeg(
      ['-f', 'concat', '-safe', '0', '-i', list, '-vf', 'fps=30,scale=trunc(iw/2)*2:trunc(ih/2)*2', '-c:v', 'libx264', '-preset', 'slow', '-crf', '17', '-pix_fmt', 'yuv420p', '-movflags', '+faststart', file],
      'mp4'
    );
    made.mp4 = { file, bytes: statSync(file).size };
  }
  if (formats.includes('png')) {
    const file = outBase + '.png';
    const frame = posterWall ? frameAt(timed, posterWall) : timed[timed.length - 1];
    copyFileSync(frame.file, file);
    made.png = { file, bytes: statSync(file).size };
  }
  return made;
}
