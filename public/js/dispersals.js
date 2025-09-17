    // ===== Helpers =====
    const addForm     = document.getElementById('addForm');
    const addMsg      = document.getElementById('addMsg');
    const filterForm  = document.getElementById('filterForm');
    const clearBtn    = document.getElementById('clearFilters');
    const tbody       = document.querySelector('#tbl tbody');
    const prevBtn     = document.getElementById('prevBtn');
    const nextBtn     = document.getElementById('nextBtn');
    const pageInfo    = document.getElementById('pageInfo');
    const sumShownEl  = document.getElementById('sumShown');
    const countShownEl= document.getElementById('countShown');
async function getCsrf() {
  const res = await fetch("/csrf-token", { credentials: "include" });
  const data = await res.json();
  return data.csrfToken;
}
    let allItems = []; // מאגר מקומי לאחר הבאה מהשרת
    let state = { date:'', q:'', skip:0, limit:20 };

    function escapeHtml(s){ return String(s||'').replace(/[&<>"']/g, m => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;'}[m])); }
    function toArr(val){ return Array.isArray(val) ? val : String(val||'').split(',').map(x=>x.trim()).filter(Boolean); }
    function formatPrice(n){ return (Number(n)||0).toLocaleString('he-IL'); }

    // ===== Create =====
    addForm.addEventListener('submit', async (e) => {
      e.preventDefault();
    //   addMsg.textContent = 'שומר...';
      showToast("שומר...")
      const fd = new FormData(addForm);
      const body = Object.fromEntries(fd.entries());
      try {
        const res = await fetch('/dispersals', {
          method:'POST',
          headers:{'Content-Type':'application/json',"CSRF-Token": await getCsrf()},
          body: JSON.stringify(body)
        });
        const data = await res.json();
        if (data.ok) {
          addMsg.textContent = 'נשמר ✔';
          addForm.reset();
          await loadAll(); // רענון נתונים
          applyFiltersAndRender();
        } else {
          addMsg.textContent = data.message || 'שגיאה בשמירה';
        }
      } catch(err){
        addMsg.textContent = 'שגיאה בשמירה';
      } finally {
        setTimeout(()=> addMsg.textContent='', 1500);
      }
    });

    // ===== Filters =====
    filterForm.addEventListener('submit', (e) => {
      e.preventDefault();
      const fd = new FormData(filterForm);
      state.date = fd.get('date') || '';
      state.q    = fd.get('q') || '';
      state.skip = 0;
      applyFiltersAndRender();
    });

    clearBtn.addEventListener('click', () => {
      filterForm.reset();
      state = { ...state, date:'', q:'', skip:0 };
      applyFiltersAndRender();
    });

    // ===== Pagination =====
    prevBtn.addEventListener('click', () => {
      if (state.skip <= 0) return;
      state.skip = Math.max(0, state.skip - state.limit);
      render(currentFiltered);
    });
    nextBtn.addEventListener('click', () => {
      if (state.skip + state.limit >= currentFiltered.length) return;
      state.skip += state.limit;
      render(currentFiltered);
    });

    // ===== Data loading & Rendering =====
    async function loadAll(){
      // אפשר להעביר date לשאילתה כדי לצמצם, אבל כאן נביא הכל פעם אחת
      const res = await fetch('/dispersals');
      allItems = await res.json();
    }

    let currentFiltered = [];
    function applyFiltersAndRender(){
      // סינון בצד לקוח
      currentFiltered = allItems.filter(item => {
        const byDate = state.date ? (item.shiftDate === state.date) : true;
        const q = state.q.trim();
        const byQ = !q ? true : (
          (item.taxi && item.taxi.toLowerCase().includes(q.toLowerCase()))
          // (Array.isArray(item.people) && item.people.some(p => (p||'').toLowerCase().includes(q.toLowerCase())))
        );
        return byDate && byQ;
      });
      state.skip = 0;
      render(currentFiltered);
    }

    function render(list){
      const start = state.skip;
      const end   = Math.min(list.length, start + state.limit);
      const page  = list.slice(start, end);

      // סיכום
      const sum = page.reduce((acc, x) => acc + Number(x.price||0), 0);
      sumShownEl.textContent   = formatPrice(sum);
      countShownEl.textContent = page.length;

      tbody.innerHTML = page.map(d => `
<tr>
  <td data-label="תאריך" class="nowrap">${escapeHtml(d.shiftDate)}</td>
  <td data-label="מחיר" class="nowrap">${formatPrice(d.price)} ₪</td>
  <td data-label="מונית">${escapeHtml(d.taxi || 'לא הוזן')}</td>
  <td data-label="שילם">${escapeHtml(d.payer || 'לא הוזן')}</td>
  <td class="nowrap">
    <button class="secondary ss"data-id="${d._id}">מחק</button>
  </td>
</tr>
      `).join('');
            tbody.querySelectorAll('.ss').forEach(btn=>{
        btn.addEventListener('click',()=>delDisp(`${btn.dataset.id}`));
      });
          // <td>${escapeHtml(d.notes || '')}</td>
          // <td>${(d.people || []).map(p => `<span class="pill">${escapeHtml(p)}</span>`).join('')}</td>

      const pageIdx  = Math.floor(state.skip / state.limit) + 1;
      const pages    = Math.max(1, Math.ceil(list.length / state.limit));
      pageInfo.textContent = `עמוד ${pageIdx} מתוך ${pages} (סה״כ ${list.length})`;

      prevBtn.disabled = state.skip <= 0;
      nextBtn.disabled = state.skip + state.limit >= list.length;
    }

    async function delDisp(id){
      if (!confirm('למחוק את הרשומה?')) return;
      await fetch('/dispersals/' + encodeURIComponent(id), { method:'DELETE', headers: {"CSRF-Token": await getCsrf()} });
      await loadAll();
      applyFiltersAndRender();
    }

    // Init
    (async () => {
      await loadAll();
      applyFiltersAndRender();
    })();