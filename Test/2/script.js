// app.js
document.addEventListener('DOMContentLoaded', () => {
    // --- APP INITIALIZATION ---
    const App = {
        // --- DOM ELEMENTS ---
        elements: {
            loader: document.getElementById('loader'),
            notificationContainer: document.getElementById('notification-container'),
            sidebar: document.getElementById('sidebar'),
            mainContent: document.getElementById('main-content'),
            sidebarToggleBtn: document.getElementById('sidebar-toggle-btn'),
            themeToggleBtn: document.getElementById('theme-toggle-btn'),
            navLinks: document.querySelectorAll('.nav-link'),
            modalContainer: document.getElementById('modal-container'),
            modalBody: document.getElementById('modal-body'),
            modalCloseBtn: document.getElementById('modal-close-btn'),
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

        // --- STATE & DATA ---
        state: {
            db: null,
            charts: {},
        },

        // --- INITIALIZER ---
        init() {
            this.registerServiceWorker();
            this.initTheme();
            this.initEventListeners();
            this.DB.init().then(db => {
                this.state.db = db;
                this.loadSettings();
                this.router();
            }).catch(err => {
                console.error(err);
                this.showNotification('فشل في تهيئة قاعدة البيانات!', 'error');
            });
        },

        // --- PWA & SERVICE WORKER ---
        registerServiceWorker() {
            if ('serviceWorker' in navigator) {
                const swContent = `
                    const CACHE_NAME = 'internet-manager-v1';
                    const urlsToCache = [
                        '/',
                        '/index.html',
                        '/style.css',
                        '/app.js',
                        'https://cdnjs.cloudflare.com/ajax/libs/font-awesome/6.4.0/css/all.min.css',
                        'https://cdn.jsdelivr.net/npm/chart.js'
                    ];

                    self.addEventListener('install', event => {
                        event.waitUntil(
                            caches.open(CACHE_NAME).then(cache => cache.addAll(urlsToCache))
                        );
                    });

                    self.addEventListener('fetch', event => {
                        event.respondWith(
                            caches.match(event.request).then(response => {
                                return response || fetch(event.request);
                            })
                        );
                    });
                `;
                const swBlob = new Blob([swContent], { type: 'application/javascript' });
                const swUrl = URL.createObjectURL(swBlob);

                navigator.serviceWorker.register(swUrl)
                    .then(() => console.log('Service Worker registered'))
                    .catch(error => console.error('Service Worker registration failed:', error));
            }
        },

        // --- THEME MANAGER ---
        initTheme() {
            const savedTheme = localStorage.getItem('theme') || 'light';
            document.body.className = `${savedTheme}-mode`;
            this.elements.themeToggleBtn.querySelector('i').className = savedTheme === 'light' ? 'fas fa-moon' : 'fas fa-sun';
        },

        toggleTheme() {
            const isDark = document.body.classList.contains('dark-mode');
            const newTheme = isDark ? 'light' : 'dark';
            document.body.className = `${newTheme}-mode`;
            localStorage.setItem('theme', newTheme);
            this.elements.themeToggleBtn.querySelector('i').className = newTheme === 'light' ? 'fas fa-moon' : 'fas fa-sun';
            // Re-render charts with new theme colors
            this.Render.dashboard(); 
        },

        // --- EVENT LISTENERS ---
        initEventListeners() {
            window.addEventListener('hashchange', () => this.router());
            this.elements.sidebarToggleBtn.addEventListener('click', () => this.elements.sidebar.classList.toggle('collapsed'));
            this.elements.themeToggleBtn.addEventListener('click', () => this.toggleTheme());
            this.elements.modalCloseBtn.addEventListener('click', () => this.closeModal());
            this.elements.modalContainer.addEventListener('click', (e) => {
                if (e.target === this.elements.modalContainer) this.closeModal();
            });
        },

        // --- ROUTER ---
        router() {
            this.showLoader();
            const path = window.location.hash.slice(1) || 'dashboard';
            
            // Hide all pages
            Object.values(this.elements.pages).forEach(page => page.classList.add('hidden'));
            
            // Update active nav link
            this.elements.navLinks.forEach(link => {
                link.classList.remove('active');
                if (link.getAttribute('href') === `#${path}`) {
                    link.classList.add('active');
                }
            });

            const pageElement = this.elements.pages[path];
            if (pageElement) {
                pageElement.classList.remove('hidden');
                // Call the corresponding render function
                const renderFunction = `render${path.charAt(0).toUpperCase() + path.slice(1)}`;
                if (typeof this.Render[renderFunction] === 'function') {
                    this.Render[renderFunction].call(this.Render);
                } else {
                    this.hideLoader();
                }
            } else {
                this.elements.pages.dashboard.classList.remove('hidden');
                this.Render.renderDashboard();
            }
        },

        // --- UI HELPERS (Loader, Notifications, Modal) ---
        showLoader() { this.elements.loader.classList.remove('hidden'); },
        hideLoader() { this.elements.loader.classList.add('hidden'); },

        showNotification(message, type = 'success') {
            const notification = document.createElement('div');
            notification.className = `notification ${type}`;
            notification.textContent = message;
            this.elements.notificationContainer.appendChild(notification);
            setTimeout(() => notification.remove(), 3000);
        },

        showModal(content) {
            this.elements.modalBody.innerHTML = content;
            this.elements.modalContainer.classList.remove('hidden');
        },

        closeModal() {
            this.elements.modalContainer.classList.add('hidden');
            this.elements.modalBody.innerHTML = '';
        },
        
        async loadSettings() {
            const settings = await this.DB.get('settings', 'appSettings');
            if (settings && settings.companyName) {
                this.elements.appLogoText.textContent = settings.companyName;
            }
        },
        
        // --- DATABASE MODULE ---
        DB: {
            db: null,
            init() {
                return new Promise((resolve, reject) => {
                    const request = indexedDB.open('InternetManagerDB_v2', 2);
                    request.onerror = () => reject('DB Error');
                    request.onsuccess = (e) => {
                        this.db = e.target.result;
                        resolve(this.db);
                    };
                    request.onupgradeneeded = (e) => {
                        const db = e.target.result;
                        if (!db.objectStoreNames.contains('subscribers')) {
                            const subscribersStore = db.createObjectStore('subscribers', { keyPath: 'id', autoIncrement: true });
                            subscribersStore.createIndex('name', 'name', { unique: false });
                            subscribersStore.createIndex('phone', 'phone', { unique: true });
                        }
                        if (!db.objectStoreNames.contains('packages')) {
                            const packagesStore = db.createObjectStore('packages', { keyPath: 'id', autoIncrement: true });
                            packagesStore.createIndex('name', 'name', { unique: true });
                        }
                        if (!db.objectStoreNames.contains('movements')) {
                            const movementsStore = db.createObjectStore('movements', { keyPath: 'id', autoIncrement: true });
                            movementsStore.createIndex('subscriberId', 'subscriberId', { unique: false });
                        }
                        if (!db.objectStoreNames.contains('settings')) {
                            db.createObjectStore('settings', { keyPath: 'key' });
                        }
                    };
                });
            },
            
            // Generic CRUD operations
            add(storeName, item) {
                return new Promise((resolve, reject) => {
                    const transaction = this.db.transaction([storeName], 'readwrite');
                    const store = transaction.objectStore(storeName);
                    const request = store.add(item);
                    request.onsuccess = () => resolve(request.result);
                    request.onerror = (e) => reject(e.target.error);
                });
            },

            get(storeName, key) {
                return new Promise((resolve, reject) => {
                    const transaction = this.db.transaction([storeName], 'readonly');
                    const store = transaction.objectStore(storeName);
                    const request = store.get(key);
                    request.onsuccess = () => resolve(request.result);
                    request.onerror = (e) => reject(e.target.error);
                });
            },
            
            getAll(storeName) {
                return new Promise((resolve, reject) => {
                    const transaction = this.db.transaction([storeName], 'readonly');
                    const store = transaction.objectStore(storeName);
                    const request = store.getAll();
                    request.onsuccess = () => resolve(request.result);
                    request.onerror = (e) => reject(e.target.error);
                });
            },

            put(storeName, item) {
                return new Promise((resolve, reject) => {
                    const transaction = this.db.transaction([storeName], 'readwrite');
                    const store = transaction.objectStore(storeName);
                    const request = store.put(item);
                    request.onsuccess = () => resolve(request.result);
                    request.onerror = (e) => reject(e.target.error);
                });
            },

            delete(storeName, key) {
                return new Promise((resolve, reject) => {
                    const transaction = this.db.transaction([storeName], 'readwrite');
                    const store = transaction.objectStore(storeName);
                    const request = store.delete(key);
                    request.onsuccess = () => resolve();
                    request.onerror = (e) => reject(e.target.error);
                });
            },
        },
        
        // --- RENDERER MODULE ---
        Render: {
            // --- RENDER DASHBOARD ---
            async renderDashboard() {
                App.showLoader();
                try {
                    const subscribers = await App.DB.getAll('subscribers');
                    const movements = await App.DB.getAll('movements');
                    const packages = await App.DB.getAll('packages');
                    
                    // --- Calculate Stats ---
                    const totalSubscribers = subscribers.length;
                    let activeSubscribers = 0;
                    let totalDebt = 0;
                    
                    subscribers.forEach(s => {
                        totalDebt += s.debt || 0;
                        const status = this.getSubscriberStatus(s, movements);
                        if (status.key === 'active' || status.key === 'expiring-soon') {
                            activeSubscribers++;
                        }
                    });
                    
                    const html = `
                        <div class="page-header"><h1>لوحة التحكم</h1></div>
                        <div class="stats-grid">
                            </div>
                        <div class="charts-grid">
                            <div class="card"><h3>الاشتراكات الجديدة (آخر 6 أشهر)</h3><canvas id="newSubsChart"></canvas></div>
                            <div class="card"><h3>توزيع المشتركين على الباقات</h3><canvas id="packagesPieChart"></canvas></div>
                        </div>
                        <div class="card" style="margin-top: 20px;">
                            <h3>أحدث الحركات</h3>
                            <div class="table-container">
                                <table id="latest-movements-table"></table>
                            </div>
                        </div>
                    `;
                    App.elements.pages.dashboard.innerHTML = html;
                    
                    // --- Render Charts ---
                    // TODO: Implement chart rendering logic using Chart.js
                    
                } catch (err) {
                    console.error(err);
                    App.showNotification('خطأ في تحميل بيانات لوحة التحكم', 'error');
                } finally {
                    App.hideLoader();
                }
            },
            
            // --- RENDER SUBSCRIBERS ---
            async renderSubscribers(filter = 'all', searchTerm = '') {
                // TODO: Implement subscriber page rendering
            },
            
            // --- RENDER PACKAGES ---
            async renderPackages() {
                // TODO: Implement packages page rendering
            },
            
            // --- RENDER REPORTS ---
            async renderReports() {
                // TODO: Implement reports page rendering
            },
            
            // --- RENDER SETTINGS ---
            async renderSettings() {
                // TODO: Implement settings page rendering
            },
            
            // --- RENDER STATIC PAGES ---
            renderHowToUse() {
                App.elements.pages.howToUse.innerHTML = `<div class="card"><h1>كيفية الاستخدام</h1><p>شرح تفصيلي لكيفية استخدام التطبيق...</p></div>`;
                App.hideLoader();
            },
            renderAbout() {
                App.elements.pages.about.innerHTML = `<div class="card"><h1>حول التطبيق</h1><p>هذا التطبيق تم إنشاؤه لإدارة اشتراكات الإنترنت بكفاءة...</p></div>`;
                App.hideLoader();
            },

            // --- Helper to get subscriber status ---
            getSubscriberStatus(subscriber, allMovements) {
                const lastActivation = allMovements
                    .filter(m => m.subscriberId === subscriber.id && m.type === 'تفعيل')
                    .sort((a, b) => new Date(b.timestamp) - new Date(a.timestamp))[0];

                if (!lastActivation || !lastActivation.endDate) {
                    return { text: 'جديد', key: 'new' };
                }

                const endDate = new Date(lastActivation.endDate);
                const today = new Date();
                const diffTime = endDate - today;
                const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));

                if (diffDays < 0) return { text: 'منتهي', key: 'expired' };
                if (diffDays <= 3) return { text: `سينتهي بعد ${diffDays} أيام`, key: 'expiring-soon' };
                return { text: 'فعّال', key: 'active' };
            }
        }
    };

    // --- START THE APP ---
    App.init();
});