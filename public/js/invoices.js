async function uploadInvoice() {
  const fileInput = document.getElementById("fileInput");
  if (!fileInput.files.length) {
    alert("חייב לבחור קובץ!");
    return;
  }

  const formData = new FormData();
  formData.append("file", fileInput.files[0]);

  const res = await fetch("/upload-invoice", {
    method: "POST",
    body: formData
  });

  const data = await res.json();
  console.log(data);
}


    const uploadInvoicesForm = document.getElementById('uploadInvoicesForm');
    const uploadMsg  = document.getElementById('uploadMsg');
    const filterInvoicesForm = document.getElementById('filterInvoicesForm');
    const clearInvoicesBtn   = document.getElementById('clearInvoicesFilters');
    const tbodyInvoices      = document.querySelector('#tbl .tbodyInvoices');
    const prevBtnInv    = document.getElementById('prevBtnInv');
    const nextBtnInv    = document.getElementById('nextBtnInv');
    const pageInfoInv   = document.getElementById('pageInfoInv');

    let stateinv = { date:'', supplier:'', skip:0, limit:20, total:0 };

    // ===== פונקציית CSRF =====
    async function getCsrf() {
      const res = await fetch("/csrf-token", { credentials: "include" });
      const data = await res.json();
      return data.csrfToken;
    }

    // העלאה
    uploadInvoicesForm.addEventListener('submit', async (e) => {
      e.preventDefault();
      // uploadMsg.textContent = 'מעלה...';
      showToast('מעלה...')
      const fd = new FormData(uploadInvoicesForm);
      try {
        const csrf = await getCsrf();
const res = await fetch('/upload-invoice', { 
  method:'POST',
  credentials:'include',
  headers:{ 
    
    "CSRF-Token": csrf
  },
  body: fd 
});
        const data = await res.json();
        showToast(data.message || (data.ok ? 'הועלה' : 'שגיאה'))
        if (data.ok) {
          uploadInvoicesForm.reset();
          fileName.textContent = 'לא נבחר קובץ';
          load();
        }
      } catch (err) {
        uploadMsg.textContent = 'שגיאה בהעלאה';
      }
    });

    // סינון
    filterInvoicesForm.addEventListener('submit', (e) => {
      e.preventDefault();
      const fd = new FormData(filterInvoicesForm);
      stateinv.date = fd.get('date') || '';
      stateinv.supplier = fd.get('supplier') || '';
      stateinv.skip = 0;
      load();
    });

    clearInvoicesBtn.addEventListener('click', () => {
      filterInvoicesForm.reset();
      stateinv = { ...stateinv, date:'', supplier:'', skip:0 };
      load();
    });

    // עימוד
    prevBtnInv.addEventListener('click', () => {
      if (stateinv.skip <= 0) return;
      stateinv.skip = Math.max(0, stateinv.skip - stateinv.limit);
      load();
    });
    nextBtnInv.addEventListener('click', () => {
      if (stateinv.skip + stateinv.limit >= stateinv.total) return;
      stateinv.skip += stateinv.limit;
      load();
    });

    async function load() {
      const params = new URLSearchParams();
      if (stateinv.date) params.set('date', stateinv.date);
      if (stateinv.supplier) params.set('supplier', stateinv.supplier);
      params.set('skip', stateinv.skip);
      params.set('limit', stateinv.limit);

      const csrf = await getCsrf();
      const res = await fetch('/invoices?' + params.toString(), { 
        credentials:'include',
        headers:{ "CSRF-Token": csrf }
      });
      const data = await res.json();
      stateinv.total = data.total || 0;

      tbodyInvoices.innerHTML = (data.items || []).map(r => `
        <tr>
          <td data-label="תאריך">${escapeHtml(r.shiftDate || '')}</td>
          <td data-label="ספק">${escapeHtml(r.supplier || '')}</td>
          <td data-label="חשבונית">
            <a href="${r.url}" target="_blank" style="color: white;" title="${escapeHtml(r.originalName || '')}">צפייה בקובץ</a>
          </td>
          <td data-label="העלה">${escapeHtml(r.uploadedBy || '')}</td>
          <td class="actions">
            <button class="secondary delBtn" data-id="${r._id}">מחק</button>
          </td>
        </tr>
      `).join('');

      const page = Math.floor(stateinv.skip / stateinv.limit) + 1;
      const pages = Math.max(1, Math.ceil(stateinv.total / stateinv.limit));
      pageInfoInv.textContent = `עמוד ${page} מתוך ${pages} (סה״כ ${stateinv.total})`;

      prevBtnInv.disabled = stateinv.skip <= 0;
      nextBtnInv.disabled = stateinv.skip + stateinv.limit >= stateinv.total;

      // חיבור מאזינים למחיקה
      tbodyInvoices.querySelectorAll('.delBtn').forEach(btn=>{
        btn.addEventListener('click',()=>delInvoice(btn.dataset.id));
      });
    }

    async function delInvoice(id) {
      if (!confirm('למחוק את החשבונית?')) return;
      const csrf = await getCsrf();
      const res = await fetch('/invoice/' + encodeURIComponent(id), { 
        method:'DELETE',
        credentials:'include',
        headers:{ "CSRF-Token": csrf }
      });
      const data = await res.json();
      alert(data.message || (data.ok ? 'נמחק' : 'שגיאה'));
      if (data.ok) load();
    }

    function escapeHtml(s){ return String(s||'').replace(/[&<>"']/g, m => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;','\'':'&#39;'}[m])); }

    // קובץ
    const fileInput = document.getElementById('fileInput');
    const fileBtn = document.getElementById('fileBtn');
    const fileName = document.getElementById('fileName');
    fileBtn.addEventListener("click", () => {
      document.getElementById('fileInput').click();
    })
    fileInput.addEventListener('change', () => {
      fileName.textContent = fileInput.files.length ? fileInput.files[0].name : 'לא נבחר קובץ';
    });

    // טעינה ראשונית
    load();