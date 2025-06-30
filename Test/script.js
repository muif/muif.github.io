document.addEventListener('DOMContentLoaded', () => {
    // تعريف متغيرات قاعدة البيانات
    let db;
    const DB_NAME = 'internetSubscriptionsDB';
    const DB_VERSION = 1;

    // عناصر الواجهة الرسومية
    const sidebar = document.getElementById('sidebar');
    const mainContent = document.getElementById('main-content');
    const menuBtn = document.getElementById('menu-btn');
    const closeSidebarBtn = document.getElementById('close-sidebar-btn');
    const navLinks = document.querySelectorAll('.nav-link');
    const pageTitle = document.getElementById('page-title');
    const pages = document.querySelectorAll('.page');

    const addSubscriberBtn = document.getElementById('add-subscriber-btn');
    const addSubscriberModal = document.getElementById('add-subscriber-modal');
    const addSubscriberForm = document.getElementById('add-subscriber-form');
    const subscribersTableBody = document.querySelector('#subscribers-table tbody');

    const packageForm = document.getElementById('package-form');
    const packagesTableBody = document.querySelector('#packages-table tbody');
    const cancelEditBtn = document.getElementById('cancel-edit-btn');
    
    const detailsModal = document.getElementById('subscriber-details-modal');
    const detailsSubscriberName = document.getElementById('details-subscriber-name');
    const detailsSubscriberPhone = document.getElementById('details-subscriber-phone');
    const detailsSubscriberDebt = document.getElementById('details-subscriber-debt');
    const movementsTableBody = document.querySelector('#movements-table tbody');
    
    const activateSubscriptionBtn = document.getElementById('activate-subscription-btn');
    const activateSubscriptionModal = document.getElementById('activate-subscription-modal');
    const activateSubscriptionForm = document.getElementById('activate-subscription-form');
    const activationPackageSelect = document.getElementById('activation-package');
    const activationPriceDisplay = document.getElementById('activation-price-display');

    const recordPaymentBtn = document.getElementById('record-payment-btn');
    const recordPaymentModal = document.getElementById('record-payment-modal');
    const recordPaymentForm = document.getElementById('record-payment-form');

    let currentSubscriberId = null;

    // --- تهيئة قاعدة البيانات IndexedDB ---
    function initDB() {
        const request = indexedDB.open(DB_NAME, DB_VERSION);

        request.onerror = (event) => {
            console.error('Database error:', event.target.errorCode);
            showNotification('حدث خطأ أثناء فتح قاعدة البيانات', 'error');
        };

        request.onsuccess = (event) => {
            db = event.target.result;
            console.log('Database opened successfully');
            renderAllData();
        };

        request.onupgradeneeded = (event) => {
            const db = event.target.result;

            // مخزن المشتركين
            if (!db.objectStoreNames.contains('subscribers')) {
                const subscribersStore = db.createObjectStore('subscribers', { keyPath: 'id', autoIncrement: true });
                subscribersStore.createIndex('name', 'name', { unique: false });
            }

            // مخزن الباقات
            if (!db.objectStoreNames.contains('packages')) {
                const packagesStore = db.createObjectStore('packages', { keyPath: 'id', autoIncrement: true });
                packagesStore.createIndex('name', 'name', { unique: true });
            }

            // مخزن الحركات
            if (!db.objectStoreNames.contains('movements')) {
                const movementsStore = db.createObjectStore('movements', { keyPath: 'id', autoIncrement: true });
                movementsStore.createIndex('subscriberId', 'subscriberId', { unique: false });
            }
        };
    }

    // --- وظائف عامة لقاعدة البيانات (CRUD) ---
    function performDBAction(storeName, mode, action) {
        if (!db) {
            showNotification('قاعدة البيانات غير متصلة', 'error');
            return;
        }
        const transaction = db.transaction(storeName, mode);
        const objectStore = transaction.objectStore(storeName);
        action(objectStore, transaction);
    }
    
    // --- عرض البيانات ---
    function renderAllData() {
        renderSubscribers();
        renderPackages();
    }

    function renderSubscribers() {
        subscribersTableBody.innerHTML = '';
        performDBAction('subscribers', 'readonly', (store) => {
            store.openCursor().onsuccess = (event) => {
                const cursor = event.target.result;
                if (cursor) {
                    const sub = cursor.value;
                    const row = `
                        <tr>
                            <td><a href="#" class="subscriber-name-link" data-id="${sub.id}">${sub.name}</a></td>
                            <td>${sub.phone}</td>
                            <td>${sub.debt.toFixed(2)}</td>
                        </tr>`;
                    subscribersTableBody.innerHTML += row;
                    cursor.continue();
                }
            };
        });
    }

    function renderPackages() {
        packagesTableBody.innerHTML = '';
        performDBAction('packages', 'readonly', (store) => {
            store.openCursor().onsuccess = (event) => {
                const cursor = event.target.result;
                if (cursor) {
                    const pkg = cursor.value;
                    const row = `
                        <tr>
                            <td>${pkg.name}</td>
                            <td>${pkg.price.toFixed(2)}</td>
                            <td>
                                <button class="btn secondary-btn" onclick="editPackage(${pkg.id},'${pkg.name}',${pkg.price})">تعديل</button>
                                <button class="btn danger-btn" onclick="deletePackage(${pkg.id})">حذف</button>
                            </td>
                        </tr>`;
                    packagesTableBody.innerHTML += row;
                    cursor.continue();
                }
            };
        });
    }

    function renderMovements(subscriberId) {
        movementsTableBody.innerHTML = '';
        const store = db.transaction('movements').objectStore('movements');
        const index = store.index('subscriberId');
        
        index.openCursor(IDBKeyRange.only(subscriberId)).onsuccess = (event) => {
            const cursor = event.target.result;
            if (cursor) {
                const movement = cursor.value;
                const row = `
                    <tr>
                        <td>${movement.type}</td>
                        <td>${movement.packageName || 'N/A'}</td>
                        <td>${movement.amount.toFixed(2)}</td>
                        <td>${movement.startDate ? formatShortDate(movement.startDate) : 'N/A'}</td>
                        <td>${movement.endDate ? formatShortDate(movement.endDate) : 'N/A'}</td>
                        <td>${formatDateTime(movement.timestamp)}</td>
                        <td>${movement.note || ''}</td>
                    </tr>`;
                movementsTableBody.insertAdjacentHTML('afterbegin', row); // لعرض الأحدث أولاً
                cursor.continue();
            }
        };
    }
    
    // --- إدارة المشتركين ---
    addSubscriberForm.addEventListener('submit', (e) => {
        e.preventDefault();
        const newSubscriber = {
            name: document.getElementById('subscriber-name').value,
            phone: document.getElementById('subscriber-phone').value,
            debt: 0
        };
        
        performDBAction('subscribers', 'readwrite', (store, transaction) => {
            store.add(newSubscriber);
            transaction.oncomplete = () => {
                showNotification('تمت إضافة المشترك بنجاح', 'success');
                addSubscriberForm.reset();
                closeModal(addSubscriberModal);
                renderSubscribers();
            };
        });
    });

    subscribersTableBody.addEventListener('click', (e) => {
        if (e.target.classList.contains('subscriber-name-link')) {
            e.preventDefault();
            const id = Number(e.target.dataset.id);
            openSubscriberDetails(id);
        }
    });

    function openSubscriberDetails(id) {
        currentSubscriberId = id;
        performDBAction('subscribers', 'readonly', (store) => {
            store.get(id).onsuccess = (event) => {
                const sub = event.target.result;
                detailsSubscriberName.textContent = sub.name;
                detailsSubscriberPhone.textContent = sub.phone;
                detailsSubscriberDebt.textContent = `${sub.debt.toFixed(2)} $`;
                renderMovements(id);
                openModal(detailsModal);
            };
        });
    }

    // --- إدارة الباقات ---
    packageForm.addEventListener('submit', (e) => {
        e.preventDefault();
        const id = document.getElementById('package-id').value;
        const packageData = {
            name: document.getElementById('package-name').value,
            price: Number(document.getElementById('package-price').value),
        };

        performDBAction('packages', 'readwrite', (store, transaction) => {
            let request;
            if (id) {
                // تحديث
                packageData.id = Number(id);
                request = store.put(packageData);
            } else {
                // إضافة
                request = store.add(packageData);
            }
            transaction.oncomplete = () => {
                showNotification(`تم ${id ? 'تحديث' : 'حفظ'} الباقة بنجاح`, 'success');
                resetPackageForm();
                renderPackages();
            };
            transaction.onerror = (event) => {
                 showNotification('اسم الباقة موجود مسبقاً', 'error');
            };
        });
    });
    
    cancelEditBtn.addEventListener('click', resetPackageForm);

    window.editPackage = (id, name, price) => {
        document.getElementById('package-id').value = id;
        document.getElementById('package-name').value = name;
        document.getElementById('package-price').value = price;
        cancelEditBtn.style.display = 'inline-block';
    }

    function resetPackageForm(){
        packageForm.reset();
        document.getElementById('package-id').value = '';
        cancelEditBtn.style.display = 'none';
    }

    window.deletePackage = (id) => {
        if (confirm('هل أنت متأكد من حذف هذه الباقة؟')) {
            performDBAction('packages', 'readwrite', (store, transaction) => {
                store.delete(id);
                transaction.oncomplete = () => {
                    showNotification('تم حذف الباقة بنجاح', 'success');
                    renderPackages();
                };
            });
        }
    }
    
    // --- إدارة الحركات (تفعيل وتسديد) ---
    activateSubscriptionBtn.addEventListener('click', async () => {
        activationPackageSelect.innerHTML = '<option value="">اختر باقة...</option>';
        activationPriceDisplay.textContent = '0';
        
        const packages = await getAllFromStore('packages');
        packages.forEach(pkg => {
            const option = `<option value="${pkg.id}" data-price="${pkg.price}">${pkg.name} - $${pkg.price}</option>`;
            activationPackageSelect.innerHTML += option;
        });

        openModal(activateSubscriptionModal);
    });
    
    activationPackageSelect.addEventListener('change', (e) => {
        const selectedOption = e.target.options[e.target.selectedIndex];
        activationPriceDisplay.textContent = selectedOption.dataset.price || '0';
    });

    activateSubscriptionForm.addEventListener('submit', (e) => {
        e.preventDefault();
        const packageId = Number(activationPackageSelect.value);
        if (!packageId) {
            showNotification('الرجاء اختيار باقة', 'error');
            return;
        }

        const selectedOption = activationPackageSelect.options[activationPackageSelect.selectedIndex];
        const price = Number(selectedOption.dataset.price);
        const packageName = selectedOption.text.split(' - ')[0];
        
        const today = new Date();
        const endDate = new Date(today);
        endDate.setDate(today.getDate() + 30);

        const movement = {
            subscriberId: currentSubscriberId,
            type: 'تفعيل',
            packageName: packageName,
            amount: price,
            note: document.getElementById('activation-note').value,
            timestamp: new Date(),
            startDate: today,
            endDate: endDate
        };

        const transaction = db.transaction(['movements', 'subscribers'], 'readwrite');
        const movementsStore = transaction.objectStore('movements');
        const subscribersStore = transaction.objectStore('subscribers');
        
        movementsStore.add(movement);

        const subRequest = subscribersStore.get(currentSubscriberId);
        subRequest.onsuccess = () => {
            const sub = subRequest.result;
            sub.debt += price;
            subscribersStore.put(sub);
        };

        transaction.oncomplete = () => {
            showNotification('تم تفعيل الاشتراك بنجاح', 'success');
            activateSubscriptionForm.reset();
            closeModal(activateSubscriptionModal);
            openSubscriberDetails(currentSubscriberId); // لتحديث الواجهة
        };
    });
    
    recordPaymentBtn.addEventListener('click', () => {
        openModal(recordPaymentModal);
    });

    recordPaymentForm.addEventListener('submit', (e) => {
        e.preventDefault();
        const amount = Number(document.getElementById('payment-amount').value);
        
        const movement = {
            subscriberId: currentSubscriberId,
            type: 'تسديد',
            packageName: null,
            amount: amount,
            note: document.getElementById('payment-note').value,
            timestamp: new Date()
        };
        
        const transaction = db.transaction(['movements', 'subscribers'], 'readwrite');
        const movementsStore = transaction.objectStore('movements');
        const subscribersStore = transaction.objectStore('subscribers');
        
        movementsStore.add(movement);

        const subRequest = subscribersStore.get(currentSubscriberId);
        subRequest.onsuccess = () => {
            const sub = subRequest.result;
            sub.debt -= amount;
            subscribersStore.put(sub);
        };

        transaction.oncomplete = () => {
            showNotification('تم تسجيل الدفعة بنجاح', 'success');
            recordPaymentForm.reset();
            closeModal(recordPaymentModal);
            openSubscriberDetails(currentSubscriberId);
        };
    });

    // --- وظائف مساعدة ---
    function getAllFromStore(storeName) {
        return new Promise((resolve, reject) => {
            const items = [];
            performDBAction(storeName, 'readonly', (store) => {
                const request = store.openCursor();
                request.onsuccess = (event) => {
                    const cursor = event.target.result;
                    if (cursor) {
                        items.push(cursor.value);
                        cursor.continue();
                    } else {
                        resolve(items);
                    }
                };
                request.onerror = (event) => reject(event.target.error);
            });
        });
    }

    function formatDateTime(date) {
        if (!date) return '';
        return new Intl.DateTimeFormat('ar-EG', {
            year: 'numeric', month: 'short', day: 'numeric',
            hour: 'numeric', minute: 'numeric', hour12: true
        }).format(new Date(date));
    }
    
    function formatShortDate(date) {
        if (!date) return '';
        return new Intl.DateTimeFormat('ar-EG', {
            year: 'numeric', month: 'short', day: 'numeric'
        }).format(new Date(date));
    }

    function showNotification(message, type = 'success') {
        const container = document.getElementById('notification-container');
        const notification = document.createElement('div');
        notification.className = `notification ${type}`;
        notification.textContent = message;
        container.appendChild(notification);
        
        setTimeout(() => {
            notification.classList.add('show');
        }, 10);
        
        setTimeout(() => {
            notification.classList.remove('show');
            setTimeout(() => {
                container.removeChild(notification);
            }, 300);
        }, 3000);
    }

    // --- إدارة الواجهة (قائمة جانبية، نوافذ، صفحات) ---
    menuBtn.addEventListener('click', () => sidebar.classList.add('open'));
    closeSidebarBtn.addEventListener('click', () => sidebar.classList.remove('open'));

    navLinks.forEach(link => {
        link.addEventListener('click', (e) => {
            e.preventDefault();
            const pageId = link.dataset.page;
            
            pages.forEach(p => p.classList.remove('active'));
            document.getElementById(`${pageId}-page`).classList.add('active');
            
            navLinks.forEach(l => l.classList.remove('active'));
            link.classList.add('active');
            
            pageTitle.textContent = link.textContent;
            sidebar.classList.remove('open');
        });
    });

    function openModal(modal) {
        modal.classList.add('show');
    }

    function closeModal(modal) {
        modal.classList.remove('show');
    }

    document.querySelectorAll('.modal .close-modal-btn').forEach(btn => {
        btn.addEventListener('click', (e) => {
            closeModal(e.target.closest('.modal'));
        });
    });
    
    window.addEventListener('click', (e) => {
        if (e.target.classList.contains('modal')) {
            closeModal(e.target);
        }
    });

    addSubscriberBtn.addEventListener('click', () => openModal(addSubscriberModal));

    // بدء التطبيق
    initDB();
});