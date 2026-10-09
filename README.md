# 🚀 Telegram Video Sticker Studio

[![Deploy to GitHub Pages](https://github.com/umarfarid97/VideoStickerTelegram/actions/workflows/deploy.yml/badge.svg)](https://github.com/umarfarid97/VideoStickerTelegram/actions/workflows/deploy.yml)
[![Live Demo](https://img.shields.io/badge/Live%20Demo-GitHub%20Pages-2ea44f?style=flat&logo=github)](https://umarfarid97.github.io/VideoStickerTelegram/)
[![Telegram](https://img.shields.io/badge/Telegram-@Stickers%20Compliant-229ED9?style=flat&logo=telegram)](https://core.telegram.org/stickers#video-stickers-requirements)
[![License: MIT](https://img.shields.io/badge/License-MIT-blue.svg)](LICENSE)

A modern, high-performance web application to transform any **Video (MP4, WebM, MOV)** or **GIF** into official **Telegram Animated Video Stickers (`.webm`)** directly in your browser.

🌐 **Live Web App**: [https://umarfarid97.github.io/VideoStickerTelegram/](https://umarfarid97.github.io/VideoStickerTelegram/)

---

## ✨ Features

- **⚡ 100% Client-Side Processing (Zero Server Uploads)**:
  - Powered by the browser's native **WebCodecs API** and `webm-muxer`.
  - Your videos and GIFs never leave your device. Processing happens locally in memory with hardware acceleration for maximum privacy and blazing speed.

- **📐 3 Flexible Framing & Sizing Modes**:
  - **Keep Original Full**: Preserves original video proportions scaled to Telegram's 512px rule (e.g. $512 \times 288\text{ px}$).
  - **Telegram Sizing 512×512 (Can Select Framing)**: Locks framing into an exact 1:1 square crop box. Guarantees a full $512 \times 512\text{ px}$ sticker with no black bars or empty margins.
  - **Free Reframing (Can Select Framing)**: Free-form custom crop rectangle to focus closely on your subject.

- **✂️ Interactive Timeline Trimmer**:
  - Real-time scrubbing and dual range sliders.
  - Clamped to Telegram's strict **$\le 3.0\text{ seconds}$** limit.
  - Optional **Speed Up to Fit** toggle to automatically compress longer clips into a compliant 3.0s loop.

- **💬 Real-Time Telegram Chat Preview**:
  - Live mockup simulating how your sticker renders inside an actual Telegram chat.
  - Displays instant duration and dimension readouts.
  - Seamless toggle between source selection and processed `.webm` result with auto-playback and play/pause controls.

- **🛡️ Strict Specification Enforcement**:
  - Dynamically calculates bitrates to ensure the file size stays under Telegram's **$256\text{ KB}$** cap.
  - Enforces even dimensions required by VP9 encoders.
  - Automatically strips audio tracks as required by Telegram.

- **📱 Touch & Mobile Friendly**:
  - Responsive layout prioritizing preview and trimming controls on mobile devices.
  - Framing box drag handles optimized with non-scrolling touch gestures (`touch-none`) and expanded finger-tap targets.

---

## 📋 Telegram Video Sticker Specifications

This web application strictly adheres to the official [Telegram Video Stickers Technical Requirements](https://core.telegram.org/stickers#video-stickers-requirements):

| Specification | Telegram Rule | How This App Enforces It |
| :--- | :--- | :--- |
| **Container Format** | `.webm` | Generated with `webm-muxer` |
| **Video Codec** | VP9 | Encoded via hardware-accelerated WebCodecs `vp09` |
| **Audio Track** | **None** (must be muted) | Audio tracks are completely stripped |
| **Max Dimensions** | One side 512px, other side $\le 512$px | Auto-scaled with even numbers ($W, H \pmod 2 = 0$) |
| **Max Duration** | Up to **3.0 seconds** | Timeline slider strictly limited to $\le 3.00\text{s}$ |
| **Max File Size** | Up to **256 KB** | Dynamic bitrate calculation + ECO recompression |
| **Framerate** | Up to **30 FPS** | User selectable: 30 FPS, 24 FPS, or 15 FPS |
| **Looping** | Must loop seamlessly | Rendered with seamless loop markers |

---

## ❓ Frequently Asked Questions & Safety

### ⚠️ Will using or hosting this web application cause me to get banned?

**No, absolutely not.** Here is why you are completely safe:

1. **Telegram Official Feature**: Telegram officially designed, released, and actively promotes video stickers. Their developer documentation explicitly encourages users and third-party tools to generate compliant VP9 WebM stickers to use with their official bot, [@Stickers](https://t.me/Stickers).
2. **No Telegram API Abuse**: This application does not connect to or automate your Telegram account. It is simply a local file converter. You download the final `.webm` file and send it manually to `@Stickers` just like any regular sticker pack author.
3. **100% Client-Side Privacy**: Because the processing runs entirely in your local browser through JavaScript and WebCodecs, no media files are stored on any backend server.
4. **Hosting Safety (GitHub Pages)**: The code is open-source and complies with GitHub Pages Acceptable Use Policies. There are no backend scraping bots, no cryptomining, and no copyrighted media distribution.

> **Note on General Content Policy**: Like any Telegram upload, make sure the videos or GIFs you personally choose to upload do not violate Telegram's general Terms of Service (e.g. copyright infringement or harmful material). The converter itself is 100% compliant.

---

## 🚀 How to Add Your Sticker to Telegram

Once you download your converted `.webm` file from the app, follow these simple steps:

1. Open Telegram and start a chat with [@Stickers](https://t.me/Stickers).
2. Send the command:
   ```text
   /newvideo
   ```
3. Type a title for your sticker pack.
4. Send your converted `.webm` sticker as an **uncompressed Document** (📎 *Attach File* $\to$ *File*, not as a compressed video).
5. Reply with one or more emojis that represent your sticker (e.g. 😂 or 🔥).
6. Send `/publish` and choose a short URL name for your sticker pack.
7. Tap the link to install your new sticker pack in Telegram!

---

## 🛠️ Technology Stack

- **Framework**: [React 19](https://react.dev/) + [TypeScript](https://www.typescriptlang.org/)
- **Build Tool**: [Vite 8](https://vite.dev/)
- **Styling**: [Tailwind CSS v4](https://tailwindcss.com/)
- **Video Encoding**: [WebCodecs API](https://developer.mozilla.org/en-US/docs/Web/API/WebCodecs_API) (`VideoEncoder`)
- **Muxing**: [`webm-muxer`](https://github.com/Vanilagy/webm-muxer)
- **GIF Parsing**: [`gifuct-js`](https://github.com/matt-way/gifuct-js)
- **Icons**: [Lucide React](https://lucide.dev/)
- **Deployment**: [GitHub Actions](https://github.com/features/actions) $\to$ [GitHub Pages](https://pages.github.com/)

---

## 💻 Local Development

To run the application locally on your machine:

1. **Clone the repository**:
   ```bash
   git clone https://github.com/umarfarid97/VideoStickerTelegram.git
   cd VideoStickerTelegram
   ```

2. **Install dependencies**:
   ```bash
   npm install
   ```

3. **Start the local dev server**:
   ```bash
   npm run dev
   ```
   Open `http://localhost:5173` in a Chromium-based browser (Google Chrome, Microsoft Edge, Brave) to use the WebCodecs API.

4. **Build for production**:
   ```bash
   npm run build
   ```

---

## 📄 License

This project is licensed under the [MIT License](LICENSE).
