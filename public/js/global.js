const btn = document.getElementById("go-back");

if (btn) {
document.getElementById("go-back").addEventListener("click", () => {
  window.location = '/'
})
}



if ('serviceWorker' in navigator) {
  window.addEventListener('load', () => {
    navigator.serviceWorker.register('/sw.js').catch(console.error);
  });
}
