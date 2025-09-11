(function(){
  window.showToast = function(msg, timeout=2500){
    let holder = document.querySelector('.toast');
    if(!holder){
      holder = document.createElement('div');
      holder.className = 'toast';
      holder.innerHTML = '<div class="inner"></div>';
      document.body.appendChild(holder);
    }
    holder.querySelector('.inner').textContent = msg;
    holder.classList.add('show');
    setTimeout(()=> holder.classList.remove('show'), timeout);
  };
})();