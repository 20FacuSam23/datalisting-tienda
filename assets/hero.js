(() => {
  const canvas = document.getElementById('heroCanvas');
  if (canvas) {
    const ctx = canvas.getContext('2d');
    let w = 0, h = 0, dpr = Math.min(window.devicePixelRatio || 1, 2);
    let points = [];
    function resize() {
      const rect = canvas.getBoundingClientRect();
      w = rect.width; h = rect.height;
      canvas.width = Math.max(1, Math.floor(w * dpr));
      canvas.height = Math.max(1, Math.floor(h * dpr));
      ctx.setTransform(dpr,0,0,dpr,0,0);
      points = Array.from({length: Math.max(18, Math.floor(w / 28))}, () => ({
        x: Math.random()*w, y: Math.random()*h,
        vx:(Math.random()-.5)*.22, vy:(Math.random()-.5)*.22,
        r:Math.random()*1.7+.7
      }));
    }
    function frame() {
      ctx.clearRect(0,0,w,h);
      for (const p of points) {
        p.x += p.vx; p.y += p.vy;
        if (p.x<0 || p.x>w) p.vx*=-1;
        if (p.y<0 || p.y>h) p.vy*=-1;
      }
      for (let i=0;i<points.length;i++) for (let j=i+1;j<points.length;j++) {
        const a=points[i], b=points[j], dx=a.x-b.x, dy=a.y-b.y, dist=Math.hypot(dx,dy);
        if (dist<120) {
          ctx.strokeStyle=`rgba(115,185,255,${(1-dist/120)*.22})`;
          ctx.lineWidth=.7; ctx.beginPath(); ctx.moveTo(a.x,a.y); ctx.lineTo(b.x,b.y); ctx.stroke();
        }
      }
      for (const p of points) {
        ctx.fillStyle='rgba(140,230,208,.75)';
        ctx.beginPath(); ctx.arc(p.x,p.y,p.r,0,Math.PI*2); ctx.fill();
      }
      requestAnimationFrame(frame);
    }
    resize(); window.addEventListener('resize', resize); frame();
  }
  const observer = new IntersectionObserver((entries) => {
    entries.forEach(e => { if (e.isIntersecting) e.target.classList.add('visible'); });
  }, {threshold:.12});
  document.querySelectorAll('.reveal').forEach(el => observer.observe(el));
})();