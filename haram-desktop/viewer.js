(function () {
  const params = new URLSearchParams(location.search);
  const src = params.get('src') || '';
  const lower = src.toLowerCase();

  const vid = document.getElementById('vid');
  const img = document.getElementById('img');

  const isVideo = /\.(mp4|webm|ogg|mov|m4v)$/i.test(lower) || src.startsWith('blob:') || src.includes('mime=video');

  if (isVideo) {
    img.style.display = 'none';
    vid.style.display = '';
    vid.src = src;
    vid.addEventListener('loadedmetadata', () => {
      // keep controls visible and sized; object-fit:contain fills the area
    });
  } else {
    vid.style.display = 'none';
    img.style.display = '';
    img.src = src;
  }

  // convenience: space toggles play/pause
  addEventListener('keydown', (e) => {
    if (e.code === 'Space' && isVideo) {
      e.preventDefault();
      vid.paused ? vid.play() : vid.pause();
    }
  });
})();
