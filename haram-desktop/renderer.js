const view = document.getElementById('view');
const urlBox = document.getElementById('url');
const back = document.getElementById('back');
const fwd = document.getElementById('fwd');
const reloadBtn = document.getElementById('reload');
const hbToggle = document.getElementById('hbToggle');
const devBtn = document.getElementById('devtools');


const openBtn = document.getElementById('open');

openBtn.onclick = async () => {
  const fileUrl = await window.hb.pickMedia();
  if (!fileUrl) return;

  const viewerPage = new URL('viewer.html', window.location.href).toString();
  const finalUrl = `${viewerPage}?src=${encodeURIComponent(fileUrl)}`;

  view.loadURL(finalUrl);
  urlBox.value = finalUrl;
};


// init toggle state
(async () => {
  const { on } = await window.hb.get();
  hbToggle.checked = on;
})();

urlBox.addEventListener('keydown', (e) => {
  if (e.key === 'Enter') {
    let u = urlBox.value.trim();
    if (!/^https?:\/\//i.test(u)) u = 'https://' + u;
    view.loadURL(u);
  }
});

back.onclick = () => view.canGoBack() && view.goBack();
fwd.onclick = () => view.canGoForward() && view.goForward();
reloadBtn.onclick = () => view.reload();
devBtn.onclick = () => view.openDevTools();

view.addEventListener('did-navigate', () => (urlBox.value = view.getURL()));
view.addEventListener('did-navigate-in-page', () => (urlBox.value = view.getURL()));

hbToggle.addEventListener('change', async (e) => {
  const { on } = await window.hb.set(e.target.checked);
  e.target.checked = on;
});

document.getElementById('settings').onclick = () => window.hb.openSettings();

// when app is launched by double-click (or "Open with"), main sends us the file URL
window.hb.onOpenMedia((fileUrl) => {
  const viewerPage = new URL('viewer.html', window.location.href).toString();
  const finalUrl = `${viewerPage}?src=${encodeURIComponent(fileUrl)}`;
  view.loadURL(finalUrl);
  urlBox.value = finalUrl;
});
