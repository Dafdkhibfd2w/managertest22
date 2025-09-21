document.addEventListener("DOMContentLoaded", () => {
const dateInput = document.getElementById('dateInput');
    const loadOrdersForm  = document.getElementById('loadOrdersform');
    const saveBtn   = document.getElementById('saveBtn');
    const msg       = document.getElementById('msg');
    const wrap      = document.getElementById('suppliersWrap');

    let current = null;

    // ===== פונקציית CSRF =====
    async function getCsrf() {
      const res = await fetch("/csrf-token", { credentials: "include" });
      const data = await res.json();
      return data.csrfToken;
    }

    // טען/צור טופס ליום
    loadOrdersForm.addEventListener('submit', async (e) => {
      e.preventDefault();
      const date = dateInput.value;
      if (!date) return;
      // msg.textContent = 'טוען...';
        showToast('טוען ...')

      const csrf = await getCsrf();
      const res = await fetch('/orders?date=' + encodeURIComponent(date), {
        credentials: 'include',
        headers: { "CSRF-Token": csrf }
      });
      const data = await res.json();

      if (data.ok) {
        current = data.order;
        render();
        // msg.textContent = 'נטען ✔';
        showToast('נטען ✔')
      } else {
        // msg.textContent = data.message || 'שגיאה';
        showToast(data.message || 'שגיאה')
      }
      setTimeout(()=> msg.textContent='', 1500);
    });

    function weekdayFromYMD(ymd) {
      if (!ymd) return '';
      const [y, m, d] = ymd.split('-').map(Number);
      const dt = new Date(y, m - 1, d);
      return dt.toLocaleDateString('he-IL', { weekday: 'long' });
    }

    function updateWeekdayHint() {
      const ymd = dateInput.value;
      document.getElementById('weekdayHint').textContent =
        ymd ? `(${weekdayFromYMD(ymd)})` : '';
    }
    updateWeekdayHint();
    dateInput.addEventListener('change', updateWeekdayHint);

    // שמירה
    saveBtn.addEventListener('click', async () => {
      if (!current) return;
      collectFromUI();
      // msg.textContent = 'שומר...';
      showToast('שומר...')
      const csrf = await getCsrf();
      const res = await fetch('/orders', {
        method:'POST',
        credentials: 'include',
        headers:{ 
          'Content-Type':'application/json',
          "CSRF-Token": csrf
        },
        body: JSON.stringify({ 
          date: current.date, 
          blocks: current.blocks, 
          notes: current.notes || '' 
        })
      });
      const data = await res.json();
      // msg.textContent = data.ok ? 'נשמר ✔' : (data.message || 'שגיאה בשמירה');
      showToast(data.ok ? 'נשמר ✔' : (data.message || 'שגיאה בשמירה'))
      setTimeout(()=> msg.textContent='', 1500);
    });

    function render(){
      wrap.innerHTML = '';
      if (!current.blocks || !current.blocks.length) {
        const empty = document.createElement('div');
        empty.className = 'card';
        empty.innerHTML = `<p style="text-align:center;color:#666">אין ספקים ליום זה</p>`;
        wrap.appendChild(empty);
        return;
      }

      (current.blocks || []).forEach((b, bi) => {
        const card = document.createElement('div');
        card.className = 'card supplier';
        card.innerHTML = `
          <h3 style="color: white;">${escapeHtml(b.supplier)}</h3>
          <div style="overflow:auto">
            <table>
              <thead>
                <tr>
                  <th>מוצר</th>
                  <th>כמה יש</th>
                  <th>להזמין</th>
                  <th>הערות</th>
                </tr>
              </thead>
              <tbody>
                ${b.items.map((it, ii) => `
                  <tr>
                    <td>
                      <div>${escapeHtml(it.name)} <span class="unit">${escapeHtml(it.unit||'')}</span></div>
                    </td>
                    <td><input type="number" class="qty" min="0" step="1" value="${num(it.currentQty)}" data-bi="${bi}" data-ii="${ii}" data-field="currentQty"></td>
                    <td><input type="number" class="qty" min="0" step="1" value="${num(it.toOrderQty)}" data-bi="${bi}" data-ii="${ii}" data-field="toOrderQty"></td>
                    <td><input type="text" value="${escapeAttr(it.notes||'')}" data-bi="${bi}" data-ii="${ii}" placeholder="לדוגמא:" data-field="notes" style="width:100%"></td>
                  </tr>
                `).join('')}
              </tbody>
            </table>
          </div>
        `;
        wrap.appendChild(card);
      });

      // מאזינים לשינויים
      wrap.querySelectorAll('input').forEach(inp => {
        inp.addEventListener('input', onFieldChange);
      });
    }

    function onFieldChange(e){
      const bi = +e.target.dataset.bi;
      const ii = +e.target.dataset.ii;
      const field = e.target.dataset.field;
      const v = e.target.type === 'number' ? Number(e.target.value || 0) : String(e.target.value || '');
      if (current?.blocks?.[bi]?.items?.[ii]) {
        current.blocks[bi].items[ii][field] = v;
      }
    }

    function collectFromUI(){
      // כרגע רק המוצרים מתעדכנים ישירות; הערות יום אם תפעיל אותן
    }

    function num(n){ return Number(n||0); }
    function escapeHtml(s){ return String(s||'').replace(/[&<>"']/g, m => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;'}[m])); }
    function escapeAttr(s){ return escapeHtml(s).replace(/"/g,'&quot;'); }

    // ברירת מחדל: טען היום
    const today = new Date().toISOString().slice(0,10);
    dateInput.value = today;

    });