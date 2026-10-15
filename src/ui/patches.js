// Render WAD patches (status bar faces, keys, title screens) to data URLs for the DOM UI.

import { decodePicture, TRANSPARENT } from '../wad/graphics.js';

export function pictureToCanvas(picture, palette) {
  const canvas = document.createElement('canvas');
  canvas.width = picture.width;
  canvas.height = picture.height;
  const ctx = canvas.getContext('2d');
  const img = ctx.createImageData(picture.width, picture.height);
  for (let i = 0; i < picture.pixels.length; i++) {
    const c = picture.pixels[i];
    if (c === TRANSPARENT) continue;
    const [r, g, b] = palette[c];
    img.data.set([r, g, b, 255], i * 4);
  }
  ctx.putImageData(img, 0, 0);
  return canvas;
}

export function createPatchCache(wad, palette) {
  const urls = new Map();
  return {
    url(name) {
      if (urls.has(name)) return urls.get(name);
      const pic = decodePicture(wad.bytes(name));
      const url = pic ? pictureToCanvas(pic, palette).toDataURL() : null;
      urls.set(name, url);
      return url;
    },
    // Full-screen 320x200 raw or patch pictures (TITLEPIC, CREDIT, HELP1...).
    picture(name) {
      const pic = decodePicture(wad.bytes(name));
      return pic ? pictureToCanvas(pic, palette) : null;
    },
  };
}
