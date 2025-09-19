async function getCsrf() {
  const res = await fetch("/csrf-token", { credentials: "include" });
  const data = await res.json();
  return data.csrfToken;
}
    const form = document.getElementById('supplierForm');
    const formTitle = document.getElementById('formTitle');
    const msg  = document.getElementById('msg');
    const tblBody = document.querySelector('#tbl tbody');
    const itemsGrid = document.getElementById('itemsGrid');
    const addItemBtn = document.getElementById('addItem');
    const resetBtn = document.getElementById('resetForm');

    const nameEl = document.getElementById('name');
    const phoneEl = document.getElementById('phone');
    const dayEls = Array.from(document.querySelectorAll('.day'));

    let editingId = null;
    let currentList = [];

    function dayLabel(n){ return ['א׳','ב׳','ג׳','ד׳','ה׳','ו׳','ש׳'][n] || n; }

    function renderItems(items){
      itemsGrid.innerHTML = '';
      (items || []).forEach(it => addItemRow(it.name, it.unit));
      if (!items || !items.length) addItemRow('','');
    }

    function addItemRow(name = '', unit = '') {
      const row = document.createElement('div');
      row.className = 'item-row';
      row.innerHTML = `
        <input type="text" placeholder="שם מוצר" value="${escapeAttr(name)}">
        <input type="text" placeholder="יחידה" value="${escapeAttr(unit)}">
        <button type="button" class="secondary delBtn">מחק</button>
      `;
      row.querySelector('.delBtn').addEventListener('click', () => row.remove());
      itemsGrid.appendChild(row);
    }

    addItemBtn.addEventListener('click', () => addItemRow('',''));
    resetBtn.addEventListener('click', resetForm);

    function collectItems(){
      return Array.from(itemsGrid.querySelectorAll('.item-row')).map(r => {
        const [n, u] = r.querySelectorAll('input');
        return { name: n.value.trim(), unit: u.value.trim() };
      }).filter(x => x.name);
    }

    function collectDays(){ return dayEls.filter(el => el.checked).map(el => Number(el.value)); }
    function setDays(days){ dayEls.forEach(el => el.checked = Array.isArray(days) && days.includes(Number(el.value))); }

    function resetForm(){
      editingId = null;
      formTitle.textContent = 'הוסף ספק';
      nameEl.value = ''; phoneEl.value = '';
      setDays([]); renderItems([]); msg.textContent = '';
    }

    form.addEventListener('submit', async (e) => {
      e.preventDefault();
      const payload = {
        name: nameEl.value.trim(),
        phone: phoneEl.value.trim(),
        days: collectDays(),
        items: collectItems()
      };
      try {
        // msg.textContent = 'שומר...';
        showToast('שומר...-')
        let res;
        if (editingId) {
            const csrf = await getCsrf();
          res = await fetch('/suppliers/' + editingId, {
            method:'PUT',
            credentials: 'include', // 🔒 חשוב לאבטחה
  headers: {
    'Content-Type':'application/json',
    "CSRF-Token": csrf
  },
            body: JSON.stringify(payload)
          });
        } else {
            const csrf = await getCsrf();

          res = await fetch('/suppliers', {
            method:'POST',
            credentials: 'include',
  headers: {
    'Content-Type':'application/json',
    "CSRF-Token": csrf
  },
            body: JSON.stringify(payload)
          });
        }
        const data = await res.json();
        if (data.ok) { showToast('נשמר ✔'); await loadSuppliers(); resetForm(); }
        else { msg.textContent = data.message || 'שגיאה בשמירה'; }
        setTimeout(()=> msg.textContent='', 1500);
      } catch { msg.textContent = 'שגיאה בשמירה'; }
    });

    async function loadSuppliers(){
      const res = await fetch('/suppliers', { credentials: 'include' });
      const data = await res.json();
      currentList = data.suppliers || [];
      renderTable();
    }

    function renderTable(){
      tblBody.innerHTML = currentList.map(s => `
        <tr>
          <td data-label="שם">${escapeHtml(s.name)}</td>
          <td data-label="טלפון">${escapeHtml(s.phone) || 'לא הוזן'}</td>
          <td data-label="ימים">${(s.days||[]).map(dayLabel).join(', ')}</td>
          <td data-label="מוצרים">${(s.items||[]).map(it => escapeHtml(it.name)).join(', ')}</td>
          <td data-label="הועלה">${escapeHtml(s.createdBy || 'לא ידוע')}</td>
          <td class="actions">
            <button style="width:100px;" class="secondary editBtn" data-id="${s._id}">ערוך</button>
            <button style="width:100px;" class="danger delBtn" data-id="${s._id}">מחק</button>
          </td>
        </tr>
      `).join('');
      // מאזינים אחרי הרינדור
      tblBody.querySelectorAll('.editBtn').forEach(btn=>{
        btn.addEventListener('click',()=>editSupplier(btn.dataset.id));
      });
      
      tblBody.querySelectorAll('.delBtn').forEach(btn=>{
        btn.addEventListener('click',()=>delSupplier(btn.dataset.id));
      });
    }
    async function editSupplier(id){
      const s = currentList.find(x => x._id === id);
      if (!s) return;
      editingId = id;
      formTitle.textContent = 'עריכת ספק';
      nameEl.value = s.name || ''; phoneEl.value = s.phone || '';
      setDays(s.days || []); renderItems(s.items || []);
      window.scrollTo({ top: 0, behavior: 'smooth' });
    }

    async function delSupplier(id){
      if (!confirm('למחוק ספק?')) return;
     await fetch(`/suppliers/${id}`, {
  method: 'DELETE',
  credentials: 'include',
  headers: {
    "CSRF-Token": await getCsrf()
  }
});

      await loadSuppliers();
    }

    function escapeHtml(s){ return String(s||'').replace(/[&<>"']/g, m => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;'}[m])); }
    function escapeAttr(s){ return escapeHtml(s).replace(/"/g,'&quot;'); }

    // init
    resetForm(); loadSuppliers();