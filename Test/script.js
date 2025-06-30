document.addEventListener('DOMContentLoaded', () => {
    // -------------------
    // 1. الإعدادات الأولية
    // -------------------
    let db;
    const DB_NAME = 'internetSubscriptionsDB';
    const DB_VERSION = 1;
    const STORES = ['subscribers', 'packages', 'movements'];
    let currentSubscriberId = null;

    // عناصر الواجهة الرسومية
    const sidebar = document.getElementById('sidebar');
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
    const exportBtn = document.getElementById('export-data-btn');
    const importBtn = document.getElementById('import-data-btn');
    const importFileInput = document.getElementById('import-file-input');

    // -------------------
    // 2. دوال مساعدة
    // -------------------
    function formatCurrency(amount) {
        return new Intl.NumberFormat('ar-IQ', {
            minimumFractionDigits: 0,
            maximumFractionDigits: 0,
        }).format(Math.round(amount));
    }

    function formatDateTime(dateStr) {
        return new Intl.DateTimeFormat('ar-EG', { year: 'numeric', month: 'short', day: 'numeric', hour: 'numeric', minute: 'numeric', hour12: true }).format(new Date(dateStr));
    }
    
    function formatShortDate(dateStr) {
        return new Intl.DateTimeFormat('ar-EG', { year: 'numeric', month: 'short', day: 'numeric' }).format(new Date(dateStr));
    }

    function showNotification(message, type = 'success') {
        const container = document.getElementById('notification-container');
        const notification = document.createElement('div');
        notification.className = `notification ${type}`;
        notification.textContent = message;
        container.appendChild(notification);
        setTimeout(() => notification.classList.add('show'), 10);
        setTimeout(() => {
            notification.classList.remove('show');
            setTimeout(() => container.removeChild(notification), 300);
        }, 4000);
    }

    function openModal(modal) { modal.classList.add('show'); }
    function closeModal(modal) { modal.classList.remove('show'); }

    // -------------------
    // 3. إدارة قاعدة البيانات
    // -------------------
    function initDB() {
        const request = indexedDB.open(DB_NAME, DB_VERSION);
        request.onerror = () => showNotification('فشل فتح قاعدة البيانات', 'error');
        request.onsuccess = (event) => {
            db = event.target.result;
            renderAllData();
        };
        request.onupgradeneeded = (event) => {
            const db = event.target.result;
            STORES.forEach(storeName => {
                if (!db.objectStoreNames.contains(storeName)) {
                    const store = db.createObjectStore(storeName, { keyPath: 'id', autoIncrement: true });
                    if (storeName === 'packages') store.createIndex('name', 'name', { unique: true });
                    if (storeName === 'movements') store.createIndex('subscriberId', 'subscriberId', { unique: false });
                }
            });
        };
    }

    // -------------------
    // 4. عرض البيانات (Render)
    // -------------------
    function renderAllData() {
        renderSubscribers();
        renderPackages();
    }

    function renderSubscribers() {
        subscribersTableBody.innerHTML = '';
        const store = db.transaction('subscribers', 'readonly').objectStore('subscribers');
        store.openCursor().onsuccess = (event) => {
            const cursor = event.target.result;
            if (cursor) {
                const sub = cursor.value;
                const row = `<tr>
                    <td><a href="#" class="subscriber-name-link" data-id="${sub.id}">${sub.name}</a></td>
                    <td>${sub.phone}</td>
                    <td>${formatCurrency(sub.debt)}</td>
                </tr>`;
                subscribersTableBody.insertAdjacentHTML('beforeend', row);
                cursor.continue();
            }
        };
    }

    function renderPackages() {
        packagesTableBody.innerHTML = '';
        const store = db.transaction('packages', 'readonly').objectStore('packages');
        store.openCursor().onsuccess = (event) => {
            const cursor = event.target.result;
            if (cursor) {
                const pkg = cursor.value;
                const row = `<tr>
                    <td>${pkg.name}</td>
                    <td>${formatCurrency(pkg.price)}</td>
                    <td>
                        <button class="btn secondary-btn" onclick="window.app.editPackage(${pkg.id},'${pkg.name}',${pkg.price})">تعديل</button>
                        <button class="btn danger-btn" onclick="window.app.deletePackage(${pkg.id})">حذف</button>
                    </td>
                </tr>`;
                packagesTableBody.insertAdjacentHTML('beforeend', row);
                cursor.continue();
            }
        };
    }

    function renderMovements(subscriberId) {
        movementsTableBody.innerHTML = '';
        const index = db.transaction('movements').objectStore('movements').index('subscriberId');
        index.openCursor(IDBKeyRange.only(subscriberId)).onsuccess = (event) => {
            const cursor = event.target.result;
            if (cursor) {
                const movement = cursor.value;
                const isPayment = movement.type === 'تسديد';
                const row = `<tr>
                    <td>${movement.type}</td>
                    <td>${isPayment ? '' : (movement.packageName || '')}</td>
                    <td>${formatCurrency(movement.amount)}</td>
                    <td>${isPayment || !movement.startDate ? '' : formatShortDate(movement.startDate)}</td>
                    <td>${isPayment || !movement.endDate ? '' : formatShortDate(movement.endDate)}</td>
                    <td>${movement.timestamp ? formatDateTime(movement.timestamp) : ''}</td>
                    <td>${movement.note || ''}</td>
                </tr>`;
                movementsTableBody.insertAdjacentHTML('afterbegin', row);
                cursor.continue();
            }
        };
    }

    // -------------------
    // 5. وظائف التطبيق الأساسية
    // -------------------
    function addSubscriber(event) {
        event.preventDefault();
        const newSubscriber = {
            name: document.getElementById('subscriber-name').value.trim(),
            phone: document.getElementById('subscriber-phone').value.trim(),
            debt: 0
        };
        if (!newSubscriber.name || !newSubscriber.phone) {
            showNotification('يرجى ملء جميع الحقول', 'error');
            return;
        }
        const transaction = db.transaction('subscribers', 'readwrite');
        transaction.objectStore('subscribers').add(newSubscriber);
        transaction.oncomplete = () => {
            showNotification('تمت إضافة المشترك بنجاح', 'success');
            addSubscriberForm.reset();
            closeModal(addSubscriberModal);
            renderSubscribers();
        };
    }

    function savePackage(event) {
        event.preventDefault();
        const id = document.getElementById('package-id').value;
        const packageData = {
            name: document.getElementById('package-name').value.trim(),
            price: Math.round(Number(document.getElementById('package-price').value)),
        };
        if (!packageData.name || packageData.price <= 0) {
            showNotification('يرجى إدخال اسم وسعر صالحين', 'error');
            return;
        }
        const transaction = db.transaction('packages', 'readwrite');
        const store = transaction.objectStore('packages');
        const request = id ? store.put({ ...packageData, id: Number(id) }) : store.add(packageData);
        request.onerror = () => showNotification('اسم الباقة موجود مسبقاً', 'error');
        transaction.oncomplete = () => {
            showNotification(`تم ${id ? 'تحديث' : 'حفظ'} الباقة بنجاح`, 'success');
            resetPackageForm();
            renderPackages();
        };
    }

    function activateSubscription(event) {
        event.preventDefault();
        const packageId = Number(activationPackageSelect.value);
        if (!packageId) {
            showNotification('الرجاء اختيار باقة', 'error');
            return;
        }
        const selectedOption = activationPackageSelect.options[activationPackageSelect.selectedIndex];
        const price = Math.round(Number(selectedOption.dataset.price));
        const packageName = selectedOption.text.split(' - ')[0];
        const today = new Date();
        const endDate = new Date(today);
        endDate.setDate(today.getDate() + 30);
        const movement = { subscriberId: currentSubscriberId, type: 'تفعيل', packageName, amount: price, note: document.getElementById('activation-note').value.trim(), timestamp: today.toISOString(), startDate: today.toISOString(), endDate: endDate.toISOString() };
        const transaction = db.transaction(['movements', 'subscribers'], 'readwrite');
        transaction.objectStore('movements').add(movement);
        const subRequest = transaction.objectStore('subscribers').get(currentSubscriberId);
        subRequest.onsuccess = () => {
            const sub = subRequest.result;
            sub.debt += price;
            transaction.objectStore('subscribers').put(sub);
        };
        transaction.oncomplete = () => {
            showNotification('تم تفعيل الاشتراك بنجاح', 'success');
            activateSubscriptionForm.reset();
            closeModal(activateSubscriptionModal);
            openSubscriberDetails(currentSubscriberId);
        };
    }

    function recordPayment(event) {
        event.preventDefault();
        const amount = Math.round(Number(document.getElementById('payment-amount').value));
        if (amount <= 0) {
            showNotification('الرجاء إدخال مبلغ صحيح', 'error');
            return;
        }
        const movement = { subscriberId: currentSubscriberId, type: 'تسديد', amount, note: document.getElementById('payment-note').value.trim(), timestamp: new Date().toISOString() };
        const transaction = db.transaction(['movements', 'subscribers'], 'readwrite');
        transaction.objectStore('movements').add(movement);
        const subRequest = transaction.objectStore('subscribers').get(currentSubscriberId);
        subRequest.onsuccess = () => {
            const sub = subRequest.result;
            sub.debt -= amount;
            transaction.objectStore('subscribers').put(sub);
        };
        transaction.oncomplete = () => {
            showNotification('تم تسجيل الدفعة بنجاح', 'success');
            recordPaymentForm.reset();
            closeModal(recordPaymentModal);
            openSubscriberDetails(currentSubscriberId);
        };
    }
    
    // وضع الدوال القابلة للاستدعاء من HTML في نطاق window
    window.app = {
        editPackage: (id, name, price) => {
            document.getElementById('package-id').value = id;
            document.getElementById('package-name').value = name;
            document.getElementById('package-price').value = price;
            cancelEditBtn.style.display = 'inline-block';
            window.scrollTo(0, 0);
        },
        deletePackage: (id) => {
            if (confirm('هل أنت متأكد من حذف هذه الباقة؟')) {
                const transaction = db.transaction('packages', 'readwrite');
                transaction.objectStore('packages').delete(id);
                transaction.oncomplete = () => {
                    showNotification('تم حذف الباقة بنجاح', 'success');
                    renderPackages();
                };
            }
        }
    };
    
    function resetPackageForm() {
        packageForm.reset();
        document.getElementById('package-id').value = '';
        cancelEditBtn.style.display = 'none';
    }

    function openSubscriberDetails(id) {
        currentSubscriberId = id;
        const store = db.transaction('subscribers', 'readonly').objectStore('subscribers');
        store.get(id).onsuccess = (event) => {
            const sub = event.target.result;
            if (sub) {
                detailsSubscriberName.textContent = sub.name;
                detailsSubscriberPhone.textContent = sub.phone;
                detailsSubscriberDebt.textContent = `${formatCurrency(sub.debt)} دينار`;
                renderMovements(id);
                openModal(detailsModal);
            }
        };
    }
    
    // -------------------
    // 6. التصدير والاستيراد
    // -------------------
    async function exportData() {
        try {
            const dataToExport = {};
            const transaction = db.transaction(STORES, 'readonly');
            for (const storeName of STORES) {
                const allRecords = await new Promise((resolve, reject) => {
                    const request = transaction.objectStore(storeName).getAll();
                    request.onsuccess = () => resolve(request.result);
                    request.onerror = () => reject(request.error);
                });
                dataToExport[storeName] = allRecords;
            }
            const dataStr = JSON.stringify(dataToExport, null, 2);
            const blob = new Blob([dataStr], { type: 'application/json' });
            const url = URL.createObjectURL(blob);
            const a = document.createElement('a');
            a.href = url;
            a.download = `subscriptions-backup-${new Date().toISOString().slice(0, 10)}.json`;
            a.click();
            URL.revokeObjectURL(url);
            showNotification('تم تصدير البيانات بنجاح', 'success');
        } catch (error) {
            showNotification('فشل تصدير البيانات', 'error');
        }
    }

    function importData(event) {
        const file = event.target.files[0];
        if (!file) return;
        if (!confirm('تحذير: هذا سيؤدي إلى حذف جميع البيانات الحالية واستبدالها ببيانات الملف. هل أنت متأكد؟')) {
            importFileInput.value = '';
            return;
        }
        const reader = new FileReader();
        reader.onload = async (e) => {
            try {
                const data = JSON.parse(e.target.result);
                if (!STORES.every(store => data.hasOwnProperty(store))) {
                    throw new Error('ملف البيانات غير صالح.');
                }
                const clearTransaction = db.transaction(STORES, 'readwrite');
                await Promise.all(STORES.map(storeName =>
                    new Promise((resolve, reject) => {
                        const request = clearTransaction.objectStore(storeName).clear();
                        request.onsuccess = resolve;
                        request.onerror = reject;
                    })
                ));
                const addTransaction = db.transaction(STORES, 'readwrite');
                STORES.forEach(storeName => {
                    const store = addTransaction.objectStore(storeName);
                    data[storeName].forEach(record => store.add(record));
                });
                addTransaction.oncomplete = () => {
                    showNotification('تم استيراد البيانات بنجاح!', 'success');
                    renderAllData();
                };
            } catch (error) {
                showNotification(`فشل استيراد البيانات: ${error.message}`, 'error');
            } finally {
                importFileInput.value = '';
            }
        };
        reader.readAsText(file);
    }
    
    // -------------------
    // 7. ربط الأحداث
    // -------------------
    // القائمة الجانبية والتنقل
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

    // النوافذ المنبثقة
    document.querySelectorAll('.modal .close-modal-btn').forEach(btn => btn.addEventListener('click', (e) => closeModal(e.target.closest('.modal'))));
    window.addEventListener('click', (e) => { if (e.target.classList.contains('modal')) closeModal(e.target); });

    // نماذج الإدخال
    addSubscriberBtn.addEventListener('click', () => openModal(addSubscriberModal));
    addSubscriberForm.addEventListener('submit', addSubscriber);
    packageForm.addEventListener('submit', savePackage);
    cancelEditBtn.addEventListener('click', resetPackageForm);
    activateSubscriptionBtn.addEventListener('click', async () => {
        activationPackageSelect.innerHTML = '<option value="">اختر باقة...</option>';
        activationPriceDisplay.textContent = '0';
        const packages = await db.transaction('packages').objectStore('packages').getAll();
        packages.forEach(pkg => {
            const option = `<option value="${pkg.id}" data-price="${pkg.price}">${pkg.name} - ${formatCurrency(pkg.price)} دينار</option>`;
            activationPackageSelect.insertAdjacentHTML('beforeend', option);
        });
        openModal(activateSubscriptionModal);
    });
    activationPackageSelect.addEventListener('change', (e) => {
        const selectedOption = e.target.options[e.target.selectedIndex];
        activationPriceDisplay.textContent = formatCurrency(selectedOption.dataset.price || '0');
    });
    activateSubscriptionForm.addEventListener('submit', activateSubscription);
    recordPaymentBtn.addEventListener('click', () => openModal(recordPaymentModal));
    recordPaymentForm.addEventListener('submit', recordPayment);
    subscribersTableBody.addEventListener('click', (e) => {
        if (e.target.classList.contains('subscriber-name-link')) {
            e.preventDefault();
            openSubscriberDetails(Number(e.target.dataset.id));
        }
    });

    // التصدير والاستيراد
    exportBtn.addEventListener('click', exportData);
    importBtn.addEventListener('click', () => importFileInput.click());
    importFileInput.addEventListener('change', importData);

    // -------------------
    // 8. بدء التطبيق
    // -------------------
    initDB();
});
