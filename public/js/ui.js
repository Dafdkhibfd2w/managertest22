(function(){
  const ROOT_ID = 'toast-root';

  function ensureRoot(){
    let root = document.getElementById(ROOT_ID);
    if(!root){
      root = document.createElement('div');
      root.id = ROOT_ID;
      document.body.appendChild(root);
    }
    return root;
  }

  function pickIcon(type){
    switch(type){
      case 'success': return '✅';
      case 'info':    return 'ℹ️';
      case 'warn':    return '⚠️';
      case 'error':   return '⛔';
      default:        return '🔔';
    }
  }

  window.showToast = function(msg, opts={}){
    const {
      type='success',
      duration=3000,
      icon=pickIcon(type),
      onClose
    } = opts;

    const root = ensureRoot();

    const toast = document.createElement('div');
    toast.className = `toast ${type}`;
    toast.setAttribute('role','status');
    toast.setAttribute('aria-live','polite');
    toast.style.position = 'relative';

    const title = typeof msg === 'string' ? msg : (msg.title || '');
    const desc  = typeof msg === 'string' ? ''  : (msg.desc  || '');

    toast.innerHTML = `
      <div class="icon">${icon}</div>
      <div class="content">
        <div class="title">${title}</div>
        ${desc ? `<div class="desc">${desc}</div>` : ``}
      </div>
      <button class="close" aria-label="סגירה">✕</button>
      <div class="bar"><i style="animation-duration:${duration}ms"></i></div>
    `;

    const close = () => {
      toast.style.animation = 'toastOut .2s ease both';
      setTimeout(() => {
        toast.remove();
        onClose && onClose();
      }, 180);
    };

    toast.querySelector('.close').addEventListener('click', close);

    toast.addEventListener('click', (e) => {
      if(e.target.classList.contains('close')) return;
      close();
    });

    root.appendChild(toast);

    let timer = setTimeout(close, duration);

    toast.addEventListener('mouseenter', () => clearTimeout(timer));
    toast.addEventListener('mouseleave', () => {
      timer = setTimeout(close, 800);
    });

    return close;
  };
})();
