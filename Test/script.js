// =================================================================================
// SCRIPT.JS - Single File Application Logic
// =================================================================================

// --- GLOBAL VARIABLES & CONSTANTS ---
const DB_NAME = 'internetManagerDB';
const DB_VERSION = 1;
let db;
let activeCharts = [];

// --- DOM ELEMENTS ---
const loader = document.getElementById('loader');
const mainContent = document.getElementById('main-content');
const modalContainer = document.getElementById('modal-container');
const notificationContainer = document.getElementById('notification-container');

// =================================================================================
// 1. DATABASE LOGIC (IndexedDB)
// =================================================================================
function initDB() {
    return new Promise((resolve, reject) => {
        const request = indexedDB.open(DB_NAME, DB_VERSION);
        request.onerror = () => reject('Database error');
        request.onsuccess = (event) => { db = event.target.result; resolve(db); };
        request.onupgradeneeded = (event) => {
            const db = event.target.result;
            if (!db.objectStoreNames.contains('subscribers')) {
                db.createObjectStore('subscribers', { keyPath: 'id', autoIncrement: true });
            }
            if (!db.objectStoreNames.contains('packages')) {
                const packagesStore = db.createObjectStore('packages', { keyPath: 'id', autoIncrement: true });
                packagesStore.createIndex('name', 'name', { unique: true });
            }
            if (!db.objectStoreNames.contains('movements')) {
                const movementsStore = db.createObjectStore('movements', { keyPath: 'id', autoIncrement: true });
                movementsStore.createIndex('subscriberId', 'subscriberId', { unique: false });
                movementsStore.createIndex('timestamp', 'timestamp', { unique: false });
            }
        };
    });
}
function performTransaction(storeName, mode, callback) {
    return new Promise((resolve, reject) => {
        if (!db) return reject("Database not initialized.");
        const transaction = db.transaction(storeName, mode);
        const store = transaction.objectStore(storeName);
        const result = callback(store);
        result.onsuccess = (event) => resolve(event.target.result);
        result.onerror = (event) => reject(event.target.error);
    });
}
const dbActions = {
    add: (storeName, data) => performTransaction(storeName, 'readwrite', store => store.add(data)),
    getAll: (storeName) => performTransaction(storeName, 'readonly', store => store.getAll()),
    get: (storeName, key) => performTransaction(storeName, 'readonly', store => store.get(key)),
    update: (storeName, data) => performTransaction(storeName, 'readwrite', store => store.put(data)),
    delete: (storeName, key) => performTransaction(storeName, 'readwrite', store => store.delete(key)),
    clear: (storeName) => performTransaction(storeName, 'readwrite', store => store.clear()),
    getFromIndex: (storeName, indexName, query) => performTransaction(storeName, 'readonly', store => store.index(indexName).getAll(query)),
};

// =================================================================================
// 2. UTILITY FUNCTIONS
// =================================================================================
function formatCurrency(amount) {
    return new Intl.NumberFormat('ar-IQ', { style: 'currency', currency: 'IQD', minimumFractionDigits: 0 }).format(amount || 0).replace('IQD', 'دينار');
}
function formatDateTime(isoString) {
    if (!isoString) return 'N/A';
    return new Intl.DateTimeFormat('ar-EG-u-nu-latn', { year: 'numeric', month: 'long', day: 'numeric', hour: 'numeric', minute: '2-digit', hour12: true }).format(new Date(isoString));
}
function calculateStatus(subscriber, movements) {
    const lastActivation = movements.filter(m => m.subscriberId === subscriber.id && m.type === 'تفعيل').sort((a, b) => new Date(b.timestamp) - new Date(a.timestamp))[0];
    if (!lastActivation) return { text: 'جديد', className: 'status-gray' };
    const endDate = new Date(lastActivation.endDate);
    const now = new Date();
    const sevenDaysFromNow = new Date(now.getTime() + 7 * 24 * 60 * 60 * 1000);
    if (endDate < now) return { text: 'منتهي', className: 'status-red' };
    if (endDate <= sevenDaysFromNow) return { text: 'سينتهي قريباً', className: 'status-orange' };
    return { text: 'فعّال', className: 'status-green' };
}

// =================================================================================
// 3. UI & COMPONENT RENDERING
// =================================================================================
function showNotification(message, type = 'success') {
    const notification = document.createElement('div');
    notification.className = `notification ${type}`;
    notification.textContent = message;
    notificationContainer.appendChild(notification);
    setTimeout(() => {
        notification.classList.add('fade-out');
        notification.addEventListener('transitionend', () => notification.remove());
    }, 3000);
}
function destroyCharts() {
    activeCharts.forEach(chart => chart.destroy());
    activeCharts = [];
}

async function renderDashboard() {
    destroyCharts();
    mainContent.innerHTML = `<div class="page-header"><h1 class="page-title">لوحة التحكم</h1></div><div id="dashboard-content"></div>`;
    const dashboardContent = document.getElementById('dashboard-content');
    const [subscribers, movements, packages] = await Promise.all([dbActions.getAll('subscribers'), dbActions.getAll('movements'), dbActions.getAll('packages')]);
    const now = new Date();
    const activeSubscribers = subscribers.filter(sub => calculateStatus(sub, movements).className === 'status-green');
    const totalDebt = subscribers.reduce((sum, sub) => sum + (sub.debt || 0), 0);
    const activationsThisMonth = movements.filter(m => m.type === 'تفعيل' && new Date(m.timestamp).getMonth() === now.getMonth() && new Date(m.timestamp).getFullYear() === now.getFullYear());
    const monthlyRevenue = activationsThisMonth.reduce((sum, m) => sum + m.amount, 0);
    dashboardContent.innerHTML = `
        <div class="stats-grid">
            <div class="stat-card"><div class="icon bg-primary"><i class="fas fa-users"></i></div><div class="info"><h4>إجمالي المشتركين</h4><p>${subscribers.length}</p></div></div>
            <div class="stat-card"><div class="icon bg-success"><i class="fas fa-user-check"></i></div><div class="info"><h4>المشتركون الفعّالون</h4><p>${activeSubscribers.length}</p></div></div>
            <div class="stat-card"><div class="icon bg-danger"><i class="fas fa-file-invoice-dollar"></i></div><div class="info"><h4>إجمالي الديون</h4><p>${formatCurrency(totalDebt)}</p></div></div>
            <div class="stat-card"><div class="icon bg-warning"><i class="fas fa-chart-line"></i></div><div class="info"><h4>إيرادات الشهر</h4><p>${formatCurrency(monthlyRevenue)}</p></div></div>
        </div>
        <div class="charts-grid"><div class="card"><canvas id="barChart"></canvas></div><div class="card"><canvas id="pieChart"></canvas></div></div>
        <div class="card"><h3>أحدث الحركات</h3><div class="table-container"><table class="styled-table" id="latest-movements-table"></table></div></div>`;
    const barChartCtx = document.getElementById('barChart').getContext('2d');
    const months = Array.from({ length: 6 }, (_, i) => { const d = new Date(); d.setMonth(d.getMonth() - i); return { month: d.getMonth(), year: d.getFullYear(), label: d.toLocaleString('ar-EG', { month: 'long' }) }; }).reverse();
    const barChartData = months.map(m => movements.filter(mov => mov.type === 'تفعيل' && new Date(mov.timestamp).getMonth() === m.month && new Date(mov.timestamp).getFullYear() === m.year).length);
    activeCharts.push(new Chart(barChartCtx, { type: 'bar', data: { labels: months.map(m => m.label), datasets: [{ label: 'الاشتراكات الجديدة', data: barChartData, backgroundColor: 'rgba(0, 123, 255, 0.7)', borderColor: 'rgba(0, 123, 255, 1)', borderWidth: 1 }] }, options: { responsive: true, scales: { y: { beginAtZero: true } } } }));
    const pieChartCtx = document.getElementById('pieChart').getContext('2d');
    const packageDistribution = packages.map(pkg => ({ name: pkg.name, count: activeSubscribers.filter(sub => { const lastActivation = movements.filter(m => m.subscriberId === sub.id && m.type === 'تفعيل').sort((a,b) => new Date(b.timestamp) - new Date(a.timestamp))[0]; return lastActivation && lastActivation.packageName === pkg.name; }).length }));
    activeCharts.push(new Chart(pieChartCtx, { type: 'pie', data: { labels: packageDistribution.map(p => p.name), datasets: [{ label: 'توزيع المشتركين', data: packageDistribution.map(p => p.count), backgroundColor: ['rgba(0, 123, 255, 0.8)', 'rgba(40, 167, 69, 0.8)', 'rgba(255, 193, 7, 0.8)', 'rgba(220, 53, 69, 0.8)', 'rgba(108, 117, 125, 0.8)'] }] }, options: { responsive: true } }));
    const latestMovements = movements.sort((a, b) => new Date(b.timestamp) - new Date(a.timestamp)).slice(0, 5);
    document.getElementById('latest-movements-table').innerHTML = `<thead><tr><th>المشترك</th><th>النوع</th><th>المبلغ</th><th>التاريخ</th></tr></thead><tbody>${latestMovements.map(m => { const sub = subscribers.find(s => s.id === m.subscriberId); return `<tr><td>${sub ? sub.name : 'محذوف'}</td><td>${m.type}</td><td>${formatCurrency(m.amount)}</td><td>${formatDateTime(m.timestamp)}</td></tr>`; }).join('')}</tbody>`;
}

async function renderSubscribersPage(filter = 'all') {
    mainContent.innerHTML = `
        <div class="page-header"><h1 class="page-title">المشتركون</h1><button id="add-subscriber-btn" class="btn btn-primary"><i class="fas fa-plus"></i> إضافة مشترك</button></div>
        <div class="card"><div id="filter-buttons" class="filter-bar">
            <button class="btn ${filter === 'all' ? 'btn-primary' : 'btn-secondary'}" data-filter="all">الكل</button>
            <button class="btn ${filter === 'active' ? 'btn-primary' : 'btn-secondary'}" data-filter="active">فعال</button>
            <button class="btn ${filter === 'expiring' ? 'btn-primary' : 'btn-secondary'}" data-filter="expiring">سينتهي قريباً</button>
            <button class="btn ${filter === 'expired' ? 'btn-primary' : 'btn-secondary'}" data-filter="expired">منتهي</button>
            <button class="btn ${filter === 'new' ? 'btn-primary' : 'btn-secondary'}" data-filter="new">جديد</button>
        </div></div>
        <div class="card table-container"><table class="styled-table"><thead><tr><th>الاسم</th><th>رقم الهاتف</th><th>الدين</th><th>الحالة</th><th>إجراءات</th></tr></thead><tbody id="subscribers-table-body"></tbody></table></div>`;
    document.getElementById('add-subscriber-btn').onclick = () => showSubscriberModal();
    document.getElementById('filter-buttons').onclick = (e) => { if (e.target.dataset.filter) renderSubscribersPage(e.target.dataset.filter); };
    const [subscribers, movements] = await Promise.all([dbActions.getAll('subscribers'), dbActions.getAll('movements')]);
    const tableBody = document.getElementById('subscribers-table-body');
    tableBody.innerHTML = '';
    subscribers.forEach(sub => {
        const status = calculateStatus(sub, movements);
        let shouldShow = filter === 'all' || (filter === 'active' && status.className === 'status-green') || (filter === 'expiring' && status.className === 'status-orange') || (filter === 'expired' && status.className === 'status-red') || (filter === 'new' && status.className === 'status-gray');
        if (shouldShow) {
            const row = document.createElement('tr');
            row.innerHTML = `<td>${sub.name}</td><td>${sub.phone}</td><td>${formatCurrency(sub.debt)}</td><td><span class="status-badge ${status.className}">${status.text}</span></td>
                <td><button class="icon-button" onclick="showSubscriberModal(${sub.id})"><i class="fas fa-eye"></i></button><button class="icon-button" onclick="deleteSubscriber(${sub.id})"><i class="fas fa-trash-alt"></i></button></td>`;
            tableBody.appendChild(row);
        }
    });
}

async function renderPackagesPage() {
    mainContent.innerHTML = `
        <div class="page-header"><h1 class="page-title">إدارة الباقات</h1></div>
        <div class="card"><h3>إضافة/تعديل باقة</h3><form id="package-form" class="form-grid">
            <input type="hidden" id="package-id"><div class="form-group"><label for="package-name">اسم الباقة</label><input type="text" id="package-name" required></div>
            <div class="form-group"><label for="package-price">السعر (دينار)</label><input type="number" id="package-price" required></div>
            <div class="form-group" style="align-self: flex-end;"><button type="submit" class="btn btn-primary">حفظ الباقة</button><button type="button" id="clear-package-form" class="btn btn-secondary">إلغاء</button></div>
        </form></div>
        <div class="card table-container"><h3>الباقات الحالية</h3><table class="styled-table"><thead><tr><th>الاسم</th><th>السعر</th><th>إجراءات</th></tr></thead><tbody id="packages-table-body"></tbody></table></div>`;
    const form = document.getElementById('package-form');
    form.onsubmit = handlePackageFormSubmit;
    document.getElementById('clear-package-form').onclick = () => form.reset();
    const packages = await dbActions.getAll('packages');
    document.getElementById('packages-table-body').innerHTML = packages.map(pkg => `<tr><td>${pkg.name}</td><td>${formatCurrency(pkg.price)}</td><td><button class="icon-button" onclick="editPackage(${pkg.id})"><i class="fas fa-edit"></i></button><button class="icon-button" onclick="deletePackage(${pkg.id})"><i class="fas fa-trash-alt"></i></button></td></tr>`).join('');
}

async function renderSettingsPage() {
    mainContent.innerHTML = `
        <div class="page-header"><h1 class="page-title">الإعدادات</h1></div>
        <div class="card"><h3>إدارة البيانات</h3><p>يمكنك تصدير جميع بيانات التطبيق كملف JSON للنسخ الاحتياطي، أو استيراد بيانات من ملف تم تصديره مسبقًا.</p>
            <div style="display: flex; gap: 1rem; margin-top: 1rem;">
                <button id="export-btn" class="btn btn-success"><i class="fas fa-file-export"></i> تصدير البيانات</button>
                <label class="btn btn-primary"><i class="fas fa-file-import"></i> استيراد البيانات<input type="file" id="import-file" accept=".json" style="display: none;"></label>
            </div></div>`;
    document.getElementById('export-btn').onclick = exportData;
    document.getElementById('import-file').onchange = importData;
}

async function renderHowToUsePage() {
    mainContent.innerHTML = `<div class="page-header"><h1 class="page-title">كيفية استخدام التطبيق</h1></div><div class="card"><h2>مرحباً بك!</h2><p>هذا الدليل سيساعدك على استخدام نظام إدارة الاشتراكات بفعالية.</p><h3><i class="fas fa-users"></i> إدارة المشتركين</h3><ul><li>من صفحة <strong>المشتركون</strong>، يمكنك إضافة مشترك جديد بالضغط على زر "إضافة مشترك".</li><li>لعرض تفاصيل مشترك أو تفعيل اشتراك له، اضغط على أيقونة <i class="fas fa-eye"></i> بجانب اسمه.</li><li>يمكنك فلترة المشتركين حسب حالتهم (فعال، منتهي...) باستخدام الأزرار أعلى الجدول.</li></ul><h3><i class="fas fa-box-open"></i> إدارة الباقات</h3><ul><li>في صفحة <strong>الباقات</strong>، يمكنك إضافة باقات الإنترنت المختلفة مع أسعارها.</li><li>تظهر هذه الباقات عند تفعيل اشتراك جديد لأي مشترك.</li></ul><h3><i class="fas fa-cogs"></i> الإعدادات والنسخ الاحتياطي</h3><ul><li>من صفحة <strong>الإعدادات</strong>، يمكنك تصدير جميع بياناتك (مشتركين، باقات، حركات) إلى ملف واحد.</li><li>احفظ هذا الملف في مكان آمن. يمكنك استخدامه لاستعادة بياناتك في أي وقت باستخدام زر "استيراد البيانات".</li></ul></div>`;
}

async function renderAboutPage() {
    mainContent.innerHTML = `<div class="page-header"><h1 class="page-title">حول التطبيق</h1></div><div class="card"><h2>نظام إدارة اشتراكات الإنترنت</h2><p><strong>الإصدار:</strong> 1.1</p><p>هذا التطبيق هو حل متكامل لإدارة مشتركي شبكات الإنترنت، تم تصميمه ليعمل بالكامل بدون الحاجة لاتصال بالإنترنت (Offline-First).</p><p>يتم تخزين جميع البيانات بشكل آمن ومحلي في متصفحك باستخدام تقنية <strong>IndexedDB</strong>، مما يضمن خصوصية وسرعة الوصول لبياناتك.</p><h4>التقنيات المستخدمة:</h4><ul><li>HTML5</li><li>CSS3</li><li>JavaScript (Vanilla JS)</li><li>IndexedDB API</li><li>Chart.js for charts</li><li>Font Awesome for icons</li></ul></div>`;
}

async function renderSupportPage() {
     mainContent.innerHTML = `<div class="page-header"><h1 class="page-title">الدعم الفني</h1></div><div class="card"><h2>تواصل معنا</h2><p>إذا واجهت أي مشكلة أو كان لديك أي استفسار، يمكنك التواصل معنا عبر الوسائل التالية:</p><ul><li><strong>البريد الإلكتروني:</strong> support@example.com</li><li><strong>رقم الهاتف:</strong> +123 456 7890</li><li><strong>ساعات العمل:</strong> من السبت إلى الخميس، من 9 صباحًا حتى 5 مساءً.</li></ul><p><em>(ملاحظة: هذه بيانات تواصل وهمية، قم باستبدالها ببياناتك الحقيقية)</em></p></div>`;
}

// =================================================================================
// 4. MODALS & ACTION HANDLERS
// =================================================================================
async function showSubscriberModal(id = null) {
    const [subscriber, movements, packages] = await Promise.all([id ? dbActions.get('subscribers', id) : Promise.resolve(null), id ? dbActions.getFromIndex('movements', 'subscriberId', id) : Promise.resolve([]), dbActions.getAll('packages')]);
    const isNew = !subscriber;
    const title = isNew ? 'إضافة مشترك جديد' : `تفاصيل: ${subscriber.name}`;
    modalContainer.innerHTML = `
        <div class="modal-backdrop" onclick="this.remove()"><div class="modal-content" onclick="event.stopPropagation()">
            <div class="modal-header"><h2 class="modal-title">${title}</h2><button class="icon-button" onclick="document.querySelector('.modal-backdrop').remove()"><i class="fas fa-times"></i></button></div>
            <div class="modal-body">
                <div class="tabs"><button class="tab-link active" data-tab="details">البيانات</button><button class="tab-link" data-tab="activate">تفعيل/تسديد</button><button class="tab-link" data-tab="history">السجل</button></div>
                <div id="details" class="tab-content active"><form id="subscriber-form" class="form-grid"><input type="hidden" id="subscriber-id" value="${id || ''}"><div class="form-group"><label for="subscriber-name">الاسم</label><input type="text" id="subscriber-name" value="${subscriber?.name || ''}" required></div><div class="form-group"><label for="subscriber-phone">الهاتف</label><input type="text" id="subscriber-phone" value="${subscriber?.phone || ''}"></div></form></div>
                <div id="activate" class="tab-content"><form id="activation-form" class="form-grid">
                    <div class="form-group"><label for="activation-package">اختر الباقة</label><select id="activation-package" required>${packages.map(p => `<option value="${p.id}" data-price="${p.price}">${p.name} - ${formatCurrency(p.price)}</option>`).join('')}</select></div>
                    <div class="form-group"><label for="activation-duration">المدة</label><select id="activation-duration"><option value="1">شهر واحد</option><option value="3">3 أشهر</option><option value="6">6 أشهر</option><option value="12">سنة</option></select></div>
                    <div class="form-group"><label for="start-date">تاريخ البدء</label><input type="date" id="start-date"></div><div class="form-group"><label for="end-date">تاريخ الانتهاء</label><input type="date" id="end-date"></div>
                    <div class="form-group"><label>الإجمالي</label><p id="activation-total" style="font-weight:bold; font-size: 1.2rem;">${formatCurrency(packages[0]?.price || 0)}</p></div>
                    <div class="form-group"><label for="activation-note">ملاحظة</label><textarea id="activation-note"></textarea></div>
                </form><hr><h4>تسجيل دفعة</h4><form id="payment-form" class="form-grid"><div class="form-group"><label for="payment-amount">مبلغ الدفعة</label><input type="number" id="payment-amount" required placeholder="${formatCurrency(subscriber?.debt || 0)}"></div></form></div>
                <div id="history" class="tab-content"><div class="table-container"><table class="styled-table"><thead><tr><th>النوع</th><th>المبلغ</th><th>التاريخ</th><th>تاريخ الانتهاء</th></tr></thead><tbody>${movements.sort((a,b) => new Date(b.timestamp) - new Date(a.timestamp)).map(m => `<tr><td>${m.type}</td><td>${formatCurrency(m.amount)}</td><td>${formatDateTime(m.timestamp)}</td><td>${m.endDate ? formatDateTime(m.endDate) : '-'}</td></tr>`).join('')}</tbody></table></div></div>
            </div>
            <div class="modal-footer"><button class="btn btn-secondary" onclick="document.querySelector('.modal-backdrop').remove()">إغلاق</button><button class="btn btn-success" id="save-subscriber-btn">حفظ</button><button class="btn btn-primary" id="activate-btn" style="display:none;">تفعيل</button><button class="btn btn-warning" id="payment-btn" style="display:none;">تسديد</button></div>
        </div></div>`;
    const modal = modalContainer.querySelector('.modal-content');
    const saveBtn = modal.querySelector('#save-subscriber-btn'); const activateBtn = modal.querySelector('#activate-btn'); const paymentBtn = modal.querySelector('#payment-btn');
    modal.querySelectorAll('.tab-link').forEach(button => {
        button.onclick = (e) => {
            const tabId = e.target.dataset.tab;
            modal.querySelectorAll('.tab-content, .tab-link').forEach(el => el.classList.remove('active'));
            modal.querySelector(`#${tabId}`).classList.add('active'); e.target.classList.add('active');
            saveBtn.style.display = tabId === 'details' ? 'inline-block' : 'none';
            activateBtn.style.display = tabId === 'activate' ? 'inline-block' : 'none';
            paymentBtn.style.display = tabId === 'activate' ? 'inline-block' : 'none';
        };
    });
    saveBtn.style.display = 'inline-block';
    if (isNew) { modal.querySelectorAll('.tab-link[data-tab="activate"], .tab-link[data-tab="history"]').forEach(el => el.style.display = 'none'); }
    saveBtn.onclick = handleSubscriberFormSubmit; activateBtn.onclick = () => handleActivationSubmit(id); paymentBtn.onclick = () => handlePaymentSubmit(id);
    const durationSelect = document.getElementById('activation-duration'), packageSelect = document.getElementById('activation-package'), totalDisplay = document.getElementById('activation-total');
    const startDateInput = document.getElementById('start-date'), endDateInput = document.getElementById('end-date');
    function toYYYYMMDD(date) { return date.toISOString().split('T')[0]; }
    function calculateDates() {
        const selectedOption = packageSelect.options[packageSelect.selectedIndex]; const price = parseFloat(selectedOption?.dataset.price || 0);
        const duration = parseInt(durationSelect.value); totalDisplay.textContent = formatCurrency(price * duration);
        const startDate = new Date(startDateInput.value || Date.now()); const endDate = new Date(startDate);
        endDate.setMonth(startDate.getMonth() + duration); endDateInput.value = toYYYYMMDD(endDate);
    }
    startDateInput.value = toYYYYMMDD(new Date()); startDateInput.onchange = calculateDates;
    durationSelect.onchange = calculateDates; packageSelect.onchange = calculateDates; calculateDates();
}

async function handleSubscriberFormSubmit() {
    const id = document.getElementById('subscriber-id').value; const name = document.getElementById('subscriber-name').value; const phone = document.getElementById('subscriber-phone').value;
    if (!name) return showNotification('اسم المشترك مطلوب', 'error');
    const subscriberData = { name, phone, debt: id ? (await dbActions.get('subscribers', parseInt(id))).debt : 0 };
    try {
        if (id) {
            subscriberData.id = parseInt(id); await dbActions.update('subscribers', subscriberData);
            showNotification('تم تحديث بيانات المشترك بنجاح', 'success');
            document.querySelector('.modal-backdrop')?.remove();
            renderSubscribersPage();
        } else {
            await dbActions.add('subscribers', subscriberData); showNotification('تم إضافة مشترك جديد بنجاح', 'success');
            document.querySelector('.modal-backdrop')?.remove(); navigateTo('#subscribers'); return;
        }
    } catch (error) { showNotification('حدث خطأ أثناء الحفظ', 'error'); }
}

async function handleActivationSubmit(subscriberId) {
    if (!subscriberId) return;
    const packageSelect = document.getElementById('activation-package'); const selectedPkgOption = packageSelect.options[packageSelect.selectedIndex];
    const packageName = selectedPkgOption.text.split(' - ')[0]; const packagePrice = parseFloat(selectedPkgOption.dataset.price);
    const duration = parseInt(document.getElementById('activation-duration').value); const note = document.getElementById('activation-note').value;
    const startDate = new Date(document.getElementById('start-date').value); const endDate = new Date(document.getElementById('end-date').value);
    const amount = packagePrice * duration;
    const movement = { subscriberId, type: "تفعيل", packageName, amount, timestamp: new Date().toISOString(), note, startDate: startDate.toISOString(), endDate: endDate.toISOString() };
    try {
        const subscriber = await dbActions.get('subscribers', subscriberId); subscriber.debt = (subscriber.debt || 0) + amount;
        await dbActions.add('movements', movement); await dbActions.update('subscribers', subscriber);
        showNotification('تم تفعيل الاشتراك بنجاح', 'success'); document.querySelector('.modal-backdrop')?.remove(); renderSubscribersPage();
    } catch(error) { showNotification('فشل تفعيل الاشتراك', 'error'); }
}

async function handlePaymentSubmit(subscriberId) {
    if (!subscriberId) return;
    const amount = parseFloat(document.getElementById('payment-amount').value); if (!amount || amount <= 0) return showNotification('الرجاء إدخال مبلغ صحيح', 'error');
    const movement = { subscriberId, type: "تسديد", amount: amount, timestamp: new Date().toISOString() };
    try {
        const subscriber = await dbActions.get('subscribers', subscriberId); subscriber.debt = (subscriber.debt || 0) - amount;
        await dbActions.add('movements', movement); await dbActions.update('subscribers', subscriber);
        showNotification('تم تسجيل الدفعة بنجاح', 'success'); document.querySelector('.modal-backdrop')?.remove(); renderSubscribersPage();
    } catch (error) { showNotification('فشل تسجيل الدفعة', 'error'); }
}

async function deleteSubscriber(id) {
    if (confirm('هل أنت متأكد من حذف هذا المشترك وجميع سجلاته؟ لا يمكن التراجع عن هذا الإجراء.')) {
        try {
            const movementsToDelete = await dbActions.getFromIndex('movements', 'subscriberId', id);
            for (const movement of movementsToDelete) { await dbActions.delete('movements', movement.id); }
            await dbActions.delete('subscribers', id); showNotification('تم حذف المشترك بنجاح', 'success'); renderSubscribersPage();
        } catch (error) { showNotification('فشل حذف المشترك', 'error'); }
    }
}

async function handlePackageFormSubmit(e) {
    e.preventDefault(); const id = document.getElementById('package-id').value;
    const name = document.getElementById('package-name').value; const price = parseFloat(document.getElementById('package-price').value);
    if (!name || !price) return showNotification('يرجى ملء جميع الحقول', 'error');
    const packageData = { name, price };
    try {
        if (id) { packageData.id = parseInt(id); await dbActions.update('packages', packageData); }
        else { await dbActions.add('packages', packageData); }
        showNotification('تم حفظ الباقة بنجاح', 'success'); renderPackagesPage();
    } catch (error) { showNotification('اسم الباقة يجب أن يكون فريداً', 'error'); }
}

async function editPackage(id) {
    const pkg = await dbActions.get('packages', id);
    document.getElementById('package-id').value = pkg.id; document.getElementById('package-name').value = pkg.name; document.getElementById('package-price').value = pkg.price;
}

async function deletePackage(id) {
    if (confirm('هل أنت متأكد من حذف هذه الباقة؟')) {
        try { await dbActions.delete('packages', id); showNotification('تم حذف الباقة بنجاح', 'success'); renderPackagesPage(); }
        catch (error) { showNotification('فشل حذف الباقة', 'error'); }
    }
}

// =================================================================================
// 5. DATA MANAGEMENT (IMPORT/EXPORT)
// =================================================================================
async function exportData() {
    try {
        const data = { subscribers: await dbActions.getAll('subscribers'), packages: await dbActions.getAll('packages'), movements: await dbActions.getAll('movements') };
        const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' });
        const a = document.createElement('a'); a.href = URL.createObjectURL(blob); a.download = `backup-${new Date().toISOString().slice(0, 10)}.json`;
        a.click(); URL.revokeObjectURL(a.href); showNotification('تم تصدير البيانات بنجاح', 'success');
    } catch (error) { showNotification('فشل تصدير البيانات', 'error'); }
}

async function importData(event) {
    const file = event.target.files[0]; if (!file) return;
    if (!confirm('تحذير: سيؤدي هذا إلى مسح جميع البيانات الحالية واستبدالها بالبيانات من الملف. هل أنت متأكد؟')) return;
    const reader = new FileReader();
    reader.onload = async (e) => {
        try {
            loader.style.display = 'flex'; const data = JSON.parse(e.target.result);
            if (!data.subscribers || !data.packages || !data.movements) throw new Error("Invalid file format");
            await Promise.all([dbActions.clear('movements'), dbActions.clear('subscribers'), dbActions.clear('packages')]);
            await Promise.all([ ...data.packages.map(item => dbActions.add('packages', item)), ...data.subscribers.map(item => dbActions.add('subscribers', item)), ...data.movements.map(item => dbActions.add('movements', item))]);
            showNotification('تم استيراد البيانات بنجاح!', 'success'); navigateTo('#dashboard');
        } catch (error) { showNotification('فشل استيراد الملف. تأكد أنه ملف صحيح.', 'error'); } finally { loader.style.display = 'none'; }
    };
    reader.readAsText(file);
}

// =================================================================================
// 6. APP INITIALIZATION & EVENT LISTENERS
// =================================================================================
function navigateTo(hash) {
    loader.style.display = 'flex';
    const cleanHash = hash.split('?')[0] || '#dashboard';
    document.querySelectorAll('.nav-link').forEach(link => { link.classList.toggle('active', link.getAttribute('href') === cleanHash); });
    let renderPromise;
    switch (cleanHash) {
        case '#subscribers': renderPromise = renderSubscribersPage(); break;
        case '#packages': renderPromise = renderPackagesPage(); break;
        case '#settings': renderPromise = renderSettingsPage(); break;
        case '#how-to-use': renderPromise = renderHowToUsePage(); break;
        case '#about': renderPromise = renderAboutPage(); break;
        case '#support': renderPromise = renderSupportPage(); break;
        default: renderPromise = renderDashboard(); break;
    }
    renderPromise.catch(console.error).finally(() => loader.style.display = 'none');
}
function toggleTheme(e) {
    const isDark = e.target.checked;
    document.body.classList.toggle('dark-mode', isDark);
    localStorage.setItem('theme', isDark ? 'dark' : 'light');
    document.getElementById('theme-text').textContent = isDark ? 'الوضع النهاري' : 'الوضع الليلي';
    navigateTo(window.location.hash);
}
function applySavedTheme() {
    const savedTheme = localStorage.getItem('theme');
    const isDark = savedTheme === 'dark';
    document.body.classList.toggle('dark-mode', isDark);
    document.getElementById('theme-toggle-checkbox').checked = isDark;
    document.getElementById('theme-text').textContent = isDark ? 'الوضع النهاري' : 'الوضع الليلي';
}
function toggleSidebar() { document.body.classList.toggle('sidebar-collapsed'); }
function setupEventListeners() {
    window.addEventListener('hashchange', () => navigateTo(window.location.hash));
    document.getElementById('theme-toggle-checkbox').addEventListener('change', toggleTheme);
    document.getElementById('toggle-sidebar').addEventListener('click', toggleSidebar);
}

document.addEventListener('DOMContentLoaded', async () => {
    loader.style.display = 'flex';
    try { await initDB(); applySavedTheme(); setupEventListeners(); navigateTo(window.location.hash); }
    catch (error) { console.error('Initialization failed:', error); showNotification('فشل تهيئة التطبيق', 'error'); }
});