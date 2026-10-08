/**
 * Generates an in-memory sample video/animation for instant testing
 */
export function createDemoVideoFile(): Promise<File> {
  const canvas = document.createElement('canvas');
  canvas.width = 400;
  canvas.height = 400;
  const ctx = canvas.getContext('2d')!;

  // We can record a 2.5 second animation using MediaRecorder
  const stream = canvas.captureStream(30);
  const mediaRecorder = new MediaRecorder(stream, { mimeType: 'video/webm' });
  const chunks: Blob[] = [];

  mediaRecorder.ondataavailable = (e) => {
    if (e.data.size > 0) chunks.push(e.data);
  };

  return new Promise<File>((resolve) => {
    mediaRecorder.onstop = () => {
      const blob = new Blob(chunks, { type: 'video/webm' });
      resolve(new File([blob], 'telegram-star-demo.webm', { type: 'video/webm' }));
    };

    mediaRecorder.start();

    let frame = 0;
    const totalFrames = 75; // 2.5s at 30fps

    const drawFrame = () => {
      if (frame >= totalFrames) {
        mediaRecorder.stop();
        return;
      }

      ctx.clearRect(0, 0, 400, 400);

      // Cute animated Telegram star / rocket mascot
      const progress = frame / totalFrames;
      const angle = progress * Math.PI * 2;
      const bounce = Math.sin(angle * 2) * 20;

      // Glow circle
      const grad = ctx.createRadialGradient(200, 200 + bounce, 10, 200, 200 + bounce, 120);
      grad.addColorStop(0, 'rgba(56, 189, 248, 0.4)');
      grad.addColorStop(1, 'rgba(56, 189, 248, 0)');
      ctx.fillStyle = grad;
      ctx.beginPath();
      ctx.arc(200, 200 + bounce, 120, 0, Math.PI * 2);
      ctx.fill();

      // Telegram Paper Plane / Star symbol
      ctx.save();
      ctx.translate(200, 200 + bounce);
      ctx.rotate(Math.sin(angle) * 0.15);

      // Main star body
      ctx.fillStyle = '#0ea5e9';
      ctx.beginPath();
      const points = 5;
      const outerRadius = 80;
      const innerRadius = 40;
      for (let i = 0; i < points * 2; i++) {
        const r = i % 2 === 0 ? outerRadius : innerRadius;
        const a = (i * Math.PI) / points - Math.PI / 2;
        const x = Math.cos(a) * r;
        const y = Math.sin(a) * r;
        if (i === 0) ctx.moveTo(x, y);
        else ctx.lineTo(x, y);
      }
      ctx.closePath();
      ctx.fill();

      // Star cute face
      ctx.fillStyle = '#ffffff';
      // Left eye
      ctx.beginPath();
      ctx.arc(-22, -10, 8, 0, Math.PI * 2);
      ctx.fill();
      // Right eye
      ctx.beginPath();
      ctx.arc(22, -10, 8, 0, Math.PI * 2);
      ctx.fill();

      // Pupils
      ctx.fillStyle = '#0f172a';
      ctx.beginPath();
      ctx.arc(-20, -10, 4, 0, Math.PI * 2);
      ctx.arc(24, -10, 4, 0, Math.PI * 2);
      ctx.fill();

      // Smile
      ctx.strokeStyle = '#ffffff';
      ctx.lineWidth = 4;
      ctx.lineCap = 'round';
      ctx.beginPath();
      ctx.arc(0, 5, 14, 0.2, Math.PI - 0.2);
      ctx.stroke();

      ctx.restore();

      frame++;
      requestAnimationFrame(drawFrame);
    };

    drawFrame();
  });
}
