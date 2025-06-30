// app.js - Final Version
document.addEventListener('DOMContentLoaded', () => {
    
    /**
     * The main application module.
     * Encapsulates all state, elements, and logic.
     */
    const App = {
        // --- DOM Elements Cache ---
        elements: {
            body: document.body,
            loader: document.getElementById('loader'),
            notificationContainer: document.getElementById('notification-container'),
            sidebar: document.getElementById('sidebar'),
            mainContent: document.getElementById('main-content'),
            header: document.getElementById('header'),
            sidebarToggleBtn: document.getElementById('sidebar-toggle-btn'),
            themeToggleBtn: document.getElementById('theme-toggle-btn'),
            navLinks: document.querySelectorAll('.nav-link'),
            modalContainer: document.getElementById('modal-container'),
            modalBody: document.getElementById('modal-body'),
            modalCloseBtn: document.getElementById('modal-close-btn'),
            addSubscriberBtn: document.getElementById('add-subscriber-btn'),
            globalSearchInput: document.getElementById('global-search-input'),
            appLogoText: document.getElementById('app-logo-text'),
            pages: {
                dashboard: document.getElementById('page-dashboard'),
                subscribers: document.getElementById('page-subscribers'),
                packages: document.getElementById('page-packages'),
                reports: document.getElementById('page-reports'),
                settings: document.getElementById('page-settings'),
                howToUse: document.getElementById('page-how-to-use'),
                about: document.getElementById('page-about'),
            }
        },

        // --- Application State and Data Cache ---
        state: {
            db: null,
            charts: {},
            currentPage: 'dashboard',
            subscribersCache: [],
            packagesCache: [],
            movementsCache: []
        },

        // --- INITIALIZER ---
        init() {
            this.registerServiceWorker();
            this.initTheme();
            this.initEventListeners();
            this.DB.init().then(db => {
                this.state.db = db;
                this.loadInitialData().then(() => {
                    this.loadSettings();
                    this.router();
                });
            }).catch(err => {
                console.error("Database initialization failed:", err);
                this.showNotification('فشل في تهيئة قاعدة البيانات!', 'error');
            });
        },

        // --- DATA MANAGEMENT ---
        async loadInitialData() {
            this.showLoader();
            try {
                // Fetch all data in parallel for performance
                [this.state.subscribersCache, this.state.packagesCache, this.state.movementsCache] = await Promise.all([
                    this.DB.getAll('subscribers'),
                    this.DB.getAll('packages'),
                    this.DB.getAll('movements')
                ]);
            } catch (error) {
                console.error("Failed to load initial data:", error);
                this.showNotification('فشل في تحميل البيانات الأولية', 'error');
            } finally {
                this.hideLoader();
            }
        },

        async refreshData() {
            await this.loadInitialData();
            // Re-render the current page with the fresh data
            this.Render.rerenderCurrentPage();
        },

        // --- PWA & SERVICE WORKER ---
        registerServiceWorker() {
            if ('serviceWorker' in navigator) {
                navigator.serviceWorker.register('/sw.js')
                    .then(() => console.log('Service Worker registered successfully.'))
                    .catch(error => console.error('Service Worker registration failed:', error));
            }
        },

        // --- THEME MANAGER ---
        initTheme() {
            const savedTheme = localStorage.getItem('theme') || 'light';
            this.elements.body.className = `${savedTheme}-mode`;
            this.elements.themeToggleBtn.querySelector('i').className = savedTheme === 'light' ? 'fas fa-moon' : 'fas fa-sun';
        },

        toggleTheme() {
            const isDark = this.elements.body.classList.contains('dark-mode');
            const newTheme = isDark ? 'light' : 'dark';
            this.elements.body.className = `${newTheme}-mode`;
            localStorage.setItem('theme', newTheme);
            this.elements.themeToggleBtn.querySelector('i').className = newTheme === 'light' ? 'fas fa-moon' : 'fas fa-sun';
            this.Render.rerenderCurrentPage(); // Re-render to apply new chart colors
        },

        // --- EVENT LISTENERS ---
        initEventListeners() {
            window.addEventListener('hashchange', () => this.router());
            this.elements.sidebarToggleBtn.addEventListener('click', () => this.elements.body.classList.toggle('sidebar-collapsed'));
            this.elements.themeToggleBtn.addEventListener('click', () => this.toggleTheme());
            this.elements.modalCloseBtn.addEventListener('click', () => this.closeModal());
            this.elements.modalContainer.addEventListener('click', (e) => {
                if (e.target === this.elements.modalContainer) this.closeModal();
            });
            this.elements.addSubscriberBtn.addEventListener('click', () => this.Render.renderSubscriberModal());
            
            // Debounced search handler
            let searchTimeout;
            this.elements.globalSearchInput.addEventListener('input', (e) => {
                clearTimeout(searchTimeout);
                searchTimeout = setTimeout(() => {
                    this.handleGlobalSearch(e.target.value.trim());
                }, 300);
            });
        },
        
        handleGlobalSearch(term) {
            if (this.state.currentPage !== 'subscribers') {
                window.location.hash = '#subscribers';
            }
            this.Render.renderSubscribers('all', term);
        },

        // --- ROUTER ---
        router() {
            const newPage = window.location.hash.slice(1) || 'dashboard';
            // Only re-render if the page has changed
            if (this.state.currentPage === newPage && this.elements.pages[newPage] && !this.elements.pages[newPage].classList.contains('hidden')) {
                return;
            }
            this.state.currentPage = newPage;
            
            Object.values(this.elements.pages).forEach(page => page.classList.add('hidden'));
            
            this.elements.navLinks.forEach(link => {
                link.classList.remove('active');
                if (link.getAttribute('href') === `#${this.state.currentPage}`) {
                    link.classList.add('active');
                }
            });

            const pageElement = this.elements.pages[this.state.currentPage];
            if (pageElement) {
                pageElement.classList.remove('hidden');
                this.Render.rerenderCurrentPage();
            } else { // Fallback to dashboard for invalid hashes
                window.location.hash = '#dashboard';
            }
        },

        // --- UI HELPERS (Loader, Notifications, Modal) ---
        showLoader() { this.elements.loader.classList.remove('hidden'); },
        hideLoader() { this.elements.loader.classList.add('hidden'); },

        showNotification(message, type = 'success') {
            const notification = document.createElement('div');
            notification.className = `notification ${type}`;
            notification.innerHTML = `<i class="fas ${type === 'success' ? 'fa-check-circle' : 'fa-times-circle'}"></i> ${message}`;
            this.elements.notificationContainer.appendChild(notification);
            setTimeout(() => {
                notification.style.opacity = '0';
                notification.addEventListener('transitionend', () => notification.remove());
            }, 4000);
        },

        showModal() { this.elements.modalContainer.classList.remove('hidden'); },
        closeModal() { this.elements.modalContainer.classList.add('hidden'); this.elements.modalBody.innerHTML = ''; },
        
        async loadSettings() {
            const settings = await this.DB.get('settings', 'appSettings');
            if (settings && settings.companyName) {
                this.elements.appLogoText.textContent = settings.companyName;
                document.title = settings.companyName;
            }
        },
        
        // --- DATABASE MODULE ---
        DB: {
            db: null,
            init() {
                return new Promise((resolve, reject) => {
                    const request = indexedDB.open('InternetManagerDB_v3', 3);
                    request.onerror = (e) => reject(`Database error: ${e.target.errorCode}`);
                    request.onsuccess = (e) => { this.db = e.target.result; resolve(this.db); };
                    request.onupgradeneeded = (e) => {
                        const db = e.target.result;
                        if (!db.objectStoreNames.contains('subscribers')) {
                            const subscribersStore = db.createObjectStore('subscribers', { keyPath: 'id', autoIncrement: true });
                            subscribersStore.createIndex('name_idx', 'name', { unique: false });
                            subscribersStore.createIndex('phone_idx', 'phone', { unique: true });
                        }
                        if (!db.objectStoreNames.contains('packages')) {
                            const packagesStore = db.createObjectStore('packages', { keyPath: 'id', autoIncrement: true });
                            packagesStore.createIndex('name_idx', 'name', { unique: true });
                        }
                        if (!db.objectStoreNames.contains('movements')) {
                            const movementsStore = db.createObjectStore('movements', { keyPath: 'id', autoIncrement: true });
                            movementsStore.createIndex('subscriberId_idx', 'subscriberId', { unique: false });
                            movementsStore.createIndex('timestamp_idx', 'timestamp', { unique: false });
                        }
                        if (!db.objectStoreNames.contains('settings')) {
                            db.createObjectStore('settings', { keyPath: 'key' });
                        }
                    };
                });
            },
            add(storeName, item) { return new Promise((resolve, reject) => { const req = this.db.transaction(storeName, 'readwrite').objectStore(storeName).add(item); req.onsuccess = () => resolve(req.result); req.onerror = (e) => reject(e.target.error); }); },
            get(storeName, key) { return new Promise((resolve, reject) => { const req = this.db.transaction(storeName, 'readonly').objectStore(storeName).get(key); req.onsuccess = () => resolve(req.result); req.onerror = (e) => reject(e.target.error); }); },
            getAll(storeName) { return new Promise((resolve, reject) => { const req = this.db.transaction(storeName, 'readonly').objectStore(storeName).getAll(); req.onsuccess = () => resolve(req.result); req.onerror = (e) => reject(e.target.error); }); },
            put(storeName, item) { return new Promise((resolve, reject) => { const req = this.db.transaction(storeName, 'readwrite').objectStore(storeName).put(item); req.onsuccess = () => resolve(req.result); req.onerror = (e) => reject(e.target.error); }); },
            delete(storeName, key) { return new Promise((resolve, reject) => { const req = this.db.transaction(storeName, 'readwrite').objectStore(storeName).delete(key); req.onsuccess = () => resolve(); req.onerror = (e) => reject(e.target.error); }); },
        },
        
        // --- RENDERER MODULE ---
        Render: {
            rerenderCurrentPage() {
                App.showLoader();
                const renderFunction = `render${App.state.currentPage.charAt(0).toUpperCase() + App.state.currentPage.slice(1)}`;
                if (typeof this[renderFunction] === 'function') {
                    this[renderFunction]();
                }
                App.hideLoader();
            },

            getChartColors() {
                const isDark = App.elements.body.classList.contains('dark-mode');
                return {
                    textColor: isDark ? '#e0e0e0' : '#333',
                    gridColor: isDark ? 'rgba(255, 255, 255, 0.1)' : 'rgba(0, 0, 0, 0.1)',
                    backgroundColor: ['#3e95cd', '#8e5ea2', '#3cba9f', '#e8c3b9', '#c45850', '#ffb347', '#77dd77']
                };
            },
            
            getSubscriberStatus(subscriberId) {
                const lastActivation = App.state.movementsCache
                    .filter(m => m.subscriberId === subscriberId && m.type === 'تفعيل')
                    .sort((a, b) => new Date(b.timestamp) - new Date(a.timestamp))[0];

                if (!lastActivation || !lastActivation.endDate) {
                    return { text: 'جديد', key: 'new', className: 'status-new' };
                }

                const endDate = new Date(lastActivation.endDate);
                const today = new Date();
                today.setHours(0, 0, 0, 0);
                const diffTime = endDate.getTime() - today.getTime();
                const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));

                if (diffDays < 0) return { text: 'منتهي', key: 'expired', className: 'status-expired' };
                if (diffDays <= 3) return { text: `سينتهي قريباً`, key: 'expiring-soon', className: 'status-expiring-soon' };
                return { text: 'فعّال', key: 'active', className: 'status-active' };
            },

            renderDashboard() {
                const { subscribersCache, packagesCache, movementsCache } = App.state;
                const colors = this.getChartColors();

                const totalSubscribers = subscribersCache.length;
                let activeSubscribersCount = 0;
                let totalDebt = subscribersCache.reduce((sum, s) => sum + (s.debt || 0), 0);
                
                subscribersCache.forEach(s => {
                    const status = this.getSubscriberStatus(s.id);
                    if (status.key === 'active' || status.key === 'expiring-soon') activeSubscribersCount++;
                });

                const now = new Date();
                const expectedRevenue = movementsCache
                    .filter(m => {
                        const moveDate = new Date(m.timestamp);
                        return m.type === 'تفعيل' && moveDate.getMonth() === now.getMonth() && moveDate.getFullYear() === now.getFullYear();
                    })
                    .reduce((sum, m) => sum + m.amount, 0);

                const html = `
                    <div class="page-header"><h1>لوحة التحكم</h1></div>
                    <div class="stats-grid">
                        <div class="card stat-card"><i class="fas fa-users"></i><div class="stat-card-info"><h4>إجمالي المشتركين</h4><p>${totalSubscribers}</p></div></div>
                        <div class="card stat-card"><i class="fas fa-user-check"></i><div class="stat-card-info"><h4>المشتركون الفعّالون</h4><p>${activeSubscribersCount}</p></div></div>
                        <div class="card stat-card"><i class="fas fa-file-invoice-dollar"></i><div class="stat-card-info"><h4>إجمالي الديون</h4><p>${totalDebt.toLocaleString()}</p></div></div>
                        <div class="card stat-card"><i class="fas fa-chart-line"></i><div class="stat-card-info"><h4>إيرادات الشهر</h4><p>${expectedRevenue.toLocaleString()}</p></div></div>
                    </div>
                    <div class="charts-grid" style="display: grid; grid-template-columns: repeat(auto-fit, minmax(300px, 1fr)); gap: 20px; margin-top: 20px;">
                        <div class="card"><h3>الاشتراكات الجديدة (آخر 6 أشهر)</h3><canvas id="newSubsChart"></canvas></div>
                        <div class="card"><h3>توزيع المشتركين على الباقات</h3><canvas id="packagesPieChart"></canvas></div>
                    </div>
                `;
                App.elements.pages.dashboard.innerHTML = html;

                // Bar Chart
                const barChartLabels = [];
                const barChartData = [];
                for (let i = 5; i >= 0; i--) {
                    const d = new Date();
                    d.setMonth(d.getMonth() - i);
                    barChartLabels.push(d.toLocaleString('ar', { month: 'long' }));
                    const count = movementsCache.filter(m => {
                        const moveDate = new Date(m.timestamp);
                        return m.type === 'تفعيل' && moveDate.getMonth() === d.getMonth() && moveDate.getFullYear() === d.getFullYear();
                    }).length;
                    barChartData.push(count);
                }
                if(App.state.charts.bar) App.state.charts.bar.destroy();
                App.state.charts.bar = new Chart(document.getElementById('newSubsChart'), { type: 'bar', data: { labels: barChartLabels, datasets: [{ label: 'اشتراك جديد', data: barChartData, backgroundColor: '#3e95cd' }] }, options: { scales: { y: { beginAtZero: true, ticks: { color: colors.textColor, stepSize: 1 } }, x: { ticks: { color: colors.textColor } } }, plugins: { legend: { labels: { color: colors.textColor } } } } });

                // Pie Chart
                const pieData = {};
                packagesCache.forEach(p => pieData[p.name] = 0);
                subscribersCache.forEach(s => {
                    const lastActivation = movementsCache.filter(m => m.subscriberId === s.id && m.type === 'تفعيل').sort((a,b) => new Date(b.timestamp) - new Date(a.timestamp))[0];
                    if(lastActivation && (this.getSubscriberStatus(s.id).key === 'active' || this.getSubscriberStatus(s.id).key === 'expiring-soon')) {
                        if(pieData[lastActivation.packageName] !== undefined) pieData[lastActivation.packageName]++;
                    }
                });
                if(App.state.charts.pie) App.state.charts.pie.destroy();
                App.state.charts.pie = new Chart(document.getElementById('packagesPieChart'), { type: 'pie', data: { labels: Object.keys(pieData), datasets: [{ data: Object.values(pieData), backgroundColor: colors.backgroundColor }] }, options: { plugins: { legend: { position: 'bottom', labels: { color: colors.textColor } } } } });
            },

            renderSubscribers(filter = 'all', searchTerm = '') {
                let filteredSubscribers = App.state.subscribersCache;

                if (searchTerm) {
                    filteredSubscribers = filteredSubscribers.filter(s => s.name.toLowerCase().includes(searchTerm.toLowerCase()) || s.phone.includes(searchTerm));
                }
                if (filter !== 'all') {
                    filteredSubscribers = filteredSubscribers.filter(s => this.getSubscriberStatus(s.id).key === filter);
                }

                const tableRows = filteredSubscribers.map(s => {
                    const status = this.getSubscriberStatus(s.id);
                    return `
                        <tr>
                            <td><input type="checkbox" class="subscriber-checkbox" data-id="${s.id}"></td>
                            <td>${s.name}</td>
                            <td><a href="https://wa.me/964${s.phone.slice(1)}" target="_blank">${s.phone} <i class="fab fa-whatsapp" style="color: #25D366;"></i></a></td>
                            <td>${(s.debt || 0).toLocaleString()}</td>
                            <td><span class="status-badge ${status.className}">${status.text}</span></td>
                            <td class="actions-cell">
                                <button class="icon-btn" onclick="App.Render.renderSubscriberModal(${s.id})"><i class="fas fa-eye"></i></button>
                            </td>
                        </tr>
                    `;
                }).join('');

                const html = `
                    <div class="page-header">
                        <h1>المشتركون (${filteredSubscribers.length})</h1>
                        <div class="actions" id="subscriber-filters">
                            <button class="btn btn-secondary ${filter === 'all' ? 'active' : ''}" data-filter="all">الكل</button>
                            <button class="btn btn-secondary ${filter === 'active' ? 'active' : ''}" data-filter="active">فعال</button>
                            <button class="btn btn-secondary ${filter === 'expiring-soon' ? 'active' : ''}" data-filter="expiring-soon">سينتهي قريباً</button>
                            <button class="btn btn-secondary ${filter === 'expired' ? 'active' : ''}" data-filter="expired">منتهي</button>
                        </div>
                    </div>
                    <div class="card">
                        <div class="table-container">
                            <table>
                                <thead><tr>
                                    <th><input type="checkbox" id="select-all-checkbox"></th>
                                    <th>الاسم</th><th>الهاتف</th><th>الدين</th><th>الحالة</th><th>إجراءات</th>
                                </tr></thead>
                                <tbody>${tableRows || `<tr><td colspan="6" style="text-align:center;">لا يوجد مشتركين لعرضهم.</td></tr>`}</tbody>
                            </table>
                        </div>
                    </div>
                `;
                App.elements.pages.subscribers.innerHTML = html;
                
                App.elements.pages.subscribers.querySelector('#subscriber-filters').addEventListener('click', (e) => {
                    if (e.target.matches('button[data-filter]')) {
                        this.renderSubscribers(e.target.dataset.filter, searchTerm);
                    }
                });
            },

            async renderSubscriberModal(subscriberId = null) {
                const isNew = subscriberId === null;
                let subscriber = { name: '', phone: '', debt: 0, notes: '' };
                if (!isNew) {
                    subscriber = App.state.subscribersCache.find(s => s.id === subscriberId);
                }

                const packagesOptions = App.state.packagesCache.map(p => `<option value="${p.id}">${p.name} - ${p.price.toLocaleString()} د.ع</option>`).join('');

                const modalHTML = `
                    <div class="modal-header"><h3>${isNew ? 'إضافة مشترك جديد' : `تفاصيل: ${subscriber.name}`}</h3></div>
                    <div class="modal-body">
                        <div class="tabs">
                            <button class="tab-btn active" data-tab="info">البيانات</button>
                            <button class="tab-btn" data-tab="action" ${isNew ? 'disabled' : ''}>تفعيل / تسديد</button>
                            <button class="tab-btn" data-tab="history" ${isNew ? 'disabled' : ''}>السجل</button>
                        </div>
                        <div id="tab-info" class="tab-content active"><form id="subscriber-form">...</form></div>
                        <div id="tab-action" class="tab-content"><form id="action-form">...</form></div>
                        <div id="tab-history" class="tab-content">...</div>
                    </div>
                `;
                App.elements.modalBody.innerHTML = modalHTML;

                // --- Populate Tabs ---
                // Info Tab
                document.getElementById('tab-info').innerHTML = `
                    <form id="subscriber-form">
                        <input type="hidden" id="subscriber-id" value="${subscriberId || ''}">
                        <div class="form-group"><label for="name">الاسم الكامل</label><input type="text" id="name" class="form-control" value="${subscriber.name}" required></div>
                        <div class="form-group"><label for="phone">رقم الهاتف (07...)</label><input type="tel" id="phone" class="form-control" value="${subscriber.phone}" required pattern="07[0-9]{9}"></div>
                        <div class="form-group"><label for="debt">الدين الحالي</label><input type="number" id="debt" class="form-control" value="${subscriber.debt}"></div>
                        <div class="form-group"><label for="notes">ملاحظات</label><textarea id="notes" class="form-control">${subscriber.notes}</textarea></div>
                        <button type="submit" class="btn">${isNew ? 'حفظ المشترك' : 'تحديث البيانات'}</button>
                    </form>
                `;
                // Action Tab
                document.getElementById('tab-action').innerHTML = `
                    <form id="action-form">
                        <h4>تفعيل اشتراك</h4>
                        <div class="form-group"><label>الباقة</label><select id="package-id" class="form-control">${packagesOptions}</select></div>
                        <button type="button" class="btn" id="activate-btn">تفعيل الباقة</button>
                        <hr style="margin: 20px 0;">
                        <h4>تسديد دين</h4>
                        <div class="form-group"><label for="payment-amount">المبلغ المدفوع</label><input type="number" id="payment-amount" class="form-control" placeholder="أدخل المبلغ" required></div>
                        <button type="button" class="btn btn-secondary" id="pay-btn">تسديد المبلغ</button>
                    </form>
                `;
                // History Tab
                const historyRows = App.state.movementsCache.filter(m => m.subscriberId === subscriberId).sort((a,b) => new Date(b.timestamp) - new Date(a.timestamp)).map(m => `
                    <tr>
                        <td>${new Date(m.timestamp).toLocaleDateString('ar-IQ')}</td>
                        <td>${m.type}</td>
                        <td>${m.amount.toLocaleString()}</td>
                        <td>${m.note || '-'}</td>
                    </tr>
                `).join('');
                document.getElementById('tab-history').innerHTML = `<div class="table-container"><table><thead><tr><th>التاريخ</th><th>النوع</th><th>المبلغ</th><th>ملاحظات</th></tr></thead><tbody>${historyRows || `<tr><td colspan="4" style="text-align:center;">لا يوجد حركات.</td></tr>`}</tbody></table></div>`;

                // --- Event Listeners ---
                const tabBtns = App.elements.modalBody.querySelectorAll('.tab-btn');
                const tabContents = App.elements.modalBody.querySelectorAll('.tab-content');
                tabBtns.forEach(btn => btn.addEventListener('click', () => {
                    tabBtns.forEach(b => b.classList.remove('active'));
                    btn.classList.add('active');
                    tabContents.forEach(c => c.classList.remove('active'));
                    document.getElementById(`tab-${btn.dataset.tab}`).classList.add('active');
                }));
                
                document.getElementById('subscriber-form').addEventListener('submit', async (e) => {
                    e.preventDefault();
                    App.showLoader();
                    const data = {
                        name: document.getElementById('name').value, phone: document.getElementById('phone').value,
                        debt: parseInt(document.getElementById('debt').value) || 0, notes: document.getElementById('notes').value
                    };
                    try {
                        if (isNew) { await App.DB.add('subscribers', data); App.showNotification('تمت إضافة المشترك', 'success'); }
                        else { data.id = subscriberId; await App.DB.put('subscribers', data); App.showNotification('تم تحديث البيانات', 'success'); }
                        App.closeModal(); await App.refreshData();
                    } catch (err) { App.showNotification('فشل الحفظ، قد يكون رقم الهاتف مكرر', 'error'); } finally { App.hideLoader(); }
                });

                if (!isNew) {
                    document.getElementById('activate-btn').addEventListener('click', async () => {
                        const packageId = parseInt(document.getElementById('package-id').value);
                        const pkg = App.state.packagesCache.find(p => p.id === packageId);
                        if (!pkg) { App.showNotification('الرجاء اختيار باقة صالحة', 'error'); return; }
                        
                        const newDebt = (subscriber.debt || 0) + pkg.price;
                        const movement = {
                            subscriberId, type: 'تفعيل', packageName: pkg.name, amount: pkg.price,
                            timestamp: new Date().toISOString(), note: `تفعيل باقة ${pkg.name}`,
                            startDate: new Date().toISOString(),
                            endDate: new Date(new Date().setDate(new Date().getDate() + 30)).toISOString()
                        };
                        
                        App.showLoader();
                        try {
                            await App.DB.add('movements', movement);
                            await App.DB.put('subscribers', { ...subscriber, debt: newDebt });
                            App.showNotification('تم تفعيل الباقة بنجاح', 'success');
                            App.closeModal(); await App.refreshData();
                        } catch(err) { App.showNotification('فشل تفعيل الباقة', 'error'); } finally { App.hideLoader(); }
                    });

                    document.getElementById('pay-btn').addEventListener('click', async () => {
                        const amount = parseInt(document.getElementById('payment-amount').value);
                        if (!amount || amount <= 0) { App.showNotification('الرجاء إدخال مبلغ صحيح', 'error'); return; }

                        const newDebt = (subscriber.debt || 0) - amount;
                        const movement = {
                            subscriberId, type: 'تسديد', amount: amount,
                            timestamp: new Date().toISOString(), note: `تسديد مبلغ`
                        };
                        
                        App.showLoader();
                        try {
                            await App.DB.add('movements', movement);
                            await App.DB.put('subscribers', { ...subscriber, debt: newDebt });
                            App.showNotification('تم تسجيل الدفعة بنجاح', 'success');
                            App.closeModal(); await App.refreshData();
                        } catch(err) { App.showNotification('فشل تسجيل الدفعة', 'error'); } finally { App.hideLoader(); }
                    });
                }

                App.showModal();
            },

            renderPackages() {
                const tableRows = App.state.packagesCache.map(p => `
                    <tr>
                        <td>${p.name}</td>
                        <td>${p.price.toLocaleString()}</td>
                        <td>${p.cost.toLocaleString()}</td>
                        <td>${(p.price - p.cost).toLocaleString()}</td>
                        <td><button class="icon-btn btn-danger" onclick="App.Actions.deletePackage(${p.id})"><i class="fas fa-trash"></i></button></td>
                    </tr>
                `).join('');

                const html = `
                    <div class="page-header"><h1>إدارة الباقات</h1></div>
                    <div style="display: grid; grid-template-columns: 1fr 2fr; gap: 20px;">
                        <div class="card">
                            <h3>إضافة باقة جديدة</h3>
                            <form id="package-form">
                                <div class="form-group"><label>اسم الباقة</label><input type="text" id="package-name" class="form-control" required></div>
                                <div class="form-group"><label>سعر البيع</label><input type="number" id="package-price" class="form-control" required></div>
                                <div class="form-group"><label>التكلفة</label><input type="number" id="package-cost" class="form-control" required></div>
                                <button type="submit" class="btn">إضافة</button>
                            </form>
                        </div>
                        <div class="card">
                            <h3>الباقات الحالية</h3>
                            <table><thead><tr><th>الاسم</th><th>السعر</th><th>التكلفة</th><th>الربح الصافي</th><th>حذف</th></tr></thead><tbody>${tableRows}</tbody></table>
                        </div>
                    </div>
                `;
                App.elements.pages.packages.innerHTML = html;

                document.getElementById('package-form').addEventListener('submit', async (e) => {
                    e.preventDefault();
                    App.showLoader();
                    const data = { name: document.getElementById('package-name').value, price: parseInt(document.getElementById('package-price').value), cost: parseInt(document.getElementById('package-cost').value) };
                    try { await App.DB.add('packages', data); App.showNotification('تمت إضافة الباقة', 'success'); await App.refreshData(); }
                    catch { App.showNotification('فشل الإضافة، قد يكون الاسم مكرراً', 'error'); }
                    finally { App.hideLoader(); }
                });
            },

            renderReports() {
                const html = `
                    <div class="page-header"><h1>التقارير المالية</h1></div>
                    <div class="card">
                        <form id="report-form">
                            <label for="start-date">من تاريخ:</label>
                            <input type="date" id="start-date" class="form-control">
                            <label for="end-date">إلى تاريخ:</label>
                            <input type="date" id="end-date" class="form-control">
                            <button type="submit" class="btn">توليد التقرير</button>
                        </form>
                    </div>
                    <div id="report-output" class="card" style="display:none;"></div>
                `;
                App.elements.pages.reports.innerHTML = html;

                document.getElementById('report-form').addEventListener('submit', (e) => {
                    e.preventDefault();
                    const startDate = new Date(document.getElementById('start-date').value);
                    const endDate = new Date(document.getElementById('end-date').value);
                    if (!startDate || !endDate) return;
                    endDate.setHours(23, 59, 59, 999); // Include the whole end day

                    const relevantMovements = App.state.movementsCache.filter(m => {
                        const moveDate = new Date(m.timestamp);
                        return moveDate >= startDate && moveDate <= endDate;
                    });

                    const revenue = relevantMovements.filter(m => m.type === 'تسديد').reduce((sum, m) => sum + m.amount, 0);
                    const activations = relevantMovements.filter(m => m.type === 'تفعيل');
                    const costs = activations.reduce((sum, m) => {
                        const pkg = App.state.packagesCache.find(p => p.name === m.packageName);
                        return sum + (pkg ? pkg.cost : 0);
                    }, 0);
                    const netProfit = revenue - costs;

                    document.getElementById('report-output').style.display = 'block';
                    document.getElementById('report-output').innerHTML = `
                        <h3>تقرير الفترة من ${startDate.toLocaleDateString('ar-IQ')} إلى ${endDate.toLocaleDateString('ar-IQ')}</h3>
                        <p><strong>إجمالي الإيرادات (التسديدات):</strong> ${revenue.toLocaleString()} د.ع</p>
                        <p><strong>إجمالي التكاليف (الباقات المفعلة):</strong> ${costs.toLocaleString()} د.ع</p>
                        <p><strong>صافي الربح:</strong> ${netProfit.toLocaleString()} د.ع</p>
                        <p><strong>عدد الاشتراكات الجديدة:</strong> ${activations.length}</p>
                    `;
                });
            },

            async renderSettings() {
                const settings = await App.DB.get('settings', 'appSettings') || {};
                const html = `
                    <div class="page-header"><h1>الإعدادات</h1></div>
                    <div class="card">
                        <h3>ملف تعريف الشركة</h3>
                        <form id="settings-form">
                            <div class="form-group"><label>اسم الشركة/الشبكة</label><input type="text" id="company-name" class="form-control" value="${settings.companyName || ''}"></div>
                            <button type="submit" class="btn">حفظ الإعدادات</button>
                        </form>
                    </div>
                    <div class="card">
                        <h3>إدارة البيانات</h3>
                        <button id="export-data" class="btn">تصدير البيانات (JSON)</button>
                        <input type="file" id="import-file" accept=".json" style="display:none;">
                        <button id="import-data" class="btn btn-secondary">استيراد البيانات (JSON)</button>
                    </div>
                `;
                App.elements.pages.settings.innerHTML = html;

                document.getElementById('settings-form').addEventListener('submit', async (e) => {
                    e.preventDefault();
                    const companyName = document.getElementById('company-name').value;
                    await App.DB.put('settings', { key: 'appSettings', companyName });
                    App.showNotification('تم حفظ الإعدادات', 'success');
                    await App.loadSettings();
                });

                document.getElementById('export-data').addEventListener('click', async () => {
                    const data = {
                        subscribers: App.state.subscribersCache,
                        packages: App.state.packagesCache,
                        movements: App.state.movementsCache,
                        settings: await App.DB.getAll('settings')
                    };
                    const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' });
                    const url = URL.createObjectURL(blob);
                    const a = document.createElement('a');
                    a.href = url;
                    a.download = `internet_manager_backup_${new Date().toISOString().slice(0,10)}.json`;
                    a.click();
                    URL.revokeObjectURL(url);
                });

                document.getElementById('import-data').addEventListener('click', () => document.getElementById('import-file').click());
                document.getElementById('import-file').addEventListener('change', (e) => {
                    if (!confirm('سيؤدي هذا إلى الكتابة فوق جميع بياناتك الحالية. هل أنت متأكد؟')) return;
                    const file = e.target.files[0];
                    if (!file) return;
                    const reader = new FileReader();
                    reader.onload = async (event) => {
                        try {
                            const data = JSON.parse(event.target.result);
                            App.showLoader();
                            for (const storeName in data) {
                                const storeData = data[storeName];
                                if (Array.isArray(storeData)) {
                                    const tx = App.DB.db.transaction(storeName, 'readwrite');
                                    await tx.objectStore(storeName).clear();
                                    for(const item of storeData) {
                                        await tx.objectStore(storeName).put(item);
                                    }
                                }
                            }
                            App.showNotification('تم استيراد البيانات بنجاح!', 'success');
                            await App.refreshData();
                        } catch (err) { App.showNotification('فشل استيراد الملف. تأكد من أنه ملف صالح.', 'error'); }
                        finally { App.hideLoader(); }
                    };
                    reader.readAsText(file);
                });
            },

            renderHowToUse() { App.elements.pages.howToUse.innerHTML = `<div class="card"><h1>كيفية الاستخدام</h1><p>هنا تجد شرحاً لكيفية استخدام النظام...</p></div>`; },
            renderAbout() { App.elements.pages.about.innerHTML = `<div class="card"><h1>حول التطبيق</h1><p>نظام إدارة اشتراكات الإنترنت (نسخة احترافية)...</p></div>`; }
        },

        // --- ACTIONS MODULE (for onclick handlers) ---
        Actions: {
            async deletePackage(id) {
                if(confirm('هل أنت متأكد من حذف هذه الباقة؟ لا يمكن التراجع عن هذا الإجراء.')) {
                    App.showLoader();
                    try {
                        await App.DB.delete('packages', id);
                        App.showNotification('تم حذف الباقة', 'success');
                        await App.refreshData();
                    } catch(err) {
                        App.showNotification('فشل حذف الباقة', 'error');
                    } finally {
                        App.hideLoader();
                    }
                }
            }
        }
    };
    
    // Expose Actions to global scope for onclick handlers
    window.App = {
        Actions: App.Actions,
        Render: App.Render // Expose for inline calls if needed
    };

    App.init(); // Start the application
});
